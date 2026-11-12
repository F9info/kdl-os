import re
"""Guide text for build.py. Markdown-ish: ![caption](img-name) is a screenshot from img/,
``` is a terminal block, > is a callout, [[flow: a | b]] is a step strip, [[mock:x]] a drawn mockup."""

SIZE = {'identity-start': (1153, 809), 'modules-start': (1900, 580), 'brands-start': (1920, 550), 'landing-start': (1691, 829), 'new-landing-start': (767, 883), 'editor-start': (1920, 879), 'create-btn': (458, 168), 'save-btn': (125, 182), 'convert-start': (580, 642), 'brands-web': (1920, 550), 'typography': (1360, 900), 'font-settings': (1360, 900), 'button-styles': (1360, 900)}
CROP = {'brands-start': (32, 0), 'landing-start': (0, 69), 'editor-start': (0, 14), 'brands-web': (32, 0)}  # px cut from the top (browser address bar)  # screenshots that are not 1360x820

ANNOT = {  # image name -> [(x px, y px, label)] on the 1360x820 screenshot; a leading < puts the label left of the dot
 'login': [(870, 404, 'Click here and type your email'), (835, 487, 'Click here and type your password'), (870, 541, 'Click Sign in'), (489, 594, '<Forgot password? Click here')],
 'wizard-1': [(670, 290, 'Click here and type your company name'), (517, 396, 'Click here to add your logo'), (852, 396, 'Click here to add a favicon'),
              (670, 503, 'Click here to add your email'), (986, 503, '<Click here to add your phone'), (986, 586, '<Click here to add your address'), (951, 640, 'Click Next')],
 'identity': [(1006, 350, '<Click here to type the application name'), (1006, 458, '<Click here to set the browser tab title'), (1006, 560, '<Click here to describe your business'),
              (553, 678, 'Click Replace to upload your logo'), (130, 441, 'Admin Settings > Identity')],
 'modules': [(583, 185, 'Click here to search modules'), (1284, 215, '<Click Show internal to see every module'), (388, 396, 'Click Disable to switch a module off'), (590, 272, '<Status badge')],
 'modules-frontend': [(583, 185, 'Type the module name here'), (388, 396, 'A fresh install shows Install here: click it'), (663, 272, '<Status badge')],
 'themes': [(453, 114, 'Simple = colours, Advanced = every token'), (483, 369, 'Click Light or Dark'), (420, 443, 'Click a ready-made look'), (485, 584, 'Click a swatch to change this colour')],
 'products': [(641, 300, '<Click to tick Website'), (1031, 300, '<Click to tick Landing Pages'), (420, 173, 'Click to reopen the setup wizard'), (961, 576, '<Click Apply products')],
 'studio-overview': [(471, 338, 'Click Next to go to the next step')],
 'studio-palette': [(412, 510, 'Click here to type a colour code'), (231, 480, 'Color Palette')],
 'studio-website': [(1312, 126, '<Click here to convert to a static website'), (874, 239, 'Click here to create or edit the layout')],
 'static-website': [(541, 304, 'Click here to start the conversion'), (300, 444, 'Click to set the sitemap address'), (300, 480, 'Click to set up forms')],
 'landing-pages': [(1336, 119, '<Click here to add a new landing page'), (420, 573, 'Click here to use this template'), (426, 617, 'Click View template to preview it')],
 'pages': [(385, 361, 'Click Edit to change this page'), (511, 361, 'Click Duplicate to copy it'), (1146, 230, '<Click here to generate content with AI')],
 'navigation': [(408, 297, 'Click a tab: header or footer menu'), (870, 691, 'Click Add after typing a custom page name')],
 'sections': [(550, 244, 'Click a section type to build it')],
 'membership': [(1336, 119, '<Click here to add a member'), (1174, 119, 'Export'), (160, 679, 'Click Members to see everyone')],
 'users': [(647, 174, 'Click here to search users'), (1336, 107, '<Click here to add a user'), (1140, 303, 'Click to edit')],
 'roles': [(1336, 107, '<Click here to create a role'), (1251, 239, 'Click to edit a role')],
 'identity-start': [(235, 412, 'Click Identity under Admin Settings'), (1006, 310, '<Click here to type the application name'), (1006, 416, '<Click here to set the browser tab title'),
                    (1006, 520, '<Click here to describe your business'), (553, 637, 'Click Replace to upload your logo'), (553, 746, 'Click Replace to upload a favicon')],
 'modules-start': [(231, 200, 'Click Modules in the left menu'), (583, 137, 'Click here to search for a module'), (796, 348, 'Fresh install: click Install, confirm, then Enable'), (1044, 224, '<Status badge')],
 'brands-start': [(216, 415, 'Click Brands in the left menu'), (1100, 202, 'Click here to open Landing Pages')],
 'landing-start': [(1468, 56, '<Need a fully custom page? Click New landing page'), (190, 570, 'Click here to use this ready-made design')],
 'new-landing-start': [(547, 179, '<Click here to type the page name'), (547, 262, '<Click here to edit the web address (slug)'), (547, 465, '<Template you picked. Click another to change it'), (495, 786, '<Click Create and edit to open the editor')],
 'create-btn': [(268, 68, 'Click Create and edit')],
 'editor-start': [(245, 112, 'Four tabs: Section (add), Reorder, Style, Content'), (245, 300, 'Click a section to add it to the page'),
                  (1000, 400, 'Click any text or picture on the page to select it'), (1863, 62, '<Click Save to keep your changes')],
 'save-btn': [(92, 66, '<Click Save')],
 'convert-start': [(338, 500, '<Click Convert to build the static files')],
 'brands-web': [(216, 415, 'Click Brands in the left menu'), (808, 202, '<Click Web app to open the Studio')],
 'typography': [(1295, 372, '<Tick the heading font you want'), (1295, 590, '<Tick the body font you want'), (1087, 440, '<Or type a Google Font name, then click Add'),
                 (892, 822, '<Click Save'), (1295, 822, '<Click Next: Typography')],
 'font-settings': [(472, 364, 'Click a box to change a size or spacing'), (1100, 289, 'Live preview of your fonts')],
 'button-styles': [(560, 327, 'Click a card to choose your button style')],
 'dashboard': [(1336, 301, '<Click Manage projects to switch project'), (347, 530, 'Click a shortcut to jump straight there'), (130, 85, 'Dashboard'), (130, 125, 'Click Documents to open these guides')],
 'documents': [(690, 290, 'Click a guide to open it as a PDF in a new tab'), (1150, 290, '<Installation and flow guides')],
 'activity-log': [(455, 173, '<Click here to filter by person'), (643, 173, 'Click here to filter by module'), (842, 173, 'Pick a start date'), (1022, 173, '<Pick an end date')],
 'modules-themes': [(583, 185, 'Type the module name here'), (388, 376, 'A fresh install shows Install here: click it'), (663, 272, '<Status badge')],
 'modules-page-editor': [(583, 185, 'Type the module name here'), (388, 396, 'A fresh install shows Install here: click it'), (663, 272, '<Status badge')],
 'modules-membership': [(583, 185, 'Type the module name here'), (388, 396, 'A fresh install shows Install here: click it'), (663, 272, '<Status badge')],
 'modules-int-landing': [(583, 185, 'Type the module name here'), (1336, 184, '<Show internal is switched on'), (824, 396, 'A fresh install shows Install here: click it')],
 'modules-int-templates': [(583, 185, 'Type the module name here'), (1336, 184, '<Show internal is switched on'), (824, 396, 'A fresh install shows Install here: click it')],
 'modules-internal': [(583, 185, 'Click here to search all 37 modules'), (1336, 184, '<Show internal is switched on')],
}

