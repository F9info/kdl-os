import { randomUUID } from 'crypto';
import { mkdir, writeFile, readFile, readdir, rm, stat } from 'fs/promises';
import path from 'path';
import os from 'os';
import { getUploadSettings } from './settings.js';
import { uploadMedia } from './service.js';

// Parts + manifest live on local disk so an interrupted upload can resume
// across requests (and server restarts). Not shared across replicas — a
// multi-node deploy needs sticky sessions or a shared volume for this dir.
const CHUNK_ROOT = process.env.CHUNK_UPLOAD_DIR || path.join(os.tmpdir(), 'kdl-chunk-uploads');
const STALE_MS = 24 * 60 * 60 * 1000;
const MAX_PARTS = 10_000;

const uploadDir = (uploadId) => path.join(CHUNK_ROOT, uploadId);

const readManifest = async (uploadId) => {
  try {
    const raw = await readFile(path.join(uploadDir(uploadId), 'manifest.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const assertOwned = (manifest, userId) => {
  if (!manifest) throw Object.assign(new Error('Upload session not found'), { status: 404 });
  if (manifest.user_id !== userId) throw Object.assign(new Error('Upload session not found'), { status: 404 });
};

const listParts = async (uploadId) => {
  let names = [];
  try {
    names = await readdir(uploadDir(uploadId));
  } catch {
    return [];
  }
  return names
    .filter((n) => /^part-\d+$/.test(n))
    .map((n) => Number(n.slice(5)))
    .sort((a, b) => a - b);
};

// Best-effort GC of abandoned sessions; runs opportunistically on init.
export const sweepStaleUploads = async () => {
  let entries = [];
  try {
    entries = await readdir(CHUNK_ROOT);
  } catch {
    return;
  }
  await Promise.all(entries.map(async (name) => {
    try {
      const s = await stat(path.join(CHUNK_ROOT, name));
      if (Date.now() - s.mtimeMs > STALE_MS) {
        await rm(path.join(CHUNK_ROOT, name), { recursive: true, force: true });
      }
    } catch { /* already gone */ }
  }));
};

export const initChunkedUpload = async ({ filename, size, mime_type, folder_id, total_parts }, userId) => {
  const settings = await getUploadSettings();
  if (!settings.allowedMimes.has(mime_type)) {
    throw Object.assign(new Error(`File type not allowed: ${mime_type}`), { status: 422 });
  }
  if (size > settings.maxChunkedSizeBytes) {
    throw Object.assign(new Error(`File exceeds max size of ${settings.maxChunkedSizeMb}MB`), { status: 422 });
  }
  if (total_parts > MAX_PARTS) {
    throw Object.assign(new Error(`Too many parts (max ${MAX_PARTS})`), { status: 422 });
  }

  sweepStaleUploads().catch(() => {});

  const uploadId = randomUUID();
  const manifest = {
    upload_id: uploadId,
    user_id: userId,
    filename,
    size,
    mime_type,
    folder_id: folder_id ?? null,
    total_parts,
    created_at: new Date().toISOString(),
  };
  await mkdir(uploadDir(uploadId), { recursive: true });
  await writeFile(path.join(uploadDir(uploadId), 'manifest.json'), JSON.stringify(manifest));
  return { upload_id: uploadId, total_parts };
};

export const saveChunkPart = async (uploadId, index, buffer, userId) => {
  const manifest = await readManifest(uploadId);
  assertOwned(manifest, userId);
  if (!Number.isInteger(index) || index < 0 || index >= manifest.total_parts) {
    throw Object.assign(new Error(`Part index out of range (0..${manifest.total_parts - 1})`), { status: 422 });
  }

  // Cap enforcement mid-flight: received bytes may never exceed the declared size.
  const existing = await listParts(uploadId);
  let receivedBytes = 0;
  for (const p of existing) {
    if (p === index) continue; // re-uploading a part replaces it
    receivedBytes += (await stat(path.join(uploadDir(uploadId), `part-${p}`))).size;
  }
  if (receivedBytes + buffer.length > manifest.size) {
    throw Object.assign(new Error('Received data exceeds declared file size'), { status: 422 });
  }

  await writeFile(path.join(uploadDir(uploadId), `part-${index}`), buffer);
  const received = await listParts(uploadId);
  return { upload_id: uploadId, received_parts: received, total_parts: manifest.total_parts };
};

export const getChunkedStatus = async (uploadId, userId) => {
  const manifest = await readManifest(uploadId);
  assertOwned(manifest, userId);
  const received = await listParts(uploadId);
  return {
    upload_id: uploadId,
    filename: manifest.filename,
    size: manifest.size,
    total_parts: manifest.total_parts,
    received_parts: received,
    complete: received.length === manifest.total_parts,
  };
};

export const completeChunkedUpload = async (uploadId, userId) => {
  const manifest = await readManifest(uploadId);
  assertOwned(manifest, userId);

  const received = await listParts(uploadId);
  const missing = [];
  for (let i = 0; i < manifest.total_parts; i++) {
    if (!received.includes(i)) missing.push(i);
  }
  if (missing.length) {
    throw Object.assign(new Error(`Missing parts: ${missing.slice(0, 20).join(', ')}`), { status: 422, detail: { missing } });
  }

  const buffers = [];
  for (let i = 0; i < manifest.total_parts; i++) {
    buffers.push(await readFile(path.join(uploadDir(uploadId), `part-${i}`)));
  }
  const assembled = Buffer.concat(buffers);
  if (assembled.length !== manifest.size) {
    throw Object.assign(
      new Error(`Assembled size ${assembled.length} does not match declared size ${manifest.size}`),
      { status: 422 },
    );
  }

  const settings = await getUploadSettings();
  const file = {
    buffer: assembled,
    size: assembled.length,
    mimetype: manifest.mime_type,
    originalname: manifest.filename,
  };
  const media = await uploadMedia(file, userId, manifest.folder_id, { maxBytesOverride: settings.maxChunkedSizeBytes });

  await rm(uploadDir(uploadId), { recursive: true, force: true });
  return media;
};
