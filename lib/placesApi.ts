// M10 동기화 API 의 순수 헬퍼 — 신뢰 못 할 요청 바디를 안전하게 정제/검증.
// (SQL 은 Drizzle 이 파라미터화하지만, 애플리케이션 스키마 형태는 여기서 지킨다.)

import type { SavedPlace } from "@/lib/travelStore";

export type PlaceList = "saved" | "visited";

/** 목록 종류가 saved/visited 인지 */
export function isPlaceList(x: unknown): x is PlaceList {
  return x === "saved" || x === "visited";
}

/** 한 번의 sync 요청에 담을 수 있는 최대 항목 수(남용 방지) */
export const MAX_SYNC_ITEMS = 2000;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** 신뢰 못 할 입력(요청 바디)을 SavedPlace 로 정제. contentId 없으면 null. */
export function sanitizePlace(x: unknown): SavedPlace | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.contentId !== "string" || o.contentId === "") return null;
  return {
    contentId: o.contentId,
    contentTypeId: num(o.contentTypeId) ?? 0,
    title: str(o.title) ?? "",
    address: str(o.address) ?? "",
    image: str(o.image),
    lat: num(o.lat),
    lng: num(o.lng),
    areaCode: num(o.areaCode),
    savedAt: num(o.savedAt) ?? 0,
  };
}

/** 배열을 정제 — 불량 항목은 버리고, 상한으로 자른다. */
export function sanitizePlaces(x: unknown): SavedPlace[] {
  if (!Array.isArray(x)) return [];
  const out: SavedPlace[] = [];
  for (const item of x) {
    const p = sanitizePlace(item);
    if (p) out.push(p);
    if (out.length >= MAX_SYNC_ITEMS) break;
  }
  return out;
}
