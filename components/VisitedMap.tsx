"use client";

// 🗺️ 내 여행 지도 핀 뷰 (M8 + M16 리디자인) — 실제 카카오맵 마커 + 하단 다녀온 곳 리스트.
//   지도 SDK 로드는 hooks/useKakaoLoader, 순수 계산은 lib/mapView. 리스트는 카카오/네이버 딥링크.

import { useEffect, useRef, useState } from "react";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { visitedWithCoords, DEFAULT_LEVEL, SINGLE_LEVEL } from "@/lib/mapView";
import { AREA_NAME, REVISIT_OPTIONS } from "@/lib/constants";
import { kakaoMapLink, naverMapLink } from "@/lib/mapLink";
import { relativeDay } from "@/lib/relativeDate";
import type { SavedPlace, RevisitRating } from "@/lib/travelStore";
import type { KakaoInfoWindow } from "@/types/kakao";

// 📊 재방문 의향 배지 색(다녀온 곳 리스트) — 선택 시 rose/amber/emerald.
const RATING_BADGE: Record<RevisitRating, string> = {
  1: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300",
  2: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  3: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function VisitedMap({
  visited,
  storeReady,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
}) {
  const status = useKakaoLoader();
  const containerRef = useRef<HTMLDivElement>(null);
  const pts = visitedWithCoords(visited);
  const showMap = storeReady && status === "ready" && pts.length > 0;
  // 상대 날짜용 현재 시각 — 렌더 중 Date.now()(비순수) 대신 마운트 후 1회 캡처.
  const [now, setNow] = useState(0);
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (!showMap || !containerRef.current || !window.kakao) return;
    const { kakao } = window;
    const el = containerRef.current;
    el.innerHTML = ""; // 재실행 시 이전 지도 제거(중복 방지)

    const map = new kakao.maps.Map(el, {
      center: new kakao.maps.LatLng(pts[0].lat, pts[0].lng),
      level: DEFAULT_LEVEL,
    });

    const bounds = new kakao.maps.LatLngBounds();
    let openInfo: KakaoInfoWindow | null = null;

    for (const p of pts) {
      const pos = new kakao.maps.LatLng(p.lat, p.lng);
      const marker = new kakao.maps.Marker({ position: pos, map, title: p.title });
      bounds.extend(pos);

      const content = document.createElement("div");
      content.style.cssText =
        "padding:6px 10px;font-size:12px;max-width:200px;color:#18181b;line-height:1.4";
      content.textContent = p.title;
      const info = new kakao.maps.InfoWindow({ content, removable: true });

      kakao.maps.event.addListener(marker, "click", () => {
        openInfo?.close();
        info.open(map, marker);
        openInfo = info;
      });
    }

    if (pts.length >= 2) {
      map.setBounds(bounds);
    } else {
      map.setLevel(SINGLE_LEVEL);
    }

    return () => {
      openInfo?.close();
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, visited]);

  // 리스트 — 최근 다녀온 순.
  const sorted = [...visited].sort((a, b) => b.savedAt - a.savedAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[60vh] min-h-[320px] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        {showMap ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <MapMessage status={status} storeReady={storeReady} empty={pts.length === 0} />
        )}
      </div>

      {storeReady && sorted.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-4 py-3 text-sm font-extrabold dark:border-zinc-800">
            다녀온 곳 <span className="text-zinc-400">{sorted.length}</span>
          </div>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sorted.map((p) => (
              <VisitedRow key={p.contentId} place={p} now={now} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function VisitedRow({ place, now }: { place: SavedPlace; now: number }) {
  const areaName = place.areaCode != null ? AREA_NAME[place.areaCode] : "";
  const kakaoHref = kakaoMapLink(place.title, place.lat, place.lng);
  const naverHref = naverMapLink(place.title);
  const rating = place.rating ?? null;
  const opt = rating != null ? REVISIT_OPTIONS.find((o) => o.value === rating) : null;
  const dateText = now > 0 ? relativeDay(place.savedAt, now) : "";

  return (
    <li className="flex items-center gap-3 px-4 py-3">
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
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold">{place.title}</p>
          <span
            className={`flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap ${
              opt
                ? RATING_BADGE[opt.value]
                : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
            }`}
          >
            {opt ? `${opt.emoji} ${opt.short}` : "평가 전"}
          </span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          {areaName}
          {areaName && dateText ? " · " : ""}
          {dateText}
        </p>
      </div>

      {kakaoHref && (
        <a
          href={kakaoHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none rounded-lg bg-[#FEE500] px-2.5 py-1.5 text-[11.5px] font-bold text-[#3d3000]"
        >
          🗺️ 카카오
        </a>
      )}
      {naverHref && (
        <a
          href={naverHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none rounded-lg bg-[#03c75a] px-2.5 py-1.5 text-[11.5px] font-bold text-white"
        >
          N 네이버
        </a>
      )}
    </li>
  );
}

function MapMessage({
  status,
  storeReady,
  empty,
}: {
  status: ReturnType<typeof useKakaoLoader>;
  storeReady: boolean;
  empty: boolean;
}) {
  let icon = "🗺️";
  let title = "지도를 불러오는 중…";
  let desc = "";

  if (status === "no-key") {
    icon = "🔑";
    title = "지도 키가 설정되지 않았어요.";
    desc = "환경변수 NEXT_PUBLIC_KAKAO_MAP_KEY 를 확인해 주세요.";
  } else if (status === "error") {
    icon = "⚠️";
    title = "지도를 불러오지 못했어요.";
    desc = "카카오 개발자 콘솔에 이 사이트 도메인이 등록됐는지 확인해 주세요.";
  } else if (storeReady && status === "ready" && empty) {
    icon = "📍";
    title = "아직 다녀온 곳이 없어요.";
    desc = "여행지를 뽑고 '다녀왔어요 ✔'를 체크하면 여기 핀이 쌓여요.";
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      {desc && (
        <p className="max-w-xs text-xs text-zinc-500 dark:text-zinc-400">{desc}</p>
      )}
    </div>
  );
}
