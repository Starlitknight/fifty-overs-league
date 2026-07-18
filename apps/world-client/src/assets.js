/* world-client/assets — the asset manifest: stable IDs, never inline paths.
 * FINAL art that already exists (Gaffer expressions, Thorne, the England
 * day-map, player role art, crests) is referenced directly; every scene
 * background is a PLACEHOLDER painted composition (layered CSS gradients +
 * silhouettes) and is listed, by this same stable ID, in ART_REQUIREMENTS.md
 * for replacement. Swapping a placeholder for final art is a manifest edit.
 */
FOW.assets = (function () {
  function artBase() {
    try { if (location.pathname.indexOf("/next/") >= 0) return "../client/art/"; } catch (e) {}
    return "client/art/";
  }
  var A = artBase();
  var M = {
    // ---- FINAL (existing art) ----
    "portrait.gaffer.neutral": A + "gaffer.png",
    "portrait.gaffer.serious": A + "gaffer-serious.png",
    "portrait.gaffer.amused": A + "gaffer-laugh.png",
    "portrait.gaffer.wry": A + "gaffer-wink.png",
    "portrait.thorne.composed": A + "thorne.png",
    "cutout.player.bat": A + "bat.png",
    "cutout.player.ar": A + "ar.png",
    "cutout.player.keeper": A + "keeper.png",
    "cutout.player.pace": A + "pace1.png",
    "cutout.player.spin": A + "spin-finger.png",
    "map.england.day": A + "circuit/eng.webp",
    "crest.soul.blade": A + "crests/blade.png",
    // ---- PLACEHOLDER scene paints (CSS class names, not files) ----
    "loc.station.home.morning": "css:sc-station",
    "loc.home.exterior.morning": "css:sc-home-morning",
    "loc.home.exterior.dusk": "css:sc-home-dusk",
    "loc.pavilion.interior": "css:sc-pavilion",
    "loc.dressing.room": "css:sc-dressing",
    "loc.nets": "css:sc-nets",
    "loc.secretary.office": "css:sc-office",
    "loc.trophy.room": "css:sc-trophy",
    "loc.willowmere.town": "css:sc-wm-town",
    "loc.willowmere.ground": "css:sc-wm-ground",
    "loc.willowmere.dressing": "css:sc-wm-dressing",
    "loc.willowmere.entry": "css:sc-wm-entry"
  };
  function get(id) { return M[id] || null; }
  function isCss(id) { var v = M[id]; return typeof v === "string" && v.indexOf("css:") === 0; }
  function cssClass(id) { return isCss(id) ? M[id].slice(4) : null; }
  return { get: get, isCss: isCss, cssClass: cssClass, manifest: M, artBase: artBase };
})();
