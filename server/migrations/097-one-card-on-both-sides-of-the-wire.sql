-- 097 · ONE CARD, ON BOTH SIDES OF THE WIRE
--
-- world_pk_num is the SQL mirror of the client's card. It has been rewritten
-- five times - the club card numbers (016), the card stretch (055), the
-- all-rounder's line (057), the rounding parity (061), the inlining that saved
-- it from a search_path it could not see (062), and the star composites (082) -
-- and every one of those rewrites mirrored a JavaScript function that has now
-- been deleted.
--
-- B2 replaced the client's overall with the canonical player model: measured
-- attribute weights, role-fair normalisation, one semantic curve. It did not
-- replace this. So for the length of that commit a served card and a client
-- card DISAGREED about the same cricketer - the roster fetched from the world
-- said one number, the card drawn from his skills said another, and which one a
-- manager saw depended only on which page he opened. That is the single worst
-- kind of bug this game can have, because both numbers are the game's own.
--
-- This is the canonical model, in plpgsql, and it is a LINE-BY-LINE mirror of
-- engine/src/00-core.js rather than a second approximation of it. The old
-- function was a different formula that happened to correlate; this one is the
-- same formula. tests/canonical-card-parity.test.mjs runs the real engine and
-- this function over the same cricketers and demands EXACT agreement, across
-- four roles and the whole length of the scale.
--
-- WHY IT IS ALL INLINE, AGAIN. 062 moved a helper out and it broke: the public
-- read views call world_pk_num, plpgsql resolves a bare helper name against the
-- CALLER's search_path, and a view owned by another schema could not see it.
-- One function, no helpers, however long that makes the body. Ninety lines of
-- arithmetic in one place beats a helper that resolves differently depending on
-- who is asking.
--
-- THE CONSTANTS ARE DERIVED HERE, NOT COPIED. FO_VAL_C in the engine is
-- computed from FO_VAL_W and FO_VAL_MIX at load time rather than written down,
-- so writing 0.8295 here would be a fourth place for the model to drift. The
-- weight sums are re-summed below in the same order the engine sums them, which
-- makes the constants bit-identical rather than merely close.

