import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    teamMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from '../src/config/database.js';
import {
  listTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
} from '../src/modules/team/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

beforeEach(() => vi.clearAllMocks());

describe('team service — listTeamMembers', () => {
  it('returns all members ordered by order asc', async () => {
    const rows = [{ id: 'm1', name: 'Alice', role: 'Dev', is_active: true }];
    prismaMock.teamMember.findMany.mockResolvedValue(rows);

    const result = await listTeamMembers({});

    expect(prismaMock.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
    expect(result).toEqual(rows);
  });

  it('filters by project_id when supplied', async () => {
    prismaMock.teamMember.findMany.mockResolvedValue([]);

    await listTeamMembers({ project_id: 'proj1' });

    expect(prismaMock.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ project_id: 'proj1' }) })
    );
  });

  it('filters by is_active when passed as string "true"', async () => {
    prismaMock.teamMember.findMany.mockResolvedValue([]);

    await listTeamMembers({ is_active: 'true' });

    expect(prismaMock.teamMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_active: true }) })
    );
  });
});

describe('team service — getTeamMemberById', () => {
  it('returns null when member not found', async () => {
    prismaMock.teamMember.findUnique.mockResolvedValue(null);
    expect(await getTeamMemberById('missing')).toBeNull();
  });

  it('returns the member when found', async () => {
    const member = { id: 'm1', name: 'Alice', role: 'Lead Dev' };
    prismaMock.teamMember.findUnique.mockResolvedValue(member);
    expect(await getTeamMemberById('m1')).toEqual(member);
  });
});

describe('team service — createTeamMember', () => {
  it('creates a team member', async () => {
    const created = { id: 'm1', name: 'Bob', role: 'Designer', is_active: true };
    prismaMock.teamMember.create.mockResolvedValue(created);

    const result = await createTeamMember({ name: 'Bob', role: 'Designer' });

    expect(prismaMock.teamMember.create).toHaveBeenCalledWith({ data: { name: 'Bob', role: 'Designer' } });
    expect(result).toEqual(created);
  });
});

describe('team service — updateTeamMember', () => {
  it('returns null when member not found', async () => {
    prismaMock.teamMember.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateTeamMember('missing', { name: 'X' })).toBeNull();
  });

  it('returns updated member when found', async () => {
    prismaMock.teamMember.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: 'm1', name: 'Updated' };
    prismaMock.teamMember.findUnique.mockResolvedValue(updated);

    expect(await updateTeamMember('m1', { name: 'Updated' })).toEqual(updated);
  });
});

describe('team service — deleteTeamMember', () => {
  it('returns false when member not found', async () => {
    prismaMock.teamMember.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteTeamMember('missing')).toBe(false);
  });

  it('returns true when member deleted', async () => {
    prismaMock.teamMember.deleteMany.mockResolvedValue({ count: 1 });
    expect(await deleteTeamMember('m1')).toBe(true);
  });
});
