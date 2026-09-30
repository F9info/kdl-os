# Template Engine: The User Journey

Project: Subhadra Group website (`cmt15bmts000401s6fn5ydhzp`)
Audience: the admin who builds a client website with Studio (the Template Engine).
Items that could not be verified in a browser are marked **unverified**.

# 1. The journey at a glance

```
 S Sign in            Admin panel opens on the Dashboard
        |
 1 Select Platform    Sidebar > Application Settings opens "Step 1 - Select Platform"
        |             Pick ONE platform per project. Web Application = the active platform.
        |
 2 Company details    Application Settings > Brand Profile: company name, emails, phones, addresses
        |
 3 Modules check      Sidebar > Modules: Template Engine, Theme Engine, Page Builder,
        |             Menus, Sectors, Catalog, Work, FAQ are switched on
        |
 4 Template Engine    Sidebar > Template Engine  (opens the default project)
        |
 5 Overview           Upload logo, confirm company and contact details      [Intake]
        |
 6 Color Palette      Check the 4 brand colors taken from the logo          [Palette]
        |
 7 Inference and      AI suggests fonts and tone, a person approves the kit  [Inference, Approval]
   Approval           Brand colors become design tokens in the Theme Engine
        |
 8 Brands > Web app   Typography > Font settings > Navigation > Pages       [Website]
        |
 9 Layout             Choose Top header, Header and Footer designs
        |
10 Fill the content   Sectors, Catalog, Work, FAQ, Case Studies, Team
        |             Each Sector, Catalog and Work entry gets its own detail page
11 Menus              Fine-tune header and footer menus
        |
12 Edit pages         Page editor and Section Builder
        |
13 Finish             Guidelines PDF, Collateral, Preflight, Export        [optional]
        |
14 Go live and        Open the public pages, and re-run only what changed
   maintain
```

# 2. Before you start

| You need | Where to check |
|---|---|
| An admin account with these permissions: `template-engine:view` and `:run`; plus `:approve` for Approval and `:export` for Export | Sidebar > Access Control > Roles / Permissions |
| Modules switched on: Template Engine, Theme Engine, Page Builder, Menus, Sectors, Catalog, Work, FAQ, Case Studies | Sidebar > Modules (a module that is off has no sidebar entry) |
| A project to build in | The Studio opens the **default project** automatically. There is no sidebar screen for creating projects (**unverified** how new ones are created). |
| Object storage for uploaded files | Sidebar > Application Settings > Storage |

# 3. Step by step

Each step shows where you click, what you see and do, what the system does behind the scenes, and what you get.

## Start. Sign in

- **You:** log in to the admin panel.
- **You see:** the Dashboard. The left sidebar lists Dashboard, Users, Modules, then every switched-on module, then the groups Media, Access Control and Application Settings.
- **Next:** go to Application Settings.

## Step 1. Select Platform (first screen after you click Application Settings)

After signing in, the user clicks **Application Settings** (the Theme Engine / Studio entry). The first screen is **Step 1 — Select Platform**. It asks one question: **what are you building?** The rule on the screen is *one platform per project*. Global design tokens stay shared across all platforms, and each platform exposes only the settings that belong to its own ecosystem.

- **You see:** platform cards grouped by family:

| Group | Guideline | Platforms |
|---|---|---|
| **Web** | Responsive Web + WCAG | Website, Landing Page, **Web Application**, Admin Dashboard, Progressive Web App (PWA) |
| Mobile | Material Design 3 / Apple HIG | Android Native, iOS Native |
| Tablet | MD3 / Apple HIG, large screens | Android Tablet, iPad (iPadOS) |
| Desktop | Multi-window and keyboard navigation | Windows Desktop, macOS Desktop, Linux Desktop |
| TV | 10-foot UI, remote / D-Pad focus | Android TV, Google TV, Apple TV (tvOS), Samsung Smart TV (Tizen), LG Smart TV (webOS), Roku TV, Amazon Fire TV |
| Wearables | Compact glanceable layouts | Wear OS, watchOS (Apple Watch), Samsung Galaxy Watch |

