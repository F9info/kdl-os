import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export type FieldType = 'text' | 'email' | 'tel' | 'textarea'

export interface FormField {
  key: string
  label: string
  type: FieldType
  required: boolean
}

export interface FormDef {
  id: string
  name: string
  slug: string
  fields: FormField[]
  submit_label: string
  success_message: string
  notify_email: string | null
  is_active: boolean
  _count?: { submissions: number }
}

export interface FormSubmission {
  id: string
  data: Record<string, string>
  created_at: string
}

export type FormInput = Partial<Omit<FormDef, 'id' | '_count' | 'notify_email'>> & {
  notify_email?: string | null
}

const formsKey = ['forms'] as const

export function useForms() {
  return useQuery({
    queryKey: formsKey,
    queryFn: () => api.get('/forms').then((r) => r.data.data.items as FormDef[]),
  })
}

export function useFormSubmissions(formId: string | null) {
  return useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: () =>
      api.get(`/forms/${formId}/submissions`).then((r) => r.data.data.items as FormSubmission[]),
    enabled: Boolean(formId),
  })
}

export function useSaveForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: FormInput }) =>
      id ? api.patch(`/forms/${id}`, input) : api.post('/forms', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: formsKey }),
  })
}

export function useDeleteForm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/forms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: formsKey }),
  })
}
