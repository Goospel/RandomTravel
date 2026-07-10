import { describe, it, expect } from "vitest";
import { formatKm, haversineM } from "@/lib/geo";

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

describe("haversineM — 두 좌표 대권 직선거리(m, 🧭 M20)", () => {
  const SEOUL = { lat: 37.5665, lng: 126.978 }; // 서울시청
  const BUSAN = { lat: 35.1796, lng: 129.0756 }; // 부산시청
  it("서울↔부산 ≈ 325km(±5km)", () => {
    const d = haversineM(SEOUL.lat, SEOUL.lng, BUSAN.lat, BUSAN.lng);
    expect(d).toBeGreaterThan(320_000);
    expect(d).toBeLessThan(330_000);
  });
  it("동일 좌표는 0", () => {
    expect(haversineM(SEOUL.lat, SEOUL.lng, SEOUL.lat, SEOUL.lng)).toBe(0);
  });
  it("대칭 — a→b 와 b→a 가 같다", () => {
    const ab = haversineM(SEOUL.lat, SEOUL.lng, BUSAN.lat, BUSAN.lng);
    const ba = haversineM(BUSAN.lat, BUSAN.lng, SEOUL.lat, SEOUL.lng);
    expect(ab).toBeCloseTo(ba, 6);
  });
  it("짧은 거리(위도 0.01° ≈ 1.11km)도 하한 없이 실제 값", () => {
    const d = haversineM(37.5, 127.0, 37.51, 127.0);
    expect(d).toBeGreaterThan(1_000);
    expect(d).toBeLessThan(1_200);
  });
});