- **You do:** click **Web Application**. This is the **active platform** for the journey in this document.
- **What happens next:** the flow continues exactly as described in the following steps (company details, modules, Overview, Color Palette, Approval, Brands > Web app, Layout, content, menus, editor). The choice of Web Application is what makes the Brands screen show the **Web app** card, and it is the platform whose design tokens the Approval stage writes to the Theme Engine.
- **Other platforms:** they are shown so the client sees the full roadmap, but they are **not active**. Picking one does not start a flow yet.
- **Where this stands in the current build:** the 27-platform picker is **not in the code today** (I searched the whole repository). What exists now is: (a) the Studio opens straight on Overview with Web App already fixed, (b) the Brands screen shows a single **Web app** card, and (c) the Theme Engine page has a platform bar with Web App, TV, Android Native App and iOS Native App. The picker in the screenshot is the intended first step, still to be built.

## Step 2. Application Settings (company details)

- **Click:** sidebar > **Application Settings**. The group opens with four items:
  - **Types**: named groups of settings (for example Brand Profile, Theme Settings).
  - **Categories**: sub-groups inside a type.
  - **Fields**: the individual settings (text boxes, images, colors) that belong to a type.
  - **Storage**: where uploaded files are kept.
- Every active **Type** also appears as its own sidebar item. Open **Brand Profile** (`/admin/settings/view/brand-profile`).
- **You do:** enter the company name (required), primary and secondary email, primary and secondary phone, and address lines 1 and 2.
- **Behind the scenes:** the values are saved as setting fields of the `brand-profile` type. They are seeded by `backend/prisma/seeders/brand-profile-fields.seed.js` and are **global**, not per project.
- **Why here first:** the Studio's Overview screen shows these same fields. Filling them here means the Overview opens pre-filled, and the header, footer and Contact page pick them up. You can also fill them later, directly in the Overview screen.
- **Result:** company details are stored once and reused everywhere.

## Step 3. Confirm the modules

- **Click:** sidebar > **Modules**.
- **You check:** Template Engine, Theme Engine, Page Builder (Section Builder), Menus, Sectors, Catalog, Work, FAQ and Case Studies are on.
- **Why:** the Studio depends on Theme Engine, Page Builder, Brand Kit, Collateral and Credits. Sectors, Catalog and Work are independent modules that plug in through the detail-page registry.

## Step 4. Open the Template Engine

- **Click:** sidebar > **Template Engine** (`/admin/template-engine`).
- **What happens:** the page looks up your default project and sends you to `/admin/template-engine/projects/<projectId>/intake`.
- **First time:** if the project has no run yet, you see **Start Studio run**. Click it (creates the run, needs `template-engine:run`).
- **This project:** run `cmt18teqh000101rxwfzfndow` already exists and is **COMPLETED**. Its id becomes the prefix of every generated page address (`/p/te-cmt18teqh000101rxwfzfndow-home`).
- **You see:** a top bar with three tabs: **Overview**, **Color Palette**, **Brands**. Six more stages exist but have no tab (see step 7).

## Step 5. Overview (Intake)

`/admin/template-engine/projects/<projectId>/intake`

- **You see:** one card, **Logo & Contact Details**.
- **You do:**
  1. Click **Upload logo** (svg, png, jpeg or webp). A preview and a status badge (draft, extracted, inferred, approved) appear.
  2. Check or enter the company name and contact fields (the same fields from step 2).
  3. Click **Next**.
- **Behind the scenes:**
  - The logo is cleaned, virus-scan queued, stored as media, and also becomes the admin panel logo (sidebar header).
  - **Next** checks that company name and logo exist, saves the fields, marks the INTAKE stage done, and opens Color Palette.
  - If the Website stage was already built, saving here quietly re-runs it so the logo and contact details reach the existing pages.
- **Result:** a brand kit exists for the project, with logo and contact data.

## Step 6. Color Palette

`.../palette`

- **What happens on its own:** the palette is extracted from the logo (color math, no AI).
- **You see:** four colors: Primary, Secondary, Tertiary (accent) and Quaternary (neutral), with generated shade ramps.
- **You do:** keep them, or change each by typing a hex code, clicking **Randomize**, or using the eyedropper to pick from the logo. Click **Submit palette**.
- **Behind the scenes:** the palette is saved to the brand kit. A kit that is already approved cannot be changed.
- **Result:** brand colors are fixed. The screen moves on to **Brands** (Website).

## Step 7. Inference and Approval (hidden tabs)

These two stages have no tab. They are reached by their address, or were already done.

