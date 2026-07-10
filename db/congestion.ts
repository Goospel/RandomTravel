// 🍃 한적 필터(M17, plan.md §6.7) 혼잡도 적재/조회 래퍼.
//
// 스키마와 동거한다(lib/ 아님) — DB·캐시 접점이라 lib 의 '순수 로직' 관례 밖이고, lib/kma.ts 처럼
// 단위 테스트 비대상이다. 순수 집계·백분위·판정은 lib/congestion(테스트됨)이 맡는다.
//
// 조회는 unstable_cache(1h) 필수 — neon-http 는 POST fetch라 Next 의 revalidate fetch 캐시가
// 안 먹는 유일한 원격 소스이고, Neon 무료 티어는 유휴 suspend(콜드 0.5~2s)라 캐시 없으면
// 고빈도 뽑기·후보 수 요청에 직격한다. 적재는 청크 upsert(≤1,000행)로 부분 실패에도 idempotent.

import { unstable_cache } from "next/cache";
import { desc, eq, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { congestionDaily, visitorDaily } from "@/db/schema";
import type { DayAggregate, SigunguRank } from "@/lib/congestion";

const CHUNK = 1000; // 한 방 INSERT 상한(§6.7 — 바인드 파라미터 65,534 상한 + 부분 진행 보존)

/** baseYmd ≤ 기준일 중 최신 날짜의 전국 시군구 행 + 신선도(max fetched_at). */
export interface CongestionDay {
  baseYmd: string;
  ranks: SigunguRank[]; // {sigunguCd, medianRate} — rankDaily 입력
  maxFetchedAt: number;
}

async function queryCongestionDay(dateYmd: string): Promise<CongestionDay | null> {
  // baseYmd ≤ 기준일 중 최신 1개(30일 선행 예측이라 배치가 하루 이틀 죽어도 '오늘 이하 최신'은 존재).
  const latest = await db
    .select({ baseYmd: congestionDaily.baseYmd })
    .from(congestionDaily)
    .where(lte(congestionDaily.baseYmd, dateYmd))
    .orderBy(desc(congestionDaily.baseYmd))
    .limit(1);
  if (latest.length === 0) return null;
  const baseYmd = latest[0].baseYmd;

  const rows = await db
    .select({
      sigunguCd: congestionDaily.sigunguCd,
      medianRate: congestionDaily.medianRate,
      fetchedAt: congestionDaily.fetchedAt,
    })
    .from(congestionDaily)
    .where(eq(congestionDaily.baseYmd, baseYmd));
  if (rows.length === 0) return null;

  let maxFetchedAt = 0;
  const ranks: SigunguRank[] = [];
  for (const r of rows) {
    ranks.push({ sigunguCd: r.sigunguCd, medianRate: r.medianRate });
    if (r.fetchedAt > maxFetchedAt) maxFetchedAt = r.fetchedAt;
  }
  return { baseYmd, ranks, maxFetchedAt };
}

/**
 * 판정·배지 공용 1회 조회 — baseYmd ≤ 기준일 최신 날짜의 전국 행. unstable_cache(revalidate 3600).
 * 캐시 키에 dateYmd 를 실어 날짜별로 분리. 실패는 throw → 호출부(drawRandom·countCandidates)가 소프트 스킵.
 */
export function getCongestionDay(dateYmd: string): Promise<CongestionDay | null> {
  return unstable_cache(() => queryCongestionDay(dateYmd), ["congestion-day", dateYmd], {
    revalidate: 3600,
    tags: ["congestion"],
  })();
}

/**
 * 집중률 집계 행을 청크 업서트(onConflictDoUpdate) — 재실행만으로 자연 복구(idempotent).
 * fetchedAt 은 이 배치 실행 시각(ms)을 전 행에 동일 적용(신선도 축).
 */
export async function upsertCongestion(
  aggregates: DayAggregate[],
  fetchedAt: number,
): Promise<void> {
  for (let i = 0; i < aggregates.length; i += CHUNK) {
    const chunk = aggregates.slice(i, i + CHUNK).map((a) => ({
      sigunguCd: a.sigunguCd,
      baseYmd: a.baseYmd,
      spotCount: a.spotCount,
      medianRate: a.medianRate,
      crowdedShare: a.crowdedShare,
      fetchedAt,
    }));
    if (chunk.length === 0) continue;
    await db
      .insert(congestionDaily)
      .values(chunk)
      .onConflictDoUpdate({
        target: [congestionDaily.sigunguCd, congestionDaily.baseYmd],
        set: {
          spotCount: sql`excluded.spot_count`,
          medianRate: sql`excluded.median_rate`,
          crowdedShare: sql`excluded.crowded_share`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }
}

/** 방문자수 적재 행(시군구×날짜×관광객구분). */
export interface VisitorRow {
  sigunguCd: string;
  baseYmd: string;
  touDivCd: string;
  touNum: number;
}

/** 방문자수 행을 청크 업서트. */
export async function upsertVisitor(rows: VisitorRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    await db
      .insert(visitorDaily)
      .values(chunk)
      .onConflictDoUpdate({
        target: [visitorDaily.sigunguCd, visitorDaily.baseYmd, visitorDaily.touDivCd],
        set: { touNum: sql`excluded.tou_num` },
      });
  }
}

/** 보존 컷 미만 행 삭제 — congestion baseYmd < cutoff.congestion, visitor < cutoff.visitor. */
export async function pruneOld(cutoff: {
  congestion: string;
  visitor: string;
}): Promise<void> {
  await db.delete(congestionDaily).where(lt(congestionDaily.baseYmd, cutoff.congestion));
  await db.delete(visitorDaily).where(lt(visitorDaily.baseYmd, cutoff.visitor));
}
