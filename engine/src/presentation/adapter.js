/* legacy/adapter — the thin seam onto engine globals.
 *
 * Everything that reads engine state from the bundle goes through here, so
 * the (future) engine extraction has one place to retarget.
 */
FOC.adapter = (function () {
  function engineReady() {
    return typeof App !== "undefined" && typeof GD !== "undefined" && typeof userTeam === "function";
  }
  function team() { try { return engineReady() ? userTeam() : null; } catch (e) { return null; } }
  function liveMatch() { try { return (typeof M !== "undefined" && M) || null; } catch (e) { return null; } }
  return { engineReady: engineReady, team: team, liveMatch: liveMatch };
})();
