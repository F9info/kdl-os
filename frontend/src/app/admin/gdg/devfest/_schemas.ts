import { z } from 'zod'

// Field lists for the DevFest admin forms. One list per record kind drives the form, its zod
// validation and the conversion to and from the API (`/gdg/devfest/<kind>`).

export type Kind = 'editions' | 'speakers' | 'sessions' | 'sponsors' | 'team'
export type ChildKind = Exclude<Kind, 'editions'>

export type FieldType =
  | 'text'
  | 'textarea'
  | 'url'
  | 'image'
  | 'datetime'
  | 'number'
  | 'select'
  | 'track'
  | 'switch'
  | 'speakers'
  | 'links'
  | 'tracks'
  | 'stats'
  | 'list'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  hint?: string
  placeholder?: string
  options?: readonly { value: string; label: string }[]
  /** Takes the whole row of the form grid. */
  wide?: boolean
}

export type FormValue = string | boolean | string[]
export type FormValues = Record<string, FormValue>
export type ApiRecord = Record<string, unknown> & { id: string }

const opts = (...values: string[]) => values.map((v) => ({ value: v, label: v }))

export const SESSION_KINDS = [
  { value: 'talk', label: 'Talk' },
  { value: 'keynote', label: 'Keynote' },
  { value: 'workshop', label: 'Workshop / code lab' },
  { value: 'panel', label: 'Panel' },
  { value: 'break', label: 'Break / registration' },
] as const
export const LEVELS = opts('Beginner', 'Intermediate', 'Advanced')
export const SPONSOR_TIERS = [
  { value: 'title', label: 'Title sponsor' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'community', label: 'Community partner' },
  { value: 'partner', label: 'Partner' },
] as const

const SHOWN: FieldDef = { name: 'is_visible', label: 'Shown on the website', type: 'switch' }
const ORDER: FieldDef = {
  name: 'sort_order',
  label: 'Order',
  type: 'number',
  hint: 'Lower numbers come first',
}
const SLUG: FieldDef = {
  name: 'slug',
  label: 'Web address',
  type: 'text',
  hint: 'Made from the name when left empty',
  placeholder: 'e.g. jane-doe',
}

