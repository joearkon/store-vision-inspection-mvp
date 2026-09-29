export function analysisElapsedSeconds(run) {
  if (!run?.started_at || !run?.completed_at) return null;
  const start = Date.parse(run.started_at);
  const end = Date.parse(run.completed_at);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return (end - start) / 1000;
}

export function screeningCandidateCount(run) {
  if (!run?.screening_result_json) return null;
  try {
    const segments = JSON.parse(run.screening_result_json).segments;
    return Array.isArray(segments) ? segments.length : null;
  } catch {
    return null;
  }
}

export function runOutcome(run) {
  if (run.status === "failed") return { label: "分析失败", tone: "failed", detail: run.error_message || "请查看任务错误" };
  if (run.status !== "completed") return { label: "尚未完成", tone: "pending", detail: "等待最终聚合结果" };
  const count = Number(run.event_count || 0);
  if (count > 0) return { label: `生成 ${count} 条事件`, tone: "alert", detail: "可打开事件证据进一步复核" };
  if (run.rule_code === "B1") return { label: "未检出 B1 异常", tone: "clear", detail: "本次未形成烟雾/异常明火事件；不代表视频其他风险均已排除" };
  return { label: "无确认事件", tone: "clear", detail: "本次分析未形成该规则的确认事件" };
}
