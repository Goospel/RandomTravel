// 🧩 발 들인 시·도 집계 — koreaMap 비의존 경량 분리(M21, plan.md §7.11 번들 보호).
//
// visitedAreaCodes 는 p.areaCode 만 읽어 koreaMap(~207KB)이 전혀 필요 없다. 그런데 이 함수가
// lib/conquer(koreaMap 정적 의존)에 있으면 홈(app/page.tsx)·MapHero 가 conquer 를 정적 import 하며
// koreaMap 을 메인 청크로 끌어와 🔭 빈 곳 뽑기의 동적 import("@/lib/conquer") 가 무효가 된다.
// → 홈이 참조하는 이 순수부만 여기로 떼어 홈 초기 번들에서 koreaMap 을 뺀다(검증: next build).

import type { SavedPlace } from "@/lib/travelStore";

/**
 * 발 들인 시·도 code 집합(M16) — areaCode 기준 직접 집계.
 * 시·군·구 정복(좌표 판정)과 달리 **좌표 없는 방문도 포함**한다. 홈 히어로 17타일·
 * 헤더 정복 pill·지도 '발 들인 시·도'가 공유하는 단일 출처(숫자 일관성).
 */
export function visitedAreaCodes(visited: SavedPlace[]): Set<number> {
  const set = new Set<number>();
  for (const p of visited) {
    if (p.areaCode != null) set.add(p.areaCode);
  }
  return set;
}
