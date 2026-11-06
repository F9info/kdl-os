// Builds this site as plain static files (HTML/CSS/JS) into ./out, ready for any static host
// (S3, Netlify, GitHub Pages, nginx). Run: npm run build:static
//
// Works on a throw-away copy so the normal site (dev/start) is never touched. Dropped from the
// copy because they need a running server: middleware, the /p/<slug> redirect and the
// work/catalog/sector detail routes. Live data blocks (FAQ, team, forms, menus ...) call
// `/api/...`; set NEXT_PUBLIC_API_BASE to your backend URL to keep them working, e.g.
//   NEXT_PUBLIC_API_BASE=https://api.example.com npm run build:static
import {
  mkdirSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// `cp -R` rather than fs.cpSync: on some Docker Desktop mounts cpSync leaves files write-only.
const copy = (from, to) => {
  const r = spawnSync('cp', ['-R', from, to])
  if (r.status !== 0) throw new Error(`cp failed: ${from}`)
}

const root = process.cwd()
const work = path.join(root, '.static-build')
const SKIP = new Set(['node_modules', '.next', 'out', '.static-build', '.git'])

rmSync(work, { recursive: true, force: true })
mkdirSync(work)
for (const name of readdirSync(root)) {
  if (!SKIP.has(name)) copy(path.join(root, name), path.join(work, name))
}
symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), 'dir')

for (const p of ['src/middleware.ts', 'src/app/p', 'src/app/(site)']) {
  rmSync(path.join(work, p), { recursive: true, force: true })
}
const patch = (file, from, to) => {
  const f = path.join(work, file)
  writeFileSync(f, readFileSync(f, 'utf8').replace(from, to))
}
const DYN = "export const dynamic = 'force-dynamic'"
patch('src/app/layout.tsx', DYN, "export const dynamic = 'force-static'")
patch('src/app/page.tsx', DYN, "export const dynamic = 'force-static'")
patch('src/app/[prefix]/page.tsx', DYN, 'export const dynamicParams = false')

// Images and libraries the live site gets from the admin app (/seed, /vendor) travel with the export.
const assets = path.join(root, 'static-assets')
if (existsSync(assets)) copy(assets, path.join(work, 'public'))

const next = path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next')
const res = spawnSync(process.execPath, [next, 'build'], {
  cwd: work,
  stdio: 'inherit',
  env: {
    ...process.env,
    STATIC_EXPORT: '1',
    // The shared axios client reads this; the fetch shim in SitePage covers plain fetch().
    ...(process.env.NEXT_PUBLIC_API_BASE
      ? { NEXT_PUBLIC_API_URL: `${process.env.NEXT_PUBLIC_API_BASE.replace(/\/$/, '')}/api` }
      : {}),
  },
})
if (res.status !== 0) {
  console.error('Static build failed')
  process.exit(res.status ?? 1)
}
// Some mounts (Docker Desktop) hand copied files odd modes (even write-only); fix them before
// deleting the previous output and again before hosts have to read the result.
const fixModes = (dir) => spawnSync('chmod', ['-R', 'u+rwX,go+rX', dir])
fixModes(path.join(work, 'out'))
if (existsSync(path.join(root, 'out'))) {
  fixModes(path.join(root, 'out'))
  rmSync(path.join(root, 'out'), { recursive: true, force: true })
}
renameSync(path.join(work, 'out'), path.join(root, 'out'))
rmSync(work, { recursive: true, force: true })
console.log(`Static site written to ${path.join(root, 'out')}`)
