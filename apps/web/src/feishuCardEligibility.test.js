import { describe, expect, it } from "vitest";
import { eligibleFeishuEvents } from "./feishuCardEligibility";

const events = [
  { id: "E1-NEW", rule_code: "E1", severity: "P0" },
  { id: "B1-NEW", rule_code: "B1", severity: "P0" },
  { id: "E1-OLD", rule_code: "E1", severity: "P1" },
  { id: "B1-OLD", rule_code: "B1", severity: "P2" },
  { id: "A1", rule_code: "A1", severity: "P0" },
];

describe("Feishu card event eligibility", () => {
  it("shows only real E1/B1 P0 events in the P0 tab", () => {
    expect(eligibleFeishuEvents(events, "p0").map((event) => event.id)).toEqual(["E1-NEW", "B1-NEW"]);
  });

  it("keeps old E1/P1 separate and leaves SLA preview non-sendable", () => {
    expect(eligibleFeishuEvents(events, "p1").map((event) => event.id)).toEqual(["E1-OLD"]);
    expect(eligibleFeishuEvents(events, "sla")).toEqual([]);
  });
});

it("allows only A1/G2 P2 manual clues", () => {
  const rows=[{id:"mask",rule_code:"A1",severity:"P2"},{id:"table",rule_code:"G2",severity:"P2"},{id:"old",rule_code:"B1",severity:"P2"}];
  expect(eligibleFeishuEvents(rows,"p2").map(row=>row.id)).toEqual(["mask","table"]);
});
