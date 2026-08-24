import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { PLAT_TABS, PLATFORMS, slug as slugify } from './schema/index.js';

const TOKEN_TTL = 600; // seconds
const tokenKey = (platform, theme, device) => `th:tokens:${platform}:${theme ?? 'all'}:${device ?? 'all'}`;

// ── Value validation ──────────────────────────────────────────────────────────

function parseOptions(field) {
  if (!field.options) return null;
  try { return JSON.parse(field.options); } catch { return null; }
}

// Font Family selects (Heading/Body/Navigation/Button Font) are seeded from a
// static choice list but must also accept names from the sibling "Custom Fonts"
// repeater field saved in the same request — mirrors the frontend's merge in
// theme-engine/page.tsx (isFontFamilySelect / customFontNames).
const isFontFamilySelect = (field) => field.input_type === 'select' && /font/i.test(field.field_name ?? '');

function parseCustomFontNames(value) {
  try {
    const rows = JSON.parse(value || '[]');
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => (typeof r?.name === 'string' ? r.name.trim() : '')).filter(Boolean);
  } catch {
    return [];
  }
}

export function validateFieldValue(field, value, customFontNames = []) {
  const opts = parseOptions(field);
  switch (field.input_type) {
    case 'color': {
      // Hex: 3/4 (short), 6 or 8 digits — never 5 or 7. rgb()/rgba() validated in full.
      const hexOk = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
      const rgbOk = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|[01]?\.\d+)\s*)?\)$/.test(value);
      if (!hexOk && !rgbOk) return 'invalid color value';
      break;
    }
    case 'number': {
      if (value === '' || Number.isNaN(Number(value))) return 'value must be a number';
      break;
    }
    case 'slider': {
      const n = Number(value);
      if (value === '' || Number.isNaN(n)) return 'value must be a number';
      if (opts?.min != null && n < opts.min) return `value must be >= ${opts.min}`;
      if (opts?.max != null && n > opts.max) return `value must be <= ${opts.max}`;
      break;
    }
    case 'select': {
      const choices = isFontFamilySelect(field) ? [...(opts?.choices ?? []), ...customFontNames] : opts?.choices;
      if (!choices?.includes(value)) return `value must be one of: ${choices?.join(', ')}`;
      break;
    }
    case 'radio': {
      if (!opts?.choices?.includes(value)) return `value must be one of: ${opts?.choices?.join(', ')}`;
      break;
    }
    case 'toggle': {
      if (value !== 'true' && value !== 'false') return 'value must be "true" or "false"';
      break;
    }
    case 'multiselect': {
      try {
        const arr = JSON.parse(value);
        if (!Array.isArray(arr)) return 'multiselect value must be a JSON array';
        if (opts?.choices) {
          for (const item of arr)
            if (!opts.choices.includes(item)) return `invalid choice: ${item}`;
        }
      } catch { return 'multiselect value must be valid JSON array'; }
      break;
    }
    case 'text': {
      if (typeof value !== 'string' || value.length > 500) return 'text value must be a string ≤ 500 characters';
      break;
    }
    case 'textarea': {
      if (typeof value !== 'string' || value.length > 10000) return 'textarea value must be a string ≤ 10,000 characters';
      break;
    }
    case 'password': {
      if (typeof value !== 'string' || value.length > 500) return 'password value must be a string ≤ 500 characters';
      break;
    }
    case 'file': {
      if (typeof value !== 'string' || value.length > 2000) return 'file value must be a string ≤ 2,000 characters';
      break;
    }
    case 'fonts': {
      try {
        const arr = JSON.parse(value);
        if (!Array.isArray(arr)) return 'fonts value must be a JSON array';
        for (const fd of arr) {
          if (!fd || typeof fd !== 'object') return 'each font entry must be an object';
          if (fd.name !== undefined && (typeof fd.name !== 'string' || fd.name.length > 200))
            return 'font name must be a string ≤ 200 characters';
          if (fd.src !== undefined) {
            if (typeof fd.src !== 'string' || fd.src.length > 2000) return 'font src must be a string ≤ 2,000 characters';
            // Only allow https: or relative paths (no javascript:, data:, etc.)
            if (/^[a-z][a-z0-9+.-]*:/i.test(fd.src) && !/^https:/i.test(fd.src))
              return 'font src must use https:// or be a relative path';
          }
        }
      } catch { return 'fonts value must be valid JSON'; }
      break;
    }
    case 'imglist': {
      try {
        const arr = JSON.parse(value);
        if (!Array.isArray(arr)) return 'imglist value must be a JSON array';
        for (const item of arr) {
          if (!item || typeof item !== 'object') return 'each imglist entry must be an object';
          if (item.name !== undefined && (typeof item.name !== 'string' || item.name.length > 200))
            return 'imglist name must be a string ≤ 200 characters';
          if (item.w !== undefined && (typeof item.w !== 'number' || item.w < 0 || item.w > 10000))
            return 'imglist w must be a number in [0, 10000]';
          if (item.h !== undefined && (typeof item.h !== 'number' || item.h < 0 || item.h > 10000))
            return 'imglist h must be a number in [0, 10000]';
        }
      } catch { return 'imglist value must be valid JSON'; }
      break;
    }
    default: break;
  }
  return null;
}

