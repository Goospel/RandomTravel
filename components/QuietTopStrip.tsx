"use client";

// 🍃 오늘 한적 TOP5 스트립(M27, plan.md §7.16A) — 오버투어리즘 대응을 홈에 상시 노출한다.
//   기존 🍃 는 조건 패널의 기본 OFF 토글 뒤에 숨어 있어 "대응 기능이 어디 있나"가 안 보였다.
//
//   위치는 통합 카드 **밖 아래**(결과 카드 아래·기록 서랍 위) — 카드 안엔 아무것도 넣지 않는다(§7.14).
//   칩 탭 = `only=<통계청 code>` 원샷 뽑기(📍 주변 뽑기 동형) — 조건 패널 상태와 무관한 별도 진입점.
//
// ⚠️ 정직성(§6.7): 문구는 항상 '예측' + 데이터 기준일 — 실시간 사칭 금지.
//   데이터 없음·stale 이면 서버가 빈 결과를 주고 스트립은 **아무것도 렌더하지 않는다**.
//   출처는 "공공 관광 데이터" 수준까지만 — 공사·KTO 지칭 금지(§14.2).

import { useEffect, useState } from "react";
import { fmtYmd } from "@/lib/kst";
import { Icon } from "@/components/icons";
import type { QuietTopResponse } from "@/types/tour";

export function QuietTopStrip({
  onPick,
  disabled,
}: {
  /** 칩 탭 → 그 시·군·구에서 원샷 뽑기. code = 통계청 5자리. */
  onPick: (code: string) => void;
  disabled: boolean;
}) {
  const [data, setData] = useState<QuietTopResponse | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/quiet/top")
      .then((res) => res.json() as Promise<QuietTopResponse>)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {
        /* 부가 스트립 — 실패는 조용히 미노출(홈 흐름을 막지 않는다) */
      });
    return () => {
      alive = false;
    };
  }, []);

  // 로딩 중·빈 결과(데이터 없음·stale)는 자리 자체를 만들지 않는다(§7.16A).
  if (!data || data.items.length === 0 || !data.baseYmd) return null;

  return (
    <section className="rounded-xl border border-g-border bg-g-surface px-5 py-4">
      <h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold leading-[1.3] tracking-[-0.02em]">
        <Icon name="leaf" size={15} />
        오늘 덜 붐빌 것으로 예측되는 동네
      </h2>
      <p className="mt-1 text-[12px] leading-[1.5] text-g-text-2">
        공공 관광 데이터의 집중률 예측 기준 ({fmtYmd(data.baseYmd)} 기준) · 탭하면 그 동네에서
        뽑아요
      </p>

      {/* 가로 스크롤 칩 — 좁은 화면에서도 5개가 줄바꿈 없이 한 줄로 흐른다. */}
      <ul className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {data.items.map((item) => (
          <li key={item.code} className="flex-none">
            <button
              type="button"
              onClick={() => onPick(item.code)}
              disabled={disabled}
              className="whitespace-nowrap rounded-full border border-g-border bg-g-surface px-3 py-1.5 text-[12px] font-medium leading-[1.2] text-g-text-2 hover:border-g-primary hover:text-g-primary disabled:cursor-default disabled:opacity-60"
            >
              {item.areaName} {item.name}
              <span className="text-g-neutral"> · </span>
              집중률 하위 {item.pctBelow}%
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