SHOT_NOTE = "> Screenshots are from a running KDL OS install where these modules are already enabled, so cards show **Enabled** and **Disable**. On a fresh install the same cards show **Available** with an **Install** button (see the card mockup in Part C)."

PREREQ = """## Part A. Get the project running

### A1. Install three tools
| Install | From | Check |
|---|---|---|
| **Git** | https://git-scm.com | `git --version` |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | `docker --version` |
| **OpenSSL** | already on Mac and Linux | `openssl version` |

Start Docker Desktop and wait until it says **running**. Then open Docker Desktop > Settings > Resources > Memory and set **8 GB**.

> Windows: first install WSL (PowerShell as administrator: `wsl --install`, restart), install Docker Desktop, switch on WSL integration for Ubuntu, and type every command below in the **Ubuntu** window.

### A2. Clone the project
```
git clone https://github.com/F9info/kdl-os.git
cd kdl-os
```
Stay inside the `kdl-os` folder for every command that follows.

### A3. Create the settings file (.env)
Paste the whole block into the terminal. It writes `.env` with fresh random secrets.
```
PG_PASS=$(openssl rand -hex 16)
REDIS_PASS=$(openssl rand -hex 16)
MINIO_PASS=$(openssl rand -hex 16)
cat > .env <<EOF
NODE_ENV=development
APP_PORT=4000
FRONTEND_URL=http://localhost
BACKEND_URL=http://localhost:4000
AI_SERVICES_URL=http://localhost:5000
CORS_ORIGIN=http://localhost,http://localhost:3000,http://localhost:3001
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$PG_PASS
POSTGRES_DB=kdl_db
DATABASE_URL=postgresql://postgres:$PG_PASS@localhost:5433/kdl_db
REDIS_PASSWORD=$REDIS_PASS
REDIS_URL=redis://:$REDIS_PASS@localhost:6380
MINIO_ROOT_USER=kdl_minio
MINIO_ROOT_PASSWORD=$MINIO_PASS
MINIO_ACCESS_KEY=kdl_minio
MINIO_SECRET_KEY=$MINIO_PASS
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_BUCKET=kdl-media
MEILISEARCH_HOST=http://localhost:7700
MEILI_MASTER_KEY=$(openssl rand -hex 24)
MEILISEARCH_API_KEY=replace-after-first-boot
MEILI_SEARCH_API_KEY=replace-after-first-boot
CHROMADB_URL=http://localhost:8000
ANTHROPIC_API_KEY=local
OPENROUTER_API_KEY=local
EOF
chmod 600 .env
```
Check with `ls -la .env` (about 2 KB). Never share or upload this file. No accounts or API keys are needed to run KDL OS. AI features need real keys later.

### A4. Build and start everything
```
docker compose up -d --build
docker compose ps
```
The first build takes **10 to 20 minutes**; later starts take seconds. Wait until `backend` shows **healthy** (about a minute). The database migrations run by themselves when the backend starts.

| Service | Address |
|---|---|
| App through nginx (use this) | http://localhost |
| Frontend directly | http://localhost:3001 |
| Backend API | http://localhost:4000 |
| MinIO console (files) | http://localhost:9003 |
| MeiliSearch (search) | http://localhost:7700 |

### A5. Create the admin user
```
docker compose exec backend node prisma/seed.js
```
You should see `Seeded admin: admin@kdl.com`.

### A6. Sign in
Open **http://localhost/login**. Email `admin@kdl.com`, password `kdl-dev-seed-password`. KDL OS asks you to choose a new password on first sign-in.
![The sign-in screen](login)
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`."""

