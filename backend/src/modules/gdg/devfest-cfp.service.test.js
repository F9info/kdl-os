import { describe, it, expect, vi, beforeEach } from 'vitest';

const model = () => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
});
const prismaMock = vi.hoisted(() => ({}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
const savePhoto = vi.hoisted(() => vi.fn(async () => '/api/gdg/public/images/p.jpg'));
const dropImage = vi.hoisted(() => vi.fn(async () => true));
vi.mock('./images.js', () => ({ savePhoto, dropImage, keepImage: async (u) => u }));

const cfp = await import('./devfest-cfp.service.js');
const { publicProposalSchema } = await import('./devfest.schema.js');

const future = new Date(Date.now() + 7 * 86_400_000);
const past = new Date(Date.now() - 86_400_000);
const edition = (over = {}) => ({
  id: 'e26',
  project_id: 'p1',
  name: 'DevFest Vizag 2026',
  cfp_open: true,
  cfp_closes: future,
  tracks: [{ name: 'Web' }, { name: 'Cloud' }],
  ...over,
});
const photo = { buffer: Buffer.from('x') };
const proposal = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  bio: 'Android engineer who has shipped apps used by a million people.',
  title: 'Shipping Compose at scale',
  abstract: 'x'.repeat(100),
  format: 'talk',
  track: 'Web',
  first_time: false,
  consent: true,
};

beforeEach(() => {
  for (const k of ['devfestEdition', 'devfestProposal', 'devfestSpeaker', 'devfestSession']) prismaMock[k] = model();
  prismaMock.$transaction = vi.fn(async (fn) => fn(prismaMock));
  prismaMock.devfestEdition.findFirst.mockResolvedValue(edition());
  prismaMock.devfestProposal.count.mockResolvedValue(0);
  prismaMock.devfestProposal.create.mockImplementation(async ({ data }) => ({ id: 'pr1', ...data }));
});

describe('sending a proposal', () => {
  it('saves it for the current edition without the consent and trap fields', async () => {
    expect(await cfp.submitProposal('p1', { ...proposal, company_site: '' }, photo)).toEqual({ id: 'pr1' });
    const data = prismaMock.devfestProposal.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ edition_id: 'e26', project_id: 'p1', title: proposal.title });
    expect(data).not.toHaveProperty('consent');
    expect(data).not.toHaveProperty('company_site');
  });

  it('stores the photo only after the checks pass', async () => {
    await cfp.submitProposal('p1', proposal, { buffer: Buffer.from('x') });
    expect(prismaMock.devfestProposal.create.mock.calls[0][0].data.photo_url).toBe('/api/gdg/public/images/p.jpg');
    prismaMock.devfestProposal.count.mockResolvedValue(3);
    savePhoto.mockClear();
    await expect(cfp.submitProposal('p1', proposal, { buffer: Buffer.from('x') })).rejects.toMatchObject({ status: 429 });
    expect(savePhoto).not.toHaveBeenCalled();
  });

  it('quietly drops a bot that filled the hidden field', async () => {
    expect(await cfp.submitProposal('p1', { ...proposal, company_site: 'http://spam' })).toEqual({ ignored: true });
    expect(prismaMock.devfestProposal.create).not.toHaveBeenCalled();
  });

  it('needs a photo', async () => {
    await expect(cfp.submitProposal('p1', proposal)).rejects.toMatchObject({ status: 400 });
    expect(prismaMock.devfestProposal.create).not.toHaveBeenCalled();
  });

  it('is refused when the call is switched off or past its closing time', async () => {
    prismaMock.devfestEdition.findFirst.mockResolvedValue(edition({ cfp_open: false }));
    await expect(cfp.submitProposal('p1', proposal, photo)).rejects.toMatchObject({ status: 403 });
    prismaMock.devfestEdition.findFirst.mockResolvedValue(edition({ cfp_closes: past }));
    await expect(cfp.submitProposal('p1', proposal, photo)).rejects.toMatchObject({ status: 403 });
  });

  it('needs one of the edition tracks', async () => {
    await expect(cfp.submitProposal('p1', { ...proposal, track: 'Gardening' }, photo)).rejects.toMatchObject({ status: 400 });
  });

  it('takes at most three proposals per email', async () => {
    prismaMock.devfestProposal.count.mockResolvedValue(3);
    await expect(cfp.submitProposal('p1', proposal, photo)).rejects.toMatchObject({ status: 429 });
  });
});

