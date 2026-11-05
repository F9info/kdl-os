/**
 * GET /api/brand-kit/:projectId/theme-colors — route wiring.
 * The route must sit behind authenticate + requirePermission('brand-kit', 'view')
 * (like its sibling GET /:projectId/tokens), hand the projectId to getThemeColors,
 * wrap the result in successResponse, and let the service's 409 NOT_EXTRACTED /
 * 404 NO_KIT errors through the error handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const svc = vi.hoisted(() => ({ getThemeColors: vi.fn() }));

vi.mock('./service.js', () => svc);
vi.mock('./contact-fields.js', () => ({ getContactFields: vi.fn(), saveContactFields: vi.fn() }));
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) =>
    req.get('authorization')
      ? ((req.user = { id: 'u1' }), next())
      : res.status(401).json({ success: false, message: 'Unauthorized' }),
}));
// Grants are read from a header so each case runs with exactly the permissions it names.
vi.mock('../../middleware/permission.js', () => ({
  requirePermission: (moduleName, action) => (req, res, next) =>
    (req.get('x-grants') ?? '').split(',').includes(`${moduleName}:${action}`)
      ? next()
      : res.status(403).json({ success: false, message: 'Forbidden' }),
}));
vi.mock('../../middleware/upload.js', () => ({ upload: { single: () => (_req, _res, next) => next() } }));
vi.mock('../../shared/utils/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import router from './routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

const app = express();
app.use('/bk', router);
app.use(errorHandler);

const PAYLOAD = {
  approved: true,
  kitId: 'kit-1',
  light: { primary: '#0e6e5c', secondary: '#0e6e5c', accent: '#0e6e5c', highlight: '#0e6e5c', background: '#f9fafb', text: '#111827' },
  dark: { primary: '#74ccb5', secondary: '#74ccb5', accent: '#74ccb5', highlight: '#74ccb5', background: '#111827', text: '#f9fafb' },
};

const get = (headers = {}) =>
  request(app)
    .get('/bk/proj-1/theme-colors')
    .set({ authorization: 'Bearer t', 'x-grants': 'brand-kit:view', ...headers });

beforeEach(() => {
  vi.clearAllMocks();
  svc.getThemeColors.mockResolvedValue(PAYLOAD);
});

describe('GET /:projectId/theme-colors', () => {
  it('returns { approved, kitId, light, dark } for the project', async () => {
    const res = await get().expect(200);

    expect(res.body).toEqual({ success: true, data: PAYLOAD });
    expect(svc.getThemeColors).toHaveBeenCalledWith('proj-1');
  });

  it('requires authentication', async () => {
    await get({ authorization: '' }).expect(401);
    expect(svc.getThemeColors).not.toHaveBeenCalled();
  });

  it('requires the brand-kit view permission — edit alone is not enough', async () => {
    await get({ 'x-grants': 'brand-kit:edit' }).expect(403);
    await get({ 'x-grants': '' }).expect(403);
    expect(svc.getThemeColors).not.toHaveBeenCalled();
  });

  it('answers 409 when the palette was never extracted', async () => {
    svc.getThemeColors.mockRejectedValue(
      Object.assign(new Error('Palette not extracted'), { status: 409, code: 'NOT_EXTRACTED' }),
    );

    const res = await get().expect(409);

    expect(res.body).toEqual({ success: false, message: 'Palette not extracted' });
  });

  it('answers 404 when the project has no brand kit', async () => {
    svc.getThemeColors.mockRejectedValue(
      Object.assign(new Error('Brand kit not found'), { status: 404, code: 'NO_KIT' }),
    );

    await get().expect(404);
  });
});
