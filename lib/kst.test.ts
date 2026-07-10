// 📅 KST 벽시계 헬퍼(M19, plan.md §6.8) 순수 로직 — TDD(구현 전 작성).
//   서버 UTC 무관 Asia/Seoul 고정 날짜 산술 + YYYYMMDD→월 추출. 중립 모듈(클라 번들에도 안전).

import { describe, it, expect } from "vitest";
import { kstYmd, ymdOffset, kstDateParts, monthOf } from "@/lib/kst";

describe("kstYmd — 오늘(KST) YYYYMMDD", () => {
  it("UTC 자정 직전은 KST 로 이미 다음날", () => {
    // 2026-07-10 15:30 UTC = 2026-07-11 00:30 KST
    expect(kstYmd(new Date("2026-07-10T15:30:00Z"))).toBe("20260711");
  });
  it("월말·연초 경계", () => {
    // 2025-12-31 16:00 UTC = 2026-01-01 01:00 KST
    expect(kstYmd(new Date("2025-12-31T16:00:00Z"))).toBe("20260101");
  });
});

describe("ymdOffset — KST 오늘에서 days offset(YYYYMMDD)", () => {
  const noon = new Date("2026-07-10T03:00:00Z"); // KST 7/10 정오
  it("0 은 오늘, +1 은 내일", () => {
    expect(ymdOffset(noon, 0)).toBe("20260710");
    expect(ymdOffset(noon, 1)).toBe("20260711");
  });
  it("음수는 과거", () => {
    expect(ymdOffset(noon, -1)).toBe("20260709");
  });
  it("월 경계를 넘긴다", () => {
    expect(ymdOffset(new Date("2026-07-31T03:00:00Z"), 1)).toBe("20260801");
  });
  it("연 경계를 넘긴다", () => {
    expect(ymdOffset(new Date("2026-12-31T03:00:00Z"), 1)).toBe("20270101");
  });
  it("+29(집중률 예측 창 상한)", () => {
    expect(ymdOffset(noon, 29)).toBe("20260808");
  });
});

describe("kstDateParts — Asia/Seoul 연·월·일", () => {
  it("UTC 자정 걸침도 KST 벽시계 날짜", () => {
    // 2026-07-10 15:30 UTC = 2026-07-11 KST
    expect(kstDateParts(new Date("2026-07-10T15:30:00Z"))).toEqual({
      y: 2026,
      mo: 7,
      d: 11,
    });
  });
});

describe("monthOf — YYYYMMDD → 월(1-12)", () => {
  it("앞 0 있는 월도 정수로", () => {
    expect(monthOf("20260712")).toBe(7);
    expect(monthOf("20260101")).toBe(1);
    expect(monthOf("20261231")).toBe(12);
  });
});
