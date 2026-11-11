# Flow 8: Full platform

**Goal:** website, landing pages, static export and admin, all enabled.

**You get:** the complete product set with shared brand, content and permissions.

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

Tick **Website** and **Landing Pages**.

## Build the website (Web app)
The Web app is the live website served by this installation, from the same address as the admin.
1. **Frontend > Brands**, choose **Web app** (the Studio / Template Engine). First time: press **Start Studio run**.
2. **Overview**: upload the logo, confirm company and contact details, **Next**. The logo also becomes the admin logo.
3. **Color Palette**: four brand colours are taken from the logo. Keep or edit them (hex, Randomize, eyedropper), **Submit palette**.
4. **Approval**: the brand kit is approved by a person; the colours become design tokens in the Theme Engine.
5. **Website stage** (Brands > Web app): **Typography**, **Font settings**, optional **Buttons and form fields** style, **Navigation** (one page per menu item, plus Home), then **Pages** to assemble them.
6. **Layouts**: pick the Top header, Header and Footer designs. Home's header and footer are shared by every public page.
7. **Fill the content**: Sectors, Catalog, Work, FAQ, Case Studies, Team, Testimonials, Gallery. Each Sector, Catalog and Work entry gets its own detail page.
8. **Navigation** (menus): fine-tune header and footer menus. No re-run needed.
9. **Pages / page editor / Sections**: edit blocks, **Publish**. Publish checks stop real problems (empty page, missing title, broken link, image without source) and only suggest the rest.
10. **Go live**: pages are public at `/`, `/p/<slug>`, `/sectors/<slug>`, `/catalog/<slug>`, `/work/<slug>`.

**After a change, re-run only what changed:** logo or contacts: save Overview. Navigation: Navigation then Pages. Header or footer design: Layouts. Colours or fonts: Color Palette or Typography, Approval, then re-run Website. Entry text or menus: edit in place.

## Build a landing page
1. **Frontend > Brands**, choose **Landing Pages** (or open **/admin/landing-pages**).
2. Pick a template and press **Use this template** (or **View template** first). Give the page a name and press **Create and edit**.
3. In the editor change text, images, buttons and the contact form block. Use **Insert block** for more sections and **Sections** for saved ones.
4. **Save**. The finished pages list shows each page with **Preview** and **Convert**.
5. **Publish** when the checks pass. The page is public at `/p/<slug>`.
6. Optional: set the page's own branding (logo, colours), duplicate, rename, or **Save as template**.
7. Forms: create the form under **Frontend > Brands > Forms**, then pick it in the Contact Form block. Messages land in the admin.

## Convert the website to a static website
A static website is plain files (HTML, CSS, images) you can host anywhere, with no server.
1. Finish and publish the website pages first (see the Web app steps). The export holds the **published** pages.
2. Open **Frontend > Convert to Static Website** (**/admin/static-website**).
3. Optional **Website address** (for example https://www.example.com): adds `sitemap.xml` and canonical addresses. `robots.txt` and each page's title, description and share tags are always included.
4. Optional **Web app address**: a static site has no server, so forms cannot save messages on their own. Leave it empty and each form is replaced by your contact email and phone from Identity. Enter your public Web app address and forms, menus and FAQ keep working through it. It must be an https address.
5. Press **Convert to Static Website**. Progress: collect pages, menus, brand and images; build the files; ready to host. It takes a few minutes.
6. Press **Download as .zip**, unzip, and upload to any host (Netlify, S3, shared hosting, your own nginx).
7. Changed something later? Press **Convert again with the latest changes**.

A landing page converts the same way from its own **Convert** button; each landing page gets its own folder.

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

## Suggested order for a new client
1. Identity and Themes (brand once).
2. Website via the Studio (Overview, Palette, Approval, Website).
3. Content modules and menus.
4. Landing pages for campaigns.
5. Roles for the client's team (Admin role runs content and people; User has no admin access).
6. Publish, check, then Convert to Static if you want a plain-file copy.

## Check it worked
- Open the public address in a private window, signed out.
- Header, top bar and footer match Home on every page.
- Every menu link opens a page; forms send (Web app) or show your contact details (static).
- Admin sidebar shows only the modules your products need.

