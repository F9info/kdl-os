# Deploy KDL OS on a server

One Linux virtual machine running the production stack with Docker
(`docker-compose.yml` + `docker-compose.prod.yml`). Written from the first real deployment
(Google Cloud, November 2026); every problem hit there is either fixed in the code or called out below.
Google Cloud is the example; any Ubuntu 24.04 VM works the same way.

Before every release that changes compose, nginx, a Dockerfile or `setup.sh`, the
**Production smoke (Linux)** GitHub workflow runs this whole setup on a fresh Linux machine
(`.github/workflows/prod-smoke.yml`). If it is red, do not deploy.

## 1. Create the virtual machine

Google Cloud console → **Compute Engine → VM instances → Create instance**:

| Setting | Value |
|---|---|
| Region | closest to your users (e.g. `asia-south1`, Mumbai) |
| Machine | `e2-standard-4` (4 vCPU, 16 GB). Smaller machines run out of memory during the build (the virus scanner alone uses about 1-1.5 GB). |
| Boot disk | Ubuntu 24.04 LTS, **30 GB** balanced disk. The default 10 GB fills up during the first build (`ENOSPC: no space left on device`). |
| Firewall | tick **Allow HTTP traffic** and **Allow HTTPS traffic** |

Then reserve the external IP: **VPC network → IP addresses → Reserve static address** on the VM's IP.

If you forgot the firewall boxes: VM instances → click the VM → **EDIT** (top of the page) → Firewalls →
tick both → **SAVE**. The details page only shows them; the boxes are on the Edit page. Or in Cloud Shell:

```bash
VM=<vm-name>; ZONE=$(gcloud compute instances list --filter="name=$VM" --format="value(zone.basename())")
NET=$(gcloud compute instances describe $VM --zone $ZONE --format="value(networkInterfaces[0].network.basename())")
gcloud compute firewall-rules create kdl-allow-web --network $NET --direction INGRESS --allow tcp:80,tcp:443 --source-ranges 0.0.0.0/0
```

Check from your own computer: `nc -vz <ip> 80` must say *succeeded* or *refused*, not *timed out*.

If the disk is too small later: **Compute Engine → Storage → Disks → EDIT → Size**, then on the VM:

```bash
sudo apt install -y cloud-guest-utils
sudo growpart /dev/sda 1 && sudo resize2fs /dev/sda1 && df -h /
```

## 2. Domain

At your DNS provider add an **A record**: `app.example.com` → the static IP. Wait until
`dig +short app.example.com` (from your computer) prints that IP.

## 3. Docker and the code (on the VM, via SSH)

```bash
sudo apt update && sudo apt install -y ca-certificates curl git certbot
curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
sudo usermod -aG docker $USER
exit   # reconnect SSH so the docker group applies, then:
docker run --rm hello-world

sudo apt install -y gh && gh auth login           # the repository is private
gh repo clone F9info/kdl-os ~/kdl-os && cd ~/kdl-os
```

## 4. `.env`

```bash
./setup.sh --env-only --block 0
D=app.example.com
sed -i "s#^FRONTEND_URL=.*#FRONTEND_URL=https://$D#; s#^CORS_ORIGIN=.*#CORS_ORIGIN=https://$D#" .env
cat >> .env <<EOF
IMAGE_TAG=v1
MINIO_PUBLIC_ENDPOINT=$D
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@example.com
EOF
```

| Value | Why |
|---|---|
| `FRONTEND_URL`, `CORS_ORIGIN` | the site's own https address |
| `IMAGE_TAG` | any version name; production refuses `latest` |
| `MINIO_PUBLIC_ENDPOINT` | the domain. Uploaded files (logo, media) are served from `https://<domain>/kdl-media/...`. Without it production refuses to start. |
| `SMTP_*` | real mail for password reset. Placeholders (`smtp.example.invalid`, `pending`) let the site start; reset emails then fail until replaced. Google Workspace: `smtp.gmail.com` and an App Password. |
| `API_RATE_LIMIT` (optional) | API requests per 15 min per client address, default 1000 |

Never copy a `.env` from another project or machine: it carries that project's passwords and name.

## 5. HTTPS certificate

Nothing may be listening on port 80 while certbot runs (stop the stack first if it is up):

```bash
sudo certbot certonly --standalone -d app.example.com
mkdir -p infra/certs
sudo cp /etc/letsencrypt/live/app.example.com/fullchain.pem infra/certs/
sudo cp /etc/letsencrypt/live/app.example.com/privkey.pem infra/certs/
sudo chown -R $USER:$USER infra/certs
```

