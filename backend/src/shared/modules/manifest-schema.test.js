import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestSchema } from './manifest-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '../../modules');

function readModule(slug) {
  return JSON.parse(readFileSync(join(MODULES_DIR, slug, 'module.json'), 'utf8'));
}

describe('manifestSchema — field preservation', () => {
  it('preserves navSuppressedByPeer from theme-engine-ui', () => {
    const result = manifestSchema.safeParse(readModule('theme-engine-ui'));
    expect(result.success).toBe(true);
    expect(result.data.navSuppressedByPeer).toEqual(['template-engine']);
  });

  it('preserves navSuppressedByPeer from page-builder-ui', () => {
    const result = manifestSchema.safeParse(readModule('page-builder-ui'));
    expect(result.success).toBe(true);
    expect(result.data.navSuppressedByPeer).toEqual(['template-engine']);
  });

  it('preserves visibleInCatalog: false from brand-kit', () => {
    const result = manifestSchema.safeParse(readModule('brand-kit'));
    expect(result.success).toBe(true);
    expect(result.data.visibleInCatalog).toBe(false);
  });

  it('preserves visibleInCatalog: false from projects', () => {
    const result = manifestSchema.safeParse(readModule('projects'));
    expect(result.success).toBe(true);
    expect(result.data.visibleInCatalog).toBe(false);
  });

  it('preserves visibleInCatalog: false from collateral', () => {
    const result = manifestSchema.safeParse(readModule('collateral'));
    expect(result.success).toBe(true);
    expect(result.data.visibleInCatalog).toBe(false);
  });

  it('preserves visibleInCatalog: false from credits', () => {
    const result = manifestSchema.safeParse(readModule('credits'));
    expect(result.success).toBe(true);
    expect(result.data.visibleInCatalog).toBe(false);
  });

  it('defaults navSuppressedByPeer to [] when absent', () => {
    const result = manifestSchema.safeParse(readModule('auth'));
    expect(result.success).toBe(true);
    expect(result.data.navSuppressedByPeer).toEqual([]);
  });

  it('defaults visibleInCatalog to true when absent', () => {
    const result = manifestSchema.safeParse(readModule('auth'));
    expect(result.success).toBe(true);
    expect(result.data.visibleInCatalog).toBe(true);
  });
});

describe('manifestSchema — all on-disk manifests parse successfully', () => {
  const moduleDirs = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => {
      try {
        readFileSync(join(MODULES_DIR, name, 'module.json'));
        return true;
      } catch {
        return false;
      }
    });

  it.each(moduleDirs)('%s/module.json parses without error', (slug) => {
    const raw = readModule(slug);
    const result = manifestSchema.safeParse(raw);
    expect(result.success, result.error?.message).toBe(true);
  });
});
