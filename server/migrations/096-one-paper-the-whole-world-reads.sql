-- 096-one-paper-the-whole-world-reads.sql — THE GAZETTE GETS A PRESS.
--
-- The paper has been a club bulletin dressed as a newspaper. Its lead was the
-- reader's own last match, read off HIS device's save, and the wire beside it
-- came from module 27's client-derived planet - a world that is a pure
-- function of the UTC date and has nothing to do with the one the umpire
-- actually plays. Nothing in the client reads world_nat_matches at all, so the
-- internationals this server plays every window appear on no page in the game.
--
-- So the paper is printed HERE, once a world day, from the served record, and
-- every phone fetches the same row. That is the whole of "the same paper for
-- everyone": not two clients agreeing, but one paper existing.
--
-- ONE ROW. Today only, overwritten daily - no archive was asked for and an
-- archive is how a table grows without bound, which is what the last two
-- phases were spent removing. The day is on the row so a reader who opens a
-- stale cache can tell.
--
-- The page writes nothing and never has. That property is worth keeping: a
-- newspaper a reader can edit is not a newspaper.

CREATE TABLE IF NOT EXISTS gazette (
  id         int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- there is one paper
  world_day  int  NOT NULL,
  -- the whole issue, composed: the front page, the back pages, and the
  -- stories' own facts beside the prose so a reader's device can link a name
  -- to a page without the paper having to spell out every href
  issue      jsonb NOT NULL,
  -- WHAT IT WAS PRINTED FROM. Not decoration: a paper that invents a result is
  -- worse than no paper, so every issue records the high-water mark of the
  -- record it read. If the world moves and this does not, somebody is looking
  -- at yesterday and can be told so rather than quietly misled.
  through    jsonb NOT NULL DEFAULT '{}'::jsonb,
  printed_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE gazette IS
  'The one daily paper, composed by the tick from the served world and read by '
  'every device. One row, overwritten each world day. Derived and disposable: '
  'deleting it costs one edition, which the next tick prints again.';

-- ---------------------------------------------------------------------------
-- AND IT IS PUBLIC, because a newspaper that needs a login is a memo. The
-- issue is composed here from views that are already public, so nothing new is
-- exposed - only assembled.
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.world_gazette;
CREATE VIEW public.world_gazette AS
  SELECT world_day, issue, through, printed_at FROM gazette WHERE id = 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON public.world_gazette TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT ON public.world_gazette TO anon;
  END IF;
END $$;
