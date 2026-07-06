// 🧭 탐험가 레벨(M16, plan.md §7.8) — 정복한 시·군·구 수로 5단계 게임화.
//   재방문 동기: 다녀올수록 새싹 → 정복왕. 순수 함수(테스트 대상).

export interface ExplorerLevel {
  emoji: string;
  name: string;
  /** 이 레벨이 시작되는 정복 수 */
  base: number;
  /** 다음 레벨 도달에 필요한 정복 수(최고 레벨이면 null) */
  next: number | null;
  /** 다음 레벨까지 남은 곳(최고 레벨이면 0) */
  remaining: number;
  /** 현재 레벨 구간 진행률 0~100 정수 */
  progressPercent: number;
}

// [최소 정복 수, emoji, 이름] — 오름차순. 마지막 구간이 최고 레벨.
const TIERS: { min: number; emoji: string; name: string }[] = [
  { min: 0, emoji: "🌱", name: "여행 새싹" },
  { min: 1, emoji: "🧭", name: "동네 탐험가" },
  { min: 10, emoji: "🚶", name: "전국 여행가" },
  { min: 30, emoji: "🏴", name: "정복가" },
  { min: 100, emoji: "👑", name: "정복왕" },
];

/** 정복한 시·군·구 수 → 탐험가 레벨. 음수·비유한수는 0으로 방어. */
export function explorerLevel(conquered: number): ExplorerLevel {
  const n = Number.isFinite(conquered) && conquered > 0 ? Math.floor(conquered) : 0;

  // 현재 구간 = min <= n 인 마지막 티어.
  let i = 0;
  for (let k = 0; k < TIERS.length; k++) {
    if (n >= TIERS[k].min) i = k;
  }
  const tier = TIERS[i];
  const base = tier.min;
  const next = i < TIERS.length - 1 ? TIERS[i + 1].min : null;

  if (next == null) {
    return { emoji: tier.emoji, name: tier.name, base, next, remaining: 0, progressPercent: 100 };
  }
  const remaining = Math.max(0, next - n);
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round(((n - base) / (next - base)) * 100)),
  );
  return { emoji: tier.emoji, name: tier.name, base, next, remaining, progressPercent };
}
