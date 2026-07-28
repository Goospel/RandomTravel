#!/usr/bin/env pwsh
# test-remove-worktree.ps1 - smoke test for remove-worktree.ps1
#
# Core invariant (junction-target regression guard): cutting a node_modules junction
# must NOT delete the junction TARGET (the main worktree's node_modules) contents.
# Also asserts: dry-run is non-destructive, non-worktree paths are rejected,
# and a cwd inside the target is rejected (cannot delete the folder you stand in).
#
# Self-contained: builds its own git fixtures under $env:TEMP, so it passes in any
# repo regardless of that repo's own layout (RandomTravel has no frontend/ dir).
#
# Run: powershell -File .claude/scripts/tests/test-remove-worktree.ps1
# Exit: 0 all pass, 1 a check failed.
$ErrorActionPreference = 'Stop'
$script:fails = 0
function ok($m)   { Write-Host "  [PASS] $m" }
function bad($m)  { Write-Host "  [FAIL] $m"; $script:fails++ }
function check($cond, $m) { if ($cond) { ok $m } else { bad $m } }

$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $here '..\remove-worktree.ps1'
$target = (Resolve-Path $target -ErrorAction SilentlyContinue).Path
if (-not $target) {
  Write-Host "remove-worktree.ps1 not found yet (RED expected before implementation)."
  exit 1
}

$root = Join-Path $env:TEMP ("rmwt-test-" + $PID)
function Reset-Root {
  if (Test-Path $script:root) {
    # cut any leftover junctions first so cleanup never follows a link into a target
    Get-ChildItem $script:root -Recurse -Force -ErrorAction SilentlyContinue |
      Where-Object { $_.LinkType -eq 'Junction' } |
      ForEach-Object { try { [IO.Directory]::Delete($_.FullName) } catch {} }
    Remove-Item $script:root -Recurse -Force -ErrorAction SilentlyContinue
  }
}
Reset-Root
New-Item -ItemType Directory $root | Out-Null

function New-Fixture {
  param([string]$name)
  $main = Join-Path $root "$name-main"
  New-Item -ItemType Directory $main | Out-Null
  Push-Location $main
  try {
    git init -q
    git config user.email 't@t.t'; git config user.name 'tester'
    Set-Content -Path (Join-Path $main 'README.md') -Value 'x'
    git add -A; git commit -qm init | Out-Null
    $wt = Join-Path $root "$name-wt"
    git worktree add -q $wt -b "$name-br" | Out-Null
  } finally { Pop-Location }
  $mainNm = Join-Path $main 'frontend\node_modules'
  New-Item -ItemType Directory $mainNm | Out-Null
  Set-Content -Path (Join-Path $mainNm 'keep.txt') -Value 'precious-dep'
  $wtFront = Join-Path $wt 'frontend'
  New-Item -ItemType Directory $wtFront | Out-Null
  $wtNm = Join-Path $wtFront 'node_modules'
  New-Item -ItemType Junction -Path $wtNm -Target $mainNm | Out-Null
  return @{ Main = $main; Wt = $wt; MainNm = $mainNm; WtNm = $wtNm }
}

# main worktree on 'main' tracking a bare origin/main (clean), plus a feature worktree.
# Used to exercise the end-of-run "refresh main" (git pull) step.
function New-FixtureWithOrigin {
  param([string]$name)
  $origin = Join-Path $root "$name-origin.git"
  git init -q --bare $origin | Out-Null
  $main = Join-Path $root "$name-main"
  New-Item -ItemType Directory $main | Out-Null
  Push-Location $main
  try {
    git init -q
    git config user.email 't@t.t'; git config user.name 'tester'
    Set-Content -Path (Join-Path $main 'README.md') -Value 'v1'
    git add -A; git commit -qm init | Out-Null
    git branch -M main
    git remote add origin $origin
    git push -q -u origin main | Out-Null
    $wt = Join-Path $root "$name-wt"
    git worktree add -q $wt -b "$name-br" | Out-Null
  } finally { Pop-Location }
  return @{ Origin = $origin; Main = $main; Wt = $wt }
}

# worktree nested INSIDE the main worktree (.claude/worktrees/<name>), mirroring the
# real repo layout - needed by the "leftover empty dir" case, whose only remaining
# clue is that the directory still sits inside the repo.
function New-NestedFixture {
  param([string]$name)
  $main = Join-Path $root "$name-main"
  New-Item -ItemType Directory $main | Out-Null
  Push-Location $main
  try {
    git init -q
    git config user.email 't@t.t'; git config user.name 'tester'
    Set-Content -Path (Join-Path $main 'README.md') -Value 'x'
    git add -A; git commit -qm init | Out-Null
    $wt = Join-Path $main ".claude\worktrees\$name"
    git worktree add -q $wt -b "$name-br" | Out-Null
  } finally { Pop-Location }
  return @{ Main = $main; Wt = $wt }
}

