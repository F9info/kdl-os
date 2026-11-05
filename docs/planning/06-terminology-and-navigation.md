# 06 — Terminology and Navigation

Status: PROPOSAL. Names are recommendations; confirm before any rename work.

## 1. Dictionary

| Term | Meaning |
|---|---|
| Product | What the user is building: Admin, Website, or Landing Pages. A flag, not a codebase. |
| Application | The whole running KDL instance (one identity, N products). |
| Module | A functional capability (users, faq, forms). Installed/enabled independently. |
| CMS | The content capability: sites, pages, sections, media, menus. Not a product; a module bundle. |
| Site | A publishable website or landing page set with its own slug/domain. |
| Page | One routable document made of sections. |
| Section | A reusable block on a page (Hero, FAQ). |
| Section Template | Saved preset of a section's content/style. |
| Page Template | Starter set of sections for a new page. |
| Template (starter) | Whole-product starter: pages + menus + theme preset. |
| Theme | Named set of design token values (light, dark, brand). |
| Design System | The token schema (typography, color, spacing, radius, shadow, breakpoints). |
| Application Identity | Global name, logos, favicon, colors, contacts, social, copyright. |
| Settings | Configuration of identity, products, modules, SEO. |

## 2. Old name -> new name

| Old | New |
|---|---|
| Theme Engine | Design > Themes |
| Template Engine / Studio | Templates (starter library) + Setup Wizard |
| Website Details | Settings > Application Identity |
| Brand Kit (logo/contacts) | Merged into Application Identity (palette stays a Theme preset) |
| Setting Fields / Types / Categories | Custom Fields (advanced, hidden by default) |
| Module Manager | Settings > Modules |
| Page Builder / Section Builder | Pages / Sections |
| `cms` umbrella | Content (module bundle) |
| "KDL Admin" hardcoded | `app_name` from identity |

Rule: no user-facing label ends in "Engine".

## 3. Admin navigation (proposed)

```
Dashboard
Content            (Website / Landing enabled)
  Pages · Landing Pages · Menus · Media · Forms
Business modules   (per enabled module)
Design             (Website / Landing enabled)
  Themes · Templates · Sections
Users & Access
  Users · Roles · Permissions
Settings
  Application Identity · Products · Modules · SEO · Storage · Integrations
Activity Log
```
Items hide when their product/module is off. Admin-only users never see Content or Design.

## 4. Product setup navigation
Settings > Products: cards per product with toggle, status, "modules this enables", "Continue setup" link. Adding a product launches only that product's mini-wizard.

## 5. CMS navigation
Content > Pages (list, filter by Site, status) -> page editor (sections panel, canvas, SEO tab, preview, publish). Content > Landing Pages mirrors it filtered by Site type.
