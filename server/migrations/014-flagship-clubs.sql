-- 014-flagship-clubs.sql — NO MORE BOSS XIs. REAL CLUBS.
-- Slot 0 of every league was a made-up patron's XI in England and a generic
-- city side everywhere else. Each nation's anchor club is now the real,
-- storied one a supporter there would name first, playing at its real home.
-- It stays the club no manager may take over - the standing measure of the
-- league - but it is no longer a character, it is a cricket club.
--
-- Renaming an anchor is safe by construction: every record in this world is
-- keyed by (country, slot), never by name, and matches keep the names they
-- were played under. Tables, ladders and honours all survive it.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('eng', 'Essex',                     'Chelmsford'),
      ('ire', 'Leinster Lightning',        'Malahide'),
      ('ned', 'VOC Rotterdam',             'Hazelaarweg'),
      ('win', 'Barbados',                  'Kensington Oval'),
      ('rsa', 'Western Province',          'Newlands'),
      ('zim', 'Mashonaland Eagles',        'Harare Sports Club'),
      ('aus', 'New South Wales',           'The Sydney Cricket Ground'),
      ('nzl', 'Canterbury',                'Hagley Oval'),
      ('slk', 'Sinhalese Sports Club',     'The SSC Ground'),
      ('sub', 'Cricket Club of India',     'Brabourne Stadium'),
      ('pak', 'Karachi Whites',            'National Stadium'),
      ('afg', 'Band-e-Amir Dragons',       'Kabul International'),
      ('bgd', 'Abahani Limited',           'Sher-e-Bangla Stadium'),
      ('nep', 'Tribhuvan Army Club',       'The TU Ground'),
      ('sco', 'The Grange',                'Raeburn Place'),
      ('wal', 'Glamorgan',                 'Sophia Gardens'),
      ('ken', 'Nairobi Gymkhana',          'The Gymkhana Ground'),
      ('usa', 'Philadelphia Cricket Club', 'St Martin''s'),
      ('can', 'Ontario',                   'Maple Leaf Ground')
    ) AS v(cid, nm, ground)
  LOOP
    -- only the anchor seat, and never a club a manager has christened
    UPDATE clubs
       SET name = r.nm, default_name = r.nm, ground = r.ground
     WHERE country_id = r.cid AND slot = 0 AND is_boss;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
