import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database.js';

async function main() {
  const password_hash = await bcrypt.hash('Admin@123', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@kdl.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@kdl.com',
      password_hash,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  });

  console.log('Seeded SUPER_ADMIN:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
