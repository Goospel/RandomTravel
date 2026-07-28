// 📈 임팩트 대시보드 데이터(M26, plan.md §7.15) — DB 조회만(TourAPI 0콜).
// 조립·1h 캐시·부분 실패 처리는 db/impact 가 담당한다(/impact 페이지와 공유).

import { NextResponse } from "next/server";
import { getImpactData } from "@/db/impact";

export async function GET() {
  const data = await getImpactData();
  return NextResponse.json(data);
}
