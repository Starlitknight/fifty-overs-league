/* ============================================================================
   THE TABLE (#/table) — PHASE 1c: the first page that reads the database.

   Every other screen in this game is drawn from one JSON document: the league
   snapshot, roughly two megabytes, downloaded whole and parsed whole before
   anything can be shown. That is the architecture that has been breaking all
   week, and it is not how Battrick or From the Pavilion work. Their pages ask
   the database for what the page shows, and nothing else.

   This is that, for one page. The umpire writes game.results after every round
   (resolver/publish.mjs); game.standings derives the table from those rows in
   SQL - two points a win, one a tie, net run rate by overs faced and bowled -
   and the test suite proves that view agrees with the engine's own leagueRows()
   to the run, on a real played season. So the table on this page is not a
   summary of the snapshot. It is a query, and it weighs about eight hundred
   bytes.

   It therefore paints without the snapshot: no career restore, no megabytes,
   no waiting. Reads are public, so it works the moment you are in a league.

   UNTIL THE UMPIRE HAS RUN, THERE ARE NO ROWS. A league whose first round has
   not yet resolved has nothing in game.results, and a manager must not be
   shown an empty table and left to wonder. So when the query comes back empty
   - or the schema is not exposed, or the request fails - the page falls back
   to the engine's own table from whatever this device has already loaded, and
   says which of the two it is showing. One page, two sources, never blank.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foTbl) return; window.__foTbl = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function lg() { try { return window.__foLeague ? window.__foLeague() : null; } catch (e) { return null; } }
  function myClub() { try { return (userTeam() || {}).name || ""; } catch (e) { return ""; } }
  function onPage() { return (location.hash || "").split("?")[0] === "#/table"; }
  function nrr(n) { var v = Number(n) || 0; return (v >= 0 ? "+" : "") + v.toFixed(3); }

  function css() {
    if (document.getElementById("fo-tbl-css")) return;
    var s = document.createElement("style"); s.id = "fo-tbl-css";
    s.textContent =
      ".fo-tbl{max-width:860px;margin:0 auto;padding:28px 16px 64px}" +
      ".fo-tbl .eyebrow{font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#B4533A;margin-bottom:6px}" +
      ".fo-tbl h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(30px,5vw,46px);line-height:1.05;margin:0 0 8px;text-wrap:balance}" +
      ".fo-tbl .sub{color:#5A6472;line-height:1.55;margin:0 0 20px;max-width:56ch}" +
      ".fo-tbl-wrap{overflow-x:auto;border:1px solid rgba(11,19,34,.12);border-radius:14px;background:#fff}" +
      ".fo-tbl table{width:100%;border-collapse:collapse;font-size:14px;min-width:540px}" +
      ".fo-tbl th{font:600 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase;color:#7A8595;text-align:right;padding:12px 10px;border-bottom:1px solid rgba(11,19,34,.12);white-space:nowrap}" +
      ".fo-tbl th.l,.fo-tbl td.l{text-align:left}" +
      ".fo-tbl td{padding:11px 10px;text-align:right;border-bottom:1px solid rgba(11,19,34,.06);font-variant-numeric:tabular-nums;white-space:nowrap}" +
      ".fo-tbl tr:last-child td{border-bottom:0}" +
      ".fo-tbl td.club{font-weight:600}" +
      ".fo-tbl td.pos{color:#7A8595;width:34px}" +
      ".fo-tbl tr.me{background:#FBF3EF}" +
      ".fo-tbl tr.me td.club{color:#B4533A}" +
      ".fo-tbl td.pts{font-weight:700}" +
      ".fo-tbl .src{margin-top:14px;font:500 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#7A8595}" +
      ".fo-tbl .src b{color:#3E7A55;font-weight:600}" +
      ".fo-tbl .src i{color:#8A6A3B;font-style:normal;font-weight:600}" +
      "@media (prefers-color-scheme:dark){}";
    document.head.appendChild(s);
  }

  function shell(inner) {
    return "<div class='fo-tbl'><div class='eyebrow'>The League &middot; Standings</div>" +
      "<h1>The Table</h1>" + inner + "</div>";
  }

  /** Rows straight from SQL. Resolves to null when the spine has nothing. */
  function fromDatabase(leagueId) {
    return fetch(SB_URL + "/rest/v1/standings?league_id=eq." + encodeURIComponent(leagueId) +
      "&select=club,season_no,p,w,l,t,pts,rf,ra,nrr", { headers: { apikey: SB_ANON, "Accept-Profile": "game" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        if (!rows || !rows.length) return null;
        // the league may have played several seasons; this page is the one
        // being played now, which is the highest season number present
        var top = 0;
        rows.forEach(function (r0) { if ((r0.season_no | 0) > top) top = r0.season_no | 0; });
        var live = rows.filter(function (r0) { return (r0.season_no | 0) === top; });
        if (!live.length) return null;
        live.sort(function (a, b) { return b.pts - a.pts || Number(b.nrr) - Number(a.nrr) || String(a.club).localeCompare(String(b.club)); });
        return { season: top, rows: live };
      })
      .catch(function () { return null; });
  }

  /** The engine's own table, from whatever this device already holds. */
  function fromEngine() {
    try {
      if (typeof leagueRows !== "function") return null;
      var rows = leagueRows() || [];
      if (!rows.length) return null;
      return {
        season: (typeof App !== "undefined" && App && App.seasonNo) || 1,
        rows: rows.map(function (x) {
          return { club: x.nm, p: x.p, w: x.w, l: x.l, t: x.t, pts: x.pts, rf: x.rf, ra: x.ra, nrr: x.nrr };
        }),
      };
    } catch (e) { return null; }
  }

  function render(data, served, note) {
    var page = document.getElementById("page"); if (!page) return;
    css();
    if (!data) {
      page.innerHTML = shell("<p class='sub'>This league has not played a round yet. " +
        "The table appears the moment the first round is resolved.</p>");
      return;
    }
    var mine = myClub();
    var body = data.rows.map(function (r, i) {
      return "<tr" + (r.club === mine ? " class='me'" : "") + ">" +
        "<td class='pos'>" + (i + 1) + "</td>" +
        "<td class='l club'>" + E(r.club) + "</td>" +
        "<td>" + (r.p | 0) + "</td><td>" + (r.w | 0) + "</td><td>" + (r.l | 0) + "</td><td>" + (r.t | 0) + "</td>" +
        "<td>" + nrr(r.nrr) + "</td><td class='pts'>" + (r.pts | 0) + "</td></tr>";
    }).join("");
    page.innerHTML = shell(
      "<p class='sub'>Season " + (data.season | 0) + " &middot; " + data.rows.length + " clubs. " +
      "Two points a win, one a tie; net run rate splits the level.</p>" +
      "<div class='fo-tbl-wrap'><table><thead><tr>" +
      "<th></th><th class='l'>Club</th><th>P</th><th>W</th><th>L</th><th>T</th><th>NRR</th><th>Pts</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table></div>" +
      "<div class='src'>" + (served
        ? "<b>&#9679; served</b> &middot; read from the league database, not from your saved season"
        : "<i>&#9679; local</i> &middot; " + E(note || "read from this device's copy of the season")) +
      "</div>");
  }

  window.foRenderStandingsPage = function () {
    if (!onPage()) return;
    var page = document.getElementById("page"); if (!page) return;
    css();
    // paint what this device already knows FIRST, so the page is never blank,
    // then let the served table replace it when it lands (typically ~200ms)
    var local = fromEngine();
    if (local) render(local, false, "waiting for the league database");
    else page.innerHTML = shell("<p class='sub'>Reading the table&hellip;</p>");

    var L = lg();
    if (!L || !L.id) {
      if (!local) render(null);
      else render(local, false, "solo career &middot; this table is your own season");
      return;
    }
    fromDatabase(L.id).then(function (served) {
      if (!onPage()) return;                       // the manager moved on
      if (served) { render(served, true); return; }
      if (local) { render(local, false, "the league database has no rounds yet"); return; }
      render(null);
    });
  };
})();
