from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

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

    def test_health_and_bootstrap(self) -> None:
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
        payload = self.client.get("/api/bootstrap").json()
        self.assertEqual(payload["store"]["name"], "MOMOYO JTU")
        self.assertEqual(len(payload["cameras"]), 4)
        self.assertEqual(
            {camera["name"] for camera in payload["cameras"]},
            {"前台-01", "后厨-01", "仓储-01", "取餐-01"},
        )
        self.assertEqual(
            sum(camera["status"] == "online" for camera in payload["cameras"]),
            3,
        )

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
        self.assertEqual(len(result["recent_events"]), 8)

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

        ppe_run = self.client.post(
            "/api/analysis-runs",
            json={
                "video_id": video_id,
                "notifications_enabled": False,
                "analysis_mode": "two_stage",
                "rule_code": "A1",
            },
        )
        self.assertEqual(ppe_run.status_code, 201)
        self.assertEqual(ppe_run.json()["rule_code"], "A1")

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
        self.assertEqual(front_run.json()["notifications_enabled"], 0)
        back_video = self.client.post(
            "/api/videos?filename=back.mp4&camera_id=CAM-BACK-01",
            content=b"back", headers={"content-type": "video/mp4"},
        ).json()
        unsupported = self.client.post("/api/analysis-runs", json={"video_id": back_video["id"]})
        self.assertEqual(unsupported.status_code, 400)

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
