-- 102-the-card-is-what-he-is-worth-today.sql
--
-- THE SQL MIRROR OF THE CARD, PUT BACK ON THE ENGINE'S LAW.
--
-- world_pk_num is a database-side reimplementation of foPlayerValue, kept so a
-- roster can be served without waking a VM, and
-- server/tests/canonical-card-parity.test.mjs holds the two to the same answer
-- on the same cricketer. The player-value overhaul moved every weight, both
-- role mixtures and the meaning of the card itself, so the mirror stopped
-- agreeing: measured on ten dealt batsmen the SQL said 21,21,20,21,20,... and
-- the engine 21,21,20,20,20,...
--
-- This is the mirror catching up. Nothing here is a decision - every number is
-- copied from FO_VAL_W, FO_VAL_MIX and foExpLevelBonus in engine/src/00-core.js,
-- which are the authority, and the parity test is what keeps them honest.
--
-- 099 is not edited. It is immutable, as every applied migration is; this
-- redefines the function in a new numbered file, which is the repo's way.

CREATE OR REPLACE FUNCTION world_pk_num(p jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  s jsonb := coalesce(p->'skills', '{}'::jsonb);
  -- ---- THE LATENT/EFFECTIVE TRANSFORM (foEff) ----------------------------
  -- effective(v) = v                                   v <= 99
  --              = 99 + S * ln(1 + (v-99)/S)           v >  99
  -- monotone, continuous, derivative exactly 1 at the knee so nothing kinks,
  -- and unbounded - there is no plateau in it, only diminishing returns. S is
  -- per family because the frozen ball model runs out of domain at different
  -- heights: 16 for batting and bowling, 4 for ground fielding (whose spatial
  -- contest is spent by 100), 12 for the gloves (which enter ballDist as a
  -- LINEAR term in log-odds and would otherwise go off).
  knee   double precision := 99;
  latmax double precision := 250;   -- corruption bound, not a cricket ceiling
  sCore  double precision := 16;
  sField double precision := 4;
  sGlove double precision := 12;

  vsPace      double precision; vsSpin   double precision; power_   double precision;
  rotation    double precision; temperament double precision;
  wicket      double precision; economy  double precision; discipline double precision;
  moveTurn    double precision; variation double precision; stamina double precision;
  fielding    double precision; catching double precision;
  keeping     double precision; stumping double precision;
  -- and the LATENT values, which the display aggregates still read: a card
  -- shows a man the number stored on him, not the number the engine spends.
  lvsPace     double precision := coalesce((s->>'vsPace')::double precision, 0);
  lvsSpin     double precision := coalesce((s->>'vsSpin')::double precision, 0);
  lpower      double precision := coalesce((s->>'power')::double precision, 0);
  lrotation   double precision := coalesce((s->>'rotation')::double precision, 0);
  ltemperament double precision := coalesce((s->>'temperament')::double precision, 0);
  lwicket     double precision := coalesce((s->>'wicket')::double precision, 0);
  leconomy    double precision := coalesce((s->>'economy')::double precision, 0);
  ldiscipline double precision := coalesce((s->>'discipline')::double precision, 0);
  lmoveTurn   double precision := coalesce((s->>'moveTurn')::double precision, 0);
  lvariation  double precision := coalesce((s->>'variation')::double precision, 0);
  lstamina    double precision := coalesce((s->>'stamina')::double precision, 0);
  lfielding   double precision := coalesce((s->>'fielding')::double precision, 0);
  lcatching   double precision := coalesce((s->>'catching')::double precision, 0);
  lkeeping    double precision := coalesce((s->>'keeping')::double precision, 0);
  lstumping   double precision := coalesce((s->>'stumping')::double precision, 0);

  famBat   double precision; famBowl double precision;
  famField double precision; famGlove double precision;
  sBat   double precision := 0.169 + 0.111 + 0.137 + 0.165 + 0.104;
  sBowl  double precision := 0.368 + 0.287 + 0.088 + 0.029 + 0.042 + 0.026;
  sFieldW double precision := 0.077 + 0.029;
  sGloveW double precision := 0.230 + 0.021 + 0.018;
  cBat  double precision; cBowl double precision;
  cAr   double precision; cWk   double precision;

  lBat double precision; lBowl double precision;
  lWk  double precision; lAr  double precision; lArBase double precision;
  two  double precision; lv double precision; lvl double precision;
  ovr  double precision;
  i int; a0 double precision; a1 double precision; b0 double precision; b1 double precision; f double precision;
  -- FO_OVR_ANCHORS, which now STOP at [93,94]; above that the tail takes over
  aL double precision[] := ARRAY[0,15,25,35,45,55,65,75,82,88,93];
  aO double precision[] := ARRAY[0, 4,17,31,43,55,66,76,83,89,94];
  tailL double precision := 93;    -- FO_OVR_TAIL_L
  tailO double precision := 94;    -- FO_OVR_TAIL_O
  tailS double precision := 6;     -- FO_OVR_TAIL_S

  bat double precision; bowl double precision; keep double precision;
  tech double precision; fld double precision; pow double precision;
  batComp double precision; bowlComp double precision;
  n double precision;

  hasBowl  boolean := (p->>'bowlType') IS NOT NULL AND (p->>'bowlType') <> 'null'
                      AND (p->>'bowlType') <> 'none';
  isKeeper boolean := coalesce((p->>'keeper')::boolean, false) OR (p->>'role') = 'wicketkeeper';
BEGIN
  -- foEff, inline per attribute. `least(v, latmax)` is the corruption guard and
  -- nothing else: no legitimate cricketer comes within a hundred points of it.
  vsPace      := CASE WHEN lvsPace      > knee THEN knee + sCore  * ln(1 + (least(lvsPace,      latmax) - knee) / sCore)  ELSE lvsPace      END;
  vsSpin      := CASE WHEN lvsSpin      > knee THEN knee + sCore  * ln(1 + (least(lvsSpin,      latmax) - knee) / sCore)  ELSE lvsSpin      END;
  power_      := CASE WHEN lpower       > knee THEN knee + sCore  * ln(1 + (least(lpower,       latmax) - knee) / sCore)  ELSE lpower       END;
  rotation    := CASE WHEN lrotation    > knee THEN knee + sCore  * ln(1 + (least(lrotation,    latmax) - knee) / sCore)  ELSE lrotation    END;
  temperament := CASE WHEN ltemperament > knee THEN knee + sCore  * ln(1 + (least(ltemperament, latmax) - knee) / sCore)  ELSE ltemperament END;
  wicket      := CASE WHEN lwicket      > knee THEN knee + sCore  * ln(1 + (least(lwicket,      latmax) - knee) / sCore)  ELSE lwicket      END;
  economy     := CASE WHEN leconomy     > knee THEN knee + sCore  * ln(1 + (least(leconomy,     latmax) - knee) / sCore)  ELSE leconomy     END;
  discipline  := CASE WHEN ldiscipline  > knee THEN knee + sCore  * ln(1 + (least(ldiscipline,  latmax) - knee) / sCore)  ELSE ldiscipline  END;
  moveTurn    := CASE WHEN lmoveTurn    > knee THEN knee + sCore  * ln(1 + (least(lmoveTurn,    latmax) - knee) / sCore)  ELSE lmoveTurn    END;
  variation   := CASE WHEN lvariation   > knee THEN knee + sCore  * ln(1 + (least(lvariation,   latmax) - knee) / sCore)  ELSE lvariation   END;
  stamina     := CASE WHEN lstamina     > knee THEN knee + sCore  * ln(1 + (least(lstamina,     latmax) - knee) / sCore)  ELSE lstamina     END;
  fielding    := CASE WHEN lfielding    > knee THEN knee + sField * ln(1 + (least(lfielding,    latmax) - knee) / sField) ELSE lfielding    END;
  catching    := CASE WHEN lcatching    > knee THEN knee + sGlove * ln(1 + (least(lcatching,    latmax) - knee) / sGlove) ELSE lcatching    END;
  keeping     := CASE WHEN lkeeping     > knee THEN knee + sGlove * ln(1 + (least(lkeeping,     latmax) - knee) / sGlove) ELSE lkeeping     END;
  stumping    := CASE WHEN lstumping    > knee THEN knee + sGlove * ln(1 + (least(lstumping,    latmax) - knee) / sGlove) ELSE lstumping    END;

  -- ==========================================================================
  -- THE CANONICAL OVERALL. foPlayerValue -> foOvrCurve -> foOvr.
  -- ==========================================================================
  famBat   := 0.169 * vsPace + 0.111 * vsSpin + 0.137 * power_
            + 0.165 * rotation + 0.104 * temperament;
  famBowl  := 0.368 * wicket + 0.287 * economy + 0.088 * discipline
            + 0.029 * moveTurn + 0.042 * variation + 0.026 * stamina;
  famField := 0.077 * fielding + 0.029 * catching;
  famGlove := 0.230 * catching + 0.021 * keeping + 0.018 * stumping;

  cBat  := 1.00 * sBat + 0.00 * sBowl + 1.00 * sFieldW + 0.00 * sGloveW;
  cBowl := 0.00 * sBat + 1.00 * sBowl + 1.00 * sFieldW + 0.00 * sGloveW;
  cAr   := 0.80 * sBat + 0.80 * sBowl + 1.00 * sFieldW + 0.00 * sGloveW;
  cWk   := 1.00 * sBat + 0.00 * sBowl + 0.00 * sFieldW + 1.80 * sGloveW;

  lBat := (1.00 * famBat + 0.00 * famBowl + 1.00 * famField + 0.00 * famGlove) / cBat;
  IF hasBowl THEN
    lBowl := (0.00 * famBat + 1.00 * famBowl + 1.00 * famField + 0.00 * famGlove) / cBowl;
  END IF;
  IF isKeeper THEN
    lWk := (1.00 * famBat + 0.00 * famBowl + 0.00 * famField + 1.80 * famGlove) / cWk;
  END IF;
  IF hasBowl THEN
    lArBase := (0.80 * famBat + 0.80 * famBowl + 1.00 * famField + 0.00 * famGlove) / cAr;
    two := least(lBat, lBowl);
    lAr := lArBase
         + 5 * least(1, greatest(0, two) / 55)
             * greatest(0, least(1, (100 - lArBase) / 25));
  END IF;

  lv := lBat;
  IF hasBowl  AND lBowl > lv THEN lv := lBowl; END IF;
  IF isKeeper AND lWk   > lv THEN lv := lWk;   END IF;
  IF hasBowl  AND lAr   > lv THEN lv := lAr;   END IF;
  -- NOT least(100) any more. The level is an internal coordinate with no
  -- maximum; keeping the card inside 0-100 is the curve's job below.
  lvl := greatest(0, lv);

  -- CURRENT PLAYING VALUE. The card is what a cricketer is worth in today's
  -- cricket, which is his ability plus the experience he has actually
  -- accumulated; `lvl` above stays INTRINSIC because that is the coordinate
  -- generation targets. Measured over three seats at 600 paired matches a
  -- cell: 0.0401 +- 0.0087 runs a point, converted at 1.2 runs per overall and
  -- capped at two levels either way. Captaincy is deliberately absent - it is
  -- worth exactly 0.00 +- 0.00 to a man who is not wearing the armband.
  IF (p->>'exp') IS NOT NULL THEN
    lvl := lvl + greatest(-2.0, least(2.0,
             ((p->>'exp')::double precision - 50) * 0.0401 / 1.2));
    lvl := greatest(0, lvl);
  END IF;

  -- foOvrCurve: piecewise-linear through the anchors, then an exponential
  -- approach to 100 that never arrives
  IF NOT (lvl > 0) THEN
    ovr := 0;
  ELSIF lvl > tailL THEN
    ovr := 100 - (100 - tailO) * exp(-(lvl - tailL) / tailS);
  ELSE
    ovr := tailO;
    FOR i IN 2 .. array_length(aL, 1) LOOP
      IF lvl <= aL[i] THEN
        a0 := aL[i - 1]; a1 := aL[i]; b0 := aO[i - 1]; b1 := aO[i];
        f := (lvl - a0) / (a1 - a0);
        ovr := b0 + f * (b1 - b0);
        EXIT;
      END IF;
    END LOOP;
  END IF;
  ovr := greatest(0, least(100, floor(ovr + 0.5)));

  IF coalesce((p->>'__card')::boolean, false) AND coalesce((p->>'__ovr')::double precision, 0) > 0 THEN
    ovr := greatest(0, least(100, trunc((p->>'__ovr')::double precision)));
  END IF;

  -- ==========================================================================
  -- THE DISPLAY AGGREGATES, and they read the LATENT numbers.
  --
  -- This is deliberate and it is the one place the two scales are visibly
  -- different. A card's Batting bar is a reading of the fifteen numbers printed
  -- underneath it, so it has to be the arithmetic of those numbers or the row
  -- and its total disagree in front of the reader. The OVERALL is a different
  -- kind of claim - what his cricket is worth - and is priced in what the
  -- engine can spend. A man with rotation 108 shows 108 and is paid for about
  -- 105 of it.
  -- ==========================================================================
  bat := floor((0.25 * lvsPace + 0.25 * lvsSpin + 0.20 * lrotation
              + 0.15 * ltemperament + 0.15 * lpower) + 0.5);
  IF hasBowl THEN
    bowl := floor(((lwicket + leconomy + ldiscipline + lmoveTurn + lvariation + lstamina) / 6.0) + 0.5);
  ELSE
    n := lwicket * 0.3;
    bowl := floor((CASE WHEN n = 0 THEN 5 ELSE n END) + 0.5);
  END IF;
  IF isKeeper THEN
    keep := floor(((lkeeping + lstumping + lcatching) / 3.0) + 0.5);
  ELSE
    keep := least(15, floor((CASE WHEN lkeeping = 0 THEN 8 ELSE lkeeping END) + 0.5));
  END IF;
  tech := floor(((lvsPace + lvsSpin + ltemperament) / 3.0) + 0.5);
  fld  := floor(((lfielding + lcatching) / 2.0) + 0.5);
  pow  := coalesce((p->>'power')::double precision, lpower);

  -- the trade strips: a card for ONE trade, through the same curve
  batComp := 100;
  IF NOT (lBat > 0) THEN batComp := 0;
  ELSIF lBat > tailL THEN
    batComp := 100 - (100 - tailO) * exp(-(lBat - tailL) / tailS);
  ELSE
    FOR i IN 2 .. array_length(aL, 1) LOOP
      IF lBat <= aL[i] THEN
        batComp := aO[i - 1] + ((lBat - aL[i - 1]) / (aL[i] - aL[i - 1])) * (aO[i] - aO[i - 1]);
        EXIT;
      END IF;
    END LOOP;
  END IF;
  bowlComp := NULL;
  IF hasBowl THEN
    bowlComp := 100;
    IF NOT (lBowl > 0) THEN bowlComp := 0;
    ELSIF lBowl > tailL THEN
      bowlComp := 100 - (100 - tailO) * exp(-(lBowl - tailL) / tailS);
    ELSE
      FOR i IN 2 .. array_length(aL, 1) LOOP
        IF lBowl <= aL[i] THEN
          bowlComp := aO[i - 1] + ((lBowl - aL[i - 1]) / (aL[i] - aL[i - 1])) * (aO[i] - aO[i - 1]);
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ovr', ovr,
    'batting', bat, 'bowling', bowl, 'fielding', fld, 'keeping', keep,
    'batComp', batComp, 'bowlComp', bowlComp);
END $$;

-- The public read views bind world_pk_num by name at definition time, so a
-- CREATE OR REPLACE is picked up by every one of them without redefinition.

NOTIFY pgrst, 'reload schema';
