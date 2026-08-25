// KDL-490: A/B harness — text-only baseline vs image+text multimodal brand
// inference, over the REAL production path (inferBrandIdentity → brainRouter
// → claudeBrain). Requires a live ANTHROPIC_API_KEY; without one every run
// degrades to F1_NO_KEY and the comparison is meaningless.
//
// Usage:
//   node scripts/brand-inference-ab.mjs <manifest.json> <out-dir>
//
// Manifest: [{ id, pngPath, companyName, industry, tagline?, locale?,
//              paletteSummary: { primaryHex, neutralHex, chroma, hueName } }]
// pngPath must be the KDL-482 §1.3 normalized raster (1024px PNG).
//
// The BRAND_INFERENCE_IMAGE_ENABLED flag is read at call time inside
// brand-inference.js, so the harness toggles it between calls; runs are
// sequential on purpose (env flag is process-global).

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import { inferBrandIdentity } from '../src/services/brand-inference.js';

const [manifestPath, outDir = './ab-results'] = process.argv.slice(2);
if (!manifestPath) {
  console.error('usage: node scripts/brand-inference-ab.mjs <manifest.json> <out-dir>');
  process.exit(1);
}

const parsed = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
const manifest = Array.isArray(parsed) ? parsed : parsed.entries; // bare array or { entries }
await mkdir(resolve(outDir), { recursive: true });

const results = [];

for (const entry of manifest) {
  const base = {
    projectId: `kdl490-ab:${entry.id}`,
    companyName: entry.companyName,
    industry: entry.industry,
    ...(entry.tagline ? { tagline: entry.tagline } : {}),
    locale: entry.locale ?? 'en',
    paletteSummary: entry.paletteSummary,
  };
  const png = await readFile(resolve(entry.pngPath));
  const logoImage = { data: png.toString('base64'), mediaType: 'image/png' };

  for (const mode of ['text', 'image']) {
    process.env.BRAND_INFERENCE_IMAGE_ENABLED = mode === 'image' ? 'true' : 'false';
    const input = mode === 'image' ? { ...base, logoImage } : base;
    const t0 = performance.now();
    const envelope = await inferBrandIdentity(input, {
      sessionId: `kdl490-ab:${entry.id}:${mode}`,
    });
    const latencyMs = Math.round(performance.now() - t0);
    results.push({ id: entry.id, mode, latencyMs, envelope });
    console.log(
      `${entry.id} [${mode}] source=${envelope.source} ` +
        `pairing=${envelope.typography.pairingId} conf=${envelope.confidence} ` +
        `${latencyMs}ms $${envelope.estimatedCostUsd}`,
    );
  }
}

await writeFile(join(resolve(outDir), 'ab-results.json'), JSON.stringify(results, null, 2));

// Compact side-by-side table for the written comparison.
const lines = [
  '| logo | mode | source | pairing | scale | confidence | adjectives | cost USD | ms |',
  '|---|---|---|---|---|---|---|---|---|',
];
for (const r of results) {
  const e = r.envelope;
  lines.push(
    `| ${r.id} | ${r.mode} | ${e.source} | ${e.typography.pairingId} | ` +
      `${e.typography.scaleRatio} | ${e.confidence} | ${e.tone.adjectives.join(', ')} | ` +
      `${e.estimatedCostUsd} | ${r.latencyMs} |`,
  );
}
await writeFile(join(resolve(outDir), 'ab-summary.md'), lines.join('\n') + '\n');
console.log(`\nWrote ${results.length} runs to ${resolve(outDir)}`);
