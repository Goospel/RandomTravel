"use client";

// 🧩 전국 정복 지도(Genesis 리스킨) — 다녀온 곳의 좌표로 시·군·구를 "정복"으로 칠한다.
//   순수 집계·판정은 lib/conquer, 윤곽은 lib/koreaMap(생성물). 여기선 히어로+진행보드 렌더.
//   지도 SVG 자체는 components/ConquerSvg — 홈 통합 카드와 공유한다(§7.12).
//   히어로: 정복률 링 + 3통계(시·군·구·다녀온 곳·시·도) + 탐험가 레벨 진행바.

import { useMemo, type ReactNode } from "react";
import {
  conqueredSigunguCodes,
  visitedAreaCodes,
  TOTAL_SIGUNGU,
} from "@/lib/conquer";
import { KOREA_SIGUNGU } from "@/lib/koreaMap";
import { ConquerSvg } from "@/components/ConquerSvg";
import { AREA_NAME } from "@/lib/constants";
import { explorerLevel } from "@/lib/level";
import { Icon } from "@/components/icons";
import type { SavedPlace } from "@/lib/travelStore";

// 시·도별 전체 시·군·구 수 + code→area — 모듈 로드 시 1회.
const AREA_TOTAL = new Map<number, number>();
const AREA_BY_CODE = new Map<string, number>();
for (const sg of KOREA_SIGUNGU) {
  AREA_TOTAL.set(sg.area, (AREA_TOTAL.get(sg.area) ?? 0) + 1);
  AREA_BY_CODE.set(sg.code, sg.area);
}
// 진행 보드 배치 순서(대략 지리적 그룹) — 프로토타입 계승.
const BOARD_ORDER = [1, 2, 31, 32, 34, 8, 33, 35, 37, 3, 4, 7, 5, 38, 36, 6, 39];

const CARD = "rounded-xl border border-g-border bg-g-surface";
const SECTION_TITLE =
  "inline-flex items-center gap-2 font-display text-[15px] font-bold leading-[1.3] tracking-[-0.02em]";

export function ConquerMap({
  visited,
  storeReady,
  cta,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
  /** 🔭 히어로 바로 아래에 끼울 CTA(빈 곳에서 뽑기) — 없으면 미렌더. */
  cta?: ReactNode;
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
    <div className="flex flex-col gap-5">
      {/* 히어로 — 정복률 링 + 통계 + 레벨 */}
      <section className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-center gap-6">
          <div
            className="flex h-24 w-24 flex-none items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--g-primary) ${Math.max(percent, n > 0 ? 3 : 0)}%, var(--g-ring-track) 0)`,
            }}
            aria-hidden
          >
            <div className="flex h-[78px] w-[78px] flex-col items-center justify-center gap-[3px] rounded-full bg-g-surface">
              <div className="font-display text-[24px] font-bold leading-none tracking-[-0.03em] text-g-primary">
                {storeReady ? `${percentLabel}%` : "–"}
              </div>
              <div className="text-[11px] font-medium uppercase leading-none tracking-[0.08em] text-g-neutral">
                정복률
              </div>
            </div>
          </div>

          <div className="min-w-[200px] flex-[1_1_220px]">
            <div className="mb-5 flex flex-wrap gap-5">
              <Stat value={`${n}`} sub={`/ ${total}`} label="정복한 시·군·구" />
              <Stat value={`${visited.length}`} label="다녀온 곳" />
              <Stat value={`${areaCount}`} sub="/ 17" label="발 들인 시·도" />
            </div>
            <div className="mb-2 flex items-center justify-between gap-3 text-[13px] font-medium leading-none text-g-text-2">
              <span className="inline-flex items-center gap-1.5">
                <Icon name={level.icon} size={14} className="text-g-primary" />
                {level.name}
              </span>
              <span>
                {level.next == null ? "최고 레벨" : `다음까지 ${level.remaining}곳`}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-g-ring-track">
              <div
                className="h-full rounded-full bg-g-primary transition-[width] duration-500"
                style={{ width: `${Math.max(4, level.progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {cta}

      {/* 퍼즐 지도 + 진행 보드 */}
      <div className="flex flex-wrap items-start gap-5">
        <section className={`${CARD} min-w-[300px] flex-[1_1_360px] p-5`}>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <span className={SECTION_TITLE}>
              <Icon name="grid" size={15} className="text-g-primary" />
              시·군·구 정복 지도
            </span>
            <div className="flex items-center gap-3 text-[11px] font-medium leading-none text-g-neutral">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-g-primary" />
                정복
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-g-map-empty" />
                미정복
              </span>
            </div>
          </div>
          <ConquerSvg
            conquered={conquered}
            className="mx-auto block h-auto w-full max-w-[320px]"
          />
          <p className="mt-3.5 text-center text-[12px] leading-[1.6] text-g-neutral">
            다녀온 곳이 속한 시·군·구가 채워져요 · 조각 위에 올리면 이름이 보여요.
          </p>
        </section>

        <section className={`${CARD} min-w-[260px] flex-[1_1_280px] p-5`}>
          <div className={`mb-3.5 ${SECTION_TITLE}`}>
            <Icon name="flag" size={15} className="text-g-primary" />
            시·도별 진행
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
            {BOARD_ORDER.map((code) => {
              const areaTotal = AREA_TOTAL.get(code) ?? 0;
              const done = doneByArea.get(code) ?? 0;
              const full = done > 0 && done >= areaTotal;
              return (
                <div
                  key={code}
                  className={`rounded-lg p-3 ${
                    full
                      ? "border-[1.5px] border-g-primary bg-g-primary-soft"
                      : done > 0
                        ? "border border-g-primary-soft-border bg-g-surface"
                        : "border border-g-border bg-g-surface-2"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold leading-none">
                      {AREA_NAME[code]}
                      {full && <Icon name="flag" size={12} className="text-g-primary" />}
                    </span>
                    <span
                      className={`whitespace-nowrap text-[12px] font-bold leading-none ${
                        done > 0 ? "text-g-primary-text" : "text-g-neutral"
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
                              ? "bg-g-dot-alt"
                              : "bg-g-primary"
                            : "bg-g-map-empty"
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
      <div className="font-display text-[32px] font-bold leading-none tracking-[-0.03em]">
        {value}
        {sub && (
          <span className="font-body text-[15px] font-medium tracking-normal text-g-text-2">
            {" "}
            {sub}
          </span>
        )}
      </div>
      <div className="mt-1.5 text-[12px] font-medium leading-none text-g-text-2">
        {label}
      </div>
    </div>
  );
}
