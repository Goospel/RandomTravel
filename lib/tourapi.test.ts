import { describe, it, expect } from "vitest";
import { normalizePlace } from "@/lib/tourapi";
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
