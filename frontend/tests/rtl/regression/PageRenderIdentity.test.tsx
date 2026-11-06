import { describe, it, expect, vi } from 'vitest'
import { render } from '../utils'
import { PageRender } from '@/frontend/rendering/PageRender'

const seen = vi.hoisted(() => ({ metadata: null as null | Record<string, unknown> }))
vi.mock('@puckeditor/core', () => ({
  Render: ({ metadata }: { metadata: Record<string, unknown> }) => {
    seen.metadata = metadata
    return <div />
  },
}))

const page = (identity?: Record<string, string>) =>
  ({
    title: 'Spring',
    projectId: 'p1',
    data: { root: { props: {} }, content: [], zones: {} },
    layout: undefined,
    identity,
  }) as never

describe('PageRender passes the company details to blocks', () => {
  it('hands blocks the project identity', () => {
    render(
      <PageRender page={page()} identity={{ app_name: 'KDL', contact_email: 'info@kdl.com' }} />
    )
    expect(seen.metadata?.identity).toEqual({ app_name: 'KDL', contact_email: 'info@kdl.com' })
  })

  it("puts this site's Branding overrides on top, and an empty override keeps the project value", () => {
    render(
      <PageRender
        page={page({ app_name: 'Spring Co', description: '' })}
        identity={{ app_name: 'KDL', description: 'We dream.' }}
      />
    )
    expect(seen.metadata?.identity).toEqual({ app_name: 'Spring Co', description: 'We dream.' })
  })
})
