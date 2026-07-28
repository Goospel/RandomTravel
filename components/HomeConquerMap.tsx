"use client";

// 🎰 홈 통합 카드의 위쪽 — 스탯 행 + 250조각 정복 지도(= 룰렛 본체) + 결과 칩.
//   koreaMap(~207KB)·lib/conquer 를 쓰므로 **이 파일 전체가 page.tsx 에서 dynamic(ssr:false)**
//   으로 분리된다 — 홈 초기 청크에 koreaMap 이 안 실리게(§7.11 보호 유지).
//   그래서 착지 좌표→시·군·구 판정(sigunguAt)과 정복 집계도 여기서 한다(page 는 좌표만 넘긴다).

import { useMemo } from "react";
import Link from "next/link";
import { conqueredSigunguCodes, sigunguAt, TOTAL_SIGUNGU } from "@/lib/conquer";
import { ConquerSvg, type MapPhase } from "@/components/ConquerSvg";
import { visitedAreaCodes } from "@/lib/visitedAreas";
import { AREA_CODES, AREA_NAME } from "@/lib/constants";
import { Icon } from "@/components/icons";
import type { SavedPlace } from "@/lib/travelStore";

export function HomeConquerMap({
  visited,
  storeReady,
  phase,
  landedLat,
  landedLng,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
  /** 🎰 뽑기 lifecycle 파생 — idle / loading(번쩍임) / result(착지) */
  phase: MapPhase;
  /** 🎯 결과 좌표 — 이 좌표의 시·군·구에 착지. 없으면 강조 없이 종료 */
  landedLat: number | null;
  landedLng: number | null;
}) {
  const conquered = useMemo(() => conqueredSigunguCodes(visited), [visited]);
  const n = conquered.size;
  const percent = Math.round((n / TOTAL_SIGUNGU) * 100);
  // 1곳이라도 정복했으면 0% 로 안 보이게(ConquerMap 히어로와 같은 규칙).
  const percentLabel = n > 0 && percent < 1 ? 1 : percent;
  const areaCount = visitedAreaCodes(visited).size;

  // 🎯 착지 조각 — 좌표 없음·판정 실패(먼바다 등)면 null(강조·칩 미렌더).
  const landed = useMemo(
    () =>
      phase === "result" && landedLat != null && landedLng != null
        ? sigunguAt(landedLat, landedLng)
        : null,
    [phase, landedLat, landedLng],
  );

  return (
    <>
      <div className="flex items-center gap-[14px] px-5 py-4">
        <div
          className="flex h-14 w-14 flex-none items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--g-primary) ${Math.max(percent, n > 0 ? 3 : 0)}%, var(--g-ring-track) 0)`,
          }}
          aria-hidden
        >
          <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-g-surface font-display text-[13px] font-bold tracking-[-0.02em] text-g-primary">
            {storeReady ? `${percentLabel}%` : "–"}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-display text-[17px] font-bold leading-[1.3] tracking-[-0.03em]">
            {n}
            <span className="font-body text-[13px] font-medium leading-[1.4] tracking-normal text-g-text-2">
              {" "}
              / {TOTAL_SIGUNGU} 시·군·구
            </span>
          </div>
          <div className="mt-[3px] text-[12px] leading-[1.4] text-g-text-2">
            다녀온 곳 {visited.length} · 발 들인 시·도 {areaCount} / {AREA_CODES.length}
          </div>
        </div>

        <Link
          href="/map"
          className="inline-flex h-[34px] flex-none items-center gap-1.5 rounded-md border border-g-border bg-g-surface px-3 text-[12px] font-medium text-g-text-2 hover:border-g-primary hover:text-g-primary"
        >
          지도 크게 보기
          <Icon name="arrowRight" size={13} />
        </Link>
      </div>

      <div className="relative px-5 pb-1">
        <ConquerSvg
          conquered={conquered}
          phase={phase}
          highlight={landed?.code ?? null}
          className="mx-auto block h-auto w-full max-w-[380px]"
        />
        {landed && (
          // 지도 SVG 가 실제로 렌더된 뒤에만 뜬다 — 이 컴포넌트 자체가 지도 청크라
          // 여기 도달했으면 지도는 이미 그려져 있다(로딩 플레이스홀더와 겹칠 창이 없음).
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <span className="animate-card-reveal inline-flex items-center gap-1.5 rounded-full bg-g-primary px-3.5 py-[7px] text-[13px] font-bold text-g-on-primary">
              <Icon name="pin" size={13} />
              {AREA_NAME[landed.area]} {landed.name}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
