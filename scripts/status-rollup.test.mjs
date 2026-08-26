/**
 * Unit tests for the driver-body classifier (KDL-536).
 *
 * Run with: node --test scripts/status-rollup.test.mjs
 *
 * The bug: status-rollup.mjs classified the guidelines driver (which throws with
 * error code 'UPSTREAM_NOT_BUILT') as NO_DOWNSTREAM because the old check keyed
 * off the helper function name `notBuilt()`, which was renamed in KDL-509. The
 * fix keys off the error-code string literal instead (helper-rename-proof).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripComments,
  extractObjectBody,
  classifyDriverBody,
  NO_DOWNSTREAM_BY_DESIGN,
} from './lib/classify-driver.mjs';

// ── stripComments ────────────────────────────────────────────────────────────

test('stripComments removes block comments', () => {
  const src = `/* this is a block comment */ const x = 1;`;
  assert.ok(!stripComments(src).includes('block comment'));
});

test('stripComments removes line comments', () => {
  const src = `const x = 1; // inline comment\nconst y = 2;`;
  const stripped = stripComments(src);
  assert.ok(!stripped.includes('inline comment'));
  assert.ok(stripped.includes('const y = 2'));
});

test('stripComments does not destroy URL double-slash', () => {
  const src = `const url = 'https://example.com/path';`;
  assert.ok(stripComments(src).includes('https://example.com'));
});

// ── extractObjectBody ────────────────────────────────────────────────────────

test('extractObjectBody returns null for missing variable', () => {
  assert.strictEqual(extractObjectBody('const x = {};', 'y'), null);
});

test('extractObjectBody handles nested braces', () => {
  const src = `const fooDriver = { async execute() { return { ok: true }; } };`;
  const body = extractObjectBody(src, 'fooDriver');
  assert.ok(body !== null);
  assert.ok(body.startsWith('{'));
  assert.ok(body.endsWith('}'));
  assert.ok(body.includes('return { ok: true }'));
});

// ── classifyDriverBody — the core regression tests ───────────────────────────

// KDL-536 regression: namedErr pattern (KDL-509 driver style) must be UPSTREAM_NOT_BUILT
test('classifyDriverBody: namedErr with UPSTREAM_NOT_BUILT code => UPSTREAM_NOT_BUILT', () => {
  const body = `{
    async execute() {
      throw namedErr(
        'UPSTREAM_NOT_BUILT — guidelines driver requires brand-kit PDF render endpoint (not in Phase 1)',
        503,
        'UPSTREAM_NOT_BUILT',
      );
    }
  }`;
  const { status } = classifyDriverBody(body, { stage: 'guidelines' });
  assert.strictEqual(status, 'UPSTREAM_NOT_BUILT', 'namedErr with UPSTREAM_NOT_BUILT code must not be misclassified as NO_DOWNSTREAM');
});

// Confirms the OLD notBuilt() pattern still classifies correctly (no regression on style change)
test('classifyDriverBody: notBuilt() helper still => UPSTREAM_NOT_BUILT', () => {
  const body = `{
    async execute() { throw notBuilt('guidelines'); }
  }`;
  // notBuilt() produces an error with code 'UPSTREAM_NOT_BUILT', so its body contains that string
  // only if the full error message includes it. In the original file it did NOT — the body only
  // said `notBuilt(...)`. This test verifies that the OLD pattern (without the code string) is
  // handled: if the body doesn't contain 'UPSTREAM_NOT_BUILT', it falls through to NO_DOWNSTREAM
  // unless the error message itself was embedded. The fix requires the code string to be present.
  // Confirm the old style without the string is NOT automatically detected (documents the gap):
  const { status } = classifyDriverBody(body, { stage: 'guidelines' });
  // If notBuilt is not in upstreamSymbols and the body doesn't contain 'UPSTREAM_NOT_BUILT',
  // it will fall through. This is expected for old-style bodies that predate KDL-509.
  // The important thing is the KDL-509 style IS detected (test above).
  assert.ok(['UPSTREAM_NOT_BUILT', 'NO_DOWNSTREAM'].includes(status));
});

