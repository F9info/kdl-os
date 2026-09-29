import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { prisma } from '../../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Client-approved page content for Subhadra Group's sector detail pages,
// extracted once from the approved static-HTML mockups (after-delete-folder/
// sector-*.html) — see seed-data/subhadra-sector-content.json. Not
// re-parsed at runtime; that folder is scratch/temporary.
const CONTENT_BY_SLUG = JSON.parse(
  readFileSync(path.join(__dirname, 'seed-data/subhadra-sector-content.json'), 'utf8')
);

function rewriteBlockId(oldId, oldSlug, newSlug) {
  if (oldId && oldId.startsWith(`${oldSlug}-`)) {
    return `${newSlug}-${oldId.slice(oldSlug.length + 1)}`;
  }
  return oldId;
}

// Applies one sector's approved content onto a deep copy of the template
// page's Puck `data` — Header/Footer/OurBrands (the site-wide brand
// catalog) pass through untouched; every other block's content/images are
// replaced with that sector's own approved copy.
function buildDataForSector(templateData, templateSlug, slug, sectorName, parsed) {
  const data = structuredClone(templateData);
  data.root.props.title = sectorName;

  const { banner, discipline, approach, process, whyDark, projectPhotos, leadFormFaq, testimonials, finalCta } =
    parsed;
  const { scope, areas } = discipline;

  let scopeAssigned = false;
  let areasAssigned = false;
  let iconGridIndex = 0; // first ConstructionIconFeatureGrid = light highlights, second = dark "why choose us"

  for (const block of data.content) {
    const props = block.props;
    props.id = rewriteBlockId(props.id, templateSlug, slug);

    switch (block.type) {
      case 'ConstructionInnerBanner':
        props.imageAlt = banner.imageAlt || sectorName;
        props.subtitle = banner.subtitle || props.subtitle;
        props.backgroundImage = banner.backgroundImage || props.backgroundImage;
        if (banner.ctaPrimaryLabel) props.ctaPrimaryLabel = banner.ctaPrimaryLabel;
        if (banner.ctaSecondaryLabel) props.ctaSecondaryLabel = banner.ctaSecondaryLabel;
        break;

      case 'ConstructionIconFeatureGrid':
        if (iconGridIndex === 0) {
          if (parsed.highlights?.length) props.items = parsed.highlights;
        } else {
          if (whyDark.items?.length) props.items = whyDark.items;
          props.sectionTitle = whyDark.sectionTitle || props.sectionTitle;
          props.sectionEyebrow = whyDark.sectionEyebrow || props.sectionEyebrow;
        }
        iconGridIndex += 1;
        break;

      case 'ConstructionDisciplineRows':
        if (!scopeAssigned && scope.items?.length) {
          props.items = scope.items;
          props.sectionTitle = scope.sectionTitle || props.sectionTitle;
          props.sectionEyebrow = scope.sectionEyebrow || props.sectionEyebrow;
          props.sectionSubtitle = scope.sectionSubtitle || props.sectionSubtitle;
          scopeAssigned = true;
        } else if (!areasAssigned && areas.items?.length) {
          props.items = areas.items;
          areasAssigned = true;
        }
        break;

      case 'ConstructionApproachSplit':
        props.photo = approach.photo || props.photo;
        props.eyebrow = approach.eyebrow || props.eyebrow;
        props.heading = approach.heading || props.heading;
        props.paragraph1 = approach.paragraph1 || props.paragraph1;
        props.paragraph2 = approach.paragraph2 || props.paragraph2;
        for (const k of [
          'stat1Label', 'stat1Value', 'stat2Label', 'stat2Value', 'stat3Label', 'stat3Value',
          'highlight1Icon', 'highlight2Icon', 'highlight1Title', 'highlight2Title',
          'highlight1Description', 'highlight2Description',
        ]) {
          if (approach[k]) props[k] = approach[k];
        }
        break;

      case 'ConstructionProcessSteps':
        if (process.items?.length) props.items = process.items;
        props.sectionTitle = process.sectionTitle || props.sectionTitle;
        props.sectionEyebrow = process.sectionEyebrow || props.sectionEyebrow;
        break;

      case 'ConstructionOurBrands':
        break; // site-wide brand catalog — reused verbatim, not per-sector

      case 'ConstructionProjectPhotoSlider':
        if (projectPhotos.items?.length) props.items = projectPhotos.items;
        props.sectionTitle = projectPhotos.sectionTitle || props.sectionTitle;
        props.sectionEyebrow = projectPhotos.sectionEyebrow || props.sectionEyebrow;
        props.sectionSubtitle = projectPhotos.sectionSubtitle || props.sectionSubtitle;
        break;

      case 'ConstructionLeadFormFAQ':
        if (leadFormFaq.faqs?.length) props.faqs = leadFormFaq.faqs;
        props.sectionTitle = leadFormFaq.sectionTitle || props.sectionTitle;
        props.sectionEyebrow = leadFormFaq.sectionEyebrow || props.sectionEyebrow;
        props.formHeading = leadFormFaq.formHeading || props.formHeading;
        props.formSubtext = leadFormFaq.formSubtext || props.formSubtext;
        props.formPrivacyNote = leadFormFaq.formPrivacyNote || props.formPrivacyNote;
        props.ctaLabel = leadFormFaq.ctaLabel || props.ctaLabel;
        if (leadFormFaq.interestOptions) props.interestOptions = leadFormFaq.interestOptions;
        break;

      case 'ConstructionTestimonialsSlider':
        if (testimonials.slides?.length) props.slides = testimonials.slides;
        props.sectionTitle = testimonials.sectionTitle || props.sectionTitle;
        props.sectionEyebrow = testimonials.sectionEyebrow || props.sectionEyebrow;
        break;

      case 'ConstructionQuoteCTA':
        props.headline = finalCta.headline || props.headline;
        props.subtext = finalCta.subtext || props.subtext;
        if (finalCta.ctaLabel) props.ctaLabel = finalCta.ctaLabel;
        if (finalCta.secondaryCtaLabel) props.secondaryCtaLabel = finalCta.secondaryCtaLabel;
        // ctaHref/secondaryCtaHref deliberately left alone — the approved
        // HTML's "contact.html"/"#get-quote" relative links aren't valid
        // here; keep whatever real /p/te-...-contact + #get-quote the page
        // already has.
        break;

      default:
        break;
    }
  }

  return data;
}

