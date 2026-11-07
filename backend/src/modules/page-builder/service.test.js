import { describe, it, expect, vi, beforeEach } from 'vitest';

const create = vi.fn(async ({ data }) => ({ id: 'p1', title: data.title, project_id: data.project_id, data: data.data }));
const update = vi.fn(async ({ data }) => ({ id: 'p1', title: 't', ...data }));
vi.mock('../../config/database.js', () => ({
  prisma: {
    builderPage: { create: (a) => create(a), update: (a) => update(a), findFirst: async () => ({ id: 'p1', title: 't', status: 'DRAFT', template_id: null }) },
    site: { findFirst: async () => ({ id: 'site-1' }) },
    project: { findFirst: async () => ({ id: 'default-id' }) },
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
    expect(create.mock.calls[0][0].data.site_id).toBe('site-1'); // joins the project's default site
  });

  it('updatePage', async () => {
    await updatePage('p1', { data: legacy }, 'u');
    const saved = update.mock.calls[0][0].data.data;
    expect(saved.content[0].props.faqs).toEqual([{ question: 'Q', answer: 'A' }]);
  });
});

describe('createPage always puts the page in a project (T04)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the project it is given', async () => {
    await createPage({ title: 't', slug: 's', project_id: 'proj-2' }, 'u');
    expect(create.mock.calls[0][0].data.project_id).toBe('proj-2');
  });

  it('falls back to the default project when none is given (legacy callers)', async () => {
    await createPage({ title: 't', slug: 's', project_id: null }, 'u');
    expect(create.mock.calls[0][0].data.project_id).toBe('default-id');
  });
});
