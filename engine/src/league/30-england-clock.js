// ---- 30-england-clock.js — the world clock, and England joins it --------------
// Three promises kept:
//   THE CLOCK IS VISIBLE: a real-date, real-time UTC clock lives in the top
//     bar on every screen - tap it and you're on the planet.
//   FIXTURES HAVE TIMES: every upcoming round of YOUR league carries its
//     date and hour. England is the 14:00 UTC league.
//   THE LEAGUE KEEPS ITS OWN TIME: one round per day resolves at 14:00 UTC
//     whether you show up or not - your saved orders (or last plan) play the
//     match. Open the app after three days away and three rounds have
//     happened, exactly as a real fixture list would demand.
//
// The schedule is anchored once per season in the save (App.wcal) and synced
// with it, so every device that opens the save agrees on which round belongs
// to which day. Multiplayer league seasons (SYNC) keep their own server
// cadence - this clock only drives solo/bot seasons.
(function () {
  "use strict";
  function P() { return window.__foPlanet || null; }
  var DAY = 86400000, ENG_H = 14, LIVE_MS = 3 * 3600000;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function ready() {
    return typeof App !== "undefined" && App && App.season && App.season.schedule && typeof completeRound === "function";
  }
  function syncLive() { try { return !!(SYNC && SYNC.started && !SYNC.practice); } catch (e) { return false; } }

  // ---- the season's anchor: round r plays on world day (d0 + r - r0) ---------
  function ensureAnchor() {
    try {
      if (!ready() || !P()) return null;
      var d = P().dayIx(Date.now());
      if (!App.wcal || App.wcal.season !== (App.seasonNo || 1) || !(App.wcal.d0 > 0)) {
        App.wcal = { season: App.seasonNo || 1, d0: d + 1, r0: App.season.round | 0 };
        try { saveGame(false); } catch (eS) {}
      }
      return App.wcal;
    } catch (e) { return null; }
  }
  function roundTime(r) {
    var a = ensureAnchor(); if (!a || !P()) return null;
    if (r < a.r0) return null;
    return P().EPOCH + (a.d0 + (r - a.r0)) * DAY + ENG_H * 3600000;
  }
  function roundTimeTxt(r) {
    var t = roundTime(r); if (!t) return "";
    var d = new Date(t), now = Date.now();
    var days = Math.floor(t / DAY) - Math.floor(now / DAY);
    var day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : DOW[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()];
    return day + " · 14:00 UTC";
  }

  // ---- the round plays whether you show up or not ----------------------------
  function tick() {
    try {
      if (!ready() || syncLive()) return;
      try { if (typeof M !== "undefined" && M && !M.done) return; } catch (eM) {}
      var a = ensureAnchor(); if (!a) return;
      var played = 0;
      while (played < 20) {
        var r = App.season.round | 0;
        if (r >= App.season.schedule.length) break;
        var t = roundTime(r);
        // the window is sacred: from 14:00 to 17:00 the match belongs to
        // whoever is watching - the clock only settles it after stumps
        if (t == null || Date.now() < t + LIVE_MS) break;
        completeRound();
        played++;
        if ((App.season.round | 0) <= r) break; // safety: no progress, stop
      }
      if (played) {
        try { var pg = document.getElementById("page"); if (pg) { pg.__foHomeSig = null; pg.__foLgSig = null; } } catch (eP) {}
        try { if (typeof window.route === "function") window.route(); } catch (eR) {}
      }
    } catch (e) { try { console.warn("foEngClock", e); } catch (e2) {} }
  }

  // ---- the clock in the top bar ----------------------------------------------
  function clockTxt() {
    var n = new Date();
    var t = DOW[n.getUTCDay()] + " " + n.getUTCDate() + " " + MON[n.getUTCMonth()] +
      " · " + (n.getUTCHours() < 10 ? "0" : "") + n.getUTCHours() + ":" + (n.getUTCMinutes() < 10 ? "0" : "") + n.getUTCMinutes() + " UTC";
    var live = 0;
    try {
      var pl = P();
      if (pl) {
        var h = (Date.now() - (pl.EPOCH + pl.dayIx(Date.now()) * DAY)) / 3600000;
        (window.__foCxAPI ? window.__foCxAPI.regions() : []).forEach(function (r) {
          if (r.final) return;
          var h0 = pl.natHour(r.id);
          if (h >= h0 && h < h0 + (pl.LIVE_LEN || 3)) live++;
        });
      }
    } catch (e) {}
    return { t: t, live: live };
  }
  function mountClock() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      var el = document.getElementById("fo-wclock");
      if (!el) {
        el = document.createElement("a");
        el.id = "fo-wclock"; el.href = "#/planet";
        el.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/planet"; if (typeof window.route === "function") window.route(); });
        var brand = tb.querySelector(".brand");
        if (brand && brand.parentNode) brand.parentNode.insertBefore(el, brand.nextSibling);
        else tb.appendChild(el);
      }
      var c = clockTxt();
      el.innerHTML = "<b>" + c.t + "</b>" + (c.live ? "<i>" + c.live + " LIVE</i>" : "");
    } catch (e) {}
  }

  var CSS = [
    "#topbar#topbar #fo-wclock{display:inline-flex;align-items:center;gap:6px;margin-left:10px;text-decoration:none;background:rgba(255,254,252,.08);border:1px solid rgba(255,254,252,.14);border-radius:999px;padding:4px 10px;cursor:pointer}",
    "#topbar#topbar #fo-wclock b{font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.08em;color:#E8DFCE;white-space:nowrap}",
    "#topbar#topbar #fo-wclock i{font:800 8.5px/1 Oswald,sans-serif;letter-spacing:.06em;color:#FF6B5E;font-style:normal;white-space:nowrap}",
    "@media(max-width:560px){#topbar#topbar #fo-wclock b{font-size:8.5px}#topbar#topbar #fo-wclock{margin-left:6px;padding:4px 8px}}",
    "html body #fo-eng-live{position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:1200;display:inline-flex;align-items:center;gap:8px;background:#B23230;color:#FFFEFC !important;font:800 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;padding:12px 18px;text-decoration:none;box-shadow:0 14px 34px rgba(178,50,48,.45)}",
    "html body #fo-eng-live i{width:8px;height:8px;border-radius:50%;background:#FFFEFC;animation:foEngPulse 1.2s ease-in-out infinite}",
    "@keyframes foEngPulse{0%,100%{opacity:1}50%{opacity:.25}}"
  ].join("\n");
  function mountCss() {
    try {
      var s = document.getElementById("fo-wclock-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-wclock-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }

  // your matchday is LIVE right now - the banner that takes you to the ground
  function liveNow() {
    try {
      if (!ready() || syncLive()) return false;
      try { if (typeof M !== "undefined" && M && !M.done) return false; } catch (eM) {}
      var r = App.season.round | 0;
      if (r >= App.season.schedule.length) return false;
      var t = roundTime(r); if (t == null) return false;
      var n = Date.now();
      return n >= t && n < t + LIVE_MS;
    } catch (e) { return false; }
  }
  function mountBanner() {
    try {
      var on = liveNow();
      var h = (location.hash || "").split("?")[0];
      var hide = { "#/match": 1, "#/matchday": 1, "#/scorecard": 1, "#/orders": 1, "#/home": 1 };
      var el = document.getElementById("fo-eng-live");
      if (!on || hide[h]) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement("a");
        el.id = "fo-eng-live"; el.href = "#/home";
        el.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/home"; if (typeof window.route === "function") window.route(); });
        document.body.appendChild(el);
      }
      el.innerHTML = "<i></i>MATCHDAY LIVE &middot; Round " + ((App.season.round | 0) + 1) + " &mdash; take your seat &rsaquo;";
    } catch (e) {}
  }

  function boot() { mountCss(); mountClock(); mountBanner(); setTimeout(tick, 1200); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
  setInterval(function () { mountClock(); mountBanner(); }, 30000);
  window.addEventListener("hashchange", function () { setTimeout(mountBanner, 80); });
  setInterval(tick, 60000);

  window.foRoundTime = roundTime;
  window.foRoundTimeTxt = roundTimeTxt;
  window.__foEngClock = { ensureAnchor: ensureAnchor, tick: tick, liveNow: liveNow };
})();
