-- 069 · THE BELL KEEPS THE BROADCAST'S CLOCK
--
-- The news feed derived a league result from matches.played_at - the moment
-- the umpire BANKED it, which since 047 is an hour before the first ball.
-- So the bell lit up "You beat Kent" for a match every other page in the
-- game rightly insisted had not started: a phantom, and a spoiler. A
-- friendly did the same the moment its first ball was bowled, while its
-- broadcast still had three hours of reveal to run.
--
-- 060's body, with the one law every other read surface already obeys:
-- nothing is announced before the broadcast has shown it. A league match
-- speaks when its window closes; a friendly when its last delivery lands;
-- and each item is STAMPED at that moment too, so "2h ago" stops meaning
-- "2h before it happened".

-- THE FEED.
--
-- Returns { ok, unread, asks[], news[] }. Asks first and always - they are
-- state, not history, and a done ask simply stops being derivable. News is
-- newest-first and carries `fresh`, which is the watermark comparison; the
-- badge counts asks plus fresh news, the way both games count theirs.
-- ---------------------------------------------------------------------------
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

  -- =========================================================================
  -- ASKS. Every one of these is a thing the manager can DO something about,
  -- and every one of them stops being derivable the moment he does it. They
  -- carry an `urgent` flag for the ones with a clock on them.
  -- =========================================================================
  SELECT coalesce(jsonb_agg(row ORDER BY ord, ord2), '[]'::jsonb) INTO asks FROM (

    -- 1. A MATCH TODAY AND NO TEAMSHEET. The one that actually loses matches.
    --    A club that files nothing is picked by the umpire's autopick, which
    --    is a fallback and not a plan.
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
    -- 2. A BOY ON THE TABLE. The scout was paid for and nobody answered him.
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
    -- 3. A CHALLENGE UNANSWERED. Somebody asked for a game.
    SELECT 3, 0,
           jsonb_build_object('kind', 'friendly-waiting', 'urgent', true,
             'title', 'A friendly challenge from ' || coalesce(f.c_name, 'another club'),
             'body', 'They have asked for a game. Unanswered challenges die an hour before the start.',
             'go', '#/matches')
      FROM friendlies f
     WHERE f.status = 'pending' AND f.o_country = c.country_id AND f.o_slot = c.slot

    UNION ALL
    -- 4. OUTBID. Your money is no longer the best money on a man you wanted.
    SELECT 4, 0,
           jsonb_build_object('kind', 'outbid', 'urgent', true,
             'title', 'Outbid on ' || l.player,
             'body', 'Somebody has gone above you. The hammer falls when the listing closes.',
             'go', '#/market', 'player', l.player)
      FROM listings l
     WHERE l.status = 'open'
       AND EXISTS (SELECT 1 FROM bids b WHERE b.listing_id = l.id AND b.user_id = u)
       AND (SELECT b2.user_id FROM bids b2 WHERE b2.listing_id = l.id
             ORDER BY b2.amount DESC, b2.placed_at ASC LIMIT 1) IS DISTINCT FROM u

    UNION ALL
    -- 5. THE BOOKS. In the red is a warning; in administration is a state, and
    --    the manager should not have to open the finance page to learn it.
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

    UNION ALL
    -- 6. NO COLTS SIDE. The Colts Cup is forfeited in public, which is a
    --    thing a manager should learn before it happens rather than after.
    SELECT 6, 0,
           jsonb_build_object('kind', 'colts-short', 'urgent', false,
             'title', 'You cannot field a Colts Cup side',
             'body', 'The competition asks for fifteen boys under twenty-one and you have ' ||
                     jsonb_array_length(coalesce(club.youth, '[]'::jsonb)) ||
                     '. Short of it, the tie is forfeited.',
             'go', '#/academy')
     WHERE jsonb_array_length(coalesce(club.youth, '[]'::jsonb)) < 15

    UNION ALL
    -- 7. BOYS ABOUT TO WALK. Twenty-one and gone from the world unless you
    --    hand them a senior shirt first.
    SELECT 7, 0,
           jsonb_build_object('kind', 'boys-leaving', 'urgent', false,
             'title', (SELECT CASE WHEN count(*) = 1 THEN 'A boy leaves at the turning of the year'
                                   ELSE count(*) || ' boys leave at the turning of the year' END
                         FROM jsonb_array_elements(club.youth) y WHERE (y->>'age')::int >= 20),
             'body', 'Twenty-one, and gone from the world unless they are handed senior contracts first.',
             'go', '#/squad')
     WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(club.youth, '[]'::jsonb)) y
                    WHERE (y->>'age')::int >= 20)
  ) a;

  -- =========================================================================
  -- NEWS. What the world did to this club, newest first, each one a row that
  -- already existed. `fresh` is the watermark: it is what the badge counts.
  -- =========================================================================
  SELECT coalesce(jsonb_agg(row ORDER BY at DESC), '[]'::jsonb) INTO news FROM (
    SELECT * FROM (

      -- a league match, and how it went
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
               'go', '#/match?id=' || m.id) AS row
        FROM matches m
       WHERE m.country_id = c.country_id AND (m.home_slot = c.slot OR m.away_slot = c.slot)
         AND m.played_at IS NOT NULL
         -- THE BELL KEEPS THE BROADCAST'S CLOCK (069). played_at is the BANK
         -- time, and the umpire banks an hour before first ball - so the bell
         -- was announcing "You beat Kent" for a match the whole rest of the
         -- game insisted had not been played yet. No word before the window
         -- has closed; a match with no window (a cup tie off the calendar)
         -- speaks at its bank time, exactly as the card RPC treats it.
         AND (m.round IS NULL
              OR round_play_ms(m.country_id, m.season_no, m.round) IS NULL
              OR now_ms() >= round_play_ms(m.country_id, m.season_no, m.round) + 10800000)

      UNION ALL
      -- THE TRAINING REPORT, ONE A ROUND. Not one notification per skill
      -- point: a club forty rounds into a season has hundreds of those, and
      -- they would bury every result, transfer and call-up under a drift of
      -- "his economy went up by one". FTP files ONE training report per
      -- update and names who moved, so this groups the book of the nets by
      -- the round it happened in and counts the men.
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
      -- a man bought or sold, on the day the envelopes opened
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
      -- one of yours picked for his country
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
      -- a friendly that was actually played
      SELECT f.play_at_ms,
             jsonb_build_object('at', f.play_at_ms, 'kind', 'friendly-played',
               'fresh', to_timestamp(f.play_at_ms / 1000.0) > seen,
               'title', 'Friendly played against ' ||
                        CASE WHEN f.c_country = c.country_id AND f.c_slot = c.slot THEN f.o_name ELSE f.c_name END,
               'body', coalesce(f.result->>'text', 'The result is in.'),
               'go', '#/matches')
        FROM friendlies f
       WHERE f.status = 'played' AND f.play_at_ms IS NOT NULL
         AND ((f.c_country = c.country_id AND f.c_slot = c.slot)
           OR (f.o_country = c.country_id AND f.o_slot = c.slot))
         -- same law for a friendly: its broadcast reveals a delivery every
         -- eighteen seconds, and friendly_done_ms is the moment the last one
         -- lands - the result line and the bell learn it together
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
