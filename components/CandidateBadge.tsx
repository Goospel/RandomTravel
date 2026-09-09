"use client";

// 🔢 실시간 후보 수 배지(M16) — 조건이 얼마나 넓은지 투명하게 보여준다.
//
// M32 에서 FilterPanel 안에서 꺼내 **표시 전용**으로 바꿨다: 조건 요약 줄(ConditionBar)과
// 조건 시트(FilterSheet) 두 곳이 같은 숫자를 보여야 하는데, 각자 useCandidateCount 를 부르면
// 같은 URL 을 두 번 긁는다. 조회는 소유자인 app/page.tsx 가 한 번만 하고 값을 내려준다.

import type { CandidateCount } from "@/hooks/useCandidateCount";

/**
 * unit: 🏠 거주지 반경은 서버가 **동네 수**를 센다(🔭 와 같은 단위) — "곳"이라고 쓰면
 *   관광지 수로 읽혀 거짓말이 된다(§7.17E).
 */
export function CandidateBadge({
  count,
  unit = "곳",
}: {
  count: CandidateCount;
  unit?: string;
}) {
  const pill =
    "whitespace-nowrap rounded-full px-2.5 py-[5px] text-[12px] font-bold leading-[1.3]";
  const neutral = `${pill} border border-g-primary-soft-border bg-[#f2faf9] text-g-primary`;

  if (count.status === "loading") {
    return (
      <span aria-live="polite" className={neutral}>
        후보 세는 중…
      </span>
    );
  }
  if (count.status === "dynamic") {
    return (
      <span aria-live="polite" className={neutral}>
        조건에 맞는 곳에서
      </span>
    );
  }
  if (count.totalCount === 0) {
    return (
      <span
        aria-live="polite"
        className={`${pill} bg-g-warning-soft text-g-warning-text`}
      >
        조건이 좁아요 · 0{unit}
      </span>
    );
  }
  return (
    <span aria-live="polite" className={neutral}>
      ≈ {count.totalCount.toLocaleString("ko-KR")}
      {unit}
      {count.approx ? "+" : ""} 후보
    </span>
  );
}
