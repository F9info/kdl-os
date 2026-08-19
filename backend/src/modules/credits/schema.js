import { z } from 'zod';

// BigInt amounts arrive as strings in JSON (JS BigInt serialisation convention).
const bigIntString = z.string().regex(/^-?\d+$/, 'Must be an integer string').transform((v) => BigInt(v));

export const grantSchema = z.object({
  body: z.object({
    amount_mc: bigIntString,
    source: z.string().min(1).max(200),
    reason: z.string().min(1).max(500),
    idempotency_key: z.string().max(200).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const adjustSchema = z.object({
  body: z.object({
    amount_mc: bigIntString,
    source: z.string().min(1).max(200),
    reason: z.string().min(1).max(500),
    idempotency_key: z.string().max(200).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const ledgerQuerySchema = z.object({
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    entry_type: z.enum(['GRANT', 'RESERVE', 'SETTLE', 'RELEASE', 'EXPIRE', 'ADJUST']).optional(),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
  }),
});
