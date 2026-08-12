-- 090-the-public-card-says-who-he-is.sql — THE ID TRAVELS WITH THE MAN.
--
-- world_squads is the public card: what anybody may know about anybody's
-- cricketers, built field by field so nothing private can leak by accident.
-- Which also means a field it does not name does not exist to any reader.
--
-- 089 gave every cricketer an id, and the fifteen his country picks now
-- records it - but the rooms that draw a rival's squad read them from HERE,
-- and this card sent a name and no identity. So those rooms fell back to
-- club-and-name, which is right until two men at one club share a name, and
-- in the smaller name banks they do.
--
-- Same view, one more field, nothing else touched.

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
                    -- WHO HE IS, alongside what he is called. Every surface
                    -- that draws a rival's men off this card - his dossier,
                    -- his own page, the ratings panel, the build-up - marks
                    -- the internationals among them, and a name cannot tell
                    -- two cricketers apart.
                    'pid',     r.pl->>'pid',
                    'nat',     r.pl->>'nat',
                    'age',     r.pl->'age',
                    'role',    r.pl->>'role',
                    'hand',    r.pl->>'hand',
                    'bowl',    r.pl->>'btLabel',
                    'type',    r.pl->>'bowlTypeFull',
                    -- the engine's own key for his craft, which is what the
                    -- roster reads to decide whether his stars are bat or ball
                    'bowlType',r.pl->>'bowlType',
                    'keeper',  coalesce(r.pl->'keeper', 'false'::jsonb),
                    'rating',  r.pl->'rating',
                    'ovr',     r.num->'ovr',
                    'batting', r.num->'batting',
                    'bowling', r.num->'bowling',
                    'fielding',r.num->'fielding',
                    -- AND THE GLOVES. world_pk_num has always worked out a
                    -- keeper's keeping and this view has never sent it, so a
                    -- cricketer read off the public card had his gloves set to
                    -- his ground fielding - which is not the same number and is
                    -- usually a good deal lower. Every surface that reads a
                    -- rival's men reads it: his own page, the roster, and the
                    -- match ratings panel, which marks Fielding/Keeping with
                    -- the keeper weighted above the ten in front of him.
                    'keeping', r.num->'keeping',
                    'batComp', r.num->'batComp',
                    'bowlComp',r.num->'bowlComp',
                    'wage',    r.pl->'wage',
                    'value',   r.pl->'fee',
                    'talents', coalesce(r.pl->'talents', '[]'::jsonb),
                    'exp',     r.pl->>'expWord',
                    'form',    r.pl->>'formWord',
                    'fatigue', r.pl->>'fatWord',
                    'mile',    coalesce(r.pl->'mile', '[]'::jsonb),
                    'career',  coalesce(r.pl->'career', '{}'::jsonb))
                  ORDER BY (r.num->>'ovr')::numeric DESC, (r.pl->>'rating')::numeric DESC)
             FROM ranked r WHERE r.country_id = cl.country_id AND r.slot = cl.slot
         ), '[]'::jsonb) AS players,
         coalesce((SELECT sum(coalesce((p->>'wage')::numeric, 0)) FROM jsonb_array_elements(cl.squad) p), 0) AS wage_bill,
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
