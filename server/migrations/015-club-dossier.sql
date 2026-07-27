-- 015-club-dossier.sql — WHAT A RIVAL IS ALLOWED TO KNOW ABOUT A CLUB
--
-- Scouting used to be a locked door: a club's page could show its name, its
-- ground and its league position, and nothing else. That made every rival a
-- blank, and a league of blanks has no strategy in it - you cannot fear a
-- side you know nothing about, or plan a season around one.
--
-- So the squad list becomes public, the way a real county's does: who plays
-- for them, how old, what they cost, which hand, what they bowl, what the
-- game has made of them, and what their careers say. What stays private is
-- the coaching sheet - the fifteen raw skill numbers, the training plan and
-- the progress toward the next jump. You can see that a man is a fine fast
-- bowler; you cannot read his exact economy rating over the fence.
--
-- One view, filterable by country and slot, so a page costs one small
-- request (~3 KB) instead of a match blob.

CREATE OR REPLACE VIEW public.world_squads AS
  SELECT cl.country_id, cl.slot, cl.name,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
                    'name',    p->>'name',
                    'nat',     p->>'nat',
                    'age',     p->'age',
                    'role',    p->>'role',
                    'hand',    p->>'hand',
                    'bowl',    p->>'btLabel',
                    'type',    p->>'bowlTypeFull',
                    'keeper',  coalesce(p->'keeper', 'false'::jsonb),
                    'rating',  p->'rating',
                    'wage',    p->'wage',
                    'value',   p->'fee',
                    'talents', coalesce(p->'talents', '[]'::jsonb),
                    'exp',     p->>'expWord',
                    'form',    p->>'formWord',
                    'fatigue', p->>'fatWord',
                    'career',  coalesce(p->'career', '{}'::jsonb))
                  ORDER BY coalesce((p->>'rating')::numeric, 0) DESC)
             FROM jsonb_array_elements(cl.squad) p
            WHERE p->>'name' IS NOT NULL
         ), '[]'::jsonb) AS players,
         coalesce((
           SELECT sum(coalesce((p->>'wage')::numeric, 0))
             FROM jsonb_array_elements(cl.squad) p
         ), 0) AS wage_bill
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
