"""Send exactly one clearly labeled E1 test card from an existing local event.

Usage: python -m scripts.send_feishu_test EVT-... --send
No network request is made without --send. The event-specific test key is idempotent.
"""

from __future__ import annotations

import argparse
import json

from apps.api.app.config import Settings
from apps.api.app.db import Database
from apps.api.app.notifier import FeishuNotifier, build_e1_card


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("event_id")
    parser.add_argument("--send", action="store_true", help="send to configured test group")
    parser.add_argument("--retry-failed", action="store_true", help="retry a failed test delivery")
    args = parser.parse_args()
    settings = Settings.from_env()
    database = Database(settings.database_path)
    event = database.fetch_one("SELECT * FROM inspection_events WHERE id=?", (args.event_id,))
    if not event or event["rule_code"] != "E1" or event["severity"] != "P1":
        raise SystemExit("仅支持已存在的正式 E1/P1 事件")
    if args.send:
        if not settings.feishu_webhook_url and not all((settings.feishu_app_id,
                                                         settings.feishu_app_secret,
                                                         settings.feishu_chat_id)):
            raise SystemExit("请配置群机器人 Webhook，或完整的应用机器人 ID/Secret/Chat ID")
        delivery_id = FeishuNotifier(settings, database).notify_e1(
            event, test=True, retry_failed=args.retry_failed
        )
        delivery = database.fetch_one(
            "SELECT id, status, attempts, external_message_id, error_message "
            "FROM notification_deliveries WHERE id=?", (delivery_id,)
        )
        print(json.dumps(delivery, ensure_ascii=False))
    else:
        print(json.dumps({
            "dry_run": True, "event_id": event["id"],
            "card": build_e1_card(event, settings.public_base_url, test=True),
            "recipient_configured": bool(settings.feishu_webhook_url or settings.feishu_chat_id),
            "transport": "group_webhook" if settings.feishu_webhook_url else "application_bot",
            "public_link_is_local": "127.0.0.1" in settings.public_base_url
            or "localhost" in settings.public_base_url,
        }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
