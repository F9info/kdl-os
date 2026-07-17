#!/usr/bin/env bash
# grep-verify: hard completion gate (KDL-330 Fix B2, KDL-335).
#
# Before any parent issue is closed, the closer MUST prove that the claimed
# work actually landed: every referenced commit exists AND is reachable from
# the base branch, every referenced file exists on the base branch, and any
# claimed code content actually greps on the base branch. Paste this script's
# output into the closing comment. Any FAIL blocks the close.
#
# Usage:
#   scripts/grep-verify.sh [options]
#
# Options (repeatable where noted):
#   --commit SHA          commit that must exist and be an ancestor of the base branch (repeatable)
#   --file PATH           file that must exist on the base branch (repeatable)
#   --grep PATTERN:PATH   PATTERN (fixed string) must appear in PATH on the base branch (repeatable)
#   --grep PATTERN        PATTERN must appear somewhere on the base branch (repeatable)
#   --pr NUMBER           GitHub PR that must be merged with base == the base branch (needs gh)
#   --base BRANCH         base branch to verify against (default: master)
#   --remote NAME         remote to fetch/verify against (default: origin)
#   --allow-stale         skip the fetch (offline); results may be stale and are marked as such
#   -h, --help            show this help
#
# Exit codes: 0 = all checks passed, 1 = at least one FAIL, 2 = usage error.

set -u

BASE="master"
REMOTE="origin"
ALLOW_STALE=0
COMMITS=()
FILES=()
GREPS=()
PRS=()

usage() { sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --commit) COMMITS+=("${2:?--commit needs a SHA}"); shift 2 ;;
    --file) FILES+=("${2:?--file needs a path}"); shift 2 ;;
    --grep) GREPS+=("${2:?--grep needs PATTERN[:PATH]}"); shift 2 ;;
    --pr) PRS+=("${2:?--pr needs a number}"); shift 2 ;;
    --base) BASE="${2:?--base needs a branch}"; shift 2 ;;
    --remote) REMOTE="${2:?--remote needs a name}"; shift 2 ;;
    --allow-stale) ALLOW_STALE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [ ${#COMMITS[@]} -eq 0 ] && [ ${#FILES[@]} -eq 0 ] && [ ${#GREPS[@]} -eq 0 ] && [ ${#PRS[@]} -eq 0 ]; then
  echo "nothing to verify: pass at least one --commit/--file/--grep/--pr" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "FAIL: not inside a git repository" >&2; exit 1; }
cd "$REPO_ROOT" || exit 1

FAILURES=0
pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; FAILURES=$((FAILURES + 1)); }

echo "== grep-verify gate (base: $REMOTE/$BASE, repo: $REPO_ROOT) =="

if [ "$ALLOW_STALE" -eq 1 ]; then
  echo "WARN  --allow-stale: skipped fetch; $REMOTE/$BASE may be out of date"
elif git fetch --quiet "$REMOTE" "$BASE"; then
  pass "fetched $REMOTE/$BASE ($(git rev-parse --short "$REMOTE/$BASE"))"
else
  fail "could not fetch $REMOTE/$BASE (network/auth?); re-run with --allow-stale only if you accept stale results"
fi

BASE_REF="$REMOTE/$BASE"
git rev-parse --verify --quiet "$BASE_REF^{commit}" >/dev/null || { fail "base ref $BASE_REF does not exist"; echo "== RESULT: FAIL =="; exit 1; }

for sha in ${COMMITS[@]+"${COMMITS[@]}"}; do
  if ! git cat-file -e "$sha^{commit}" 2>/dev/null; then
    fail "commit $sha does not exist in this repository"
    continue
  fi
  if git merge-base --is-ancestor "$sha" "$BASE_REF"; then
    pass "commit $sha exists and is reachable from $BASE_REF"
  else
    fail "commit $sha exists but is NOT reachable from $BASE_REF (stranded branch / unmerged PR?)"
  fi
done

for path in ${FILES[@]+"${FILES[@]}"}; do
  if git cat-file -e "$BASE_REF:$path" 2>/dev/null; then
    pass "file $path exists on $BASE_REF"
  else
    fail "file $path does NOT exist on $BASE_REF"
  fi
done

for spec in ${GREPS[@]+"${GREPS[@]}"}; do
  pattern="${spec%%:*}"
  pathpart=""
  [ "$spec" != "$pattern" ] && pathpart="${spec#*:}"
  if [ -n "$pathpart" ]; then
    if git grep -qF "$pattern" "$BASE_REF" -- "$pathpart" 2>/dev/null; then
      pass "pattern '$pattern' found in $pathpart on $BASE_REF"
    else
      fail "pattern '$pattern' NOT found in $pathpart on $BASE_REF"
    fi
  else
    if git grep -qF "$pattern" "$BASE_REF" 2>/dev/null; then
      pass "pattern '$pattern' found on $BASE_REF"
    else
      fail "pattern '$pattern' NOT found anywhere on $BASE_REF"
    fi
  fi
done

for pr in ${PRS[@]+"${PRS[@]}"}; do
  if ! command -v gh >/dev/null 2>&1; then
    fail "PR #$pr: gh CLI not available; verify merge state another way"
    continue
  fi
  info="$(gh pr view "$pr" --json state,baseRefName,mergeCommit --jq '[.state, .baseRefName, (.mergeCommit.oid // "none")] | join(" ")' 2>/dev/null)"
  if [ -z "$info" ]; then
    fail "PR #$pr: could not read PR state via gh"
    continue
  fi
  read -r state baseref mergesha <<EOF
$info
EOF
  if [ "$state" != "MERGED" ]; then
    fail "PR #$pr is $state, not MERGED"
  elif [ "$baseref" != "$BASE" ]; then
    fail "PR #$pr merged into '$baseref', not '$BASE' (stacked-base strand risk)"
  elif [ "$mergesha" != "none" ] && ! git merge-base --is-ancestor "$mergesha" "$BASE_REF" 2>/dev/null; then
    fail "PR #$pr merge commit $mergesha is NOT reachable from $BASE_REF"
  else
    pass "PR #$pr merged into $BASE (merge commit: $mergesha)"
  fi
done

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "== RESULT: FAIL ($FAILURES check(s) failed) — DO NOT close the issue =="
  exit 1
fi
echo "== RESULT: PASS — safe to close =="
exit 0
