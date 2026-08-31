import { describe, expect, it } from "vitest";
import { PIN_GATE_STORY_CLASS } from "./PinGate";

describe("PIN gate responsive layout", () => {
  it("hides the welcome story on mobile and restores it at the desktop breakpoint", () => {
    expect(PIN_GATE_STORY_CLASS).toContain("hidden");
    expect(PIN_GATE_STORY_CLASS).toContain("md:flex");
  });
});
