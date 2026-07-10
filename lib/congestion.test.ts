// 🍃 한적 필터(M17, plan.md §6.7) 순수 로직 단위 테스트 — TDD(구현 전 작성).
// 집계·백분위·시·도 판정·교집합·코드 매핑·KST 날짜 헬퍼. 네트워크·DB 없음(순수 함수만).

import { describe, it, expect } from "vitest";
import {
  aggregateDaily,
  rankDaily,
  quietAreaCodes,
  narrowByQuiet,
  congestionBadge,
  congestionStale,
  visitorProbeDates,
  retentionCutoff,
  CONGESTION_STALE_MS,
  type CongestionSpotRow,
  type SigunguRank,
} from "@/lib/congestion";
import {
  CONGESTION_SIGUNGU_CODES,
  LDONG_TO_APP_AREA,
  CONGESTION_SIGUNGU_TOTAL,
} from "@/lib/congestionCodes";
import { ALL_AREA_CODES } from "@/lib/constants";

// 집중률 응답 행(관광지×날짜) 팩토리 — 최소 필드.
function spot(over: Partial<CongestionSpotRow> = {}): CongestionSpotRow {
  return { sigunguCd: "11110", baseYmd: "20260710", cnctrRate: "50", ...over };
}

describe("aggregateDaily — 시군구×날짜 집계(중앙값·스팟수·과밀비율)", () => {
  it("홀수 개 스팟의 중앙값은 가운데 값", () => {
    const out = aggregateDaily([
      spot({ cnctrRate: "10" }),
      spot({ cnctrRate: "70" }),
      spot({ cnctrRate: "50" }),
    ]);
    expect(out).toEqual([
      { sigunguCd: "11110", baseYmd: "20260710", spotCount: 3, medianRate: 50, crowdedShare: 0 },
    ]);
  });

  it("짝수 개 스팟의 중앙값은 두 가운데 값의 평균", () => {
    const out = aggregateDaily([
      spot({ cnctrRate: "20" }),
      spot({ cnctrRate: "40" }),
      spot({ cnctrRate: "60" }),
      spot({ cnctrRate: "80" }),
    ]);
    expect(out[0].medianRate).toBe(50); // (40+60)/2
    expect(out[0].spotCount).toBe(4);
  });

  it("과밀비율 = rate ≥ 80 스팟 비율", () => {
    const out = aggregateDaily([
      spot({ cnctrRate: "80" }),
      spot({ cnctrRate: "90" }),
      spot({ cnctrRate: "10" }),
      spot({ cnctrRate: "20" }),
    ]);
    expect(out[0].crowdedShare).toBe(0.5); // 2/4
  });

  it("빈 입력이면 빈 배열", () => {
    expect(aggregateDaily([])).toEqual([]);
  });

  it("시군구·날짜별로 그룹핑한다(첫 등장 순서 보존)", () => {
    const out = aggregateDaily([
      spot({ sigunguCd: "11110", cnctrRate: "10" }),
      spot({ sigunguCd: "11140", cnctrRate: "70" }),
      spot({ sigunguCd: "11110", cnctrRate: "30" }),
    ]);
    expect(out.map((a) => a.sigunguCd)).toEqual(["11110", "11140"]);
    expect(out[0].medianRate).toBe(20); // 종로 (10+30)/2
    expect(out[1].medianRate).toBe(70);
  });

  it("빈/공백 rate 는 결측으로 제외(Number('') === 0 오판 방지)", () => {
    const out = aggregateDaily([
      spot({ cnctrRate: "" }),
      spot({ cnctrRate: "  " }),
      spot({ cnctrRate: "40" }),
      spot({ cnctrRate: "60" }),
    ]);
    expect(out[0].spotCount).toBe(2); // 유효 2개만
    expect(out[0].medianRate).toBe(50);
  });

  it("모든 스팟 rate 가 결측이면 그 시군구는 집계에서 빠진다(보수적 제외)", () => {
    const out = aggregateDaily([
      spot({ sigunguCd: "11110", cnctrRate: "" }),
      spot({ sigunguCd: "11140", cnctrRate: "50" }),
    ]);
    expect(out.map((a) => a.sigunguCd)).toEqual(["11140"]);
  });
});

