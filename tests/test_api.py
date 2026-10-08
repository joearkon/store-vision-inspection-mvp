from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from apps.api.app.config import Settings
from apps.api.app.db import utc_now
from apps.api.app.main import create_app


class ApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        settings = Settings(
            project_root=root,
            data_dir=root / "data",
            database_path=root / "data" / "test.sqlite3",
        )
        self.client_context = TestClient(create_app(settings))
        self.client = self.client_context.__enter__()

    def tearDown(self) -> None:
        self.client_context.__exit__(None, None, None)
        self.temp.cleanup()

    def test_cancel_analysis_preserves_usage_and_blocks_resume(self):
        video = self.client.post("/api/videos?filename=cancel.mp4&camera_id=CAM-STORAGE-01", content=b"video", headers={"content-type":"video/mp4"}).json()
        run = self.client.post("/api/analysis-runs", json={"video_id":video['id']}).json()
        db = self.client.app.state.database
        for status in ['queued','claimed','running','awaiting_approval']:
            db.execute("UPDATE analysis_runs SET status=?,prompt_tokens=123,progress=.77 WHERE id=?",(status,run['id']))
            result = self.client.post(f"/api/analysis-runs/{run['id']}/cancel")
            self.assertEqual(result.status_code,200)
            self.assertEqual(result.json()['status'],'cancelled')
            self.assertEqual(result.json()['prompt_tokens'],123)
            self.assertEqual(self.client.post(f"/api/analysis-runs/{run['id']}/approve-fallback").status_code,409)
        self.assertEqual(self.client.post(f"/api/analysis-runs/{run['id']}/cancel").status_code,200)
        for status in ['completed','failed']:
            db.execute("UPDATE analysis_runs SET status=? WHERE id=?",(status,run['id']))
            self.assertEqual(self.client.post(f"/api/analysis-runs/{run['id']}/cancel").status_code,409)
        self.assertEqual(self.client.post('/api/analysis-runs/absent/cancel').status_code,404)

    def test_cancelled_runner_cannot_call_provider(self):
        from apps.api.app.analyzer import CancellableProvider, AnalysisCancelled
        from unittest.mock import Mock
        provider = Mock()
        def cancelled():
            raise AnalysisCancelled()
        wrapped = CancellableProvider(provider,cancelled)
        with self.assertRaises(AnalysisCancelled):
            wrapped.inspect_fridge_door('frame','camera')
        provider.inspect_fridge_door.assert_not_called()

    def test_explicit_rule_skips_scene_but_preserves_enabled_rule_and_roi_checks(self):
        video = self.client.post("/api/videos?filename=selected.mp4&explicit_rules=true",content=b"video",headers={"content-type":"video/mp4"}).json()
        db=self.client.app.state.database
        self.assertIsNone(db.fetch_one("SELECT * FROM scene_jobs WHERE video_id=?",(video['id'],)))
        self.assertEqual(db.fetch_one("SELECT area_type FROM camera_sources WHERE id=?",(video['camera_id'],))['area_type'],'unknown')
        payload={'video_id':video['id'],'rule_code':'A1','explicit_rule':True,'scene_request':True}
        first=self.client.post('/api/analysis-runs',json=payload)
        self.assertEqual(first.status_code,201)
        self.assertEqual(first.json()['rule_code'],'A1')
        self.assertEqual(self.client.post('/api/analysis-runs',json=payload).json()['id'],first.json()['id'])
        self.assertEqual(self.client.post('/api/analysis-runs',json={**payload,'rule_code':'G2'}).status_code,400)
        db.execute("UPDATE store_rule_settings SET enabled=0 WHERE store_id='STORE-JTU' AND rule_code='A2'")
        self.assertEqual(self.client.post('/api/analysis-runs',json={**payload,'rule_code':'A2'}).status_code,422)

    def test_health_and_bootstrap(self) -> None:
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
        payload = self.client.get("/api/bootstrap").json()
        self.assertEqual(payload["store"]["name"], "MOMOYO JTU")
        self.assertEqual(len(payload["cameras"]), 5)
        self.assertTrue(all(camera["preview_image_url"] is None for camera in payload["cameras"]))
        self.assertEqual(
            {camera["name"] for camera in payload["cameras"]},
            {"前台-01", "后厨-01", "仓储-01", "取餐-01", "用餐区-01"},
        )
        self.assertEqual(
            sum(camera["status"] == "online" for camera in payload["cameras"]),
            4,
        )

    def test_camera_configuration_and_uploaded_bytes(self) -> None:
        created = self.client.post("/api/cameras", json={
            "name": "仓储-02", "code": "STORAGE-02", "area_type": "storage"
        })
        self.assertEqual(created.status_code, 201)
        camera_id = created.json()["id"]
        self.assertEqual(created.json()["status"], "offline")
        self.assertEqual(self.client.post("/api/cameras", json={
            "name": "重复", "code": "STORAGE-02", "area_type": "storage"
        }).status_code, 409)
        self.assertEqual(self.client.patch(f"/api/cameras/{camera_id}", json={"status": "online"}).status_code, 200)
        self.assertEqual(self.client.post(
            "/api/videos?filename=disabled.mp4&camera_id=CAM-PICKUP-01",
            content=b"video", headers={"content-type": "video/mp4"},
        ).status_code, 409)
        self.client.app.state.database.initialize()
        cameras = self.client.get("/api/bootstrap").json()["cameras"]
        self.assertEqual(next(item for item in cameras if item["id"] == camera_id)["status"], "online")
        self.assertEqual(self.client.patch("/api/cameras/missing", json={"status": "offline"}).status_code, 404)
        video = self.client.post(
            "/api/videos?filename=volume.mp4&camera_id=CAM-FRONT-01",
            content=b"video", headers={"content-type": "video/mp4"},
        )
        self.assertEqual(video.status_code, 201)
        self.assertEqual(self.client.get("/api/bootstrap").json()["today_upload_bytes"], 5)

    def test_camera_detail_filters_source_and_local_date(self) -> None:
        video = self.client.post(
            "/api/videos?filename=detail.mp4&camera_id=CAM-STORAGE-01",
            content=b"video", headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post("/api/analysis-runs", json={"video_id": video["id"]}).json()
        today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        samples = [
            ("TODAY", "CAM-STORAGE-01", "pending_confirmation", today),
            ("OLD", "CAM-STORAGE-01", "resolved", today - timedelta(days=2)),
            ("FALSE", "CAM-STORAGE-01", "false_positive", today),
            ("OTHER", "CAM-FRONT-01", "pending_confirmation", today),
        ]
        for suffix, camera_id, status, date in samples:
            created = datetime.combine(date, time(12, 0), ZoneInfo("Asia/Shanghai")).isoformat()
            self.client.app.state.database.execute(
                """INSERT INTO inspection_events
                   (id, run_id, store_id, camera_id, rule_code, title, severity, status,
                    first_seen_offset, confirmed_offset, last_seen_offset, max_confidence,
                    created_at, updated_at)
                   VALUES (?, ?, 'STORE-JTU', ?, 'E1', '冰箱门持续开启', 'P1',
                           ?, 0, 30, 40, .95, ?, ?)""",
                (f"EVT-DETAIL-{suffix}", run["id"], camera_id, status, created, created),
            )
        detail = self.client.get("/api/cameras/CAM-STORAGE-01/detail").json()
        self.assertEqual(detail["camera"]["name"], "仓储-01")
        self.assertEqual(detail["counts"], {"total": 1, "p0": 0, "p1": 1, "p2": 0})
        self.assertEqual({event["id"] for event in detail["events"]},
                         {"EVT-DETAIL-TODAY", "EVT-DETAIL-FALSE"})
        week = self.client.get("/api/cameras/CAM-STORAGE-01/detail?days=7").json()
        self.assertEqual(week["counts"]["total"], 2)
        self.assertEqual(len(week["events"]), 3)
        self.assertEqual(self.client.get("/api/cameras/CAM-STORAGE-01/detail?days=3").status_code, 422)
        self.assertEqual(self.client.get("/api/cameras/missing/detail").status_code, 404)

    def test_dashboard_counts_all_pending_and_only_today_events(self) -> None:
        video = self.client.post(
            "/api/videos?filename=counts.mp4&camera_id=CAM-STORAGE-01",
            content=b"video", headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post("/api/analysis-runs", json={"video_id": video["id"]}).json()
        for index in range(10):
            created = utc_now() if index == 9 else "2020-01-01T00:00:00+00:00"
            status = "resolved" if index == 9 else "pending_confirmation"
            self.client.app.state.database.execute(
                """INSERT INTO inspection_events
                   (id, run_id, store_id, camera_id, rule_code, title, severity, status,
                    first_seen_offset, confirmed_offset, last_seen_offset, max_confidence,
                    created_at, updated_at)
                   VALUES (?, ?, 'STORE-JTU', 'CAM-STORAGE-01', 'E1',
                           '冰箱门持续开启', 'P1', ?, 0, 30, 40, .95, ?, ?)""",
                (f"EVT-COUNT-{index}", run["id"], status, created, created),
            )
        result = self.client.get("/api/dashboard").json()
        self.assertEqual(result["metrics"]["today_events"], 1)
        self.assertEqual(result["metrics"]["pending_events"], 9)
        self.assertEqual(result["metrics"]["online_cameras"], 4)
        self.assertEqual(result["metrics"]["total_cameras"], 5)
        self.assertEqual(len(result["camera_sources"]), 5)
        self.assertEqual(len(result["recent_events"]), 8)
        listed = next(item for item in self.client.get("/api/analysis-runs").json() if item["id"] == run["id"])
        self.assertEqual(listed["event_count"], 10)
        self.assertIn("duration_seconds", listed)
        detail = self.client.get(f"/api/analysis-runs/{run['id']}").json()
        self.assertEqual(detail["event_count"], 10)
        self.assertEqual(len(detail["events"]), 10)

    def test_dashboard_today_uses_store_timezone_and_excludes_false_positives(self) -> None:
        video = self.client.post(
            "/api/videos?filename=timezone.mp4&camera_id=CAM-STORAGE-01",
            content=b"video", headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post("/api/analysis-runs", json={"video_id": video["id"]}).json()
        today = datetime.now(ZoneInfo("Asia/Shanghai")).date()
        samples = [
            ("TODAY", "pending_confirmation", datetime.combine(today, time(0, 30), ZoneInfo("Asia/Shanghai"))),
            ("YESTERDAY", "pending_confirmation", datetime.combine(today - timedelta(days=1), time(23, 30), ZoneInfo("Asia/Shanghai"))),
            ("REJECTED", "false_positive", datetime.combine(today, time(12, 0), ZoneInfo("Asia/Shanghai"))),
        ]
        for suffix, status, created in samples:
            self.client.app.state.database.execute(
                """INSERT INTO inspection_events
                   (id, run_id, store_id, camera_id, rule_code, title, severity, status,
                    first_seen_offset, confirmed_offset, last_seen_offset, max_confidence,
                    created_at, updated_at)
                   VALUES (?, ?, 'STORE-JTU', 'CAM-STORAGE-01', 'E1',
                           '冰箱门持续开启', 'P1', ?, 0, 30, 40, .95, ?, ?)""",
                (f"EVT-TZ-{suffix}", run["id"], status, created.isoformat(), created.isoformat()),
            )
        result = self.client.get("/api/dashboard").json()
        self.assertEqual(result["metrics"]["today_events"], 1)
        self.assertEqual(result["metrics"]["pending_events"], 2)

    def test_upload_rejects_non_mp4(self) -> None:
        response = self.client.post("/api/videos?filename=test.txt", content=b"test")
        self.assertEqual(response.status_code, 415)

    def test_upload_and_create_analysis_run(self) -> None:
        response = self.client.post(
            "/api/videos?filename=test.mp4&camera_id=CAM-STORAGE-01",
            content=b"not-a-real-video-but-valid-upload-contract",
            headers={"content-type": "video/mp4"},
        )
        self.assertEqual(response.status_code, 201)
        video_id = response.json()["id"]
        run = self.client.post(
            "/api/analysis-runs", json={"video_id": video_id, "notifications_enabled": False}
        )
        self.assertEqual(run.status_code, 201)
        self.assertEqual(run.json()["status"], "queued")
        self.assertEqual(run.json()["analysis_mode"], "two_stage")
        self.assertEqual(run.json()["rule_code"], "E1")
        self.assertEqual(json.loads(run.json()["rule_config_snapshot_json"])["duration_threshold_seconds"], 30)
        self.assertIn("inspect_open_segments", json.loads(run.json()["prompt_snapshot_json"])["template_method_names"])
        zero_event_detail = self.client.get(f"/api/analysis-runs/{run.json()['id']}").json()
        self.assertEqual(zero_event_detail["event_count"], 0)
        self.assertEqual(zero_event_detail["events"], [])
        self.assertEqual(zero_event_detail["decisions"], [])  # queued is not yet a zero-event conclusion
        self.assertEqual(zero_event_detail["cost_status"], "usage_unrecorded")
        self.client.app.state.database.execute(
            """UPDATE analysis_runs SET request_count=1, prompt_tokens=1000,
               completion_tokens=100, model_id='doubao-seed-2-1-lite-260915'
               WHERE id=?""", (run.json()["id"],),
        )
        priced_detail = self.client.get(f"/api/analysis-runs/{run.json()['id']}").json()
        self.assertEqual(priced_detail["estimated_cost_yuan"], 0.00107)
        priced_list = next(item for item in self.client.get("/api/analysis-runs").json()
                           if item["id"] == run.json()["id"])
        self.assertEqual(priced_list["estimated_cost_yuan"], 0.00107)

        ppe_run = self.client.post(
            "/api/analysis-runs",
            json={
                "video_id": video_id,
                "notifications_enabled": False,
                "analysis_mode": "two_stage",
                "rule_code": "A1",
            },
        )
        self.assertEqual(ppe_run.status_code, 400)

    def test_camera_area_selects_rule_when_user_does_not_choose_one(self) -> None:
        front_video = self.client.post(
            "/api/videos?filename=front.mp4&camera_id=CAM-FRONT-01",
            content=b"front", headers={"content-type": "video/mp4"},
        ).json()
        front_run = self.client.post(
            "/api/analysis-runs",
            json={"video_id": front_video["id"], "notifications_enabled": True},
        )
        self.assertEqual(front_run.status_code, 201)
        self.assertEqual(front_run.json()["rule_code"], "A1")
        self.assertEqual(front_run.json()["notifications_enabled"], 1)
        back_video = self.client.post(
            "/api/videos?filename=back.mp4&camera_id=CAM-BACK-01",
            content=b"back", headers={"content-type": "video/mp4"},
        ).json()
        back_run = self.client.post("/api/analysis-runs", json={
            "video_id": back_video["id"], "notifications_enabled": True,
        })
        self.assertEqual(back_run.status_code, 201)
        self.assertEqual(back_run.json()["rule_code"], "B1")
        self.assertEqual(back_run.json()["notifications_enabled"], 1)
        for rule_code, video_id in (("A2", front_video["id"]), ("C1", back_video["id"]),
                                    ("A3", back_video["id"]), ("A4", front_video["id"])):
            trial = self.client.post("/api/analysis-runs", json={
                "video_id": video_id, "rule_code": rule_code, "notifications_enabled": True,
            })
            self.assertEqual(trial.status_code, 201)
            self.assertEqual(trial.json()["rule_code"], rule_code)
            self.assertEqual(trial.json()["notifications_enabled"], 1)
        dining_video = self.client.post(
            "/api/videos?filename=dining.mp4&camera_id=CAM-DINING-01",
            content=b"dining", headers={"content-type": "video/mp4"},
        ).json()
        dining_run = self.client.post("/api/analysis-runs", json={
            "video_id": dining_video["id"], "notifications_enabled": True,
        })
        self.assertEqual(dining_run.status_code, 400)
        mismatched = self.client.post("/api/analysis-runs", json={
            "video_id": dining_video["id"], "rule_code": "B1",
        })
        self.assertEqual(mismatched.status_code, 400)

    def test_rectification_assignment_and_closure_are_audited(self) -> None:
        video = self.client.post(
            "/api/videos?filename=workflow.mp4&camera_id=CAM-STORAGE-01",
            content=b"video", headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post("/api/analysis-runs", json={"video_id": video["id"]}).json()
        now = utc_now()
        self.client.app.state.database.execute(
            """INSERT INTO inspection_events
               (id, run_id, store_id, camera_id, rule_code, title, severity, status,
                first_seen_offset, confirmed_offset, last_seen_offset, max_confidence,
                created_at, updated_at)
               VALUES ('EVT-WORKFLOW', ?, 'STORE-JTU', 'CAM-STORAGE-01', 'E1',
                       '冰箱门持续开启', 'P1', 'pending_confirmation', 0, 30, 40, .95, ?, ?)""",
            (run["id"], now, now),
        )
        assignees = self.client.get("/api/events/EVT-WORKFLOW/assignees")
        self.assertEqual(assignees.status_code, 200)
        self.assertEqual([item["id"] for item in assignees.json()], ["USER-ADMIN"])
        self.assertEqual(self.client.post(
            "/api/events/EVT-WORKFLOW/actions", json={"action": "start_rectification"}
        ).status_code, 409)
        self.assertEqual(self.client.post(
            "/api/events/EVT-WORKFLOW/actions",
            json={"action": "assign", "assignee_id": "USER-ADMIN", "note": " "},
        ).status_code, 400)
        assigned = self.client.post(
            "/api/events/EVT-WORKFLOW/actions",
            json={"action": "assign", "assignee_id": "USER-ADMIN", "note": "请检查并关闭冰箱门"},
        )
        self.assertEqual(assigned.status_code, 200)
        self.assertEqual(assigned.json()["status"], "acknowledged")
        self.assertEqual(assigned.json()["assignee_name"], "总部巡检管理员")
        started = self.client.post(
            "/api/events/EVT-WORKFLOW/actions", json={"action": "start_rectification"}
        )
        self.assertEqual(started.json()["status"], "rectifying")
        self.assertEqual(self.client.post(
            "/api/events/EVT-WORKFLOW/actions", json={"action": "resolve"}
        ).status_code, 400)
        resolved = self.client.post(
            "/api/events/EVT-WORKFLOW/actions",
            json={"action": "resolve", "note": "已现场检查并关闭冰箱门"},
        )
        self.assertEqual(resolved.json()["status"], "resolved")
        self.assertEqual([row["action"] for row in resolved.json()["timeline"]],
                         ["assign", "start_rectification", "resolve"])
        self.assertEqual(self.client.post(
            "/api/events/EVT-WORKFLOW/actions", json={"action": "assign", "assignee_id": "USER-ADMIN", "note": "再次指派"}
        ).status_code, 409)

    def test_rule_config_switch_changes_new_run_default(self) -> None:
        config = self.client.get("/api/rules/config")
        self.assertEqual(config.status_code, 200)
        self.assertEqual(config.json()["default_analysis_mode"], "two_stage")
        self.assertEqual(
            {profile["id"] for profile in config.json()["profiles"]},
            {"frame_baseline", "two_stage"},
        )

        updated = self.client.put(
            "/api/rules/config", json={"default_analysis_mode": "frame_baseline"}
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["default_analysis_mode"], "frame_baseline")

        video = self.client.post(
            "/api/videos?filename=compare.mp4&camera_id=CAM-STORAGE-01",
            content=b"video",
            headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post(
            "/api/analysis-runs",
            json={"video_id": video["id"], "notifications_enabled": False},
        )
        self.assertEqual(run.json()["analysis_mode"], "frame_baseline")

        explicit = self.client.post(
            "/api/analysis-runs",
            json={
                "video_id": video["id"],
                "notifications_enabled": False,
                "analysis_mode": "two_stage",
            },
        )
        self.assertEqual(explicit.json()["analysis_mode"], "two_stage")

    def test_fallback_requires_explicit_approval_before_requeue(self) -> None:
        video = self.client.post(
            "/api/videos?filename=fallback.mp4&camera_id=CAM-STORAGE-01",
            content=b"video",
            headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post(
            "/api/analysis-runs",
            json={"video_id": video["id"], "analysis_mode": "two_stage"},
        ).json()
        self.client.app.state.database.execute(
            """
            UPDATE analysis_runs
            SET status='awaiting_approval', stage='fallback_paused', total_frames=50,
                fallback_reason='粗筛画面质量不足'
            WHERE id=?
            """,
            (run["id"],),
        )
        paused = self.client.get(f"/api/analysis-runs/{run['id']}").json()
        self.assertEqual(paused["estimated_fallback_tokens"], 90000)

        approved = self.client.post(
            f"/api/analysis-runs/{run['id']}/approve-fallback"
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["status"], "queued")
        self.assertEqual(approved.json()["analysis_mode"], "two_stage")
        self.assertEqual(approved.json()["fallback_approved"], 1)

        duplicate = self.client.post(
            f"/api/analysis-runs/{run['id']}/approve-fallback"
        )
        self.assertEqual(duplicate.status_code, 409)

    def test_missing_event_returns_404(self) -> None:
        self.assertEqual(self.client.get("/api/events/missing").status_code, 404)

    def test_event_exposes_original_video_for_interactive_review(self) -> None:
        video = self.client.post(
            "/api/videos?filename=sentinel.mp4&camera_id=CAM-STORAGE-01",
            content=b"video-bytes",
            headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post(
            "/api/analysis-runs",
            json={"video_id": video["id"], "notifications_enabled": False},
        ).json()
        now = utc_now()
        self.client.app.state.database.execute(
            """
            INSERT INTO inspection_events
            (id, run_id, store_id, camera_id, rule_code, title, severity, status,
             first_seen_offset, confirmed_offset, last_seen_offset, recovered_offset,
             max_confidence, created_at, updated_at)
            VALUES ('EVT-VIDEO', ?, 'STORE-JTU', 'CAM-STORAGE-01', 'E1',
                    '冰箱门持续开启', 'P1', 'pending_confirmation', 0, 30, 49,
                    NULL, .98, ?, ?)
            """,
            (run["id"], now, now),
        )
        detail = self.client.get("/api/events/EVT-VIDEO")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["video_original_name"], "sentinel.mp4")
        video_response = self.client.get("/api/media/events/EVT-VIDEO/video")
        self.assertEqual(video_response.status_code, 200)
        self.assertEqual(video_response.headers["content-type"], "video/mp4")
        self.assertEqual(video_response.content, b"video-bytes")


if __name__ == "__main__":
    unittest.main()
