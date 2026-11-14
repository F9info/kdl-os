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
