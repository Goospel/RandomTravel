"use client";

import { AREA_CODES, CONTENT_TYPES } from "@/lib/constants";

// 뽑는 중 연출 — 슬롯머신 2릴(지역·테마)을 로컬 상수만으로 회전시킨다.
// ⚠️ 추가 API 호출 없음(§5.6 호출 예산): 실제 뽑기는 서버에서 1건만 하고,
//    여기서 도는 이름들은 그냥 시각적 기대감용 더미다.
const REGIONS = AREA_CODES.map((a) => a.name);
const THEMES = CONTENT_TYPES.map((c) => c.name);

function Reel({ items, duration }: { items: string[]; duration: string }) {
  // 리스트를 2번 이어 붙여 -50%까지 밀면 이음새 없이 무한 반복된다.
  const doubled = [...items, ...items];
  return (
    <div className="relative h-16 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="animate-slot-spin" style={{ animationDuration: duration }}>
        {doubled.map((label, i) => (
          <div
            key={i}
            className="flex h-16 items-center justify-center text-lg font-bold text-zinc-800 dark:text-zinc-100"
          >
            {label}
          </div>
        ))}
      </div>
      {/* 위·아래 페이드로 릴 창 느낌 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-zinc-900 dark:to-zinc-900" />
    </div>
  );
}

export function SlotMachine() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
    >
      <div className="flex gap-3">
        <Reel items={REGIONS} duration="0.5s" />
        <Reel items={THEMES} duration="0.72s" />
      </div>
      <p className="mt-3 text-center text-sm font-medium text-zinc-500">
        🎰 여행지를 뽑는 중…
      </p>
    </div>
  );
}
