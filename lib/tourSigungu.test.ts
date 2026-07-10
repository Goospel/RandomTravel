import { describe, it, expect } from "vitest";
import { TOUR_SIGUNGU_CELLS, TOUR_SIGUNGU_MEMBER_TOTAL } from "@/lib/tourSigungu";
import { KOREA_SIGUNGU, KOREA_SIGUNGU_TOTAL } from "@/lib/koreaMap";

// 🔭 셀 매핑 생성물(lib/tourSigungu.ts) 상시 회귀 가드 — 네트워크 0.
//   생성기(scripts/genTourSigungu.mjs)가 잘못 재생성되면 여기서 잡는다.
describe("tourSigungu 셀 매핑 — 250 전수·중복 0·특례 4건", () => {
  const allMembers = TOUR_SIGUNGU_CELLS.flatMap((c) => c.members);

  it("members 합집합 = KOREA_SIGUNGU 250 전수(누락·초과 0)", () => {
    expect(allMembers.length).toBe(250);
    expect(TOUR_SIGUNGU_MEMBER_TOTAL).toBe(250);
    expect(KOREA_SIGUNGU_TOTAL).toBe(250);
    const memberSet = new Set(allMembers);
    const appSet = new Set(KOREA_SIGUNGU.map((sg) => sg.code));
    expect(memberSet).toEqual(appSet); // 정확히 같은 250개 통계청 code
  });

  it("member 중복 0 — 각 통계청 code 는 정확히 한 셀 소속", () => {
    expect(new Set(allMembers).size).toBe(250);
  });

  it("빈 셀 없음 — 모든 셀은 members ≥ 1", () => {
    for (const c of TOUR_SIGUNGU_CELLS) expect(c.members.length).toBeGreaterThan(0);
  });

  it("셀 신원(area:sigunguCode) 유일 — 중복 셀 없음", () => {
    const keys = TOUR_SIGUNGU_CELLS.map((c) => `${c.area}:${c.sigunguCode}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("특례 4건 — 미추홀·세종·부천·군위(대구 편입)", () => {
    const cellOf = (code: string) => TOUR_SIGUNGU_CELLS.find((c) => c.members.includes(code));
    // 미추홀 — 앱 '남구'(23030) → TourAPI '미추홀구'(area 2)
    expect(cellOf("23030")).toMatchObject({ area: 2, name: "미추홀구" });
    // 세종 — 앱 '세종시'(29010) → TourAPI '세종특별자치시'(area 8)
    expect(cellOf("29010")).toMatchObject({ area: 8, name: "세종특별자치시" });
    // 부천 — 앱 '부천시'(31050) → TourAPI '부천시'(area 31)
    expect(cellOf("31050")).toMatchObject({ area: 31, name: "부천시" });
    // 군위 — 앱 area 35(경북, 37310) → TourAPI 대구(area 4) '군위군'
    expect(cellOf("37310")).toMatchObject({ area: 4, name: "군위군" });
  });

  it("N:1 셀 — 고양시(3구)·창원시(5구)가 한 셀로 묶임", () => {
    const cellOf = (code: string) => TOUR_SIGUNGU_CELLS.find((c) => c.members.includes(code));
    const goyang = cellOf("31101"); // 덕양구
    expect(goyang?.name).toBe("고양시");
    expect(goyang?.members.sort()).toEqual(["31101", "31103", "31104"]);
    const changwon = cellOf("38111"); // 의창구
    expect(changwon?.name).toBe("창원시");
    expect(changwon?.members.length).toBe(5);
  });
});
