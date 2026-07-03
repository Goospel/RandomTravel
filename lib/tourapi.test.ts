import { describe, it, expect } from "vitest";
import { normalizePlace, weightedIndex } from "@/lib/tourapi";
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
