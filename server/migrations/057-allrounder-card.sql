-- 057-allrounder-card.sql — THE ALL-ROUNDER READS WHAT HE IS.
--
-- A man who bats and bowls splits his skills across two trades, so neither
-- aggregate is a specialist's. This branch then blended the two and scaled by
-- only 1.04, where a bowler's branch stretches by 1.5 and shifts by -14 - so
-- he was docked twice, once in the skills and once in the arithmetic.
--
-- Measured over 1,440 cricketers in six countries, card against the engine's
-- own rating, as a percentage of a specialist batter's:
--
--     batter 100%   seamer 105%   spinner 105%   keeper 93%   ALL-ROUNDER 65%
--
-- and all-rounders carried the HIGHEST mean rating in the world (36,014) while
-- showing the LOWEST cards (42.8). The scale and shift are fitted so they land
-- on the same card-against-rating line as everybody else, in spread as well as
-- mean; they now read 99%.
--
-- 016 mirrored foPkOvr in SQL so a rival's club page costs one request, and
-- 055 stretched it. The mirror follows the card or the same man is two
-- different numbers depending which page you opened. Only the all-rounder
-- branch changes; world_squads picks this up by name.

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

  RETURN jsonb_build_object(
    'ovr', greatest(1, least(99, round(ovr))),
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep);
END $$;

NOTIFY pgrst, 'reload schema';