SIGNIN = """## Step 1. Sign in
> KDL OS must already be installed and running. If not, follow the **Installation** guide first (Admin > Documents > Installation).

Open **http://localhost/login**. Email `admin@kdl.com`, password `kdl-dev-seed-password`. KDL OS asks you to choose a new password on first sign-in.
![The sign-in screen](login)
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`."""

IDENTITY_START = """## Step 2. Open Application Identity
After you sign in, open **Admin Settings > Identity** in the left menu. This is where the application name, logo and favicon are set.
![Admin Settings > Identity](identity-start)"""

MODULES_START = """## Step 3. Open Modules, install and enable Frontend
Click **Modules** in the left menu. Find the **Frontend** card (use the search box if you need to). On a fresh install the card shows **Install**: click it and confirm, then click **Enable** and confirm. The badge changes to **Enabled**.
![Modules: the Frontend card](modules-start)"""

BRANDS_START = """## Step 4. Click Brands and select Landing Pages
Click **Frontend > Brands** in the left menu. Three cards appear: Web app, Landing Pages and Collateral. Click the **Landing Pages** card to open it.
![Brands: click the Landing Pages card](brands-start)"""

LANDING_START = """## Step 5. Choose a landing page template
Open **Landing Pages** (http://localhost:3001/admin/landing-pages). Ready-made designs are already listed under **Start from a template**: Lead generation, Product launch, Event or webinar and Special offer. Click **View template** to preview one, then click **Use this template** to start from it. Every word, picture and colour can be changed afterwards in the editor.

If you need a fully custom page, click **New landing page** instead. This guide follows the template route.
![Landing Pages: start from a template](landing-start)"""

NEW_LANDING_START = """## Step 6. Name the page and create it
A **New landing page** window opens with the template you picked already selected. Fill in two things, then continue:
- **Name**: the title you see in the admin, for example "Summer offer".
- **Slug**: the last part of the public web address. The page will be published at `/p/<slug>`; the full address is shown under the field.

To use a different design, click another option under **Template** (choose **Blank** for a page with only a header and footer). Then click **Create and edit** to open the page in the editor.
![New landing page window](new-landing-start)"""

EDITOR_START = """## Step 7. Click Create and edit, then change the page
Click **Create and edit**. The page opens in the editor.
![Click Create and edit](create-btn)

Change the page like this:
- **Content and images:** click a block on the page, then use the **Content** tab to change its text, replace its picture and edit its links (for example a button's address).
- **Look (UI):** use the **Style** tab for colours, fonts and spacing.
- **Sections:** use the **Section** tab to add sections from the list (Hero Slider, Welcome, Services and more) and the **Reorder** tab to move them. This is the section builder.
- **SEO:** the editor has no SEO button. Set the page title and description defaults in **Admin Settings > SEO**.
- Click **Preview** to see the page, then **Save**. The page stays a **Draft** until you publish it.
![The landing page editor](editor-start)"""

SAVE_START = """## Step 8. After editing, click Save
When you have finished all your changes, click **Save** at the top right of the editor. Your changes are stored and the page stays a **Draft** until you publish it. Then go back to the **Landing Pages** list (http://localhost:3001/admin/landing-pages).
![Click Save](save-btn)"""

CONVERT_START = """## Step 9. Click Convert
In the **Landing Pages** list your page now has three buttons: **Edit**, **Preview** and **Convert**. Click **Convert**. KDL OS builds your page as plain static files. This takes a few minutes; you can stay on the page. When it finishes, the card says **Moved to its folder. Ready to host.** and shows the folder name.
![Landing Pages: click Convert](convert-start)"""

GITHUB_START = """## Step 10. Copy the static files and host them on GitHub
The static files are in the folder shown on the card (inside your project, under `frontend/projects/`, in the `out` folder). You can also click **Download as .zip** on the card and unzip it. The files inside, with `index.html` at the top, are your finished landing page. Edit the page, Save and Convert again at any time: the same folder is updated.

To host the files on GitHub:
1. On GitHub create a new empty repository, for example `my-landing`.
2. Copy the files from the folder into a new folder, open a terminal in it, and run (use your own username and repository name):
```
git init
git add .
git commit -m "Landing page"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/my-landing.git
git push -u origin main
```
3. On GitHub open the repository, then **Settings > Pages**. Under **Build and deployment** choose **Deploy from a branch**, pick the **main** branch and the **/ (root)** folder, then **Save**.
4. After a minute your page is live at `https://YOUR-USERNAME.github.io/my-landing/`."""

