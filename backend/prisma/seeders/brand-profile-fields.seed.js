// Brand Profile fields seed — KDL-558 roadmap row 1.
//
// Creates the Type, Category, and SettingField rows for the prototype's
// "Logo & Contact Details" screen as STANDALONE fields (owner_module: null) —
// visible and editable through the normal admin UI, same as the existing
// "Theme Settings" > "Site Details" > Logo/Site Name example rows at
// /admin/settings/fields. This is deliberately NOT owner_module-scoped
// (unlike brand-kit.seed.js's token fields) — the user wants these managed
// through Application Settings directly, not hidden as an internal store.
//
// Idempotency: every write is an upsert keyed on slug. Re-running is a no-op.

const FIELD_DEFS = [
  { slug: 'brand-profile-logo',            name: 'Logo file',        input_type: 'file' },
  { slug: 'brand-profile-company-name',    name: 'Company name',     input_type: 'textbox' },
  { slug: 'brand-profile-primary-email',   name: 'Primary email',    input_type: 'textbox' },
  { slug: 'brand-profile-secondary-email', name: 'Secondary email',  input_type: 'textbox' },
  { slug: 'brand-profile-primary-phone',   name: 'Primary phone',    input_type: 'textbox' },
  { slug: 'brand-profile-secondary-phone', name: 'Secondary phone',  input_type: 'textbox' },
  { slug: 'brand-profile-address-1',       name: 'Address 1',        input_type: 'textbox' },
  { slug: 'brand-profile-address-2',       name: 'Address 2',        input_type: 'textbox' },
];

export async function seedBrandProfileFields(prisma) {
  // 1. Upsert the standalone Type
  const type = await prisma.type.upsert({
    where: { slug: 'brand-profile' },
    create: { slug: 'brand-profile', name: 'Brand Profile', is_active: true },
    update: { name: 'Brand Profile', is_active: true },
  });

  // 2. Upsert the grouping Category
  const category = await prisma.category.upsert({
    where: { slug: 'brand-profile.logo-contact' },
    create: {
      slug: 'brand-profile.logo-contact',
      name: 'Logo & Contact Details',
      type_id: type.id,
      is_active: true,
    },
    update: { name: 'Logo & Contact Details', type_id: type.id, is_active: true },
  });

  // 3. Upsert all field rows — "if already created, use it; if not, create it".
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
    `brand-profile-fields.seed: registered ${FIELD_DEFS.length} SettingField rows under type "brand-profile"`,
  );
}
