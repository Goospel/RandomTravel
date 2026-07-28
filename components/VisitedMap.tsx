"use client";

// 🗺️ 내 여행 지도 핀 뷰 (Genesis 리스킨) — 실제 카카오맵 마커 + 하단 다녀온 곳 리스트.
//   지도 SDK 로드는 hooks/useKakaoLoader, 순수 계산은 lib/mapView. 리스트는 카카오/네이버 딥링크.

import { useEffect, useRef, useState } from "react";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { visitedWithCoords, DEFAULT_LEVEL, SINGLE_LEVEL } from "@/lib/mapView";
import { AREA_NAME, REVISIT_OPTIONS } from "@/lib/constants";
import { kakaoMapLink, naverMapLink } from "@/lib/mapLink";
import { relativeDay } from "@/lib/relativeDate";
import { Icon, type IconName } from "@/components/icons";
import { RATING_SELECTED, RowThumb } from "@/components/RecordPanel";
import type { SavedPlace } from "@/lib/travelStore";
import type { KakaoInfoWindow } from "@/types/kakao";

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
    <div className="flex flex-col gap-5">
      <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-g-border bg-g-surface">
        {showMap ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <MapMessage status={status} storeReady={storeReady} empty={pts.length === 0} />
        )}
      </div>

      {storeReady && sorted.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-g-border bg-g-surface">
          <div className="px-4 py-3.5 font-display text-[15px] font-bold leading-[1.3] tracking-[-0.02em]">
            다녀온 곳 <span className="font-medium text-g-neutral">{sorted.length}</span>
          </div>
          <ul>
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
  const extLink =
    "inline-flex h-8 items-center gap-1.5 rounded-md border border-g-border bg-g-surface px-2.5 text-[12px] font-medium text-g-text-2 hover:border-g-primary hover:text-g-primary";

  return (
    <li className="flex items-center gap-3 border-t border-g-border px-4 py-3">
      <RowThumb image={place.image} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-medium leading-[1.4]">{place.title}</p>
          <span
            className={`flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
              opt ? RATING_SELECTED[opt.value] : "bg-g-surface-2 text-g-neutral"
            }`}
          >
            {opt ? opt.short : "평가 전"}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-g-text-2">
          {areaName}
          {areaName && dateText ? " · " : ""}
          {dateText}
        </p>
      </div>

      <div className="flex flex-none gap-1.5">
        {kakaoHref && (
          <a href={kakaoHref} target="_blank" rel="noopener noreferrer" className={extLink}>
            {/* 모바일은 라벨을 숨겨 아이콘 버튼으로 — 좁은 폭에서 두 링크가 제목을 밀어낸다 */}
            <span className="hidden sm:inline">카카오맵</span>
            <Icon name="externalLink" size={11} />
          </a>
        )}
        {naverHref && (
          <a href={naverHref} target="_blank" rel="noopener noreferrer" className={extLink}>
            <span className="hidden sm:inline">네이버지도</span>
            <Icon name="externalLink" size={11} />
          </a>
        )}
      </div>
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
  let icon: IconName = "map";
  let title = "지도를 불러오는 중…";
  let desc = "";

  if (status === "no-key") {
    icon = "key";
    title = "지도 키가 설정되지 않았어요.";
    desc = "환경변수 NEXT_PUBLIC_KAKAO_MAP_KEY 를 확인해 주세요.";
  } else if (status === "error") {
    icon = "warning";
    title = "지도를 불러오지 못했어요.";
    desc = "카카오 개발자 콘솔에 이 사이트 도메인이 등록됐는지 확인해 주세요.";
  } else if (storeReady && status === "ready" && empty) {
    icon = "pin";
    title = "아직 다녀온 곳이 없어요.";
    desc = "여행지를 뽑고 '다녀왔어요'를 체크하면 여기 핀이 쌓여요.";
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-6 text-center text-g-neutral">
      <Icon name={icon} size={36} />
      <p className="text-[15px] font-medium text-g-text">{title}</p>
      {desc && <p className="max-w-xs text-[12px] leading-[1.6] text-g-text-2">{desc}</p>}
    </div>
  );
}