NOTES_START = """## Notes: Changes after the page is live
This is not a step. Use it later, when a client asks for a change some days after you hosted the files.

1. Open the **Landing Pages** list directly: http://localhost:3001/admin/landing-pages?finished=1
2. Find the page and click **Edit**. The editor opens.
3. Make the changes with the section builder (text, images, links, sections, style).
4. Click **Save**.
5. Go back to the **Landing Pages** list and click **Convert** again. The new files are written into the **same folder** as before, replacing the old files.
6. Copy the updated files into your GitHub repository folder (replace the old files), then push them to the server:
```
git add .
git commit -m "Update landing page"
git push
```
7. Wait a minute. GitHub Pages shows the updated page at the same address.

> You never create the page again. Edit, Save, Convert and push is the whole routine for every change."""

WIZARD = """## Part B. First-run setup wizard
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

> Missed or dismissed the wizard? Company details live in **Admin Settings > Identity**; products live at **/admin/settings/products**. Nothing is deleted when you turn a product off."""

IDENTITY = """### Set the company details once
**Admin Settings > Identity**. Name, logos, favicon, brand colours, contact details, social links. Everything else reads from here.
![Admin Settings > Identity](identity)"""

THEMES = """### Pick the look
**Admin Settings > Themes**. Choose **Website** (public site) or **Admin app** (this panel) at the top, **Simple** for colours and fonts or **Advanced** for every token, then **Publish**.
![Admin Settings > Themes](themes)"""

MODULES_INTRO = """## Part C. Install and enable the modules
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
"""

def modules_block(on, optional, off, kind="web"):
    steps = {
     "admin": """### C4. Do this for the Admin only flow
1. Check the padlocked core cards are **Enabled**: Auth, Application Identity, Media, Modules, Settings, User Management, Users. Nothing to install.
2. Optional: **Themes** (to restyle the admin), **Notifications**, **Integrations**, **Membership**. For each one found by search: **Install**, confirm, **Enable**, confirm.
![Search "themes", then Install and Enable](modules-themes)
3. Leave the public-site modules off. If **Frontend** shows **Enabled** and you do not want website menus, press **Disable** and confirm. Pages and data stay.""",
     "landing": """### C4. Do this for the Landing page flow
1. Search **page editor**. On the **Page Editor UI** card press **Install**, confirm, then **Enable**, confirm.
![Search "page editor"](modules-page-editor)
2. Search **themes**. On **Themes** press **Install**, confirm, **Enable**, confirm.
![Search "themes"](modules-themes)
3. Press **Show internal**, search **landing**. On the **Landing Pages** card press **Install**, confirm, **Enable**, confirm. Forms (which landing pages need) and the Page Editor are installed for you.
![Show internal, search "landing": the Landing Pages card](modules-int-landing)
4. Refresh. **Frontend > Brands** (and **/admin/landing-pages**) now exist. Leave Website, Templates, Sectors, Catalog and Work off.""",
     "web": """### C4. Do this for the website flow
1. Search **frontend**. On the **Frontend** card press **Install**, confirm, **Enable**, confirm. One click installs the whole bundle: Website, Forms, Landing Pages, FAQ, Gallery, Testimonials, Team, Catalog, Work, Sectors and Projects Content.
![Search "frontend": the bundle card](modules-frontend)
2. Search **page editor**. **Page Editor UI**: **Install**, **Enable**.
![Search "page editor"](modules-page-editor)
3. Search **themes**. **Themes**: **Install**, **Enable**.
![Search "themes"](modules-themes)
4. Press **Show internal**, search **templates**. On **Templates** (the Studio) press **Install**, then **Enable**. Projects, Design Tokens, Brand Assets, Collateral and Credits come with it.
![Show internal, search "templates": the Studio module](modules-int-templates)
5. Refresh. The sidebar now has a **Frontend** group (Brands, Website Details, Color Palette, Navigation, Layouts, Pages, Sections) plus Sectors, Catalog, Work, FAQ and the rest.
6. Landing Pages came with Frontend. Its menu stays hidden until you also tick the **Landing Pages** product (Admin Settings > Products).""",
    }
    steps["full"] = steps["web"] + """
7. Search **membership**. On **Membership**: **Install**, **Enable**. A **Membership** group (Overview, Plans, Members, Payments, Settings, Social login and more) appears; disabling it hides the whole group.
![Search "membership"](modules-membership)"""
    return f"""{MODULES_INTRO}
### Modules this flow needs
| | Modules |
|---|---|
| **Must be on** | {on} |
| **Optional** | {optional} |
| **Can stay off** | {off} |

{steps[kind]}

### C5. The shortcut: let KDL OS do it from the products you tick
The Setup wizard (Part B) and **Admin Settings > Products** (**/admin/settings/products**) enable every module the products need, in dependency order, and show **What this selection does** before you press **Apply products**. Use the Modules screen when you want one module at a time or need to switch something off.
![Admin Settings > Products](products)
"""

