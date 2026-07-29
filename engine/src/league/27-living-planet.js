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
// The calendar, in 25-day seasons:
//   days 0-17   league rounds 1-18 (every nation, TEN clubs, double round robin)
//   day  18     honours day (champions crowned)
//   day  19     World Cup draw
//   days 20-23  World Cup: last sixteen, quarters, then prime-time semis & FINAL
//   day  24     rest day - the wire catches its breath
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
  var EPOCH = Date.UTC(2026, 6, 28);           // 28 July 2026, day 0 - OPENING DAY: round 1 everywhere
  var DAY = 86400000, CYCLE = 25, ROUNDS = 18;  // ten clubs, eighteen rounds - every nation plays YOUR format
  var LIVE_LEN = 3;                             // a day's play runs three hours
  // the staggered globe: each nation bowls its first ball at its own UTC hour.
  // England is the 14:00 UTC league; the rest spread around the clock so
  // there is nearly always a match on somewhere.
  var HOUR_SLOTS = [1, 4, 7, 10, 13, 16, 19, 22];
  function natHour(rid) { if (rid === "eng") return 14; return HOUR_SLOTS[h32("nathour|" + rid) % HOUR_SLOTS.length]; }
  function dayIx(now) { return Math.floor((now - EPOCH) / DAY); }
  function hourOfDay(now) { var d = dayIx(now); return (now - (EPOCH + d * DAY)) / 3600000; }
  // the served world's season 1 begins on day 0 itself (28 July = Day 1,
  // Round 1) - the planet's phase runs on the SAME season clock as the
  // umpire, so "round N" here is the round the server actually plays today
  var WORLD_START = 0;
  function phaseOf(now) {
    var d = dayIx(now), rel = d - WORLD_START;
    if (rel < 0) return { day: d, season: 1, di: -1, kind: "rest", preseason: true };
    var s = Math.floor(rel / CYCLE) + 1, di = rel % CYCLE;
    var p = { day: d, season: s, di: di };
    if (di < ROUNDS) { p.kind = "league"; p.round = di + 1; }
    else if (di === 18) p.kind = "honours";
    else if (di === 19) p.kind = "draw";
    else if (di <= 23) { p.kind = "cup"; p.stage = ["r16", "qf", "sf", "final"][di - 20]; }
    else p.kind = "rest";
    return p;
  }
  // how many rounds of season s are FINAL at `now` - per nation, since each
  // nation's day ends at its own hour
  function roundsDone(now, s, rid) {
    var p = phaseOf(now);
    if (s < p.season) return ROUNDS;
    if (s > p.season) return 0;
    if (p.di >= ROUNDS) return ROUNDS;
    var h0 = rid != null ? natHour(rid) : 14;
    return p.di + (hourOfDay(now) >= h0 + LIVE_LEN ? 1 : 0);
  }

  // ---- the sides of a nation --------------------------------------------------
  function regionList() { var c = cx(); if (!c) return []; return (c.regions() || []).filter(function (r) { return !r.final; }); }
  function regionById(rid) { var L = regionList(); for (var i = 0; i < L.length; i++) if (L[i].id === rid) return L[i]; return null; }
  // two more real cricket cities per nation, so every league seats ten clubs
  var EXTRA_CITY = { eng: ["Taunton", "Hove"], ire: ["Sligo", "Wexford"], ned: ["Nijmegen", "Leiden"], win: ["Kingstown", "Providence"], rsa: ["East London", "Potchefstroom"], zim: ["Chinhoyi", "Marondera"], aus: ["Darwin", "Newcastle"], nzl: ["Queenstown", "Whangarei"], slk: ["Negombo", "Jaffna"], sub: ["Pune", "Lucknow"], pak: ["Quetta", "Gujranwala"], afg: ["Bamyan", "Farah"], bgd: ["Mymensingh", "Bogra"], nep: ["Butwal", "Nepalgunj"], sco: ["Paisley", "Falkirk"], wal: ["Llanelli", "Pontypridd"], ken: ["Kakamega", "Kitale"], usa: ["Seattle", "Atlanta"], can: ["Victoria", "Markham"] };
  // England is hand-named on the server (Sir Giles and the counties) - the
  // mirror MUST carry the same names, or orders keyed by club name would
  // miss and the claim highlight would never find you
  var ENG_SIDES = [
    { slot: 0, boss: true, name: "Sir Giles Pemberley's XI", city: "London" },
    { slot: 1, name: "Yorkshire", city: "Leeds" },
    { slot: 2, name: "Lancashire", city: "Manchester" },
    { slot: 3, name: "Surrey", city: "London" },
    { slot: 4, name: "Middlesex", city: "London" },
    { slot: 5, name: "Warwickshire", city: "Birmingham" },
    { slot: 6, name: "Nottinghamshire", city: "Nottingham" },
    { slot: 7, name: "Kent", city: "Canterbury" },
    { slot: 8, name: "Durham", city: "Durham" },
    { slot: 9, name: "Somerset", city: "Taunton" }
  ];
  function sidesOf(rid) {
    if (rid === "eng") return ENG_SIDES.map(function (s0) { return { slot: s0.slot, boss: !!s0.boss, name: s0.name, city: s0.city, str: s0.boss ? 1.07 : 0.9 }; });
    var r = regionById(rid); if (!r) return [];
    var cities = (cx().cities(rid) || []).concat(EXTRA_CITY[rid] || []);
    var bc = null; (r.clubs || []).forEach(function (c) { if (c.boss) bc = c; });
    var multByCity = {}; (r.clubs || []).forEach(function (c) { if (!c.boss && c.city) multByCity[c.city] = c.mult; });
    var out = [{ slot: 0, boss: true, name: bc ? bc.nm : (r.nm + " XI"), city: (bc && bc.city) || cities[0] || r.nm, str: 1.07 }];
    for (var s = 1; s <= 9; s++) {
      var ct = cities[s] || (r.nm + " " + s);
      out.push({ slot: s, boss: false, name: ct + " CC", city: ct, str: multByCity[ct] || (0.86 + rnd01(rid + "|st|" + ct) * 0.1) });
    }
    return out;
  }
  // double round robin by the circle method, team order reshuffled every season
  function schedOf(rid, season) {
    var N = 10, idx = [];
    for (var z = 0; z < N; z++) idx.push(z);
    var seed = h32(rid + "|order|" + season);
    for (var i = N - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; var j = seed % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var list = idx.slice(), rounds = [];
    for (var r = 0; r < N - 1; r++) {
      var rd = [];
      for (var k = 0; k < N / 2; k++) { var a = list[k], b = list[N - 1 - k]; rd.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(rd);
      list = [list[0], list[N - 1]].concat(list.slice(1, N - 1)); // rotate all but the pivot
    }
    for (var r2 = 0; r2 < N - 1; r2++) rounds.push(rounds[r2].map(function (f) { return [f[1], f[0]]; }));
    return rounds;
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
  function fixturesOf(rid, season, round) {
    var S = sidesOf(rid); if (S.length < 8) return [];
    return schedOf(rid, season)[round - 1].map(function (f) { return playMatch(rid, season, round, S[f[0]], S[f[1]]); });
  }
  function tableOf(rid, season, uptoRounds) {
    var S = sidesOf(rid), T = {};
    S.forEach(function (s) { T[s.slot] = { side: s, P: 0, W: 0, L: 0, T: 0, pts: 0, diff: 0 }; });
    for (var r = 1; r <= Math.min(ROUNDS, uptoRounds); r++) {
      fixturesOf(rid, season, r).forEach(function (m) {
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
    if (p.di < 20) return 0;
    var base = p.di - 20;
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
    if (p.kind === "honours" || p.di === 19) {
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
        var toGo = WORLD_START - dayIx(now);
        return { key: "up", liveIds: [], chip: "Season 1 opens " + (toGo === 1 ? "tomorrow" : "in " + toGo + " days") };
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

  // PHASE 4 OF THE ALMANACK. This page's job is to say what the world is doing
  // RIGHT NOW, and the world's most useful device - the band of flags in hour
  // order, lit while a nation is playing - is kept, because nothing else says
  // "the planet is awake somewhere" as fast. Everything under it is ruled
  // type: the cup as stages, the nations as rows, the wire as headlines. The
  // clock, the schedule mirror and the served-standings reads are unchanged.
  function AL_() { return window.AL || null; }
  function foRenderPlanetPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/planet") return;
      if (!cx()) return;
      var page = document.getElementById("page"); if (!page) return;
      var al = AL_(); if (!al) return;
      try { window.__foAlApply && window.__foAlApply(); } catch (eA) {}

      var now = Date.now(), p = phaseOf(now), st = todayStatus(now);
      overrideSnapshot(now);
      var my = myNation(), myRegion = regionById(my) || { nm: "England" };
      var A = artBase();
      var flagOf = function (rid) { return A + "flags/" + cx().flagFile(rid) + ".svg"; };
      var hNow = hourOfDay(now);

      var phaseLine =
        p.preseason ? "The world is founded and the squads are named — season 1 " + ((WORLD_START - dayIx(now)) === 1 ? "begins tomorrow" : "begins in " + (WORLD_START - dayIx(now)) + " days") :
        p.kind === "league" ? "Round " + p.round + " of " + ROUNDS + " across the world's leagues" :
        p.kind === "honours" ? "Honours day — champions are crowned tonight" :
        p.kind === "draw" ? "World Cup draw day — sixteen nations learn their fate" :
        p.kind === "cup" ? "World Cup — " + stageName(p.stage) :
        "Rest day — the season " + (p.season + 1) + " calendar begins tomorrow";

      var body = al.head("World cricket · season " + p.season + " · day " + (p.di + 1) + " of " + CYCLE,
        "The Planet Plays Today",
        "Every league runs on the world calendar, live from its own local hour — online or offline, the same " +
        "world for everyone.");
      body += al.subnav("planet");

      // ---- what is happening this minute, and the way in -------------------
      var liveHref = st.liveIds && st.liveIds.length === 1
        ? (st.liveIds[0] === my ? "#/league" : "#/nation?n=" + encodeURIComponent(st.liveIds[0]))
        : "#/watch";
      body += al.decide({
        kind: st.key === "live" ? "act" : "",
        title: st.chip,
        note: phaseLine,
        action: st.key === "live" ? { href: liveHref, label: "Watch" } : null,
        primary: st.key === "live",
      });

      // ---- the world by the hour: the one device worth keeping -------------
      var band = regionList().slice()
        .sort(function (a, b) { return natHour(a.id) - natHour(b.id) || (a.nm < b.nm ? -1 : 1); })
        .map(function (r) {
          var h0 = natHour(r.id);
          var on = (p.kind === "league") && hNow >= h0 && hNow < h0 + LIVE_LEN;
          var dest = on ? "#/watch?n=" + encodeURIComponent(r.id) : "#/nation?n=" + encodeURIComponent(r.id);
          return '<a class="al-flag' + (on || r.id === my ? " al-flag--on" : "") + '" href="' + dest +
            '" aria-label="' + E(r.nm) + '"><img src="' + flagOf(r.id) + '" alt="" ' +
            "onerror=\"this.style.display='none'\"><span>" + hh(h0).slice(0, 2) + "</span></a>";
        }).join("");
      body += '<div class="al-flags">' + band + "</div>" +
        '<p class="al-read">The world by the hour, UTC. A lit flag is a nation in play.</p>';

      // ---- your own league, from the served world only ---------------------
      try {
        var wclP = null; try { wclP = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eW) {}
        var svP = null;
        try { if (window.__foWorldLg) { window.__foWorldLg.want(my, planetRepaint); svP = window.__foWorldLg.get(my); } } catch (eL) {}
        var meNm2 = (wclP && wclP.country === my) ? wclP.club : null;
        var rows = [["Your league", myRegion.nm]];
        if (meNm2) {
          var posTxt = meNm2;
          if (svP && svP.table) {
            var ix2 = svP.table.findIndex(function (t2) { return t2.name === meNm2; });
            if (ix2 >= 0) posTxt = meNm2 + " · " + (ix2 + 1) + ordSuf(ix2 + 1);
          }
          rows.push(["Your club", posTxt]);
        }
        var ldr3 = svP && svP.table && svP.table[0];
        if (ldr3 && (ldr3.pts | 0) > 0) rows.push(["Leading", ldr3.name + " · " + (ldr3.pts | 0) + " pts"]);
        body += al.sec("Your corner of the world", al.ledger(rows),
          { href: "#/nation?n=" + encodeURIComponent(my), label: myRegion.nm });
      } catch (eOwn) {}

      // ---- the World Cup, once the draw is made ----------------------------
      if (p.di >= 19) {
        var stagesDone = wcStagesDone(now, p.season);
        var bracket = wcBracket(p.season);
        var ents = wcEntrants(p.season);
        var myIn = ents.some(function (e2) { return e2.rid === my; });
        var ups = callUps(myRegion);
        var cupBody = "";
        if (stagesDone >= 4) {
          cupBody += '<p class="al-lede">' + E(wcChampion(p.season).nm) + " are champions of the world.</p>";
        }
        cupBody += '<p class="al-read">' + (myIn
          ? E(myRegion.nm) + " are in" + (ups.length ? " · called up: " + ups.map(E).join(", ") : "")
          : E(myRegion.nm) + " missed the cut this season") + "</p>";
        bracket.forEach(function (sg, si) {
          var visible = si < stagesDone || (p.kind === "cup" && ["r16", "qf", "sf", "final"][si] === p.stage);
          if (!visible) {
            cupBody += '<p class="al-read">' + stageName(sg.stage) + " · " +
              (si === stagesDone ? "next, " + hh(WC_HOURS[si]) + " UTC" : "to come") + "</p>";
            return;
          }
          var done = si < stagesDone;
          cupBody += '<p class="al-read">' + stageName(sg.stage) + "</p>" + al.ledger(sg.matches.map(function (m) {
            return [m.a.nm + " v " + m.b.nm,
              done ? m.winner.nm + " · " + m.hs + " v " + m.as : "to play",
              done && (m.winner.rid === my) ? "pos" : ""];
          }));
        });
        body += al.sec("Season " + p.season + " World Cup", cupBody, { href: "#/champions", label: "The clubs' cup" });
      }

      // ---- the rest of the world, nation by nation -------------------------
      if (p.kind === "league" || p.kind === "honours") {
        var natRows = regionList().filter(function (r) { return r.id !== my; }).map(function (r) {
          var svN = null;
          try {
            if (window.__foWorldLg) { window.__foWorldLg.want(r.id, planetRepaint); svN = window.__foWorldLg.get(r.id); }
          } catch (eSv) {}
          if (svN && (!svN.seasonNo || svN.seasonNo !== p.season)) svN = null;
          var natLive = (p.kind === "league") && hNow >= natHour(r.id) && hNow < natHour(r.id) + LIVE_LEN;
          var line;
          if (p.kind === "honours") {
            var c = championOf(r.id, p.season);
            line = c ? c.name + ", champions" : "champions being decided";
          } else if (natLive) {
            line = "in play now · " + hh(natHour(r.id)) + " UTC";
          } else {
            var t = svN && svN.table && svN.table.length ? svN.table[0] : null;
            line = t ? (t.p ? t.name + " lead · " + t.pts + " pts" : "no play yet")
                     : "round " + p.round + " · " + hh(natHour(r.id)) + " UTC";
          }
          return '<a class="al-fix al-fix--room' + (natLive ? " al-fix--next" : "") +
            '" href="#/nation?n=' + encodeURIComponent(r.id) + '">' +
            '<span class="al-fix__t"><b><img class="al-flag" src="' + flagOf(r.id) + '" alt="" ' +
            "onerror=\"this.style.display='none'\">" + E(r.nm) + "</b><i>" + E(line) + "</i></span>" +
            '<span class="al-fix__o">' + (natLive ? "LIVE" : "›") + "</span></a>";
        }).join("");
        body += al.sec("The rest of the world · " + (regionList().length - 1) + " leagues",
          '<div class="al-fixlist">' + natRows + "</div>");
      }

      // ---- the wire -----------------------------------------------------------
      var wireItems = genWire(now).slice(0, 6);
      if (wireItems.length) {
        body += al.sec("The world wire",
          '<div class="al-fixlist">' + wireItems.map(function (w) {
            return '<div class="al-fix al-fix--room"><span class="al-fix__t"><b>' + E(w.headline) + "</b></span></div>";
          }).join("") + "</div>", { href: "#/wire", label: "All of it" });
      }

      page.innerHTML = al.page({ body: body });
    } catch (e) { try { console.warn("foRenderPlanetPage", e); } catch (e2) {} }
  }
  function ordSuf(n) { return ["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th"; }

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
  window.__foPlanet = { phaseOf: phaseOf, roundsDone: roundsDone, sidesOf: sidesOf, fixturesOf: fixturesOf, tableOf: tableOf, championOf: championOf, wcEntrants: wcEntrants, wcBracket: wcBracket, wcChampion: wcChampion, wcStagesDone: wcStagesDone, liveView: liveView, genWire: genWire, overrideSnapshot: overrideSnapshot, natHour: natHour, dayIx: dayIx, EPOCH: EPOCH, CYCLE: CYCLE, ROUNDS: ROUNDS, DAY: DAY, LIVE_LEN: LIVE_LEN, WORLD_START: WORLD_START };
})();
