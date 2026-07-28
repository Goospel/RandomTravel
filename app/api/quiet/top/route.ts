// 🍃 오늘 한적 TOP5(M27, plan.md §7.16A) — 홈 스트립 데이터. TourAPI 0콜(M17 기적재분 DB 조회만).
//
// 1h 캐시는 getCongestionDay 의 unstable_cache 가 담당한다(§6.7) — 유일한 비싼 부분이 그 DB
//   조회이고, 그 뒤 topQuietSigungu 는 250건 순수 계산이라 캐시를 두 겹 쌓을 이유가 없다.
//
// ⚠️ 정직성(§6.7): stale(>48h)·데이터 없음·조회 실패는 전부 **빈 결과**다 — 낡은 예측으로
//   사용자를 특정 지역에 유인하지 않는다(클라는 빈 결과면 스트립 자체를 렌더하지 않음).

import { getCongestionDay } from "@/db/congestion";
import { rankDaily, congestionStale, kstYmd } from "@/lib/congestion";
import { topQuietSigungu } from "@/lib/quietTop";
import type { QuietTopResponse } from "@/types/tour";

/** 홈 스트립 칩 수(§7.16A). */
const TOP_N = 5;

const EMPTY: QuietTopResponse = { items: [], baseYmd: null };

export async function GET() {
  const now = new Date();
  try {
    const day = await getCongestionDay(kstYmd(now));
    if (!day || congestionStale(day.maxFetchedAt, now.getTime())) {
      return Response.json(EMPTY);
    }
    const items = topQuietSigungu(rankDaily(day.ranks), TOP_N);
    const body: QuietTopResponse = { items, baseYmd: day.baseYmd };
    return Response.json(body);
  } catch (e) {
    // 부가 스트립이라 실패해도 홈을 막지 않는다(후보 수 배지 관례 — 조용히 미노출).
    console.error("[/api/quiet/top] 한적 TOP5 조회 실패:", e);
    return Response.json(EMPTY);
  }
}
