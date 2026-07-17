import { describe, it, expect } from 'vitest';
import {
  updateTemplateSchema,
  updateCategorySchema,
  updatePreferencesSchema,
  broadcastSchema,
} from './schema.js';

describe('notifications schemas — mass-assignment whitelist (KDL-270 M14)', () => {
  it('updateTemplateSchema rejects unknown columns', () => {
    const result = updateTemplateSchema.safeParse({
      params: { id: 'tpl-1' },
      body: { name: 'ok', id: 'evil', created_at: '1970-01-01' },
    });
    expect(result.success).toBe(false);
  });

  it('updateTemplateSchema accepts whitelisted fields only', () => {
    const result = updateTemplateSchema.safeParse({
      params: { id: 'tpl-1' },
      body: { name: 'Welcome v2', is_active: false, email_subject: null },
    });
    expect(result.success).toBe(true);
    expect(result.data.body).toEqual({ name: 'Welcome v2', is_active: false, email_subject: null });
  });

  it('updateCategorySchema rejects is_system', () => {
    const result = updateCategorySchema.safeParse({
      params: { id: 'cat-1' },
      body: { name: 'ok', is_system: true },
    });
    expect(result.success).toBe(false);
  });

  it('updatePreferencesSchema rejects non-enum channels and extra keys', () => {
    expect(updatePreferencesSchema.safeParse({
      body: { preferences: [{ category_id: 'c1', channel: 'CARRIER_PIGEON', enabled: true }] },
    }).success).toBe(false);

    expect(updatePreferencesSchema.safeParse({
      body: { preferences: [{ category_id: 'c1', channel: 'EMAIL', enabled: true, user_id: 'other' }] },
    }).success).toBe(false);

    expect(updatePreferencesSchema.safeParse({
      body: { preferences: [{ category_id: 'c1', channel: 'EMAIL', enabled: true }] },
    }).success).toBe(true);
  });

  it('broadcastSchema accepts a valid inline broadcast and rejects unknown keys', () => {
    expect(broadcastSchema.safeParse({
      body: { to: { all: true }, inline: { title: 'Hi', body: 'There' }, channels: ['IN_APP'] },
    }).success).toBe(true);

    expect(broadcastSchema.safeParse({
      body: { to: { all: true }, inline: { title: 'Hi', body: 'There' }, admin: true },
    }).success).toBe(false);
  });
});
