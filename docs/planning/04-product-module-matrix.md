# 04 — Product and Module Matrix

Status: PROPOSAL. Module slugs marked (new) do not exist yet. Existing slugs (faq, gallery, team, catalog, work, sectors, menus, cms, ...) must be checked against `backend/src/modules/*/module.json` before implementation (verify).

## Product definitions

| | Admin | Website | Landing Pages |
|---|---|---|---|
| Purpose | Internal business app | Multi-page corporate site | Campaign / product pages |
| Required modules | auth, users, roles-permissions, settings, identity (new) | cms-core, pages, section-builder, media, menus, seo (new), site-renderer (new) | landing (new), cms-core, section-builder, media, forms, seo (new), site-renderer (new) |
| Optional modules | any business module, notifications, activity-log, integrations | faq, team, gallery, sectors, catalog, work, blog, forms | analytics, A/B (future), forms extras |
| Admin nav shown | Dashboard, business modules, Users, Roles, Settings | Content (Pages, Menus, Media), Design, SEO, Settings | Landing Pages, Media, Forms, Design, SEO |
| Frontend requirement | Admin shell only | Public renderer + header/footer + menus | Public renderer, no menus required |
| CMS requirement | none | full | page + sections only |
| Publishing | n/a | per page + site | per landing page |
| Wizard steps | Identity | Identity, template, menus | Identity, template, CTA/form |

## Shared modules (enabled once, used by many)

| Module | Admin | Website | Landing |
|---|---|---|---|
| identity | required | required | required |
| settings | required | required | required |
| media | optional | required | required |
| seo | - | required | required |
| forms | optional | optional | required |
| section-builder | - | required | required |
| cms-core | - | required | required |
| menus | - | required | optional |

Reference counting: a shared module is disabled only when **no enabled product requires it**.

## Combination rules
- Any subset of the 3 products is valid (7 combinations).
- Dependencies resolve to the union of required modules.
- `conflictsWith` (existing mode-switch) is honored; resolver reports conflicts before enabling.
- Core modules are never disabled.

## Resolver algorithm
1. Inputs: set of selected products.
2. Collect `required` modules per product; take the union.
3. Expand transitive `dependsOn`.
4. Check `conflictsWith` against currently enabled modules; if conflict, block and explain.
5. Enable in topological order; record `required_by: [products]`.
6. On product removal: recompute union; modules no longer required become *optional-enabled* (kept on by default, user can disable). Never auto-delete data.

## Installed vs enabled vs required
- **Installed**: code present and migrations applied.
- **Enabled**: nav, routes and APIs active.
- **Required**: enabled because a selected product or module depends on it; cannot be disabled while depended on.
- **Optional**: enabled by user choice.
- **Disabled**: installed but hidden; data intact.
