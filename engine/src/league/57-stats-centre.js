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
      "html body #page .fo-stc{max-width:1180px;margin:22px auto 44px;padding:0 18px;color:#141C28}",
      "html body #page .fo-stc-hero{background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F);border-radius:20px;padding:24px 26px 22px;box-shadow:0 20px 46px rgba(11,29,51,.34)}",
      "html body #page .fo-stc-hero .k{font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.26em;text-transform:uppercase;color:#EBC271}",
      "html body #page .fo-stc-hero h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:38px;letter-spacing:-.015em;margin:7px 0 10px;color:#FFFEFC;line-height:1.03}",
      "html body #page .fo-stc-hero p{margin:0;font:400 13.5px/1.55 Inter,sans-serif;color:rgba(244,239,228,.76);max-width:66ch}",
      "html body #page .fo-stc-now{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}",
      "html body #page .fo-stc-now span{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:11px;padding:8px 13px 7px;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,239,228,.62)}",
      "html body #page .fo-stc-now span b{display:block;margin-bottom:4px;font:700 16px/1 Inter,sans-serif;letter-spacing:0;color:#FFFEFC;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:20ch}",
      // ---- the index --------------------------------------------------------
      "html body #page .fo-stc-sec{margin-top:26px}",
      "html body #page .fo-stc-sech{display:flex;align-items:center;gap:12px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#0E2246;margin:0 2px 10px}",
      "html body #page .fo-stc-sech:after{content:'';flex:1;border-top:1px solid rgba(20,28,40,.14)}",
      "html body #page .fo-stc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:11px}",
      "html body #page .fo-stc-item{display:block;background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-radius:13px;padding:14px 15px 13px;text-decoration:none !important;box-shadow:0 5px 16px rgba(30,38,52,.05);transition:transform .13s ease,box-shadow .13s ease,border-color .13s ease}",
      "html body #page .fo-stc-item:hover{transform:translateY(-2px);box-shadow:0 12px 26px rgba(30,38,52,.1);border-color:rgba(14,34,70,.3)}",
      "html body #page .fo-stc-item b{display:block;font:600 14px/1.25 Inter,sans-serif;color:#0E2246 !important;margin-bottom:5px}",
      "html body #page .fo-stc-item span{display:block;font:400 11.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.6)}",
      "html body #page .fo-stc-item i{display:block;margin-top:8px;font:700 9px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#B44A22 !important;font-style:normal}",
      // the season's leaders, on the index
      "html body #page .fo-stc-lead{display:grid;grid-template-columns:repeat(auto-fit,minmax(178px,1fr));gap:10px}",
      "html body #page .fo-stc-lead div{background:#0E2246;border-radius:13px;padding:13px 15px 12px;color:#FFFDF7}",
      "html body #page .fo-stc-lead i{display:block;font:600 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#EBC271;font-style:normal;margin-bottom:7px}",
      "html body #page .fo-stc-lead b{display:block;font:600 13.5px/1.3 Inter,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-stc-lead em{display:block;margin-top:3px;font:700 17px/1 Inter,sans-serif;font-style:normal;font-variant-numeric:tabular-nums;color:#FFFEFC}",
      // ---- the table view ---------------------------------------------------
      "html body #page .fo-stc-back{display:inline-flex;align-items:center;min-height:30px;margin:16px 0 0;font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.4) !important;text-decoration:none !important}",
      "html body #page .fo-stc-back:hover{color:#B44A22 !important}",
      // ---- the controls: type, not lozenges ---------------------------------
      "html body #page .fo-stc-ctl{margin:14px 0 0;border-top:1px solid rgba(20,28,40,.1);border-bottom:1px solid rgba(20,28,40,.1);padding:4px 0}",
      "html body #page .fo-stc-seg{display:flex;flex-wrap:wrap;gap:0 22px;padding:7px 2px}",
      "html body #page .fo-stc-seg+.fo-stc-seg,html body #page .fo-stc-filt{border-top:1px solid rgba(20,28,40,.06)}",
      "html body #page .fo-stc-seg a{position:relative;font:600 12px/1 Inter,sans-serif;letter-spacing:-.005em;color:rgba(20,28,40,.45) !important;text-decoration:none !important;padding:7px 0 8px;transition:color .12s ease}",
      "html body #page .fo-stc-seg a:hover{color:#141C28 !important}",
      "html body #page .fo-stc-seg a.on{color:#0E2246 !important;font-weight:700}",
      "html body #page .fo-stc-seg a.on:after{content:'';position:absolute;left:0;right:0;bottom:2px;height:2px;border-radius:1px;background:#C9571F}",
      "html body #page .fo-stc-filt{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0 22px}",
      "@media(max-width:520px){html body #page .fo-stc-filt{display:block}html body #page .fo-stc-qual{border-top:1px solid rgba(20,28,40,.06);width:100%}}",
      "html body #page .fo-stc-filt .fo-stc-seg{border-top:0;flex:1}",
      "html body #page .fo-stc-qual{display:inline-flex;align-items:center;gap:8px;padding:7px 2px 8px;font:500 12px/1 Inter,sans-serif;color:rgba(20,28,40,.45) !important;text-decoration:none !important}",
      "html body #page .fo-stc-qual i{width:15px;height:15px;border-radius:4px;border:1.5px solid rgba(20,28,40,.25);display:block;position:relative}",
      "html body #page .fo-stc-qual.on{color:#0E2246 !important;font-weight:600}",
      "html body #page .fo-stc-qual.on i{background:#C9571F;border-color:#C9571F}",
      "html body #page .fo-stc-qual.on i:after{content:'';position:absolute;left:4px;top:1px;width:4px;height:8px;border:solid #FFFEFC;border-width:0 2px 2px 0;transform:rotate(42deg)}",
      "html body #page .fo-stc-panel{background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-radius:16px;padding:16px 16px 12px;margin-top:14px;box-shadow:0 6px 20px rgba(30,38,52,.055)}",
      "html body #page .fo-stc-ph{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:4px}",
      "html body #page .fo-stc-ph h2{margin:0;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:23px;letter-spacing:-.01em;color:#0E2246}",
      "html body #page .fo-stc-sub{font:500 11px/1.4 Inter,sans-serif;color:rgba(20,28,40,.52)}",
      "html body #page .fo-stc-dim{font:400 12px/1.55 Inter,sans-serif;color:rgba(20,28,40,.5);margin:8px 2px}",
      "html body #page .fo-stc-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:10px -4px 0}",
      // ---- the record: the year picker, the champions band, the old table ----
      "html body #page .fo-stc-hnav{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}",
      "html body #page .fo-stc-hnav label{display:flex;align-items:center;gap:6px;font:700 9px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.5)}",
      "html body #page .fo-stc-hnav select{min-height:38px;padding:0 10px;border-radius:9px;border:1px solid rgba(20,28,40,.2);background:#FFFEFC;font:600 14px/1 Inter,system-ui,sans-serif;color:#141C28;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-hstep{min-height:38px;display:inline-flex;align-items:center;padding:0 12px;border-radius:9px;border:1px solid rgba(20,28,40,.16);text-decoration:none;font:700 11px/1 Oswald,sans-serif;letter-spacing:.1em;color:#B44A22;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-hstep.off{opacity:.32;color:rgba(20,28,40,.5)}",
      "html body #page .fo-stc-hhead h2{margin:2px 0 2px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:24px;color:#141C28}",
      "html body #page .fo-stc-htb tr.ch td{background:rgba(47,107,69,.07)}",
      "html body #page .fo-stc-htb tr.ch em{font-style:normal;margin-left:6px;font:700 8px/1 Oswald,sans-serif;letter-spacing:.14em;color:#2F6B45}",
      // THE RECORD KEEPS ITS OWN TABLE. It borrowed the book's chrome at first
      // and lost every numeric column off the right-hand edge, because that
      // table is built to be wide and scrolled and this one has to fit a phone
      // whole. Fixed layout, a club column that takes what is left, and seven
      // narrow columns that are always there.
      "html body #page .fo-stc-htb{width:100%;table-layout:fixed;border-collapse:collapse;margin-top:6px;font:400 12.5px/1.4 Inter,system-ui,sans-serif;color:#141C28}",
      "html body #page .fo-stc-htb th{padding:7px 3px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.45);border-bottom:1px solid rgba(20,28,40,.16)}",
      "html body #page .fo-stc-htb td{padding:8px 3px;border-bottom:1px solid rgba(20,28,40,.07)}",
      "html body #page .fo-stc-htb th:first-child,html body #page .fo-stc-htb td:first-child{width:24px;text-align:right;color:rgba(20,28,40,.45)}",
      "html body #page .fo-stc-htb th:nth-child(2),html body #page .fo-stc-htb td:nth-child(2){text-align:left;width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-stc-htb td:nth-child(2) a{text-decoration:none;color:#141C28 !important;font-weight:600}",
      "html body #page .fo-stc-htb th.r,html body #page .fo-stc-htb td.r{text-align:right;width:26px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-stc-htb th:last-child,html body #page .fo-stc-htb td:last-child{width:44px;color:rgba(20,28,40,.6)}",
      "html body #page .fo-stc-htb tr.ch td:nth-child(2) a{color:#2F6B45 !important}",
      "html body #page .fo-stc-htb tr.ch td{background:rgba(47,107,69,.08)}",
      "html body #page .fo-stc-htb tr.ch em{font-style:normal;margin-left:5px;font:700 7.5px/1 Oswald,sans-serif;letter-spacing:.12em;color:#2F6B45}",
      "@media(max-width:430px){html body #page .fo-stc-htb th:nth-child(6),html body #page .fo-stc-htb td:nth-child(6){display:none}}",
      // ---- the table -------------------------------------------------------
      // A SOLID NAVY HEADER BAND with white condensed capitals is a spreadsheet
      // wearing a suit: it puts the loudest thing on the page above the quietest
      // and makes the figures fight it. The head is now the same paper as the
      // rows, held down by a single rule, and the weight moved to where the
      // reading is - the name and the number.
      "html body #page table.fo-stc-tbl{border-collapse:collapse;width:100%;min-width:660px;font-variant-numeric:tabular-nums}",
      "html body #page table.fo-stc-tbl th{position:sticky;top:0;z-index:1;background:#FFFEFC;color:rgba(20,28,40,.45);font:600 9px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:right;padding:0 8px 10px;white-space:nowrap;cursor:pointer;-webkit-user-select:none;user-select:none;box-shadow:inset 0 -1px 0 rgba(20,28,40,.16)}",
      "html body #page table.fo-stc-tbl th.rk,html body #page table.fo-stc-tbl th.nm,html body #page table.fo-stc-tbl th.cl,html body #page table.fo-stc-tbl th.ct{text-align:left}",
      "html body #page table.fo-stc-tbl th.rk{cursor:default}",
      "html body #page table.fo-stc-tbl th:hover{color:#141C28}",
      "html body #page table.fo-stc-tbl th[data-dir]{color:#B44A22;box-shadow:inset 0 -2px 0 #C9571F}",
      "html body #page table.fo-stc-tbl th[data-dir=&#39;desc&#39;]:after{content:' \\25BE'}",
      "html body #page table.fo-stc-tbl th[data-dir=&#39;asc&#39;]:after{content:' \\25B4'}",
      // figures in Inter, not the condensed poster face; the name carries the weight
      "html body #page table.fo-stc-tbl td{padding:9px 8px;text-align:right;white-space:nowrap;font:500 12.5px/1.2 Inter,sans-serif;color:rgba(20,28,40,.78);border-bottom:1px solid rgba(20,28,40,.055)}",
      "html body #page table.fo-stc-tbl td.rk{text-align:left;font-weight:400;color:rgba(20,28,40,.3);font-size:11px}",
      "html body #page table.fo-stc-tbl td.nm,html body #page table.fo-stc-tbl td.cl,html body #page table.fo-stc-tbl td.ct{text-align:left}",
      "html body #page table.fo-stc-tbl td.nm{font-weight:600;color:#141C28}",
      "html body #page table.fo-stc-tbl td.cl,html body #page table.fo-stc-tbl td.ct{font-size:11.5px;font-weight:400;color:rgba(20,28,40,.45)}",
      "html body #page table.fo-stc-tbl td.nm a{color:#141C28 !important;text-decoration:none !important}",
      "html body #page table.fo-stc-tbl td.nm a:hover{color:#B44A22 !important}",
      "html body #page table.fo-stc-tbl td.cl a{color:rgba(20,28,40,.45) !important;text-decoration:none !important}",
      // the leading column of a row a reader is scanning: the first three
      // figures after the name get full ink, the tail recedes
      "html body #page table.fo-stc-tbl tbody tr:hover td{background:rgba(20,28,40,.028)}",
      "html body #page table.fo-stc-tbl tbody tr.mine td{background:rgba(201,87,31,.07)}",
      "html body #page table.fo-stc-tbl tbody tr.mine td:first-child{box-shadow:inset 2px 0 0 #C9571F}",
      "html body #page table.fo-stc-tbl tbody tr.mine td.nm a{color:#B44A22 !important;font-weight:700}",
      "html body #page .fo-stc-note{margin-top:22px;background:rgba(14,34,70,.045);border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:15px 17px 13px}",
      "html body #page .fo-stc-note h3{margin:0 0 8px;font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#0E2246}",
      "html body #page .fo-stc-note ul{margin:0;padding-left:17px}",
      "html body #page .fo-stc-note li{font:400 12.5px/1.6 Inter,sans-serif;color:rgba(20,28,40,.72);margin-bottom:5px}",
      "html body #page .fo-stc-note li b{font-weight:700;color:#0E2246}",
      "@media(max-width:640px){",
      "html body #page .fo-stc{padding:0 12px}",
      "html body #page .fo-stc-hero{padding:18px 17px 17px;border-radius:16px}",
      "html body #page .fo-stc-hero h1{font-size:30px}",
      "html body #page .fo-stc-grid{grid-template-columns:1fr}",
      "html body #page table.fo-stc-tbl th,html body #page table.fo-stc-tbl td{padding:7px 6px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ONE PLACE BUILDS A LINK INTO THIS PAGE, so changing book or scope keeps
  // the filters a reader has already set instead of silently resetting them.
  // The division filter is dropped on the club scope, where it means nothing.
  function href(v, sc, q, d) {
    return "#/stats?v=" + v + "&sc=" + sc + (q ? "&q=1" : "") + (d && sc !== "club" ? "&d=" + d : "");
  }

  // ---- the index -----------------------------------------------------------
  function indexBody(natId, mine) {
    var g = gather("league", natId);
    var rounds = g.rounds, season = g.seasonNo;
    // the season's leaders in your own country, so the index is worth reading
    // even before you pick a book
    var lead = "";
    if (g.rows.length) {
      var bats = g.rows.filter(BOOKS.bat.keep);
      var byRuns = bats.slice().sort(BOOKS.bat.sort)[0];
      var byWkts = g.rows.filter(BOOKS.bowl.keep).sort(BOOKS.bowl.sort)[0];
      var byHs = bats.slice().sort(function (a, b) { return b.hs - a.hs || b.sr - a.sr; })[0];
      var byBb = g.rows.filter(function (x) { return x.bb && x.bb.w; })
        .sort(function (a, b) { return valOf(b, "bb") - valOf(a, "bb"); })[0];
      var card = function (t, man, big) {
        return "<div><i>" + t + "</i><b>" + (man ? E(man.name) : "&mdash;") + "</b><em>" + (man ? big : "&mdash;") + "</em></div>";
      };
      lead = "<div class='fo-stc-sec'><div class='fo-stc-sech'>" + E(natName(natId)) + " this season</div>" +
        "<div class='fo-stc-lead'>" +
        card("Most runs", byRuns, byRuns && byRuns.runs) +
        card("Most wickets", byWkts, byWkts && byWkts.wkts) +
        card("Highest score", byHs, byHs && (byHs.hs + (byHs.hsNo ? "*" : ""))) +
        card("Best bowling", byBb, byBb && byBb.bb ? byBb.bb.w + "-" + byBb.bb.r : "") +
        "</div></div>";
    } else if (g.waiting) {
      lead = "<div class='fo-stc-sec'><p class='fo-stc-dim'>Sending for the scorebooks&hellip;</p></div>";
    }

    var section = function (title, scope, note) {
      var items = ["bat", "bowl", "field"].map(function (k) {
        return "<a class='fo-stc-item' href='" + href(k, scope) + "'><b>" + BOOKS[k].short + "</b>" +
          "<span>" + SAY[k][scope] + "</span><i>" + note + "</i></a>";
      }).join("");
      return "<div class='fo-stc-sec'><div class='fo-stc-sech'>" + title + "</div>" +
        "<div class='fo-stc-grid'>" + items + "</div></div>";
    };

    var elsewhere =
      "<div class='fo-stc-sec'><div class='fo-stc-sech'>Elsewhere in the record</div><div class='fo-stc-grid'>" +
      "<a class='fo-stc-item' href='#/stats?v=hist&n=" + encodeURIComponent(natId) + "'><b>The record</b><span>Every season this league has ever played: the table that decided it, the champions and the cup winners, year by year.</span><i>" + (function () { try { var sp = PL9().histSpan(natId); return sp.seasons ? "Seasons " + PL9().sIdx(sp.from) + "&ndash;" + PL9().sIdx(sp.to) : "The record"; } catch (e) { return "The record"; } })() + "</i></a>" +
      "<a class='fo-stc-item' href='#/league'><b>The league table</b><span>Where the clubs stand, the fixtures and the results, round by round.</span><i>" + E(natName(natId)) + "</i></a>" +
      "<a class='fo-stc-item' href='#/rankings'><b>The world rankings</b><span>Nations and clubs ranked on what they have done, across every competition.</span><i>The world</i></a>" +
      "<a class='fo-stc-item' href='#/almanack'><b>The world almanack</b><span>Champions, cup winners and the honours every season has handed out.</span><i>Every season</i></a>" +
      "<a class='fo-stc-item' href='#/schedule'><b>The season schedule</b><span>All forty-two days: what is played, and when your own matches start.</span><i>This season</i></a>" +
      "</div></div>";

    var note =
      "<div class='fo-stc-note'><h3>How to read this book</h3><ul>" +
      "<li><b>Every figure was played.</b> Runs, wickets and catches here were scored in matches the umpire settled and banked. Nothing is estimated from a rating.</li>" +
      "<li><b>This is the season's book, not a career.</b> The world publishes the current season; totals begin again at the turning of the year.</li>" +
      "<li><b>Every column head sorts.</b> Click it once for the order that flatters, again to reverse it.</li>" +
      "<li><b>Qualification scales with the season.</b> The averages that need a sample only count men who have played enough of it, and the page says how much.</li>" +
      "<li><b>Your own men are lit</b> wherever they appear, including in a table of five thousand.</li>" +
      "</ul></div>";

    var chips =
      (season ? "<span><b>" + season + "</b>Season</span>" : "") +
      "<span><b>" + rounds + " / 14</b>Rounds played</span>" +
      (mine ? "<span><b>" + E(mine.club || "") + "</b>Your club</span>" : "") +
      (nations().length ? "<span><b>" + nations().length + "</b>Leagues on the planet</span>" : "");

    return "<div class='fo-stc-hero'><div class='k'>Every run, every wicket, every catch</div>" +
      "<h1>Stats Centre</h1>" +
      "<p>The scorer&rsquo;s book for the whole world, kept ball by ball as the umpire settles each round. " +
      "Pick a book and a scope: your own eleven, your country, or " +
      (nations().length ? "all " + nations().length + " leagues" : "every league in the world") + " at once.</p>" +
      "<div class='fo-stc-now'>" + chips + "</div></div>" +
      lead +
      (mine ? section("Your club", "club", E(mine.club || "Your club")) : "") +
      section("Your league", "league", E(natName(natId))) +
      section("The world", "world", "All leagues") +
      elsewhere + note;
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
    var chips =
      (g.seasonNo ? "<span><b>" + g.seasonNo + "</b>Season</span>" : "") +
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
    var step = function (yy, pre, post) {
      var lab = yy == null ? "&mdash;" : pre + "S" + sN(yy) + post;
      return yy == null ? "<span class='fo-stc-hstep off'>" + lab + "</span>"
        : "<a class='fo-stc-hstep' href='#/stats?v=hist&n=" + encodeURIComponent(natId) + "&y=" + yy + "'>" + lab + "</a>";
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
    return "<div class='fo-stc-sec fo-stc-hhead'>" +
      "<div class='fo-stc-hnav'>" + step(prevY, "&lsaquo; ", "") +
      "<label>Season<select id='fo-stc-hy'>" + opts + "</select></label>" +
      "<label>League<select id='fo-stc-hn'>" + natOpts + "</select></label>" +
      step(nextY, "", " &rsaquo;") + "</div>" +
      "<h2>" + E(natName(natId)) + " &middot; Season " + sN(year) + "</h2>" +
      "<p class='fo-stc-dim'>The " + E(natName(natId)) + " league's " + ord(year - span.from + 1) +
      " season of " + span.seasons + " &middot; first played in Season " + sN(span.from) + ".</p>" +
      "<div class='fo-stc-lead'>" +
      "<div><i>Champions</i><b><a href='" + teamHref(h.champion) + "'>" + E(champ) + "</a></b><em>" + h.table[0].pts + " points from " + h.rounds + "</em></div>" +
      "<div><i>National Cup</i><b>" + (h.cup == null ? "&mdash;" : "<a href='" + teamHref(h.cup) + "'>" + E(cupTxt) + "</a>") + "</b><em>" + (h.cup == null ? "not played that year" : "the knockout") + "</em></div>" +
      world.join("") + "</div></div>" +
      "<div class='fo-stc-sec'><div class='fo-stc-sech'>The table</div>" +
      "<div class='fo-stc-scroll'><table class='fo-stc-htb'>" +
      "<thead><tr><th class='r'>#</th><th>Club</th><th class='r'>P</th><th class='r'>W</th><th class='r'>L</th>" +
      "<th class='r'>T</th><th class='r'>Pts</th><th class='r'>NRR</th></tr></thead><tbody>" + rows +
      "</tbody></table></div></div>" +
      "<div class='fo-stc-foot'><a href='#/stats'>&lsaquo; The Stats Centre</a>" +
      "<a href='#/league?n=" + encodeURIComponent(natId) + "'>This season's table &rsaquo;</a></div>";
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
