import { describe, it, expect } from 'vitest'
import {
  HEX6,
  PRESETS,
  QUICK,
  contrastWarnings,
  paletteToCssVars,
  readableOn,
  tokenVar,
  type Palette,
} from '@/app/admin/theme-engine/simple/palette'
import {
  applyFonts,
  currentFonts,
  draftRows,
  familyNames,
  fontChoices,
  fontCssVars,
  googleFontUrl,
  withGoogleFonts,
} from '@/app/admin/theme-engine/simple/fonts'
import { contrastRatio } from '@/lib/contrast'
import { PREVIEW_PACKS } from '@/app/admin/theme-engine/simple/preview-packs'
import { construction } from '@/app/admin/page-builder/packs/construction'
import { general } from '@/app/admin/page-builder/packs/general'
import { medical } from '@/app/admin/page-builder/packs/medical'

// Stock Theme Engine values (backend schema/index.js, webapp.branding / webapp.buttons).
const STOCK: Record<'light' | 'dark', Palette> = {
  light: {
    primary: '#2119b3',
    secondary: '#0284c7',
    accent: '#7c3aed',
    highlight: '#f9941f',
    background: '#f2f2f7',
    text: '#1d1d21',
  },
  dark: {
    primary: '#7468f3',
    secondary: '#0ea5e9',
    accent: '#a855f7',
    highlight: '#f7b23b',
    background: '#1e1e20',
    text: '#f2f2f5',
  },
}
// buttons.<mode>.primary_button.text_color, white in both modes
const STOCK_BUTTON_TEXT = '#ffffff'

describe('paletteToCssVars', () => {
  const light = STOCK.light

  it('maps the six quick colours straight onto their tokens', () => {
    const v = paletteToCssVars(light)
    expect(v['--branding_brand_colors_primary_color']).toBe('#2119b3')
    expect(v['--branding_brand_colors_secondary_color']).toBe('#0284c7')
    expect(v['--branding_brand_colors_accent_color']).toBe('#7c3aed')
    expect(v['--branding_brand_colors_highlight_color']).toBe('#f9941f')
    expect(v['--branding_surfaces_background_color']).toBe('#f2f2f7')
    expect(v['--branding_text_interaction_text_primary']).toBe('#1d1d21')
  })

  it('sets only what Publish writes: nothing is derived from the draft', () => {
    // A derived title / surface / border / button-text colour would show in the preview
    // but never reach the site, because Publish only saves these six fields.
    const vars = paletteToCssVars({
      ...light,
      background: '#0b1220',
      text: '#e2e8f0',
      primary: '#ffee00',
    })
    expect(Object.keys(vars).sort()).toEqual([
      '--branding_brand_colors_accent_color',
      '--branding_brand_colors_highlight_color',
      '--branding_brand_colors_primary_color',
      '--branding_brand_colors_secondary_color',
      '--branding_surfaces_background_color',
      '--branding_text_interaction_text_primary',
    ])
  })

  it('leaves out every colour that is empty, so the published value shows through', () => {
    const empty = Object.fromEntries(QUICK.map((q) => [q.key, ''])) as Palette
    expect(paletteToCssVars(empty)).toEqual({})

    const noText = paletteToCssVars({ ...light, text: '' })
    expect(noText['--branding_brand_colors_primary_color']).toBe('#2119b3')
    expect(noText['--branding_text_interaction_text_primary']).toBeUndefined()
  })

  it('passes a colour that is not 6-digit hex through untouched', () => {
    const v = paletteToCssVars({ ...light, background: 'rgb(10, 20, 30)' })
    expect(v['--branding_surfaces_background_color']).toBe('rgb(10, 20, 30)')
  })
})

