import { describe, it, expect } from "vitest";
import { kakaoMapLink, kakaoRouteLink, naverMapLink } from "@/lib/mapLink";

// §7.2 카카오맵 딥링크 — 좌표 기반이 기본, 좌표 없으면 이름 검색으로 폴백.
// 카카오 URL 스킴: link/map/{이름,위도,경도}, link/to/{...}, link/search/{검색어}.
// 위도(lat)가 먼저, 경도(lng)가 뒤 — TourAPI mapy=위도, mapx=경도 순서 주의.

describe("kakaoMapLink", () => {
  it("좌표가 있으면 link/map 을 이름,위도,경도 순서로 만든다", () => {
    const url = kakaoMapLink("홍련암", 38.06, 128.66);
    expect(url).toBe(
      "https://map.kakao.com/link/map/" +
        encodeURIComponent("홍련암") +
        ",38.06,128.66",
    );
  });

  it("이름에 콤마가 있어도 인코딩되어 구분자를 깨지 않는다", () => {
    const url = kakaoMapLink("A,B 카페", 37.5, 127.05);
    // 콤마는 %2C 로 인코딩되어야 좌표 구분 콤마와 섞이지 않는다
    expect(url).toContain("%2C");
    expect(url?.endsWith(",37.5,127.05")).toBe(true);
  });

  it("좌표가 없으면 이름으로 검색 링크(link/search)로 폴백한다", () => {
    const url = kakaoMapLink("성산일출봉", null, null);
    expect(url).toBe(
      "https://map.kakao.com/link/search/" + encodeURIComponent("성산일출봉"),
    );
  });

  it("좌표 한쪽만 있으면(비정상) 검색 링크로 폴백한다", () => {
    expect(kakaoMapLink("어딘가", 37.5, null)).toBe(
      "https://map.kakao.com/link/search/" + encodeURIComponent("어딘가"),
    );
  });

  it("NaN 좌표는 무효로 보고 검색 링크로 폴백한다", () => {
    expect(kakaoMapLink("이름", Number.NaN, 127)).toContain("/link/search/");
  });

  it("좌표도 이름도 없으면 null", () => {
    expect(kakaoMapLink("   ", null, null)).toBeNull();
  });

  it("0 좌표는 유효한 숫자로 취급한다(falsy 오판 방지)", () => {
    const url = kakaoMapLink("적도어딘가", 0, 0);
    expect(url).toBe(
      "https://map.kakao.com/link/map/" +
        encodeURIComponent("적도어딘가") +
        ",0,0",
    );
  });
});

describe("kakaoRouteLink", () => {
  it("좌표가 있으면 길찾기(link/to) 링크를 만든다", () => {
    const url = kakaoRouteLink("토토네", 33.5, 126.5);
    expect(url).toBe(
      "https://map.kakao.com/link/to/" +
        encodeURIComponent("토토네") +
        ",33.5,126.5",
    );
  });

  it("좌표가 없으면 길찾기는 불가 — null", () => {
    expect(kakaoRouteLink("이름", null, null)).toBeNull();
  });
});

// 🟢 네이버 지도 딥링크(M16) — 다녀온 곳 리스트에서 카카오와 병기.
//   네이버는 좌표 스킴이 불안정해 이름 검색(p/search)만 쓴다.
describe("naverMapLink", () => {
  it("이름으로 검색 링크를 만든다", () => {
    expect(naverMapLink("성산일출봉")).toBe(
      "https://map.naver.com/p/search/" + encodeURIComponent("성산일출봉"),
    );
  });

  it("이름의 콤마·공백은 인코딩된다", () => {
    const url = naverMapLink("A, B 카페");
    expect(url).toContain("%2C");
    expect(url).not.toContain(" ");
  });

  it("빈 이름·공백뿐이면 null", () => {
    expect(naverMapLink("")).toBeNull();
    expect(naverMapLink("   ")).toBeNull();
  });
});
