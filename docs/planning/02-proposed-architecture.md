# 02 — Proposed KDL OS Architecture

Status: PROPOSAL. Awaiting approval. Approved so far: products are flags (not separate apps); Application Identity replaces the old brand stores; the site reads identity live.

## 1. Principle

One repo, one core. A **Product** flag decides which modules, nav, routes and onboarding steps appear. Content lives in the CMS; identity and design are read at runtime, never baked.

## 2. Three layers

```
Layer 1  Application Identity   (global, one place, read live via /api/app-config)
Layer 2  Products + Modules     (what is switched on; dependency-resolved)
Layer 3  Sites + Content        (website / landing sites, pages, sections)
```

### Layer 1 — Application Identity
Single record (stored in `app_settings` under `identity.*`, or one `ApplicationIdentity` row; decision D5 below):
app_name, app_title, description, logo_light, logo_dark, favicon, brand_primary, brand_secondary, contact (email/phone/address), social links, copyright.

- Replaces: `brand-profile` fields, `BrandKit.logo_media_id` (as the website logo), `logo` setting field, hardcoded `'KDL Admin'`.
- Public `GET /api/app-config` returns a whitelisted subset (no secrets). Cached in Redis, invalidated on save.
- Admin shell and public site both consume it: `<title>`, favicon, sidebar logo, Header/Footer blocks.
- Global vs per-site: identity is global. A `Site` may override logo / colors / SEO defaults (nullable fields, fall back to global).

### Layer 2 — Products and Modules
- `app_settings` key `products.enabled` = subset of `admin | website | landing`.
- Each product declares required and optional modules (see doc 04). Enabling a product runs the existing `dependsOn` resolver and enables the required modules; shared modules (Media, SEO, Forms) are enabled once and reference-counted by product.
- Disable = hide nav + gate routes. **Never delete data.** Re-enabling restores everything.
- Existing `module.json` gains an optional `products: []` hint; no schema break.

### Layer 3 — Sites and Content
- New `Site` entity: `id, type (website|landing), slug, domain?, name, theme_id?, identity_overrides Json?, status`.
- `Page` (existing BuilderPage) gains `site_id`, `seo` (title, description, og_image, canonical, noindex), `status (draft|published)`, `published_version_id`.
- A website = one Site with many pages. A landing product = many Sites of type `landing` (each usually one page) sharing the same section registry.

## 3. Module architecture
Keep current manifest system. Add: product tags, `GET /api/modules/graph` (for the wizard), "required by" display, soft-disable semantics. Core modules (auth, users, roles, settings, identity) always on.

## 4. CMS / Section Builder
See doc 05. Sections are schema-driven blocks in a registry; pages store `{section_type, props, visible}` arrays; rendering is data-driven.

## 5. Design / Theme
- **Design System** = token schema (typography, spacing, radius, shadow, breakpoints).
- **Theme** = a named set of token values (light, dark, brand). Existing Theme Engine stays; `webapp` and `webapp_admin` become two Themes in one UI with a product switch.
- **Template** = starter bundle (pages + sections + theme preset + menus).
- **Section** = reusable block. Sections use CSS-variable tokens only; the ~700 hardcoded palette classes are migrated incrementally.
- Platforms (android, ios, tv, ...) hidden unless enabled (progressive disclosure).

## 6. Settings architecture (final)
| Concern | Where |
|---|---|
| Identity & branding | Settings > Application Identity (new, single) |
| Products & modules | Settings > Products, Modules |
| Design tokens | Design > Themes |
| Navigation | Content > Menus |
| SEO defaults | Settings > SEO (global) + per-page SEO |
| Module-specific config | Each module's own settings tab (`Module.settings`) |
| Dynamic fields (existing SettingField) | Kept for module/custom data; not for identity |

## 7. Frontend rendering
- Admin shell: reads `/api/app-config` + `/api/modules/enabled` at boot (SSR-safe provider).
- Public site: Next App Router catch-all `[...slug]` resolves Site by host/path, fetches page JSON + identity + menus, renders sections through the registry. ISR/revalidate on publish.
- Preview: draft rendered through the same route with a signed preview token.
- Header/Footer become **global layout records per Site** (server-persisted, replacing localStorage / unused `SiteLayout`), referenced by pages, not copied.

## 8. Database changes (summary)
New: `Site`, `PageVersion`, `SectionDefinition` (custom sections), `SiteLayout` revived or replaced. Altered: `BuilderPage` (+site_id, seo, status, published_version_id). `app_settings` keys: `identity.*`, `products.enabled`. Data migration: copy brand-profile + BrandKit logo into identity; keep old rows until a later cleanup.

## 9. Build-time vs runtime
- Build-time: code, installed modules (present in repo).
- Runtime config: products, enabled modules, identity, theme values.
- User content: sites, pages, versions, media.
Nothing in the last two groups should require a rebuild.

## 10. Security & performance
RBAC on every new route via `requirePermission`; Zod validation; whitelisted public config; Redis cache for app-config and published pages; activity logging on identity/product/publish changes.
