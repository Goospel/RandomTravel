// 🚫 비여행지 거부 필터 (§6.10) — TourAPI 풀에 섞인 생활·행정 시설을 뽑기에서 제외한다.
// 뽑기 전 경로가 지나는 초크포인트(tourapi.pickItemFrom)에서만 소비 — 후보 수 집계(§6.10)는 미보정.

import type { TourApiItem } from "@/types/tour";

/** 명백한 생활·행정 시설 cat3 — 실측 2026-07-28(전국 ~250건, 풀의 1.2%) */
export const BLOCKED_CAT3: ReadonlySet<string> = new Set([
  "A03020200", // 수련시설(청소년수련원·국민체육센터·복지회관)
  "A02060900", // 도서관
  "A02061400", // 학교
  "A02060400", // 컨벤션센터
  "A02061200", // 영화관
  "A02061000", // 대형서점
]);

/** cat3가 빈 항목 방어 — 그 단어가 들어가면 사실상 100% 생활시설인 조합만(넓은 패턴 금지) */
export const BLOCKED_TITLE_RE =
  /청소년수련|청소년센터|청소년회관|청소년문화의집|청소년야영장|수련원|수련관|교육센터|교육원|연수원|도서관|체육센터|체육관|국민체육|복지회관|복지센터|주민센터|평생교육|평생학습/;

/** 뽑기 결과로 내보낼 수 있는 항목인가 — 거부 목록(코드·제목) 어디에도 안 걸리면 true */
export function isDrawablePlace(
  item: Pick<TourApiItem, "cat3" | "title">,
): boolean {
  return (
    !(item.cat3 && BLOCKED_CAT3.has(item.cat3)) &&
    !BLOCKED_TITLE_RE.test(item.title ?? "")
  );
}
