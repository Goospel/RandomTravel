# 디자인 가이드 — "어디든" (Genesis)

> UI를 만들거나 고칠 때 **이 파일이 단일 출처**다. 여기 없는 색·크기·모양을 즉흥으로 쓰지 않는다.
> 새 패턴이 필요하면 먼저 이 파일에 추가(왜 필요한지 한 줄)하고 나서 코드에 쓴다.
> 현재 규칙은 **M24 Genesis 리스킨**(2026-07-28 디자인 핸드오프, plan.md §7.14) 기준.
> 원문 시안·디자인 시스템 정의: `claude-design/extracted/design_handoff_genesis_reskin/`.

## 컨셉 한 줄

**editorial precision** — 담백하고 정확한 기록장. 굵은 display 타이포 + 넉넉한 여백 + 액자 같은 카드면.
장식을 최소화하고 **위계는 border와 배경 대비로만** 만든다.

## 색 — 전부 CSS 변수

값을 컴포넌트에 직접 쓰지 않는다. 정의는 [globals.css](app/globals.css)의 `:root`,
Tailwind 유틸리티는 `@theme inline`이 만들어 준다 (`bg-g-surface` · `text-g-text-2` · `border-g-border` …).

| 역할 | 토큰 | 용도 |
|---|---|---|
| **액센트** | `--g-primary` | 주 버튼, 활성 칩, 정복 조각, 링크, 포커스 링 |
| 액센트 hover | `--g-primary-hover` | 채워진 버튼 hover |
| 액센트 연한 배경 | `--g-primary-soft` (+`--g-primary-soft-border`) | 배너, 켜진 조건 카드, 주변 뽑기 pill |
| 액센트 텍스트 | `--g-primary-text` | 연한 배경 위 글자, 활성 세그먼트 |
| **채워진 액센트 위 잉크** | `--g-on-primary` | 뽑기 버튼·선택된 칩·결과 지도 칩 글자 |
| 페이지 배경 | `--g-bg` | `<body>` |
| 카드면 | `--g-surface` | 카드·패널·인풋 |
| 한 단 눌린 면 | `--g-surface-2` | 카드 안쪽 블록, 세그먼트 트랙, 썸네일, 뱃지(neutral) |
| 본문 텍스트 | `--g-text` | 제목·본문 |
| 보조 텍스트 | `--g-text-2` | 설명·메타·캡션 (**읽어야 하는 작은 글씨는 전부 이것**) |
| 장식 회색 | `--g-neutral` | 카운트·구분자 등 **읽지 않아도 되는 것만** |
| 보더 | `--g-border` | 카드·구분선·hairline |
| 링 트랙 | `--g-ring-track` | 정복률 링·진행바 바닥 |
| 지도 | `--g-map-empty` / `--g-map-stroke` / `--g-sido-stroke` / `--g-dot-alt` | 미정복 조각·조각 경계·시·도 외곽·진행 점 교대색 |
| **success** | `--g-success-soft` / `--g-success-text` | 🍃 한적 예측, 👍 또 갈래 |
| **warning** | `--g-warning-soft` / `--g-warning-text` | notice·에러 패널·😐 그럭저럭 |
| **error** | `--g-error-soft` / `--g-error-text` | 찜(하트), 👎 또 안 감 |

- **새 색 추가 금지** — 위 토큰으로 해결한다. 의미색은 success/warning/error 셋뿐이고, 그 외 모든 강조는 indigo 계열로 통일한다.
- **다크는 `dark:` 클래스가 아니라 변수 스왑**(`@media (prefers-color-scheme: dark)`)이다. 그래서 컴포넌트는 색을 **한 번만** 쓴다 — `dark:` 변형을 새로 만들지 말 것(짝을 빼먹어 다크가 깨지는 실패 모드를 없앤 게 이 구조의 목적).
- ⚠️ **채워진 indigo 위 글자색에 `text-white`를 쓰지 말 것.** 다크에서 `--g-primary`가 `#818CF8`로 밝아져 흰 글자가 **2.98:1로 실패**한다. 반드시 `text-g-on-primary`(라이트 4.47:1 / 다크 6.59:1).
- ⚠️ **11–12px 캡션에 `--g-neutral` 금지**(흰 배경 2.75:1). 읽는 텍스트는 `--g-text-2`(5.7:1).

## 타이포

`--g-display` = **General Sans**(숫자·제목) · `--g-body` = **DM Sans**(본문·UI).
Tailwind로는 `font-display` / `font-body`. 배선은 [layout.tsx](app/layout.tsx)의 `next/font`.

> 둘 다 **한글 글리프가 없다** — 실제 한글은 폴백(Apple SD Gothic Neo·Malgun Gothic)이 렌더한다.
> 의도된 동작이다. Pretendard 등 한글 폰트를 추가하지 않는다(사용자 결정).

| 역할 | 스펙 |
|---|---|
| 홈 타이틀 (`어디든`) | display 24 / 1.2 / 700 / `-0.03em` |
| `/map` 타이틀 | display 32 / 1.15 / 700 / `-0.03em` (모바일 24) |
| 섹션 제목 | display 15–16 / 1.3–1.4 / 700 / `-0.02em~-0.03em` |
| 큰 숫자(스탯) | display 17–32 / 1–1.3 / 700 / `-0.03em` |
| 본문 | body 15 / 1.6–1.7 / 400 |
| 보조 본문 | body 13–14 / 1.5–1.6 / 400 |
| 캡션 | body 12 / 1.5–1.6 / 400 |
| 마이크로 라벨 | body 11 / 1.3 / 700 (또는 500 + `0.12em` uppercase) |
| 버튼 | body 15–16 / 1 / 500 |
| 세그먼트·칩 | body 12–13 / 1–1.2 / 500 |

