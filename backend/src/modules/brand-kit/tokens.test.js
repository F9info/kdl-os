// Unit tests for the brand → theme colour builders in tokens.js: buildThemeColors,
// buildThemeColorValues and buildButtonColorValues (plus the NOT_EXTRACTED guard that
// buildTokenPayload now shares with them). All pure — no DB; the Theme Engine schema and
// validator are imported only to prove the emitted slugs / values are ones it accepts.

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../config/redis.js', () => ({ redis: {} }));

import { buildRamp, srgbToOklch, hexToRgb } from './palette.js';
import { buildContrastReport, passesAA, contrastRatio } from './contrast.js';
import {
  buildTokenPayload,
  buildThemeColors,
  buildThemeColorValues,
  buildButtonColorValues,
} from './tokens.js';
import { buildSeedRows } from '../theme-engine/seed.js';
import { validateFieldValue } from '../theme-engine/service.js';
import { postValuesBodySchema } from '../theme-engine/schema.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// A palette entry built the way extractPalette builds it: brand hex + 10-step ramp.
const entry = (hex) => ({ hex, ...buildRamp(srgbToOklch(...hexToRgb(hex)), hex) });

const kitOf = ({ primary, secondary, accent, neutral } = {}) => {
  const palette = {
    schemaVersion: 1,
    colors: {
      primary: primary ? entry(primary) : null,
      secondary: secondary ? entry(secondary) : null,
      accent: accent ? entry(accent) : null,
      neutral: neutral ? entry(neutral) : null,
    },
  };
  return { palette, contrast_report: buildContrastReport(palette) };
};

// A kit whose colours.* are exactly what the test hands in (hand-built ramps etc.).
const kitWith = (colors, adjustments = []) => ({
  palette: { colors },
  contrast_report: { adjustments },
});

const HEX = /^#[0-9a-f]{6}$/i;
const DARK_DEFAULT_SURFACE = '#1e1e20';

// ─── buildThemeColors ────────────────────────────────────────────────────────

describe('buildThemeColors — light', () => {
  it('keeps the brand hexes verbatim, follows primary for highlight, and takes surface/text/body from neutral ramp 50/900/700', () => {
    const kit = kitOf({ primary: '#0e6e5c', secondary: '#1d4ed8', accent: '#e11d48', neutral: '#6b7280' });
    const { ramp } = kit.palette.colors.neutral;

    expect(buildThemeColors(kit).light).toMatchObject({
      primary: '#0e6e5c',
      secondary: '#1d4ed8',
      accent: '#e11d48',
      highlight: '#0e6e5c',
      background: ramp['50'],
      text: ramp['900'],
      body: ramp['700'],
    });
  });
});