ADMIN_AREA = """### Run the admin
| Need | Screen |
|---|---|
| Add and suspend people | **Users** |
| Decide who can do what | **Access Control > Roles / Permissions** (Super Admin, Developer, Admin, User) |
| See who did what | **Access Control > Activity Log** |
| Alerts | **Notifications** (bell, top right) |
| Connect outside tools | **Integrations** |
| Files and images | **Media > Library**; storage under **Settings > Storage** |
![Users](users)
![Access Control > Roles](roles)
![Activity Log](activity-log)"""

STUDIO = """### D1. Open the Studio (Template Engine)
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
| Entry text, menus | Edit in place, no re-run |"""

LANDING = """### Build a landing page
1. **Frontend > Brands**, choose **Landing Pages** (or open **/admin/landing-pages**). Four ready designs: Lead generation, Product launch, Event or webinar, Special offer.
2. **Use this template** (or **View template** first). Name it, **Create and edit**.
3. In the editor change text, images, buttons and the form block. **Insert block** adds sections.
4. **Save**. The finished pages list shows each page with **Preview** and **Convert**.
5. **Publish** when the checks pass. The page is public at `/p/<slug>`.
6. Extras: **Duplicate**, **Rename**, per-page branding, **Save as template**.
7. Forms: create under **Frontend > Brands > Forms**, then pick it in the Contact Form block. Messages arrive in the admin.
![Landing Pages: templates and your pages](landing-pages)"""

STATIC = """### Convert to a static website
Plain files (HTML, CSS, images) you can host anywhere with no server.
1. Finish and **publish** the website pages first; the export holds the published pages.
2. **Frontend > Convert to Static Website** (button at the top of the Studio, or **/admin/static-website**).
3. Optional **Website address** (https://www.example.com): adds `sitemap.xml` and canonical addresses. `robots.txt`, page titles, descriptions and share tags are always included.
4. Optional **Web app address** (https only): a static site has no server, so forms cannot save by themselves. Empty = each form becomes your contact email and phone from Identity. With your public Web app address the forms, menus and FAQ keep working through it.
5. **Convert to Static Website**. Progress: collect pages, menus, brand and images; build the files; ready to host (a few minutes).
6. **Download as .zip**, unzip, upload to any host (Netlify, S3, GitHub Pages, nginx).
7. Changed something? **Convert again with the latest changes** and replace the files on your host.
![Frontend > Convert to Static Website](static-website)
Landing pages convert one by one from their own **Convert** button, each into its own folder."""

MEMBERSHIP = """### Optional: Membership
Turn on **Membership** in Modules for plans, members, subscriptions, payments, invoices and members-only access rules. It adds its own sidebar group, and **Social login** lives inside it. Disable Membership and the whole group disappears.
![Membership overview](membership)"""

VERIFY = """## Check it worked
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
| Account locked / 429 | Wait a minute, or `docker compose restart backend`. |"""

def guide(flow, goal, gets, products, steps, modules, extra="", signin_extra="", cover=True, only_signin=False):
    head = f"""# {flow}

**Goal:** {goal}

**You get:** {gets}

**Products to tick:** {products}

[[flow: Sign in | Setup wizard | Enable modules | Build | Publish]]

{SHOT_NOTE}

""" if cover else ""
    if only_signin: return f"{SIGNIN}\n\n{signin_extra}"
    return head + f"""{SIGNIN}

{signin_extra}{WIZARD}

{modules}

## Part D. Build it
{steps}
{extra}
{VERIFY}
"""

M_ADMIN = "Auth, Application Identity, Settings, Users, User Management (Roles / Permissions), Media, Modules (all core, already on)"
M_WEB = "Frontend (bundle), Page Editor UI, Themes, Templates (the Studio) and what they bring"
M_LAND = "Landing Pages (brings Forms), Page Editor UI, Themes"
OPT_CONTENT = "Membership, Notifications, Integrations"

ADMIN_STEPS = """## Step 2. Fill in the setup wizard
On a fresh install a **Setup wizard** opens over the dashboard. Step 1 asks for your company: click each field and type the **Company name**, application name, email, phone and address, and click **Replace** to add a logo and favicon. Click **Next**.

Step 2 asks what you are building. For an admin-only application leave every card **unticked** and click **Next**. KDL OS records "no website" and stops asking. You can change these details any time in **Admin Settings > Identity**.
![Setup wizard, step 1](wizard-1)

## Step 3. Pick the look of the admin
Open **Admin Settings > Themes**. On the **Simple** tab click **Light** or **Dark**, click a ready-made look (Ocean, Forest, Sunset or Slate), or click a colour swatch to change a colour. Use **Advanced** for every design token, then click **Publish**.
![Admin Settings > Themes](themes)

## Step 4. Check the Modules (optional)
Open **Modules** in the left menu. The core modules (the ones with a padlock) are always on. If you need more, search for the module, click **Install**, confirm, then click **Enable** and confirm. Useful extras for an admin-only setup: **Themes**, **Notifications**, **Integrations**, **Membership**. Leave **Frontend**, **Landing Pages** and **Templates** off.
![Modules](modules)

## Step 5. Add your users
Open **Users** and click **Add user**. Type the person's details and save. Use the search box to find people, and the icons on each row to edit a user or reset a password.
![Users](users)

## Step 6. Give each person a role
Open **Access Control > Roles**. The built-in roles are Super Admin, Developer, Admin and User. Click **Create role** to make your own, and the pencil to edit one. Then give each user the role that fits.
![Access Control > Roles](roles)

## Step 7. See who did what
Open **Access Control > Activity Log**. Every sign-in and change is listed with the person, the module, the action and the date. Use the filters at the top to narrow it down.
![Activity Log](activity-log)

## Notes: Changing things later
This is not a step. Use it when something changes.
- **Company details, logo, favicon:** Admin Settings > Identity.
- **New staff member:** Users > Add user, then choose their role in Access Control > Roles.
- **Turn on another module:** Modules, search, Install, Enable. Data is never deleted when a module is turned off.
- **Add a public website or landing pages later:** Admin Settings > Products, tick the product and click **Apply products**. Nothing you already built is lost."""


