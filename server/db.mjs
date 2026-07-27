// db.mjs — the one place a connection is made. DATABASE_URL wins; the local
// default speaks over the Unix socket as the OS user (dev convenience).
//
// Supabase notes:
//  - hosted Postgres requires TLS; the pooler presents a cert node-postgres
//    can't chain, so supabase/pooler URLs get ssl with verification off
//    (the password already travels inside TLS; this is the documented
//    node-postgres + Supabase arrangement).
//  - WORLD_SCHEMA=world keeps every World Service table in its own schema,
//    so the game's existing multiplayer tables in public are never touched.
//    Each pooled connection creates the schema if needed and pins its
//    search_path before any query runs (queries queue in order per client).
import pg from 'pg';
export function makePool(url) {
  const cs = url || process.env.DATABASE_URL;
  let pool;
  if (cs) {
    const tls = /supabase|pooler|sslmode=(require|no-verify)/.test(cs);
    pool = new pg.Pool({ connectionString: cs, max: 5, ...(tls ? { ssl: { rejectUnauthorized: false } } : {}) });
  } else {
    pool = new pg.Pool({
      host: process.env.PGHOST || '/var/run/postgresql',
      database: process.env.PGDATABASE || 'foworld',
      user: process.env.PGUSER || process.env.USER || 'root',
      max: 5
    });
  }
  const schema = process.env.WORLD_SCHEMA;
  if (schema && /^[a-z_][a-z0-9_]*$/.test(schema)) {
    pool.on('connect', c => {
      c.query('CREATE SCHEMA IF NOT EXISTS ' + schema + '; SET search_path TO ' + schema + ', public')
        .catch(e => console.error('search_path:', e.message));
    });
  }
  return pool;
}
