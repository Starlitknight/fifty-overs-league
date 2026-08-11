-- 079 · A DEAL NAMES BOTH ENDS OF ITSELF
--
-- Every club's diary already carries the men it bought and sold: 037 unions
-- the settled rows of the transfer board into the feed, and any manager may
-- read them on any club. What it could not do was say WHO was at the other
-- end, because three of the four kinds of deal have no club there at all.
--
-- The board keeps them all in one table, with a sentinel where the counter-
-- party would be:
--
--   the open market   a free agent walks on at slot -1 (market.mjs), so a
--                     club that signs him bought him from nobody
--   released          a man let go is written buyer_country 'released'
--   the bank          a quick sale is written buyer_country 'bank'
--
-- The feed handed all three to the page as a club to be named and linked, so
-- a reader of ANY club's diary saw "Bought Boris Zwart from a club for
-- $1,120,000", pointing at a club page that cannot exist (slot -1). Five of
-- Yorkshire's six diary lines read that way on the day this was written.
--
-- Nothing new is recorded. The deal already knows which kind it is - it is
-- written in the row - so the feed says so: 'how' is one of club, free,
-- released or bank, and the counterparty is named ONLY where there is a club
-- to name. The register (038) gets the same treatment, since it draws its
-- "to / from" column through the same helper.
--
-- 037's body and 038's body, with the counterparty resolved. Nothing else
-- moves.

CREATE OR REPLACE FUNCTION public.world_club_events(p_country text, p_slot int, p_limit int DEFAULT 60)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE
  u uuid; mine boolean; lim int; hour_ms bigint; epoch_ms bigint;
  club record; o jsonb;