export const FIELDS: Record<Kind, FieldDef[]> = {
  editions: [
    { name: 'year', label: 'Year', type: 'number', required: true },
    {
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      placeholder: 'DevFest Vizag 2026',
    },
    { name: 'theme', label: 'Theme or tagline', type: 'text', wide: true },
    { name: 'start_date', label: 'Starts', type: 'datetime' },
    { name: 'end_date', label: 'Ends', type: 'datetime' },
    { name: 'venue', label: 'Venue', type: 'text' },
    { name: 'map_url', label: 'Map link', type: 'url', placeholder: 'https://maps.google.com/…' },
    { name: 'venue_address', label: 'Venue address', type: 'textarea', wide: true },
    { name: 'ticket_url', label: 'Tickets link', type: 'url' },
    {
      name: 'cfp_url',
      label: 'Outside call for speakers link',
      type: 'url',
      hint: 'Only if proposals go to another site (e.g. Sessionize). Leave empty to use the form here.',
    },
    { name: 'cfp_closes', label: 'Call for speakers closes', type: 'datetime' },
    {
      name: 'cfp_open',
      label: 'Take talk proposals on the website (call for speakers form)',
      type: 'switch',
      wide: true,
      hint: 'The form closes by itself at the closing time above. Proposals arrive in the Proposals tab.',
    },
    {
      name: 'tracks',
      label: 'Tracks',
      type: 'tracks',
      wide: true,
      hint: 'One per line. Add a colour after a bar if you like: "Web | #4285f4"',
    },
    {
      name: 'stats',
      label: 'Headline numbers',
      type: 'stats',
      wide: true,
      hint: 'One per line: "Attendees | 1200+"',
    },
    {
      name: 'is_current',
      label: 'This is the edition the website shows',
      type: 'switch',
      wide: true,
    },
  ],
  speakers: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'role', label: 'Role', type: 'text', placeholder: 'e.g. GDE Flutter & Dart' },
    { name: 'company', label: 'Company', type: 'text' },
    { name: 'photo_url', label: 'Photo', type: 'image' },
    { name: 'bio', label: 'Short bio', type: 'textarea', wide: true },
    {
      name: 'links',
      label: 'Links',
      type: 'links',
      wide: true,
      hint: 'One per line: "LinkedIn | https://…"',
    },
    {
      name: 'badges',
      label: 'Badges',
      type: 'list',
      hint: 'Comma separated, e.g. GDE, WTM Ambassador',
    },
    SLUG,
    { name: 'is_featured', label: 'Featured (shown first)', type: 'switch' },
    SHOWN,
    ORDER,
  ],
  sessions: [
    { name: 'title', label: 'Title', type: 'text', required: true, wide: true },
    { name: 'kind', label: 'Type', type: 'select', required: true, options: SESSION_KINDS },
    { name: 'track', label: 'Track', type: 'track' },
    { name: 'level', label: 'Level', type: 'select', options: LEVELS },
    { name: 'room', label: 'Room', type: 'text', placeholder: 'e.g. Main hall' },
    { name: 'starts_at', label: 'Starts', type: 'datetime' },
    { name: 'ends_at', label: 'Ends', type: 'datetime' },
    { name: 'speaker_ids', label: 'Speakers', type: 'speakers', wide: true },
    { name: 'abstract', label: 'Abstract', type: 'textarea', wide: true },
    { name: 'slides_url', label: 'Slides link', type: 'url' },
    { name: 'video_url', label: 'Video link', type: 'url' },
    { ...SLUG, hint: 'Made from the title when left empty', placeholder: 'e.g. opening-keynote' },
    SHOWN,
    ORDER,
  ],
  sponsors: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'tier', label: 'Tier', type: 'select', required: true, options: SPONSOR_TIERS },
    { name: 'logo_url', label: 'Logo', type: 'image' },
    { name: 'url', label: 'Website', type: 'url' },
    SHOWN,
    ORDER,
  ],
  team: [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'role', label: 'Role', type: 'text', placeholder: 'e.g. Organizer, Volunteer lead' },
    { name: 'photo_url', label: 'Photo', type: 'image' },
    { name: 'url', label: 'Profile link', type: 'url' },
    SHOWN,
    ORDER,
  ],
}

export const LABELS: Record<Kind, { one: string; many: string }> = {
  editions: { one: 'edition', many: 'Editions' },
  speakers: { one: 'speaker', many: 'Speakers' },
  sessions: { one: 'session', many: 'Sessions' },
  sponsors: { one: 'sponsor', many: 'Sponsors' },
  team: { one: 'team member', many: 'Team' },
}

// ─── Text forms of the structured fields ─────────────────────────────────────

const splitLines = (v: string) =>
  v
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
const pair = (line: string): [string, string] => {
  const at = line.indexOf('|')
  return at < 0 ? [line.trim(), ''] : [line.slice(0, at).trim(), line.slice(at + 1).trim()]
}
const isLink = (v: string) => /^https?:\/\/\S+$/i.test(v) || v.startsWith('/')