`Timeout during connect (likely firewall problem)` = step 1's firewall. nginx logging
`cannot load certificate "/etc/nginx/certs/fullchain.pem"` = the copy step was skipped.

## 6. Build and start

```bash
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$C up -d --build          # first build 10-20 minutes
$C ps                     # wait for backend (healthy)
scripts/prod-smoke.sh https://app.example.com
```

`prod-smoke.sh` must end with *All production smoke checks passed*. It is safe on a live server.

## 7. First-run installer

Open `https://app.example.com/install`: company and logo, application type, admin account, then Launch.
Use a real logo image (PNG, JPG or SVG): the website colours are read from it.

With a type that includes a website, the installer then finishes the website setup by itself, in the
background (2-4 minutes; the virus scanner checks the logo first):

- the Studio run with its defaults: Overview, Color Palette from the logo, fonts (Poppins headings,
  Inter body), brand kit approved, header/footer layout, Website pages Home, About, Services, Contact
  linked in the header menu (the steps of the Flow 4 guide, done for you);
- the first build of the public site.

Watch it with `$C logs -f backend | grep -iE "studio|site-build"` (ends with `site-build default: ... pages`).
Then Frontend > Brands, Color Palette, Navigation, Layouts and Pages open normally, and `/` shows the site.
Until the site is built `/` sends visitors to `/login`. Everything can be changed afterwards in the admin.

**An installation completed before 2026-11-21** (Frontend screens say "Could not open ..."): run once

```bash
$C exec backend node scripts/studio-defaults.js
$C logs -f backend | grep site-build     # wait for "site-build default: N pages", then Ctrl+C
$C restart site-preview                   # then $C logs -f site-preview until "Ready"
```

It enables the website builder modules, runs the same Studio defaults and queues the site build in the
backend (never build the site from a separate `exec` process while the backend may be building it: two
writers leave the site with missing files and `next build` fails with *Module not found*). Safe to repeat.

`/install` going to `/login` means the installation is already complete. To start over on a server
that holds nothing yet: `$C down -v && $C up -d` (deletes all of this server's data). Deleting `.env`
does not reset it: the record is in the database, and a new `.env` has new passwords that the old
database refuses.

## 8. Running it

- **Updates**: `git pull`, set a new `IMAGE_TAG` in `.env`, `$C up -d --build`, then `scripts/prod-smoke.sh`.
  Free the build leftovers afterwards: `docker builder prune -af && docker image prune -f` (data is untouched).
- **Certificate renewal** (every 90 days): `$C stop nginx && sudo certbot renew`, copy the two files into
  `infra/certs/` again (step 5), `$C start nginx`.
- **Backups**: Compute Engine → **Snapshots → Create snapshot schedule** (daily, keep 7), attach to the disk.
- **Disk**: check `df -h /` monthly; enlarge (step 1) when Use% passes about 75%.
- **Costs**: Billing → Budgets & alerts.
- **App images from GitHub instead of building on the server**: CD publishes
  `ghcr.io/<owner>/<repo>/{backend,frontend,ai-services}:<commit-sha>`. Set `IMAGE_REPO` (default
  `f9info/kdl-os`) and `IMAGE_TAG=<commit-sha>`, run `docker login ghcr.io` with a token that can read
  packages, then `$C pull && $C up -d`.

## What the code takes care of (no manual step)

| Problem on the first server | Now |
|---|---|
| `setup.sh --env-only` exited silently on a machine without `lsof` | fixed (68ba597) |
| `/install` returned 502 in production | nginx routes it to the admin app (b86b90a) |
| logo and uploads pointed at `localhost:9002` | served from `https://<domain>/kdl-media/` (69beeda) |
| backend could not write the website folder (Linux file ownership) | `site-perms` + uid 100 for backend and site-preview |
| `429 Too many requests` after a few minutes | API limit 1000 per 15 min, `API_RATE_LIMIT` |
| `/` returned 502 before a website existed | redirects to `/login` |
| website pages existed but no site was generated | the installer queues the first site build |
| `minio/minio` image withdrawn | `cgr.dev/chainguard/minio` (b1cc70e) |
| uploaded images had no URL and the logo's colours could not be read (no virus scanner, but production requires a clean scan) | production runs ClamAV; the backend waits for it |
| Frontend > Brands / Color Palette / Navigation / Layouts / Pages: "Could not open ..." (website builder off, no Studio run) | the installer enables the builder and completes the Studio with defaults; `scripts/studio-defaults.js` for older installs |
