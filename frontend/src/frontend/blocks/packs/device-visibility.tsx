import type { ComponentType, ReactNode } from 'react'
import type { ComponentConfig, Field } from '@puckeditor/core'

// Per-device visibility for EVERY section. composePacks() wraps each registered block with
// withDeviceVisibility(), so no block needs changing and a new block gets it for free.
//
//   hideOnMobile   under 768px         (Tailwind: below `md`)
//   hideOnTablet   768px - 1023px      (`md` up to below `lg`)
//   hideOnDesktop  1024px and wider    (`lg` and up)
//
// Visitors: pure CSS (a `display: contents` wrapper that turns `hidden` at the chosen widths), so
// it is right as soon as the section renders, follows window resizes and rotation with no script, and
// the exported static site (prerendered HTML) carries it too.
// Editor: nothing is really hidden (the canvas is not an iframe, so media queries would follow the
// real window and a hidden section could not be selected); the section shows a "Hidden on ..." badge.
// A section with no flag set renders exactly as before, with no wrapper element at all.

export const DEVICES = [
  { key: 'hideOnMobile', name: 'mobile', range: 'under 768px', hide: 'max-md:hidden' },
  { key: 'hideOnTablet', name: 'tablet', range: '768px to 1023px', hide: 'md:max-lg:hidden' },
  { key: 'hideOnDesktop', name: 'desktop', range: '1024px and wider', hide: 'lg:hidden' },
] as const

// Written out in full (not built from strings) so Tailwind's scanner generates every class.
export const DEVICE_FIELDS: Record<string, Field> = Object.fromEntries(
  DEVICES.map((d) => [
    d.key,
    {
      type: 'radio',
      label: `Hide on ${d.name} (${d.range})`,
      options: [
        { label: 'Show', value: false },
        { label: 'Hide', value: true },
      ],
    } as Field,
  ])
)

type Props = Record<string, unknown>

/** Names of the devices a section is hidden on, in mobile, tablet, desktop order. */
export function hiddenDevices(props: Props | undefined): string[] {
  return DEVICES.filter((d) => props?.[d.key] === true).map((d) => d.name)
}

export function DeviceVisibility({
  props,
  isEditing,
  children,
}: {
  props: Props
  isEditing: boolean
  children: ReactNode
}) {
  const hidden = hiddenDevices(props)
  if (hidden.length === 0) return <>{children}</>

  if (isEditing) {
    return (
      <div className="relative outline-dashed outline-2 -outline-offset-2 outline-amber-500/70">
        <span
          data-testid="device-hidden-badge"
          className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-amber-500 px-2 py-0.5 text-xs font-medium text-black"
        >
          Hidden on {hidden.join(', ')}
        </span>
        {children}
      </div>
    )
  }

  const classes = DEVICES.filter((d) => props[d.key] === true).map((d) => d.hide)
  return <div className={['contents', ...classes].join(' ')}>{children}</div>
}

/** Adds the three device fields to a block and wraps its render. Existing fields are kept. */
export function withDeviceVisibility<C extends ComponentConfig>(config: C): C {
  const Inner = config.render as ComponentType<Props & { puck?: { isEditing?: boolean } }>
  const resolve = (
    config as { resolveFields?: (...a: unknown[]) => Promise<Record<string, Field>> }
  ).resolveFields
  return {
    ...config,
    fields: { ...(config.fields ?? {}), ...DEVICE_FIELDS },
    ...(resolve
      ? {
          resolveFields: async (...args: unknown[]) => ({
            ...(await resolve(...args)),
            ...DEVICE_FIELDS,
          }),
        }
      : {}),
    render: (props: Props & { puck?: { isEditing?: boolean } }) => (
      <DeviceVisibility props={props} isEditing={!!props.puck?.isEditing}>
        <Inner {...props} />
      </DeviceVisibility>
    ),
  } as C
}
