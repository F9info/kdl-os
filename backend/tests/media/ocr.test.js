import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const { prismaMock, minioMock, execFileMock, reindexMock } = vi.hoisted(() => ({
  prismaMock: {
    media: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    mediaFolder: { findUnique: vi.fn() },
  },
  minioMock: { getObject: vi.fn() },
  execFileMock: vi.fn(),
  reindexMock: vi.fn(),
}));

vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/config/minio.js', () => ({ minio: minioMock }));
vi.mock('../../src/modules/media/media-search.service.js', async (importOriginal) => ({
  ...(await importOriginal()),
  enqueueReindex: reindexMock,
}));
vi.mock('child_process', () => ({ execFile: execFileMock }));

const { runOcrJob, isOcrSupported } = await import('../../src/modules/media/ocr.service.js');
const { buildMediaDoc } = await import('../../src/modules/media/media-search.service.js');

async function* fakeStream(buf) {
  yield buf;
}

// execFile is promisified in the service — the mock must follow the
// (cmd, args, cb) callback signature.
const execBehavior = (fn) =>
  execFileMock.mockImplementation((cmd, args, cb) => {
    Promise.resolve(fn(cmd, args)).then(
      () => cb(null, { stdout: '', stderr: '' }),
      (err) => cb(err),
    );
  });

beforeEach(() => {
  vi.clearAllMocks();
  minioMock.getObject.mockResolvedValue(fakeStream(Buffer.from('bytes')));
  prismaMock.media.update.mockResolvedValue({});
});

describe('isOcrSupported', () => {
  it('accepts raster images and pdf, rejects others', () => {
    expect(isOcrSupported('image/png')).toBe(true);
    expect(isOcrSupported('application/pdf')).toBe(true);
    expect(isOcrSupported('video/mp4')).toBe(false);
    expect(isOcrSupported('image/svg+xml')).toBe(false);
  });
});

describe('runOcrJob', () => {
  it('throws 422 for unsupported mime type', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', mime_type: 'video/mp4', path: 'p' });
    await expect(runOcrJob({ mediaId: 'm1' })).rejects.toMatchObject({ status: 422 });
  });

  it('image: runs tesseract, stores ocr_text, reindexes', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm1', mime_type: 'image/png', path: 'u/x.png' });
    execBehavior(async (cmd, args) => {
      expect(cmd).toBe('tesseract');
      await writeFile(`${args[1]}.txt`, 'INVOICE #42 Total ₹1,200\n');
    });

    const result = await runOcrJob({ mediaId: 'm1' });

    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { ocr_text: 'INVOICE #42 Total ₹1,200' },
    });
    expect(reindexMock).toHaveBeenCalledWith('m1');
    expect(result.chars).toBeGreaterThan(0);
  });

  it('pdf with text layer: uses pdftotext, skips tesseract', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm2', mime_type: 'application/pdf', path: 'u/d.pdf' });
    execBehavior(async (cmd, args) => {
      if (cmd === 'pdftotext') {
        await writeFile(args[2], 'Quarterly report: revenue grew 14% year over year.\n');
      } else {
        throw new Error(`unexpected command ${cmd}`);
      }
    });

    await runOcrJob({ mediaId: 'm2' });

    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: 'm2' },
      data: { ocr_text: 'Quarterly report: revenue grew 14% year over year.' },
    });
  });

  it('scanned pdf (empty text layer): falls back to pdftoppm + tesseract per page', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm3', mime_type: 'application/pdf', path: 'u/s.pdf' });
    execBehavior(async (cmd, args) => {
      if (cmd === 'pdftotext') {
        await writeFile(args[2], '  \n'); // scanned pdf — no real text layer
      } else if (cmd === 'pdftoppm') {
        const prefix = args[args.length - 1];
        await writeFile(`${prefix}-1.png`, 'png');
        await writeFile(`${prefix}-2.png`, 'png');
      } else if (cmd === 'tesseract') {
        await writeFile(`${args[1]}.txt`, `text from ${args[0].split('/').pop()}`);
      }
    });

    await runOcrJob({ mediaId: 'm3' });

    const stored = prismaMock.media.update.mock.calls[0][0].data.ocr_text;
    expect(stored).toContain('text from page-1.png');
    expect(stored).toContain('text from page-2.png');
    expect(reindexMock).toHaveBeenCalledWith('m3');
  });

  it('stores null when OCR finds no text', async () => {
    prismaMock.media.findUnique.mockResolvedValue({ id: 'm4', mime_type: 'image/jpeg', path: 'u/b.jpg' });
    execBehavior(async (cmd, args) => {
      await writeFile(`${args[1]}.txt`, '\n');
    });

    await runOcrJob({ mediaId: 'm4' });

    expect(prismaMock.media.update).toHaveBeenCalledWith({
      where: { id: 'm4' },
      data: { ocr_text: null },
    });
  });
});

describe('D3 gate — search hits OCR content', () => {
  it('buildMediaDoc exposes ocr_text so Meili (searchableAttributes includes ocr_text) matches it', async () => {
    const doc = await buildMediaDoc({
      id: 'm1',
      original_name: 'scan.pdf',
      mime_type: 'application/pdf',
      type: 'DOCUMENT',
      user_id: 'u1',
      size: 1,
      ocr_text: 'INVOICE #42 payable to Acme Corp',
      tags: [],
      meta_values: [],
      folder: null,
      user: null,
      created_at: new Date('2026-07-01T00:00:00Z'),
      updated_at: new Date('2026-07-01T00:00:00Z'),
    });
    expect(doc.ocr_text).toBe('INVOICE #42 payable to Acme Corp');

    // The index settings must declare ocr_text searchable, otherwise the doc
    // field is stored but a query for "INVOICE" would never hit it.
    const src = await import('fs/promises').then((fs) =>
      fs.readFile(new URL('../../src/modules/media/media-search.service.js', import.meta.url), 'utf8'));
    expect(src).toMatch(/searchableAttributes:[^\]]*'ocr_text'/s);
  });
});
