import { describe, it, expect, vi } from 'vitest'
import { useForm } from 'react-hook-form'
import { render, screen, fireEvent, waitFor } from '../utils'
import { OrderStatusFields } from '@/admin/components/shared/OrderStatusFields'

type Form = { order: number; is_active: boolean }

function Harness({ onSubmit, defaults }: { onSubmit: (v: Form) => void; defaults: Form }) {
  const { register, setValue, watch, handleSubmit } = useForm<Form>({ defaultValues: defaults })
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <OrderStatusFields
        register={register}
        setValue={setValue}
        isActive={watch('is_active')}
        orderError="Too big"
      />
      <button type="submit">go</button>
    </form>
  )
}

describe('OrderStatusFields (shared by the eight content forms)', () => {
  it('shows the order, the status and the form error', () => {
    render(<Harness onSubmit={vi.fn()} defaults={{ order: 3, is_active: true }} />)
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('3')
    expect(screen.getByText('Active')).toBeTruthy()
    expect(screen.getByText('Too big')).toBeTruthy()
  })

  it('submits the order as a number and the status as a boolean', async () => {
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} defaults={{ order: 1, is_active: true }} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText('Inactive')).toBeTruthy()
    fireEvent.click(screen.getByText('go'))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0]![0]).toEqual({ order: 7, is_active: false })
  })
})
