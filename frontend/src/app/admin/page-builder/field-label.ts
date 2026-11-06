import type { Field } from '@puckeditor/core'

/** What the editor panel shows for a field: its own `label` when the block defines one, else its key. */
export const fieldDisplayLabel = (key: string, field: Field): string =>
  (field as { label?: string }).label?.trim() || key
