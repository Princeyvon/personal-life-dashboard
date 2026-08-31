import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./health";
import { validateUpload } from "./uploads";

describe("production health", () => {
  it("reports required service configuration without exposing secrets", () => {
    const status = getHealthStatus({
      DATABASE_URL: "mysql://configured",
      BUILT_IN_FORGE_API_URL: "https://forge.example",
      BUILT_IN_FORGE_API_KEY: "server-only-key",
    });

    expect(status).toMatchObject({
      status: "ok",
      service: "personal-life-dashboard",
      databaseConfigured: true,
      storageConfigured: true,
      llmConfigured: true,
    });
    expect(JSON.stringify(status)).not.toContain("server-only-key");
  });
});

describe("upload validation", () => {
  it("accepts supported small image and recorded-audio payloads", () => {
    expect(validateUpload({ contentType: "image/png", dataBase64: "aGVsbG8=" })).toEqual({ ok: true });
    expect(validateUpload({ contentType: "audio/webm", dataBase64: "aGV1ZGlv" })).toEqual({ ok: true });
  });

  it("rejects unsupported file types and malformed payloads", () => {
    expect(validateUpload({ contentType: "application/x-shockwave-flash", dataBase64: "aGVsbG8=" }).ok).toBe(false);
    expect(validateUpload({ contentType: "image/png", dataBase64: "not base64!" }).ok).toBe(false);
    expect(validateUpload({ contentType: "audio/webm", dataBase64: "A".repeat(34 * 1024 * 1024) }).ok).toBe(false);
  });
});
