// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transcribeMock = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    voice: {
      transcribe: {
        useMutation: () => ({ mutateAsync: transcribeMock.mutateAsync, isPending: false }),
      },
    },
  },
}));

// @ts-expect-error Home.jsx exposes this runtime named export while its legacy declaration only models the default page export.
import { VoiceNoteBox } from "./Home.jsx";

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  onerror?: () => void;

  start() {
    this.state = "recording";
    queueMicrotask(() => this.ondataavailable?.({ data: new Blob(["audio"], { type: "audio/webm" }) }));
  }

  stop() {
    this.state = "inactive";
    queueMicrotask(() => this.onstop?.());
  }
}

function prepareBrowserMocks() {
  const stream = { getTracks: () => [{ stop: vi.fn() }] };
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    writable: true,
    value: FakeMediaRecorder,
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => "blob:voice-note"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
}

describe("VoiceNoteBox failure recovery", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.restoreAllMocks();
    transcribeMock.mutateAsync.mockReset();
    prepareBrowserMocks();
  });

  it("preserves typed draft content after an upload failure and allows discard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Upload unavailable" }) }));
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<VoiceNoteBox onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("Voice note text"), { target: { value: "Keep this draft while I retry the upload." } });
    fireEvent.click(screen.getByRole("button", { name: "Record audio" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Upload unavailable"));
    expect((screen.getByLabelText("Voice note text") as HTMLTextAreaElement).value).toBe("Keep this draft while I retry the upload.");
    expect(transcribeMock.mutateAsync).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Submit note" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect((screen.getByLabelText("Voice note text") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps the uploaded audio preview available after transcription failure and allows discard", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ key: "voice-key", url: "https://storage.test/voice.webm" }) }));
    transcribeMock.mutateAsync.mockRejectedValueOnce(new Error("Transcription unavailable"));
    render(<VoiceNoteBox onSubmit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Record audio" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Transcription unavailable"));
    expect(transcribeMock.mutateAsync).toHaveBeenCalledWith({ audioKey: "voice-key" });
    expect(screen.getByLabelText("Recorded voice note preview")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Submit note" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByLabelText("Recorded voice note preview")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

export {};

