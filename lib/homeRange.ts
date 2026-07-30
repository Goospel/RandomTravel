// 🏠 집에서 갈 만한 곳(M28, plan.md §7.17)의 순수 로직 — 거주지 반경 내 시·군·구 집합.
//
// 네트워크·DB 없음(단위 테스트 O). getCongestionDay 조회·좌표 검증은 lib/tourapi 의 drawFromHome
// 이 담당(lib/emptySpot ↔ lib/tourapi 의 순수/불순 분리와 같은 대칭).
//   - 🍃 한적 정의는 emptySpotSigunguSet 과 **같은 규칙**을 쓴다(sigunguPctRank ≤ QUIET_SIGUNGU_CUT).
//     정의를 여기서 다시 쓰면 같은 배지가 화면마다 다른 뜻이 된다.
//   - 좌표는 지도 조각(KOREA_SIGUNGU.rings)의 정점평균을 KOREA_PROJECTION 으로 역투영해 얻는다 —
//     새 데이터 파일·생성 스크립트를 만들지 않는다(이미 커밋된 지도가 단일 출처).

import { KOREA_SIGUNGU, KOREA_PROJECTION } from "@/lib/koreaMap";
import { ringsCentroid } from "@/lib/conquer";
import { haversineM } from "@/lib/geo";
import { sigunguPctRank, QUIET_SIGUNGU_CUT } from "@/lib/congestion";

// ⚠️ 밴드 프리셋(HOME_RANGE_KM)은 lib/constants 에 산다 — 이 파일은 koreaMap(~200KB)을 들여
//    클라 번들에 못 실리는데, 조건 패널·쿼리 빌더도 같은 값을 봐야 하기 때문(§7.17C).

// 시·군·구 code → 중심 좌표. 250개 정점평균 + 역투영이라 최초 1회만 계산(conquer.ts 인덱스 관례).
let CENTERS: Map<string, { lat: number; lng: number }> | null = null;
function centers(): Map<string, { lat: number; lng: number }> {
  if (CENTERS) return CENTERS;
  const p = KOREA_PROJECTION;
  const m = new Map<string, { lat: number; lng: number }>();
  for (const sg of KOREA_SIGUNGU) {
    const c = ringsCentroid(sg.rings);
    if (!c) continue;
    // projectLatLng 의 역: x = (lng-minLng)*kx*scale + pad · y = (maxLat-lat)*scale + pad
    m.set(sg.code, {
      lat: p.maxLat - (c.y - p.pad) / p.scale,
      lng: (c.x - p.pad) / (p.kx * p.scale) + p.minLng,
    });
  }
  CENTERS = m;
  return m;
}

/**
 * 시·군·구 통계청 code → 대략 중심 좌표(없으면 null).
 * 조각 정점평균이라 실제 청사 위치와 수 km 어긋난다 — 거리 밴드가 70·200km 단위라 무해하다.
 */
export function sigunguCenterLatLng(
  code: string,
): { lat: number; lng: number } | null {
  return centers().get(code) ?? null;
}

/**
 * 🏠 거주지 반경 내 시·군·구 통계청 code 집합(§7.17B).
 * @param homeCode 거주지 시·군·구 통계청 code. 무효면 **빈 집합** — 필터가 조용히 전국으로
 *                 넓어지면 "집에서 갈 만한 곳"이라는 약속이 깨진다(축소보다 침묵이 나쁘다).
 * @param maxKm    직선거리 상한(km). 0·음수·비유한은 빈 집합.
 * @param ranks    그날 전국 시군구 pctRank(법정동cd→pctRank). null = 🍃 성능저하(조회 실패·stale)
 *                 → 한적 판정을 생략하고 **거리만**으로 폴백(호출부가 notice 로 알린다).
 *
 * 자기 동네(거주 시·군·구)는 거리 0 이라 항상 포함된다 — 제외하지 않는다(§7.17C).
 */
export function homeRangeSigunguSet(
  homeCode: string,
  maxKm: number,
  ranks: Map<string, number> | null,
): Set<string> {
  const out = new Set<string>();
  if (!Number.isFinite(maxKm) || maxKm <= 0) return out;
  const home = sigunguCenterLatLng(homeCode);
  if (!home) return out;

  const maxM = maxKm * 1000;
  for (const sg of KOREA_SIGUNGU) {
    const c = centers().get(sg.code);
    if (!c) continue;
    if (haversineM(home.lat, home.lng, c.lat, c.lng) > maxM) continue;
    if (ranks !== null) {
      const p = sigunguPctRank(sg.area, sg.name, ranks);
      if (p == null || p > QUIET_SIGUNGU_CUT) continue; // 랭크 결측은 한적 아님(보수 — 배지와 동일)
    }
    out.add(sg.code);
  }
  return out;
}
