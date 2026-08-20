// ai-services/scripts/generate-logo-fixtures.mjs
//
// Generates 5 stereotype-INCONGRUENT synthetic wordmark logo fixtures
// for the KDL-534 multimodal A/B test (see issue KDL-539).
//
// Each logo's letterform intentionally contradicts the brand's industry:
//   brackwell-hoyt  → law firm rendered as bouncy kids'-app wordmark
//   grimsby-junior  → children's brand rendered as austere condensed grotesque
//   marigold-pay    → fintech rendered as ink-brush artisanal script
//   ironhall-forge  → heavy industry rendered as luxury-editorial didone
//   atelier-sevigne → luxury tailoring rendered as ASCII-bracket dev-tool mono
//
// Colours are stereotype-neutral mid-saturation (desaturated plum, slate-mauve,
// ochre-grey, dusty rose, muted olive) so that letterform is the only variable
// the image contributes to the A/B. See KDL-539 palette constraint section.
//
// Prerequisites:
//   Chromium must be installed for @playwright/test:
//     cd frontend && npx playwright install chromium
//
// Usage (run from repo root):
//   node ai-services/scripts/generate-logo-fixtures.mjs
//
// Output: ai-services/tests/fixtures/logos/{name}.png  (800×300 px each)

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdir } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const FIXTURES_DIR = resolve(repoRoot, 'ai-services/tests/fixtures/logos');

const { chromium } = await import(
  resolve(repoRoot, 'frontend/node_modules/@playwright/test/index.mjs')
);

// ---------------------------------------------------------------------------
// Logo definitions
// Each html field is a complete 800×300 document rendered via headless Chromium.
// Google Fonts are loaded at generation time — the committed PNGs need no net access.
// ---------------------------------------------------------------------------

const GOOGLE_FONTS = [
  'https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap',
  'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap',
  'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,500&display=swap',
  'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@700&display=swap',
];

