-- 094-a-life-is-not-kit.sql — THE COLD HALF OF A CRICKETER GETS ITS OWN ROW.
--
-- Measured on a settled world, forty days in: a club's squad blob is 28,555
-- bytes, and 8,663 of them - thirty per cent - are `career` and `mile`. Among
-- the men who have actually played it is thirty-six per cent. Neither field is
-- read while a match is simulated. Both grow: `mile` keeps up to sixty entries
-- and those men are six deep, so the share climbs from here rather than
-- settling, and clubs.squad is a row the umpire reads and rewrites on every
-- tick of every day.
--
-- So the past moves off the hot row. `career`, `intl` and `mile` are keyed by
-- the id a man carries (089), which is what makes this work at all: a history
-- keyed by id follows the CRICKETER, so a transfer is a squad changing and not
-- a life being copied.
--
-- THIS MIGRATION TAKES NOTHING AWAY. The table is new, the two public views
-- read the new card and fall back to the old embedded field wherever the new
-- one has not been written yet, and clubs.squad still holds everything it held
-- this morning. Backfill, then the fold, then the strip - and at every point
-- in between, both spellings answer the same.

CREATE TABLE IF NOT EXISTS player_history (
  pid        text PRIMARY KEY,
  career     jsonb NOT NULL DEFAULT '{}'::jsonb,   -- his club book
  intl       jsonb NOT NULL DEFAULT '{}'::jsonb,   -- and the one his country keeps
  mile       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- the story, newest last, capped at sixty
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE player_history IS
  'The cold half of a cricketer: what he has done, keyed by the id he carries, '
  'so it follows the man rather than the shirt. Derived - living.mjs recomputes '
  'it from the whole match record on every settle and never reads it back - so '
  'this is a read model, not a ledger. Losing it costs one settle.';

-- NO INDEX BEYOND THE KEY. Every read is "this one man", which the primary key
-- already answers; nothing sorts or filters on the jsonb, and an index over a
-- growing document would cost every settle to serve a query nobody makes.

-- ---------------------------------------------------------------------------
-- AND THE TWO PUBLIC CARDS READ THE NEW ROW FIRST, the old field second.
--
-- The coalesce is the whole migration path: before the backfill there is no
-- history row and the embedded field answers; after it both answer and agree;
-- after the strip only the row is left. No moment in that sequence has a page
-- reading a blank.
-- ---------------------------------------------------------------------------

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
                    'pid',     r.pl->>'pid',
                    'nat',     r.pl->>'nat',
                    'age',     r.pl->'age',
                    'role',    r.pl->>'role',
                    'hand',    r.pl->>'hand',
                    'bowl',    r.pl->>'btLabel',
                    'type',    r.pl->>'bowlTypeFull',
                    'bowlType',r.pl->>'bowlType',
                    'keeper',  coalesce(r.pl->'keeper', 'false'::jsonb),
                    'rating',  r.pl->'rating',
                    'ovr',     r.num->'ovr',
                    'batting', r.num->'batting',
                    'bowling', r.num->'bowling',
                    'fielding',r.num->'fielding',
                    'keeping', r.num->'keeping',
                    'batComp', r.num->'batComp',
                    'bowlComp',r.num->'bowlComp',
                    'wage',    r.pl->'wage',
                    'value',   r.pl->'fee',
                    'talents', coalesce(r.pl->'talents', '[]'::jsonb),
                    'exp',     r.pl->>'expWord',
                    'form',    r.pl->>'formWord',
                    'fatigue', r.pl->>'fatWord',
                    -- THE ROSTER STILL DRAWS HIS BOOK, and still gets it in the
                    -- one row it already fetches. What has changed is where the
                    -- database keeps it, not what a squad page receives - the
                    -- club dossier's roster and the card builder both read
                    -- `career` off this array and neither knows the difference.
                    'career',  coalesce(ph.career, r.pl->'career', '{}'::jsonb))
                  ORDER BY (r.num->>'ovr')::numeric DESC, (r.pl->>'rating')::numeric DESC)
             FROM ranked r
             LEFT JOIN player_history ph ON ph.pid = r.pl->>'pid'
            WHERE r.country_id = cl.country_id AND r.slot = cl.slot
         ), '[]'::jsonb) AS players,
         coalesce((SELECT sum(coalesce((p->>'wage')::numeric, 0)) FROM jsonb_array_elements(cl.squad) p), 0) AS wage_bill,
         coalesce((SELECT round(avg((num->>'batting')::numeric)) FROM ranked r
                    WHERE r.country_id = cl.country_id AND r.slot = cl.slot AND r.bat_rank <= 7), 0) AS team_batting,
         coalesce((SELECT round(avg((num->>'bowling')::numeric)) FROM ranked r
                    WHERE r.country_id = cl.country_id AND r.slot = cl.slot AND r.bowl_rank <= 5), 0) AS team_bowling,
         coalesce((SELECT round(avg((num->>'fielding')::numeric)) FROM ranked r
                    WHERE r.country_id = cl.country_id AND r.slot = cl.slot), 0) AS team_fielding
    FROM clubs cl;


-- ONE CRICKETER, WITH HIS HISTORY - now read from the card that holds it.
DROP VIEW IF EXISTS public.world_player_profile;
CREATE VIEW public.world_player_profile AS
  SELECT cl.country_id, cl.slot, cl.name AS club,
         p->>'pid'  AS pid,
         p->>'name' AS name,
         coalesce(ph.mile,   p->'mile',   '[]'::jsonb) AS mile,
         coalesce(ph.career, p->'career', '{}'::jsonb) AS career
    FROM clubs cl, jsonb_array_elements(cl.squad) p
    LEFT JOIN player_history ph ON ph.pid = p->>'pid'
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
