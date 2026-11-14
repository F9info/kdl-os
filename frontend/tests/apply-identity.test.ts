import { describe, it, expect } from 'vitest'
import { applyIdentity } from '@/frontend/lib/apply-identity'

const page = (content: object[]) => ({ content, root: {} })
const identity = {
  company_name: 'Acme',
  contact_email: 'hi@acme.test',
  contact_phone: '+1 555',
  contact_address: '1 Road',
  social_facebook: 'https://fb.test/acme',
  social_linkedin: 'https://li.test/acme',
}

describe('applyIdentity contact + socials', () => {
  it('overlays email/phone on the top bar and header from Identity', () => {
    const out = applyIdentity(
      page([
        { type: 'ConstructionTopBar', props: { d1Email: 'old@x', d1Phone: '1' } },
        { type: 'ConstructionHeader', props: { email: 'old@x', phoneNumber: '1' } },
      ]),
      identity
    ) as { content: { props: Record<string, string> }[] }
    expect(out.content[0]!.props).toMatchObject({ d1Email: 'hi@acme.test', d1Phone: '+1 555' })
    expect(out.content[1]!.props).toMatchObject({ email: 'hi@acme.test', phoneNumber: '+1 555' })
  })

  it('maps socials by each design slot order and hides unset "#" placeholders', () => {
    const out = applyIdentity(
      page([
        {
          type: 'ConstructionTopBar',
          props: { d1Social1Href: '#', d1Social2Href: '#', d1Social3Href: '#', d1Social4Href: '#' },
        },
        {
          type: 'ConstructionFooter',
          props: {
            variant: '1',
            social1Href: '#',
            social2Href: '#',
            social3Href: '#',
            social4Href: '#',
          },
        },
      ]),
      identity
    ) as { content: { props: Record<string, string> }[] }
    // top bar: Facebook, Instagram, LinkedIn, YouTube
    expect(out.content[0]!.props).toMatchObject({
      d1Social1Href: 'https://fb.test/acme',
      d1Social2Href: '',
      d1Social3Href: 'https://li.test/acme',
      d1Social4Href: '',
    })
    // footer 1-4: Facebook, LinkedIn, Instagram, X
    expect(out.content[1]!.props).toMatchObject({
      social1Href: 'https://fb.test/acme',
      social2Href: 'https://li.test/acme',
      social3Href: '',
      social4Href: '',
    })
  })

  it('footer: contact + placeholder copyright follow Identity, a saved copyright wins', () => {
    const f = (copyright: string) => ({
      type: 'ConstructionFooter',
      props: { contactEmail: 'o@x', contactAddress: 'x', copyright },
    })
    const a = applyIdentity(page([f('© Your Brand. All rights reserved.')]), identity) as {
      content: { props: Record<string, string> }[]
    }
    expect(a.content[0]!.props.contactEmail).toBe('hi@acme.test')
    expect(a.content[0]!.props.contactAddress).toBe('1 Road')
    expect(a.content[0]!.props.copyright).toMatch(/^© \d{4} Acme\. All rights reserved\.$/)
    const b = applyIdentity(page([f('© Mine')]), { ...identity, copyright: '© Saved' }) as {
      content: { props: Record<string, string> }[]
    }
    expect(b.content[0]!.props.copyright).toBe('© Saved')
    const c = applyIdentity(page([f('© Mine')]), identity) as {
      content: { props: Record<string, string> }[]
    }
    expect(c.content[0]!.props.copyright).toBe('© Mine')
  })

  it('leaves data alone with no identity, and keeps empty fields as the page had them', () => {
    const d = page([{ type: 'ConstructionHeader', props: { email: 'keep@x' } }])
    expect(applyIdentity(d, {})).toBe(d)
    const out = applyIdentity(d, { company_name: 'Acme' }) as {
      content: { props: Record<string, string> }[]
    }
    expect(out.content[0]!.props.email).toBe('keep@x')
  })
})

describe('applyIdentity footer links', () => {
  const footer = (props: Record<string, unknown>, id: Record<string, string> = identity) =>
    (
      applyIdentity(
        page([{ type: 'ConstructionFooter', props: { variant: '1', ...props } }]),
        id
      ) as {
        content: { props: Record<string, string> }[]
      }
    ).content[0]!.props

  it('"Get Directions" becomes a map search for the Identity address', () => {
    const p = footer(
      { directionsLabel: 'Get Directions', directionsHref: '#' },
      {
        ...identity,
        contact_address: '12 Park Avenue\nPune 411001',
      }
    )
    expect(p.directionsLabel).toBe('Get Directions')
    expect(p.directionsHref).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20Park%20Avenue%2C%20Pune%20411001'
    )
  })

  it('with no address in Identity the directions link is hidden, not a dead "#"', () => {
    const { contact_address: _unused, ...noAddress } = identity
    void _unused
    expect(
      footer({ directionsLabel: 'Get Directions', directionsHref: '#' }, noAddress).directionsLabel
    ).toBe('')
  })

  it('a directions link the author set to a real address is left alone', () => {
    const p = footer({ directionsLabel: 'Find us', directionsHref: 'https://maps.example/x' })
    expect(p.directionsHref).toBe('https://maps.example/x')
    expect(p.directionsLabel).toBe('Find us')
  })

  it('the legal row keeps only links that have an address', () => {
    const p = footer({
      policyLinks: 'Terms & Conditions|#\nPrivacy Policy|/privacy\nSitemap|#\nBlogs|/blog',
    })
    expect(p.policyLinks).toBe('Privacy Policy|/privacy\nBlogs|/blog')
  })
})

describe('applyIdentity sample company word', () => {
  const out = (props: Record<string, unknown>, id: Record<string, string> = identity) =>
    (
      applyIdentity(page([{ type: 'ConstructionHero', props }]), id) as {
        content: { props: Record<string, unknown> }[]
      }
    ).content[0]!.props

  it('replaces the placeholder company word in text, alt text and nested items with the company name', () => {
    const p = out({
      headline: 'Clients Who Trust DemoLogo',
      imageAlt: 'DemoLogo showroom',
      items: [{ text: 'DemoLogo was founded in 1996' }],
    })
    expect(p).toEqual({
      headline: 'Clients Who Trust Acme',
      imageAlt: 'Acme showroom',
      items: [{ text: 'Acme was founded in 1996' }],
    })
  })

  it('leaves text alone when Identity has no company name, and never touches other words', () => {
    expect(out({ headline: 'Trust DemoLogo' }, { contact_email: 'a@b.test' }).headline).toBe(
      'Trust DemoLogo'
    )
    expect(out({ headline: 'Demo of our logo' }).headline).toBe('Demo of our logo')
  })
})
