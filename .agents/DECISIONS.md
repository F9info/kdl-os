# Architecture Decisions

## MEDIA-001 — doc→pdf conversion excluded in v1 (2026-07-08)

**Decision:** `doc→pdf` (Word/Excel/LibreOffice → PDF) is excluded from Phase C conversions matrix.

**Reason:** LibreOffice headless adds ~500MB to the Docker image and introduces significant complexity (sandboxing, font management, conversion reliability). The backend image already grows ~200MB from ffmpeg+qpdf+tesseract — adding LibreOffice would push it to ~700MB+, violating the image-size budget accepted in the arch doc.

**Outcome:** `POST /api/media/:id/convert` returns 422 for unsupported conversion pairs. The conversions matrix documents this as "doc→pdf EXCLUDED v1". Re-evaluate when/if a dedicated conversion microservice is warranted.

**Log:** Recorded as required by MEDIA_DAM_ARCH.md Phase C step C6.

## MEDIA-002 — Face recognition excluded in v1 (2026-07-08)

**Decision:** Phase D7 recognition ships labels/logos/landmarks/products + QR/barcode only. Face recognition is excluded from v1.

**Reason:** DPDP (India Digital Personal Data Protection Act) treats biometric/facial data as sensitive personal data requiring explicit consent design, retention policy, and deletion workflows — none of which exist in v1. Revisit with a consent-first design if demanded.

**Log:** Required by KDL-122 issue scope ("Face recognition EXCLUDED v1 (DPDP privacy)").

## MEDIA-003 — rar/7z extraction excluded in v1 (2026-07-08)

**Decision:** Archive ingestion supports zip only (`POST /api/media/import/zip`). rar and 7z are excluded from v1.

**Reason:** rar decompression requires non-free unrar licensing; 7z adds a native dependency (p7zip) to the backend image for a marginal use case. Zip covers the dominant workflow.

**Log:** Required by KDL-122 issue scope ("rar/7z extraction — log to DECISIONS.md").
