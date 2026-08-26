# GitHub Actions Billing Outage — Incident Runbook

**Symptom:** Every CI job fails in ~3 seconds with no steps executed. Error in job summary resembles "This job was not able to be completed successfully."

This is the pattern from [KDL-424](/KDL/issues/KDL-424): a spending-limit lapse instantly kills all org-wide Actions without a visible billing error in the job logs.

---

## 1. Detection

### Automated (primary)
The `billing-check` workflow runs daily at 08:00 UTC and opens a GitHub issue labeled `billing-alert` when usage exceeds 80% of included minutes or any paid overage begins.

### Manual (fallback)
- All PRs show red CI checks with ~3 s job durations and no step output
- GitHub org billing page shows payment failure or spending limit reached

---

## 2. Confirm it's a billing issue

```bash
# Does every job die in < 10 seconds with no steps?
# Check a recent failed run in GitHub UI: Actions → any workflow → failed run

# From the GitHub UI, look at the job summary.
# Billing failure: no steps run, summary is blank or shows a generic error.
# Real test failure: steps run, failure is in a named step.
```

Also check: **GitHub org settings → Billing and plans** (requires org admin access).

Look for:
- Red "Payment failed" banner
- Spending limit reached (amount = $0 limit)
- Plan expired or suspended

---

## 3. Owner and escalation path

| Role | Person / resource |
|------|------------------|
| Primary billing owner | F9 Info Technologies org admin (GitHub org owner) |
| GitHub billing support | https://support.github.com → "Billing" category |
| Internal escalation | DevOps lead → CTO |

---

## 4. Interim verification while CI is down

**Do not block security work (Dependabot PRs, CVE patches) on CI recovery.**

Follow [docs/CI_LOCAL_VERIFICATION.md](CI_LOCAL_VERIFICATION.md) to run lint, typecheck, audit, and build locally in an agent execution workspace.

---

## 5. Recovery steps

### Step 1 — Fix billing

Go to: https://github.com/organizations/F9info/settings/billing

Options:
- **Payment failed**: Update payment method → retry charge
- **Spending limit hit**: Raise spending limit (Settings → Billing → Actions spending limit)
- **Free minutes exhausted**: Upgrade plan or set a non-zero spending limit to allow paid overage

**Minimum buffer**: Set spending limit ≥ $20 to absorb one month of CI spikes without an outage.

### Step 2 — Verify recovery

After billing is fixed, trigger a manual run:

```bash
# From GitHub UI: Actions → CI → Run workflow → master
# Or via gh CLI:
gh workflow run ci.yml --ref master
```

Watch the job. If steps now execute, billing is resolved.

### Step 3 — Validate all workflows

```bash
gh run list --limit 10 --json status,conclusion,workflowName \
  | jq '.[] | {workflowName, status, conclusion}'
```

All should show `completed` with `success` (or `failure` for real test failures).

### Step 4 — Close the billing-alert issue

```bash
gh issue close --repo F9info/kdl-os \
  $(gh issue list --label billing-alert --state open --json number --jq '.[0].number') \
  --comment "Billing resolved. Spending limit raised to \$X. CI running normally."
```

---

## 6. Prevention

### Alerting setup (one-time admin task)

The `billing-check` workflow needs a PAT with billing read access:

1. Go to https://github.com/settings/tokens (personal access tokens, classic)
2. Create a token with scope: `manage_billing:github`
3. Add it as an org secret named `BILLING_CHECK_PAT`:
   - https://github.com/organizations/F9info/settings/secrets/actions

**Without this secret the `billing-check` workflow fails loudly** — the missing secret is itself a signal to investigate.

### GitHub billing email alerts

GitHub sends billing alert emails to org owners. Ensure the billing email address is actively monitored:
- https://github.com/organizations/F9info/settings/billing → Billing email

### Spending limit floor

Never leave spending limit at $0 for an active org. A $0 limit means free minutes exhaustion = full CI outage.

Recommended: Set limit to $20–$50/month. At GitHub's Linux rate ($0.008/min), that buys 2,500–6,250 extra minutes.

---

## 7. Post-incident checklist

- [ ] Billing resolved and CI running
- [ ] Billing-alert issue closed with resolution note
- [ ] Spending limit raised above $0
- [ ] `BILLING_CHECK_PAT` secret confirmed valid
- [ ] Root cause logged in parent issue ([KDL-424](/KDL/issues/KDL-424))
- [ ] Consider if any PRs were merged without CI — audit manually if so
