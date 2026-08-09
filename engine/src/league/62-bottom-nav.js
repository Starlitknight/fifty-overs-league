// ---- 62-bottom-nav.js — THE THUMB ROW (phones only) -------------------------
// On a phone the top navigation is two taps and a reach away, and the one
// thing a manager opens the game FOR - today's cricket - lived behind it.
// This is the sports-app answer: five doors pinned under the thumb, the
// MATCH in the middle wearing the brand, the rest quiet. Desktop never sees
// it; the bar lives outside #page so no room's own layout has to know.
(function () {
  "use strict";
  if (window.__foBnav) return; window.__foBnav = 1;

  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); }
    catch (e) { return null; }
  }
  var IC = {
    club: "<path d='M4 11l8-7 8 7'/><path d='M6 9.5V20h12V9.5'/>",
    squad: "<circle cx='9' cy='8' r='3'/><path d='M3 20a6 6 0 0 1 12 0'/><circle cx='17' cy='9' r='2.4'/><path d='M14.5 20a5 5 0 0 1 7 0'/>",
    match: "<circle cx='12' cy='12' r='9'/><path d='M5.4 8.2c4 1.6 9.2 1.6 13.2 0M5.4 15.8c4-1.6 9.2-1.6 13.2 0'/>",
    market: "<path d='M3 20h11'/><path d='M6 12l6-6 5 5-6 6z'/><path d='M14 5l5 5'/>",
    stats: "<path d='M5 20V11M12 20V4M19 20v-6'/>"
  };
  function ic(k) {
    return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.9' " +
      "stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + IC[k] + "</svg>";
  }
  // which door the current hash belongs to, for the lit state
  function roomOf(h) {
    h = String(h || "").split("?")[0];
    if (h === "#/squad" || h === "#/player" || h === "#/training" || h === "#/academy") return "squad";
    if (h === "#/feed" || h === "#/watch" || h === "#/preview" || h === "#/report" || h === "#/match") return "match";
    if (h === "#/market") return "market";
    if (h === "#/stats" || h === "#/rankings" || h === "#/almanack" || h === "#/league" || h === "#/schedule") return "stats";
    return "club";
  }
  function matchHref() {
    var c = claim();
    return c && c.country ? "#/feed?n=" + encodeURIComponent(c.country) : "#/home";
  }
  function paint() {
    var bar = document.getElementById("fo-bnav");
    if (!bar) return;
    var cur = roomOf(location.hash);
    bar.querySelectorAll("a").forEach(function (a) {
      a.classList.toggle("on", a.getAttribute("data-k") === cur);
    });
    var m = bar.querySelector("a[data-k='match']");
    if (m) m.setAttribute("href", matchHref());
  }
  function mount() {
    if (document.getElementById("fo-bnav")) { paint(); return; }
    css();
    var bar = document.createElement("nav");
    bar.id = "fo-bnav";
    bar.setAttribute("aria-label", "Quick navigation");
    bar.innerHTML =
      "<a data-k='club' href='#/home'>" + ic("club") + "<span>Club</span></a>" +
      "<a data-k='squad' href='#/squad'>" + ic("squad") + "<span>Squad</span></a>" +
      "<a data-k='match' class='big' href='" + matchHref() + "'>" + ic("match") + "<span>Match</span></a>" +
      "<a data-k='market' href='#/market'>" + ic("market") + "<span>Market</span></a>" +
      "<a data-k='stats' href='#/stats'>" + ic("stats") + "<span>Stats</span></a>";
    document.body.appendChild(bar);
    document.body.classList.add("fo-bnav-on");
    paint();
  }
  function css() {
    if (document.getElementById("fo-bnav-css")) return;
    var s = document.createElement("style"); s.id = "fo-bnav-css";
    s.textContent = [
      "#fo-bnav{display:none}",
      "@media(max-width:760px){",
      "#fo-bnav{position:fixed;left:0;right:0;bottom:0;z-index:900;display:grid;grid-template-columns:repeat(5,1fr);",
      "background:rgba(7,22,46,.97);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);",
      "border-top:1px solid rgba(201,87,31,.5);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}",
      "#fo-bnav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;",
      "min-height:48px;border-radius:11px;text-decoration:none !important;color:rgba(220,233,242,.62) !important}",
      "#fo-bnav a svg{width:21px;height:21px}",
      "#fo-bnav a span{font:700 10px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      "#fo-bnav a.on{color:#FFFDF7 !important;background:rgba(255,253,247,.08)}",
      "#fo-bnav a.big{color:#FFF6EE !important;background:linear-gradient(180deg,#D06035,#B84E28);",
      "box-shadow:0 2px 10px rgba(184,78,40,.35);margin:-10px 2px 0;min-height:56px;border-radius:14px}",
      "#fo-bnav a.big.on{outline:2px solid rgba(232,185,106,.7);outline-offset:1px}",
      // the room underneath breathes above the bar: the last card must never
      // be pinned beneath the thumb row
      "body.fo-bnav-on #page,body.fo-bnav-on #foContent{padding-bottom:calc(78px + env(safe-area-inset-bottom)) !important}",
      "}"
    ].join("\n");
    document.head.appendChild(s);
  }
  window.addEventListener("hashchange", function () { setTimeout(paint, 30); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 200); });
  else setTimeout(mount, 200);
  // the topbar is rebuilt by boot passes; the bar only needs to exist once,
  // but a paint after each rebuild keeps the lit door honest
  setInterval(function () { try { mount(); } catch (e) {} }, 5000);
})();
