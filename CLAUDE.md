# RandomTravel ("어디든") — 프로젝트 가이드 (Claude Code)

> 글로벌 `~/.claude/CLAUDE.md`(한국어 출력·PKM·자동 메모리·Windows 셸 인코딩)와 **합쳐** 적용된다.
> 여기엔 **이 프로젝트 특유의 것만** 둔다. 깊은 내용은 아래 문서로 포인터만 — 이 파일에 복붙 금지(매 세션 로드되므로 얇게 유지).

## 한 줄

랜덤 국내 여행지 추천 웹앱. 배포명 **"어디든"**(레포명은 RandomTravel).
스택: **Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 · Vitest · Auth.js v5 · Neon(Postgres)/Drizzle · Vercel**.

## 문서 지도 (깊은 내용은 여기 — 재탐색 말 것)

- **plan.md** — 설계·의사결정·마일스톤 표(§번호). 기능 스펙의 **원천**. 조건·지도·동기화 등 "왜/어떻게"는 여기.
- **README.md** — 사용자 대면 소개 + **§진행 상황 체크리스트**(마일스톤 완료 표시).
- **claude-docs/learning-notes.md** — 학습 노트(PKM 현장 메모).
- **자동 메모리** `m10`~`m15` = 마일스톤별 상세(무엇을·왜·함정).

## 코드 지도

- `app/` 라우트 + `app/api/{random, places, places/sync, auth}` 서버 라우트.
- `lib/` **순수 로직**(`travelStore`·`syncMerge`·`placesApi`·`query`·`geo`·`constants`·`tourapi`·`events`…), 각 `*.test.ts` 동거.
- `hooks/useTravelStore.ts` — 클라이언트 저장소: localStorage `rt.*.v1` + **로그인 시 서버 동기화**(write-through + 병합) 배선. 순수부는 `lib/travelStore`·`lib/syncMerge`.
- `components/` (`ResultCard`·`RecordPanel`·`FilterPanel`…).
- `db/` Drizzle 스키마(`schema.ts`) + `db/migrations`.

## 작업 방식

- **TDD 먼저**: 실패 테스트 → 구현. Vitest, **순수 함수만** 단위 테스트(네트워크 목 없음). 기존 `toEqual` shape 테스트는 필드 추가 시 함께 갱신.
- **git**: 구현 코드 = `feat/…`·`m##-…` 브랜치 → PR → CI(job명 `verify`) → **사용자 승인 후** 스쿼시 머지 + 브랜치 삭제. **문서-only 변경 = main 직커밋·푸시**(사전 승인됨).
- **마일스톤 완료 시 3종 갱신**: plan.md(§ 소절 + 마일스톤 표 행) · README 체크리스트 · 자동 메모리.
- 한글 커밋 메시지: `git commit -F- <<'EOF' … EOF`(Bash 힙독 — PowerShell/Git Bash 인라인 한글 CP949 깨짐 회피). 무결성은 콘솔 표시가 아니라 **바이트/문자 대조**로 검증.

## 검증 (매번 이 세트)

`npx tsc --noEmit` · `npx eslint` · `npx vitest run`(현재 ~196개, 마일스톤마다 증가) · `npx next build`.
dev 서버 = `.claude/launch.json`의 **"dev" 포트 3456**(`preview_start` 사용).

## 배포 = 외부 노출 (머지 전 확인)

main 머지 시 **Vercel 자동 재배포** → https://travelanywhere-kr.vercel.app (Hobby, team Goospel, 함수 리전 **icn1/서울**). 프로덕션 배포라 **머지 전 사용자 확인**.

## 시크릿·env

**채팅에 값 절대 금지** — `.env.local`(로컬) + Vercel 대시보드(프로덕션)에만. 키: `TOUR_API_KEY`·`WEATHER_API_KEY`·`NEXT_PUBLIC_KAKAO_MAP_KEY`·`AUTH_SECRET`·`DATABASE_URL`·`AUTH_{GOOGLE,KAKAO}_{ID,SECRET}`·`CRON_SECRET`(M17 🍃 혼잡도 배치 크론 인증). 상세·발급 경로는 `.env.local.example`. `DATABASE_URL` = **Neon(로컬·프로덕션 공용 DB)**.

## DB 마이그레이션 (Drizzle)

`npx drizzle-kit generate` → `db/migrations` SQL 커밋. Neon 적용은 **additive-nullable 컬럼을 머지 전에 먼저**(컬럼 없이 새 코드 배포 시 로그인 사용자 `/api/places` 500 → 동기화 중단). 적용은 DATABASE_URL을 스크립트 내부에서만 읽어 직접 DDL 실행(값 미출력) → `information_schema`로 컬럼 확인.

## 이 환경 함정

- `preview_screenshot`이 이 환경에서 자주 멈춤 → `preview_eval`/DOM·계산 스타일로 검증(결정적).
- `.claude/worktrees`(에이전트 격리 워크트리)는 vitest `exclude`·eslint `globalIgnores`에서 **제외 설정됨** — 되돌리지 말 것(안 그러면 유령 테스트/린트 실패).
- **Tailwind v4 dev**는 런타임에 처음 등장한 클래스를 풀 리로드 전까지 미적용할 수 있음 → 색 안 뜨면 버그 오판 말고 **프로덕션 빌드/하드 리로드로 확인**.
