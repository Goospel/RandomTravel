// 📝 개요(detailCommon2) 지연 로드 — plan.md §5.6 "detailCommon 지연 호출"
//
// 왜 분리했나: contentId 는 뽑을 때마다 달라 24h 캐시가 사실상 항상 미스다. 뽑기 응답 안에서
// 기다리면 **모든 뽑기가 이 왕복 1회를 통째로 떠안는다**(카드 기본 정보는 목록 응답만으로 충분한데도).
// 카드를 먼저 띄우고 개요만 뒤따라 채우면 체감 지연에서 이 왕복이 빠진다.
//
// 실패·없음은 모두 200 + { overview: null } — 개요는 부가 정보라 카드를 죽이지 않는다
// (기존 getOverview 의 best-effort 계약을 그대로 유지).

import { type NextRequest } from "next/server";
import { getOverview, getWithFacilities } from "@/lib/tourapi";
import { parseContentIds } from "@/lib/query";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  // 코스 exclude 와 같은 값 타입(숫자 문자열)이라 같은 파서를 쓴다 — 1건만 취한다.
  const contentId = parseContentIds(sp.get("contentId"), 1)[0];
  if (!contentId) {
    return Response.json({ error: "contentId 가 올바르지 않아요." }, { status: 400 });
  }
  // ♿ detail=with(§6.11) — 개요와 함께 detailWithTour2 편의시설 칩을 한 왕복에 실어 준다.
  //   둘 다 24h 캐시·best-effort라 병렬로 붙여도 실패가 카드를 죽이지 않는다.
  if (sp.get("detail") === "with") {
    const [overview, facilities] = await Promise.all([
      getOverview(contentId),
      getWithFacilities(contentId),
    ]);
    return Response.json({ overview, facilities });
  }
  return Response.json({ overview: await getOverview(contentId) });
}
