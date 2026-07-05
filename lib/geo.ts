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
