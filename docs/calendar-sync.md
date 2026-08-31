# Calendar and Google Sync

The dashboard Calendar workspace is a user-scoped calendar view layered over two sources of events. Stored calendar events live in the `calendar_events` table and are isolated by the authenticated Manus user. Dashboard-derived deadlines and check-ins are shown alongside stored events so the calendar stays useful without duplicating every existing dashboard record.

## Google Calendar connection

The webapp uses Google OAuth with the following callback path:

```text
/api/google-calendar/callback
```

The required Google OAuth client variables are `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The OAuth flow requests Calendar read/write scope because the selected sync direction is two-way. Credentials are encrypted at rest with an AES-256-GCM key derived from the server session secret; plaintext tokens are never sent to the browser.

## Sync behavior

A dashboard-created event is written locally and, when Google is connected, created in the selected Google calendar. Editing or deleting a stored dashboard event with a Google event ID writes the corresponding change to Google first and then records the local result. The Calendar workspace’s **Sync now** action pulls the visible date range from Google and upserts by Google event ID.

For conflicts, Google is authoritative during an explicit pull sync for an event with the same Google event ID. A dashboard edit is sent to Google immediately, so the next pull reflects that write. Events cancelled or removed from Google are removed from the local synced set within the selected sync range. Dashboard-derived items remain managed by their source section and are not written back as duplicate Google events.

## User-facing states

The Calendar workspace exposes connection status, last sync time, sync progress, sync failures, empty periods, loading states, event details, and a clear distinction between Google, local, and dashboard-derived events. A user must add the exact deployed callback URL to the Google OAuth client’s authorized redirect URIs before selecting **Connect**.
