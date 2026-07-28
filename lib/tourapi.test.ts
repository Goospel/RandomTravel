import { describe, it, expect } from "vitest";
import {
  normalizePlace,
  weightedIndex,
  buildDrawCombos,
  itemAreaCode,
  isRetryableDrawError,
  TourApiError,
} from "@/lib/tourapi";
import { ALL_AREA_CODES, AREA_TO_LDONG, LDONG_TO_AREA } from "@/lib/constants";
import type { TourApiItem } from "@/types/tour";

const base: TourApiItem = {
  contentid: "126508",
  contenttypeid: "12",
  title: "경복궁",
};

describe("normalizePlace — 응답 정규화", () => {
  it("정상 item 을 Place 로 매핑(mapy=위도, mapx=경도)", () => {
    const p = normalizePlace(
      {
        ...base,
        addr1: "서울특별시 종로구",
        addr2: "세종로",
        firstimage: "http://img/full.jpg",
        mapx: "126.9770",
        mapy: "37.5796",
        areacode: "1",
      },
      "설명",
    );
    expect(p).toMatchObject({
      contentId: "126508",
      contentTypeId: 12,
      title: "경복궁",
      address: "서울특별시 종로구 세종로",
      image: "http://img/full.jpg",
      lat: 37.5796,
      lng: 126.977,
      areaCode: 1,
      overview: "설명",
    });
  });

  it("contenttypeid 누락 → 0, title 빈 값 → '이름 미상'(NaN·빈 문자열 방어)", () => {
    const p = normalizePlace({ ...base, contenttypeid: "", title: "" }, null);
    expect(p.contentTypeId).toBe(0);
    expect(p.title).toBe("이름 미상");
  });

  it("좌표·이미지 없음 → null", () => {
    const p = normalizePlace(base, null);
    expect(p.image).toBeNull();
    expect(p.lat).toBeNull();
    expect(p.lng).toBeNull();
    expect(p.areaCode).toBeNull();
  });

  it("firstimage 없으면 firstimage2(썸네일)로 폴백", () => {
    const p = normalizePlace(
      { ...base, firstimage: "", firstimage2: "http://img/thumb.jpg" },
      null,
    );
    expect(p.image).toBe("http://img/thumb.jpg");
  });
});

describe("weightedIndex — 🌊 바다 totalCount 가중 선택(§6.3)", () => {
  it("rand 로 경계 구간을 정확히 고른다(누적합 반열림)", () => {
    // 가중치 [10,30,60] → 누적경계 0.1, 0.4, 1.0
    expect(weightedIndex([10, 30, 60], 0.0)).toBe(0);
    expect(weightedIndex([10, 30, 60], 0.05)).toBe(0);
    expect(weightedIndex([10, 30, 60], 0.2)).toBe(1);
    expect(weightedIndex([10, 30, 60], 0.5)).toBe(2);
    expect(weightedIndex([10, 30, 60], 0.999)).toBe(2);
  });
  it("합이 0이면 0(모든 조합 빈 경우 방어)", () => {
    expect(weightedIndex([0, 0], 0.5)).toBe(0);
  });
  it("큰 가중치가 더 자주 뽑힌다(치우침 확인)", () => {
    // rand=0.5 는 [1,99] 에서 반드시 index 1(99쪽)
    expect(weightedIndex([1, 99], 0.5)).toBe(1);
    // rand=0.005 는 index 0(1쪽) — 좁은 구간만 0
    expect(weightedIndex([1, 99], 0.005)).toBe(0);
  });
});

describe("AREA_TO_LDONG — 시·도 → 법정동 시도 코드 (§6.9A)", () => {
  it("17개 시·도 전부에 버킷 코드가 있다", () => {
    for (const code of ALL_AREA_CODES) {
      expect(AREA_TO_LDONG[code], `area ${code}`).toBeTruthy();
    }
    expect(Object.keys(AREA_TO_LDONG)).toHaveLength(ALL_AREA_CODES.length);
  });

  it("폐지 구코드(29·42·45·46)는 쓰지 않는다 — 실측 0건", () => {
    const used = Object.values(AREA_TO_LDONG);
    for (const dead of ["29", "42", "45", "46"]) {
      expect(used).not.toContain(dead);
    }
  });

  it("개편 신코드·특례 — 강원 51 · 전북 52 · 세종 36110 · 전남광주 병합 12", () => {
    expect(AREA_TO_LDONG[32]).toBe("51");
    expect(AREA_TO_LDONG[37]).toBe("52");
    expect(AREA_TO_LDONG[8]).toBe("36110"); // 3자리 36 은 실측 0건
    expect(AREA_TO_LDONG[5]).toBe("12"); // 광주
    expect(AREA_TO_LDONG[38]).toBe("12"); // 전남 — 같은 병합 쿼리를 중복 보유
  });

  it("병합·특례를 뺀 나머지는 LDONG_TO_AREA 의 정확한 역방향", () => {
    for (const [area, ldong] of Object.entries(AREA_TO_LDONG)) {
      if (ldong === "12" || ldong === "36110") continue;
      expect(LDONG_TO_AREA[ldong]).toBe(Number(area));
    }
  });
});

