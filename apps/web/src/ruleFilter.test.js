import { describe, it, expect } from "vitest";
import { ruleCatalog, ruleFilterLabel } from "./ruleCatalog";
describe("rule filter labels", () => {
  it("keeps every rule code and its catalog name visible", () => {
    for (const rule of ruleCatalog) expect(ruleFilterLabel(rule.code)).toBe(`${rule.code} · ${rule.name}`);
  });
  it("handles all rules and unknown historical codes", () => {
    expect(ruleFilterLabel("all")).toBe("全部规则");
    expect(ruleFilterLabel("X9")).toBe("X9");
  });
});
