'use client'

// DevFest blocks that only show what is entered in Admin → GDG Chapter → DevFest: the sponsors and
// the team of the current edition. They reuse the pack's classes (block, sub, people/person, btn).
import type { ComponentConfig } from '@puckeditor/core'
import {
  Gdg,
  SHAPES,
  area,
  initials,
  shapePath,
  text,
  useDevfestData,
  withYear,
  type AnyBlock,
} from './lib'
import { ext } from './chrome'

type Puck = { puck?: { metadata?: Record<string, unknown> } }
const projectOf = (puck: Puck['puck']) => puck?.metadata?.projectId as string | undefined

// ─── GdgDevfestSponsors ──────────────────────────────────────────────────────

type SponsorsProps = {
  title: string
  sub: string
  tierTitle: string
  tierGold: string
  tierSilver: string
  tierCommunity: string
  tierPartner: string
  ctaLabel: string
  ctaUrl: string
  emptyText: string
}

const TIERS = ['title', 'gold', 'silver', 'community', 'partner'] as const

const GdgDevfestSponsors: ComponentConfig<SponsorsProps> = {
  label: 'GDG DevFest Sponsors',
  fields: {
    title: text('Title ({year} = the edition year)'),
    sub: area('Subtitle'),
    tierTitle: text('Heading: title sponsors'),
    tierGold: text('Heading: gold'),
    tierSilver: text('Heading: silver'),
    tierCommunity: text('Heading: community partners'),
    tierPartner: text('Heading: partners'),
    ctaLabel: text('Button text (leave empty for no button)'),
    ctaUrl: text('Button link'),
    emptyText: area('Shown while no sponsors are added in Admin → DevFest'),
  },
  defaultProps: {
    title: 'DevFest Vizag {year} sponsors',
    sub: 'DevFest is free to attend because of the teams who back it.',
    tierTitle: 'Title sponsor',
    tierGold: 'Gold',
    tierSilver: 'Silver',
    tierCommunity: 'Community partners',
    tierPartner: 'Partners',
    ctaLabel: 'Become a sponsor',
    ctaUrl: 'https://gdg.community.dev/gdg-vizag/',
    emptyText: 'Sponsors are announced soon. Want to support DevFest Vizag? Get in touch.',
  },
  render: function Render({ puck, ...p }) {
    const { edition, sponsors, isLoading } = useDevfestData(projectOf(puck))
    const heading: Record<(typeof TIERS)[number], string> = {
      title: p.tierTitle,
      gold: p.tierGold,
      silver: p.tierSilver,
      community: p.tierCommunity,
      partner: p.tierPartner,
    }
    const groups = TIERS.map((t) => ({
      tier: t,
      list: sponsors.filter((s) => s.tier === t),
    })).filter((g) => g.list.length)
    return (
      <Gdg>
        <section id="sponsors" className="block df-sponsors" aria-labelledby="sponsors-h">
          <h2 id="sponsors-h">{withYear(p.title, edition?.year)}</h2>
          <p className="sub">{p.sub}</p>
          {!isLoading && !groups.length ? <p className="note df-empty">{p.emptyText}</p> : null}
          {groups.map((g) => (
            <div key={g.tier} className={`df-tier df-tier-${g.tier}`}>
              <h3>{heading[g.tier]}</h3>
              <ul>
                {g.list.map((s) => {
                  const inner = s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- sponsor logos are any stored link
                    <img src={s.logo} alt={s.name} loading="lazy" />
                  ) : (
                    <span>{s.name}</span>
                  )
                  return (
                    <li key={s.id}>
                      {s.url ? (
                        <a href={s.url} {...ext(s.url)} aria-label={s.logo ? s.name : undefined}>
                          {inner}
                        </a>
                      ) : (
                        <div>{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
          {p.ctaLabel && p.ctaUrl ? (
            <p className="cta">
              <a className="btn btn-tonal" href={p.ctaUrl} {...ext(p.ctaUrl)}>
                {p.ctaLabel}
              </a>
            </p>
          ) : null}
        </section>
      </Gdg>
    )
  },
}

// ─── GdgDevfestTeam ──────────────────────────────────────────────────────────

type TeamProps = { title: string; sub: string; emptyText: string }

const GdgDevfestTeam: ComponentConfig<TeamProps> = {
  label: 'GDG DevFest Team',
  fields: {
    title: text('Title ({year} = the edition year)'),
    sub: area('Subtitle'),
    emptyText: area('Shown while no team is added in Admin → DevFest'),
  },
  defaultProps: {
    title: 'The DevFest Vizag {year} team',
    sub: 'Organizers and volunteers who make the day happen.',
    emptyText: 'The team for this edition is announced soon.',
  },
  render: function Render({ puck, ...p }) {
    const { edition, team, isLoading } = useDevfestData(projectOf(puck))
    return (
      <Gdg>
        <section id="df-team" className="block" aria-labelledby="df-team-h">
          <h2 id="df-team-h">{withYear(p.title, edition?.year)}</h2>
          <p className="sub">{p.sub}</p>
          {!isLoading && !team.length ? <p className="note df-empty">{p.emptyText}</p> : null}
          <div className="people">
            {team.map((m, i) => {
              const [n, amp] = SHAPES[i % 3] ?? [8, 0.07]
              const d = shapePath(n, amp)
              const card = (
                <>
                  <svg
                    className="person-art"
                    viewBox="-110 -110 220 220"
                    role="img"
                    aria-label={m.name}
                  >
                    {m.photo ? (
                      <>
                        <clipPath id={`dft${i}`}>
                          <path d={d} />
                        </clipPath>
                        <path d={d} transform="scale(1.07)" fill="var(--c-shape)" />
                        <image
                          href={m.photo}
                          x="-100"
                          y="-100"
                          width="200"
                          height="200"
                          preserveAspectRatio="xMidYMid slice"
                          clipPath={`url(#dft${i})`}
                        />
                      </>
                    ) : (
                      <>
                        <path d={d} fill="var(--c-shape)" />
                        <text y="22" textAnchor="middle" fontSize="64" fontWeight="800" fill="#fff">
                          {initials(m.name)}
                        </text>
                      </>
                    )}
                  </svg>
                  <div>
                    <h3>{m.name}</h3>
                    {m.role ? <span className="role">{m.role}</span> : null}
                  </div>
                </>
              )
              const tone = `person tone-${['blue', 'green', 'yellow'][i % 3]}`
              return m.url ? (
                <a key={m.id} className={tone} href={m.url} {...ext(m.url)}>
                  {card}
                </a>
              ) : (
                <article key={m.id} className={tone}>
                  {card}
                </article>
              )
            })}
          </div>
        </section>
      </Gdg>
    )
  },
}

export const devfestDataComponents: Record<string, AnyBlock> = {
  GdgDevfestSponsors,
  GdgDevfestTeam,
}