// ── Schema tree (GET /schema) ─────────────────────────────────────────────────

export async function getSchemaTree(platform) {
  const panes = PLAT_TABS[platform];
  if (!panes) return null;

  // Load all types+categories+fields for this platform in 3 queries.
  const types = await prisma.type.findMany({
    where: { slug: { startsWith: `${platform}.` }, is_active: true },
    select: { id: true, name: true, slug: true },
  });

  const typeIds = types.map((t) => t.id);
  const categories = await prisma.category.findMany({
    where: { type_id: { in: typeIds }, is_active: true },
    select: { id: true, name: true, slug: true, type_id: true },
    orderBy: { slug: 'asc' },
  });

  const fields = await prisma.settingField.findMany({
    where: { type_id: { in: typeIds } },
    select: {
      id: true, field_name: true, slug: true, input_type: true,
      value: true, alt_text: true, options: true, sort: true,
      type_id: true, category_id: true,
      setting_values: { select: { value: true }, take: 1 },
    },
    orderBy: { sort: 'asc' },
  });

  // Build lookup maps
  const typeBySlug = new Map(types.map((t) => [t.slug, t]));
  const catsByTypeId = new Map();
  for (const c of categories) {
    if (!catsByTypeId.has(c.type_id)) catsByTypeId.set(c.type_id, []);
    catsByTypeId.get(c.type_id).push(c);
  }
  const fieldsByCatId = new Map();
  const fieldsWithoutCat = new Map(); // type_id → fields
  for (const f of fields) {
    const effective = f.setting_values?.[0]?.value ?? f.value;
    const field = { ...f, effective_value: effective, setting_values: undefined };
    if (f.category_id) {
      if (!fieldsByCatId.has(f.category_id)) fieldsByCatId.set(f.category_id, []);
      fieldsByCatId.get(f.category_id).push(field);
    } else {
      if (!fieldsWithoutCat.has(f.type_id)) fieldsWithoutCat.set(f.type_id, []);
      fieldsWithoutCat.get(f.type_id).push(field);
    }
  }

  // Assemble tree following PLAT_TABS order
  return panes.map((pane) => {
    const typeSlug = `${platform}.${pane.id}`;
    const type = typeBySlug.get(typeSlug);
    if (!type) return { id: pane.id, label: pane.label, icon: pane.icon, groups: [] };
    const cats = catsByTypeId.get(type.id) ?? [];
    // Groups follow the authored prototype section order, not slug order.
    const authoredOrder = new Map(
      (pane.sections ?? []).map(([sec, , tag], i) => [`${typeSlug}.${slugify(sec)}${tag ? `.${tag}` : ''}`, i])
    );
    cats.sort((a, b) => (authoredOrder.get(a.slug) ?? Infinity) - (authoredOrder.get(b.slug) ?? Infinity));
    const groups = cats.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      fields: (fieldsByCatId.get(cat.id) ?? []).map((f) => ({
        id: f.id,
        slug: f.slug,
        field_name: f.field_name,
        input_type: f.input_type,
        value: f.effective_value,
        default_value: f.value,
        alt_text: f.alt_text,
        options: f.options,
        sort: f.sort,
      })),
    }));
    return {
      id: pane.id,
      type_id: type.id,
      label: pane.label,
      icon: pane.icon,
      modes: pane.modes,
      devices: pane.devices,
      groups,
    };
  });
}

