-- 026-thirty-day-season.sql — THE CALENDAR CHANGES SHAPE.
--
-- The league used to play every single day: round N was day N-1 of the season,
-- eighteen days on the trot, and a manager never got an evening off. It now
-- runs in blocks - THREE ROUNDS, THEN A REST DAY, six times over - and the
-- season is thirty days:
--
--   0 1 2   rounds 1-3        12 13 14  rounds 10-12    24        honours + play-ins
--   3       rest · window 1   15        rest            25-28     the cups
--   4 5 6   rounds 4-6        16 17 18  rounds 13-15    29        rest
--   7       rest · window 2   19        rest
--   8 9 10  rounds 7-9        20 21 22  rounds 16-18
--   11      rest · window 3   23        rest
--
-- The database holds two things that assumed the old shape, and both of them
-- matter to a manager rather than to a report:
--
--   round_play_ms      WHEN a round is bowled. It gates the teamsheet lock
--                      ("sealed until an hour before the first ball"), so with
--                      the old arithmetic every round from the fourth on would
--                      have locked a day early and let orders through for a
--                      match that had already been played.
--   the window rounds  5, 9 and 13 were written into two functions by hand.
--                      The tours now sit on the rest days that close the first
--                      three blocks, and the men they take are missing from
--                      rounds 4, 7 and 10.
--
-- Both now ask a function instead of doing arithmetic, so the next time the
-- calendar moves there is ONE line to change in SQL rather than four - the same
-- discipline server/clock.mjs and the client planet already keep.
--
-- Nothing already played moves. Days 0, 1 and 2 are rounds 1, 2 and 3 under
-- both calendars, and results are keyed by round, so a world part-way through
-- its first block keeps every match it has bowled.

-- the calendar, in SQL: round -> day-in-season, the exact mirror of
-- clock.mjs dayOfRound and the client planet's dayOfRound
CREATE OR REPLACE FUNCTION world_day_of_round(p_round int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_round BETWEEN 1 AND 18
              THEN ((p_round - 1) / 3) * 4 + ((p_round - 1) % 3)
         END
$$;

-- and the three rounds an international window takes men out of
CREATE OR REPLACE FUNCTION world_window_rounds()
RETURNS int[] LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY[4, 7, 10] $$;

-- WHEN IS A ROUND BOWLED. Was start_day + round - 1; the calendar owns it now.
CREATE OR REPLACE FUNCTION round_play_ms(p_country text, p_season int, p_round int)
RETURNS bigint LANGUAGE sql STABLE SET search_path = world, public AS $$
  SELECT w.epoch_ms
       + ((s.start_day + world_day_of_round(p_round))::bigint * 86400000)
       + (c.play_hour_utc::bigint * 3600000)
    FROM worlds w, seasons s, countries c
   WHERE w.id = 1 AND s.country_id = p_country AND s.season_no = p_season AND c.id = p_country
$$;

-- the round's orders, and whether it is a window round
CREATE OR REPLACE FUNCTION public.world_round_orders(p_country text, p_round int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE s record; play_ms bigint; o jsonb; liv jsonb; rec jsonb; ap jsonb; merged jsonb;
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
  -- a club at a time, because jsonb's own merge would replace a club's whole
  -- book rather than add a man to it
  merged := liv || rec;
  ap := world_absent_patch(p_country, s.season_no, p_round);
  SELECT coalesce(jsonb_object_agg(k, (merged -> k) || coalesce(ap -> k, '{}'::jsonb)), '{}'::jsonb)
    INTO liv FROM jsonb_object_keys(merged) k;
  RETURN jsonb_build_object('country', p_country, 'seasonNo', s.season_no, 'round', p_round,
                            'orders', coalesce(o, '{}'::jsonb),
                            'living', liv,
                            'window', p_round = ANY(world_window_rounds()),
                            'away', coalesce(ap, '{}'::jsonb));
END $$;

-- a manager's own status, with the window rounds read from the calendar
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb; s record; cu jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'at', submitted_at) ORDER BY round)
    INTO o FROM orders WHERE user_id = u AND country_id = c.country_id;
  SELECT * INTO s FROM seasons WHERE country_id = c.country_id ORDER BY season_no DESC LIMIT 1;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'player', player, 'fee', fee) ORDER BY round, pick)
    INTO cu FROM callups
   WHERE country_id = c.country_id AND slot = c.slot AND season_no = coalesce(s.season_no, 0);
  RETURN jsonb_build_object('signedIn', true,
    'claim', jsonb_build_object('country', c.country_id, 'slot', c.slot, 'club', club.name,
                                'name', c.display_name, 'ground', club.ground),
    'manager', c.display_name,
    'orders', coalesce(o, '[]'::jsonb),
    'squad', club.squad,
    'training', coalesce(club.training, '{}'::jsonb),
    'identity', club.identity,
    'academy', club.academy,
    'youth', coalesce(club.youth, '[]'::jsonb),
    'seats', club.seats,
    'finance', coalesce(club.finance, '{}'::jsonb),
    'callups', coalesce(cu, '[]'::jsonb),
    'windows', to_jsonb(world_window_rounds()),
    'bank', club.bank);
END $$;

-- and the world row remembers the shape of its own calendar
UPDATE worlds SET cycle_days = 30, league_rounds = 18 WHERE id = 1;
