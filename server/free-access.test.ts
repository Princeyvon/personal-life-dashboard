import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { PIN_OPEN_ID } from "@shared/const";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("testing free access", () => {
  it("resolves the stable dashboard owner without a PIN session when enabled", async () => {
    expect(ENV.dashboardFreeAccess).toBe(true);

    const user = await sdk.authenticateRequest({ headers: {} } as Request);

    expect(user.openId).toBe(PIN_OPEN_ID);
    expect(user.role).toBe("admin");
  });
});
