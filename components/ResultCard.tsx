"use client";

import type { RandomResponse } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";

export function ResultCard({
  data,
  onRedraw,
}: {
  data: RandomResponse;
  onRedraw: () => void;
}) {
  const { place } = data;
  // 정규화 결과가 비었으면 실제 뽑은 풀 값(picked)으로 폴백 → 배지가 사라지지 않게
  const areaCode = place.areaCode ?? data.picked.areaCode;
  const areaName = areaCode != null ? AREA_NAME[areaCode] : undefined;
  const typeName =
    CONTENT_TYPE_NAME[place.contentTypeId] ??
    CONTENT_TYPE_NAME[data.picked.contentTypeId];
  const mapHref =
    place.lat != null && place.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
      : null;

  return (
    <article className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800">
        {place.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image}
            alt={place.title}
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

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={onRedraw}
            className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            🎲 다시 뽑기
          </button>
          {mapHref && (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              지도에서 보기
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
