// Per-user OAuth for cloud import providers (Phase D8). App credentials come from
// env (<PREFIX>_CLIENT_ID / <PREFIX>_CLIENT_SECRET); user tokens are held in
// MediaImportConnection.credentials, encrypted by the caller (service.js) with
// shared/utils/crypto.js — this module never touches the database.
// The OAuth `state` is a short-lived JWT bound to the initiating user, so the
// callback can't attach someone else's tokens to another account (CSRF).

import jwt from 'jsonwebtoken';

export const OAUTH_PROVIDERS = {
  gdrive: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    // offline + consent forces a refresh_token on every connect, not just the first
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    envPrefix: 'GDRIVE',
  },
  dropbox: {
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    scope: 'files.metadata.read files.content.read',
    extraAuthParams: { token_access_type: 'offline' },
    envPrefix: 'DROPBOX',
  },
  onedrive: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.Read offline_access',
    extraAuthParams: {},
    envPrefix: 'ONEDRIVE',
  },
};

const STATE_PURPOSE = 'media_import_oauth';

export const isOAuthConfigured = (provider) => {
  const cfg = OAUTH_PROVIDERS[provider];
  return !!cfg
    && !!process.env[`${cfg.envPrefix}_CLIENT_ID`]
    && !!process.env[`${cfg.envPrefix}_CLIENT_SECRET`];
};

export const getOAuthConfig = (provider) => {
  const cfg = OAUTH_PROVIDERS[provider];
  if (!cfg) {
    throw Object.assign(new Error(`Unknown OAuth provider: ${provider}`), { status: 422 });
  }
  const client_id = process.env[`${cfg.envPrefix}_CLIENT_ID`];
  const client_secret = process.env[`${cfg.envPrefix}_CLIENT_SECRET`];
  if (!client_id || !client_secret) {
    throw Object.assign(
      new Error(`${provider} import is not configured (set ${cfg.envPrefix}_CLIENT_ID / ${cfg.envPrefix}_CLIENT_SECRET)`),
      { status: 422 },
    );
  }
  return { ...cfg, client_id, client_secret };
};

export const buildAuthUrl = (provider, userId, redirectUri) => {
  const cfg = getOAuthConfig(provider);
  const state = jwt.sign(
    { sub: userId, provider, purpose: STATE_PURPOSE },
    process.env.JWT_SECRET,
    { expiresIn: '10m' },
  );
  const params = new URLSearchParams({
    client_id: cfg.client_id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state,
    ...cfg.extraAuthParams,
  });
  return { url: `${cfg.authUrl}?${params}`, state };
};

export const verifyState = (state, userId, provider) => {
  let payload;
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    throw Object.assign(new Error('Invalid or expired OAuth state'), { status: 422 });
  }
  if (payload.purpose !== STATE_PURPOSE || payload.sub !== userId || payload.provider !== provider) {
    throw Object.assign(new Error('OAuth state does not match this request'), { status: 422 });
  }
  return payload;
};

const normalizeTokens = (data) => ({
  access_token: data.access_token,
  refresh_token: data.refresh_token ?? null,
  expires_at: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
});

const postToken = async (cfg, body, { fetchImpl = fetch } = {}) => {
  const res = await fetchImpl(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.client_id,
      client_secret: cfg.client_secret,
      ...body,
    }),
  });
  if (!res.ok) return null;
  return res.json();
};

export const exchangeCode = async (provider, code, redirectUri, deps = {}) => {
  const cfg = getOAuthConfig(provider);
  const data = await postToken(cfg, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  }, deps);
  if (!data?.access_token) {
    throw Object.assign(new Error('OAuth code exchange failed'), { status: 422 });
  }
  return normalizeTokens(data);
};

export const refreshTokens = async (provider, creds, deps = {}) => {
  const cfg = getOAuthConfig(provider);
  if (!creds.refresh_token) {
    throw Object.assign(new Error('Connection expired — reconnect required'), { status: 401 });
  }
  const data = await postToken(cfg, {
    grant_type: 'refresh_token',
    refresh_token: creds.refresh_token,
  }, deps);
  if (!data?.access_token) {
    throw Object.assign(new Error('Token refresh failed — reconnect required'), { status: 401 });
  }
  return {
    ...creds,
    ...normalizeTokens(data),
    // providers often omit refresh_token on refresh — keep the original
    refresh_token: data.refresh_token ?? creds.refresh_token,
  };
};
