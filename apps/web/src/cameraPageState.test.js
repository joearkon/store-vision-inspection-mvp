import { describe, expect, it } from "vitest";
import { cameraPageState } from "./cameraPageState";

describe("camera management load states", () => {
  it("shows a loading state only while the initial request is pending", () => {
    expect(cameraPageState(null, "")).toBe("loading");
  });

  it("shows a retryable error after a failed initial request", () => {
    expect(cameraPageState(null, "连接失败")).toBe("error");
  });

  it("keeps the page available when a later refresh fails", () => {
    expect(cameraPageState({ cameras: [] }, "连接失败")).toBe("ready");
  });
});
