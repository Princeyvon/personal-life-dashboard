import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, PIN_OPEN_ID } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const PIN_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 6;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const attemptsByAddress = new Map<string, { count: number; resetAt: number }>();

function normalizeAddress(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.ip || "unknown";
}

function canAttempt(address: string): boolean {
  const now = Date.now();
  const current = attemptsByAddress.get(address);
  if (!current || current.resetAt <= now) {
    attemptsByAddress.set(address, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

export function isDashboardPinConfigured(): boolean {
  return typeof ENV.dashboardPin === "string" && ENV.dashboardPin.length > 0;
}

export function verifyDashboardPin(input: unknown): boolean {
  if (!isDashboardPinConfigured() || typeof input !== "string") return false;
  const expected = Buffer.from(ENV.dashboardPin, "utf8");
  const received = Buffer.from(input, "utf8");
  if (expected.length === 0 || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(received, expected);
}

export async function createDashboardPinSession(): Promise<string> {
  return sdk.signSession(
    {
      openId: PIN_OPEN_ID,
      appId: ENV.appId || "personal-life-dashboard",
      name: ENV.ownerName || "Personal Life Dashboard",
    },
    { expiresInMs: PIN_SESSION_MAX_AGE_MS },
  );
}

function sendPinError(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

export async function handleDashboardPinRequest(req: Request, res: Response) {
  if (!isDashboardPinConfigured()) {
    return sendPinError(res, 503, "Dashboard access is not configured yet. Add DASHBOARD_PIN in project secrets.");
  }

  const address = normalizeAddress(req);
  if (!verifyDashboardPin(req.body?.pin)) {
    if (!canAttempt(address)) {
      return sendPinError(res, 429, "Too many attempts. Please wait a few minutes and try again.");
    }
    return sendPinError(res, 401, "That PIN didn’t unlock the dashboard. Check it and try again.");
  }
  attemptsByAddress.delete(address);

  try {
    const token = await createDashboardPinSession();
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, token, {
      ...cookieOptions,
      sameSite: "lax",
      maxAge: PIN_SESSION_MAX_AGE_MS,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("[PIN] Failed to create dashboard session", error);
    return sendPinError(res, 500, "The dashboard could not be unlocked. Please try again.");
  }
}

export function registerPinRoutes(app: Express): void {
  app.post("/api/auth/pin", handleDashboardPinRequest);
}
