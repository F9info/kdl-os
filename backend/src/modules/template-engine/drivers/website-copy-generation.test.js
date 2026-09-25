import { describe, it, expect } from 'vitest';
import { CONSTRUCTION_HERO_HOME, CONSTRUCTION_ABOUT_SPLIT } from './website-seed-content.js';
import { buildGenerationTargets, applyGeneratedCopy } from './website-copy-generation.js';

function makePageData(overrides = {}) {
  return {
    content: [
      { type: 'ConstructionHero', props: { id: 'home-ConstructionHero', ...CONSTRUCTION_HERO_HOME, ...overrides.hero } },
      { type: 'ConstructionAboutSplit', props: { id: 'home-ConstructionAboutSplit', ...CONSTRUCTION_ABOUT_SPLIT, ...overrides.about } },
    ],
  };
}

describe('buildGenerationTargets', () => {
  it('includes all 3 hero slide indices and the about block when everything is still at default', () => {
    const targets = buildGenerationTargets(makePageData());
    const heroIndices = targets
      .filter((t) => t.blockType === 'ConstructionHero')
      .map((t) => t.slideIndex)
      .sort();
    expect(heroIndices).toEqual([0, 1, 2]);
    expect(targets.some((t) => t.blockType === 'ConstructionAboutSplit')).toBe(true);
  });

  it('excludes only the specific hero slide that has already been hand-edited', () => {
    const data = makePageData({
      hero: {
        d1Slides: [
          CONSTRUCTION_HERO_HOME.d1Slides[0],
          { ...CONSTRUCTION_HERO_HOME.d1Slides[1], headline: 'Something the developer typed' },
          CONSTRUCTION_HERO_HOME.d1Slides[2],
        ],
      },
    });
    const targets = buildGenerationTargets(data);
    const heroIndices = targets
      .filter((t) => t.blockType === 'ConstructionHero')
      .map((t) => t.slideIndex)
      .sort();
    expect(heroIndices).toEqual([0, 2]);
  });

  it('returns no hero or about targets when everything has been hand-edited', () => {
    const data = makePageData({
      hero: { d1Slides: CONSTRUCTION_HERO_HOME.d1Slides.map((s) => ({ ...s, headline: 'Edited' })) },
      about: { heading: 'Edited heading' },
    });
    expect(buildGenerationTargets(data)).toEqual([]);
  });
});

describe('applyGeneratedCopy', () => {
  const heroCopy = [
    { badge: 'B0', headline: 'H0', subheadline: 'S0', ctaLabel: 'C0' },
    { badge: 'B1', headline: 'H1', subheadline: 'S1', ctaLabel: 'C1' },
    { badge: 'B2', headline: 'H2', subheadline: 'S2', ctaLabel: 'C2' },
  ];

  it('patches all 3 hero slides and about when all are still-default targets, leaving image/ctaHref untouched', () => {
    const data = makePageData();
    const copy = {
      hero: heroCopy,
      about: { eyebrow: 'New eyebrow', heading: 'New heading', paragraph: 'New paragraph' },
    };
    const targets = buildGenerationTargets(data);
    const patched = applyGeneratedCopy(data, copy, targets);

    const hero = patched.content.find((b) => b.type === 'ConstructionHero');
    const about = patched.content.find((b) => b.type === 'ConstructionAboutSplit');
    expect(hero.props.d1Slides[0].headline).toBe('H0');
    expect(hero.props.d1Slides[1].headline).toBe('H1');
    expect(hero.props.d1Slides[2].headline).toBe('H2');
    expect(hero.props.d1Slides[0].image).toBe(CONSTRUCTION_HERO_HOME.d1Slides[0].image);
    expect(hero.props.d1Slides[0].ctaHref).toBe(CONSTRUCTION_HERO_HOME.d1Slides[0].ctaHref);
    expect(about.props.heading).toBe('New heading');
    expect(about.props.paragraph).toBe('New paragraph');
  });

  it('patches only the still-default hero slides when one has already been hand-edited', () => {
    const data = makePageData({
      hero: {
        d1Slides: [
          CONSTRUCTION_HERO_HOME.d1Slides[0],
          { ...CONSTRUCTION_HERO_HOME.d1Slides[1], headline: 'Hand-edited headline' },
          CONSTRUCTION_HERO_HOME.d1Slides[2],
        ],
      },
    });
    const targets = buildGenerationTargets(data);
    const patched = applyGeneratedCopy(data, { hero: heroCopy }, targets);

    const hero = patched.content.find((b) => b.type === 'ConstructionHero');
    expect(hero.props.d1Slides[0].headline).toBe('H0');
    expect(hero.props.d1Slides[1].headline).toBe('Hand-edited headline');
    expect(hero.props.d1Slides[2].headline).toBe('H2');
  });

  it('only patches the block types actually listed in targets', () => {
    const data = makePageData();
    const copy = { hero: heroCopy, about: { eyebrow: 'x', heading: 'x', paragraph: 'x' } };
    const heroOnlyTargets = [0, 1, 2].map((slideIndex) => ({
      blockType: 'ConstructionHero',
      slideIndex,
    }));
    const patched = applyGeneratedCopy(data, copy, heroOnlyTargets);
    const about = patched.content.find((b) => b.type === 'ConstructionAboutSplit');
    expect(about.props.paragraph).toBe(CONSTRUCTION_ABOUT_SPLIT.paragraph);
  });
});
