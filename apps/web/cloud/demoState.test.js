import { describe, expect, it } from "vitest";
import { initialState, applyEventAction, applyCameraChange, applyRuleChange, applyAccountChange } from "./demoState";

const snapshot = {
  bootstrap: { store: { id: "STORE-JTU" }, cameras: [{ id: "CAM-1", code: "FRONT-01", status: "online" }] },
  event_details: { "EVT-1": { id: "EVT-1", status: "pending_confirmation", assignee_id: null, assignee_name: null } },
  rules_config: { profiles: [{ id: "two_stage" }, { id: "frame_baseline" }] },
};

describe("Cloud demo permissions and state transitions", () => {
  it("viewer cannot mutate and admin can confirm then assign", () => {
    expect(() => applyEventAction(initialState(), snapshot, "EVT-1", { action: "acknowledge" }, "USER-VIEWER")).toThrow("没有此操作权限");
    const state = applyEventAction(initialState(), snapshot, "EVT-1", { action: "acknowledge" }, "USER-ADMIN");
    expect(state.events["EVT-1"].status).toBe("acknowledged");
    applyEventAction(state, snapshot, "EVT-1", { action: "assign", note: "请整改", assignee_id: "USER-OPERATOR" }, "USER-ADMIN");
    expect(state.events["EVT-1"].assignee_name).toBe("巡检员");
    expect(state.events["EVT-1"].timeline).toHaveLength(2);
    expect(() => applyEventAction(state, snapshot, "EVT-1", { action: "resolve", note: "完成" }, "USER-ADMIN")).toThrow("不允许");
  });

  it("operator may toggle but only admin may add cameras and change rules", () => {
    const state = initialState();
    applyCameraChange(state, snapshot, { status: "offline" }, "USER-OPERATOR", "CAM-1");
    expect(state.cameras["CAM-1"]).toBe("offline");
    expect(() => applyCameraChange(state, snapshot, { name: "仓储", code: "STORAGE-02", area_type: "storage" }, "USER-OPERATOR")).toThrow("没有此操作权限");
    applyCameraChange(state, snapshot, { name: "仓储", code: "STORAGE-02", area_type: "storage" }, "USER-ADMIN");
    expect(state.newCameras).toHaveLength(1);
    expect(() => applyRuleChange(state, snapshot, "two_stage", "USER-OPERATOR")).toThrow("没有此操作权限");
    applyRuleChange(state, snapshot, "frame_baseline", "USER-ADMIN");
    expect(state.defaultAnalysisMode).toBe("frame_baseline");
  });

  it("keeps one active admin and allows new demonstration accounts", () => {
    const state = initialState();
    expect(() => applyAccountChange(state, { active: false }, "USER-ADMIN", "USER-ADMIN")).toThrow("不能停用");
    applyAccountChange(state, { username: "manager02", display_name: "门店经理", role: "operator" }, "USER-ADMIN");
    expect(state.accounts.at(-1).display_name).toBe("门店经理");
    expect(() => applyAccountChange(state, { role: "admin" }, "USER-VIEWER", state.accounts.at(-1).id)).toThrow("没有此操作权限");
  });
});
