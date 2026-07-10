import { describe, it, expect } from "vitest";
import { rotatingIndex } from "@/lib/rotatingIndex";

// 🎰 슬롯 로딩 메시지 로테이션(M18, plan.md §7.9) 순수 인덱스 계산 — TDD(구현 전 작성).
//   경과시간(ms) + 메시지 수 → 지금 보여줄 인덱스. 인터벌마다 다음 메시지로 순환.

describe("rotatingIndex — 경과시간 기반 순환 인덱스", () => {
  it("0ms 는 첫 메시지(0)", () => {
    expect(rotatingIndex(0, 2)).toBe(0);
  });

  it("한 인터벌(기본 900ms) 지나면 다음 인덱스", () => {
    expect(rotatingIndex(900, 2)).toBe(1);
    expect(rotatingIndex(899, 2)).toBe(0); // 아직 첫 인터벌 안
  });

  it("count 로 순환(모듈러) — 2개면 0,1,0,1…", () => {
    expect(rotatingIndex(1800, 2)).toBe(0); // 2번째 인터벌 → 0 으로 복귀
    expect(rotatingIndex(2700, 2)).toBe(1);
  });

  it("인터벌 길이 주입 가능", () => {
    expect(rotatingIndex(1200, 2, 1200)).toBe(1);
    expect(rotatingIndex(1199, 2, 1200)).toBe(0);
  });

  it("음수 경과·0/음수 count 는 0(방어)", () => {
    expect(rotatingIndex(-50, 2)).toBe(0);
    expect(rotatingIndex(900, 0)).toBe(0);
    expect(rotatingIndex(900, -1)).toBe(0);
  });

  it("count 1 이면 항상 0", () => {
    expect(rotatingIndex(0, 1)).toBe(0);
    expect(rotatingIndex(5000, 1)).toBe(0);
  });
});
