export function filterAnalysisRuns(runs, filters, now = new Date()) {
  const query = (filters.query || "").trim().toLocaleLowerCase();
  const days = { today: 1, week: 7, month: 30 }[filters.period];
  const start = days
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
    : null;
  return runs.filter((run) => {
    if (filters.status === "completed" && run.status !== "completed") return false;
    if (filters.status === "active" && !["queued", "running"].includes(run.status)) return false;
    if (filters.status === "failed" && run.status !== "failed") return false;
    if (filters.status === "awaiting_approval" && run.status !== "awaiting_approval") return false;
    if (filters.rule !== "all" && (run.rule_code || "E1") !== filters.rule) return false;
    if (['pass','fail','review','need_photo'].includes(filters.outcome) && (run.media_type!=='image'||run.conclusion!==filters.outcome)) return false;
    if (['event','zero'].includes(filters.outcome)&&run.media_type==='image') return false;
    if (filters.outcome === "event" && !(run.status === "completed" && Number(run.event_count || 0) > 0)) return false;
    if (filters.outcome === "zero" && !(run.status === "completed" && Number(run.event_count || 0) === 0)) return false;
    if (start && (Number.isNaN(Date.parse(run.created_at)) || new Date(run.created_at) < start)) return false;
    if (query && ![run.id, run.original_name, run.rule_code, run.camera_id,run.store]
      .filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(query))) return false;
    return true;
  });
}
