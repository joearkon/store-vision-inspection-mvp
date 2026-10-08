from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Any
from urllib.parse import quote

import httpx

from .config import Settings
from .db import Database, utc_now


class FeishuNotifier:
    def __init__(self, settings: Settings, database: Database):
        self.settings = settings
        self.database = database

    def notify_event(self, event: dict[str, Any], *, test: bool = False,
                     retry_failed: bool = False) -> str | None:
        supported = event.get("rule_code") in {"E1","A1","A2","A3","A4","B1","C1","G1","G2","M1"} and event.get("severity") in {"P0","P1","P2"}
        if not supported:
            raise ValueError("未知巡检规则或严重等级")
        notification_key = f"{event['id']}:{'test' if test else 'confirmed'}:0"
        existing = self.database.fetch_one(
            "SELECT id, status, attempts FROM notification_deliveries WHERE notification_key = ?",
            (notification_key,),
        )
        if existing and not (test and retry_failed and existing["status"] == "failed"
                             and existing["attempts"] < 3):
            return existing["id"]
        delivery_id = existing["id"] if existing else f"NTF-{uuid.uuid4().hex[:12].upper()}"
        attempts = (existing["attempts"] if existing else 0) + 1
        now = utc_now()
        if existing:
            self.database.execute(
                "UPDATE notification_deliveries SET status='pending', error_message=NULL WHERE id=?",
                (delivery_id,),
            )
        else:
            self.database.execute(
                """
                INSERT INTO notification_deliveries
                (id, event_id, notification_key, channel, status, attempts, created_at)
                VALUES (?, ?, ?, 'feishu', 'pending', 0, ?)
                """,
                (delivery_id, event["id"], notification_key, now),
            )
        app_configured = all((self.settings.feishu_app_id, self.settings.feishu_app_secret,
                              self.settings.feishu_chat_id))
        app_partial = any((self.settings.feishu_app_id, self.settings.feishu_app_secret,
                           self.settings.feishu_chat_id))
        if not self.settings.feishu_webhook_url and not app_configured:
            self.database.execute(
                "UPDATE notification_deliveries SET status='skipped', error_message=? WHERE id=?",
                ("飞书应用配置不完整" if app_partial else "飞书发送方式未配置", delivery_id),
            )
            return delivery_id

        details = self.database.fetch_one(
            """SELECT s.name AS store_name, c.name AS camera_name
               FROM inspection_events e JOIN stores s ON s.id=e.store_id
               JOIN camera_sources c ON c.id=e.camera_id WHERE e.id=?""",
            (event["id"],),
        ) or {}
        card = build_event_card(event | details, self.settings.public_base_url, test=test)
        try:
            if self.settings.feishu_webhook_url:
                webhook_body: dict[str, Any] = {"msg_type": "interactive", "card": card}
                if self.settings.feishu_signing_secret:
                    timestamp = str(int(time.time()))
                    signing_key = f"{timestamp}\n{self.settings.feishu_signing_secret}".encode()
                    signature = hmac.new(signing_key, b"", hashlib.sha256).digest()
                    webhook_body.update({"timestamp": timestamp,
                                         "sign": base64.b64encode(signature).decode()})
                response = httpx.post(
                    self.settings.feishu_webhook_url, json=webhook_body, timeout=10,
                )
            else:
                token_response = httpx.post(
                    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
                    json={"app_id": self.settings.feishu_app_id,
                          "app_secret": self.settings.feishu_app_secret}, timeout=10,
                )
                token_response.raise_for_status()
                token_payload = token_response.json()
                if token_payload.get("code") != 0 or not token_payload.get("tenant_access_token"):
                    raise RuntimeError(f"飞书凭据校验失败，code={token_payload.get('code')}")
                response = httpx.post(
                    "https://open.feishu.cn/open-apis/im/v1/messages",
                    params={"receive_id_type": "chat_id"},
                    headers={"Authorization": f"Bearer {token_payload['tenant_access_token']}"},
                    json={"receive_id": self.settings.feishu_chat_id,
                          "msg_type": "interactive",
                          "content": json.dumps(card, ensure_ascii=False)}, timeout=10,
                )
            payload = response.json()
            result_code = payload.get("code", payload.get("StatusCode", 0))
            if response.status_code >= 400:
                raise RuntimeError(
                    f"飞书拒绝卡片，HTTP {response.status_code}, code={result_code}"
                )
            if result_code != 0:
                raise RuntimeError(f"飞书拒绝卡片，code={result_code}")
            self.database.execute(
                """
                UPDATE notification_deliveries
                SET status='sent', attempts=?, external_message_id=?, last_attempt_at=?
                WHERE id=?
                """,
                (attempts, str(payload.get("data", {}).get("message_id", "")), utc_now(), delivery_id),
            )
        except Exception as exc:
            # httpx errors may include a secret webhook URL; never persist it.
            error = str(exc) if isinstance(exc, RuntimeError) else type(exc).__name__
            self.database.execute(
                """
                UPDATE notification_deliveries
                SET status='failed', attempts=?, error_message=?, last_attempt_at=?
                WHERE id=?
                """,
                (attempts, error[:500], utc_now(), delivery_id),
            )
            # Notification delivery is independently retryable and must not turn a
            # successfully analyzed video into a failed analysis run.
        return delivery_id

    def notify_e1(self, event: dict[str, Any], *, test: bool = False,
                  retry_failed: bool = False) -> str | None:
        """Keep the worker's E1-only notification path separate from B1 manual tests."""
        if event.get("rule_code") != "E1":
            raise ValueError("自动通知目前仅支持 E1")
        return self.notify_event(event, test=test, retry_failed=retry_failed)


