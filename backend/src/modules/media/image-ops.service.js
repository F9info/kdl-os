import { createHash } from 'crypto';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';
import { createMediaVersion } from './processing.service.js';
import { isSvgMime } from './svg-sanitizer.js';
import * as storageService from '../../shared/services/storage.service.js';

const getMimeExt = (mime) => {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/avif': 'avif', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  };
  return map[mime] ?? 'jpg';
};

// Mime types this service knows how to edit. Anything else (tiff, heic, …)
// fails fast here instead of silently producing corrupted bytes — the
// frontend also hides the Edit button for mimes outside this set.
const EDITABLE_RASTER_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

// Ops that can be expressed as pure SVG markup edits (viewBox/width/height/
// transform) without ever rasterizing — so vector SVGs stay vector and text
// never gets rendered to glyphs (avoiding the missing-font "boxes" problem).
const SVG_VECTOR_SAFE_OPS = new Set(['resize', 'crop', 'rotate', 'flip', 'flop']);

const round2 = (n) => Math.round(n * 100) / 100;

const swapFilenameExt = (filename, newExt) => {
  const dot = filename.lastIndexOf('.');
  const base = dot === -1 ? filename : filename.slice(0, dot);
  return `${base}.${newExt}`;
};

const mediaFilename = (media) => media.filename ?? media.path.substring(media.path.lastIndexOf('/') + 1);

const buildPipeline = async (sharpInstance, ops, media) => {
  const { default: sharp } = await import('sharp');
  let pipe = sharpInstance;

  for (const op of ops) {
    switch (op.op) {
      case 'crop':
        pipe = pipe.extract({ left: op.left, top: op.top, width: op.width, height: op.height });
        break;
      case 'resize':
        pipe = pipe.resize({ width: op.width, height: op.height, fit: op.fit ?? 'inside', withoutEnlargement: true });
        break;
      case 'rotate':
        pipe = pipe.rotate(op.angle, op.background ? { background: op.background } : {});
        break;
      case 'flip':
        pipe = pipe.flip();
        break;
      case 'flop':
        pipe = pipe.flop();
        break;
      case 'brightness':
        pipe = pipe.modulate({ brightness: op.factor });
        break;
      case 'contrast': {
        // sharp linear: y = a*x + b. contrast factor > 1 = more contrast
        const a = op.factor;
        const b = -(128 * (a - 1));
        pipe = pipe.linear(a, b);
        break;
      }
      case 'saturation':
        pipe = pipe.modulate({ saturation: op.factor });
        break;
      case 'grayscale':
        pipe = pipe.grayscale();
        break;
      case 'blur':
        pipe = pipe.blur(op.sigma ?? 2);
        break;
      case 'sharpen':
        pipe = pipe.sharpen();
        break;
      case 'negate':
        pipe = pipe.negate();
        break;
      case 'text_watermark': {
        // Render text onto a transparent SVG then composite
        const meta = await pipe.metadata();
        const w = meta.width ?? 800;
        const h = meta.height ?? 600;
        const fontSize = op.font_size ?? 24;
        const color = op.color ?? '#ffffff';
        const opacity = op.opacity ?? 0.7;
        const positions = {
          'top-left': { x: 10, y: fontSize + 10, anchor: 'start' },
          'top-center': { x: Math.floor(w / 2), y: fontSize + 10, anchor: 'middle' },
          'top-right': { x: w - 10, y: fontSize + 10, anchor: 'end' },
          'center': { x: Math.floor(w / 2), y: Math.floor(h / 2), anchor: 'middle' },
          'bottom-left': { x: 10, y: h - 10, anchor: 'start' },
          'bottom-center': { x: Math.floor(w / 2), y: h - 10, anchor: 'middle' },
          'bottom-right': { x: w - 10, y: h - 10, anchor: 'end' },
        };
        const pos = positions[op.position ?? 'bottom-right'];
        const svg = `<svg width="${w}" height="${h}"><text x="${pos.x}" y="${pos.y}" font-size="${fontSize}" fill="${color}" fill-opacity="${opacity}" text-anchor="${pos.anchor}" font-family="sans-serif">${op.text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))}</text></svg>`;
        pipe = pipe.composite([{ input: Buffer.from(svg), blend: 'over' }]);
        break;
      }
      case 'logo_watermark': {
        const { minio } = await import('../../config/minio.js');
        const logo = await prisma.media.findUnique({ where: { id: op.logo_media_id }, select: { path: true } });
        if (!logo) throw new Error('Logo media not found');
        const stream = await minio.getObject(process.env.MINIO_BUCKET, logo.path);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const logoBuffer = Buffer.concat(chunks);
        const meta = await pipe.metadata();
        const w = meta.width ?? 800;
        const h = meta.height ?? 600;
        const scale = op.scale ?? 0.2;
        const logoW = Math.round(w * scale);
        const resizedLogo = await sharp(logoBuffer).resize(logoW).png().toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const padding = 10;
        const positions = {
          'top-left': { top: padding, left: padding },
          'top-center': { top: padding, left: Math.floor((w - (logoMeta.width ?? logoW)) / 2) },
          'top-right': { top: padding, left: w - (logoMeta.width ?? logoW) - padding },
          'center': { top: Math.floor((h - (logoMeta.height ?? logoW)) / 2), left: Math.floor((w - (logoMeta.width ?? logoW)) / 2) },
          'bottom-left': { top: h - (logoMeta.height ?? logoW) - padding, left: padding },
          'bottom-center': { top: h - (logoMeta.height ?? logoW) - padding, left: Math.floor((w - (logoMeta.width ?? logoW)) / 2) },
          'bottom-right': { top: h - (logoMeta.height ?? logoW) - padding, left: w - (logoMeta.width ?? logoW) - padding },
        };
        const pos = positions[op.position ?? 'bottom-right'];
        pipe = pipe.composite([{ input: resizedLogo, blend: 'over', ...pos }]);
        break;
      }
      case 'compress': {
        const fmt = op.format ?? getMimeExt(media.mime_type);
        const quality = op.quality ?? 80;
        if (fmt === 'jpeg' || fmt === 'jpg') pipe = pipe.jpeg({ quality });
        else if (fmt === 'webp') pipe = pipe.webp({ quality });
        else if (fmt === 'avif') pipe = pipe.avif({ quality });
        else if (fmt === 'png') pipe = pipe.png({ compressionLevel: Math.round((100 - quality) / 11) });
        break;
      }
    }
  }
  return pipe;
};