CREATE OR REPLACE FUNCTION world_pk_num(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s jsonb := coalesce(p->'skills', '{}'::jsonb);
  -- the fifteen raw attributes, defaulted to nought exactly as foValSum does
  vsPace      double precision := coalesce((s->>'vsPace')::double precision, 0);
  vsSpin      double precision := coalesce((s->>'vsSpin')::double precision, 0);
  power_      double precision := coalesce((s->>'power')::double precision, 0);
  rotation    double precision := coalesce((s->>'rotation')::double precision, 0);
  temperament double precision := coalesce((s->>'temperament')::double precision, 0);
  wicket      double precision := coalesce((s->>'wicket')::double precision, 0);
  economy     double precision := coalesce((s->>'economy')::double precision, 0);
  discipline  double precision := coalesce((s->>'discipline')::double precision, 0);
  moveTurn    double precision := coalesce((s->>'moveTurn')::double precision, 0);
  variation   double precision := coalesce((s->>'variation')::double precision, 0);
  stamina     double precision := coalesce((s->>'stamina')::double precision, 0);
  fielding    double precision := coalesce((s->>'fielding')::double precision, 0);
  catching    double precision := coalesce((s->>'catching')::double precision, 0);
  keeping     double precision := coalesce((s->>'keeping')::double precision, 0);
  stumping    double precision := coalesce((s->>'stumping')::double precision, 0);

  -- FO_VAL_W, the measured weights (docs/b2-evidence/attr-value.txt)
  famBat   double precision; famBowl double precision;
  famField double precision; famGlove double precision;
  -- FO_VAL_W row sums, in the engine's own key order
  sBat   double precision := 0.185 + 0.145 + 0.150 + 0.150 + 0.060;
  sBowl  double precision := 0.415 + 0.240 + 0.140 + 0.090 + 0.060 + 0.030;
  sField double precision := 0.200 + 0.110;
  sGlove double precision := 0.226 + 0.045 + 0.030;
  -- FO_VAL_C: what each role's mixture weighs on a flat cricketer. Dividing by
  -- it is what makes a 70 bowler and a 70 batsman the same class of player.
  cBat  double precision; cBowl double precision;
  cAr   double precision; cWk   double precision;

  lBat double precision; lBowl double precision;
  lWk  double precision; lAr  double precision; lArBase double precision;
  two  double precision; lv double precision; lvl double precision;
  ovr  double precision;
  i int; a0 double precision; a1 double precision; b0 double precision; b1 double precision; f double precision;
  -- FO_OVR_ANCHORS, level -> overall
  aL double precision[] := ARRAY[0,15,25,35,45,55,65,75,82,88,93,97,100];
  aO double precision[] := ARRAY[0, 4,17,31,43,55,66,76,83,89,94,98,100];

  bat double precision; bowl double precision; keep double precision;
  tech double precision; fld double precision; pow double precision;
  batComp double precision; bowlComp double precision;
  n double precision;

  hasBowl  boolean := (p->>'bowlType') IS NOT NULL AND (p->>'bowlType') <> 'null'
                      AND (p->>'bowlType') <> 'none';
  isKeeper boolean := coalesce((p->>'keeper')::boolean, false) OR (p->>'role') = 'wicketkeeper';
BEGIN
  -- ==========================================================================
  -- THE CANONICAL OVERALL. foPlayerValue -> foOvrCurve -> foOvr.
  -- ==========================================================================
  -- foValFamilies: the four value families, summed in the engine's key order
  famBat   := 0.185 * vsPace + 0.145 * vsSpin + 0.150 * power_
            + 0.150 * rotation + 0.060 * temperament;
  famBowl  := 0.415 * wicket + 0.240 * economy + 0.140 * discipline
            + 0.090 * moveTurn + 0.060 * variation + 0.030 * stamina;
  famField := 0.200 * fielding + 0.110 * catching;
  famGlove := 0.226 * catching + 0.045 * keeping + 0.030 * stumping;

  -- FO_VAL_MIX x the row sums. The zero terms are kept so the arithmetic is
  -- the engine's arithmetic and not a tidied version of it.
  cBat  := 1.00 * sBat + 0.00 * sBowl + 0.45 * sField + 0.00 * sGlove;
  cBowl := 0.00 * sBat + 1.00 * sBowl + 0.45 * sField + 0.00 * sGlove;
  cAr   := 0.80 * sBat + 0.80 * sBowl + 0.45 * sField + 0.00 * sGlove;
  cWk   := 1.00 * sBat + 0.00 * sBowl + 0.00 * sField + 1.20 * sGlove;

  -- foValLevel for every role this cricketer could actually fill
  lBat := (1.00 * famBat + 0.00 * famBowl + 0.45 * famField + 0.00 * famGlove) / cBat;
  IF hasBowl THEN
    lBowl := (0.00 * famBat + 1.00 * famBowl + 0.45 * famField + 0.00 * famGlove) / cBowl;
  END IF;
  IF isKeeper THEN
    lWk := (1.00 * famBat + 0.00 * famBowl + 0.00 * famField + 1.20 * famGlove) / cWk;
  END IF;
  IF hasBowl THEN
    -- the bounded two-sidedness premium, tapered where there is no ladder left
    lArBase := (0.80 * famBat + 0.80 * famBowl + 0.45 * famField + 0.00 * famGlove) / cAr;
    two := least(lBat, lBowl);
    lAr := lArBase
         + 5 * least(1, greatest(0, two) / 55)
             * greatest(0, least(1, (100 - lArBase) / 25));
  END IF;

  -- BEST ROLE WINS, and ties go to the earlier role exactly as the engine's
  -- object-key walk does: bat, then bowl, then wk, then ar, each on a strict >.
  lv := lBat;
  IF hasBowl  AND lBowl > lv THEN lv := lBowl; END IF;
  IF isKeeper AND lWk   > lv THEN lv := lWk;   END IF;
  IF hasBowl  AND lAr   > lv THEN lv := lAr;   END IF;
  lvl := greatest(0, least(100, lv));

  -- foOvrCurve: piecewise-linear through FO_OVR_ANCHORS
  IF NOT (lvl > 0) THEN
    ovr := 0;
  ELSIF lvl >= 100 THEN
    ovr := 100;
  ELSE
    ovr := 100;
    FOR i IN 2 .. array_length(aL, 1) LOOP
      IF lvl <= aL[i] THEN
        a0 := aL[i - 1]; a1 := aL[i]; b0 := aO[i - 1]; b1 := aO[i];
        f := (lvl - a0) / (a1 - a0);
        ovr := b0 + f * (b1 - b0);
        EXIT;
      END IF;
    END LOOP;
  END IF;
  -- foOvr: JS Math.round is half-up, and floor(x+0.5) is that for x >= 0
  ovr := greatest(0, least(100, floor(ovr + 0.5)));

  -- A MAN KNOWN ONLY FROM A PUBLIC CARD carries the world's own overall: there
  -- are no skills to re-derive from and the served figure is canonical. Same
  -- short-circuit foOvr takes, in the same place.
  IF coalesce((p->>'__card')::boolean, false) AND coalesce((p->>'__ovr')::double precision, 0) > 0 THEN
    ovr := greatest(0, least(100, trunc((p->>'__ovr')::double precision)));
  END IF;

  -- ==========================================================================
  -- THE DISPLAY AGGREGATES. Unchanged by B2 - these are what the roster's bars
  -- read, and they are readings of one TRADE rather than opinions about a
  -- cricketer's worth. aggBat / aggBowl / aggKeep / aggTech / aggField in
  -- engine/src/00-core.js, mirrored exactly as 016 first mirrored them.
  -- ==========================================================================
  bat := floor((0.25 * vsPace + 0.25 * vsSpin + 0.20 * rotation
              + 0.15 * temperament + 0.15 * power_) + 0.5);
  IF hasBowl THEN
    bowl := floor(((wicket + economy + discipline + moveTurn + variation + stamina) / 6.0) + 0.5);
  ELSE
    -- JS: Math.round(wicket*0.3 || 5) - a zero or missing wicket falls to 5
    n := wicket * 0.3;
    bowl := floor((CASE WHEN n = 0 THEN 5 ELSE n END) + 0.5);
  END IF;
  IF isKeeper THEN
    keep := floor(((keeping + stumping + catching) / 3.0) + 0.5);
  ELSE
    keep := least(15, floor((CASE WHEN keeping = 0 THEN 8 ELSE keeping END) + 0.5));
  END IF;
  tech := floor(((vsPace + vsSpin + temperament) / 3.0) + 0.5);
  fld  := floor(((fielding + catching) / 2.0) + 0.5);
  pow  := coalesce((p->>'power')::double precision, power_);

  -- THE STAR COMPOSITES (082). Still the orders room's own arithmetic, because
  -- these rank a batting order and an attack rather than a cricketer: sixty per
  -- cent the discipline aggregate, twenty technique, twenty power. What changed
  -- in B2 is the LADDER they are drawn on - foOrdStars now puts a composite over
  -- ten the same way the card goes over ten - not the composite itself.
  batComp := 0.6 * bat + 0.2 * ((vsPace + vsSpin) / 2) + 0.2 * power_;
  bowlComp := CASE WHEN hasBowl THEN 0.6 * bowl + 0.2 * wicket + 0.2 * economy END;

  RETURN jsonb_build_object(
    'ovr', ovr,
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep,
    'batComp', batComp, 'bowlComp', bowlComp);
END $$;

-- The public read views bind world_pk_num by name at definition time, so a
-- CREATE OR REPLACE of the function is picked up by every one of them without
-- redefinition. 094 is the current world_squads and it is left exactly as it
-- is; only the number inside it has become the canonical one.

NOTIFY pgrst, 'reload schema';
