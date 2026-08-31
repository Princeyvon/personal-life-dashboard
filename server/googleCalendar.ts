import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Request } from "express";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

type GoogleCredentials = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  expiry_date?: number;
};

type GoogleEvent = {
  id?: string;
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

function encryptionKey() {
  return createHash("sha256").update(process.env.JWT_SECRET || "calendar-development-key").digest();
}

export function encryptCredentials(credentials: GoogleCredentials) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptCredentials(value: string): GoogleCredentials {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Google Calendar credentials");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
  return JSON.parse(decrypted) as GoogleCredentials;
}

export function getPublicOrigin(req: Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "https").split(",")[0];
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0];
  return `${forwardedProto}://${forwardedHost}`;
}

export function getGoogleRedirectUri(req: Request) {
  return `${getPublicOrigin(req)}/api/google-calendar/callback`;
}

export function getGoogleAuthorizationUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: CALENDAR_SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function googleJson<T>(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error_description === "string" ? body.error_description : typeof body?.error?.message === "string" ? body.error.message : `Google Calendar request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  return googleJson<GoogleCredentials>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
}

export async function refreshGoogleCredentials(credentials: GoogleCredentials) {
  if (credentials.access_token && (!credentials.expiry_date || credentials.expiry_date > Date.now() + 60_000)) return credentials;
  if (!credentials.refresh_token) throw new Error("Google Calendar authorization has expired. Reconnect your account.");
  const refreshed = await googleJson<GoogleCredentials>(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: credentials.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  return { ...credentials, ...refreshed, refresh_token: refreshed.refresh_token || credentials.refresh_token, expiry_date: Date.now() + Number(refreshed.expires_in || 3600) * 1000 };
}

export function googleEventToCalendarEvent(event: GoogleEvent) {
  if (!event.id || !event.start || !event.end || event.status === "cancelled") return null;
  const allDay = Boolean(event.start.date && event.end.date);
  const startAt = new Date(event.start.dateTime || `${event.start.date}T00:00:00.000Z`);
  const endAt = new Date(event.end.dateTime || `${event.end.date}T00:00:00.000Z`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return null;
  return {
    googleEventId: event.id,
    title: event.summary || "Untitled event",
    description: event.description || null,
    location: event.location || null,
    startAt,
    endAt,
    allDay: allDay ? 1 : 0,
    etag: event.etag || null,
  };
}

export function calendarEventToGoogleEvent(event: { title: string; description?: string | null; location?: string | null; startAt: Date; endAt: Date; allDay: number }) {
  if (event.allDay) {
    return {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      start: { date: event.startAt.toISOString().slice(0, 10) },
      end: { date: event.endAt.toISOString().slice(0, 10) },
    };
  }
  return {
    summary: event.title,
    description: event.description || undefined,
    location: event.location || undefined,
    start: { dateTime: event.startAt.toISOString() },
    end: { dateTime: event.endAt.toISOString() },
  };
}

export async function listGoogleEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string) {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });
  const body = await googleJson<{ items?: GoogleEvent[] }>(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return body.items || [];
}

export async function createGoogleEvent(accessToken: string, calendarId: string, event: Parameters<typeof calendarEventToGoogleEvent>[0]) {
  return googleJson<GoogleEvent>(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(calendarEventToGoogleEvent(event)),
  });
}

export async function updateGoogleEvent(accessToken: string, calendarId: string, googleEventId: string, event: Parameters<typeof calendarEventToGoogleEvent>[0]) {
  return googleJson<GoogleEvent>(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(calendarEventToGoogleEvent(event)),
  });
}

export async function deleteGoogleEvent(accessToken: string, calendarId: string, googleEventId: string) {
  const response = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok && response.status !== 404) throw new Error(`Google Calendar delete failed (${response.status})`);
}
