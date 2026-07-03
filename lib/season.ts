// 🦀 제철 필터의 순수 로직 (plan.md §6.4). localStorage·네트워크 없음 — 단위 테스트 대상.
//
// 달력은 lib/constants 의 SEASONAL_CALENDAR 를 기본으로 쓰되, 테스트가 실데이터에
// 결합되지 않도록 모든 함수는 calendar 를 주입받을 수 있게 한다(기본값 = 실달력).

import { SEASONAL_CALENDAR, ALL_AREA_CODES } from "@/lib/constants";
import type { SeasonalItem } from "@/lib/constants";

/** 현재 월(1-12). 서버 런타임 기준 — 테스트는 month 를 직접 넘겨 결정적으로 검증. */
export function currentMonth(now: Date = new Date()): number {
  return now.getMonth() + 1;
}

/** 이번 달 제철 품목들 */
export function seasonalItemsForMonth(
  month: number,
  calendar: readonly SeasonalItem[] = SEASONAL_CALENDAR,
): SeasonalItem[] {
  return calendar.filter((s) => s.months.includes(month));
}

/** 이번 달 제철 품목들의 주산지 시·도 합집합(중복 제거, 등장 순서 유지) */
export function seasonalAreaCodes(
  month: number,
  calendar: readonly SeasonalItem[] = SEASONAL_CALENDAR,
): number[] {
  const set = new Set<number>();
  for (const s of seasonalItemsForMonth(month, calendar)) {
    for (const c of s.areaCodes) set.add(c);
  }
  return [...set];
}

/**
 * 제철 필터 적용 후 남는 지역 풀 = base ∩ (이번 달 제철 산지).
 * base 가 null/빈 배열이면 전국(ALL_AREA_CODES)을 기준으로 한다. base 순서 보존.
 * 결과가 빈 배열이면 "조건 과다로 빈 풀"(§6.5) 신호.
 */
export function narrowBySeasonal(
  base: number[] | null,
  month: number,
  calendar: readonly SeasonalItem[] = SEASONAL_CALENDAR,
): number[] {
  const seasonal = new Set(seasonalAreaCodes(month, calendar));
  const pool = base && base.length > 0 ? base : ALL_AREA_CODES;
  return pool.filter((c) => seasonal.has(c));
}

/** 이 지역이 이번 달 어떤 제철 품목의 산지인지(결과 카드 배지용). areaCode=null → 빈 배열. */
export function seasonalItemsForArea(
  areaCode: number | null,
  month: number,
  calendar: readonly SeasonalItem[] = SEASONAL_CALENDAR,
): SeasonalItem[] {
  if (areaCode == null) return [];
  return seasonalItemsForMonth(month, calendar).filter((s) =>
    s.areaCodes.includes(areaCode),
  );
}
