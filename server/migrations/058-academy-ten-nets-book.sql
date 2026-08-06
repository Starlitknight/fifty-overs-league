-- 058-academy-ten-nets-book.sql — THE ACADEMY GOES TO TEN, AND THE NETS KEEP A BOOK.
--
-- Two changes to the training ground, both of them careful about the same
-- thing: training_rounds banks the plan AND the academy level in force every
-- round, and living.mjs replays those rounds from the founding to rebuild
-- every squad. Anything that changes what a stored plan MEANS, or what a
-- stored level is WORTH, silently re-prices cricket already worked. That is
-- the trap the head coach set, and neither change here walks into it.
--
-- ---------------------------------------------------------------------------
-- ONE. THE LADDER RUNS TO TEN.
--
-- Levels one to five are untouched - same training rate, same upkeep, same
-- build price, to the pound. They have to be: clubs have stood on them, banks
-- were settled at them, and rounds were worked at them. Six to ten are ground
-- nobody has stood on, so adding them re-rates nothing. Above five the rate
-- climbs five per cent a rung (1.24x at five, 1.49x at ten), the build price
-- keeps getting steeper, and the upkeep gets steep enough to be the real
-- brake: a level ten academy costs 190,000 a round, which is more than a
-- founding club takes in a round and about a third of what a great one does.
-- You do not buy the top of this ladder. You carry it.
--
-- The same building drives the youth intake it always did - one academy, not
-- two - so the tier odds carry on up the same ladder (server/youth.mjs). A
-- recruit is a pure function of (country, slot, season, index, level) and no
-- club has ever held a level above five, so no boy who has ever walked
-- through a door is re-dealt by those rows existing.
--
-- ---------------------------------------------------------------------------
-- TWO. THE BOOK OF THE NETS.
--
-- The training page grows charts, and a chart needs a past. The obvious build
-- is a table the umpire appends to every round - which would be empty on the
-- day it shipped, and would be a SECOND record of something the first record
-- already determines.
--
-- It gets neither. living.mjs already walks every round a club has ever
-- trained, in order, from the founding; every step up any man ever took
-- passes through that walk. So the book is collected on the way past and
-- banked here as a cache: a list of steps { s, r, n, k, to } and a per-round
-- tally of which programmes were worked. It is rebuilt WHOLE every settle,
-- never appended to, so it cannot drift from the record it is derived from -
-- and it has the club's entire history in it the first time it is written.
--
-- Nothing reads it but the club's own manager, so only claimed clubs get one.
-- ---------------------------------------------------------------------------

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS nets_history jsonb;

-- ---------------------------------------------------------------------------
-- THE RANGE. 018 wrote CHECK (academy BETWEEN 1 AND 5) NOT VALID; it is
-- replaced rather than widened in place, because a CHECK cannot be altered.
-- ---------------------------------------------------------------------------
ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_academy_range;
ALTER TABLE clubs ADD CONSTRAINT clubs_academy_range CHECK (academy BETWEEN 1 AND 10) NOT VALID;

-- what it costs to go from level n to level n+1, mirroring economy.mjs
CREATE OR REPLACE FUNCTION academy_build_cost(p_from int, p_to int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum((ARRAY[400000, 900000, 1800000, 3200000,
                             3600000, 4200000, 4900000, 5700000, 6600000])[lv]), 0)::bigint
    FROM generate_series(greatest(1, p_from), least(10, p_to) - 1) lv
$$;

-- and what it costs to RUN, by the round, mirroring economy.mjs. A function
-- now rather than an array literal repeated at every call site, which is how
-- 040 and 050 came to carry the same five numbers twice each.
CREATE OR REPLACE FUNCTION academy_upkeep(p_level int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY[6000, 14000, 26000, 44000, 70000,
                90000, 112000, 136000, 162000, 190000])[greatest(1, least(10, coalesce(p_level, 2)))]::bigint
$$;

CREATE OR REPLACE FUNCTION academy_max()
RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 10 $$;

-- ---------------------------------------------------------------------------
-- BUILDING, to ten. 040's body with the ceiling raised and the upkeep read
-- from the function above.
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
  IF p_level IS NULL OR p_level < 1 OR p_level > academy_max() THEN
    RAISE EXCEPTION 'an academy runs from 1 to %', academy_max();
  END IF;
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
-- THE ACADEMY AS ITS OWN MANAGER SEES IT — 050's body, ten rungs deep.
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

  SELECT to_jsonb(s) - 'recruit'
         || jsonb_build_object('recruit', academy_report(s.recruit,
              c.country_id || '|' || c.slot || '|' || s.world_day || '|' || s.nation, club.academy))
    INTO pend
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
    'maxLevel', academy_max(),
    'upkeep', academy_upkeep(club.academy),
    'nextLevel', CASE WHEN club.academy < academy_max() THEN club.academy + 1 END,
    'nextCost', CASE WHEN club.academy < academy_max() THEN academy_build_cost(club.academy, club.academy + 1) END,
    'nextUpkeep', CASE WHEN club.academy < academy_max() THEN academy_upkeep(club.academy + 1) END,
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

-- ---------------------------------------------------------------------------
-- YOUR OWN STATUS carries the book — 056's body, one key heavier.
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
    'netsReport', club.nets_report,
    'netsHistory', club.nets_history,
    'identity', club.identity,
    'academy', club.academy,
    'academyMax', academy_max(),
    'youth', coalesce(club.youth, '[]'::jsonb),
    'seats', club.seats,
    'finance', coalesce(club.finance, '{}'::jsonb),
    'callups', coalesce(cu, '[]'::jsonb),
    'windows', to_jsonb(world_window_rounds()),
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_academy(int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_academy() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