describe('buildThemeColors — dark', () => {
  it('swaps the neutral ends (900 surface, 50 text, 300 body)', () => {
    const kit = kitOf({ primary: '#0e6e5c', neutral: '#6b7280' });
    const { ramp } = kit.palette.colors.neutral;

    expect(buildThemeColors(kit).dark).toMatchObject({
      background: ramp['900'],
      text: ramp['50'],
      body: ramp['300'],
    });
  });

  it('a brand colour that fails AA on the dark surface becomes its ramp 300 step', () => {
    const kit = kitOf({ primary: '#0e6e5c', neutral: '#6b7280' }); // 3.5:1 on dark — fails
    const { dark } = buildThemeColors(kit);

    expect(passesAA('#0e6e5c', dark.background)).toBe(false);
    expect(dark.primary).toBe(kit.palette.colors.primary.ramp['300']);
    expect(dark.highlight).toBe(dark.primary);
    expect(passesAA(dark.primary, dark.background)).toBe(true);
  });

  it('a brand colour that already reads on the dark surface is kept (yellow is not darkened to ramp 300)', () => {
    const kit = kitOf({ primary: '#f5c518', neutral: '#6b7280' });
    const { dark } = buildThemeColors(kit);

    expect(dark.primary).toBe('#f5c518');
    expect(dark.primary).not.toBe(kit.palette.colors.primary.ramp['300']);
  });

  it('walks ramp 300 → 400 → 500 and takes the first step with AA contrast', () => {
    // 300 is too dark to pass; 400 and 500 both would — the first in order wins.
    const kit = kitWith({
      primary: { hex: '#202020', ramp: { 50: '#f0f0f0', 300: '#202020', 400: '#c0c0c0', 500: '#ffffff' } },
    });

    expect(buildThemeColors(kit).dark.primary).toBe('#c0c0c0');
  });

  it('with no passing step among 300/400/500, takes the lightest ramp step', () => {
    const kit = kitWith({
      primary: {
        hex: '#202020',
        ramp: { 50: '#f0f0f0', 100: '#d0d0d0', 300: '#202020', 400: '#222222', 500: '#242424' },
      },
    });

    expect(buildThemeColors(kit).dark.primary).toBe('#f0f0f0');
  });

  it('with no ramp at all, falls back to the brand hex', () => {
    const kit = kitWith({ primary: { hex: '#202020' } });

    expect(buildThemeColors(kit).dark.primary).toBe('#202020');
  });

  it('checks AA against the dark surface it will actually emit, not a fixed one', () => {
    // A mid-grey neutral makes ramp 900 (the dark surface) lighter than the default #1e1e20.
    const kit = kitWith({
      primary: { hex: '#404040', ramp: { 50: '#fafafa', 300: '#8b8b8b', 400: '#7a7a7a', 500: '#6a6a6a' } },
      neutral: { hex: '#555555', ramp: { 50: '#fafafa', 900: '#555555' } },
    });
    const { dark } = buildThemeColors(kit);

    expect(dark.background).toBe('#555555');
    // Ramp 300 clears AA on the default #1e1e20 but not on the #555555 surface it would sit on.
    expect(passesAA('#8b8b8b', DARK_DEFAULT_SURFACE)).toBe(true);
    expect(passesAA('#8b8b8b', dark.background)).toBe(false);
    expect(dark.primary).toBe('#fafafa');
  });
});

describe('buildThemeColors — missing roles never throw, they fall back', () => {
  it('secondary falls back to primary and accent to secondary (both modes)', () => {
    const { light, dark } = buildThemeColors(kitOf({ primary: '#0e6e5c', neutral: '#6b7280' }));

    expect(light.secondary).toBe(light.primary);
    expect(light.accent).toBe(light.primary);
    expect(dark.secondary).toBe(dark.primary);
    expect(dark.accent).toBe(dark.primary);
  });

  it('a lone accent keeps its own colour while secondary still follows primary', () => {
    const { light } = buildThemeColors(kitOf({ primary: '#0e6e5c', accent: '#e11d48' }));

    expect(light.secondary).toBe('#0e6e5c');
    expect(light.accent).toBe('#e11d48');
  });

  it('with no neutral ramp, surfaces and text are the Theme Engine defaults', () => {
    const { light, dark } = buildThemeColors(kitOf({ primary: '#0e6e5c' }));

    expect(light).toMatchObject({ background: '#f2f2f7', text: '#1d1d21', body: '#1d1d21' });
    expect(dark).toMatchObject({ background: '#1e1e20', text: '#f2f2f5', body: '#f2f2f5' });
  });

  it('a monochrome brand (no chromatic role) gets the Theme Engine default primary and link', () => {
    const { light, dark } = buildThemeColors(kitOf({ neutral: '#111111' }));

    expect(light).toMatchObject({ primary: '#2119B3', secondary: '#2119B3', highlight: '#2119B3', link: '#0a66f0' });
    expect(dark).toMatchObject({ primary: '#7468F3', secondary: '#7468F3', highlight: '#7468F3', link: '#4f8ef7' });
  });

  it('an empty colours map yields all defaults', () => {
    const { light, dark } = buildThemeColors(kitWith({}));

    expect(light.primary).toBe('#2119B3');
    expect(dark.primary).toBe('#7468F3');
    expect(light.background).toBe('#f2f2f7');
    expect(dark.background).toBe('#1e1e20');
  });

  it('malformed hex / ramp values (palette is user-editable) are ignored, not thrown on', () => {
    const kit = kitWith({
      primary: { hex: '#12', ramp: { 300: 123, 400: null, 500: 'nope', 50: { x: 1 } } },
      secondary: { hex: 42, ramp: 'junk' },
      accent: { hex: '', ramp: ['#ffffff'] },
      neutral: { hex: 'x', ramp: { 50: '#zzzzzz', 900: undefined } },
    });

    const { light, dark } = buildThemeColors(kit);
    for (const value of [...Object.values(light), ...Object.values(dark)]) {
      expect(value).toMatch(HEX);
    }
    expect(light.primary).toBe('#2119B3');
    expect(light.background).toBe('#f2f2f7');
  });

  it('only a palette that was never extracted is an error — 409 NOT_EXTRACTED', () => {
    for (const palette of [null, undefined, {}, { colors: null }]) {
      expect(() => buildThemeColors({ palette })).toThrowError(
        expect.objectContaining({ status: 409, code: 'NOT_EXTRACTED' }),
      );
    }
  });
});

