from __future__ import annotations

import argparse
import time

from apps.api.app.analyzer import AnalysisRunner
from apps.api.app.config import Settings
from apps.api.app.db import Database


def claim_next(database: Database) -> str | None:
    with database.connect() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT id FROM analysis_runs WHERE status='queued' ORDER BY created_at LIMIT 1"
        ).fetchone()
        if not row:
            return None
        updated = connection.execute(
            "UPDATE analysis_runs SET status='claimed', stage='claimed' WHERE id=? AND status='queued'",
            (row["id"],),
        )
        return row["id"] if updated.rowcount == 1 else None


def main() -> None:
    parser = argparse.ArgumentParser(description="门店视觉巡检分析 Worker")
    parser.add_argument("--once", action="store_true", help="仅处理一个任务后退出")
    parser.add_argument("--poll-seconds", type=float, default=2.0)
    args = parser.parse_args()

    settings = Settings.from_env()
    settings.ensure_directories()
    database = Database(settings.database_path)
    database.initialize()
    runner = AnalysisRunner(settings, database)
    while True:
        run_id = claim_next(database)
        if run_id:
            try:
                runner.run(run_id)
            except Exception as exc:
                print(f"analysis failed run_id={run_id}: {exc}", flush=True)
            if args.once:
                return
        elif args.once:
            return
        else:
            time.sleep(args.poll_seconds)


if __name__ == "__main__":
    main()
