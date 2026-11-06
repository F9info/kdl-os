// Website button and form-field styles.
//
// The owner picks ONE button style and ONE form-field style for the whole website (Web app flow > Buttons
// and form fields). The choice is stored once and turned into CSS that is appended to the compiled theme
// tokens (compileTokens), so it reaches everything that loads the theme: the live website, the page
// editor, and the static export (which bakes the same CSS into th-tokens.css).
//
// Scope: only website content (`.kdl-site`, the root of every rendered page) is touched, never the admin
// screens. Buttons are the primary buttons of the blocks (links and buttons with `bg-primary`); fields are
// text inputs, text areas and selects. Every style is written in the theme's own colours (the brand
// primary colour and the current text colour), so the style follows the theme instead of fixing a colour.

const PRIMARY = 'var(--branding_brand_colors_primary_color, #2563eb)';
const ON_PRIMARY = 'var(--buttons_primary_button_text_color, #ffffff)';
const mix = (colour, percent) => `color-mix(in srgb, ${colour} ${percent}%, transparent)`;
const LINE = mix('currentColor', 28);

// ── Buttons ──────────────────────────────────────────────────────────────────────────────────────
// Twelve looks that differ in shape, type, depth and fill, not just in corner size. base = the resting
// button, hover = while pointed at. Declarations only (no selector). Gradients and shadows are built from
// the theme's brand colours, so they follow it.
const SECONDARY = 'var(--branding_brand_colors_secondary_color, #132b60)';
// Light, widely spaced lowercase type: the airy look of the pill, classic and leaf buttons.
const AIRY_TYPE = 'font-weight: 300; letter-spacing: 0.12em; text-transform: lowercase;';
const FLAT = 'border: 1px solid transparent; box-shadow: none; background-image: none;';
const DARK = '#111827';

export const BUTTON_STYLES = {
  solid: {
    label: 'Solid',
    description: 'A filled button with softly rounded corners.',
    base: `border-radius: 8px; ${FLAT}`,
    hover: 'filter: brightness(0.92);',
  },
  pill: {
    label: 'Airy pill',
    description: 'Fully rounded ends with light, widely spaced lowercase type.',
    base: `border-radius: 9999px; ${FLAT} ${AIRY_TYPE} padding-left: 1.75rem; padding-right: 1.75rem;`,
    hover: 'filter: brightness(0.92);',
  },
  classic: {
    label: 'Classic',
    description: 'A small-radius rectangle with light, widely spaced type.',
    base: `border-radius: 6px; ${FLAT} ${AIRY_TYPE} padding-left: 1.75rem; padding-right: 1.75rem;`,
    hover: 'filter: brightness(0.92);',
  },
  leaf: {
    label: 'Leaf',
    description: 'Rounded on three corners, square on the fourth.',
    base: `border-radius: 9999px 9999px 0 9999px; ${FLAT} ${AIRY_TYPE} padding-left: 1.75rem; padding-right: 1.75rem;`,
    hover: 'filter: brightness(0.92);',
  },
  outline: {
    label: 'Outline',
    description: 'A clear border and no fill, filled in on hover.',
    base: `border-radius: 8px; background-color: transparent; background-image: none; color: ${PRIMARY}; border: 2px solid ${PRIMARY}; box-shadow: none;`,
    hover: `background-color: ${PRIMARY}; color: ${ON_PRIMARY};`,
  },
  soft: {
    label: 'Soft tint',
    description: 'A light tint of your brand colour with brand-coloured text.',
    base: `border-radius: 8px; background-color: ${mix(PRIMARY, 14)}; background-image: none; color: ${PRIMARY}; border: 1px solid transparent; box-shadow: none;`,
    hover: `background-color: ${mix(PRIMARY, 26)};`,
  },
  elevated: {
    label: 'Soft shadow',
    description: 'Lifts off the page on a tinted shadow.',
    base: `border-radius: 10px; border: 1px solid transparent; background-image: none; box-shadow: 0 8px 20px -6px ${mix(PRIMARY, 55)}; transition: transform .15s ease, box-shadow .15s ease;`,
    hover: `transform: translateY(-2px); box-shadow: 0 12px 26px -6px ${mix(PRIMARY, 65)};`,
  },
  hard: {
    label: 'Hard shadow',
    description: 'A dark outline and a solid offset shadow that presses in on hover.',
    base: `border-radius: 4px; border: 2px solid ${DARK}; background-image: none; font-weight: 700; box-shadow: 4px 4px 0 ${DARK}; transition: transform .1s ease, box-shadow .1s ease;`,
    hover: `transform: translate(2px, 2px); box-shadow: 2px 2px 0 ${DARK};`,
  },
  glow: {
    label: 'Glow',
    description: 'A rounded button wrapped in a soft halo of your brand colour.',
    base: `border-radius: 9999px; border: 1px solid transparent; background-image: none; box-shadow: 0 0 0 4px ${mix(PRIMARY, 22)}, 0 10px 30px -4px ${mix(PRIMARY, 60)}; transition: box-shadow .15s ease;`,
    hover: `box-shadow: 0 0 0 6px ${mix(PRIMARY, 30)}, 0 12px 34px -4px ${mix(PRIMARY, 75)};`,
  },
  gradient: {
    label: 'Gradient',
    description: 'A smooth blend from your brand colour to your second brand colour.',
    base: `border-radius: 10px; border: 1px solid transparent; box-shadow: none; background-image: linear-gradient(90deg, ${PRIMARY}, ${SECONDARY});`,
    hover: 'filter: brightness(1.1);',
  },
  gradientglow: {
    label: 'Gradient glow',
    description: 'A vivid diagonal gradient with a tinted shadow underneath.',
    base: `border-radius: 9999px; border: 1px solid transparent; background-image: linear-gradient(135deg, ${PRIMARY}, color-mix(in srgb, ${PRIMARY} 45%, #ec4899) 60%, color-mix(in srgb, ${PRIMARY} 30%, #f59e0b)); box-shadow: 0 10px 24px -6px ${mix(PRIMARY, 60)}; transition: transform .15s ease, filter .15s ease;`,
    hover: 'transform: translateY(-2px); filter: brightness(1.08);',
  },
  bold: {
    label: 'Bold caps',
    description: 'Capital letters with wide spacing and heavy type.',
    base: `border-radius: 4px; ${FLAT} text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;`,
    hover: 'filter: brightness(0.92);',
  },
};

