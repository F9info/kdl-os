import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const duplicate = vi.fn().mockResolvedValue({})
const saveLayout = vi.fn().mockResolvedValue(undefined)
vi.mock('@/app/admin/page-builder/store', () => ({
  listPages: async () => [{ id: 'p1', slug: 'demo-home', title: 'Home' }],
  duplicatePage: (id: string) => duplicate(id),
  saveAsLayout: (id: string, name: string) => saveLayout(id, name),
}))
vi.mock('@/lib/axios', () => ({
  default: { post: async () => ({ data: { data: { menu: { items: [] } } } }) },
}))
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

import { NavPagesGrid } from '@/app/admin/template-engine/_components/stages/NavPagesGrid'

describe('NavPagesGrid page actions (T11)', () => {
  it('Duplicate and Save as layout call the page-builder API for that page', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <NavPagesGrid projectId="proj" />
      </QueryClientProvider>
    )
    fireEvent.click(await screen.findByText('Duplicate'))
    await waitFor(() => expect(duplicate).toHaveBeenCalledWith('p1'))
    vi.spyOn(window, 'prompt').mockReturnValue(' Home layout ')
    fireEvent.click(screen.getByText('Save as layout'))
    await waitFor(() => expect(saveLayout).toHaveBeenCalledWith('p1', 'Home layout'))
  })
})
