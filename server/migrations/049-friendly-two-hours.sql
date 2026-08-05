-- 049-friendly-two-hours.sql — A CHALLENGE LEAVES ROOM FOR THE RITUAL.
--
-- The umpire banks a friendly AT THE TEAMSHEET LOCK, an hour before play
-- (048): from that moment the inputs are frozen and the match exists. A
-- challenge placed 90 minutes out therefore left a lineup window of half
-- an hour, and one placed cleverly left none at all. Two hours is the
-- floor now - an honest hour to name a side, then the hour under lock.
-- A time in the past was never legal and still is not: anything before
-- now fails the same check harder.

CREATE OR REPLACE FUNCTION public.world_friendly_challenge(p_country text, p_slot int, p_play_at_ms bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; me record; my_club record; tgt record; tgt_claim record; st text; fid bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO me FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_play_at_ms IS NULL OR p_play_at_ms < now_ms() + 2 * 3600000 THEN
    RAISE EXCEPTION 'pick a time at least two hours from now - teamsheets lock an hour before the match, and the lineup window must be real';
  END IF;
  IF p_play_at_ms > now_ms() + 7 * 86400000 THEN
    RAISE EXCEPTION 'pick a time within the next seven days';
  END IF;
  SELECT * INTO my_club FROM clubs WHERE country_id = me.country_id AND slot = me.slot;
  SELECT * INTO tgt FROM clubs WHERE country_id = p_country AND slot = p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such club'; END IF;
  IF tgt.country_id = me.country_id AND tgt.slot = me.slot THEN
    RAISE EXCEPTION 'you cannot challenge your own club';
  END IF;
  IF (SELECT count(*) FROM friendlies WHERE challenger = u AND status IN ('offered','accepted')) >= 5 THEN
    RAISE EXCEPTION 'five open friendlies already - let some play out first';
  END IF;
  SELECT * INTO tgt_claim FROM claims WHERE country_id = p_country AND slot = p_slot;
  st := CASE WHEN tgt_claim.user_id IS NULL THEN 'accepted' ELSE 'offered' END;
  INSERT INTO friendlies(challenger, opponent, c_country, c_slot, c_name, o_country, o_slot, o_name, status, play_at_ms)
    VALUES (u, tgt_claim.user_id, me.country_id, me.slot, my_club.name, p_country, p_slot, tgt.name, st, p_play_at_ms)
    RETURNING id INTO fid;
  RETURN jsonb_build_object('ok', true, 'id', fid, 'status', st, 'playAtMs', p_play_at_ms,
    'home', my_club.name, 'away', tgt.name, 'humanOpponent', tgt_claim.user_id IS NOT NULL);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_challenge(text, int, bigint) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