// ── Values for one pane (GET /values) ────────────────────────────────────────

export async function getValues(platform, typeId) {
  // Same ownership guard as /values and /reset — no cross-platform reads.
  const type = await prisma.type.findUnique({ where: { id: typeId }, select: { slug: true } });
  if (!type || !type.slug.startsWith(`${platform}.`)) {
    return { errors: [`type_id does not belong to platform "${platform}"`] };
  }

  const fields = await prisma.settingField.findMany({
    where: { type_id: typeId },
    select: {
      id: true, slug: true, value: true,
      setting_values: { select: { value: true }, take: 1 },
    },
    orderBy: { sort: 'asc' },
  });
  const result = {};
  for (const f of fields) {
    result[f.slug] = f.setting_values?.[0]?.value ?? f.value ?? null;
  }
  return result;
}

// ── Upsert values (POST /values) ─────────────────────────────────────────────

// opts.lockedByModule: when set (e.g. 'template-engine'), the caller is the owning
// module itself — skip the user-facing lock check and re-acquire locks on written fields.
export async function upsertValues(platform, typeId, values, actorId, { lockedByModule = null } = {}) {
  // Guard against cross-platform writes
  const type = await prisma.type.findUnique({ where: { id: typeId }, select: { slug: true } });
  if (!type || !type.slug.startsWith(`${platform}.`)) {
    return { errors: [`type_id does not belong to platform "${platform}"`] };
  }

  // Load all fields for the pane
  const fields = await prisma.settingField.findMany({
    where: { type_id: typeId },
    select: { id: true, slug: true, field_name: true, input_type: true, options: true, locked_by: true },
  });
  const byId = new Map(fields.map((f) => [f.id, f]));
  const bySlug = new Map(fields.map((f) => [f.slug, f]));

  // Lock guard: block user writes when a non-terminal template-engine run holds the field.
  // When lockedByModule is set the caller IS the owning module — bypass the check.
  if (!lockedByModule) {
    const lockedFields = fields.filter((f) => f.locked_by);
    if (lockedFields.length > 0) {
      const activeRun = await prisma.templateEngineRun.findFirst({
        where: { status: { in: ['IN_PROGRESS', 'AWAITING_APPROVAL'] } },
        select: { id: true },
      });
      if (activeRun) {
        const lockedByName = lockedFields[0].locked_by;
        const err = new Error(`Settings are read-only: locked by module "${lockedByName}"`);
        err.status = 409;
        throw err;
      }
    }
  }

  // The whole pane's fields (including "Custom Fonts") save in one request —
  // pull any custom font names out of this same batch so Font Family selects
  // can validate against them (see isFontFamilySelect).
  const customFontNames = values.flatMap((entry) => {
    const field = entry.field_id ? byId.get(entry.field_id) : bySlug.get(entry.slug);
    return field?.input_type === 'fonts' ? parseCustomFontNames(entry.value) : [];
  });

  const errors = [];
  const upserts = [];

  for (const entry of values) {
    const field = entry.field_id ? byId.get(entry.field_id) : bySlug.get(entry.slug);
    if (!field) {
      errors.push(`Unknown field: ${entry.field_id ?? entry.slug}`);
      continue;
    }
    const valError = validateFieldValue(field, entry.value, customFontNames);
    if (valError) {
      errors.push(`${field.slug}: ${valError}`);
      continue;
    }
    upserts.push({ field_id: field.id, platform, value: entry.value, updated_by: actorId ?? null });
  }

  if (errors.length) return { errors };

  await prisma.$transaction(
    upserts.map((u) =>
      prisma.settingValue.upsert({
        where: { field_id: u.field_id },
        create: u,
        update: { value: u.value, updated_by: u.updated_by },
      })
    )
  );

  // When called by the owning module, re-acquire locks on the fields it just wrote.
  if (lockedByModule && upserts.length > 0) {
    const writtenIds = upserts.map((u) => u.field_id);
    await prisma.settingField.updateMany({
      where: { id: { in: writtenIds } },
      data: { locked_by: lockedByModule },
    });
  }

  await invalidateTokenCache(platform);
  return { saved: upserts.length };
}

