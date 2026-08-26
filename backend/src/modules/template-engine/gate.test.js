/**
 * Gate tests — every transition in TEMPLATE_ENGINE_ARCH.md §3 (Depends on column).
 * Covers: satisfied gate (ok), unsatisfied gate (reason surfaced), and all 9 stages.
 */
import { describe, it, expect, vi } from 'vitest';

// Hoist mocks before any imports so service.js can load without a real DB/drivers.
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('./drivers/index.js', () => ({ getDriver: vi.fn() }));
import { checkGate } from './service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stageOf(stage, status) {
  return { stage, status };
}

function stages(...pairs) {
  return pairs.map(([stage, status]) => stageOf(stage, status));
}

const DONE    = 'DONE';
const PENDING = 'PENDING';
const FAILED  = 'FAILED';
const SKIPPED = 'SKIPPED';

// ── Stage 1: intake (no dependencies) ────────────────────────────────────────

describe('intake', () => {
  it('ok with no prior stages', () => {
    expect(checkGate('intake', [])).toMatchObject({ ok: true });
  });

  it('ok even if all other stages are PENDING', () => {
    const s = stages(['PALETTE', PENDING], ['INFERENCE', PENDING]);
    expect(checkGate('intake', s)).toMatchObject({ ok: true });
  });
});

// ── Stage 2: palette — depends on intake DONE ─────────────────────────────────

describe('palette', () => {
  it('ok when intake is DONE', () => {
    expect(checkGate('palette', stages(['INTAKE', DONE]))).toMatchObject({ ok: true });
  });

  it('fails when intake is PENDING', () => {
    const result = checkGate('palette', stages(['INTAKE', PENDING]));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('intake');
  });

  it('fails when intake is FAILED', () => {
    const result = checkGate('palette', stages(['INTAKE', FAILED]));
    expect(result.ok).toBe(false);
  });

  it('fails when intake stage is absent', () => {
    expect(checkGate('palette', [])).toMatchObject({ ok: false });
  });
});

// ── Stage 3: inference — depends on palette DONE ──────────────────────────────

describe('inference', () => {
  it('ok when palette is DONE', () => {
    const s = stages(['INTAKE', DONE], ['PALETTE', DONE]);
    expect(checkGate('inference', s)).toMatchObject({ ok: true });
  });

  it('fails when palette is not DONE', () => {
    const result = checkGate('inference', stages(['INTAKE', DONE], ['PALETTE', PENDING]));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('palette');
  });
});

// ── Stage 4: approval — depends on inference DONE ─────────────────────────────

describe('approval', () => {
  it('ok when inference is DONE', () => {
    const s = stages(['INTAKE', DONE], ['PALETTE', DONE], ['INFERENCE', DONE]);
    expect(checkGate('approval', s)).toMatchObject({ ok: true });
  });

  it('fails when inference is not DONE', () => {
    const result = checkGate('approval', stages(['INTAKE', DONE], ['PALETTE', DONE], ['INFERENCE', PENDING]));
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('inference');
  });
});

// ── Stages 5/6/7 — all depend on approval DONE ────────────────────────────────

for (const stage of ['guidelines', 'collateral', 'website']) {
  describe(stage, () => {
    it(`ok when approval is DONE`, () => {
      const s = stages(['INTAKE', DONE], ['PALETTE', DONE], ['INFERENCE', DONE], ['APPROVAL', DONE]);
      expect(checkGate(stage, s)).toMatchObject({ ok: true });
    });

    it(`fails when approval is PENDING`, () => {
      const result = checkGate(stage, stages(['INTAKE', DONE], ['PALETTE', DONE], ['INFERENCE', DONE], ['APPROVAL', PENDING]));
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('approval');
    });

    it(`fails when approval is absent`, () => {
      expect(checkGate(stage, [])).toMatchObject({ ok: false });
    });
  });
}

// ── Stage 8: preflight — 5/6/7 must all be terminal (DONE or SKIPPED) ─────────

describe('preflight', () => {
  function approvedThrough() {
    return stages(
      ['INTAKE', DONE], ['PALETTE', DONE], ['INFERENCE', DONE], ['APPROVAL', DONE]
    );
  }

  it('ok when guidelines, collateral, and website are all DONE', () => {
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', DONE), stageOf('COLLATERAL', DONE), stageOf('WEBSITE', DONE),
    ];
    expect(checkGate('preflight', s)).toMatchObject({ ok: true });
  });

  it('ok when all three fan-out stages are SKIPPED', () => {
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', SKIPPED), stageOf('COLLATERAL', SKIPPED), stageOf('WEBSITE', SKIPPED),
    ];
    expect(checkGate('preflight', s)).toMatchObject({ ok: true });
  });

  it('ok when some are DONE and some SKIPPED (mixed terminal)', () => {
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', DONE), stageOf('COLLATERAL', SKIPPED), stageOf('WEBSITE', DONE),
    ];
    expect(checkGate('preflight', s)).toMatchObject({ ok: true });
  });

  it('fails when guidelines is still PENDING', () => {
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', PENDING), stageOf('COLLATERAL', DONE), stageOf('WEBSITE', DONE),
    ];
    const result = checkGate('preflight', s);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('guidelines');
  });

  it('fails when collateral is RUNNING (not terminal)', () => {
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', DONE), stageOf('COLLATERAL', 'RUNNING'), stageOf('WEBSITE', DONE),
    ];
    expect(checkGate('preflight', s)).toMatchObject({ ok: false });
  });

  it('fails when website is FAILED (not terminal)', () => {
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', DONE), stageOf('COLLATERAL', DONE), stageOf('WEBSITE', FAILED),
    ];
    expect(checkGate('preflight', s)).toMatchObject({ ok: false });
  });

  // One branch failing must NOT fail siblings — each is checked independently.
  it('treats each fan-out branch independently', () => {
    // collateral FAILED is not terminal → preflight blocked
    // but guidelines and website being DONE is irrelevant to COLLATERAL's check
    const s = [
      ...approvedThrough(),
      stageOf('GUIDELINES', DONE), stageOf('COLLATERAL', FAILED), stageOf('WEBSITE', DONE),
    ];
    const result = checkGate('preflight', s);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('collateral');
    // reason should be about collateral, not guidelines or website
    expect(result.reason).not.toContain('guidelines');
    expect(result.reason).not.toContain('website');
  });
});

// ── Stage 9: export — depends on preflight DONE ────────────────────────────────

describe('export', () => {
  it('ok when preflight is DONE', () => {
    const s = stages(['PREFLIGHT', DONE]);
    expect(checkGate('export', s)).toMatchObject({ ok: true });
  });

  it('fails when preflight is SKIPPED (must be DONE, not just terminal)', () => {
    const s = stages(['PREFLIGHT', SKIPPED]);
    expect(checkGate('export', s)).toMatchObject({ ok: false });
  });

  it('fails when preflight is absent', () => {
    expect(checkGate('export', [])).toMatchObject({ ok: false });
  });
});

// ── Unknown stage ──────────────────────────────────────────────────────────────

describe('unknown stage', () => {
  it('returns not-ok for an unrecognised stage slug', () => {
    const result = checkGate('nonexistent', []);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Unknown stage');
  });
});
