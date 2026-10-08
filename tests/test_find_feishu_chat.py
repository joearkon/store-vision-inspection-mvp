from __future__ import annotations

import unittest

import httpx

from scripts.find_feishu_chat import _checked_payload


class FindFeishuChatTests(unittest.TestCase):
    def test_success_payload_is_returned(self):
        response = httpx.Response(200, json={"code": 0, "data": {"items": []}},
                                  request=httpx.Request("GET", "https://open.feishu.cn"))
        self.assertEqual(_checked_payload(response)["data"]["items"], [])

    def test_permission_failure_prints_scopes_not_remote_details(self):
        response = httpx.Response(
            400, json={"code": 99991672, "msg": "grant im:chat:readonly token=private"},
            request=httpx.Request("GET", "https://open.feishu.cn"),
        )
        with self.assertRaises(RuntimeError) as caught:
            _checked_payload(response)
        self.assertIn("im:chat:readonly", str(caught.exception))
        self.assertNotIn("private", str(caught.exception))


if __name__ == "__main__":
    unittest.main()
