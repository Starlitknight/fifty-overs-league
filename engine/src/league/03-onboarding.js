  // ===========================================================================
  //  QUICK-START · "pick one starter, get a club"
  //  A new manager makes exactly three decisions - club name, home pitch, one
  //  franchise player - and a full squad is generated around that player with
  //  the archetype's flavour. Every bias below is REAL: it changes numbers the
  //  match engine actually reads, and the balance harness (tools/engine-bench.mjs)
  //  proves all ten squads land in a 40-60% win-rate band on neutral pitches.
  //  The full draft (foOnbStart) stays in the codebase behind league config.
  // ===========================================================================
  // quick-start replaces the draft for new clubs; a league with full_draft set
  // in its config gets the classic draft room back (the sponsor screen branches)
  var FO_TAKEOVER_ON = false;          // later seasons: take over a bot club (S1: off)
  // shared strength budget (best-XI weighted engine-rating sum) every squad is
  // normalised onto - same total, different shape. Measured by the harness.
  var FO_QS_T = (window.__FO_QS_T_OVERRIDE != null ? +window.__FO_QS_T_OVERRIDE : 1700);   // test hook: harness can pin/disable the budget

  // One config object per archetype: the card copy AND the real generation
  // biases live together so they can never drift apart.
  //   counts    - squad shape beyond the starter (keepers always total 2)
  //   focus     - which groups get the top of the quality ladder
  //   ages      - squad age range; bias - [who, {skill: multiplier}] applied
  //               BEFORE the equal-budget pass, so weaknesses survive it
  //   syn       - pitch synergy hints (never blocking)
  var FO_ARCHETYPES = [
    { id: "express", nm: "The Pace Battery", role: "Pace-heavy squad", starRole: "fast bowler", ic: "bolt",
      line: "A fast-bowling attack built to take early wickets.",
      chips: ["Pace-heavy attack", "Best on green pitches"], weak: "Thin spin options",
      counts: { opener: 2, top: 2, mid: 2, wk: 2, ar: 2, pace: 3, spin: 1 },
      focus: ["pace", "bat", "wk", "ar", "spin"],
      bias: [["bowlers", { wicket: 1.08, moveTurn: 1.08 }], ["batters", { vsSpin: 0.94 }]],
      talents: ["bouncer", "newBallSpecialist", "partnershipBreaker"],
      starter: { role: "seamFast", age: 26, talents: ["bouncer", "newBallSpecialist"] } },
    { id: "wizard", nm: "The Spin Circus", role: "Spin-heavy squad", starRole: "mystery wrist-spinner", ic: "spin",
      line: "A spin-heavy attack that controls the middle overs.",
      chips: ["Spin-heavy attack", "Best on dry pitches"], weak: "Weaker on green pitches",
      counts: { opener: 2, top: 2, mid: 2, wk: 2, ar: 2, pace: 1, spin: 3 },
      budgetMult: 1.047,
      focus: ["spin", "bat", "wk", "ar", "pace"],
      bias: [["bowlers", { moveTurn: 1.08, variation: 1.12 }], ["batters", { vsPace: 0.96 }]],
      talents: ["mysteryBall", "goldenArm", "partnershipBreaker"],
      starter: { role: "wristSpin", age: 27, talents: ["mysteryBall", "goldenArm"] } },
    { id: "rock", nm: "The Stonewall", role: "Technique-first batting", starRole: "anchor opener", ic: "shield",
      line: "Solid, patient batting that is hard to bowl out.",
      chips: ["Strong batting technique", "Keeps wickets in hand"], weak: "Slow to accelerate",
      counts: { opener: 2, top: 2, mid: 1, wk: 2, ar: 2, pace: 3, spin: 2 },
      budgetMult: 0.963,
      focus: ["bat", "wk", "pace", "ar", "spin"],
      bias: [["batters", { vsPace: 1.10, vsSpin: 1.10, temperament: 1.14, power: 0.70 }]],
      talents: ["anchor", "busyRunner", "safeHands"],
      starter: { role: "opener", age: 28, talents: ["anchor", "safeHands"] } },
    { id: "finisher", nm: "The Finishers", role: "Power-hitting order", starRole: "death-overs hitter", ic: "rocket",
      line: "Big hitters who do their best work late in the innings.",
      chips: ["Powerful late hitting", "Good in close chases"], weak: "Top order can collapse",
      counts: { opener: 2, top: 2, mid: 1, wk: 2, ar: 2, pace: 3, spin: 2 },
      budgetMult: 0.968,
      focus: ["bat", "ar", "wk", "pace", "spin"],
      bias: [["batters", { power: 1.24, rotation: 1.05, vsPace: 0.93, vsSpin: 0.93, temperament: 0.88 }]],
      talents: ["finisher", "sixMachine", "deathSpecialist"],
      starter: { role: "middleOrderBat", age: 27, talents: ["finisher", "sixMachine"] } },
    { id: "gloveman", nm: "The Safe Hands", role: "Elite fielding unit", starRole: "keeper-batter", ic: "gloves",
      line: "The best fielding and keeping in the league.",
      chips: ["Top keeping and fielding", "More catches and run-outs"], weak: "Modest bowling threat",
      counts: { opener: 2, top: 2, mid: 2, wk: 1, ar: 2, pace: 3, spin: 2 },
      budgetMult: 0.99,
      focus: ["wk", "bat", "pace", "ar", "spin"],
      bias: [["all", { fielding: 1.16, catching: 1.18 }], ["keepers", { keeping: 1.10, stumping: 1.10 }], ["bowlers", { wicket: 0.90 }]],
      talents: ["lightningHands", "safeHands", "rocketArm", "busyRunner"],
      starter: { role: "wicketkeeper", age: 27, talents: ["lightningHands", "safeHands"] } },
    { id: "prodigy", nm: "The Academy", role: "Youngest squad in the league", starRole: "young opener", ic: "spark",
      line: "A young squad that improves faster than anyone else's.",
      chips: ["Fastest training gains", "Most room to improve"], weak: "Starts weaker than the rest",
      counts: { opener: 2, top: 2, mid: 1, wk: 2, ar: 2, pace: 3, spin: 2 },
      focus: ["bat", "pace", "wk", "ar", "spin"],
      ages: [18, 21], budgetMult: 0.872, talentExtra: 1,
      bias: [],
      talents: ["busyRunner", "paceHunter", "spinKiller"],
      starter: { role: "opener", age: 18, talents: ["fastStarter", "busyRunner"] } },
    { id: "greybeard", nm: "The Old Guard", role: "Veteran core", starRole: "veteran captain", ic: "star",
      line: "Experienced players who keep their heads in tight games.",
      chips: ["Calm under pressure", "Experienced captaincy"], weak: "Tires quickly, improves slowly",
      counts: { opener: 2, top: 2, mid: 1, wk: 2, ar: 2, pace: 3, spin: 2 },
      budgetMult: 1.015,
      focus: ["bat", "pace", "wk", "ar", "spin"],
      ages: [29, 33], expAdj: 12, captAdj: 1.18,
      bias: [["all", { stamina: 0.78 }], ["batters", { temperament: 1.10 }]],
      talents: ["anchor", "partnershipBreaker", "miser"],
      starter: { role: "topOrderBat", age: 32, talents: ["anchor", "partnershipBreaker"] } },
    { id: "miser", nm: "The Stranglers", role: "Economy-first attack", starRole: "economy bowler", ic: "lock",
      line: "Accurate bowlers who keep the runs down.",
      chips: ["Very hard to score off", "Good in low-scoring games"], weak: "Fewer wicket-takers",
      counts: { opener: 2, top: 2, mid: 1, wk: 2, ar: 2, pace: 3, spin: 2 },
      budgetMult: 1.025,
      focus: ["pace", "spin", "bat", "wk", "ar"],
      bias: [["bowlers", { economy: 1.18, discipline: 1.15, variation: 1.05, wicket: 0.80 }]],
      talents: ["miser", "deathSpecialist", "newBallSpecialist"],
      starter: { role: "seamFastMedium", age: 28, talents: ["miser", "deathSpecialist"] } },
    { id: "blade", nm: "The Cavaliers", role: "Attacking strokeplay", starRole: "dashing strokeplayer", ic: "bat",
      line: "Aggressive batting that scores fast and takes risks.",
      chips: ["Fast scoring", "Sets big totals"], weak: "Shaky under pressure",
      counts: { opener: 2, top: 2, mid: 1, wk: 2, ar: 2, pace: 3, spin: 2 },
      budgetMult: 0.937,
      focus: ["bat", "ar", "wk", "pace", "spin"],
      expAdj: -10,
      bias: [["batters", { power: 1.14, rotation: 1.10, vsPace: 1.04, temperament: 0.80 }]],
      talents: ["fastStarter", "sixMachine", "paceHunter"],
      starter: { role: "opener", age: 25, talents: ["fastStarter", "sixMachine"] } },
    { id: "engine", nm: "The Engine Room", role: "All-rounder depth", starRole: "tireless all-rounder", ic: "gear",
      line: "All-rounders everywhere - everyone bats and everyone bowls.",
      chips: ["Batting and bowling depth", "Everyone contributes"], weak: "No elite specialist",
      counts: { opener: 2, top: 2, mid: 2, wk: 2, ar: 2, pace: 2, spin: 2 },
      budgetMult: 1.048,
      focus: ["ar", "bat", "wk", "pace", "spin"],
      flatQ: true, partTimers: 2,
      bias: [],
      talents: ["busyRunner", "goldenArm", "finisher"],
      starter: { role: "allRounder", age: 27, talents: ["goldenArm", "busyRunner"] } }
  ];

  // The captain pool - six named candidates a founding manager chose between -
  // is gone with the founding screens that showed it. It was the last place a
  // cricketer was built to be a club's captain for all time: frozen numbers, a
  // guaranteed pair of talents, and a "Talisman" loop that kept lifting one
  // man's skills until he outrated everybody. Captaincy is a match decision
  // and a skill on the card; it is not a kind of player.
  function foArchById(id) { for (var i = 0; i < FO_ARCHETYPES.length; i++) if (FO_ARCHETYPES[i].id === id) return FO_ARCHETYPES[i]; return FO_ARCHETYPES[0]; }

  // quality ladder for the 14 players behind the starter - the SAME multiset
  // for every archetype; the archetype only decides where the quality goes.
  var FO_QS_QL = [0.80, 0.73, 0.67, 0.62, 0.58, 0.545, 0.51, 0.48, 0.45, 0.425, 0.40, 0.375, 0.35, 0.33];

  // no duplicate first names or surnames inside one squad. Draw straight from
  // the engine's name banks with OUR rng: the overlay's natName wrapper
  // consults the live world (GD.teams counts, findPlayer), so going through it
  // would make the "deterministic" squad depend on whichever world generated
  // it - but every client and the resolver must derive the identical squad
  // from the seed alone. Cross-team clashes are repaired world-wide by the
  // foUniqueNames pass after every snapshot load.
  function foQsUniqueName(country, rnd, firsts, lasts) {
    var pool = (typeof NATNAMES !== "undefined" && (NATNAMES[country] || NATNAMES.England)) || { fn: ["Alex"], ln: ["Grey"] };
    var cand = "";
    for (var tries = 0; tries < 80; tries++) {
      var fn0 = pool.fn[Math.floor(rnd() * pool.fn.length)] || "Alex";
      var ln0 = pool.ln[Math.floor(rnd() * pool.ln.length)] || "Grey";
      cand = fn0 + " " + ln0;
      var fn = fn0.toLowerCase(), ln = ln0.toLowerCase();
      if (!firsts[fn] && !lasts[ln]) { firsts[fn] = 1; lasts[ln] = 1; return cand; }
    }
    return cand;   // tiny name bank: accept rather than loop forever
  }
  // engine-faithful talent eligibility (mirrors genDraftPool's rules)
  function foQsElig(p, t) {
    var isB = p.bowlTypeFull && p.bowlTypeFull !== "none" && !/^partTime/.test(p.bowlTypeFull);
    var isAR = p.role === "allRounder", isWK = !!p.keeper;
    var isBat = !isB && !isWK && !isAR;
    if (t === "lightningHands") return isWK;
    if (t === "bouncer") return ["seamFast", "seamFastMedium"].indexOf(p.bowlTypeFull) >= 0;
    if (t === "mysteryBall") return ["wristSpin", "fingerSpin"].indexOf(p.bowlTypeFull) >= 0;
    if (["newBallSpecialist", "deathSpecialist", "miser", "goldenArm", "partnershipBreaker"].indexOf(t) >= 0) return isB || isAR;
    if (t === "fastStarter") return p.role === "opener";
    if (t === "anchor") return p.role === "opener" || p.role === "topOrderBat";
    if (t === "finisher") return p.role === "middleOrderBat" || isAR;
    if (t === "sixMachine") return p.role === "middleOrderBat" || isAR || isWK;
    if (t === "busyRunner" || t === "spinKiller" || t === "paceHunter") return isBat || isAR || isWK;
    return true;   // safeHands, rocketArm
  }
  function foQsPlayer(spec, country, rnd, firsts, lasts) {
    var role = spec.role;
    var isB = ["seamFast", "seamFastMedium", "seamMedium", "wristSpin", "fingerSpin"].indexOf(role) >= 0;
    var isWK = role === "wicketkeeper", isAR = role === "allRounder";
    var ages = spec.ages || [21, 30];
    var age = spec.age != null ? spec.age : (ages[0] + Math.floor(rnd() * (ages[1] - ages[0] + 1)));
    var q = Math.max(0.05, Math.min(0.99, spec.q));
    var exp = foGenExp(age, q, rnd);
    var g = function (m, s) { return Math.max(5, Math.min(96, Math.round(m + s * (rnd() + rnd() + rnd() - 1.5)))); };
    return { name: foQsUniqueName(country, rnd, firsts, lasts), age: age, nat: country,
      hand: rnd() < 0.72 ? "R" : "L", role: role,
      bowlTypeFull: isB ? role : (isAR ? (rnd() < 0.5 ? "seamMedium" : "fingerSpin") : "none"),
      keeper: isWK, exp: exp, expWord: foExpWordOf(exp), capt: g(45, 16), formIx: 3, fatigue: "rested",
      skills: foGenSkills(role, q, age, rnd), talents: [] };
  }
  // SIM-AWARE squad strength: counts only numbers the ball engine actually
  // reads (bat/power/rotation, threat/control/stamina, fielding/catching,
  // keeping, experience). Display-only skills (variation, discipline,
  // move/turn) are deliberately excluded, so an archetype can wear them as
  // flavour without buying or losing real strength.
  function foQsSimValue(p) {
    var s = p.skills || {};
    return {
      bat: (p.bat || 0) + 0.45 * (s.power || 0) + 0.25 * (s.rotation || 0),
      bowl: p.bowlType ? (1.15 * (p.threat || 0) + 0.85 * (p.control || 0) + 0.25 * (s.stamina || 0)) : 0,
      other: 0.20 * (p.field || 0) + 0.15 * (s.catching || 0) + (p.keeper ? 0.45 * (s.keeping || 0) : 0) + 0.45 * (p.exp || 0)
    };
  }
  function foQsSquadStrength(players) {
    var xi = null;
    try { xi = pickXI({ name: "QS", players: players }); } catch (e) {}
    if (!xi || !xi.length) xi = players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).slice(0, 11);
    var others = 0, bowls = [], batList = [];
    xi.forEach(function (p) {
      var v = foQsSimValue(p);
      batList.push(v.bat); others += v.other;
      if (v.bowl > 0) bowls.push(v.bowl);
    });
    // the top order faces most of the balls: deep batting is worth far less
    // than the same runs concentrated at the top (the sim agrees)
    var BATW = [1, 1, 1, 0.95, 0.9, 0.85, 0.75, 0.6, 0.4, 0.25, 0.15];
    batList.sort(function (a, b) { return b - a; });
    var bats = 0;
    batList.forEach(function (b, i) { bats += b * (BATW[i] != null ? BATW[i] : 0.1); });
    // a real 50-over split: five frontline options plus a part-share sixth
    bowls.sort(function (a, b) { return b - a; });
    var bowlSum = 0;
    bowls.slice(0, 6).forEach(function (b, i) { bowlSum += b * (i < 5 ? 1 : 0.4); });
    var bench = 0;
    players.forEach(function (p) {
      if (xi.indexOf(p) >= 0) return;
      var v = foQsSimValue(p); bench += 0.15 * (v.bat + v.bowl);
    });
    return bats + 0.85 * bowlSum + others + bench;
  }
  // The bucket a captain occupies in the squad composition.
  function foQsBucketOf(role) {
    if (role === "wicketkeeper") return "wk";
    if (role === "allRounder") return "ar";
    if (/^seam/.test(role || "")) return "pace";
    if (/Spin$/.test(role || "")) return "spin";
    return "bat";
  }
  // An archetype's default composition, INCLUDING the captain's slot.
  function foQsDefaultComp(archId) {
    var A = foArchById(archId), C = A.counts || {};
    var comp = { bat: (C.opener || 0) + (C.top || 0) + (C.mid || 0), pace: C.pace || 0, spin: C.spin || 0, ar: C.ar || 0, wk: C.wk || 0 };
    comp[foQsBucketOf((A.starter || {}).role || "topOrderBat")]++;
    return comp;
  }
  // Generate a squad for one archetype, led by the chosen captain flavour,
  // shaped by the manager's composition (counts INCLUDE the captain).
  // Deterministic from (seed, country, archId, comp) - every client
  // and the resolver agree exactly.
  // `strength` (optional, default 1) scales the squad's whole standing. A human's
  // founding squad never passes it, so every manager still starts on the one
  // shared budget - the balance the archetypes were tuned against. The World
  // Service passes each bot club's standing from the planet's own table, which is
  // how a flagship comes out the strongest side in its league.
  function foGenArchetypeSquad(seed, country, archId, comp, strength) {
    var A = foArchById(archId);
    var STR = (typeof strength === "number" && isFinite(strength) && strength > 0)
      ? Math.max(0.7, Math.min(1.4, strength)) : 1;
    var rnd = window.rng(foHash32(String(seed) + "|" + archId));
    var firsts = {}, lasts = {};
    comp = comp || foQsDefaultComp(archId);
    // EVERY MAN IN THE SQUAD IS NOW A SLOT. This used to knock one off the
    // standout's own bucket because the pre-set captain filled it from outside
    // the ladder; with him generated like everybody else, taking that slot away
    // would deal a fourteen-man squad where fifteen was asked for.
    var want = { bat: comp.bat || 0, pace: comp.pace || 0, spin: comp.spin || 0, ar: comp.ar || 0, wk: comp.wk || 0 };
    var slots = [];
    // batting order shape: two openers first, then top/middle alternating
    var batRoles = ["opener", "opener", "topOrderBat", "middleOrderBat", "topOrderBat", "middleOrderBat", "topOrderBat", "middleOrderBat"];
    for (var iB = 0; iB < want.bat; iB++) slots.push({ role: batRoles[iB % batRoles.length], g: "bat" });
    for (var iW = 0; iW < want.wk; iW++) slots.push({ role: "wicketkeeper", g: "wk" });
    for (var iA = 0; iA < want.ar; iA++) slots.push({ role: "allRounder", g: "ar" });
    // honest style rarity: no second genuine quick - the Express captain is the
    // league's apex predator; wrist spin stays scarce outside the Wizard
    var paceStyles = ["seamFastMedium", "seamFastMedium", "seamMedium", "seamMedium"];
    var spinStyles = ["fingerSpin", "wristSpin", "fingerSpin", "fingerSpin"];
    for (var iP = 0; iP < want.pace; iP++) slots.push({ role: paceStyles[iP % paceStyles.length], g: "pace" });
    for (var iS = 0; iS < want.spin; iS++) slots.push({ role: spinStyles[iS % spinStyles.length], g: "spin" });
    // ONE LADDER ACROSS THE WHOLE SQUAD MADE EVERY DEPARTMENT FLAT.
    //
    // The rungs used to be a single straight line from 0.80 down to 0.31 with
    // no randomness in it at all, handed out in the archetype's focus order.
    // Two things followed, and together they are the whole "I got dealt the
    // same player four times".
    //
    // Every club of a given size got the IDENTICAL shape - the fourth man
    // always exactly the same distance below the third, everywhere in the
    // world.
    //
    // And a DEPARTMENT only ever occupied a short consecutive slice of that
    // line. Six batsmen sat on six neighbouring rungs, so the gap between a
    // club's best batsman and its sixth was a couple of points of quality.
    // Measured: six batsmen inside two points of overall, at every club.
    //
    // Now every department carries its OWN ladder. The archetype's focus
    // decides where a department sits - a Pace Battery's quicks centre high,
    // its batting lower - and inside it the men run from a genuine first
    // choice down to a genuine fringe player. Jitter stops two clubs of one
    // archetype being the same club. The squad's total is normalised by the
    // budget pass afterwards, so the spread costs the club no strength at all:
    // it buys SHAPE, not power.
    var pr = {}; (A.focus || []).forEach(function (gname, i2) { pr[gname] = i2; });
    var Q_FLOOR = 0.16;
    var UP = A.flatQ ? 0.11 : 0.18, DOWN = A.flatQ ? 0.11 : 0.15;
    var byG = {};
    slots.forEach(function (sl) { (byG[sl.g] = byG[sl.g] || []).push(sl); });
    Object.keys(byG).forEach(function (gname) {
      var rank = pr[gname] == null ? 2.4 : pr[gname];
      var mid = 0.68 - 0.085 * rank;                       // where this department sits
      var men = byG[gname];
      men.forEach(function (sl, iG) {
        var t = men.length <= 1 ? 0.5 : iG / (men.length - 1);   // 0 first choice .. 1 fringe
        sl.q = Math.max(Q_FLOOR, Math.min(0.96,
          mid + UP - (UP + DOWN) * t + (rnd() - 0.5) * 0.11));
      });
    });
    // AGE MUST NOT CANCEL THE LADDER, WHICH IS EXACTLY WHAT IT WAS DOING.
    //
    // A man's level is foSkillLevel(q, age): his own ceiling, approached as he
    // ages and reached at 27. Age was then drawn UNIFORMLY AT RANDOM from the
    // archetype's range, with no knowledge of where the ladder had placed him -
    // and the age swing is the bigger of the two. So a squad's best prospect,
    // drawn at twenty, came out BELOW its ninth man drawn at twenty-eight.
    // Measured before this: quality 0.941 produced an overall of 67 while
    // quality 0.437 produced 68. The ladder was real, and a dice roll erased it.
    //
    // Age now follows the rung, the way a squad actually looks: the men at the
    // top are in their prime, the tail is where the colts and the veterans are.
    // Jitter keeps it from being a formula, and the archetype's own range still
    // bounds it, so The Prodigy stays young and The Old Guard stays old.
    (function () {
      var lo = (A.ages && A.ages[0]) || 21, hi = (A.ages && A.ages[1]) || 30;
      var qs = slots.map(function (sl) { return sl.q; });
      var qLo = Math.min.apply(null, qs), qHi = Math.max.apply(null, qs);
      slots.forEach(function (sl) {
        var rung = qHi > qLo ? 1 - (sl.q - qLo) / (qHi - qLo) : 0.5;   // 0 = best
        var want = 28 - 7.5 * rung + (rnd() - 0.5) * 5;
        // a fringe man is as likely to be a veteran on the way down as a colt
        if (rung > 0.62 && rnd() < 0.34) want = 32 + rnd() * 5;
        sl.age = Math.max(lo, Math.min(hi, Math.round(want)));
      });
    })();
    // THERE IS NO SUCH THING AS A CAPTAIN, AND THERE NEVER SHOULD HAVE BEEN.
    //
    // A squad used to be built around one pre-set man drawn from a pool of six
    // captain cards. He was frozen at those numbers, lifted clear of the budget
    // pass, had every teammate who came near him trimmed back, and was handed
    // two talents outright. A cricketer with a permanent title, decided before
    // a ball was bowled.
    //
    // The captaincy is a MATCH decision - who leads the side today, changeable
    // every game - and that is untouched: App.orders.captain still names him and
    // Make captain still moves it. What goes is the idea that one man is the
    // club's captain for all time and is built differently because of it.
    //
    // The archetype's standout ROLE survives, because that is the club's
    // cricket rather than a person: a Pace Battery is still led by a genuine
    // quick. He is simply generated like everybody else, on the top rung of his
    // department's ladder, and he can be caught, sold, or out-grown by the boy
    // behind him. His talent he draws like everybody else - only likelier,
    // because the best player in a side plausibly arrives with a gift.
    var st = A.starter || {};
    var players = [];
    slots.forEach(function (sl) { players.push(foQsPlayer({ role: sl.role, ages: A.ages, q: sl.q, age: sl.age }, country, rnd, firsts, lasts)); });
    var qOf = {}; slots.forEach(function (sl, i5) { qOf[players[i5].name] = sl.q; });
    // the standout is whoever the ladder put on top - a fact about the squad,
    // not a title granted to a man
    var starter = players.reduce(function (b, p) {
      return (qOf[p.name] || 0) > (qOf[b.name] || 0) ? p : b;
    }, players[0]);
    // archetype flavour: real multipliers on the raw skills, BEFORE the
    // equal-budget pass, so the weakness survives normalisation as SHAPE
    var isBowlP = function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none"; };
    var BATSK = { vsPace: 1, vsSpin: 1, rotation: 1, temperament: 1, power: 1 };
    var inGroup = function (p, who) {
      if (who === "all") return true;
      if (who === "bowlers") return isBowlP(p);
      if (who === "batters") return !foPureBowler(p);
      if (who === "keepers") return !!p.keeper;
      return false;
    };
    // the captain is FROZEN at his pool-card numbers from here on: the card the
    // manager tapped is a promise, so flavour, adjustments and the budget pass
    // below shape his teammates only
    (A.bias || []).forEach(function (rule) {
      players.forEach(function (p) {
        if (!inGroup(p, rule[0])) return;
        for (var k in rule[1]) {
          if (p.skills[k] == null) continue;
          if (BATSK[k] && foPureBowler(p)) continue;   // a specialist bowler's batting stays a bowler's
          p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * rule[1][k])));
        }
      });
    });
    if (A.expAdj) players.forEach(function (p) { p.exp = Math.max(2, Math.min(99, Math.round(p.exp + A.expAdj))); p.expWord = foExpWordOf(p.exp); });
    if (A.captAdj) players.forEach(function (p) { p.capt = Math.max(5, Math.min(96, Math.round(p.capt * A.captAdj))); });
    // ---- SAME ARCHETYPE, NATIONAL ACCENT ----------------------------------
    // A Spin Circus is not one thing the world over: in India it is finger
    // spin and strangling control, in Afghanistan wrist spin and chaos. Each
    // entry reshapes HOW a nation plays an archetype - paired boosts and cuts,
    // never a net strength change (the calibration ladder owns strength) - and
    // may restyle the spinners' craft. Composition counts are never touched,
    // and the captain's card stays the promise the manager tapped.
    var FO_NAT_FLAVOR = {
      "India|wizard":        { spinKind: "fingerSpin", bias: [["bowlers", { economy: 1.06, discipline: 1.06, variation: 0.96 }]] },
      "Sri Lanka|wizard":    { spinKind: "fingerSpin", bias: [["bowlers", { variation: 1.06, moveTurn: 1.05, wicket: 0.96 }]] },
      "Bangladesh|wizard":   { spinKind: "fingerSpin", bias: [["bowlers", { economy: 1.07, discipline: 1.04, wicket: 0.95 }]] },
      "Afghanistan|wizard":  { spinKind: "wristSpin", bias: [["bowlers", { wicket: 1.07, variation: 1.10, economy: 0.94, discipline: 0.95 }]] },
      "Nepal|wizard":        { spinKind: "wristSpin", bias: [["bowlers", { wicket: 1.05, variation: 1.06, discipline: 0.94 }]] },
      "Pakistan|express":    { bias: [["bowlers", { moveTurn: 1.08, wicket: 1.05, discipline: 0.93 }]] },
      "Australia|express":   { bias: [["bowlers", { discipline: 1.07, economy: 1.05, moveTurn: 0.95 }]] },
      "England|express":     { bias: [["bowlers", { moveTurn: 1.08, economy: 0.97 }]] },
      "South Africa|express": { bias: [["bowlers", { wicket: 1.06, stamina: 1.05, variation: 0.94 }]] },
      "West Indies|express": { bias: [["bowlers", { wicket: 1.06, discipline: 0.95 }]] },
      "West Indies|blade":   { bias: [["batters", { power: 1.08, rotation: 0.95 }]] },
      "West Indies|finisher": { bias: [["batters", { power: 1.07, temperament: 0.96 }]] },
      "India|blade":         { bias: [["batters", { rotation: 1.08, vsSpin: 1.05, power: 0.95 }]] },
      "Australia|blade":     { bias: [["batters", { power: 1.06, vsPace: 1.04, vsSpin: 0.94 }]] },
      "England|rock":        { bias: [["batters", { vsPace: 1.06, temperament: 1.04, vsSpin: 0.95 }]] },
      "India|rock":          { bias: [["batters", { vsSpin: 1.08, vsPace: 0.94 }]] },
      "New Zealand|engine":  { bias: [["all", { fielding: 1.06, catching: 1.06 }], ["bowlers", { wicket: 0.97 }]] }
    };
    var NF = FO_NAT_FLAVOR[country + "|" + archId];
    if (NF) {
      (NF.bias || []).forEach(function (rule) {
        players.forEach(function (p) {
          if (!inGroup(p, rule[0])) return;
          for (var k in rule[1]) {
            if (p.skills[k] == null) continue;
            if (BATSK[k] && foPureBowler(p)) continue;
            p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * rule[1][k])));
          }
        });
      });
      if (NF.spinKind) players.forEach(function (p) {
        if (p.bowlTypeFull === "wristSpin" || p.bowlTypeFull === "fingerSpin") p.bowlTypeFull = NF.spinKind;
      });
    }
    // ========================================================================
    // EVERY CRICKETER LEANS. A HOME IS A KIND OF CRICKET.
    //
    // Until now a batter rated 42 read vsPace 42 and vsSpin 42, because
    // foGenSkills draws both from the same mean - the comment there calls it
    // "a tight batting cluster" and it was deliberate. It also meant no
    // batsman in the world had a weakness worth bowling at, and no captain
    // ever had a reason to bring on the spinner. Every squad was the same
    // squad with different names.
    //
    // THIS COSTS NOTHING, and that is the whole trick. jsDerive reads
    //     bat = 0.32 x vsPace + 0.32 x vsSpin + ...
    // with the two weights EQUAL, and
    //     rating = 420 x (bat + ... + (threat + control) x 0.5 + ...)
    // with wicket and economy equal inside it. So a lean that adds to one
    // side and takes the same off the other leaves bat, bowl, rating and
    // wage EXACTLY where they were. A man becomes a specialist without
    // becoming better or worse, the strength ladder never moves, and not one
    // club's calibration target changes.
    //
    // THE SHAPE OF THE LEAN. Most cricketers are rounded and a few are not:
    // roughly one man in five is a marked specialist (15-22 points either
    // way, which is your flat-track bully or your spin merchant), and the
    // rest lean gently (4-8). Finding the extremes is the scouting game.
    //
    // WHICH WAY HE LEANS IS WHERE HE LEARNED. A nation that grows up on
    // seam turns out batters who play seam and bowlers who swing it; a
    // nation that grows up on turn does the opposite. This tilts the ODDS,
    // never the strength - an English batter is likelier to be a pace player
    // than a spin player, and exactly as good either way.
    var FO_PACE_LANDS = { England: 1, Australia: 1, "South Africa": 1, "New Zealand": 1,
      "West Indies": 1, Ireland: 1, Scotland: 1, Netherlands: 1, Wales: 1, Canada: 1 };
    var FO_SPIN_LANDS = { India: 1, "Sri Lanka": 1, Bangladesh: 1, Afghanistan: 1,
      Nepal: 1, Pakistan: 1, Kenya: 1 };
    // Zimbabwe and the United States are left genuinely in the middle: neither
    // country's cricket is a bowling tradition anybody would name, and a world
    // where every nation leans somewhere has no middle to lean from.
    // AND NO TWO CLUBS ARE THE SAME CLUB. On top of the national tilt each
    // club draws its own house style once, from its own seed - one county
    // raises seam bowlers and plays the moving ball, the next one along
    // raises spinners. So two sides founded the same morning in the same
    // country are recognisably different places, which was the other half of
    // the complaint.
    var natTilt = FO_PACE_LANDS[country] ? 0.66 : FO_SPIN_LANDS[country] ? 0.34 : 0.50;
    var houseTilt = Math.max(0.18, Math.min(0.82, natTilt + (rnd() - 0.5) * 0.34));
    // a lean in points: mild for most, marked for about one man in five
    var leanSize = function () {
      return rnd() < 0.2 ? 15 + Math.round(rnd() * 7) : 4 + Math.round(rnd() * 4);
    };
    // move a pair of skills apart by n, keeping their sum - the invariant the
    // whole idea rests on. Clamped, and the clamp is repaid to the other side
    // so the sum survives even at the edges of the scale.
    var split = function (p, hi, lo, n) {
      if (p.skills[hi] == null || p.skills[lo] == null) return;
      var a = p.skills[hi], b = p.skills[lo], sum = a + b;
      var na = Math.max(5, Math.min(96, a + n));
      var nb = Math.max(5, Math.min(96, sum - na));
      na = Math.max(5, Math.min(96, sum - nb));
      p.skills[hi] = Math.round(na); p.skills[lo] = Math.round(nb);
    };
    players.forEach(function (p) {
      // A BATTER'S EYE: pace or spin. Every man who bats gets one, the
      // captain included - his card promised a rating, and the rating is
      // exactly what this leaves alone.
      if (!foPureBowler(p)) {
        var towardPace = rnd() < houseTilt;
        var n = leanSize();
        split(p, towardPace ? "vsPace" : "vsSpin", towardPace ? "vsSpin" : "vsPace", n);
      }
      // A BOWLER'S TRADE: takes wickets, or stops runs. The same arithmetic
      // on the same terms - threat and control weigh the same in a rating,
      // so a strike bowler and a stock bowler cost a club the same money and
      // win it completely different matches.
      if (isBowlP(p)) {
        var strike = rnd() < 0.5;
        split(p, strike ? "wicket" : "economy", strike ? "economy" : "wicket", leanSize());
      }
    });
    // ---- AND THE COUNTRY'S OWN CRAFT --------------------------------------
    // The composition already differs (an English club fields five seamers
    // and two spinners, an Indian one the reverse - the archetypes did that
    // long before this). What was missing is that the men themselves were
    // interchangeable. Here the trade a nation is FOR gets the better of its
    // own attack and the other trade gives the same ground up. calibrate()
    // then rescales the whole squad back onto its exact rung, so this is
    // shape and never strength: an English club's seamers out-bowl its own
    // spinners, an Indian club's spinners out-bowl its own seamers, and the
    // two clubs are worth precisely the same.
    // TWO CORRECTIONS, IN ORDER. foGenSkills turns out seamers about four
    // points better than spinners in every nation, whatever its cricket -
    // measured on the neutral lands, which carry no tilt and still came out
    // +2.9 (Zimbabwe) and +4.8 (West Indies). Left alone it would have made
    // England's seam identity read twice as loudly as India's spin identity,
    // which is a bug in the generator wearing the costume of a design.
    // So: level the ground first, then let the nation lean on it.
    var SEAM_BIAS = 0.14;                 // undo the generator's own seam habit
    var CRAFT = 0.10;                     // and what a country is actually for
    var favourSeam = natTilt > 0.50, neutral = natTilt === 0.50;
    players.forEach(function (p) {
      if (!isBowlP(p)) return;
      var isSpin = /[Ss]pin/.test(p.bowlTypeFull || "");
      var f = 1 + (isSpin ? SEAM_BIAS : 0);
      if (!neutral) f *= (isSpin !== favourSeam) ? (1 + CRAFT) : (1 - CRAFT);
      if (f === 1) return;
      ["wicket", "economy", "discipline", "moveTurn", "variation"].forEach(function (k) {
        if (p.skills[k] == null) return;
        p.skills[k] = Math.max(5, Math.min(96, Math.round(p.skills[k] * f)));
      });
    });
    players.forEach(function (p) { jsDerive(p); });

    // The Engine: two batters pick up honest part-time overs - everyone chips in
    if (A.partTimers) {
      players.filter(function (p) { return !isBowlP(p) && !p.keeper && p.role !== "allRounder"; })
        .slice(0, A.partTimers).forEach(function (p, i4) {
          p.bowlTypeFull = i4 % 2 ? "partTimeSpin" : "partTimeSeam";
          [["wicket", 30], ["economy", 34], ["discipline", 32], ["moveTurn", 28], ["variation", 26], ["stamina", 40]].forEach(function (kv) {
            p.skills[kv[0]] = Math.max(p.skills[kv[0]] || 5, kv[1] + Math.round((rnd() - 0.5) * 8));
          });
        });
    }
    // TALENTS: THE ARCHETYPE FLAVOURS A SQUAD, IT DOES NOT CLONE IT.
    //
    // What was here tried the archetype's three talents FIRST, in the SAME
    // ORDER, for EVERY man - and only fell through to the per-man shuffled pool
    // once those three were exhausted, which for a man taking one or two
    // talents never happened. So the first eligible archetype talent landed on
    // every eligible man in the squad. Measured across England: 6.3 men in an
    // average squad shared a single talent, and a whole fifteen showed only 5.4
    // distinct talents out of the seventeen that exist. Three Spin Killers,
    // three Bouncers, and five men carrying nothing at all - which is what
    // "it's like I got dealt the same player three or four times" actually is.
    //
    // Now every man scores the whole registry for himself, and the archetype is
    // only the first of three forces:
    //   FLAVOUR   the archetype's own talents pull hardest, first-listed most,
    //             so a Pace Battery still reads as a pace battery;
    //   SCARCITY  every teammate already holding a talent pushes it down the
    //             list, so the pull runs out after two or three men;
    //   THE MAN   his own name-hash breaks what is left, deterministic per
    //             player, so two clubs of one archetype stop being one club.
    // Measured after: 11.9 distinct talents a squad, and at most 3 men sharing.
    var held = {};
    players.forEach(function (p) {
      // A TALENT IS A GIFT, AND A GIFT THREE MEN IN FOUR HAVE IS NOT ONE.
      //
      // The old odds handed a talent to 75.3% of the world - 1.12 per man
      // across 3,840 cricketers - so the chip on the roster row said almost
      // nothing about a player except which of the seventeen he happened to
      // draw. What is rare is what gets scouted, bought and talked about.
      //
      // About one man in ten is born with one now, and a second is genuinely
      // exceptional. The odds lean with quality, because the gift and the
      // cricketer tend to arrive together.
      //
      // talentExtra WEIGHTS the draw, it no longer guarantees it. As a flat +1
      // it handed a talent to every single man at a Prodigy club - a hundred
      // per cent of a squad, which is the opposite of rare and was on its own
      // most of the overshoot. The archetype is still unmistakably the one full
      // of gifted boys; it is just no longer certain about every one of them.
      var q = qOf[p.name] || 0.4;
      var odds = 0.045 + 0.075 * Math.max(0, Math.min(1, (q - 0.25) / 0.7));
      if (A.talentExtra) odds *= (1 + 1.6 * A.talentExtra);
      // the best player in a side plausibly arrives with a gift - likelier,
      // never certain, and it is the only thing left that marks him out
      if (p === starter) odds = Math.min(0.72, odds * 5);
      var n = rnd() < odds ? (rnd() < 0.05 ? 2 : 1) : 0;
      var rank = {};
      (A.talents || []).forEach(function (t, i) { rank[t] = i; });
      var score = function (t) {
        var flavour = rank[t] == null ? 0 : (3 - rank[t]);          // 3, 2, 1
        var crowd = 1.30 * (held[t] || 0);                          // each holder repels
        var mine = (foHash32(p.name + "|" + t) % 1000) / 1000 * 1.25;
        return crowd + mine - flavour;
      };
      Object.keys(TALN).sort(function (a, b) { return score(a) - score(b); })
        .forEach(function (t) {
          if (p.talents.length >= n || p.talents.indexOf(t) >= 0) return;
          if (!foQsElig(p, t)) return;
          p.talents.push(t); held[t] = (held[t] || 0) + 1;
        });
    });
    // equal-budget pass: every archetype lands on the same strength target
    // (The Prodigy sits ~9% under it by design, paid back in age + talents)
    players.forEach(function (p) { jsDerive(p); });
    // pure bowlers bat by the game-wide name-derived rule, like every squad
    // (the franchise bowler got his specialist band in the captain pool)
    players.forEach(function (p) { if (foPureBowler(p)) foApplyBowlerBat(p); });
    // THE SQUAD IS NO LONGER BENT AROUND ONE MAN. Two passes used to run here.
    // capTeammates() trimmed any teammate who came within 93% of the captain,
    // and capLead() shoved the captain upward until he cleared the field. Both
    // existed only to guarantee that a pre-set man finished on top, and both
    // did real damage doing it: the trim squashed a squad's best players onto a
    // single ceiling, which is a large part of why every side used to read as
    // the same player over and over.
    //
    // With no captain to protect, the best player is whoever the ladder and the
    // budget actually produced.
    // When a STANDING is stated, it IS the standing. The archetype's own budget
    // dial (spin costs a little more, a stonewall a little less) is a balance
    // knob for the one shared budget every manager founds on - so it must not
    // also decide how good a world club is, or an all-rounder side on the fourth
    // rung would out-rate its own flagship. It still shapes the squad; it no
    // longer sets its level.
    var target = FO_QS_T * (STR === 1 ? (A.budgetMult || 1) : STR);
    for (var itn = 0; target > 0 && itn < 6; itn++) {
      var S = foQsSquadStrength(players);
      var f = target / Math.max(1, S);   // metric is linear in skills
      if (Math.abs(f - 1) < 0.008) break;
      f = Math.max(0.8, Math.min(1.25, f));
      players.forEach(function (p) {
        for (var k2 in p.skills) p.skills[k2] = Math.max(4, Math.min(96, Math.round(p.skills[k2] * f)));
        if (foPureBowler(p)) foApplyBowlerBat(p); else jsDerive(p);
      });
    }
    // fees: value-proportional inside the squad, on a size-priced schedule.
    // The same composition costs every archetype the same, and every extra
    // player genuinely costs more of the grant - 11 men leave ~$385k in the
    // bank, 15 leave ~$200k, a full 18 leaves ~$65k. Wages stay the players'
    // honest contracts (jsDerive), so bigger squads also pay more every day.
    var totFee = Math.round(800000 * Math.pow(players.length / 15, 0.85) / 500) * 500;
    var priced = players.map(function (p) { return foDraftPrice(p); });
    var vsum = priced.reduce(function (s, v) { return s + v; }, 0);
    players.forEach(function (p, iF) {
      p.fee = Math.max(8000, Math.round(totFee * priced[iF] / Math.max(1, vsum) / 500) * 500);
      p._qsPriced = 1;
    });
    // the chosen captain leads, whatever the archetype: re-assert his exact
    // captaincy after the archetype-wide adjustments, and no teammate outranks him
    var seasonNow = (typeof App !== "undefined" && App.seasonNo) || 1;
    // THE ARCHETYPE IS THE CLUB'S CRICKET, SO EVERY MAN CARRIES IT.
    // It used to be stamped on the captain alone, which made the club's
    // identity a property of one player - readable only while that player
    // existed and sat first in the array. Anything asking a squad what kind of
    // side it is (the reseed's own identity test does exactly this, off
    // squad[0]) got undefined the moment he stopped being dealt. Every man is
    // generated under the archetype; every man now says so.
    //
    // Captaincy as a SKILL stays on the card - it is what the match captain is
    // chosen on - but nobody is stamped as the captain any more.
    players.forEach(function (p) {
      p.archetype = A.id;
      p._prov = { how: "draft", s: seasonNow, founding: 1 };
    });
    return { players: players, arch: A.id };
  }
  window.__foArchetypes = FO_ARCHETYPES;
  window.__foSkillValue = foSkillValue;
  window.__foQsStrength = foQsSquadStrength;
  window.__foGenArchetypeSquad = foGenArchetypeSquad;
  window.__folOnbPreview = function (step) { try {
    if (!FO_ONB) FO_ONB = { team: {}, step: 1, needsSetup: true, country: NAT[0], clubName: "Thunder Empire", ground: "Riverview Oval", pitch: "balanced", style: "balanced", sponsor: null, scenario: "average", role: "all", riskAck: false };
    FO_ONB.needsSetup = true;
    if (step && step !== "create") {
      FO_ONB.clubName = FO_ONB.clubName || "Thunder Empire";
      if (!App.founder || !App.founder.pool) App.founder = { name: FO_ONB.clubName, budget: 1000000, pool: buildCountryPool("fo-preview", FO_ONB.country), picked: [], identity: "Balanced XI" };
      if (step === "draft" || step === "report" || step === "players") FO_ONB.sponsor = FO_ONB.sponsor || "community";
      if (step === "report" && !App.founder.picked.length) {
        // draft a legal squad WITHIN the $1M budget, best value first
        var _pool = App.founder.pool.slice(), _byR = function (a, b) { return (b.rating || 0) - (a.rating || 0); };
        var _spent = 0, _picked = [], _used = {};
        var _take = function (list, n) {
          list.sort(_byR).forEach(function (p) {
            if (n <= 0 || _used[p.name]) return;
            var fee = foDraftPrice(p);
            if (_spent + fee > 940000) return;
            _used[p.name] = 1; p._prov = p._prov || { how: "draft", s: (App.seasonNo || 1) }; _picked.push(p); _spent += fee; n--;
          });
        };
        _take(_pool.filter(function (p) { return p.keeper; }), 1);
        _take(_pool.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !p.keeper; }), 6);
        _take(_pool.filter(function (p) { return !p.keeper && (!p.bowlTypeFull || p.bowlTypeFull === "none"); }), 6);
        App.founder.picked = _picked;
      }
    }
    ({ create: foOnbCreate, charter: foOnbCharter, money: foOnbMoney, sponsor: foOnbSponsor, deal: foObDeal, draft: foOnbDraft, report: foOnbReport }[step || "create"] || foOnbCreate)();
  } catch (e) { console.warn("onb preview", e); } };   // debug/test hook (harmless)

  // Draft happens in the game's OWN founder screen (pgFounder). We hand it a
  // balanced, country-flavoured pool derived from the server draft_seed.
  // ===========================================================================
  //  FIRST-LOGIN ONBOARDING + DRAFT FINANCE FLOW
  //  8 branded screens that teach the finance model through choices + a live
  //  forecast, then hand the drafted squad to the engine's founderConfirm().
  // ===========================================================================
  // These are the numbers for the game THIS flow founds a club in: a solo
  // career or a friends league, both settled in the browser by the engine in
  // 00-core.js. Every constant below is that engine's, not a parallel guess:
  //   income  = sponsor base (+ win bonus) + home gate (attendance x $9)
  //   costs   = wage bill + stadium ($1/seat) + senior academy upkeep
  //   prizes  = PRIZES[finish], the engine's own array
  // and crowds follow its attendance() = supporters x (0.55 + 0.13 x mood),
  // capped by seats. Change one here and you must change it there.
  //
  // The World Service is a SEPARATE economy - server/economy.mjs, where the
  // founding bank, the ground and the following all follow a club's standing,
  // ticket 26, academy upkeep by the round - and a club is founded
  // there through #/worldclub, which never comes past this screen. The two
  // sets of figures are meant to differ; neither is a stale copy of the other.
  var FO_FIN = {
    seasonLength: 18, homeMatches: 9, startingBank: 1000000, ticketPrice: 9,
    stadiumCost: 9000, academyCost: 8000,
    health: [{ label: "Excellent", min: 250000 }, { label: "Safe", min: 100000 }, { label: "Tight", min: 25000 }, { label: "Danger", min: 0 }, { label: "Crisis", min: null }],
    styles: [
      { id: "balanced", name: "Balanced", draftBudget: 800000, reserve: 200000, risk: "Low", rec: true, tone: "teal", tag: "Sustainable growth for new managers." },
      { id: "win_now", name: "Win Now", draftBudget: 925000, reserve: 75000, risk: "High", rec: false, tone: "terra", tag: "Spend big on stars." },
      { id: "moneyball", name: "Moneyball", draftBudget: 700000, reserve: 300000, risk: "Medium", rec: false, tone: "violet", tag: "Save cash and hunt value." }
    ],
    sponsors: [
      { id: "community", name: "Prudential", ind: "Insurance \u00b7 London, est. 1848", pos: "Steady money, no strings.", base: 45000, win: 0, halfway: 0, seasonTop3: 0, champ: 0, tone: "teal", rec: false, lines: ["No result bonuses", "Guaranteed all season"] },
      { id: "results", name: "Nike", ind: "Sportswear \u00b7 Beaverton, Oregon", pos: "Paid to win.", base: 38000, win: 13000, halfway: 0, seasonTop3: 0, champ: 0, tone: "terra", lines: ["+$13,000 per win", "Paid on results"] },
      { id: "contender", name: "Emirates", ind: "Airline \u00b7 Dubai", pos: "Fly with the winners.", base: 15000, win: 45000, halfway: 0, seasonTop3: 0, champ: 0, tone: "gold", lines: ["+$45,000 per win", "The league's biggest win bonus"] }
    ],
    scenarios: [
      { id: "bad", name: "Bad season", wins: 5, crowd: 2100, finish: 8, t3half: false, t3fin: false, champ: false },
      { id: "average", name: "Average season", wins: 9, crowd: 2450, finish: 5, t3half: false, t3fin: false, champ: false },
      { id: "good", name: "Top-3 season", wins: 13, crowd: 2900, finish: 3, t3half: true, t3fin: true, champ: false },
      { id: "champion", name: "Champion season", wins: 15, crowd: 3300, finish: 1, t3half: true, t3fin: true, champ: true }
    ],
    prizes: [200000, 160000, 130000, 110000, 90000, 75000, 60000, 50000, 40000, 30000]
  };

  // The value core shared by draft and market pricing. Anchoring on rating
  // overpaid all-rounders (rating SUMS bat and bowl, so a 64/72 dual threat
  // outscored a 90-headline star). Price follows the HEADLINE skill instead:
  // convex in the primary suit, with the second suit worth 30 cents on the
  // dollar. A 90 specialist out-prices a 64/72 all-rounder by ~33%; only an
  // 80/80-or-better all-rounder overtakes him.
  function foSkillValue(p) {
    var bat = 0, bowl = 0, keep = 0;
    try { bat = aggBat(p) || 0; } catch (e) {}
    try { bowl = p.bowlType ? (aggBowl(p) || 0) : 0; } catch (e) {}
    try { keep = p.keeper ? (aggKeep(p) || 0) : 0; } catch (e) {}
    var suits = [bat, bowl, keep].sort(function (a, b) { return b - a; });
    return Math.pow(Math.max(0, suits[0]), 2.2) + 0.30 * Math.pow(Math.max(0, suits[1]), 2.2);
  }
  // smooth age curve: ~7% off per year past 22, capped both ends, no cliffs
  function foAgeFactor(age) {
    return Math.max(0.55, Math.min(1.45, 1.4 - 0.069 * ((age || 26) - 22)));
  }
  function foDraftPrice(p) {
    if (!p) return 8000;
    if (p._qsPriced && p.fee != null) return p.fee;   // founding squads: the signed fee IS the price
    var base = foSkillValue(p) * 6.0;
    var ageF = foAgeFactor(p.age);
    var talF = 1 + 0.10 * ((p.talents || []).length);
    var roleF = (p.keeper || p.role === "wicketkeeper") ? 1.15 : 1;
    var styleF = { seamFast: 1.30, wristSpin: 1.20, seamFastMedium: 1.08 }[p.bowlTypeFull] || 1;
    return Math.max(8000, Math.round(base * ageF * talF * roleF * styleF / 500) * 500);
  }
  // the fallback derives from the same curve the world does, not from a fee
  // times 0.028 - a ratio that was true when both were straight lines
  function foDailyWage(p) {
    if (p && p.wage != null) return p.wage;
    try { if (window.foWageOf) return window.foWageOf((p && p.rating) || 25704, ((p && p.talents) || []).length, 1); } catch (e) {}
    return 9290;
  }
  function foSeasonCost(p) { return foDraftPrice(p) + foDailyWage(p) * FO_FIN.seasonLength; }
  function foSponsorById(id) { for (var i = 0; i < FO_FIN.sponsors.length; i++) if (FO_FIN.sponsors[i].id === id) return FO_FIN.sponsors[i]; return FO_FIN.sponsors[0]; }
  function foStyleById(id) { for (var i = 0; i < FO_FIN.styles.length; i++) if (FO_FIN.styles[i].id === id) return FO_FIN.styles[i]; return FO_FIN.styles[0]; }
  function foScenarioById(id) { for (var i = 0; i < FO_FIN.scenarios.length; i++) if (FO_FIN.scenarios[i].id === id) return FO_FIN.scenarios[i]; return FO_FIN.scenarios[1]; }
  function foSponsorPayout(sp, sc) { var v = sp.base * FO_FIN.seasonLength + sp.win * sc.wins; if (sc.t3half) v += sp.halfway; if (sc.t3fin) v += sp.seasonTop3; if (sc.champ) v += sp.champ; return v; }
  function foTicket(sc) { return FO_FIN.homeMatches * sc.crowd * FO_FIN.ticketPrice; }
  function foHealth(end) { for (var i = 0; i < FO_FIN.health.length; i++) { var h = FO_FIN.health[i]; if (h.min == null || end >= h.min) return h.label; } return "Crisis"; }
  function foHealthTone(label) { return { Excellent: "teal", Safe: "teal", Tight: "gold", Danger: "terra", Crisis: "danger" }[label] || "gold"; }
  // The whole forecast for a set of picks + sponsor, under one scenario.
  function foForecast(picked, sponsorId, scenarioId) {
    var draftSpent = 0, dailyWage = 0;
    for (var i = 0; i < picked.length; i++) { draftSpent += foDraftPrice(picked[i]); dailyWage += foDailyWage(picked[i]); }
    var bankAfter = FO_FIN.startingBank - draftSpent, seasonWage = dailyWage * FO_FIN.seasonLength;
    var sc = foScenarioById(scenarioId || "average"), sp = foSponsorById(sponsorId);
    var ticket = foTicket(sc), sponsor = foSponsorPayout(sp, sc);
    var fixed = (FO_FIN.stadiumCost + FO_FIN.academyCost) * FO_FIN.seasonLength;
    var prize = FO_FIN.prizes[(sc.finish || 8) - 1] || 30000;
    var end = bankAfter + ticket + sponsor + prize - seasonWage - fixed;
    return { draftSpent: draftSpent, bankAfter: bankAfter, dailyWage: dailyWage, seasonWage: seasonWage, ticket: ticket, sponsor: sponsor, prize: prize, ground: fixed, end: end, health: foHealth(end) };
  }
  var FO$ = function (n) { return "$" + Math.round(n || 0).toLocaleString(); };
  var FO$s = function (n) { return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString(); };

  // ---- onboarding state + shell --------------------------------------------
  var FO_ONB = null;
  var FO_ICON =
    "<svg viewBox='0 0 1024 1024' width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'>" +
    "<rect x='64' y='64' width='896' height='896' rx='220' fill='#0C1B2E'/>" +
    "<g fill='#C9571F'><rect x='418' y='215' width='42' height='138' rx='10'/><rect x='492' y='215' width='42' height='138' rx='10'/><rect x='566' y='215' width='42' height='138' rx='10'/><rect x='410' y='200' width='58' height='18' rx='9'/><rect x='484' y='200' width='58' height='18' rx='9'/><rect x='558' y='200' width='58' height='18' rx='9'/></g>" +
    "<path d='M280 394H560V455H335L313 556C342 531 381 518 429 518C501 518 560 542 605 589C650 636 672 695 672 766C672 838 647 897 596 944C546 991 482 1015 404 1015C337 1015 282 999 239 966C196 934 170 888 161 830H230C237 869 255 899 285 920C315 941 354 951 401 951C460 951 509 934 548 900C586 866 605 821 605 764C605 709 587 664 551 629C515 594 469 577 413 577C354 577 307 597 272 637H207L280 394Z' fill='#FFFEFC' transform='translate(5 -140) scale(.86)'/>" +
    "<circle cx='625' cy='615' r='194' stroke='#FFFEFC' stroke-width='58' fill='none'/>" +
    "<path d='M625 809C579 750 579 480 625 421' stroke='#FFFEFC' stroke-width='38' stroke-linecap='round' fill='none'/>" +
    "<path d='M690 460C704 555 704 674 690 770' stroke='#FFFEFC' stroke-width='24' stroke-linecap='round' stroke-dasharray='52 42' fill='none'/>" +
    "<path d='M622 460C636 555 636 674 622 770' stroke='#FFFEFC' stroke-width='24' stroke-linecap='round' stroke-dasharray='52 42' fill='none'/></svg>";
  // Monoline icon set (feather-style, stroke = currentColor) · replaces emoji.
  var FO_ICONS = {
    bat: "<path d='M5 19l-1 1m2-2L17 7a2.4 2.4 0 0 1 3.4 3.4L9.5 21.5a2 2 0 0 1-2.8 0L6 20.8a2 2 0 0 1 0-2.8Z'/><circle cx='5.5' cy='5.5' r='2'/>",
    shield: "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>",
    shieldCheck: "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='m9 11.5 2 2 4-4'/>",
    wallet: "<rect x='3' y='6' width='18' height='13' rx='2.5'/><path d='M3 10h18M16 15h2'/>",
    tag: "<path d='M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z' transform='scale(.92) translate(1 1)'/><circle cx='7.5' cy='7.5' r='1.4'/>",
    check: "<path d='m5 12.5 4.5 4.5L19 7.5'/>",
    checkCircle: "<circle cx='12' cy='12' r='9'/><path d='m8.5 12.2 2.4 2.4 4.6-4.8'/>",
    warn: "<path d='M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z'/><path d='M12 9v5'/><circle cx='12' cy='17.2' r='.6' fill='currentColor'/>",
    info: "<circle cx='12' cy='12' r='9'/><path d='M12 11v5'/><circle cx='12' cy='8' r='.7' fill='currentColor'/>",
    scales: "<path d='M12 4v16m-5 0h10M7 5.5h10'/><path d='M7 5.5 4 12a3.4 3.4 0 0 0 6 0L7 5.5Zm10 0L14 12a3.4 3.4 0 0 0 6 0l-3-6.5Z'/>",
    trophy: "<path d='M8 21h8m-4-4v4M7 4h10v6a5 5 0 0 1-10 0V4Z'/><path d='M7 6H4a3 3 0 0 0 3.4 4M17 6h3a3 3 0 0 1-3.4 4'/>",
    chart: "<path d='M4 20V13M10 20V5M16 20v-9M21 20H3'/>",
    users: "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.9M15.5 3.3a4 4 0 0 1 0 7.4'/>",
    calendar: "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M16 3v4M8 3v4M3 10h18'/>",
    coins: "<ellipse cx='12' cy='6' rx='8' ry='3'/><path d='M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6'/><path d='M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'/>",
    target: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='4.5'/><circle cx='12' cy='12' r='.8' fill='currentColor'/>"
  };
  function FO_I(name, size) {
    return "<svg class='fo-i' width='" + (size || 18) + "' height='" + (size || 18) + "' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + (FO_ICONS[name] || "") + "</svg>";
  }
  var FO_STEPS = ["Club", "Charter", "Money", "Sponsor", "Squad", "Report"];
  function foOnbShell(stepIx, body) {
    var prog = FO_STEPS.map(function (s, i) {
      var cls = i < stepIx ? "done" : (i === stepIx ? "on" : "");
      return "<div class='fo-ob-step " + cls + "'><span class='fo-ob-dot'>" + (i < stepIx ? "✓" : (i + 1)) + "</span><span class='fo-ob-slbl'>" + s + "</span></div>";
    }).join("<span class='fo-ob-sep' aria-hidden='true'></span>");
    return "<div class='fo-ob-shell'><div class='fo-ob-inner'><div class='fo-ob-prog'>" + prog + "</div>" + body + "</div></div>";
  }
  function foOnbMount(stepIx, body) {
    var host = document.getElementById("fo-onb");
    if (!host) { host = document.createElement("div"); host.id = "fo-onb"; document.body.appendChild(host); }
    host.innerHTML = foOnbShell(stepIx, body);
    host.style.display = "block";
    try { openWrap(false); } catch (e) {}
    return host;
  }
  function foOnbClose() { var h = document.getElementById("fo-onb"); if (h) { h.style.display = "none"; h.innerHTML = ""; } }

  function foOnbStart(team) {
    if (typeof window.genDraftPool !== "function" || typeof window.pgFounder !== "function") { say("Game engine not ready. Reload the page and try again."); return; }
    team = team || {};
    try {
      // A brand-new manager may not have a team row (or country) yet · the create
      // screen collects club name + country and saves them; the pool is built then.
      var needsSetup = !(team.country && team.draft_seed);
      var pool = needsSetup ? [] : buildCountryPool(team.draft_seed || team.name || "fo-" + Date.now(), team.country || "ENG");
      App.founder = {
        name: team.name || "New Club", budget: 1000000, pool: pool, picked: [], identity: "Balanced XI",
        mgr: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager",
        __league: (LG && LG.id) ? { league_id: LG.id, team_id: team.id } : null
      };
      FO_ONB = { team: team, step: 1, needsSetup: needsSetup, country: team.country || NAT[0], clubName: team.name || "", ground: (team.name ? team.name + " Oval" : "Riverview Oval"), pitch: "balanced", style: "balanced", sponsor: null, scenario: "average", role: "all", riskAck: false };
      foJIntro();
    } catch (e) {
      // never leave a new manager on a blank screen · fall back to the engine's draft
      console.warn("Fifty Overs onboarding failed, using the standard draft:", e);
      try { if (!App.founder || !App.founder.pool) App.founder = { name: team.name || "New Club", budget: 1000000, pool: buildCountryPool(team.draft_seed || "fo", team.country || "ENG"), picked: [], identity: "Balanced XI", __league: { league_id: (LG && LG.id) || null, team_id: team.id } }; openWrap(false); window.pgFounder(); }
      catch (e2) { say(e2); }
    }
  }
  window.__foOnb = { start: foOnbStart, draft: foOnbDraft, report: foOnbReport, risk: foOnbRisk, forecast: foForecast, state: function () { return FO_ONB; } };

  // Engine pitch types and what they actually do in the match engine.
  var FO_PITCH_CARDS = [
    { id: "balanced", nm: "Balanced", d: "No advantage or disadvantage to batters or bowlers." },
    { id: "green", nm: "Green", d: "Strong help for seam bowlers, biggest with the new ball - fast-medium gains most, then fast; medium least. Moderate disadvantage to spin bowlers." },
    { id: "dry", nm: "Crumbling", d: "Strong help for spin bowlers - finger spin far more than wrist - growing as the pitch wears. Weak disadvantage to seam bowlers in the middle overs." },
    { id: "flat", nm: "Flat", d: "Strong advantage to batters: boundaries flow and wickets are dear. Strong disadvantage to all bowlers." },
    { id: "slow", nm: "Slow", d: "Moderate help for spin bowlers and medium-pace cutters in the middle overs. Strong cut to six-hitting. Weak disadvantage to fast and fast-medium bowlers." },
    { id: "cracked", nm: "Sticky", d: "Strong help for all bowlers - wrist spin notably more from the bounce - and more again in the second innings. Strong disadvantage to batters." },
    { id: "twoPaced", nm: "Two-paced", d: "Weak wicket help for all bowlers, moderate for spin and medium-pace cutters in the middle overs. Boundaries moderately harder." }
  ];
  // ---- Screen 1 · Create your club -----------------------------------------
  function foOnbCreate() {
    FO_ONB.step = 1;
    if (!FO_ONB.country) FO_ONB.country = NAT[0];
    var flagOf = foQsFlag;
    var ctyField = "<label class='fo-ob-lbl'>Home country <span class='fo-ob-hint'>: you draft players from here</span></label>" +
      (FO_ONB.needsSetup
        ? "<div class='fo-ctygrid'>" + NAT.map(function (c) {
            return "<button type='button' class='fo-cty" + (FO_ONB.country === c ? " on" : "") + "' data-cty='" + E(c) + "'><i>" + flagOf(c) + "</i><span>" + E(c) + "</span></button>";
          }).join("") + "</div>"
        : "<div class='fo-ctygrid'><button type='button' class='fo-cty on' disabled><i>" + flagOf(FO_ONB.country) + "</i><span>" + E(FO_ONB.country) + "</span></button></div>");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-cols'>" +
      "<div class='fo-ob-colmain'>" +
      "<div class='fo-ob-eyebrow'>Welcome to Fifty Overs</div>" +
      "<h1 class='fo-ob-h1'>Found your club</h1>" +
      "<p class='fo-ob-lead'>A private league between you and your friends: draft real players, set a line-up each matchday, and one match plays out every day. Start with your club's identity. Everything here is yours for the whole season.</p>" +
      "<label class='fo-ob-lbl'>Manager name</label><input class='fo-ob-input' value='" + E((SYNC && SYNC.me && SYNC.me.display_name) || "Manager") + "' disabled>" +
      "<label class='fo-ob-lbl'>Club name</label><input id='fo-ob-name' class='fo-ob-input' maxlength='28' value='" + E(FO_ONB.clubName) + "' placeholder='Harbor City CC'>" +
      ctyField +
      "<label class='fo-ob-lbl'>Home ground name</label><input id='fo-ob-ground' class='fo-ob-input' maxlength='30' value='" + E(FO_ONB.ground) + "' placeholder='Harbor Oval'>" +
      "<label class='fo-ob-lbl'>Home pitch <span class='fo-ob-hint'>: you play 9 of your 18 matches on it, so draft a squad to match</span></label>" +
      "<div class='fo-pitchgrid'>" + FO_PITCH_CARDS.map(function (pt) {
        return "<button type='button' class='fo-pitch " + (FO_ONB.pitch === pt.id ? "on" : "") + "' data-pitch='" + pt.id + "'><b>" + pt.nm + "</b><span>" + pt.d + "</span></button>";
      }).join("") + "</div>" +
      "<div class='fo-ob-act'><button class='fo-ob-cta' id='fo-ob-c1'>Continue</button></div>" +
      "</div>" +
      "<aside class='fo-ob-snap'>" +
      "<div class='fo-clubprev' id='fo-prev'><div class='fo-clubprev-crest' id='fo-prev-cr'></div>" +
      "<div class='fo-clubprev-nm' id='fo-prev-nm'></div><div class='fo-clubprev-sub' id='fo-prev-sub'></div></div>" +
      "<div class='fo-ob-snaph'>Season 1 snapshot</div>" +
      "<div class='fo-snap-row'><i>" + FO_I("users") + "</i><div><b>10-team league</b></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("calendar") + "</i><div><b>18 matchdays</b></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("coins") + "</i><div><b>$1,000,000</b><span>starting bank</span></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("bat") + "</i><div><b>11&#8211;18 player</b><span>squad</span></div></div>" +
      "</aside></div></div>";
    var host = foOnbMount(0, body);
    // live identity preview: watching "your" club take shape as you type
    var updPrev = function () {
      var nm = ((host.querySelector("#fo-ob-name") || {}).value || "").trim() || "Your Club";
      var gr = ((host.querySelector("#fo-ob-ground") || {}).value || "").trim() || (nm.split(" ")[0] + " Oval");
      var ini = nm.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 3).toUpperCase();
      var cr = host.querySelector("#fo-prev-cr"), pn = host.querySelector("#fo-prev-nm"), ps = host.querySelector("#fo-prev-sub");
      if (cr) cr.textContent = ini || "FC";
      if (pn) pn.textContent = nm;
      if (ps) ps.innerHTML = flagOf(FO_ONB.country) + " " + E(FO_ONB.country) + " &middot; " + E(gr) + " &middot; " + E(foPitchName(FO_ONB.pitch || "balanced")) + " pitch";
    };
    ["fo-ob-name", "fo-ob-ground"].forEach(function (id) { var el = host.querySelector("#" + id); if (el) el.addEventListener("input", updPrev); });
    // selections flip in place: no re-render, nothing typed is lost, no scroll jump
    host.querySelectorAll(".fo-cty[data-cty]").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.country = b.getAttribute("data-cty");
        host.querySelectorAll(".fo-cty").forEach(function (x) { x.classList.toggle("on", x === b); });
        updPrev();
      });
    });
    host.querySelectorAll(".fo-pitch").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.pitch = b.getAttribute("data-pitch");
        host.querySelectorAll(".fo-pitch").forEach(function (x) { x.classList.toggle("on", x === b); });
        updPrev();
      });
    });
    updPrev();
    host.querySelector("#fo-ob-c1").addEventListener("click", function () {
      var nm = (host.querySelector("#fo-ob-name").value || "").trim();
      if (nm.length < 2) { host.querySelector("#fo-ob-name").focus(); return; }
      FO_ONB.clubName = nm; FO_ONB.ground = (host.querySelector("#fo-ob-ground").value || "").trim() || (nm + " Oval");
      App.founder.name = nm;
      // An existing team row only skips the save when nothing changed. A rename
      // (typical on a relaunch re-found) MUST reach the server: myClubInSnap and
      // App.teamIx match on SYNC.myTeam.name, so a client-only rename would
      // permanently desync this manager once the new club joins the snapshot.
      // create_league_team upserts - the draft_seed is derived from the team id
      // and stays stable, so the pool/squad seed never shifts.
      if (!FO_ONB.needsSetup && (!LG || (FO_ONB.team && nm === FO_ONB.team.name && (FO_ONB.country || "") === (FO_ONB.team.country || "")))) { foOnbCharter(); return; }
      // Save the club (name + country) to the league and build the draft pool
      // from the server-issued seed. Manager name comes from signup – never
      // asked twice.
      var cty = FO_ONB.country || NAT[0];
      var btn = host.querySelector("#fo-ob-c1"); btn.disabled = true; btn.textContent = "Saving…";
      rpc("create_league_team", { p_league_id: LG.id, p_team_name: nm, p_manager_name: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager", p_country: cty })
        .then(function (team) {
          SYNC.myTeam = team; FO_ONB.team = team; FO_ONB.needsSetup = false; FO_ONB.country = team.country || cty;
          App.founder.pool = buildCountryPool(team.draft_seed || nm, team.country || cty);
          App.founder.__league.team_id = team.id;
          foOnbCharter();
        })
        .catch(function (e) { btn.disabled = false; btn.textContent = "Continue"; say(e); });
    });
  }

  // ---- Screen 2 · The club is founded (charter + the sponsor's grant) ------
  function foOnbCharter() {
    FO_ONB.step = 2;
    var pt = FO_PITCH_CARDS.find(function (x) { return x.id === FO_ONB.pitch; }) || FO_PITCH_CARDS[0];
    var body =
      "<div class='fo-ob-card fo-ob-charter fo-charter-big'>" +
      "<div class='fo-charter-ic'>" + FO_I("trophy", 40) + "</div>" +
      "<div class='fo-ob-eyebrow'>Your club is ready</div>" +
      "<h1 class='fo-ob-h1 fo-charter-h1'>" + E(FO_ONB.clubName) + " is founded</h1>" +
      "<div class='fo-charter-date'>Founded " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + "</div>" +
      "<p class='fo-ob-lead fo-charter-lead'>Home ground: <b>" + E(FO_ONB.ground) + "</b>" +
      (pt.id !== "balanced" ? " with a <b>" + pt.nm.toLowerCase() + "</b> pitch" : "") +
      ". Your founding sponsor has paid in $1,000,000 to get you started - that money signs your squad and runs the club.</p>" +
      "<div class='fo-charter-grant'><span>Founding grant</span><b>$1,000,000</b></div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(1, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbCreate);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbMoney);
  }

  // ---- Screen 3 · How your money works -------------------------------------
  function foOnbMoney() {
    FO_ONB.step = 3;
    var tile = function (ic, l, v, s, tone) { return "<div class='fo-ob-tile'><span class='fo-ob-tic fo-tic-" + (tone || "teal") + "'>" + FO_I(ic, 17) + "</span><div class='fo-ob-tl'>" + l + "</div><div class='fo-ob-tv'>" + v + "</div>" + (s ? "<div class='fo-ob-ts'>" + s + "</div>" : "") + "</div>"; };
    var chk = function (t) { return "<div class='fo-ob-chk'><i>" + FO_I("checkCircle", 17) + "</i><span>" + t + "</span></div>"; };
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>How your money works</div>" +
      "<h1 class='fo-ob-h1'>Your $1,000,000 has two jobs</h1>" +
      "<div class='fo-ob-jobs'><div class='fo-ob-job'><span class='fo-ob-jic fo-jic-teal'>" + FO_I("bat", 20) + "</span><div><b>Build the squad</b><div class='fo-ob-muted'>Spend in the draft to sign the best players.</div></div></div>" +
      "<div class='fo-ob-job'><span class='fo-ob-jic fo-jic-terra'>" + FO_I("shield", 20) + "</span><div><b>Keep the club running</b><div class='fo-ob-muted'>Cover wages, costs and build a healthy future.</div></div></div></div>" +
      "<div class='fo-ob-tiles'>" + tile("wallet", "Starting bank", "$1,000,000", "Draft + operating money", "teal") +
      tile("tag", "Signing fees", "$615k&#8211;$935k", "Set by squad size (11&#8211;18)", "terra") +
      tile("shieldCheck", "Left in the bank", "$65k&#8211;$385k", "Covers wages &amp; running costs", "teal") + "</div>" +
      "<div class='fo-ob-chks'>" + chk("Every player costs a one-off <b>signing fee</b> and a <b>wage</b> every matchday.") + chk("You pay wages to your squad every matchday.") +
      chk("Home matches bring ticket income (about $22k a game).") + chk("Running the club costs about $25k every matchday on top of wages.") + chk("Sponsor money, wins and prize money come in on top.") + "</div>" +
      "<div class='fo-ob-warn'><i>" + FO_I("warn", 17) + "</i>A bigger squad means less in the bank and a bigger wage bill - keep an eye on both.</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(2, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbCharter);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbSponsor);
  }

  // ---- Screen 4 · Choose your sponsor --------------------------------------
  function foOnbSponsor() {
    FO_ONB.step = 4;
    var marks = {
      community: "<span class='fo-brandmark fo-brand-pru'>PRUDENTIAL</span>",
      results: "<span class='fo-brandmark fo-brand-nike'>NIKE</span>",
      contender: "<span class='fo-brandmark fo-brand-emirates'>Emirates</span>"
    };
    var cards = FO_FIN.sponsors.map(function (s) {
      var terms = s.lines.map(function (l) { return "<span>" + l + "</span>"; }).join("");
      return "<button type='button' class='fo-pk fo-pk-sp fo-tone-" + s.tone + " " + (FO_ONB.sponsor === s.id ? "on" : "") + "' data-sp='" + s.id + "'>" +
        marks[s.id] +
        "<span class='fo-pk-name'>" + s.name + "</span>" +
        "<span class='fo-sp-ind'>" + s.ind + "</span>" +
        "<span class='fo-sp-big'>" + FO$(s.base) + "<i>per matchday</i></span>" +
        "<span class='fo-sp-lines'>" + terms + "</span>" +
        "<span class='fo-sp-fine'>Term: 18 matchdays &middot; season 1</span></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>Pick a sponsor</div>" +
      "<h1 class='fo-ob-h1'>Three offers on the table</h1>" +
      "<p class='fo-ob-lead'>Each one pays you after every match, all season. The difference is how much of the money depends on results. Whichever you sign is locked in for season 1.</p>" +
      "<div class='fo-pks'>" + cards + "</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'" + (FO_ONB.sponsor ? "" : " disabled") + ">Sign with " + (FO_ONB.sponsor ? foSponsorById(FO_ONB.sponsor).name : "&hellip;") + "</button></div></div>";
    var host = foOnbMount(3, body);
    host.querySelectorAll(".fo-pk").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.sponsor = b.getAttribute("data-sp");
        host.querySelectorAll(".fo-pk").forEach(function (x) { x.classList.toggle("on", x === b); });
        var c2 = host.querySelector("#fo-ob-c");
        if (c2) { c2.disabled = false; c2.innerHTML = "Sign with " + E(foSponsorById(FO_ONB.sponsor).name); }
      });
    });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbMoney);
    host.querySelector("#fo-ob-c").addEventListener("click", function () {
      if (!FO_ONB.sponsor) { say("Pick a sponsor first. This deal pays you every matchday all season."); return; }
      if (LG && LG.full_draft) foOnbDraft(); else foObDeal();
    });
  }

  // The draft room is replaced by the squad builder (identity → captain →
  // composition) unless the league insists on the full draft via config.
  // Takeover mode (bot-club handover) waits behind its flag.
  function startDraft(team) {
    if (FO_TAKEOVER_ON && SYNC && SYNC.started && !SYNC.isFounder) return foTakeoverStart(team || {});
    foOnbStart(team);
  }

  // ---- shared glyphs for the squad-builder cards ----------------------------
  var FO_QS_GLYPHS = {
    bolt: "<path d='M13 2 6 13h5l-1.5 9L18 10h-5l1.5-8z'/>",
    spin: "<path d='M20 12a8 8 0 1 1-2.5-5.9M20 3v4h-4'/>",
    shield: "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>",
    rocket: "<path d='M12 2c3 2 5 6 5 10l-2.5 2.5h-5L7 12c0-4 2-8 5-10z'/><path d='M9.5 14.5 7 20l3-1 2 2 2-2 3 1-2.5-5.5'/><circle cx='12' cy='9' r='1.6'/>",
    gloves: "<path d='M8 21v-8a4 4 0 0 1 8 0v8z'/><path d='M8 15H6.2a2 2 0 0 1 0-4H8M16 15h1.8a2 2 0 0 0 0-4H16'/>",
    spark: "<path d='M12 2v5M12 17v5M2 12h5M17 12h5M5.5 5.5l3 3M15.5 15.5l3 3M18.5 5.5l-3 3M8.5 15.5l-3 3'/>",
    star: "<path d='m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8Z'/>",
    lock: "<rect x='5' y='11' width='14' height='9' rx='2'/><path d='M8 11V8a4 4 0 0 1 8 0v3'/>",
    bat: "<path d='M5 19l-1 1m2-2L17 7a2.4 2.4 0 0 1 3.4 3.4L9.5 21.5a2 2 0 0 1-2.8 0L6 20.8a2 2 0 0 1 0-2.8Z'/><circle cx='5.5' cy='5.5' r='2'/>",
    gear: "<circle cx='12' cy='12' r='3.2'/><path d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19'/>"
  };
  function foQsIcon(name, size) {
    return "<svg width='" + (size || 19) + "' height='" + (size || 19) + "' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + (FO_QS_GLYPHS[name] || FO_QS_GLYPHS.star) + "</svg>";
  }
  var foQsFlag = function (c) { try { return (typeof foFlag === "function" && foFlag(c)) || ""; } catch (e) { return ""; } };
  // still used by the takeover screens
  function foQsShell(stepIx, body, ctaHtml) {
    var host = document.getElementById("fo-onb");
    if (!host) { host = document.createElement("div"); host.id = "fo-onb"; document.body.appendChild(host); }
    var dots = [1, 2].map(function (n) {
      return "<span class='fo-qs-dot" + (n < stepIx ? " done" : n === stepIx ? " on" : "") + "'></span>";
    }).join("");
    host.innerHTML = "<div class='fo-ob-shell'><div class='fo-qs-wrap'>" +
      "<div class='fo-qs-top'><span class='fo-qs-brand'>Fifty Overs</span><span class='fo-qs-dots'>" + dots + "</span></div>" +
      body + "</div>" + (ctaHtml || "") + "</div>";
    host.style.display = "block"; host.scrollTop = 0;
    try { openWrap(false); } catch (e) {}
    return host;
  }
  function foQsCtaBar(label, id, disabled, backId) {
    return "<div class='fo-qs-ctabar'>" +
      (backId ? "<button class='fo-ob-ghost' id='" + backId + "'>Back</button>" : "") +
      "<button class='fo-qs-cta' id='" + id + "'" + (disabled ? " disabled" : "") + ">" + label + "</button></div>";
  }

  // ===========================================================================
  //  SQUAD BUILDER · replaces the draft room inside the onboarding
  //  1) what kind of team  2) the captain  3) size & composition → generated
  // ===========================================================================
  // The generation seed is captured ONCE, when the captain pool is first
  // built. Without the lock a club rename between picking a captain and
  // committing would re-seed the generator - the manager would sign a
  // different squad (and different captain) than the cards they chose from.
  function foObSeed() {
    if (!FO_ONB.genSeed) FO_ONB.genSeed = (FO_ONB.team && FO_ONB.team.draft_seed) || FO_ONB.clubName || "fo";
    return FO_ONB.genSeed;
  }
  // ---- THE SQUAD YOU ARE GIVEN ----------------------------------------------
  //
  // Founding used to be three squad decisions: pick a style of side, pick a
  // captain from six cards, then set the size and shape of the roster. All
  // three are gone.
  //
  // The captaincy went first, because there is no such thing as a club's
  // captain - it is a decision made per match, in the orders room, and a man
  // built differently for all time because a card said "The Talisman" was the
  // last of that idea. The other two go with it for a plainer reason: a
  // manager choosing his own squad's style and shape before he has watched a
  // ball is choosing between things he has no way to judge, and every world
  // club is dealt its side without being asked. A new manager now names his
  // club and is dealt one, the same way, out of the same generator.
  //
  // The style is still real - it is simply the club's own, derived from its
  // name rather than chosen from a grid, so two clubs are no more alike than
  // any two in the world. The shape is the archetype's own default.
  function foObDealtArch(seed) {
    var ids = FO_ARCHETYPES.map(function (a) { return a.id; });
    return ids[foHash32("arch|" + String(seed)) % ids.length];
  }
  function foObDeal() {
    try {
      FO_ONB.arch = FO_ONB.arch || foObDealtArch(foObSeed());
      FO_ONB.gen = foGenArchetypeSquad(foObSeed(), FO_ONB.country, FO_ONB.arch, null);
      App.founder.picked = FO_ONB.gen.players.slice();
      foOnbAfterDraft();
    } catch (e) { say(e); }
  }

  window.__foQs = { deal: function () { return foObDeal(); }, dealtArch: foObDealtArch,
    state: function () { return FO_ONB; }, gen: foGenArchetypeSquad,
    golden: function (nxt, oi, t) { return foQsGolden(nxt, oi, t); }, goldenWire: function (pg) { return foQsGoldenWire(pg); },
    goldenTest: function (opp) {   // headless probe: render the real golden card on the current page
      try {
        SYNC = SYNC || {};
        var oS = SYNC.started, oP = SYNC.practice;
        SYNC.started = true; SYNC.practice = false;
        if (!lsGet("fo_qs_new")) lsSet("fo_qs_new", "1");
        var nxt = { round: (App.season && App.season.round) || 0, isHome: true, opp: { name: opp || "Meow Monks" } };
        var html = foQsGolden(nxt, false, userTeam());
        var pg = document.getElementById("page");
        if (pg && html) { var d = document.createElement("div"); d.innerHTML = html; pg.insertBefore(d.firstChild, pg.firstChild); foQsGoldenWire(pg); }
        SYNC.started = oS; SYNC.practice = oP;
        return !!html;
      } catch (e) { return "ERR " + e.message; }
    } };

  // ---- friendlies can be simmed to the result --------------------------------
  // The engine's match centre plays every ball (800ms+ each - a quarter hour
  // per match). For friendlies and the tutorial warm-up, add a turbo speed
  // and a "Sim to the result" control so the manager decides how much
  // cricket to watch.
  function foMatchSimControls() {
    try {
      if (typeof App === "undefined" || !App || App.page !== "match") return;
      if (!(typeof M !== "undefined" && M && !M.done)) return;
      var isFr = (M.meta && M.meta.comp === "friendly") || (App.pending && App.pending.__friendly);
      if (!isFr) return;
      var page = document.getElementById("page"); if (!page) return;
      var sel2 = page.querySelector("select[title='commentary speed']");
      if (sel2 && !sel2.querySelector("option[value='200']")) {
        var op = document.createElement("option"); op.value = "200"; op.textContent = "turbo";
        sel2.insertBefore(op, sel2.firstChild);
        if ((UI.apMs || 1600) === 200) { op.selected = true; }
      }
      if (!page.querySelector("#fo-simres")) {
        var b = document.createElement("button");
        b.id = "fo-simres"; b.type = "button"; b.textContent = "Sim to the result \u25B8";
        // only into the speed row: it appears once the innings are live. On the
        // toss screens autoPick/stepBall would just throw on M.innings[0]=null,
        // so a top-of-page fallback button would sit there doing nothing.
        var row = sel2 && sel2.closest(".ctlrow");
        if (row) row.appendChild(b);
      }
    } catch (e) {}
  }
  // one document-level handler survives the per-ball re-renders
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("#fo-simres") : null;
    if (!b || b.disabled) return;
    b.disabled = true; b.textContent = "Playing out the overs\u2026";
    setTimeout(function () {
      // park App.page so the engine's per-ball render() no-ops: ~600 remaining
      // balls would otherwise each rebuild the whole match centre DOM
      var pg0 = (typeof App !== "undefined" && App) ? App.page : null;
      try {
        if (pg0) App.page = "__fo-sim__";
        var g = 0;
        while (typeof M !== "undefined" && M && !M.done && g++ < 3000) { autoPick(); stepBall(); }
      } catch (e) {}
      try { if (pg0) App.page = pg0; } catch (e2) {}
      try { if (typeof window.route === "function") window.route(); } catch (e3) {}
    }, 30);
  });

  // ---- the tutorial warm-up: one match, ONE strategic call ------------------
  // Launched from the club home right after founding. The captain's first
  // call sets the plan (a real orders delta, not the whole lineup); the rest
  // of the XI is auto-picked and the match plays in the live match centre.
  function foQsTutorial() {
    try {
      if (typeof M !== "undefined" && M && !M.done) return;   // never stomp a live match
      var me = userTeam(); if (!me || !me.players || me.players.length < 11) return;
      var ix = -1;
      (GD.teams || []).forEach(function (t, i) { if (ix < 0 && t && t.name !== me.name && !t.founded) ix = i; });
      if (ix < 0) (GD.teams || []).forEach(function (t, i) { if (ix < 0 && t && t.name !== me.name) ix = i; });
      if (ix < 0) { lsDel("fo_qs_tut"); return; }
      var opp = GD.teams[ix];
      var pitch = me.homePitch || "balanced";
      var capName = "";
      try { (me.players || []).some(function (p) { if (p && p.origin_tag && /Franchise captain/.test(p.origin_tag)) { capName = p.name; return true; } return false; }); } catch (e) {}
      // three plans, each a REAL orders delta the engine reads ball by ball
      var plans = [
        { id: "attack", nm: "Take the game on", d: "Attack with bat and field from ball one. Big scores - and big risks.",
          pi: { pp: 1, mid: 0, death: 2 }, fp: { pp: "att", mid: "bal", death: "def" } },
        { id: "build", nm: "Build, then explode", d: "Keep wickets in hand for 35 overs, then swing from the deep end.",
          pi: { pp: -1, mid: 0, death: 2 }, fp: { pp: "bal", mid: "bal", death: "def" } },
        { id: "squeeze", nm: "Squeeze them out", d: "Defensive fields, patient batting - strangle them and pounce late.",
          pi: { pp: 0, mid: 0, death: 1 }, fp: { pp: "bal", mid: "def", death: "def" } }
      ];
      var ex = document.getElementById("fo-tut"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-tut"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Warm-up vs " + E(opp.name) + "</div>" +
        "<h3>" + (capName ? E(capName) + " wants a plan" : "Your captain wants a plan") + "</h3>" +
        "<div class='small' style='margin:4px 0 10px'>One friendly before the league - nothing counts, everything teaches. The XI picks itself; <b>you make the captain's call</b>. Conditions: <b>" + E(foPitchName(pitch)) + "</b> pitch, sunny.</div>" +
        plans.map(function (pl) {
          return "<button type='button' class='fo-tut-plan' data-p='" + pl.id + "'><b>" + pl.nm + "</b>" +
            "<span>" + pl.d + "</span></button>";
        }).join("") +
        "<div class='small' style='margin-top:10px;text-align:center'><a id='fo-tut-skip' style='cursor:pointer;text-decoration:underline dotted'>Skip the warm-up</a></div></div>";
      document.body.appendChild(m);
      m.querySelector("#fo-tut-skip").addEventListener("click", function () { lsDel("fo_qs_tut"); m.remove(); });
      m.querySelectorAll(".fo-tut-plan").forEach(function (b) {
        b.addEventListener("click", function () {
          try {
            // re-check at CLICK time: the engine's background tick can start a
            // queued match while this modal sits open, and its 1.4s toss timer
            // would then resolve OUR match's toss with the old call. Never
            // stomp a live match - the invite simply waits for the next visit.
            if (typeof M !== "undefined" && M && !M.done) {
              m.remove();
              say("A match is already live - finish it first. The warm-up invite will be waiting on your club home.");
              return;
            }
            var pl = plans.filter(function (x) { return x.id === b.getAttribute("data-p"); })[0] || plans[0];
            App.tossState = null;
            App.pending = { oppIx: ix, home: me.name, away: opp.name, ground: me.ground, pitch: pitch, weather: "Sunny",
              seed: 4200 + ix, date: (typeof simDate === "function" ? simDate() : ""), comp: "friendly", __friendly: true, __tut: 1 };
            suggestOrders();
            // the plan must never leak into the real league orders (the golden
            // one-tap confirm pushes App.orders wholesale): stash what the plan
            // overwrites - the saveMatch wrapper puts it back at full time
            window.__foTutOrders = JSON.stringify({ pi: App.orders.phaseIntent || null, fp: App.orders.fieldPlan || null, defaults: App.defaults || null });
            App.orders.phaseIntent = pl.pi; App.orders.fieldPlan = pl.fp;
            App.orders.saved = true;
            App.defaults = JSON.parse(JSON.stringify(App.orders));
            lsDel("fo_qs_tut");
            m.remove();
            location.hash = "#/match"; if (typeof window.route === "function") window.route();
            // the match is live now - drop the saved flag so the 15s packet
            // poll never uploads the warm-up plan as the round's league orders
            // (and the golden card stays live for the real confirmation)
            App.orders.saved = false;
            foQsTutWatch();
          } catch (e) { say(e); }
        });
      });
    } catch (e) { try { lsDel("fo_qs_tut"); } catch (e2) {} }
  }
  // when the warm-up ends, close the loop: one call, one match, now the league
  function foQsTutWatch() {
    try { if (window.__foTutIv) clearInterval(window.__foTutIv); } catch (e) {}
    var started = Date.now();
    window.__foTutIv = setInterval(function () {
      try {
        if (Date.now() - started > 45 * 60000) { clearInterval(window.__foTutIv); window.__foTutIv = null; return; }
        // only the warm-up itself closes the loop: M.meta.__tut rides in from
        // App.pending. If the warm-up never started or another match replaced
        // it, stand down instead of hijacking that match's full time.
        var tut = (typeof M !== "undefined" && M && M.meta && M.meta.__tut);
        if (!tut) {
          if (!(typeof App !== "undefined" && App && App.pending && App.pending.__tut)) { clearInterval(window.__foTutIv); window.__foTutIv = null; }
          return;
        }
        if (!M.done) return;
        clearInterval(window.__foTutIv); window.__foTutIv = null;
        setTimeout(function () {
          try {
            var txt = (M && M.result && M.result.text) || "Full time.";
            var ex = document.getElementById("fo-tut2"); if (ex) ex.remove();
            var m2 = document.createElement("div"); m2.id = "fo-tut2"; m2.className = "fo-modal";
            m2.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Full time</div>" +
              "<h3>" + E(txt) + "</h3>" +
              "<div class='small' style='margin:6px 0 12px'>That was one call shaping fifty overs - and it never counted for anything. Tonight's league match does. Your XI is one tap away on the club home.</div>" +
              "<div style='text-align:center'><button class='primary' id='fo-tut2-go'>To my club ▸</button></div></div>";
            document.body.appendChild(m2);
            m2.querySelector("#fo-tut2-go").addEventListener("click", function () {
              m2.remove(); location.hash = "#/club"; if (typeof window.route === "function") window.route();
            });
          } catch (e) {}
        }, 2200);
      } catch (e) {}
    }, 2000);
  }

  // ---- first-session golden path --------------------------------------------
  // After creation the club home "needs you today" strip shows exactly ONE
  // item: confirm the suggested XI for tonight. One tap; a quiet link to tweak.
  // No training, market or finance tasks in session one.
  function foQsGoldDone(r) {
    return "<div class='fo-qs-gold-ok'>&#10003; XI confirmed &middot; you play at 9:00 AM ET. <a data-r='" + r + "'>Review or tweak &rsaquo;</a></div>";
  }
  function foQsGolden(nxt, ordersIn, t) {
    var flag = lsGet("fo_qs_new");
    if (!flag) return "";
    if (!(SYNC && SYNC.started) || SYNC.practice || !nxt) return "";
    // confirmed just now: keep the green tick through re-renders for a while
    if (/^done:/.test(flag)) {
      var ts9 = +flag.slice(5) || 0;
      if (Date.now() - ts9 > 10 * 60000) { lsDel("fo_qs_new"); return ""; }
      return "<div class='fo-card fo-qs-gold' id='fo-qs-gold'>" + foQsGoldDone(nxt.round) + "</div>";
    }
    if (ordersIn) { lsDel("fo_qs_new"); return ""; }   // confirmed (maybe via a tweak) - retire the strip
    var starterNm = "";
    try { ((t && t.players) || []).some(function (p) { if (p && p.origin_tag && /Franchise (player|captain)/.test(p.origin_tag)) { starterNm = p.name; return true; } return false; }); } catch (e) {}
    return "<div class='fo-card fo-qs-gold' id='fo-qs-gold'><div class='fo-qs-gold-l'>" +
      "<div class='fo-qs-gk'>Needs you today</div>" +
      "<div class='fo-qs-gt'>Confirm your XI for Round " + (nxt.round + 1) + " " + (nxt.isHome ? "vs" : "at") + " " + E(nxt.opp.name) + "</div>" +
      "<div class='fo-qs-gs'>Your best eleven and sensible orders are already picked" + (starterNm ? ", built around " + E(starterNm) : "") + ". One tap and you play at 9:00 AM ET.</div></div>" +
      "<div class='fo-qs-gold-r'><button class='fo-next-cta' id='fo-qs-gold-btn' data-r='" + nxt.round + "'>Confirm my XI</button>" +
      "<a class='fo-qs-gtweak' data-r='" + nxt.round + "'>tweak it instead &rsaquo;</a></div></div>";
  }
  function foQsGoldenWire(page) {
    try {
      var gBtn = page.querySelector("#fo-qs-gold-btn");
      if (gBtn) gBtn.addEventListener("click", function () {
        try {
          var r = +gBtn.getAttribute("data-r");
          suggestOrders();
          App.orders.saved = true;
          App.defaults = JSON.parse(JSON.stringify(App.orders));
          foPushRound(r, App.orders);
          lsSet("fo_qs_new", "done:" + Date.now());
          var card = page.querySelector("#fo-qs-gold");
          if (card) {
            card.innerHTML = foQsGoldDone(r);
            var tw2 = card.querySelector("a[data-r]");
            if (tw2) tw2.addEventListener("click", function () { foSetOrdersForRound(r); });
          }
          toast("XI confirmed for Round " + (r + 1) + " · good luck out there.");
        } catch (e) { say(e); }
      });
      var gTw = page.querySelector(".fo-qs-gtweak");
      if (gTw) gTw.addEventListener("click", function () { lsDel("fo_qs_new"); foSetOrdersForRound(+gTw.getAttribute("data-r")); });
      var gOk = page.querySelector(".fo-qs-gold-ok a[data-r]");
      if (gOk && !gOk.__w) { gOk.__w = 1; gOk.addEventListener("click", function () { foSetOrdersForRound(+gOk.getAttribute("data-r")); }); }
    } catch (e) {}
  }

  // franchise players carry a permanent origin tag and a gold star on the
  // squad / club / player pages (the tag text is the tooltip)
  function foFranchiseBadges() {
    try {
      if (typeof App === "undefined" || !App || ["squad", "club", "player", "scout"].indexOf(App.page) < 0) return;
      var page = document.getElementById("page"); if (!page) return;
      // the tag/captain maps change rarely but CAN change in place (founding
      // writes origin_tag into the live GD.teams), so key the cache on a short
      // TTL + array identity rather than trying to fingerprint every player.
      // This runs on every 40ms-debounced DOM mutation - one rescan a second
      // is plenty.
      var teams = (typeof GD !== "undefined" && GD.teams) || [];
      var cache = foFranchiseBadges._c;
      if (!cache || cache.teams !== teams || Date.now() - cache.at > 1000) {
        var tags = {}, capts = {}, any = false;
        teams.forEach(function (t) {
          ((t && t.players) || []).forEach(function (p) {
            if (!p || !p.origin_tag) return;
            tags[p.name] = p.origin_tag; any = true;
            if (/Franchise captain/.test(p.origin_tag)) capts[p.name] = 1;
          });
        });
        cache = foFranchiseBadges._c = { teams: teams, at: Date.now(), tags: tags, capts: capts, any: any };
      }
      var tags = cache.tags, capts = cache.capts;
      if (!cache.any) return;   // no franchise players anywhere - nothing to do
      page.querySelectorAll("a, b, h1").forEach(function (el) {
        if (el.__foFp || el.querySelector(".fo-qs-fp") || el.querySelector(".fo-capt-chip")) return;
        var txt = (el.textContent || "").trim().replace(/\s*\u2020$/, "");
        if (tags[txt] == null) return;
        el.__foFp = 1;
        var i = document.createElement("i");
        if (capts[txt]) { i.className = "fo-capt-chip"; i.title = tags[txt]; i.textContent = "C"; }
        else { i.className = "fo-qs-fp"; i.title = tags[txt]; i.textContent = "\u2605"; }
        el.appendChild(i);
        // the captain's card is forever a different colour scheme: glow the
        // row or card that carries his name
        if (capts[txt]) {
          var box = el.closest("tr") || el.closest(".fo-dc") || el.closest(".fo-c2-wr") || el.closest(".fo-sq-item") || el.closest(".fo-sq-mfx") || el.closest(".fo-sqr-row");
          if (box) box.classList.add("fo-capt-glow");
        }
      });
      // the player page writes the name as a bare crumb text node. The dedupe
      // guard must cover BOTH chip classes - checking only the star meant a
      // captain's C chip never satisfied it, and every 40ms mutation pass
      // stacked another C onto the crumb forever.
      if (App.page === "player") {
        var cr = page.querySelector(".crumb");
        if (cr && !cr.querySelector(".fo-qs-fp, .fo-capt-chip")) {
          for (var nIx = 0; nIx < cr.childNodes.length; nIx++) {
            var nd = cr.childNodes[nIx];
            var ndT = nd.nodeType === 3 ? (nd.textContent || "").trim() : "";
            if (ndT && tags[ndT] != null) {
              var st = document.createElement("i");
              if (capts[ndT]) { st.className = "fo-capt-chip"; st.title = tags[ndT]; st.textContent = "C"; }
              else { st.className = "fo-qs-fp"; st.title = tags[ndT]; st.textContent = "\u2605"; }
              cr.insertBefore(st, nd.nextSibling);
              // and spell the tag out in the info panel - it is permanent history
              var info = page.querySelector(".ftp-pinfo-hand");
              if (info && !page.querySelector(".fo-qs-origin")) {
                var ln = document.createElement("div");
                ln.className = "fo-qs-origin" + (capts[ndT] ? " fo-qs-origin-c" : "");
                ln.innerHTML = (capts[ndT] ? "<i class='fo-capt-chip'>C</i> " : "\u2605 ") + E(tags[ndT]);
                info.parentNode.insertBefore(ln, info.nextSibling);
              }
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  // ---- TAKEOVER VARIANT (behind FO_TAKEOVER_ON, off for season 1) -----------
  // Take over an existing bot club: optional rename, keep its ground and pitch,
  // choose one of three franchise-player swaps. The join itself reuses the
  // battle-tested foJoinRunningSeason splice.
  var FO_TK = null;
  window.__foTk = { start: function (t2) { return foTakeoverStart(t2); },
    test: function (bot, offers) { FO_TK = { team: {}, bot: bot, name: bot.name, offers: offers || ["express", "rock", "wizard"], pick: null, country: "India", seed: "tk-test" }; foTkName(); } };
  function foTakeoverStart(team) {
    team = team || {};
    sel("league_state", "league_id=eq." + LG.id + "&select=snapshot").then(function (a) {
      var snap = a && a[0] && a[0].snapshot;
      var bots = ((snap && snap.teams) || []).filter(function (t) { return t && !t.founded; });
      if (!bots.length) { say("No bot club is free to take over - ask your commissioner to restart the season."); return; }
      var bot = bots[bots.length - 1];
      var seed = team.draft_seed || (SYNC && SYNC.myMid) || bot.name;
      // three deterministic archetype offers
      var ids = FO_ARCHETYPES.map(function (x) { return x.id; })
        .sort(function (x, y) { return foHash32(seed + x) - foHash32(seed + y); }).slice(0, 3);
      FO_TK = { team: team, bot: bot, name: bot.name, offers: ids, pick: null,
        country: team.country || (((bot.players || [])[0] || {}).nat) || NAT[0], seed: seed };
      foTkName();
    }).catch(say);
  }
  function foTkName() {
    var bot = FO_TK.bot;
    var body =
      "<div class='fo-ob-card'>" +
      "<div class='fo-ob-eyebrow'>Mid-season takeover &middot; step 1 of 2</div>" +
      "<h1 class='fo-ob-h1'>You inherit " + E(bot.name) + "</h1>" +
      "<p class='fo-ob-lead'>The board hands you a going concern: the squad, the fixtures already played, <b>" + E(bot.ground || "the ground") + "</b> and its " + E(foPitchName(bot.homePitch || "balanced").toLowerCase()) + " pitch. Rename the club if you like - or keep the history.</p>" +
      "<label class='fo-ob-lbl'>Club name</label><input id='fo-tk-nm' class='fo-ob-input' maxlength='28' value='" + E(FO_TK.name) + "'>" +
      "</div>";
    var host = foQsShell(1, body, foQsCtaBar("Continue", "fo-tk-c1"));
    host.querySelector("#fo-tk-c1").addEventListener("click", function () {
      var nm = (host.querySelector("#fo-tk-nm").value || "").trim();
      FO_TK.name = nm.length >= 2 ? nm : FO_TK.bot.name;
      foTkOffers();
    });
  }
  function foTkOffers() {
    var cards = FO_TK.offers.map(function (id) {
      var a = foArchById(id);
      return "<button type='button' class='fo-qs-arch" + (FO_TK.pick === id ? " on" : "") + "' data-a='" + id + "'>" +
        "<span class='fo-qs-aic'>" + foQsIcon(a.ic) + "</span>" +
        "<b class='fo-qs-anm'>" + a.nm + "</b>" +
        "<span class='fo-qs-arole'>" + (a.starRole || a.role) + "</span>" +
        "<span class='fo-qs-aline'>" + a.line + "</span>" +
        "<span class='fo-qs-chips'>" + a.chips.map(function (s) { return "<i class='fo-qs-chip g'>" + s + "</i>"; }).join("") + "</span></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card'>" +
      "<div class='fo-ob-eyebrow'>Mid-season takeover &middot; step 2 of 2</div>" +
      "<h1 class='fo-ob-h1'>The board backs one marquee signing</h1>" +
      "<p class='fo-ob-lead'>Three franchise players want the move. Whoever you pick replaces the weakest man in his position - the rest of the squad stays.</p>" +
      "<div class='fo-qs-grid'>" + cards + "</div></div>";
    var host = foQsShell(2, body, foQsCtaBar("Take over the club", "fo-tk-go", !FO_TK.pick, "fo-tk-b"));
    host.querySelectorAll(".fo-qs-arch").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_TK.pick = b.getAttribute("data-a");
        host.querySelectorAll(".fo-qs-arch").forEach(function (x) { x.classList.toggle("on", x === b); });
        var go = host.querySelector("#fo-tk-go"); if (go) go.disabled = false;
      });
    });
    host.querySelector("#fo-tk-b").addEventListener("click", foTkName);
    host.querySelector("#fo-tk-go").addEventListener("click", foTkGo);
  }
  function foTkGo() {
    try {
      var club = JSON.parse(JSON.stringify(FO_TK.bot));
      club.name = FO_TK.name; club.founded = true; club.archetype = FO_TK.pick;
      var star = foGenArchetypeSquad(FO_TK.seed + "|tk", FO_TK.country, FO_TK.pick).players[0];
      // replace the weakest player in the starter's own bucket
      var bucketOf = function (p) { return p.keeper ? "wk" : (p.bowlTypeFull && p.bowlTypeFull !== "none" && p.role !== "allRounder") ? "bowl" : "bat"; };
      var bkt = bucketOf(star);
      var pool = (club.players || []).filter(function (p) { return bucketOf(p) === bkt; })
        .sort(function (a, b) { return (a.rating || 0) - (b.rating || 0); });
      var out = pool[0];
      if (out) club.players.splice(club.players.indexOf(out), 1);
      star.origin_tag = "Franchise player - marquee takeover signing";
      club.players.push(star);
      foOnbClose();
      rpc("push_club", { p_league_id: LG.id, p_club: club, p_team_ix: null })
        .then(function () {
          // flags only once the club actually reached the server - a failed
          // push must not leave this device claiming a finished onboarding
          try { window.store("fo_onb_done", "1"); lsSet("fo_qs_new", "1"); } catch (e) {}
          foJoinRunningSeason(club);
        }).catch(say);
    } catch (e) { say(e); }
  }

  // ---- squad shape + advisor -----------------------------------------------
  function foRoleShort(p) {
    if (p.keeper) return "WK";
    if (p.role === "allRounder") return "AR";
    if (p.bowlTypeFull ? p.bowlTypeFull !== "none" : p.bowlType) return foIsPace(p) ? "PACE" : "SPIN";
    return "BAT";
  }
  function foSquadShape(picked) {
    var bowl = 0, wk = 0, ar = 0, bat = 0;
    picked.forEach(function (p) {
      if (p.bowlTypeFull && p.bowlTypeFull !== "none") bowl++;
      if (p.keeper) wk++;
      if (p.role === "allRounder") ar++;
      else if (!(p.bowlTypeFull && p.bowlTypeFull !== "none") && !p.keeper) bat++;
    });
    return { n: picked.length, bowl: bowl, wk: wk, ar: ar, bat: bat };
  }
  function foSquadReady(picked) { var s = foSquadShape(picked); return s.n >= 11 && s.wk >= 1 && s.bowl >= 5; }
  function foAdvisor(picked, fc, styleId) {
    var s = foSquadShape(picked), out = [];
    if (s.wk < 1) out.push({ t: "warn", m: "No wicketkeeper yet · you need at least one." });
    if (s.bowl < 5) out.push({ t: "warn", m: "You have only " + s.bowl + " bowling options. Aim for at least 5 reliable ones." });
    if (fc.end < 0) out.push({ t: "danger", m: "Your wage bill is high · you are projected to lose money this season." });
    else if (fc.bankAfter >= 180000 && s.n >= 8) out.push({ t: "ok", m: "You have kept " + FO$(fc.bankAfter) + " back · room for injuries and mid-season signings." });
    if (fc.draftSpent > 900000) out.push({ t: "warn", m: "Under " + FO$(1000000 - fc.draftSpent) + " left in reserve · one bad month could sink you." });
    var pt = (FO_ONB && FO_ONB.pitch) || "balanced";
    if ((pt === "green" || pt === "cracked") && s.n >= 6 && picked.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && foIsPace(p); }).length < 3) out.push({ t: "info", m: "Your home pitch is " + foPitchName(pt).toLowerCase() + " · pace bowlers will love it. Consider drafting more seamers." });
    if (pt === "dry" && s.n >= 6 && picked.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !foIsPace(p); }).length < 2) out.push({ t: "info", m: "Your home pitch is crumbling · it will turn. Consider drafting more spinners." });
    var ce = null; for (var i = 0; i < picked.length; i++) { if (foDraftPrice(picked[i]) < 40000 && foDailyWage(picked[i]) >= 3200) { ce = picked[i]; break; } }
    if (ce) out.push({ t: "info", m: E(ce.name) + " is cheap to draft but expensive in wages." });
    if (!out.length && s.n >= 11) out.push({ t: "ok", m: "Squad is financially safe and legally shaped." });
    return out;
  }
  function foOnbPick(name) {
    var F = App.founder, p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === name) { p = F.pool[i]; break; }
    if (!p) return;
    var ix = F.picked.indexOf(p);
    var before = foSquadShape(F.picked);
    if (ix >= 0) { F.picked.splice(ix, 1); }
    else {
      var spent = F.picked.reduce(function (s, q) { return s + foDraftPrice(q); }, 0);
      if (spent + foDraftPrice(p) > FO_FIN.startingBank) { toast("Not enough budget left for " + p.name + " · " + FO$(FO_FIN.startingBank - spent) + " remaining.", "error"); return; }
      if (F.picked.length >= 16) { toast("Squad is full (16). Drop someone to sign " + p.name + ".", "error"); return; }
      F.picked.push(p);
      // milestone feedback: celebrate each squad requirement the moment it's met
      var after = foSquadShape(F.picked);
      if (before.wk === 0 && after.wk === 1) toast("Keeper secured · " + p.name + " takes the gloves.");
      else if (before.bowl === 4 && after.bowl === 5) toast("Five bowling options · you can cover all 50 overs.");
      else if (before.n === 10 && after.n === 11) toast("Eleven players · your XI is complete. Add depth or continue.");
      else if (after.n === 16) toast("Squad full · 16 players signed.");
    }
    if (!foDraftPatch(name)) foOnbDraft(true);
  }
  function foOrdinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function foTalentName(t) { return String(t || "").replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }).trim(); }
  // Aggregate skill (0-100) via the engine's own summary functions.
  function foAgg(p, nm) {
    try {
      // a specialist bowler's Technique is his craft - accuracy, discipline,
      // movement - not his batting feel (which is deliberately poor)
      if (nm === "tech" && foPureBowler(p)) {
        var s0 = p.skills || {};
        return Math.max(0, Math.min(100, Math.round(((s0.economy || 0) + (s0.discipline || 0) + (s0.moveTurn || 0)) / 3)));
      }
      return Math.max(0, Math.min(100, Math.round(({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField, end: aggEnd, tech: aggTech })[nm](p))));
    } catch (e) { return 0; }
  }
  // The engine's skill word ("ordinary", "elite", "world class", …).
  function foWord(v) { try { return (typeof word === "function") ? word(v) : ""; } catch (e) { return ""; } }
  // Bar tone by value: weak -> red, ordinary -> amber, good -> teal, elite -> green.
  function foSkTone(v) { return v >= 75 ? "elite" : v >= 50 ? "good" : v >= 30 ? "mid" : "low"; }
  // The game's full 7-skill read-out (Batting/Bowling/Keeping/Endurance/
  // Technique/Power/Fielding), each a bar + the engine's word for it.
  function foSkillBars(p) {
    var isBowler = p.bowlTypeFull ? p.bowlTypeFull !== "none" : !!p.bowlType;
    var pw = 0; try { pw = (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) {}
    var bars = [["Batting", foAgg(p, "bat")], ["Bowling", isBowler ? foAgg(p, "bowl") : 0], ["Keeping", foAgg(p, "keep")],
      ["Endurance", foAgg(p, "end")], ["Technique", foAgg(p, "tech")], ["Power", Math.max(0, Math.min(100, Math.round(pw)))],
      ["Fielding", foAgg(p, "field")]];
    var tip = function (label) { try { return (typeof TIPS !== "undefined" && TIPS[label]) ? TIPS[label] : ""; } catch (e) { return ""; } };
    return "<div class='fo-dc-bars'>" + bars.map(function (b) {
      return "<span class='fo-db'><i title='" + E(tip(b[0])) + "'>" + b[0] + "</i><b><u class='fo-sk-" + foSkTone(b[1]) + "' style='width:" + b[1] + "%'></u></b><em title='" + E(foWord(b[1]) || "") + "'>" + b[1] + "</em></span>";
    }).join("") + "</div>";
  }
  // One draft-room player card · the game's own card, in the brand theme.
  function foDraftCard(p, inSquad) {
    var nm = E(p.name).replace(/'/g, "&#39;");
    var bt = (typeof foBT === "function") ? foBT(p) : "";
    var meta = (p.hand === "L" ? "Left" : "Right") + " hand batsman" + (bt ? " | " + bt : "") + (p.expWord || p.exp ? " · exp " + E(p.expWord || p.exp) : "");
    var ttip = function (t) { try { return (typeof TALTIPS !== "undefined" && TALTIPS[t]) ? TALTIPS[t] : ""; } catch (e) { return ""; } };
    var tals = (p.talents || []).map(function (t) { return "<span class='fo-dc-tal' title='" + E(ttip(t)) + "'>" + E(foTalentName(t)) + "</span>"; }).join("");
    var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? foFlag(p.nat) : ""; } catch (e) {}
    return "<div class='fo-dc " + (inSquad ? "fo-dc-in" : "") + "'>" +
      "<div class='fo-dc-h'>" +
      "<span class='fo-rl'>" + foRoleShort(p) + "</span>" +
      (flag ? "<span class='fo-dc-flag'>" + flag + "</span>" : "") +
      "<b class='fo-dc-nm fo-dr-view' data-p='" + nm + "'>" + E(p.name) + (p.keeper ? " &dagger;" : "") + "</b>" +
      "<span class='fo-dc-meta'>" + E(p.nat || "") + " · age " + (p.age || "?") + " · OVR <b>" + (p.rating ? (p.rating / 1000).toFixed(1) : "-") + "</b></span>" +
      "<span class='fo-dc-fee'>" + FO$(foDraftPrice(p)) + "</span>" +
      "<button class='fo-dr-add " + (inSquad ? "on" : "") + "' data-p='" + nm + "'>" + (inSquad ? "Drop" : "Sign") + "</button>" +
      "</div>" +
      "<div class='fo-dc-sub'><span>" + meta + "</span>" + tals +
      "<span class='fo-dc-wage'>wage " + FO$(foDailyWage(p)) + "/matchday · season " + FO$(foSeasonCost(p)) + "</span></div>" +
      foSkillBars(p) + "</div>";
  }
  // A player's skill-summary card (bars, not a raw line) · opened by clicking a
  // name in the draft table.
  function foDraftDetail(name) {
    try {
      var F = App.founder, p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === name) { p = F.pool[i]; break; }
      if (!p) return;
      var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
      var agg = function (nm) { try { return Math.round(({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField, end: aggEnd, tech: aggTech })[nm](p)); } catch (e) { return 0; } };
      var pw = 0; try { pw = (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) {}
      var bars = [["Batting", agg("bat")], ["Bowling", isBowler ? agg("bowl") : 0], ["Keeping", agg("keep")], ["Fielding", agg("field")], ["Power", pw], ["Technique", agg("tech")], ["Endurance", agg("end")]];
      var word = function (v) { try { return typeof window.word === "function" ? window.word(v) : ""; } catch (e) { return ""; } };
      var barHtml = bars.map(function (b) { var v = Math.max(0, Math.min(100, Math.round(b[1] || 0))); return "<div class='fo-pd-bar'><span>" + b[0] + "</span><i><b class='fo-sk-" + foSkTone(v) + "' style='width:" + v + "%'></b></i><em title='" + E(word(v) || "") + "'>" + v + "</em></div>"; }).join("");
      var talents = (p.talents || []).map(function (t) { var d = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; return "<span title='" + E(d) + "' style='text-decoration:underline dotted'>" + E(foTalentName(t)) + "</span>"; }).join(", ") || "None";
      var inSquad = F.picked.indexOf(p) >= 0;
      var host = document.getElementById("fo-onb"); if (!host) return;
      var old = document.getElementById("fo-pd"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-pd";
      d.innerHTML = "<div class='fo-pd-back'><div class='fo-pd-card'>" +
        "<div class='fo-pd-h'><div><div class='fo-pd-nm'>" + ((typeof foFlag === "function" && p.nat) ? foFlag(p.nat) + " " : "") + E(p.name) + "</div><div class='fo-pd-meta'><span class='fo-rl'>" + foRoleShort(p) + "</span> " + E(p.nat || "") + " · age " + (p.age || "?") + " · OVR " + (p.rating ? (p.rating / 1000).toFixed(1) : "-") + "</div></div><button class='fo-pd-x'>✕</button></div>" +
        "<div class='fo-pd-money'><span>Draft<b>" + FO$(foDraftPrice(p)) + "</b></span><span>Wage / matchday<b>" + FO$(foDailyWage(p)) + "</b></span><span>Season cost<b>" + FO$(foSeasonCost(p)) + "</b></span></div>" +
        "<div class='fo-pd-sec'>Skill summary</div><div class='fo-pd-bars'>" + barHtml + "</div>" +
        "<div class='fo-pd-tal'><b>Talents:</b> " + talents + "</div>" +
        "<div class='fo-pd-act'><button class='fo-pd-add " + (inSquad ? "on" : "") + "'>" + (inSquad ? "− Remove from squad" : "+ Add to squad") + "</button></div>" +
        "</div></div>";
      host.appendChild(d);
      d.querySelector(".fo-pd-x").addEventListener("click", function () { d.remove(); });
      d.querySelector(".fo-pd-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-pd-back")) d.remove(); });
      d.querySelector(".fo-pd-add").addEventListener("click", function () { foOnbPick(p.name); d.remove(); });
    } catch (e) {}
  }

  // ---- Screen 5 · Draft room with live finance forecast --------------------
  // ---- Screen 5 · Reading a player (tutorial before the draft) --------------
  // ---- shared "how to read a player" pieces: the onboarding primer and the
  // game manual render the SAME example cards and trait glossary, so the two
  // explanations can never drift apart ----
  function foExpCard(ex, tagLbl, money) {
    if (!ex) return "";
    var flag = ""; try { flag = foFlag(ex.nat || (FO_ONB && FO_ONB.country)) || ""; } catch (e) {}
    var hand = (ex.hand === "L" ? "LHB" : "RHB");
    var bt = ex.btLabel || ((ex.bowlTypeFull && ex.bowlTypeFull !== "none") ? ex.bowlTypeFull : "Does not bowl");
    var detail = "";
    try { detail = (typeof foSqDetail === "function") ? foSqDetail(ex, false) : ""; } catch (eD) {}
    var ovr = "";
    try {
      var isB = ex.bowlTypeFull ? ex.bowlTypeFull !== "none" : !!ex.bowlType;
      var oc = function (lbl, v) { return "<span><i>" + lbl + "</i><b>" + Math.round(v) + "</b></span>"; };
      ovr = "<div class='fo-exp-ovr'>" +
        (isB ? oc("Bowling", aggBowl(ex)) : "") +
        oc("Batting", aggBat(ex)) +
        (ex.keeper ? oc("Keeping", aggKeep(ex)) : oc("Fielding", aggField(ex))) +
        "</div>";
    } catch (eO) {}
    var moneyRow = "";
    try {
      if (money === "draft") moneyRow = "<div class='fo-exp-money'><span>Fee <b>" + FO$(foDraftPrice(ex)) + "</b></span><span>Wage <b>" + FO$(foDailyWage(ex)) + "</b>/matchday</span></div>";
      else if (money === "wage") moneyRow = "<div class='fo-exp-money'><span>Wage <b>" + FO$(ex.wage || 0) + "</b>/matchday</span><span>Age <b>" + (ex.age || "?") + "</b></span></div>";
    } catch (eM) {}
    return "<div class='fo-exp-card'><div class='fo-exp-tag'>" + tagLbl + "</div><div class='fo-exp-h'>" + flag + " <b>" + E(ex.name) + "</b></div>" +
      "<div class='fo-exp-meta'>" + hand + " &middot; " + E(bt) + " &middot; age " + ex.age + "</div>" + ovr + moneyRow +
      detail + "</div>";
  }
  function foTraitGlossary(keys) {
    var gsec = function (title, note, rows) {
      return "<div class='fo-exp-def'><b class='fo-exp-gt'>" + title + "</b>" + (note ? "<span class='fo-exp-gnote'>" + note + "</span>" : "") +
        rows.map(function (r) { return "<div class='fo-exp-tr'><i>" + r[0] + "</i><span>" + r[1] + "</span></div>"; }).join("") + "</div>";
    };
    // every line below is checked against the live match engine: what a skill
    // actually touches, per ball, is exactly what it is said to touch
    var G = {
      batting: gsec("Batting", "every player has these", [
        ["Overall", "The headline batting number: a weighted blend of the five skills below. Every player owns one, bowlers included: it is what he brings when he walks out to bat."],
        ["vs pace", "Scoring and survival against fast bowling. It feeds the overall, and it acts directly on every ball a seamer bowls at him: a low number gets found out by quicks, worst of all on a green pitch."],
        ["vs spin", "The same against finger and wrist spin, live on every ball of spin he faces. Spin-weak batters get strangled through the middle overs on turning pitches."],
        ["Rotation", "Turns dot balls into singles and twos on every quiet delivery, on top of feeding the overall. The difference between 40 off 70 and 40 off 55."],
        ["Power", "Sixes. Every good connection carries further, and in the last ten overs power also pumps the boundary rate directly: the death is where it pays double."],
        ["Temperament", "The quiet fifth of the overall: general tightness of technique that is always on, whoever is bowling. It has no special pressure trigger of its own - big-moment composure is <b>Experience</b>, in the footer."]
      ]),
      bowling: gsec("Bowling", "bowlers only", [
        ["Overall", "The headline bowling number, at the top of the group just like the batting one: the average of his six bowling skills, the scout&rsquo;s one-figure price of the craft."],
        ["Wicket threat", "Raw ability to create chances - edges, bowled, lbw - checked on every single ball he bowls. The biggest driver of wickets in the game."],
        ["Economy", "Control, checked on every ball: more dot balls, and fewer wides sprayed under pressure. The engine&rsquo;s word for a bowler who is simply hard to score off."],
        ["Discipline", "Craft that shows in his overall and his fee rather than ball by ball - on the day, control is expressed through Economy. Train it to lift his overall and his value."],
        ["Move / turn", "Also priced into the overall; the movement you actually watch comes from his <b>type</b> meeting the conditions: green pitches multiply seam, dry ones multiply turn, the new ball swings, the old one grips."],
        ["Stamina", "How long a spell stays honest, and how fresh he starts the next matchday. Bowling burns energy roughly twice as fast as batting - genuine quicks fastest of all - and hot or humid days drain everyone faster."]
      ]),
      reserves: gsec("Reserves", "batters who do not bowl", [
        ["Technique", "The engine never reads this bar - you do. It averages a batter&rsquo;s survival craft (vs pace, vs spin, temperament); on a pure bowler&rsquo;s card it becomes his control (economy, discipline, movement). Read it against the headline: well above means craft without punch, well below means muscle without craft. The full story, with what to do about each, is in Reading a player."],
        ["Stamina", "Not just for bowlers: stamina sets how fast <i>any</i> player tires, every ball he bats (keepers work hardest of the fielding side). Tired batters find fielders, and a long hot innings leaves the legs heavy for the next matchday."]
      ]),
      field: gsec("In the field", "", [
        ["Fielding", "Checked on almost every ball in the field: high numbers cut fours into twos and twos into singles; low ones leak misfields and fumbles. The XI&rsquo;s <i>average</i> fielding also tightens the whole innings: more dots, fewer boundaries."],
        ["Catching", "When the edge comes, the catcher&rsquo;s hands set the drop chance: about one in six for ordinary hands, closer to one in a hundred for the very best. Cold and misty days make everyone butterier."],
        ["Keeping", "The heart of the glove rating (stumping and catching mix in): a good keeper concedes fewer byes and turns more edges into wickets."],
        ["Stumping", "Quickness of the hands: more stumping chances taken, fewer fluffed, everything sharper standing up to spin."]
      ]),
      footer: gsec("The footer", "", [
        ["Experience", "The real pressure skill. As required rates climb, wickets fall and the death arrives, experienced batters panic less and experienced bowlers hold their nerve - both live effects that grow with the tension."],
        ["Captaincy", "Works at both ends: a sharp captain squeezes extra dot balls out of his fielding XI and quietly steadies the side&rsquo;s batting. The armband also costs him extra energy on draining days."],
        ["Fatigue", "His freshness today. Tired players bat, bowl and field below their numbers until they rest, and deep fatigue carries into the next matchday."],
        ["Nationality", "Home country. The two best performers per country earn international call-ups during the season."]
      ]),
      reading: gsec("Reading the page", "", [
        ["Words &amp; colours", "Every number wears an honest word (atrocious at the bottom, legendary at the top) and a colour: <b style='color:#B23230'>red</b> is a liability, <b style='color:#C08A2E'>amber</b> does a job, <b style='color:#2d7a76'>teal</b> is good, <b style='color:#16A34A'>green</b> wins matches."],
        ["Hand &amp; style", "RHB or LHB, plus the bowling type: genuine fast, fast medium, medium, finger spin or wrist spin. The types and their rarity are explained on the bowler&rsquo;s page."],
        ["Age", "Young players train faster and recover quicker. Past 30 they fade late in innings and decline between seasons."],
        ["Fee &amp; wage", "The fee is paid once, at the draft. The wage is paid every matchday, all season, so a full squad of stars will drain the bank twice over."]
      ])
    };
    var order = (keys && keys.length) ? keys : ["batting", "bowling", "reserves", "field", "footer", "reading"];
    return order.map(function (k) { return G[k] || ""; }).join("");
  }
  // ---- Screen 6 : Reading conditions -----------------------------------
  // Bowling styles + rarity, pitch types, weather types: every effect below is
  // real in the match engine. Sits between the player primer and the draft so
  // a new manager drafts with the full picture.
  // conditions field-guide cards, shared verbatim by the onboarding screen
  // and the game manual
  function foCondCards() {
    // every card carries its own tint + a small monoline glyph, in the same
    // stroke style as FO_ICONS, so the wall of white boxes reads as a field
    // guide instead of a spreadsheet
    var ic = function (path) { return "<span class='fo-cnd-ic'><svg viewBox='0 0 24 24' width='14' height='14' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + path + "</svg></span>"; };
    var G = {
      bolt: "<path d='M13 2 6 13h5l-1.5 9L18 10h-5l1.5-8z'/>",
      chevs: "<path d='M6 6l6 6-6 6M13 6l6 6-6 6'/>",
      chev: "<path d='M9.5 6l6 6-6 6'/>",
      rotate: "<path d='M20 12a8 8 0 1 1-2.5-5.9M20 3v4h-4'/>",
      seam: "<circle cx='12' cy='12' r='8'/><path d='M9.6 5.6c2.4 4 2.4 8.8 0 12.8M14.4 5.6c-2.4 4-2.4 8.8 0 12.8'/>",
      scales: "<path d='M12 4v16m-5 0h10M7 5.5h10'/><path d='M7 5.5 4 12a3.4 3.4 0 0 0 6 0L7 5.5Zm10 0L14 12a3.4 3.4 0 0 0 6 0l-3-6.5Z'/>",
      grass: "<path d='M6 20c.5-5-.5-8-2-10M12 20c0-7-.6-10-1.5-13M18 20c-.5-5 .5-8 2-10M12 20c1.5-4 3.5-6 5.5-7'/>",
      crack: "<path d='M4 19 9 12l3 3 4-7 4 6'/>",
      road: "<path d='M3 15h18M6 9h12'/>",
      wave: "<path d='M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0'/>",
      bounce: "<path d='M4 18 9 10l3 4 5-8'/><path d='M14 6h3v3'/>",
      twoArrows: "<path d='M4 9h11M12 6l3 3-3 3M4 16h6M8 14l2 2-2 2'/>",
      sun: "<circle cx='12' cy='12' r='4'/><path d='M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19'/>",
      cloud: "<path d='M7 18h9.5a4 4 0 1 0-.8-7.9A6 6 0 0 0 4.2 12 3.5 3.5 0 0 0 7 18z'/>",
      mist: "<path d='M4 9h16M6 13h13M8 17h8'/>",
      drop: "<path d='M12 4c3 4 5 6.3 5 8.8a5 5 0 0 1-10 0C7 10.3 9 8 12 4z'/>",
      thermo: "<path d='M10 4a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0V4z'/><path d='M12 9v7'/>",
      flame: "<path d='M12 3c1 3.5 5 5.2 5 9.5a5 5 0 0 1-10 0c0-3 2.2-4.6 3.2-7 .6 1.4 1.8 2 1.8 2Z'/>",
      drizzle: "<path d='M7 14h9.5a4 4 0 1 0-.8-7.9A6 6 0 0 0 4.2 8 3.5 3.5 0 0 0 7 14z'/><path d='m9 17-1 2.5M13 17l-1 2.5M17 17l-1 2.5'/>",
      wind: "<path d='M9.6 4.6A2 2 0 1 1 11 8H3M12.6 19.4A2 2 0 1 0 14 16H3M17.7 7.7A2.5 2.5 0 1 1 19.5 12H3'/>",
      flake: "<path d='M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9'/>",
      dew: "<path d='M4 20h16'/><path d='M12 4.5c2.2 3 3.7 4.8 3.7 6.7a3.7 3.7 0 0 1-7.4 0c0-1.9 1.5-3.7 3.7-6.7z'/>"
    };
    var chip = function (cls, txt) { return "<span class='fo-cnd-chip " + cls + "'>" + txt + "</span>"; };
    var card = function (theme, glyph, nm, chips, d, ex) {
      return "<div class='fo-cnd fo-cnd--" + theme + "'><div class='fo-cnd-t'>" + ic(glyph) + "<b>" + nm + "</b>" + chips + "</div><p>" + d + "</p>" + (ex ? "<p class='fo-cnd-ex'>" + ex + "</p>" : "") + "</div>";
    };
    var sec = function (no, title, sub, cards) {
      return "<div class='fo-cnd-sec'><div class='fo-cnd-h'><span class='fo-cnd-no'>" + no + "</span><b>" + title + "</b><span>" + sub + "</span></div><div class='fo-cnd-grid'>" + cards + "</div></div>";
    };
    var rare = function (t) { return chip("fo-cnd-rare", "&#9670; " + t); };
    var com = function (t) { return chip("fo-cnd-com", t); };
    var drain = function (t) { return chip("fo-cnd-drain", t); };
    var bowlers = [
      card("ember", G.bolt, "Genuine fast", rare("Rarest &middot; ~1 in 20"),
        "The apex predator: the biggest wicket threat of any style, at any stage of the innings. Burns energy fastest and commands the game&rsquo;s steepest fees.",
        "A genuine quick under overcast skies is the most dangerous thing in this game."),
      card("plum", G.rotate, "Wrist spin", rare("Very rare &middot; ~1 in 12"),
        "Attacking spin: googlies and rip that buy wickets through the middle overs, priced at a premium to match.",
        "On a crumbling pitch a wrist spinner turns the middle overs into a minefield."),
      card("slate", G.chevs, "Fast medium", com("Uncommon"),
        "New-ball seam with honest pace: real threat while the ball is hard, respectable control after.",
        "The bread-and-butter opening bowler on any green or overcast day."),
      card("stone", G.chev, "Medium", com("Common"),
        "The workhorse. Modest threat, but he keeps an end tight and his overs come cheap.",
        "A reliable fifth or sixth option through the quiet middle overs."),
      card("sage", G.seam, "Finger spin", com("Common"),
        "Control first: dots and squeezed middle overs, with real menace once a pitch turns dry.",
        "On flat days he saves runs; on crumbling ones he wins matches.")
    ].join("");
    var pitches = [
      ["stone", G.scales, "Balanced", "No advantage or disadvantage to batters or bowlers.", "Pick your best XI."],
      ["grass", G.grass, "Green", "Strong help for seam bowlers, biggest with the new ball - fast-medium gains most, then fast; medium least. Moderate disadvantage to spin bowlers.", "Pick extra seam bowlers."],
      ["clay", G.crack, "Crumbling", "Strong help for spin bowlers - finger spin far more than wrist - growing as the pitch wears. Weak disadvantage to seam bowlers in the middle overs.", "Pick extra spin bowlers."],
      ["cream", G.road, "Flat", "Strong advantage to batters: boundaries flow and wickets are dear. Strong disadvantage to all bowlers.", "Pick your strongest batting."],
      ["olive", G.wave, "Slow", "Moderate help for spin bowlers and medium-pace cutters in the middle overs. Strong cut to six-hitting. Weak disadvantage to fast and fast-medium bowlers.", "Pick spinners and patient batters."],
      ["rust", G.bounce, "Sticky", "Strong help for all bowlers - wrist spin notably more from the bounce - and more again in the second innings. Strong disadvantage to batters.", "Pick batting depth."],
      ["iris", G.twoArrows, "Two-paced", "Weak wicket help for all bowlers, moderate for spin and medium-pace cutters in the middle overs. Boundaries moderately harder.", "Pick batting depth."]
    ].map(function (x) { return card(x[0], x[1], x[2], "", x[3], x[4]); }).join("");
    var weathers = [
      card("sun", G.sun, "Sunny", "", "No effect on batters or bowlers.", "Nothing to adjust: cricket as designed."),
      card("greyc", G.cloud, "Overcast", "", "Moderate help for seam bowlers all innings - fast-medium swing gains most, express pace least. Moderate cut to boundaries. No effect on spin.", "Pick extra seam bowlers; expect a lower-scoring day."),
      card("mist", G.mist, "Misty", "", "Strong help for seam bowlers while the ball is new - fast-medium swing most - fading as it ages. Moderate cut to boundaries. No effect on spin.", "Pick seamers who use the new ball."),
      card("humid", G.drop, "Humid", drain("Drains &middot; bowlers ~20% faster"), "Strong help for seam bowlers while the ball is new - fast-medium swing most - fading to nothing as it ages. No effect on spin. Weak extra fatigue for everyone, heaviest on quick bowlers.", "See off the opening spell; watch bowler workloads."),
      card("hotc", G.thermo, "Hot", drain("Drains &middot; bowlers ~35% faster"), "Weak advantage to batters: slightly fewer wickets, slightly more boundaries. Moderate extra fatigue, heaviest on quick bowlers.", "Rotate spells; tired legs carry into the next fixture."),
      card("scorch", G.flame, "Scorching", drain("Drains &middot; bowlers ~60% faster"), "Moderate advantage to batters: fewer wickets, more boundaries. Strong extra fatigue, heaviest on quick bowlers.", "Short spells, deep batting: a sixth bowling option earns his keep."),
      card("rain", G.drizzle, "Drizzle", "", "Moderate cut to boundaries; scoring is slower. No effect on wickets, for seam or spin.", "Boundaries are earned, not given."),
      card("windc", G.wind, "Windy", "", "Strong cut to six-hitting; more runs come from hard-run twos. No effect on wickets.", "Run hard twos instead of swinging harder."),
      card("ice", G.flake, "Chilly", "", "Weak cut to boundaries; scoring is slower. No effect on wickets, for seam or spin.", "A day for percentages, not fireworks."),
      card("dusk", G.dew, "Dew later", "", "In the chase only: moderate disadvantage to spin bowlers - finger spin hardest, wrist spin less - and easier scoring. Helps the side batting second.", "If dew is forecast, bowling first is the percentage call.")
    ].join("");
    return { sec: sec, bowlers: bowlers, pitches: pitches, weathers: weathers,
      // Every effect above is read off the engine's own terms - the ballDist
      // weather block for wickets and scoring, and the FO_WX_DRAIN overlay
      // (11-chronicle.js: humid 1.2x, hot 1.35x, scorching 1.6x, job-weighted
      // fast > fast-medium > other bowlers > keepers > batters) for the heat.
      heat: "<div class='fo-exp-talbox'><b>Heat is a squad question.</b> In Humid, Hot and Scorching weather every player&rsquo;s fatigue clock runs faster: bowlers lose threat and control late in spells, set batters lose their edge sooner, and heavy workloads leave players tired for the next matchday at lower ball counts. On the hottest days a sixth bowling option, even a modest one, keeps every spell short and every bowler dangerous. Fitness decides who copes: stamina matters most for genuine quicks, then fast-medium, then the rest of the attack, then keepers, and least for pure batters. The captain carries a little extra for running the side. Quoted drain rates are for a frontline bowler of average fitness; the order screen shows the true range for your own squad on the day.</div>" };
  }
  // Re-render only what a signing changes: the player's own card, the sticky
  // budget strip, the side panels, the rail pills and the footer. Rails and
  // page scroll are untouched, so nothing jumps.
  function foDraftBucket(p) { var r = foRoleShort(p); return r === "WK" ? "wk" : r === "BAT" ? "bat" : r === "AR" ? "ar" : r === "PACE" ? "pace" : "spin"; }
  function foDraftWireCard(el) {
    el.querySelectorAll(".fo-dr-add").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    el.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
  }
  function foDraftStickyHtml(fc, shape) {
    var spentPct = Math.min(100, Math.round(fc.draftSpent / 10000));
    return "<div class='fo-dr-spent'><div class='fo-dr-spentl'><span>Spent <b>" + FO$(fc.draftSpent) + "</b> of $1,000,000</span><span><b>" + FO$(fc.bankAfter) + "</b> left</span></div>" +
      "<div class='fo-budgetbar'><u style='width:" + spentPct + "%'></u></div></div>" +
      "<div class='fo-dr-counts'><span class='fo-sh'><b>" + shape.n + "</b>/16</span><span class='fo-sh'><b>" + shape.bat + "</b> BAT</span><span class='fo-sh'><b>" + shape.bowl + "</b> BOWL</span><span class='fo-sh'><b>" + shape.ar + "</b> AR</span><span class='fo-sh'><b>" + shape.wk + "</b> WK</span></div>";
  }
  function foDraftSideHtml(F, shape, fc) {
    var advisor = foAdvisor(F.picked, fc, FO_ONB.style).map(function (a) { return "<div class='fo-adv fo-adv-" + a.t + "'>" + a.m + "</div>"; }).join("");
    return "<div class='fo-adv-panel'><div class='fo-adv-h'>Your squad &middot; " + shape.n + "/16</div>" +
      (F.picked.slice().sort(function (a, b) { return foDraftPrice(b) - foDraftPrice(a); }).map(function (p) {
        var nm = E(p.name).replace(/'/g, "&#39;");
        return "<div class='fo-sq-item'><span class='fo-rl'>" + foRoleShort(p) + "</span><b class='fo-dr-view' data-p='" + nm + "'>" + E(p.name) + "</b><em>" + FO$(foDraftPrice(p)) + "</em><button class='fo-sq-x' data-p='" + nm + "' title='Remove'>&#10005;</button></div>";
      }).join("") || "<div class='fo-sq-empty'>Empty. Swipe through the rails and sign players; they appear here.</div>") + "</div>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Advisor</div>" + (advisor || "<div class='fo-adv fo-adv-info'>Start adding players to see advice.</div>") + "</div>";
  }
  function foDraftPatch(playerName) {
    var host = document.getElementById("fo-onb"); if (!host || !host.querySelector(".fo-dr-sticky")) return false;
    var F = App.founder;
    var fc = foForecast(F.picked, FO_ONB.sponsor), shape = foSquadShape(F.picked);
    // 1. the toggled player's card, swapped in place
    if (playerName) {
      var p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === playerName) { p = F.pool[i]; break; }
      if (p) {
        var esc2 = E(playerName).replace(/'/g, "&#39;");
        var btn = host.querySelector(".fo-rail .fo-dr-add[data-p='" + esc2 + "']");
        var card = btn && btn.closest(".fo-dc");
        if (card) {
          var tmp = document.createElement("div");
          tmp.innerHTML = foDraftCard(p, F.picked.indexOf(p) >= 0);
          var fresh = tmp.firstChild;
          card.parentNode.replaceChild(fresh, card);
          foDraftWireCard(fresh);
        }
      }
    }
    // 2. sticky strip
    var st = host.querySelector(".fo-dr-sticky"); if (st) st.innerHTML = foDraftStickyHtml(fc, shape);
    // 3. side panels (+ rebind)
    var side = host.querySelector(".fo-dr-side");
    if (side) {
      side.innerHTML = foDraftSideHtml(F, shape, fc);
      side.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
      side.querySelectorAll(".fo-sq-x").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    }
    // 4. rail pills
    host.querySelectorAll(".fo-rail-sec").forEach(function (sec) {
      var rail = sec.querySelector(".fo-rail"); if (!rail) return;
      var k = rail.getAttribute("data-rail");
      var have = F.picked.filter(function (q) { return foDraftBucket(q) === k; }).length;
      var pill = sec.querySelector(".fo-rail-have");
      if (have && !pill) { pill = document.createElement("em"); pill.className = "fo-rail-have"; sec.querySelector(".fo-rail-h").appendChild(pill); }
      if (pill) { if (have) pill.textContent = have + " signed"; else pill.remove(); }
    });
    // 5. footer: continue button + requirements note
    var ready = foSquadReady(F.picked);
    var c = host.querySelector("#fo-ob-c"); if (c) c.disabled = !ready;
    var needs = host.querySelector(".fo-dr-needs");
    if (!ready && !needs) {
      needs = document.createElement("div"); needs.className = "fo-dr-needs";
      needs.textContent = "Need 11+ players, a keeper and 5+ bowling options to continue.";
      var wrapEl = host.querySelector(".fo-ob-draftwrap"); if (wrapEl) wrapEl.appendChild(needs);
    } else if (ready && needs) needs.remove();
    return true;
  }
  function foOnbDraft(keepScroll) {
    FO_ONB.step = 7;
    // preserve every rail's swipe position and the page scroll across re-renders
    var _rails = {}, _pageY = 0;
    try {
      _pageY = (document.getElementById("fo-onb") || {}).scrollTop || 0;
      document.querySelectorAll(".fo-rail").forEach(function (r) { _rails[r.getAttribute("data-rail")] = r.scrollLeft; });
    } catch (e) {}
    var F = App.founder;
    var fc = foForecast(F.picked, FO_ONB.sponsor);
    var shape = foSquadShape(F.picked);
    var byRat = function (a, b) { return (b.rating || 0) - (a.rating || 0); };
    var RAILS = [
      ["wk", "Wicketkeepers", "Every XI needs one behind the stumps"],
      ["bat", "Batters", "Your top order lives here"],
      ["ar", "All-rounders", "Bat and ball; the glue of a squad"],
      ["pace", "Pace bowlers", "New-ball and death overs"],
      ["spin", "Spinners", "Grip and squeeze through the middle"]
    ];
    var bucket = function (p) { var r = foRoleShort(p); return r === "WK" ? "wk" : r === "BAT" ? "bat" : r === "AR" ? "ar" : r === "PACE" ? "pace" : "spin"; };
    var railsHtml = RAILS.map(function (rl) {
      var players = F.pool.filter(function (p) { return bucket(p) === rl[0]; }).sort(byRat);
      if (!players.length) return "";
      var cards = players.map(function (p) { return foDraftCard(p, F.picked.indexOf(p) >= 0); }).join("");
      var have = F.picked.filter(function (p) { return bucket(p) === rl[0]; }).length;
      return "<div class='fo-rail-sec'><div class='fo-rail-h'><b>" + rl[1] + "</b><span>" + rl[2] + "</span>" +
        (have ? "<em class='fo-rail-have'>" + have + " signed</em>" : "") + "</div>" +
        "<div class='fo-rail' data-rail='" + rl[0] + "'>" + cards + "</div></div>";
    }).join("");
    var spentPct = Math.min(100, Math.round(fc.draftSpent / 10000));
    var ready = foSquadReady(F.picked);
    var advisor = foAdvisor(F.picked, fc, FO_ONB.style).map(function (a) { return "<div class='fo-adv fo-adv-" + a.t + "'>" + a.m + "</div>"; }).join("");

    var coach = "";
    try {
      if (!lsGet("fol_drcoach")) coach =
        "<div class='fo-dr-coach' id='fo-dr-coach'><button class='fo-dr-coach-x' id='fo-dr-coach-x' title='Dismiss'>&#10005;</button>" +
        "<b>How the draft works</b>" +
        "<div class='fo-dr-steps'>" +
        "<span><i>1</i>Each shelf below is a <b>row of players you can swipe sideways</b> - openers first, cheapest last.</span>" +
        "<span><i>2</i>Tap a name for the full card; tap <b>Sign</b> to add him. You need <b>11+ players, a keeper and 5+ bowlers</b>.</span>" +
        "<span><i>3</i>Watch the budget bar: every fee also brings a wage. The advisor on the right tells you what your squad still lacks.</span>" +
        "</div></div>";
    } catch (eC) {}
    var body =
      "<div class='fo-ob-draftwrap'>" +
      "<div class='fo-dr-head'><div><div class='fo-ob-eyebrow'>Draft room &middot; " + E(FO_ONB.clubName) + "</div><h1 class='fo-ob-h1'>Build your squad</h1></div></div>" + coach +
      "<div class='fo-dr-sticky'><div class='fo-dr-spent'><div class='fo-dr-spentl'><span>Spent <b>" + FO$(fc.draftSpent) + "</b> of $1,000,000</span><span><b>" + FO$(fc.bankAfter) + "</b> left</span></div>" +
      "<div class='fo-budgetbar'><u style='width:" + spentPct + "%'></u></div></div>" +
      "<div class='fo-dr-counts'><span class='fo-sh'><b>" + shape.n + "</b>/16</span><span class='fo-sh'><b>" + shape.bat + "</b> BAT</span><span class='fo-sh'><b>" + shape.bowl + "</b> BOWL</span><span class='fo-sh'><b>" + shape.ar + "</b> AR</span><span class='fo-sh'><b>" + shape.wk + "</b> WK</span></div></div>" +
      "<div class='fo-dr-grid'>" +
      "<div class='fo-dr-main'>" + railsHtml + "</div>" +
      "<div class='fo-dr-side'>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Your squad &middot; " + shape.n + "/16</div>" +
      (F.picked.slice().sort(function (a, b) { return foDraftPrice(b) - foDraftPrice(a); }).map(function (p) {
        var nm = E(p.name).replace(/'/g, "&#39;");
        return "<div class='fo-sq-item'><span class='fo-rl'>" + foRoleShort(p) + "</span><b class='fo-dr-view' data-p='" + nm + "'>" + E(p.name) + "</b><em>" + FO$(foDraftPrice(p)) + "</em><button class='fo-sq-x' data-p='" + nm + "' title='Remove'>&#10005;</button></div>";
      }).join("") || "<div class='fo-sq-empty'>Empty. Swipe through the rails and sign players; they appear here.</div>") + "</div>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Advisor</div>" + (advisor || "<div class='fo-adv fo-adv-info'>Start adding players to see advice.</div>") + "</div>" +
      "</div></div>" +
      "<div class='fo-ob-act fo-dr-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c' " + (ready ? "" : "disabled") + ">Continue &#8594; Board report</button></div>" +
      (ready ? "" : "<div class='fo-dr-needs'>Need 11+ players, a keeper and 5+ bowling options to continue.</div>") +
      "</div>";
    var host = foOnbMount(4, body);
    if (keepScroll) requestAnimationFrame(function () {
      try {
        host.scrollTop = _pageY;
        host.querySelectorAll(".fo-rail").forEach(function (r) { var k = r.getAttribute("data-rail"); if (_rails[k]) r.scrollLeft = _rails[k]; });
      } catch (e) {}
    });
    var cx = host.querySelector("#fo-dr-coach-x");
    if (cx) cx.addEventListener("click", function () { lsSet("fol_drcoach", "1"); var c0 = host.querySelector("#fo-dr-coach"); if (c0) c0.remove(); });
    // one-time nudge: the first shelf rocks sideways so scrolling is obvious
    if (!keepScroll && !lsGet("fol_drnudge")) {
      lsSet("fol_drnudge", "1");
      setTimeout(function () {
        var r0 = host.querySelector(".fo-rail"); if (!r0 || !r0.scrollTo) return;
        r0.scrollTo({ left: 130, behavior: "smooth" });
        setTimeout(function () { r0.scrollTo({ left: 0, behavior: "smooth" }); }, 700);
      }, 900);
    }
    host.querySelectorAll(".fo-dr-add").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    host.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
    host.querySelectorAll(".fo-sq-x").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbSponsor);
    var c = host.querySelector("#fo-ob-c"); if (c) c.addEventListener("click", foOnbAfterDraft);
  }

  function foOnbAfterDraft() {
    if (!foSquadReady(App.founder.picked)) return;
    var fc = foForecast(App.founder.picked, FO_ONB.sponsor);
    var bad = foForecast(App.founder.picked, FO_ONB.sponsor, "bad");
    if ((fc.end < 0 || bad.end < -60000) && !FO_ONB.riskAck) { foOnbRisk(fc); return; }
    foOnbReport();
  }

  // ---- Screen 6 · Risk warning ---------------------------------------------
  function foOnbRisk(fc) {
    FO_ONB.step = 7;
    var body =
      "<div class='fo-ob-card fo-ob-narrow fo-ob-risk'>" +
      "<div class='fo-risk-ic'>" + FO_I("warn", 26) + "</div>" +
      "<h1 class='fo-ob-h1'>This squad is projected to finish the season at <span class='fo-risk-amt'>" + FO$s(fc.end) + "</span>.</h1>" +
      "<p class='fo-ob-lead'>You can continue, but your club may face:</p>" +
      "<ul class='fo-ob-list fo-risk-list'><li>Forced player releases</li><li>Blocked signings</li><li>Supporter mood drop</li></ul>" +
      "<label class='fo-ob-check'><input type='checkbox' id='fo-ob-ack' " + (FO_ONB.riskAck ? "checked" : "") + "> I understand the risk</label>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-revise'>Revise squad</button><button class='fo-ob-cta fo-cta-danger' id='fo-ob-cont' disabled>Continue anyway</button></div></div>";
    var host = foOnbMount(4, body);
    var ack = host.querySelector("#fo-ob-ack"), cont = host.querySelector("#fo-ob-cont");
    var sync = function () { FO_ONB.riskAck = ack.checked; cont.disabled = !ack.checked; };
    ack.addEventListener("change", sync); sync();
    host.querySelector("#fo-ob-revise").addEventListener("click", function () {
      FO_ONB.riskAck = false;   // revising withdraws the acknowledgement - the next squad gets its own warning
      if (LG && LG.full_draft) foOnbDraft(); else foOnbSponsor();
    });
    cont.addEventListener("click", function () { FO_ONB.riskAck = true; foOnbReport(); });
  }

  // ---- Screen 7 · Season 1 Board Report ------------------------------------
  function foOnbReport() {
    FO_ONB.step = 8;
    var F = App.founder, fc = foForecast(F.picked, FO_ONB.sponsor);
    var sp = foSponsorById(FO_ONB.sponsor);
    var shape = foSquadShape(F.picked);
    var avg = function (arr) { return arr.length ? Math.round(arr.reduce(function (s, v) { return s + v; }, 0) / arr.length) : 0; };
    var topN = function (vals, n) { return vals.sort(function (a, b) { return b - a; }).slice(0, n); };
    var batStr = avg(topN(F.picked.map(function (p) { return foAgg(p, "bat"); }), 7));
    var bowlStr = avg(topN(F.picked.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none"; }).map(function (p) { return foAgg(p, "bowl"); }), 6));
    var fieldStr = avg(F.picked.map(function (p) { return foAgg(p, "field"); }));
    var keepStr = avg(topN(F.picked.filter(function (p) { return p.keeper; }).map(function (p) { return foAgg(p, "keep"); }), 1));
    var starsOf = function (v) { return v >= 78 ? 5 : v >= 66 ? 4 : v >= 54 ? 3 : v >= 40 ? 2 : 1; };
    var starRow = function (l, v) {
      var n = starsOf(v), tone = foSkTone(v), s = "";
      for (var i = 0; i < 5; i++) s += "<i class='fo-seg fo-segt-" + tone + (i < n ? " on" : "") + "'></i>";
      return "<div class='fo-str-row'><span>" + l + "</span><span class='fo-segs'>" + s + "</span></div>";
    };
    var fact = function (l, v) { return "<div class='fo-fact'><span>" + l + "</span><b>" + v + "</b></div>"; };
    var body =
      "<div class='fo-ob-card fo-ob-report'>" +
      "<div class='fo-br-cols'><div class='fo-br-main'>" +
      "<div class='fo-br-head'><span class='fo-br-crest'><img src='" + APPICON + "' alt=''></span><div><div class='fo-ob-eyebrow'>Season 1</div><h1 class='fo-ob-h1'>Board Report</h1></div></div>" +
      "<div class='fo-facts'>" +
      fact("Squad", shape.n + " players") +
      fact("Balance", shape.bat + " BAT &middot; " + shape.bowl + " BOWL &middot; " + shape.ar + " AR &middot; " + shape.wk + " WK") +
      fact("Sponsor", E(sp.name)) +
      fact("Bank", FO$(fc.bankAfter)) +
      fact("First matchday", "9:00 AM ET") + "</div>" +
      "<div class='fo-br-closure'><p>That's everything - your club is set up, your squad is signed, and " + E(sp.name) + " is on the shirt.</p>" +
      "<p>One match plays every day at 9:00 AM ET, eighteen rounds against nine other clubs. Pick your eleven each day and take it from there.</p>" +
      "<p class='fo-br-luck'>Good luck, " + E((SYNC && SYNC.me && SYNC.me.display_name) || "manager") + ".</p></div>" +
      "</div><aside class='fo-br-side'>" +
      "<div class='fo-clubprev' style='margin-bottom:0'><div class='fo-clubprev-crest'>" + E(FO_ONB.clubName.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 3).toUpperCase()) + "</div>" +
      "<div class='fo-clubprev-nm'>" + E(FO_ONB.clubName) + "</div>" +
      "<div class='fo-clubprev-sub'>" + (function () { try { return foFlag(FO_ONB.country) || ""; } catch (e) { return ""; } })() + " " + E(FO_ONB.country || "") + " &middot; " + E(FO_ONB.ground) + "</div>" +
      "<div class='fo-clubprev-sub'>Founded " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + "</div></div>" +
      "<div class='fo-br-panel' style='flex:1'><div class='fo-br-ph'>Squad strength</div>" +
      starRow("Batting", batStr) + starRow("Bowling", bowlStr) + starRow("Fielding", fieldStr) + starRow("Keeping", keepStr) + "</div>" +
      "</aside></div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back to the squad</button><button class='fo-ob-cta' id='fo-ob-done'>Enter the League</button></div></div>";
    var host = foOnbMount(5, body);
    host.querySelector("#fo-ob-b").addEventListener("click", function () { if (LG && LG.full_draft) foOnbDraft(); else foOnbSponsor(); });
    host.querySelector("#fo-ob-done").addEventListener("click", foOnbCommit);
  }

  // ---- Screen 8 · commit + hand off to the real club home ------------------
  function foOnbCommit() {
    try {
      var F = App.founder;
      F.name = FO_ONB.clubName; App.founder.identity = "Founding XI";
      var fc = foForecast(F.picked, FO_ONB.sponsor);
      var _bank = Math.round(fc.bankAfter);
      // club identity + relaunch era go on BEFORE founderConfirm: the league
      // wrapper deep-copies and uploads the club synchronously
      try {
        var tPre = GD.teams[App.teamIx || 0];
        if (tPre) {
          tPre.ground = FO_ONB.ground || tPre.ground; tPre.sponsor = FO_ONB.sponsor; tPre.homePitch = FO_ONB.pitch || "balanced";
          if (FO_ONB.arch) { tPre.archetype = FO_ONB.arch; }
          var _dealPre = foSponsorById(FO_ONB.sponsor);
          tPre.sponsorDeal = { id: _dealPre.id, base: _dealPre.base, win: _dealPre.win, halfway: _dealPre.halfway, seasonTop3: _dealPre.seasonTop3, champ: _dealPre.champ };
          var epC = window.__foRelaunchEpoch || foRelaunchEpochOf({ teams: (typeof GD !== "undefined" && GD.teams) || [] });
          if (epC) tPre.__foEpoch = epC;
        }
      } catch (ePre) {}
      window.__foRejoin = null;
      // The bank the onboarding promised ($1M minus signing fees) and the
      // players' provenance must be ON the club before the league wrapper
      // deep-copies it for push_club - the engine's own founderConfirm banks
      // a different formula (150k + 40% of unused), which would make every
      // OTHER client and the resolver see a different treasury than the
      // founder was shown. The wrapper calls this hook right after the
      // engine builds the club and right before it copies it.
      window.__foAfterConfirm = function () {
        var t = GD.teams[App.teamIx];
        if (!t) return;
        t.ground = FO_ONB.ground || t.ground; t.sponsor = FO_ONB.sponsor; t.homePitch = FO_ONB.pitch || "balanced"; t.bank = _bank;
        (t.players || []).forEach(function (dp) {
          dp._prov = dp._prov || { how: "draft", s: App.seasonNo || 1 };
          delete dp._qsPriced;   // fee-pricing flag was for the draft board only - founderConfirm deleted the fees, so don't let it ride the snapshots
        });
        var _deal = foSponsorById(FO_ONB.sponsor);
        t.sponsorDeal = { id: _deal.id, base: _deal.base, win: _deal.win, halfway: _deal.halfway, seasonTop3: _deal.seasonTop3, champ: _deal.champ };
        if (App.fin) { App.fin.bank = _bank; App.fin.sponsorBase = _deal.base; }
      };
      // let the engine build the real club record; the wrapper runs the hook
      // above, deep-copies, and uploads.
      try { window.founderConfirm(); } finally { window.__foAfterConfirm = null; }
      // flags only AFTER a successful commit: a founderConfirm throw must not
      // leave this device claiming a finished onboarding it never finished
      // (that state kills the #/create re-entry until a full reload).
      try {
        window.store("fo_onb_done", "1"); window.store("fo_sponsor", FO_ONB.sponsor);
        window.store("fo_ground", FO_ONB.ground); window.store("fo_pitch", FO_ONB.pitch);
      } catch (e) {}
      try { lsSet("fo_qs_new", "1"); if (FO_ONB.arch) lsSet("fo_qs_tut", String(Date.now())); else lsDel("fo_qs_tut"); } catch (eFl) {}
      try { foFranchiseBadges._c = null; } catch (eBc) {}   // origin_tag just landed in-place - next render must see it
      try { if (typeof window.saveGame === "function") window.saveGame(false); } catch (eSv) {}
      foOnbClose();
      // the existing post-confirm flow (showWait / club home) now owns the screen
    } catch (e) { say(e); foOnbClose(); }
  }


  // ================= The Founding Journey =====================================
  // Gaffer-led onboarding, five screens end to end: intro -> create ->
  // founded -> the squad dealt out -> club. It ran to thirty-odd screens once
  // - a soul chooser, the books, a reserve decision, the rival, a conditions
  // primer, three calls and a full warm-up match - and the length was the
  // problem, so all of that is gone.
  // Presentation only: the squad and the signing run through the existing,
  // verified plumbing (foGenArchetypeSquad, foOnbCommit).
  (function foJCss() {
    if (document.getElementById("fo-j-css")) return;
    var st = document.createElement("style"); st.id = "fo-j-css";
    st.textContent =
      ".fo-j-chap{display:flex;gap:14px;justify-content:center;margin:0 0 22px;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700;flex-wrap:wrap}" +
      ".fo-j-chap span{color:#b9b29a}.fo-j-chap span.on{color:#C9571F;border-bottom:2px solid #C9571F;padding-bottom:2px}.fo-j-chap span.done{color:#0C1B2E}.fo-j-chap i{font-style:normal;color:#d5cdb2}" +
      ".fo-j-dwrap{max-width:760px;margin:0 auto}" +
      ".fo-j-badge{display:flex;align-items:center;gap:10px;margin:6px 0 12px}.fo-j-badge i{width:44px;height:44px;border-radius:50%;border:2px solid #8F6A1C;background:#FFFEFC;display:grid;place-items:center;font-style:normal;font-size:20px}.fo-j-badge b{letter-spacing:2px;font-size:12px;color:#5b6472;text-transform:uppercase}" +
      ".fo-j-dbox{display:block;width:100%;text-align:left;background:#FFFEFC;border:2px solid #8F6A1C;border-radius:14px;padding:16px 20px;box-shadow:0 4px 0 rgba(16,27,45,.28);cursor:pointer;font:inherit}" +
      ".fo-j-dbox .sp{display:block;font-size:11px;letter-spacing:2.5px;color:#C9571F;font-weight:700;text-transform:uppercase;margin-bottom:6px}" +
      ".fo-j-dbox .tx{font-size:18px;line-height:1.55;color:#0C1B2E;min-height:56px}.fo-j-tri{color:#C9571F;animation:foJb 1s infinite}@keyframes foJb{50%{opacity:.25}}" +
      ".fo-j-gbox{max-width:640px;margin:10px auto;background:#FFFEFC;border:1.5px solid #D9B75A;border-radius:12px;padding:10px 16px;text-align:left}" +
      ".fo-j-gbox .sp{display:block;font-size:10px;letter-spacing:2px;color:#C9571F;font-weight:700;text-transform:uppercase;margin-bottom:2px}.fo-j-gbox .tx{font-size:14.5px;color:#0C1B2E;line-height:1.5}" +
      ".fo-j-cert{background:#FBF7EA;border:1px solid #d8d0b8;padding:24px 22px;position:relative;max-width:600px;margin:0 auto;text-align:center;border-radius:6px}" +
      ".fo-j-stamp{position:absolute;top:14px;right:14px;width:66px;height:66px;border:2.5px solid rgba(200,103,74,.45);border-radius:50%;display:grid;place-items:center;color:rgba(200,103,74,.55);font-size:10px;font-weight:700;transform:rotate(12deg);letter-spacing:1px;text-align:center;line-height:1.3;padding:6px}" +
      ".fo-j-marq{font-weight:800;text-transform:uppercase;letter-spacing:3px;font-size:clamp(22px,4.5vw,34px);color:#0C1B2E;line-height:1.1}" +
      ".fo-j-rule{display:flex;align-items:center;gap:12px;justify-content:center;color:#8F6A1C;margin:6px 0}.fo-j-rule i{flex:0 0 80px;height:2px;background:linear-gradient(90deg,transparent,#8F6A1C);border-radius:2px}.fo-j-rule i:last-child{background:linear-gradient(270deg,transparent,#8F6A1C)}.fo-j-rule b{font-size:11px;letter-spacing:3px;color:#8F6A1C}" +
      ".fo-j-souls{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:14px 0}" +
      ".fo-j-soul{background:#FFFEFC;border:1.5px solid rgba(16,27,45,.16);border-radius:14px;padding:14px;cursor:pointer;text-align:center;font:inherit;transition:border-color .15s}" +
      ".fo-j-soul.on{border-color:#C9571F;box-shadow:0 0 0 2px rgba(200,103,74,.3);background:#FFFEFC;color:inherit}" +
      ".fo-j-soul .nm{display:block;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-size:14px;margin:8px 0 2px}" +
      ".fo-j-soul .ln{display:block;font-size:12.5px;color:#5b6472;font-style:normal;min-height:34px}" +
      ".fo-j-stats{margin:8px 0 6px}.fo-j-stat{display:flex;align-items:center;gap:8px;margin:3px 0}.fo-j-stat span{flex:0 0 62px;font-size:10px;letter-spacing:1px;color:#8a90a0;text-transform:uppercase;text-align:left}.fo-j-stat i{flex:1;height:7px;background:rgba(16,27,45,.08);border-radius:99px;overflow:hidden;font-style:normal}.fo-j-stat i b{display:block;height:100%;border-radius:99px}" +
      ".fo-j-pros{font-size:12px;line-height:1.55;color:#2E7A3C;font-weight:600;text-align:left}.fo-j-pros .w{color:#B23A2E}" +
      ".fo-j-prev{background:#FFFEFC;border:1px solid rgba(16,27,45,.16);border-radius:14px;padding:14px 18px;margin-top:12px;text-align:left;max-width:680px;margin-left:auto;margin-right:auto}" +
      ".fo-j-pl{display:flex;gap:8px;font-size:13.5px;padding:3px 0;color:#4a5568}.fo-j-pl i{font-style:normal;font-weight:700;color:#0C1B2E;flex:0 0 128px}" +
      ".fo-j-ledger{background:#FBF7EA;border:1px solid #d8d0b8;border-radius:8px;max-width:560px;margin:14px auto 4px;padding:16px 20px 10px;box-shadow:0 3px 10px rgba(16,27,45,.08);text-align:left}" +
      ".fo-j-ledger .lmast{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#8a7b4f;border-bottom:2px solid #0C1B2E;padding-bottom:6px;flex-wrap:wrap}" +
      ".fo-j-money{width:100%;margin:2px auto 0;border-collapse:collapse;font-size:14.5px}" +
      ".fo-j-money td{padding:10px 2px;border-bottom:1px solid rgba(138,123,79,.28);text-align:left;color:#4a5568}.fo-j-money td:last-child{text-align:right;font-weight:600;color:#0C1B2E;font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:14px}" +
      ".fo-j-money .nt{display:block;font-size:11px;color:#8a7b4f;letter-spacing:.3px;margin-top:1px}" +
      ".fo-j-money tr.g td{color:#0C1B2E;font-weight:600}.fo-j-money tr.g td:last-child{font-size:17px}.fo-j-money td.neg{color:#B23A2E}.fo-j-money td.pos{color:#2E7A3C}" +
      ".fo-j-money tr.r td{font-weight:600;border-bottom:none;border-top:3px double #0C1B2E;color:#0C1B2E}.fo-j-money tr.r td:last-child{color:#2E7A3C;font-size:17px}" +
      ".fo-j-card .bk{display:block;margin-top:10px;padding-top:9px;border-top:1px dashed rgba(16,27,45,.2)}" +
      ".fo-j-card .bk i{display:block;font-style:normal;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#8a90a0}" +
      ".fo-j-card .bk b{font-size:17px;color:#2E7A3C;letter-spacing:.5px}" +
      ".fo-j-choice{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;max-width:760px;margin:10px auto}" +
      ".fo-j-card{background:#FFFEFC;border:2px solid rgba(16,27,45,.14);border-radius:14px;padding:16px;text-align:center;cursor:pointer;font:inherit;transition:border-color .15s,transform .15s}" +
      ".fo-j-card:hover{border-color:#C9571F;transform:translateY(-2px)}" +
      ".fo-j-card h3{margin:0 0 6px;font-size:15px;letter-spacing:1.5px;text-transform:uppercase;color:#0C1B2E}.fo-j-card .fx{font-size:13px;color:#5b6472;line-height:1.5}" +
      ".fo-j-sign{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:14px 0;align-items:start}" +
      ".fo-j-signc{background:#FFFEFC;border:1.5px solid rgba(16,27,45,.16);border-radius:14px;padding:14px;text-align:left}" +
      ".fo-j-risk{color:#B23A2E;font-size:12.5px;margin-top:6px;font-weight:600}" +
      ".fo-j-rivstage{display:flex;gap:26px;justify-content:center;align-items:flex-start;margin:6px 0 16px;flex-wrap:wrap}" +
      ".fo-j-rivfig{text-align:center;max-width:200px}.fo-j-rivnm{font-weight:800;letter-spacing:2.5px;font-size:14px;color:#0C1B2E;margin-top:8px;text-transform:uppercase}.fo-j-rivsub{font-size:12px;color:#6b7280;font-style:normal;margin-top:2px}.fo-j-vs{font-size:24px;color:#8F6A1C;align-self:center;font-weight:700}" +
      ".fo-j-wire{font-family:Fraunces,Georgia,'Times New Roman',serif;background:#FBF7E8;border:1px solid #d8d0b8;padding:20px 22px;box-shadow:0 3px 10px rgba(16,27,45,.1);text-align:left;max-width:620px;margin:0 auto}" +
      ".fo-j-wire .mast{display:flex;justify-content:space-between;align-items:baseline;font-size:10.5px;letter-spacing:1px;color:#8a7b4f}.fo-j-wire .mast .mh{font-weight:700;font-size:19px;letter-spacing:3px;color:#0C1B2E}" +
      ".fo-j-wire .dl{border-top:1px solid #0C1B2E;border-bottom:2.5px solid #0C1B2E;padding:3px 0;margin:4px 0 12px;font-size:10px;letter-spacing:2px;text-align:center;color:#6b6244}" +
      ".fo-j-wire h3{font-size:24px;line-height:1.15;color:#0C1B2E;margin:0 0 8px;text-transform:uppercase}" +
      ".fo-j-wire .by{font-style:normal;font-size:12.5px;color:#6b6244;margin-bottom:10px;border-bottom:1px solid #d8d0b8;padding-bottom:6px}" +
      ".fo-j-wire p{text-align:justify;font-size:14.5px;line-height:1.7;color:#33302a;margin:0 0 10px}" +
      ".fo-j-wfig{float:right;width:118px;margin:0 0 8px 16px;text-align:center}.fo-j-wcap{font-size:10.5px;font-style:normal;color:#6b6244;line-height:1.4;margin-top:4px}" +
      ".fo-j-pick{border-radius:12px;margin:0 auto 8px;max-width:680px;cursor:pointer}" +
      ".fo-j-prow{background:#FFFEFC;border:1.5px solid rgba(16,27,45,.14);border-radius:12px;padding:11px 15px;text-align:left}" +
      ".fo-j-pick.sel .fo-j-prow{border-color:#C9571F;box-shadow:0 0 0 2px rgba(200,103,74,.32)}" +
      ".fo-j-pnm{font-weight:700;color:#0C1B2E;font-size:15.5px}.fo-j-psub{display:block;font-size:12px;color:#6b7280;margin-top:1px}.fo-j-why{display:block;font-size:12.5px;color:#C9571F;font-weight:600;margin-top:2px}" +
      ".fo-j-bars{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 14px;margin-top:8px}" +
      ".fo-j-bar{display:flex;flex-direction:column;gap:3px;font-size:10px;letter-spacing:.5px;color:#8a90a0;text-transform:uppercase}" +
      ".fo-j-bar i{height:8px;background:#EDF3EA;border:1px solid #C2D4BD;border-radius:99px;overflow:hidden;font-style:normal}.fo-j-bar i b{display:block;height:100%;background:#2E9E4F;border-radius:99px}.fo-j-bar em{font-style:normal;color:#44503c;font-size:11px;text-transform:none}" +
      ".fo-j-chips{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:8px 0}" +
      ".fo-j-chip{padding:8px 16px;border-radius:99px;border:1px solid rgba(16,27,45,.25);background:#FFFEFC;cursor:pointer;font-size:13px;font-weight:600;color:#0C1B2E;font:inherit}" +
      ".fo-j-chip.on{background:#0C1B2E;color:#F4EFE3;border-color:#0C1B2E}" +
      ".fo-j-sec{display:flex;align-items:center;gap:10px;margin:20px auto 8px;max-width:680px;letter-spacing:2px;text-transform:uppercase;color:#0C1B2E;font-size:13px;font-weight:700}.fo-j-sec i{flex:1;height:1px;background:rgba(16,27,45,.18);font-style:normal}" +

      // ==== the trading-card player card (used in the journey and, soon, squad/scout/market) ====
      ".pk-row{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;align-items:flex-start;margin:14px 0}" +
      ".pk{width:min(440px,96vw);--ink:#14213D;--paper:#F7F2E4;font-family:Oswald,sans-serif;text-align:left}" +
      ".pk-frame{border:3px solid var(--tc);border-radius:20px;padding:3px;background:var(--paper);position:relative;box-shadow:0 8px 22px rgba(16,27,45,.22)}" +
      ".pk-in{border:1.5px solid var(--tc);border-radius:15px;padding:13px 16px;position:relative;background:radial-gradient(circle at 30% 8%, #FDFAF1 0%, var(--paper) 60%)}" +
      ".pk-notch{position:absolute;top:-8px;left:50%;transform:translateX(-50%) rotate(45deg);width:12px;height:12px;background:var(--paper);border:2px solid var(--tc)}" +
      ".pk-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}" +
      ".pk-role-lbl{font-family:Oswald,sans-serif;font-size:13.5px;letter-spacing:2.2px;color:var(--tcD);text-transform:uppercase;font-weight:600}" +
      ".pk-name{font-family:Oswald,sans-serif;font-weight:800;font-size:28px;color:var(--ink);line-height:1.04;letter-spacing:-.2px;margin-top:2px}" +
      ".pk-flag{font-size:21px;line-height:1;margin-top:6px;display:inline-block}.pk-flag img{width:26px;vertical-align:middle}" +
      ".pk-ovc{text-align:right;flex:0 0 auto;display:flex;flex-direction:column;align-items:flex-end}" +
      ".pk-ovr i{font-style:normal;font-family:Oswald,sans-serif;font-size:13px;letter-spacing:2px;color:var(--ink);font-weight:500;vertical-align:12px;margin-right:5px}" +
      ".pk-ovr b{font-family:Oswald,sans-serif;font-size:36px;font-weight:600;color:var(--tcD)}" +
      ".pk-hand{display:block;margin-top:4px;font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1.8px;font-weight:600;color:var(--tcD);border:1.4px solid var(--tc);border-radius:8px;padding:2.5px 10px;background:rgba(255,255,255,.4);cursor:help;text-align:center}" +
      // v2 art: the painted role-x-nation figure fills a full-bleed panel -
      // the national brush-stroke background IS the card's hero
      ".pk-art{height:236px;position:relative;margin:2px -6px 8px;border-radius:12px;overflow:hidden;box-shadow:inset 0 0 0 1.5px rgba(20,33,61,.3),0 4px 12px rgba(16,27,45,.2)}" +
      ".pk-art img{position:absolute;inset:0;left:0;bottom:auto;transform:none;width:100%;height:100%;max-width:none;object-fit:cover;object-position:50% 16%}" +
      ".pk-art .gnd{display:none}" +
      ".pk-art:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 78%,rgba(20,25,40,.22));pointer-events:none}" +
      ".pk-meta{border:1.3px solid rgba(20,33,61,.25);border-radius:11px;padding:6px 12px;display:flex;gap:7px;align-items:center;justify-content:center;font-style:normal;font-size:14px;color:#2b3550;background:rgba(255,255,255,.35);flex-wrap:wrap}" +
      ".pk-meta i{font-style:normal;color:var(--tcD)}.pk-meta .fl{font-style:normal;font-size:14px}.pk-meta .fl img{width:22px;vertical-align:middle}" +
      ".pk-tal-h{display:flex;align-items:center;gap:11px;margin:9px 0 6px;font-family:Oswald,sans-serif;font-size:12.5px;letter-spacing:2.6px;color:var(--tcD);font-weight:600}" +
      ".pk-tal-h i{flex:1;height:1.3px;background:rgba(20,33,61,.18);font-style:normal}" +
      ".pk-tals{display:flex;gap:9px;justify-content:center;flex-wrap:wrap}" +
      ".pk-tal{border:1.3px solid rgba(20,33,61,.28);border-radius:10px;padding:4px 14px;font-size:13.5px;font-weight:600;color:var(--ink);background:rgba(255,255,255,.4);cursor:help}" +
      ".pk-stats{margin-top:8px}" +
      ".pk-st{display:flex;align-items:center;gap:11px;padding:3.5px 0;cursor:help;border-radius:8px}.pk-st:hover{background:rgba(255,255,255,.5)}" +
      ".pk-en{width:24px;height:24px;border-radius:50%;flex:0 0 24px;display:grid;place-items:center;background:var(--tc);border:1.5px solid var(--tcD)}" +
      ".pk-en svg{width:13px;height:13px;stroke:#fff;fill:none;stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round}" +
      ".pk-st b{font-family:Oswald,sans-serif;font-weight:600;font-size:15px;letter-spacing:1.3px;flex:0 0 102px;color:var(--ink)}" +
      ".pk-bar{flex:1;height:9px;border-radius:99px;background:rgba(20,33,61,.1);overflow:hidden}" +
      ".pk-bar i{display:block;height:100%;border-radius:99px;background:var(--tc)}" +
      ".pk-st em{font-style:normal;font-family:Oswald,sans-serif;font-weight:600;font-size:17px;flex:0 0 30px;text-align:right;color:var(--ink)}" +
      ".pk-mid{display:flex;border-top:1.3px solid rgba(20,33,61,.18);margin-top:7px;padding-top:7px}" +
      ".pk-foot{display:flex;border-top:1.3px solid rgba(20,33,61,.14);margin-top:7px;padding-top:7px}" +
      ".pk-fc{flex:1;display:flex;gap:7px;align-items:center;padding:0 4px;cursor:help;min-width:0}" +
      ".pk-fc + .pk-fc{border-left:1.3px solid rgba(20,33,61,.14)}" +
      ".pk-fc svg{width:20px;height:20px;stroke:var(--tcD);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:0 0 20px}" +
      ".pk-fc i{display:block;font-style:normal;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.3px;color:var(--tcD);font-weight:600}" +
      ".pk-fc b{font-family:Oswald,sans-serif;font-weight:600;font-size:14px;color:var(--ink);white-space:nowrap}" +
      ".pk-risk{color:#B23A2E;font-size:13px;font-weight:600;margin-top:7px;text-align:center}" +
      "html body .pk-cta,html body.ftpskin .pk-cta{display:block;width:100%;margin-top:9px;font-family:Oswald,sans-serif !important;letter-spacing:3.5px;text-transform:uppercase;font-weight:600 !important;font-size:18px;background:var(--tc) !important;color:#FDFAF1 !important;border:none !important;border-radius:11px;padding:10px;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18)}" +
      "html body .pk-cta:hover,html body.ftpskin .pk-cta:hover,html body .pk-cta:focus,html body.ftpskin .pk-cta:focus{background:var(--tcD) !important;color:#FDFAF1 !important}" +
      // compact variant: the journey's signing row shows three cards at once -
      // hand-of-cards scale, so the choice reads side by side without scrolling
      ".pk-sign{gap:12px}" +
      ".pk-sign .pk{width:min(302px,94vw)}" +
      ".pk-sign .pk-in{padding:10px 12px}" +
      ".pk-sign .pk-role-lbl{font-size:11px;letter-spacing:1.8px}" +
      ".pk-sign .pk-name{font-size:20px}" +
      ".pk-sign .pk-flag{font-size:17px;margin-top:4px}.pk-sign .pk-flag img{width:21px}" +
      ".pk-sign .pk-ovr i{font-size:10.5px;letter-spacing:1.4px;vertical-align:8px;margin-right:4px}" +
      ".pk-sign .pk-ovr b{font-size:26px}" +
      ".pk-sign .pk-hand{font-size:10px;letter-spacing:1.4px;padding:2px 8px;margin-top:3px}" +
      ".pk-sign .pk-art{height:150px;margin:1px -4px 5px}.pk-sign .pk-art img{height:100%}" +
      ".pk-sign .pk-meta{font-size:12px;padding:4px 9px;gap:5px}.pk-sign .pk-meta .fl img{width:18px}" +
      ".pk-sign .pk-tal-h{font-size:10.5px;letter-spacing:2px;margin:6px 0 4px}" +
      ".pk-sign .pk-tal{font-size:11.5px;padding:2.5px 10px;border-radius:8px}" +
      ".pk-sign .pk-stats{margin-top:5px}" +
      ".pk-sign .pk-st{padding:2px 0;gap:8px}" +
      ".pk-sign .pk-en{width:19px;height:19px;flex:0 0 19px}.pk-sign .pk-en svg{width:10px;height:10px}" +
      ".pk-sign .pk-st b{font-size:12px;letter-spacing:1px;flex:0 0 78px}" +
      ".pk-sign .pk-bar{height:7px}" +
      ".pk-sign .pk-st em{font-size:14px;flex:0 0 24px}" +
      ".pk-sign .pk-mid,.pk-sign .pk-foot{margin-top:5px;padding-top:5px}" +
      ".pk-sign .pk-fc{gap:5px;padding:0 2px}.pk-sign .pk-fc svg{width:15px;height:15px;flex:0 0 15px}" +
      ".pk-sign .pk-fc i{font-size:10px;letter-spacing:1px}.pk-sign .pk-fc b{font-size:11.5px}" +
      "html body .pk-sign .pk-cta,html body.ftpskin .pk-sign .pk-cta{font-size:14px;letter-spacing:2.2px;padding:7px;margin-top:7px;border-radius:9px}" +
      // the unboxing: a spotlit pack on a light stage, then the FULL detailed
      // player cards dealt into a grid one at a time
      ".fo-jrv-wrap{background:radial-gradient(120% 80% at 50% 0%,#FFFEFC 0%,#F5EFE1 62%,#F1E9D8 100%);border-radius:20px;margin:6px auto 0;max-width:1200px;padding:20px 16px 26px;box-shadow:inset 0 0 0 1.5px rgba(201,162,75,.4),0 12px 34px rgba(16,27,45,.14)}" +
      ".fo-jrv{text-align:center;position:relative}" +
      ".fo-jrv-spot{position:absolute;top:-30px;left:50%;transform:translateX(-50%);width:340px;height:280px;background:radial-gradient(circle,rgba(201,162,75,.22),transparent 66%);pointer-events:none;filter:blur(4px)}" +
      ".fo-jrv-eyebrow{position:relative;font-family:Oswald,sans-serif;font-weight:600;letter-spacing:4px;text-transform:uppercase;font-size:11px;color:#C9571F}" +
      "html body #fo-onb .fo-jrv-h1,html body.ftpskin #fo-onb .fo-jrv-h1{color:#0C1B2E !important;margin:2px 0 4px;font-size:clamp(30px,6vw,44px);text-shadow:0 1px 0 rgba(255,255,255,.6)}" +
      "html body #fo-onb .fo-jrv-pack{position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:6px;margin:10px auto 4px;padding:20px 34px 15px;cursor:pointer;font:inherit;color:#F4EFE3;background:radial-gradient(circle at 50% 22%,#22345a 0%,#141f38 72%);border:2.5px solid #8F6A1C;border-radius:18px;box-shadow:0 12px 30px rgba(16,27,45,.35),0 0 30px rgba(201,162,75,.3),inset 0 0 0 1.5px rgba(201,162,75,.45);transition:transform .35s,opacity .35s;animation:foJrvFloat 3s ease-in-out infinite}" +
      "@keyframes foJrvFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}" +
      "html body #fo-onb .fo-jrv-pack:hover{transform:translateY(-3px) scale(1.02)}" +
      ".fo-jrv-pack img.fo-j-crimg{width:82px;height:82px;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))}" +
      ".fo-jrv-pack .pk1{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;font-size:16px}" +
      ".fo-jrv-pack .pk2{font-family:Oswald,sans-serif;font-weight:500;letter-spacing:2px;text-transform:uppercase;font-size:10.5px;color:#E4C463;animation:foJb 1.6s infinite}" +
      "html body #fo-onb .fo-jrv-pack.open{animation:none;transition:none;visibility:hidden;transform:scale(.4) rotate(-8deg);opacity:0;pointer-events:none;position:absolute;left:50%;top:70px;margin-left:-90px}" +
      ".fo-jrv-burst{position:absolute;left:50%;top:44%;width:20px;height:20px;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 0 0 0 rgba(201,162,75,.7)}" +
      ".fo-jrv-pack.open .fo-jrv-burst{animation:foJrvBurst .6s ease-out}" +
      "@keyframes foJrvBurst{0%{box-shadow:0 0 0 0 rgba(201,162,75,.7)}100%{box-shadow:0 0 0 220px rgba(201,162,75,0)}}" +
      ".fo-jrv-lab{position:relative;min-height:22px;font-family:Oswald,sans-serif;font-weight:600;letter-spacing:3px;text-transform:uppercase;font-size:14px;color:#C9571F;margin:4px 0 12px}" +
      ".fo-jrv-lab.pop{animation:foJrvPop .4s ease-out}" +
      "@keyframes foJrvPop{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}" +
      ".fo-jrv-grid{position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;text-align:left}" +
      // The squad is the one screen in the journey that wants the whole
      // desk: three across at laptop width, four on anything wider. Every
      // other step is a paragraph of the Gaffer talking and stays narrow.
      "html body #fo-onb .fo-ob-inner:has(.fo-jrv-wrap){max-width:1200px}" +
      "@media(min-width:820px){.fo-jrv-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}" +
      "@media(min-width:1120px){.fo-jrv-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}" +
      // In a grid this tight the browse card turns portrait at every width:
      // the painted figure comes off the left edge and onto the top of the
      // card, and the rating sits in the corner of the painting so the name
      // gets the full width instead of clipping to "Xavier Conno...".
      // Scoped to the reveal - squad, market and scout keep the wide card.
      "#fo-onb .fo-jrv-cell .pkm{padding:0 0 9px}" +
      "#fo-onb .fo-jrv-cell .pkm-top{flex-wrap:wrap;align-items:flex-end;gap:0 7px}" +
      "#fo-onb .fo-jrv-cell .pkm-art{position:relative;flex:0 0 100%;width:100%;height:158px;margin-bottom:7px}" +
      "#fo-onb .fo-jrv-cell .pkm-art:after{display:none}" +
      "#fo-onb .fo-jrv-cell .pkm-id{flex:1 1 100%;padding:0 9px}" +
      "#fo-onb .fo-jrv-cell .pkm-ovc{position:absolute;top:6px;right:6px;background:rgba(11,19,34,.82);border:1px solid rgba(201,162,75,.5);border-radius:9px;padding:3px 7px 2px}" +
      "#fo-onb .fo-jrv-cell .pkm-ovc b{font-size:19px;color:#E8B96A}" +
      "#fo-onb .fo-jrv-cell .pkm-ovc i{color:#cfd6e4}" +
      "#fo-onb .fo-jrv-cell .pkm-hand{display:none}" +
      "#fo-onb .fo-jrv-cell .pkm-bars{padding:0 9px;margin:8px 0 0}" +
      // two words of a bowling type will not fit on one narrow line, and a
      // role clipped to "Fast-Medium Bowler \u2026" reads as a bug; let it wrap
      "#fo-onb .fo-jrv-cell .pkm-sub{white-space:normal;line-height:1.3}" +
      // phone: two to a row, and the three skill bars go - this screen is a
      // squad roll call, not a scouting desk
      "@media(max-width:560px){" +
      ".fo-jrv-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}" +
      "#fo-onb .fo-jrv-cell .pkm-art{height:128px}" +
      "#fo-onb .fo-jrv-cell .pkm-nm{font-size:14px}" +
      "#fo-onb .fo-jrv-cell .pkm-sub{font-size:10.5px}" +
      "#fo-onb .fo-jrv-cell .pkm-bars{display:none}" +
      "}" +
      ".fo-jrv-cell{opacity:0}" +
      ".fo-jrv-cell.in{animation:foJrvFly .5s cubic-bezier(.16,.72,.28,1.1) forwards}" +
      ".fo-jrv-cell.in.insta{animation-duration:.01s}" +
      "@keyframes foJrvFly{0%{opacity:0;transform:translate(var(--dx,0),var(--dy,-180px)) scale(.2) rotate(var(--rot,10deg))}60%{opacity:1}100%{opacity:1;transform:none}}" +
      "@media (prefers-reduced-motion:reduce){.fo-jrv-cell{opacity:1}.fo-jrv-cell.in{animation:none}}" +
      ".fo-jrv-cell .pkm{box-shadow:0 4px 14px rgba(16,27,45,.15)}" +
      // a two-line role on one card and a one-line role on its neighbour left
      // the row ragged; let the card fill the height the grid already gave it
      ".fo-jrv-cell{display:flex}.fo-jrv-cell>.pkm{flex:1 1 auto}" +
      ".fo-jrv-foot{margin-top:16px}" +
      ".fo-jrv-skip{min-height:18px;margin-top:12px}" +
      ".fo-jrv-skip a{cursor:pointer;font-size:12.5px;color:#8a90a0;text-decoration:underline dotted}" +
      // tooltips: hover on desktop, tap (.tipshow) on touch
      "[data-tip]{position:relative}" +
      "[data-tip]:hover:after,[data-tip].tipshow:after{content:attr(data-tip);position:absolute;left:50%;bottom:calc(100% + 9px);transform:translateX(-50%);background:#0C1B2E;color:#F4EFE3;font-family:Oswald,sans-serif;font-size:13px;font-weight:500;font-style:normal;letter-spacing:.2px;line-height:1.5;padding:9px 13px;border-radius:10px;width:240px;text-align:center;z-index:99;box-shadow:0 5px 14px rgba(0,0,0,.3);text-transform:none;pointer-events:none}" +
      "[data-tip]:hover:before,[data-tip].tipshow:before{content:'';position:absolute;left:50%;bottom:100%;transform:translateX(-50%);border:7px solid transparent;border-top-color:#0C1B2E;margin-bottom:-4px;z-index:99}" +
      // gaffer + rival portraits, soul crests
      ".fo-j-badge img.gf{width:52px;height:52px;border-radius:50%;object-fit:cover;object-position:top;border:2px solid #8F6A1C;background:#FFFEFC}" +
      ".fo-j-gbox{display:flex;gap:12px;align-items:center}" +
      ".fo-j-gbox img.gf{width:46px;height:46px;border-radius:50%;object-fit:cover;object-position:top;border:1.5px solid #D9B75A;background:#FFFEFC;flex:0 0 46px}" +
      ".fo-j-gbox .bx{flex:1;min-width:0;text-align:left}" +
      ".fo-j-crimg{display:block;height:78px;margin:0 auto 4px;filter:drop-shadow(0 2px 4px rgba(16,27,45,.25))}" +
      ".fo-j-crimg.lg{height:110px}" +
      ".fo-j-face{width:120px;height:120px;border-radius:50%;object-fit:cover;object-position:top;border:3px solid #0C1B2E;background:#FFFEFC;box-shadow:0 4px 10px rgba(16,27,45,.3)}" +
      ".fo-j-wimg{width:110px;filter:grayscale(.85) sepia(.25) contrast(1.05);border:1px solid #b8ab84;display:block}" +
      // ==== compact card for squad / market / scout grids ====
      ".pkm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px;margin:4px 0 6px}" +
      // v2: the painted figure fills a full-height panel down the card's left
      // edge - every player card becomes a mini poster in his nation's colours
      ".pkm{--ink:#14213D;--paper:#F7F2E4;border:2px solid var(--tc);border-radius:13px;background:linear-gradient(180deg,#FDFAF1,var(--paper));padding:10px 12px 11px 102px;font-family:Oswald,sans-serif;box-shadow:0 3px 10px rgba(16,27,45,.12);position:relative;overflow:hidden}" +
      ".pkm-dim{opacity:.55;filter:saturate(.6)}" +
      ".pkm-top{display:flex;align-items:center;gap:10px}" +
      ".pkm-art{position:absolute;left:0;top:0;bottom:0;width:90px;overflow:hidden;background:#14213D;display:block}" +
      ".pkm-art img{width:100%;height:100%;max-height:none;max-width:none;object-fit:cover;object-position:50% 12%;display:block}" +
      ".pkm-art:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 70%,rgba(247,242,228,.45));pointer-events:none}" +
      ".pkm-id{flex:1;min-width:0}" +
      ".pkm-tag{display:inline-block;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;color:#fff;background:var(--tcD);border-radius:6px;padding:1px 7px;margin-bottom:2px}" +
      ".pkm-nm{font-family:Oswald,sans-serif;font-weight:800;font-size:17px;color:var(--ink);line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".pkm-nm img{width:18px;vertical-align:-3px}" +
      ".pkm-sub{font-size:12px;color:#5b6472;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".pkm-ovc{flex:0 0 auto;text-align:center;line-height:1}" +
      ".pkm-ovc b{font-family:Oswald,sans-serif;font-weight:600;font-size:26px;color:var(--tcD)}" +
      ".pkm-ovc i{display:block;font-style:normal;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.5px;color:#8a90a0;margin-top:-1px}" +
      ".pkm-hand{display:inline-block;margin-top:3px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1px;font-weight:600;color:var(--tcD);border:1.2px solid var(--tc);border-radius:6px;padding:1px 6px}" +
      ".pkm-bars{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 10px;margin:9px 0 2px}" +
      ".pkm-b{display:flex;align-items:center;gap:5px;cursor:help}" +
      ".pkm-b i{font-style:normal;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.5px;color:#8a90a0;flex:0 0 24px}" +
      ".pkm-b u{flex:1;height:6px;border-radius:99px;background:rgba(20,33,61,.1);overflow:hidden;text-decoration:none}" +
      ".pkm-b u b{display:block;height:100%;border-radius:99px;background:var(--tc)}" +
      ".pkm-b em{font-style:normal;font-family:Oswald,sans-serif;font-weight:600;font-size:12.5px;color:var(--ink);flex:0 0 20px;text-align:right}" +
      ".pkm-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;padding-top:8px;border-top:1px solid rgba(20,33,61,.12);flex-wrap:wrap}" +
      ".pkm-fee{font-size:12.5px;color:#5b6472}.pkm-fee b{color:var(--ink);font-family:Oswald,sans-serif;font-weight:600}" +
      "html body .pkm-act,html body.ftpskin .pkm-act{font-family:Oswald,sans-serif !important;letter-spacing:1px;text-transform:uppercase;font-weight:600 !important;font-size:12.5px;background:var(--tc) !important;color:#FDFAF1 !important;border:none !important;border-radius:8px;padding:7px 14px;cursor:pointer;box-shadow:inset 0 -2px 0 rgba(0,0,0,.18)}" +
      "html body .pkm-act:hover,html body.ftpskin .pkm-act:hover{background:var(--tcD) !important;color:#FDFAF1 !important}" +
      ".pkm-act[disabled]{opacity:.5;cursor:not-allowed}" +
      ".pkm-gone{font-size:12.5px;color:#5b6472;font-style:normal}" +
      ".pkm-cell{cursor:pointer;text-decoration:none;color:inherit;display:block}" +
      ".pkm-warn .pkm{border-color:#B23230}" +
      ".pkm-chips{display:block;margin-top:3px}" +
      ".pkm-chip{display:inline-block;font-size:10.5px;font-weight:600;color:#5b6472;background:rgba(20,33,61,.07);border-radius:6px;padding:1px 7px;margin:2px 4px 0 0}" +
      ".pkm-chip-lo{color:#b02a1e;background:rgba(220,38,38,.1)}" +
      ".pkm-energy{display:flex;align-items:center;gap:5px;font-size:11px;color:#8a90a0}.pkm-energy i{font-style:normal;font-family:Oswald,sans-serif;letter-spacing:.5px}.pkm-energy u{width:46px;height:6px;border-radius:99px;background:rgba(20,33,61,.1);overflow:hidden;text-decoration:none}.pkm-energy u b{display:block;height:100%;border-radius:99px}" +
      // player-page hero strip (art + card-consistent OVR / role label)
      ".fo-plh{display:flex;align-items:center;gap:16px;background:linear-gradient(180deg,#FDFAF1,#F7F2E4);border:2px solid var(--tc);border-radius:14px;padding:11px 18px;margin:0 0 14px;box-shadow:0 3px 10px rgba(16,27,45,.1)}" +
      ".fo-plh-art{width:72px;height:78px;flex:0 0 72px;display:grid;place-items:end center;background:radial-gradient(ellipse at 50% 92%,rgba(20,33,61,.13),transparent 62%)}" +
      ".fo-plh-art img{max-height:76px;max-width:70px;width:auto;height:auto;object-fit:contain}" +
      ".fo-plh-id{flex:1;min-width:0}" +
      ".fo-plh-role{font-family:Oswald,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--tcD);font-weight:600}" +
      ".fo-plh-name{font-family:Oswald,sans-serif;font-weight:800;font-size:26px;color:#14213D;line-height:1.05}" +
      ".fo-plh-name img{width:20px;vertical-align:-3px}" +
      ".fo-plh-meta{font-size:13.5px;color:#5b6472;margin-top:2px}.fo-plh-meta img{width:19px;vertical-align:-3px}" +
      ".fo-plh-ovr{text-align:center;flex:0 0 auto}" +
      ".fo-plh-ovr b{font-family:Oswald,sans-serif;font-weight:600;font-size:40px;color:var(--tcD)}" +
      ".fo-plh-ovr i{display:block;font-style:normal;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:2px;color:#8a90a0;margin-top:-4px}" +
      "@media(max-width:640px){.fo-j-bars{grid-template-columns:1fr}.fo-j-dbox .tx{font-size:16px}}" +
      // the ftpskin sheet paints EVERY button (and its focus state) - out-gun it
      "html body #fo-onb .fo-j-soul,html body.ftpskin #fo-onb .fo-j-soul{background:#FFFEFC !important;color:#1B2432 !important;border:1.5px solid rgba(16,27,45,.16) !important}" +
      "html body #fo-onb .fo-j-soul.on,html body.ftpskin #fo-onb .fo-j-soul.on,html body #fo-onb .fo-j-soul:focus,html body.ftpskin #fo-onb .fo-j-soul:focus{background:#FFFEFC !important;color:#1B2432 !important}" +
      "html body #fo-onb .fo-j-soul.on,html body.ftpskin #fo-onb .fo-j-soul.on{border-color:#C9571F !important;box-shadow:0 0 0 2px rgba(200,103,74,.3) !important}" +
      "html body #fo-onb .fo-j-card,html body.ftpskin #fo-onb .fo-j-card{background:#FFFEFC !important;color:#1B2432 !important;border:2px solid rgba(16,27,45,.14) !important}" +
      "html body #fo-onb .fo-j-card:hover,html body.ftpskin #fo-onb .fo-j-card:hover,html body #fo-onb .fo-j-card:focus,html body.ftpskin #fo-onb .fo-j-card:focus{background:#FFFEFC !important;border-color:#C9571F !important}" +
      "html body #fo-onb .fo-j-dbox,html body.ftpskin #fo-onb .fo-j-dbox{background:#FFFEFC !important;color:#0C1B2E !important;border:2px solid #8F6A1C !important}" +
      "html body #fo-onb .fo-j-dbox:focus,html body.ftpskin #fo-onb .fo-j-dbox:focus{background:#FFFEFC !important}" +
      "html body #fo-onb .fo-j-chip,html body.ftpskin #fo-onb .fo-j-chip{background:#FFFEFC !important;color:#0C1B2E !important;border:1px solid rgba(16,27,45,.25) !important}" +
      "html body #fo-onb .fo-j-chip.on,html body.ftpskin #fo-onb .fo-j-chip.on{background:#0C1B2E !important;color:#F4EFE3 !important;border-color:#0C1B2E !important}" +
      "html body #fo-onb .fo-j-pick .fo-j-prow,html body.ftpskin #fo-onb .fo-j-pick .fo-j-prow{background:#FFFEFC !important}" +
      // Typography: the prototype's voice. The app-wide sheet forces Inter on
      // #fo-onb with !important, so these carry the specificity to win it back:
      // Spline Sans for prose, Oswald for headers/labels/CTAs, Georgia for the
      // newspaper. Weights come DOWN across the board - elegance over bold.
      "html body #fo-onb .fo-ob-shell,html body #fo-onb .fo-ob-shell button,html body #fo-onb .fo-ob-shell input,html body #fo-onb .fo-ob-shell select{font-family:'Spline Sans','Inter',ui-sans-serif,system-ui,sans-serif !important}" +
      "html body #fo-onb .fo-j-chap,html body #fo-onb .fo-j-chap span,html body #fo-onb .fo-j-badge b,html body #fo-onb .fo-j-dbox .sp,html body #fo-onb .fo-j-gbox .sp,html body #fo-onb .fo-j-marq,html body #fo-onb .fo-j-rule b,html body #fo-onb .fo-j-soul .nm,html body #fo-onb .fo-j-card h3,html body #fo-onb .fo-j-sec,html body #fo-onb .fo-j-stat span,html body #fo-onb .fo-j-bar,html body #fo-onb .fo-j-rivnm,html body #fo-onb .fo-j-stamp,html body #fo-onb .fo-ob-h1,html body #fo-onb .fo-ob-eyebrow,html body #fo-onb .fo-ob-lbl,html body #fo-onb .fo-ob-shell .fo-ob-cta,html body #fo-onb .fo-ob-shell .fo-ob-ghost{font-family:Oswald,'Inter',sans-serif !important}" +
      "html body #fo-onb .fo-ob-h1{font-weight:600 !important;text-transform:uppercase;letter-spacing:1.5px;font-size:clamp(22px,4.6vw,30px);color:#0C1B2E}" +
      "html body #fo-onb .fo-ob-eyebrow{font-weight:500 !important;letter-spacing:3px !important}" +
      "html body #fo-onb .fo-ob-lbl{font-weight:500 !important;letter-spacing:.14em !important;color:#6b7280 !important;font-size:11.5px !important}" +
      "html body #fo-onb .fo-ob-cta{font-weight:600 !important;letter-spacing:1px !important;text-transform:uppercase !important}" +
      "html body #fo-onb .fo-ob-ghost{font-weight:500 !important;letter-spacing:1px !important;text-transform:uppercase !important;font-size:13px !important}" +
      "html body #fo-onb .fo-j-dbox .tx{font-weight:400}" +
      "html body #fo-onb .fo-j-gbox .tx{font-weight:400}" +
      "html body #fo-onb .fo-j-chap span{font-weight:500 !important}" +
      "html body #fo-onb .fo-j-badge b,html body #fo-onb .fo-j-dbox .sp,html body #fo-onb .fo-j-gbox .sp{font-weight:500 !important}" +
      "html body #fo-onb .fo-j-marq{font-weight:700 !important;letter-spacing:4px}" +
      "html body #fo-onb .fo-j-soul .nm,html body #fo-onb .fo-j-rivnm{font-weight:600 !important}" +
      "html body #fo-onb .fo-j-sec,html body #fo-onb .fo-j-card h3{font-weight:600 !important}" +
      "html body #fo-onb .fo-j-pros{font-weight:500}" +
      "html body #fo-onb .fo-j-pnm{font-weight:600}" +
      "html body #fo-onb .fo-j-wire,html body #fo-onb .fo-j-wire p,html body #fo-onb .fo-j-wire .by,html body #fo-onb .fo-j-wcap{font-family:Fraunces,Georgia,'Times New Roman',serif !important}" +
      "html body #fo-onb .fo-j-wire .mast,html body #fo-onb .fo-j-wire .dl,html body #fo-onb .fo-j-wire h3{font-family:Oswald,sans-serif !important;font-weight:600}" +
      "html body #fo-onb .fo-j-ledger .lmast,html body #fo-onb .fo-j-money td:last-child,html body #fo-onb .fo-j-card .bk i,html body #fo-onb .fo-j-card .bk b{font-family:Oswald,'Inter',sans-serif !important}" +
      // the warm-up banner lives OUTSIDE #fo-onb, pinned on the live match page
      "#fo-j-tutbar{background:#0C1B2E;color:#F4EFE3;border:1.5px solid #8F6A1C;border-radius:12px;padding:12px 16px 13px;margin:0 0 14px;text-align:center}" +
      "#fo-j-tutbar .t1{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2.5px;color:#D9B75A;text-transform:uppercase}" +
      "#fo-j-tutbar .t2{font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(24px,5vw,38px);letter-spacing:2px;text-transform:uppercase;line-height:1.12;margin:3px 0 4px}" +
      "#fo-j-tutbar .t2 .vs{font-size:.42em;font-weight:500;color:#b9b29a;letter-spacing:1.5px}" +
      "#fo-j-tutbar .t3{font-size:12.5px;color:#cfc9b4;line-height:1.5;max-width:640px;margin:0 auto}";
    document.head.appendChild(st);
  })();

  // tap-to-show tooltips on touch devices (hover handles desktop)
  try {
    if (!window.__foPkTipWired) {
      window.__foPkTipWired = 1;
      document.addEventListener("click", function (ev) {
        var t = ev.target && ev.target.closest ? ev.target.closest("[data-tip]") : null;
        Array.prototype.forEach.call(document.querySelectorAll("[data-tip].tipshow"), function (x) { if (x !== t) x.classList.remove("tipshow"); });
        if (t && window.matchMedia && !window.matchMedia("(hover:hover)").matches) t.classList.toggle("tipshow");
      }, true);
    }
  } catch (eTT) {}

  var FO_J_PREV = {
    express: { pitch: "green", bars: { Batting: 2, Bowling: 5, Fielding: 3, Nerve: 3 }, stars: "Fast bowler, seam-bowling all-rounder", prob: "Batting depth", conds: "Green and cloudy", quip: "Pace. Good. Nothing clears a Sunday crowd like broken stumps." },
    blade: { pitch: "flat", bars: { Batting: 5, Bowling: 2, Fielding: 3, Nerve: 2 }, stars: "Two attacking openers", prob: "Bowling at the death", conds: "Flat and dry", quip: "The Cavaliers. Glorious or gone by lunch, and I love them for it." },
    rock: { pitch: "slow", bars: { Batting: 4, Bowling: 3, Fielding: 3, Nerve: 5 }, stars: "An immovable opener, a miser seamer", prob: "Chasing steep rates", conds: "Anything slow", quip: "The Stonewall. Boring wins more trophies than brilliant, don't tell anyone." },
    wizard: { pitch: "dry", bars: { Batting: 3, Bowling: 5, Fielding: 2, Nerve: 3 }, stars: "Wrist spinner, finger spinner", prob: "Green wickets early on", conds: "Dry and turning", quip: "Spin. Cruelty in slow motion. My favourite kind." },
    gloveman: { pitch: "balanced", bars: { Batting: 3, Bowling: 2, Fielding: 5, Nerve: 4 }, stars: "Wicketkeeper, cover fielder", prob: "Bowling sides out", conds: "Fair, even contests", quip: "Safe Hands. Catches win matches, and I've got the knuckles to prove it." },
    engine: { pitch: "balanced", bars: { Batting: 4, Bowling: 4, Fielding: 4, Nerve: 3 }, stars: "A pair of do-everything all-rounders", prob: "Winning a match by yourself", conds: "Long seasons", quip: "All-rounders everywhere. Six bowling options and a batting card that never ends." }
  };
  var FO_J_NATQUIP = {
    "Australia": "Australia. Sledging counts as small talk out there.", "India": "India. A billion coaches in the stands, boss.",
    "Pakistan": "Pakistan. Wrists like conjurers, the lot of them.", "Sri Lanka": "Sri Lanka. They invent shots the coaching manuals ban.",
    "New Zealand": "New Zealand. Nicest people ever to knock you out of a cup.", "South Africa": "South Africa. They breed fast bowlers like weather.",
    "England": "England. Proper tea at the interval, then.", "Netherlands": "The Dutch. Give them one sniff and they take the whole hand.",
    "West Indies": "West Indies. Rhythm in everything, including the bouncer.", "Afghanistan": "Afghanistan. Fearless. Every single one of them.",
    "Ireland": "Ireland. Rain stops play there; the heart never did.", "Zimbabwe": "Zimbabwe. Tougher cricket people do not exist."
  };
  function foJArch(id) { return foArchById(id); }
  // Build the club was one of three chapters; the rival and the friendly are
  // gone, and a progress bar with a single step on it is just furniture.
  function foJChapBar() { return ""; }
  function foJMount(ch, body) {
    var host = document.getElementById("fo-onb");
    if (!host) { host = document.createElement("div"); host.id = "fo-onb"; document.body.appendChild(host); }
    host.innerHTML = "<div class='fo-ob-shell'><div class='fo-ob-inner'>" + foJChapBar(ch) + body + "</div></div>";
    host.style.display = "block";
    try { openWrap(false); } catch (e) {}
    try { host.scrollTop = 0; window.scrollTo(0, 0); } catch (e2) {}
    return host;
  }
  function foJHl(t) { return t.replace(/Reggie Thorne/g, "<b style='color:#C9571F'>Reggie Thorne</b>"); }
  // Pokemon-style typewriter dialogue. Click: finish the line, then advance.
  function foJDbox(ch, lines, next, topHtml, mood) {
    var body = "<div class='fo-j-dwrap'>" + (topHtml || "") +
      "<div class='fo-j-badge'><img class='gf' src='" + FO_ART + "gaffer" + (mood ? "-" + mood : "") + ".png' alt=''><b>The Gaffer</b></div>" +
      "<button type='button' class='fo-j-dbox' id='fo-j-db'><span class='sp'>The Gaffer</span><span class='tx' id='fo-j-dtx'></span></button></div>";
    var host = foJMount(ch, body);
    var i = 0, n = 0, done = false, iv = null;
    var tx = host.querySelector("#fo-j-dtx");
    var type = function () {
      clearInterval(iv); n = 0; done = false;
      iv = setInterval(function () {
        n++;
        if (n >= lines[i].length) { clearInterval(iv); done = true; tx.innerHTML = foJHl(lines[i]) + " <i class='fo-j-tri'>&#9662;</i>"; }
        else tx.textContent = lines[i].slice(0, n);
      }, 14);
    };
    host.querySelector("#fo-j-db").addEventListener("click", function () {
      if (!done) { clearInterval(iv); done = true; tx.innerHTML = foJHl(lines[i]) + " <i class='fo-j-tri'>&#9662;</i>"; return; }
      if (i < lines.length - 1) { i++; type(); } else next();
    });
    type();
  }
  function foJGbox(t, mood) { return "<div class='fo-j-gbox'><img class='gf' src='" + FO_ART + "gaffer" + (mood ? "-" + mood : "") + ".png' alt=''><span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;" + t + "&rdquo;</span></span></div>"; }
  function foJCrest(accent, sz, initials) {
    return "<svg viewBox='0 0 120 120' width='" + sz + "' height='" + sz + "'><path d='M60 6 L108 20 L108 64 C108 92 86 108 60 116 C34 108 12 92 12 64 L12 20 Z' fill='" + accent + "' stroke='#8F6A1C' stroke-width='3.5'/><path d='M60 13 L101 25 L101 63 C101 86 83 100 60 108 C37 100 19 86 19 63 L19 25 Z' fill='none' stroke='#FFF6DE' stroke-width='1.6' opacity='.55'/><text x='60' y='72' text-anchor='middle' font-size='34' font-weight='800' fill='#FDF7E3' font-family='inherit'>" + E(initials || "") + "</text></svg>";
  }
  function foJInitials(nm) { return String(nm || "CC").split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 2).toUpperCase(); }

  // ---- Chapter 1 -------------------------------------------------------------
  function foJIntro() {
    FO_ONB.j = FO_ONB.j || {};
    foJDbox(0, [
      "Ah. So you're the new manager they sent me."
    ], foJCreate);
  }
  function foJCreate() {
    var mgr0 = FO_ONB.mgr || (window.foMgrName && window.foMgrName()) || (SYNC && SYNC.me && SYNC.me.display_name) || "Manager";
    var ctyLocked = false;   // choosable until commit - create_league_team upserts name+country
    var body = "<div class='fo-j-dwrap'>" +
      "<h1 class='fo-ob-h1' style='text-align:center'>Create your club</h1>" +
      "<div class='fo-j-cert'><div class='fo-j-stamp'>LEAGUE<br>OFFICE<br>2026</div>" +
      "<div id='fo-j-pcr'>" + foJCrest("#0C1B2E", 92, foJInitials(FO_ONB.clubName || "Harbor City CC")) + "</div>" +
      "<div class='fo-j-marq' id='fo-j-pnm'>" + E(FO_ONB.clubName || "Harbor City CC") + "</div>" +
      "<div class='small' style='margin-top:4px'>Managed by <b id='fo-j-pmg'>" + E(mgr0) + "</b> <span id='fo-j-pfl'>" + (foQsFlag(FO_ONB.country) || "") + "</span> &middot; Established 2026</div>" +
      "<div style='text-align:left;margin-top:16px'>" +
      "<label class='fo-ob-lbl'>Club name</label><input id='fo-j-cn' class='fo-ob-input' maxlength='28' value='" + E(FO_ONB.clubName || "") + "' placeholder='Harbor City CC'>" +
      "<label class='fo-ob-lbl'>Your name</label><input id='fo-j-mn' class='fo-ob-input' maxlength='24' value='" + E(mgr0) + "'>" +
      "<label class='fo-ob-lbl'>Home nation" + (ctyLocked ? " <span class='fo-ob-hint'>: set when you joined</span>" : "") + "</label>" +
      "<div class='fo-ctygrid'>" + NAT.map(function (c) {
        var on = FO_ONB.country === c;
        if (ctyLocked && !on) return "";
        return "<button type='button' class='fo-cty" + (on ? " on" : "") + "'" + (ctyLocked ? " disabled" : "") + " data-cty='" + E(c) + "'><i>" + (foQsFlag(c) || "") + "</i><span>" + E(c) + "</span></button>";
      }).join("") + "</div></div></div>" +
      foJGbox("<span id='fo-j-crq'>Take your time, boss. This one goes above the door.</span>") +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-cta' id='fo-j-go'>Put it on the honours board</button></div></div>";
    var host = foJMount(0, body);
    var cn = host.querySelector("#fo-j-cn"), mn = host.querySelector("#fo-j-mn");
    cn.addEventListener("input", function () {
      var v = cn.value || "Harbor City CC";
      host.querySelector("#fo-j-pnm").textContent = v;
      host.querySelector("#fo-j-pcr").innerHTML = foJCrest("#0C1B2E", 92, foJInitials(v));
      if (cn.value.length > 2) host.querySelector("#fo-j-crq").innerHTML = E(cn.value) + ". Say it out loud. Good. Does it scare anyone yet?";
    });
    mn.addEventListener("input", function () { host.querySelector("#fo-j-pmg").textContent = mn.value || "Manager"; });
    host.querySelectorAll(".fo-cty").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.country = b.getAttribute("data-cty");
        host.querySelectorAll(".fo-cty").forEach(function (x) { x.classList.toggle("on", x === b); });
        host.querySelector("#fo-j-pfl").innerHTML = foQsFlag(FO_ONB.country) || "";
        host.querySelector("#fo-j-crq").innerHTML = E(FO_J_NATQUIP[FO_ONB.country] || FO_ONB.country + ". Fine cricket country.");
      });
    });
    host.querySelector("#fo-j-go").addEventListener("click", function () {
      var nm = (cn.value || "").trim();
      if (nm.length < 3) { say("Give the club a real name - three letters or more."); return; }
      FO_ONB.clubName = nm; FO_ONB.mgr = (mn.value || "").trim() || mgr0;
      // the name he types here is his name in the world: the table, his club
      // page and every fixture list call him this, not "Orange Club manager"
      try { if (FO_ONB.mgr && FO_ONB.mgr !== "Manager") localStorage.setItem("fo_mgr", FO_ONB.mgr); } catch (eMg) {}
      FO_ONB.ground = nm + " Oval";
      if (!FO_ONB.country) FO_ONB.country = NAT[0];
      try { App.founder.name = nm; App.founder.mgr = FO_ONB.mgr; } catch (e) {}
      // League clubs live on the server: the row (name + country) must be
      // saved BEFORE anything downstream - the squad seed comes back with it.
      // create_league_team upserts, so a rename or a country change re-saves.
      if (!LG || (FO_ONB.team && !FO_ONB.needsSetup && nm === FO_ONB.team.name && (FO_ONB.country || "") === (FO_ONB.team.country || ""))) { foJFounded(); return; }
      var btn = host.querySelector("#fo-j-go"); btn.disabled = true; btn.textContent = "Saving…";
      rpc("create_league_team", { p_league_id: LG.id, p_team_name: nm, p_manager_name: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager", p_country: FO_ONB.country })
        .then(function (team) {
          SYNC.myTeam = team; FO_ONB.team = team; FO_ONB.needsSetup = false;
          FO_ONB.country = team.country || FO_ONB.country;
          FO_ONB.genSeed = null;   // pick up the server-issued draft seed
          App.founder.pool = buildCountryPool(team.draft_seed || nm, team.country || FO_ONB.country);
          if (App.founder.__league) App.founder.__league.team_id = team.id;
          foJFounded();
        })
        .catch(function (e) { btn.disabled = false; btn.textContent = "Put it on the honours board"; say(e); });
    });
  }
  function foJFounded() {
    var body = "<div class='fo-j-dwrap' style='text-align:center'>" +
      "<div class='fo-ob-eyebrow'>The ink dries</div><h1 class='fo-ob-h1'>Club founded</h1>" +
      "<div style='margin:6px auto'>" + foJCrest("#0C1B2E", 140, foJInitials(FO_ONB.clubName)) + "</div>" +
      "<div class='fo-j-rule'><i></i><b>EST. 2026</b><i></i></div>" +
      "<div class='fo-j-marq'>" + E(FO_ONB.clubName) + "</div>" +
      "<div class='fo-j-rule'><i></i><b>&#10022;</b><i></i></div>" +
      "<p class='fo-ob-lead' style='text-align:center'>Founded 2026 &middot; Managed by " + E(FO_ONB.mgr || "you") + " " + (foQsFlag(FO_ONB.country) || "") + " &middot; Home ground: " + E(FO_ONB.ground) + "</p>" +
      "<p class='fo-ob-lead' style='text-align:center'>The name is on the door. The board has already signed a squad to put behind it.</p>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-cta' id='fo-j-go'>Meet the squad</button></div></div>";
    foJMount(0, body).querySelector("#fo-j-go").addEventListener("click", function () {
      foJDbox(0, [
        E(FO_ONB.clubName) + ". Good name. Looks right over a doorway."
      ], foJAutoSoul);
    });
  }
  // The club's identity used to be a six-card choice of its own; onboarding is
  // shorter without it, so the board picks. The all-rounder side is the one to
  // hand a manager who has never seen this engine: six bowling options and a
  // batting card that runs deep, so no single bad day loses the match for him.
  var FO_J_AUTO_SOUL = "engine";
  function foJAutoSoul() {
    FO_ONB.arch = FO_J_AUTO_SOUL;
    FO_ONB.pitch = FO_J_PREV[FO_ONB.arch].pitch;
    foJReveal();
  }
  // The unboxing: the squad your DNA choice just unlocked, dealt like a pack
  // of trading cards - batsmen first, then the gloves, the all-rounders, and
  // the bowlers last. Pure theatre; the same deterministic squad you'll sign.
  var FO_JRV_GROUPS = [
    { k: "bat", lbl: "The Batsmen" }, { k: "wk", lbl: "The Gloves" },
    { k: "ar", lbl: "The All-Rounders" }, { k: "bowl", lbl: "The Bowlers" }
  ];
  function foJrvGroup(p) {
    if (p.keeper || p.role === "wicketkeeper") return "wk";
    if (p.role === "allRounder") return "ar";
    // group by PRIMARY role: a part-time trundler still walks out with the bats
    if (/opener|Bat$|Bat\b/i.test(p.role || "") || /batsman/i.test(p.role || "")) return "bat";
    if (p.bowlType || /seam|spin|pace/i.test(p.role || "")) return "bowl";
    return "bat";
  }
  function foJReveal() {
    var gen;
    // the same deal the commit gate makes, so the squad a manager watches
    // reveal is the squad he is signed to - no captain flavour, no shape
    try { gen = foGenArchetypeSquad(foObSeed(), FO_ONB.country, FO_ONB.arch, null); }
    catch (e) { foJCommitGate(); return; }
    var ordIx = { bat: 0, wk: 1, ar: 2, bowl: 3 };
    var ps = gen.players.slice().sort(function (a, b2) {
      var d = ordIx[foJrvGroup(a)] - ordIx[foJrvGroup(b2)];
      return d !== 0 ? d : (foPkOvr(b2) - foPkOvr(a));
    });
    var A = foJArch(FO_ONB.arch);
    // Every man out of the pack is the compact browse card - the same one the
    // squad, market and scout grids use - tiled. A column of full hero cards
    // read as fifteen separate screens; this reads as a squad.
    var cells = ps.map(function (p, i) {
      return "<div class='fo-jrv-cell' data-i='" + i + "' data-g='" + foJrvGroup(p) + "'>" +
        foPkMini(p) + "</div>";
    }).join("");
    var body = "<div class='fo-jrv-wrap'>" +
      "<div class='fo-jrv'>" +
      "<div class='fo-jrv-spot'></div>" +
      "<div class='fo-jrv-eyebrow'>Your club is founded</div>" +
      "<h1 class='fo-ob-h1 fo-jrv-h1' style='text-align:center'>" + E(A.nm) + "</h1>" +
      "<button type='button' class='fo-jrv-pack' id='fo-jrv-pack'>" +
      "<span class='fo-jrv-burst'></span>" +
      "<img class='fo-j-crimg' src='" + FO_ART + "crests/" + FO_ONB.arch + ".png' alt=''>" +
      "<span class='pk1'>" + E(A.nm) + "</span><span class='pk2'>Founding squad</span></button>" +
      "<div class='fo-jrv-lab' id='fo-jrv-lab'></div>" +
      "<div class='fo-jrv-grid' id='fo-jrv-grid'>" + cells + "</div>" +
      "<div class='fo-jrv-skip'><a id='fo-jrv-skip' hidden>Deal them all &#9654;</a></div>" +
      "<div class='fo-jrv-foot' id='fo-jrv-foot' hidden>" +
      foJGbox("Every name on that sheet is yours now. In a year they'll either be a team or a story. Sign them, boss.") +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-cta' id='fo-jrv-go'>Sign them &#9654;</button></div></div>" +
      "</div></div>";
    var host = foJMount(0, body);
    var pack = host.querySelector("#fo-jrv-pack");
    var lab = host.querySelector("#fo-jrv-lab"), foot = host.querySelector("#fo-jrv-foot");
    var skip = host.querySelector("#fo-jrv-skip");
    var timers = [], dealt = 0;
    var reduce = false;
    try { reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e2) {}
    // the camera follows each card as it's dealt - until the manager scrolls
    var follow = true, stopFollow = function () { follow = false; };
    window.addEventListener("wheel", stopFollow, { passive: true, once: true });
    window.addEventListener("touchmove", stopFollow, { passive: true, once: true });
    var finish = function () {
      timers.forEach(clearTimeout); timers = [];
      host.querySelectorAll(".fo-jrv-cell").forEach(function (c) { c.classList.add("in", "insta"); });
      lab.textContent = "Your founding squad";
      lab.classList.remove("pop"); void lab.offsetWidth; lab.classList.add("pop");
      skip.hidden = true; foot.hidden = false;
      try { foot.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" }); } catch (e3) {}
    };
    host.querySelector("#fo-jrv-go").addEventListener("click", foJCommitGate);
    skip.addEventListener("click", finish);
    pack.addEventListener("click", function () {
      if (pack.__opened) return; pack.__opened = 1;
      pack.classList.add("open");
      skip.hidden = false;
      var cellsEls = [].slice.call(host.querySelectorAll(".fo-jrv-cell"));
      var packR = pack.getBoundingClientRect();
      var px = packR.left + packR.width / 2, py = packR.top + packR.height / 2;
      // strict one-by-one: each full card lands, the camera follows it, the
      // next launches - an extra beat when the role wave changes so the
      // banner registers
      var STEP = 300, GAP = 260, t = 300, lastG = null;
      cellsEls.forEach(function (c, i) {
        var g = c.getAttribute("data-g");
        if (g !== lastG) { if (lastG != null) t += GAP; lastG = g; (function (g2, tt) {
          timers.push(setTimeout(function () {
            var gr = FO_JRV_GROUPS.filter(function (x) { return x.k === g2; })[0];
            lab.textContent = gr ? gr.lbl : "";
            lab.classList.remove("pop"); void lab.offsetWidth; lab.classList.add("pop");
          }, tt));
        })(g, t); }
        (function (c2, tt, idx) {
          timers.push(setTimeout(function () {
            var r = c2.getBoundingClientRect();
            var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
            c2.style.setProperty("--dx", dx.toFixed(0) + "px");
            c2.style.setProperty("--dy", dy.toFixed(0) + "px");
            c2.style.setProperty("--rot", ((foHash32(FO_ONB.arch + idx) % 40) - 20) + "deg");
            c2.classList.add("in");
            if (follow) try { c2.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e4) {}
            dealt++;
            if (dealt >= cellsEls.length) timers.push(setTimeout(finish, 500));
          }, tt));
        })(c, t, i);
        t += STEP;
      });
      if (reduce) finish();
    });
    // the sealed pack used to wait on a tap of its own; it deals itself now
    setTimeout(function () { try { pack.click(); } catch (ePk) {} }, 300);
  }
  // ==== The trading-card player card ==========================================
  // One component for every surface that shows a player as a card. Role picks
  // the color and the artwork; all numbers come off the live player object.
  var FO_PK_AC = { bat: ["#C9A227", "#a9861a"], pace: ["#2F6FBF", "#245a9e"], wspin: ["#7A4FBF", "#6a3fae"], fspin: ["#B34A7D", "#983c68"], ar: ["#6B8E23", "#5a7a1c"], wk: ["#0E9E97", "#0b837d"] };
  // The engine doesn't distinguish opener/top/middle batting slots - they play
  // identically - so every specialist batter is just "Batsman" on the card.
  var FO_PK_ROLELBL = { opener: "Batsman", topOrderBat: "Batsman", middleOrderBat: "Batsman", allRounder: "All-Rounder", wicketkeeper: "Wicketkeeper", seamFast: "Fast Bowler", seamFastMedium: "Fast-Medium Bowler", seamMedium: "Medium Pacer", wristSpin: "Wrist Spinner", fingerSpin: "Finger Spinner" };
  function foPkRoleLbl(p) { return FO_PK_ROLELBL[p.role] || "Player"; }
  function foPkKind(p) {
    if (p.keeper || p.role === "wicketkeeper") return "wk";
    if (p.role === "allRounder") return "ar";
    if (p.role === "wristSpin") return "wspin";
    if (p.role === "fingerSpin") return "fspin";
    if (/^seam/.test(p.role || "")) return "pace";
    return "bat";
  }
  // Card art v3: full-bleed painted figures picked by ROLE x NATIONALITY
  // (client/art/players/<role>_<nat>.webp). All TWELVE nations are painted
  // natively now; 80+ players wear the legendary figures, and a share of
  // everyone else wears a variant figure for squad variety.
  var FO_PK_NAT = { England: "eng", Australia: "aus", India: "ind", "New Zealand": "nzl", "South Africa": "rsa", "West Indies": "win",
    Pakistan: "pak", "Sri Lanka": "slk", Afghanistan: "afg", Netherlands: "ned", Ireland: "ire", Zimbabwe: "zim" };
  // the six expansion nations ship a dedicated spin all-rounder figure
  var FO_PK_ARSPIN = { ire: 1, ned: 1, pak: 1, slk: 1, afg: 1, zim: 1 };
  function foPkArt(p) {
    var k = foPkKind(p);
    var r = k === "wk" ? "wk" : k === "ar" ? "ar"
      : k === "wspin" ? "ws" : k === "fspin" ? "fs"
      : k === "pace" ? (p.role === "seamFast" ? "f" : (p.role === "seamFastMedium" ? "fm" : "mp"))
      : "bat";
    // all-rounders split by their bowling for the variant/legend figures
    var rv = r === "ar" ? (/spin/i.test(p.bowlTypeFull || p.bowlType || "") ? "arspin" : "ar") : r;
    // v3: an 80+ player IS a legend, and walks in the midnight-and-gold
    // legendary figure on every surface - matching his gold card frame
    try { if (foPkOvr(p) >= 80) return "players/leg_" + rv + ".webp"; } catch (eLg) {}
    // the same player always gets the same nation figure: his own nation's,
    // or a stable stand-in for any nationality outside the twelve
    var n = FO_PK_NAT[p.nat] || ["eng", "aus", "ind", "nzl", "rsa", "win", "ire", "ned", "pak", "slk", "afg", "zim"][foHash32("pknat|" + (p.name || "")) % 12];
    // squad variety: ~30% of players wear a variant figure instead of the
    // nation one - deterministic per player, complexion matched to region
    var hV = foHash32("pkvar|" + (p.name || "")) % 10;
    if (hV < 3) {
      var euro = (n === "eng" || n === "aus" || n === "nzl" || n === "ire" || n === "ned") || (n === "rsa" && hV === 0);
      return "players/" + (euro ? "vc_" : "vb_") + rv + ".webp";
    }
    return "players/" + (rv === "arspin" && !FO_PK_ARSPIN[n] ? "ar" : rv === "arspin" ? "arspin" : r) + "_" + n + ".webp";
  }
  // the one canonical card-art resolver: exported so other modules (player
  // hero, living-season awards) reuse it instead of cloning its hashing
  try { window.foPkArt = foPkArt; } catch (ePkX) {}
  // the card's overall rating is mirrored in SQL for the served club
  // pages (migration 016); export it so the tests can hold the two to
  // the same answer rather than trusting they stayed in step
  try { window.foPkOvr = foPkOvr; } catch (ePkO) {}
  var FO_PK_TIPS = {
    BATTING: "Run-scoring ability with the bat - how reliably he builds and converts innings.",
    BOWLING: "Wicket-taking threat and the ability to keep runs down with the ball.",
    TECHNIQUE: "Consistency and execution - how often he does exactly what he intends.",
    POWER: "Raw strength: boundary hitting with the bat, heavy-ball impact with it.",
    FIELDING: "Catching, ground fielding and agility in the ring or on the rope.",
    KEEPING: "Glovework behind the stumps - takes, stumpings and standing up to spin.",
    FORM: "Current form - hot players get a lift on everything, cold ones a dent. It moves match by match.",
    EXPERIENCE: "Experience - matches under the belt. Seasoned players handle pressure and tough conditions better.",
    CAPTAINCY: "Leadership and tactical nous. A strong captain lifts the whole XI on the field.",
    STAMINA: "Energy and durability - how well he holds up over long spells and packed schedules."
  };
  function foPkIco(k) {
    var I = {
      bat: "<path d=\'M5 19 17 7m-3-2 5 5\'/>",
      bowl: "<circle cx=\'12\' cy=\'12\' r=\'8\'/><path d=\'M8.5 6.5c2.5 3 3.5 8 3 11M15.5 6.5c-1 3.5-1 8 0 11\' stroke-width=\'1.4\'/>",
      tech: "<circle cx=\'12\' cy=\'12\' r=\'3.2\'/><circle cx=\'12\' cy=\'12\' r=\'8\'/><path d=\'M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4\'/>",
      pow: "<path d=\'M13 2 6 13h5l-1.5 9L18 10h-5l1.5-8z\'/>",
      fld: "<path d=\'M7 21V11a5 5 0 0 1 10 0v10zM7 15H5a2 2 0 0 1 0-4h2m10 4h2a2 2 0 0 0 0-4h-2\'/>",
      form: "<path d=\'M3 17l5-6 4 3 5-8 4 5\'/>",
      exp: "<circle cx=\'12\' cy=\'8\' r=\'4\'/><path d=\'M4 21c1-4 4-6 8-6s7 2 8 6\'/>",
      capt: "<path d=\'M12 3 4 7v5c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V7z\'/><path d=\'M12 8v5M9.5 10.5h5\'/>",
      fee: "<rect x=\'5\' y=\'4\' width=\'14\' height=\'17\' rx=\'2\'/><path d=\'M9 4V2.5h6V4M9 9h6M9 13h6M9 17h4\'/>",
      wage: "<ellipse cx=\'12\' cy=\'6\' rx=\'7\' ry=\'3\'/><path d=\'M5 6v4c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 10v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4M5 14v4c0 1.7 3.1 3 7 3s7-1.3 7-3v-4\'/>",
      sta: "<path d=\'M12 21C7 16.5 3 13.3 3 9.5 3 7 5 5 7.5 5c1.7 0 3.3.9 4.5 2.4C13.2 5.9 14.8 5 16.5 5 19 5 21 7 21 9.5c0 3.8-4 7-9 11.5z\'/><path d=\'M6 12h3l1.5-3 2.5 5 1.5-2h3.5\'/>"
    };
    return "<svg viewBox=\'0 0 24 24\'>" + I[k] + "</svg>";
  }
  function foPkStatRow(lbl, icoK, v) {
    v = Math.round(v || 0);
    return "<div class=\'pk-st\' data-tip=\"" + E(FO_PK_TIPS[lbl] || "") + "\"><span class=\'pk-en\'>" + foPkIco(icoK) + "</span><b>" + lbl + "</b><span class=\'pk-bar\'><i style=\'width:" + Math.max(2, Math.min(100, v)) + "%\'></i></span><em>" + v + "</em></div>";
  }
  // A FIFA-style 0-100 overall from the same 0-100 aggregates the card shows -
  // p.rating is the engine's internal ranking value (x420 scaled), not an OVR.
  function foPkOvr(p) {
    // a man known only from his public card carries the world's own overall,
    // and that figure beats anything re-derived from a flattened skills block
    if (p && p.__card && p.__ovr > 0) return p.__ovr | 0;
    var bat = aggBat(p) || 0, tech = aggTech(p) || 0, pow = (p.power != null ? p.power : ((p.skills && p.skills.power) || 0));
    var batScore = 0.58 * bat + 0.24 * tech + 0.18 * pow;
    var bowl = p.bowlType ? (aggBowl(p) || 0) : 0;
    var fld = aggField(p) || 0;
    var ovr;
    // each branch is normalised onto the batter's scale (measured over the
    // generator's whole quality range), so a 70 bowler and a 70 batter are
    // genuinely the same class of player
    if (p.keeper || p.role === "wicketkeeper") ovr = 1.07 * (0.46 * (aggKeep(p) || 0) + 0.40 * batScore + 0.14 * fld) - 1;
    // THE ALL-ROUNDER WAS READING 65% OF WHAT HE IS. A man who bats and bowls
    // splits his skills across two trades, so neither aggregate is a
    // specialist's - and this branch then blended the two and scaled the
    // result by only 1.04, where the bowler's branch stretches by 1.5 and
    // shifts by -14. He was penalised twice: once in the skills, once in the
    // arithmetic. Measured over 1,440 cricketers, all-rounders carried the
    // HIGHEST mean rating in the world (36,014) and the LOWEST cards (42.8),
    // while seamers and spinners sat at 105% of a specialist batter and
    // keepers at 93%. The scale and shift below are fitted so an all-rounder
    // lands on the same card-against-rating line as everybody else, in spread
    // as well as in mean.
    else if (p.role === "allRounder") { var hi = Math.max(batScore, bowl), lo = Math.min(batScore, bowl); ovr = 1.269 * (0.60 * hi + 0.28 * lo + 0.12 * fld) + 9.57; }
    else if (bowl > batScore) ovr = 1.5 * (0.74 * bowl + 0.12 * tech + 0.14 * fld) - 14;
    else ovr = 0.60 * batScore + 0.12 * bat + 0.14 * pow + 0.14 * fld;
    // THE CARD IS A LABEL, NOT THE ENGINE'S NUMBER, and it should use the
    // range it is drawn on. The cricket has to live between about 18,000 and
    // 47,000 because that is the band where the engine still answers a rating
    // gap - past it, run-scoring saturates near 290 and extra rating buys
    // nothing. Left alone that band prints as 16 to 74, so the top quarter of
    // the scale went unused and an international read like a good club player.
    // Stretched, the same cricket reads 23 to 99 across the whole world: a
    // full member's national XI averages 77 with a 99 among them, its flagship
    // 67, a bottom second-division associate 28 - and nothing about what
    // happens on the field has changed. A public card already carries a
    // stretched figure and returns above, so this is applied exactly once.
    return Math.max(1, Math.min(99, Math.round(FO_CARD_A * ovr + FO_CARD_B)));
  }
  var FO_CARD_A = 1.32, FO_CARD_B = -1;
  // test-harness hook: lets the Playwright probes generate players and read
  // OVRs without reaching into the closure (never used by the game itself)
  try { window.__foTest = { gen: foQsPlayer, ovr: foPkOvr, hash: foHash32 }; } catch (eT) {}
  function foPkCard(p, opts) {
    opts = opts || {};
    var k = foPkKind(p), ac = FO_PK_AC[k];
    var roleLbl = opts.roleLbl || p.__mqLbl || FO_PK_ROLELBL[p.role] || "Player";
    var ovr = foPkOvr(p);
    var hand = (p.hand === "L") ? "LHB" : "RHB";
    var tals = (p.talents || []).map(function (t) {
      var tip = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || "Special ability that triggers in matches.";
      return "<span class=\'pk-tal\' data-tip=\"" + E(tip) + "\">" + E((typeof TALN !== "undefined" && TALN[t]) || t) + "</span>";
    }).join("");
    var rows = foPkStatRow("BATTING", "bat", aggBat(p)) + foPkStatRow("BOWLING", "bowl", p.bowlType ? aggBowl(p) : 8) +
      foPkStatRow("TECHNIQUE", "tech", aggTech(p)) + foPkStatRow("POWER", "pow", p.power != null ? p.power : ((p.skills && p.skills.power) || 0)) +
      (k === "wk" ? foPkStatRow("KEEPING", "fld", aggKeep(p)) : foPkStatRow("FIELDING", "fld", aggField(p)));
    var metaRole = (p.btLabel && !/does not bowl/i.test(p.btLabel)) ? p.btLabel : roleLbl;
    var meta = "<span>" + E(metaRole) + "</span><i>&bull;</i><span>Age " + (p.age | 0) + "</span><i>&bull;</i><span>" + E(p.nat || "") + "</span><span class=\'fl\'>" + (foQsFlag(p.nat) || "") + "</span>";
    var formW = (typeof FORMW !== "undefined" && FORMW[p.formIx != null ? p.formIx : 3]) || "steady";
    var mid = "<div class=\'pk-mid\'>" +
      "<div class=\'pk-fc\' data-tip=\"" + E(FO_PK_TIPS.FORM) + "\">" + foPkIco("form") + "<span><i>FORM</i><b>" + E(formW) + "</b></span></div>" +
      "<div class=\'pk-fc\' data-tip=\"" + E(FO_PK_TIPS.EXPERIENCE) + "\">" + foPkIco("exp") + "<span><i>EXPERIENCE</i><b>" + E(p.expWord || "-") + "</b></span></div>" +
      "<div class=\'pk-fc\' data-tip=\"" + E(FO_PK_TIPS.CAPTAINCY) + "\">" + foPkIco("capt") + "<span><i>CAPTAINCY</i><b>" + (p.capt | 0) + "</b></span></div></div>";
    var foot = "";
    if (opts.fee != null) {
      foot = "<div class=\'pk-foot\'>" +
        "<div class=\'pk-fc\'>" + foPkIco("fee") + "<span><i>FEE</i><b>" + FO$(opts.fee) + "</b></span></div>" +
        "<div class=\'pk-fc\'>" + foPkIco("wage") + "<span><i>WAGE</i><b>" + FO$(opts.wage || 0) + "/day</b></span></div>" +
        "<div class=\'pk-fc\' data-tip=\"" + E(FO_PK_TIPS.STAMINA) + "\">" + foPkIco("sta") + "<span><i>STAMINA</i><b>" + Math.round((p.skills && p.skills.stamina) || 0) + "</b></span></div></div>";
    }
    var risk = opts.risk ? "<div class=\'pk-risk\'>Risk: " + E(opts.risk) + "</div>" : "";
    var cta = opts.cta ? "<button type=\'button\' class=\'pk-cta\'" + (opts.ctaAttr || "") + ">" + E(opts.cta) + "</button>" : "";
    return "<div class=\'pk\' style=\'--tc:" + ac[0] + ";--tcD:" + ac[1] + "\'><div class=\'pk-frame\'><span class=\'pk-notch\'></span><div class=\'pk-in\'>" +
      "<div class=\'pk-hd\'><div class=\'pk-idc\'><div class=\'pk-role-lbl\'>" + E(roleLbl) + "</div><div class=\'pk-name\'>" + E(p.name) + "</div><span class=\'pk-flag\'>" + (foQsFlag(p.nat) || "") + "</span></div>" +
      "<div class=\'pk-ovc\'><div class=\'pk-ovr\'><i>OVR</i><b>" + ovr + "</b></div>" +
      "<div class=\'pk-hand\' data-tip=\"" + (hand === "LHB" ? "Bats left-handed" : "Bats right-handed") + "\">" + hand + "</div></div></div>" +
      "<div class=\'pk-art\'><div class=\'gnd\'></div><img src=\'" + FO_ART + foPkArt(p) + "\' alt=\'\'></div>" +
      "<div class=\'pk-meta\'>" + meta + "</div>" +
      (tals ? "<div class=\'pk-tal-h\'><i></i>TALENTS<i></i></div><div class=\'pk-tals\'>" + tals + "</div>" : "") +
      "<div class=\'pk-stats\'>" + rows + "</div>" + mid + foot + risk + cta +
      "</div></div></div>";
  }
  // Compact card for BROWSING surfaces (squad, market, scout) where a full
  // hero card per player would be an endless scroll. Same visual language -
  // role-color frame, art thumbnail, OVR, RHB/LHB, three mini bars - tiled a
  // few per row. opts: {fee, sub, action(html), tag, tone, dim}.
  function foPkMini(p, opts) {
    opts = opts || {};
    var k = foPkKind(p), ac = FO_PK_AC[k];
    var roleLbl = opts.roleLbl || FO_PK_ROLELBL[p.role] || "Player";
    var ovr = foPkOvr(p);
    var hand = (p.hand === "L") ? "LHB" : "RHB";
    var bowlV = p.bowlType ? (aggBowl(p) || 0) : 0;
    var secLbl = (k === "wk") ? "KEEP" : "BOWL", secV = (k === "wk") ? (aggKeep(p) || 0) : bowlV;
    var bar = function (lbl, tip, v) {
      v = Math.round(v || 0);
      return "<span class=\'pkm-b\' data-tip=\"" + E(FO_PK_TIPS[tip] || "") + "\"><i>" + lbl + "</i><u><b style=\'width:" + Math.max(3, Math.min(100, v)) + "%\'></b></u><em>" + v + "</em></span>";
    };
    var bars = bar("BAT", "BATTING", aggBat(p)) + bar(secLbl, k === "wk" ? "KEEPING" : "BOWLING", secV) + bar("FLD", "FIELDING", aggField(p));
    var tag = opts.tag ? "<span class=\'pkm-tag\'>" + opts.tag + "</span>" : "";
    var sub = opts.sub || (E(roleLbl) + " &middot; age " + (p.age | 0));
    var money = "";
    if (opts.fee != null) money = "<span class=\'pkm-fee\'>Fee <b>" + FO$(opts.fee) + "</b>" + (opts.wage != null ? " &middot; " + FO$(opts.wage) + "/day" : "") + "</span>";
    var act = opts.action || "";
    var foot = opts.foot != null ? opts.foot : (money || act ? money + act : "");
    return "<div class=\'pkm" + (opts.dim ? " pkm-dim" : "") + "\' style=\'--tc:" + ac[0] + ";--tcD:" + ac[1] + "\'>" +
      "<div class=\'pkm-top\'>" +
      "<div class=\'pkm-art\'><img src=\'" + FO_ART + foPkArt(p) + "\' alt=\'\'></div>" +
      "<div class=\'pkm-id\'>" + tag +
      "<div class=\'pkm-nm\'>" + (foQsFlag(p.nat) || "") + " " + E(p.name) + "</div>" +
      "<div class=\'pkm-sub\'>" + sub + "</div></div>" +
      "<div class=\'pkm-ovc\'><b>" + ovr + "</b><i>OVR</i><span class=\'pkm-hand\'>" + hand + "</span></div>" +
      "</div>" +
      "<div class=\'pkm-bars\'>" + bars + "</div>" +
      (foot ? "<div class=\'pkm-foot\'>" + foot + "</div>" : "") +
      "</div>";
  }
  // The last step: sign the squad the manager has just watched deal out, and
  // open the club. The reserve decision that used to sit here is gone, so the
  // squad is always the standard one the founding grant comfortably covers -
  // there is no lever left to pull, and so nothing left to warn about.
  function foJCommitGate() {
    try {
      FO_ONB.sponsor = "community";
      FO_ONB.arch = FO_ONB.arch || foObDealtArch(foObSeed());
      FO_ONB.gen = foGenArchetypeSquad(foObSeed(), FO_ONB.country, FO_ONB.arch, null);
      App.founder.picked = FO_ONB.gen.players.slice();
      foOnbCommit();
      // commit success is recorded by the done-flag; on failure stay put so
      // nothing downstream runs against a half-built club
      var ok = false; try { ok = !!window.store("fo_onb_done"); } catch (eS) {}
      if (!ok) return;
      foOnbClose();
      location.hash = "#/club";
      if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }

  // ---- the Gaffer's first-tie walkthrough --------------------------------
  // The front door promises "give the club a name and I'll walk you through
  // the rest". This honors it: one short dialogue at the Circuit hub, one on
  // the first team sheet, a nudge as the first match starts. Light-touch,
  // fires once, and any played match retires it.
  function foCoachStage() { return lsGet("fo_coach") || ""; }
  function foCoachSet(s) { try { lsSet("fo_coach", s); } catch (e) {} }
  function foCoachTick() {
    try {
      var st = foCoachStage();
      if (st === "done") return;
      if (typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice) { foCoachSet("done"); return; }   // league players have teammates for this
      var fwD = document.getElementById("folWrap"); if (fwD && fwD.classList.contains("on")) return;              // front door still up (fixed-position: offsetParent lies)
      if (document.getElementById("fo-onb") && document.getElementById("fo-onb").style.display === "block") return; // a dialogue is already open
      var h = (location.hash || "").split("?")[0];
      if (!st) {
        // veterans need no walkthrough
        var played = false;
        try { played = (App.results || []).length > 0 || ((foCxState().hist || []).length > 0); } catch (e1) {}
        if (played) { foCoachSet("done"); return; }
        if (h === "#/circuit" && document.querySelector(".fo-cx")) {
          foCoachSet("hub");
          var me = userTeam();
          foJDbox(2, [
            "Welcome to " + ((me && me.name) || "the club") + ", boss. I'm the Gaffer - I promised a walkthrough, and I keep those.",
            "Your sixteen players live under Squad in the menu: every skill bar, talent and wage. The Manual explains anything I don't.",
            "This map is the Circuit. Beat a region's three doors and its trophy is ours, boss's academy and all. Tap CHALLENGE on the first door when you're ready - I'll help with the team sheet."
          ], function () { foOnbClose(); });
          try { var cb1 = document.querySelector("#fo-onb .fo-j-chap"); if (cb1) cb1.style.display = "none"; } catch (eC1) {}
        }
        return;
      }
      if (st === "hub" && h === "#/orders" && App.pending && App.pending.__circuit) {
        foCoachSet("orders");
        foJDbox(2, [
          "The team sheet, boss - and I've already filled it in. Eleven picked, batting order sorted, every over of bowling planned for these conditions.",
          "Stars rate every man out of ten - gold with the bat, navy with the ball - and OVR is the number behind them. Tap any player for his full card.",
          "It's all live, boss: drag any card to reshuffle the batting order or swap a bench man in, tap any over in the bowling grid to hand it to a bowler, and call the toss up top. Happy? PLAY WITH THIS PLAN and we walk out."
        ], function () { foOnbClose(); });
        try { var cb2 = document.querySelector("#fo-onb .fo-j-chap"); if (cb2) cb2.style.display = "none"; } catch (eC2) {}
        return;
      }
      if ((st === "orders" || st === "hub") && h === "#/match" && typeof M !== "undefined" && M && !M.done && M.meta && M.meta.__circuit) {
        foCoachSet("match");   // no gaffer toast - the broadcast speaks for itself
        return;
      }
      if (st === "match" && typeof M !== "undefined" && M && M.done) foCoachSet("done");
    } catch (e) {}
  }
  setInterval(foCoachTick, 1100);
  // ---- Returning managers: the Gaffer's morning briefing ---------------------
  function foJBrief() {
    try {
      if (SYNC && SYNC.practice) return;
      if (!window.store("fo_onb_done")) return;
      if (lsGet("fo_qs_new")) return;                       // first session: the golden card owns the screen
      if (sessionStorage.getItem("fo_j_brief")) return;
      var page = document.getElementById("page"); if (!page) return;
      if (document.getElementById("fo-j-brief")) return;
      var me = userTeam(); if (!me) return;
      // THE BANK THE GAFFER QUOTES IS THE UMPIRE'S OR IT IS NOT QUOTED.
      // This read App.fin.bank - the retired local sim's money, the same
      // figure the deleted ledger page showed - so the first thing a manager
      // heard each morning was a number his own Books disagreed with. The
      // served figure is cached by the world module on every load; if it has
      // not landed yet the clause is simply left out, because a balance we are
      // not sure of is worse than no balance at all.
      var bank = null;
      try { var sfB = window.__foWorldFinance && window.__foWorldFinance.get(); if (sfB) bank = sfB.bank; } catch (eB) {}
      var w = 0, l = 0;
      (App.results || []).forEach(function (r) { try { if (r && r.result && r.result.winner) { if (r.result.winner === me.name) w++; else l++; } } catch (e) {} });
      var lines = [
        "Morning, boss. Sleep well? The league table doesn't.",
        "Round " + ((App.season && App.season.round != null ? App.season.round : 0) + 1) + ", " +
          (w + l > 0 ? w + " won, " + l + " lost so far" : "the season's still young") +
          (bank == null ? "." : ", " + FO$(bank) + " in the bank."),
        "Next league match plays at 9:00 AM ET. The office is yours - I'll be by the kettle."
      ];
      var hook = "";
      try { var stH = foStState(); if (stH && stH.hook) hook = stH.hook; } catch (eH) {}
      var el = document.createElement("div"); el.id = "fo-j-brief";
      el.innerHTML = "<div class='fo-j-gbox' style='max-width:none;margin:0 0 10px;position:relative'><img class='gf' src='" + FO_ART + "gaffer.png' alt=''><span class='bx'><span class='sp'>The Gaffer</span>" +
        "<span class='tx'>" + lines.map(E).join(" ") + (hook ? " <b>" + E(hook) + "</b>" : "") + "</span>" +
        "</span>" +
        "<button type='button' id='fo-j-briefx' style='position:absolute;top:8px;right:10px;background:none;border:none;color:#8a90a0;cursor:pointer;font-size:14px' title='Dismiss'>&#10005;</button></div>";
      page.insertBefore(el, page.firstChild);
      el.querySelector("#fo-j-briefx").addEventListener("click", function () {
        try { sessionStorage.setItem("fo_j_brief", "1"); } catch (e2) {}
        el.remove();
      });
    } catch (e) {}
  }
  setTimeout(function () {
    try {
      var _pc = window.pgClub;
      if (typeof _pc === "function" && !_pc.__foJBrief) {
        window.pgClub = function () { var r = _pc.apply(this, arguments); try { foJBrief(); } catch (e) {} return r; };
        window.pgClub.__foJBrief = 1;
      }
    } catch (e) {}
  }, 0);
  window.__foJ = { intro: foJIntro, reveal: foJReveal, brief: foJBrief, state: function () { return FO_ONB; } };

  // Player links built from stored text can carry baggage the engine's exact
  // name lookup chokes on - "Jayant Dixit 4w" from a mom string, "(123 pts)"
  // from fantasy lines, a rename from foUniqueNames. Resolve the real player
  // before the engine page runs, so those links land instead of 404ing.
  if (typeof window.pgPlayer === "function" && !window.pgPlayer.__foFuzzy) {
    var _pgPlF = window.pgPlayer;
    window.pgPlayer = function (q) {
      try {
        q = q || {};
        var nm = String(q.n || "");
        var find = (typeof findPlayer === "function") ? findPlayer : null;
        if (nm && find && !find(nm)) {
          var cands = [
            nm.trim(),
            (window.__FO_RENAMES || {})[nm.trim()] || "",
            nm.replace(/\s*\([^)]*\)\s*$/, "").trim(),        // "Name (123 pts)"
            nm.replace(/\s+\d[\w*\/.]*$/, "").trim()          // "Name 4w" / "Name 75*" / "Name 3/21"
          ];
          var fixed = null;
          for (var i = 0; i < cands.length && !fixed; i++) if (cands[i] && find(cands[i])) fixed = cands[i];
          if (!fixed) {
            // unique prefix / case-insensitive match as a last resort
            var lc = nm.trim().toLowerCase(), hits = [];
            ((typeof GD !== "undefined" && GD.teams) || []).forEach(function (t2) {
              ((t2 && t2.players) || []).forEach(function (p2) {
                if (p2 && p2.name && (p2.name.toLowerCase() === lc || lc.indexOf(p2.name.toLowerCase()) === 0)) hits.push(p2.name);
              });
            });
            if (hits.length === 1) fixed = hits[0];
          }
          if (fixed) { var q2 = {}; for (var k in q) q2[k] = q[k]; q2.n = fixed; q = q2; }
        }
        window.__foPlayerN = q && q.n;   // the RESOLVED name, for the privacy check
      } catch (e) {}
      return _pgPlF.call(this, q);
    };
    window.pgPlayer.__foFuzzy = 1;
  }

  // relabel the confirm button to "Start Season" while in league draft mode
  if (typeof window.pgFounder === "function") {
    var _pg = window.pgFounder;
    window.pgFounder = function () {
      var out = _pg.apply(this, arguments);
      try {
        if (App.founder && App.founder.__league) {
          var b = document.querySelector("#page .confirmbtn");
          if (b) b.textContent = "Confirm my squad";
        }
      } catch (e) {}
      return out;
    };
  }

  // On confirm in league mode, let the game build the club into GD.teams (so it
  // is a real, valid club record), then upload it. The season starts when the
  // commissioner has everyone's clubs.
  if (typeof window.founderConfirm === "function") {
    var _fc = window.founderConfirm;
    window.founderConfirm = function () {
      var lg = App.founder && App.founder.__league;
      var out = _fc.apply(this, arguments);   // game writes the drafted squad into GD.teams[teamIx]
      // onboarding's post-confirm corrections (forecast bank, provenance,
      // sponsor deal) must land BEFORE the copy below, or the pushed club -
      // the copy every other client and the resolver settle from - diverges
      // from what the founder sees locally
      try { if (typeof window.__foAfterConfirm === "function") window.__foAfterConfirm(); } catch (eAc) {}
      if (lg) {
        try {
          var club = JSON.parse(JSON.stringify(GD.teams[App.teamIx]));
          // whatever founderConfirm the build ends up using, THIS is the club
          // that gets uploaded - so this is the name the device answers to
          try { if (typeof foSetMyClub === "function") foSetMyClub(club.name); } catch (eMc) {}
          // the quick-start fee flag is draft-board bookkeeping; the engine just
          // deleted the fees themselves, so don't let the flag ride the club JSON
          (club.players || []).forEach(function (cp) { delete cp._qsPriced; });
          rpc("push_club", { p_league_id: lg.league_id, p_club: club, p_team_ix: null }).then(function () {
            // Season already running? No waiting room · take over a bot club and
            // play. During a relaunch that includes the commissioner.
            if (SYNC && SYNC.started && (!SYNC.isFounder || window.__foRelaunchEpoch)) { foJoinRunningSeason(club); return; }
            showWait(true);
          }).catch(say);
        } catch (e) { say(e); }
      }
      return out;
    };
  }

  // Splice my freshly-drafted club into the RUNNING season by taking over a bot
  // club: the bot's identity is renamed to my club everywhere in the snapshot
  // (fixtures, table, results), then its record is replaced with my squad.
  function foJoinRunningSeason(club, attempt) {
    attempt = attempt || 0;
    if (attempt > 12) return;                       // the watchdog gave it every chance
    // first join shows its progress; watchdog re-splices are silent so they
    // never interrupt a manager already playing
    if (!attempt) { openWrap(true); foLoading("Joining the season…"); }
    sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round").then(function (a) {
      var st = a[0];
      if (!st || !st.snapshot || !st.snapshot.teams) { if (!attempt) showWait(true); return; }
      var snap = st.snapshot;
      try {
        var era9 = foRelaunchEpochOf(snap);
        if (era9 && +club.__foEpoch !== era9) {
          // adopt the era only on the INITIAL join, right after founding - the
          // club is brand new, its stamp just predates the snapshot it lands
          // in. A watchdog re-splice crossing a relaunch boundary is the
          // opposite case: the club was retired with the old era, and
          // restamping it would resurrect it past the relaunch gate forever.
          if (attempt) { window.__foRejoin = null; try { (window.__foJoinTimers || []).forEach(clearTimeout); } catch (eT9) {} return; }
          club.__foEpoch = era9;
          rpc("push_club", { p_league_id: LG.id, p_club: club, p_team_ix: null }).catch(function () {});
        }
      } catch (eE9) {}
      var already = snap.teams.some(function (t) { return t && t.name === club.name; });
      var target = already ? club.name : null;
      if (!target) {
        var bots = snap.teams.filter(function (t) { return t && !t.founded; });
        if (!bots.length) {
          if (!attempt) { say("The league is already full of human clubs · ask your commissioner to restart the season to fit you in."); showWait(true); }
          else if (attempt === 1) say("Another club took the last open place while you were joining · ask your commissioner to restart the season to fit you in.");
          return;
        }
        // take over a bottom-half bot, salted by club name: two managers
        // joining in the same minute pick DIFFERENT bots instead of both
        // claiming the bottom one and clobbering each other's join
        var half = bots.slice(Math.floor(bots.length / 2)) ;
        var bot = half[foHash32(club.name || "fo") % half.length] || bots[bots.length - 1];
        target = bot.name;
      }
      var raw = JSON.stringify(snap);
      if (target !== club.name) raw = raw.split(JSON.stringify(target).slice(1, -1)).join(JSON.stringify(club.name).slice(1, -1));
      var s2 = JSON.parse(raw);
      var ix = s2.teams.findIndex(function (t) { return t && t.name === club.name; });
      if (ix < 0) { if (!attempt) showWait(true); return; }
      club.founded = true;
      s2.teams[ix] = club;
      // PIN BEFORE APPLYING. This splice renames a bot to your club's name
      // across the whole snapshot; the snapshot's own teamIx still belongs to
      // whoever pushed it. Without this the applySnapshot below - and every
      // watchdog re-splice for the next ninety minutes - could hand this
      // device a different club than the one it just joined as.
      try { if (typeof foSetMyClub === "function") foSetMyClub(club.name); } catch (eMc) {}
      return rpc("member_push_state", { p_league_id: LG.id, p_snapshot: s2, p_round: st.round || 0 }).then(function (ver) {
        SYNC.lastVersion = typeof ver === "number" ? ver : (st.version + 1);
        SYNC.started = true;
        applySnapshot(s2, !attempt);
        // joins are allowed even while the 9:00 round is being played: the
        // resolver banking the round (or another joiner) can clobber this
        // splice minutes from now, so a watchdog keeps checking for up to
        // 90 minutes and quietly re-takes the place until it sticks
        try { (window.__foJoinTimers || []).forEach(clearTimeout); } catch (eT) {}
        window.__foJoinTimers = [5, 60, 180, 480, 900, 1800, 3600, 5400].map(function (sec) {
          return setTimeout(function () {
            sel("league_state", "league_id=eq." + LG.id + "&select=snapshot").then(function (a2) {
              var cur = a2 && a2[0];
              var inSnap = !!(cur && cur.snapshot && (cur.snapshot.teams || []).some(function (t2) { return t2 && t2.name === club.name; }));
              if (!inSnap) foJoinRunningSeason(club, attempt + 1);
            }).catch(function () {});
          }, sec * 1000 + Math.random() * 2000);
        });
      });
    }).catch(function (e) {
      if (attempt) return;                          // a later watchdog pass retries
      var msg = ((e && e.message) || e) + "";
      if (/Could not find the function|member_push_state/i.test(msg)) {
        say("Squad locked in! Ask your commissioner to hit 'Restart season' to bring your club in (or run the 0013 SQL to enable instant joining).");
      } else say(e);
      showWait(true);
    });
  }

  // ---- Smarter "Suggest all" bowling attack ---------------------------------
  // The stock suggestOrders() hands every bowler a flat 5-over spell. Real
  // captaincy reads the pitch and weather, leans on the bowlers those conditions
  // suit, and rotates them through varied 2-5 over spells (best bowlers bowl the
  // most). We build a full 50-over plan honouring the engine's rules (each end is
  // its own over-set, no bowler two overs running, max 10 each) and derive the
  // north/south spells from it · exactly the shape the engine expects.
  function foCapDist(n) {
    // n bowler caps summing to 50, each 2..10, biased so the top names bowl more.
    var w = 0, i, caps = [];
    for (i = 0; i < n; i++) { caps[i] = 0; w += (n - i); }
    for (i = 0; i < n; i++) caps[i] = Math.max(2, Math.min(10, Math.round(50 * (n - i) / w)));
    var sum = function () { return caps.reduce(function (a, b) { return a + b; }, 0); };
    var guard = 0;
    while (sum() < 50 && guard++ < 500) { // top up the best available bowlers first
      var up = -1; for (i = 0; i < n; i++) if (caps[i] < 10) { up = i; break; }
      if (up < 0) break; caps[up]++;
    }
    guard = 0;
    while (sum() > 50 && guard++ < 500) { // trim from the weakest first
      var dn = -1; for (i = n - 1; i >= 0; i--) if (caps[i] > 2) { dn = i; break; }
      if (dn < 0) break; caps[dn]--;
    }
    return caps;
  }
  // Split a bowler's over allocation into varied 2-5 chunks, never stranding a 1.
  function foChunks(c) {
    var out = [], pat = [3, 2, 4, 3, 5, 2], pi = 0;
    while (c > 0) {
      var L = Math.min(pat[pi++ % pat.length], 5, c);
      if (c - L === 1) L = (L - 1 >= 2) ? L - 1 : c;
      L = Math.max(1, L);
      out.push(L); c -= L;
    }
    return out;
  }
  // Round-robin the bowlers' chunks into a spell order so no two consecutive
  // spells share a bowler (keeps them as distinct spells; within one end the overs
  // are two apart, so this is never a back-to-back match over).
  function foInterleave(mains, chunks) {
    var order = [], idx = {}, last = null, guard = 0;
    mains.forEach(function (m) { idx[m] = 0; });
    var left = function (m) { return chunks[m].length - idx[m]; };
    while (guard++ < 400) {
      var avail = mains.filter(function (m) { return left(m) > 0 && m !== last; });
      if (!avail.length) avail = mains.filter(function (m) { return left(m) > 0; });
      if (!avail.length) break;
      avail.sort(function (x, y) { return left(y) - left(x); });
      var m = avail[0];
      order.push({ bowler: m, n: chunks[m][idx[m]++] });
      last = m;
    }
    return order;
  }
  // Swap apart any two neighbouring spells that share a bowler (which would merge
  // into one over-long spell), preserving each bowler's total.
  function foDeAdjacent(order) {
    for (var i = 1; i < order.length; i++) {
      if (order[i].bowler !== order[i - 1].bowler) continue;
      for (var j = i + 1; j < order.length; j++) {
        if (order[j].bowler !== order[i - 1].bowler && (i + 1 >= order.length || order[j].bowler !== order[i + 1].bowler)) {
          var t = order[i]; order[i] = order[j]; order[j] = t; break;
        }
      }
    }
    return order;
  }
  function foSmartBowling() {
    // App/userTeam/isPT are const bindings in the engine realm (not on window);
    // typeClass/pickXI/pgOrders are function declarations. All resolve bare here.
    if (typeof App === "undefined" || typeof userTeam !== "function" || typeof pickXI !== "function" || typeof typeClass !== "function") return foOrigSuggest();
    var t = userTeam(), xi = pickXI(t);
    var bs = xi.filter(function (p) { return p.bowlType && !isPT(p); });
    if (bs.length < 5) return foOrigSuggest();      // need 5+ to cover 50 legally

    // ---- batting order built for the CONDITIONS, not the roster sheet ----
    var pend0 = App.pending || {}, pitch0 = pend0.pitch || "balanced";
    var wx0 = String(pend0.weather || "").toLowerCase();
    var newBallBites = pitch0 === "green" || pitch0 === "cracked" || /overcast|humid|misty|drizzle/.test(wx0);
    var turnLater = pitch0 === "dry" || pitch0 === "slow" || pitch0 === "twoPaced";
    var SK = function (p) { try { return (typeof S === "function") ? S(p) : (p.skills || {}); } catch (e) { return p.skills || {}; } };
    var tHas = function (p, tl) { return (p.talents || []).indexOf(tl) >= 0; };
    var shade = function (p, s) {
      s *= 0.90 + 0.033 * (p.formIx == null ? 3 : p.formIx);
      var fr = { "clinically dead": 0.72, shattered: 0.76, exhausted: 0.80, listless: 0.85, weary: 0.90, moderate: 0.94, satisfactory: 0.97 }[String(p.fatigue || "rested").toLowerCase()];
      return fr ? s * fr : s;
    };
    var openScore = function (p) {   // survive the new ball
      var k = SK(p);
      var s = (newBallBites ? 0.55 : 0.45) * (k.vsPace || 0) + 0.25 * (k.temperament || 0) + 0.15 * (k.rotation || 0) + 0.05 * (k.vsSpin || 0);
      if (tHas(p, "fastStarter")) s += 7;
      if (tHas(p, "anchor")) s += 5;
      if (tHas(p, "newBallSpecialist")) s -= 4;    // save frontline bowlers' legs
      return shade(p, s);
    };
    var midScore = function (p) {    // own the middle overs
      var k = SK(p);
      var spinW = turnLater ? 0.42 : 0.30;
      var s = (0.72 - spinW) * (k.vsPace || 0) + spinW * (k.vsSpin || 0) + 0.18 * (k.rotation || 0) + 0.10 * (k.temperament || 0);
      if (tHas(p, "anchor")) s += 4;
      if (tHas(p, "spinKiller") && turnLater) s += 7;
      return shade(p, s);
    };
    var finScore = function (p) {    // hit at the death
      var k = SK(p);
      var s = 0.50 * (k.power || 0) + 0.22 * (k.temperament || 0) + 0.18 * (k.rotation || 0) + 0.10 * (k.vsPace || 0);
      if (tHas(p, "finisher")) s += 9;
      if (tHas(p, "sixMachine")) s += 6;
      return shade(p, s);
    };
    var pool2 = xi.slice(), orderNames = [];
    var takeBest = function (fn) {
      pool2.sort(function (a, b) { return fn(b) - fn(a); });
      var p2 = pool2.shift(); if (p2) orderNames.push(p2.name); return p2;
    };
    takeBest(openScore); takeBest(openScore);                 // openers
    takeBest(midScore); takeBest(midScore); takeBest(midScore); // 3-5
    takeBest(finScore); takeBest(finScore);                   // 6-7 finishers
    // tail: remaining by plain batting, best first
    pool2.sort(function (a, b) { return (b.bat || 0) - (a.bat || 0); });
    pool2.forEach(function (p2) { orderNames.push(p2.name); });
    App.orders.batOrder = orderNames;
    // captain: the XI's best leader · captaincy skill first, experience as tiebreak
    var cap = xi.slice().sort(function (a, b) {
      return ((b.capt || 0) + (b.exp || 0) * 0.25) - ((a.capt || 0) + (a.exp || 0) * 0.25);
    })[0] || xi[0];
    App.orders.captain = cap.name;
    App.orders.keeper = (xi.find(function (p) { return p.keeper; }) || xi[0]).name;

    // Read the fixture's pitch + weather (App.pending is the next match's meta).
    var pend = App.pending || {}, pitch = pend.pitch || "balanced";
    var wx = String(pend.weather || "").toLowerCase();
    var seamPitch = pitch === "green" || pitch === "cracked" || pitch === "twoPaced";
    var seamWx = /overcast|humid|drizzle|dew|swing/.test(wx);
    var spinPitch = pitch === "dry" || pitch === "slow" || pitch === "cracked";
    var isPace = function (p) { return typeClass(p.bowlType) === "pace"; };
    var isSpin = function (p) { return typeClass(p.bowlType) === "spin"; };
    var has = function (p, tl) { return (p.talents || []).indexOf(tl) >= 0; };
    var score = function (p) {
      var s = 0.55 * (p.threat || 0) + 0.45 * (p.control || 0);
      // form (0-6, 3 = steady) and fatigue shade the ranking
      s *= 0.90 + 0.033 * (p.formIx == null ? 3 : p.formIx);
      var fr = { "clinically dead": 0.72, shattered: 0.76, exhausted: 0.80, listless: 0.85, weary: 0.90, moderate: 0.94, satisfactory: 0.97 }[String(p.fatigue || "rested").toLowerCase()];
      if (fr) s *= fr;
      if (isPace(p) && (seamPitch || seamWx)) s += 12;
      if (isSpin(p) && spinPitch) s += 12;
      if (has(p, "newBallSpecialist")) s += 6;
      if (has(p, "deathSpecialist")) s += 4;
      return s;
    };
    var ranked = bs.slice().sort(function (a, b) { return score(b) - score(a); });
    var paceOf = {}; bs.forEach(function (p) { paceOf[p.name] = isPace(p); });
    var caps = {}, capArr = foCapDist(ranked.length);
    ranked.forEach(function (p, i) { caps[p.name] = capArr[i]; });

    // Partition the bowlers into DISJOINT north/south groups (each covering its 25
    // overs), so no bowler is at both ends and back-to-back overs are impossible.
    // Pace bowlers are placed first and spread across the two ends so each powerplay
    // can open with seam; the one "straddler" that may span both ends tends to be a
    // spinner and is kept out of the powerplay (north death + south middle).
    var nc = {}, sc = {}, nSum = 0, sSum = 0, straddler = null;
    var ordered = ranked.filter(function (p) { return paceOf[p.name]; }).concat(ranked.filter(function (p) { return !paceOf[p.name]; }));
    ordered.forEach(function (p) {
      var nm = p.name, c = caps[nm], take;
      if (nSum <= sSum) {                                   // fill the emptier end first
        if (nSum + c <= 25) { nc[nm] = c; nSum += c; }
        else { take = 25 - nSum; if (take > 0) { nc[nm] = take; nSum = 25; } sc[nm] = c - take; sSum += c - take; straddler = nm; }
      } else {
        if (sSum + c <= 25) { sc[nm] = c; sSum += c; }
        else { take = 25 - sSum; if (take > 0) { sc[nm] = take; sSum = 25; } nc[nm] = c - take; nSum += c - take; straddler = nm; }
      }
    });
    if (nSum !== 25 || sSum !== 25) return foOrigSuggest();               // couldn't tile 25/25
    if (straddler && (nc[straddler] > 5 || sc[straddler] > 5)) return foOrigSuggest(); // rare

    var byName = {}; bs.forEach(function (p) { byName[p.name] = p; });
    var spells = { north: [], south: [] };
    [["north", nc, 1], ["south", sc, 2]].forEach(function (E) {
      var end = E[0], counts = {}, first = E[2], k;
      for (k in E[1]) counts[k] = E[1][k];                   // clone (we deduct as we lay spells)
      var overs = []; for (var o = first; o <= 50; o += 2) overs.push(o);
      var strN = straddler && counts[straddler] ? counts[straddler] : 0;

      // Powerplay (this end's first 5 overs = match overs ≤10): cover it with seam.
      var paceMains = Object.keys(counts).filter(function (n) { return n !== straddler && paceOf[n] && counts[n] > 0; })
        .sort(function (a, b) {
          var nb = (has(byName[b], "newBallSpecialist") ? 1 : 0) - (has(byName[a], "newBallSpecialist") ? 1 : 0);
          return nb || (score(byName[b]) - score(byName[a]));
        });
      var order = [], ppCovered = 0, lastPP = null;
      while (ppCovered < 5) {
        var cand = paceMains.filter(function (n) { return counts[n] > 0 && n !== lastPP; });
        if (!cand.length) break;
        var pk = cand[0], need = 5 - ppCovered, L = Math.min(counts[pk], 5);
        if (L > need) L = Math.max(need, 2);
        if (counts[pk] - L === 1) L = Math.max(2, L - 1);
        order.push({ bowler: pk, n: L }); counts[pk] -= L; ppCovered += L; lastPP = pk;
      }

      // Remaining overs: chunk what's left (spin welcome now) and interleave.
      var restMains = Object.keys(counts).filter(function (n) { return n !== straddler && counts[n] > 0; });
      var chunks = {}; restMains.forEach(function (n) { chunks[n] = foChunks(counts[n]); });
      order = order.concat(foInterleave(restMains, chunks));

      if (strN) {
        var sp = { bowler: straddler, n: strN };
        if (end === "north") { order.push(sp); }             // straddler bowls the death at north
        else {                                               // and the middle at south (never the powerplay)
          var cum = 0, ins = order.length, m;
          for (m = 0; m < order.length; m++) { cum += order[m].n; if (cum >= 5) { ins = m + 1; break; } }
          order.splice(ins, 0, sp);
        }
      }
      order = foDeAdjacent(order);
      // death overs (each end's final spell): hand them to the best death bowler
      var deathScore = function (n) {
        var p3 = byName[n]; if (!p3) return -1;
        var k3 = (typeof S === "function") ? S(p3) : (p3.skills || {});
        return (has(p3, "deathSpecialist") ? 40 : 0) + 0.5 * (k3.economy || 0) + 0.3 * (k3.variation || 0) + 0.2 * (k3.discipline || 0);
      };
      var bestIx = -1, bestVal = -1, strIx = -1;
      if (straddler) for (var qi = 0; qi < order.length; qi++) if (order[qi].bowler === straddler) { strIx = qi; break; }
      // never move a spell from BEFORE the straddler: everything after it would
      // slide, and the straddler's overs can then overlap its spell at the
      // other end (same bowler in consecutive overs - illegal)
      for (var di = Math.max(1, strIx + 1); di < order.length - 1; di++) {    // keep the PP head intact
        var v = deathScore(order[di].bowler);
        if (v > bestVal && order[di].bowler !== order[order.length - 1].bowler) { bestVal = v; bestIx = di; }
      }
      if (bestIx > 0 && order.length > 2 && bestVal > deathScore(order[order.length - 1].bowler)) {
        var sp2 = order.splice(bestIx, 1)[0];
        if (order[order.length - 1].bowler !== sp2.bowler) order.push(sp2);
        else order.splice(order.length - 1, 0, sp2);
        order = foDeAdjacent(order);
      }

      var oi = 0;
      order.forEach(function (sp) {
        var f = overs[oi];
        spells[end].push({ bowler: sp.bowler, first: f, n: sp.n, field: f <= 10 ? "att" : (f >= 41 ? "def" : "bal") });
        oi += sp.n;
      });
    });
    if (!spells.north.length || !spells.south.length) return foOrigSuggest();
    App.orders.spells = spells;
    App.orders.grid = null;                          // let the grid reseed from the new plan
    // only re-render when the manager is actually ON the orders page - the
    // one-tap XI confirm calls this from the club home and must stay there
    try { if (App.page === "orders") pgOrders(); } catch (e) {}
  }
  // The engine dates rounds a week apart (its solo roots). This league plays
  // one round per day at 9:00 AM ET: round dates anchor to TODAY's round.
  try {
    if (typeof fo55RoundDate === "function") {
      var _foRD = fo55RoundDate;
      fo55RoundDate = function (roundNo) {
        try {
          return foDailyDate(roundNo, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
        } catch (e) { return _foRD(roundNo); }
      };
      window.fo55RoundDate = fo55RoundDate;
    }
  } catch (e) {}

  var foOrigSuggest = window.suggestOrders;
  if (typeof foOrigSuggest === "function") {
    window.suggestOrders = function () {
      var r; try { r = foSmartBowling(); } catch (e) { r = foOrigSuggest(); }
      // foSmartBowling's rare bail-outs call the ENGINE's suggestOrders, which
      // ends in pgOrders() and repaints #page with the Orders screen. When the
      // caller was NOT on the orders page (the one-tap XI confirm on the club
      // home, the tutorial), put the page back where the manager was.
      try {
        if (App.page !== "orders" && document.querySelector("#page .ftp-orders") && typeof window.route === "function") window.route();
      } catch (e2) {}
      return r;
    };
  }
  // Swap the engine's Club home for the premium branded dashboard.
  var foOrigClub = window.pgClub;
  if (typeof foOrigClub === "function") window.pgClub = foPremiumClub;

  // THE DOOR ASKS WHO YOU ARE. It used to let a fresh visitor straight past on
  // the strength of a flag this device set for itself - fo_welcomed - because
  // the game behind it ran with no account and no server. That game is gone;
  // a club lives in the world now, and the world has to know whose it is.
  function foFrontDoor() { renderWelcome(); }
  // the nav's Log out returns here
  window.foDoorOpen = function () { try { openWrap(true); renderWelcome(); } catch (e) {} };
  // A stored session signs back in silently; everyone else meets the door.
  var _authRedirect = null;
  try { _authRedirect = foConsumeAuthHash(); } catch (eAH) {}
  openWrap(true);
  // THE BREAK-GLASS. ?signout=1 drops the stored session and goes straight to
  // the front door. It runs before a single request is made, so it is the one
  // way back that still works when the network is what is broken - the answer
  // to "I am stuck on Signing you in and there is no button". It signs this
  // device out; it touches nothing on the server, so the club is untouched.
  try {
    if (/[?&]signout=1\b/.test(location.search)) {
      clearSession(); JWT = ""; LG = null; SYNC = null;
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (eH) {}
      foFrontDoor();
      return;
    }
  } catch (eSO) {}
  if (_authRedirect === "ok") { foLoading("Signing you in…"); enterApp(); }
  else if (_authRedirect === "error") { renderLogin(); setTimeout(function () { say("That email link expired or was already used. Log in with your email and password below."); }, 60); }
  else restoreSession().then(function () { if (JWT) { foLoading("Signing you in…"); enterApp(); } else foFrontDoor(); }).catch(function () { foFrontDoor(); });

