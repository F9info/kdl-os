import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../config/redis.js', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import * as service from './service.js';

function setup(rows, platform = 'webapp') {
  vi.clearAllMocks();
  redis.get.mockResolvedValue(null);
  redis.set.mockResolvedValue('OK');
  redis.del.mockResolvedValue(1);
  prisma.type = {
    findMany: vi.fn().mockResolvedValue([{ id: 'type-1', slug: `${platform}.buttons`, name: 'Buttons' }]),
  };
  prisma.settingField = { findMany: vi.fn().mockResolvedValue([]) };
  prisma.appSetting = {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue(rows),
    upsert: vi.fn().mockResolvedValue({}),
  };
}

describe('the chosen website styles in the compiled tokens', () => {
  it('are appended to the css of both website platforms', async () => {
    setup([
      { key: 'theme_engine.site_style.button', value: 'pill' },
      { key: 'theme_engine.site_style.form', value: 'underline' },
    ]);
    for (const platform of ['webapp', 'webapp_admin']) {
      const { css } = await service.compileTokens(platform);
      expect(css).toContain('website button style: pill, form field style: underline');
      expect(css).toContain('border-radius: 9999px');
    }
  });

  it('use the defaults when nothing was chosen, and ignore a stored value that no longer exists', async () => {
    setup([{ key: 'theme_engine.site_style.button', value: 'retired-style' }]);
    const { css } = await service.compileTokens('webapp');
    expect(css).toContain('website button style: solid, form field style: outlined');
  });

  it('leave the native platforms alone', async () => {
    setup([], 'tv');
    const { css } = await service.compileTokens('tv');
    expect(css).not.toContain('.kdl-site');
  });
});

describe('setSiteStyles', () => {
  it("stores only what was sent and clears both websites' cached tokens", async () => {
    setup([{ key: 'theme_engine.site_style.button', value: 'hard' }]);
    const saved = await service.setSiteStyles({ button: 'hard' });
    expect(prisma.appSetting.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.appSetting.upsert.mock.calls[0][0].where.key).toBe('theme_engine.site_style.button');
    const cleared = redis.del.mock.calls.map((c) => c[0]);
    expect(cleared.some((k) => k.startsWith('th:tokens:webapp:'))).toBe(true);
    expect(cleared.some((k) => k.startsWith('th:tokens:webapp_admin:'))).toBe(true);
    expect(saved).toEqual({ button: 'hard', form: 'outlined' });
  });

  it('refuses an unknown style and stores nothing', async () => {
    setup([]);
    const result = await service.setSiteStyles({ button: 'neon', form: 'glow' });
    expect(result.errors).toHaveLength(1);
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('reads the saved choice back, with defaults for anything not saved', async () => {
    setup([{ key: 'theme_engine.site_style.form', value: 'glow' }]);
    expect(await service.getSiteStyles()).toEqual({ button: 'solid', form: 'glow' });
  });
});
