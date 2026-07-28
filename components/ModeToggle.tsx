"use client";

export type Mode = "pure" | "filtered";

const OPTIONS: { key: Mode; label: string }[] = [
  { key: "pure", label: "순수 랜덤" },
  { key: "filtered", label: "조건 랜덤" },
];

/**
 * Genesis 세그먼트 토글 — 활성 탭만 surface + border 로 떠 보이게.
 * ⚠️ `transition-colors` 금지: 다크 전환 시 Chromium 이 CSS 변수만 바뀐 color/background-color
 *    를 재계산하지 않아 값이 이전 테마에 붙는다(designGuide.md). hover 색은 `hover:` 유틸로.
 */
export function segment(active: boolean): string {
  return `inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-[14px] py-[9px] text-[13px] font-medium ${
    active
      ? "border-g-border bg-g-surface text-g-primary-text"
      : "border-transparent bg-transparent text-g-text-2 hover:text-g-text"
  }`;
}

/** 세그먼트 컨테이너 — 안쪽에 segment() 버튼들을 넣는다. */
export const segmentGroup =
  "flex w-full gap-1 rounded-lg border border-g-border bg-g-surface-2 p-1";

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="랜덤 모드 선택" className={segmentGroup}>
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={mode === o.key}
          onClick={() => onChange(o.key)}
          className={segment(mode === o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
