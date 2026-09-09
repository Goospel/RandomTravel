"use client";

// 🎫 조건 요약 한 줄(M32, plan.md §7.21) — 티켓 카드 안에서 조건 패널이 차지하던 자리.
//
//   옛 구성은 [아무 데나 | 조건 걸고] 세그먼트 + 펼쳐지는 인라인 패널이었다. 패널이 959px 이라
//   조건을 고르고 나면 주 CTA 가 첫 화면 밖(613 → 1,572px)으로 밀렸다 — 조건을 다 고른 뒤
//   굴리려고 화면을 두 번 넘게 올려야 했다. 이 줄은 **상태를 말하고 시트를 여는** 일만 한다.
//
//   모드 개념은 사라졌다: "조건 0개 = 완전 랜덤"(§2)이 이미 불변식이라, 켜진 조건이 없으면
//   그 자체로 '아무 데나'다. 별도 모드 상태를 두면 '조건 걸고인데 조건 0개' 같은
//   표시와 전송이 어긋나는 칸이 생긴다.

import { Icon } from "@/components/icons";
import { CandidateBadge } from "@/components/CandidateBadge";
import type { CandidateCount } from "@/hooks/useCandidateCount";

export function ConditionBar({
  summary,
  count,
  unit,
  onOpen,
  disabled,
}: {
  /** conditionSummary() 산출물 — 빈 배열이면 '아무 데나' */
  summary: string[];
  count: CandidateCount;
  unit?: string;
  onOpen: () => void;
  disabled: boolean;
}) {
  const on = summary.length > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled}
      aria-haspopup="dialog"
      className="flex h-[46px] w-full items-center gap-2.5 rounded-2xl border border-g-border bg-g-surface-3 py-0 pl-3 pr-2.5 text-left [corner-shape:squircle] hover:border-g-primary disabled:cursor-default disabled:opacity-60"
    >
      <span className="inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg bg-g-primary-soft text-g-primary">
        <Icon name="start" size={14} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold leading-[1.3]">
          {on ? `조건 ${summary.length}개` : "아무 데나"}
        </span>
        <span className="mt-[2px] block truncate text-[11px] font-medium leading-[1.3] text-g-text-3">
          {on ? summary.join(" · ") : "전국 · 모든 테마"}
        </span>
      </span>

      <CandidateBadge count={count} unit={unit} />
      <Icon name="arrowRight" size={15} className="flex-none text-g-text-3" />
    </button>
  );
}
