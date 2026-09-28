export const openStatuses = new Set(["pending_confirmation", "acknowledged", "rectifying"]);

export function workorderCounts(events) {
  return {
    all: events.length,
    pending: events.filter((event) => ["pending_confirmation", "acknowledged"].includes(event.status)).length,
    in_progress: events.filter((event) => event.status === "rectifying").length,
    overdue: events.filter((event) => openStatuses.has(event.status) && event.overdue).length,
    resolved: events.filter((event) => event.status === "resolved").length,
  };
}

export function filterWorkorders(events, filter) {
  if (filter === "all") return events;
  if (filter === "pending") return events.filter((event) => ["pending_confirmation", "acknowledged"].includes(event.status));
  if (filter === "in_progress") return events.filter((event) => event.status === "rectifying");
  if (filter === "overdue") return events.filter((event) => openStatuses.has(event.status) && event.overdue);
  if (filter === "resolved") return events.filter((event) => event.status === "resolved");
  return [];
}

export function storeHealth(events) {
  const open = events.filter((event) => openStatuses.has(event.status));
  if (open.some((event) => event.overdue || event.severity === "P0")) return "严重";
  return open.length ? "告警" : "良好";
}
