## Step 1. Sign in
> KDL OS must already be installed and running. If not, follow the **Installation** guide first (Admin > Documents > Installation).

Open **http://localhost/login**. Email `admin@kdl.com`, password `kdl-dev-seed-password`. KDL OS asks you to choose a new password on first sign-in.
![The sign-in screen](login)
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`.

## Step 2. Open Application Identity
After you sign in, open **Admin Settings > Identity** in the left menu. This is where the application name, logo and favicon are set.
![Admin Settings > Identity](identity-start)

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
- **Add a public website or landing pages later:** Admin Settings > Products, tick the product and click **Apply products**. Nothing you already built is lost.