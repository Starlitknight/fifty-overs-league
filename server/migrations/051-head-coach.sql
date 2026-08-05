-- 051-head-coach.sql — THE HEAD COACH, AND MATCH-DAY NETS.
--
-- The training model the classics run (From the Pavilion, Battrick) has two
-- levers this world lacked: a COACH you hire, whose quality multiplies what
-- every session is worth, and the match-day rule - the eleven who played
-- bank the full session, the men left out train at half pace. The coach
-- lives here; the match-day rule lives in the banked record (training_rounds
-- gains an xi column the umpire fills from the day's teamsheets, null for
-- every round already banked so history is never re-rated).
--
-- server/economy.mjs mirrors these prices for the books, and the tests hold
-- the two to the same numbers - the button and the ledger can never disagree.

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS coach int NOT NULL DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS coach_paid bigint NOT NULL DEFAULT 0;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS coach int;
ALTER TABLE training_rounds ADD COLUMN IF NOT EXISTS xi jsonb;

-- what the step from level n-1 to n costs, and what a level costs a round
CREATE OR REPLACE FUNCTION coach_step_cost(p_lv int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY[120000, 260000, 450000, 700000, 1000000])[p_lv]::bigint $$;

CREATE OR REPLACE FUNCTION coach_hire_cost(p_from int, p_to int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(coach_step_cost(lv)), 0)::bigint
    FROM generate_series(GREATEST(0, p_from) + 1, LEAST(5, p_to)) lv $$;

CREATE OR REPLACE FUNCTION coach_upkeep(p_lv int)
RETURNS bigint LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY[0, 2000, 5000, 9000, 14000, 20000])[GREATEST(0, LEAST(5, p_lv)) + 1]::bigint $$;

-- ---------------------------------------------------------------------------
-- HIRING. Five levels, bought upward only, never sold back - the same shape
-- as the academy, priced gentler: a coach is a salary, not a building.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_set_coach(p_level int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; cost bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_level IS NULL OR p_level < 1 OR p_level > 5 THEN RAISE EXCEPTION 'a coach runs from 1 to 5'; END IF;
  IF p_level <= coalesce(club.coach, 0) THEN RAISE EXCEPTION 'a coach is never let go for a lesser one'; END IF;
  IF coalesce(club.bank, 0) < 0 THEN RAISE EXCEPTION 'a club in the red hires nobody - get level first'; END IF;
  cost := coach_hire_cost(coalesce(club.coach, 0), p_level);
  IF coalesce(club.bank, 0) < cost THEN
    RAISE EXCEPTION 'that costs %, and the treasury holds %', cost, coalesce(club.bank, 0);
  END IF;
  UPDATE clubs SET coach = p_level,
                   coach_paid = coalesce(coach_paid, 0) + cost,
                   bank = coalesce(bank, 0) - cost
    WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'coach', p_level, 'cost', cost);
END $$;

-- ---------------------------------------------------------------------------
-- world_my_status carries the coach down beside the plan (046 body + coach).
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
    'identity', club.identity,
    'academy', club.academy,
    'coach', coalesce(club.coach, 0),
    'coachNextCost', CASE WHEN coalesce(club.coach, 0) >= 5 THEN NULL
                          ELSE coach_hire_cost(coalesce(club.coach, 0), coalesce(club.coach, 0) + 1) END,
    'coachUpkeep', coach_upkeep(coalesce(club.coach, 0)),
    'youth', coalesce(club.youth, '[]'::jsonb),
    'seats', club.seats,
    'finance', coalesce(club.finance, '{}'::jsonb),
    'callups', coalesce(cu, '[]'::jsonb),
    'windows', to_jsonb(world_window_rounds()),
    'bank', club.bank);
END $$;

NOTIFY pgrst, 'reload schema';
