import { describe, it, expect } from 'vitest';
import { createTeamMemberSchema, updateTeamMemberSchema } from './schema.js';

describe('team schema — optional photo', () => {
  const base = { name: 'Alex', role: 'Founder' };

  it('accepts a blank photo (form sends "") and stores null', () => {
    const r = createTeamMemberSchema.parse({ body: { ...base, photo_url: '' } });
    expect(r.body.photo_url).toBeNull();
  });

  it('accepts a missing photo', () => {
    expect(createTeamMemberSchema.parse({ body: base }).body.photo_url).toBeNull();
  });

  it('keeps a real photo address', () => {
    const r = createTeamMemberSchema.parse({ body: { ...base, photo_url: '/a.png' } });
    expect(r.body.photo_url).toBe('/a.png');
  });

  it('update also accepts a blank photo', () => {
    const r = updateTeamMemberSchema.parse({ params: { id: 'x' }, body: { photo_url: '' } });
    expect(r.body.photo_url).toBeNull();
  });
});