한 화면에 **폰트 두께는 2종까지**(대개 500·700).

## 모양·간격

| 요소 | 규칙 |
|---|---|
| 카드·배너·조건 패널 | `rounded-xl`(12px) + `border border-g-border` + `bg-g-surface` |
| 카드 안쪽 블록 (스탯·릴·썸네일·조건 카드) | `rounded-lg`(8px) |
| 버튼·세그먼트 탭 | `rounded-md`(6px) |
| 칩·pill·아이콘 버튼·링 | `rounded-full` |
| **그림자** | **쓰지 않는다.** elevation은 border와 배경 대비로 만든다. 예외는 **떠 있는 것**(팝오버·드롭다운)만 `shadow-lg` |
| 간격 | 4px 배수. 실사용값 `3 4 6 8 10 12 14 16 20 24`. 카드 패딩 `16–20`, 카드 사이 `12`, 섹션 내부 그룹 `14–16`, 인라인 `6–10` |

버튼 크기: 주 CTA `h-[52px] w-full` · 일반 `h-11` · pill `h-8 px-3` · 아이콘 버튼 `h-11 w-11`(터치 타깃 44px).
`hover:-translate-y-px` + 200ms는 outline 버튼에만.

## 아이콘 — 이모지 금지

UI에 이모지를 넣지 않는다. [components/icons.tsx](components/icons.tsx)의 `<Icon name>`을 쓴다
(24 viewBox · stroke **1.7px** · round cap/join · `fill="none"`).

크기: 인라인 12–14 · 타일/스텝 15–17 · 헤딩 옆 15 · 빈 상태 34–40.
아이콘은 전부 `aria-hidden` — 의미는 옆 텍스트나 `aria-label`이 전달한다.

- 새 아이콘이 필요하면 `ICONS`에 **키를 추가**하고 그 키로 참조한다.
- **데이터에 이모지를 박지 않는다** — `lib/*`의 상수는 `icon: IconName` 키를 갖고 렌더가 조회한다
  (`COURSE_SLOTS`·`lib/level.ts` TIERS 전례). 서버 notice 문구도 이모지 대신 조건 이름을 쓴다.
- 예외로 남긴 기호: `↓`(코스 다리 거리) · `≈`(후보 수 근사) · `✓`(SVG 조각 툴팁). 시안이 그대로 쓰는 텍스트 기호다.
- **카톡 공유 텍스트**(`lib/kakaoShare.ts`)는 UI가 아니라 메시지 본문이라 이모지를 그대로 쓴다.

## 모션

정의는 전부 [globals.css](app/globals.css)에 — 새 keyframe도 거기에 추가한다.

- `animate-card-reveal`(0.4s) 결과 카드·칩 등장 · `animate-fade-up`(0.32s) 토스트 · `animate-slot-spin`(0.6s) 슬롯 릴
- `animate-map-flick`(0.9s infinite) 뽑는 중 지도 조각 번쩍임(delay 스태거) · `animate-pin-pulse`(1.8s infinite) 결과 마커 펄스
- SVG 안에서 `transform` 애니메이션을 쓰면 **`transform-box: fill-box; transform-origin: center` 필수**(안 주면 뷰박스 원점 기준으로 튄다).
- 지속시간 0.3~0.4s, `ease-out` 기준. 0.5s 넘는 장식 모션은 무한 반복 연출(flick·pulse)만.
- **`prefers-reduced-motion: reduce`에서 전부 꺼진다** — globals.css의 `* { animation: none !important }`가 담당하므로 클래스별 등록이 필요 없다.
- ⚠️ **세그먼트·칩에 `transition-colors` 금지**: 다크 전환 시 Chromium이 CSS 변수만 바뀐 `color`/`background-color`를 재계산하지 않아 값이 이전 테마에 붙는다(핸드오프 실측). `transform`/`opacity` 트랜지션은 무해. hover 색은 `hover:` 유틸로 처리한다.

## 접근성 (타협 불가)

- 키보드 포커스: 전역 `:focus-visible`이 `--g-primary` 아웃라인을 그린다 — `outline-none`을 쓰려면 대체 표시 필수.
- 아이콘 단독 버튼엔 `aria-label`.
- 연한 배경 위 텍스트는 위 표의 검증된 짝(`*-soft` ↔ `*-text`)만 쓴다. 임의 조합으로 대비를 깨뜨리지 않는다.
- 새 색 조합을 도입하면 **라이트/다크 양쪽에서 대비를 실측**한다(브라우저 계산 스타일로 측정 — 이 환경은 스크린샷이 자주 멈춘다).

## 문구 톤

- 한국어, 해요체 짧은 문장. 서사 키워드: "전국 어디든 같은 출발선", 정복·탐험·조각, 그리고 **굴리기**(지도가 룰렛이다).
- 시점 중립: 로딩·서사 문구에 '오늘' 류 특정 시점 표현을 넣지 않는다(§7.9 원칙 5).

## 작업 방식

1. 화면 단위 리디자인은 **정적 HTML 시안 → 승인 → 구현** 순서(코드 먼저 고치지 않기).
2. 새 컴포넌트는 기존 컴포넌트([ResultCard.tsx](components/ResultCard.tsx), [FilterPanel.tsx](components/FilterPanel.tsx))의 클래스 관례를 복사해서 시작한다.
3. 이 가이드와 코드가 어긋나는 걸 발견하면 — 코드를 가이드에 맞추거나, 가이드를 고친다. 방치 금지.
