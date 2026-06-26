// Slug generation for Application Settings entities (Types, Categories).
// The slug is a stable, URL-safe, lowercase identifier derived from the name.

const MAX_SLUG_ATTEMPTS = 1000; // non-negotiable rule: every loop has a hard cap

/**
 * Convert an arbitrary string to a URL-safe slug.
 * "New Clients" -> "new-clients"
 */
export const slugify = (input) =>
  String(input ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens

/**
 * Generate a slug from `name` that is unique within the given Prisma model.
 * On collision, appends `-2`, `-3`, ... `excludeId` is ignored during the
 * uniqueness check (used on update so a record does not collide with itself).
 *
 * @param {{ findFirst: Function }} model - a Prisma model delegate (e.g. prisma.type)
 */
export const uniqueSlug = async (model, name, excludeId = null) => {
  const base = slugify(name) || 'item';
  let candidate = base;

  for (let n = 2; n <= MAX_SLUG_ATTEMPTS + 1; n += 1) {
    const existing = await model.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${n}`;
  }

  throw new Error(`Could not generate a unique slug for "${name}" after ${MAX_SLUG_ATTEMPTS} attempts`);
};
