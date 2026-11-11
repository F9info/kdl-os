#!/usr/bin/env python3
"""Writes docs/flows/*.md from the blocks below, then renders each to PDF in
frontend/public/docs/flows/ with headless Chrome. Run: python3 docs/flows/build.py"""
import html, os, re, subprocess, sys, tempfile, json

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'frontend', 'public', 'docs', 'flows')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

SIGNIN = """## 1. Sign in and run the first-time setup
1. Open **http://localhost:3001/login** and sign in with your admin account.
2. On a fresh install the **Setup wizard** opens by itself.
   - **Step 1 of 2: company details.** Name, logo, emails, phones, address. Saved once in **Settings > Identity** and reused everywhere (admin, website, print layouts).
   - **Step 2 of 2: what are you building?** Tick the products you need (see the table below). Admin is always on. The screen shows what each choice turns on before you press **Apply products**.
3. Missed the wizard? Company details live in **Admin Settings > Identity**; products live at **/admin/settings/products**. Turning a product off never deletes data."""

ADMIN = """## Admin application (always included)
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
| Files | **Media > Library**; storage under **Settings > Storage** |"""

WEBAPP = """## Build the website (Web app)
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

**After a change, re-run only what changed:** logo or contacts: save Overview. Navigation: Navigation then Pages. Header or footer design: Layouts. Colours or fonts: Color Palette or Typography, Approval, then re-run Website. Entry text or menus: edit in place."""

LANDING = """## Build a landing page
1. **Frontend > Brands**, choose **Landing Pages** (or open **/admin/landing-pages**).
2. Pick a template and press **Use this template** (or **View template** first). Give the page a name and press **Create and edit**.
3. In the editor change text, images, buttons and the contact form block. Use **Insert block** for more sections and **Sections** for saved ones.
4. **Save**. The finished pages list shows each page with **Preview** and **Convert**.
5. **Publish** when the checks pass. The page is public at `/p/<slug>`.
6. Optional: set the page's own branding (logo, colours), duplicate, rename, or **Save as template**.
7. Forms: create the form under **Frontend > Brands > Forms**, then pick it in the Contact Form block. Messages land in the admin."""

STATIC = """## Convert the website to a static website
A static website is plain files (HTML, CSS, images) you can host anywhere, with no server.
1. Finish and publish the website pages first (see the Web app steps). The export holds the **published** pages.
2. Open **Frontend > Convert to Static Website** (**/admin/static-website**).
3. Optional **Website address** (for example https://www.example.com): adds `sitemap.xml` and canonical addresses. `robots.txt` and each page's title, description and share tags are always included.
4. Optional **Web app address**: a static site has no server, so forms cannot save messages on their own. Leave it empty and each form is replaced by your contact email and phone from Identity. Enter your public Web app address and forms, menus and FAQ keep working through it. It must be an https address.
5. Press **Convert to Static Website**. Progress: collect pages, menus, brand and images; build the files; ready to host. It takes a few minutes.
6. Press **Download as .zip**, unzip, and upload to any host (Netlify, S3, shared hosting, your own nginx).
7. Changed something later? Press **Convert again with the latest changes**.

A landing page converts the same way from its own **Convert** button; each landing page gets its own folder."""

CHECK = """## Check it worked
- Open the public address in a private window, signed out.
- Header, top bar and footer match Home on every page.
- Every menu link opens a page; forms send (Web app) or show your contact details (static).
- Admin sidebar shows only the modules your products need."""

PRODUCTS = """| Product | Turns on | Typical use |
|---|---|---|
| **Admin** (always on) | Users, Roles, Settings, Identity, Media | Internal business app |
| **Website** | Content, Menus, Page builder, Theme engine, Media | Multi-page company site |
| **Landing Pages** | Landing, Page builder, Theme engine, Media | Campaign and product pages |"""

def doc(title, goal, gets, body, extra=''):
    return f"""# {title}

**Goal:** {goal}

**You get:** {gets}

{PRODUCTS}

{body}

{CHECK}
{extra}
"""

