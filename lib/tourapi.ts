// TourAPI(KorService2) 호출 래퍼 + "진짜 랜덤" 추출 (plan.md §5)
//
// 리서치 확정 사항(2026-07-03):
//  - 베이스 https://apis.data.go.kr/B551011/KorService2, 모든 오퍼레이션에 접미사 `2`
//  - 서비스키는 **Decoding 키**를 URLSearchParams.set 으로 넘겨 정확히 1회만 인코딩
//    (Encoding 키를 넣으면 %2B → %252B 이중 인코딩 → resultCode 30 키 미등록 오류)
//  - HTTP 200 이어도 response.header.resultCode 로 실패 판별
//  - 0건이면 body.items 가 빈 문자열 "" 로 올 수 있음 → 배열 파싱 전 방어

import type {
  Place,
  TourApiItem,
  PickedInfo,
  CountResponse,
  CourseStep,
  InfoChip,
} from "@/types/tour";
import {
  RANDOM_DEFAULT_TYPES,
  SEA_CAT3,
  ALL_AREA_CODES,
  AREA_TO_LDONG,
  NEARBY_RADIUS_M,
  COURSE_RADII,
} from "@/lib/constants";
import { ldongToAreaCode } from "@/lib/ldong";
import {
  COURSE_SLOTS,
  type CourseSlot,
  type CourseSlotDef,
} from "@/lib/course";
import { planCandidateCount, type CountParams } from "@/lib/candidateCount";
import { isDrawablePlace } from "@/lib/placeFilter";
import { normalizePetInfo, isPreferredPetType, pickPreferred } from "@/lib/petTour";
import { normalizeWithFacilities } from "@/lib/barrierFree";
import { stripTags } from "@/lib/text";
import {
  narrowBySeasonal,
  seasonalItemsForArea,
  dishSeasonalItemsForArea,
  resolveMonth,
} from "@/lib/season";
import {
  normalizeFestivals,
  festivalsByArea,
  festivalBadge,
  type Festival,
  type RawFestival,
} from "@/lib/festival";
import { getWeatherByArea } from "@/lib/kma";
import {
  rainFreeAreaCodes,
  narrowByWeather,
  weatherBadge,
  type WeatherObs,
} from "@/lib/weather";
import {
  rankDaily,
  quietAreaCodes,
  narrowByQuiet,
  congestionBadge,
  congestionStale,
  kstYmd,
  QUIET_AREA_CUT,
} from "@/lib/congestion";
import { getCongestionDay, getVisitorRecent } from "@/db/congestion";
import { areaWeights, orderByWeightedArea } from "@/lib/scatter";
import { LDONG_TO_APP_AREA } from "@/lib/congestionCodes";
import { sigunguAt } from "@/lib/conquer";
import { emptySpotSigunguSet, eligibleCells } from "@/lib/emptySpot";
import type { TourSigunguCell } from "@/lib/tourSigungu";
import { fetchWithTimeout } from "@/lib/apiFetch";

const SERVICE_ROOT = "https://apis.data.go.kr/B551011";
/** 기본 서비스. endpoint 에 "/" 가 없으면 이 서비스의 오퍼레이션으로 본다. */
const DEFAULT_SERVICE = "KorService2";
/** ♿ 무장애 여행 정보 서비스(§6.11) — 활용신청 별개(쿼터 독립), 응답 스키마는 KorService2 와 동일. */
export const WITH_SERVICE = "KorWithService2";
/** 🐕 반려동물 동반여행 오퍼레이션(§6.11) — KorService2 에 통합돼 있어 추가 신청 불필요. */
const PET_ENDPOINT = "detailPetTour2";

export type TourErrorCode = "UPSTREAM_ERROR" | "EMPTY_POOL" | "BAD_REQUEST";

export class TourApiError extends Error {
  code: TourErrorCode;
  constructor(message: string, code: TourErrorCode = "UPSTREAM_ERROR") {
    super(message);
    this.name = "TourApiError";
    this.code = code;
  }
}

/**
 * 뽑기 **전체**를 1회 재실행할 오류인가(§6.5).
 *
 * apiFetch 의 "타임아웃은 같은 URL 재시도 금지"와 충돌하지 않는다 — 뽑기를 통째로 다시 굴리면
 * 랜덤 인덱스·버킷이 새로 뽑혀 **다른 URL**을 때리므로 느린 상류를 곧바로 다시 기다리지 않는다.
 * EMPTY_POOL(조건에 맞는 곳이 없음)·BAD_REQUEST 는 다시 굴려도 같은 결론이라 제외한다.
 */
export function isRetryableDrawError(e: unknown): boolean {
  return e instanceof TourApiError && e.code === "UPSTREAM_ERROR";
}

interface TourBody {
  totalCount?: number;
  numOfRows?: number;
  pageNo?: number;
  items?: "" | { item?: TourApiItem | TourApiItem[] };
}

interface TourEnvelope {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: TourBody;
  };
  // 일부 오퍼레이션은 파라미터 오류를 **평평한** 봉투로 준다(실측: detailPetTour2 에
  // areaCode 를 넘기면 `{resultCode:"10", resultMsg:"INVALID_REQUEST_PARAMETER_ERROR"}`,
  // response.header 없음). 성공 판정은 header 기준이라 이미 실패로 잡히지만, 메시지가
  // "알 수 없는 오류"로 뭉개지지 않게 여기서 읽는다.
  resultCode?: string;
  resultMsg?: string;
}

/** 캐싱 정책: 24시간 재검증 or 캐시 안 함 */
type Caching = { revalidate: number } | "no-store";

/**
 * @param endpoint 오퍼레이션명(`areaBasedList2`) 또는 `서비스/오퍼레이션`(`KorWithService2/areaBasedList2`).
 *   서비스를 앞에 붙이는 방식이라 getTotalCount·getItemAt·pickItemFrom 에 인자를 더 뚫지 않아도
 *   되고, **URL 이 서비스별로 갈려 24h count 캐시가 자동 분리**된다(§6.11).
 */
async function tourFetch(
  endpoint: string,
  params: Record<string, string | number>,
  caching: Caching,
): Promise<TourBody> {
  const key = process.env.TOUR_API_KEY;
  if (!key) {
    throw new TourApiError(
      "서버에 관광 데이터 키(TOUR_API_KEY)가 설정되지 않았어요.",
      "UPSTREAM_ERROR",
    );
  }

  const sp = new URLSearchParams();
  // ⚠️ Decoding 키를 그대로 set — URLSearchParams가 +,= 를 한 번만 인코딩한다
  sp.set("serviceKey", key);
  sp.set("MobileOS", "ETC");
  sp.set("MobileApp", "RandomTravel");
  sp.set("_type", "json");
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));

  const path = endpoint.includes("/") ? endpoint : `${DEFAULT_SERVICE}/${endpoint}`;
  const url = `${SERVICE_ROOT}/${path}?${sp.toString()}`;
  const init: RequestInit =
    caching === "no-store"
      ? { cache: "no-store" }
      : { next: { revalidate: caching.revalidate } };

  let res: Response;
  try {
    // 8초 타임아웃 + 1회 재시도(§6.5) — 상류가 응답을 붙잡고 있어도 뽑기가 무한 대기하지 않는다.
    res = await fetchWithTimeout(url, init);
  } catch {
    // 연결 실패·타임아웃 모두 사용자 관점에선 "응답이 없다" — 재시도 버튼은 상단 "다시 뽑기".
    throw new TourApiError("관광 데이터가 응답이 없어요. 다시 한번 뽑아보세요.");
  }

  const text = await res.text();
  let json: TourEnvelope;
  try {
    json = JSON.parse(text) as TourEnvelope;
  } catch {
    // 인증·쿼터 오류는 게이트웨이가 XML 봉투로 준다 (_type=json 무시)
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS|returnReasonCode>22</.test(text)) {
      throw new TourApiError(
        "관광 데이터 요청 한도를 초과했어요. 잠시 후 다시 시도해 주세요.",
      );
    }
    throw new TourApiError(
      "관광 데이터 응답을 해석하지 못했어요. (서비스키 등록·인코딩을 확인하세요)",
    );
  }

  const code = json.response?.header?.resultCode ?? json.resultCode;
  if (code !== "0000") {
    const msg =
      json.response?.header?.resultMsg ?? json.resultMsg ?? "알 수 없는 오류";
    throw new TourApiError(`관광 데이터 오류: ${msg} (code ${code ?? "?"})`);
  }
  return json.response?.body ?? {};
}

/** body.items → 항목 배열 (0건이면 "" , 1건이면 객체, 다건이면 배열로 오는 걸 흡수) */
function itemsOf(body: TourBody): TourApiItem[] {
  const items = body.items;
  if (!items || !items.item) return [];
  const arr = Array.isArray(items.item) ? items.item : [items.item];
  // contentid 없는 malformed 항목은 버린다 (뽑히면 재추첨으로 유도)
  return arr.filter((it) => it && it.contentid);
}

interface Query {
  contentTypeId: number;
  areaCode?: number;
  /** 🌊 바다 소분류(cat3). 있으면 areaBasedList2 에 cat3 파라미터로 얹는다. */
  cat3?: string;
  /** 🔭 TourAPI sigunguCode(§7.11). areaCode 와 함께 얹어 시·군·구 셀로 좁힌다(URL 캐시 자동 분리). */
  sigunguCode?: string;
  /** ⚖️ 법정동 시도 코드(§6.9A). 무지역 뽑기의 시·도 버킷 — areaCode 대신 쓴다. */
  lDongRegnCd?: string;
}

