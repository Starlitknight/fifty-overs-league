-- ============================================================================
-- Fifty Overs — grant the resolver (Supabase service_role) access to app.*
-- so the GitHub Action worker can call the action functions over PostgREST.
-- Guarded so it is a no-op where service_role doesn't exist (e.g. PGlite tests).
-- ============================================================================
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant usage on schema app to service_role';
    execute 'grant execute on all functions in schema app to service_role';
    execute 'grant select, insert, update, delete on all tables in schema app to service_role';
  end if;
end $$;
