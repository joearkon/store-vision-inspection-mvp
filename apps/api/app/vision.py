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

    def inspect_rule_frame(
        self, rule_code: str, image_path: Path, camera_name: str, roi: dict[str, Any] | None
    ) -> VisionObservation:
        ...

    def inspect_rule_segments(
        self, rule_code: str, video_path: Path, camera_name: str,
        fps: float, roi: dict[str, Any] | None
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

    def inspect_scene(self, images: list[Path]) -> dict[str, Any]:
        box={"type":"array","items":{"type":"number","minimum":0,"maximum":1000},"minItems":4,"maxItems":4}
        schema={"type":"object","additionalProperties":False,"required":["image_quality","regions","video_start_clock","coordinate_system"],"properties":{
            "coordinate_system":{"enum":["normalized_1000"]},
            "image_quality":{"enum":["usable","insufficient"]},
            "video_start_clock":{"type":["string","null"]},
            "regions":{"type":"array","maxItems":20,"items":{"type":"object","additionalProperties":False,
                "required":["kind","name","bbox","confidence","evidence"],"properties":{
                    "kind":{"enum":["table","counter","operation","floor","fridge"]},
                    "name":{"type":"string"},"bbox":box,"confidence":{"type":"number","minimum":0,"maximum":1},"evidence":{"type":"string"}}}}}}
        content=[{"type":"text","text":"按第一张画面坐标识别实际可见的餐桌桌面(table)、前台(counter)、员工制作区(operation)、地面(floor)、明确冷藏柜(fridge)。每张餐桌分别标框，table只框桌面不含桌腿座椅；evidence每项不超过30个汉字；bbox使用0–1000千分比坐标[x1,y1,x2,y2]，例如[101,490,178,676]；禁止输出像素坐标或0–1小数坐标。coordinate_system必须为normalized_1000，不要把座椅/海报当餐桌，不要凭门店类别猜冰箱。只输出可见区域及依据，遮挡或不确定降低confidence。后两张用于核对机位稳定性，机位变化/无法对齐返回insufficient。video_start_clock仅抄第一张画面日期时间中的HH:MM，无清晰时钟返回null。不要判断违规、垃圾或是否完成清洁。"}]
        for path in images:
            content.append({"type":"image_url","image_url":{"url":"data:image/jpeg;base64,"+base64.b64encode(path.read_bytes()).decode()}})
        raw=self._post({"model":self.settings.vision_model,"thinking":{"type":"disabled"},"temperature":0,"messages":[{"role":"user","content":content}],
            "response_format":{"type":"json_schema","json_schema":{"name":"store_scene","strict":True,"schema":schema}}})
        result=json.loads(raw['choices'][0]['message']['content'])
        if result.get('coordinate_system')!='normalized_1000':
            raise ValueError('模型坐标系不明确，未使用识别区域')
        for region in result['regions']:
            region['bbox']=[v/1000 for v in region['bbox']]
        result['coordinate_system']='normalized_01'
        return {"result":result,"raw":raw}

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

    def inspect_rule_frame(
        self, rule_code: str, image_path: Path, camera_name: str, roi: dict[str, Any] | None
    ) -> VisionObservation:
        if rule_code not in {"B1", "G1", "G2", "M1", "A2", "C1", "A3", "A4"}:
            raise ValueError("不支持的实验规则")
        if rule_code in {"G1", "G2"} and not roi:
            raise ValueError("G1 缺少逐桌 ROI")
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        mime = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
        states = (["mopping", "not_mopping", "unknown"] if rule_code == "M1" else ["smoke", "flame", "steam", "clear", "unknown"] if rule_code == "B1" else
                  ["departed_residual", "occupied", "clean", "cleaning", "unknown"] if rule_code in {"G1", "G2"} else
                  ["messy", "clean", "in_use", "unknown"] if rule_code == "A3" else
                  ["violation", "compliant", "unknown"])
        operation_instructions = {
            "M1": "只判断是否明确看见员工使用拖把，拖把头与地面接触并擦拭地面。看到拖地返回 mopping；清楚看见地面但没有此动作返回 not_mopping；工具不清楚、遮挡或无法区分扫地时返回 unknown。不推断整个早上是否清洁、拖地是否覆盖全店或清洁质量。",
            "A2": "仅判断操作区内正在操作的员工是否明确未戴工作帽或发网。头部清晰可见且确定缺失才返回 violation；已戴返回 compliant；遮挡、背对、不是员工返回 unknown。",
            "C1": "仅判断操作区内正在操作的员工是否明确缺少规定的围裙或工服。躯干清晰可见且确定缺失才返回 violation；穿着合规返回 compliant；遮挡、普通顾客或无法确认返回 unknown。",
            "A3": "仅判断固定操作台是否明显脏乱，存在持续可见的废弃物、污渍或杂物堆积才返回 messy；正常制作中的工具和原料返回 in_use；整洁返回 clean；遮挡或无法区分返回 unknown。",
            "A4": "仅判断操作区地面是否明确存在积水或明显垃圾。必须看见地面及异常物体才返回 violation；干净干燥返回 compliant；反光、拖地清洁中、遮挡或无法分辨返回 unknown。",
        }
        instruction = operation_instructions.get(rule_code) or (
            "只判断设备区域是否可见异常烟雾、异常明火、正常水蒸汽或无异常。"
            "正常蒸煮水汽、灯光反射、正常受控火焰不得判为 smoke/flame；无法区分时返回 unknown。"
            if rule_code == "B1" else
            f"只判断桌位 {roi['id']}，归一化区域 {roi['bbox']}。顾客明确离席且桌面有顾客遗留杯盘/垃圾时"
            "返回 departed_residual；顾客仍在座返回 occupied；员工正在清理返回 cleaning；"
            "桌面干净返回 clean；遮挡或无法确认离席时返回 unknown。固定摆件不计残留。"
        )
        if rule_code == "G2":
            instruction = (
                f"只观察桌位 {roi['id']}，归一化区域 {roi['bbox']}。"
                "有人在座返回 occupied；无人就座且桌面有疑似纸张、杯盘或遗留物品返回 departed_residual；"
                "空桌无物返回 clean；正在清理返回 cleaning；遮挡返回 unknown。"
                "只描述可见物品，不把纸张确定为垃圾，不推断离席过程或清洁超时；明确固定摆件不计。"
            )
        schema = {
            "type": "object", "additionalProperties": False,
            "required": ["image_quality", "state", "confidence", "evidence", "bbox"],
            "properties": {
                "image_quality": {"enum": ["usable", "insufficient"]},
                "state": {"enum": states},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "evidence": {"type": "string"},
                "bbox": {"anyOf": [
                    {"type": "array", "items": {"type": "number"}, "minItems": 4, "maxItems": 4},
                    {"type": "null"},
                ]},
            },
        }
        payload = {
            "model": self.settings.vision_model, "temperature": 0,
            "thinking": {"type": "disabled"},
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": f"摄像头：{camera_name}。{instruction}只输出可见事实，不推断持续时间、严重度或责任。"},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{encoded}"}},
            ]}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": f"{rule_code.lower()}_frame_observation", "strict": True, "schema": schema,
            }},
        }
        body = self._post(payload)
        content = body["choices"][0]["message"]["content"]
        result = json.loads(content) if isinstance(content, str) else content
        return VisionObservation(
            image_quality=result["image_quality"],
            state=result["state"] if result["image_quality"] == "usable" else "unknown",
            confidence=float(result["confidence"]), evidence=result["evidence"],
            bbox=result.get("bbox"), raw=body,
        )

    def inspect_rule_segments(
        self, rule_code: str, video_path: Path, camera_name: str,
        fps: float, roi: dict[str, Any] | None
    ) -> VideoScreening:
        if rule_code not in {"B1", "G1", "G2", "M1", "A2", "C1", "A3", "A4"}:
            raise ValueError("不支持的实验规则")
        if rule_code in {"G1", "G2"} and not roi:
            raise ValueError("G1 缺少逐桌 ROI")
        encoded = base64.b64encode(video_path.read_bytes()).decode("ascii")
        operation_instructions = {
            "M1": "只列出明确可见员工使用拖把擦拭地面的区间。必须观察到拖把头接触地面并往返移动；扫地、走路、拿杆不算。无可见动作时返回空数组；不推断开店截止时间、全天未拖地或清洁质量。",
            "A2": "仅列出操作区员工头部清楚可见且疑似未戴工作帽/发网的区间；遮挡、非员工和无法确认不列入。",
            "C1": "仅列出操作区员工躯干清楚可见且疑似未穿围裙/工服的区间；遮挡、非员工和无法确认不列入。",
            "A3": "仅列出操作台明显脏乱且持续可见的区间；制作过程正常摆放、短暂使用中的工具及原料不列入。",
            "A4": "仅列出地面明确有积水或明显垃圾的区间；反光、正常拖地、无法确认不列入。",
        }
        instruction = operation_instructions.get(rule_code) or (
            "本次只检测 B1：后厨设备附近出现的异常烟雾或失控明火。"
            "逐个时间段核对是否真的看见烟雾从设备处升起、扩散，或看见失控火焰；"
            "每段 evidence 必须明确写出烟雾/火焰的可见位置与形态。"
            "冷藏柜门敞开、人员走动、正常蒸汽、灯光反射、正常受控火焰都不是 B1，不能列入。"
            "如果没有可见的异常烟雾或失控明火，segments 返回空数组，不要猜测其他规则。"
            if rule_code == "B1" else
            f"只观察桌位 {roi['id']}，归一化区域 {roi['bbox']}。列出顾客明确离席后，"
            "桌上仍有顾客遗留杯盘或垃圾、且无人清理的时间区间。顾客仍在座、固定摆件不要列入。"
        )
        if rule_code == "G2":
            instruction = (
                f"只观察桌位 {roi['id']}，归一化区域 {roi['bbox']}。"
                "先核对顾客在座到起身离开的过程，再列出离席后桌面有疑似纸张、杯盘或遗留物品的区间。"
                "如果没有观察到从有人在座到离开的变化，返回空数组。"
                "只写可见物品，不认定垃圾、不判断清洁超时，明确固定摆件不计。"
            )
        schema = {
            "type": "object", "additionalProperties": False,
            "required": ["image_quality", "segments"],
            "properties": {
                "image_quality": {"enum": ["usable", "insufficient"]},
                "segments": {"type": "array", "items": {
                    "type": "object", "additionalProperties": False,
                    "required": ["start_seconds", "end_seconds", "confidence", "evidence"],
                    "properties": {
                        "start_seconds": {"type": "number", "minimum": 0},
                        "end_seconds": {"type": "number", "minimum": 0},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "evidence": {"type": "string"},
                    },
                }},
            },
        }
        payload = {
            "model": self.settings.vision_model, "temperature": 0,
            "thinking": {"type": "disabled"},
            "messages": [{"role": "user", "content": [
                {"type": "text", "text": f"摄像头：{camera_name}。{instruction}时间使用视频秒数。只观察，不判断是否达到规则阈值。"},
                {"type": "video_url", "video_url": {"url": f"data:video/mp4;base64,{encoded}", "fps": fps}},
            ]}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": f"{rule_code.lower()}_candidate_segments", "strict": True, "schema": schema,
            }},
        }
        body = self._post(payload)
        content = body["choices"][0]["message"]["content"]
        result = json.loads(content) if isinstance(content, str) else content
        segments = [VideoOpenSegment(
            start_seconds=float(item["start_seconds"]), end_seconds=float(item["end_seconds"]),
            confidence=float(item["confidence"]), evidence=item["evidence"],
        ) for item in result["segments"] if float(item["end_seconds"]) >= float(item["start_seconds"])]
        return VideoScreening(
            image_quality=result["image_quality"],
            segments=segments if result["image_quality"] == "usable" else [], raw=body,
        )
