# Fifty Overs — The Target World (settled 26 Jul 2026)

The owner's spec, in their words, refined by the FTP manual:

## The world
- The world is COUNTRIES. Each country has ONE league of TEN clubs.
- Each league contains humans and bots. One club per country is the BOSS CLUB
  (our boss characters: Sir Giles Pemberley's XI etc.). Humans joining a
  country replace a bot club, NEVER the boss.
- Season = double round robin (18 rounds), one round per day on the world
  clock, each nation at its own UTC hour (England 14:00).
- Each country's champion club is invited to THE CHAMPIONS LEAGUE
  (club knockout across nations) after the season.
- Each country also has a NATIONAL TEAM. The strongest players from any club
  (bot or human) get called up for international windows; called-up players
  MISS their club matches those rounds, and the club is compensated (FTP:
  $50k senior / $20k U20). A T20+OD World Cup runs in the off-season.
- Reference game: From the Pavilion (manual in repo owner's upload). We match
  its management depth, but our constraint holds: everything derived
  deterministically; interactive moments cost nothing for offline managers.

## Gap analysis vs FTP (ranked)
1. ONE WORLD, JOINABLE: today only the owner's league runs on the real
   engine; other countries are seeded scorelines. Target: every country's
   league is a real 10-club competition a human can join (replace a bot),
   with the boss club seated in each league and never replaceable.
2. CHAMPIONS LEAGUE OF CLUBS: replace/augment the nations World Cup with a
   knockout of the 19 champion CLUBS (user's club qualifies by winning).
3. REAL NATIONAL TEAMS: selectors pick actual best players from club squads
   each international window; players miss those club rounds; club paid
   compensation; national squads feed the World Cup.
4. MATCH ORDER DEPTH (FTP parity): per-player batting/bowling
   aggression (N/D/A), bowling spells, captain choice, toss call, default
   orders per match type.
5. PLAYER MODEL: experience (grows by matches, division-weighted),
   energy in-match from endurance+fatigue, triggered talents visible in
   commentary, weekly aging, wage loyalty discounts.
6. YOUTH SYSTEM: youth squad (U21) with its own weekly competition, academy
   levels affecting training speed & recruit quality, weekly youth recruit,
   auto-promotion at 21.
7. ECONOMY: attendance from supporters+mood+division+weather, gate takings
   split 2/3-1/3, sponsorship tied to results, stadium expansion (+$ per
   seat), supporter mood ladder, debt rules, finance cap.
8. SEASON HONOURS (FTP trophy categories): league position, cup, most
   runs/wickets, best averages/strike rates, keeper/fielder dismissals -
   trophy cabinet + hall of fame.
9. RANKINGS: country + global club rankings from rolling match ratings;
   used to seed cups.
10. FRIENDLY COMPETITIONS: manager-created leagues/cups with local rules
    (we have challenges; missing organised comps).
11. MATCH RATINGS page per match (top/middle/tail batting, seam/spin,
    fielding, overall) post-match.
12. FANTASY POINTS per match feeding form (we have partial).

## Already built (keep)
Deterministic world clock (25-day cycle, staggered hours, live windows),
top-bar clock, dated fixtures, auto-resolving rounds with saved orders,
MATCHDAY LIVE window, planet/almanack/star/cup-match pages, generational
world squads, winter window signings, records (user-beatable), county
England, per-club charters, honours board, nets training, dossier,
Time Machine, daylight/almanack design system.

## Next waves (owner priorities from Q&A)
A. Matchday page (#/matchday?r=N): pitch/weather one-liners, head-to-head,
   probable XIs, win %, pundit banter. Doors: home button + fixture rows.
B. Training pops celebrated (training page feed + player page arrows).
C. Full stats universe for own league (leaderboards, careers, club records).
D. Daily newspaper: world round-up + lore features on bosses/stars/clubs.
E. Then: structure waves 1-3 above (joinable world, champions league,
   real national teams).
