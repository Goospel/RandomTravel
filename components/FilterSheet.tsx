"use client";

// 🎫 조건 시트(M32, plan.md §7.21) — 탑승 조건이 사는 곳. 아래에서 올라오는 바텀시트.
//
//   조건을 고른 **그 자리에서 바로 굴린다**는 것이 이 시트의 존재 이유다: 인라인 패널 시절엔
//   조건을 다 고른 뒤 959px 을 스크롤해 올라가야 뽑기 버튼이 있었다.
//   껍데기만 담당하고 내용물(조건 칩·토글)은 children = FilterPanel 이 그린다.

import { useEffect } from "react";
import { Icon } from "@/components/icons";
import { CandidateBadge } from "@/components/CandidateBadge";
import type { CandidateCount } from "@/hooks/useCandidateCount";

export function FilterSheet({
  open,
  count,
  unit,
  canClear,
  onClear,
  onClose,
  onDraw,
  drawing,
  children,
}: {
  open: boolean;
  count: CandidateCount;
  unit?: string;
  /** 켜진 조건이 하나라도 있으면 초기화 버튼 노출(날짜·거주지 포함 — conditionSummary 기준) */
  canClear: boolean;
  onClear: () => void;
  onClose: () => void;
  onDraw: () => void;
  drawing: boolean;
  children: React.ReactNode;
}) {
  // 열려 있는 동안 뒤 화면 스크롤 잠금 + Esc 로 닫기. 훅은 항상 부르고 렌더만 갈린다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 스크림 — 누르면 닫힌다(모바일에서 가장 잦은 닫기 동작) */}
      <button
        type="button"
        aria-label="조건 닫기"
        onClick={onClose}
        className="absolute inset-0 bg-g-text/45"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-sheet-title"
        // 데스크톱에선 홈 열(max-w 720)과 같은 폭으로 — 안 묶으면 1440px 화면 전체로 퍼져
        // 조건 버튼 하나가 1000px 가까이 늘어났다.
        className="animate-fade-up relative mx-auto flex max-h-[88vh] w-full max-w-[720px] flex-col rounded-t-[20px] border-t border-g-border bg-g-surface shadow-lg sm:border-x"
      >
        <div className="flex justify-center pb-1 pt-2.5" aria-hidden>
          <span className="h-1 w-[38px] rounded-full bg-g-border-strong" />
        </div>

        <div className="flex items-center gap-2.5 px-[18px] pb-3 pt-1.5">
          <h2
            id="filter-sheet-title"
            className="flex flex-1 items-center gap-[7px] font-display text-[17px] font-bold leading-[1.3] tracking-[-0.02em]"
          >
            <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px] bg-g-primary-soft text-g-primary">
              <Icon name="start" size={13} />
            </span>
            탑승 조건
          </h2>
          <CandidateBadge count={count} unit={unit} />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-g-text-3 hover:bg-g-surface-2 hover:text-g-text-2"
          >
            <Icon name="close" size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-g-border bg-g-surface-3 px-[18px] py-4">
          {children}
        </div>

        {/* 고른 자리에서 바로 굴린다. 틴티드 섀도는 홈 주 CTA 전용이라 여기엔 없다(designGuide 모양표). */}
        <div className="flex items-center gap-3 border-t border-g-border bg-g-surface px-[18px] pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {canClear && (
            <button
              type="button"
              onClick={onClear}
              className="flex-none text-[12px] text-g-text-3 underline underline-offset-2 hover:text-g-primary"
            >
              선택 초기화
            </button>
          )}
          <button
            type="button"
            onClick={onDraw}
            disabled={drawing}
            className="inline-flex h-[52px] flex-1 items-center justify-center gap-2.5 rounded-[18px] bg-g-accent text-[15px] font-bold tracking-[-0.01em] text-g-on-accent [corner-shape:squircle] hover:bg-g-accent-hover disabled:cursor-default disabled:opacity-60"
          >
            <Icon name="dice" size={18} />
            이 조건으로 굴리기
          </button>
        </div>
      </section>
    </div>
  );
}
