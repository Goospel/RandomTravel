---
name: remove-worktree
description: 이 repo의 git 워크트리를 안전하게 삭제한다 — node_modules 정션이 있으면 링크만 먼저 끊어 메인 워크트리의 node_modules가 함께 지워지는 사고를 막고, git worktree remove + 로컬 브랜치 정리 + 메인 main 최신화까지 한 번에. 워크트리 정리/삭제, worktree 제거, PR 머지 후 작업 폴더 치울 때 사용.
---

# remove-worktree — 워크트리 안전 삭제

git 워크트리를 지울 때, **node_modules 정션이 있으면 링크만 먼저 끊어** 메인 워크트리의 node_modules가 함께 삭제되는 사고를 막고, `git worktree remove` + 로컬 브랜치 정리 + **메인 워크트리의 main 최신화(`git pull`)** 까지 한 번에 한다.

> **이식 유래**: 원래 BookTimer(`frontend/node_modules` 정션 공유 셋업)에서 만든 스킬을 이 repo로 가져온 것. RandomTravel은 워크트리 node_modules를 정션으로 공유하지 않으므로(실폴더) 정션 방어는 **해당할 때만** 작동하고, 아니면 자동으로 건너뛴다 — 그래도 나머지 안전가드는 그대로 유효하다. root `node_modules`와 `frontend/node_modules` **두 레이아웃 모두** 확인한다.

## 언제 쓰나

- 워크트리 작업이 끝나(PR 머지 등) 그 워크트리 폴더를 정리할 때.
- "워크트리 지워줘 / 정리해줘" 요청.

## 왜 그냥 `git worktree remove`를 쓰면 안 되나

워크트리의 node_modules가 메인 워크트리의 node_modules를 가리키는 **Windows 정션**인 경우, `git worktree remove`·`rm -rf`는 정션을 "내용 있는 디렉토리"로 보고 따라 들어가 **타깃(메인 node_modules) 내용까지 삭제**한다. 이 스킬은 정션 **링크만** 먼저 끊어(`[IO.Directory]::Delete`, 타깃 보존) 그 함정을 도구로 제거한다. 정션이 아닌 실폴더면 건드리지 않고 git이 정상 삭제하도록 둔다.

## 사용

**대상 워크트리 바깥(메인 워크트리 등)** 에서 실행한다:

```
powershell -File .claude/scripts/remove-worktree.ps1 <워크트리경로>
```

옵션:
- `-DryRun` — 무엇을 할지만 출력, 변경 없음 (먼저 확인용 권장)
- `-Force` — 워크트리에 미커밋/untracked 변경이 있어 `git worktree remove`가 거부할 때 강제
- `-KeepBranch` — 삭제 후 로컬 브랜치를 지우지 않음 (기본: 머지됐으면 `-d`로 정리, 미머지면 보존)
- `-NoPull` — 삭제 후 메인 워크트리의 main을 `git pull`로 최신화하지 않음 (기본: 최신화함)

예:
```
powershell -File .claude/scripts/remove-worktree.ps1 .claude/worktrees/foo-abc123 -DryRun   # 먼저 확인
powershell -File .claude/scripts/remove-worktree.ps1 .claude/worktrees/foo-abc123           # 실제 삭제
```

## 안전장치 (위반 시 exit 3, 아무것도 안 지움)

- 존재하지 않는 경로 / git 워크트리 루트가 아닌 경로
- **메인 워크트리** (메인은 절대 안 지움)
- 이 repo에 등록되지 않은 워크트리
- **현재 셸이 그 워크트리 안**일 때 — 자기가 선 폴더는 못 지우므로 **메인 워크트리 쪽에서** 실행하라.
- **다른 프로세스가 그 폴더 안에 서 있을 때** — 위 cwd 가드는 *자기 셸*만 본다. `powershell -File`로 띄운 자식 프로세스의 cwd는 메인 워크트리라, 정작 그 워크트리 안에서 돌고 있는 **Claude Code 세션·터미널**은 가드를 그냥 통과한다. 그래서 삭제 직전에 **삭제 가능성 프로브**(폴더 이름을 바꿨다 즉시 되돌림 — 순변화 0이지만 삭제가 막힐 때 똑같이 막힌다)로 물어본다. 잠겨 있으면 **정션도 안 끊고** exit 3 + "안에서 돌고 있는 셸/세션을 먼저 닫으라" 안내. (이 프로브가 없으면 git이 내용 삭제·등록 해제까지 마친 **뒤** rmdir에서 실패해 반쯤 지워진 상태가 남는다 — 2026-07-28 실제 사고.)

## 반쯤 지워진 상태 (등록 해제 + 빈 폴더 잔존)

위 사고로 빈 폴더만 남았다면 **같은 명령을 그대로 다시 실행**하면 된다. 대상이 비어 있고 워크트리 루트가 아니면 "등록은 이미 해제됨 — 남은 빈 디렉터리만 정리" 로 인식해 폴더를 지우고 `git worktree prune`까지 한다(예전엔 여기서 상황과 무관한 `not a worktree root`가 났다). 폴더가 아직 잠겨 있으면 exit 3으로 "세션 먼저 닫으라" 안내 — 그 세션이 끝난 뒤 재실행하면 정리된다.

## 동작 순서

1. 경로·소속·main·cwd 가드 (빈 폴더 잔존 상태면 여기서 정리하고 종료)
2. **삭제 가능성 프로브** — 이름 변경 후 즉시 원복. 실패하면 아무것도 안 건드리고 exit 3.
3. `node_modules`(root)·`frontend/node_modules`가 정션이면 링크만 끊기(타깃 보존). 일반 폴더면 건드리지 않음.
4. `git worktree remove` (`-Force` 시 강제)
5. 로컬 브랜치 `git branch -d` (미머지면 보존)
6. **메인 워크트리의 main 최신화** — 베스트-에포트 `git pull --ff-only`. 머지분이 원격 main에 얹혀 로컬 main이 뒤처지므로 따라잡는다. **활성 작업을 절대 방해하지 않게** 4가드를 모두 통과할 때만 실행: ① 메인 워크트리가 `main`(또는 `master`) 브랜치일 때만(브랜치 강제 전환 안 함) ② 추적 파일 미커밋 변경이 없을 때만 ③ upstream이 있을 때만 ④ fast-forward만(diverge 시 경고만). 어느 가드에 걸리거나 pull이 실패해도 **워크트리 삭제 성공은 유지**(fail-open, `-NoPull`로 끔).

## 관련

- 스크립트: `.claude/scripts/remove-worktree.ps1`
- 테스트: `.claude/scripts/tests/test-remove-worktree.ps1` (정션 타깃 보존 + 안전가드 회귀방지 10건, self-contained — 잠금 케이스는 실제로 자식 프로세스를 워크트리 안에 띄워 검증)
- 유래: BookTimer의 동명 스킬(`frontend/node_modules` 정션 삭제 사고 T-110 방어)에서 이식.
