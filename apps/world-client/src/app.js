/* world-client/app — boot, navigation, and hotspot actions. Mounts only
 * when the page was built as the world client (window.__FO_WORLD). The
 * Classic build never loads this bundle.
 */
FOW.app = (function () {
  function goto(sceneId) {
    var w = FOW.state.load();
    if (!FOW.scenes.get(sceneId)) return;
    w.scene = sceneId;
    w.visited[sceneId] = 1;
    if (sceneId !== "station") w.flags.leftStation = 1;
    FOW.state.save();
    FOW.renderer.show();
    FOW.renderer.refresh();
  }

  function hotspot(id) {
    var w = FOW.state.load(), B = FOW.bridge;
    var d = FOW.scenes.get(w.scene); if (!d) return;
    var hs = (d.hotspots || []).filter(function (h) { return h.id === id; })[0];
    if (!hs) return;
    if (hs.kind === "go" && hs.go) {
      if (hs.go === "wm-town" && !w.visited["wm-town"]) {
        FOW.renderer.travelCard("The Saturday service to Willowmere", function () { goto("wm-town"); });
        return;
      }
      goto(hs.go);
      return;
    }
    if (hs.dlg) { FOW.dialogue.play(hs.dlg); return; }
    if (hs.kind === "action") {
      if (hs.act === "lineup") {
        // away dressing room starts the real fixture; home board edits the plan
        var withFixture = w.scene === "wm-dressing";
        FOW.renderer.hide("Back to the dressing room");
        B.openLineup(withFixture);
      } else if (hs.act === "walkout") {
        FOW.renderer.hide(null);   // no way back mid-match; the director returns us
        B.walkout();
      } else if (hs.act === "trial") {
        FOW.renderer.hide("Back to the nets");
        B.startTrial();
      } else if (hs.act === "career") {
        FOW.renderer.hide("Back to the world");
        B.openCareer();
      }
    }
  }

  function init() {
    if (typeof window === "undefined" || !window.__FO_WORLD) return;
    var tries = 0;
    var t = setInterval(function () {
      tries++;
      if (!FOW.bridge.ready()) { if (tries > 120) clearInterval(t); return; }
      clearInterval(t);
      // the world owns the screen: no auth gate in the world build
      try { var wrap = document.getElementById("folWrap"); if (wrap) wrap.remove(); } catch (e) {}
      FOW.renderer.mount();
      var w = FOW.state.load();
      w.visited[w.scene] = 1;
      FOW.state.save();
      FOW.renderer.refresh();
      setInterval(function () {
        try { FOW.director.tick(); } catch (e2) {}
        // if a legacy surface was left by its own navigation, come home
        try {
          if (FOW.renderer.isHidden() && !FOW.bridge.inLegacySurface() &&
              !(typeof M !== "undefined" && M && !M.done) && !document.getElementById("fow-return")) {
            FOW.renderer.show(); FOW.renderer.refresh();
          }
        } catch (e3) {}
      }, 1500);
      try { console.info("Fifty Overs world client ready."); } catch (e4) {}
    }, 300);
  }

  return { init: init, goto: goto, hotspot: hotspot };
})();

FOW.app.init();
try { window.__foWorld = FOW; } catch (e) {}
