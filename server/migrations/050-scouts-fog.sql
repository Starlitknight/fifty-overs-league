-- 050-scouts-fog.sql — THE SCOUT'S REPORT, NOT THE BOY'S FILE.
--
-- 040 showed a manager everything about a recruit before he paid a penny to
-- sign him: "what you see is what there is". That made scouting a spreadsheet
-- errand. The games this room descends from - From the Pavilion, Battrick,
-- Hattrick's whole family - know better: the scout comes back with a REPORT,
-- and a report is an opinion. You read ranges, not numbers; you weigh the
-- gamble; you sign the boy to find out who he really is.
--
-- So the two surfaces that used to hand over the full file now hand over a
-- report:
--   world_scout      : the trip's return is a report - facts a scout can see
--                      plainly (name, age, where he's from, which hand, what
--                      he bowls, the wage he'd ask) plus a BAND per skill.
--   world_my_academy : the boy still waiting on an answer is served the same
--                      way, rebuilt from the CURRENT academy level - build a
--                      better academy and the same report sharpens.
--
-- THE BANDS ARE HONEST AND DETERMINISTIC. Each band always contains the true
-- value; its width is set by the academy level (a level-one academy reads a
-- boy to about ±16 on the 0-99 scale, a level-five to about ±4); and its
-- centre is offset by a seeded hash so the midpoint never betrays the truth.
-- The same trip re-read serves the identical report - there is nothing to
-- farm by refreshing. The boy himself is untouched: candidates are laid out
-- exactly as before, and the SIGNATURE is the reveal - the moment he joins
-- the youth list, his real file is on the table (clubs.youth is served whole,
-- as it always was).

CREATE OR REPLACE FUNCTION academy_blur(p_level int)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT (ARRAY[16, 12, 9, 6, 4])[greatest(1, least(5, coalesce(p_level, 1)))]::numeric
$$;

-- one band: [lo, hi] around the truth, centre nudged by a seeded hash so the
-- midpoint carries no information, clamped to the 1-99 scale the skills live
-- on. floor/ceil keep the truth strictly inside whatever the rounding does.
CREATE OR REPLACE FUNCTION academy_band(p_v numeric, p_half numeric, p_seed text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE nudge numeric; lo int; hi int;
BEGIN
  IF p_v IS NULL THEN RETURN NULL; END IF;
  nudge := (((hashtext(p_seed) & 1023)::numeric / 1023.0) * 2 - 1) * (p_half * 0.6);
  lo := greatest(1, floor(p_v + nudge - p_half))::int;
  hi := least(99, ceil(p_v + nudge + p_half))::int;
  RETURN jsonb_build_object('lo', least(lo, floor(p_v))::int, 'hi', greatest(hi, ceiling(p_v))::int);
END $$;

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
    'blur', half, 'level', greatest(1, least(5, coalesce(p_level, 1))),
    'skillBands', sk,
    'ratingBand', academy_band((p_recruit->>'rating')::numeric, half * 1.25, p_seed || '|rating'),
    'expBand', academy_band((p_recruit->>'exp')::numeric, half, p_seed || '|exp'));
END $$;

-- the trip now returns the report. Everything else - the rest-day law, the
-- one-trip law, the fees, the candidate on the table - stands as 040 wrote it.
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

  nat := coalesce(nullif(trim(p_nation), ''), c.country_id);
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

-- the boy still waiting on an answer is a report too, rebuilt from the
-- CURRENT level: build the academy up tonight and read him sharper tomorrow
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
    'upkeep', (ARRAY[6000, 14000, 26000, 44000, 70000])[club.academy],
    'nextLevel', CASE WHEN club.academy < 5 THEN club.academy + 1 END,
    'nextCost', CASE WHEN club.academy < 5 THEN academy_build_cost(club.academy, club.academy + 1) END,
    'nextUpkeep', CASE WHEN club.academy < 5 THEN (ARRAY[6000, 14000, 26000, 44000, 70000])[club.academy + 1] END,
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
    'bank', club.bank);
END $$;

NOTIFY pgrst, 'reload schema';