function queryParams(q: Query): Record<string, string | number> {
  const p: Record<string, string | number> = { contentTypeId: q.contentTypeId };
  if (q.areaCode) p.areaCode = q.areaCode;
  if (q.cat3) p.cat3 = q.cat3;
  if (q.sigunguCode) p.sigunguCode = q.sigunguCode;
  // 파라미터가 URL 에 그대로 들어가 24h getTotalCount 캐시 키가 버킷 단위로 자연 분화된다.
  if (q.lDongRegnCd) p.lDongRegnCd = q.lDongRegnCd;
  return p;
}

type ListParams = Record<string, string | number>;

/** 조합의 전체 개수 — 거의 안 변하므로 24h 캐시 (§5.6). endpoint 로 지역/위치 경로 공용. */
async function getTotalCount(
  endpoint: string,
  params: ListParams,
): Promise<number> {
  const body = await tourFetch(
    endpoint,
    { ...params, numOfRows: 1, pageNo: 1 },
    { revalidate: 86400 },
  );
  return body.totalCount ?? 0;
}

/** 정렬된 전체 목록의 index번째 1건 (1-indexed). 캐시 금지 — 매 뽑기가 달라야 함 */
async function getItemAt(
  endpoint: string,
  params: ListParams,
  index: number,
): Promise<TourApiItem | null> {
  const body = await tourFetch(
    endpoint,
    { ...params, numOfRows: 1, pageNo: index },
    "no-store",
  );
  return itemsOf(body)[0] ?? null;
}

/**
 * detailCommon2 개요 보강 — 실패해도 뽑기를 막지 않는다(best-effort).
 * ⚠️ 뽑기 응답 안에서 부르지 않는다(§5.6) — contentId 가 매번 달라 24h 캐시가 항상 미스라
 *    뽑기마다 상류 왕복 1회가 통째로 붙는다. `/api/overview` 가 카드 노출 뒤에 부른다.
 */
export async function getOverview(contentId: string): Promise<string | null> {
  try {
    const ov = (await detailCommonItem(contentId))?.overview;
    return ov ? stripTags(ov) : null;
  } catch {
    return null;
  }
}

/** detailCommon2 1건 원본 — 개요만 쓰는 getOverview 와 카드 전체를 쓰는 🐕 조인(§6.11)이 공유. */
async function detailCommonItem(contentId: string): Promise<TourApiItem | null> {
  const body = await tourFetch(
    "detailCommon2",
    { contentId },
    { revalidate: 86400 },
  );
  return itemsOf(body)[0] ?? null;
}

/**
 * ♿ detailWithTour2 무장애 편의시설 칩(§6.11) — 개요와 같은 지연 로드 경로에서 best-effort.
 * 항목마다 **채워진 필드만** 오므로 없는 시설은 "없음"이 아니라 정보 없음이다(lib/barrierFree).
 */
export async function getWithFacilities(contentId: string): Promise<InfoChip[]> {
  try {
    const body = await tourFetch(
      `${WITH_SERVICE}/detailWithTour2`,
      { contentId },
      { revalidate: 86400 },
    );
    const item = itemsOf(body)[0];
    return item
      ? normalizeWithFacilities(item as unknown as Record<string, string | undefined>)
      : [];
  } catch {
    return []; // 부가 정보 — 카드를 죽이지 않는다(getOverview 계약 동형)
  }
}

/**
 * 🎪 오늘 진행 중인 축제를 지역별로 묶어 반환 (§6.2).
 * searchFestival2 는 eventStartDate 이후 '아직 안 끝난'(진행중+예정) 축제를 주므로,
 * 받은 목록을 시작 ≤ 오늘 ≤ 종료 로 걸러 '진행 중'만 남긴다. 하루 안엔 거의 안 변해 1h 캐시.
 *
 * ⚠️ arrange="A"(제목순)이라 절단축이 '진행중 여부'와 무관 → 한 페이지로 자르면 진행중
 *    축제가 조용히 누락될 수 있다. 그래서 totalCount 만큼 **페이지네이션으로 전량 수집**한다.
 * 실패(네트워크·쿼터·resultCode≠0000)하면 TourApiError 를 그대로 던진다 — 호출부(drawRandom)가
 *    이를 잡아 "축제 필터만 건너뛰고" 결과는 살린다(§6.5, 조용히 무시하지 않도록 안내).
 */
async function getFestivalMap(today: string): Promise<Map<number, Festival[]>> {
  const PAGE = 100;
  const MAX_PAGES = 15; // 안전 상한(최대 1500건) — 실측 '안 끝난' ~174건의 넉넉한 여유
  const raws: RawFestival[] = [];
  let total = Infinity;
  for (let pageNo = 1; (pageNo - 1) * PAGE < total && pageNo <= MAX_PAGES; pageNo++) {
    const body = await tourFetch(
      "searchFestival2",
      { eventStartDate: today, numOfRows: PAGE, pageNo, arrange: "A" },
      { revalidate: 3600 },
    );
    total = body.totalCount ?? 0;
    const page = itemsOf(body) as unknown as RawFestival[];
    if (page.length === 0) break; // 방어: 빈 페이지면 종료
    raws.push(...page);
  }
  if (total > MAX_PAGES * PAGE) {
    console.warn(
      `[getFestivalMap] 축제 ${total}건 — 상한 ${MAX_PAGES * PAGE}건까지만 조회(일부 누락 가능).`,
    );
  }
  return festivalsByArea(normalizeFestivals(raws, today));
}

function toNum(s?: string): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizePlace(
  item: TourApiItem,
  overview: string | null,
): Place {
  const address = [item.addr1, item.addr2].filter(Boolean).join(" ").trim();
  const ctid = Number(item.contenttypeid); // 누락 시 NaN 방어
  return {
    contentId: item.contentid,
    contentTypeId: Number.isFinite(ctid) ? ctid : 0,
    title: item.title || "이름 미상",
    address,
    image: item.firstimage || item.firstimage2 || null,
    lat: toNum(item.mapy), // mapy = 위도
    lng: toNum(item.mapx), // mapx = 경도
    areaCode: item.areacode ? Number(item.areacode) : null,
    overview,
  };
}

/** Fisher-Yates in-place 셔플 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface DrawParams {
  /** 선택된 지역들 — 비면 전국 */
  areaCodes?: number[];
  /** 선택된 관광 타입들 — 비면 RANDOM_DEFAULT_TYPES */
  contentTypeIds?: number[];
  /** 🌊 바다: 대상을 바다 관광지(cat3 4종·타입 12)로 한정 (§6.3) */
  seaside?: boolean;
  /** 🐕 반려동물 동반: detailPetTour2 전국 목록에서 뽑고 detailCommon2 로 카드 구성 (§6.11) */
  pet?: boolean;
  /** ♿ 무장애: 같은 조합 경로를 KorWithService2 로 갈아 끼운다(지역·테마·필터와 AND, §6.11) */
  barrierFree?: boolean;
  /** 🦀 제철: 지역 풀을 이번 달 제철 산지로 교집합 (§6.4) */
  seasonal?: boolean;
  /** 🎪 축제: 지역 풀을 오늘 진행 중 축제가 있는 지역으로 교집합 (§6.2) */
  festivalOnly?: boolean;
  /** ☔ 날씨: 지역 풀을 지금 비 안 오는 지역으로 교집합 (§6.1) */
  noRain?: boolean;
  /** 🍃 한적: 성수기 예측 시·도를 풀에서 제거 (배치 DB 조회, §6.7) */
  quiet?: boolean;
  /**
   * ⚖️ 분산 모드(§6.9B) — 시·도 선택을 균등에서 **외지인 방문자수 √역가중**으로. 기본 OFF.
   * 필터가 아니라 **분포 축**이라 후보 풀은 안 바뀐다(후보 수 배지 무변이 불변식).
   * 🌊·📍·🔭 경로에는 미적용(각각 이미 다른 선택 축을 쓴다 — 1단계 범위).
   */
  scatter?: boolean;
  /** 제철 기준 월(1-12). 미지정 시 현재 월 — 테스트·일관성 주입용 */
  month?: number;
  /** 축제 기준 날짜 YYYYMMDD. 미지정 시 오늘(KST) — 테스트·일관성 주입용 */
  today?: string;
  /** 날씨 기준 시각. 미지정 시 현재 — 테스트·일관성 주입용 */
  now?: Date;
  /** 📅 방문 시점 기준일 YYYYMMDD(§6.8). 켜진 조건의 판정 날짜만 바꾼다(날짜 단독=완전 랜덤).
      우선순위: 명시 주입(month·today) > dateYmd 파생 > 현재시각. */
  dateYmd?: string;
}

