# Flow 1: Admin only

**Goal:** Run the internal business application with no public website.

**You get:** a secured admin app: users, roles, company identity, themes, notifications, files and an activity log.

**Products to tick:** Admin only (leave Website and Landing Pages off). In the wizard, Step 2, press **Next** with no cards ticked; it records "no website" and stops asking.

[[flow: Sign in | Setup wizard | Enable modules | Build | Publish]]

## Sign in
> KDL OS must already be installed and running. If not, follow the **Installation** guide first (Admin > Documents > Installation).

Open **http://localhost/login**. Email `admin@kdl.com`, password `kdl-dev-seed-password`. KDL OS asks you to choose a new password on first sign-in.
![The sign-in screen](login)
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`.

> Screenshots are from a running KDL OS install where these modules are already enabled, so cards show **Enabled** and **Disable**. On a fresh install the same cards show **Available** with an **Install** button (see the card mockup in Part C).

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
| **Must be on** | Auth, Application Identity, Settings, Users, User Management (Roles / Permissions), Media, Modules (all core, already on) |
| **Optional** | Themes (to restyle the admin), Notifications, Integrations, Membership |
| **Can stay off** | Frontend, Landing Pages, Templates, Page Editor UI |

### C4. Do this for the Admin only flow
1. Check the padlocked core cards are **Enabled**: Auth, Application Identity, Media, Modules, Settings, User Management, Users. Nothing to install.
2. Optional: **Themes** (to restyle the admin), **Notifications**, **Integrations**, **Membership**. For each one found by search: **Install**, confirm, **Enable**, confirm.
![Search "themes", then Install and Enable](modules-themes)
3. Leave the public-site modules off. If **Frontend** shows **Enabled** and you do not want website menus, press **Disable** and confirm. Pages and data stay.

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

### Run the admin
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
![Activity Log](activity-log)

### Your dashboard
Public-site menu entries stay hidden because no public product is selected.
![Dashboard](dashboard)

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
