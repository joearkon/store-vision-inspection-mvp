import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

describe("api client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the backend port during local development", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ metrics: {}, recent_events: [] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    await api.dashboard();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8797/api/dashboard",
      {}
    );
  });

  it("reports an invalid HTML API response instead of loading forever", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!doctype html>", {
        status: 200,
        headers: { "content-type": "text/html" }
      })
    );

    await expect(api.dashboard()).rejects.toThrow("接口返回格式异常");
  });

  it("builds evidence URLs against the local backend", () => {
    expect(api.evidenceUrl("EVD-1")).toBe(
      "http://127.0.0.1:8797/api/media/evidence/EVD-1"
    );
  });

  it("builds original event video URLs against the local backend", () => {
    expect(api.eventVideoUrl("EVT-1")).toBe(
      "http://127.0.0.1:8797/api/media/events/EVT-1/video"
    );
  });
});
