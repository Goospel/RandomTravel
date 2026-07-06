"use client";

// 🧩 전국 정복 지도(M12 + M16 리디자인) — 다녀온 곳의 좌표로 시·군·구를 "정복"으로 칠한다.
//   순수 집계·판정은 lib/conquer, 윤곽은 lib/koreaMap(생성물). 여기선 히어로+SVG+진행보드 렌더.
//   히어로: 정복률 링 + 3통계(시·군·구·다녀온 곳·시·도) + 탐험가 레벨 진행바.

import { useMemo } from "react";
import {
  conqueredSigunguCodes,
  visitedAreaCodes,
  TOTAL_SIGUNGU,
} from "@/lib/conquer";
import {
  KOREA_MAP_VIEWBOX,
  KOREA_SIGUNGU,
  KOREA_SIDO_OUTLINES,
  type Sigungu,
} from "@/lib/koreaMap";
import { AREA_NAME } from "@/lib/constants";
import { explorerLevel } from "@/lib/level";
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

// 시·도별 전체 시·군·구 수 + code→area — 모듈 로드 시 1회.
const AREA_TOTAL = new Map<number, number>();
const AREA_BY_CODE = new Map<string, number>();
for (const sg of KOREA_SIGUNGU) {
  AREA_TOTAL.set(sg.area, (AREA_TOTAL.get(sg.area) ?? 0) + 1);
  AREA_BY_CODE.set(sg.code, sg.area);
}
// 진행 보드 배치 순서(대략 지리적 그룹) — 프로토타입 계승.
const BOARD_ORDER = [1, 2, 31, 32, 34, 8, 33, 35, 37, 3, 4, 7, 5, 38, 36, 6, 39];

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
  const percentLabel = n > 0 && percent < 1 ? 1 : percent;
  const areaCount = visitedAreaCodes(visited).size;
  const level = explorerLevel(n);

  // 시·도별 정복 수(정복 set 기준).
  const doneByArea = useMemo(() => {
    const m = new Map<number, number>();
    for (const code of conquered) {
      const a = AREA_BY_CODE.get(code);
      if (a != null) m.set(a, (m.get(a) ?? 0) + 1);
    }
    return m;
  }, [conquered]);

  return (
    <div className="flex flex-col gap-4">
      {/* 히어로 — 정복률 링 + 통계 + 레벨 */}
      <section className="rounded-[20px] border border-emerald-200 bg-[linear-gradient(160deg,#dcfce7,#f0fdf4_70%,#ffffff)] p-5 shadow-[0_10px_30px_-20px_rgba(5,120,80,0.4)] dark:border-emerald-900/50 dark:bg-[linear-gradient(160deg,#052e2b,#0a0a0a_70%)]">
        <div className="flex flex-wrap items-center gap-5">
          <div
            className="flex h-24 w-24 flex-none items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#059669 ${Math.max(percent, n > 0 ? 3 : 0)}%, #d1fae5 0)`,
            }}
            aria-hidden
          >
            <div className="flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full bg-white dark:bg-zinc-950">
              <div className="text-[22px] font-extrabold leading-none text-emerald-600">
                {storeReady ? `${percentLabel}%` : "–"}
              </div>
              <div className="text-[10px] font-semibold text-zinc-400">정복률</div>
            </div>
          </div>

          <div className="min-w-[200px] flex-1">
            <div className="mb-3 flex flex-wrap gap-5">
              <Stat value={`${n}`} sub={`/ ${total}`} label="정복한 시·군·구" />
              <Stat value={`${visited.length}`} label="다녀온 곳" />
              <Stat value={`${areaCount}`} sub="/ 17" label="발 들인 시·도" />
            </div>
            <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-semibold text-emerald-800/70 dark:text-emerald-300/70">
              <span>
                {level.emoji} {level.name}
              </span>
              <span>
                {level.next == null
                  ? "최고 레벨"
                  : `다음까지 ${level.remaining}곳`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-emerald-600/15">
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
                style={{ width: `${Math.max(4, level.progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* 퍼즐 지도 + 진행 보드 */}
      <div className="flex flex-wrap items-start gap-4">
        <section className="min-w-[300px] flex-[1_1_360px] rounded-[20px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_-22px_rgba(20,40,30,0.35)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-extrabold">🧩 시·군·구 정복 지도</span>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-emerald-600" />
                정복
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#e6efe9] dark:bg-zinc-700" />
                미정복
              </span>
            </div>
          </div>
          <svg
            viewBox={KOREA_MAP_VIEWBOX}
            role="img"
            aria-label={`전국 정복 지도 — 시·군·구 ${total}곳 중 ${n}곳 정복`}
            className="mx-auto block h-auto w-full max-w-[400px]"
          >
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
                        ? "fill-emerald-600 dark:fill-emerald-600"
                        : "fill-[#e6efe9] dark:fill-zinc-800"
                    }`}
                  >
                    <title>{`${sg.name} · ${on ? "정복 ✓" : "미정복"}`}</title>
                  </path>
                );
              })}
            </g>
            <g fill="none" className="stroke-slate-400 dark:stroke-zinc-600" aria-hidden="true">
              {SIDO_OUTLINE_PATHS.map((d, i) => (
                <path key={i} d={d} vectorEffect="non-scaling-stroke" strokeWidth={1} opacity={0.55} />
              ))}
            </g>
          </svg>
          <p className="mt-3 text-center text-[11.5px] text-zinc-400">
            다녀온 곳이 속한 시·군·구가 초록으로 칠해져요 · 조각 위에 올리면 이름이 보여요.
          </p>
        </section>

        <section className="min-w-[260px] flex-[1_1_280px] rounded-[20px] border border-zinc-200 bg-white p-4 shadow-[0_10px_30px_-22px_rgba(20,40,30,0.35)] dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3.5 text-sm font-extrabold">🏴 시·도별 진행</div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
            {BOARD_ORDER.map((code) => {
              const areaTotal = AREA_TOTAL.get(code) ?? 0;
              const done = doneByArea.get(code) ?? 0;
              const full = done > 0 && done >= areaTotal;
              return (
                <div
                  key={code}
                  className={`rounded-xl p-3 ${
                    full
                      ? "border-[1.5px] border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                      : done > 0
                        ? "border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20"
                        : "border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[13px] font-bold">
                      {AREA_NAME[code]}
                      {full ? " 🏴" : ""}
                    </span>
                    <span
                      className={`text-[11.5px] font-bold ${
                        done > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-300 dark:text-zinc-600"
                      }`}
                    >
                      {done} / {areaTotal}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-[3px]" aria-hidden>
                    {Array.from({ length: areaTotal }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-[2.5px] ${
                          i < done
                            ? i % 2
                              ? "bg-emerald-500"
                              : "bg-emerald-600"
                            : "bg-[#e6efe9] dark:bg-zinc-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, sub, label }: { value: string; sub?: string; label: string }) {
  return (
    <div>
      <div className="text-[26px] font-extrabold leading-none tracking-tight">
        {value}
        {sub && <span className="text-sm font-bold text-zinc-500"> {sub}</span>}
      </div>
      <div className="mt-0.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
    </div>
  );
}
