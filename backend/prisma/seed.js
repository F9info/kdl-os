import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database.js';
import { seedUserManagement } from './seeders/user-management.seed.js';
import { seedCoreModules } from './seeders/modules.seed.js';

async function main() {
  const password_hash = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@kdl.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@kdl.com',
      password_hash,
      is_active: true,
    },
  });

  console.log('Seeded admin:', admin.email);

  // Core modules (incl. media's manifest-driven permissions) must be
  // registered before seedUserManagement so its Admin-role grant can see them.
  await seedCoreModules(prisma);
  await seedUserManagement(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
