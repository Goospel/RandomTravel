import { useEffect, type RefObject } from "react";
import { revealTiming, revealBlock } from "@/lib/revealScroll";

// hold 중 이 입력이 오면 자동 스크롤을 포기한다 — 사용자가 이미 움직이기 시작했다.
//   scrollY 비교를 안 쓰는 이유: SlotMachine 언마운트가 scroll anchoring 보정을 일으켜
//   사용자가 안 건드려도 scrollY 가 바뀐다(무성 실패). 입력 이벤트는 의도 그 자체다.
const USER_INPUT = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

/**
 * active 가 false→true 로 바뀐 커밋에서 ref 요소를 드러낸다(scrollIntoView).
 * hold=true 면 LAND_HOLD_MS 뒤(착지 연출 읽을 시간), reduced-motion 이면 즉시·auto.
 * 같은 true 안에서의 데이터 교체(스텝 재뽑기)는 전이가 아니라 발화하지 않는다.
 */
export function useRevealScroll(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  hold: boolean,
) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const reduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const { delayMs, behavior } = revealTiming(hold, reduced);
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    for (const ev of USER_INPUT) window.addEventListener(ev, cancel, { passive: true });
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const { top, bottom } = el.getBoundingClientRect();
      const block = revealBlock(top, bottom, window.innerHeight);
      if (block) el.scrollIntoView({ behavior, block });
    }, delayMs);
    return () => {
      window.clearTimeout(t);
      for (const ev of USER_INPUT) window.removeEventListener(ev, cancel);
    };
  }, [ref, active, hold]);
}
