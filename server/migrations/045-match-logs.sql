-- 045-match-logs.sql — THE COMMENTARY KEEPS FOR A WEEK.
--
-- The canonical card deliberately does not carry the ball-by-ball: it is the
-- largest part of a match, and the client re-derives it by replay. But a
-- replay can only be shown when it AGREES with the banked verdict, and men
-- move - a club that traded since founding cannot be regenerated - so for
-- many matches the Ball by Ball tab had nothing to say.
--
-- The umpire has the real commentary in hand the moment a match is played.
-- From now on he banks it here, beside the match, and keeps it for SEVEN
-- DAYS: long enough for any manager to read back the week's cricket, short
-- enough that a season never grows a commentary archive nobody reads. The
-- tick prunes anything older; the RPC below refuses to serve past the week
-- even if a prune is late, so the promise holds at the read as well as the
-- write. The scorecard, as ever, is forever.
CREATE TABLE IF NOT EXISTS match_logs (
  match_id   text PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  country_id text NOT NULL,
  log        jsonb NOT NULL,
  played_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_logs_age ON match_logs (played_at);

-- one match's commentary, by the id the snapshots already publish
CREATE OR REPLACE FUNCTION public.world_match_log(p_country text, p_match_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE l record;
BEGIN
  SELECT * INTO l FROM match_logs
   WHERE match_id = p_match_id AND country_id = p_country
     AND played_at >= now() - interval '7 days';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'log', null);
  END IF;
  RETURN jsonb_build_object('country', p_country, 'id', l.match_id, 'log', l.log);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_match_log(text, text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_match_log(text, text) TO anon;
  END IF;
END $$;
