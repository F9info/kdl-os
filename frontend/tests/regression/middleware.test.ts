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

import { middleware } from '../../src/middleware';

function makeRequest(pathname: string, tokens: { access?: string; refresh?: string } = {}) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: vi.fn((name: string) => {
        if (name === 'kdl-auth-token' && tokens.access) return { value: tokens.access };
        if (name === 'kdl-refresh-token' && tokens.refresh) return { value: tokens.refresh };
        return undefined;
      }),
    },
  } as unknown as import('next/server').NextRequest;
}

function makeToken(exp: number) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${header}.${payload}.`;
}

const valid = () => makeToken(Math.floor(Date.now() / 1000) + 3600);
const expired = () => makeToken(Math.floor(Date.now() / 1000) - 3600);

describe('middleware regression — JWT expiry validation (KDL-20 H4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows a valid unexpired access token', () => {
    middleware(makeRequest('/admin/users', { access: valid() }));
    expect(mocks.next).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('allows expired access token when refresh token is still valid (session restore path)', () => {
    middleware(makeRequest('/admin/users', { access: expired(), refresh: valid() }));
    expect(mocks.next).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('redirects when both access and refresh tokens are expired', () => {
    middleware(makeRequest('/admin/users', { access: expired(), refresh: expired() }));
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it('redirects when access token is expired and no refresh token is present', () => {
    middleware(makeRequest('/admin/users', { access: expired() }));
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.next).not.toHaveBeenCalled();
  });

  it('redirects when both token cookies are missing', () => {
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
