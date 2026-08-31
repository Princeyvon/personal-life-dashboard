# Production deployment

Personal Life Dashboard is a full-stack React, Express, tRPC, and MySQL-compatible application. The managed WebDev project supplies the production runtime, database, built-in LLM gateway, and S3-backed storage. The application starts with `pnpm build` and `pnpm start`; production binds to the runtime-provided `PORT` and exposes `GET /healthz` for service checks.

## Standalone access

The dashboard uses a standalone PIN gate instead of Manus OAuth for interactive access. Configure the required server-side secret `DASHBOARD_PIN` in the project Secrets panel. The current configured PIN is the four-digit code supplied by the owner; it is never placed in client code, rendered in the UI, or stored in the database. The server compares PIN values in constant time, rate-limits repeated attempts per client address, and issues the existing signed `app_session_id` cookie for a 30-day session.

The previous OAuth callback is no longer registered, and legacy OAuth sessions are rejected by the request authenticator. The existing sign-out action clears the same session cookie. Scheduled Heartbeat callbacks continue to use their dedicated cron identity path. When the PIN owner enables Daily Rewind, Heartbeat job ownership uses the managed project-owner fallback rather than treating the PIN session as an OAuth user token.

## Required configuration

The managed project automatically provides `DATABASE_URL`, `JWT_SECRET`, `OWNER_NAME`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`. The project must also contain `DASHBOARD_PIN`. Keep all values in the project’s Secrets configuration and never commit a `.env` file. OAuth-related managed variables may remain provisioned by the template for platform cron identity support, but they are not used as the interactive dashboard login.

Google Calendar is optional. To enable it, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as server-side secrets in the Google Cloud OAuth client configuration. Register the exact callback URL shown by the deployed application as `/api/google-calendar/callback` on the same origin. When either credential is absent, the connect route returns a clear configuration message and the rest of the dashboard remains available; no Google token is written.

## Persistent data and uploads

Dashboard snapshots, structured workflows, the PIN-backed dashboard owner, calendar data, and Daily Rewind settings are stored in the managed database. Uploads are sent to `POST /api/uploads` as an authenticated JSON request with `filename`, `contentType`, and a base64-encoded `dataBase64` value. Supported document, image, and audio types are limited to 25 MB. The server stores the bytes in S3 under a user-scoped key and returns the durable `/manus-storage/...` URL plus metadata; file bytes are never stored in MySQL.

## Health validation

After deployment, request `GET /healthz`. A healthy response has HTTP status `200`, `status: "ok"`, and configuration indicators for database, storage, and LLM availability. These indicators are diagnostic only: the standalone PIN is required for interactive access, and optional Google Calendar credentials are intentionally not required for a healthy application.

## Local verification

Run the following commands before publishing changes:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
NODE_ENV=production PORT=3000 node dist/index.js
curl -fsS http://localhost:3000/healthz
```

The managed project’s Publish action should be used for the production release after the project checkpoint is saved. Autoscale is sufficient for this website because durable state lives in the managed database and S3. Choose Reserved hosting only if you later add an always-running worker or another workload that cannot tolerate scale-to-zero.
