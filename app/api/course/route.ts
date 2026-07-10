// 🧭 반나절 코스(M20, plan.md §7.10) 서버 진입점 — 뽑힌 여행지를 앵커로 볼거리→식사→카페 3스텝.
//  - near=위도,경도(필수) · exclude=id,…(앵커∪스텝 중복 제외) · slot=…(있으면 그 슬롯 재뽑기)
//    · date=YYYYMMDD(🍃 헤더 배지 기준일만, 코스 구성 무변).
//  - 순수 랜덤 결과 위에 얹는 경험 계층이라 §2 조건 파이프라인 밖(M14 위치 경로와 같은 축).

import { type NextRequest } from "next/server";
import { drawCourse, drawCourseStep, TourApiError } from "@/lib/tourapi";
import { parseLatLng, parseContentIds, parseDateYmd } from "@/lib/query";
import type { CourseSlot } from "@/lib/course";
import { sigunguAt } from "@/lib/conquer";
import { getCongestionDay } from "@/db/congestion";
import { rankDaily, congestionStale, congestionBadge } from "@/lib/congestion";
import { kstYmd } from "@/lib/kst";
import type {
  CourseResponse,
  CourseStepResponse,
  CongestionBadge,
  ErrorResponse,
} from "@/types/tour";

function parseCourseSlot(raw: string | null): CourseSlot | null {
  return raw === "sight" || raw === "meal" || raw === "cafe" ? raw : null;
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // 요청당 단일 시계 — parseDateYmd 검증과 🍃 배지 판정에 같은 now(자정 걸침 어긋남 방지).
  const now = new Date();

  const anchor = parseLatLng(sp.get("near"));
  if (!anchor) {
    const body: ErrorResponse = {
      error: "기준 좌표가 올바르지 않아요.",
      code: "BAD_REQUEST",
    };
    return Response.json(body, { status: 400 });
  }

  const exclude = new Set(parseContentIds(sp.get("exclude"))); // 앵커·현재 스텝(있으면)
  const dateYmd = parseDateYmd(sp.get("date"), now) ?? undefined; // 📅 미래 기준일만
  const slot = parseCourseSlot(sp.get("slot")); // 있으면 재뽑기 경로

  try {
    if (slot) {
      // 스텝 재뽑기 — 그 슬롯 1개만. 실패면 EMPTY_POOL(404) → 클라가 스텝 유지 + 그 행 안내.
      const step = await drawCourseStep(anchor.lat, anchor.lng, slot, exclude);
      const body: CourseStepResponse = { step, notice: null };
      return Response.json(body);
    }

    const { steps, notices } = await drawCourse(anchor.lat, anchor.lng, exclude);
    const congestion = await buildCourseBadge(
      anchor.lat,
      anchor.lng,
      dateYmd,
      now,
    );
    const body: CourseResponse = {
      steps,
      congestion,
      notice: notices.length ? notices.join(" ") : null,
    };
    return Response.json(body);
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * 🍃 코스 헤더 배지 — 앵커 시·군·구의 그날 한적 예측(pctRank≤0.5·비stale·매핑 존재일 때만).
 * 체인 전체를 try/catch 로 감싸 실패·stale·미매핑·pctRank>0.5 를 전부 null 로 수렴 — 코스는 산다
 * (배지 생략이 정상 경로, 허위 서사 금지). ⚠️ 뽑기의 "🍃 켠 게이트"는 코스에 부적용(토글 없는 경로).
 */
async function buildCourseBadge(
  lat: number,
  lng: number,
  dateYmd: string | undefined,
  now: Date,
): Promise<CongestionBadge | null> {
  try {
    const sg = sigunguAt(lat, lng); // §7.4 점-다각형 + 최근접 스냅
    if (!sg) return null;
    const targetYmd = dateYmd ?? kstYmd(now); // 예측 대상일(요청 기준일)
    const day = await getCongestionDay(targetYmd);
    if (!day || congestionStale(day.maxFetchedAt, now.getTime())) return null;
    const ranks = rankDaily(day.ranks);
    return congestionBadge(sg.area, sg.name, ranks, day.baseYmd, targetYmd);
  } catch {
    return null; // 조회·매핑 어느 단계든 실패하면 배지 생략(코스 유지)
  }
}

/** TourApiError → 상태코드 매핑, 그 외 500. (/api/random errorResponse 패턴 복제) */
function errorResponse(e: unknown): Response {
  if (e instanceof TourApiError) {
    const body: ErrorResponse = { error: e.message, code: e.code };
    const status =
      e.code === "EMPTY_POOL" ? 404 : e.code === "BAD_REQUEST" ? 400 : 502;
    return Response.json(body, { status });
  }
  console.error("[/api/course] 예상치 못한 오류:", e);
  const body: ErrorResponse = {
    error: "예상치 못한 오류가 발생했어요.",
    code: "UPSTREAM_ERROR",
  };
  return Response.json(body, { status: 500 });
}
