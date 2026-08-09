/* ============================================================================
   THE STATS CENTRE (#/stats) — one door onto every number the world keeps.

   The scorer's book already existed: the umpire settles a round, tick.mjs adds
   every innings and every over to a per-player row, and that row is published
   as its own document (`stats/<country>`). But the only way in was the fourth
   tab of your own league page, which meant a manager could read his own
   nation's averages and nobody else's, and could not put his eleven's numbers
   side by side with the country's or the planet's.

   This page is an INDEX and the tables it indexes, in the shape a statistician
   thinks in: pick a BOOK (batting, bowling, fielding) and a SCOPE (your club,
   your league, the whole world), and read the same columns in all nine
   combinations. Every column is a handle - click a head to sort by it.

   THE HONEST LIMIT, STATED ON THE PAGE. The world publishes THIS season's
   book. There is no career total across seasons because nothing anywhere
   stores one, and a page that invented one would be lying. When the record
   grows a career table, this page grows a scope for it; until then it says
   "this season" and means it.

   NOTHING HERE IS COMPUTED FROM RATINGS. Every figure is an aggregate of balls
   the engine actually bowled, so a man's average is what he did, never what he
   is supposed to be worth.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foStc) return; window.__foStc = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function onPage() { return (location.hash || "").split("?")[0] === "#/stats"; }
  function qparam(k) {
    var m = new RegExp("[?&]" + k + "=([^&]*)").exec(location.hash || "");
    return m ? decodeURIComponent(m[1]) : "";
  }
  // WHICH NATIONS EXIST IS THE PLANET'S ANSWER, NOT THIS PAGE'S. Three regions
  // of the solo campaign have no league in the served world; asking the planet
  // means this page cannot drift from the world it is reporting on.
  function nations() {
    try { var p = window.__foPlanet; if (p && p.nations) return p.nations() || []; } catch (e) {}
    try { return (window.__foCxAPI.regions() || []).filter(function (r) { return !r.final; }); } catch (e2) { return []; }
  }
  function natName(id) {
    var L = nations();
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i].nm;
    return String(id || "").toUpperCase();
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (e) { return null; }
  }
  function myNation() { var c = claim(); return (c && c.country) || (function () {
    try { return (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (e) { return "eng"; }
  })(); }

  // ---- the scorebooks, fetched a nation at a time ---------------------------
  // Each nation's book is its own document. The world scope wants one from
  // every league, so they are asked for in parallel and the page repaints as
  // they land rather than waiting on the slowest - and a nation already read
  // for the league scope is never asked for twice.
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var SC = {};                                     // cid -> {loading, players, seasonNo, rounds}
  var repaintT = null;
  function repaint() {
    if (repaintT) return;
    repaintT = setTimeout(function () {
      repaintT = null;
      try { if (onPage() && window.foRenderStatsPage) window.foRenderStatsPage(); } catch (e) {}
    }, 220);
  }
  function bookOf(cid) {
    if (SC[cid]) return SC[cid];
    var e = SC[cid] = { loading: true, players: null, seasonNo: 0, rounds: 0 };
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("stats/" + cid) + "&select=body",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) {
        var b = (rows && rows[0] && rows[0].body) || null;
        // the country is stamped on every row here, once, so a world-wide
        // table can link a man back to his own nation's pages
        var men = (b && b.players) || [];
        for (var i = 0; i < men.length; i++) men[i].__c = cid;
        e.loading = false; e.players = men;
        e.seasonNo = (b && b.seasonNo) || 0; e.rounds = (b && b.roundsPlayed) || 0;
        repaint();
      })
      .catch(function () { e.loading = false; e.players = []; repaint(); });
    return e;
  }

  // ---- the three books, and the columns a scorer keeps ----------------------
  // `k` is the field on the served row, `h` the head, and `f` an optional
  // formatter. Everything not named here is right-aligned tabular figures.
  function overs(b) { b = b | 0; return (b / 6 | 0) + (b % 6 ? "." + (b % 6) : ""); }
  var BOOKS = {
    bat: {
      label: "Batting", short: "Batting averages",
      blurb: "Every man who has faced a ball: innings, not-outs, runs, highest score, average, strike rate, ducks, hundreds, fifties and boundaries.",
      keep: function (x) { return x.inns > 0; },
      sort: function (a, b) { return b.runs - a.runs || b.hs - a.hs; },
      qual: function (x, rounds) { return x.inns >= Math.max(1, Math.round(rounds * 0.4)); },
      qualSay: function (rounds) { return "at least " + Math.max(1, Math.round(rounds * 0.4)) + " innings"; },
      empty: "faced a ball",
      cols: [["m", "Mat"], ["inns", "Inns"], ["no", "NO"], ["runs", "Runs"], ["hs", "HS"], ["ave", "Ave"],
             ["bf", "BF"], ["sr", "SR"], ["ducks", "0s"], ["h100", "100"], ["h50", "50"], ["f4", "4s"], ["f6", "6s"]]
    },
    bowl: {
      label: "Bowling", short: "Bowling averages",
      blurb: "Overs sent down, maidens, runs conceded, wickets, best figures, average, economy, strike rate and hauls.",
      keep: function (x) { return x.balls > 0; },
      sort: function (a, b) { return b.wkts - a.wkts || a.conc - b.conc; },
      qual: function (x, rounds) { return x.balls >= Math.max(12, rounds * 24); },
      qualSay: function (rounds) { return "at least " + overs(Math.max(12, rounds * 24)) + " overs"; },
      empty: "bowled an over",
      cols: [["ov", "Overs"], ["m", "Mat"], ["mdns", "Mdns"], ["conc", "Runs"], ["wkts", "Wkts"], ["bb", "Best"],
             ["bave", "Ave"], ["er", "Econ"], ["bsr", "SR"], ["w3", "3WI"], ["w5", "5WI"]]
    },
    field: {
      label: "Fielding", short: "Keeping &amp; fielding",
      blurb: "Catches behind the stumps and in the field, stumpings and run-outs — the dismissals nobody is credited with in the batting book.",
      keep: function (x) { return dis(x) > 0; },
      sort: function (a, b) { return dis(b) - dis(a) || b.st - a.st; },
      qual: function (x) { return dis(x) > 0; },
      qualSay: function () { return "one dismissal"; },
      empty: "held a catch",
      cols: [["m", "Mat"], ["dis", "Dis"], ["ckt", "Ct (wk)"], ["fkt", "Ct"], ["st", "St"], ["ro", "RO"]]
    }
  };
  function dis(x) { return (x.ckt | 0) + (x.fkt | 0) + (x.st | 0) + (x.ro | 0); }

  // what a cell READS and what it SORTS BY are two different questions: best
  // bowling reads "5-21" and ranks on wickets first, then runs conceded
  function cellOf(x, k) {
    if (k === "bb") return x.bb ? (x.bb.w + "&#8209;" + x.bb.r) : "&mdash;";
    if (k === "hs") return x.hs ? (x.hs + (x.hsNo ? "*" : "")) : "0";
    if (k === "ov") return overs(x.balls);
    if (k === "dis") return String(dis(x));
    var v = x[k];
    if (v == null) return "&mdash;";
    return typeof v === "number" && v >= 10000 ? v.toLocaleString("en-US") : String(v);
  }
  function valOf(x, k) {
    if (k === "bb") return x.bb ? x.bb.w * 10000 - x.bb.r : -1;
    if (k === "ov") return x.balls | 0;
    if (k === "dis") return dis(x);
    var v = x[k];
    if (typeof v === "number" && isFinite(v)) return v;
    return v != null && isFinite(+v) ? +v : -1;
  }
  // A MAN WHO HAS TAKEN NO WICKETS HAS NO AVERAGE - he does not have the BEST
  // one. The served row carries null for every figure that needs a denominator
  // it hasn't got, and those cells are marked so the sorter can sink them to
  // the bottom whichever way the column is pointing. Without this, one click
  // on "Ave" fills the top of the table with bowlers who have never taken a
  // wicket, which is the exact opposite of what the reader asked for.
  function blank(x, k) {
    if (k === "bb") return !x.bb;
    if (k === "ov" || k === "dis" || k === "hs") return false;
    return x[k] == null;
  }
  // the columns where SMALL IS GOOD, so a first click sorts the way a reader
  // means it: a bowling average of 12 belongs above one of 40. Runs conceded
  // is NOT one of them - fewest runs conceded is whoever bowled least.
  var LOW_GOOD = { bave: 1, er: 1, bsr: 1 };

  // ---- the scopes ----------------------------------------------------------
  var SCOPES = {
    club: { label: "My club", blurb: "your own eleven" },
    league: { label: "My league", blurb: "every club in your country" },
    world: { label: "The world", blurb: "every league on the planet at once" }
  };
  // NINE DOORS, NINE DIFFERENT SENTENCES. The index offers each book at each
  // scope; printing one blurb nine times reads as filler and tells a reader
  // nothing about which of the three he wants. Each says what THIS table holds.
  var SAY = {
    bat: {
      club: "Your own eleven at the crease &mdash; who is scoring them, how fast, and who is not.",
      league: "Every batsman in the country, ranked on the season&rsquo;s runs.",
      world: "Every batsman alive in one table, from the flagships to the smallest club."
    },
    bowl: {
      club: "What your attack has actually done: overs, wickets, economy and best figures.",
      league: "Every bowler in the country, ranked on wickets taken.",
      world: "Every bowler on the planet, measured against each other for once."
    },
    field: {
      club: "Your keeper&rsquo;s gloves and your fielders&rsquo; hands, counted.",
      league: "Catches, stumpings and run-outs across the whole country.",
      world: "The dismissals the batting book never credits, everywhere at once."
    }
  };

  // Which nations a scope needs, and the rows it keeps once they have landed.
  function gather(scope, natId) {
    var out = { rows: [], waiting: 0, total: 1, seasonNo: 0, rounds: 0 };
    var want = scope === "world" ? nations().map(function (r) { return r.id; }) : [natId];
    if (!want.length) want = [natId];
    out.total = want.length;
    var cl = claim();
    for (var i = 0; i < want.length; i++) {
      var e = bookOf(want[i]);
      if (e.players == null) { out.waiting++; continue; }
      out.seasonNo = out.seasonNo || e.seasonNo;
      out.rounds = Math.max(out.rounds, e.rounds || 0);
      for (var j = 0; j < e.players.length; j++) {
        var p = e.players[j];
        if (scope === "club") {
          if (!cl) continue;
          // the seat is the identity, not the name: two clubs in two nations
          // can be called the same thing, one slot cannot
          if (p.__c !== cl.country) continue;
          if (cl.slot != null ? p.slot !== cl.slot : p.club !== cl.club) continue;
        }
        out.rows.push(p);
      }
    }
    return out;
  }

  // ---- every column is a handle -------------------------------------------
  // One delegated listener. A click sorts by that column, a second reverses.
  // Rows are REORDERED IN PLACE - the <tr> nodes move, nothing is rebuilt - so
  // the table never snaps and the lit rows ride with their men.
  if (!window.__foStcSort) {
    window.__foStcSort = 1;
    document.addEventListener("click", function (ev) {
      var th = ev.target && ev.target.closest && ev.target.closest("table.fo-stc-tbl thead th");
      if (!th || th.classList.contains("rk")) return;
      var table = th.closest("table"), tb = table && table.tBodies[0]; if (!tb) return;
      var ths = [].slice.call(th.parentNode.children), ci = ths.indexOf(th);
      var isTxt = th.classList.contains("nm") || th.classList.contains("cl") || th.classList.contains("ct");
      var low = th.getAttribute("data-low") === "1";
      var dir = th.getAttribute("data-dir")
        ? (th.getAttribute("data-dir") === "desc" ? "asc" : "desc")
        : (isTxt || low ? "asc" : "desc");
      ths.forEach(function (h) { h.removeAttribute("data-dir"); });
      th.setAttribute("data-dir", dir);
      var key = function (tr) {
        var td = tr.cells[ci];
        if (!td) return isTxt ? "" : -Infinity;
        if (isTxt) return (td.textContent || "").trim().toLowerCase();
        var v = parseFloat(td.getAttribute("data-v"));
        return isFinite(v) ? v : -Infinity;
      };
      var noVal = function (tr) {
        var td = tr.cells[ci];
        return !!(td && td.getAttribute("data-nv") === "1");
      };
      var rows = [].slice.call(tb.rows);
      rows.sort(function (a, b) {
        var na = noVal(a), nb = noVal(b);
        if (na !== nb) return na ? 1 : -1;          // no figure at all: always last
        var ka = key(a), kb = key(b);
        var c = isTxt ? (ka < kb ? -1 : ka > kb ? 1 : 0) : ka - kb;
        return dir === "desc" ? -c : c;
      });
      rows.forEach(function (r) { tb.appendChild(r); });
      rows.forEach(function (r, i) {
        var rk = r.cells[0];
        if (rk && rk.classList.contains("rk")) rk.textContent = i + 1;
      });
    });
  }

  function css() {
    if (document.getElementById("fo-stc-css")) return;
    var s = document.createElement("style"); s.id = "fo-stc-css";
    s.textContent = [
      "html body #page .fo-stc{max-width:1180px;margin:22px auto 44px;padding:0 18px;color:#1B2432}",
      "html body #page .fo-stc-hero{background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F);border-radius:20px;padding:24px 26px 22px;box-shadow:0 20px 46px rgba(11,29,51,.34)}",
      "html body #page .fo-stc-hero .k{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-stc-hero h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:7px 0 10px;color:#FFFEFC;line-height:1.03}",
      "html body #page .fo-stc-hero p{margin:0;font:400 13.5px/1.55 Inter,sans-serif;color:rgba(244,239,228,.76);max-width:66ch}",
      "html body #page .fo-stc-now{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}",
      "html body #page .fo-stc-now span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:11px;padding:8px 13px 7px;font:600 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,239,228,.62)}",
      "html body #page .fo-stc-now span b{display:block;margin-bottom:4px;font:700 16px/1 Inter,sans-serif;letter-spacing:0;color:#FFFEFC;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:20ch}",
      // ---- the index --------------------------------------------------------
      "html body #page .fo-stc-sec{margin-top:26px}",
      "html body #page .fo-stc-sech{display:flex;align-items:center;gap:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#14243A;margin:0 2px 10px}",
      "html body #page .fo-stc-sech:after{content:'';flex:1;border-top:1px solid rgba(20,28,40,.14)}",
      "html body #page .fo-stc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:11px}",
      "html body #page .fo-stc-item{display:block;background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-left:3px solid rgba(180,74,34,.55);border-radius:4px 13px 13px 4px;padding:14px 15px 13px;text-decoration:none !important;box-shadow:0 5px 16px rgba(30,38,52,.05);transition:transform .13s ease,box-shadow .13s ease,border-color .13s ease}",
      "html body #page .fo-stc-item:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(30,38,52,.1);border-color:rgba(14,34,70,.3);border-left-color:#B44A22}",
      "html body #page .fo-stc-item b{display:block;font:600 16px/1.2 Fraunces,Georgia,serif;letter-spacing:-.01em;color:#14243A !important;margin-bottom:5px}",
      "html body #page .fo-stc-item span{display:block;font:400 13px/1.5 Inter,sans-serif;color:rgba(20,28,40,.6)}",
      "html body #page .fo-stc-item i{display:block;margin-top:8px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#B44A22 !important;font-style:normal}html body #page .fo-stc-item i:after{content:' \u203A'}",
      // the season's leaders, on the index
      // THE HONOURS BOARD - one board, not a stack of slabs. The winners share
      // a single navy plate the way they share a season; a hairline divides
      // them, the name is the thing that is large, and the how is a whisper.
      "html body #page .fo-stc-lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:0;background:#14243A;border-radius:16px;overflow:hidden;box-shadow:0 14px 34px rgba(11,29,51,.24)}",
      "html body #page .fo-stc-lead div{background:transparent;border-left:1px solid rgba(244,239,228,.12);padding:16px 18px 15px;color:#FFFDF7;min-width:0}",
      "html body #page .fo-stc-lead div:first-child{border-left:0}",
      "html body #page .fo-stc-lead i{display:block;font:600 10px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#E8B96A;font-style:normal;margin-bottom:8px}",
      "html body #page .fo-stc-lead b{display:block;font:600 19px/1.15 Fraunces,Georgia,serif;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-stc-lead em{display:block;margin-top:5px;font:400 13px/1.5 Inter,sans-serif;font-style:normal;font-variant-numeric:tabular-nums;color:rgba(244,239,228,.62)}",
      "@media(max-width:560px){html body #page .fo-stc-lead{grid-template-columns:1fr}html body #page .fo-stc-lead div{border-left:0;border-top:1px solid rgba(244,239,228,.12);padding:13px 18px 12px}html body #page .fo-stc-lead div:first-child{border-top:0}}",
      // ---- the table view ---------------------------------------------------
      "html body #page .fo-stc-back{display:inline-flex;align-items:center;min-height:30px;margin:16px 0 0;font:600 10px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.4) !important;text-decoration:none !important}",
      "html body #page .fo-stc-back:hover{color:#B44A22 !important}",
      // ---- the controls: type, not lozenges ---------------------------------
      "html body #page .fo-stc-ctl{margin:14px 0 0;border-top:1px solid rgba(20,28,40,.1);border-bottom:1px solid rgba(20,28,40,.1);padding:4px 0}",
      "html body #page .fo-stc-seg{display:flex;flex-wrap:wrap;gap:0 22px;padding:7px 2px}",
      "html body #page .fo-stc-seg+.fo-stc-seg,html body #page .fo-stc-filt{border-top:1px solid rgba(20,28,40,.06)}",
      "html body #page .fo-stc-seg a{position:relative;font:600 13px/1 Inter,sans-serif;letter-spacing:-.005em;color:rgba(20,28,40,.45) !important;text-decoration:none !important;padding:7px 0 8px;transition:color .12s ease}",
      "html body #page .fo-stc-seg a:hover{color:#1B2432 !important}",
      "html body #page .fo-stc-seg a.on{color:#14243A !important;font-weight:700}",
      "html body #page .fo-stc-seg a.on:after{content:'';position:absolute;left:0;right:0;bottom:2px;height:2px;border-radius:1px;background:#C9571F}",
      "html body #page .fo-stc-filt{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 22px}",
      "@media(max-width:520px){html body #page .fo-stc-filt{display:block}html body #page .fo-stc-qual{border-top:1px solid rgba(20,28,40,.06);width:100%}}",
      "html body #page .fo-stc-filt .fo-stc-seg{border-top:0;flex:1}",
      "html body #page .fo-stc-qual{display:inline-flex;align-items:center;gap:8px;padding:7px 2px 8px;font:500 13px/1 Inter,sans-serif;color:rgba(20,28,40,.45) !important;text-decoration:none !important}",
      "html body #page .fo-stc-qual i{width:15px;height:15px;border-radius:4px;border:1.5px solid rgba(20,28,40,.25);display:block;position:relative}",
      "html body #page .fo-stc-qual.on{color:#14243A !important;font-weight:600}",
      "html body #page .fo-stc-qual.on i{background:#C9571F;border-color:#C9571F}",
      "html body #page .fo-stc-qual.on i:after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid #FFFEFC;border-width:0 2px 2px 0;transform:rotate(42deg)}",
      "html body #page .fo-stc-panel{background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-radius:16px;padding:16px 16px 12px;margin-top:14px;box-shadow:0 6px 20px rgba(30,38,52,.055)}",
      "html body #page .fo-stc-ph{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px}",
      "html body #page .fo-stc-ph h2{margin:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:23px;letter-spacing:-.01em;color:#14243A}",
      "html body #page .fo-stc-sub{font:500 13px/1.4 Inter,sans-serif;color:rgba(20,28,40,.52)}",
      "html body #page .fo-stc-dim{font:400 13px/1.55 Inter,sans-serif;color:rgba(20,28,40,.5);margin:8px 2px}",
      "html body #page .fo-stc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:10px -4px 0}",
      // THE FOOT HAD NO RULE AT ALL, so its two links were laid out by whatever
      // the page around them happened to say, and on the record room they
      // landed on top of each other. It is a row now, with a gap it cannot
      // close and a wrap for when the two names are too long for one line.
      "html body #page .fo-stc-foot{display:flex;flex-wrap:wrap;justify-content:space-between;",
      "gap:10px 18px;margin:22px 0 6px;padding-top:14px;border-top:1px solid rgba(20,28,40,.10)}",
      "html body #page .fo-stc-foot a{flex:0 1 auto;font:600 13px/1.4 Inter,system-ui,sans-serif;",
      "color:#B44A22 !important;text-decoration:none}",
      // ---- the record: the year picker, the champions band, the old table ----
      // THE SEASON MASTHEAD - a programme cover, not a settings panel
      "html body #page .fo-stc-mast{display:flex;align-items:stretch;gap:6px;background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F);border-radius:18px;padding:20px 10px 17px;margin-bottom:14px;box-shadow:0 18px 40px rgba(11,29,51,.3)}",
      "html body #page .fo-stc-mast .mid{flex:1;min-width:0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px}",
      "html body #page .fo-stc-mast .mid i{font:600 10px/1 Oswald,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:#E8B96A;font-style:normal}",
      "html body #page .fo-stc-mast .mid b{font:600 clamp(30px,7.4vw,40px)/1.02 Oswald,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:#FFFEFC;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-mast .mid .of{font:400 13px/1.5 Inter,system-ui,sans-serif;color:rgba(244,239,228,.62)}",
      // the pickers are part of the board: ghost controls with a gold rule
      "html body #page .fo-stc-mast .pick{display:flex;gap:16px;margin-top:8px;max-width:100%}",
      "html body #page .fo-stc-mast .pick label{position:relative;display:inline-flex;align-items:center;min-width:0}",
      "html body #page .fo-stc-mast .pick label:after{content:'\\25BE';position:absolute;right:2px;pointer-events:none;font-size:10px;color:#E8B96A}",
      "html body #page .fo-stc-mast .pick select{appearance:none!important;-webkit-appearance:none!important;min-height:34px!important;max-width:44vw;padding:0 18px 0 4px!important;border:0!important;border-bottom:1px solid rgba(235,194,113,.5)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;font:600 12.5px/1 Inter,system-ui,sans-serif!important;color:#F4EFE4!important;font-variant-numeric:tabular-nums;cursor:pointer;text-overflow:ellipsis}",
      "html body #page .fo-stc-mast .pick select:focus{outline:none;border-bottom-color:#E8B96A}",
      "html body #page .fo-stc-mast .pick select option{color:#1B2432;background:#FFFEFC}",
      "html body #page .fo-stc-hstep{flex:0 0 auto;align-self:center;display:inline-flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;padding:4px 6px}",
      "html body #page .fo-stc-hstep u{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border:1.5px solid rgba(235,194,113,.45);border-radius:999px;text-decoration:none;font:400 19px/1 Inter,sans-serif;color:#E8B96A;transition:border-color .14s,color .14s}",
      "html body #page .fo-stc-hstep:hover u{border-color:#E8B96A;color:#FFFEFC}",
      "html body #page .fo-stc-hstep s{text-decoration:none;font:700 10px/1 Oswald,sans-serif;letter-spacing:.12em;color:rgba(244,239,228,.55);font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-hstep.off{opacity:.22;pointer-events:none}",
      "html body #page .fo-stc-hhead h2{margin:2px 0 2px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:24px;color:#1B2432}",
      "html body #page .fo-stc-ck{font:600 10px/1 Oswald,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#B44A22;margin:14px 0 6px}",
      "html body #page .fo-stc-hhead h2 s{text-decoration:none;font:600 10px/1 Oswald,sans-serif;letter-spacing:.15em;text-transform:uppercase;color:rgba(20,28,40,.45);margin-left:12px;vertical-align:3px;white-space:nowrap;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-htb tr.ch td{background:rgba(47,107,69,.07)}",
      "html body #page .fo-stc-htb tr.ch em{font-style:normal;margin-left:6px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.14em;color:#2F6B45}",
      // THE RECORD KEEPS ITS OWN TABLE. It borrowed the book's chrome at first
      // and lost every numeric column off the right-hand edge, because that
      // table is built to be wide and scrolled and this one has to fit a phone
      // whole. Fixed layout, a club column that takes what is left, and seven
      // narrow columns that are always there.
      "html body #page .fo-stc-htb{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:6px;font:400 12.5px/1.4 Inter,system-ui,sans-serif;color:#1B2432}",
      "html body #page .fo-stc-htb th{padding:7px 3px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.45);border-bottom:1px solid rgba(20,28,40,.16)}",
      "html body #page .fo-stc-htb td{padding:8px 3px;border-bottom:1px solid rgba(20,28,40,.07)}",
      "html body #page .fo-stc-htb th:first-child,html body #page .fo-stc-htb td:first-child{width:24px;text-align:right;color:rgba(20,28,40,.45)}",
      "html body #page .fo-stc-htb th:nth-child(2),html body #page .fo-stc-htb td:nth-child(2){text-align:left;width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-stc-htb td:nth-child(2) a{text-decoration:none;color:#1B2432 !important;font-weight:600}",
      "html body #page .fo-stc-htb th.r,html body #page .fo-stc-htb td.r{text-align:right;width:26px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-htb th:last-child,html body #page .fo-stc-htb td:last-child{width:44px;color:rgba(20,28,40,.6)}",
      "html body #page .fo-stc-htb tr.ch td:nth-child(2) a{color:#2F6B45 !important}",
      "html body #page .fo-stc-htb tr.ch td{background:rgba(47,107,69,.08)}",
      "html body #page .fo-stc-htb tr.ch em{font-style:normal;margin-left:5px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.12em;color:#2F6B45}",
      "@media(max-width:430px){html body #page .fo-stc-htb:not(.bk) th:nth-child(6),html body #page .fo-stc-htb:not(.bk) td:nth-child(6){display:none}}",
      // the books carry a name and a line under it, so they scroll rather than
      // squeeze - a career is worth a sideways swipe
      // the careers ledger: fixed layout, a flag for the nation, four figures
      "html body #page .fo-stc-ldg{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:6px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-ldg th{padding:8px 3px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42);border-bottom:1px solid rgba(20,28,40,.5);text-align:right}",
      "html body #page .fo-stc-ldg th:nth-child(2){text-align:left}",
      "html body #page .fo-stc-ldg td{padding:9px 3px;border-bottom:1px solid rgba(20,28,40,.08);text-align:right;font:500 13px/1.35 Inter,system-ui,sans-serif;color:rgba(20,28,40,.72)}",
      "html body #page .fo-stc-ldg tr:nth-child(odd) td{background:rgba(20,28,40,.022)}",
      "html body #page .fo-stc-ldg .rk{width:22px;color:rgba(20,28,40,.38);font-size:11.5px}",
      "html body #page .fo-stc-ldg td.who{text-align:left;overflow:hidden}",
      "html body #page .fo-stc-ldg td.who .wr{display:flex;align-items:center;gap:8px;min-width:0}",
      "html body #page .fo-stc-ldg td.who img{width:22px;height:15px;flex:none;object-fit:cover;border-radius:2px;box-shadow:0 0 0 1px rgba(20,28,40,.14)}",
      "html body #page .fo-stc-ldg td.who span{min-width:0}",
      "html body #page .fo-stc-ldg td.who b{display:block;font:600 13.5px/1.2 Inter,system-ui,sans-serif;color:#1B2432;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-stc-ldg td.who em{font-style:normal;font:400 12px/1.4 Inter,system-ui,sans-serif;color:rgba(20,28,40,.42);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}",
      "html body #page .fo-stc-ldg td.who b .bs{font-style:normal;color:#C9571F;font-size:10px;margin-right:4px;vertical-align:1px}",
      "html body #page .fo-stc-ldg th:nth-child(3),html body #page .fo-stc-ldg td.big{width:56px}html body #page .fo-stc-ldg td.big{font-weight:700;color:#1B2432}",
      "html body #page .fo-stc-ldg th:nth-child(4),html body #page .fo-stc-ldg td:nth-child(4){width:42px}",
      "html body #page .fo-stc-ldg th:nth-child(5),html body #page .fo-stc-ldg td:nth-child(5){width:46px}",
      "html body #page .fo-stc-ldg th:nth-child(6),html body #page .fo-stc-ldg td:nth-child(6){width:30px}",
      // A NAME IS THE POINT OF THE LIST. On a phone the figures were taking
      // 174px of a 361px table and the men were coming out as "Sir..." - so
      // the numerals give a little back and the name column keeps whole names.
      "@media(max-width:430px){" +
        "html body #page .fo-stc-ldg .rk{width:17px;font-size:10.5px}" +
        "html body #page .fo-stc-ldg td.who .wr{gap:6px}" +
        "html body #page .fo-stc-ldg td.who img{width:19px;height:13px}" +
        "html body #page .fo-stc-ldg td.who b{font-size:12.5px}" +
        "html body #page .fo-stc-ldg td{font-size:12px;padding:9px 2px}" +
        "html body #page .fo-stc-ldg th:nth-child(3),html body #page .fo-stc-ldg td.big{width:47px}" +
        "html body #page .fo-stc-ldg th:nth-child(4),html body #page .fo-stc-ldg td:nth-child(4){width:36px}" +
        "html body #page .fo-stc-ldg th:nth-child(5),html body #page .fo-stc-ldg td:nth-child(5){width:39px}" +
        "html body #page .fo-stc-ldg th:nth-child(6),html body #page .fo-stc-ldg td:nth-child(6){width:25px}" +
      "}",
      "html body #page .fo-stc-htb.bk{table-layout:auto;min-width:520px}",
      "html body #page .fo-stc-htb.bk td:nth-child(2) u{display:block;text-decoration:none;font:400 12px/1.35 Inter,system-ui,sans-serif;color:rgba(20,28,40,.5)}",
      "html body #page .fo-stc-htb.bk th.r,html body #page .fo-stc-htb.bk td.r{width:auto;padding-left:9px}",
      // the careers room's two choosers are the shared line of words (.fo-seg)
      // ---- the table -------------------------------------------------------
      // A SOLID NAVY HEADER BAND with white condensed capitals is a spreadsheet
      // wearing a suit: it puts the loudest thing on the page above the quietest
      // and makes the figures fight it. The head is now the same paper as the
      // rows, held down by a single rule, and the weight moved to where the
      // reading is - the name and the number.
      "html body #page table.fo-stc-tbl{border-collapse:collapse;width:100%;min-width:660px;font-variant-numeric:tabular-nums}",
      "html body #page table.fo-stc-tbl th{position:sticky;top:0;z-index:1;background:#FFFEFC;color:rgba(20,28,40,.45);font:600 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:right;padding:0 8px 10px;white-space:nowrap;cursor:pointer;-webkit-user-select:none;user-select:none;box-shadow:inset 0 -1px 0 rgba(20,28,40,.16)}",
      "html body #page table.fo-stc-tbl th.rk,html body #page table.fo-stc-tbl th.nm,html body #page table.fo-stc-tbl th.cl,html body #page table.fo-stc-tbl th.ct{text-align:left}",
      "html body #page table.fo-stc-tbl th.rk{cursor:default}",
      "html body #page table.fo-stc-tbl th:hover{color:#1B2432}",
      "html body #page table.fo-stc-tbl th[data-dir]{color:#B44A22;box-shadow:inset 0 -2px 0 #C9571F}",
      "html body #page table.fo-stc-tbl th[data-dir=&#39;desc&#39;]:after{content:' \\25BE'}",
      "html body #page table.fo-stc-tbl th[data-dir=&#39;asc&#39;]:after{content:' \\25B4'}",
      // figures in Inter, not the condensed poster face; the name carries the weight
      "html body #page table.fo-stc-tbl td{padding:9px 8px;text-align:right;white-space:nowrap;font:500 12.5px/1.2 Inter,sans-serif;color:rgba(20,28,40,.78);border-bottom:1px solid rgba(20,28,40,.055)}",
      "html body #page table.fo-stc-tbl td.rk{text-align:left;font-weight:400;color:rgba(20,28,40,.3);font-size:11px}",
      "html body #page table.fo-stc-tbl td.nm,html body #page table.fo-stc-tbl td.cl,html body #page table.fo-stc-tbl td.ct{text-align:left}",
      "html body #page table.fo-stc-tbl td.nm{font-weight:600;color:#1B2432}",
      "html body #page table.fo-stc-tbl td.cl,html body #page table.fo-stc-tbl td.ct{font-size:11.5px;font-weight:400;color:rgba(20,28,40,.45)}",
      "html body #page table.fo-stc-tbl td.nm a{color:#1B2432 !important;text-decoration:none !important}",
      "html body #page table.fo-stc-tbl td.nm a:hover{color:#B44A22 !important}",
      "html body #page table.fo-stc-tbl td.cl a{color:rgba(20,28,40,.45) !important;text-decoration:none !important}",
      // the leading column of a row a reader is scanning: the first three
      // figures after the name get full ink, the tail recedes
      "html body #page table.fo-stc-tbl tbody tr:hover td{background:rgba(20,28,40,.028)}",
      "html body #page table.fo-stc-tbl tbody tr.mine td{background:rgba(201,87,31,.07)}",
      "html body #page table.fo-stc-tbl tbody tr.mine td:first-child{box-shadow:inset 2px 0 0 #C9571F}",
      "html body #page table.fo-stc-tbl tbody tr.mine td.nm a{color:#B44A22 !important;font-weight:700}",
      "html body #page .fo-stc-note{margin-top:22px;background:rgba(14,34,70,.045);border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:15px 17px 13px}",
      "html body #page .fo-stc-note h3{margin:0 0 8px;font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#14243A}",
      "html body #page .fo-stc-note ul{margin:0;padding-left:17px}",
      "html body #page .fo-stc-note li{font:400 12.5px/1.6 Inter,sans-serif;color:rgba(20,28,40,.72);margin-bottom:5px}",
      "html body #page .fo-stc-note li b{font-weight:700;color:#14243A}",
      "@media(max-width:640px){",
      "html body #page .fo-stc{padding:0 12px}",
      "html body #page .fo-stc-hero{padding:18px 17px 17px;border-radius:16px}",
      "html body #page .fo-stc-hero h1{font-size:30px}",
      "html body #page .fo-stc-grid{grid-template-columns:1fr}",
      "html body #page table.fo-stc-tbl th,html body #page table.fo-stc-tbl td{padding:7px 6px}}",
      // ---- THE DATA WALL (the manager's pick of six) ------------------------
      "html body #page .fo-stw{max-width:860px;margin:18px auto 0;background:linear-gradient(168deg,#182B44,#0C1B2E);border-radius:20px;padding:13px 12px 12px;box-shadow:0 20px 46px rgba(11,29,51,.34)}",
      "html body #page .fo-stw-hd{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:5px 5px 12px}",
      "html body #page .fo-stw-hd i{display:block;font:600 10px/1 Oswald,sans-serif;font-style:normal;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A;margin-bottom:6px}",
      "html body #page .fo-stw-hd b{font:700 22px/1 Oswald,sans-serif;letter-spacing:.02em;text-transform:uppercase;color:#FFFDF7}",
      "html body #page .fo-stw-hd>span{font:600 10px/1.5 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,239,228,.5)}",
      "html body #page .fo-stw-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}",
      "html body #page .fo-stw-kpi{border:1px solid rgba(232,185,106,.18);border-radius:11px;background:rgba(255,253,247,.05);padding:10px 11px;min-width:0}",
      "html body #page .fo-stw-kpi span{display:block;font:700 10px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(241,238,230,.5)}",
      "html body #page .fo-stw-kpi b{display:block;font:700 18px/1 Inter,sans-serif;color:#FFFDF7;margin-top:7px;font-variant-numeric:tabular-nums;white-space:nowrap}",
      "html body #page .fo-stw-grid{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px}",
      "@media(min-width:840px){html body #page .fo-stw-grid{grid-template-columns:1fr 1fr}}",
      "html body #page .fo-stw-sec{border:1px solid rgba(232,185,106,.16);border-radius:14px;background:rgba(255,253,247,.04);padding:13px 14px;min-width:0}",
      "html body #page .fo-stw-cap{font:700 10px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-stw-row{display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:4px 9px;align-items:center;margin-top:10px}",
      "html body #page .fo-stw-row em{font:700 12px/1 Inter,sans-serif;font-style:normal;color:rgba(244,239,228,.45);font-variant-numeric:tabular-nums}",
      "html body #page .fo-stw-row a.nm{font:600 12.5px/1.2 Inter,sans-serif;color:#F1EEE6 !important;text-decoration:none !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}",
      "html body #page .fo-stw-row a.nm:hover{color:#E8B96A !important}",
      "html body #page .fo-stw-row a.nm i{font:600 10px/1 Inter,sans-serif;font-style:normal;color:rgba(244,239,228,.45);margin-left:6px;letter-spacing:.04em}",
      "html body #page .fo-stw-row .v{font:700 13.5px/1 Inter,sans-serif;color:#FFFDF7;font-variant-numeric:tabular-nums;text-align:right}",
      "html body #page .fo-stw-row .rl{grid-column:2/4;display:block;position:relative;height:6px;border-radius:999px;background:rgba(255,253,247,.09);overflow:hidden}",
      "html body #page .fo-stw-row .rl u{position:absolute;top:0;bottom:0;left:0;border-radius:999px;background:linear-gradient(90deg,#E8B96A,#C08A2E)}",
      "html body #page .fo-stw-row .rl u.t{background:linear-gradient(90deg,#63B7B3,#3E8A86)}",
      "html body #page a.fo-stw-all{display:inline-block;margin-top:12px;font:700 10px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#E8B96A !important;text-decoration:none !important}",
      "html body #page a.fo-stw-all:hover{color:#FFFDF7 !important}",
      "html body #page .fo-stw-duo{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}",
      "html body #page a.fo-stw-mini{display:block;border:1px solid rgba(232,185,106,.16);border-radius:12px;background:rgba(255,253,247,.04);padding:11px 12px;text-decoration:none !important;min-width:0}",
      "html body #page a.fo-stw-mini span{display:block;font:700 10px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,239,228,.5)}",
      "html body #page a.fo-stw-mini b{display:block;font:700 22px/1 Inter,sans-serif;color:#FFFDF7;margin-top:7px;font-variant-numeric:tabular-nums}",
      "html body #page a.fo-stw-mini i{display:block;font:500 12px/1.35 Inter,sans-serif;font-style:normal;color:rgba(244,239,228,.55);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      // the contents list: doors, not a remote control of pills
      "html body #page .fo-stw-doors{margin-top:10px;border:1px solid rgba(232,185,106,.16);border-radius:14px;background:rgba(255,253,247,.04);overflow:hidden}",
      "html body #page a.fo-stw-door{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:baseline;gap:12px;padding:13px 15px;border-top:1px solid rgba(232,185,106,.12);text-decoration:none !important;min-height:46px}",
      "html body #page a.fo-stw-door:first-child{border-top:0}",
      "html body #page a.fo-stw-door:hover{background:rgba(255,253,247,.04)}",
      "html body #page a.fo-stw-door b{font:700 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#E8B96A !important;white-space:nowrap}",
      "html body #page a.fo-stw-door i{font:400 13px/1.4 Inter,sans-serif;font-style:normal;color:rgba(244,239,228,.5);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}",
      "html body #page a.fo-stw-door s{text-decoration:none;font:400 17px/1 Fraunces,Georgia,serif;color:rgba(235,194,113,.6);align-self:center}",
      "html body #page .fo-stw-dim{margin:12px 4px 4px;font:400 12.5px/1.55 Fraunces,Georgia,serif;color:rgba(244,239,228,.6)}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ONE PLACE BUILDS A LINK INTO THIS PAGE, so changing book or scope keeps
  // the filters a reader has already set instead of silently resetting them.
  // The division filter is dropped on the club scope, where it means nothing.
  function href(v, sc, q, d) {
    return "#/stats?v=" + v + "&sc=" + sc + (q ? "&q=1" : "") + (d && sc !== "club" ? "&d=" + d : "");
  }

  // ---- the index: THE DATA WALL --------------------------------------------
  // The manager was shown six directions and picked the dark console: the
  // figures up top, the run chart and the wicket chart as labelled bars -
  // gold for the bat, teal for the ball - the two one-day feats as tiles,
  // and every book a chip. The old index was nine doors, six more doors and
  // a five-point essay on how to read a table; the wall says the season at
  // a glance and each chip is one tap into the full sortable book.
  function indexBody(natId, mine) {
    var g = gather("league", natId);
    var rounds = g.rounds;
    var sN = g.seasonNo ? (window.foSeasonN ? window.foSeasonN(g.seasonNo) : g.seasonNo) : 0;
    var shortNm = function (n) { try { return window.foShortName ? window.foShortName(n) : n; } catch (e) { return n; } };
    var abbr = function (club) {
      var w = String(club || "").replace(/[^A-Za-z ]/g, "").trim().split(/\s+/)[0] || "";
      return w.slice(0, 3).toUpperCase();
    };
    var chart = function (title, rows, valFn, cellFn, teal, bookHref) {
      if (!rows.length) return "";
      var max = valFn(rows[0]) || 1;
      var trs = rows.map(function (x, i) {
        var v = valFn(x);
        return "<div class='fo-stw-row'><em>" + (i + 1) + "</em>" +
          "<a class='nm' href='#/player?c=" + encodeURIComponent(x.__c) + "&s=" + x.slot +
          "&n=" + encodeURIComponent(x.name) + "'>" + E(shortNm(x.name)) + "<i>" + E(abbr(x.club)) + "</i></a>" +
          "<b class='v'>" + cellFn(x) + "</b>" +
          "<span class='rl'><u" + (teal ? " class='t'" : "") + " style='width:" +
          Math.max(3, Math.round(100 * v / max)) + "%'></u></span></div>";
      }).join("");
      return "<div class='fo-stw-sec'><div class='fo-stw-cap'>" + title + "</div>" + trs +
        "<a class='fo-stw-all' href='" + bookHref + "'>The whole book &rsaquo;</a></div>";
    };

    var charts = "", duo = "";
    if (g.rows.length) {
      var bats = g.rows.filter(BOOKS.bat.keep);
      var topRuns = bats.slice().sort(BOOKS.bat.sort).slice(0, 5);
      var topWkts = g.rows.filter(BOOKS.bowl.keep).sort(BOOKS.bowl.sort).slice(0, 5);
      var byHs = bats.slice().sort(function (a, b) { return b.hs - a.hs || b.sr - a.sr; })[0];
      var byBb = g.rows.filter(function (x) { return x.bb && x.bb.w; })
        .sort(function (a, b) { return valOf(b, "bb") - valOf(a, "bb"); })[0];
      charts = "<div class='fo-stw-grid'>" +
        chart("Most runs &middot; " + E(natName(natId)), topRuns,
          function (x) { return x.runs | 0; }, function (x) { return x.runs; }, false, href("bat", "league")) +
        chart("Most wickets &middot; " + E(natName(natId)), topWkts,
          function (x) { return x.wkts | 0; }, function (x) { return x.wkts; }, true, href("bowl", "league")) +
        "</div>";
      var mini = function (t, man, big) {
        if (!man) return "";
        return "<a class='fo-stw-mini' href='#/player?c=" + encodeURIComponent(man.__c) + "&s=" + man.slot +
          "&n=" + encodeURIComponent(man.name) + "'><span>" + t + "</span><b>" + big + "</b>" +
          "<i>" + E(shortNm(man.name)) + " &middot; " + E(man.club) + "</i></a>";
      };
      duo = "<div class='fo-stw-duo'>" +
        mini("Highest score", byHs, byHs ? byHs.hs + (byHs.hsNo ? "*" : "") : "") +
        mini("Best bowling", byBb, byBb && byBb.bb ? byBb.bb.w + "&#8209;" + byBb.bb.r : "") +
        "</div>";
    } else if (g.waiting) {
      charts = "<p class='fo-stw-dim'>Sending for the scorebooks&hellip;</p>";
    } else {
      charts = "<p class='fo-stw-dim'>No cricket has been played yet this season. The wall fills with the first round.</p>";
    }

    // NO BUTTON MENUS - the manager's standing rule. A wall of pills is a
    // remote control; a reader wants a contents list. Each book is a door: a
    // name, what is inside it, and a chevron. The scope pills went entirely -
    // every book carries its own scope line once it is open.
    var door = function (label, note, to) {
      return "<a class='fo-stw-door' href='" + to + "'><b>" + label + "</b><i>" + note + "</i><s>&rsaquo;</s></a>";
    };
    var chips = "<div class='fo-stw-doors'>" +
      door("Batting", "runs &middot; average &middot; strike rate", href("bat", "league")) +
      door("Bowling", "wickets &middot; economy &middot; best figures", href("bowl", "league")) +
      door("Fielding", "catches &middot; stumpings &middot; run-outs", href("field", "league")) +
      door("The record", "every season this league has played", "#/stats?v=hist&n=" + encodeURIComponent(natId)) +
      door("All-time careers", "whole careers, ranked", "#/stats?v=career&n=" + encodeURIComponent(natId)) +
      "</div>";

    return "<div class='fo-stw'>" +
      "<div class='fo-stw-hd'><div><i>Every run was played</i><b>Stats Centre</b></div>" +
      "<span>" + E(natName(natId)) + (rounds ? " &middot; after round " + rounds : "") + "</span></div>" +
      "<div class='fo-stw-kpis'>" +
      (sN ? "<div class='fo-stw-kpi'><span>Season</span><b>" + sN + "</b></div>" : "") +
      "<div class='fo-stw-kpi'><span>Rounds</span><b>" + rounds + " / 14</b></div>" +
      (nations().length ? "<div class='fo-stw-kpi'><span>Leagues</span><b>" + nations().length + "</b></div>" : "") +
      "</div>" +
      charts + duo + chips +
      "</div>";
  }

  // ---- a book ---------------------------------------------------------------
  function tableBody(bookKey, scope, natId, mine, qualOn, divPick) {
    var BK = BOOKS[bookKey];
    var g = gather(scope, natId);
    var rounds = g.rounds;

    // THE CONTROLS WERE THREE STACKS OF PILLS - eleven lozenges in rows,
    // taking a third of a phone screen before a single figure appeared, and
    // every one of them shouting in navy or grey. A statistician does not need
    // eleven buttons; he needs to know which book he is in and be able to
    // change it. So: one line of quiet type per axis, the live one underlined
    // in rust, the rest in ink at 45%. Nothing shouts, nothing is a lozenge,
    // and the whole control surface is shorter than one of the old rows.
    var seg = function (items, cur, mk) {
      return "<div class='fo-stc-seg'>" + items.map(function (it) {
        return "<a class='" + (it[0] === cur ? "on" : "") + "' href='" + mk(it[0]) + "'>" + it[1] + "</a>";
      }).join("") + "</div>";
    };
    var scopes = (mine ? [["club", "My club"], ["league", "My league"], ["world", "The world"]]
                       : [["league", "My league"], ["world", "The world"]]);
    var controls =
      "<div class='fo-stc-ctl'>" +
      seg(scopes, scope, function (k) { return href(bookKey, k, qualOn, divPick); }) +
      seg([["bat", "Batting"], ["bowl", "Bowling"], ["field", "Fielding"]], bookKey,
          function (k) { return href(k, scope, qualOn, divPick); }) +
      "<div class='fo-stc-filt'>" +
      (scope === "club" ? "" : seg([["", "Both divisions"], ["1", "Division One"], ["2", "Division Two"]], divPick,
          function (k) { return href(bookKey, scope, qualOn, k); })) +
      "<a class='fo-stc-qual" + (qualOn ? " on" : "") + "' href='" + href(bookKey, scope, !qualOn, divPick) + "'>" +
      "<i></i>Qualified only</a></div></div>";
    var body;
    if (!g.rows.length && g.waiting) {
      body = "<p class='fo-stc-dim'>Sending for " + (g.waiting > 1 ? g.waiting + " scorebooks" : "the scorebook") + "&hellip;</p>";
    } else {
      var rows = g.rows.filter(BK.keep);
      if (divPick) rows = rows.filter(function (x) { return String(x.div || 1) === divPick; });
      if (qualOn) rows = rows.filter(function (x) { return BK.qual(x, rounds); });
      rows = rows.sort(BK.sort);
      if (!rows.length) {
        body = "<p class='fo-stc-dim'>Nobody here has " + BK.empty + " yet" +
          (qualOn ? ", or nobody has played enough of the season to qualify" : "") + ".</p>";
      } else {
        // A COLUMN THAT SAYS THE SAME THING ON EVERY ROW IS NOT A COLUMN. On
        // your own club the club name is a constant and every man is yours, so
        // the club column goes and the "these are yours" tint goes with it -
        // a table lit end to end tells a reader nothing.
        var wide = scope === "world", ownScope = scope === "club";
        var head = "<tr><th class='rk'>#</th><th class='nm'>Player</th>" +
          (ownScope ? "" : "<th class='cl'>Club</th>") +
          (wide ? "<th class='ct'>Country</th>" : "") +
          BK.cols.map(function (c) {
            return "<th" + (LOW_GOOD[c[0]] ? " data-low='1'" : "") + ">" + c[1] + "</th>";
          }).join("") + "</tr>";
        var shown = rows.slice(0, 300);
        var trs = shown.map(function (x, ix) {
          var isMine = !ownScope && mine && x.__c === mine.country &&
            (mine.slot != null ? x.slot === mine.slot : x.club === mine.club);
          return "<tr" + (isMine ? " class='mine'" : "") + ">" +
            "<td class='rk'>" + (ix + 1) + "</td>" +
            "<td class='nm'><a href='#/player?c=" + encodeURIComponent(x.__c) + "&s=" + x.slot +
              "&n=" + encodeURIComponent(x.name) + "'>" + E(x.name) + "</a></td>" +
            (ownScope ? "" : "<td class='cl'><a href='#/team?c=" + encodeURIComponent(x.__c) + "&s=" + x.slot + "'>" + E(x.club) + "</a></td>") +
            (wide ? "<td class='ct'>" + E(natName(x.__c)) + "</td>" : "") +
            BK.cols.map(function (c) {
              return "<td data-v='" + valOf(x, c[0]) + "'" + (blank(x, c[0]) ? " data-nv='1'" : "") + ">" +
                cellOf(x, c[0]) + "</td>";
            }).join("") + "</tr>";
        }).join("");
        body = "<div class='fo-stc-scroll'><table class='fo-stc-tbl'><thead>" + head +
          "</thead><tbody>" + trs + "</tbody></table></div>" +
          "<p class='fo-stc-dim'>" +
          (rows.length > shown.length ? "The first " + shown.length + " of " + rows.length + " men. " : rows.length + " men. ") +
          (qualOn ? "Qualified: " + BK.qualSay(rounds) + "." : "Every man who has " + BK.empty + ".") +
          (g.waiting ? " " + g.waiting + " more " + (g.waiting === 1 ? "league is" : "leagues are") + " still coming in." : "") +
          "</p>";
      }
    }

    var where = scope === "club" ? (mine && mine.club) || "Your club"
      : scope === "league" ? natName(natId) : "The world";
    // the ONE season number (foSeasonN): the served counter starts at 1, the
    // record starts 136 earlier, and this chip was printing the raw counter
    // while the masthead said 137
    var chips =
      (g.seasonNo ? "<span><b>" + (window.foSeasonN ? window.foSeasonN(g.seasonNo) : g.seasonNo) + "</b>Season</span>" : "") +
      "<span><b>" + rounds + " / 14</b>Rounds played</span>" +
      "<span><b>" + E(where) + "</b>Scope</span>";

    return "<div class='fo-stc-hero'><div class='k'>Stats Centre &middot; " + E(where) + "</div>" +
      "<h1>" + BK.short + "</h1>" +
      "<p>" + SAY[bookKey][scope] + "</p>" +
      "<div class='fo-stc-now'>" + chips + "</div></div>" +
      "<a class='fo-stc-back' href='#/stats'>&lsaquo; All the books</a>" +
      controls +
      "<div class='fo-stc-panel'><div class='fo-stc-ph'><h2>" + BK.short + "</h2>" +
      "<span class='fo-stc-sub'>" + E(where) + " &middot; after round " + rounds + "</span></div>" +
      body + "</div>";
  }


  /* ==========================================================================
     THE RECORD (#/stats?v=hist) — every season this league has ever played.
     The scorebook above is this season's. This is the other hundred and
     thirty-five: pick a year and read the table that decided it, who took the
     championship, who took the cup, and what the world was doing that summer.
     All of it derived from the seed - nothing stored, nothing fetched.
     ========================================================================== */
  function PL9() { try { return window.__foPlanet || null; } catch (e) { return null; } }
  function ord(n) {
    var v = n | 0, s2 = (v % 100 >= 11 && v % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" })[v % 10] || "th";
    return v + s2;
  }
  function histBody(natId, wantYear) {
    var P = PL9();
    if (!P || !P.histYear) return "<div class='fo-stc-sec'><p class='fo-stc-dim'>The record is still waking up.</p></div>";
    var span = P.histSpan(natId);
    if (!span.seasons) return "<div class='fo-stc-sec'><p class='fo-stc-dim'>" + E(natName(natId)) + " has no record before this season.</p></div>";
    var year = parseInt(wantYear, 10);
    if (!(year >= span.from && year <= span.to)) year = span.to;
    while (year >= span.from && !P.histYear(natId, year)) year--;
    var h = P.histYear(natId, year);
    if (!h) return "<div class='fo-stc-sec'><p class='fo-stc-dim'>No season was played in " + year + ".</p></div>";

    var sides = [];
    try { sides = P.sidesOf(natId) || []; } catch (e) {}
    var nmOf = function (slot) {
      for (var i = 0; i < sides.length; i++) if ((sides[i].slot | 0) === (slot | 0)) return sides[i].name;
      return "Club " + slot;
    };
    var teamHref = function (slot) { return "#/team?c=" + encodeURIComponent(natId) + "&s=" + slot; };

    // the years, newest first, as one picker - every season is one tap away
    // A SEASON IS NOT A YEAR - six weeks, not twelve months - so the record
    // is walked in season numbers. The year stays as the internal key because
    // that is how the seasons are generated; nothing prints it.
    var sN = function (yy) { return P.sIdx ? P.sIdx(yy) : yy; };
    var opts = "";
    for (var y = span.to; y >= span.from; y--) {
      if (!P.histYear(natId, y)) continue;
      opts += "<option value='" + y + "'" + (y === year ? " selected" : "") + ">Season " + sN(y) + "</option>";
    }
    var natOpts = (P.nations() || []).map(function (r) {
      return "<option value='" + E(r.id) + "'" + (r.id === natId ? " selected" : "") + ">" + E(r.nm) + "</option>";
    }).join("");

    var prevY = null, nextY = null;
    for (y = year - 1; y >= span.from; y--) if (P.histYear(natId, y)) { prevY = y; break; }
    for (y = year + 1; y <= span.to; y++) if (P.histYear(natId, y)) { nextY = y; break; }
    // a chevron disc either side of the number; the season it walks to rides
    // underneath so the tap still says where it goes
    var step = function (yy, pre, post) {
      var arrow = pre || post;
      if (yy == null) return "<span class='fo-stc-hstep off'><u>" + arrow + "</u></span>";
      return "<a class='fo-stc-hstep' href='#/stats?v=hist&n=" + encodeURIComponent(natId) + "&y=" + yy +
        "' aria-label='Season " + sN(yy) + "'><u>" + arrow + "</u><s>S" + sN(yy) + "</s></a>";
    };

    var rows = h.table.map(function (r, i) {
      var win = i === 0;
      return "<tr class='" + (win ? "ch" : "") + "'><td class='r'>" + (i + 1) + "</td>" +
        "<td><a href='" + teamHref(r.slot) + "'>" + E(nmOf(r.slot)) + "</a></td>" +
        "<td class='r'>" + r.p + "</td><td class='r'>" + r.w + "</td><td class='r'>" + r.l + "</td>" +
        "<td class='r'>" + r.t + "</td><td class='r'><b>" + r.pts + "</b></td>" +
        "<td class='r'>" + (r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(2) + "</td></tr>";
    }).join("");

    // what the world was doing that summer
    var world = [];
    try {
      var cr = P.crownYear(year);
      if (cr) world.push("<div><i>Champions Cup</i><b><a href='#/team?c=" + encodeURIComponent(cr.rid) + "&s=" + cr.slot + "'>" +
        E(natName(cr.rid)) + "</a></b><em>" + E(natName(cr.rid)) + "'s champions took the world crown</em></div>");
      var wc = P.wcYear(year);
      if (wc) world.push("<div><i>World Cup</i><b>" + E(wc.name) + "</b><em>beat " + E(wc.runnerName || "the field") + " in the final</em></div>");
    } catch (e) {}

    var champ = nmOf(h.champion);
    var cupTxt = h.cup == null ? "not played" : nmOf(h.cup);
    /* THE MASTHEAD IS THE SEASON. The first draft opened with a row of bare
     * form controls - a grey pill, two native selects - which is a settings
     * panel, not a record book. The season now stands like a programme cover:
     * chevrons either side of the number, and the pickers dressed as part of
     * the board rather than bolted above it. */
    return "<div class='fo-stc-sec fo-stc-hhead'>" +
      "<div class='fo-stc-mast'>" +
      step(prevY, "&lsaquo;", "") +
      "<div class='mid'>" +
      "<i>" + E(natName(natId)) + " &middot; the record</i>" +
      "<b>Season " + sN(year) + "</b>" +
      "<span class='of'>" + ord(year - span.from + 1) + " of " + span.seasons +
      " &middot; first played in Season " + sN(span.from) + "</span>" +
      "<span class='pick'>" +
      "<label><select id='fo-stc-hy' aria-label='Season'>" + opts + "</select></label>" +
      "<label><select id='fo-stc-hn' aria-label='League'>" + natOpts + "</select></label>" +
      "</span></div>" +
      step(nextY, "", "&rsaquo;") + "</div>" +
      "<div class='fo-stc-lead'>" +
      "<div><i>&#127942; Champions</i><b><a href='" + teamHref(h.champion) + "'>" + E(champ) + "</a></b><em>" + h.table[0].pts + " points from " + h.rounds + " rounds</em></div>" +
      "<div><i>National Cup</i><b>" + (h.cup == null ? "&mdash;" : "<a href='" + teamHref(h.cup) + "'>" + E(cupTxt) + "</a>") + "</b><em>" + (h.cup == null ? "not played that year" : "won the knockout") + "</em></div>" +
      world.join("") + "</div></div>" +
      "<div class='fo-stc-sec'><div class='fo-stc-sech'>The table</div>" +
      "<div class='fo-stc-scroll'><table class='fo-stc-htb fo-fits'>" +
      "<thead><tr><th class='r'>#</th><th>Club</th><th class='r'>P</th><th class='r'>W</th><th class='r'>L</th>" +
      "<th class='r'>T</th><th class='r'>Pts</th><th class='r'>NRR</th></tr></thead><tbody>" + rows +
      "</tbody></table></div></div>" +
      // WHO SCORED THE RUNS. A season with a champion and no cricketers in it
      // is a club name and a number; this is the half of the record anybody
      // actually argues about.
      (function () {
        var bk = null;
        try { bk = P.seasonBook ? P.seasonBook(natId, year) : null; } catch (e) { return ""; }
        if (!bk || (!bk.bat.length && !bk.bowl.length)) return "";
        var ave = function (r, i, n) { var d = i - n; return d > 0 ? (r / d).toFixed(2) : "&mdash;"; };
        var bat = bk.bat.slice(0, 5).map(function (x, i) {
          return "<tr><td class='r'>" + (i + 1) + "</td><td>" + E(x.name) + "<u>" + E(nmOf(x.slot)) + "</u></td>" +
            "<td class='r'>" + x.inns + "</td><td class='r'><b>" + x.runs + "</b></td>" +
            "<td class='r'>" + x.hs + (x.hsNo ? "*" : "") + "</td><td class='r'>" + ave(x.runs, x.inns, x.no) + "</td></tr>";
        }).join("");
        var bowl = bk.bowl.slice(0, 5).map(function (x, i) {
          return "<tr><td class='r'>" + (i + 1) + "</td><td>" + E(x.name) + "<u>" + E(nmOf(x.slot)) + "</u></td>" +
            "<td class='r'>" + x.ov.toFixed(0) + "</td><td class='r'><b>" + x.wkts + "</b></td>" +
            "<td class='r'>" + (x.bbW ? x.bbW + "/" + x.bbR : "&mdash;") + "</td>" +
            "<td class='r'>" + (x.wkts ? (x.rc / x.wkts).toFixed(2) : "&mdash;") + "</td></tr>";
        }).join("");
        return "<div class='fo-stc-sec'><div class='fo-stc-sech'>The season&rsquo;s runs</div>" +
          "<div class='fo-stc-scroll'><table class='fo-stc-htb bk'><thead><tr><th class='r'>#</th><th>Batsman</th>" +
          "<th class='r'>Inns</th><th class='r'>Runs</th><th class='r'>HS</th><th class='r'>Ave</th></tr></thead><tbody>" +
          bat + "</tbody></table></div></div>" +
          "<div class='fo-stc-sec'><div class='fo-stc-sech'>The season&rsquo;s wickets</div>" +
          "<div class='fo-stc-scroll'><table class='fo-stc-htb bk'><thead><tr><th class='r'>#</th><th>Bowler</th>" +
          "<th class='r'>Ov</th><th class='r'>Wkts</th><th class='r'>BB</th><th class='r'>Ave</th></tr></thead><tbody>" +
          bowl + "</tbody></table></div></div>";
      })() +
      "<div class='fo-stc-foot'><a href='#/stats'>&lsaquo; The Stats Centre</a>" +
      "<a href='#/stats?v=career&n=" + encodeURIComponent(natId) + "'>All-time careers &rsaquo;</a>" +
      "<a href='#/league?n=" + encodeURIComponent(natId) + "'>This season's table &rsaquo;</a></div>";
  }
  /* THE CAREERS (#/stats?v=career) — statsguru's own question, asked of the
     whole record: not who led one season, but who did it for fifteen. Every
     figure here is the SUM of the seasons above, so a man's career total is
     what you get by adding up the years you can already read one by one. */
  function careerBody(natId, book, wantScope) {
    var P = PL9();
    if (!P || !P.careerBook) return "<div class='fo-stc-sec'><p class='fo-stc-dim'>The record is still waking up.</p></div>";
    var scope = wantScope === "world" ? "world" : "league";
    var bk = book === "bowl" ? "bowl" : "bat";
    var rows = [];
    try { rows = scope === "world" ? P.careerWorld() : P.careerBook(natId); } catch (e) { rows = []; }
    var natOf = {}; (P.nations() || []).forEach(function (r) { natOf[r.id] = r.nm; });
    var sN = function (y) { return P.sIdx ? P.sIdx(y) : y; };
    var qual = bk === "bat"
      ? function (x) { return x.inns >= 30; }
      : function (x) { return x.wkts >= 30; };
    var list = rows.filter(qual);
    list.sort(bk === "bat"
      ? function (a, b) { return b.runs - a.runs || b.hs - a.hs; }
      : function (a, b) { return b.wkts - a.wkts || (a.rc / Math.max(1, a.wkts)) - (b.rc / Math.max(1, b.wkts)); });
    var sides = {};
    var clubOf = function (x) {
      var r2 = x.rid || natId;
      if (!sides[r2]) { try { sides[r2] = P.sidesOf(r2) || []; } catch (e) { sides[r2] = []; } }
      var a = sides[r2];
      for (var i = 0; i < a.length; i++) if ((a[i].slot | 0) === (x.slot | 0)) return a[i].name;
      return "";
    };
    /* THE LEDGER. Eight columns and a full country name needed 520px and a
       sideways swipe, so half the figures lived off the right-hand edge of
       every phone. Four figures and a FLAG fit whole: the flag says the
       nation in twenty-two pixels where the word wanted a hundred, and the
       name shortens to an initial and a surname the way a scorecard does. */
    var flagOf = function (rid) {
      var base = (typeof FO_ART !== "undefined") ? FO_ART : "client/art/";
      try { return base + "flags/" + window.__foCxAPI.flagFile(rid) + ".svg"; } catch (e) { return ""; }
    };
    var shortName = window.foShortName;
    var head = bk === "bat"
      ? "<tr><th class='rk'>#</th><th>Batsman</th><th>Runs</th><th>Ave</th><th>HS</th><th>100</th></tr>"
      : "<tr><th class='rk'>#</th><th>Bowler</th><th>Wkts</th><th>Ave</th><th>BB</th><th>5w</th></tr>";
    var body = list.slice(0, 60).map(function (x, i) {
      var span = "S" + sN(x.from) + "&ndash;S" + sN(x.to);
      var rid = x.rid || natId, fl = flagOf(rid);
      // A NAME A READER ALREADY KNOWS DESERVES TO BE RECOGNISABLE. The men the
      // tour is built on are in this list on the same terms as everybody else
      // - same qualification, same sort, no seat reserved - so the only thing
      // marking them is a star saying "you have met this one".
      var who = "<td class='who'><div class='wr'>" +
        (fl ? "<img src='" + fl + "' alt='" + E(natOf[rid] || "") + "' title='" + E(natOf[rid] || "") + "'>" : "") +
        "<span><b>" + (x.boss ? "<i class='bs' title='One of the great names'>&#9733;</i>" : "") +
        E(shortName(x.name)) + "</b><em>" + E(clubOf(x)) + " &middot; " + span +
        (x.boss && x.craft ? " &middot; " + E(x.craft) : "") + "</em></span></div></td>";
      return bk === "bat"
        ? "<tr><td class='rk'>" + (i + 1) + "</td>" + who +
          "<td class='big'>" + x.runs.toLocaleString() + "</td>" +
          "<td>" + ((x.inns - x.no) > 0 ? (x.runs / (x.inns - x.no)).toFixed(1) : "&mdash;") + "</td>" +
          "<td>" + x.hs + (x.hsNo ? "*" : "") + "</td><td>" + x.h100 + "</td></tr>"
        : "<tr><td class='rk'>" + (i + 1) + "</td>" + who +
          "<td class='big'>" + x.wkts + "</td>" +
          "<td>" + (x.wkts ? (x.rc / x.wkts).toFixed(1) : "&mdash;") + "</td>" +
          "<td>" + (x.bbW ? x.bbW + "/" + x.bbR : "&mdash;") + "</td><td>" + x.fifers + "</td></tr>";
    }).join("");
    var seg = function (k, v, lab) {
      var on = (k === "b" ? bk : scope) === v;
      var href = "#/stats?v=career&n=" + encodeURIComponent(natId) +
        "&b=" + (k === "b" ? v : bk) + "&sc=" + (k === "s" ? v : scope);
      return "<a class='" + (on ? "on" : "") + "' href='" + href + "'>" + lab + "</a>";
    };
    return "<div class='fo-stc-sec fo-stc-hhead'>" +
      "<div class='fo-seg'>" + seg("b", "bat", "Batting") + seg("b", "bowl", "Bowling") + "</div>" +
      "<div class='fo-seg'>" + seg("s", "league", E(natName(natId))) + seg("s", "world", "The world") + "</div>" +
      "<div class='fo-stc-ck'>" + (scope === "world" ? "The whole world" : E(natName(natId))) + " &middot; the record</div>" +
      "<h2>All-time " + (bk === "bat" ? "batting" : "bowling") +
      "<s>" + list.length.toLocaleString() + " careers</s></h2>" +
      "<p class='fo-stc-dim'>Every career with " + (bk === "bat" ? "30 innings" : "30 wickets") +
      " behind it. Each total is the sum of the seasons you can read one by one in the record.</p></div>" +
      "<div class='fo-stc-sec'><table class='fo-stc-ldg fo-fits'><thead>" + head +
      "</thead><tbody>" + body + "</tbody></table></div>" +
      "<div class='fo-stc-foot'><a href='#/stats'>&lsaquo; The Stats Centre</a>" +
      "<a href='#/stats?v=hist&n=" + encodeURIComponent(natId) + "'>Walk the seasons &rsaquo;</a></div>";
  }

  function wireHist() {
    try {
      var y = document.getElementById("fo-stc-hy"), n = document.getElementById("fo-stc-hn");
      var go = function () {
        location.hash = "#/stats?v=hist&n=" + encodeURIComponent(n ? n.value : "") + "&y=" + (y ? y.value : "");
      };
      if (y) y.addEventListener("change", go);
      if (n) n.addEventListener("change", function () {
        // a different league has a different span, so the year is not carried
        location.hash = "#/stats?v=hist&n=" + encodeURIComponent(n.value);
      });
    } catch (e) {}
  }

  window.foRenderStatsPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    if (!onPage()) return;
    // A READER WITH NO SEAT STILL GETS THE BOOK. Every league's scorebook is
    // public, so the centre opens for anybody; only the "My club" scope needs
    // a club, and without one it is not offered at all rather than shown empty.
    var mine = claim();
    css();
    try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on"); } catch (eB) {}

    var natId = qparam("n") || myNation();
    var v = qparam("v"), scope = qparam("sc");
    if (v === "career") {
      page.innerHTML = "<div class='fo-stc'>" + careerBody(natId, qparam("b"), qparam("sc")) + "</div>";
      return;
    }
    if (v === "hist") {
      page.innerHTML = "<div class='fo-stc'>" + histBody(natId, qparam("y")) + "</div>";
      wireHist();
      return;
    }
    if (!BOOKS[v]) v = "";
    if (!SCOPES[scope]) scope = "league";
    // a manager with no seat in the world has no club to scope to
    if (scope === "club" && !mine) scope = "league";
    var qualOn = qparam("q") === "1";
    var divPick = qparam("d") === "1" ? "1" : qparam("d") === "2" ? "2" : "";

    page.innerHTML = "<div class='fo-stc'>" +
      (v ? tableBody(v, scope, natId, mine, qualOn, divPick) : indexBody(natId, mine)) +
      "</div>";
  };
})();