DOCS = {
 '00-choose-your-flow': ("Choose your flow", "pick the right guide for what you want to build.",
   "a one-page map from your goal to the matching step-by-step guide.",
   """## Pick your combination
| You want | Products to tick | Guide |
|---|---|---|
| Only the internal admin app | Admin | 01 Admin only |
| Only campaign pages | Admin + Landing Pages | 02 Landing page only |
| A website you host anywhere as plain files | Admin + Website, then Convert | 03 Static website only |
| A live website with the admin | Admin + Website | 04 Web app and admin |
| A live website and campaign pages | Admin + Website + Landing Pages | 05 Web app, landing and admin |
| Plain-file website plus campaign pages | Admin + Website + Landing, then Convert | 06 Static website and landing |
| Live site that is also exported as plain files | Admin + Website, then Convert | 07 Web app and static website |
| Everything | All three | 08 Full platform |

Admin is always on, so "only landing page" still includes the admin you sign in to.

## How to decide quickly
1. Need people, roles and settings only? **Admin only**.
2. Need one or a few campaign pages? **Landing**.
3. Need a multi-page site that talks to forms and menus live? **Web app**.
4. Need cheap, fast, serverless hosting? **Static** (built from the Web app, then exported).
5. Unsure? Start with **Web app and admin**; you can add Landing or convert to static later without losing data.

## Changing your mind later
Open **/admin/settings/products**, change the ticks, **Apply products**. Turning a product off hides menu entries; it never deletes pages, users or files."""),
 '01-admin-only': ("Flow 1: Admin only", "run the internal business application with no public website.",
   "a secured admin app: users, roles, company identity, themes, notifications and activity log.",
   SIGNIN + "\n\n" + ADMIN + """

## Tick only Admin
In the Setup wizard, Step 2 of 2, leave **Website** and **Landing Pages** off and press **Apply products**. The wizard records "no website" and stops asking. Public-site menu entries stay hidden."""),
 '02-landing-only': ("Flow 2: Landing page only (with admin)", "publish one or more campaign pages without a full website.",
   "branded landing pages at `/p/<slug>` with a working contact form, plus the admin that runs them.",
   SIGNIN + "\n\nTick **Landing Pages** (leave Website off). There is no website setup step.\n\n" +
   """## 2. Set the brand once
**Admin Settings > Identity** for name, logo, contacts. **Admin Settings > Themes**, choose **Website**, pick colours and fonts, **Publish**. Landing pages use these tokens.

""" + LANDING + "\n\n" + ADMIN),
 '03-static-website-only': ("Flow 3: Static website only (with admin)", "ship a website as plain files, hosted anywhere, with no live web app in front of visitors.",
   "a downloadable .zip of your site. The admin is used only by you to build and re-export it.",
   SIGNIN + "\n\nTick **Website**. Answer **yes** when the wizard asks to create the first site.\n\n" + WEBAPP + "\n\n" + STATIC +
   """

## Hosting notes
- Visitors only ever reach your static host. Keep the admin private (internal address or VPN).
- Forms need the **Web app address** (https) or fall back to your contact email and phone.
- Re-export after every content change; the zip is a snapshot."""),
 '04-webapp-admin': ("Flow 4: Web app and admin", "run a live, editable website served from this installation.",
   "a live site on the same address as the admin, with menus, forms, detail pages and the page editor.",
   SIGNIN + "\n\nTick **Website**. Answer **yes** when the wizard asks to create the first site.\n\n" + WEBAPP + "\n\n" + ADMIN),
 '05-webapp-landing-admin': ("Flow 5: Web app, landing pages and admin", "a full website plus separate campaign pages, all under one admin.",
   "the live website, landing pages at `/p/<slug>`, one shared brand, one admin.",
   SIGNIN + "\n\nTick **Website** and **Landing Pages**.\n\n" + WEBAPP + "\n\n" + LANDING +
   """

## How the two fit together
- Both use the same Identity, Themes and Media.
- The website's header and footer come from Home. Landing pages keep their own footer and have no menu unless you add one.
- Link between them with normal links, for example a menu item **Offer|/p/summer-offer**.

""" + ADMIN),
 '06-static-landing': ("Flow 6: Static website and landing pages", "host everything as plain files and keep campaign pages separate.",
   "one zip for the website and one folder per landing page, all deployable on any static host.",
   SIGNIN + "\n\nTick **Website** and **Landing Pages**.\n\n" + WEBAPP + "\n\n" + LANDING + "\n\n" + STATIC +
   """

## Landing pages in static form
- Each landing page has its own **Convert** button in the finished pages list and its own build, status and download.
- The website export holds website pages; landing pages are exported one by one.
- Upload the website zip to the site root and each landing folder beside it (for example `/summer-offer/`)."""),
 '07-webapp-static': ("Flow 7: Web app and static website together", "keep the live site and also publish a plain-file copy.",
   "a live web app for editing and forms, plus a static copy for fast public hosting.",
   SIGNIN + "\n\nTick **Website**.\n\n" + WEBAPP + "\n\n" + STATIC +
   """

## Running both
- The Web app stays the **source of truth**: edit and publish there.
- Public traffic goes to the static copy; set its **Web app address** so forms, menus and FAQ call back to the live app.
- Re-convert after publishing changes. The static copy never edits itself."""),
 '08-full-platform': ("Flow 8: Full platform", "website, landing pages, static export and admin, all enabled.",
   "the complete product set with shared brand, content and permissions.",
   SIGNIN + "\n\nTick **Website** and **Landing Pages**.\n\n" + WEBAPP + "\n\n" + LANDING + "\n\n" + STATIC + "\n\n" + ADMIN +
   """

## Suggested order for a new client
1. Identity and Themes (brand once).
2. Website via the Studio (Overview, Palette, Approval, Website).
3. Content modules and menus.
4. Landing pages for campaigns.
5. Roles for the client's team (Admin role runs content and people; User has no admin access).
6. Publish, check, then Convert to Static if you want a plain-file copy."""),
}

