/* world-client/state — the world-layer save (scene position, visited places,
 * discoveries, notebook, settings). Versioned, browser-local, and entirely
 * separate from Classic saves: key fifty_overs_world_v3. Cricket state
 * continues to live in the canonical career save (scoped *_world so a
 * Classic career in the same browser is never touched).
 */
var FOW = {};
FOW.state = (function () {
  var KEY = "fifty_overs_world_v3";
  var _s = null;

  function fresh() {
    return {
      v: 3,
      scene: "station",           // where the manager is standing right now
      visited: {},                 // sceneId -> 1 (unlocks quick travel)
      seen: {},                    // dialogueId -> times seen
      flags: {},                   // world flags (metGaffer, founded, …)
      discoveries: [],             // optional hotspot ids found
      notebook: [],                // [{t, txt}] anchors, promises, history
      history: [],                 // dialogue transcript (capped)
      settings: { textSpeed: 1, instant: false, reduced: false, sound: false }
    };
  }
  function load() {
    if (_s) return _s;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { _s = JSON.parse(raw); if (_s && _s.v === 3) return _s; }
    } catch (e) {}
    _s = fresh();
    return _s;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(_s)); } catch (e) {}
  }
  function note(txt) {
    var s = load();
    if (s.notebook.some(function (n) { return n.txt === txt; })) return;
    s.notebook.push({ t: Date.now ? 0 : 0, txt: txt });
    save();
  }
  function logLine(sp, txt) {
    var s = load();
    s.history.push(sp + ": " + txt);
    if (s.history.length > 200) s.history = s.history.slice(-200);
  }
  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    _s = null;
  }
  return { KEY: KEY, load: load, save: save, note: note, logLine: logLine, reset: reset, fresh: fresh };
})();
