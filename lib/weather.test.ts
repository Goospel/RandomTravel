// ☔ 날씨 필터 순수 로직 테스트 (plan.md §6.1). 네트워크 없음 — 격자변환·발표시각·
// PTY 판정·풀 좁히기·배지를 결정적으로 검증한다(TDD: 구현 전 먼저 작성).

import { describe, it, expect } from "vitest";
import { AREA_LATLNG, ALL_AREA_CODES } from "@/lib/constants";
import {
  latLngToGrid,
  ncstBaseDateTime,
  parseNcst,
  isRainFree,
  rainFreeAreaCodes,
  narrowByWeather,
  weatherBadge,
  type WeatherObs,
} from "@/lib/weather";

describe("latLngToGrid — 기상청 LCC 위경도→격자 변환", () => {
  it("서울시청(37.5665,126.978) → 격자 (60,127) [기상청 표준 앵커]", () => {
    expect(latLngToGrid(37.5665, 126.978)).toEqual({ nx: 60, ny: 127 });
  });

  it("대전시청(36.3504,127.3845) → 격자 (67,100)", () => {
    expect(latLngToGrid(36.3504, 127.3845)).toEqual({ nx: 67, ny: 100 });
  });

  it("부산시청(35.1796,129.0756) → 격자 (98,76)", () => {
    expect(latLngToGrid(35.1796, 129.0756)).toEqual({ nx: 98, ny: 76 });
  });

  it("17개 시·도 대표점이 모두 유효 격자 범위(nx 1..149, ny 1..253) 안에 든다", () => {
    for (const code of ALL_AREA_CODES) {
      const { lat, lng } = AREA_LATLNG[code];
      const { nx, ny } = latLngToGrid(lat, lng);
      expect(nx, `area ${code} nx`).toBeGreaterThanOrEqual(1);
      expect(nx, `area ${code} nx`).toBeLessThanOrEqual(149);
      expect(ny, `area ${code} ny`).toBeGreaterThanOrEqual(1);
      expect(ny, `area ${code} ny`).toBeLessThanOrEqual(253);
    }
  });
});

describe("ncstBaseDateTime — 초단기실황 base_date/base_time (KST, 45분 컷)", () => {
  it("KST 14:50 → 당시각 1400 (발표 45분 지남)", () => {
    // UTC 05:50 = KST 14:50
    expect(ncstBaseDateTime(new Date("2026-07-04T05:50:00Z"))).toEqual({
      baseDate: "20260704",
      baseTime: "1400",
    });
  });

  it("KST 14:30 → 직전 정시 1300 (아직 45분 전)", () => {
    // UTC 05:30 = KST 14:30
    expect(ncstBaseDateTime(new Date("2026-07-04T05:30:00Z"))).toEqual({
      baseDate: "20260704",
      baseTime: "1300",
    });
  });

  it("KST 00:20 → 전날 2300 으로 날짜까지 롤백", () => {
    // UTC 2026-07-03 15:20 = KST 2026-07-04 00:20
    expect(ncstBaseDateTime(new Date("2026-07-03T15:20:00Z"))).toEqual({
      baseDate: "20260703",
      baseTime: "2300",
    });
  });

  it("KST 00:50 → 같은 날 0000 (자정 시각 처리)", () => {
    // UTC 2026-07-03 15:50 = KST 2026-07-04 00:50
    expect(ncstBaseDateTime(new Date("2026-07-03T15:50:00Z"))).toEqual({
      baseDate: "20260704",
      baseTime: "0000",
    });
  });
});

