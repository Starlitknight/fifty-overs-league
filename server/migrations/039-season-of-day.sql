-- 039-season-of-day.sql — A WORLD DAY BELONGS TO A SEASON, AND THE WORLD SAYS
-- WHICH, NOT ARITHMETIC.
--
-- 038 worked out which season a transfer fell in by dividing the world day by
-- thirty-five, because a season was thirty-five days. A season is now
-- forty-two - the boys were given a week of the calendar to themselves - and
-- the moment that changed, every fee in the register moved to the wrong year.
--
-- Dividing by the new number would only queue up the same bug for the next
-- time the calendar moves. The seasons table already records the day each
-- season opened, per nation, and a transfer belongs to the last season that
-- had opened when it settled. So ask it. Nothing to keep in step, and a world
-- that is redealt or restarted still reads correctly.

CREATE OR REPLACE FUNCTION public.world_club_transfers(p_country text, p_slot int, p_limit int DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE
  club record; lim int; hour_ms bigint; epoch_ms bigint;
  n_in int; n_out int; sum_in bigint; sum_out bigint; o jsonb;
BEGIN
  SELECT name INTO club FROM clubs WHERE country_id = p_country AND slot = p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such club'; END IF;
  lim := least(greatest(coalesce(p_limit, 100), 1), 400);
  epoch_ms := (extract(epoch FROM timestamptz '2026-08-03 00:00:00+00') * 1000)::bigint;
  SELECT coalesce(play_hour_utc, 12)::bigint * 3600000 INTO hour_ms FROM countries WHERE id = p_country;
  hour_ms := coalesce(hour_ms, 12 * 3600000);

  -- bought: this club was the buyer.  sold: this club was the seller.
  SELECT count(*)::int, coalesce(sum(fee), 0)::bigint INTO n_in, sum_out
    FROM listings
   WHERE status = 'sold' AND settled_day IS NOT NULL
     AND buyer_country = p_country AND buyer_slot = p_slot;
  SELECT count(*)::int, coalesce(sum(fee), 0)::bigint INTO n_out, sum_in
    FROM listings
   WHERE status = 'sold' AND settled_day IS NOT NULL
     AND country_id = p_country AND slot = p_slot;

  SELECT coalesce(jsonb_agg(row ORDER BY at DESC), '[]'::jsonb) INTO o FROM (
    SELECT epoch_ms + l.settled_day::bigint * 86400000 + hour_ms AS at,
           jsonb_build_object(
             'at', epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
             -- the last season this nation had opened when the envelopes did
             'season', coalesce((SELECT s.season_no FROM seasons s
                                  WHERE s.country_id = p_country
                                    AND s.start_day <= l.settled_day
                                  ORDER BY s.start_day DESC LIMIT 1), 1),
             'way', CASE WHEN l.buyer_country = p_country AND l.buyer_slot = p_slot THEN 'in' ELSE 'out' END,
             'player', l.player,
             'age', nullif((l.player_json->>'age'), '')::numeric,
             'fee', l.fee,
             -- the club at the other end, by the name it wears now
             'oppCountry', CASE WHEN l.buyer_country = p_country AND l.buyer_slot = p_slot THEN l.country_id ELSE l.buyer_country END,
             'oppSlot', CASE WHEN l.buyer_country = p_country AND l.buyer_slot = p_slot THEN l.slot ELSE l.buyer_slot END,
             'oppName', (SELECT c2.name FROM clubs c2
                          WHERE c2.country_id = CASE WHEN l.buyer_country = p_country AND l.buyer_slot = p_slot THEN l.country_id ELSE l.buyer_country END
                            AND c2.slot = CASE WHEN l.buyer_country = p_country AND l.buyer_slot = p_slot THEN l.slot ELSE l.buyer_slot END)
           ) AS row
      FROM listings l
     WHERE l.status = 'sold' AND l.settled_day IS NOT NULL
       AND ((l.country_id = p_country AND l.slot = p_slot)
         OR (l.buyer_country = p_country AND l.buyer_slot = p_slot))
     ORDER BY at DESC LIMIT lim) q;

  RETURN jsonb_build_object(
    'ok', true, 'club', club.name, 'country', p_country, 'slot', p_slot,
    'bought', n_in, 'sold', n_out, 'transfers', n_in + n_out,
    'spent', sum_out, 'received', sum_in, 'net', sum_in - sum_out,
    'avgBuy', CASE WHEN n_in > 0 THEN round(sum_out::numeric / n_in) ELSE NULL END,
    'avgSell', CASE WHEN n_out > 0 THEN round(sum_in::numeric / n_out) ELSE NULL END,
    'deals', o);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_club_transfers(text, int, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_club_transfers(text, int, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
