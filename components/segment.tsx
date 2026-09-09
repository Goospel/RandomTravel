"use client";

// 캡슐 세그먼트 토글의 클래스 관례 — 눌린 트랙(surface-2) 위를 잉크색 캡슐 썸이 차지한다.
// 활성만 700, 비활성 500(한 화면 두께 2종 규칙, designGuide 타이포).
//
// 옛 이름은 ModeToggle.tsx 였다: 홈의 [아무 데나 | 조건 걸고] 세그먼트가 여기 살았는데,
// M32 에서 그 자리를 조건 요약 한 줄(ConditionBar)이 대신하면서 컴포넌트는 사라지고
// 클래스 관례만 남았다(현재 사용처 = /map 의 [스탬프 지도 | 핀 지도]).

/** 세그먼트 버튼 1개 — 안에 넣을 컨테이너는 segmentGroup. */
export function segment(active: boolean): string {
  return `inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[13px] leading-[1.2] ${
    active
      ? "bg-g-text font-bold text-g-on-primary"
      : "bg-transparent font-medium text-g-text-2 hover:text-g-text"
  }`;
}

/** 세그먼트 컨테이너 — 안쪽에 segment() 버튼들을 넣는다. */
export const segmentGroup =
  "flex w-full gap-1 rounded-full border border-g-border bg-g-surface-2 p-1";
