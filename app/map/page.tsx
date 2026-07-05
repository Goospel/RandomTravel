"use client";

import Link from "next/link";
import { useState } from "react";
import { useTravelStore } from "@/hooks/useTravelStore";
import { VisitedMap } from "@/components/VisitedMap";
import { ConquerMap } from "@/components/ConquerMap";
import { visitedWithCoords } from "@/lib/mapView";
import { conquerStats } from "@/lib/conquer";

// 🗺️ 내 여행 지도 (M8 핀 지도 §7.1 + M12 정복 지도 §7.4) — 보기 방식 토글.
type View = "pin" | "conquer";
const VIEWS: { key: View; label: string }[] = [
  { key: "pin", label: "📍 핀 지도" },
  { key: "conquer", label: "🧩 정복 지도" },
];

export default function MapPage() {
  const store = useTravelStore();
  const [view, setView] = useState<View>("pin");
  const pinCount = visitedWithCoords(store.visited).length;
  const { conquered } = conquerStats(store.visited);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← 뽑기로 돌아가기
        </Link>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">🗺️ 내 여행 지도</h1>
          <span
            aria-live="polite"
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            {store.ready
              ? view === "pin"
                ? `다녀온 곳 ${pinCount}곳`
                : `${conquered} / 17 정복`
              : " "}
          </span>
        </div>
      </header>

      {/* 세그먼트 토글 — radio 역할(방향키·roving tabindex 계약)을 약속하지 않도록
          aria-pressed 버튼으로 표현. Tab+Enter/Space로 조작(FilterPanel과 동일 패턴). */}
      <div
        role="group"
        aria-label="지도 보기 방식"
        className="flex w-full rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800"
      >
        {VIEWS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={view === o.key}
            onClick={() => setView(o.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              view === o.key
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {view === "pin" ? (
        <VisitedMap visited={store.visited} storeReady={store.ready} />
      ) : (
        <ConquerMap visited={store.visited} storeReady={store.ready} />
      )}

      <p className="text-center text-xs text-zinc-400">
        {view === "pin"
          ? "마커를 누르면 장소 이름이 보여요. 지도는 카카오맵으로 표시됩니다."
          : "다녀온 지역이 색으로 채워져요. 조각 위에 마우스를 올리면 시·도 이름이 보여요."}
      </p>
    </main>
  );
}
