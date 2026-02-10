import { describe, expect, test } from "bun:test";
import { detectTabooMatch, tabooRulesSummary } from "./taboo-rules";

describe("detectTabooMatch", () => {
  test("detects exact forbidden words", () => {
    expect(detectTabooMatch("you are an idiot")).toEqual({
      kind: "word",
      label: "forbidden-word",
      token: "idiot",
    });
    expect(detectTabooMatch("fuck off")).toEqual({
      kind: "word",
      label: "forbidden-word",
      token: "fuck",
    });
    expect(detectTabooMatch("connard!")).toEqual({
      kind: "word",
      label: "forbidden-word",
      token: "connard",
    });
  });

  test("detects forbidden topic keywords", () => {
    expect(detectTabooMatch("let's talk about politics")).toEqual({
      kind: "topic",
      label: "politics",
      token: "politics",
    });
    expect(detectTabooMatch("the mosque is beautiful")).toEqual({
      kind: "topic",
      label: "religion",
      token: "mosque",
    });
  });

  test("word boundary matching: does not match substrings", () => {
    expect(detectTabooMatch("classic design")).toBeNull();
    expect(detectTabooMatch("goddess of wisdom")).toBeNull();
    expect(detectTabooMatch("assessment")).toBeNull();
  });

  test("case insensitive matching", () => {
    expect(detectTabooMatch("FUCK")).not.toBeNull();
    expect(detectTabooMatch("Idiot")).not.toBeNull();
  });

  test("diacritic normalization", () => {
    const result = detectTabooMatch("Estúpido");
    expect(result).not.toBeNull();
    expect(result?.token).toBe("estupido");
  });

  test("returns null for clean input", () => {
    expect(detectTabooMatch("hello, how are you?")).toBeNull();
    expect(detectTabooMatch("I would like a coffee please")).toBeNull();
  });

  test("multi-word matching", () => {
    expect(detectTabooMatch("just shut up already")).toEqual({
      kind: "word",
      label: "forbidden-word",
      token: "shut up",
    });
  });

  test("empty input returns null", () => {
    expect(detectTabooMatch("")).toBeNull();
    expect(detectTabooMatch("   ")).toBeNull();
  });
});

describe("tabooRulesSummary", () => {
  test("returns a non-empty string with words and topics", () => {
    const summary = tabooRulesSummary();
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain("Forbidden words");
    expect(summary).toContain("Forbidden topics");
    expect(summary).toContain("politics");
    expect(summary).toContain("religion");
  });
});
