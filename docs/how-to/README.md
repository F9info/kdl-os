# How-to guides

Goal-oriented steps. Each guide assumes you are signed in as an admin and the Docker stack is running
(app at http://localhost:3001). Terms are defined in [../reference/admin-reference.md](../reference/admin-reference.md).

1. [Set your company details](#1-set-your-company-details)
2. [Choose what you are building (products)](#2-choose-what-you-are-building-products)
3. [Create and publish a page](#3-create-and-publish-a-page)
4. [Reuse a section across pages](#4-reuse-a-section-across-pages)
5. [Change the look of the website or the admin app](#5-change-the-look-of-the-website-or-the-admin-app)
6. [Add a landing page or a form](#6-add-a-landing-page-or-a-form)
7. [Run the product scenario tests](#7-run-the-product-scenario-tests)

## 1. Set your company details
1. Open **Settings > Identity**.
2. Fill in the app name, logo, favicon and contact details. Save.
3. The name, logo and contacts now show in the admin, in generated sites and in collateral.

Identity is the only place company details live. Do not add a second company form.

## 2. Choose what you are building (products)
1. Open `/admin/settings/products` (there is no menu entry: products belong to Content, and the first-run setup wizard asks the same question).
2. Turn **Website** and/or **Landing Pages** on or off. Admin is always on and has no card.
3. Check "What this selection does", then **Apply products**.

Turning a product off never deletes data and never switches modules off; it only hides the menu entries
of public-site modules when no public product is selected.

## 3. Create and publish a page
1. **Content > Pages**, create a page (title and slug), open the editor.
2. Add blocks with **Insert block**. Autosave keeps a draft.
3. Press **Publish**. The checks run first:
   - Problems that would break the page for visitors (empty page, missing title, broken `/p/...` link,
     image without source, form missing) stop publishing. **Publish anyway** overrides.
   - Suggestions (no alt text, no SEO description, missing anchor) never block.
4. The page is live at `/p/<slug>` (or the site key URL). **Versions** lists every publish; **Restore**
   publishes an old version as a new one; **Unpublish** takes it down and keeps the content.

Editing a live page changes only the draft until you publish again.

## 4. Reuse a section across pages
1. **Content > Sections**: build and save a section.
2. In the page editor, **Insert block** and choose the saved section. It stays linked to it.
3. After you change the saved section, open **Content > Sections** and press **Pages** on it: it lists the
   pages using it and how many are behind. **Update** copies the new version in (published pages get a
   draft change, nothing goes live until you publish).
4. In the editor, a block shows **Update this block** when behind, or **Reset to the saved section** when you
   customised it on the page (customised blocks are skipped by bulk updates).

## 5. Change the look of the website or the admin app
1. **Themes** (`/admin/theme-engine`).
2. Pick **Website** or **Admin app** at the top. Use **Simple** for colours and fonts, **Advanced** for every token.
3. Publish. The website theme restyles the public site; the Admin app theme restyles this admin.

## 6. Add a landing page or a form
- **Landing page:** open **Content > Brands**, choose **Landing Pages**, create one from a template.
- **Form:** **Content > Brands**, choose **Forms**, create it, then add a Contact Form block to a page and pick it.

## 7. Run the product scenario tests
```bash
cd frontend
E2E_BASE_URL=http://localhost:3001 E2E_ADMIN_PASSWORD='<admin password>' \
  pnpm e2e e2e/product-scenarios.spec.ts
```
It applies Admin only, Website, Landing, Website + Landing and Full platform through the API, checks the
sidebar in a browser, then restores your saved selection. It also times creating and publishing a first
page and opening it as a visitor.

## 7b. Choose the website's button and form-field style
In **Frontend > Brands > Web app**, after Font settings press **Next: Buttons and form fields** (or **Skip to Navigation**). Pick one of 12 button styles (airy pill, classic, leaf, outline, soft tint, soft and hard shadows, glow, two gradients and more) and one of 8 form-field styles, then **Save**. Every main button and every text box, text area and drop-down on the website uses them, in your theme's colours; admin screens do not change. The choice is also part of the static copy, so convert again to update it.

## 8. Convert the Web app to a static website
The Web app is the only website product. When you also need a copy that any static host can serve (no server, no database), convert it; the Web app itself is not changed.
1. Open **Frontend > Brands > Web app** and press **Convert to Static Website** (top right). Forms are right next to it.
2. Press **Convert to Static Website** on the next screen. It collects your latest pages, menus, brand and images, then builds the files. A minute or so.
3. When it says ready, copy the folder `frontend/projects/<project-slug>/out` from your computer (or press **Download as .zip**) and upload its contents to your host. Host it at the root of a domain or subdomain.
4. After you change the Web app, press **Convert again with the latest changes** and replace the files on your host.

The folder is independent: it needs no server. Brand colours and fonts are baked in. Forms cannot save messages without a server, so each form shows your contact email and phone from Settings > Identity. To keep forms working, open **Forms on the static website** and enter the public address of your Web app. Not included: work, catalog and sector detail pages, `/p/<slug>` links, and landing pages.
