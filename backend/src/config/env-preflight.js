// Boot-time env preflight — must import before any module that throws on missing vars
// (e.g. config/jwt.js). Collects ALL missing required vars in one pass so the developer
// sees the full list instead of fixing errors one at a time.
const REQUIRED_VARS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'REDIS_URL',
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  process.stderr.write(
    `[env-preflight] Server refused to start — missing required env vars:\n` +
      missing.map((v) => `  - ${v}`).join('\n') +
      `\n\nCopy .env.example to .env and fill in all required values.\n`
  );
  process.exit(1);
}
