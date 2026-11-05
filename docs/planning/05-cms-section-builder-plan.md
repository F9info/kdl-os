# 05 — CMS and Section Builder Plan

Status: PROPOSAL. Builds on the existing Puck config, packs and `custom-blocks` module.

## 1. Data architecture

```
Site (website|landing) 1 ─ n Page 1 ─ n PageVersion
Page.content = [ { id, section_type, props, visible, responsive? } ]
SiteLayout (header/footer) 1 per Site, referenced by pages
SectionDefinition (custom) = schema + render template, tenant-level
```

- `Page`: site_id, slug, title, seo{title,description,og_image,canonical,noindex}, status, published_version_id.
- `PageVersion`: immutable snapshot of `content` + seo at publish; supports rollback.
- Draft = `Page.content`; published = referenced `PageVersion`.

## 2. Page management
Create (blank or from page template), duplicate, reorder, rename, slug management with uniqueness per Site, soft delete, unpublish. Routes are generated from slugs at runtime; no build step.

## 3. Section registry
Single registry (extends current Puck packs) mapping `section_type` -> `{ category, label, schema (Zod/JSON Schema), defaults, Component, variants[], thumbnail }`.
Categories: Hero, About, Services, Products, Features, Stats, Testimonials, Team, Gallery, Portfolio, Pricing, FAQ, Contact, CTA, Blog, Footer.

## 4. Section schemas
Each section declares fields with types (text, richtext, image, link, list, color-token, toggle) and a `tab` (Content / Style). This formalizes the existing prop-name routing to tabs (see editor-panel memory note) into explicit metadata so the editor needs no name heuristics.
Validation: server validates props against the schema on save and on publish.

## 5. Section templates and variants
- **Variant**: alternate layout of the same section_type (e.g. Hero-split, Hero-centered), same schema.
- **Section template**: saved preset of props for a type (e.g. "Construction hero with CTA").
- **Page template**: ordered list of section templates + default SEO.
Sections use token CSS variables only, so any Theme applies without changes.

## 6. Custom sections
Existing Section Builder composes atoms into a `CustomBlockTemplate`. Plan:
1. Save as `SectionDefinition` with generated schema from exposed atom props.
2. Register at runtime in the registry (no deploy).
3. Preview in builder; render via the same renderer in public site.
4. Versioned: pages store `definition_id + version`; updating a definition offers "update instances" (fixes the current copy-not-link limitation).

## 7. Dynamic rendering
Public route `[...slug]`: resolve Site (host/path) -> Page by slug -> published version -> for each section lookup registry component -> render. Unknown `section_type` renders nothing in production and a warning in preview. Identity, menus, header/footer come from live endpoints, not from the page JSON.

## 8. Editor capabilities (all in scope)
Add, remove, reorder, duplicate, hide/show, pick variant, edit content, edit style, upload media (Media Library), responsive overrides (mobile/tablet/desktop), undo/redo, autosave draft.

## 9. Preview and publish
- Preview: `/preview/:pageId?token=` renders draft with the live theme; shareable signed link with expiry.
- Validation before publish: required fields, alt text on images, SEO title/description present, link targets exist.
- Publish: write `PageVersion`, set pointer, revalidate cache. Unpublish and rollback supported.

## 10. SEO
Per-page SEO fields plus global defaults (title template, default og_image). `generateMetadata` reads them. Sitemap and robots generated per Site.

## 11. Forms and CTAs (Landing)
`forms` module: form definition, submissions table, spam protection, email/webhook notification; CTA sections reference a form or link.
