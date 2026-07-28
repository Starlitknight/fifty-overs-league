-- 021-debt-cap.sql — THE FLOOR
--
-- A club may not sink further than the money it was founded with. Reaching
-- that floor is ADMINISTRATION: the losses below the line are written off,
-- because there is no deeper hole to dig, but the sponsor halves his cheque
-- while the club is under and nothing gets built. The arithmetic is the
-- umpire's (server/economy.mjs); what belongs here is the write surface
-- refusing to spend money a club has not got - and saying so in English
-- rather than quoting a negative treasury back at the manager.

CREATE OR REPLACE FUNCTION public.world_set_academy(p_level int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; cost bigint := 0; lv int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_level IS NULL OR p_level < 1 OR p_level > 5 THEN RAISE EXCEPTION 'an academy runs from 1 to 5'; END IF;
  IF p_level <= club.academy THEN RAISE EXCEPTION 'an academy is never sold back'; END IF;
  IF club.bank < 0 THEN RAISE EXCEPTION 'a club in the red builds nothing - get level first'; END IF;
  FOR lv IN club.academy..(p_level - 1) LOOP cost := cost + lv * 60000; END LOOP;
  IF club.bank < cost THEN
    RAISE EXCEPTION 'that costs %, and the treasury holds %', cost, club.bank;
  END IF;
  UPDATE clubs SET academy = p_level, academy_paid = academy_paid + cost, bank = bank - cost
    WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'academy', p_level, 'cost', cost);
END $$;

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
  IF club.bank < 0 THEN RAISE EXCEPTION 'a club in the red builds nothing - get level first'; END IF;
  cost := public.world_seat_cost(club.seats, p_seats);
  IF club.bank < cost THEN
    RAISE EXCEPTION 'that costs %, and the treasury holds %', cost, club.bank;
  END IF;
  UPDATE clubs SET seats = p_seats, seats_paid = seats_paid + cost, bank = bank - cost
    WHERE country_id = c.country_id AND slot = c.slot;
  RETURN jsonb_build_object('ok', true, 'seats', p_seats, 'cost', cost);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_set_academy(int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_set_stadium(int) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
