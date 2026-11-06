# Admin reference

## Terms
| Term | Meaning |
|---|---|
| Product | What you are building: Admin (always on), Website, Landing Pages |
| Module | One capability (users, forms, landing...). Declared in `backend/src/modules/<slug>/module.json` |
| Content | The bundle (`cms`) of Landing Pages, Forms, Menus and the website parts |
| Brands | Page under Content that opens Website, Landing Pages and Forms |
| Section | Reusable block group; saved sections are linked to pages by `templateId` |
| Themes | Token sets: `webapp` (public website) and `webapp_admin` (this admin app); TV/Android/iOS in Advanced |
| Identity | Company name, logos, contacts: `identity.*` in `app_settings` |

## Labels
Content (was CMS), Sections (was Section Builder), Templates, Design Tokens, Page Editor, Brand Assets,
Themes. Module labels come from `module.json`; the sidebar reads them from there, not from the database.

## Products to modules
| Product | Required modules |
|---|---|
| admin | users, user-management, settings, identity, media |
| website | cms, menus, page-builder-ui, theme-engine-ui, media |
| landing | landing, page-builder-ui, theme-engine-ui, media |

`PUT /api/modules/products {products:[...]}` saves the selection; `GET /api/modules/graph` returns it with
`inferred` (products that are on only because all their modules are enabled). Only the saved selection
hides menu entries.

## Page API (`/api/page-builder`, permission module `page-builder`)
| Call | Permission | Notes |
|---|---|---|
| `GET /` , `GET /:id` | view | |
| `POST /` | add | `{title, slug, data}`; returns `{page}` |
| `PUT /:id` | edit | with `status` also needs `publish` |
| `POST /:id/checks` | view | returns `{issues, errors, warnings, can_publish}` |
| `POST /:id/publish` | publish | 422 `PUBLISH_VALIDATION_FAILED` on errors unless `force:true` |
| `POST /:id/unpublish` | publish | |
| `GET /:id/versions`, `POST /:id/versions/:vid/restore` | view / publish | |
| `POST /:id/preview-link` | edit | signed token, audience `page-preview` |
| `GET /public/:slug`, `/public/site/:key`, `/public/sitemap` | none | public reads |

## Publish checks
Errors: empty page, no title, Image without source, link to an unpublished or missing `/p/<slug>` or key,
Contact Form without an active form, unknown block type.
Warnings: Image without alt, `#anchor` without target, no SEO title/description, SEO title over 60 or
description over 160 characters, field value or type that does not match the section schema.

## Linked sections
Block props `templateId`, `templateVersion`, `templateDetached`. `custom_block_templates.version` increases
only when the config changes. `GET /api/custom-blocks/:id/instances` and
`POST /api/custom-blocks/:id/update-instances` (permission `page-builder` view / edit) list and update pages.
Section schemas (105 sections, 1134 fields) are generated into
`frontend/src/frontend/blocks/section-schemas.json`; regenerate with `UPDATE_SECTION_SCHEMAS=1`.

## Folder rules
See `docs/planning/09-admin-frontend-architecture.md`: `src/admin` admin code, `src/frontend` public site
code, `src/app/(site)` public routes, shared layer imports neither (ESLint enforced).

## Measured: first page
`e2e/product-scenarios.spec.ts` prints "TTHW first page: created, published, visible to a visitor" in ms for
a signed-in admin on the Docker stack (about 0.1 s on the development machine). A clean install
(clone, `.env`, `docker compose up`, first admin) is not part of that measure.
