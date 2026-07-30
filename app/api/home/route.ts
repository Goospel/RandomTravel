// 🏠 거주지 API (M28, plan.md §7.17A) — 로그인 사용자의 거주 시·군·구 1개.
//  GET → { code: string | null, name: string | null }   (name = "서울 종로구" 표시용)
//  PUT { code: string | null } → 저장(널이면 해제)
// 모두 세션 필수(비로그인 401) — 거주지는 회원 전용 기능이다.
//
// 값이 스칼라 1개라 M10 의 병합 동기화(lib/syncMerge)를 붙이지 않는다 — 병합할 순서 개념이
//   없고 마지막 쓰기 승리가 곧 사용자 의도다(기기 A 에서 바꾸면 그게 최신).

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { KOREA_SIGUNGU } from "@/lib/koreaMap";
import { AREA_CODES } from "@/lib/constants";

/** 표시명 "서울 종로구" — 클라가 지도 데이터(~200KB) 없이도 저장된 거주지를 보여줄 수 있게. */
function displayName(code: string | null): string | null {
  if (!code) return null;
  const sg = KOREA_SIGUNGU.find((s) => s.code === code);
  if (!sg) return null;
  const area = AREA_CODES.find((a) => a.code === sg.area);
  return area ? `${area.name} ${sg.name}` : sg.name;
}

async function requireUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ code: users.homeSigungu })
    .from(users)
    .where(eq(users.id, userId));

  // 저장된 코드가 지도 데이터에서 사라졌으면(생성기 재실행 등) 미설정으로 취급 — 죽은 코드로
  //   뽑기가 빈 풀이 되느니 다시 고르게 한다.
  const code = row?.code ?? null;
  const name = displayName(code);
  return NextResponse.json({ code: name ? code : null, name });
}

export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const raw = (body as { code?: unknown })?.code;
  const code = raw === null ? null : typeof raw === "string" ? raw.trim() : undefined;
  // 화이트리스트 밖·타입 불일치는 400 — 저장은 되는데 뽑기가 빈 풀이 되는 조용한 실패 방지.
  if (code === undefined || (code !== null && !displayName(code))) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  await db.update(users).set({ homeSigungu: code }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true, code, name: displayName(code) });
}
