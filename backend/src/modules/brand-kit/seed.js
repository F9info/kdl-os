// Module-level seed entry point for the module installer (modules/service.js).
// Re-exports seedBrandKit as default so `installModule('brand-kit', ...)` seeds
// the webapp.brand-kit Type and all SettingField rows automatically, matching
// the theme-engine convention.  The prisma/seed.js path remains for pre-existing
// DBs that use `npm run db:seed` directly.
export { seedBrandKit as default } from '../../../prisma/seeders/brand-kit.seed.js';
