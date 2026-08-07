-- 061-card-parity.sql — THE SERVED CARD AND THE ENGINE AGREE TO THE POINT.
--
-- world_pk_num is the SQL mirror of foPkOvr: the same overall, computed at the
-- database so a page can read a card without shipping a man's skills. p3 has
-- always asserted the two produce the SAME number for every player, and they
-- did - until a squad happened to contain a man who lands exactly on a
-- rounding boundary. Then one opener came back 67 from the engine and 68 from
-- the database.
--
-- The cause is arithmetic, not cricket. The function did its sums in NUMERIC,
-- which Postgres evaluates in exact decimal and rounds half AWAY FROM ZERO.
-- The engine does them in JavaScript doubles, where the same expression lands
-- on 66.4999999999999 rather than 66.5, and Math.round takes it down. Exact
-- and inexact disagreeing about a half is a classic, and it was waiting in
-- here for whichever cricketer first landed on one.
--
-- The engine is the authority - it is what actually plays the game - so the
-- database now imitates it exactly: every sum in double precision, and
-- world_js_round() for the rounding, because Postgres's own round(double) is
-- banker's rounding (half to EVEN) and would have disagreed a different way.
-- floor(x + 0.5) is what Math.round does for a positive number, which every
-- figure on a card is.
CREATE OR REPLACE FUNCTION world_js_round(v double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT floor(v + 0.5)
$$;

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
  bat := world_js_round(0.25 * coalesce((s->>'vsPace')::double precision, 0)
             + 0.25 * coalesce((s->>'vsSpin')::double precision, 0)
             + 0.20 * coalesce((s->>'rotation')::double precision, 0)
             + 0.15 * coalesce((s->>'temperament')::double precision, 0)
             + 0.15 * coalesce((s->>'power')::double precision, 0));
  IF hasBowl THEN
    bowl := world_js_round((coalesce((s->>'wicket')::double precision, 0) + coalesce((s->>'economy')::double precision, 0)
                 + coalesce((s->>'discipline')::double precision, 0) + coalesce((s->>'moveTurn')::double precision, 0)
                 + coalesce((s->>'variation')::double precision, 0) + coalesce((s->>'stamina')::double precision, 0)) / 6.0);
  ELSE
    -- JS: Math.round(wicket*0.3 || 5) - a zero or missing wicket falls to 5
    n := coalesce((s->>'wicket')::double precision, 0) * 0.3;
    bowl := world_js_round(CASE WHEN n = 0 THEN 5 ELSE n END);
  END IF;
  IF isKeeper THEN
    keep := world_js_round((coalesce((s->>'keeping')::double precision, 0) + coalesce((s->>'stumping')::double precision, 0)
                 + coalesce((s->>'catching')::double precision, 0)) / 3.0);
  ELSE
    n := coalesce((s->>'keeping')::double precision, 0);
    keep := least(15, world_js_round(CASE WHEN n = 0 THEN 8 ELSE n END));
  END IF;
  tech := world_js_round((coalesce((s->>'vsPace')::double precision, 0) + coalesce((s->>'vsSpin')::double precision, 0)
               + coalesce((s->>'temperament')::double precision, 0)) / 3.0);
  fld  := world_js_round((coalesce((s->>'fielding')::double precision, 0) + coalesce((s->>'catching')::double precision, 0)) / 2.0);
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
    'ovr', greatest(1, least(99, world_js_round(ovr))),
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep);
END $$;

NOTIFY pgrst, 'reload schema';
