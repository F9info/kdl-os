import { ensureBuiltinTemplates } from './template-library.js';

// Installing Landing Pages puts its built-in templates in the library at once (they used to appear only
// when someone first opened the template picker). Runs inside the install transaction. Safe to re-run: a
// built-in that is already there is never touched by a user edit, and a deleted one is not brought back.
export default async function seed(tx) {
  await ensureBuiltinTemplates(tx);
}
