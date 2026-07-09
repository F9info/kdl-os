// Cloud import driver registry (Phase D8). Every driver exposes the same contract:
//   list(creds, { path, cursor }, deps)  -> { entries: [{ id, name, size, mime, is_folder }], cursor }
//   download(creds, fileId, deps)        -> { buffer, name, mime, size }
// plus { name, auth: 'oauth' | 'credentials' }.

import gdrive from './gdrive.js';
import dropbox from './dropbox.js';
import onedrive from './onedrive.js';
import s3 from './s3.js';
import ftp from './ftp.js';

const registry = { gdrive, dropbox, onedrive, s3, ftp };

export default registry;

export const IMPORT_PROVIDERS = Object.keys(registry);

export function getImportDriver(provider) {
  const driver = registry[provider];
  if (!driver) {
    throw Object.assign(new Error(`Unknown import provider: ${provider}`), { status: 422 });
  }
  return driver;
}
