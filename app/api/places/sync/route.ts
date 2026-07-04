// M10 동기화 API — 로그인 병합 시 합집합을 서버에 일괄 업로드.
//  POST { saved: SavedPlace[], visited: SavedPlace[] } → 전부 업서트(있으면 무시)
// 삭제는 하지 않는다(v1: 삭제 미전파, syncMerge 주석 참조). 세션 필수.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { userPlaces } from "@/db/schema";
import { sanitizePlaces } from "@/lib/placesApi";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const saved = sanitizePlaces((body as { saved?: unknown })?.saved);
  const visited = sanitizePlaces((body as { visited?: unknown })?.visited);

  const rows = [
    ...saved.map((p) => ({ userId, list: "saved" as const, ...p })),
    ...visited.map((p) => ({ userId, list: "visited" as const, ...p })),
  ];
  if (rows.length > 0) {
    await db.insert(userPlaces).values(rows).onConflictDoNothing();
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