function page(style, body) {
  // Loads all fonts up-front so each logo page resolves them from cache.
  const fontLinks = GOOGLE_FONTS.map(
    (href) => `<link rel="stylesheet" href="${href}">`
  ).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${fontLinks}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  width: 800px; height: 300px;
  background: #ffffff;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
${style}
</style>
</head>
<body>${body}</body>
</html>`;
}

const LOGOS = [
  // ── 1. brackwell-hoyt ────────────────────────────────────────────────────
  // Industry: law firm.  Visual: bouncy kids'-app wordmark.
  // Fredoka One is extremely round and playful; the bouncing baseline and
  // circular dot motif make it read immediately as a children's product.
  // Colour: desaturated plum #7B5E8C — not the expected navy/dark.
  {
    file: 'brackwell-hoyt.png',
    html: page(
      `
.mark {
  font-family: 'Fredoka One', 'Comic Sans MS', cursive;
  color: #7B5E8C;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.wordline {
  display: flex; align-items: flex-end; line-height: 1;
}
.w1  { font-size: 68px; display: inline-block; transform: translateY(-10px); }
.amp { font-size: 52px; display: inline-block; transform: translateY(6px); margin: 0 10px; }
.w2  { font-size: 66px; display: inline-block; transform: translateY(-4px); }
.dots { display: flex; gap: 10px; align-items: center; }
.d { border-radius: 50%; background: #7B5E8C; display: inline-block; }
.d-sm { width: 6px;  height: 6px;  opacity: 0.4; }
.d-md { width: 10px; height: 10px; opacity: 0.65; }
.d-lg { width: 14px; height: 14px; opacity: 0.85; }
`,
      `<div class="mark">
  <div class="wordline">
    <span class="w1">brackwell</span>
    <span class="amp">&amp;</span>
    <span class="w2">hoyt</span>
  </div>
  <div class="dots">
    <span class="d d-sm"></span>
    <span class="d d-md"></span>
    <span class="d d-lg"></span>
    <span class="d d-md"></span>
    <span class="d d-sm"></span>
  </div>
</div>`
    ),
  },

  // ── 2. grimsby-junior ────────────────────────────────────────────────────
  // Industry: children's brand.  Visual: austere condensed grotesque.
  // Bebas Neue is all-caps and extremely condensed; tight tracking and a
  // hard horizontal rule make it read like a government agency or museum,
  // nothing like a kids' product.
  // Colour: slate-mauve #6E7A8E — not the expected pastels.
  {
    file: 'grimsby-junior.png',
    html: page(
      `
.mark {
  display: flex; flex-direction: column; align-items: center; gap: 0;
}
.name {
  font-family: 'Bebas Neue', 'Arial Narrow', Impact, sans-serif;
  font-size: 96px;
  letter-spacing: -0.02em;
  color: #6E7A8E;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}
.rule {
  width: 100%; height: 4px; background: #6E7A8E; margin-top: 6px;
}
`,
      `<div class="mark">
  <div class="name">GRIMSBY JUNIOR</div>
  <div class="rule"></div>
</div>`
    ),
  },

  // ── 3. marigold-pay ──────────────────────────────────────────────────────
  // Industry: fintech.  Visual: ink-brush artisanal script with flourish.
  // Great Vibes is a flowing calligraphic hand; the SVG ink-stroke below
  // reads artisan / craft / handmade — nothing like a payment product.
  // Colour: ochre-grey #8A7040 — not orange or teal fintech codes.
  {
    file: 'marigold-pay.png',
    html: page(
      `
.mark {
  display: flex; flex-direction: column; align-items: center; gap: 0;
}
.name {
  font-family: 'Great Vibes', 'Brush Script MT', 'Segoe Script', cursive;
  font-size: 96px;
  color: #8A7040;
  line-height: 1.1;
  white-space: nowrap;
}
.flourish { margin-top: -4px; }
`,
      `<div class="mark">
  <div class="name">Marigold Pay</div>
  <svg class="flourish" width="420" height="44" viewBox="0 0 420 44" fill="none">
    <path d="M8,30 C60,8 100,40 160,22 C220,4 260,38 320,22 C365,10 390,32 412,22"
          stroke="#8A7040" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M398,14 Q412,22 408,32" stroke="#8A7040" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M14,22 Q8,32 20,34" stroke="#8A7040" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
</div>`
    ),
  },

  // ── 4. ironhall-forge ────────────────────────────────────────────────────
  // Industry: heavy industry / forge.  Visual: luxury-editorial didone.
  // Bodoni Moda's extreme thick-thin contrast and the ultra-wide letter-
  // spacing + hairline rules read as perfume house or fashion magazine,
  // the opposite of a heavy-industry mark.
  // Colour: dusty rose #9E7280 — not gunmetal/industrial grey codes.
  {
    file: 'ironhall-forge.png',
    html: page(
      `
.mark {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
}
.hairline { width: 620px; height: 1px; background: #9E7280; }
.name {
  font-family: 'Bodoni Moda', 'Bodoni MT', 'Playfair Display', Georgia, serif;
  font-size: 46px;
  font-weight: 400;
  letter-spacing: 0.38em;
  color: #9E7280;
  text-transform: uppercase;
  text-align: center;
  line-height: 1.25;
  padding-right: 0.38em; /* compensate trailing tracking gap */
}
`,
      `<div class="mark">
  <div class="hairline"></div>
  <div class="name">Ironhall<br>Forge Works</div>
  <div class="hairline"></div>
</div>`
    ),
  },

  // ── 5. atelier-sevigne ───────────────────────────────────────────────────
  // Industry: luxury tailoring atelier.  Visual: ASCII-bracket dev-tool mono.
  // Roboto Mono with bracket notation, uppercase, and a version-string sub-
  // line reads exactly like a CLI tool or npm package — nothing like haute
  // couture.
  // Colour: muted olive #7A8B72 — not black-and-gold boutique codes.
  {
    file: 'atelier-sevigne.png',
    html: page(
      `
.mark {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.main-line {
  font-family: 'Roboto Mono', 'Courier New', Courier, monospace;
  font-size: 54px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #7A8B72;
  text-transform: uppercase;
  white-space: nowrap;
}
.bracket { opacity: 0.55; }
.sub-line {
  font-family: 'Roboto Mono', 'Courier New', Courier, monospace;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: #7A8B72;
  opacity: 0.5;
  white-space: nowrap;
}
`,
      `<div class="mark">
  <div class="main-line">
    <span class="bracket">[ </span>ATELIER SEVIGNE<span class="bracket"> ]</span>
  </div>
  <div class="sub-line">// haute-couture@atelier.dev :: v2.4.1</div>
</div>`
    ),
  },
];

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

console.log('Launching headless Chromium…');
const browser = await chromium.launch({ headless: true });
await mkdir(FIXTURES_DIR, { recursive: true });

for (const logo of LOGOS) {
  const page_ = await browser.newPage();
  await page_.setViewportSize({ width: 800, height: 300 });
  // 'load' waits for all resources including Google Fonts CSS; then
  // document.fonts.ready ensures the font-face descriptors have resolved.
  await page_.setContent(logo.html, { waitUntil: 'load' });
  await page_.evaluate(() => document.fonts.ready);
  await page_.screenshot({
    path: resolve(FIXTURES_DIR, logo.file),
    type: 'png',
    clip: { x: 0, y: 0, width: 800, height: 300 },
  });
  await page_.close();
  console.log(`  ✓ ${logo.file}`);
}

await browser.close();
console.log(`\nAll 5 fixtures written to:\n  ${FIXTURES_DIR}`);
