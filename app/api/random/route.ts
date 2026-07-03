// TourAPI 프록시 + 랜덤 로직의 서버 진입점 (plan.md §4)
//  - 서비스키를 서버에만 두어 보호 · CORS 회피
//  - 쿼리: ?areas=32,39&types=39 (콤마 다중, 둘 다 생략 시 완전 랜덤)

import { type NextRequest } from "next/server";
import { drawRandom, TourApiError } from "@/lib/tourapi";
import { parseAreaCodes, parseContentTypeIds, parseBool } from "@/lib/query";
import type { ErrorResponse } from "@/types/tour";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const areasRaw = sp.get("areas");
  const typesRaw = sp.get("types");
  const areaCodes = parseAreaCodes(areasRaw); // 정수·양수·화이트리스트·중복제거
  const contentTypeIds = parseContentTypeIds(typesRaw);
  const seaside = parseBool(sp.get("seaside")); // 🌊 바다 (§6.3)
  const seasonal = parseBool(sp.get("seasonal")); // 🦀 제철 (§6.4)

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
    });
    return Response.json(result);
  } catch (e) {
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
}
