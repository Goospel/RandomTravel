"use client";

import { useState } from "react";
import type { RandomResponse } from "@/types/tour";
import { AREA_NAME, CONTENT_TYPE_NAME } from "@/lib/constants";
import { kakaoMapLink, kakaoRouteLink } from "@/lib/mapLink";
import { useKakaoShare } from "@/hooks/useKakaoShare";
import { shareText } from "@/lib/kakaoShare";
import { formatKm } from "@/lib/geo";

// 🎴 결과 카드(M16 탐험 로그) — 사진 위 오버레이 찜·다녀옴 토글 + 주요 2(다시뽑기·주변) /
//   보조 4아이콘(지도·길찾기·공유·복사) 2단 계층. 데이터·공유 로직은 그대로 재사용.

const BADGE: Record<string, string> = {
  area: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  type: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  sea: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  seasonal: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  festival: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
  weather: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  congestion: "bg-lime-50 text-lime-700 dark:bg-lime-950 dark:text-lime-300",
  dist: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};
const pill =
  "rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap";

/** YYYYMMDD → "M/D"(앞 0 제거). 형식 이상 시 원문 그대로. */
function fmtYmd(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${Number(ymd.slice(4, 6))}/${Number(ymd.slice(6, 8))}`;
}

export function ResultCard({
  data,
  onDrawNearby,
  anchorTitle,
  saved,
  visited,
  onToggleSave,
  onToggleVisit,
  onNavigate,
}: {
  data: RandomResponse;
  /** 📍 첫 여행지 주변에서 뽑기(M14) — 순수 모드+앵커 좌표 있을 때만 전달, 아니면 null.
      전국 랜덤 재추첨은 상단 "다시 뽑기" 버튼이 담당하므로 카드엔 뽑기 버튼을 두지 않는다. */
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
  const distanceM = data.picked.distanceM;
  const [imgError, setImgError] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const { share } = useKakaoShare();

  const areaCode = place.areaCode ?? data.picked.areaCode;
  const areaName = areaCode != null ? AREA_NAME[areaCode] : undefined;
  const typeName =
    CONTENT_TYPE_NAME[place.contentTypeId] ??
    CONTENT_TYPE_NAME[data.picked.contentTypeId];

  const mapHref = kakaoMapLink(place.title, place.lat, place.lng);
  const routeHref = kakaoRouteLink(place.title, place.lat, place.lng);
  const showImage = place.image && !imgError;

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
      congestion: data.picked.congestion, // 🍃 분산 서사(§7.9) — 공유 카드에 근거 1줄
    });
    if (result === "copied") flash("링크가 복사됐어요 ✓");
    else if (result === "failed") flash("공유를 열 수 없었어요.");
    else flash(null);
  }

  // 🔗 링크 복사 — 클립보드 우선, 안 되면 Web Share(모바일)로 폴백.
  async function onCopyLink() {
    const text = shareText(place, window.location.origin, data.picked.congestion);
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
        return;
      } catch {
        flash("공유를 열 수 없었어요.");
        return;
      }
    }
    flash("이 브라우저에선 복사를 지원하지 않아요.");
  }

  // 사진 위 오버레이 원형 토글 공통 클래스
  const overlayBtn =
    "flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-colors";
  const iconTile =
    "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2.5 text-base";
  const iconLabel = "text-[10.5px] font-semibold text-zinc-500 dark:text-zinc-400";

  return (
    <article className="animate-card-reveal w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_6px_20px_-14px_rgba(20,40,30,0.3)] dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative aspect-video w-full bg-zinc-100 dark:bg-zinc-800">
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
        {/* 사진 위 오버레이 — 찜 ♥ / 다녀옴 ✔ */}
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={onToggleSave}
            aria-pressed={saved}
            aria-label={saved ? "찜 해제" : "찜하기"}
            className={`${overlayBtn} ${
              saved
                ? "bg-rose-600 text-white"
                : "bg-white/95 text-rose-600 hover:bg-white"
            }`}
          >
            <span aria-hidden>{saved ? "♥" : "♡"}</span>
          </button>
          <button
            type="button"
            onClick={onToggleVisit}
            aria-pressed={visited}
            aria-label={visited ? "다녀옴 해제" : "다녀왔어요"}
            className={`${overlayBtn} ${
              visited
                ? "bg-emerald-600 text-white"
                : "bg-white/95 text-zinc-600 hover:bg-white"
            }`}
          >
            <span aria-hidden>{visited ? "✔" : "➕"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {areaName && <span className={`${pill} ${BADGE.area}`}>{areaName}</span>}
          {typeName && <span className={`${pill} ${BADGE.type}`}>{typeName}</span>}
          {data.picked.seaside && (
            <span className={`${pill} ${BADGE.sea}`}>
              {data.picked.seaside.emoji} {data.picked.seaside.category}
            </span>
          )}
          {data.picked.seasonal && data.picked.seasonal.items.length > 0 && (
            <span className={`${pill} ${BADGE.seasonal}`}>
              지금 제철{" "}
              {data.picked.seasonal.items
                .map((s) => `${s.emoji}${s.item}`)
                .join(" · ")}
            </span>
          )}
          {data.picked.festival && (
            <span
              title={data.picked.festival.name}
              className={`inline-block max-w-[15rem] truncate align-bottom ${pill} ${BADGE.festival}`}
            >
              🎪 {data.picked.festival.name}
              {data.picked.festival.more > 0 && ` 외 ${data.picked.festival.more}`}
              {/* 📅 오늘 아닌 기준일이면 명시 — 시작 전 축제가 '진행 중'처럼 보이는 오해 방지(§6.8) */}
              {data.picked.festival.baseYmd &&
                ` (${fmtYmd(data.picked.festival.baseYmd)} 기준)`}
            </span>
          )}
          {data.picked.weather && (
            <span className={`${pill} ${BADGE.weather}`}>
              ☀️ 지금 비 안 와요
              {data.picked.weather.temp != null &&
                ` · ${Math.round(data.picked.weather.temp)}℃`}
            </span>
          )}
          {data.picked.congestion && (
            <span className={`${pill} ${BADGE.congestion}`}>
              {/* 예측 대상일 선두(정상 경로=선택일). baseYmd < targetYmd(배치 지연)에만 데이터일 병기(§6.8) */}
              🍃 {fmtYmd(data.picked.congestion.targetYmd)} 한적 예측 · 집중률 하위{" "}
              {data.picked.congestion.pctBelow}%
              {data.picked.congestion.baseYmd < data.picked.congestion.targetYmd &&
                ` (${fmtYmd(data.picked.congestion.baseYmd)} 데이터)`}
            </span>
          )}
          {distanceM != null && (
            <span
              title={anchorTitle ?? undefined}
              className={`inline-block max-w-[15rem] truncate align-bottom ${pill} ${BADGE.dist}`}
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

        <h2 className="text-lg font-extrabold leading-snug">{place.title}</h2>
        {place.address && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{place.address}</p>
        )}
        {place.overview && (
          <p className="line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {place.overview}
          </p>
        )}

        {/* 📍 주변에서 뽑기(M14) — 전국 랜덤 재추첨과 다른 별개 동작이라 카드에 유지.
            뽑기(재추첨)는 상단 버튼 하나로 통합됨. */}
        {onDrawNearby && (
          <button
            type="button"
            onClick={onDrawNearby}
            className="mt-2 w-full truncate rounded-xl border border-emerald-200 px-4 py-3 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            📍 {anchorTitle ? `${anchorTitle} 주변에서 뽑기` : "주변에서 뽑기"}
          </button>
        )}

        {/* 보조 액션 — 지도 · 길찾기 · 공유 · 복사 (아이콘 + 라벨) */}
        <div className="mt-2 flex gap-1.5">
          {mapHref && (
            <a
              href={mapHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={`${iconTile} bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700`}
            >
              <span aria-hidden>🗺️</span>
              <span className={iconLabel}>지도</span>
            </a>
          )}
          {routeHref && (
            <a
              href={routeHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNavigate}
              className={`${iconTile} bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700`}
            >
              <span aria-hidden>🧭</span>
              <span className={iconLabel}>길찾기</span>
            </a>
          )}
          <button
            type="button"
            onClick={onShare}
            className={`${iconTile} bg-[#FEE500] transition-[filter] hover:brightness-95`}
          >
            <span aria-hidden>💬</span>
            <span className="text-[10.5px] font-bold text-[#7a6b00]">공유</span>
          </button>
          <button
            type="button"
            onClick={onCopyLink}
            className={`${iconTile} bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700`}
          >
            <span aria-hidden>🔗</span>
            <span className={iconLabel}>복사</span>
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
    </article>
  );
}