describe("rankDaily — 같은 날짜 전국 시군구 백분위(0=가장 한적)", () => {
  const day: SigunguRank[] = [
    { sigunguCd: "A", medianRate: 10 },
    { sigunguCd: "B", medianRate: 50 },
    { sigunguCd: "C", medianRate: 90 },
  ];

  it("가장 낮은 rate 는 pctRank 0, 가장 높은 rate 는 1", () => {
    const r = rankDaily(day);
    expect(r.get("A")).toBe(0);
    expect(r.get("C")).toBe(1);
    expect(r.get("B")).toBeCloseTo(0.5);
  });

  it("동률은 같은 pctRank(자기보다 엄격히 낮은 수 기준)", () => {
    const r = rankDaily([
      { sigunguCd: "A", medianRate: 10 },
      { sigunguCd: "B", medianRate: 10 },
      { sigunguCd: "C", medianRate: 90 },
    ]);
    expect(r.get("A")).toBe(0);
    expect(r.get("B")).toBe(0); // 동률 최소 → 둘 다 0
    expect(r.get("C")).toBe(1);
  });

  it("시군구 하나면 pctRank 0", () => {
    const r = rankDaily([{ sigunguCd: "A", medianRate: 42 }]);
    expect(r.get("A")).toBe(0);
  });

  it("빈 입력이면 빈 맵", () => {
    expect(rankDaily([]).size).toBe(0);
  });
});

describe("quietAreaCodes — 시·도 판정(소속 시군구 pctRank 중앙값 ≤ 컷)", () => {
  it("소속 시군구 pctRank 중앙값이 컷 이하인 시·도만 한적", () => {
    // 서울(area 1) 법정동 3개: 0.1/0.2/0.3 → median 0.2 ≤ 0.4 → 한적
    // 부산(area 6) 법정동 2개: 0.8/0.9 → median 0.85 > 0.4 → 아님
    const ranked = new Map<string, number>([
      ["11110", 0.1], // 서울 종로
      ["11140", 0.2], // 서울 중구
      ["11170", 0.3], // 서울 용산
      ["26110", 0.8], // 부산 중구
      ["26140", 0.9], // 부산 서구
    ]);
    const quiet = quietAreaCodes(ranked);
    expect(quiet.has(1)).toBe(true);
    expect(quiet.has(6)).toBe(false);
  });

  it("컷 경계(정확히 0.4)는 포함(≤)", () => {
    const ranked = new Map<string, number>([
      ["11110", 0.4],
      ["11140", 0.4],
    ]);
    expect(quietAreaCodes(ranked).has(1)).toBe(true);
    expect(quietAreaCodes(ranked, 0.39).has(1)).toBe(false);
  });

  it("매핑 없는 법정동 코드는 판정에서 제외(결측)", () => {
    const ranked = new Map<string, number>([
      ["11110", 0.1], // 서울 종로 → 유효
      ["99999", 0.1], // 매핑 없음 → 무시
    ]);
    const quiet = quietAreaCodes(ranked);
    expect(quiet.has(1)).toBe(true);
    expect([...quiet]).toEqual([1]);
  });

  it("군위(법정동 27720)는 대구(4)가 아니라 경북(35)으로 집계된다(특례 역인덱스)", () => {
    const ranked = new Map<string, number>([["27720", 0.1]]);
    const quiet = quietAreaCodes(ranked);
    expect(quiet.has(35)).toBe(true);
    expect(quiet.has(4)).toBe(false);
  });
});

describe("narrowByQuiet — base ∩ 한적 시·도(narrowByWeather 동형)", () => {
  it("base 교집합 + base 순서 보존", () => {
    expect(narrowByQuiet([32, 1, 6], new Set([1, 6]))).toEqual([1, 6]);
  });

  it("base 가 null 이면 전국(ALL_AREA_CODES) 기준", () => {
    const out = narrowByQuiet(null, new Set([1, 6]));
    expect(out).toEqual(ALL_AREA_CODES.filter((c) => c === 1 || c === 6));
  });

  it("base 가 빈 배열이어도 전국 기준(빈 배열=전국)", () => {
    expect(narrowByQuiet([], new Set([1])).length).toBeGreaterThan(0);
  });

  it("교집합이 비면 빈 배열(전멸 신호)", () => {
    expect(narrowByQuiet([1, 6], new Set([32]))).toEqual([]);
  });

  it("Iterable(배열)도 받는다", () => {
    expect(narrowByQuiet([1, 6, 32], [6, 32])).toEqual([6, 32]);
  });
});

