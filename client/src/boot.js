/* boot — wire the campaign into the page.
 *
 * Waits for the engine + overlay to exist, then starts the match keeper and
 * the two routed surfaces (#/summer, #/lineup). Exposes __foSummer for the
 * Playwright probes and nothing else.
 */
(function () {
  if (typeof window === "undefined") return;
  var tries = 0;
  var t = setInterval(function () {
    tries++;
    var ready = false;
    try { ready = FOC.adapter.engineReady() && !!window.__foGame; } catch (e) {}
    if (!ready && tries < 120) return;
    clearInterval(t);
    if (!ready) return;   // engine never appeared; stay dormant
    try {
      FOC.game.init();
      FOC.lineup.init();
      FOC.campaignUI.init();
      window.__foSummer = {
        save: function () { return FOC.game.save(); },
        engine: FOC.game, adapter: FOC.adapter, lineup: FOC.lineup,
        saveMod: FOC.save, ids: FOC.ids, events: FOC.events, england: FOC.england
      };
      try { console.info("The First Summer ready."); } catch (e2) {}
    } catch (e3) {}
  }, 250);
})();
