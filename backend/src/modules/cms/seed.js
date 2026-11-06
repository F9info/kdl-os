import { seedCmsSamples } from './pages.js';
import { createStarterSite, ONBOARDING_KEY } from '../projects/onboarding.js';

// Runs inside the install transaction. Installing CMS installs the TOOLS (pages, sections, menus,
// forms, landing pages ...) and nothing else: no placeholder content, no demo pages. The demo
// website is optional. It is created only when the owner has already answered "yes, start with a
// sample website" in the Setup Wizard (or later does so: POST /api/projects/onboarding {frontend:'yes'}
// adds it, idempotently). With no answer or "no", CMS installs empty and the owner builds from scratch.
//
// Safe to re-run: existing pages and rows are never touched. With no default project yet there is
// nothing to attach the demo to, so it is simply skipped.
export default async function seed(tx) {
  const answer = await tx.appSetting.findUnique({ where: { key: ONBOARDING_KEY } });
  if (answer?.value !== 'yes') return;

  await seedCmsSamples(tx);
  try {
    await createStarterSite(tx, null, { withCms: true });
  } catch (err) {
    if (err.status !== 409) throw err;
  }
}
