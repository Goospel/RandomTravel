// 🖊️ Genesis 선 아이콘 세트 — 코드 전반의 이모지를 대체한다(designGuide.md).
//   규격: 24 viewBox · stroke 1.7px · round cap/join · fill none. 크기는 호출부에서
//   size 로(인라인 12–14 · 타일/스텝 15–17 · 헤딩 옆 15 · 빈 상태 34–40).
//   전부 장식이라 aria-hidden — 의미는 항상 옆 텍스트나 aria-label 이 전달한다.
//
//   데이터에 박힌 이모지(COURSE_SLOTS·TIERS·SEA_CAT3 …)는 이 맵의 **키**로 바꿔
//   조회한다 — 그래야 순수 모듈이 렌더 관심사를 안 갖는다.

import type { ReactNode } from "react";

// satisfies(: 아님) — 키 리터럴을 살려 IconName 이 실제 이름 유니온이 되게 한다.
const ICONS = {
  // 셸·내비게이션
  download: (
    <>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  externalLink: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),

  // 뽑기·조건
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 11h18" />
    </>
  ),
  wave: (
    <>
      <path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </>
  ),
  pot: (
    <>
      <path d="M5 9h14l-1.5 10.5A2 2 0 0 1 15.5 21h-7a2 2 0 0 1-2-1.5L5 9Z" />
      <path d="m9 9 1.5-5" />
      <path d="m15 9-1.5-5" />
    </>
  ),
  tent: (
    <>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 4v16" />
    </>
  ),
  umbrella: (
    <>
      <path d="M12 12v7a2 2 0 0 0 4 0" />
      <path d="M2 12a10 10 0 0 1 20 0Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m5.6 5.6 1.4 1.4" />
      <path d="m17 17 1.4 1.4" />
      <path d="m18.4 5.6-1.4 1.4" />
      <path d="m7 17-1.4 1.4" />
    </>
  ),
  leaf: (
    <>
      <path d="M11 20A7 7 0 0 1 18 4h3v3a7 7 0 0 1-7 7h-3v6Z" />
      <path d="M4 20c2-6 5-9 10-11" />
    </>
  ),
  scales: (
    <>
      <path d="M12 3v18" />
      <path d="M7 7h10" />
      <path d="m4 13 3-6 3 6a3 3 0 0 1-6 0Z" />
      <path d="m14 13 3-6 3 6a3 3 0 0 1-6 0Z" />
    </>
  ),
  // 🐕 반려동물 동반 — 발자국(패드 1 + 발가락 4)
  paw: (
    <>
      <ellipse cx="12" cy="16" rx="4.2" ry="3.6" />
      <ellipse cx="6.2" cy="10.5" rx="1.9" ry="2.4" />
      <ellipse cx="17.8" cy="10.5" rx="1.9" ry="2.4" />
      <ellipse cx="9.6" cy="6.2" rx="1.8" ry="2.3" />
      <ellipse cx="14.4" cy="6.2" rx="1.8" ry="2.3" />
    </>
  ),
  // ♿ 무장애 — 휠체어 픽토그램(머리 + 등 + 바퀴 + 발판)
  accessible: (
    <>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M11 8h5" />
      <path d="M11 8v5h5.5" />
      <circle cx="13" cy="16.5" r="4.8" />
      <path d="M17.5 13.5 20 20" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 2v2.5" />
      <path d="M12 19.5V22" />
      <path d="M2 12h2.5" />
      <path d="M19.5 12H22" />
    </>
  ),

  // 기록·결과
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  heart: <path d="M12 20s-7-4.6-7-9.5A4 4 0 0 1 12 7a4 4 0 0 1 7 3.5C19 15.4 12 20 12 20Z" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="m5 13 4 4L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m21 16-5-5L5 20" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.1 5-5 2.1 2.1-5 5-2.1Z" />
    </>
  ),
  share: (
    <>
      <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
      <path d="M12 16V3" />
      <path d="m8 7 4-4 4 4" />
    </>
  ),
  link: (
    <>
      <path d="M9 15 15 9" />
      <path d="M11 6l1-1a4 4 0 0 1 6 6l-1 1" />
      <path d="M13 18l-1 1a4 4 0 0 1-6-6l1-1" />
    </>
  ),

  // 코스
  car: (
    <>
      <path d="M5 17h14" />
      <path d="M6 17V9l2-4h8l2 4v8" />
      <path d="M8 13h8" />
    </>
  ),
  start: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h11l-2 3.5L16 12H5" />
    </>
  ),
  sight: (
    <>
      <path d="M2 12h20" />
      <path d="M6 12V8l5-3 5 3v4" />
    </>
  ),
  meal: (
    <>
      <path d="M5 3v8a3 3 0 0 0 6 0V3" />
      <path d="M8 11v10" />
      <path d="M17 3c-1.5 2-2 4-2 7h4c0-3-.5-5-2-7Z" />
      <path d="M17 10v11" />
    </>
  ),
  cafe: (
    <>
      <path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
      <path d="M17 9h2a2.5 2.5 0 0 1 0 5h-2" />
      <path d="M8 3v2" />
      <path d="M12 3v2" />
    </>
  ),

  // 지도·정복
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z" />
      <path d="M4 22V4" />
    </>
  ),

  // 탐험가 레벨(lib/level.ts TIERS)
  sprout: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12C8.5 12 6 9.5 6 6c3.5 0 6 2.5 6 6Z" />
      <path d="M12 12c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M9 19h4a4 4 0 0 0 4-4V8" />
    </>
  ),
  crown: (
    <>
      <path d="M3 7l4.5 4L12 4.5 16.5 11 21 7l-1.6 9.5H4.6L3 7Z" />
      <path d="M4.6 20h14.8" />
    </>
  ),

  // 상태·안내
  warning: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  key: (
    <>
      <circle cx="15.5" cy="8.5" r="3.5" />
      <path d="M13.5 11 4 20.5V22h2.5v-2H9v-2h2.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 14,
  className = "",
}: {
  name: IconName;
  /** px — 인라인 12–14 · 타일/스텝 15–17 · 헤딩 옆 15 · 빈 상태 34–40 */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`flex-none ${className}`}
    >
      {ICONS[name]}
    </svg>
  );
}