| Stage | Address | What the person does | Behind the scenes |
|---|---|---|---|
| Inference | `.../inference` | Click **Run stage**; read the suggested typography pair and tone | Calls the AI service (falls back to a rule table if unavailable); charges 10 credits |
| Approval | `.../approval` | Tick each contrast adjustment, click **Approve** (needs `template-engine:approve`) | Marks the brand kit approved; writes the colors and type settings into the **Theme Engine** as design tokens and locks them |

- **Result:** the whole web app now uses the client's brand tokens. You can see them under sidebar > **Theme Engine**.
- **Important:** the server will not build the Website until Inference and Approval are done. On this project they are done. On a new project, the Palette screen's jump to Brands skips them, so run them first (**unverified in a browser**).

## Step 8. Brands > Web app (Website stage)

`.../website`. Only one brand card exists: **Web app**. It has four steps.

### 8a. Typography
- **You do:** pick heading fonts (Poppins, Inter, Manrope, Space Grotesk) and body fonts (Inter, Roboto, Open Sans, Work Sans), or add your own font files from the Media picker. Click **Next**.
- **Saved:** to the brand kit.

### 8b. Font settings
- **You do:** set sizes for H1 to H6, body, navigation and buttons.
- **Saved:** in your browser only (local storage).

### 8c. Navigation
- **You do:**
  - Tick **suggested pages** (Home, About, Products and more), or type a **custom page**, or add an **external link**.
  - Drag to reorder and nest items into drop-down menus. Use the globe toggle to copy an item into the footer menu.
  - Click a **detail-page chip** (Sector detail, Work detail, Catalog detail) to create the parent menu item ("Sectors", "Work", "Products & Services") with one child per entry.
- **Behind the scenes:** these are the real **Header** and **Footer** menus, the same rows you see in sidebar > Menus. A custom page label creates a menu item that points to `/p/te-<runId>-<page-name>`.
- **Rule:** names that match a detail-page type or a sector, work or catalog entry are not created as ordinary pages, because those get their own detail pages.

### 8d. Pages (assemble)
- **What happens on entering the step:** the Website stage runs with your navigation and layout choices.
- **The system:**
  - creates each selected page (default: Home, About, Contact) from the built-in template pack (general, medical or construction; the screen does not offer a choice, so the default applies),
  - fills in your brand colors, logo, contact details and layout,
  - publishes each new page.
- **Existing pages** are never rebuilt. Only navigation links, brand data, contact details, logos and layout are refreshed.
- **You see:** a grid of page cards, each with **Edit**. Also **Demo all pages** (opens the home page) and a **Layout settings** panel.
- **Result:** live pages at `/p/te-<runId>-<page>`.

## Step 9. Layout

- **Click:** in the Layout settings panel, **Create layout** or **Edit layout** (`.../website/layout`).
- **You see:** three cards: **Top header**, **Header**, **Footer**. Each has an on/off switch and four designs, shown as live tiles filled with the client's own logo and details.
- **You do:** pick a design per card. Use **View** for a full-size preview, **Edit** to open the Home page in the editor, or **Create new** to design a new block in the Section Builder. Click **Create layout**.
- **Behind the scenes:** the choice is saved and the Website stage runs again, applying the layout to every page.
- **Back on the Pages step** you will also see pills such as **Layout Sector detail**, **Layout Work detail** and **Layout Catalog detail**. Each opens the shared detail page in the editor, and its number badge opens the list of entries.

## Step 10. Fill in the content modules

Each has a sidebar item. Open it with the project selected (`?projectId=<id>` is added for you, or the default project is used).

| Sidebar item | What you add | What the system creates | Public address |
|---|---|---|---|
| **Sectors** | Sector name, description, image, SEO | A detail page from the shared Sector template | `/sectors/<slug>` |
| **Catalog** | Product or service name, category, description, image, brand tag | A detail page from the shared Catalog template | `/catalog/<slug>` |
| **Work** | Work category (Central AC, Home Theater and so on) | Its own detail page | `/work/<slug>` |
| **FAQ** | Questions and answers | Shown in the quote-form section of pages | (inside pages) |
| **Case Studies** | Project stories | Shown in the Projects slider on the Home page | (inside pages) |
| **Team** | People | Shown in team and leadership blocks | (inside pages) |

- **List actions on Sectors, Catalog and Work:** **Edit page** opens the shared detail page in the editor (changing the layout there changes every entry), the **gear icon** edits that entry's own name, text, image and tag, and the **arrow icon** opens the public page.
- **Shared layout, own content:** Sector and Catalog entries share one page layout per project, but each keeps its own text and images.
- **Menus:** to list the entries in the header menu, go back to Navigation and click the detail-page chip (step 8c).

