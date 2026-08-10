import { describe, it, expect } from "vitest";
import {
  formatKm,
  haversineM,
  isKoreaCoord,
  hasKoreaCoord,
  KOREA_BOUNDS,
} from "@/lib/geo";

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

// 🇰🇷 한국 경계 좌표 판정 — (0,0) 널섬 등 손상 좌표를 앵커·지도·링크에서 거르는 단일 출처.
describe("isKoreaCoord / hasKoreaCoord — 좌표 유효성(널섬 거부)", () => {
  it("(0,0) 널섬은 거부 — TourAPI 여행코스형이 좌표 없음을 0으로 준다", () => {
    expect(isKoreaCoord(0, 0)).toBe(false);
  });

  it("null·undefined 는 거부", () => {
    expect(isKoreaCoord(null, null)).toBe(false);
    expect(isKoreaCoord(37.5665, null)).toBe(false);
    expect(isKoreaCoord(undefined, 126.978)).toBe(false);
  });

  it("NaN·Infinity 는 거부", () => {
    expect(isKoreaCoord(Number.NaN, 126.978)).toBe(false);
    expect(isKoreaCoord(37.5665, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isKoreaCoord(Number.NEGATIVE_INFINITY, Number.NaN)).toBe(false);
  });

  it("위도만 범위 안이고 경도가 밖이면 거부(도쿄)", () => {
    expect(isKoreaCoord(35.68, 139.69)).toBe(false);
  });

  it("위경도 스왑은 거부", () => {
    expect(isKoreaCoord(126.978, 37.5665)).toBe(false);
  });

  it("국내 정상 좌표는 통과 — 서울·마라도·독도", () => {
    expect(isKoreaCoord(37.5665, 126.978)).toBe(true);
    expect(isKoreaCoord(33.06, 126.27)).toBe(true);
    expect(isKoreaCoord(37.24, 131.87)).toBe(true);
  });

  it("경계값은 포함(>=min, <=max)", () => {
    expect(isKoreaCoord(KOREA_BOUNDS.latMin, KOREA_BOUNDS.lngMin)).toBe(true);
    expect(isKoreaCoord(KOREA_BOUNDS.latMax, KOREA_BOUNDS.lngMax)).toBe(true);
    expect(isKoreaCoord(KOREA_BOUNDS.latMin - 0.01, 127)).toBe(false);
    expect(isKoreaCoord(37, KOREA_BOUNDS.lngMax + 0.01)).toBe(false);
  });

  it("hasKoreaCoord 는 객체를 판정하고 타입을 좁힌다", () => {
    const good = { title: "서울", lat: 37.5665 as number | null, lng: 126.978 as number | null };
    const nullIsland = { title: "코스", lat: 0 as number | null, lng: 0 as number | null };
    expect(hasKoreaCoord(nullIsland)).toBe(false);
    if (hasKoreaCoord(good)) {
      // 좁혀졌으면 number 로 산술 가능(타입 검사로 검증 — tsc 가 계측기)
      expect(good.lat + good.lng).toBeCloseTo(164.5445);
    } else {
      throw new Error("정상 좌표가 거부됨");
    }
  });
});
