import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((url: URL) => ({ type: 'redirect', url })),
  next: vi.fn(() => ({ type: 'next' })),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: mocks.redirect,
    next: mocks.next,
  },
}));

import { middleware } from '../../middleware';

function makeRequest(pathname: string, token?: string) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: vi.fn(() => (token ? { value: token } : undefined)),
    },
  } as unknown as import('next/server').NextRequest;
}

function makeToken(exp: number) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.`;
}

describe('middleware regression — JWT expiry validation (KDL-20 H4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows valid unexpired tokens', () => {
    const token = makeToken(Math.floor(Date.now() / 1000) + 3600);
    middleware(makeRequest('/admin/users', token));
    expect(mocks.next).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redirects when token is expired', () => {
    const token = makeToken(Math.floor(Date.now() / 1000) - 3600);
    middleware(makeRequest('/admin/users', token));
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it('redirects when token cookie is missing', () => {
    middleware(makeRequest('/admin/users'));
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it('does not redirect non-admin routes', () => {
    middleware(makeRequest('/login'));
    expect(mocks.next).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
