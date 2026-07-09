import path from 'path';
import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'dns/promises';
import { getUploadSettings } from './settings.js';
import { uploadMedia } from './service.js';
import { ensureFolderPath } from './file-ops.service.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

// Zip entries carry no MIME — resolve from extension against the same
// families as the upload whitelist. Nested archives are deliberately absent
// (zip-in-zip is a bomb vector, import the inner zip separately).
export const EXT_TO_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac',
  pdf: 'application/pdf', txt: 'text/plain', csv: 'text/csv',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  psd: 'image/vnd.adobe.photoshop', ai: 'application/postscript',
};

// ─── ZIP import ──────────────────────────────────────────────────────────────

// Validates a single zip entry against the whitelist + safety rules.
// entry: { name, size, isDirectory }. Returns { ok: true, mime } or { ok: false, reason }.
export const validateZipEntry = (entry, allowedMimes, perFileCapBytes) => {
  if (entry.isDirectory) return { ok: false, reason: 'directory', silent: true };

  const name = entry.name.replace(/\\/g, '/');
  const base = name.split('/').pop();

  if (name.startsWith('__MACOSX/') || base.startsWith('.')) {
    return { ok: false, reason: 'hidden or system file', silent: true };
  }
  // Zip-slip: absolute paths or traversal segments never touch the filesystem
  // (we extract to memory), but they also must not shape the folder tree.
  if (path.isAbsolute(name) || name.split('/').some((s) => s === '..')) {
    return { ok: false, reason: 'unsafe path' };
  }

  const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';
  const mime = EXT_TO_MIME[ext];
  if (!mime || !allowedMimes.has(mime)) {
    return { ok: false, reason: `file type not allowed: .${ext || '?'}` };
  }
  if (entry.size > perFileCapBytes) {
    return { ok: false, reason: 'exceeds max file size' };
  }
  return { ok: true, mime };
};

export const importZip = async (zipBuffer, { folder_id } = {}, userId) => {
  const settings = await getUploadSettings();
  const { default: AdmZip } = await import('adm-zip');

  let zip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw Object.assign(new Error('Invalid or corrupt zip file'), { status: 422 });
  }

  const entries = zip.getEntries();

  // Bomb guard: declared uncompressed total is bounded by the chunked ceiling.
  const declaredTotal = entries.reduce((sum, e) => sum + (e.header.size || 0), 0);
  if (declaredTotal > settings.maxChunkedSizeBytes) {
    throw Object.assign(new Error(`Zip contents exceed max total size of ${settings.maxChunkedSizeMb}MB`), { status: 422 });
  }

  const imported = [];
  const skipped = [];
  const folderCache = new Map();

  for (const entry of entries) {
    const name = entry.entryName;
    const verdict = validateZipEntry(
      { name, size: entry.header.size, isDirectory: entry.isDirectory },
      settings.allowedMimes,
      settings.maxFileSizeBytes,
    );
    if (!verdict.ok) {
      if (!verdict.silent) skipped.push({ entry: name, reason: verdict.reason });
      continue;
    }

    const data = entry.getData();
    // Header can lie about uncompressed size — re-check the real bytes.
    if (data.length > settings.maxFileSizeBytes) {
      skipped.push({ entry: name, reason: 'exceeds max file size' });
      continue;
    }

    const normalized = name.replace(/\\/g, '/');
    const base = normalized.split('/').pop();
    const segments = normalized.split('/').slice(0, -1).filter(Boolean);
    const targetFolder = await ensureFolderPath(folder_id ?? null, segments, userId, folderCache);

    const file = { buffer: data, size: data.length, mimetype: verdict.mime, originalname: base };
    try {
      const media = await uploadMedia(file, userId, targetFolder);
      imported.push({ id: media.id, name: base });
    } catch (err) {
      skipped.push({ entry: name, reason: err.message });
    }
  }

  writeActivityAsync({
    actor: userId, module: 'media', action: 'zip_imported',
    description: `Zip import: ${imported.length} file(s) imported, ${skipped.length} skipped`,
  });
  return { imported, skipped };
};

// ─── URL import ──────────────────────────────────────────────────────────────

export const isPrivateAddress = (ip) => {
  if (ip === '::1' || ip === '0.0.0.0' || ip === '::') return true;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1)
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split('.').map(Number);
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    return false;
  }
  const lower = ip.toLowerCase();
  return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
};

