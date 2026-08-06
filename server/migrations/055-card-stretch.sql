-- 055-card-stretch.sql — THE MIRROR FOLLOWS THE CARD
--
-- 016 mirrored the engine's card formula in SQL so a rival's club page costs
-- one small request. The card has since been stretched: the cricket lives
-- between about 18,000 and 47,000 in XI rating, because that is the band
-- where the engine still answers a rating gap, and left alone that band
-- printed as 16 to 74 - the top quarter of the nought-to-ninety-nine scale
-- went unused and an international read like a good club player. foPkOvr now
-- prints 1.32x - 1 and the world reads 23 to 99.
--
-- The mirror has to follow, or the same man is a 47 on a rival's page and a
-- 61 on his own. Only the final line changes; every aggregate below it is
-- untouched, and world_squads picks this up by name.

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
  -- the stretch: FO_CARD_A / FO_CARD_B in engine/src/league/03-onboarding.js
  ovr := 1.32 * ovr - 1;

  RETURN jsonb_build_object(
    'ovr', greatest(1, least(99, round(ovr))),
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep);
END $$;

NOTIFY pgrst, 'reload schema';
