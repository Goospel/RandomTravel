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

// 해안 스냅 최대 거리(px). 두 가지 무성 미스를 함께 구제한다.
//  1) 인접 시·군·구 경계를 각자 독립 단순화하면 공유 경계가 어긋나 어느 쪽에도 안 속하는
//     서브픽셀 갭이 생긴다.
//  2) 해안선 단순화(EPS ~450m)와 작은 섬 제거(KEEP)가 해안·반도·소도서의 관광지 좌표를
//     폴리곤 밖으로 밀어낸다(실측: 인천 월미도 관광지가 중구 경계 밖 0.04px).
// 관광지 좌표는 늘 육지·해안에 있으므로, 정확 판정 실패 시 가장 가까운 시·군·구 경계까지의
// 거리가 임계 이내면 그 조각으로 스냅한다. 실측상 해안 미스는 ~0.04px, 먼바다(동해 한가운데)는
// ~103px라 그 사이인 12px(~7.5km)면 해안·소도서는 구제하되 먼바다는 배제한다.
const SNAP_MAX = 12;

// 점(px)에서 선분 [a,b]까지 최단거리.
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// 정확 판정 실패 시: 경계까지 거리가 SNAP_MAX 이내인 가장 가까운 시·군·구(없으면 null).
// bbox 를 SNAP_MAX 로 확장해 프리필터 후, 남은 조각의 링 선분까지 최단거리를 잰다.
function nearestWithin(x: number, y: number): Sigungu | null {
  let best = SNAP_MAX, bestSg: Sigungu | null = null;
  for (const b of index()) {
    if (x < b.minX - SNAP_MAX || x > b.maxX + SNAP_MAX || y < b.minY - SNAP_MAX || y > b.maxY + SNAP_MAX) continue;
    for (const r of b.sg.rings) {
      const n = r.length / 2;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const d = segDist(x, y, r[2 * j], r[2 * j + 1], r[2 * i], r[2 * i + 1]);
        if (d < best) { best = d; bestSg = b.sg; }
      }
    }
  }
  return bestSg;
}

/** 좌표가 속한 시·군·구(없으면 null). 정확 판정 우선, 경계 갭·해안 미스면 최근접 스냅. */
export function sigunguAt(lat: number, lng: number): Sigungu | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const { x, y } = projectLatLng(lat, lng);
  const exact = hitAt(x, y);
  if (exact) return exact;
  // 경계 갭·해안 침식 구제 — 정확 판정 실패 시에만(내부점은 여기 안 옴).
  return nearestWithin(x, y);
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

// 🔭 visitedAreaCodes 는 lib/visitedAreas 로 이동(koreaMap 비의존 — 홈 번들 보호, §7.11).
//    여기선 하위호환 재-export 만 유지(기존 conquer 소비처·conquer.test 무변). 단 홈(page.tsx)·
//    MapHero 는 conquer 를 거치면 koreaMap 이 딸려오므로 반드시 @/lib/visitedAreas 를 직접 참조한다.
export { visitedAreaCodes } from "@/lib/visitedAreas";

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
