// HTTP client for the ai-services brand-inference endpoint (KDL-510, §4.3).
//
// The AI path is configured by AI_SERVICES_URL; when unset, the caller treats
// the path as not wired (F1_NO_KEY) without any network attempt. Auth is a
// short-lived service JWT signed with the shared JWT_SECRET — ai-services
// verifies the same secret (AI_SERVICES_ARCH §auth).

import jwt from 'jsonwebtoken';

// Outer bound > the endpoint's internal 20 s model timeout, so a degraded
// (fallback) envelope from ai-services still arrives instead of us aborting.
const REQUEST_TIMEOUT_MS = 25_000;

export const aiServicesConfigured = () => Boolean(process.env.AI_SERVICES_URL);

const err = (msg, code) => Object.assign(new Error(msg), { code });

export const requestBrandInference = async (payload) => {
  const base = process.env.AI_SERVICES_URL.replace(/\/+$/, '');
  const token = jwt.sign(
    { id: 'svc:brand-kit', service: true },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '120s' },
  );

  let res;
  try {
    res = await fetch(`${base}/api/ai/brand-inference`, {
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
  if (!body?.success || !body?.data?.source) {
    throw err('ai-services returned a malformed envelope', 'AI_TRANSPORT');
  }
  return body.data;
};