describe("parseNcst — getUltraSrtNcst item 목록에서 PTY·T1H 추출", () => {
  it("PTY·T1H 를 숫자로 뽑는다", () => {
    const items = [
      { category: "PTY", obsrValue: "0" },
      { category: "T1H", obsrValue: "23.4" },
      { category: "REH", obsrValue: "60" },
      { category: "RN1", obsrValue: "0" },
    ];
    expect(parseNcst(items)).toEqual({ pty: 0, t1h: 23.4 });
  });

  it("PTY 없으면 pty=null (판정 불가 = 비 안 옴으로 취급 안 함)", () => {
    expect(parseNcst([{ category: "T1H", obsrValue: "10" }])).toEqual({
      pty: null,
      t1h: 10,
    });
  });

  it("T1H 가 비수치('-')면 t1h=null, PTY 는 유지", () => {
    expect(
      parseNcst([
        { category: "PTY", obsrValue: "1" },
        { category: "T1H", obsrValue: "-" },
      ]),
    ).toEqual({ pty: 1, t1h: null });
  });

  it("빈 목록 → 둘 다 null", () => {
    expect(parseNcst([])).toEqual({ pty: null, t1h: null });
  });
});

describe("isRainFree — PTY 0(강수 없음)만 비 안 옴", () => {
  it("pty 0 → true", () => {
    expect(isRainFree({ pty: 0, t1h: null })).toBe(true);
  });

  it.each([1, 2, 3, 5, 6, 7])("pty %i(비·눈 등) → false", (pty) => {
    expect(isRainFree({ pty, t1h: null })).toBe(false);
  });

  it("pty null(판정 불가) → false (보수적으로 제외)", () => {
    expect(isRainFree({ pty: null, t1h: null })).toBe(false);
  });
});

describe("rainFreeAreaCodes — 관측 맵에서 비 안 오는 지역 코드만", () => {
  it("pty 0 인 지역만, 삽입 순서 유지", () => {
    const obs = new Map<number, WeatherObs>([
      [1, { pty: 0, t1h: 20 }],
      [6, { pty: 1, t1h: 18 }],
      [39, { pty: 0, t1h: 25 }],
      [32, { pty: null, t1h: 15 }],
    ]);
    expect(rainFreeAreaCodes(obs)).toEqual([1, 39]);
  });

  it("전부 비/판정불가면 빈 배열", () => {
    const obs = new Map<number, WeatherObs>([
      [1, { pty: 1, t1h: 18 }],
      [2, { pty: null, t1h: null }],
    ]);
    expect(rainFreeAreaCodes(obs)).toEqual([]);
  });
});

describe("narrowByWeather — 지역 풀 ∩ 비 안 오는 지역 (narrowBySeasonal 대칭)", () => {
  it("base 를 비 안 오는 집합으로 교집합, base 순서 보존", () => {
    expect(narrowByWeather([32, 1, 6], new Set([1, 6]))).toEqual([1, 6]);
  });

  it("base 가 null 이면 전국(ALL_AREA_CODES)에서 비 안 오는 지역만", () => {
    const rainFree = new Set([1, 39]);
    expect(narrowByWeather(null, rainFree)).toEqual([1, 39]);
  });

  it("교집합이 비면 빈 배열(조건 과다 신호)", () => {
    expect(narrowByWeather([1, 2], new Set([6]))).toEqual([]);
  });
});

describe("weatherBadge — 뽑힌 지역의 '지금 비 안 와요' 배지(+기온)", () => {
  it("비 안 오는 지역이면 기온 동봉", () => {
    const obs = new Map<number, WeatherObs>([[1, { pty: 0, t1h: 23.4 }]]);
    expect(weatherBadge(obs, 1)).toEqual({ temp: 23.4 });
  });

  it("기온 관측이 없어도 배지는 뜬다(temp=null)", () => {
    const obs = new Map<number, WeatherObs>([[1, { pty: 0, t1h: null }]]);
    expect(weatherBadge(obs, 1)).toEqual({ temp: null });
  });

  it("비 오는 지역/맵에 없는 지역/areaCode null → 배지 없음", () => {
    const obs = new Map<number, WeatherObs>([
      [1, { pty: 0, t1h: 20 }],
      [6, { pty: 1, t1h: 18 }],
    ]);
    expect(weatherBadge(obs, 6)).toBeNull();
    expect(weatherBadge(obs, 2)).toBeNull();
    expect(weatherBadge(obs, null)).toBeNull();
  });
});
