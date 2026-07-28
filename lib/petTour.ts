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
