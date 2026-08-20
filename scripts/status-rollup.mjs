#!/usr/bin/env node
/**
 * status-rollup.mjs — regenerates the rollup block in STATUS.md (KDL-519).
 *
 * STATUS.md answers one question: what is actually DONE vs PENDING. The board
 * cannot answer it (500+ done issues, no aggregate) and PR state lies (see
 * KDL-520: commits pushed straight to master make GitHub close PRs instead of
 * merging them). So this rollup is derived from the code and the APIs, never
 * hand-written.
 *
 * Usage:
 *   node scripts/status-rollup.mjs          # rewrite the block in STATUS.md
 *   node scripts/status-rollup.mjs --check  # exit 1 if STATUS.md differs from reality
 *   node scripts/status-rollup.mjs --stdout # print the block, touch nothing
 *
 * `--check` is a local staleness probe, NOT a CI gate: board and PR state move on
 * their own, so it goes red without anyone touching the repo. Regenerate rather
 * than treating a red --check as a defect.
 *
 * Only the region between the BEGIN/END markers is touched. Everything below
 * it — the rolling changelog agents prepend to per CLAUDE.md — is preserved
 * verbatim.
 *
 * Sources of truth, in order of trust:
 *   1. module table   — the filesystem (backend/src/modules/*)
 *   2. driver table   — parsed from drivers/index.js source, NOT its header comment
 *   3. PR table       — `gh` (open PRs + closed-PR-vs-master reconciliation)
 *   4. blocked issues — Paperclip API, joined to .agents/unblock-owners.json
 *
 * Sections 3 and 4 need network/credentials. When those are missing the section
 * says so loudly instead of silently rendering an empty (i.e. "all clear") table.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MODULES_DIR = join(REPO_ROOT, 'backend/src/modules');
const BACKEND_TESTS_DIR = join(REPO_ROOT, 'backend/tests');
const DRIVERS_FILE = join(REPO_ROOT, 'backend/src/modules/template-engine/drivers/index.js');
const OWNERS_FILE = join(REPO_ROOT, '.agents/unblock-owners.json');
const STATUS_FILE = join(REPO_ROOT, 'STATUS.md');

const BEGIN = '<!-- BEGIN GENERATED ROLLUP — regenerate with `node scripts/status-rollup.mjs`; do not hand-edit -->';
const END = '<!-- END GENERATED ROLLUP -->';

/** Drivers that legitimately make no downstream call — they are pure aggregates. */
const NO_DOWNSTREAM_BY_DESIGN = new Set(['preflight', 'export']);

const args = new Set(process.argv.slice(2));

// ---------------------------------------------------------------- helpers

function sh(cmd, cmdArgs, opts = {}) {
  return execFileSync(cmd, cmdArgs, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 32 * 1024 * 1024,
    ...opts,
  });
}

function trySh(cmd, cmdArgs, opts) {
  try {
    return { ok: true, out: sh(cmd, cmdArgs, opts) };
  } catch (e) {
    return { ok: false, err: e.message };
  }
}

/** Strip comments so a header comment can never be mistaken for code. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

const md = (s) => String(s ?? '').replace(/\|/g, '\\|');

// ------------------------------------------------- 1. module build state

/**
 * A module is only "built" if the directory really contains service + routes +
 * controller. Several modules previously shipped docs-only and were marked done
 * on the board anyway — hence this check looks at code, not at documentation.
 */