/** 배지 계산에 필요한 문맥 — 어느 조건이 켜졌는지 + 조회된 축제·날씨·혼잡도. */
interface BadgeCtx {
  month: number;
  seasonal: boolean;
  festivalMap: Map<number, Festival[]> | null;
  /** 🎪 오늘 아닌 기준일이면 그 날짜 YYYYMMDD(배지 "(M/D 기준)"), 오늘이면 null (§6.8). */
  festivalBaseYmd: string | null;
  weatherObs: Map<number, WeatherObs> | null;
  /** 🍃 조회된 그날 전국 시군구 pctRank(법정동cd→pctRank). null = 필터 꺼짐/스킵 → 배지 없음 */
  sigunguRanks: Map<string, number> | null;
  /** 🍃 데이터 기준일 YYYYMMDD(배지 문구용). */
  congestionBaseYmd: string | null;
  /** 🍃 예측 대상일 = 요청 기준일 YYYYMMDD(배지 선두, §6.8). 정상 경로에선 baseYmd 와 일치. */
  congestionTargetYmd: string | null;
}

/** 🍃 뽑힌 좌표 → 시군구 → 법정동 → pctRank 로 한적 배지(pctRank ≤ 0.5일 때만). 데이터 없으면 null. */
function congestionBadgeFor(
  ctx: BadgeCtx,
  lat: number | null,
  lng: number | null,
): PickedInfo["congestion"] {
  if (!ctx.sigunguRanks || !ctx.congestionBaseYmd || lat == null || lng == null) {
    return null;
  }
  const sg = sigunguAt(lat, lng); // §7.4 점-다각형 + 최근접 스냅
  if (!sg) return null;
  return congestionBadge(
    sg.area,
    sg.name,
    ctx.sigunguRanks,
    ctx.congestionBaseYmd,
    ctx.congestionTargetYmd ?? ctx.congestionBaseYmd, // 예측 대상일(요청 기준일)
  );
}

/** 🎪 축제 배지 + 오늘 아닌 기준일이면 그 날짜 부착("(M/D 기준)" — 시작 전 축제 오해 방지, §6.8). */
function festivalBadgeFor(ctx: BadgeCtx, areaCode: number | null) {
  if (!ctx.festivalMap) return null;
  const f = festivalBadge(ctx.festivalMap, areaCode);
  return f ? { ...f, baseYmd: ctx.festivalBaseYmd } : null;
}

/** 뽑힌 지역에 대한 배지들(제철·축제·날씨·한적)을 한 번에 계산. lat/lng 는 🍃 배지용(뽑힌 좌표). */
function buildBadges(
  areaCode: number | null,
  ctx: BadgeCtx,
  lat: number | null = null,
  lng: number | null = null,
): Pick<PickedInfo, "seasonal" | "festival" | "weather" | "congestion"> {
  return {
    seasonal: ctx.seasonal ? seasonalBadge(areaCode, ctx.month) : null,
    festival: festivalBadgeFor(ctx, areaCode),
    weather: ctx.weatherObs ? weatherBadge(ctx.weatherObs, areaCode) : null,
    congestion: congestionBadgeFor(ctx, lat, lng),
  };
}

export interface DrawResult {
  place: Place;
  picked: PickedInfo;
}

const COMBO_BUDGET = 34; // 상류 getTotalCount 호출 상한 (대부분 24h 캐시)
const MAX_INDEX_TRIES = 3;
const EMPTY_SPOT_CELL_TRIES = 3; // 🔭 셀 순회 상한(§7.11) — 워스트 3셀×(count 5+item 3), 개요는 별도(§5.6)
const RESTAURANT_TYPE = 39; // 🍽️ 음식점 contentTypeId — 🦀 제철과 조합 시 품목-맛집 키워드 매칭 대상
/**
 * 🐕 시도 예산(§6.11) — **시도 1회당 상류 2콜**(목록 1 + detailCommon2 조인 1)이라 워스트 8콜.
 * 관광지성 비율이 낮아(표본 12건 중 0건) 3회로는 편향이 거의 안 걸리고, 5회 이상은 워스트
 * 10콜로 뽑기 지연이 눈에 띈다 — 4회가 "체감 지연 안 늘리면서 편향이 실제로 걸리는" 지점.
 */
const PET_DRAW_TRIES = 4;

/** count 가중 랜덤 인덱스 — 큰 풀일수록 뽑힐 확률↑ (개수 적은 분류로의 쏠림 방지, §6.3) */
export function weightedIndex(
  weights: number[],
  rand: number = Math.random(),
): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let r = rand * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * 결정된 조합에서 항목 1건 뽑기(인덱스 최대 MAX_INDEX_TRIES 재시도). 실패 시 null.
 * exclude(contentId) 에 든 항목이 뽑히면 같은 루프 안에서 인덱스 재추첨(🧭 코스 중복 제외, §7.10).
 * accept(선택) 가 false 를 주면(🔭 좌표 검증 실패, §7.11) 같은 루프로 재추첨 — 빈 응답·exclude·
 *   accept 거부를 하나의 재시도 예산(MAX_INDEX_TRIES)으로 통합한다.
 * 비여행지(생활·행정 시설, §6.10)도 같은 루프에서 재추첨 — 전 뽑기 경로가 여기를 지나는 초크포인트.
 */
async function pickItemFrom(
  endpoint: string,
  params: ListParams,
  totalCount: number,
  exclude?: Set<string>,
  accept?: (item: TourApiItem) => boolean,
): Promise<TourApiItem | null> {
  for (let t = 0; t < MAX_INDEX_TRIES; t++) {
    const index = Math.floor(Math.random() * totalCount) + 1; // 1..totalCount 폐구간
    const item = await getItemAt(endpoint, params, index);
    if (!item) continue; // stale count 로 빈 결과 → 재추첨
    if (exclude && exclude.has(item.contentid)) continue; // 앵커·기존 스텝 → 재추첨
    if (accept && !accept(item)) continue; // 🔭 좌표가 sigunguSet 밖 → 재추첨
    if (!isDrawablePlace(item)) continue; // 비여행지(생활·행정 시설) → 재추첨 (§6.10)
    return item;
  }
  return null;
}

/** 🦀 제철 배지 — 이 지역이 이번 달 산지인 품목들(없으면 null) */
function seasonalBadge(
  areaCode: number | null,
  month: number,
): PickedInfo["seasonal"] {
  const items = seasonalItemsForArea(areaCode, month).map((s) => ({
    item: s.item,
  }));
  return items.length > 0 ? { items } : null;
}

/**
 * 🦀+🍽️ 제철 음식점 매칭 — 이 지역 이번 달 dish 제철 품목명으로 그 지역 맛집을 실제 검색한다.
 * dish 품목(회·해산물)을 셔플해 하나씩 searchKeyword2, 결과가 있는 첫 품목의 맛집 1건 + 매칭
 * 품목을 반환. dish 품목이 없거나(수박 산지) 전부 0건이면 null → 호출부가 일반 음식점으로 폴백.
 * 이렇게 "제철 재료 ↔ 뽑힌 식당"을 맞춰 '수박 제철 지역의 횟집' 같은 미스매치를 없앤다(§6.4).
 */
async function pickSeasonalRestaurant(
  areaCode: number,
  month: number,
): Promise<{
  item: TourApiItem;
  matched: { item: string };
  count: number;
} | null> {
  const dishItems = shuffle(dishSeasonalItemsForArea(areaCode, month));
  for (const s of dishItems) {
    const params: ListParams = {
      keyword: s.item,
      contentTypeId: RESTAURANT_TYPE,
      areaCode,
    };
    const count = await getTotalCount("searchKeyword2", params);
    if (count <= 0) continue; // 이 품목 맛집 0건 → 다음 dish 품목
    const picked = await pickItemFrom("searchKeyword2", params, count);
    if (picked)
      return { item: picked, matched: { item: s.item }, count };
  }
  return null;
}

/**
 * 랜덤 여행지 1건.
 *  - contentTypeIds 미지정: RANDOM_DEFAULT_TYPES 에서 타입 선택 → 타입 균등(항목 균등 아님, §13).
 *  - areaCodes 미지정: 전국 대상. 지정되면 그 지역들 중에서.
 *  - seasonal(🦀): 지역 풀을 이번 달 제철 산지로 교집합(§6.4). 결과에 제철 배지.
 *  - seaside(🌊): 대상을 바다 cat3 4종·타입 12로 한정하고 totalCount 가중 선택(§6.3).
 *  - 조건이 모두 비면 완전 랜덤 — "조건 0개 = 완전 랜덤" 불변식(§2)이 구조로 보장된다.
 *
 *  ※ getTotalCount 는 24h 캐시(§5.6)라, count가 늘어난 직후 새 꼬리 항목은
 *    최대 24h 노출이 지연될 수 있다(허용 트레이드오프).
 */
