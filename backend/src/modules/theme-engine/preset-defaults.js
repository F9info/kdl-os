// The theme looks that ship with the product. They are inserted into theme_presets only when their key is
// missing (see presets.js), so a preset the user edited or deleted is never put back.
export const BUILTIN_PRESETS = [
  {
    name: 'Ocean',
    light: {
      primary: '#0369a1',
      secondary: '#0891b2',
      accent: '#7c3aed',
      highlight: '#f59e0b',
      background: '#f8fafc',
      text: '#0f172a',
    },
    dark: {
      primary: '#0284c7',
      secondary: '#22d3ee',
      accent: '#a78bfa',
      highlight: '#fbbf24',
      background: '#0b1220',
      text: '#e2e8f0',
    },
  },
  {
    name: 'Forest',
    light: {
      primary: '#15803d',
      secondary: '#65a30d',
      accent: '#ca8a04',
      highlight: '#ea580c',
      background: '#f7fbf7',
      text: '#14281d',
    },
    dark: {
      primary: '#16a34a',
      secondary: '#a3e635',
      accent: '#facc15',
      highlight: '#fb923c',
      background: '#0c1a12',
      text: '#e6f4ea',
    },
  },
  {
    name: 'Sunset',
    light: {
      primary: '#ea580c',
      secondary: '#db2777',
      accent: '#ca8a04',
      highlight: '#7c3aed',
      background: '#fffaf5',
      text: '#2b1409',
    },
    dark: {
      primary: '#ea580c',
      secondary: '#f472b6',
      accent: '#fde047',
      highlight: '#a78bfa',
      background: '#1a0f0a',
      text: '#fdeede',
    },
  },
  {
    name: 'Slate',
    light: {
      primary: '#334155',
      secondary: '#64748b',
      accent: '#2563eb',
      highlight: '#f59e0b',
      background: '#f8fafc',
      text: '#0f172a',
    },
    dark: {
      primary: '#64748b',
      secondary: '#cbd5e1',
      accent: '#60a5fa',
      highlight: '#fbbf24',
      background: '#0f172a',
      text: '#f1f5f9',
    },
  },
]
