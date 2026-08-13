-- 093-the-roster-is-not-a-biography.sql — WHAT A SQUAD PAGE ACTUALLY NEEDS.
--
-- world_squads is the public card, and it sent every man's whole life with it.
-- Measured on the live world: 1,048 bytes a cricketer, of which 448 - forty
-- three per cent - is `mile`, the list of every milestone he has ever passed.
-- A roster draws none of it. It draws his name, his numbers and his form; the
-- milestones belong to ONE screen, his own page, and only when somebody opens
-- it.
--
-- So a club's card stops carrying fifteen biographies. `career` stays - it is
-- 186 bytes and the roster does read it - and `mile` moves to a card of its
-- own, world_player_profile, which serves one cricketer at a time to the page
-- that actually shows him.
--
-- NOTHING ABOUT THE SIMULATION MOVES. clubs.squad is untouched, the fold is
-- untouched, and every milestone is still computed and stored exactly as it
-- was. This is a change to what leaves the database, not to what is in it.

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


-- ONE CRICKETER, WITH HIS HISTORY. Row per man rather than per club, keyed by
-- the id he carries (089) so a page can ask for exactly the man it is showing
-- and two men of one name cannot be confused for each other. Same public
-- discipline as the card above: built field by field, so nothing private can
-- leak by accident.
DROP VIEW IF EXISTS public.world_player_profile;
CREATE VIEW public.world_player_profile AS
  SELECT cl.country_id, cl.slot, cl.name AS club,
         p->>'pid'  AS pid,
         p->>'name' AS name,
         coalesce(p->'mile',   '[]'::jsonb) AS mile,
         coalesce(p->'career', '{}'::jsonb) AS career
    FROM clubs cl, jsonb_array_elements(cl.squad) p
   WHERE p->>'name' IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_squads TO authenticated;
    GRANT SELECT ON public.world_player_profile TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_squads TO anon;
    GRANT SELECT ON public.world_player_profile TO anon;
  END IF;
END $$;
