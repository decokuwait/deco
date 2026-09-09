import { describe, expect, it } from "vitest";
import { generateVisitorCode, isValidVisitorCode } from "@/lib/visitor/code";

describe("visitor code", () => {
  it("generates 6-digit codes without a leading zero", () => {
    for (let i = 0; i < 2000; i++) {
      const c = generateVisitorCode();
      expect(c).toMatch(/^[1-9]\d{5}$/);
      expect(Number(c)).toBeGreaterThanOrEqual(100000);
      expect(Number(c)).toBeLessThanOrEqual(999999);
    }
  });
  it("produces varied codes", () => {
    const set = new Set(Array.from({ length: 500 }, () => generateVisitorCode()));
    expect(set.size).toBeGreaterThan(450);
  });
  it("validates codes", () => {
    expect(isValidVisitorCode("123456")).toBe(true);
    expect(isValidVisitorCode("012345")).toBe(false);
    expect(isValidVisitorCode("12345")).toBe(false);
    expect(isValidVisitorCode(123456)).toBe(false);
    expect(isValidVisitorCode(null)).toBe(false);
  });
});
