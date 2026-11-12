# Flow 3: Static website only (with admin)

**Goal:** Ship a website as plain files hosted anywhere, with no live web app in front of visitors.

**You get:** a downloadable .zip of the site. The admin is only for you, to build and re-export.

**Products to tick:** Website (leave Landing Pages off). Answer **Yes, create my website** in step B3.

[[flow: Sign in | Setup wizard | Enable modules | Build | Publish]]

> Screenshots are from a running KDL OS install where these modules are already enabled, so cards show **Enabled** and **Disable**. On a fresh install the same cards show **Available** with an **Install** button (see the card mockup in Part C).

## Step 1. Sign in
> KDL OS must already be installed and running. If not, follow the **Installation** guide first (Admin > Documents > Installation).

Open **http://localhost/login**. Email `admin@kdl.com`, password `kdl-dev-seed-password`. KDL OS asks you to choose a new password on first sign-in.
![The sign-in screen](login)
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`.

## Part B. First-run setup wizard
On a fresh install a **Setup wizard** opens over the admin. It asks three things, in this order.

### B1. Step 1 of 2: your company
Company name, application name, logo, favicon, email, phone and address. You enter this once; it is used by the admin, the website and every module. Change it any time in **Admin Settings > Identity**. **Ask me later** closes the wizard without saving.
![Setup wizard, step 1 (real screen)](wizard-1)

### B2. Step 2 of 2: what are you building?
Tick the products you need. **Admin is always on** and has no card. Each product turns on the modules it needs, and the wizard shows what changes before you press **Next**.
[[mock:wizard2]]

### B3. Only if Website is ticked: starter website
[[mock:wizard3]]
**Yes, create my website** builds a ready 5-page site (Home, About, Services, Contact, FAQ) you can edit. **Skip** starts with no pages.

> Missed or dismissed the wizard? Company details live in **Admin Settings > Identity**; products live at **/admin/settings/products**. Nothing is deleted when you turn a product off.

## Part C. Install and enable the modules
After you sign in (and answer or close the wizard), open **Modules** in the left sidebar. This is where every capability is switched on. A module has to be **installed** once and then **enabled**; a module that is off has no menu entry and its routes return 404. Data is never deleted by turning a module off.

### C1. What the Modules screen shows
At the top: a **search box**, the filter chips **All, Enabled, Installed, Available, Disabled**, and **Show internal**. Below: one card per module with its status badge and buttons. A padlock beside the name means a **core** module that is always on (Auth, Application Identity, Media, Modules, Settings, User Management, Users).
![Modules: 13 cards in the default view, status badges and Disable / Settings buttons](modules)

| Badge | Button on the card | What pressing it does |
|---|---|---|
| **Available** (not installed yet) | **Install** | Registers the module's permissions and seeds its data. It becomes **Installed**. |
| **Installed** | **Enable** | Routes and menu items go live immediately. It becomes **Enabled**. |
| **Enabled** | **Disable** | Routes return 404 and menu entries disappear. Data is kept. **Settings** edits the module's JSON settings. |
| **Disabled** | **Enable** | Switches it back on with its data intact. |
[[mock:states]]

### C2. Install, then enable: the two clicks
1. Press **Install** on the card. A confirmation asks you to confirm.
[[mock:dlg_install]]
2. A green message says the module was installed, and the card now shows **Enable**.
[[mock:toast]]
3. Press **Enable** and confirm. Menu items for the module appear in the sidebar straight away (refresh the page if they do not).
[[mock:dlg_enable]]

> **Dependencies are handled for you.** Installing or enabling a module also installs and enables everything it needs, in the right order. A module cannot be disabled while another enabled module still needs it; disable that one first.

> **Conflicts:** if two modules cannot run together, KDL OS shows a **Switch** dialog listing the modules that will be disabled. It is non-destructive; press **Enable & switch** to continue or **Cancel**.

### C3. Default view versus "Show internal"
The default view shows 13 top-level cards. **Frontend** is a **bundle**: it stands for Website, Landing Pages, Forms, FAQ, Gallery, Testimonials, Team, Catalog, Work, Sectors and Projects Content together. Press **Show internal** to list every individual module (37), such as **Landing Pages**, **Website** and **Templates** (the Studio).
![Show internal: every individual module appears (37)](modules-internal)

### Modules this flow needs
| | Modules |
|---|---|
| **Must be on** | Frontend (bundle), Page Editor UI, Themes, Templates (the Studio) and what they bring |
| **Optional** | Membership, Notifications, Integrations |
| **Can stay off** | nothing else is needed (Landing Pages comes with Frontend; its menu stays hidden until you tick that product) |

### C4. Do this for the website flow
1. Search **frontend**. On the **Frontend** card press **Install**, confirm, **Enable**, confirm. One click installs the whole bundle: Website, Forms, Landing Pages, FAQ, Gallery, Testimonials, Team, Catalog, Work, Sectors and Projects Content.
![Search "frontend": the bundle card](modules-frontend)
2. Search **page editor**. **Page Editor UI**: **Install**, **Enable**.
![Search "page editor"](modules-page-editor)
3. Search **themes**. **Themes**: **Install**, **Enable**.
![Search "themes"](modules-themes)
4. Press **Show internal**, search **templates**. On **Templates** (the Studio) press **Install**, then **Enable**. Projects, Design Tokens, Brand Assets, Collateral and Credits come with it.
![Show internal, search "templates": the Studio module](modules-int-templates)
5. Refresh. The sidebar now has a **Frontend** group (Brands, Website Details, Color Palette, Navigation, Layouts, Pages, Sections) plus Sectors, Catalog, Work, FAQ and the rest.
6. Landing Pages came with Frontend. Its menu stays hidden until you also tick the **Landing Pages** product (Admin Settings > Products).

### C5. The shortcut: let KDL OS do it from the products you tick
The Setup wizard (Part B) and **Admin Settings > Products** (**/admin/settings/products**) enable every module the products need, in dependency order, and show **What this selection does** before you press **Apply products**. Use the Modules screen when you want one module at a time or need to switch something off.
![Admin Settings > Products](products)


## Part D. Build it
### Set the company details once
**Admin Settings > Identity**. Name, logos, favicon, brand colours, contact details, social links. Everything else reads from here.
![Admin Settings > Identity](identity)

### Pick the look
**Admin Settings > Themes**. Choose **Website** (public site) or **Admin app** (this panel) at the top, **Simple** for colours and fonts or **Advanced** for every token, then **Publish**.
![Admin Settings > Themes](themes)

### D1. Open the Studio (Template Engine)
**Frontend > Brands** opens the project's Studio. First time: press **Start Studio run**. Tabs along the top: Overview, Color Palette, Brands.

### D2. Overview
Upload the logo (svg, png, jpeg, webp), check company and contact details, **Next**. The logo also becomes the admin logo.
![Studio: Overview](studio-overview)

### D3. Color Palette
Four brand colours are taken from the logo: Primary, Secondary, Tertiary, Quaternary. Keep them or edit each (hex, **Randomize**, eyedropper), then **Submit palette**. A person approves the brand kit; the colours become design tokens in the Theme Engine.
![Studio: Color Palette](studio-palette)

### D4. Website stage
Typography, Font settings, optional Buttons and form-field style, **Navigation** (one page per menu item, plus Home) then **Pages** to assemble them. **Layouts** picks the Top header, Header and Footer; **Home's header and footer are shared by every public page.**
![Studio: Website stage, with Layout settings and the Convert to Static Website button](studio-website)

### D5. Website details and menus
**Frontend > Website Details** holds the site-wide details; **Frontend > Navigation** edits header and footer menus (no re-run needed).
![Frontend > Navigation](navigation)

### D6. Edit and publish pages
**Frontend > Pages** lists every page; open one to edit blocks, **Insert block**, then **Publish**. Publish checks stop real problems (empty page, missing title, broken link, image without source) and only suggest the rest. **Frontend > Sections** holds reusable sections linked to pages.
![Frontend > Pages](pages)
![Frontend > Sections](sections)

### D7. Fill the content modules
Sectors, Catalog, Work, FAQ, Case Studies, Team, Testimonials, Gallery. Each Sector, Catalog and Work entry gets its own detail page at `/sectors/<slug>`, `/catalog/<slug>`, `/work/<slug>`. Pages are public at `/` and `/p/<slug>`.

### D8. After a change, re-run only what changed
| You changed | Do this |
|---|---|
| Logo or contacts | Save Overview (Website re-runs by itself) |
| Navigation pages | Navigation, then Pages |
| Header, top bar or footer | Layouts > Create/Edit layout |
| Colours or fonts | Color Palette or Typography, Approval, re-run Website |
| Entry text, menus | Edit in place, no re-run |

### Convert to a static website
Plain files (HTML, CSS, images) you can host anywhere with no server.
1. Finish and **publish** the website pages first; the export holds the published pages.
2. **Frontend > Convert to Static Website** (button at the top of the Studio, or **/admin/static-website**).
3. Optional **Website address** (https://www.example.com): adds `sitemap.xml` and canonical addresses. `robots.txt`, page titles, descriptions and share tags are always included.
4. Optional **Web app address** (https only): a static site has no server, so forms cannot save by themselves. Empty = each form becomes your contact email and phone from Identity. With your public Web app address the forms, menus and FAQ keep working through it.
5. **Convert to Static Website**. Progress: collect pages, menus, brand and images; build the files; ready to host (a few minutes).
6. **Download as .zip**, unzip, upload to any host (Netlify, S3, GitHub Pages, nginx).
7. Changed something? **Convert again with the latest changes** and replace the files on your host.
![Frontend > Convert to Static Website](static-website)
Landing pages convert one by one from their own **Convert** button, each into its own folder.

### Hosting notes
- Visitors reach only your static host. Keep the admin on a private address.
- Forms need the **Web app address** (https) or fall back to your contact email and phone.
- Re-export after every content change; the zip is a snapshot.

## Check it worked
- Open the public address in a private window, signed out.
- Top bar, header and footer match Home on every page.
- Every menu link opens a page; forms send (web app) or show your contact details (static).
- The admin sidebar shows only the modules your flow needs.
- `docker compose ps` shows every service up and `backend` healthy.

## Everyday commands
Run inside the `kdl-os` folder.
| I want to | Type |
|---|---|
| Stop (keeps data) | `docker compose down` |
| Start again | `docker compose up -d` |
| See what runs | `docker compose ps` |
| Update to the latest code | `git pull` then `docker compose up -d --build` |
| Read backend logs | `docker compose logs backend --tail 100` |
> `docker compose down -v` deletes **all your data**. Do not use it unless you want to start from zero.

## If something goes wrong
| Problem | Do this |
|---|---|
| A variable is missing | Wrong folder, or A3 was skipped. Go to `kdl-os` and repeat A3. |
| Port already in use | Close the program using it (for example a local site on port 80). |
| Build stops with Killed or out of memory | Give Docker 8 GB (A1), run A4 again. |
| 502 Bad Gateway | Still starting. Wait 1 to 2 minutes and refresh. |
| Wrong password | Did you run A5? First password is `kdl-dev-seed-password`. |
| Account locked / 429 | Wait a minute, or `docker compose restart backend`. |
