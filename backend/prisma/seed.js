import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/database.js';
import { resolveSeedAdminCredentials } from './seed-credentials.js';
import { runCoreSeed, planCoreSeed } from './core-seed.js';

async function main() {
  const { email, password, generated } = resolveSeedAdminCredentials();

  // The Super Admin comes first; the role seed below gives SEED_ADMIN_EMAIL the super-admin role.
  const createAdmin = async () => {
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
  };

  // Same ordered list the installer's "Core installation" step runs (core-seed.js).
  //   node prisma/seed.js --plan            show what would run and why, change nothing
  //   node prisma/seed.js --pending         run only seeders never run, failed, or whose version changed
  //   node prisma/seed.js --only=roles,credits   run those (and what they depend on)
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
  const pending = args.includes('--pending');
  if (args.includes('--plan')) {
    for (const p of await planCoreSeed(prisma, { only, pending })) {
      console.log(`${p.run ? 'run ' : 'skip'} ${p.name} v${p.version}  last: ${p.last ? `${p.last.status} v${p.last.version} ${p.last.at}` : 'never'}`);
    }
    return;
  }
  const onStep = ({ name, status }) => console.log(`seeder ${name}: ${status}`);
  await runCoreSeed(prisma, { createAdmin, only, pending, onStep });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
