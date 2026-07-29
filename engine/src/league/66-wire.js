/* ============================================================================
   THE WIRE (#/wire) — what the rest of the world did today.

   This route used to paint the Circuit-era World Desk: a hero, a boss gallery
   and a hall of fame, all read out of FO_WORLD_SNAPSHOT, the baked snapshot of
   a game mode this project retired. It has been showing a museum piece.

   The wire that actually exists is the living planet's: nineteen national
   leagues on one deterministic clock, their rounds settling at their own local
   hours, the World Cup in its window, champions crowned and farewells filed.
   The Gazette already prints eight lines of it on its foreign page. This is
   all of it, in the order the world filed it, which is what a wire is.

   Derived, never stored: genWire is a pure function of the world clock, so the
   same day reads the same on every phone in every timezone.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foAlWire) return; window.__foAlWire = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function on() { return (location.hash || "").split("?")[0] === "#/wire"; }
  function A() { return window.AL || null; }

  // the wire's own categories, in the order a desk would read them
  var CATS = [
    { id: "cup", label: "The World Cup" },
    { id: "honours", label: "Champions and honours" },
    { id: "league", label: "League cricket" },
    { id: "other", label: "Everything else" },
  ];
  function catOf(w) {
    var c = String(w.category || "").toLowerCase();
    for (var i = 0; i < CATS.length; i++) if (CATS[i].id === c) return CATS[i].id;
    return "other";
  }

  window.foRenderWire = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}

    var wire = [], season = null, day = null;
    try {
      if (window.__foPlanet) {
        wire = __foPlanet.genWire(Date.now()) || [];
        if (wire.length) { season = wire[0].season; day = wire[0].day; }
      }
    } catch (e2) {}

    var body = al.head("The world service" + (season != null ? " · season " + season : ""), "The Wire",
      "Nineteen national leagues on one clock. Each round settles at its own local hour, so the wire fills " +
      "through the day whether anybody is reading it or not.");
    body += al.subnav("wire");

    if (!wire.length) {
      page.innerHTML = al.page({ body: body + al.empty("The wire is quiet",
        "Nothing has come in yet today. The foreign rounds settle at their own hours — look in later.") });
      return;
    }

    // the biggest story of the day leads, because that is what a wire is for
    var lead = wire.slice().sort(function (a, b) { return (b.importance | 0) - (a.importance | 0); })[0];
    body += al.decide({ kind: "", title: lead.headline,
      note: wire.length + " report" + (wire.length === 1 ? "" : "s") + " on the wire today" +
        (day != null ? " · world day " + day : "") });

    // grouped, in the order a desk would read them
    var by = {};
    wire.forEach(function (w) { (by[catOf(w)] = by[catOf(w)] || []).push(w); });
    CATS.forEach(function (c) {
      var list = by[c.id]; if (!list || !list.length) return;
      list.sort(function (a, b) { return (b.importance | 0) - (a.importance | 0); });
      body += al.sec(c.label + " · " + list.length,
        '<div class="al-fixlist">' + list.map(function (w) {
          return '<div class="al-fix al-fix--room"><span class="al-fix__t"><b>' + E(w.headline) + "</b>" +
            (w.dayInSeason != null ? "<i>day " + (w.dayInSeason | 0) + " of the season</i>" : "") +
            "</span></div>";
        }).join("") + "</div>",
        c.id === "league" ? { href: "#/planet", label: "World cricket" } : null);
    });

    body += '<p class="al-read">Every line is derived from the world clock, so the same day reads the same ' +
      "on every phone in every timezone.</p>";
    page.innerHTML = al.page({ body: body });
  };
})();
