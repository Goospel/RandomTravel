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
  cat3?: string; // 🧭 소분류 코드 — 코스 식사 슬롯의 카페·클럽 거부 판정용(M20)
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

/** 🎪 축제 배지(그 지역 진행 중 축제) */
export interface FestivalBadge {
  name: string; // 대표(첫) 축제명
  more: number; // 같은 지역 나머지 축제 수
  /** 📅 오늘 아닌 기준일이면 그 날짜 YYYYMMDD(카드에 "(M/D 기준)" 부가, §6.8). 오늘이면 null/생략 */
  baseYmd?: string | null;
}

/** ☔ 날씨 배지(뽑힌 지역이 지금 비 안 옴 + 기온) */
export interface WeatherBadge {
  temp: number | null; // 현재 기온(℃). 관측 없으면 null
}

/** 🍃 한적 예측 배지(M17, §6.7) — 뽑힌 시·군·구 집중률 백분위. pctRank ≤ 0.5일 때만 노출 */
export interface CongestionBadge {
  sigunguName: string; // 뽑힌 시·군·구명
  pctBelow: number; // round(pctRank×100) — "집중률 하위 N%"
  baseYmd: string; // 데이터 기준일 YYYYMMDD(실시간 아님·'예측' 표기용)
  /** 📅 예측 대상일 YYYYMMDD(= 요청 기준일, §6.8). 카드 배지 선두. 정상 경로에선 baseYmd 와 일치 */
  targetYmd: string;
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
  /** 🍃 한적 필터로 뽑혔고 그 시군구 집중률 하위(pctRank ≤ 0.5)일 때만. 아니면 null/생략 (§6.7) */
  congestion?: CongestionBadge | null;
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

/**
 * 🔢 /api/random/count 응답(M16) — 조건별 실시간 후보 수 배지용.
 *  - dynamic: 🎪·☔ 처럼 정확 집계 불가(값 대신 정성 라벨)
 *  - totalCount: 후보 총합. approx=true 면 예산 상한에 잘린 근사(≈ N곳+)
 */
export type CountResponse =
  | { dynamic: true }
  | { totalCount: number; approx: boolean };

// ─── 🧭 반나절 코스 (M20, §7.10) ────────────────────────────────────

/** 🧭 코스 한 스텝 — 슬롯(볼거리·식사·카페) + 그 장소(개요는 생략). */
export interface CourseStep {
  slot: "sight" | "meal" | "cafe";
  place: Place;
}

/** 🧭 /api/course 전체 응답 — 3스텝 타임라인 + 🍃 헤더 배지 + 슬롯 생략 안내. */
export interface CourseResponse {
  steps: CourseStep[];
  /** 🍃 앵커 시·군·구 한적 예측 배지(pctRank≤0.5·비stale·매핑 존재일 때만, 아니면 null). */
  congestion: CongestionBadge | null;
  /** 슬롯 생략 등 안내(없으면 null). */
  notice: string | null;
}

/** 🧭 /api/course?slot=… 스텝 재뽑기 응답. */
export interface CourseStepResponse {
  step: CourseStep;
  notice: string | null;
}
