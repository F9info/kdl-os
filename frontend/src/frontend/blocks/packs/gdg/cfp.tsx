'use client'

// Call for speakers: the talk proposal form of the current DevFest edition. It is open while
// Admin → GDG Chapter → DevFest → Edit edition has "Take talk proposals" on and the closing time has
// not passed; proposals land in that page's Proposals tab. Every text here is a block field.
import { useEffect, useId, useRef, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import api from '@/lib/axios'
import { Gdg, TZ, area, lines, sfx, text, useDevfestData, withYear, type AnyBlock } from './lib'
import { ext } from './chrome'

type Puck = { puck?: { metadata?: Record<string, unknown> } }
const projectOf = (puck: Puck['puck']) => puck?.metadata?.projectId as string | undefined

const FORMATS = [
  { value: 'talk', label: 'Talk · 30 min' },
  { value: 'lightning', label: 'Lightning · 10 min' },
  { value: 'workshop', label: 'Workshop / code lab' },
  { value: 'panel', label: 'Panel' },
]
const LEVELS = ['Beginner', 'Intermediate', 'Advanced']

type Values = {
  name: string
  email: string
  phone: string
  city: string
  role: string
  company: string
  bio: string
  linkedin: string
  website: string
  title: string
  format: string
  track: string
  level: string
  abstract: string
  notes: string
  first_time: boolean
  consent: boolean
  company_site: string
}
const EMPTY: Values = {
  name: '',
  email: '',
  phone: '',
  city: '',
  role: '',
  company: '',
  bio: '',
  linkedin: '',
  website: '',
  title: '',
  format: 'talk',
  track: '',
  level: '',
  abstract: '',
  notes: '',
  first_time: false,
  consent: false,
  company_site: '',
}

const MAX_PHOTO = 5 * 1024 * 1024
const PHOTO_NEEDED = 'Add your photo. We show it on the website if your talk is selected.'
/** Fields in page order, so the first mistake on the page gets the focus. */
const FIELD_ORDER = [
  'name',
  'email',
  'bio',
  'linkedin',
  'website',
  'photo',
  'title',
  'track',
  'abstract',
  'consent',
]
const isLink = (v: string) => /^https?:\/\/\S+$/i.test(v.trim())

/** The same rules the server checks, so mistakes show next to the field before sending. */
function check(v: Values, needTrack: boolean): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {}
  if (v.name.trim().length < 2) e.name = 'Add your name.'
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Add a valid email.'
  if (v.bio.trim().length < 30) e.bio = 'Tell us a little more about you (30+ characters).'
  for (const k of ['linkedin', 'website'] as const) {
    if (v[k].trim() && !isLink(v[k])) e[k] = 'Use a full link starting with https://'
  }
  if (v.title.trim().length < 5) e.title = 'Add a talk title.'
  if (needTrack && !v.track) e.track = 'Pick a track.'
  if (v.abstract.trim().length < 80)
    e.abstract = 'Describe the talk in a few sentences (80+ characters).'
  if (!v.consent) e.consent = 'Please agree so we can contact you.'
  return e
}

const closingLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

type CfpProps = {
  eyebrow: string
  title: string
  sub: string
  lookFor: string
  closedTitle: string
  closedText: string
  closedButton: string
  closedHref: string
  consentText: string
  thanksTitle: string
  thanksText: string
}

const DEFAULTS: CfpProps = {
  eyebrow: 'Call for speakers',
  title: 'Speak at DevFest Vizag {year}',
  sub: 'Share what you have built, broken and learned. First-time speakers are very welcome, and we help you get stage-ready.',
  lookFor: [
    'Real experience | Things you built or shipped, with the lessons, not a product pitch.',
    'Something to take home | People should leave able to try it the same week.',
    'Local voices | Vizag and Andhra builders, students and founders first.',
    'All levels | A clear beginner talk is as valuable as a deep dive.',
  ].join('\n'),
  closedTitle: 'The call for speakers is closed',
  closedText: 'Follow GDG Vizag to hear when the next one opens.',
  closedButton: 'Follow GDG Vizag',
  closedHref: 'https://gdg.community.dev/gdg-vizag/',
  consentText:
    'GDG Vizag may contact me about this proposal and, if it is selected, show my name, photo and bio on the website.',
  thanksTitle: 'Thanks, your proposal is in!',
  thanksText:
    'We read every proposal after the call closes and email everyone with the result. You can send up to three.',
}

