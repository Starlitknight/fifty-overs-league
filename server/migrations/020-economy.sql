-- 020-economy.sql — THE BOOKS
--
-- The treasury stops being four flat numbers and becomes a ledger the umpire
-- walks from the founding: a crowd that grows on winning, a mood that reads
-- the last five results and the table, a gate split two thirds to the home
-- club and one third to the visitors, a sponsor who checks the standings
-- before he signs, wages and academy upkeep by the round, and interest on an
-- overdraft. All of it derived (server/economy.mjs); the only things stored
-- here are the DECISIONS - how big a ground a manager paid for, and what it
-- cost him - plus the settled figures, so a phone can read the books in one
-- request instead of re-deriving them.

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS seats int NOT NULL DEFAULT 15000;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS seats_paid bigint NOT NULL DEFAULT 0;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS finance jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clubs_seats_range') THEN
    ALTER TABLE clubs ADD CONSTRAINT clubs_seats_range CHECK (seats BETWEEN 15000 AND 45000) NOT VALID;
  END IF;
END $$;

-- WHAT THE NEXT THOUSAND SEATS COST, in the server's own arithmetic, mirrored
-- here so the write surface can charge without asking a client what to charge.
-- The tests hold the two to the same answer.
CREATE OR REPLACE FUNCTION public.world_seat_cost(p_from int, p_to int)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path = world, public AS $$
DECLARE s int; cost bigint := 0; blk int;
BEGIN
  s := p_from;
  WHILE s < p_to LOOP
    blk := greatest(0, (s - 15000) / 1000);
    cost := cost + 1000 * (260 + blk * 30);
    s := s + 1000;
  END LOOP;
  RETURN cost;
END $$;

-- BUILDING THE GROUND. Seats come by the thousand, they are never sold back,
-- and the treasury has to hold the money on the day - no borrowing to build.
CREATE OR REPLACE FUNCTION public.world_set_stadium(p_seats int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; cost bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_seats IS NULL OR p_seats % 1000 <> 0 THEN RAISE EXCEPTION 'seats are built a thousand at a time'; END IF;
  IF p_seats > 45000 THEN RAISE EXCEPTION 'forty-five thousand is as big as a ground gets'; END IF;
  IF p_seats <= club.seats THEN RAISE EXCEPTION 'a stand is never taken down again'; END IF;
  cost := public.world_seat_cost(club.seats, p_seats);
  IF club.bank < cost THEN
    RAISE EXCEPTION 'that costs %, and the treasury holds %', cost, club.bank;
  END IF;
  UPDATE clubs SET seats = p_seats, seats_paid = seats_paid + cost, bank = bank - cost
    WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'seats', p_seats, 'cost', cost);
END $$;

-- your own status carries the books
CREATE OR REPLACE FUNCTION public.world_my_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  SELECT jsonb_agg(jsonb_build_object('round', round, 'at', submitted_at) ORDER BY round)
    INTO o FROM orders WHERE user_id = u AND country_id = c.country_id;
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
    'bank', club.bank);
END $$;

-- a ground is a building, and buildings are visible
DROP VIEW IF EXISTS public.world_clubs;
CREATE VIEW public.world_clubs AS
  SELECT cl.country_id, cl.slot, cl.name, cl.ground, cl.is_boss, cl.identity, cl.academy, cl.seats,
         c.display_name AS manager
    FROM clubs cl
    LEFT JOIN claims c ON c.country_id = cl.country_id AND c.slot = cl.slot;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_stadium(int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_status() TO authenticated;
    GRANT SELECT ON public.world_clubs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_seat_cost(int, int) TO anon;
    GRANT SELECT ON public.world_clubs TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
