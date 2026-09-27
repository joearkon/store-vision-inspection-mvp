from __future__ import annotations

import base64
import json
import mimetypes
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import httpx

from .config import Settings


@dataclass(frozen=True)
class VisionObservation:
    image_quality: str
    state: str
    confidence: float
    evidence: str
    bbox: list[float] | None
    raw: dict[str, Any]


@dataclass(frozen=True)
class VideoOpenSegment:
    start_seconds: float
    end_seconds: float
    confidence: float
    evidence: str


@dataclass(frozen=True)
class VideoScreening:
    image_quality: str
    segments: list[VideoOpenSegment]
    raw: dict[str, Any]


class VisionProvider(Protocol):
    def inspect_fridge_door(self, image_path: Path, camera_name: str) -> VisionObservation:
        ...

    def inspect_open_segments(
        self, video_path: Path, camera_name: str, fps: float
    ) -> VideoScreening:
        ...

    def inspect_ppe(self, image_path: Path, camera_name: str) -> VisionObservation:
        ...

    def inspect_ppe_segments(
        self, video_path: Path, camera_name: str, fps: float
    ) -> VideoScreening:
        ...


class DoubaoVisionProvider:
    def __init__(self, settings: Settings):
        if not settings.vision_api_key:
            raise RuntimeError("VOLC_ENGINE_API_KEY 未配置，无法执行真实视觉分析")
        self.settings = settings

    def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        response = None
        for attempt in range(1, self.settings.vision_max_attempts + 1):
            try:
                response = httpx.post(
                    f"{self.settings.vision_base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self.settings.vision_api_key}"},
                    json=payload,
                    timeout=self.settings.vision_timeout_seconds,
                )
                response.raise_for_status()
                return response.json()
            except (httpx.TimeoutException, httpx.NetworkError):
                if attempt >= self.settings.vision_max_attempts:
                    raise
                time.sleep(min(2 ** (attempt - 1), 4))
            except httpx.HTTPStatusError as exc:
                retryable = exc.response.status_code == 429 or exc.response.status_code >= 500
                if not retryable or attempt >= self.settings.vision_max_attempts:
                    raise
                retry_after = exc.response.headers.get("retry-after")
                try:
                    delay = float(retry_after) if retry_after else float(3 ** attempt)
                except ValueError:
                    delay = float(3 ** attempt)
                time.sleep(min(max(delay, 1), 30))
        raise RuntimeError("视觉接口没有返回结果")

    def inspect_fridge_door(self, image_path: Path, camera_name: str) -> VisionObservation:
        mime = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["image_quality", "fridge_door", "confidence", "evidence", "bbox"],
            "properties": {
                "image_quality": {"enum": ["usable", "insufficient"]},
                "fridge_door": {"enum": ["open", "closed", "not_visible", "uncertain"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "evidence": {"type": "string"},
                "bbox": {
                    "anyOf": [
                        {
                            "type": "array",
                            "items": {"type": "number"},
                            "minItems": 4,
                            "maxItems": 4,
                        },
                        {"type": "null"},
                    ]
                },
            },
        }
        payload = {
            "model": self.settings.vision_model,
            "temperature": 0,
            # This is a four-class visual observation, not a reasoning task.
            # Seed 2.1 defaults to high reasoning effort, which adds substantial
            # latency and makes a 1 fps video pipeline unnecessarily fragile.
            "thinking": {"type": "disabled"},
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是门店视频巡检的视觉观察器。只描述画面中可见事实，"
                        "不要推测持续时间、严重度、制度条款或责任。"
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"摄像头：{camera_name}。判断画面中的冷藏柜或冰箱门是打开、"
                                "关闭、不可见还是无法判断。bbox 使用 0-1 归一化坐标。"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{encoded}"},
                        },
                    ],
                },
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "fridge_door_observation", "strict": True, "schema": schema},
            },
        }
        body = self._post(payload)
        content = body["choices"][0]["message"]["content"]
        result = json.loads(content) if isinstance(content, str) else content
        state = result["fridge_door"]
        if result["image_quality"] != "usable" or state in {"not_visible", "uncertain"}:
            state = "unknown"
        return VisionObservation(
            image_quality=result["image_quality"],
            state=state,
            confidence=float(result["confidence"]),
            evidence=result["evidence"],
            bbox=result.get("bbox"),
            raw=body,
        )

    def inspect_open_segments(
        self, video_path: Path, camera_name: str, fps: float
    ) -> VideoScreening:
        encoded = base64.b64encode(video_path.read_bytes()).decode("ascii")
        schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["image_quality", "segments"],
            "properties": {
                "image_quality": {"enum": ["usable", "insufficient"]},
                "segments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["start_seconds", "end_seconds", "confidence", "evidence"],
                        "properties": {
                            "start_seconds": {"type": "number", "minimum": 0},
                            "end_seconds": {"type": "number", "minimum": 0},
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                            "evidence": {"type": "string"},
                        },
                    },
                },
            },
        }
        payload = {
            "model": self.settings.vision_model,
            "temperature": 0,
            "thinking": {"type": "disabled"},
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"摄像头：{camera_name}。只观察冷藏柜或冰箱门，列出所有可见的持续开启"
                            "时间区间。时间使用视频秒数；无法可靠判断时将 image_quality 设为 insufficient。"
                            "不要判断规则、严重度或责任。"
                        ),
                    },
                    {
                        "type": "video_url",
                        "video_url": {
                            "url": f"data:video/mp4;base64,{encoded}",
                            "fps": fps,
                        },
                    },
                ],
            }],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "fridge_open_segments", "strict": True, "schema": schema},
            },
        }
        body = self._post(payload)
        content = body["choices"][0]["message"]["content"]
        result = json.loads(content) if isinstance(content, str) else content
        segments = [
            VideoOpenSegment(
                start_seconds=float(item["start_seconds"]),
                end_seconds=float(item["end_seconds"]),
                confidence=float(item["confidence"]),
                evidence=item["evidence"],
            )
            for item in result["segments"]
            if float(item["end_seconds"]) >= float(item["start_seconds"])
        ]
        return VideoScreening(
            image_quality=result["image_quality"],
            segments=segments if result["image_quality"] == "usable" else [],
            raw=body,
        )

    def inspect_ppe(self, image_path: Path, camera_name: str) -> VisionObservation:
        mime = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        schema = {
            "type": "object",
            "additionalProperties": False,
            "required": [
                "image_quality", "person_in_operation_area", "face_visibility",
                "mask", "hands_visibility", "gloves", "confidence", "evidence", "bbox",
            ],
            "properties": {
                "image_quality": {"enum": ["usable", "insufficient"]},
                "person_in_operation_area": {"type": "boolean"},
                "face_visibility": {"enum": ["clear", "partial", "not_visible"]},
                "mask": {"enum": ["worn", "not_worn", "uncertain"]},
                "hands_visibility": {"enum": ["clear", "partial", "not_visible"]},
                "gloves": {"enum": ["worn", "not_worn", "uncertain"]},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "evidence": {"type": "string"},
                "bbox": {
                    "anyOf": [
                        {"type": "array", "items": {"type": "number"}, "minItems": 4, "maxItems": 4},
                        {"type": "null"},
                    ]
                },
            },
        }
        payload = {
            "model": self.settings.vision_model,
            "temperature": 0,
            "thinking": {"type": "disabled"},
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"摄像头：{camera_name}。判断制作或前台操作区内员工是否规范佩戴一次性口罩"
                            "和一次性手套。只有脸部清晰时才能判断口罩，只有双手清晰时才能判断手套；"
                            "遮挡、背身、距离过远或正在走过而非操作时必须返回 uncertain。"
                            "只描述可见事实，不判断责任、严重度或制度。bbox 为员工的 0-1 归一化坐标。"
                        ),
                    },
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}},
                ],
            }],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "ppe_observation", "strict": True, "schema": schema},
            },
        }
        body = self._post(payload)
        content = body["choices"][0]["message"]["content"]
        result = json.loads(content) if isinstance(content, str) else content
        face_clear = result["face_visibility"] == "clear"
        hands_clear = result["hands_visibility"] == "clear"
        missing_mask = face_clear and result["mask"] == "not_worn"
        missing_gloves = hands_clear and result["gloves"] == "not_worn"
        fully_compliant = (
            face_clear and hands_clear
            and result["mask"] == "worn" and result["gloves"] == "worn"
        )
        if result["image_quality"] != "usable" or not result["person_in_operation_area"]:
            state = "unknown"
        elif missing_mask or missing_gloves:
            state = "violation"
        elif fully_compliant:
            state = "compliant"
        else:
            state = "unknown"
        return VisionObservation(
            image_quality=result["image_quality"],
            state=state,
            confidence=float(result["confidence"]),
            evidence=result["evidence"],
            bbox=result.get("bbox"),
            raw=body,
        )

    def inspect_ppe_segments(
        self, video_path: Path, camera_name: str, fps: float
    ) -> VideoScreening:
        encoded = base64.b64encode(video_path.read_bytes()).decode("ascii")
        schema = {
            "type": "object",
            "additionalProperties": False,
            "required": ["image_quality", "segments"],
            "properties": {
                "image_quality": {"enum": ["usable", "insufficient"]},
                "segments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["start_seconds", "end_seconds", "confidence", "evidence"],
                        "properties": {
                            "start_seconds": {"type": "number", "minimum": 0},
                            "end_seconds": {"type": "number", "minimum": 0},
                            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                            "evidence": {"type": "string"},
                        },
                    },
                },
            },
        }
        payload = {
            "model": self.settings.vision_model,
            "temperature": 0,
            "thinking": {"type": "disabled"},
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f"摄像头：{camera_name}。列出制作或前台操作区员工疑似未佩戴一次性口罩"
                            "或一次性手套的时间区间。只有脸部或双手清晰可见时才列为疑似区间；"
                            "背身、遮挡、距离过远、路过人员不要列入。时间使用视频秒数。"
                        ),
                    },
                    {"type": "video_url", "video_url": {"url": f"data:video/mp4;base64,{encoded}", "fps": fps}},
                ],
            }],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "ppe_suspicious_segments", "strict": True, "schema": schema},
            },
        }
        body = self._post(payload)
        content = body["choices"][0]["message"]["content"]
        result = json.loads(content) if isinstance(content, str) else content
        segments = [
            VideoOpenSegment(
                start_seconds=float(item["start_seconds"]),
                end_seconds=float(item["end_seconds"]),
                confidence=float(item["confidence"]),
                evidence=item["evidence"],
            )
            for item in result["segments"]
            if float(item["end_seconds"]) >= float(item["start_seconds"])
        ]
        return VideoScreening(
            image_quality=result["image_quality"],
            segments=segments if result["image_quality"] == "usable" else [],
            raw=body,
        )
