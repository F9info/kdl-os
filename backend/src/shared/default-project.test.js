import { describe, it, expect, vi } from 'vitest';
import { getDefaultProjectId } from './default-project.js';

const client = (...answers) => {
  const findFirst = vi.fn();
  for (const a of answers) findFirst.mockResolvedValueOnce(a);
  return { project: { findFirst } };
};

describe('getDefaultProjectId: one definition of "the default project"', () => {
  it('prefers the project flagged is_default (the one the admin UI uses)', async () => {
    const c = client({ id: 'flagged' });
    expect(await getDefaultProjectId(c)).toBe('flagged');
    expect(c.project.findFirst).toHaveBeenCalledTimes(1);
    expect(c.project.findFirst.mock.calls[0][0].where).toEqual({ deleted_at: null, is_default: true });
  });

  it("falls back to the project with slug 'default' when nothing is flagged", async () => {
    const c = client(null, { id: 'by-slug' });
    expect(await getDefaultProjectId(c)).toBe('by-slug');
    expect(c.project.findFirst.mock.calls[1][0].where).toEqual({ deleted_at: null, slug: 'default' });
  });

  it('null when there is no project at all; soft-deleted projects are never returned', async () => {
    const c = client(null, null);
    expect(await getDefaultProjectId(c)).toBeNull();
    for (const call of c.project.findFirst.mock.calls) expect(call[0].where.deleted_at).toBeNull();
  });
});
