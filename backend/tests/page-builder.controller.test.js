import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/modules/page-builder/service.js', () => ({
  __esModule: true,
  listPages: vi.fn(),
  getPage: vi.fn(),
  getPublishedBySlug: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
}));

import * as pageBuilderService from '../src/modules/page-builder/service.js';
import { getAll, getOne, getPublic, postCreate, putUpdate, remove } from '../src/modules/page-builder/controller.js';

const svc = vi.mocked(pageBuilderService, { deep: true });

function mockRes() {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.jsonBody = body; return res; });
  return res;
}

function mockReq(overrides = {}) {
  return {
    user: { id: 'actor1' },
    params: {},
    body: {},
    validated: { params: {}, body: {}, query: {} },
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('page-builder controller — getAll', () => {
  it('returns list of pages', async () => {
    const pages = [{ id: 'p1', title: 'Home' }];
    svc.listPages.mockResolvedValue(pages);

    const res = mockRes();
    await getAll(mockReq(), res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.items).toEqual(pages);
  });
});

describe('page-builder controller — getOne', () => {
  it('returns 404 when page not found', async () => {
    svc.getPage.mockResolvedValue(null);

    const res = mockRes();
    await getOne(mockReq({ params: { id: 'missing' } }), res, vi.fn());

    expect(res.statusCode).toBe(404);
    expect(res.jsonBody.success).toBe(false);
  });

  it('returns the page when found', async () => {
    const page = { id: 'p1', title: 'About', data: {} };
    svc.getPage.mockResolvedValue(page);

    const res = mockRes();
    await getOne(mockReq({ params: { id: 'p1' } }), res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.page).toEqual(page);
  });
});

describe('page-builder controller — getPublic', () => {
  it('returns 404 for unpublished or missing slug', async () => {
    svc.getPublishedBySlug.mockResolvedValue(null);

    const res = mockRes();
    await getPublic(mockReq({ params: { slug: 'draft-page' } }), res, vi.fn());

    expect(res.statusCode).toBe(404);
  });

  it('returns 200 for a published page', async () => {
    const page = { slug: 'home', title: 'Home', data: {} };
    svc.getPublishedBySlug.mockResolvedValue(page);

    const res = mockRes();
    await getPublic(mockReq({ params: { slug: 'home' } }), res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.page).toEqual(page);
  });
});

describe('page-builder controller — postCreate', () => {
  it('creates a page and returns 201', async () => {
    const page = { id: 'p1', title: 'New', slug: 'new', status: 'DRAFT' };
    svc.createPage.mockResolvedValue(page);

    const body = { title: 'New', slug: 'new' };
    const res = mockRes();
    await postCreate(mockReq({ body }), res, vi.fn());

    expect(res.statusCode).toBe(201);
    expect(res.jsonBody.data.page).toEqual(page);
  });

  it('propagates validation errors via next', async () => {
    const next = vi.fn();
    const res = mockRes();
    // Invalid slug (uppercase) should cause Zod to throw
    await postCreate(mockReq({ body: { title: 'X', slug: 'BAD SLUG' } }), res, next);

    expect(next).toHaveBeenCalled();
  });
});

describe('page-builder controller — putUpdate', () => {
  it('updates a page and returns 200', async () => {
    const page = { id: 'p1', title: 'Updated', status: 'PUBLISHED' };
    svc.updatePage.mockResolvedValue(page);

    const res = mockRes();
    await putUpdate(mockReq({ params: { id: 'p1' }, body: { title: 'Updated', status: 'PUBLISHED' } }), res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.page).toEqual(page);
    expect(svc.updatePage).toHaveBeenCalledWith('p1', expect.objectContaining({ title: 'Updated', status: 'PUBLISHED' }), 'actor1');
  });
});

describe('page-builder controller — remove', () => {
  it('deletes a page and returns ok', async () => {
    svc.deletePage.mockResolvedValue({ id: 'p1' });

    const res = mockRes();
    await remove(mockReq({ params: { id: 'p1' } }), res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.ok).toBe(true);
    expect(svc.deletePage).toHaveBeenCalledWith('p1', 'actor1');
  });
});
