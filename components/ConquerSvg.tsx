"use client";

// 🧩 시·군·구 정복 지도 SVG(M12 → M23에서 ConquerMap 밖으로 추출) —
//   `/map` 정복 지도와 홈 통합 카드가 **같은 그림**을 공유한다(§7.12).
//   🎰 룰렛은 phase 하나로 표현한다(Genesis 리스킨):
//     idle    — 정복 조각 primary, 미정복 map-empty
//     loading — 위 + 오버레이 <g> 가 조각 일부를 primary 로 깔고 map-flick 스태거
//     result  — 뽑힌 조각만 fill-opacity 1(나머지 0.45) + 펄스 링·점 마커
//   회전 타이밍을 JS 로 돌리지 않으므로(구 lib/roulette 제거) 렌더는 순수 함수다.

import {
  KOREA_MAP_VIEWBOX,
  KOREA_SIGUNGU,
  KOREA_SIGUNGU_TOTAL,
  KOREA_SIDO_OUTLINES,
  type Sigungu,
} from "@/lib/koreaMap";
import { ringsCentroid } from "@/lib/conquer";

/** 지도 상태 — 홈 뽑기 lifecycle 에서 파생(새 상태 아님). `/map` 은 항상 idle. */
export type MapPhase = "idle" | "loading" | "result";

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
const SIGUNGU_PATHS: {
  sg: Sigungu;
  d: string;
  c: { x: number; y: number } | null;
}[] = KOREA_SIGUNGU.map((sg) => ({
  sg,
  d: ringsToPath(sg.rings),
  c: ringsCentroid(sg.rings),
}));
const SIDO_OUTLINE_PATHS: string[] = Object.values(KOREA_SIDO_OUTLINES);

// 뽑는 중 번쩍일 조각 — 3번째부터 9칸 간격(총 28개)이라 전국에 고르게 흩어진다.
// delay 는 9단(0~720ms) 스태거 — 물결처럼 도는 게 의도다.
//   ⚠️ 시안 코드의 `(i % 9) * 90` 은 i가 항상 3 mod 9 라 전부 270ms(스태거 0)로 계산된다.
//   핸드오프 본문이 명시한 "delay 스태거"를 따라 **뽑힌 순번(k)** 기준으로 벌렸다.
const FLICK = SIGUNGU_PATHS.filter((_, i) => i >= 3 && (i - 3) % 9 === 0).map(
  (p, k) => ({ code: p.sg.code, d: p.d, delayMs: (k % 9) * 90 }),
);

export function ConquerSvg({
  conquered,
  phase = "idle",
  highlight = null,
  className = "mx-auto block h-auto w-full max-w-[400px]",
}: {
  /** 정복한 시·군·구 code */
  conquered: Set<string>;
  /** 🎰 뽑기 lifecycle 에서 파생한 지도 상태 */
  phase?: MapPhase;
  /** 🎯 뽑힌 시·군·구 code — phase="result" 일 때만 쓰인다(마커·강조) */
  highlight?: string | null;
  className?: string;
}) {
  const n = conquered.size;
  const isResult = phase === "result";
  const hit = isResult ? SIGUNGU_PATHS.find((p) => p.sg.code === highlight) : undefined;

  const label =
    phase === "loading"
      ? "전국 시·군·구를 뽑는 중"
      : isResult && hit
        ? `뽑힌 시·군·구 — ${hit.sg.name}`
        : `전국 정복 지도 — 시·군·구 ${KOREA_SIGUNGU_TOTAL}곳 중 ${n}곳 정복`;

  return (
    <svg viewBox={KOREA_MAP_VIEWBOX} role="img" aria-label={label} className={className}>
      <g>
        {SIGUNGU_PATHS.map(({ sg, d }) => {
          const on = conquered.has(sg.code);
          const isHit = isResult && sg.code === highlight;
          return (
            <path
              key={sg.code}
              d={d}
              vectorEffect="non-scaling-stroke"
              strokeWidth={0.5}
              // 결과일 때 뽑힌 조각만 온전히, 나머지는 0.4 로 눌러 시선을 하나로 모은다.
              fillOpacity={isResult && !isHit ? 0.4 : 1}
              className={`stroke-g-map-stroke ${
                on || isHit ? "fill-g-primary" : "fill-g-map-empty"
              }`}
            >
              <title>{`${sg.name} · ${on ? "정복 ✓" : "미정복"}`}</title>
            </path>
          );
        })}
      </g>

      <g fill="none" className="stroke-g-sido-stroke" opacity={0.5} aria-hidden="true">
        {SIDO_OUTLINE_PATHS.map((d, i) => (
          <path key={i} d={d} vectorEffect="non-scaling-stroke" strokeWidth={1} />
        ))}
      </g>

      {phase === "loading" && (
        <g aria-hidden="true">
          {FLICK.map(({ code, d, delayMs }) => (
            <path
              key={code}
              d={d}
              className="animate-map-flick fill-g-primary"
              style={{ animationDelay: `${delayMs}ms` }}
            />
          ))}
        </g>
      )}

      {hit?.c && (
        // 마커만 주홍(--g-accent-bright) — 틸 조각 위에서 결과가 즉시 눈에 띈다.
        // 글자를 얹지 않는 요소라 대비 제약이 없다(designGuide 함정 2).
        <g aria-hidden="true">
          <circle
            cx={hit.c.x}
            cy={hit.c.y}
            r={9}
            className="animate-pin-pulse fill-g-accent-bright"
          />
          <circle
            cx={hit.c.x}
            cy={hit.c.y}
            r={7}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
            className="fill-g-accent-bright stroke-g-surface"
          />
        </g>
      )}
    </svg>
  );
}
