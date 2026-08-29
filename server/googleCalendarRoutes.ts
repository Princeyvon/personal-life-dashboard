import type { Express, Request, Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookie } from "cookie";
import { sdk } from "./_core/sdk";
import { getGoogleAuthorizationUrl, getGoogleRedirectUri, exchangeGoogleCode, encryptCredentials } from "./googleCalendar";
import { saveCalendarConnection } from "./calendarDb";
import { getUserById } from "./db";

const STATE_COOKIE = "google_calendar_oauth_state";

function signState(payload: string) {
  return createHmac("sha256", process.env.JWT_SECRET || "calendar-development-key").update(payload).digest("base64url");
}

function validState(received: string | undefined, expected: string | undefined) {
  if (!received || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

function isSecure(req: Request) {
  return req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0] === "https";
}

export function registerGoogleCalendarRoutes(app: Express) {
  app.get("/api/google-calendar/connect", async (req: Request, res: Response) => {
    try {
      let user;
      try {
        user = await sdk.authenticateRequest(req);
      } catch {
        return res.redirect("/");
      }
      if (!user) return res.redirect("/");
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).send("Google Calendar is not configured yet.");
      const nonce = randomBytes(24).toString("base64url");
      const payload = `${user.id}.${nonce}`;
      const state = `${payload}.${signState(payload)}`;
      res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: isSecure(req), sameSite: "lax", maxAge: 10 * 60 * 1000, path: "/" });
      return res.redirect(getGoogleAuthorizationUrl(state, getGoogleRedirectUri(req)));
    } catch (error) {
      console.error("[Google Calendar] Connect failed:", error);
      return res.status(500).send("Unable to start Google Calendar authorization.");
    }
  });

  app.get("/api/google-calendar/callback", async (req: Request, res: Response) => {
    try {
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const cookieState = parseCookie(req.headers.cookie || "")[STATE_COOKIE];
      const parts = state.split(".");
      const nonce = parts[1];
      const signature = parts[2];
      const payload = parts.slice(0, 2).join(".");
      const expectedState = nonce && signature ? `${payload}.${signState(payload)}` : "";
      const stateUserId = Number(parts[0]);
      const user = Number.isInteger(stateUserId) && stateUserId > 0 ? await getUserById(stateUserId) : undefined;
      res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: isSecure(req), sameSite: "lax", path: "/" });
      if (!user || !validState(cookieState, expectedState)) return res.status(400).send("Google Calendar authorization could not be verified. Please try connecting again.");
      if (typeof req.query.error === "string") return res.redirect(`${getGoogleRedirectUri(req).replace("/api/google-calendar/callback", "")}/?calendar=denied`);
      const code = typeof req.query.code === "string" ? req.query.code : "";
      if (!code) return res.status(400).send("Google did not return an authorization code.");
      const credentials = await exchangeGoogleCode(code, getGoogleRedirectUri(req));
      if (!credentials.refresh_token && !credentials.access_token) return res.status(400).send("Google did not return usable Calendar credentials.");
      const expiryDate = credentials.expiry_date ? new Date(credentials.expiry_date) : credentials.expires_in ? new Date(Date.now() + credentials.expires_in * 1000) : null;
      await saveCalendarConnection(user.id, encryptCredentials(credentials), expiryDate, "primary");
      return res.redirect(`${getGoogleRedirectUri(req).replace("/api/google-calendar/callback", "")}/?calendar=connected`);
    } catch (error) {
      console.error("[Google Calendar] Callback failed:", error);
      return res.status(500).send("Google Calendar could not be connected. Please try again.");
    }
  });
}