def build_event_card(event: dict[str, Any], public_base_url: str, *, test: bool = False) -> dict[str, Any]:
    """Build a link-only card; state-changing actions require a verified app callback."""
    detail_url = f"{public_base_url.rstrip('/')}/#/event/{quote(event['id'], safe='')}"
    duration = event["confirmed_offset"] - event["first_seen_offset"]
    prefix = "【测试通知·非现场告警】" if test else ""
    status = "已解决" if event.get("status") == "resolved" else "待人工核查"
    severity = event["severity"]
    is_b1 = event.get("rule_code") == "B1"
    finding = (
        f"**B1 · {event['title']}**\n"
        f"门店：{event.get('store_name', '—')} · 摄像头：{event.get('camera_name', '—')}\n"
        f"事件编号：{event['id']} · 当前状态：{status}\n"
        f"视频确认观察：{duration:.0f} 秒 · 需人工复核"
    ) if is_b1 else (
        f"**E1 · {event['title']}**\n"
        f"门店：{event.get('store_name', '—')} · 摄像头：{event.get('camera_name', '—')}\n"
        f"事件编号：{event['id']} · 当前状态：{status}\n"
        f"持续开启确认：{duration:.0f} 秒"
    )
    guidance = ("**处置建议**\n请人工核查现场及设备；本条来自视频实验分析，不能代替现场安全判断。"
                if is_b1 else "**整改建议**\n关闭冷藏柜门，并检查内部原料温度。")
    if event.get("rule_code") not in {"E1", "B1"}:
        finding = (
            f"**{event['rule_code']} · {event['title']}**\n"
            f"门店：{event.get('store_name', '—')} · 摄像头：{event.get('camera_name', '—')}\n"
            f"事件编号：{event['id']} · 当前状态：{status}\n"
            f"证据时间：{event['first_seen_offset']:.0f}–{event['confirmed_offset']:.0f} 秒 · 疑似线索，待人工核查"
        )
        guidance = ("**核查建议**\n请核对操作区员工口罩佩戴情况；手部遮挡不作为未戴手套的证据。"
                    if event['rule_code'] == 'A1' else
                    "**核查建议**\n顾客离席后桌面有疑似遗留物品，请核实是否需要清理；未认定为垃圾、未判定清洁超时。")
    if event.get("rule_code") == "M1":
        guidance = "**核查建议**\n09:10–09:30检查窗口内未观察到拖地，请核对录像完整性和清洁记录；这不是确定未清洁的处罚依据。"
    elif event.get("rule_code") in {"A2","A3","A4","C1"}:
        guidance = "**核查建议**\n请核对对应规则的视频证据及现场情况；本条为待核查线索，不作为直接处罚依据。"
    elif event.get("rule_code") == "G1":
        guidance = "**核查建议**\n请核对离席后桌面残留及清理等待时间，阈值与现场处理情况需人工复核。"
    return {
        "header": {
            "template": "red" if severity == "P0" else "blue" if severity == "P2" else "orange",
            "title": {"tag": "plain_text", "content": f"{prefix}门店视觉巡检告警 · {severity}"},
        },
        "elements": [
            {"tag": "markdown", "content": finding},
            {"tag": "markdown", "content": guidance
             + ("\n此卡片仅用于联调，不是现场实时告警。" if test else "")},
            {"tag": "action", "actions": [{
                "tag": "button", "text": {"tag": "plain_text", "content": "查看详情"},
                "type": "primary", "url": detail_url,
            }]},
        ],
    }


def build_e1_card(event: dict[str, Any], public_base_url: str, *, test: bool = False) -> dict[str, Any]:
    """Compatibility wrapper for the existing E1 card callers."""
    if event.get("rule_code") != "E1":
        raise ValueError("E1 卡片需要 E1 事件")
    return build_event_card(event, public_base_url, test=test)
