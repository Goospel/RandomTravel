import { describe, it, expect } from "vitest";
import {
  seasonalItemsForMonth,
  seasonalAreaCodes,
  narrowBySeasonal,
  seasonalItemsForArea,
} from "@/lib/season";
import { SEASONAL_CALENDAR, type SeasonalItem } from "@/lib/constants";

// 로직은 실제 달력 데이터에 결합시키지 않으려 픽스처를 주입해 검증한다.
// (달력 내용이 §13 검수로 바뀌어도 로직 테스트는 안 깨진다.)
const FIX: SeasonalItem[] = [
  { item: "대게", emoji: "🦀", months: [11, 12, 1, 2], areaCodes: [35, 32] },
  { item: "참외", emoji: "🍈", months: [5, 6, 7], areaCodes: [35] },
  { item: "옥수수", emoji: "🌽", months: [7, 8], areaCodes: [32] },
  { item: "감귤", emoji: "🍊", months: [11, 12, 1], areaCodes: [39] },
];

describe("seasonalItemsForMonth — 이번 달 제철 품목", () => {
  it("해당 월을 months 에 포함한 품목만", () => {
    const out = seasonalItemsForMonth(7, FIX).map((s) => s.item);
    expect(out).toEqual(["참외", "옥수수"]);
  });
  it("연말·연초 걸침(대게 12·1월)은 months 배열에 명시돼 wrap 로직 불필요", () => {
    expect(seasonalItemsForMonth(12, FIX).map((s) => s.item)).toContain("대게");
    expect(seasonalItemsForMonth(1, FIX).map((s) => s.item)).toContain("대게");
    expect(seasonalItemsForMonth(6, FIX).map((s) => s.item)).not.toContain("대게");
  });
});

describe("seasonalAreaCodes — 주산지 합집합(중복 제거)", () => {
  it("이번 달 품목들의 주산지 합집합", () => {
    // 12월: 대게(35,32) + 감귤(39) → {35,32,39}
    expect(new Set(seasonalAreaCodes(12, FIX))).toEqual(new Set([35, 32, 39]));
  });
  it("겹치는 산지는 한 번만", () => {
    // 7월: 참외(35) + 옥수수(32) → {35,32}
    expect(new Set(seasonalAreaCodes(7, FIX))).toEqual(new Set([35, 32]));
  });
});

describe("narrowBySeasonal — 지역 풀 ∩ 제철 산지", () => {
  it("base=null(전국)이면 이번 달 제철 산지 전체", () => {
    expect(new Set(narrowBySeasonal(null, 7, FIX))).toEqual(new Set([35, 32]));
  });
  it("선택 지역 중 제철 산지만 남긴다(base 순서 보존)", () => {
    // 7월 산지 {35,32} 중 [39,32,1] 교집합 = [32]
    expect(narrowBySeasonal([39, 32, 1], 7, FIX)).toEqual([32]);
  });
  it("겹치는 지역이 없으면 빈 배열(빈 풀 신호)", () => {
    expect(narrowBySeasonal([1, 2], 7, FIX)).toEqual([]);
  });
});

describe("seasonalItemsForArea — 이 지역이 이번 달 산지인 품목(배지용)", () => {
  it("해당 지역이 산지인 품목만", () => {
    expect(seasonalItemsForArea(35, 7, FIX).map((s) => s.item)).toEqual(["참외"]);
    expect(seasonalItemsForArea(32, 7, FIX).map((s) => s.item)).toEqual(["옥수수"]);
  });
  it("산지 아님 → 빈 배열", () => {
    expect(seasonalItemsForArea(1, 7, FIX)).toEqual([]);
  });
  it("areaCode=null → 빈 배열(좌표/지역 누락 방어)", () => {
    expect(seasonalItemsForArea(null, 7, FIX)).toEqual([]);
  });
});

describe("실데이터 SEASONAL_CALENDAR — 최소 정합성", () => {
  it("모든 항목의 months·areaCodes 가 유효 범위", () => {
    for (const s of SEASONAL_CALENDAR) {
      expect(s.item.length).toBeGreaterThan(0);
      expect(s.months.length).toBeGreaterThan(0);
      expect(s.areaCodes.length).toBeGreaterThan(0);
      for (const m of s.months) expect(m).toBeGreaterThanOrEqual(1);
      for (const m of s.months) expect(m).toBeLessThanOrEqual(12);
    }
  });
  it("12개월 모두 최소 1품목 이상 커버(빈 달 없음)", () => {
    for (let m = 1; m <= 12; m++) {
      expect(seasonalItemsForMonth(m).length).toBeGreaterThan(0);
    }
  });
});
