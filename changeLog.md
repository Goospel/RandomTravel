# changeLog — 완료 기록 (역순)

> 매 작업 완료 시 **맨 위에** `날짜 · 제목` + 의도·결과 한 항목. 코드 세부는 PR·커밋에 있으니 여기선 **왜/무엇을**만.
> 이 프로젝트 자체 PR 번호는 적지 않는다 — 스쿼시 머지 커밋 제목의 `(#N)`이 단일 출처다(`git log --grep "제목"`으로 찾기). 타 repo 참조는 이미 확정된 번호라 적어도 된다.

## 2026-07-28 · ECC 아이디어 채굴 → 메타 시스템에 이식 5종 (RandomTravel 코드 변경 없음)

- **왜**: ECC 플러그인(affaan-m/ECC, ⭐234k) 설치 검토 → 기존 시스템(superpowers·자동 메모리·훅 하드가드)과 전면 중복이라 **설치 비추천** 결정. 대신 쓸 만한 발상만 goospel-claude-config repo에 이식.
- **무엇** (config repo PR #25~#29, 전부 머지):
  1. 프로젝트 간 함정 재발 스캔 스크립트 — consolidate 때 전 프로젝트 T-### 요약을 한 표로 모아 승격 후보 탐지 (#25)
  2. hookify 선언형 룰 가드 러너 — 승격 사다리에 warn/block 중간 계단 + 초기 룰 2건 (#26)
  3. `/hookify` 세션 회고 커맨드 — 반복 교정·미기록 함정을 룰/T-###/원칙 초안으로 제안 (#27)
  4. 그 첫 실전 산출물 `warn-multibyte-grep` 룰 — Git Bash grep/sed 멀티바이트 무성 실패 경고 (#28)
  5. 실환경 검증 3종 PASS 중 발견된 `git -C` 회피 경로 수정 (#29)
- 이 changeLog 파일도 이날 신설(글로벌 표준 양식). 상세는 config repo `docs/2026-07-28-*.md` + 자동 메모리 `ecc-plugin-mining`.
