'use client'

// Community page blocks, ported from the GDG Vizag site (community.html + community.js, and the closed
// states register.js shows once an event has ended). Live registration (teams, stages) is a later phase:
// a hackathon card shows its closed state, or links out when `registerHref` is set.
import { useEffect, useRef, useState } from 'react'
import type { ComponentConfig } from '@puckeditor/core'
import { Gdg, area, dateLabel, lines, text, useDevfestData, useGdgFeed, type AnyBlock } from './lib'
import { ext } from './chrome'
import { CallForSpeakersPopup } from './cfp'

// ─── Hackathon / event card ──────────────────────────────────────────────────

type HackathonProps = {
  sectionId: string
  eyebrow: string
  title: string
  meta: string
  feedMatch: string
  body: string
  closedLead: string
  closedText: string
  buttonLabel: string
  hideLabel: string
  registerHref: string
  eventName: string
  loginLabel: string
  loginHref: string
  themesTitle: string
  themesNote: string
  posterUrl: string
  posterAlt: string
  posterLabel: string
  materialsTitle: string
  materials: string
}

/** A user-supplied pattern; an invalid one simply never matches. */
const safeRegex = (src: string) => {
  try {
    return src ? new RegExp(src, 'i') : null
  } catch {
    return null
  }
}

export const GdgHackathonCard: ComponentConfig<HackathonProps> = {
  label: 'GDG Hackathon / Event Card',
  fields: {
    sectionId: text('Section id (for #links)'),
    eyebrow: text('Status line'),
    title: text('Title'),
    meta: text('Date and venue line'),
    feedMatch: text('Fill date and venue from the synced event whose title matches (optional)'),
    body: area('Description'),
    closedLead: text('Closed note: bold part'),
    closedText: area('Closed note: rest'),
    buttonLabel: text('Button label'),
    hideLabel: text('Button label while the message is open'),
    registerHref: text('Registration link (optional: when set, the button goes there)'),
    eventName: text('Event name in the closed message'),
    loginLabel: text('Log in button'),
    loginHref: text('Log in link'),
    themesTitle: text('Themes title (optional)'),
    themesNote: area('Themes note'),
    posterUrl: text('Themes poster image URL (optional)'),
    posterAlt: area('Poster alt text'),
    posterLabel: text('Poster download label'),
    materialsTitle: text('Materials title (optional)'),
    materials: area('Materials ("Label | link | note" per line)'),
  },
  defaultProps: {
    sectionId: 'local2global',
    eyebrow: 'Completed · Registration closed',
    title: 'Local2Global Hack : GDGVIZAG',
    meta: '5–6 November 2026 · 9:00 AM IST · Gayatri Vidya Parishad College of Engineering (Autonomous), Visakhapatnam',
    feedMatch: '',
    body: 'A 24-hour hackathon for Gayatri Vidya Parishad students in Visakhapatnam. Spot a local problem, build a solution with Google tools, and compete for prizes. Expect tech sessions, mentorship and fun activities, with a focus on projects that matter globally.',
    closedLead: 'This event has ended.',
    closedText:
      'Registration, team building and submissions are closed, and no new teams or members can be added. Teams that took part can log in to see their submission.',
    buttonLabel: 'Event closed',
    hideLabel: 'Hide this message',
    registerHref: '',
    eventName: 'Local2Global Hack',
    loginLabel: 'Log in',
    loginHref: '/membership/login',
    themesTitle: 'Hackathon themes (problem statements)',
    themesNote:
      'Pick one of the 8 tracks. Every pitch must answer: Local, which Vizag problem and who does it affect? Global, how can it work in any city or country?',
    posterUrl: '/gdg/local2global-themes.jpg',
    posterAlt:
      'Local2Global Hack themes: 1 Health for All, 2 EdTech and Skills, 3 Green Vizag, 4 Civic Tech and Governance, 5 Local Business and Livelihoods, 6 Safety and Inclusion, 7 AgriTech, 8 Open Innovation. Each track lists a local problem, the global angle and example ideas.',
    posterLabel: 'Download the themes poster (JPG)',
    materialsTitle: '',
    materials: '',
  },
  render: function Render({ puck, ...p }) {
    const [open, setOpen] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const projectId = puck?.metadata?.projectId as string | undefined
    const { events } = useGdgFeed(projectId)
    const re = safeRegex(p.feedMatch)
    const synced = re ? events.find((e) => re.test(e.title)) : undefined
    const meta = synced ? [dateLabel(synced), synced.venue].filter(Boolean).join(' · ') : p.meta
    const id = p.sectionId || 'event'
    const materials = lines(p.materials, 3)
    const toggle = () => {
      const next = !open
      setOpen(next)
      if (next)
        requestAnimationFrame(() =>
          panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        )
    }
    return (
      <Gdg>
        <section id={id} className="block hk" aria-labelledby={`${id}-h`}>
          <div className="hk-card">
            <div className="hk-card-copy">
              {p.eyebrow ? <p className="presents">{p.eyebrow}</p> : null}
              <h2 id={`${id}-h`}>{p.title}</h2>
              {meta ? <p className="sub">{meta}</p> : null}
              {p.body ? <p>{p.body}</p> : null}
              {p.closedLead || p.closedText ? (
                <p>
                  {p.closedLead ? <b>{p.closedLead}</b> : null}
                  {p.closedLead && p.closedText ? ' ' : null}
                  {p.closedText}
                </p>
              ) : null}
              {p.buttonLabel ? (
                <div className="cta">
                  {p.registerHref ? (
                    <a className="btn" href={p.registerHref} {...ext(p.registerHref)}>
                      {p.buttonLabel}
                    </a>
                  ) : (
                    <button
                      className="btn"
                      type="button"
                      aria-expanded={open}
                      aria-controls={`${id}-panel`}
                      onClick={toggle}
                    >
                      {open ? p.hideLabel : p.buttonLabel}
                    </button>
                  )}
                </div>
              ) : null}
              {p.themesTitle || p.posterUrl ? (
                <div className="hk-materials hk-themes">
                  {p.themesTitle ? <h3>{p.themesTitle}</h3> : null}
                  {p.themesNote ? <p className="hk-note">{p.themesNote}</p> : null}
                  {p.posterUrl ? (
                    <>
                      <a
                        className="hk-themes-img"
                        href={p.posterUrl}
                        target="_blank"
                        rel="noopener"
                      >
                        <img src={p.posterUrl} alt={p.posterAlt} loading="lazy" />
                      </a>
                      <ul>
                        <li>
                          <a href={p.posterUrl} download>
                            {p.posterLabel}
                          </a>
                        </li>
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}
              {p.materialsTitle && materials.length ? (
                <div className="hk-materials">
                  <h3>{p.materialsTitle}</h3>
                  <ul>
                    {materials.map(([label, href, note]) => (
                      <li key={`${label}${href}`}>
                        <a href={href || '#'} download>
                          {label}
                        </a>
                        {note ? (
                          <>
                            {' '}
                            <small>{note}</small>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
          <div className="hk-panel" id={`${id}-panel`} ref={panelRef} hidden={!open}>
            <div className="hk-step">
              <h3>Team building is closed</h3>
              <p>
                Team building for {p.eventName || p.title} is closed. No new teams or members can be
                added.
              </p>
              {p.loginLabel ? (
                <>
                  <p className="hk-note">Already in a team? Log in to see it.</p>
                  <div className="cta">
                    <a className="btn btn-tonal" href={p.loginHref || '/membership/login'}>
                      {p.loginLabel}
                    </a>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </Gdg>
    )
  },
}

// ─── Women Techmakers ────────────────────────────────────────────────────────

type WtmProps = {
  title: string
  body: string
  primaryLabel: string
  primaryHref: string
  secondaryLabel: string
  secondaryHref: string
}

export const GdgWtm: ComponentConfig<WtmProps> = {
  label: 'GDG Women Techmakers',
  fields: {
    title: text('Title'),
    body: area('Text'),
    primaryLabel: text('Main button'),
    primaryHref: text('Main button link'),
    secondaryLabel: text('Second button'),
    secondaryHref: text('Second button link'),
  },
  defaultProps: {
    title: 'Women Techmakers Vizag',
    body: "A safe space for women from all backgrounds, with visibility, community and resources for women in tech. International Women's Day Vizag is a yearly highlight.",
    primaryLabel: 'Watch WTM Vizag',
    primaryHref: 'https://www.youtube.com/@wtmvizag',
    secondaryLabel: 'See WTM events',
    secondaryHref: '/events',
  },
  render: (p) => (
    <Gdg>
      <section className="block" aria-labelledby="wtm-h">
        <div className="wtm">
          <h2 id="wtm-h">{p.title}</h2>
          <p>{p.body}</p>
          <div className="cta">
            {p.primaryLabel ? (
              <a className="btn" href={p.primaryHref} {...ext(p.primaryHref)}>
                {p.primaryLabel}
              </a>
            ) : null}
            {p.secondaryLabel ? (
              <a className="btn btn-tonal" href={p.secondaryHref} {...ext(p.secondaryHref)}>
                {p.secondaryLabel}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </Gdg>
  ),
}

// ─── Get involved (+ sponsor dialog) ─────────────────────────────────────────

type InvolvedProps = {
  title: string
  cfpMode: 'link' | 'form'
  showWtm: 'yes' | 'no'
  cfpTitle: string
  cfpText: string
  cfpGo: string
  cfpHref: string
  cfpUrl: string
  cfpOpenText: string
  cfpOpenGo: string
  sponsorTitle: string
  sponsorText: string
  sponsorGo: string
  dialogTitle: string
  dialogText: string
  deckUrl: string
  contactLabel: string
  contactHref: string
  deckLabel: string
  noDeckNote: string
  deckNote: string
  volunteerTitle: string
  volunteerText: string
  volunteerGo: string
  volunteerHref: string
  wtmTitle: string
  wtmText: string
  wtmGo: string
  wtmHref: string
}

export const GdgInvolved: ComponentConfig<InvolvedProps> = {
  label: 'GDG Get Involved',
  fields: {
    title: text('Title'),
    cfpMode: {
      type: 'radio',
      label: 'Call for speakers card',
      options: [
        { label: 'Opens the link below', value: 'link' },
        { label: 'Opens the call for speakers form (Admin → DevFest)', value: 'form' },
      ],
    },
    showWtm: {
      type: 'radio',
      label: 'Women Techmakers card',
      options: [
        { label: 'Show', value: 'yes' },
        { label: 'Hide', value: 'no' },
      ],
    },
    cfpTitle: text('Speakers: title'),
    cfpText: area('Speakers: text'),
    cfpGo: text('Speakers: link label'),
    cfpHref: text('Speakers: link (before applications open)'),
    cfpUrl: text('Call for speakers form link (optional: when set, applications are open)'),
    cfpOpenText: area('Speakers: text while applications are open'),
    cfpOpenGo: text('Speakers: link label while open'),
    sponsorTitle: text('Sponsor: title'),
    sponsorText: area('Sponsor: text'),
    sponsorGo: text('Sponsor: link label'),
    dialogTitle: text('Sponsor dialog: title'),
    dialogText: area('Sponsor dialog: text'),
    deckUrl: text('Sponsorship deck link (optional)'),
    contactLabel: text('Sponsor dialog: button without a deck'),
    contactHref: text('Sponsor dialog: contact link'),
    deckLabel: text('Sponsor dialog: button with a deck'),
    noDeckNote: area('Sponsor dialog: note without a deck'),
    deckNote: area('Sponsor dialog: note with a deck'),
    volunteerTitle: text('Volunteer: title'),
    volunteerText: area('Volunteer: text'),
    volunteerGo: text('Volunteer: link label'),
    volunteerHref: text('Volunteer: link'),
    wtmTitle: text('WTM: title'),
    wtmText: area('WTM: text'),
    wtmGo: text('WTM: link label'),
    wtmHref: text('WTM: link'),
  },
  defaultProps: {
    title: 'Get involved',
    cfpMode: 'link',
    showWtm: 'yes',
    cfpTitle: 'Call for speakers',
    cfpText: "Share what you've built. Applications open before the event.",
    cfpGo: 'Notify me',
    cfpHref: 'https://gdg.community.dev/gdg-vizag/',
    cfpUrl: '',
    cfpOpenText: "Applications are open. Share what you've built.",
    cfpOpenGo: 'Submit a talk',
    sponsorTitle: 'Become a sponsor',
    sponsorText: "Put your brand in front of Vizag's developer community.",
    sponsorGo: 'See how',
    dialogTitle: 'Sponsor DevFest Vizag 2026',
    dialogText:
      "Reach Vizag's developers, students and founders in one room. Past partners include GITAM, MSI India, Kalam Dream Labs and ā hub.",
    deckUrl: '',
    contactLabel: 'Get in touch',
    contactHref: 'https://gdg.community.dev/gdg-vizag/',
    deckLabel: 'Download the sponsorship deck',
    noDeckNote:
      "The sponsorship deck isn't published yet. Reach the organizers through the chapter page.",
    deckNote: 'Questions? Reach the organizers through the chapter page.',
    volunteerTitle: 'Volunteer',
    volunteerText: 'Join the crew that runs registration, tracks and the lounge.',
    volunteerGo: 'Get started',
    volunteerHref: 'https://gdg.community.dev/gdg-vizag/',
    wtmTitle: 'Women Techmakers',
    wtmText: 'WTM Vizag builds visibility and community for women in tech.',
    wtmGo: 'Learn more',
    wtmHref: 'https://www.youtube.com/@wtmvizag',
  },
  render: function Render({ puck, ...p }) {
    const dlg = useRef<HTMLDialogElement>(null)
    const pid = puck?.metadata?.projectId as string | undefined
    // "form": the card opens the call for speakers form; open or closed comes from Admin → DevFest.
    const useForm = p.cfpMode === 'form'
    const { edition } = useDevfestData(pid)
    const [formOpen, setFormOpen] = useState(false)
    useEffect(() => {
      if (!useForm) return
      const fromHash = () => window.location.hash === '#speak' && setFormOpen(true)
      fromHash()
      window.addEventListener('hashchange', fromHash)
      return () => window.removeEventListener('hashchange', fromHash)
    }, [useForm])
    const cfpOpen = useForm ? Boolean(edition?.cfpOpen) : Boolean(p.cfpUrl)
    const cfpHref = cfpOpen ? p.cfpUrl : p.cfpHref
    const deckHref = p.deckUrl || p.contactHref
    const cfpCard = (
      <>
        <h3>{p.cfpTitle}</h3>
        <p id="cfp-text">{cfpOpen ? p.cfpOpenText : p.cfpText}</p>
        <span className="go" id="cfp-go">
          {cfpOpen ? p.cfpOpenGo : p.cfpGo}
        </span>
      </>
    )
    return (
      <Gdg>
        <section id="involved" className="block" aria-labelledby="inv-h">
          <h2 id="inv-h">{p.title}</h2>
          <div className={`bento involve-grid${p.showWtm === 'no' ? ' three' : ''}`}>
            {useForm ? (
              <button
                className="tile t-blue link"
                id="cfp-link"
                type="button"
                onClick={() => {
                  setFormOpen(true)
                  // Show the shareable address (…#speak) while the form is open.
                  if (window.location.hash !== '#speak') {
                    const { pathname, search } = window.location
                    history.replaceState(null, '', `${pathname}${search}#speak`)
                  }
                }}
              >
                {cfpCard}
              </button>
            ) : (
              <a className="tile t-blue link" id="cfp-link" href={cfpHref} {...ext(cfpHref)}>
                {cfpCard}
              </a>
            )}
            <button
              className="tile t-yellow link"
              id="sponsor-open"
              type="button"
              onClick={() => dlg.current?.showModal()}
            >
              <h3>{p.sponsorTitle}</h3>
              <p>{p.sponsorText}</p>
              <span className="go">{p.sponsorGo}</span>
            </button>
            <a className="tile t-green link" href={p.volunteerHref} {...ext(p.volunteerHref)}>
              <h3>{p.volunteerTitle}</h3>
              <p>{p.volunteerText}</p>
              <span className="go">{p.volunteerGo}</span>
            </a>
            {p.showWtm === 'no' ? null : (
              <a className="tile t-red link" href={p.wtmHref} {...ext(p.wtmHref)}>
                <h3>{p.wtmTitle}</h3>
                <p>{p.wtmText}</p>
                <span className="go">{p.wtmGo}</span>
              </a>
            )}
          </div>
        </section>
        {/* Clicking the backdrop (the dialog element itself) closes it, as on the original site. */}
        <dialog
          id="sponsor-dlg"
          className="dlg"
          aria-labelledby="sp-title"
          ref={dlg}
          onClick={(e) => e.target === e.currentTarget && dlg.current?.close()}
        >
          <form method="dialog">
            <button className="dlg-x" aria-label="Close">
              Close
            </button>
          </form>
          <h3 id="sp-title">{p.dialogTitle}</h3>
          <p>{p.dialogText}</p>
          <div className="cta">
            <a className="btn" id="deck-link" href={deckHref} {...ext(deckHref)}>
              {p.deckUrl ? p.deckLabel : p.contactLabel}
            </a>
          </div>
          <p className="note" id="deck-note">
            {p.deckUrl ? p.deckNote : p.noDeckNote}
          </p>
        </dialog>
        {useForm ? (
          <CallForSpeakersPopup
            pid={pid}
            open={formOpen}
            onClose={() => {
              setFormOpen(false)
              if (window.location.hash === '#speak')
                history.replaceState(null, '', window.location.pathname + window.location.search)
            }}
          />
        ) : null}
      </Gdg>
    )
  },
}

// ─── Partners ────────────────────────────────────────────────────────────────

type PartnersProps = { title: string; partners: string }

export const GdgPartners: ComponentConfig<PartnersProps> = {
  label: 'GDG Partners',
  fields: {
    title: text('Title'),
    partners: area('Partners ("Name | role | link" per line; link optional)'),
  },
  defaultProps: {
    title: 'Backed by the community',
    partners: [
      'GITAM | Venue partner | https://www.gitam.edu',
      'ā hub | Community partner |',
      'WTM Vizag | Community partner | https://www.youtube.com/@wtmvizag',
      'Kalam Dream Labs | Community partner | https://kalamdreamlabs.com',
      'MSI India | 2024 partner | https://in.msi.com',
    ].join('\n'),
  },
  render: (p) => (
    <Gdg>
      <section id="partners" className="block" aria-labelledby="par-h">
        <h2 id="par-h">{p.title}</h2>
        <ul className="partners">
          {lines(p.partners, 3).map(([name, role, href]) => (
            <li key={name}>
              {href ? (
                <a href={href} {...ext(href)}>
                  {name}
                </a>
              ) : (
                <span>{name}</span>
              )}
              {role ? <small>{role}</small> : null}
            </li>
          ))}
        </ul>
      </section>
    </Gdg>
  ),
}

export const communityComponents: Record<string, AnyBlock> = {
  GdgHackathonCard,
  GdgWtm,
  GdgInvolved,
  GdgPartners,
}
