import { seedCmsSamples } from './pages.js';
import { createStarterSite, ONBOARDING_KEY } from '../projects/onboarding.js';
import { seedDemoLandingPages } from '../landing/demo.js';

export const DEMO_SUMMARY_KEY = 'frontend.demo_summary';

// Runs inside the install transaction. Installing Frontend (CMS) installs the tools AND a ready demo:
// the starter website (Home, About, Services, Contact, FAQ + the CMS pages), the sample content rows and
// four landing pages (Business, SaaS, Agency, Startup). The only way to skip it is an explicit "no" to
// "start with a sample website" in the Setup Wizard.
//
// Safe to re-run: a page or row that exists (even edited or soft-deleted) is never touched or recreated.
// With no default project yet there is nothing to attach the demo to, so it is skipped.
// A summary of what was created is stored under DEMO_SUMMARY_KEY for the "Frontend installed" screen.
export default async function seed(tx) {
  const answer = await tx.appSetting.findUnique({ where: { key: ONBOARDING_KEY } });
  if (answer?.value === 'no') return;

  const summary = { website: { created: [], skipped: [] }, landing: { created: [], skipped: [] } };
  await seedCmsSamples(tx);
  try {
    summary.website = await createStarterSite(tx, null, { withCms: true });
    summary.landing = await seedDemoLandingPages(tx, null);
  } catch (err) {
    if (err.status !== 409) throw err;
  }

  const value = JSON.stringify({ ...summary, at: new Date().toISOString() });
  await tx.appSetting.upsert({
    where: { key: DEMO_SUMMARY_KEY },
    update: { value },
    create: { key: DEMO_SUMMARY_KEY, value, type: 'json', description: 'What the Frontend install created (demo site and landing pages)' },
  });
}
