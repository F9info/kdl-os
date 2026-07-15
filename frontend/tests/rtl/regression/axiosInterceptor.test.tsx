import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError } from 'axios';

// KDL-217 regression: the 401 response interceptor must NOT run its
// refresh-and-redirect path for auth endpoints. Before the fix, a 401 from
// POST /auth/login triggered a refresh (also 401) and then
// `window.location.href = '/login'` — a full page reload that wiped React
// state before the login form could render its error alert.

const setAuth = vi.fn();
const clearAuth = vi.fn();

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'access-tok', user: { id: '1' }, setAuth, clearAuth }),
  },
}));

import api from '@/lib/axios';

// Per-call status queue so the mock adapter can return 401 then 200 (retry).
let statusQueue: number[] = [];
api.defaults.adapter = async (config) => {
  const status = statusQueue.shift() ?? 200;
  const response = {
    data: { message: status === 401 ? 'Invalid credentials' : 'ok' },
    status,
    statusText: status === 401 ? 'Unauthorized' : 'OK',
    headers: {},
    config,
  } as any;
  // Custom adapters must enforce validateStatus themselves — built-in
  // adapters reject non-2xx via settle(); replicate that here.
  if (status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_REQUEST', config, null, response);
};

let locationMock: { href: string };

beforeEach(() => {
  vi.clearAllMocks();
  statusQueue = [];
  locationMock = { href: 'http://localhost/login' };
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: locationMock,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('axios 401 interceptor — auth endpoint exclusion (KDL-217)', () => {
  it('rejects a 401 from /auth/login without refreshing or redirecting', async () => {
    const refreshSpy = vi.spyOn(axios, 'post');
    statusQueue = [401];

    await expect(api.post('/auth/login', { email: 'x', password: 'y' })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearAuth).not.toHaveBeenCalled();
    expect(locationMock.href).toBe('http://localhost/login'); // unchanged — no full-page reload
  });

  it('still refreshes and retries a 401 from a protected endpoint', async () => {
    const refreshSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { data: { accessToken: 'new-tok' } } } as any);
    statusQueue = [401, 200]; // first call 401 → refresh → retry succeeds

    const res = await api.get('/users');

    expect(refreshSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/auth\/refresh$/),
      {},
      expect.objectContaining({ withCredentials: true }),
    );
    expect(res.status).toBe(200);
  });
});
