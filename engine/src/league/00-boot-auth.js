/* ============================================================================
   Fifty Overs :: LEAGUE sync. Your game IS the multiplayer game. This module is
   a thin login gate + sync layer, not a parallel UI: after you log in it hands
   the screen to the real game and keeps it in step with the server. The shared
   league lives as one game snapshot() per league; each manager drafts in the
   game's own founder screen and pushes their club, sets orders in the game's own
   Orders screen (pushed as a packet), and the background resolver replays the
   packets through the engine and publishes the next snapshot. The game's own
   table, fixtures and match screens do the rest. Deterministic engine untouched.
   ========================================================================== */
(function () {
  "use strict";
  var URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var BUILD_HASH = "e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff";
  // The real Fifty Overs app icon you designed (downscaled + embedded).
  var APPICON = "data:image/webp;base64,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";
  var FAVICON = "data:image/png;base64,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";

  var JWT = "", LG = null, SYNC = null;
  // post-render hook registry: core renderMatch calls foAfterMatchRender at
  // the end of every render; league features register here (one closure)
  var foMatchRenderHooks = [];
  window.foAfterMatchRender = function () {
    for (var i = 0; i < foMatchRenderHooks.length; i++) { try { foMatchRenderHooks[i](); } catch (e) {} }
  };
  // Art lives in client/art/. From index.html at the repo root that's "client/art/";
  // from client/game.html the page itself sits inside client/, so it's just "art/".
  var FO_ART = (location.pathname.indexOf("/client/") !== -1) ? "art/" : (location.pathname.indexOf("/next/") !== -1 ? "../client/art/" : "client/art/");
  // the game's own nationality list; each manager picks one as their home country
  var NAT = ["Australia", "India", "Pakistan", "Sri Lanka", "New Zealand", "South Africa", "England", "Netherlands", "West Indies", "Afghanistan", "Ireland", "Zimbabwe"];

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  // Branded toast notifications instead of native alert() popups. Errors show
  // terracotta with a warning icon; everything else neutral navy with a check.
  var _toastHost = null;
  function toast(msg, kind) {
    try {
      if (!_toastHost || !_toastHost.isConnected) { _toastHost = document.createElement("div"); _toastHost.id = "fo-toasts"; document.body.appendChild(_toastHost); }
      var t = document.createElement("div");
      t.className = "fo-toast fo-toast-" + (kind || "info");
      t.innerHTML = "<span class='fo-toast-ic'>" + FO_I(kind === "error" ? "warn" : "checkCircle", 16) + "</span><span class='fo-toast-tx'>" + E(msg) + "</span>";
      _toastHost.appendChild(t);
      t.addEventListener("click", function () { t.remove(); });
      requestAnimationFrame(function () { t.classList.add("on"); });
      var ttl = Math.min(6500, 3000 + msg.length * 28);   // longer messages linger (capped - stacked toasts were burying the UI on phones)
      setTimeout(function () { t.classList.remove("on"); setTimeout(function () { t.remove(); }, 350); }, ttl);
      while (_toastHost.children.length > 2) _toastHost.firstChild.remove();
    } catch (e) { try { window.alert(msg); } catch (e2) {} }
  }
  function say(m) {
    var isErr = !!(m && (m instanceof Error || m.message));
    toast((m && m.message || m).toString().slice(0, 320), isErr ? "error" : "info");
  }
  // Busy state for the auth CTAs while a request is in flight.
  function busyBtn(act, label) { var b = wrap.querySelector('[data-act="' + act + '"]'); if (b && !b.disabled) { b.setAttribute("data-t", b.textContent); b.textContent = label; b.disabled = true; } }
  function unbusyBtn(act) { var b = wrap.querySelector('[data-act="' + act + '"]'); if (b) { b.textContent = b.getAttribute("data-t") || b.textContent; b.disabled = false; } }
  // Branded confirmation modal replacing native confirm(). Destructive actions get
  // deliberate friction: danger styling, explicit verb on the button, and the SAFE
  // choice holds focus so Enter/Escape can never destroy anything by accident.
  function foConfirm(opts) {
    return new Promise(function (res) {
      var old = document.getElementById("fo-modal"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-modal";
      d.innerHTML = "<div class='fo-mo-back'><div class='fo-mo-card" + (opts.danger ? " fo-mo-dngr" : "") + "'>" +
        "<div class='fo-mo-ic'>" + FO_I(opts.danger ? "warn" : "info", 22) + "</div>" +
        "<h3>" + E(opts.title || "Are you sure?") + "</h3>" +
        (opts.body ? "<p>" + E(opts.body) + "</p>" : "") +
        "<div class='fo-mo-act'><button class='fo-mo-cancel'>" + E(opts.cancel || "Cancel") + "</button>" +
        "<button class='fo-mo-ok'>" + E(opts.confirm || "Confirm") + "</button></div></div></div>";
      document.body.appendChild(d);
      var done = function (v) { try { document.removeEventListener("keydown", onKey); } catch (e) {} d.classList.remove("on"); setTimeout(function () { d.remove(); }, 180); res(v); };
      var onKey = function (e) { if (e.key === "Escape") done(false); };
      document.addEventListener("keydown", onKey);
      d.querySelector(".fo-mo-cancel").addEventListener("click", function () { done(false); });
      d.querySelector(".fo-mo-ok").addEventListener("click", function () { done(true); });
      d.querySelector(".fo-mo-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-mo-back")) done(false); });
      requestAnimationFrame(function () { d.classList.add("on"); try { d.querySelector(".fo-mo-cancel").focus(); } catch (e) {} });
    });
  }
  function headers() { return { apikey: ANON, Authorization: "Bearer " + (JWT || ANON), "content-type": "application/json", "Accept-Profile": "app", "Content-Profile": "app" }; }
  function rpc(fn, args) { return fetch(URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: headers(), body: JSON.stringify(args || {}) }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t || ("HTTP " + r.status)); return t ? JSON.parse(t) : null; }); }); }
  function sel(table, q) { return fetch(URL + "/rest/v1/" + table + "?" + (q || ""), { headers: headers() }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t); return JSON.parse(t); }); }); }
  // small localStorage wrapper (private mode / disabled storage safe)
  var PEND = "fol_pending_invite";
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { } }

  // ---- stay logged in across refreshes: persist + restore the Supabase session ----
  var SESS = "fol_session";
  function saveSession(d) {
    if (!d || !d.access_token) return;
    var exp = d.expires_at ? d.expires_at * 1000 : (Date.now() + ((d.expires_in || 3600) * 1000));
    lsSet(SESS, JSON.stringify({ access_token: d.access_token, refresh_token: d.refresh_token || "", expires_at: exp }));
  }
  function clearSession() { lsDel(SESS); }
  // Where Supabase should send the user after they confirm their email / reset a
  // password. Must be added to the project's Auth "Redirect URLs" allow-list.
  var APP_URL = location.origin + location.pathname;
  // When the user returns from an email confirmation / recovery link, Supabase
  // appends the session (or an error) to the URL fragment. Consume it so we log in
  // instead of showing a blank routed page.
  function foConsumeAuthHash() {
    try {
      // The engine's boot rewrites location.hash to #/welcome before this overlay
      // runs, wiping the Supabase fragment · so also read the ORIGINAL navigation
      // URL (captured at page load) to recover the token / error.
      var cands = [];
      if (location.hash) cands.push(location.hash);
      try { var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0]; if (nav && nav.name) cands.push(nav.name); } catch (e) {}
      if (document.URL) cands.push(document.URL);
      var sawError = false;
      for (var ci = 0; ci < cands.length; ci++) {
        var u = cands[ci], hi = u.indexOf("#"); if (hi < 0) continue;
        var raw = u.slice(hi + 1).replace(/^\/?/, "");
        if (/(^|&)access_token=/.test(raw)) {
          var q = {}; raw.split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); });
          if (q.access_token) {
            JWT = q.access_token;
            var d = { access_token: q.access_token, refresh_token: q.refresh_token || "" };
            if (q.expires_at) d.expires_at = +q.expires_at; else d.expires_in = q.expires_in ? +q.expires_in : 3600;
            saveSession(d);
            try { history.replaceState(null, "", location.pathname + location.search + "#/club"); } catch (e) {}
            return "ok";
          }
        }
        if (/(^|&)error/.test(raw)) sawError = true;
      }
      if (sawError) { try { history.replaceState(null, "", location.pathname + location.search + "#/club"); } catch (e) {} return "error"; }
    } catch (e) {}
    return "";
  }
  function restoreSession() {
    var raw = lsGet(SESS); if (!raw) return Promise.resolve(false);
    var s; try { s = JSON.parse(raw); } catch (e) { clearSession(); return Promise.resolve(false); }
    if (!s || !s.access_token) { clearSession(); return Promise.resolve(false); }
    if (s.expires_at && (s.expires_at - Date.now() > 60000)) { JWT = s.access_token; return Promise.resolve(true); }
    if (!s.refresh_token) { clearSession(); return Promise.resolve(false); }
    return fetch(URL + "/auth/v1/token?grant_type=refresh_token", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok || !d.access_token) throw new Error("refresh failed"); return d; }); })
      .then(function (d) { JWT = d.access_token; saveSession(d); return true; })
      .catch(function () { clearSession(); return false; });
  }

  // ---- cross-device cloud saves (needs the 0022 migration; fails silently
  // until it is run). The whole game state already lives in fo_*/fol_*
  // localStorage keys (career save, circuit progress, journey flags), so the
  // cloud copy is simply that key set, one row per account. Pushes ride the
  // engine's own autosaves (debounced); the pull runs once per sign-in and
  // ASKS before replacing this device's progress - it never clobbers quietly. ----
  var CLOUD_TS = "fo_cloud_ts";                 // updated_at of the copy this device last wrote/loaded
  var FO_CLOUD_SKIP = { fol_session: 1, fo_cloud_ts: 1, fo_bldseen: 1 };   // device-local, never synced
  function foCloudKeys() {
    var out = {};
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        var k = window.localStorage.key(i);
        if (!k || (k.indexOf("fo_") !== 0 && k.indexOf("fol_") !== 0)) continue;
        if (FO_CLOUD_SKIP[k] || k.indexOf("fol_clubmeta_") === 0) continue;
        out[k] = window.localStorage.getItem(k);
      }
    } catch (e) {}
    return out;
  }
  function foCloudHash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return String(h >>> 0); }
  var foCloudBusy = false, foCloudSent = "", foCloudTimer = null;
  function foCloudPush(force) {
    try {
      if (!JWT || foCloudBusy) return;
      var body = JSON.stringify([{ data: { ls: foCloudKeys() } }]);
      var h = foCloudHash(body);
      if (!force && h === foCloudSent) return;    // nothing changed since the last push
      foCloudBusy = true;
      var hh = headers(); hh.Prefer = "resolution=merge-duplicates,return=representation";
      fetch(URL + "/rest/v1/player_saves?on_conflict=user_id", { method: "POST", headers: hh, body: body })
        .then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t); return t ? JSON.parse(t) : null; }); })
        .then(function (rows) {
          foCloudSent = h;
          try { if (rows && rows[0] && rows[0].updated_at) lsSet(CLOUD_TS, rows[0].updated_at); } catch (e) {}
          foCloudBusy = false;
        }, function () { foCloudBusy = false; });
    } catch (e) { foCloudBusy = false; }
  }
  function foCloudQueue() {
    if (!JWT) return;
    if (foCloudTimer) clearTimeout(foCloudTimer);
    foCloudTimer = setTimeout(function () { foCloudTimer = null; foCloudPush(false); }, 12000);
  }
  function foCloudLoad(row) {
    try {
      var ls = row && row.data && row.data.ls; if (!ls) return;
      // stale local fo_* keys from another save would blend into the loaded
      // one - clear anything the cloud copy does not carry (session survives)
      var kill = [];
      try {
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (!k || (k.indexOf("fo_") !== 0 && k.indexOf("fol_") !== 0)) continue;
          if (FO_CLOUD_SKIP[k]) continue;
          if (!(k in ls)) kill.push(k);
        }
      } catch (e) {}
      kill.forEach(function (k) { lsDel(k); });
      for (var k2 in ls) lsSet(k2, ls[k2]);
      lsSet(CLOUD_TS, row.updated_at || "");
      location.reload();
    } catch (e) { say(e); }
  }
  function foCloudBoot() {
    try {
      if (!JWT || foCloudBoot.__ran) return; foCloudBoot.__ran = 1;
      sel("player_saves", "select=data,updated_at&limit=1").then(function (rows) {
        var row = rows && rows[0];
        if (!row || !row.data || !row.data.ls) { foCloudPush(true); return; }   // first device: seed the cloud
        if (lsGet(CLOUD_TS) === row.updated_at) return;                          // already carrying this copy
        var when = ""; try { when = new Date(row.updated_at).toLocaleString(); } catch (e) {}
        foConfirm({
          title: "Load your save from another device?",
          body: "This account has cloud progress saved " + (when ? "on " + when + " " : "") + "from another device. Load it here to continue that career? (Keep playing here instead and this device's progress becomes the cloud copy.)",
          confirm: "Load cloud save", cancel: "Keep this device"
        }).then(function (ok) {
          if (ok) foCloudLoad(row);
          else { lsSet(CLOUD_TS, row.updated_at || ""); foCloudPush(true); }
        });
      }).catch(function () {});
      // pushes ride the engine's autosave, plus a safety net on tab-hide
      setTimeout(function () {
        try {
          if (typeof window.saveGame === "function" && !window.saveGame.__foCloud) {
            var _sv = window.saveGame;
            window.saveGame = function () { var r = _sv.apply(this, arguments); try { foCloudQueue(); } catch (e) {} return r; };
            window.saveGame.__foCloud = 1;
          }
        } catch (e) {}
      }, 0);
      document.addEventListener("visibilitychange", function () { try { if (document.visibilityState === "hidden") foCloudPush(false); } catch (e) {} });
      setInterval(function () { foCloudPush(false); }, 240000);
    } catch (e) {}
  }
  try { window.__foCloud = { keys: foCloudKeys, push: foCloudPush, load: foCloudLoad, boot: foCloudBoot }; } catch (eCw) {}

  // ---- styles + shell ----
  // (login skin is static now: engine/src/skin/10-login.css -> <style id="fo-skin-login">)

  // ---- Fifty Overs identity: navy + terracotta, teal accents (login) ----
  // (modal skin is static now: engine/src/skin/20-modal.css -> <style id="fo-skin-modal">)

  // ---- restyle the GAME itself: brand colours (navy/terracotta/teal) on the
  //      light background, and proper mobile layout. Injected after the game's
  //      own <style>, so it wins without touching the pinned engine file. ----
  // (the brand sheet is static now: engine/src/skin/30-brand.css -> <style id="fo-brand">,
  //  placed at the end of <body> so it stays the last stylesheet)
  // The game injects its own theme stylesheets into <body> at render time, after
  // ours. Keep our brand sheet the LAST stylesheet so it always wins.
  // Modern type: Inter (with the platform's own UI face as fallback) across
  // the whole app. Loaded once; GitHub Pages allows the font CDN.
  try {
    if (!document.getElementById("fo-font")) {
      var fl = document.createElement("link");
      fl.id = "fo-font"; fl.rel = "stylesheet";
      fl.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Oswald:wght@400;500;600;700&family=Spline+Sans:wght@400;500;600&family=Archivo:wght@700;800&display=swap";
      document.head.appendChild(fl);
    }
  } catch (e) {}
  function bumpBrand() { try { var b3 = document.getElementById("fo-brand"); if (b3 && (b3.parentNode !== document.body || document.body.lastChild !== b3)) document.body.appendChild(b3); } catch (e) {} }
  // Add a "Clubs" nav link -> the game's players browser (pick any club, bot or
  // human, and see its roster). The game ships the page but never links to it.
  // The game runs in days, not weeks: the engine's "Week N" chip goes.
  function foHideWeekChip() {
    try {
      document.querySelectorAll("#fo-top-status span").forEach(function (s) {
        if (/^\s*(Week\s+\d+|Bank\b|Next:)/.test(s.textContent || "")) s.style.display = "none";
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foHideWeekChip, 80); setTimeout(foHideWeekChip, 400); });
  // The engine rewrites #fo-top-status (Week/Bank/Next chips) on its own
  // schedule, resurrecting the chips we hide. Wrap its renderer and watch the
  // topbar so the hide always lands last.
  try {
    if (typeof window.updateTopbarStatus === "function" && !window.updateTopbarStatus.__fo) {
      var _foUts = window.updateTopbarStatus;
      window.updateTopbarStatus = function () { var r = _foUts.apply(this, arguments); foHideWeekChip(); return r; };
      window.updateTopbarStatus.__fo = 1;
    }
  } catch (e) {}
  // the mobile drawer: rebuilt from the live nav on every open, so it always
  // mirrors exactly what the pill row would have shown (state, Live pill, Admin)
  function foMnavClose() {
    try {
      var d = document.getElementById("fo-mdrawer");
      if (d) d.classList.remove("open");
      document.body.classList.remove("fo-mnav-lock");
    } catch (e) {}
  }
  function foMnavToggle() {
    try {
      var d = document.getElementById("fo-mdrawer");
      if (d && d.classList.contains("open")) { foMnavClose(); return; }
      if (!d) {
        d = document.createElement("div"); d.id = "fo-mdrawer";
        document.body.appendChild(d);
        window.addEventListener("hashchange", foMnavClose);
        window.addEventListener("keydown", function (ev) { if (ev.key === "Escape") foMnavClose(); });
      }
      d.innerHTML = "<div class='fo-mdk'></div><div class='fo-mdp'><div class='fo-mdh'><img src='" + APPICON + "' alt=''> Fifty Overs" +
        "<button class='fo-mdx' aria-label='Close menu'>&#10005;</button></div><nav class='fo-mdn'></nav><div class='fo-mdf'></div></div>";
      d.querySelector(".fo-mdk").addEventListener("click", foMnavClose);
      d.querySelector(".fo-mdx").addEventListener("click", foMnavClose);
      var nav = d.querySelector(".fo-mdn"), foot = d.querySelector(".fo-mdf");
      var tb = document.getElementById("topbar");
      [].slice.call(tb ? tb.querySelectorAll(".fo-nav-scroll a") : []).forEach(function (a) {
        // skip links the topbar itself hides (engine's retired pages)
        var nv = a.getAttribute("data-nav");
        if (nv === "reports" || nv === "manual" || nv === "orders") return;
        if (a.style && a.style.display === "none") return;
        if (!/\S/.test(a.textContent || "")) return;
        var row = document.createElement("a");
        row.className = "fo-mdl" + (a.classList.contains("on") ? " on" : "");
        row.href = a.getAttribute("href") || "#";
        row.textContent = (a.textContent || "").trim();
        row.addEventListener("click", function (ev) { ev.preventDefault(); foMnavClose(); a.click(); });
        // Log out anchors to the bottom, past a divider, away from the nav
        (a.classList.contains("fo-logout") ? foot : nav).appendChild(row);
      });
      d.classList.add("open");
      document.body.classList.add("fo-mnav-lock");
    } catch (e) {}
  }
  // phones: the topbar's Next chip gives way to a red Live button whenever
  // something is actually on air (own live match, or the broadcast hour)
  function foMliveTick() {
    try {
      var ml = document.getElementById("fo-mlive"); if (!ml) return;
      var go = null;
      try { if (typeof M !== "undefined" && M && !M.done) go = "#/match"; } catch (e0) {}
      if (!go) { try { var em = (typeof foEmbargo === "function") ? foEmbargo() : null; if (em && em.active && !em.pre) go = "#/matchday"; } catch (e1) {} }
      if (!go) {
        // a friendly or practice broadcast of MY club counts as on air too
        try {
          var myNm = null; try { myNm = (foMyClub() || userTeam()).name; } catch (eN) {}
          ((window.__foFrAll) || []).forEach(function (c2) {
            if (go || !c2 || (c2.status !== "accepted" && c2.status !== "played")) return;
            if (myNm && c2.challenger_club !== myNm && c2.opponent_club !== myNm) return;
            try { if (foFrBcastState(c2).phase === "live") go = "#/friendly?id=" + c2.id; } catch (eS) {}
          });
        } catch (e2) {}
      }
      if (go) { ml.setAttribute("data-go", go); ml.classList.add("on"); } else ml.classList.remove("on");
    } catch (e) {}
  }
  try { setInterval(foMliveTick, 20000); } catch (e) {}
  window.addEventListener("hashchange", function () { setTimeout(foMliveTick, 150); });
  function ensureNav() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      // scoped reactive hide: a topbar timer keeps re-adding the week/bank
      // chips, so this tiny observer (topbar-only) hides them instantly;
      // the page-wide decorator observer stays retired
      if (!tb.__foChipObs && window.MutationObserver) {
        tb.__foChipObs = 1;
        new MutationObserver(function () { foHideWeekChip(); }).observe(tb, { childList: true, subtree: true });
      }
      // put the app icon in the brand, on every page, and make it open the league menu
      var brand = tb.querySelector(".brand");
      if (brand && !brand.querySelector(".fo-brandicon")) {
        brand.innerHTML = '<img class="fo-brandicon" src="' + APPICON + '" alt=""> Fifty Overs';
        brand.style.cursor = "pointer"; brand.title = "Club home";
        // the app icon is a Home button
        brand.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/club"; if (typeof window.route === "function") window.route(); });
      }
      var mk = function (label, cls, fn) { var el = document.createElement("a"); el.className = cls; el.href = "#"; el.textContent = label; el.addEventListener("click", function (e) { e.preventDefault(); fn(); }); return el; };
      var status = tb.querySelector("#fo-top-status");
      foHideWeekChip();
      // Group every nav link in one container: display:contents on desktop
      // (layout untouched), a horizontally scrolling pill bar on phones.
      var wrap = tb.querySelector(".fo-nav-scroll");
      if (!wrap) {
        wrap = document.createElement("div"); wrap.className = "fo-nav-scroll";
        var bA = tb.querySelector(".brand");
        tb.insertBefore(wrap, bA ? bA.nextSibling : tb.firstChild);
      }
      [].slice.call(tb.children).forEach(function (el) {
        // the mobile Live pill stays in the header row, out of the hidden nav wrap
        if (el.tagName === "A" && el.id !== "fo-mlive" && !/\bbrand\b/.test(el.className || "")) wrap.appendChild(el);
      });
      // phones: the pill row is hidden and a hamburger opens a drawer that
      // proxies every nav link (originals keep their handlers and state)
      var mbtn = tb.querySelector("#fo-mnav-btn");
      if (!mbtn) {
        mbtn = document.createElement("button"); mbtn.id = "fo-mnav-btn"; mbtn.setAttribute("aria-label", "Menu");
        mbtn.innerHTML = "<svg width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.4' stroke-linecap='round'><path d='M4 7h16M4 12h16M4 17h16'/></svg>";
        tb.insertBefore(mbtn, tb.firstChild);
        mbtn.addEventListener("click", foMnavToggle);
      }
      var ml = tb.querySelector("#fo-mlive");
      if (!ml) {
        ml = document.createElement("a"); ml.id = "fo-mlive"; ml.href = "#";
        ml.innerHTML = "<span class='live-dot'></span>Live";
        tb.insertBefore(ml, tb.querySelector("#fo-top-status"));
        ml.addEventListener("click", function (e) {
          e.preventDefault();
          var go = ml.getAttribute("data-go");
          if (go) { location.hash = go; if (typeof window.route === "function") window.route(); }
        });
      }
      foMliveTick();
      var addNav = function (cls, label, fn) {
        var a = tb.querySelector("a." + cls); if (!a) a = mk(label, cls, fn);
        if (a.parentNode !== wrap) { if (cls === "fo-live") wrap.insertBefore(a, wrap.firstChild); else wrap.appendChild(a); }
      };
      // Circuit-only era: Training and Transfers pills are retired until
      // those systems return in their redesigned form
      ["fo-training", "fo-transfers"].forEach(function (c) { var st0 = tb.querySelector("a." + c); if (st0) st0.remove(); });
      // Live Match appears only while a match is actually in progress
      var liveOn = false; try { liveOn = (typeof M !== "undefined") && M && !M.done; } catch (e) {}
      var lv = tb.querySelector("a.fo-live");
      if (liveOn) { if (!lv) addNav("fo-live", "\u25CF Live Match", function () { location.hash = "#/match"; if (typeof window.route === "function") window.route(); }); }
      else if (lv) lv.remove();
      // retired pills (still routable: Matches panel, Live pill, home quick links)
      ["fo-friendly", "fo-matchday"].forEach(function (c) { var st = tb.querySelector("a." + c); if (st) st.remove(); });
      addNav("fo-guide", "Manual", function () { location.hash = "#/guide"; if (typeof window.route === "function") window.route(); });
      try { foBellWire(tb, wrap); } catch (eB) {}
      // Circuit-only era: no Admin (league founders). Log out lives on -
      // it walks back out to the front door.
      var adm0 = tb.querySelector("a.fo-league"); if (adm0) adm0.remove();
      var out0 = tb.querySelector("a.fo-logout");
      if (!out0) out0 = mk("Log out", "fo-logout", function () { if (typeof window.foDoorOpen === "function") window.foDoorOpen(); });
      if (out0.parentNode !== wrap) wrap.appendChild(out0);
      // date + time (in the topbar flow, to the right of the status)
      var ck = tb.querySelector("#fo-clock");
      if (!ck) { ck = document.createElement("span"); ck.id = "fo-clock"; tickClock(); }
      tb.appendChild(ck);
      // active-pill marking for overlay-added links (engine handles its own via data-nav)
      try {
        var route0 = (location.hash || "#/club").split("?")[0];
        var navMap = { "fo-guide": "#/guide", "fo-live": "#/match", "fo-circuit": "#/circuit" };
        wrap.querySelectorAll("a").forEach(function (a) {
          for (var c in navMap) if (a.classList.contains(c)) a.classList.toggle("on", route0 === navMap[c]);
        });
        if (window.innerWidth <= 820) {
          var onA = wrap.querySelector("a.on");
          if (onA && onA.scrollIntoView) onA.scrollIntoView({ inline: "center", block: "nearest" });
        }
      } catch (e) {}
    } catch (e) {}
  }
  // ---- league metadata: which clubs are human, who manages them, when they
  // joined, and whether that manager is online (needs 0018 for presence) ----
  window.__foClubMeta = null;
  function foClubMetaFetch() {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      var done = function (clubs, members) {
        var byMid = {};
        (members || []).forEach(function (m2) { byMid[m2.id] = m2; });
        var map = {};
        (clubs || []).forEach(function (r) {
          var nm = r.club && r.club.name; if (!nm) return;
          var mem = byMid[r.manager_id] || {};
          map[nm] = { human: true, manager: mem.display_name || "manager", mid: r.manager_id, est: r.updated_at || null, lastSeen: mem.last_seen || null };
        });
        window.__foClubMeta = map;
        try { lsSet("fol_clubmeta_" + LG.id, JSON.stringify(map)); } catch (eC) {}
        // pages painted before the fetch landed guessed "bot" - repaint
        try { var pg0 = document.getElementById("page"); if (pg0) pg0.__scoutSig = null; foRenderScout(); } catch (eR) {}
      };
      sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id,updated_at").then(function (clubs) {
        sel("members", "league_id=eq." + LG.id + "&select=id,display_name,last_seen").then(function (mem) { done(clubs, mem); })
          .catch(function () {
            sel("members", "league_id=eq." + LG.id + "&select=id,display_name").then(function (mem) { done(clubs, mem); }).catch(function () { done(clubs, []); });
          });
      }).catch(function () {});
    } catch (e) {}
  }
  // the last fetched roster survives a refresh, so human clubs never flash
  // as bots while the live fetch is in flight
  function foClubMetaNow() {
    if (window.__foClubMeta) return window.__foClubMeta;
    try {
      var c = JSON.parse(lsGet("fol_clubmeta_" + (LG ? LG.id : "solo")) || "null");
      if (c) window.__foClubMeta = c;
    } catch (e) {}
    return window.__foClubMeta;
  }
  function foClubHuman(nm) { var m = foClubMetaNow(); return !!(m && m[nm]); }
  function foClubManager(nm) { var m = foClubMetaNow(); return (m && m[nm] && m[nm].manager) || null; }
  function foLastSeenTxt(nm) {
    var m = foClubMetaNow(), e = m && m[nm];
    if (!e || !e.lastSeen) return null;
    var mins = Math.floor((Date.now() - new Date(e.lastSeen).getTime()) / 60000);
    if (mins < 5) return "online";
    if (mins < 60) return "last online " + mins + " min ago";
    if (mins < 36 * 60) { var h = Math.round(mins / 60); return "last online " + h + " hour" + (h === 1 ? "" : "s") + " ago"; }
    var d0 = Math.round(mins / 1440); return "last online " + d0 + " day" + (d0 === 1 ? "" : "s") + " ago";
  }
  function foClubOnline(nm) {
    var m = foClubMetaNow(), e = m && m[nm];
    if (!e || !e.lastSeen) return null;
    return (Date.now() - new Date(e.lastSeen).getTime()) < 5 * 60000;
  }
  setInterval(foClubMetaFetch, 120000);
  setTimeout(foClubMetaFetch, 2500);
  // presence heartbeat (harmless 404 until the 0018 migration is run)
  setInterval(function () { try { if (SYNC && SYNC.started && !SYNC.practice && LG) rpc("touch_presence", { p_league_id: LG.id }).catch(function () {}); } catch (e) {} }, 180000);
  setTimeout(function () { try { if (SYNC && SYNC.started && !SYNC.practice && LG) rpc("touch_presence", { p_league_id: LG.id }).catch(function () {}); } catch (e) {} }, 4000);
  // Practice Game opens a setup screen (opponent + pitch + weather); after a short
  // breather it drops you on the lineup. Nothing is randomised or auto-started.
  var foFriendlies = [];
  function startFriendly() {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) {
        // on slow connections the league snapshot may still be loading –
        // wait a beat and retry once before telling the user anything
        toast("Loading your league\u2026");
        setTimeout(function () {
          if (typeof GD !== "undefined" && GD.teams && GD.teams.length >= 2) foMatchSetup(null);
          else { toast("No clubs to play yet \u2014 log in to your league first.", "error"); if (!(LG && SYNC)) openLeagueMenu(); }
        }, 900);
        return;
      }
      foMatchSetup(null);
    } catch (e) { toast("Could not open Practice Game: " + ((e && e.message) || e), "error"); }
  }
  var FO_PITCHES = ["balanced", "flat", "green", "dry", "slow", "cracked", "twoPaced"];
  // display names only · the engine's pitch ids never change
  var FO_PITCH_NAMES = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling", slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
  function foPitchName(id) { var k = String(id == null ? "" : (id.id || id)).trim(); return FO_PITCH_NAMES[k] || foTitle(k); }
  // condition symbols for scorecard heroes: the same monoline glyphs the
  // conditions field guide uses (foCondCards), with the word in the tooltip
  var FO_PITCH_SYM = {
    Balanced: "<path d='M12 4v16m-5 0h10M7 5.5h10'/><path d='M7 5.5 4 12a3.4 3.4 0 0 0 6 0L7 5.5Zm10 0L14 12a3.4 3.4 0 0 0 6 0l-3-6.5Z'/>",
    Green: "<path d='M6 20c.5-5-.5-8-2-10M12 20c0-7-.6-10-1.5-13M18 20c-.5-5 .5-8 2-10M12 20c1.5-4 3.5-6 5.5-7'/>",
    Crumbling: "<path d='M4 19 9 12l3 3 4-7 4 6'/>",
    Flat: "<path d='M3 15h18M6 9h12'/>",
    Slow: "<path d='M3 14c2-3 4-3 6 0s4 3 6 0 4-3 6 0'/>",
    Sticky: "<path d='M4 18 9 10l3 4 5-8'/><path d='M14 6h3v3'/>",
    "Two-paced": "<path d='M4 9h11M12 6l3 3-3 3M4 16h6M8 14l2 2-2 2'/>"
  };
  var FO_WX_SYM = {
    Sunny: "<circle cx='12' cy='12' r='4'/><path d='M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19'/>",
    Overcast: "<path d='M7 18h9.5a4 4 0 1 0-.8-7.9A6 6 0 0 0 4.2 12 3.5 3.5 0 0 0 7 18z'/>",
    Misty: "<path d='M4 9h16M6 13h13M8 17h8'/>",
    Humid: "<path d='M12 4c3 4 5 6.3 5 8.8a5 5 0 0 1-10 0C7 10.3 9 8 12 4z'/>",
    Hot: "<path d='M10 4a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0V4z'/><path d='M12 9v7'/>",
    Scorching: "<path d='M12 3c1 3.5 5 5.2 5 9.5a5 5 0 0 1-10 0c0-3 2.2-4.6 3.2-7 .6 1.4 1.8 2 1.8 2Z'/>",
    Drizzle: "<path d='M7 14h9.5a4 4 0 1 0-.8-7.9A6 6 0 0 0 4.2 8 3.5 3.5 0 0 0 7 14z'/><path d='m9 17-1 2.5M13 17l-1 2.5M17 17l-1 2.5'/>",
    Windy: "<path d='M9.6 4.6A2 2 0 1 1 11 8H3M12.6 19.4A2 2 0 1 0 14 16H3M17.7 7.7A2.5 2.5 0 1 1 19.5 12H3'/>",
    Chilly: "<path d='M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9'/>",
    "Dew later": "<path d='M4 20h16'/><path d='M12 4.5c2.2 3 3.7 4.8 3.7 6.7a3.7 3.7 0 0 1-7.4 0c0-1.9 1.5-3.7 3.7-6.7z'/>"
  };
  function foCondSvg(nm, path) {
    return "<span class='fo-cond-sym' title='" + nm + "'><svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + path + "</svg></span>";
  }
  function foCondSymbols() {
    try {
      document.querySelectorAll(".fo-live-sub, .fo-cond-pill").forEach(function (el) {
        if (el.__foSym) return;
        el.__foSym = 1;
        var h = el.innerHTML, o = h;
        Object.keys(FO_PITCH_SYM).forEach(function (nm) {
          h = h.replace(new RegExp("\\b" + nm + " pitch\\b", "g"), foCondSvg(nm + " pitch", FO_PITCH_SYM[nm]));
        });
        Object.keys(FO_WX_SYM).forEach(function (nm) {
          h = h.replace(new RegExp("\\b" + nm + "\\b", "g"), foCondSvg(nm, FO_WX_SYM[nm]));
        });
        if (h !== o) el.innerHTML = h;
      });
    } catch (e) {}
  }
  function foTitle(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }
  function foMatchSetup(preIx) {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) { alert("No clubs to play yet."); return; }
      var ex = document.getElementById("fo-setup"); if (ex) ex.remove();
      var mp = !!(SYNC && SYNC.started && !SYNC.practice && LG);
      var opts = GD.teams.map(function (t, i) {
        if (i === App.teamIx) return "";
        if (mp && foClubHuman(t.name)) return "";   // humans: only by accepted challenge
        return "<option value='" + i + "'" + (i === preIx ? " selected" : "") + ">" + E(t.name) + "</option>";
      }).join("");
      var pitchOpts = FO_PITCHES.map(function (p) { return "<option value='" + p + "'>" + foPitchName(p) + "</option>"; }).join("");
      var wxOpts = (typeof WXLIST !== "undefined" ? WXLIST : ["Sunny"]).map(function (w) { return "<option>" + w + "</option>"; }).join("");
      var m = document.createElement("div"); m.id = "fo-setup"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Practice match</div><h3>Set up a friendly</h3>" +
        "<label>Opponent<select id='fo-su-opp'>" + opts + "</select></label>" +
        "<label>Pitch<select id='fo-su-pitch'>" + pitchOpts + "</select></label>" +
        "<label>Weather<select id='fo-su-wx'>" + wxOpts + "</select></label>" +
        (mp ? "<div class='small' style='margin-top:6px'>Practice games are against computer clubs. To play a friend, open their club page and send a <b>challenge</b>.</div>" : "") +
        "<div class='fo-modal-act'><button class='fo-su-go primary'>Schedule friendly ▸</button><button class='fo-su-cancel'>Cancel</button></div></div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
      m.querySelector(".fo-su-cancel").addEventListener("click", function () { m.remove(); });
      m.querySelector(".fo-su-go").addEventListener("click", function () {
        var ix = parseInt(m.querySelector("#fo-su-opp").value, 10);
        if (isNaN(ix)) { alert("Pick an opponent first."); return; }
        var slotProb = null;
        try { slotProb = foFrSlotProblem(new Date(Date.now() + 2 * 60000), [userTeam().name]); } catch (eSl) {}
        if (slotProb) { say(slotProb); return; }
        var pitch = m.querySelector("#fo-su-pitch").value, wx = m.querySelector("#fo-su-wx").value;
        m.remove();
        foBreakScreen(foAddFriendly(ix, pitch, wx));
      });
    } catch (e) { say(e); }
  }
  // scheduled practice games survive a refresh (stored per league, on-device;
  // a bot game starts the moment you press Play, so this is a reminder list)
  function foFrSchedKey() { return "fol_frsched_" + (LG ? LG.id : "solo"); }
  function foFrSchedSave() { try { lsSet(foFrSchedKey(), JSON.stringify(foFriendlies || [])); } catch (e) {} }
  function foFrSchedLoad() {
    var k = foFrSchedKey();
    if (foFrSchedLoad.__k === k) return;
    foFrSchedLoad.__k = k;
    try {
      var a = JSON.parse(lsGet(k) || "[]");
      if (a.length && !(foFriendlies || []).length) foFriendlies = a;
    } catch (e) {}
  }
  function foAddFriendly(ix, pitch, wx) {
    foFriendlies = (foFriendlies || []).filter(function (f) { return f.oppName !== GD.teams[ix].name; });   // one per opponent
    var fr = { oppIx: ix, oppName: GD.teams[ix].name, pitch: pitch, weather: wx, seed: 4200 + ix * 7 + foFriendlies.length * 13 };
    foFriendlies.push(fr);
    foFrSchedSave();
    if (SYNC) SYNC.__plannerSig = null;                     // let the upcoming list pick it up
    return fr;
  }
  // A short breather before the lineup, so a match never feels rushed.
  function foBreakScreen(fr) {
    try {
      var ex = document.getElementById("fo-break"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-break"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card fo-break-card'><div class='fo-modal-eyebrow'>Get ready</div>" +
        "<h3>vs " + E(fr.oppName) + "</h3><div class='fo-break-cond'>" + E(foTitle(fr.pitch)) + " pitch · " + E(fr.weather) + "</div>" +
        "<div class='fo-break-clock' id='fo-break-clock'>2:00</div>" +
        "<div class='small'>Take a breather · your lineup opens when the timer ends.</div>" +
        "<div class='fo-modal-act'><button class='fo-su-go primary'>Set lineup now ▸</button></div></div>";
      document.body.appendChild(m);
      var secs = 120;
      var go = function () { if (m.__t) { clearInterval(m.__t); m.__t = null; } if (m.parentNode) m.remove(); foPlayFriendly(fr); };
      m.querySelector(".fo-su-go").addEventListener("click", go);
      m.__t = setInterval(function () {
        secs--; var c = document.getElementById("fo-break-clock");
        if (c) c.textContent = Math.floor(secs / 60) + ":" + ("0" + (secs % 60)).slice(-2);
        if (secs <= 0) go();
      }, 1000);
    } catch (e) { say(e); foPlayFriendly(fr); }
  }
  function foPlayFriendly(fr) {
    // a live match is running: resume it (never silently restart)
    try {
      if (typeof M !== "undefined" && M && !M.done) {
        var sameOpp = App.pending && App.pending.__friendly && App.pending.away === fr.oppName;
        if (sameOpp) { location.hash = "#/match"; if (typeof window.route === "function") window.route(); return; }
        foConfirm({ danger: true, title: "A match is already in progress", body: "Abandon the live match and start this friendly instead?", confirm: "Abandon & start", cancel: "Keep playing" })
          .then(function (ok) { if (ok) foChallenge(fr.oppIx, fr.pitch, fr.weather); else { location.hash = "#/match"; if (typeof window.route === "function") window.route(); } });
        return;
      }
    } catch (e) {}
    try {
      var slotProb2 = foFrSlotProblem(new Date(Date.now() + 2 * 60000), [userTeam().name]);
      if (slotProb2) { say(slotProb2); return; }
    } catch (eSl2) {}
    foChallenge(fr.oppIx, fr.pitch, fr.weather);
  }
  function foPracBcKey() { return "fol_pracbc_" + (LG ? LG.id : "solo"); }
  function foPracBc() { try { return JSON.parse(lsGet(foPracBcKey()) || "null"); } catch (e) { return null; } }
  // Play the pending practice match to completion in the engine (silently,
  // with the same per-ball tracker the resolver banks for friendlies) and
  // store the broadcast locally. Returns the pseudo-challenge row, or false
  // so the caller can fall back to the old interactive viewer.
  function foPracBroadcast() {
    try {
      if (typeof stepBall !== "function" || typeof startPendingIfNeeded !== "function") return false;
      var pend = App.pending; if (!pend) return false;
      var prevPage = App.page, prevOME = window.onMatchEnd;
      // practice plays at full freshness: fatigue only matters in league play.
      // Stash the real ladder and restore it after - the sim mutates players.
      var fatStash = [];
      try {
        [pend.home, pend.away].forEach(function (nm2) {
          var t9 = (GD.teams || []).filter(function (t8) { return t8 && t8.name === nm2; })[0];
          ((t9 && t9.players) || []).forEach(function (p9) { if (p9) { fatStash.push([p9, p9.fatigue]); p9.fatigue = "rested"; } });
        });
      } catch (eFs) {}
      try {
        window.__foPracRun = 1;
        window.onMatchEnd = function () {};          // practice: no fatigue, no form, no App.results
        App.page = "__resolve__";
        try { M = null; } catch (e0) {}
        startPendingIfNeeded();
        if (App.tossState && App.tossState.stage !== "done" && typeof resolveToss === "function") resolveToss(App.orders.tossCall || "H");
        var track = [], g = 0;
        while (typeof M !== "undefined" && M && !M.done && g++ < 3000) {
          if (typeof autoPick === "function") autoPick();
          stepBall();
          try {
            var li = (M.log && M.log[0]) ? M.log[0].inn : M.inns;
            var inn2 = M.innings[li] || M.innings[M.inns];
            if (inn2) {
              var rc = function (x) { return (x && x.p) ? { n: x.p.name, r: x.r || 0, b: x.b || 0, f4: x.f4 || 0, f6: x.f6 || 0 } : null; };
              var bwr = inn2.bowlers && inn2.bowlers[inn2.curBowlerName];
              track.push({ L: M.log.length, i: li, s: rc(inn2.bat[inn2.striker]), ns: rc(inn2.bat[inn2.nonstriker]),
                bw: bwr ? { n: inn2.curBowlerName, r: bwr.r || 0, w: bwr.w || 0, b: bwr.b || 0 } : null,
                sc: [inn2.runs || 0, inn2.wkts || 0, inn2.legal || 0] });
            }
          } catch (eT) {}
        }
        if (typeof M === "undefined" || !M || !M.done || !M.result) return false;
        var ratings = ""; try { ratings = ratingsTable({ home: M.meta.home, away: M.meta.away, innings: M.innings, result: M.result }); } catch (eR) {}
        var fant = []; try { fant = window.foFantasyPoints ? foFantasyPoints(M.innings) : []; } catch (eF) {}
        var mom = (M.result && M.result.mom) || (fant[0] ? fant[0].n + " (" + fant[0].pts + " pts)" : "");
        var tossTxt = ""; try { tossTxt = (App.tossState && App.tossState.txt) || ""; } catch (eTs) {}
        var at = Date.now();
        var c = {
          id: "prac-" + at, challenger_club: M.meta.home, opponent_club: M.meta.away,
          pitch: M.meta.pitch || pend.pitch || "balanced", weather: M.meta.weather || pend.weather || "Sunny",
          play_at: new Date(at).toISOString(), status: "played", __practice: true,
          result: { result_text: (M.result && M.result.text) || "Played", mom: mom,
                    scorecard: (M.innings || []).map(foInnCard), worm: M.worm || null,
                    log: M.log || [], track: track, ratings_html: ratings, fantasy: fant, toss: tossTxt }
        };
        try { lsSet(foPracBcKey(), JSON.stringify(c)); }
        catch (eS) { try { c.result.log = []; c.result.track = []; lsSet(foPracBcKey(), JSON.stringify(c)); } catch (eS2) {} }
        try { foSaveFrHist({ innings: M.innings, meta: M.meta, worm: M.worm, result: M.result, __at: at }); } catch (eH) {}
        return c;
      } finally {
        App.page = prevPage; window.onMatchEnd = prevOME; window.__foPracRun = 0;
        try { fatStash.forEach(function (x9) { x9[0].fatigue = x9[1]; }); } catch (eFr) {}
        try { M = null; } catch (e1) {}
        App.pending = null;
        try { App.tossState = null; } catch (e2) {}
      }
    } catch (e) { return false; }
  }
  function foRemoveFriendly(i) {
    var fr = foFriendlies[i]; if (!fr) return;
    try {
      if (typeof M !== "undefined" && M && !M.done && App.pending && App.pending.__friendly && App.pending.away === fr.oppName) {
        say("That friendly is being played right now · finish or abandon the match first."); return;
      }
    } catch (e) {}
    foConfirm({ title: "Remove the friendly vs " + fr.oppName + "?", body: "You can schedule another from their club page any time.", confirm: "Remove", cancel: "Keep it" })
      .then(function (ok) { if (!ok) return; foFriendlies.splice(i, 1); foFrSchedSave(); if (typeof window.route === "function") window.route(); });
  }

