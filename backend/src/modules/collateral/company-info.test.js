/**
 * resolveBrandKit() — company.email/phone/addressLines wiring (KDL-558 row 1).
 * Isolated from collateral.test.js so mocking ../brand-kit/contact-fields.js
 * here can't affect that file's existing (unmocked-contact-fields) assertions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
  prisma: {
    brandKit: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
  },
}));
vi.mock('../brand-kit/contact-fields.js', () => ({
  getCompanyInfo: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { getCompanyInfo } from '../brand-kit/contact-fields.js';
import { resolveBrandKit } from './service.js';

const LIVE_ROW = {
  logo_media_id: 'logo-media-1',
  palette: { colors: { primary: { hex: '#1a73e8' }, neutral: { hex: '#f1f3f4' } } },
  typography: { heading: { family: 'Inter' }, body: { family: 'Inter' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.brandKit.findUnique.mockResolvedValue(LIVE_ROW);
  prisma.project.findUnique.mockResolvedValue({ id: 'proj-1', name: 'Acme Pvt Ltd' });
});

describe('resolveBrandKit() — contact fields populated', () => {
  it('maps email/phone/addressLines from getCompanyInfo, and prefers contact company_name over project.name', async () => {
    getCompanyInfo.mockResolvedValue({
      company_name: 'Acme Global Pvt Ltd',
      email: 'hello@acme.com',
      phone: '+91-1234567890',
      addressLines: ['221B Baker Street', 'Mumbai'],
    });

    const kit = await resolveBrandKit('proj-1');

    expect(kit.company).toEqual({
      displayName: 'Acme Global Pvt Ltd',
      legalName: 'Acme Global Pvt Ltd',
      email: 'hello@acme.com',
      phone: '+91-1234567890',
      addressLines: ['221B Baker Street', 'Mumbai'],
    });
  });

  it('falls back to project.name when no contact fields have been saved yet', async () => {
    getCompanyInfo.mockResolvedValue({ company_name: null, email: null, phone: null, addressLines: [] });

    const kit = await resolveBrandKit('proj-1');

    expect(kit.company.displayName).toBe('Acme Pvt Ltd');
    expect(kit.company.legalName).toBe('Acme Pvt Ltd');
    expect(kit.company.email).toBeUndefined();
    expect(kit.company.addressLines).toBeUndefined();
  });

  it('does not hard-fail the render when getCompanyInfo throws', async () => {
    getCompanyInfo.mockRejectedValue(new Error('db down'));

    const kit = await resolveBrandKit('proj-1');

    expect(kit).not.toBeNull();
    expect(kit.company.displayName).toBe('Acme Pvt Ltd');
  });
});
