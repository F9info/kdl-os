## Step 1. Pick your combination
| You want | Products | Guide |
|---|---|---|
| Only the internal admin app | Admin (always on) | Flow 1: Admin only |
| Only campaign pages | Landing Pages | Flow 2: Landing page only |
| A website hosted anywhere as plain files | Website, then Convert | Flow 3: Static website only |
| A live, editable website | Website | Flow 4: Web app and admin |
| A live website and campaign pages | Website + Landing Pages | Flow 5: Web app, landing pages and admin |
| Plain-file website plus campaign pages | Website + Landing Pages, then Convert | Flow 6: Static website and landing pages |
| Live site that is also exported as plain files | Website, then Convert | Flow 7: Web app and static website |
| Everything, with optional Membership | Website + Landing Pages | Flow 8: Full platform |

Admin is always on, so "only landing page" still includes the admin you sign in to.

How to decide quickly:
1. People, roles and settings only? **Admin only**.
2. One or a few campaign pages? **Landing**.
3. A multi-page site with live forms and menus? **Web app**.
4. Cheap serverless hosting? **Static** (built in the Web app, then exported).
5. Unsure? Start with **Web app and admin**. Landing or static can be added later without losing data.

## Step 2. Install KDL OS (if you have not yet)
Not installed yet? Open the **Installation** guide first: Git, Docker, the `.env` file, `docker compose up`, create the admin and sign in. If KDL OS is already running, skip this step.

## Step 3. Open the guide for your flow
Sign in, then click **Documents** in the left menu. Click the card of your flow: the guide opens as a PDF in a new tab. Every guide starts at **Step 1. Sign in** and follows one screen per page, with red "click here" labels on each screenshot. The last page of each guide is a Notes page for later changes.
![Documents: every guide opens from here](documents)

## Notes: Changing your mind later
This is not a step. Open **Admin Settings > Products** (/admin/settings/products), change the ticks and click **Apply products**. Turning a product off hides menu entries; it never deletes pages, users or files. Landing or static can be added later without losing data.
![Products screen](products)
