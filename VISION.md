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
3. [BUILT — migration 023 + server/nations.mjs. THE INTERNATIONAL WINDOWS.
   Three rounds a season are window days (clock.mjs WINDOWS: 5, 9, 13). THE
   SELECTORS: on the morning of one, every nation on earth names a squad of
   fifteen out of every club in it - the gloves first, then six bowlers,
   then the best of the rest, ranked on a man's card lifted or dropped by
   his form, so league nick is genuinely what gets you picked. Never more
   than THREE from one club, which leaves every side twelve to choose from
   and spreads the international game round a league instead of gutting its
   best club. The squad is banked the instant it is named (callups), so a
   re-run of the day can never pick a different fifteen. THE LOCK: those men
   are not at their clubs that round - playRound plays the fixture without
   them, they do not work in the club's nets that week either, and absence
   rides into the banked living patch as {a:true} so the broadcast fields
   the same eleven the umpire did. THE TWELFTH MAN: a sheet filed a
   fortnight ago that names an absentee is COVERED, not torn up - the best
   man left bats in his place and, if he can, bowls his overs (law 2:
   absence costs nothing mechanical). THE MONEY: $50k a senior, $20k a man
   under twenty-one, paid to the club he was taken from and walked from
   genesis by economy.mjs like everything else in the books. THE TOURS: at
   18:00 UTC that evening whoever is in a window that world day is paired on
   the day's own seed and plays on the real engine (nineteen nations, nine
   ties, one week off), banked in nat_matches. The draw is a pure function of
   the world day, so the selectors already know it in the morning: a nation
   with the week off calls NOBODY up - a window with no fixture leaves the
   men at their clubs and costs the board nothing. A cap is its own book - a
   tour never swells a club career - but it is the same fifty overs: it
   tires the legs and moves the form. The nations' ladder in the rankings
   now climbs on tours as well as World Cup ties, and the World Cup side IS
   the side that toured, not a fresh fifteen picked the morning of the draw.
   Room at #/nations; the teamsheet greys out whoever has gone.
   The one honest simplification: the selectors read form as it stands when
   the window settles, so a window healed days late has seen a little
   cricket the players had not. Once named, it is fixed forever.]
   REAL NATIONAL TEAMS: selectors pick actual best players from club squads
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
10. [BUILT — migration 022 + server/comps.mjs. THE INVITATIONALS: a manager
    founds one (name, cup or round robin, four clubs or eight), takes the first
    seat, and any manager in any nation may join while entries are open. Three
    world days later closeEnrolment fills the empty seats with unmanaged clubs
    - seeded on the competition id, so a re-run seats the same field - and it
    starts; a half-subscribed competition still gets played. playComps settles
    a round a day on the real engine from the squads as they stand, autopicked
    exactly as an absent manager's XI is: nothing to submit, nothing to miss.
    Cup = bracket, top seat inward, a tie to the higher seat; league = the
    circle-method round robin. The card, the table and the champion are derived
    (computeComp) into the snapshot 'comps'. Two live per manager; leave while
    open, and the founder leaving folds it. Room at #/comps.]
    FRIENDLY COMPETITIONS: manager-created leagues/cups with local rules
    (we have challenges; missing organised comps).
11. [BUILT — engine/src/league/45-ratings.js + server/ratings.mjs. Every
    scorecard now carries a MATCH RATINGS panel: each side marked out of ten on
    top order, middle, tail, seam, spin and the field, plus an overall. Batting
    units are marked on runs against the job's par and the rate; bowling units
    on wickets per ten overs actually bowled and then economy; the field on
    catches HELD AGAINST CHANCES rather than a raw count, so it stops pegging at
    ten. Derived from the innings alone - it marks a league round, a cup tie, an
    invitational or a friendly without anything being stored.]
    MATCH RATINGS page per match (top/middle/tail batting, seam/spin,
    fielding, overall) post-match.
12. [BUILT — the client's window.foFantasyPoints is now ported into
    server/ratings.mjs and living.mjs scores FORM on it: a man's last five
    matches, each worth its fantasy points, is his nick. One formula, two hosts,
    held to a single answer by test 022 against the shipped build in the VM. The
    banked card was widened (enginehost slim()) to carry boundaries and the
    fielding book, because both feed the points; matches played before that
    simply rate without them. So the ratings page a manager reads IS the reason
    his batsman is out of form, not a second opinion about it.]
    FANTASY POINTS per match feeding form (we have partial).

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

---

# The owner's brief (settled 28 Jul 2026, in answer to twenty questions)

The waves above were a gap analysis against FTP. This is the thing itself:
what the game IS, in the owner's own answers. Everything built from here
answers to this page.

## The player
- THE DAILY LOOP is deep management, not a chore list: read what happened
  overnight, catch up with the wider world, scout young players, work out
  the shape of the side, sell the men who do not fit, buy from the market,
  set the nets, mind the money, read the lore, plan for the league match,
  follow other nations, follow your own players' careers. **Extreme depth,
  very realistic.**
- THE ARC has two halves. At the start the fantasy is *a new club climbing
  a ladder*. Once established it becomes *the custodian of a club with
  immense history - which you built - and which you now have to continue*.
  Systems should serve whichever half the manager is in.
- THE FIRST MONTH must do three things: set the team up, get him ATTACHED
  to his squad, his shape and his boys, and teach him how the league and
  the wider world work.
- IT IS A SHARED WORLD AND A GAME PLAYED WITH PEOPLE - Battrick and From
  the Pavilion online, not a solitaire sim with other people's names in it.

## The laws, as amended
- ABSENCE HURTS OVER TIME, NOT IN THE SHORT TERM. The old law (an absent
  manager loses nothing mechanical) now holds over days, not months: a
  manager who checks in every few days must never be behind, and one who
  disappears for a season must find his club the worse for it. This is what
  makes a transfer market possible at all.
- MONEY MUST BITE, AND A CLUB CAN GENUINELY FAIL. Bad decisions compound -
  debt, a gutted squad, men who will not sign - and wrecking a club is a
  thing a manager is allowed to do. There is a road back, but it is long.
- THE WORLD GETS HARDER. Difficulty is not flat; the game should come after
  a manager who has learned it.
- YOUR NUMBERS ARE YOURS; THEIRS ARE A SCOUT'S OPINION. A manager reads his
  own men exactly. A rival's man is words and ranges until somebody is paid
  to look at him properly - which is what keeps scouting a real activity.
- BOTH SCREENS, NO COMPROMISE. Every room is excellent on a phone and on a
  desk, even when that costs two layouts.

## The shape of the world to come
- DIVISIONS, once there are enough managers to fill them. One league a
  nation is a stage, not the destination.
- A MANAGER MAY MOVE NATIONS at the end of a season, taking the club he
  founded with him.
- RIVAL CLUBS ARE CHARACTERS. Every boss and every club wants its own
  story, in the way the opposing schools in Haikyuu have theirs: a
  philosophy, an ace, a way of playing you can feel on the scorecard, and
  an arc that continues whether or not you meet them. Lore is not garnish
  here; it is a system.

## What we are measured against
From the Pavilion, on three counts it gets wrong: **its match engine, its
interface, and the absence of a broader world with characters in it.** It is
a dated game. Ours must not read as one.

## The order of work
1. THE TRANSFER MARKET AND SCOUTING - the biggest single thing in the daily
   loop, and now unblocked by the amended absence law.
2. Rival clubs as characters.
3. Injuries and fitness; coaching staff; contracts and wages.