## Step 11. Menus

- **Click:** sidebar > **Menus**, choose Header Navigation or Footer Navigation.
- **You do:** rename, reorder, hide or nest items.
- **Result:** the public header and footer read the live menu on every page load, so no stage needs to be re-run.

## Step 12. Edit pages

- **Open:** **Edit** on a page card, or **Edit page** in the Sectors, Catalog or Work list. Address: `/admin/template-engine/edit/<pageId>?projectId=<id>`.
- **You see:** a visual editor with a Section list on the left and the page preview on the right. Header, top bar and footer are shown but locked; change them only through Layout (step 9).
- **You do:** add, reorder and style sections (Hero Slider, Welcome, Inner Banner, About, Counters, Services, Featured Projects, Sectors, Team and more), edit text and images, then publish.
- **Section Builder** (sidebar > Section Builder) is for designing new custom blocks.

## Step 13. Finish the run (optional stages)

| Stage | Address | What it does |
|---|---|---|
| Guidelines | `.../guidelines` | Renders a brand guidelines PDF (5 credits). Skippable. |
| Collateral | `.../collateral` | Renders a visiting card and letterhead (credits per render). Skippable. |
| Preflight | `.../preflight` | Checks that none of the three branches failed |
| Export | `.../export` | Produces the export manifest (needs `template-engine:export`) |

- When every stage is done or skipped, the run becomes **COMPLETED** and the Studio releases its locks on the Theme Engine fields.

## Step 14. Go live and maintain

Public pages:

| Address | What it shows |
|---|---|
| `/p/te-<runId>-home`, `-about`, `-contact` and so on | The assembled pages |
| `/sectors/<slug>` | A sector detail page |
| `/catalog/<slug>` | A product or service detail page |
| `/work/<slug>` | A work detail page |

**What to re-run after a change:**

| You changed | Do this |
|---|---|
| Logo or contact details | Save in Overview (it re-runs Website automatically if Website is done) |
| Navigation pages | Brands > Web app > Navigation, then move to Pages to rebuild links |
| Header, top bar or footer design | Layout > Create layout |
| Sector, Catalog or Work text and images | Edit the entry in its own list (no re-run needed) |
| Menu order or labels | Sidebar > Menus (no re-run needed) |
| Page sections | Edit in the page editor and publish |
| Brand colors or fonts | Color Palette or Typography, then Approval, then re-run Website |

# 4. How the screens connect

```
 Select Platform (Web Application) --> Application Settings > Brand Profile ----+
                                          v
 Template Engine > Overview (logo + contact) --> Brand Kit --> Color Palette
                                                     |
                                    Inference (AI) --+--> Approval --> Theme Engine (design tokens)
                                                                  |
                                                                  v
 Brands > Web app:  Typography -> Fonts -> Navigation -> Pages --> Page Builder (published pages)
                                              |                        ^
                                              v                        |
                                        Menus (header/footer)     Layout picker
                                                                       |
 Sectors / Catalog / Work  ---- shared detail-page templates ----------+
 FAQ / Case Studies / Team ---- feed blocks inside pages
                                                                       v
                                                           Public site: /p/..., /sectors/..., /catalog/..., /work/...
```

# 5. Screen and address reference

| Screen | Sidebar path | Address |
|---|---|---|
| Dashboard | Dashboard | `/admin/dashboard` |
| Modules | Modules | `/admin/modules` |
| Select Platform (Step 1) | Application Settings (first screen) | Intended screen, not in the current code. Today: Theme Engine platform bar at `/admin/theme-engine` |
| Application Settings | Application Settings > Types / Categories / Fields / Storage | `/admin/settings/types`, `/categories`, `/fields`, `/storage` |
| Brand Profile | Application Settings > (Type) Brand Profile | `/admin/settings/view/brand-profile` |
| Template Engine | Template Engine | `/admin/template-engine` |
| Overview (Intake) | (tab) | `/admin/template-engine/projects/<id>/intake` |
| Color Palette | (tab) | `.../palette` |
| Inference, Approval | (no tab) | `.../inference`, `.../approval` |
| Brands > Web app | (tab) | `.../website` |
| Layout picker | Pages step > Create layout | `.../website/layout` |
| Page editor | Pages step > Edit | `/admin/template-engine/edit/<pageId>?projectId=<id>` |
| Section Builder | Section Builder | `/admin/page-builder/section-builder` |
| Theme Engine | Theme Engine | `/admin/theme-engine` |
| Menus | Menus | `/admin/menus` |
| Sectors, Catalog, Work | Sectors, Catalog, Work | `/admin/sectors`, `/admin/catalog`, `/admin/work` |
| FAQ, Case Studies, Team | FAQ, Case Studies, Team | `/admin/faq`, `/admin/projects-content`, `/admin/team` |
| Media library | Media > Library | `/admin/media` |

