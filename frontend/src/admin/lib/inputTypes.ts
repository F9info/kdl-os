import type { InputType } from '@/types/models.types'

// Human labels for each input type. Keep in sync with
// backend/src/shared/constants/inputTypes.js.
export const INPUT_TYPE_LABELS: Record<InputType, string> = {
  heading: 'Heading',
  textbox: 'Textbox',
  'textarea-normal': 'Textarea (plain)',
  textarea: 'Textarea (rich editor)',
  number: 'Number',
  select: 'Select',
  radio: 'Radio',
  checkbox: 'Checkbox',
  color: 'Color',
  file: 'Single file',
  'multiple-files': 'Multiple files',
  switch: 'Switch',
}

export const INPUT_TYPE_OPTIONS = Object.entries(INPUT_TYPE_LABELS) as [InputType, string][]

// Types driven by a comma-separated `options` list.
export const OPTION_INPUT_TYPES: InputType[] = ['select', 'radio', 'checkbox']

// Types with no stored value (purely presentational).
export const VALUELESS_INPUT_TYPES: InputType[] = ['heading']

// File-backed types.
export const FILE_INPUT_TYPES: InputType[] = ['file', 'multiple-files']

export const isOptionType = (t: InputType) => OPTION_INPUT_TYPES.includes(t)

// Split a stored comma-separated options string into trimmed, non-empty values.
export const parseOptions = (options: string | null | undefined): string[] =>
  (options ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
