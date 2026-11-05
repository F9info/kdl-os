import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import baseline from './theme-token-ratchet.baseline.json'

/**
 * Theme Engine guard for page-builder blocks (site-facing files only).
 *
 * Why: a block that hard-codes `bg-slate-50` / `text-orange-600` can never follow the
 * theme. The tokens (text-title, bg-surface, bg-primary/10, bg-inverse ...) are defined in
 * tailwind.config.ts and documented in docs/theme-engine/REFERENCE.md.
 *
 * 1. RATCHET - each file may not contain more hard-coded palette colour classes than the
 *    baseline. Remaining ones are deliberate: text/overlays on photos, status colours, scrims.
 *    If you REMOVE some, lower the number in theme-token-ratchet.baseline.json (the test asks).
 *    If you must ADD one, say why in the PR and raise the number.
 * 2. VALID NAMES - every theme-token class used in these files must actually generate CSS.
 *    Tailwind silently drops unknown classes (a typo such as `text-tittle` just does nothing).
 */

const FRONTEND = process.cwd()

const FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const UTILS =
  'text|bg|border|ring|divide|from|to|via|fill|stroke|decoration|accent|caret|outline|placeholder'
const PALETTE = new RegExp(
  `(?<![\\w-])(?:[a-z0-9-]+:)*(?:${UTILS})-(?:(?:${FAMILIES})(?:-\\d{2,3})?|white|black)(?:/\\d+)?(?![\\w-])`,
  'g'
)
const TOKENS =
  'title|body|faint|divider|surface|inverse(?:-foreground)?|highlight|tertiary|primary(?:-foreground)?|secondary(?:-foreground)?|accent(?:-foreground)?|muted(?:-foreground)?|foreground|background|card(?:-foreground)?|border|destructive(?:-foreground)?|popover(?:-foreground)?|input|ring'
const TOKEN_CLASS = new RegExp(
  `(?<![\\w-])((?:[a-z0-9-]+:)*)((?:${UTILS})-(?:${TOKENS})(?:/\\d+)?)(?![\\w-])`,
  'g'
)

const files = Object.keys(baseline) as (keyof typeof baseline)[]
const read = (rel: string) => fs.readFileSync(path.join(FRONTEND, rel), 'utf8')

describe('theme tokens in site-facing blocks', () => {
  it('has a baseline entry for files that exist', () => {
    for (const rel of files) expect(fs.existsSync(path.join(FRONTEND, rel)), rel).toBe(true)
  })

  for (const rel of files) {
    it(`${rel}: hard-coded palette classes match the baseline`, () => {
      const count = (read(rel).match(PALETTE) ?? []).length
      const allowed = baseline[rel] as number
      expect(
        count,
        count > allowed
          ? `${rel} now has ${count} hard-coded palette colour classes (baseline ${allowed}). Use theme tokens (text-title, bg-surface, bg-primary/10, bg-inverse ...) so the Theme Engine can restyle the block - see docs/theme-engine/REFERENCE.md. If the colour is deliberate (on a photo, status colour, scrim) raise the number in tests/regression/theme-token-ratchet.baseline.json and say why in the PR.`
          : `${rel} improved: ${count} < baseline ${allowed}. Lower its number in tests/regression/theme-token-ratchet.baseline.json to lock the gain in.`
      ).toBe(allowed)
    })
  }

  it('every theme-token class used in these files generates CSS', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-ratchet-'))
    const input = path.join(tmp, 'in.css')
    fs.writeFileSync(input, '@tailwind utilities;')
    const bin = path.join(FRONTEND, 'node_modules', '.bin', 'tailwindcss')
    const args = ['-c', 'tailwind.config.ts', '-i', input]
    // One --content flag (the CLI keeps only the last); [slug] folders must be glob-escaped.
    args.push('--content', files.map((rel) => rel.replace(/[[\]]/g, '\\$&')).join(','))
    const css = execFileSync(bin, args, {
      cwd: FRONTEND,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const esc = (c: string) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`)
    const missing: string[] = []
    for (const rel of files) {
      for (const m of read(rel).matchAll(TOKEN_CLASS)) {
        const cls = (m[1] ?? '') + (m[2] ?? '')
        if (!css.includes(`.${esc(cls)}`)) missing.push(`${rel}: ${cls}`)
      }
    }
    expect(
      [...new Set(missing)],
      'theme classes that generate no CSS (typo or unknown name)'
    ).toEqual([])
  }, 120_000)
})
