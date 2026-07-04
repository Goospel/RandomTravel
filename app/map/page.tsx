"use client";

import Link from "next/link";
import { useTravelStore } from "@/hooks/useTravelStore";
import { VisitedMap } from "@/components/VisitedMap";
import { visitedWithCoords } from "@/lib/mapView";

// 🗺️ 내 여행 지도 (M8, plan.md §7.1) — 다녀온 곳을 카카오맵에 마커로 누적 표시.
export default function MapPage() {
  const store = useTravelStore();
  const count = visitedWithCoords(store.visited).length;

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
            {store.ready ? `다녀온 곳 ${count}곳` : " "}
          </span>
        </div>
      </header>

      <VisitedMap visited={store.visited} storeReady={store.ready} />

      <p className="text-center text-xs text-zinc-400">
        마커를 누르면 장소 이름이 보여요. 지도는 카카오맵으로 표시됩니다.
      </p>
    </main>
  );
}
