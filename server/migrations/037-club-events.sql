-- 037-club-events.sql — WHAT HAPPENED AT THIS CLUB, IN ORDER.
-- A club's dossier could show you its squad, its record and its trophies -
-- three states of the world, and not one moment of how it got there. The
-- record says a match was won; it does not say that the day before it, the
-- club sold its opening bowler.
--
-- Nothing new is recorded to answer this. Every source already carries the
-- moment it happened - a match its played_at, a call-up its named_at, a
-- challenge its created_at, an order its submitted_at, a transfer the world
-- day it settled - and the nation's own hour is a column on countries. So
-- the feed is a UNION over the record as it stands, computed live: it can
-- never drift from what actually happened, because it IS what happened.
--
-- PUBLIC AND PRIVATE. Matches, transfers, friendlies and call-ups are the
-- world's business and any manager may read them on any club. Teamsheets
-- filed and scouts paid are the club's own, and are returned only to the
-- manager who holds it.

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
    -- men bought and men sold, on the world day the envelopes opened
    SELECT epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
           jsonb_build_object('at', epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
             'kind', CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN 'sell' ELSE 'buy' END,
             'player', l.player, 'amount', l.fee,
             'oppCountry', CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN l.buyer_country ELSE l.country_id END,
             'oppSlot', CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN l.buyer_slot ELSE l.slot END,
             -- the club at the other end of the deal, by the name it wears now
             'oppName', (SELECT c2.name FROM clubs c2
                          WHERE c2.country_id = CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN l.buyer_country ELSE l.country_id END
                            AND c2.slot = CASE WHEN l.country_id = p_country AND l.slot = p_slot THEN l.buyer_slot ELSE l.slot END))
      FROM listings l
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_club_events(text, int, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_club_events(text, int, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
