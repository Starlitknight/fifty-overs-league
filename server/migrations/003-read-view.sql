-- 003-read-view.sql — the public read path for Supabase PostgREST.
-- The World Service's tables live in the world schema (WORLD_SCHEMA=world);
-- these views project the two public-by-nature surfaces into public, where
-- Supabase's REST API serves them to the anon key. Read-only by grant:
-- anon can SELECT the views and touch nothing else ("no client trust").
-- On a local dev database (no anon role, everything in public) the views
-- still resolve; the grants are skipped.
CREATE OR REPLACE VIEW public.world_snapshots AS
  SELECT key, body, updated_at FROM snapshots;

CREATE OR REPLACE VIEW public.world_matches AS
  SELECT id, country_id, season_no, round, seed::text AS seed,
         engine_version, pitch, result_canonical
    FROM matches;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_snapshots TO anon;
    GRANT SELECT ON public.world_matches TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_snapshots TO authenticated;
    GRANT SELECT ON public.world_matches TO authenticated;
  END IF;
END $$;
