"""Versioned input context and auditable task/candidate decisions for new runs.

This module never infers missing data for historical runs. Frame observations are
evidence inputs; only a persisted inspection_event is a business event.
"""

from __future__ import annotations

import hashlib
import inspect
import json
import uuid
from typing import Any

from .config import Settings
from .db import Database, utc_now
from .vision import DoubaoVisionProvider


RULE_CONFIG_VERSION = "rule-aggregation-2026-10-04-draft-1"
PROMPT_METHODS = {
    "E1": ("inspect_fridge_door", "inspect_open_segments"),
    "A1": ("inspect_ppe", "inspect_ppe_segments"),
}
POSITIVE_STATES = {
    "E1": {"open"}, "A1": {"violation"},
    "A2": {"violation"}, "C1": {"violation"}, "A3": {"messy"},
    "A4": {"violation"}, "B1": {"smoke", "flame"},
    "G1": {"departed_residual"}, "G2": {"departed_residual"}, "M1": {"mopping"},
}
INSUFFICIENT_STATES = {"unknown", "uncertain", "not_visible"}


def build_run_snapshots(
    settings: Settings, rule_code: str, analysis_mode: str,
    profile_config_json: str | None,
) -> tuple[str, str]:
    """Freeze actual rule settings and the relevant in-code prompt templates."""
    rate = float(settings.frame_rate)
    threshold = {"E1": float(settings.e1_open_seconds), "A3": 60, "B1": 2, "G1": 120}.get(rule_code)
    if analysis_mode == "two_stage" and rule_code in {"E1", "B1", "G1"}:
        gap_seconds = None  # These branches validate screened intervals directly.
    elif analysis_mode == "two_stage" and rule_code == "A1":
        gap_seconds = None  # Derived from video duration during local refinement.
    elif analysis_mode == "two_stage" and rule_code == "A3":
        gap_seconds = 10 / rate + 1
    else:
        gap_seconds = max(2.5, 2 / rate)
    rule = {
        "version": RULE_CONFIG_VERSION,
        "rule_code": rule_code,
        "analysis_mode": analysis_mode,
        "frame_rate_fps": rate,
        "coarse_screening_fps": 0.2 if analysis_mode == "two_stage" else None,
        "duration_threshold_seconds": threshold,
        "valid_hit_states": sorted(POSITIVE_STATES.get(rule_code, set())),
        "max_observation_gap_seconds": gap_seconds,
        "max_gap_runtime_formula": "max(video_duration_seconds+1,3)" if analysis_mode == "two_stage" and rule_code == "A1" else None,
        "refinement_strategy": "screened_interval" if analysis_mode == "two_stage" and rule_code in {"E1", "B1", "G1"} else "frame_aggregation",
        "window_size": 5 if rule_code in {"A1", "A2", "C1", "A4"} else None,
        "required_hits": 3 if rule_code in {"A1", "A2", "C1", "A4"} else None,
        "min_confidence": 0.7 if rule_code in {"A3", "B1", "G1"} else None,
        "analysis_profile": json.loads(profile_config_json) if profile_config_json else None,
    }
    if rule_code == "G2":
        rule.update(required_prior_state="occupied", required_hits=3, min_confidence=.7, window_size=3, event_kind="suspected_departure_clue", cleaning_timeout=False)
    rule["config_sha256"] = hashlib.sha256(
        json.dumps(rule, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()
    methods = PROMPT_METHODS.get(rule_code, ("inspect_rule_frame", "inspect_rule_segments"))
    if analysis_mode != "two_stage":
        methods = methods[:1]
    templates = {name: inspect.getsource(getattr(DoubaoVisionProvider, name)) for name in methods}
    serialized = json.dumps(templates, ensure_ascii=False, sort_keys=True)
    prompt = {
        "source_kind": "in_code_template",
        "version": f"sha256:{hashlib.sha256(serialized.encode('utf-8')).hexdigest()}",
        "model_configured": settings.vision_model,
        "template_method_names": list(methods),
        "template_source": templates,
        "note": "代码内 Prompt 模板快照；摄像头名、图片和视频等运行时变量不包含在模板中。",
    }
    return Database.json(rule), Database.json(prompt)


def _screening_segments(run: dict[str, Any]) -> list[dict[str, Any]] | None:
    if not run.get("screening_result_json"):
        return None
    try:
        value = json.loads(run["screening_result_json"])
        return value.get("segments", []) if isinstance(value, dict) else None
    except (TypeError, ValueError):
        return None


def _reason_for_unconfirmed(rule_code: str, start: float, end: float,
                            evidence: list[dict[str, Any]], rule_snapshot: dict[str, Any]) -> str:
    threshold = rule_snapshot.get("duration_threshold_seconds")
    if threshold is not None and end - start < float(threshold):
        return "BELOW_DURATION_THRESHOLD"
    if not evidence:
        return "NO_REFINEMENT_EVIDENCE"
    if all(
        row["image_quality"] != "usable" or row["visual_state"] in INSUFFICIENT_STATES
        for row in evidence
    ):
        return "INSUFFICIENT_EVIDENCE"
    return "RULE_THRESHOLD_NOT_MET"


def persist_run_decisions(database: Database, run_id: str) -> None:
    """Save a task conclusion even when there are no candidates or no event."""
    run = database.fetch_one("SELECT * FROM analysis_runs WHERE id=?", (run_id,))
    if not run:
        raise ValueError(f"分析任务不存在: {run_id}")
    findings = database.fetch_all(
        "SELECT id, captured_offset, image_quality, visual_state FROM frame_findings "
        "WHERE run_id=? ORDER BY captured_offset, id", (run_id,),
    )
    events = database.fetch_all(
        "SELECT id, first_seen_offset, last_seen_offset FROM inspection_events "
        "WHERE run_id=? ORDER BY first_seen_offset, id", (run_id,),
    )
    try:
        rule_snapshot = json.loads(run.get("rule_config_snapshot_json") or "{}")
    except (TypeError, ValueError):
        rule_snapshot = {}
    segments = _screening_segments(run) if not run.get("fallback_approved") else None
    candidates: list[dict[str, Any]] = []
    if segments is not None:
        for segment in segments:
            start = float(segment["start_seconds"])
            end = float(segment["end_seconds"])
            evidence = [row for row in findings if start <= row["captured_offset"] <= end]
            event = next((item for item in events if item["first_seen_offset"] <= end
                          and item["last_seen_offset"] >= start), None)
            candidates.append({"source": "video_screening", "start": start, "end": end,
                               "evidence": evidence, "event_id": event["id"] if event else None,
                               "detail": {"screening_confidence": segment.get("confidence"),
                                          "screening_evidence": segment.get("evidence")}})
    else:
        # Baseline mode has no video-level coarse candidates. Preserve a positive
        # observation span without pretending that every positive frame is an event.
        positive = [row for row in findings if row["visual_state"] in POSITIVE_STATES.get(run["rule_code"], set())]
        for event in events:
            start, end = event["first_seen_offset"], event["last_seen_offset"]
            candidates.append({"source": "frame_aggregation", "start": start, "end": end,
                               "evidence": [row for row in findings if start <= row["captured_offset"] <= end],
                               "event_id": event["id"], "detail": {}})
        unmatched = [row for row in positive if not any(
            event["first_seen_offset"] <= row["captured_offset"] <= event["last_seen_offset"]
            for event in events
        )]
        if unmatched:
            max_gap = float(rule_snapshot.get("max_observation_gap_seconds") or 2.5)
            groups: list[list[dict[str, Any]]] = []
            for row in unmatched:
                if not groups or row["captured_offset"] - groups[-1][-1]["captured_offset"] > max_gap:
                    groups.append([])
                groups[-1].append(row)
            for group in groups:
                candidates.append({"source": "positive_frame_span", "start": group[0]["captured_offset"],
                                   "end": group[-1]["captured_offset"], "evidence": group,
                                   "event_id": None, "detail": {"note": "未成事件的正向观察区间；非粗筛候选"}})

    status = run["status"]
    if status == "completed":
        if events:
            task_outcome, task_reason = "event_created", "EVENT_CREATED"
        elif not candidates and findings and all(
            row["image_quality"] != "usable" or row["visual_state"] in INSUFFICIENT_STATES
            for row in findings
        ):
            task_outcome, task_reason = "insufficient_evidence", "INSUFFICIENT_EVIDENCE"
        elif candidates:
            task_outcome, task_reason = "no_event", "CANDIDATES_NOT_CONFIRMED"
        else:
            task_outcome, task_reason = "no_event", "NO_CANDIDATE"
    elif status == "awaiting_approval":
        task_outcome, task_reason = "paused", "FALLBACK_APPROVAL_REQUIRED"
    elif status == "failed":
        task_outcome, task_reason = "failed", run.get("error_code") or "ANALYSIS_FAILED"
    else:
        raise ValueError(f"任务尚未到达可判定状态: {status}")

    now = utc_now()
    records = [{"scope": "task", "index": 0, "source": "run", "start": None, "end": None,
                "outcome": task_outcome, "reason": task_reason, "evidence": [], "event_id": None,
                "detail": {"status": status, "candidate_count": len(candidates), "event_count": len(events),
                           "effective_mode": "frame_baseline" if run.get("fallback_approved") else run.get("analysis_mode"),
                           "error_code": run.get("error_code"), "error_message": run.get("error_message")}}]
    for index, candidate in enumerate(candidates):
        event_id = candidate["event_id"]
        if status != "completed":
            candidate_outcome, reason = "not_evaluated", task_reason
        else:
            candidate_outcome = "event_created" if event_id else "not_confirmed"
            reason = "EVENT_CREATED" if event_id else _reason_for_unconfirmed(
                run["rule_code"], candidate["start"], candidate["end"], candidate["evidence"], rule_snapshot
            )
        records.append({"scope": "candidate", "index": index, "source": candidate["source"],
                        "start": candidate["start"], "end": candidate["end"],
                        "outcome": candidate_outcome, "reason": reason,
                        "evidence": [row["id"] for row in candidate["evidence"]],
                        "event_id": event_id, "detail": candidate["detail"]})
    with database.connect() as connection:
        # The existing fallback flow reuses a run ID and replaces its frame rows.
        # This table represents its current attempt, not an invented prior history.
        connection.execute("DELETE FROM analysis_decisions WHERE run_id=? AND scope='candidate'", (run_id,))
        for record in records:
            connection.execute(
                """INSERT INTO analysis_decisions
                (id, run_id, scope, candidate_index, source, start_offset, end_offset,
                 outcome, reason_code, evidence_finding_ids_json, event_id, detail_json,
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id, scope, candidate_index) DO UPDATE SET
                  source=excluded.source, start_offset=excluded.start_offset,
                  end_offset=excluded.end_offset, outcome=excluded.outcome,
                  reason_code=excluded.reason_code,
                  evidence_finding_ids_json=excluded.evidence_finding_ids_json,
                  event_id=excluded.event_id, detail_json=excluded.detail_json,
                  updated_at=excluded.updated_at""",
                (f"DEC-{uuid.uuid4().hex[:12].upper()}", run_id, record["scope"], record["index"],
                 record["source"], record["start"], record["end"], record["outcome"], record["reason"],
                 Database.json(record["evidence"]), record["event_id"], Database.json(record["detail"]),
                 now, now),
            )
