// TourAPI 응답 타입 — KorService areaBasedList / detailCommon 공통 필드.
// (필드명은 구현 중 실제 응답으로 최종 검증 — plan.md §13)

/** areaBasedList item 원본 중 관심 필드 */
export interface TourApiItem {
  contentid: string;
  contenttypeid: string;
  title: string;
  addr1?: string;
  addr2?: string;
  firstimage?: string; // 대표 이미지(원본)
  firstimage2?: string; // 썸네일
  mapx?: string; // 경도 longitude
  mapy?: string; // 위도 latitude
  areacode?: string;
  tel?: string;
  overview?: string; // detailCommon 보강 시
}

/** 카드 렌더용으로 정규화한 여행지 1건 */
export interface Place {
  contentId: string;
  contentTypeId: number;
  title: string;
  address: string;
  image: string | null;
  lat: number | null; // mapy
  lng: number | null; // mapx
  areaCode: number | null;
  overview: string | null;
}

/** /api/random 성공 응답 */
export interface RandomResponse {
  place: Place;
  /** 이번 뽑기가 어떤 지역·타입 풀에서 나왔는지(디버그·표시용) */
  picked: { areaCode: number | null; contentTypeId: number; totalCount: number };
}

/** /api/random 실패 응답 */
export interface ErrorResponse {
  error: string;
  /** 조건이 좁아 후보가 0건인 경우 등 구분용 */
  code?: "EMPTY_POOL" | "UPSTREAM_ERROR" | "BAD_REQUEST";
}