describe('readableOn', () => {
  it('picks the colour that reads on the given one', () => {
    expect(readableOn('#ffffff')).toBe('#111111')
    expect(readableOn('#fde047')).toBe('#111111')
    expect(readableOn('#000000')).toBe('#ffffff')
    expect(readableOn('#2119b3')).toBe('#ffffff')
  })
  it('goes by WCAG contrast, not by brightness: a mid-tone orange takes the dark text', () => {
    // #ea580c: white is 3.56:1, #111111 is 5.30:1 (a brightness cut-off picked white here).
    expect(readableOn('#ea580c')).toBe('#111111')
    for (const hex of ['#ea580c', '#16a34a', '#7c8ba1', '#0284c7', '#767676']) {
      const label = readableOn(hex)
      const other = label === '#ffffff' ? '#111111' : '#ffffff'
      expect(contrastRatio(label, hex)!, hex).toBeGreaterThanOrEqual(contrastRatio(other, hex)!)
    }
  })
  it('falls back to white for anything that is not 6-digit hex', () => {
    expect(readableOn('#fff')).toBe('#ffffff')
    expect(readableOn('rgb(255,255,255)')).toBe('#ffffff')
    expect(readableOn('')).toBe('#ffffff')
  })
})

describe('contrastWarnings', () => {
  const light = STOCK.light
  const labels = (p: Palette, buttonText?: string | null) =>
    contrastWarnings(p, buttonText).map((w) => w.label)

  it.each(['light', 'dark'] as const)(
    'finds nothing wrong with the stock %s theme and its stock white button text',
    (mode) => {
      expect(contrastWarnings(STOCK[mode], STOCK_BUTTON_TEXT)).toEqual([])
    }
  )

  it('flags text that is hard to read on the page background', () => {
    const [w] = contrastWarnings({ ...light, text: '#f3f3f8' }, STOCK_BUTTON_TEXT)
    expect(w).toMatchObject({ label: 'Text on the page background', min: 4.5 })
    expect(w!.ratio).toBeLessThan(4.5)
  })

  it('flags a main colour that sinks into the page background', () => {
    expect(labels({ ...light, primary: '#f0f0f5' }, '#111111')).toEqual([
      'Main colour against the page background',
    ])
  })

  it('flags the published button text when the main colour makes it hard to read', () => {
    // Publish never changes the button text, so this is what the live button would be:
    // white on a light sky blue.
    const dark = { ...STOCK.dark, primary: '#38bdf8' }
    const [w] = contrastWarnings(dark, STOCK_BUTTON_TEXT)
    expect(w).toMatchObject({ label: 'Button text on the main colour', min: 3 })
    expect(w!.ratio).toBeCloseTo(2.14, 1)
    expect(w!.fix).toMatch(/advanced/i)
    // and the same colour is fine once the published button text is dark
    expect(labels(dark, '#111111')).toEqual([])
    // a dark published label is just as unreadable on a dark main colour
    expect(labels({ ...light, primary: '#334155' }, '#111111')).toEqual([
      'Button text on the main colour',
    ])
  })

  it('does not judge a button text colour it cannot measure', () => {
    for (const unknown of [undefined, null, '', 'rgb(255,255,255)', '#fff']) {
      expect(labels({ ...STOCK.dark, primary: '#38bdf8' }, unknown)).toEqual([])
    }
  })

  it('does not nag about a stock theme that sits just under AA: the label bar is 3:1', () => {
    // stock dark: white on #7468f3 is 4.2:1
    expect(contrastRatio(STOCK_BUTTON_TEXT, STOCK.dark.primary)!).toBeLessThan(4.5)
    expect(labels(STOCK.dark, STOCK_BUTTON_TEXT)).toEqual([])
  })
})

describe('PRESETS', () => {
  it('give all six colours, as 6-digit hex, for both modes', () => {
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length)
    for (const p of PRESETS) {
      for (const mode of ['light', 'dark'] as const) {
        for (const q of QUICK) {
          expect(p[mode][q.key], `${p.name} ${mode} ${q.key}`).toMatch(HEX6)
        }
      }
    }
  })

  it('never trip a contrast warning with the stock white button text, dark mode included', () => {
    // Publish leaves the button text alone, so a preset whose main colour the stock white
    // cannot be read on would publish an unreadable button (Ocean dark used to: 2.1:1).
    for (const p of PRESETS) {
      for (const mode of ['light', 'dark'] as const) {
        expect(contrastWarnings(p[mode], STOCK_BUTTON_TEXT), `${p.name} ${mode}`).toEqual([])
      }
    }
  })
})

