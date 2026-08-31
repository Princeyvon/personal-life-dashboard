import { describe, expect, it } from "vitest";
import { calendarEventToGoogleEvent, decryptCredentials, encryptCredentials, googleEventToCalendarEvent } from "./googleCalendar";

describe("Google Calendar event boundary", () => {
  it("maps a timed Google event into a user calendar event", () => {
    const mapped = googleEventToCalendarEvent({
      id: "google-1",
      etag: "etag-1",
      summary: "Planning session",
      description: "Quarterly planning",
      location: "Library",
      start: { dateTime: "2026-09-24T10:00:00Z" },
      end: { dateTime: "2026-09-24T11:00:00Z" },
    });
    expect(mapped).toMatchObject({ googleEventId: "google-1", title: "Planning session", allDay: 0, etag: "etag-1" });
    expect(mapped?.startAt.toISOString()).toBe("2026-09-24T10:00:00.000Z");
  });

  it("round-trips encrypted Google credentials without exposing plaintext", () => {
    const credentials = { access_token: "access-token", refresh_token: "refresh-token", expiry_date: 1_800_000_000_000 };
    const encrypted = encryptCredentials(credentials);
    expect(encrypted).not.toContain("access-token");
    expect(decryptCredentials(encrypted)).toEqual(credentials);
  });

  it("maps all-day events to Google date fields", () => {
    const mapped = calendarEventToGoogleEvent({ title: "Birthday", description: null, location: null, startAt: new Date("2026-09-24T00:00:00Z"), endAt: new Date("2026-09-25T00:00:00Z"), allDay: 1 });
    expect(mapped.start).toEqual({ date: "2026-09-24" });
    expect(mapped.end).toEqual({ date: "2026-09-25" });
  });
});
