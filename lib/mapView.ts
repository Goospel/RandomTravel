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

function isCoord(n: number | null): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** 좌표가 유효한 방문지만 — 지도에 마커로 찍을 수 있는 것. lat·lng 타입이 number 로 좁혀진다. */
export function visitedWithCoords(
  places: SavedPlace[],
): (SavedPlace & { lat: number; lng: number })[] {
  return places.filter(
    (p): p is SavedPlace & { lat: number; lng: number } =>
      isCoord(p.lat) && isCoord(p.lng),
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
