import { describe, expect, it } from "vitest";
import { filterRectificationEvents, rectificationCsv } from "./rectification";

const events = [
  { id: "EVT-1", title: "冰箱门持续开启", rule_code: "E1", camera_name: "仓储-01", assignee_name: "总部巡检管理员", severity: "P1", status: "acknowledged", overdue: 1, created_at: "2026-09-28T09:00:00+08:00" },
  { id: "EVT-2", title: "口罩不合规", rule_code: "A1", camera_name: "前台-01", severity: "P2", status: "rectifying", overdue: 0, created_at: "2026-09-20T09:00:00+08:00" },
  { id: "EVT-3", title: "旧事件", rule_code: "E1", camera_name: "仓储-01", severity: "P1", status: "resolved", overdue: 0, created_at: "2026-08-01T09:00:00+08:00" },
];

describe("rectification list", () => {
  const now = new Date("2026-09-28T15:00:00+08:00");
  it("filters status, severity, period and search together", () => {
    expect(filterRectificationEvents(events, { status: "pending", severity: "P1", period: "today", query: "仓储" }, now).map((e) => e.id)).toEqual(["EVT-1"]);
    expect(filterRectificationEvents(events, { status: "overdue", severity: "all", period: "all", query: "" }, now).map((e) => e.id)).toEqual(["EVT-1"]);
    expect(filterRectificationEvents(events, { status: "rectifying", severity: "all", period: "all", query: "a1" }, now).map((e) => e.id)).toEqual(["EVT-2"]);
  });
  it("exports the filtered rows with Chinese headers and spreadsheet-safe quoting", () => {
    const csv = rectificationCsv([{ ...events[0], title: '门开"未关', assignee_name: "=HYPERLINK(\"https://example.invalid\")" }]);
    expect(csv.startsWith("\ufeff\"事件ID\"")).toBe(true);
    expect(csv).toContain('"门开""未关"');
    expect(csv).toContain('"\'=HYPERLINK(');
    expect(csv).not.toContain("EVT-2");
  });
});
