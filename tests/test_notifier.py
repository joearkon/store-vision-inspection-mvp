from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from apps.api.app.config import Settings
from apps.api.app.notifier import FeishuNotifier, build_e1_card, build_event_card


EVENT = {
    "id": "EVT-TEST-1", "rule_code": "E1", "severity": "P1",
    "title": "冰箱门持续开启", "status": "resolved",
    "first_seen_offset": 0, "confirmed_offset": 30,
}


class MemoryDatabase:
    def __init__(self) -> None:
        self.delivery = None

    def fetch_one(self, query, params=()):
        if "notification_deliveries" in query:
            return self.delivery
        return {"store_name": "MOMOYO JTU", "camera_name": "仓储-01"}

    def execute(self, query, params=()):
        if "INSERT INTO notification_deliveries" in query:
            self.delivery = {"id": params[0], "status": "pending", "key": params[2],
                             "attempts": 0}
        elif "status='sent'" in query:
            self.delivery.update(status="sent", attempts=params[0],
                                 external_message_id=params[1])
        elif "status='failed'" in query:
            self.delivery.update(status="failed", attempts=params[0], error_message=params[1])
        elif "status='skipped'" in query:
            self.delivery.update(status="skipped", error_message=params[0])
        elif "status='pending'" in query:
            self.delivery.update(status="pending", error_message=None)