// SSRF guard: only public http(s) origins may be fetched.
export const assertSafeUrl = async (rawUrl, { lookup = dnsLookup } = {}) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('Invalid URL'), { status: 422 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw Object.assign(new Error('Only http(s) URLs are allowed'), { status: 422 });
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw Object.assign(new Error('URL host is not allowed'), { status: 422 });
  }
  let addresses;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw Object.assign(new Error('URL host could not be resolved'), { status: 422 });
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw Object.assign(new Error('URL host is not allowed'), { status: 422 });
  }
  // Return the validated address so the connection can be PINNED to it —
  // re-resolving at fetch time reopens a DNS-rebinding TOCTOU window.
  return { url: parsed, address: addresses[0].address, family: addresses[0].family };
};

// fetch-alike over node http/https with the connection pinned to a pre-validated
// IP: the custom `lookup` never re-queries DNS, so the address the SSRF guard
// approved is the address we connect to (Host header / TLS SNI keep the hostname).
const pinnedFetch = (parsed, { address, family }, timeoutMs = 30_000) =>
  new Promise((resolve, reject) => {
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(parsed, {
      lookup: (host, opts, cb) =>
        opts?.all ? cb(null, [{ address, family }]) : cb(null, address, family),
      timeout: timeoutMs,
    }, (res) => {
      resolve({
        status: res.statusCode,
        ok: res.statusCode >= 200 && res.statusCode < 300,
        headers: { get: (name) => {
          const v = res.headers[name.toLowerCase()];
          return Array.isArray(v) ? v[0] : v ?? null;
        } },
        body: res,
      });
    });
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
    req.on('error', reject);
    req.end();
  });

const filenameFromResponse = (parsedUrl, res, mime) => {
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(cd);
  if (m) return decodeURIComponent(m[1].trim().replace(/"$/, ''));
  const last = decodeURIComponent(parsedUrl.pathname.split('/').pop() || '');
  if (last) return last;
  const ext = Object.entries(EXT_TO_MIME).find(([, v]) => v === mime)?.[0];
  return ext ? `download.${ext}` : 'download';
};

const MAX_REDIRECTS = 3;

export const importFromUrl = async (rawUrl, { folder_id } = {}, userId, { fetchImpl = null, lookup } = {}) => {
  const settings = await getUploadSettings();
  const guardOpts = lookup ? { lookup } : {};

  // Redirects are followed manually so every hop passes the SSRF guard —
  // a public URL 302ing to an internal address must not be fetched. Each hop
  // connects to the exact IP the guard validated (see pinnedFetch).
  let safe = await assertSafeUrl(rawUrl, guardOpts);
  let parsed = safe.url;
  let res;
  for (let hop = 0; ; hop++) {
    try {
      res = fetchImpl
        ? await fetchImpl(parsed.href, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
        : await pinnedFetch(parsed, safe);
    } catch {
      throw Object.assign(new Error('Failed to fetch URL'), { status: 422 });
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop >= MAX_REDIRECTS) {
        throw Object.assign(new Error('Too many redirects'), { status: 422 });
      }
      safe = await assertSafeUrl(new URL(res.headers.get('location'), parsed.href).href, guardOpts);
      parsed = safe.url;
      continue;
    }
    break;
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Failed to fetch URL (HTTP ${res.status})`), { status: 422 });
  }

  // MIME re-check: trust the response header, not the URL extension.
  const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!settings.allowedMimes.has(mime)) {
    throw Object.assign(new Error(`File type not allowed: ${mime || 'unknown'}`), { status: 422 });
  }

  const cap = settings.maxFileSizeBytes;
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap) {
    throw Object.assign(new Error(`File exceeds max size of ${settings.maxFileSizeMb}MB`), { status: 422 });
  }

  // Stream with a hard cap — content-length can be absent or lie.
  const chunks = [];
  let total = 0;
  for await (const chunk of res.body) {
    total += chunk.length;
    if (total > cap) {
      // throwing exits for-await, which returns the iterator and cancels the stream
      throw Object.assign(new Error(`File exceeds max size of ${settings.maxFileSizeMb}MB`), { status: 422 });
    }
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  const file = { buffer, size: buffer.length, mimetype: mime, originalname: filenameFromResponse(parsed, res, mime) };
  const media = await uploadMedia(file, userId, folder_id ?? null);
  writeActivityAsync({
    actor: userId, module: 'media', action: 'url_imported',
    description: `Imported "${file.originalname}" from URL`,
  });
  return media;
};