const EXT_TO_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

// ─── SVG vector editing ──────────────────────────────────────────────────────
// Resize/crop/rotate/flip/flop are expressible as pure SVG attribute/transform
// edits, so a resized SVG stays a valid, text-intact SVG instead of being
// rasterized (which previously produced corrupt/boxed-text output). Any other
// op (color adjustments, watermark, compress, …) genuinely needs pixels, so
// those fall back to rasterizing to PNG first (see rasterizeSvg below).

// Matches either `<svg ...>` (capture group 1 empty) or a self-closing
// `<svg .../>` (capture group 1 = the trailing slash), and separately any
// `</svg>` close tag — used together below to find the close tag that
// actually matches the outer <svg>, not just the first `</svg>` in the
// document (icon sprites / `<symbol>` markup commonly nest <svg> elements).
const SVG_ANY_TAG_RE = /<svg\b[^>]*?(\/)?>|<\/svg\s*>/gi;

const parseNum = (v) => {
  if (v === undefined) return null;
  const m = String(v).match(/-?[\d.]+/);
  return m ? parseFloat(m[0]) : null;
};

const getAttr = (attrsStr, name) => {
  const m = attrsStr.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[2] ?? m[3]) : undefined;
};

const parseSvg = (svgText) => {
  SVG_ANY_TAG_RE.lastIndex = 0;
  const openMatch = SVG_ANY_TAG_RE.exec(svgText);
  if (!openMatch || openMatch[0].startsWith('</')) throw new Error('Not a valid SVG document');

  const selfClosing = Boolean(openMatch[1]);
  const attrsStr = openMatch[0].slice(4, openMatch[0].length - (selfClosing ? 2 : 1));
  const tagEnd = openMatch.index + openMatch[0].length;

  let inner = '';
  let suffixStart = tagEnd;
  if (!selfClosing) {
    // Walk remaining <svg>/</svg> tokens tracking nesting depth so a nested
    // <svg> (sprite/symbol reuse) doesn't fool us into stopping at its close tag.
    let depth = 1;
    let m;
    let closeIdx = -1;
    let closeLen = 0;
    while ((m = SVG_ANY_TAG_RE.exec(svgText))) {
      if (m[0].startsWith('</')) {
        depth -= 1;
        if (depth === 0) { closeIdx = m.index; closeLen = m[0].length; break; }
      } else if (!m[1]) {
        depth += 1;
      }
    }
    if (closeIdx === -1) throw new Error('Not a valid SVG document (no matching </svg>)');
    inner = svgText.slice(tagEnd, closeIdx);
    suffixStart = closeIdx + closeLen;
  }

  const viewBoxRaw = getAttr(attrsStr, 'viewBox');
  let minX = 0, minY = 0, vbW = null, vbH = null;
  if (viewBoxRaw) {
    const parts = viewBoxRaw.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) [minX, minY, vbW, vbH] = parts;
  }
  const width = parseNum(getAttr(attrsStr, 'width')) ?? vbW ?? 300;
  const height = parseNum(getAttr(attrsStr, 'height')) ?? vbH ?? 150;
  if (vbW === null) { vbW = width; vbH = height; }

  return {
    prefix: svgText.slice(0, openMatch.index),
    attrsStr,
    inner,
    suffix: svgText.slice(suffixStart),
    selfClosing,
    minX, minY, vbW, vbH, width, height,
  };
};