def number_steps(*blocks):
    """Join step blocks, numbering '## Step N.' headings from 2 (Step 1 is Sign in); 'Notes' blocks stay unnumbered."""
    out, n = [], 2
    for b in blocks:
        if b.startswith("## Step"):
            b = re.sub(r"^## Step \d+\.", f"## Step {n}.", b, count=1); n += 1
        out.append(b)
    return "\n\n".join(out) + "\n"

W_WEB = """## Step 0. Fill in the setup wizard
On a fresh install a **Setup wizard** opens over the dashboard. Step 1 asks for your company: click each field and type the **Company name**, application name, email, phone and address, and click **Replace** to add a logo and favicon. Click **Next**.

Step 2 asks what you are building. Click the **Website** card to tick it{extra}, then click **Next**. If the next window offers a starter website, click **Yes, create my website**: KDL OS builds a ready 5-page site (Home, About, Services, Contact, FAQ) that you can edit.
![Setup wizard, step 1](wizard-1)"""

ST_OPEN = """## Step 0. Open the Studio
Click **Frontend > Brands** in the left menu, then click the **Web app** card. This opens the Studio for your website. The first time, click **Start Studio run**. Tabs along the top: Overview, Color Palette and Website.
![Brands: open the Web app](brands-web)"""

ST_OVERVIEW = """## Step 0. Studio Overview: logo and company details
Upload your logo (svg, png, jpeg or webp), check the company and contact details, then click **Next**. Use **Edit in Identity** to change the details. The logo also becomes the admin logo.
![Studio: Overview](studio-overview)"""

ST_PALETTE = """## Step 0. Color Palette
Four brand colours are taken from your logo: Primary, Secondary, Tertiary and Quaternary. Keep them, or click a colour box and type a new code, click **Pick from logo** or **Randomize**. Then click **Submit palette**. The colours become the website's design tokens.
![Studio: Color Palette](studio-palette)"""

ST_WEBSITE = """## Step 0. Website stage: layout
Set typography and fonts. Click **Create/Edit layout** to choose the Top header, Header and Footer. The header and footer of **Home** are shared by every public page.
![Studio: Website stage](studio-website)"""

ST_TYPO = """## Step 0. Typography: choose the fonts
The Website stage opens on **Typography**. Under **Heading** tick the font for titles, and under **Body** tick the font for normal text. To use another font, type its Google Font name (for example Roboto) and click **Add**, or click **Upload** to add your own font file. Click **Save**, then click **Next: Typography** to continue.
![Website stage: Typography](typography)"""

ST_FONTS = """## Step 0. Font settings
Fine-tune the type scale: for each element (H1 to H6, Lead paragraph, Body, Small, Nav link, Button) change the font size, family, weight, line height and letter spacing. The **Examples** panel on the right shows the result live. The defaults are a good start. Scroll down and click **Next: Buttons and form fields**.
![Website stage: Font settings](font-settings)"""

ST_STYLES = """## Step 0. Buttons and form fields
Click one card under **Button style** (Solid, Airy pill, Classic, Leaf, Outline, Soft tint and more), then scroll down and click one card under **Form field style**. Every button and every form on your website uses them, in your theme's colours. The admin screens are not changed. Click **Next** to continue to Navigation.
![Website stage: Button style](button-styles)"""

ST_NAV = """## Step 0. Choose the menu pages
Open **Frontend > Navigation**. Click the page names you want in the menu (About, Services, Portfolio, Blog, Contact and so on), or type a custom page and click **Add**. Use the **Header menu** and **Footer menu** tabs. One page is created for every menu item, plus Home.
![Frontend > Navigation](navigation)"""

ST_PAGES = """## Step 0. Edit and publish the pages
Open **Frontend > Pages**. Click **Edit** on a page to change its text, images and links in the section builder, then **Save** and **Publish**. Publish stops real problems (an empty page, a missing title, a broken link) and only suggests the rest. Click **Duplicate** to copy a page. **Frontend > Sections** holds reusable sections.
![Frontend > Pages](pages)"""

ST_LIVE = """## Step 0. Check the live website
Open http://localhost in a private window, signed out. Check that the header and footer match Home on every page and that every menu link opens a page. Pages are public at `/` and at `/p/<slug>`."""

ST_STATIC = """## Step 0. Convert to a static website
Static files (HTML, CSS and images) can be hosted anywhere with no server. Publish your pages first, then click **Convert to Static Website** (the button at the top of the Studio, or http://localhost:3001/admin/static-website).

Optional: type your **Website address** (for example https://www.example.com) to add a sitemap. Type your **Web app address** (https only) if forms must keep working; if you leave it empty, forms show your contact email and phone. Click **Convert to Static Website** and wait a few minutes until the card says it is ready.
![Frontend > Convert to Static Website](static-website)"""

