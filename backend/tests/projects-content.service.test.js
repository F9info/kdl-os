import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    projectCaseStudy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/config/database.js';
import {
  listCaseStudies,
  getCaseStudyById,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
} from '../src/modules/projects-content/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

beforeEach(() => vi.clearAllMocks());

describe('projects-content service — listCaseStudies', () => {
  it('returns all case studies ordered by order asc', async () => {
    const rows = [{ id: 'cs1', title: 'Solar Install', is_active: true }];
    prismaMock.projectCaseStudy.findMany.mockResolvedValue(rows);

    const result = await listCaseStudies({});

    expect(prismaMock.projectCaseStudy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
    expect(result).toEqual(rows);
  });

  it('filters by project_id when supplied', async () => {
    prismaMock.projectCaseStudy.findMany.mockResolvedValue([]);

    await listCaseStudies({ project_id: 'proj1' });

    expect(prismaMock.projectCaseStudy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ project_id: 'proj1' }) })
    );
  });

  it('filters by is_active="false" for inactive entries', async () => {
    prismaMock.projectCaseStudy.findMany.mockResolvedValue([]);

    await listCaseStudies({ is_active: 'false' });

    expect(prismaMock.projectCaseStudy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_active: false }) })
    );
  });
});

describe('projects-content service — getCaseStudyById', () => {
  it('returns null when case study not found', async () => {
    prismaMock.projectCaseStudy.findUnique.mockResolvedValue(null);
    expect(await getCaseStudyById('missing')).toBeNull();
  });

  it('returns the case study when found', async () => {
    const cs = { id: 'cs1', title: 'Solar Install' };
    prismaMock.projectCaseStudy.findUnique.mockResolvedValue(cs);
    expect(await getCaseStudyById('cs1')).toEqual(cs);
  });
});

describe('projects-content service — createCaseStudy', () => {
  it('creates a case study', async () => {
    const created = { id: 'cs1', title: 'HVAC Job', is_active: true, order: 0 };
    prismaMock.projectCaseStudy.create.mockResolvedValue(created);

    const result = await createCaseStudy({ title: 'HVAC Job' });

    expect(prismaMock.projectCaseStudy.create).toHaveBeenCalledWith({ data: { title: 'HVAC Job' } });
    expect(result).toEqual(created);
  });
});

describe('projects-content service — updateCaseStudy', () => {
  it('returns null when case study not found', async () => {
    prismaMock.projectCaseStudy.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateCaseStudy('missing', { title: 'X' })).toBeNull();
  });

  it('returns updated case study when found', async () => {
    prismaMock.projectCaseStudy.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: 'cs1', title: 'Updated' };
    prismaMock.projectCaseStudy.findUnique.mockResolvedValue(updated);

    expect(await updateCaseStudy('cs1', { title: 'Updated' })).toEqual(updated);
  });
});

describe('projects-content service — deleteCaseStudy', () => {
  it('returns false when case study not found', async () => {
    prismaMock.projectCaseStudy.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteCaseStudy('missing')).toBe(false);
  });

  it('returns true when case study deleted', async () => {
    prismaMock.projectCaseStudy.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteCaseStudy('cs1')).toBe(true);
  });
});
