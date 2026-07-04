// M10 동기화 API — 로그인 사용자의 찜/방문 목록 CRUD.
//  GET    → { saved: SavedPlace[], visited: SavedPlace[] }
//  POST   { list, place }        → 한 곳 추가(업서트, 있으면 무시)
//  DELETE { list, contentId }    → 한 곳 삭제
// 모두 세션 필수(비로그인 401). 소유자는 세션 user.id 로만 판별 — body 로 못 위조.

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { userPlaces } from "@/db/schema";
import { isPlaceList, sanitizePlace } from "@/lib/placesApi";
import type { SavedPlace } from "@/lib/travelStore";

type Row = typeof userPlaces.$inferSelect;

function rowToPlace(r: Row): SavedPlace {
  return {
    contentId: r.contentId,
    contentTypeId: r.contentTypeId,
    title: r.title,
    address: r.address,
    image: r.image,
    lat: r.lat,
    lng: r.lng,
    areaCode: r.areaCode,
    savedAt: r.savedAt,
  };
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(userPlaces)
    .where(eq(userPlaces.userId, userId));

  const byList = (list: "saved" | "visited") =>
    rows
      .filter((r) => r.list === list)
      .map(rowToPlace)
      .sort((a, b) => b.savedAt - a.savedAt);

  return NextResponse.json({ saved: byList("saved"), visited: byList("visited") });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const list = (body as { list?: unknown })?.list;
  const place = sanitizePlace((body as { place?: unknown })?.place);
  if (!isPlaceList(list) || !place) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await db
    .insert(userPlaces)
    .values({ userId, list, ...place })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const list = (body as { list?: unknown })?.list;
  const contentId = (body as { contentId?: unknown })?.contentId;
  if (!isPlaceList(list) || typeof contentId !== "string" || !contentId) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await db
    .delete(userPlaces)
    .where(
      and(
        eq(userPlaces.userId, userId),
        eq(userPlaces.list, list),
        eq(userPlaces.contentId, contentId),
      ),
    );

  return NextResponse.json({ ok: true });
}
