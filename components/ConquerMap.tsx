"use client";

// 🧩 전국 정복 지도(M12, plan.md §7.4) — 다녀온 곳의 areaCode 로 시·도를 "정복"으로 칠한다.
// 순수 집계는 lib/conquer, 시·도 윤곽은 lib/koreaMap(생성물). 여기선 SVG 렌더만.

import { conqueredAreaCodes, conquerStats } from "@/lib/conquer";
import {
  KOREA_MAP_VIEWBOX,
  KOREA_DRAW_ORDER,
  KOREA_PROVINCE_PATHS,
} from "@/lib/koreaMap";
import { AREA_CODES, AREA_NAME } from "@/lib/constants";
import type { SavedPlace } from "@/lib/travelStore";

export function ConquerMap({
  visited,
  storeReady,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
}) {
  const conquered = conqueredAreaCodes(visited);
  const { conquered: n, total, percent } = conquerStats(visited);

  // 정복한 시·도 이름(칩용) — AREA_CODES 순서(지역번호 오름차순)로 정렬해 안정적 표시.
  const conqueredNames = AREA_CODES.filter((a) => conquered.has(a.code)).map(
    (a) => a.name,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 정복률 게이지 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">🏴 전국 정복률</span>
          <span aria-live="polite" className="text-sm text-zinc-500 dark:text-zinc-400">
            {storeReady ? `${n} / ${total} · ${percent}%` : " "}
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="전국 정복률"
        >
          <div
            className="h-full rounded-full bg-indigo-600 transition-[width] duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 시·도 퍼즐 지도 */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <svg
          viewBox={KOREA_MAP_VIEWBOX}
          role="img"
          aria-label={`전국 정복 지도 — 17개 시·도 중 ${n}개 정복`}
          className="mx-auto h-auto w-full max-w-[380px]"
        >
          {KOREA_DRAW_ORDER.map((code) => {
            const on = conquered.has(code);
            return (
              <path
                key={code}
                d={KOREA_PROVINCE_PATHS[code]}
                vectorEffect="non-scaling-stroke"
                fillRule="evenodd"
                strokeWidth={1}
                className={`stroke-white transition-[fill] duration-500 dark:stroke-zinc-950 ${
                  on
                    ? "fill-indigo-500 dark:fill-indigo-500"
                    : "fill-zinc-200 dark:fill-zinc-800"
                }`}
              >
                <title>{`${AREA_NAME[code]} · ${on ? "정복 ✓" : "미정복"}`}</title>
              </path>
            );
          })}
        </svg>
      </div>

      {/* 정복한 시·도 이름 / 빈 상태 안내 */}
      {storeReady && n > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="정복한 시·도">
          {conqueredNames.map((name) => (
            <span
              key={name}
              className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {name}
            </span>
          ))}
        </div>
      ) : storeReady ? (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          아직 정복한 지역이 없어요. 여행지를 뽑고 &apos;다녀왔어요 ✔&apos;를 체크하면
          그 지역이 채워져요.
        </p>
      ) : null}
    </div>
  );
}