# push a new commit ($file) to origin/main from a throwaway clone, so the
# fixture's main worktree becomes exactly 1 behind origin/main.
function Advance-Origin {
  param($fx, [string]$file, [string]$content)
  $bump = "$($fx.Main)-bump"
  git clone -q $fx.Origin $bump | Out-Null
  Push-Location $bump
  try {
    git config user.email 't2@t.t'; git config user.name 'tester2'
    git checkout -q -B main origin/main
    Set-Content -Path (Join-Path $bump $file) -Value $content
    git add -A; git commit -qm bump | Out-Null
    git push -q origin main | Out-Null
  } finally { Pop-Location }
  Remove-Item $bump -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "== test 1: dry-run is non-destructive =="
$f = New-Fixture 'dry'
& $target -Path $f.Wt -DryRun | Out-Null
check (Test-Path $f.Wt) "dry-run: worktree preserved"
check ((Get-Item $f.WtNm -Force).LinkType -eq 'Junction') "dry-run: junction preserved"
check (Test-Path (Join-Path $f.MainNm 'keep.txt')) "dry-run: target dep preserved"

Write-Host "== test 2: normal remove keeps junction TARGET (junction-target guard) =="
$f = New-Fixture 'normal'
& $target -Path $f.Wt | Out-Null
check (-not (Test-Path $f.Wt)) "worktree removed"
check (Test-Path (Join-Path $f.MainNm 'keep.txt')) "*** main node_modules target PRESERVED ***"
check (@(Get-ChildItem $f.MainNm -Force).Count -ge 1) "target not emptied"

Write-Host "== test 3: non-worktree path is rejected =="
$bogus = Join-Path $root 'bogus-not-a-worktree'
New-Item -ItemType Directory $bogus | Out-Null
& $target -Path $bogus 2>$null | Out-Null
check ($LASTEXITCODE -eq 3) "non-worktree path rejected (exit 3)"
check (Test-Path $bogus) "bogus dir untouched"

Write-Host "== test 4: cwd inside target is rejected =="
$f = New-Fixture 'cwd'
Push-Location $f.Wt
& $target -Path $f.Wt 2>$null | Out-Null
$ec = $LASTEXITCODE
Pop-Location
check ($ec -eq 3) "cwd-inside-target rejected (exit 3)"
check (Test-Path $f.Wt) "worktree preserved when cwd inside"

Write-Host "== test 5: default run fast-forwards the main worktree's main (git pull) =="
$f = New-FixtureWithOrigin 'pull'
Advance-Origin $f 'NEWFILE.txt' 'from-origin'
& $target -Path $f.Wt | Out-Null
check (Test-Path (Join-Path $f.Main 'NEWFILE.txt')) "*** main worktree fast-forwarded (origin commit pulled) ***"

Write-Host "== test 6: dirty main worktree is NOT pulled (skip guard) =="
$f = New-FixtureWithOrigin 'dirty'
Advance-Origin $f 'NEWFILE.txt' 'from-origin'
Set-Content -Path (Join-Path $f.Main 'README.md') -Value 'locally-modified'
& $target -Path $f.Wt | Out-Null
check (-not (Test-Path (Join-Path $f.Main 'NEWFILE.txt'))) "dirty main not fast-forwarded"
check ((Get-Content (Join-Path $f.Main 'README.md')) -eq 'locally-modified') "local edit preserved"

Write-Host "== test 7: main worktree on a feature branch is NOT pulled =="
$f = New-FixtureWithOrigin 'featbr'
Advance-Origin $f 'NEWFILE.txt' 'from-origin'
Push-Location $f.Main; git checkout -q -b side-work; Pop-Location
& $target -Path $f.Wt | Out-Null
check (-not (Test-Path (Join-Path $f.Main 'NEWFILE.txt'))) "feature-branch main not fast-forwarded"

Write-Host "== test 8: -NoPull skips the refresh =="
$f = New-FixtureWithOrigin 'nopull'
Advance-Origin $f 'NEWFILE.txt' 'from-origin'
& $target -Path $f.Wt -NoPull | Out-Null
check (-not (Test-Path (Join-Path $f.Main 'NEWFILE.txt'))) "-NoPull leaves main un-refreshed"

Write-Host "== test 9: target locked by another process's cwd -> refuse, change NOTHING =="
# The real failure (2026-07-28): a session was running INSIDE the worktree while the
# script ran from the main worktree, so the cwd guard (which only sees THIS shell) passed.
# git then deleted the contents + deregistered but could not rmdir the folder -> half-removed.
$f = New-Fixture 'locked'
$holder = Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'Start-Sleep -Seconds 60' `
  -WorkingDirectory $f.Wt -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 1   # let the child actually enter the directory
  & $target -Path $f.Wt -Force 2>$null | Out-Null
  $ec = $LASTEXITCODE
} finally { $holder | Stop-Process -Force -ErrorAction SilentlyContinue }
check ($ec -eq 3) "locked worktree rejected (exit 3)"
check (Test-Path $f.Wt) "locked worktree preserved"
check ((Get-Item $f.WtNm -Force).LinkType -eq 'Junction') "*** junction NOT cut when locked ***"
check (Test-Path (Join-Path $f.Wt '.git')) "worktree still registered (.git file intact)"

Write-Host "== test 10: leftover empty dir (already deregistered) is recognized + cleaned =="
$f = New-NestedFixture 'leftover'
Get-ChildItem $f.Wt -Force | Remove-Item -Recurse -Force   # git's partial success: contents gone
Push-Location $f.Main; git worktree prune; Pop-Location    # ... and registration already dropped
$out = (& $target -Path $f.Wt 2>&1) -join "`n"
$ec = $LASTEXITCODE
check ($ec -eq 0) "leftover state handled (exit 0)"
check (-not (Test-Path $f.Wt)) "leftover empty dir removed"
check ($out -notmatch 'not a worktree root') "no misleading 'not a worktree root' message"

Set-Location $env:TEMP
Reset-Root

Write-Host ""
if ($script:fails -eq 0) { Write-Host "ALL PASS"; exit 0 } else { Write-Host "$($script:fails) CHECK(S) FAILED"; exit 1 }
