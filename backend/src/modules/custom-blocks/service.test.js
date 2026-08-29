import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    customBlockTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock('../../config/database.js', () => ({ prisma: mockPrisma }));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
}));

import * as service from './service.js';

const CONFIG = { category: 'hero', atoms: [{ id: 'a1', type: 'heading', text: 'Hi' }], settings: {} };

describe('listCustomBlocks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes to project_id + category_key, excludes soft-deleted', async () => {
    mockPrisma.customBlockTemplate.findMany.mockResolvedValue([]);
    await service.listCustomBlocks('proj-1', 'hero');
    expect(mockPrisma.customBlockTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: 'proj-1', category_key: 'hero', deleted_at: null },
      })
    );
  });
});

describe('createCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a DRAFT row scoped to the project and category', async () => {
    mockPrisma.customBlockTemplate.create.mockResolvedValue({ id: 'cb-1', name: 'My Hero' });
    const result = await service.createCustomBlock(
      { projectId: 'proj-1', categoryKey: 'hero', name: 'My Hero', status: 'DRAFT', config: CONFIG },
      'user-1'
    );
    expect(mockPrisma.customBlockTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        category_key: 'hero',
        name: 'My Hero',
        status: 'DRAFT',
        config: CONFIG,
        created_by: 'user-1',
      }),
    });
    expect(result.id).toBe('cb-1');
  });
});

describe('duplicateCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws a 404 error when the source block does not exist', async () => {
    mockPrisma.customBlockTemplate.findFirst.mockResolvedValue(null);
    await expect(service.duplicateCustomBlock('missing', 'user-1')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('copies config, appends " Copy" to the name, resets status to DRAFT', async () => {
    mockPrisma.customBlockTemplate.findFirst.mockResolvedValue({
      id: 'cb-1',
      project_id: 'proj-1',
      category_key: 'hero',
      name: 'My Hero',
      description: 'd',
      config: CONFIG,
    });
    mockPrisma.customBlockTemplate.create.mockResolvedValue({ id: 'cb-2', name: 'My Hero Copy' });

    await service.duplicateCustomBlock('cb-1', 'user-1');

    expect(mockPrisma.customBlockTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        category_key: 'hero',
        name: 'My Hero Copy',
        status: 'DRAFT',
        is_default: false,
        config: CONFIG,
        created_by: 'user-1',
      }),
    });
  });
});

describe('setDefaultCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('clears is_default on siblings in the same project+category before setting it', async () => {
    mockPrisma.customBlockTemplate.findFirst.mockResolvedValue({
      id: 'cb-1',
      project_id: 'proj-1',
      category_key: 'hero',
    });
    mockPrisma.customBlockTemplate.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.customBlockTemplate.update.mockResolvedValue({ id: 'cb-1', is_default: true });

    await service.setDefaultCustomBlock('cb-1', 'user-1');

    expect(mockPrisma.customBlockTemplate.updateMany).toHaveBeenCalledWith({
      where: { project_id: 'proj-1', category_key: 'hero', is_default: true },
      data: { is_default: false },
    });
    expect(mockPrisma.customBlockTemplate.update).toHaveBeenCalledWith({
      where: { id: 'cb-1' },
      data: { is_default: true },
    });
  });
});

describe('deleteCustomBlock', () => {
  beforeEach(() => vi.clearAllMocks());

  it('soft-deletes by setting deleted_at', async () => {
    mockPrisma.customBlockTemplate.update.mockResolvedValue({ id: 'cb-1', name: 'My Hero' });
    await service.deleteCustomBlock('cb-1', 'user-1');
    expect(mockPrisma.customBlockTemplate.update).toHaveBeenCalledWith({
      where: { id: 'cb-1' },
      data: { deleted_at: expect.any(Date) },
    });
  });
});
