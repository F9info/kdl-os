import { seedCmsSamples } from './pages.js';
import { createStarterSite, saveChoice } from '../projects/onboarding.js';

// Runs inside the install transaction. Installing CMS is the choice to have a website, so it
// generates the demo website (starter pages plus the CMS pages) with the company name from
// Application Identity, and records that the "front-end website" question is answered. Nothing to
// ask. Safe to re-run: existing pages are never touched. With no default project yet there is
// nothing to attach pages to, so the site is simply not generated.
export default async function seed(tx) {
  await seedCmsSamples(tx);
  try {
    await createStarterSite(tx, null, { withCms: true });
  } catch (err) {
    if (err.status !== 409) throw err;
    return;
  }
  await saveChoice('yes', tx);
}
