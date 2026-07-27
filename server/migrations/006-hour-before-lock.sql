-- 006-hour-before-lock.sql — TEAMS IN AT T-MINUS ONE HOUR.
-- The lock-and-reveal boundary moves from the first ball to ONE HOUR before
-- it, like a real teamsheet exchange: an hour out, orders are final and the
-- named XIs go public on the match preview. Same two laws as 005, same
-- shared clock, one hour earlier:
--   LOCK   - world_submit_orders rejects a round inside the final hour.
--   REVEAL - world_round_orders answers from an hour before the first ball.

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
  IF play_ms IS NOT NULL AND now_ms() >= play_ms - 3600000 THEN
    RAISE EXCEPTION 'round % teamsheets are in - orders lock an hour before the first ball', p_round;
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
  IF play_ms IS NULL OR now_ms() < play_ms - 3600000 THEN
    RAISE EXCEPTION 'round % orders are sealed until an hour before the first ball', p_round;
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

NOTIFY pgrst, 'reload schema';
