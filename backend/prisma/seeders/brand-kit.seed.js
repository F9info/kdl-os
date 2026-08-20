// Brand-kit theme-engine seed — KDL-515
//
// Creates the Type, Category, and SettingField rows that the D-BK-6
// tokens hand-off requires.  Without these rows:
//   • GET /api/brand-kit/:projectId/tokens  → 409 TYPE_NOT_SEEDED
//   • POST /api/theme-engine/values         → errors: ["Unknown field: …"]
//
// Scope decision (v1): webapp only.
// The tv/android/ios platforms each have an analogous token pipeline but their
// KDL-453 orchestrators have not shipped yet.  Rather than seed unreachable
// rows, v1 seeds webapp only.  The brand-kit service already returns
// TYPE_NOT_SEEDED for unsupported platforms — the 409 is an honest signal until
// those seeders ship.  Add a companion seedBrandKitPlatform(prisma, 'tv') call
// (etc.) in a follow-up when those orchestrators land.
//
// Idempotency: every write is an upsert keyed on slug.
// Re-running this seed is a no-op.
//
// Slug ownership: the SettingField slugs are short-form (e.g. brand-kit-primary-50)
// to match the values array emitted by brand-kit/tokens.js buildTokenPayload().
// These slugs do NOT follow the theme-engine's platform.pane.section.field dot-
// convention — compileTokens() will skip them because their effectiveValue is
// null until the D-BK-6 orchestrator writes real values.

// ─── Derived slug lists (mirrors tokens.js) ───────────────────────────────────
// Keep in sync with rampToValues() and buildTokenPayload() in brand-kit/tokens.js.
// If those functions ever rename slugs, update this list to match.

const ROLES = ['primary', 'secondary', 'accent', 'neutral'];
const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

function buildFieldDefs() {
  const fields = [];

  for (const role of ROLES) {
    // 10-step OKLCH colour ramp (brand-kit-{role}-{step})
    for (const step of RAMP_STEPS) {
      fields.push({ slug: `brand-kit-${role}-${step}`, name: `${capitalize(role)} ${step}`, input_type: 'color' });
    }
    // Text-on-brand contrast variant (brand-kit-{role}-text)
    fields.push({ slug: `brand-kit-${role}-text`, name: `${capitalize(role)} Text`, input_type: 'color' });
    // Source brand hex (brand-kit-{role}-hex)
    fields.push({ slug: `brand-kit-${role}-hex`, name: `${capitalize(role)} Hex`, input_type: 'color' });
  }

  // Typography hand-off slots (text — accepts any font name or ratio string)
  fields.push({ slug: 'brand-kit-font-heading',    name: 'Heading Font Family', input_type: 'text' });
  fields.push({ slug: 'brand-kit-font-body',        name: 'Body Font Family',    input_type: 'text' });
  fields.push({ slug: 'brand-kit-type-scale-ratio', name: 'Type Scale Ratio',    input_type: 'text' });

  return fields;
}

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

// ─── Public seeder ────────────────────────────────────────────────────────────

export async function seedBrandKit(prisma) {
  const OWNER_MODULE = 'brand-kit';

  // 1. Upsert the webapp.brand-kit Type
  const type = await prisma.type.upsert({
    where: { slug: 'webapp.brand-kit' },
    create: {
      slug: 'webapp.brand-kit',
      name: 'Brand Kit (Webapp)',
      is_active: true,
      owner_module: OWNER_MODULE,
    },
    update: {
      name: 'Brand Kit (Webapp)',
      is_active: true,
      owner_module: OWNER_MODULE,
    },
  });

  // 2. Upsert the grouping Category
  const category = await prisma.category.upsert({
    where: { slug: 'webapp.brand-kit.tokens' },
    create: {
      slug: 'webapp.brand-kit.tokens',
      name: 'Brand Kit Tokens',
      type_id: type.id,
      is_active: true,
      owner_module: OWNER_MODULE,
    },
    update: {
      name: 'Brand Kit Tokens',
      type_id: type.id,
      is_active: true,
      owner_module: OWNER_MODULE,
    },
  });

  // 3. Upsert all SettingField rows derived from buildTokenPayload() slug list
  const fieldDefs = buildFieldDefs();
  for (let i = 0; i < fieldDefs.length; i++) {
    const def = fieldDefs[i];
    await prisma.settingField.upsert({
      where: { slug: def.slug },
      create: {
        slug: def.slug,
        field_name: def.name,
        input_type: def.input_type,
        value: null,         // no default — values come from the D-BK-6 orchestrator
        type_id: type.id,
        category_id: category.id,
        sort: i,
        owner_module: OWNER_MODULE,
      },
      update: {
        field_name: def.name,
        input_type: def.input_type,
        type_id: type.id,
        category_id: category.id,
        sort: i,
        owner_module: OWNER_MODULE,
      },
    });
  }

  console.log(
    `brand-kit.seed: registered ${fieldDefs.length} SettingField rows under type "webapp.brand-kit"`,
  );
}
