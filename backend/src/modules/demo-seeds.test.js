/**
 * T09: a module install must not insert DemoLogo placeholder rows unless the owner said yes to a starter site.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/database.js', () => ({ prisma: {} }));
vi.mock('../shared/default-project.js', () => ({ getDefaultProjectId: async () => 'p1' }));

import { seedTeam } from './team/seed.js';
import { seedFaq } from './faq/seed.js';
import { seedProjectsContent } from './projects-content/seed.js';
import { seedMenus } from './menus/seed.js';

const client = (answer) => ({
  appSetting: { findUnique: vi.fn().mockResolvedValue(answer ? { value: answer } : null) },
  teamMember: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  faqEntry: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  projectCaseStudy: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  menu: { upsert: vi.fn().mockResolvedValue({ id: 'm' }) },
  menuItem: { findFirst: vi.fn(), create: vi.fn() },
});

describe.each([
  ['team', seedTeam, 'teamMember'],
  ['faq', seedFaq, 'faqEntry'],
  ['projects-content', seedProjectsContent, 'projectCaseStudy'],
])('%s install seed', (_n, seed, model) => {
  it.each([[undefined], ['no']])('adds no sample rows when the answer is %s', async (answer) => {
    const c = client(answer);
    await seed(c);
    expect(c[model].create).not.toHaveBeenCalled();
  });
  it('adds them after "yes", and a second run adds nothing more', async () => {
    const c = client('yes');
    await seed(c);
    const first = c[model].create.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    c[model].findFirst.mockResolvedValue({ id: 'x' }); // rows exist now
    await seed(c);
    expect(c[model].create.mock.calls.length).toBe(first);
  });
});

describe('menus install seed', () => {
  it('creates the empty header and footer menus and no links to /p/demo-* pages', async () => {
    const c = client();
    await seedMenus(c);
    expect(c.menu.upsert).toHaveBeenCalledTimes(2);
    expect(c.menuItem.create).not.toHaveBeenCalled();
  });
});
