-- 040-youth-academy.sql — THE YOUTH ACADEMY (docs/ACADEMY.md is the authority)
--
-- The academy stops being a room the umpire fills and becomes a room the
-- manager runs. He scouts one boy per rest day from a nation he chooses, sees
-- everything about him, and signs him or lets him go. Nothing is promoted
-- automatically any more: a senior shirt is a decision with a price on it.
--
-- WHY THE BOYS ARE PRE-GENERATED. A recruit is made by the shipped cricket
-- engine, and Postgres cannot run it. So the umpire lays out one candidate per
-- club per rest day per nation - a pure function of (club, day, nation, level),
-- so a re-run makes the same boys - and this file only ever REVEALS one, takes
-- the fee, and writes down that the trip was made. That keeps the button
-- instant for the manager while leaving every cricketer the engine's work.
--
-- Candidates are never readable directly. If they were, a manager could read
-- all nineteen and pick the best without paying for a single trip, and the
-- nation choice would stop being a choice.

-- ---------------------------------------------------------------------------
-- FIRST, A CORRECTION. 032 mirrored the five-week calendar into SQL, and the
-- season is six weeks now: the boys were given week four, and rounds 13-16
-- moved to the far side of it. round_play_ms - which is what tells a manager
-- when his orders lock - has been reading the old map ever since.
-- History is immutable; corrections are new files.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION world_day_of_round(p_round int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_round = 16 THEN 32                    -- the league final, Friday of week five
    WHEN p_round = 15 THEN 31                    -- the playoff semis, Thursday
    WHEN p_round = 14 THEN 29                    -- and the last two league rounds come
    WHEN p_round = 13 THEN 28                    -- back after the Colts Week
    WHEN p_round BETWEEN 1 AND 12
      THEN ((p_round - 1) / 4) * 7 + (ARRAY[0, 1, 3, 4])[((p_round - 1) % 4) + 1]
  END
$$;

-- THE REST DAYS: the eleven days a season on which the world stages no club
-- cricket at all. clock.mjs derives this list with isRestDay(); here it is
-- written out, and world.test.mjs holds the two to the same eleven days.
CREATE OR REPLACE FUNCTION world_rest_days()
RETURNS int[] LANGUAGE sql IMMUTABLE AS $$ SELECT ARRAY[2,5,9,12,16,19,23,26,27,30,33] $$;

-- the day-in-season a country is living through right now
CREATE OR REPLACE FUNCTION world_di(p_country text)
RETURNS int LANGUAGE sql STABLE SET search_path = world, public AS $$
  SELECT world_day() - s.start_day
    FROM seasons s
   WHERE s.country_id = p_country AND s.start_day <= world_day()
   ORDER BY s.start_day DESC LIMIT 1
$$;

-- ---------------------------------------------------------------------------
-- WHAT THE ACADEMY COSTS. The same numbers as economy.mjs, and the tests hold
-- the two to each other - a manager must never be quoted one price by the
-- button and charged another by the books.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION academy_build_cost(p_from int, p_to int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum((ARRAY[400000, 900000, 1800000, 3200000])[lv]), 0)::bigint
    FROM generate_series(greatest(1, p_from), least(5, p_to) - 1) lv
$$;
CREATE OR REPLACE FUNCTION academy_scout_fee(p_home text, p_nation text)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN p_home = p_nation THEN 0 ELSE 45000 END $$;
CREATE OR REPLACE FUNCTION academy_promote_fee()
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT 250000::bigint $$;
-- fifteen boys is the Colts Cup bar, and so also the floor the umpire keeps
-- an unmanaged club stocked to
CREATE OR REPLACE FUNCTION academy_floor()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 15 $$;

-- ---------------------------------------------------------------------------
-- A CORRECTION TO THE TREASURY. clubs.bank has always been a nullable cache of
-- a figure the finance walk derives, and it is NULL until the first settle.
-- Every affordability check ever written against it reads `IF club.bank < cost`
-- - and in SQL, NULL < 250000 is NULL, not true, so the guard falls through and
-- `bank = bank - cost` writes NULL back. A club that had never settled could
-- buy anything it liked for nothing.
--
-- The cache is now given the value a founded club actually holds, and no row is
-- left NULL. The walk still owns the real number; this only stops the guards
-- reasoning about an absence.
ALTER TABLE clubs ALTER COLUMN bank SET DEFAULT 2500000;
UPDATE clubs SET bank = 2500000 - coalesce(academy_paid, 0) - coalesce(seats_paid, 0)
 WHERE bank IS NULL;

-- ---------------------------------------------------------------------------
-- THE TABLES
-- ---------------------------------------------------------------------------
-- what the umpire has laid out: one boy per club per rest day per nation.
-- Never served to anybody until a trip has been paid for.
CREATE TABLE IF NOT EXISTS academy_candidates (
  country_id text NOT NULL,
  slot       int  NOT NULL,
  world_day  int  NOT NULL,
  nation     text NOT NULL,
  tier       text NOT NULL,
  recruit    jsonb NOT NULL,
  PRIMARY KEY (country_id, slot, world_day, nation)
);
-- and the trips actually made: one row a rest day, which is what enforces
-- "once every rest day" without a counter anybody could get wrong
CREATE TABLE IF NOT EXISTS academy_scouts (
  country_id text NOT NULL,
  slot       int  NOT NULL,
  world_day  int  NOT NULL,
  nation     text NOT NULL,
  tier       text NOT NULL,
  fee        bigint NOT NULL DEFAULT 0,
  recruit    jsonb NOT NULL,
  decision   text,                              -- null while he waits on an answer
  at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, slot, world_day)
);
-- money the academy consumed on a given day, so the statement can print it as
-- a dated line rather than a lump. Building stays on clubs.academy_paid: that
-- is capital the club still owns, and it is subtracted once at the founding.
CREATE TABLE IF NOT EXISTS academy_spend (
  id         bigserial PRIMARY KEY,
  country_id text NOT NULL,
  slot       int  NOT NULL,
  world_day  int  NOT NULL,
  kind       text NOT NULL,
  label      text NOT NULL,
  amount     bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS academy_spend_club ON academy_spend (country_id, slot, world_day);

-- ---------------------------------------------------------------------------
-- THE SCOUTING TRIP
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_scout(p_nation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE
  u uuid; c record; club record; d int; di int; cand record; fee bigint; nat text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;

  nat := coalesce(nullif(trim(p_nation), ''), c.country_id);
  IF NOT EXISTS (SELECT 1 FROM countries WHERE id = nat) THEN
    RAISE EXCEPTION 'no such cricketing nation';
  END IF;

  d := world_day();
  di := world_di(c.country_id);
  IF di IS NULL OR NOT (di = ANY(world_rest_days())) THEN
    RAISE EXCEPTION 'the scout travels on rest days. There is cricket on today.';
  END IF;
  IF EXISTS (SELECT 1 FROM academy_scouts s
              WHERE s.country_id = c.country_id AND s.slot = c.slot AND s.world_day = d) THEN
    RAISE EXCEPTION 'one trip a rest day, and this one is already made';
  END IF;

  SELECT * INTO cand FROM academy_candidates
   WHERE country_id = c.country_id AND slot = c.slot AND world_day = d AND nation = nat;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the scout has not reached that country yet - try again shortly';
  END IF;

  fee := academy_scout_fee(c.country_id, nat);
  IF fee > 0 AND coalesce(club.bank, 0) < 0 THEN
    RAISE EXCEPTION 'a club in the red sends no scouts abroad - get level first';
  END IF;
  IF fee > 0 AND coalesce(club.bank, 0) < fee THEN
    RAISE EXCEPTION 'that trip costs %, and the treasury holds %', fee, club.bank;
  END IF;

  INSERT INTO academy_scouts(country_id, slot, world_day, nation, tier, fee, recruit)
       VALUES (c.country_id, c.slot, d, nat, cand.tier, fee, cand.recruit);
  IF fee > 0 THEN
    INSERT INTO academy_spend(country_id, slot, world_day, kind, label, amount)
         VALUES (c.country_id, c.slot, d, 'scouting',
                 'Scouting trip · ' || (SELECT name FROM countries WHERE id = nat), -fee);
    UPDATE clubs SET bank = coalesce(bank, 0) - fee WHERE country_id = c.country_id AND slot = c.slot;
  END IF;

  RETURN jsonb_build_object('ok', true, 'nation', nat, 'fee', fee,
                            'recruit', cand.recruit, 'day', d);
END $$;

-- SIGN HIM, OR LET HIM GO. The boy on the table is the one the last trip
-- found and nobody has answered for yet.
CREATE OR REPLACE FUNCTION public.world_recruit(p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; s record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_action NOT IN ('sign', 'release') THEN RAISE EXCEPTION 'sign him or release him'; END IF;

  SELECT * INTO s FROM academy_scouts
   WHERE country_id = c.country_id AND slot = c.slot AND decision IS NULL
   ORDER BY world_day DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'there is nobody waiting on an answer'; END IF;

  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_action = 'sign' THEN
    -- a name already on the books is never doubled
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(club.youth, '[]'::jsonb)) y
                WHERE y->>'name' = s.recruit->>'name')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(club.squad, '[]'::jsonb)) p
                WHERE p->>'name' = s.recruit->>'name') THEN
      RAISE EXCEPTION 'there is already a % at this club', s.recruit->>'name';
    END IF;
    UPDATE clubs SET youth = coalesce(youth, '[]'::jsonb) || jsonb_build_array(s.recruit)
      WHERE country_id = c.country_id AND slot = c.slot;
  END IF;
  UPDATE academy_scouts SET decision = p_action
    WHERE country_id = c.country_id AND slot = c.slot AND world_day = s.world_day;

  RETURN jsonb_build_object('ok', true, 'action', p_action, 'name', s.recruit->>'name');
