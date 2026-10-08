import { describe, expect, it } from "vitest";
import { cameraAreaNames, dashboardCameraIds, dashboardCameraSummary, demoCameraImages } from "./cameraMedia";

describe("demo camera media", () => {
  it('shows real fixed cameras first when uploaded stills exist',()=>{
    const result=dashboardCameraSummary([{id:'CAM-MOMOYO-REAL-TABLE',status:'online',preview_image_url:'/showcase/findings/F.jpg'},...dashboardCameraIds.map(id=>({id,status:'online'}))]);
    expect(result.visible[0].id).toBe('CAM-MOMOYO-REAL-TABLE');expect(result.total).toBe(4);
  });
  it("has labeled local stills for every configured source area", () => {
    expect(Object.keys(demoCameraImages).sort()).toEqual(Object.keys(cameraAreaNames).sort());
    for (const path of Object.values(demoCameraImages)) {
      expect(path).toMatch(/^\/demo-cameras\//);
    }
  });

  it("keeps the four prototype mosaic areas without hiding the storage source", () => {
    expect(dashboardCameraIds).toEqual([
      "CAM-FRONT-01", "CAM-BACK-01", "CAM-DINING-01", "CAM-PICKUP-01"
    ]);
    expect(demoCameraImages.storage).toBeTruthy();
  });

  it("counts only the four displayed sources in the dashboard KPI", () => {
    const cameras = [
      ...dashboardCameraIds.map((id) => ({ id, status: id === "CAM-PICKUP-01" ? "offline" : "online" })),
      { id: "CAM-STORAGE-01", status: "online" },
    ];
    expect(dashboardCameraSummary(cameras)).toMatchObject({ enabled: 3, total: 4 });
    expect(dashboardCameraSummary(cameras).visible).toHaveLength(4);
  });
});
