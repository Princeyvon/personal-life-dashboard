import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { handleDashboardPinRequest, isDashboardPinConfigured, verifyDashboardPin, createDashboardPinSession } from "./pin";
import { sdk } from "./_core/sdk";
import { PIN_OPEN_ID } from "@shared/const";

type MockResponse = Response & {
  statusCode: number;
  payload: unknown;
  cookieArgs: unknown[] | null;
};

function createResponse(): MockResponse {
  const response = {
    statusCode: 200,
    payload: null,
    cookieArgs: null,
    status(statusCode: number) {
      response.statusCode = statusCode;
      return response;
    },
    json(payload: unknown) {
      response.payload = payload;
      return response;
    },
    cookie(...args: unknown[]) {
      response.cookieArgs = args;
      return response;
    },
  } as unknown as MockResponse;
  return response;
}

function createRequest(pin: unknown, ip: string): Request {
  return {
    body: { pin },
    headers: {},
    protocol: "https",
    ip,
  } as unknown as Request;
}

describe("dashboard PIN configuration", () => {
  it("recognizes and verifies the configured server-side PIN", () => {
    expect(isDashboardPinConfigured()).toBe(true);
    expect(verifyDashboardPin("3030")).toBe(true);
  });

  it("rejects incorrect and malformed PINs without revealing the configured value", () => {
    expect(verifyDashboardPin("3031")).toBe(false);
    expect(verifyDashboardPin(3030 as unknown as string)).toBe(false);
    expect(verifyDashboardPin("")).toBe(false);
  });

  it("accepts the supplied PIN through the unlock endpoint and sets an httpOnly session cookie", async () => {
    const response = createResponse();
    await handleDashboardPinRequest(createRequest("3030", "pin-test-success"), response);
    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual({ success: true });
    expect(response.cookieArgs?.[0]).toBe("app_session_id");
    expect(typeof response.cookieArgs?.[1]).toBe("string");
    expect(response.cookieArgs?.[2]).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 30 * 24 * 60 * 60 * 1000 });
  });

  it("creates a session token recognized as the PIN-backed dashboard identity", async () => {
    const token = await createDashboardPinSession();
    const session = await sdk.verifySession(token);
    expect(session?.openId).toBe(PIN_OPEN_ID);
  });

  it("allows the correct PIN to recover after invalid attempts from the same address", async () => {
    const address = "pin-test-recovery";
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const response = createResponse();
      await handleDashboardPinRequest(createRequest("0000", address), response);
      expect(response.statusCode).toBe(attempt < 6 ? 401 : 429);
    }

    const response = createResponse();
    await handleDashboardPinRequest(createRequest("3030", address), response);
    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual({ success: true });
  });

  it("returns a safe error for an incorrect PIN", async () => {
    const response = createResponse();
    await handleDashboardPinRequest(createRequest("0000", "pin-test-invalid"), response);
    expect(response.statusCode).toBe(401);
    expect(response.payload).toEqual({ success: false, error: "That PIN didn’t unlock the dashboard. Check it and try again." });
  });
});
