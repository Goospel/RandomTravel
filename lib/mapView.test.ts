import { describe, it, expect } from "vitest";
import {
  visitedWithCoords,
  boundsOf,
  kakaoSdkUrl,
  KOREA_CENTER,
  type LatLng,
} from "@/lib/mapView";
import type { SavedPlace } from "@/lib/travelStore";

function sp(over: Partial<SavedPlace> = {}): SavedPlace {
  return {
    contentId: "1",
    contentTypeId: 12,
    title: "장소",
    address: "어딘가",
    image: null,
    lat: 37.5,
    lng: 127.0,
    areaCode: 1,
    savedAt: 0,
    ...over,
  };
}

describe("visitedWithCoords — 지도에 찍을 수 있는(좌표 유효) 방문지만", () => {
  it("lat·lng 이 유한수인 항목만 남긴다", () => {
    const list = [
      sp({ contentId: "a", lat: 37.5, lng: 127.0 }),
      sp({ contentId: "b", lat: null, lng: 127.0 }),
      sp({ contentId: "c", lat: 35.1, lng: null }),
    ];
    expect(visitedWithCoords(list).map((p) => p.contentId)).toEqual(["a"]);
  });
  it("좌표 없으면 빈 배열", () => {
    expect(visitedWithCoords([sp({ lat: null, lng: null })])).toEqual([]);
  });
  it("(0,0) 널섬 좌표(TourAPI mapx='0')는 제외한다", () => {
    expect(visitedWithCoords([sp({ lat: 0, lng: 0 })])).toEqual([]);
  });
  it("한반도 범위 밖(손상값·위경도 스왑) 좌표는 제외한다", () => {
    const list = [
      sp({ contentId: "kr", lat: 37.5, lng: 127.0 }), // 정상(서울)
      sp({ contentId: "big", lat: 1000, lng: 127.0 }), // 범위 밖 손상값
      sp({ contentId: "swap", lat: 127.0, lng: 37.5 }), // 위경도 스왑
    ];
    expect(visitedWithCoords(list).map((p) => p.contentId)).toEqual(["kr"]);
  });
  it("결과 타입은 lat·lng 이 number 로 좁혀진다(널 아님)", () => {
    const [first] = visitedWithCoords([sp({ lat: 33.4, lng: 126.5 })]);
    // 타입 수준: first.lat 은 number (컴파일되면 통과) + 값 검증
    expect(first.lat + first.lng).toBeCloseTo(159.9);
  });
});

describe("boundsOf — 점들의 경계상자 + 중심", () => {
  it("여러 점의 min/max/center", () => {
    const pts: LatLng[] = [
      { lat: 37.5, lng: 127.0 },
      { lat: 35.1, lng: 129.0 },
      { lat: 33.4, lng: 126.5 },
    ];
    const b = boundsOf(pts)!;
    expect(b.sw).toEqual({ lat: 33.4, lng: 126.5 });
    expect(b.ne).toEqual({ lat: 37.5, lng: 129.0 });
    expect(b.center.lat).toBeCloseTo((33.4 + 37.5) / 2);
    expect(b.center.lng).toBeCloseTo((126.5 + 129.0) / 2);
  });
  it("점 하나면 경계=그 점, 중심=그 점", () => {
    const b = boundsOf([{ lat: 37.5, lng: 127.0 }])!;
    expect(b.sw).toEqual({ lat: 37.5, lng: 127.0 });
    expect(b.ne).toEqual({ lat: 37.5, lng: 127.0 });
    expect(b.center).toEqual({ lat: 37.5, lng: 127.0 });
  });
  it("빈 입력 → null", () => {
    expect(boundsOf([])).toBeNull();
  });
});

describe("kakaoSdkUrl — SDK 스크립트 URL", () => {
  it("appkey 를 싣고 autoload=false(수동 load 위해)", () => {
    const url = kakaoSdkUrl("abc123");
    expect(url).toContain("dapi.kakao.com/v2/maps/sdk.js");
    expect(url).toContain("appkey=abc123");
    expect(url).toContain("autoload=false");
  });
});

describe("KOREA_CENTER — 방문지 없을 때 기본 중심(대한민국 근처)", () => {
  it("한반도 범위 안", () => {
    expect(KOREA_CENTER.lat).toBeGreaterThan(33);
    expect(KOREA_CENTER.lat).toBeLessThan(39);
    expect(KOREA_CENTER.lng).toBeGreaterThan(124);
    expect(KOREA_CENTER.lng).toBeLessThan(132);
  });
});
