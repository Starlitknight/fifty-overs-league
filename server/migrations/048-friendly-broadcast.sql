-- 048-friendly-broadcast.sql — A FRIENDLY IS PLAYED BY THE UMPIRE AND
-- WATCHED LIKE ANY OTHER MATCH.
--
-- The umpire has always played accepted friendlies (009), but the reading
-- side was left from an earlier age: the client was expected to re-simulate
-- the match in the browser from the sealed teamsheets (011) - the one
-- surface in the game still doing its own umpiring, and it no longer works.
-- A friendly now follows the league round's own ritual: the challenge names
-- an hour, lineups lock an hour before (010), the umpire banks the match AT
-- THE LOCK (tick.mjs prebanks it, exactly as league rounds are prebanked),
-- its ball-by-ball rides the commentary bank under 'fr:<id>', and everyone
-- reads the same broadcast from the first ball at the feed page's
-- eighteen-seconds-a-delivery pace.
--
--   world_friendly_log   : the commentary, from the first ball. Sealed while
--                          the toss is still in the future, exactly like
--                          world_match_log (047).
--   world_friendly_detail: the fixture from T-1h as before; the RESULT only
--                          after the broadcast has shown the winning run -
--                          the same law as world_match_card (047).
--   world_my_friendlies  : a played row's result line is withheld until that
--                          same moment; until then the row reads as live.

-- the commentary bank was born holding league matches only (045 chained it
-- to matches(id)); a friendly's ball-by-ball banks under 'fr:<id>', which
-- has no matches row - the chain comes off. Nothing is orphaned by this:
-- the bank has always been pruned by age (seven days), never by cascade.
ALTER TABLE match_logs DROP CONSTRAINT IF EXISTS match_logs_match_id_fkey;

-- the moment a friendly's broadcast has shown its last ball: first ball plus
-- eighteen seconds a delivery (a delivery being a commentary row with a ball
-- number), capped at the three-hour window; the window's close when the
-- commentary has been pruned
CREATE OR REPLACE FUNCTION friendly_done_ms(p_id bigint, p_country text, p_play bigint)
RETURNS bigint LANGUAGE plpgsql STABLE AS $$
DECLARE l record; deliveries int;
BEGIN
  IF p_play IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO l FROM match_logs WHERE match_id = 'fr:' || p_id AND country_id = p_country;
  IF NOT FOUND THEN RETURN p_play + 10800000; END IF;
  SELECT count(*) INTO deliveries
    FROM jsonb_array_elements(l.log) e
   WHERE coalesce(e ->> 'no', '') <> ''
     AND NOT (e ? '_top') AND NOT (e ? 'intro');
  RETURN p_play + least(deliveries, 600)::bigint * 18000;
END $$;

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
   WHERE match_id = 'fr:' || p_id AND country_id = f.c_country
     AND played_at >= now() - interval '7 days';
  IF NOT FOUND THEN RETURN base || jsonb_build_object('log', null); END IF;
  RETURN base || jsonb_build_object('log', l.log);
END $$;

-- the fixture card, from T-1h as before (011) - but the result line now
-- keeps the broadcast's clock instead of leaking the winner at bank time
CREATE OR REPLACE FUNCTION public.world_friendly_detail(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE f record; hc record; ac record; o jsonb := '{}'::jsonb; fb jsonb; done_ms bigint;
BEGIN
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF f.status NOT IN ('accepted','played') THEN RAISE EXCEPTION 'this friendly is %', f.status; END IF;
  IF now_ms() < f.play_at_ms - 3600000 THEN
    RAISE EXCEPTION 'teamsheets are sealed until an hour before the match';
  END IF;
  SELECT * INTO hc FROM clubs WHERE country_id = f.c_country AND slot = f.c_slot;
  SELECT * INTO ac FROM clubs WHERE country_id = f.o_country AND slot = f.o_slot;
  IF f.c_orders IS NOT NULL THEN o := o || jsonb_build_object(hc.name, f.c_orders);
  ELSIF f.challenger IS NOT NULL THEN
    SELECT orders INTO fb FROM orders WHERE user_id = f.challenger ORDER BY submitted_at DESC LIMIT 1;
    IF fb IS NOT NULL THEN o := o || jsonb_build_object(hc.name, fb); END IF;
  END IF;
  fb := NULL;
  IF f.o_orders IS NOT NULL THEN o := o || jsonb_build_object(ac.name, f.o_orders);
  ELSIF f.opponent IS NOT NULL THEN
    SELECT orders INTO fb FROM orders WHERE user_id = f.opponent ORDER BY submitted_at DESC LIMIT 1;
    IF fb IS NOT NULL THEN o := o || jsonb_build_object(ac.name, fb); END IF;
  END IF;
  done_ms := friendly_done_ms(p_id, f.c_country, f.play_at_ms);
  RETURN jsonb_build_object(
    'id', f.id, 'status', f.status, 'playAtMs', f.play_at_ms,
    'home', jsonb_build_object('country', f.c_country, 'slot', f.c_slot, 'name', hc.name),
    'away', jsonb_build_object('country', f.o_country, 'slot', f.o_slot, 'name', ac.name),
    'orders', o,
    'text', CASE WHEN done_ms IS NULL OR now_ms() >= done_ms THEN f.result->>'text' ELSE NULL END);
END $$;

-- the manager's own list: a played row whose broadcast is still showing
-- reads as live, its result line withheld until the last ball has been shown
DROP FUNCTION IF EXISTS public.world_my_friendlies(text, int);
CREATE OR REPLACE FUNCTION public.world_my_friendlies(p_country text DEFAULT NULL, p_slot int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'id')::bigint DESC), '[]'::jsonb) INTO o FROM (
    SELECT jsonb_build_object(
      'id', f.id, 'status', f.status, 'playAtMs', f.play_at_ms,
      'home', f.c_name, 'away', f.o_name,
      'cCountry', f.c_country, 'cSlot', f.c_slot,
      'oCountry', f.o_country, 'oSlot', f.o_slot,
      'mine', f.challenger = u, 'incoming', f.opponent = u AND f.status = 'offered',
      'myOrders', CASE WHEN f.challenger = u THEN f.c_orders IS NOT NULL ELSE f.o_orders IS NOT NULL END,
      'text', CASE WHEN f.status = 'played'
                    AND now_ms() >= coalesce(friendly_done_ms(f.id, f.c_country, f.play_at_ms), 0)
                   THEN f.result->>'text' ELSE NULL END) AS row
      FROM friendlies f
     WHERE (f.challenger = u OR f.opponent = u)
       AND (p_country IS NULL OR p_slot IS NULL
            OR (f.c_country = p_country AND f.c_slot = p_slot)
            OR (f.o_country = p_country AND f.o_slot = p_slot))
     ORDER BY f.id DESC LIMIT 20) q;
  RETURN o;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_log(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_friendly_detail(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_friendlies(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_log(bigint) TO anon;
    GRANT EXECUTE ON FUNCTION public.world_friendly_detail(bigint) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
