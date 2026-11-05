import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

// Ownership rules of the logo (audit): only the DEFAULT project's logo is the company logo; every
// other project has its own; a project without one starts from the company's (Identity).
const h = vi.hoisted(() => ({
  prisma: {
    brandKit: { findUnique: vi.fn(), upsert: vi.fn() },
    media: { update: vi.fn() },
  },
  uploadMedia: vi.fn(),
  setGlobalLogo: vi.fn(),
  defaultProject: vi.fn(),
  readIdentity: vi.fn(),
  storage: { uploadFile: vi.fn(), getFileStream: vi.fn(), deleteFile: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../media/service.js', () => ({ uploadMedia: h.uploadMedia }));
vi.mock('../media/settings.js', () => ({ getUploadSettings: vi.fn() }));
vi.mock('../media/media.queue.js', () => ({ enqueueScanJob: vi.fn() }));
vi.mock('../../shared/services/storage.service.js', () => h.storage);
vi.mock('../setting-fields/service.js', () => ({ setGlobalLogo: h.setGlobalLogo }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));
vi.mock('../../shared/default-project.js', () => ({ getDefaultProjectId: h.defaultProject }));
vi.mock('../identity/read.js', () => ({ readIdentity: h.readIdentity }));
vi.mock('./ai-client.js', () => ({
  aiServicesConfigured: vi.fn(() => false),
  requestBrandInference: vi.fn(),
}));
vi.mock('../credits/service.js', () => ({ withCreditHold: vi.fn() }));

const { uploadLogo, adoptIdentityLogo } = await import('./service.js');

const png = async () =>
  sharp({ create: { width: 128, height: 128, channels: 3, background: '#336699' } })
    .png()
    .toBuffer();
const file = async () => {
  const buffer = await png();
  return { buffer, size: buffer.length, mimetype: 'image/png', originalname: 'l.png' };
};

beforeEach(async () => {
  vi.clearAllMocks();
  h.defaultProject.mockResolvedValue('default-proj');
  h.prisma.brandKit.findUnique.mockResolvedValue(null);
  h.prisma.brandKit.upsert.mockResolvedValue({ id: 'kit' });
  h.prisma.media.update.mockResolvedValue({});
  h.uploadMedia.mockResolvedValue({ id: 'm1', path: 'media/new-logo.png' });
  h.setGlobalLogo.mockResolvedValue(undefined);
});

describe('who owns the company logo', () => {
  it('the DEFAULT project: its logo becomes the company logo', async () => {
    await uploadLogo('default-proj', await file(), 'u1');
    expect(h.setGlobalLogo).toHaveBeenCalledWith('media/new-logo.png');
  });

  it('another project: its logo is its own and the company logo is NOT touched', async () => {
    await uploadLogo('other-proj', await file(), 'u1');
    expect(h.setGlobalLogo).not.toHaveBeenCalled();
    expect(h.prisma.brandKit.upsert).toHaveBeenCalled(); // the project's kit still gets the logo
  });
});

describe('adoptIdentityLogo (company logo -> a project with no logo)', () => {
  const stream = (buf) =>
    (async function* () {
      yield buf;
    })();

  it('re-reads the Identity logo from storage and uploads it as the project logo', async () => {
    h.readIdentity.mockResolvedValue({ logo_light: 'media/company.png' });
    h.storage.getFileStream.mockResolvedValue(stream(await png()));
    expect(await adoptIdentityLogo('other-proj', 'u1')).toBe(true);
    expect(h.storage.getFileStream).toHaveBeenCalledWith('media/company.png');
    expect(h.prisma.brandKit.upsert.mock.calls[0][0].where).toMatchObject({ project_id: 'other-proj' });
    expect(h.setGlobalLogo).not.toHaveBeenCalled(); // not the default project: Identity is not rewritten
  });

  it('nothing to adopt: no Identity logo, a URL, or an unsupported type', async () => {
    for (const logo_light of ['', 'https://x.test/l.png', '/l.png', 'media/l.gif']) {
      h.readIdentity.mockResolvedValue({ logo_light });
      expect(await adoptIdentityLogo('p', 'u')).toBe(false);
    }
    expect(h.storage.getFileStream).not.toHaveBeenCalled();
  });

  it('a stored file that fails the logo checks surfaces as an error the intake driver swallows', async () => {
    h.readIdentity.mockResolvedValue({ logo_light: 'media/tiny.png' });
    const tiny = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    h.storage.getFileStream.mockResolvedValue(stream(tiny));
    await expect(adoptIdentityLogo('p', 'u')).rejects.toMatchObject({ status: 422 });
  });
});
