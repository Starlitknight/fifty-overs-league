-- 064-colt-carries-his-progress.sql — TWO SEASONS IN THE COLTS ARE NOT WIPED
-- BY BEING HANDED A SENIOR SHIRT.
--
-- A cricketer earns a talent by keeping on finding himself in the situation
-- one describes and doing the job, and the progress is a FOLD of the record:
-- summed from scratch on every settle out of the matches his current club has
-- played. That is what makes it re-derivable, and it is also what makes a move
-- erase it - the new book has never seen him.
--
-- The world already had this problem and already had the answer. A man's
-- career is frozen onto him as a carry when he is transferred, because the
-- living layer would otherwise hand him a blank page at his new club. Talent
-- progress needs the same freeze, and a promotion out of the academy is the
-- move that needs it most: a boy plays the Colts Cup for two or three seasons,
-- which is exactly the span a talent takes, and the morning he is signed is
-- the morning it would all have vanished.
--
-- So promotion folds whatever he has learned into talCarry, and the senior
-- fold adds his carry to its own sum rather than replacing it. Nothing is
-- double-counted: the colts book and the senior book are separate competitions
-- and separate rows, and living.mjs no longer reads colts ties into the senior
-- fold at all.
--
-- THIS IS 059'S FUNCTION WITH ONE THING ADDED. It is written out in full
-- because CREATE OR REPLACE replaces the whole body, and a migration that
-- starts from an older copy silently reverts everything added since - the
-- first draft of this file was built on 040 and would have taken out the
-- academy-spend ledger row, the baseSkills/baseExp carry that makes a boy's
-- academy years his own, and the ok flag every caller reads. p3 caught it.
CREATE OR REPLACE FUNCTION public.world_colt(p_name text, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; colt jsonb; rest jsonb; s_no int; r_no int; fee bigint;
        carried jsonb;
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
    IF jsonb_array_length(coalesce(club.squad, '[]'::jsonb)) >= 20 THEN
      RAISE EXCEPTION 'the senior squad is full at twenty';
    END IF;
    fee := academy_promote_fee();
    -- 040's floor stands: a club under water signs nobody
    IF coalesce(club.bank, 0) < 0 THEN
      RAISE EXCEPTION 'a club in the red signs nobody - get level first';
    END IF;
    IF coalesce(club.bank, 0) < fee THEN
      RAISE EXCEPTION 'a senior contract costs %, and the treasury holds %', fee, coalesce(club.bank, 0);
    END IF;
    SELECT coalesce(max(season_no), 1) INTO s_no FROM seasons WHERE country_id = c.country_id;
    SELECT coalesce(max(round), 0) + 1 INTO r_no FROM training_rounds
      WHERE country_id = c.country_id AND slot = c.slot AND season_no = s_no;
    -- WHAT HE LEARNED IN THE ACADEMY COMES WITH HIM, added to anything he was
    -- already carrying so a boy who arrived with a carry of his own keeps it
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb) INTO carried
      FROM (SELECT key AS k, sum(value::numeric)::int AS v
              FROM (SELECT key, value FROM jsonb_each_text(coalesce(colt->'talCarry', '{}'::jsonb))
                    UNION ALL
                    SELECT key, value FROM jsonb_each_text(coalesce(colt->'talProg', '{}'::jsonb))) both_books
             GROUP BY key) summed;
    UPDATE clubs SET youth = rest,
                     bank = coalesce(bank, 0) - fee,
                     squad = coalesce(club.squad, '[]'::jsonb) || jsonb_build_array(
                       (((colt - 'colt') - 'promise') - 'talProg')
                       -- the academy years come with him: what he trained into
                       -- IS what he starts his senior career as
                       || jsonb_build_object('baseSkills', colt->'skills')
                       || (CASE WHEN colt ? 'exp' THEN jsonb_build_object('baseExp', colt->'exp')
                                ELSE '{}'::jsonb END)
                       || (CASE WHEN carried = '{}'::jsonb THEN '{}'::jsonb
                                ELSE jsonb_build_object('talCarry', carried) END)
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

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_colt(text, text) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
