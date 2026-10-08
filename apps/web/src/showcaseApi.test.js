import { describe, expect, it } from "vitest";
import { createShowcaseApi } from "./showcaseApi";

const snapshot = {
  meta: { captured_at: "2026-10-04T10:00:00+08:00" },
  bootstrap: { store: { name: "MOMOYO JTU" }, cameras: [] },
  dashboard: { metrics: { today_events: 0 }, camera_sources: [], recent_events: [] },
  events: [{ id: "EVT-1" }], runs: [{ id: "RUN-1" }],
  event_details: { "EVT-1": { id: "EVT-1", evidence: [] } },
  run_details: { "RUN-1": { id: "RUN-1", status: "completed" } },
  camera_details: { "CAM-1": { "7": { camera: { id: "CAM-1", status: "online" }, counts: { events: 1 }, events: [] } } },
  rules_config: { default_analysis_mode: "two_stage" },
};

describe("persistent showcase API", () => {
  const state = { events: {}, cameras: {}, newCameras: [], accounts: [{ id: "USER-ADMIN", role: "admin", active: true }], defaultAnalysisMode: null };
  const writes = [];
  const api = createShowcaseApi(async () => snapshot, async () => state, async (path, method, body) => { writes.push({ path, method, body }); return { state }; });

  it("serves dated snapshot data without a live backend", async () => {
    expect((await api.bootstrap()).snapshot_meta).toEqual(snapshot.meta);
    expect((await api.operationsConfig()).scene_candidates).toEqual([]);
    expect((await api.operationsConfig()).stores).toHaveLength(1);
    expect(await api.events()).toEqual(snapshot.events);
    expect((await api.run("RUN-1")).status).toBe("completed");
    expect((await api.cameraDetail("CAM-1", 7)).counts.events).toBe(1);
    expect(api.evidenceUrl("EV-1")).toContain("showcase/evidence/EV-1.jpg");
  });

  it("persists ordinary UI actions but keeps video analysis and external sends closed", async () => {
    await api.setCameraStatus("CAM-1", "offline");
    expect(writes.at(-1)).toEqual({ path: "cameras/CAM-1", method: "PATCH", body: { status: "offline" } });
    for (const method of ["feishuTestSend", "createRun", "uploadVideo"]) await expect(api[method]()).rejects.toThrow("暂未开放");
    expect(api.eventVideoUrl()).toBe("");
  });

  it("reports missing records", async () => {
    await expect(api.event("missing")).rejects.toThrow("没有事件记录");
  });
});