// ── Reset pane to defaults (POST /reset) ─────────────────────────────────────

export async function resetValues(platform, typeId) {
  // Guard against cross-platform writes
  const type = await prisma.type.findUnique({ where: { id: typeId }, select: { slug: true } });
  if (!type || !type.slug.startsWith(`${platform}.`)) {
    return { errors: [`type_id does not belong to platform "${platform}"`] };
  }

  const fields = await prisma.settingField.findMany({
    where: { type_id: typeId },
    select: { id: true },
  });
  const fieldIds = fields.map((f) => f.id);
  const { count } = await prisma.settingValue.deleteMany({
    where: { field_id: { in: fieldIds } },
  });
  await invalidateTokenCache(platform);
  return { deleted: count };
}

// ── Force-release locks (POST /locks/release) ────────────────────────────────

// Lets a human take back control of theme-engine fields when a template-engine
// run is stuck or was never cleaned up.  Filters by platform (via type slug
// prefix) or by a single type_id; defaults to all template-engine locks.
export async function releaseLocks({ platform, type_id } = {}, actorId) {
  const where = { locked_by: 'template-engine' };

  if (type_id) {
    // Field-level filter: fields whose type_id matches
    where.type_id = type_id;
  } else if (platform) {
    // Platform-level filter: only fields whose owning type slug starts with <platform>.
    where.type = { slug: { startsWith: `${platform}.` } };
  }

  const { count } = await prisma.settingField.updateMany({
    where,
    data: { locked_by: null },
  });
  return { released: count };
}

// ── Token cache invalidation ──────────────────────────────────────────────────

async function invalidateTokenCache(platform) {
  const themes = ['dark', 'light', 'focus', 'all'];
  const plat = PLATFORMS.find((p) => p.id === platform);
  const devices = plat ? [...plat.devices.map((d) => d.id), 'all'] : ['all'];
  const keys = themes.flatMap((t) => devices.map((d) => tokenKey(platform, t, d)));
  await Promise.allSettled(keys.map((k) => redis.del(k)));
}

// ── CSS-safe serialization helpers ───────────────────────────────────────────

// Strip characters that can break out of a CSS custom-property value context.
// Removes control chars, null bytes, and the CSS structural chars ; { }
// that would let injected DB values escape the declaration or block.
function sanitizeCssValue(v) {
  return v
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') // control chars (keep \t \n \r as harmless)
    .replace(/[;{}]/g, '')                               // CSS structural chars
    .replace(/\/\*/g, '')                                // open block comment
    .trim();
}

// Only https: and relative (no-scheme) font URLs are allowed.
function isSafeFontUrl(src) {
  if (!src) return false;
  if (/^https:/i.test(src)) return true;
  // Allow protocol-relative //example.com or relative paths, reject everything else with a scheme
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return false;
  return true;
}

// ── Token compilation (GET /tokens) ──────────────────────────────────────────

function toTokenName(parts) {
  return parts.map((s) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()).join('_');
}

// ── Device → viewport mapping (KDL-209) ──────────────────────────────────────
// Base authoring tags map to the breakpoint bands implied by the schema's
// device tabs. Platform device ids resolve their band via their `from` tag,
// plus an orientation clause when the id carries an _h/_v suffix. TV
// resolutions key off physical panel width instead.
const BASE_TAG_MEDIA = {
  desktop: '(min-width: 1280px)',
  laptop: '(min-width: 1024px) and (max-width: 1279px)',
  ipad: '(min-width: 768px) and (max-width: 1023px)',
  mobile: '(max-width: 767px)',
};
const TV_DEVICE_MEDIA = {
  tv_720p: '(max-width: 1919px)',
  tv_1080p: '(min-width: 1920px) and (max-width: 3839px)',
  tv_4k: '(min-width: 3840px) and (max-width: 7679px)',
  tv_8k: '(min-width: 7680px)',
};

