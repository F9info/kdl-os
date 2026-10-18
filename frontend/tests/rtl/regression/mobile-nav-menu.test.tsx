/**
 * Regression tests for MobileNavMenu (Issue 6): the mobile drawer must expose
 * the full 3-level Menu tree as tap-to-expand accordions — before this, only
 * flat top-level links were reachable on phones.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MobileNavMenu, type HeaderMenuItem } from '@/app/admin/page-builder/packs/header-nav-menu'

const item = (id: string, label: string, extra: Partial<HeaderMenuItem> = {}): HeaderMenuItem => ({
  id,
  label,
  url: `/${id}`,
  open_in_new_tab: false,
  children: [],
  ...extra,
})

const TREE: HeaderMenuItem[] = [
  item('home', 'Home'),
  item('products', 'Products', {
    children: [
      item('hvac', 'HVAC', { children: [item('vrf', 'VRF Systems')] }),
      item('lights', 'Lights'),
    ],
  }),
  item('about', 'About', { no_page: true, url: null, children: [item('team', 'Team')] }),
]

describe('MobileNavMenu', () => {
  it('shows top-level items only until expanded', () => {
    render(<MobileNavMenu items={TREE} onNavigate={vi.fn()} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.queryByText('HVAC')).not.toBeInTheDocument()
    expect(screen.queryByText('VRF Systems')).not.toBeInTheDocument()
  })

  it('reaches all 3 levels by expanding', () => {
    render(<MobileNavMenu items={TREE} onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Expand Products' }))
    expect(screen.getByText('HVAC')).toBeInTheDocument()
    expect(screen.getByText('Lights')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand HVAC' }))
    expect(screen.getByText('VRF Systems').closest('a')).toHaveAttribute('href', '/vrf')
  })

  it('collapses again and reports aria-expanded', () => {
    render(<MobileNavMenu items={TREE} onNavigate={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Expand Products' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Collapse Products' })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Products' }))
    expect(screen.queryByText('HVAC')).not.toBeInTheDocument()
  })

  it('closes the drawer (onNavigate) when a link is followed', () => {
    const onNavigate = vi.fn()
    render(<MobileNavMenu items={TREE} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByText('Home'))
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })

  it('a no-page parent is not a link — tapping its label expands it', () => {
    render(<MobileNavMenu items={TREE} onNavigate={vi.fn()} />)
    const label = screen.getByText('About')
    expect(label.closest('a')).toBeNull()
    fireEvent.click(label)
    expect(screen.getByText('Team')).toBeInTheDocument()
  })

  it('neutralises javascript: urls', () => {
    render(
      <MobileNavMenu
        items={[item('x', 'Evil', { url: 'javascript:alert(1)' })]}
        onNavigate={vi.fn()}
      />
    )
    expect(screen.getByText('Evil').closest('a')).toHaveAttribute('href', '#')
  })
})
