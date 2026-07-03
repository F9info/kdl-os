import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

/**
 * Build a minimal Express app with the requested route module.
 * Useful for route-level tests with mocked services.
 */
export function buildApp(routes) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  routes.forEach(({ path, router }) => app.use(path, router));
  app.use((req, res) => res.status(404).json({ success: false, message: 'Not found' }));
  app.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
  });
  return app;
}

export const agent = (routes) => request(buildApp(routes));

export const bearer = (payload) => `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}`;

export const cookieValue = (response, name) => {
  const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [];
  for (const c of cookies) {
    const [keyVal] = c.split(';');
    const [key, val] = keyVal.split('=');
    if (key === name) return decodeURIComponent(val);
  }
  return undefined;
};

export const cookieAttributes = (response, name) => {
  const cookies = Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'] : [];
  const header = cookies.find((c) => c.startsWith(`${name}=`));
  if (!header) return {};
  const attrs = {};
  for (const part of header.split(';')) {
    const [k, v] = part.trim().split('=');
    attrs[k.toLowerCase()] = v === undefined ? true : v;
  }
  return attrs;
};
