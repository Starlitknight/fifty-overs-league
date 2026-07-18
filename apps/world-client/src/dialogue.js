/* world-client/dialogue — the conversation engine. One thought per box,
 * tap / Enter / Space to advance, expressions, 2–3 choices when a choice is
 * real, conditional lines from actual facts. Lines may be strings or
 * functions of (w, B) so dialogue can only ever quote saved facts.
 */
FOW.dialogue = (function () {
  var NODES = {};
  var active = null;   // {node, lineIx, onClose}

  function register(n) { NODES[n.id] = n; }
  function node(id) { return NODES[id] || null; }

  function resolveLines(n, w, B) {
    var out = [];
    (n.lines || []).forEach(function (l) {
      var txt = typeof l === "function" ? l(w, B) : l;
      if (txt) out.push(txt);
    });
    return out;
  }

  function play(id, onClose) {
    var n = node(id);
    var w = FOW.state.load(), B = FOW.bridge;
    if (!n) { if (onClose) onClose(); return; }
    if (n.cond && !n.cond(w, B)) { if (onClose) onClose(); return; }
    active = { node: n, lines: resolveLines(n, w, B), lineIx: 0, onClose: onClose || null };
    w.seen[id] = (w.seen[id] || 0) + 1;
    FOW.state.save();
    FOW.renderer.showDialogue(active);
  }

  // advance one box; returns true while the conversation continues
  function advance() {
    if (!active) return false;
    var w = FOW.state.load(), B = FOW.bridge;
    var n = active.node;
    FOW.state.logLine(n.sp, active.lines[active.lineIx] || "");
    active.lineIx++;
    if (active.lineIx < active.lines.length) {
      FOW.renderer.showDialogue(active);
      return true;
    }
    // lines exhausted: choices (static or built live from the squad), chain, or close
    if ((n.choices && n.choices.length) || n.dynChoices) {
      FOW.renderer.showChoices(active);
      return true;
    }
    finish(n, null);
    return false;
  }

  function choose(i) {
    if (!active) return;
    var n = active.node;
    var c = n.choices && n.choices[i];
    if (!c) return;
    FOW.state.logLine("You", c.t);
    finish(n, c);
  }

  function finish(n, choice) {
    var w = FOW.state.load(), B = FOW.bridge;
    try { if (n.effects) n.effects(w, B); } catch (e) {}
    try { if (choice && choice.fx) choice.fx(w, B); } catch (e2) {}
    FOW.state.save();
    var nxt = (choice && choice.next) || n.next;
    var onClose = active.onClose;
    active = null;
    FOW.renderer.hideDialogue();
    if (nxt) play(nxt, onClose);
    else {
      if (onClose) onClose();
      FOW.renderer.refresh();   // control returns to the place
    }
  }

  function isOpen() { return !!active; }
  function skipAll() {   // repeat-play courtesy: jump to the end of the lines
    if (!active) return;
    active.lineIx = Math.max(active.lineIx, active.lines.length - 1);
    FOW.renderer.showDialogue(active);
  }

  return { register: register, node: node, play: play, advance: advance,
    choose: choose, isOpen: isOpen, skipAll: skipAll, _nodes: NODES };
})();
