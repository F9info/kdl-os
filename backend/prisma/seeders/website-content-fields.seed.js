// Website Content fields seed.
//
// Generic Settings→Fields definitions for simple, non-relational website
// copy (Vision, Mission, About intro, tagline strip) — the "don't build a
// module for every small piece of text" half of the content-architecture
// split (Team/FAQ/Projects Content are dedicated modules; this is the
// generic-field half). Standalone fields (owner_module: null), editable
// through the generic setting-fields API/admin UI at
// /admin/settings/view/website-content, same mechanism as any other
// Application Settings Type.
//
// This function seeds FIELD DEFINITIONS ONLY (empty values) — safe for the
// generic, client-agnostic `prisma/seed.js` pipeline. Demo copy is
// seeded separately by `seedDemoWebsiteContent` below, invoked directly
// for the default project.
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

// Generic DemoLogo placeholder copy — sets values on the field slugs seeded
// above. Invoked directly for the default project, not wired into the generic
// pipeline (see file header).
const DEMO_VALUES = {
  'about-eyebrow': 'About us',
  'about-heading': 'We Are a Creative Digital Agency',
  'about-paragraph':
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'vision-heading': 'Our vision',
  'vision-paragraph-1':
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'vision-paragraph-2':
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'mission-heading': 'Our mission',
  'mission-paragraph-1':
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'mission-paragraph-2':
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'tagline-text': 'We Bring Your Ideas to Life.',
};

export async function seedDemoWebsiteContent(prisma) {
  for (const [slug, value] of Object.entries(DEMO_VALUES)) {
    await prisma.settingField.updateMany({ where: { slug }, data: { value } });
  }
  console.log(`website-content-fields.seed: set demo values for ${Object.keys(DEMO_VALUES).length} fields`);
}