class Response:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FeishuNotifierTests(unittest.TestCase):
    def test_new_e1_p0_card_uses_event_severity(self):
        card = build_e1_card(EVENT | {"severity": "P0"}, "http://127.0.0.1:5173", test=True)
        self.assertEqual(card["header"]["template"], "red")
        self.assertIn("P0", card["header"]["title"]["content"])

    def test_b1_p0_card_is_a_manual_experimental_test(self):
        event = EVENT | {"rule_code": "B1", "severity": "P0", "title": "疑似烟雾/异常明火",
                         "confirmed_offset": 2}
        card = build_event_card(event, "http://127.0.0.1:5173", test=True)
        self.assertIn("B1", card["elements"][0]["content"])
        self.assertIn("需人工复核", card["elements"][0]["content"])
        self.assertNotIn("持续开启", card["elements"][0]["content"])
        self.assertIn("非现场告警", card["header"]["title"]["content"])
        with self.assertRaises(ValueError):
            FeishuNotifier(Settings(), MemoryDatabase()).notify_e1(event)
        db = MemoryDatabase()
        FeishuNotifier(Settings(), db).notify_event(event)
        self.assertEqual(db.delivery['status'], 'skipped')

    def test_g2_automatic_notification_preserves_review_label_and_idempotency(self):
        db = MemoryDatabase()
        event = EVENT | {'rule_code':'G2','severity':'P2','title':'疑似遗留物品'}
        settings = Settings(feishu_webhook_url='https://example.invalid/hook')
        with patch('apps.api.app.notifier.httpx.post',return_value=Response({'code':0})) as post:
            notifier=FeishuNotifier(settings,db)
            notifier.notify_event(event)
            notifier.notify_event(event)
        self.assertEqual(post.call_count,1)
        self.assertEqual(db.delivery['status'],'sent')
        self.assertIn('待人工核查',str(post.call_args.kwargs['json']))

    def test_card_is_labeled_and_links_to_real_hash_route(self):
        card = build_e1_card(EVENT | {"store_name": "MOMOYO JTU"},
                             "http://127.0.0.1:5173", test=True)
        self.assertIn("测试通知·非现场告警", card["header"]["title"]["content"])
        self.assertIn("已解决", card["elements"][0]["content"])
        self.assertEqual(card["elements"][2]["actions"][0]["url"],
                         "http://127.0.0.1:5173/#/event/EVT-TEST-1")
        self.assertEqual(len(card["elements"][2]["actions"]), 1)

    def test_application_bot_sends_interactive_card_and_is_idempotent(self):
        db = MemoryDatabase()
        settings = Settings(feishu_app_id="app", feishu_app_secret="secret",
                            feishu_chat_id="chat", public_base_url="https://example.test")
        with patch("apps.api.app.notifier.httpx.post", side_effect=[
            Response({"code": 0, "tenant_access_token": "token"}),
            Response({"code": 0, "data": {"message_id": "om_test"}}),
        ]) as post:
            notifier = FeishuNotifier(settings, db)
            first = notifier.notify_e1(EVENT, test=True)
            second = notifier.notify_e1(EVENT, test=True)
        self.assertEqual(first, second)
        self.assertEqual(post.call_count, 2)
        body = post.call_args.kwargs["json"]
        self.assertEqual(body["receive_id"], "chat")
        self.assertEqual(body["msg_type"], "interactive")
        self.assertIn("测试通知·非现场告警", json.loads(body["content"])["header"]["title"]["content"])
        self.assertEqual(db.delivery["status"], "sent")
        self.assertEqual(db.delivery["external_message_id"], "om_test")

    def test_app_error_is_failure_not_false_success(self):
        db = MemoryDatabase()
        settings = Settings(feishu_app_id="app", feishu_app_secret="secret",
                            feishu_chat_id="chat")
        with patch("apps.api.app.notifier.httpx.post", side_effect=[
            Response({"code": 0, "tenant_access_token": "token"}),
            Response({"code": 230001, "msg": "permission denied"}),
        ]):
            FeishuNotifier(settings, db).notify_e1(EVENT)
        self.assertEqual(db.delivery["status"], "failed")
        self.assertIn("230001", db.delivery["error_message"])

    def test_failed_test_delivery_can_be_explicitly_retried(self):
        db = MemoryDatabase()
        settings = Settings(feishu_app_id="app", feishu_app_secret="secret",
                            feishu_chat_id="chat")
        notifier = FeishuNotifier(settings, db)
        with patch("apps.api.app.notifier.httpx.post", side_effect=[
            Response({"code": 0, "tenant_access_token": "token"}),
            Response({"code": 230001}, status_code=400),
        ]):
            delivery_id = notifier.notify_e1(EVENT, test=True)
        self.assertEqual(db.delivery["status"], "failed")
        self.assertEqual(db.delivery["attempts"], 1)
        with patch("apps.api.app.notifier.httpx.post", side_effect=[
            Response({"code": 0, "tenant_access_token": "token"}),
            Response({"code": 0, "data": {"message_id": "om_retry"}}),
        ]) as post:
            self.assertEqual(notifier.notify_e1(EVENT, test=True, retry_failed=True), delivery_id)
        self.assertEqual(post.call_count, 2)
        self.assertEqual(db.delivery["status"], "sent")
        self.assertEqual(db.delivery["attempts"], 2)

    def test_group_webhook_is_preferred_and_signed(self):
        db = MemoryDatabase()
        settings = Settings(feishu_app_id="app", feishu_app_secret="secret",
                            feishu_chat_id="other-group",
                            feishu_webhook_url="https://secret.example",
                            feishu_signing_secret="sign-secret")
        with patch("apps.api.app.notifier.httpx.post", return_value=Response({"code": 0})) as post:
            FeishuNotifier(settings, db).notify_e1(EVENT, test=True)
        post.assert_called_once()
        self.assertEqual(post.call_args.args[0], "https://secret.example")
        self.assertEqual(post.call_args.kwargs["json"]["msg_type"], "interactive")
        self.assertTrue(post.call_args.kwargs["json"]["sign"])
        self.assertEqual(db.delivery["status"], "sent")

    def test_partial_app_configuration_without_webhook_skips(self):
        db = MemoryDatabase()
        with patch("apps.api.app.notifier.httpx.post") as post:
            FeishuNotifier(Settings(feishu_app_id="app"), db).notify_e1(EVENT)
        post.assert_not_called()
        self.assertEqual(db.delivery["status"], "skipped")

    def test_experimental_event_cannot_be_sent_as_e1(self):
        with self.assertRaises(ValueError):
            FeishuNotifier(Settings(), MemoryDatabase()).notify_e1(
                EVENT | {"rule_code": "A2", "severity": "P2"}, test=True
            )


if __name__ == "__main__":
    unittest.main()
