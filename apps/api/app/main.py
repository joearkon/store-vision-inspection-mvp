from __future__ import annotations
from .playback import playback_path

import hashlib
import json
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import sqlite3

from .config import Settings
from .db import Database, utc_now
from .notifier import FeishuNotifier, build_event_card
from .costs import estimate_analysis_cost
from .scene import match_scene
from .run_report import build_run_report
from .decision_trace import build_run_snapshots


class SceneConfirm(BaseModel):
    region_kinds: list[Literal['table','counter','operation','floor','fridge','ignore']]

class RunCreate(BaseModel):
    video_id: str
    scene_request: bool = False
    explicit_rule: bool = False
    notifications_enabled: bool = True
    cleaning_window_complete: bool = False
    cleaning_window_closed: bool = False
    cleaning_video_start: str | None = None
    analysis_mode: Literal["frame_baseline", "two_stage"] | None = None
    rule_code: Literal["E1", "A1", "A2", "A3", "A4", "B1", "C1", "G1", "G2", "M1"] | None = None


class RuleConfigUpdate(BaseModel):
    default_analysis_mode: Literal["frame_baseline", "two_stage"]


class CameraCreate(BaseModel):
    name: str
    code: str
    area_type: Literal["front_counter", "back_kitchen", "dining_area", "pickup_area", "storage"]


class CameraStatusUpdate(BaseModel):
    status: Literal["online", "offline"]


class EventAction(BaseModel):
    action: str
    note: str | None = None
    assignee_id: str | None = None
    actor_id: str = "USER-ADMIN"


class FeishuTestSend(BaseModel):
    event_id: str
    confirm: Literal[True]


