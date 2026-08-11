-- 084 · THE HANDS GET THEIR OWN SCALE
--
-- Every cricketer in the world was dealt his fielding as a shadow of his
-- batting and then had it pressed flat twice over - once by the generator's
-- equal-budget pass and once by calibration, both of which multiplied EVERY
-- skill a man has to seat his club on its rung, including the four that have
-- nothing to do with how hard he is to bowl at.
--
-- The result was a world whose fielding ran from 20 to 56 with a median of 35,
-- against ground-fielding thresholds asking for 58 and 64. Nobody could reach
-- them. No cricketer in the history of this game had ever saved a boundary,
-- "Great fielding" was a filter that could never have content, and the field
-- could only ever err: nine mistakes an innings and not one good piece.
--
-- The engine deals the hands on their own bell now, and holds them out of both
-- scaling passes. This brings the men who already exist onto that scale.
--
-- IT IS A STRETCH, NOT A RE-ROLL. The map is monotone, so every ranking in the
-- world survives it: your best fielder is still your best fielder, he is a 79
-- instead of a 56. Nobody's career, form, contract or identity is touched -
-- only the four numbers, and only once.
--
-- The gloves are stretched on a different line from the outfield, and only for
-- men who actually keep. A number eleven's keeping of 6 is not a compressed
-- score, it is the truth about him, and lifting it would hand every side a
-- second wicketkeeper it never signed.
CREATE OR REPLACE FUNCTION world_stretch_hands(sk jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN sk IS NULL OR jsonb_typeof(sk) <> 'object' THEN sk ELSE
    sk
    || CASE WHEN sk ? 'fielding' THEN jsonb_build_object('fielding',
         greatest(2, least(99, round(50 + ((sk->>'fielding')::numeric - 36) * 1.44)))) ELSE '{}'::jsonb END
    || CASE WHEN sk ? 'catching' THEN jsonb_build_object('catching',
         greatest(2, least(99, round(50 + ((sk->>'catching')::numeric - 36) * 1.44)))) ELSE '{}'::jsonb END
    -- a man who keeps: 20 and above on the old scale is a gloveman, below it is
    -- a batsman who has never worn a pair
    || CASE WHEN sk ? 'keeping' AND (sk->>'keeping')::numeric >= 20 THEN jsonb_build_object('keeping',
         greatest(2, least(99, round(50 + ((sk->>'keeping')::numeric - 40) * 1.30)))) ELSE '{}'::jsonb END
    || CASE WHEN sk ? 'stumping' AND (sk->>'stumping')::numeric >= 18 THEN jsonb_build_object('stumping',
         greatest(2, least(99, round(46 + ((sk->>'stumping')::numeric - 37) * 1.30)))) ELSE '{}'::jsonb END
  END
$$;

-- one man, stretched; anything that is not a player object passes through
CREATE OR REPLACE FUNCTION world_stretch_man(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p IS NULL OR jsonb_typeof(p) <> 'object' OR NOT (p ? 'skills') THEN p
              ELSE jsonb_set(p, '{skills}', world_stretch_hands(p->'skills')) END
$$;

-- a squad, in its own order
CREATE OR REPLACE FUNCTION world_stretch_squad(sq jsonb)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN sq IS NULL OR jsonb_typeof(sq) <> 'array' THEN sq ELSE
    coalesce((SELECT jsonb_agg(world_stretch_man(p) ORDER BY ord)
                FROM jsonb_array_elements(sq) WITH ORDINALITY AS t(p, ord)), sq) END
$$;

-- EVERY PLACE A CRICKETER IS KEPT. The national fifteens and the club dossiers
-- are rebuilt from clubs on the next tick, so they follow on their own; these
-- four are the ones that hold a man's skills durably.
UPDATE clubs SET squad = world_stretch_squad(squad);

DO $$
BEGIN
  IF to_regclass('world.listings') IS NOT NULL THEN
    EXECUTE 'UPDATE listings SET player_json = world_stretch_man(player_json)
              WHERE player_json ? ''skills''';
  END IF;
  IF to_regclass('world.academy_candidates') IS NOT NULL THEN
    EXECUTE 'UPDATE academy_candidates SET recruit = world_stretch_man(recruit)
              WHERE recruit ? ''skills''';
  END IF;
  IF to_regclass('world.nat_squad') IS NOT NULL THEN
    EXECUTE 'UPDATE nat_squad SET squad = world_stretch_squad(squad)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
