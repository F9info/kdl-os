// EXIF extraction for image uploads — sharp metadata + exifr parse.
// Returns a compact JSON blob for the Media.exif column, or null when
// the file has no EXIF / parsing fails (extraction must never block upload).

export const extractExif = async (buffer) => {
  let raw = null;
  try {
    const { default: exifr } = await import('exifr');
    raw = await exifr.parse(buffer, {
      pick: [
        'Make', 'Model', 'LensModel', 'FNumber', 'ExposureTime', 'ISO',
        'FocalLength', 'DateTimeOriginal', 'Orientation', 'Software',
        'latitude', 'longitude', 'GPSAltitude',
      ],
    });
  } catch {
    return null;
  }
  if (!raw) return null;

  const exif = {
    camera: {
      make: raw.Make ?? null,
      model: raw.Model ?? null,
      lens: raw.LensModel ?? null,
      f_number: raw.FNumber ?? null,
      exposure_time: raw.ExposureTime ?? null,
      iso: raw.ISO ?? null,
      focal_length: raw.FocalLength ?? null,
    },
    gps: (raw.latitude != null && raw.longitude != null)
      ? { latitude: raw.latitude, longitude: raw.longitude, altitude: raw.GPSAltitude ?? null }
      : null,
    taken_at: raw.DateTimeOriginal instanceof Date ? raw.DateTimeOriginal.toISOString() : null,
    orientation: raw.Orientation ?? null,
    software: raw.Software ?? null,
  };

  const hasCamera = Object.values(exif.camera).some((v) => v != null);
  if (!hasCamera && !exif.gps && !exif.taken_at) return null;
  return exif;
};
