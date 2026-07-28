#!/usr/bin/env pwsh
# remove-worktree.ps1 - safely remove a git worktree, cutting any node_modules junction FIRST.
#
# Why: on Windows, a worktree's node_modules can be a JUNCTION pointing at the MAIN
#   worktree's node_modules (a common setup to avoid reinstalling deps per worktree).
#   A plain `git worktree remove` / rm -rf follows that junction and DELETES THE TARGET's
#   contents (i.e. empties the main worktree's node_modules). This script cuts the junction
#   LINK ONLY (target preserved) before removing the worktree, so the main repo keeps its
#   dependencies. Both layouts are handled: root `node_modules` (RandomTravel) and nested
#   `frontend/node_modules` (BookTimer). A real folder (not a junction) is left for git.
#
# Guards (refuse with exit 3): non-existent path, not a worktree root, the MAIN worktree,
#   a path not registered as a worktree of this repo, a current directory inside the
#   target (you cannot delete the folder your shell stands in), or a folder ANOTHER
#   process stands in - the cwd guard only sees this shell, so a Claude Code session or
#   terminal living inside the worktree slips past it (that is exactly how the folder
#   ends up half-removed). Step 6 probes actual removability before anything is touched.
#
# A worktree left half-removed by an earlier run (contents deleted + deregistered, empty
#   folder stuck behind) is recognized in step 2b and finished off, instead of reporting
#   the misleading "not a worktree root".
#
# After removal it also fast-forwards the MAIN worktree's main branch (git pull), so the
# local main catches up to the merge that just landed on origin. This is best-effort and
# only runs when the main worktree is idle on main and clean (see step 11); -NoPull skips it.
#
# Usage:
#   powershell -File .claude/scripts/remove-worktree.ps1 <worktree-path>
#   ... -DryRun       show what would happen, change nothing
#   ... -Force        pass --force to git worktree remove (dirty/untracked worktree)
#   ... -KeepBranch   do not delete the local branch after removing
#   ... -NoPull       do not fast-forward the main worktree's main after removal
#
# Run this from OUTSIDE the target worktree (e.g. the main worktree).
# Exit: 0 ok, 2 usage, 3 guard violation, 1 git failure.
param(
  [Parameter(Mandatory = $true, Position = 0)][string]$Path,
  [switch]$DryRun,
  [switch]$Force,
  [switch]$KeepBranch,
  [switch]$NoPull
)

# git writes to stderr on normal "not a repo" probes; under a caller's
# $ErrorActionPreference='Stop' that native stderr is turned into a terminating
# error. Force Continue in our own scope so our explicit guards (not PowerShell
# exceptions) decide control flow. Caller's preference is restored automatically
# when this child-scope script returns.
$ErrorActionPreference = 'Continue'

function info($m) { Write-Host "[remove-worktree] $m" }
function fail($m, $code) { Write-Host "[remove-worktree] ERROR: $m"; exit $code }