describe("congestionBadge — 뽑힌 시군구 배지(pctRank ≤ 0.5일 때만)", () => {
  const ranks = new Map<string, number>([["11110", 0.12]]);

  it("pctRank ≤ 0.5 면 배지(하위 % 반올림 + 기준일). targetYmd 기본=baseYmd", () => {
    expect(congestionBadge(1, "종로구", ranks, "20260710")).toEqual({
      sigunguName: "종로구",
      pctBelow: 12,
      baseYmd: "20260710",
      targetYmd: "20260710",
    });
  });

  it("targetYmd(예측 대상일) 주입 — 배치 지연이면 baseYmd < targetYmd 로 실림", () => {
    expect(congestionBadge(1, "종로구", ranks, "20260710", "20260712")).toEqual({
      sigunguName: "종로구",
      pctBelow: 12,
      baseYmd: "20260710", // 데이터 기준일
      targetYmd: "20260712", // 예측 대상일(선택일)
    });
  });

  it("pctRank > 0.5 면 배지 없음(자기모순 방지)", () => {
    const busy = new Map<string, number>([["11110", 0.68]]);
    expect(congestionBadge(1, "종로구", busy, "20260710")).toBeNull();
  });

  it("부천은 법정동 3코드 pctRank 의 중앙값으로 판정", () => {
    const bc = new Map<string, number>([
      ["41192", 0.1],
      ["41194", 0.2],
      ["41196", 0.3],
    ]);
    expect(congestionBadge(31, "부천시", bc, "20260710")?.pctBelow).toBe(20); // median 0.2
  });

  it("매핑 없는 (area+이름) 또는 랭크 결측이면 배지 없음", () => {
    expect(congestionBadge(1, "없는구", ranks, "20260710")).toBeNull();
    expect(congestionBadge(1, "종로구", new Map(), "20260710")).toBeNull();
    expect(congestionBadge(null, null, ranks, "20260710")).toBeNull();
  });
});

describe("congestionStale — fetched_at 신선도(48h 초과 = stale)", () => {
  const NOW = Date.UTC(2026, 6, 10, 0, 0, 0); // 2026-07-10 00:00 UTC
  it("48h 이내면 신선", () => {
    expect(congestionStale(NOW - (CONGESTION_STALE_MS - 1000), NOW)).toBe(false);
  });
  it("48h 초과면 stale", () => {
    expect(congestionStale(NOW - (CONGESTION_STALE_MS + 1000), NOW)).toBe(true);
  });
});

describe("congestion 날짜 헬퍼 — 프로브·보존 컷(KST 산술은 kst.test.ts)", () => {
  it("visitorProbeDates: 오늘-28일부터 과거로 13일치(YYYYMMDD)", () => {
    const dates = visitorProbeDates(new Date("2026-07-10T03:00:00Z")); // KST 7/10 정오
    expect(dates.length).toBe(13);
    expect(dates[0]).toBe("20260612"); // 7/10 - 28
    expect(dates[12]).toBe("20260531"); // 7/10 - 40 (월 경계 넘김)
  });

  it("retentionCutoff: congestion 오늘-7, visitor 오늘-180", () => {
    const cut = retentionCutoff(new Date("2026-07-10T03:00:00Z"));
    expect(cut.congestion).toBe("20260703"); // 7/10 - 7
    expect(cut.visitor).toBe("20260111"); // 7/10 - 180
  });
});

describe("코드 매핑(congestionCodes) — 250 전수·특례 4건·11110 충돌 회귀", () => {
  it("앱 시군구 250개 전수 매핑", () => {
    expect(Object.keys(CONGESTION_SIGUNGU_CODES).length).toBe(250);
    expect(CONGESTION_SIGUNGU_TOTAL).toBe(250);
  });

  it("특례 4건 — 남구→미추홀·세종→36110·부천 3코드·군위→27720", () => {
    expect(CONGESTION_SIGUNGU_CODES["2:남구"]).toEqual(["28177"]);
    expect(CONGESTION_SIGUNGU_CODES["8:세종시"]).toEqual(["36110"]);
    expect(CONGESTION_SIGUNGU_CODES["31:부천시"]).toEqual(["41192", "41194", "41196"]);
    expect(CONGESTION_SIGUNGU_CODES["35:군위군"]).toEqual(["27720"]);
  });

  it("11110 충돌 가드 — 법정동 11110=종로구, 통계청 11110=노원구는 서로 다른 법정동", () => {
    expect(CONGESTION_SIGUNGU_CODES["1:종로구"]).toEqual(["11110"]);
    expect(CONGESTION_SIGUNGU_CODES["1:노원구"]).not.toEqual(["11110"]);
    expect(CONGESTION_SIGUNGU_CODES["1:노원구"]).toEqual(["11350"]);
  });

  it("역인덱스 LDONG_TO_APP_AREA — 부천 3코드 모두 경기(31), 군위 27720 경북(35)", () => {
    expect(LDONG_TO_APP_AREA["41192"]).toBe(31);
    expect(LDONG_TO_APP_AREA["41194"]).toBe(31);
    expect(LDONG_TO_APP_AREA["41196"]).toBe(31);
    expect(LDONG_TO_APP_AREA["27720"]).toBe(35);
    expect(LDONG_TO_APP_AREA["11110"]).toBe(1);
  });
});
