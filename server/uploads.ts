import type { Express, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
]);

type UploadUser = { id: number };
type UploadDependencies = {
  authenticate: (req: Request) => Promise<UploadUser | null>;
  put: typeof storagePut;
};

export function validateUpload(input: { contentType: string; dataBase64: string }) {
  if (!ALLOWED_TYPES.has(input.contentType)) {
    return { ok: false as const, message: "Unsupported upload type." };
  }
  if (!input.dataBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.dataBase64)) {
    return { ok: false as const, message: "Upload data must be valid base64." };
  }
  const estimatedBytes = Math.floor((input.dataBase64.length * 3) / 4) - (input.dataBase64.endsWith("==") ? 2 : input.dataBase64.endsWith("=") ? 1 : 0);
  if (estimatedBytes <= 0 || estimatedBytes > MAX_UPLOAD_BYTES) {
    return { ok: false as const, message: "Uploads must be between 1 byte and 25 MB." };
  }
  return { ok: true as const };
}

function safeFileName(name: string) {
  const normalized = name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
  return normalized || "attachment";
}

export async function handleUpload(req: Request, res: Response, dependencies: UploadDependencies) {
  try {
    const user = await dependencies.authenticate(req);
    if (!user) return res.status(401).json({ error: "Authentication required." });

    const body = req.body as { filename?: unknown; contentType?: unknown; dataBase64?: unknown };
    const filename = typeof body.filename === "string" ? safeFileName(body.filename) : "attachment";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
    const validation = validateUpload({ contentType, dataBase64 });
    if (!validation.ok) return res.status(400).json({ error: validation.message });

    const data = Buffer.from(dataBase64, "base64");
    if (data.length > MAX_UPLOAD_BYTES) return res.status(413).json({ error: "Upload exceeds the 25 MB limit." });
    const result = await dependencies.put(`users/${user.id}/attachments/${randomUUID()}-${filename}`, data, contentType);
    return res.status(201).json({ key: result.key, url: result.url, filename, contentType, size: data.length });
  } catch (error) {
    console.error("[Uploads] Upload failed:", error);
    return res.status(503).json({ error: "Uploads are temporarily unavailable. Please try again later." });
  }
}

export function registerUploadRoutes(app: Express) {
  app.post("/api/uploads", (req, res) => handleUpload(req, res, {
    authenticate: (request) => sdk.authenticateRequest(request),
    put: storagePut,
  }));
}
