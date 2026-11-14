import { describe, it, expect, vi } from 'vitest';

const rows = [];
const settings = { 'identity.company_name': 'Acme Robotics' };
const prisma = {
  appSetting: { findUnique: vi.fn(async ({ where }) => (where.key === 'onboarding.frontend' ? { value: 'yes' } : settings[where.key] ? { value: settings[where.key] } : null)) },
  faqEntry: {
    findFirst: vi.fn(async ({ where }) => rows.find((r) => where.question.in.includes(r.question)) ?? null),
    create: vi.fn(async ({ data }) => rows.push(data)),
  },
  teamMember: { findFirst: vi.fn(async () => null), create: vi.fn(async ({ data }) => rows.push(data)) },
};
vi.mock('../../config/database.js', () => ({ prisma }));
vi.mock('../../shared/default-project.js', () => ({ getDefaultProjectId: vi.fn(async () => 'p1') }));

const { seedFaq } = await import('./seed.js');
const { seedTeam } = await import('../team/seed.js');

describe('sample content uses the company name', () => {
  it('the first sample FAQ names the company, not a placeholder', async () => {
    await seedFaq(prisma);
    expect(rows[0].question).toBe('What services does Acme Robotics offer?');
    expect(JSON.stringify(rows)).not.toContain('DemoLogo');
  });

  it('re-running adds nothing, and an entry saved with the old placeholder wording counts as already there', async () => {
    const before = rows.length;
    await seedFaq(prisma);
    expect(rows.length).toBe(before);
    rows.length = 0;
    rows.push({ question: 'What services does DemoLogo offer?' });
    await seedFaq(prisma);
    expect(rows.filter((r) => /services does/.test(r.question))).toHaveLength(1); // not duplicated under the new name
  });

  it('team roles name the company', async () => {
    rows.length = 0;
    await seedTeam(prisma);
    expect(rows.map((r) => r.role)).toEqual(['Founder, Acme Robotics', 'Creative Director, Acme Robotics']);
  });
});
