import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

// Development sign-ins for the other two working roles, so a fresh clone can try all three:
//   Super Admin  admin@kdl.com        (created by seed.js)
//   Developer    developer@kdl.com    builds the project
//   Admin        siteadmin@kdl.com    runs content and people
//
// Never seeded in production (no demo accounts on a real install). Each account gets a random password that is
// printed once, and must be changed at first login. Re-running never touches an existing account.
//   SEED_TEAM_USERS=false          skip these accounts
//   SEED_DEVELOPER_EMAIL / SEED_SITE_ADMIN_EMAIL   other addresses
//   SEED_TEAM_PASSWORD             one shared password for both (min 12 characters, not printed)

const MIN_PASSWORD_LENGTH = 12;

const ACCOUNTS = [
  { role: 'developer', name: 'Developer', emailEnv: 'SEED_DEVELOPER_EMAIL', defaultEmail: 'developer@kdl.com' },
  { role: 'admin', name: 'Admin', emailEnv: 'SEED_SITE_ADMIN_EMAIL', defaultEmail: 'siteadmin@kdl.com' },
];

/** Which accounts to create, with their passwords. Pure, so it is easy to test. */
export function planTeamUsers(env = process.env) {
  if (env.NODE_ENV === 'production' || env.SEED_TEAM_USERS === 'false') return [];
  const shared = env.SEED_TEAM_PASSWORD;
  if (shared && shared.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SEED_TEAM_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  return ACCOUNTS.map((a) => ({
    role: a.role,
    name: a.name,
    email: (env[a.emailEnv] || a.defaultEmail).trim().toLowerCase(),
    password: shared || crypto.randomBytes(18).toString('base64url'),
    generated: !shared,
  }));
}

/** Create the missing accounts. The roles must exist already (seedUserManagement creates them). */
export async function seedTeamUsers(prisma, env = process.env, log = console.log) {
  const created = [];
  for (const u of planTeamUsers(env)) {
    const role = await prisma.rbacRole.findUnique({ where: { slug: u.role }, select: { id: true } });
    if (!role) {
      log(`Skipped ${u.email}: the "${u.role}" role does not exist yet`);
      continue;
    }
    const existing = await prisma.user.findUnique({ where: { email: u.email }, select: { id: true } });
    if (existing) {
      log(`${u.name} user already exists, left untouched: ${u.email}`);
      continue;
    }
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password_hash: await bcrypt.hash(u.password, 12),
        is_active: true,
        // Provisional, like the seeded Super Admin: the app blocks everything until it is changed.
        must_change_password: true,
      },
    });
    await prisma.userRole.upsert({
      where: { user_id_role_id: { user_id: user.id, role_id: role.id } },
      update: {},
      create: { user_id: user.id, role_id: role.id },
    });
    log(`Seeded ${u.role} user: ${u.email}`);
    if (u.generated) log(`Generated one-time password for the ${u.role} user (shown only once): ${u.password}`);
    created.push(u.email);
  }
  return created;
}
