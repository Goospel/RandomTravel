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
  it("세종은 시도 코드가 5자리(36110) — areacode 가 비어도 8 로 잡힌다", () => {
    // 실측 2026-07-27: 실제 세종 축제 2건이 이 형태. 3자리 36 만 알던 시절엔
    // 변환 실패로 festivalMap 에서 통째 탈락해 🎪 필터에서 세종이 사라졌다.
    expect(festivalAreaCode(raw({ lDongRegnCd: "36110", areacode: "" }))).toBe(8);
  });
  it("lDongRegnCd 없으면 areacode(TourAPI 코드) 폴백", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: undefined, areacode: "6" }))).toBe(6);
  });
  it("변환 불가(12+시군구 없음·둘 다 없음·화이트리스트 밖)는 null", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", areacode: "" }))).toBeNull();
    expect(festivalAreaCode(raw({ lDongRegnCd: undefined, areacode: undefined }))).toBeNull();
    expect(festivalAreaCode(raw({ lDongRegnCd: undefined, areacode: "999" }))).toBeNull();
  });
});

// 2026-07-01 행정구역 개편: 광주(구 29)+전남(구 46) → 전남광주통합특별시(법정동 신코드 12).
// 시도 단위로는 TourAPI areaCode 5(광주)/38(전남)을 가를 수 없어 lDongSignguCd 로 판별한다.
describe("festivalAreaCode — 전남광주통합특별시(법정동 12)는 시군구로 광주5/전남38 판별", () => {
  it("광주권 5개 구는 5", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", lDongSignguCd: "210" }))).toBe(5); // 동구
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", lDongSignguCd: "330" }))).toBe(5); // 광산구
  });
  it("전남권 시·군은 38", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", lDongSignguCd: "770" }))).toBe(38); // 장흥군
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", lDongSignguCd: "850" }))).toBe(38); // 완도군
  });
  it("광주 5구 열거 밖의 미지 시군구는 전남(38) 기본", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", lDongSignguCd: "999" }))).toBe(38);
  });
  it("시군구 코드가 없으면 기존 폴백 체인(오배정 방지)", () => {
    // areacode 빈 값 → null (탈락 유지)
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", areacode: "" }))).toBeNull();
    // areacode 가 있으면 그걸 쓴다
    expect(festivalAreaCode(raw({ lDongRegnCd: "12", areacode: "38" }))).toBe(38);
  });
  it("다른 시도 코드는 기존 LDONG_TO_AREA 경로 무변(시군구 값에 영향 없음)", () => {
    expect(festivalAreaCode(raw({ lDongRegnCd: "29", lDongSignguCd: "210" }))).toBe(5);
    expect(festivalAreaCode(raw({ lDongRegnCd: "46", lDongSignguCd: "770" }))).toBe(38);
    expect(festivalAreaCode(raw({ lDongRegnCd: "11", lDongSignguCd: "210" }))).toBe(1);
    expect(festivalAreaCode(raw({ lDongRegnCd: "51", lDongSignguCd: "330" }))).toBe(32);
  });
  it("normalizeFestivals 통합: 12번 축제가 광주·전남으로 살아남는다", () => {
    const out = normalizeFestivals(
      [
        raw({ contentid: "g", lDongRegnCd: "12", lDongSignguCd: "210", areacode: "", title: "금남로 걷자잉" }),
        raw({ contentid: "j", lDongRegnCd: "12", lDongSignguCd: "770", areacode: "", title: "물축제" }),
      ],
      "20260704",
    );
    expect(out.map((f) => [f.contentId, f.areaCode])).toEqual([
      ["g", 5],
      ["j", 38],
    ]);
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
