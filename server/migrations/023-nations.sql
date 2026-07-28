-- 023-nations.sql — THE INTERNATIONAL GAME.
--
-- Until now a "national team" was a fiction that existed for three days a
-- year: fifteen names picked by rating at the cup window so the World Cup
-- bracket had somebody to run. Nothing in the world knew it had happened.
--
-- Three rounds a season are now WINDOW DAYS (rounds 5, 9 and 13). On one of
-- them the selectors name a squad of fifteen for every nation on earth; those
-- men are NOT at their clubs for that round; the club is paid for the loss;
-- and at 18:00 UTC the nations play each other on the real engine.
--
-- Stored here: the SQUADS as named (a decision, made once, never re-made) and
-- the TOURS as played. The compensation is not stored - the books walk the
-- callups from genesis like everything else they derive.

-- THE SQUAD AS NAMED. One row a man a window; the pick order is the
-- selectors' own, so a squad reads as a squad rather than as a set.
CREATE TABLE IF NOT EXISTS callups (
  country_id text NOT NULL,
  season_no  int  NOT NULL,
  round      int  NOT NULL,
  pick       int  NOT NULL,
  slot       int  NOT NULL,               -- the club that loses him
  player     text NOT NULL,
  age        int,
  fee        int  NOT NULL,               -- what his club is paid for the week
  named_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, season_no, round, player)
);
CREATE INDEX IF NOT EXISTS callups_club ON callups (country_id, slot, season_no, round);

-- THE TOURS. Identified by the WORLD DAY they were played on, because that is
-- the one thing two nations founded at different times still agree about.
CREATE TABLE IF NOT EXISTS nat_matches (
  id               text PRIMARY KEY,      -- 'nat:d123:g0' — the seed derives from this
  world_day        int  NOT NULL,
  season_no        int  NOT NULL,
  round            int  NOT NULL,
  a_country        text NOT NULL,
  b_country        text NOT NULL,
  a_name           text NOT NULL,
  b_name           text NOT NULL,
  seed             bigint NOT NULL,
  engine_version   text NOT NULL,
  result           jsonb NOT NULL,
  result_canonical text NOT NULL,
  living           jsonb,
  played_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nat_matches_day ON nat_matches (world_day);
CREATE INDEX IF NOT EXISTS nat_matches_country ON nat_matches (a_country, b_country);

-- ---------------------------------------------------------------------------
-- WHO IS AWAY, as a living patch. The broadcast rebuilds both squads from
-- their world seeds and lays the banked living state over them; a man who was
-- with his country has to arrive in that same parcel or the theatre would
-- field an eleven the umpire never picked. So absence travels as {"a":true}
-- beside a man's experience and form, and the client drops him.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION world_absent_patch(p_country text, p_season int, p_round int)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_object_agg(cl.name, men), '{}'::jsonb)
    FROM clubs cl
    JOIN LATERAL (
      SELECT jsonb_object_agg(cu.player, jsonb_build_object('a', true)) AS men
        FROM callups cu
       WHERE cu.country_id = cl.country_id AND cu.slot = cl.slot
         AND cu.season_no = p_season AND cu.round = p_round
    ) m ON m.men IS NOT NULL
   WHERE cl.country_id = p_country;
$$;

-- ROUND ORDERS, now carrying the window. Everything else about it stands:
-- sealed until an hour before the first ball, then the submitted sheets and
-- the living state of the men who will play them.
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
                            'window', p_round IN (5, 9, 13),
                            'away', coalesce(ap, '{}'::jsonb));
END $$;

-- ---------------------------------------------------------------------------
-- A MANAGER'S OWN STATUS, now knowing who his country has taken. The sheet
-- reads this so it can grey a man out before you pick him rather than after.
-- ---------------------------------------------------------------------------
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
    'windows', jsonb_build_array(5, 9, 13),
    'bank', club.bank);
END $$;

-- what the whole world may read: the squads as named and the tours as played
DROP VIEW IF EXISTS public.world_callups;
CREATE VIEW public.world_callups AS
  SELECT cu.country_id, cu.season_no, cu.round, cu.pick, cu.slot, cu.player, cu.age, cu.fee,
         cl.name AS club
    FROM callups cu
    LEFT JOIN clubs cl ON cl.country_id = cu.country_id AND cl.slot = cu.slot;
DROP VIEW IF EXISTS public.world_nat_matches;
CREATE VIEW public.world_nat_matches AS
  SELECT id, world_day, season_no, round, a_country, b_country, a_name, b_name,
         seed, engine_version, result ->> 'winner' AS winner, result ->> 'text' AS text
    FROM nat_matches;

-- the tour as the theatre needs it: the card, the sheet-free orders and the
-- living state both sides were played with, so a cap can be watched back
CREATE OR REPLACE FUNCTION public.world_nat_match(p_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM nat_matches WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such international'; END IF;
  RETURN jsonb_build_object('id', m.id, 'day', m.world_day, 'seasonNo', m.season_no,
    'round', m.round, 'a', m.a_name, 'b', m.b_name,
    'aCountry', m.a_country, 'bCountry', m.b_country,
    'seed', m.seed, 'engineVersion', m.engine_version,
    'living', coalesce(m.living, '{}'::jsonb),
    'winner', m.result ->> 'winner', 'text', m.result ->> 'text');
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_round_orders(text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_nat_match(text) TO authenticated;
    GRANT SELECT ON public.world_callups, public.world_nat_matches TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO anon;
    GRANT EXECUTE ON FUNCTION public.world_round_orders(text, int) TO anon;
    GRANT EXECUTE ON FUNCTION public.world_nat_match(text) TO anon;
    GRANT SELECT ON public.world_callups, public.world_nat_matches TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
