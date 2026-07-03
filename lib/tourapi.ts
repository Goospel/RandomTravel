// TourAPI(KorService2) 호출 래퍼 + "진짜 랜덤" 추출 (plan.md §5)
//
// 리서치 확정 사항(2026-07-03):
//  - 베이스 https://apis.data.go.kr/B551011/KorService2, 모든 오퍼레이션에 접미사 `2`
//  - 서비스키는 **Decoding 키**를 URLSearchParams.set 으로 넘겨 정확히 1회만 인코딩
//    (Encoding 키를 넣으면 %2B → %252B 이중 인코딩 → resultCode 30 키 미등록 오류)
//  - HTTP 200 이어도 response.header.resultCode 로 실패 판별
//  - 0건이면 body.items 가 빈 문자열 "" 로 올 수 있음 → 배열 파싱 전 방어

import type { Place, TourApiItem } from "@/types/tour";
import { RANDOM_DEFAULT_TYPES } from "@/lib/constants";

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
}

function queryParams(q: Query): Record<string, number> {
  const p: Record<string, number> = { contentTypeId: q.contentTypeId };
  if (q.areaCode) p.areaCode = q.areaCode;
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
}

export interface DrawResult {
  place: Place;
  picked: { areaCode: number | null; contentTypeId: number; totalCount: number };
}

/**
 * 랜덤 여행지 1건.
 *  - contentTypeIds 미지정: RANDOM_DEFAULT_TYPES 에서 타입 선택 → 타입 균등(항목 균등 아님, §13).
 *  - areaCodes 미지정: 전국 대상. 지정되면 그 지역들 중에서.
 *  - 둘 다 비면 완전 랜덤 — "조건 0개 = 완전 랜덤" 불변식(§2)이 구조로 보장된다.
 *
 * (지역×타입) 조합을 전부 만들어 셔플한 뒤 **중복 없이** 순회한다.
 * 매번 무작위 재추첨하던 방식과 달리, 유효 데이터가 극소수 조합에만 있어도
 * 예산 안에서 그 조합을 찾아낸다(넓은 다중선택의 false-negative 방지).
 *  ※ getTotalCount 는 24h 캐시(§5.6)라, count가 늘어난 직후 새 꼬리 항목은
 *    최대 24h 노출이 지연될 수 있다(허용 트레이드오프).
 */
export async function drawRandom(params: DrawParams = {}): Promise<DrawResult> {
  const typePool =
    params.contentTypeIds && params.contentTypeIds.length > 0
      ? params.contentTypeIds
      : RANDOM_DEFAULT_TYPES;
  const areaPool =
    params.areaCodes && params.areaCodes.length > 0 ? params.areaCodes : null;

  // 모든 (지역,타입) 조합 → 셔플 → 중복 없이 순회
  const combos: Query[] = [];
  for (const contentTypeId of typePool) {
    if (areaPool) {
      for (const areaCode of areaPool) combos.push({ contentTypeId, areaCode });
    } else {
      combos.push({ contentTypeId });
    }
  }
  shuffle(combos);

  const COMBO_BUDGET = 34; // 상류 getTotalCount 호출 상한 (대부분 24h 캐시)
  const MAX_INDEX_TRIES = 3;
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

    for (let t = 0; t < MAX_INDEX_TRIES; t++) {
      const index = Math.floor(Math.random() * totalCount) + 1; // 1..totalCount 폐구간
      const item = await getItemAt(q, index);
      if (!item) continue; // stale count 등으로 빈 결과 → 인덱스 재추첨

      const overview = await getOverview(item.contentid);
      return {
        place: normalizePlace(item, overview),
        picked: {
          areaCode: item.areacode ? Number(item.areacode) : (q.areaCode ?? null),
          contentTypeId: q.contentTypeId,
          totalCount,
        },
      };
    }
  }

  throw new TourApiError(
    "조건에 맞는 여행지를 찾지 못했어요. 다시 시도해 주세요.",
    "EMPTY_POOL",
  );
}
