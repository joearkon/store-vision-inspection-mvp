from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path

from apps.api.app.analyzer import AnalysisRunner
from apps.api.app.config import Settings
from apps.api.app.db import Database, utc_now
from apps.api.app.vision import (
    VideoOpenSegment,
    VideoScreening,
    VisionObservation,
)


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


class TwoStageVisionProvider:
    def inspect_open_segments(
        self, video_path: Path, camera_name: str, fps: float
    ) -> VideoScreening:
        return VideoScreening(
            image_quality="usable",
            segments=[VideoOpenSegment(0, 4, 0.96, "门在整段测试视频内开启")],
            raw={"usage": {"prompt_tokens": 100, "completion_tokens": 10}},
        )

    def inspect_fridge_door(self, image_path: Path, camera_name: str) -> VisionObservation:
        return VisionObservation(
            image_quality="usable",
            state="open",
            confidence=0.95,
            evidence="局部复核为开启",
            bbox=[0.1, 0.1, 0.8, 0.8],
            raw={"usage": {"prompt_tokens": 20, "completion_tokens": 5}},
        )


class PPEVisionProvider:
    def __init__(self) -> None:
        self.calls = 0
        self.states = [
            "violation", "compliant", "violation", "violation",
            "compliant", "compliant", "compliant", "unknown",
        ]

    def inspect_ppe(self, image_path: Path, camera_name: str) -> VisionObservation:
        state = self.states[min(self.calls, len(self.states) - 1)]
        self.calls += 1
        return VisionObservation(
            image_quality="usable",
            state=state,
            confidence=.95 if state == "violation" else .85,
            evidence=f"PPE {state}",
            bbox=[.1, .1, .8, .9],
            raw={"usage": {"prompt_tokens": 10, "completion_tokens": 2}},
        )


class TwoStagePPEVisionProvider:
    def __init__(self) -> None:
        self.calls = 0

    def inspect_ppe_segments(
        self, video_path: Path, camera_name: str, fps: float
    ) -> VideoScreening:
        return VideoScreening(
            image_quality="usable",
            segments=[VideoOpenSegment(0, 4, .93, "员工疑似未佩戴口罩或手套")],
            raw={"usage": {"prompt_tokens": 80, "completion_tokens": 10}},
        )

    def inspect_ppe(self, image_path: Path, camera_name: str) -> VisionObservation:
        state = ["violation", "compliant", "violation", "compliant", "violation"][self.calls]
        self.calls += 1
        return VisionObservation(
            image_quality="usable",
            state=state,
            confidence=.96 if state == "violation" else .85,
            evidence=f"PPE {state}",
            bbox=[.1, .1, .8, .9],
            raw={"usage": {"prompt_tokens": 10, "completion_tokens": 2}},
        )


class FailingScreenProvider:
    def __init__(self) -> None:
        self.frame_calls = 0

    def inspect_open_segments(self, video_path: Path, camera_name: str, fps: float):
        raise RuntimeError("粗筛暂不可用")

    def inspect_fridge_door(self, image_path: Path, camera_name: str):
        self.frame_calls += 1
        raise AssertionError("没有人工确认时不得自动调用逐帧")

