from __future__ import annotations

import base64
import json
import mimetypes
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


class VisionProvider(Protocol):
    def inspect_fridge_door(self, image_path: Path, camera_name: str) -> VisionObservation:
        ...


class DoubaoVisionProvider:
    def __init__(self, settings: Settings):
        if not settings.vision_api_key:
            raise RuntimeError("VOLC_ENGINE_API_KEY 未配置，无法执行真实视觉分析")
        self.settings = settings

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
        response = httpx.post(
            f"{self.settings.vision_base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.settings.vision_api_key}"},
            json=payload,
            timeout=30,
        )
        response.raise_for_status()
        body = response.json()
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
