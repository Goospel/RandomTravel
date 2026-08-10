// 쿼리 파라미터 파싱·조립 — 순수 함수 (테스트 대상, plan.md §8)

import {
  ALL_AREA_CODES,
  ALL_CONTENT_TYPE_CODES,
  HOME_RANGE_VALUES,
} from "@/lib/constants";
import { kstYmd, ymdOffset } from "@/lib/kst";
import { isKoreaCoord } from "@/lib/geo";

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
// 경계 판정은 lib/geo 의 isKoreaCoord 단일 출처 — 벗어난 near= 는 조작·오류로 보고 무시(400).

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
  if (!isKoreaCoord(lat, lng)) return null;
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
  /** 🐕 반려동물 동반(§6.11) — 대상 축. 1단계 전국 전용이라 지역·테마를 함께 방출하지 않는다. */
  pet?: boolean;
  /** ♿ 무장애 여행지(§6.11) — 대상 축. 지역·테마·지역 풀 필터와 그대로 AND 조합. */
  barrierFree?: boolean;
  seasonal?: boolean;
  festival?: boolean;
  noRain?: boolean;
  quiet?: boolean;
  /**
   * ⚖️ 분산 모드(§6.9B) — 방문자 적은 시·도 가중. 기본 OFF.
   *
   * ⚠️ 이건 **필터가 아니라 분포 축**이라 후보 풀을 안 바꾼다 → 후보 수 쿼리에는 넣지 않는다
   * (FilterPanel 의 countQuery 는 이 옵션을 전달하지 않음). "뽑기·count 쿼리 일치" 관례의
   * 첫 의도적 예외 — 넣으면 같은 풀에 대해 count URL 만 갈라져 캐시가 무의미하게 쪼개진다.
   */
  scatter?: boolean;
  /**
   * 🏠 거주지 반경(§7.17) — 켜지면 **이 축만** 방출한다(🍃 한적 제외).
   * 뽑기 경로가 시·군·구 셀 단위로 갈라져 지역·테마·나머지 조건과 같은 파이프라인에 얹히지 않는다.
   */
  home?: HomeRange | null;
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

  // 🏠 거주지 반경(§7.17) — 켜지면 여기서 끝난다. 뽑기가 시·군·구 셀 경로(drawFromHome)로
  //   갈라지므로 지역·테마·나머지 조건은 서버가 어차피 안 본다 → URL 에도 싣지 않아
  //   "표시·전송·서버 동작 일치"를 지킨다(🐕 가 지역·테마를 빼는 것과 같은 관례).
  //   🍃 한적만 예외로 함께 실린다 — 유일하게 조합 가능한 조건(§7.17E).
  if (opts.home) {
    params.set("fromHome", opts.home.code);
    params.set("within", String(opts.home.km));
    if (opts.quiet) params.set("quiet", "1");
    return params.toString();
  }

  const a = [...areas];
  const t = [...types];
  // 미래 기준일만 방출 — 과거(자정 통과 stale)·오늘은 '오늘 뽑기'와 동일해 생략.
  const today = opts.todayYmd ?? kstYmd();
  const future = !!opts.dateYmd && opts.dateYmd > today;

  // 대상 축(🌊·🐕·♿)은 동시 1개(§6.11) — UI 잠금이 보장하지만 빌더도 스스로 강제해
  // "표시·전송·서버 동작 일치"를 지킨다. 우선순위는 기존 동작 보존 순(🌊 > 🐕 > ♿).
  const target = opts.seaside
    ? "seaside"
    : opts.pet
      ? "pet"
      : opts.barrierFree
        ? "barrierFree"
        : null;

  // 🐕 는 상류(detailPetTour2)가 지역·타입 필터를 안 받아 전국 전용 — 지역도 싣지 않는다.
  if (a.length > 0 && target !== "pet") params.set("areas", a.join(","));
  // 🌊 바다면 타입이 관광지(12)로 고정돼 서버가 types 를 무시한다 → URL 에도 싣지 않아
  // 표시·전송·서버 동작을 일치시킨다(선택 state 는 보존돼 바다를 끄면 복원). 🐕 도 같은 이유.
  if (t.length > 0 && target !== "seaside" && target !== "pet")
    params.set("types", t.join(","));
  if (target) params.set(target, "1"); // 축 이름 = 파라미터 이름
  if (opts.seasonal) params.set("seasonal", "1");
  if (opts.festival) params.set("festivalOnly", "1");
  // ☔ 는 오늘 전용 — 미래 기준일이면 미방출(선택 state 보존, 오늘 복귀 시 복원). count 경로도
  //   같은 buildRandomQuery 라 noRain 미방출 → dynamic 강등 없음.
  if (opts.noRain && !future) params.set("noRain", "1");
  if (opts.quiet) params.set("quiet", "1");
  // ⚖️ 는 대상 축 경로(🌊·🐕·♿)에 미적용(§6.9B·§6.11 1단계) → 축이 켜지면 미방출.
  //   types 를 🌊 에서 빼는 것과 같은 관례(표시·전송·서버 동작 일치).
  if (opts.scatter && !target) params.set("scatter", "1");
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

