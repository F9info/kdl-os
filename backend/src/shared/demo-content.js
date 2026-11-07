// The sample ("DemoLogo") content is opt-in. The Setup Wizard asks "Create a starter website?" and stores the
// answer; module install seeds put their sample rows in ONLY when the answer is "yes", and answering "yes"
// later seeds them for the modules already installed (projects/onboarding.js). Without an answer, or with "no",
// installing a module adds its tools and no placeholder content.
export const ONBOARDING_KEY = 'onboarding.frontend';

export const demoAccepted = async (client) =>
  (await client.appSetting.findUnique({ where: { key: ONBOARDING_KEY } }))?.value === 'yes';
