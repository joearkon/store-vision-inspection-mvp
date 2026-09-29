import { describe, expect, it } from "vitest";
import { cameraAreaNames, dashboardCameraIds, demoCameraImages } from "./cameraMedia";

describe("demo camera media", () => {
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
});
