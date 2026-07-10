// 📅 방문 시점 날짜 칩(M19, plan.md §6.8) — 오늘/내일/이번·다음 주말(토)의 기준일 계산(순수).
//
// 요일 기준 정의: 오늘이 토·일이면 '이번 주말' = 오늘(→ ymd 중복으로 자연 생략), 그 외엔
//   다가오는 토요일. '다음 주말' = 그다음 토요일(일요일에 '다가오는 토'=6일 뒤가 '다음 주말'과
//   충돌하는 파탄 방지). 라벨을 "(토)"로 정직 표기 — 토·일 합집합 판정은 §11.1 백로그.
// 중복 ymd 칩은 생략(개수 가변 3~4개). 선택 상태는 ymd 로 저장하고 렌더마다 이 칩과 조인한다.

import { kstDateParts, ymdOffset } from "@/lib/kst";

export interface DateChip {
  key: "today" | "tomorrow" | "thisWeekend" | "nextWeekend";
  label: string;
  ymd: string; // YYYYMMDD
}

/** now(KST) 기준 방문 시점 칩 목록. 중복 ymd 는 첫 등장만 남긴다(3~4개). */
export function dateChips(now: Date = new Date()): DateChip[] {
  const { y, mo, d } = kstDateParts(now);
  // 그 KST 날짜의 요일(0=일 … 6=토) — UTC 자정에 담아 getUTCDay 로 읽는다.
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();

  // 이번 주말(토): 토·일이면 오늘(0), 그 외엔 다가오는 토요일까지(6-dow).
  const thisWk = dow === 0 || dow === 6 ? 0 : 6 - dow;
  // 다음 주말(토): 일요일=다가오는 토(6일 뒤), 토요일=다음 토(7), 평일=이번 토 다음 토.
  const nextWk = dow === 0 ? 6 : dow === 6 ? 7 : 6 - dow + 7;

  const raw: DateChip[] = [
    { key: "today", label: "오늘", ymd: ymdOffset(now, 0) },
    { key: "tomorrow", label: "내일", ymd: ymdOffset(now, 1) },
    { key: "thisWeekend", label: "이번 주말(토)", ymd: ymdOffset(now, thisWk) },
    { key: "nextWeekend", label: "다음 주말(토)", ymd: ymdOffset(now, nextWk) },
  ];

  const seen = new Set<string>();
  return raw.filter((c) => {
    if (seen.has(c.ymd)) return false; // 중복 ymd(금=내일/토, 토·일=오늘/이번 주말) 생략
    seen.add(c.ymd);
    return true;
  });
}
