import { describe, expect, it } from "vitest";
import { runCostText } from "./runCost";

describe("analysis-run cost labels", () => {
  it("shows priced usage as an estimate rather than a bill", () => {
    expect(runCostText({ cost_status: "estimated", estimated_cost_yuan: 0.014723 }))
      .toBe("约 ¥0.0147");
  });

  it("shows a range when the historical model was not saved", () => {
    expect(runCostText({ cost_status: "model_unrecorded", cost_range_yuan: [0.005431, 0.040848] }))
      .toBe("约 ¥0.0054–¥0.0408");
  });

  it("never turns missing historical usage into zero cost", () => {
    expect(runCostText({ status: "completed", cost_status: "usage_unrecorded" }))
      .toBe("用量未记录");
  });
});
