// Phase B: seed extra permission actions for the media module.
// Actions: download, share, approve (in addition to view/add/edit/delete/publish).
// Total media actions after seed: 8.  Upsert-safe — idempotent.

const EXTRA_ACTIONS = ['download', 'share', 'approve'];

export async function seedMediaPhaseB(prisma) {
  const module = await prisma.permissionModule.findUnique({ where: { name: 'media' } });
  if (!module) {
    console.log('seedMediaPhaseB: media module not found — skipping (run seedUserManagement first)');
    return;
  }

  for (const action of EXTRA_ACTIONS) {
    await prisma.permission.upsert({
      where: { module_id_action: { module_id: module.id, action } },
      update: {},
      create: { module_id: module.id, action },
    });
  }

  // Grant download + share + approve to the admin role
  const adminRole = await prisma.rbacRole.findUnique({ where: { slug: 'admin' } });
  if (adminRole) {
    for (const action of EXTRA_ACTIONS) {
      const perm = await prisma.permission.findUnique({
        where: { module_id_action: { module_id: module.id, action } },
      });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { role_id_permission_id: { role_id: adminRole.id, permission_id: perm.id } },
          update: {},
          create: { role_id: adminRole.id, permission_id: perm.id },
        });
      }
    }
  }

  const total = await prisma.permission.count({ where: { module_id: module.id } });
  console.log(`seedMediaPhaseB: media module now has ${total} actions (expected 8)`);
}
