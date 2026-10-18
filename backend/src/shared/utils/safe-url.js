import { z } from 'zod';

// Blocks javascript:/data:/vbscript: hrefs (stored-XSS via menu URL) while
// still allowing relative paths, http(s), mailto, and tel. A relative path must
// not contain a backslash or control character: browsers read `/\evil.com` as
// `//evil.com` (open redirect) and strip tabs/newlines inside URLs.
export const safeUrl = z
  .string()
  .max(1000)
  .refine(
    (v) => {
      if (!v) return true;
      if (v.startsWith('#')) return true;
      if (v.startsWith('/') && !v.startsWith('//') && !/[\\\u0000-\u001f]/.test(v)) return true;
      try {
        const scheme = new URL(v).protocol;
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(scheme);
      } catch {
        return false;
      }
    },
    { message: 'URL must be http(s), mailto, tel, or a relative path' }
  )
  .nullish();
