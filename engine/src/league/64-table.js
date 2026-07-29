/* ============================================================================
   THE TABLE (#/table) — the league's standing record, read from the database.

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

   PHASE 2 OF THE ALMANACK. The page now wears the shell, and states its own
   headline above the grid: a table is read for one thing before all others -
   where am I, and what is the gap - and that sentence should not have to be
   assembled by eye out of eight columns of figures.
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
  function A() { return window.AL || null; }
  function nrr(n) { var v = Number(n) || 0; return (v >= 0 ? "+" : "") + v.toFixed(3); }
  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function points(n) { return n + (n === 1 ? " point" : " points"); }

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

  // ---- the sentence the table is actually read for -------------------------
  function standing(data, mine) {
    var i = -1;
    for (var k = 0; k < data.rows.length; k++) if (data.rows[k].club === mine) i = k;
    if (i < 0) return null;
    var me = data.rows[i], above = i > 0 ? data.rows[i - 1] : null, below = data.rows[i + 1] || null;
    var notes = [];
    if (above) {
      var gap = (above.pts | 0) - (me.pts | 0);
      notes.push(gap === 0 ? "level with " + above.club + " on points" : points(gap) + " behind " + above.club);
    } else notes.push(below ? "top of the table" : "the only club on the card");
    if (below) {
      var lead = (me.pts | 0) - (below.pts | 0);
      notes.push(lead === 0 ? "level with " + below.club + " below" : points(lead) + " clear of " + below.club);
    }
    return {
      title: ordinal(i + 1) + " of " + data.rows.length + " · " + points(me.pts | 0) +
        " from " + (me.p | 0) + (me.p === 1 ? " match" : " matches"),
      note: notes.join(" · "),
      top: i === 0,
    };
  }

  // ---- the grid ------------------------------------------------------------
  // POINTS MUST NEVER BE THE COLUMN THAT FALLS OFF. A league table read on a
  // phone is read for two things: who is top, and how many points they have.
  // Eight columns do not fit in 390px, and a table that merely scrolls
  // sideways puts the most important number behind a swipe nobody makes. So
  // the narrow layout spends its width on what the table is FOR - position,
  // club, played, won, net run rate, points - and drops lost and tied, which a
  // reader can derive and which the wider layout keeps.
  function grid(data, mine) {
    var body = data.rows.map(function (r, i) {
      var me = r.club === mine;
      return "<tr" + (me ? " class='al-you'" : "") + ">" +
        "<td class='al-pos'>" + (i + 1) + "</td>" +
        "<td class='l al-club'>" + E(r.club) + (me ? "<span class='al-you__tag'>YOU</span>" : "") + "</td>" +
        "<td>" + (r.p | 0) + "</td><td>" + (r.w | 0) + "</td>" +
        "<td class='al-s'>" + (r.l | 0) + "</td><td class='al-s'>" + (r.t | 0) + "</td>" +
        "<td>" + nrr(r.nrr) + "</td><td class='al-pts'>" + (r.pts | 0) + "</td></tr>";
    }).join("");
    return "<div class='al-tblwrap'><table class='al-tbl'><thead><tr>" +
      "<th></th><th class='l'>Club</th><th>P</th><th>W</th>" +
      "<th class='al-s'>L</th><th class='al-s'>T</th><th>NRR</th><th>Pts</th>" +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  }

  function render(data, served, note) {
    if (!onPage()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var body = al.mast("The League · standings", "The Table",
      data ? "Two points a win, one a tie; net run rate splits the level."
           : "The season's record, from the morning the first round resolves.");
    body += al.subnav("table");

    if (!data) {
      page.innerHTML = al.page({ body: body + al.empty("No rounds played yet",
        "This league has not resolved a round. The table appears the morning after the first one does.") });
      return;
    }

    var mine = myClub(), st = standing(data, mine);
    if (st) body += al.decide({ kind: st.top ? "done" : "", title: "You are " + st.title, note: st.note });

    body += al.sec("Season " + (data.season | 0) + " · " + data.rows.length + " clubs",
      grid(data, mine), { href: "#/fixtures", label: "Fixtures" });
    body += "<p class='al-read'>" + (served
      ? "&#9679; served &middot; read from the league database, not from your saved season"
      : "&#9679; local &middot; " + E(note || "read from this device's copy of the season")) + "</p>";

    page.innerHTML = al.page({ body: body });
  }

  window.foRenderStandingsPage = function () {
    if (!onPage()) return;
    if (!document.getElementById("page")) return;
    // paint what this device already knows FIRST, so the page is never blank,
    // then let the served table replace it when it lands (typically ~200ms)
    var local = fromEngine();
    render(local, false, "waiting for the league database");

    var L = lg();
    if (!L || !L.id) { render(local, false, "solo career · this table is your own season"); return; }
    fromDatabase(L.id).then(function (served) {
      if (!onPage()) return;                       // the manager moved on
      if (served) { render(served, true); return; }
      render(local, false, "the league database has no rounds yet");
    });
  };
})();
