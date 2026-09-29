from __future__ import annotations

import shutil
import uuid
import math
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .config import Settings
from .db import Database, utc_now
from .media import extract_frames, probe_duration
from .notifier import FeishuNotifier
from .rules import A1PPEAggregator, E1EventCandidate, E1FridgeDoorAggregator, E1Observation, TimedObservationAggregator
from .vision import DoubaoVisionProvider, VisionProvider


class FallbackApprovalRequired(RuntimeError):
    """Pause a two-stage run before any full-frame fallback can spend tokens."""


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
            SELECT ar.*, va.storage_path, va.camera_id, va.store_id,
                   cs.name AS camera_name, cs.roi_json
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
            approved_fallback = bool(run.get("fallback_approved"))
            if run.get("rule_code") in {"B1", "G1"}:
                roi = json.loads(run["roi_json"]) if run.get("roi_json") else None
                if run["rule_code"] == "G1" and not roi:
                    raise ValueError("G1 缺少逐桌 ROI，不允许分析")
                if run.get("analysis_mode") == "two_stage" and not approved_fallback:
                    candidates, raw_responses = self._analyze_experimental_two_stage(
                        run, video_path, frames, duration, roi
                    )
                else:
                    candidates, raw_responses = self._analyze_experimental_baseline(run, frames, roi)
                events = [self._store_experimental_event(run, candidate) for candidate in candidates]
            elif run.get("rule_code") in {"A2", "C1", "A3", "A4"}:
                if run.get("analysis_mode") == "two_stage" and not approved_fallback:
                    candidates, raw_responses = self._analyze_operation_two_stage(
                        run, video_path, frames, duration
                    )
                else:
                    candidates, raw_responses = self._analyze_operation_baseline(run, frames)
                events = [self._store_operation_event(run, candidate) for candidate in candidates]
            elif run.get("rule_code", "E1") == "A1":
                if run.get("analysis_mode") == "two_stage" and not approved_fallback:
                    candidates, raw_responses = self._analyze_a1_two_stage(
                        run, video_path, frames, duration
                    )
                else:
                    candidates, raw_responses = self._analyze_a1_baseline(run, frames)
                events = [self._store_a1_event(run, candidate) for candidate in candidates]
            else:
                if run.get("analysis_mode") == "two_stage" and not approved_fallback:
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
            self.database.execute(
                """
                UPDATE analysis_runs
                SET status='completed', stage='completed', progress=1, completed_at=?,
                    error_code=NULL, error_message=NULL
                WHERE id=?
                """,
                (utc_now(), run_id),
            )
            if run["notifications_enabled"] and run.get("rule_code", "E1") == "E1":
                notifier = FeishuNotifier(self.settings, self.database)
                for event in events:
                    notifier.notify_e1(event)
        except FallbackApprovalRequired as exc:
            reason = str(exc)[:1000]
            self.database.execute(
                """
                UPDATE analysis_runs
                SET status='awaiting_approval', stage='fallback_paused',
                    error_code='FALLBACK_APPROVAL_REQUIRED', error_message=?,
                    fallback_reason=?
                WHERE id=?
                """,
                (reason, reason, run_id),
            )
            return
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
                # The coarse segment may end before the actual closure. Bound tail
                # verification to three extra frames, including the video tail.
                recovery_targets = {
                    int(math.ceil(end + 1)), int(math.ceil(end + 3)), len(frames) - 1
                }
                targets.update(index for index in recovery_targets if index > end and index < len(frames))
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
                recovered = next(
                    (observations[index] for index in sorted(recovery_targets)
                     if index in observations and observations[index].state == "closed"),
                    None,
                )
                candidates.append(E1EventCandidate(first, confirmed, peak, last_open, recovered))
            return candidates, raw_responses
        except Exception as exc:
            raise FallbackApprovalRequired(
                f"双层判定无法继续：{str(exc)[:400]}"
            ) from exc

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

    def _operation_aggregate(self, rule_code: str, observations: list[E1Observation],
                             max_gap: float) -> list[Any]:
        if rule_code == "A3":
            return TimedObservationAggregator("messy", 60, max_gap).aggregate(observations)
        return A1PPEAggregator(max_gap_seconds=max_gap).aggregate(observations)

    def _analyze_operation_baseline(
        self, run: dict[str, Any], frames: list[Path]
    ) -> tuple[list[Any], list[dict[str, Any]]]:
        self.database.execute("UPDATE analysis_runs SET stage='analyzing' WHERE id=?", (run["id"],))
        observations: list[E1Observation] = []
        raws: list[dict[str, Any]] = []
        for index, frame in enumerate(frames):
            result = self.provider.inspect_rule_frame(run["rule_code"], frame, run["camera_name"], None)
            observations.append(self._store_finding(run, frame, index, result, run["rule_code"]))
            raws.append(result.raw)
            self.database.execute(
                "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                (index + 1, .1 + (index + 1) / max(len(frames), 1) * .75, run["id"]),
            )
        return self._operation_aggregate(run["rule_code"], observations, max(2.5, 2 / float(run["frame_rate"]))), raws

    def _analyze_operation_two_stage(
        self, run: dict[str, Any], video_path: Path, frames: list[Path], duration: float
    ) -> tuple[list[Any], list[dict[str, Any]]]:
        raws: list[dict[str, Any]] = []
        self.database.execute("UPDATE analysis_runs SET stage='screening', progress=.15 WHERE id=?", (run["id"],))
        try:
            if video_path.stat().st_size > 25 * 1024 * 1024:
                raise RuntimeError("视频超过双层粗筛 25 MB 限制")
            screening = self.provider.inspect_rule_segments(
                run["rule_code"], video_path, run["camera_name"], .2, None
            )
            self._track_usage(run["id"], screening.raw)
            raws.append(screening.raw)
            self.database.execute(
                "UPDATE analysis_runs SET screening_result_json=? WHERE id=?",
                (self.database.json({"image_quality": screening.image_quality,
                                     "segments": [segment.__dict__ for segment in screening.segments]}), run["id"]),
            )
            if screening.image_quality != "usable":
                raise RuntimeError("视频粗筛画面质量不足")
            self.database.execute("UPDATE analysis_runs SET stage='refining', progress=.35 WHERE id=?", (run["id"],))
            candidates: list[Any] = []
            for segment in screening.segments:
                start = max(0, int(math.ceil(segment.start_seconds)))
                end = min(len(frames) - 1, int(math.floor(segment.end_seconds)))
                if end < start:
                    continue
                if run["rule_code"] == "A3":
                    if end - start < 60:
                        continue
                    targets = list(range(start, end + 1, 10))
                    if targets[-1] != end:
                        targets.append(end)
                    max_gap = 10 / float(run["frame_rate"]) + 1
                else:
                    if end - start < 4:
                        continue
                    mid = (start + end) // 2
                    first = max(start, min(mid - 2, end - 4))
                    targets = list(range(first, first + 5))
                    max_gap = max(2.5, 2 / float(run["frame_rate"]))
                observations: list[E1Observation] = []
                for index in targets:
                    result = self.provider.inspect_rule_frame(
                        run["rule_code"], frames[index], run["camera_name"], None
                    )
                    observations.append(self._store_finding(run, frames[index], index, result, run["rule_code"]))
                    raws.append(result.raw)
                    self.database.execute(
                        "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                        (len(raws) - 1, min(.85, .35 + len(raws) * .04), run["id"]),
                    )
                candidates.extend(self._operation_aggregate(run["rule_code"], observations, max_gap))
            return candidates, raws
        except Exception as exc:
            raise FallbackApprovalRequired(f"双层判定无法继续：{str(exc)[:400]}") from exc

    def _store_operation_event(self, run: dict[str, Any], candidate: Any) -> dict[str, Any]:
        titles = {"A2": "疑似未戴工作帽/发网（待人工复核）", "C1": "疑似未穿围裙/工服（待人工复核）",
                  "A3": "疑似操作台明显脏乱（待人工复核）", "A4": "疑似地面积水/明显垃圾（待人工复核）"}
        event_id = f"EVT-{datetime.now().strftime('%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        now = utc_now()
        recovered = candidate.recovered.offset_seconds if candidate.recovered else None
        last = getattr(candidate, "last_violation", None) or getattr(candidate, "last_open")
        self.database.execute(
            """INSERT INTO inspection_events
            (id, run_id, store_id, camera_id, rule_code, title, severity, status,
             first_seen_offset, confirmed_offset, last_seen_offset, recovered_offset,
             max_confidence, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'P1', 'pending_confirmation', ?, ?, ?, ?, ?, ?, ?)""",
            (event_id, run["id"], run["store_id"], run["camera_id"], run["rule_code"], titles[run["rule_code"]],
             candidate.first.offset_seconds, candidate.confirmed.offset_seconds,
             recovered if recovered is not None else last.offset_seconds, recovered,
             candidate.peak.confidence, now, now),
        )
        evidence = [("start", candidate.first), ("confirmed", candidate.confirmed), ("peak", candidate.peak)]
        if candidate.recovered:
            evidence.append(("recovered", candidate.recovered))
        for kind, observation in evidence:
            self.database.execute(
                """INSERT OR IGNORE INTO event_evidence
                (id, event_id, finding_id, evidence_type, image_path, captured_offset, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (f"EVD-{uuid.uuid4().hex[:12].upper()}", event_id, observation.finding_id,
                 kind, observation.image_path, observation.offset_seconds, now),
            )
        self.database.execute(
            """INSERT INTO event_action_logs
            (id, event_id, actor_id, action, from_status, to_status, note, created_at)
            VALUES (?, ?, NULL, 'system_confirmed', 'observing', 'pending_confirmation', ?, ?)""",
            (f"LOG-{uuid.uuid4().hex[:12].upper()}", event_id,
             f"{run['rule_code']} 试运行：模型观察经后端聚合，需人工复核；不发送飞书告警", now),
        )
        return self.database.fetch_one("SELECT * FROM inspection_events WHERE id=?", (event_id,)) or {}

    def _experimental_aggregator(self, run: dict[str, Any], max_gap: float) -> TimedObservationAggregator:
        if run["rule_code"] == "B1":
            return TimedObservationAggregator({"smoke", "flame"}, 2, max_gap)
        return TimedObservationAggregator("departed_residual", 120, max_gap)

    def _analyze_experimental_baseline(
        self, run: dict[str, Any], frames: list[Path], roi: dict[str, Any] | None
    ) -> tuple[list[E1EventCandidate], list[dict[str, Any]]]:
        self.database.execute("UPDATE analysis_runs SET stage='analyzing' WHERE id=?", (run["id"],))
        observations: list[E1Observation] = []
        raws: list[dict[str, Any]] = []
        for index, frame_path in enumerate(frames):
            result = self.provider.inspect_rule_frame(run["rule_code"], frame_path, run["camera_name"], roi)
            observations.append(self._store_finding(run, frame_path, index, result, run["rule_code"]))
            raws.append(result.raw)
            self.database.execute(
                "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                (index + 1, 0.1 + (index + 1) / max(len(frames), 1) * 0.75, run["id"]),
            )
        return self._experimental_aggregator(run, max(2.5, 2 / float(run["frame_rate"]))).aggregate(observations), raws

    def _analyze_experimental_two_stage(
        self, run: dict[str, Any], video_path: Path, frames: list[Path],
        duration: float, roi: dict[str, Any] | None
    ) -> tuple[list[E1EventCandidate], list[dict[str, Any]]]:
        raws: list[dict[str, Any]] = []
        self.database.execute("UPDATE analysis_runs SET stage='screening', progress=.15 WHERE id=?", (run["id"],))
        try:
            if video_path.stat().st_size > 25 * 1024 * 1024:
                raise RuntimeError("视频超过双层粗筛 25 MB 限制")
            screening = self.provider.inspect_rule_segments(
                run["rule_code"], video_path, run["camera_name"], .2, roi
            )
            self._track_usage(run["id"], screening.raw)
            raws.append(screening.raw)
            self.database.execute(
                "UPDATE analysis_runs SET screening_result_json=? WHERE id=?",
                (self.database.json({
                    "image_quality": screening.image_quality,
                    "segments": [segment.__dict__ for segment in screening.segments],
                }), run["id"]),
            )
            if screening.image_quality != "usable":
                raise RuntimeError("视频粗筛画面质量不足")
            self.database.execute("UPDATE analysis_runs SET stage='refining', progress=.35 WHERE id=?", (run["id"],))
            threshold = 2 if run["rule_code"] == "B1" else 120
            candidates: list[E1EventCandidate] = []
            merged_segments: list[list[float]] = []
            for segment in sorted(screening.segments, key=lambda item: item.start_seconds):
                if merged_segments and segment.start_seconds <= merged_segments[-1][1] + 2:
                    merged_segments[-1][1] = max(merged_segments[-1][1], segment.end_seconds)
                else:
                    merged_segments.append([segment.start_seconds, segment.end_seconds])
            for segment_start, segment_end in merged_segments:
                start = max(0, int(math.ceil(segment_start)))
                end = min(len(frames) - 1, int(math.floor(segment_end)), int(duration))
                if end < start:
                    continue
                # Even short G1 clips receive visual observations, but never a
                # confirmed event before the same 120-second business threshold.
                targets = {start, end, start + (end - start) // 2}
                if end - start >= threshold:
                    targets.add(start + threshold)
                    targets.add(start + threshold // 2)
                observations: dict[int, E1Observation] = {}
                for index in sorted(targets):
                    result = self.provider.inspect_rule_frame(
                        run["rule_code"], frames[index], run["camera_name"], roi
                    )
                    observations[index] = self._store_finding(
                        run, frames[index], index, result, run["rule_code"]
                    )
                    raws.append(result.raw)
                    self.database.execute(
                        "UPDATE analysis_runs SET processed_frames=?, progress=? WHERE id=?",
                        (len(raws) - 1, min(.85, .35 + len(raws) * .04), run["id"]),
                    )
                if end - start < threshold:
                    continue
                valid_states = {"smoke", "flame"} if run["rule_code"] == "B1" else {"departed_residual"}
                if any(item.state not in valid_states or item.confidence < .7 for item in observations.values()):
                    continue
                ordered = [observations[index] for index in sorted(targets)]
                confirmed = observations[start + threshold]
                recovery: E1Observation | None = None
                for index in sorted({end + 1, min(len(frames) - 1, end + 3), len(frames) - 1}):
                    if index <= end or index >= len(frames):
                        continue
                    result = self.provider.inspect_rule_frame(
                        run["rule_code"], frames[index], run["camera_name"], roi
                    )
                    item = self._store_finding(run, frames[index], index, result, run["rule_code"])
                    raws.append(result.raw)
                    if item.state in ({"steam", "clear"} if run["rule_code"] == "B1" else {"occupied", "clean", "cleaning"}):
                        recovery = item
                        break
                candidates.append(E1EventCandidate(
                    first=observations[start], confirmed=confirmed,
                    peak=max(ordered, key=lambda item: item.confidence),
                    last_open=observations[end], recovered=recovery,
                ))
            return candidates, raws
        except Exception as exc:
            raise FallbackApprovalRequired(f"双层判定无法继续：{str(exc)[:400]}") from exc

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
            raise FallbackApprovalRequired(
                f"双层判定无法继续：{str(exc)[:400]}"
            ) from exc

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

    def _store_experimental_event(
        self, run: dict[str, Any], candidate: E1EventCandidate
    ) -> dict[str, Any]:
        rule_code = run["rule_code"]
        title = "疑似异常烟雾或明火（实验待复核）" if rule_code == "B1" else "餐桌离席后残留未清理（实验待复核）"
        event_id = f"EVT-{datetime.now().strftime('%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        now = utc_now()
        recovered_offset = candidate.recovered.offset_seconds if candidate.recovered else None
        last_seen = recovered_offset if recovered_offset is not None else candidate.last_open.offset_seconds
        self.database.execute(
            """
            INSERT INTO inspection_events
            (id, run_id, store_id, camera_id, rule_code, title, severity, status,
             first_seen_offset, confirmed_offset, last_seen_offset, recovered_offset,
             max_confidence, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'P2', 'pending_confirmation', ?, ?, ?, ?, ?, ?, ?)
            """,
            (event_id, run["id"], run["store_id"], run["camera_id"], rule_code,
             title, candidate.first.offset_seconds, candidate.confirmed.offset_seconds,
             last_seen, recovered_offset, candidate.peak.confidence, now, now),
        )
        evidence = [("start", candidate.first), ("confirmed", candidate.confirmed), ("peak", candidate.peak)]
        if candidate.recovered:
            evidence.append(("recovered", candidate.recovered))
        for evidence_type, observation in evidence:
            self.database.execute(
                """
                INSERT OR IGNORE INTO event_evidence
                (id, event_id, finding_id, evidence_type, image_path, captured_offset, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (f"EVD-{uuid.uuid4().hex[:12].upper()}", event_id, observation.finding_id,
                 evidence_type, observation.image_path, observation.offset_seconds, now),
            )
        self.database.execute(
            """
            INSERT INTO event_action_logs
            (id, event_id, actor_id, action, from_status, to_status, note, created_at)
            VALUES (?, ?, NULL, 'system_confirmed', 'observing', 'pending_confirmation', ?, ?)
            """,
            (f"LOG-{uuid.uuid4().hex[:12].upper()}", event_id,
             f"{rule_code} 实验观察：仅入 Dashboard 等待人工复核；不发送真实飞书告警", now),
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
