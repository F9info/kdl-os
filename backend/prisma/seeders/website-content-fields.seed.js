// Website Content fields seed.
//
// Generic Settings→Fields definitions for simple, non-relational website
// copy (Vision, Mission, About intro, tagline strip) — the "don't build a
// module for every small piece of text" half of the content-architecture
// split (Team/FAQ/Projects Content are dedicated modules; this is the
// generic-field half). Standalone fields (owner_module: null), editable
// through the generic setting-fields API/admin UI at
// /admin/settings/view/website-content, same mechanism as any other
// Application Settings Type — mirrors brand-profile-fields.seed.js exactly.
//
// This function seeds FIELD DEFINITIONS ONLY (empty values) — safe for the
// generic, client-agnostic `prisma/seed.js` pipeline. Real Subhadra copy is
// seeded separately by `seedSubhadraWebsiteContent` below, invoked directly
// for this project (same reasoning as team/seed.js and faq/seed.js: one
// specific client's data doesn't belong in a fresh-install pipeline).
//
// Idempotency: every field write is an upsert keyed on slug. Re-running is a no-op.

const FIELD_DEFS = [
  { slug: 'about-eyebrow', name: 'About — eyebrow', input_type: 'textbox' },
  { slug: 'about-heading', name: 'About — heading', input_type: 'textbox' },
  { slug: 'about-paragraph', name: 'About — paragraph', input_type: 'textarea' },
  { slug: 'vision-heading', name: 'Vision — heading', input_type: 'textbox' },
  { slug: 'vision-paragraph-1', name: 'Vision — paragraph 1', input_type: 'textarea' },
  { slug: 'vision-paragraph-2', name: 'Vision — paragraph 2', input_type: 'textarea' },
  { slug: 'mission-heading', name: 'Mission — heading', input_type: 'textbox' },
  { slug: 'mission-paragraph-1', name: 'Mission — paragraph 1', input_type: 'textarea' },
  { slug: 'mission-paragraph-2', name: 'Mission — paragraph 2', input_type: 'textarea' },
  { slug: 'tagline-text', name: 'Tagline strip text', input_type: 'textbox' },
];

export async function seedWebsiteContentFields(prisma) {
  const type = await prisma.type.upsert({
    where: { slug: 'website-content' },
    create: { slug: 'website-content', name: 'Website Content', is_active: true },
    update: { name: 'Website Content', is_active: true },
  });

  const category = await prisma.category.upsert({
    where: { slug: 'website-content.general' },
    create: {
      slug: 'website-content.general',
      name: 'General',
      type_id: type.id,
      is_active: true,
    },
    update: { name: 'General', type_id: type.id, is_active: true },
  });

  for (let i = 0; i < FIELD_DEFS.length; i++) {
    const def = FIELD_DEFS[i];
    await prisma.settingField.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        field_name: def.name,
        input_type: def.input_type,
        type_id: type.id,
        category_id: category.id,
        sort: i,
      },
      update: {
        field_name: def.name,
        input_type: def.input_type,
        type_id: type.id,
        category_id: category.id,
        sort: i,
      },
    });
  }

  console.log(
    `website-content-fields.seed: registered ${FIELD_DEFS.length} SettingField rows under type "website-content"`
  );
}

// Real Subhadra Group copy (from after-delete-folder/about.html) — sets
// values on the field slugs seeded above. Invoked directly for this
// project, not wired into the generic pipeline (see file header).
const SUBHADRA_VALUES = {
  'about-eyebrow': 'Who we are',
  'about-heading': 'Engineering comfort, safety & automation since 1996',
  'about-paragraph':
    'Subhadra Group was founded in the year 1996 with the aim to provide all building related engineering products & services under one roof for residential, commercial buildings and industries.\n\nWe provide complete solutions home theaters, home automation, safety and security solutions, fire protection solutions for residential, commercial and industrial applications. With 30+ years of technical expertise in these fields, our team strives to give perfect-engineered solutions for every application. Our team has experience of executing projects with leading MNCs and international groups with quality execution and on time delivery.\n\nWe deal with world-class brands that are pioneers in their respective fields to give the best solution to our clients. We have dedicated service managers for each field of services that we provide to give 24x7 support for all our installations.',
  'vision-heading': 'The most trusted name in building engineering across Andhra Pradesh',
  'vision-paragraph-1':
    'To become the most trusted & complete solution provider for Electrical, Air Conditioning, Security & Safety, Automation and Entertainment systems — for homes, commercial buildings, industries & departments across entire Andhra Pradesh.',
  'vision-paragraph-2':
    'That means every new sector we enter — hospitality, healthcare, retail, education, industry — gets the same one-team accountability that built our reputation in Visakhapatnam, backed by brands and engineers our clients can rely on for decades, not just for the installation date.',
  'mission-heading': 'All building engineering, under one accountable roof',
  'mission-paragraph-1':
    'To provide all building-related engineering products & services under one roof for residential, commercial buildings and industries — with perfect-engineered solutions, quality execution and on-time delivery, every single time.',
  'mission-paragraph-2':
    'We do this by employing and training our own engineers rather than sub-contracting, by dealing only in world-class pioneer brands, and by assigning a dedicated service manager to every discipline we install — so support never falls through the cracks.',
  'tagline-text': 'Your one-stop solution for building engineering products & services.',
};

export async function seedSubhadraWebsiteContent(prisma) {
  for (const [slug, value] of Object.entries(SUBHADRA_VALUES)) {
    await prisma.settingField.updateMany({ where: { slug }, data: { value } });
  }
  console.log(
    `website-content-fields.seed: set real Subhadra values for ${Object.keys(SUBHADRA_VALUES).length} fields`
  );
}
