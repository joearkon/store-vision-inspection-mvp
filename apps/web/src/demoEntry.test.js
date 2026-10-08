import { describe, expect, it } from "vitest";
import { demoEntryState, demoReturnRoute } from "./demoEntry";

describe("standalone demo login routing", () => {
  it("blocks the app shell until an active account is selected", () => {
    expect(demoEntryState({ showcase: true, actorId: null, currentUser: null, routePage: "dashboard", loading: false })).toBe("login");
    expect(demoEntryState({ showcase: true, actorId: "USER-ADMIN", currentUser: null, routePage: "dashboard", loading: true })).toBe("loading");
    expect(demoEntryState({ showcase: true, actorId: "USER-ADMIN", currentUser: { role: "admin" }, routePage: "dashboard", loading: false })).toBe("app");
    expect(demoEntryState({ showcase: true, actorId: "USER-ADMIN", currentUser: { role: "admin" }, routePage: "login", loading: false })).toBe("login");
  });

  it("returns only to known in-app routes", () => {
    expect(demoReturnRoute("#/event/EVT-1")).toBe("#/event/EVT-1");
    expect(demoReturnRoute("#/login")).toBe("#/dashboard");
    expect(demoReturnRoute("https://example.com")).toBe("#/dashboard");
  });
});
