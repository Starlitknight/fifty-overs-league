-- 010-friendly-scheduling.sql — FRIENDLIES ON THE CHALLENGER'S CLOCK.
-- The challenger names the date and hour. Both managers may set a lineup
-- for the friendly itself (falling back to their latest league orders, then
-- the engine's pick) and may tweak it until ONE HOUR before the chosen
-- time, when it locks - the same teamsheet law the leagues live by. An
-- offer nobody answered expires an hour before the match: unaccepted means
-- never played. Challenges must be placed at least 90 minutes out (so the
-- lineup window is real) and at most 7 days ahead.

ALTER TABLE friendlies ADD COLUMN IF NOT EXISTS c_orders jsonb;
ALTER TABLE friendlies ADD COLUMN IF NOT EXISTS o_orders jsonb;

DROP FUNCTION IF EXISTS public.world_friendly_challenge(text, int);
CREATE OR REPLACE FUNCTION public.world_friendly_challenge(p_country text, p_slot int, p_play_at_ms bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; me record; my_club record; tgt record; tgt_claim record; st text; fid bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO me FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_play_at_ms IS NULL OR p_play_at_ms < now_ms() + 90 * 60000 THEN
    RAISE EXCEPTION 'pick a time at least 90 minutes from now - lineups need their window';
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

CREATE OR REPLACE FUNCTION public.world_friendly_respond(p_id bigint, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; f record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF f.opponent IS DISTINCT FROM u THEN RAISE EXCEPTION 'this challenge is not yours to answer'; END IF;
  IF f.status = 'offered' AND now_ms() >= f.play_at_ms - 3600000 THEN
    UPDATE friendlies SET status = 'expired' WHERE id = p_id;
    RAISE EXCEPTION 'too late - the offer expired an hour before the match';
  END IF;
  IF f.status <> 'offered' THEN RAISE EXCEPTION 'this challenge is already %', f.status; END IF;
  IF p_accept THEN
    UPDATE friendlies SET status = 'accepted' WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'playAtMs', f.play_at_ms);
  ELSE
    UPDATE friendlies SET status = 'declined' WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;
END $$;

-- your lineup for this friendly, tweakable until an hour before play
CREATE OR REPLACE FUNCTION public.world_friendly_orders(p_id bigint, p_orders jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; f record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF p_orders IS NULL OR pg_column_size(p_orders) > 30000 THEN RAISE EXCEPTION 'orders too large'; END IF;
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF u IS DISTINCT FROM f.challenger AND u IS DISTINCT FROM f.opponent THEN
    RAISE EXCEPTION 'this friendly is not yours';
  END IF;
  IF f.status NOT IN ('offered','accepted') THEN RAISE EXCEPTION 'this friendly is already %', f.status; END IF;
  IF now_ms() >= f.play_at_ms - 3600000 THEN
    RAISE EXCEPTION 'teamsheets are in - lineups lock an hour before the match';
  END IF;
  IF u = f.challenger THEN UPDATE friendlies SET c_orders = p_orders WHERE id = p_id;
  ELSE UPDATE friendlies SET o_orders = p_orders WHERE id = p_id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', p_id);
END $$;

CREATE OR REPLACE FUNCTION public.world_my_friendlies()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; o jsonb;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN '[]'::jsonb; END IF;
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'id')::bigint DESC), '[]'::jsonb) INTO o FROM (
    SELECT jsonb_build_object(
      'id', f.id, 'status', f.status, 'playAtMs', f.play_at_ms,
      'home', f.c_name, 'away', f.o_name,
      'mine', f.challenger = u, 'incoming', f.opponent = u AND f.status = 'offered',
      'myOrders', CASE WHEN f.challenger = u THEN f.c_orders IS NOT NULL ELSE f.o_orders IS NOT NULL END,
      'text', f.result->>'text') AS row
      FROM friendlies f
     WHERE f.challenger = u OR f.opponent = u
     ORDER BY f.id DESC LIMIT 20) q;
  RETURN o;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_challenge(text, int, bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_friendly_respond(bigint, boolean) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_friendly_orders(bigint, jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_friendlies() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
