# Standalone PIN UI Audit

The preview now shows the standalone PIN gate instead of the legacy OAuth flow when no valid PIN session is present. The mobile layout uses a stacked dark editorial story panel followed by the unlock form, with readable contrast, a four-digit numeric input, visible field labeling, inline guidance, and a full-width touch-sized unlock control.

Browser verification entered the supplied PIN through the unlock form and successfully loaded the existing dashboard. The unlocked view preserved the original dashboard composition and data-backed cards, including the life score, Today categories, balance chart, coach panel, and mobile navigation behavior. The server-issued cookie was also validated independently against the existing tRPC auth.me endpoint.

The legacy OAuth route is no longer registered, and non-PIN/non-cron sessions are rejected by the request authenticator. Scheduled callbacks retain the existing cron branch, while Daily Rewind uses the project-owner Heartbeat fallback for PIN sessions.
The live browser session also verified the explicit Lock dashboard control: selecting it cleared the PIN session and returned the interface to the standalone unlock screen.
