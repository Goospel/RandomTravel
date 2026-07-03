"use client";

import { useState } from "react";
import type { RandomResponse } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";
import { kakaoMapLink, kakaoRouteLink } from "@/lib/mapLink";

export function ResultCard({
  data,
  onRedraw,
}: {
  data: RandomResponse;
  onRedraw: () => void;
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

        <div className="mt-2 flex flex-col gap-2">
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
