// ---- 27-living-planet.js — the living cricket planet --------------------------
// Every nation's league now RUNS. Not a baked snapshot, not flavour text: a
// world calendar that began on 16 May 2026 and has ticked one round per day
// ever since, whether anyone was watching or not.
//
// The whole planet is a PURE FUNCTION OF THE REAL UTC DATE. No server, no
// packets, no state: any device, online or offline, at the same moment,
// derives the identical world - fixtures, scores, standings, champions, the
// World Cup bracket. That is how a shared living world satisfies the
// human-vs-human / human-vs-bot constraint: determinism instead of sync.
//
// The calendar, in 30-day seasons - THREE ROUNDS, THEN A DAY OFF, six times:
//   days 0-2    league rounds 1-3
//   day  3      rest · international window 1 (its call-ups rob round 4)
//   days 4-6    rounds 4-6      day 7   rest · window 2 (robs round 7)
//   days 8-10   rounds 7-9      day 11  rest · window 3 (robs round 10)
//   days 12-14  rounds 10-12    day 15  rest
//   days 16-18  rounds 13-15    day 19  rest
//   days 20-22  rounds 16-18    day 23  rest
//   day  24     honours day (champions crowned) · Champions Cup play-ins
//   days 25-28  the cups: last sixteen, quarters, semis, THE FINALS
//   day  29     rest day - the wire catches its breath
// A cricketer's year is thirty days too, so one season is one year of his life.
//
// THIS FILE MUST AGREE WITH server/clock.mjs, ball for ball. The server plays
// the cricket; this only says what day it is. tests assert the parity.
// The globe is staggered: each nation bowls off at its own UTC hour (England
// is the 14:00 league), each day's play running three hours, live.
//
// ONE ENGLAND: your real league IS your nation's league on this planet - its
// record book routes to your standings. The clock drives the other nations,
// and at runtime it overwrites the baked FO_WORLD_SNAPSHOT's leagues and
// wire, so record books, atlas ticker and world desk stay alive for free.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rnd01(s) { return h32(s) / 4294967296; }
  function cx() { return window.__foCxAPI || null; }
  function artBase() {
    if (typeof FO_ART !== "undefined") return FO_ART;
    return (location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/";
  }

  // ---- the calendar -----------------------------------------------------------
  // THE 35-DAY SEASON — FIVE EXACT WEEKS. Day 0 is always a Monday (3 August
  // 2026), so di % 7 IS the weekday, forever: Sunday is cup day, Wednesday and
  // Saturday are international days, the last week is the Champions Cup.
  // docs/PYRAMID.md is the authority; server/clock.mjs must agree ball for ball.
  var EPOCH = Date.UTC(2026, 7, 3);            // MONDAY 3 August 2026, day 0 - season 1 day 1
  var DAY = 86400000, CYCLE = 35, ROUNDS = 14;  // eight clubs a division, double round robin
  var LEAGUE_DAYS = 23;                         // last league round settles di 22
  var PLAYOFF_DAYS = { semi: 24, final: 25 };
  var FA_DAYS = { r16: 6, qf: 13, sf: 20, final: 27 };
  var TRANSITION_DAY = 31;
  // the league week: Mon Tue . Thu Fri . . — rounds at di%7 in {0,1,3,4}
  var WEEK_POS = { 0: 1, 1: 2, 3: 3, 4: 4 };
  // day-in-season <-> round. NOTHING may assume round === day + 1 any more.
  // Playoffs are rounds 15 (semis) and 16 (the final) - fixtures, not table rounds.
  function roundOfDay(di) {
    if (!(di >= 0)) return null;
    if (di === PLAYOFF_DAYS.semi) return 15;
    if (di === PLAYOFF_DAYS.final) return 16;
    if (di >= LEAGUE_DAYS) return null;
    var w = Math.floor(di / 7), pos = WEEK_POS[di % 7];
    if (!pos) return null;
    var r = w * 4 + pos;
    return r >= 1 && r <= ROUNDS ? r : null;
  }
  function dayOfRound(round) {
    if (round === 15) return PLAYOFF_DAYS.semi;
    if (round === 16) return PLAYOFF_DAYS.final;
    if (!(round >= 1 && round <= ROUNDS)) return null;
    return Math.floor((round - 1) / 4) * 7 + [0, 1, 3, 4][(round - 1) % 4];
  }
  var WINDOW_DAYS = [2, 5, 9, 12, 16, 19], WINDOWS = [3, 5, 7, 9, 11, 13];
  function windowRoundOfDay(di) { var i = WINDOW_DAYS.indexOf(di); return i < 0 ? null : WINDOWS[i]; }
  var HONOURS_DAY = 25, CUP_DAYS = { g1: 28, g2: 29, g3: 30, qf: 32, sf: 33, final: 34 };
  var LIVE_LEN = 3;                             // a day's play runs three hours
  // the staggered globe: each nation bowls its first ball at its own UTC hour.
  // England is the 14:00 UTC league; the rest spread around the clock so
  // there is nearly always a match on somewhere.
  var HOUR_SLOTS = [1, 4, 7, 10, 13, 16, 19, 22];
  function natHour(rid) { if (rid === "eng") return 14; return HOUR_SLOTS[h32("nathour|" + rid) % HOUR_SLOTS.length]; }
  function dayIx(now) { return Math.floor((now - EPOCH) / DAY); }
  function hourOfDay(now) { var d = dayIx(now); return (now - (EPOCH + d * DAY)) / 3600000; }
  // WHEN THE SUMMER BEGAN IS THE WORLD'S TO SAY, NOT OURS TO ASSUME.
  // Season 1 was founded on day 0 (28 July = Day 1, Round 1), and for as long
  // as that was the only summer there had ever been, every page could work out
  // today's round from the date alone. It is no longer true: the umpire records
  // a start_day per season and per nation, and a world that is redealt and
  // restarted begins its season 1 on the day it was restarted. Read from the
  // date alone, a world restarted on day 2 says "Round 3" on the morning it has
  // not yet bowled a ball - the front door contradicting the table beside it.
  //
  // So the calendar is ANCHORED by the world. WORLD_START is only the founding
  // assumption, used until the served snapshot arrives and says otherwise;
  // anchorWorld() is how it says otherwise, and every day/season/round mapping
  // below runs off the anchor. One anchor, set from the snapshot in
  // 31-world-feed.js, so no page has to remember to do this arithmetic itself.
  var WORLD_START = 0;
  var ANCHOR = { start: WORLD_START, season: 1 };
  function anchorWorld(startDay, seasonNo) {
    if (startDay == null || !(seasonNo >= 1)) return ANCHOR;
    ANCHOR = { start: startDay | 0, season: seasonNo | 0 };
    return ANCHOR;
  }
  function anchorOf() { return ANCHOR; }
  // the world day a season opens on, walked from the anchor a cycle at a time
  function seasonStart(season) { return ANCHOR.start + ((season | 0) - ANCHOR.season) * CYCLE; }
  function phaseOf(now) {
    var d = dayIx(now), rel = d - ANCHOR.start;
    if (rel < 0) return { day: d, season: ANCHOR.season, di: -1, kind: "rest", preseason: true };
    var s = ANCHOR.season + Math.floor(rel / CYCLE), di = rel % CYCLE;
    var p = { day: d, season: s, di: di, weekday: di % 7 };
    var r = roundOfDay(di);
    var faStage = null;
    for (var fk in FA_DAYS) if (FA_DAYS[fk] === di) faStage = fk;
    if (r && r <= ROUNDS) { p.kind = "league"; p.round = r; }
    else if (r === 15 || r === 16) { p.kind = "playoff"; p.round = r; p.stage = r === 15 ? "semi" : "final"; }
    else if (faStage) { p.kind = "facup"; p.stage = faStage; }
    else if (di === TRANSITION_DAY) p.kind = "transition";
    else if (di >= CUP_DAYS.g1) {
      var ccStage = null;
      for (var ck in CUP_DAYS) if (CUP_DAYS[ck] === di) ccStage = ck;
      if (ccStage) { p.kind = "cup"; p.stage = ccStage; } else p.kind = "rest";
    }
    else { p.kind = "rest"; p.window = windowRoundOfDay(di); }
    return p;
  }
  // how many rounds of season s are FINAL at `now` - per nation, since each
  // nation's day ends at its own hour
  function roundsDone(now, s, rid) {
    var p = phaseOf(now);
    if (s < p.season) return ROUNDS;
    if (s > p.season) return 0;
    if (p.di >= LEAGUE_DAYS) return ROUNDS;
    var h0 = rid != null ? natHour(rid) : 14, closed = hourOfDay(now) >= h0 + LIVE_LEN;
    // every round whose day is behind us, plus today's if its window has shut
    var n = 0;
    for (var r = 1; r <= ROUNDS; r++) {
      var d = dayOfRound(r);
      if (d < p.di || (d === p.di && closed)) n++;
    }
    return n;
  }

  // ---- the sides of a nation --------------------------------------------------
  // SIXTEEN NATIONS: the twelve ICC Full Members and the four strongest
  // Associates. Wales, Kenya and Canada leave the top table (their art stays
  // on disk for a future tier); Glamorgan plays in England's Division Two,
  // which is where Welsh county cricket has always really lived.
  var FO_CUT = { wal: 1, ken: 1, can: 1 };
  function regionList() { var c = cx(); if (!c) return []; return (c.regions() || []).filter(function (r) { return !r.final && !FO_CUT[r.id]; }); }
  function regionById(rid) { var L = regionList(); for (var i = 0; i < L.length; i++) if (L[i].id === rid) return L[i]; return null; }
  // two more real cricket cities per nation, so Division One seats eight clubs
  var EXTRA_CITY = { eng: ["Taunton", "Hove"], ire: ["Sligo", "Wexford"], ned: ["Nijmegen", "Leiden"], win: ["Kingstown", "Providence"], rsa: ["East London", "Potchefstroom"], zim: ["Chinhoyi", "Marondera"], aus: ["Darwin", "Newcastle"], nzl: ["Queenstown", "Whangarei"], slk: ["Negombo", "Jaffna"], sub: ["Pune", "Lucknow"], pak: ["Quetta", "Gujranwala"], afg: ["Bamyan", "Farah"], bgd: ["Mymensingh", "Bogra"], nep: ["Butwal", "Nepalgunj"], sco: ["Paisley", "Falkirk"], usa: ["Seattle", "Atlanta"] };
  // DIVISION TWO: eight real smaller cricket towns per nation - works teams,
  // district sides, ambitious village clubs. This is where a club is FOUNDED.
  var DIV2_CITY = {
    ire: ["Galway", "Limerick", "Drogheda", "Bangor", "Armagh", "Carlow", "Tralee", "Athlone"],
    ned: ["Amstelveen", "Deventer", "Groningen", "Haarlem", "Delft", "Zwolle", "Breda", "Arnhem"],
    win: ["Basseterre", "Roseau", "St George's", "Scarborough", "Chaguanas", "Montego Bay", "Gros Islet", "Couva"],
    rsa: ["Bloemfontein", "Kimberley", "Paarl", "Benoni", "Pietermaritzburg", "Soweto", "George", "Polokwane"],
    zim: ["Kwekwe", "Gweru", "Kadoma", "Masvingo", "Bindura", "Hwange", "Rusape", "Kariba"],
    aus: ["Hobart", "Canberra", "Geelong", "Ballarat", "Townsville", "Cairns", "Wollongong", "Launceston"],
    nzl: ["Dunedin", "Hamilton", "Napier", "Tauranga", "Nelson", "Palmerston North", "Invercargill", "Rotorua"],
    slk: ["Matara", "Kurunegala", "Ratnapura", "Batticaloa", "Anuradhapura", "Badulla", "Trincomalee", "Hambantota"],
    sub: ["Indore", "Rajkot", "Ranchi", "Guwahati", "Kanpur", "Vadodara", "Mysore", "Cuttack"],
    pak: ["Multan", "Faisalabad", "Rawalpindi", "Hyderabad", "Sialkot", "Sukkur", "Abbottabad", "Bahawalpur"],
    afg: ["Khost", "Kunduz", "Herat", "Ghazni", "Laghman", "Charikar", "Pul-e-Khumri", "Maidan Shar"],
    bgd: ["Khulna", "Rajshahi", "Barisal", "Rangpur", "Comilla", "Narayanganj", "Jessore", "Tangail"],
    nep: ["Pokhara", "Bhairahawa", "Biratnagar", "Birgunj", "Dhangadhi", "Hetauda", "Itahari", "Janakpur"],
    sco: ["Aberdeen", "Dundee", "Ayr", "Stirling", "Perth", "Inverness", "Greenock", "Dunfermline"],
    usa: ["Houston", "Chicago", "Morrisville", "Oakland", "Tampa", "Phoenix", "Denver", "Boston"]
  };
  // a small club sounds like a small club - the pattern is a pure function of
  // the seat, so every device names the same club the same way
  var DIV2_STYLE = ["%s CC", "%s Athletic", "%s District XI", "%s Colts", "%s Wanderers", "%s Gymkhana", "%s Rovers", "%s Union CC"];
  function div2Name(rid, slot, city) {
    var pat = DIV2_STYLE[h32(rid + "|d2nm|" + slot) % DIV2_STYLE.length];
    return pat.replace("%s", city);
  }
  // England is hand-named on the server (the counties) - the mirror MUST carry
  // the same names, or orders keyed by club name would miss and the claim
  // highlight would never find you. Division Two is the second flight of real
  // counties - Glamorgan included, wearing the daffodil in an English league.
  var ENG_SIDES = [
    { slot: 0, boss: true, name: "Essex", city: "Chelmsford" },
    { slot: 1, name: "Yorkshire", city: "Leeds" },
    { slot: 2, name: "Lancashire", city: "Manchester" },
    { slot: 3, name: "Surrey", city: "London" },
    { slot: 4, name: "Middlesex", city: "London" },
    { slot: 5, name: "Warwickshire", city: "Birmingham" },
    { slot: 6, name: "Nottinghamshire", city: "Nottingham" },
    { slot: 7, name: "Kent", city: "Canterbury" },
    { slot: 8, name: "Durham", city: "Durham" },
    { slot: 9, name: "Somerset", city: "Taunton" },
    { slot: 10, name: "Glamorgan", city: "Cardiff" },
    { slot: 11, name: "Sussex", city: "Hove" },
    { slot: 12, name: "Gloucestershire", city: "Bristol" },
    { slot: 13, name: "Hampshire", city: "Southampton" },
    { slot: 14, name: "Derbyshire", city: "Derby" },
    { slot: 15, name: "Leicestershire", city: "Leicester" }
  ];
  // ==== WHO EACH SIDE IS, AND HOW GOOD ===================================
  //
  // Two facts about every club in the world, decided in ONE place because both
  // hosts read them: the phones through sidesOf(), and the World Service
  // through host.worldConfig() when it founds or reseeds a squad. If these ever
  // forked, the league a manager reads and the league the umpire plays would be
  // different leagues.
  //
  // THE IDENTITY is an engine archetype, and it is the one the game already
  // describes. Every club the Circuit gave a character to keeps that character:
  // Leeds are dour openers, so they are The Stonewall; Trent Bridge swings it,
  // so Nottingham are The Pace Battery; Cape Town catch everything, so they are
  // The Safe Hands. A club the game never wrote a line about takes its NATION's
  // cricket instead, from a palette that cannot contradict it - no spin circus
  // in South Africa, no pace battery in Sri Lanka.
  //
  // THE STANDING is a strength multiplier on the squad budget, and the rule the
  // world now obeys is simple: THE FLAGSHIP IS ALWAYS THE STRONGEST SIDE IN ITS
  // LEAGUE. It sits clear of the best of the rest, and the other nine spread
  // down a fixed ladder - the same ladder in every nation, dealt in an order
  // that is a pure function of the nation, so leagues have the same shape and
  // the same standard. What separates two leagues is then how they PLAY, which
  // is what the world rankings are for; nothing is handicapped at birth.
  // The flagship's gap is deliberately wide, and it has to be. The budget these
  // numbers steer is not the rating a squad ends up displaying - composition
  // moves it a few per cent either way - so a two-point edge is inside the noise
  // and a flagship can come out second. Fifteen per cent clear cannot. Nine
  // rungs three to four points apart, for the same reason: an ordered league
  // instead of ten sides in a coin-toss.
  var FO_BOSS_STR = 1.20;
  // DIVISION ONE: the boss and seven established clubs on a tight ladder.
  // DIVISION TWO: the founding seats - small clubs on a lower ladder that
  // overlaps the first division's floor at the seam, the way real second
  // flights do. Both shuffled per nation, pure functions of the nation.
  var FO_STR_LADDER = [1.04, 1.00, 0.97, 0.94, 0.91, 0.88, 0.85];
  var FO_D2_LADDER = [0.86, 0.83, 0.80, 0.78, 0.76, 0.74, 0.72, 0.70];

  // England is named for its counties, not its cities (and three of them play
  // in London), so its identities are seated by slot - all sixteen of them.
  var ENG_ARCH = ["rock", "rock", "express", "blade", "greybeard", "engine", "express", "miser",
    "express", "blade", "engine", "miser", "rock", "gloveman", "greybeard", "finisher"];

  // The clubs the game gave a character to. Keyed by city, so a named side
  // carries its identity to whichever slot its city lands in.
  var CITY_ARCH = {
    eng: { London: "rock", Leeds: "rock", Canterbury: "miser", Nottingham: "express", Manchester: "express" },
    ire: { Cork: "express", Dublin: "miser", Belfast: "rock" },
    ned: { Utrecht: "miser", Amsterdam: "engine", Rotterdam: "miser" },
    win: { "Port of Spain": "finisher", Bridgetown: "blade", Kingston: "finisher" },
    rsa: { Durban: "express", Johannesburg: "express", "Cape Town": "gloveman" },
    // the boy who is afraid of nothing leads with the bat, not from the academy:
    // The Academy archetype is the league's YOUNGEST squad and deliberately its
    // lightest, which is no way to seat a flagship. His youth reads through his
    // captaincy instead, and Harare play like cavaliers.
    zim: { Harare: "blade", Bulawayo: "rock", "Victoria Falls": "blade" },
    aus: { Melbourne: "blade", Perth: "engine", Sydney: "blade", Brisbane: "express", Adelaide: "finisher" },
    nzl: { Auckland: "gloveman", Christchurch: "miser", Wellington: "gloveman" },
    slk: { Kandy: "wizard", Colombo: "wizard", Galle: "blade" },
    sub: { Nagpur: "wizard", Mumbai: "wizard", Kolkata: "gloveman", Dharamshala: "express", Chennai: "wizard" },
    pak: { Lahore: "express", Karachi: "express", Peshawar: "express", Sharjah: "miser" },
    afg: { Kandahar: "wizard", Kabul: "wizard", Jalalabad: "finisher" },
    bgd: { Sylhet: "wizard" },
    nep: { Kathmandu: "wizard" },
    sco: { Edinburgh: "engine" },
    wal: { Cardiff: "express" },
    ken: { Nairobi: "finisher" },
    usa: { "Grand Prairie": "finisher" },
    can: { "King City": "gloveman" }
  };

  // A nation's own cricket, for the clubs nobody wrote a line about. First entry
  // is the nation's truest style; the rest are the company it keeps.
  var NAT_ARCH = {
    eng: ["rock", "express", "greybeard", "miser", "engine"],
    ire: ["engine", "miser", "rock", "express", "gloveman"],
    ned: ["miser", "engine", "gloveman", "rock", "blade"],
    win: ["finisher", "blade", "express", "engine", "gloveman"],
    rsa: ["express", "gloveman", "blade", "miser", "engine"],
    zim: ["prodigy", "engine", "rock", "blade", "miser"],
    aus: ["blade", "express", "finisher", "engine", "gloveman"],
    nzl: ["gloveman", "miser", "engine", "rock", "express"],
    slk: ["wizard", "blade", "engine", "miser", "gloveman"],
    sub: ["wizard", "gloveman", "blade", "express", "engine"],
    pak: ["express", "miser", "wizard", "finisher", "blade"],
    afg: ["wizard", "finisher", "express", "blade", "engine"],
    bgd: ["wizard", "miser", "engine", "rock", "gloveman"],
    nep: ["prodigy", "wizard", "blade", "engine", "finisher"],
    sco: ["rock", "engine", "miser", "express", "greybeard"],
    wal: ["engine", "express", "rock", "blade", "miser"],
    ken: ["finisher", "engine", "blade", "gloveman", "express"],
    usa: ["blade", "finisher", "express", "gloveman", "engine"],
    can: ["gloveman", "engine", "miser", "rock", "blade"]
  };
  function archOf(rid, slot, city) {
    // England first and by SLOT: three of its counties play in London, so a
    // city key would hand Surrey and Middlesex the flagship's identity.
    if (rid === "eng") return ENG_ARCH[slot] || ENG_ARCH[0];
    var named = (CITY_ARCH[rid] || {})[city];
    if (named) return named;
    var pal = NAT_ARCH[rid] || ["engine"];
    return pal[h32(rid + "|arch|" + slot) % pal.length];
  }
  // THE LADDER, dealt so that the sides the game has written about stand above
  // the ones it has not. A club with a described character is one a supporter has
  // heard of, so Mumbai and Kolkata take the high rungs and the filler CCs take
  // the low ones; within each group the order is a pure function of the nation,
  // so the second-best side is a different slot in every league.
  function strOf(rid, slot) {
    if (slot === 0) return FO_BOSS_STR;
    if (slot >= 8) {
      // a founding seat: the second division's own ladder, shuffled per nation
      var o2 = [8, 9, 10, 11, 12, 13, 14, 15].sort(function (a2, b2) {
        return rnd01(rid + "|rank2|" + a2) - rnd01(rid + "|rank2|" + b2);
      });
      var r2 = o2.indexOf(slot);
      return FO_D2_LADDER[r2 < 0 ? 3 : r2];
    }
    var named = CITY_ARCH[rid] || {};
    var known = {};
    if (rid !== "eng") {
      var cities = (cx().cities(rid) || []).concat(EXTRA_CITY[rid] || []);
      for (var s2 = 1; s2 <= 7; s2++) if (named[cities[s2]]) known[s2] = 1;
    }
    var order = [1, 2, 3, 4, 5, 6, 7].sort(function (a, b) {
      var ka = known[a] ? 0 : 1, kb = known[b] ? 0 : 1;
      if (ka !== kb) return ka - kb;
      return rnd01(rid + "|rank|" + a) - rnd01(rid + "|rank|" + b);
    });
    var rank = order.indexOf(slot);
    return FO_STR_LADDER[rank < 0 ? 3 : rank];
  }

  // ---- THE CONDITIONS: WHAT KIND OF CRICKET A PLACE PLAYS -------------------
  // Until now the served world bowled every ball on a 'balanced' pitch under a
  // default sky - six pitches and ten skies sat in the engine, dormant. Each
  // nation now has a climate (what its grounds and weather tend to produce),
  // and each HOME CLUB tilts its own square toward the cricket it plays, the
  // way real groundsmen do: a pace battery's home leans green, a spin circus's
  // leans dry. Deterministic per fixture - country, home slot, season, round -
  // and nothing else, so the forecast is knowable before a sheet is set, the
  // same for a manager asleep in another timezone as for one watching live,
  // and a healed day reproduces the very match it heals.
  var COND_DEFAULT = { p: { balanced: 45, green: 15, dry: 12, slow: 13, cracked: 5, twoPaced: 10 },
    w: { Sunny: 55, Overcast: 15, Hot: 15, Windy: 15 } };
  var NAT_COND = {
    // the wet green north: seam, cloud, and the ever-present forecast
    eng: { p: { green: 32, balanced: 38, dry: 4, slow: 6, cracked: 6, twoPaced: 14 },
      w: { Sunny: 24, Overcast: 38, Drizzle: 12, Chilly: 12, Windy: 8, Misty: 6 } },
    wal: { p: { green: 34, balanced: 36, dry: 4, slow: 6, cracked: 6, twoPaced: 14 },
      w: { Sunny: 22, Overcast: 38, Drizzle: 13, Chilly: 13, Windy: 8, Misty: 6 } },
    ire: { p: { green: 40, balanced: 32, dry: 2, slow: 8, cracked: 4, twoPaced: 14 },
      w: { Sunny: 18, Overcast: 40, Drizzle: 15, Chilly: 12, Windy: 10, Misty: 5 } },
    sco: { p: { green: 42, balanced: 30, dry: 2, slow: 8, cracked: 4, twoPaced: 14 },
      w: { Sunny: 16, Overcast: 38, Drizzle: 15, Chilly: 18, Windy: 10, Misty: 3 } },
    ned: { p: { green: 34, balanced: 38, dry: 3, slow: 8, cracked: 3, twoPaced: 14 },
      w: { Sunny: 26, Overcast: 34, Drizzle: 10, Chilly: 10, Windy: 20 } },
    nzl: { p: { green: 38, balanced: 34, dry: 3, slow: 7, cracked: 4, twoPaced: 14 },
      w: { Sunny: 26, Overcast: 32, Drizzle: 10, Chilly: 12, Windy: 20 } },
    // the true, hard grounds of the south: carry, cracks late, sun
    aus: { p: { green: 22, balanced: 44, dry: 6, slow: 4, cracked: 14, twoPaced: 10 },
      w: { Sunny: 44, Hot: 22, Scorching: 10, Overcast: 12, Windy: 12 } },
    rsa: { p: { green: 28, balanced: 40, dry: 6, slow: 6, cracked: 10, twoPaced: 10 },
      w: { Sunny: 44, Hot: 20, Overcast: 18, Windy: 12, 'Dew later': 6 } },
    // the subcontinent: turn, heat, dew under lights
    sub: { p: { green: 3, balanced: 20, dry: 44, slow: 20, cracked: 5, twoPaced: 8 },
      w: { Sunny: 30, Hot: 26, Scorching: 12, Humid: 18, 'Dew later': 14 } },
    slk: { p: { green: 3, balanced: 20, dry: 34, slow: 32, cracked: 3, twoPaced: 8 },
      w: { Sunny: 28, Hot: 22, Humid: 34, 'Dew later': 16 } },
    pak: { p: { green: 5, balanced: 40, dry: 34, slow: 10, cracked: 5, twoPaced: 6 },
      w: { Sunny: 40, Hot: 28, Scorching: 14, Humid: 10, 'Dew later': 8 } },
    afg: { p: { green: 3, balanced: 22, dry: 42, slow: 14, cracked: 13, twoPaced: 6 },
      w: { Sunny: 44, Hot: 26, Scorching: 12, Windy: 12, Chilly: 6 } },
    bgd: { p: { green: 2, balanced: 18, dry: 36, slow: 32, cracked: 4, twoPaced: 8 },
      w: { Sunny: 22, Hot: 24, Humid: 36, 'Dew later': 18 } },
    nep: { p: { green: 4, balanced: 24, dry: 38, slow: 22, cracked: 6, twoPaced: 6 },
      w: { Sunny: 40, Hot: 16, Chilly: 16, Windy: 14, Misty: 14 } },
    // the Caribbean and the drop-in world: slow, grippy, two-paced
    win: { p: { green: 4, balanced: 22, dry: 12, slow: 34, cracked: 6, twoPaced: 22 },
      w: { Sunny: 40, Hot: 26, Humid: 22, Windy: 12 } },
    usa: { p: { green: 6, balanced: 24, dry: 8, slow: 32, cracked: 6, twoPaced: 24 },
      w: { Sunny: 46, Hot: 22, Overcast: 16, Windy: 16 } },
    can: { p: { green: 8, balanced: 26, dry: 6, slow: 30, cracked: 6, twoPaced: 24 },
      w: { Sunny: 40, Overcast: 22, Chilly: 20, Windy: 18 } },
    // African highveld-adjacent: honest surfaces slowing with wear
    zim: { p: { green: 8, balanced: 36, dry: 16, slow: 24, cracked: 8, twoPaced: 8 },
      w: { Sunny: 50, Hot: 22, Overcast: 14, Windy: 14 } },
    ken: { p: { green: 8, balanced: 38, dry: 16, slow: 22, cracked: 8, twoPaced: 8 },
      w: { Sunny: 48, Hot: 24, Overcast: 14, Windy: 14 } }
  };
  // the groundsman leans the home square toward the home side's cricket
  var ARCH_TILT = {
    express: { green: 22 }, wizard: { dry: 22 }, miser: { slow: 14 },
    rock: { balanced: 12 }, blade: { balanced: 12 }, finisher: { balanced: 12 },
    greybeard: { slow: 8 }, engine: { green: 8 }, gloveman: {}, prodigy: {}
  };
  function pickWeighted(tbl, r) {
    var total = 0, k;
    for (k in tbl) total += Math.max(0, tbl[k] || 0);
    if (!(total > 0)) return null;
    var at = r * total;
    for (k in tbl) { at -= Math.max(0, tbl[k] || 0); if (at < 0) return k; }
    for (k in tbl) return k;
    return null;
  }
  // A BOT PLAYS ITS ARCHETYPE - and the umpire and the broadcast read the
  // SAME doctrine, so the match the theatre replays is the match the world
  // recorded. A claimed club's own sheet always wins; this only speaks for
  // clubs whose manager is the archetype itself.
  var ARCH_DOCTRINE = {
    blade:     { phaseIntent: { pp: 1,  mid: 0, death: 1 } },
    finisher:  { phaseIntent: { pp: 0,  mid: 0, death: 2 } },
    rock:      { phaseIntent: { pp: -1, mid: 0, death: 1 } },
    greybeard: { phaseIntent: { pp: -1, mid: 0, death: 0 } }
  };
  function doctrineOf(rid, slot) {
    try {
      var side = sidesOf(rid)[slot | 0];
      var d = side && ARCH_DOCTRINE[side.arch];
      return d ? JSON.parse(JSON.stringify(d)) : null;
    } catch (e) { return null; }
  }

  function condOf(rid, homeSlot, seasonNo, round) {
    var prof = NAT_COND[rid] || COND_DEFAULT;
    var p = {}, k;
    for (k in prof.p) p[k] = prof.p[k];
    try {
      var side = sidesOf(rid)[homeSlot | 0];
      var tilt = (side && ARCH_TILT[side.arch]) || {};
      for (k in tilt) p[k] = (p[k] || 0) + tilt[k];
    } catch (e) {}
    var key = "cond|" + rid + "|" + (homeSlot | 0) + "|" + (seasonNo | 0) + "|" + (round | 0);
    return {
      pitch: pickWeighted(p, rnd01(key + "|p")) || "balanced",
      weather: pickWeighted(prof.w, rnd01(key + "|w")) || "Sunny"
    };
  }

  function sidesOf(rid) {
    if (rid === "eng") return ENG_SIDES.map(function (s0) {
      return { slot: s0.slot, boss: !!s0.boss, name: s0.name, city: s0.city, div: s0.slot < 8 ? 1 : 2,
        arch: archOf("eng", s0.slot, s0.city), str: strOf("eng", s0.slot) };
    });
    var r = regionById(rid); if (!r) return [];
    var cities = (cx().cities(rid) || []).concat(EXTRA_CITY[rid] || []);
    var bc = null; (r.clubs || []).forEach(function (c) { if (c.boss) bc = c; });
    var bossCity = (bc && bc.city) || cities[0] || r.nm;
    var out = [{ slot: 0, boss: true, name: bc ? bc.nm : (r.nm + " XI"), city: bossCity, div: 1,
      arch: archOf(rid, 0, bossCity), str: strOf(rid, 0) }];
    for (var s = 1; s <= 7; s++) {
      var ct = cities[s] || (r.nm + " " + s);
      out.push({ slot: s, boss: false, name: ct + " CC", city: ct, div: 1,
        arch: archOf(rid, s, ct), str: strOf(rid, s) });
    }
    // the founding seats: the eight small clubs of Division Two
    var d2 = DIV2_CITY[rid] || [];
    for (var s9 = 8; s9 <= 15; s9++) {
      var ct2 = d2[s9 - 8] || (r.nm + " " + s9);
      out.push({ slot: s9, boss: false, name: div2Name(rid, s9, ct2), city: ct2, div: 2,
        arch: archOf(rid, s9, ct2), str: strOf(rid, s9) });
    }
    return out;
  }
  // double round robin for ONE DIVISION of 8 by the circle method, team order
  // reshuffled every season. `slots` is the division's eight member slots -
  // membership is seasonal (promotion and relegation redraw it), the founding
  // assumption being div 1 = slots 0-7, div 2 = slots 8-15. MUST agree with
  // server/clock.mjs scheduleOf, fixture for fixture.
  function schedOf(rid, season, slots, div) {
    var members = slots || (div === 2 ? [8, 9, 10, 11, 12, 13, 14, 15] : [0, 1, 2, 3, 4, 5, 6, 7]);
    var N = members.length, idx = [];
    for (var z = 0; z < N; z++) idx.push(z);
    var seed = h32(rid + "|order|d" + (div || 1) + "|" + season);
    for (var i = N - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; var j = seed % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var list = idx.slice(), rounds = [];
    for (var r = 0; r < N - 1; r++) {
      var rd = [];
      for (var k = 0; k < N / 2; k++) { var a = list[k], b = list[N - 1 - k]; rd.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(rd);
      list = [list[0], list[N - 1]].concat(list.slice(1, N - 1)); // rotate all but the pivot
    }
    for (var r2 = 0; r2 < N - 1; r2++) rounds.push(rounds[r2].map(function (f) { return [f[1], f[0]]; }));
    return rounds.map(function (rd2) { return rd2.map(function (f) { return [members[f[0]], members[f[1]]]; }); });
  }
  // one seeded, plausible fifty-over scoreline
  function playMatch(rid, season, round, A, B) {
    var key = rid + "|" + season + "|" + round + "|" + A.slot + "|" + B.slot;
    var base = 205 + Math.floor(rnd01(key + "|base") * 115);
    var first = Math.max(140, Math.min(372, Math.round(base * (0.92 + (A.str - B.str) * 0.22 + rnd01(key + "|v") * 0.16))));
    var fw = Math.min(10, 3 + Math.floor(rnd01(key + "|fw") * 8));
    var pA = Math.max(0.12, Math.min(0.88, 0.5 + (A.str - B.str) * 1.35));
    var tie = rnd01(key + "|tie") < 0.014;
    var winA = !tie && rnd01(key + "|w") < pA;
    var second, sw, text;
    if (tie) { second = first; sw = Math.min(10, 6 + Math.floor(rnd01(key + "|tw") * 4)); text = "Match tied"; }
    else if (winA) {
      second = first - (4 + Math.floor(rnd01(key + "|mg") * Math.min(90, first - 60)));
      sw = 10; text = A.name + " win by " + (first - second) + " runs";
    } else {
      second = first + 1 + Math.floor(rnd01(key + "|xr") * 5);
      sw = 10 - (1 + Math.floor(rnd01(key + "|wl") * 8));
      text = B.name + " win by " + (10 - sw) + " wickets";
    }
    return {
      home: A, away: B, first: first, fw: fw, second: second, sw: sw, tie: tie,
      winner: tie ? null : (winA ? A : B), text: text,
      hs: first + (fw >= 10 ? " all out" : "/" + fw),
      as: second + (sw >= 10 ? " all out" : "/" + sw)
    };
  }
  function fixturesOf(rid, season, round, div) {
    var S = sidesOf(rid); if (S.length < 16) return [];
    var by = {}; S.forEach(function (s) { by[s.slot] = s; });
    var divs = div ? [div] : [1, 2], out = [];
    divs.forEach(function (d) {
      ((schedOf(rid, season, null, d) || [])[round - 1] || []).forEach(function (f) {
        out.push(playMatch(rid, season, round, by[f[0]], by[f[1]]));
      });
    });
    return out;
  }
  function tableOf(rid, season, uptoRounds, div) {
    var d = div || 1;
    var S = sidesOf(rid).filter(function (s) { return (s.div || 1) === d; }), T = {};
    S.forEach(function (s) { T[s.slot] = { side: s, P: 0, W: 0, L: 0, T: 0, pts: 0, diff: 0 }; });
    for (var r = 1; r <= Math.min(ROUNDS, uptoRounds); r++) {
      fixturesOf(rid, season, r, d).forEach(function (m) {
        var a = T[m.home.slot], b = T[m.away.slot];
        a.P++; b.P++; a.diff += m.first - m.second; b.diff += m.second - m.first;
        if (m.tie) { a.T++; b.T++; a.pts++; b.pts++; }
        else if (m.winner === m.home) { a.W++; a.pts += 2; b.L++; }
        else { b.W++; b.pts += 2; a.L++; }
      });
    }
    return Object.keys(T).map(function (k) { return T[k]; })
      .sort(function (x, y) { return y.pts - x.pts || y.diff - x.diff || x.side.slot - y.side.slot; });
  }
  function championOf(rid, season) { var t = tableOf(rid, season, ROUNDS); return t[0] && t[0].side; }

  // ---- the World Cup: sixteen nations, four days, one crown ------------------
  function wcEntrants(season) {
    return regionList().map(function (r) {
      return { rid: r.id, nm: r.nm, seedv: rnd01("wc|" + season + "|" + r.id) };
    }).sort(function (a, b) { return b.seedv - a.seedv; }).slice(0, 16);
  }
  function wcBracket(season) {
    var e = wcEntrants(season), stages = [], cur = [];
    for (var i = 0; i < 8; i++) cur.push([e[i], e[15 - i]]);
    ["r16", "qf", "sf", "final"].forEach(function (st) {
      var out = [], next = [];
      cur.forEach(function (pair, gi) {
        var k = "wcm|" + season + "|" + st + "|" + gi;
        var w = rnd01(k) < 0.5 + (pair[0].seedv - pair[1].seedv) * 0.6 ? pair[0] : pair[1];
        var loser = w === pair[0] ? pair[1] : pair[0];
        var m = playMatch("wc" + gi, season, 90 + stages.length, { slot: 0, name: pair[0].nm, str: 1 + pair[0].seedv * 0.1 }, { slot: 1, name: pair[1].nm, str: 1 + pair[1].seedv * 0.1 });
        out.push({ a: pair[0], b: pair[1], winner: w, loser: loser, hs: m.hs, as: m.as, text: (w.nm + (m.winner && m.winner.name === w.nm ? m.text.slice(m.winner.name.length) : " win")) });
        next.push(w);
      });
      stages.push({ stage: st, matches: out });
      cur = []; for (var j = 0; j < next.length; j += 2) cur.push([next[j], next[j + 1]]);
    });
    return stages;
  }
  function wcChampion(season) { var s = wcBracket(season); return s[3].matches[0].winner; }
  // stage visibility at `now`: which cup days are final
  var WC_HOURS = [12, 12, 18, 18];             // early rounds at noon; semis and THE FINAL in prime time
  function wcStagesDone(now, season) {
    var p = phaseOf(now); if (season < p.season) return 4;
    if (season > p.season) return 0;
    if (p.di < CUP_DAYS.r16) return 0;
    var base = p.di - CUP_DAYS.r16;
    var doneToday = hourOfDay(now) >= WC_HOURS[Math.min(3, base)] + LIVE_LEN ? 1 : 0;
    return Math.min(4, base + doneToday);
  }

  // ---- live partial scores (10:00-14:00 UTC, deterministic by the minute) ----
  function liveView(m, now, h0) {
    if (h0 == null) h0 = 14;
    var h1 = h0 + LIVE_LEN, h = hourOfDay(now);
    if (h < h0) return { state: "up", at: h0 };
    if (h >= h1) return { state: "fin", line: m.hs + " · " + m.as, text: m.text };
    var p = (h - h0) / (h1 - h0), ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    if (p < 0.52) {
      var q = p / 0.52, ov = Math.min(49, Math.floor(q * 50));
      return { state: "live", line: m.home.name + " " + Math.floor(m.first * (q * 0.85 + ease * 0.15)) + "/" + Math.min(m.fw >= 10 ? 9 : m.fw, Math.floor(q * m.fw)) + " (" + ov + " ov)" };
    }
    var q2 = (p - 0.52) / 0.48, ov2 = Math.min(49, Math.floor(q2 * 50));
    return { state: "live", line: m.away.name + " " + Math.floor(m.second * q2) + "/" + Math.min(m.sw >= 10 ? 9 : m.sw, Math.floor(q2 * m.sw)) + " (" + ov2 + " ov) · chasing " + (m.first + 1) };
  }

  // ---- the wire: yesterday's stories, told by the results --------------------
  function genWire(now) {
    var out = [], p = phaseOf(now);
    var addLeague = function (ph) {
      if (ph.kind !== "league") return;
      regionList().forEach(function (r) {
        if (r.id === myNation()) return;
        // settled-per-region: each nation's round closes at its own hour
        if (roundsDone(now, ph.season, r.id) < ph.round) return;
        var fx = fixturesOf(r.id, ph.season, ph.round);
        var big = fx.slice().sort(function (a, b) { return Math.abs(b.first - b.second) - Math.abs(a.first - a.second); })[0];
        if (!big) return;
        var stars = "";
        try { if (window.__foStars) stars = window.__foStars.suffix(r.id, ph.season, ph.round, big); } catch (eS) {}
        out.push({ day: ph.day, season: ph.season, dayInSeason: ph.di, phase: "league", category: "league", importance: 40 + (h32(r.id + ph.day) % 30), headline: r.nm + ", round " + ph.round + ": " + big.text + stars });
      });
    };
    addLeague(p); addLeague(phaseOf(now - DAY));
    if (p.kind === "cup" || p.kind === "rest" || phaseOf(now - DAY).kind === "cup") {
      var st = wcStagesDone(now, p.season);
      if (st >= 4) { var ch = wcChampion(p.season); out.push({ day: p.day, season: p.season, dayInSeason: p.di, phase: "cup", category: "cup", importance: 100, headline: "CHAMPIONS OF THE WORLD: " + ch.nm + " lift the World Cup" }); }
      else if (st > 0) { var stg = wcBracket(p.season)[st - 1]; stg.matches.forEach(function (m) { out.push({ day: p.day, season: p.season, dayInSeason: p.di, phase: "cup", category: "cup", importance: 80, headline: "World Cup: " + m.winner.nm + " past " + m.loser.nm + " (" + m.hs + " v " + m.as + ")" }); }); }
    }
    if (p.kind === "honours" || p.di === CUP_DAYS.r16) {
      regionList().forEach(function (r) {
        if (r.id === myNation()) return;
        var c = championOf(r.id, p.season);
        if (c) out.push({ day: p.day, season: p.season, dayInSeason: p.di, phase: "league", category: "title", importance: 90, headline: r.nm + " have their champions: " + c.name + " take the season " + p.season + " pennant" });
      });
      // the off-season farewells: eras end, and the wire says goodbye properly
      try {
        if (window.__foStars) window.__foStars.retirees(p.season).forEach(function (rt) {
          out.push({ day: p.day, season: p.season, dayInSeason: p.di, phase: "league", category: "retire", importance: 72, headline: "A farewell at " + rt.club + ": " + rt.name + " (" + rt.nat + ") walks off for the last time" });
        });
      } catch (eRt) {}
    }
    return out.sort(function (a, b) { return b.importance - a.importance; }).slice(0, 24);
  }

  function myNation() {
    try { return (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (e) { return "eng"; }
  }

  // ---- overwrite the baked snapshot: the old surfaces come alive -------------
  function overrideSnapshot(now) {
    try {
      if (!cx()) return false;
      var sn = window.FO_WORLD_SNAPSHOT || (window.FO_WORLD_SNAPSHOT = {});
      var p = phaseOf(now);
      sn.leagues = regionList().map(function (r) {
        var rd = roundsDone(now, p.season, r.id);
        var t = tableOf(r.id, p.season, rd);
        return {
          regionId: r.id, name: r.nm + " League",
          winner: rd >= ROUNDS ? (t[0] && t[0].side.name) : null,
          table: t.map(function (row) {
            return { id: row.side.boss ? r.id + "-boss" : r.id + "-b" + row.side.slot, name: row.side.name, kind: row.side.boss ? "boss" : "bot", P: row.P, W: row.W, L: row.L, T: row.T, pts: row.pts };
          })
        };
      });
      sn.wire = genWire(now);
      sn.season = p.season; sn.asOfDay = p.day; sn.matchday = p.kind === "league" ? p.round : null;
      sn.status = "live";
      return true;
    } catch (e) { try { console.warn("foPlanetSnapshot", e); } catch (e2) {} return false; }
  }

  // ---- your countrymen: which of YOUR players would the selectors call? ------
  var NATCODES = { "england": ["eng"], "australia": ["aus"], "india": ["ind", "sub"], "pakistan": ["pak"], "sri lanka": ["sri", "slk", "sl"], "new zealand": ["nz", "nzl"], "south africa": ["saf", "rsa", "sa"], "west indies": ["wi", "win"], "netherlands": ["ned", "nl", "hol"], "ireland": ["ire", "irl"], "afghanistan": ["afg"], "zimbabwe": ["zim"], "bangladesh": ["ban", "bgd"], "nepal": ["nep"], "scotland": ["sco"], "wales": ["wal"], "kenya": ["ken"], "usa": ["usa"], "canada": ["can"] };
  function callUps(region) {
    try {
      var t = (typeof userTeam === "function") ? userTeam() : null; if (!t || !t.players) return [];
      var cty = String(region.cty || region.nm || "").toLowerCase();
      var codes = NATCODES[cty] || [cty];
      var mine = t.players.filter(function (pl) {
        var n = String(pl.nat || "").toLowerCase();
        return n === cty || codes.indexOf(n) >= 0;
      });
      mine.sort(function (a, b) { return ((typeof foPkOvr === "function" ? foPkOvr(b) : b.rating || 0) - (typeof foPkOvr === "function" ? foPkOvr(a) : a.rating || 0)); });
      return mine.slice(0, 3).map(function (pl) { return pl.name; });
    } catch (e) { return []; }
  }

  // ---- the page: World Cricket, today ----------------------------------------
  function fmtCountdown(ms) {
    if (ms <= 0) return "now";
    var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return (h ? h + "h " : "") + m + "m";
  }
  function hh(n) { return (n < 10 ? "0" : "") + Math.floor(n) + ":00"; }
  function todayStatus(now) {
    // no round scheduled today means no LIVE, whatever the clock says -
    // the chip only lights when a league round is genuinely in progress
    var p = phaseOf(now);
    if (p.kind !== "league") {
      if (p.preseason) {
        var toGo = ANCHOR.start - dayIx(now);
        return { key: "up", liveIds: [], chip: "Season " + ANCHOR.season + " opens " + (toGo === 1 ? "tomorrow" : "in " + toGo + " days") };
      }
      return { key: "fin", liveIds: [],
        chip: p.kind === "cup" ? "World Cup week - " + stageName(p.stage) :
              p.kind === "honours" ? "Honours night - no league play today" :
              p.kind === "draw" ? "World Cup draw day - no league play" :
              "Rest day - the new season starts tomorrow" };
    }
    var h = hourOfDay(now), liveIds = [], nextAt = null;
    regionList().forEach(function (r) {
      var h0 = natHour(r.id);
      if (h >= h0 && h < h0 + LIVE_LEN) liveIds.push(r.id);
      else if (h < h0 && (nextAt == null || h0 < nextAt)) nextAt = h0;
    });
    if (liveIds.length) return { key: "live", liveIds: liveIds, chip: "LIVE now in " + liveIds.length + " " + (liveIds.length === 1 ? "nation" : "nations") };
    if (nextAt != null) return { key: "up", liveIds: [], chip: "Next play " + hh(nextAt) + " UTC" };
    return { key: "fin", liveIds: [], chip: "The world's play is done for today" };
  }
  function stageName(st) { return { r16: "The Last Sixteen", qf: "Quarter-finals", sf: "Semi-finals", final: "THE WORLD CUP FINAL" }[st] || st; }

  // one repaint for however many nations answer at once: nineteen snapshots
  // landing in the same second must not repaint the page nineteen times
  var repaintT = null;
  function planetRepaint() {
    if (repaintT) return;
    repaintT = setTimeout(function () {
      repaintT = null;
      try {
        if ((location.hash || "").split("?")[0] !== "#/planet") return;
        foRenderPlanetPage();
      } catch (e) {}
    }, 260);
  }

  function foRenderPlanetPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/planet") return;
      if (!cx()) return;
      var page = document.getElementById("page"); if (!page) return;
      try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on"); } catch (eB) {}
      var now = Date.now(), p = phaseOf(now), st = todayStatus(now);
      overrideSnapshot(now);
      var my = myNation(), myRegion = regionById(my) || { nm: "England" };
      var A = artBase();
      var flagOf = function (rid) { return A + "flags/" + cx().flagFile(rid) + ".svg"; };

      // the globe as a dial: nations ordered by their hour, live ones lit
      var hNow = hourOfDay(now);
      var band = regionList().slice().sort(function (a, b) { return natHour(a.id) - natHour(b.id) || (a.nm < b.nm ? -1 : 1); }).map(function (r) {
        var h0 = natHour(r.id);
        var st2 = (p.kind === "league") ? (hNow >= h0 && hNow < h0 + LIVE_LEN ? "on" : hNow >= h0 + LIVE_LEN ? "done" : "up") : "up";
        // a live nation's flag is a door to the world theatre; the rest open the nation page
        var dest = st2 === "on" ? "#/watch?n=" + encodeURIComponent(r.id) : "#/nation?n=" + encodeURIComponent(r.id);
        return "<a class='fo-pl-tz " + st2 + (r.id === my ? " me" : "") + "' href='" + dest + "' aria-label='" + E(r.nm) + "'>" +
          "<img src='" + flagOf(r.id) + "' alt='' onerror=\"this.style.display='none'\"><i>" + hh(h0).slice(0, 2) + "</i></a>";
      }).join("");
      var bandHTML = "<div class='fo-pl-band'><i>The world by the hour &middot; UTC</i><div class='fo-pl-bandrow'>" + band + "</div></div>";

      var phaseLine =
        p.preseason ? "The world is founded and the squads are named - season " + ANCHOR.season + " " + ((ANCHOR.start - dayIx(now)) === 1 ? "begins tomorrow" : "begins in " + (ANCHOR.start - dayIx(now)) + " days") :
        p.kind === "league" ? "Round " + p.round + " of " + ROUNDS + " across the world's leagues" :
        p.kind === "honours" ? "Honours day - champions are crowned tonight" :
        p.kind === "draw" ? "World Cup draw day - sixteen nations learn their fate" :
        p.kind === "cup" ? "World Cup - " + stageName(p.stage) :
        "Rest day - the season " + (p.season + 1) + " calendar begins tomorrow";

      // -- your own league card: the WORLD's league, your claimed club -------
      // one world: this card speaks only served data - your claim, the served
      // standings, today's served fixture - never the retired private league
      var ownCard = "";
      try {
        var wclP = null; try { wclP = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eW) {}
        var svP = null; try { svP = window.__foWorldLg ? window.__foWorldLg.get(my) : null; } catch (eL) {}
        try { if (window.__foWorldLg) window.__foWorldLg.want(my); } catch (eL2) {}
        var meNm2 = (wclP && wclP.country === my) ? wclP.club : null;
        var posTxt = "";
        if (meNm2 && svP && svP.table) {
          var ix2 = svP.table.findIndex(function (t2) { return t2.name === meNm2; });
          if (ix2 >= 0) { var pn = ix2 + 1; posTxt = " &middot; " + pn + (["th", "st", "nd", "rd"][(pn % 100 > 10 && pn % 100 < 14) ? 0 : Math.min(pn % 10, 4)] || "th"); }
        }
        var ldr3 = svP && svP.table && svP.table[0];
        var nxTxt = "";
        try {
          if (meNm2 && window.__foWT && window.__foWT.serverFixtures) {
            var svF2 = window.__foWT.serverFixtures(my, now);
            var f2 = (svF2.fx || []).filter(function (x2) { return x2.home.name === meNm2 || x2.away.name === meNm2; })[0];
            if (f2) nxTxt = " &middot; today: v " + E(f2.home.name === meNm2 ? f2.away.name : f2.home.name);
          }
        } catch (eF2) {}
        ownCard = "<a class='fo-pl-own' href='#/nation?n=" + encodeURIComponent(my) + "'>" +
          "<img class='fo-pl-flag' src='" + flagOf(my) + "' alt='' onerror=\"this.style.display='none'\">" +
          "<span class='fo-pl-ownt'><i>Your world league &middot; " + E(myRegion.nm) + "</i>" +
          "<b>" + E(meNm2 || "Your club awaits its claim") + posTxt + "</b>" +
          "<em>" + (ldr3 && (ldr3.pts | 0) > 0 ? E(ldr3.name) + " lead on " + (ldr3.pts | 0) + " pts" : "Season 1 of the served world") + nxTxt + "</em></span><u>&rsaquo;</u></a>";
      } catch (eOwn) {}

      // -- the world cup panel (draw day through rest day) --------------------
      var cupHTML = "";
      if (p.di >= HONOURS_DAY) {
        var stagesDone = wcStagesDone(now, p.season);
        var bracket = wcBracket(p.season);
        var ents = wcEntrants(p.season);
        var myIn = ents.some(function (e) { return e.rid === my; });
        var ups = callUps(myRegion);
        // YOUR dressing room at the cup: any player of yours - homegrown or a
        // winter-window signing - whose nation made the sixteen gets the call
        var abroad = [];
        ents.forEach(function (e2) {
          if (e2.rid === my) return;
          var reg2 = regionById(e2.rid); if (!reg2) return;
          callUps(reg2).forEach(function (n2) { abroad.push(n2 + " (" + reg2.nm + ")"); });
        });
        var stageRows = bracket.map(function (sg, si) {
          var visible = si < stagesDone || (p.kind === "cup" && ["r16", "qf", "sf", "final"][si] === p.stage);
          var liveNow = p.kind === "cup" && ["r16", "qf", "sf", "final"][si] === p.stage && st.key === "live";
          if (!visible && si >= stagesDone) {
            return "<div class='fo-pl-stage dim'><i>" + stageName(sg.stage) + "</i><span>" + (si === stagesDone ? "Next · " + hh(WC_HOURS[si]) + " UTC" : "To come") + "</span></div>";
          }
          var done = si < stagesDone;
          return "<div class='fo-pl-stage'><i>" + stageName(sg.stage) + (liveNow && !done ? " <b class='lv'>LIVE</b>" : "") + "</i>" +
            sg.matches.map(function (m, gi2) {
              var mineM = m.a.rid === my || m.b.rid === my;
              // a finished tie opens its own match page
              var tag = done ? "a" : "div";
              var href = done ? " href='#/wcmatch?s=" + p.season + "&st=" + sg.stage + "&g=" + gi2 + "'" : "";
              return "<" + tag + " class='fo-pl-cm" + (mineM ? " mine" : "") + "'" + href + ">" +
                "<img src='" + flagOf(m.a.rid) + "' alt=''><span class='" + (done && m.winner === m.a ? "w" : "") + "'>" + E(m.a.nm) + "</span>" +
                "<u>v</u>" +
                "<span class='" + (done && m.winner === m.b ? "w" : "") + "'>" + E(m.b.nm) + "</span><img src='" + flagOf(m.b.rid) + "' alt=''>" +
                (done ? "<em>" + E(m.winner.nm) + " through &middot; " + m.hs + " v " + m.as + "</em>" : "") +
                "</" + tag + ">";
            }).join("") + "</div>";
        }).join("");
        var champLine = stagesDone >= 4 ? "<div class='fo-pl-crown'>&#127942; <b>" + E(wcChampion(p.season).nm) + "</b> are champions of the world</div>" : "";
        cupHTML = "<div class='fo-pl-cup'><div class='fo-pl-cuph'><i>Season " + p.season + " World Cup</i>" +
          (myIn ? "<span class='in'>" + E(myRegion.nm) + " are in" + (ups.length ? " &middot; called up: " + ups.map(E).join(", ") : "") + "</span>" : "<span class='in'>" + E(myRegion.nm) + " missed the cut this season</span>") +
          (abroad.length ? "<span class='in'>Your dressing room at the cup: " + abroad.map(E).join(", ") + "</span>" : "") +
          "</div>" + champLine + stageRows + "</div>";
      }

      // -- one card per rival nation: today's tallest fixture, the leader ----
      var natCards = "";
      if (p.kind === "league") {
        natCards = regionList().filter(function (r) { return r.id !== my; }).map(function (r) {
          var fx = fixturesOf(r.id, p.season, p.round);
          // THE REAL TABLE, NOT THE PAINTED ONE. These cards used to read the
          // local deterministic mirror for every rival nation, so South Africa
          // and India sat on nought all season while the umpire was banking
          // their results. Ask the world for each nation's standings - the
          // same snapshot their own page reads - and only fall back to the
          // mirror while it is in flight.
          var svN = null;
          try {
            if (window.__foWorldLg) {
              window.__foWorldLg.want(r.id, planetRepaint);
              svN = window.__foWorldLg.get(r.id);
            }
          } catch (eSv) {}
          if (svN && (!svN.seasonNo || svN.seasonNo !== p.season)) svN = null;
          var t = tableOf(r.id, p.season, roundsDone(now, p.season));
          var posOf = {}; t.forEach(function (row, i2) { posOf[row.side.slot] = i2 + 1; });
          if (svN && svN.table && svN.table.length) {
            posOf = {}; svN.table.forEach(function (row9, i9) { posOf[row9.slot] = i9 + 1; });
          }
          var feat = fx.slice().sort(function (a, b) { return (posOf[a.home.slot] + posOf[a.away.slot]) - (posOf[b.home.slot] + posOf[b.away.slot]); })[0];
          var lv = feat ? liveView(feat, now, natHour(r.id)) : null;
          // the card tells the truth: fixture names come from the server's
          // own schedule (same round, same circle method); a finished match
          // shows the RECORDED result when the served snapshot is in hand,
          // and never an invented scoreline
          var finTxt = null;
          try {
            var snb = window.__foWorldLg && window.__foWorldLg.get(r.id);
            if (feat && snb && snb.seasonNo === p.season) {
              var rr = (snb.results || []).filter(function (x) { return x.round === p.round && x.home === feat.home.name && x.away === feat.away.name; })[0];
              if (rr) finTxt = rr.text;
            }
          } catch (eF) {}
          var mid = !feat ? "" :
            lv.state === "up" ? "<em class='fx'>" + E(feat.home.name) + " v " + E(feat.away.name) + " &middot; " + hh(natHour(r.id)) + " UTC</em>" :
            lv.state === "live" ? "<em class='fx live'><b>LIVE</b> " + E(feat.home.name) + " v " + E(feat.away.name) + " &middot; in play now</em>" :
            "<em class='fx'>" + (finTxt ? E(finTxt) : E(feat.home.name) + " v " + E(feat.away.name) + " &middot; played &middot; tap for the result") + "</em>";
          var ldr2 = (svN && svN.table && svN.table.length)
            ? { side: { name: svN.table[0].name }, pts: svN.table[0].pts, p: svN.table[0].p }
            : t[0];
          // a nation in its live window wears an unmissable red LIVE button;
          // the card opens its matchday, where every live match has a
          // watch-in-the-theatre door
          var natLive = hNow >= natHour(r.id) && hNow < natHour(r.id) + LIVE_LEN;
          return "<a class='fo-pl-nat" + (natLive ? " live" : "") + "' href='#/nation?n=" + encodeURIComponent(r.id) + "'>" +
            "<img class='fo-pl-flag' src='" + flagOf(r.id) + "' alt='' onerror=\"this.style.display='none'\">" +
            "<span class='fo-pl-natt'><b>" + E(r.nm) + "</b>" + mid +
            "<u>" + (ldr2 ? (ldr2.p === 0 ? E(ldr2.side.name) + " &middot; no play yet"
              : E(ldr2.side.name) + " lead &middot; " + ldr2.pts + " pts") : "") + "</u></span>" +
            (natLive ? "<span class='fo-pl-livebtn'><i></i>LIVE</span>" : "<i>&rsaquo;</i>") + "</a>";
        }).join("");
      } else if (p.kind === "honours") {
        natCards = regionList().filter(function (r) { return r.id !== my; }).map(function (r) {
          var c = championOf(r.id, p.season);
          return "<a class='fo-pl-nat' href='#/nation?n=" + encodeURIComponent(r.id) + "'>" +
            "<img class='fo-pl-flag' src='" + flagOf(r.id) + "' alt='' onerror=\"this.style.display='none'\">" +
            "<span class='fo-pl-natt'><b>" + E(r.nm) + "</b><em class='fx'>&#127942; " + E(c ? c.name : "") + ", champions</em></span><i>&rsaquo;</i></a>";
        }).join("");
      }

      var wireItems = genWire(now).slice(0, 6).map(function (w) { return "<div class='fo-pl-wireln'>" + E(w.headline) + "</div>"; }).join("");

      page.innerHTML =
        "<div class='fo-pl'>" +
        "<div class='fo-pl-mast'>" +
        "<div class='fo-pl-kick'>World cricket &middot; Season " + p.season + " &middot; Day " + (p.di + 1) + " of " + CYCLE + "</div>" +
        "<h1>The Planet Plays Today</h1>" +
        "<p>" + E(phaseLine) + ". Every league runs on the world calendar, live from 10:00 UTC — online or offline, the same world for everyone.</p>" +
        // LIVE is a door, not a label: one live nation opens that nation's
        // matchday (every live match, watch buttons and all); several open
        // the theatre hub
        (st.key === "live"
          ? "<a class='fo-pl-chip live islink' href='" + (st.liveIds.length === 1
              ? (st.liveIds[0] === my ? "#/league" : "#/nation?n=" + encodeURIComponent(st.liveIds[0]))
              : "#/watch") + "'>&#9679; " + E(st.chip) + " &mdash; watch &rsaquo;</a>"
          : "<span class='fo-pl-chip " + st.key + "'>" + E(st.chip) + "</span>") +
        "</div>" +
        bandHTML + ownCard + cupHTML +
        (natCards ? "<div class='fo-pl-grid'>" + natCards + "</div>" : "") +
        (wireItems ? "<div class='fo-pl-wire'><i>The world wire</i>" + wireItems + "</div>" : "") +
        "<div class='fo-pl-foot'><a href='#/world'>The world map &rsaquo;</a><a href='#/champions'>The Champions Cup &rsaquo;</a><a href='#/nations'>The international game &rsaquo;</a><a href='#/rankings'>The world rankings &rsaquo;</a><a href='#/nation'>My league &rsaquo;</a><a href='#/almanack'>The world almanack &rsaquo;</a><a href='#/atlas'>The atlas &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderPlanetPage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-pl{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-pl-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-pl-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-pl-kick:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:7px}",
    "html body #page .fo-pl-mast h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:36px;letter-spacing:-.015em;margin:8px 0 8px;color:#141C28;line-height:1.02}",
    "html body #page .fo-pl-mast p{font:italic 420 13.5px/1.6 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin:0 0 12px;max-width:52ch}",
    "html body #page .fo-pl-chip{display:inline-block;font:700 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;border-radius:999px;padding:7px 13px}",
    "html body #page .fo-pl-chip.live{background:rgba(200,60,58,.12);color:#B23230}",
    // LIVE, loud: the chip becomes a solid red button when it is a door
    "html body #page a.fo-pl-chip.islink{background:#C83C3A !important;color:#FFFEFC !important;text-decoration:none !important;padding:11px 18px;font-size:11.5px;box-shadow:0 8px 22px rgba(200,60,58,.35);animation:foPlLivePulse 1.6s ease-in-out infinite}",
    "@keyframes foPlLivePulse{0%,100%{box-shadow:0 8px 22px rgba(200,60,58,.35)}50%{box-shadow:0 8px 30px rgba(200,60,58,.6)}}",
    "html body #page .fo-pl-nat.live{border-color:rgba(200,60,58,.55);box-shadow:0 4px 18px rgba(200,60,58,.18)}",
    "html body #page .fo-pl-livebtn{flex:none;display:inline-flex;align-items:center;gap:6px;font:800 11px/1 Oswald,sans-serif;letter-spacing:.14em;color:#FFFEFC;background:#C83C3A;border-radius:999px;padding:9px 14px;box-shadow:0 6px 16px rgba(200,60,58,.35)}",
    "html body #page .fo-pl-livebtn i{width:8px;height:8px;border-radius:50%;background:#FFFEFC;animation:foPlDot 1.2s ease-in-out infinite}",
    "@keyframes foPlDot{0%,100%{opacity:1}50%{opacity:.3}}",
    "html body #page .fo-pl-chip.up{background:rgba(20,28,40,.07);color:rgba(20,28,40,.6)}",
    "html body #page .fo-pl-chip.fin{background:rgba(31,158,114,.13);color:#177A57}",
    "html body #page .fo-pl-band{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:12px 14px}",
    "html body #page .fo-pl-band>i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal;margin-bottom:9px}",
    "html body #page .fo-pl-bandrow{display:flex;gap:7px;overflow-x:auto;padding-bottom:3px}",
    "html body #page .fo-pl-tz{flex:none;display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none}",
    "html body #page .fo-pl-tz img{width:30px;height:21px;object-fit:cover;border-radius:4px;border:2px solid transparent}",
    "html body #page .fo-pl-tz.on img{border-color:#B23230;box-shadow:0 0 0 3px rgba(178,50,48,.18);animation:foTzPulse 1.6s ease-in-out infinite}",
    "html body #page .fo-pl-tz.done img{opacity:.45}",
    "html body #page .fo-pl-tz.me img{border-color:#C95532}",
    "html body #page .fo-pl-tz i{font:700 8.5px/1 Oswald,sans-serif;color:rgba(20,28,40,.5);font-style:normal}",
    "html body #page .fo-pl-tz.on i{color:#B23230}",
    "@keyframes foTzPulse{0%,100%{box-shadow:0 0 0 3px rgba(178,50,48,.18)}50%{box-shadow:0 0 0 6px rgba(178,50,48,.08)}}",
    "html body #page .fo-pl-own{display:flex;align-items:center;gap:14px;margin-top:16px;background:#07162E;border-radius:18px;padding:16px 18px;text-decoration:none;color:#FFFEFC;box-shadow:0 16px 38px rgba(7,22,46,.35);border-bottom:2px solid #C95532}",
    "html body #page .fo-pl-own .fo-pl-flag{width:34px;height:24px;object-fit:cover;border-radius:4px}",
    "html body #page .fo-pl-ownt{flex:1;min-width:0}",
    "html body #page .fo-pl-ownt i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#E8B96A;font-style:normal}",
    "html body #page .fo-pl-ownt b{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:17px;margin-top:4px}",
    "html body #page .fo-pl-ownt em{display:block;font:italic 400 12px/1.4 'Fraunces',Georgia,serif;color:rgba(255,254,252,.75);margin-top:3px}",
    "html body #page .fo-pl-own u{text-decoration:none;font-size:20px;color:#E8B96A}",
    "html body #page .fo-pl-grid{display:flex;flex-direction:column;gap:6px;margin-top:14px}",
    "html body #page .fo-pl-nat{display:flex;align-items:center;gap:12px;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:13px;padding:11px 14px;text-decoration:none;color:#141C28;box-shadow:0 4px 14px rgba(30,38,52,.06);transition:border-color .15s ease}",
    "html body #page .fo-pl-nat:hover{border-color:rgba(217,85,42,.5);text-decoration:none}",
    "html body #page .fo-pl-nat .fo-pl-flag{width:28px;height:20px;object-fit:cover;border-radius:3px;flex:none}",
    "html body #page .fo-pl-natt{flex:1;min-width:0}",
    "html body #page .fo-pl-natt b{display:block;font:600 13px/1.2 Inter,sans-serif}",
    "html body #page .fo-pl-natt em.fx{display:block;font:400 11.5px/1.35 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.62);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-pl-natt em.fx.live b{color:#B23230;font-size:9px;letter-spacing:.1em}",
    "html body #page .fo-pl-natt u{display:block;text-decoration:none;font:400 10.5px/1 Inter,sans-serif;color:rgba(20,28,40,.42);margin-top:3px}",
    "html body #page .fo-pl-nat>i{font-style:normal;color:rgba(20,28,40,.35);font-size:16px}",
    "html body #page .fo-pl-cup{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:18px;padding:16px 18px;box-shadow:0 10px 30px rgba(30,38,52,.09)}",
    "html body #page .fo-pl-cuph i{display:block;font:700 10px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#B44A22;font-style:normal}",
    "html body #page .fo-pl-cuph .in{display:block;font:italic 420 12.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.65);margin-top:5px}",
    "html body #page .fo-pl-crown{font-family:'Fraunces',Georgia,serif;font-size:16px;margin:10px 0 2px;color:#141C28}",
    "html body #page .fo-pl-stage{margin-top:12px}",
    "html body #page .fo-pl-stage.dim{display:flex;justify-content:space-between;align-items:baseline;color:rgba(20,28,40,.4)}",
    "html body #page .fo-pl-stage.dim span{font:400 11px/1 Inter,sans-serif}",
    "html body #page .fo-pl-stage>i{display:block;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.5);font-style:normal;margin-bottom:6px}",
    "html body #page .fo-pl-stage>i b.lv{color:#B23230}",
    "html body #page .fo-pl-cm{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font:500 12.5px/1.3 Inter,sans-serif;padding:6px 0;border-top:1px solid rgba(20,28,40,.06);color:#141C28;text-decoration:none}",
    "html body #page a.fo-pl-cm:hover span{color:#B44A22}",
    "html body #page .fo-pl-cm.mine{background:rgba(217,85,42,.06);border-radius:8px;padding:6px 8px}",
    "html body #page .fo-pl-cm img{width:20px;height:14px;object-fit:cover;border-radius:2px}",
    "html body #page .fo-pl-cm span.w{font-weight:700}",
    "html body #page .fo-pl-cm u{text-decoration:none;color:rgba(20,28,40,.4);font-size:10.5px}",
    "html body #page .fo-pl-cm em{flex-basis:100%;font:400 10.5px/1.3 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.55)}",
    "html body #page .fo-pl-wire{margin-top:16px;background:linear-gradient(150deg,#FFFEFB,#F6F1E4) !important;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 18px}",
    "html body #page .fo-pl-wire>i{display:block;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#B44A22;font-style:normal;margin-bottom:8px}",
    "html body #page .fo-pl-wireln{font:italic 420 12.5px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.72);padding:4px 0;border-top:1px solid rgba(20,28,40,.05)}",
    "html body #page .fo-pl-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-pl-foot a{display:inline-flex;align-items:center;min-height:44px;font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:0 17px;text-decoration:none}",
    "html body #page .fo-pl-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:520px){html body #page .fo-pl-mast h1{font-size:29px}}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-pl-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-pl-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  // keep the snapshot alive from boot (record books and the desk read it),
  // and let the page tick while it is open so LIVE scores creep along
  function boot() { overrideSnapshot(Date.now()); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
  setInterval(function () {
    overrideSnapshot(Date.now());
    if ((location.hash || "").split("?")[0] === "#/planet") foRenderPlanetPage();
  }, 45000);
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] === "#/planet") setTimeout(foRenderPlanetPage, 40);
  });

  window.foRenderPlanetPage = foRenderPlanetPage;
  // the absolute world day a given season's round is played on - the one
  // answer every page that dates a fixture must ask for
  function dayOfSeasonRound(season, round) {
    var d = dayOfRound(round);
    if (d == null) return null;
    return seasonStart(season) + d;
  }
  // ---- THE NATIONAL CUP'S FIRST DRAW, MIRRORED -------------------------------
  // The umpire draws the Round of 16 by sorting all sixteen clubs on
  // seedOf('fa|<nation>|s<season>|r16|<slot>') and pairing them off - a pure
  // function of the nation and the season, settled the day the season opens.
  // So the tie is knowable before a ball is bowled, which is what a cup draw
  // is for. server/tick.mjs runFaCup is the authority; this must agree with it
  // slot for slot. Later rounds turn on results and cannot be drawn early.
  function faDayOf(season, stage) {
    var d = FA_DAYS[stage];
    return d == null ? null : seasonStart(season) + d;
  }
  function faDrawR16(rid, season, slots, divOf) {
    var field = (slots && slots.length ? slots.slice() : [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
    field.sort(function (a2, b2) {
      return h32("fa|" + rid + "|s" + season + "|r16|" + a2) - h32("fa|" + rid + "|s" + season + "|r16|" + b2);
    });
    var ties = [];
    for (var i = 0; i + 1 < field.length; i += 2) {
      var x = field[i], y = field[i + 1];
      // the smaller club hosts the giant
      var host = ((divOf && divOf[y]) || 1) > ((divOf && divOf[x]) || 1) ? y : x;
      ties.push([host, host === x ? y : x]);
    }
    return ties;
  }

  // ---- SAYING WHEN, IN ONE VOICE ---------------------------------------------
  // An hour with no date is an hour in no particular week: "14:00 UTC" on a
  // fixture card never told a manager whether to be there tonight or on Friday
  // week. The calendar lives here, so the words for it live here too, and
  // every card that dates a match prints the same ones.
  var DOW_NM = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON_NM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function hhTxt(h) { return (h < 10 ? "0" : "") + (h | 0) + ":00 UTC"; }
  function dateTxt(day, now) {
    if (day == null) return "";
    var today = dayIx(now == null ? Date.now() : now);
    if (day === today) return "Today";
    if (day === today + 1) return "Tomorrow";
    if (day === today - 1) return "Yesterday";
    var d = new Date(EPOCH + day * DAY);
    return DOW_NM[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON_NM[d.getUTCMonth()];
  }
  // the full stamp a fixture wears: the day it is played and the hour that
  // nation bowls its first ball
  function whenTxt(season, round, rid, now) {
    var d = dayOfSeasonRound(season, round);
    if (d == null) return "";
    return dateTxt(d, now) + " · " + hhTxt(rid == null ? 14 : natHour(rid));
  }
  window.__foPlanet = { roundOfDay: roundOfDay, dayOfRound: dayOfRound, dayOfSeasonRound: dayOfSeasonRound,
    anchorWorld: anchorWorld, anchorOf: anchorOf, seasonStart: seasonStart,
    dateTxt: dateTxt, hhTxt: hhTxt, whenTxt: whenTxt,
    FA_DAYS: FA_DAYS, faDayOf: faDayOf, faDrawR16: faDrawR16,
    WINDOWS: WINDOWS, WINDOW_DAYS: WINDOW_DAYS, LEAGUE_DAYS: LEAGUE_DAYS, CUP_DAYS: CUP_DAYS,
    phaseOf: phaseOf, roundsDone: roundsDone, sidesOf: sidesOf, condOf: condOf, doctrineOf: doctrineOf, fixturesOf: fixturesOf, schedOf: schedOf, tableOf: tableOf, championOf: championOf, wcEntrants: wcEntrants, wcBracket: wcBracket, wcChampion: wcChampion, wcStagesDone: wcStagesDone, liveView: liveView, genWire: genWire, overrideSnapshot: overrideSnapshot, natHour: natHour, dayIx: dayIx, EPOCH: EPOCH, CYCLE: CYCLE, ROUNDS: ROUNDS, DAY: DAY, LIVE_LEN: LIVE_LEN, WORLD_START: WORLD_START };
})();
