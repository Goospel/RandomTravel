"use client";

// 🗺️ 홈 지도 히어로(M16 탐험 로그) — 뽑기 화면 상단에 정복 현황을 상시 노출.
//   정복 뷰: 정복률 링 + 17개 시·도 타일. 핀 뷰: 경량 좌표 캔버스(가벼운 글랜스용 —
//   실제 카카오맵은 /map 페이지에서). '다녀왔어요'로 새 시·도를 채우면 🎉 토스트.

import { useState } from "react";
import Link from "next/link";
import { AREA_CODES, AREA_NAME } from "@/lib/constants";
import { visitedAreaCodes } from "@/lib/visitedAreas"; // 🔭 홈 번들에서 koreaMap 제외(§7.11)
import type { SavedPlace } from "@/lib/travelStore";

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
  storeSynced,
  filledArea,
  onEmptySpot,
  emptySpotPending,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
  /** 🔭 방문 목록 최종 여부(§7.11) — 로그인 사용자의 서버 병합 완료 후 true. 미완료면 버튼 비활성. */
  storeSynced: boolean;
  /** 방금 정복한 시·도 code — 🎉 토스트 + 해당 타일 팝 애니메이션 */
  filledArea: number | null;
  /** 🔭 빈 곳에서 뽑기 클릭(§7.11) — 홈이 동적 import·exclude 계산·runDraw 를 담당 */
  onEmptySpot: () => void;
  /** 🔭 클릭~runDraw 진입 전 창(동적 import·exclude 계산) 이중 클릭 차단 */
  emptySpotPending: boolean;
}) {
  const [view, setView] = useState<View>("conquer");

  const areaSet = visitedAreaCodes(visited);
  const conqueredCount = areaSet.size;
  const pct = Math.round((conqueredCount / AREA_CODES.length) * 100);
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
        <>
          <div className="mb-4 flex items-center gap-4">
            <div
              className="flex h-[66px] w-[66px] flex-none items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#059669 ${Math.max(pct, conqueredCount > 0 ? 3 : 0)}%, #d1fae5 0)` }}
              aria-hidden
            >
              <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white text-sm font-extrabold text-emerald-600 dark:bg-zinc-950">
                {pct}%
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                전국 정복 현황
              </div>
              <div className="text-[26px] font-extrabold leading-tight tracking-tight">
                {conqueredCount}
                <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                  개 시·도 · 다녀온 곳 {visited.length}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-6 gap-1.5" aria-label="시·도별 정복 타일">
            {AREA_CODES.map((a, i) => {
              const on = areaSet.has(a.code);
              const base =
                "flex h-8 items-center justify-center rounded-lg text-[11.5px] font-bold";
              const cls = on
                ? `${base} text-white ${i % 2 ? "bg-emerald-500" : "bg-emerald-600"} ${
                    filledArea === a.code ? "animate-tile-pop" : ""
                  }`
                : `${base} bg-[#e6efe9] text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500`;
              return (
                <div key={a.code} className={cls}>
                  {a.name}
                  {on ? " ✓" : ""}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11.5px] text-emerald-700 dark:text-emerald-300">
            다녀옴을 체크한 시·도가 색으로 채워져요.
          </p>
          {/* 🔭 빈 곳에서 뽑기(§7.11) — 무수치 캡션(홈은 koreaMap·N 계산 미수신).
              store.synced 게이트(로그인 사용자 기기 간 방문 병합 완료 후라야 exclude 정확). */}
          <button
            type="button"
            onClick={onEmptySpot}
            disabled={!storeReady || !storeSynced || emptySpotPending}
            className="mt-3 w-full rounded-xl border border-indigo-300 bg-white/70 px-4 py-2.5 text-sm font-bold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-800 dark:bg-zinc-900/60 dark:text-indigo-300 dark:hover:bg-indigo-950"
          >
            {emptySpotPending
              ? "빈 곳을 찾는 중…"
              : storeReady && !storeSynced
                ? "동기화 중…"
                : "🔭 빈 곳에서 뽑기"}
          </button>
          <p className="mt-1.5 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            아직 발도장 없는 한적한 동네에서
          </p>
        </>
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
