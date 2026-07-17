import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { PLATFORMS, PLAT_TABS, BASE_TABS, slug } from './schema/index.js';
import { buildSeedRows } from './seed.js';

describe('template-engine schema build (A2 gate)', () => {
  it('builds all 5 platforms', () => {
    expect(PLATFORMS.map((p) => p.id)).toEqual(['webapp', 'webapp_admin', 'tv', 'android', 'ios']);
    for (const p of PLATFORMS) {
      expect(PLAT_TABS[p.id]).toBeDefined();
      expect(PLAT_TABS[p.id].length).toBeGreaterThan(0);
    }
  });

  it('pane counts = webapp 11 / webapp_admin 11 / tv 37 / android 20 / ios 18', () => {
    expect(PLAT_TABS.webapp.length).toBe(11);
    expect(PLAT_TABS.webapp_admin.length).toBe(11);
    expect(PLAT_TABS.tv.length).toBe(37);
    expect(PLAT_TABS.android.length).toBe(20);
    expect(PLAT_TABS.ios.length).toBe(18);
  });

  it('webapp panes are the 11 base panes in order', () => {
    expect(PLAT_TABS.webapp.map((t) => t.id)).toEqual(BASE_TABS.map((t) => t.id));
    expect(BASE_TABS.map((t) => t.id)).toEqual([
      'branding', 'typography', 'layout', 'navigation', 'buttons',
      'forms', 'tables', 'cards', 'popup', 'alerts', 'images',
    ]);
  });

  it('field slugs are globally unique across all platforms (no collisions)', () => {
    const { types, categories, fields } = buildSeedRows();
    // buildSeedRows throws on duplicate field slug; reaching here means 0 dupes.
    expect(types.size).toBe(97);
    expect(categories.size).toBe(968);
    expect(fields.size).toBe(4084);
  });

  it('TV px defaults are scaled per resolution (4K = 3x 720p)', () => {
    const { fields } = buildSeedRows();
    const at = (s) => fields.get(s)?.value;
    // Button height: authored 38px at desktop base → 720p x1, 4K x3, 8K x6
    expect(at('tv.buttons.tv_720p.button_sizes.height')).toBe('38');
    expect(at('tv.buttons.tv_4k.button_sizes.height')).toBe('114');
    expect(at('tv.buttons.tv_8k.button_sizes.height')).toBe('228');
  });

  it('spot-check: webapp primary button background color exists with prototype default', () => {
    const { fields } = buildSeedRows();
    // NOTE: the arch doc's example slug `webapp.buttons.desktop.primary_button.
    // background_color` does not exist — in the prototype the Primary Button
    // section is theme-tagged (dark/light), not device-tagged. Verbatim port wins.
    expect(fields.has('webapp.buttons.desktop.primary_button.background_color')).toBe(false);
    const dark = fields.get('webapp.buttons.dark.primary_button.background_color');
    expect(dark).toBeDefined();
    expect(dark.value).toBe('#4f8ef7');
    expect(dark.input_type).toBe('color');
    const light = fields.get('webapp.buttons.light.primary_button.background_color');
    expect(light.value).toBe('#0a66f0');
  });

  it('slug() matches the prototype normalization', () => {
    expect(slug('Filled + Border Settings')).toBe('filled_border_settings');
    expect(slug('H1 (Title)')).toBe('h1_title');
  });

  it('maps constructors to input_type/options/value encodings', () => {
    const { fields } = buildSeedRows();
    // slider → min/max/unit/step in options
    const sl = fields.get('webapp.buttons.desktop.button_sizes.border_radius');
    expect(sl.input_type).toBe('slider');
    expect(JSON.parse(sl.options)).toEqual({ min: 0, max: 24, unit: 'px' });
    // toggle → "true"/"false" string
    const tg = fields.get('webapp.navigation.behavior.sticky_sidebar');
    expect(tg.input_type).toBe('toggle');
    expect(tg.value).toBe('true');
    // select → choices
    const se = fields.get('webapp.buttons.button_defaults.button_font');
    expect(se.input_type).toBe('select');
    expect(JSON.parse(se.options).choices).toContain('Inter');
    // imglist → JSON array value
    const il = fields.get('webapp.images.desktop.image_classes.image_classes');
    expect(il.input_type).toBe('imglist');
    const imgs = JSON.parse(il.value);
    expect(imgs.find((r) => r.name === 'thumbnail-image')).toMatchObject({ w: 150, h: 150, fit: 'cover' });
  });
});
