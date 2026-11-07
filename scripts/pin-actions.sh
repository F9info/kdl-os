#!/usr/bin/env bash
# Pins every `uses: owner/repo@vX` in .github/workflows to the commit SHA of that tag, keeping the tag as a comment.
# A tag can be moved to malicious code; a SHA cannot. Re-run after Dependabot bumps a tag. Needs `gh` and python3.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import re, glob, subprocess
cache = {}
def sha(repo, tag):
    if (repo, tag) not in cache:
        r = subprocess.run(["gh", "api", f"repos/{repo}/commits/{tag}", "--jq", ".sha"], capture_output=True, text=True)
        cache[(repo, tag)] = r.stdout.strip() if r.returncode == 0 else ""
    return cache[(repo, tag)]
pat = re.compile(r"(uses: )([\w.-]+/[\w./-]+)@(v[0-9][\w.]*)(.*)$")
for f in glob.glob(".github/workflows/*.yml"):
    out = []
    for line in open(f).read().split("\n"):
        m = pat.search(line)
        if m and (s := sha(m[2], m[3])):
            line = line[:m.start()] + f"{m[1]}{m[2]}@{s} # {m[3]}"
        out.append(line)
    open(f, "w").write("\n".join(out))
for k, v in cache.items():
    if not v: print("not resolved:", k)
PY
