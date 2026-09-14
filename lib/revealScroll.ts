// 🎯 결과 드러내기 스크롤 판단부(순수) — 언제(지연·behavior)·어떻게(block) 만 정한다.
//   DOM 을 만지는 쪽은 hooks/useRevealScroll. 착지 연출(핀 칩 animate-card-reveal 0.4s)을
//   읽을 시간을 준 뒤 움직이는 것이 hold 의 의미다.

/** 착지 연출을 보여 주는 시간 — 칩 reveal 0.4s + 읽기 ≈0.4s. 조정 노브. */
export const LAND_HOLD_MS = 800;

export type RevealTiming = { delayMs: number; behavior: ScrollBehavior };

/**
 * hold=true 면 착지 연출이 있는 커밋(뽑기 성공). reduced-motion 이면 hold 를 무시하고
 * 즉시(auto) — 애니메이션이 꺼진 화면에서 0.8s 뒤 순간이동은 "예고 없는 두 번째 변화"다.
 */
export function revealTiming(hold: boolean, reducedMotion: boolean): RevealTiming {
  if (reducedMotion) return { delayMs: 0, behavior: "auto" };
  return { delayMs: hold ? LAND_HOLD_MS : 0, behavior: "smooth" };
}

/**
 * 대상의 뷰포트 기준 top·bottom(getBoundingClientRect) 과 뷰포트 높이로 정렬을 고른다.
 * 위로 벗어났으면 머리부터(start) — nearest 는 "위로 벗어남 & 뷰포트보다 큼"을 아래 정렬로 풀어
 * 제목을 못 보여준다("근처에서 한 번 더"를 카드 하단에서 눌렀을 때). 이미 전부 보이면 null —
 * nearest 도 scroll-margin(개요 지연 로드 슬랙)만큼은 움직여서 '다시 굴리기'마다 튀었다.
 * 나머지(아래로 삐져나감)는 nearest.
 */
export function revealBlock(
  top: number,
  bottom: number,
  viewportHeight: number,
): ScrollLogicalPosition | null {
  if (top < 0) return "start";
  return bottom <= viewportHeight ? null : "nearest";
}
