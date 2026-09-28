import { describe, expect, it } from "vitest";
import { formatDuration, percent, statusLabel, timelinePercent } from "./utils";

describe("display utilities", () => {
  it("formats seconds and minutes", () => {
    expect(formatDuration(30)).toBe("30 秒");
    expect(formatDuration(90)).toBe("1 分 30 秒");
  });

  it("formats confidence as a percent", () => {
    expect(percent(0.912)).toBe("91%");
  });

  it("uses the canonical event labels", () => {
    expect(statusLabel("pending_confirmation")).toBe("待确认");
    expect(statusLabel("rectifying")).toBe("整改中");
    expect(statusLabel("awaiting_approval")).toBe("等待确认");
  });

  it("positions and clamps event markers on a video timeline", () => {
    expect(timelinePercent(30, 50)).toBe(60);
    expect(timelinePercent(-1, 50)).toBe(0);
    expect(timelinePercent(60, 50)).toBe(100);
    expect(timelinePercent(10, 0)).toBe(0);
  });
});
