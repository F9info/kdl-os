import multer from 'multer';

const EXECUTABLES = new Set([
  'application/x-executable', 'application/x-msdownload', 'application/x-sh',
  'application/x-bat', 'application/x-msdos-program',
]);

// Multer fileFilter is synchronous (multer ignores returned Promises).
// Only reject executables here; settings-driven MIME + size validation happens in service.js.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (EXECUTABLES.has(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
    cb(null, true);
  },
});
