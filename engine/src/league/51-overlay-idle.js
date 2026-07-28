  // =================================================================
  //  Nothing paints what nobody can see.
  //
  //  Every overlay page (#/home, #/league, the nation rooms...) repaints
  //  itself on an interval, and those painters rebuild league tables, XIs and
  //  form lines from scratch each tick. On a club with a real career that came
  //  to 1.8 seconds per tick, every 1.5 seconds - the browser spent its whole
  //  life repainting a page that was HIDDEN behind the league loading overlay,
  //  and the loading itself starved: seconds counter frozen, watchdog late,
  //  entry crawling. The stopwatch caught it signed: BLOCKED 1.8s by
  //  foRenderHome, twice, on the manager's own screenshot.
  //
  //  While the overlay owns the screen, the painters rest. The instant it
  //  closes, route() calls them again and they paint for a viewer who exists.
  // =================================================================
  (function () {
    // the names the engine router dispatches to (its OV map) - every
    // interval-driven overlay painter goes through one of these
    var PAINTERS = ["foRenderHome", "foRenderLeagueTablePage", "foRenderNation", "foRenderLeague",
      "foRenderPlanetPage", "foRenderAlmanackPage", "foRenderStarPage", "foRenderWcMatchPage",
      "foRenderCup", "foRenderCircuit", "foRenderCity", "foRenderTour", "foRenderWorld",
      "foRenderBoss", "foRenderSide", "foRenderWire", "foRenderLore", "foRenderReport",
      "foRenderCeremony", "foRenderDesk", "foRenderLedger", "foRenderNetsPage", "foRenderScoutPage",
      "foRenderHonoursPage", "foRenderTimeMachinePage", "foRenderFixturesPage", "foRenderMatchdayPage",
      "foRenderRecordsPage", "foRenderPaperPage", "foRenderChampionsPage", "foRenderWorldClubPage",
      "foRenderNationsPage", "foRenderManualPage", "foRenderWatchPage", "foRenderRankingsPage",
      "foRenderClubPage", "foRenderAcademyPage", "foRenderFinancePage", "foRenderCompsPage",
      "foRenderMarketPage"];
    function covered() {
      // the class alone is not proof: a stale "on" has been seen on a hidden
      // wrap, and treating it as cover killed every navigation · the overlay
      // only counts when it is genuinely on screen
      try {
        var w = document.getElementById("folWrap");
        return !!(w && w.classList.contains("on") && w.offsetWidth > 0 && w.offsetHeight > 0);
      } catch (e) { return false; }
    }
    // A PAINTER EARNS ITS OWN CADENCE. Every one of these repaints on a timer,
    // most rebuilding their whole page from scratch, and on a club with a real
    // career a single painter measured 1.8 seconds a call. Fixing them one by
    // one is a season's work; measuring them is free - the wrapper times every
    // call, and a painter that proves expensive is simply not re-run at full
    // tempo: it waits out eight times its own cost (capped at 20s) before the
    // next timed repaint. Cheap painters never notice. Navigation is exempt -
    // when the hash has moved, the manager clicked something, and the first
    // paint of a page they asked for is never deferred.
    function wrapAll() {
      PAINTERS.forEach(function (n) {
        var f = window[n];
        if (typeof f !== "function" || f.__foIdle) return;
        var g = function () {
          if (covered()) return;
          var now = Date.now();
          var nav = g.__hash !== location.hash;
          if (!nav && g.__cost > 150 && (now - g.__at) < Math.min(20000, g.__cost * 8)) return;
          g.__hash = location.hash;
          var t0 = Date.now();
          try { return f.apply(this, arguments); }
          finally { g.__at = Date.now(); g.__cost = Date.now() - t0; }
        };
        g.__foIdle = 1; g.__cost = 0; g.__at = 0;
        window[n] = g;
      });
    }
    wrapAll();
    // some painters are assigned after this module runs; sweep again shortly
    setTimeout(wrapAll, 400);
    setTimeout(wrapAll, 2000);
  })();
