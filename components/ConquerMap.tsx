"use client";

// 🧩 여행 스탬프북 — 다녀온 곳의 좌표로 시·군·구에 도장을 찍는다.
//   순수 집계·판정은 lib/conquer, 윤곽은 lib/koreaMap(생성물). 여기선 히어로+진행보드 렌더.
//   지도 SVG 자체는 components/ConquerSvg — 홈 티켓 카드와 공유한다(§7.12).
//   히어로는 이 화면에서 유일한 틸 면이다(밝은 잉크를 얹으므로 --g-primary-deep).

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

const CARD = "rounded-2xl border border-g-border bg-g-surface";
const SECTION_TITLE =
  "inline-flex items-center gap-2 font-display text-[15px] font-bold leading-[1.3] tracking-[-0.02em]";
/** 섹션 제목 앞 22px 아이콘 칩 — 색만 섹션마다 다르다. */
const TITLE_CHIP =
  "inline-flex h-[22px] w-[22px] items-center justify-center rounded-[7px]";

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
      {/* 히어로 — 정복률 링 + 통계 + 레벨 + 🔭 CTA. 화면에서 유일한 색 찬 면. */}
      <section className="flex flex-wrap items-center gap-[26px] rounded-2xl border border-g-border bg-g-primary-deep p-6 text-g-on-primary">
        <div
          className="flex h-[104px] w-[104px] flex-none items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--g-sun) ${Math.max(percent, n > 0 ? 3 : 0)}%, rgba(251,246,236,.2) 0)`,
          }}
          aria-hidden
        >
          <div className="flex h-[84px] w-[84px] flex-col items-center justify-center gap-[3px] rounded-full bg-g-primary-deep">
            <div className="font-display text-[26px] font-bold leading-none tracking-[-0.03em]">
              {storeReady ? `${percentLabel}%` : "–"}
            </div>
            <div className="text-[10px] font-bold uppercase leading-none tracking-[0.12em] opacity-[.78]">
              정복률
            </div>
          </div>
        </div>

        <div className="min-w-[200px] flex-[1_1_240px]">
          <div className="mb-[18px] flex flex-wrap gap-[26px]">
            <Stat value={`${n}`} sub={`/ ${total}`} label="시·군·구" />
            <Stat value={`${visited.length}`} label="다녀온 곳" />
            <Stat value={`${areaCount}`} sub="/ 17" label="시·도" />
          </div>
          <div className="mb-2 flex items-center justify-between gap-3 text-[13px] font-bold leading-none">
            <span className="inline-flex items-center gap-1.5">
              <Icon name={level.icon} size={14} className="text-g-sun" />
              {level.name}
            </span>
            <span className="font-medium opacity-[.75]">
              {level.next == null ? "최고 레벨" : `다음까지 ${level.remaining}곳`}
            </span>
          </div>
          <div className="h-[9px] overflow-hidden rounded-full bg-[rgba(251,246,236,.2)]">
            <div
              className="h-full rounded-full bg-g-sun transition-[width] duration-500"
              style={{ width: `${Math.max(4, level.progressPercent)}%` }}
            />
          </div>
        </div>

        {/* 🔭 빈 곳에서 뽑기 — 히어로 오른쪽 끝(옛 위치는 히어로 아래 별도 줄이었다). */}
        {cta}
      </section>

      {/* 스탬프 지도 + 진행 보드 */}
      <div className="flex flex-wrap items-start gap-5">
        <section className={`${CARD} bg-g-grid min-w-[300px] flex-[1_1_360px] p-5`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
            <span className={SECTION_TITLE}>
              <span className={`${TITLE_CHIP} bg-g-primary-soft text-g-primary`}>
                <Icon name="grid" size={13} />
              </span>
              시·군·구 스탬프 지도
            </span>
            <div className="flex items-center gap-3 text-[11px] font-medium leading-none text-g-text-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-g-primary" />
                찍음
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-g-map-empty" />빈 칸
              </span>
            </div>
          </div>
          <ConquerSvg
            conquered={conquered}
            className="mx-auto block h-auto w-full max-w-[340px]"
          />
        </section>

        <section className={`${CARD} min-w-[260px] flex-[1_1_280px] p-5`}>
          <div className={`mb-3.5 ${SECTION_TITLE}`}>
            <span className={`${TITLE_CHIP} bg-g-warning-soft text-g-warning-text`}>
              <Icon name="flag" size={13} />
            </span>
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
                  className={`rounded-xl p-3 ${
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
                        done > 0 ? "text-g-primary-text" : "text-g-num"
                      }`}
                    >
                      {done} / {areaTotal}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-[3px]" aria-hidden>
                    {Array.from({ length: areaTotal }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-[2px] ${
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

/** 히어로 스탯 — 틸 면 위라 잉크는 상속(--g-on-primary), 위계는 opacity 로만 만든다. */
function Stat({ value, sub, label }: { value: string; sub?: string; label: string }) {
  return (
    <div>
      <div className="font-display text-[34px] font-bold leading-none tracking-[-0.03em]">
        {value}
        {sub && (
          <span className="font-body text-[15px] font-medium tracking-normal opacity-[.78]">
            {" "}
            {sub}
          </span>
        )}
      </div>
      <div className="mt-[7px] text-[12px] font-medium leading-none opacity-[.75]">
        {label}
      </div>
    </div>
  );
}
