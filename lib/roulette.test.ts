import { describe, it, expect } from "vitest";
import {
  rouletteFrame,
  pickFlashCodes,
  TICK_FAST_MS,
  TICK_SLOW_MS,
  FLASH_MAX,
} from "@/lib/roulette";

// 🎰 정복 지도 룰렛(M23, plan.md §7.12) 순수 스케줄 — TDD(구현 전 작성).
//   경과시간 → 이번 tick 의 간격·동시 점등 개수(감속). 타이머 루프·DOM 은 비대상.

describe("rouletteFrame — 감속 스케줄", () => {
  const TOTAL = 1200;

  it("시작(0ms)은 가장 빠르고 가장 많이 켠다", () => {
    expect(rouletteFrame(0, TOTAL)).toEqual({
      intervalMs: TICK_FAST_MS,
      count: FLASH_MAX,
    });
  });

  it("끝(total 이상)은 가장 느리고 한 조각만 켠다", () => {
    expect(rouletteFrame(TOTAL, TOTAL)).toEqual({ intervalMs: TICK_SLOW_MS, count: 1 });
    expect(rouletteFrame(99999, TOTAL)).toEqual({ intervalMs: TICK_SLOW_MS, count: 1 });
  });

  it("경과할수록 간격은 비감소, 개수는 비증가(단조)", () => {
    let prev = rouletteFrame(0, TOTAL);
    for (let t = 60; t <= TOTAL; t += 60) {
      const f = rouletteFrame(t, TOTAL);
      expect(f.intervalMs).toBeGreaterThanOrEqual(prev.intervalMs);
      expect(f.count).toBeLessThanOrEqual(prev.count);
      prev = f;
    }
  });

  it("중간은 양 끝 사이에 있다(상수 구간 아님 — 실제로 감속한다)", () => {
    const mid = rouletteFrame(TOTAL / 2, TOTAL);
    expect(mid.intervalMs).toBeGreaterThan(TICK_FAST_MS);
    expect(mid.intervalMs).toBeLessThan(TICK_SLOW_MS);
    expect(mid.count).toBeLessThan(FLASH_MAX);
    expect(mid.count).toBeGreaterThan(1);
  });

  it("개수는 언제나 1 이상 FLASH_MAX 이하 정수", () => {
    for (let t = -100; t <= TOTAL + 100; t += 37) {
      const { count } = rouletteFrame(t, TOTAL);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(FLASH_MAX);
    }
  });

  it("음수·비유한 경과는 시작으로 방어", () => {
    expect(rouletteFrame(-500, TOTAL)).toEqual(rouletteFrame(0, TOTAL));
    expect(rouletteFrame(NaN, TOTAL)).toEqual(rouletteFrame(0, TOTAL));
  });

  it("total 이 0·음수·비유한이면 끝으로 취급(0 나눗셈 방지)", () => {
    const end = { intervalMs: TICK_SLOW_MS, count: 1 };
    expect(rouletteFrame(0, 0)).toEqual(end);
    expect(rouletteFrame(0, -1)).toEqual(end);
    expect(rouletteFrame(0, NaN)).toEqual(end);
  });
});

describe("pickFlashCodes — 중복 없이 N조각 뽑기", () => {
  const POOL = ["a", "b", "c", "d", "e"];
  // 결정적 rand — 주어진 시퀀스를 순환한다.
  const seq = (xs: number[]) => {
    let i = 0;
    return () => xs[i++ % xs.length];
  };

  it("요청 개수만큼, 중복 없이 뽑는다", () => {
    const got = pickFlashCodes(POOL, 3, seq([0.1, 0.9, 0.5, 0.3]));
    expect(got).toHaveLength(3);
    expect(new Set(got).size).toBe(3);
    for (const c of got) expect(POOL).toContain(c);
  });

  it("풀보다 많이 요청하면 전량만 준다(순서 무관)", () => {
    const got = pickFlashCodes(POOL, 99, seq([0.42]));
    expect([...got].sort()).toEqual([...POOL].sort());
  });

  it("빈 풀·0개·음수·비유한은 빈 배열", () => {
    expect(pickFlashCodes([], 5, seq([0.5]))).toEqual([]);
    expect(pickFlashCodes(POOL, 0, seq([0.5]))).toEqual([]);
    expect(pickFlashCodes(POOL, -3, seq([0.5]))).toEqual([]);
    expect(pickFlashCodes(POOL, NaN, seq([0.5]))).toEqual([]);
  });

  it("같은 rand 시퀀스면 같은 결과(결정성)", () => {
    const a = pickFlashCodes(POOL, 3, seq([0.1, 0.7, 0.35]));
    const b = pickFlashCodes(POOL, 3, seq([0.1, 0.7, 0.35]));
    expect(a).toEqual(b);
  });

  it("rand 가 다르면 다른 조각도 나온다(고정 반환 아님)", () => {
    const first = pickFlashCodes(POOL, 1, () => 0);
    const last = pickFlashCodes(POOL, 1, () => 0.999);
    expect(first).not.toEqual(last);
  });

  it("원본 배열을 변형하지 않는다", () => {
    const pool = [...POOL];
    pickFlashCodes(pool, 3, seq([0.8, 0.2, 0.6]));
    expect(pool).toEqual(POOL);
  });
});
