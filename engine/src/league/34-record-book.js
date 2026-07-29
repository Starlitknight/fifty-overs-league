/* ============================================================================
   THE RECORD BOOK (#/records) — the stats universe. Every league run and
   wicket this save has ever produced, read back as a proper almanack:

   - THIS SEASON: the league's leading run-scorers and wicket-takers, with
     averages and rates, the user's own men picked out in gold.
   - ALL TIME: the same lists since the founding of the club, season tags on.
   - GREAT INNINGS / GREAT SPELLS: the best individual performances ever
     recorded, linked to their scorecards where the match still exists.
   - TEAM RECORDS: highest and lowest totals, the biggest wins by runs and
     by wickets, matches played.
   - THE CLUB LEDGER: the user club's own record book - their highest score,
     best figures, most sixes in an innings, highest total.

   PHASE 4 OF THE ALMANACK. The book wears the shell. Nothing about the
   arithmetic changed; what changed is that it now reads like a book - bands
   of ruled type down one column - rather than eight rounded panels in a grid.

   Everything on this page is DERIVED, never stored: App.playerHist entries
   (season/round-tagged, friendlies flagged fr and excluded) and App.results
   are themselves written deterministically by completeRound, so two clients
   with the same world read the identical book. This module writes nothing.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foRecs) return; window.__foRecs = 1;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function plink(nm) { return "<a href='#/player?n=" + encodeURIComponent(nm) + "'>" + E(nm) + "</a>"; }
  function clubOf(nm) {
    try { var f = findPlayer(nm); if (f && f.team) return f.team.name; } catch (e) {}
    return "";
  }
  function ovTxt(balls) { return Math.floor(balls / 6) + (balls % 6 ? "." + (balls % 6) : ""); }

  // one pass over the whole history: entries are league-only, per-season or all-time
  function foRecScan(seasonNo) {
    var agg = {}, inns = [], spells = [];
    var H = (App.playerHist || {});
    for (var nm in H) {
      var a = { nm: nm, inns: 0, runs: 0, balls: 0, outs: 0, h100: 0, h50: 0, s6: 0, w: 0, cr: 0, cb: 0 };
      for (var i = 0; i < H[nm].length; i++) {
        var e = H[nm][i]; if (!e || e.fr) continue;
        if (seasonNo != null && e.s !== seasonNo) continue;
        if ((e.bb || 0) > 0 || e.o) {
          a.inns++; a.runs += e.rr || 0; a.balls += e.bb || 0; a.outs += e.o ? 1 : 0; a.s6 += e.s6 || 0;
          if ((e.rr || 0) >= 100) a.h100++; else if ((e.rr || 0) >= 50) a.h50++;
          inns.push({ nm: nm, r: e.rr || 0, b: e.bb || 0, o: !!e.o, s6: e.s6 || 0, s: e.s, teams: e.teams, date: e.date });
        }
        if ((e.cb || 0) > 0) {
          a.w += e.w || 0; a.cr += e.cr || 0; a.cb += e.cb || 0;
          spells.push({ nm: nm, w: e.w || 0, r: e.cr || 0, b: e.cb || 0, s: e.s, teams: e.teams, date: e.date });
        }
      }
      if (a.inns || a.cb) agg[nm] = a;
    }
    inns.sort(function (x, y) { return y.r - x.r || x.b - y.b; });
    spells.sort(function (x, y) { return y.w - x.w || x.r - y.r; });
    return { agg: agg, inns: inns, spells: spells };
  }
  function foRecScorecardIx(perf) {
    try {
      for (var i = App.results.length - 1; i >= 0; i--) {
        var r = App.results[i];
        if (r && r.date === perf.date && (r.home + " v " + r.away) === perf.teams) return i;
      }
    } catch (e) {}
    return -1;
  }

  function A() { return window.AL || null; }
  function onRecs() { return (location.hash || "").split("?")[0] === "#/records"; }

  window.foRenderRecordsPage = function () {
    if (!onRecs()) return;
    var page = document.getElementById("page"); if (!page || !ready()) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var me = userTeam(), sN = App.seasonNo || 1;
    var mine = {};
    (me.players || []).concat(me.youth || []).forEach(function (p) { mine[p.name] = 1; });
    var natNm = "England";
    try { if (window.__foLgAPI && __foLgAPI.regionName) natNm = __foLgAPI.regionName(); } catch (e2) {}

    var season = foRecScan(sN), ever = foRecScan(null);
    var multiSeason = sN > 1;
    var vals = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
    var batS = vals(season.agg).filter(function (a) { return a.inns > 0; }).sort(function (x, y) { return y.runs - x.runs; }).slice(0, 8);
    var bowlS = vals(season.agg).filter(function (a) { return a.cb > 0; }).sort(function (x, y) { return y.w - x.w || x.cr - y.cr; }).slice(0, 8);
    var batE = vals(ever.agg).filter(function (a) { return a.inns > 0; }).sort(function (x, y) { return y.runs - x.runs; }).slice(0, 8);
    var bowlE = vals(ever.agg).filter(function (a) { return a.cb > 0; }).sort(function (x, y) { return y.w - x.w || x.cr - y.cr; }).slice(0, 8);

    // ---- a leaders table: rank, man, club, and his figures -----------------
    // The club and the average are the columns a phone can do without; the
    // runs (or the wickets) are the reason anybody opened the page.
    function leaders(arr, bat) {
      if (!arr.length) return al.empty("Nothing written yet", "The first entries go in when the first round settles.");
      return "<div class='al-tblwrap'><table class='al-tbl'><thead><tr>" +
        "<th></th><th class='l'>Player</th><th class='l al-s'>Club</th>" +
        (bat ? "<th class='al-s'>I</th><th>Runs</th><th class='al-s'>Ave</th><th>SR</th>"
             : "<th class='al-s'>O</th><th>Wkts</th><th class='al-s'>Ave</th><th>Econ</th>") +
        "</tr></thead><tbody>" +
        arr.map(function (a, i) {
          var cells = bat
            ? "<td class='al-s'>" + a.inns + "</td><td class='al-pts'>" + a.runs + "</td>" +
              "<td class='al-s'>" + (a.outs ? (a.runs / a.outs).toFixed(1) : "—") + "</td>" +
              "<td>" + (a.balls ? (100 * a.runs / a.balls).toFixed(1) : "—") + "</td>"
            : "<td class='al-s'>" + ovTxt(a.cb) + "</td><td class='al-pts'>" + a.w + "</td>" +
              "<td class='al-s'>" + (a.w ? (a.cr / a.w).toFixed(1) : "—") + "</td>" +
              "<td>" + (a.cb ? (a.cr / (a.cb / 6)).toFixed(2) : "—") + "</td>";
          return "<tr" + (mine[a.nm] ? " class='al-you'" : "") + "><td class='al-pos'>" + (i + 1) + "</td>" +
            "<td class='l al-club'>" + plink(a.nm) + (mine[a.nm] ? "<span class='al-you__tag'>YOU</span>" : "") + "</td>" +
            "<td class='l al-s'>" + E(clubOf(a.nm) || "—") + "</td>" + cells + "</tr>";
        }).join("") + "</tbody></table></div>";
    }

    // ---- a great performance, with the way back to the scorecard ----------
    function perfs(list, bat) {
      if (!list.length) return al.empty("Nothing on record yet", "Great days are written here as they happen.");
      return '<div class="al-fixlist">' + list.map(function (x) {
        var ix = foRecScorecardIx(x);
        var fig = bat ? x.r + (x.o ? "" : "*") + " (" + x.b + ")" : x.w + "/" + x.r + " (" + ovTxt(x.b) + ")";
        var tail = (multiSeason ? "season " + (x.s || 1) : "") + (x.teams ? (multiSeason ? " · " : "") + x.teams : "");
        var row = '<span class="al-fix__r">' + (mine[x.nm] ? "●" : "") + "</span>" +
          '<span class="al-fix__t"><b>' + E(x.nm) + "</b><i>" + E(tail) + "</i></span>" +
          '<span class="al-fix__o">' + E(fig) + "</span>";
        return ix >= 0
          ? '<a class="al-fix al-fix--perf' + (mine[x.nm] ? " al-fix--mine" : "") + '" href="#/scorecard?i=' + ix + '">' + row + "</a>"
          : '<div class="al-fix al-fix--perf' + (mine[x.nm] ? " al-fix--mine" : "") + '">' + row + "</div>";
      }).join("") + "</div>";
    }

    // ---- team records, from the saved league results -----------------------
    var hiTot = null, loTot = null, byRuns = null, byWkts = null, played = 0;
    (App.results || []).forEach(function (r) {
      if (!r || (r.comp && r.comp !== "league")) return;
      played++;
      (r.innings || []).forEach(function (inn) {
        if (!inn || inn.runs == null) return;
        if (!hiTot || inn.runs > hiTot.runs) hiTot = { runs: inn.runs, wkts: inn.wkts, nm: inn.batTeam, vs: inn.bowlTeam };
        if ((inn.wkts | 0) >= 10 && (!loTot || inn.runs < loTot.runs)) loTot = { runs: inn.runs, wkts: inn.wkts, nm: inn.batTeam, vs: inn.bowlTeam };
      });
      var txt = (r.result && r.result.text) || "";
      var mR = txt.match(/^(.*?) won by (\d+) runs?/), mW = txt.match(/^(.*?) won by (\d+) wickets?/);
      if (mR && (!byRuns || +mR[2] > byRuns.n)) byRuns = { n: +mR[2], nm: mR[1], vs: mR[1] === r.home ? r.away : r.home };
      if (mW && (!byWkts || +mW[2] > byWkts.n)) byWkts = { n: +mW[2], nm: mW[1], vs: mW[1] === r.home ? r.away : r.home };
    });

    // ---- the club's own bests, from its own men only -----------------------
    var myInns = ever.inns.filter(function (x) { return mine[x.nm]; });
    var mySpells = ever.spells.filter(function (x) { return mine[x.nm] && x.w > 0; });
    var mySix = ever.inns.slice().sort(function (x, y) { return (y.s6 || 0) - (x.s6 || 0); })
      .filter(function (x) { return mine[x.nm] && x.s6 > 0; })[0];
    var myTot = null;
    (App.results || []).forEach(function (r) {
      if (!r || (r.comp && r.comp !== "league")) return;
      (r.innings || []).forEach(function (inn) {
        if (inn && inn.batTeam === me.name && (!myTot || inn.runs > myTot.runs)) myTot = { runs: inn.runs, wkts: inn.wkts, vs: inn.bowlTeam };
      });
    });

    var body = al.mast("The " + natNm + " League · season " + sN, "The Record Book",
      "Every league run and wicket this world has produced, kept the way an almanack would keep it.");
    body += al.subnav("records");

    // the one line a record book can lead with: who is top of it
    if (batS.length || bowlS.length) {
      body += al.decide({
        kind: "",
        title: (batS[0] ? batS[0].nm + " leads the run-scorers with " + batS[0].runs : "No runs scored yet"),
        note: bowlS[0] ? bowlS[0].nm + " leads the wicket-takers with " + bowlS[0].w
                       : "No wickets taken yet",
      });
    }

    body += al.sec("This season · most runs", leaders(batS, true));
    body += al.sec("This season · most wickets", leaders(bowlS, false));
    if (multiSeason) {
      body += al.sec("Since the founding · most runs", leaders(batE, true));
      body += al.sec("Since the founding · most wickets", leaders(bowlE, false));
    }
    body += al.sec("Great innings", perfs(ever.inns.slice(0, 6), true));
    body += al.sec("Great spells", perfs(ever.spells.filter(function (x) { return x.w > 0; }).slice(0, 6), false));

    var dash = "—";
    body += al.sec("Team records", al.ledger([
      ["Highest total", hiTot ? hiTot.runs + "/" + hiTot.wkts + " · " + hiTot.nm : dash],
      ["Lowest all out", loTot ? loTot.runs + " · " + loTot.nm : dash],
      ["Biggest win, by runs", byRuns ? byRuns.n + " runs · " + byRuns.nm : dash],
      ["Biggest win, by wickets", byWkts ? byWkts.n + " wickets · " + byWkts.nm : dash],
      ["League matches recorded", String(played)],
    ]));

    body += al.sec(me.name + " · the club ledger", al.ledger([
      ["Highest score", myInns[0] ? myInns[0].r + (myInns[0].o ? "" : "*") + " · " + myInns[0].nm : dash],
      ["Best figures", mySpells[0] ? mySpells[0].w + "/" + mySpells[0].r + " · " + mySpells[0].nm : dash],
      ["Most sixes, one innings", mySix ? mySix.s6 + " · " + mySix.nm : dash],
      ["Highest team total", myTot ? myTot.runs + "/" + myTot.wkts + " · v " + myTot.vs : dash],
    ]));

    body += '<p class="al-read">Every line is derived from the record, never stored — two clients with the ' +
      "same world read the identical book.</p>";

    page.innerHTML = al.page({ body: body });
  };
})();
