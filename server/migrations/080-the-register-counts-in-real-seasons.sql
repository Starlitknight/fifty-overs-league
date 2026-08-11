-- 080 · THE REGISTER COUNTS IN REAL SEASONS
--
-- The transfer register has carried a Season column since 038, and it has
-- always answered it with arithmetic:
--
--   'season', (l.settled_day / 35) + 1
--
-- A season is forty-two days (clock.mjs, CYCLE), not thirty-five. The column
-- was therefore wrong for every deal outside the first thirty-five days of
-- the world and drifted by a season for every forty-two that passed: by the
-- fifth year the register said seven. Nobody caught it because nothing on
-- any page linked to the register - it was reachable only by typing the
-- address - so the column has never been read.
--
-- The arithmetic was the wrong instrument anyway. Seasons are not a constant
-- the register may reconstruct: they are ROWS, one per country per year, each
-- with the world day it started on, and a country's calendar is its own. The
-- register asks the table now - the greatest season whose start day is not
-- after the day the deal settled, in THIS club's country, which is whose
-- register this is.
--
-- A day before any season started (the founding market, before the first
-- fixture is drawn) has no season to name, and says season 1 rather than
-- nought or nothing.
--
-- 079's body otherwise, verbatim: same signature, same shape, same four
-- kinds of deal, same totals. Only the season is read instead of guessed.

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
             -- WHICH SEASON A DAY BELONGS TO IS A ROW, NOT A SUM. Each country
             -- keeps its own start days; the deal falls in the last season to
             -- have begun by the day it settled.
             'season', coalesce(
               (SELECT s.season_no FROM seasons s
                 WHERE s.country_id = p_country AND s.start_day <= l.settled_day
                 ORDER BY s.start_day DESC LIMIT 1), 1),
             'way', CASE WHEN d.sold THEN 'out' ELSE 'in' END,
             'how', d.how,
             'player', l.player,
             'age', nullif((l.player_json->>'age'), '')::numeric,
             'fee', l.fee,
             -- the club at the other end, by the name it wears now
             'oppCountry', CASE WHEN d.how = 'club' THEN d.oc END,
             'oppSlot', CASE WHEN d.how = 'club' THEN d.os END,
             'oppName', CASE WHEN d.how = 'club' THEN
                 (SELECT c2.name FROM clubs c2 WHERE c2.country_id = d.oc AND c2.slot = d.os) END
           ) AS row
      FROM listings l
      CROSS JOIN LATERAL (SELECT
             (l.country_id = p_country AND l.slot = p_slot) AS sold,
             CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN l.buyer_country ELSE l.country_id END AS oc,
             CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN l.buyer_slot ELSE l.slot END AS os) d0
      CROSS JOIN LATERAL (SELECT d0.sold, d0.oc, d0.os,
             CASE WHEN d0.oc = 'released' THEN 'released'
                  WHEN d0.oc = 'bank' THEN 'bank'
                  WHEN d0.os IS NULL OR d0.os < 0 THEN 'free'
                  ELSE 'club' END AS how) d
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
