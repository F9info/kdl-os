import { readIdentity } from './read.js';

// Company info for the website seed (template-engine) and print layouts (collateral).
// Single source of truth: Application Identity (Settings > Identity, `identity.*` app_settings).
// The older `brand-profile-*` setting fields were a second copy of the same data; they are no longer
// read or written (a one-time migration copied their values into Identity) and stay in the
// database only so nothing the user saved is lost.
export async function getCompanyInfo(_projectId) {
  const identity = await readIdentity();
  const value = (key) => identity[key]?.trim() || null;
  const address = value('contact_address');
  return {
    company_name: value('app_name'),
    email: value('contact_email'),
    phone: value('contact_phone'),
    secondaryEmail: value('contact_email_secondary'),
    secondaryPhone: value('contact_phone_secondary'),
    // One address field; a line break splits it into lines for print layouts.
    addressLines: address
      ? address
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
      : [],
  };
}
