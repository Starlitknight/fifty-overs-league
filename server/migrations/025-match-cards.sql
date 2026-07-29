-- 025-match-cards.sql — THE CARD THE UMPIRE ACTUALLY WROTE.
--
-- A match report on a phone was a RECONSTRUCTION. The device regenerated both
-- squads from the world seed, laid the banked living state over them, replayed
-- fifty overs, and compared its verdict with the one on record. Agree, and you
-- got a scorecard; disagree, and it showed a bare scoreline rather than a
-- scorecard that never happened. That refusal is right - a wrong card is worse
-- than no card - but it fired far too often, and for a reason no amount of
-- client cleverness can fix: MEN MOVE. A club that has bought four cricketers
-- since the season began cannot be regenerated from its founding seed, and the
-- living patch carries form and fatigue, not a transfer.
--
-- Meanwhile the umpire has had the real thing all along. Every match banks its
-- canonical card in `matches.result` - both innings, every batsman with the
-- player he actually was, every bowler's figures, the fielding, the worm. It
-- was simply never readable from outside. This hands it over.
--
-- WHAT THIS IS NOT. It is not a write surface and it reveals nothing early: a
-- row in `matches` exists only because the match has been played, so a card
-- can only be asked for after the fact. No lineup, no plan, no future.
--
-- The client keeps the replay for ONE thing - the ball-by-ball commentary,
-- which the canonical card deliberately does not carry (it is the largest part
-- of a match and the cheapest to re-derive). Scorecard, chart and fantasy now
-- come from the record itself and can no longer disagree with it.

-- ---------------------------------------------------------------------------
-- ONE MATCH, ONE CARD. Asked for by the match id the snapshots already
-- publish (`eng:s1:r2:h3a2`), so a report holding a result row needs nothing
-- else to find its card.
--
-- Deliberately not a whole round at once. A card carries the cricketers
-- themselves, not their names - that is what makes the scorecard's stars and
-- a tap through to a player possible - and it weighs about 65 KB. A round of
-- five would be a third of a megabyte to answer a question about one match,
-- and this world watches its egress.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.world_match_card(p_country text, p_match_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = world, public AS $$
DECLARE m record;
BEGIN
  SELECT * INTO m FROM matches
   WHERE id = p_match_id AND country_id = p_country AND result IS NOT NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('country', p_country, 'id', p_match_id, 'card', null);
  END IF;
  RETURN jsonb_build_object('country', p_country, 'id', m.id,
                            'seasonNo', m.season_no, 'round', m.round,
                            'home', m.home_name, 'away', m.away_name,
                            'card', m.result);
END $$;

-- Readable by anyone with the game open, signed in or not: these are results,
-- and the results are already published in the snapshots. The grants are
-- guarded the same way the rest of the world's are, so a database that
-- predates a role does not fail the migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION public.world_match_card(text, text) TO authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION public.world_match_card(text, text) TO anon;
  END IF;
END $$;