export const GdgCallForSpeakers: ComponentConfig<CfpProps> = {
  label: 'GDG DevFest Call for Speakers',
  fields: {
    eyebrow: text('Small label on top'),
    title: text('Title ({year} = the edition year)'),
    sub: area('Intro'),
    lookFor: area('"What we look for", one per line: "Heading | text"'),
    closedTitle: text('Title while the call is closed'),
    closedText: area('Text while the call is closed'),
    closedButton: text('Button while closed (leave empty for none)'),
    closedHref: text('Button link while closed'),
    consentText: area('Consent checkbox text'),
    thanksTitle: text('Title after sending'),
    thanksText: area('Text after sending'),
  },
  defaultProps: DEFAULTS,
  render: function Render({ puck, ...raw }) {
    // Pages saved before a field existed fall back to its default.
    const p = Object.fromEntries(
      Object.entries(DEFAULTS).map(([k, v]) => [
        k,
        (raw as Partial<CfpProps>)[k as keyof CfpProps] ?? v,
      ])
    ) as CfpProps
    const pid = projectOf(puck)
    const hid = 'cfp-' + useId().replace(/[^a-zA-Z0-9]/g, '')
    return (
      <Gdg>
        <section id="speak" className="block cfp" aria-labelledby={hid}>
          <CallForSpeakers pid={pid} p={p} headingId={hid} />
        </section>
      </Gdg>
    )
  },
}

