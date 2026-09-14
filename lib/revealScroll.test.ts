import { describe, it, expect } from "vitest";
import { LAND_HOLD_MS, revealBlock, revealTiming } from "@/lib/revealScroll";

// 🎯 결과 드러내기 스크롤 판단부 — TDD(구현 전 작성).
//   확정하는 것: 지연·behavior·block 결정 규칙. 실제 DOM 스크롤·타이머·입력 취소는
//   이 테스트가 보지 않는다(음성 판정 전용) — 그건 브라우저 계측이 담당.

describe("revealTiming — 언제·어떻게 움직이나", () => {
  it("착지 연출이 있는 커밋(hold)은 LAND_HOLD_MS 뒤 smooth", () => {
    expect(revealTiming(true, false)).toEqual({ delayMs: 800, behavior: "smooth" });
  });

  it("hold 없는 커밋(에러·코스)은 기다리지 않는다", () => {
    expect(revealTiming(false, false)).toEqual({ delayMs: 0, behavior: "smooth" });
  });

  it("reduced-motion 이면 hold 여도 즉시·auto", () => {
    expect(revealTiming(true, true)).toEqual({ delayMs: 0, behavior: "auto" });
  });

  it("reduced-motion 은 hold 와 무관하게 즉시·auto", () => {
    expect(revealTiming(false, true)).toEqual({ delayMs: 0, behavior: "auto" });
  });

  it("지연은 상수 노브에서 온다", () => {
    expect(revealTiming(true, false).delayMs).toBe(LAND_HOLD_MS);
  });
});

describe("revealBlock — 어디에 맞추나", () => {
  it("위로 벗어났으면 머리부터(start)", () => {
    expect(revealBlock(-1)).toBe("start");
  });

  it("경계 0 은 벗어난 게 아니다(nearest)", () => {
    expect(revealBlock(0)).toBe("nearest");
  });

  it("아래쪽이면 nearest(이미 보이면 no-op)", () => {
    expect(revealBlock(500)).toBe("nearest");
  });
});
