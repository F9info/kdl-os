import { describe, it, expect } from 'vitest';
import { patchLayout, seedWebsitePageData } from './website-seed-content.js';

describe('patchLayout', () => {
  it('is a no-op when layout is not provided', () => {
    const data = seedWebsitePageData('about', 'About', {}, []);
    expect(patchLayout(data, undefined, 'about', {}, [])).toBeNull();
  });

  it('inserts a newly-enabled top-header before the existing header', () => {
    const data = seedWebsitePageData('about', 'About', {}, []);
    const result = patchLayout(
      data,
      { topHeader: { enabled: true, variant: '2' } },
      'about',
      {},
      []
    );
    expect(result.content[0].type).toBe('ConstructionTopBar');
    expect(result.content[0].props.variant).toBe('2');
    expect(result.content[1].type).toBe('NavBar');
  });

  it('inserts header after an already-present top-header, not at index 0', () => {
    const withTopHeader = patchLayout(
      seedWebsitePageData('about', 'About', {}, []),
      { topHeader: { enabled: true } },
      'about',
      {},
      []
    );
    // Toggle header off then back on in a second call — it must land back
    // between the top-header and the rest of the page, not jump to index 0.
    const headerOff = patchLayout(
      withTopHeader,
      { header: { enabled: false } },
      'about',
      {},
      []
    );
    expect(headerOff.content.map((b) => b.type)).not.toContain('NavBar');

    const headerBackOn = patchLayout(headerOff, { header: { enabled: true } }, 'about', {}, []);
    expect(headerBackOn.content.map((b) => b.type)).toEqual([
      'ConstructionTopBar',
      'ConstructionHeader',
      'Hero',
      'Text',
      'Footer',
    ]);
  });

  it('removes the footer when disabled and returns null on a repeat call (no pointless write)', () => {
    const data = seedWebsitePageData('about', 'About', {}, []);
    const removed = patchLayout(data, { footer: { enabled: false } }, 'about', {}, []);
    expect(removed.content.some((b) => b.type === 'Footer')).toBe(false);

    const again = patchLayout(removed, { footer: { enabled: false } }, 'about', {}, []);
    expect(again).toBeNull();
  });

  it('swaps a NavBar-seeded header for ConstructionHeader in place, then re-styles it without re-swapping', () => {
    const data = seedWebsitePageData('about', 'About', {}, []);
    expect(data.content[0].type).toBe('NavBar');
    const navBarIndex = 0;

    const swapped = patchLayout(data, { header: { enabled: true, variant: '3' } }, 'about', {}, []);
    expect(swapped.content[navBarIndex].type).toBe('ConstructionHeader');
    expect(swapped.content[navBarIndex].props.variant).toBe('3');
    expect(swapped.content.map((b) => b.type)).not.toContain('NavBar');

    // Re-run with the same variant — no NavBar left to find, so this must be
    // a no-op (variant already matches), not another swap.
    expect(patchLayout(swapped, { header: { enabled: true, variant: '3' } }, 'about', {}, [])).toBeNull();

    const restyled = patchLayout(swapped, { header: { enabled: true, variant: '2' } }, 'about', {}, []);
    expect(restyled.content[navBarIndex].type).toBe('ConstructionHeader');
    expect(restyled.content[navBarIndex].props.variant).toBe('2');
  });

  it('swaps a Footer-seeded footer for ConstructionFooter in place, then re-styles it without re-swapping', () => {
    const data = seedWebsitePageData('about', 'About', {}, []);
    const footerIndex = data.content.length - 1;
    expect(data.content[footerIndex].type).toBe('Footer');

    const swapped = patchLayout(data, { footer: { enabled: true, variant: '1' } }, 'about', {}, []);
    expect(swapped.content[footerIndex].type).toBe('ConstructionFooter');
    expect(swapped.content[footerIndex].props.variant).toBe('1');
    expect(swapped.content.map((b) => b.type)).not.toContain('Footer');

    expect(patchLayout(swapped, { footer: { enabled: true, variant: '1' } }, 'about', {}, [])).toBeNull();
  });
});

describe('patchLayout custom (Section Builder) blocks', () => {
  const custom = { id: 'cb1', config: { category: 'header', atoms: [], settings: {} } };

  it('replaces the legacy header with the saved block, then back to a design', () => {
    const data = seedWebsitePageData('about', 'About', {}, []);
    const applied = patchLayout(
      data,
      { header: { enabled: true, variant: 'custom:cb1', customBlock: custom } },
      'about',
      {},
      []
    );
    const slot = applied.content.filter((b) => b.props.layoutSlot === 'header');
    expect(slot).toHaveLength(1);
    expect(applied.content.some((b) => b.type === 'NavBar')).toBe(false);
    expect(
      patchLayout(applied, { header: { enabled: true, customBlock: custom } }, 'about', {}, [])
    ).toBeNull();

    const back = patchLayout(applied, { header: { enabled: true, variant: '2' } }, 'about', {}, []);
    expect(back.content.some((b) => b.props.layoutSlot === 'header')).toBe(false);
    expect(back.content.find((b) => b.type === 'ConstructionHeader').props.variant).toBe('2');
  });
});
