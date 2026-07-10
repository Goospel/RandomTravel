// 🔢 실시간 후보 수(M16) — /api/random?… 과 같은 조건 파라미터를 받아 후보 총합만 반환.
//   뽑기(/api/random)와 같은 getTotalCount 24h 캐시를 공유해 저비용. 조건 변경 시 배지 갱신용.
//   ⚠️ 부가 정보라 실패해도 앱을 막지 않는다 — 오류 시 dynamic 폴백(UI는 정성 라벨).

import { type NextRequest } from "next/server";
import { countCandidates } from "@/lib/tourapi";
import {
  parseAreaCodes,
  parseContentTypeIds,
  parseBool,
  parseDateYmd,
} from "@/lib/query";
import type { CountResponse } from "@/types/tour";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const now = new Date(); // 📅 요청당 단일 시계(§6.8) — parseDateYmd·countCandidates 공유
  const dateYmd = parseDateYmd(sp.get("date"), now) ?? undefined;
  const params = {
    areaCodes: parseAreaCodes(sp.get("areas")),
    contentTypeIds: parseContentTypeIds(sp.get("types")),
    seaside: parseBool(sp.get("seaside")),
    seasonal: parseBool(sp.get("seasonal")),
    festivalOnly: parseBool(sp.get("festivalOnly")),
    noRain: parseBool(sp.get("noRain")),
    quiet: parseBool(sp.get("quiet")),
  };

  try {
    const result = await countCandidates(params, { now, dateYmd });
    return Response.json(result);
  } catch (e) {
    // 카운트는 부가 배지 — 상류 장애로 앱 흐름을 끊지 않고 정성 라벨로 조용히 폴백.
    console.error("[/api/random/count] 후보 수 계산 실패:", e);
    const fallback: CountResponse = { dynamic: true };
    return Response.json(fallback);
  }
}
