// Prints a new installer setup token (the old one stops working). Use it when the first-start log line is lost:
//   npm run install:token            (or: docker compose exec backend node scripts/install-token.js)
// Only while the installation is still open. A token set with KDL_SETUP_TOKEN in the environment takes priority
// over this one, so change that variable instead if you use it.
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { isInstalled } from '../src/shared/install/status.js';
import { regenerateSetupToken, envToken } from '../src/shared/install/setup-token.js';

try {
  if (await isInstalled(prisma)) {
    console.log('The installation is already complete: there is no setup token to print.');
  } else if (envToken()) {
    console.log('KDL_SETUP_TOKEN is set in the environment and is the token in use. Change that variable to rotate it.');
  } else {
    console.log('New setup token (shown once):', await regenerateSetupToken(prisma));
  }
} finally {
  await prisma.$disconnect();
}
