import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/modules/settings/service.js', () => ({
  __esModule: true,
  listSettings: vi.fn(),
  getSettingByKey: vi.fn(),
  createSetting: vi.fn(),
  updateSetting: vi.fn(),
  deleteSetting: vi.fn(),
}));

import * as settingsService from '../src/modules/settings/service.js';
import {
  listSettings,
  getSetting,
} from '../src/modules/settings/controller.js';

const settingsServiceMock = vi.mocked(settingsService, { deep: true });

function mockRes() {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.jsonBody = body;
    return res;
  });
  return res;
}

function mockReq(overrides = {}) {
  return {
    user: null,
    validated: { params: {}, body: {}, query: {} },
    ...overrides,
  };
}

describe('settings controller regression — optionalAuthenticate (KDL-14 HIGH)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists settings with isAdmin=false for unauthenticated requests', async () => {
    settingsServiceMock.listSettings.mockResolvedValue([{ key: 'public' }]);
    const req = mockReq();
    const res = mockRes();
    await listSettings(req, res, vi.fn());

    expect(settingsServiceMock.listSettings).toHaveBeenCalledWith(false);
    expect(res.jsonBody.data.settings).toEqual([{ key: 'public' }]);
  });

  it('lists settings with isAdmin=true for authenticated ADMIN requests', async () => {
    settingsServiceMock.listSettings.mockResolvedValue([{ key: 'public' }, { key: 'private' }]);
    const req = mockReq({ user: { id: 'a1', roles: ['admin'] } });
    const res = mockRes();
    await listSettings(req, res, vi.fn());

    expect(settingsServiceMock.listSettings).toHaveBeenCalledWith(true);
  });

  it('blocks non-admins from viewing private settings', async () => {
    settingsServiceMock.getSettingByKey.mockResolvedValue({
      key: 'secret',
      is_public: false,
    });
    const req = mockReq({ validated: { params: { key: 'secret' } } });
    const res = mockRes();
    await getSetting(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(res.jsonBody.success).toBe(false);
  });
});
