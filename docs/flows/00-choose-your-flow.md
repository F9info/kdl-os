# Choose your flow

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

## What every guide contains
1. **Installation guide** (Git, Docker, `.env`, `docker compose up`, create the admin, sign in) is its own guide: do it first.
2. **Part B.** The first-run Setup wizard, screen by screen.
3. **Part C.** Which modules to enable, and how, with the real Modules and Products screens.
4. **Part D.** The build steps for that flow, with screenshots of each screen.
5. A checklist, everyday commands and a troubleshooting table.

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
