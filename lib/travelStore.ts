// 찜/최근/방문 목록의 순수 리스트 대수 (plan.md §5.1 기록, §7.1 방문좌표, §8 테스트)
//
// localStorage 접근은 여기서 하지 않는다(순수 유지·단위 테스트 가능).
// 실제 저장/로드는 hooks/useTravelStore 가 이 함수들을 조합해서 담당한다.

import type { Place } from "@/types/tour";

/** 목록·지도에 필요한 최소 필드 + 저장 시각. overview 같은 큰 필드는 저장 안 함. */
export interface SavedPlace {
  contentId: string;
  contentTypeId: number;
  title: string;
  address: string;
  image: string | null;
  lat: number | null;
  lng: number | null;
  areaCode: number | null;
  savedAt: number;
}

/** Place(뽑기 결과) → SavedPlace(저장용 최소 형태) */
export function toSavedPlace(place: Place, ts: number): SavedPlace {
  return {
    contentId: place.contentId,
    contentTypeId: place.contentTypeId,
    title: place.title,
    address: place.address,
    image: place.image,
    lat: place.lat,
    lng: place.lng,
    areaCode: place.areaCode,
    savedAt: ts,
  };
}

/** contentId 포함 여부 */
export function has(list: SavedPlace[], contentId: string): boolean {
  return list.some((x) => x.contentId === contentId);
}

/**
 * 최근 본 곳: 새 항목을 맨 앞에 두고, 같은 contentId 는 제거해 중복을 없앤 뒤,
 * 상한 cap 으로 뒤(오래된 것)를 잘라낸다. 원본 불변.
 */
export function addToRecent(
  list: SavedPlace[],
  item: SavedPlace,
  cap: number,
): SavedPlace[] {
  const n = Math.max(0, Math.trunc(cap)); // cap≤0/소수 방어 — 상한은 항상 0 이상 정수
  if (n === 0) return [];
  const rest = list.filter((x) => x.contentId !== item.contentId);
  return [item, ...rest].slice(0, n);
}

/**
 * 찜/방문 토글: 있으면 제거, 없으면 맨 앞에 추가. contentId 기준. 원본 불변.
 */
export function toggleSaved(
  list: SavedPlace[],
  item: SavedPlace,
): SavedPlace[] {
  if (has(list, item.contentId)) {
    return list.filter((x) => x.contentId !== item.contentId);
  }
  return [item, ...list];
}

/** SavedPlace[] → 저장 문자열 */
export function serialize(list: SavedPlace[]): string {
  return JSON.stringify(list);
}

/**
 * 저장 문자열 → SavedPlace[]. 손상(널·깨진 JSON·비배열·contentId 없음)에
 * 절대 throw 하지 않고 안전하게 걸러낸다.
 */
export function parseStored(raw: string | null): SavedPlace[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.filter(
    (x): x is SavedPlace =>
      !!x && typeof x === "object" && typeof (x as SavedPlace).contentId === "string",
  );
}
