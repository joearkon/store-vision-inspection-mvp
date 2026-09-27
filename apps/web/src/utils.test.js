import { describe, expect, it } from "vitest";
import { formatDuration, percent, statusLabel } from "./utils";

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
  });
});
