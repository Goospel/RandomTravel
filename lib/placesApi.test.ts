import { describe, it, expect } from "vitest";
import { sanitizePlace, isPlaceList } from "@/lib/placesApi";

describe("isPlaceList — 목록 종류 검증", () => {
  it("saved/visited 만 통과", () => {
    expect(isPlaceList("saved")).toBe(true);
    expect(isPlaceList("visited")).toBe(true);
    expect(isPlaceList("recent")).toBe(false);
    expect(isPlaceList("")).toBe(false);
    expect(isPlaceList(null)).toBe(false);
    expect(isPlaceList(123)).toBe(false);
  });
});

describe("sanitizePlace — 신뢰 못 할 요청 바디를 SavedPlace 로 정제", () => {
  it("정상 객체는 그대로 정제된다", () => {
    const p = sanitizePlace({
      contentId: "126508",
      contentTypeId: 12,
      title: "경복궁",
      address: "서울 종로구",
      image: "http://x/y.jpg",
      lat: 37.57,
      lng: 126.97,
      areaCode: 1,
      savedAt: 1000,
      rating: 3,
    });
    expect(p).toEqual({
      contentId: "126508",
      contentTypeId: 12,
      title: "경복궁",
      address: "서울 종로구",
      image: "http://x/y.jpg",
      lat: 37.57,
      lng: 126.97,
      areaCode: 1,
      savedAt: 1000,
      rating: 3,
    });
  });

  it("contentId 없으면 null(필수)", () => {
    expect(sanitizePlace({ title: "x" })).toBeNull();
    expect(sanitizePlace({ contentId: "" })).toBeNull();
    expect(sanitizePlace({ contentId: 123 })).toBeNull();
    expect(sanitizePlace(null)).toBeNull();
    expect(sanitizePlace("nope")).toBeNull();
  });

  it("결측·잘못된 선택 필드는 안전한 기본값/널로 강등", () => {
    const p = sanitizePlace({ contentId: "1" })!;
    expect(p.contentId).toBe("1");
    expect(p.contentTypeId).toBe(0);
    expect(p.title).toBe("");
    expect(p.address).toBe("");
    expect(p.image).toBeNull();
    expect(p.lat).toBeNull();
    expect(p.lng).toBeNull();
    expect(p.areaCode).toBeNull();
    expect(p.savedAt).toBe(0);
    expect(p.rating).toBeNull();
  });

  it("NaN·Infinity 좌표는 널로", () => {
    const p = sanitizePlace({ contentId: "1", lat: NaN, lng: Infinity, savedAt: NaN })!;
    expect(p.lat).toBeNull();
    expect(p.lng).toBeNull();
    expect(p.savedAt).toBe(0);
  });

  it("과도하게 긴 contentId(>64자)는 거부(식별자는 절단 불가)", () => {
    expect(sanitizePlace({ contentId: "x".repeat(65) })).toBeNull();
    expect(sanitizePlace({ contentId: "x".repeat(64), title: "ok" })).not.toBeNull();
  });

  it("긴 title·address·image 는 상한으로 절단(저장 팽창 방어)", () => {
    const p = sanitizePlace({
      contentId: "1",
      title: "가".repeat(500),
      address: "나".repeat(500),
      image: "h".repeat(5000),
    })!;
    expect(p.title.length).toBe(256);
    expect(p.address.length).toBe(256);
    expect(p.image!.length).toBe(2048);
  });

  it("rating 은 1|2|3 만 통과, 그 외/누락은 null (M15)", () => {
    expect(sanitizePlace({ contentId: "1", rating: 1 })!.rating).toBe(1);
    expect(sanitizePlace({ contentId: "1", rating: 2 })!.rating).toBe(2);
    expect(sanitizePlace({ contentId: "1", rating: 3 })!.rating).toBe(3);
    // 범위 밖·형식 오류·누락 → null
    expect(sanitizePlace({ contentId: "1", rating: 0 })!.rating).toBeNull();
    expect(sanitizePlace({ contentId: "1", rating: 4 })!.rating).toBeNull();
    expect(sanitizePlace({ contentId: "1", rating: 2.5 })!.rating).toBeNull();
    expect(sanitizePlace({ contentId: "1", rating: "2" })!.rating).toBeNull();
    expect(sanitizePlace({ contentId: "1" })!.rating).toBeNull();
  });
});
