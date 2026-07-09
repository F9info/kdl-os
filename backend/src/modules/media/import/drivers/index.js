import googleDrive from './google-drive.js';
import dropbox from './dropbox.js';
import onedrive from './onedrive.js';
import s3 from './s3.js';
import ftp from './ftp.js';

const registry = {
  'google-drive': googleDrive,
  dropbox,
  onedrive,
  s3,
  ftp,
};

export default registry;

export function getImportDriver(providerName) {
  const d = registry[providerName];
  if (!d) throw new Error(`Unknown import provider: ${providerName}`);
  return d;
}

export const OAUTH_PROVIDERS = Object.values(registry).filter((d) => d.oauth).map((d) => d.provider);
export const MANUAL_PROVIDERS = Object.values(registry).filter((d) => !d.oauth).map((d) => d.provider);
