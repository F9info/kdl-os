import { prisma } from '../../config/database.js';
import { cleanSeo } from './seo.js';
import { SEO_TITLE_HINT, SEO_DESCRIPTION_HINT } from './seo-limits.js';
import { getSectionSchemas } from '../../shared/section-schemas.js';

// Pre-publish checks (T6.4). Two severities:
//   error   = something is actually broken for visitors (empty page, image with no source, a link to
//             a page that does not exist, a form block pointing at a missing form). Blocks publishing
//             unless the author chooses "publish anyway".
//   warning = worth fixing but not broken (image without alt text, missing SEO description, anchors
//             that go nowhere, over-long SEO text). Never blocks.
// The editor shows both before publishing; the server enforces the errors.

// Header/footer blocks are managed on the Layout page, not part of the page's own content.
const LAYOUT_BLOCKS = new Set([
  'ConstructionTopBar',
  'ConstructionHeader',
  'NavBar',
  'MedicalTopNav',
  'ConstructionFooter',
  'Footer',
]);

// First path segments served by the app itself (module pages, auth, ...): not page keys.
const APP_ROUTES = new Set([
  'admin',
  'api',
  'login',
  'register',
  'share',
  'preview',
  'sectors',
  'work',
  'catalog',
]);

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i; // https:, mailto:, tel:, //host

const issue = (severity, code, message, block) => ({
  severity,
  code,
  message,
  block_id: block?.props?.id ?? null,
  block_type: block?.type ?? null,
});

const isLinkKey = (key) => /(^|[a-z])href$/i.test(key) || key === 'link' || key === 'url';

/** Every link target in a block's props: href-like props, and the target half of "Label|/target" lines in `...links`. */
export function linkTargets(props, out = []) {
  if (!props || typeof props !== 'object') return out;
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'string') {
      if (isLinkKey(key) && value.trim()) out.push(value.trim());
      else if (/links$/i.test(key)) {
        for (const line of value.split('\n')) {
          const target = line.includes('|') ? line.slice(line.lastIndexOf('|') + 1).trim() : '';
          if (target) out.push(target);
        }
      }
    } else if (Array.isArray(value)) {
      for (const item of value) linkTargets(item, out);
    } else if (value && typeof value === 'object') {
      linkTargets(value, out);
    }
  }
  return out;
}

const walk = (blocks, fn) => {
  for (const block of Array.isArray(blocks) ? blocks : []) {
    fn(block);
    // Puck nests blocks in slot props (arrays of blocks) and in `zones`.
    for (const value of Object.values(block?.props ?? {})) {
      if (
        Array.isArray(value) &&
        value.some((v) => v && typeof v === 'object' && 'type' in v && 'props' in v)
      )
        walk(value, fn);
    }
  }
};

const STRING_KINDS = new Set(['text', 'textarea', 'link', 'image', 'color']);

/**
 * Checks a block against its section schema (T7.1). An unknown block type renders nothing for
 * visitors (error). A select/toggle value outside the declared options, or a text-like field that
 * is not text, is almost certainly a mistake but still renders (warnings).
 */
export function schemaIssues(block, schemas) {
  if (!schemas) return [];
  const schema = schemas[block.type];
  if (!schema)
    return [
      issue(
        'error',
        'BLOCK_UNKNOWN',
        `The section "${block.type}" does not exist, so it will not show on the page.`,
        block
      ),
    ];
  const out = [];
  for (const [key, value] of Object.entries(block.props ?? {})) {
    const field = schema.fields[key];
    if (!field || value === undefined || value === null || value === '') continue;
    const where = `${schema.label ?? block.type} > ${key}`;
    if (
      (field.kind === 'select' || field.kind === 'toggle') &&
      field.options &&
      !field.options.includes(value)
    )
      out.push(
        issue(
          'warning',
          'FIELD_VALUE_INVALID',
          `${where}: "${String(value)}" is not one of the allowed choices.`,
          block
        )
      );
    else if (STRING_KINDS.has(field.kind) && typeof value !== 'string')
      out.push(issue('warning', 'FIELD_TYPE_INVALID', `${where} should be text.`, block));
    else if (field.kind === 'list' && !Array.isArray(value) && typeof value !== 'string')
      out.push(issue('warning', 'FIELD_TYPE_INVALID', `${where} should be a list.`, block));
  }
  return out;
}

/**
 * Pure. `page` = { title, data, seo }. `ctx`:
 *   pageSlugs  Set of slugs of published pages (plus this page's own)
 *   siteKeys   Set of clean URL keys ("about", "home") the website stage recorded
 *   formSlugs  Set of slugs of active forms
 *   schemas    section schemas ({ type: { fields } }) or null to skip the schema checks
 * Returns issues, errors first.
 */
