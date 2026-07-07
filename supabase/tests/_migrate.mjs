// Apply every migration in order to a PGlite instance (real Postgres).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');

export async function applyAllMigrations(db) {
  const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort();
  for (const f of files) await db.exec(readFileSync(resolve(dir, f), 'utf8'));
  return files;
}
