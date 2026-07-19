/* boot — wire the presentation + engine layers into the page.
 *
 * Waits for the engine to exist, then installs the tuning layer, the
 * smooth renderer and the oval stage. Exposes __foSummer for the
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
      FOC.smoothRender.install();
      FOC.oval.init();
      window.__foSummer = {
        adapter: FOC.adapter,
        oval: FOC.oval, smooth: FOC.smoothRender
      };
      try { console.info("Fifty Overs presentation layer ready."); } catch (e2) {}
    } catch (e3) {}
  }, 250);
})();
