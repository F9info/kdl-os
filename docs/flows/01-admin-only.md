# Flow 1: Admin only

**Goal:** run the internal business application with no public website.

**You get:** a secured admin app: users, roles, company identity, themes, notifications and activity log.

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

## Tick only Admin
In the Setup wizard, Step 2 of 2, leave **Website** and **Landing Pages** off and press **Apply products**. The wizard records "no website" and stops asking. Public-site menu entries stay hidden.

## Check it worked
- Open the public address in a private window, signed out.
- Header, top bar and footer match Home on every page.
- Every menu link opens a page; forms send (Web app) or show your contact details (static).
- Admin sidebar shows only the modules your products need.

