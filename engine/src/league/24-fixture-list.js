// ---- 24-fixture-list.js — The Fixture List -----------------------------------
// The season, laid out the way a broadcaster lays it out: a navy masthead with
// the club's record and running form, the next engagement up in lights, then
// every match — league round, cup Sunday and accepted friendly alike — in one
// dated card, each row a door to its report or its build-up.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  var PITCH_NM = { balanced: "True", flat: "Flat", green: "Green", dry: "Dry", slow: "Slow", cracked: "Cracked", twoPaced: "Two-paced" };
  var FA_NM = { r16: "Round of 16", qf: "Quarter-final", sf: "Semi-final", final: "The final" };
  // older saves recorded results before seasonNo existed on the record; a
  // stampless result belongs to this season exactly when the season's own
  // played-map points at its index
  function thisSeasonHas(r) {
    var cur = (App.seasonNo || 1);
    if (r.seasonNo != null) return r.seasonNo === cur;
    try {
      var P = (App.season && App.season.played) || {};
      for (var k in P) if (P[k] === r.ix) return true;
    } catch (e) {}
    return false;
  }

  function worldClaim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); }
    catch (e) { return null; }
  }
  function repaint() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/fixtures") return;
      foRenderFixturesPage();
    } catch (e) {}
  }

  // ---- friendlies join the card ---------------------------------------------
  // An accepted challenge is a fixture like any other: it has a date, a host
  // and an hour, and after its hour it has a result. The ledger is the same
  // one the Matches page and the bell read; this card only borrows it.
  var FR_MIN = 60;                       // broadcast length, in minutes
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function frDt(t) { var d = new Date(t); return DOW[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()]; }
  function frHH(t) { var d = new Date(t), p = function (n) { return (n < 10 ? "0" : "") + n; }; return p(d.getHours()) + ":" + p(d.getMinutes()); }
  function frPhase(c) {
    var t0 = c && c.play_at ? Date.parse(c.play_at) : NaN;
    if (isNaN(t0)) return null;
    var end = t0 + FR_MIN * 60000, now = Date.now();
    return { t0: t0, phase: now < t0 ? "pre" : now < end ? "live" : "done" };
  }
  function frRows(my) {
    var out = { up: [], done: [] };
    // ---- the world's own friendlies (the friendlies post, migration 009+) --
    // These are the matches the umpire actually plays; the club page files
    // them and this card must show them. One fetch a minute, repaint on land.
    var wRows = frWorld();
    (wRows || []).forEach(function (f) {
      if (!f || (f.status !== "accepted" && f.status !== "played")) return;
      var t0 = +f.playAtMs; if (!(t0 > 0)) return;
      var atHome = !!f.mine;                       // the challenger hosts
      var o = { t0: t0, atHome: atHome, host: f.home,
        opp: atHome ? f.away : f.home, id: f.id, world: true };
      var now = Date.now();
      if (f.status === "played" && f.text) {
        var tx = String(f.text);
        o.tie = /\btied?\b/i.test(tx) && tx.indexOf("won") < 0;
        o.won = !o.tie && tx.lastIndexOf(my, 0) === 0;
        o.text = tx;
        out.done.push(o);
      } else {
        // accepted and waiting, or banked with the broadcast still showing
        // (048 withholds the result line until the last ball) - both are
        // coming cricket as far as this card is concerned
        o.live = now >= t0 && (f.status === "played" || now < t0 + 3 * 3600000);
        out.up.push(o);
      }
    });
    // ---- and the old local ledger, for whatever it still holds -------------
    var rows = window.__foFrAll;
    if (rows === undefined) {
      try { if (window.__foFriendlies && window.__foFriendlies.all) rows = window.__foFriendlies.all(repaint); } catch (e) {}
    }
    (rows || []).forEach(function (c) {
      if (!c || (c.status !== "accepted" && c.status !== "played")) return;
      if (c.challenger_club !== my && c.opponent_club !== my) return;
      var st = frPhase(c); if (!st) return;
      var atHome = c.challenger_club === my;
      var o = { t0: st.t0, atHome: atHome, host: c.challenger_club,
        opp: atHome ? c.opponent_club : c.challenger_club, id: c.id };
      if (st.phase === "done" && c.result) {
        var tx = String(c.result.result_text || "");
        o.tie = /\btied?\b/i.test(tx) && tx.indexOf("won") < 0;
        o.won = !o.tie && tx.lastIndexOf(my, 0) === 0;
        o.text = tx;
        out.done.push(o);
      } else {
        // pre, live, or played-out with the card still being written
        o.live = st.phase === "live";
        o.wait = st.phase === "done";
        out.up.push(o);
      }
    });
    return out;
  }
  // the manager's friendlies off the world post, cached a minute at a time
  var FRW = { rows: null, at: 0, busy: false };
  function frWorld() {
    try {
      var tok = (window.__foJWT && window.__foJWT()) || "";
      if (!tok) return FRW.rows || [];
      if (FRW.busy || (FRW.rows && Date.now() - FRW.at < 60000)) return FRW.rows || [];
      FRW.busy = true;
      var SB = "https://egaipdksvztqqgouriyc.supabase.co";
      var KEY = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
      fetch(SB + "/rest/v1/rpc/world_my_friendlies", {
        method: "POST",
        headers: { apikey: KEY, Authorization: "Bearer " + tok, "content-type": "application/json" },
        body: "{}"
      }).then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) { FRW.rows = Array.isArray(rows) ? rows : []; FRW.at = Date.now(); FRW.busy = false; repaint(); })
        .catch(function () { FRW.busy = false; FRW.rows = FRW.rows || []; });
      return FRW.rows || [];
    } catch (e) { return FRW.rows || []; }
  }

  // ---- the shared furniture -------------------------------------------------
  // one row of the card; every path prints through here so league, cup and
  // friendly all wear the same clothes
  function rowHtml(o) {
    var dtH = "";
    if (o.dt != null) {
      // the relative words wear short jackets: the cell is a date block, not a sentence
      var dt1 = { Tomorrow: "TMRW", Yesterday: "YDAY" }[o.dt] || o.dt;
      var m = /^(\S+)\s+(.+)$/.exec(dt1);
      dtH = "<span class='fo-fl-dt'>" + (m ? "<b>" + E(m[1]) + "</b><i>" + E(m[2]) + "</i>" : "<b class='one'>" + E(dt1) + "</b>") + "</span>";
    }
    return "<a class='fo-fl-row" + (o.cls ? " " + o.cls : "") + (o.dt == null ? " nodt" : "") + "' href='" + o.href + "'>" +
      dtH +
      "<span class='fo-fl-cmp " + (o.cmpCls || "lg") + "'>" + o.cmp + "</span>" +
      "<u class='" + (o.chipCls || "n") + "'>" + o.chip + "</u>" +
      "<span class='fo-fl-who'><b>" + o.name + "</b><span>" + o.sub + "</span></span>" +
      (o.right ? "<em class='fo-fl-" + (o.rightCls || "res") + "'>" + o.right + "</em>" : "") +
      "<s>&#8250;</s></a>";
  }
  function heroHtml(kick, chips, form) {
    return "<div class='fo-fl-hero'>" +
      "<div class='k'>" + kick + "</div>" +
      "<h1>Fixtures &amp; Results</h1>" +
      "<div class='fo-fl-stats'>" + chips +
      (form ? "<span class='fo-fl-form'>" + form + "</span>" : "") + "</div>" +
      "</div>";
  }
  function statChip(n, lbl) { return "<span class='fo-fl-stat'><b>" + n + "</b>" + lbl + "</span>"; }
  function formHtml(letters) {
    return letters.slice(-5).map(function (x) {
      return "<i class='" + (x === "W" ? "w" : x === "L" ? "l" : "t") + "'>" + x + "</i>";
    }).join("");
  }
  function nextCard(u) {
    return "<a class='fo-fl-next" + (u.live ? " live" : "") + "' href='" + u.href + "'>" +
      "<span class='nb'>" +
      "<span class='nk'>" + (u.live ? "<b class='dot'></b>" : "") + u.kick + "</span>" +
      "<span class='nvs'>" + u.name + " <u>" + (u.isHome ? "Home" : "Away") + "</u></span>" +
      "<span class='nw'>" + u.when + "</span></span>" +
      "<span class='ncta'>" + (u.live ? "Watch live &rsaquo;" : "Match preview &rsaquo;") + "</span></a>";
  }

  // ---------------------------------------------------------------------------
  // ONE WORLD. Where a club is held in the served world the card is built from
  // the umpire's own record; the local sim is only the fallback for a device
  // that has never claimed anything.
  // ---------------------------------------------------------------------------
  function servedCard(page, claim) {
    var snap = null, names = null, mgr = null;
    try {
      if (window.__foWorldLg) { window.__foWorldLg.want(claim.country, repaint); snap = window.__foWorldLg.get(claim.country); }
      if (window.__foWorldNames) { window.__foWorldNames.want(claim.country, repaint); names = window.__foWorldNames.get(claim.country); mgr = window.__foWorldNames.mgr(claim.country); }
    } catch (e) {}
    if (!snap || !snap.table || !snap.table.length) return false;
    var allRows = (snap.table || []).concat(snap.table2 || []);
    var bySlot = {}; allRows.forEach(function (r) { bySlot[r.slot] = (names && names[r.slot]) || r.name; });
    var slotByName = {}; allRows.forEach(function (r) { var n2 = bySlot[r.slot]; if (n2 && slotByName[n2] == null) slotByName[n2] = r.slot; });
    var myRow = allRows.filter(function (r) { return r.slot === claim.slot; })[0];
    var my = (myRow && ((names && names[claim.slot]) || myRow.name)) || claim.club;
    var groundOf = function (slot) { return (mgr && mgr["g" + slot]) || ((bySlot[slot] || "the ground") + "'s ground"); };
    var pl0 = null; try { pl0 = window.__foPlanet; } catch (ePl) {}
    var seasonNo = snap.seasonNo || 1;
    var EP = pl0 ? pl0.EPOCH : 0, DAYMS = pl0 ? pl0.DAY : 86400000;
    var tsOfDay = function (d9) { return d9 == null ? 0 : EP + d9 * DAYMS; };
    var dayOf = function (round) {
      try { return pl0 ? pl0.dayOfSeasonRound(seasonNo, round) : null; } catch (eD) { return null; }
    };
    var dayTxt = function (round) {
      try { var d9 = dayOf(round); return (d9 != null && pl0.dateTxt) ? pl0.dateTxt(d9) : ""; } catch (eD) { return ""; }
    };
    var hour = 14; try { hour = pl0 ? pl0.natHour(claim.country) : 14; } catch (eH) {}
    var hhT = ((hour < 10 ? "0" : "") + hour + ":00 UTC");

    // ---- THE CUP IS PART OF THE SUMMER --------------------------------------
    var faBody = null;
    try {
      if (window.__foFaCup && window.__foFaCup.want) {
        var faSync = true;
        window.__foFaCup.want(claim.country, seasonNo, function (b2) {
          faBody = b2 || null;
          if (!faSync) repaint();
        });
        faSync = false;
      }
    } catch (eFa) {}
    var faUps = [], faDone = [];
    try {
      var divs = (snap.divisions) || {};
      var divOf = {};
      (divs["1"] || []).forEach(function (x) { divOf[x] = 1; });
      (divs["2"] || []).forEach(function (x) { divOf[x] = 2; });
      var today0 = pl0 ? pl0.dayIx(Date.now()) : 0;
      ["r16", "qf", "sf", "final"].forEach(function (st) {
        var day = pl0 && pl0.faDayOf ? pl0.faDayOf(seasonNo, st) : null;
        if (day == null) return;
        var servedTies = faBody && faBody.stages && faBody.stages[st];
        if (servedTies && servedTies.length) {
          for (var i = 0; i < servedTies.length; i++) {
            var t = servedTies[i];
            if (!t.a || !t.b) continue;
            if (t.a.slot !== claim.slot && t.b.slot !== claim.slot) continue;
            var atHome = t.a.slot === claim.slot;
            var meNm = atHome ? t.a.name : t.b.name;
            faDone.push({ day: day, st: st, isHome: atHome,
              opp: (atHome ? t.b.name : t.a.name),
              won: !!t.winner && t.winner === meNm, tie: !t.winner,
              text: t.text || "",
              line: (t.as_ && t.bs_) ? (atHome ? t.as_ + " v " + t.bs_ : t.bs_ + " v " + t.as_) : "" });
            break;
          }
          return;                       // this Sunday is history either way
        }
        if (st !== "r16") return;        // the later draws wait on results
        if (day < today0) return;        // its Sunday has gone by unplayed
        var ties = (pl0 && pl0.faDrawR16) ? pl0.faDrawR16(claim.country, seasonNo, null, divOf) : [];
        ties.forEach(function (t2) {
          if (t2[0] !== claim.slot && t2[1] !== claim.slot) return;
          var atHome2 = t2[0] === claim.slot;
          faUps.push({ day: day, st: st, isHome: atHome2, hs: t2[0], as: t2[1],
            opp: bySlot[atHome2 ? t2[1] : t2[0]] || "a club", ground: groundOf(t2[0]) });
        });
      });
    } catch (eFa2) {}

    // ---- the friendlies my club has agreed to -------------------------------
    var fr = frRows(my);
    var frGround = function (host) {
      var s9 = slotByName[host];
      return s9 != null ? groundOf(s9) : host + "'s ground";
    };

    // ---- everything already played, one chronology --------------------------
    var played = (snap.results || []).filter(function (r) { return r.home === my || r.away === my; })
      .sort(function (a, b) { return (a.round || 0) - (b.round || 0); });
    var w = 0, l = 0, t = 0;
    played.forEach(function (r) {
      if (r.winner === null) t++; else if (r.winner === my) w++; else l++;
    });
    var resItems = [];
    played.forEach(function (r) {
      var homeGame = r.home === my, opp = homeGame ? r.away : r.home;
      var won = r.winner === my, tie = r.winner === null;
      var sc = homeGame ? r.hs : r.as, oc = homeGame ? r.as : r.hs;
      var line = sc && oc ? (sc.r + "/" + sc.w + " v " + oc.r + "/" + oc.w) : (r.text || "");
      resItems.push({ ts: tsOfDay(dayOf(r.round)), lt: won ? "W" : tie ? "T" : "L",
        html: rowHtml({ href: r.id ? "#/report?n=" + encodeURIComponent(claim.country) + "&w=" + encodeURIComponent(r.id) : "#/league?t=results&r=" + r.round, dt: dayTxt(r.round),
          cmp: "R" + r.round, cmpCls: "lg", chip: won ? "W" : tie ? "T" : "L", chipCls: won ? "w" : tie ? "t" : "l",
          name: (homeGame ? "v " : "at ") + E(opp), sub: E(line),
          right: E((r.text || "").replace(/\s*\(.*\)$/, "")) }) });
    });
    faDone.forEach(function (f) {
      resItems.push({ ts: tsOfDay(f.day), lt: f.won ? "W" : f.tie ? "T" : "L",
        html: rowHtml({ href: "#/facup", dt: (pl0 && pl0.dateTxt) ? pl0.dateTxt(f.day) : "",
          cmp: "CUP", cmpCls: "cup", chip: f.won ? "W" : f.tie ? "T" : "L", chipCls: f.won ? "w" : f.tie ? "t" : "l",
          name: (f.isHome ? "v " : "at ") + E(f.opp),
          sub: E(FA_NM[f.st] || "The Cup") + (f.line ? " &middot; " + E(f.line) : ""),
          right: E((f.text || "").replace(/\s*\(.*\)$/, "")) }) });
    });
    fr.done.forEach(function (f) {
      resItems.push({ ts: f.t0, lt: f.won ? "W" : f.tie ? "T" : "L", fr: true,
        html: rowHtml({ href: (f.world ? "#/feed?fr=" : "#/friendly?id=") + f.id, dt: frDt(f.t0),
          cmp: "FR", cmpCls: "fr", chip: f.won ? "W" : f.tie ? "T" : "L", chipCls: f.won ? "w" : f.tie ? "t" : "l",
          name: (f.atHome ? "v " : "at ") + E(f.opp),
          sub: "Friendly &middot; " + frHH(f.t0),
          right: E((f.text || "").replace(/\s*\(.*\)$/, "")) }) });
    });
    resItems.sort(function (a, b) { return a.ts - b.ts; });
    var resRows = resItems.map(function (x) { return x.html; }).join("");
    // the form strip beside the league record: competitive cricket only -
    // friendlies sit in the results list below but never colour the form
    var form = formHtml(resItems.filter(function (x) { return !x.fr; })
      .map(function (x) { return x.lt; }));

    // ---- what is still to come, off the umpire's own schedule ---------------
    var upItems = [];
    try {
      var wt = window.__foWT;
      if (wt && wt.schedMirror && pl0) {
        var sched = wt.schedMirror(claim.country, seasonNo);
        for (var r3 = (snap.roundsPlayed || 0); r3 < sched.length; r3++) {
          (sched[r3] || []).forEach(function (f) {
            if (f[0] !== claim.slot && f[1] !== claim.slot) return;
            var isHome = f[0] === claim.slot;
            var d9 = pl0.dayOfSeasonRound(seasonNo, r3 + 1);
            var opp = bySlot[isHome ? f[1] : f[0]] || "a club";
            var pv = "#/league?t=fixtures";
            try { pv = window.foPreviewHref(claim.country, r3 + 1, f[0], f[1]) || pv; } catch (ePv) {}
            upItems.push({ ts: tsOfDay(d9) + hour * 3600000, href: pv, isHome: isHome,
              kick: "Up next &middot; League &middot; Round " + (r3 + 1),
              name: (isHome ? "v " : "at ") + E(opp),
              when: E((pl0.dateTxt ? pl0.dateTxt(d9) : "") + " · " + hhT + " · " + groundOf(f[0])),
              html: rowHtml({ href: pv, dt: pl0.dateTxt ? pl0.dateTxt(d9) : "",
                cmp: "R" + (r3 + 1), cmpCls: "lg", chip: isHome ? "H" : "A", chipCls: "n", cls: "up",
                name: (isHome ? "v " : "at ") + E(opp),
                sub: E(hhT) + " &middot; " + E(groundOf(f[0])),
                right: "Preview &rsaquo;", rightCls: "act" }) });
          });
        }
      }
    } catch (eU) {}
    faUps.forEach(function (f) {
      var cv = "#/facup";
      try { cv = window.foCupPreviewHref(claim.country, f.st, f.hs, f.as) || cv; } catch (eCv) {}
      upItems.push({ ts: tsOfDay(f.day) + hour * 3600000, href: cv, isHome: f.isHome,
        kick: "Up next &middot; National Cup &middot; " + (FA_NM[f.st] || "The Cup"),
        name: (f.isHome ? "v " : "at ") + E(f.opp),
        when: E(((pl0 && pl0.dateTxt) ? pl0.dateTxt(f.day) : "") + " · " + hhT + " · " + f.ground),
        html: rowHtml({ href: cv, dt: (pl0 && pl0.dateTxt) ? pl0.dateTxt(f.day) : "",
          cmp: "CUP", cmpCls: "cup", chip: f.isHome ? "H" : "A", chipCls: "c", cls: "up",
          name: (f.isHome ? "v " : "at ") + E(f.opp),
          sub: E(hhT) + " &middot; " + E(f.ground) + " &middot; " + E(FA_NM[f.st] || "The Cup"),
          right: "Preview &rsaquo;", rightCls: "act" }) });
    });
    fr.up.forEach(function (f) {
      var href = (f.world ? "#/feed?fr=" : "#/friendly?id=") + f.id;
      var gr = frGround(f.host);
      upItems.push({ ts: f.t0, href: href, isHome: f.atHome, live: f.live,
        kick: f.live ? "Live now &middot; Friendly" : "Up next &middot; Friendly",
        name: (f.atHome ? "v " : "at ") + E(f.opp),
        when: E(frDt(f.t0) + " · " + frHH(f.t0) + " · " + gr),
        html: rowHtml({ href: href, dt: frDt(f.t0),
          cmp: "FR", cmpCls: "fr", chip: f.live ? "&#9679;" : f.atHome ? "H" : "A",
          chipCls: f.live ? "lv" : "f", cls: f.live ? "up live" : "up",
          name: (f.atHome ? "v " : "at ") + E(f.opp),
          sub: f.live ? "LIVE &middot; ball by ball now"
            : f.wait ? "full time &middot; waiting on the league engine"
            : E(frHH(f.t0)) + " &middot; " + E(gr) + " &middot; Friendly",
          right: f.live ? "Watch &rsaquo;" : "Preview &rsaquo;", rightCls: "act" }) });
    });
    upItems.sort(function (a, b) { return a.ts - b.ts; });
    var upRows = upItems.map(function (x) { return x.html; }).join("");
    if (!upItems.length) upRows = "<div class='fo-fl-none'>The season is played out. Awards night awaits.</div>";
    var live0 = upItems.filter(function (x) { return x.live; })[0];
    var feature = upItems.length ? nextCard(live0 || upItems[0]) : "";

    var divNm = "";
    try {
      var dv2 = snap.divisions || {};
      if ((dv2["1"] || []).indexOf(claim.slot) >= 0) divNm = "Division One";
      else if ((dv2["2"] || []).indexOf(claim.slot) >= 0) divNm = "Division Two";
    } catch (eDv) {}
    var rounds = snap.rounds || 14;
    var chips = statChip(played.length + "<span>/" + rounds + "</span>", "played") +
      statChip(w, "won") + (t ? statChip(t, "tied") : "") + statChip(l, "lost");

    page.innerHTML =
      "<div class='fo-fl'>" +
      heroHtml(E(my) + (divNm ? " &middot; " + divNm : "") + " &middot; Season " + seasonNo, chips, form) +
      feature +
      (resRows ? "<div class='fo-fl-k'>Results</div><div class='fo-fl-list'>" + resRows + "</div>" : "") +
      "<div class='fo-fl-k'>Still to play</div><div class='fo-fl-list'>" + upRows + "</div>" +
      "" +
      "</div>";
    return true;
  }

  function foRenderFixturesPage() {
    try {
      if (!ready()) return;
      var page = document.getElementById("page"); if (!page) return;
      var me = null; try { me = userTeam(); } catch (e) {}
      if (!me) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on");
      var cl = worldClaim();
      if (cl && cl.country && cl.slot != null && servedCard(page, cl)) return;
      document.body.classList.remove("fo-scb-on", "fo-drs-on");
      try { if (typeof seasonInit === "function") seasonInit(); } catch (eS) {}
      var S = App.season;
      var my = me.name;
      var fr = frRows(my);

      // ---- what has been played ----
      var played = (App.results || []).filter(function (r) {
        return r && r.comp === "league" && r.result && (r.home === my || r.away === my) && thisSeasonHas(r);
      }).sort(function (a, b) { return (a.round || 0) - (b.round || 0); });
      var w = 0, l = 0, t = 0, letters = [];
      played.forEach(function (r) {
        if (!r.result || r.result.winner === undefined) return;
        if (r.result.winner === my) { w++; letters.push("W"); }
        else if (r.result.winner === null) { t++; letters.push("T"); }
        else { l++; letters.push("L"); }
      });
      var resRows = played.map(function (r) {
        var homeGame = r.home === my;
        var opp = homeGame ? r.away : r.home;
        var won = r.result.winner === my, tie = r.result.winner === null;
        var live = /LIVE/.test(r.result.text || "") || r.result.winner === undefined;
        return rowHtml({ href: "#/report?i=" + r.ix, dt: null,
          cmp: "R" + ((r.round | 0) + 1), cmpCls: "lg",
          chip: live ? "&#9679;" : won ? "W" : tie ? "T" : "L",
          chipCls: live ? "lv" : won ? "w" : tie ? "t" : "l",
          name: (homeGame ? "v " : "at ") + E(opp), sub: E(r.ground || ""),
          right: E((r.result.text || "").replace(/\s*\(.*\)$/, "")) });
      }).join("");
      fr.done.sort(function (a, b) { return a.t0 - b.t0; }).forEach(function (f) {
        resRows += rowHtml({ href: (f.world ? "#/feed?fr=" : "#/friendly?id=") + f.id, dt: frDt(f.t0),
          cmp: "FR", cmpCls: "fr", chip: f.won ? "W" : f.tie ? "T" : "L", chipCls: f.won ? "w" : f.tie ? "t" : "l",
          name: (f.atHome ? "v " : "at ") + E(f.opp),
          sub: "Friendly &middot; " + frHH(f.t0),
          right: E((f.text || "").replace(/\s*\(.*\)$/, "")) });
      });

      // ---- what is still to come ----
      var upRows = "", feature = "", ups = [];
      if (S && S.schedule) {
        for (var r2 = S.round; r2 < S.schedule.length; r2++) {
          (S.schedule[r2] || []).forEach(function (f) {
            if (f[0] !== App.teamIx && f[1] !== App.teamIx) return;
            try { if (S.played && S.played[fixtureKey(r2, f)] !== undefined) return; } catch (eK) {}
            var home = GD.teams[f[0]], away = GD.teams[f[1]];
            ups.push({
              r: r2, isHome: f[0] === App.teamIx,
              opp: f[0] === App.teamIx ? away : home,
              ground: home.ground,
              pitch: (typeof groundPitch === "function") ? groundPitch(home.ground) : "",
              wx: (typeof WXLIST !== "undefined") ? WXLIST[(r2 * 7 + f[0] * 3) % WXLIST.length] : ""
            });
          });
        }
      }
      // league rounds and friendlies share one clock: each round has its real
      // hour on the calendar, so the two sorts of engagement interleave in the
      // order they will actually be played
      var upItems = ups.map(function (u) {
        var when = "", ts = null;
        try { if (typeof window.foRoundTimeTxt === "function") when = window.foRoundTimeTxt(u.r) || ""; } catch (eW) {}
        try { if (typeof window.foRoundTime === "function") ts = window.foRoundTime(u.r); } catch (eT) {}
        // the row goes to the match preview, not to the retired Matchday room,
        // and its right-hand cell carries the start time rather than a button:
        // a list of twenty fixtures with twenty identical buttons on it is a
        // column of orange, not a fixture list
        var pvU = "#/fixtures";
        try { pvU = window.foPreviewHref ? (window.foPreviewHref(null, u.r + 1) || pvU) : pvU; } catch (ePv2) {}
        return { ts: ts != null ? ts : Date.now() + (u.r + 1) * 86400000,
          html: rowHtml({ href: pvU, dt: null,
            cmp: "R" + (u.r + 1), cmpCls: "lg", chip: u.isHome ? "H" : "A", chipCls: "n", cls: "up",
            name: (u.isHome ? "v " : "at ") + E(u.opp.name),
            // the when belongs in one place. It was printed in the detail line
            // AND again on the right, so every row said its date twice; the
            // right-hand column owns it and the detail line carries the
            // conditions - where, what surface, what sky.
            sub: E(u.ground) + " &middot; " + E(PITCH_NM[u.pitch] || u.pitch) + " pitch &middot; " + E(u.wx),
            right: when ? E(when) : "", rightCls: "time" }) };
      });
      fr.up.forEach(function (f) {
        upItems.push({ ts: f.t0,
          html: rowHtml({ href: (f.world ? "#/feed?fr=" : "#/friendly?id=") + f.id, dt: frDt(f.t0),
            cmp: "FR", cmpCls: "fr", chip: f.live ? "&#9679;" : f.atHome ? "H" : "A",
            chipCls: f.live ? "lv" : "f", cls: f.live ? "up live" : "up",
            name: (f.atHome ? "v " : "at ") + E(f.opp),
            sub: f.live ? "LIVE &middot; ball by ball now"
              : f.wait ? "full time &middot; waiting on the league engine"
              : E(frHH(f.t0)) + " &middot; Friendly",
            right: f.live ? "Watch &rsaquo;" : "Preview &rsaquo;", rightCls: "act" }) });
      });
      upItems.sort(function (a, b) { return a.ts - b.ts; });
      upRows = upItems.map(function (x) { return x.html; }).join("");
      if (!upRows) upRows = "<div class='fo-fl-none'>The season is played out. Awards night awaits.</div>";
      // the next engagement up in lights: a live friendly outranks everything
      var frLive = fr.up.filter(function (f) { return f.live; })[0];
      if (frLive) {
        feature = nextCard({ href: (frLive.world ? "#/feed?fr=" : "#/friendly?id=") + frLive.id, isHome: frLive.atHome, live: true,
          kick: "Live now &middot; Friendly", name: (frLive.atHome ? "v " : "at ") + E(frLive.opp),
          when: E(frDt(frLive.t0) + " · " + frHH(frLive.t0)) });
      } else {
        var u0 = ups[0], f0 = fr.up.slice().sort(function (a, b) { return a.t0 - b.t0; })[0];
        var uTs = null;
        try { if (u0 && typeof window.foRoundTime === "function") uTs = window.foRoundTime(u0.r); } catch (eT0) {}
        // whichever engagement comes first on the clock gets the lights
        if (u0 && (!f0 || (uTs != null && uTs <= f0.t0))) {
          var when0 = "";
          try { if (typeof window.foRoundTimeTxt === "function") when0 = window.foRoundTimeTxt(u0.r) || ""; } catch (eW0) {}
          feature = nextCard({ href: "#/matchday?r=" + u0.r, isHome: u0.isHome,
            kick: "Up next &middot; League &middot; Round " + (u0.r + 1),
            name: (u0.isHome ? "v " : "at ") + E(u0.opp.name),
            when: E((when0 ? when0 + " · " : "") + u0.ground) });
        } else if (f0) {
          feature = nextCard({ href: (f0.world ? "#/feed?fr=" : "#/friendly?id=") + f0.id, isHome: f0.atHome,
            kick: "Up next &middot; Friendly", name: (f0.atHome ? "v " : "at ") + E(f0.opp),
            when: E(frDt(f0.t0) + " · " + frHH(f0.t0)) });
        }
      }

      var chips = statChip(played.length + "<span>/" + (S && S.schedule ? S.schedule.length : 18) + "</span>", "played") +
        statChip(w, "won") + (t ? statChip(t, "tied") : "") + statChip(l, "lost");
      page.innerHTML =
        "<div class='fo-fl'>" +
        heroHtml(E(my) + " &middot; Season " + (App.seasonNo || 1), chips, formHtml(letters)) +
        feature +
        (resRows ? "<div class='fo-fl-k'>Results</div><div class='fo-fl-list'>" + resRows + "</div>" : "") +
        "<div class='fo-fl-k'>Still to play</div><div class='fo-fl-list'>" + upRows + "</div>" +
        "<div class='fo-fl-foot'><a href='#/home'>&#8592; The club</a><a href='#/scorecard'>Match centre &rsaquo;</a><a href='#/cup'>The cup &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderFixturesPage", e); } catch (e2) {} }
  }

  // a Fixtures pill in the masthead, beside League where a coach would look
  function ensureNavLink() {
    try {
      var wrap = document.querySelector("#topbar .fo-nav-scroll"); if (!wrap) return;
      var a = wrap.querySelector("a.fo-fixtures");
      if (!a) {
        a = document.createElement("a"); a.className = "fo-fixtures"; a.href = "#/fixtures"; a.textContent = "Fixtures";
        a.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = "#/fixtures"; if (typeof window.route === "function") window.route(); });
        var lg = wrap.querySelector("a.fo-lg-nav") || wrap.querySelector("a[data-nav='squad']");
        if (lg && lg.nextSibling) wrap.insertBefore(a, lg.nextSibling); else wrap.appendChild(a);
      }
      a.classList.toggle("on", (location.hash || "").split("?")[0] === "#/fixtures");
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(ensureNavLink, 90); });

  var CSS = [
    // A RESULTS SERVICE, NOT A LETTER. Eighteen fixtures set in a 760px column
    // on a 1440px screen is a ribbon of cards down the middle of an empty page,
    // and every row wraps its detail line because there is nowhere to put it.
    // The page runs wide and the rows read as a table: fixed columns, aligned
    // dates, the opponent in one place on every line.
    "html body #page .fo-fl{max-width:1120px;margin:22px auto 44px;padding:0 18px;color:#141C28}",
    // ---- the masthead: navy, gold eyebrow, the record worn like a scorebug --
    "html body #page .fo-fl-hero{position:relative;overflow:hidden;background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(11,29,51,.38)}",
    "html body #page .fo-fl-hero:before{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 85% -10%,rgba(235,194,113,.14),transparent 55%);pointer-events:none}",
    "html body #page .fo-fl-hero .k{position:relative;font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;color:#EBC271}",
    "html body #page .fo-fl-hero h1{position:relative;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:40px;letter-spacing:-.015em;margin:7px 0 16px;color:#FFFEFC;line-height:1.02}",
    "html body #page .fo-fl-stats{position:relative;display:flex;gap:8px;flex-wrap:wrap;align-items:stretch}",
    "html body #page .fo-fl-stat{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:8px 13px 7px;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,239,228,.62)}",
    "html body #page .fo-fl-stat b{display:block;font:700 17px/1 Inter,sans-serif;letter-spacing:0;color:#FFFEFC;font-variant-numeric:tabular-nums;margin-bottom:4px}",
    "html body #page .fo-fl-stat b span{font-size:11px;font-weight:600;color:rgba(244,239,228,.55)}",
    "html body #page .fo-fl-form{display:flex;gap:5px;margin-left:auto;align-self:center}",
    "html body #page .fo-fl-form i{width:23px;height:23px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:800 10.5px/1 Inter,sans-serif;font-style:normal;color:#FFFEFC}",
    "html body #page .fo-fl-form i.w{background:#1F9E72}",
    "html body #page .fo-fl-form i.l{background:#C0392E}",
    "html body #page .fo-fl-form i.t{background:rgba(255,255,255,.24)}",
    // ---- the next engagement, up in lights ----------------------------------
    "html body #page a.fo-fl-next{display:flex;align-items:center;gap:16px;background:#FFFEFC;border:1px solid rgba(201,85,50,.42);border-left:5px solid #C95532;border-radius:16px;padding:15px 18px;margin-top:14px;text-decoration:none;color:#141C28;box-shadow:0 14px 34px rgba(201,85,50,.13);transition:transform .12s ease}",
    "html body #page a.fo-fl-next:hover{transform:translateY(-1px);text-decoration:none}",
    "html body #page .fo-fl-next .nb{min-width:0}",
    "html body #page .fo-fl-next .nk{display:flex;align-items:center;gap:6px;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-fl-next .nk .dot{width:7px;height:7px;border-radius:50%;background:#C22823;animation:foFlPulse 1.2s infinite}",
    "@keyframes foFlPulse{0%,100%{opacity:1}50%{opacity:.35}}",
    "html body #page .fo-fl-next .nvs{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:24px;line-height:1.1;margin:5px 0 5px;color:#141C28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-next .nvs u{text-decoration:none;display:inline-block;vertical-align:3px;font:700 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#14202F;background:rgba(20,28,40,.08);border:1px solid rgba(20,28,40,.16);border-radius:6px;padding:4px 7px;margin-left:6px}",
    "html body #page .fo-fl-next .nw{display:block;font:400 12px/1.4 Inter,sans-serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-fl-next .ncta{margin-left:auto;background:#C95532;color:#FFFEFC;border-radius:999px;padding:10px 16px;font:700 12px/1 Inter,sans-serif;white-space:nowrap}",
    "html body #page a.fo-fl-next:hover .ncta{background:#A64426}",
    "html body #page a.fo-fl-next.live{border-color:rgba(194,40,35,.5);border-left-color:#C22823;box-shadow:0 14px 34px rgba(194,40,35,.14)}",
    "html body #page a.fo-fl-next.live .nk{color:#C22823}",
    "html body #page a.fo-fl-next.live .ncta{background:#C22823}",
    // ---- section kickers ----------------------------------------------------
    "html body #page .fo-fl-k{display:flex;align-items:center;gap:12px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#0E2246;margin:26px 2px 9px}",
    "html body #page .fo-fl-k:after{content:'';flex:1;border-top:1px solid rgba(20,28,40,.14)}",
    // ---- the rows: date block, competition pill, verdict, the match ---------
    "html body #page .fo-fl-list{display:flex;flex-direction:column;gap:0;background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-radius:14px;overflow:hidden;box-shadow:0 6px 20px rgba(30,38,52,.055)}",
    "html body #page .fo-fl-row{display:grid;grid-template-columns:74px 44px 26px minmax(0,1fr) minmax(0,auto) 14px;gap:14px;align-items:center;background:transparent;border:0;border-top:1px solid rgba(20,28,40,.08);border-radius:0;padding:11px 18px;text-decoration:none;color:#141C28;box-shadow:none;transition:background .13s ease}",
    "html body #page .fo-fl-list>.fo-fl-row:first-child{border-top:0}",
    "html body #page .fo-fl-row.nodt{grid-template-columns:44px 26px minmax(0,1fr) minmax(0,auto) 14px}",
    // the accent lives in a rule down the left edge on hover, so a pointer
    // moving through eighteen rows does not make the whole page jump
    "html body #page a.fo-fl-row{position:relative}",
    "html body #page a.fo-fl-row:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:#C95532;opacity:0;transition:opacity .13s ease}",
    "html body #page a.fo-fl-row:hover{background:rgba(201,85,50,.045);text-decoration:none}",
    "html body #page a.fo-fl-row:hover:before{opacity:1}",
    "html body #page .fo-fl-row.live{border-color:rgba(194,40,35,.45)}",
    "html body #page .fo-fl-dt{display:flex;flex-direction:column;gap:2px;min-width:0}",
    "html body #page .fo-fl-dt b{font:700 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
    "html body #page .fo-fl-dt i{font:600 11px/1 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.72);font-variant-numeric:tabular-nums;white-space:nowrap}",
    "html body #page .fo-fl-dt b.one{font-size:9.5px;color:#B44A22;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-cmp{display:inline-flex;align-items:center;justify-content:center;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.08em;border-radius:7px;padding:5px 0;text-transform:uppercase}",
    "html body #page .fo-fl-cmp.lg{background:rgba(14,35,63,.08);color:#28415F;border:1px solid rgba(14,35,63,.16)}",
    "html body #page .fo-fl-cmp.cup{background:rgba(176,132,9,.12);color:#8A6A1F;border:1px solid rgba(176,132,9,.32)}",
    "html body #page .fo-fl-cmp.fr{background:rgba(201,85,50,.1);color:#B44A22;border:1px solid rgba(201,85,50,.3)}",
    "html body #page .fo-fl-row u{width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font:800 11px/1 Inter,sans-serif;text-decoration:none}",
    "html body #page .fo-fl-row u.w{background:rgba(31,158,114,.14);color:#177A57;border:1px solid rgba(31,158,114,.4)}",
    "html body #page .fo-fl-row u.l{background:rgba(200,60,58,.1);color:#B23230;border:1px solid rgba(200,60,58,.35)}",
    "html body #page .fo-fl-row u.t{background:rgba(20,28,40,.07);color:rgba(20,28,40,.6);border:1px solid rgba(20,28,40,.2)}",
    "html body #page .fo-fl-row u.lv{background:rgba(229,57,53,.1);color:#C22823;border:1px solid rgba(229,57,53,.4);font-size:8px}",
    "html body #page .fo-fl-row u.n{background:rgba(20,28,40,.05);color:rgba(20,28,40,.55);border:1px solid rgba(20,28,40,.15)}",
    "html body #page .fo-fl-row u.c{background:rgba(176,132,9,.14);color:#8A6A1F;border:1px solid rgba(176,132,9,.4)}",
    "html body #page .fo-fl-row u.f{background:rgba(201,85,50,.12);color:#B44A22;border:1px solid rgba(201,85,50,.35)}",
    "html body #page .fo-fl-who{min-width:0}",
    "html body #page .fo-fl-who b{display:block;font:600 13.5px/1.25 Inter,sans-serif;color:#141C28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-who>span{display:block;font:400 11px/1.35 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-row.live .fo-fl-who>span{color:#C22823;font-weight:600}",
    "html body #page .fo-fl-res{font:italic 400 12px/1.35 Georgia,serif;color:rgba(20,28,40,.6);text-align:right;white-space:nowrap}",
    "html body #page .fo-fl-row s{text-decoration:none;color:rgba(20,28,40,.35)}",
    // WHAT USED TO BE A BUTTON IS NOW A TIME. Every upcoming row carried an
    // identical orange pill, which made a fixture list read as a column of
    // buttons with some cricket behind it. The row itself is the link.
    "html body #page .fo-fl-time{font:600 12px/1 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.62);font-variant-numeric:tabular-nums;white-space:nowrap;text-align:right}",
    "html body #page .fo-fl-row.live .fo-fl-time{color:#C22823;font-weight:700}",
    "html body #page .fo-fl-none{background:#FFFEFC;border:1px dashed rgba(20,28,40,.2);border-radius:14px;padding:22px;text-align:center;font:italic 400 13px/1.5 Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-fl-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-fl-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-fl-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:560px){" +
      "html body #page .fo-fl-hero{padding:20px 18px 18px}" +
      "html body #page .fo-fl-hero h1{font-size:30px;margin-bottom:12px}" +
      "html body #page .fo-fl-form{width:100%;margin-left:0}" +
      "html body #page .fo-fl-next{flex-wrap:wrap;gap:10px}" +
      "html body #page .fo-fl-next .nvs{font-size:20px;white-space:normal}" +
      "html body #page .fo-fl-res,html body #page .fo-fl-act{display:none}" +
      "html body #page .fo-fl-row{grid-template-columns:44px 34px 24px minmax(0,1fr) 12px;gap:8px;padding:10px 12px}" +
      "html body #page .fo-fl-row.nodt{grid-template-columns:34px 24px minmax(0,1fr) 12px}" +
    "}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-fl-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-fl-css"; s.textContent = CSS; }
      document.body.appendChild(s);
      ensureNavLink();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);

  window.foRenderFixturesPage = foRenderFixturesPage;
  window.__foFixtureList = 1;
})();
