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

/** 📍 주변에서 뽑기(M14) 반경(m). TourAPI locationBasedList2 최대치 20km. */
export const NEARBY_RADIUS_M = 20000;

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

// ─── ☔ 날씨 필터 (M11, plan.md §6.1) ────────────────────────────────
// 기상청 초단기실황(getUltraSrtNcst)은 위경도가 아니라 격자좌표(nx, ny)를 받는다.
// 17개 격자쌍을 손으로 옮기면 오타 위험이 커서, 시·도 대표점의 위경도만 상수로 두고
// 격자 변환은 lib/weather.ts 의 순수함수 latLngToGrid(기상청 LCC 공식)로 계산·검증한다.
// 대표점 = 각 시·도청/시청 소재지(§6.1: 시·도당 대표점 1곳, 도 내부 편차는 감수).

export interface AreaLatLng {
  lat: number;
  lng: number;
}

export const AREA_LATLNG: Record<number, AreaLatLng> = {
  1: { lat: 37.5665, lng: 126.978 }, // 서울시청
  2: { lat: 37.4563, lng: 126.7052 }, // 인천시청
  3: { lat: 36.3504, lng: 127.3845 }, // 대전시청
  4: { lat: 35.8714, lng: 128.6014 }, // 대구시청
  5: { lat: 35.1595, lng: 126.8526 }, // 광주시청
  6: { lat: 35.1796, lng: 129.0756 }, // 부산시청
  7: { lat: 35.5384, lng: 129.3114 }, // 울산시청
  8: { lat: 36.4801, lng: 127.2891 }, // 세종시청
  31: { lat: 37.2636, lng: 127.0286 }, // 경기(수원)
  32: { lat: 37.8813, lng: 127.7298 }, // 강원(춘천)
  33: { lat: 36.6357, lng: 127.4914 }, // 충북(청주)
  34: { lat: 36.6588, lng: 126.6728 }, // 충남(홍성 내포)
  35: { lat: 36.5684, lng: 128.7294 }, // 경북(안동)
  36: { lat: 35.238, lng: 128.6922 }, // 경남(창원)
  37: { lat: 35.8203, lng: 127.1088 }, // 전북(전주)
  38: { lat: 34.8161, lng: 126.4629 }, // 전남(무안 남악)
  39: { lat: 33.489, lng: 126.4983 }, // 제주시
};
