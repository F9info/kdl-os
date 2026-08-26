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

describe('getCompanyInfo', () => {
  it('maps stored field values onto the shape collateral render layouts expect', async () => {
    mockEmptyState();
    const fields = CONTACT_FIELD_CATALOGUE.map((c, i) => ({ id: `field-${i}`, slug: `brand-intake.${PROJECT_A}.${c.key}` }));
    prisma.type.findUnique = vi.fn().mockResolvedValue({ id: 'type-1', slug: `brand-intake.${PROJECT_A}` });
    prisma.settingField.findMany = vi.fn().mockResolvedValue(fields);
    prisma.settingValue.findMany = vi.fn().mockResolvedValue([
      { field_id: 'field-0', value: 'Acme Pvt Ltd' }, // company_name
      { field_id: 'field-1', value: 'hello@acme.com' }, // primary_email
      { field_id: 'field-3', value: '+91-1234567890' }, // primary_phone
      { field_id: 'field-5', value: '221B Baker Street' }, // address1
      { field_id: 'field-6', value: 'Mumbai' }, // address2
    ]);

    const info = await getCompanyInfo(PROJECT_A);

    expect(info).toEqual({
      company_name: 'Acme Pvt Ltd',
      email: 'hello@acme.com',
      phone: '+91-1234567890',
      addressLines: ['221B Baker Street', 'Mumbai'],
    });
  });

  it('returns nulls/empty array when nothing has been saved yet', async () => {
    mockEmptyState();

    const info = await getCompanyInfo(PROJECT_A);

    expect(info).toEqual({ company_name: null, email: null, phone: null, addressLines: [] });
  });
});
