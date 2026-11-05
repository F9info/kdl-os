// Blocks that used to store repeating items as numbered flat props (faq1Question, faq2Question…)
// now keep them in one array prop edited as an Add / Remove / Reorder accordion.
//
// numbered-families.json is the single table (block → { prefix, prop }); this file derives
// everything else from the block's own definition: the array's sub-fields come from slot 1's
// fields, its starting rows from the legacy defaults. The backend reads the same JSON
// (backend/src/shared/numbered-families.js) to convert seeded / saved / imported pages.
import families from './numbered-families.json'

type Family = { prefix: string; prop: string }
type AnyRecord = Record<string, unknown>

const table = families as Record<string, Family[]>
const slotRe = (prefix: string) => new RegExp(`^${prefix}(\\d+)([A-Za-z]*)$`)
/** faq1Question → "question"; logo1 → "value". */
export const itemKey = (suffix: string) =>
  suffix ? suffix.charAt(0).toLowerCase() + suffix.slice(1) : 'value'

/** True for a legacy numbered key of this block (hidden from the panel). */
export const isLegacyNumberedKey = (type: string, key: string) =>
  (table[type] ?? []).some((f) => slotRe(f.prefix).test(key))

/** Rows from legacy flat props, in slot order; fully empty slots are dropped. */
export function itemsFromLegacy(props: AnyRecord, prefix: string): AnyRecord[] {
  const re = slotRe(prefix)
  const slots = new Map<number, AnyRecord>()
  for (const [k, v] of Object.entries(props)) {
    const m = re.exec(k)
    if (!m) continue
    const n = Number(m[1])
    slots.set(n, { ...slots.get(n), [itemKey(m[2] ?? '')]: v })
  }
  return [...slots.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, row]) => row)
    .filter((row) => Object.values(row).some((v) => v !== '' && v != null))
}

/** Array rows when the page has them, otherwise the legacy flat-slot rows (old saved pages). */
export function resolveItems<Out>(
  rows: Record<string, string>[] | undefined,
  legacy: Out[],
  map: (row: Record<string, string>) => Out
): Out[] {
  return Array.isArray(rows) ? rows.map(map) : legacy
}

type Field = AnyRecord & { type?: string }

/** Adds the array field + defaults + resolveData to every block listed in the table. */
export function withNumberedFamilies<T extends Record<string, unknown>>(components: T): T {
  const out: AnyRecord = { ...components }
  for (const [type, fams] of Object.entries(table)) {
    const def = out[type] as AnyRecord | undefined
    if (!def) continue
    let fields = { ...(def.fields as Record<string, Field>) }
    const defaults = { ...(def.defaultProps as AnyRecord) }
    for (const { prefix, prop } of fams) {
      const re = slotRe(prefix)
      const slot1 = Object.keys(fields).filter((k) => re.exec(k)?.[1] === '1')
      const arrayFields: Record<string, Field> = {}
      const blank: AnyRecord = {}
      for (const k of slot1) {
        const key = itemKey(re.exec(k)![2] ?? '')
        const f = fields[k] as Field
        arrayFields[key] = f
        const isText = f.type === 'text' || f.type === 'textarea' || f.type === 'custom'
        blank[key] = isText ? '' : defaults[k]
      }
      const firstText = Object.keys(arrayFields).find((k) => {
        const t = arrayFields[k]?.type
        return t === 'text' || t === 'textarea'
      })
      const rebuilt: Record<string, Field> = {}
      let placed = false
      for (const [k, f] of Object.entries(fields)) {
        if (re.test(k)) {
          if (!placed) {
            placed = true
            rebuilt[prop] = {
              type: 'array',
              min: 0,
              max: 24,
              getItemSummary: (item: AnyRecord, i?: number) =>
                (firstText && String(item[firstText] || '')) || `Item ${(i ?? 0) + 1}`,
              defaultItemProps: blank,
              arrayFields,
            }
          }
          rebuilt[k] = f // kept for Puck's per-prop schema; hidden from the panel
        } else rebuilt[k] = f
      }
      fields = rebuilt
      defaults[prop] = itemsFromLegacy(defaults, prefix)
      for (const k of Object.keys(defaults)) if (re.test(k)) delete defaults[k]
    }
    out[type] = {
      ...def,
      fields,
      defaultProps: defaults,
      // Older pages open with their rows already in the accordion.
      resolveData: (data: { props: AnyRecord }) => {
        let props = data.props
        for (const { prefix, prop } of fams) {
          if (props[prop] === undefined) {
            const rows = itemsFromLegacy(props, prefix)
            if (rows.length) props = { ...props, [prop]: rows }
          }
        }
        return { props }
      },
    }
  }
  return out as T
}
