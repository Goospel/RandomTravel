// ☔ 날씨 필터의 순수 로직 (plan.md §6.1). 네트워크는 lib/kma 가 담당, 여기선 변환·판정만.
//
// 기상청 초단기실황(getUltraSrtNcst)은 위경도가 아니라 격자좌표(nx,ny)를 받고,
// PTY(강수형태) 코드로 비 여부를 준다. 격자 변환·발표시각 계산·PTY 판정은 전부
// 순수함수라 단위 테스트로 못 박고, kma 는 이걸 조합해 실제 호출만 한다.

import { ALL_AREA_CODES } from "@/lib/constants";

/** getUltraSrtNcst item 원본 중 관심 필드 */
export interface NcstItem {
  category: string; // PTY·T1H·REH·RN1·WSD ...
  obsrValue: string;
}

/** 한 지역의 관측 요약 — pty(강수형태)·t1h(기온℃). 판정 불가 시 null. */
export interface WeatherObs {
  pty: number | null;
  t1h: number | null;
}

/**
 * 기상청 동네예보 격자(DFS) 변환 — 위경도 → (nx, ny). Lambert Conformal Conic.
 * 상수는 기상청 배포 파라미터 그대로(격자 5km). 서울 (37.5665,126.978)→(60,127) 앵커.
 */
export function latLngToGrid(lat: number, lng: number): { nx: number; ny: number } {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0; // 표준 위도 1
  const SLAT2 = 60.0; // 표준 위도 2
  const OLON = 126.0; // 기준점 경도
  const OLAT = 38.0; // 기준점 위도
  const XO = 43; // 기준점 X좌표(GRID)
  const YO = 136; // 기준점 Y좌표(GRID)
  const DEGRAD = Math.PI / 180.0;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn =
    Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}

/** KST 벽시계 시각 파츠(0..23시) — 서버 TZ(UTC)와 무관하게 Asia/Seoul 고정. */
function kstParts(now: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23", // 자정을 24 가 아니라 00 으로
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * 초단기실황 base_date·base_time (§6.1). 매시 정시 발표·제공은 매시 40분 이후 →
 * 안전하게 45분 컷: 45분 전이면 직전 정시로 물러난다(자정이면 전날로 롤백).
 * 항상 KST 기준(Vercel 런타임 TZ=UTC 방어, currentMonth·todayKST 와 동일 규율).
 */
export function ncstBaseDateTime(now: Date = new Date()): {
  baseDate: string;
  baseTime: string;
} {
  const { y, mo, d, h, mi } = kstParts(now);
  // KST 벽시계를 UTC 인 척 담아 산술(롤백)만 수행 — 절대시각 변환이 아니라 숫자 계산.
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const stepped = new Date(wall - (mi < 45 ? 3600_000 : 0));
  const baseDate =
    `${stepped.getUTCFullYear()}` +
    pad2(stepped.getUTCMonth() + 1) +
    pad2(stepped.getUTCDate());
  const baseTime = pad2(stepped.getUTCHours()) + "00";
  return { baseDate, baseTime };
}

function toNum(s: string | undefined): number | null {
  if (s == null) return null;
  // Number("")===0, Number(" ")===0 이라 빈/공백 문자열이 pty=0(비 안 옴)으로 오판된다 →
  // "-"·"강수없음" 같은 결측 표기와 동일하게 null(판정 불가)로 먼저 거른다(보수적 제외).
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** item 목록 → PTY·T1H 요약. 카테고리 누락·비수치는 null. */
export function parseNcst(items: NcstItem[]): WeatherObs {
  let pty: number | null = null;
  let t1h: number | null = null;
  for (const it of items) {
    if (it.category === "PTY") pty = toNum(it.obsrValue);
    else if (it.category === "T1H") t1h = toNum(it.obsrValue);
  }
  return { pty, t1h };
}

/** PTY 0(강수 없음)만 "비 안 옴". null(판정 불가)은 보수적으로 false. */
export function isRainFree(obs: WeatherObs): boolean {
  return obs.pty === 0;
}

/** 관측 맵에서 비 안 오는 지역 코드만(삽입 순서 유지). */
export function rainFreeAreaCodes(obs: Map<number, WeatherObs>): number[] {
  const out: number[] = [];
  for (const [code, o] of obs) {
    if (isRainFree(o)) out.push(code);
  }
  return out;
}

/**
 * 날씨 필터 적용 후 남는 지역 풀 = base ∩ (비 안 오는 지역).
 * base 가 null/빈 배열이면 전국(ALL_AREA_CODES) 기준. base 순서 보존.
 * 결과가 빈 배열이면 "조건 과다로 빈 풀"(§6.5) 신호. (narrowBySeasonal 대칭)
 */
export function narrowByWeather(
  base: number[] | null,
  rainFree: Iterable<number>,
): number[] {
  const set = rainFree instanceof Set ? rainFree : new Set(rainFree);
  const pool = base && base.length > 0 ? base : ALL_AREA_CODES;
  return pool.filter((c) => set.has(c));
}

/** ☔ 배지 — 뽑힌 지역이 비 안 오면 기온 동봉, 아니면(비/맵에 없음/null) 배지 없음. */
export function weatherBadge(
  obs: Map<number, WeatherObs>,
  areaCode: number | null,
): { temp: number | null } | null {
  if (areaCode == null) return null;
  const o = obs.get(areaCode);
  if (!o || !isRainFree(o)) return null;
  return { temp: o.t1h };
}
