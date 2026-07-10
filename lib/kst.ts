// 📅 KST 벽시계 날짜 헬퍼(M19, plan.md §6.8) — 서버 UTC 무관 Asia/Seoul 고정 날짜 산술.
//
// 중립 모듈로 분리한 이유: lib/congestion 을 직접 import 하면 클라 번들에 congestionCodes 대형
// 테이블이 딸려 오고(계층 역전), 범용 날짜 헬퍼가 도메인 모듈에 사는 게 부자연스럽다.
// lib/congestion 은 여기서 re-export 해 기존 소비처를 무변으로 유지한다.

const pad2 = (n: number) => String(n).padStart(2, "0");

/** now 의 Asia/Seoul 벽시계 연·월·일(서버 TZ 무관). */
export function kstDateParts(now: Date): { y: number; mo: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), mo: get("month"), d: get("day") };
}

/** KST 기준 오늘에서 days 만큼 offset 한 날짜 YYYYMMDD(음수=과거). 월·연 경계는 Date.UTC 산술로. */
export function ymdOffset(now: Date, days: number): string {
  const { y, mo, d } = kstDateParts(now);
  // KST 벽시계 날짜를 UTC 자정으로 담아 정수 산술만(절대시각 변환 아님).
  const dt = new Date(Date.UTC(y, mo - 1, d) + days * 86_400_000);
  return `${dt.getUTCFullYear()}${pad2(dt.getUTCMonth() + 1)}${pad2(dt.getUTCDate())}`;
}

/** 오늘(KST) YYYYMMDD — 판정 기준일. */
export function kstYmd(now: Date = new Date()): string {
  return ymdOffset(now, 0);
}

/** YYYYMMDD → 월(1-12). 형식은 호출부가 보장(parseDateYmd·dateChips 산출물). */
export function monthOf(ymd: string): number {
  return Number(ymd.slice(4, 6));
}

/**
 * YYYYMMDD → "M/D"(앞 0 제거). 형식 이상 시 원문 그대로.
 * ResultCard·CoursePanel·kakaoShare 공용 — M/D 포맷터 3중화 방지(M20 §7.10 승격).
 */
export function fmtYmd(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`;
}