END $$;

-- ---------------------------------------------------------------------------
-- A SENIOR SHIRT, AND LETTING A BOY GO
--
-- 018's world_colt promoted for nothing, because the umpire was going to
-- promote him at twenty-one anyway and the button only brought it forward.
-- Nothing is promoted automatically now, so the shirt carries its own flat
-- price - the same for every boy in the world, whatever he has become.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_colt(p_name text, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; colt jsonb; rest jsonb; s_no int; r_no int; fee bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_action NOT IN ('promote', 'release') THEN RAISE EXCEPTION 'promote or release'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT y INTO colt FROM jsonb_array_elements(club.youth) y WHERE y->>'name' = p_name LIMIT 1;
  IF colt IS NULL THEN RAISE EXCEPTION 'no boy of that name'; END IF;
  SELECT coalesce(jsonb_agg(y), '[]'::jsonb) INTO rest
    FROM jsonb_array_elements(club.youth) y WHERE y->>'name' <> p_name;

  IF p_action = 'promote' THEN
    IF jsonb_array_length(club.squad) >= 20 THEN RAISE EXCEPTION 'the senior squad is full at twenty'; END IF;
    fee := academy_promote_fee();
    IF coalesce(club.bank, 0) < 0 THEN
      RAISE EXCEPTION 'a club in the red signs nobody - get level first';
    END IF;
    IF coalesce(club.bank, 0) < fee THEN
      RAISE EXCEPTION 'a senior contract costs %, and the treasury holds %', fee, coalesce(club.bank, 0);
    END IF;
    -- he stops being a colt the moment he is handed a senior shirt, and the
    -- round he first wore it is remembered, so the nets he was never at are
    -- never worked into him
    SELECT coalesce(max(season_no), 1) INTO s_no FROM seasons WHERE country_id = c.country_id;
    SELECT coalesce(max(round), 0) + 1 INTO r_no FROM training_rounds
      WHERE country_id = c.country_id AND slot = c.slot AND season_no = s_no;
    UPDATE clubs SET youth = rest,
                     bank = coalesce(bank, 0) - fee,
                     squad = club.squad || jsonb_build_array(
                       ((colt - 'colt') - 'promise')
                       || jsonb_build_object('joined', jsonb_build_object('s', s_no, 'r', r_no)))
      WHERE country_id = c.country_id AND slot = c.slot;
    INSERT INTO academy_spend(country_id, slot, world_day, kind, label, amount)
         VALUES (c.country_id, c.slot, world_day(), 'contract',
                 'Senior contract · ' || p_name, -fee);
  ELSE
    UPDATE clubs SET youth = rest WHERE country_id = c.country_id AND slot = c.slot;
  END IF;
  RETURN jsonb_build_object('ok', true, 'action', p_action, 'name', p_name,
                            'fee', CASE WHEN p_action = 'promote' THEN academy_promote_fee() ELSE 0 END);
END $$;

-- ---------------------------------------------------------------------------
-- BUILDING. Five levels, bought outright, and the steps get steeper.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_set_academy(p_level int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; cost bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_level IS NULL OR p_level < 1 OR p_level > 5 THEN RAISE EXCEPTION 'an academy runs from 1 to 5'; END IF;
  IF p_level <= club.academy THEN RAISE EXCEPTION 'an academy is never sold back'; END IF;
  -- 021's floor still holds: a club under water builds nothing, and is told so
  -- in English rather than having a negative treasury quoted back at it
  IF coalesce(club.bank, 0) < 0 THEN RAISE EXCEPTION 'a club in the red builds nothing - get level first'; END IF;
  cost := academy_build_cost(club.academy, p_level);
  IF coalesce(club.bank, 0) < cost THEN
    RAISE EXCEPTION 'that costs %, and the treasury holds %', cost, coalesce(club.bank, 0);
  END IF;
  UPDATE clubs SET academy = p_level, academy_paid = academy_paid + cost, bank = coalesce(bank, 0) - cost
    WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'academy', p_level, 'cost', cost);
END $$;

-- ---------------------------------------------------------------------------
-- THE ACADEMY, AS ITS OWN MANAGER SEES IT. Everything the page needs in one
-- call: the level and what the next one costs, the boys and which of them are
-- about to walk, whether the scout may travel today and what a trip costs
-- where, and the boy still waiting on an answer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_my_academy()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; d int; di int; pend jsonb; nats jsonb; used boolean;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  d := world_day();
  di := world_di(c.country_id);

  SELECT to_jsonb(s) - 'recruit' || jsonb_build_object('recruit', s.recruit) INTO pend
    FROM academy_scouts s
   WHERE s.country_id = c.country_id AND s.slot = c.slot AND s.decision IS NULL
   ORDER BY s.world_day DESC LIMIT 1;

  used := EXISTS (SELECT 1 FROM academy_scouts s
                   WHERE s.country_id = c.country_id AND s.slot = c.slot AND s.world_day = d);

  SELECT jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name,
                                      'fee', academy_scout_fee(c.country_id, n.id))
                   ORDER BY n.name)
    INTO nats FROM countries n;

  RETURN jsonb_build_object(
    'signedIn', true,
    'country', c.country_id, 'slot', c.slot, 'club', club.name,
    'level', club.academy,
    'upkeep', (ARRAY[6000, 14000, 26000, 44000, 70000])[club.academy],
    'nextLevel', CASE WHEN club.academy < 5 THEN club.academy + 1 END,
    'nextCost', CASE WHEN club.academy < 5 THEN academy_build_cost(club.academy, club.academy + 1) END,
    'nextUpkeep', CASE WHEN club.academy < 5 THEN (ARRAY[6000, 14000, 26000, 44000, 70000])[club.academy + 1] END,
    'built', club.academy_paid,
    'youth', coalesce(club.youth, '[]'::jsonb),
    'floor', academy_floor(),
    'promoteFee', academy_promote_fee(),
    'squadSize', jsonb_array_length(coalesce(club.squad, '[]'::jsonb)),
    'day', d, 'di', di,
    'restDay', (di IS NOT NULL AND di = ANY(world_rest_days())),
    'restDays', to_jsonb(world_rest_days()),
    'scoutedToday', used,
    'pending', pend,
    'nations', coalesce(nats, '[]'::jsonb),
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_scout(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_recruit(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_colt(text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_set_academy(int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_academy() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