$norm = { param($p) ($p -replace '/', '\').TrimEnd('\') }

# 1. target path must exist
if (-not (Test-Path $Path)) { fail "path not found: $Path" 3 }
$abs = & $norm (Resolve-Path $Path).Path

# 2. must be a git worktree ROOT (not just any folder, not a subdir)
$top = (git -C $abs rev-parse --show-toplevel 2>$null)
if (-not $top) { fail "not inside a git repo: $abs" 3 }
$topNorm = & $norm (Resolve-Path $top).Path
if ($topNorm -ine $abs) {
  # 2b. leftover of a PARTIALLY removed worktree: `git worktree remove` deletes the contents
  #     and drops the registration first, then fails to rmdir the folder itself when another
  #     process stands in it (Windows). What survives is an empty directory that is no longer
  #     a worktree root - so the plain "not a worktree root" below would name the wrong
  #     problem. Recognize the state and finish the job instead.
  if (@(Get-ChildItem $abs -Recurse -Force).Count -eq 0) {
    info "registration is already gone - only an empty leftover directory remains (an earlier removal was cut short)"
    if ($DryRun) { info "(dry-run) would remove leftover empty directory: $abs"; exit 0 }
    try { [IO.Directory]::Delete($abs) }
    catch { fail "leftover directory is still in use - close the shell/session running inside it, then retry: $abs" 3 }
    info "leftover directory removed: $abs"
    git -C $topNorm worktree prune 2>$null   # drop any stale admin entry left behind
    info "done."
    exit 0
  }
  fail "path is not a worktree root (repo top = $topNorm)" 3
}

# 3. locate the main worktree; refuse to remove it
$commonDir = (git -C $abs rev-parse --path-format=absolute --git-common-dir 2>$null)
if (-not $commonDir) { fail "cannot resolve git-common-dir for: $abs" 3 }
$mainDir = & $norm (Resolve-Path (Split-Path -Parent $commonDir)).Path
if ($abs -ieq $mainDir) { fail "refusing to remove the MAIN worktree: $abs" 3 }

# 4. confirm $abs is a registered worktree of this repo
$isRegistered = $false
foreach ($line in (git -C $mainDir worktree list --porcelain 2>$null)) {
  if ($line -like 'worktree *') {
    $wp = ($line -replace '^worktree ', '')
    $wpResolved = (Resolve-Path $wp -ErrorAction SilentlyContinue)
    if ($wpResolved -and ((& $norm $wpResolved.Path) -ieq $abs)) { $isRegistered = $true }
  }
}
if (-not $isRegistered) { fail "not a registered worktree of this repo: $abs" 3 }

# 5. cwd guard: cannot remove the folder the current shell stands in (or under)
$cwd = & $norm (Get-Location).Path
if ($cwd -ieq $abs -or $cwd.ToLower().StartsWith(($abs.ToLower() + '\'))) {
  fail "current directory is inside the target; run from elsewhere (e.g. the main worktree): $abs" 3
}

# 6. removability probe - the guard the cwd check cannot be. A directory another process
#    holds as its current directory can be neither renamed nor deleted on Windows, and
#    step 5 only sees THIS shell: a Claude Code session or terminal standing inside the
#    worktree passes it. Ask the filesystem instead, by renaming the folder and undoing it
#    right away - net zero, but it fails exactly when a delete would. Without this, git
#    wipes the contents and deregisters the worktree before hitting the rmdir it cannot do.
$probe = "$abs.rmprobe-$PID"
try { [IO.Directory]::Move($abs, $probe) }
catch {
  fail "cannot remove - folder is in use: close any shell or Claude Code session running inside this worktree, then retry: $abs" 3
}
try { [IO.Directory]::Move($probe, $abs) }
catch { fail "probe rename could not be undone - the worktree now sits at: $probe (rename it back to $abs)" 1 }

# 7. remember the branch (for optional deletion after removal)
$branch = (git -C $abs rev-parse --abbrev-ref HEAD 2>$null)

# 8. cut any node_modules junction FIRST (link only -> target preserved).
#    Checks both layouts: root 'node_modules' (RandomTravel) and 'frontend\node_modules'
#    (BookTimer). Only junctions are cut; a real folder is left for git to remove.
foreach ($rel in @('node_modules', 'frontend\node_modules')) {
  $nm = Join-Path $abs $rel
  if (-not (Test-Path $nm)) { continue }
  $item = Get-Item $nm -Force
  if ($item.LinkType -eq 'Junction') {
    info "junction at $rel -> $($item.Target)"
    if ($DryRun) { info "(dry-run) would cut junction link (target preserved)" }
    else { [IO.Directory]::Delete($nm); info "junction cut (link only; target preserved)" }
  }
  else {
    info "$rel is a real folder (not a junction) - left for git to handle"
  }
}

# 9. remove the worktree
if ($DryRun) {
  $msg = "(dry-run) would run: git worktree remove `"$abs`""
  if ($Force) { $msg += ' --force' }
  info $msg
}
else {
  $rmArgs = @('-C', $mainDir, 'worktree', 'remove', $abs)
  if ($Force) { $rmArgs += '--force' }
  git @rmArgs
  if ($LASTEXITCODE -ne 0) {
    fail "git worktree remove failed (worktree has changes? retry with -Force): $abs" 1
  }
  info "worktree removed: $abs"
}

# 10. delete the local branch (optional, safe -d only)
if (-not $KeepBranch -and $branch -and $branch -ne 'HEAD') {
  if ($DryRun) { info "(dry-run) would delete local branch (if merged): $branch" }
  else {
    git -C $mainDir branch -d $branch 2>$null
    if ($LASTEXITCODE -ne 0) {
      info "branch '$branch' not fully merged - kept (use 'git branch -D $branch' to force)"
    }
    else { info "local branch deleted: $branch" }
  }
}

# 11. refresh the MAIN worktree's main branch (best-effort; never disrupt active work).
#     After a merged worktree is removed, the local main is usually behind origin/main
#     (the merge landed on the remote). Bring it current - but only when the main worktree
#     is idle on main and clean, and only via fast-forward. Any failure here is non-fatal:
#     the removal (this script's real job) already succeeded.
if (-not $NoPull) {
  if ($DryRun) {
    info "(dry-run) would fast-forward main worktree's main (if on main + clean + upstream): $mainDir"
  }
  else {
    $mb = (git -C $mainDir rev-parse --abbrev-ref HEAD 2>$null)
    git -C $mainDir diff --quiet 2>$null;          $treeDirty = ($LASTEXITCODE -ne 0)
    git -C $mainDir diff --cached --quiet 2>$null;  if ($LASTEXITCODE -ne 0) { $treeDirty = $true }
    git -C $mainDir rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null | Out-Null
    $hasUpstream = ($LASTEXITCODE -eq 0)
    if ($mb -notin @('main', 'master')) {
      info "main worktree is on '$mb' (not main) - skipping refresh (won't switch branches)"
    }
    elseif ($treeDirty) {
      info "main worktree has uncommitted changes - skipping refresh (won't pull over your edits)"
    }
    elseif (-not $hasUpstream) {
      info "main worktree's '$mb' has no upstream - skipping refresh (offline/local-only)"
    }
    else {
      $before = (git -C $mainDir rev-parse --short HEAD 2>$null)
      git -C $mainDir pull --ff-only 2>$null | Out-Null
      if ($LASTEXITCODE -eq 0) {
        $after = (git -C $mainDir rev-parse --short HEAD 2>$null)
        if ($before -eq $after) { info "main already up to date ($after)" }
        else { info "main refreshed (fast-forward): $before..$after" }
      }
      else {
        info "main pull skipped (diverged or offline) - left as-is; run 'git pull' manually"
      }
    }
  }
}

if ($DryRun) { info "dry-run complete (no changes)." } else { info "done." }
exit 0
