-- 077 · A PLAYED FRIENDLY OPENS ITS OWN BOOK TOO
--
-- 076 sent a league result to its report and left the friendly beside it
-- still pointing at '#/matches' - the list of everything, which is what you
-- reach for when you do not know which match you mean. A reader who has just
-- been told "Friendly played against Barbados" knows exactly which match he
-- means.
--
-- The report route already reads a friendly by id ('#/report?fr=<uuid>'):
-- it fetches the record from the umpire and paints the same book a league
-- match gets. The wire says that now.
--
-- 076's body, with the friendly's destination corrected. Nothing else moves.
CREATE OR REPLACE FUNCTION public.world_my_notifications(p_limit int DEFAULT 40)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE
  u uuid; c record; club record; s record; lim int;
  seen timestamptz; epoch_ms bigint; hour_ms bigint; today int;
  asks jsonb; news jsonb; n_ask int; n_new int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('ok', true, 'signedIn', false,
    'unread', 0, 'asks', '[]'::jsonb, 'news', '[]'::jsonb); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'signedIn', true, 'claim', null,
    'unread', 0, 'asks', '[]'::jsonb, 'news', '[]'::jsonb); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT * INTO s FROM seasons WHERE country_id = c.country_id ORDER BY season_no DESC LIMIT 1;
  lim := least(greatest(coalesce(p_limit, 40), 1), 120);
  SELECT n.seen_at INTO seen FROM notif_seen n WHERE n.user_id = u;
  seen := coalesce(seen, to_timestamp(0));
  epoch_ms := (extract(epoch FROM timestamptz '2026-08-03 00:00:00+00') * 1000)::bigint;
  SELECT coalesce(play_hour_utc, 12)::bigint * 3600000 INTO hour_ms FROM countries WHERE id = c.country_id;
  hour_ms := coalesce(hour_ms, 12 * 3600000);
  today := world_day();

  SELECT coalesce(jsonb_agg(row ORDER BY ord, ord2), '[]'::jsonb) INTO asks FROM (

    SELECT 1 AS ord, m.round AS ord2,
           jsonb_build_object('kind', 'no-xi', 'urgent', true,
             'title', 'No teamsheet for round ' || m.round,
             'body', 'You play ' || CASE WHEN m.home_slot = c.slot THEN coalesce(m.away_name, 'your rivals')
                                         ELSE coalesce(m.home_name, 'your rivals') END ||
                     ' today. Without a sheet the umpire picks for you.',
             'go', '#/orders', 'round', m.round) AS row
      FROM matches m
     WHERE m.country_id = c.country_id AND m.season_no = coalesce(s.season_no, 1)
       AND (m.home_slot = c.slot OR m.away_slot = c.slot)
       AND m.result IS NULL
       AND (s.start_day + world_day_of_round(m.round)) = today
       AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u AND o.country_id = c.country_id
                        AND o.season_no = m.season_no AND o.round = m.round)

    UNION ALL
    SELECT 2, 0,
           jsonb_build_object('kind', 'scout-waiting', 'urgent', false,
             'title', 'A boy is waiting on your answer',
             'body', coalesce(sc.recruit->>'name', 'A recruit') || ', found in ' ||
                     coalesce((SELECT n2.name FROM countries n2 WHERE n2.id = sc.nation), sc.nation) ||
                     '. Sign him or let him go.',
             'go', '#/academy')
      FROM academy_scouts sc
     WHERE sc.country_id = c.country_id AND sc.slot = c.slot AND sc.decision IS NULL

    UNION ALL
    SELECT 3, 0,
           jsonb_build_object('kind', 'friendly-waiting', 'urgent', true,
             'title', 'A friendly challenge from ' || coalesce(f.c_name, 'another club'),
             'body', 'They have asked for a game. Unanswered challenges die an hour before the start.',
             'go', '#/matches')
      FROM friendlies f
     WHERE f.status = 'pending' AND f.o_country = c.country_id AND f.o_slot = c.slot

    -- (4, the outbid ask, retired by 072: the wire carries the story.)

    UNION ALL
    SELECT 5, 0,
           jsonb_build_object('kind', 'money', 'urgent', coalesce((club.finance->>'admin')::boolean, false),
             'title', CASE WHEN coalesce((club.finance->>'admin')::boolean, false)
                           THEN 'The club is in administration'
                           ELSE 'The club is in the red' END,
             'body', CASE WHEN coalesce((club.finance->>'admin')::boolean, false)
                          THEN 'The sponsor pays half while you are under, and nothing gets built. Sell somebody or cut the wage bill.'
                          ELSE 'An overdraft costs three per cent a round. Nothing can be built until it is level.' END,
             'go', '#/finance')
     WHERE coalesce(club.bank, 0) < 0

    -- (6, the colts-short ask, retired by 075 with the Colts Cup itself.)
    -- (7, the boys-leaving warning, retired by 070.)
  ) a;

  SELECT coalesce(jsonb_agg(row ORDER BY at DESC), '[]'::jsonb) INTO news FROM (
    SELECT * FROM (

      SELECT coalesce(round_play_ms(m.country_id, m.season_no, m.round) + 10800000,
                      (extract(epoch FROM m.played_at) * 1000)::bigint) AS at,
             jsonb_build_object('at', coalesce(round_play_ms(m.country_id, m.season_no, m.round) + 10800000,
                      (extract(epoch FROM m.played_at) * 1000)::bigint),
               'kind', 'match',
               'fresh', to_timestamp(coalesce(round_play_ms(m.country_id, m.season_no, m.round) + 10800000,
                      (extract(epoch FROM m.played_at) * 1000)::bigint) / 1000.0) > seen,
               'title', CASE WHEN (m.result->>'winner') IS NULL THEN 'Round ' || m.round || ' ended level'
                             WHEN (m.result->>'winner') = CASE WHEN m.home_slot = c.slot THEN m.home_name ELSE m.away_name END
                             THEN 'You beat ' || CASE WHEN m.home_slot = c.slot THEN m.away_name ELSE m.home_name END
                             ELSE 'You lost to ' || CASE WHEN m.home_slot = c.slot THEN m.away_name ELSE m.home_name END END,
               'body', m.result->>'text',
               'go', '#/report?n=' || m.country_id || '&w=' || m.id) AS row
        FROM matches m
       WHERE m.country_id = c.country_id AND (m.home_slot = c.slot OR m.away_slot = c.slot)
         AND m.played_at IS NOT NULL
         AND (m.round IS NULL
              OR round_play_ms(m.country_id, m.season_no, m.round) IS NULL
              OR now_ms() >= round_play_ms(m.country_id, m.season_no, m.round) + 10800000)

      UNION ALL
      SELECT g.at,
             jsonb_build_object('at', g.at, 'kind', 'training',
               'fresh', to_timestamp(g.at / 1000.0) > seen,
               'title', CASE WHEN g.men = 1 THEN g.who || ' stepped up in the nets'
                             WHEN g.men = 2 THEN g.who || ' and one other stepped up'
                             ELSE g.who || ' and ' || (g.men - 1) || ' others stepped up' END,
               'body', 'Round ' || g.rnd || ' in the nets: ' || g.steps ||
                       CASE WHEN g.steps = 1 THEN ' skill moved.' ELSE ' skills moved.' END,
               'go', '#/training')
        FROM (
          SELECT (st->>'r')::int AS rnd,
                 epoch_ms + (s.start_day + coalesce(world_day_of_round((st->>'r')::int),
                                                    (st->>'r')::int - 1))::bigint * 86400000 + hour_ms AS at,
                 count(*) AS steps,
                 count(DISTINCT st->>'n') AS men,
                 min(st->>'n') AS who
            FROM jsonb_array_elements(coalesce(club.nets_history->'steps', '[]'::jsonb)) st
           WHERE (st->>'s')::int = coalesce(s.season_no, 1)
           GROUP BY 1, 2
        ) g

      UNION ALL
      SELECT epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
             jsonb_build_object('at', epoch_ms + l.settled_day::bigint * 86400000 + hour_ms,
               'kind', CASE WHEN l.country_id = c.country_id AND l.slot = c.slot THEN 'sold' ELSE 'bought' END,
               'fresh', to_timestamp((epoch_ms + l.settled_day::bigint * 86400000 + hour_ms) / 1000.0) > seen,
               'title', CASE WHEN l.country_id = c.country_id AND l.slot = c.slot
                             THEN l.player || ' sold' ELSE l.player || ' signed' END,
               'body', CASE WHEN l.country_id = c.country_id AND l.slot = c.slot
                            THEN 'The hammer fell at ' || notif_money(l.fee) || '.'
                            ELSE 'Yours for ' || notif_money(l.fee) || '. He is in the squad room now.' END,
               'go', '#/squad')
        FROM listings l
       WHERE l.status = 'sold' AND l.settled_day IS NOT NULL
         AND ((l.country_id = c.country_id AND l.slot = c.slot)
           OR (l.buyer_country = c.country_id AND l.buyer_slot = c.slot))

      UNION ALL
      SELECT (extract(epoch FROM cu.named_at) * 1000)::bigint,
             jsonb_build_object('at', (extract(epoch FROM cu.named_at) * 1000)::bigint,
               'kind', 'callup', 'fresh', cu.named_at > seen,
               'title', cu.player || ' is called up',
               'body', 'Named for his country in round ' || cu.round ||
                       '. He misses your nets that week, and the board is paid ' || notif_money(cu.fee) || '.',
               'go', '#/nations')
        FROM callups cu
       WHERE cu.country_id = c.country_id AND cu.slot = c.slot

      UNION ALL
      SELECT f.play_at_ms,
             jsonb_build_object('at', f.play_at_ms, 'kind', 'friendly-played',
               'fresh', to_timestamp(f.play_at_ms / 1000.0) > seen,
               'title', 'Friendly played against ' ||
                        CASE WHEN f.c_country = c.country_id AND f.c_slot = c.slot THEN f.o_name ELSE f.c_name END,
               'body', coalesce(f.result->>'text', 'The result is in.'),
               'go', '#/report?fr=' || f.id)
        FROM friendlies f
       WHERE f.status = 'played' AND f.play_at_ms IS NOT NULL
         AND ((f.c_country = c.country_id AND f.c_slot = c.slot)
           OR (f.o_country = c.country_id AND f.o_slot = c.slot))
         AND now_ms() >= coalesce(friendly_done_ms(f.id, f.c_country, f.play_at_ms), f.play_at_ms)
    ) q
    ORDER BY at DESC
    LIMIT lim
  ) n;

  SELECT count(*) INTO n_ask FROM jsonb_array_elements(asks);
  SELECT count(*) INTO n_new FROM jsonb_array_elements(news) x WHERE (x->>'fresh')::boolean;

  RETURN jsonb_build_object('ok', true, 'signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name),
    'unread', n_ask + n_new, 'asks', asks, 'news', news,
    'seenAt', (extract(epoch FROM seen) * 1000)::bigint);
END $$;

NOTIFY pgrst, 'reload schema';
