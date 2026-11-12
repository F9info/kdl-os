// Login is closed until the wizard has finished. Fails open if the status cannot be read (a database
// outage makes login fail on its own anyway), so a read error never locks an installed site out.
// Loads the status lazily so importing a router never needs a database connection.
export const requireInstalled = async (req, res, next) => {
  let done = true;
  try {
    done = await (await import('./status.js')).isInstalled();
  } catch {
    done = true;
  }
  if (done) return next();
  return res.status(403).json({ success: false, message: 'Finish the installation before signing in.', code: 'INSTALL_REQUIRED' });
};
