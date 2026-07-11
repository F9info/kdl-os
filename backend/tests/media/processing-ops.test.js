import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted stateful mock factories ────────────────────────────────────────
const { sharpFactory, ffmpegFactory, pdfDocFactory } = vi.hoisted(() => {
  const makeSharpChain = () => {
    const c = {
      extract:   vi.fn(),
      resize:    vi.fn(),
      grayscale: vi.fn(),
      blur:      vi.fn(),
      sharpen:   vi.fn(),
      negate:    vi.fn(),
      flip:      vi.fn(),
      flop:      vi.fn(),
      rotate:    vi.fn(),
      modulate:  vi.fn(),
      linear:    vi.fn(),
      composite: vi.fn(),
      jpeg:      vi.fn(),
      webp:      vi.fn(),
      avif:      vi.fn(),
      png:       vi.fn(),
      metadata:  vi.fn().mockResolvedValue({ width: 800, height: 600 }),
      toBuffer:  vi.fn().mockResolvedValue(Buffer.from('fake-img')),
    };
    [
      'extract','resize','grayscale','blur','sharpen','negate','flip','flop',
      'rotate','modulate','linear','composite','jpeg','webp','avif','png',
    ].forEach((m) => c[m].mockImplementation(() => c));
    return c;
  };

  const sf = { current: null, first: null };
  sf.make = () => {
    const c = makeSharpChain();
    sf.current = c;
    if (!sf.first) sf.first = c;
    return c;
  };
  sf.make();

  const makeFfmpegChain = () => {
    const handlers = {};
    const c = {};
    [
      'seekInput','duration','outputOptions','output','size','videoBitrate','audioBitrate',
      'videoCodec','audioCodec','audioFilters','audioChannels','audioFrequency','format',
      'videoFilters','complexFilter','map','frames',
    ].forEach((m) => { c[m] = vi.fn().mockImplementation(() => c); });
    c.on  = vi.fn().mockImplementation((evt, fn) => { handlers[evt] = fn; return c; });
    c.run = vi.fn().mockImplementation(() => { handlers.end?.(); });
    return c;
  };

  const ff = { current: null };
  ff.make = () => { ff.current = makeFfmpegChain(); return ff.current; };
  ff.make();

  const makePageMock = () => ({
    getSize: vi.fn().mockReturnValue({ width: 612, height: 792 }),
    drawText: vi.fn(),
  });
  const makePdfDoc = () => ({
    getPageCount:  vi.fn().mockReturnValue(3),
    getTitle:      vi.fn().mockReturnValue('Test PDF'),
    getAuthor:     vi.fn().mockReturnValue('Author Name'),
    getSubject:    vi.fn().mockReturnValue(null),
    getPageIndices:vi.fn().mockReturnValue([0, 1, 2]),
    getPages:      vi.fn().mockReturnValue([makePageMock()]),
    copyPages:     vi.fn().mockResolvedValue([{}]),
    addPage:       vi.fn(),
    embedFont:     vi.fn().mockResolvedValue({}),
    save:          vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  });
  const pf = { loaded: makePdfDoc(), created: makePdfDoc() };

  return { sharpFactory: sf, ffmpegFactory: ff, pdfDocFactory: pf };
});

// ─── Module mocks ────────────────────────────────────────────────────────────
vi.mock('sharp', () => ({
  default: vi.fn().mockImplementation(() => sharpFactory.make()),
}));

vi.mock('fluent-ffmpeg', () => ({
  default: vi.fn().mockImplementation(() => ffmpegFactory.make()),
}));

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    create: vi.fn().mockImplementation(() => pdfDocFactory.created),
    load:   vi.fn().mockImplementation(() => pdfDocFactory.loaded),
  },
}));

vi.mock('child_process', () => ({
  execFile: vi.fn().mockImplementation((...args) => {
    const cb = args[args.length - 1];
    if (typeof cb === 'function') cb(null, '', '');
  }),
}));

