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

  window.foRenderRecordsPage = function () {
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foRecCss();
    document.body.classList.add("fo-rec-on");
    var me = userTeam(), sN = App.seasonNo || 1;
    var mine = {};
    (me.players || []).concat(me.youth || []).forEach(function (p) { mine[p.name] = 1; });
    var natNm = "England";
    try { if (window.__foLgAPI && __foLgAPI.regionName) natNm = __foLgAPI.regionName(); } catch (e) {}

    var season = foRecScan(sN), ever = foRecScan(null);
    var multiSeason = sN > 1;

    var starOf = function (nm) { return mine[nm] ? "<i class='fo-rec-mine' title='" + E(me.name) + "'>&#9679;</i>" : ""; };
    var leaderRows = function (arr, bat) {
      if (!arr.length) return "<div class='fo-rec-empty'>The first entries are written when the first round settles.</div>";
      return "<div class='fo-rec-scroll'><table class='fo-rec-tbl'><tr><th></th><th>Player</th><th>Club</th>" +
        (bat ? "<th class='n'>I</th><th class='n'>Runs</th><th class='n'>Ave</th><th class='n'>SR</th>"
             : "<th class='n'>O</th><th class='n'>Wkts</th><th class='n'>Ave</th><th class='n'>Econ</th>") + "</tr>" +
        arr.map(function (a, i) {
          var cells = bat
            ? "<td class='n'>" + a.inns + "</td><td class='n'><b>" + a.runs + "</b></td><td class='n'>" + (a.outs ? (a.runs / a.outs).toFixed(1) : "-") + "</td><td class='n'>" + (a.balls ? (100 * a.runs / a.balls).toFixed(1) : "-") + "</td>"
            : "<td class='n'>" + ovTxt(a.cb) + "</td><td class='n'><b>" + a.w + "</b></td><td class='n'>" + (a.w ? (a.cr / a.w).toFixed(1) : "-") + "</td><td class='n'>" + (a.cb ? (a.cr / (a.cb / 6)).toFixed(2) : "-") + "</td>";
          return "<tr" + (mine[a.nm] ? " class='mine'" : "") + "><td class='rk'>" + (i + 1) + "</td><td class='pn'>" + starOf(a.nm) + plink(a.nm) + "</td><td class='cl'>" + E(clubOf(a.nm) || "&mdash;") + "</td>" + cells + "</tr>";
        }).join("") + "</table></div>";
    };
    var vals = function (o) { return Object.keys(o).map(function (k) { return o[k]; }); };
    var batS = vals(season.agg).filter(function (a) { return a.inns > 0; }).sort(function (x, y) { return y.runs - x.runs; }).slice(0, 8);
    var bowlS = vals(season.agg).filter(function (a) { return a.cb > 0; }).sort(function (x, y) { return y.w - x.w || x.cr - y.cr; }).slice(0, 8);
    var batE = vals(ever.agg).filter(function (a) { return a.inns > 0; }).sort(function (x, y) { return y.runs - x.runs; }).slice(0, 8);
    var bowlE = vals(ever.agg).filter(function (a) { return a.cb > 0; }).sort(function (x, y) { return y.w - x.w || x.cr - y.cr; }).slice(0, 8);

    var perfRow = function (x, bat) {
      var ix = foRecScorecardIx(x);
      var fig = bat ? "<b>" + x.r + (x.o ? "" : "*") + "</b> <span>(" + x.b + ")</span>"
                    : "<b>" + x.w + "/" + x.r + "</b> <span>(" + ovTxt(x.b) + ")</span>";
      var tail = (multiSeason ? "S" + (x.s || 1) : "") + (ix >= 0 ? " <a class='fo-rec-sc' href='#/scorecard?i=" + ix + "'>scorecard &rsaquo;</a>" : "");
      return "<div class='fo-rec-perf" + (mine[x.nm] ? " mine" : "") + "'><span class='fig'>" + fig + "</span>" +
        "<span class='who'>" + starOf(x.nm) + plink(x.nm) + "</span><span class='tail'>" + tail + "</span></div>";
    };
    var bestInns = ever.inns.slice(0, 6).map(function (x) { return perfRow(x, true); }).join("") || "<div class='fo-rec-empty'>No innings on record yet.</div>";
    var bestSpell = ever.spells.filter(function (x) { return x.w > 0; }).slice(0, 6).map(function (x) { return perfRow(x, false); }).join("") || "<div class='fo-rec-empty'>No spells on record yet.</div>";

    // team records: totals + margins from the saved league results
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
    var teamKv = function (label, v) { return "<div class='fo-rec-kv'><span>" + label + "</span><b>" + v + "</b></div>"; };
    var teamRecs =
      teamKv("Highest total", hiTot ? hiTot.runs + "/" + hiTot.wkts + " <i>" + E(hiTot.nm) + " v " + E(hiTot.vs) + "</i>" : "&mdash;") +
      teamKv("Lowest all-out", loTot ? loTot.runs + " <i>" + E(loTot.nm) + " v " + E(loTot.vs) + "</i>" : "&mdash;") +
      teamKv("Biggest win, by runs", byRuns ? byRuns.n + " runs <i>" + E(byRuns.nm) + " v " + E(byRuns.vs) + "</i>" : "&mdash;") +
      teamKv("Biggest win, by wickets", byWkts ? byWkts.n + " wickets <i>" + E(byWkts.nm) + " v " + E(byWkts.vs) + "</i>" : "&mdash;") +
      teamKv("League matches recorded", String(played));

    // the club ledger: the user club's own bests, from their own men only
    var myInns = ever.inns.filter(function (x) { return mine[x.nm]; });
    var mySpells = ever.spells.filter(function (x) { return mine[x.nm] && x.w > 0; });
    var mySix = ever.inns.slice().sort(function (x, y) { return (y.s6 || 0) - (x.s6 || 0); }).filter(function (x) { return mine[x.nm] && x.s6 > 0; })[0];
    var myTot = null;
    (App.results || []).forEach(function (r) {
      if (!r || (r.comp && r.comp !== "league")) return;
      (r.innings || []).forEach(function (inn) {
        if (inn && inn.batTeam === me.name && (!myTot || inn.runs > myTot.runs)) myTot = { runs: inn.runs, wkts: inn.wkts, vs: inn.bowlTeam };
      });
    });
    var clubRecs =
      teamKv("Highest score", myInns[0] ? myInns[0].r + (myInns[0].o ? "" : "*") + " <i>" + E(myInns[0].nm) + "</i>" : "&mdash;") +
      teamKv("Best figures", mySpells[0] ? mySpells[0].w + "/" + mySpells[0].r + " <i>" + E(mySpells[0].nm) + "</i>" : "&mdash;") +
      teamKv("Most sixes, one innings", mySix ? mySix.s6 + " <i>" + E(mySix.nm) + "</i>" : "&mdash;") +
      teamKv("Highest team total", myTot ? myTot.runs + "/" + myTot.wkts + " <i>v " + E(myTot.vs) + "</i>" : "&mdash;");

    var panel = function (kicker, title, body) {
      return "<div class='fo-rec-panel'><div class='fo-rec-k'>" + kicker + "</div><h3>" + title + "</h3>" + body + "</div>";
    };
    page.innerHTML = "<div class='fo-rec'><div class='fo-rec-in'>" +
      "<div class='fo-rec-eyebrow'>The " + E(natNm) + " League &middot; season " + sN + "</div>" +
      "<h1 class='fo-rec-h1'>The Record Book</h1>" +
      "<p class='fo-rec-tag'>Every league run and wicket this world has produced, kept the way an almanack would keep it. Gold dots are " + E(me.name) + " men.</p>" +
      "<div class='fo-rec-grid'>" +
      panel("This season", "Most runs", leaderRows(batS, true)) +
      panel("This season", "Most wickets", leaderRows(bowlS, false)) +
      (multiSeason ? panel("All time", "Most runs since the founding", leaderRows(batE, true)) +
                     panel("All time", "Most wickets since the founding", leaderRows(bowlE, false)) : "") +
      panel("All time", "Great innings", bestInns) +
      panel("All time", "Great spells", bestSpell) +
      panel("All time", "Team records", teamRecs) +
      panel(E(me.name), "The club ledger", clubRecs) +
      "</div>" +
      "<div class='fo-rec-foot'><a href='#/league'>&lsaquo; The table</a><a href='#/almanack'>The World Almanack &rsaquo;</a></div>" +
      "</div></div>";
  };
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/records") document.body.classList.remove("fo-rec-on"); });

  function foRecCss() {
    if (document.getElementById("fo-rec-css")) return;
    var s = document.createElement("style"); s.id = "fo-rec-css";
    s.textContent = [
      "html body.ftpskin.fo-rec-on,html body.fo-rec-on{background:#F2EFE7 !important}",
      "html body.fo-rec-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-rec-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-rec{min-height:100vh;padding:72px 18px 40px;color:#141C28}",
      ".fo-rec-in{max-width:1120px;margin:0 auto}",
      ".fo-rec-eyebrow{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;color:#8A6A1F;margin:0 0 6px}",
      ".fo-rec-h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(34px,5.6vw,54px);line-height:1;margin:0 0 8px;color:#1A2130}",
      ".fo-rec-tag{font-family:Georgia,serif;font-style:italic;font-size:14px;color:rgba(20,28,40,.6);margin:0 0 22px;max-width:62ch}",
      ".fo-rec-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}",
      "@media(max-width:900px){.fo-rec-grid{grid-template-columns:minmax(0,1fr)}}",
      ".fo-rec-panel{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:15px 17px;box-shadow:0 6px 20px rgba(30,38,52,.06)}",
      ".fo-rec-k{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;color:#8A6A1F;margin:0 0 2px}",
      ".fo-rec-panel h3{margin:0 0 10px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:19px;color:#1A2130}",
      ".fo-rec-scroll{overflow-x:auto}",
      ".fo-rec-tbl{width:100%;border-collapse:collapse;font-size:12.5px}",
      ".fo-rec-tbl th{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45);text-align:left;padding:0 6px 6px 0;border-bottom:1px solid rgba(20,28,40,.1)}",
      ".fo-rec-tbl th.n,.fo-rec-tbl td.n{text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-rec-tbl td{padding:6px 6px 6px 0;border-bottom:1px solid rgba(20,28,40,.05);color:#26301F}",
      ".fo-rec-tbl td.rk{color:rgba(20,28,40,.35);font-size:11px;width:18px}",
      ".fo-rec-tbl td.pn a{color:#1A2130;font-weight:600;text-decoration:none}",
      ".fo-rec-tbl td.pn a:hover{color:#B44A22}",
      ".fo-rec-tbl td.cl{color:rgba(20,28,40,.5);font-size:11px}",
      ".fo-rec-tbl tr.mine td{background:rgba(200,154,46,.07)}",
      ".fo-rec-mine{font-style:normal;font-size:8px;color:#C89A2E;margin-right:4px;vertical-align:2px}",
      ".fo-rec-perf{display:flex;align-items:baseline;gap:9px;padding:6px 0;border-bottom:1px solid rgba(20,28,40,.05);font-size:13px}",
      ".fo-rec-perf.mine{background:rgba(200,154,46,.07)}",
      ".fo-rec-perf .fig{min-width:74px;font-variant-numeric:tabular-nums}",
      ".fo-rec-perf .fig b{color:#1A2130;font-size:14px}",
      ".fo-rec-perf .fig span{color:rgba(20,28,40,.45);font-size:11px}",
      ".fo-rec-perf .who a{color:#26301F;font-weight:600;text-decoration:none}",
      ".fo-rec-perf .who a:hover{color:#B44A22}",
      ".fo-rec-perf .tail{margin-left:auto;color:rgba(20,28,40,.45);font-size:10.5px;white-space:nowrap}",
      ".fo-rec-sc{color:#B44A22 !important;text-decoration:none;font-weight:600}",
      ".fo-rec-kv{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(20,28,40,.05);font-size:12.5px}",
      ".fo-rec-kv span{color:rgba(20,28,40,.55)}",
      ".fo-rec-kv b{color:#1A2130;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-rec-kv b i{font-style:normal;font-weight:400;color:rgba(20,28,40,.5);font-size:11px}",
      ".fo-rec-empty{font-family:Georgia,serif;font-style:italic;font-size:12.5px;color:rgba(20,28,40,.45);padding:6px 0}",
      ".fo-rec-foot{display:flex;gap:10px;justify-content:space-between;margin-top:20px;flex-wrap:wrap}",
      ".fo-rec-foot a{font:600 12px/1 Inter,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
      ".fo-rec-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5)}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
