import { describe, it, expect } from 'vitest'
import { render, screen } from '../utils'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'

const tile = () => screen.getByAltText('logo_dark preview').parentElement as HTMLElement

describe('ImageUploadField thumbnail', () => {
  it('draws a picture made for dark backgrounds (a white logo) on a dark tile, so it is visible', () => {
    render(
      <ImageUploadField
        name="logo_dark"
        value="media/d.png"
        previewUrl="https://cdn.test/d.png"
        darkBackground
        onChange={() => {}}
        emptyText="None"
      />
    )
    expect(tile().className).toContain('bg-slate-800')
  })

  it('uses the normal light tile otherwise', () => {
    render(
      <ImageUploadField
        name="logo_dark"
        value="media/d.png"
        previewUrl="https://cdn.test/d.png"
        onChange={() => {}}
        emptyText="None"
      />
    )
    expect(tile().className).toContain('bg-muted')
  })

  it('shows the inherited picture while empty, and the own picture once set', () => {
    const { rerender } = render(
      <ImageUploadField
        name="logo_dark"
        value=""
        previewUrl=""
        inheritedUrl="https://cdn.test/project.png"
        onChange={() => {}}
        emptyText="Using the project image"
      />
    )
    expect((screen.getByAltText('logo_dark preview') as HTMLImageElement).src).toBe(
      'https://cdn.test/project.png'
    )
    expect(screen.getByText('Using the project image')).toBeTruthy()
    rerender(
      <ImageUploadField
        name="logo_dark"
        value="media/own.png"
        previewUrl="https://cdn.test/own.png"
        inheritedUrl="https://cdn.test/project.png"
        onChange={() => {}}
        emptyText="Using the project image"
      />
    )
    expect((screen.getByAltText('logo_dark preview') as HTMLImageElement).src).toBe(
      'https://cdn.test/own.png'
    )
  })
})
