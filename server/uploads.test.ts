import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { handleUpload } from "./uploads";

function responseMock() {
  const result: { statusCode: number; body: unknown } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      result.statusCode = code;
      return res;
    },
    json(body: unknown) {
      result.body = body;
      return res;
    },
  } as unknown as Response;
  return { res, result };
}

function requestWithBody(body: unknown) {
  return { body, headers: {} } as Request;
}

describe("authenticated audio uploads", () => {
  it("uploads a valid audio payload under the authenticated user scope", async () => {
    const put = vi.fn().mockResolvedValue({ key: "users/12/attachments/voice.webm", url: "/manus-storage/users/12/attachments/voice.webm" });
    const { res, result } = responseMock();

    await handleUpload(requestWithBody({ filename: "voice note.webm", contentType: "audio/webm", dataBase64: "aGVsbG8=" }), res, {
      authenticate: vi.fn().mockResolvedValue({ id: 12 }),
      put,
    });

    expect(result.statusCode).toBe(201);
    expect(result.body).toMatchObject({ key: "users/12/attachments/voice.webm", contentType: "audio/webm", size: 5 });
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^users\/12\/attachments\/.*-voice-note.webm$/), expect.any(Buffer), "audio/webm");
  });

  it("rejects invalid audio input before touching storage", async () => {
    const put = vi.fn();
    const { res, result } = responseMock();

    await handleUpload(requestWithBody({ filename: "voice.webm", contentType: "audio/webm", dataBase64: "not base64!" }), res, {
      authenticate: vi.fn().mockResolvedValue({ id: 12 }),
      put,
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({ error: "Upload data must be valid base64." });
    expect(put).not.toHaveBeenCalled();
  });

  it("rejects an unsupported MIME type at the authenticated route", async () => {
    const put = vi.fn();
    const { res, result } = responseMock();

    await handleUpload(requestWithBody({ filename: "voice.exe", contentType: "application/x-msdownload", dataBase64: "aGVsbG8=" }), res, {
      authenticate: vi.fn().mockResolvedValue({ id: 12 }),
      put,
    });

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual({ error: "Unsupported upload type." });
    expect(put).not.toHaveBeenCalled();
  });

  it("returns a recoverable service error when S3 upload fails", async () => {
    const { res, result } = responseMock();

    await handleUpload(requestWithBody({ filename: "voice.webm", contentType: "audio/webm", dataBase64: "aGVsbG8=" }), res, {
      authenticate: vi.fn().mockResolvedValue({ id: 12 }),
      put: vi.fn().mockRejectedValue(new Error("S3 unavailable")),
    });

    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({ error: "Uploads are temporarily unavailable. Please try again later." });
  });
});
