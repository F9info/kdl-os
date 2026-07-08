import { describe, it, expect, vi, beforeEach } from 'vitest';

const parseMock = vi.fn();
vi.mock('exifr', () => ({ default: { parse: parseMock } }));

import { extractExif } from '../../src/modules/media/exif-extractor.js';

// Braces matter: mockReset() returns the mock, and a function returned from a
// hook is run as teardown — invoking the mock with whatever impl the test left.
beforeEach(() => { parseMock.mockReset(); });

describe('extractExif', () => {
  it('maps camera, gps and taken_at fields into compact shape', async () => {
    parseMock.mockResolvedValue({
      Make: 'Canon', Model: 'EOS R5', LensModel: 'RF 24-70mm',
      FNumber: 2.8, ExposureTime: 0.005, ISO: 400, FocalLength: 50,
      DateTimeOriginal: new Date('2026-01-15T10:30:00Z'),
      Orientation: 1, Software: 'Lightroom',
      latitude: 12.9716, longitude: 77.5946, GPSAltitude: 920,
    });

    const exif = await extractExif(Buffer.from('fake-jpeg'));
    expect(exif.camera).toEqual({
      make: 'Canon', model: 'EOS R5', lens: 'RF 24-70mm',
      f_number: 2.8, exposure_time: 0.005, iso: 400, focal_length: 50,
    });
    expect(exif.gps).toEqual({ latitude: 12.9716, longitude: 77.5946, altitude: 920 });
    expect(exif.taken_at).toBe('2026-01-15T10:30:00.000Z');
    expect(exif.orientation).toBe(1);
    expect(exif.software).toBe('Lightroom');
  });

  it('returns null gps when coordinates missing', async () => {
    parseMock.mockResolvedValue({ Make: 'Canon', latitude: undefined });
    const exif = await extractExif(Buffer.from('x'));
    expect(exif.gps).toBeNull();
    expect(exif.camera.make).toBe('Canon');
  });

  it('returns null when file has no exif', async () => {
    parseMock.mockResolvedValue(undefined);
    expect(await extractExif(Buffer.from('x'))).toBeNull();
  });

  it('returns null when all meaningful fields are empty', async () => {
    parseMock.mockResolvedValue({ Orientation: 1 });
    expect(await extractExif(Buffer.from('x'))).toBeNull();
  });

  it('returns null (never throws) when exifr fails', async () => {
    parseMock.mockRejectedValue(new Error('corrupt'));
    expect(await extractExif(Buffer.from('x'))).toBeNull();
  });
});
