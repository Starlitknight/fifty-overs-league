// migrate.mjs — applies server/migrations/*.sql in filename order, exactly
// once each, inside transactions. A previously applied file whose checksum
// changed is a hard error: history is immutable, corrections are new files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makePool } from './db.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
export async function migrate(pool) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const c = await pool.connect();
  try {
    await c.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dir, f), 'utf8');
      const sum = crypto.createHash('sha256').update(sql).digest('hex');
      const seen = await c.query('SELECT checksum FROM schema_migrations WHERE name=$1', [f]);
      if (seen.rowCount) {
        if (seen.rows[0].checksum !== sum) throw new Error(`migration ${f} was modified after being applied — write a new migration instead`);
        continue;
      }
      await c.query('BEGIN');
      try {
        await c.query(sql);
        await c.query('INSERT INTO schema_migrations(name, checksum) VALUES ($1,$2)', [f, sum]);
        await c.query('COMMIT');
        console.error('applied ' + f);
      } catch (e) { await c.query('ROLLBACK'); throw e; }
    }
  } finally { c.release(); }
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = makePool();
  migrate(pool).then(() => { console.error('migrations up to date'); return pool.end(); })
    .catch(e => { console.error(e.message); process.exit(1); });
}
