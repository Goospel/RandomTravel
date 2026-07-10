import { describe, it, expect } from "vitest";
import { emptySpotSigunguSet, eligibleCells } from "@/lib/emptySpot";
import { KOREA_SIGUNGU } from "@/lib/koreaMap";
import type { TourSigunguCell } from "@/lib/tourSigungu";

// 종로구: 앱 통계청 code "11010", area 1, 이름 "종로구", 법정동 코드 ["11110"](CONGESTION_SIGUNGU_CODES).
//   법정동 11110 은 종로구 전용(11110 충돌 가드) → ranks 에 11110 만 넣으면 종로구만 한적으로 고립된다.
const JONGNO_APP = "11010";
const JONGNO_LDONG = "11110";
const ALL_CODES = new Set(KOREA_SIGUNGU.map((sg) => sg.code));

describe("emptySpotSigunguSet — 미방문 ∩ 한적(§7.11)", () => {
  it("ranks=null(성능저하) → 미방문 전체(한적 판정 생략)", () => {
    const set = emptySpotSigunguSet(new Set(), null);
    expect(set.size).toBe(250);
    expect(set).toEqual(ALL_CODES);
  });

  it("ranks=null + exclude 방문분 → 방문 뺀 전체", () => {
    const set = emptySpotSigunguSet(new Set([JONGNO_APP]), null);
    expect(set.size).toBe(249);
    expect(set.has(JONGNO_APP)).toBe(false);
  });

  it("ranks 있음 → 한적(pctRank ≤ 0.5) 미방문만. 랭크 결측 시군구는 제외(보수)", () => {
    const ranks = new Map<string, number>([[JONGNO_LDONG, 0.1]]);
    const set = emptySpotSigunguSet(new Set(), ranks);
    // 종로구만 랭크 존재·한적 → 그 하나만. 나머지는 sigunguPctRank null(보수적 제외).
    expect(set).toEqual(new Set([JONGNO_APP]));
  });

  it("컷 경계 0.5 포함 / 0.5 초과 제외", () => {
    expect(emptySpotSigunguSet(new Set(), new Map([[JONGNO_LDONG, 0.5]]))).toEqual(
      new Set([JONGNO_APP]),
    );
    expect(emptySpotSigunguSet(new Set(), new Map([[JONGNO_LDONG, 0.5001]])).size).toBe(0);
  });

  it("한적이어도 방문(exclude)이면 제외 — 미방문 조건이 앞선다", () => {
    const ranks = new Map<string, number>([[JONGNO_LDONG, 0.1]]);
    expect(emptySpotSigunguSet(new Set([JONGNO_APP]), ranks).size).toBe(0);
  });

  it("전멸 — 한적 시군구 하나도 없으면 빈 집합", () => {
    // 아무 랭크도 없음 → 모든 시군구 sigunguPctRank null → 빈.
    expect(emptySpotSigunguSet(new Set(), new Map()).size).toBe(0);
  });

  it("원소는 통계청 code 문자열(숫자 아님 — 타입 축 일치)", () => {
    const set = emptySpotSigunguSet(new Set(), null);
    for (const c of set) {
      expect(typeof c).toBe("string");
      break;
    }
  });
});

describe("eligibleCells — 멤버 1개 이상 sigunguSet 소속(N:1·부분 방문)", () => {
  const synthetic: TourSigunguCell[] = [
    { area: 31, sigunguCode: "2", name: "고양시", members: ["31101", "31103", "31104"] },
    { area: 1, sigunguCode: "23", name: "종로구", members: ["11010"] },
    { area: 6, sigunguCode: "1", name: "강서구", members: ["21999"] },
  ];

  it("멤버 중 1개라도 속하면 통과(부분 방문 셀도 통과 — 나머지 미방문 구는 좌표검증 몫)", () => {
    const cells = eligibleCells(new Set(["31101"]), synthetic); // 고양시 3구 중 덕양만
    expect(cells.map((c) => c.name)).toEqual(["고양시"]);
  });

  it("멤버 0개 속하면 제외", () => {
    const cells = eligibleCells(new Set(["11010"]), synthetic);
    expect(cells.map((c) => c.name)).toEqual(["종로구"]);
  });

  it("빈 sigunguSet → 빈 셀 목록", () => {
    expect(eligibleCells(new Set(), synthetic)).toEqual([]);
  });

  it("기본 cells = TOUR_SIGUNGU_CELLS(생성물)", () => {
    const cells = eligibleCells(new Set([JONGNO_APP]));
    expect(cells.length).toBe(1);
    expect(cells[0].members).toContain(JONGNO_APP);
  });
});

describe("성질 — sigunguSet ≠ ∅ ⇔ eligibleCells ≠ ∅ (실데이터·전수 불변식)", () => {
  it("전멸 시 셀도 전멸", () => {
    const empty = emptySpotSigunguSet(new Set(), new Map());
    expect(empty.size).toBe(0);
    expect(eligibleCells(empty)).toEqual([]);
  });

  it("미방문 전체(ranks=null) → 셀 다수", () => {
    const all = emptySpotSigunguSet(new Set(), null);
    expect(all.size).toBe(250);
    expect(eligibleCells(all).length).toBeGreaterThan(0);
  });

  it("한 시군구만 한적 → 그 시군구 셀 정확히 1개(단일 원소 성질)", () => {
    const set = emptySpotSigunguSet(new Set(), new Map([[JONGNO_LDONG, 0.2]]));
    expect(set.size).toBe(1);
    const cells = eligibleCells(set);
    expect(cells.length).toBe(1);
    expect(cells[0].members).toContain(JONGNO_APP);
  });

  it("여러 exclude/rank 시나리오에서 (set 비었나) === (cells 비었나)", () => {
    const scenarios: Array<[Set<string>, Map<string, number> | null]> = [
      [new Set(), null],
      [ALL_CODES, null],
      [new Set(), new Map([[JONGNO_LDONG, 0.3]])],
      [new Set([JONGNO_APP]), new Map([[JONGNO_LDONG, 0.3]])],
      [new Set(), new Map()],
    ];
    for (const [ex, ranks] of scenarios) {
      const set = emptySpotSigunguSet(ex, ranks);
      expect(set.size === 0).toBe(eligibleCells(set).length === 0);
    }
  });
});