# 6. What happens behind the scenes (summary)

The Studio is a 9-stage pipeline. Order is enforced by the server.

```
INTAKE -> PALETTE -> INFERENCE -> APPROVAL -+-> GUIDELINES (optional) --+
                                            +-> COLLATERAL (optional) --+-> PREFLIGHT -> EXPORT
                                            +-> WEBSITE    (optional) --+
```

- The engine owns two tables only: runs and stages. Everything else lives in the modules it calls.
- Stages run inside the web request. There is no background queue, and no cancel button.
- Only three things cost credits: brand inference (10), guidelines PDF (5) and each collateral render.
- Every run route is scoped to the project. A run from another project is not visible.

| Stage | Module it calls |
|---|---|
| Intake | Brand Kit |
| Palette | Brand Kit (color extraction) |
| Inference | Brand Kit > AI service; Credits |
| Approval | Brand Kit; Theme Engine |
| Guidelines | Brand Kit; Credits; storage |
| Collateral | Collateral; Credits |
| Website | Brand Kit; Media; Page Builder; detail-page registry (Sectors, Work, Catalog) |
| Preflight, Export | (read other stages) |

# 7. Permissions along the journey

| Step | Permission |
|---|---|
| Open Studio, read runs | `template-engine:view` |
| Start run, advance, retry, skip | `template-engine:run` |
| Approval stage | `template-engine:approve` |
| Export stage | `template-engine:export` |
| Application Settings | `types:view`, `categories:view`, `setting-fields:view`, `settings:view` |
| Section Builder / page editor | `page-builder:view` |
| Sectors, Catalog, Work | `sectors:*`, `catalog:*`, `work:*` (view, add, edit, delete) |
| Menus | `menus:*` |

# 8. Things to watch for

1. **Palette jumps to Brands.** On a new project, run Inference and Approval first, or Website is refused with "stage gate failed".
2. **Brand Profile is global.** Changing it here changes it for every project.
3. **Website only refreshes pages, never rebuilds them.** To get new built-in content on an existing page, edit it in the editor.
4. **Font settings live in the browser.** Clearing browser data resets them.
5. **Inference is generic.** It does not receive industry or company name, so its suggestions are not industry specific.
6. **Run status.** A failed stage does not mark the run failed, and there is no cancel.
7. **Body-copy AI** for Hero and About is designed but not built.
8. **Hidden tabs.** Inference, Approval, Guidelines, Collateral, Preflight and Export have no tab; use the addresses in step 7 and step 13.

# 9. Loading the client-approved content (for the team)

Approved Subhadra content is loaded with repeatable scripts in `backend/scripts` (run from `backend/` with `DATABASE_URL` set). Order:

1. Content: `seed-catalog-content.js <projectId>`, `seed-sector-content.js`, `seed-services-content.js`, `seed-about-content.js`, `seed-home-content.js`, `seed-products-services-content.js`, `seed-sectors-page-content.js`, `seed-leadership-content.js`, `seed-contact-content.js`, `seed-work-content.js`.
2. Site chrome: `seed-site-chrome.js <projectId>`.
3. Links: `fix-internal-links.js <projectId>` (last).

Data files are in `backend/scripts/seed-data/`; images in `frontend/public/seed/subhadra/`.

# 10. Main files

| Area | Path |
|---|---|
| Engine | `backend/src/modules/template-engine/` |
| Studio screens | `frontend/src/app/admin/template-engine/` and `.../_components/stages/` |
| Sidebar | `frontend/src/components/layout/AdminSidebar.tsx` |
| Application Settings | `frontend/src/app/admin/settings/` |
| Detail-page registry and templates | `backend/src/shared/detail-pages/` |
| Design documents | `.agents/arch/TEMPLATE_ENGINE_ARCH.md`, `docs/superpowers/specs/` |
