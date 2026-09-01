import { describe, expect, it } from "vitest";
import { buildVoiceFailureState, canSubmitVoiceDraft } from "./voiceNoteHelpers";

describe("VoiceNoteBox failure recovery", () => {
  it("simulates /api/uploads failure while preserving a typed draft for retry or discard", () => {
    const failure = buildVoiceFailureState("upload", new Error("Storage upload unavailable"), {
      text: "Call the dentist tomorrow",
      audioPreview: null,
    });

    expect(failure).toMatchObject({
      text: "Call the dentist tomorrow",
      audioPreview: null,
      status: "ready",
      error: "Storage upload unavailable",
    });
    expect(canSubmitVoiceDraft(failure.text, false)).toBe(true);
  });

  it("simulates transcription failure after upload while preserving the audio preview metadata", () => {
    const audioPreview = { url: "blob:voice-note", meta: { key: "users/42/attachments/voice.webm" } };
    const failure = buildVoiceFailureState("transcription", new Error("Transcription service unavailable"), {
      text: "",
      audioPreview,
    });

    expect(failure).toMatchObject({
      text: "",
      audioPreview,
      status: "needs-text",
      error: "Transcription service unavailable",
    });
    expect(canSubmitVoiceDraft(failure.text, false)).toBe(false);
    expect(canSubmitVoiceDraft("Type a replacement note", false)).toBe(true);
  });

  it("keeps the draft eligible for retry when downstream note processing rejects it", () => {
    expect(canSubmitVoiceDraft("Keep this draft", false)).toBe(true);
    expect(canSubmitVoiceDraft("Keep this draft", true)).toBe(false);
  });
});
