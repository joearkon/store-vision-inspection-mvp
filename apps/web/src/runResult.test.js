import { describe, expect, it } from "vitest";
import { analysisModeLabel, analysisElapsedSeconds, runOutcome, screeningCandidateCount } from "./runResult";

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

it("shows cleaning compliance separately from zero events", () => {
 expect(runOutcome({status:"completed",event_count:0,cleaning_check:{verdict:"observed_mopping",explanation:"已观察到拖地"}}).label).toBe("开店拖地检查通过");
 expect(runOutcome({status:"completed",event_count:0,cleaning_check:{verdict:"insufficient_evidence",explanation:"短片"}}).tone).toBe("pending");
});


describe("fallback audit", () => {
  it("uses accumulated processing time without approval waiting", () => {
    expect(analysisElapsedSeconds({active_seconds:180, started_at:"2026-10-06T00:00:00Z",completed_at:"2026-10-06T02:00:00Z"})).toBe(180);
  });
});

it("labels fallback and preserves historic total elapsed instead of only final attempt", () => {
 expect(analysisModeLabel({analysis_mode:"two_stage",fallback_approved:1})).toBe("双层 → 逐帧回退");
 expect(analysisElapsedSeconds({fallback_approved:1,created_at:"2026-10-06T00:00:00Z",started_at:"2026-10-06T00:01:00Z",completed_at:"2026-10-06T00:02:00Z"})).toBe(120);
});