class AnalysisPipelineTests(unittest.TestCase):
    def test_two_stage_failure_pauses_without_automatic_frame_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            settings = Settings(
                project_root=root,
                data_dir=root / "data",
                database_path=root / "data" / "test.sqlite3",
                frame_rate=1,
            )
            settings.ensure_directories()
            database = Database(settings.database_path)
            database.initialize()
            video_path = settings.data_dir / "videos" / "pause.mp4"
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
                VALUES ('VID-PAUSE', 'STORE-JTU', 'CAM-STORAGE-01', 'pause.mp4', ?,
                        'upload', ?, 'pause-hash', ?)
                """,
                (str(video_path), video_path.stat().st_size, now),
            )
            database.execute(
                """
                INSERT INTO analysis_runs
                (id, video_id, status, progress, stage, notifications_enabled,
                 analysis_mode, rule_code, frame_rate, created_at)
                VALUES ('RUN-PAUSE', 'VID-PAUSE', 'queued', 0, 'queued', 0,
                        'two_stage', 'E1', 1, ?)
                """,
                (now,),
            )
            provider = FailingScreenProvider()
            AnalysisRunner(settings, database, provider).run("RUN-PAUSE")
            run = database.fetch_one("SELECT * FROM analysis_runs WHERE id='RUN-PAUSE'")
            self.assertEqual(run["status"], "awaiting_approval")
            self.assertEqual(run["stage"], "fallback_paused")
            self.assertEqual(run["error_code"], "FALLBACK_APPROVAL_REQUIRED")
            self.assertEqual(provider.frame_calls, 0)

    def test_two_stage_a1_screens_then_verifies_five_frames(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            settings = Settings(
                project_root=root,
                data_dir=root / "data",
                database_path=root / "data" / "test.sqlite3",
                frame_rate=1,
            )
            settings.ensure_directories()
            database = Database(settings.database_path)
            database.initialize()
            video_path = settings.data_dir / "videos" / "ppe-two.mp4"
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
                VALUES ('VID-PPE-TWO', 'STORE-JTU', 'CAM-FRONT-01', 'ppe-two.mp4', ?,
                        'upload', ?, 'ppe-two-hash', ?)
                """,
                (str(video_path), video_path.stat().st_size, now),
            )
            database.execute(
                """
                INSERT INTO analysis_runs
                (id, video_id, status, progress, stage, notifications_enabled,
                 analysis_mode, rule_code, frame_rate, created_at)
                VALUES ('RUN-PPE-TWO', 'VID-PPE-TWO', 'queued', 0, 'queued', 0,
                        'two_stage', 'A1', 1, ?)
                """,
                (now,),
            )

            AnalysisRunner(settings, database, TwoStagePPEVisionProvider()).run("RUN-PPE-TWO")

            run = database.fetch_one("SELECT * FROM analysis_runs WHERE id='RUN-PPE-TWO'")
            event = database.fetch_one("SELECT * FROM inspection_events WHERE run_id='RUN-PPE-TWO'")
            self.assertEqual(run["status"], "completed")
            self.assertEqual(run["request_count"], 6)
            self.assertEqual(run["prompt_tokens"], 130)
            self.assertEqual(event["rule_code"], "A1")
            self.assertEqual(event["confirmed_offset"], 4)

    def test_video_to_a1_ppe_event_uses_three_of_five(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            settings = Settings(
                project_root=root,
                data_dir=root / "data",
                database_path=root / "data" / "test.sqlite3",
                frame_rate=1,
            )
            settings.ensure_directories()
            database = Database(settings.database_path)
            database.initialize()
            video_path = settings.data_dir / "videos" / "ppe.mp4"
            subprocess.run(
                [
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-f", "lavfi", "-i", "color=c=gray:s=320x180:d=8:r=1",
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
                VALUES ('VID-PPE', 'STORE-JTU', 'CAM-FRONT-01', 'ppe.mp4', ?,
                        'upload', ?, 'ppe-hash', ?)
                """,
                (str(video_path), video_path.stat().st_size, now),
            )
            database.execute(
                """
                INSERT INTO analysis_runs
                (id, video_id, status, progress, stage, notifications_enabled,
                 analysis_mode, rule_code, frame_rate, created_at)
                VALUES ('RUN-PPE', 'VID-PPE', 'queued', 0, 'queued', 0,
                        'frame_baseline', 'A1', 1, ?)
                """,
                (now,),
            )

            AnalysisRunner(settings, database, PPEVisionProvider()).run("RUN-PPE")

            run = database.fetch_one("SELECT * FROM analysis_runs WHERE id='RUN-PPE'")
            event = database.fetch_one("SELECT * FROM inspection_events WHERE run_id='RUN-PPE'")
            self.assertEqual(run["status"], "completed")
            self.assertEqual(run["request_count"], 8)
            self.assertEqual(event["rule_code"], "A1")
            self.assertEqual(event["confirmed_offset"], 4)
            self.assertEqual(event["recovered_offset"], 6)

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
                 analysis_mode, rule_code, frame_rate, created_at)
                VALUES ('RUN-TEST', 'VID-TEST', 'queued', 0, 'queued', 0,
                        'frame_baseline', 'E1', 1, ?)
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
            self.assertEqual(event["last_seen_offset"], 4)
            self.assertEqual(event["recovered_offset"], 4)
            self.assertEqual(
                {item["evidence_type"] for item in evidence},
                {"start", "confirmed", "peak", "recovered"},
            )

    def test_two_stage_video_screening_refines_only_key_frames(self) -> None:
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
            video_path = settings.data_dir / "videos" / "two-stage.mp4"
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
                VALUES ('VID-TWO', 'STORE-JTU', 'CAM-STORAGE-01', 'two-stage.mp4', ?,
                        'upload', ?, 'two-stage-hash', ?)
                """,
                (str(video_path), video_path.stat().st_size, now),
            )
            database.execute(
                """
                INSERT INTO analysis_runs
                (id, video_id, status, progress, stage, notifications_enabled,
                 analysis_mode, frame_rate, created_at)
                VALUES ('RUN-TWO', 'VID-TWO', 'queued', 0, 'queued', 0,
                        'two_stage', 1, ?)
                """,
                (now,),
            )

            AnalysisRunner(settings, database, TwoStageVisionProvider()).run("RUN-TWO")

            run = database.fetch_one("SELECT * FROM analysis_runs WHERE id='RUN-TWO'")
            event = database.fetch_one("SELECT * FROM inspection_events WHERE run_id='RUN-TWO'")
            findings = database.fetch_all(
                "SELECT * FROM frame_findings WHERE run_id='RUN-TWO'"
            )
            self.assertEqual(run["status"], "completed")
            self.assertEqual(run["analysis_mode"], "two_stage")
            self.assertEqual(run["request_count"], 6)
            self.assertEqual(run["prompt_tokens"], 200)
            self.assertEqual(run["completion_tokens"], 35)
            self.assertEqual(len(findings), 5)
            self.assertEqual(event["confirmed_offset"], 3)


if __name__ == "__main__":
    unittest.main()
