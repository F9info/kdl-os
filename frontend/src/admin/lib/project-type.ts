// What the owner is building, in plain words, from the selected products.
// There is one website product, the Web app (pages, menus, forms and their settings). A static copy
// is not a second kind of project: any Web app can be converted into plain host-anywhere files
// with "Convert to Static Website". So the supported combinations are:
//   Admin project | Web app | Landing pages | Web app + Landing pages
// Admin is always on (it is the authoring tool), so it never appears as a separate part.

export function projectTypeLabel(selected: string[]): string {
  const parts: string[] = []
  if (selected.includes('website')) parts.push('Web app')
  if (selected.includes('landing')) parts.push('Landing pages')
  return parts.length > 0 ? parts.join(' + ') : 'Admin project'
}
