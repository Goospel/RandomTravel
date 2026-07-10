"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useTravelStore } from "@/hooks/useTravelStore";
import { useEmptySpotCount } from "@/hooks/useEmptySpotCount";
import { VisitedMap } from "@/components/VisitedMap";
import { visitedWithCoords } from "@/lib/mapView";
import { buildEmptySpotQuery } from "@/lib/query";

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
  const router = useRouter();
  const [view, setView] = useState<View>("conquer");
  const pinCount = visitedWithCoords(store.visited).length;

  // 🔭 빈 곳 CTA 캡션 수(§7.11) — exclude(정복 시·군·구)는 conqueredSigunguCodes(koreaMap 의존)라
  //   /map 진입 청크를 무겁게 하지 않게 동적 import 로 계산(정복 지도 자체도 lazy). ready 전엔 null.
  const [excludeQuery, setExcludeQuery] = useState<string | null>(null);
  useEffect(() => {
    // synced 게이트 — 로그인 사용자 서버 병합 완료 후라야 exclude(방문 시·군·구)가 정확(§7.11).
    if (!store.ready || !store.synced) {
      // 아직 준비 전 — 조회 보류(외부→UI 동기화라 의도된 setState, useCandidateCount 동형).
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setExcludeQuery(null);
      return;
    }
    let alive = true;
    import("@/lib/conquer").then(({ conqueredSigunguCodes }) => {
      if (alive) setExcludeQuery(buildEmptySpotQuery(conqueredSigunguCodes(store.visited)));
    });
    return () => {
      alive = false;
    };
  }, [store.ready, store.synced, store.visited]);
  const emptyCount = useEmptySpotCount(excludeQuery);

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

      {/* 🔭 빈 곳에서 뽑기 역방향 CTA(§7.11) — 정복 모드 하단. 클릭 → 홈이 ?emptySpot=1 신호 소비. */}
      {view === "conquer" && store.ready && (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => router.push("/?emptySpot=1")}
            className="rounded-xl border border-indigo-300 bg-white px-5 py-2.5 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300 dark:hover:bg-indigo-950"
          >
            🔭 빈 곳에서 뽑기
          </button>
          <p className="text-center text-xs text-indigo-700/80 dark:text-indigo-300/80">
            {emptyCount.status === "count"
              ? `지도에 없는 한적한 동네 ${emptyCount.totalCount}곳`
              : emptyCount.status === "dynamic"
                ? "안 가본 동네에서 — 혼잡도 확인 불가"
                : "아직 발도장 없는 한적한 동네에서"}
          </p>
        </div>
      )}

      <p className="text-center text-xs text-zinc-400">
        {view === "conquer"
          ? "다녀온 시·군·구가 초록으로 채워져요. 조각 위에 마우스를 올리면 이름이 보여요."
          : "핀을 누르면 장소 이름이 보여요 · 카카오/네이버로 다시 열 수 있어요."}
      </p>
    </main>
  );
}
