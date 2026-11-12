# KDL OS – Complete Installation & Setup Guide (PDF)

Source of the manual listed at **Admin > Documents** under "KDL OS – Installation & User Guides".

- `content.mjs`: the text, one entry per chapter (plain HTML). Edit here.
- `build.mjs`: renders the A4 PDF (cover, contents with page numbers, footer). Run from `frontend/`:
  `node ../docs/guide/build.mjs` → `frontend/public/docs/guides/kdl-os-installation-guide.pdf`
- `img/`: real screenshots from a fresh install (scratch database, example company "ABC Technologies").
  Retake them on a fresh database with `NODE_ENV=development` backend (port 4010) and `next dev` (port 3100); the wizard
  shots need an empty, seeded database. No illustrative mockups are used.
- The Documents list comes from `frontend/src/admin/lib/flow-docs.json`, written by `python3 docs/flows/build.py`
  (it adds this guide when the PDF exists). After changing the PDF: rebuild the list, then
  `docker compose up -d --build frontend` (public/ is baked into the image) and compare the served file's md5.

Bump the version in `content.mjs` (META) and `docs/flows/build.py` together when the guide changes.
