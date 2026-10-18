/**
 * Issue 9 — per-project website copy. Vision/Mission/tagline live in
 * SettingField.value (global). A ProjectSettingValue row overrides it for one
 * project only; no row = inherit global. These pin read precedence, write
 * isolation, and that the global value is never touched in project mode.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  settingField: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  projectSettingValue: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (ops) => ops),
}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../template-engine/site/queue.js', () => ({
  enqueueAllSiteBuilds: vi.fn(),
  enqueueSiteBuild: vi.fn(),
}));
vi.mock('../../shared/services/storage.service.js', () => ({}));

import { getValuesBySlugs, saveValues, getFieldsForType } from './service.js';
import { enqueueAllSiteBuilds, enqueueSiteBuild } from '../template-engine/site/queue.js';

const FIELDS = [
  { id: 'f-vision', slug: 'vision-heading', value: 'Global vision', input_type: 'text' },
  { id: 'f-tag', slug: 'tagline-text', value: 'Global tagline', input_type: 'text' },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.settingField.findMany.mockResolvedValue(FIELDS);
  prismaMock.projectSettingValue.findMany.mockResolvedValue([]);
});

describe('getValuesBySlugs', () => {
  it('without a project returns global values and never queries overrides', async () => {
    const v = await getValuesBySlugs(['vision-heading', 'tagline-text']);
    expect(v).toEqual({ 'vision-heading': 'Global vision', 'tagline-text': 'Global tagline' });
    expect(prismaMock.projectSettingValue.findMany).not.toHaveBeenCalled();
  });

  it('a project override wins; other fields inherit the global value', async () => {
    prismaMock.projectSettingValue.findMany.mockResolvedValue([
      { field_id: 'f-vision', value: 'Project A vision' },
    ]);
    const v = await getValuesBySlugs(['vision-heading', 'tagline-text'], 'proj-A');
    expect(v).toEqual({ 'vision-heading': 'Project A vision', 'tagline-text': 'Global tagline' });
    expect(prismaMock.projectSettingValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project_id: 'proj-A', field_id: { in: ['f-vision', 'f-tag'] } } })
    );
  });

  it('two projects see different copy (the isolation gap)', async () => {
    prismaMock.projectSettingValue.findMany
      .mockResolvedValueOnce([{ field_id: 'f-tag', value: 'A tagline' }])
      .mockResolvedValueOnce([{ field_id: 'f-tag', value: 'B tagline' }]);
    expect((await getValuesBySlugs(['tagline-text'], 'proj-A'))['tagline-text']).toBe('A tagline');
    expect((await getValuesBySlugs(['tagline-text'], 'proj-B'))['tagline-text']).toBe('B tagline');
  });

  it('unknown slugs are skipped, null global value becomes empty string', async () => {
    prismaMock.settingField.findMany.mockResolvedValue([
      { id: 'f1', slug: 'a', value: null, input_type: 'text' },
    ]);
    expect(await getValuesBySlugs(['a', 'typo'])).toEqual({ a: '' });
  });
});

describe('saveValues', () => {
  beforeEach(() => {
    prismaMock.settingField.findMany.mockResolvedValue([
      ...FIELDS,
      { id: 'f-head', slug: 'h', value: null, input_type: 'heading' },
    ]);
  });

  it('project mode upserts overrides and NEVER writes the global field', async () => {
    const n = await saveValues(
      'type-1',
      [
        { id: 'f-vision', value: 'New vision' },
        { id: 'f-head', value: 'ignored' },
        { id: 'nope', value: 'ignored' },
      ],
      { projectId: 'proj-A', userId: 'u1' }
    );
    expect(n).toBe(1);
    expect(prismaMock.settingField.update).not.toHaveBeenCalled();
    expect(prismaMock.projectSettingValue.upsert).toHaveBeenCalledWith({
      where: { project_id_field_id: { project_id: 'proj-A', field_id: 'f-vision' } },
      create: { project_id: 'proj-A', field_id: 'f-vision', value: 'New vision', updated_by: 'u1' },
      update: { value: 'New vision', updated_by: 'u1' },
    });
    expect(enqueueSiteBuild).toHaveBeenCalledWith('proj-A');
    expect(enqueueAllSiteBuilds).not.toHaveBeenCalled();
  });

  it('project mode: an empty value deletes the override (inherit global again)', async () => {
    await saveValues('type-1', [{ id: 'f-tag', value: '' }], { projectId: 'proj-A' });
    expect(prismaMock.projectSettingValue.deleteMany).toHaveBeenCalledWith({
      where: { project_id: 'proj-A', field_id: 'f-tag' },
    });
    expect(prismaMock.projectSettingValue.upsert).not.toHaveBeenCalled();
  });

  it('without a project it still writes the global value, unchanged behaviour', async () => {
    await saveValues('type-1', [{ id: 'f-vision', value: 'G' }]);
    expect(prismaMock.settingField.update).toHaveBeenCalledWith({
      where: { id: 'f-vision' },
      data: { value: 'G', alt_text: null },
    });
    expect(prismaMock.projectSettingValue.upsert).not.toHaveBeenCalled();
    expect(enqueueAllSiteBuilds).toHaveBeenCalled();
  });
});

describe('getFieldsForType', () => {
  it('overlays overrides and flags which fields are overridden', async () => {
    prismaMock.projectSettingValue.findMany.mockResolvedValue([
      { field_id: 'f-vision', value: 'Project vision' },
    ]);
    const out = await getFieldsForType('type-1', 'proj-A');
    const vision = out.find((f) => f.id === 'f-vision');
    const tag = out.find((f) => f.id === 'f-tag');
    expect(vision).toMatchObject({ value: 'Project vision', has_project_override: true });
    expect(tag).toMatchObject({ value: 'Global tagline', has_project_override: false });
  });

  it('without a project, fields are returned as before (no flag)', async () => {
    const out = await getFieldsForType('type-1');
    expect(out[0]).not.toHaveProperty('has_project_override');
  });
});