function collectModules() {
  if (!existsSync(MODULES_DIR)) return [];

  // Most suites live in backend/tests/, not beside the module, so count both.
  const centralTests = existsSync(BACKEND_TESTS_DIR)
    ? walk(BACKEND_TESTS_DIR)
        .filter((p) => p.endsWith('.test.js'))
        .map((p) => relative(BACKEND_TESTS_DIR, p))
    : [];

  return readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => {
      const dir = join(MODULES_DIR, name);
      const files = walk(dir).map((p) => relative(dir, p));

      const code = files.filter((f) => f.endsWith('.js') && !/\.test\.js$/.test(f));
      const tests = files.filter((f) => /\.test\.js$/.test(f));
      const docs = files.filter((f) => f.endsWith('.md'));

      const has = (re) => code.some((f) => re.test(f));
      const hasService = has(/(^|\/)[^/]*service[^/]*\.js$/i);
      const hasRoutes = has(/(^|\/)[^/]*routes?[^/]*\.js$/i);
      const hasController = has(/(^|\/)[^/]*controller[^/]*\.js$/i);

      // An empty express Router export is a nav shell, not a served surface.
      const routeFiles = code.filter((f) => /(^|\/)[^/]*routes?[^/]*\.js$/i.test(f));
      const routesAreEmpty =
        routeFiles.length > 0 &&
        routeFiles.every((f) => {
          const body = stripComments(readFileSync(join(dir, f), 'utf8'));
          return !/router\.(get|post|put|patch|delete|use)\s*\(/.test(body);
        });

      const central = centralTests.filter((p) => {
        const segments = p.split('/');
        return segments.slice(0, -1).includes(name) || segments.at(-1).startsWith(`${name}.`);
      });
      const testCount = tests.length + central.length;

      let state;
      let detail;
      if (hasService && hasRoutes && hasController) {
        state = 'built';
        detail = 'service + routes + controller';
      } else if (hasRoutes && routesAreEmpty && !hasService && !hasController) {
        state = 'stubbed';
        detail = 'nav-only shell — empty Router, no service/controller';
      } else if (hasRoutes || hasService || hasController) {
        state = 'stubbed';
        detail = `partial: ${[
          hasService ? 'service' : 'no service',
          hasRoutes ? 'routes' : 'no routes',
          hasController ? 'controller' : 'no controller',
        ].join(', ')}`;
      } else if (docs.length > 0) {
        state = 'spec-only';
        detail = `docs only (${docs.length} .md, 0 code files)`;
      } else {
        state = 'spec-only';
        detail = 'no service/routes/controller found';
      }

      let manifest = null;
      const manifestPath = join(dir, 'module.json');
      if (existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        } catch {
          manifest = { slug: '(unparseable module.json)' };
        }
      }

      return {
        name,
        state,
        detail,
        tests: testCount,
        purpose: manifest?.description ?? (manifest ? '' : '(no module.json)'),
        manifest,
      };
    });
}

// ------------------------------------------- 2. template-engine drivers

/**
 * Derived from the DRIVERS registry and each driver body — deliberately NOT from
 * the file's header comment, which has gone stale before (KDL-521).
 */
