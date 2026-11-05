import type { Config } from 'tailwindcss'

// Tailwind cannot apply an /opacity modifier to a runtime `var(--x, fallback)`
// colour, so `bg-primary/10`, `bg-muted/30`, `bg-background/80` … silently
// generated NO css once the Theme Engine tokens replaced the shadcn hsl()
// palette. Wrapping a token in this function restores them: no modifier →
// the plain value; `/NN` → the same value mixed with transparent.
const tok = (value: string): string =>
  // Tailwind accepts a colour function at runtime, but its `colors` typing only
  // lists strings — hence the cast.
  (({ opacityValue }: { opacityValue?: string }) => {
    // No modifier: Tailwind passes undefined or a var(--tw-*-opacity) placeholder.
    const alpha = Number(opacityValue)
    return Number.isFinite(alpha) && alpha < 1
      ? `color-mix(in srgb, ${value} ${Math.round(alpha * 1000) / 10}%, transparent)`
      : value
  }) as unknown as string

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/app/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // `--branding_*`/`--buttons_*` are compiled at runtime by the Module 15
        // Theme Engine (ThemeEngineProvider injects them into
        // <style id="te-tokens">, dark in :root / light in [data-theme="light"]).
        // The `hsl(var(--x))` fallback keeps the original shadcn palette before
        // the provider's first fetch resolves or when a token is unset.
        // Every slot below MUST have a branding token — a slot left on the
        // static shadcn fallback stays dark-theme-colored when the app
        // switches to Light (KDL-199: invisible text, dark navy cards on a
        // light page).
        // ── Site-block vocabulary ───────────────────────────────────────────
        // Theme Engine tokens that previously had no Tailwind name, so page-builder
        // blocks hard-coded palette classes (bg-slate-50, text-orange-600 …) that
        // no theme change could reach. Hex fallbacks = the default light theme.
        // Use `/NN` for tints (bg-highlight/10) — see `tok` above.
        highlight: {
          DEFAULT: tok('var(--branding_brand_colors_highlight_color, #F9941F)'),
        },
        tertiary: {
          DEFAULT: tok('var(--branding_brand_colors_tertiary_color, #0891b2)'),
        },
        title: tok('var(--branding_brand_colors_titles_text_color, #1d1d21)'),
        body: tok('var(--branding_brand_colors_body_text_color, #3a3a40)'),
        faint: tok('var(--branding_text_interaction_text_tertiary, #9a9aa2)'),
        divider: tok('var(--branding_text_interaction_divider_color, #e0e0e4)'),
        surface: tok('var(--branding_surfaces_surface_color, #ffffff)'),
        // Dark bands inside a light page (and the reverse in dark mode): they flip
        // with the theme because they are built from the text/background tokens.
        inverse: {
          DEFAULT: tok('var(--branding_text_interaction_text_primary, #1d1d21)'),
          foreground: tok('var(--branding_surfaces_background_color, #f2f2f7)'),
        },
        border: tok('var(--branding_text_interaction_border_color, hsl(var(--border)))'),
        input: tok('var(--branding_text_interaction_border_color, hsl(var(--input)))'),
        ring: tok('var(--branding_brand_colors_primary_color, hsl(var(--ring)))'),
        background: tok('var(--branding_surfaces_background_color, hsl(var(--background)))'),
        foreground: tok('var(--branding_text_interaction_text_primary, hsl(var(--foreground)))'),
        primary: {
          DEFAULT: tok('var(--branding_brand_colors_primary_color, hsl(var(--primary)))'),
          foreground: tok(
            'var(--buttons_primary_button_text_color, hsl(var(--primary-foreground)))'
          ),
        },
        secondary: {
          DEFAULT: tok('var(--branding_brand_colors_secondary_color, hsl(var(--secondary)))'),
          foreground: tok(
            'var(--branding_text_interaction_text_primary, hsl(var(--secondary-foreground)))'
          ),
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        'status-danger-fg': 'hsl(var(--status-danger-fg))',
        muted: {
          DEFAULT: tok('var(--branding_surfaces_surface_color, hsl(var(--muted)))'),
          foreground: tok(
            'var(--branding_text_interaction_text_secondary, hsl(var(--muted-foreground)))'
          ),
        },
        accent: {
          DEFAULT: tok('var(--branding_brand_colors_accent_color, hsl(var(--accent)))'),
          foreground: tok(
            'var(--branding_text_interaction_text_primary, hsl(var(--accent-foreground)))'
          ),
        },
        popover: {
          DEFAULT: tok('var(--branding_surfaces_surface_color, hsl(var(--popover)))'),
          foreground: tok(
            'var(--branding_text_interaction_text_primary, hsl(var(--popover-foreground)))'
          ),
        },
        card: {
          DEFAULT: tok('var(--branding_surfaces_card_color, hsl(var(--card)))'),
          foreground: tok(
            'var(--branding_text_interaction_text_primary, hsl(var(--card-foreground)))'
          ),
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // B1 Elevation — consumes the CSS custom properties defined in globals.css
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      // B1 Motion — consume the CSS custom properties (collapse to 0ms under
      // prefers-reduced-motion via the :root override in globals.css)
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        decelerate: 'var(--ease-decelerate)',
        accelerate: 'var(--ease-accelerate)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'sheet-overlay-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-overlay-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'sheet-slide-in-from-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'sheet-slide-out-to-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'sheet-slide-in-from-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'sheet-slide-out-to-left': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
        'hero-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'hero-slide-in': {
          from: { opacity: '0', transform: 'translateX(24px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        // Use B1 motion tokens; globals.css collapses them to 0ms under prefers-reduced-motion
        'accordion-down':
          'accordion-down var(--duration-slow, 0.2s) var(--ease-decelerate, ease-out)',
        'accordion-up': 'accordion-up var(--duration-slow, 0.2s) var(--ease-accelerate, ease-out)',
        'sheet-overlay-in':
          'sheet-overlay-in var(--duration-slow, 0.2s) var(--ease-decelerate, ease-out)',
        'sheet-overlay-out':
          'sheet-overlay-out var(--duration-base, 0.15s) var(--ease-accelerate, ease-out)',
        'sheet-slide-in-from-right':
          'sheet-slide-in-from-right var(--duration-slow, 0.2s) var(--ease-decelerate, ease-out)',
        'sheet-slide-out-to-right':
          'sheet-slide-out-to-right var(--duration-base, 0.15s) var(--ease-accelerate, ease-out)',
        'sheet-slide-in-from-left':
          'sheet-slide-in-from-left var(--duration-slow, 0.2s) var(--ease-decelerate, ease-out)',
        'sheet-slide-out-to-left':
          'sheet-slide-out-to-left var(--duration-base, 0.15s) var(--ease-accelerate, ease-out)',
        'hero-fade-in': 'hero-fade-in 500ms ease-out',
        'hero-slide-in': 'hero-slide-in 500ms ease-out',
      },
    },
  },
  plugins: [],
}

export default config
