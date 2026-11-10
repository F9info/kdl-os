import { prisma } from '../../config/database.js';
import { getDriver, isManualProvider } from './drivers/index.js';
import { httpError, notFound, listResult, recordEvent } from './util.js';

// Imported lazily: shared/utils/crypto.js throws at load if APP_ENCRYPTION_KEY is missing, and
// membership (like every module) must be able to load and list without it.
const crypto = () => import('../../shared/utils/crypto.js');

const include = { plans: true };

export function sanitize(p) {
  if (!p) return p;
  const { credentials_enc, webhook_secret_enc, plans, ...rest } = p;
  return { ...rest, has_credentials: !!credentials_enc, has_webhook_secret: !!webhook_secret_enc, plan_ids: (plans ?? []).map((x) => x.plan_id) };
}

export async function credentialsOf(provider) {
  if (!provider?.credentials_enc) return {};
  return JSON.parse((await crypto()).decrypt(provider.credentials_enc));
}
export async function webhookSecretOf(provider) {
  return provider?.webhook_secret_enc ? (await crypto()).decrypt(provider.webhook_secret_enc) : '';
}

const find = async (id, db = prisma) => {
  const p = await db.membershipPaymentProvider.findUnique({ where: { id }, include });
  if (!p) throw notFound('Payment provider');
  return p;
};

export async function listProviders(q = {}) {
  const where = {
    ...(q.status ? { status: q.status } : { status: { not: 'ARCHIVED' } }),
    ...(q.q ? { label: { contains: q.q, mode: 'insensitive' } } : {}),
  };
  const r = await listResult({ ...q, limit: q.limit ?? 100 }, (p) => prisma.membershipPaymentProvider.findMany({ where, include, orderBy: [{ sort: 'asc' }, { created_at: 'asc' }], ...p }), () => prisma.membershipPaymentProvider.count({ where }));
  return { ...r, items: r.items.map(sanitize) };
}

export const getProvider = async (id) => sanitize(await find(id));

async function secretsPatch(body, existing) {
  const out = {};
  if (body.credentials) {
    const merged = { ...(await credentialsOf(existing)), ...body.credentials };
    out.credentials_enc = (await crypto()).encrypt(JSON.stringify(merged));
    out.last_test_ok = null;
    out.last_test_at = null;
  }
  if (body.webhook_secret) out.webhook_secret_enc = (await crypto()).encrypt(body.webhook_secret);
  return out;
}

const scalar = ({ credentials, webhook_secret, plan_ids, ...rest }) => rest;

async function setPlans(tx, providerId, planIds) {
  await tx.membershipPaymentProviderPlan.deleteMany({ where: { provider_id: providerId } });
  if (planIds.length) await tx.membershipPaymentProviderPlan.createMany({ data: planIds.map((plan_id) => ({ provider_id: providerId, plan_id })) });
}

export async function createProvider(body, actor) {
  // Any gateway may be added as a DRAFT; its driver is only needed to test, publish and take money.
  const type = body.type ?? (isManualProvider(body.provider) ? 'MANUAL' : 'GATEWAY');
  const secrets = await secretsPatch(body, null);
  const row = await prisma.$transaction(async (tx) => {
    if (body.is_default) await tx.membershipPaymentProvider.updateMany({ data: { is_default: false } });
    const sort = body.sort ?? (await tx.membershipPaymentProvider.count());
    const p = await tx.membershipPaymentProvider.create({ data: { ...scalar(body), type, sort, ...secrets } });
    if (body.plan_ids) await setPlans(tx, p.id, body.plan_ids);
    await recordEvent(tx, { key: 'provider.created', actor, data: { provider_id: p.id, provider: p.provider }, description: `Payment provider ${p.label} created` });
    return p;
  });
  return getProvider(row.id);
}

export async function updateProvider(id, body, actor) {
  const existing = await find(id);
  if (existing.status === 'ARCHIVED') throw httpError(409, 'Archived providers cannot be edited');
  const secrets = await secretsPatch(body, existing);
  await prisma.$transaction(async (tx) => {
    if (body.is_default) await tx.membershipPaymentProvider.updateMany({ where: { id: { not: id } }, data: { is_default: false } });
    const { provider: _drop, ...data } = scalar(body); // the gateway of a provider cannot change
    await tx.membershipPaymentProvider.update({ where: { id }, data: { ...data, ...secrets } });
    if (body.plan_ids) await setPlans(tx, id, body.plan_ids);
    await recordEvent(tx, { key: 'provider.updated', actor, data: { provider_id: id, fields: Object.keys(body).filter((k) => k !== 'credentials' && k !== 'webhook_secret') }, description: `Payment provider ${existing.label} updated` });
  });
  return getProvider(id);
}

export async function removeProvider(id, actor) {
  const p = await find(id);
  const used = await prisma.membershipPayment.count({ where: { provider_id: id } });
  if (used > 0) {
    await prisma.membershipPaymentProvider.update({ where: { id }, data: { status: 'ARCHIVED', is_default: false } });
    await recordEvent(prisma, { key: 'provider.archived', actor, data: { provider_id: id }, description: `Payment provider ${p.label} archived (has payments)` });
    return { deleted: false, archived: true };
  }
  await prisma.membershipPaymentProvider.delete({ where: { id } });
  await recordEvent(prisma, { key: 'provider.deleted', actor, data: { provider_id: id }, description: `Payment provider ${p.label} deleted` });
  return { deleted: true, archived: false };
}

export async function testProvider(id, actor) {
  const p = await find(id);
  const result = await getDriver(p.provider).test(await credentialsOf(p));
  await prisma.membershipPaymentProvider.update({ where: { id }, data: { last_test_at: new Date(), last_test_ok: result.ok } });
  await recordEvent(prisma, { key: 'provider.tested', actor, data: { provider_id: id, ok: result.ok }, description: `Payment provider ${p.label} tested` });
  return result;
}

export async function setProviderStatus(id, action, actor) {
  const p = await find(id);
  const status = { publish: 'PUBLISHED', hide: 'HIDDEN', archive: 'ARCHIVED' }[action];
  if (action === 'publish') {
    if (p.type === 'GATEWAY') {
      getDriver(p.provider); // an unbuilt gateway cannot go live
      if (!p.credentials_enc) throw httpError(422, 'Save the API keys before publishing');
      if (!p.last_test_ok) throw httpError(422, 'Run a successful connection test before publishing');
    }
  }
  await prisma.membershipPaymentProvider.update({ where: { id }, data: { status, ...(status === 'ARCHIVED' ? { is_default: false } : {}) } });
  await recordEvent(prisma, { key: `provider.${action}`, actor, data: { provider_id: id }, description: `Payment provider ${p.label}: ${action}` });
  return getProvider(id);
}

export async function reorderProviders(ids, actor) {
  await prisma.$transaction(ids.map((id, i) => prisma.membershipPaymentProvider.update({ where: { id }, data: { sort: i } })));
  await recordEvent(prisma, { key: 'provider.reordered', actor, data: { ids }, description: 'Payment providers reordered' });
  return listProviders({});
}
