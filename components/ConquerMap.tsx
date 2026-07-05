"use client";

// 🧩 전국 정복 지도(M12, plan.md §7.4) — 다녀온 곳의 좌표로 시·군·구를 "정복"으로 칠한다.
// 순수 집계·판정은 lib/conquer, 시·군·구/시·도 윤곽은 lib/koreaMap(생성물). 여기선 SVG 렌더만.

import { useMemo } from "react";
import {
  conqueredSigunguCodes,
  conquerByArea,
  TOTAL_SIGUNGU,
} from "@/lib/conquer";
import {
  KOREA_MAP_VIEWBOX,
  KOREA_SIGUNGU,
  KOREA_SIDO_OUTLINES,
  type Sigungu,
} from "@/lib/koreaMap";
import { AREA_NAME } from "@/lib/constants";
import type { SavedPlace } from "@/lib/travelStore";

// 평탄 링([x0,y0,x1,y1,...])들 → SVG path d. 정적이라 모듈 로드 시 1회만 계산.
function ringsToPath(rings: number[][]): string {
  let d = "";
  for (const r of rings) {
    if (r.length < 6) continue;
    d += "M" + r[0] + " " + r[1];
    for (let i = 2; i < r.length; i += 2) d += "L" + r[i] + " " + r[i + 1];
    d += "Z";
  }
  return d;
}
const SIGUNGU_PATHS: { sg: Sigungu; d: string }[] = KOREA_SIGUNGU.map((sg) => ({
  sg,
  d: ringsToPath(sg.rings),
}));
const SIDO_OUTLINE_PATHS: string[] = Object.values(KOREA_SIDO_OUTLINES);

export function ConquerMap({
  visited,
  storeReady,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
}) {
  // 정복 판정(좌표 투영+ray casting)은 한 번만 — 통계는 이 Set 에서 파생(이중 계산 방지).
  const conquered = useMemo(() => conqueredSigunguCodes(visited), [visited]);
  const n = conquered.size;
  const total = TOTAL_SIGUNGU;
  const percent = Math.round((n / total) * 100);
  // 250개 분모라 1~2곳은 반올림 0% → 방금 정복했는데 0%로 보이는 김빠짐 방지.
  const percentLabel = n > 0 && percent < 1 ? "1% 미만" : `${percent}%`;
  // 게이지 막대도 정복이 있으면 최소 한 조각은 보이게(값 0%여도 2% 슬리버).
  const barWidth = n > 0 ? Math.max(percent, 2) : percent;
  const byArea = useMemo(() => conquerByArea(conquered), [conquered]);

  return (
    <div className="flex flex-col gap-4">
      {/* 정복률 게이지 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">🏴 전국 정복률</span>
          <span aria-live="polite" className="text-sm text-zinc-500 dark:text-zinc-400">
            {storeReady ? `${n} / ${total}곳 · ${percentLabel}` : " "}
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
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* 시·군·구 퍼즐 지도 */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <svg
          viewBox={KOREA_MAP_VIEWBOX}
          role="img"
          aria-label={`전국 정복 지도 — 시·군·구 ${total}곳 중 ${n}곳 정복`}
          className="mx-auto h-auto w-full max-w-[420px]"
        >
          {/* 시·군·구 채우기 */}
          <g>
            {SIGUNGU_PATHS.map(({ sg, d }) => {
              const on = conquered.has(sg.code);
              return (
                <path
                  key={sg.code}
                  d={d}
                  vectorEffect="non-scaling-stroke"
                  strokeWidth={0.5}
                  className={`stroke-white transition-[fill] duration-500 dark:stroke-zinc-950 ${
                    on
                      ? "fill-indigo-500 dark:fill-indigo-500"
                      : "fill-zinc-200 dark:fill-zinc-800"
                  }`}
                >
                  <title>{`${sg.name} · ${on ? "정복 ✓" : "미정복"}`}</title>
                </path>
              );
            })}
          </g>
          {/* 시·도 외곽선 오버레이(방향 잡기용) */}
          <g fill="none" className="stroke-zinc-400 dark:stroke-zinc-600" aria-hidden="true">
            {SIDO_OUTLINE_PATHS.map((d, i) => (
              <path key={i} d={d} vectorEffect="non-scaling-stroke" strokeWidth={1.2} />
            ))}
          </g>
        </svg>
      </div>

      {/* 시·도별 진행 / 빈 상태 안내 */}
      {storeReady && n > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="시·도별 정복 현황">
          {byArea.map((a) => (
            <span
              key={a.area}
              className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {AREA_NAME[a.area]} {a.done}/{a.total}
            </span>
          ))}
        </div>
      ) : storeReady ? (
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
          아직 정복한 지역이 없어요. 여행지를 뽑고 &apos;다녀왔어요 ✔&apos;를 체크하면
          그 시·군·구가 채워져요.
        </p>
      ) : null}
    </div>
  );
}
