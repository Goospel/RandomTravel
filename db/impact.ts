// 📈 임팩트 대시보드(M26, plan.md §7.15) 데이터 조립 — DB 조회만, TourAPI 0콜.
//
// db/congestion 과 같은 자리: 스키마 옆에 두는 DB·캐시 접점이고, 순수 계산은 lib/impact 가 맡는다.
// /impact 페이지와 GET /api/impact 가 **같은 이 함수**를 부른다(페이지가 자기 API 를 다시
// fetch 하면 왕복만 늘고 캐시가 두 겹이 된다).
//
// ⚠️ 부분 실패 허용(§7.15·§6.5 결): DB 가 죽어도 ②(순수 계산)는 렌더돼야 한다. 그래서
//   조각마다 try 로 감싸고 실패는 notices 로 **드러낸다** — 조용한 저하 금지.

import { unstable_cache } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { travelEvents } from "@/db/schema";
import { getVisitorRecent } from "@/db/congestion";
import { areaVisitorSums, areaWeights } from "@/lib/scatter";
import { LDONG_TO_APP_AREA } from "@/lib/congestionCodes";
import { ALL_AREA_CODES } from "@/lib/constants";
import {
  aggregateDrawEvents,
  designProbabilities,
  funnelCounts,
  visitorShares,
  type AreaShare,
  type DesignProbability,
  type EventCountRow,
  type Funnel,
} from "@/lib/impact";

/** ③ 표본이 이 수 미만이면 화면이 "표본 누적 중" 배지를 단다(§7.15 정직성 규칙). */
export const SMALL_SAMPLE = 100;

export interface ImpactData {
  /** ① 현실 — 외지인 방문자 시·도 점유율. DB 실패·무데이터면 null. */
  visitor: AreaShare[] | null;
  /** ② 설계 — 균등 + ⚖️ 가중 확률(해석적). **항상 존재**한다(순수 계산). */
  design: DesignProbability[];
  /** ③ 실측 — 제안 분포 + 퍼널. DB 실패면 null. */
  actual: { total: number; shares: AreaShare[]; funnel: Funnel } | null;
  /** 부분 실패·데이터 부족을 사용자에게 알리는 문구(빈 배열이면 정상). */
  notices: string[];
}

/** event × areaCode 별 건수. 전체 스캔 group-by — v1 표본 규모(수천)에서 충분. */
async function queryEventCounts(): Promise<EventCountRow[]> {
  const rows = await db
    .select({
      event: travelEvents.event,
      areaCode: travelEvents.areaCode,
      count: sql<number>`count(*)`,
    })
    .from(travelEvents)
    .groupBy(travelEvents.event, travelEvents.areaCode);
  // neon 은 count(*) 를 문자열로 줄 수 있다(bigint) — 순수부는 숫자만 다룬다.
  return rows.map((r) => ({
    event: r.event,
    areaCode: r.areaCode,
    count: Number(r.count),
  }));
}

const getEventCounts = () =>
  unstable_cache(queryEventCounts, ["impact-events"], {
    revalidate: 3600,
    tags: ["impact"],
  })();

export async function getImpactData(): Promise<ImpactData> {
  const notices: string[] = [];

  // ① + ② 가중 재료 — 같은 방문자 조회 하나로 둘 다 만든다(⚖️ 뽑기와 캐시 공유).
  let visitor: AreaShare[] | null = null;
  let weights: Map<number, number> | null = null;
  try {
    const recent = await getVisitorRecent();
    if (recent) {
      const shares = visitorShares(areaVisitorSums(recent.rows, LDONG_TO_APP_AREA));
      visitor = shares.length > 0 ? shares : null;
      weights = areaWeights(recent.rows, LDONG_TO_APP_AREA);
    }
    if (!visitor) notices.push("방문자 데이터가 아직 쌓이지 않아 ① 편중 패널을 비웠어요.");
  } catch (e) {
    console.error("[/api/impact] 방문자 데이터 조회 실패:", e);
    notices.push("방문자 데이터를 불러오지 못해 ① 편중과 ⚖️ 가중 확률을 생략했어요.");
  }

  // ② 설계 확률 — 가중치가 큰 시·도부터. 가중치가 없으면 기본 시·도 순서 그대로.
  const order = weights
    ? [...ALL_AREA_CODES].sort((a, b) => (weights!.get(b) ?? 0) - (weights!.get(a) ?? 0))
    : ALL_AREA_CODES;
  const design = designProbabilities(order, weights);

  // ③ 실측
  let actual: ImpactData["actual"] = null;
  try {
    const rows = await getEventCounts();
    actual = {
      ...aggregateDrawEvents(rows),
      funnel: funnelCounts(rows),
    };
  } catch (e) {
    console.error("[/api/impact] 이벤트 집계 실패:", e);
    notices.push("실사용 기록을 불러오지 못해 ③ 실측 패널을 생략했어요.");
  }

  return { visitor, design, actual, notices };
}
