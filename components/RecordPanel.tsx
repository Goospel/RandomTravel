"use client";

import { useState, type KeyboardEvent } from "react";
import type { SavedPlace, RevisitRating } from "@/lib/travelStore";
import { AREA_NAME, REVISIT_OPTIONS } from "@/lib/constants";
import { kakaoMapLink } from "@/lib/mapLink";

type TabKey = "saved" | "recent" | "visited";

// 📊 재방문 의향 평가(M15) — 선택된 칸 색(라이트/다크). 미선택은 muted zinc.
const RATING_SELECTED: Record<RevisitRating, string> = {
  1: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  2: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  3: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const TABS: {
  key: TabKey;
  label: string;
  emoji: string;
  emptyEmoji: string;
  empty: string;
}[] = [
  {
    key: "saved",
    label: "찜",
    emoji: "♥",
    emptyEmoji: "♡",
    empty: "마음에 든 곳의 하트를 누르면 여기 모여요.",
  },
  {
    key: "recent",
    label: "최근",
    emoji: "🕘",
    emptyEmoji: "🎲",
    empty: "위에서 한 곳 뽑으면 최근 본 곳이 쌓여요.",
  },
  {
    key: "visited",
    label: "다녀옴",
    emoji: "✔",
    emptyEmoji: "🧩",
    empty: "다녀온 곳을 체크하면 위 정복 지도가 채워져요.",
  },
];

export function RecordPanel({
  saved,
  recent,
  visited,
  onRemove,
  onNavigate,
  onDrawNearby,
  onRate,
}: {
  saved: SavedPlace[];
  recent: SavedPlace[];
  visited: SavedPlace[];
  onRemove: (list: TabKey, contentId: string) => void;
  onNavigate: (p: SavedPlace) => void;
  /** 📍 이 장소를 거점으로 주변에서 뽑기 (좌표 있는 기록만) */
  onDrawNearby: (p: SavedPlace) => void;
  /** 📊 재방문 의향 평가 설정 (다녀옴 탭에서만) */
  onRate: (p: SavedPlace, rating: RevisitRating | null) => void;
}) {
  const [tab, setTab] = useState<TabKey>("saved");
  const lists: Record<TabKey, SavedPlace[]> = { saved, recent, visited };
  const active = lists[tab];
  const activeMeta = TABS.find((t) => t.key === tab)!;
  const panelId = `rt-panel-${tab}`;
  const tabId = `rt-tab-${tab}`;

  // WAI-ARIA Tabs 키보드 이동 — 좌/우 화살표 + Home/End, 로빙 tabindex
  function onKeyDown(e: KeyboardEvent) {
    const i = TABS.findIndex((t) => t.key === tab);
    let ni = i;
    if (e.key === "ArrowRight") ni = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") ni = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") ni = 0;
    else if (e.key === "End") ni = TABS.length - 1;
    else return;
    e.preventDefault();
    const nextKey = TABS[ni].key;
    setTab(nextKey);
    document.getElementById(`rt-tab-${nextKey}`)?.focus();
  }

  return (
    <section className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="sr-only">내 기록</h2>
      <div
        role="tablist"
        aria-label="내 기록"
        onKeyDown={onKeyDown}
        className="flex border-b border-zinc-100 dark:border-zinc-800"
      >
        {TABS.map((t) => {
          const count = lists[t.key].length;
          const selected = t.key === tab;
          return (
            <button
              key={t.key}
              id={`rt-tab-${t.key}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`rt-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-3 py-3 text-sm font-bold transition-colors ${
                selected
                  ? "border-b-2 border-emerald-600 text-emerald-700 dark:text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <span aria-hidden>{t.emoji}</span> {t.label}
              {count > 0 && (
                <span className="ml-1 text-xs text-zinc-400">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
        {active.length === 0 ? (
          <div className="px-6 py-9 text-center text-zinc-400">
            <div className="mb-2 text-3xl" aria-hidden>
              {activeMeta.emptyEmoji}
            </div>
            <p className="text-sm leading-relaxed">{activeMeta.empty}</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {active.map((p) => (
              <PlaceRow
                key={p.contentId}
                place={p}
                showRating={tab === "visited"}
                onRemove={() => onRemove(tab, p.contentId)}
                onNavigate={() => onNavigate(p)}
                onDrawNearby={() => onDrawNearby(p)}
                onRate={(rating) => onRate(p, rating)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PlaceRow({
  place,
  showRating,
  onRemove,
  onNavigate,
  onDrawNearby,
  onRate,
}: {
  place: SavedPlace;
  showRating: boolean;
  onRemove: () => void;
  onNavigate: () => void;
  onDrawNearby: () => void;
  onRate: (rating: RevisitRating | null) => void;
}) {
  const areaName =
    place.areaCode != null ? AREA_NAME[place.areaCode] : undefined;
  const mapHref = kakaoMapLink(place.title, place.lat, place.lng);
  const canDrawNearby = place.lat != null && place.lng != null;
  const rating = place.rating ?? null;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-[46px] w-[46px] flex-none overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {place.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg">
              🏞️
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{place.title}</p>
          {areaName && (
            <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">{areaName}</p>
          )}
        </div>

        {canDrawNearby && (
          <button
            type="button"
            onClick={onDrawNearby}
            className="flex-none whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
            aria-label={`${place.title} 주변에서 뽑기`}
          >
            📍 주변 뽑기
          </button>
        )}
        {mapHref && (
          <a
            href={mapHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onNavigate}
            className="flex-none rounded-lg px-2 py-1 text-base transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label={`${place.title} 지도에서 보기`}
          >
            🗺️
          </a>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="flex-none rounded-lg px-2 py-1 text-sm text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
          aria-label={`${place.title} 목록에서 제거`}
        >
          ✕
        </button>
      </div>

      {showRating && (
        // 📊 재방문 의향 평가(M15) — 둘째 줄, 가로 3분할. 선택 칸 재클릭 시 해제(null).
        <div
          role="group"
          aria-label={`${place.title} 재방문 의향 평가`}
          className="mt-2.5 flex divide-x divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800"
        >
          {REVISIT_OPTIONS.map((opt) => {
            const selected = rating === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onRate(selected ? null : opt.value)}
                aria-pressed={selected}
                aria-label={`${place.title} — ${opt.full}`}
                className={`flex-1 px-1.5 py-2 text-xs font-semibold transition-colors ${
                  selected
                    ? RATING_SELECTED[opt.value]
                    : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <span aria-hidden>{opt.emoji}</span> {opt.short}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
