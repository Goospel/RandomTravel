import { describe, it, expect } from "vitest";
import {
  MAX_EVENT_BATCH,
  aggregateDrawEvents,
  designProbabilities,
  funnelCounts,
  parseTravelEvent,
  visitorShares,
} from "@/lib/impact";
import { ALL_AREA_CODES } from "@/lib/constants";

const sum = (nums: number[]) => nums.reduce((s, v) => s + v, 0);

describe("visitorShares — 외지인 방문자 시·도 점유율 (§7.15 ①)", () => {
  it("합이 1이다", () => {
    const shares = visitorShares(new Map([[1, 300], [2, 100], [39, 100]]));
    expect(sum(shares.map((s) => s.share))).toBeCloseTo(1, 12);
  });

  it("점유율이 큰 순으로 정렬된다", () => {
    const shares = visitorShares(new Map([[2, 100], [1, 300], [39, 200]]));
    expect(shares.map((s) => s.areaCode)).toEqual([1, 39, 2]);
    expect(shares[0].share).toBeCloseTo(0.5, 12);
  });

  it("0·음수·비유한 값은 제외한다(합=1 불변식 보호)", () => {
    const shares = visitorShares(
      new Map([[1, 300], [2, 0], [3, -50], [4, Number.NaN], [5, 100]]),
    );
    expect(shares.map((s) => s.areaCode)).toEqual([1, 5]);
    expect(sum(shares.map((s) => s.share))).toBeCloseTo(1, 12);
  });

  it("데이터가 하나도 없으면 빈 배열(0 나눗셈으로 NaN 을 흘리지 않는다)", () => {
    expect(visitorShares(new Map())).toEqual([]);
    expect(visitorShares(new Map([[1, 0]]))).toEqual([]);
  });
});

describe("designProbabilities — 설계 확률 (§7.15 ②)", () => {
  it("균등은 1/n 이고 합이 1이다", () => {
    const rows = designProbabilities(ALL_AREA_CODES);
    expect(rows).toHaveLength(17);
    expect(rows[0].uniform).toBeCloseTo(1 / 17, 12);
    expect(sum(rows.map((r) => r.uniform))).toBeCloseTo(1, 12);
  });

  it("가중치가 없으면 weighted 는 null(설계 확률만 렌더)", () => {
    const rows = designProbabilities(ALL_AREA_CODES, null);
    expect(rows.every((r) => r.weighted === null)).toBe(true);
  });

  it("가중 확률은 w/Σw 정규화 — 합이 1", () => {
    const rows = designProbabilities([1, 2, 3], new Map([[1, 1], [2, 2], [3, 1]]));
    expect(rows.map((r) => r.weighted)).toEqual([0.25, 0.5, 0.25]);
    expect(sum(rows.map((r) => r.weighted ?? 0))).toBeCloseTo(1, 12);
  });

  it("가중치가 큰 시·도가 확률도 크다(단조성)", () => {
    const rows = designProbabilities([1, 39], new Map([[1, 0.001], [39, 0.01]]));
    const byArea = new Map(rows.map((r) => [r.areaCode, r.weighted ?? 0]));
    expect(byArea.get(39)!).toBeGreaterThan(byArea.get(1)!);
  });

  it("가중치 합이 0이면 weighted 는 null(균등만 표시)", () => {
    const rows = designProbabilities([1, 2], new Map([[1, 0], [2, 0]]));
    expect(rows.every((r) => r.weighted === null)).toBe(true);
  });

  it("결측·비유한 가중치는 0 으로 취급하되 나머지 합은 1을 유지한다", () => {
    const rows = designProbabilities([1, 2, 3], new Map([[1, 1], [2, Number.NaN]]));
    expect(rows.find((r) => r.areaCode === 2)!.weighted).toBe(0);
    expect(rows.find((r) => r.areaCode === 3)!.weighted).toBe(0);
    expect(sum(rows.map((r) => r.weighted ?? 0))).toBeCloseTo(1, 12);
  });

  it("입력 시·도 순서를 그대로 유지한다(렌더가 같은 축을 쓸 수 있게)", () => {
    expect(designProbabilities([39, 1, 6]).map((r) => r.areaCode)).toEqual([39, 1, 6]);
  });

  it("시·도가 없으면 빈 배열", () => {
    expect(designProbabilities([])).toEqual([]);
  });
});

