import { z } from 'zod';

// `?updated_since=<ISO-8601>` on public list endpoints: only rows created/updated after that instant.
// Lets a mobile client refresh a cached list cheaply. It CANNOT report deletions or rows that were
// just deactivated (public lists only return active rows), so clients must still do a full fetch
// (no updated_since) now and then; the ETag on the full list makes that cheap (304).
export const updatedSinceField = z.string().datetime({ offset: true }).optional();

export function applyUpdatedSince(where, query) {
  if (query.updated_since) where.updated_at = { gt: new Date(query.updated_since) };
  return where;
}
