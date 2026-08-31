import { describe, expect, it } from "vitest";
import { buildAuthState } from "./useAuth";

describe("PIN auth client state", () => {
  it("starts unauthenticated while the session is loading", () => {
    const state = buildAuthState(null, true, null);
    expect(state.user).toBeNull();
    expect(state.loading).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  it("becomes authenticated when auth.me returns the PIN-backed user", () => {
    const user = { openId: "pin-dashboard-owner", name: "Dashboard Owner" };
    const state = buildAuthState(user, false, null);
    expect(state.user).toEqual(user);
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(true);
  });
});
