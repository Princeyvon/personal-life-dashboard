
## Authentication

The user-facing dashboard now uses a server-side PIN session. The initial PIN is supplied through the protected `PIN_LOGIN_INITIAL_PIN` environment variable and is not committed to the repository; the configured initial value for this deployment is `3030`. A successful PIN login resolves to `OWNER_OPEN_ID` when available, so existing user-scoped dashboard snapshots and normalized records remain attached to the same owner record. The server signs the existing HTTP-only session cookie and protected tRPC procedures continue to require `ctx.user`.

The Manus OAuth callback is no longer mounted as an application login route. The server SDK still contains its internal OAuth/JWT exchange support because Heartbeat callbacks and the paused Google Calendar integration use the existing platform session contract; this is not exposed as a user-facing sign-in option.
