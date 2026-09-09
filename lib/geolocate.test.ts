import { describe, it, expect } from "vitest";
import { locate, GEO_MESSAGE, type GeoSource } from "@/lib/geolocate";

// 브라우저 API 스텁 — 성공/실패 콜백만 흉내낸다(jsdom 없이 도는 이유: locate 가 주입을 받는다).
const okGeo = (latitude: number, longitude: number): GeoSource => ({
  getCurrentPosition: (success) =>
    success({ coords: { latitude, longitude } } as GeolocationPosition),
});
const errGeo = (code: number): GeoSource => ({
  getCurrentPosition: (_success, error) =>
    error?.({ code } as GeolocationPositionError),
});

describe("locate — 브라우저 위치 권한 한 겹 (M30)", () => {
  it("허용하면 좌표를 준다", async () => {
    expect(await locate(okGeo(37.566, 126.978))).toEqual({
      ok: true,
      lat: 37.566,
      lng: 126.978,
    });
  });

  it("좌표를 소수점 3자리(≈100m)로 뭉갠다 — 반경 20km 뽑기엔 무손실, 서버로 정밀 위치를 보내지 않는다", async () => {
    expect(await locate(okGeo(37.5665123, 126.9779876))).toEqual({
      ok: true,
      lat: 37.567,
      lng: 126.978,
    });
  });

  it("한국 밖 좌표는 거부한다 (국내 여행지만 다룬다)", async () => {
    // 도쿄. 뭉개기 전에 판정하든 뒤에 하든 결과는 같아야 한다.
    expect(await locate(okGeo(35.6762, 139.6503))).toEqual({
      ok: false,
      message: GEO_MESSAGE.outside,
    });
  });

  it("권한 거부(code 1)·확인 실패(2)·시간 초과(3)를 각각 다른 문구로 구분한다", async () => {
    expect(await locate(errGeo(1))).toEqual({
      ok: false,
      message: GEO_MESSAGE.denied,
    });
    expect(await locate(errGeo(2))).toEqual({
      ok: false,
      message: GEO_MESSAGE.unavailable,
    });
    expect(await locate(errGeo(3))).toEqual({
      ok: false,
      message: GEO_MESSAGE.timeout,
    });
  });

  it("모르는 error code 는 '확인 실패'로 접는다", async () => {
    expect(await locate(errGeo(99))).toEqual({
      ok: false,
      message: GEO_MESSAGE.unavailable,
    });
  });

  it("geolocation 이 없는 브라우저면 묻지 않고 미지원 문구를 준다", async () => {
    expect(await locate(null)).toEqual({
      ok: false,
      message: GEO_MESSAGE.unsupported,
    });
  });
});
