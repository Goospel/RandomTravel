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

describe("revealBlock — 어디에 맞추나 (top·bottom = 뷰포트 기준, vh = 뷰포트 높이)", () => {
  const VH = 844;

  it("위로 벗어났으면 머리부터(start) — 아래가 보이든 말든", () => {
    expect(revealBlock(-1, 500, VH)).toBe("start");
    expect(revealBlock(-1, 1200, VH)).toBe("start");
  });

  it("아래로 삐져나갔으면 nearest", () => {
    expect(revealBlock(683, 1223, VH)).toBe("nearest"); // 폰 뽑기 직후 실측 카드
    expect(revealBlock(0, VH + 1, VH)).toBe("nearest");
  });

  // 이미 전부 보이는 카드에 nearest 를 걸면 scroll-mb(개요 지연 로드 슬랙 96px) 때문에
  //   데스크톱 '다시 굴리기'에서 98px 튀었다(2026-09-14 실측) — 다 보이면 아예 안 움직인다.
  it("이미 전부 보이면 null(스크롤 안 함)", () => {
    expect(revealBlock(181, 780, VH)).toBeNull();
  });

  it("경계 — top 0·bottom === vh 는 전부 보이는 것", () => {
    expect(revealBlock(0, VH, VH)).toBeNull();
  });
});
