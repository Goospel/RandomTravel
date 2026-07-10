// 쿼리 파라미터 파싱·조립 — 순수 함수 (테스트 대상, plan.md §8)

import { ALL_AREA_CODES, ALL_CONTENT_TYPE_CODES } from "@/lib/constants";
import { kstYmd, ymdOffset } from "@/lib/kst";

/**
 * 콤마 문자열 → 유효 코드 배열.
 * 정수·양수만, 화이트리스트(valid)에 있는 것만, 중복 제거(첫 등장 순서 유지).
 * 잘못된 입력을 상류 API에 흘리지 않도록 경계에서 정리한다.
 */
export function parseCodeList(
  raw: string | null,
  valid: readonly number[],
): number[] {
  if (!raw) return [];
  const allowed = new Set(valid);
  const seen = new Set<number>();
  const out: number[] = [];
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (!Number.isInteger(n) || n <= 0) continue;
    if (!allowed.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export const parseAreaCodes = (raw: string | null): number[] =>
  parseCodeList(raw, ALL_AREA_CODES);

export const parseContentTypeIds = (raw: string | null): number[] =>
  parseCodeList(raw, ALL_CONTENT_TYPE_CODES);

/** 불리언 플래그 파싱 — 1·true·yes·on(대소문자·공백 무시)만 참. 나머지·null 은 거짓. */
export function parseBool(raw: string | null): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

// ─── 📍 주변에서 뽑기 앵커 좌표 (M14) ─────────────────────────────────
// 대한민국 대략 경계 — 이 범위를 벗어난 near= 는 조작·오류로 보고 무시(400).
const KOREA_LAT = { min: 33, max: 39 } as const; // 제주 남단 ~ 강원 북단
const KOREA_LNG = { min: 124, max: 132 } as const; // 서해 ~ 독도

/**
 * `?near=위도,경도` → {lat,lng}. 유한수 + 한국 대략 범위 안일 때만.
 * 형식 오류·범위 밖·null 은 모두 null(상류 위치 API에 쓰레기 좌표를 흘리지 않게 경계에서 차단).
 */
export function parseLatLng(
  raw: string | null,
): { lat: number; lng: number } | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0].trim());
  const lng = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < KOREA_LAT.min || lat > KOREA_LAT.max) return null;
  if (lng < KOREA_LNG.min || lng > KOREA_LNG.max) return null;
  return { lat, lng };
}

/** {lat,lng} → `near=위도,경도` 쿼리스트링(주변에서 뽑기 요청용). */
export function buildNearbyQuery(lat: number, lng: number): string {
  const p = new URLSearchParams();
  p.set("near", `${lat},${lng}`);
  return p.toString();
}

// ─── 🧭 반나절 코스 (M20, §7.10) ────────────────────────────────────

/**
 * 콤마 문자열 → contentId(숫자 문자열) 배열. 숫자 문자열만·중복 제거(첫 등장 순서)·상한 limit.
 * areaCode 처럼 화이트리스트가 없어(TourAPI contentId 는 임의 큰 정수) 형식(숫자)만 검증한다.
 * 코스 exclude 용 — 실요구 최대 4(앵커+3스텝)에 다슬롯 확장(§11.1) 여유로 기본 상한 12.
 */
export function parseContentIds(raw: string | null, limit = 12): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!/^\d+$/.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** 🧭 코스 요청 옵션 — slot(있으면 재뽑기)·exclude(앵커∪스텝)·📅 방문 시점. */
export interface CourseQueryOptions {
  slot?: "sight" | "meal" | "cafe";
  exclude?: Iterable<string>;
  /** 📅 선택된 기준일 YYYYMMDD. 미래만 방출(오늘/과거/null 은 생략, buildRandomQuery 동형). */
  dateYmd?: string | null;
  /** 비교 기준 오늘(YYYYMMDD). 기본 kstYmd() — 테스트·단일 시계 주입용. */
  todayYmd?: string;
}

/**
 * `/api/course` 쿼리스트링 — near(필수) + 선택 slot/exclude/date.
 * date 는 미래만 방출(buildRandomQuery 동형): 🍃 코스 헤더 배지 기준일만 바꾸고 코스 구성은 무변.
 */
export function buildCourseQuery(
  lat: number,
  lng: number,
  opts: CourseQueryOptions = {},
): string {
  const p = new URLSearchParams();
  p.set("near", `${lat},${lng}`);
  if (opts.slot) p.set("slot", opts.slot);
  const ex = opts.exclude ? [...opts.exclude] : [];
  if (ex.length > 0) p.set("exclude", ex.join(","));
  const today = opts.todayYmd ?? kstYmd();
  if (opts.dateYmd && opts.dateYmd > today) p.set("date", opts.dateYmd);
  return p.toString();
}

/** 🌊 바다·🦀 제철·🎪 축제·☔ 날씨·🍃 한적 같은 추가 조건 플래그 + 📅 방문 시점(§6.8) */
export interface RandomQueryOptions {
  seaside?: boolean;
  seasonal?: boolean;
  festival?: boolean;
  noRain?: boolean;
  quiet?: boolean;
  /** 📅 선택된 기준일 YYYYMMDD. null/오늘/과거는 생략(기준일=오늘과 동일, §6.8). 미래만 방출 */
  dateYmd?: string | null;
  /** 비교 기준 오늘(YYYYMMDD). 기본 kstYmd() — 테스트·단일 시계 주입용 */
  todayYmd?: string;
}

