import type {
  FieldValues,
  Path,
  PathValue,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

/**
 * The "Order" number and the Active/Inactive switch that every content form has (team, FAQ, gallery,
 * sectors, work, catalog, testimonials, projects). The form needs `order` and `is_active` fields.
 */
export function OrderStatusFields<T extends FieldValues>({
  register,
  setValue,
  isActive,
  orderError,
}: {
  register: UseFormRegister<T>
  setValue: UseFormSetValue<T>
  isActive: boolean
  orderError?: string
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Order" error={orderError}>
        <Input type="number" {...register('order' as Path<T>, { valueAsNumber: true })} />
      </FormField>
      <FormField label="Status">
        <div className="flex items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={(v) => setValue('is_active' as Path<T>, v as PathValue<T, Path<T>>)}
          />
          <span className="text-sm text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
        </div>
      </FormField>
    </div>
  )
}
