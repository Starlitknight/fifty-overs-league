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
// The calendar, in 21-day seasons:
//   days 0-13   league rounds 1-14 (every nation, 8 clubs, double round robin)
//   day  14     honours day (champions crowned)
//   day  15     World Cup draw
//   days 16-19  World Cup: last sixteen, quarters, semis, THE FINAL
//   day  20     rest day - the wire catches its breath
// Each day's play runs 10:00-14:00 UTC (live, partial scores), final at 14:00.
//
// Your OWN league stays yours - your real clubs at your real pace. The clock
// drives the other nations, and at runtime it overwrites the baked
// FO_WORLD_SNAPSHOT's leagues and wire, so the nation record books, the atlas
// ticker and the world desk all come alive without changing a line of them.
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
  var EPOCH = Date.UTC(2026, 4, 16);           // 16 May 2026, day 0 of world cricket
  var DAY = 86400000, CYCLE = 21, ROUNDS = 14;
  var LIVE_H0 = 10, LIVE_H1 = 14;              // play runs 10:00-14:00 UTC
  function dayIx(now) { return Math.floor((now - EPOCH) / DAY); }
  function hourOfDay(now) { var d = dayIx(now); return (now - (EPOCH + d * DAY)) / 3600000; }
  function phaseOf(now) {
    var d = dayIx(now), s = Math.floor(d / CYCLE) + 1, di = ((d % CYCLE) + CYCLE) % CYCLE;
    var p = { day: d, season: s, di: di };
    if (di < ROUNDS) { p.kind = "league"; p.round = di + 1; }
    else if (di === 14) p.kind = "honours";
    else if (di === 15) p.kind = "draw";
    else if (di <= 19) { p.kind = "cup"; p.stage = ["r16", "qf", "sf", "final"][di - 16]; }
    else p.kind = "rest";
    return p;
  }
  // how many rounds of season s are FINAL at instant `now`
  function roundsDone(now, s) {
    var p = phaseOf(now);
    if (s < p.season) return ROUNDS;
    if (s > p.season) return 0;
    if (p.di >= ROUNDS) return ROUNDS;
    return p.di + (hourOfDay(now) >= LIVE_H1 ? 1 : 0);
  }

  // ---- the sides of a nation --------------------------------------------------
  function regionList() { var c = cx(); if (!c) return []; return (c.regions() || []).filter(function (r) { return !r.final; }); }
  function regionById(rid) { var L = regionList(); for (var i = 0; i < L.length; i++) if (L[i].id === rid) return L[i]; return null; }
  function sidesOf(rid) {
    var r = regionById(rid); if (!r) return [];
    var cities = (cx().cities(rid) || []);
    var bc = null; (r.clubs || []).forEach(function (c) { if (c.boss) bc = c; });
    var multByCity = {}; (r.clubs || []).forEach(function (c) { if (!c.boss && c.city) multByCity[c.city] = c.mult; });
    var out = [{ slot: 0, boss: true, name: bc ? bc.nm : (r.nm + " XI"), city: (bc && bc.city) || cities[0] || r.nm, str: 1.07 }];
    for (var s = 1; s <= 7; s++) {
      var ct = cities[s] || (r.nm + " " + s);
      out.push({ slot: s, boss: false, name: ct + " CC", city: ct, str: multByCity[ct] || (0.86 + rnd01(rid + "|st|" + ct) * 0.1) });
    }
    return out;
  }
  // double round robin by the circle method, team order reshuffled every season
  function schedOf(rid, season) {
    var idx = [0, 1, 2, 3, 4, 5, 6, 7];
    var seed = h32(rid + "|order|" + season);
    for (var i = 7; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; var j = seed % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var list = idx.slice(), rounds = [];
    for (var r = 0; r < 7; r++) {
      var rd = [];
      for (var k = 0; k < 4; k++) { var a = list[k], b = list[7 - k]; rd.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(rd);
      list = [list[0], list[7]].concat(list.slice(1, 7)); // rotate all but the pivot
    }
    for (var r2 = 0; r2 < 7; r2++) rounds.push(rounds[r2].map(function (f) { return [f[1], f[0]]; }));
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
  function wcStagesDone(now, season) {
    var p = phaseOf(now); if (season < p.season) return 4;
    if (season > p.season) return 0;
    if (p.di < 16) return 0;
    return Math.min(4, (p.di - 16) + (hourOfDay(now) >= LIVE_H1 ? 1 : 0));
  }

  // ---- live partial scores (10:00-14:00 UTC, deterministic by the minute) ----
  function liveView(m, now) {
    var h = hourOfDay(now);
    if (h < LIVE_H0) return { state: "up" };
    if (h >= LIVE_H1) return { state: "fin", line: m.hs + " · " + m.as, text: m.text };
    var p = (h - LIVE_H0) / (LIVE_H1 - LIVE_H0), ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
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
      var done = roundsDone(now, ph.season) >= ph.round;
      if (!done) return;
      regionList().forEach(function (r) {
        if (r.id === myNation()) return;
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
    if (p.kind === "honours" || p.di === 15) {
      regionList().forEach(function (r) {
        if (r.id === myNation()) return;
        var c = championOf(r.id, p.season);
        if (c) out.push({ day: p.day, season: p.season, dayInSeason: p.di, phase: "league", category: "title", importance: 90, headline: r.nm + " have their champions: " + c.name + " take the season " + p.season + " pennant" });
      });
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
        var rd = roundsDone(now, p.season);
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
  function todayStatus(now) {
    var h = hourOfDay(now), d = dayIx(now);
    if (h < LIVE_H0) return { key: "up", chip: "Play begins in " + fmtCountdown(EPOCH + d * DAY + LIVE_H0 * 3600000 - now) };
    if (h < LIVE_H1) return { key: "live", chip: "LIVE · results at 14:00 UTC" };
    return { key: "fin", chip: "Today's play is complete" };
  }
  function stageName(st) { return { r16: "The Last Sixteen", qf: "Quarter-finals", sf: "Semi-finals", final: "THE WORLD CUP FINAL" }[st] || st; }

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

      var phaseLine =
        p.kind === "league" ? "Round " + p.round + " of " + ROUNDS + " across the world's leagues" :
        p.kind === "honours" ? "Honours day - champions are crowned tonight" :
        p.kind === "draw" ? "World Cup draw day - sixteen nations learn their fate" :
        p.kind === "cup" ? "World Cup - " + stageName(p.stage) :
        "Rest day - the season " + (p.season + 1) + " calendar begins tomorrow";

      // -- your own league card: the real one, your clubs, your pace ---------
      var ownCard = "";
      try {
        var me = userTeam(), rows = leagueRows();
        var pos = rows.findIndex(function (x) { return x.nm === me.name; }) + 1;
        var ldr = rows[0];
        var nxt = (typeof window.foNextFixture === "function") ? window.foNextFixture() : null;
        ownCard = "<a class='fo-pl-own' href='#/league'>" +
          "<img class='fo-pl-flag' src='" + flagOf(my) + "' alt='' onerror=\"this.style.display='none'\">" +
          "<span class='fo-pl-ownt'><i>Your league &middot; " + E(myRegion.nm) + "</i>" +
          "<b>" + E(me.name) + (pos ? " &middot; " + pos + (pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th") : "") + "</b>" +
          "<em>" + (ldr ? E(ldr.nm) + " lead on " + (ldr.pts | 0) + " pts" : "The season awaits") +
          (nxt && nxt.opp ? " &middot; next: v " + E(nxt.opp.name) : "") + "</em></span><u>&rsaquo;</u></a>";
      } catch (eOwn) {}

      // -- the world cup panel (draw day through rest day) --------------------
      var cupHTML = "";
      if (p.di >= 15) {
        var stagesDone = wcStagesDone(now, p.season);
        var bracket = wcBracket(p.season);
        var myIn = wcEntrants(p.season).some(function (e) { return e.rid === my; });
        var ups = callUps(myRegion);
        var stageRows = bracket.map(function (sg, si) {
          var visible = si < stagesDone || (p.kind === "cup" && ["r16", "qf", "sf", "final"][si] === p.stage);
          var liveNow = p.kind === "cup" && ["r16", "qf", "sf", "final"][si] === p.stage && st.key === "live";
          if (!visible && si >= stagesDone) {
            return "<div class='fo-pl-stage dim'><i>" + stageName(sg.stage) + "</i><span>" + (si === stagesDone ? "Tomorrow, 10:00 UTC" : "To come") + "</span></div>";
          }
          var done = si < stagesDone;
          return "<div class='fo-pl-stage'><i>" + stageName(sg.stage) + (liveNow && !done ? " <b class='lv'>LIVE</b>" : "") + "</i>" +
            sg.matches.map(function (m) {
              var mineM = m.a.rid === my || m.b.rid === my;
              return "<div class='fo-pl-cm" + (mineM ? " mine" : "") + "'>" +
                "<img src='" + flagOf(m.a.rid) + "' alt=''><span class='" + (done && m.winner === m.a ? "w" : "") + "'>" + E(m.a.nm) + "</span>" +
                "<u>v</u>" +
                "<span class='" + (done && m.winner === m.b ? "w" : "") + "'>" + E(m.b.nm) + "</span><img src='" + flagOf(m.b.rid) + "' alt=''>" +
                (done ? "<em>" + E(m.winner.nm) + " through &middot; " + m.hs + " v " + m.as + "</em>" : "") +
                "</div>";
            }).join("") + "</div>";
        }).join("");
        var champLine = stagesDone >= 4 ? "<div class='fo-pl-crown'>&#127942; <b>" + E(wcChampion(p.season).nm) + "</b> are champions of the world</div>" : "";
        cupHTML = "<div class='fo-pl-cup'><div class='fo-pl-cuph'><i>Season " + p.season + " World Cup</i>" +
          (myIn ? "<span class='in'>" + E(myRegion.nm) + " are in" + (ups.length ? " &middot; called up: " + ups.map(E).join(", ") : "") + "</span>" : "<span class='in'>" + E(myRegion.nm) + " missed the cut this season</span>") +
          "</div>" + champLine + stageRows + "</div>";
      }

      // -- one card per rival nation: today's tallest fixture, the leader ----
      var natCards = "";
      if (p.kind === "league") {
        natCards = regionList().filter(function (r) { return r.id !== my; }).map(function (r) {
          var fx = fixturesOf(r.id, p.season, p.round);
          var t = tableOf(r.id, p.season, roundsDone(now, p.season));
          var posOf = {}; t.forEach(function (row, i2) { posOf[row.side.slot] = i2 + 1; });
          var feat = fx.slice().sort(function (a, b) { return (posOf[a.home.slot] + posOf[a.away.slot]) - (posOf[b.home.slot] + posOf[b.away.slot]); })[0];
          var lv = feat ? liveView(feat, now) : null;
          var starLn = "";
          try { if (feat && lv.state === "fin" && window.__foStars) starLn = window.__foStars.suffix(r.id, p.season, p.round, feat); } catch (eSt) {}
          var mid = !feat ? "" :
            lv.state === "up" ? "<em class='fx'>" + E(feat.home.name) + " v " + E(feat.away.name) + " &middot; 10:00 UTC</em>" :
            lv.state === "live" ? "<em class='fx live'><b>LIVE</b> " + E(lv.line) + "</em>" :
            "<em class='fx'>" + E(feat.text) + E(starLn) + "</em>";
          var ldr2 = t[0];
          return "<a class='fo-pl-nat' href='#/nation?n=" + encodeURIComponent(r.id) + "'>" +
            "<img class='fo-pl-flag' src='" + flagOf(r.id) + "' alt='' onerror=\"this.style.display='none'\">" +
            "<span class='fo-pl-natt'><b>" + E(r.nm) + "</b>" + mid +
            "<u>" + (ldr2 ? E(ldr2.side.name) + " lead &middot; " + ldr2.pts + " pts" : "") + "</u></span>" +
            "<i>&rsaquo;</i></a>";
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
        "<span class='fo-pl-chip " + st.key + "'>" + E(st.chip) + "</span>" +
        "</div>" +
        ownCard + cupHTML +
        (natCards ? "<div class='fo-pl-grid'>" + natCards + "</div>" : "") +
        (wireItems ? "<div class='fo-pl-wire'><i>The world wire</i>" + wireItems + "</div>" : "") +
        "<div class='fo-pl-foot'><a href='#/league'>My league &rsaquo;</a><a href='#/almanack'>The world almanack &rsaquo;</a><a href='#/atlas'>The atlas &rsaquo;</a></div>" +
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
    "html body #page .fo-pl-chip.up{background:rgba(20,28,40,.07);color:rgba(20,28,40,.6)}",
    "html body #page .fo-pl-chip.fin{background:rgba(31,158,114,.13);color:#177A57}",
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
    "html body #page .fo-pl-cm{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font:500 12.5px/1.3 Inter,sans-serif;padding:6px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-pl-cm.mine{background:rgba(217,85,42,.06);border-radius:8px;padding:6px 8px}",
    "html body #page .fo-pl-cm img{width:20px;height:14px;object-fit:cover;border-radius:2px}",
    "html body #page .fo-pl-cm span.w{font-weight:700}",
    "html body #page .fo-pl-cm u{text-decoration:none;color:rgba(20,28,40,.4);font-size:10.5px}",
    "html body #page .fo-pl-cm em{flex-basis:100%;font:400 10.5px/1.3 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.55)}",
    "html body #page .fo-pl-wire{margin-top:16px;background:linear-gradient(150deg,#FFFEFB,#F6F1E4) !important;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 18px}",
    "html body #page .fo-pl-wire>i{display:block;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#B44A22;font-style:normal;margin-bottom:8px}",
    "html body #page .fo-pl-wireln{font:italic 420 12.5px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.72);padding:4px 0;border-top:1px solid rgba(20,28,40,.05)}",
    "html body #page .fo-pl-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-pl-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
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
  window.__foPlanet = { phaseOf: phaseOf, roundsDone: roundsDone, sidesOf: sidesOf, fixturesOf: fixturesOf, tableOf: tableOf, championOf: championOf, wcEntrants: wcEntrants, wcBracket: wcBracket, wcChampion: wcChampion, wcStagesDone: wcStagesDone, liveView: liveView, genWire: genWire, overrideSnapshot: overrideSnapshot, EPOCH: EPOCH, CYCLE: CYCLE };
})();
