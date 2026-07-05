// 🗺️ 내 여행 지도(M8, plan.md §7.1)의 순수 로직 — 카카오 SDK·DOM 없이 단위 테스트 가능.
// 지도 렌더·마커는 components/VisitedMap 이 이 함수들을 조합해서 담당한다.

import type { SavedPlace } from "@/lib/travelStore";

export interface LatLng {
  lat: number;
  lng: number;
}

/** 방문 좌표가 없을 때 지도 기본 중심(대한민국 대략 중앙) */
export const KOREA_CENTER: LatLng = { lat: 36.5, lng: 127.8 };
/** 전국이 대략 들어오는 기본 축척(카카오 level: 클수록 넓게) */
export const DEFAULT_LEVEL = 13;
/** 방문지가 1곳뿐일 때 축척 — 도시 규모로 줌인(과확대 방지) */
export const SINGLE_LEVEL = 9;

// 남한 대략 경계 — 지도에 찍을 수 있는 유효 좌표인지 판정한다.
// Number.isFinite 만으로는 (0,0) 널섬(TourAPI mapx="0")·범위 밖 손상값·위경도 스왑이
// 통과해 bounds 를 붕괴(정상 마커까지 화면 밖으로)시킨다. 앱 데이터는 전부 국내
// 관광지라 이 경계로 좁혀도 정상 좌표는 손실이 없다(마라도 33.06~, 독도 ~131.9 포함).
const KR_LAT_MIN = 33;
const KR_LAT_MAX = 39;
const KR_LNG_MIN = 124;
const KR_LNG_MAX = 132;

function isPlottableCoord(lat: number | null, lng: number | null): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= KR_LAT_MIN &&
    lat <= KR_LAT_MAX &&
    lng >= KR_LNG_MIN &&
    lng <= KR_LNG_MAX
  );
}

/** 좌표가 유효한 방문지만 — 지도에 마커로 찍을 수 있는 것. lat·lng 타입이 number 로 좁혀진다. */
export function visitedWithCoords(
  places: SavedPlace[],
): (SavedPlace & { lat: number; lng: number })[] {
  return places.filter(
    (p): p is SavedPlace & { lat: number; lng: number } =>
      isPlottableCoord(p.lat, p.lng),
  );
}

/** 점들의 경계상자(SW·NE) + 중심. 비어 있으면 null. */
export function boundsOf(
  points: LatLng[],
): { sw: LatLng; ne: LatLng; center: LatLng } | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return {
    sw: { lat: minLat, lng: minLng },
    ne: { lat: maxLat, lng: maxLng },
    center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
  };
}

/** 카카오 지도 JS SDK 스크립트 URL. autoload=false 로 받아 kakao.maps.load 로 수동 초기화. */
export function kakaoSdkUrl(appkey: string): string {
  return `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false`;
}

// 카카오 JS SDK(공유·메시지용, M13). 지도 SDK(dapi, window.kakao.maps)와 **별개 스크립트·별개 전역**
// (window.Kakao)이라 공존한다. integrity 는 2.7.6 파일의 sha384 실측값(SRI 검증됨).
export const KAKAO_JS_SDK = {
  src: "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js",
  integrity:
    "sha384-WAtVcQYcmTO/N+C1N+1m6Gp8qxh+3NlnP7X1U7qP6P5dQY/MsRBNTh+e1ahJrkEm",
} as const;