EVENT_TRANSITIONS = {
    "acknowledge": ("acknowledged", "已确认"),
    "assign": ("acknowledged", "已指派整改"),
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

    from . import sop

    @app.get("/api/sop")
    def sop_state(store_id: str = "STORE-JTU", date: str | None = None):
        try: return sop.state(database,store_id,date)
        except ValueError as exc: raise HTTPException(422,str(exc))

    @app.put("/api/sop/templates/{template_id}")
    def sop_save(template_id: str, payload: dict, store_id: str = "STORE-JTU"):
        if not database.fetch_one("SELECT id FROM stores WHERE id=?",(store_id,)): raise HTTPException(404,"门店不存在")
        try: template=sop.validate_template(dict(payload,id=template_id))
        except ValueError as exc: raise HTTPException(422,str(exc))
        database.execute("INSERT INTO sop_templates VALUES (?,?,?,1) ON CONFLICT(store_id,id) DO UPDATE SET config_json=excluded.config_json,enabled=1",(store_id,template_id,database.json(template)))
        return template

    @app.delete("/api/sop/templates/{template_id}")
    def sop_disable(template_id: str, store_id: str = "STORE-JTU"):
        database.execute("UPDATE sop_templates SET enabled=0 WHERE store_id=? AND id=?",(store_id,template_id))
        return {"disabled":True}

    @app.post("/api/sop/tasks/{task_id}/records/{item_id}")
    def sop_record(task_id: str,item_id: str,payload: dict):
        try: return sop.verify_record(database,task_id,item_id,payload)
        except (ValueError,TypeError) as exc: raise HTTPException(422,str(exc))

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/bootstrap")
    def bootstrap() -> dict[str, Any]:
        store = database.fetch_one("SELECT * FROM stores WHERE id='STORE-JTU'")
        cameras = database.fetch_all(
            """SELECT c.*,
                      (SELECT MAX(ar.completed_at)
                       FROM analysis_runs ar JOIN video_assets va ON va.id=ar.video_id
                       WHERE va.camera_id=c.id AND ar.status='completed') AS last_analysis_at
               FROM camera_sources c WHERE c.store_id='STORE-JTU' ORDER BY c.code"""
        )
        for camera in cameras:
            frame = database.fetch_one("SELECT f.id FROM frame_findings f JOIN analysis_runs r ON r.id=f.run_id JOIN video_assets v ON v.id=r.video_id WHERE v.camera_id=? ORDER BY r.created_at DESC,f.captured_offset LIMIT 1", (camera["id"],))
            camera["preview_image_url"] = f"/api/media/findings/{frame['id']}" if frame else None
        today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        uploads = database.fetch_all(
            "SELECT size_bytes, created_at FROM video_assets WHERE store_id='STORE-JTU' AND source_kind='upload'"
        )
        today_upload_bytes = sum(
            item["size_bytes"] for item in uploads
            if datetime.fromisoformat(item["created_at"]).astimezone(ZoneInfo("Asia/Shanghai")).date() == today
        )
        return {"store": store, "cameras": cameras, "today_upload_bytes": today_upload_bytes, "current_user": {
            "id": "USER-ADMIN", "display_name": "总部巡检管理员", "role": "system_admin"
        }}

    @app.post("/api/cameras", status_code=201)
    def create_camera(payload: CameraCreate) -> dict[str, Any]:
        name, code = payload.name.strip(), payload.code.strip().upper()
        if not 1 <= len(name) <= 60 or not 2 <= len(code) <= 32 or not all(ch.isascii() and (ch.isalnum() or ch == "-") for ch in code):
            raise HTTPException(422, "名称或编号无效；编号仅支持英文字母、数字和连字符")
        camera_id = f"CAM-{uuid.uuid4().hex[:12].upper()}"
        try:
            database.execute(
                """INSERT INTO camera_sources
                   (id, store_id, code, name, area_type, source_type, status, created_at)
                   VALUES (?, 'STORE-JTU', ?, ?, ?, 'virtual', 'offline', ?)""",
                (camera_id, code, name, payload.area_type, utc_now()),
            )
        except sqlite3.IntegrityError:
            raise HTTPException(409, "摄像头编号已存在") from None
        return database.fetch_one("SELECT * FROM camera_sources WHERE id=?", (camera_id,))

    @app.patch("/api/cameras/{camera_id}")
    def update_camera_status(camera_id: str, payload: CameraStatusUpdate) -> dict[str, Any]:
        camera = database.fetch_one("SELECT * FROM camera_sources WHERE id=? AND store_id='STORE-JTU'", (camera_id,))
        if not camera:
            raise HTTPException(404, "摄像头不存在")
        database.execute("UPDATE camera_sources SET status=? WHERE id=?", (payload.status, camera_id))
        return database.fetch_one("SELECT * FROM camera_sources WHERE id=?", (camera_id,))

    @app.get("/api/cameras/{camera_id}/detail")
    def camera_detail(camera_id: str, days: int = Query(1, ge=1, le=30)) -> dict[str, Any]:
        if days not in (1, 7, 30):
            raise HTTPException(422, "仅支持今日、近 7 日或近 30 日")
        camera = database.fetch_one(
            "SELECT * FROM camera_sources WHERE id=? AND store_id='STORE-JTU'", (camera_id,)
        )
        if not camera:
            raise HTTPException(404, "摄像头不存在")
        local_today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        start = datetime.combine(local_today - timedelta(days=days - 1), time.min,
                                 tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(timezone.utc).isoformat()
        end = datetime.combine(local_today, time.max,
                               tzinfo=ZoneInfo("Asia/Shanghai")).astimezone(timezone.utc).isoformat()
        counts = database.fetch_one(
            """SELECT COUNT(*) AS total,
                      SUM(CASE WHEN severity='P0' THEN 1 ELSE 0 END) AS p0,
                      SUM(CASE WHEN severity='P1' THEN 1 ELSE 0 END) AS p1,
                      SUM(CASE WHEN severity='P2' THEN 1 ELSE 0 END) AS p2
               FROM inspection_events
               WHERE camera_id=? AND store_id='STORE-JTU'
                 AND status NOT IN ('false_positive','ignored')
                 AND julianday(created_at)>=julianday(?) AND julianday(created_at)<=julianday(?)""",
            (camera_id, start, end),
        )
        events = database.fetch_all(
            """SELECT e.id, e.rule_code, e.title, e.severity, e.status,
                      e.max_confidence, e.created_at,
                      (SELECT ev.id FROM event_evidence ev WHERE ev.event_id=e.id
                       ORDER BY CASE ev.evidence_type WHEN 'peak' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
                                ev.captured_offset LIMIT 1) AS thumbnail_evidence_id
               FROM inspection_events e
               WHERE e.camera_id=? AND e.store_id='STORE-JTU'
                 AND julianday(e.created_at)>=julianday(?) AND julianday(e.created_at)<=julianday(?)
               ORDER BY e.created_at DESC LIMIT 200""",
            (camera_id, start, end),
        )
        return {
            "camera": camera, "days": days,
            "counts": {key: (counts or {}).get(key) or 0 for key in ("total", "p0", "p1", "p2")},
            "events": events,
        }

    @app.get("/api/operations/config")
    def operations_config() -> dict[str, Any]:
        # Each camera remains associated with its own store; never fill missing layouts.
        return {"stores": database.fetch_all("SELECT id,name FROM stores ORDER BY name,id"),
                "cameras": database.fetch_all("SELECT id,name,store_id,area_type,roi_json FROM camera_sources ORDER BY store_id,code,id"),
                "rule_settings": database.fetch_all("SELECT store_id,rule_code,enabled FROM store_rule_settings ORDER BY store_id,rule_code"),
                "scene_candidates": database.fetch_all("SELECT j.video_id,j.result_json,v.store_id,v.camera_id,v.original_name FROM scene_jobs j JOIN video_assets v ON v.id=j.video_id WHERE j.status='completed' ORDER BY j.created_at DESC LIMIT 100")}

    @app.get("/api/cameras/{camera_id}/table-layout/image")
    def table_layout_image(camera_id: str, view: Literal["annotated", "reference"] = "annotated"):
        camera=database.fetch_one("SELECT roi_json FROM camera_sources WHERE id=? AND store_id='STORE-JTU'",(camera_id,))
        if not camera:
            raise HTTPException(404,"视频源不存在")
        try:
            layout=json.loads(camera['roi_json'] or '{}').get('table_layout')
        except (TypeError,ValueError):
            layout=None
        if not layout:
            raise HTTPException(404,"该机位尚未配置桌位")
        # Only fixed calibration assets; never accept an arbitrary filesystem path.
        filename='table-layout-review.png' if view=='annotated' else 'reference.jpg'
        target=current_settings.data_dir/'table-calibration'/filename
        if not target.is_file():
            raise HTTPException(404,"标定截图暂不可用")
        return FileResponse(target)

    @app.post("/api/videos", status_code=201)
    async def upload_video(
        request: Request,
        filename: str = Query(..., min_length=1, max_length=255),
        store_id: str = Query("STORE-JTU"),
        camera_id: str | None = Query(None),
        detect_scene: bool = Query(False),
        explicit_rules: bool = Query(False),
        source_kind: str = Query("upload", pattern="^(upload|preset)$"),
    ) -> dict[str, Any]:
        if Path(filename).suffix.lower() != ".mp4":
            raise HTTPException(415, "第一阶段仅支持 MP4 视频")
        if not database.fetch_one("SELECT id FROM stores WHERE id=?", (store_id,)):
            raise HTTPException(404, "门店不存在")
        if camera_id is None and not detect_scene and not explicit_rules:
            camera_id="CAM-STORAGE-01"
        if camera_id is None:
            camera_id='CAM-UPLOAD-'+uuid.uuid4().hex[:10].upper()
            database.execute("INSERT INTO camera_sources (id,store_id,code,name,area_type,source_type,status,created_at) VALUES (?,?,?,?, 'unknown','upload','online',?)",
                (camera_id,store_id,camera_id,'新上传 · 待识别机位',utc_now()))
        camera = database.fetch_one(
            "SELECT id, status FROM camera_sources WHERE id=? AND store_id=?", (camera_id, store_id)
        )
        if not camera:
            raise HTTPException(404, "摄像头不存在或不属于该门店")
        if camera["status"] != "online":
            raise HTTPException(409, "该演示视频源已停用，请先在摄像头管理中启用")

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
        if detect_scene:
            database.execute("INSERT INTO scene_jobs VALUES (?,'queued',NULL,NULL,?,NULL)",(video_id,utc_now()))
        return database.fetch_one("SELECT * FROM video_assets WHERE id=?", (video_id,)) or {}

    @app.get("/api/videos/{video_id}/scene")
    def scene_result(video_id: str):
        job=database.fetch_one("SELECT * FROM scene_jobs WHERE video_id=?",(video_id,))
        if not job: raise HTTPException(404,'尚无场景识别任务')
        job['result']=json.loads(job.pop('result_json') or 'null')
        return job

    @app.get("/api/videos/{video_id}/scene/image")
    def scene_image(video_id: str):
        if not database.fetch_one("SELECT video_id FROM scene_jobs WHERE video_id=?",(video_id,)):
            raise HTTPException(404,'场景任务不存在')
        target=current_settings.data_dir/'scenes'/video_id/'0.jpg'
        if not target.is_file(): raise HTTPException(404,'场景截图尚未生成')
        return FileResponse(target)

    @app.post("/api/videos/{video_id}/scene/retry")
    def retry_scene(video_id: str):
        job=scene_result(video_id)
        if job['status']!='failed': raise HTTPException(409,'仅失败任务可重试')
        database.execute("UPDATE scene_jobs SET status='queued',error_message=NULL,completed_at=NULL WHERE video_id=?",(video_id,))
        return scene_result(video_id)

    @app.post("/api/videos/{video_id}/scene/confirm")
    def confirm_scene(video_id: str, payload: SceneConfirm):
        job=scene_result(video_id);result=job.get('result')
        if job['status']!='completed' or not result: raise HTTPException(409,'场景识别尚未完成')
        if result['image_quality']!='usable': raise HTTPException(422,'画面证据不足，请重新上传清晰视频')
        if len(payload.region_kinds)!=len(result['regions']): raise HTTPException(422,'请逐项确认已有候选区域')
        original=result.get('original_regions',result['regions'])
        regions=[dict(r,kind=k,confirmed=True) for r,k in zip(result['regions'],payload.region_kinds) if k!='ignore']
        video=database.fetch_one("SELECT v.store_id,c.roi_json FROM video_assets v JOIN camera_sources c ON c.id=v.camera_id WHERE v.id=?",(video_id,))
        enabled={r['rule_code'] for r in database.fetch_all("SELECT rule_code FROM store_rule_settings WHERE store_id=? AND enabled=1",(video['store_id'],))}
        updated=match_scene(dict(result,regions=regions),enabled,json.loads(video['roi_json'] or '{}'))
        updated.update(original_regions=original,confirmed=True,confirmed_at=utc_now(),origin='human_confirmed_model_regions',usage=result.get('usage'),preview_url=result['preview_url'])
        database.execute("UPDATE scene_jobs SET result_json=? WHERE video_id=?",(database.json(updated),video_id))
        return scene_result(video_id)

    @app.post("/api/analysis-runs", status_code=201)
    def create_run(payload: RunCreate) -> dict[str, Any]:
        video = database.fetch_one(
            """SELECT va.id, va.store_id, c.area_type, c.roi_json FROM video_assets va
               JOIN camera_sources c ON c.id=va.camera_id WHERE va.id=?""",
            (payload.video_id,),
        )
        if not video:
            raise HTTPException(404, "视频不存在")
        defaults = {"storage": "E1", "front_counter": "A1", "back_kitchen": "B1"}
        allowed = {
            "storage": {"E1"},
            "dining_area": {"G2", "M1"},
            "front_counter": {"M1", "A1", "A2", "C1", "A3", "A4"},
            "back_kitchen": {"B1", "A2", "C1", "A3", "A4"},
        }
        scene=database.fetch_one("SELECT status,result_json FROM scene_jobs WHERE video_id=?",(payload.video_id,))
        scene_data=None
        if scene:
            if scene['status']!='completed': raise HTTPException(409,'请先完成视频场景识别')
            scene_data=json.loads(scene['result_json'] or '{}')
            if scene_data.get('needs_confirmation'): raise HTTPException(409,'候选区域不确定，请先确认或纠正')
        rule_code = payload.rule_code or (scene_data.get('rules',[None])[0] if scene_data and scene_data.get('rules') else defaults.get(video["area_type"]))
        if not rule_code:
            raise HTTPException(400, "该摄像头区域暂无可用于上传视频分析的规则")
        if (scene_data or payload.explicit_rule) and not database.fetch_one("SELECT rule_code FROM store_rule_settings WHERE store_id=? AND rule_code=? AND enabled=1",(video['store_id'],rule_code)):
            raise HTTPException(422,'该门店未启用此规则')
        if not payload.explicit_rule and rule_code not in (set(scene_data.get("rules",[])) if scene_data else allowed.get(video["area_type"], set())):
            raise HTTPException(400, "所选规则与摄像头区域不匹配")
        if rule_code in {"G1", "G2"} and not (scene_data.get("roi") if scene_data else video["roi_json"]):
            raise HTTPException(400, "餐区摄像头必须配置逐桌 ROI")
        scene_key=f"{payload.video_id}:{rule_code}" if payload.scene_request and (scene_data or payload.explicit_rule) else None
        if scene_key:
            existing=database.fetch_one("SELECT * FROM analysis_runs WHERE scene_key=?",(scene_key,))
            if existing: return existing
        run_id = f"RUN-{uuid.uuid4().hex[:12].upper()}"
        configured = database.fetch_one(
            "SELECT value FROM system_settings WHERE key='default_analysis_mode'"
        )
        analysis_mode = payload.analysis_mode or (
            configured["value"] if configured else "two_stage"
        )
        if rule_code == "M1":
            analysis_mode = "two_stage"
        profile = database.fetch_one(
            "SELECT id, config_json FROM analysis_profiles WHERE id=? AND enabled=1", (analysis_mode,)
        )
        if not profile:
            raise HTTPException(400, "分析模式不可用")
        rule_snapshot, prompt_snapshot = build_run_snapshots(
            current_settings, rule_code, analysis_mode, profile["config_json"]
        )
        if rule_code == "M1":
            frozen = json.loads(rule_snapshot)
            frozen.update(cleaning_window_complete=payload.cleaning_window_complete, cleaning_window_closed=payload.cleaning_window_closed, opening_time_demo="09:10", cutoff_time="09:30", cleaning_video_start=payload.cleaning_video_start)
            frozen.pop("config_sha256", None)
            frozen["config_sha256"] = hashlib.sha256(json.dumps(frozen,ensure_ascii=False,sort_keys=True).encode()).hexdigest()
            rule_snapshot = database.json(frozen)
        database.execute(
            """
            INSERT OR IGNORE INTO analysis_runs
            (id, video_id, status, progress, stage, notifications_enabled,
             analysis_mode, rule_code, frame_rate, rule_config_snapshot_json,
             prompt_snapshot_json, created_at, scene_key, roi_snapshot_json)
            VALUES (?, ?, 'queued', 0, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                payload.video_id,
                int(payload.notifications_enabled),
                analysis_mode,
                rule_code,
                current_settings.frame_rate,
                rule_snapshot,
                prompt_snapshot,
                utc_now(),
                scene_key,
                database.json(scene_data.get("roi")) if scene_data else None,
            ),
        )
        return database.fetch_one("SELECT * FROM analysis_runs WHERE id=? OR (scene_key IS NOT NULL AND scene_key=?)", (run_id,scene_key)) or {}

    @app.post("/api/sop/tasks/{task_id}/analyze/{item_id}")
    def sop_analyze(task_id: str,item_id: str,payload: dict):
        task=database.fetch_one("SELECT * FROM sop_tasks WHERE id=?",(task_id,))
        if not task: raise HTTPException(404,"任务不存在")
        template=json.loads(task['snapshot_json'])
        item=next((i for i in template['items'] if str(i['id'])==item_id),None)
        rule=sop.CAPABILITIES.get(item.get('aiType')) if item and item.get('aiVerifiable') else None
        if not rule: raise HTTPException(422,"此项尚未接入自动核验，请人工核查")
        try:
            captured=datetime.fromisoformat(payload.get('captured_at',''))
            if not captured.tzinfo or not datetime.fromisoformat(task['scheduled_at'])<=captured<=datetime.fromisoformat(task['due_at']): raise ValueError()
        except (ValueError,TypeError): raise HTTPException(422,"拍摄时间需包含时区且位于本次任务时段")
        video=database.fetch_one("SELECT * FROM video_assets WHERE id=?",(payload.get('video_id'),))
        if not video or video['store_id']!=task['store_id']: raise HTTPException(422,"请选择本门店的已上传视频")
        if rule=='M1' and task['scheduled_at'][11:16]!='09:10': raise HTTPException(422,"当前拖地自动核验仅支持09:10–09:30开店窗口，其他时段请人工核查")
        existing=database.fetch_one("SELECT r.* FROM sop_run_links l JOIN analysis_runs r ON r.id=l.run_id WHERE l.task_id=? AND l.item_id=? AND r.video_id=? ORDER BY r.created_at DESC LIMIT 1",(task_id,item_id,video['id']))
        if existing: return existing
        run=create_run(RunCreate(video_id=video['id'],rule_code=rule,analysis_mode="two_stage",cleaning_video_start=captured.astimezone(ZoneInfo(database.fetch_one('SELECT timezone FROM stores WHERE id=?',(task['store_id'],))['timezone'])).strftime('%H:%M'),notifications_enabled=True))
        database.execute("INSERT OR IGNORE INTO sop_run_links VALUES (?,?,?,?,0)",(task_id,item_id,run['id'],captured.isoformat()))
        return run

    @app.get("/api/analysis-runs")
    def list_runs() -> list[dict[str, Any]]:
        runs = database.fetch_all(
            """
            SELECT ar.*, va.original_name, va.camera_id, va.duration_seconds,
                   (SELECT json_extract(ff.raw_response_json, '$.model')
                    FROM frame_findings ff WHERE ff.run_id=ar.id
                      AND json_extract(ff.raw_response_json, '$.model') IS NOT NULL
                    ORDER BY ff.created_at LIMIT 1) AS observed_model,
                   (SELECT COUNT(*) FROM inspection_events ie WHERE ie.run_id=ar.id) AS event_count
            FROM analysis_runs ar JOIN video_assets va ON va.id=ar.video_id
            ORDER BY ar.created_at DESC LIMIT 100
            """
        )
        for run in runs:
            run["estimated_fallback_tokens"] = int(run["total_frames"] or 0) * 1800
            run.update(estimate_analysis_cost(run))
            run.pop("observed_model", None)
            run.pop("rule_config_snapshot_json", None)
            run.pop("prompt_snapshot_json", None)
        return runs

    @app.get("/api/analysis-runs/{run_id}")
    def get_run(run_id: str) -> dict[str, Any]:
        run = database.fetch_one(
            """
            SELECT ar.*, va.original_name, va.camera_id, va.duration_seconds,
                   (SELECT json_extract(ff.raw_response_json, '$.model')
                    FROM frame_findings ff WHERE ff.run_id=ar.id
                      AND json_extract(ff.raw_response_json, '$.model') IS NOT NULL
                    ORDER BY ff.created_at LIMIT 1) AS observed_model
            FROM analysis_runs ar JOIN video_assets va ON va.id=ar.video_id
            WHERE ar.id=?
            """,
            (run_id,),
        )
        if not run:
            raise HTTPException(404, "分析任务不存在")
        run["usage_phases"] = []
        for phase in database.fetch_all("SELECT phase, model_id, COUNT(*) request_count, SUM(prompt_tokens) prompt_tokens, SUM(completion_tokens) completion_tokens FROM analysis_usage WHERE run_id=? GROUP BY phase,model_id ORDER BY MIN(created_at)",(run_id,)):
            phase.update(estimate_analysis_cost(phase))
            run["usage_phases"].append(phase)
        scene_job=database.fetch_one("SELECT result_json FROM scene_jobs WHERE video_id=? AND status='completed'",(run['video_id'],))
        if scene_job:
            run['scene_detection_usage']=json.loads(scene_job['result_json']).get('usage')
        run["cleaning_check"] = database.fetch_one("SELECT * FROM cleaning_checks WHERE run_id=?", (run_id,))
        run["estimated_fallback_tokens"] = int(run["total_frames"] or 0) * 1800
        run.update(estimate_analysis_cost(run))
        run.pop("observed_model", None)
        run["event_count"] = (database.fetch_one(
            "SELECT COUNT(*) AS count FROM inspection_events WHERE run_id=?", (run_id,)
        ) or {"count": 0})["count"]
        run["events"] = database.fetch_all(
            """SELECT id, title, severity, status, first_seen_offset, confirmed_offset
               FROM inspection_events WHERE run_id=? ORDER BY confirmed_offset, id""",
            (run_id,),
        )
        run["decisions"] = database.fetch_all(
            "SELECT * FROM analysis_decisions WHERE run_id=? "
            "ORDER BY CASE scope WHEN 'task' THEN 0 ELSE 1 END, candidate_index",
            (run_id,),
        )
        run['report'] = build_run_report(database, run)
        return run

    @app.post("/api/analysis-runs/{run_id}/cancel")
    def cancel_run(run_id: str) -> dict[str, Any]:
        with database.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute("SELECT status FROM analysis_runs WHERE id=?", (run_id,)).fetchone()
            if not row:
                raise HTTPException(404, "分析任务不存在")
            if row["status"] in {"completed", "failed"}:
                raise HTTPException(409, "任务已结束，不能取消")
            connection.execute("UPDATE analysis_runs SET status='cancelled', stage='cancelled', completed_at=?, error_code='USER_CANCELLED', error_message='用户取消分析；已产生的消耗及观察记录保留' WHERE id=?", (utc_now(), run_id))
        return get_run(run_id)

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
                "severity": "P0",
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
                   u.display_name AS assignee_name,
                   (SELECT ev.id FROM event_evidence ev WHERE ev.event_id=e.id
                    ORDER BY CASE ev.evidence_type WHEN 'peak' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END,
                             ev.captured_offset LIMIT 1) AS thumbnail_evidence_id,
                   CASE WHEN e.status NOT IN ('resolved','false_positive','ignored')
                             AND e.due_at IS NOT NULL AND e.due_at < ?
                        THEN 1 ELSE 0 END AS overdue
            FROM inspection_events e
            JOIN stores s ON s.id=e.store_id
            JOIN camera_sources c ON c.id=e.camera_id
            LEFT JOIN users u ON u.id=e.assignee_id
            ORDER BY e.created_at DESC LIMIT ?
            """,
            (utc_now(), limit),
        )

    @app.get("/api/events/{event_id}")
    def get_event(event_id: str) -> dict[str, Any]:
        event = database.fetch_one(
            """
            SELECT e.*, s.name AS store_name, c.name AS camera_name,
                   u.display_name AS assignee_name,
                   ar.analysis_mode, ar.fallback_approved, ar.prompt_tokens, ar.completion_tokens,
                   ar.request_count, va.duration_seconds AS video_duration_seconds,
                   va.original_name AS video_original_name
            FROM inspection_events e
            JOIN stores s ON s.id=e.store_id
            JOIN camera_sources c ON c.id=e.camera_id
            LEFT JOIN users u ON u.id=e.assignee_id
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

    def feishu_test_event(event_id: str) -> dict[str, Any]:
        event = database.fetch_one(
            """SELECT e.*, s.name AS store_name, c.name AS camera_name
               FROM inspection_events e JOIN stores s ON s.id=e.store_id
               JOIN camera_sources c ON c.id=e.camera_id WHERE e.id=?""",
            (event_id,),
        )
        if not event:
            raise HTTPException(404, "事件不存在")
        supported = (event["rule_code"] == "E1" and event["severity"] in {"P0", "P1"})
        supported = supported or (event["rule_code"] == "B1" and event["severity"] == "P0")
        supported = supported or (event["rule_code"] in {"A1", "G2", "M1"} and event["severity"] == "P2")
        if not supported:
            raise HTTPException(422, "仅支持 E1/P0、历史 E1/P1、B1/P0 或 A1/G2 的 P2 手动测试卡片")
        return event

    @app.get("/api/feishu/test-preview/{event_id}")
    def feishu_test_preview(event_id: str) -> dict[str, Any]:
        event = feishu_test_event(event_id)
        delivery = database.fetch_one(
            "SELECT id, status, attempts, error_message, last_attempt_at "
            "FROM notification_deliveries WHERE notification_key=?",
            (f"{event_id}:test:0",),
        )
        return {
            "event": event,
            "card": build_event_card(event, current_settings.public_base_url, test=True),
            "transport": "group_webhook" if current_settings.feishu_webhook_url else
                         "application_bot" if all((current_settings.feishu_app_id,
                                                    current_settings.feishu_app_secret,
                                                    current_settings.feishu_chat_id)) else "unconfigured",
            "local_detail_link": current_settings.public_base_url.startswith(
                ("http://127.0.0.1", "http://localhost")
            ),
            "delivery": delivery,
        }

    @app.post("/api/feishu/test-send")
    def feishu_test_send(payload: FeishuTestSend, request: Request) -> dict[str, Any]:
        # MVP has no login. Never expose an outbound message action beyond this
        # machine; also reject cross-origin browser requests to the local API.
        if request.client is None or request.client.host not in {"127.0.0.1", "::1"}:
            raise HTTPException(403, "测试发送仅允许本机操作")
        origin = request.headers.get("origin")
        if origin and origin not in {"http://127.0.0.1:5173", "http://localhost:5173"}:
            raise HTTPException(403, "来源页面不允许测试发送")
        if not current_settings.feishu_webhook_url and not all((
            current_settings.feishu_app_id, current_settings.feishu_app_secret,
            current_settings.feishu_chat_id,
        )):
            raise HTTPException(409, "飞书测试群机器人未配置或服务尚未重启")
        event = feishu_test_event(payload.event_id)
        prior = database.fetch_one(
            "SELECT id FROM notification_deliveries WHERE notification_key=?",
            (f"{payload.event_id}:test:0",),
        )
        delivery_id = FeishuNotifier(current_settings, database).notify_event(event, test=True)
        delivery = database.fetch_one(
            "SELECT id, status, attempts, error_message, last_attempt_at "
            "FROM notification_deliveries WHERE id=?", (delivery_id,),
        )
        return {"delivery": delivery, "duplicate": prior is not None}

    @app.get("/api/events/{event_id}/assignees")
    def list_event_assignees(event_id: str) -> list[dict[str, Any]]:
        event = database.fetch_one("SELECT store_id FROM inspection_events WHERE id=?", (event_id,))
        if not event:
            raise HTTPException(404, "事件不存在")
        return database.fetch_all(
            """SELECT id, display_name, role, store_id FROM users
               WHERE active=1 AND (store_id=? OR (store_id IS NULL AND role='system_admin'))
               ORDER BY store_id IS NULL, display_name""",
            (event["store_id"],),
        )

    @app.post("/api/events/{event_id}/actions")
    def apply_event_action(event_id: str, payload: EventAction) -> dict[str, Any]:
        event = database.fetch_one("SELECT * FROM inspection_events WHERE id=?", (event_id,))
        if not event:
            raise HTTPException(404, "事件不存在")
        if payload.action not in EVENT_TRANSITIONS:
            raise HTTPException(400, "不支持的事件动作")
        allowed = {
            "pending_confirmation": {"acknowledge", "assign", "mark_false_positive", "ignore"},
            "acknowledged": {"assign", "start_rectification", "mark_false_positive", "ignore"},
            "rectifying": {"assign", "resolve"},
        }
        if payload.action not in allowed.get(event["status"], set()):
            raise HTTPException(409, "当前状态不允许此操作")
        note = (payload.note or "").strip()
        if payload.action in {"assign", "resolve", "mark_false_positive"} and not note:
            raise HTTPException(400, "请填写处理说明")
        assignee_id = event["assignee_id"]
        if payload.action == "assign":
            assignee = database.fetch_one(
                """SELECT id FROM users WHERE id=? AND active=1
                   AND (store_id=? OR (store_id IS NULL AND role='system_admin'))""",
                (payload.assignee_id, event["store_id"]),
            )
            if not assignee:
                raise HTTPException(400, "请选择本门店可用的负责人")
            assignee_id = assignee["id"]
        if payload.action == "start_rectification" and not assignee_id:
            raise HTTPException(409, "请先指派整改负责人")
        next_status, label = EVENT_TRANSITIONS[payload.action]
        if payload.action == "assign" and event["status"] == "rectifying":
            next_status = "rectifying"
        now = utc_now()
        resolved_at = now if next_status == "resolved" else event["resolved_at"]
        acknowledged_at = (
            now if next_status in {"acknowledged", "rectifying", "resolved"}
            and not event["acknowledged_at"] else event["acknowledged_at"]
        )
        database.execute(
            """
            UPDATE inspection_events
            SET status=?, assignee_id=?, acknowledged_at=?, resolved_at=?, updated_at=?
            WHERE id=?
            """,
            (next_status, assignee_id, acknowledged_at, resolved_at, now, event_id),
        )
        database.execute(
            """
            INSERT INTO event_action_logs
            (id, event_id, actor_id, action, from_status, to_status, note, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                f"LOG-{uuid.uuid4().hex[:12].upper()}",
                event_id,
                payload.actor_id,
                payload.action,
                event["status"],
                next_status,
                note or label,
                json.dumps({"assignee_id": assignee_id}, ensure_ascii=False)
                if payload.action == "assign" else None,
                now,
            ),
        )
        return get_event(event_id)

    @app.get("/api/media/findings/{finding_id}")
    def finding_image(finding_id: str):
        row=database.fetch_one("SELECT image_path FROM frame_findings WHERE id=?",(finding_id,))
        if not row: raise HTTPException(404,"观察证据不存在")
        return FileResponse(row['image_path'])

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
            playback_path(video["storage_path"]),
            media_type="video/mp4",
            filename=video["original_name"],
            content_disposition_type="inline",
        )

    @app.get("/api/dashboard")
    def dashboard() -> dict[str, Any]:
        events = list_events(8)
        local_now = datetime.now(ZoneInfo("Asia/Shanghai"))
        local_start = datetime.combine(local_now.date(), time.min, tzinfo=ZoneInfo("Asia/Shanghai"))
        local_end = datetime.combine(local_now.date(), time.max, tzinfo=ZoneInfo("Asia/Shanghai"))
        today = database.fetch_one(
            "SELECT COUNT(*) AS count FROM inspection_events WHERE status NOT IN ('false_positive','ignored') AND julianday(created_at)>=julianday(?) AND julianday(created_at)<=julianday(?)",
            (local_start.astimezone(timezone.utc).isoformat(),
             local_end.astimezone(timezone.utc).isoformat()),
        )
        pending = database.fetch_one(
            "SELECT COUNT(*) AS count FROM inspection_events WHERE status NOT IN ('resolved','false_positive','ignored')"
        )
        online = database.fetch_one(
            "SELECT COUNT(*) AS count FROM camera_sources WHERE status='online'"
        )
        total = database.fetch_one("SELECT COUNT(*) AS count FROM camera_sources")
        completed_runs = database.fetch_one(
            "SELECT COUNT(*) AS count FROM analysis_runs WHERE status='completed'"
        )
        cameras = database.fetch_all(
            "SELECT id, name, area_type, source_type, status FROM camera_sources WHERE store_id='STORE-JTU' ORDER BY code"
        )
        return {
            "metrics": {
                "today_events": today["count"] if today else 0,
                "pending_events": pending["count"] if pending else 0,
                "online_cameras": online["count"] if online else 0,
                "total_cameras": total["count"] if total else 0,
                "completed_runs": completed_runs["count"] if completed_runs else 0,
            },
            "camera_sources": cameras,
            "recent_events": events,
        }

    from .image_checks import router as image_checks_router
    app.include_router(image_checks_router(current_settings))
    from .agent import router as agent_router
    app.include_router(agent_router(current_settings,database))
    return app


app = create_app()
