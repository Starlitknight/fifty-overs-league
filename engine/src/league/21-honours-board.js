// ---- 21-honours-board.js — The Honours Board ---------------------------------
// Every proper pavilion has one: gold leaf on oak, the club's whole story in
// a column of names and dates. This module gives every club in the league the
// same board of thirteen honours to chase - first blood, a 350 total, the
// season double, a perfect home summer, the title - and makes it a race: the
// league remembers who got to each honour FIRST.
//
// Offline-fair by construction: every plaque is a pure function of the shared
// match record (App.results), so bots, absent managers and every client
// derive the identical board. The only stateful part is the board bonus -
// the user's chairman pays out for each new plaque through the club ledger,
// gated by an idempotent per-honour stamp.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function money(n) { return "$" + (n | 0).toLocaleString("en-US"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams; }

  var TIER = { b: { nm: "Bronze", prize: 6000 }, s: { nm: "Silver", prize: 12000 }, g: { nm: "Gold", prize: 25000 } };
  function hashS(x) { var h = 2166136261; x = String(x); for (var i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function q(name) { var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : null; }

  // ---- one sweep of the shared record ---------------------------------------
  var _sig = null, _cache = null;
  function sweep() {
    var res = (App.results || []).filter(function (r) { return r && r.comp === "league" && r.result && r.result.winner !== undefined; });
    var sig = res.length + "|" + (res.length ? res[res.length - 1].ix : -1);
    if (_cache && _sig === sig) return _cache;
    _sig = sig;
    var T = {};
    var t0 = function (nm) {
      return T[nm] || (T[nm] = {
        wins: 0, firstWin: null, bestTotal: 0, bestTotalAt: null, meanest: null, meanestAt: null,
        streak: 0, bestStreak: 0, bestStreakAt: null, cent: null, five: null, thrill: null,
        seasonWins: {}, bestSeasonWins: 0, bestSeasonAt: null,
        home: {}, dbl: null, vs: {}, titles: [], summer: null,
        beat: {}, dblVs: {}, awayWin: {}, homeBest: 0, homeBestAt: null,
        centN: 0, fiveHome: null, hstk: 0, bestHstk: 0, bestHstkAt: null
      });
    };
    var ordered = res.slice().sort(function (a, b) {
      return (a.seasonNo || 1) - (b.seasonNo || 1) || (a.round || 0) - (b.round || 0) || a.ix - b.ix;
    });
    var curSeason = App.seasonNo || 1;
    var seasonDone = function (s) {
      if (s < curSeason) return true;
      try { return !!(App.season && App.season.round >= App.season.schedule.length); } catch (e) { return false; }
    };
    ordered.forEach(function (r) {
      var s = r.seasonNo || 1, rd = (r.round || 0) + 1, when = { s: s, r: rd, ix: r.ix };
      var W = r.result.winner, L = (W === r.home) ? r.away : r.home;
      var w = t0(W), l = t0(L);
      // wins, streaks, season tallies
      w.wins++; if (!w.firstWin) w.firstWin = when;
      w.streak++; if (w.streak > w.bestStreak) { w.bestStreak = w.streak; w.bestStreakAt = when; }
      l.streak = 0;
      w.seasonWins[s] = (w.seasonWins[s] || 0) + 1;
      if (w.seasonWins[s] > w.bestSeasonWins) { w.bestSeasonWins = w.seasonWins[s]; w.bestSeasonAt = when; }
      l.seasonWins[s] = l.seasonWins[s] || 0;
      // home ledgers for the perfect summer
      var hT = t0(r.home); hT.home[s] = hT.home[s] || { p: 0, w: 0 };
      hT.home[s].p++; if (W === r.home) hT.home[s].w++;
      // the season double
      w.vs[s] = w.vs[s] || {};
      w.vs[s][L] = (w.vs[s][L] || 0) + 1;
      if (w.vs[s][L] >= 2 && !w.dbl) w.dbl = { s: s, r: rd, ix: r.ix, opp: L };
      // charter facts: first blood over each club, the double over each club,
      // the away conquest, the home winning run
      if (!w.beat[L]) w.beat[L] = when;
      if (w.vs[s][L] >= 2 && !w.dblVs[L]) w.dblVs[L] = when;
      if (W === r.away && !w.awayWin[L]) w.awayWin[L] = when;
      if (W === r.home) { hT.hstk = (hT.hstk || 0) + 1; if (hT.hstk > hT.bestHstk) { hT.bestHstk = hT.hstk; hT.bestHstkAt = when; } }
      else hT.hstk = 0;
      // thrillers
      var m1 = /win by (\d+) runs?/.exec(r.result.text || "");
      var m2 = /win by 1 wickets?/.exec(r.result.text || "");
      if (!w.thrill && ((m1 && +m1[1] <= 5) || m2)) w.thrill = { s: s, r: rd, ix: r.ix, note: r.result.text };
      // innings honours
      (r.innings || []).forEach(function (inn) {
        if (!inn || !inn.batTeam) return;
        var bt = t0(inn.batTeam), bw = t0(inn.bowlTeam || (inn.batTeam === r.home ? r.away : r.home));
        if ((inn.runs || 0) > bt.bestTotal) { bt.bestTotal = inn.runs || 0; bt.bestTotalAt = when; }
        if ((inn.wkts || 0) >= 10) {
          if (bw.meanest == null || (inn.runs || 0) < bw.meanest) { bw.meanest = inn.runs || 0; bw.meanestAt = when; }
        }
        if (inn.batTeam === r.home && (inn.runs || 0) > bt.homeBest) { bt.homeBest = inn.runs || 0; bt.homeBestAt = when; }
        (inn.bat || []).forEach(function (b) {
          if (b && b.p && b.p.name && (b.r || 0) >= 100) {
            bt.centN++;
            if (!bt.cent) bt.cent = { s: s, r: rd, ix: r.ix, who: b.p.name, runs: b.r };
          }
        });
        if (inn.bowlers) Object.keys(inn.bowlers).forEach(function (nm) {
          var v = inn.bowlers[nm];
          if (v && (v.w || 0) >= 5) {
            if (!bw.five) bw.five = { s: s, r: rd, ix: r.ix, who: nm, w: v.w, conc: v.r };
            if (inn.bowlTeam === r.home && !bw.fiveHome) bw.fiveHome = { s: s, r: rd, ix: r.ix, who: nm, w: v.w, conc: v.r };
          }
        });
      });
    });
    // titles + perfect summers, adjudicated per completed season
    var seasons = {};
    ordered.forEach(function (r) { seasons[r.seasonNo || 1] = 1; });
    Object.keys(seasons).map(Number).forEach(function (s) {
      if (!seasonDone(s)) return;
      var best = null;
      Object.keys(T).forEach(function (nm) {
        var wv = T[nm].seasonWins[s] || 0;
        if (!best || wv > best.w || (wv === best.w && nm < best.nm)) best = { nm: nm, w: wv };
      });
      if (best && best.w > 0) T[best.nm].titles.push(s);
      Object.keys(T).forEach(function (nm) {
        var h = T[nm].home[s];
        if (h && h.p >= 6 && h.w === h.p && !T[nm].summer) T[nm].summer = { s: s, p: h.p };
      });
    });
    _cache = T;
    return T;
  }

  // ---- the board itself ------------------------------------------------------
  var HONOURS = [
    { k: "first", tier: "b", nm: "First Blood", sub: "the club's first league win",
      ev: function (t) { return t.firstWin ? { at: t.firstWin } : { prog: 0, goal: 1, note: "still waiting on win no. 1" }; } },
    { k: "t300", tier: "b", nm: "Three Hundred Up", sub: "post 300 in an innings",
      ev: function (t) { return t.bestTotal >= 300 ? { at: t.bestTotalAt, note: "highest: " + t.bestTotal } : { prog: t.bestTotal, goal: 300, note: "best so far: " + t.bestTotal }; } },
    { k: "t350", tier: "s", nm: "The Three-Fifty", sub: "post 350 - a total that ends arguments",
      ev: function (t) { return t.bestTotal >= 350 ? { at: t.bestTotalAt, note: "highest: " + t.bestTotal } : { prog: t.bestTotal, goal: 350, note: "best so far: " + t.bestTotal }; } },
    { k: "demo", tier: "s", nm: "The Demolition", sub: "bowl a side out for 120 or fewer",
      ev: function (t) { return (t.meanest != null && t.meanest <= 120) ? { at: t.meanestAt, note: "skittled them for " + t.meanest } : { prog: t.meanest == null ? 0 : Math.max(0, 240 - t.meanest), goal: 120, note: t.meanest == null ? "no bowl-out yet" : "meanest bowl-out: " + t.meanest, raw: true }; } },
    { k: "cent", tier: "s", nm: "The Centurion", sub: "a club batter raises a hundred",
      ev: function (t) { return t.cent ? { at: t.cent, note: E(t.cent.who) + " - " + t.cent.runs } : { prog: 0, goal: 1, note: "no century in club colours yet" }; } },
    { k: "five", tier: "b", nm: "The Five-For", sub: "five wickets in an innings for one man",
      ev: function (t) { return t.five ? { at: t.five, note: E(t.five.who) + " - " + t.five.w + "/" + t.five.conc } : { prog: 0, goal: 1, note: "the board waits for a five-wicket haul" }; } },
    { k: "streak", tier: "s", nm: "Five on the Trot", sub: "five straight league wins",
      ev: function (t) { return t.bestStreak >= 5 ? { at: t.bestStreakAt, note: "best run: " + t.bestStreak } : { prog: t.bestStreak, goal: 5, note: "best run: " + t.bestStreak }; } },
    { k: "dbl", tier: "s", nm: "The Season Double", sub: "beat the same club home and away in one season",
      ev: function (t) { return t.dbl ? { at: t.dbl, note: "over " + E(t.dbl.opp) } : { prog: 0, goal: 1, note: "no double yet - circle the return fixtures" }; } },
    { k: "thrill", tier: "b", nm: "The Thriller", sub: "win by five runs or fewer, or by one wicket",
      ev: function (t) { return t.thrill ? { at: t.thrill, note: E(t.thrill.note || "") } : { prog: 0, goal: 1, note: "no last-gasp win on record" }; } },
    { k: "ten", tier: "s", nm: "Ten in a Summer", sub: "ten league wins in a single season",
      ev: function (t) { return t.bestSeasonWins >= 10 ? { at: t.bestSeasonAt, note: t.bestSeasonWins + " wins that season" } : { prog: t.bestSeasonWins, goal: 10, note: "best season: " + t.bestSeasonWins + " wins" }; } },
    { k: "summer", tier: "g", nm: "The Perfect Summer", sub: "win every home game of a completed season",
      ev: function (t) { return t.summer ? { at: { s: t.summer.s, r: 18 }, note: t.summer.p + " home games, " + t.summer.p + " wins" } : { prog: 0, goal: 1, note: "the fortress is not yet unbreached" }; } },
    { k: "title", tier: "g", nm: "Champions", sub: "win the league",
      ev: function (t) { return t.titles.length ? { at: { s: t.titles[0], r: 18 }, note: t.titles.length > 1 ? t.titles.length + " titles" : "Season " + t.titles[0] } : { prog: 0, goal: 1, note: "the pennant still flies elsewhere" }; } },
    { k: "fifty", tier: "g", nm: "The Fifty Club", sub: "fifty league wins, all-time",
      ev: function (t) { return t.wins >= 50 ? { at: null, note: t.wins + " and counting" } : { prog: t.wins, goal: 50, note: t.wins + " of 50 wins" }; } }
  ];
  // THE EMPTY RECORD. A club the sweep has never seen - which is every club
  // on the morning it is founded - falls back to this, so it has to carry
  // every field the boards read or the honours room dies on its own opening
  // day. It mirrors the shape sweep() builds, field for field.
  var BLANK = { wins: 0, firstWin: null, bestTotal: 0, bestTotalAt: null, meanest: null, meanestAt: null,
    streak: 0, bestStreak: 0, bestStreakAt: null, cent: null, five: null, thrill: null,
    seasonWins: {}, bestSeasonWins: 0, bestSeasonAt: null,
    home: {}, dbl: null, vs: {}, titles: [], summer: null,
    beat: {}, dblVs: {}, awayWin: {}, homeBest: 0, homeBestAt: null,
    centN: 0, fiveHome: null, hstk: 0, bestHstk: 0, bestHstkAt: null };

  // Every club also keeps a charter of its own: six pursuits written from the
  // club's identity - its appointed rival, its fortress, its bowling character,
  // the weight of history it has set itself. All parameters derive from stable
  // facts (name hash, team order, bowlType counts), so every client writes the
  // identical charter for every club, forever.
  function charterFor(name) {
    var T = sweep(); var t = T[name] || BLANK;
    var ix = -1, team = null;
    GD.teams.forEach(function (tt, i) { if (tt.name === name) { ix = i; team = tt; } });
    if (!team) return [];
    var n = GD.teams.length, h = hashS(name);
    var rival = GD.teams[(ix + 1 + (h % (n - 1))) % n] || GD.teams[(ix + 1) % n];
    var rNm = rival.name, rGr = rival.ground || (rNm + "'s ground");
    var spin = 0, pace = 0;
    (team.players || []).forEach(function (pp) { if (!pp.bowlType) return; try { (typeClass(pp.bowlType) === "spin" ? spin++ : pace++); } catch (e) { pace++; } });
    var fortGoal = 300 + ((h >> 3) % 3) * 20;
    var bookGoal = 20 + ((h >> 5) % 3) * 15;
    var items = [
      { k: "c_beat", tier: "b", nm: "Take Down " + rNm, sub: "the club the fixture list gave you - beat them once",
        r: t.beat[rNm] ? { at: t.beat[rNm] } : { prog: 0, goal: 1, note: "not yet - circle the fixture" } },
      { k: "c_dbl", tier: "s", nm: "The Double Over " + rNm, sub: "beat them home AND away in one season",
        r: t.dblVs[rNm] ? { at: t.dblVs[rNm] } : { prog: 0, goal: 1, note: "half done at best" } },
      { k: "c_away", tier: "s", nm: "Storm " + rGr, sub: "win at their place, in front of their people",
        r: t.awayWin[rNm] ? { at: t.awayWin[rNm] } : { prog: 0, goal: 1, note: "their ground still holds" } },
      { k: "c_fort", tier: "s", nm: fortGoal + " at " + (team.ground || "Home"), sub: "a fortress total in front of the members",
        r: t.homeBest >= fortGoal ? { at: t.homeBestAt, note: "best at home: " + t.homeBest } : { prog: t.homeBest, goal: fortGoal, note: "best at home: " + t.homeBest } },
      (spin >= pace ?
        { k: "c_craft", tier: "s", nm: "Spin Them Out at Home", sub: "a five-wicket haul at your own ground",
          r: t.fiveHome ? { at: t.fiveHome, note: E(t.fiveHome.who) + " - " + t.fiveHome.w + "/" + t.fiveHome.conc } : { prog: 0, goal: 1, note: "the pitch is willing; the bowler must come" } }
        : (pace >= spin + 3 ?
          { k: "c_craft", tier: "s", nm: "Rattle the Sightscreen", sub: "a home five-for from your quicks",
            r: t.fiveHome ? { at: t.fiveHome, note: E(t.fiveHome.who) + " - " + t.fiveHome.w + "/" + t.fiveHome.conc } : { prog: 0, goal: 1, note: "keep the grass on and wait" } }
          : { k: "c_craft", tier: "s", nm: "Three Hundreds in Club Colours", sub: "three individual centuries, any players, any seasons",
            r: t.centN >= 3 ? { at: null, note: t.centN + " raised so far" } : { prog: t.centN, goal: 3, note: t.centN + " of 3 raised" } })),
      { k: "c_book", tier: "g", nm: "The " + bookGoal + "-Win Book", sub: "a body of work: " + bookGoal + " league wins, all-time",
        r: t.wins >= bookGoal ? { at: null, note: t.wins + " and counting" } : { prog: t.wins, goal: bookGoal, note: t.wins + " of " + bookGoal } }
    ];
    return items.map(function (it) {
      var r = it.r || {};
      return { k: it.k, tier: it.tier, nm: it.nm, sub: it.sub, done: !("goal" in r), at: r.at || null, note: r.note || "", prog: r.prog || 0, goal: r.goal || 0, rival: rNm };
    });
  }

  function boardFor(name) {
    var T = sweep(); var t = T[name] || BLANK;
    return HONOURS.map(function (h) {
      var r = h.ev(t) || {};
      return { k: h.k, tier: h.tier, nm: h.nm, sub: h.sub, done: !("goal" in r), at: r.at || null, note: r.note || "", prog: r.prog || 0, goal: r.goal || 0 };
    });
  }
  // ---- the chairman pays for plaques ----------------------------------------
  function settleBonuses() {
    try {
      if (!ready()) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      if (!App.ls || typeof App.ls !== "object") App.ls = {};
      var hb = App.ls.hb; if (!hb || typeof hb !== "object") hb = App.ls.hb = { paid: {} };
      if (!hb.paid) hb.paid = {};
      var changed = false;
      boardFor(me.name).forEach(function (p) {
        if (!p.done || hb.paid[p.k]) return;
        hb.paid[p.k] = 1; changed = true;
        try { if (typeof ledger === "function") ledger("Board bonus - " + p.nm, TIER[p.tier].prize); } catch (eL) {}
      });
      charterFor(me.name).forEach(function (p) {
        if (!p.done || hb.paid[p.k]) return;
        hb.paid[p.k] = 1; changed = true;
        try { if (typeof ledger === "function") ledger("Charter sealed - " + p.nm, 9000); } catch (eC) {}
      });
      if (changed) { try { if (typeof saveGame === "function") saveGame(false); } catch (eS) {} }
    } catch (e) {}
  }
  function bankedTotal() {
    var hb = (App.ls && App.ls.hb && App.ls.hb.paid) || {};
    var sum = 0;
    HONOURS.forEach(function (h) { if (hb[h.k]) sum += TIER[h.tier].prize; });
    return sum;
  }

  // ---- desk card -------------------------------------------------------------
  function foHonoursCard() {
    try {
      if (!ready()) return "";
      var me = userTeam(); if (!me) return "";
      var board = boardFor(me.name);
      var done = board.filter(function (p) { return p.done; });
      var next = board.filter(function (p) { return !p.done && p.goal > 1; })
        .sort(function (a, b) { return (b.prog / b.goal) - (a.prog / a.goal); })[0];
      var latestR = 0, latestS = 0;
      try { latestS = App.seasonNo || 1; latestR = App.season ? App.season.round : 0; } catch (e) {}
      var fresh = done.some(function (p) { return p.at && p.at.s === latestS && p.at.r >= latestR; });
      return "<a class='fo-ls-card fo-hb-card' href='#/milestones'>" +
        "<div class='fo-ls-kick'>The honours board" + (fresh ? " <em class='fo-hb-new'>new plaque</em>" : "") + "</div>" +
        "<div class='fo-hb-line'><b>" + done.length + " of " + board.length + "</b> plaques &middot; <b>" + charterFor(me.name).filter(function (c) { return c.done; }).length + " of 6</b> charter seals</div>" +
        (next ? "<div class='fo-hb-sub'>Closest: " + E(next.nm) + " &middot; " + E(next.note) + "</div>" : "<div class='fo-hb-sub'>The board is full. Commission a bigger board.</div>") +
        "<span class='fo-ls-go'>Read the board &rsaquo;</span></a>";
    } catch (e) { return ""; }
  }

  // ---- the page --------------------------------------------------------------
  // A PAVILION WALL BELONGS TO ONE CLUB. This page carried a row of buttons -
  // every club in the league - and a league-wide race panel naming whoever
  // reached each honour first, so your own wall was one tab among ten. It is
  // your board now, and only yours.
  function foRenderHonoursPage() {
    try {
      if (!ready()) return;
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on");
      document.body.classList.add("fo-hbx-on");
      settleBonuses();
      // no painting behind the board: the honours read on plain cream
      var hbBg = "";
      var club = me.name, mine = true;
      var board = boardFor(club);
      var done = board.filter(function (p) { return p.done; });
      var latestS = App.seasonNo || 1, latestR = 0;
      try { latestR = App.season ? App.season.round : 0; } catch (e2) {}

      var when = function (at) { return at ? "S" + at.s + " &middot; R" + at.r : "all-time"; };
      var plaques = board.map(function (p) {
        if (p.done) {
          var fresh = p.at && p.at.s === latestS && p.at.r >= latestR && mine;
          return "<div class='fo-hb-plq on" + (fresh ? " new" : "") + " t-" + p.tier + "'>" +
            "<i>" + TIER[p.tier].nm + "</i><b>" + E(p.nm) + "</b>" +
            "<span>" + (p.note || E(p.sub)) + "</span><em>" + when(p.at) + "</em></div>";
        }
        var pct = p.goal > 1 ? Math.max(3, Math.min(97, Math.round(100 * p.prog / p.goal))) : 0;
        return "<div class='fo-hb-plq t-" + p.tier + "'>" +
          "<i>" + TIER[p.tier].nm + "</i><b>" + E(p.nm) + "</b>" +
          "<span>" + E(p.sub) + "</span>" +
          (p.goal > 1 ? "<div class='fo-hb-m'><u style='width:" + pct + "%'></u></div>" : "") +
          "<em class='pend'>" + p.note + "</em></div>";
      }).join("");

      var charter = charterFor(club);
      var chDone = charter.filter(function (p) { return p.done; }).length;
      var chRows = charter.map(function (p) {
        var fresh = p.done && p.at && p.at.s === latestS && p.at.r >= latestR && mine;
        if (p.done) {
          return "<div class='fo-hb-ch on" + (fresh ? " new" : "") + "'><s></s>" +
            "<b>" + p.nm + "</b><span>" + (p.note || E(p.sub)) + "</span><em>" + when(p.at) + " &middot; sealed</em></div>";
        }
        var pct = p.goal > 1 ? Math.max(3, Math.min(97, Math.round(100 * p.prog / p.goal))) : 0;
        return "<div class='fo-hb-ch'>" +
          "<b>" + p.nm + "</b><span>" + E(p.sub) + "</span>" +
          (p.goal > 1 ? "<div class='fo-hb-m'><u style='width:" + pct + "%'></u></div>" : "") +
          "<em class='pend'>" + p.note + "</em></div>";
      }).join("");

      page.innerHTML = hbBg +
        "<div class='fo-hb'>" +
        "<div class='fo-hb-mast'>" +
        "<div class='fo-hb-kick'>" + E(club) + " &middot; the pavilion wall</div>" +
        "<h1>The Honours Board</h1>" +
        "<div class='fo-hb-tally'><b>" + done.length + "</b> of " + board.length + " plaques" +
          (bankedTotal() ? " &middot; " + money(bankedTotal()) + " banked" : "") + "</div>" +
        "</div>" +
        "<div class='fo-hb-shead'><b>The " + E(club) + " charter</b><span>" + chDone + " of 6 sealed</span></div>" +
        "<div class='fo-hb-chgrid'>" + chRows + "</div>" +
        "<div class='fo-hb-shead'><b>The board</b><span>" + done.length + " of " + board.length + " plaques</span></div>" +
        "<div class='fo-hb-oak'><div class='fo-hb-grid'>" + plaques + "</div></div>" +
        "<div class='fo-hb-foot'><a href='#/league'>&#8592; My league</a><a href='#/squad'>The squad &rsaquo;</a></div>" +
        "</div>";

    } catch (e) { try { console.warn("foRenderHonoursPage", e); } catch (e2) {} }
  }

  // ---- sheet -----------------------------------------------------------------
  var CSS = [
    "html body.fo-hbx-on{background:#2E2418 !important;isolation:isolate}",
    ".fo-hb-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 45%;z-index:-2}",
    ".fo-hb-veil{position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(24,18,10,.30),rgba(24,18,10,.12) 32%,rgba(24,18,10,.18) 64%,rgba(18,13,7,.46))}",
    // the pavilion wall wears the shared navy masthead: same band as the
    // fixture list and the cup boards, gold eyebrow, white headline
    "body.fo-hbx-on #page .fo-hb-mast{background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F) !important;border:none !important;border-radius:20px;padding:24px 26px 22px;box-shadow:0 18px 44px rgba(11,29,51,.3) !important}",
    "body.fo-hbx-on #page .fo-hb-mast:after{display:none}",
    "body.fo-hbx-on #page .fo-hb-mast h1{color:#FFFEFC !important;text-shadow:none}",
    "body.fo-hbx-on #page .fo-hb-kick{color:#E8B96A !important;text-shadow:none}",
    "body.fo-hbx-on #page .fo-hb-mast p{color:rgba(244,239,228,.72) !important;text-shadow:none}",
    "body.fo-hbx-on #page .fo-hb-tally{box-shadow:0 8px 20px rgba(0,0,0,.35)}",
    // section headings floating on the pavilion air
    "html body #page .fo-hb-shead{margin:18px 2px 8px;display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}",
    "html body #page .fo-hb-shead b{font-family:Fraunces,Georgia,serif;font-weight:600;font-style:normal;font-size:21px;color:#1B2432}",
    "html body #page .fo-hb-shead span{font:400 13px/1.4 Fraunces,Georgia,serif;color:rgba(20,28,40,.55)}",
    // the charter: parchment scrolls with wax seals
    "html body #page .fo-hb-chgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(235px,1fr));gap:10px}",
    "html body #page .fo-hb-ch{position:relative;background:linear-gradient(174deg,#FBF5E3,#F3EAD0 70%);border:1px solid rgba(140,104,20,.4);border-radius:4px 14px 4px 14px;padding:13px 15px 12px;box-shadow:0 10px 24px rgba(10,7,3,.4)}",
    "html body #page .fo-hb-ch b{display:block;font:600 14px/1.2 Fraunces,Georgia,serif;color:#2E2410;padding-right:20px}",
    "html body #page .fo-hb-ch span{display:block;font:400 13px/1.45 Fraunces,Georgia,serif;color:rgba(46,36,16,.65);margin-top:4px}",
    "html body #page .fo-hb-ch em{display:block;font:600 12px/1 Inter,sans-serif;color:rgba(46,36,16,.55);font-style:normal;margin-top:9px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-hb-ch em.pend{color:rgba(46,36,16,.5)}",
    "html body #page .fo-hb-ch.on{background:linear-gradient(174deg,#FDF7E4,#F6ECCB 70%);border-color:rgba(140,104,20,.6)}",
    "html body #page .fo-hb-ch.on em{color:#7A2B1E}",
    // the wax seal
    "html body #page .fo-hb-ch s{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#B54532,#7A2B1E 65%,#5E2015);box-shadow:0 2px 6px rgba(0,0,0,.4),inset 0 1px 2px rgba(255,255,255,.25);text-decoration:none}",
    "html body #page .fo-hb-ch s:after{content:'';position:absolute;inset:5px;border-radius:50%;border:1px solid rgba(255,220,190,.4)}",
    "@media (prefers-reduced-motion:no-preference){html body #page .fo-hb-ch.new:after{content:'';position:absolute;inset:0;border-radius:inherit;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.7) 47%,transparent 62%);background-size:260% 100%;animation:foHbShine 2.4s ease .4s 2}}",
    // the oak itself: deep wood, a gold pinstripe, plaques screwed to it
    "html body #page .fo-hb-oak{background:linear-gradient(168deg,#5A4326,#43301A 55%,#33240F);border:1px solid rgba(230,190,110,.35);outline:1px solid rgba(230,190,110,.28);outline-offset:-8px;border-radius:16px;padding:16px;box-shadow:0 26px 60px rgba(10,7,3,.55),inset 0 1px 0 rgba(255,235,190,.18);margin-top:12px}",
    "body.fo-hbx-on #page .fo-hb-plq{background:rgba(250,245,232,.94)}",
    "body.fo-hbx-on #page .fo-hb-foot a{background:rgba(253,252,249,.92);box-shadow:0 8px 20px rgba(10,7,3,.35)}",
    "html body #page .fo-hb{max-width:960px;margin:26px auto 44px;padding:0 14px;color:#1B2432}",
    "html body #page .fo-hb-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:28px 30px 24px;box-shadow:0 22px 50px rgba(30,38,52,.12);position:relative;overflow:hidden}",
    "html body #page .fo-hb-mast:after{content:'';position:absolute;inset:8px;border:1px solid rgba(176,132,9,.25);border-radius:16px;pointer-events:none}",
    "html body #page .fo-hb-kick,html body #page .fo-hb-k{font-family:Inter,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-hb-mast h1{font-family:Inter,sans-serif;font-weight:600;font-size:38px;letter-spacing:.04em;text-transform:uppercase;margin:6px 0 8px;color:#1B2432}",
    "html body #page .fo-hb-mast p{font:400 13.5px/1.55 Fraunces,Georgia,serif;color:rgba(20,28,40,.62);margin:0;max-width:64ch}",
    "html body #page .fo-hb-tally{margin-top:12px;font:600 13px/1 Inter,sans-serif;color:#1B2432;background:#FFFEFC;border:1px solid rgba(176,132,9,.4);border-radius:999px;display:inline-block;padding:8px 15px}",
    "html body #page .fo-hb-tally b{color:#B08409}",
    // club switcher
    // plaques
    "html body #page .fo-hb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:11px;margin-top:12px}",
    "html body #page .fo-hb-plq{position:relative;border-radius:14px;padding:14px 15px 13px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);box-shadow:0 5px 16px rgba(30,38,52,.06)}",
    "html body #page .fo-hb-plq i{display:block;font:700 11px/1 Inter,sans-serif;letter-spacing:.26em;text-transform:uppercase;font-style:normal;color:rgba(20,28,40,.4);margin-bottom:6px}",
    "html body #page .fo-hb-plq b{display:block;font:600 15px/1.15 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#1B2432}",
    "html body #page .fo-hb-plq span{display:block;font:400 13px/1.45 Fraunces,Georgia,serif;color:rgba(20,28,40,.58);margin-top:5px}",
    "html body #page .fo-hb-plq em{display:block;font:600 12px/1 Inter,sans-serif;color:#8A6A1F;font-style:normal;margin-top:9px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-hb-plq em.pend{color:rgba(20,28,40,.5)}",
    // the won plaque: brass on oak
    "html body #page .fo-hb-plq.on{background:linear-gradient(155deg,#F9EBC4,#EED9A0 55%,#E3C67F);border:1px solid rgba(140,104,20,.5);box-shadow:0 8px 22px rgba(140,104,20,.22),inset 0 1px 0 rgba(255,255,255,.65)}",
    "html body #page .fo-hb-plq.on i{color:rgba(90,66,10,.55)}",
    "html body #page .fo-hb-plq.on b{color:#3A2C08}",
    "html body #page .fo-hb-plq.on span{color:rgba(58,44,8,.75)}",
    "html body #page .fo-hb-plq.on em{color:#6E5410}",
    "html body #page .fo-hb-plq.t-g.on{background:linear-gradient(155deg,#FCEFC0,#F3D98C 55%,#E9C25E);border-color:rgba(150,105,10,.65)}",
    "@media (prefers-reduced-motion:no-preference){html body #page .fo-hb-plq.new:after{content:'';position:absolute;inset:0;border-radius:14px;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.75) 47%,transparent 62%);background-size:260% 100%;animation:foHbShine 2.4s ease .4s 2}@keyframes foHbShine{from{background-position:130% 0}to{background-position:-130% 0}}}",
    "html body #page .fo-hb-m{height:6px;border-radius:5px;background:rgba(20,28,40,.09);overflow:hidden;margin-top:9px}",
    "html body #page .fo-hb-m u{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#26436B,#3E6DB2)}",
    // the race
    "html body #page .fo-hb-say{font:400 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin:8px 0 12px}",
    "html body #page .fo-hb-foot{display:flex;gap:10px;justify-content:space-between;margin-top:16px;flex-wrap:wrap}",
    "html body #page .fo-hb-foot a{font:600 13px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-hb-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:640px){html body #page .fo-hb-mast h1{font-size:28px}html body #page .fo-hb-grid{grid-template-columns:1fr 1fr}}",
    // desk card bits
    ".fo-hb-card{display:block;text-decoration:none;background:linear-gradient(172deg,#FDF9EE,#F6EFDA);border:1px solid rgba(140,104,20,.35);border-radius:6px;padding:14px 16px;box-shadow:0 10px 22px rgba(40,30,10,.18);color:#1B2432 !important}"
    ,".fo-hb-card .fo-ls-kick{color:#8A6A1F}"
    ,".fo-hb-card .fo-ls-go{color:#B44A22}",
    ".fo-hb-line{font:600 13.5px/1.4 Inter,sans-serif}",
    ".fo-hb-sub{font:400 13px/1.45 Fraunces,Georgia,serif;opacity:.75;margin-top:3px}",
    ".fo-hb-new{font:700 10px/1 Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;font-style:normal;background:#C9571F;color:#FFFEFC;border-radius:999px;padding:3px 7px;margin-left:6px;vertical-align:1px}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-hb-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-hb-css"; s.textContent = CSS; }
      document.body.appendChild(s);
      settleBonuses();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/milestones") document.body.classList.remove("fo-hbx-on"); setTimeout(settleBonuses, 120); });

  window.foRenderHonoursPage = foRenderHonoursPage;
  window.foHonoursCard = foHonoursCard;
  window.__foHonours = 1;
})();
