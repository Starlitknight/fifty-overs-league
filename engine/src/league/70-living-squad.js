/* ============================================================================
   THE LIVING SQUAD — ageing, ceilings, contracts and character.

   The squad is the thing a manager builds, and until now it did not change.
   Nobody got better in a way you could see, nobody got old, nobody ever left,
   and no two cricketers behaved differently for any reason you could name. A
   club could be assembled once and never touched again.

   This module is the rules for all four, and NOTHING ELSE. It reads a player
   record and answers questions about him; it writes nothing, stores nothing
   and decides nothing on its own. The close-season step (the umpire) and every
   screen in the game call the same functions and therefore agree.

   DETERMINISM IS THE WHOLE DESIGN. Every answer here is a pure function of
   facts already on the record - his name, his age, his skills, his talent -
   through one FNV-1a hash. There is no Math.random anywhere in this file. Two
   clients, the umpire, and a manager who has been asleep for a fortnight all
   derive the identical career, which is the only way an offline-fair game can
   have a squad that lives.

   A CEILING IS NOT STORED. It is derived, every time, from the man himself. So
   is his character. There is no migration to run for a player who already
   exists, no column that can drift out of step with the figure it describes,
   and no way for one device to believe a different truth than another.
   ========================================================================== */
(function () {
  "use strict";
  if (window.FO_LIVE) return;

  // ---- one hash, for everything ------------------------------------------
  function h32(s) {
    var h = 2166136261; s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h;
  }
  function roll(p, salt) { return h32((p && p.name) + "|" + salt) % 1000 / 1000; }
  function ovrOf(p) {
    try { if (window.foPkOvr) return window.foPkOvr(p) | 0; } catch (e) {}
    return Math.round(((p && p.rating) || 0) / 1000);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ---- HOW GOOD HE COULD BECOME -------------------------------------------
  // The number the manager most wants and has never been able to see: is this
  // 19-year-old on 58 worth three seasons of nets, or is he already finished?
  //
  // Talent is the engine's own word for it and is already on every card. A
  // gifted boy has room; a journeyman has less. The hash spreads them so two
  // men with the same word are not the same prospect, and the floor is his
  // current overall - a ceiling below where a man already stands is a bug, not
  // a story.
  var TALENT_ROOM = { generational: 34, gifted: 26, promising: 20, steady: 14, journeyman: 9, limited: 6 };
  function ceiling(p) {
    if (!p) return 0;
    var now = ovrOf(p);
    var word = String(p.talent || "steady").toLowerCase();
    var room = TALENT_ROOM[word] == null ? 14 : TALENT_ROOM[word];
    // a man of 30 has already spent most of what he had
    var age = p.age | 0;
    var spent = age <= 20 ? 0 : age >= 32 ? 1 : (age - 20) / 12;
    var left = Math.round(room * (1 - spent * 0.85) + roll(p, "ceil") * 8 - 3);
    return clamp(now + Math.max(0, left), now, 96);
  }
  // how far along he is, and the word for it
  function outlook(p) {
    var now = ovrOf(p), top = ceiling(p);
    var pct = top > 0 ? Math.round(100 * now / top) : 0;
    var word = pct >= 99 ? "the finished article"
      : pct >= 92 ? "close to his best"
      : pct >= 80 ? "coming along"
      : pct >= 68 ? "a way to go"
      : "raw";
    return { ovr: now, ceiling: top, pct: clamp(pct, 0, 100), word: word, room: top - now };
  }

  // ---- WHAT A YEAR DOES TO HIM --------------------------------------------
  // The arc every cricketer walks: fast at nineteen, level at twenty-seven,
  // downhill from thirty-one. This is also the whole answer to "what stops one
  // club winning forever" - a great side ages together and falls off the same
  // cliff at the same time, and no artificial handicap is needed.
  function arcAt(age) {
    age = age | 0;
    if (age <= 18) return 5.0;
    if (age <= 21) return 4.0;
    if (age <= 24) return 2.6;
    if (age <= 26) return 1.4;
    if (age <= 28) return 0.5;
    if (age <= 30) return 0.0;
    if (age <= 32) return -1.6;
    if (age <= 34) return -3.0;
    if (age <= 36) return -4.5;
    return -6.0;
  }
  // the swing a season actually delivers: the arc, closed against his ceiling
  // (a man near the top of himself gains less than a boy with room), and moved
  // by how hard he was worked
  function seasonSwing(p, playedPct) {
    var o = outlook(p), a = arcAt(p.age | 0);
    var pace = roll(p, "pace" + (p.age | 0)) * 0.7 + 0.65;      // 0.65 .. 1.35
    if (a > 0) {
      var headroom = o.room <= 0 ? 0 : clamp(o.room / 18, 0.15, 1);
      var used = clamp(playedPct == null ? 0.7 : playedPct, 0.2, 1);
      return Math.round(a * pace * headroom * (0.55 + 0.45 * used) * 10) / 10;
    }
    // decline is slower for a man who is still playing every week
    var kept = clamp(playedPct == null ? 0.6 : playedPct, 0, 1);
    return Math.round(a * pace * (1 - kept * 0.35) * 10) / 10;
  }

  // ---- WHEN HE STOPS -------------------------------------------------------
  // Retirement is what makes the academy matter. A club that never blooded a
  // youngster finds four men gone in one close-season and no one to replace
  // them, which is the succession problem this game did not have.
  function retireChance(p) {
    var age = p.age | 0, o = ovrOf(p);
    if (age < 32) return 0;
    var base = (age - 31) * 0.13;                    // 32 -> .13, 38 -> .91
    if (o < 55) base += 0.18;                        // the fringe go first
    if (o >= 78) base -= 0.12;                       // a great player hangs on
    return clamp(base, 0, 1);
  }
  function willRetire(p, seasonNo) {
    if ((p.age | 0) >= 40) return true;
    return roll(p, "retire|" + seasonNo) < retireChance(p);
  }

  // ---- CHARACTER -----------------------------------------------------------
  // Two men on the same numbers should not be the same cricketer. These are
  // the words for the difference; the match engine reads them in its own
  // stage, and until it does they are still what tells you WHY you keep him.
  //
  // A trait is a fact about a man, so it is derived from him and never rolled
  // fresh: the same cricketer has the same character in every season, on every
  // device, forever.
  var TRAITS = [
    { k: "bigGame", nm: "Big-game player", why: "raises it when the match matters" },
    { k: "flatTrack", nm: "Flat-track bully", why: "feasts on a good surface, struggles on a bad one" },
    { k: "slowStarter", nm: "Slow starter", why: "worth the wait; get him through the first twenty" },
    { k: "nightHawk", nm: "Under lights", why: "a different bowler after tea" },
    { k: "ironMan", nm: "Iron man", why: "never tires, never misses" },
    { k: "glassBack", nm: "Glass back", why: "brilliant, and always one spell from the physio" },
    { k: "streetwise", nm: "Streetwise", why: "reads a chase better than the scoreboard does" },
    { k: "hothead", nm: "Hothead", why: "wins you sessions and loses you matches" },
    { k: "oneClub", nm: "One-club man", why: "will not leave, whatever anybody offers" },
    { k: "mercenary", nm: "Mercenary", why: "goes where the money and the medals are" },
    { k: "lateBloomer", nm: "Late bloomer", why: "still improving when others have stopped" },
    { k: "netsRat", nm: "Nets rat", why: "the first one there and the last to leave" },
  ];
  var TRAIT_BY_K = {}; TRAITS.forEach(function (t) { TRAIT_BY_K[t.k] = t; });
  function traits(p) {
    if (!p || !p.name) return [];
    // an explicit list on the record always wins - the served world may name a
    // man's character itself - and otherwise he is read off his own name
    if (p.traits && p.traits.length) {
      return p.traits.map(function (k) { return TRAIT_BY_K[k]; }).filter(Boolean);
    }
    var n = h32("traitn|" + p.name) % 100;
    var count = n < 42 ? 0 : n < 88 ? 1 : 2;
    if (!count) return [];
    var a = TRAITS[h32("trait1|" + p.name) % TRAITS.length];
    if (count === 1) return [a];
    var b = TRAITS[h32("trait2|" + p.name) % TRAITS.length];
    return b.k === a.k ? [a] : [a, b];
  }
  function hasTrait(p, k) {
    var t = traits(p);
    for (var i = 0; i < t.length; i++) if (t[i].k === k) return true;
    return false;
  }

  // ---- WHAT HE IS OWED, AND WHETHER HE STAYS -------------------------------
  // A squad with no contracts has no pressure on it: nobody demands, nobody
  // leaves, and a side assembled once is a side forever. Deals run to the end
  // of a season and are re-cut in the close-season, so the decision always
  // lands when the manager is looking at his squad anyway.
  //
  // ANCHORED TO THE GAME'S OWN PAY SCALE. The engine's wage table is almost
  // flat - a 95 is paid about 1.5x a 40 - so it never made anybody choose
  // anything. This curve is steeper, but it is pinned at the middle of that
  // table (a 65 asks roughly what the engine already pays a 65), which is what
  // makes it a DECISION rather than a revolt: the fringe turn out to be on too
  // much and can be let go, while the two or three best men in the club are
  // quietly underpaid and will want putting right before somebody else asks.
  // Move ANCHOR_OVR/ANCHOR_WAGE together if the engine's table ever changes.
  var ANCHOR_OVR = 65, ANCHOR_WAGE = 2150, WAGE_CURVE = 2.2;
  function wageAsk(p) {
    var o = Math.max(20, ovrOf(p)), age = p.age | 0;
    var base = ANCHOR_WAGE * Math.pow(o / ANCHOR_OVR, WAGE_CURVE);
    var young = age <= 22 ? 0.72 : age <= 25 ? 0.9 : age <= 30 ? 1 : age <= 33 ? 0.85 : 0.6;
    return Math.round(base * young / 50) * 50;
  }
  function contract(p, seasonNo) {
    seasonNo = seasonNo | 0 || 1;
    // A player who has never been given a deal is on one derived from himself,
    // one to three seasons out. STAGGERED ON PURPOSE: a single default length
    // would put an entire squad out of contract on the same morning, which is
    // not a decision, it is a cliff.
    var until = p.contractUntil == null
      ? seasonNo + 1 + (h32("deal|" + (p && p.name)) % 3)
      : (p.contractUntil | 0);
    var years = until - seasonNo;
    var ask = wageAsk(p), paid = (p.wage | 0) || ask;
    var short = ask > 0 ? clamp((ask - paid) / ask, 0, 1) : 0;
    var loyal = hasTrait(p, "oneClub"), merc = hasTrait(p, "mercenary");
    var risk = 0;
    if (years <= 0) risk = 0.55; else if (years === 1) risk = 0.2;
    risk += short * 0.5;
    if (merc) risk += 0.2;
    if (loyal) risk = 0;
    risk = clamp(risk, 0, 0.95);
    var mood = loyal ? "settled"
      : risk >= 0.6 ? "wants away"
      : risk >= 0.35 ? "unsettled"
      : short > 0.15 ? "underpaid"
      : "content";
    return {
      until: until, yearsLeft: years, wage: paid, ask: ask, risk: risk, mood: mood,
      expiring: years <= 0,
      word: years <= 0 ? "out of contract"
        : years === 1 ? "final season"
        : years + " seasons left",
    };
  }
  function willLeave(p, seasonNo) {
    if (hasTrait(p, "oneClub")) return false;
    return roll(p, "leave|" + seasonNo) < contract(p, seasonNo).risk;
  }

  // ---- THE CLOSE-SEASON ----------------------------------------------------
  // One function, called once per player per rollover, by the umpire. It
  // returns what happened; it does not apply it. The caller writes the rows,
  // which is what keeps this file honest and testable.
  function rollSeason(p, seasonNo, playedPct) {
    var before = ovrOf(p), o = outlook(p);
    var out = {
      name: p.name, seasonNo: seasonNo, ageBefore: p.age | 0, ageAfter: (p.age | 0) + 1,
      ovrBefore: before, ceiling: o.ceiling, events: [],
    };
    if (willRetire(p, seasonNo)) {
      out.retired = true;
      out.ovrAfter = before;
      out.events.push({ kind: "retired", text: p.name + " retires at " + ((p.age | 0) + 1) });
      return out;
    }
    var swing = seasonSwing(p, playedPct);
    // the nets rat banks a little more of every year; the glass back a little
    // less, because he was not there for half of it
    if (hasTrait(p, "netsRat") && swing > 0) swing = Math.round(swing * 1.25 * 10) / 10;
    if (hasTrait(p, "lateBloomer") && (p.age | 0) >= 29) swing = Math.max(swing, 0.4);
    if (hasTrait(p, "glassBack")) swing = Math.round(swing * 0.8 * 10) / 10;
    out.swing = swing;
    out.ovrAfter = clamp(Math.round(before + swing), 1, o.ceiling);
    if (out.ovrAfter > before) {
      out.events.push({ kind: "grew", text: p.name + " is up to " + out.ovrAfter + " at " + out.ageAfter });
    } else if (out.ovrAfter < before) {
      out.events.push({ kind: "declined", text: p.name + " slips to " + out.ovrAfter + " at " + out.ageAfter });
    }
    var c = contract(p, seasonNo);
    if (c.expiring) {
      out.expiring = true;
      out.leaving = willLeave(p, seasonNo);
      out.events.push(out.leaving
        ? { kind: "left", text: p.name + " leaves at the end of his deal" }
        : { kind: "renewed", text: p.name + " signs on for " + c.ask.toLocaleString() + " a round" });
    }
    return out;
  }

  // ---- the whole club, in one call ----------------------------------------
  // What the end-of-season report is: who improved, who declined, who is ready,
  // who is finished, and who has to be talked to before he walks.
  function clubReport(players, seasonNo, playedPct) {
    var rows = (players || []).map(function (p) {
      var o = outlook(p), c = contract(p, seasonNo);
      return {
        p: p, name: p.name, age: p.age | 0, ovr: o.ovr, ceiling: o.ceiling, pct: o.pct,
        room: o.room, word: o.word, swing: seasonSwing(p, playedPct && playedPct[p.name]),
        retireRisk: retireChance(p), contract: c, traits: traits(p),
      };
    });
    var by = function (f) { return rows.slice().sort(function (a, b) { return f(b) - f(a); }); };
    return {
      rows: rows,
      rising: by(function (r) { return r.swing; }).filter(function (r) { return r.swing > 0.3; }),
      falling: by(function (r) { return -r.swing; }).filter(function (r) { return r.swing < -0.3; }),
      ready: rows.filter(function (r) { return r.pct >= 92 && r.age <= 27; }),
      finished: rows.filter(function (r) { return r.retireRisk >= 0.3; }),
      atRisk: by(function (r) { return r.contract.risk; }).filter(function (r) { return r.contract.risk >= 0.35; }),
      wages: rows.reduce(function (a, r) { return a + (r.contract.wage | 0); }, 0),
      asks: rows.reduce(function (a, r) { return a + (r.contract.ask | 0); }, 0),
    };
  }

  window.FO_LIVE = {
    ceiling: ceiling, outlook: outlook, arcAt: arcAt, seasonSwing: seasonSwing,
    retireChance: retireChance, willRetire: willRetire,
    traits: traits, hasTrait: hasTrait, allTraits: TRAITS,
    wageAsk: wageAsk, contract: contract, willLeave: willLeave,
    rollSeason: rollSeason, clubReport: clubReport,
    ovr: ovrOf, hash: h32,
  };
})();
