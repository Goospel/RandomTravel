// TourAPI(KorService2) 호출 래퍼 + "진짜 랜덤" 추출 (plan.md §5)
//
// 리서치 확정 사항(2026-07-03):
//  - 베이스 https://apis.data.go.kr/B551011/KorService2, 모든 오퍼레이션에 접미사 `2`
//  - 서비스키는 **Decoding 키**를 URLSearchParams.set 으로 넘겨 정확히 1회만 인코딩
//    (Encoding 키를 넣으면 %2B → %252B 이중 인코딩 → resultCode 30 키 미등록 오류)
//  - HTTP 200 이어도 response.header.resultCode 로 실패 판별
//  - 0건이면 body.items 가 빈 문자열 "" 로 올 수 있음 → 배열 파싱 전 방어

import type { Place, TourApiItem, PickedInfo } from "@/types/tour";
import { RANDOM_DEFAULT_TYPES, SEA_CAT3, ALL_AREA_CODES } from "@/lib/constants";
import { narrowBySeasonal, seasonalItemsForArea, currentMonth } from "@/lib/season";
import {
  normalizeFestivals,
  festivalsByArea,
  festivalBadge,
  todayKST,
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

const BASE = "https://apis.data.go.kr/B551011/KorService2";

export type TourErrorCode = "UPSTREAM_ERROR" | "EMPTY_POOL" | "BAD_REQUEST";

export class TourApiError extends Error {
  code: TourErrorCode;
  constructor(message: string, code: TourErrorCode = "UPSTREAM_ERROR") {
    super(message);
    this.name = "TourApiError";
    this.code = code;
  }
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
}

/** 캐싱 정책: 24시간 재검증 or 캐시 안 함 */
type Caching = { revalidate: number } | "no-store";

async function tourFetch(
  endpoint: string,
  params: Record<string, string | number>,
  caching: Caching,
): Promise<TourBody> {
  const key = process.env.TOUR_API_KEY;
  if (!key) {
    throw new TourApiError(
      "서버에 TourAPI 키(TOUR_API_KEY)가 설정되지 않았어요.",
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

  const url = `${BASE}/${endpoint}?${sp.toString()}`;
  const init: RequestInit =
    caching === "no-store"
      ? { cache: "no-store" }
      : { next: { revalidate: caching.revalidate } };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new TourApiError("관광 데이터 서버에 연결하지 못했어요.");
  }

  const text = await res.text();
  let json: TourEnvelope;
  try {
    json = JSON.parse(text) as TourEnvelope;
  } catch {
    // 인증·쿼터 오류는 게이트웨이가 XML 봉투로 준다 (_type=json 무시)
    if (/LIMITED_NUMBER_OF_SERVICE_REQUESTS|returnReasonCode>22</.test(text)) {
      throw new TourApiError(
        "TourAPI 요청 한도를 초과했어요. 잠시 후 다시 시도해 주세요.",
      );
    }
    throw new TourApiError(
      "관광 데이터 응답을 해석하지 못했어요. (서비스키 등록·인코딩을 확인하세요)",
    );
  }

  const code = json.response?.header?.resultCode;
  if (code !== "0000") {
    const msg = json.response?.header?.resultMsg ?? "알 수 없는 오류";
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
}

function queryParams(q: Query): Record<string, string | number> {
  const p: Record<string, string | number> = { contentTypeId: q.contentTypeId };
  if (q.areaCode) p.areaCode = q.areaCode;
  if (q.cat3) p.cat3 = q.cat3;
  return p;
}

/** 조합의 전체 개수 — 거의 안 변하므로 24h 캐시 (§5.6) */
async function getTotalCount(q: Query): Promise<number> {
  const body = await tourFetch(
    "areaBasedList2",
    { ...queryParams(q), numOfRows: 1, pageNo: 1 },
    { revalidate: 86400 },
  );
  return body.totalCount ?? 0;
}

/** 정렬된 전체 목록의 index번째 1건 (1-indexed). 캐시 금지 — 매 뽑기가 달라야 함 */
async function getItemAt(q: Query, index: number): Promise<TourApiItem | null> {
  const body = await tourFetch(
    "areaBasedList2",
    { ...queryParams(q), numOfRows: 1, pageNo: index },
    "no-store",
  );
  return itemsOf(body)[0] ?? null;
}

/** detailCommon2 개요 보강 — 실패해도 뽑기를 막지 않는다(best-effort) */
async function getOverview(contentId: string): Promise<string | null> {
  try {
    const body = await tourFetch(
      "detailCommon2",
      { contentId },
      { revalidate: 86400 },
    );
    const ov = itemsOf(body)[0]?.overview;
    return ov ? stripTags(ov) : null;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
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
  /** 🦀 제철: 지역 풀을 이번 달 제철 산지로 교집합 (§6.4) */
  seasonal?: boolean;
  /** 🎪 축제: 지역 풀을 오늘 진행 중 축제가 있는 지역으로 교집합 (§6.2) */
  festivalOnly?: boolean;
  /** ☔ 날씨: 지역 풀을 지금 비 안 오는 지역으로 교집합 (§6.1) */
  noRain?: boolean;
  /** 제철 기준 월(1-12). 미지정 시 현재 월 — 테스트·일관성 주입용 */
  month?: number;
  /** 축제 기준 날짜 YYYYMMDD. 미지정 시 오늘(KST) — 테스트·일관성 주입용 */
  today?: string;
  /** 날씨 기준 시각. 미지정 시 현재 — 테스트·일관성 주입용 */
  now?: Date;
}

/** 배지 계산에 필요한 문맥 — 어느 조건이 켜졌는지 + 조회된 축제·날씨 맵. */
interface BadgeCtx {
  month: number;
  seasonal: boolean;
  festivalMap: Map<number, Festival[]> | null;
  weatherObs: Map<number, WeatherObs> | null;
}

/** 뽑힌 지역에 대한 배지들(제철·축제·날씨)을 한 번에 계산. */
function buildBadges(
  areaCode: number | null,
  ctx: BadgeCtx,
): Pick<PickedInfo, "seasonal" | "festival" | "weather"> {
  return {
    seasonal: ctx.seasonal ? seasonalBadge(areaCode, ctx.month) : null,
    festival: ctx.festivalMap ? festivalBadge(ctx.festivalMap, areaCode) : null,
    weather: ctx.weatherObs ? weatherBadge(ctx.weatherObs, areaCode) : null,
  };
}

export interface DrawResult {
  place: Place;
  picked: PickedInfo;
}

const COMBO_BUDGET = 34; // 상류 getTotalCount 호출 상한 (대부분 24h 캐시)
const MAX_INDEX_TRIES = 3;

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

/** 결정된 조합에서 항목 1건 뽑기(인덱스 최대 MAX_INDEX_TRIES 재시도). 실패 시 null. */
async function pickItemFrom(
  q: Query,
  totalCount: number,
): Promise<TourApiItem | null> {
  for (let t = 0; t < MAX_INDEX_TRIES; t++) {
    const index = Math.floor(Math.random() * totalCount) + 1; // 1..totalCount 폐구간
    const item = await getItemAt(q, index);
    if (item) return item; // stale count 등으로 빈 결과면 인덱스 재추첨
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
    emoji: s.emoji,
  }));
  return items.length > 0 ? { items } : null;
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
  const month = params.month ?? currentMonth();

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
  let festivalMap: Map<number, Festival[]> | null = null;
  if (params.festivalOnly) {
    try {
      festivalMap = await getFestivalMap(params.today ?? todayKST());
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
  if (params.noRain) {
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

  const ctx: BadgeCtx = {
    month,
    seasonal: !!params.seasonal,
    festivalMap,
    weatherObs,
  };

  // 5) 🌊 바다면 cat3 가중 경로, 아니면 기존 타입 경로
  const result = params.seaside
    ? await drawSeaside(areaPool, ctx)
    : await drawByType(params, areaPool, ctx);
  if (notices.length) result.picked.notice = notices.join(" "); // 🎪·☔ 건너뛴 사실 노출
  return result;
}

/** 기본/제철 경로 — (지역×타입) 조합을 셔플해 첫 비어있지 않은 조합에서 1건 */
async function drawByType(
  params: DrawParams,
  areaPool: number[] | null,
  ctx: BadgeCtx,
): Promise<DrawResult> {
  const typePool =
    params.contentTypeIds && params.contentTypeIds.length > 0
      ? params.contentTypeIds
      : RANDOM_DEFAULT_TYPES;

  const combos: Query[] = [];
  for (const contentTypeId of typePool) {
    if (areaPool) {
      for (const areaCode of areaPool) combos.push({ contentTypeId, areaCode });
    } else {
      combos.push({ contentTypeId });
    }
  }
  shuffle(combos);

  const limit = Math.min(combos.length, COMBO_BUDGET);
  if (combos.length > COMBO_BUDGET) {
    console.warn(
      `[drawRandom] 조합 ${combos.length}개 중 ${COMBO_BUDGET}개만 탐색(예산 상한).`,
    );
  }

  for (let i = 0; i < limit; i++) {
    const q = combos[i];
    const totalCount = await getTotalCount(q);
    if (totalCount <= 0) continue; // 빈 조합 → 다음 조합

    const item = await pickItemFrom(q, totalCount);
    if (!item) continue;

    const overview = await getOverview(item.contentid);
    const areaCode = item.areacode ? Number(item.areacode) : (q.areaCode ?? null);
    return {
      place: normalizePlace(item, overview),
      picked: {
        areaCode,
        contentTypeId: q.contentTypeId,
        totalCount,
        ...buildBadges(areaCode, ctx),
      },
    };
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

  // 조합별 totalCount 수집(24h 캐시) → 빈 조합 제외
  const weighted: { q: Query; count: number }[] = [];
  for (let i = 0; i < limit; i++) {
    const count = await getTotalCount(combos[i]);
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

    const item = await pickItemFrom(q, count);
    if (!item) continue;

    const overview = await getOverview(item.contentid);
    const areaCode = item.areacode ? Number(item.areacode) : (q.areaCode ?? null);
    const sea = SEA_CAT3.find((s) => s.cat3 === q.cat3);
    return {
      place: normalizePlace(item, overview),
      picked: {
        areaCode,
        contentTypeId: 12,
        totalCount: count,
        seaside: sea ? { category: sea.name, emoji: sea.emoji } : null,
        ...buildBadges(areaCode, ctx),
      },
    };
  }

  throw new TourApiError(
    "바다 여행지를 찾지 못했어요. 다시 시도해 주세요.",
    "EMPTY_POOL",
  );
}
