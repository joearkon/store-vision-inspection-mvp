export function filterRectificationEvents(events, filters, now = new Date()) {
  const query = (filters.query || "").trim().toLocaleLowerCase();
  const days = { today: 1, week: 7, month: 30 }[filters.period];
  const start = days
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
    : null;
  return events.filter((event) => {
    if (filters.rule && filters.rule !== "all" && event.rule_code !== filters.rule) return false;
    if (filters.status === "pending" && !["pending_confirmation", "acknowledged"].includes(event.status)) return false;
    if (filters.status === "rectifying" && event.status !== "rectifying") return false;
    if (filters.status === "resolved" && event.status !== "resolved") return false;
    if (filters.status === "overdue" && !event.overdue) return false;
    if (filters.severity !== "all" && event.severity !== filters.severity) return false;
    if (start && (Number.isNaN(Date.parse(event.created_at)) || new Date(event.created_at) < start)) return false;
    if (query && ![event.id, event.title, event.rule_code, event.camera_name, event.assignee_name]
      .filter(Boolean).some((value) => value.toLocaleLowerCase().includes(query))) return false;
    return true;
  });
}

export function rectificationCsv(events) {
  const cell = (value) => {
    const raw = String(value ?? "");
    const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [
    ["事件ID", "规则", "异常类型", "严重度", "摄像头", "检测时间", "状态", "负责人", "截止时间"],
    ...events.map((event) => [
      event.id, event.rule_code, event.title, event.severity, event.camera_name,
      event.created_at, event.status, event.assignee_name, event.due_at,
    ]),
  ];
  return `\ufeff${rows.map((row) => row.map(cell).join(",")).join("\r\n")}`;
}
