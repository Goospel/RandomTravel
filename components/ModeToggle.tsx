"use client";

export type Mode = "pure" | "filtered";

const OPTIONS: { key: Mode; label: string }[] = [
  { key: "pure", label: "아무 데나" },
  { key: "filtered", label: "조건 걸고" },
];

/**
 * 캡슐 세그먼트 토글 — 눌린 트랙(surface-2) 위를 잉크색 캡슐 썸이 차지한다.
 * 활성만 700, 비활성 500(한 화면 두께 2종 규칙).
 */
export function segment(active: boolean): string {
  return `inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] leading-[1.2] ${
    active
      ? "bg-g-text font-bold text-g-on-primary"
      : "bg-transparent font-medium text-g-text-2 hover:text-g-text"
  }`;
}

/** 세그먼트 컨테이너 — 안쪽에 segment() 버튼들을 넣는다. */
export const segmentGroup =
  "flex w-full gap-1 rounded-full border border-g-border bg-g-surface-2 p-1";

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
