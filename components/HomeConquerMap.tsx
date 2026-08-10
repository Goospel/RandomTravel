"use client";

// 🎫 홈 티켓 카드의 위쪽 — 틸 스텁(정복률 링·도장 수·레벨) + 모눈 지도면(= 룰렛 본체) + 결과 칩.
//   koreaMap(~207KB)·lib/conquer 를 쓰므로 **이 파일 전체가 page.tsx 에서 dynamic(ssr:false)**
//   으로 분리된다 — 홈 초기 청크에 koreaMap 이 안 실리게(§7.11 보호 유지).
//   그래서 착지 좌표→시·군·구 판정(sigunguAt)과 정복 집계도 여기서 한다(page 는 좌표만 넘긴다).

import { useMemo } from "react";
import Link from "next/link";
import { conqueredSigunguCodes, sigunguAt, TOTAL_SIGUNGU } from "@/lib/conquer";
import { ConquerSvg, type MapPhase } from "@/components/ConquerSvg";
import { explorerLevel } from "@/lib/level";
import { AREA_NAME } from "@/lib/constants";
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
  const level = explorerLevel(n);

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
      {/* 🎫 티켓 스텁 — 카드에서 유일하게 색이 찬 면. 밝은 잉크를 얹으므로 --g-primary 가 아니라
          한 단 어두운 --g-primary-deep 을 쓴다(대비 7.2:1 — designGuide 함정 1). */}
      <div className="flex items-center gap-[14px] bg-g-primary-deep px-5 pb-3.5 pt-4 text-g-on-primary">
        <div
          className="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--g-sun) ${Math.max(percent, n > 0 ? 3 : 0)}%, rgba(251,246,236,.22) 0)`,
          }}
          aria-hidden
        >
          <div className="flex h-[42px] w-[42px] items-center justify-center whitespace-nowrap rounded-full bg-g-primary-deep font-display text-[13px] font-bold tracking-[-0.02em]">
            {storeReady ? `${percentLabel}%` : "–"}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-display text-[18px] font-bold leading-[1.25] tracking-[-0.03em]">
            {n}
            <span className="font-body text-[13px] font-medium tracking-normal opacity-[.78]">
              {" "}
              / {TOTAL_SIGUNGU} 시·군·구에 도장
            </span>
          </div>
        </div>

        <div className="flex flex-none flex-col items-end gap-[5px]">
          <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[rgba(251,246,236,.16)] px-2.5 text-[12px] font-bold">
            <Icon name={level.icon} size={13} />
            {level.name}
          </span>
          <span className="text-[11px] leading-none opacity-[.78]">
            {level.next == null ? "최고 레벨" : `다음까지 ${level.remaining}곳`}
          </span>
        </div>
      </div>

      {/* 지도면 — 흰 종이 위 모눈. 지도가 룰렛 본체다. */}
      <div className="bg-g-surface bg-g-grid px-5 pb-2 pt-[18px]">
        <div className="relative">
          <ConquerSvg
            conquered={conquered}
            phase={phase}
            highlight={landed?.code ?? null}
            className="mx-auto block h-auto w-full max-w-[400px]"
          />
          {landed && (
            // 지도 SVG 가 실제로 렌더된 뒤에만 뜬다 — 이 컴포넌트 자체가 지도 청크라
            // 여기 도달했으면 지도는 이미 그려져 있다(로딩 플레이스홀더와 겹칠 창이 없음).
            <div className="absolute inset-x-0 bottom-1 flex justify-center">
              <span className="animate-card-reveal inline-flex items-center gap-1.5 rounded-full bg-g-text px-3.5 py-[7px] text-[13px] font-bold text-g-on-primary">
                <Icon name="pin" size={13} />
                {AREA_NAME[landed.area]} {landed.name}
              </span>
            </div>
          )}
        </div>

        {/* 범례 + /map 진입. 옛 '지도 크게 보기' 버튼 자리를 여기로 옮겼다 —
            스텁은 스펙이 링·도장 수·레벨 3칸으로 고정돼 있고, 홈에서 /map 으로 가는 길은
            여기 말고 없다(결과 카드의 '내 지도에서 확인'은 🔭 뽑기에서만 뜬다). */}
        <div className="flex items-center gap-3.5 pb-0.5 pt-1 text-[11px] font-medium leading-none text-g-text-3">
          <div className="flex flex-1 justify-center gap-3.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-g-primary" />
              찍음
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-[9px] w-[9px] rounded-[2px] bg-g-map-empty" />빈 칸
            </span>
          </div>
          <Link
            href="/map"
            className="inline-flex flex-none items-center gap-1 hover:text-g-primary"
          >
            크게 보기
            <Icon name="arrowRight" size={12} />
          </Link>
        </div>
      </div>
    </>
  );
}
