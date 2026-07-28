// TourAPI 텍스트 정리 — 상류 필드에 <br>·&nbsp; 가 섞여 오므로 노출 전 한 번 씻는다.
//   tourapi(개요)·petTour(동반 안내)·barrierFree(편의시설) 셋이 공유한다.

/** 태그·기본 엔티티 제거 + 연속 공백 축약 + trim. */
export function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
