-- 066-commentary-keeps-the-season.sql — EVERY BALL, FOR THE WHOLE SEASON.
--
-- The commentary bank was pruned by age: seven days and the book closed
-- (045), and both read functions refused anything older so a late prune
-- could never leak. That week made sense when the bank was a luxury; it
-- reads wrong in a game with a Stats Centre that can walk 136 seasons -
-- a manager opening round 3's thriller in round 12 found an empty page.
--
-- The rule becomes the season's own: a ball stays readable for as long as
-- the season it was bowled in is running, and the rollover that starts the
-- next season sweeps the old season's book (the sweep lives in tick.mjs
-- beside the rollover; a 45-day age prune stays as the long-stop for a
-- country whose rollover never fires).
--
-- So the two readers stop refusing by age. Everything else they enforce is
-- untouched: the broadcast embargo (047) still holds a log until its first
-- ball and a card until its last shown delivery, and a missing row still
-- answers null. Serving is existence-based now - if the purge has not taken
-- a log, it is meant to be readable.

CREATE OR REPLACE FUNCTION public.world_match_log(p_country text, p_match_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE l record; m record; play_ms bigint;
BEGIN
  SELECT * INTO l FROM match_logs
   WHERE match_id = p_match_id AND country_id = p_country;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'log', null);
  END IF;
  SELECT season_no, round INTO m FROM matches
   WHERE id = p_match_id AND country_id = p_country;
  IF FOUND AND m.round IS NOT NULL THEN
    play_ms := round_play_ms(p_country, m.season_no, m.round);
    IF play_ms IS NOT NULL AND now_ms() < play_ms THEN
      RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'log', null);
    END IF;
  END IF;
  RETURN jsonb_build_object('country', p_country, 'id', l.match_id, 'log', l.log);
END $$;

-- the friendly reader loses the same clause: a friendly's book keeps until
-- the sweep takes it with the rest of the season's commentary. Verbatim from
-- 048 otherwise - same signature, same shape, same embargo.
CREATE OR REPLACE FUNCTION public.world_friendly_log(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE f record; hc record; ac record; l record; base jsonb;
BEGIN
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF f.status NOT IN ('accepted','played') THEN RAISE EXCEPTION 'this friendly is %', f.status; END IF;
  SELECT * INTO hc FROM clubs WHERE country_id = f.c_country AND slot = f.c_slot;
  SELECT * INTO ac FROM clubs WHERE country_id = f.o_country AND slot = f.o_slot;
  base := jsonb_build_object(
    'id', f.id, 'playAtMs', f.play_at_ms,
    'home', jsonb_build_object('country', f.c_country, 'slot', f.c_slot,
                               'name', coalesce(hc.name, f.c_name)),
    'away', jsonb_build_object('country', f.o_country, 'slot', f.o_slot,
                               'name', coalesce(ac.name, f.o_name)));
  -- before the first ball there is nothing to watch, so nothing to read
  IF f.play_at_ms IS NULL OR now_ms() < f.play_at_ms THEN
    RETURN base || jsonb_build_object('log', null);
  END IF;
  SELECT * INTO l FROM match_logs
   WHERE match_id = 'fr:' || p_id AND country_id = f.c_country;
  IF NOT FOUND THEN RETURN base || jsonb_build_object('log', null); END IF;
  RETURN base || jsonb_build_object('log', l.log);
END $$;

-- the rollover sweep deletes by country; give it a path that is not a scan
CREATE INDEX IF NOT EXISTS match_logs_country ON match_logs (country_id);