export async function drawRandom(params: DrawParams = {}): Promise<DrawResult> {
  // 🐕 반려동물 동반(§6.11) — 상류가 지역·타입 필터를 안 받는 **전국 전용 소경로**라
  //   아래 지역 풀 파이프라인(🎪·☔·🦀·🍃)을 통째로 건너뛴다. 위에서 분기해야 적용되지도
  //   않을 조건 때문에 상류 왕복이 낭비되지 않는다.
  if (params.pet) return drawPet(params);

  // 📅 방문 시점(§6.8) — 켜진 조건의 판정 날짜만 바꾼다. 요청당 단일 시계(todayYmd)로 일관.
  const todayYmd = kstYmd(params.now);
  const month = resolveMonth(params); // 명시 month > dateYmd 파생 > 현재 월

  // 1) 지역 풀 (비면 전국=null)
  let areaPool: number[] | null =
    params.areaCodes && params.areaCodes.length > 0 ? [...params.areaCodes] : null;

  // 동적 필터(🎪·☔) 소스 장애로 건너뛴 사실을 모아 결과에 노출(§6.5). 여러 개면 이어붙인다.
  // 문구는 성공(결과 배지)·실패(빈 풀 오류) 양쪽에서 맞도록 "조건은 제외했어요"로 중립화한다.
  const notices: string[] = [];

  // 빈 풀 오류를 던질 때 이미 쌓인 skip notice 를 메시지에 동봉 — 파이프라인 조기 종료로
  // notice 가 유실되거나, 빈 풀 원인이 한 조건 단독으로 오귀속되는 것을 막는다(리뷰 반영).
  const emptyPool = (msg: string): never => {
    const detail = notices.length ? ` (${notices.join(" ")})` : "";
    throw new TourApiError(msg + detail, "EMPTY_POOL");
  };

  // 2) 🎪 축제: 지역 풀을 오늘 진행 중 축제가 있는 지역으로 교집합.
  //    축제 소스가 죽으면(§6.5) 결과를 죽이지 않고 축제 필터만 건너뛰되, notice 로 알린다
  //    — 바다·제철은 로컬 상수라 원격 축제 API 하나 때문에 전체가 실패하면 안 된다.
  // 축제 기준일: 명시 today > dateYmd > 오늘. eventStartDate 로 URL 캐시 자동 분리(§6.8).
  const festivalYmd = params.today ?? params.dateYmd ?? todayYmd;
  const festivalBaseYmd = festivalYmd !== todayYmd ? festivalYmd : null; // 오늘 아니면 배지에 기준일
  let festivalMap: Map<number, Festival[]> | null = null;
  if (params.festivalOnly) {
    try {
      festivalMap = await getFestivalMap(festivalYmd);
    } catch {
      notices.push("축제 정보를 잠시 불러오지 못해 축제 조건은 제외했어요.");
    }
    if (festivalMap) {
      const festAreas = [...festivalMap.keys()];
      const base = areaPool ?? festAreas; // 전국이면 축제 있는 지역 전체가 곧 풀
      const narrowed = base.filter((c) => festivalMap!.has(c));
      if (narrowed.length === 0) {
        emptyPool("오늘 진행 중인 축제가 있는 지역 중 고른 곳이 없어요. 지역 조건을 넓혀보세요.");
      }
      areaPool = narrowed;
    }
  }

  // 3) ☔ 날씨: 지역 풀을 지금 비 안 오는 지역으로 교집합 (§6.1).
  //    기상청 소스가 전부 죽으면 축제처럼 필터만 건너뛰고 notice. 개별 지역 실패는
  //    관측 맵에서 빠져(=판정 불가) 보수적으로 비 안 옴 집합에 안 든다.
  let weatherObs: Map<number, WeatherObs> | null = null;
  // ☔ 는 오늘 전용(초단기실황=현재 관측만). 미래 기준일이면 서버가 무시 + notice(직접 URL 방어 —
  //   정상 UI 경로는 buildRandomQuery 가 noRain 을 미방출해 여기 안 옴). §6.8.
  if (params.noRain && params.dateYmd && params.dateYmd > todayYmd) {
    // 이모지 대신 조건 이름으로 — UI 는 선 아이콘만 쓴다(Genesis 리스킨, designGuide.md).
    notices.push("오늘이 아닌 날짜라 ‘비 안 오는 곳’ 조건은 건너뛰었어요.");
  } else if (params.noRain) {
    try {
      weatherObs = await getWeatherByArea(areaPool, params.now);
    } catch {
      notices.push("날씨 정보를 잠시 불러오지 못해 날씨 조건은 제외했어요.");
    }
    if (weatherObs) {
      const narrowed = narrowByWeather(areaPool, rainFreeAreaCodes(weatherObs));
      if (narrowed.length === 0) {
        // 요청 지역 대비 관측 성공이 적으면(부분 실패) 확실히 비 안 오는 곳을 가릴 수 없다 →
        // 전 지역 실패(소프트 스킵)와 대칭으로 필터만 건너뛰고 안내. 전부 관측됐는데 다 비면 빈 풀.
        const requested =
          areaPool && areaPool.length > 0 ? areaPool.length : ALL_AREA_CODES.length;
        if (weatherObs.size < requested) {
          notices.push("일부 지역 날씨를 불러오지 못해 날씨 조건은 제외했어요.");
          weatherObs = null; // 필터·배지 모두 건너뜀
        } else {
          emptyPool("지금 비 안 오는 지역 중 고른 곳이 없어요. 지역을 넓히거나 실내 테마를 골라보세요.");
        }
      } else {
        areaPool = narrowed;
      }
    }
  }

  // 4) 🦀 제철: 지역 풀을 이번 달 제철 산지로 교집합
  if (params.seasonal) {
    const narrowed = narrowBySeasonal(areaPool, month);
    if (narrowed.length === 0) {
      emptyPool("이번 달 제철 산지 중 고른 지역이 없어요. 지역 조건을 넓혀보세요.");
    }
    areaPool = narrowed;
  }

  // 5) 🍃 한적: 성수기 예측 시·도를 풀에서 제거(§6.7). 배치 DB 조회만(외부 API 0콜).
  //    ☔ 날씨 단계 동형 — 조회 실패·stale 이면 필터·배지 모두 건너뛰고 notice(soft-skip).
  let sigunguRanks: Map<string, number> | null = null;
  let congestionBaseYmd: string | null = null;
  // 🍃 판정 기준일 = 요청 기준일(§6.8) — getCongestionDay 가 날짜별 캐시라 인자만 바꾸면 된다.
  const congestionTargetYmd = params.dateYmd ?? todayYmd;
  if (params.quiet) {
    let day: Awaited<ReturnType<typeof getCongestionDay>> = null;
    try {
      day = await getCongestionDay(congestionTargetYmd);
    } catch {
      day = null;
    }
    const nowMs = (params.now ?? new Date()).getTime();
    if (!day || congestionStale(day.maxFetchedAt, nowMs)) {
      notices.push("혼잡도 데이터를 못 불러와 ‘한적한 곳’ 조건은 건너뛰었어요.");
    } else {
      const ranked = rankDaily(day.ranks);
      const narrowed = narrowByQuiet(areaPool, quietAreaCodes(ranked, QUIET_AREA_CUT));
      if (narrowed.length === 0) {
        emptyPool("지금 한적할 것으로 예측되는 지역 중 고른 곳이 없어요. 지역 조건을 넓혀보세요.");
      }
      areaPool = narrowed;
      sigunguRanks = ranked;
      congestionBaseYmd = day.baseYmd;
    }
  }

  // 6) ⚖️ 분산 모드(§6.9B) — 시·도 가중치 준비. 풀은 안 건드린다(분포 축이지 필터가 아님).
  //    🍃 다음에 두는 이유: notices 에 접근 가능한 지점이면서, 풀 좁힘이 다 끝난 뒤라
  //    가중이 실제 후보 지역에만 적용된다. 🌊 경로는 아래에서 이 값을 안 쓴다(미적용).
  let areaWeightMap: Map<number, number> | null = null;
  if (params.scatter && !params.seaside) {
    let recent: Awaited<ReturnType<typeof getVisitorRecent>> = null;
    try {
      recent = await getVisitorRecent();
    } catch {
      recent = null;
    }
    if (!recent || recent.rows.length === 0) {
      // 조용한 저하 금지 — 균등으로 뽑되 그 사실을 알린다(§6.5 동형).
      notices.push(
        "방문자 데이터를 못 불러와 이번엔 모든 시·도 같은 확률로 뽑았어요.",
      );
    } else {
      areaWeightMap = areaWeights(recent.rows, LDONG_TO_APP_AREA);
    }
  }

  const ctx: BadgeCtx = {
    month,
    seasonal: !!params.seasonal,
    festivalMap,
    festivalBaseYmd,
    weatherObs,
    sigunguRanks,
    congestionBaseYmd,
    congestionTargetYmd,
  };

  // 7) 🌊 바다면 cat3 가중 경로, 아니면 기존 타입 경로(♿ 는 같은 경로 + 서비스만 스왑)
  const result = params.seaside
    ? await drawSeaside(areaPool, ctx)
    : await drawByType(params, areaPool, ctx, areaWeightMap);
  if (notices.length) result.picked.notice = notices.join(" "); // 🎪·☔ 건너뛴 사실 노출
  return result;
}

/** 뽑기 조합 1개 — 쿼리 파라미터 + 배지·결과 귀속용 슬롯 시·도(§6.9A). */
export interface DrawCombo extends Query {
  /** 이 조합이 대표하는 시·도. 응답 항목에서 시·도를 못 읽을 때의 귀속 기본값. */
  slotAreaCode: number;
}

