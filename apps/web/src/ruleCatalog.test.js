import { describe, expect, it } from "vitest";
import { p0Rules, ruleCatalog, ruleValidationLabel } from "./ruleCatalog";

describe("current rule capability catalog", () => {
  const byCode = (code) => ruleCatalog.find((rule) => rule.code === code);

  it("distinguishes a tested sample from production acceptance", () => {
    expect(byCode("A1")).toMatchObject({ stage: "sample_tested", severity: "P2" });
    expect(byCode("A1").evidence).toContain("2 条合成视频");
    expect(byCode("A1").notification).toContain("默认发送");
  });

  it("labels E1 as a P0 upload-video capability, not a live camera service", () => {
    expect(byCode("E1")).toMatchObject({ stage: "sample_tested", severity: "P0", gradeConfirmed: true });
    expect(byCode("E1").evidence).toContain("关门恢复");
  });

  it("keeps B1 intrinsically P0 while withholding automatic notification", () => {
    expect(byCode("B1")).toMatchObject({ stage: "sample_tested", severity: "P0" });
    expect(p0Rules.map((rule) => rule.code)).toEqual(["E1", "B1"]);
    expect(byCode("B1").notification).toContain("默认发送");
  });

  it("does not rank E1 above A1/B1 solely for having a tested workflow", () => {
    expect(["E1", "A1", "B1"].map((code) => byCode(code).stage)).toEqual([
      "sample_tested", "sample_tested", "sample_tested"
    ]);
  });

  it("keeps remaining hygiene grades explicitly provisional", () => {
    for (const code of ["A1", "A2", "C1", "A3", "A4"]) {
      expect(byCode(code).gradeConfirmed).not.toBe(true);
    }
  });

  it("keeps unimplemented candidates separate from event severity", () => {
    expect(byCode("G1")).toMatchObject({ stage: "research", plannedSeverity: "P2" });
    expect(byCode("G1").severity).toBeUndefined();
  });
});

it("shows actual M1 and G2 validation without implying production acceptance", () => {
 const m1=ruleCatalog.find(r=>r.code==="M1");
 const g2=ruleCatalog.find(r=>r.code==="G2");
 expect(ruleValidationLabel(m1)).toBe("真实视频正样本已验证");
 expect(m1.evidence).toContain("漏做告警尚待实测");
 expect(ruleValidationLabel(g2)).toBe("真实视频样本已验证");
 expect(g2.evidence).toContain("其他桌位尚未启用");
 expect(ruleValidationLabel(ruleCatalog.find(r=>r.code==="A2"))).toContain("尚无视频实测");
});
