import { describe, it, expect } from "vitest";
import { formatKm } from "@/lib/geo";

describe("formatKm — 📍 주변 거리 표시(m→km, M14)", () => {
  it("소수 첫째 자리로 반올림", () => {
    expect(formatKm(8213)).toBe("8.2km");
    expect(formatKm(12000)).toBe("12.0km");
    expect(formatKm(158.69)).toBe("0.2km");
  });
  it("아주 가까우면 0.1km 하한(0km로 표시 안 함)", () => {
    expect(formatKm(50)).toBe("0.1km"); // 0.05 → 반올림 0.1
    expect(formatKm(20)).toBe("0.1km"); // 0.02 → 0.0 → 하한 0.1
    expect(formatKm(0)).toBe("0.1km");
  });
  it("음수·비유한수는 하한으로 방어", () => {
    expect(formatKm(-5)).toBe("0.1km");
    expect(formatKm(Number.NaN)).toBe("0.1km");
  });
});
