"""Export a public, read-only snapshot of existing synthetic inspection results.

Run after the Vite showcase build. Only allowlisted JSON fields and event evidence
JPEGs are copied; original MP4s, raw model responses, paths, credentials, and the
SQLite database never enter the deployment directory.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from apps.api.app.main import app


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "apps" / "web" / "dist"
PUBLIC_IMAGE_CAMERAS = {'CAM-STORAGE-01','CAM-BACK-01','CAM-FRONT-01','CAM-DINING-01','CAM-PICKUP-01'}
PUBLISH_MONITORING_IMAGES = False


def pick(source: dict, *keys: str) -> dict:
    return {key: source.get(key) for key in keys if key in source}


def camera(source: dict) -> dict:
    return pick(source, "id", "store_id", "code", "name", "area_type", "source_type",
                "status", "created_at", "last_analysis_at")


def event_row(source: dict) -> dict:
    result = pick(source, "id", "run_id", "store_id", "camera_id", "rule_code", "title",
                "severity", "status", "first_seen_offset", "confirmed_offset",
                "last_seen_offset", "recovered_offset", "max_confidence", "due_at",
                "assignee_id", "assignee_name", "acknowledged_at", "resolved_at",
                "created_at", "updated_at", "store_name", "camera_name",
                "thumbnail_evidence_id", "overdue")
    if not PUBLISH_MONITORING_IMAGES and source.get('camera_id') not in PUBLIC_IMAGE_CAMERAS:
        result['thumbnail_evidence_id'] = None
    return result


def run_row(source: dict) -> dict:
    result = pick(source, "id", "video_id", "status", "progress", "stage",
                  "notifications_enabled", "analysis_mode", "rule_code", "frame_rate",
                  "total_frames", "processed_frames", "error_code", "prompt_tokens",
                  "completion_tokens", "request_count", "model_id", "started_at",
                  "completed_at", "created_at", "original_name", "camera_id",
                  "duration_seconds", "event_count", "estimated_fallback_tokens",
                  "cost_status", "cost_model_id", "estimated_cost_yuan", "cost_range_yuan",
                  "active_seconds", "fallback_approved", "usage_phases", "scene_detection_usage")
    if source.get('report'):
        result['report'] = {'explanation':source['report']['explanation'] + ' 公开站点仅展示结果文字，监控截图保留在本地。','frames':[],'observed_frame_count':source['report']['observed_frame_count'],'costs':source['report']['costs'],'images_withheld':True}
        if PUBLISH_MONITORING_IMAGES:
            result['report']['explanation'] = source['report']['explanation']
            result['report']['images_withheld'] = False
            result['report']['frames'] = [pick(f,'id','captured_offset','visual_state','confidence','evidence','image_quality') | {'image_url':f"/showcase/findings/{f['id']}.jpg"} for f in source['report']['frames']]
    if source.get("cleaning_check"):
        check = source["cleaning_check"]
        evidence = json.loads(check.get("evidence_json") or "[]") if PUBLISH_MONITORING_IMAGES else []
        result["cleaning_check"] = pick(check, "verdict", "explanation", "created_at") | {"evidence_json": json.dumps([
            pick(e, "finding_id", "offset", "state") | {"image_url": f"/showcase/findings/{e['finding_id']}.jpg"} for e in evidence
        ])}
    if source.get("status") == "failed":
        result["error_message"] = "历史分析失败；详细技术错误未在公开快照中提供。"
    try:
        screening = json.loads(source.get("screening_result_json") or "{}")
        segments = screening.get("segments") if isinstance(screening, dict) else None
        if isinstance(segments, list):
            result["screening_result_json"] = json.dumps({"segments": [{} for _ in segments]})
    except (TypeError, ValueError):
        pass
    if "events" in source:
        result["events"] = [pick(item, "id", "title", "severity", "status",
                                 "first_seen_offset", "confirmed_offset")
                            for item in source["events"]]
    return result


def event_detail(source: dict) -> dict:
    result = event_row(source)
    result.update(pick(source, "analysis_mode", "prompt_tokens", "completion_tokens",
                       "request_count", "video_duration_seconds", "video_original_name"))
    result["evidence"] = [pick(item, "id", "evidence_type", "captured_offset", "created_at")
                          for item in source.get("evidence", [])]
    if not PUBLISH_MONITORING_IMAGES and source.get('camera_id') not in PUBLIC_IMAGE_CAMERAS:
        result['evidence'] = []
    result["timeline"] = [pick(item, "id", "action", "from_status", "to_status",
                              "note", "created_at") for item in source.get("timeline", [])]
    # Delivery IDs, provider responses, internal error messages and external message
    # IDs are deliberately excluded from the public showcase.
    result["notifications"] = []
    return result


def get_json(client: TestClient, path: str):
    response = client.get(path)
    response.raise_for_status()
    return response.json()


def export(output: Path, include_monitoring_images: bool = False) -> dict:
    global PUBLISH_MONITORING_IMAGES
    PUBLISH_MONITORING_IMAGES = include_monitoring_images
    target = output.resolve()
    if target != DEFAULT_OUTPUT.resolve():
        raise ValueError("快照只允许导出到 apps/web/dist；请先运行 showcase 构建")
    if not (target / "index.html").is_file():
        raise ValueError("缺少 showcase 构建产物 apps/web/dist/index.html")
    showcase = target / "showcase"
    images = showcase / "evidence"
    images.mkdir(parents=True, exist_ok=True)

    with TestClient(app) as client:
        raw_bootstrap = get_json(client, "/api/bootstrap")
        raw_dashboard = get_json(client, "/api/dashboard")
        raw_events = get_json(client, "/api/events?limit=200")
        raw_runs = get_json(client, "/api/analysis-runs")
        rules = get_json(client, "/api/rules/config")
        if include_monitoring_images:
            PUBLIC_IMAGE_CAMERAS.update(c['id'] for c in raw_bootstrap['cameras'])

        sop_snapshot=get_json(client,"/api/sop")
        sop_snapshot.pop("videos",None)
        sop_snapshot["cameraImages"]={}
        snapshot = {
            "meta": {
                "captured_at": datetime.now(ZoneInfo("Asia/Shanghai")).isoformat(),
                "mode": "read_only_analysis_records_snapshot",
                "raw_videos_published": False,
            },
            "bootstrap": {
                "store": pick(raw_bootstrap["store"], "id", "code", "name", "timezone"),
                "cameras": [camera(item) for item in raw_bootstrap["cameras"]],
                "today_upload_bytes": raw_bootstrap.get("today_upload_bytes", 0),
                "current_user": {"display_name": "静态展示访客", "role": "viewer"},
            },
            "dashboard": {
                "metrics": raw_dashboard["metrics"],
                "camera_sources": [camera(item) for item in raw_dashboard["camera_sources"]],
                "recent_events": [event_row(item) for item in raw_dashboard["recent_events"]],
            },
            "events": [event_row(item) for item in raw_events],
            "runs": [run_row(item) for item in raw_runs],
            "event_details": {},
            "run_details": {},
            "camera_details": {},
            "rules_config": rules,
            "sop": sop_snapshot,
        }

        evidence_ids: set[str] = set()
        for item in raw_events:
            detail = get_json(client, f"/api/events/{item['id']}")
            snapshot["event_details"][item["id"]] = event_detail(detail)
            if item.get('camera_id') in PUBLIC_IMAGE_CAMERAS:
                evidence_ids.update(evidence["id"] for evidence in detail.get("evidence", []))
        for item in raw_runs:
            detail = get_json(client, f"/api/analysis-runs/{item['id']}")
            snapshot["run_details"][item["id"]] = run_row(detail)
        if include_monitoring_images:
            findings = showcase / 'findings'
            findings.mkdir(exist_ok=True)
            finding_ids = {f['id'] for d in snapshot['run_details'].values() for f in d.get('report',{}).get('frames',[])}
            sop_ids={f['id'] for r in sop_snapshot['records'] for f in r.get('evidenceFrames',[])}
            finding_ids.update(sop_ids)
            finding_ids.update(e['finding_id'] for d in snapshot['run_details'].values() for e in json.loads(d.get('cleaning_check',{}).get('evidence_json') or '[]'))
            sop_snapshot['cameraImages']={fid:f'/showcase/findings/{fid}.jpg' for fid in sop_ids}
            for cam in raw_bootstrap['cameras']:
                row = app.state.database.fetch_one('SELECT f.id FROM frame_findings f JOIN analysis_runs a ON a.id=f.run_id JOIN video_assets v ON v.id=a.video_id WHERE v.camera_id=? ORDER BY a.created_at DESC,f.captured_offset LIMIT 1',(cam['id'],))
                if row:
                    finding_ids.add(row['id'])
                    for public_cam in snapshot['bootstrap']['cameras'] + snapshot['dashboard']['camera_sources']:
                        if public_cam['id'] == cam['id']:
                            public_cam['preview_image_url'] = f"/showcase/findings/{row['id']}.jpg"
            for finding_id in finding_ids:
                response = client.get(f'/api/media/findings/{finding_id}')
                response.raise_for_status()
                (findings / f'{finding_id}.jpg').write_bytes(response.content)
            scenes = showcase / 'scenes'
            scenes.mkdir(exist_ok=True)
            for detail in snapshot['run_details'].values():
                if detail.get('scene_detection_usage') and not detail.get('report',{}).get('frames'):
                    response=client.get(f"/api/videos/{detail['video_id']}/scene/image")
                    if response.status_code == 200:
                        (scenes / f"{detail['video_id']}.jpg").write_bytes(response.content)
                        detail['scene_preview_url']=f"/showcase/scenes/{detail['video_id']}.jpg"
        for item in raw_bootstrap["cameras"]:
            snapshot["camera_details"][item["id"]] = {}
            for days in (1, 7, 30):
                detail = get_json(client, f"/api/cameras/{item['id']}/detail?days={days}")
                snapshot["camera_details"][item["id"]][str(days)] = {
                    "camera": camera(detail["camera"]),
                    "days": days,
                    "counts": detail["counts"],
                    "events": [event_row(row) for row in detail["events"]],
                }
                public_cam=next(c for c in snapshot['bootstrap']['cameras'] if c['id']==item['id'])
                if public_cam.get('preview_image_url'):
                    snapshot['camera_details'][item['id']][str(days)]['camera']['preview_image_url']=public_cam['preview_image_url']
                evidence_ids.update(row["thumbnail_evidence_id"] for row in detail["events"]
                                    if row.get("thumbnail_evidence_id") and row.get('camera_id') in PUBLIC_IMAGE_CAMERAS)
        evidence_ids.update(row["thumbnail_evidence_id"] for row in raw_events
                            if row.get("thumbnail_evidence_id") and row.get('camera_id') in PUBLIC_IMAGE_CAMERAS)

        exported_images = 0
        for evidence_id in sorted(evidence_ids):
            response = client.get(f"/api/media/evidence/{evidence_id}")
            if response.status_code != 200 or response.headers.get("content-type") != "image/jpeg":
                continue
            (images / f"{evidence_id}.jpg").write_bytes(response.content)
            exported_images += 1

    (showcase / "snapshot.json").write_text(
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (target / "_headers").write_text(
        "/*\n"
        "  X-Robots-Tag: noindex, nofollow\n"
        "  X-Frame-Options: DENY\n"
        "  Referrer-Policy: no-referrer\n"
        "/showcase/snapshot.json\n"
        "  Cache-Control: no-cache\n",
        encoding="utf-8",
    )
    return {"runs": len(raw_runs), "events": len(raw_events), "evidence_images": exported_images,
            "snapshot_bytes": (showcase / "snapshot.json").stat().st_size}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--include-monitoring-images', action='store_true')
    args = parser.parse_args()
    print(json.dumps(export(args.output, args.include_monitoring_images), ensure_ascii=False))
