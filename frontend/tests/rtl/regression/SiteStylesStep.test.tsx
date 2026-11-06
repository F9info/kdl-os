import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '../utils'
import { SiteStylesStep } from '@/app/admin/template-engine/_components/stages/SiteStylesStep'

const h = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/axios', () => ({ default: { get: h.get, put: h.put } }))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))
// The test wrapper uses the real provider, so keep everything and replace only the refresh.
vi.mock('@/components/providers/ThemeEngineProvider', async (importActual) => ({
  ...(await importActual<typeof import('@/components/providers/ThemeEngineProvider')>()),
  refreshThemeEngineTokens: h.refresh,
}))

const BUTTONS = [
  'solid',
  'pill',
  'classic',
  'leaf',
  'outline',
  'soft',
  'elevated',
  'hard',
  'glow',
  'gradient',
  'gradientglow',
  'bold',
]
const FORMS = ['outlined', 'filled', 'underline', 'rounded', 'soft', 'bold', 'sharp', 'glow']

const data = (button = 'solid', form = 'outlined') => ({
  button,
  form,
  options: {
    buttons: BUTTONS.map((key) => ({
      key,
      label: key[0]!.toUpperCase() + key.slice(1),
      description: `The ${key} button.`,
      base: `border-radius: ${key === 'pill' ? 9999 : 8}px;`,
      hover: 'filter: brightness(0.9);',
    })),
    forms: FORMS.map((key) => ({
      key,
      label: key[0]!.toUpperCase() + key.slice(1),
      description: `The ${key} field.`,
      base: 'border: 1px solid gray;',
      focus: 'outline: none;',
      ...(key === 'rounded' ? { textarea: 'border-radius: 1.25rem;' } : {}),
    })),
  },
})

const mount = (props: Partial<{ onBack: () => void; onNext: () => void }> = {}) =>
  render(<SiteStylesStep onBack={props.onBack ?? vi.fn()} onNext={props.onNext ?? vi.fn()} />)

const box = (kind: 'button' | 'form', key: string) =>
  screen.getByTestId(`${kind}-style-${key}`) as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  h.get.mockResolvedValue({ data: { data: data() } })
  h.put.mockImplementation(async (_url: string, body: { button?: string; form?: string }) => ({
    data: { data: data(body.button ?? 'solid', body.form ?? 'outlined') },
  }))
})

describe('Buttons and form fields step', () => {
  it('shows 12 button styles and 8 form-field styles, each a checkbox card', async () => {
    mount()
    await screen.findByTestId('button-style-solid')
    for (const k of BUTTONS) expect(box('button', k).type).toBe('checkbox')
    for (const k of FORMS) expect(box('form', k).type).toBe('checkbox')
    expect(screen.getAllByRole('checkbox')).toHaveLength(20)
  })

  it('starts on what is saved: exactly one checked in each group', async () => {
    h.get.mockResolvedValue({ data: { data: data('pill', 'glow') } })
    mount()
    await screen.findByTestId('button-style-pill')
    await waitFor(() => expect(box('button', 'pill').checked).toBe(true))
    expect(box('form', 'glow').checked).toBe(true)
    expect(
      screen.getAllByRole('checkbox').filter((c) => (c as HTMLInputElement).checked)
    ).toHaveLength(2)
  })

  it('picking another style moves the tick: one style per group, used everywhere', async () => {
    mount()
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(box('button', 'gradient'))
    expect(box('button', 'gradient').checked).toBe(true)
    expect(box('button', 'solid').checked).toBe(false)
    fireEvent.click(box('form', 'underline'))
    expect(box('form', 'underline').checked).toBe(true)
    expect(box('form', 'outlined').checked).toBe(false)
  })

  it('clicking the chosen style again keeps it chosen (never none)', async () => {
    mount()
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(box('button', 'solid'))
    expect(box('button', 'solid').checked).toBe(true)
  })

  it('draws each style live with the same CSS the website gets, scoped to its own card', async () => {
    const { container } = mount()
    await screen.findByTestId('button-style-solid')
    const css = [...container.querySelectorAll('style')].map((s) => s.textContent).join('')
    expect(css).toContain('.kdl-sp-btn-pill .pv{border-radius: 9999px;}')
    expect(css).toContain('.kdl-sp-btn-pill .pv:hover{filter: brightness(0.9);}')
    expect(css).toContain('.kdl-sp-form-glow .pv:focus{outline: none;}')
    expect(css).toContain('.kdl-sp-form-rounded textarea.pv{border-radius: 1.25rem;}')
    // nothing leaks onto the page: every rule starts with a sample class
    for (const rule of css.split('}').filter(Boolean))
      expect(rule.startsWith('.kdl-sp-')).toBe(true)
  })

  it('Save sends the choice, then refreshes the theme so the site picks it up', async () => {
    mount()
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(box('button', 'pill'))
    fireEvent.click(box('form', 'filled'))
    fireEvent.click(screen.getByTestId('site-styles-save'))
    await waitFor(() =>
      expect(h.put).toHaveBeenCalledWith('/theme-engine/site-styles', {
        button: 'pill',
        form: 'filled',
      })
    )
    await waitFor(() => expect(h.refresh).toHaveBeenCalled())
  })

  it('Save with nothing changed sends nothing', async () => {
    mount()
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(screen.getByTestId('site-styles-save'))
    await new Promise((r) => setTimeout(r, 20))
    expect(h.put).not.toHaveBeenCalled()
  })

  it('Next: Navigation saves first, then moves on', async () => {
    const onNext = vi.fn()
    mount({ onNext })
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(box('button', 'hard'))
    fireEvent.click(screen.getByTestId('site-styles-next'))
    await waitFor(() => expect(h.put).toHaveBeenCalled())
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
  })

  it('Next with nothing changed just moves on', async () => {
    const onNext = vi.fn()
    mount({ onNext })
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(screen.getByTestId('site-styles-next'))
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(h.put).not.toHaveBeenCalled()
  })

  it('a failed save keeps you here with your choice', async () => {
    h.put.mockRejectedValue(new Error('boom'))
    const onNext = vi.fn()
    mount({ onNext })
    await screen.findByTestId('button-style-solid')
    await waitFor(() => expect(box('button', 'solid').checked).toBe(true))
    fireEvent.click(box('button', 'bold'))
    fireEvent.click(screen.getByTestId('site-styles-next'))
    await waitFor(() => expect(h.put).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(onNext).not.toHaveBeenCalled()
    expect(box('button', 'bold').checked).toBe(true)
  })

  it('Back goes to Font settings; the words say it applies to the whole website, not the admin', async () => {
    const onBack = vi.fn()
    mount({ onBack })
    expect(await screen.findByText(/every button and every form on your website/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /back to font settings/i }))
    expect(onBack).toHaveBeenCalled()
    expect(screen.getByText(/admin\s+screens are not changed/i)).toBeTruthy()
    expect(within(screen.getByLabelText('Button style')).getAllByRole('checkbox')).toHaveLength(12)
  })

  it('shows an error when the styles cannot be loaded', async () => {
    h.get.mockRejectedValue(new Error('offline'))
    mount()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('button', { name: /back to font settings/i })).toBeTruthy() // never a dead end
    expect(screen.queryByTestId('site-styles-save')).toBeNull() // nothing to save without the styles
  })
})