vi.mock('fs/promises', () => ({
  mkdtemp:  vi.fn().mockResolvedValue('/tmp/kdl-test'),
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-output')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rm:       vi.fn().mockResolvedValue(undefined),
  mkdir:    vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    media: {
      findUnique: vi.fn(),
      create:     vi.fn().mockResolvedValue({ id: 'm2', path: 'u1/merged.pdf' }),
      update:     vi.fn().mockResolvedValue({}),
    },
    mediaVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create:    vi.fn().mockResolvedValue({ id: 'v1', version: 1 }),
    },
  },
}));

vi.mock('../../src/config/minio.js', () => ({
  minio: {
    getObject: vi.fn().mockImplementation(async () => {
      async function* gen() { yield Buffer.from('fake-data'); }
      return gen();
    }),
    putObject: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/shared/services/storage.service.js', () => ({
  uploadFile:  vi.fn().mockResolvedValue(undefined),
  getFileUrl:  vi.fn().mockResolvedValue('http://fake/url'),
}));

vi.mock('../../src/shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/modules/media/processing.service.js', () => ({
  createMediaVersion: vi.fn().mockResolvedValue({
    version: { id: 'v1', version: 1 },
    path: 'fake/path/v1.jpg',
    url: 'http://fake/v1.jpg',
  }),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────
import { PDFDocument }   from 'pdf-lib';
import { execFile }      from 'child_process';
import { prisma }        from '../../src/config/database.js';
import { minio }         from '../../src/config/minio.js';
import { uploadFile }    from '../../src/shared/services/storage.service.js';
import { createMediaVersion } from '../../src/modules/media/processing.service.js';

import { runImageEdit }   from '../../src/modules/media/image-ops.service.js';
import { runPdfOp }       from '../../src/modules/media/pdf-ops.service.js';
import { runVideoOp }     from '../../src/modules/media/video-ops.service.js';
import { runAudioOp }     from '../../src/modules/media/audio-ops.service.js';
import { runConversion }  from '../../src/modules/media/conversions.service.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const IMAGE_MEDIA = {
  id: 'm1', user_id: 'u1', folder_id: null, bucket: 'media',
  path: 'u1/photo.jpg', mime_type: 'image/jpeg', size: 5000, type: 'IMAGE',
};
const SVG_MEDIA = {
  id: 'm1', user_id: 'u1', folder_id: null, bucket: 'media',
  path: 'u1/logo.svg', filename: 'logo.svg', mime_type: 'image/svg+xml', size: 274, type: 'IMAGE',
};
const TIFF_MEDIA = {
  id: 'm1', user_id: 'u1', folder_id: null, bucket: 'media',
  path: 'u1/scan.tiff', filename: 'scan.tiff', mime_type: 'image/tiff', size: 9000, type: 'IMAGE',
};

const mockSvgSource = (svgText) => {
  minio.getObject.mockImplementationOnce(async () => {
    async function* gen() { yield Buffer.from(svgText, 'utf8'); }
    return gen();
  });
};
const PDF_MEDIA = {
  id: 'm1', user_id: 'u1', folder_id: null, bucket: 'media',
  path: 'u1/doc.pdf', mime_type: 'application/pdf', size: 1024, type: 'DOCUMENT',
};
const VIDEO_MEDIA = {
  id: 'm1', user_id: 'u1', folder_id: null, bucket: 'media',
  path: 'u1/video.mp4', mime_type: 'video/mp4', size: 10000, type: 'VIDEO',
};
const AUDIO_MEDIA = {
  id: 'm1', user_id: 'u1', folder_id: null, bucket: 'media',
  path: 'u1/audio.mp3', mime_type: 'audio/mpeg', size: 3000, type: 'AUDIO',
};

beforeEach(() => { vi.clearAllMocks(); });

// ═══════════════════════════════════════════════════════════════════════════
// C2 Image ops
// ═══════════════════════════════════════════════════════════════════════════
describe('C2 Image ops', () => {
  beforeEach(() => {
    prisma.media.findUnique.mockResolvedValue(IMAGE_MEDIA);
    createMediaVersion.mockResolvedValue({ version: { id: 'v1', version: 1 }, path: 'p', url: 'u' });
    // runImageEdit regenerates thumb/small/medium/large variants after the edit
    // pipeline runs, which calls sharp() again — reset so `.first` below always
    // captures the edit pipeline's chain, not a variant-generation chain.
    sharpFactory.first = null;
  });

  it('crop op calls sharp extract() with correct region', async () => {
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'crop', left: 10, top: 20, width: 100, height: 80 }], createdBy: 'u1' });
    expect(sharpFactory.first.extract).toHaveBeenCalledWith({ left: 10, top: 20, width: 100, height: 80 });
  });

  it('resize op calls sharp resize() with width and height', async () => {
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'resize', width: 300, height: 200 }], createdBy: 'u1' });
    expect(sharpFactory.first.resize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 300, height: 200 }),
    );
  });

  it('grayscale op calls sharp grayscale()', async () => {
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'grayscale' }], createdBy: 'u1' });
    expect(sharpFactory.first.grayscale).toHaveBeenCalled();
  });

  it('blur op calls sharp blur() with the provided sigma', async () => {
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'blur', sigma: 5 }], createdBy: 'u1' });
    expect(sharpFactory.first.blur).toHaveBeenCalledWith(5);
  });

  it('text_watermark op calls sharp composite()', async () => {
    await runImageEdit({
      mediaId: 'm1',
      ops: [{ op: 'text_watermark', text: 'Hello', position: 'center' }],
      createdBy: 'u1',
    });
    expect(sharpFactory.first.composite).toHaveBeenCalled();
  });

  it('compress jpeg op calls sharp jpeg() with quality', async () => {
    await runImageEdit({
      mediaId: 'm1',
      ops: [{ op: 'compress', format: 'jpeg', quality: 75 }],
      createdBy: 'u1',
    });
    expect(sharpFactory.first.jpeg).toHaveBeenCalledWith({ quality: 75 });
  });

  it('createMediaVersion is called with a buffer and ext', async () => {
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'grayscale' }], createdBy: 'u1' });
    expect(createMediaVersion).toHaveBeenCalledWith(
      'm1',
      expect.objectContaining({ buffer: expect.any(Buffer), ext: expect.any(String) }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C2b SVG image editing (KDL-153)
// ═══════════════════════════════════════════════════════════════════════════
describe('C2b SVG image editing', () => {
  beforeEach(() => {
    prisma.media.findUnique.mockResolvedValue(SVG_MEDIA);
    createMediaVersion.mockResolvedValue({ version: { id: 'v1', version: 1 }, path: 'p', url: 'u' });
    sharpFactory.first = null;
  });

  it('resize stays vector: mime/filename unchanged, dimensions scaled, text intact', async () => {
    mockSvgSource('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text>Hi</text></svg>');
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'resize', width: 200 }], createdBy: 'u1' });

    const [, , savedBuffer] = minio.putObject.mock.calls[0];
    const savedSvg = savedBuffer.toString('utf8');
    expect(savedSvg).toContain('<text>Hi</text>');
    expect(savedSvg).toMatch(/width="200"/);
    expect(savedSvg).toMatch(/height="100"/);
    expect(savedSvg.trim()).toMatch(/<\/svg>\s*$/); // well-formed XML, not just attribute-truncated

    expect(prisma.media.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        filename: 'logo.svg',
        mime_type: 'image/svg+xml',
        width: 200,
        height: 100,
      }),
    }));
  });

  it('crop stays vector and rewrites the viewBox', async () => {
    mockSvgSource('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100"/></svg>');
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'crop', left: 10, top: 10, width: 50, height: 50 }], createdBy: 'u1' });

    const [, , savedBuffer] = minio.putObject.mock.calls[0];
    const savedSvg = savedBuffer.toString('utf8');
    expect(savedSvg).toMatch(/viewBox="10 10 50 50"/);
    expect(savedSvg.trim()).toMatch(/<\/svg>\s*$/);
    expect(prisma.media.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mime_type: 'image/svg+xml', width: 50, height: 50 }),
    }));
  });

  it('brightness (a pixel-level op) rasterizes SVG to PNG and updates filename+mime', async () => {
    mockSvgSource('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text>Hi</text></svg>');
    await runImageEdit({ mediaId: 'm1', ops: [{ op: 'brightness', factor: 1.2 }], createdBy: 'u1' });

    expect(prisma.media.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ filename: 'logo.png', mime_type: 'image/png' }),
    }));
  });

  it('rejects editing for a genuinely unsupported format instead of corrupting it', async () => {
    prisma.media.findUnique.mockResolvedValue(TIFF_MEDIA);
    await expect(
      runImageEdit({ mediaId: 'm1', ops: [{ op: 'resize', width: 200 }], createdBy: 'u1' })
    ).rejects.toThrow(/not supported/);
    expect(minio.putObject).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C3 PDF ops
// ═══════════════════════════════════════════════════════════════════════════
describe('C3 PDF ops', () => {
  beforeEach(() => {
    prisma.media.findUnique.mockResolvedValue(PDF_MEDIA);
    createMediaVersion.mockResolvedValue({ version: { id: 'v1', version: 1 }, path: 'p', url: 'u' });
  });

  it('info op: PDFDocument.load called, returns page_count and title', async () => {
    const result = await runPdfOp({ op: 'info', mediaId: 'm1' });
    expect(PDFDocument.load).toHaveBeenCalled();
    expect(pdfDocFactory.loaded.getPageCount).toHaveBeenCalled();
    expect(pdfDocFactory.loaded.getTitle).toHaveBeenCalled();
    expect(result.page_count).toBe(3);
    expect(result.title).toBe('Test PDF');
  });

  it('compress op calls qpdf with --linearize flag', async () => {
    await runPdfOp({ op: 'compress', mediaId: 'm1', createdBy: 'u1' });
    expect(execFile).toHaveBeenCalledWith(
      'qpdf',
      expect.arrayContaining(['--linearize']),
      expect.any(Function),
    );
  });

  it('merge op: PDFDocument.create + load called, uploadFile called', async () => {
    prisma.media.findUnique.mockResolvedValue(PDF_MEDIA);
    await runPdfOp({ op: 'merge', ids: ['m1', 'm2'], createdBy: 'u1' });
    expect(PDFDocument.create).toHaveBeenCalled();
    expect(PDFDocument.load).toHaveBeenCalled();
    expect(pdfDocFactory.created.copyPages).toHaveBeenCalled();
    expect(uploadFile).toHaveBeenCalled();
  });

  it('watermark op: PDFDocument.load called, page.drawText called', async () => {
    await runPdfOp({ op: 'watermark', mediaId: 'm1', text: 'CONFIDENTIAL', createdBy: 'u1' });
    expect(PDFDocument.load).toHaveBeenCalled();
    const [page] = pdfDocFactory.loaded.getPages();
    expect(page.drawText).toHaveBeenCalledWith(
      'CONFIDENTIAL',
      expect.objectContaining({ opacity: expect.any(Number) }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C4 Video ops
// ═══════════════════════════════════════════════════════════════════════════
describe('C4 Video ops', () => {
  beforeEach(() => {
    prisma.media.findUnique.mockResolvedValue(VIDEO_MEDIA);
    createMediaVersion.mockResolvedValue({ version: { id: 'v1', version: 1 }, path: 'p', url: 'u' });
  });

  it('thumbnail op: seekInput and outputOptions called with correct args', async () => {
    await runVideoOp({ mediaId: 'm1', op: 'thumbnail', time: 3, createdBy: 'u1' });
    const chain = ffmpegFactory.current;
    expect(chain.seekInput).toHaveBeenCalledWith(3);
    expect(chain.outputOptions).toHaveBeenCalledWith(['-vframes 1', '-q:v 2']);
  });

  it('transcode op: size and videoBitrate set from 720p preset', async () => {
    await runVideoOp({ mediaId: 'm1', op: 'transcode', preset: '720p', createdBy: 'u1' });
    const chain = ffmpegFactory.current;
    expect(chain.size).toHaveBeenCalledWith('1280x720');
    expect(chain.videoBitrate).toHaveBeenCalledWith('2500k');
  });

  it('trim op: seekInput(start) and duration(end - start) called', async () => {
    await runVideoOp({ mediaId: 'm1', op: 'trim', start: 10, end: 25, createdBy: 'u1' });
    const chain = ffmpegFactory.current;
    expect(chain.seekInput).toHaveBeenCalledWith(10);
    expect(chain.duration).toHaveBeenCalledWith(15);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C5 Audio ops
// ═══════════════════════════════════════════════════════════════════════════
describe('C5 Audio ops', () => {
  beforeEach(() => {
    prisma.media.findUnique.mockResolvedValue(AUDIO_MEDIA);
    createMediaVersion.mockResolvedValue({ version: { id: 'v1', version: 1 }, path: 'p', url: 'u' });
  });

  it('normalize op: audioFilters called with loudnorm filter string', async () => {
    await runAudioOp({ mediaId: 'm1', op: 'normalize', createdBy: 'u1' });
    expect(ffmpegFactory.current.audioFilters).toHaveBeenCalledWith('loudnorm=I=-16:TP=-1.5:LRA=11');
  });

  it('convert mp3: audioCodec set to libmp3lame', async () => {
    await runAudioOp({ mediaId: 'm1', op: 'convert', format: 'mp3', createdBy: 'u1' });
    expect(ffmpegFactory.current.audioCodec).toHaveBeenCalledWith('libmp3lame');
  });

  it('convert wav: audioCodec set to pcm_s16le', async () => {
    await runAudioOp({ mediaId: 'm1', op: 'convert', format: 'wav', createdBy: 'u1' });
    expect(ffmpegFactory.current.audioCodec).toHaveBeenCalledWith('pcm_s16le');
  });

  it('trim op: seekInput(start) and duration(end - start) called', async () => {
    await runAudioOp({ mediaId: 'm1', op: 'trim', start: 5, end: 15, createdBy: 'u1' });
    const chain = ffmpegFactory.current;
    expect(chain.seekInput).toHaveBeenCalledWith(5);
    expect(chain.duration).toHaveBeenCalledWith(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// C6 Conversions
// ═══════════════════════════════════════════════════════════════════════════
describe('C6 Conversions', () => {
  beforeEach(() => {
    createMediaVersion.mockResolvedValue({ version: { id: 'v1', version: 1 }, path: 'p', url: 'u' });
  });

  it('image → webp: sharp().webp() called', async () => {
    prisma.media.findUnique.mockResolvedValue(IMAGE_MEDIA);
    await runConversion({ mediaId: 'm1', to: 'webp', createdBy: 'u1' });
    expect(sharpFactory.current.webp).toHaveBeenCalled();
  });

  it('video → mp4: ffmpeg videoCodec libx264 set', async () => {
    prisma.media.findUnique.mockResolvedValue(VIDEO_MEDIA);
    await runConversion({ mediaId: 'm1', to: 'mp4', createdBy: 'u1' });
    expect(ffmpegFactory.current.videoCodec).toHaveBeenCalledWith('libx264');
  });

  it('unsupported conversion: image → mp3 throws', async () => {
    prisma.media.findUnique.mockResolvedValue(IMAGE_MEDIA);
    await expect(runConversion({ mediaId: 'm1', to: 'mp3', createdBy: 'u1' }))
      .rejects.toThrow(/Unsupported conversion/);
  });
});
