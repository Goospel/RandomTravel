import { describe, it, expect } from "vitest";
import { explorerLevel } from "@/lib/level";

// 🧭 탐험가 레벨(M16) — 정복한 시·군·구 수로 5단계. 재방문 동기(게임화).
//   🌱 여행 새싹(0) → 🧭 동네 탐험가(1~9) → 🚶 전국 여행가(10~29)
//   → 🏴 정복가(30~99) → 👑 정복왕(100+)

describe("explorerLevel — 정복 수 → 레벨", () => {
  it("0곳이면 여행 새싹", () => {
    const lv = explorerLevel(0);
    expect(lv.name).toBe("여행 새싹");
    expect(lv.emoji).toBe("🌱");
    expect(lv.base).toBe(0);
    expect(lv.next).toBe(1);
    expect(lv.remaining).toBe(1);
    expect(lv.progressPercent).toBe(0);
  });

  it("1곳이면 동네 탐험가로 승급", () => {
    const lv = explorerLevel(1);
    expect(lv.name).toBe("동네 탐험가");
    expect(lv.emoji).toBe("🧭");
    expect(lv.base).toBe(1);
    expect(lv.next).toBe(10);
    expect(lv.remaining).toBe(9);
    expect(lv.progressPercent).toBe(0);
  });

  it("구간 중간은 진행률을 반올림한다", () => {
    // 동네 탐험가 [1,10): 5곳 → (5-1)/(10-1)=44.4% → 44
    expect(explorerLevel(5).progressPercent).toBe(44);
    // 9곳 → 8/9=88.9% → 89, 남은 1곳
    const nine = explorerLevel(9);
    expect(nine.progressPercent).toBe(89);
    expect(nine.remaining).toBe(1);
  });

  it("10곳이면 전국 여행가", () => {
    const lv = explorerLevel(10);
    expect(lv.name).toBe("전국 여행가");
    expect(lv.emoji).toBe("🚶");
    expect(lv.base).toBe(10);
    expect(lv.next).toBe(30);
    expect(lv.remaining).toBe(20);
    expect(lv.progressPercent).toBe(0);
  });

  it("30곳이면 정복가", () => {
    const lv = explorerLevel(30);
    expect(lv.name).toBe("정복가");
    expect(lv.emoji).toBe("🏴");
    expect(lv.base).toBe(30);
    expect(lv.next).toBe(100);
  });

  it("99곳은 아직 정복가, 남은 1곳", () => {
    const lv = explorerLevel(99);
    expect(lv.name).toBe("정복가");
    expect(lv.remaining).toBe(1);
    // (99-30)/(100-30)=98.6% → 99
    expect(lv.progressPercent).toBe(99);
  });

  it("100곳이면 정복왕(최고 레벨) — next는 null, 진행률 100", () => {
    const lv = explorerLevel(100);
    expect(lv.name).toBe("정복왕");
    expect(lv.emoji).toBe("👑");
    expect(lv.base).toBe(100);
    expect(lv.next).toBeNull();
    expect(lv.remaining).toBe(0);
    expect(lv.progressPercent).toBe(100);
  });

  it("최고 레벨은 넘어가도 유지", () => {
    expect(explorerLevel(250).name).toBe("정복왕");
    expect(explorerLevel(250).progressPercent).toBe(100);
  });

  it("음수·비유한수는 0으로 방어", () => {
    expect(explorerLevel(-5).name).toBe("여행 새싹");
    expect(explorerLevel(Number.NaN).name).toBe("여행 새싹");
  });
});