describe('buildThemeColors — link colour', () => {
  it('is the brand colour itself when it already reads on the surface', () => {
    const { light } = buildThemeColors(kitOf({ primary: '#0e6e5c', neutral: '#6b7280' }));

    expect(light.link).toBe('#0e6e5c');
  });

  it('is the -text variant the user acknowledged at approval when the brand colour does not read', () => {
    const kit = kitOf({ primary: '#f5c518', neutral: '#6b7280' }); // yellow on near-white: 1.5:1
    const acknowledged = kit.contrast_report.adjustments.find((a) => a.id === 'primary-on-light').derived;
    const { light } = buildThemeColors(kit);

    expect(light.link).toBe(acknowledged);
    expect(passesAA(light.link, light.background)).toBe(true);
  });

  it('ignores an acknowledged variant that no longer reads on the real surface and re-derives one', () => {
    const kit = kitOf({ primary: '#f5c518', neutral: '#6b7280' });
    // A stale report (the palette was edited after extraction): the "derived" colour is the yellow itself.
    kit.contrast_report = { adjustments: [{ id: 'primary-on-light', derived: '#f5c518' }] };
    const { light } = buildThemeColors(kit);

    expect(light.link).not.toBe('#f5c518');
    expect(passesAA(light.link, light.background)).toBe(true);
  });

  it('still reads when the brand passes the report surface (#fafafa) but not the neutral-50 surface it lands on', () => {
    // Red is 4.3:1 on neutral-50 #f5f5f5 yet clears 4.5:1 on the report's #fafafa — so no
    // adjustment was ever recorded for it.
    const kit = kitOf({ primary: '#e11d48', neutral: '#737373' });
    const { light } = buildThemeColors(kit);

    expect(kit.contrast_report.adjustments.some((a) => a.id === 'primary-on-light')).toBe(false);
    expect(passesAA(light.primary, light.background)).toBe(false);
    expect(passesAA(light.link, light.background)).toBe(true);
    expect(light.link).not.toBe(light.primary);
  });
});

describe('buildThemeColors — text always reads on its surface', () => {
  // The last two are mid-tones where neither white nor #111111 reaches 4.5:1 on the light primary.
  const BRANDS = ['#0e6e5c', '#f5c518', '#e11d48', '#0b1f4d', '#7c3aed', '#f97316', '#06b6d4', '#84cc16', '#111111', '#fafafa', '#e81c7e', '#797979'];

  it.each(BRANDS)('brand %s: titles, body, link and the primary-button label pass AA in both modes; dark brand roles do too', (hex) => {
    const kit = kitOf({ primary: hex, secondary: '#1d4ed8', accent: '#e11d48', neutral: '#6b7280' });
    const { light, dark } = buildThemeColors(kit);
    const label = Object.fromEntries(buildButtonColorValues({ light, dark }).map((v) => [v.slug, v.value]));

    for (const [name, mode] of [['light', light], ['dark', dark]]) {
      for (const role of ['text', 'body', 'link']) {
        expect(passesAA(mode[role], mode.background), `${name}.${role} ${mode[role]} on ${mode.background}`).toBe(true);
      }
      const buttonLabel = label[`webapp.buttons.${name}.primary_button.text_color`];
      expect(passesAA(buttonLabel, mode.primary), `${name} button label ${buttonLabel} on ${mode.primary}`).toBe(true);
    }
    for (const role of ['primary', 'secondary', 'accent', 'highlight']) {
      expect(passesAA(dark[role], dark.background), `dark.${role} ${dark[role]} on ${dark.background}`).toBe(true);
    }
  });
});

