-- 012-living-players.sql — THE PLAYERS START LIVING.
-- Until now every cricketer in the world was frozen at the moment he was
-- generated: permanently steady, permanently rested, never a day older in
-- the legs. The umpire now carries each man's living state forward - the
-- experience the matches gave him, the form his last five games earned,
-- the tiredness in his arm - and it rides into the engine like any skill.
--
-- Determinism is preserved by RECORDING it. Every match banks the exact
-- living state of both squads (a small patch over the generated baseline,
-- name -> {e:exp, f:formIx, n:fatigue}). The theatre re-derives the same
-- squads locally, applies the same patch, runs the same seed - so the
-- broadcast is still, ball for ball, the match the world recorded.
--
-- It reveals on the same clock as the teamsheets: an hour before the ball.

ALTER TABLE matches     ADD COLUMN IF NOT EXISTS living jsonb;
ALTER TABLE friendlies  ADD COLUMN IF NOT EXISTS living jsonb;
ALTER TABLE cup_matches ADD COLUMN IF NOT EXISTS living jsonb;

-- the living state of every club in a country, straight from the squads
CREATE OR REPLACE FUNCTION world_living_now(p_country text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_object_agg(cl.name, coalesce(l.liv, '{}'::jsonb)), '{}'::jsonb)
    FROM clubs cl
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(p->>'name', jsonb_build_object(
               'e', coalesce(p->'exp', '55'::jsonb),
               'f', coalesce(p->'formIx', '3'::jsonb),
               'n', coalesce(p->'fatN', '0'::jsonb))) AS liv
        FROM jsonb_array_elements(cl.squad) p
       WHERE p->>'name' IS NOT NULL
    ) l ON true
   WHERE cl.country_id = p_country;
$$;

-- ROUND ORDERS, now with the living state the umpire will use (or did use).
-- Played matches answer with what was banked; a round still to come answers
-- with the squads as they stand this minute.
CREATE OR REPLACE FUNCTION public.world_round_orders(p_country text, p_round int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE s record; play_ms bigint; o jsonb; liv jsonb; rec jsonb;
BEGIN
  IF p_round < 1 OR p_round > 18 THEN RAISE EXCEPTION 'bad round'; END IF;
  SELECT * INTO s FROM seasons WHERE country_id = p_country ORDER BY season_no DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('country', p_country, 'orders', '{}'::jsonb); END IF;
  play_ms := round_play_ms(p_country, s.season_no, p_round);
  IF play_ms IS NULL OR now_ms() < play_ms - 3600000 THEN
    RAISE EXCEPTION 'round % orders are sealed until an hour before the first ball', p_round;
  END IF;
  SELECT jsonb_object_agg(cl.name, o2.orders) INTO o
    FROM claims c
    JOIN clubs cl ON cl.country_id = c.country_id AND cl.slot = c.slot
    JOIN orders o2 ON o2.user_id = c.user_id AND o2.country_id = c.country_id
                  AND o2.season_no = s.season_no AND o2.round = p_round
   WHERE c.country_id = p_country;
  liv := world_living_now(p_country);
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb) INTO rec
    FROM matches m, jsonb_each(m.living) e
   WHERE m.country_id = p_country AND m.season_no = s.season_no AND m.round = p_round
     AND m.living IS NOT NULL;
  RETURN jsonb_build_object('country', p_country, 'seasonNo', s.season_no, 'round', p_round,
                            'orders', coalesce(o, '{}'::jsonb),
                            'living', liv || rec);
END $$;

-- the friendly fixture card carries the same living state
CREATE OR REPLACE FUNCTION public.world_friendly_detail(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE f record; hc record; ac record; o jsonb := '{}'::jsonb; fb jsonb; liv jsonb := '{}'::jsonb;
BEGIN
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF f.status NOT IN ('accepted','played') THEN RAISE EXCEPTION 'this friendly is %', f.status; END IF;
  IF now_ms() < f.play_at_ms - 3600000 THEN
    RAISE EXCEPTION 'teamsheets are sealed until an hour before the match';
  END IF;
  SELECT * INTO hc FROM clubs WHERE country_id = f.c_country AND slot = f.c_slot;
  SELECT * INTO ac FROM clubs WHERE country_id = f.o_country AND slot = f.o_slot;
  -- the umpire's exact order of precedence, keyed by current club names
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
  IF f.living IS NOT NULL THEN liv := f.living;
  ELSE
    liv := jsonb_build_object(hc.name, coalesce(world_living_now(f.c_country) -> hc.name, '{}'::jsonb))
        || jsonb_build_object(ac.name, coalesce(world_living_now(f.o_country) -> ac.name, '{}'::jsonb));
  END IF;
  RETURN jsonb_build_object(
    'id', f.id, 'status', f.status, 'playAtMs', f.play_at_ms,
    'home', jsonb_build_object('country', f.c_country, 'slot', f.c_slot, 'name', hc.name),
    'away', jsonb_build_object('country', f.o_country, 'slot', f.o_slot, 'name', ac.name),
    'orders', o, 'living', liv, 'text', f.result->>'text');
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_detail(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_round_orders(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_detail(bigint) TO anon;
    GRANT EXECUTE ON FUNCTION public.world_round_orders(text, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
