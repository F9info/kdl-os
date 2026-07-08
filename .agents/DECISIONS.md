# Architecture Decisions

## MEDIA-001 — doc→pdf conversion excluded in v1 (2026-07-08)

**Decision:** `doc→pdf` (Word/Excel/LibreOffice → PDF) is excluded from Phase C conversions matrix.

**Reason:** LibreOffice headless adds ~500MB to the Docker image and introduces significant complexity (sandboxing, font management, conversion reliability). The backend image already grows ~200MB from ffmpeg+qpdf+tesseract — adding LibreOffice would push it to ~700MB+, violating the image-size budget accepted in the arch doc.

**Outcome:** `POST /api/media/:id/convert` returns 422 for unsupported conversion pairs. The conversions matrix documents this as "doc→pdf EXCLUDED v1". Re-evaluate when/if a dedicated conversion microservice is warranted.

**Log:** Recorded as required by MEDIA_DAM_ARCH.md Phase C step C6.
