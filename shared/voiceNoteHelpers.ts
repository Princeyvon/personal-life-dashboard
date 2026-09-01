export type VoiceDraftState = {
  text: string;
  audioPreview: { url: string; meta: Record<string, unknown> } | null;
  status: "idle" | "ready" | "needs-text";
  error: string;
};

export function buildVoiceFailureState(
  stage: "upload" | "transcription",
  error: unknown,
  draft: Pick<VoiceDraftState, "text" | "audioPreview">,
): VoiceDraftState {
  const fallback = stage === "upload"
    ? "The recording could not be uploaded. You can still use the live transcript."
    : "Audio was saved, but transcription was unavailable. You can type the note instead.";
  const message = error instanceof Error && error.message ? error.message : fallback;

  return {
    text: draft.text,
    audioPreview: draft.audioPreview,
    status: draft.text.trim() ? "ready" : "needs-text",
    error: message,
  };
}

export function canSubmitVoiceDraft(text: string, busy: boolean): boolean {
  return Boolean(text.trim()) && !busy;
}
