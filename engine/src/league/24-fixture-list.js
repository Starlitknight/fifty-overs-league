// ---- 24-fixture-list.js — The Fixture List -----------------------------------
// The season, laid out like the card on the pavilion noticeboard: every match
// already played (each one a door to its report) and every match still to
// come, with venue, forecast pitch and weather - all read from the shared
// season state, so every client prints the identical card.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  var PITCH_NM = { balanced: "True", flat: "Flat", green: "Green", dry: "Dry", slow: "Slow", cracked: "Cracked", twoPaced: "Two-paced" };
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


  // ---------------------------------------------------------------------------
  // ONE WORLD. This card used to read App.season and App.results - the
  // retired local sim - so a manager whose served season had played ONE round
  // was shown four, against a mix of counties and another manager's club, at
  // grounds called Neutral Park. Every one of those matches was a ghost.
  // Where a club is held in the served world the card is built from the
  // umpire's own record instead, and the local sim is only the fallback for a
  // device that has never claimed anything.
  // ---------------------------------------------------------------------------
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
  function servedCard(page, claim) {
    var snap = null, names = null, mgr = null;
    try {
      if (window.__foWorldLg) { window.__foWorldLg.want(claim.country, repaint); snap = window.__foWorldLg.get(claim.country); }
      if (window.__foWorldNames) { window.__foWorldNames.want(claim.country, repaint); names = window.__foWorldNames.get(claim.country); mgr = window.__foWorldNames.mgr(claim.country); }
    } catch (e) {}
    if (!snap || !snap.table || !snap.table.length) return false;
    // BOTH FLIGHTS, OR NOBODY HAS A NAME. The register was read off table
    // alone - Division One - so a Division Two club's whole card said "at a
    // club" and "v a club": its opponents were all in table2, and every one of
    // them came back undefined.
    var allRows = (snap.table || []).concat(snap.table2 || []);
    var bySlot = {}; allRows.forEach(function (r) { bySlot[r.slot] = (names && names[r.slot]) || r.name; });
    var myRow = allRows.filter(function (r) { return r.slot === claim.slot; })[0];
    var my = (myRow && ((names && names[claim.slot]) || myRow.name)) || claim.club;
    var groundOf = function (slot) { return (mgr && mgr["g" + slot]) || ((bySlot[slot] || "the ground") + "'s ground"); };
    // WHEN, NOT JUST AT WHAT HOUR. Every row on this card - played or still to
    // come - carries the day it belongs to, off the world's own calendar.
    var pl0 = null; try { pl0 = window.__foPlanet; } catch (ePl) {}
    var seasonNo = snap.seasonNo || 1;
    var dayTxt = function (round) {
      try { return (pl0 && pl0.dateTxt) ? pl0.dateTxt(pl0.dayOfSeasonRound(seasonNo, round)) : ""; } catch (eD) { return ""; }
    };

    // ---- THE CUP IS PART OF THE SUMMER --------------------------------------
    // This card listed the league and nothing else, so four Sundays of national
    // knockout - the ones a small club's season is really made of - appeared
    // nowhere a manager looks. The Round of 16 is drawn the day the season
    // opens, off nothing but the nation and the season, so the tie is knowable
    // before a ball is bowled; the later rounds turn on results and are named
    // as the world plays them.
    var FA_NM = { r16: "Round of 16", qf: "Quarter-final", sf: "Semi-final", final: "The final" };
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
    // my club's tie at each stage: played ones off the served bracket, the
    // opening round off the draw itself
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

    var played = (snap.results || []).filter(function (r) { return r.home === my || r.away === my; })
      .sort(function (a, b) { return (a.round || 0) - (b.round || 0); });
    var w = 0, l = 0, t = 0;
    played.forEach(function (r) {
      if (r.winner === null) t++; else if (r.winner === my) w++; else l++;
    });
    var resRows = played.map(function (r) {
      var homeGame = r.home === my, opp = homeGame ? r.away : r.home;
      var won = r.winner === my, tie = r.winner === null;
      var sc = homeGame ? r.hs : r.as, oc = homeGame ? r.as : r.hs;
      var line = sc && oc ? (sc.r + "/" + sc.w + " v " + oc.r + "/" + oc.w) : (r.text || "");
      var on = dayTxt(r.round);
      return "<a class='fo-fl-row' href='#/league?t=results&r=" + r.round + "'>" +
        "<i>R" + r.round + "</i>" +
        "<u class='" + (won ? "w" : tie ? "t" : "l") + "'>" + (won ? "W" : tie ? "T" : "L") + "</u>" +
        "<span class='fo-fl-who'><b>" + (homeGame ? "v " : "at ") + E(opp) +
        (on ? " <em class='fo-fl-when done'>" + E(on) + "</em>" : "") + "</b>" +
        "<span>" + E(line) + "</span></span>" +
        "<em class='fo-fl-res'>" + E((r.text || "").replace(/\s*\(.*\)$/, "")) + "</em><s>&#8250;</s></a>";
    }).join("");
    // the cup ties already played, in the same list as the league's
    resRows += faDone.sort(function (a2, b2) { return a2.day - b2.day; }).map(function (f) {
      var on = (pl0 && pl0.dateTxt) ? pl0.dateTxt(f.day) : "";
      return "<a class='fo-fl-row cup' href='#/facup'>" +
        "<i>CUP</i>" +
        "<u class='" + (f.won ? "w" : f.tie ? "t" : "l") + "'>" + (f.won ? "W" : f.tie ? "T" : "L") + "</u>" +
        "<span class='fo-fl-who'><b>" + (f.isHome ? "v " : "at ") + E(f.opp) +
        (on ? " <em class='fo-fl-when done'>" + E(on) + "</em>" : "") + "</b>" +
        "<span>" + E(FA_NM[f.st] || "The Cup") + (f.line ? " &middot; " + E(f.line) : "") + "</span></span>" +
        "<em class='fo-fl-res'>" + E((f.text || "").replace(/\s*\(.*\)$/, "")) + "</em><s>&#8250;</s></a>";
    }).join("");

    // what is still to come, off the umpire's own schedule
    var upRows = "", rounds = snap.rounds || 14;
    try {
      var wt = window.__foWT, pl = window.__foPlanet;
      if (wt && wt.schedMirror && pl) {
        var sched = wt.schedMirror(claim.country, snap.seasonNo || 1);
        var hour = pl.natHour(claim.country);
        var hh = function (h) { return (h < 10 ? "0" : "") + h + ":00 UTC"; };
        var ups = [];
        for (var r3 = (snap.roundsPlayed || 0); r3 < sched.length; r3++) {
          (sched[r3] || []).forEach(function (f) {
            if (f[0] !== claim.slot && f[1] !== claim.slot) return;
            var isHome = f[0] === claim.slot;
            ups.push({ day: pl.dayOfSeasonRound(seasonNo, r3 + 1), r: r3 + 1, isHome: isHome,
              opp: bySlot[isHome ? f[1] : f[0]] || "a club",
              ground: groundOf(f[0]), hs: f[0], as: f[1] });
          });
        }
        // ONE SUMMER, ONE LIST. League Thursday, cup Sunday, league Monday -
        // the card reads in the order the matches are actually played.
        faUps.forEach(function (f) { ups.push({ day: f.day, cup: f.st, isHome: f.isHome, opp: f.opp, ground: f.ground, hs: f.hs, as: f.as }); });
        ups.sort(function (x, y) { return (x.day || 0) - (y.day || 0); });
        // A COMING MATCH NOW HAS SOMEWHERE TO GO. These rows used to land on
        // the round's fixture card - the same list, one level up, which told
        // the reader nothing he had not just tapped. Each one opens its own
        // match now: the ground, the hour, both sides' form, the men.
        upRows = ups.map(function (u, i) {
          // the day above, in the chip beside the opponent; the hour below,
          // where the ground is - so a long date never squeezes out a name
          var on = (pl0 && pl0.dateTxt) ? pl0.dateTxt(u.day) : "";
          if (u.cup) {
            // a cup tie opens its own build-up, exactly as a league match does
            var cv = "#/facup";
            try { cv = window.foCupPreviewHref(claim.country, u.cup, u.hs, u.as) || cv; } catch (eCv) {}
            return "<a class='fo-fl-row up cup" + (i === 0 ? " next" : "") + "' href='" + cv + "'>" +
              "<i>CUP</i>" +
              "<u class='c'>" + (u.isHome ? "H" : "A") + "</u>" +
              "<span class='fo-fl-who'><b>" + (u.isHome ? "v " : "at ") + E(u.opp) +
              (on ? " <em class='fo-fl-when'>" + E(on) + "</em>" : "") + "</b>" +
              "<span>" + E(hh(hour)) + " &middot; " + E(u.ground) + " &middot; " + E(FA_NM[u.cup] || "The Cup") + "</span></span>" +
              "<em class='fo-fl-act'>Preview &rsaquo;</em></a>";
          }
          var pv = "#/league?t=fixtures";
          try { pv = window.foPreviewHref(claim.country, u.r, u.hs, u.as) || pv; } catch (ePv) {}
          return "<a class='fo-fl-row up" + (i === 0 ? " next" : "") + "' href='" + pv + "'>" +
            "<i>R" + u.r + "</i>" +
            "<u class='n'>" + (u.isHome ? "H" : "A") + "</u>" +
            "<span class='fo-fl-who'><b>" + (u.isHome ? "v " : "at ") + E(u.opp) +
            (on ? " <em class='fo-fl-when'>" + E(on) + "</em>" : "") + "</b>" +
            "<span>" + E(hh(hour)) + " &middot; " + E(u.ground) + "</span></span>" +
            "<em class='fo-fl-act'>Preview &rsaquo;</em></a>";
        }).join("");
        if (!ups.length) upRows = "<div class='fo-fl-none'>The season is played out. Awards night awaits.</div>";
      }
    } catch (eU) {}
    if (!upRows) upRows = "<div class='fo-fl-none'>The rest of the card arrives with the world.</div>";

    page.innerHTML =
      "<div class='fo-fl'>" +
      "<div class='fo-fl-mast'>" +
      "<div class='fo-fl-kick'>" + E(my) + " &middot; season " + (snap.seasonNo || 1) + "</div>" +
      "<h1>The Fixture List</h1>" +
      "<div class='fo-fl-rec'><b>" + w + "</b> won" + (t ? " &middot; <b>" + t + "</b> tied" : "") +
        " &middot; <b>" + l + "</b> lost &middot; <b>" + played.length + "</b> of " + rounds + " played</div>" +
      "</div>" +
      (resRows ? "<div class='fo-fl-k'>Results</div><div class='fo-fl-list'>" + resRows + "</div>" : "") +
      "<div class='fo-fl-k'>Still to play</div><div class='fo-fl-list'>" + upRows + "</div>" +
      "<div class='fo-fl-foot'><a href='#/home'>&#8592; The club</a><a href='#/league'>The table &rsaquo;</a><a href='#/planet'>World cricket &rsaquo;</a></div>" +
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

      // ---- what has been played ----
      var played = (App.results || []).filter(function (r) {
        return r && r.comp === "league" && r.result && (r.home === my || r.away === my) && thisSeasonHas(r);
      }).sort(function (a, b) { return (a.round || 0) - (b.round || 0); });
      var w = 0, l = 0, t = 0;
      played.forEach(function (r) {
        if (!r.result || r.result.winner === undefined) return;
        if (r.result.winner === my) w++; else if (r.result.winner === null) t++; else l++;
      });
      var resRows = played.map(function (r) {
        var homeGame = r.home === my;
        var opp = homeGame ? r.away : r.home;
        var won = r.result.winner === my, tie = r.result.winner === null;
        var live = /LIVE/.test(r.result.text || "") || r.result.winner === undefined;
        return "<a class='fo-fl-row' href='#/report?i=" + r.ix + "'>" +
          "<i>R" + ((r.round | 0) + 1) + "</i>" +
          "<u class='" + (live ? "lv" : won ? "w" : tie ? "t" : "l") + "'>" + (live ? "&#9679;" : won ? "W" : tie ? "T" : "L") + "</u>" +
          "<span class='fo-fl-who'><b>" + (homeGame ? "v " : "at ") + E(opp) + "</b>" +
          "<span>" + E(r.ground || "") + "</span></span>" +
          "<em class='fo-fl-res'>" + E((r.result.text || "").replace(/\s*\(.*\)$/, "")) + "</em><s>&#8250;</s></a>";
      }).join("");

      // ---- what is still to come ----
      var upRows = "";
      if (S && S.schedule) {
        var ups = [];
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
        upRows = ups.map(function (u, i) {
          // the fixture list carries real dates now: each round has its hour
          // on the world calendar (England plays at 14:00 UTC)
          var when = "";
          try { if (typeof window.foRoundTimeTxt === "function") when = window.foRoundTimeTxt(u.r) || ""; } catch (eW) {}
          return "<a class='fo-fl-row up" + (i === 0 ? " next" : "") + "' href='#/matchday?r=" + u.r + "'>" +
            "<i>R" + (u.r + 1) + "</i>" +
            "<u class='n'>" + (u.isHome ? "H" : "A") + "</u>" +
            "<span class='fo-fl-who'><b>" + (u.isHome ? "v " : "at ") + E(u.opp.name) +
            (when ? " <em class='fo-fl-when'>" + E(when) + "</em>" : "") + "</b>" +
            "<span>" + E(u.ground) + " &middot; " + E(PITCH_NM[u.pitch] || u.pitch) + " pitch &middot; " + E(u.wx) + "</span></span>" +
            "<em class='fo-fl-act'>Matchday &rsaquo;</em>" +
            "</a>";
        }).join("");
        if (!ups.length) upRows = "<div class='fo-fl-none'>The season is played out. Awards night awaits.</div>";
      }

      page.innerHTML =
        "<div class='fo-fl'>" +
        "<div class='fo-fl-mast'>" +
        "<div class='fo-fl-kick'>" + E(my) + " &middot; season " + (App.seasonNo || 1) + "</div>" +
        "<h1>The Fixture List</h1>" +
          "<div class='fo-fl-rec'><b>" + w + "</b> won" + (t ? " &middot; <b>" + t + "</b> tied" : "") + " &middot; <b>" + l + "</b> lost &middot; <b>" + (played.length) + "</b> of " + (S && S.schedule ? S.schedule.length : 18) + " played</div>" +
        "</div>" +
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
    "html body #page .fo-fl{max-width:720px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
    "html body #page .fo-fl-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:26px 28px 22px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-fl-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-fl-kick:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:7px}",
    "html body #page .fo-fl-mast h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:8px 0 8px;color:#141C28;line-height:1.02}",
    "html body #page .fo-fl-mast p{font:italic 420 13.5px/1.6 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin:0;max-width:56ch}",
    "html body #page .fo-fl-rec{margin-top:12px;font:500 12px/1 Inter,sans-serif;color:rgba(20,28,40,.7);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;display:inline-block;padding:9px 15px}",
    "html body #page .fo-fl-rec b{color:#141C28}",
    "html body #page .fo-fl-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22;margin:20px 2px 8px}",
    "html body #page .fo-fl-k:after{content:'';display:block;width:34px;border-top:2px solid #C95532;margin-top:6px}",
    "html body #page .fo-fl-list{display:flex;flex-direction:column;gap:7px}",
    "html body #page .fo-fl-row{display:grid;grid-template-columns:34px 26px minmax(0,1fr) auto 12px;gap:10px;align-items:center;background:#FFFEFC;border:1px solid rgba(20,28,40,.09);border-radius:14px;padding:10px 14px;text-decoration:none;color:#141C28;box-shadow:0 4px 14px rgba(30,38,52,.06);transition:border-color .15s ease,transform .12s ease}",
    "html body #page a.fo-fl-row:hover{border-color:rgba(217,85,42,.5);transform:translateY(-1px);text-decoration:none}",
    "html body #page .fo-fl-row.up{grid-template-columns:34px 26px minmax(0,1fr) auto}",
    "html body #page .fo-fl-row.next{border-color:rgba(201,85,50,.55);box-shadow:0 6px 18px rgba(201,85,50,.14)}",
    "html body #page .fo-fl-row i{font:700 11px/1 Inter,sans-serif;color:rgba(20,28,40,.45);font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page .fo-fl-row u{width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font:800 11px/1 Inter,sans-serif;text-decoration:none}",
    "html body #page .fo-fl-row u.w{background:rgba(31,158,114,.14);color:#177A57;border:1px solid rgba(31,158,114,.4)}",
    "html body #page .fo-fl-row u.l{background:rgba(200,60,58,.1);color:#B23230;border:1px solid rgba(200,60,58,.35)}",
    "html body #page .fo-fl-row u.t{background:rgba(20,28,40,.07);color:rgba(20,28,40,.6);border:1px solid rgba(20,28,40,.2)}",
    "html body #page .fo-fl-row u.lv{background:rgba(229,57,53,.1);color:#C22823;border:1px solid rgba(229,57,53,.4);font-size:8px}",
    "html body #page .fo-fl-row u.n{background:rgba(20,28,40,.05);color:rgba(20,28,40,.55);border:1px solid rgba(20,28,40,.15)}",
    "html body #page .fo-fl-who{min-width:0}",
    "html body #page .fo-fl-who b{display:block;font:600 13.5px/1.25 Inter,sans-serif;color:#141C28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-who>span{display:block;font:400 11px/1.35 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-fl-row em{font:italic 400 12px/1.35 Georgia,serif;color:rgba(20,28,40,.6);text-align:right;white-space:nowrap}",
    "html body #page .fo-fl-when{display:inline-block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B44A22;background:rgba(201,85,50,.09);border-radius:6px;padding:3px 6px;margin-left:7px;font-style:normal;vertical-align:1px}",
    "html body #page .fo-fl-when.done{color:rgba(20,28,40,.5);background:rgba(20,28,40,.06)}",
    "html body #page .fo-fl-row.cup{border-color:rgba(176,132,9,.34)}",
    "html body #page .fo-fl-row.cup i{color:#8A6A1F}",
    "html body #page .fo-fl-row u.c{background:rgba(176,132,9,.14);color:#8A6A1F;border:1px solid rgba(176,132,9,.4)}",
    "html body #page .fo-fl-row s{text-decoration:none;color:rgba(20,28,40,.35)}",
    "html body #page .fo-fl-act{font:700 11px/1 Inter,sans-serif;color:#FFFEFC;background:#C95532;border-radius:999px;padding:8px 13px;text-decoration:none;white-space:nowrap}",
    "html body #page .fo-fl-act:hover{background:#A64426;color:#FFFEFC;text-decoration:none}",
    "html body #page .fo-fl-none{background:#FFFEFC;border:1px dashed rgba(20,28,40,.2);border-radius:14px;padding:22px;text-align:center;font:italic 400 13px/1.5 Georgia,serif;color:rgba(20,28,40,.55)}",
    "html body #page .fo-fl-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-fl-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-fl-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:520px){html body #page .fo-fl-mast h1{font-size:30px}html body #page .fo-fl-res,html body #page .fo-fl-act{display:none}html body #page .fo-fl-row{grid-template-columns:30px 24px minmax(0,1fr) 12px}html body #page .fo-fl-row.up{grid-template-columns:30px 24px minmax(0,1fr) auto}}"
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
