import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { logger } from '../../shared/utils/logger.js';

const WHITELISTED_METADATA_KEYS = new Set([
  'held_mc', 'actual_mc', 'provider', 'model', 'inputTokens', 'outputTokens', 'costUsd',
  'external_ref', 'corrects', 'hold_id', 'late_settlement',
]);

function scrubMetadata(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (WHITELISTED_METADATA_KEYS.has(k)) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export class CreditError extends Error {
  constructor(code, message) {
    super(message ?? code);
    this.name = 'CreditError';
    this.code = code;
    if (code === 'INSUFFICIENT_CREDITS') this.status = 402;
  }
}

async function getAppSetting(key, defaultValue) {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

// Converts USD to µc (1 credit = 1,000,000 µc). Half-up rounding; min 1 µc for non-zero.
export function usdToMc(usd) {
  if (usd === null || usd === undefined || usd === '') return 0n;
  const str = String(usd).trim();
  if (!str || str === '0') return 0n;

  const [intPart = '0', fracPart = ''] = str.split('.');
  const frac6 = fracPart.padEnd(6, '0').slice(0, 6);
  const rawMc = BigInt(intPart) * 1_000_000n + BigInt(frac6);
  return rawMc > 0n ? rawMc : 1n;
}

// Reaps expired PENDING holds inside an open transaction, returning the updated balance.
// Inserts EXPIRE ledger entries with correct balance_after_mc (no placeholder update needed).
async function reapExpiredHolds(tx, projectId, runningBalance, now) {
  const expired = await tx.creditHold.findMany({
    where: { project_id: projectId, status: 'PENDING', expires_at: { lt: now } },
    orderBy: { created_at: 'asc' },
  });
  if (!expired.length) return runningBalance;

  let balance = runningBalance;
  for (const hold of expired) {
    balance += hold.amount_mc;
    await tx.creditLedgerEntry.create({
      data: {
        project_id: projectId,
        entry_type: 'EXPIRE',
        amount_mc: hold.amount_mc,
        balance_after_mc: balance,
        hold_id: hold.id,
        source: hold.source,
        reason: 'reap_on_touch',
      },
    });
    await tx.creditHold.update({
      where: { id: hold.id },
      data: { status: 'EXPIRED', resolved_at: now },
    });
  }
  return balance;
}

// Core locked mutation (CREDITS_ARCH §4 — READ COMMITTED, one balance row per project).
// fn(tx, currentBalance, now) => { entries, holdMutation?, requiredBalance?, extra? }
// Returns { inserted, balanceAfterMc, extra }.
async function applyEntries(projectId, fn) {
  return prisma.$transaction(
    async (tx) => {
      const now = new Date();

      const rows = await tx.$queryRaw`
        SELECT id, balance_mc FROM credit_balances WHERE project_id = ${projectId} FOR UPDATE
      `;

      let runningBalance = rows[0] ? BigInt(rows[0].balance_mc) : 0n;
      const hasBalanceRow = rows.length > 0;

      runningBalance = await reapExpiredHolds(tx, projectId, runningBalance, now);

      const { entries, holdMutation, requiredBalance, extra } = await fn(tx, runningBalance, now);

      if (requiredBalance !== undefined && runningBalance < requiredBalance) {
        throw new CreditError(
          'INSUFFICIENT_CREDITS',
          `Insufficient credits: have ${runningBalance} µc, need ${requiredBalance} µc`,
        );
      }

      const inserted = [];
      for (const e of entries) {
        runningBalance += e.amountMc;
        const row = await tx.creditLedgerEntry.create({
          data: {
            project_id: projectId,
            entry_type: e.type,
            amount_mc: e.amountMc,
            balance_after_mc: runningBalance,
            hold_id: e.holdId ?? null,
            source: e.source,
            reason: e.reason ?? null,
            idempotency_key: e.idempotencyKey ?? null,
            actor_id: e.actorId ?? null,
            metadata: scrubMetadata(e.metadata),
          },
        });
        inserted.push(row);
      }

      if (entries.length > 0) {
        if (hasBalanceRow) {
          await tx.creditBalance.update({
            where: { project_id: projectId },
            data: { balance_mc: runningBalance },
          });
        } else {
          await tx.creditBalance.upsert({
            where: { project_id: projectId },
            create: { project_id: projectId, balance_mc: runningBalance },
            update: { balance_mc: runningBalance },
          });
        }
      }

      if (holdMutation) {
        await tx.creditHold.update({
          where: { id: holdMutation.id },
          data: {
            status: holdMutation.status,
            resolved_at: holdMutation.resolved_at ?? null,
          },
        });
      }

      return { inserted, balanceAfterMc: runningBalance, extra: extra ?? {} };
    },
    { isolationLevel: 'ReadCommitted' },
  );
}

// --- Public API ---

export async function grantCredits({ projectId, amountMc, source, actorId, reason, metadata, idempotencyKey }) {
  if (amountMc <= 0n) throw new CreditError('INVALID_AMOUNT', 'grant amount must be > 0 µc');

  const { inserted, balanceAfterMc } = await applyEntries(projectId, async () => ({
    entries: [{ type: 'GRANT', amountMc, source, reason, idempotencyKey, actorId, metadata }],
  }));

  writeActivityAsync({
    actor: actorId ?? null,
    module: 'credits',
    action: 'grant',
    subject_type: 'Project',
    subject_id: projectId,
    description: `Granted ${amountMc} µc to project ${projectId}`,
    properties: { amount_mc: String(amountMc), source, reason },
  });

  return { entryId: inserted[0].id, balanceAfterMc };
}

export async function reserveCredits({ projectId, actorId, source, estimateMc, idempotencyKey }) {
  if (estimateMc <= 0n) throw new CreditError('INVALID_AMOUNT', 'estimate must be > 0 µc');

  // Idempotency: return existing hold without debiting again.
  if (idempotencyKey) {
    const existing = await prisma.creditHold.findUnique({ where: { idempotency_key: idempotencyKey } });
    if (existing) {
      return { holdId: existing.id, expiresAt: existing.expires_at, balanceAfterMc: null };
    }
  }

  const ttlSeconds = parseInt(await getAppSetting('credits.hold_ttl_seconds', '900'), 10) || 900;

  const { inserted, balanceAfterMc, extra } = await applyEntries(projectId, async (tx, _balance, now) => {
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const key = idempotencyKey ?? `${projectId}:${source}:${now.getTime()}`;

    const hold = await tx.creditHold.create({
      data: {
        project_id: projectId,
        amount_mc: estimateMc,
        status: 'PENDING',
        source,
        idempotency_key: key,
        expires_at: expiresAt,
        actor_id: actorId ?? null,
      },
    });

    return {
      requiredBalance: estimateMc,
      entries: [{ type: 'RESERVE', amountMc: -estimateMc, holdId: hold.id, source, actorId }],
      extra: { holdId: hold.id, expiresAt },
    };
  });

  return { holdId: extra.holdId, expiresAt: extra.expiresAt, balanceAfterMc };
}

export async function settleHold({ holdId, actualMc, idempotencyKey, usage }) {
  const hold = await prisma.creditHold.findUnique({ where: { id: holdId } });
  if (!hold) throw new CreditError('HOLD_NOT_FOUND', `Hold ${holdId} not found`);

  if (hold.status === 'EXPIRED') {
    // Late settlement: write ADJUST for actual spend (CREDITS_ARCH §3.3).
    const { inserted, balanceAfterMc } = await applyEntries(hold.project_id, async () => ({
      entries: [{
        type: 'ADJUST',
        amountMc: -actualMc,
        holdId,
        source: hold.source,
        reason: 'late_settlement',
        idempotencyKey,
        metadata: { late_settlement: true, hold_id: holdId, ...(usage ? scrubMetadata(usage) : {}) },
      }],
    }));
    return { entryId: inserted[0].id, balanceAfterMc, overage: false };
  }

  if (hold.status !== 'PENDING') {
    // Idempotent guard: already settled or released.
    const entry = await prisma.creditLedgerEntry.findFirst({
      where: { hold_id: holdId, entry_type: { in: ['SETTLE', 'ADJUST'] } },
      orderBy: { created_at: 'desc' },
    });
    const balance = await prisma.creditBalance.findUnique({ where: { project_id: hold.project_id } });
    return { entryId: entry?.id ?? null, balanceAfterMc: balance?.balance_mc ?? 0n, overage: false };
  }

  const refundMc = hold.amount_mc - actualMc;
  const overage = refundMc < 0n;

  const { inserted, balanceAfterMc } = await applyEntries(hold.project_id, async (tx, _balance, now) => ({
    entries: [{
      type: 'SETTLE',
      amountMc: refundMc,
      holdId,
      source: hold.source,
      idempotencyKey,
      metadata: {
        held_mc: String(hold.amount_mc),
        actual_mc: String(actualMc),
        ...(usage ? scrubMetadata(usage) : {}),
      },
    }],
    holdMutation: { id: holdId, status: 'SETTLED', resolved_at: now },
  }));

  if (overage) {
    const maxPct = parseInt(await getAppSetting('credits.max_overage_pct', '25'), 10) || 25;
    const overagePct = Number((-refundMc * 100n) / hold.amount_mc);
    if (overagePct > maxPct) {
      writeActivityAsync({
        module: 'credits',
        action: 'settle_overage',
        subject_type: 'CreditHold',
        subject_id: holdId,
        description: `Overage ${overagePct}% on hold ${holdId}`,
        properties: { hold_id: holdId, held_mc: String(hold.amount_mc), actual_mc: String(actualMc), overage_pct: overagePct },
      });
    }
  }

  return { entryId: inserted[0].id, balanceAfterMc, overage };
}

export async function releaseHold({ holdId, reason }) {
  const hold = await prisma.creditHold.findUnique({ where: { id: holdId } });
  if (!hold) throw new CreditError('HOLD_NOT_FOUND', `Hold ${holdId} not found`);

  if (hold.status !== 'PENDING') {
    const entry = await prisma.creditLedgerEntry.findFirst({ where: { hold_id: holdId, entry_type: 'RELEASE' } });
    const balance = await prisma.creditBalance.findUnique({ where: { project_id: hold.project_id } });
    return { entryId: entry?.id ?? null, balanceAfterMc: balance?.balance_mc ?? 0n };
  }

  const { inserted, balanceAfterMc } = await applyEntries(hold.project_id, async (tx, _balance, now) => ({
    entries: [{ type: 'RELEASE', amountMc: hold.amount_mc, holdId, source: hold.source, reason }],
    holdMutation: { id: holdId, status: 'RELEASED', resolved_at: now },
  }));

  return { entryId: inserted[0].id, balanceAfterMc };
}

export async function adjustCredits({ projectId, amountMc, source, actorId, reason, metadata, idempotencyKey }) {
  if (!reason) throw new CreditError('REASON_REQUIRED', 'ADJUST entries require a reason');
  if (amountMc === 0n) throw new CreditError('INVALID_AMOUNT', 'adjustment amount must be non-zero');

  const { inserted, balanceAfterMc } = await applyEntries(projectId, async () => ({
    entries: [{ type: 'ADJUST', amountMc, source, reason, idempotencyKey, actorId, metadata }],
  }));

  writeActivityAsync({
    actor: actorId ?? null,
    module: 'credits',
    action: 'adjust',
    subject_type: 'Project',
    subject_id: projectId,
    description: `Adjusted ${amountMc} µc on project ${projectId}: ${reason}`,
    properties: { amount_mc: String(amountMc), source, reason },
  });

  return { entryId: inserted[0].id, balanceAfterMc };
}

export async function forceReleaseHold({ holdId, actorId }) {
  const hold = await prisma.creditHold.findUnique({ where: { id: holdId } });
  if (!hold) throw new CreditError('HOLD_NOT_FOUND', `Hold ${holdId} not found`);
  if (hold.status !== 'PENDING') throw new CreditError('HOLD_NOT_PENDING', `Hold ${holdId} is not PENDING`);

  const result = await releaseHold({ holdId, reason: 'admin_force_release' });

  writeActivityAsync({
    actor: actorId ?? null,
    module: 'credits',
    action: 'hold_force_release',
    subject_type: 'CreditHold',
    subject_id: holdId,
    description: `Force-released hold ${holdId} on project ${hold.project_id}`,
    properties: { hold_id: holdId, project_id: hold.project_id, amount_mc: String(hold.amount_mc) },
  });

  return result;
}

export async function getBalance(projectId) {
  // Reap-on-touch: trigger reap by running an applyEntries with no entries if expired holds exist.
  const now = new Date();
  const expiredCount = await prisma.creditHold.count({
    where: { project_id: projectId, status: 'PENDING', expires_at: { lt: now } },
  });
  if (expiredCount > 0) {
    await applyEntries(projectId, async () => ({ entries: [] })).catch((e) =>
      logger.warn('credits: getBalance reap failed', { projectId, error: e.message }),
    );
  }

  const balance = await prisma.creditBalance.findUnique({ where: { project_id: projectId } });
  const openHolds = await prisma.creditHold.findMany({
    where: { project_id: projectId, status: 'PENDING' },
    select: { id: true, amount_mc: true, source: true, expires_at: true, created_at: true },
  });

  return { balance_mc: balance?.balance_mc ?? 0n, open_holds: openHolds };
}

export async function getLedger(projectId, { cursor, limit = 20, entry_type, from, to } = {}) {
  const take = Math.min(Number(limit) || 20, 100);
  const where = { project_id: projectId };
  if (entry_type) where.entry_type = entry_type;
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at.gte = new Date(from);
    if (to) where.created_at.lte = new Date(to);
  }

  const query = { where, orderBy: { created_at: 'desc' }, take: take + 1 };
  if (cursor) { query.cursor = { id: cursor }; query.skip = 1; }

  const rows = await prisma.creditLedgerEntry.findMany(query);
  const hasMore = rows.length > take;
  const entries = hasMore ? rows.slice(0, take) : rows;
  return { entries, next_cursor: hasMore ? entries[entries.length - 1].id : null };
}

export async function getReconciliation(projectId) {
  const balance = await prisma.creditBalance.findUnique({ where: { project_id: projectId } });
  const agg = await prisma.creditLedgerEntry.aggregate({
    where: { project_id: projectId },
    _sum: { amount_mc: true },
  });
  const ledgerSum = agg._sum.amount_mc ?? 0n;
  const materialised = balance?.balance_mc ?? 0n;
  return { project_id: projectId, ledger_sum_mc: ledgerSum, materialised_mc: materialised, match: ledgerSum === materialised };
}

// Convenience wrapper per CREDITS_ARCH §5.
// fn: async () => ({ result, actualMc, usage })
export async function withCreditHold({ projectId, actorId, source, estimateMc, idempotencyKey }, fn) {
  const { holdId } = await reserveCredits({ projectId, actorId, source, estimateMc, idempotencyKey });
  let fnResult;
  try {
    fnResult = await fn();
  } catch (err) {
    await releaseHold({ holdId, reason: err?.message ?? 'fn_threw' }).catch((e) =>
      logger.error('credits: releaseHold failed after fn throw', { holdId, error: e.message }),
    );
    throw err;
  }
  const { result, actualMc, usage } = fnResult;
  await settleHold({ holdId, actualMc, usage });
  return result;
}
