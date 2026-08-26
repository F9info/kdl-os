import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database.js';
import { resolveSeedAdminCredentials } from './seed-credentials.js';
import { seedUserManagement } from './seeders/user-management.seed.js';
import { seedCoreModules } from './seeders/modules.seed.js';
import { seedBrandKit } from './seeders/brand-kit.seed.js';
import { seedBrandProfileFields } from './seeders/brand-profile-fields.seed.js';
import { seedProjects } from '../src/modules/projects/seed.js';

async function main() {
  const { email, password, generated } = resolveSeedAdminCredentials();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    console.log('Admin user already exists, credentials left untouched:', email);
  } else {
    const password_hash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email,
        password_hash,
        is_active: true,
        // Seeded credentials are provisional — the app blocks all access
        // until the admin sets their own password (KDL-283).
        must_change_password: true,
      },
    });
    console.log('Seeded admin:', admin.email);
    if (generated) {
      console.log('Generated one-time admin password (shown only once):', password);
      console.log('Store it now and change it immediately after first login.');
    }
  }

  // Core modules (incl. media's manifest-driven permissions) must be
  // registered before seedUserManagement so its Admin-role grant can see them.
  await seedCoreModules(prisma);
  await seedProjects(prisma);
  await seedUserManagement(prisma);
  await seedBrandKit(prisma);
  await seedBrandProfileFields(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
