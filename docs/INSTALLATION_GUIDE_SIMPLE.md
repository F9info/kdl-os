# How to Install KDL OS — Simple Guide

You will have KDL OS running on your own computer in about 30 minutes.
Most of that time is waiting for the first build.

**You do not need any accounts or API keys.**

---

## Step 1. Install 3 things

| Install this | Where to get it | Check it works |
|---|---|---|
| **Git** | https://git-scm.com | `git --version` |
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | `docker --version` |
| **OpenSSL** | Already on Mac and Linux | `openssl version` |

**How to install Docker Desktop**

1. Open the Docker link above and click **Download Docker Desktop**.
2. Choose your computer: Mac (Apple chip), Mac (Intel chip) or Windows.
3. Open the file you downloaded and install it.
4. Start **Docker Desktop**. Wait until it says **running**.

**Give Docker enough memory:** Docker Desktop → Settings → Resources → Memory → **8 GB**.

**Windows users:** do the [Windows setup](#windows-setup) at the bottom first.

---

## Step 2. Download the code

Open a terminal and type:

```bash
git clone https://github.com/F9info/kdl-os.git
cd kdl-os
```

Stay inside the `kdl-os` folder for all the next steps.

---

## Step 3. Create the settings file

Copy this **whole block**, paste it into the terminal and press Enter.
It makes a file called `.env` with new random passwords.

```bash
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

Check: type `ls -la .env`. You should see a file of about 2 KB.

**Never share or upload the `.env` file.** It holds your passwords.

---

## Step 4. Start KDL OS

```bash
docker compose up -d --build
```

The first time it takes **10 to 20 minutes**. This is normal. Later starts take seconds.

When it finishes, check:

```bash
docker compose ps
```

Wait until `backend` says **healthy** (about 1 minute).

---

## Step 5. Create the admin user

```bash
docker compose exec backend node prisma/seed.js
```

You should see `Seeded admin: admin@kdl.com`.

---

## Step 6. Open KDL OS and log in

1. Open your browser: **http://localhost/login**
2. Email: `admin@kdl.com`
3. Password: `kdl-dev-seed-password`
4. KDL OS asks you to **choose a new password**. Do it and remember it.

**Done. KDL OS is running.**

---

## What you will see next

**A question pops up: "Do you need a front-end website?"**

| Your choice | What happens |
|---|---|
| **Yes** | A 5-page website is made for you: Home, About, Services, Contact, FAQ. You can change everything later. |
| **No** | Nothing is made. You use the admin only. |
| **Ask me later** | The question comes back next time. |

**Want more content (FAQ, Gallery, Team, Testimonials ...)?**
Open **Modules** → find **CMS** → click **Install**. One click adds all of them.

**Change the menu on your website:** open **CMS → Navigation**. Drag the items to change the order.

---

## Every day

Run these inside the `kdl-os` folder.

| I want to | Type this |
|---|---|
| Stop KDL OS (keeps my data) | `docker compose down` |
| Start it again | `docker compose up -d` |
| See what is running | `docker compose ps` |
| Update to the latest code | `git pull` then `docker compose up -d --build` |
| I forgot my admin password | `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'NewPassword123'` |

**Warning:** `docker compose down -v` deletes **all your data**. Do not use it unless you want to start from zero.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| Error says a variable is missing | You are in the wrong folder, or Step 3 was not done. Go to the `kdl-os` folder and repeat Step 3. |
| "Port is already in use" | Another program is using it. Close that program (for example a local website on port 80). |
| Build stops with "Killed" or "out of memory" | Give Docker 8 GB (Step 1), then run Step 4 again. |
| Page shows "502 Bad Gateway" | Wait 1 or 2 minutes and refresh. KDL OS is still starting. |
| Login says wrong password | Did you run Step 5? Use `kdl-dev-seed-password` the first time. |
| "Account locked" | Wait 1 minute and try again. |

Still stuck? Read the full guide: `docs/INSTALLATION_GUIDE.md`.

---

## Windows setup

Do this once, before Step 2. After this, type every command in the **Ubuntu** window, not in PowerShell.

1. Click Start, type **PowerShell**, right-click it, choose **Run as administrator**.
2. Type `wsl --install` and press Enter. Restart the computer when asked.
3. An **Ubuntu** window opens. Choose a username and password.
4. Install **Docker Desktop** (Step 1). In Docker Desktop go to Settings → Resources → **WSL integration** and switch **Ubuntu** on.
5. In the Ubuntu window type `cd ~` and then continue from **Step 2**.

Open **http://localhost/login** in your normal Windows browser.
