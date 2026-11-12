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

## Step 4. Click Brands and select Landing Pages
Click **Frontend > Brands** in the left menu. Three cards appear: Web app, Landing Pages and Collateral. Click the **Landing Pages** card to open it.
![Brands: click the Landing Pages card](brands-start)

## Step 5. Choose a landing page template
Open **Landing Pages** (http://localhost:3001/admin/landing-pages). Ready-made designs are already listed under **Start from a template**: Lead generation, Product launch, Event or webinar and Special offer. Click **View template** to preview one, then click **Use this template** to start from it. Every word, picture and colour can be changed afterwards in the editor.

If you need a fully custom page, click **New landing page** instead. This guide follows the template route.
![Landing Pages: start from a template](landing-start)

## Step 6. Name the page and create it
A **New landing page** window opens with the template you picked already selected. Fill in two things, then continue:
- **Name**: the title you see in the admin, for example "Summer offer".
- **Slug**: the last part of the public web address. The page will be published at `/p/<slug>`; the full address is shown under the field.

To use a different design, click another option under **Template** (choose **Blank** for a page with only a header and footer). Then click **Create and edit** to open the page in the editor.
![New landing page window](new-landing-start)

## Step 7. Click Create and edit, then change the page
Click **Create and edit**. The page opens in the editor.
![Click Create and edit](create-btn)

Change the page like this:
- **Content and images:** click a block on the page, then use the **Content** tab to change its text, replace its picture and edit its links (for example a button's address).
- **Look (UI):** use the **Style** tab for colours, fonts and spacing.
- **Sections:** use the **Section** tab to add sections from the list (Hero Slider, Welcome, Services and more) and the **Reorder** tab to move them. This is the section builder.
- **SEO:** the editor has no SEO button. Set the page title and description defaults in **Admin Settings > SEO**.
- Click **Preview** to see the page, then **Save**. The page stays a **Draft** until you publish it.
![The landing page editor](editor-start)

## Step 8. After editing, click Save
When you have finished all your changes, click **Save** at the top right of the editor. Your changes are stored and the page stays a **Draft** until you publish it. Then go back to the **Landing Pages** list (http://localhost:3001/admin/landing-pages).
![Click Save](save-btn)

## Step 9. Click Convert
In the **Landing Pages** list your page now has three buttons: **Edit**, **Preview** and **Convert**. Click **Convert**. KDL OS builds your page as plain static files. This takes a few minutes; you can stay on the page. When it finishes, the card says **Moved to its folder. Ready to host.** and shows the folder name.
![Landing Pages: click Convert](convert-start)

## Step 10. Copy the static files and host them on GitHub
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
4. After a minute your page is live at `https://YOUR-USERNAME.github.io/my-landing/`.

> This is the last step of this guide.
