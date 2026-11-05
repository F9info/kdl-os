import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  prisma: {
    appSetting: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction: vi.fn(async (ops) => Promise.all(ops)),
  },
  redis: { get: vi.fn(async () => null), set: vi.fn(), del: vi.fn(async () => 1) },
  storage: { uploadFile: vi.fn(), getFileUrl: vi.fn(async (p) => `https://signed/${p}`) },
  moduleStatus: vi.fn(),
  defaultProject: vi.fn(),
  uploadLogo: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../../config/redis.js', () => ({ redis: h.redis }));
vi.mock('../../shared/services/storage.service.js', () => h.storage);
vi.mock('../../middleware/module-gate.js', () => ({ getModuleStatus: h.moduleStatus }));
vi.mock('../../shared/default-project.js', () => ({ getDefaultProjectId: h.defaultProject }));
vi.mock('../brand-kit/service.js', () => ({ uploadLogo: h.uploadLogo }));

const { uploadAsset } = await import('./service.js');
const { updateIdentitySchema } = await import('./schema.js');
const { readIdentity } = await import('./read.js');

const png = { mimetype: 'image/png', size: 1000, buffer: Buffer.from('x'), originalname: 'l.png' };

beforeEach(() => {
  vi.clearAllMocks();
  h.moduleStatus.mockResolvedValue('ENABLED');
  h.defaultProject.mockResolvedValue('proj1');
  h.prisma.appSetting.findMany.mockResolvedValue([]);
});

describe('company contact fields live in Identity', () => {
  const parse = (body) => updateIdentitySchema.safeParse({ body });
  it('secondary email and phone are accepted, validated, and can be cleared', () => {
    expect(
      parse({ contact_email_secondary: 'sales@acme.com', contact_phone_secondary: '0891-2722551 / 2' })
        .success
    ).toBe(true);
    expect(parse({ contact_email_secondary: '', contact_phone_secondary: '' }).success).toBe(true);
    expect(parse({ contact_email_secondary: 'nope' }).success).toBe(false);
    expect(parse({ contact_phone_secondary: 'x'.repeat(61) }).success).toBe(false);
  });

  it('readIdentity returns only whitelisted keys, empty string for unset ones', async () => {
    h.prisma.appSetting.findMany.mockResolvedValue([
      { key: 'identity.app_name', value: 'Acme' },
      { key: 'identity.contact_phone_secondary', value: '123' },
      { key: 'identity.secret_thing', value: 'leak' },
    ]);
    const id = await readIdentity();
    expect(id).toMatchObject({ app_name: 'Acme', contact_phone_secondary: '123', contact_email: '' });
    expect(id).not.toHaveProperty('secret_thing');
  });
});

describe('logo upload goes through the brand kit when it is on', () => {
  it('asset=logo_light: brand kit uploads it, and the Identity logo it wrote is returned', async () => {
    h.uploadLogo.mockResolvedValue({});
    h.prisma.appSetting.findMany.mockResolvedValue([{ key: 'identity.logo_light', value: 'media/abc.png' }]);
    const r = await uploadAsset(png, { asset: 'logo_light', userId: 'u1' });
    expect(h.uploadLogo).toHaveBeenCalledWith('proj1', png, 'u1');
    expect(r).toEqual({ path: 'media/abc.png', url: 'https://signed/media/abc.png' });
    expect(h.storage.uploadFile).not.toHaveBeenCalled();
  });

  it('brand-kit validation errors (too small, bad type) reach the caller with their status', async () => {
    h.uploadLogo.mockRejectedValue(
      Object.assign(new Error('Logo short edge must be ≥ 64px'), { status: 422 })
    );
    await expect(uploadAsset(png, { asset: 'logo_light' })).rejects.toMatchObject({ status: 422 });
  });

  it('brand kit off, or another asset (favicon, dark logo): the plain image upload', async () => {
    h.moduleStatus.mockResolvedValue('DISABLED');
    const a = await uploadAsset(png, { asset: 'logo_light' });
    expect(a.path).toMatch(/^identity\/.+\.png$/);
    h.moduleStatus.mockResolvedValue('ENABLED');
    const b = await uploadAsset(png, { asset: 'favicon' });
    expect(b.path).toMatch(/^identity\//);
    expect(h.uploadLogo).not.toHaveBeenCalled();
  });

  it('the plain upload still rejects SVG and oversize files', async () => {
    await expect(uploadAsset({ ...png, mimetype: 'image/svg+xml' })).rejects.toMatchObject({ status: 400 });
    await expect(uploadAsset({ ...png, size: 3 * 1024 * 1024 })).rejects.toMatchObject({ status: 400 });
  });
});
