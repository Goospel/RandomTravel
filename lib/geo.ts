// 지리 표시 유틸 — 순수 함수 (plan.md M14)

/**
 * 미터 → "8.2km" 표기. 소수 첫째 자리 반올림.
 * 0·음수·비유한수·아주 가까운 값은 "0.1km" 하한으로(거리 배지가 "0km"로 뜨지 않게).
 */
export function formatKm(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0.1km";
  const km = Math.round((meters / 1000) * 10) / 10;
  return `${Math.max(km, 0.1).toFixed(1)}km`;
}

const EARTH_RADIUS_M = 6_371_000; // 평균 반경(m)
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * 두 좌표 간 대권 직선거리(m) — 하버사인(🧭 M20 코스 다리 거리, §7.10).
 * 동일점=0, a→b 와 b→a 대칭. locationBased 응답 dist(앵커 기준)와 달리 임의 두 점 간이라
 * 스텝→스텝 다리 축을 통일할 수 있다(레포에 하버사인이 없어 신설).
 */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}
