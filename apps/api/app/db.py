from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


SCHEMA = """
CREATE TABLE IF NOT EXISTS scene_jobs (
 video_id TEXT PRIMARY KEY REFERENCES video_assets(id), status TEXT NOT NULL,
 result_json TEXT, error_message TEXT, created_at TEXT NOT NULL, completed_at TEXT
);
CREATE TABLE IF NOT EXISTS store_rule_settings (
 store_id TEXT NOT NULL REFERENCES stores(id), rule_code TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(store_id,rule_code)
);

CREATE TABLE IF NOT EXISTS cleaning_checks (
 run_id TEXT PRIMARY KEY REFERENCES analysis_runs(id), verdict TEXT NOT NULL,
 explanation TEXT NOT NULL, evidence_json TEXT NOT NULL, created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_usage (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES analysis_runs(id),
 phase TEXT NOT NULL, model_id TEXT, prompt_tokens INTEGER NOT NULL,
 completion_tokens INTEGER NOT NULL, created_at TEXT NOT NULL
);
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES regions(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  store_id TEXT REFERENCES stores(id),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS camera_sources (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  area_type TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'virtual',
  status TEXT NOT NULL DEFAULT 'online',
  roi_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(store_id, code)
);

CREATE TABLE IF NOT EXISTS video_assets (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  camera_id TEXT NOT NULL REFERENCES camera_sources(id),
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  duration_seconds REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES video_assets(id),
  status TEXT NOT NULL,
  progress REAL NOT NULL DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'queued',
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  analysis_mode TEXT NOT NULL DEFAULT 'two_stage',
  rule_code TEXT NOT NULL DEFAULT 'E1',
  fallback_approved INTEGER NOT NULL DEFAULT 0,
  fallback_approved_at TEXT,
  fallback_reason TEXT,
  frame_rate REAL NOT NULL DEFAULT 1,
  total_frames INTEGER NOT NULL DEFAULT 0,
  processed_frames INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  model_id TEXT,
  screening_result_json TEXT,
  rule_config_snapshot_json TEXT,
  prompt_snapshot_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  config_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analysis_runs_status
ON analysis_runs(status, created_at);

CREATE TABLE IF NOT EXISTS analysis_decisions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id),
  scope TEXT NOT NULL CHECK(scope IN ('task', 'candidate')),
  candidate_index INTEGER NOT NULL,
  source TEXT NOT NULL,
  start_offset REAL,
  end_offset REAL,
  outcome TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  evidence_finding_ids_json TEXT NOT NULL DEFAULT '[]',
  event_id TEXT REFERENCES inspection_events(id),
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(run_id, scope, candidate_index)
);

CREATE INDEX IF NOT EXISTS idx_analysis_decisions_run
ON analysis_decisions(run_id, scope, candidate_index);

CREATE TABLE IF NOT EXISTS frame_findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id),
  frame_index INTEGER NOT NULL,
  captured_offset REAL NOT NULL,
  image_path TEXT NOT NULL,
  image_quality TEXT NOT NULL,
  rule_code TEXT,
  visual_state TEXT NOT NULL,
  confidence REAL,
  evidence TEXT,
  bbox_json TEXT,
  raw_response_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, frame_index, rule_code)
);

CREATE TABLE IF NOT EXISTS inspection_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES analysis_runs(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  camera_id TEXT NOT NULL REFERENCES camera_sources(id),
  rule_code TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  first_seen_offset REAL NOT NULL,
  confirmed_offset REAL,
  last_seen_offset REAL NOT NULL,
  recovered_offset REAL,
  max_confidence REAL NOT NULL,
  due_at TEXT,
  assignee_id TEXT REFERENCES users(id),
  acknowledged_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_store_created
ON inspection_events(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_evidence (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES inspection_events(id),
  finding_id TEXT REFERENCES frame_findings(id),
  evidence_type TEXT NOT NULL,
  image_path TEXT NOT NULL,
  captured_offset REAL NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(event_id, evidence_type)
);

CREATE TABLE IF NOT EXISTS event_action_logs (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES inspection_events(id),
  actor_id TEXT,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  note TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES inspection_events(id),
  notification_key TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  external_message_id TEXT,
  error_message TEXT,
  last_attempt_at TEXT,
  created_at TEXT NOT NULL
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)
            self._migrate(connection)
        self.seed()
        from .sop import initialize as initialize_sop
        initialize_sop(self)
        for code in ('E1','A1','A2','C1','A3','A4','B1','G2','M1'):
            self.execute("INSERT OR IGNORE INTO store_rule_settings VALUES ('STORE-JTU',?,1)",(code,))

    @staticmethod
    def _migrate(connection: sqlite3.Connection) -> None:
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(analysis_runs)")}
        additions = {
            "active_seconds": "REAL",
            "roi_snapshot_json": "TEXT",
            "scene_key": "TEXT",
            "analysis_mode": "TEXT NOT NULL DEFAULT 'two_stage'",
            "rule_code": "TEXT NOT NULL DEFAULT 'E1'",
            "fallback_approved": "INTEGER NOT NULL DEFAULT 0",
            "fallback_approved_at": "TEXT",
            "fallback_reason": "TEXT",
            "prompt_tokens": "INTEGER NOT NULL DEFAULT 0",
            "completion_tokens": "INTEGER NOT NULL DEFAULT 0",
            "request_count": "INTEGER NOT NULL DEFAULT 0",
            "model_id": "TEXT",
            "screening_result_json": "TEXT",
            "rule_config_snapshot_json": "TEXT",
            "prompt_snapshot_json": "TEXT",
        }
        for name, definition in additions.items():
            if name not in columns:
                connection.execute(f"ALTER TABLE analysis_runs ADD COLUMN {name} {definition}")
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS analysis_scene_key ON analysis_runs(scene_key) WHERE scene_key IS NOT NULL")
        event_columns = {row["name"] for row in connection.execute("PRAGMA table_info(inspection_events)")}
        if "assignee_id" not in event_columns:
            connection.execute("ALTER TABLE inspection_events ADD COLUMN assignee_id TEXT REFERENCES users(id)")

    def seed(self) -> None:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO organizations VALUES (?, ?, ?)",
                ("ORG-MOMOYO", "MOMOYO", now),
            )
            connection.execute(
                "INSERT OR IGNORE INTO regions VALUES (?, ?, ?, ?)",
                ("REGION-JAKARTA", "ORG-MOMOYO", "Jakarta", now),
            )
            connection.execute(
                "INSERT OR IGNORE INTO stores VALUES (?, ?, ?, ?, ?, ?)",
                (
                    "STORE-JTU",
                    "REGION-JAKARTA",
                    "JTU",
                    "MOMOYO JTU",
                    "Asia/Jakarta",
                    now,
                ),
            )
            connection.execute(
                "INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "USER-ADMIN",
                    "ORG-MOMOYO",
                    "admin",
                    "总部巡检管理员",
                    "system_admin",
                    None,
                    1,
                    now,
                ),
            )
            cameras = (
                ("CAM-FRONT-01", "FRONT-01", "前台-01", "front_counter", "online"),
                ("CAM-BACK-01", "BACK-01", "后厨-01", "back_kitchen", "online"),
                ("CAM-STORAGE-01", "STORAGE-01", "仓储-01", "storage", "online"),
                ("CAM-PICKUP-01", "PICKUP-01", "取餐-01", "pickup_area", "offline"),
                ("CAM-DINING-01", "DINING-01", "用餐区-01", "dining_area", "online"),
            )
            for camera_id, code, name, area_type, status in cameras:
                # One-table synthetic-test camera only; production cameras need calibrated per-table ROIs.
                roi = self.json({"id": "TABLE-TEST-01", "name": "单桌测试区（整画面）", "bbox": [0, 0, 1, 1]}) if area_type == "dining_area" else None
                connection.execute(
                    """
                    INSERT INTO camera_sources
                    (id, store_id, code, name, area_type, source_type, status, roi_json, created_at)
                    VALUES (?, 'STORE-JTU', ?, ?, ?, 'virtual', ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      code=excluded.code,
                      name=excluded.name,
                      area_type=excluded.area_type
                    """,
                    (camera_id, code, name, area_type, status, roi, now),
                )
            profiles = (
                (
                    "frame_baseline",
                    "逐帧基线模式",
                    "按 1 fps 对全部帧逐张识别，准确性基线清晰，但成本与耗时较高。",
                    {"frame_rate": 1.0, "fallback": False},
                ),
                (
                    "two_stage",
                    "双层判定模式",
                    "视频低帧率粗筛疑似区间，再按所选规则复核关键时间点；需要逐帧时暂停并等待人工确认。",
                    {"coarse_fps": 0.2, "rule_specific_refinement": True, "fallback_requires_approval": True},
                ),
            )
            for profile_id, name, description, config in profiles:
                connection.execute(
                    """
                    INSERT INTO analysis_profiles
                    (id, name, description, config_json, enabled, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 1, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                      name=excluded.name,
                      description=excluded.description,
                      config_json=excluded.config_json,
                      enabled=excluded.enabled,
                      updated_at=excluded.updated_at
                    """,
                    (profile_id, name, description, self.json(config), now, now),
                )
            connection.execute(
                "INSERT OR IGNORE INTO system_settings VALUES ('default_analysis_mode', 'two_stage', ?)",
                (now,),
            )

    def fetch_one(self, sql: str, params: tuple[Any, ...] = ()) -> dict[str, Any] | None:
        with self.connect() as connection:
            row = connection.execute(sql, params).fetchone()
            return dict(row) if row else None

    def fetch_all(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.connect() as connection:
            return [dict(row) for row in connection.execute(sql, params).fetchall()]

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> None:
        with self.connect() as connection:
            connection.execute(sql, params)

    @staticmethod
    def json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
