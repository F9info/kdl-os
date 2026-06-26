// The set of input types a SettingField can be rendered as.
// Mirrors INPUT_TYPES from the Laravel Application Settings module.
// Keep this in sync with frontend/src/lib/inputTypes.ts.

export const INPUT_TYPES = {
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
};

export const INPUT_TYPE_KEYS = Object.keys(INPUT_TYPES);

// Input types whose value is driven by a comma-separated `options` list.
export const OPTION_INPUT_TYPES = ['select', 'radio', 'checkbox'];

// Input types that have no stored value (purely presentational).
export const VALUELESS_INPUT_TYPES = ['heading'];

// Input types backed by uploaded files (value stores MinIO object path(s)).
export const FILE_INPUT_TYPES = ['file', 'multiple-files'];