// <input type="datetime-local"> works in local time; the API stores UTC.
export const toLocalInput = (iso: unknown) => {
  if (typeof iso !== 'string' || !iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

/** Form values for a record (or the empty form when `item` is null). */
export function toForm(kind: Kind, item: ApiRecord | null): FormValues {
  const out: FormValues = {}
  for (const f of FIELDS[kind]) {
    const v = item?.[f.name]
    switch (f.type) {
      case 'switch':
        out[f.name] = item ? Boolean(v) : f.name === 'is_visible'
        break
      case 'datetime':
        out[f.name] = toLocalInput(v)
        break
      case 'number':
        out[f.name] =
          v === undefined || v === null
            ? f.name === 'year'
              ? String(new Date().getFullYear())
              : '0'
            : String(v)
        break
      case 'speakers':
        out[f.name] = Array.isArray(v) ? (v as string[]) : []
        break
      case 'list':
        out[f.name] = Array.isArray(v) ? (v as string[]).join(', ') : ''
        break
      case 'links':
        out[f.name] =
          v && typeof v === 'object'
            ? Object.entries(v as Record<string, string>)
                .map(([k, url]) => `${k} | ${url}`)
                .join('\n')
            : ''
        break
      case 'tracks':
        out[f.name] = Array.isArray(v)
          ? (v as { name: string; color?: string }[])
              .map((t) => (t.color ? `${t.name} | ${t.color}` : t.name))
              .join('\n')
          : ''
        break
      case 'stats':
        out[f.name] = Array.isArray(v)
          ? (v as { label: string; value: string }[])
              .map((s) => `${s.label} | ${s.value}`)
              .join('\n')
          : ''
        break
      case 'select':
        out[f.name] =
          typeof v === 'string' && v ? v : f.required ? (f.options?.[0]?.value ?? '') : ''
        break
      default:
        out[f.name] = typeof v === 'string' ? v : ''
    }
  }
  return out
}

/** The API body for a form. Empty text becomes null so a cleared field is cleared on save. */
export function toPayload(kind: Kind, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of FIELDS[kind]) {
    const v = values[f.name]
    const s = typeof v === 'string' ? v.trim() : ''
    switch (f.type) {
      case 'switch':
        out[f.name] = Boolean(v)
        break
      case 'datetime':
        out[f.name] = fromLocalInput(s)
        break
      case 'number':
        out[f.name] = Number(s) || 0
        break
      case 'speakers':
        out[f.name] = Array.isArray(v) ? v : []
        break
      case 'list':
        out[f.name] = s
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean)
        break
      case 'links':
        out[f.name] = Object.fromEntries(splitLines(s).map(pair))
        break
      case 'tracks':
        out[f.name] = splitLines(s)
          .map(pair)
          .map(([name, color]) => ({ name, color }))
        break
      case 'stats':
        out[f.name] = splitLines(s)
          .map(pair)
          .map(([label, value]) => ({ label, value }))
        break
      case 'text':
        // A slug left empty is made from the name on the server.
        out[f.name] = f.name === 'slug' ? s : s || null
        break
      default:
        out[f.name] = s || null
    }
  }
  return out
}

// ─── Validation ──────────────────────────────────────────────────────────────

const text = (f: FieldDef) => {
  const base = z.string().max(f.type === 'textarea' ? 4000 : 300)
  return f.required ? base.trim().min(2, `${f.label} is required`) : base
}

function fieldSchema(f: FieldDef): z.ZodTypeAny {
  switch (f.type) {
    case 'switch':
      return z.boolean()
    case 'speakers':
      return z.array(z.string()).max(10, 'At most 10 speakers')
    case 'number':
      return f.name === 'year'
        ? z.string().regex(/^(20\d\d|2100)$/, 'Use a year like 2026')
        : z.string().regex(/^\d{0,5}$/, 'Numbers only')
    case 'url':
    case 'image':
      return z
        .string()
        .max(1000)
        .refine((v) => !v.trim() || isLink(v.trim()), 'Use a full http(s) link or a site path')
    case 'links':
      return z.string().refine(
        (v) =>
          splitLines(v).every((l) => {
            const [k, url] = pair(l)
            return Boolean(k) && /^https?:\/\/\S+$/i.test(url)
          }),
        'Each line needs a label, a bar and a full link: "LinkedIn | https://…"'
      )
    case 'stats':
      return z
        .string()
        .refine(
          (v) => splitLines(v).every((l) => pair(l).every(Boolean)),
          'Each line needs a label and a value: "Attendees | 1200+"'
        )
    case 'select':
      return f.required ? z.string().min(1, `Pick a ${f.label.toLowerCase()}`) : z.string()
    case 'text':
      return f.name === 'slug'
        ? z
            .string()
            .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, 'Lowercase letters, numbers and dashes only')
        : text(f)
    default:
      return text(f)
  }
}

const RANGES: Partial<Record<Kind, [string, string]>> = {
  editions: ['start_date', 'end_date'],
  sessions: ['starts_at', 'ends_at'],
}

export function formSchema(kind: Kind) {
  const shape = Object.fromEntries(FIELDS[kind].map((f) => [f.name, fieldSchema(f)]))
  const range = RANGES[kind]
  const base = z.object(shape)
  if (!range) return base
  const [a, b] = range
  return base.refine((v) => !v[a] || !v[b] || String(v[b]) >= String(v[a]), {
    message: 'The end must be after the start',
    path: [b],
  })
}
