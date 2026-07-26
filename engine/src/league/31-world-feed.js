// ---- 31-world-feed.js — the client reads the SERVED world -----------------
// P1 deliverable (f): when a World Service is configured, England's league
// on the planet comes from the server's snapshots - real persisted matches
// run by the umpire - instead of the local deterministic sim. Configure via
//   localStorage.fo_world_api = "https://your-service"   (no trailing slash)
// Absent or unreachable, the client falls back silently to local sim: the
// static game never breaks because a server is down.
(function () {
  "use strict";
  function base() {
    try { return (localStorage.getItem("fo_world_api") || window.FO_WORLD_API || "").replace(/\/$/, ""); } catch (e) { return ""; }
  }
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  var FEED = null;
  function refresh() {
    var b = base(); if (!b) return;
    try {
      fetch(b + "/league/eng.json", { mode: "cors" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.table) return;
        FEED = j; window.__foWorldFeed = j;
        try { localStorage.setItem("fo_world_feed_cache", JSON.stringify(j)); } catch (e) {}
        paint();
      }).catch(function () {});
    } catch (e) {}
  }
  try { var c = localStorage.getItem("fo_world_feed_cache"); if (c && base()) { FEED = JSON.parse(c); window.__foWorldFeed = FEED; } } catch (e) {}

  // the served-world card on the planet page: the SERVER's England league
  function paint() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/planet") return;
      if (!FEED) return;
      var page = document.getElementById("page"); if (!page) return;
      var host = page.querySelector(".fo-pl"); if (!host) return;
      var ex = page.querySelector("#fo-wsvc"); if (ex) ex.remove();
      var top3 = FEED.table.slice(0, 3).map(function (r, i) {
        return "<div class='r'><i>" + (i + 1) + "</i><b>" + E(r.name) + (r.boss ? " <u>BOSS</u>" : "") + "</b><em>" + r.pts + " pts</em></div>";
      }).join("");
      var el = document.createElement("div");
      el.id = "fo-wsvc";
      el.innerHTML = "<i>The World Service &middot; served world &middot; engine " + E(FEED.results.length ? FEED.results[0].engineVersion : "v1") + "</i>" +
        "<b>England, Season " + FEED.seasonNo + " &middot; round " + FEED.roundsPlayed + " of " + FEED.rounds + "</b>" + top3 +
        (FEED.results.length ? "<span>" + E(FEED.results[FEED.results.length - 1].text) + "</span>" : "");
      var own = page.querySelector(".fo-pl-own");
      if (own && own.parentNode) own.parentNode.insertBefore(el, own.nextSibling);
      else host.appendChild(el);
    } catch (e) {}
  }
  var CSS = [
    "html body #page #fo-wsvc{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-left:3px solid #177A57;border-radius:16px;padding:14px 16px}",
    "html body #page #fo-wsvc>i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#177A57;font-style:normal}",
    "html body #page #fo-wsvc>b{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:15px;margin:6px 0 8px;color:#141C28}",
    "html body #page #fo-wsvc .r{display:flex;gap:8px;align-items:baseline;font:500 12px/1.5 Inter,sans-serif;color:#141C28}",
    "html body #page #fo-wsvc .r i{font-style:normal;color:rgba(20,28,40,.45);width:12px}",
    "html body #page #fo-wsvc .r b{flex:1;font-weight:600}",
    "html body #page #fo-wsvc .r u{text-decoration:none;font:700 8px/1 Oswald,sans-serif;color:#B44A22;letter-spacing:.1em}",
    "html body #page #fo-wsvc .r em{font-style:normal;font-variant-numeric:tabular-nums}",
    "html body #page #fo-wsvc>span{display:block;font:italic 400 11.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);margin-top:7px}"
  ].join("\n");
  function mount() {
    try {
      var s = document.getElementById("fo-wsvc-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-wsvc-css"; s.textContent = CSS; document.body.appendChild(s); }
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); setTimeout(refresh, 600); });
  else { setTimeout(mount, 0); setTimeout(refresh, 600); }
  setInterval(refresh, 120000);
  window.addEventListener("hashchange", function () { setTimeout(paint, 200); });
  window.__foWorldFeedRefresh = refresh;
})();
