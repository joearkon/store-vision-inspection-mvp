import { describe, expect, it } from "vitest";
import { analysisElapsedSeconds, runOutcome, screeningCandidateCount } from "./runResult";

describe("analysis run result", () => {
  it("shows zero-event B1 as a scoped negative outcome", () => {
    expect(runOutcome({ status: "completed", rule_code: "B1", event_count: 0 })).toMatchObject({
      label: "未检出 B1 异常", tone: "clear"
    });
    expect(screeningCandidateCount({ screening_result_json: '{"segments":[]}' })).toBe(0);
  });

  it("reports events and failures without claiming a clean scene", () => {
    expect(runOutcome({ status: "completed", rule_code: "E1", event_count: 2 }).label).toBe("生成 2 条事件");
    expect(runOutcome({ status: "failed", error_message: "timeout" }).detail).toBe("timeout");
    expect(runOutcome({ status: "running", event_count: 0 }).label).toBe("尚未完成");
  });

  it("computes elapsed wall time from persisted timestamps", () => {
    expect(analysisElapsedSeconds({ started_at: "2026-09-28T20:00:00+08:00", completed_at: "2026-09-28T20:02:15+08:00" })).toBe(135);
    expect(analysisElapsedSeconds({ started_at: null, completed_at: null })).toBeNull();
    expect(analysisElapsedSeconds({ started_at: "bad", completed_at: "bad" })).toBeNull();
  });
});