BEGIN
  SELECT name, slot INTO club FROM clubs WHERE country_id = p_country AND slot = p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such club'; END IF;
  u := _uid();
  mine := u IS NOT NULL AND EXISTS (
    SELECT 1 FROM claims WHERE user_id = u AND country_id = p_country AND slot = p_slot);
  lim := least(greatest(coalesce(p_limit, 60), 1), 200);
  epoch_ms := (extract(epoch FROM timestamptz '2026-08-03 00:00:00+00') * 1000)::bigint;
  SELECT coalesce(play_hour_utc, 12)::bigint * 3600000 INTO hour_ms FROM countries WHERE id = p_country;
  hour_ms := coalesce(hour_ms, 12 * 3600000);

  SELECT coalesce(jsonb_agg(row ORDER BY at DESC), '[]'::jsonb) INTO o FROM (
    -- every league match this club played, and how it went
    SELECT (extract(epoch FROM m.played_at) * 1000)::bigint AS at,
           jsonb_build_object('at', (extract(epoch FROM m.played_at) * 1000)::bigint,
             'kind', 'match', 'round', m.round, 'season', m.season_no,
             'home', m.home_slot = p_slot,
             'oppSlot', CASE WHEN m.home_slot = p_slot THEN m.away_slot ELSE m.home_slot END,
             'oppName', CASE WHEN m.home_slot = p_slot THEN m.away_name ELSE m.home_name END,
             'note', m.result->>'text',
             'won', (m.result->>'winner') IS NOT DISTINCT FROM
                    CASE WHEN m.home_slot = p_slot THEN m.home_name ELSE m.away_name END) AS row
      FROM matches m
     WHERE m.country_id = p_country AND (m.home_slot = p_slot OR m.away_slot = p_slot)
       AND m.played_at IS NOT NULL

    UNION ALL
    -- men bought and men sold, on the world day the envelopes opened, each
    -- deal saying which of the four kinds it is and naming a club only where
    -- there is one at the other end
    SELECT epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
           jsonb_build_object('at', epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
             'kind', CASE WHEN d.sold THEN 'sell' ELSE 'buy' END,
             'how', d.how, 'player', l.player, 'amount', l.fee,
             'oppCountry', CASE WHEN d.how = 'club' THEN d.oc END,
             'oppSlot', CASE WHEN d.how = 'club' THEN d.os END,
             -- the club at the other end of the deal, by the name it wears now
             'oppName', CASE WHEN d.how = 'club' THEN
                 (SELECT c2.name FROM clubs c2 WHERE c2.country_id = d.oc AND c2.slot = d.os) END)
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

    UNION ALL
    -- a challenge issued or answered, and the friendly it became
    SELECT (extract(epoch FROM f.created_at) * 1000)::bigint,
           jsonb_build_object('at', (extract(epoch FROM f.created_at) * 1000)::bigint,
             'kind', 'friendly', 'note', f.status,
             'home', f.c_country = p_country AND f.c_slot = p_slot,
             'oppCountry', CASE WHEN f.c_country = p_country AND f.c_slot = p_slot THEN f.o_country ELSE f.c_country END,
             'oppSlot', CASE WHEN f.c_country = p_country AND f.c_slot = p_slot THEN f.o_slot ELSE f.c_slot END,
             'oppName', CASE WHEN f.c_country = p_country AND f.c_slot = p_slot THEN f.o_name ELSE f.c_name END,
             'playAtMs', f.play_at_ms)
      FROM friendlies f
     WHERE ((f.c_country = p_country AND f.c_slot = p_slot)
         OR (f.o_country = p_country AND f.o_slot = p_slot))
       AND f.status <> 'expired'

    UNION ALL
    SELECT f.play_at_ms,
           jsonb_build_object('at', f.play_at_ms, 'kind', 'friendly-played',
             'note', f.result->>'text',
             'oppSlot', CASE WHEN f.c_country = p_country AND f.c_slot = p_slot THEN f.o_slot ELSE f.c_slot END,
             'oppCountry', CASE WHEN f.c_country = p_country AND f.c_slot = p_slot THEN f.o_country ELSE f.c_country END,
             'oppName', CASE WHEN f.c_country = p_country AND f.c_slot = p_slot THEN f.o_name ELSE f.c_name END,
             'friendlyId', f.id)
      FROM friendlies f
     WHERE f.status = 'played'
       AND ((f.c_country = p_country AND f.c_slot = p_slot)
         OR (f.o_country = p_country AND f.o_slot = p_slot))

    UNION ALL
    -- the selectors calling on this club's men
    SELECT (extract(epoch FROM c.named_at) * 1000)::bigint,
           jsonb_build_object('at', (extract(epoch FROM c.named_at) * 1000)::bigint,
             'kind', 'callup', 'player', c.player, 'round', c.round, 'amount', c.fee)
      FROM callups c
     WHERE c.country_id = p_country AND c.slot = p_slot

    UNION ALL
    -- the club's own business, for the club's own manager
    SELECT (extract(epoch FROM ord.submitted_at) * 1000)::bigint,
           jsonb_build_object('at', (extract(epoch FROM ord.submitted_at) * 1000)::bigint,
             'kind', 'orders', 'round', ord.round, 'season', ord.season_no)
      FROM orders ord
     WHERE mine AND ord.user_id = u AND ord.country_id = p_country

    UNION ALL
    SELECT epoch_ms + s.day::bigint * 86400000 + hour_ms,
           jsonb_build_object('at', epoch_ms + s.day::bigint * 86400000 + hour_ms,
             'kind', 'scouted', 'amount', s.paid)
      FROM scouted s
     WHERE mine AND s.country_id = p_country AND s.slot = p_slot

    ORDER BY at DESC LIMIT lim) q;

  RETURN jsonb_build_object('ok', true, 'club', club.name, 'country', p_country,
    'slot', p_slot, 'mine', mine, 'events', o);
END $$;

-- the register, through the same resolution: its "to / from" column is drawn
-- by the same helper as the diary line, so it inherited the same ghost club
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
             -- a world day belongs to a season: thirty-five of them make a year
             'season', (l.settled_day / 35) + 1,
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
    GRANT EXECUTE ON FUNCTION public.world_club_events(text, int, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_club_transfers(text, int, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_club_events(text, int, int) TO anon;
    GRANT EXECUTE ON FUNCTION public.world_club_transfers(text, int, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
