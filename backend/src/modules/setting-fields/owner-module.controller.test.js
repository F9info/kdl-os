/**
 * KDL-195 — owner_module contract at the controller layer (Setting Fields)
 *
 * by-type/:slug returns 404 for a module-owned slug and 200 for a standalone one;
 * generic update/delete return 404 when the service refuses a module-owned row.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./service.js', () => ({
  getTypeBySlug: vi.fn(),
  getFieldsForType: vi.fn(),
  getWritableFieldById: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  typeExists: vi.fn(),
  categoryExists: vi.fn(),
}));

import * as service from './service.js';
import { getFieldsByTypeSlug, updateField, deleteField } from './controller.js';

const mockRes = () => {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => ((res.statusCode = code), res));
  res.json = vi.fn((body) => ((res.jsonBody = body), res));
  return res;
};

const mockReq = (overrides = {}) => ({
  validated: { params: {}, body: {}, query: {} },
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe('GET /by-type/:slug', () => {
  it('404s for a module-owned slug (service resolves it to null)', async () => {
    service.getTypeBySlug.mockResolvedValue(null);
    const res = mockRes();
    await getFieldsByTypeSlug(mockReq({ validated: { params: { slug: 'webapp.branding' } } }), res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(service.getFieldsForType).not.toHaveBeenCalled();
  });

  it('200s for a standalone slug', async () => {
    service.getTypeBySlug.mockResolvedValue({ id: 't1', slug: 'contact' });
    service.getFieldsForType.mockResolvedValue([{ id: 'f1' }]);
    const res = mockRes();
    await getFieldsByTypeSlug(mockReq({ validated: { params: { slug: 'contact' } } }), res, vi.fn());
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.fields).toEqual([{ id: 'f1' }]);
  });
});

describe('generic write paths reject module-owned rows with 404', () => {
  it('updateField 404s when the service returns null', async () => {
    service.getWritableFieldById.mockResolvedValue({ id: 'owned' });
    service.typeExists.mockResolvedValue({ id: 't1' });
    service.categoryExists.mockResolvedValue({ id: 'c1' });
    service.updateField.mockResolvedValue(null);
    const res = mockRes();
    await updateField(mockReq({ validated: { params: { id: 'owned' }, body: {} } }), res, vi.fn());
    expect(res.statusCode).toBe(404);
  });

  it('deleteField 404s when the service returns null (module-owned/missing)', async () => {
    service.deleteField.mockResolvedValue(null);
    const res = mockRes();
    await deleteField(mockReq({ validated: { params: { id: 'owned' } } }), res, vi.fn());
    expect(res.statusCode).toBe(404);
  });
});
