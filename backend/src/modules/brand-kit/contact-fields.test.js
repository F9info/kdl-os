import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { prisma } from '../../config/database.js';
import { getContactFields, saveContactFields, getCompanyInfo, CONTACT_FIELD_CATALOGUE } from './contact-fields.js';

const PROJECT_A = 'proj-AAAA';

function mockEmptyState() {
  prisma.type = {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'type-1', slug: `brand-intake.${PROJECT_A}` }),
  };
  prisma.settingField = {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: `field-${data.slug}`, ...data })),
  };
  prisma.settingValue = {
    findMany: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue({}),
  };
  prisma.$transaction = vi.fn((ops) => Promise.all(ops));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getContactFields — first call for a project (no rows yet)', () => {
  it('creates the Type + all 7 catalogue fields, owner_module scoped, and returns empty values', async () => {
    mockEmptyState();

    const result = await getContactFields(PROJECT_A);

    expect(prisma.type.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ owner_module: 'brand-kit' }) })
    );
    expect(prisma.settingField.create).toHaveBeenCalledTimes(CONTACT_FIELD_CATALOGUE.length);
    for (const call of prisma.settingField.create.mock.calls) {
      expect(call[0].data.owner_module).toBe('brand-kit');
      expect(call[0].data.input_type).toBe('textbox');
    }
    expect(result).toHaveLength(CONTACT_FIELD_CATALOGUE.length);
    expect(result.every((f) => f.value === '')).toBe(true);
  });

  it('is idempotent — a second call reuses existing rows, no new creates', async () => {
    mockEmptyState();
    await getContactFields(PROJECT_A); // first call creates everything

    // Second call: type + fields already exist
    prisma.type.findUnique = vi.fn().mockResolvedValue({ id: 'type-1', slug: `brand-intake.${PROJECT_A}` });
    prisma.settingField.findMany = vi.fn().mockResolvedValue(
      CONTACT_FIELD_CATALOGUE.map((c, i) => ({ id: `field-${i}`, slug: `brand-intake.${PROJECT_A}.${c.key}` }))
    );
    vi.clearAllMocks();
    prisma.type.findUnique = vi.fn().mockResolvedValue({ id: 'type-1', slug: `brand-intake.${PROJECT_A}` });
    prisma.settingField.findMany = vi.fn().mockResolvedValue(
      CONTACT_FIELD_CATALOGUE.map((c, i) => ({ id: `field-${i}`, slug: `brand-intake.${PROJECT_A}.${c.key}` }))
    );
    prisma.settingValue.findMany = vi.fn().mockResolvedValue([]);
    prisma.type.create = vi.fn();
    prisma.settingField.create = vi.fn();

    await getContactFields(PROJECT_A);

    expect(prisma.type.create).not.toHaveBeenCalled();
    expect(prisma.settingField.create).not.toHaveBeenCalled();
  });
});

describe('saveContactFields', () => {
  it('upserts a SettingValue per known key and ignores unknown keys', async () => {
    mockEmptyState();

    await saveContactFields(PROJECT_A, { company_name: 'Acme', bogus_key: 'x' }, 'user-1');

    expect(prisma.settingValue.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.settingValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ value: 'Acme', updated_by: 'user-1' }),
        update: expect.objectContaining({ value: 'Acme', updated_by: 'user-1' }),
      })
    );
  });
});

// getCompanyInfo() deliberately does NOT read the per-project
// brand-intake.${projectId} rows above — it reads the global `brand-profile-*`
// SettingField rows the Studio Intake stage's "Logo & Contact Details" form
// (IntakeStage.tsx) actually writes to, via GET/POST /setting-fields/*. The
// per-project rows were dead: nothing ever called their /contact routes, so
// every consumer (resolveWebsiteBrand, resolveBrandKit) silently fell back to
// "Your Brand" / no company info regardless of what the wizard saved.
describe('getCompanyInfo', () => {
  it('maps the global brand-profile SettingField values onto the shape collateral/template-engine expect', async () => {
    prisma.settingField = {
      findMany: vi.fn().mockResolvedValue([
        { slug: 'brand-profile-company-name', value: 'Acme Pvt Ltd' },
        { slug: 'brand-profile-primary-email', value: 'hello@acme.com' },
        { slug: 'brand-profile-primary-phone', value: '+91-1234567890' },
        { slug: 'brand-profile-address-1', value: '221B Baker Street' },
        { slug: 'brand-profile-address-2', value: 'Mumbai' },
      ]),
    };

    const info = await getCompanyInfo(PROJECT_A);

    expect(prisma.settingField.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: { in: expect.arrayContaining(['brand-profile-company-name']) } },
      })
    );
    expect(info).toEqual({
      company_name: 'Acme Pvt Ltd',
      email: 'hello@acme.com',
      phone: '+91-1234567890',
      secondaryEmail: null,
      secondaryPhone: null,
      addressLines: ['221B Baker Street', 'Mumbai'],
    });
  });

  it('returns nulls/empty array when the brand-profile fields have never been filled in', async () => {
    prisma.settingField = { findMany: vi.fn().mockResolvedValue([]) };

    const info = await getCompanyInfo(PROJECT_A);

    expect(info).toEqual({
      company_name: null,
      email: null,
      phone: null,
      secondaryEmail: null,
      secondaryPhone: null,
      addressLines: [],
    });
  });
});
