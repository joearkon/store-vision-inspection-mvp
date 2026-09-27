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
        self.assertEqual(run.json()["analysis_mode"], "frame_baseline")
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

    def test_rule_config_switch_changes_new_run_default(self) -> None:
        config = self.client.get("/api/rules/config")
        self.assertEqual(config.status_code, 200)
        self.assertEqual(config.json()["default_analysis_mode"], "frame_baseline")
        self.assertEqual(
            {profile["id"] for profile in config.json()["profiles"]},
            {"frame_baseline", "two_stage"},
        )

        updated = self.client.put(
            "/api/rules/config", json={"default_analysis_mode": "two_stage"}
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["default_analysis_mode"], "two_stage")

        video = self.client.post(
            "/api/videos?filename=compare.mp4&camera_id=CAM-STORAGE-01",
            content=b"video",
            headers={"content-type": "video/mp4"},
        ).json()
        run = self.client.post(
            "/api/analysis-runs",
            json={"video_id": video["id"], "notifications_enabled": False},
        )
        self.assertEqual(run.json()["analysis_mode"], "two_stage")

        explicit = self.client.post(
            "/api/analysis-runs",
            json={
                "video_id": video["id"],
                "notifications_enabled": False,
                "analysis_mode": "frame_baseline",
            },
        )
        self.assertEqual(explicit.json()["analysis_mode"], "frame_baseline")

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
