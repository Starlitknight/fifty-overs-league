/* ============================================================================
   TEAM (#/team) — choosing and ordering the eleven.

   This is the game's central act, so the page is a selection workspace and
   nothing else. A persistent summary at the top always answers the only
   question that matters while you are here - how many of the eleven are
   chosen, who is captain, who keeps, how many overs are covered, and what is
   still wrong. Below it, two lists: the XI in batting order, and the reserves.

   Rows, not collectible cards. A row is [position] · name · role and form ·
   rating, on one line, at 48px, tappable along its whole length. Tapping the
   name opens the folio; the control at the left adds, removes or moves.

   It writes the SAME App.orders the old orders page writes and saves through
   the same saveGame, so a plan made here is the plan the umpire plays. No new
   storage, no parallel state.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foTeam) return; window.__foTeam = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function on() { return (location.hash || "").split("?")[0] === "#/team"; }
  function A() { return window.AL || null; }
  function squad() { try { return (userTeam() || {}).players || []; } catch (e) { return []; } }
  function ord() {
    try {
      if (!App.orders) App.orders = {};
      if (!Array.isArray(App.orders.batOrder)) App.orders.batOrder = [];
      if (!App.orders.spells) App.orders.spells = { north: [], south: [] };
      return App.orders;
    } catch (e) { return { batOrder: [], spells: { north: [], south: [] } }; }
  }
  function byName(n) { var s = squad(); for (var i = 0; i < s.length; i++) if (s[i] && s[i].name === n) return s[i]; return null; }
  function save() { try { if (typeof saveGame === "function") saveGame(false); } catch (e) {} }

  // ---- what the manager needs to know at a glance -------------------------
  function summary() {
    var o = ord(), xi = (o.batOrder || []).filter(Boolean);
    var overs = 0;
    try {
      ["north", "south"].forEach(function (end) {
        (o.spells[end] || []).forEach(function (sp) { if (sp && sp.bowler) overs++; });
      });
    } catch (e) {}
    var faults = [];
    if (xi.length < 11) faults.push((11 - xi.length) + " still to pick");
    if (xi.length > 11) faults.push("too many selected");
    var seen = {}; xi.forEach(function (n) { if (seen[n]) faults.push("duplicate: " + n); seen[n] = 1; });
    if (o.captain && xi.indexOf(o.captain) < 0) faults.push("captain is not in the XI");
    if (o.keeper && xi.indexOf(o.keeper) < 0) faults.push("keeper is not in the XI");
    if (xi.length === 11 && !o.keeper) faults.push("no wicketkeeper named");
    if (xi.length === 11 && !o.captain) faults.push("no captain named");
    return { xi: xi, n: xi.length, overs: overs, faults: faults, captain: o.captain || "", keeper: o.keeper || "", saved: !!o.saved };
  }

  function formWord(p) {
    try {
      var f = (p && p.form) || "";
      if (typeof f === "number") return f > 60 ? "Good form" : f < 40 ? "Out of form" : "Steady";
      return String(f || "").replace(/^\w/, function (c) { return c.toUpperCase(); }) || "Steady";
    } catch (e) { return "Steady"; }
  }
  function roleWord(p) { return String((p && (p.roleFull || p.role)) || "Player"); }

  function row(p, pos, inXI) {
    if (!p) return "";
    var n = E(p.name);
    return '<button class="al-prow' + (inXI ? " al-prow--picked" : "") + '" data-al-p="' + n + '">' +
      '<span class="al-prow__no">' + (inXI ? ("0" + pos).slice(-2) : "+") + "</span>" +
      '<span class="al-prow__who"><b>' + n + "</b><i>" + E(roleWord(p)) + " &middot; " + E(formWord(p)) + "</i></span>" +
      '<span class="al-prow__rate">' + ((p.rating | 0) || "&mdash;") + "</span>" +
      "</button>";
  }

  window.foRenderTeamPage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var s = summary(), o = ord(), all = squad();
    var picked = {}; s.xi.forEach(function (n) { picked[n] = 1; });
    var reserves = all.filter(function (p) { return p && !picked[p.name]; });

    var body = al.mast("The eleven", "Team", "Pick the eleven and set the order they bat in. Tap a name for the folio.");

    // ---- the persistent summary: the page's whole job, in one strip -------
    var ok = s.n === 11 && !s.faults.length;
    body += al.decide({
      kind: ok ? "done" : "act",
      title: "Playing XI · " + s.n + "/11" +
        (s.captain ? "  ·  C " + s.captain.split(" ").pop() : "") +
        (s.keeper ? "  ·  WK " + s.keeper.split(" ").pop() : ""),
      note: s.faults.length ? s.faults.join(" · ")
        : s.overs + " of 20 bowling spells assigned · the plan is legal",
    });

    // ---- the XI, in batting order ----------------------------------------
    var xiHtml = s.n
      ? '<div class="al-players">' + s.xi.map(function (n, i) { return row(byName(n), i + 1, true); }).join("") + "</div>"
      : al.empty("No one picked yet", "Choose eleven from the reserves below, or let the Gaffer suggest a side.");
    var tools = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
      '<button class="al-btn" data-al-act="suggest">Suggest a side</button>' +
      '<button class="al-btn" data-al-act="previous">Load last plan</button>' +
      (s.n ? '<button class="al-btn" data-al-act="clear">Clear</button>' : "") + "</div>";
    body += al.sec("Playing XI", xiHtml + tools);

    // ---- reserves ---------------------------------------------------------
    body += al.sec("Reserves &middot; " + reserves.length,
      reserves.length
        ? '<div class="al-players">' + reserves.map(function (p) { return row(p, 0, false); }).join("") + "</div>"
        : al.empty("Everyone is playing", "There is nobody left on the sidelines."));

    var acting = !ok || !s.saved;
    page.innerHTML = al.page({
      body: body, acting: acting,
      sticky: acting ? al.sticky(
        ok ? "Eleven chosen · the plan is not filed yet" : "Playing XI incomplete · " + s.n + " of 11",
        ok ? "File the plan" : "Suggest a side", ok ? "file" : "suggest") : "",
    });
    wire();
  };

  // ---- the folio: everything about one player, in a sheet -----------------
  function folio(name) {
    var p = byName(name); if (!p) return;
    var al = A(); if (!al) return;
    var o = ord(), inXI = (o.batOrder || []).indexOf(name) >= 0;
    var rows = [
      ["Role", roleWord(p)],
      ["Age", String(p.age || "—")],
      ["Nationality", String(p.nat || p.country || "—")],
      ["Rating", String(p.rating | 0)],
      ["Form", formWord(p)],
      ["Fitness", String(p.fatigue || "rested")],
      ["Experience", String(p.exp != null ? p.exp : "—")],
      ["Wage", p.wage != null ? "$" + Number(p.wage).toLocaleString() : "—"],
    ];
    var el = document.createElement("div");
    el.className = "al-sheet";
    el.innerHTML = '<div class="al-sheet__panel">' +
      '<div class="al-sheet__grip"><b>' + E(p.name) + "</b>" +
      '<button class="al-btn" data-al-close>Close</button></div>' +
      '<div class="al-sheet__body">' +
      al.ledger(rows) +
      '<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">' +
      '<button class="al-btn ' + (inXI ? "" : "al-btn--primary") + '" data-al-toggle="' + E(name) + '">' +
      (inXI ? "Leave out" : "Add to the XI") + "</button>" +
      (inXI ? '<button class="al-btn" data-al-up="' + E(name) + '">Move up</button>' +
              '<button class="al-btn" data-al-cap="' + E(name) + '">Make captain</button>' +
              '<button class="al-btn" data-al-wk="' + E(name) + '">Make keeper</button>' : "") +
      "</div></div></div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target : null; if (!t) return;
      if (ev.target === el || ev.target.closest("[data-al-close]")) { el.remove(); return; }
      var n;
      if ((n = ev.target.closest("[data-al-toggle]"))) { toggle(n.getAttribute("data-al-toggle")); el.remove(); return; }
      if ((n = ev.target.closest("[data-al-up]"))) { move(n.getAttribute("data-al-up"), -1); el.remove(); return; }
      if ((n = ev.target.closest("[data-al-cap]"))) { ord().captain = n.getAttribute("data-al-cap"); ord().saved = false; save(); el.remove(); repaint(); return; }
      if ((n = ev.target.closest("[data-al-wk]"))) { ord().keeper = n.getAttribute("data-al-wk"); ord().saved = false; save(); el.remove(); repaint(); return; }
    });
  }

  function repaint() { try { window.foRenderTeamPage(); } catch (e) {} }
  function toggle(name) {
    var o = ord(), i = o.batOrder.indexOf(name);
    if (i >= 0) o.batOrder.splice(i, 1);
    else if (o.batOrder.filter(Boolean).length < 11) o.batOrder.push(name);
    o.saved = false; save(); repaint();
  }
  function move(name, d) {
    var o = ord(), i = o.batOrder.indexOf(name), j = i + d;
    if (i < 0 || j < 0 || j >= o.batOrder.length) return;
    var t = o.batOrder[i]; o.batOrder[i] = o.batOrder[j]; o.batOrder[j] = t;
    o.saved = false; save(); repaint();
  }

  function wire() {
    var host = document.getElementById("page"); if (!host || host.__alW) return;
    host.__alW = 1;
    host.addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-al-p]") : null;
      if (b) { folio(b.getAttribute("data-al-p")); return; }
      var a = ev.target.closest ? ev.target.closest("[data-al-act]") : null;
      if (a) act(a.getAttribute("data-al-act"));
    });
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest ? ev.target.closest(".al-sticky [data-al-act]") : null;
      if (a && on()) act(a.getAttribute("data-al-act"));
    });
  }
  function act(what) {
    var o = ord();
    if (what === "suggest") {
      // the engine's own selector - the same one the old orders page used, so
      // a suggested side here is a suggested side there
      try { if (typeof suggestOrders === "function") suggestOrders(); } catch (e) {}
      o.saved = false; save(); repaint(); return;
    }
    if (what === "previous") {
      try { if (App.defaults) App.orders = JSON.parse(JSON.stringify(App.defaults)); } catch (e) {}
      ord().saved = false; save(); repaint(); return;
    }
    if (what === "clear") { o.batOrder = []; o.saved = false; save(); repaint(); return; }
    if (what === "file") {
      o.saved = true;
      try { App.defaults = JSON.parse(JSON.stringify(App.orders)); } catch (e) {}
      save(); repaint(); return;
    }
  }

  // NOTHING TO SWEEP HERE. The sticky bar lives inside #page, which every
  // route replaces wholesale; a hashchange handler that removed it also ran
  // AFTER a sibling screen had painted its own, and deleted that one.
  window.addEventListener("hashchange", function () {
    if (on()) return;
    var sh = document.querySelector(".al-sheet"); if (sh && sh.parentNode) sh.parentNode.removeChild(sh);
  });
})();
