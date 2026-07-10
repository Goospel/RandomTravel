"use client";

import { useEffect, useState } from "react";
import { AREA_CODES, CONTENT_TYPES } from "@/lib/constants";
import { rotatingIndex } from "@/lib/rotatingIndex";

// 뽑는 중 연출 — 슬롯머신 2릴(지역·테마)을 로컬 상수만으로 회전시킨다.
// ⚠️ 추가 API 호출 없음(§5.6 호출 예산): 실제 뽑기는 서버에서 1건만 하고,
//    여기서 도는 이름들은 그냥 시각적 기대감용 더미다.
const REGIONS = AREA_CODES.map((a) => a.name);
const THEMES = CONTENT_TYPES.map((c) => c.name);

function Reel({ items, duration }: { items: string[]; duration: string }) {
  // 리스트를 2번 이어 붙여 -50%까지 밀면 이음새 없이 무한 반복된다.
  const doubled = [...items, ...items];
  return (
    <div className="relative h-16 flex-1 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="animate-slot-spin" style={{ animationDuration: duration }}>
        {doubled.map((label, i) => (
          <div
            key={i}
            className="flex h-16 items-center justify-center text-lg font-bold text-zinc-800 dark:text-zinc-100"
          >
            {label}
          </div>
        ))}
      </div>
      {/* 위·아래 페이드로 릴 창 느낌 */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white via-transparent to-white dark:from-zinc-900 dark:to-zinc-900" />
    </div>
  );
}

// 🎰 분산 서사 로딩 문구(M18 §7.9 원칙 5 — 시점 중립: '오늘' 류 특정 시점 표현 금지).
//   2개만 순환(최소 노출 ~1.2s·간격 0.9s면 3~4개는 안 읽힘). 첫 문구가 시·도 균등 서사를 전한다.
const SPIN_MESSAGES = [
  "🎰 17개 시·도에 같은 주사위를 굴리는 중…",
  "🎰 운명을 굴리는 중…",
];

export function SlotMachine() {
  // 인터벌마다 경과시간(ms)으로 순환 인덱스를 계산 — 순수부는 rotatingIndex(테스트됨).
  // loading 조건 렌더라 재추첨마다 SlotMachine 이 재마운트돼 인덱스가 자연 리셋된다(§7.9).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 300);
    return () => window.clearInterval(id);
  }, []);
  const msg = SPIN_MESSAGES[rotatingIndex(elapsed, SPIN_MESSAGES.length)];

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      {/* aria-live 는 상위 결과 컨테이너(page.tsx)가 담당 — 중첩 live region 방지 */}
      <div className="flex gap-3">
        <Reel items={REGIONS} duration="0.5s" />
        <Reel items={THEMES} duration="0.72s" />
      </div>
      <p className="mt-3 text-center text-sm font-medium text-zinc-500">{msg}</p>
    </div>
  );
}