function collectDrivers() {
  if (!existsSync(DRIVERS_FILE)) {
    return { error: `not found: ${relative(REPO_ROOT, DRIVERS_FILE)}` };
  }
  const raw = readFileSync(DRIVERS_FILE, 'utf8');
  const src = stripComments(raw);

  const registry = src.match(/const\s+DRIVERS\s*=\s*\{([\s\S]*?)\n\};/);
  if (!registry) return { error: 'could not locate the `const DRIVERS = {...}` registry' };

  const stages = [...registry[1].matchAll(/(\w+)\s*:\s*(\w+)\s*,/g)].map((m) => ({
    stage: m[1],
    varName: m[2],
  }));

  // Identifiers pulled in from outside the drivers directory count as upstream.
  const upstreamSymbols = new Set();
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (!m[2].startsWith('..')) continue;
    for (const sym of m[1].replace(/[{}]/g, ' ').split(',')) {
      const clean = sym.trim().split(/\s+as\s+/).pop().trim();
      if (clean) upstreamSymbols.add(clean);
    }
  }

  for (const s of stages) {
    const body = extractObjectBody(src, s.varName);
    if (body == null) {
      s.status = 'UNPARSEABLE';
      s.evidence = `no \`const ${s.varName} = {\` found`;
      continue;
    }
    const callsUpstream =
      /\bfetch\s*\(/.test(body) ||
      /\baxios\b/.test(body) ||
      [...upstreamSymbols].some((sym) => new RegExp(`\\b${sym}\\b`).test(body));

    if (/\bnotBuilt\s*\(/.test(body)) {
      s.status = 'UPSTREAM_NOT_BUILT';
      s.evidence = 'throws notBuilt() — Phase 1 stub';
    } else if (callsUpstream) {
      s.status = 'REAL';
      s.evidence = 'calls an upstream module';
    } else if (NO_DOWNSTREAM_BY_DESIGN.has(s.stage)) {
      s.status = 'REAL';
      s.evidence = 'pure local aggregate — no downstream call by design';
    } else {
      s.status = 'NO_DOWNSTREAM';
      s.evidence = 'resolves without calling its upstream module — silent no-op';
    }
  }

  return { stages };
}

function extractObjectBody(src, varName) {
  const start = src.search(new RegExp(`const\\s+${varName}\\s*=\\s*\\{`));
  if (start < 0) return null;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

// -------------------------------------------------------- 3. PR reality

/**
 * Two things matter here: what is genuinely open, and which CLOSED PRs actually
 * shipped. The second case is the KDL-520 defect — commits pushed direct to
 * master make GitHub mark the PR CLOSED, so PR state under-reports what shipped.
 */
function collectPrs({ closedScan = 40 } = {}) {
  if (!trySh('gh', ['--version']).ok) return { error: '`gh` CLI not available' };
  if (!trySh('gh', ['auth', 'status']).ok) return { error: '`gh` is not authenticated' };

  trySh('git', ['fetch', 'origin', 'master', '--quiet']);
  const masterRef = trySh('git', ['rev-parse', '--verify', 'origin/master']).ok
    ? 'origin/master'
    : 'master';
  const masterLog = trySh('git', ['log', '--format=%H%x09%s', masterRef]);
  if (!masterLog.ok) return { error: 'could not read the master git log' };

  const masterSubjects = new Set();
  const masterShas = new Set();
  for (const line of masterLog.out.split('\n')) {
    const [sha, subject] = line.split('\t');
    if (!sha) continue;
    masterShas.add(sha);
    if (subject) masterSubjects.add(subject.trim());
  }

  const openRes = trySh('gh', [
    'pr', 'list', '--state', 'open', '--limit', '100',
    '--json', 'number,title,headRefName,isDraft,mergeable,mergeStateStatus,reviewDecision,createdAt',
  ]);
  if (!openRes.ok) return { error: `\`gh pr list --state open\` failed: ${openRes.err}` };
  const open = JSON.parse(openRes.out);

  const closedRes = trySh('gh', [
    'pr', 'list', '--state', 'closed', '--limit', String(closedScan),
    '--json', 'number,title,headRefName,mergedAt,closedAt,headRefOid',
  ]);
  const ghosts = [];
  let closedScanned = 0;
  if (closedRes.ok) {
    const closed = JSON.parse(closedRes.out).filter((p) => p.mergedAt == null);
    closedScanned = JSON.parse(closedRes.out).length;
    for (const pr of closed) {
      const evidence = [];
      if (pr.headRefOid && masterShas.has(pr.headRefOid)) {
        evidence.push(`head ${pr.headRefOid.slice(0, 8)} is on master`);
      }
      const squashed = [...masterSubjects].find((s) => s.endsWith(`(#${pr.number})`));
      if (squashed) evidence.push(`squash commit "${squashed}"`);

      // Rebase-and-push loses both signals above, so compare commit subjects too.
      const commits = trySh('gh', ['pr', 'view', String(pr.number), '--json', 'commits']);
      if (commits.ok) {
        try {
          const subs = JSON.parse(commits.out).commits.map((c) =>
            (c.messageHeadline || '').trim(),
          );
          const landed = subs.filter((s) => s && masterSubjects.has(s));
          if (landed.length > 0) {
            evidence.push(`${landed.length}/${subs.length} commit subject(s) on master`);
          }
        } catch { /* shape drift in gh output — fall through with what we have */ }
      }
      if (evidence.length > 0) ghosts.push({ ...pr, evidence });
    }
  }

  return { open, ghosts, closedScanned, closedScanLimit: closedScan, ghostError: closedRes.ok ? null : closedRes.err };
}

// --------------------------------------------------- 4. blocked issues

/**
 * The issue list is generated. The unblock OWNER comes from the board's own
 * `unblockDescriptor` when it is set; otherwise it falls back to the curated
 * .agents/unblock-owners.json. A blocked issue with neither is rendered as an
 * explicit gap rather than quietly omitted.
 */
async function collectBlocked() {
  const base = (process.env.PAPERCLIP_API_URL || '').replace(/\/$/, '').replace(/\/api$/, '');
  const key = process.env.PAPERCLIP_API_KEY;
  const company = process.env.PAPERCLIP_COMPANY_ID;

  let owners = {};
  if (existsSync(OWNERS_FILE)) {
    try {
      owners = JSON.parse(readFileSync(OWNERS_FILE, 'utf8')).owners ?? {};
    } catch {
      return { error: `${relative(REPO_ROOT, OWNERS_FILE)} is not valid JSON` };
    }
  }

  if (!base || !key || !company) {
    return {
      error:
        'PAPERCLIP_API_URL / PAPERCLIP_API_KEY / PAPERCLIP_COMPANY_ID not set — ' +
        'board state could not be read (run this from a Paperclip agent run)',
      owners,
    };
  }

  const get = async (path) => {
    const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
    return res.json();
  };

  let issues;
  let agentNames = new Map();
  try {
    const body = await get(`/api/companies/${company}/issues?limit=1000`);
    issues = Array.isArray(body) ? body : body.issues ?? body.data ?? body.items ?? [];
    const roster = await get(`/api/companies/${company}/agents`);
    const list = Array.isArray(roster) ? roster : roster.agents ?? [];
    agentNames = new Map(list.map((a) => [a.id, a.name]));
  } catch (e) {
    return { error: `board API request failed: ${e.message}`, owners };
  }

  const counts = {};
  for (const i of issues) counts[i.status] = (counts[i.status] ?? 0) + 1;

  /** Board descriptor wins; curated file is the fallback. */
  const resolveOwner = (issue) => {
    const d = issue.unblockDescriptor;
    if (d && (d.owner || d.action)) {
      const agentId = d.owner?.agentId ?? d.ownerAgentId;
      const name = d.owner?.name ?? (agentId ? agentNames.get(agentId) ?? `agent ${agentId.slice(0, 8)}` : null);
      return {
        owner: name ?? d.owner?.userId ?? 'board descriptor (no owner named)',
        action: d.action ?? '(no action recorded on the descriptor)',
        source: 'board `unblockDescriptor`',
      };
    }
    const curated = owners[issue.identifier];
    return curated ? { ...curated, source: '`.agents/unblock-owners.json`' } : null;
  };

  const pick = (status) =>
    issues
      .filter((i) => i.status === status)
      .sort((a, b) => (a.issueNumber ?? 0) - (b.issueNumber ?? 0))
      .map((i) => ({
        identifier: i.identifier,
        title: i.title,
        priority: i.priority,
        owner: status === 'blocked' ? resolveOwner(i) : null,
      }));

  return { counts, total: issues.length, blocked: pick('blocked'), inProgress: pick('in_progress'), todo: pick('todo') };
}

// ------------------------------------------------------------- rendering

function renderModules(modules) {
  const order = { built: 0, stubbed: 1, 'spec-only': 2 };
  const rows = [...modules].sort(
    (a, b) => order[a.state] - order[b.state] || a.name.localeCompare(b.name),
  );
  const tally = rows.reduce((acc, m) => ({ ...acc, [m.state]: (acc[m.state] ?? 0) + 1 }), {});

  const lines = [
    '### 1. Backend module build state',
    '',
    `\`backend/src/modules/*\` — **${rows.length} modules: ${tally.built ?? 0} built, ` +
      `${tally.stubbed ?? 0} stubbed, ${tally['spec-only'] ?? 0} spec-only.**`,
    '',
    'State is decided by what the directory actually contains (service + routes + controller),',
    'not by whether a spec or a board issue says the module is done.',
    '',
    '| Module | State | Evidence (code on disk) | Tests | Purpose (module.json) |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const m of rows) {
    const badge = { built: '✅ built', stubbed: '🟡 stubbed', 'spec-only': '📄 spec-only' }[m.state];
    const tests = m.tests === 0 ? '**0**' : String(m.tests);
    lines.push(`| \`${md(m.name)}\` | ${badge} | ${md(m.detail)} | ${tests} | ${md(m.purpose)} |`);
  }

  const untested = rows.filter((m) => m.state === 'built' && m.tests === 0);
  if (untested.length > 0) {
    lines.push(
      '',
      `> ⚠ **${untested.length} built module(s) have no test file** in \`backend/src/modules/<name>/\` ` +
        `or \`backend/tests/\` matched by name: ${untested.map((m) => `\`${m.name}\``).join(', ')}. ` +
        'Built ≠ verified — a name-based scan can also miss suites filed elsewhere, so check before acting.',
    );
  }
  return lines.join('\n');
}

function renderDrivers(drivers) {
  const lines = ['### 2. Template-engine 9-stage driver reality', ''];
  if (drivers.error) {
    lines.push(`> ⚠ **Could not derive the driver table:** ${md(drivers.error)}`);
    return lines.join('\n');
  }

  const real = drivers.stages.filter((s) => s.status === 'REAL').length;
  const notBuilt = drivers.stages.filter((s) => s.status === 'UPSTREAM_NOT_BUILT').length;
  const noDownstream = drivers.stages.filter((s) => s.status === 'NO_DOWNSTREAM').length;

  lines.push(
    `Parsed from \`backend/src/modules/template-engine/drivers/index.js\` — from the driver ` +
      `bodies, **not** the file's header comment (which has gone stale before: KDL-521).`,
    '',
    `**${real}/${drivers.stages.length} stages real, ${notBuilt} UPSTREAM_NOT_BUILT` +
      (noDownstream ? `, ${noDownstream} silent no-op` : '') + '.**',
    '',
    '| # | Stage | Status | Derived from |',
    '| --- | --- | --- | --- |',
  );
  drivers.stages.forEach((s, i) => {
    const badge = {
      REAL: '✅ REAL',
      UPSTREAM_NOT_BUILT: '⛔ UPSTREAM_NOT_BUILT',
      NO_DOWNSTREAM: '⚠ NO_DOWNSTREAM',
      UNPARSEABLE: '❓ UNPARSEABLE',
    }[s.status];
    lines.push(`| ${i + 1} | \`${md(s.stage)}\` | ${badge} | ${md(s.evidence)} |`);
  });

  if (noDownstream > 0) {
    lines.push(
      '',
      '> ⚠ **NO_DOWNSTREAM** means the driver resolves successfully without calling its upstream',
      '> module. The DAG goes green while nothing is produced — worse than an honest 503, because',
      '> it reads as done. Only `preflight` and `export` are allowed to make no downstream call.',
    );
  }
  return lines.join('\n');
}

function renderPrs(prs) {
  const lines = ['### 3. Pull requests — true merge state', ''];
  if (prs.error) {
    lines.push(`> ⚠ **PR data unavailable:** ${md(prs.error)}. Treat this section as UNKNOWN, not empty.`);
    return lines.join('\n');
  }

  lines.push(`**${prs.open.length} open PR(s).**`, '');
  if (prs.open.length === 0) {
    lines.push('_No open PRs._');
  } else {
    lines.push('| PR | Title | Branch | CI / merge state | Review |', '| --- | --- | --- | --- | --- |');
    for (const p of prs.open) {
      const state = [p.isDraft ? 'DRAFT' : null, p.mergeStateStatus, p.mergeable === 'CONFLICTING' ? 'CONFLICTING' : null]
        .filter(Boolean)
        .join(' · ');
      lines.push(
        `| [#${p.number}](https://github.com/F9info/kdl-os/pull/${p.number}) | ${md(p.title)} | ` +
          `\`${md(p.headRefName)}\` | ${md(state)} | ${md(p.reviewDecision || 'none')} |`,
      );
    }
  }

  lines.push('', '#### Ghost merges — CLOSED on GitHub, but the code IS on master', '');
  if (prs.ghostError) {
    lines.push(`> ⚠ Closed-PR scan failed: ${md(prs.ghostError)}.`);
  } else if (prs.ghosts.length === 0) {
    lines.push(`_None found in the last ${prs.closedScanned} closed PRs._`);
  } else {
    lines.push(
      `**${prs.ghosts.length} of the last ${prs.closedScanned} closed PRs actually shipped.** This is the`,
      'KDL-520 defect: pushing straight to master makes GitHub close the PR instead of merging it,',
      'so PR history under-reports what was delivered. Do not read these as abandoned work.',
      '',
      '| PR | Title | Evidence it landed |',
      '| --- | --- | --- |',
    );
    for (const g of prs.ghosts) {
      lines.push(
        `| [#${g.number}](https://github.com/F9info/kdl-os/pull/${g.number}) | ${md(g.title)} | ` +
          `${md(g.evidence.join('; '))} |`,
      );
    }
  }
  lines.push(
    '',
    `_Scan window: the ${prs.closedScanLimit} most recent closed PRs. Older ghost merges are not covered._`,
  );
  return lines.join('\n');
}

function renderBlocked(board) {
  const lines = ['### 4. Board state — blocked and in-flight', ''];
  if (board.error) {
    lines.push(`> ⚠ **Board data unavailable:** ${md(board.error)}. Treat this section as UNKNOWN, not empty.`);
    return lines.join('\n');
  }

  const c = board.counts;
  lines.push(
    `**${board.total} issues total: ${c.done ?? 0} done, ${c.in_progress ?? 0} in progress, ` +
      `${c.blocked ?? 0} blocked, ${c.todo ?? 0} todo, ${c.cancelled ?? 0} cancelled.**`,
    '',
    '#### Blocked — every row needs a named unblock owner',
    '',
  );

  if (board.blocked.length === 0) {
    lines.push('_Nothing blocked._');
  } else {
    lines.push(
      '| Issue | Title | Unblock owner | Unblock action | Owner source |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const i of board.blocked) {
      const owner = i.owner?.owner ?? '**⚠ UNASSIGNED**';
      const action =
        i.owner?.action ??
        `set \`unblockDescriptor\` on the board, or add ${i.identifier} to \`.agents/unblock-owners.json\``;
      lines.push(
        `| ${md(i.identifier)} | ${md(i.title)} | ${md(owner)} | ${md(action)} | ${i.owner?.source ?? '—'} |`,
      );
    }
    const orphans = board.blocked.filter((i) => !i.owner);
    if (orphans.length > 0) {
      lines.push(
        '',
        `> ⚠ ${orphans.length} blocked issue(s) have no named unblock owner: ` +
          `${orphans.map((o) => o.identifier).join(', ')}. A blocked issue without an owner never moves.`,
      );
    }
  }

  lines.push('', '#### In progress', '');
  if (board.inProgress.length === 0) {
    lines.push('_Nothing in progress._');
  } else {
    lines.push('| Issue | Title |', '| --- | --- |');
    for (const i of board.inProgress) lines.push(`| ${md(i.identifier)} | ${md(i.title)} |`);
  }

  if (board.todo.length > 0) {
    lines.push('', '#### Queued (todo)', '', '| Issue | Title |', '| --- | --- |');
    for (const i of board.todo) lines.push(`| ${md(i.identifier)} | ${md(i.title)} |`);
  }
  return lines.join('\n');
}

// ------------------------------------------------------------------ main

const generatedAt =
  process.env.STATUS_ROLLUP_DATE ||
  (trySh('git', ['log', '-1', '--format=%cI']).out || '').trim().slice(0, 10) ||
  'unknown';
const headSha = (trySh('git', ['rev-parse', '--short', 'HEAD']).out || 'unknown').trim();

const modules = collectModules();
const drivers = collectDrivers();
const prs = collectPrs();
const board = await collectBlocked();

const block = [
  BEGIN,
  '',
  '# STATUS — what is done, what is pending',
  '',
  `_Derived from code + GitHub + the board at master \`${headSha}\` (latest commit ${generatedAt})._`,
  `_Regenerate: \`node scripts/status-rollup.mjs\`. Hand edits to this block are overwritten._`,
  '',
  'Read this instead of counting board issues or PRs — both mislead. The board has 500+ done',
  'issues with no aggregate view, and PR state under-reports what shipped (§3).',
  '',
  renderModules(modules),
  '',
  renderDrivers(drivers),
  '',
  renderPrs(prs),
  '',
  renderBlocked(board),
  '',
  '---',
  '',
  'Related: [`docs/ADMIN_ACCESS.md`](docs/ADMIN_ACCESS.md) — admin login / lockout recovery.',
  'Recent per-issue detail is in the rolling changelog below; full history in',
  '[`.agents/STATUS_ARCHIVE.md`](.agents/STATUS_ARCHIVE.md).',
  '',
  END,
].join('\n');

if (args.has('--stdout')) {
  process.stdout.write(`${block}\n`);
  process.exit(0);
}

const existing = existsSync(STATUS_FILE) ? readFileSync(STATUS_FILE, 'utf8') : '';
const bi = existing.indexOf(BEGIN);
const ei = existing.indexOf(END);

let next;
if (bi >= 0 && ei > bi) {
  next = existing.slice(0, bi) + block + existing.slice(ei + END.length);
} else {
  // First run: install the block above whatever is already there.
  next = `${block}\n\n## Rolling changelog\n\n${existing.trimStart()}`;
}

if (args.has('--check')) {
  if (next !== existing) {
    console.error('STATUS.md is stale — run `node scripts/status-rollup.mjs`.');
    process.exit(1);
  }
  console.log('STATUS.md rollup is up to date.');
  process.exit(0);
}

writeFileSync(STATUS_FILE, next);
console.log(`Wrote rollup to ${relative(REPO_ROOT, STATUS_FILE)} (master ${headSha}).`);
for (const [label, section] of [['drivers', drivers], ['PRs', prs], ['board', board]]) {
  if (section?.error) console.warn(`  ⚠ ${label} section degraded: ${section.error}`);
}
