// 📈 임팩트 대시보드(M26, plan.md §7.15) 순수부 — 점유율·설계 확률·실측 집계 + 이벤트 검증.
//
// DB 조회는 db/impact 가, 렌더는 app/impact 가 맡는다. 여기엔 숫자 변환만 둔다.
//
// ⚠️ 정직성 규약(§7.15): ②는 **설계 확률**(해석적 w/Σw)이고 ③만 실측이다. 두 산출물이
//   같은 타입(AreaShare)이라 화면에서 섞이기 쉬우므로, 이 모듈은 둘을 **다른 함수·다른
//   반환 타입**으로 분리해 호출부가 라벨을 헷갈릴 여지를 줄인다.

import { ALL_AREA_CODES } from "@/lib/constants";
import type { Mode, TravelEvent, TravelEventType } from "@/lib/events";

/** 한 시·도의 점유율(0~1). 배열 전체 합은 1(빈 배열이면 0). */
export interface AreaShare {
  areaCode: number;
  share: number;
}

/** 시·도별 설계 확률 — 균등(§6.9A)과 ⚖️ 가중(§6.9B)을 같은 축에 놓기 위한 쌍. */
export interface DesignProbability {
  areaCode: number;
  uniform: number;
  /** 가중치 재료(방문자 데이터)가 없으면 null — "모른다"를 0 으로 사칭하지 않는다. */
  weighted: number | null;
}

/** POST /api/events 소배치 상한(§7.15 — 페이로드 상한). */
export const MAX_EVENT_BATCH = 20;

/** sessionId·contentId 길이 상한 — 익명 UUID(36자)·contentId(≤10자리) 기준 여유값. */
const MAX_ID_LEN = 64;

/** 값 맵을 합=1 점유율로 정규화. 0·음수·비유한은 제외하고, 큰 순으로 정렬한다. */
function toShares(values: Iterable<[number, number]>): AreaShare[] {
  const usable = [...values].filter(
    ([, v]) => Number.isFinite(v) && v > 0,
  );
  const total = usable.reduce((s, [, v]) => s + v, 0);
  if (total <= 0) return [];
  return usable
    .map(([areaCode, v]) => ({ areaCode, share: v / total }))
    .sort((a, b) => b.share - a.share || a.areaCode - b.areaCode);
}

/**
 * ① 현실 — 외지인 방문자 시·도 점유율. 재료는 `areaVisitorSums`(⚖️ 와 공용).
 * 관측이 없는 시·도는 **행 자체가 없다**(0% 로 그리면 "방문자 0"으로 읽혀 사실과 다르다).
 */
export function visitorShares(sums: ReadonlyMap<number, number>): AreaShare[] {
  return toShares(sums);
}

/**
 * ② 설계 — 시·도 선택 확률. **시뮬레이션이 아니라 해석적 계산**이다
 * (`weightedPickOrder` 의 첫 선택 확률은 정확히 w/Σw 라 표본 노이즈가 0).
 *
 * @param areaCodes 대상 시·도. **입력 순서를 그대로 보존**한다 — 화면이 ①③과 같은 축을
 *   쓰려면 호출부가 정렬을 정해야 하기 때문(여기서 다시 정렬하면 축이 어긋난다).
 * @param weights `areaWeights` 산출물. null 이거나 합이 0 이면 weighted 전체가 null.
 */
export function designProbabilities(
  areaCodes: readonly number[],
  weights?: ReadonlyMap<number, number> | null,
): DesignProbability[] {
  const n = areaCodes.length;
  if (n === 0) return [];
  const uniform = 1 / n;

  const w = areaCodes.map((a) => {
    const v = weights?.get(a);
    return Number.isFinite(v) && v! > 0 ? v! : 0;
  });
  const total = w.reduce((s, v) => s + v, 0);

  return areaCodes.map((areaCode, i) => ({
    areaCode,
    uniform,
    weighted: total > 0 ? w[i] / total : null,
  }));
}

/** db/impact 의 group-by 산출물 1행(event × areaCode × 건수). */
export interface EventCountRow {
  event: string;
  areaCode: number | null;
  count: number;
}