describe("aggregateDrawEvents — 실측 뽑기 분포 (§7.15 ③)", () => {
  const rows = [
    { event: "draw", areaCode: 1, count: 3 },
    { event: "redraw", areaCode: 1, count: 1 },
    { event: "draw", areaCode: 39, count: 4 },
    { event: "like", areaCode: 1, count: 9 }, // 제안이 아니다 — 분포에서 제외
  ];

  it("제안 = draw + redraw 합산(재뽑기를 빼면 거절된 제안이 사라진다)", () => {
    const agg = aggregateDrawEvents(rows);
    expect(agg.total).toBe(8);
    expect(agg.shares.find((s) => s.areaCode === 1)!.share).toBeCloseTo(0.5, 12);
  });

  it("점유율 합이 1이고 큰 순으로 정렬된다", () => {
    const agg = aggregateDrawEvents(rows);
    expect(agg.shares.map((s) => s.areaCode)).toEqual([1, 39]);
    expect(sum(agg.shares.map((s) => s.share))).toBeCloseTo(1, 12);
  });

  it("areaCode 가 null 인 행은 분포에서 제외한다(귀속 불가)", () => {
    const agg = aggregateDrawEvents([
      { event: "draw", areaCode: null, count: 5 },
      { event: "draw", areaCode: 1, count: 2 },
    ]);
    expect(agg.total).toBe(2);
    expect(agg.shares).toEqual([{ areaCode: 1, share: 1 }]);
  });

  it("표본이 없으면 total 0 · 빈 분포", () => {
    expect(aggregateDrawEvents([])).toEqual({ total: 0, shares: [] });
    expect(aggregateDrawEvents([{ event: "like", areaCode: 1, count: 3 }])).toEqual({
      total: 0,
      shares: [],
    });
  });
});

describe("funnelCounts — 제안 → 수락 퍼널 (§7.15 ③)", () => {
  it("draw+redraw 를 제안으로 합치고 나머지는 이벤트별로 센다", () => {
    expect(
      funnelCounts([
        { event: "draw", count: 10 },
        { event: "redraw", count: 5 },
        { event: "like", count: 4 },
        { event: "navigate", count: 3 },
        { event: "visited", count: 2 },
      ]),
    ).toEqual({ proposed: 15, liked: 4, navigated: 3, visited: 2 });
  });

  it("모르는 이벤트는 무시하고, 없는 이벤트는 0", () => {
    expect(funnelCounts([{ event: "share", count: 99 }])).toEqual({
      proposed: 0,
      liked: 0,
      navigated: 0,
      visited: 0,
    });
  });
});

describe("parseTravelEvent — POST /api/events 화이트리스트 검증 (§12.5)", () => {
  const valid = {
    event: "draw",
    mode: "pure",
    areaCode: 39,
    contentTypeId: 12,
    contentId: "126508",
    sessionId: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
    ts: 1753600000000,
  };

  it("정상 이벤트를 스키마 그대로 통과시킨다", () => {
    expect(parseTravelEvent(valid)).toEqual(valid);
  });

  it("선택 필드는 누락 시 null 로 정규화된다", () => {
    expect(parseTravelEvent({ event: "like", sessionId: "s1", ts: 1 })).toEqual({
      event: "like",
      mode: null,
      areaCode: null,
      contentTypeId: null,
      contentId: null,
      sessionId: "s1",
      ts: 1,
    });
  });

  it("미지 필드는 무시한다(스키마 확장에 깨지지 않게)", () => {
    const parsed = parseTravelEvent({ ...valid, userId: "u1", extra: { a: 1 } });
    expect(parsed).toEqual(valid);
  });

  it("event 화이트리스트 밖이면 거부", () => {
    expect(parseTravelEvent({ ...valid, event: "share" })).toBeNull();
    expect(parseTravelEvent({ ...valid, event: 3 })).toBeNull();
  });

  it("mode 는 pure|filtered|null 만 허용", () => {
    expect(parseTravelEvent({ ...valid, mode: "sneaky" })).toBeNull();
    expect(parseTravelEvent({ ...valid, mode: null })!.mode).toBeNull();
  });

  it("areaCode 는 17개 시·도 코드만 허용(오염 유입 차단)", () => {
    expect(parseTravelEvent({ ...valid, areaCode: 999 })).toBeNull();
    expect(parseTravelEvent({ ...valid, areaCode: "39" })).toBeNull();
  });

  it("sessionId 는 필수 문자열이고 길이 상한이 있다", () => {
    expect(parseTravelEvent({ ...valid, sessionId: "" })).toBeNull();
    expect(parseTravelEvent({ ...valid, sessionId: 1 })).toBeNull();
    expect(parseTravelEvent({ ...valid, sessionId: "x".repeat(200) })).toBeNull();
  });

  it("contentId 는 문자열 상한, contentTypeId 는 정수", () => {
    expect(parseTravelEvent({ ...valid, contentId: "x".repeat(200) })).toBeNull();
    expect(parseTravelEvent({ ...valid, contentTypeId: 1.5 })).toBeNull();
  });

  it("ts 는 유한 정수여야 한다", () => {
    expect(parseTravelEvent({ ...valid, ts: "1753600000000" })).toBeNull();
    expect(parseTravelEvent({ ...valid, ts: Number.NaN })).toBeNull();
  });

  it("객체가 아니면 거부", () => {
    expect(parseTravelEvent(null)).toBeNull();
    expect(parseTravelEvent("draw")).toBeNull();
    expect(parseTravelEvent([valid])).toBeNull();
  });

  it("소배치 상한이 정의돼 있다(페이로드 상한)", () => {
    expect(MAX_EVENT_BATCH).toBeGreaterThan(0);
    expect(MAX_EVENT_BATCH).toBeLessThanOrEqual(50);
  });
});