/**
 * 📅 요청 기준일 파싱 — 8자리·실존 날짜 + 범위 오늘 ≤ date ≤ 오늘+29(KST, 집중률 예측 창).
 * 범위·형식·실존 위반은 null(무시 — 경계 정리 관례). 라우트에서 요청당 단일 now 를 주입한다.
 */
export function parseDateYmd(raw: string | null, now: Date): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  // 실존 날짜 검증(예: 20260230 은 3/2로 롤오버 → 원값과 불일치로 걸러짐).
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  // 범위: 오늘 ≤ date ≤ 오늘+29(YYYYMMDD 사전순=날짜순).
  if (s < kstYmd(now) || s > ymdOffset(now, 29)) return null;
  return s;
}

/**
 * 모드·선택으로 /api/random 쿼리스트링을 만든다.
 * 순수 모드면 항상 "". 조건 모드에서 지역·테마·추가조건이 모두 없으면 "" — 즉
 * "조건 0개 = 완전 랜덤" 불변식(§2). 단 🌊·🦀 는 그 자체가 조건이라 파라미터가 생긴다.
 *
 * 📅 방문 시점(§6.8): dateYmd 가 미래(> 오늘)면 date 방출 + ☔ noRain 미방출(미래는 현재
 *   관측 불가 — 표시·전송·서버 일치). 오늘/과거/미선택은 생략(기준일=오늘과 동일 = 무변).
 */
export function buildRandomQuery(
  mode: "pure" | "filtered",
  areas: Iterable<number>,
  types: Iterable<number>,
  opts: RandomQueryOptions = {},
): string {
  if (mode !== "filtered") return "";
  const params = new URLSearchParams();
  const a = [...areas];
  const t = [...types];
  // 미래 기준일만 방출 — 과거(자정 통과 stale)·오늘은 '오늘 뽑기'와 동일해 생략.
  const today = opts.todayYmd ?? kstYmd();
  const future = !!opts.dateYmd && opts.dateYmd > today;

  if (a.length > 0) params.set("areas", a.join(","));
  // 🌊 바다면 타입이 관광지(12)로 고정돼 서버가 types 를 무시한다 → URL 에도 싣지 않아
  // 표시·전송·서버 동작을 일치시킨다(선택 state 는 보존돼 바다를 끄면 복원).
  if (t.length > 0 && !opts.seaside) params.set("types", t.join(","));
  if (opts.seaside) params.set("seaside", "1");
  if (opts.seasonal) params.set("seasonal", "1");
  if (opts.festival) params.set("festivalOnly", "1");
  // ☔ 는 오늘 전용 — 미래 기준일이면 미방출(선택 state 보존, 오늘 복귀 시 복원). count 경로도
  //   같은 buildRandomQuery 라 noRain 미방출 → dynamic 강등 없음.
  if (opts.noRain && !future) params.set("noRain", "1");
  if (opts.quiet) params.set("quiet", "1");
  if (future) params.set("date", opts.dateYmd!);
  return params.toString();
}

// ─── 🔭 빈 곳에서 뽑기 (M21, §7.11) ─────────────────────────────────
// buildRandomQuery 를 확장하지 않는 별도 빌더(buildNearbyQuery 전례) — pure 모드 "" 불변식 보존.
//   emptySpot 은 areas/types/특수조건과 배타적인 특수 모드라 조건 조합 빌더에 얹지 않는다.

/**
 * 🔭 `/api/random?emptySpot=1&exclude=<정렬 CSV>` 쿼리스트링.
 * exclude = 방문 정복한 시·군·구 통계청 code(들). 정렬 CSV 로 방출해 동일 방문집합→동일 URL
 *   →Next fetch·count 1h 캐시 히트(쿼리 결정성). 빈 exclude(방문 0)면 emptySpot=1 만.
 * date 는 1단계 UI 미배선(항상 오늘)이라 방출하지 않는다(§7.11 — 조건 패널 dateYmd 와
 *   소리 없이 결합 차단). 서버는 date 를 수용하나(§6.8 축 대칭) 배선은 백로그.
 */
export function buildEmptySpotQuery(excluded: Iterable<string>): string {
  const p = new URLSearchParams();
  p.set("emptySpot", "1");
  const ex = [...excluded].sort(); // 정렬 CSV = 쿼리 결정성(캐시 히트)
  if (ex.length > 0) p.set("exclude", ex.join(","));
  return p.toString();
}

/**
 * 🔭 exclude 파싱 — 통계청 시·군·구 code(문자열) 화이트리스트.
 * parseCodeList(숫자 기반)와 분리: 코드가 문자열이라 Number 강제·정수/양수 검사는 의미 파괴적.
 *   게이트는 오직 valid.has(trim된 문자열). 중복은 첫 등장 순서 유지(parse* 관례).
 * ⚠️ valid 는 파라미터로 받는다(라우트가 KOREA_SIGUNGU code 로 주입) — query.ts 가 koreaMap
 *   (~200KB)을 정적 import 하면 홈 초기 번들에 새어 §7.11 번들 분리 목표와 충돌하기 때문.
 */
export function parseSigunguCodes(
  raw: string | null,
  valid: ReadonlySet<string>,
): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim();
    if (!valid.has(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}
