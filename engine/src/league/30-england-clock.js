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
  // THE MASTHEAD SAID "SEASON 1" over a world with a hundred and thirty-six
  // seasons behind it. The bar is shared by every league on the planet, so it
  // cannot print a national season number - it prints the year, which is the
  // one name for a season that every country agrees on.
  function SEASON_LAB(n) {
    try { if (window.__foPlanet && window.__foPlanet.seasonNo) return String(window.__foPlanet.seasonNo(n)); } catch (e) {}
    return String(n);
  }
  "use strict";
  function P() { return window.__foPlanet || null; }
  var DAY = 86400000, ENG_H = 14, LIVE_MS = 3 * 3600000;
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function ready() {
    return typeof App !== "undefined" && App && App.season && App.season.schedule && typeof completeRound === "function";
  }
  // SYNC lives in the league core's closure, which this file is NOT inside ·
  // reaching for it threw ReferenceError on every call, so this read false
  // forever and the clock below happily played league rounds on top of a
  // served season
  function syncLive() { try { return !!(window.__foLeague && window.__foLeague().live); } catch (e) { return false; } }

  // ---- ONE WORLD, DAY ONE: wipe the retired private league's leftovers ------
  // The world reset to Opening Day, but a save founded earlier still carries
  // played rounds of the old solo league (tables, results, "next: v Surrey").
  // Once per save, roll that season back to round zero and drop its old
  // league results, so nothing anywhere claims matches that no longer exist.
  function freshStartOnce() {
    try {
      if (localStorage.getItem("fo_fresh_d1") === "1") return true;
      if (!ready()) return false;
      // NOT SOMEBODY ELSE'S SEASON. This clears the retired SOLO league off a
      // save that predates the world - but it fires on any device that has not
      // run it yet, and a friends-league member signing in on a new phone gets
      // the shared season applied a second before this timer wakes up. It then
      // deletes every league result and puts the round back to zero, and since
      // the version has not moved the client will not re-apply the snapshot:
      // the manager is left staring at a league that has apparently never
      // played a match. Seen in a browser, 1.4 seconds after entry, 27 results
      // down to 2. A device showing a served season has nothing to clean up.
      if (syncLive()) { try { localStorage.setItem("fo_fresh_d1", "1"); } catch (eS) {} return true; }
      App.season.round = 0;
      App.season.played = {};
      try { if (App.season.res) App.season.res = {}; } catch (e1) {}
      try { App.wcal = null; } catch (e2) {}
      try { if (Array.isArray(App.results)) App.results = App.results.filter(function (r) { return !(r && r.comp === "league"); }); } catch (e3) {}
      try {
        var k = "fo_lg_solo";
        var v = JSON.parse(localStorage.getItem(k) || "null");
        if (v) { v.round = 0; v.res = {}; v.season = 1; localStorage.setItem(k, JSON.stringify(v)); }
      } catch (e4) {}
      try { if (typeof saveGame === "function") saveGame(); } catch (e5) {}
      localStorage.setItem("fo_fresh_d1", "1");
      return true;
    } catch (e) { return false; }
  }
  var fsTimer = setInterval(function () { if (freshStartOnce()) clearInterval(fsTimer); }, 1500);

  // ---- the season's anchor: round r plays on world day (d0 + r - r0) ---------
  function ensureAnchor() {
    try {
      if (!ready() || !P()) return null;
      var d = P().dayIx(Date.now());
      // anchors store absolute world days, so an epoch change (the fresh-start
      // calendar) must re-anchor: stamp the epoch and rebuild when it moves
      if (!App.wcal || App.wcal.season !== (App.seasonNo || 1) || !(App.wcal.d0 > 0) || App.wcal.e !== P().EPOCH) {
        App.wcal = { season: App.seasonNo || 1, d0: d + 1, r0: App.season.round | 0, e: P().EPOCH };
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
    // the next round, on his clock rather than the umpire's
    try {
      var P9 = P();
      if (P9 && P9.atTxt && P9.dayIx) return P9.atTxt(P9.dayIx(d.getTime()), 14).replace(/&middot;/g, "·");
    } catch (eA) {}
    var day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : DOW[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()];
    return day + " · 14:00";
  }

  // ---- the round plays whether you show up or not ----------------------------
  function tick() {
    try {
      if (!ready() || syncLive()) return;
      try { if (typeof M !== "undefined" && M && !M.done) return; } catch (eM) {}
      var a = ensureAnchor(); if (!a) return;
      // ONE ROUND PER WAKING. Catch-up used to play every overdue round in a
      // single synchronous loop - up to twenty rounds, a hundred simulated
      // matches, with the browser locked for the whole of it. A manager back
      // from a week away paid for the week in one frozen minute, staring at
      // whatever screen happened to be up. Now each pass settles one round and,
      // if more are owed, books another pass for the next breath - same
      // deterministic result, spread across moments the player can live
      // through. The block is bounded by one round, not by absence.
      var played = 0;
      var r = App.season.round | 0;
      if (r < App.season.schedule.length) {
        var t = roundTime(r);
        // the window is sacred: from 14:00 to 17:00 the match belongs to
        // whoever is watching - the clock only settles it after stumps
        if (t != null && Date.now() >= t + LIVE_MS) {
          completeRound();
          if ((App.season.round | 0) > r) {
            played = 1;
            var r2 = App.season.round | 0;
            var t2 = (r2 < App.season.schedule.length) ? roundTime(r2) : null;
            if (t2 != null && Date.now() >= t2 + LIVE_MS) setTimeout(tick, 150);
          }
        }
      }
      if (played) {
        try { var pg = document.getElementById("page"); if (pg) { pg.__foHomeSig = null; pg.__foLgSig = null; } } catch (eP) {}
        try { if (typeof window.route === "function") window.route(); } catch (eR) {}
      }
    } catch (e) { try { console.warn("foEngClock", e); } catch (e2) {} }
  }

  // ---- the clock in the top bar ----------------------------------------------
  function clockTxt() {
    // THE MASTHEAD SHOWS THE READER'S CLOCK. The world still turns on UTC;
    // he does not have to.
    var n = new Date();
    var z = ""; try { z = (P() && P().tzAbbr) ? P().tzAbbr() : ""; } catch (eZ) {}
    var t = DOW[n.getDay()] + " " + n.getDate() + " " + MON[n.getMonth()] +
      " · " + (n.getHours() < 10 ? "0" : "") + n.getHours() + ":" + (n.getMinutes() < 10 ? "0" : "") + n.getMinutes() +
      (z ? " " + z : "");
    var dayLn = "";
    // THE DAY IS THE SEASON'S DAY, NOT THE WORLD'S.
    //
    // This counted ph.day + 1, which is the day since the world's EPOCH. That
    // is only ever the same number as the season's day while the season happens
    // to have opened on day zero - true of the founding season and of nothing
    // else. Restart the world on a Monday three days out, as a redeal does, and
    // the header would announce DAY 8 on the very morning the season bowled its
    // first ball. ph.di is the day WITHIN the cycle, which is the number the
    // sentence is actually claiming.
    //
    // And a world that has been dealt but has not started yet is a real state -
    // it is exactly what the three days after a redeal are - so it gets a real
    // line instead of counting down from DAY 0.
    try {
      var ph = P().phaseOf(Date.now());
      if (ph.preseason) {
        var away = ((P().anchorOf() || {}).start | 0) - ph.day;
        dayLn = away > 0
          ? "SEASON " + SEASON_LAB(ph.season) + " · IN " + away + (away === 1 ? " DAY" : " DAYS")
          : "SEASON " + SEASON_LAB(ph.season) + " · FIRST BALL TODAY";
      } else {
        dayLn = "DAY " + (ph.di + 1) + " · SEASON " + SEASON_LAB(ph.season);
      }
    } catch (eD) {}
    var live = 0;
    try {
      var pl = P();
      // only a league day has live matches - the clock alone is not enough
      if (pl && pl.phaseOf(Date.now()).kind === "league") {
        var h = (Date.now() - (pl.EPOCH + pl.dayIx(Date.now()) * DAY)) / 3600000;
        (window.__foCxAPI ? window.__foCxAPI.regions() : []).forEach(function (r) {
          if (r.final) return;
          var h0 = pl.natHour(r.id);
          if (h >= h0 && h < h0 + (pl.LIVE_LEN || 3)) live++;
        });
      }
    } catch (e) {}
    return { t: t, live: live, day: dayLn };
  }
  function mountClock() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      var el = document.getElementById("fo-wclock");
      if (!el) {
        el = document.createElement("a");
        // THE CLOCK IS A DOOR, AND IT WAS THE WRONG ONE. It reads the day, the
        // season and how many leagues are in play, and clicking that "1 LIVE"
        // landed on the world MAP - a beautiful page that says nothing about
        // the cricket being played on it. A chip that counts live matches
        // should open the live matches.
        el.id = "fo-wclock"; el.href = "#/live";
        el.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/live"; if (typeof window.route === "function") window.route(); });
      }
      // SELF-HEALING, WITH TWO LAWFUL HOMES. The clock is an <a>, and the
      // topbar has decorators that round up anchors and file them elsewhere -
      // one sweeps them into the nav strip, which phones hide outright. So on
      // each mount the clock is put back if it has strayed. But #fo-hdr-right
      // is not straying: it IS the masthead's right edge now, and this check
      // used to yank the clock out of it back to a direct child of the bar -
      // where the anti-flash guard hides direct children until the group
      // adopts them. Two owners took turns, and the date blinked out and back
      // on every single navigation. The group is home; the bare bar is the
      // fallback when the group has not been built yet.
      var rt9 = tb.querySelector("#fo-hdr-right");
      if (el.parentNode !== tb && el.parentNode !== rt9) {
        if (rt9) rt9.appendChild(el);
        else {
          var brand = tb.querySelector(".brand");
          if (brand && brand.parentNode === tb) tb.insertBefore(el, brand.nextSibling);
          else tb.appendChild(el);
        }
      }
      var c = clockTxt();
      el.innerHTML = "<b>" + (c.day || "WORLD CRICKET") + (c.live ? " <i>&#9679; " + c.live + " LIVE</i>" : "") + "</b>" +
        "<span>" + c.t + "</span>";
    } catch (e) {}
  }

  var CSS = [
    // the world clock owns the header's top-right corner on every screen:
    // world day + season above, real date and UTC time below; tap for the planet
    "#topbar#topbar{position:sticky}",
    // THE DATELINE. This was a filled, bordered pill - a box sitting inside a
    // box, when everything else in the header is typography, so it read as
    // furniture competing with the wordmark rather than as part of it. Its two
    // lines were also nearly the same weight (9px and 8.5px letterspaced Manrope
    // caps), so neither led and the whole thing landed as one dense block.
    //
    // The container becomes a single gold hairline, the way a newspaper
    // masthead rules off its dateline, and the two lines are given a real
    // difference: the world's own calendar in gold Manrope caps above, the real
    // date and hour well back from it in quiet Inter below. Same facts, same
    // corner, one of them clearly first.
    // border-radius:0 IS LEAD, NOT POLISH. The clock is an <a>, and the topbar
    // rounds every anchor in it to 999px so the nav pills are pills. A straight
    // hairline inherited that radius and was drawn as a great gold ARC sweeping
    // through the header - invisible until now only because the old filled pill
    // had the same radius and wore it as a pill. The rule that made the box
    // work is the rule that breaks the line.
    "#topbar#topbar #fo-wclock{position:absolute;right:10px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:flex-end;gap:3px;text-decoration:none;padding:2px 0 2px 13px;border:0;border-left:1px solid rgba(232,185,106,.34);border-radius:0;background:none;cursor:pointer;z-index:5}",
    "#topbar#topbar #fo-wclock b{font:600 11px/1 Manrope,sans-serif;letter-spacing:.18em;color:#E8B96A;white-space:nowrap;text-transform:uppercase}",
    // Inter, not Manrope: the second line is a real date and a real clock, and
    // tabular figures stop the minutes shuffling the line every sixty seconds
    "#topbar#topbar #fo-wclock span{font:400 10px/1 Manrope,-apple-system,sans-serif;letter-spacing:.02em;color:rgba(241,238,230,.46);white-space:nowrap;font-variant-numeric:tabular-nums}",
    "#topbar#topbar #fo-wclock i{font:700 11px/1 Manrope,sans-serif;letter-spacing:.06em;color:#FF6B5E;font-style:normal;white-space:nowrap}",
    "@media(max-width:400px){#topbar#topbar #fo-wclock{padding-left:10px;gap:2.5px}#topbar#topbar #fo-wclock b{font-size:10px;letter-spacing:.14em}#topbar#topbar #fo-wclock span{font-size:10px}}",
    // THE CLOCK IS ABSOLUTE, SO NOTHING IN THE ROW KNOWS IT IS THERE.
    // The wordmark simply ran underneath it - by seventy pixels at 320, and
    // touching at 390. The old pill hid that because it was opaque and painted
    // over the top; a hairline hides nothing, so a collision that was always
    // there becomes visible the moment the fill goes.
    //
    // Reserving space with padding does not work twice over: the header's own
    // padding is !important elsewhere, and the wordmark is nowrap, so its
    // min-content width will not shrink for a narrower content box - it just
    // overflows. The honest fix is to give the header less to say. Under 430
    // the wordmark steps down; under 372 there is genuinely no room for both,
    // and the mark alone carries the identity - as it already does on every
    // app icon. The wordmark returns the moment the screen can hold it.
    "@media(max-width:430px){#topbar#topbar .brand{font-size:15px !important;letter-spacing:0 !important}}",
    "@media(max-width:404px){#topbar#topbar .brand{font-size:13.5px !important}}",
    "@media(max-width:372px){#topbar#topbar .brand{font-size:0 !important}#topbar#topbar .brand .fo-brandicon{margin-right:0}}",
    "html body #fo-eng-live{position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:1200;display:inline-flex;align-items:center;gap:8px;background:#B23230;color:#FFFEFC !important;font:800 11px/1 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;border-radius:999px;padding:12px 18px;text-decoration:none;box-shadow:0 14px 34px rgba(178,50,48,.45)}",
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
  // Changing page is exactly when the header's decorators run, so re-assert
  // the clock right after them rather than waiting up to half a minute for
  // the next interval. Twice, because they do not all run on the same tick.
  window.addEventListener("hashchange", function () {
    setTimeout(mountBanner, 80);
    setTimeout(mountClock, 90); setTimeout(mountClock, 400);
  });
  setInterval(tick, 60000);

  window.foRoundTime = roundTime;
  window.foRoundTimeTxt = roundTimeTxt;
  window.__foEngClock = { ensureAnchor: ensureAnchor, tick: tick, liveNow: liveNow };
})();
