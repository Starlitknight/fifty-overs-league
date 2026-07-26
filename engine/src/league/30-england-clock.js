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
  var DAY = 86400000, ENG_H = 14;
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
        if (t == null || Date.now() < t) break;
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
    "@media(max-width:560px){#topbar#topbar #fo-wclock b{font-size:8.5px}#topbar#topbar #fo-wclock{margin-left:6px;padding:4px 8px}}"
  ].join("\n");
  function mountCss() {
    try {
      var s = document.getElementById("fo-wclock-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-wclock-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }

  function boot() { mountCss(); mountClock(); setTimeout(tick, 1200); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
  setInterval(function () { mountClock(); }, 30000);
  setInterval(tick, 60000);

  window.foRoundTime = roundTime;
  window.foRoundTimeTxt = roundTimeTxt;
  window.__foEngClock = { ensureAnchor: ensureAnchor, tick: tick };
})();
