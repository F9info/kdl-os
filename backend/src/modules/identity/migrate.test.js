import { describe, it, expect, vi } from 'vitest';
import { planMigration, runMigration } from './migrate.js';

const empty = {};
const legacy = {
  'brand-profile-company-name': ' Acme Pvt Ltd ',
  'brand-profile-primary-email': 'hi@acme.com',
  'brand-profile-primary-phone': '+91 99999 00000',
  'brand-profile-address-1': '1 Main Rd',
  'brand-profile-address-2': 'Hyderabad',
  'brand-profile-secondary-email': 'b@acme.com',
  logo: 'settings/abc.png',
};

describe('planMigration', () => {
  it('maps every legacy field, joins addresses, seeds app_title', () => {
    const { patch, report } = planMigration(legacy, empty);
    expect(patch).toEqual({
      app_name: 'Acme Pvt Ltd',
      app_title: 'Acme Pvt Ltd',
      contact_email: 'hi@acme.com',
      contact_phone: '+91 99999 00000',
      contact_email_secondary: 'b@acme.com',
      contact_address: '1 Main Rd, Hyderabad',
      logo_light: 'settings/abc.png',
    });
    expect(report.unmapped).toEqual([]);
  });

  it('never overwrites a non-empty identity value', () => {
    const { patch, report } = planMigration(legacy, { app_name: 'Keep Me', logo_light: 'x/y.png' });
    expect(patch.app_name).toBeUndefined();
    expect(patch.logo_light).toBeUndefined();
    expect(report.skipped_existing).toEqual(expect.arrayContaining(['app_name', 'logo_light']));
    expect(patch.app_title).toBe('Acme Pvt Ltd'); // empty target still filled
  });

  it('skips invalid values with a reason instead of failing', () => {
    const { patch, report } = planMigration({ 'brand-profile-primary-email': 'not-an-email', logo: 'javascript:x' }, empty);
    expect(patch).toEqual({});
    expect(report.skipped_invalid).toEqual(expect.arrayContaining(['contact_email', 'logo_light']));
  });

  it('is idempotent: second run over migrated data copies nothing', () => {
    const first = planMigration(legacy, empty);
    const second = planMigration(legacy, first.patch);
    expect(second.patch).toEqual({});
  });

  it('handles empty/missing legacy data', () => {
    expect(planMigration({}, empty).patch).toEqual({});
  });
});

describe('runMigration', () => {
  const mk = (rows) => ({
    prisma: { settingField: { findMany: vi.fn(async () => rows) } },
    service: { getIdentity: vi.fn(async () => ({})), updateIdentity: vi.fn(async (p) => p) },
  });
  const rows = [{ slug: 'brand-profile-company-name', value: 'Acme' }];

  it('dry run writes nothing', async () => {
    const m = mk(rows);
    const r = await runMigration({ ...m, dry: true });
    expect(m.service.updateIdentity).not.toHaveBeenCalled();
    expect(r.after.app_name).toBe('Acme');
  });

  it('real run writes the patch once and never touches legacy rows', async () => {
    const m = mk(rows);
    await runMigration({ ...m });
    expect(m.service.updateIdentity).toHaveBeenCalledWith({ app_name: 'Acme', app_title: 'Acme' });
    expect(Object.keys(m.prisma.settingField)).toEqual(['findMany']);
  });
});