// ─── buildThemeColorValues ───────────────────────────────────────────────────

describe('buildThemeColorValues', () => {
  const colors = buildThemeColors(
    kitOf({ primary: '#0e6e5c', secondary: '#1d4ed8', accent: '#e11d48', neutral: '#6b7280' }),
  );

  it('emits exactly these 18 branding slugs (9 per mode)', () => {
    const slugs = buildThemeColorValues(colors, 'webapp').map((v) => v.slug);

    expect(slugs).toEqual(
      ['light', 'dark'].flatMap((mode) =>
        [
          'brand_colors.primary_color',
          'brand_colors.secondary_color',
          'brand_colors.accent_color',
          'brand_colors.highlight_color',
          'brand_colors.titles_text_color',
          'brand_colors.body_text_color',
          'surfaces.background_color',
          'text_interaction.text_primary',
          'text_interaction.link_color',
        ].map((path) => `webapp.branding.${mode}.${path}`),
      ),
    );
  });

  it('maps each palette role onto its field', () => {
    const byslug = Object.fromEntries(buildThemeColorValues(colors).map((v) => [v.slug, v.value]));
    const { light, dark } = colors;

    expect(byslug['webapp.branding.light.brand_colors.primary_color']).toBe(light.primary);
    expect(byslug['webapp.branding.light.brand_colors.secondary_color']).toBe(light.secondary);
    expect(byslug['webapp.branding.light.brand_colors.accent_color']).toBe(light.accent);
    expect(byslug['webapp.branding.light.brand_colors.highlight_color']).toBe(light.highlight);
    expect(byslug['webapp.branding.light.brand_colors.titles_text_color']).toBe(light.text);
    expect(byslug['webapp.branding.light.brand_colors.body_text_color']).toBe(light.body);
    expect(byslug['webapp.branding.light.surfaces.background_color']).toBe(light.background);
    expect(byslug['webapp.branding.light.text_interaction.text_primary']).toBe(light.text);
    expect(byslug['webapp.branding.light.text_interaction.link_color']).toBe(light.link);
    expect(byslug['webapp.branding.dark.brand_colors.primary_color']).toBe(dark.primary);
    expect(byslug['webapp.branding.dark.surfaces.background_color']).toBe(dark.background);
    expect(byslug['webapp.branding.dark.text_interaction.link_color']).toBe(dark.link);
  });

  it('defaults to the webapp platform and honours another', () => {
    expect(buildThemeColorValues(colors).every((v) => v.slug.startsWith('webapp.branding.'))).toBe(true);
    expect(buildThemeColorValues(colors, 'webapp_admin').every((v) => v.slug.startsWith('webapp_admin.branding.'))).toBe(true);
  });

  it('still works on a bare six-key palette: body falls back to text, link to primary', () => {
    const bare = {
      light: { primary: '#111111', secondary: '#222222', accent: '#333333', highlight: '#444444', background: '#ffffff', text: '#000000' },
      dark: { primary: '#eeeeee', secondary: '#dddddd', accent: '#cccccc', highlight: '#bbbbbb', background: '#000000', text: '#ffffff' },
    };
    const byslug = Object.fromEntries(buildThemeColorValues(bare).map((v) => [v.slug, v.value]));

    expect(byslug['webapp.branding.light.brand_colors.body_text_color']).toBe('#000000');
    expect(byslug['webapp.branding.light.text_interaction.link_color']).toBe('#111111');
    expect(byslug['webapp.branding.dark.brand_colors.body_text_color']).toBe('#ffffff');
    expect(byslug['webapp.branding.dark.text_interaction.link_color']).toBe('#eeeeee');
  });

  it('satisfies the theme-engine POST /values body schema', () => {
    const parsed = postValuesBodySchema.safeParse({
      body: { platform: 'webapp', type_id: 'type-uuid', values: buildThemeColorValues(colors) },
    });

    expect(parsed.success).toBe(true);
  });
});

// ─── buildButtonColorValues ──────────────────────────────────────────────────

