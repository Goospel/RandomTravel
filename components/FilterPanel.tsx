"use client";

import { AREA_CODES, CONTENT_TYPES } from "@/lib/constants";
import { buildRandomQuery } from "@/lib/query";
import { useCandidateCount } from "@/hooks/useCandidateCount";

// 🎯 조건 패널(M16 탐험 로그) — emerald pill 칩 + 실시간 후보 수 배지 + 바다 잠금 인라인 설명.
//   후보 수는 조건이 바뀔 때마다 /api/random/count 로 근사 집계(동적 조건은 정성 라벨).

function chip(on: boolean): string {
  return `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
    on
      ? "border-emerald-600 bg-emerald-600 text-white"
      : "border-zinc-200 bg-white text-zinc-600 hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
  }`;
}

/** 실시간 후보 수 배지 — 조건이 얼마나 넓은지 투명하게 보여준다. */
function CandidateBadge({ query }: { query: string }) {
  const count = useCandidateCount(query);
  const pill = "rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap";

  if (count.status === "loading") {
    return (
      <span
        aria-live="polite"
        className={`${pill} bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500`}
      >
        후보 세는 중…
      </span>
    );
  }
  if (count.status === "dynamic") {
    return (
      <span
        aria-live="polite"
        className={`${pill} bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`}
      >
        조건에 맞는 곳에서
      </span>
    );
  }
  // count
  if (count.totalCount === 0) {
    return (
      <span
        aria-live="polite"
        className={`${pill} bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300`}
      >
        조건이 좁아요 · 0곳
      </span>
    );
  }
  return (
    <span
      aria-live="polite"
      className={`${pill} bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`}
    >
      ≈ {count.totalCount.toLocaleString("ko-KR")}곳{count.approx ? "+" : ""} 후보
    </span>
  );
}

/** 추가 조건 토글 1개 (🌊·🦀·🎪·☔) */
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
      className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        on
          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
          : "border-zinc-200 bg-white hover:border-emerald-300 dark:border-zinc-700 dark:bg-zinc-900"
      }`}
    >
      <span className="text-sm font-bold">
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
  noRain,
  onToggleArea,
  onToggleType,
  onToggleSeaside,
  onToggleSeasonal,
  onToggleFestival,
  onToggleNoRain,
  onClear,
}: {
  selectedAreas: Set<number>;
  selectedTypes: Set<number>;
  seaside: boolean;
  seasonal: boolean;
  festival: boolean;
  noRain: boolean;
  onToggleArea: (code: number) => void;
  onToggleType: (code: number) => void;
  onToggleSeaside: () => void;
  onToggleSeasonal: () => void;
  onToggleFestival: () => void;
  onToggleNoRain: () => void;
  onClear: () => void;
}) {
  const hasAny =
    selectedAreas.size > 0 ||
    selectedTypes.size > 0 ||
    seaside ||
    seasonal ||
    festival ||
    noRain;

  // 후보 수 조회용 쿼리 — 뽑기와 같은 파라미터(buildRandomQuery)를 재사용해 서버와 일치.
  const countQuery = buildRandomQuery("filtered", selectedAreas, selectedTypes, {
    seaside,
    seasonal,
    festival,
    noRain,
  });

  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold">조건 고르기</span>
        <CandidateBadge query={countQuery} />
      </div>

      <section className="flex flex-col gap-2">
        <h3
          id="filter-area-label"
          className="text-xs font-bold text-zinc-500 dark:text-zinc-400"
        >
          지역
        </h3>
        <div
          role="group"
          aria-labelledby="filter-area-label"
          className="flex flex-wrap gap-1.5"
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
        <h3
          id="filter-type-label"
          className="text-xs font-bold text-zinc-500 dark:text-zinc-400"
        >
          테마
        </h3>
        <div
          role="group"
          aria-labelledby="filter-type-label"
          className="flex flex-wrap gap-1.5"
        >
          {CONTENT_TYPES.map((c) => {
            const on = !seaside && selectedTypes.has(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => onToggleType(c.code)}
                // 바다 ON이면 테마가 무시되므로 '눌림'을 보고하지 않는다(안내문과 일치).
                aria-pressed={seaside ? undefined : selectedTypes.has(c.code)}
                disabled={seaside}
                className={
                  seaside
                    ? "cursor-not-allowed whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-600"
                    : chip(on)
                }
              >
                {c.name}
                {seaside ? " 🔒" : ""}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
          추가 조건
        </h3>
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
          <ExtraToggle
            on={noRain}
            onToggle={onToggleNoRain}
            emoji="☔"
            label="비 안 오는 곳"
            desc="지금 비 안 오는 지역"
          />
        </div>
      </section>

      {seaside && (
        <div className="flex gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <span aria-hidden>🔒</span>
          <span>
            바다를 켜면 테마는 <b>관광지로 고정</b>돼요 — 그래서 다른 테마 칸이
            잠겼어요.
          </span>
        </div>
      )}

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
