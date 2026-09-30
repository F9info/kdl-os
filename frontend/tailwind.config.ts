import type { Config } from 'tailwindcss'

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
        border: 'var(--branding_text_interaction_border_color, hsl(var(--border)))',
        input: 'var(--branding_text_interaction_border_color, hsl(var(--input)))',
        ring: 'var(--branding_brand_colors_primary_color, hsl(var(--ring)))',
        background: 'var(--branding_surfaces_background_color, hsl(var(--background)))',
        foreground: 'var(--branding_text_interaction_text_primary, hsl(var(--foreground)))',
        primary: {
          DEFAULT: 'var(--branding_brand_colors_primary_color, hsl(var(--primary)))',
          foreground: 'var(--buttons_primary_button_text_color, hsl(var(--primary-foreground)))',
        },
        secondary: {
          DEFAULT: 'var(--branding_brand_colors_secondary_color, hsl(var(--secondary)))',
          foreground:
            'var(--branding_text_interaction_text_primary, hsl(var(--secondary-foreground)))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        'status-danger-fg': 'hsl(var(--status-danger-fg))',
        muted: {
          DEFAULT: 'var(--branding_surfaces_surface_color, hsl(var(--muted)))',
          foreground:
            'var(--branding_text_interaction_text_secondary, hsl(var(--muted-foreground)))',
        },
        accent: {
          DEFAULT: 'var(--branding_brand_colors_accent_color, hsl(var(--accent)))',
          foreground:
            'var(--branding_text_interaction_text_primary, hsl(var(--accent-foreground)))',
        },
        popover: {
          DEFAULT: 'var(--branding_surfaces_surface_color, hsl(var(--popover)))',
          foreground:
            'var(--branding_text_interaction_text_primary, hsl(var(--popover-foreground)))',
        },
        card: {
          DEFAULT: 'var(--branding_surfaces_card_color, hsl(var(--card)))',
          foreground: 'var(--branding_text_interaction_text_primary, hsl(var(--card-foreground)))',
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
