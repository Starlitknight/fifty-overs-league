-- 082 · A RIVAL WEARS THE SAME STARS
--
-- The Roster is how this game shows a squad: a man's face, his flag, his
-- craft, his age, and a strip of ten stars saying how good he is at the
-- thing he is for. The stars are the point - a manager reads them before he
-- reads anything else - and they come from a COMPOSITE the orders room
-- computes: sixty per cent the discipline aggregate, twenty technique,
-- twenty power (or, for a bowler, sixty the bowling aggregate, twenty wicket
-- threat, twenty economy).
--
-- Those last forty per cent are raw skills, and raw skills do not cross the
-- fence. 016 drew the line on purpose: a scout may read a man's class from
-- the boundary, never the fifteen numbers underneath. So a rival's roster
-- could not wear the same stars - it would have had to guess them from the
-- aggregate alone, and two pages would have rated one cricketer differently.
--
-- The answer is the one 016 already used for the overall rating: publish the
-- SUMMARY, not the ingredients. The composite is a single number that says
-- how good he is; it leaks nothing about which skill got him there, exactly
-- as 'ovr' leaks nothing. So it is computed here by the same formula, and
-- the mirror is guarded by the same test that guards the card rating - the
-- real engine run over the same squad, demanding the same numbers.
--
-- THIS IS 062'S FUNCTION, WITH TWO LINES ADDED. world_pk_num has been
-- rewritten four times since 016 - the card stretch (055), the all-rounder's
-- line (057), the rounding parity (061) and the inlining that saved it from
-- a search_path it could not see (062) - so the body to build on is the LAST
-- one, not the first. A version of this migration written against 016 passed
-- its own new test and quietly reverted all four; the card-rating mirror in
-- world-p3 is what caught it, which is exactly the job that guard exists for.
--
-- bowlComp is null for a man who does not bowl, because a batsman has no
-- bowling stars to wear (the Roster shows batting stars for him instead).

CREATE OR REPLACE FUNCTION world_pk_num(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s jsonb := coalesce(p->'skills', '{}'::jsonb);
  n  double precision;
  bat double precision; bowl double precision; keep double precision; tech double precision; fld double precision;
  pow double precision; batScore double precision; ovr double precision;
  batComp double precision; bowlComp double precision;
  hasBowl boolean := (p->>'bowlType') IS NOT NULL AND (p->>'bowlType') <> 'null';
  isKeeper boolean := coalesce((p->>'keeper')::boolean, false) OR (p->>'role') = 'wicketkeeper';
  g text := p->>'role';
BEGIN
  -- every skill defaults to 0, exactly as the engine's undefined-to-NaN
  -- paths resolve once a real generated player is in hand
  bat := floor((0.25 * coalesce((s->>'vsPace')::double precision, 0)
             + 0.25 * coalesce((s->>'vsSpin')::double precision, 0)
             + 0.20 * coalesce((s->>'rotation')::double precision, 0)
             + 0.15 * coalesce((s->>'temperament')::double precision, 0)
             + 0.15 * coalesce((s->>'power')::double precision, 0)) + 0.5);
  IF hasBowl THEN
    bowl := floor(((coalesce((s->>'wicket')::double precision, 0) + coalesce((s->>'economy')::double precision, 0)
                 + coalesce((s->>'discipline')::double precision, 0) + coalesce((s->>'moveTurn')::double precision, 0)
                 + coalesce((s->>'variation')::double precision, 0) + coalesce((s->>'stamina')::double precision, 0)) / 6.0) + 0.5);
  ELSE
    -- JS: Math.round(wicket*0.3 || 5) - a zero or missing wicket falls to 5
    n := coalesce((s->>'wicket')::double precision, 0) * 0.3;
    bowl := floor((CASE WHEN n = 0 THEN 5 ELSE n END) + 0.5);
  END IF;
  IF isKeeper THEN
    keep := floor(((coalesce((s->>'keeping')::double precision, 0) + coalesce((s->>'stumping')::double precision, 0)
                 + coalesce((s->>'catching')::double precision, 0)) / 3.0) + 0.5);
  ELSE
    n := coalesce((s->>'keeping')::double precision, 0);
    keep := least(15, floor((CASE WHEN n = 0 THEN 8 ELSE n END) + 0.5));
  END IF;
  tech := floor(((coalesce((s->>'vsPace')::double precision, 0) + coalesce((s->>'vsSpin')::double precision, 0)
               + coalesce((s->>'temperament')::double precision, 0)) / 3.0) + 0.5);
  fld  := floor(((coalesce((s->>'fielding')::double precision, 0) + coalesce((s->>'catching')::double precision, 0)) / 2.0) + 0.5);
  pow  := coalesce((p->>'power')::double precision, coalesce((s->>'power')::double precision, 0));

  batScore := 0.58 * bat + 0.24 * tech + 0.18 * pow;
  IF isKeeper THEN
    ovr := 1.07 * (0.46 * keep + 0.40 * batScore + 0.14 * fld) - 1;
  ELSIF g = 'allRounder' THEN
    -- 057: scaled and shifted onto the same line as everyone else
    ovr := 1.269 * (0.60 * greatest(batScore, CASE WHEN hasBowl THEN bowl ELSE 0 END)
                 + 0.28 * least(batScore, CASE WHEN hasBowl THEN bowl ELSE 0 END)
                 + 0.12 * fld) + 9.57;
  ELSIF hasBowl AND bowl > batScore THEN
    ovr := 1.5 * (0.74 * bowl + 0.12 * tech + 0.14 * fld) - 14;
  ELSE
    ovr := 0.60 * batScore + 0.12 * bat + 0.14 * pow + 0.14 * fld;
  END IF;
  -- the stretch: FO_CARD_A / FO_CARD_B in engine/src/league/03-onboarding.js
  ovr := 1.32 * ovr - 1;

  -- THE STAR COMPOSITES, by the orders room's own arithmetic (08-orders.js,
  -- foOrdBatComp / foOrdBowlComp): sixty per cent the discipline aggregate,
  -- twenty technique, twenty power - and for a bowler, sixty the bowling
  -- aggregate, twenty wicket threat, twenty economy. Note the power here is
  -- the SKILL, which is what the engine reads, not the p.power override the
  -- overall rating prefers. Double precision throughout and no rounding of
  -- its own: 061 and 062 settled that argument, and a star strip would show
  -- a disagreement the overall rating hides when it rounds to an integer.
  batComp := 0.6 * bat
           + 0.2 * ((coalesce((s->>'vsPace')::double precision, 0)
                   + coalesce((s->>'vsSpin')::double precision, 0)) / 2)
           + 0.2 * coalesce((s->>'power')::double precision, 0);
  bowlComp := CASE WHEN hasBowl THEN
      0.6 * bowl + 0.2 * coalesce((s->>'wicket')::double precision, 0)
                 + 0.2 * coalesce((s->>'economy')::double precision, 0)
    END;

  RETURN jsonb_build_object(
    'ovr', greatest(1, least(99, floor(ovr + 0.5))),
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep,
    'batComp', batComp, 'bowlComp', bowlComp);
