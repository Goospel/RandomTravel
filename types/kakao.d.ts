// 카카오 지도 JS SDK 중 이 프로젝트(M8)가 실제로 쓰는 부분만의 최소 타입.
// (전체 타입 패키지 대신 필요한 생성자·메서드만 선언 — strict 모드에서 any 회피)

export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}
export interface KakaoMap {
  setBounds(bounds: KakaoLatLngBounds): void;
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
}
export interface KakaoMarker {
  setMap(map: KakaoMap | null): void;
}
export interface KakaoInfoWindow {
  open(map: KakaoMap, marker: KakaoMarker): void;
  close(): void;
}
export interface KakaoMapsEvent {
  addListener(target: object, type: string, handler: () => void): void;
}
export interface KakaoMaps {
  /** autoload=false 로 받은 SDK 초기화 — 콜백 안에서 생성자들이 준비된다. */
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  Marker: new (options: {
    position: KakaoLatLng;
    map?: KakaoMap;
    title?: string;
  }) => KakaoMarker;
  InfoWindow: new (options: {
    content: string | HTMLElement;
    removable?: boolean;
  }) => KakaoInfoWindow;
  event: KakaoMapsEvent;
}
export interface Kakao {
  maps: KakaoMaps;
}

declare global {
  interface Window {
    kakao?: Kakao;
  }
}
