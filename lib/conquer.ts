// 🧩 전국 정복 지도(M12, plan.md §7.4)의 순수 집계 — DOM 없이 단위 테스트 가능.
// 다녀온 곳의 좌표(lat/lng)를 지도 평면으로 투영해 어느 시·군·구 안에 있는지 판정하고,
// 방문 1곳 이상인 시·군·구를 "정복"으로 센다. 렌더는 components/ConquerMap.

import type { SavedPlace } from "@/lib/travelStore";
import {
  KOREA_SIGUNGU,
  KOREA_SIGUNGU_TOTAL,
  KOREA_PROJECTION,
  type Sigungu,
} from "@/lib/koreaMap";

/** 전체 시·군·구 수(정복률 분모) */
export const TOTAL_SIGUNGU = KOREA_SIGUNGU_TOTAL;

/** 방문 좌표(lat/lng) → 지도 평면(x,y). koreaMap 생성 때와 동일 투영. */
export function projectLatLng(lat: number, lng: number): { x: number; y: number } {
  const p = KOREA_PROJECTION;
  return {
    x: (lng - p.minLng) * p.kx * p.scale + p.pad,
    y: (p.maxLat - lat) * p.scale + p.pad,
  };
}

/**
 * 평탄 링 배열([x0,y0,x1,y1,...])들에 even-odd ray casting.
 * 여러 링을 한 점으로 종합 판정 — 섬(별도 외곽링)은 union, 홀(내부링)은 제외로 자연 처리.
 */
export function pointInRings(rings: number[][], x: number, y: number): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[2 * i], yi = ring[2 * i + 1];
      const xj = ring[2 * j], yj = ring[2 * j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

// 시·군·구별 bbox 인덱스(판정 프리필터) — 최초 1회만 계산.
interface SgBox {
  sg: Sigungu;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
let INDEX: SgBox[] | null = null;
function index(): SgBox[] {
  if (INDEX) return INDEX;
  INDEX = KOREA_SIGUNGU.map((sg) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of sg.rings) {
      for (let i = 0; i < r.length; i += 2) {
        const x = r[i], y = r[i + 1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { sg, minX, minY, maxX, maxY };
  });
  return INDEX;
}

// 투영 평면(x,y)을 담는 시·군·구 찾기(bbox 프리필터 후 ray casting). 없으면 null.
function hitAt(x: number, y: number): Sigungu | null {
  for (const b of index()) {
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    if (pointInRings(b.sg.rings, x, y)) return b.sg;
  }
  return null;
}

// 경계 nudge 반경(px). 인접 시·군·구 경계를 각자 독립 단순화(Douglas-Peucker)하면
// 공유 경계가 어긋나 어느 쪽에도 안 속하는 서브픽셀 갭(실거리 ~수백 m)이 생긴다.
// 정확 판정이 그 갭에 떨어지면 실제 방문이 '미정복'으로 새므로, 실패 시에만 8방향으로
// 살짝 밀어 인접 조각을 잡는다. 갭 폭(<1px)보다 크게 잡되 바다 좌표는 여전히 못 잡을 만큼 작게.
const NUDGE = 2;
const NUDGES: [number, number][] = [
  [NUDGE, 0], [-NUDGE, 0], [0, NUDGE], [0, -NUDGE],
  [NUDGE, NUDGE], [NUDGE, -NUDGE], [-NUDGE, NUDGE], [-NUDGE, -NUDGE],
];

/** 좌표가 속한 시·군·구(없으면 null). 정확 판정 우선, 경계 갭이면 nudge 폴백. */
export function sigunguAt(lat: number, lng: number): Sigungu | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { x, y } = projectLatLng(lat, lng);
  const exact = hitAt(x, y);
  if (exact) return exact;
  // 경계 슬리버 갭 구제 — 정확 판정 실패 시에만(대부분 내부점은 여기 안 옴).
  for (const [dx, dy] of NUDGES) {
    const h = hitAt(x + dx, y + dy);
    if (h) return h;
  }
  return null;
}

/** 정복한 시·군·구 code 집합. 방문 좌표가 유효하고 어느 시·군·구에 속하면 정복. */
export function conqueredSigunguCodes(visited: SavedPlace[]): Set<string> {
  const set = new Set<string>();
  for (const p of visited) {
    if (p.lat == null || p.lng == null) continue;
    const sg = sigunguAt(p.lat, p.lng);
    if (sg) set.add(sg.code);
  }
  return set;
}

export interface ConquerStats {
  /** 정복한 시·군·구 수 */
  conquered: number;
  /** 전체 시·군·구 수 */
  total: number;
  /** 정복률 0~100 정수(반올림) */
  percent: number;
}

/** 방문 목록 → 정복 통계(개수·전체·퍼센트). */
export function conquerStats(visited: SavedPlace[]): ConquerStats {
  const conquered = conqueredSigunguCodes(visited).size;
  const total = TOTAL_SIGUNGU; // 데이터의 시·군·구 수(약 250) — 0 나눗셈 불가
  const percent = Math.round((conquered / total) * 100);
  return { conquered, total, percent };
}

export interface AreaProgress {
  /** TourAPI areaCode */
  area: number;
  /** 이 시·도에서 정복한 시·군·구 수 */
  done: number;
  /** 이 시·도의 전체 시·군·구 수 */
  total: number;
}

// 시·도별 전체 시·군·구 수 — 최초 1회 계산.
let AREA_TOTALS: Map<number, number> | null = null;
function areaTotals(): Map<number, number> {
  if (AREA_TOTALS) return AREA_TOTALS;
  const m = new Map<number, number>();
  for (const sg of KOREA_SIGUNGU) m.set(sg.area, (m.get(sg.area) ?? 0) + 1);
  AREA_TOTALS = m;
  return m;
}

/** 정복한 시·군·구 code 집합 → 시·도별 진행(정복>0인 시·도만, 정복 수 내림차순). */
export function conquerByArea(codes: Set<string>): AreaProgress[] {
  const done = new Map<number, number>();
  const byCode = new Map<string, number>();
  for (const sg of KOREA_SIGUNGU) byCode.set(sg.code, sg.area);
  for (const code of codes) {
    const area = byCode.get(code);
    if (area != null) done.set(area, (done.get(area) ?? 0) + 1);
  }
  const totals = areaTotals();
  return [...done.entries()]
    .map(([area, d]) => ({ area, done: d, total: totals.get(area) ?? 0 }))
    .sort((a, b) => b.done - a.done || a.area - b.area);
}