/**
 * ③ 실측 — 서비스가 실제로 던진 제안의 시·도 분포.
 *
 * 제안 = **draw + redraw**(§7.15). redraw 를 빼면 "거절당한 제안"이 통계에서 사라져
 * 아전인수가 된다. areaCode 가 null 인 행은 귀속 불가라 분포·total 양쪽에서 제외한다
 * (total 은 "이 분포의 표본 수"여야 하므로 분모와 분자가 같은 집합이어야 한다).
 */
export function aggregateDrawEvents(rows: readonly EventCountRow[]): {
  total: number;
  shares: AreaShare[];
} {
  const byArea = new Map<number, number>();
  let total = 0;
  for (const r of rows) {
    if (r.event !== "draw" && r.event !== "redraw") continue;
    if (r.areaCode == null) continue;
    if (!Number.isFinite(r.count) || r.count <= 0) continue;
    byArea.set(r.areaCode, (byArea.get(r.areaCode) ?? 0) + r.count);
    total += r.count;
  }
  return { total, shares: toShares(byArea) };
}

/** ③ 퍼널 — 제안 → 수락 신호. ⚠️ 전역 카운트라 **연관이지 인과가 아니다**(§7.15). */
export interface Funnel {
  proposed: number;
  liked: number;
  navigated: number;
  visited: number;
}

export function funnelCounts(
  rows: readonly { event: string; count: number }[],
): Funnel {
  const f: Funnel = { proposed: 0, liked: 0, navigated: 0, visited: 0 };
  for (const r of rows) {
    if (!Number.isFinite(r.count) || r.count <= 0) continue;
    if (r.event === "draw" || r.event === "redraw") f.proposed += r.count;
    else if (r.event === "like") f.liked += r.count;
    else if (r.event === "navigate") f.navigated += r.count;
    else if (r.event === "visited") f.visited += r.count;
    // 그 밖의 이벤트는 무시 — 스키마가 늘어도 이 함수가 깨지지 않는다.
  }
  return f;
}

const EVENT_TYPES: ReadonlySet<string> = new Set<TravelEventType>([
  "draw",
  "redraw",
  "like",
  "navigate",
  "visited",
]);
const MODES: ReadonlySet<string> = new Set<Mode>(["pure", "filtered"]);
const AREA_SET: ReadonlySet<number> = new Set(ALL_AREA_CODES);

function optInt(v: unknown): number | null | undefined {
  if (v === undefined || v === null) return null;
  return typeof v === "number" && Number.isInteger(v) ? v : undefined;
}

/**
 * POST /api/events 페이로드 1건 검증 — 통과하면 §12.5 스키마로 정규화, 아니면 null.
 *
 * **미지 필드는 무시**(스키마 확장 내성)하되 **알려진 필드는 타입·화이트리스트를 강제**한다.
 * 익명 수집이라 인증이 없다 = 이 함수가 유일한 신뢰 경계다. areaCode 를 17개 시·도로
 * 좁히는 이유도 그것 — 통과시키면 ③ 실측 분포에 존재하지 않는 지역이 섞인다.
 */
export function parseTravelEvent(input: unknown): TravelEvent | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;

  if (typeof o.event !== "string" || !EVENT_TYPES.has(o.event)) return null;
  if (typeof o.sessionId !== "string") return null;
  if (o.sessionId.length === 0 || o.sessionId.length > MAX_ID_LEN) return null;
  if (typeof o.ts !== "number" || !Number.isInteger(o.ts)) return null;

  const mode =
    o.mode === undefined || o.mode === null
      ? null
      : typeof o.mode === "string" && MODES.has(o.mode)
        ? (o.mode as Mode)
        : undefined;
  if (mode === undefined) return null;

  const areaCode = optInt(o.areaCode);
  if (areaCode === undefined) return null;
  if (areaCode !== null && !AREA_SET.has(areaCode)) return null;

  const contentTypeId = optInt(o.contentTypeId);
  if (contentTypeId === undefined) return null;

  const contentId =
    o.contentId === undefined || o.contentId === null
      ? null
      : typeof o.contentId === "string" && o.contentId.length <= MAX_ID_LEN
        ? o.contentId
        : undefined;
  if (contentId === undefined) return null;

  return {
    event: o.event as TravelEventType,
    mode,
    areaCode,
    contentTypeId,
    contentId,
    sessionId: o.sessionId,
    ts: o.ts,
  };
}
