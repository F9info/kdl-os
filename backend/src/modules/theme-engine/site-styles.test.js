import { describe, it, expect } from 'vitest';
import {
  BUTTON_STYLES,
  FORM_STYLES,
  BUTTON_KEYS,
  FORM_KEYS,
  DEFAULT_BUTTON,
  DEFAULT_FORM,
  buttonKeyOrDefault,
  formKeyOrDefault,
  siteStyleCss,
  styleOptions,
} from './site-styles.js';
import { putSiteStylesBodySchema } from './schema.js';

describe('the choices', () => {
  it('offers 12 button styles and 8 form-field styles, each with its own key and a plain description', () => {
    expect(BUTTON_KEYS).toHaveLength(12);
    expect(FORM_KEYS).toHaveLength(8);
    for (const set of [BUTTON_STYLES, FORM_STYLES])
      for (const [key, style] of Object.entries(set)) {
        expect(style.label, key).toBeTruthy();
        expect(style.description.endsWith('.'), key).toBe(true);
        expect(style.base, key).toBeTruthy();
      }
  });

  it('every style looks different from every other one', () => {
    expect(new Set(Object.values(BUTTON_STYLES).map((s) => s.base + s.hover)).size).toBe(12);
    expect(new Set(Object.values(FORM_STYLES).map((s) => s.base + (s.focus ?? ''))).size).toBe(8);
  });

  it('the buttons differ in shape, type, depth and fill, not only in corner size', () => {
    const base = (k) => BUTTON_STYLES[k].base;
    // shapes: a pill, a small-radius rectangle, and a leaf with one square corner
    expect(base('pill')).toContain('border-radius: 9999px');
    expect(base('classic')).toContain('border-radius: 6px');
    expect(base('leaf')).toContain('border-radius: 9999px 9999px 0 9999px');
    // the three thin, letter-spaced lowercase looks of the example
    for (const k of ['pill', 'classic', 'leaf']) {
      expect(base(k)).toContain('text-transform: lowercase');
      expect(base(k)).toContain('letter-spacing: 0.12em');
      expect(base(k)).toContain('font-weight: 300');
    }
    // gradient buttons
    expect(base('gradient')).toContain('linear-gradient(90deg');
    expect(base('gradient')).toContain('--branding_brand_colors_secondary_color'); // follows the theme
    expect(base('gradientglow')).toContain('linear-gradient(135deg');
    // shadow buttons: soft, hard offset and glow
    expect(base('elevated')).toContain('box-shadow: 0 8px 20px');
    expect(base('hard')).toMatch(/box-shadow: 4px 4px 0/);
    expect(BUTTON_STYLES.hard.hover).toContain('translate(2px, 2px)');
    expect(base('glow')).toContain('0 0 0 4px');
  });

  it('the defaults exist', () => {
    expect(BUTTON_KEYS).toContain(DEFAULT_BUTTON);
    expect(FORM_KEYS).toContain(DEFAULT_FORM);
  });

  it('an unknown or missing choice falls back to the default, never to an inherited object key', () => {
    for (const bad of [undefined, null, '', 'nope', 'constructor', '__proto__', 'toString']) {
      expect(buttonKeyOrDefault(bad)).toBe(DEFAULT_BUTTON);
      expect(formKeyOrDefault(bad)).toBe(DEFAULT_FORM);
    }
  });

  it('styles follow the theme: they use the brand colour and the current text colour, not a fixed one', () => {
    const all = JSON.stringify([BUTTON_STYLES, FORM_STYLES]);
    expect(all).toContain('--branding_brand_colors_primary_color');
    expect(all).toContain('currentColor');
  });
});

describe('siteStyleCss', () => {
  it('touches website content only (.kdl-site), never admin screens', () => {
    for (const b of BUTTON_KEYS)
      for (const f of FORM_KEYS) {
        const css = siteStyleCss(b, f);
        const selectors = css
          .split('\n')
          .filter((l) => l.includes('{'))
          .map((l) => l.slice(0, l.indexOf('{')));
        for (const list of selectors)
          for (const sel of list.split(',')) expect(sel.trim().startsWith('.kdl-site'), sel).toBe(true);
      }
  });

  it('styles the primary buttons (links and buttons) and the text fields, with hover and focus', () => {
    const css = siteStyleCss('pill', 'rounded');
    expect(css).toContain('.kdl-site a.bg-primary');
    expect(css).toContain('.kdl-site button.bg-primary');
    expect(css).toContain('.kdl-site a.bg-primary:hover');
    expect(css).toContain('border-radius: 9999px');
    expect(css).toContain('.kdl-site textarea');
    expect(css).toContain('.kdl-site select');
    expect(css).toContain(':focus');
  });

  it('leaves checkboxes, radios, submit/other buttons and hidden inputs alone', () => {
    const css = siteStyleCss('solid', 'outlined');
    for (const t of ['checkbox', 'radio', 'hidden', 'submit', 'button', 'file'])
      expect(css).toContain(`:not([type=${t}])`);
  });

  it('a pill-shaped field style keeps text areas from becoming pills', () => {
    const css = siteStyleCss('solid', 'rounded');
    expect(css).toMatch(/\.kdl-site textarea \{ border-radius: 1\.25rem; \}/);
  });

  it('different choices give different CSS, and unknown ones give the default CSS', () => {
    expect(siteStyleCss('solid', 'outlined')).not.toBe(siteStyleCss('outline', 'outlined'));
    expect(siteStyleCss('solid', 'outlined')).not.toBe(siteStyleCss('solid', 'filled'));
    expect(siteStyleCss('nope', 'nope')).toBe(siteStyleCss(DEFAULT_BUTTON, DEFAULT_FORM));
  });

  it('is plain CSS: balanced braces and nothing that could break out of a rule', () => {
    for (const b of BUTTON_KEYS) {
      const css = siteStyleCss(b, 'outlined');
      expect(css.split('{').length).toBe(css.split('}').length);
      expect(css).not.toMatch(/<|\bjavascript:|expression\(|@import|url\(/i);
    }
  });
});

describe('styleOptions (what the picker shows)', () => {
  it('lists every style with its declarations so the page can draw a live sample', () => {
    const { buttons, forms } = styleOptions();
    expect(buttons.map((b) => b.key)).toEqual(BUTTON_KEYS);
    expect(forms.map((f) => f.key)).toEqual(FORM_KEYS);
    expect(buttons[0]).toMatchObject({
      label: expect.any(String),
      base: expect.any(String),
      hover: expect.any(String),
    });
    expect(forms[0]).toMatchObject({
      label: expect.any(String),
      base: expect.any(String),
      focus: expect.any(String),
    });
  });
});

describe('putSiteStylesBodySchema', () => {
  const parse = (body) => putSiteStylesBodySchema.safeParse({ body });
  it('accepts one or both, with known keys', () => {
    expect(parse({ button: 'pill' }).success).toBe(true);
    expect(parse({ form: 'glow' }).success).toBe(true);
    expect(parse({ button: 'gradient', form: 'underline' }).success).toBe(true);
  });
  it('rejects an empty body, unknown keys and unknown styles', () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ button: 'neon' }).success).toBe(false);
    expect(parse({ form: 'constructor' }).success).toBe(false);
    expect(parse({ button: 'pill', extra: 1 }).success).toBe(false);
  });
});
