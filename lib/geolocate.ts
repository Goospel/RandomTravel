// 📍 내 위치에서 뽑기(M30, §7.19) — 브라우저 위치 권한 한 겹.
//
// Geolocation API 는 콜백 + 예외 없는 error code 라 화면에서 곧장 쓰면 분기가 UI 코드에 번진다.
// 여기서 {ok:true, 좌표} | {ok:false, 문구} 로 접어 화면은 "성공이냐 / 뭐라고 말하냐"만 본다.
// geolocation 을 주입받는 이유는 테스트 — jsdom 없이 순수부만 검증하는 저장소 규약(§8)을 지킨다.

import { isKoreaCoord } from "@/lib/geo";

export type GeoSource = Pick<Geolocation, "getCurrentPosition">;

export type LocateResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string };

/** 실패 문구 — "왜 안 됐는지"뿐 아니라 "다음에 뭘 할 수 있는지"까지(designGuide 톤). */
export const GEO_MESSAGE = {
  unsupported:
    "이 브라우저는 위치를 알려줄 수 없어요 — 그냥 지도를 굴려 아무 데나 뽑아 보세요.",
  denied:
    "위치 권한이 꺼져 있어요 — 브라우저 설정에서 이 사이트의 위치를 허용하면 내 주변에서 뽑을 수 있어요.",
  unavailable: "지금 위치를 확인하지 못했어요 — 잠시 뒤 다시 시도해 주세요.",
  timeout: "위치를 찾는 데 너무 오래 걸렸어요 — 다시 시도해 주세요.",
  outside: "국내 여행지만 다루고 있어요 — 한국 안에서 눌러 주세요.",
} as const;

// GeolocationPositionError 의 code. 상수를 쓰지 않는 건 이 상수가 브라우저 전역이라
// node 테스트 환경엔 없기 때문(값은 명세 고정 1·2·3).
const BY_CODE: Record<number, string> = {
  1: GEO_MESSAGE.denied, // PERMISSION_DENIED
  2: GEO_MESSAGE.unavailable, // POSITION_UNAVAILABLE
  3: GEO_MESSAGE.timeout, // TIMEOUT
};

// 뽑기 반경이 20km 라 100m 이하 정밀도는 결과를 하나도 바꾸지 않는다 → 서버로 나가기 전에
// 소수점 3자리(≈100m)로 뭉갠다. "정확한 위치는 모으지 않아요"(/privacy)를 코드에서 지키는 자리.
const coarse = (n: number) => Math.round(n * 1000) / 1000;

const OPTIONS: PositionOptions = {
  timeout: 8000, // 뽑기 상류 타임아웃과 같은 체감 상한 — 이보다 길면 사용자가 먼저 포기한다
  maximumAge: 60_000, // 1분 내 캐시 재사용(연타 시 즉시 응답)
};

/**
 * 위치 1회 조회. `geo` 미지정이면 `navigator.geolocation`(브라우저)에서 잡는다.
 * reject 하지 않는다 — 모든 실패가 사용자에게 보여줄 한국어 문구로 돌아온다.
 */
export function locate(geo?: GeoSource | null): Promise<LocateResult> {
  const source =
    geo === undefined
      ? typeof navigator !== "undefined"
        ? navigator.geolocation
        : null
      : geo;
  if (!source) {
    return Promise.resolve({ ok: false, message: GEO_MESSAGE.unsupported });
  }
  return new Promise((resolve) => {
    source.getCurrentPosition(
      ({ coords }) => {
        const lat = coarse(coords.latitude);
        const lng = coarse(coords.longitude);
        resolve(
          isKoreaCoord(lat, lng)
            ? { ok: true, lat, lng }
            : { ok: false, message: GEO_MESSAGE.outside },
        );
      },
      (err) =>
        resolve({
          ok: false,
          message: BY_CODE[err.code] ?? GEO_MESSAGE.unavailable,
        }),
      OPTIONS,
    );
  });
}
