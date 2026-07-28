-- 022-invitationals.sql — COMPETITIONS MANAGERS MAKE THEMSELVES
--
-- The world already had one-off friendly challenges. What it did not have was
-- ORGANISED cricket outside the leagues: a manager founding a competition,
-- naming it, choosing whether it is a cup or a round robin, and other
-- managers joining it.
--
-- The constraint is the same as everything else here. Half this world is
-- asleep when the other half is playing, so an Invitational must not need
-- anybody awake once it starts: when enrolment closes the umpire fills any
-- empty seats with bot clubs, plays a round a day on the real engine from the
-- squads as they stand, and crowns a champion. Nothing to submit, nothing to
-- miss, and a competition that only half filled still gets played.
--
-- Stored here: the DECISIONS (who founded what, and who joined). The draw,
-- the results and the table are the umpire's, derived and idempotent.

CREATE TABLE IF NOT EXISTS comps (
  id             bigserial PRIMARY KEY,
  name           text NOT NULL,
  format         text NOT NULL CHECK (format IN ('cup', 'league')),
  size           int  NOT NULL CHECK (size IN (4, 8)),
  founder        uuid NOT NULL,
  status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'running', 'done')),
  open_until_day int  NOT NULL,               -- world day enrolment closes
  start_day      int,                         -- world day round 1 is played
  rounds         int,                         -- how many there will be
  champion       text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS comp_clubs (
  comp_id    bigint NOT NULL REFERENCES comps(id) ON DELETE CASCADE,
  seat       int  NOT NULL,
  country_id text NOT NULL,
  slot       int  NOT NULL,
  name       text NOT NULL,
  user_id    uuid,                            -- NULL: a bot club made the numbers up
  PRIMARY KEY (comp_id, seat),
  UNIQUE (comp_id, country_id, slot)
);
CREATE TABLE IF NOT EXISTS comp_matches (
  id             text PRIMARY KEY,            -- 'comp:12:r2:g1' — the seed derives from this
  comp_id        bigint NOT NULL REFERENCES comps(id) ON DELETE CASCADE,
  round          int  NOT NULL,
  gi             int  NOT NULL,
  a_seat         int  NOT NULL,
  b_seat         int  NOT NULL,
  a_name         text NOT NULL,
  b_name         text NOT NULL,
  seed           bigint NOT NULL,
  engine_version text NOT NULL,
  result         jsonb NOT NULL,
  result_canonical text NOT NULL,
  played_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comp_id, round, gi)
);
CREATE INDEX IF NOT EXISTS comps_status ON comps (status, open_until_day);
CREATE INDEX IF NOT EXISTS comp_matches_comp ON comp_matches (comp_id, round);

-- the world day, on the same pinnable clock everything else here reads. The
-- epoch is 28 July 2026 = day 0, which is server/clock.mjs's EPOCH.
CREATE OR REPLACE FUNCTION world_day()
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT floor((now_ms() - 1785196800000::bigint) / 86400000.0)::int
$$;

-- ---------------------------------------------------------------------------
-- FOUNDING ONE. A manager names it, picks the shape, and takes the first
-- seat. Enrolment stays open for three world days; whoever is in when it
-- closes is in, and the umpire makes the numbers up.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_comp_found(p_name text, p_format text, p_size int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; nm text; today int; cid bigint; n_open int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  nm := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  IF length(nm) < 3 THEN RAISE EXCEPTION 'give it a name of three letters or more'; END IF;
  IF length(nm) > 40 THEN RAISE EXCEPTION 'a name is 40 characters at most'; END IF;
  IF nm !~ '^[A-Za-z0-9][A-Za-z0-9 ''\.\-&]*$' THEN
    RAISE EXCEPTION 'letters, numbers, spaces, apostrophes, dots, hyphens and ampersands only';
  END IF;
  IF p_format NOT IN ('cup', 'league') THEN RAISE EXCEPTION 'a cup or a round robin'; END IF;
  IF p_size NOT IN (4, 8) THEN RAISE EXCEPTION 'four clubs or eight'; END IF;
  SELECT count(*) INTO n_open FROM comps WHERE founder = u AND status <> 'done';
  IF n_open >= 2 THEN RAISE EXCEPTION 'run the two you have before founding another'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  today := (world_day())::int;
  INSERT INTO comps(name, format, size, founder, open_until_day)
    VALUES (nm, p_format, p_size, u, today + 3) RETURNING id INTO cid;
  INSERT INTO comp_clubs(comp_id, seat, country_id, slot, name, user_id)
    VALUES (cid, 0, c.country_id, c.slot, club.name, u);
  RETURN jsonb_build_object('ok', true, 'id', cid, 'name', nm, 'opensUntil', today + 3);
END $$;

-- JOINING ONE. One seat a club, first come first served, while it is open.
CREATE OR REPLACE FUNCTION public.world_comp_join(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; cp record; taken int; nxt int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO cp FROM comps WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such competition'; END IF;
  IF cp.status <> 'open' THEN RAISE EXCEPTION 'that one has already started'; END IF;
  IF EXISTS (SELECT 1 FROM comp_clubs WHERE comp_id = p_id AND country_id = c.country_id AND slot = c.slot)
    THEN RAISE EXCEPTION 'your club is already in it'; END IF;
  SELECT count(*) INTO taken FROM comp_clubs WHERE comp_id = p_id;
  IF taken >= cp.size THEN RAISE EXCEPTION 'it is full'; END IF;
  SELECT coalesce(max(seat), -1) + 1 INTO nxt FROM comp_clubs WHERE comp_id = p_id;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  INSERT INTO comp_clubs(comp_id, seat, country_id, slot, name, user_id)
    VALUES (p_id, nxt, c.country_id, c.slot, club.name, u);
  RETURN jsonb_build_object('ok', true, 'id', p_id, 'seat', nxt);
END $$;

-- LEAVING ONE, while it is still open. The founder leaving folds it.
CREATE OR REPLACE FUNCTION public.world_comp_leave(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; cp record;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO cp FROM comps WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such competition'; END IF;
  IF cp.status <> 'open' THEN RAISE EXCEPTION 'it has started - you play it out'; END IF;
  IF cp.founder = u THEN DELETE FROM comps WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'folded', true); END IF;
  DELETE FROM comp_clubs WHERE comp_id = p_id AND user_id = u;
  RETURN jsonb_build_object('ok', true, 'folded', false);
END $$;

-- what the whole world may read: the competitions and who is in them
DROP VIEW IF EXISTS public.world_comps;
CREATE VIEW public.world_comps AS
  SELECT cp.id, cp.name, cp.format, cp.size, cp.status, cp.open_until_day, cp.start_day,
         cp.rounds, cp.champion, cp.created_at,
         (SELECT count(*) FROM comp_clubs cc WHERE cc.comp_id = cp.id) AS entered,
         (SELECT count(*) FROM comp_clubs cc WHERE cc.comp_id = cp.id AND cc.user_id IS NOT NULL) AS managed
    FROM comps cp;
DROP VIEW IF EXISTS public.world_comp_clubs;
CREATE VIEW public.world_comp_clubs AS
  SELECT comp_id, seat, country_id, slot, name, (user_id IS NOT NULL) AS managed FROM comp_clubs;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_comp_found(text, text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_comp_join(bigint) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_comp_leave(bigint) TO authenticated;
    GRANT SELECT ON public.world_comps, public.world_comp_clubs TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_comps, public.world_comp_clubs TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