const buildSvgTag = (attrsStr, { minX, minY, vbW, vbH, width, height }) => {
  const stripped = attrsStr.replace(/\s(width|height|viewBox)\s*=\s*("[^"]*"|'[^']*')/gi, '');
  return `<svg${stripped} width="${round2(width)}" height="${round2(height)}" viewBox="${round2(minX)} ${round2(minY)} ${round2(vbW)} ${round2(vbH)}">`;
};

const computeResizeDims = (curW, curH, op) => {
  let { width, height, fit = 'inside' } = op;
  if (!width && !height) return { width: curW, height: curH };
  if (width && !height) return { width, height: Math.round((curH / curW) * width) };
  if (height && !width) return { width: Math.round((curW / curH) * height), height };
  if (fit === 'fill') return { width, height };
  const scale = fit === 'cover' || fit === 'outside' ? Math.max(width / curW, height / curH) : Math.min(width / curW, height / curH);
  return { width: Math.round(curW * scale), height: Math.round(curH * scale) };
};

const applySvgVectorOps = (svgText, ops) => {
  const parsed = parseSvg(svgText);
  let { minX, minY, vbW, vbH, width, height, inner } = parsed;

  for (const op of ops) {
    switch (op.op) {
      case 'resize': {
        const dims = computeResizeDims(width, height, op);
        width = dims.width;
        height = dims.height;
        break;
      }
      case 'crop': {
        const scaleX = vbW / width;
        const scaleY = vbH / height;
        minX = minX + op.left * scaleX;
        minY = minY + op.top * scaleY;
        vbW = op.width * scaleX;
        vbH = op.height * scaleY;
        width = op.width;
        height = op.height;
        break;
      }
      case 'rotate': {
        const rad = (op.angle * Math.PI) / 180;
        const cx = minX + vbW / 2;
        const cy = minY + vbH / 2;
        const newVbW = Math.abs(vbW * Math.cos(rad)) + Math.abs(vbH * Math.sin(rad));
        const newVbH = Math.abs(vbW * Math.sin(rad)) + Math.abs(vbH * Math.cos(rad));
        inner = `<g transform="rotate(${op.angle} ${round2(cx)} ${round2(cy)})">${inner}</g>`;
        width = round2(width * (newVbW / vbW));
        height = round2(height * (newVbH / vbH));
        minX = cx - newVbW / 2;
        minY = cy - newVbH / 2;
        vbW = newVbW;
        vbH = newVbH;
        break;
      }
      case 'flip':
        inner = `<g transform="matrix(1,0,0,-1,0,${round2(2 * minY + vbH)})">${inner}</g>`;
        break;
      case 'flop':
        inner = `<g transform="matrix(-1,0,0,1,${round2(2 * minX + vbW)},0)">${inner}</g>`;
        break;
      default:
        throw new Error(`SVG vector op not supported: ${op.op}`);
    }
  }

  const newTag = buildSvgTag(parsed.attrsStr, { minX, minY, vbW, vbH, width, height });
  return { svgText: `${parsed.prefix}${newTag}${inner}</svg>${parsed.suffix}`, width: Math.round(width), height: Math.round(height) };
};

// SVG resize/crop/rotate/flip/flop stay vector. Any other op needs actual
// pixels (brightness, watermark, compress, …), so we rasterize to PNG first —
// bump the render density if the target size is larger than the source so
// the rasterized bytes aren't blurry.
const rasterizeSvg = async (svgBuffer, ops) => {
  const { default: sharp } = await import('sharp');
  const { width: srcW, height: srcH } = parseSvg(svgBuffer.toString('utf8'));
  const resizeOp = ops.find((o) => o.op === 'resize');
  let density = 96;
  if (resizeOp) {
    const targetMax = Math.max(resizeOp.width ?? 0, resizeOp.height ?? 0);
    const curMax = Math.max(srcW, srcH);
    if (targetMax > curMax) density = Math.min(1200, Math.round(96 * (targetMax / curMax)));
  }
  return sharp(svgBuffer, { density }).png().toBuffer();
};

export const runImageEdit = async ({ mediaId, ops, note, createdBy }) => {
  const { default: sharp } = await import('sharp');
  const { minio } = await import('../../config/minio.js');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new Error(`Media ${mediaId} not found`);

  const svgInput = isSvgMime(media.mime_type);
  if (!svgInput && !EDITABLE_RASTER_MIMES.has(media.mime_type)) {
    throw new Error(`Image editing is not supported for mime type "${media.mime_type}"`);
  }

  const stream = await minio.getObject(process.env.MINIO_BUCKET, media.path);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const inputBuffer = Buffer.concat(chunks);

  let outputBuffer;
  let ext;
  let width = null;
  let height = null;
  let vectorEdited = false;

  if (svgInput && ops.every((op) => SVG_VECTOR_SAFE_OPS.has(op.op))) {
    // Pure vector edit — never touches pixels, text stays text. If the source
    // markup is unusual enough that rewriting/validating it fails (malformed
    // tag, unsupported nesting, …), fall through to rasterizing below instead
    // of aborting the whole job — a rasterized result beats a failed edit
    // that silently leaves the original file untouched.
    try {
      const result = applySvgVectorOps(inputBuffer.toString('utf8'), ops);
      const candidate = Buffer.from(result.svgText, 'utf8');
      // Validate the rewritten markup is still a well-formed SVG before saving.
      await sharp(candidate).metadata();
      outputBuffer = candidate;
      ext = 'svg';
      width = result.width;
      height = result.height;
      vectorEdited = true;
    } catch (err) {
      logger.warn(`SVG vector edit failed for media ${mediaId}, falling back to raster: ${err.message}`);
    }
  }

  if (!vectorEdited) {
    const media_ = svgInput ? { ...media, mime_type: 'image/png' } : media;
    const sourceBuffer = svgInput ? await rasterizeSvg(inputBuffer, ops) : inputBuffer;
    const animatedInput = media.mime_type === 'image/gif' || media.mime_type === 'image/webp';
    const pipeline = await buildPipeline(sharp(sourceBuffer, animatedInput ? { animated: true } : undefined), ops, media_);

    const compressOp = [...ops].reverse().find((o) => o.op === 'compress');
    ext = compressOp?.format ?? (svgInput ? 'png' : getMimeExt(media.mime_type));
    let finalPipe = pipeline;
    if (!compressOp) {
      if (ext === 'jpg' || ext === 'jpeg') finalPipe = pipeline.jpeg({ quality: 90 });
      else if (ext === 'webp') finalPipe = pipeline.webp({ quality: 90 });
      else if (ext === 'png') finalPipe = pipeline.png();
      else if (ext === 'avif') finalPipe = pipeline.avif({ quality: 90 });
      else if (ext === 'gif') finalPipe = pipeline.gif();
    }

    outputBuffer = await finalPipe.toBuffer();
    // Validate before saving — a genuinely uneditable/corrupt result throws
    // here instead of silently overwriting the stored file.
    const outMeta = await sharp(outputBuffer).metadata();
    width = outMeta.width ?? null;
    height = outMeta.height ?? null;
  }

  // Snapshot the pre-edit bytes as a version (separate versioned path, same
  // convention as createMediaVersion elsewhere) so edits are undoable.
  const { version } = await createMediaVersion(mediaId, {
    buffer: inputBuffer,
    ext: getMimeExt(media.mime_type),
    note: note ?? 'pre-edit snapshot',
    createdBy,
  });

  // Apply the edit to the served file. Write through storageService (not the
  // raw minio client) so Content-Type is set from the new mime — a bare
  // putObject() defaults to binary/octet-stream, which MinIO's nosniff header
  // then stops browsers from ever decoding as an <img>. When the format
  // changes (SVG rasterized to PNG, `compress` reformat, …) write to a NEW
  // key with the correct extension instead of reusing the old one, so path/
  // filename/content-type all agree — the old object (and its now-orphaned
  // variants) is only deleted after the record no longer points at it.
  const newMimeType = EXT_TO_MIME[ext] ?? media.mime_type;
  const currentExt = media.path.slice(media.path.lastIndexOf('.') + 1);
  const extChanged = ext !== currentExt;
  const dir = media.path.substring(0, media.path.lastIndexOf('/'));
  const base = media.path.substring(media.path.lastIndexOf('/') + 1, media.path.lastIndexOf('.'));
  const newPath = extChanged ? `${dir}/${base}.${ext}` : media.path;

  await storageService.uploadFile(
    { buffer: outputBuffer, size: outputBuffer.length, mimetype: newMimeType, originalname: `${base}.${ext}` },
    newPath
  );

  const checksum = createHash('sha256').update(outputBuffer).digest('hex');
  const { generateVariants } = await import('./media.worker.js');
  const variantResult = await generateVariants(outputBuffer, newPath);

  const { MIME_TO_TYPE } = await import('./service.js');

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      filename: swapFilenameExt(mediaFilename(media), ext),
      path: newPath,
      size: outputBuffer.length,
      checksum,
      mime_type: newMimeType,
      type: MIME_TO_TYPE(newMimeType),
      width: width ?? variantResult.width,
      height: height ?? variantResult.height,
      variants: variantResult.variants,
    },
  });

  // Record now points at newPath — safe to drop the stale original key.
  // Variant keys are `variants/<uuid>_<size>.webp`, derived only from the
  // media's uuid (never the extension), so generateVariants() above always
  // overwrote the SAME variant keys the pre-edit record already pointed at —
  // they're never orphaned. Deleting media.variants here would delete the
  // variants that were just regenerated.
  if (extChanged) {
    await storageService.deleteFiles([media.path])
      .catch((e) => logger.warn(`cleanup of stale media object after edit failed: ${e.message}`));
  }

  const { indexMediaById } = await import('./media-search.service.js');
  await indexMediaById(mediaId).catch((e) => logger.warn(`search reindex after image edit failed: ${e.message}`));

  logger.info(`Image edit applied for media ${mediaId} → version ${version.version}`);
  return { version_id: version.id, version: version.version };
};
