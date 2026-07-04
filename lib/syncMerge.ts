// M10 동기화 — 로그인 시 로컬(localStorage, 비로그인 중 쌓인 것)과 서버(다른 기기에서
// 동기화된 것)를 병합하는 순수 로직. DB·네트워크 없이 단위 테스트 가능.
//
// contentId 기준 합집합 — 어느 기기에서든 저장한 곳은 유지한다.
// 충돌(양쪽에 같은 contentId): 먼저 저장한 기록(작은 savedAt) 유지 → 결정적.
//
// ⚠️ v1 한계: 삭제는 기기 간 전파하지 않는다(툼스톤 미도입). 합집합이라, 한 기기에서
//   찜 해제한 항목이 다른 기기 로그인 시 되살아날 수 있다. 전략 A(비로그인 폴백)에서
//   "잃지 않는다"를 우선한 절충 — README/plan 에 명시한다.

import type { SavedPlace } from "@/lib/travelStore";

export function mergePlaces(
  local: SavedPlace[],
  server: SavedPlace[],
): SavedPlace[] {
  const byId = new Map<string, SavedPlace>();
  // server 를 먼저 넣어 동점(savedAt 동일) 시 서버 기록이 자리 잡게 한다.
  for (const item of [...server, ...local]) {
    const prev = byId.get(item.contentId);
    if (!prev || item.savedAt < prev.savedAt) {
      byId.set(item.contentId, item);
    }
  }
  return [...byId.values()].sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * 로컬에만 있고 서버엔 없는 항목(contentId 기준). 로그인 병합 시 서버로 올릴 "델타".
 * 서버에 이미 있는 항목은 안 올려, 병합 업로드가 방금 삭제한 서버 항목을 되살리는 것을 막는다.
 */
export function localOnly(
  local: SavedPlace[],
  server: SavedPlace[],
): SavedPlace[] {
  const serverIds = new Set(server.map((p) => p.contentId));
  return local.filter((p) => !serverIds.has(p.contentId));
}
