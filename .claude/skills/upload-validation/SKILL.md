---
name: upload-validation
description: Use when adding or changing a file upload, accepted file types, size limits, logo/image handling or SVG/TIFF support in this repo. Do not use for non-upload code.
---

# Upload validation rules

- All uploads go through `storage.service.js`. Never write to disk directly.
- Decide type from the file's bytes (magic numbers), never from the filename or browser MIME. Example: `sniffImage` in `backend/src/shared/install/service.js`.
- SVG must pass `sanitizeSvg` (`backend/src/modules/media/svg-sanitizer.js`) before storage. It is served from the storage origin and can carry script.
- TIFF is converted to PNG with `sharp` (browsers cannot render it), with a pixel limit.
- Keep three places in sync: frontend `accept` list and hint text, backend sniffing, and any path regex (for example `schema.js` logo path). Add a test for each new type.
- Install wizard limit is 2 MB. The wizard has no login, so keep its rate limit.
- After changing, rebuild containers (`docker-rebuild` skill) before judging the UI.
