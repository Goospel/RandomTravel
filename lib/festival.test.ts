import { describe, it, expect } from "vitest";
import {
  todayKST,
  isInProgress,
  festivalAreaCode,
  normalizeFestivals,
  festivalsByArea,
  festivalBadge,
  type RawFestival,
} from "@/lib/festival";

// searchFestival2 원본 항목의 관심 필드만 담은 최소 형태로 검증.
function raw(over: Partial<RawFestival> = {}): RawFestival {
  return {
    contentid: "1",
    title: "축제",
    lDongRegnCd: "11", // 서울
    eventstartdate: "20260701",
    eventenddate: "20260731",
    ...over,
  };
}

describe("todayKST — YYYYMMDD, 항상 KST(서버 UTC 방어)", () => {
  it("UTC 전날 저녁이라도 KST 날짜", () => {
    // 2026-07-04 05:00 KST = 2026-07-03 20:00 UTC
    expect(todayKST(new Date(Date.UTC(2026, 6, 3, 20, 0)))).toBe("20260704");
  });
  it("KST 같은 날 낮", () => {
    expect(todayKST(new Date(Date.UTC(2026, 6, 4, 3, 0)))).toBe("20260704");
  });
});

describe("isInProgress — 시작 ≤ 오늘 ≤ 종료 (YYYYMMDD 문자열 비교)", () => {
  it("기간 안이면 true", () => {
    expect(isInProgress(raw(), "20260704")).toBe(true);
  });
  it("시작·종료 경계 포함", () => {
    expect(isInProgress(raw({ eventstartdate: "20260704" }), "20260704")).toBe(true);
    expect(isInProgress(raw({ eventenddate: "20260704" }), "20260704")).toBe(true);
  });
  it("시작 전·종료 후는 false", () => {
    expect(isInProgress(raw({ eventstartdate: "20260801", eventenddate: "20260810" }), "20260704")).toBe(false);
    expect(isInProgress(raw({ eventstartdate: "20260601", eventenddate: "20260630" }), "20260704")).toBe(false);
  });
  it("날짜 누락은 false(방어)", () => {
    expect(isInProgress(raw({ eventstartdate: "" }), "20260704")).toBe(false);
    expect(isInProgress(raw({ eventenddate: undefined }), "20260704")).toBe(false);
  });
});

describe("festivalAreaCode — lDongRegnCd → TourAPI areaCode", () => {
  it("법정동 시도 코드를 변환(서울11→1, 강원51→32, 전북52→37)", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "11" }))).toBe(1);
    expect(festivalAreaCode(raw({ lDongRegnCd: "51" }))).toBe(32);
    expect(festivalAreaCode(raw({ lDongRegnCd: "52" }))).toBe(37);
  });
  it("lDongRegnCd 없으면 areacode(TourAPI 코드) 폴백", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: undefined, areacode: "6" }))).toBe(6);
  });
  it("변환 불가(오염 코드 12·둘 다 없음·화이트리스트 밖)는 null", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", areacode: "" }))).toBeNull();
    expect(festivalAreaCode(raw({ lDongRegnCd: undefined, areacode: undefined }))).toBeNull();
    expect(festivalAreaCode(raw({ lDongRegnCd: undefined, areacode: "999" }))).toBeNull();
  });
});

describe("normalizeFestivals — 진행중 + 지역변환 통과분만", () => {
  it("진행중 아님·변환불가는 걸러낸다", () => {
    const list = [
      raw({ contentid: "a", lDongRegnCd: "11" }), // 진행중·서울 ✓
      raw({ contentid: "b", eventstartdate: "20260801", eventenddate: "20260810" }), // 미래 ✗
      raw({ contentid: "c", lDongRegnCd: "12", areacode: "" }), // 오염코드 ✗
    ];
    const out = normalizeFestivals(list, "20260704");
    expect(out.map((f) => f.contentId)).toEqual(["a"]);
    expect(out[0]).toMatchObject({ areaCode: 1, title: "축제", startDate: "20260701", endDate: "20260731" });
  });
});

describe("festivalsByArea / festivalBadge", () => {
  it("지역별로 묶는다", () => {
    const fests = normalizeFestivals(
      [
        raw({ contentid: "a", lDongRegnCd: "11", title: "서울1" }),
        raw({ contentid: "b", lDongRegnCd: "11", title: "서울2" }),
        raw({ contentid: "c", lDongRegnCd: "51", title: "강원1" }),
      ],
      "20260704",
    );
    const map = festivalsByArea(fests);
    expect(map.get(1)?.map((f) => f.title)).toEqual(["서울1", "서울2"]);
    expect(map.get(32)?.map((f) => f.title)).toEqual(["강원1"]);
  });
  it("배지: 첫 축제명 + 나머지 개수", () => {
    const fests = normalizeFestivals(
      [
        raw({ contentid: "a", lDongRegnCd: "11", title: "서울1" }),
        raw({ contentid: "b", lDongRegnCd: "11", title: "서울2" }),
      ],
      "20260704",
    );
    const map = festivalsByArea(fests);
    expect(festivalBadge(map, 1)).toEqual({ name: "서울1", more: 1 });
    expect(festivalBadge(map, 32)).toBeNull(); // 없는 지역
    expect(festivalBadge(map, null)).toBeNull(); // 지역 누락 방어
  });
});
