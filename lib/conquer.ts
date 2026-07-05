// 🧩 전국 정복 지도(M12, plan.md §7.4)의 순수 집계 — SVG·DOM 없이 단위 테스트 가능.
// "다녀왔어요" 방문 목록의 areaCode 로 어느 시·도를 정복(1곳 이상 방문)했는지 센다.
// 렌더는 components/ConquerMap 이 이 함수들 + lib/koreaMap(윤곽)을 조합해 담당한다.

import type { SavedPlace } from "@/lib/travelStore";
import { AREA_CODES } from "@/lib/constants";

/** 전체 시·도 수(정복률 분모) */
export const TOTAL_AREAS = AREA_CODES.length;

// 유효 areaCode 집합 — 손상값(null·0·범위 밖)이 정복률을 부풀리지 않게 화이트리스트로 막는다.
const VALID_AREAS = new Set<number>(AREA_CODES.map((a) => a.code));

/**
 * 정복한 시·도 areaCode 집합. 방문 1곳 이상이면 정복.
 * null·17개 시·도가 아닌 코드는 제외하고, 중복은 Set 으로 자연히 1개 처리.
 * 좌표(lat/lng) 유무는 보지 않는다 — 정복은 지역 기준이라 좌표 없는 방문도 인정.
 */
export function conqueredAreaCodes(visited: SavedPlace[]): Set<number> {
  const set = new Set<number>();
  for (const p of visited) {
    if (p.areaCode != null && VALID_AREAS.has(p.areaCode)) set.add(p.areaCode);
  }
  return set;
}

export interface ConquerStats {
  /** 정복한 시·도 수 */
  conquered: number;
  /** 전체 시·도 수(17) */
  total: number;
  /** 정복률 0~100 정수(반올림) */
  percent: number;
}

/** 방문 목록 → 정복 통계(개수·전체·퍼센트). */
export function conquerStats(visited: SavedPlace[]): ConquerStats {
  const conquered = conqueredAreaCodes(visited).size;
  const total = TOTAL_AREAS; // 항상 17(시·도 수) — 0 나눗셈 불가
  const percent = Math.round((conquered / total) * 100);
  return { conquered, total, percent };
}