/**
 * ⚖️ (타입×지역) 조합 생성 — 셔플 전의 순수부(§6.9A).
 *
 * - `areaPool = null`(지역 미선택): **17개 시·도 lDong 버킷으로 실체화**한다. 전국 단일 쿼리는
 *   관광지 수에 비례해 서울·경기로 쏠려 배포 카피("17개 시·도에 같은 주사위")가 과장이었다.
 *   ⚠️ 버킷을 `areaCode` 로 만들면 안 된다 — 항목의 ~40%가 areacode 필드 공백(지방 한적 명소
 *   다수)이라 어느 시·도에서도 안 잡혀 영구 탈락한다(실측: 전국 21,240 vs areaCode 버킷 합
 *   12,723). 같은 항목이 lDongRegnCd 는 보유해 lDong 버킷은 도달률 99.99%.
 *   광주·전남은 병합 코드 12 를 **중복 보유**(합산 확률 2/17 — AREA_TO_LDONG 주석).
 * - `areaPool` 지정(사용자 선택·🍃 등 필터 결과): **기존 areaCode 쿼리 그대로**(동작 무변).
 *   그 경로의 areacode 공백 손실은 M22 이전부터로 전면 마이그레이션은 §11.1 몫.
 */
export function buildDrawCombos(
  typePool: number[],
  areaPool: number[] | null,
): DrawCombo[] {
  const combos: DrawCombo[] = [];
  for (const contentTypeId of typePool) {
    if (areaPool) {
      for (const areaCode of areaPool)
        combos.push({ contentTypeId, areaCode, slotAreaCode: areaCode });
    } else {
      for (const areaCode of ALL_AREA_CODES)
        combos.push({
          contentTypeId,
          lDongRegnCd: AREA_TO_LDONG[areaCode],
          slotAreaCode: areaCode,
        });
    }
  }
  return combos;
}

/**
 * 응답 항목의 시·도 귀속 — item.areacode 우선, 비면 법정동 코드로 판별(§6.9A).
 * lDong 버킷 쿼리는 areacode 가 빈 항목을 일부러 포함하므로 이 폴백이 배지의 전제다.
 */
export function itemAreaCode(item: TourApiItem): number | null {
  const ac = item.areacode ? Number(item.areacode) : NaN;
  if (Number.isFinite(ac) && ac > 0) return ac;
  return ldongToAreaCode(item.lDongRegnCd, item.lDongSignguCd);
}

/**
 * 기본/제철 경로 — (지역×타입) 조합을 순회해 첫 비어있지 않은 조합에서 1건.
 *
 * 조합 **순서**만 두 갈래다(집합·쿼리는 완전히 동일 — §6.9 "후보 수 무변" 불변식):
 *  - `weights = null`(기본): 전역 셔플 → (타입×시·도) 균등(§6.9A).
 *  - `weights` 있음(⚖️ ON): (가중 시·도)×(셔플 타입) 순 → 방문자 적은 시·도가 앞에 자주 온다.
 *    지역 단위로 붙어 나오므로 "그 지역 전 타입 0건이면 다음 지역"이 자연히 성립하고,
 *    조합 배열을 **재배열만** 하므로 §6.9A 의 lDong 버킷 디스크립터가 그대로 공유된다
 *    (따로 만들면 ⚖️ ON 에서만 areacode 40% 손실이 재발한다).
 */
async function drawByType(
  params: DrawParams,
  areaPool: number[] | null,
  ctx: BadgeCtx,
  weights: Map<number, number> | null = null,
): Promise<DrawResult> {
  const typePool =
    params.contentTypeIds && params.contentTypeIds.length > 0
      ? params.contentTypeIds
      : RANDOM_DEFAULT_TYPES;

  // ♿ 는 조합·순회·재추첨을 전부 재사용하고 **조회 서비스만** 갈아 끼운다(§6.11).
  //   lDongRegnCd 지원이 실측 확인돼 무지역 lDong 버킷(§6.9A)도 그대로 유효하다.
  const listEndpoint = params.barrierFree
    ? `${WITH_SERVICE}/areaBasedList2`
    : "areaBasedList2";

  const built = buildDrawCombos(typePool, areaPool);
  const combos = weights
    ? orderByWeightedArea(built, weights, Math.random)
    : shuffle(built);

  const limit = Math.min(combos.length, COMBO_BUDGET);

  for (let i = 0; i < limit; i++) {
    const q = combos[i];

    // 🦀+🍽️ 제철 음식점: 제철 품목명으로 그 지역 맛집을 실제 검색해 재료-식당을 맞춘다(§6.4).
    //   회·해산물 산지는 대게집·갈치집을 뽑고, 수박 같은 농산물 산지는 매칭이 없어 아래로 폴백.
    //   ♿ 경로에선 건너뛴다 — searchKeyword2 는 KorService2 풀이라 무장애 목록 밖으로 새어
    //   "무장애 정보 있음"을 근거 없이 주장하게 된다(§6.11 조용한 대체 금지).
    if (
      ctx.seasonal &&
      !params.barrierFree &&
      q.contentTypeId === RESTAURANT_TYPE &&
      q.areaCode != null
    ) {
      const linked = await pickSeasonalRestaurant(q.areaCode, ctx.month);
      if (linked) {
        const place = normalizePlace(linked.item, null); // 개요는 카드 노출 뒤(§5.6)
        // 귀속 규칙은 일반 경로와 동일하게 — item.areacode → 법정동 → 슬롯(§6.9A).
        // 지금은 제철 풀이 항상 areaCode 쿼리라 결과가 같지만, ⚖️(§6.9B) 재구성으로
        // 이 경로의 전제가 바뀌어도 두 경로가 갈라지지 않게 미리 통일한다.
        const areaCode = itemAreaCode(linked.item) ?? q.areaCode;
        const badges = buildBadges(areaCode, ctx, place.lat, place.lng);
        // 배지는 지역 전체가 아니라 **매칭된 그 품목만** — 뽑힌 맛집과 정확히 일치.
        badges.seasonal = { items: [linked.matched] };
        return {
          place,
          picked: {
            areaCode,
            contentTypeId: RESTAURANT_TYPE,
            totalCount: linked.count,
            ...badges,
            ...(weights ? { scatter: true } : {}),
          },
        };
      }
      // 매칭 실패(농산물 산지·키워드 0건) → 아래 일반 음식점 경로로 폴백.
    }

    // ⚠️ 이름을 listParams 로 — 바깥 params(DrawParams)를 같은 블록에서 가리면
    //    루프 앞부분의 params 참조가 TDZ 로 죽는다.
    const listParams = queryParams(q);
    const totalCount = await getTotalCount(listEndpoint, listParams);
    if (totalCount <= 0) continue; // 빈 조합 → 다음 조합

    const item = await pickItemFrom(listEndpoint, listParams, totalCount);
    if (!item) continue;

    const place = normalizePlace(item, null); // 개요는 카드 노출 뒤(§5.6)
    // 귀속: item.areacode → 법정동 코드 판별 → 슬롯 시·도(§6.9A). lDong 버킷은 areacode 가
    // 빈 항목을 일부러 포함하므로 중간 단계가 없으면 배지가 통째로 빠진다.
    const areaCode = itemAreaCode(item) ?? q.slotAreaCode;
    const badges = buildBadges(areaCode, ctx, place.lat, place.lng);
    // 제철 음식점인데 품목 매칭에 실패해 여기로 왔으면, 랜덤 식당에 "이 집=제철" 오해를 줄
    // 제철 배지는 숨긴다(수박 배지 + 무관한 횟집 방지). 다른 타입·매칭 성공 경로는 그대로.
    if (ctx.seasonal && q.contentTypeId === RESTAURANT_TYPE) badges.seasonal = null;
    return {
      place,
      picked: {
        areaCode,
        contentTypeId: q.contentTypeId,
        totalCount,
        ...badges,
        // ♿ 무장애 목록에서 나온 뽑기만 표식(정적 배지 트리거 — 소스 자체가 근거, §6.11).
        ...(params.barrierFree ? { barrierFree: true } : {}),
        // ⚖️ 실제로 가중이 걸린 뽑기만 표식 — 폴백(균등)으로 내려간 경우는 붙이지 않는다
        //   (근거 없는 분포 변경 주장 금지. 폴백 사실은 notice 로 따로 나간다).
        ...(weights ? { scatter: true } : {}),
      },
    };
  }

  // 예산 상한 경고는 **여기**(전 조합 탐색 실패 후)에서만 — 잘린 시점에 경고하면 상한이
  // 실제로 해를 끼치지 않은 경우까지 매 뽑기 오경보였다(85조합 전부 비어있지 않음 실측).
  if (combos.length > COMBO_BUDGET) {
    console.warn(
      `[drawRandom] 조합 ${combos.length}개 중 예산 상한 ${COMBO_BUDGET}개를 모두 소진(전부 빈 조합).`,
    );
  }

  throw new TourApiError(
    "조건에 맞는 여행지를 찾지 못했어요. 다시 시도해 주세요.",
    "EMPTY_POOL",
  );
}

/**
 * 🌊 바다 경로 — (지역×cat3) 조합의 totalCount 를 모아 **합산 가중치**로 조합을 뽑는다.
 * 개수 적은 분류(예: 항구)로의 쏠림을 막고, 실패하면 가중 후보에서 빼고 다음을 시도.
 */
