"use client";

// 📣 분산 서사 온보딩 배너(M18, plan.md §7.9) — 앱 정체성 1문장만, 1회성.
//   닫으면 rt.storySeen.v1 기록(기기 단위 플래그 — owner 게이트·로그아웃 정리 비대상,
//   공용 PC 다음 사용자 미노출은 수용). 출처 문장은 배너가 아니라 FilterPanel 🍃 desc 로 분리.
//   ⚠️ 알고리즘이 보장하는 것만 주장(§7.9 원칙 1): '시·도 균등'만 — 혼잡 회피 약속 금지.

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

const SEEN_KEY = "rt.storySeen.v1";

export function StoryBanner() {
  // mounted 게이트(hydration) — 서버는 배너를 안 그리고, 마운트 후 localStorage 를 읽어 결정(M16 관례).
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      // 마운트 후 1회 localStorage 판독 → 노출 결정(외부 저장소 동기화, VisitedMap 관례).
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      if (localStorage.getItem(SEEN_KEY) !== "1") setShow(true);
    } catch {
      /* localStorage 접근 불가(프라이빗 모드 등) — 조용히 미노출 */
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* 저장 실패해도 이번 세션은 닫힌 상태 유지 */
    }
  }

  if (!show) return null;

  return (
    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-g-primary-soft-border bg-g-primary-soft px-4 py-3 text-g-primary-text">
      <Icon name="dice" size={16} className="mt-0.5" />
      <p className="flex-1 text-[14px] leading-[1.6]">
        <b className="font-bold">어디든</b>은 유명한 곳에 쏠리지 않아요 — 전국{" "}
        <b className="font-bold">모든 시·도</b>에 같은 주사위를 굴려요.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="안내 닫기"
        className="-mr-1 flex h-6 w-6 flex-none items-center justify-center rounded-md hover:bg-g-primary-soft-border"
      >
        <Icon name="close" size={13} />
      </button>
    </div>
  );
}
