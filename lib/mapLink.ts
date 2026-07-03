// 카카오맵 딥링크 생성 — 순수 함수 (plan.md §7.2, §8 테스트 대상)
//
// 카카오 URL 스킴(공식): 좌표 기반 링크가 기본. 카카오 장소ID는 TourAPI와
// 체계가 달라 좌표로 만든다.
//   지도 보기 : https://map.kakao.com/link/map/{이름,위도,경도}
//   길찾기    : https://map.kakao.com/link/to/{이름,위도,경도}
//   검색      : https://map.kakao.com/link/search/{검색어}
// ⚠️ 순서는 이름, 위도(lat), 경도(lng) — TourAPI mapy=위도, mapx=경도.
// 이름은 encodeURIComponent 로 감싸 콤마(좌표 구분자)·공백·한글이 깨지지 않게 한다.

const BASE = "https://map.kakao.com/link";

/** 유효한 좌표 숫자인지 — null/undefined/NaN 배제, 0 은 유효 */
function isCoord(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * 지도에서 보기 링크.
 * - 좌표가 둘 다 유효하면 link/map (이름,위도,경도)
 * - 좌표가 없으면 이름으로 link/search 폴백
 * - 이름도 좌표도 없으면 null
 */
export function kakaoMapLink(
  name: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  const label = name.trim();
  if (isCoord(lat) && isCoord(lng)) {
    const enc = encodeURIComponent(label || "여행지");
    return `${BASE}/map/${enc},${lat},${lng}`;
  }
  if (label) {
    return `${BASE}/search/${encodeURIComponent(label)}`;
  }
  return null;
}

/**
 * 길찾기(도착지) 링크.
 * 좌표가 있어야 목적지를 특정할 수 있으므로, 좌표가 없으면 null.
 */
export function kakaoRouteLink(
  name: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (isCoord(lat) && isCoord(lng)) {
    const enc = encodeURIComponent(name.trim() || "여행지");
    return `${BASE}/to/${enc},${lat},${lng}`;
  }
  return null;
}
