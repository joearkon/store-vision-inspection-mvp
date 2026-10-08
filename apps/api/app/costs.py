"""Published-price estimates for recorded visual-model usage, not account bills."""
from __future__ import annotations

from typing import Any


# 火山方舟在线推理（常规）公开价，元 / 100 万 Token，查询于 2026-10-06。
# https://docs.volcengine.com/docs/ark/model-pricing?lang=zh
MODEL_RATES = {
    "doubao-seed-2-1-lite-260915": (0.80, 2.70),
    "doubao-seed-2-1-pro-260915": (6.00, 30.00),
    # 常规在线推理，非音频输入 [0, 256]K；不使用低优/低延迟费率。
    "doubao-seed-2-1-turbo-260628": (3.00, 15.00),
}


def estimate_analysis_cost(run: dict[str, Any]) -> dict[str, Any]:
    """Return a cost estimate or a range when the historic model was not saved.

    Counts include image tokens but the old task schema lacks cache/audio splits.
    These calculations use full non-audio input rates without cache discounts.
    """
    prompt = int(run.get("prompt_tokens") or 0)
    completion = int(run.get("completion_tokens") or 0)
    requests = int(run.get("request_count") or 0)
    model = run.get("model_id") or run.get("observed_model")
    if requests <= 0 or prompt + completion <= 0:
        return {"cost_status": "usage_unrecorded", "cost_model_id": model,
                "estimated_cost_yuan": None, "cost_range_yuan": None}

    def cost(rates: tuple[float, float]) -> float:
        return round((prompt * rates[0] + completion * rates[1]) / 1_000_000, 6)

    if model in MODEL_RATES:
        return {"cost_status": "estimated", "cost_model_id": model,
                "estimated_cost_yuan": cost(MODEL_RATES[model]), "cost_range_yuan": None}

    if model:
        return {"cost_status":"price_unconfigured","cost_model_id":model,"estimated_cost_yuan":None,"cost_range_yuan":None}
    values = [cost(rates) for rates in MODEL_RATES.values()]
    return {"cost_status": "model_unrecorded", "cost_model_id": model,
            "estimated_cost_yuan": None, "cost_range_yuan": [min(values), max(values)]}
