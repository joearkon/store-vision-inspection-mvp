import { describe, expect, it } from "vitest";
import { filterAnalysisRuns } from "./runList";

const runs = [
  { id: "RUN-E1", original_name: "fridge.mp4", rule_code: "E1", status: "completed", event_count: 1, created_at: "2026-09-29T09:00:00+08:00" },
  { id: "RUN-A1", original_name: "gloves.mp4", rule_code: "A1", status: "completed", event_count: 0, created_at: "2026-09-29T10:00:00+08:00" },
  { id: "RUN-B1", original_name: "smoke.mp4", rule_code: "B1", status: "failed", event_count: 0, created_at: "2026-09-20T09:00:00+08:00" },
  { id: "RUN-PAUSE", original_name: "pending.mp4", rule_code: "E1", status: "awaiting_approval", event_count: 0, created_at: "2026-09-29T11:00:00+08:00" },
  { id: "RUN-WORK", original_name: "working.mp4", rule_code: "B1", status: "running", event_count: 0, created_at: "2026-09-29T12:00:00+08:00" },
];

const base = { status: "all", rule: "all", outcome: "all", period: "all", query: "" };
const now = new Date("2026-09-29T15:00:00+08:00");

describe("analysis run list", () => {
  it("combines status, rule, outcome, period, and text search", () => {
    expect(filterAnalysisRuns(runs, { ...base, status: "completed", rule: "E1", outcome: "event", period: "today", query: "fridge" }, now).map((run) => run.id)).toEqual(["RUN-E1"]);
    expect(filterAnalysisRuns(runs, { ...base, outcome: "zero" }, now).map((run) => run.id)).toEqual(["RUN-A1"]);
    expect(filterAnalysisRuns(runs, { ...base, status: "active" }, now).map((run) => run.id)).toEqual(["RUN-WORK"]);
    expect(filterAnalysisRuns(runs, { ...base, status: "awaiting_approval" }, now).map((run) => run.id)).toEqual(["RUN-PAUSE"]);
    expect(filterAnalysisRuns(runs, { ...base, period: "today", rule: "B1" }, now).map((run) => run.id)).toEqual(["RUN-WORK"]);
  });

  it("does not label failed or running jobs as zero-event conclusions", () => {
    expect(filterAnalysisRuns(runs, { ...base, status: "failed", outcome: "zero" }, now)).toEqual([]);
    expect(filterAnalysisRuns(runs, { ...base, outcome: "event", query: "RUN-E1" }, now).map((run) => run.id)).toEqual(["RUN-E1"]);
  });
});