async function drawSeaside(
  areaPool: number[] | null,
  ctx: BadgeCtx,
): Promise<DrawResult> {
  const combos: Query[] = [];
  for (const sea of SEA_CAT3) {
    if (areaPool) {
      for (const areaCode of areaPool)
        combos.push({ contentTypeId: 12, areaCode, cat3: sea.cat3 });
    } else {
      combos.push({ contentTypeId: 12, cat3: sea.cat3 });
    }
  }
  shuffle(combos);
  const limit = Math.min(combos.length, COMBO_BUDGET);
  if (combos.length > COMBO_BUDGET) {
    console.warn(
      `[drawSeaside] 조합 ${combos.length}개 중 ${COMBO_BUDGET}개만 탐색(예산 상한).`,
    );
  }

  // 조합별 totalCount 수집(24h 캐시) → 빈 조합 제외.
  // ⚠️ **직렬 유지** — Promise.all 병렬화를 시도했다가 되돌렸다(실측 2026-07-28). 상류가 동시
  //   요청을 흡수하지 못해 대기 중인 호출까지 8초 타임아웃에 걸려 🌊 3회 중 2회가 통째로 실패했다
  //   (15.5s 실패·8.0s 실패). 직렬은 느려도 성공한다 — 여기선 지연보다 성공률이 먼저다.
  const weighted: { q: Query; count: number }[] = [];
  for (let i = 0; i < limit; i++) {
    const count = await getTotalCount("areaBasedList2", queryParams(combos[i]));
    if (count > 0) weighted.push({ q: combos[i], count });
  }
  if (weighted.length === 0) {
    throw new TourApiError(
      "고른 지역에 바다 여행지가 없어요. 지역을 바꾸거나 넓혀보세요.",
      "EMPTY_POOL",
    );
  }

  // count 가중으로 조합 하나씩 뽑아 시도, 실패하면 후보에서 제거 후 다음
  while (weighted.length > 0) {
    const idx = weightedIndex(weighted.map((w) => w.count));
    const { q, count } = weighted[idx];
    weighted.splice(idx, 1);

    const item = await pickItemFrom("areaBasedList2", queryParams(q), count);
    if (!item) continue;

    const place = normalizePlace(item, null); // 개요는 카드 노출 뒤(§5.6)
    const areaCode = item.areacode ? Number(item.areacode) : (q.areaCode ?? null);
    const sea = SEA_CAT3.find((s) => s.cat3 === q.cat3);
    return {
      place,
      picked: {
        areaCode,
        contentTypeId: 12,
        totalCount: count,
        seaside: sea ? { category: sea.name } : null,
        ...buildBadges(areaCode, ctx, place.lat, place.lng),
      },
    };
  }

  throw new TourApiError(
    "바다 여행지를 찾지 못했어요. 다시 시도해 주세요.",
    "EMPTY_POOL",
  );
}

// ─── 🐕 반려동물 동반 (M25, §6.11) ──────────────────────────────────

/** 🐕 경로가 무시하는 조건들 — 켜져 있으면 그 사실을 notice 로 알린다(조용한 무시 금지, §6.5). */
function petIgnoredNotice(params: DrawParams): string | null {
  const ignored: string[] = [];
  if ((params.areaCodes?.length ?? 0) > 0 || (params.contentTypeIds?.length ?? 0) > 0)
    ignored.push("지역·테마");
  if (params.festivalOnly) ignored.push("축제 중");
  if (params.noRain) ignored.push("비 안 오는 곳");
  if (params.seasonal) ignored.push("제철 산지");
  if (params.quiet) ignored.push("한적한 곳");
  if (ignored.length === 0) return null;
  return `반려동물 동반 목록은 전국에서 통째로 뽑아 ${ignored.join("·")} 조건은 적용하지 못했어요.`;
}

/**
 * 🐕 반려동물 동반 뽑기(§6.11) — detailPetTour2 전국 목록에서 1건.
 *  - 목록 행에는 동반 정보만 있고 title·좌표·이미지가 없다 → contentid 로 detailCommon2 조인.
 *    카드 구성에 어차피 필요한 왕복이라 **개요가 공짜로 온다** = /api/overview 지연 로드 예외(§5.6).
 *  - 풀에 용품점 등 상업시설(type 38·39)이 실재 → 조인한 상세로 §6.10 비여행지 거부 판정 후 재추첨.
 *  - 상류가 areaCode·contentTypeId·lDongRegnCd 를 **안 받는다**(넘기면 파라미터 오류) → 파라미터 없음.
 *  - 소스 장애는 그대로 던진다 — 일반 풀로의 조용한 대체 금지(§6.11 장애 의미론).
 */
async function drawPet(params: DrawParams): Promise<DrawResult> {
  const totalCount = await getTotalCount(PET_ENDPOINT, {});
  if (totalCount <= 0) {
    throw new TourApiError(
      "반려동물 동반 가능한 여행지를 찾지 못했어요. 잠시 후 다시 뽑아보세요.",
      "EMPTY_POOL",
    );
  }

  const notice = petIgnoredNotice(params);
  // 관광지성(12·14·25·28) 우선 소프트 편향 — 상업 항목이면 재추첨하되 예산이 끝나면 수용(§6.11).
  const picked = await pickPreferred(
    PET_DRAW_TRIES,
    async () => {
      const index = Math.floor(Math.random() * totalCount) + 1; // 1..totalCount 폐구간
      const row = await getItemAt(PET_ENDPOINT, {}, index);
      if (!row) return null; // stale count → 재추첨
      const detail = await detailCommonItem(row.contentid);
      if (!detail) return null; // 상세가 없는 contentid → 재추첨
      if (!isDrawablePlace(detail)) return null; // 비여행지(생활·행정 시설) → 재추첨 (§6.10)
      return { row, detail };
    },
    ({ detail }) => isPreferredPetType(Number(detail.contenttypeid)),
  );
  if (!picked) {
    throw new TourApiError(
      "이번엔 못 찾았어요 — 한 번 더 뽑아보세요.",
      "EMPTY_POOL",
    );
  }

  const { row, detail } = picked;
  const place = normalizePlace(
    detail,
    detail.overview ? stripTags(detail.overview) : null,
  );
  return {
    place,
    picked: {
      // 귀속: areacode 가 공백인 항목이 실재("마더피아" 실측) → lDong 폴백(§6.9A).
      areaCode: itemAreaCode(detail),
      contentTypeId: place.contentTypeId,
      totalCount,
      pet: normalizePetInfo(row),
      notice,
    },
  };
}

export interface NearbyParams {
  /** 앵커(첫 여행지) 위도 */
  lat: number;
  /** 앵커 경도 */
  lng: number;
  /** 반경(m). 미지정 시 NEARBY_RADIUS_M(20km) */
  radius?: number;
}

/**
 * 📍 주변에서 뽑기(M14) — 앵커 좌표 반경 내에서 랜덤 1건.
 *  - locationBasedList2(mapX=경도, mapY=위도, radius, contentTypeId, arrange="E")로 조회.
 *  - RANDOM_DEFAULT_TYPES 를 셔플해 첫 비어있지 않은 타입에서 랜덤 인덱스 1건(타입 균등, §13).
 *  - 응답의 dist(m)를 picked.distanceM 으로 실어 카드가 "○○에서 N km"를 표시.
 *  - 반경 내 후보가 없으면 EMPTY_POOL — 결과를 죽이지 않고 "그냥 다시 뽑기"로 유도.
 *  - 순수 랜덤 전용(조건·지역 필터 미적용) — 호출부(route)에서 near= 단독으로 들어온다.
 */
export async function drawNearby(params: NearbyParams): Promise<DrawResult> {
  const radius = params.radius ?? NEARBY_RADIUS_M;
  const types = shuffle([...RANDOM_DEFAULT_TYPES]);

  for (const contentTypeId of types) {
    const locParams: ListParams = {
      mapX: params.lng, // ⚠️ mapX=경도, mapY=위도
      mapY: params.lat,
      radius,
      contentTypeId,
      arrange: "E", // 거리순 — 응답 dist 채워짐
    };
    const totalCount = await getTotalCount("locationBasedList2", locParams);
    if (totalCount <= 0) continue; // 이 타입은 반경 내 0건 → 다음 타입

    const item = await pickItemFrom("locationBasedList2", locParams, totalCount);
    if (!item) continue;

    const areaCode = item.areacode ? Number(item.areacode) : null;
    const distRaw = item.dist != null ? Number(item.dist) : NaN;
    return {
      place: normalizePlace(item, null), // 개요는 카드 노출 뒤(§5.6)
      picked: {
        areaCode,
        contentTypeId,
        totalCount,
        distanceM: Number.isFinite(distRaw) ? distRaw : null,
      },
    };
  }

  throw new TourApiError(
    "주변에 추천할 여행지를 찾지 못했어요. '다시 뽑기'로 다른 곳을 받아보세요.",
    "EMPTY_POOL",
  );
}

// ─── 🔭 빈 곳에서 뽑기 (M21, §7.11) ─────────────────────────────────

/**
 * 🔭 그날 congestion 조회 → ranks·baseYmd(뽑기·count 공용, 1h 캐시 재사용).
 * 실패(throw)·stale(48h)은 예외를 위로 던지지 않고 { ranks:null }(성능저하 모드)로 폴백 —
 *   drawEmptySpot 은 미방문 전체로 축소 뽑기(문구③), countEmptySpot 은 dynamic.
 */
