"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTravelStore } from "@/hooks/useTravelStore";
import { VisitedMap } from "@/components/VisitedMap";
import { visitedWithCoords } from "@/lib/mapView";

// 정복 지도는 시·군·구 경계 데이터(약 200KB)를 싣는다 → 별도 청크로 코드 분할해 초기 페인트를
// 막지 않는다(핀 뷰만 볼 땐 아예 안 받는다). 히어로(정복률 링·레벨)도 이 컴포넌트 안에 있다.
const ConquerMap = dynamic(
  () => import("@/components/ConquerMap").then((m) => m.ConquerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/50">
        정복 지도 불러오는 중…
      </div>
    ),
  },
);

// 🗺️ 내 여행 지도 — 정복(기본)/핀 토글. 정복이 이 페이지의 주인공(M16).
type View = "conquer" | "pin";
const VIEWS: { key: View; label: string }[] = [
  { key: "conquer", label: "🧩 정복 지도" },
  { key: "pin", label: "📍 핀 지도" },
];

export default function MapPage() {
  const store = useTravelStore();
  const [view, setView] = useState<View>("conquer");
  const pinCount = visitedWithCoords(store.visited).length;

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-5 px-4 py-7 sm:px-5">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700/80 hover:text-emerald-800 dark:text-emerald-400/80 dark:hover:text-emerald-300"
        >
          ← 뽑기로 돌아가기
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              🗺️ 내 여행 지도
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              다녀온 곳이 쌓일수록 대한민국이 내 색으로 채워져요.
            </p>
          </div>
          <span
            aria-live="polite"
            className="text-sm text-zinc-500 dark:text-zinc-400"
          >
            {store.ready && view === "pin" ? `다녀온 곳 ${pinCount}곳` : " "}
          </span>
        </div>
      </header>

      {/* 세그먼트 토글 — aria-pressed 버튼(FilterPanel과 동일 패턴, radio 계약 미약속). */}
      <div
        role="group"
        aria-label="지도 보기 방식"
        className="flex w-full max-w-[320px] rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800"
      >
        {VIEWS.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={view === o.key}
            onClick={() => setView(o.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              view === o.key
                ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-950 dark:text-emerald-300"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {view === "conquer" ? (
        <ConquerMap visited={store.visited} storeReady={store.ready} />
      ) : (
        <VisitedMap visited={store.visited} storeReady={store.ready} />
      )}

      <p className="text-center text-xs text-zinc-400">
        {view === "conquer"
          ? "다녀온 시·군·구가 초록으로 채워져요. 조각 위에 마우스를 올리면 이름이 보여요."
          : "핀을 누르면 장소 이름이 보여요 · 카카오/네이버로 다시 열 수 있어요."}
      </p>
    </main>
  );
}