// ─── 🍃 오늘 한적 TOP5 (M27, §7.16) ─────────────────────────────────

/**
 * 🍃 `only=<통계청 5자리 1개>` — TOP5 칩의 원샷 뽑기 대상(§7.16A).
 * 유효 코드가 **정확히 1개**일 때만 채택하고, 복수·무효·없음은 null = 무시(일반 뽑기로
 *   흘려보낸다 — 400 아님, 경계 정리 관례). 파싱 자체는 parseSigunguCodes 재사용.
 * ⚠️ 대응 빌더는 없다 — `?only=<code>` 한 조각이라 호출부가 직접 만든다(§7.16 구현 결정).
 */
export function parseOnlySigungu(
  raw: string | null,
  valid: ReadonlySet<string>,
): string | null {
  const codes = parseSigunguCodes(raw, valid);
  return codes.length === 1 ? codes[0] : null;
}

// ─── 🏠 집에서 갈 만한 곳 (M28, §7.17) ──────────────────────────────

/** 🏠 거주지 반경 조건 — 거주지 시·군·구(통계청 code) + 거리 밴드(km). */
export interface HomeRange {
  code: string;
  km: number;
}

/**
 * 🏠 `?fromHome=<통계청 5자리>&within=<프리셋 km>` → {code, km}. 둘 다 유효할 때만.
 * - code 판정은 `parseOnlySigungu` 재사용(정확히 1개·화이트리스트) — 복수·무효는 null.
 * - km 은 **프리셋 값만**(HOME_RANGE_VALUES) 받는다. 임의 km 을 허용하면 같은 풀에 대해
 *   fetch·count 캐시 URL 이 무한히 쪼개지고, 검증도 범위 검사로 늘어난다.
 * - null = 조건 없음(400 아님 — 경계 정리 관례). 거주지만 있고 밴드가 없으면 필터가 성립하지 않는다.
 */
export function parseHomeRange(
  codeRaw: string | null,
  withinRaw: string | null,
  valid: ReadonlySet<string>,
): HomeRange | null {
  const code = parseOnlySigungu(codeRaw, valid);
  if (!code || !withinRaw) return null;
  const km = Number(withinRaw.trim());
  if (!HOME_RANGE_VALUES.includes(km)) return null;
  return { code, km };
}

/** 시연 딥링크로 초기 ON 할 수 있는 토글 — 화이트리스트(§7.16C). */
const DEEPLINK_TOGGLES = ["quiet", "scatter"] as const;
export type DeeplinkToggle = (typeof DEEPLINK_TOGGLES)[number];

/**
 * 🍃⚖️ 시연 딥링크(§7.16C) — 홈 도착 URL 의 `?quiet=1&scatter=1` → 초기 ON 토글 집합.
 * 화이트리스트 밖(대상 축 3종·지역·테마 등)은 전부 무시 — 대상 축은 상호배타 로직이 있어
 *   URL 로 켜면 표시·전송 일치가 깨진다(§6.11). 값 판정은 parseBool 관례 그대로.
 * 서버 동작 무변 — 도착 시 클라 토글 상태만 바꾼다.
 */
export function initialTogglesFromUrl(search: string): Set<DeeplinkToggle> {
  const sp = new URLSearchParams(search);
  const out = new Set<DeeplinkToggle>();
  for (const k of DEEPLINK_TOGGLES) if (parseBool(sp.get(k))) out.add(k);
  return out;
}
