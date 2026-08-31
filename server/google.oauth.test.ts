import { describe, expect, it } from "vitest";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

describe("Google OAuth configuration", () => {
  it.skipIf(!clientId || !clientSecret)("is accepted by Google’s token endpoint as a configured client", async () => {
    expect(clientId).toBeTruthy();
    expect(clientSecret).toBeTruthy();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code: "validation-only-invalid-code",
        grant_type: "authorization_code",
        redirect_uri: process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/google-calendar/callback",
      }),
    });

    const body = await response.json().catch(() => ({}));
    expect(response.status).not.toBe(401);
    expect(body.error).not.toBe("invalid_client");
  }, 15_000);
});
