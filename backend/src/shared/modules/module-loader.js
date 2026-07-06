import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { manifestSchema } from './manifest-schema.js';
import { moduleGate } from '../../middleware/module-gate.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '../../modules');

// Loaded manifests keyed by slug — available to other parts of the app.
export const loadedManifests = new Map();

export async function loadModules(app) {
  let entries;
  try {
    entries = await readdir(MODULES_DIR, { withFileTypes: true });
  } catch {
    logger.warn('module-loader: modules directory not found, skipping');
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(MODULES_DIR, entry.name, 'module.json');
    if (!existsSync(manifestPath)) continue;

    let raw;
    try {
      raw = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (err) {
      logger.error(`module-loader: failed to parse ${manifestPath}: ${err.message}`);
      continue;
    }

    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error(`module-loader: invalid manifest for "${entry.name}": ${parsed.error.message}`);
      continue;
    }

    const manifest = parsed.data;

    if (manifest.slug !== entry.name) {
      logger.error(`module-loader: manifest slug "${manifest.slug}" does not match folder "${entry.name}", skipping`);
      continue;
    }

    loadedManifests.set(manifest.slug, manifest);

    const routesPath = join(MODULES_DIR, entry.name, 'routes.js');
    if (!existsSync(routesPath)) {
      logger.warn(`module-loader: no routes.js for "${manifest.slug}", registered as AVAILABLE only`);
      continue;
    }

    try {
      const { default: router } = await import(routesPath);
      app.use(manifest.apiPrefix, moduleGate(manifest.slug), router);
      logger.info(`module-loader: mounted "${manifest.slug}" at ${manifest.apiPrefix}`);
    } catch (err) {
      logger.error(`module-loader: failed to load routes for "${manifest.slug}": ${err.message}`);
    }
  }
}
