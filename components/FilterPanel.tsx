"use client";

import { AREA_CODES, CONTENT_TYPES } from "@/lib/constants";

function chip(on: boolean): string {
  return `rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
    on
      ? "border-indigo-600 bg-indigo-600 text-white"
      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  }`;
}

export function FilterPanel({
  selectedAreas,
  selectedTypes,
  onToggleArea,
  onToggleType,
  onClear,
}: {
  selectedAreas: Set<number>;
  selectedTypes: Set<number>;
  onToggleArea: (code: number) => void;
  onToggleType: (code: number) => void;
  onClear: () => void;
}) {
  const hasAny = selectedAreas.size > 0 || selectedTypes.size > 0;

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
            {selectedTypes.size > 0 ? `${selectedTypes.size}종 선택` : "전체"}
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
              aria-pressed={selectedTypes.has(c.code)}
              className={chip(selectedTypes.has(c.code))}
            >
              {c.name}
            </button>
          ))}
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
