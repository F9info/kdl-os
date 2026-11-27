import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const storageMock = vi.hoisted(() => ({ uploadFile: vi.fn(), copyFile: vi.fn(), getFileStream: vi.fn(), deleteFile: vi.fn() }));
vi.mock('../../shared/services/storage.service.js', () => storageMock);
const verify = vi.hoisted(() => vi.fn());
vi.mock('../../shared/services/storage/drivers/local.driver.js', () => ({ verifyLocalPresignToken: verify }));

const images = await import('./images.js');

beforeEach(() => vi.clearAllMocks());

describe('a photo sent with a proposal', () => {
  it('is cropped square, re-encoded as JPEG and given a permanent address', async () => {
    const png = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#4285f4' } })
      .png()
      .toBuffer();
    const url = await images.savePhoto({ buffer: png, mimetype: 'image/png' });
    expect(url).toMatch(/^\/api\/gdg\/public\/images\/[a-f0-9-]{36}\.jpg$/);
    const [file, key] = storageMock.uploadFile.mock.calls[0];
    expect(key).toBe(`gdg/images/${url.split('/').pop()}`);
    const meta = await sharp(file.buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 800, 800]);
  });

  it('is refused when the file is not an image', async () => {
    await expect(images.savePhoto({ buffer: Buffer.from('not an image') })).rejects.toMatchObject({ status: 422 });
    expect(storageMock.uploadFile).not.toHaveBeenCalled();
  });
});

describe('images picked from the media library', () => {
  const signed = 'http://localhost:3000/api/storage/local/u1/abc.png?token=t&exp=9999999999999';

  it('get a permanent copy when the link is one the storage signed', async () => {
    verify.mockReturnValue(true);
    const url = await images.keepImage(signed);
    expect(verify).toHaveBeenCalledWith('u1/abc.png', 't', '9999999999999');
    expect(storageMock.copyFile).toHaveBeenCalledWith('u1/abc.png', expect.stringMatching(/^gdg\/images\/[a-f0-9-]{36}\.png$/));
    expect(url).toMatch(/^\/api\/gdg\/public\/images\/[a-f0-9-]{36}\.png$/);
  });

  it('stay as they are when forged, expired, not an image, or not from the storage', async () => {
    verify.mockReturnValue(false);
    expect(await images.keepImage(signed)).toBe(signed);
    verify.mockReturnValue(true);
    const svg = signed.replace('abc.png', 'abc.svg');
    expect(await images.keepImage(svg)).toBe(svg);
    expect(await images.keepImage('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
    expect(await images.keepImage('/api/gdg/public/images/x.jpg')).toBe('/api/gdg/public/images/x.jpg');
    expect(await images.keepImage(null)).toBe(null);
    expect(storageMock.copyFile).not.toHaveBeenCalled();
  });
});

describe('deleting', () => {
  it('only deletes stored website images', async () => {
    const name = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0.jpg';
    expect(await images.dropImage('/api/gdg/public/images/' + name)).toBe(true);
    expect(storageMock.deleteFile).toHaveBeenCalledWith('gdg/images/' + name);
    storageMock.deleteFile.mockClear();
    expect(await images.dropImage('/api/gdg/public/images/../../secret.jpg')).toBe(false);
    expect(await images.dropImage('https://cdn.example.com/x.jpg')).toBe(false);
    expect(await images.dropImage(null)).toBe(false);
    expect(storageMock.deleteFile).not.toHaveBeenCalled();
  });
});

describe('serving', () => {
  it('only serves names that look like a stored image', async () => {
    expect(await images.readImage('../../etc/passwd')).toBeNull();
    expect(await images.readImage('photo.svg')).toBeNull();
    storageMock.getFileStream.mockResolvedValue('stream');
    const name = '0b1c2d3e-4f50-6172-8394-a5b6c7d8e9f0.jpg';
    expect(await images.readImage(name)).toEqual({ stream: 'stream', type: 'image/jpeg' });
    expect(storageMock.getFileStream).toHaveBeenCalledWith(`gdg/images/${name}`);
  });
});
