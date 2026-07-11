# KDL — Lessons & Common Mistakes (Code Reviewer log)

> Loaded on demand — kept OUT of the always-on `CLAUDE.md` to reduce per-run context/token cost.
> Agents: read this when writing or reviewing code in the relevant module. Code Reviewer appends new lessons here after each phase.

## Common Mistakes to Avoid

- Never create `new PrismaClient()` directly — use singleton from `config/database.js`
- Never write files to disk directly — always use `storage.service.js`
- Never use raw `fetch` in frontend — always use `lib/axios.ts`
- Never hardcode port 6379 — Redis is on `REDIS_URL` from `.env` (mapped to 6380)
- Never hardcode port 5432 — PostgreSQL is on `DATABASE_URL` from `.env` (mapped to 5433)
- Never hardcode secrets in docker-compose.yml `environment:` blocks — use `${VAR}` substitution from `.env` via `env_file`
- Never give the frontend service `DATABASE_URL` or `REDIS_URL` — frontend is Next.js, it calls the backend API, never the DB directly
- In docker-compose.yml container environment blocks, DATABASE_URL uses `postgres:5432` (container-internal), not `localhost:5433` — these are different contexts
- Never use `new PrismaClient()` in seed.js — import from `config/database.js` singleton per the non-negotiable rule
- Never count processed jobs with a module-level counter in BullMQ workers — the counter never resets and permanently kills the worker after N jobs; the maxIterations rule applies to `for`/`while` loops, not event-driven workers
- Always start the email worker in index.js (`import './shared/workers/email.worker.js'`) — defining a Worker export is not enough; it must be instantiated to process jobs
- Log file paths in logger.js must be verified: from `backend/src/shared/utils/`, `../../../logs/` = `backend/logs/` (3 up), NOT `../../../../../logs/` (5 up = outside project)
- validate() middleware wraps schema input as `{ body, query, params }` — Phase 3 Zod schemas must use `z.object({ body: z.object({...}), ... })` and read from `req.validated.body`
- multer upload middleware must include a MIME type whitelist in `fileFilter` — no filter means any file type including executables can be uploaded (OWASP A04)
- Always add a 404 catch-all route (`app.use((req, res) => errorResponse(res, 'Not found', 404))`) before the error handler in index.js
- Health endpoints and all Express route handlers must use `successResponse` / `errorResponse` — no raw `res.json()`

- Settings GET routes that need to distinguish authenticated admins from anonymous users MUST use an `optionalAuthenticate` middleware that sets req.user if a valid Bearer token is present but does NOT reject unauthenticated requests — the standard `authenticate` middleware always rejects, making `req.user` dead code in public routes
- Never allow ADMIN role to set `role: 'SUPER_ADMIN'` on any user — validate that ADMIN callers cannot assign or interact with SUPER_ADMIN-level users in the users module
- Refresh tokens MUST be revoked on use (token rotation) — issue a new refresh token and revoke the old one in the /refresh handler; reusing the same token until expiry is a 7-day replay window
- Never store MinIO presigned URLs in the database — they expire (default 7 days); store only the object path and generate presigned URLs on demand when serving media responses
- Media module uses a BullMQ worker (`media.worker.js`, queue name `'media'`) to generate image variants (thumb/small/medium/large as webp) — `variants` field on Media is `null` until the worker completes; clients should poll or handle null gracefully
- Media delete is always soft (sets `deleted_at`); hard delete only via `DELETE /api/media/trash/purge`; never cascade hard-delete from folder delete
- Files with active `MediaUsage` records cannot be soft-deleted (409); call `POST /api/media/usage/release` first
- Multer `fileFilter` is synchronous — only reject executables there; all other MIME + size validation happens in `service.js` after the upload lands in memory

- Never store access tokens or refresh tokens in `localStorage` — XSS payloads can steal them; access tokens belong in memory (Zustand non-persisted state), refresh tokens belong in httpOnly cookies set by the server
- Never set session cookies with `document.cookie` — use httpOnly flag (server-set) so JavaScript cannot read them; middleware.ts can still read httpOnly cookies server-side
- Zustand `persist` with `partialize` does NOT persist `isLoading` — add `onRehydrateStorage: () => (state) => { state?.setLoading(false) }` to the persist config or the auth guard will show a spinner forever after page refresh
- Never instantiate `new QueryClient()` at module level in Next.js App Router — create it inside a React component with `const [queryClient] = useState(() => new QueryClient(...))` to prevent SSR shared cache leakage between requests
- Never ship a frontend form that calls a non-existent backend endpoint — if the backend route doesn't exist yet, remove or stub the UI rather than letting it silently fail with 404
- Always add the `Secure` cookie flag in production; gate it on `window.location.protocol === 'https:'` on the client side
- Always guard `new Date(str)` with `isNaN(d.getTime())` before passing to date-fns `format()` — `format(Invalid Date, ...)` throws and will crash the component tree
- Frontend type definitions must stay in sync with backend schema changes — when `schema.prisma` changes a field type (e.g., nullable), update `types/models.types.ts` to match

- Never wrap audit logging or side-effect calls inside `brainRouter` (or any response-path function) without try/catch — a Redis failure in `auditLogger` must not prevent the AI response from being delivered; always isolate side-effects so they fail silently
- Always add `helmet`, `cors`, and `express-rate-limit` to every Express service (backend and ai-services) — omitting them on AI endpoints creates cost-amplification DoS exposure where every request triggers a paid API call
- Always use `import.meta.url`-relative paths in ES Module files for writing project-level files (BLOCKERS.md, MANUAL_TASKS.md) — `process.cwd()` resolves to the launch directory, not the source file location, so it breaks when started from the repo root
- When using `process.cwd()` for file paths, document the required working directory or switch to `import.meta.url`: `const __dir = fileURLToPath(new URL('.', import.meta.url))`
- Never write the original (pre-scrub) user message to any file or log — always scrub PII before logging, even to internal files like MANUAL_TASKS.md
- Never use `redis.keys()` in application code — it is O(N) blocking; always use `redis.scan()` with cursor iteration for key pattern matching
- BaseAgent subclasses must write BLOCKERS.md on maxIterations hit — console.warn alone violates the non-negotiable rule; mirror the BaseWorkflow pattern
- Never use MEILI_MASTER_KEY in application code for search queries — always use a scoped search-only API key (`MEILI_SEARCH_API_KEY`) with minimal permissions
- Always guard `err.message` in Express error handlers with a `NODE_ENV !== 'production'` check — raw error messages can leak file paths, connection strings, and API error details
- Always specify `{ algorithms: ['HS256'] }` in `jwt.verify` calls — explicit algorithm constraint prevents algorithm-confusion attacks if key type ever changes

*(Code Reviewer appends to this after each phase review)*
