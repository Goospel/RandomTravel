// 쿼리 파라미터 파싱·조립 — 순수 함수 (테스트 대상, plan.md §8)

import { ALL_AREA_CODES, ALL_CONTENT_TYPE_CODES } from "@/lib/constants";

/**
 * 콤마 문자열 → 유효 코드 배열.
 * 정수·양수만, 화이트리스트(valid)에 있는 것만, 중복 제거(첫 등장 순서 유지).
 * 잘못된 입력을 상류 API에 흘리지 않도록 경계에서 정리한다.
 */
export function parseCodeList(
  raw: string | null,
  valid: readonly number[],
): number[] {
  if (!raw) return [];
  const allowed = new Set(valid);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n <= 0) continue;
    if (!allowed.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export const parseAreaCodes = (raw: string | null): number[] =>
  parseCodeList(raw, ALL_AREA_CODES);

export const parseContentTypeIds = (raw: string | null): number[] =>
  parseCodeList(raw, ALL_CONTENT_TYPE_CODES);

/**
 * 모드·선택으로 /api/random 쿼리스트링을 만든다.
 * 순수 모드이거나 선택이 0개면 "" — "조건 0개 = 완전 랜덤" 불변식(§2)을 여기서 보장.
 */
export function buildRandomQuery(
  mode: "pure" | "filtered",
  areas: Iterable<number>,
  types: Iterable<number>,
): string {
  if (mode !== "filtered") return "";
  const params = new URLSearchParams();
  const a = [...areas];
  const t = [...types];
  if (a.length > 0) params.set("areas", a.join(","));
  if (t.length > 0) params.set("types", t.join(","));
  return params.toString();
}
