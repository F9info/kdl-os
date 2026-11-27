import { describe, it, expect, vi, beforeEach } from 'vitest';

const model = () => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
});
const prismaMock = vi.hoisted(() => ({}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));

const service = await import('./devfest.service.js');
const { editionSchemas, sessionSchemas, speakerSchemas } = await import('./devfest.schema.js');

beforeEach(() => {
  for (const k of ['devfestEdition', 'devfestSpeaker', 'devfestSession', 'devfestSponsor', 'devfestTeamMember']) {
    prismaMock[k] = model();
  }
  prismaMock.$transaction = vi.fn(async (arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)));
  prismaMock.devfestEdition.findUnique.mockResolvedValue({ id: 'e1', project_id: 'p1' });
});

describe('creating DevFest records', () => {
  it('makes a free web address from the name inside the edition', async () => {
    prismaMock.devfestSpeaker.findMany.mockResolvedValue([{ slug: 'jane-doe' }, { slug: 'jane-doe-2' }]);
    prismaMock.devfestSpeaker.create.mockImplementation(async ({ data }) => ({ id: 's1', ...data }));
    const item = await service.create('speakers', { project_id: 'p1', edition_id: 'e1', name: 'Jane Doe' }, 'u1');
    expect(item.slug).toBe('jane-doe-3');
  });

  it('refuses an edition of another project', async () => {
    prismaMock.devfestEdition.findUnique.mockResolvedValue({ id: 'e9', project_id: 'other' });
    await expect(
      service.create('sponsors', { project_id: 'p1', edition_id: 'e9', name: 'Acme' }, 'u1')
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses session speakers from another edition', async () => {
    prismaMock.devfestSession.findMany.mockResolvedValue([]);
    prismaMock.devfestSpeaker.count.mockResolvedValue(1);
    await expect(
      service.create('sessions', { project_id: 'p1', edition_id: 'e1', title: 'Talk', speaker_ids: ['a', 'b'] }, 'u1')
    ).rejects.toMatchObject({ status: 400 });
  });

  it('a new current edition unmarks the others of the project', async () => {
    prismaMock.devfestEdition.create.mockResolvedValue({ id: 'e2', name: 'DevFest 2026' });
    await service.create('editions', { project_id: 'p1', year: 2026, name: 'DevFest 2026', is_current: true }, 'u1');
    expect(prismaMock.devfestEdition.updateMany).toHaveBeenCalledWith({
      where: { project_id: 'p1' },
      data: { is_current: false },
    });
  });

  it('a second edition for the same year answers 409', async () => {
    prismaMock.devfestEdition.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(
      service.create('editions', { project_id: 'p1', year: 2026, name: 'Again' }, 'u1')
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('deleting a speaker', () => {
  it('takes them off every session that lists them', async () => {
    prismaMock.devfestSpeaker.findUnique.mockResolvedValue({ id: 's1', edition_id: 'e1', name: 'Jane' });
    prismaMock.devfestSession.findMany.mockResolvedValue([{ id: 't1', speaker_ids: ['s1', 's2'] }]);
    expect(await service.remove('speakers', 's1', 'u1')).toBe(true);
    expect(prismaMock.devfestSession.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { speaker_ids: ['s2'] } });
    expect(prismaMock.devfestSpeaker.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});

describe('public read', () => {
  const editions = [
    { id: 'e26', year: 2026, name: 'DevFest 2026', is_current: true },
    { id: 'e23', year: 2023, name: 'DevFest 2023', is_current: false },
  ];
  beforeEach(() => {
    prismaMock.devfestEdition.findMany.mockResolvedValue(editions);
    prismaMock.devfestEdition.findUnique.mockImplementation(async ({ where }) => ({
      ...editions.find((e) => e.id === where.id),
      tracks: [{ name: 'Web' }],
      stats: [],
    }));
    prismaMock.devfestSpeaker.findMany.mockResolvedValue([{ id: 's1', slug: 'jane', name: 'Jane', links: {}, badges: [] }]);
    prismaMock.devfestSession.findMany.mockResolvedValue([
      { id: 't1', slug: 'talk', title: 'Talk', kind: 'talk', speaker_ids: ['s1', 'hidden'], starts_at: null },
    ]);
    prismaMock.devfestSponsor.findMany.mockResolvedValue([]);
    prismaMock.devfestTeamMember.findMany.mockResolvedValue([]);
  });

  it('shows the current edition by default, and only shown records', async () => {
    const out = await service.getPublicDevfest('p1');
    expect(out.edition.year).toBe(2026);
    expect(out.editions.map((e) => e.year)).toEqual([2026, 2023]);
    expect(prismaMock.devfestSpeaker.findMany.mock.calls[0][0].where).toEqual({ edition_id: 'e26', is_visible: true });
    // A hidden speaker never leaks through a session.
    expect(out.sessions[0].speakers).toEqual(['s1']);
  });

  it('shows the asked year, and an empty result for an unknown one', async () => {
    expect((await service.getPublicDevfest('p1', 2023)).edition.year).toBe(2023);
    expect((await service.getPublicDevfest('p1', 2019)).edition).toBeNull();
  });
});

describe('request schemas', () => {
  it('an update cannot move a record to another edition', () => {
    const r = speakerSchemas.update.parse({ params: { id: 's1' }, body: { name: 'Jane', edition_id: 'e9' } });
    expect(r.body).not.toHaveProperty('edition_id');
  });

  it('a session must end after it starts', () => {
    const body = { edition_id: 'e1', title: 'Talk', starts_at: '2026-12-06T10:00:00Z', ends_at: '2026-12-06T09:00:00Z' };
    expect(sessionSchemas.create.safeParse({ body }).success).toBe(false);
  });

  it('links must be full links', () => {
    const body = { edition_id: 'e1', name: 'Jane', links: { LinkedIn: 'not a link' } };
    expect(speakerSchemas.create.safeParse({ body }).success).toBe(false);
  });

  it('an empty or null date clears it instead of becoming 1970', () => {
    const r = editionSchemas.create.parse({ body: { year: 2026, name: 'DevFest', start_date: null, end_date: '' } });
    expect(r.body.start_date).toBeNull();
    expect(r.body.end_date).toBeNull();
    const u = editionSchemas.update.parse({ params: { id: 'e1' }, body: { name: 'DevFest' } });
    expect(u.body).not.toHaveProperty('start_date');
  });

  it('an edition needs a real year', () => {
    expect(editionSchemas.create.safeParse({ body: { year: 26, name: 'DevFest' } }).success).toBe(false);
  });
});
