import { seedCmsSamples, applyCmsSite } from './pages.js';

// Runs inside the install transaction: sample FAQ + gallery rows, then (if the admin chose
// a front-end website) the CMS pages. Safe to re-run.
export default async function seed(tx) {
  await seedCmsSamples(tx);
  await applyCmsSite(tx);
}
