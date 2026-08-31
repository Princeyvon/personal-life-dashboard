import { describe, expect, it } from "vitest";
import { appRouter, transcriptionErrorToTrpcCode } from "./routers";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("transcription error mapping", () => {
  it("maps invalid and oversized audio to a client-correctable error", () => {
    expect(transcriptionErrorToTrpcCode("INVALID_FORMAT")).toBe("BAD_REQUEST");
    expect(transcriptionErrorToTrpcCode("FILE_TOO_LARGE")).toBe("BAD_REQUEST");
  });

  it("maps service failures to an internal error without exposing provider details", () => {
    expect(transcriptionErrorToTrpcCode("TRANSCRIPTION_FAILED")).toBe("INTERNAL_SERVER_ERROR");
    expect(transcriptionErrorToTrpcCode("SERVICE_ERROR")).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("voice.transcribe", () => {
  it("protects audio transcription from unauthenticated access", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.voice.transcribe({ audioKey: "users/1/attachments/recording.webm" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects an audio key owned by another dashboard", async () => {
    const caller = appRouter.createCaller({
      ...unauthenticatedContext(),
      user: {
        id: 42,
        openId: "pin-dashboard-owner",
        email: null,
        name: "Dashboard Owner",
        loginMethod: "pin",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
    });
    await expect(caller.voice.transcribe({ audioKey: "users/7/attachments/recording.webm" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
