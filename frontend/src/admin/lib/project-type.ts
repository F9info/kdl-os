// What the owner is building, in plain words, from the selected products and how the Website
// product is delivered. The seven supported combinations (docs/planning/10-primary-workflow-gap-analysis.md):
//   Admin project | Web application | Static website | Landing pages
//   Web application + Landing pages | Static website + Landing pages
//   Web application + Static website + Landing pages
// Admin is always on (it is the authoring tool), so it never appears as a separate part.

export type WebsiteDelivery = 'web-app' | 'static' | 'both'

export const DELIVERY_OPTIONS: { value: WebsiteDelivery; label: string; description: string }[] = [
  {
    value: 'web-app',
    label: 'Web application',
    description: 'A live website served together with the admin: dynamic content, forms and API.',
  },
  {
    value: 'static',
    label: 'Static website',
    description:
      'Plain files exported from the admin that you can host anywhere, no server needed.',
  },
  {
    value: 'both',
    label: 'Web application and static website',
    description: 'A live site that is also exported as static files.',
  },
]

export function projectTypeLabel(
  selected: string[],
  delivery: WebsiteDelivery | null | undefined
): string {
  const parts: string[] = []
  if (selected.includes('website')) {
    if (delivery === 'web-app') parts.push('Web application')
    else if (delivery === 'static') parts.push('Static website')
    else if (delivery === 'both') parts.push('Web application', 'Static website')
    else parts.push('Website') // delivery not chosen yet
  }
  if (selected.includes('landing')) parts.push('Landing pages')
  return parts.length > 0 ? parts.join(' + ') : 'Admin project'
}