// ── Form fields ──────────────────────────────────────────────────────────────────────────────────
// base = the resting field, focus = while typing. `textarea` overrides the radius of text areas, which
// cannot be pill-shaped.
const FOCUS_RING = `outline: none; border-color: ${PRIMARY}; box-shadow: 0 0 0 3px ${mix(PRIMARY, 22)};`;
export const FORM_STYLES = {
  outlined: {
    label: 'Outlined',
    description: 'A thin border all round.',
    base: `border: 1px solid ${LINE}; border-radius: 8px; box-shadow: none;`,
    focus: FOCUS_RING,
  },
  filled: {
    label: 'Filled',
    description: 'A tinted box with no border.',
    base: `border: 1px solid transparent; border-radius: 8px; box-shadow: none; background-color: ${mix('currentColor', 8)};`,
    focus: FOCUS_RING,
  },
  underline: {
    label: 'Underline',
    description: 'Only a line underneath, light and airy.',
    base: `border: 0; border-bottom: 2px solid ${LINE}; border-radius: 0; box-shadow: none; background-color: transparent; padding-left: 0; padding-right: 0;`,
    focus: `outline: none; border-bottom-color: ${PRIMARY}; box-shadow: none;`,
  },
  rounded: {
    label: 'Rounded',
    description: 'Pill-shaped fields with generous curves.',
    base: `border: 1px solid ${LINE}; border-radius: 9999px; box-shadow: none; padding-left: 1.1rem; padding-right: 1.1rem;`,
    textarea: 'border-radius: 1.25rem;',
    focus: FOCUS_RING,
  },
  soft: {
    label: 'Soft shadow',
    description: 'No border, lifted by a gentle shadow.',
    base: `border: 1px solid transparent; border-radius: 12px; background-color: ${mix('currentColor', 4)}; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);`,
    focus: FOCUS_RING,
  },
  bold: {
    label: 'Bold border',
    description: 'A thick, confident outline.',
    base: `border: 2px solid ${mix('currentColor', 70)}; border-radius: 6px; box-shadow: none;`,
    focus: FOCUS_RING,
  },
  sharp: {
    label: 'Sharp',
    description: 'Square corners and a fine border.',
    base: `border: 1px solid ${LINE}; border-radius: 0; box-shadow: none;`,
    focus: FOCUS_RING,
  },
  glow: {
    label: 'Glow',
    description: 'A clean outline that glows in your brand colour while typing.',
    base: `border: 1px solid ${LINE}; border-radius: 10px; box-shadow: none; transition: box-shadow .15s ease, border-color .15s ease;`,
    focus: `outline: none; border-color: ${PRIMARY}; box-shadow: 0 0 0 5px ${mix(PRIMARY, 30)};`,
  },
};

export const BUTTON_KEYS = Object.keys(BUTTON_STYLES);
export const FORM_KEYS = Object.keys(FORM_STYLES);
export const DEFAULT_BUTTON = 'solid';
export const DEFAULT_FORM = 'outlined';

export const buttonKeyOrDefault = (key) => (Object.hasOwn(BUTTON_STYLES, key) ? key : DEFAULT_BUTTON);
export const formKeyOrDefault = (key) => (Object.hasOwn(FORM_STYLES, key) ? key : DEFAULT_FORM);

// Website content only. A rendered page's root carries `kdl-site` (puck.config.tsx).
const BUTTON_SELECTORS = ['.kdl-site a.bg-primary', '.kdl-site button.bg-primary'];
const FIELD_NOT = ['checkbox', 'radio', 'hidden', 'submit', 'button', 'range', 'file', 'color', 'image']
  .map((t) => `:not([type=${t}])`)
  .join('');
const FIELD_SELECTORS = [`.kdl-site input${FIELD_NOT}`, '.kdl-site textarea', '.kdl-site select'];

const rule = (selectors, suffix, declarations) =>
  declarations ? `${selectors.map((s) => s + suffix).join(', ')} { ${declarations} }` : '';

/** The CSS that gives the whole website the chosen button and form-field style. */
export function siteStyleCss(button, form) {
  const b = BUTTON_STYLES[buttonKeyOrDefault(button)];
  const f = FORM_STYLES[formKeyOrDefault(form)];
  return [
    `/* website button style: ${buttonKeyOrDefault(button)}, form field style: ${formKeyOrDefault(form)} */`,
    rule(BUTTON_SELECTORS, '', b.base),
    rule(BUTTON_SELECTORS, ':hover', b.hover),
    rule(FIELD_SELECTORS, '', f.base),
    rule(['.kdl-site textarea'], '', f.textarea),
    rule(FIELD_SELECTORS, ':focus', f.focus),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * The choices as the picker shows them: declarations only, so the page can draw a live sample in each
 * style with its own scoping selector.
 */
export const styleOptions = () => ({
  buttons: BUTTON_KEYS.map((key) => ({ key, ...BUTTON_STYLES[key] })),
  forms: FORM_KEYS.map((key) => ({ key, ...FORM_STYLES[key] })),
});
