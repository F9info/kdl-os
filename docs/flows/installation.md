# Installation

**Goal:** get KDL OS running on your computer and sign in as admin.

[[flow: Clone | Configure .env | Run Docker | Create admin | Sign in]]

## Install KDL OS

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
> Forgot the password or locked out? `docker compose exec backend node scripts/reset-admin-password.js --email admin@kdl.com --password 'Admin@123'` (at least 8 characters), then sign in with it. 429 or "Account locked" while testing: wait a minute or `docker compose restart backend`.

Next: open the guide for the flow you chose (Admin > Documents).
