"use client";

// 🗺️ 홈 지도 히어로(M16 탐험 로그) — 뽑기 화면 상단에 정복 현황을 상시 노출.
//   정복 뷰: 정복률 링 + 250조각 시·군·구 지도(M23에서 17개 시·도 타일을 대체, §7.12) +
//   뽑는 동안 도는 🎰 룰렛. 핀 뷰: 경량 좌표 캔버스(가벼운 글랜스용 — 실제 카카오맵은
//   /map 페이지에서). '다녀왔어요'로 새 시·도를 채우면 🎉 토스트.

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { AREA_NAME } from "@/lib/constants";
import type { SavedPlace } from "@/lib/travelStore";

// 정복 지도는 시·군·구 경계(~207KB)와 lib/conquer 를 싣는다 → 별도 청크로 분리해 홈 초기
// 페인트를 막지 않는다(§7.11 번들 보호 — /map 의 ConquerMap 과 같은 처리).
const HomeConquerMap = dynamic(
  () => import("@/components/HomeConquerMap").then((m) => m.HomeConquerMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] items-center justify-center text-sm text-emerald-700/60 dark:text-emerald-300/60">
        정복 지도 불러오는 중…
      </div>
    ),
  },
);

type View = "conquer" | "pin";

// 대한민국 대략 bbox → 캔버스 %(핀 배치용, 장식적 근사).
function pinPercent(lat: number, lng: number): { left: string; top: string } {
  const x = (lng - 125.4) / (129.7 - 125.4);
  const y = (38.7 - lat) / (38.7 - 33.0);
  return {
    left: `${Math.max(6, Math.min(94, x * 100))}%`,
    top: `${Math.max(8, Math.min(90, y * 100))}%`,
  };
}

export function MapHero({
  visited,
  storeReady,
  filledArea,
  spinning,
  landedLat,
  landedLng,
  drawSeq,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
  /** 방금 정복한 시·도 code — 🎉 토스트 + 해당 타일 팝 애니메이션 */
  filledArea: number | null;
  /** 🎰 뽑는 중(§7.12) — 정복 지도가 룰렛으로 돈다 */
  spinning: boolean;
  /** 🎰 결과 좌표 — 이 좌표의 시·군·구에 착지. 없으면 착지 없이 종료 */
  landedLat: number | null;
  landedLng: number | null;
  /** 🎰 뽑기 순번 — 같은 좌표가 연달아 나와도 착지 연출이 다시 돌게 하는 키 */
  drawSeq: number;
}) {
  const [view, setView] = useState<View>("conquer");

  const withCoords = visited.filter((v) => v.lat != null && v.lng != null);

  const toggle = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
      active
        ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-950 dark:text-emerald-300"
        : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
    }`;

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-emerald-200 bg-[linear-gradient(170deg,#dcfce7,#f0fdf4_60%,#ffffff)] p-4 shadow-[0_10px_30px_-18px_rgba(5,120,80,0.35)] dark:border-emerald-900/50 dark:bg-[linear-gradient(170deg,#052e2b,#0a0a0a_70%)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex max-w-[280px] flex-1 rounded-xl bg-white/60 p-1 dark:bg-white/5">
          <button type="button" onClick={() => setView("conquer")} className={toggle(view === "conquer")}>
            🧩 정복 지도
          </button>
          <button type="button" onClick={() => setView("pin")} className={toggle(view === "pin")}>
            📍 핀 지도
          </button>
        </div>
        <Link
          href="/map"
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900 dark:bg-zinc-900 dark:text-emerald-300"
        >
          🗺️ 전체 지도 크게 보기 →
        </Link>
      </div>

      {view === "conquer" ? (
        /* 🔭 빈 곳에서 뽑기 CTA 는 여기 두지 않는다 — /map(전체 지도 크게 보기)에만 둬
           같은 동작의 진입점이 두 곳으로 갈라지지 않게 한다. */
        <HomeConquerMap
          visited={visited}
          storeReady={storeReady}
          spinning={spinning}
          landedLat={landedLat}
          landedLng={landedLng}
          drawSeq={drawSeq}
        />
      ) : (
        <>
          <div className="relative h-[280px] overflow-hidden rounded-2xl border border-emerald-200 bg-[linear-gradient(170deg,#e0f2fe,#f0fdf4)] dark:border-emerald-900/50 dark:bg-zinc-900">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "linear-gradient(#00000008 1px,transparent 1px),linear-gradient(90deg,#00000008 1px,transparent 1px)",
                backgroundSize: "34px 34px",
              }}
            />
            {withCoords.map((v) => {
              const pos = pinPercent(v.lat!, v.lng!);
              return (
                <div
                  key={v.contentId}
                  title={v.title}
                  className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
                  style={{ left: pos.left, top: pos.top }}
                >
                  <div className="text-xl drop-shadow-[0_2px_3px_rgba(0,0,0,0.28)]">📍</div>
                  <div className="-translate-y-1 whitespace-nowrap rounded bg-white/85 px-1.5 text-[10px] font-bold text-emerald-800">
                    {v.title}
                  </div>
                </div>
              );
            })}
            {withCoords.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6 text-center text-emerald-700 dark:text-emerald-300">
                <div className="text-3xl">🗺️</div>
                <div className="text-sm font-semibold">아직 다녀온 곳이 없어요</div>
                <div className="text-[11.5px]">
                  뽑은 여행지에서 <b>✔ 다녀왔어요</b>를 누르면 여기 핀이 찍혀요.
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-[11.5px] text-emerald-700 dark:text-emerald-300">
            다녀온 곳이 핀으로 찍혀요 · 지도는 /map 에서 카카오맵으로 크게 볼 수 있어요.
          </p>
        </>
      )}

      {storeReady && filledArea != null && (
        <div className="animate-fade-up absolute right-3.5 top-3.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(5,150,105,0.7)]">
          🎉 {AREA_NAME[filledArea]} 정복! · 내 지도 +1
        </div>
      )}
    </section>
  );
}
