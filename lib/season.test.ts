import { describe, it, expect } from "vitest";
import {
  currentMonth,
  seasonalItemsForMonth,
  seasonalAreaCodes,
  narrowBySeasonal,
  seasonalItemsForArea,
  dishSeasonalItemsForArea,
  resolveMonth,
} from "@/lib/season";
import { SEASONAL_CALENDAR, type SeasonalItem } from "@/lib/constants";

// 로직은 실제 달력 데이터에 결합시키지 않으려 픽스처를 주입해 검증한다.
// (달력 내용이 §13 검수로 바뀌어도 로직 테스트는 안 깨진다.)
// dish = 식당에서 먹는 것(회·해산물). 대게만 dish, 과일류는 dish 아님.
const FIX: SeasonalItem[] = [
  { item: "대게", emoji: "🦀", months: [11, 12, 1, 2], areaCodes: [35, 32], dish: true },
  { item: "참외", emoji: "🍈", months: [5, 6, 7], areaCodes: [35], dish: false },
  { item: "옥수수", emoji: "🌽", months: [7, 8], areaCodes: [32], dish: false },
  { item: "감귤", emoji: "🍊", months: [11, 12, 1], areaCodes: [39], dish: false },
];

describe("currentMonth — 항상 KST 기준(서버 UTC 월경계 방어)", () => {
  it("KST 자정 직후(=UTC 전날 15시 이후)에도 KST 월을 준다", () => {
    // 2026-07-01 05:00 KST = 2026-06-30 20:00 UTC → getMonth()면 6, KST면 7
    expect(currentMonth(new Date(Date.UTC(2026, 5, 30, 20, 0)))).toBe(7);
  });
  it("KST 월말 밤(=같은 날 UTC 오후)도 그 달", () => {
    // 2026-07-31 23:00 KST = 2026-07-31 14:00 UTC
    expect(currentMonth(new Date(Date.UTC(2026, 6, 31, 14, 0)))).toBe(7);
  });
  it("연말 경계: 2027-01-01 08:00 KST = 2026-12-31 23:00 UTC → 1월", () => {
    expect(currentMonth(new Date(Date.UTC(2026, 11, 31, 23, 0)))).toBe(1);
  });
});

describe("resolveMonth — 날짜 파생 월 우선순위(M19 §6.8)", () => {
  const NOW = new Date("2026-07-10T03:00:00Z"); // KST 7월
  it("명시 month 가 최우선(dateYmd·now 무시)", () => {
    expect(resolveMonth({ month: 3, dateYmd: "20260812", now: NOW })).toBe(3);
  });
  it("month 없으면 dateYmd 파생(월말→다음 달 주말 케이스)", () => {
    // 7/31 기준일에 8월 주말 → 8월로 파생
    expect(resolveMonth({ dateYmd: "20260801", now: NOW })).toBe(8);
  });
  it("month·dateYmd 둘 다 없으면 현재 월(now)", () => {
    expect(resolveMonth({ now: NOW })).toBe(7);
  });
  it("상충 주입(month 3 + dateYmd 8월) → month 승리(결정적)", () => {
    expect(resolveMonth({ month: 3, dateYmd: "20260815" })).toBe(3);
  });
});

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

describe("dishSeasonalItemsForArea — 이 지역 이번 달 제철 중 '식당 음식(dish)'만 (음식점 키워드 매칭용)", () => {
  it("dish 품목만 남긴다 — 회·해산물은 남고 과일류는 빠진다", () => {
    // 12월 경북(35): 대게(dish) → ["대게"]
    expect(dishSeasonalItemsForArea(35, 12, FIX).map((s) => s.item)).toEqual(["대게"]);
  });
  it("dish 아닌 품목만 제철이면 빈 배열(음식점 키워드 매칭 불가 → 폴백 신호)", () => {
    // 7월 경북(35): 참외(dish 아님)뿐 → []
    expect(dishSeasonalItemsForArea(35, 7, FIX)).toEqual([]);
  });
  it("areaCode=null → 빈 배열", () => {
    expect(dishSeasonalItemsForArea(null, 12, FIX)).toEqual([]);
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

  it("회·해산물은 dish(식당 음식), 과일·채소는 dish 아님 — 제철+음식점 키워드 매칭 대상 구분", () => {
    // 제철+음식점일 때 dish 품목명으로 맛집을 검색한다(§6.4). '식당에서 먹는 것'만 dish여야
    // 수박·사과 같은 농산물이 "○○ 맛집"으로 검색되는 헛발질(0건)을 구조적으로 막는다.
    const byName = new Map(SEASONAL_CALENDAR.map((s) => [s.item, s]));
    const SEAFOOD = ["대게", "방어", "굴", "주꾸미", "멸치", "전복", "전어", "갈치", "대하", "오징어"];
    const PRODUCE = ["감귤", "딸기", "사과", "매실", "참외", "자두", "옥수수", "복숭아", "수박", "포도", "배"];
    for (const n of SEAFOOD) expect(byName.get(n)?.dish, `${n}은 dish여야`).toBe(true);
    for (const n of PRODUCE) expect(byName.get(n)?.dish, `${n}은 dish가 아니어야`).toBe(false);
    // 모든 항목이 dish 여부를 명시(플래그 누락 방지 — §13 검수 때 새 품목도 강제)
    for (const s of SEASONAL_CALENDAR) expect(typeof s.dish).toBe("boolean");
  });

  it("연중 상비 향신료·양념(마늘·고추 등)은 제철 품목이 아니다", () => {
    // 마늘·고추 같은 양념/향신료는 사철 유통돼 '제철이라 특별히 맛있는' 여행 유인이
    // 아니다 → 산지 풀·"지금 제철" 배지에서 제외한다(§6.4). §13 달력 검수 때 재유입 방지 가드.
    const YEAR_ROUND_AROMATICS = [
      "마늘", "고추", "양파", "생강", "대파", "쪽파", "부추", "파", "청양고추",
    ];
    const items = SEASONAL_CALENDAR.map((s) => s.item);
    for (const a of YEAR_ROUND_AROMATICS) {
      expect(items).not.toContain(a);
    }
  });
});
