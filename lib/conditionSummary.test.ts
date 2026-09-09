// 🎫 조건 요약 한 줄(M32, plan.md §7.21) 순수 로직 — TDD(구현 전 작성).
//
// 이 함수의 계약은 **표시·전송 일치**다: buildRandomQuery 가 서버에 안 보내는 조건은
// 요약에도 없어야 한다. 잠긴 칸(🐕 의 지역·테마, 🏠 의 거의 전부, 미래 기준일의 ☔)을
// 요약이 말하면 화면이 거짓말을 한다 — 아래 테스트 절반이 그 경계를 잠근다.

import { describe, it, expect } from "vitest";
import { conditionSummary } from "@/lib/conditionSummary";
import type { ConditionInput } from "@/lib/conditionSummary";

const BASE: ConditionInput = {
  areas: [],
  types: [],
  seaside: false,
  pet: false,
  barrierFree: false,
  seasonal: false,
  festival: false,
  noRain: false,
  quiet: false,
  scatter: false,
  dateLabel: null,
  homeKm: null,
};

describe("conditionSummary — 아무 조건도 없을 때", () => {
  it("빈 배열 — 호출부가 '아무 데나'를 렌더할 신호", () => {
    expect(conditionSummary(BASE)).toEqual([]);
  });

  it("모두 false·빈 배열이면 길이 0 (§2 조건 0개 = 완전 랜덤)", () => {
    expect(conditionSummary({ ...BASE }).length).toBe(0);
  });
});

describe("conditionSummary — 지역·테마 축약", () => {
  it("지역 1개는 이름 그대로", () => {
    expect(conditionSummary({ ...BASE, areas: [6] })).toEqual(["부산"]);
  });

  it("지역 2개는 가운뎃점으로 잇는다", () => {
    expect(conditionSummary({ ...BASE, areas: [6, 32] })).toEqual(["부산·강원"]);
  });

  it("지역 3개 이상은 '첫 이름 외 N곳'", () => {
    expect(conditionSummary({ ...BASE, areas: [6, 32, 39] })).toEqual([
      "부산 외 2곳",
    ]);
  });

  it("테마도 같은 규칙 — 지역 다음에 온다", () => {
    expect(conditionSummary({ ...BASE, areas: [1], types: [12, 14] })).toEqual([
      "서울",
      "관광지·문화시설",
    ]);
  });

  it("모르는 코드는 조용히 버린다(요약이 빈 이름을 뱉지 않게)", () => {
    expect(conditionSummary({ ...BASE, areas: [6, 999] })).toEqual(["부산"]);
  });
});

describe("conditionSummary — 추가 조건", () => {
  it("켜진 것만 순서대로 붙는다", () => {
    expect(
      conditionSummary({ ...BASE, seasonal: true, festival: true, quiet: true }),
    ).toEqual(["제철 산지", "축제 중", "한적"]);
  });

  it("⚖️ 분산 모드도 '기본과 다른 상태'라 요약에 든다", () => {
    expect(conditionSummary({ ...BASE, scatter: true })).toEqual(["분산"]);
  });

  it("📅 미래 기준일 라벨은 조건으로 센다", () => {
    expect(conditionSummary({ ...BASE, dateLabel: "이번 주말(토)" })).toEqual([
      "이번 주말(토)",
    ]);
  });
});

describe("conditionSummary — 잠긴 칸은 말하지 않는다 (표시·전송 일치)", () => {
  it("🐕 반려동물은 전국 전용 — 지역·테마를 요약에서 뺀다", () => {
    expect(
      conditionSummary({ ...BASE, pet: true, areas: [6], types: [12] }),
    ).toEqual(["반려동물"]);
  });

  it("🌊 바다는 테마가 관광지로 고정 — 테마만 뺀다(지역은 남는다)", () => {
    expect(
      conditionSummary({ ...BASE, seaside: true, areas: [6], types: [12] }),
    ).toEqual(["부산", "바다"]);
  });

  it("대상 축은 동시 1개 — 🌊>🐕>♿ 우선순위로 하나만 말한다", () => {
    expect(
      conditionSummary({ ...BASE, seaside: true, pet: true, barrierFree: true }),
    ).toEqual(["바다"]);
    expect(
      conditionSummary({ ...BASE, pet: true, barrierFree: true }),
    ).toEqual(["반려동물"]);
  });

  it("♿ 무장애는 지역·테마와 그대로 조합된다", () => {
    expect(
      conditionSummary({ ...BASE, barrierFree: true, areas: [1] }),
    ).toEqual(["서울", "무장애"]);
  });

  it("📅 미래 기준일이면 ☔ 는 켜져 있어도 뺀다(오늘 날씨만 알 수 있음)", () => {
    expect(
      conditionSummary({ ...BASE, noRain: true, dateLabel: "내일" }),
    ).toEqual(["내일"]);
  });

  it("☔ 는 오늘 기준일일 때만 말한다", () => {
    expect(conditionSummary({ ...BASE, noRain: true })).toEqual(["비 안 오는 곳"]);
  });

  it("🏠 거주지 반경이 켜지면 그 축과 🍃 만 남는다(§7.17D 서버가 나머지를 안 본다)", () => {
    expect(
      conditionSummary({
        ...BASE,
        homeKm: 70,
        quiet: true,
        areas: [6],
        types: [12],
        seasonal: true,
        dateLabel: "내일",
      }),
    ).toEqual(["집에서 70km", "한적"]);
  });

  it("🏠 만 켜져 있으면 한 칸", () => {
    expect(conditionSummary({ ...BASE, homeKm: 200 })).toEqual(["집에서 200km"]);
  });
});
