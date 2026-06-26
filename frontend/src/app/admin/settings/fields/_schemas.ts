import { z } from 'zod'
import type { InputType } from '@/types/models.types'
import { INPUT_TYPE_LABELS, OPTION_INPUT_TYPES } from '@/lib/inputTypes'

const inputTypeKeys = Object.keys(INPUT_TYPE_LABELS) as [InputType, ...InputType[]]

export const fieldDefSchema = z
  .object({
    field_name: z.string().min(1, 'Field name is required').max(150),
    input_type: z.enum(inputTypeKeys),
    options: z.string().max(2000).optional(),
    type_id: z.string().min(1, 'Type is required'),
    category_id: z.string().optional(),
  })
  .refine(
    (d) => !OPTION_INPUT_TYPES.includes(d.input_type) || (d.options ?? '').trim().length > 0,
    { message: 'Options are required for select, radio, and checkbox', path: ['options'] }
  )

export type FieldDefFormData = z.infer<typeof fieldDefSchema>
