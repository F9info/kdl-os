import { describe, it, expect, vi } from 'vitest';

vi.mock('./read.js', () => ({ readIdentity: vi.fn() }));

import { readIdentity } from './read.js';
import { getCompanyInfo } from './company-info.js';

const PROJECT_A = 'proj-AAAA';
const prisma = {};

// getCompanyInfo() reads Application Identity (the single source of company info), not the
// legacy brand-profile setting fields.
describe('getCompanyInfo', () => {
  it('maps Identity values onto the shape collateral/template-engine expect', async () => {
    readIdentity.mockResolvedValue({
      app_name: ' Acme Pvt Ltd ',
      contact_email: 'hello@acme.com',
      contact_phone: '+91-1234567890',
      contact_email_secondary: 'sales@acme.com',
      contact_phone_secondary: '0891-2722551',
      contact_address: '221B Baker Street\nMumbai',
    });
    expect(await getCompanyInfo(PROJECT_A)).toEqual({
      company_name: 'Acme Pvt Ltd',
      email: 'hello@acme.com',
      phone: '+91-1234567890',
      secondaryEmail: 'sales@acme.com',
      secondaryPhone: '0891-2722551',
      addressLines: ['221B Baker Street', 'Mumbai'],
    });
  });

  it('a one-line address stays one line', async () => {
    readIdentity.mockResolvedValue({ contact_address: '123 Main Street, City' });
    expect((await getCompanyInfo(PROJECT_A)).addressLines).toEqual(['123 Main Street, City']);
  });

  it('returns nulls/empty array when Identity has nothing yet', async () => {
    readIdentity.mockResolvedValue({ app_name: '', contact_email: '   ' });
    expect(await getCompanyInfo(PROJECT_A)).toEqual({
      company_name: null,
      email: null,
      phone: null,
      secondaryEmail: null,
      secondaryPhone: null,
      addressLines: [],
    });
  });

  it('does not touch the legacy brand-profile fields', async () => {
    readIdentity.mockResolvedValue({});
    prisma.settingField = { findMany: vi.fn() };
    await getCompanyInfo(PROJECT_A);
    expect(prisma.settingField.findMany).not.toHaveBeenCalled();
  });
});
