// TourAPI 프록시 + 랜덤 로직의 서버 진입점 (plan.md §4)
//  - 서비스키를 서버에만 두어 보호 · CORS 회피
//  - 쿼리: ?areas=32,39&types=39 (콤마 다중, 둘 다 생략 시 완전 랜덤)

import { type NextRequest } from "next/server";
import { drawRandom, drawNearby, drawEmptySpot, TourApiError } from "@/lib/tourapi";
import {
  parseAreaCodes,
  parseContentTypeIds,
  parseBool,
  parseLatLng,
  parseDateYmd,
  parseSigunguCodes,
} from "@/lib/query";
import { KOREA_SIGUNGU } from "@/lib/koreaMap";
import type { ErrorResponse } from "@/types/tour";

// 🔭 exclude 화이트리스트 — 통계청 시·군·구 code(§7.11). 서버 전용 라우트라 koreaMap import OK.
//    query.ts 는 클라 번들이라 koreaMap 을 못 들이므로 valid 를 여기서 만들어 parseSigunguCodes 에 주입.
const VALID_SIGUNGU: ReadonlySet<string> = new Set(KOREA_SIGUNGU.map((sg) => sg.code));

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // 📅 요청당 단일 시계(§6.8) — parseDateYmd 검증과 drawRandom 판정에 같은 now 를 주입해
  //    자정 걸침 시 '검증 기준일 ≠ 판정 기준일' 어긋남을 막는다.
  const now = new Date();

  // 📍 주변에서 뽑기(M14) — near=위도,경도 가 있으면 위치 기반 경로.
  //    순수 랜덤 전용이라 areas/types/특수조건은 무시한다. 좌표가 잘못되면 400.
  const nearRaw = sp.get("near");
  if (nearRaw !== null && nearRaw.trim() !== "") {
    const anchor = parseLatLng(nearRaw);
    if (!anchor) {
      const body: ErrorResponse = {
        error: "기준 좌표가 올바르지 않아요.",
        code: "BAD_REQUEST",
      };
      return Response.json(body, { status: 400 });
    }
    try {
      const result = await drawNearby(anchor);
      return Response.json(result);
    } catch (e) {
      return errorResponse(e);
    }
  }

  // 🔭 빈 곳에서 뽑기(M21) — emptySpot=1 이면 미방문 ∩ 한적 시·군·구 특수 경로.
  //    near 처럼 areas/types/특수조건은 무시한다(§7.11). exclude 는 이 분기에서만 파싱
  //    (emptySpot 미지정 → exclude 파싱조차 안 함 = 기존 뽑기와 완전 동일, 불변식).
  if (parseBool(sp.get("emptySpot"))) {
    const exclude = new Set(parseSigunguCodes(sp.get("exclude"), VALID_SIGUNGU));
    const dateYmd = parseDateYmd(sp.get("date"), now) ?? undefined; // §6.8 축 대칭(1단계 UI 미배선)
    try {
      const result = await drawEmptySpot({ exclude, dateYmd, now });
      return Response.json(result);
    } catch (e) {
      return errorResponse(e);
    }
  }

  const areasRaw = sp.get("areas");
  const typesRaw = sp.get("types");
  const areaCodes = parseAreaCodes(areasRaw); // 정수·양수·화이트리스트·중복제거
  const contentTypeIds = parseContentTypeIds(typesRaw);
  const seaside = parseBool(sp.get("seaside")); // 🌊 바다 (§6.3)
  const seasonal = parseBool(sp.get("seasonal")); // 🦀 제철 (§6.4)
  const festivalOnly = parseBool(sp.get("festivalOnly")); // 🎪 축제 (§6.2)
  const noRain = parseBool(sp.get("noRain")); // ☔ 날씨 (§6.1)
  const quiet = parseBool(sp.get("quiet")); // 🍃 한적 (§6.7)
  const dateYmd = parseDateYmd(sp.get("date"), now) ?? undefined; // 📅 방문 시점 (§6.8)

  // 파라미터에 '내용'이 있는데 유효 코드가 하나도 없으면(조작된 URL 등) 잘못된 요청 —
  // 상류 API 호출을 낭비하지 않고 400으로 명확히 응답한다.
  // (빈 값 `?areas=` 는 "필터 없음"으로 보고 완전 랜덤으로 흘려보낸다.)
  const areasGiven = !!areasRaw && areasRaw.trim() !== "";
  const typesGiven = !!typesRaw && typesRaw.trim() !== "";
  // 🌊 바다면 서버가 types 를 무시(관광지12 고정)하므로, 무시될 types 가 무효라고
  // 요청 전체를 400 으로 막지 않는다(areas 는 바다 경로에서도 쓰이므로 검사 유지).
  if (
    (areasGiven && areaCodes.length === 0) ||
    (!seaside && typesGiven && contentTypeIds.length === 0)
  ) {
    const body: ErrorResponse = {
      error: "요청한 지역·테마 코드가 올바르지 않아요.",
      code: "BAD_REQUEST",
    };
    return Response.json(body, { status: 400 });
  }

  try {
    const result = await drawRandom({
      areaCodes,
      contentTypeIds,
      seaside,
      seasonal,
      festivalOnly,
      noRain,
      quiet,
      dateYmd,
      now,
    });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}

/** TourApiError → 적절한 상태코드로 매핑, 그 외는 500. (near/일반 경로 공용) */
function errorResponse(e: unknown): Response {
  if (e instanceof TourApiError) {
    const body: ErrorResponse = { error: e.message, code: e.code };
    const status =
      e.code === "EMPTY_POOL" ? 404 : e.code === "BAD_REQUEST" ? 400 : 502;
    return Response.json(body, { status });
  }
  console.error("[/api/random] 예상치 못한 오류:", e);
  const body: ErrorResponse = {
    error: "예상치 못한 오류가 발생했어요.",
    code: "UPSTREAM_ERROR",
  };
  return Response.json(body, { status: 500 });
}
