import { z } from 'zod';

// Single source of truth for identity fields. Anything not listed here is never
// stored or returned by this module (the public whitelist is this object).
const text = (max) => z.string().trim().max(max);
const url = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^\/(?![/\\])[^\s\\]*$/.test(v) || /^https?:\/\/\S+$/i.test(v), {
    message: 'Must be empty, a /path, or an http(s) URL',
  });
// Logos/favicon: a storage object path (preferred — resolved to a fresh presigned URL at
// read time, because presigned URLs expire after 7 days), a /path, or an http(s) URL.
const STORAGE_PATH = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9/_.-]*$/;
const asset = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || STORAGE_PATH.test(v) || /^\/(?![/\\])[^\s\\]*$/.test(v) || /^https?:\/\/\S+$/i.test(v), {
    message: 'Must be empty, a storage path, a /path, or an http(s) URL',
  });
const hex = z
  .string()
  .trim()
  .refine((v) => v === '' || /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v), { message: 'Must be empty or a hex color' });

export const IDENTITY_FIELDS = {
  app_name: text(100),
  app_title: text(150),
  description: text(500),
  logo_light: asset,
  logo_dark: asset,
  favicon: asset,
  brand_primary: hex,
  brand_secondary: hex,
  contact_email: z.string().trim().max(150).refine((v) => v === '' || z.string().email().safeParse(v).success, {
    message: 'Must be empty or a valid email',
  }),
  contact_phone: text(30),
  contact_address: text(300),
  copyright: text(200),
  social_facebook: url,
  social_x: url,
  social_instagram: url,
  social_linkedin: url,
  social_youtube: url,
};

export const ASSET_KEYS = ['logo_light', 'logo_dark', 'favicon'];
export const IDENTITY_KEYS = Object.keys(IDENTITY_FIELDS);
export const KEY_PREFIX = 'identity.';

export const updateIdentitySchema = z.object({
  body: z.object(IDENTITY_FIELDS).partial().strict(),
});