const DESIGN_KEYS = new Set(['id', 'variant', 'visible', 'padding', 'background', 'homeHref']);
const SITE_WIDE = new Set(['ConstructionHeader', 'ConstructionFooter', 'ConstructionOurBrands']);
const suffixOf = (blockId) => blockId.slice(blockId.indexOf('-') + 1);

// Stores each sector's approved copy on `sector.content` as an overlay keyed
// by the shared template block's id suffix. The public page and the editor
// apply it over the always-live DetailPageTemplate (resolveSectorBindings),
// so structure/design stay shared while every sector shows its own approved
// text and images. Safe to re-run: always rebuilds from template + JSON.
export async function seedSubhadraSectorContent(
  prismaClient = prisma,
  { projectId = 'cmt15bmts000401s6fn5ydhzp', templateSlug = 'showrooms' } = {}
) {
  const template = await prismaClient.detailPageTemplate.findUnique({
    where: { project_id_type_key: { project_id: projectId, type_key: 'sectors' } },
  });
  if (!template) {
    console.log('sectors.seed-content: no sectors template for project, skipping');
    return;
  }

  const sectors = await prismaClient.sector.findMany({ where: { project_id: projectId } });
  for (const sector of sectors) {
    const parsed = CONTENT_BY_SLUG[sector.slug];
    if (!parsed) {
      console.log(`sectors.seed-content: skipping "${sector.name}" (no approved content for slug "${sector.slug}")`);
      continue;
    }
    const built = buildDataForSector(template.data, templateSlug, sector.slug, sector.name, parsed);
    const content = {};
    template.data.content.forEach((tplBlock, i) => {
      if (SITE_WIDE.has(tplBlock.type) || !tplBlock.props?.id) return;
      const props = {};
      for (const [k, v] of Object.entries(built.content[i].props)) {
        if (DESIGN_KEYS.has(k)) continue;
        if (JSON.stringify(v) !== JSON.stringify(tplBlock.props[k])) props[k] = v;
      }
      if (Object.keys(props).length) content[suffixOf(tplBlock.props.id)] = props;
    });
    await prismaClient.sector.update({ where: { id: sector.id }, data: { content } });
    console.log(`sectors.seed-content: applied approved content to "${sector.name}"`);
  }
}

export default async function seed(tx) {
  await seedSubhadraSectorContent(tx);
}
