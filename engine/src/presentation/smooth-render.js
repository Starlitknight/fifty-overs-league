/* features/smooth-render — kill the per-ball page blink on the match centre.
 *
 * The engine's renderMatch() rebuilds the whole match page with
 * `$('#page').innerHTML = …` on every delivery, which flashes the page,
 * resets scroll, restarts CSS transitions and destroys the oval stage.
 *
 * This wraps renderMatch (outermost, after all overlay wrappers): the
 * original render is pointed at a hidden staging <div> (by briefly
 * swapping the #page id), then the staging DOM is MORPHED into the live
 * page — attributes and text are synced node-by-node and only genuinely
 * changed nodes are replaced. Unchanged panels aren't touched at all, the
 * commentary feed keeps its scroll, in-flight oval animations survive,
 * and the stage itself (#fo-oval, which the engine's HTML never contains)
 * is preserved in place.
 *
 * Safety valves: the wrapper steps aside (plain re-render) off the match
 * route and on the Charts tab, whose canvases are painted post-render and
 * would not survive a morph. Any morph error falls back to a straight
 * innerHTML copy — worst case is exactly today's behavior.
 */
FOC.smoothRender = (function () {
  function syncAttrs(live, tgt) {
    var i, a;
    for (i = live.attributes.length - 1; i >= 0; i--) {
      var n = live.attributes[i].name;
      if (!tgt.hasAttribute(n)) live.removeAttribute(n);
    }
    for (i = 0; i < tgt.attributes.length; i++) {
      a = tgt.attributes[i];
      if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
    }
  }
  // The commentary feed is a top-prepended list of immutable rows. Index-based
  // child alignment rewrites EVERY row when one is prepended (row i receives
  // row i-1's content) - the whole feed repainted per ball. Instead: find the
  // live top row inside the target (by textContent - decorators add name links
  // but never change text), insert only the genuinely new rows above it, trim
  // the tail. Falls back to the index morph when the lists don't line up
  // (filter change, innings reset).
  function feedSync(live, tgt) {
    var lf = live.firstElementChild;
    if (!lf) return false;
    var targetLen = 0; for (var q = tgt.firstChild; q; q = q.nextSibling) targetLen++;
    var sig = lf.textContent, hit = null, scan = 0;
    for (var t = tgt.firstElementChild; t && scan < 14; t = t.nextElementSibling, scan++) {
      if (t.textContent === sig) { hit = t; break; }
    }
    if (!hit) return false;
    var frag = document.createDocumentFragment(), n2 = tgt.firstChild;
    while (n2 && n2 !== hit) {
      var nx = n2.nextSibling;
      if (n2.nodeType === 1 && n2.classList) n2.classList.add("fo-rowin");   // slide in, don't teleport
      frag.appendChild(n2); n2 = nx;
    }
    if (frag.childNodes.length) live.insertBefore(frag, live.firstChild);
    while (live.childNodes.length > targetLen && live.lastChild) live.removeChild(live.lastChild);
    return true;
  }
  function morph(live, tgt) {
    syncAttrs(live, tgt);
    if ((String(live.className || "").indexOf("commfeed") >= 0 || live.id === "ftpcomm") && feedSync(live, tgt)) return;
    var lc = [], tc = [], n, i;
    for (n = live.firstChild; n; n = n.nextSibling) lc.push(n);
    for (n = tgt.firstChild; n; n = n.nextSibling) tc.push(n);
    for (i = 0; i < tc.length; i++) {
      var t = tc[i], l = lc[i];
      if (!l) { live.appendChild(t); continue; }               // adopt from staging
      if (l.nodeType !== t.nodeType || l.nodeName !== t.nodeName) { l.replaceWith(t); continue; }
      if (l.nodeType === 3) { if (l.nodeValue !== t.nodeValue) l.nodeValue = t.nodeValue; continue; }
      if (l.nodeType !== 1) continue;
      // keyed one-shot elements (the engine's event flash) must be
      // recreated so their CSS animation replays
      if ((l.getAttribute("key") || t.getAttribute("key")) &&
          l.getAttribute("key") !== t.getAttribute("key")) { l.replaceWith(t); continue; }
      if (l.outerHTML === t.outerHTML) continue;               // untouched subtree
      morph(l, t);
    }
    for (i = lc.length - 1; i >= tc.length; i--) lc[i].remove();
  }
  function morphPage(live, stage) {
    // runtime layout classes live on the REAL page only (the oval tick and the
    // decorators put them there) - the staging div never has them, so a plain
    // attr sync would strip them for a beat and flap the whole page layout
    var hadOval = live.classList.contains("fo-ovalgrid");
    var hadMp = live.classList.contains("fo-matchpage");
    var keepId = live.id;
    syncAttrs(live, stage);   // stage scaffold attrs (id/style) are stripped by the caller
    if (keepId) live.id = keepId;
    if (hadOval) live.classList.add("fo-ovalgrid");
    if (hadMp) live.classList.add("fo-matchpage");
    var lc = [], tc = [], n, i;
    for (n = live.firstChild; n; n = n.nextSibling) {
      if (!(n.nodeType === 1 && n.id === "fo-oval")) lc.push(n);   // the stage is ours
    }
    for (n = stage.firstChild; n; n = n.nextSibling) tc.push(n);
    for (i = 0; i < tc.length; i++) {
      var t = tc[i], l = lc[i];
      if (!l) { live.appendChild(t); continue; }
      if (l.nodeType !== t.nodeType || l.nodeName !== t.nodeName) { l.replaceWith(t); continue; }
      if (l.nodeType === 3) { if (l.nodeValue !== t.nodeValue) l.nodeValue = t.nodeValue; continue; }
      if (l.nodeType === 1) { if (l.outerHTML !== t.outerHTML) morph(l, t); }
    }
    for (i = lc.length - 1; i >= tc.length; i--) lc[i].remove();
  }

  function install() {
    if (typeof window === "undefined" || typeof window.renderMatch !== "function") return false;
    if (window.renderMatch.__foSmooth) return true;
    var orig = window.renderMatch;
    var wrapped = function () {
      var live = document.getElementById("page");
      var tab = "";
      try { tab = (typeof UI !== "undefined" && UI && UI.matchTab) || ""; } catch (e0) {}
      if (!live || (location.hash || "").split("?")[0] !== "#/match" || /chart/i.test(tab)) {
        return orig.apply(this, arguments);
      }
      var stage = document.createElement("div");
      stage.style.display = "none";
      live.id = "fo-page-live";
      stage.id = "page";
      (live.parentNode || document.body).insertBefore(stage, live);
      var ok = false;
      try { orig.apply(this, arguments); ok = true; }
      finally {
        stage.removeAttribute("id");
        stage.removeAttribute("style");
        live.id = "page";
        if (ok) {
          try { morphPage(live, stage); }
          catch (eM) { try { live.innerHTML = stage.innerHTML; } catch (e2) {} }
        }
        stage.remove();
      }
    };
    wrapped.__foSmooth = 1;
    window.renderMatch = wrapped;
    return true;
  }

  return { install: install, __test: { morph: morph, morphPage: morphPage } };
})();
