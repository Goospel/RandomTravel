// ☔ 기상청(KMA) 초단기실황 호출 래퍼 (plan.md §6.1). TourAPI 와 다른 상류·키·규약:
//  - base: 1360000/VilageFcstInfoService_2.0, 오퍼레이션 getUltraSrtNcst
//  - 키: WEATHER_API_KEY (Decoding 키를 URLSearchParams.set 으로 1회만 인코딩 — TourAPI 와 동일 함정)
//  - 성공 판별: response.header.resultCode === "00"(NORMAL_SERVICE) — TourAPI 의 "0000" 과 다름
//  - dataType=JSON (TourAPI 는 _type=json)
//
// 지역별 관측은 병렬 조회(최대 17)하고 30분 캐시. 한 지역이 실패하면 그 지역만 빼고(=비 안 옴
// 판정을 못 하므로 보수적으로 제외), 전 지역이 실패하면 WeatherError 를 던져 호출부가
// "날씨 필터만 건너뛰기"(§6.5)로 처리하게 한다.

import { AREA_LATLNG, ALL_AREA_CODES } from "@/lib/constants";
import {
  latLngToGrid,
  ncstBaseDateTime,
  parseNcst,
  type NcstItem,
  type WeatherObs,
} from "@/lib/weather";

const BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

export class WeatherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherError";
  }
}

interface KmaEnvelope {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: "" | { item?: NcstItem | NcstItem[] } };
  };
}

/** 초단기실황 1지점 조회 → item 목록. 실패는 WeatherError. 30분 캐시. */
async function fetchNcst(
  nx: number,
  ny: number,
  baseDate: string,
  baseTime: string,
): Promise<NcstItem[]> {
  const key = process.env.WEATHER_API_KEY;
  if (!key) {
    throw new WeatherError("서버에 기상청 키(WEATHER_API_KEY)가 설정되지 않았어요.");
  }

  const sp = new URLSearchParams();
  sp.set("serviceKey", key); // Decoding 키 — set 이 +,= 를 정확히 1회 인코딩
  sp.set("dataType", "JSON");
  sp.set("numOfRows", "10");
  sp.set("pageNo", "1");
  sp.set("base_date", baseDate);
  sp.set("base_time", baseTime);
  sp.set("nx", String(nx));
  sp.set("ny", String(ny));

  const url = `${BASE}/getUltraSrtNcst?${sp.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 1800 } });
  } catch {
    throw new WeatherError("기상청 서버에 연결하지 못했어요.");
  }

  const text = await res.text();
  let json: KmaEnvelope;
  try {
    json = JSON.parse(text) as KmaEnvelope;
  } catch {
    // 인증·쿼터 오류는 게이트웨이가 XML(OpenAPI_ServiceResponse)로 준다 (dataType 무시)
    throw new WeatherError("기상청 응답을 해석하지 못했어요. (서비스키 확인)");
  }

  const code = json.response?.header?.resultCode;
  if (code !== "00") {
    const msg = json.response?.header?.resultMsg ?? "알 수 없는 오류";
    throw new WeatherError(`기상청 오류: ${msg} (code ${code ?? "?"})`);
  }

  const items = json.response?.body?.items;
  if (!items || !items.item) return [];
  return Array.isArray(items.item) ? items.item : [items.item];
}

/**
 * 지역 풀의 시·도별 현재 관측(PTY·T1H)을 병렬 수집 (§6.1).
 * areaPool 이 null/빈 배열이면 전국 17개. 개별 실패는 맵에서 제외하고,
 * 전 지역 실패(총 아웃티지)면 WeatherError 를 던진다.
 */
export async function getWeatherByArea(
  areaPool: number[] | null,
  now: Date = new Date(),
): Promise<Map<number, WeatherObs>> {
  const codes = areaPool && areaPool.length > 0 ? areaPool : ALL_AREA_CODES;
  const { baseDate, baseTime } = ncstBaseDateTime(now);

  const settled = await Promise.allSettled(
    codes.map(async (code) => {
      const { lat, lng } = AREA_LATLNG[code];
      const { nx, ny } = latLngToGrid(lat, lng);
      const items = await fetchNcst(nx, ny, baseDate, baseTime);
      return { code, obs: parseNcst(items) };
    }),
  );

  const map = new Map<number, WeatherObs>();
  for (const s of settled) {
    if (s.status === "fulfilled") map.set(s.value.code, s.value.obs);
  }
  if (map.size === 0) {
    throw new WeatherError("기상청 관측을 한 곳도 받지 못했어요.");
  }
  return map;
}
