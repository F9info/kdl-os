import { describe, it, expect } from 'vitest'
import { render, screen } from '../utils'
import { config } from '@/frontend/blocks/puck.config'
import { isStyleField } from '@/frontend/blocks/section-schema'
import {
  DEVICES,
  DEVICE_FIELDS,
  DeviceVisibility,
  hiddenDevices,
  withDeviceVisibility,
} from '@/frontend/blocks/packs/device-visibility'

const Body = () => <section data-testid="body">content</section>

describe('DeviceVisibility (what a visitor gets)', () => {
  it('a section with no flag renders exactly as before: no wrapper element at all', () => {
    const { container } = render(
      <DeviceVisibility props={{}} isEditing={false}>
        <Body />
      </DeviceVisibility>
    )
    // The section sits directly in the render container: nothing was added around it.
    expect(screen.getByTestId('body').parentElement).toBe(container)
    expect(container.querySelector('.contents')).toBeNull()
  })

  it.each([
    ['hideOnMobile', 'max-md:hidden'],
    ['hideOnTablet', 'md:max-lg:hidden'],
    ['hideOnDesktop', 'lg:hidden'],
  ])('%s hides at exactly its width range (%s), as plain CSS', (key, cls) => {
    render(
      <DeviceVisibility props={{ [key]: true }} isEditing={false}>
        <Body />
      </DeviceVisibility>
    )
    const wrapper = screen.getByTestId('body').parentElement as HTMLElement
    expect(wrapper.className.split(' ')).toEqual(['contents', cls])
  })

  it('several flags combine; false or missing flags add nothing', () => {
    render(
      <DeviceVisibility
        props={{ hideOnMobile: true, hideOnTablet: false, hideOnDesktop: true }}
        isEditing={false}
      >
        <Body />
      </DeviceVisibility>
    )
    expect((screen.getByTestId('body').parentElement as HTMLElement).className.split(' ')).toEqual([
      'contents',
      'max-md:hidden',
      'lg:hidden',
    ])
  })

  it('only the literal true hides (a stray string or 1 in saved data never hides a section)', () => {
    for (const bad of ['true', 1, 'yes', null, undefined]) {
      expect(hiddenDevices({ hideOnMobile: bad })).toEqual([])
    }
  })
})

describe('DeviceVisibility (what the editor shows)', () => {
  it('never really hides in the editor: no hide classes, a badge naming the devices instead', () => {
    const { container } = render(
      <DeviceVisibility props={{ hideOnMobile: true, hideOnDesktop: true }} isEditing>
        <Body />
      </DeviceVisibility>
    )
    expect(screen.getByTestId('device-hidden-badge')).toHaveTextContent('Hidden on mobile, desktop')
    expect(container.innerHTML).not.toMatch(/max-md:hidden|lg:hidden|md:max-lg:hidden/)
    expect(screen.getByTestId('body')).toBeInTheDocument()
  })

  it('no badge when nothing is hidden', () => {
    render(
      <DeviceVisibility props={{}} isEditing>
        <Body />
      </DeviceVisibility>
    )
    expect(screen.queryByTestId('device-hidden-badge')).toBeNull()
  })
})

describe('withDeviceVisibility', () => {
  const base = {
    fields: { title: { type: 'text' as const } },
    defaultProps: { title: 'Hi' },
    render: ({ title }: { title: string }) => <h1>{title}</h1>,
  }

  it('adds the three fields, keeps the existing ones and changes no default props', () => {
    const c = withDeviceVisibility(base as never) as typeof base & {
      fields: Record<string, unknown>
    }
    expect(Object.keys(c.fields)).toEqual(['title', ...DEVICES.map((d) => d.key)])
    expect(c.defaultProps).toEqual({ title: 'Hi' }) // absent = shown: saved pages are untouched
  })

  it('passes every prop (including puck) through to the original render', () => {
    const c = withDeviceVisibility(base as never) as {
      render: (p: Record<string, unknown>) => JSX.Element
    }
    render(c.render({ title: 'Passed through', puck: { isEditing: false } }))
    expect(screen.getByRole('heading')).toHaveTextContent('Passed through')
  })

  it('extends resolveFields instead of replacing it', async () => {
    const c = withDeviceVisibility({
      ...base,
      resolveFields: async () => ({ extra: { type: 'text' } }),
    } as never) as { resolveFields: () => Promise<Record<string, unknown>> }
    expect(Object.keys(await c.resolveFields())).toEqual(['extra', ...DEVICES.map((d) => d.key)])
  })

  it('each field is a Show/Hide radio whose values are real booleans (so the schema calls it a toggle)', () => {
    for (const d of DEVICES) {
      const f = DEVICE_FIELDS[d.key] as { type: string; options: { value: unknown }[] }
      expect(f.type).toBe('radio')
      expect(f.options.map((o) => o.value)).toEqual([false, true])
    }
  })
})

describe('the real block library', () => {
  it('every registered section has all three fields, and they live on the Style tab', () => {
    const components = Object.entries(config.components ?? {})
    expect(components.length).toBeGreaterThan(100)
    for (const [type, c] of components)
      for (const d of DEVICES)
        expect(Object.keys(c.fields ?? {}), `${type} is missing ${d.key}`).toContain(d.key)
    for (const d of DEVICES) expect(isStyleField(d.key)).toBe(true)
  })
})