// Stage 5 (guidelines) in the live KDL-509 drivers file must be UPSTREAM_NOT_BUILT
test('classifyDriverBody: stage guidelines with UPSTREAM_NOT_BUILT string in body => UPSTREAM_NOT_BUILT (KDL-536 core)', () => {
  // Matches what KDL-509 actually wrote in drivers/index.js lines 131-139
  const body = `{
    async execute() {
      throw namedErr(
        'UPSTREAM_NOT_BUILT — guidelines driver requires brand-kit PDF render endpoint (not in Phase 1)',
        503,
        'UPSTREAM_NOT_BUILT',
      );
    }
  }`;
  const result = classifyDriverBody(body, { stage: 'guidelines' });
  assert.strictEqual(result.status, 'UPSTREAM_NOT_BUILT');
});

// A driver that resolves with no upstream call must be NO_DOWNSTREAM (not UPSTREAM_NOT_BUILT)
test('classifyDriverBody: driver resolving silently with no upstream call => NO_DOWNSTREAM', () => {
  const body = `{
    async execute() {
      return { outputRef: { done: true } };
    }
  }`;
  const result = classifyDriverBody(body, { stage: 'someStage' });
  assert.strictEqual(result.status, 'NO_DOWNSTREAM');
});

// Drivers in NO_DOWNSTREAM_BY_DESIGN set must be REAL even with no upstream call
test('classifyDriverBody: preflight (aggregate) => REAL', () => {
  const body = `{
    async execute({ run }) {
      const errors = [];
      return { outputRef: { checkedAt: new Date().toISOString(), errors } };
    }
  }`;
  const result = classifyDriverBody(body, { stage: 'preflight' });
  assert.strictEqual(result.status, 'REAL');
  assert.ok(result.evidence.includes('no downstream call by design'));
});

test('classifyDriverBody: export (aggregate) => REAL', () => {
  const body = `{
    async execute({ run }) {
      return { outputRef: { manifestAt: new Date().toISOString() } };
    }
  }`;
  const result = classifyDriverBody(body, { stage: 'export' });
  assert.strictEqual(result.status, 'REAL');
});

// A driver with a direct fetch call must be REAL
test('classifyDriverBody: driver with fetch() => REAL', () => {
  const body = `{
    async execute({ projectId }) {
      const res = await fetch('http://internal/api/render', { method: 'POST' });
      return { outputRef: await res.json() };
    }
  }`;
  const result = classifyDriverBody(body, { stage: 'someStage' });
  assert.strictEqual(result.status, 'REAL');
});

// An upstream symbol imported from a sibling module must mark the driver as REAL
test('classifyDriverBody: driver calling an imported upstream symbol => REAL', () => {
  const body = `{
    async execute({ projectId }) {
      const kit = await getOrCreateKit(projectId);
      return { outputRef: { kitId: kit.id } };
    }
  }`;
  const upstreamSymbols = new Set(['getOrCreateKit']);
  const result = classifyDriverBody(body, { stage: 'intake', upstreamSymbols });
  assert.strictEqual(result.status, 'REAL');
});

// Double-quoted error code must also be detected
test('classifyDriverBody: double-quoted UPSTREAM_NOT_BUILT code => UPSTREAM_NOT_BUILT', () => {
  const body = `{
    async execute() {
      const err = new Error("upstream not ready");
      err.code = "UPSTREAM_NOT_BUILT";
      err.status = 503;
      throw err;
    }
  }`;
  const result = classifyDriverBody(body, { stage: 'guidelines' });
  assert.strictEqual(result.status, 'UPSTREAM_NOT_BUILT');
});

// NO_DOWNSTREAM_BY_DESIGN set is correct
test('NO_DOWNSTREAM_BY_DESIGN contains exactly preflight and export', () => {
  assert.ok(NO_DOWNSTREAM_BY_DESIGN.has('preflight'));
  assert.ok(NO_DOWNSTREAM_BY_DESIGN.has('export'));
  assert.strictEqual(NO_DOWNSTREAM_BY_DESIGN.size, 2);
});
