from __future__ import annotations

import uuid
from typing import Any

import httpx

from .config import Settings
from .db import Database, utc_now


class FeishuNotifier:
    def __init__(self, settings: Settings, database: Database):
        self.settings = settings
        self.database = database

    def notify_e1(self, event: dict[str, Any]) -> None:
        notification_key = f"{event['id']}:confirmed:0"
        existing = self.database.fetch_one(
            "SELECT id FROM notification_deliveries WHERE notification_key = ?",
            (notification_key,),
        )
        if existing:
            return
        delivery_id = f"NTF-{uuid.uuid4().hex[:12].upper()}"
        now = utc_now()
        self.database.execute(
            """
            INSERT INTO notification_deliveries
            (id, event_id, notification_key, channel, status, attempts, created_at)
            VALUES (?, ?, ?, 'feishu', 'pending', 0, ?)
            """,
            (delivery_id, event["id"], notification_key, now),
        )
        if not self.settings.feishu_webhook_url:
            self.database.execute(
                "UPDATE notification_deliveries SET status='skipped', error_message=? WHERE id=?",
                ("FEISHU_WEBHOOK_URL 未配置", delivery_id),
            )
            return

        detail_url = f"{self.settings.public_base_url}/events/{event['id']}"
        card = {
            "msg_type": "interactive",
            "card": {
                "header": {
                    "template": "orange",
                    "title": {"tag": "plain_text", "content": "门店视觉巡检告警 · P1"},
                },
                "elements": [
                    {
                        "tag": "markdown",
                        "content": (
                            f"**{event['title']}**\n"
                            f"事件编号：{event['id']}\n"
                            f"持续时间：{event['confirmed_offset'] - event['first_seen_offset']:.0f} 秒"
                        ),
                    },
                    {
                        "tag": "action",
                        "actions": [
                            {
                                "tag": "button",
                                "text": {"tag": "plain_text", "content": "查看详情"},
                                "type": "primary",
                                "url": detail_url,
                            }
                        ],
                    },
                ],
            },
        }
        try:
            response = httpx.post(self.settings.feishu_webhook_url, json=card, timeout=10)
            response.raise_for_status()
            payload = response.json()
            self.database.execute(
                """
                UPDATE notification_deliveries
                SET status='sent', attempts=1, external_message_id=?, last_attempt_at=?
                WHERE id=?
                """,
                (str(payload.get("data", {}).get("message_id", "")), utc_now(), delivery_id),
            )
        except Exception as exc:
            self.database.execute(
                """
                UPDATE notification_deliveries
                SET status='failed', attempts=1, error_message=?, last_attempt_at=?
                WHERE id=?
                """,
                (str(exc)[:500], utc_now(), delivery_id),
            )
            # Notification delivery is independently retryable and must not turn a
            # successfully analyzed video into a failed analysis run.
