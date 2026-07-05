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
  dist?: string; // 📍 locationBasedList2 응답 — 기준점에서의 거리(m, M14)
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

/** 🌊 바다 배지(어느 바다 분류에서 나왔는지) */
export interface SeasideBadge {
  category: string; // 해수욕장·섬·항구·해안절경
  emoji: string;
}

/** 🦀 제철 배지(이 지역이 이번 달 산지인 품목들) */
export interface SeasonalBadge {
  items: { item: string; emoji: string }[];
}

/** 🎪 축제 배지(그 지역 오늘 진행 중 축제) */
export interface FestivalBadge {
  name: string; // 대표(첫) 축제명
  more: number; // 같은 지역 나머지 축제 수
}

/** ☔ 날씨 배지(뽑힌 지역이 지금 비 안 옴 + 기온) */
export interface WeatherBadge {
  temp: number | null; // 현재 기온(℃). 관측 없으면 null
}

/** 이번 뽑기가 어떤 지역·타입·조건에서 나왔는지(디버그·배지 표시용) */
export interface PickedInfo {
  areaCode: number | null;
  contentTypeId: number;
  totalCount: number;
  /** 🌊 바다 필터로 뽑혔을 때만. 아니면 null/생략 */
  seaside?: SeasideBadge | null;
  /** 🦀 제철 필터로 뽑혔고 그 지역이 산지일 때만. 아니면 null/생략 */
  seasonal?: SeasonalBadge | null;
  /** 🎪 축제 필터로 뽑혔을 때 그 지역 진행 중 축제. 아니면 null/생략 */
  festival?: FestivalBadge | null;
  /** ☔ 날씨 필터로 뽑혔을 때 그 지역 현재 날씨(비 안 옴+기온). 아니면 null/생략 */
  weather?: WeatherBadge | null;
  /** 📍 주변에서 뽑기(M14)로 나왔을 때 앵커에서의 거리(m). 아니면 null/생략 */
  distanceM?: number | null;
  /** 동적 필터(🎪·☔ 등) 소스 장애로 조건을 건너뛴 경우의 안내 문구 (§6.5) */
  notice?: string | null;
}

/** /api/random 성공 응답 */
export interface RandomResponse {
  place: Place;
  picked: PickedInfo;
}

/** /api/random 실패 응답 */
export interface ErrorResponse {
  error: string;
  /** 조건이 좁아 후보가 0건인 경우 등 구분용 */
  code?: "EMPTY_POOL" | "UPSTREAM_ERROR" | "BAD_REQUEST";
}
