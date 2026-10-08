export function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return "—";
  const value = Math.max(0, Number(seconds));
  if (value < 60) return `${Math.round(value)} 秒`;
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

export const statusLabels = {
  queued: "等待分析",
  claimed: "准备分析",
  running: "分析中",
  cancelled: "已取消",
  awaiting_approval: "等待确认",
  completed: "已完成",
  failed: "分析失败",
  pending_confirmation: "待确认",
  acknowledged: "已确认",
  rectifying: "整改中",
  resolved: "已解决",
  false_positive: "误报",
  ignored: "已忽略"
};

export function statusLabel(status) {
  return statusLabels[status] || status || "未知";
}

export function percent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

export function timelinePercent(offset, duration) {
  if (!Number.isFinite(offset) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (offset / duration) * 100));
}
