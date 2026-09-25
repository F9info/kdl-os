// Pure computation for the "Generate content with AI" action: which blocks
// on the home page are still at their static-seed default (eligible for
// generation), and applying a generated copy envelope back onto page data.
// No prisma, no credits, no HTTP here — same "thin, pure" boundary
// website-seed-content.js's patchBrand/patchConstructionContact already
// use; the orchestration (credit hold, AI call, DB write) lives in
// service.js, one level up.

import { CONSTRUCTION_HERO_HOME, CONSTRUCTION_ABOUT_SPLIT } from './website-seed-content.js';

// Key-order-independent structural equality. NOT JSON.stringify comparison —
// jsonb (builder_pages.data's real column type) reorders object keys on
// every round trip through Postgres (confirmed empirically: alphabetical-
// by-length, not insertion order), so a slide read back from a real DB would
// never string-match CONSTRUCTION_HERO_HOME's literal key order even when
// byte-for-byte unedited. No lodash/fast-deep-equal is a direct dependency
// of this package (only transitive, via other deps) — this is small enough
// to keep dependency-free rather than take on an indirect-turned-direct dep.
function deepEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]),
  );
}

// v1 scope: Hero + About only (Disciplines isn't part of the generic seed
// set at all, so it has no static default to compare against here).
//
// Hero is targeted per-slide, not per-block: CONSTRUCTION_HERO_HOME seeds 3
// slides and the AI generates all 3 in one call, but "never touch
// already-edited content" applies per slide — a developer who's hand-edited
// only slide 2 should still get AI copy on slides 1 and 3. About has no
// array to break down, so it stays a single block-level target.
export function buildGenerationTargets(data) {
  if (!data?.content) return [];
  const targets = [];
  for (const block of data.content) {
    if (block.type === 'ConstructionHero' && Array.isArray(block.props?.d1Slides)) {
      block.props.d1Slides.forEach((slide, slideIndex) => {
        const seedSlide = CONSTRUCTION_HERO_HOME.d1Slides[slideIndex];
        if (seedSlide && deepEqual(slide, seedSlide)) {
          targets.push({ blockType: 'ConstructionHero', slideIndex });
        }
      });
    }
    if (
      block.type === 'ConstructionAboutSplit' &&
      block.props?.heading === CONSTRUCTION_ABOUT_SPLIT.heading &&
      block.props?.paragraph === CONSTRUCTION_ABOUT_SPLIT.paragraph
    ) {
      targets.push({ blockType: 'ConstructionAboutSplit' });
    }
  }
  return targets;
}

// `copy` is the ai-services envelope's `.copy` field ({ hero: [3 variants],
// about }). `targets` restricts which hero slide indices / whether about
// actually get patched — anything not named in targets is left
// byte-for-byte untouched, even if `copy` has data for it.
export function applyGeneratedCopy(data, copy, targets) {
  const heroSlideIndices = new Set(
    targets.filter((t) => t.blockType === 'ConstructionHero').map((t) => t.slideIndex),
  );
  const patchAbout = targets.some((t) => t.blockType === 'ConstructionAboutSplit');

  const content = data.content.map((block) => {
    if (block.type === 'ConstructionHero' && heroSlideIndices.size > 0 && copy?.hero) {
      const d1Slides = block.props.d1Slides.map((slide, slideIndex) => {
        const variant = copy.hero[slideIndex];
        if (!heroSlideIndices.has(slideIndex) || !variant) return slide;
        return {
          ...slide,
          badge: variant.badge,
          headline: variant.headline,
          subheadline: variant.subheadline,
          ctaLabel: variant.ctaLabel,
        };
      });
      return { ...block, props: { ...block.props, d1Slides } };
    }
    if (block.type === 'ConstructionAboutSplit' && patchAbout && copy?.about) {
      return {
        ...block,
        props: {
          ...block.props,
          eyebrow: copy.about.eyebrow,
          heading: copy.about.heading,
          paragraph: copy.about.paragraph,
        },
      };
    }
    return block;
  });
  return { ...data, content };
}