export function deviceMediaQuery(plat, deviceId) {
  if (TV_DEVICE_MEDIA[deviceId]) return TV_DEVICE_MEDIA[deviceId];
  const def = plat?.devices?.find((d) => d.id === deviceId);
  const base = BASE_TAG_MEDIA[def?.from ?? deviceId];
  if (!base) return null;
  if (deviceId.endsWith('_h')) return `${base} and (orientation: landscape)`;
  if (deviceId.endsWith('_v')) return `${base} and (orientation: portrait)`;
  return base;
}

export async function compileTokens(platform, theme, device) {
  const cacheKey = tokenKey(platform, theme, device);

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* cache unavailable — recompute */ }

  // Load all fields for the platform with their effective values
  const types = await prisma.type.findMany({
    where: { slug: { startsWith: `${platform}.` }, is_active: true },
    select: { id: true, slug: true, name: true },
  });
  const typeIds = types.map((t) => t.id);

  const fields = await prisma.settingField.findMany({
    where: { type_id: { in: typeIds } },
    select: {
      id: true, slug: true, field_name: true, input_type: true,
      value: true, options: true, type_id: true, category_id: true,
      setting_values: { select: { value: true }, take: 1 },
    },
    orderBy: { sort: 'asc' },
  });

  const typeById = new Map(types.map((t) => [t.id, t]));

  // Real device ids for this platform — same source as invalidateTokenCache.
  // A field is device-tagged only when its 3rd slug segment is one of these.
  const plat = PLATFORMS.find((p) => p.id === platform);
  const deviceIds = new Set(plat ? plat.devices.map((d) => d.id) : []);

  const THEMES = new Set(['dark', 'light', 'focus']);

  // Spec contract (ARCH §Token resolution): var names are theme-NEUTRAL; dark
  // (the default theme) + untagged fields live in :root and the other themes
  // land in [data-theme="…"] override blocks. The JSON tree mirrors :root —
  // pane → group → field. Clients wanting another theme's JSON pass ?theme=.
  const rootVars = {};
  const themeVars = { light: {}, focus: {} };
  const fontFaces = [];
  const imgClasses = {};
  const jsonTree = {};

  // Device-scoped output (KDL-209): device-tagged fields ALSO emit a
  // device-NEUTRAL alias var (device segment stripped, units applied) so the
  // frontend codes against one stable name and the @media query picks the
  // value per viewport. Raw device-prefixed vars stay in :root unchanged —
  // existing consumers use them with calc(var(...) * 1px).
  const deviceVars = {}; // deviceId → { '--neutral_name': value }
  const deviceImgClasses = {}; // deviceId → { cls: rules }

  for (const f of fields) {
    const effectiveValue = f.setting_values?.[0]?.value ?? f.value;
    if (effectiveValue == null) continue;

    // Never compile secrets into the public token payload.
    if (f.input_type === 'password') continue;

    // Slug shape: {platform}.{pane}.[{tag}.]{section}.{field} where tag is a
    // theme or a device id. Token names strip the platform AND the theme tag.
    const slugParts = f.slug.split('.');

    // Single-segment slugs (e.g. brand-kit-primary-50) are pre-namespaced and
    // do not follow the platform.pane.section.field dot-convention. Without this
    // guard, neutralParts would be [] → tokenName '' → CSS emits the junk '--'
    // key and paneKey is undefined in the JSON tree.
    if (slugParts.length === 1) {
      rootVars[`--${f.slug}`] = sanitizeCssValue(effectiveValue);
      if (!jsonTree['brand-kit']) jsonTree['brand-kit'] = {};
      if (!jsonTree['brand-kit']['brand-kit']) jsonTree['brand-kit']['brand-kit'] = {};
      jsonTree['brand-kit']['brand-kit'][f.slug] = effectiveValue;
      continue;
    }

    const tagSegment = slugParts[2];
    const themeTag = THEMES.has(tagSegment) ? tagSegment : null;
    const deviceTag = deviceIds.has(tagSegment) ? tagSegment : null;

    // Filter by theme if requested.
    if (theme && themeTag && themeTag !== theme) continue;

    // Filter by device if requested. Only drop a field when its tag is a REAL
    // device id that differs from the requested device. Untagged fields
    // (3rd segment = section slug) are always kept.
    if (device && deviceTag && deviceTag !== device) continue;

    const neutralParts = themeTag
      ? [slugParts[1], ...slugParts.slice(3)] // pane + section + field (theme stripped)
      : slugParts.slice(1); // pane [+ device] + section + field
    const tokenName = toTokenName(neutralParts);

    // Device-neutral alias name (pane + section + field, device stripped) and
    // the bucket it lands in: a ?device= request already narrowed the payload
    // to one device → alias goes straight to :root; otherwise it goes into
    // that device's @media block.
    const deviceAliasName = deviceTag
      ? toTokenName([slugParts[1], ...slugParts.slice(3)])
      : null;
    const deviceBucket = deviceTag
      ? (device ? rootVars : (deviceVars[deviceTag] ??= {}))
      : null;

    // Handle special field types
    if (f.input_type === 'fonts') {
      try {
        const fontDefs = JSON.parse(effectiveValue);
        if (Array.isArray(fontDefs)) {
          for (const fd of fontDefs) {
            if (!fd.src || !isSafeFontUrl(fd.src)) continue; // M12: allowlist https: only
            // Escape single-quote in URLs/names to prevent CSS string injection.
            const safeSrc = fd.src.replace(/'/g, '%27');
            if (fd.type === 'google') {
              fontFaces.push(`@import url('${safeSrc}');`);
            } else {
              const safeName = (fd.name || '').replace(/'/g, '').replace(/[^a-zA-Z0-9 _-]/g, '');
              fontFaces.push(`@font-face { font-family: '${safeName}'; src: url('${safeSrc}'); }`);
            }
          }
        }
      } catch { /* skip malformed */ }
      continue;
    }

    if (f.input_type === 'imglist') {
      try {
        const items = JSON.parse(effectiveValue);
        if (Array.isArray(items)) {
          // Device-tagged image lists share class names across devices; the
          // flat map made the last-processed device win everywhere. Scope
          // them per device instead (KDL-209).
          const clsBucket = deviceTag && !device
            ? (deviceImgClasses[deviceTag] ??= {})
            : imgClasses;
          const dim = (v) => (v === 'auto' ? 'auto' : `${v}px`);
          for (const item of items) {
            const cls = slugify(item.name || tokenName);
            clsBucket[cls] = `width: ${dim(item.w)}; height: ${dim(item.h)}; object-fit: ${item.fit || 'cover'};`;
          }
        }
      } catch { /* skip malformed */ }
      continue;
    }

    if (f.input_type === 'typo_table') {
      try {
        const rows = JSON.parse(effectiveValue);
        if (Array.isArray(rows)) {
          const bucket = !theme && themeTag && themeTag !== 'dark' ? themeVars[themeTag] : rootVars;
          const emitRow = (b, prefix, row, rowKey) => {
            b[`--${prefix}_${rowKey}_size`] = `${row.size}${row.sizeUnit || 'px'}`;
            b[`--${prefix}_${rowKey}_family`] = row.family;
            b[`--${prefix}_${rowKey}_weight`] = row.weight;
            b[`--${prefix}_${rowKey}_line_height`] = row.lineHeight;
            b[`--${prefix}_${rowKey}_letter_spacing`] = `${row.letterSpacing}px`;
          };
          for (const row of rows) {
            const rowKey = slugify(row.name || '');
            if (!rowKey) continue;
            emitRow(bucket, tokenName, row, rowKey);
            if (deviceBucket) emitRow(deviceBucket, deviceAliasName, row, rowKey);
          }
        }
      } catch { /* skip malformed */ }
      continue;
    }

    // CSS custom property. When a theme is requested, every surviving field is
    // that theme's value → :root. Unfiltered: dark+untagged → :root, other
    // themes → their [data-theme] override block.
    const cssBucket = !theme && themeTag && themeTag !== 'dark' ? themeVars[themeTag] : rootVars;
    // M12: sanitize value before embedding into CSS to prevent injection.
    cssBucket[`--${tokenName}`] = sanitizeCssValue(effectiveValue);

    // Device-neutral alias: unit-suffixed (from field options) so it is
    // directly usable in CSS without the calc(var(...) * 1px) dance that the
    // unitless raw vars require.
    if (deviceBucket) {
      let aliasValue = effectiveValue;
      if ((f.input_type === 'number' || f.input_type === 'slider')
          && effectiveValue !== '' && !Number.isNaN(Number(effectiveValue))) {
        const unit = parseOptions(f)?.unit;
        if (unit) aliasValue = `${effectiveValue}${unit}`;
      }
      deviceBucket[`--${deviceAliasName}`] = aliasValue;
    }

    // JSON tree: pane → group → field, mirroring :root (untagged + requested
    // theme, defaulting to dark). Group keeps the device tag — devices are
    // distinct tokens, themes are variants of the same token.
    if (cssBucket === rootVars) {
      const paneKey = neutralParts[0];
      const groupKey = neutralParts.slice(1, -1).join('_') || paneKey;
      const fieldKey = neutralParts[neutralParts.length - 1];
      if (!jsonTree[paneKey]) jsonTree[paneKey] = {};
      if (!jsonTree[paneKey][groupKey]) jsonTree[paneKey][groupKey] = {};
      jsonTree[paneKey][groupKey][fieldKey] = effectiveValue;
    }
  }

  // Build CSS output
  const varBlock = (vars) => Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n');
  const rootCss = varBlock(rootVars);
  const imgCss = Object.entries(imgClasses)
    .map(([cls, rules]) => `.${cls} { ${rules} }`)
    .join('\n');

  // One @media block per device (schema device order) holding that device's
  // neutral alias vars and image classes — mirrors the [data-theme] pattern.
  const deviceOrder = plat ? plat.devices.map((d) => d.id) : Object.keys(deviceVars);
  const deviceCss = deviceOrder.flatMap((d) => {
    const vars = deviceVars[d] && Object.keys(deviceVars[d]).length
      ? `:root {\n${varBlock(deviceVars[d])}\n}`
      : '';
    const imgs = deviceImgClasses[d]
      ? Object.entries(deviceImgClasses[d]).map(([cls, rules]) => `.${cls} { ${rules} }`).join('\n')
      : '';
    const body = [vars, imgs].filter(Boolean).join('\n');
    if (!body) return [];
    const mq = deviceMediaQuery(plat, d);
    return [mq ? `@media ${mq} {\n${body}\n}` : body];
  });

  const css = [
    ...fontFaces,
    rootCss ? `:root {\n${rootCss}\n}` : '',
    ...Object.entries(themeVars).map(([t, vars]) => {
      const block = varBlock(vars);
      return block ? `[data-theme="${t}"] {\n${block}\n}` : '';
    }),
    imgCss,
    ...deviceCss,
  ].filter(Boolean).join('\n\n');

  const activeTheme = await getActiveTheme(platform);
  const result = { css, json: jsonTree, activeTheme };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', TOKEN_TTL);
  } catch { /* cache write failure non-fatal */ }

  return result;
}