CSS = """@page{size:A4;margin:18mm 16mm}
body{font:11pt/1.5 -apple-system,Helvetica,Arial,sans-serif;color:#1a2233}
h1{font-size:22pt;color:#1d4ed8;margin:0 0 8pt;border-bottom:3px solid #1d4ed8;padding-bottom:6pt}
h2{font-size:14pt;margin:18pt 0 6pt;color:#0f2a6b;break-after:avoid}
table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:10pt;break-inside:avoid}
th,td{border:1px solid #cbd5e1;padding:4pt 7pt;text-align:left;vertical-align:top}
th{background:#eef2ff}code{background:#f1f5f9;padding:0 3pt;border-radius:3px;font-size:9.5pt}
ol,ul{padding-left:18pt}li{margin:2pt 0}p{margin:6pt 0}
.foot{margin-top:22pt;font-size:9pt;color:#64748b;border-top:1px solid #cbd5e1;padding-top:6pt}"""

def inline(t):
    t = html.escape(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', t)
    return re.sub(r'`(.+?)`', r'<code>\1</code>', t)

def render(md):
    out, lst, tbl = [], None, False
    def close():
        nonlocal lst, tbl
        if lst: out.append(f'</li></{lst}>'); lst = None
        if tbl: out.append('</tbody></table>'); tbl = False
    for ln in md.split('\n'):
        if ln.startswith('|'):
            cells = [c.strip() for c in ln.strip().strip('|').split('|')]
            if set(''.join(cells)) <= set('-: '): continue
            if lst: close()
            if not tbl:
                out.append('<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in cells) + '</tr></thead><tbody>'); tbl = True
            else:
                out.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in cells) + '</tr>')
            continue
        m = re.match(r'^(\d+)\. (.*)', ln)
        if m:
            if tbl: close()
            if lst == 'ol': out.append('</li>')
            elif lst: close(); out.append('<ol>'); lst = 'ol'
            else: out.append('<ol>'); lst = 'ol'
            out.append(f'<li>{inline(m[2])}'); continue
        m = re.match(r'^(\s*)- (.*)', ln)
        if m:
            if m[1] and lst == 'ol':  # sub-bullet inside the current numbered step
                out.append(f'<ul><li>{inline(m[2])}</li></ul>'); continue
            if tbl: close()
            if lst == 'ul': out.append('</li>')
            elif lst: close(); out.append('<ul>'); lst = 'ul'
            else: out.append('<ul>'); lst = 'ul'
            out.append(f'<li>{inline(m[2])}'); continue
        close()
        m = re.match(r'^(#{1,2}) (.*)', ln)
        if m: out.append(f'<h{len(m[1])}>{inline(m[2])}</h{len(m[1])}>'); continue
        if ln.strip(): out.append(f'<p>{inline(ln)}</p>')
    close()
    return '\n'.join(out)

def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for slug, (title, goal, gets, body) in DOCS.items():
        md = doc(title, goal, gets, body)
        open(os.path.join(HERE, slug + '.md'), 'w').write(md)
        page = f'<!doctype html><meta charset=utf-8><title>{html.escape(title)}</title><style>{CSS}</style>{render(md)}<div class=foot>KDL OS · Flow guides · localhost:3001/admin/documents</div>'
        with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False) as f: f.write(page); src = f.name
        pdf = os.path.join(OUT, slug + '.pdf')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer', f'--print-to-pdf={pdf}', 'file://' + src],
                       check=True, capture_output=True, timeout=120)
        os.unlink(src)
        manifest.append({'file': slug + '.pdf', 'title': title, 'goal': goal[0].upper() + goal[1:]})
        print('ok', slug)
    json.dump(manifest, open(os.path.join(HERE, '..', '..', 'frontend', 'src', 'admin', 'lib', 'flow-docs.json'), 'w'), indent=2)
    open(os.path.join(HERE, '..', '..', 'frontend', 'src', 'admin', 'lib', 'flow-docs.json'), 'a').write('\n')

if __name__ == '__main__':
    sys.exit(main())
