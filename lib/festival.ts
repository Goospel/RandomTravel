// 🎪 축제 필터의 순수 로직 (plan.md §6.2). 네트워크는 tourapi 가 담당, 여기선 변환·판정만.
//
// searchFestival2 실측(2026-07): 응답의 areacode 는 대개 비어 있고 areaCode 필터도 0 을 준다.
// 대신 lDongRegnCd(법정동 시도 코드)가 채워져 오므로 그걸 TourAPI areaCode 로 변환한다.
// "오늘 진행 중"은 서버가 한 번에 못 주므로(eventStartDate 는 '아직 안 끝난'=진행중+예정을
// 준다) 받은 목록을 시작 ≤ 오늘 ≤ 종료 로 클라이언트에서 한 번 더 거른다.

import { LDONG_TO_AREA, ALL_AREA_CODES } from "@/lib/constants";

/** searchFestival2 원본 항목 중 관심 필드 */
export interface RawFestival {
  contentid: string;
  title: string;
  lDongRegnCd?: string;
  areacode?: string;
  eventstartdate?: string;
  eventenddate?: string;
}

/** 카드/필터에 쓰는 정규화된 축제 1건 */
export interface Festival {
  contentId: string;
  title: string;
  areaCode: number;
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
}

const AREA_SET = new Set(ALL_AREA_CODES);

/** 오늘 날짜 YYYYMMDD — 항상 KST(서버 UTC 방어, [[currentMonth]] 와 같은 이유). */
export function todayKST(now: Date = new Date()): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 준다 → 하이픈 제거
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return ymd.replace(/-/g, "");
}

/** 시작 ≤ 오늘 ≤ 종료. YYYYMMDD 문자열은 사전순=날짜순이라 그대로 비교. */
export function isInProgress(f: RawFestival, today: string): boolean {
  const s = f.eventstartdate;
  const e = f.eventenddate;
  if (!s || !e) return false;
  return s <= today && today <= e;
}

/** 법정동 시도 코드 → TourAPI areaCode. 없으면 areacode 폴백, 그래도 안 되면 null. */
export function festivalAreaCode(f: RawFestival): number | null {
  if (f.lDongRegnCd && LDONG_TO_AREA[f.lDongRegnCd]) return LDONG_TO_AREA[f.lDongRegnCd];
  const ac = f.areacode ? Number(f.areacode) : NaN;
  return Number.isFinite(ac) && AREA_SET.has(ac) ? ac : null;
}

/** 원본 목록 → 오늘 진행 중이면서 지역 변환에 성공한 축제만 정규화. */
export function normalizeFestivals(raws: RawFestival[], today: string): Festival[] {
  const out: Festival[] = [];
  for (const r of raws) {
    if (!isInProgress(r, today)) continue;
    const areaCode = festivalAreaCode(r);
    if (areaCode == null) continue;
    out.push({
      contentId: r.contentid,
      title: r.title,
      areaCode,
      startDate: r.eventstartdate!,
      endDate: r.eventenddate!,
    });
  }
  return out;
}

/** 지역별 축제 묶음 — 키가 곧 "축제 있는 지역 집합". */
export function festivalsByArea(fests: Festival[]): Map<number, Festival[]> {
  const m = new Map<number, Festival[]>();
  for (const f of fests) {
    const list = m.get(f.areaCode) ?? [];
    list.push(f);
    m.set(f.areaCode, list);
  }
  return m;
}

/** 결과 카드 배지 — 그 지역의 첫 축제명 + 나머지 개수. 없으면 null. */
export function festivalBadge(
  map: Map<number, Festival[]>,
  areaCode: number | null,
): { name: string; more: number } | null {
  if (areaCode == null) return null;
  const list = map.get(areaCode);
  if (!list || list.length === 0) return null;
  return { name: list[0].title, more: list.length - 1 };
}
