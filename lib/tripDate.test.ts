// 📅 방문 시점 날짜 칩(M19, plan.md §6.8) 순수 로직 — TDD(구현 전 작성).
//   요일 기준 정의: 오늘이 토·일이면 '이번 주말'=오늘(중복 ymd 자연 생략), 그 외엔 다가오는 토요일.
//   '다음 주말'=그다음 토요일(일요일 파탄 방지). 중복 ymd 칩 생략 → 개수 가변 3~4개.

import { describe, it, expect } from "vitest";
import { dateChips } from "@/lib/tripDate";

// 특정 요일의 KST 정오(03:00 UTC = 12:00 KST) Date 생성 — 요일 결정성 확보.
function kstNoon(ymd: string): Date {
  const s = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
  return new Date(`${s}T03:00:00Z`);
}

describe("dateChips — 요일별 칩 구성", () => {
  it("수요일(2026-07-08): 오늘·내일·이번 주말(토 7/11)·다음 주말(토 7/18) 4개", () => {
    const chips = dateChips(kstNoon("20260708"));
    expect(chips).toEqual([
      { key: "today", label: "오늘", ymd: "20260708" },
      { key: "tomorrow", label: "내일", ymd: "20260709" },
      { key: "thisWeekend", label: "이번 주말(토)", ymd: "20260711" },
      { key: "nextWeekend", label: "다음 주말(토)", ymd: "20260718" },
    ]);
  });

  it("월요일(2026-07-06): 이번 주말=다가오는 토(7/11), 다음 주말=7/18", () => {
    const chips = dateChips(kstNoon("20260706"));
    expect(chips.map((c) => c.ymd)).toEqual([
      "20260706",
      "20260707",
      "20260711",
      "20260718",
    ]);
  });

  it("금요일(2026-07-10): 내일(토 7/11)==이번 주말 → 중복 생략, 3개", () => {
    const chips = dateChips(kstNoon("20260710"));
    expect(chips.map((c) => c.key)).toEqual(["today", "tomorrow", "nextWeekend"]);
    expect(chips.map((c) => c.ymd)).toEqual(["20260710", "20260711", "20260718"]);
  });

  it("토요일(2026-07-11): 이번 주말=오늘 → 중복 생략, 다음 주말=7/18, 3개", () => {
    const chips = dateChips(kstNoon("20260711"));
    expect(chips.map((c) => c.key)).toEqual(["today", "tomorrow", "nextWeekend"]);
    expect(chips.map((c) => c.ymd)).toEqual(["20260711", "20260712", "20260718"]);
  });

  it("일요일(2026-07-12): 이번 주말=오늘 → 생략, 다음 주말=다가오는 토(7/18), 3개", () => {
    // 일요일 파탄 방지: '다가오는 토요일'=6일 뒤(7/18)가 곧 '다음 주말'.
    const chips = dateChips(kstNoon("20260712"));
    expect(chips.map((c) => c.key)).toEqual(["today", "tomorrow", "nextWeekend"]);
    expect(chips.map((c) => c.ymd)).toEqual(["20260712", "20260713", "20260718"]);
  });

  it("모든 ymd 는 오늘 이상·서로 다름(중복 없음)", () => {
    for (const d of ["20260706", "20260710", "20260711", "20260712"]) {
      const ymds = dateChips(kstNoon(d)).map((c) => c.ymd);
      expect(new Set(ymds).size).toBe(ymds.length); // 중복 없음
      expect(ymds.every((y) => y >= d)).toBe(true); // 과거 없음
    }
  });

  it("월말·연말 경계도 안전(토요일 오프셋이 월/연을 넘김)", () => {
    // 2026-12-30(수) → 다음 주말 토 = 2027-01-09
    const chips = dateChips(kstNoon("20261230"));
    expect(chips.find((c) => c.key === "nextWeekend")?.ymd).toBe("20270109");
  });
});
