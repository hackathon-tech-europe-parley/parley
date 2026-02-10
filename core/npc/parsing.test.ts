import { describe, expect, test } from "bun:test";
import { resolveGoalProgress } from "./parsing";

describe("resolveGoalProgress", () => {
  test('status "achieved" always returns 5', () => {
    expect(resolveGoalProgress("achieved", 2, 1)).toBe(5);
    expect(resolveGoalProgress("achieved", undefined, 3)).toBe(5);
  });

  test('status "failed" always returns 1', () => {
    expect(resolveGoalProgress("failed", 4, 3)).toBe(1);
    expect(resolveGoalProgress("failed", undefined, 5)).toBe(1);
  });

  test('status "ongoing" parses raw number', () => {
    expect(resolveGoalProgress("ongoing", 3, 1)).toBe(3);
    expect(resolveGoalProgress("ongoing", 5, 1)).toBe(5);
  });

  test("clamps to 1-5 range", () => {
    expect(resolveGoalProgress("ongoing", 0, 1)).toBe(1);
    expect(resolveGoalProgress("ongoing", 10, 1)).toBe(5);
    expect(resolveGoalProgress("ongoing", -3, 1)).toBe(1);
  });

  test("rounds floats", () => {
    expect(resolveGoalProgress("ongoing", 2.6, 1)).toBe(3);
    expect(resolveGoalProgress("ongoing", 3.4, 1)).toBe(3);
  });

  test("NaN / Infinity / undefined fall back", () => {
    expect(resolveGoalProgress("ongoing", Number.NaN, 2)).toBe(2);
    expect(resolveGoalProgress("ongoing", Number.POSITIVE_INFINITY, 2)).toBe(2);
    expect(resolveGoalProgress("ongoing", undefined, 3)).toBe(3);
  });

  test("non-number values fall back", () => {
    expect(resolveGoalProgress("ongoing", "hello", 4)).toBe(4);
    expect(resolveGoalProgress("ongoing", null, 2)).toBe(2);
  });
});
