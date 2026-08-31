# Production deployment

Personal Life Dashboard is a full-stack React, Express, tRPC, and MySQL-compatible application. The managed WebDev project supplies the production runtime, database, built-in LLM gateway, and S3-backed storage. The application starts with `pnpm build` and `pnpm start`; production binds to the runtime-provided `PORT` and exposes `GET /healthz` for service checks.

## Standalone access

The dashboard retains its standalone PIN authentication implementation, but **testing free access is enabled by default for the current testing phase**. With `DASHBOARD_FREE_ACCESS` unset or set to `true`, the server supplies the stable PIN-owner identity to protected procedures without requiring a PIN or session cookie, so the dashboard opens directly and existing persistence, uploads, and feature routes keep their normal user scope.

This mode is intentionally temporary and must not be used for a publicly shared or production dashboard because anyone who can reach the URL can access the dashboard data. Restore the PIN gate by setting the server-side secret `DASHBOARD_FREE_ACCESS=false` and configuring `DASHBOARD_PIN`. The PIN remains server-only, is compared in constant time, rate-limited per client address, and issues the existing signed `app_session_id` cookie for a 30-day session.

The previous OAuth callback is no longer registered, and legacy OAuth sessions are rejected by the request authenticator. Scheduled Heartbeat callbacks continue to use their dedicated cron identity path. When the PIN owner enables Daily Rewind, Heartbeat job ownership uses the managed project-owner fallback rather than treating the PIN session as an OAuth user token.

## Required configuration

The managed project automatically provides `DATABASE_URL`, `JWT_SECRET`, `OWNER_NAME`, `BUILT_IN_FORGE_API_URL`, and `BUILT_IN_FORGE_API_KEY`. During testing, `DASHBOARD_FREE_ACCESS` may remain unset because the application defaults it to `true`. Before sharing the dashboard, set `DASHBOARD_FREE_ACCESS=false` and add `DASHBOARD_PIN` in the project Secrets panel. Keep all values in Secrets configuration and never commit a `.env` file. OAuth-related managed variables may remain provisioned by the template for platform cron identity support, but they are not used as the interactive dashboard login.

Google Calendar is optional. To enable it, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as server-side secrets in the Google Cloud OAuth client configuration. Register the exact callback URL shown by the deployed application as `/api/google-calendar/callback` on the same origin. When either credential is absent, the connect route returns a clear configuration message and the rest of the dashboard remains available; no Google token is written.

## Persistent data and uploads

Dashboard snapshots, structured workflows, the PIN-backed dashboard owner, calendar data, and Daily Rewind settings are stored in the managed database. Uploads are sent to `POST /api/uploads` as an authenticated JSON request with `filename`, `contentType`, and a base64-encoded `dataBase64` value. Supported document, image, and audio types are limited to 25 MB. The server stores the bytes in S3 under a user-scoped key and returns the durable `/manus-storage/...` URL plus metadata; file bytes are never stored in MySQL.

## Health validation

After deployment, request `GET /healthz`. A healthy response has HTTP status `200`, `status: "ok"`, and configuration indicators for database, storage, and LLM availability. These indicators are diagnostic only: interactive access is intentionally open while `DASHBOARD_FREE_ACCESS` is enabled; restore `DASHBOARD_FREE_ACCESS=false` before treating the deployment as private. Optional Google Calendar credentials are intentionally not required for a healthy application.

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
