import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    faqEntry: {
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
  listFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
} from '../src/modules/faq/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

beforeEach(() => vi.clearAllMocks());

describe('faq service — listFaqs', () => {
  it('returns all entries ordered by order asc', async () => {
    const rows = [{ id: 'f1', question: 'Q?', answer: 'A.', is_active: true }];
    prismaMock.faqEntry.findMany.mockResolvedValue(rows);

    const result = await listFaqs({});

    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
    expect(result).toEqual(rows);
  });

  it('filters by project_id when supplied', async () => {
    prismaMock.faqEntry.findMany.mockResolvedValue([]);

    await listFaqs({ project_id: 'proj1' });

    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ project_id: 'proj1' }) })
    );
  });

  it('filters by is_active when passed as string "false"', async () => {
    prismaMock.faqEntry.findMany.mockResolvedValue([]);

    await listFaqs({ is_active: 'false' });

    expect(prismaMock.faqEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_active: false }) })
    );
  });
});

describe('faq service — getFaqById', () => {
  it('returns null when entry not found', async () => {
    prismaMock.faqEntry.findUnique.mockResolvedValue(null);
    expect(await getFaqById('missing')).toBeNull();
  });

  it('returns the entry when found', async () => {
    const entry = { id: 'f1', question: 'Q?', answer: 'A.' };
    prismaMock.faqEntry.findUnique.mockResolvedValue(entry);
    expect(await getFaqById('f1')).toEqual(entry);
  });
});

describe('faq service — createFaq', () => {
  it('creates a faq entry', async () => {
    const created = { id: 'f1', question: 'Q?', answer: 'A.', is_active: true, order: 0 };
    prismaMock.faqEntry.create.mockResolvedValue(created);

    const result = await createFaq({ question: 'Q?', answer: 'A.' });

    expect(prismaMock.faqEntry.create).toHaveBeenCalledWith({ data: { question: 'Q?', answer: 'A.' } });
    expect(result).toEqual(created);
  });
});

describe('faq service — updateFaq', () => {
  it('returns null when entry not found', async () => {
    prismaMock.faqEntry.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateFaq('missing', { question: 'Updated?' })).toBeNull();
  });

  it('returns updated entry when found', async () => {
    prismaMock.faqEntry.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: 'f1', question: 'Updated?' };
    prismaMock.faqEntry.findUnique.mockResolvedValue(updated);

    expect(await updateFaq('f1', { question: 'Updated?' })).toEqual(updated);
  });
});

describe('faq service — deleteFaq', () => {
  it('returns false when entry not found', async () => {
    prismaMock.faqEntry.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteFaq('missing')).toBe(false);
  });

  it('returns true when entry deleted', async () => {
    prismaMock.faqEntry.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteFaq('f1')).toBe(true);
  });
});
