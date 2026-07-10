// 🍃 한적 필터(M17, plan.md §6.7) — 혼잡도 일 1회 배치 적재.
//
// Vercel Cron(0 21 * * * UTC = KST 06시)이 GET 으로 호출한다. 뽑기·후보 수 요청 경로는 DB 조회만
// 하고, 전국 규모(≈252 시군구) 외부 호출은 오직 이 배치에서만 일어난다(지연·쿼터·장애 전파 차단).
//   - 인증: Authorization: Bearer ${CRON_SECRET}(Vercel env 등록 시 cron 요청에 자동 첨부).
//     개발 모드(NODE_ENV=development)는 검증 생략 — 최초 적재를 localhost 에서 1회 돌리는 유일 경로.
//   - maxDuration 300: Fluid compute 활성 필수(레거시 함수 모드면 Hobby 60s로 회귀).
//   - GET 이어야 함 — Vercel cron 은 GET 으로 부른다(POST만 두면 405 무성 실패).

import { NextResponse } from "next/server";
import { LDONG_TO_APP_AREA } from "@/lib/congestionCodes";
import {
  aggregateDaily,
  visitorProbeDates,
  retentionCutoff,
  type CongestionSpotRow,
} from "@/lib/congestion";
import {
  upsertCongestion,
  upsertVisitor,
  pruneOld,
  type VisitorRow,
} from "@/db/congestion";

export const maxDuration = 300; // ⚠️ Fluid compute 확인 — 배치가 60s를 넘길 수 있음
export const dynamic = "force-dynamic"; // 캐시·프리렌더 금지(배치 라우트)

const BASE = "https://apis.data.go.kr/B551011";
const CONCURRENCY = 8; // 시군구 동시 조회 상한

/** 집중률 응답 item(관광지×날짜) — 전부 문자열. */
interface CnctrItem {
  signguCd?: string;
  baseYmd?: string;
  cnctrRate?: string;
}
/** 방문자수 응답 item(시군구×날짜×관광객구분). 시군구 코드 철자가 signguCode(집중률과 다름). */
interface VisitorItem {
  signguCode?: string;
  baseYmd?: string;
  touDivCd?: string;
  touNum?: string;
}

interface Envelope<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: "" | { item?: T | T[] }; totalCount?: number };
  };
}

/**
 * B551011 게이트웨이 GET 호출(KorService2 와 같은 키 규약).
 * Decoding 키를 URLSearchParams.set 으로 1회 인코딩, 성공은 response.header.resultCode==="0000".
 */
async function gwFetch<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const key = process.env.TOUR_API_KEY;
  if (!key) throw new Error("TOUR_API_KEY 미설정");

  const sp = new URLSearchParams();
  sp.set("serviceKey", key); // Decoding 키
  sp.set("MobileOS", "ETC");
  sp.set("MobileApp", "RandomTravel");
  sp.set("_type", "json");
  for (const [k, v] of Object.entries(params)) sp.set(k, String(v));

  const res = await fetch(`${BASE}/${path}?${sp.toString()}`, { cache: "no-store" });
  const text = await res.text();
  let json: Envelope<T>;
  try {
    json = JSON.parse(text) as Envelope<T>;
  } catch {
    throw new Error(`응답 JSON 파싱 실패(키·인코딩·서비스 신청 확인): ${text.slice(0, 120)}`);
  }
  const code = json.response?.header?.resultCode;
  if (code !== "0000") {
    throw new Error(`${path} 오류: ${json.response?.header?.resultMsg ?? "?"} (code ${code ?? "?"})`);
  }
  const items = json.response?.body?.items;
  if (!items || !items.item) return [];
  return Array.isArray(items.item) ? items.item : [items.item];
}

/** 한 법정동 시군구의 30일 집중률(재시도 1회). */
async function fetchCongestion(sigunguCd: string): Promise<CnctrItem[]> {
  const params = {
    areaCd: sigunguCd.slice(0, 2), // 법정동 시도 2자리
    signguCd: sigunguCd,
    numOfRows: 5000, // 시군구당 1콜로 30일 전체(실측 최대 ~3,390행)
    pageNo: 1,
  };
  try {
    return await gwFetch<CnctrItem>("TatsCnctrRateService/tatsCnctrRatedList", params);
  } catch {
    return gwFetch<CnctrItem>("TatsCnctrRateService/tatsCnctrRatedList", params); // 재시도 1회
  }
}

/** 집중률 전국 적재 — 동시성 8 배치, 응답 도착 즉시 집계·청크 upsert(부분 실패 보존). */
async function ingestCongestion(fetchedAt: number) {
  const codes = Object.keys(LDONG_TO_APP_AREA); // 252 법정동 시군구
  let ok = 0;
  let fail = 0;
  let sigunguRows = 0;

  for (let i = 0; i < codes.length; i += CONCURRENCY) {
    const batch = codes.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (cd) => {
        const items = await fetchCongestion(cd);
        // 저장 키는 내가 조회한 법정동 코드(cd)로 고정 — LDONG_TO_APP_AREA 키와 정합 보장.
        return items.map(
          (it): CongestionSpotRow => ({
            sigunguCd: cd,
            baseYmd: it.baseYmd ?? "",
            cnctrRate: it.cnctrRate ?? "",
          }),
        );
      }),
    );

    const batchRows: CongestionSpotRow[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled") {
        batchRows.push(...r.value);
        ok++;
      } else {
        fail++;
      }
    }
    // baseYmd 결측 행은 제외하고 집계·업서트(응답 즉시 저장 → 타임아웃에도 진행분 보존).
    const aggregates = aggregateDaily(batchRows.filter((r) => r.baseYmd));
    if (aggregates.length > 0) {
      await upsertCongestion(aggregates, fetchedAt);
      sigunguRows += aggregates.length;
    }
  }
  return { ok, fail, rowsUpserted: sigunguRows };
}

/** 방문자수 — 최근 가용일 역탐색 1일치(약 1개월+ 지연이라 오늘 기준은 비어 있음). */
async function ingestVisitor() {
  for (const ymd of visitorProbeDates()) {
    let items: VisitorItem[];
    try {
      items = await gwFetch<VisitorItem>("DataLabService/locgoRegnVisitrDDList", {
        startYmd: ymd,
        endYmd: ymd,
        numOfRows: 2000, // 전국 하루 ≈804행
        pageNo: 1,
      });
    } catch {
      continue; // 이 날짜 실패 → 다음 후보
    }
    if (items.length === 0) continue; // 아직 미생성 → 더 과거로
    const rows: VisitorRow[] = items
      .filter((it) => it.signguCode && it.baseYmd && it.touDivCd)
      .map((it) => ({
        sigunguCd: it.signguCode!,
        baseYmd: it.baseYmd!,
        touDivCd: it.touDivCd!,
        touNum: Number(it.touNum) || 0,
      }));
    if (rows.length > 0) await upsertVisitor(rows);
    return { baseYmd: ymd, rows: rows.length };
  }
  return { baseYmd: null, rows: 0 };
}

export async function GET(req: Request) {
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev) {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.get("authorization");
    if (!secret || auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  try {
    // 집중률·방문자수 병렬 적재(독립 쿼터).
    const [congestion, visitor] = await Promise.all([
      ingestCongestion(started),
      ingestVisitor(),
    ]);
    // 보존 컷 삭제(congestion 7일·visitor 180일).
    await pruneOld(retentionCutoff());

    return NextResponse.json({
      ok: true,
      elapsedMs: Date.now() - started,
      congestion,
      visitor,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, elapsedMs: Date.now() - started, error: String(e) },
      { status: 500 },
    );
  }
}
