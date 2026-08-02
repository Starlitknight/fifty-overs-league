-- 041-colts-cup.sql — THE BOYS GET A COMPETITION THEY CAN LOSE.
--
-- The Colts Cup used to be nine round-robin fixtures played on league days by
-- the umpire, with nobody picking a side. It is now a straight knockout over
-- the four days of Colts Week (docs/ACADEMY.md, docs/PYRAMID.md): all sixteen
-- clubs of a nation in one hat, no byes, and a MANAGER NAMES THE SQUAD.
--
-- Two things follow from that, and both live here.
--
-- QUALIFICATION IS A SQUAD, NOT A SUBSCRIPTION. A club must be able to field
-- fifteen to eighteen men under twenty-one - the academy list plus any
-- under-21s on the senior staff. A club that cannot forfeits its tie, in
-- public. The bar is checked when the tie is played, against the club as it
-- stands that morning, so it is a fact about the club and not about whether
-- anyone remembered to press a button.
--
-- THE NAMED SQUAD IS AN OPTION, NOT A DUTY. A manager may name his eighteen;
-- if he does not, the umpire names the youngest men who qualify. An offline
-- club therefore still plays - it does not still WIN, because a named squad
-- is a better squad, but the constraint has always been that being offline
-- costs you edge and never costs you the fixture.
--
-- The cup banks in cup_matches like every other knockout, under comp
-- 'colts:<nation>', so it inherits immutable results, idempotent stages and
-- derived snapshots without a second mechanism to keep honest.

-- ---------------------------------------------------------------------------
-- 1. cup_matches admits the boys
-- ---------------------------------------------------------------------------
ALTER TABLE cup_matches DROP CONSTRAINT IF EXISTS cup_matches_comp_check;
ALTER TABLE cup_matches ADD CONSTRAINT cup_matches_comp_check
  CHECK (comp IN ('wcl', 'wc') OR comp LIKE 'fa:%' OR comp LIKE 'colts:%');

-- A FORFEIT IS NOT A MATCH. When a club cannot name fifteen the tie is
-- decided without a ball, and there is no scorecard to bank - but the bracket
-- still has to say who went through and why. `forfeit` names the slot that
-- could not field a side (or both, if neither could), and `result` carries
-- the same {winner, text} shape every reader already understands.
ALTER TABLE cup_matches ADD COLUMN IF NOT EXISTS forfeit jsonb;

-- ---------------------------------------------------------------------------
-- 2. the named squad
-- ---------------------------------------------------------------------------
-- One row per club per season: the names a manager wants his boys' side drawn
-- from. Names, not men - the squad is resolved against the club as it stands
-- on the morning of the tie, so a boy sold or promoted in between simply is
-- not there, and the row never goes stale in a way that needs repairing.
CREATE TABLE IF NOT EXISTS colts_squads (
  country_id   text NOT NULL REFERENCES countries(id),
  slot         int  NOT NULL,
  season_no    int  NOT NULL,
  names        jsonb NOT NULL,               -- array of player names
  submitted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_id, slot, season_no)
);

