import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

describe("testing free access", () => {
  it("keeps temporary free access disabled by default", async () => {
    expect(ENV.dashboardFreeAccess).toBe(false);
    await expect(sdk.authenticateRequest({ headers: {} } as Request)).rejects.toThrow();
  });
});
