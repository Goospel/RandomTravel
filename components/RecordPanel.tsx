"use client";

import { useState, type KeyboardEvent } from "react";
import type { SavedPlace } from "@/lib/travelStore";
import { AREA_NAME } from "@/lib/constants";
import { kakaoMapLink } from "@/lib/mapLink";

type TabKey = "saved" | "recent" | "visited";

const TABS: { key: TabKey; label: string; emoji: string; empty: string }[] = [
  { key: "saved", label: "찜", emoji: "♥", empty: "아직 찜한 곳이 없어요." },
  { key: "recent", label: "최근", emoji: "🕘", empty: "최근 본 곳이 없어요." },
  { key: "visited", label: "다녀옴", emoji: "✔", empty: "다녀온 곳을 체크해 보세요." },
];

export function RecordPanel({
  saved,
  recent,
  visited,
  onRemove,
  onNavigate,
  onDrawNearby,
}: {
  saved: SavedPlace[];
  recent: SavedPlace[];
  visited: SavedPlace[];
  onRemove: (list: TabKey, contentId: string) => void;
  onNavigate: (p: SavedPlace) => void;
  /** 📍 이 장소를 거점으로 주변에서 뽑기 (좌표 있는 기록만) */
  onDrawNearby: (p: SavedPlace) => void;
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
    // 로빙 포커스: 새 활성 탭으로 포커스 이동. 세 탭은 항상 DOM에 있고
    // tabIndex=-1 이어도 프로그램적 focus 는 가능하므로 리렌더를 기다릴 필요 없이 즉시.
    document.getElementById(`rt-tab-${nextKey}`)?.focus();
  }

  return (
    <section className="w-full rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="sr-only">내 기록</h2>
      <div
        role="tablist"
        aria-label="내 기록"
        onKeyDown={onKeyDown}
        className="flex border-b border-zinc-200 dark:border-zinc-800"
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
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                selected
                  ? "border-b-2 border-indigo-600 text-indigo-700 dark:text-indigo-300"
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
          <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {activeMeta.empty}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {active.map((p) => (
              <PlaceRow
                key={p.contentId}
                place={p}
                onRemove={() => onRemove(tab, p.contentId)}
                onNavigate={() => onNavigate(p)}
                onDrawNearby={() => onDrawNearby(p)}
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
  onRemove,
  onNavigate,
  onDrawNearby,
}: {
  place: SavedPlace;
  onRemove: () => void;
  onNavigate: () => void;
  onDrawNearby: () => void;
}) {
  const areaName =
    place.areaCode != null ? AREA_NAME[place.areaCode] : undefined;
  const mapHref = kakaoMapLink(place.title, place.lat, place.lng);
  // 좌표가 있어야 반경 검색이 되므로, 좌표 없는 기록엔 주변 뽑기 버튼을 숨긴다.
  const canDrawNearby = place.lat != null && place.lng != null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="h-12 w-12 flex-none overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
        {place.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">
            🏞️
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{place.title}</p>
        {areaName && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{areaName}</p>
        )}
      </div>

      {canDrawNearby && (
        // 아이콘만이면 특히 모바일(hover 없음)에서 용도 전달이 어려워 글자 라벨을 붙인다.
        <button
          type="button"
          onClick={onDrawNearby}
          className="flex-none whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
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
          className="flex-none rounded-lg px-2 py-1 text-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
    </li>
  );
}
