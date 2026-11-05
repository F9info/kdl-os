// Form field definition shared by the Forms admin and the public ContactForm block.
export type FieldType = 'text' | 'email' | 'tel' | 'textarea'

export interface FormField {
  key: string
  label: string
  type: FieldType
  required: boolean
}