/** The call for speakers: heading, "what we look for" (not in the pop-up), then the form or its closed / sent state. */
function CallForSpeakers({
  pid,
  p,
  inDialog = false,
  headingId,
}: {
  pid?: string
  p: CfpProps
  inDialog?: boolean
  headingId?: string
}) {
  const { edition, isLoading } = useDevfestData(pid)
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const [v, setV] = useState<Values>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({})
  const [sending, setSending] = useState(false)
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState<{ name: string; title: string; email: string } | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoErr, setPhotoErr] = useState('')
  const [preview, setPreview] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!photo) return setPreview('')
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])
  const pickPhoto = (file: File | undefined) => {
    setPhotoErr('')
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type))
      return setPhotoErr('Use a JPG, PNG or WebP image.')
    if (file.size > MAX_PHOTO) return setPhotoErr('The photo must be 5 MB or smaller.')
    setPhoto(file)
  }

  const tracks = edition?.tracks?.map((t) => t.name).filter(Boolean) ?? []
  const open = Boolean(edition?.cfpOpen)
  const outside = edition?.cfp ?? ''
  const looks = lines(p.lookFor, 2).filter(([h]) => h)
  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((s) => ({ ...s, [k]: val }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const id = (k: string) => `${uid}-${k}`
  const err = (k: keyof Values) =>
    errors[k] ? (
      <span className="cfp-err" id={id(`${k}-err`)}>
        {errors[k]}
      </span>
    ) : null
  const aria = (k: keyof Values) => ({
    id: id(k),
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? id(`${k}-err`) : undefined,
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError('')
    const found = check(v, tracks.length > 0)
    setErrors(found)
    // The photo is required: it is shown on the website if the talk is selected.
    if (!photo) setPhotoErr(PHOTO_NEEDED)
    const failed = [...Object.keys(found), ...(photo ? [] : ['photo'])]
    if (failed.length) {
      const first = FIELD_ORDER.find((k) => failed.includes(k)) ?? failed[0] ?? ''
      document.getElementById(id(first === 'photo' ? 'photo-btn' : first))?.focus()
      return
    }
    setSending(true)
    try {
      const body: Record<string, unknown> = { project_id: pid || undefined }
      for (const [k, val] of Object.entries(v)) {
        body[k] = typeof val === 'string' ? val.trim() || undefined : val
      }
      if (photo) {
        // One request: the answers as JSON plus the photo file.
        const fd = new FormData()
        fd.append('data', JSON.stringify(body))
        fd.append('photo', photo)
        await api.post('/gdg/devfest/proposals/public', fd)
      } else {
        await api.post('/gdg/devfest/proposals/public', body)
      }
      setSent({
        name: v.name.trim().split(/\s+/)[0] ?? '',
        title: v.title.trim(),
        email: v.email.trim(),
      })
      setV((s) => ({
        ...EMPTY,
        name: s.name,
        email: s.email,
        phone: s.phone,
        city: s.city,
        role: s.role,
        company: s.company,
        bio: s.bio,
        linkedin: s.linkedin,
        website: s.website,
      }))
      sfx('win')
    } catch (x) {
      const res = (x as { response?: { data?: { message?: string } } }).response
      setServerError(
        res?.data?.message || 'Could not send it. Check your connection and try again.'
      )
    } finally {
      setSending(false)
    }
  }

  const head = (
    <div className="cfp-head">
      <span className="cfp-eyebrow">{p.eyebrow}</span>
      <h2 id={headingId ?? id('h')}>{withYear(p.title, edition?.year)}</h2>
      <p className="sub">{p.sub}</p>
      {open && edition?.cfpCloses ? (
        <p className="cfp-deadline">Closes {closingLabel(edition.cfpCloses)} IST</p>
      ) : null}
    </div>
  )

  return (
    <>
      {head}
      {looks.length && !inDialog ? (
        <ul className="cfp-look">
          {looks.map(([h, t], i) => (
            <li key={i} className={`tone-${['blue', 'red', 'yellow', 'green'][i % 4]}`}>
              <b>{h}</b>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {isLoading ? null : !open ? (
        <div className="cfp-closed">
          {outside ? (
            <>
              <b>Send your proposal</b>
              <p>Proposals for this edition are collected on another site.</p>
              <a className="btn" href={outside} {...ext(outside)}>
                Open the call for speakers
              </a>
            </>
          ) : (
            <>
              <b>{p.closedTitle}</b>
              <p>{p.closedText}</p>
              {p.closedButton && p.closedHref ? (
                <a className="btn btn-tonal" href={p.closedHref} {...ext(p.closedHref)}>
                  {p.closedButton}
                </a>
              ) : null}
            </>
          )}
        </div>
      ) : sent ? (
        <div className="cfp-thanks" role="status">
          <b>{p.thanksTitle}</b>
          <p>
            {sent.name ? `${sent.name}, we` : 'We'} got “{sent.title}”. {p.thanksText} We will write
            to {sent.email}.
          </p>
          <button className="btn btn-tonal" type="button" onClick={() => setSent(null)}>
            Send another proposal
          </button>
        </div>
      ) : (
        <form className="cfp-form" onSubmit={submit} noValidate>
          <fieldset>
            <legend>About you</legend>
            <div className="cfp-grid">
              <label className="field">
                Name *
                <input
                  {...aria('name')}
                  autoComplete="name"
                  value={v.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                {err('name')}
              </label>
              <label className="field">
                Email *
                <input
                  {...aria('email')}
                  type="email"
                  autoComplete="email"
                  value={v.email}
                  onChange={(e) => set('email', e.target.value)}
                />
                {err('email')}
              </label>
              <label className="field">
                Phone
                <input
                  {...aria('phone')}
                  type="tel"
                  autoComplete="tel"
                  value={v.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </label>
              <label className="field">
                City
                <input
                  {...aria('city')}
                  autoComplete="address-level2"
                  value={v.city}
                  onChange={(e) => set('city', e.target.value)}
                />
              </label>
              <label className="field">
                Role
                <input
                  {...aria('role')}
                  placeholder="e.g. Android engineer, student"
                  autoComplete="organization-title"
                  value={v.role}
                  onChange={(e) => set('role', e.target.value)}
                />
              </label>
              <label className="field">
                Company or college
                <input
                  {...aria('company')}
                  autoComplete="organization"
                  value={v.company}
                  onChange={(e) => set('company', e.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Short bio * <small>As it would appear on the website</small>
              <textarea
                {...aria('bio')}
                rows={4}
                maxLength={1500}
                value={v.bio}
                onChange={(e) => set('bio', e.target.value)}
              />
              <small className="cfp-count">{v.bio.trim().length} / 1500</small>
              {err('bio')}
            </label>
            <div className="cfp-grid">
              <label className="field">
                LinkedIn
                <input
                  {...aria('linkedin')}
                  type="url"
                  placeholder="https://linkedin.com/in/…"
                  value={v.linkedin}
                  onChange={(e) => set('linkedin', e.target.value)}
                />
                {err('linkedin')}
              </label>
              <label className="field">
                Website, GitHub or portfolio
                <input
                  {...aria('website')}
                  type="url"
                  placeholder="https://…"
                  value={v.website}
                  onChange={(e) => set('website', e.target.value)}
                />
                {err('website')}
              </label>
            </div>
            <div className="field cfp-photo">
              <span>
                Your photo * <small>A clear headshot, JPG, PNG or WebP, up to 5 MB</small>
              </span>
              <div className="cfp-photo-row">
                <span className="cfp-photo-preview" aria-hidden="true">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
                    <img src={preview} alt="" />
                  ) : (
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="9" r="4" />
                      <path d="M4 21a8 7 0 0 1 16 0" />
                    </svg>
                  )}
                </span>
                <button
                  id={id('photo-btn')}
                  className="btn btn-sm btn-tonal"
                  type="button"
                  aria-describedby={photoErr ? id('photo-err') : undefined}
                  onClick={() => fileRef.current?.click()}
                >
                  {photo ? 'Change photo' : 'Upload photo'}
                </button>
                {photo ? (
                  <button
                    className="btn btn-sm btn-ghost"
                    type="button"
                    onClick={() => {
                      setPhoto(null)
                      setPhotoErr('')
                    }}
                  >
                    Remove
                  </button>
                ) : null}
                <input
                  ref={fileRef}
                  id={id('photo')}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    pickPhoto(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </div>
              {photo ? <small>{photo.name}</small> : null}
              {photoErr ? (
                <span className="cfp-err" id={id('photo-err')}>
                  {photoErr}
                </span>
              ) : null}
            </div>
          </fieldset>

          <fieldset>
            <legend>Your talk</legend>
            <label className="field">
              Talk title *
              <input
                {...aria('title')}
                maxLength={150}
                value={v.title}
                onChange={(e) => set('title', e.target.value)}
              />
              {err('title')}
            </label>
            <fieldset className="choice">
              <legend>Format</legend>
              {FORMATS.map((f) => (
                <label key={f.value}>
                  <input
                    type="radio"
                    name={id('format')}
                    checked={v.format === f.value}
                    onChange={() => set('format', f.value)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </fieldset>
            {tracks.length ? (
              <fieldset
                className="choice"
                aria-describedby={errors.track ? id('track-err') : undefined}
              >
                <legend>Track *</legend>
                {tracks.map((t, i) => (
                  <label key={t}>
                    <input
                      type="radio"
                      name={id('track')}
                      id={i === 0 ? id('track') : undefined}
                      checked={v.track === t}
                      onChange={() => set('track', t)}
                    />
                    <span>{t}</span>
                  </label>
                ))}
                {err('track')}
              </fieldset>
            ) : null}
            <fieldset className="choice">
              <legend>Level</legend>
              {LEVELS.map((l) => (
                <label key={l}>
                  <input
                    type="radio"
                    name={id('level')}
                    checked={v.level === l}
                    onChange={() => set('level', l)}
                  />
                  <span>{l}</span>
                </label>
              ))}
            </fieldset>
            <label className="field">
              Abstract * <small>What will people learn? How is the time spent?</small>
              <textarea
                {...aria('abstract')}
                rows={6}
                maxLength={3000}
                value={v.abstract}
                onChange={(e) => set('abstract', e.target.value)}
              />
              <small className="cfp-count">{v.abstract.trim().length} / 3000</small>
              {err('abstract')}
            </label>
            <label className="field">
              Anything else for the organizers? <small>Optional</small>
              <textarea
                {...aria('notes')}
                rows={3}
                maxLength={1000}
                value={v.notes}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>
          </fieldset>

          {/* A trap for bots: hidden from people and screen readers. */}
          <div className="cfp-trap" aria-hidden="true">
            <label>
              Company site
              <input
                tabIndex={-1}
                autoComplete="off"
                value={v.company_site}
                onChange={(e) => set('company_site', e.target.value)}
              />
            </label>
          </div>

          <label className="cfp-check">
            <input
              type="checkbox"
              checked={v.first_time}
              onChange={(e) => set('first_time', e.target.checked)}
            />
            <span>This would be my first time speaking at an event</span>
          </label>
          <label className="cfp-check">
            <input
              type="checkbox"
              {...aria('consent')}
              checked={v.consent}
              onChange={(e) => set('consent', e.target.checked)}
            />
            <span>{p.consentText} *</span>
          </label>
          {err('consent')}

          {serverError ? (
            <p className="cfp-err" role="alert">
              {serverError}
            </p>
          ) : null}
          <div className="cta">
            <button className="btn" type="submit" disabled={sending}>
              {sending ? 'Sending…' : 'Send my proposal'}
            </button>
          </div>
        </form>
      )}
    </>
  )
}

/**
 * The call for speakers in a pop-up (used by the Get involved cards). Opens on demand, and by itself
 * when the address ends in #speak, so "/devfest/program#speak" links open it.
 */
export function CallForSpeakersPopup({
  pid,
  open,
  onClose,
}: {
  pid?: string
  open: boolean
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const hid = 'cfpd-' + useId().replace(/[^a-zA-Z0-9]/g, '')
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className="dlg cfp-dlg"
      aria-labelledby={hid}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
    >
      <form method="dialog">
        <button className="dlg-x" aria-label="Close">
          Close
        </button>
      </form>
      {open ? <CallForSpeakers pid={pid} p={DEFAULTS} inDialog headingId={hid} /> : null}
    </dialog>
  )
}

export const cfpComponents: Record<string, AnyBlock> = { GdgCallForSpeakers }
