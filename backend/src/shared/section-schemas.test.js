import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { getSectionSchemas } from './section-schemas.js';

const present = existsSync(
  path.resolve(process.cwd(), '..', 'frontend', 'src', 'frontend', 'blocks', 'section-schemas.json')
);

describe.skipIf(!present)('section schemas shared with the frontend', () => {
  const schemas = getSectionSchemas();

  it('loads the committed file: a hundred-odd blocks with typed, tabbed fields', () => {
    expect(Object.keys(schemas).length).toBeGreaterThan(100);
    for (const [type, s] of Object.entries(schemas)) {
      expect(s.label, type).toBeTruthy();
      for (const [key, f] of Object.entries(s.fields)) {
        expect(['content', 'style'], `${type}.${key}`).toContain(f.tab);
        expect(f.kind, `${type}.${key}`).toBeTruthy();
      }
    }
  });

  it('knows the blocks the starter site and the landing templates use', () => {
    for (const t of [
      'Hero',
      'Heading',
      'Text',
      'Button',
      'Image',
      'FeatureCards',
      'ContactForm',
      'NavBar',
      'Footer',
      'CustomComposedBlock',
    ])
      expect(schemas[t], t).toBeTruthy();
  });

  it('select fields carry their allowed values (what the publish check compares against)', () => {
    expect(schemas.Button.fields.variant).toMatchObject({
      kind: 'select',
      options: ['primary', 'secondary'],
    });
  });
});
