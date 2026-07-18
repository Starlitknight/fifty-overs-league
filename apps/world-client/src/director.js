/* world-client/director — turns factual events into world changes. It never
 * decides results; it decides what the PLACES show: which scene the manager
 * returns to, which props appear, which conversations exist. Every change
 * it makes is keyed to a concrete recorded fact (a match count, a stored
 * scorecard), never to "whatever happened most recently" by guesswork.
 */
FOW.director = (function () {
  var lastMatchCount = null, lastTrial = null;

  function tick() {
    var w = FOW.state.load(), B = FOW.bridge;
    if (!B.ready()) return;
    if (lastMatchCount === null) lastMatchCount = B.userMatchCount();
    if (lastTrial === null) lastTrial = B.trialDone();

    // the first competitive result changes the world: dusk light, newspaper
    // prop, moved characters, and post-match conversations become available
    var mc = B.userMatchCount();
    if (mc > lastMatchCount) {
      lastMatchCount = mc;
      if (!w.flags.firstMatchDone) {
        w.flags.firstMatchDone = 1;
        w.flags.postGafferDone = 0;
        FOW.state.save();
        FOW.renderer.travelCard("The train home", function () {
          FOW.app.goto("home-exterior");
        });
        return;
      }
      // later matches: come home quietly, the scene variants read the save
      FOW.renderer.travelCard("Back to the club", function () { FOW.app.goto("home-exterior"); });
      return;
    }
    // the optional trial finished: back to the nets with the real figures
    var td = B.trialDone();
    if (td && !lastTrial) {
      lastTrial = true;
      w.flags.trialDone = 1;
      FOW.state.save();
      FOW.renderer.travelCard("Back to the nets", function () {
        FOW.app.goto("nets");
        FOW.dialogue.play("trial.debrief");
      });
    }
  }

  return { tick: tick };
})();
