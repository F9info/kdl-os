// Builds "KDL OS - Complete Installation & Setup Guide" (A4 PDF) with a cover, table of contents and page numbers.
// Run from frontend/ (playwright lives there):  node ../docs/guide/build.mjs
// Output: frontend/public/docs/guides/kdl-os-installation-guide.pdf  (listed on /admin/documents by docs/flows/build.py)
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { META, CHAPTERS } from './content.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', '..', 'frontend', 'public', 'docs', 'guides')
const FILE = 'kdl-os-installation-guide.pdf'
const { chromium } = await import(pathToFileURL(path.join(process.cwd(), 'node_modules/playwright/index.mjs')).href)

const CSS = `
@page{size:A4;margin:18mm 16mm 20mm;@bottom-center{content:counter(page);font:9pt Helvetica,Arial,sans-serif;color:#64748b}@bottom-left{content:"${META.title}";font:8pt Helvetica,Arial,sans-serif;color:#94a3b8}}
@page :first{@bottom-center{content:none}@bottom-left{content:none}}
*{box-sizing:border-box}
body{font:10.5pt/1.55 Helvetica,Arial,sans-serif;color:#1a2233;margin:0}
.cover{height:257mm;display:flex;flex-direction:column;justify-content:center;background:linear-gradient(135deg,#1d4ed8,#312e81);color:#fff;border-radius:10px;padding:0 18mm;break-after:page}
.cover .k{letter-spacing:.2em;font-size:11pt;text-transform:uppercase;opacity:.85}
.cover h1{font-size:34pt;line-height:1.15;margin:10mm 0 6mm;color:#fff;border:0;padding:0}
.cover p{font-size:13pt;opacity:.92;max-width:130mm}
.cover .m{margin-top:22mm;font-size:10pt;opacity:.8}
.toc{break-after:page}
.toc h1{margin-top:0}
.toc a{display:flex;gap:6pt;color:#1a2233;text-decoration:none;padding:6pt 0;border-bottom:1px dotted #cbd5e1;font-size:11.5pt}
.toc a span.t{flex:1}.toc a b{color:#1d4ed8}
.toc a i{font-style:normal;color:#1d4ed8;font-weight:700;width:18pt}
h1{font-size:22pt;color:#0f2a6b;margin:0 0 10pt;padding-bottom:6pt;border-bottom:3px solid #c7d2fe}
h3{font-size:12.5pt;color:#1e3a8a;margin:15pt 0 5pt;break-after:avoid}
.ch{break-before:page}
.ch.first{break-before:auto}
p{margin:6pt 0}ul,ol{padding-left:18pt;margin:5pt 0}li{margin:3pt 0}
code{background:#eef2ff;padding:0 3pt;border-radius:3px;font-size:9.5pt}
table{border-collapse:collapse;width:100%;margin:8pt 0;font-size:9.6pt;break-inside:avoid}
th,td{border:1px solid #cbd5e1;padding:5pt 7pt;text-align:left;vertical-align:top}
th{background:#eef2ff;color:#0f2a6b}
figure{margin:10pt 0;break-inside:avoid;text-align:center}
figure img{max-width:100%;max-height:150mm;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 2px 8px rgba(15,23,42,.12)}
figcaption{font-size:8.8pt;color:#475569;margin-top:4pt}
figure.half img{max-height:78mm}
.note,.tip,.warn{border-left:4px solid #3b82f6;background:#eff6ff;border-radius:4px;padding:6pt 10pt;margin:9pt 0;font-size:9.8pt;break-inside:avoid}
.tip{border-color:#10b981;background:#ecfdf5}.warn{border-color:#f59e0b;background:#fffbeb}
ol.steps{counter-reset:s;list-style:none;padding-left:0}
ol.steps li{counter-increment:s;position:relative;padding-left:26pt;margin:6pt 0;break-inside:avoid}
ol.steps li:before{content:counter(s);position:absolute;left:0;top:0;width:18pt;height:18pt;border-radius:50%;background:#1d4ed8;color:#fff;text-align:center;font:700 9pt/18pt Helvetica,Arial,sans-serif}
`

const wrap = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`
const chapterHtml = (c, n, first) => `<section class="ch${first ? ' first' : ''}" id="${c.id}"><h1>${n}. ${c.title}</h1>${c.html}</section>`
const countPages = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

const browser = await chromium.launch()
const page = await browser.newPage()
async function render(body, file) {
  const html = path.join(HERE, '_render.html')
  fs.writeFileSync(html, wrap(body))
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' })
  await page.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r }))))
  return page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, path: file })
}

// pass 1: how many pages does each chapter take?  (cover = page 1, contents = page 2)
const lens = []
for (const [i, c] of CHAPTERS.entries()) lens.push(countPages(await render(chapterHtml(c, i + 1, true))))
let start = 3
const starts = lens.map((n) => { const s = start; start += n; return s })

const cover = `<div class="cover"><div class="k">KDL OS</div><h1>${META.title.replace('KDL OS – ', '')}</h1><p>From the first screen to your first website: the three-step Setup Wizard, choosing your application type, launching KDL OS, and what to do after you sign in.</p><div class="m">Version ${META.version} · ${META.date}</div></div>`
const toc = `<div class="toc"><h1>Contents</h1>${CHAPTERS.map((c, i) => `<a href="#${c.id}"><i>${i + 1}</i><span class="t">${c.title}</span><b>${starts[i]}</b></a>`).join('')}</div>`
const body = cover + toc + CHAPTERS.map((c, i) => chapterHtml(c, i + 1, false)).join('')

fs.mkdirSync(OUT, { recursive: true })
const final = await render(body, path.join(OUT, FILE))
fs.rmSync(path.join(HERE, '_render.html'))
const total = countPages(final)
console.log(`pages: ${total}; chapter starts: ${starts.join(', ')} (expected last chapter to end at ${start - 1})`)
if (total !== start - 1) console.log('WARNING: page count differs from the table of contents; check chapter breaks')
await browser.close()
