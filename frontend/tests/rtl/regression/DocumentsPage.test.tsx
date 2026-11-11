import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { render } from '../utils'
import DocumentsPage from '@/app/admin/documents/page'
import flows from '@/admin/lib/flow-docs.json'

describe('Documents page', () => {
  it('lists every flow guide as a PDF link that opens in a new tab', () => {
    render(<DocumentsPage />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(flows.length)
    for (const [i, f] of flows.entries()) {
      expect(links[i]).toHaveAttribute('href', `/docs/flows/${f.file}`)
      expect(links[i]).toHaveAttribute('target', '_blank')
      expect(links[i]).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })
})