ST_HOST = """## Step 0. Download the files and host them on GitHub
Click **Download as .zip** on the same page and unzip it. The files inside, with `index.html` at the top, are your finished website.

1. On GitHub create a new empty repository, for example `my-website`.
2. Put the files in a new folder, open a terminal in it, and run (use your own username and repository name):
```
git init
git add .
git commit -m "Website"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/my-website.git
git push -u origin main
```
3. On GitHub open **Settings > Pages**, choose **Deploy from a branch**, pick **main** and the **/ (root)** folder, then **Save**.
4. After a minute your website is live at `https://YOUR-USERNAME.github.io/my-website/`."""

MEM_ON = """## Step 0. Turn on Membership (optional)
Open **Modules**, search **membership**, click **Install** and confirm, then **Enable** and confirm. A **Membership** group appears in the left menu with Overview, Plans, Members, Payments and Social login. Disable the module and the whole group disappears.
![Search membership](modules-membership)
![Membership overview](membership)"""

def notes(items):
    return "## Notes: Changing things later\nThis is not a step. Use it when something changes.\n" + "\n".join("- " + i for i in items)

N_WEB = ["**Text, images, links:** Frontend > Pages, Edit, Save, Publish. No re-run is needed.",
         "**Menus:** Frontend > Navigation.",
         "**Header, top bar or footer:** Studio > Layouts > Create/Edit layout.",
         "**Colours or fonts:** Studio > Color Palette, Submit palette."]
N_STATIC = ["After any change: publish, then click **Convert to Static Website** again, replace the files in your GitHub folder, then `git add .`, `git commit -m \"Update\"` and `git push`. The static copy never updates itself."]
N_LAND = ["**Change a landing page:** open http://localhost:3001/admin/landing-pages?finished=1, click **Edit**, change it in the section builder, **Save**."]
N_LAND_STATIC = ["**Convert a landing page again:** click **Convert** on its card. The new files replace the same folder; copy them into your GitHub folder and push."]


