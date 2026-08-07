-- 062-pk-num-no-helper.sql — THE CARD FUNCTION STOPS CALLING A SIBLING.
--
-- 061 fixed a real rounding disagreement and broke every club dossier doing
-- it. It moved world_pk_num onto a helper, world_js_round(), and that is the
-- one thing this function may not do.
--
-- The World Service runs with search_path = world, public (server/db.mjs), so
-- 061 created world.world_js_round and replaced world.world_pk_num. The public
-- read views - world_squads and friends - call world_pk_num, and plpgsql
-- resolves the names inside a function body at RUNTIME, against the CALLER's
-- search_path. Every server connection has `world` on its path and so found
-- the helper; PostgREST, serving the browser out of the public profile, does
-- not, and every request for another club's squad came back
--
--     42883: function world_js_round(double precision) does not exist
--
-- which the club page renders, faithfully, as "the squad list is on its way".
-- The world was fine; the door to it was shut. The migration passed its tests
-- because the tests run entirely in public, where the helper and the function
-- share one schema - the one arrangement in which the bug cannot happen. The
-- suite now founds a world in its own schema and reads it back from public,
-- which is production's shape and fails on this.
--
-- So the arithmetic stays exactly as 061 left it - double precision
-- throughout, floor(x + 0.5) for the rounding, because that is what the
-- engine's Math.round does and the engine is the authority - and it is
-- written INLINE. Note the 0.5 is added LAST, after the sum: floating-point
-- addition is not associative, and folding it in at the front would round a
-- different way from the engine on exactly the boundary cases 061 existed to
-- fix. A self-contained function cannot be broken by the path of whoever
-- calls it. world_js_round is left where it is; nothing calls it now.
CREATE OR REPLACE FUNCTION world_pk_num(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s jsonb := coalesce(p->'skills', '{}'::jsonb);
  n  double precision;
  bat double precision; bowl double precision; keep double precision; tech double precision; fld double precision;
  pow double precision; batScore double precision; ovr double precision;
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

  RETURN jsonb_build_object(
    'ovr', greatest(1, least(99, floor(ovr + 0.5))),
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep);
END $$;

NOTIFY pgrst, 'reload schema';
