import { describe, it, expect } from "vitest";
import { topQuietSigungu } from "@/lib/quietTop";
import { CONGESTION_SIGUNGU_CODES } from "@/lib/congestionCodes";
import { TOUR_SIGUNGU_CELLS } from "@/lib/tourSigungu";
import { KOREA_SIGUNGU } from "@/lib/koreaMap";

/** 테스트용 ranks — (앱 area+이름) → 그 시군구의 법정동 코드 전부에 같은 pctRank 를 심는다. */
function ranksFor(entries: [area: number, name: string, pct: number][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const [area, name, pct] of entries) {
    const codes = CONGESTION_SIGUNGU_CODES[`${area}:${name}`];
    if (!codes) throw new Error(`매핑 없는 시군구: ${area}:${name}`);
    for (const cd of codes) m.set(cd, pct);
  }
  return m;
}

/** 전 셀 멤버(기본 인자와 동일) — 스킵 테스트에서 일부만 빼기 위한 기준 집합. */
const ALL_MEMBERS = new Set(TOUR_SIGUNGU_CELLS.flatMap((c) => c.members));

describe("topQuietSigungu — 🍃 오늘 한적 TOP5 선정(§7.16A)", () => {
  it("빈 랭크는 빈 배열(스트립 미노출)", () => {
    expect(topQuietSigungu(new Map(), 5)).toEqual([]);
  });

  it("pctRank 오름차순 상위 N — 가장 한적한 곳이 앞", () => {
    const ranks = ranksFor([
      [38, "신안군", 0.03],
      [35, "영양군", 0.1],
      [35, "울릉군", 0.2],
      [2, "옹진군", 0.3],
      [1, "노원구", 0.4],
      [1, "종로구", 0.9],
    ]);
    const top = topQuietSigungu(ranks, 5);
    expect(top.map((t) => t.name)).toEqual([
      "신안군",
      "영양군",
      "울릉군",
      "옹진군",
      "노원구",
    ]);
  });

  it("항목은 시·도명·시·군·구명·통계청 code·pctBelow(=round(pctRank×100))", () => {
    // 0.036 → 반올림 4(내림이면 3) — 반올림 규칙까지 판별하는 값.
    const top = topQuietSigungu(ranksFor([[38, "신안군", 0.036]]), 5);
    expect(top).toEqual([
      { code: "36480", name: "신안군", areaName: "전남", pctBelow: 4 },
    ]);
  });

  it("동률은 통계청 code 오름차순 타이브레이크 — 입력 순서와 무관(결정적)", () => {
    // 같은 pctRank 세 곳 — 통계청 code 는 노원구 11110 < 옹진군 23320 < 신안군 36480.
    // ⚠️ KOREA_SIGUNGU 는 code 순이라 기본 인자로는 정렬 안정성만으로도 통과한다(공허).
    //    입력을 뒤집어 넣어 **명시 타이브레이크가 실제로 일하는지** 실측한다.
    const ranks = ranksFor([
      [38, "신안군", 0.2],
      [2, "옹진군", 0.2],
      [1, "노원구", 0.2],
    ]);
    const reversed = [...KOREA_SIGUNGU].reverse();
    expect(topQuietSigungu(ranks, 5, undefined, reversed).map((t) => t.code)).toEqual([
      "11110",
      "23320",
      "36480",
    ]);
  });

  it("랭크 결측(매핑은 있으나 데이터 없음) 시군구는 제외", () => {
    const ranks = ranksFor([[38, "신안군", 0.03]]);
    const top = topQuietSigungu(ranks, 5);
    expect(top).toHaveLength(1); // 나머지 249곳은 결측 → 후보에서 빠짐
  });

  it("셀 매핑 없는 시군구는 스킵하고 다음 순위로 채운다(죽은 칩 방지)", () => {
    const ranks = ranksFor([
      [38, "신안군", 0.03],
      [35, "영양군", 0.1],
      [35, "울릉군", 0.2],
    ]);
    const without = new Set(ALL_MEMBERS);
    without.delete("36480"); // 신안군 셀 매핑 제거 — 탭해도 못 뽑는 칩
    const top = topQuietSigungu(ranks, 2, without);
    expect(top.map((t) => t.name)).toEqual(["영양군", "울릉군"]);
  });

  it("n 보다 후보가 적으면 있는 만큼만", () => {
    expect(topQuietSigungu(ranksFor([[38, "신안군", 0.03]]), 5)).toHaveLength(1);
  });

  it("n=0 이면 빈 배열", () => {
    expect(topQuietSigungu(ranksFor([[38, "신안군", 0.03]]), 0)).toEqual([]);
  });

  it("기본 셀 인덱스에서는 250 시·군·구가 모두 후보(⋃members 전수 — 스킵 0)", () => {
    // 실데이터 성질 회귀 가드: 기본 인자로는 매핑 스킵이 일어나지 않아야 한다.
    const all = Object.keys(CONGESTION_SIGUNGU_CODES).map((k) => {
      const [area, name] = k.split(":");
      return [Number(area), name, 0.5] as [number, string, number];
    });
    expect(topQuietSigungu(ranksFor(all), 250)).toHaveLength(250);
  });
});
