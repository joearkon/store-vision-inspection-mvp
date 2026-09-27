from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from apps.api.app.analyzer import AnalysisRunner
from apps.api.app.config import Settings
from apps.api.app.db import Database, utc_now
from apps.api.app.vision import VisionObservation


class SequenceVisionProvider:
    def __init__(self) -> None:
        self.calls = 0

    def inspect_fridge_door(self, image_path: Path, camera_name: str) -> VisionObservation:
        state = "open" if self.calls < 4 else "closed"
        self.calls += 1
        return VisionObservation(
            image_quality="usable",
            state=state,
            confidence=0.94 if state == "open" else 0.97,
            evidence=f"测试序列观察：冰箱门{state}",
            bbox=[0.1, 0.1, 0.8, 0.8],
            raw={"provider": "test", "state": state},
        )


class AnalysisPipelineTests(unittest.TestCase):
    def test_video_to_e1_event_and_recovery(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            settings = Settings(
                project_root=root,
                data_dir=root / "data",
                database_path=root / "data" / "test.sqlite3",
                frame_rate=1,
                e1_open_seconds=3,
            )
            settings.ensure_directories()
            database = Database(settings.database_path)
            database.initialize()
            video_path = settings.data_dir / "videos" / "pipeline.mp4"
            subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "lavfi", "-i", "color=c=gray:s=320x180:d=5:r=1",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", str(video_path),
                ],
                check=True,
                capture_output=True,
            )
            now = utc_now()
            database.execute(
                """
                INSERT INTO video_assets
                (id, store_id, camera_id, original_name, storage_path, source_kind,
                 size_bytes, sha256, created_at)
                VALUES ('VID-TEST', 'STORE-JTU', 'CAM-STORAGE-01', 'pipeline.mp4', ?,
                        'upload', ?, 'test-hash', ?)
                """,
                (str(video_path), video_path.stat().st_size, now),
            )
            database.execute(
                """
                INSERT INTO analysis_runs
                (id, video_id, status, progress, stage, notifications_enabled,
                 frame_rate, created_at)
                VALUES ('RUN-TEST', 'VID-TEST', 'queued', 0, 'queued', 0, 1, ?)
                """,
                (now,),
            )

            AnalysisRunner(settings, database, SequenceVisionProvider()).run("RUN-TEST")

            run = database.fetch_one("SELECT * FROM analysis_runs WHERE id='RUN-TEST'")
            event = database.fetch_one("SELECT * FROM inspection_events WHERE run_id='RUN-TEST'")
            evidence = database.fetch_all(
                "SELECT evidence_type FROM event_evidence WHERE event_id=?",
                (event["id"],),
            )
            self.assertEqual(run["status"], "completed")
            self.assertEqual(run["processed_frames"], 5)
            self.assertEqual(event["confirmed_offset"], 3)
            self.assertEqual(event["recovered_offset"], 4)
            self.assertEqual(
                {item["evidence_type"] for item in evidence},
                {"start", "confirmed", "peak", "recovered"},
            )


if __name__ == "__main__":
    unittest.main()
