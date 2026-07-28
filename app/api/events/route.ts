// 📈 익명 이벤트 수집(M26 · §12.6 P1, plan.md §7.15) — 단건 또는 소배치 POST.
//
// 인증이 없다(익명 수집) = **parseTravelEvent 가 유일한 신뢰 경계**다. 화이트리스트 밖이면
// 400 으로 거절하고, 미지 필드는 무시한다. 남용 방어 v1 은 스키마 검증 + 크기 상한까지만
// (레이트리밋은 실트래픽이 생기면 — §7.15 비범위).
//
// 클라(hooks/useTravelStore)는 sendBeacon 으로 던지고 **응답을 보지 않는다** — 여기서 뭘
// 돌려주든 UX 는 영향받지 않는다. 상태 코드는 사람이 디버깅할 때만 쓰인다.

import { NextResponse } from "next/server";
import { db } from "@/db";
import { travelEvents } from "@/db/schema";
import { MAX_EVENT_BATCH, parseTravelEvent } from "@/lib/impact";

/** 페이로드 상한 — 20건 × 넉넉한 1건 크기. 넘으면 파싱 전에 끊는다. */
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0 || items.length > MAX_EVENT_BATCH) {
    return NextResponse.json({ error: "invalid_batch" }, { status: 400 });
  }

  const parsed = items.map(parseTravelEvent);
  // 한 건이라도 스키마를 어기면 배치 전체를 거절한다 — 부분 수용은 "무엇이 저장됐나"를
  // 클라가 알 수 없게 만들고, 조용한 유실이 스키마 버그를 가린다.
  if (parsed.some((p) => p === null)) {
    return NextResponse.json({ error: "invalid_schema" }, { status: 400 });
  }

  try {
    await db.insert(travelEvents).values(parsed as NonNullable<(typeof parsed)[number]>[]);
  } catch (e) {
    console.error("[/api/events] 이벤트 적재 실패:", e);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return new Response(null, { status: 204 });
}
