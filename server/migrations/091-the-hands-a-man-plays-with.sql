-- 091-the-hands-a-man-plays-with.sql — THE NUMBER THE ENGINE FIELDS WITH
-- FOLLOWS THE SKILL, AND SURVIVES A REFOLD.
--
-- 084 put the world's hands on a real scale. It rewrote p.skills.fielding and
-- p.skills.catching, which is what every CARD in the game reads - and the
-- cards duly show a healthy world: the men on the open market average 55 for
-- fielding, better than a club founded today.
--
-- The cricket did not agree. Pulled from the banked ball-by-ball of seven
-- friendlies on the live world: THREE good pieces of fielding against 117
-- misfields and 19 drops. A manager watching one of them saw twelve misfields
-- and not a single good stop.
--
-- Two things 084 did not reach, and either one is enough to do that.
--
-- THE DERIVED NUMBER. A cricketer carries his hands twice: in p.skills, and
-- again at the top level as p.field and p.keeping, which jsDerive mirrors out
-- of the skills when a man is made. The ball engine reads the TOP LEVEL first
--   foFieldSkill(p) = p.field || p.skills.fielding || 50
-- so a man whose p.skills.fielding was lifted and whose p.field was not goes
-- on fielding at the old number for ever, while every page in the game shows
-- him the new one. 084 rewrote the skills only.
--
-- THE BASELINE. The nets are a derivation: living.mjs rebuilds a squad from
-- p.baseSkills and replays every round of training it has genuinely done. No
-- migration has ever touched baseSkills - not this one's ancestor, not any of
-- them - so the first refold after a skills-only migration throws it away and
-- restores the pre-migration man. Reproduced on a founded world: stretch a
-- squad to 69.8, one refold, back to 49.7.
--
-- So: the top-level hands are re-derived from the skills, and the four hand
-- values in the baseline are brought onto the same scale as the skills they
-- are the baseline FOR.
--
-- WHAT THAT COSTS, said plainly: a man who has genuinely trained his fielding
-- has that gain folded into his baseline instead of replayed out of it. He
-- keeps every point - nobody gets worse - but the nets book stops crediting
-- those points to the sessions that earned them. It is a small bill: of the
-- six programmes the world's bots are assigned, four carry no fielding weight
-- at all, so there is almost nothing banked to lose. The alternative is
-- guessing which men predate 084 and stretching only those, and a wrong guess
-- there doubles a man's hands.
--
-- IDEMPOTENT. Run it twice and the second run changes nothing: it only ever
-- copies skills onto the two places that should already agree with them.

CREATE OR REPLACE FUNCTION world_sync_hands(p jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'object' OR NOT (p ? 'skills')
      OR jsonb_typeof(p -> 'skills') <> 'object' THEN p
    ELSE p
      -- the top level mirrors the skill, which is what jsDerive does when a
      -- cricketer is made and what nothing did after he was rescaled
      || CASE WHEN p -> 'skills' ? 'fielding'
              THEN jsonb_build_object('field', p -> 'skills' -> 'fielding')
              ELSE '{}'::jsonb END
      || CASE WHEN p -> 'skills' ? 'keeping'
              THEN jsonb_build_object('keeping', p -> 'skills' -> 'keeping')
              ELSE '{}'::jsonb END
      -- and the baseline the nets replay from carries the same scale, so the
      -- next refold cannot hand back the man from before the rescaling
      || CASE WHEN p ? 'baseSkills' AND jsonb_typeof(p -> 'baseSkills') = 'object'
              THEN jsonb_build_object('baseSkills', (p -> 'baseSkills')
                || (SELECT coalesce(jsonb_object_agg(k, p -> 'skills' -> k), '{}'::jsonb)
                      FROM unnest(ARRAY['fielding','catching','keeping','stumping']) AS k
                     WHERE p -> 'skills' ? k))
              ELSE '{}'::jsonb END
  END
$$;

CREATE OR REPLACE FUNCTION world_sync_squad(sq jsonb)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN sq IS NULL OR jsonb_typeof(sq) <> 'array' THEN sq ELSE
    coalesce((SELECT jsonb_agg(world_sync_hands(p) ORDER BY ord)
                FROM jsonb_array_elements(sq) WITH ORDINALITY AS t(p, ord)), sq) END
$$;

-- every place a cricketer is kept durably, the same four 084 reached
UPDATE clubs SET squad = world_sync_squad(squad);
UPDATE clubs SET youth = world_sync_squad(youth) WHERE youth IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('world.listings') IS NOT NULL THEN
    EXECUTE 'UPDATE listings SET player_json = world_sync_hands(player_json)
              WHERE player_json ? ''skills''';
  END IF;
  IF to_regclass('world.academy_candidates') IS NOT NULL THEN
    EXECUTE 'UPDATE academy_candidates SET recruit = world_sync_hands(recruit)
              WHERE recruit ? ''skills''';
  END IF;
  IF to_regclass('world.nat_squad') IS NOT NULL THEN
    EXECUTE 'UPDATE nat_squad SET squad = world_sync_squad(squad)';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
