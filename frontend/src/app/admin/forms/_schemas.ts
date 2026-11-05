import { z } from 'zod'

export const formSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens only'),
  fields: z
    .array(
      z.object({
        key: z.string(),
        label: z.string().trim().min(1, 'Label is required').max(100),
        type: z.enum(['text', 'email', 'tel', 'textarea']),
        required: z.boolean(),
      })
    )
    .min(1, 'Add at least one field')
    .max(20),
  submit_label: z.string().trim().min(1, 'Required').max(60),
  success_message: z.string().trim().min(1, 'Required').max(300),
  notify_email: z.union([z.string().email('Enter a valid email'), z.literal('')]),
  is_active: z.boolean(),
})

export type FormValues = z.infer<typeof formSchema>

/** A field's key is fixed once it has one (renaming the label must not orphan old submissions). */
export function withKeys(fields: FormValues['fields']): FormValues['fields'] {
  const used = new Set(fields.map((f) => f.key).filter(Boolean))
  return fields.map((f) => {
    if (f.key) return f
    const base =
      f.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/^(\d)/, 'f_$1')
        .slice(0, 30) || 'field'
    let key = base
    for (let n = 2; used.has(key); n++) key = `${base}_${n}`
    used.add(key)
    return { ...f, key }
  })
}