async function emptySpotDay(
  targetYmd: string,
  nowMs: number,
): Promise<{ ranks: Map<string, number> | null; baseYmd: string | null }> {
  let day: Awaited<ReturnType<typeof getCongestionDay>> = null;
  try {
    day = await getCongestionDay(targetYmd);
  } catch {
    day = null;
  }
  if (!day || congestionStale(day.maxFetchedAt, nowMs)) return { ranks: null, baseYmd: null };
  return { ranks: rankDaily(day.ranks), baseYmd: day.baseYmd };
}

export interface EmptySpotParams {
  /** 방문 정복한 시·군·구 통계청 code — 미방문 = 전체 − 이것(conqueredSigunguCodes 산출). */
  exclude: Set<string>;
  /** 📅 기준일 YYYYMMDD(§6.8 축 대칭). 1단계 UI 미배선 — 라우트가 오늘을 넘김. */
  dateYmd?: string;
  now?: Date;
}

/**
 * 🔭 빈 곳에서 뽑기(M21) — 미방문 ∩ 한적 시·군·구 셀에서 랜덤 1건 + 좌표 검증.
 *  - 풀(sigunguSet·eligibleCells)은 순수 lib/emptySpot 이 계산(getCongestionDay 1h 캐시).
 *  - 셀 선택은 균등 셔플(교집합 자체가 분산 산물 — 이중 가중 불필요, §6.9 독립).
 *  - (셀,타입) areaBasedList2 count → pickItemFrom accept 로 뽑은 좌표가 sigunguSet 소속인지 검증.
 *  - 🍃 배지 배선 명시: BadgeCtx 를 직접 구성해야 배지가 뜬다(현행은 quiet=1일 때만 채워짐).
 *  - EMPTY_POOL 두 원인 구분: ④-a 빈 풀 / ④-b 시도 소진('정복 완료' 오귀속 금지).
 */
export async function drawEmptySpot(params: EmptySpotParams): Promise<DrawResult> {
  const now = params.now ?? new Date();
  const targetYmd = params.dateYmd ?? kstYmd(now);
  const { ranks, baseYmd } = await emptySpotDay(targetYmd, now.getTime());

  const sigunguSet = emptySpotSigunguSet(params.exclude, ranks);
  if (sigunguSet.size === 0) {
    // ④-a: 빈 풀(한적한 미방문 동네가 지금 없음).
    throw new TourApiError(
      "지도의 빈 곳 중 한적할 것으로 예측되는 동네가 지금은 없어요.",
      "EMPTY_POOL",
    );
  }

  // 🍃 성능저하 모드(ranks=null)는 sigunguRanks 를 채우지 않아 congestionBadgeFor 가 자연 억제(문구③).
  const degraded = ranks === null;
  const ctx: BadgeCtx = {
    month: 0,
    seasonal: false,
    festivalMap: null,
    festivalBaseYmd: null,
    weatherObs: null,
    sigunguRanks: ranks,
    congestionBaseYmd: baseYmd,
    congestionTargetYmd: targetYmd,
  };
  const notice = degraded
    ? "혼잡도 데이터를 못 불러와 이번엔 '지도에 없는 곳' 기준으로만 뽑았어요."
    : null;

  const cells = shuffle(eligibleCells(sigunguSet)).slice(0, EMPTY_SPOT_CELL_TRIES);
  const result = await drawFromCells(cells, sigunguSet, ctx, notice, { emptySpot: true });
  if (result) return result;

  // ④-b: 시도 소진 — '정복 완료'가 아니라 이번 시도가 못 찾은 것(오귀속 금지).
  throw new TourApiError("이번엔 못 찾았어요 — 한 번 더 뽑아보세요.", "EMPTY_POOL");
}

/**
 * 🔭·🍃 셀 뽑기 소경로 — 주어진 셀들을 순회하며 타입 기본 5종 셔플로 1건 + 좌표 검증.
 * 뽑힌 좌표가 sigunguSet 소속일 때만 채택(스냅·경계 포함, §7.4) — 셀은 N:1 이라
 *   좌표 검증이 "약속한 그 시·군·구"를 보장하는 유일한 장치다(카드 주소가 곧 주장).
 * 못 찾으면 null — EMPTY_POOL 문구는 원인을 아는 호출부가 정한다(오귀속 금지).
 *
 * 🔭 빈 곳(M21 §7.11)과 🍃 TOP5 칩 원샷(M27 §7.16A)이 공유한다. 차이는 sigunguSet 을
 *   어떻게 만드느냐뿐 — 🔭 는 미방문∩한적, 🍃 는 지정 1곳(미방문 조건 없음).
 */
async function drawFromCells(
  cells: readonly TourSigunguCell[],
  sigunguSet: ReadonlySet<string>,
  ctx: BadgeCtx,
  notice: string | null,
  extraPicked: Partial<PickedInfo> = {},
): Promise<DrawResult | null> {
  for (const cell of cells) {
    for (const contentTypeId of shuffle([...RANDOM_DEFAULT_TYPES])) {
      const listParams = queryParams({
        contentTypeId,
        areaCode: cell.area,
        sigunguCode: cell.sigunguCode,
      });
      const totalCount = await getTotalCount("areaBasedList2", listParams);
      if (totalCount <= 0) continue; // 이 (셀,타입)은 0건 → 다음 타입

      const item = await pickItemFrom("areaBasedList2", listParams, totalCount, undefined, (it) => {
        const lat = toNum(it.mapy); // ⚠️ mapy=위도, mapx=경도
        const lng = toNum(it.mapx);
        if (lat == null || lng == null) return false;
        const sg = sigunguAt(lat, lng);
        return !!sg && sigunguSet.has(sg.code);
      });
      if (!item) continue;

      const place = normalizePlace(item, null); // 개요는 카드 노출 뒤(§5.6)
      const areaCode = item.areacode ? Number(item.areacode) : cell.area;
      const badges = buildBadges(areaCode, ctx, place.lat, place.lng);
      return {
        place,
        picked: { areaCode, contentTypeId, totalCount, ...extraPicked, ...badges, notice },
      };
    }
  }
  return null;
}

// ─── 🍃 오늘 한적 TOP5 칩 원샷 뽑기 (M27, §7.16A) ────────────────────

export interface OnlySigunguParams {
  /** 뽑을 시·군·구 통계청 code 1개(only= 파라미터 — parseOnlySigungu 산출). */
  code: string;
  /** 📅 기준일 YYYYMMDD(§6.8 축 대칭). TOP5 칩은 항상 오늘 — 라우트가 오늘을 넘김. */
  dateYmd?: string;
  now?: Date;
}

/**
 * 🍃 지정 시·군·구 1곳에서 원샷 뽑기(M27) — TOP5 칩 탭 진입점.
 *  - 🔭 drawEmptySpot 의 셀 뽑기 소경로를 그대로 재사용하되 **미방문·한적 조건이 없다**
 *    (칩 자체가 이미 한적 상위 선정 결과라 다시 거르면 같은 판정을 두 번 하는 것).
 *  - 🍃 배지는 §6.7 노출 조건(pctRank ≤ 0.5) 그대로 — ranks 를 ctx 에 실어 buildBadges 가 판정.
 *    stale·조회 실패면 배지만 생략된다(약속한 지역에서 뽑는 것 자체는 지켜지므로 notice 불필요).
 *  - FilterPanel 상태와 무관한 별도 진입점(📍 주변 뽑기 동형) — "조건 0개 = 완전 랜덤" 무침범.
 */
export async function drawOnlySigungu(params: OnlySigunguParams): Promise<DrawResult> {
  const now = params.now ?? new Date();
  const targetYmd = params.dateYmd ?? kstYmd(now);
  const { ranks, baseYmd } = await emptySpotDay(targetYmd, now.getTime());

  const sigunguSet = new Set([params.code]);
  const ctx: BadgeCtx = {
    month: 0,
    seasonal: false,
    festivalMap: null,
    festivalBaseYmd: null,
    weatherObs: null,
    sigunguRanks: ranks,
    congestionBaseYmd: baseYmd,
    congestionTargetYmd: targetYmd,
  };

  // 통계청 code 는 정확히 한 셀에 속한다(⋃members 중복 0) — 셔플·상한이 필요 없다.
  const result = await drawFromCells(eligibleCells(sigunguSet), sigunguSet, ctx, null);
  if (result) return result;

  throw new TourApiError(
    "이 동네에서는 보여드릴 곳을 찾지 못했어요 — 다른 곳을 골라보세요.",
    "EMPTY_POOL",
  );
}

/**
 * 🔢 🔭 빈 곳 후보 수 — |미방문 ∩ 한적 시·군·구|(단위: 시·군·구). TourAPI 0콜(1h 캐시 + 순수).
 *  - congestion 실패/stale → dynamic('정복 완료'로 오독되는 0 반환 금지, 문구①).
 *  - /map CTA 캡션 전용(useEmptySpotCount) — 기존 CandidateBadge 와 단위·경로 분리.
 */
export async function countEmptySpot(
  exclude: Set<string>,
  opts: { now?: Date; dateYmd?: string } = {},
): Promise<CountResponse> {
  const now = opts.now ?? new Date();
  const targetYmd = opts.dateYmd ?? kstYmd(now);
  const { ranks } = await emptySpotDay(targetYmd, now.getTime());
  if (ranks === null) return { dynamic: true }; // 혼잡도 확인 불가
  const sigunguSet = emptySpotSigunguSet(exclude, ranks);
  return { totalCount: sigunguSet.size, approx: false };
}