DOCS = {
 'installation': ("Installation",
   "Install KDL OS, run it and sign in for the first time.",
   "# Installation\n\n**Goal:** get KDL OS running on your computer and sign in as admin.\n\n"
   "[[flow: Clone | Configure .env | Run Docker | Create admin | Sign in]]\n\n" + PREREQ.replace("## Part A. Get the project running", "## Install KDL OS", 1)
   + "\n\nNext: open the guide for the flow you chose (Admin > Documents).\n"),
 '00-choose-your-flow': ("Choose your flow",
   "Pick the right guide for what you want to build.",
   """# Choose your flow

**Goal:** match what you want to build with the step-by-step guide that covers it from clone to publish.

[[flow: Pick a flow | Open its guide | Clone and run | Enable modules | Build | Publish]]

## Pick your combination
| You want | Products to tick | Guide |
|---|---|---|
| Only the internal admin app | Admin (always on) | 01 Admin only |
| Only campaign pages | Landing Pages | 02 Landing page only |
| A website hosted anywhere as plain files | Website, then Convert | 03 Static website only |
| A live, editable website | Website | 04 Web app and admin |
| A live website and campaign pages | Website + Landing Pages | 05 Web app, landing and admin |
| Plain-file website plus campaign pages | Website + Landing Pages, then Convert | 06 Static website and landing |
| Live site that is also exported as plain files | Website, then Convert | 07 Web app and static website |
| Everything, with optional Membership | Website + Landing Pages | 08 Full platform |

Admin is always on, so "only landing page" still includes the admin you sign in to.

## How the guides work
1. Not installed yet? Open the **Installation** guide first (Git, Docker, `.env`, `docker compose up`, create the admin).
2. Every other guide starts at **Step 1. Sign in** and then follows one screen per page, with red "click here" labels on each screenshot.
3. The last page of each guide is a **Notes** page: what to do when something changes later.

## The products at a glance
| Product | Turns on | Typical use |
|---|---|---|
| **Admin** (always on) | Users, Roles, Settings, Identity, Media | Internal business app |
| **Website** | Frontend, Website, Page Editor UI, Themes, Media | Multi-page company site |
| **Landing Pages** | Landing Pages, Page Editor UI, Themes, Media | Campaign and product pages |

## How to decide quickly
1. People, roles and settings only? **Admin only**.
2. One or a few campaign pages? **Landing**.
3. A multi-page site with live forms and menus? **Web app**.
4. Cheap serverless hosting? **Static** (built in the Web app, then exported).
5. Unsure? Start with **Web app and admin**. Landing or static can be added later without losing data.

## Changing your mind later
**/admin/settings/products**: change the ticks and apply. Turning a product off hides menu entries; it never deletes pages, users or files.
![Products screen](products)
![Documents screen: all guides open from here](documents)
"""),
 '01-admin-only': ("Flow 1: Admin only",
   "Run the internal business application with no public website.",
   guide("Flow 1: Admin only", "Run the internal business application with no public website.", "", "", "", "",
     signin_extra=ADMIN_STEPS, cover=False, only_signin=True)),
 '02-landing-only': ("Flow 2: Landing page only (with admin)",
   "Publish campaign pages without a full website.",
   guide("Flow 2: Landing page only (with admin)", "Publish campaign pages without a full website.",
     "branded landing pages at `/p/<slug>` with a working form, plus the admin that runs them.",
     "Landing Pages (leave Website off). There is no starter-website step.",
     IDENTITY + "\n\n" + THEMES + "\n\n" + LANDING + "\n\n" + ADMIN_AREA,
     signin_extra=IDENTITY_START + "\n\n" + MODULES_START + "\n\n" + BRANDS_START + "\n\n" + LANDING_START + "\n\n" + NEW_LANDING_START + "\n\n" + EDITOR_START + "\n\n" + SAVE_START + "\n\n" + CONVERT_START + "\n\n" + GITHUB_START + "\n\n" + NOTES_START + "\n", cover=False, only_signin=True,
     modules=modules_block(M_LAND, "Notifications, Membership", "Frontend bundle, Website, Templates, Sectors, Catalog, Work, FAQ, Team", "landing")).replace('## Sign in', '## Step 1. Sign in').replace('## Open Application Identity', '## Step 2. Open Application Identity')),
 '03-static-website-only': ("Flow 3: Static website only (with admin)",
   "Ship a website as plain files hosted anywhere, with no live web app in front of visitors.",
   guide("Flow 3: Static website only (with admin)", "Ship a website as plain files hosted anywhere, with no live web app in front of visitors.", "", "", "", "",
     signin_extra=number_steps(IDENTITY_START, MODULES_START, ST_OPEN, ST_PALETTE, ST_TYPO, ST_FONTS, ST_STYLES, ST_NAV, ST_WEBSITE, ST_PAGES, ST_STATIC, ST_HOST, notes(N_WEB+N_STATIC)), cover=False, only_signin=True)),
 '04-webapp-admin': ("Flow 4: Web app and admin",
   "Run a live, editable website served from this installation.",
   guide("Flow 4: Web app and admin", "Run a live, editable website served from this installation.", "", "", "", "",
     signin_extra=number_steps(IDENTITY_START, MODULES_START, ST_OPEN, ST_PALETTE, ST_TYPO, ST_FONTS, ST_STYLES, ST_NAV, ST_WEBSITE, ST_PAGES, ST_LIVE, notes(N_WEB)), cover=False, only_signin=True)),
 '05-webapp-landing-admin': ("Flow 5: Web app, landing pages and admin",
   "A full website plus separate campaign pages under one admin.",
   guide("Flow 5: Web app, landing pages and admin", "A full website plus separate campaign pages under one admin.", "", "", "", "",
     signin_extra=number_steps(IDENTITY_START, MODULES_START, ST_OPEN, ST_PALETTE, ST_TYPO, ST_FONTS, ST_STYLES, ST_NAV, ST_WEBSITE, ST_PAGES, BRANDS_START, LANDING_START, NEW_LANDING_START, EDITOR_START, SAVE_START, ST_LIVE, notes(N_WEB+N_LAND)), cover=False, only_signin=True)),
 '06-static-landing': ("Flow 6: Static website and landing pages",
   "Host everything as plain files and keep campaign pages separate.",
   guide("Flow 6: Static website and landing pages", "Host everything as plain files and keep campaign pages separate.", "", "", "", "",
     signin_extra=number_steps(IDENTITY_START, MODULES_START, ST_OPEN, ST_PALETTE, ST_TYPO, ST_FONTS, ST_STYLES, ST_NAV, ST_WEBSITE, ST_PAGES, BRANDS_START, LANDING_START, NEW_LANDING_START, EDITOR_START, SAVE_START, CONVERT_START, ST_STATIC, ST_HOST, notes(N_WEB+N_STATIC+N_LAND+N_LAND_STATIC)), cover=False, only_signin=True)),
 '07-webapp-static': ("Flow 7: Web app and static website together",
   "Keep the live site and also publish a plain-file copy.",
   guide("Flow 7: Web app and static website together", "Keep the live site and also publish a plain-file copy.", "", "", "", "",
     signin_extra=number_steps(IDENTITY_START, MODULES_START, ST_OPEN, ST_PALETTE, ST_TYPO, ST_FONTS, ST_STYLES, ST_NAV, ST_WEBSITE, ST_PAGES, ST_LIVE, ST_STATIC, ST_HOST, notes(N_WEB+N_STATIC)), cover=False, only_signin=True)),
 '08-full-platform': ("Flow 8: Full platform",
   "Website, landing pages, static export, membership and admin, all enabled.",
   guide("Flow 8: Full platform", "Website, landing pages, static export, membership and admin, all enabled.", "", "", "", "",
     signin_extra=number_steps(IDENTITY_START, MODULES_START, ST_OPEN, ST_PALETTE, ST_TYPO, ST_FONTS, ST_STYLES, ST_NAV, ST_WEBSITE, ST_PAGES, BRANDS_START, LANDING_START, NEW_LANDING_START, EDITOR_START, SAVE_START, MEM_ON, ST_LIVE, ST_STATIC, ST_HOST, notes(N_WEB+N_LAND+N_STATIC)), cover=False, only_signin=True)),
}
