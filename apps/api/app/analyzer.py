from __future__ import annotations

import shutil
import uuid
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .config import Settings
from .db import Database, utc_now
from .media import extract_frames, probe_duration
from .notifier import FeishuNotifier
from .rules import A1PPEAggregator, E1EventCandidate, E1FridgeDoorAggregator, E1Observation
from .vision import DoubaoVisionProvider, VisionProvider


class AnalysisRunner:
    def __init__(
        self,
        settings: Settings,
        database: Database,
        provider: VisionProvider | None = None,
    ):
        self.settings = settings
        self.database = database
        self.provider = provider or DoubaoVisionProvider(settings)

    def run(self, run_id: str) -> None:
        run = self.database.fetch_one(
            """
            SELECT ar.*, va.storage_path, va.camera_id, va.store_id, cs.name AS camera_name
            FROM analysis_runs ar
            JOIN video_assets va ON va.id = ar.video_id
            JOIN camera_sources cs ON cs.id = va.camera_id
            WHERE ar.id = ?
            """,
            (run_id,),
        )
        if not run:
            raise ValueError(f"分析任务不存在: {run_id}")
        self.database.execute(
            "UPDATE analysis_runs SET status='running', stage='probing', started_at=? WHERE id=?",
            (utc_now(), run_id),
        )
        try:
            video_path = Path(run["storage_path"])
            duration = probe_duration(video_path)
            self.database.execute(
                "UPDATE video_assets SET duration_seconds=? WHERE id=?",
                (duration, run["video_id"]),
            )
            frame_dir = self.settings.data_dir / "frames" / run_id
            if frame_dir.exists():
                shutil.rmtree(frame_dir)
            self.database.execute(
                "UPDATE analysis_runs SET stage='extracting', progress=0.05 WHERE id=?",
                (run_id,),
            )
            frames = extract_frames(video_path, frame_dir, float(run["frame_rate"]))
            self.database.execute(
                "UPDATE analysis_runs SET total_frames=?, progress=0.1 WHERE id=?",
                (len(frames), run_id),
            )
            if run.get("rule_code", "E1") == "A1":
                if run.get("analysis_mode") == "two_stage":
                    candidates, raw_responses = self._analyze_a1_two_stage(
                        run, video_path, frames, duration
                    )
                else:
                    candidates, raw_responses = self._analyze_a1_baseline(run, frames)
                events = [self._store_a1_event(run, candidate) for candidate in candidates]
            else:
                if run.get("analysis_mode") == "two_stage":
                    candidates, raw_responses = self._analyze_two_stage(
                        run, video_path, frames, duration
                    )
                else:
                    candidates, raw_responses = self._analyze_baseline(run, frames)
                events = [self._store_e1_event(run, candidate) for candidate in candidates]

            self.database.execute(
                "UPDATE analysis_runs SET stage='aggregating', progress=0.9 WHERE id=?",
                (run_id,),
            )
            prompt_tokens = sum(item.get("usage", {}).get("prompt_tokens", 0) for item in raw_responses)
            completion_tokens = sum(item.get("usage", {}).get("completion_tokens", 0) for item in raw_responses)
            self.database.execute(
                """
                UPDATE analysis_runs
                SET status='completed', stage='completed', progress=1, completed_at=?,
                    prompt_tokens=?, completion_tokens=?, request_count=?
                WHERE id=?
                """,
                (utc_now(), prompt_tokens, completion_tokens, len(raw_responses), run_id),
            )
            if run["notifications_enabled"] and run.get("rule_code", "E1") == "E1":
                notifier = FeishuNotifier(self.settings, self.database)
                for event in events:
                    notifier.notify_e1(event)
        except Exception as exc:
            self.database.execute(
                """
                UPDATE analysis_runs
                SET status='failed', stage='failed', error_code='ANALYSIS_FAILED',
                    error_message=?, completed_at=?
                WHERE id=?
                """,
                (str(exc)[:1000], utc_now(), run_id),
            )
            raise

    def _store_finding(
        self, run: dict[str, Any], frame_path: Path, index: int, result: Any,
        rule_code: str = "E1",
    ) -> E1Observation:
        finding_id = f"FND-{uuid.uuid4().hex[:12].upper()}"
        offset = index / float(run["frame_rate"])
        self.database.execute(
            """
            INSERT OR REPLACE INTO frame_findings
            (id, run_id, frame_index, captured_offset, image_path, image_quality,
             rule_code, visual_state, confidence, evidence, bbox_json,
             raw_response_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                finding_id, run["id"], index, offset, str(frame_path), result.image_quality,
                rule_code,
                result.state, result.confidence, result.evidence,
                self.database.json(result.bbox), self.database.json(result.raw), utc_now(),
            ),
        )
        self._track_usage(run["id"], result.raw)
        return E1Observation(
            offset_seconds=offset,
            state=result.state,
            confidence=result.confidence,
            finding_id=finding_id,
            image_path=str(frame_path),
        )

    def _track_usage(self, run_id: str, raw: dict[str, Any]) -> None:
        usage = raw.get("usage", {})
        self.database.execute(
            """
            UPDATE analysis_runs
            SET request_count=request_count+1,
                prompt_tokens=prompt_tokens+?, completion_tokens=completion_tokens+?
            WHERE id=?
            """,
            (
                int(usage.get("prompt_tokens", 0) or 0),
                int(usage.get("completion_tokens", 0) or 0),
                run_id,
            ),
        )

    def _analyze_baseline(
        self, run: dict[str, Any], frames: list[Path]
    ) -> tuple[list[E1EventCandidate], list[dict[str, Any]]]:
        self.database.execute(
            "UPDATE analysis_runs SET stage='analyzing' WHERE id=?", (run["id"],)
        )
        observations: list[E1Observation] = []
        raws: list[dict[str, Any]] = []
        for index, frame_path in enumerate(frames):
            result = self.provider.inspect_fridge_door(frame_path, run["camera_name"])
            observations.append(self._store_finding(run, frame_path, index, result))
            raws.append(result.raw)
            progress = 0.1 + ((index + 1) / max(len(frames), 1)) * 0.75
            self.database.execute(
                "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                (index + 1, progress, run["id"]),
            )
        return E1FridgeDoorAggregator(
            threshold_seconds=self.settings.e1_open_seconds,
            max_gap_seconds=max(2.5, 2 / float(run["frame_rate"])),
        ).aggregate(observations), raws

    def _analyze_two_stage(
        self,
        run: dict[str, Any],
        video_path: Path,
        frames: list[Path],
        duration: float,
    ) -> tuple[list[E1EventCandidate], list[dict[str, Any]]]:
        raw_responses: list[dict[str, Any]] = []
        self.database.execute(
            "UPDATE analysis_runs SET stage='screening', progress=0.15 WHERE id=?",
            (run["id"],),
        )
        try:
            if video_path.stat().st_size > 25 * 1024 * 1024:
                raise RuntimeError("视频超过双层粗筛 25 MB 限制")
            screening = self.provider.inspect_open_segments(
                video_path, run["camera_name"], fps=0.2
            )
            self._track_usage(run["id"], screening.raw)
            self.database.execute(
                "UPDATE analysis_runs SET screening_result_json=?, request_count=1 WHERE id=?",
                (
                    self.database.json({
                        "image_quality": screening.image_quality,
                        "segments": [segment.__dict__ for segment in screening.segments],
                    }),
                    run["id"],
                ),
            )
            if screening.image_quality != "usable":
                raise RuntimeError("视频粗筛画面质量不足")
            raw_responses.append(screening.raw)
            candidates: list[E1EventCandidate] = []
            self.database.execute(
                "UPDATE analysis_runs SET stage='refining', progress=0.35 WHERE id=?",
                (run["id"],),
            )
            for segment in screening.segments:
                start = max(0.0, segment.start_seconds)
                end = min(max(0.0, duration - 1 / float(run["frame_rate"])), segment.end_seconds)
                if end - start < self.settings.e1_open_seconds:
                    continue
                confirm = start + self.settings.e1_open_seconds
                targets = {
                    int(math.floor(start)),
                    int(math.floor(start + self.settings.e1_open_seconds / 2)),
                    int(math.floor(confirm - 1)),
                    int(math.floor(confirm)),
                    int(math.ceil(confirm + 1)),
                    int(math.floor(end)),
                }
                recovery_index = int(math.ceil(end + 1))
                if recovery_index < len(frames):
                    targets.add(recovery_index)
                targets = {index for index in targets if 0 <= index < len(frames)}
                observations: dict[int, E1Observation] = {}
                for index in sorted(targets):
                    result = self.provider.inspect_fridge_door(
                        frames[index], run["camera_name"]
                    )
                    observations[index] = self._store_finding(run, frames[index], index, result)
                    raw_responses.append(result.raw)
                    self.database.execute(
                        "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                        (len(observations), min(0.85, 0.35 + len(observations) * 0.07), run["id"]),
                    )
                open_indices = [index for index in sorted(targets) if index <= int(math.floor(end))]
                if not open_indices or any(observations[index].state != "open" for index in open_indices):
                    raise RuntimeError("局部复核与粗筛结果矛盾")
                first = observations[min(open_indices)]
                confirmed_candidates = [
                    observations[index] for index in open_indices
                    if observations[index].offset_seconds >= confirm
                ]
                if not confirmed_candidates:
                    raise RuntimeError("局部复核缺少阈值确认帧")
                confirmed = confirmed_candidates[0]
                last_open = observations[max(open_indices)]
                peak = max((observations[index] for index in open_indices), key=lambda item: item.confidence)
                recovered = observations.get(recovery_index)
                if recovered and recovered.state != "closed":
                    recovered = None
                candidates.append(E1EventCandidate(first, confirmed, peak, last_open, recovered))
            return candidates, raw_responses
        except Exception as exc:
            self.database.execute(
                "UPDATE analysis_runs SET stage='fallback_analyzing', error_message=? WHERE id=?",
                (f"双层判定回退逐帧：{str(exc)[:400]}", run["id"]),
            )
            self.database.execute("DELETE FROM frame_findings WHERE run_id=?", (run["id"],))
            candidates, baseline_raws = self._analyze_baseline(run, frames)
            return candidates, raw_responses + baseline_raws

    def _analyze_a1_baseline(
        self, run: dict[str, Any], frames: list[Path]
    ) -> tuple[list[Any], list[dict[str, Any]]]:
        self.database.execute(
            "UPDATE analysis_runs SET stage='analyzing' WHERE id=?", (run["id"],)
        )
        observations: list[E1Observation] = []
        raws: list[dict[str, Any]] = []
        for index, frame_path in enumerate(frames):
            result = self.provider.inspect_ppe(frame_path, run["camera_name"])
            observations.append(self._store_finding(run, frame_path, index, result, "A1"))
            raws.append(result.raw)
            progress = 0.1 + ((index + 1) / max(len(frames), 1)) * 0.75
            self.database.execute(
                "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                (index + 1, progress, run["id"]),
            )
        return A1PPEAggregator(
            max_gap_seconds=max(2.5, 2 / float(run["frame_rate"])),
        ).aggregate(observations), raws

    def _analyze_a1_two_stage(
        self,
        run: dict[str, Any],
        video_path: Path,
        frames: list[Path],
        duration: float,
    ) -> tuple[list[Any], list[dict[str, Any]]]:
        raw_responses: list[dict[str, Any]] = []
        self.database.execute(
            "UPDATE analysis_runs SET stage='screening', progress=0.15 WHERE id=?",
            (run["id"],),
        )
        try:
            if video_path.stat().st_size > 25 * 1024 * 1024:
                raise RuntimeError("视频超过双层粗筛 25 MB 限制")
            screening = self.provider.inspect_ppe_segments(
                video_path, run["camera_name"], fps=0.2
            )
            self._track_usage(run["id"], screening.raw)
            raw_responses.append(screening.raw)
            self.database.execute(
                "UPDATE analysis_runs SET screening_result_json=?, request_count=1 WHERE id=?",
                (
                    self.database.json({
                        "image_quality": screening.image_quality,
                        "segments": [segment.__dict__ for segment in screening.segments],
                    }),
                    run["id"],
                ),
            )
            if screening.image_quality != "usable":
                raise RuntimeError("视频粗筛画面质量不足")
            if not screening.segments:
                return [], raw_responses

            candidates: list[Any] = []
            self.database.execute(
                "UPDATE analysis_runs SET stage='refining', progress=0.35 WHERE id=?",
                (run["id"],),
            )
            for segment in screening.segments:
                start = max(0.0, segment.start_seconds)
                end = min(max(0.0, duration - 1 / float(run["frame_rate"])), segment.end_seconds)
                span = max(0.0, end - start)
                targets = {
                    int(round(start + span * fraction))
                    for fraction in (0, 0.25, 0.5, 0.75, 1)
                }
                targets = {index for index in targets if 0 <= index < len(frames)}
                observations: list[E1Observation] = []
                for index in sorted(targets):
                    result = self.provider.inspect_ppe(frames[index], run["camera_name"])
                    observations.append(self._store_finding(run, frames[index], index, result, "A1"))
                    raw_responses.append(result.raw)
                    self.database.execute(
                        "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                        (len(raw_responses) - 1, min(0.85, 0.35 + len(raw_responses) * 0.07), run["id"]),
                    )
                segment_candidates = A1PPEAggregator(
                    max_gap_seconds=max(duration + 1, 3),
                ).aggregate(observations)
                if not segment_candidates:
                    raise RuntimeError("局部复核未达到口罩/手套 3/5 确认门槛")
                candidates.extend(segment_candidates)
            return candidates, raw_responses
        except Exception as exc:
            self.database.execute(
                "UPDATE analysis_runs SET stage='fallback_analyzing', error_message=? WHERE id=?",
                (f"双层判定回退逐帧：{str(exc)[:400]}", run["id"]),
            )
            self.database.execute("DELETE FROM frame_findings WHERE run_id=?", (run["id"],))
            candidates, baseline_raws = self._analyze_a1_baseline(run, frames)
            return candidates, raw_responses + baseline_raws

    def _store_a1_event(self, run: dict[str, Any], candidate: Any) -> dict[str, Any]:
        event_id = f"EVT-{datetime.now().strftime('%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        now = utc_now()
        due_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        recovered_offset = candidate.recovered.offset_seconds if candidate.recovered else None
        last_seen = recovered_offset if candidate.recovered else candidate.last_violation.offset_seconds
        self.database.execute(
            """
            INSERT INTO inspection_events
            (id, run_id, store_id, camera_id, rule_code, title, severity, status,
             first_seen_offset, confirmed_offset, last_seen_offset, recovered_offset,
             max_confidence, due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'A1', '员工未规范佩戴口罩或手套', 'P2',
                    'pending_confirmation', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id, run["id"], run["store_id"], run["camera_id"],
                candidate.first.offset_seconds, candidate.confirmed.offset_seconds,
                last_seen, recovered_offset, candidate.peak.confidence, due_at, now, now,
            ),
        )
        evidence = (("start", candidate.first), ("confirmed", candidate.confirmed), ("peak", candidate.peak))
        if candidate.recovered:
            evidence += (("recovered", candidate.recovered),)
        for evidence_type, observation in evidence:
            self.database.execute(
                """
                INSERT OR IGNORE INTO event_evidence
                (id, event_id, finding_id, evidence_type, image_path, captured_offset, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"EVD-{uuid.uuid4().hex[:12].upper()}", event_id,
                    observation.finding_id, evidence_type, observation.image_path,
                    observation.offset_seconds, now,
                ),
            )
        self.database.execute(
            """
            INSERT INTO event_action_logs
            (id, event_id, actor_id, action, from_status, to_status, note, created_at)
            VALUES (?, ?, NULL, 'system_confirmed', 'observing', 'pending_confirmation',
                    '最近5个有效观察中至少3次确认口罩或手套缺失', ?)
            """,
            (f"LOG-{uuid.uuid4().hex[:12].upper()}", event_id, now),
        )
        return self.database.fetch_one("SELECT * FROM inspection_events WHERE id=?", (event_id,)) or {}

    def _store_e1_event(self, run: dict[str, Any], candidate: Any) -> dict[str, Any]:
        event_id = f"EVT-{datetime.now().strftime('%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        now = utc_now()
        due_at = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
        max_confidence = max(
            candidate.first.confidence,
            candidate.confirmed.confidence,
            candidate.peak.confidence,
        )
        recovered_offset = candidate.recovered.offset_seconds if candidate.recovered else None
        last_seen = (
            candidate.recovered.offset_seconds
            if candidate.recovered
            else candidate.last_open.offset_seconds
        )
        self.database.execute(
            """
            INSERT INTO inspection_events
            (id, run_id, store_id, camera_id, rule_code, title, severity, status,
             first_seen_offset, confirmed_offset, last_seen_offset, recovered_offset,
             max_confidence, due_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'E1', '冰箱门持续开启', 'P1', 'pending_confirmation',
                    ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                run["id"],
                run["store_id"],
                run["camera_id"],
                candidate.first.offset_seconds,
                candidate.confirmed.offset_seconds,
                last_seen,
                recovered_offset,
                max_confidence,
                due_at,
                now,
                now,
            ),
        )
        evidence = (
            ("start", candidate.first),
            ("confirmed", candidate.confirmed),
            ("peak", candidate.peak),
        )
        for evidence_type, observation in evidence:
            self.database.execute(
                """
                INSERT OR IGNORE INTO event_evidence
                (id, event_id, finding_id, evidence_type, image_path, captured_offset, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    f"EVD-{uuid.uuid4().hex[:12].upper()}",
                    event_id,
                    observation.finding_id,
                    evidence_type,
                    observation.image_path,
                    observation.offset_seconds,
                    now,
                ),
            )
        if candidate.recovered:
            self.database.execute(
                """
                INSERT INTO event_evidence
                (id, event_id, finding_id, evidence_type, image_path, captured_offset, created_at)
                VALUES (?, ?, ?, 'recovered', ?, ?, ?)
                """,
                (
                    f"EVD-{uuid.uuid4().hex[:12].upper()}",
                    event_id,
                    candidate.recovered.finding_id,
                    candidate.recovered.image_path,
                    candidate.recovered.offset_seconds,
                    now,
                ),
            )
        self.database.execute(
            """
            INSERT INTO event_action_logs
            (id, event_id, actor_id, action, from_status, to_status, note, created_at)
            VALUES (?, ?, NULL, 'system_confirmed', 'observing', 'pending_confirmation', ?, ?)
            """,
            (
                f"LOG-{uuid.uuid4().hex[:12].upper()}",
                event_id,
                f"冰箱门连续开启 {candidate.confirmed.offset_seconds - candidate.first.offset_seconds:.0f} 秒",
                now,
            ),
        )
        return self.database.fetch_one("SELECT * FROM inspection_events WHERE id=?", (event_id,)) or {}