export function validateContent(page, ctx) {
  const issues = [];
  const title = (page.title ?? '').trim();
  const content = (page.data?.content ?? []).filter((b) => !LAYOUT_BLOCKS.has(b.type));
  const seo = cleanSeo(page.seo) ?? {};

  if (!title) issues.push(issue('error', 'TITLE_MISSING', 'The page has no title.'));
  if (content.length === 0)
    issues.push(issue('error', 'PAGE_EMPTY', 'The page has no content yet. Add at least one section.'));

  // anchors a link can point at on this page
  const anchors = new Set();
  walk(content, (b) => {
    for (const key of ['anchor', 'id'])
      if (typeof b.props?.[key] === 'string' && b.props[key]) anchors.add(b.props[key]);
  });

  walk(content, (block) => {
    const props = block.props ?? {};
    issues.push(...schemaIssues(block, ctx.schemas));

    if (block.type === 'Image') {
      if (!String(props.src ?? '').trim())
        issues.push(issue('error', 'IMAGE_NO_SOURCE', 'An image has no picture set.', block));
      else if (!String(props.alt ?? '').trim())
        issues.push(
          issue(
            'warning',
            'IMAGE_NO_ALT',
            'An image has no alt text. Screen readers and search engines need it.',
            block
          )
        );
    }

    if (block.type === 'ContactForm') {
      const slug = String(props.formSlug ?? '').trim();
      if (!slug)
        issues.push(issue('error', 'FORM_NOT_SET', 'A contact form block has no form selected.', block));
      else if (!ctx.formSlugs.has(slug))
        issues.push(
          issue('error', 'FORM_MISSING', `The form "${slug}" does not exist or is switched off.`, block)
        );
    }

    for (const target of linkTargets(props)) {
      if (EXTERNAL.test(target)) continue;
      if (target.startsWith('#')) {
        const name = target.slice(1);
        if (name && !anchors.has(name))
          issues.push(
            issue(
              'warning',
              'ANCHOR_MISSING',
              `A link to "${target}" goes nowhere: nothing on this page has that anchor.`,
              block
            )
          );
        continue;
      }
      const path = target.split(/[?#]/)[0];
      const segments = path.split('/').filter(Boolean);
      if (segments.length === 0) continue; // "/" = home
      if (segments[0] === 'p' && segments.length === 2) {
        if (!ctx.pageSlugs.has(segments[1]))
          issues.push(
            issue(
              'error',
              'LINK_BROKEN',
              `A link to "${target}" points at a page that is not published.`,
              block
            )
          );
      } else if (
        segments.length === 1 &&
        !APP_ROUTES.has(segments[0]) &&
        !ctx.siteKeys.has(segments[0]) &&
        !ctx.pageSlugs.has(segments[0])
      ) {
        issues.push(
          issue('error', 'LINK_BROKEN', `A link to "${target}" points at a page that does not exist.`, block)
        );
      }
    }
  });

  // SEO: the effective title falls back to the page title, the description has no fallback.
  const seoTitle = seo.title || title;
  if (!seo.description)
    issues.push(
      issue(
        'warning',
        'SEO_DESCRIPTION_MISSING',
        'Add a meta description (SEO) so search results show a good summary.'
      )
    );
  else if (seo.description.length > SEO_DESCRIPTION_HINT)
    issues.push(
      issue(
        'warning',
        'SEO_DESCRIPTION_LONG',
        `The meta description is ${seo.description.length} characters; search engines show about ${SEO_DESCRIPTION_HINT}.`
      )
    );
  if (!seo.title)
    issues.push(issue('warning', 'SEO_TITLE_MISSING', 'No SEO title set. The page title is used instead.'));
  if (seoTitle.length > SEO_TITLE_HINT)
    issues.push(
      issue(
        'warning',
        'SEO_TITLE_LONG',
        `The SEO title is ${seoTitle.length} characters; search engines show about ${SEO_TITLE_HINT}.`
      )
    );

  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export const summarize = (issues) => {
  const errors = issues.filter((i) => i.severity === 'error').length;
  return { issues, errors, warnings: issues.length - errors, can_publish: errors === 0 };
};

/** Looks up what links and forms can point at, then validates. `projectId` scopes the lookups. */
export async function validatePage(page) {
  const projectId = page.project_id ?? null;
  const [pages, stages, forms] = await Promise.all([
    prisma.builderPage.findMany({
      where: { status: 'PUBLISHED', deleted_at: null, ...(projectId ? { project_id: projectId } : {}) },
      select: { slug: true },
    }),
    projectId
      ? prisma.templateEngineStage.findMany({
          where: { stage: 'WEBSITE', run: { projectId } },
          orderBy: { run: { createdAt: 'desc' } },
          take: 1,
        })
      : [],
    prisma.form.findMany({
      where: { is_active: true, deleted_at: null, ...(projectId ? { project_id: projectId } : {}) },
      select: { slug: true },
    }),
  ]);
  const ctx = {
    pageSlugs: new Set([...pages.map((p) => p.slug), page.slug].filter(Boolean)),
    siteKeys: new Set(Object.keys(stages[0]?.outputRef?.pageKeyToId ?? {})),
    formSlugs: new Set(forms.map((f) => f.slug)),
    schemas: getSectionSchemas(),
  };
  return summarize(validateContent(page, ctx));
}
