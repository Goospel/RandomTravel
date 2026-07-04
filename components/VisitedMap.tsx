"use client";

// 🗺️ 내 여행 지도 (M8) — 다녀온 곳(localStorage, 좌표 포함)을 카카오맵에 마커로 표시.
// 순수 계산은 lib/mapView, SDK 로드는 hooks/useKakaoLoader 가 담당. 여기선 지도·마커 렌더만.

import { useEffect, useRef } from "react";
import { useKakaoLoader } from "@/hooks/useKakaoLoader";
import { visitedWithCoords, DEFAULT_LEVEL, SINGLE_LEVEL } from "@/lib/mapView";
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

      // 제목은 API 원문 → innerHTML 대신 textContent 로 넣어 XSS 방지.
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
      map.setBounds(bounds); // 여러 곳: 모두 담기게 자동 경계맞춤
    } else {
      // 단일 점 bounds(넓이 0)에 setBounds 하면 최대 배율로 과확대(건물 단위)돼
      // DEFAULT_LEVEL 이 무시된다. 중심은 생성 시 그 점이므로 축척만 도시 규모로.
      map.setLevel(SINGLE_LEVEL);
    }

    // 언마운트/재실행 시 열린 InfoWindow 닫고 지도 DOM 정리(인스턴스 GC 유도).
    return () => {
      openInfo?.close();
      el.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMap, visited]);

  return (
    <div className="relative h-[60vh] min-h-[320px] w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      {showMap ? (
        <div ref={containerRef} className="h-full w-full" />
      ) : (
        <MapMessage status={status} storeReady={storeReady} empty={pts.length === 0} />
      )}
    </div>
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
