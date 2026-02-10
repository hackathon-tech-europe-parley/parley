import { describe, expect, test } from "bun:test";
import { normalizeToMoodState } from "./constants";

describe("normalizeToMoodState", () => {
  test("maps happy-group words", () => {
    expect(normalizeToMoodState("joyful")).toBe("happy");
    expect(normalizeToMoodState("pleased")).toBe("happy");
    expect(normalizeToMoodState("delighted")).toBe("happy");
  });

  test("maps friendly-group words", () => {
    expect(normalizeToMoodState("warm")).toBe("friendly");
    expect(normalizeToMoodState("welcoming")).toBe("friendly");
  });

  test("maps neutral-group words", () => {
    expect(normalizeToMoodState("calm")).toBe("neutral");
    expect(normalizeToMoodState("professional")).toBe("neutral");
    expect(normalizeToMoodState("patient")).toBe("neutral");
  });

  test("maps angry-group words", () => {
    expect(normalizeToMoodState("hostile")).toBe("angry");
    expect(normalizeToMoodState("furious")).toBe("angry");
    expect(normalizeToMoodState("cold")).toBe("angry");
  });

  test("maps skeptical-group words", () => {
    expect(normalizeToMoodState("doubtful")).toBe("skeptical");
    expect(normalizeToMoodState("suspicious")).toBe("skeptical");
  });

  test("maps annoyed-group words", () => {
    expect(normalizeToMoodState("irritated")).toBe("annoyed");
    expect(normalizeToMoodState("frustrated")).toBe("annoyed");
  });

  test("maps sad-group words", () => {
    expect(normalizeToMoodState("melancholic")).toBe("sad");
    expect(normalizeToMoodState("disappointed")).toBe("sad");
  });

  test("maps surprised-group words", () => {
    expect(normalizeToMoodState("shocked")).toBe("surprised");
    expect(normalizeToMoodState("amazed")).toBe("surprised");
  });

  test("unknown mood falls back to neutral", () => {
    expect(normalizeToMoodState("confused")).toBe("neutral");
    expect(normalizeToMoodState("xyz")).toBe("neutral");
  });

  test("case insensitive", () => {
    expect(normalizeToMoodState("HAPPY")).toBe("happy");
    expect(normalizeToMoodState("Hostile")).toBe("angry");
  });

  test('substring matching: "very pleased today" maps to happy', () => {
    expect(normalizeToMoodState("very pleased today")).toBe("happy");
  });

  test("empty string falls back to neutral", () => {
    expect(normalizeToMoodState("")).toBe("neutral");
  });
});
