// Login is closed until the wizard has finished. Fails CLOSED: if the status cannot be read the answer is
// "try again" (503), never "let them in". (A database that cannot answer this cannot check a password either.)
// Loads the status lazily so importing a router never needs a database connection.
export const requireInstalled = async (req, res, next) => {
  let done;
  try {
    done = await (await import('./status.js')).isInstalled();
  } catch {
    return res
      .status(503)
      .json({ success: false, message: 'The server could not check the installation status. Try again in a moment.', code: 'INSTALL_STATUS_UNAVAILABLE' });
  }
  if (done) return next();
  return res.status(403).json({ success: false, message: 'Finish the installation before signing in.', code: 'INSTALL_REQUIRED' });
};
