// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transcribeMutation = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    voice: { transcribe: { useMutation: () => transcribeMutation } },
  },
}));

import { VoiceNoteBox } from "./Home";

class FakeMediaRecorder {
  static isTypeSupported() { return true; }
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable = null;
  onstop = null;
  onerror = null;
  constructor() { this.state = "inactive"; }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["voice"], { type: this.mimeType }) });
    queueMicrotask(() => this.onstop?.());
  }
}

function installRecorderEnvironment() {
  Object.defineProperty(window, "MediaRecorder", { configurable: true, writable: true, value: FakeMediaRecorder });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) } });
  vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:voice-note"), revokeObjectURL: vi.fn() });
  vi.stubGlobal("fetch", vi.fn());
}

async function recordOneNote() {
  fireEvent.click(screen.getByRole("button", { name: "Record audio" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop recording" })).toBeTruthy());
  expect(screen.getByRole("status", { name: "AI listening" })).toBeTruthy();
  expect(screen.getByText("Listening…")).toBeTruthy();
  expect(document.querySelectorAll(".ai-listening-bar").length).toBe(40);
  fireEvent.click(screen.getByRole("button", { name: "Stop recording" }));
}

describe("VoiceNoteBox UI recovery", () => {
  beforeEach(() => {
    installRecorderEnvironment();
    transcribeMutation.mutateAsync.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps a typed draft and exposes retry/discard after simulated /api/uploads failure", async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: "Simulated upload failure" }) });
    render(<VoiceNoteBox onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Voice note text" }), { target: { value: "Typed fallback note" } });

    await recordOneNote();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Simulated upload failure"));
    expect(screen.getByRole("textbox", { name: "Voice note text" }).value).toBe("Typed fallback note");
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit note" }).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("textbox", { name: "Voice note text" }).value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps uploaded audio available for typed fallback after simulated transcription failure", async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ key: "users/42/attachments/voice.webm", url: "/manus-storage/voice.webm" }) });
    transcribeMutation.mutateAsync.mockRejectedValue(new Error("Simulated transcription failure"));
    render(<VoiceNoteBox onSubmit={vi.fn()} />);

    await recordOneNote();

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Simulated transcription failure"));
    expect(document.querySelector('audio[aria-label="Recorded voice note preview"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Voice note text" }).value).toBe("");

    fireEvent.change(screen.getByRole("textbox", { name: "Voice note text" }), { target: { value: "Typed replacement after transcription failure" } });
    expect(screen.getByRole("button", { name: "Submit note" }).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(document.querySelector('audio[aria-label="Recorded voice note preview"]')).toBeNull();
  });
});
