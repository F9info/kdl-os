# Lessons — ai-services

## 2026-07-02 — KDL-4 (M1–M7 MEDIUM fixes)

- `array.map(fn)` with an async single-arg function silently forwards `(value, index, array)` — `chunks.map(openrouterEmbed)` passed the chunk index as a second argument to the embed call. Always wrap: `chunks.map((c) => fn(c))`.
- ESM path resolution: use `fileURLToPath(new URL('.', import.meta.url))` and join relative segments, never `process.cwd()` — cwd depends on where the process was launched (repo root vs ai-services/) and broke MANUAL_TASKS.md / BLOCKERS.md writes.
- `redis.keys()` blocks Redis O(N) over the whole keyspace; `redis.scan` cursor loop (MATCH + COUNT) with per-batch `del` is the drop-in replacement (ioredis returns `[nextCursor, keys]`).
- Always pin `algorithms` in `jwt.verify` — without it, jsonwebtoken accepts any algorithm the attacker names in the token header.
- Anything written to operator-visible files (MANUAL_TASKS.md) must go through the same compliance scrub as the LLM payload — logging the raw message reintroduced the PII the scrub removed.
- MeiliSearch: services that only search should hold a scoped search-only API key, never `MEILI_MASTER_KEY` (master key can create/delete indexes and keys).
- `p-limit` v6 is ESM-only — fine here (`"type": "module"`), but check before adding to CJS packages.
