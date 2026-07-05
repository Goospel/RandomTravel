"use client";

import { useState } from "react";
import type { RandomResponse } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";
import { kakaoMapLink, kakaoRouteLink } from "@/lib/mapLink";
import { useKakaoShare } from "@/hooks/useKakaoShare";
import { shareText } from "@/lib/kakaoShare";
import { formatKm } from "@/lib/geo";

export function ResultCard({
  data,
  onRedraw,
  onDrawNearby,
  anchorTitle,
  saved,
  visited,
  onToggleSave,
  onToggleVisit,
  onNavigate,
}: {
  data: RandomResponse;
  onRedraw: () => void;
  /** 📍 첫 여행지 주변에서 뽑기(M14) — 순수 모드+앵커 좌표 있을 때만 전달, 아니면 null */
  onDrawNearby: (() => void) | null;
  /** 주변 뽑기 기준점(첫 여행지) 이름 — 버튼·거리 배지 라벨용 */
  anchorTitle: string | null;
  saved: boolean;
  visited: boolean;
  onToggleSave: () => void;
  onToggleVisit: () => void;
  onNavigate: () => void;
}) {
  const { place } = data;
  // 📍 주변에서 뽑기로 나온 결과면 앵커에서의 거리(m)가 실려온다.
  const distanceM = data.picked.distanceM;
  const [imgError, setImgError] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const { share } = useKakaoShare();

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

  // 안내 문구를 잠깐 띄웠다 지운다.
  function flash(msg: string | null) {
    setShareMsg(msg);
    if (msg) window.setTimeout(() => setShareMsg(null), 2200);
  }

  // 💬 카톡 공유(M13) — 카카오 피드 카드, 실패 시 Web Share/클립보드 폴백.
  async function onShare() {
    const origin = window.location.origin;
    const result = await share(place, {
      appUrl: origin,
      mapUrl: mapHref,
      fallbackImage: `${origin}/icon-512.png`,
    });
    if (result === "copied") flash("링크가 복사됐어요 ✓");
    else if (result === "failed") flash("공유를 열 수 없었어요.");
    else flash(null); // kakao/shared — 팝업·공유시트가 뜸
  }

  // 🔗 링크 복사 — 카톡 웹 공유가 카카오 계정 문제로 실패해도(우리가 감지 못 함)
  // 항상 되는 탈출구. 클립보드 우선, 안 되면 Web Share(모바일)로 폴백.
  async function onCopyLink() {
    const text = shareText(place, window.location.origin);
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        flash("링크가 복사됐어요 ✓ — 카톡에 붙여넣어 보내세요");
        return;
      } catch {
        /* 다음 폴백 */
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return; // 공유시트가 뜸
      } catch {
        flash("공유를 열 수 없었어요.");
        return;
      }
    }
    flash("이 브라우저에선 복사를 지원하지 않아요.");
  }

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
            <span
              title={data.picked.festival.name}
              className="inline-block max-w-[15rem] truncate rounded-full bg-fuchsia-50 px-2.5 py-1 align-bottom text-xs font-medium text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300"
            >
              🎪 {data.picked.festival.name}
              {data.picked.festival.more > 0 && ` 외 ${data.picked.festival.more}`}
            </span>
          )}
          {data.picked.weather && (
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              ☀️ 지금 비 안 와요
              {data.picked.weather.temp != null &&
                ` · ${Math.round(data.picked.weather.temp)}℃`}
            </span>
          )}
          {distanceM != null && (
            <span
              title={anchorTitle ?? undefined}
              className="inline-block max-w-[15rem] truncate rounded-full bg-indigo-50 px-2.5 py-1 align-bottom text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              📍 {anchorTitle ? `${anchorTitle}에서 ` : "주변 "}
              {formatKm(distanceM)}
            </span>
          )}
        </div>
        {data.picked.notice && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠️ {data.picked.notice}
          </p>
        )}

        <h2 className="text-xl font-bold leading-snug">{place.title}</h2>
        {place.address && (
          <p className="text-sm text-zinc-500">{place.address}</p>
        )}
        {place.overview && (
          <p className="line-clamp-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {place.overview}
          </p>
        )}

        {/* 내 기록 — 찜·다녀옴 (한 묶음: 세그먼트 토글) */}
        <div className="flex divide-x divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              saved
                ? "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span aria-hidden>{saved ? "♥" : "♡"}</span>
            {saved ? "찜함" : "찜"}
          </button>
          <button
            type="button"
            onClick={onToggleVisit}
            aria-pressed={visited}
            className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors ${
              visited
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span aria-hidden>{visited ? "✔" : "➕"}</span>
            {visited ? "다녀옴" : "다녀왔어요"}
          </button>
        </div>

        <div className="mt-1 flex flex-col gap-2">
          {/* 주요 행동 — 다시 뽑기 (유일한 강조 버튼) */}
          <button
            type="button"
            onClick={onRedraw}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 active:bg-indigo-700"
          >
            🎲 다시 뽑기
          </button>

          {/* 📍 첫 여행지 주변에서 뽑기(M14) — 순수 모드+앵커 좌표 있을 때만 */}
          {onDrawNearby && (
            <button
              type="button"
              onClick={onDrawNearby}
              className="w-full truncate rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950"
            >
              📍 {anchorTitle ? `${anchorTitle} 주변에서 뽑기` : "주변에서 뽑기"}
            </button>
          )}

          {/* 길 안내 — 지도·길찾기 (한 묶음: 세그먼트) */}
          {(mapHref || routeHref) && (
            <div className="flex divide-x divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {mapHref && (
                <a
                  href={mapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onNavigate}
                  className="flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
                  className="flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  🧭 길찾기
                </a>
              )}
            </div>
          )}

          {/* 공유 — 카톡·링크 복사 (한 묶음: 세그먼트, 카톡 강조) */}
          <div className="flex overflow-hidden rounded-xl">
            <button
              type="button"
              onClick={onShare}
              className="flex flex-[2] items-center justify-center gap-1.5 bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#191600] transition-[filter] hover:brightness-95 active:brightness-90"
            >
              <span aria-hidden>💬</span> 카카오톡 공유
            </button>
            <button
              type="button"
              onClick={onCopyLink}
              className="flex flex-1 items-center justify-center gap-1.5 border-l border-black/10 bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <span aria-hidden>🔗</span> 링크 복사
            </button>
          </div>
          {shareMsg && (
            <p
              aria-live="polite"
              className="text-center text-xs text-zinc-500 dark:text-zinc-400"
            >
              {shareMsg}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