describe('reviewing', () => {
  const saved = { id: 'pr1', project_id: 'p1', edition_id: 'e26', ...proposal, linkedin: 'https://linkedin.com/in/asha', website: null, role: 'Engineer', company: 'Acme', level: 'Intermediate', photo_url: null, speaker_id: null };

  it('accepting adds a hidden speaker and session and links them', async () => {
    prismaMock.devfestProposal.findUnique.mockResolvedValue(saved);
    prismaMock.devfestSpeaker.findMany.mockResolvedValue([]);
    prismaMock.devfestSession.findMany.mockResolvedValue([]);
    prismaMock.devfestSpeaker.create.mockResolvedValue({ id: 'sp1' });
    prismaMock.devfestSession.create.mockResolvedValue({ id: 'se1' });
    prismaMock.devfestProposal.update.mockImplementation(async ({ data }) => ({ ...saved, ...data }));
    const item = await cfp.acceptProposal('pr1', 'u1');
    expect(item).toMatchObject({ status: 'accepted', speaker_id: 'sp1', session_id: 'se1' });
    const speaker = prismaMock.devfestSpeaker.create.mock.calls[0][0].data;
    expect(speaker).toMatchObject({ slug: 'asha-rao', is_visible: false, links: { LinkedIn: saved.linkedin } });
    const session = prismaMock.devfestSession.create.mock.calls[0][0].data;
    expect(session).toMatchObject({ kind: 'talk', track: 'Web', speaker_ids: ['sp1'], is_visible: false });
  });

  it('cannot accept twice, or mark accepted without creating the speaker', async () => {
    prismaMock.devfestProposal.findUnique.mockResolvedValue({ ...saved, speaker_id: 'sp1' });
    await expect(cfp.acceptProposal('pr1', 'u1')).rejects.toMatchObject({ status: 409 });
    await expect(cfp.updateProposal('pr1', { status: 'rejected' }, 'u1')).rejects.toMatchObject({ status: 409 });
    prismaMock.devfestProposal.findUnique.mockResolvedValue(saved);
    await expect(cfp.updateProposal('pr1', { status: 'accepted' }, 'u1')).rejects.toMatchObject({ status: 400 });
  });
});

describe('deleting a proposal', () => {
  const sent = { id: 'pr1', title: 'T', photo_url: '/api/gdg/public/images/p.jpg' };

  it('deletes its photo too', async () => {
    prismaMock.devfestProposal.findUnique.mockResolvedValue(sent);
    prismaMock.devfestSpeaker.count.mockResolvedValue(0);
    expect(await cfp.removeProposal('pr1', 'u1')).toBe(true);
    expect(dropImage).toHaveBeenCalledWith(sent.photo_url);
  });

  it('keeps the photo while an accepted speaker shows it', async () => {
    dropImage.mockClear();
    prismaMock.devfestProposal.findUnique.mockResolvedValue(sent);
    prismaMock.devfestSpeaker.count.mockResolvedValue(1);
    await cfp.removeProposal('pr1', 'u1');
    expect(dropImage).not.toHaveBeenCalled();
  });
});

describe('the public form schema', () => {
  const parse = (body) => publicProposalSchema.safeParse({ body });

  it('needs consent, a real email and enough detail', () => {
    expect(parse(proposal).success).toBe(true);
    expect(parse({ ...proposal, consent: false }).success).toBe(false);
    expect(parse({ ...proposal, email: 'nope' }).success).toBe(false);
    expect(parse({ ...proposal, abstract: 'too short' }).success).toBe(false);
    expect(parse({ ...proposal, linkedin: 'linkedin.com/in/x' }).success).toBe(false);
  });

  it('stores the email in lowercase', () => {
    expect(parse({ ...proposal, email: 'Asha@Example.COM' }).data.body.email).toBe('asha@example.com');
  });
});

describe('open or closed', () => {
  it('is open only with the switch on and before the closing time', () => {
    expect(cfp.isCfpOpen(edition())).toBe(true);
    expect(cfp.isCfpOpen(edition({ cfp_closes: null }))).toBe(true);
    expect(cfp.isCfpOpen(edition({ cfp_open: false }))).toBe(false);
    expect(cfp.isCfpOpen(edition({ cfp_closes: past }))).toBe(false);
  });
});
