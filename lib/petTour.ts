// 🐕 반려동물 동반(§6.11) — detailPetTour2 행의 동반 정보 필드를 카드 칩으로 정규화(순수부).
//   행에는 title·좌표·이미지가 없다 — 그건 detailCommon2 조인이 담당하고, 여기선 동반 정보만.

import type { InfoChip, PetInfo } from "@/types/tour";
import { stripTags } from "@/lib/text";

/** 실측 확정 필드(2026-07-28) → 카드 라벨. 배열 순서가 곧 칩 표시 순서다. */
const PET_FIELDS = [
  ["acmpyTypeCd", "동반 유형"],
  ["acmpyPsblCpam", "동반 가능 동물"],
  ["acmpyNeedMtr", "동반 시 필요사항"],
  ["etcAcmpyInfo", "기타 안내"],
] as const;

/**
 * 🐕 풀에서 '여행지답다'고 볼 타입(§6.11) — 관광지·문화시설·여행코스·레포츠.
 * 나머지(32 숙박·38 쇼핑·39 음식점)는 상업 항목이라 우선순위를 뒤로 민다.
 * ⚠️ **하드 제외가 아니다** — 상류 풀 자체가 매장·카페·숙소를 포함한 "동반 가능한 장소"
 *    목록이라 전부 걸러내면 빈 결과가 잦다(표본 12건 중 관광지성 0건 실측 2026-07-28).
 */
const PREFERRED_PET_TYPES: ReadonlySet<number> = new Set([12, 14, 25, 28]);

export const isPreferredPetType = (contentTypeId: number): boolean =>
  PREFERRED_PET_TYPES.has(contentTypeId);

/**
 * 관광지성 **우선 소프트 편향** — 후보를 최대 tries 개 보며 preferred 가 나오면 즉시 수용,
 * 아니면 마지막 후보를 보관했다가 예산 소진 시 그대로 내준다(빈 결과보다 상업 항목이 낫다).
 * `pickMealItem`(카페 거부 후 3회째는 수용)의 "완벽주의 금지" 전례를 그대로 따른다.
 *
 * next 가 null 을 주면(빈 응답·비여행지 거부) 예산만 쓰고 보관 대상이 아니다.
 * 상류 호출은 next 안에 갇혀 있어 이 함수 자체는 네트워크를 모른다(배열 공급자로 단위 테스트).
 */
export async function pickPreferred<T>(
  tries: number,
  next: () => Promise<T | null>,
  preferred: (item: T) => boolean,
): Promise<T | null> {
  let last: T | null = null;
  for (let t = 0; t < tries; t++) {
    const item = await next();
    if (!item) continue;
    if (preferred(item)) return item;
    last = item;
  }
  return last;
}

/** 동반 정보 칩 — 값이 있는 필드만. 전부 비면 null(근거 없는 빈 배지 금지). */
export function normalizePetInfo(
  row: Partial<Record<(typeof PET_FIELDS)[number][0], string>>,
): PetInfo | null {
  const chips: InfoChip[] = [];
  for (const [key, label] of PET_FIELDS) {
    const value = stripTags(row[key] ?? "");
    if (value) chips.push({ label, value });
  }
  return chips.length > 0 ? { chips } : null;
}
