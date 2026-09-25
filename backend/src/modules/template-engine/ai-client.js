// HTTP client for the ai-services website-copy endpoint. Reuses brand-kit's
// aiServicesConfigured() check (same AI_SERVICES_URL env var, no reason to
// duplicate it) and follows the identical service-JWT auth pattern as
// brand-kit/ai-client.js's requestBrandInference.

import jwt from 'jsonwebtoken';
export { aiServicesConfigured } from '../brand-kit/ai-client.js';

const REQUEST_TIMEOUT_MS = 25_000;

const err = (msg, code) => Object.assign(new Error(msg), { code });

export const requestWebsiteCopy = async (payload) => {
  const base = process.env.AI_SERVICES_URL.replace(/\/+$/, '');
  const token = jwt.sign(
    { id: 'svc:template-engine', service: true },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '120s' },
  );

  let res;
  try {
    res = await fetch(`${base}/api/ai/website-copy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    // Timeout, DNS, connection refused — transport-level, no response at all.
    throw err(`ai-services unreachable: ${cause.message}`, 'AI_TRANSPORT');
  }

  if (res.status === 401 || res.status === 403) {
    throw err('ai-services rejected service credentials', 'AI_AUTH');
  }
  if (!res.ok) {
    throw err(`ai-services returned HTTP ${res.status}`, 'AI_TRANSPORT');
  }

  const body = await res.json();
  if (!body?.success || typeof body?.data?.success !== 'boolean') {
    throw err('ai-services returned a malformed envelope', 'AI_TRANSPORT');
  }
  return body.data;
};
