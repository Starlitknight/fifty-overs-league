-- 068 · THE POSTED SCOUT, AND THE WHISPER ON HIS REPORT
--
-- From the Pavilion's scout is a man with a suitcase, not a button: you post
-- him to a country and he works THERE until you move him. This world's scout
-- becomes that man. A club carries one posting (its own country until it says
-- otherwise); each rest day's boy comes from wherever the scout is posted;
-- moving him is free and takes effect from the next report. world_scout keeps
-- its nation parameter for compatibility, but a bare call now reads the
-- posting - the button on the academy page stops carrying a decision the
-- posting already made.
--
-- And the report gains its last line: THE WHISPER - the scout's one-sentence
-- opinion of how much growing is left in the boy. The words are computed by
-- the umpire at generation (they read the hidden rate through level-dependent
-- noise; a better academy mishears less) and stored on the recruit, so this
-- migration only has to pass them through the report's whitelist. The rate
-- itself is still served to nobody.

ALTER TABLE claims ADD COLUMN IF NOT EXISTS scout_nation text;

-- where is the scout? one word back: the posting, defaulted to home
CREATE OR REPLACE FUNCTION public.world_scout_post(p_nation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; nat text; fee bigint;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  nat := coalesce(nullif(trim(p_nation), ''), c.country_id);
  IF NOT EXISTS (SELECT 1 FROM countries WHERE id = nat) THEN
    RAISE EXCEPTION 'no such cricketing nation';
  END IF;
  UPDATE claims SET scout_nation = nat WHERE user_id = u;
  fee := academy_scout_fee(c.country_id, nat);
  RETURN jsonb_build_object('ok', true, 'nation', nat, 'fee', fee);
END $$;

-- the trip: 050's body, with the nation defaulted to the POSTING rather than
-- to home, and the whisper riding the report
CREATE OR REPLACE FUNCTION public.world_scout(p_nation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE
  u uuid; c record; club record; d int; di int; cand record; fee bigint; nat text;
BEGIN
  u := _uid();
  IF u IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RAISE EXCEPTION 'claim a club first'; END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;

  nat := coalesce(nullif(trim(p_nation), ''), c.scout_nation, c.country_id);
  IF NOT EXISTS (SELECT 1 FROM countries WHERE id = nat) THEN
    RAISE EXCEPTION 'no such cricketing nation';
  END IF;

  d := world_day();
  di := world_di(c.country_id);
  IF di IS NULL OR NOT (di = ANY(world_rest_days())) THEN
    RAISE EXCEPTION 'the scout travels on rest days. There is cricket on today.';
  END IF;
  IF EXISTS (SELECT 1 FROM academy_scouts s
              WHERE s.country_id = c.country_id AND s.slot = c.slot AND s.world_day = d) THEN
    RAISE EXCEPTION 'one trip a rest day, and this one is already made';
  END IF;

  SELECT * INTO cand FROM academy_candidates
   WHERE country_id = c.country_id AND slot = c.slot AND world_day = d AND nation = nat;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'the scout has not reached that country yet - try again shortly';
  END IF;

  fee := academy_scout_fee(c.country_id, nat);
  IF fee > 0 AND coalesce(club.bank, 0) < 0 THEN
    RAISE EXCEPTION 'a club in the red sends no scouts abroad - get level first';
  END IF;
  IF fee > 0 AND coalesce(club.bank, 0) < fee THEN
    RAISE EXCEPTION 'that trip costs %, and the treasury holds %', fee, club.bank;
  END IF;

  INSERT INTO academy_scouts(country_id, slot, world_day, nation, tier, fee, recruit)
       VALUES (c.country_id, c.slot, d, nat, cand.tier, fee, cand.recruit);
  IF fee > 0 THEN
    INSERT INTO academy_spend(country_id, slot, world_day, kind, label, amount)
         VALUES (c.country_id, c.slot, d, 'scouting',
                 'Scouting trip · ' || (SELECT name FROM countries WHERE id = nat), -fee);
    UPDATE clubs SET bank = coalesce(bank, 0) - fee WHERE country_id = c.country_id AND slot = c.slot;
  END IF;

  RETURN jsonb_build_object('ok', true, 'nation', nat, 'fee', fee,
    'recruit', academy_report(cand.recruit,
                 c.country_id || '|' || c.slot || '|' || d || '|' || nat, club.academy),
    'day', d);
END $$;

-- the report: 050's whitelist, one line longer - the whisper passes through
CREATE OR REPLACE FUNCTION academy_report(p_recruit jsonb, p_seed text, p_level int)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE half numeric := academy_blur(p_level); sk jsonb := '{}'::jsonb; k text;
BEGIN
  FOR k IN SELECT jsonb_object_keys(coalesce(p_recruit->'skills', '{}'::jsonb)) LOOP
    sk := sk || jsonb_build_object(k,
      academy_band((p_recruit->'skills'->>k)::numeric, half, p_seed || '|' || k));
  END LOOP;
  RETURN jsonb_build_object(
    'scouted', true, 'colt', true,
    'name', p_recruit->'name', 'age', p_recruit->'age',
    'nat', p_recruit->'nat', 'from', p_recruit->'from',
    'hand', p_recruit->'hand', 'keeper', p_recruit->'keeper',
    'role', p_recruit->'role',
    'bowlType', p_recruit->'bowlType', 'bowlTypeFull', p_recruit->'bowlTypeFull',
    'wage', p_recruit->'wage',
    'whisper', p_recruit->'whisper',
    'blur', half, 'level', greatest(1, least(5, coalesce(p_level, 1))),
    'skillBands', sk,
    'ratingBand', academy_band((p_recruit->>'rating')::numeric, half * 1.25, p_seed || '|rating'),
    'expBand', academy_band((p_recruit->>'exp')::numeric, half, p_seed || '|exp'));
END $$;

-- the academy page learns where the scout is: 058's body, two keys heavier
CREATE OR REPLACE FUNCTION public.world_my_academy()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = world, public AS $$
DECLARE u uuid; c record; club record; d int; di int; pend jsonb; nats jsonb; used boolean;
BEGIN
  u := _uid();
  IF u IS NULL THEN RETURN jsonb_build_object('signedIn', false); END IF;
  SELECT * INTO c FROM claims WHERE user_id = u;
  IF NOT FOUND THEN RETURN jsonb_build_object('signedIn', true, 'claim', null); END IF;
  SELECT * INTO club FROM clubs WHERE country_id = c.country_id AND slot = c.slot;
  d := world_day();
  di := world_di(c.country_id);

  SELECT to_jsonb(s) - 'recruit'
         || jsonb_build_object('recruit', academy_report(s.recruit,
              c.country_id || '|' || c.slot || '|' || s.world_day || '|' || s.nation, club.academy))
    INTO pend
    FROM academy_scouts s
   WHERE s.country_id = c.country_id AND s.slot = c.slot AND s.decision IS NULL
   ORDER BY s.world_day DESC LIMIT 1;

  used := EXISTS (SELECT 1 FROM academy_scouts s
                   WHERE s.country_id = c.country_id AND s.slot = c.slot AND s.world_day = d);

  SELECT jsonb_agg(jsonb_build_object('id', n.id, 'name', n.name,
                                      'fee', academy_scout_fee(c.country_id, n.id))
                   ORDER BY n.name)
    INTO nats FROM countries n;

  RETURN jsonb_build_object(
    'signedIn', true,
    'country', c.country_id, 'slot', c.slot, 'club', club.name,
    'level', club.academy,
    'maxLevel', academy_max(),
    'upkeep', academy_upkeep(club.academy),
    'nextLevel', CASE WHEN club.academy < academy_max() THEN club.academy + 1 END,
    'nextCost', CASE WHEN club.academy < academy_max() THEN academy_build_cost(club.academy, club.academy + 1) END,
    'nextUpkeep', CASE WHEN club.academy < academy_max() THEN academy_upkeep(club.academy + 1) END,
    'built', club.academy_paid,
    'youth', coalesce(club.youth, '[]'::jsonb),
    'floor', academy_floor(),
    'promoteFee', academy_promote_fee(),
    'squadSize', jsonb_array_length(coalesce(club.squad, '[]'::jsonb)),
    'day', d, 'di', di,
    'restDay', (di IS NOT NULL AND di = ANY(world_rest_days())),
    'restDays', to_jsonb(world_rest_days()),
    'scoutedToday', used,
    'pending', pend,
    'nations', coalesce(nats, '[]'::jsonb),
    'scoutNation', coalesce(c.scout_nation, c.country_id),
    'scoutFee', academy_scout_fee(c.country_id, coalesce(c.scout_nation, c.country_id)),
    'bank', club.bank);
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_scout_post(text) TO authenticated;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