describe('tokenVar', () => {
  it('names the CSS variable the Theme Engine compiles a branding field to', () => {
    expect(tokenVar('webapp.branding.light.brand_colors.primary_color')).toBe(
      '--branding_brand_colors_primary_color'
    )
    expect(tokenVar('webapp.branding.dark.surfaces.background_color')).toBe(
      '--branding_surfaces_background_color'
    )
    expect(tokenVar('webapp.branding.light.text_interaction.text_primary')).toBe(
      '--branding_text_interaction_text_primary'
    )
  })
  it('normalises odd characters the way the backend does', () => {
    expect(tokenVar('webapp.branding.light.Brand Colors.Primary-Color')).toBe(
      '--branding_brand_colors_primary_color'
    )
  })
})

describe('fonts', () => {
  const row = (name: string, family: string) => ({
    name,
    size: 14,
    sizeUnit: 'px',
    family,
    weight: '400',
    lineHeight: 1.5,
    letterSpacing: 0,
  })
  const table = JSON.stringify([
    row('H1 (Title)', 'Sora'),
    row('H2', 'Sora'),
    row('H6', 'Poppins'),
    row('Paragraph', 'Inter'),
    row('Body', 'Inter'),
    row('List (li)', 'Inter'),
    row('Small Text', 'Inter'),
    row('Navigation', 'Inter'),
  ])
  const families = (value: string | null) =>
    (JSON.parse(value!) as { name: string; family: string }[]).map((r) => [r.name, r.family])

  describe('fontChoices', () => {
    it('reads the choice list from the JSON string the API sends, or from an object', () => {
      expect(fontChoices('{"choices":["Inter","Sora"]}')).toEqual(['Inter', 'Sora'])
      expect(fontChoices({ choices: ['Inter'] })).toEqual(['Inter'])
    })
    it('is empty for anything else', () => {
      for (const bad of [null, undefined, '', 'not json', '{}', '{"choices":"Inter"}', 42]) {
        expect(fontChoices(bad)).toEqual([])
      }
      expect(fontChoices({ choices: ['Inter', 3, null] })).toEqual(['Inter'])
    })
  })

  describe('currentFonts', () => {
    it('reads the first heading row and the first body row', () => {
      expect(currentFonts([table])).toEqual({ heading: 'Sora', body: 'Inter' })
    })
    it('skips tables that are empty, null or broken', () => {
      expect(currentFonts([null, '', 'nope', '[]', table])).toEqual({
        heading: 'Sora',
        body: 'Inter',
      })
      expect(currentFonts([null, 'nope'])).toEqual({})
    })
    it('leaves out a side that has no rows', () => {
      expect(currentFonts([JSON.stringify([row('Body', 'Lato')])])).toEqual({
        heading: undefined,
        body: 'Lato',
      })
    })
  })

  describe('applyFonts', () => {
    it('rewrites the family of every heading row, and only those, for a heading pick', () => {
      expect(families(applyFonts(table, { heading: 'Roboto' }))).toEqual([
        ['H1 (Title)', 'Roboto'],
        ['H2', 'Roboto'],
        ['H6', 'Roboto'],
        ['Paragraph', 'Inter'],
        ['Body', 'Inter'],
        ['List (li)', 'Inter'],
        ['Small Text', 'Inter'],
        ['Navigation', 'Inter'],
      ])
    })
    it('rewrites every other row for a body pick', () => {
      expect(families(applyFonts(table, { body: 'Lato' }))).toEqual([
        ['H1 (Title)', 'Sora'],
        ['H2', 'Sora'],
        ['H6', 'Poppins'],
        ['Paragraph', 'Lato'],
        ['Body', 'Lato'],
        ['List (li)', 'Lato'],
        ['Small Text', 'Lato'],
        ['Navigation', 'Lato'],
      ])
    })
    it('keeps every other column of the row', () => {
      const [first] = JSON.parse(applyFonts(table, { heading: 'Roboto' })!)
      expect(first).toEqual({ ...row('H1 (Title)', 'Roboto') })
    })
    it('returns the very same string when nothing changes', () => {
      const uniform = JSON.stringify([row('H1 (Title)', 'Sora'), row('Body', 'Inter')])
      expect(applyFonts(table, {})).toBe(table)
      expect(applyFonts(uniform, { heading: 'Sora', body: 'Inter' })).toBe(uniform)
    })
    it('makes every heading the picked font, even ones that differed (H6 is Poppins above)', () => {
      expect(families(applyFonts(table, { heading: 'Sora' }))[2]).toEqual(['H6', 'Sora'])
    })
    it('returns a value that is not a table untouched', () => {
      expect(applyFonts(null, { heading: 'Roboto' })).toBeNull()
      expect(applyFonts('nope', { heading: 'Roboto' })).toBe('nope')
      expect(applyFonts('{"a":1}', { heading: 'Roboto' })).toBe('{"a":1}')
    })
    it('does not mistake words that merely start with h for headings', () => {
      const t = JSON.stringify([row('Header', 'Lato'), row('Hero text', 'Lato')])
      expect(families(applyFonts(t, { heading: 'Roboto' }))).toEqual([
        ['Header', 'Lato'],
        ['Hero text', 'Lato'],
      ])
    })
  })

  describe('draftRows', () => {
    it('gives the rows of the first table that has any, with the picks applied', () => {
      expect(draftRows([null, '[]', 'nope', table], {}).map((r) => [r.name, r.family])).toEqual(
        JSON.parse(table).map((r: { name: string; family: string }) => [r.name, r.family])
      )
      const picked = draftRows([table], { heading: 'Roboto', body: 'Lato' })
      expect(picked.map((r) => r.family)).toEqual([
        'Roboto',
        'Roboto',
        'Roboto',
        'Lato',
        'Lato',
        'Lato',
        'Lato',
        'Lato',
      ])
    })
    it('is empty when no table has rows', () => {
      expect(draftRows([null, undefined, '', '[]', 'nope'], { heading: 'Roboto' })).toEqual([])
    })
  })

  describe('fontCssVars', () => {
    const vars = (value: string) => fontCssVars(JSON.parse(value))

    it('sets the alias th-typography.css reads for every kind of row', () => {
      expect(vars(table)).toEqual({
        '--th-typo-h1-family': '"Sora"',
        '--th-typo-h2-family': '"Sora"',
        '--th-typo-h6-family': '"Poppins"',
        '--th-typo-paragraph-family': '"Inter"',
        '--th-typo-body-family': '"Inter"',
        '--th-typo-list-family': '"Inter"',
        '--th-typo-small-family': '"Inter"',
        '--th-typo-nav-family': '"Inter"',
      })
    })
    it('follows each row, so headings that differ stay different until a font is picked', () => {
      expect(vars(table)['--th-typo-h6-family']).toBe('"Poppins"')
      const after = fontCssVars(draftRows([table], { heading: 'Roboto' }))
      for (const n of [1, 2, 6]) expect(after[`--th-typo-h${n}-family`]).toBe('"Roboto"')
      expect(after['--th-typo-body-family']).toBe('"Inter"')
    })
    it('turns a comma list into a quoted fallback stack', () => {
      const stack = JSON.stringify([row('H1 (Title)', 'Poppins, Sora')])
      expect(vars(stack)['--th-typo-h1-family']).toBe('"Poppins", "Sora"')
    })
    it('skips rows it does not know and rows without a family', () => {
      const odd = JSON.stringify([
        row('Mystery', 'Lato'),
        row('H3', ''),
        { name: 'H4' },
        { family: 'Lato' },
        row('H5', 'Lato'),
      ])
      expect(vars(odd)).toEqual({ '--th-typo-h5-family': '"Lato"' })
      expect(fontCssVars([])).toEqual({})
    })
    it('cannot be broken out of the quotes', () => {
      expect(vars(JSON.stringify([row('Body', 'Evil", x: "y')]))['--th-typo-body-family']).toBe(
        '"Evil", "x: y"'
      )
      expect(vars(JSON.stringify([row('Body', 'A\\B')]))['--th-typo-body-family']).toBe('"AB"')
    })
  })

  it('familyNames splits, trims and drops empties', () => {
    expect(familyNames(' Poppins , Sora,, ')).toEqual(['Poppins', 'Sora'])
    expect(familyNames(undefined)).toEqual([])
  })

  describe('googleFontUrl', () => {
    it('is the css2 stylesheet for the family, spaces as +', () => {
      expect(googleFontUrl('Poppins')).toBe(
        'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'
      )
      expect(googleFontUrl('Source Sans 3')).toContain('family=Source+Sans+3:wght@400;500;600;700')
    })
  })

  describe('withGoogleFonts', () => {
    // The stock Custom Fonts value: only Inter is loaded by the live site.
    const stock = JSON.stringify([
      { type: 'google', name: 'Inter', src: 'https://fonts.googleapis.com/css2?family=Inter' },
    ])
    const rowsOf = (value: string | null) =>
      JSON.parse(value!) as { type: string; name: string; src: string }[]

    it('adds a Google row for each family the list does not name yet, keeping the rows it has', () => {
      const rows = rowsOf(withGoogleFonts(stock, ['Roboto', 'Sora']))
      expect(rows.map((r) => r.name)).toEqual(['Inter', 'Roboto', 'Sora'])
      expect(rows[0]).toEqual(JSON.parse(stock)[0])
      expect(rows[1]).toEqual({ type: 'google', name: 'Roboto', src: googleFontUrl('Roboto') })
    })
    it('matches an existing row by name, ignoring case and spaces around it', () => {
      const listed = JSON.stringify([{ type: 'google', name: ' open sans ', src: 'https://x' }])
      expect(withGoogleFonts(listed, ['Open Sans'])).toBe(listed)
    })
    it('adds a family once, however often it is asked for', () => {
      expect(rowsOf(withGoogleFonts(stock, ['Lato', 'lato', 'Lato'])).map((r) => r.name)).toEqual([
        'Inter',
        'Lato',
      ])
    })
    it('adds nothing for the fonts the operating system provides', () => {
      expect(withGoogleFonts(stock, ['SF Pro', 'System UI'])).toBe(stock)
    })
    it('returns the very same string when nothing is added', () => {
      expect(withGoogleFonts(stock, [])).toBe(stock)
      expect(withGoogleFonts(stock, ['Inter'])).toBe(stock)
    })
    it('starts a list when the field is empty, and leaves a value that is not a list alone', () => {
      for (const empty of [null, '', '  ', '[]']) {
        expect(rowsOf(withGoogleFonts(empty, ['Roboto'])).map((r) => r.name)).toEqual(['Roboto'])
      }
      expect(withGoogleFonts(null, [])).toBeNull()
      for (const bad of ['nope', '{"a":1}', '"Inter"']) {
        expect(withGoogleFonts(bad, ['Roboto'])).toBe(bad)
      }
    })
    it('survives rows that are not objects', () => {
      const odd = JSON.stringify([null, 'Inter', 7])
      expect(rowsOf(withGoogleFonts(odd, ['Roboto'])).slice(-1)[0]!.name).toBe('Roboto')
    })
  })
})

describe('PREVIEW_PACKS', () => {
  const packs = { construction, general, medical }

  it('starts with Construction, then General, then Medical', () => {
    expect(PREVIEW_PACKS.map((p) => p.key)).toEqual(['construction', 'general', 'medical'])
  })

  it.each(PREVIEW_PACKS)(
    '$label: named like the pack, 3-4 blocks, every one a real renderable component',
    (preview) => {
      const pack = packs[preview.key]
      expect(preview.label).toBe(pack.label)
      expect(preview.blocks.length).toBeGreaterThanOrEqual(3)
      expect(preview.blocks.length).toBeLessThanOrEqual(4)
      for (const key of preview.blocks) {
        const block = (pack.components as Record<string, { render?: unknown }>)[key]
        expect(block, `${key} is not a component of the ${pack.key} pack`).toBeDefined()
        expect(typeof block?.render, `${key} has no render function`).toBe('function')
      }
    }
  )
})
