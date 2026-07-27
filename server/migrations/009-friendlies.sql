-- 009-friendlies.sql — FRIENDLIES: manager v manager, one match, no stakes.
-- Not competitions - just cricket. A manager who holds a club may challenge
-- any other club in the world. A human-held club's manager accepts or
-- declines from their club page; a bot club accepts on the spot. Accepted
-- friendlies play at the next top of the hour (at least 15 minutes out) on
-- the real engine with both clubs' real squads and each manager's latest
-- orders, banked by the umpire like everything else. Offers expire after
-- 48 hours. League tables, rankings and honours never see these matches.

CREATE TABLE friendlies (
  id          bigserial PRIMARY KEY,
  challenger  uuid NOT NULL,
  opponent    uuid,                          -- NULL when the challenged club is a bot
  c_country   text NOT NULL,
  c_slot      int  NOT NULL,
  c_name      text NOT NULL,
  o_country   text NOT NULL,
  o_slot      int  NOT NULL,
  o_name      text NOT NULL,
  status      text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered','accepted','declined','played','expired')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  play_at_ms  bigint,                        -- world-clock ms; set on acceptance
  result      jsonb,
  engine_version text
);
CREATE INDEX friendlies_due ON friendlies (status, play_at_ms);
CREATE INDEX friendlies_user ON friendlies (challenger, opponent);

-- the next top of the hour at least 15 minutes away, on the pinnable clock
CREATE OR REPLACE FUNCTION friendly_play_ms()
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT ((now_ms() + 15 * 60000) / 3600000 + 1) * 3600000
$$;

CREATE OR REPLACE FUNCTION public.world_friendly_challenge(p_country text, p_slot int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; me record; my_club record; tgt record; tgt_claim record; st text; pm bigint; fid bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO me FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
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
  IF FOUND THEN
    st := 'offered'; pm := NULL;                -- a human decides for themselves
  ELSE
    st := 'accepted'; pm := friendly_play_ms(); -- a bot never refuses a game
  END IF;
  INSERT INTO friendlies(challenger, opponent, c_country, c_slot, c_name, o_country, o_slot, o_name, status, play_at_ms)
    VALUES (u, tgt_claim.user_id, me.country_id, me.slot, my_club.name, p_country, p_slot, tgt.name, st, pm)
    RETURNING id INTO fid;
  RETURN jsonb_build_object('ok', true, 'id', fid, 'status', st, 'playAtMs', pm,
    'home', my_club.name, 'away', tgt.name, 'humanOpponent', tgt_claim.user_id IS NOT NULL);
END $$;

CREATE OR REPLACE FUNCTION public.world_friendly_respond(p_id bigint, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; f record; pm bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO f FROM friendlies WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such friendly'; END IF;
  IF f.opponent IS DISTINCT FROM u THEN RAISE EXCEPTION 'this challenge is not yours to answer'; END IF;
  IF f.status <> 'offered' THEN RAISE EXCEPTION 'this challenge is already %', f.status; END IF;
  IF p_accept THEN
    pm := friendly_play_ms();
    UPDATE friendlies SET status = 'accepted', play_at_ms = pm WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'playAtMs', pm);
  ELSE
    UPDATE friendlies SET status = 'declined' WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;
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
      'text', f.result->>'text') AS row
      FROM friendlies f
     WHERE f.challenger = u OR f.opponent = u
     ORDER BY f.id DESC LIMIT 20) q;
  RETURN o;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_friendly_challenge(text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_friendly_respond(bigint, boolean) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_friendlies() TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