/**
 * 🔢 실시간 후보 수(M16) — 현재 조건의 후보 총합. 뽑지 않고 세기만 한다.
 *  - 조합 계획은 순수 planCandidateCount(테스트됨), 여기선 각 조합의 getTotalCount(24h 캐시)를 합산.
 *  - 🎪·☔ 는 dynamic(정확 집계 불가) — UI 는 정성 라벨.
 *  - 예산 상한(COUNT_COMBO_BUDGET)에 잘리면 approx=true(≈ N곳+).
 *
 *  ※ 배지용 부가 정보라 정확도보다 저비용·캐시 재사용이 우선(같은 24h 캐시를 뽑기와 공유).
 */
export async function countCandidates(
  params: CountParams,
  opts: { month?: number; now?: Date; dateYmd?: string } = {},
): Promise<CountResponse> {
  // 📅 방문 시점(§6.8) — 파생 규칙은 drawRandom 과 동일(month=resolveMonth, quietSet=요청 기준일).
  const now = opts.now ?? new Date();
  const month = resolveMonth({ month: opts.month, dateYmd: opts.dateYmd, now });
  const targetYmd = opts.dateYmd ?? kstYmd(now);

  // 🍃 한적은 배치 DB 조회라 정확 집계 가능(☔·🎪 dynamic과 달리). 한적 시·도 집합을 계산해 주입.
  //    조회 실패·stale 은 예외가 아니라 정상 경로로 quietSet=null → planCandidateCount 가 dynamic.
  let quietSet: Set<number> | null | undefined;
  if (params.quiet) {
    try {
      const day = await getCongestionDay(targetYmd);
      quietSet =
        day && !congestionStale(day.maxFetchedAt, now.getTime())
          ? quietAreaCodes(rankDaily(day.ranks), QUIET_AREA_CUT)
          : null;
    } catch {
      quietSet = null;
    }
  }

  const plan = planCandidateCount(params, month, quietSet);
  if (plan.kind === "dynamic") return { dynamic: true };
  if (plan.kind === "empty") return { totalCount: 0, approx: false };
  // 🐕 는 전국 전용 단일 값(§6.11) — 조합 없이 detailPetTour2 totalCount 1콜(24h 캐시).
  if (plan.kind === "pet") {
    return { totalCount: await getTotalCount(PET_ENDPOINT, {}), approx: false };
  }

  // ♿ 는 조합 계획을 그대로 쓰고 **엔드포인트만** 스왑(§6.11) — URL 이 갈려 캐시도 자동 분리.
  const endpoint =
    plan.source === "with" ? `${WITH_SERVICE}/areaBasedList2` : "areaBasedList2";
  let total = 0;
  for (const combo of plan.combos) {
    total += await getTotalCount(endpoint, queryParams(combo));
  }
  return { totalCount: total, approx: plan.capped };
}

// ─── 🧭 반나절 코스 (M20, §7.10) ────────────────────────────────────

/**
 * 🍚 식사 슬롯 전용 — pickItemFrom 을 최대 3회 재호출하되 카페·클럽 cat3 는 거부하고 그
 * contentId 를 로컬 exclude 사본에 누적(같은 카페 재뽑힘 방지). 3회째도 거부 cat3면 그대로 수용
 * (완벽주의 금지 — cat3별 다중 count 콜 없이 1콜 유지). 아예 못 뽑으면(인덱스 소진) null → 반경 확대.
 */
async function pickMealItem(
  endpoint: string,
  params: ListParams,
  totalCount: number,
  baseExclude: Set<string>,
  rejectCat3: readonly string[],
): Promise<TourApiItem | null> {
  const local = new Set(baseExclude);
  let last: TourApiItem | null = null;
  for (let t = 0; t < 3; t++) {
    const item = await pickItemFrom(endpoint, params, totalCount, local);
    if (!item) break; // 인덱스 소진 — 지금까지 후보(있으면)라도, 없으면 null
    last = item;
    if (!rejectCat3.includes(item.cat3 ?? "")) return item; // 밥집 확정
    local.add(item.contentid); // 카페·클럽 거부 → 재추첨(같은 곳 방지)
  }
  return last; // 3회째도 거부 cat3면 수용, 첫 시도부터 못 뽑았으면 null
}

/**
 * 한 슬롯 1건 뽑기 — 반경이 바깥 루프(COURSE_RADII: 5→10→20km, 가까운 곳 우선). 각 반경에서
 * 슬롯 타입들을 셔플 순회, 전부 0건(또는 exclude·stale 로 못 뽑음)일 때만 다음 반경으로 확대.
 * 슬롯별 독립 확대(식당은 5km에 있는데 카페만 없으면 카페만 넓힘). 끝까지 실패면 null.
 */
async function drawCourseSlot(
  def: CourseSlotDef,
  lat: number,
  lng: number,
  exclude: Set<string>,
): Promise<TourApiItem | null> {
  for (const radius of COURSE_RADII) {
    const types = shuffle([...def.contentTypeIds]);
    for (const contentTypeId of types) {
      const params: ListParams = {
        mapX: lng, // ⚠️ mapX=경도, mapY=위도
        mapY: lat,
        radius,
        contentTypeId,
        arrange: "E",
      };
      if (def.cat3) params.cat3 = def.cat3; // ☕ 카페 직접 필터
      const totalCount = await getTotalCount("locationBasedList2", params);
      if (totalCount <= 0) continue; // 이 타입·이 반경 0건 → 다음 타입
      const item = def.rejectCat3
        ? await pickMealItem(
            "locationBasedList2",
            params,
            totalCount,
            exclude,
            def.rejectCat3,
          )
        : await pickItemFrom("locationBasedList2", params, totalCount, exclude);
      if (item) return item;
      // null(exclude·stale) → 다음 타입, 모두 실패면 다음 반경
    }
  }
  return null;
}

const slotDef = (slot: CourseSlot): CourseSlotDef =>
  COURSE_SLOTS.find((s) => s.slot === slot)!;

/**
 * 🧭 반나절 코스 전체 — 앵커 좌표 반경 내 볼거리→식사→카페 3스텝.
 *  - Promise.all([ 볼거리, (식사→카페 순차) ]): 볼거리(12·14·28)는 39와 타입이 안 겹쳐 병렬 안전.
 *    카페는 식사 확정 후 exclude 에 식사 contentId 를 넣고 뽑아 식사↔카페 충돌쌍을 구조로 차단.
 *  - 슬롯 실패는 그 스텝 생략 + notice(1스텝 이상이면 코스 성립), 전 슬롯 실패는 EMPTY_POOL(404).
 *  - 개요(detailCommon2)는 생략(§5.6). ⚠️ 날짜 계열 파라미터 없음 — "date는 코스 구성 무변"을 구조로 보장.
 */
export async function drawCourse(
  lat: number,
  lng: number,
  exclude: Set<string>,
): Promise<{ steps: CourseStep[]; notices: string[] }> {
  const [sightItem, meal] = await Promise.all([
    drawCourseSlot(slotDef("sight"), lat, lng, exclude),
    (async () => {
      const mealItem = await drawCourseSlot(slotDef("meal"), lat, lng, exclude);
      const cafeExclude = new Set(exclude);
      if (mealItem) cafeExclude.add(mealItem.contentid); // 식사↔카페 충돌 차단
      const cafeItem = await drawCourseSlot(slotDef("cafe"), lat, lng, cafeExclude);
      return { mealItem, cafeItem };
    })(),
  ]);

  const steps: CourseStep[] = [];
  const notices: string[] = [];
  const collect = (slot: CourseSlot, item: TourApiItem | null, miss: string) => {
    if (item) steps.push({ slot, place: normalizePlace(item, null) });
    else notices.push(miss);
  };
  // 의미 고정 순서로 조립(뽑기 완료 순서와 무관, §7.10)
  collect("sight", sightItem, "주변에서 볼거리를 찾지 못해 첫 스텝은 뺐어요.");
  collect("meal", meal.mealItem, "주변에서 식사할 곳을 찾지 못해 식사 스텝은 뺐어요.");
  collect("cafe", meal.cafeItem, "주변에서 카페를 찾지 못해 마무리 스텝은 뺐어요.");

  if (steps.length === 0) {
    throw new TourApiError(
      "주변에서 코스를 만들 만한 곳을 찾지 못했어요. 다른 여행지를 뽑아 다시 시도해 보세요.",
      "EMPTY_POOL",
    );
  }
  return { steps, notices };
}

/**
 * 🧭 코스 스텝 1개 재뽑기 — 앵커·현재 전 스텝을 exclude 로 받아 같은 슬롯을 다시 뽑는다.
 * 못 뽑으면 EMPTY_POOL(클라가 스텝 유지 + 그 행 안내) — 재뽑기는 코스를 죽이지 않는다.
 */
export async function drawCourseStep(
  lat: number,
  lng: number,
  slot: CourseSlot,
  exclude: Set<string>,
): Promise<CourseStep> {
  const item = await drawCourseSlot(slotDef(slot), lat, lng, exclude);
  if (!item) {
    throw new TourApiError(
      "주변에서 새로 보여드릴 곳을 찾지 못했어요.",
      "EMPTY_POOL",
    );
  }
  return { slot, place: normalizePlace(item, null) };
}
