import { createHash } from 'crypto';
import { chroma } from '../config/chroma.js';

// Vector data is tenant-namespaced: one Chroma collection per (base, tenant). The collection name
// is derived from a hash of the tenant id, so an id can never smuggle in another collection's name
// and the name always satisfies Chroma's naming rules. A missing tenant THROWS (fail closed): there
// is deliberately no shared/default collection to fall back to.
export function tenantCollectionName(base, tenantId) {
  if (typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new Error('tenantId is required: vector data is tenant-namespaced');
  }
  return `${base}_${createHash('sha256').update(tenantId).digest('hex').slice(0, 24)}`;
}

const cache = new Map();

export async function getTenantCollection(base, tenantId) {
  const name = tenantCollectionName(base, tenantId);
  if (!cache.has(name)) cache.set(name, await chroma.getOrCreateCollection({ name }));
  return cache.get(name);
}

/**
 * Tenant for a verified JWT payload. Never read from the request body: a client-chosen tenant id
 * would let any caller read another tenant's data. Honour a signed `tenantId` claim (backend-issued),
 * otherwise scope to the individual caller. Returns undefined when there is nothing to scope by.
 */
export function tenantOf(user) {
  if (typeof user?.tenantId === 'string' && user.tenantId.trim()) return user.tenantId;
  const id = user?.userId ?? user?.sub ?? user?.id;
  return id ? `user:${id}` : undefined;
}