describe("itemAreaCode — 응답 항목의 시·도 귀속 (§6.9A)", () => {
  const base: TourApiItem = { contentid: "1", contenttypeid: "12", title: "t" };

  it("areacode 가 있으면 그대로 쓴다", () => {
    expect(itemAreaCode({ ...base, areacode: "6" })).toBe(6);
  });

  it("areacode 가 비면 법정동 코드로 귀속한다(항목 ~40%가 이 경로)", () => {
    // 가덕도 — 실측된 areacode 공백 항목
    expect(
      itemAreaCode({ ...base, lDongRegnCd: "26", lDongSignguCd: "440" }),
    ).toBe(6);
    expect(itemAreaCode({ ...base, lDongRegnCd: "51" })).toBe(32); // 강원 신코드
    expect(itemAreaCode({ ...base, lDongRegnCd: "36110" })).toBe(8); // 세종 특례
  });

  it("병합 12 는 시군구로 광주·전남을 가른다", () => {
    expect(
      itemAreaCode({ ...base, lDongRegnCd: "12", lDongSignguCd: "210" }),
    ).toBe(5);
    expect(
      itemAreaCode({ ...base, lDongRegnCd: "12", lDongSignguCd: "850" }),
    ).toBe(38);
  });

  it("areacode 가 '0'·빈 문자열이면 법정동으로 폴백", () => {
    expect(itemAreaCode({ ...base, areacode: "0", lDongRegnCd: "11" })).toBe(1);
    expect(itemAreaCode({ ...base, areacode: "", lDongRegnCd: "11" })).toBe(1);
  });

  it("단서가 없으면 null(호출부가 슬롯 시·도로 폴백)", () => {
    expect(itemAreaCode(base)).toBeNull();
    expect(itemAreaCode({ ...base, lDongRegnCd: "99" })).toBeNull();
  });
});

describe("buildDrawCombos — 뽑기 조합 생성 (§6.9A)", () => {
  it("지역 미선택이면 17시·도 lDong 버킷으로 실체화(전국 단일 쿼리 없음)", () => {
    const combos = buildDrawCombos([12, 14], null);
    expect(combos).toHaveLength(2 * ALL_AREA_CODES.length);
    for (const c of combos) {
      expect(c.lDongRegnCd).toBeTruthy();
      expect(c.areaCode).toBeUndefined(); // areaCode 쿼리면 항목 ~40% 탈락
    }
    // 타입별로 17개 슬롯 전부 — 시·도 균등의 전제
    const slots = combos.filter((c) => c.contentTypeId === 12).map((c) => c.slotAreaCode);
    expect([...slots].sort((a, b) => a - b)).toEqual(
      [...ALL_AREA_CODES].sort((a, b) => a - b),
    );
  });

  it("전남광주 병합 — 광주·전남 두 슬롯이 같은 쿼리 12 를 중복 보유", () => {
    const combos = buildDrawCombos([12], null);
    const merged = combos.filter((c) => c.lDongRegnCd === "12");
    expect(merged).toHaveLength(2);
    expect(merged.map((c) => c.slotAreaCode).sort((a, b) => a - b)).toEqual([5, 38]);
  });

  it("세종 슬롯은 5자리 36110 쿼리(실측 특례)", () => {
    const sejong = buildDrawCombos([12], null).find((c) => c.slotAreaCode === 8);
    expect(sejong?.lDongRegnCd).toBe("36110");
  });

  it("지역이 선택되면 기존 areaCode 쿼리 그대로(동작 무변)", () => {
    const combos = buildDrawCombos([12, 14, 15], [1, 39]);
    expect(combos).toHaveLength(6);
    for (const c of combos) {
      expect(c.areaCode).toBeDefined();
      expect(c.lDongRegnCd).toBeUndefined();
      expect(c.slotAreaCode).toBe(c.areaCode); // 배지 귀속 = 그 지역
    }
    expect(combos.map((c) => c.areaCode)).toEqual([1, 39, 1, 39, 1, 39]);
  });
});

describe("isRetryableDrawError — 뽑기 전체 1회 재추첨 판정 (§6.5)", () => {
  it("UPSTREAM_ERROR TourApiError 만 재시도 대상", () => {
    expect(isRetryableDrawError(new TourApiError("상류 죽음", "UPSTREAM_ERROR"))).toBe(true);
  });

  it("EMPTY_POOL 은 재시도해도 소용없다", () => {
    expect(isRetryableDrawError(new TourApiError("빈 풀", "EMPTY_POOL"))).toBe(false);
  });

  it("BAD_REQUEST 는 재시도 안 함", () => {
    expect(isRetryableDrawError(new TourApiError("잘못된 요청", "BAD_REQUEST"))).toBe(false);
  });

  it("일반 Error·비-Error 값은 전부 false", () => {
    expect(isRetryableDrawError(new Error("x"))).toBe(false);
    expect(isRetryableDrawError("UPSTREAM_ERROR")).toBe(false);
    expect(isRetryableDrawError(null)).toBe(false);
    expect(isRetryableDrawError(undefined)).toBe(false);
  });
});
