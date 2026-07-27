"use client";

// 🎰 홈 정복 지도 히어로(M23, plan.md §7.12) — 17개 시·도 타일을 대체한 250조각 SVG 지도 +
//   뽑는 동안 도는 룰렛. koreaMap(~207KB)·lib/conquer 를 쓰므로 **이 파일 전체가 MapHero 에서
//   dynamic(ssr:false) 로 분리**된다 — 홈 초기 청크에 koreaMap 이 안 실리게(§7.11 보호 유지).
//   그래서 착지 좌표→시·군·구 판정(sigunguAt)도 여기서 한다(page.tsx 는 좌표만 넘긴다).

import { useEffect, useMemo, useState } from "react";
import { conqueredSigunguCodes, sigunguAt, TOTAL_SIGUNGU } from "@/lib/conquer";
import { ConquerSvg, ALL_SIGUNGU_CODES } from "@/components/ConquerSvg";
import { rouletteFrame, pickFlashCodes } from "@/lib/roulette";
import type { SavedPlace } from "@/lib/travelStore";

// 감속이 끝나는 시각 — §7.9 슬롯 최소 노출(MIN_SPIN_MS 1.2s)과 같은 값. 뽑기가 더 오래
// 걸리면 이후엔 가장 느린 tick(1조각)으로 계속 돌다 결과 도착 시 착지한다.
const SPIN_TOTAL_MS = 1200;
// 착지 연출 — 당첨 조각 점등 → 껐다 → 다시 점등하고 **그대로 유지**(해제 스텝 없음).
//   다음 뽑기의 회전이 덮을 때까지 남는다.
const LAND_STEPS_MS = [0, 260, 440];
// prefers-reduced-motion 일 때: 깜빡임 없이 한 번 점등하고 유지.
const LAND_STEPS_REDUCED_MS = [0];

const EMPTY: Set<string> = new Set();

export function HomeConquerMap({
  visited,
  storeReady,
  spinning,
  landedLat,
  landedLng,
  drawSeq,
}: {
  visited: SavedPlace[];
  storeReady: boolean;
  /** 🎰 뽑는 중 — 룰렛 회전 */
  spinning: boolean;
  /** 🎰 결과 좌표(없으면 착지 없이 종료 — 좌표 없는 결과·에러) */
  landedLat: number | null;
  landedLng: number | null;
  /** 뽑기 순번 — 같은 좌표가 연달아 나와도 착지 연출이 다시 돌게 하는 키 */
  drawSeq: number;
}) {
  const conquered = useMemo(() => conqueredSigunguCodes(visited), [visited]);
  const n = conquered.size;
  const percent = Math.round((n / TOTAL_SIGUNGU) * 100);
  // 1곳이라도 정복했으면 0% 로 안 보이게(ConquerMap 히어로와 같은 규칙).
  const percentLabel = n > 0 && percent < 1 ? 1 : percent;

  const [flashing, setFlashing] = useState<Set<string>>(EMPTY);
  // 마운트 시 1회 판정 — 회전 중 값이 바뀌어 루프가 재시작되는 일이 없게.
  const [reduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  // 회전 — 경과시간으로 tick 간격·점등 개수를 매번 다시 계산(순수부 lib/roulette).
  useEffect(() => {
    if (!spinning || reduced) return;
    const start = Date.now();
    let id = 0;
    const tick = () => {
      const { intervalMs, count } = rouletteFrame(Date.now() - start, SPIN_TOTAL_MS);
      setFlashing(new Set(pickFlashCodes(ALL_SIGUNGU_CODES, count)));
      id = window.setTimeout(tick, intervalMs);
    };
    tick();
    return () => window.clearTimeout(id);
  }, [spinning, reduced]);

  // 착지 — 회전이 끝나면 당첨 조각만 깜빡이다 켠 채로 남는다. 좌표 없음·판정 실패(먼바다 등)면 해제.
  useEffect(() => {
    if (spinning) return;
    const code =
      landedLat != null && landedLng != null
        ? (sigunguAt(landedLat, landedLng)?.code ?? null)
        : null;
    // 좌표 없음·판정 실패(먼바다 등)면 code 가 null — 첫 스텝에서 그냥 해제된다(분기 불필요).
    const steps = reduced ? LAND_STEPS_REDUCED_MS : LAND_STEPS_MS;
    const ids = steps.map((ms, i) =>
      window.setTimeout(
        () => setFlashing(code && i % 2 === 0 ? new Set([code]) : EMPTY),
        ms,
      ),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [spinning, landedLat, landedLng, drawSeq, reduced]);

  return (
    <>
      <div className="mb-3 flex items-center gap-4">
        <div
          className="flex h-[66px] w-[66px] flex-none items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#059669 ${Math.max(percent, n > 0 ? 3 : 0)}%, #d1fae5 0)`,
          }}
          aria-hidden
        >
          <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white text-sm font-extrabold text-emerald-600 dark:bg-zinc-950">
            {storeReady ? `${percentLabel}%` : "–"}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            전국 정복 현황
          </div>
          <div className="text-[26px] font-extrabold leading-tight tracking-tight">
            {n}
            <span className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
              {" "}
              / {TOTAL_SIGUNGU} 시·군·구 · 다녀온 곳 {visited.length}
            </span>
          </div>
        </div>
      </div>

      <ConquerSvg
        conquered={conquered}
        flashing={flashing}
        spinning={spinning}
        className="mx-auto block h-auto w-full max-w-[320px]"
      />

      <p className="mt-2 text-center text-[11.5px] text-emerald-700 dark:text-emerald-300">
        {spinning
          ? "🎰 전국을 돌리는 중…"
          : flashing.size > 0
            ? "🎯 노란 조각이 방금 뽑힌 동네예요."
            : "다녀온 곳이 속한 시·군·구가 초록으로 채워져요."}
      </p>
    </>
  );
}
