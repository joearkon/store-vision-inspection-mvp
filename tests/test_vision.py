from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx

from apps.api.app.config import Settings
from apps.api.app.vision import DoubaoVisionProvider


class VisionProviderTests(unittest.TestCase):
    def test_retries_transient_timeout_and_returns_real_response(self) -> None:
        payload = {
            "choices": [{"message": {"content": json.dumps({
                "image_quality": "usable",
                "fridge_door": "open",
                "confidence": 0.91,
                "evidence": "柜门可见并处于打开状态",
                "bbox": [0.1, 0.1, 0.5, 0.9],
            })}}]
        }
        response = httpx.Response(200, json=payload, request=httpx.Request("POST", "https://example.test"))
        settings = Settings(
            vision_api_key="test-key",
            vision_base_url="https://example.test",
            vision_model="test-model",
            vision_timeout_seconds=12,
            vision_max_attempts=2,
        )

        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "frame.jpg"
            image.write_bytes(b"jpeg")
            with patch("apps.api.app.vision.httpx.post", side_effect=[httpx.ReadTimeout("slow"), response]) as post:
                with patch("apps.api.app.vision.time.sleep"):
                    result = DoubaoVisionProvider(settings).inspect_fridge_door(image, "仓储-01")

        self.assertEqual(result.state, "open")
        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args.kwargs["timeout"], 12)
        self.assertEqual(
            post.call_args.kwargs["json"]["thinking"],
            {"type": "disabled"},
        )

    def test_retries_rate_limit_and_honors_retry_after(self) -> None:
        payload = {
            "choices": [{"message": {"content": json.dumps({
                "image_quality": "usable",
                "fridge_door": "closed",
                "confidence": 0.92,
                "evidence": "柜门关闭",
                "bbox": [0.1, 0.1, 0.5, 0.9],
            })}}]
        }
        limited = httpx.Response(
            429,
            headers={"retry-after": "2"},
            request=httpx.Request("POST", "https://example.test"),
        )
        ok = httpx.Response(200, json=payload, request=httpx.Request("POST", "https://example.test"))
        settings = Settings(
            vision_api_key="test-key", vision_base_url="https://example.test",
            vision_model="test-model", vision_max_attempts=2,
        )
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "frame.jpg"
            image.write_bytes(b"jpeg")
            with patch("apps.api.app.vision.httpx.post", side_effect=[limited, ok]):
                with patch("apps.api.app.vision.time.sleep") as sleep:
                    result = DoubaoVisionProvider(settings).inspect_fridge_door(image, "仓储-01")
        self.assertEqual(result.state, "closed")
        sleep.assert_called_once_with(2.0)

    def test_video_screening_parses_open_segments(self) -> None:
        body = {
            "choices": [{"message": {"content": json.dumps({
                "image_quality": "usable",
                "segments": [{
                    "start_seconds": 2,
                    "end_seconds": 37,
                    "confidence": 0.93,
                    "evidence": "冷藏柜门持续开启",
                }],
            })}}],
            "usage": {"prompt_tokens": 500, "completion_tokens": 50},
        }
        settings = Settings(vision_api_key="test-key", vision_model="test-model")
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "test.mp4"
            video.write_bytes(b"video")
            provider = DoubaoVisionProvider(settings)
            with patch.object(provider, "_post", return_value=body) as post:
                screening = provider.inspect_open_segments(video, "仓储-01", 0.2)

        self.assertEqual(len(screening.segments), 1)
        self.assertEqual(screening.segments[0].start_seconds, 2)
        self.assertEqual(screening.segments[0].end_seconds, 37)
        payload = post.call_args.args[0]
        video_part = payload["messages"][0]["content"][1]
        self.assertEqual(video_part["video_url"]["fps"], 0.2)
        self.assertTrue(video_part["video_url"]["url"].startswith("data:video/mp4;base64,"))

    def test_ppe_requires_clear_visible_evidence(self) -> None:
        body = {
            "choices": [{"message": {"content": json.dumps({
                "image_quality": "usable",
                "person_in_operation_area": True,
                "face_visibility": "clear",
                "mask": "not_worn",
                "hands_visibility": "not_visible",
                "gloves": "uncertain",
                "confidence": 0.94,
                "evidence": "操作区员工脸部清晰，未见口罩；双手不可见",
                "bbox": [0.2, 0.1, 0.7, 0.95],
            })}}]
        }
        settings = Settings(vision_api_key="test-key", vision_model="test-model")
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "ppe.jpg"
            image.write_bytes(b"jpeg")
            provider = DoubaoVisionProvider(settings)
            with patch.object(provider, "_post", return_value=body):
                result = provider.inspect_ppe(image, "前台-01")
        self.assertEqual(result.state, "violation")

    def test_ppe_does_not_claim_compliance_when_hands_are_hidden(self) -> None:
        body = {
            "choices": [{"message": {"content": json.dumps({
                "image_quality": "usable",
                "person_in_operation_area": True,
                "face_visibility": "clear",
                "mask": "worn",
                "hands_visibility": "not_visible",
                "gloves": "uncertain",
                "confidence": 0.7,
                "evidence": "口罩可见，双手被操作台遮挡",
                "bbox": [0.2, 0.1, 0.7, 0.95],
            })}}]
        }
        settings = Settings(vision_api_key="test-key", vision_model="test-model")
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "ppe.jpg"
            image.write_bytes(b"jpeg")
            provider = DoubaoVisionProvider(settings)
            with patch.object(provider, "_post", return_value=body):
                result = provider.inspect_ppe(image, "前台-01")
        self.assertEqual(result.state, "unknown")

    def test_b1_frame_observes_steam_without_promoting_to_smoke(self) -> None:
        body = {"choices": [{"message": {"content": json.dumps({
            "image_quality": "usable", "state": "steam", "confidence": .92,
            "evidence": "热水壶口有白色水汽", "bbox": [0.2, 0.2, 0.5, 0.6],
        })}}]}
        with tempfile.TemporaryDirectory() as directory:
            image = Path(directory) / "steam.jpg"
            image.write_bytes(b"jpeg")
            provider = DoubaoVisionProvider(Settings(vision_api_key="test-key"))
            with patch.object(provider, "_post", return_value=body) as post:
                result = provider.inspect_rule_frame("B1", image, "后厨-01", None)
        self.assertEqual(result.state, "steam")
        self.assertIn("steam", post.call_args.args[0]["response_format"]["json_schema"]["schema"]["properties"]["state"]["enum"])

    def test_g1_requires_roi_and_can_screen_departure_interval(self) -> None:
        provider = DoubaoVisionProvider(Settings(vision_api_key="test-key"))
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "table.mp4"
            video.write_bytes(b"video")
            with self.assertRaises(ValueError):
                provider.inspect_rule_segments("G1", video, "用餐区-01", .2, None)
            body = {"choices": [{"message": {"content": json.dumps({
                "image_quality": "usable", "segments": [{
                    "start_seconds": 5, "end_seconds": 49, "confidence": .9,
                    "evidence": "顾客离席后桌上仍有杯盘",
                }],
            })}}]}
            roi = {"id": "TABLE-TEST-01", "bbox": [0, 0, 1, 1]}
            with patch.object(provider, "_post", return_value=body) as post:
                result = provider.inspect_rule_segments("G1", video, "用餐区-01", .2, roi)
        self.assertEqual(result.segments[0].start_seconds, 5)
        self.assertIn("TABLE-TEST-01", post.call_args.args[0]["messages"][0]["content"][0]["text"])

    def test_b1_screening_excludes_unrelated_fridge_door_events(self) -> None:
        body = {"choices": [{"message": {"content": json.dumps({
            "image_quality": "usable", "segments": [],
        })}}]}
        with tempfile.TemporaryDirectory() as directory:
            video = Path(directory) / "smoke.mp4"
            video.write_bytes(b"video")
            provider = DoubaoVisionProvider(Settings(vision_api_key="test-key"))
            with patch.object(provider, "_post", return_value=body) as post:
                result = provider.inspect_rule_segments("B1", video, "后厨-01", .2, None)
        self.assertEqual(result.segments, [])
        prompt = post.call_args.args[0]["messages"][0]["content"][0]["text"]
        self.assertIn("冷藏柜门敞开", prompt)
        self.assertIn("segments 返回空数组", prompt)

    def test_operation_rules_use_distinct_states_and_exclusions(self) -> None:
        provider = DoubaoVisionProvider(Settings(vision_api_key="test-key"))
        cases = (
            ("A2", "violation", "遮挡"),
            ("C1", "violation", "遮挡"),
            ("A3", "messy", "正常制作"),
            ("A4", "violation", "反光"),
        )
        with tempfile.TemporaryDirectory() as directory:
            frame = Path(directory) / "frame.jpg"
            frame.write_bytes(b"jpeg")
            for rule, state, exclusion in cases:
                with self.subTest(rule=rule):
                    body = {"choices": [{"message": {"content": json.dumps({
                        "image_quality": "usable", "state": state, "confidence": .91,
                        "evidence": "测试可见事实", "bbox": [0, 0, 1, 1],
                    })}}]}
                    with patch.object(provider, "_post", return_value=body) as post:
                        observation = provider.inspect_rule_frame(rule, frame, "后厨-01", None)
                    self.assertEqual(observation.state, state)
                    payload = post.call_args.args[0]
                    self.assertIn(exclusion, payload["messages"][0]["content"][0]["text"])
                    self.assertIn("unknown", payload["response_format"]["json_schema"]["schema"]["properties"]["state"]["enum"])


if __name__ == "__main__":
    unittest.main()
