"use client";

// 🧩 시·군·구 정복 지도 SVG(M12 → M23에서 ConquerMap 밖으로 추출) —
//   `/map` 정복 지도와 홈 히어로가 **같은 그림**을 공유한다(§7.12).
//   🎰 룰렛은 flashing(이번 tick 에 켤 조각)·spinning(전환 애니메이션 차단)으로만 관여한다.

import {
  KOREA_MAP_VIEWBOX,
  KOREA_SIGUNGU,
  KOREA_SIGUNGU_TOTAL,
  KOREA_SIDO_OUTLINES,
  type Sigungu,
} from "@/lib/koreaMap";

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

export function ConquerSvg({
  conquered,
  flashing,
  spinning = false,
  className = "mx-auto block h-auto w-full max-w-[400px]",
}: {
  /** 정복한 시·군·구 code(초록) */
  conquered: Set<string>;
  /** 🎰 이번 tick 에 점등할 code(호박색 — 정복색을 덮되 정복 상태는 안 건드림) */
  flashing?: Set<string>;
  /** 🎰 회전 중 — fill 트랜지션(0.5s)을 끈다. 안 끄면 수십 ms tick 이 뭉개진다. */
  spinning?: boolean;
  className?: string;
}) {
  const n = conquered.size;

  return (
    <svg
      viewBox={KOREA_MAP_VIEWBOX}
      role="img"
      aria-label={`전국 정복 지도 — 시·군·구 ${KOREA_SIGUNGU_TOTAL}곳 중 ${n}곳 정복`}
      className={className}
    >
      <g>
        {SIGUNGU_PATHS.map(({ sg, d }) => {
          const on = conquered.has(sg.code);
          const flash = flashing?.has(sg.code) ?? false;
          const fill = flash
            ? "fill-amber-400 dark:fill-amber-400"
            : on
              ? "fill-emerald-600 dark:fill-emerald-600"
              : "fill-[#e6efe9] dark:fill-zinc-800";
          return (
            <path
              key={sg.code}
              d={d}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.5}
              className={`stroke-white dark:stroke-zinc-950 ${
                spinning ? "" : "transition-[fill] duration-500"
              } ${fill}`}
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
  );
}

/** 룰렛 점등 후보 — 전체 시·군·구 code(모듈 로드 시 1회). */
export const ALL_SIGUNGU_CODES: string[] = KOREA_SIGUNGU.map((sg) => sg.code);
