## Step 1. Sign in
> KDL OS must already be installed and running. If not, follow the **Installation** guide first (Admin > Documents > Installation).

Open **http://localhost/login**. Email `admin@kdl.com`, password `kdl-dev-seed-password`. KDL OS asks you to choose a new password on first sign-in.
![The sign-in screen](login)
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`.

## Step 2. Open Application Identity
After you sign in, open **Admin Settings > Identity** in the left menu. This is where the application name, logo and favicon are set.
![Admin Settings > Identity](identity-start)

## Step 3. Open Modules, install and enable Frontend
Click **Modules** in the left menu. Find the **Frontend** card (use the search box if you need to). On a fresh install the card shows **Install**: click it and confirm, then click **Enable** and confirm. The badge changes to **Enabled**.
![Modules: the Frontend card](modules-start)

## Step 4. Open the Studio
Click **Frontend > Brands** in the left menu, then click the **Web app** card. This opens the Studio for your website. The first time, click **Start Studio run**. Tabs along the top: Overview, Color Palette and Website.
![Brands: open the Web app](brands-web)

## Step 5. Color Palette
Four brand colours are taken from your logo: Primary, Secondary, Tertiary and Quaternary. Keep them, or click a colour box and type a new code, click **Pick from logo** or **Randomize**. Then click **Submit palette**. The colours become the website's design tokens.
![Studio: Color Palette](studio-palette)

## Step 6. Typography: choose the fonts
The Website stage opens on **Typography**. Under **Heading** tick the font for titles, and under **Body** tick the font for normal text. To use another font, type its Google Font name (for example Roboto) and click **Add**, or click **Upload** to add your own font file. Click **Save**, then click **Next: Typography** to continue.
![Website stage: Typography](typography)

## Step 7. Font settings
Fine-tune the type scale: for each element (H1 to H6, Lead paragraph, Body, Small, Nav link, Button) change the font size, family, weight, line height and letter spacing. The **Examples** panel on the right shows the result live. The defaults are a good start. Scroll down and click **Next: Buttons and form fields**.
![Website stage: Font settings](font-settings)

## Step 8. Buttons and form fields
Click one card under **Button style** (Solid, Airy pill, Classic, Leaf, Outline, Soft tint and more), then scroll down and click one card under **Form field style**. Every button and every form on your website uses them, in your theme's colours. The admin screens are not changed. Click **Next** to continue to Navigation.
![Website stage: Button style](button-styles)

## Step 9. Choose the menu pages
Open **Frontend > Navigation**. Click the page names you want in the menu (About, Services, Portfolio, Blog, Contact and so on), or type a custom page and click **Add**. Use the **Header menu** and **Footer menu** tabs. One page is created for every menu item, plus Home.
![Frontend > Navigation](navigation)

## Step 10. Layouts: header and footer
Click **Layouts** in the left menu (under **Frontend**). The page shows **Layout settings**: the header and footer used on every page of your website.
![Frontend > Layouts](layouts-menu)

KDL OS already has ready-made headers and footers. You can use them as they are. If you want a fully custom one, click **Create/Edit layout**.
![Layout settings](layout-settings)

The **Layout** page lists each section (Top header, Header, Footer and more) with several designs. Use the switch on the right to turn a section on or off, and pick a design: the one with the green tick is in use. For each design you can click **View** to preview it, **Edit** to change it, or **Create new** to build your own from scratch. Then create the layout to apply it to every page. The header and footer of **Home** are shared by every public page.
![Layout: pick a design for each section](layout-pick)

## Step 11. Detail pages: one layout for every detail page
A detail page shows one item: one service, one blog post, one event, one sector. You do not build each by hand. Every item of a type shares one layout, and a page is created for each item.

**A. Add the detail page types.** Open **Frontend > Navigation**. Click **Service detail**, **Blog detail**, **Portfolio detail**, **Team member** or **Job detail** to add them. For another type, type a name such as **Event detail** and click **Add**. Sector, Catalog and Work detail pages appear once you add entries in those content modules.
![Navigation: add the detail pages](navigation-detail)

**B. Edit the layout.** Go back to **Layout settings** (Frontend > Brands > Web app). A pill called **Layout Service Detail** (or Layout Blog Detail, Layout Event Detail and so on) now appears for each type. Click the pill to open the section builder for that layout: change it once and every page of that type changes. The number on the pill is how many detail pages exist. Click a small number under the pill to edit one page's own content (title, text, images); the arrow opens that page live.
![Layout settings: the detail page layouts](detail-layout)

## Step 12. Edit the detail layout, then add the content
**A. Edit the layout.** On Layout settings click the **Layout Service Detail** pill (or the pill of another detail type). The section builder opens. Use the **Section**, **Reorder**, **Style** and **Content** tabs to build the layout, then click **Save**. The layout is the same for every page of this type: you set it once.
![Detail page layout in the section builder](detail-editor)

**B. Add the content.** Go back to Layout settings and click the number on the pill. The list shows every page of this type (for example every service). Click the pencil to change a page's text and images, click **Rename** to rename it, click the arrow icon to open it live, and click the bin to delete it. Click **Add new** to create a related page. The layout never changes between pages: here you change only the text and images.
![Service Detail: every page of the type](detail-list)

## Step 13. Edit and publish the pages
Open **Frontend > Pages**. Click **Edit** on a page to change its text, images and links in the section builder, then **Save** and **Publish**. Publish stops real problems (an empty page, a missing title, a broken link) and only suggests the rest. Click **Duplicate** to copy a page. **Frontend > Sections** holds reusable sections.
![Frontend > Pages](pages)

## Step 14. Edit the page in the section builder, then Save
In **Frontend > Pages** click **Edit** on a page (for example **Home**). The section builder opens with the page in the middle and the tools on the left:
- **Section:** click a section in the list to add it to the page.
- **Reorder:** move sections up or down.
- **Style:** colours, fonts and spacing.
- **Content:** click a text or a picture on the page to select it, then change its text, image or link here.

When you have finished, click **Save** at the top right. The badge at the top shows the page status.
![Editing the Home page in the section builder](page-editor)

## Step 15. Click Brands and select Landing Pages
Click **Frontend > Brands** in the left menu. Three cards appear: Web app, Landing Pages and Collateral. Click the **Landing Pages** card to open it.
![Brands: click the Landing Pages card](brands-start)

## Step 16. Choose a landing page template
Open **Landing Pages** (http://localhost:3001/admin/landing-pages). Ready-made designs are already listed under **Start from a template**: Lead generation, Product launch, Event or webinar and Special offer. Click **View template** to preview one, then click **Use this template** to start from it. Every word, picture and colour can be changed afterwards in the editor.

If you need a fully custom page, click **New landing page** instead. This guide follows the template route.
![Landing Pages: start from a template](landing-start)

## Step 17. Name the page and create it
A **New landing page** window opens with the template you picked already selected. Fill in two things, then continue:
- **Name**: the title you see in the admin, for example "Summer offer".
- **Slug**: the last part of the public web address. The page will be published at `/p/<slug>`; the full address is shown under the field.

To use a different design, click another option under **Template** (choose **Blank** for a page with only a header and footer). Then click **Create and edit** to open the page in the editor.
![New landing page window](new-landing-start)

## Step 18. Click Create and edit, then change the page
Click **Create and edit**. The page opens in the editor.
![Click Create and edit](create-btn)

Change the page like this:
- **Content and images:** click a block on the page, then use the **Content** tab to change its text, replace its picture and edit its links (for example a button's address).
- **Look (UI):** use the **Style** tab for colours, fonts and spacing.
- **Sections:** use the **Section** tab to add sections from the list (Hero Slider, Welcome, Services and more) and the **Reorder** tab to move them. This is the section builder.
- **SEO:** the editor has no SEO button. Set the page title and description defaults in **Admin Settings > SEO**.
- Click **Preview** to see the page, then **Save**. The page stays a **Draft** until you publish it.
![The landing page editor](editor-start)

## Step 19. After editing, click Save
When you have finished all your changes, click **Save** at the top right of the editor. Your changes are stored and the page stays a **Draft** until you publish it. Then go back to the **Landing Pages** list (http://localhost:3001/admin/landing-pages).
![Click Save](save-btn)

## Step 20. Check the live website
Open http://localhost in a private window, signed out. Check that the header and footer match Home on every page and that every menu link opens a page. Pages are public at `/` and at `/p/<slug>`.

## Notes: Changing things later
This is not a step. Use it when something changes.
- **Text, images, links:** Frontend > Pages, Edit, Save, Publish. No re-run is needed.
- **Menus:** Frontend > Navigation.
- **Header, top bar or footer:** Studio > Layouts > Create/Edit layout.
- **Colours or fonts:** Studio > Color Palette, Submit palette.
- **Change a landing page:** open http://localhost:3001/admin/landing-pages?finished=1, click **Edit**, change it in the section builder, **Save**.
