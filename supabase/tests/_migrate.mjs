// Apply every migration in order to a PGlite instance (real Postgres).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../migrations');

export async function applyAllMigrations(db) {
  // Real Supabase always has these roles; migrations may grant/revoke against
  // them unguarded (0017 does). Create them first so PGlite matches the
  // platform the SQL was written for.
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  end $$;`);
  // Supabase's auth schema, shimmed: auth.uid() reads the same GUC the tests
  // set when they impersonate a signed-in user.
  await db.exec(`create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  const files = readdirSync(dir).filter((x) => x.endsWith('.sql')).sort();
  for (const f of files) await db.exec(readFileSync(resolve(dir, f), 'utf8'));
  return files;
}