-- ---------------------------------------------------------------------------
-- 3. who is eligible, and can this club field a side
-- ---------------------------------------------------------------------------
-- The one definition of eligibility, in SQL, so the page a manager reads and
-- the umpire that plays the tie cannot disagree about who is a boy. Under 21
-- on the day, from either list. Public: a rival's ability to raise a side is
-- a fact about the competition, not a secret.
CREATE OR REPLACE FUNCTION public.world_colts_eligible(p_country text, p_slot int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE club record; men jsonb;
BEGIN
  SELECT name, squad, youth INTO club FROM clubs WHERE country_id = p_country AND slot = p_slot;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such club'; END IF;
  SELECT coalesce(jsonb_agg(m ORDER BY (m->>'age')::numeric, m->>'name'), '[]'::jsonb) INTO men
    FROM (
      SELECT jsonb_build_object(
               'name', p->>'name', 'age', (p->>'age')::numeric,
               'rating', (p->>'rating')::numeric, 'role', p->>'role',
               'where', src) AS m
        FROM (
          SELECT jsonb_array_elements(coalesce(club.youth, '[]'::jsonb)) AS p, 'academy' AS src
          UNION ALL
          SELECT jsonb_array_elements(coalesce(club.squad, '[]'::jsonb)) AS p, 'senior' AS src
        ) q
       WHERE (p->>'age')::numeric < 21
    ) r;
  RETURN jsonb_build_object(
    'ok', true, 'club', club.name, 'country', p_country, 'slot', p_slot,
    'men', men, 'eligible', jsonb_array_length(men),
    -- fifteen is the bar; eighteen is the most that may be named
    'floor', 15, 'ceiling', 18,
    'canField', jsonb_array_length(men) >= 15);
END $$;

-- ---------------------------------------------------------------------------
-- 4. naming the squad — the caller's own club, and only his
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_set_colts_squad(p_names jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE
  uid uuid; cl record; seas int; elig jsonb; ok_names text[]; want text[]; bad text;
BEGIN
  uid := _uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT c.country_id, c.slot INTO cl FROM claims c WHERE c.user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'you do not manage a club'; END IF;
  IF jsonb_typeof(p_names) <> 'array' THEN RAISE EXCEPTION 'name a squad as an array of names'; END IF;

  SELECT max(season_no) INTO seas FROM seasons WHERE country_id = cl.country_id;
  IF seas IS NULL THEN RAISE EXCEPTION 'no season to name a squad for'; END IF;

  elig := public.world_colts_eligible(cl.country_id, cl.slot);
  SELECT array_agg(m->>'name') INTO ok_names FROM jsonb_array_elements(elig->'men') m;
  SELECT array_agg(DISTINCT x) INTO want FROM jsonb_array_elements_text(p_names) x;

  IF want IS NULL OR array_length(want, 1) < 15 THEN
    RAISE EXCEPTION 'a Colts Cup squad is fifteen men at least';
  END IF;
  IF array_length(want, 1) > 18 THEN
    RAISE EXCEPTION 'a Colts Cup squad is eighteen men at most';
  END IF;
  -- every man named must be a boy of this club, today
  SELECT x INTO bad FROM unnest(want) x WHERE NOT (x = ANY (coalesce(ok_names, '{}'))) LIMIT 1;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '% is not an under-21 on your books', bad;
  END IF;

  INSERT INTO colts_squads(country_id, slot, season_no, names)
       VALUES (cl.country_id, cl.slot, seas, to_jsonb(want))
  ON CONFLICT (country_id, slot, season_no)
    DO UPDATE SET names = EXCLUDED.names, submitted_at = now();

  RETURN jsonb_build_object('ok', true, 'named', array_length(want, 1), 'season', seas);
END $$;

-- and reading back what is named, for the club the caller manages
CREATE OR REPLACE FUNCTION public.world_my_colts_squad()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE uid uuid; cl record; seas int; row_ record; elig jsonb;
BEGIN
  uid := _uid();
  IF uid IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT c.country_id, c.slot INTO cl FROM claims c WHERE c.user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'you do not manage a club'; END IF;
  SELECT max(season_no) INTO seas FROM seasons WHERE country_id = cl.country_id;
  elig := public.world_colts_eligible(cl.country_id, cl.slot);
  SELECT names, submitted_at INTO row_ FROM colts_squads
   WHERE country_id = cl.country_id AND slot = cl.slot AND season_no = seas;
  RETURN elig || jsonb_build_object(
    'season', seas,
    'named', coalesce(row_.names, 'null'::jsonb),
    'namedAt', row_.submitted_at);
END $$;

-- ---------------------------------------------------------------------------
-- 5. the bracket, for anyone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_colts_cup(p_country text, p_season int DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE seas int; o jsonb;
BEGIN
  seas := coalesce(p_season, (SELECT max(season_no) FROM seasons WHERE country_id = p_country));
  SELECT coalesce(jsonb_object_agg(stage, ties), '{}'::jsonb) INTO o FROM (
    SELECT stage, jsonb_agg(jsonb_build_object(
             'gi', gi, 'a', a, 'b', b,
             'winner', result->>'winner', 'text', result->>'text',
             'forfeit', forfeit) ORDER BY gi) AS ties
      FROM cup_matches
     WHERE comp = 'colts:' || p_country AND season_no = seas
     GROUP BY stage) q;
  RETURN jsonb_build_object('ok', true, 'country', p_country, 'season', seas, 'stages', o);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_colts_eligible(text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_set_colts_squad(jsonb) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_my_colts_squad() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_colts_cup(text, int) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_colts_eligible(text, int) TO anon;
    GRANT EXECUTE ON FUNCTION public.world_colts_cup(text, int) TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
