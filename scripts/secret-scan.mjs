#!/usr/bin/env node
// Zero-dependency secret scan. No download, so CI and the pre-commit hook run the same code.
//   node scripts/secret-scan.mjs --staged     files staged for commit (pre-commit hook)
//   node scripts/secret-scan.mjs --all        every tracked file (CI)
//   node scripts/secret-scan.mjs --range A..B files changed between two commits (CI on a PR)
// A finding fails with exit 1. To allow a known fake value, add `secret-scan:allow` on that line.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 }).split('\n').filter(Boolean);

const mode = process.argv[2] || '--staged';
const files =
  mode === '--all' ? git('ls-files')
  : mode === '--range' ? git('diff', '--name-only', '--diff-filter=ACMR', process.argv[3])
  : git('diff', '--cached', '--name-only', '--diff-filter=ACMR');

// Files that must never be committed, whatever they contain.
const BAD_PATH = [
  [/(^|\/)\.env(\.(?!example$|sample$|template$)[^/]*)?$/, 'environment file'],
  [/\.(pem|key|p12|pfx|jks)$/, 'key or certificate file'],
  [/(^|\/)id_(rsa|ed25519|ecdsa)$/, 'SSH private key'],
  [/^(?!backend\/prisma\/migrations\/).*\.(sql|dump|bak)$/, 'database dump'],
  [/(^|\/)(backups|infra\/certs)\//, 'backups or certificates folder'],
];

// Content patterns. Each is a shape that is a real credential, not a variable name.
const PATTERNS = [
  [/-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY( BLOCK)?-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{50,}\b/, 'GitHub fine-grained token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, 'Slack token'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}\b/, 'Anthropic API key'],
  [/\bsk-or-v1-[A-Za-z0-9]{20,}\b/, 'OpenRouter API key'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'API key (sk-)'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|amqp):\/\/[^\s:@/'"$<{]+:(?![^@\s]*[<$*{])[^\s@/'"]{6,}@/, 'password inside a connection URL'],
  [/\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}\b/, 'JWT'],
];

// A long random-looking value assigned to a secret-sounding name.
const ASSIGN = /\b[A-Z0-9_]*(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_KEY|ENCRYPTION_KEY)[A-Z0-9_]*\s*[=:]\s*["']?([A-Za-z0-9+/_=-]{24,})["']?\s*$/;
// Documented placeholders and CI-only values are not secrets.
const PLACEHOLDER = /(example|change[_-]?(me|this)|placeholder|replace|your[-_]|x{4}|dummy|\btest|:postgres@|\bci-|kdl-dev|local)/i;
const looksRandom = (v) => /[0-9]/.test(v) && /[a-zA-Z]/.test(v) && new Set(v).size >= 10;

const SKIP = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|secret-scan\.mjs)$|\.(png|jpe?g|gif|webp|ico|pdf|woff2?|ttf|zip|gz|mp4)$/i;
// Test files hold deliberate fake credentials.
const TESTISH = /(\.test\.|\.spec\.|\/tests?\/|\/__tests__\/|\/e2e\/|\/fixtures\/)/;

// Tracked on purpose: holds only the public same-origin API path, no secret.
const ALLOW_PATH = new Set(['frontend/.env.local']);

const found = [];
for (const f of files) {
  if (!existsSync(f)) continue;
  if (!ALLOW_PATH.has(f)) for (const [re, why] of BAD_PATH) if (re.test(f)) found.push(`${f}: ${why} must not be committed`);
  if (SKIP.test(f)) continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  if (text.includes('\0')) continue;
  text.split('\n').forEach((line, i) => {
    if (line.includes('secret-scan:allow') || line.length > 2000) return;
    const fake = PLACEHOLDER.test(line);
    for (const [re, why] of PATTERNS) if (re.test(line) && !((fake || TESTISH.test(f)) && /URL|JWT/.test(why))) found.push(`${f}:${i + 1}: ${why}`);
    if (!TESTISH.test(f) && !fake) {
      const m = ASSIGN.exec(line);
      if (m && looksRandom(m[2])) found.push(`${f}:${i + 1}: value assigned to a secret-named variable`);
    }
  });
}

if (found.length) {
  console.error('Possible secrets found:\n  ' + [...new Set(found)].join('\n  '));
  console.error('\nIf it is a real secret: remove it, rotate it, and never commit it. If it is a fake value, add `secret-scan:allow` to that line.');
  process.exit(1);
}
console.log(`secret-scan: ${files.length} files clean`);
