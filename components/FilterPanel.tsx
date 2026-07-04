"use client";

import { AREA_CODES, CONTENT_TYPES } from "@/lib/constants";

function chip(on: boolean): string {
  return `rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
    on
      ? "border-indigo-600 bg-indigo-600 text-white"
      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  }`;
}

/** 추가 조건 토글 1개 (🌊·🦀) */
function ExtraToggle({
  on,
  onToggle,
  emoji,
  label,
  desc,
}: {
  on: boolean;
  onToggle: () => void;
  emoji: string;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className={`flex flex-1 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        on
          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      <span className="text-sm font-semibold">
        {emoji} {label}
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>
    </button>
  );
}

export function FilterPanel({
  selectedAreas,
  selectedTypes,
  seaside,
  seasonal,
  festival,
  onToggleArea,
  onToggleType,
  onToggleSeaside,
  onToggleSeasonal,
  onToggleFestival,
  onClear,
}: {
  selectedAreas: Set<number>;
  selectedTypes: Set<number>;
  seaside: boolean;
  seasonal: boolean;
  festival: boolean;
  onToggleArea: (code: number) => void;
  onToggleType: (code: number) => void;
  onToggleSeaside: () => void;
  onToggleSeasonal: () => void;
  onToggleFestival: () => void;
  onClear: () => void;
}) {
  const hasAny =
    selectedAreas.size > 0 ||
    selectedTypes.size > 0 ||
    seaside ||
    seasonal ||
    festival;

  return (
    <div className="flex w-full flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 id="filter-area-label" className="text-sm font-semibold">
            지역
          </h3>
          <span aria-live="polite" className="text-xs text-zinc-400">
            {selectedAreas.size > 0 ? `${selectedAreas.size}곳 선택` : "전체"}
          </span>
        </div>
        <div
          role="group"
          aria-labelledby="filter-area-label"
          className="grid grid-cols-4 gap-1.5 sm:grid-cols-5"
        >
          {AREA_CODES.map((a) => (
            <button
              key={a.code}
              type="button"
              onClick={() => onToggleArea(a.code)}
              aria-pressed={selectedAreas.has(a.code)}
              className={chip(selectedAreas.has(a.code))}
            >
              {a.name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 id="filter-type-label" className="text-sm font-semibold">
            테마
          </h3>
          <span aria-live="polite" className="text-xs text-zinc-400">
            {seaside
              ? "관광지 고정"
              : selectedTypes.size > 0
                ? `${selectedTypes.size}종 선택`
                : "전체"}
          </span>
        </div>
        <div
          role="group"
          aria-labelledby="filter-type-label"
          className="flex flex-wrap gap-1.5"
        >
          {CONTENT_TYPES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => onToggleType(c.code)}
              // 바다 ON이면 테마가 무시되므로 '눌림'을 보고하지 않는다(안내문과 일치).
              // undefined면 aria-pressed 속성 자체가 빠져 '토글 아님'으로 읽힌다.
              aria-pressed={seaside ? undefined : selectedTypes.has(c.code)}
              disabled={seaside}
              className={`${chip(!seaside && selectedTypes.has(c.code))} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {seaside && (
          <p className="text-xs text-sky-600 dark:text-sky-400">
            🌊 바다를 켜면 테마는 관광지로 고정돼요.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">추가 조건</h3>
        <div className="grid grid-cols-2 gap-2">
          <ExtraToggle
            on={seaside}
            onToggle={onToggleSeaside}
            emoji="🌊"
            label="바다"
            desc="해수욕장·섬·항구·해안"
          />
          <ExtraToggle
            on={seasonal}
            onToggle={onToggleSeasonal}
            emoji="🦀"
            label="제철 산지"
            desc="이번 달 제철 재료 산지"
          />
          <ExtraToggle
            on={festival}
            onToggle={onToggleFestival}
            emoji="🎪"
            label="축제 중"
            desc="오늘 진행 중인 축제"
          />
        </div>
      </section>

      <div className="text-xs text-zinc-400">
        {hasAny ? (
          <button
            type="button"
            onClick={onClear}
            className="underline underline-offset-2 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            선택 초기화
          </button>
        ) : (
          "아무것도 안 고르면 전국·모든 테마에서 완전 랜덤"
        )}
      </div>
    </div>
  );
}
