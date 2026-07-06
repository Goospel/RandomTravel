import { describe, it, expect } from "vitest";
import {
  planCandidateCount,
  COUNT_COMBO_BUDGET,
  type CountParams,
} from "@/lib/candidateCount";
import { RANDOM_DEFAULT_TYPES } from "@/lib/constants";

// 🔢 실시간 후보 수(M16) — 조건 → 조회할 (지역×타입/cat3) 조합 계획(순수).
//   실제 합산(getTotalCount)은 tourapi.countCandidates 가 이 계획으로 수행한다.
//   동적 조건(🎪 축제·☔ 비안옴)은 정확 집계 불가라 dynamic 으로 표시.

function params(over: Partial<CountParams> = {}): CountParams {
  return {
    areaCodes: [],
    contentTypeIds: [],
    seaside: false,
    seasonal: false,
    festivalOnly: false,
    noRain: false,
    ...over,
  };
}

describe("planCandidateCount", () => {
  it("축제·비안옴은 dynamic(정확 집계 불가)", () => {
    expect(planCandidateCount(params({ festivalOnly: true }), 7).kind).toBe(
      "dynamic",
    );
    expect(planCandidateCount(params({ noRain: true }), 7).kind).toBe("dynamic");
    // 다른 조건과 겹쳐도 dynamic 우선
    expect(
      planCandidateCount(params({ noRain: true, areaCodes: [1] }), 7).kind,
    ).toBe("dynamic");
  });

  it("조건 0개면 기본 타입 전국 조합(지역 없음)", () => {
    const plan = planCandidateCount(params(), 7);
    expect(plan.kind).toBe("combos");
    if (plan.kind !== "combos") return;
    expect(plan.combos).toHaveLength(RANDOM_DEFAULT_TYPES.length);
    // 지역 미지정 → areaCode 없음
    expect(plan.combos.every((c) => c.areaCode === undefined)).toBe(true);
    expect(plan.capped).toBe(false);
  });

  it("지역×타입 조합을 곱집합으로 만든다", () => {
    const plan = planCandidateCount(
      params({ areaCodes: [32], contentTypeIds: [12, 14] }),
      7,
    );
    expect(plan.kind).toBe("combos");
    if (plan.kind !== "combos") return;
    expect(plan.combos).toEqual([
      { contentTypeId: 12, areaCode: 32 },
      { contentTypeId: 14, areaCode: 32 },
    ]);
  });

  it("🌊 바다면 관광지(12)×cat3 4종 조합(타입 무시)", () => {
    const plan = planCandidateCount(
      params({ seaside: true, areaCodes: [6], contentTypeIds: [39] }),
      7,
    );
    expect(plan.kind).toBe("combos");
    if (plan.kind !== "combos") return;
    expect(plan.combos).toHaveLength(4); // SEA_CAT3 4종
    expect(plan.combos.every((c) => c.contentTypeId === 12)).toBe(true);
    expect(plan.combos.every((c) => c.areaCode === 6)).toBe(true);
    expect(plan.combos.every((c) => typeof c.cat3 === "string")).toBe(true);
  });

  it("🦀 제철은 지역 풀을 제철 산지로 좁힌다(7월)", () => {
    // 7월 제철 산지에 서울(1)은 없음 → 서울만 고르면 후보 0(empty)
    expect(planCandidateCount(params({ seasonal: true, areaCodes: [1] }), 7).kind).toBe(
      "empty",
    );
    // 지역 미지정이면 제철 산지 전체로 조합 — 모든 조합의 areaCode 가 제철 집합 안
    const plan = planCandidateCount(params({ seasonal: true }), 7);
    expect(plan.kind).toBe("combos");
    if (plan.kind !== "combos") return;
    const julyAreas = new Set([32, 33, 34, 35, 36, 38]);
    expect(plan.combos.every((c) => julyAreas.has(c.areaCode!))).toBe(true);
  });

  it("조합이 예산을 넘으면 상한까지 자르고 capped 표시", () => {
    // 전 지역(17)×전 타입(8)=136 > 34
    const plan = planCandidateCount(
      params({
        areaCodes: [1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 34, 35, 36, 37, 38, 39],
        contentTypeIds: [12, 14, 15, 25, 28, 32, 38, 39],
      }),
      7,
    );
    expect(plan.kind).toBe("combos");
    if (plan.kind !== "combos") return;
    expect(plan.combos).toHaveLength(COUNT_COMBO_BUDGET);
    expect(plan.capped).toBe(true);
  });
});
