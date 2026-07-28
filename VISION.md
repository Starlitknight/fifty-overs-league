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
   orders per match type. [BUILT — per-man batting instructions and per-bowler
   fields on the orders page; the resolver reads BOTH clubs' saved sheets
   (phase plan, man instruction, bowler field, toss decision); saving files
   the sheet with the World Service for every remaining round.]
5. PLAYER MODEL: experience (grows by matches, division-weighted),
   energy in-match from endurance+fatigue, triggered talents visible in
   commentary, weekly aging, wage loyalty discounts.
6. YOUTH SYSTEM: youth squad (U21) with its own weekly competition, academy
   levels affecting training speed & recruit quality, weekly youth recruit,
   auto-promotion at 21.
   [BUILT (the academy) — every club in all 19 leagues runs one, bot or human.
   Levels 1-5 held on the club, bought with world_set_academy (60k x the level
   you leave, remembered as academy_paid so the treasury still recomputes from
   genesis) and charged 900/level/round in upkeep. Capacity is 2+level; the
   umpire brings one colt in per intake window (server/youth.mjs ensureYouth,
   seeded 'youth|country|slot|season|round' off the shipped generator, so a
   re-run makes the same boy), ages every colt at the rollover and hands a
   21-year-old a senior shirt with nobody watching (ageYouth). A better academy
   turns boys out closer to finished. A manager may promote early or release
   (world_colt); a graduate carries a 'joined' round so living.mjs never works
   nets into him that he wasn't there for. Room at #/academy; rivals read the
   LEVEL on the club page, never the boys. Migration 018 (which also corrects
   017's write to a clubs.manager column that never existed).
   [BUILT (the Colts Cup + the nets rate) — migration 019. THE RATE: the
   academy level in force is now banked beside the plan in force in
   training_rounds, and living.mjs feeds it to host.trainRound as a multiplier
   (academyRate: level 2 = 1, eight per cent a level either side). Rounds
   already banked default to 2, so no settled history moves. THE CUP: nine
   fixtures, Colts round k played on league round 2k off the league's own first
   single round robin, so the boys meet every club once and there is no second
   schedule to keep honest. The side picks itself - colts plus the youngest
   seniors (coltsSquad) - so an offline manager cannot lose it; results land in
   youth_matches, the table and card in the snapshot colts/<country>, and each
   boy's own Colts record back onto the boy (coltRecords). Youth cricket never
   touches a senior first-class career. Shown on #/academy.]
7. [BUILT — migration 020 + server/economy.mjs. The treasury stopped being four
   flat numbers: settleMoney now WALKS every round a country has ever played
   and derives the lot. Supporters drift toward what mood + position deserve
   (4k-60k); mood is a reading of the last five results and the table
   (mutinous..ecstatic), never a counter; attendance = following x mood x who
   is visiting (flagship/top three draw) x the weather, capped by seats;
   weather is a pure function of the fixture seed, so nobody stores it and it
   moves the turnstiles, not the cricket. The gate splits two thirds home, one
   third away. The sponsor pays by the round off the standings. Out go wages,
   academy upkeep, and 3% a round on an overdraft. The one decision is the
   ground: world_set_stadium buys seats a thousand at a time (dearer each
   block, cost mirrored in SQL as world_seat_cost and held to the server's
   answer by test 020), never sold back, no borrowing to build; what was spent
   is carried from the founding so it cannot hide in an overdraft. Room at
   #/finance. THE HARD CAP (migration 021): a club cannot sink past the money
   it was founded with - reach that floor and it is in administration, the
   losses below the line written off because there is no deeper hole, but the
   sponsor pays half while it is under and the write surface refuses to build
   anything at all while the bank is red. NOT built: division tiers (one league
   a nation), and a supporter-mood ladder with mechanical effects beyond the
   gate.]
   ECONOMY: attendance from supporters+mood+division+weather, gate takings
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
