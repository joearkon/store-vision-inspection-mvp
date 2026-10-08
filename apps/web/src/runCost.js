function yuan(value) {
  if (value > 0 && value < 0.00005) return "<¥0.0001";
  return `¥${value.toFixed(4)}`;
}

export function runCostText(run) {
  if (run.cost_status === "price_unconfigured") return "模型费率待配置";
  if (run.cost_status === "estimated" && Number.isFinite(run.estimated_cost_yuan)) {
    return `约 ${yuan(run.estimated_cost_yuan)}`;
  }
  if (run.cost_status === "model_unrecorded" && Array.isArray(run.cost_range_yuan)) {
    return `约 ${yuan(run.cost_range_yuan[0])}–${yuan(run.cost_range_yuan[1])}`;
  }
  return run.status === "completed" ? "用量未记录" : "暂无可核算用量";
}
