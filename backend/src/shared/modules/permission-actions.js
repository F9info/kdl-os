export const DEFAULT_ACTIONS = ['view', 'add', 'edit', 'delete', 'publish'];

// Normalizes a manifest.permissions entry (bare string or { name, actions })
// into a { name, actions } pair — bare strings fall back to DEFAULT_ACTIONS.
export function resolvePermissionEntry(entry) {
  return typeof entry === 'string'
    ? { name: entry, actions: DEFAULT_ACTIONS }
    : { name: entry.name, actions: entry.actions };
}

export function permissionModuleLabel(name) {
  return name
    .split(/[-_]/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}
