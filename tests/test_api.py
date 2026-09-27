from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from apps.api.app.config import Settings
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

    def test_missing_event_returns_404(self) -> None:
        self.assertEqual(self.client.get("/api/events/missing").status_code, 404)


if __name__ == "__main__":
    unittest.main()
