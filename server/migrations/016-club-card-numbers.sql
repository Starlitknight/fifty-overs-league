-- 016-club-card-numbers.sql — THE SKILLS SUMMARY, NOT THE COACHING BOOK
--
-- A club page can show what a scout would see from the boundary: how good a
-- man is with the bat, with the ball, in the field, and one overall number
-- for his class. What it must not show is the fifteen raw skills, the
-- training plan or the progress toward the next jump - that is the club's
-- own book, and reading it over the fence would end the teamsheet reveal.
--
-- These are the ENGINE'S OWN formulas, mirrored in SQL: the grouped
-- aggregates from the core (aggBat/aggBowl/aggKeep/aggTech/aggField) and the
-- card's overall rating. server/tests guards the mirror by running the real
-- engine over the same squad and demanding the same numbers, so a change to
-- one without the other fails the suite rather than drifting quietly.

CREATE OR REPLACE FUNCTION world_pk_num(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s jsonb := coalesce(p->'skills', '{}'::jsonb);
  n  numeric;
  bat numeric; bowl numeric; keep numeric; tech numeric; fld numeric;
  pow numeric; batScore numeric; ovr numeric;
  hasBowl boolean := (p->>'bowlType') IS NOT NULL AND (p->>'bowlType') <> 'null';
  isKeeper boolean := coalesce((p->>'keeper')::boolean, false) OR (p->>'role') = 'wicketkeeper';
  g text := p->>'role';
BEGIN
  -- every skill defaults to 0, exactly as the engine's undefined-to-NaN
  -- paths resolve once a real generated player is in hand
  bat := round(0.25 * coalesce((s->>'vsPace')::numeric, 0)
             + 0.25 * coalesce((s->>'vsSpin')::numeric, 0)
             + 0.20 * coalesce((s->>'rotation')::numeric, 0)
             + 0.15 * coalesce((s->>'temperament')::numeric, 0)
             + 0.15 * coalesce((s->>'power')::numeric, 0));
  IF hasBowl THEN
    bowl := round((coalesce((s->>'wicket')::numeric, 0) + coalesce((s->>'economy')::numeric, 0)
                 + coalesce((s->>'discipline')::numeric, 0) + coalesce((s->>'moveTurn')::numeric, 0)
                 + coalesce((s->>'variation')::numeric, 0) + coalesce((s->>'stamina')::numeric, 0)) / 6.0);
  ELSE
    -- JS: Math.round(wicket*0.3 || 5) - a zero or missing wicket falls to 5
    n := coalesce((s->>'wicket')::numeric, 0) * 0.3;
    bowl := round(CASE WHEN n = 0 THEN 5 ELSE n END);
  END IF;
  IF isKeeper THEN
    keep := round((coalesce((s->>'keeping')::numeric, 0) + coalesce((s->>'stumping')::numeric, 0)
                 + coalesce((s->>'catching')::numeric, 0)) / 3.0);
  ELSE
    n := coalesce((s->>'keeping')::numeric, 0);
    keep := least(15, round(CASE WHEN n = 0 THEN 8 ELSE n END));
  END IF;
  tech := round((coalesce((s->>'vsPace')::numeric, 0) + coalesce((s->>'vsSpin')::numeric, 0)
               + coalesce((s->>'temperament')::numeric, 0)) / 3.0);
  fld  := round((coalesce((s->>'fielding')::numeric, 0) + coalesce((s->>'catching')::numeric, 0)) / 2.0);
  pow  := coalesce((p->>'power')::numeric, coalesce((s->>'power')::numeric, 0));

  batScore := 0.58 * bat + 0.24 * tech + 0.18 * pow;
  IF isKeeper THEN
    ovr := 1.07 * (0.46 * keep + 0.40 * batScore + 0.14 * fld) - 1;
  ELSIF g = 'allRounder' THEN
    ovr := 1.04 * (0.60 * greatest(batScore, CASE WHEN hasBowl THEN bowl ELSE 0 END)
                 + 0.28 * least(batScore, CASE WHEN hasBowl THEN bowl ELSE 0 END)
                 + 0.12 * fld);
  ELSIF hasBowl AND bowl > batScore THEN
    ovr := 1.5 * (0.74 * bowl + 0.12 * tech + 0.14 * fld) - 14;
  ELSE
    ovr := 0.60 * batScore + 0.12 * bat + 0.14 * pow + 0.14 * fld;
  END IF;

  RETURN jsonb_build_object(
    'ovr', greatest(1, least(99, round(ovr))),
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep);
END $$;

-- the public squad, now with the scout's summary on every man and the three
-- team strengths a rival reads first
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
                    'keeper',  coalesce(r.pl->'keeper', 'false'::jsonb),
                    'rating',  r.pl->'rating',
                    'ovr',     r.num->'ovr',
                    'batting', r.num->'batting',
                    'bowling', r.num->'bowling',
                    'fielding',r.num->'fielding',
                    'wage',    r.pl->'wage',
                    'value',   r.pl->'fee',
                    'talents', coalesce(r.pl->'talents', '[]'::jsonb),
                    'exp',     r.pl->>'expWord',
                    'form',    r.pl->>'formWord',
                    'fatigue', r.pl->>'fatWord',
                    'career',  coalesce(r.pl->'career', '{}'::jsonb))
                  ORDER BY (r.num->>'ovr')::numeric DESC, (r.pl->>'rating')::numeric DESC)
             FROM ranked r WHERE r.country_id = cl.country_id AND r.slot = cl.slot
         ), '[]'::jsonb) AS players,
         coalesce((SELECT sum(coalesce((p->>'wage')::numeric, 0)) FROM jsonb_array_elements(cl.squad) p), 0) AS wage_bill,
         -- the side's batting is its top seven, its attack the top five, its
         -- fielding everybody - the same shape the engine's own team strength uses
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
