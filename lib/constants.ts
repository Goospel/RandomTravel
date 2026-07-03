// 지역·관광타입 상수 — TourAPI 파라미터로 그대로 사용 (plan.md §5.3~5.4)
//
// ※ 격자좌표(☔ M7) / 바다 cat3(🌊 M6) / 제철 달력(🦀 M6) 상수는
//    각 마일스톤에서 이 파일에 추가된다. M1은 지역·타입만.

/** 17개 시·도 (TourAPI areaCode) */
export const AREA_CODES = [
  { code: 1, name: "서울" },
  { code: 2, name: "인천" },
  { code: 3, name: "대전" },
  { code: 4, name: "대구" },
  { code: 5, name: "광주" },
  { code: 6, name: "부산" },
  { code: 7, name: "울산" },
  { code: 8, name: "세종" },
  { code: 31, name: "경기" },
  { code: 32, name: "강원" },
  { code: 33, name: "충북" },
  { code: 34, name: "충남" },
  { code: 35, name: "경북" },
  { code: 36, name: "경남" },
  { code: 37, name: "전북" },
  { code: 38, name: "전남" },
  { code: 39, name: "제주" },
] as const;

export type AreaCode = (typeof AREA_CODES)[number]["code"];

/** 관광 타입 (TourAPI contentTypeId) */
export const CONTENT_TYPES = [
  { code: 12, name: "관광지" },
  { code: 14, name: "문화시설" },
  { code: 15, name: "축제·공연·행사" },
  { code: 25, name: "여행코스" },
  { code: 28, name: "레포츠" },
  { code: 32, name: "숙박" },
  { code: 38, name: "쇼핑" },
  { code: 39, name: "음식점" },
] as const;

export type ContentTypeId = (typeof CONTENT_TYPES)[number]["code"];

/**
 * 순수 랜덤에서 기본으로 뽑을 "여행지다운" 타입.
 * 숙박(32)·쇼핑(38)·음식점(39)을 제외한 잠정값 — plan.md §13 미결정.
 */
export const RANDOM_DEFAULT_TYPES: ContentTypeId[] = [12, 14, 15, 25, 28];

/** code → 한글명 조회 */
export const AREA_NAME: Record<number, string> = Object.fromEntries(
  AREA_CODES.map((a) => [a.code, a.name]),
);
export const CONTENT_TYPE_NAME: Record<number, string> = Object.fromEntries(
  CONTENT_TYPES.map((c) => [c.code, c.name]),
);

export const ALL_AREA_CODES: number[] = AREA_CODES.map((a) => a.code);