describe('buildButtonColorValues', () => {
  it('emits the primary button label field for each mode', () => {
    const colors = buildThemeColors(kitOf({ primary: '#0e6e5c', neutral: '#6b7280' }));

    expect(buildButtonColorValues(colors, 'webapp').map((v) => v.slug)).toEqual([
      'webapp.buttons.light.primary_button.text_color',
      'webapp.buttons.dark.primary_button.text_color',
    ]);
  });

  it('picks white or near-black, whichever reads better on that mode’s primary', () => {
    const byslug = (hex) =>
      Object.fromEntries(
        buildButtonColorValues(buildThemeColors(kitOf({ primary: hex, neutral: '#6b7280' }))).map((v) => [v.slug, v.value]),
      );

    // Deep green: white label on the light primary; the pale dark-mode step needs a dark label.
    expect(byslug('#0e6e5c')).toEqual({
      'webapp.buttons.light.primary_button.text_color': '#ffffff',
      'webapp.buttons.dark.primary_button.text_color': '#111111',
    });
    // Yellow: a white label would be 1.5:1 — it gets the dark one in both modes.
    expect(byslug('#f5c518')).toEqual({
      'webapp.buttons.light.primary_button.text_color': '#111111',
      'webapp.buttons.dark.primary_button.text_color': '#111111',
    });
  });

  // Regression: onColor used to pick the better of white / #111111 even when that was under AA.
  // On the mid-tones neither reaches 4.5:1, so the label has to fall back to pure white / black.
  const labelOn = (primary) => buildButtonColorValues({ light: { primary }, dark: { primary } })[0].value;

  it('falls back to pure black when #111111 is the better pick but still under AA (pink #e81c7e: #111111 = 4.40:1, black = 4.90:1)', () => {
    expect(contrastRatio('#111111', '#e81c7e')).toBeLessThan(4.5);
    expect(labelOn('#e81c7e')).toBe('#000000');
  });

  it('falls back to pure black when white is the better pick but still under AA (#e03617: white = 4.46:1, black = 4.71:1)', () => {
    expect(contrastRatio('#ffffff', '#e03617')).toBeLessThan(4.5);
    expect(labelOn('#e03617')).toBe('#000000');
  });

  it('keeps white / #111111 wherever they already reach AA', () => {
    expect(labelOn('#0e6e5c')).toBe('#ffffff');
    expect(labelOn('#f5c518')).toBe('#111111');
  });

  it('every primary on a 16-level RGB grid gets a label with AA contrast', () => {
    const levels = Array.from({ length: 16 }, (_, i) => i * 17);
    const failures = [];
    for (const r of levels) {
      for (const g of levels) {
        for (const b of levels) {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
          const label = labelOn(hex);
          if (!passesAA(label, hex)) failures.push(`${label} on ${hex} = ${contrastRatio(label, hex).toFixed(2)}`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

// ─── Every emitted slug / value is one the Theme Engine accepts ──────────────
// upsertValues rejects the WHOLE pane when any entry is unknown or invalid, so one
// wrong slug would silently drop the entire brand write.

describe('Theme Engine compatibility', () => {
  const { fields } = buildSeedRows();
  const brands = [
    kitOf({ primary: '#0e6e5c', secondary: '#1d4ed8', accent: '#e11d48', neutral: '#6b7280' }),
    kitOf({ primary: '#f5c518' }),
    kitOf({ neutral: '#111111' }),
    kitWith({}),
  ];

  it.each(['webapp', 'webapp_admin'])('every %s slug is a seeded colour field and every value passes its validator', (platform) => {
    for (const kit of brands) {
      const colors = buildThemeColors(kit);
      const values = [...buildThemeColorValues(colors, platform), ...buildButtonColorValues(colors, platform)];

      for (const { slug, value } of values) {
        const field = fields.get(slug);
        expect(field, `unknown Theme Engine field ${slug}`).toBeDefined();
        expect(field.input_type).toBe('color');
        expect(validateFieldValue(field, value), `${slug} = ${value}`).toBeNull();
      }
    }
  });
});

// ─── buildTokenPayload (shares the NOT_EXTRACTED guard) ──────────────────────

describe('buildTokenPayload — NOT_EXTRACTED guard', () => {
  it('still throws 409 NOT_EXTRACTED when there is no palette', () => {
    expect(() => buildTokenPayload({ palette: null }, 'webapp', 'type-id')).toThrowError(
      expect.objectContaining({ status: 409, code: 'NOT_EXTRACTED' }),
    );
  });
});