END $$;

-- the public squad, with the two composites riding beside the card numbers.
-- 081's view otherwise, verbatim - the milestones stay, the ordering stays,
-- the three team strengths stay.
DROP VIEW IF EXISTS public.world_squads;
CREATE VIEW public.world_squads AS
  WITH men AS (
    SELECT cl.country_id, cl.slot, cl.name, p AS pl, world_pk_num(p) AS num
      FROM clubs cl, jsonb_array_elements(cl.squad) p
     WHERE p->>'name' IS NOT NULL
  ), ranked AS (
    SELECT m.*,
           row_number() OVER (PARTITION BY country_id, slot ORDER BY (num->>'batting')::numeric DESC) AS bat_rank,
           row_number() OVER (PARTITION BY country_id, slot ORDER BY (num->>'bowling')::numeric DESC) AS bowl_rank
      FROM men m
  )
  SELECT cl.country_id, cl.slot, cl.name,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
                    'name',    r.pl->>'name',
                    'nat',     r.pl->>'nat',
                    'age',     r.pl->'age',
                    'role',    r.pl->>'role',
                    'hand',    r.pl->>'hand',
                    'bowl',    r.pl->>'btLabel',
                    'type',    r.pl->>'bowlTypeFull',
                    -- the engine's own key for his craft, which is what the
                    -- roster reads to decide whether his stars are bat or ball
                    'bowlType',r.pl->>'bowlType',
                    'keeper',  coalesce(r.pl->'keeper', 'false'::jsonb),
                    'rating',  r.pl->'rating',
                    'ovr',     r.num->'ovr',
                    'batting', r.num->'batting',
                    'bowling', r.num->'bowling',
                    'fielding',r.num->'fielding',
                    'batComp', r.num->'batComp',
                    'bowlComp',r.num->'bowlComp',
                    'wage',    r.pl->'wage',
                    'value',   r.pl->'fee',
                    'talents', coalesce(r.pl->'talents', '[]'::jsonb),
                    'exp',     r.pl->>'expWord',
                    'form',    r.pl->>'formWord',
                    'fatigue', r.pl->>'fatWord',
                    'mile',    coalesce(r.pl->'mile', '[]'::jsonb),
                    'career',  coalesce(r.pl->'career', '{}'::jsonb))
                  ORDER BY (r.num->>'ovr')::numeric DESC, (r.pl->>'rating')::numeric DESC)
             FROM ranked r WHERE r.country_id = cl.country_id AND r.slot = cl.slot
         ), '[]'::jsonb) AS players,
         coalesce((SELECT sum(coalesce((p->>'wage')::numeric, 0)) FROM jsonb_array_elements(cl.squad) p), 0) AS wage_bill,
         coalesce((SELECT round(avg((num->>'batting')::numeric)) FROM ranked r
                    WHERE r.country_id = cl.country_id AND r.slot = cl.slot AND r.bat_rank <= 7), 0) AS team_batting,
         coalesce((SELECT round(avg((num->>'bowling')::numeric)) FROM ranked r
                    WHERE r.country_id = cl.country_id AND r.slot = cl.slot AND r.bowl_rank <= 5), 0) AS team_bowling,
         coalesce((SELECT round(avg((num->>'fielding')::numeric)) FROM ranked r
                    WHERE r.country_id = cl.country_id AND r.slot = cl.slot), 0) AS team_fielding
    FROM clubs cl;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_squads TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_squads TO anon;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
