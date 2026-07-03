// TourAPI 프록시 + 랜덤 로직의 서버 진입점 (plan.md §4)
//  - 서비스키를 서버에만 두어 보호 · CORS 회피
//  - 쿼리: ?area=32&type=39 (둘 다 생략 시 완전 랜덤)

import { type NextRequest } from "next/server";
import { drawRandom, TourApiError } from "@/lib/tourapi";
import type { ErrorResponse } from "@/types/tour";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const areaCode = numParam(sp.get("area"));
  const contentTypeId = numParam(sp.get("type"));

  try {
    const result = await drawRandom({ areaCode, contentTypeId });
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

function numParam(v: string | null): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