// ── Public flag check ─────────────────────────────────────────────────────────

export async function isTokensPublic() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'theme_engine.tokens_public' } });
  // Default true if not set
  return setting ? setting.value !== 'false' : true;
}

// ── Active/Default theme per platform (dark|light|system) ────────────────────
// Stored the same way as the tokens_public flag above: an AppSetting row, not a
// new Prisma column — the module already uses AppSetting as its own tiny KV
// store for cross-cutting flags, so a per-platform "current theme" fits the
// same shape instead of adding a migration.

export const ACTIVE_THEMES = ['dark', 'light', 'system'];
const activeThemeKey = (platform) => `theme_engine.active_theme.${platform}`;

export async function getActiveTheme(platform) {
  const setting = await prisma.appSetting.findUnique({ where: { key: activeThemeKey(platform) } });
  return setting && ACTIVE_THEMES.includes(setting.value) ? setting.value : 'system';
}

export async function setActiveTheme(platform, theme) {
  if (!ACTIVE_THEMES.includes(theme)) {
    return { errors: [`theme must be one of: ${ACTIVE_THEMES.join(', ')}`] };
  }
  await prisma.appSetting.upsert({
    where: { key: activeThemeKey(platform) },
    create: { key: activeThemeKey(platform), value: theme, type: 'string', is_public: true },
    update: { value: theme },
  });
  // The tokens payload embeds activeTheme (see compileTokens) so the public
  // runtime consumer can pick it up in the same request — stale cache would
  // serve the old choice until TTL expiry otherwise.
  await invalidateTokenCache(platform);
  return { activeTheme: theme };
}
