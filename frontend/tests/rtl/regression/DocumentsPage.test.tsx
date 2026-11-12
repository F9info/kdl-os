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
    for (const f of flows as { file: string; href?: string }[]) {
      const link = links.find((l) => l.getAttribute('href') === (f.href ?? `/docs/flows/${f.file}`))
      expect(link).toBeDefined()
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
  })

  it('groups guides under their category, with the installation manual under KDL OS – Installation & User Guides', () => {
    render(<DocumentsPage />)
    const heading = screen.getByRole('heading', { name: 'KDL OS – Installation & User Guides' })
    const list = heading.closest('section')!
    expect(list).toHaveTextContent('KDL OS – Complete Installation & Setup Guide')
    expect(list).toHaveTextContent('Version 1.0')
  })
})
