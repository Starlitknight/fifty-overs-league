  // =================================================================
  //  The ball-by-ball, fetched only when someone asks to read it.
  //
  //  The league snapshot is one document holding the whole league, and every
  //  member's device downloads all of it whenever the round moves. Measured on
  //  a real league - 10 clubs, 27 matches - it came to 1,897 KB, of which
  //  1,090 KB was the ball-by-ball commentary of the two most recent matches.
  //  Sixty per cent of what everyone downloads, on every load, to draw screens
  //  that never look at it. A phone with two dozen other tabs open would
  //  rather not, and had started refusing.
  //
  //  The umpire now writes the log to app.league_archive instead, one row per
  //  match, and this fetches that row the moment - and only the moment - a
  //  manager opens the commentary tab of that match's scorecard. Which is the
  //  only place in the shipped game that reads a stored log: #/commentary is a
  //  retired route (see GONE in the engine's router), and the scorecard's
  //  bowling-order tidy-up already returns silently without one.
  //
  //  A league whose umpire has not archived anything yet still carries its
  //  logs inline, and those render exactly as before: nothing here runs unless
  //  a log is genuinely absent.
  // =================================================================
  (function () {
    // This file is NOT inside the league core's closure (that is modules 00-12,
    // one IIFE). LG, SYNC and sel are invisible here, so everything the league
    // knows comes through the bridge the core publishes on window.
    function foLg() { try { return (window.__foLeague && window.__foLeague()) || null; } catch (e) { return null; } }

    // Proof the stored row is this match. results[] is append-only in normal
    // play, so its position is a stable name - but a relaunch rebuilds it, and
    // then row 12 is a different game. Must match resolver/archive.mjs exactly.
    // Deliberately NOT the club names: module 26 renames bot clubs to suit the
    // league's nation and rewrites this device's result history to match, so
    // home and away disagree with the umpire's copy. The seed, round and
    // season identify the match exactly and survive the renaming.
    function foArchSig(r) {
      if (!r) return "";
      return [r.comp || "",
        r.round == null ? "" : r.round,
        r.seasonNo == null ? "" : r.seasonNo,
        r.seed == null ? "" : r.seed].join("|");
    }

    // App is a top-level `const`, so it lives in the global LEXICAL scope and
    // never appears on `window` · reach it by bare name or not at all
    function foResults() {
      try { return (typeof App !== "undefined" && App && App.results) || null; } catch (e) { return null; }
    }

    // true when a fetch is now in flight and the caller should say so
    function foArchNeed(ix, then) {
      var all = foResults();
      var r = all ? all[ix] : null;
      if (!r) return false;
      if (r.log && r.log.length) return false;   // already here
      if (r.__archNone || r.__archBusy) return false;
      var L = foLg();
      if (!L || !L.id || !L.sel) return false;   // solo play has no archive
      r.__archBusy = 1;
      L.sel("league_archive", "league_id=eq." + L.id + "&ix=eq." + ix + "&select=sig,heavy").then(function (rows) {
        r.__archBusy = 0;
        var row = rows && rows[0];
        if (row && row.sig === foArchSig(r) && row.heavy && row.heavy.log && row.heavy.log.length) r.log = row.heavy.log;
        else r.__archNone = 1;                   // nothing stored, or stored for a match that is no longer here
        try { then(); } catch (e) {}
      }).catch(function () {
        // a project that has not run the 0023 migration answers 404 · that is
        // not an error, it just means this league keeps its logs inline
        r.__archBusy = 0; r.__archNone = 1;
        try { then(); } catch (e) {}
      });
      return true;
    }

    // The tab renders "No commentary stored for this match." on its own when
    // there is no log. While one is on its way, that sentence is untrue.
    function foArchNote() {
      try {
        var p = document.getElementById("page"); if (!p) return;
        [].forEach.call(p.querySelectorAll("div,span,p"), function (el) {
          if (el.children.length) return;
          if (/^\s*No commentary stored for this match\.?\s*$/i.test(el.textContent || "")) el.textContent = "Fetching the ball-by-ball…";
        });
      } catch (e) {}
    }

    try {
      if (typeof window.route === "function" && !window.route.__foArch) {
        var _route = window.route;
        window.route = function () {
          var pending = false;
          try {
            var m = /^#\/scorecard\?i=(\d+)/.exec(location.hash || "");
            if (m && typeof App !== "undefined" && App._scTab === "comm") {
              pending = foArchNeed(+m[1], function () { try { _route.call(window); } catch (e) {} });
            }
          } catch (e) {}
          var out = _route.apply(this, arguments);
          if (pending) foArchNote();
          return out;
        };
        window.route.__foArch = 1;
      }
    } catch (eR) {}
  })();
