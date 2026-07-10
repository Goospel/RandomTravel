// 🎰 슬롯 로딩 메시지 로테이션(M18, plan.md §7.9) — 순수 인덱스 계산.
//   SlotMachine 이 인터벌마다 경과시간을 넣어 "지금 보여줄 메시지 인덱스"를 얻는다.
//   시간 의존은 호출부(인터벌)에 두고 여기선 순수 산술만 → 단위 테스트 가능.

/**
 * 경과시간(ms) → 순환 메시지 인덱스. intervalMs 마다 다음 인덱스로 넘어가고 count 로 순환한다.
 * 음수 경과·0/음수 count 는 0(방어).
 */
export function rotatingIndex(
  elapsedMs: number,
  count: number,
  intervalMs: number = 900,
): number {
  if (count <= 0) return 0;
  const e = elapsedMs > 0 ? elapsedMs : 0;
  return Math.floor(e / intervalMs) % count;
}
