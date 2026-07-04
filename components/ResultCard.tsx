"use client";

import { useState } from "react";
import type { RandomResponse } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";
import { kakaoMapLink, kakaoRouteLink } from "@/lib/mapLink";

export function ResultCard({
  data,
  onRedraw,
  saved,
  visited,
  onToggleSave,
  onToggleVisit,
  onNavigate,
}: {
  data: RandomResponse;
  onRedraw: () => void;
  saved: boolean;
  visited: boolean;
  onToggleSave: () => void;
  onToggleVisit: () => void;
  onNavigate: () => void;
}) {
  const { place } = data;
  const [imgError, setImgError] = useState(false);

  // 정규화 결과가 비었으면 실제 뽑은 풀 값(picked)으로 폴백 → 배지가 사라지지 않게
  const areaCode = place.areaCode ?? data.picked.areaCode;
  const areaName = areaCode != null ? AREA_NAME[areaCode] : undefined;
  const typeName =
    CONTENT_TYPE_NAME[place.contentTypeId] ??
    CONTENT_TYPE_NAME[data.picked.contentTypeId];

  // 카카오맵 딥링크(§7.2) — 좌표 있으면 지도/길찾기, 없으면 이름 검색으로 폴백.
  const mapHref = kakaoMapLink(place.title, place.lat, place.lng);
  const routeHref = kakaoRouteLink(place.title, place.lat, place.lng);

  const showImage = place.image && !imgError;

  return (
    <article className="animate-card-reveal w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image!}
            alt={place.title}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">
            🏞️
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {areaName && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {areaName}
            </span>
          )}
          {typeName && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {typeName}
            </span>
          )}
          {data.picked.seaside && (
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              {data.picked.seaside.emoji} {data.picked.seaside.category}
            </span>
          )}
          {data.picked.seasonal && data.picked.seasonal.items.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              지금 제철{" "}
              {data.picked.seasonal.items
                .map((s) => `${s.emoji}${s.item}`)
                .join(" · ")}
            </span>
          )}
          {data.picked.festival && (
            <span className="rounded-full bg-fuchsia-50 px-2.5 py-1 text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300">
              🎪 {data.picked.festival.name}
              {data.picked.festival.more > 0 && ` 외 ${data.picked.festival.more}`}
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold leading-snug">{place.title}</h2>
        {place.address && (
          <p className="text-sm text-zinc-500">{place.address}</p>
        )}
        {place.overview && (
          <p className="line-clamp-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {place.overview}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              saved
                ? "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span aria-hidden>{saved ? "♥" : "♡"}</span>
            {saved ? "찜함" : "찜"}
          </button>
          <button
            type="button"
            onClick={onToggleVisit}
            aria-pressed={visited}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
              visited
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span aria-hidden>{visited ? "✔" : "➕"}</span>
            {visited ? "다녀옴" : "다녀왔어요"}
          </button>
        </div>

        <div className="mt-1 flex flex-col gap-2">
          <button
            type="button"
            onClick={onRedraw}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
          >
            🎲 다시 뽑기
          </button>
          {(mapHref || routeHref) && (
            <div className="flex gap-2">
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                  className="flex flex-1 items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  🗺️ 지도에서 보기
                </a>
              )}
              {routeHref && (
                <a
                  href={routeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                  className="flex flex-1 items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  🧭 길찾기
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
