// 🦀 제철 필터의 순수 로직 (plan.md §6.4). localStorage·네트워크 없음 — 단위 테스트 대상.
//
// 달력은 lib/constants 의 SEASONAL_CALENDAR 를 기본으로 쓰되, 테스트가 실데이터에
// 결합되지 않도록 모든 함수는 calendar 를 주입받을 수 있게 한다(기본값 = 실달력).

import { SEASONAL_CALENDAR, ALL_AREA_CODES } from "@/lib/constants";
import type { SeasonalItem } from "@/lib/constants";
import { monthOf } from "@/lib/kst";

/**
 * 현재 월(1-12) — 항상 **한국 표준시(KST)** 기준.
 *
 * ⚠️ Vercel 서버리스 런타임의 프로세스 TZ 는 함수 리전(icn1=서울)과 무관하게 UTC 라,
 * `now.getMonth()` 를 쓰면 KST 매월 1일 00:00~08:59(=전일 15:00~23:59 UTC) 9시간 동안
 * 전월로 오분류된다 → 제철 지역 풀·"지금 제철" 배지가 틀린 달을 사실처럼 노출.
 * Intl 로 Asia/Seoul 을 고정해 서버 TZ 와 무관하게 KST 월을 얻는다.
 * (테스트는 now 를 주입해 UTC 전날/KST 이번달 경계를 결정적으로 검증.)
 */
export function currentMonth(now: Date = new Date()): number {
  const kst = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    month: "numeric",
  }).format(now);
  return Number(kst);
}

/**
 * 📅 제철 기준 월 파생(M19 §6.8) — 우선순위: 명시 month > dateYmd 파생 > 현재 월(now).
 * drawRandom·countCandidates 가 같은 규칙을 쓰도록 한곳에 모은다(테스트·호출부 동시 주입에도 결정적).
 * 월말에 다음 달 주말 기준일이 들어오면 그 달로 자연 전환된다.
 */
export function resolveMonth(p: {
  month?: number;
  dateYmd?: string | null;
  now?: Date;
}): number {
  if (p.month != null) return p.month;
  if (p.dateYmd) return monthOf(p.dateYmd);
  return currentMonth(p.now);
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

/**
 * 이 지역·이번 달 제철 품목 중 **식당에서 먹는 것(dish)** 만 — 🦀+🍽️ 제철+음식점 조합에서
 * 이 품목명들로 그 지역 맛집을 검색(searchKeyword2)하기 위한 후보(§6.4).
 * 빈 배열이면 "이 지역엔 지금 식당에서 먹을 제철거리가 없다"(예: 수박 산지) → 음식점 폴백 신호.
 */
export function dishSeasonalItemsForArea(
  areaCode: number | null,
  month: number,
  calendar: readonly SeasonalItem[] = SEASONAL_CALENDAR,
): SeasonalItem[] {
  return seasonalItemsForArea(areaCode, month, calendar).filter((s) => s.dish);
}
