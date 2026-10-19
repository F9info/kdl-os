import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn(async ({ data }) => ({ id: 'p1', title: data.title, project_id: data.project_id, data: data.data }));
const update = vi.fn(async ({ data }) => ({ id: 'p1', title: 't', ...data }));
vi.mock('../../config/database.js', () => ({
  prisma: {
    builderPage: { create: (a) => create(a), update: (a) => update(a), findFirst: async () => null },
    detailPageTemplate: { findUnique: async () => null, update: vi.fn() },
  },
}));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));

const { createPage, updatePage } = await import('./service.js');

const legacy = {
  content: [{ type: 'ConstructionFAQ', props: { id: 'f', faq1Question: 'Q', faq1Answer: 'A', faq2Question: '', faq2Answer: '' } }],
};

describe('page-builder writes fold numbered slots into array props (seeders, API, imports)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('createPage', async () => {
    await createPage({ title: 't', slug: 's', data: legacy, project_id: 'x' }, 'u');
    const saved = create.mock.calls[0][0].data.data;
    expect(saved.content[0].props.faqs).toEqual([{ question: 'Q', answer: 'A' }]);
    expect(saved.content[0].props).not.toHaveProperty('faq1Question');
  });

  it('updatePage', async () => {
    await updatePage('p1', { data: legacy }, 'u');
    const saved = update.mock.calls[0][0].data.data;
    expect(saved.content[0].props.faqs).toEqual([{ question: 'Q', answer: 'A' }]);
  });
});
