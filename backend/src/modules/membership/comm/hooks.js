import { prisma } from '../../../config/database.js';
import { emitMembershipEvent } from './dispatch.js';

/** For code outside the module (core auth): tell a member about an account/security change. Never throws. */
export async function notifyUser(userId, key, data = {}) {
  try {
    const member = await prisma.member.findUnique({ where: { user_id: userId }, select: { id: true } });
    if (member) await emitMembershipEvent(key, member.id, data);
  } catch {
    // not a member, or the membership tables are not there: nothing to tell
  }
}
