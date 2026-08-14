# The Gazette — a daily paper the whole world reads

The brief, settled question by question with the owner. Build from this, not
from anybody's memory of the conversation.

## What it is

One newspaper a day, describing the world's cricket, **identical for every
reader**. Not a club bulletin. It leads on internationals, then the first
divisions, then whatever else in the world is worth knowing — the way a real
back page does.

## What was wrong before

The old paper (`engine/src/league/35-gazette.js`) read three things:

    App.results, App.playerHist   this device's local save
    __foPlanet.genWire()          module 27's client-derived planet

So its lead was the READER'S last match, from HIS save, and its wire came from
a planet that is a pure function of the UTC date and has no connection to the
world the umpire actually plays. **Nothing in the client reads
`world_nat_matches`** — the internationals the server plays appear on no page
in the game. That is the hole this fills.

## The ten decisions

1. **The served world only.** `world_nat_matches`, `world_matches`,
   `world_clubs`, `world_squads`, `world_player_profile`, `world_comps`,
   `world_deals`. Module 27 stops feeding the paper; it may stay for whatever
   else uses it.
2. **The tick composes it, once per world day, into a stored row.** Identical
   for everyone by construction rather than by hoping two clients agree. The
   page stays a pure reader and writes nothing.
3. **Coverage is weighted by standing.** A top-four nation's tour outranks an
   associate's; a flagship outranks a second-division club. Upsets climb on
   merit, not by quota.
4. **Cup finals and the World Cup take over the front page.** A second
   front-page layout: the tie leads, the bracket beside it, domestic below the
   fold.
5. **Every day has cricket.** The owner is removing non-active days from the
   calendar. No rest-day edition is needed — but a country that fails to
   settle must degrade gracefully, never print a blank paper.
6. **The reader's own club is absent — unless it IS the story.** No club
   section. If his side wins the title or his man breaks a world record it
   leads, exactly as it would for any reader. The paper stays byte-identical
   for everyone, which is what lets it be one cached row. (The results column
   is filtered to the reader's nation — see **Whose results** below. That is a
   rendering rule on one stored document and does not touch this one.)
7. **Front page plus back pages.** Lead, second lead, in brief; then
   scoreboard, a table, records, comment. Roughly ten to fourteen stories,
   about three phone screens.
8. **Reported prose from seeded phrase pools**, keyed on the world day, the way
   the old Gazette already did it. Deterministic, never `Math.random`. No
   named bylines for now.
9. **Today only.** One row, overwritten daily. No archive.
10. **The upset leads.** When two stories score close, the paper prints the
    unexpected one. This is the paper's personality and the reason weighting
    by standing stays fair: a Nepal side beating Australia reaches the front
    page on merit.

## The editorial model

Do NOT hard-code the four tiers as sections. **Score every candidate story and
take the top N**; the tiers then emerge, and the paper stays alive on days when
the obvious story is missing.

Base weight by kind, in the owner's order:

    international result; international century / five-for / debut cap
    a first division title or relegation decided; a top-of-table clash
    world records - highest total, best figures, biggest chase
    transfers of consequence, a hundredth cap, a great retiring
    oddities - a tie, a ten-wicket win, a side out for 58

Then the modifiers, which are what make it read like journalism rather than a
leaderboard:

    RARITY     once this season beats twice this week
    MAGNITUDE  how far past the previous best
    STAKES     a decider outranks a dead rubber
    FRESHNESS  decaying, so yesterday leads
    STANDING   a top-four nation, a flagship club
    UPSET      the tie-break, and deliberately heavy

## The date on it

There is one world and it has one date, but a season has two names: the
`seasons` row's `season_no`, which counts from 1 because the umpire founded
this world in August 2026, and the name every page in the client prints, which
carries straight on from the baked record and so calls that same season 137.
The masthead uses the **name**, always — and counts the day from the season's
own `start_day`, not from the epoch. Printing the index and the raw world day
put "Day 12 of season 1" two inches under a header reading DAY 5 · SEASON 137,
and a reader has no way to tell that those are the same morning.
`clock.seasonName` and `clock.worldAnchor` are the two functions; the paper
carries `season` and `dayInSeason` as numbers so the page never parses the
folio line back apart.

## The page

It is an **almanack, not a broadsheet**. The first build was a two-column grid
of bordered boxes, each full of one-line wire rows, and the verdict on it was
that it read like printed scorecards rather than a paper. That was structural
and not decorative:

- only one story on the page had prose, and twenty had a single line each;
- a bordered box in a grid is a **dashboard** shape, and a column of dotted
  rows is a **list**; neither becomes journalism by being repainted;
- there was no middle tier — a story was either the lead or one line, never
  three sentences and a heading;
- the forty results printed at the same size as the journalism, so the page
  had no quiet register for data.

So: one book face, ivory and ink, **no accent colour and no boxes anywhere**.
The hierarchy is entirely type — size, italic, small caps, and space.

    THE MASTHEAD       letterspaced caps over a double rule; the folio is the
                       season's own day and the season's public name
    THE LEAD           rubric, head, an italic DECK carrying the numbers, then
                       the report set as book paragraphs in one 38-em measure
    * * *              an asterism, where a newspaper would put a rule
    OF NOTE            the day's individual cricket, as entries
    FROM ABROAD        everything that happened somewhere else, as entries
    THE DAY'S CRICKET  the results, RUN ON as semicolon-separated prose
    COMMENT            one pundit line, centred under a hairline

**The deck is the numbers and the body is the words.** `Khulna CC 270/8, Dhaka
CC 265/10.` dropped into the second sentence of a report is the single line
that made this read like a printout. It goes in the deck, where a paper puts
it, and the report says what happened instead of what the numbers were.

## Whose results

The day's cricket is filtered to the **reader's own nation**, which is what
keeps that section short enough to read.

This is a **rendering** rule and never an editorial one, and the distinction is
load-bearing. The press composes ONE paper: same lead, same briefs, same
sentences, and there is nowhere in a story to say whose club it is — a test
holds that and must keep holding it. What differs is which section of the same
document a page prints, the way two people reading one newspaper turn to
different pages of the results. A reader who has not claimed a club has no
nation to turn to and gets the whole world.

Two consequences worth knowing before touching it:

- **The scoreboard must carry the whole day.** It was capped at forty rows,
  which was invisible while the page printed one undifferentiated list. Nineteen
  leagues bowl about a hundred and fifty matches on a league day and the rows
  arrive ordered by country, so forty of them covered four countries — fifteen
  nations' readers would have opened to an empty column indistinguishable from a
  rest day.
- **The desk writes the result sentence, not the page.** The engine's `text`
  names only the winner ("Essex win by 38 runs"), which run on as prose is a
  results column with no losers in it. `gazette-desk.resultLine` makes "Essex
  beat Kent by 38 runs" and prints anything it does not recognise verbatim.

## Open, and owned elsewhere

**Where the international windows land after the schedule change.** They
currently sit ON rest days, which is why days 3, 7 and 11 are the paper's best
days — internationals with no domestic cricket competing. Removing empty days
moves them, and where they land decides how often the paper leads on
internationals. Settle that before tuning the scoring weights.

## How it must be tested

The paper is a derivation, so it obeys the same law as everything else here:
compose it twice from one record and get the same paper. Beyond that — every
story it prints must be traceable to a row in the served world, because a
newspaper that invents a result is worse than no newspaper.
