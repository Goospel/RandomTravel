import { describe, it, expect } from "vitest";
import { relativeDay } from "@/lib/relativeDate";

// 📅 상대 날짜(M16 지도 다녀온 곳 리스트) — savedAt → "오늘/어제/N일 전/N달 전".
//   now 를 주입받는 순수 함수(테스트 결정성).

const DAY = 86400000;
const NOW = 1_700_000_000_000; // 고정 기준 시각

describe("relativeDay — 경과일 사람 표기", () => {
  it("같은 날은 오늘", () => {
    expect(relativeDay(NOW, NOW)).toBe("오늘");
    expect(relativeDay(NOW - DAY / 2, NOW)).toBe("오늘"); // 12시간 전도 아직 오늘
  });

  it("미래(음수 경과)는 오늘로 방어", () => {
    expect(relativeDay(NOW + DAY, NOW)).toBe("오늘");
  });

  it("하루 전은 어제", () => {
    expect(relativeDay(NOW - DAY, NOW)).toBe("어제");
  });

  it("2~29일은 'N일 전'", () => {
    expect(relativeDay(NOW - 2 * DAY, NOW)).toBe("2일 전");
    expect(relativeDay(NOW - 29 * DAY, NOW)).toBe("29일 전");
  });

  it("30일부터는 'N달 전'", () => {
    expect(relativeDay(NOW - 30 * DAY, NOW)).toBe("1달 전");
    expect(relativeDay(NOW - 59 * DAY, NOW)).toBe("1달 전");
    expect(relativeDay(NOW - 60 * DAY, NOW)).toBe("2달 전");
  });

  it("비유한 savedAt 은 빈 문자열", () => {
    expect(relativeDay(Number.NaN, NOW)).toBe("");
  });
});
