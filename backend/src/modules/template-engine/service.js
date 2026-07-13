import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { PLAT_TABS, slug as slugify } from './schema/index.js';

const TOKEN_TTL = 600; // seconds
const tokenKey = (platform, theme, device) => `te:tokens:${platform}:${theme ?? 'all'}:${device ?? 'all'}`;

// ── Value validation ──────────────────────────────────────────────────────────

function parseOptions(field) {
  if (!field.options) return null;
  try { return JSON.parse(field.options); } catch { return null; }
}

export function validateFieldValue(field, value) {
  const opts = parseOptions(field);
  switch (field.input_type) {
    case 'color': {
      if (!/^#[0-9a-fA-F]{3,8}$/.test(value) && !/^rgba?\(\s*\d/.test(value))
        return 'invalid color value';
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
      if (!opts?.choices?.includes(value)) return `value must be one of: ${opts?.choices?.join(', ')}`;
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
    // text, textarea, password, file, fonts, imglist: accept any string
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
    const catBySlug = new Map(cats.map((c) => [c.slug, c]));
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

export async function upsertValues(platform, typeId, values, actorId) {
  // Guard against cross-platform writes
  const type = await prisma.type.findUnique({ where: { id: typeId }, select: { slug: true } });
  if (!type || !type.slug.startsWith(`${platform}.`)) {
    return { errors: [`type_id does not belong to platform "${platform}"`] };
  }

  // Load all fields for the pane
  const fields = await prisma.settingField.findMany({
    where: { type_id: typeId },
    select: { id: true, slug: true, input_type: true, options: true },
  });
  const byId = new Map(fields.map((f) => [f.id, f]));
  const bySlug = new Map(fields.map((f) => [f.slug, f]));

  const errors = [];
  const upserts = [];

  for (const entry of values) {
    const field = entry.field_id ? byId.get(entry.field_id) : bySlug.get(entry.slug);
    if (!field) {
      errors.push(`Unknown field: ${entry.field_id ?? entry.slug}`);
      continue;
    }
    const valError = validateFieldValue(field, entry.value);
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

// ── Token cache invalidation ──────────────────────────────────────────────────

async function invalidateTokenCache(platform) {
  const themes = ['dark', 'light', 'focus', 'all'];
  const devices = ['desktop', 'laptop', 'ipad', 'mobile', 'all'];
  const keys = themes.flatMap((t) => devices.map((d) => tokenKey(platform, t, d)));
  await Promise.allSettled(keys.map((k) => redis.del(k)));
}

// ── Token compilation (GET /tokens) ──────────────────────────────────────────

function toTokenName(parts) {
  return parts.map((s) => s.replace(/[^a-z0-9]/gi, '_').toLowerCase()).join('_');
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
      value: true, type_id: true, category_id: true,
      setting_values: { select: { value: true }, take: 1 },
    },
    orderBy: { sort: 'asc' },
  });

  const typeById = new Map(types.map((t) => [t.id, t]));

  const cssVars = {};
  const fontFaces = [];
  const imgClasses = {};
  const jsonTree = {};

  for (const f of fields) {
    const effectiveValue = f.setting_values?.[0]?.value ?? f.value;
    if (effectiveValue == null) continue;

    // Derive token name from slug: strip platform prefix, replace dots/non-alphanum with _
    const slugParts = f.slug.split('.');
    const tokenParts = slugParts.slice(1); // drop platform
    const tokenName = toTokenName(tokenParts);

    // Filter by theme if requested: slugs with dark/light/focus in 3rd segment
    if (theme) {
      const themeSegment = slugParts[2]; // e.g. "dark", "light", "focus"
      const isThemeTagged = ['dark', 'light', 'focus'].includes(themeSegment);
      if (isThemeTagged && themeSegment !== theme) continue;
    }

    // Filter by device if requested
    if (device) {
      const deviceSegment = slugParts[2];
      const isDeviceTagged = deviceSegment && !['dark', 'light', 'focus'].includes(deviceSegment) &&
        deviceSegment !== slugParts[1]; // not the pane
      if (isDeviceTagged && deviceSegment !== device) continue;
    }

    // Handle special field types
    if (f.input_type === 'fonts') {
      try {
        const fontDefs = JSON.parse(effectiveValue);
        if (Array.isArray(fontDefs)) {
          for (const fd of fontDefs) {
            if (fd.type === 'google' && fd.src) {
              fontFaces.push(`@import url('${fd.src}');`);
            } else if (fd.src) {
              fontFaces.push(`@font-face { font-family: '${fd.name}'; src: url('${fd.src}'); }`);
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
          for (const item of items) {
            const cls = slugify(item.name || tokenName);
            imgClasses[cls] = `width: ${item.w}px; height: ${item.h}px; object-fit: ${item.fit || 'cover'};`;
          }
        }
      } catch { /* skip malformed */ }
      continue;
    }

    // CSS custom property
    cssVars[`--${tokenName}`] = effectiveValue;

    // JSON tree: pane → group → field
    const paneKey = slugParts[1];
    const fieldKey = tokenParts.join('_');
    if (!jsonTree[paneKey]) jsonTree[paneKey] = {};
    jsonTree[paneKey][fieldKey] = effectiveValue;
  }

  // Build CSS output
  const rootVars = Object.entries(cssVars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  const imgCss = Object.entries(imgClasses)
    .map(([cls, rules]) => `.${cls} { ${rules} }`)
    .join('\n');

  const css = [
    ...fontFaces,
    rootVars ? `:root {\n${rootVars}\n}` : '',
    imgCss,
  ].filter(Boolean).join('\n\n');

  const result = { css, json: jsonTree };

  try {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', TOKEN_TTL);
  } catch { /* cache write failure non-fatal */ }

  return result;
}

// ── Public flag check ─────────────────────────────────────────────────────────

export async function isTokensPublic() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'template_engine.tokens_public' } });
  // Default true if not set
  return setting ? setting.value !== 'false' : true;
}
