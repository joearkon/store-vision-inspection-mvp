import { describe, expect, it } from "vitest";
import { filterWorkorders, storeHealth, workorderCounts } from "./workorder";

const events = [
  { id: "1", status: "pending_confirmation", overdue: 1, severity: "P1" },
  { id: "2", status: "acknowledged", overdue: 0, severity: "P2" },
  { id: "3", status: "rectifying", overdue: 0, severity: "P1" },
  { id: "4", status: "resolved", overdue: 0, severity: "P0" },
];

describe("real-event work-order projections", () => {
  it("counts and filters events without manufacturing work-order records", () => {
    expect(workorderCounts(events)).toEqual({ all: 4, pending: 2, in_progress: 1, overdue: 1, resolved: 1 });
    expect(filterWorkorders(events, "pending").map((event) => event.id)).toEqual(["1", "2"]);
    expect(filterWorkorders(events, "overdue").map((event) => event.id)).toEqual(["1"]);
    expect(filterWorkorders(events, "resolved").map((event) => event.id)).toEqual(["4"]);
  });
  it("only uses open events for the interim store status", () => {
    expect(storeHealth(events)).toBe("严重");
    expect(storeHealth([{ id: "4", status: "resolved", overdue: 0, severity: "P0" }])).toBe("良好");
  });
});
