import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { IDENTITY_FIELDS } from '../identity/schema.js';
import { resolveAssetUrls } from '../identity/service.js';

// Per-page SEO and the site-wide defaults (T6.1). An empty or missing value means "use the default".

export const SEO_KEYS = ['title', 'description', 'og_image', 'canonical', 'noindex'];
export const SEO_TITLE_MAX = 120;
export const SEO_DESCRIPTION_MAX = 300;

const canonical = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), { message: 'Must be empty or an http(s) URL' });

export const seoSchema = z
  .object({
    title: z.string().trim().max(SEO_TITLE_MAX),
    description: z.string().trim().max(SEO_DESCRIPTION_MAX),
    og_image: IDENTITY_FIELDS.logo_light, // same rules as identity images
    canonical,
    noindex: z.boolean(),
  })
  .partial()
  .strict();

/** Only whitelisted keys with a value survive; noindex only when true. Null when nothing is left. */
export function cleanSeo(raw) {
  const out = {};
  for (const key of SEO_KEYS) {
    const v = raw?.[key];
    if (key === 'noindex') {
      if (v === true) out.noindex = true;
    } else if (typeof v === 'string' && v.trim() !== '') out[key] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

// ── Global defaults (app_settings) ───────────────────────────────────────────

const DEFAULT_KEYS = { title_template: 'seo.title_template', default_og_image: 'seo.default_og_image' };

export const seoDefaultsSchema = z
  .object({
    // "%s" is replaced with the page title, e.g. "%s | Acme". Empty = no template.
    title_template: z
      .string()
      .trim()
      .max(100)
      .refine((v) => v === '' || v.includes('%s'), { message: 'Must contain %s (the page title)' }),
    default_og_image: IDENTITY_FIELDS.logo_light,
  })
  .partial()
  .strict();

/** Stored defaults as-is (storage path for the image); '' when unset. */
export async function getSeoDefaults() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: Object.values(DEFAULT_KEYS) } } });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.entries(DEFAULT_KEYS).map(([name, key]) => [name, byKey[key] ?? '']));
}

export async function saveSeoDefaults(patch) {
  await prisma.$transaction(
    Object.entries(patch).map(([name, value]) =>
      prisma.appSetting.upsert({
        where: { key: DEFAULT_KEYS[name] },
        update: { value },
        create: {
          key: DEFAULT_KEYS[name],
          value,
          type: 'string',
          description: `SEO default: ${name}`,
          is_public: false,
        },
      })
    )
  );
  return getSeoDefaults();
}

/**
 * What a public page needs to build its <head>: the page's own SEO plus the defaults, with image
 * paths resolved to fresh URLs. Either part is null when empty.
 */
export async function getPublicSeo(pageSeo) {
  const own = cleanSeo(pageSeo);
  const defaults = await getSeoDefaults();
  const resolved = await resolveAssetUrls({
    logo_light: own?.og_image ?? '',
    favicon: defaults.default_og_image,
  });
  return {
    seo: own && { ...own, ...(own.og_image ? { og_image: resolved.logo_light } : {}) },
    seoDefaults:
      defaults.title_template || defaults.default_og_image
        ? { title_template: defaults.title_template, og_image: resolved.favicon }
        : null,
  };
}
