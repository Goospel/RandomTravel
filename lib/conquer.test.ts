import { describe, it, expect } from "vitest";
import {
  conqueredAreaCodes,
  conquerStats,
  TOTAL_AREAS,
} from "@/lib/conquer";
import type { SavedPlace } from "@/lib/travelStore";

// 테스트용 최소 SavedPlace — areaCode 만 관심사, 나머지는 채움값.
function sp(areaCode: number | null, contentId: string): SavedPlace {
  return {
    contentId,
    contentTypeId: 12,
    title: "t" + contentId,
    address: "주소",
    image: null,
    lat: null,
    lng: null,
    areaCode,
    savedAt: 0,
  };
}

describe("conquer — 전국 정복 집계", () => {
  it("전체 시·도 수는 17", () => {
    expect(TOTAL_AREAS).toBe(17);
  });

  it("방문이 없으면 정복 0", () => {
    expect(conqueredAreaCodes([]).size).toBe(0);
    expect(conquerStats([])).toEqual({ conquered: 0, total: 17, percent: 0 });
  });

  it("한 곳 방문 → 그 시·도 1개 정복(퍼센트 반올림)", () => {
    const set = conqueredAreaCodes([sp(1, "a")]);
    expect([...set]).toEqual([1]);
    // 1/17 = 5.88% → 6
    expect(conquerStats([sp(1, "a")])).toEqual({ conquered: 1, total: 17, percent: 6 });
  });

  it("같은 시·도 여러 곳은 1개로만 집계", () => {
    const v = [sp(6, "a"), sp(6, "b"), sp(6, "c")];
    expect(conqueredAreaCodes(v).size).toBe(1);
    expect(conquerStats(v).conquered).toBe(1);
  });

  it("areaCode 가 null 이면 제외", () => {
    const v = [sp(null, "a"), sp(1, "b")];
    const set = conqueredAreaCodes(v);
    expect(set.has(1)).toBe(true);
    expect(set.size).toBe(1);
  });

  it("17개 시·도가 아닌 코드(손상값)는 제외", () => {
    const v = [sp(999, "a"), sp(0, "b"), sp(-1, "c"), sp(2, "d")];
    const set = conqueredAreaCodes(v);
    expect([...set]).toEqual([2]);
    expect(conquerStats(v).conquered).toBe(1);
  });

  it("서로 다른 9개 시·도 → 53% (9/17=52.94 반올림)", () => {
    const codes = [1, 2, 3, 4, 5, 6, 7, 8, 31];
    const v = codes.map((c, i) => sp(c, "p" + i));
    expect(conquerStats(v)).toEqual({ conquered: 9, total: 17, percent: 53 });
  });

  it("17개 시·도 모두 방문 → 100%", () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 34, 35, 36, 37, 38, 39];
    const v = all.map((c, i) => sp(c, "q" + i));
    expect(conquerStats(v)).toEqual({ conquered: 17, total: 17, percent: 100 });
  });

  it("null·손상·중복이 섞여도 유효 시·도만 집계", () => {
    const v = [sp(1, "a"), sp(1, "b"), sp(null, "c"), sp(999, "d"), sp(2, "e")];
    const set = conqueredAreaCodes(v);
    expect([...set].sort((x, y) => x - y)).toEqual([1, 2]);
    // 2/17 = 11.76 → 12
    expect(conquerStats(v).percent).toBe(12);
  });
});
