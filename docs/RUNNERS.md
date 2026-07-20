# Self-Hosted Runner Strategy

This document evaluates options for eliminating GitHub-hosted minutes as a single point of failure for kdl-os CI.

**Context:** [KDL-424](/KDL/issues/KDL-424) showed a billing lapse kills all CI instantly. The goal is a fallback path so critical checks can still run.

---

## Option comparison

| Option | Monthly cost | Maintenance | Security risk | Fallback reliability |
|--------|-------------|-------------|---------------|---------------------|
| A: Cloud self-hosted VM | ~$10–20 | Low | Medium (mitigable) | High |
| B: Local dev machine | $0 | High | Low | Low (machine must be on) |
| C: GitHub-hosted + spending buffer | ~$5–20 overage | None | None | Eliminated by raising limit |
| D: Act (local Docker runner) | $0 | None | None | Per-developer only |

---

## Recommended approach: Option C + Option D as immediate fixes

**For immediate hardening (zero infra cost):**
1. Raise spending limit to $20/month (see [BILLING_OUTAGE_RUNBOOK.md](BILLING_OUTAGE_RUNBOOK.md))
2. Enable the `billing-check` workflow for proactive alerting
3. Use `act` locally for developer-side fallback (Option D)

**For longer-term resilience (if GitHub outages recur):**
Evaluate Option A (cloud VM runner) — see design below.

---

## Option A: Cloud self-hosted runner design

### Recommended VM spec

| Provider | Instance | vCPU | RAM | Monthly |
|----------|----------|------|-----|---------|
| Hetzner | CX22 | 2 | 4 GB | ~€4 (~$4.50) |
| DigitalOcean | Basic | 2 | 2 GB | $12 |
| AWS | t3.small | 2 | 2 GB | ~$15 |

Hetzner CX22 is the best value for Linux-only CI (all kdl-os jobs run on `ubuntu-latest`).

### Security considerations for private-repo runners

Self-hosted runners on private repos can execute arbitrary code from PRs. Mitigations:

1. **Use ephemeral runners** (one job per runner lifetime): `--once` flag. A compromised job cannot affect the next job.
2. **Restrict to protected branches**: Configure workflows to use self-hosted runners only on `push` to `master`/`main`, not on untrusted `pull_request` events from forks.
3. **Require approval for first-time contributors**: GitHub setting under repo → Settings → Actions → Fork pull request workflows.
4. **Network isolation**: Do not give the runner VM access to production secrets or databases. The runner should only have read access to the GitHub repo.
5. **Separate runner groups**: Use a dedicated runner group for self-hosted; do not mix critical and low-trust jobs on the same runner.

### Fallback workflow pattern

Add `runs-on` fallback using a runner group label:

```yaml
# In .github/workflows/ci.yml, change:
jobs:
  backend-check:
    runs-on: ubuntu-latest

# To support self-hosted fallback:
jobs:
  backend-check:
    runs-on: ${{ vars.CI_RUNNER_LABEL || 'ubuntu-latest' }}
```

Set `CI_RUNNER_LABEL` as an org/repo variable to `self-hosted` when switching to the fallback runner, or leave unset to use GitHub-hosted.

### Runner setup script

On the target VM (Ubuntu 22.04):

```bash
#!/usr/bin/env bash
# Run once as a non-root user (e.g. `runner`)
set -euo pipefail

RUNNER_VERSION="2.317.0"   # Pin to a specific version
RUNNER_DIR="$HOME/actions-runner"

# Install dependencies
sudo apt-get update -qq
sudo apt-get install -y -qq curl jq docker.io
sudo usermod -aG docker "$USER"

# Download runner
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
curl -fsSL \
  "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
  | tar xz

# Configure (requires a registration token from GitHub)
# Get token: GitHub → repo Settings → Actions → Runners → New self-hosted runner
./config.sh \
  --url "https://github.com/F9info/kdl-os" \
  --token "$RUNNER_REG_TOKEN" \
  --name "kdl-os-$(hostname)" \
  --labels "self-hosted,linux,x64,kdl-fallback" \
  --runnergroup "kdl-fallback" \
  --ephemeral     # One job per runner instance (security best practice)

# Install as a service
sudo ./svc.sh install
sudo ./svc.sh start
```

**Registration token** is single-use and expires in 1 hour. Get it from:
https://github.com/F9info/kdl-os/settings/actions/runners/new

### Activation procedure (during billing outage)

1. Confirm runner VM is running: `sudo systemctl status actions.runner.*`
2. In the relevant workflow file, change `runs-on: ubuntu-latest` to `runs-on: [self-hosted, kdl-fallback]`
3. Commit directly to the affected branch (bypass CI since it's down)
4. When GitHub billing is restored, revert `runs-on` back to `ubuntu-latest`

---

## Option D: Act (local Docker-based runner)

[`act`](https://github.com/nektos/act) runs GitHub Actions workflows locally using Docker. No registration required.

```bash
# Install (macOS)
brew install act

# Run a specific job locally
act -j backend-check -W .github/workflows/ci.yml

# Run the full CI workflow
act pull_request -W .github/workflows/ci.yml
```

**Limitations:**
- Services (Postgres, Redis) require Docker Compose integration with act (`-P ubuntu-latest=...`)
- Some actions (e.g. `actions/setup-node`) work in Docker but may be slower
- Output is local only — no GitHub status check is posted

**Best use:** Developer self-verification when CI is unavailable, before merging a security fix.

---

## Decision log

| Date | Decision | Reason |
|------|----------|--------|
| 2026-07-20 | Implement alerting + docs first | No runner infra cost until alerting proves insufficient |
| — | Revisit cloud VM runner | If a second billing outage occurs or if paid minutes > $20/month consistently |
