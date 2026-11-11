# Flow 2: Landing page only (with admin)

**Goal:** publish one or more campaign pages without a full website.

**You get:** branded landing pages at `/p/<slug>` with a working contact form, plus the admin that runs them.

| Product | Turns on | Typical use |
|---|---|---|
| **Admin** (always on) | Users, Roles, Settings, Identity, Media | Internal business app |
| **Website** | Content, Menus, Page builder, Theme engine, Media | Multi-page company site |
| **Landing Pages** | Landing, Page builder, Theme engine, Media | Campaign and product pages |

## 1. Sign in and run the first-time setup
1. Open **http://localhost:3001/login** and sign in with your admin account.
2. On a fresh install the **Setup wizard** opens by itself.
   - **Step 1 of 2: company details.** Name, logo, emails, phones, address. Saved once in **Settings > Identity** and reused everywhere (admin, website, print layouts).
   - **Step 2 of 2: what are you building?** Tick the products you need (see the table below). Admin is always on. The screen shows what each choice turns on before you press **Apply products**.
3. Missed the wizard? Company details live in **Admin Settings > Identity**; products live at **/admin/settings/products**. Turning a product off never deletes data.

Tick **Landing Pages** (leave Website off). There is no website setup step.

## 2. Set the brand once
**Admin Settings > Identity** for name, logo, contacts. **Admin Settings > Themes**, choose **Website**, pick colours and fonts, **Publish**. Landing pages use these tokens.

## Build a landing page
1. **Frontend > Brands**, choose **Landing Pages** (or open **/admin/landing-pages**).
2. Pick a template and press **Use this template** (or **View template** first). Give the page a name and press **Create and edit**.
3. In the editor change text, images, buttons and the contact form block. Use **Insert block** for more sections and **Sections** for saved ones.
4. **Save**. The finished pages list shows each page with **Preview** and **Convert**.
5. **Publish** when the checks pass. The page is public at `/p/<slug>`.
6. Optional: set the page's own branding (logo, colours), duplicate, rename, or **Save as template**.
7. Forms: create the form under **Frontend > Brands > Forms**, then pick it in the Contact Form block. Messages land in the admin.

## Admin application (always included)
Everything below is available from the first sign-in and does not depend on any website product.

| Need | Where |
|---|---|
| Add people | **Users** (add, suspend, reset) |
| Decide who can do what | **Access Control > Roles / Permissions** (Super Admin, Developer, Admin, User defaults) |
| Company name, logo, contacts | **Admin Settings > Identity** |
| Admin look (colours, fonts) | **Admin Settings > Themes**, choose **Admin app**, Simple or Advanced, **Publish** |
| Turn capabilities on or off | **Modules** (a module that is off has no menu entry) |
| Alerts and integrations | **Notifications**, **Integrations** |
| Who did what | **Access Control > Activity Log** |
| Files | **Media > Library**; storage under **Settings > Storage** |

## Check it worked
- Open the public address in a private window, signed out.
- Header, top bar and footer match Home on every page.
- Every menu link opens a page; forms send (Web app) or show your contact details (static).
- Admin sidebar shows only the modules your products need.

