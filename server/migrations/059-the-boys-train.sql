-- 059-the-boys-train.sql — THE ACADEMY STOPS BEING A WAITING ROOM.
--
-- docs/ACADEMY.md has always said what a boy becomes: "What he becomes is what
-- the ordinary training curve does to the skills he already has." It was not
-- true. living.mjs replayed clubs.squad and clubs.squad only, so a colt aged a
-- year at every rollover and walked out at twenty-one exactly the cricketer
-- who walked in - while the training page cheerfully took a programme for him,
-- filed it, and the umpire threw it away unread. The one building whose entire
-- purpose is developing young cricketers developed nobody.
--
-- From here the boys are replayed alongside the men, against the same banked
-- rounds, by the same engine, at the same academy rate. Being sixteen to
-- twenty they sit on the steepest part of the age curve - a session is worth
-- half again to them what it is worth to a man of twenty-five, and five times
-- what it is worth to a man of thirty-three - which is what an academy was
-- always meant to buy.
--
-- ---------------------------------------------------------------------------
-- NOBODY IS PAID FOR WORK HE DID NOT DO.
--
-- The replay works a man only from the round he JOINED, or a cricketer signed
-- last week is handed three seasons of somebody else's nets. Seniors have
-- carried a joining round since 018. Colts never needed one, because colts
-- never trained - so every boy on the books today has no stamp, and switching
-- the nets on without one would hand each of them the club's ENTIRE banked
-- history in a single settle. Squads would jump overnight with no cricket
-- played to explain it.
--
-- So every colt now standing is stamped with the round about to be banked.
-- Not one of them gains a session for a week he spent doing nothing; they all
-- start on the same morning, which is this one.
--
-- The founding sixteen are the deliberate exception and are NOT stamped here:
-- like every cricketer the world was made with, they arrived with the world
-- and have been at the club all along. That is only true where the club has
-- banked no rounds yet - a world mid-season stamps everybody, which is the
-- safe reading and the one this does.
-- ---------------------------------------------------------------------------
UPDATE clubs c
   SET youth = (
     SELECT coalesce(jsonb_agg(
              CASE WHEN y ? 'joined' THEN y
                   ELSE y || jsonb_build_object('joined', jsonb_build_object(
                          's', (SELECT coalesce(max(season_no), 1) FROM seasons s WHERE s.country_id = c.country_id),
                          'r', (SELECT coalesce(max(tr.round), 0) + 1 FROM training_rounds tr
                                 WHERE tr.country_id = c.country_id AND tr.slot = c.slot
                                   AND tr.season_no = (SELECT coalesce(max(season_no), 1) FROM seasons s2
                                                        WHERE s2.country_id = c.country_id))))
              END ORDER BY ord), '[]'::jsonb)
       FROM jsonb_array_elements(c.youth) WITH ORDINALITY t(y, ord))
 WHERE jsonb_typeof(c.youth) = 'array'
   AND jsonb_array_length(c.youth) > 0
   AND EXISTS (SELECT 1 FROM training_rounds tr
                WHERE tr.country_id = c.country_id AND tr.slot = c.slot);

-- ---------------------------------------------------------------------------
-- A BOY SCOUTED AND SIGNED STARTS THE DAY HE SIGNS. 040's body, one stamp
-- heavier: the recruit goes onto the books carrying the round he arrived at,
-- so his first session in the replay is genuinely his first session.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_recruit(p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; s record; s_no int; r_no int;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  IF p_action NOT IN ('sign', 'release') THEN RAISE EXCEPTION 'sign him or release him'; END IF;

  SELECT * INTO s FROM academy_scouts
   WHERE country_id = c.country_id AND slot = c.slot AND decision IS NULL
   ORDER BY world_day DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'there is nobody waiting on an answer'; END IF;

  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  IF p_action = 'sign' THEN
    -- a name already on the books is never doubled
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(club.youth, '[]'::jsonb)) y
                WHERE y->>'name' = s.recruit->>'name')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(club.squad, '[]'::jsonb)) p
                WHERE p->>'name' = s.recruit->>'name') THEN
      RAISE EXCEPTION 'there is already a % at this club', s.recruit->>'name';
    END IF;
    SELECT coalesce(max(season_no), 1) INTO s_no FROM seasons WHERE country_id = c.country_id;
    SELECT coalesce(max(round), 0) + 1 INTO r_no FROM training_rounds
      WHERE country_id = c.country_id AND slot = c.slot AND season_no = s_no;
    UPDATE clubs SET youth = coalesce(youth, '[]'::jsonb) || jsonb_build_array(
                       s.recruit || jsonb_build_object('joined',
                         jsonb_build_object('s', s_no, 'r', r_no)))
      WHERE country_id = c.country_id AND slot = c.slot;
  END IF;
  UPDATE academy_scouts SET decision = p_action
    WHERE country_id = c.country_id AND slot = c.slot AND world_day = s.world_day;

  RETURN jsonb_build_object('ok', true, 'action', p_action, 'name', s.recruit->>'name');
END $$;

-- ---------------------------------------------------------------------------
-- AND THE WORK COMES WITH HIM WHEN HE IS HANDED A SHIRT.
--
-- A promotion moves a boy from clubs.youth to clubs.squad, and the two are
-- replayed separately: the senior walk rebuilds a man from his baseSkills and
-- the rounds since he joined. So a colt who spent three seasons in the nets
-- and is then promoted would be rebuilt from the skills he had the DAY HE WAS
-- SCOUTED, and three seasons of work would vanish on the morning of his
-- promotion - the club's reward for developing him being to undevelop him.
--
-- His trained skills become his new baseline, exactly as the market freezes a
-- transferred man's record onto him as a carry. What he is when he walks up is
-- what he starts his senior career as.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_colt(p_name text, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; colt jsonb; rest jsonb; s_no int; r_no int; fee bigint;
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
    UPDATE clubs SET youth = rest,
                     bank = coalesce(bank, 0) - fee,
                     squad = coalesce(club.squad, '[]'::jsonb) || jsonb_build_array(
                       ((colt - 'colt') - 'promise')
                       -- the academy years come with him: what he trained into
                       -- IS what he starts his senior career as
                       || jsonb_build_object('baseSkills', colt->'skills')
                       || (CASE WHEN colt ? 'exp' THEN jsonb_build_object('baseExp', colt->'exp')
                                ELSE '{}'::jsonb END)
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
    GRANT EXECUTE ON FUNCTION public.world_recruit(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.world_colt(text, text) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
