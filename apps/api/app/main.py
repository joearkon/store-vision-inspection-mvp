from __future__ import annotations

import hashlib
import json
import shutil
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .config import Settings
from .db import Database, utc_now


class RunCreate(BaseModel):
    video_id: str
    notifications_enabled: bool = False
    analysis_mode: Literal["frame_baseline", "two_stage"] | None = None
    rule_code: Literal["E1", "A1"] = "E1"


class RuleConfigUpdate(BaseModel):
    default_analysis_mode: Literal["frame_baseline", "two_stage"]


class EventAction(BaseModel):
    action: str
    note: str | None = None
    actor_id: str = "USER-ADMIN"


EVENT_TRANSITIONS = {
    "acknowledge": ("acknowledged", "已确认"),
    "start_rectification": ("rectifying", "开始整改"),
    "resolve": ("resolved", "已解决"),
    "mark_false_positive": ("false_positive", "标记误报"),
    "ignore": ("ignored", "已忽略"),
}


def create_app(settings: Settings | None = None) -> FastAPI:
    current_settings = settings or Settings.from_env()
    current_settings.ensure_directories()
    database = Database(current_settings.database_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        database.initialize()
        yield

    app = FastAPI(title="门店 AI 视频巡检 API", version="0.1.0", lifespan=lifespan)
    app.state.settings = current_settings
    app.state.database = database
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/bootstrap")
    def bootstrap() -> dict[str, Any]:
        store = database.fetch_one("SELECT * FROM stores WHERE id='STORE-JTU'")
        cameras = database.fetch_all(
            "SELECT * FROM camera_sources WHERE store_id='STORE-JTU' ORDER BY code"
        )
        return {"store": store, "cameras": cameras, "current_user": {
            "id": "USER-ADMIN", "display_name": "总部巡检管理员", "role": "system_admin"
        }}

    @app.post("/api/videos", status_code=201)
    async def upload_video(
        request: Request,
        filename: str = Query(..., min_length=1, max_length=255),
        store_id: str = Query("STORE-JTU"),
        camera_id: str = Query("CAM-STORAGE-01"),
        source_kind: str = Query("upload", pattern="^(upload|preset)$"),
    ) -> dict[str, Any]:
        if Path(filename).suffix.lower() != ".mp4":
            raise HTTPException(415, "第一阶段仅支持 MP4 视频")
        if not database.fetch_one("SELECT id FROM stores WHERE id=?", (store_id,)):
            raise HTTPException(404, "门店不存在")
        if not database.fetch_one(
            "SELECT id FROM camera_sources WHERE id=? AND store_id=?", (camera_id, store_id)
        ):
            raise HTTPException(404, "摄像头不存在或不属于该门店")

        video_id = f"VID-{uuid.uuid4().hex[:12].upper()}"
        target = current_settings.data_dir / "videos" / f"{video_id}.mp4"
        sha256 = hashlib.sha256()
        size = 0
        with target.open("wb") as output:
            async for chunk in request.stream():
                size += len(chunk)
                if size > current_settings.max_upload_bytes:
                    output.close()
                    target.unlink(missing_ok=True)
                    raise HTTPException(413, "视频超过允许的最大大小")
                sha256.update(chunk)
                output.write(chunk)
        if size == 0:
            target.unlink(missing_ok=True)
            raise HTTPException(400, "视频内容为空")

        database.execute(
            """
            INSERT INTO video_assets
            (id, store_id, camera_id, original_name, storage_path, source_kind,
             size_bytes, sha256, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                video_id,
                store_id,
                camera_id,
                filename,
                str(target),
                source_kind,
                size,
                sha256.hexdigest(),
                utc_now(),
            ),
        )
        return database.fetch_one("SELECT * FROM video_assets WHERE id=?", (video_id,)) or {}

    @app.post("/api/analysis-runs", status_code=201)
    def create_run(payload: RunCreate) -> dict[str, Any]:
        if not database.fetch_one("SELECT id FROM video_assets WHERE id=?", (payload.video_id,)):
            raise HTTPException(404, "视频不存在")
        run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
        configured = database.fetch_one(
            "SELECT value FROM system_settings WHERE key='default_analysis_mode'"
        )
        analysis_mode = payload.analysis_mode or (
            configured["value"] if configured else "two_stage"
        )
        if not database.fetch_one(
            "SELECT id FROM analysis_profiles WHERE id=? AND enabled=1", (analysis_mode,)
        ):
            raise HTTPException(400, "分析模式不可用")
        database.execute(
            """
            INSERT INTO analysis_runs
            (id, video_id, status, progress, stage, notifications_enabled,
             analysis_mode, rule_code, frame_rate, created_at)
            VALUES (?, ?, 'queued', 0, 'queued', ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                payload.video_id,
                int(payload.notifications_enabled),
                analysis_mode,
                payload.rule_code,
                current_settings.frame_rate,
                utc_now(),
            ),
        )
        return database.fetch_one("SELECT * FROM analysis_runs WHERE id=?", (run_id,)) or {}

    @app.get("/api/analysis-runs")
    def list_runs() -> list[dict[str, Any]]:
        runs = database.fetch_all(
            """
            SELECT ar.*, va.original_name, va.camera_id
            FROM analysis_runs ar JOIN video_assets va ON va.id=ar.video_id
            ORDER BY ar.created_at DESC LIMIT 100
            """
        )
        for run in runs:
            run["estimated_fallback_tokens"] = int(run["total_frames"] or 0) * 1800
        return runs

    @app.get("/api/analysis-runs/{run_id}")
    def get_run(run_id: str) -> dict[str, Any]:
        run = database.fetch_one(
            """
            SELECT ar.*, va.original_name, va.camera_id
            FROM analysis_runs ar JOIN video_assets va ON va.id=ar.video_id
            WHERE ar.id=?
            """,
            (run_id,),
        )
        if not run:
            raise HTTPException(404, "分析任务不存在")
        run["estimated_fallback_tokens"] = int(run["total_frames"] or 0) * 1800
        return run

    @app.post("/api/analysis-runs/{run_id}/approve-fallback")
    def approve_fallback(run_id: str) -> dict[str, Any]:
        run = database.fetch_one("SELECT * FROM analysis_runs WHERE id=?", (run_id,))
        if not run:
            raise HTTPException(404, "分析任务不存在")
        if run["status"] != "awaiting_approval":
            raise HTTPException(409, "当前任务不需要确认逐帧回退")
        database.execute("DELETE FROM frame_findings WHERE run_id=?", (run_id,))
        database.execute(
            """
            UPDATE analysis_runs
            SET status='queued', stage='queued', progress=.1, processed_frames=0,
                fallback_approved=1, fallback_approved_at=?,
                error_code=NULL, error_message=NULL, completed_at=NULL
            WHERE id=?
            """,
            (utc_now(), run_id),
        )
        return get_run(run_id)

    @app.get("/api/rules/config")
    def get_rule_config() -> dict[str, Any]:
        configured = database.fetch_one(
            "SELECT value FROM system_settings WHERE key='default_analysis_mode'"
        )
        profiles = database.fetch_all(
            "SELECT * FROM analysis_profiles WHERE enabled=1 ORDER BY id"
        )
        for profile in profiles:
            profile["config"] = json.loads(profile.pop("config_json"))
        return {
            "rule": {
                "code": "E1",
                "name": "冰箱门持续开启",
                "threshold_seconds": current_settings.e1_open_seconds,
                "severity": "P1",
            },
            "default_analysis_mode": configured["value"] if configured else "two_stage",
            "profiles": profiles,
        }

    @app.put("/api/rules/config")
    def update_rule_config(payload: RuleConfigUpdate) -> dict[str, Any]:
        if not database.fetch_one(
            "SELECT id FROM analysis_profiles WHERE id=? AND enabled=1",
            (payload.default_analysis_mode,),
        ):
            raise HTTPException(400, "分析模式不可用")
        database.execute(
            """
            INSERT INTO system_settings(key, value, updated_at)
            VALUES ('default_analysis_mode', ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            """,
            (payload.default_analysis_mode, utc_now()),
        )
        return get_rule_config()

    @app.get("/api/events")
    def list_events(limit: int = Query(50, ge=1, le=200)) -> list[dict[str, Any]]:
        return database.fetch_all(
            """
            SELECT e.*, s.name AS store_name, c.name AS camera_name,
                   CASE WHEN e.status NOT IN ('resolved','false_positive','ignored')
                             AND e.due_at IS NOT NULL AND e.due_at < ?
                        THEN 1 ELSE 0 END AS overdue
            FROM inspection_events e
            JOIN stores s ON s.id=e.store_id
            JOIN camera_sources c ON c.id=e.camera_id
            ORDER BY e.created_at DESC LIMIT ?
            """,
            (utc_now(), limit),
        )

    @app.get("/api/events/{event_id}")
    def get_event(event_id: str) -> dict[str, Any]:
        event = database.fetch_one(
            """
            SELECT e.*, s.name AS store_name, c.name AS camera_name,
                   ar.analysis_mode, ar.prompt_tokens, ar.completion_tokens,
                   ar.request_count, va.duration_seconds AS video_duration_seconds,
                   va.original_name AS video_original_name
            FROM inspection_events e
            JOIN stores s ON s.id=e.store_id
            JOIN camera_sources c ON c.id=e.camera_id
            JOIN analysis_runs ar ON ar.id=e.run_id
            JOIN video_assets va ON va.id=ar.video_id
            WHERE e.id=?
            """,
            (event_id,),
        )
        if not event:
            raise HTTPException(404, "事件不存在")
        event["evidence"] = database.fetch_all(
            "SELECT * FROM event_evidence WHERE event_id=? ORDER BY captured_offset",
            (event_id,),
        )
        event["timeline"] = database.fetch_all(
            "SELECT * FROM event_action_logs WHERE event_id=? ORDER BY created_at",
            (event_id,),
        )
        event["notifications"] = database.fetch_all(
            "SELECT * FROM notification_deliveries WHERE event_id=? ORDER BY created_at",
            (event_id,),
        )
        return event

    @app.post("/api/events/{event_id}/actions")
    def apply_event_action(event_id: str, payload: EventAction) -> dict[str, Any]:
        event = database.fetch_one("SELECT * FROM inspection_events WHERE id=?", (event_id,))
        if not event:
            raise HTTPException(404, "事件不存在")
        if payload.action not in EVENT_TRANSITIONS:
            raise HTTPException(400, "不支持的事件动作")
        next_status, label = EVENT_TRANSITIONS[payload.action]
        terminal = {"resolved", "false_positive", "ignored"}
        if event["status"] in terminal:
            raise HTTPException(409, "终态事件不能继续变更")
        now = utc_now()
        resolved_at = now if next_status == "resolved" else event["resolved_at"]
        acknowledged_at = (
            now if next_status in {"acknowledged", "rectifying", "resolved"}
            and not event["acknowledged_at"] else event["acknowledged_at"]
        )
        database.execute(
            """
            UPDATE inspection_events
            SET status=?, acknowledged_at=?, resolved_at=?, updated_at=?
            WHERE id=?
            """,
            (next_status, acknowledged_at, resolved_at, now, event_id),
        )
        database.execute(
            """
            INSERT INTO event_action_logs
            (id, event_id, actor_id, action, from_status, to_status, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"LOG-{uuid.uuid4().hex[:12].upper()}",
                event_id,
                payload.actor_id,
                payload.action,
                event["status"],
                next_status,
                payload.note or label,
                now,
            ),
        )
        return get_event(event_id)

    @app.get("/api/media/evidence/{evidence_id}")
    def get_evidence_file(evidence_id: str) -> FileResponse:
        evidence = database.fetch_one(
            "SELECT image_path FROM event_evidence WHERE id=?", (evidence_id,)
        )
        if not evidence or not Path(evidence["image_path"]).exists():
            raise HTTPException(404, "证据不存在")
        return FileResponse(evidence["image_path"], media_type="image/jpeg")

    @app.get("/api/media/events/{event_id}/video")
    def get_event_video(event_id: str) -> FileResponse:
        video = database.fetch_one(
            """
            SELECT va.storage_path, va.original_name
            FROM inspection_events e
            JOIN analysis_runs ar ON ar.id=e.run_id
            JOIN video_assets va ON va.id=ar.video_id
            WHERE e.id=?
            """,
            (event_id,),
        )
        if not video or not Path(video["storage_path"]).exists():
            raise HTTPException(404, "原始视频不存在")
        return FileResponse(
            video["storage_path"],
            media_type="video/mp4",
            filename=video["original_name"],
            content_disposition_type="inline",
        )

    @app.get("/api/dashboard")
    def dashboard() -> dict[str, Any]:
        events = list_events(8)
        pending = sum(
            event["status"] not in {"resolved", "false_positive", "ignored"}
            for event in events
        )
        online = database.fetch_one(
            "SELECT COUNT(*) AS count FROM camera_sources WHERE status='online'"
        )
        total = database.fetch_one("SELECT COUNT(*) AS count FROM camera_sources")
        completed_runs = database.fetch_one(
            "SELECT COUNT(*) AS count FROM analysis_runs WHERE status='completed'"
        )
        return {
            "metrics": {
                "today_events": len(events),
                "pending_events": pending,
                "online_cameras": online["count"] if online else 0,
                "total_cameras": total["count"] if total else 0,
                "completed_runs": completed_runs["count"] if completed_runs else 0,
            },
            "recent_events": events,
        }

    return app


app = create_app()
