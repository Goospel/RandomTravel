import { describe, it, expect } from "vitest";
import {
  VISITOR_OUTSIDER,
  areaWeights,
  weightedPickOrder,
  orderByWeightedArea,
  type VisitorRecentRow,
} from "@/lib/scatter";
import { LDONG_TO_APP_AREA } from "@/lib/congestionCodes";
import { ALL_AREA_CODES } from "@/lib/constants";

/** 결정적 rand — LCG(시드 고정). 순수부 검증은 실난수를 쓰지 않는다. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const row = (sigunguCd: string, touNum: number): VisitorRecentRow => ({
  sigunguCd,
  touNum,
});

describe("VISITOR_OUTSIDER — 관광객 구분 코드", () => {
  it("외지인 = '2' (실측: 1현지인/2외지인/3외국인 — 스키마 주석 a/b/c 는 오기)", () => {
    expect(VISITOR_OUTSIDER).toBe("2");
  });
});

describe("areaWeights — 외지인 방문자수 √역가중 (§6.9B)", () => {
  it("방문자가 많을수록 가중치가 낮다(역가중 단조성)", () => {
    const w = areaWeights(
      [row("11110", 1000), row("28110", 100)], // 서울(1) 1000 · 인천(2) 100
      LDONG_TO_APP_AREA,
    );
    expect(w.get(2)!).toBeGreaterThan(w.get(1)!);
  });

  it("weight = 1/√합 — 91배 격차를 ~9.5배로 완충", () => {
    // 실측 극단: 경기 7.57M vs 세종 83k (약 91배)
    const w = areaWeights(
      [row("41111", 7_570_000), row("36110", 83_000)],
      LDONG_TO_APP_AREA,
    );
    const ratio = w.get(8)! / w.get(31)!;
    expect(ratio).toBeGreaterThan(9);
    expect(ratio).toBeLessThan(10);
    // 원시 역비례였다면 91배 — √ 완충이 실제로 걸렸는지 확인
    expect(ratio).toBeLessThan(91 / 5);
  });

  it("같은 시·도의 시군구 여러 행은 합산한 뒤 √", () => {
    const w = areaWeights([row("11110", 500), row("11140", 500)], LDONG_TO_APP_AREA);
    expect(w.get(1)!).toBeCloseTo(1 / Math.sqrt(1000), 12);
  });

  it("군위 27720 은 경북(35) — 앞 2자리(27=대구)로 자르면 깨지는 특례", () => {
    // 서울을 함께 넣어 중앙값(결측 계층)이 경북 값과 겹치지 않게 한다.
    const w = areaWeights([row("27720", 400), row("11110", 10000)], LDONG_TO_APP_AREA);
    expect(w.get(35)!).toBeCloseTo(1 / Math.sqrt(400), 12); // 경북에 잡힘
    // 대구(4)는 관측이 없어 결측 계층(중앙값) — 27720 이 대구로 샜다면 0.05 가 된다
    expect(w.get(4)!).toBeCloseTo((0.05 + 0.01) / 2, 12);
    expect(w.get(4)!).not.toBeCloseTo(1 / Math.sqrt(400), 12);
  });

  it("부천 3코드(41192·41194·41196)는 모두 경기(31)로 합산", () => {
    const w = areaWeights(
      [row("41192", 100), row("41194", 100), row("41196", 100)],
      LDONG_TO_APP_AREA,
    );
    expect(w.get(31)!).toBeCloseTo(1 / Math.sqrt(300), 12);
  });

  it("결측 시·도는 분포 중앙값 가중 — 과대(=최소 방문자 취급)도 탈락도 아니다", () => {
    // 서울 10000(가중 0.01) · 인천 100(가중 0.1) → 중앙값 0.055
    const w = areaWeights([row("11110", 10000), row("28110", 100)], LDONG_TO_APP_AREA);
    const median = (0.01 + 0.1) / 2;
    expect(w.get(39)!).toBeCloseTo(median, 12); // 제주 결측
    // 결측이 최저 방문자보다 더 자주 뽑히면(=가중 최대) 단조성이 깨진다
    expect(w.get(39)!).toBeLessThan(w.get(2)!);
    expect(w.get(39)!).toBeGreaterThan(w.get(1)!);
  });

  it("17개 시·도 전부에 가중치가 있다(어떤 시·도도 탈락하지 않는다)", () => {
    const w = areaWeights([row("11110", 100)], LDONG_TO_APP_AREA);
    for (const code of ALL_AREA_CODES) {
      expect(w.get(code), `area ${code}`).toBeGreaterThan(0);
    }
  });

  it("전결측(빈 입력)이면 전 시·도 균등 — 조용한 쏠림 대신 균등 폴백", () => {
    const w = areaWeights([], LDONG_TO_APP_AREA);
    const vals = ALL_AREA_CODES.map((c) => w.get(c)!);
    expect(new Set(vals).size).toBe(1);
    expect(vals[0]).toBeGreaterThan(0);
  });

  it("0 이하·비유한 값·판별 불가 코드는 버린다(합에 안 섞임)", () => {
    const w = areaWeights(
      [
        row("11110", 100),
        row("99999", 999999), // 시도 코드 99 = 판별 불가
        row("28110", 0), // 0
        row("30110", -5), // 음수
        row("27110", Number.NaN),
      ],
      LDONG_TO_APP_AREA,
    );
    expect(w.get(1)!).toBeCloseTo(1 / Math.sqrt(100), 12);
    // 버려진 것들은 결측 계층(중앙값=유일값 0.1)으로
    expect(w.get(2)!).toBeCloseTo(0.1, 12);
  });

  it("정밀 매핑에 없는 통합시 코드는 시도 2자리로 폴백 — 실측 미매핑 16건 구제", () => {
    // 방문자 데이터는 통합시를 상위 코드로 준다(41110 수원시). 정밀 매핑은 구 단위
    // (41111 장안구…)라 그대로면 탈락 — 실측 2026-07-27 미매핑 16건 = 방문자 13%(3.77M).
    const w = areaWeights(
      [row("41110", 400), row("43110", 100)], // 수원시 · 청주시
      LDONG_TO_APP_AREA,
    );
    expect(w.get(31)!).toBeCloseTo(1 / Math.sqrt(400), 12); // 경기
    expect(w.get(33)!).toBeCloseTo(1 / Math.sqrt(100), 12); // 충북
  });

  it("폴백도 개편 신코드를 안다 — 52110 전주시 → 전북(37)", () => {
    const w = areaWeights([row("52110", 900)], LDONG_TO_APP_AREA);
    expect(w.get(37)!).toBeCloseTo(1 / Math.sqrt(900), 12);
  });

  it("폴백보다 정밀 매핑이 먼저 — 군위 27720 이 대구로 새지 않는다", () => {
    // 27720 은 정밀 매핑에 있어 폴백(27=대구)에 닿지 않아야 한다. 순서가 뒤집히면 여기서 깨진다.
    const w = areaWeights([row("27720", 400), row("11110", 10000)], LDONG_TO_APP_AREA);
    expect(w.get(35)!).toBeCloseTo(1 / Math.sqrt(400), 12);
    expect(w.get(4)!).not.toBeCloseTo(1 / Math.sqrt(400), 12);
  });

  it("폴백은 전남광주 병합 12 도 시군구 3자리로 가른다", () => {
    const w = areaWeights([row("12850", 100)], LDONG_TO_APP_AREA); // 완도군
    expect(w.get(38)!).toBeCloseTo(1 / Math.sqrt(100), 12); // 전남
  });
});

describe("weightedPickOrder — 가중 선택·소진 순서 (§6.9B)", () => {
  const weights = new Map([
    [1, 1],
    [2, 1],
    [3, 1],
  ]);

  it("전 지역을 정확히 한 번씩 담은 순열을 만든다(소진 보장)", () => {
    const order = weightedPickOrder([1, 2, 3], weights, lcg(1));
    expect([...order].sort()).toEqual([1, 2, 3]);
  });

  it("같은 시드면 같은 순서(결정적)", () => {
    expect(weightedPickOrder([1, 2, 3], weights, lcg(42))).toEqual(
      weightedPickOrder([1, 2, 3], weights, lcg(42)),
    );
  });

  it("가중치가 큰 지역이 앞에 더 자주 온다", () => {
    const skewed = new Map([
      [1, 1],
      [2, 99],
    ]);
    const rand = lcg(7);
    let firstIs2 = 0;
    for (let i = 0; i < 200; i++) {
      if (weightedPickOrder([1, 2], skewed, rand)[0] === 2) firstIs2++;
    }
    expect(firstIs2).toBeGreaterThan(180); // 기대 99%
  });

  it("가중치가 전부 0·결측이어도 무한루프 없이 전 지역을 반환", () => {
    // ⚠️ weightedIndex 는 합≤0 에서 인덱스 0 을 주므로, 재가중 방식이면 0번 쏠림·소진 실패.
    const zero = new Map([
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    const order = weightedPickOrder([1, 2, 3], zero, lcg(5));
    expect([...order].sort()).toEqual([1, 2, 3]);
    const none = weightedPickOrder([1, 2, 3], new Map(), lcg(5));
    expect([...none].sort()).toEqual([1, 2, 3]);
  });

  it("빈 풀은 빈 순서", () => {
    expect(weightedPickOrder([], weights, lcg(1))).toEqual([]);
  });

  it("부분 풀(선택·🍃 좁힘)이면 그 지역만 — 남은 가중치로 재정규화", () => {
    const order = weightedPickOrder([2, 3], weights, lcg(3));
    expect([...order].sort()).toEqual([2, 3]);
  });
});

describe("orderByWeightedArea — 조합을 (가중 지역)×(셔플 타입) 순으로", () => {
  const combos = [
    { contentTypeId: 12, slotAreaCode: 1 },
    { contentTypeId: 14, slotAreaCode: 1 },
    { contentTypeId: 12, slotAreaCode: 2 },
    { contentTypeId: 14, slotAreaCode: 2 },
  ];

  it("같은 시·도 조합이 붙어 나온다(지역 단위 소진)", () => {
    const out = orderByWeightedArea(
      combos,
      new Map([
        [1, 1],
        [2, 1],
      ]),
      lcg(11),
    );
    expect(out).toHaveLength(4);
    expect(out[0].slotAreaCode).toBe(out[1].slotAreaCode);
    expect(out[2].slotAreaCode).toBe(out[3].slotAreaCode);
    expect(out[0].slotAreaCode).not.toBe(out[2].slotAreaCode);
  });

  it("조합을 하나도 잃지 않는다", () => {
    const out = orderByWeightedArea(combos, new Map(), lcg(2));
    expect([...out].sort((a, b) => a.slotAreaCode - b.slotAreaCode || a.contentTypeId - b.contentTypeId)).toEqual(
      [...combos].sort((a, b) => a.slotAreaCode - b.slotAreaCode || a.contentTypeId - b.contentTypeId),
    );
  });

  it("가중치가 큰 시·도가 먼저 시도된다", () => {
    const out = orderByWeightedArea(
      combos,
      new Map([
        [1, 1],
        [2, 999],
      ]),
      lcg(4),
    );
    expect(out[0].slotAreaCode).toBe(2);
  });
});

describe("⚖️ 분포 스냅샷 — 가중 확률(설계치) 1,000회", () => {
  it("방문자 적은 시·도가 실제로 더 자주 1순위가 된다", () => {
    // 실측 규모를 본뜬 3개 시·도: 경기 7.57M · 제주 1.2M · 세종 83k
    const w = areaWeights(
      [row("41111", 7_570_000), row("50110", 1_200_000), row("36110", 83_000)],
      LDONG_TO_APP_AREA,
    );
    const pool = [31, 39, 8];
    const rand = lcg(20260727);
    const first = new Map<number, number>();
    for (let i = 0; i < 1000; i++) {
      const a = weightedPickOrder(pool, w, rand)[0];
      first.set(a, (first.get(a) ?? 0) + 1);
    }
    const gyeonggi = first.get(31) ?? 0;
    const jeju = first.get(39) ?? 0;
    const sejong = first.get(8) ?? 0;
    // 설계치: 가중 합 대비 세종 ~66% · 제주 ~18% · 경기 ~7% (1/√N 정규화)
    expect(sejong).toBeGreaterThan(jeju);
    expect(jeju).toBeGreaterThan(gyeonggi);
    expect(gyeonggi + jeju + sejong).toBe(1000);
    // 균등(각 333)에서 확실히 벗어났는지 — 안 그러면 가중이 안 걸린 것
    expect(sejong).toBeGreaterThan(500);
  });
});
