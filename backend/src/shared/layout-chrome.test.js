import { describe, it, expect } from 'vitest';
import { layoutBlockTypes, scaffoldChromeTypes } from './layout-chrome.js';

// Reads frontend/src/frontend/blocks/layout-chrome.json, the list the editor uses too.
describe('layout chrome list (shared with the editor)', () => {
  it('knows the header and footer blocks, F9 ones included', () => {
    const types = layoutBlockTypes();
    for (const t of ['ConstructionHeader', 'ConstructionFooter', 'NavBar', 'Footer', 'F9Header', 'F9Footer']) {
      expect(types.has(t), t).toBe(true);
    }
    expect(types.has('Hero')).toBe(false);
  });
  it('gives the page scaffold the chrome blocks it copies into a new page', () => {
    expect(scaffoldChromeTypes()).toEqual(['ConstructionTopBar', 'ConstructionHeader', 'ConstructionFooter']);
  });
});
