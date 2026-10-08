from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from apps.api.app.config import Settings
from apps.api.app.db import Database, utc_now
from apps.api.app.decision_trace import build_run_snapshots, persist_run_decisions


class DecisionTraceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.database = Database(Path(self.temp.name) / "test.sqlite3")
        self.database.initialize()
        now = utc_now()
        self.database.execute(
            """INSERT INTO video_assets
            (id,store_id,camera_id,original_name,storage_path,source_kind,size_bytes,sha256,created_at)
            VALUES ('VID-TRACE','STORE-JTU','CAM-STORAGE-01','test.mp4','missing.mp4',
                    'synthetic',100,'hash',?)""", (now,),
        )

    def run_row(self, run_id: str, mode: str = "two_stage", rule: str = "E1",
                screening: dict | None = None) -> None:
        self.database.execute(
            """INSERT INTO analysis_runs
            (id,video_id,status,analysis_mode,rule_code,frame_rate,screening_result_json,created_at)
            VALUES (?,'VID-TRACE','completed',?,?,1,?,?)""",
            (run_id, mode, rule, json.dumps(screening) if screening is not None else None, utc_now()),
        )

    def finding(self, run_id: str, index: int, state: str, quality: str = "usable") -> None:
        self.database.execute(
            """INSERT INTO frame_findings
            (id,run_id,frame_index,captured_offset,image_path,image_quality,rule_code,
             visual_state,confidence,created_at)
            VALUES (?,?,?,?,?,?, 'E1',?,.9,?)""",
            (f"FND-{run_id}-{index}", run_id, index, float(index), "frame.jpg", quality, state, utc_now()),
        )

    def test_new_snapshot_freezes_rule_and_prompt_without_credentials(self) -> None:
        settings = Settings(frame_rate=1.0, e1_open_seconds=30, vision_api_key="never-store-this-secret")
        rule_json, prompt_json = build_run_snapshots(
            settings, "E1", "two_stage", '{"coarse_fps":0.2}'
        )
        rule, prompt = json.loads(rule_json), json.loads(prompt_json)
        self.assertEqual(rule["duration_threshold_seconds"], 30)
        self.assertEqual(rule["analysis_profile"]["coarse_fps"], 0.2)
        self.assertEqual(len(rule["config_sha256"]), 64)
        self.assertIn("inspect_open_segments", prompt["template_method_names"])
        self.assertTrue(prompt["version"].startswith("sha256:"))
        self.assertNotIn("never-store-this-secret", prompt_json)

    def test_zero_candidate_task_has_explicit_conclusion_without_legacy_backfill(self) -> None:
        self.run_row("RUN-EMPTY", screening={"image_quality": "usable", "segments": []})
        persist_run_decisions(self.database, "RUN-EMPTY")
        rows = self.database.fetch_all("SELECT * FROM analysis_decisions WHERE run_id='RUN-EMPTY'")
        self.assertEqual(len(rows), 1)
        self.assertEqual((rows[0]["scope"], rows[0]["outcome"], rows[0]["reason_code"]),
                         ("task", "no_event", "NO_CANDIDATE"))
        run = self.database.fetch_one("SELECT * FROM analysis_runs WHERE id='RUN-EMPTY'")
        self.assertIsNone(run["rule_config_snapshot_json"])
        self.assertIsNone(run["prompt_snapshot_json"])

    def test_short_observation_span_is_not_event_and_is_idempotent(self) -> None:
        self.run_row("RUN-SHORT", mode="frame_baseline")
        self.database.execute("UPDATE analysis_runs SET rule_config_snapshot_json=? WHERE id='RUN-SHORT'",
                              ('{"duration_threshold_seconds":30,"max_observation_gap_seconds":2.5}',))
        for index in (0, 1, 2):
            self.finding("RUN-SHORT", index, "open")
        persist_run_decisions(self.database, "RUN-SHORT")
        persist_run_decisions(self.database, "RUN-SHORT")
        rows = self.database.fetch_all(
            "SELECT * FROM analysis_decisions WHERE run_id='RUN-SHORT' ORDER BY scope DESC"
        )
        self.assertEqual(len(rows), 2)
        candidate = next(row for row in rows if row["scope"] == "candidate")
        self.assertEqual(candidate["reason_code"], "BELOW_DURATION_THRESHOLD")
        self.assertEqual(json.loads(candidate["evidence_finding_ids_json"]),
                         ["FND-RUN-SHORT-0", "FND-RUN-SHORT-1", "FND-RUN-SHORT-2"])

    def test_screened_candidate_with_only_unknown_evidence_is_not_normal(self) -> None:
        self.run_row("RUN-UNKNOWN", screening={"image_quality": "usable", "segments": [
            {"start_seconds": 0, "end_seconds": 40, "confidence": .8, "evidence": "疑似门开"}
        ]})
        self.finding("RUN-UNKNOWN", 1, "unknown", "insufficient")
        persist_run_decisions(self.database, "RUN-UNKNOWN")
        candidate = self.database.fetch_one(
            "SELECT * FROM analysis_decisions WHERE run_id='RUN-UNKNOWN' AND scope='candidate'"
        )
        self.assertEqual(candidate["reason_code"], "INSUFFICIENT_EVIDENCE")
        self.assertEqual(candidate["start_offset"], 0)
        self.assertEqual(candidate["end_offset"], 40)

    def test_paused_candidate_is_not_mislabeled_as_negative(self) -> None:
        self.run_row("RUN-PAUSED", screening={"image_quality": "usable", "segments": [
            {"start_seconds": 0, "end_seconds": 40}
        ]})
        self.database.execute(
            "UPDATE analysis_runs SET status='awaiting_approval', error_code='FALLBACK_APPROVAL_REQUIRED' "
            "WHERE id='RUN-PAUSED'"
        )
        persist_run_decisions(self.database, "RUN-PAUSED")
        candidate = self.database.fetch_one(
            "SELECT * FROM analysis_decisions WHERE run_id='RUN-PAUSED' AND scope='candidate'"
        )
        self.assertEqual(candidate["outcome"], "not_evaluated")
        self.assertEqual(candidate["reason_code"], "FALLBACK_APPROVAL_REQUIRED")

    def test_screened_candidate_without_refinement_is_not_called_insufficient(self) -> None:
        self.run_row("RUN-NO-FRAMES", screening={"image_quality": "usable", "segments": [
            {"start_seconds": 0, "end_seconds": 40}
        ]})
        persist_run_decisions(self.database, "RUN-NO-FRAMES")
        candidate = self.database.fetch_one(
            "SELECT * FROM analysis_decisions WHERE run_id='RUN-NO-FRAMES' AND scope='candidate'"
        )
        self.assertEqual(candidate["reason_code"], "NO_REFINEMENT_EVIDENCE")


if __name__ == "__main__":
    unittest.main()
