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
export const ALL_CONTENT_TYPE_CODES: number[] = CONTENT_TYPES.map((c) => c.code);

// ─── 🌊 바다 필터 (M6, plan.md §6.3) ────────────────────────────────
// 대분류 A01(자연) > 중분류 A0101(자연관광지)의 바다 소분류 4종.
// areaBasedList2 의 cat3 파라미터로 그대로 사용 — 추가 API·키 불필요.

export interface SeaCategory {
  cat3: string;
  name: string;
  emoji: string;
}

export const SEA_CAT3: SeaCategory[] = [
  { cat3: "A01011100", name: "해안절경", emoji: "🌅" },
  { cat3: "A01011200", name: "해수욕장", emoji: "🏖️" },
  { cat3: "A01011300", name: "섬", emoji: "🏝️" },
  { cat3: "A01011400", name: "항구·포구", emoji: "⚓" },
];

// ─── 🎪 축제 필터 (M7, plan.md §6.2) ────────────────────────────────
// searchFestival2 응답은 areacode 가 거의 비고 areaCode 필터도 0 을 준다(2026-07 실측).
// 대신 법정동 시도 코드 lDongRegnCd 가 채워져 오므로, 그것을 TourAPI areaCode 로 변환한다.
// (강원 42→51·전북 45→52 처럼 특별자치도 전환으로 신·구 코드가 공존해 둘 다 매핑.)

export const LDONG_TO_AREA: Record<string, number> = {
  "11": 1, // 서울
  "26": 6, // 부산
  "27": 4, // 대구
  "28": 2, // 인천
  "29": 5, // 광주
  "30": 3, // 대전
  "31": 7, // 울산
  "36": 8, // 세종
  "41": 31, // 경기
  "42": 32, // 강원(구)
  "51": 32, // 강원특별자치도
  "43": 33, // 충북
  "44": 34, // 충남
  "45": 37, // 전북(구)
  "52": 37, // 전북특별자치도
  "46": 38, // 전남
  "47": 35, // 경북
  "48": 36, // 경남
  "50": 39, // 제주
};

// ─── 🦀 제철 달력 (M6, plan.md §6.4) ────────────────────────────────
// "이번 달 제철 재료 → 산지 시·도" 완성형 공공 API가 없어 정적 테이블로 구축.
// months = 제철 월(1-12, 걸침은 배열에 명시), areaCodes = 주산지 시·도(§5.4 코드).
// ⚠️ 1차 편성 — 널리 알려진 특산물·산지 위주. §13 백로그 "제철 달력 검수" 대상.

export interface SeasonalItem {
  item: string;
  emoji: string;
  months: number[];
  areaCodes: number[];
}

export const SEASONAL_CALENDAR: SeasonalItem[] = [
  // 겨울 (11~2월 걸침)
  { item: "대게", emoji: "🦀", months: [11, 12, 1, 2, 3], areaCodes: [35, 32] }, // 경북(울진·영덕)·강원
  { item: "방어", emoji: "🐟", months: [12, 1, 2], areaCodes: [39] }, // 제주(모슬포)
  { item: "굴", emoji: "🦪", months: [11, 12, 1, 2], areaCodes: [36, 38] }, // 경남(통영)·전남(여수)
  { item: "감귤", emoji: "🍊", months: [11, 12, 1], areaCodes: [39] }, // 제주
  { item: "딸기", emoji: "🍓", months: [1, 2, 3, 4], areaCodes: [34, 36] }, // 충남(논산)·경남(진주)
  { item: "사과", emoji: "🍎", months: [10, 11, 12], areaCodes: [35, 33] }, // 경북(청송)·충북(충주)
  // 봄 (3~5월)
  { item: "주꾸미", emoji: "🐙", months: [3, 4], areaCodes: [34, 37] }, // 충남(서천)·전북(군산)
  { item: "멸치", emoji: "🐟", months: [4, 5, 6], areaCodes: [6, 36] }, // 부산(기장)·경남(남해)
  { item: "매실", emoji: "🟢", months: [6], areaCodes: [38] }, // 전남(광양)
  // 여름 (6~8월)
  { item: "참외", emoji: "🍈", months: [5, 6, 7], areaCodes: [35] }, // 경북(성주)
  { item: "자두", emoji: "🟣", months: [6, 7], areaCodes: [35] }, // 경북(김천)
  { item: "마늘", emoji: "🧄", months: [6, 7], areaCodes: [36, 38] }, // 경남(남해)·전남(고흥)
  { item: "옥수수", emoji: "🌽", months: [7, 8], areaCodes: [32] }, // 강원(홍천·평창)
  { item: "복숭아", emoji: "🍑", months: [7, 8], areaCodes: [35, 33] }, // 경북(청도)·충북(음성)
  { item: "수박", emoji: "🍉", months: [7, 8], areaCodes: [34, 36] }, // 충남(부여)·경남(함안)
  { item: "전복", emoji: "🐚", months: [6, 7, 8], areaCodes: [38] }, // 전남(완도)
  // 가을 (9~10월)
  { item: "전어", emoji: "🐟", months: [9, 10, 11], areaCodes: [38, 34] }, // 전남(광양)·충남(서천)
  { item: "포도", emoji: "🍇", months: [8, 9], areaCodes: [33, 35] }, // 충북(영동)·경북(상주)
  { item: "갈치", emoji: "🐟", months: [8, 9, 10, 11], areaCodes: [39, 38] }, // 제주·전남(목포)
  { item: "대하", emoji: "🦐", months: [9, 10], areaCodes: [34, 2] }, // 충남(태안)·인천(연평)
  { item: "배", emoji: "🍐", months: [9, 10], areaCodes: [38] }, // 전남(나주)
  { item: "오징어", emoji: "🦑", months: [8, 9, 10, 11], areaCodes: [32, 35] }, // 강원(속초)·경북(울릉)
];
