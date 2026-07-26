// db.mjs — the one place a connection is made. DATABASE_URL wins; the local
// default speaks over the Unix socket as the OS user (dev convenience).
import pg from 'pg';
export function makePool(url) {
  const cs = url || process.env.DATABASE_URL;
  if (cs) return new pg.Pool({ connectionString: cs, max: 5 });
  return new pg.Pool({
    host: process.env.PGHOST || '/var/run/postgresql',
    database: process.env.PGDATABASE || 'foworld',
    user: process.env.PGUSER || process.env.USER || 'root',
    max: 5
  });
}
