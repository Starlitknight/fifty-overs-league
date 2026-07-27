-- 005-orders-visibility.sql — SPECTATE KNOWS THE ORDERS; SECRECY KEEPS ITS SHAPE.
-- Two laws sharing one clock:
--   1. Orders LOCK at the first ball: world_submit_orders rejects a round
--      whose play window has already opened, so what the umpire plays is
--      exactly what was on file when the broadcast began.
--   2. Orders REVEAL at the first ball: world_round_orders hands any caller
--      the submitted orders for a round in play (or played), keyed by club
--      name - the spectate theatre feeds them straight into the engine, so
--      a watched match with human managers replays the recording exactly.
-- Before the window opens, both directions refuse: rivals cannot scout.
-- Tests may pin the clock via set_config('world.now_ms', ...) - absent that
-- GUC, the real now() rules.

CREATE OR REPLACE FUNCTION round_play_ms(p_country text, p_season int, p_round int)
RETURNS bigint LANGUAGE sql STABLE SET search_path = world, public AS $$
  SELECT w.epoch_ms
       + ((s.start_day + p_round - 1)::bigint * 86400000)
       + (c.play_hour_utc::bigint * 3600000)
    FROM worlds w, seasons s, countries c
   WHERE w.id = 1 AND s.country_id = p_country AND s.season_no = p_season AND c.id = p_country
$$;

CREATE OR REPLACE FUNCTION now_ms()
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('world.now_ms', true), '')::bigint,
                  (extract(epoch FROM now()) * 1000)::bigint)
$$;

CREATE OR REPLACE FUNCTION public.world_submit_orders(p_round int, p_orders jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; s record; play_ms bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_orders IS NULL OR pg_column_size(p_orders) > 30000 THEN RAISE EXCEPTION 'orders too large'; END IF;
  SELECT * INTO s FROM seasons WHERE country_id = c.country_id ORDER BY season_no DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no season'; END IF;
  IF p_round < 1 OR p_round > 18 THEN RAISE EXCEPTION 'bad round'; END IF;
  play_ms := round_play_ms(c.country_id, s.season_no, p_round);
  IF play_ms IS NOT NULL AND now_ms() >= play_ms THEN
    RAISE EXCEPTION 'round % is already in play - orders lock at the first ball', p_round;
  END IF;
  INSERT INTO orders(user_id, country_id, season_no, round, orders)
    VALUES (u, c.country_id, s.season_no, p_round, p_orders)
    ON CONFLICT (country_id, season_no, round, user_id)
    DO UPDATE SET orders = EXCLUDED.orders, submitted_at = now();
  RETURN jsonb_build_object('ok', true, 'country', c.country_id, 'season', s.season_no, 'round', p_round);
END $$;

CREATE OR REPLACE FUNCTION public.world_round_orders(p_country text, p_round int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE s record; play_ms bigint; o jsonb;
BEGIN
  IF p_round < 1 OR p_round > 18 THEN RAISE EXCEPTION 'bad round'; END IF;
  SELECT * INTO s FROM seasons WHERE country_id = p_country ORDER BY season_no DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('country', p_country, 'orders', '{}'::jsonb); END IF;
  play_ms := round_play_ms(p_country, s.season_no, p_round);
  IF play_ms IS NULL OR now_ms() < play_ms THEN
    RAISE EXCEPTION 'round % orders are sealed until the first ball', p_round;
  END IF;
  SELECT jsonb_object_agg(cl.name, o2.orders) INTO o
    FROM claims c
    JOIN clubs cl ON cl.country_id = c.country_id AND cl.slot = c.slot
    JOIN orders o2 ON o2.user_id = c.user_id AND o2.country_id = c.country_id
                  AND o2.season_no = s.season_no AND o2.round = p_round
   WHERE c.country_id = p_country;
  RETURN jsonb_build_object('country', p_country, 'seasonNo', s.season_no, 'round', p_round,
                            'orders', coalesce(o, '{}'::jsonb));
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_submit_orders(int, jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_round_orders(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_round_orders(text, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
