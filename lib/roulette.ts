// 🎰 정복 지도 룰렛(M23, plan.md §7.12) — 뽑는 동안 시·군·구 조각을 점멸시키는 감속 스케줄.
//   경과시간만으로 이번 tick 의 간격·동시 점등 개수가 정해지는 순수 함수라 프레임 상태를
//   들고 다닐 필요가 없다(마운트 시각만 있으면 어느 시점이든 재계산 가능).
//   실제 타이머 루프·색칠은 components/ConquerSvg 를 쓰는 배선 쪽 몫.

/** tick 간격 — 회전 시작(가장 빠름) */
export const TICK_FAST_MS = 60;
/** tick 간격 — 착지 직전(가장 느림) */
export const TICK_SLOW_MS = 320;
/** 동시 점등 최대 개수(시작). 끝은 항상 1조각. */
export const FLASH_MAX = 12;

export interface RouletteFrame {
  /** 다음 tick 까지 기다릴 시간(ms) */
  intervalMs: number;
  /** 이번 tick 에 동시에 켤 조각 수(1 이상) */
  count: number;
}

// 경과/전체 → 0~1 진행률. 음수·비유한 경과는 시작(0), 전체가 0 이하·비유한이면 끝(1)으로
// 방어한다(0 나눗셈 방지 — 회전이 영영 안 끝나는 것보다 즉시 착지가 안전).
function progress(elapsedMs: number, totalMs: number): number {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / totalMs);
}

// 감속 곡선 — 초반은 거의 등속으로 빠르게 돌다 끝에서 급격히 느려진다(룰렛 체감).
const ease = (p: number) => p * p;

/** 경과시간 → 이번 tick 의 간격·점등 개수. 단조: 경과할수록 간격↑ 개수↓. */
export function rouletteFrame(elapsedMs: number, totalMs: number): RouletteFrame {
  const e = ease(progress(elapsedMs, totalMs));
  return {
    intervalMs: Math.round(TICK_FAST_MS + (TICK_SLOW_MS - TICK_FAST_MS) * e),
    count: Math.max(1, Math.round(FLASH_MAX - (FLASH_MAX - 1) * e)),
  };
}

/**
 * 풀에서 중복 없이 count 개. 풀보다 많이 요청하면 전량.
 * rand 주입(기본 Math.random)으로 테스트에서 결정적.
 */
export function pickFlashCodes(
  codes: string[],
  count: number,
  rand: () => number = Math.random,
): string[] {
  const n = Number.isFinite(count) ? Math.min(Math.floor(count), codes.length) : 0;
  if (n <= 0) return [];
  // 부분 Fisher-Yates — 복사본 앞 n 칸만 확정하면 중복 없이 n 개(원본 무변).
  const pool = [...codes];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    // rand 가 1 을 돌려주는 구현도 있어 인덱스를 마지막 칸으로 클램프.
    const j = Math.min(i + Math.floor(rand() * (pool.length - i)), pool.length - 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
    out.push(pool[i]);
  }
  return out;
}
