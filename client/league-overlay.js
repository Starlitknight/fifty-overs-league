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
  // the game's own nationality list; each manager picks one as their home country
  var NAT = ["Australia", "India", "Pakistan", "Sri Lanka", "New Zealand", "South Africa", "England", "Netherlands", "West Indies", "Afghanistan", "Ireland", "Zimbabwe"];

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(m) { window.alert((m && m.message || m).toString().slice(0, 400)); }
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

  // ---- styles + shell ----
  var css = document.createElement("style");
  css.textContent =
    "#folBtn{position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#C8674A;color:#F6F4EE;border:none;border-radius:22px;padding:10px 16px;font:600 14px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer}" +
    "#folWrap{position:fixed;inset:0;z-index:2147483001;background:rgba(8,16,29,.72);display:none}" +
    "#folWrap.on{display:block}" +
    "#folPanel{position:absolute;inset:0;margin:auto;max-width:780px;background:#0B1322;color:#F6F4EE;overflow:auto;font:14px/1.45 -apple-system,'Segoe UI',Roboto,Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}" +
    "@media(min-width:820px){#folPanel{inset:20px;border-radius:12px}}" +
    "#folPanel a{color:#4DA6A2 !important}" +
    ".folhd{position:sticky;top:0;background:#1C2433;border-bottom:1px solid rgba(246,244,238,.12);padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".folhd h3{margin:0;font-size:15px;flex:1;display:flex;align-items:center;gap:8px}" +
    ".fol-hdicon{width:24px;height:24px;border-radius:7px;display:inline-block;flex:0 0 auto}" +
    ".folbody{padding:12px 14px;display:grid;gap:12px}" +
    ".folcard{background:#1C2433;border:1px solid rgba(246,244,238,.12);border-radius:10px}" +
    ".folcard h4{margin:0;padding:8px 12px;border-bottom:1px solid rgba(246,244,238,.12);font-size:13px;display:flex;justify-content:space-between}" +
    ".folpad{padding:10px 12px}" +
    ".foltabs{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px}" +
    ".foltab{padding:6px 12px;border:1px solid rgba(246,244,238,.12);border-radius:8px;cursor:pointer;font-size:13px}" +
    ".foltab.on{background:#C8674A;color:#F6F4EE;border-color:#C8674A}" +
    "#folPanel table{width:100%;border-collapse:collapse}#folPanel th,#folPanel td{padding:5px 8px;border-bottom:1px solid rgba(246,244,238,.1);text-align:left}" +
    "#folPanel .n{text-align:right;font-variant-numeric:tabular-nums}" +
    "#folPanel input,#folPanel select,#folPanel button{font:inherit;padding:6px 9px;border:1px solid rgba(246,244,238,.12);border-radius:8px;background:rgba(246,244,238,.06);color:#F6F4EE}" +
    "#folPanel button{cursor:pointer}#folPanel button.p{background:#C8674A;color:#F6F4EE;border-color:#C8674A}#folPanel button.mini{padding:2px 8px;font-size:12px}" +
    ".folrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.folsmall{font-size:12px;opacity:.7}" +
    ".folbadge{font-size:11px;padding:1px 6px;border-radius:10px;border:1px solid rgba(246,244,238,.12)}.folbadge.ok{color:#4DA6A2;border-color:rgba(77,166,162,.5)}.folbadge.warn{color:#e08b7f;border-color:#8a4a3a}" +
    "#folPin{background:#a33328;color:#fff;padding:8px 14px;display:none}" +
    ".fclub-p{padding:9px 2px;border-bottom:1px solid rgba(246,244,238,.1)}.fclub-p:last-child{border-bottom:none}" +
    ".fclub-nm{font-weight:700;color:#F6F4EE;font-size:14px}.fclub-nat{font-weight:500;color:#4DA6A2;font-size:11px;margin-left:7px;letter-spacing:.5px}" +
    ".fclub-l1{color:#F6F4EE;font-size:12.5px;margin-top:3px}.fclub-l2,.fclub-l3{color:rgba(246,244,238,.7);font-size:12px;margin-top:2px;line-height:1.4}";
  document.head.appendChild(css);

  // ---- Fifty Overs identity: navy + terracotta, teal accents (login) ----
  var css2 = document.createElement("style");
  css2.textContent =
    "#folWrap{background:#0B1322 !important}" +
    "#folPanel.fol-navy{background:radial-gradient(circle at top,rgba(77,166,162,.14),transparent 38%),linear-gradient(180deg,#0B1322 0%,#08101D 100%);display:flex;align-items:center;justify-content:center;padding:28px 20px}" +
    "#folPanel.fol-navy .folhd{display:none}" +
    ".fol-card{width:100%;max-width:420px;background:#1C2433;border:1px solid rgba(246,244,238,.12);border-radius:24px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6),0 1px 0 rgba(246,244,238,.03) inset;padding:34px 28px 26px}" +
    ".fol-logo{display:block;width:96px;height:96px;border-radius:22px;margin:0 auto 20px;box-shadow:0 10px 26px -8px rgba(0,0,0,.6)}" +
    ".fol-card h1{margin:0;text-align:center;font-size:24px;font-weight:800;letter-spacing:4px;color:#F6F4EE}" +
    ".fol-card .fol-sub{margin:8px 0 24px;text-align:center;font-size:13.5px;color:rgba(246,244,238,.65);letter-spacing:.3px}" +
    ".fol-form{display:flex;flex-direction:column;gap:13px}" +
    ".fol-form label{display:block;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:rgba(246,244,238,.6);margin:0 0 6px 2px}" +
    "#folPanel .fol-form input{width:100%;background:rgba(246,244,238,.06);border:1px solid rgba(246,244,238,.12);border-radius:12px;padding:13px 14px;color:#F6F4EE;font-size:16px;transition:border-color .15s,box-shadow .15s}" +
    "#folPanel .fol-form input::placeholder{color:rgba(246,244,238,.4)}" +
    "#folPanel .fol-form input:focus{outline:none;border-color:#4DA6A2;box-shadow:0 0 0 3px rgba(77,166,162,.16)}" +
    "#folPanel .fol-cta{margin-top:8px;background:#C8674A !important;color:#F6F4EE !important;border:none !important;border-radius:14px;padding:18px;font-size:17.5px;font-weight:700;letter-spacing:.5px;cursor:pointer;transition:filter .15s}" +
    "#folPanel .fol-cta:hover{filter:brightness(1.06)}" +
    ".fol-links{display:flex;flex-direction:column;align-items:center;gap:13px;margin-top:20px}" +
    "#folPanel .fol-links a{color:#F6F4EE !important;text-decoration:none;font-size:14px;font-weight:600;cursor:pointer}" +
    "#folPanel .fol-links a.fol-mut{color:rgba(246,244,238,.6) !important;font-weight:500;font-size:13px}" +
    "#folPanel .fol-links a:hover{color:#4DA6A2 !important}" +
    ".fol-foot{margin:24px 0 2px;text-align:center;font-size:10px;letter-spacing:1px;color:rgba(246,244,238,.42);text-transform:uppercase}" +
    ".fol-foot .fol-sep{color:#C8674A;margin:0 5px}";
  document.head.appendChild(css2);

  // ---- restyle the GAME itself: brand colours (navy/terracotta/teal) on the
  //      light background, and proper mobile layout. Injected after the game's
  //      own <style>, so it wins without touching the pinned engine file. ----
  var css3 = document.createElement("style");
  css3.id = "fo-brand";
  var NAVY = "#0B1322", NAVY2 = "#1C2433", TERRA = "#C8674A", TERRA2 = "#a94f38", TEAL = "#4DA6A2", PAPER = "#F6F4EE";
  css3.textContent =
    // recolour by overriding the engine's own CSS variables (they cascade everywhere)
    ":root{--blue:" + TERRA + ";--blue-dark:" + TERRA2 + ";--orange:" + TEAL + ";--nav:" + NAVY + ";" +
    "--ftp-blue:" + TERRA + ";--ftp-blue-dark:" + TERRA2 + ";--ftp-orange:" + TEAL + ";--ftp-link:#b0563b;--green:#2f8f6b}" +
    // the engine scopes its theme with `body.ftpskin ...`, so we match that scope
    "html body.ftpskin #topbar,#topbar{background:" + NAVY + " !important;border-bottom:3px solid " + TERRA + " !important}" +
    "html body.ftpskin #topbar a.on,#topbar a.on{background:" + TERRA + " !important;color:" + PAPER + " !important;box-shadow:inset 0 -3px 0 " + TEAL + " !important}" +
    "#topbar a:hover{background:#16324a !important}" +
    // keep the game's zebra striping / colours out of our own overlay tables
    "#folPanel table tr,#folPanel table tbody tr{background:transparent !important}" +
    "#folPanel td,#folPanel th{color:#F6F4EE !important;background:transparent !important;border-bottom-color:rgba(246,244,238,.12) !important}" +
    "#topbar .brand::before{display:none !important}" +
    ".fo-brandicon{width:26px;height:26px;border-radius:7px;vertical-align:-8px;margin-right:6px;box-shadow:0 0 0 1px rgba(246,244,238,.18)}" +
    "#topbar{position:relative}" +
    "#fo-clock{position:absolute;top:9px;right:12px;color:rgba(246,244,238,.9);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:.3px}" +
    "#page a,.panel a{color:#b0563b !important}" +
    // section headers -> navy
    "html body.ftpskin .panel>h4,html body.ftpskin .card-title,.panel>h4,.card-title,.panel>header,.card>h4,.sec>h4{background:" + NAVY2 + " !important;background-image:none !important;color:" + PAPER + " !important}" +
    // heroes / blue banners -> navy gradient
    "html body.ftpskin [class*=hero],html body.ftpskin [class*=club-home],[class*=hero],[class*=club-home],.page-head,.club-head{background:linear-gradient(160deg," + NAVY2 + "," + NAVY + ") !important;color:" + PAPER + " !important}" +
    // primary buttons -> terracotta
    "html body.ftpskin button.primary,html body.ftpskin .confirmbtn,button.primary,.confirmbtn,.btn-primary{background:" + TERRA + " !important;background-image:none !important;border-color:" + TERRA2 + " !important;color:" + PAPER + " !important}" +
    "button.primary:hover,.confirmbtn:hover{background:#b3573c !important}" +
    // mobile layout
    "@media(max-width:640px){" +
    "body{font-size:14px}" +
    "#page{padding:8px !important;overflow-x:hidden}" +
    // topbar WRAPS so every nav item is visible (nothing hidden off-screen)
    "html body.ftpskin #topbar,#topbar{flex-wrap:wrap !important;overflow:visible !important}" +
    "#topbar a{padding:10px 11px;font-size:13px}#topbar .brand{font-size:14px;width:100%}" +
    "#fo-top-status{width:100% !important;margin-left:0 !important}" +
    ".grid2{display:block}.grid2>.col{min-width:0 !important;width:100%}" +
    ".page-grid-2,.page-grid-3,.page-grid-draft{grid-template-columns:1fr !important}" +
    // wide tables scroll inside their panel instead of squishing to fit
    ".panel,.card{overflow-x:auto;-webkit-overflow-scrolling:touch}" +
    "#page table{font-size:12px}" +
    "button,select,input{min-height:38px;font-size:14px;max-width:100%}" +
    ".ctlrow{flex-wrap:wrap}" +
    // Orders page: the desktop layout is forced with !important; unwind it for phones
    ".fo-orders-main{grid-template-columns:1fr !important}" +
    ".fo-detgrid{grid-template-columns:1fr 1fr !important}" +
    ".fo-batrow2{display:flex !important;flex-wrap:wrap;align-items:center;gap:8px !important;grid-template-columns:none !important;padding:6px 0}" +
    ".fo-batrow2 .bno{flex:0 0 auto}" +
    ".fo-batrow2 select{flex:1 1 55%;min-width:0}" +
    ".fo-batrow2 .bskill{flex:1 1 100% !important;order:9;overflow:visible !important;white-space:normal !important}" +
    ".fo-batrow2 .bwk,.fo-batrow2 .bopt{flex:0 0 auto}" +
    ".fo-tacrow{flex-wrap:wrap}.fo-tacrow .small{min-width:0}" +
    ".fo-gridrow{flex-wrap:wrap}.fo-gridside{flex:1 1 100% !important}" +
    ".fo-gridcells{flex:1 1 100% !important;overflow-x:auto;-webkit-overflow-scrolling:touch;white-space:nowrap}" +
    ".fo-pool{overflow-x:auto}.fo-pooltabs{flex-wrap:wrap}" +
    // freeze the first column (player/date) so it stays visible while the rest scrolls
    "#page .panel table th:first-child,#page .panel table td:first-child{position:sticky;left:0;background:#fff;z-index:1;box-shadow:1px 0 0 rgba(0,0,0,.12)}" +
    "}";
  document.body.appendChild(css3);
  // The game injects its own theme stylesheets into <body> at render time, after
  // ours. Keep our brand sheet the LAST stylesheet so it always wins.
  function bumpBrand() { try { if (css3.parentNode !== document.body || document.body.lastChild !== css3) document.body.appendChild(css3); } catch (e) {} }
  // Add a "Clubs" nav link -> the game's players browser (pick any club, bot or
  // human, and see its roster). The game ships the page but never links to it.
  function ensureNav() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      // put the app icon in the brand, on every page, and make it open the league menu
      var brand = tb.querySelector(".brand");
      if (brand && !brand.querySelector(".fo-brandicon")) {
        brand.innerHTML = '<img class="fo-brandicon" src="' + APPICON + '" alt=""> Fifty Overs';
        brand.style.cursor = "pointer"; brand.title = "League menu";
        brand.addEventListener("click", openLeagueMenu);
      }
      // date + time, top-right (like FTP)
      if (!tb.querySelector("#fo-clock")) { var ck = document.createElement("span"); ck.id = "fo-clock"; tb.appendChild(ck); tickClock(); }
      if (tb.querySelector("a.fo-clubs")) return;
      var after = tb.querySelector('a[data-nav="matches"]');
      var a = document.createElement("a"); a.className = "fo-clubs"; a.href = "#"; a.textContent = "Clubs";
      a.addEventListener("click", function (e) { e.preventDefault(); renderClubs(); });
      var f = document.createElement("a"); f.className = "fo-friendly"; f.href = "#"; f.textContent = "Friendly";
      f.addEventListener("click", function (e) { e.preventDefault(); if (LG && SYNC) practice(); else openLeagueMenu(); });
      if (after && after.nextSibling) { tb.insertBefore(a, after.nextSibling); tb.insertBefore(f, a.nextSibling); }
      else { tb.appendChild(a); tb.appendChild(f); }
    } catch (e) {}
  }
  function tickClock() {
    try {
      var c = document.getElementById("fo-clock"); if (!c) return;
      var d = new Date();
      c.textContent = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (e) {}
  }
  setInterval(tickClock, 1000);
  if (typeof window.route === "function") { var _rt = window.route; window.route = function () { var r = _rt.apply(this, arguments); bumpBrand(); ensureNav(); return r; }; }
  window.addEventListener("hashchange", bumpBrand);
  ensureNav();

  // Shared "50" logo mark (stumps + paper "5" + seamed cricket-ball "0"), reused
  // by the login logo and the browser-tab favicon so they stay identical.
  var MARK =
    '<g fill="#C8674A">' +
    '<rect x="94" y="20" width="16" height="5" rx="2.5"/><rect x="114" y="20" width="16" height="5" rx="2.5"/><rect x="134" y="20" width="16" height="5" rx="2.5"/>' +
    '<rect x="97.5" y="24" width="9" height="40" rx="4.5"/><rect x="117.5" y="24" width="9" height="40" rx="4.5"/><rect x="137.5" y="24" width="9" height="40" rx="4.5"/>' +
    '</g>' +
    '<path d="M96 74 H44 V116 H78 a20 20 0 1 1 -20 20 H40" fill="none" stroke="#F6F4EE" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<g transform="translate(150,136)">' +
    '<circle r="42" fill="none" stroke="#F6F4EE" stroke-width="16"/>' +
    '<path d="M0 -34 Q10 0 0 34" fill="none" stroke="#F6F4EE" stroke-width="3"/>' +
    '<g stroke="#F6F4EE" stroke-width="2.4" stroke-linecap="round">' +
    '<path d="M-6 -24 L2 -22"/><path d="M-7 -12 L2 -11"/><path d="M-7 0 L3 0"/><path d="M-7 12 L2 11"/><path d="M-6 24 L2 22"/>' +
    '<path d="M8 -22 L14 -19"/><path d="M9 -11 L15 -9"/><path d="M9 0 L15 0"/><path d="M9 11 L15 9"/><path d="M8 22 L14 19"/>' +
    '</g></g>';

  // Brand the browser tab with the real designed app icon + apple-touch-icon.
  try {
    var favLink = document.querySelector("link[rel~='icon']") || document.createElement("link");
    favLink.rel = "icon"; favLink.type = "image/png"; favLink.href = FAVICON;
    document.head.appendChild(favLink);
    var apple = document.createElement("link"); apple.rel = "apple-touch-icon"; apple.href = APPICON;
    document.head.appendChild(apple);
    document.title = "Fifty Overs";
  } catch (e) { /* non-fatal */ }

  // The real designed app icon, for the in-app header.
  var ICON = '<img class="fol-hdicon" src="' + APPICON + '" alt="">';

  // The floating bottom-right button is gone; the app icon in the game's top bar
  // opens the league menu instead. Keep the element (hidden) so old refs are safe.
  var btn = document.createElement("button");
  btn.id = "folBtn"; btn.textContent = "🏆 League"; btn.style.display = "none";
  function openLeagueMenu() { openWrap(true); if (!JWT) renderLogin(); else if (SYNC && LG && SYNC.isFounder) showWait(!!SYNC.myTeam); else enterApp(); }

  var wrap = document.createElement("div");
  wrap.id = "folWrap";
  wrap.innerHTML =
    '<div id="folPanel">' +
    '<div class="folhd"><h3>' + ICON + 'Fifty Overs</h3><span class="folsmall" id="folWho"></span></div>' +
    '<div id="folPin"></div><div id="folMain"></div></div>';
  document.body.appendChild(wrap);
  var main = wrap.querySelector("#folMain");

  // Open/close the overlay. While it is on it covers the whole screen, so we lock
  // the page behind it: the public never touches the solo game underneath.
  function openWrap(on) {
    wrap.classList.toggle("on", !!on);
    document.documentElement.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }

  btn.addEventListener("click", openLeagueMenu);

  // ---- one delegated handler for everything ----
  wrap.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]"); if (!t) return;
    var a = t.getAttribute("data-act");
    if (a === "close") { openWrap(false); return; }
    ev.preventDefault();
    var acts = {
      login: doLogin, logout: function () { JWT = ""; LG = null; SYNC = null; clearSession(); renderLogin(); },
      showLogin: renderLogin, showJoin: renderJoin, showForgot: renderForgot,
      sendReset: sendReset, joinNew: doJoinSignup,
      openId: function () { enterGameById(t.getAttribute("data-id")); }, join: joinLeague,
      setupClub: doSetup, startLeague: startLeague, mkInvite: mkInvite,
      delTeam: function () { delTeam(t.getAttribute("data-id"), t.getAttribute("data-name")); },
      draftMine: draftMine, practice: practice,
      backToGame: function () { openWrap(false); if (typeof window.route === "function") window.route(); }
    };
    if (acts[a]) acts[a]();
  });
  function val(id) { var e = wrap.querySelector("#" + id); return e ? (e.value || "").trim() : ""; }

  function setNavy(on) { var pn = wrap.querySelector("#folPanel"); if (pn) pn.classList.toggle("fol-navy", !!on); }

  // ---- auth (Fifty Overs brand login) ----
  // The "50" mark: three terracotta stumps, a paper "5", and a seamed cricket ball for the "0".
  var LOGO = '<img class="fol-logo" src="' + APPICON + '" alt="Fifty Overs">';
  var FOOT = '<div class="fol-foot">Draft squads<span class="fol-sep">&middot;</span>Set orders<span class="fol-sep">&middot;</span>Watch every ball</div>';

  function renderLogin() {
    wrap.querySelector("#folWho").textContent = "";
    setNavy(true);
    main.innerHTML =
      '<div class="fol-card">' + LOGO +
      '<h1>FIFTY OVERS</h1>' +
      '<div class="fol-sub">Private cricket leagues.</div>' +
      '<div class="fol-form">' +
      '<div><label>Email</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<div><label>Password</label><input id="folPass" type="password" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"></div>' +
      '<button class="fol-cta" data-act="login">Log In</button>' +
      '</div>' +
      '<div class="fol-links">' +
      '<a data-act="showJoin">Join with invite code</a>' +
      '<a class="fol-mut" data-act="showForgot">Forgot password?</a>' +
      '</div>' + FOOT + '</div>';
  }

  // New manager: create an account and step straight into a league with an invite code.
  function renderJoin() {
    setNavy(true);
    main.innerHTML =
      '<div class="fol-card">' + LOGO +
      '<h1>FIFTY OVERS</h1>' +
      '<div class="fol-sub">Join your league.</div>' +
      '<div class="fol-form">' +
      '<div><label>Email</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<div><label>Password</label><input id="folPass" type="password" autocomplete="new-password" placeholder="choose a password"></div>' +
      '<div><label>Invite code</label><input id="folCode" placeholder="from your commissioner"></div>' +
      '<div><label>Manager name</label><input id="folDn" placeholder="your name"></div>' +
      '<div><label>Team name</label><input id="folTn" placeholder="your club"></div>' +
      '<button class="fol-cta" data-act="joinNew">Create account and join</button>' +
      '</div>' +
      '<div class="fol-links"><a class="fol-mut" data-act="showLogin">Back to log in</a></div>' +
      FOOT + '</div>';
  }

  function renderForgot() {
    setNavy(true);
    main.innerHTML =
      '<div class="fol-card">' + LOGO +
      '<h1>FIFTY OVERS</h1>' +
      '<div class="fol-sub">Reset your password.</div>' +
      '<div class="fol-form">' +
      '<div><label>Email</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<button class="fol-cta" data-act="sendReset">Send reset link</button>' +
      '</div>' +
      '<div class="fol-links"><a class="fol-mut" data-act="showLogin">Back to log in</a></div>' +
      FOOT + '</div>';
  }

  function doLogin() {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    if (!email || !password) { say("Enter your email and password"); return; }
    fetch(URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (d.access_token) { JWT = d.access_token; saveSession(d); wrap.querySelector("#folWho").textContent = email; enterApp(); }
        else say("Check your email to confirm your account, then log in.");
      }).catch(say);
  }

  // After login, go straight into the league: RLS scopes `leagues` to the ones
  // you belong to, so no league id is ever needed. One league opens directly
  // (admin -> Admin, player -> Squad); several show a quick picker; none shows
  // the join-by-invite form.
  function enterApp() {
    return redeemPending().then(function () {
      return sel("leagues", "select=id,name,status,build_hash,draft_budget,season_no");
    }).then(function (ls) {
      if (!ls || !ls.length) { renderEnter(); return; }
      if (ls.length === 1) { return enterGame(ls[0]); }
      renderPicker(ls);
    }).catch(function () { renderEnter(); });
  }
  // If the user signed up with an invite code (and email confirmation was on, so
  // it could not be redeemed at signup), redeem it now that they are logged in.
  function redeemPending() {
    var raw = lsGet(PEND); if (!raw) return Promise.resolve();
    var p; try { p = JSON.parse(raw); } catch (e) { lsDel(PEND); return Promise.resolve(); }
    if (!p || !p.code) { lsDel(PEND); return Promise.resolve(); }
    return rpc("redeem_invite", { p_code: p.code, p_display_name: p.dn, p_team_name: p.tn || (p.dn + " XI") })
      .then(function () { lsDel(PEND); })
      .catch(function () { lsDel(PEND); }); // already a member or spent code: drop it and continue
  }
  function renderPicker(ls) {
    setNavy(false);
    wrap.querySelector("#folWho").textContent = "";
    main.innerHTML = '<div class="folbody"><div class="folcard"><h4>Your leagues</h4><div class="folpad" style="display:grid;gap:8px">' +
      ls.map(function (l) { return '<button class="p" style="text-align:left" data-act="openId" data-id="' + l.id + '">' + E(l.name) + "</button>"; }).join("") +
      '</div></div></div>';
  }
  function enterGameById(id) {
    return sel("leagues", "id=eq." + id + "&select=id,name,status,build_hash,draft_budget,season_no")
      .then(function (a) { if (a[0]) return enterGame(a[0]); });
  }

  // =================================================================
  //  In-game sync engine. Your game IS the multiplayer game: we hand
  //  the screen to the real game and keep it in step with the server —
  //  pull the shared league snapshot, push your own orders packet, and
  //  let the game's own table/fixtures/match screens do the rest.
  // =================================================================
  function enterGame(league) {
    LG = league;
    return Promise.all([
      sel("teams", "league_id=eq." + LG.id + "&select=id,name,country,draft_seed,manager_id"),
      sel("members", "league_id=eq." + LG.id + "&select=id,role,display_name"),
      rpc("resolve_manager_id", { p_league_id: LG.id })
    ]).then(function (r) {
      var teams = r[0], mem = r[1], myMid = r[2];
      SYNC = {
        myMid: myMid,
        me: mem.filter(function (m) { return m.id === myMid; })[0] || null,
        myTeam: teams.filter(function (t) { return t.manager_id === myMid; })[0] || null,
        lastVersion: 0, started: false, lastOrderSig: null, pollTimer: null
      };
      SYNC.isFounder = !!(SYNC.me && SYNC.me.role === "founder");
      if (LG.build_hash && LG.build_hash !== BUILD_HASH) console.warn("Fifty Overs: your game build differs from this league's pinned engine.");
      return syncTick(true);
    }).catch(say);
  }

  // Detect a "table not created yet" error (0011/0012 SQL not run in Supabase).
  function isMissingTable(e) { var m = ((e && e.message) || e || "") + ""; return /PGRST205|Could not find the table|schema cache|does not exist/i.test(m); }
  function setupNeeded() {
    openWrap(true); setNavy(false);
    var who = wrap.querySelector("#folWho"); if (who) who.textContent = LG ? LG.name : "";
    main.innerHTML = '<div class="folbody"><div class="folcard"><h4>Almost ready</h4><div class="folpad">' +
      '<div class="folsmall" style="margin-bottom:10px;line-height:1.5">This league still needs its sync tables in your database. Open <b>Supabase → SQL Editor</b>, run the setup SQL (the 0011 and 0012 snippets), then reload this page.</div>' +
      '<button class="mini" data-act="logout">log out</button>' +
      "</div></div></div>";
  }

  function syncTick(first) {
    if (!LG) return Promise.resolve();
    return sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round").then(function (a) {
      var st = a[0];
      if (st) {
        if (st.version > SYNC.lastVersion) { SYNC.lastVersion = st.version; applySnapshot(st.snapshot, first); }
        else openWrap(false);
        schedulePoll();
      } else {
        return preStart();
      }
    }).catch(function (e) {
      if (isMissingTable(e)) { setupNeeded(); return; }
      console.warn("Fifty Overs syncTick error", e);
      if (!SYNC.started) return preStart().catch(function (e2) { if (isMissingTable(e2)) setupNeeded(); else say(e2); });
      schedulePoll();
    });
  }

  // Load the shared league snapshot into the game and point it at MY club.
  function applySnapshot(snap, focus) {
    try {
      var prevRound = (window.App && App.season && typeof App.season.round === "number") ? App.season.round : -1;
      var myOrders = (window.App && App.orders) ? App.orders : null;
      if (typeof window.restoreFrom === "function") window.restoreFrom(snap);
      SYNC.started = true;
      var myName = SYNC.myTeam ? SYNC.myTeam.name : null;
      if (myName && typeof GD !== "undefined" && GD.teams) {
        var ix = GD.teams.findIndex(function (t) { return t.name === myName; });
        if (ix >= 0) App.teamIx = ix;
      }
      // keep my working line-up; if the round advanced, it needs re-saving for the new round
      var newRound = (window.App && App.season && typeof App.season.round === "number") ? App.season.round : prevRound;
      if (myOrders) { App.orders = myOrders; if (newRound !== prevRound) App.orders.saved = false; }
      try { if (typeof window.store === "function") window.store("fo_welcomed", "1"); } catch (e) {}
      if (typeof window.saveGame === "function") window.saveGame(false);
      openWrap(false);
      if (focus) location.hash = "#/club";
      if (typeof window.route === "function") window.route();
    } catch (e) { console.warn("Fifty Overs applySnapshot failed", e); }
  }

  // Before the season starts: draft in the game, then wait for kick-off.
  function preStart() {
    return sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=manager_id").then(function (mine) {
      var drafted = !!(mine && mine.length);
      // the commissioner's home base is the admin lobby (invite / manage / start),
      // where they can also draft their own club when they want.
      if (SYNC.isFounder) { showWait(drafted); return; }
      if (drafted) { showWait(true); return; }
      var mt = SYNC.myTeam;
      if (mt && mt.country && mt.draft_seed) { startDraft(mt); return; }
      renderSetup();
    }).catch(function (e) { if (isMissingTable(e)) setupNeeded(); else say(e); });
  }
  // Make bot clubs equal in strength to the human clubs: scale each bot's skills
  // so its average player rating matches the humans' average (with slight variety).
  function humanAvgRating() {
    var sum = 0, n = 0;
    (GD.teams || []).forEach(function (t) { if (t.founded) (t.players || []).forEach(function (p) { sum += (p.rating || 0); n++; }); });
    return n ? sum / n : 2000;
  }
  function balanceBots() {
    try {
      var target = humanAvgRating();
      for (var i = 0; i < GD.teams.length; i++) {
        var t = GD.teams[i]; if (t.founded) continue;                 // never touch human clubs
        var tgt = target * (0.93 + ((i * 89) % 140) / 1000);          // within ~7% of the human level
        for (var pass = 0; pass < 5; pass++) {
          var avg = t.players.reduce(function (s, p) { return s + (p.rating || 0); }, 0) / Math.max(1, t.players.length);
          var f = Math.max(0.5, Math.min(1.7, tgt / Math.max(1, avg)));
          if (Math.abs(f - 1) < 0.02) break;
          var sf = Math.pow(f, 0.85);
          t.players.forEach(function (p) { for (var k in p.skills) p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * sf))); if (typeof window.jsDerive === "function") window.jsDerive(p); });
        }
        t._botCal = 1;
      }
    } catch (e) { console.warn("balanceBots", e); }
  }

  // draft (or set up + draft) my own club, from the lobby.
  function draftMine() {
    var mt = SYNC && SYNC.myTeam;
    if (mt && mt.country && mt.draft_seed) { startDraft(mt); return; }
    renderSetup();
  }

  // Practice / friendlies vs bots: a private local season you play interactively
  // in the game, using your drafted club. Not synced to the league.
  function practice() {
    sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=club").then(function (rows) {
      var defaults = (typeof GD !== "undefined" && GD.teams) ? GD.teams.slice() : [];
      var myClub = (rows && rows[0] && rows[0].club) || (defaults[0] ? JSON.parse(JSON.stringify(defaults[0])) : null);
      if (!myClub) { say("Draft your squad first, then you can practice."); return; }
      var world = [myClub], used = {}; used[myClub.name] = 1;
      world = world.concat(defaults.filter(function (t) { return !used[t.name]; }).slice(0, Math.max(0, 10 - world.length)));
      GD.teams = world;
      if (typeof window.econInit === "function") window.econInit();
      App.teamIx = 0; balanceBots();
      App.season = null; if (typeof window.seasonInit === "function") window.seasonInit();
      App.round = 1; App.seasonNo = App.seasonNo || 1; App.results = []; App.cup = { stage: 0, alive: null, results: [], out: false };
      if (typeof window.mpInit === "function") window.mpInit();
      SYNC.practice = true;                                   // keep league sync from clobbering it
      if (SYNC.pollTimer) { clearInterval(SYNC.pollTimer); SYNC.pollTimer = null; }
      try { if (typeof window.store === "function") window.store("fo_welcomed", "1"); } catch (e) {}
      if (typeof window.saveGame === "function") window.saveGame(false);
      openWrap(false); location.hash = "#/matches"; if (typeof window.route === "function") window.route();
    }).catch(function (e) { if (isMissingTable(e)) setupNeeded(); else say(e); });
  }

  // Clubs & rosters: browse any club (bot or human) and see FTP-style player info
  // — age, rating, wage, batting/bowling type, talents, and form/fatigue/experience.
  // No raw skill numbers.
  var clubsView = 0;
  function renderClubs() {
    openWrap(true); setNavy(false);
    wrap.querySelector("#folWho").textContent = LG ? LG.name : "";
    var teams = (typeof GD !== "undefined" && GD.teams) ? GD.teams : [];
    if (!teams.length) {
      main.innerHTML = '<div class="folbody"><div class="folcard"><div class="folpad folrow"><button class="mini" data-act="backToGame">◂ back to the game</button></div></div>' +
        '<div class="folcard"><div class="folpad folsmall">No clubs yet. Start or open a season to see the league\'s clubs.</div></div></div>';
      return;
    }
    if (clubsView >= teams.length) clubsView = 0;
    var t = teams[clubsView];
    var pretty = function (c) { return (c == null ? "" : "" + c).replace(/([A-Z])/g, " $1").replace(/^./, function (x) { return x.toUpperCase(); }).trim(); };
    var players = (t.players || []).slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    var avg = players.length ? Math.round(players.reduce(function (s, p) { return s + (p.rating || 0); }, 0) / players.length) : 0;
    var list = players.map(function (p) {
      var hand = (p.hand === "L" ? "Left" : "Right") + " hand bat";
      var bt = p.btLabel && p.btLabel !== "Does not bowl" ? p.btLabel : "";
      var talents = (p.talents || []).map(pretty).filter(Boolean).join(", ");
      var l2 = [hand, bt, talents].filter(Boolean).join(" &middot; ");
      var l3 = [p.expWord && (p.expWord + " experience"), p.formWord && (p.formWord + " form"), p.fatigue && (p.fatigue + " fatigue"), p.captWord && (p.captWord + " captaincy")].filter(Boolean).join(" &middot; ");
      return '<div class="fclub-p"><div class="fclub-nm">' + E(p.name) + '<span class="fclub-nat">' + E(p.nat || "") + "</span></div>" +
        '<div class="fclub-l1">' + (p.age || "?") + " yrs &middot; " + (p.rating || 0).toLocaleString() + " rating &middot; $" + (p.wage || 0).toLocaleString() + " wage</div>" +
        (l2 ? '<div class="fclub-l2">' + l2 + "</div>" : "") + (l3 ? '<div class="fclub-l3">' + l3 + "</div>" : "") + "</div>";
    }).join("") || '<div class="folsmall">No players.</div>';
    var opts = teams.map(function (x, i) { return '<option value="' + i + '"' + (i === clubsView ? " selected" : "") + ">" + E(x.name) + "</option>"; }).join("");
    main.innerHTML = '<div class="folbody">' +
      '<div class="folcard"><div class="folpad folrow" style="justify-content:space-between"><button class="mini" data-act="backToGame">◂ back to the game</button>' +
      '<select id="folClubSel">' + opts + "</select></div></div>" +
      '<div class="folcard"><h4><span>' + E(t.name) + "</span><span class='folsmall'>" + players.length + " players &middot; avg " + avg.toLocaleString() + "</span></h4>" +
      '<div class="folpad"><div class="folsmall" style="margin-bottom:6px">Home ground: ' + E(t.ground || "-") + "</div>" + list + "</div></div></div>";
    var sel = wrap.querySelector("#folClubSel");
    if (sel) sel.addEventListener("change", function () { clubsView = +this.value; renderClubs(); });
  }

  // Minimal onboarding: pick home country + names, then draft in the game.
  function renderSetup() {
    openWrap(true); setNavy(false);
    wrap.querySelector("#folWho").textContent = LG ? LG.name : "";
    var opts = NAT.map(function (c) { return '<option value="' + E(c) + '">' + E(c) + "</option>"; }).join("");
    main.innerHTML = '<div class="folbody"><div class="folcard"><h4>Set up your club</h4><div class="folpad">' +
      '<div class="folsmall" style="margin-bottom:8px">Pick your home country. You draft players from it in the game.</div>' +
      '<div style="display:grid;gap:8px">' +
      '<label class="folsmall">Manager name<br><input id="folDn2" placeholder="your name" style="width:100%"></label>' +
      '<label class="folsmall">Club name<br><input id="folTn2" placeholder="your club" style="width:100%"></label>' +
      '<label class="folsmall">Home country<br><select id="folCty" style="width:100%">' + opts + "</select></label>" +
      '<button class="p" data-act="setupClub">Draft my squad ▸</button>' +
      '</div><div style="margin-top:10px"><button class="mini" data-act="logout">log out</button></div>' +
      "</div></div></div>";
  }
  function doSetup() {
    var dn = val("folDn2") || (SYNC.me && SYNC.me.display_name) || "Manager";
    var tn = val("folTn2") || (SYNC.myTeam && SYNC.myTeam.name) || (dn + " XI");
    var cty = (wrap.querySelector("#folCty") || {}).value || NAT[0];
    rpc("create_league_team", { p_league_id: LG.id, p_team_name: tn, p_manager_name: dn, p_country: cty })
      .then(function (team) { SYNC.myTeam = team; startDraft(team); }).catch(say);
  }

  // Waiting room (pre-season). The founder gets invite + start controls.
  function showWait(drafted) {
    openWrap(true); setNavy(false);
    wrap.querySelector("#folWho").textContent = LG ? LG.name : "";
    Promise.all([
      sel("teams", "league_id=eq." + LG.id + "&select=id,manager_id,name"),
      sel("league_clubs", "league_id=eq." + LG.id + "&select=manager_id")
    ]).then(function (r) {
      var teams = r[0], clubs = r[1], ready = {};
      clubs.forEach(function (c) { ready[c.manager_id] = 1; });
      var isF = SYNC.isFounder;
      var rows = teams.map(function (t) {
        var del = isF ? '<td style="text-align:right"><button class="mini" data-act="delTeam" data-id="' + t.id + '" data-name="' + E(t.name) + '" style="background:#5a2620;border-color:#7a3a30;color:#f0d0c8">✕ delete</button></td>' : "";
        return "<tr><td>" + E(t.name) + "</td><td>" + (ready[t.manager_id] ? '<span class="folbadge ok">drafted</span>' : '<span class="folbadge warn">drafting…</span>') + "</td>" + del + "</tr>";
      }).join("") || ('<tr><td colspan=' + (isF ? 3 : 2) + ' class="folsmall">No clubs yet.</td></tr>');
      var draftedCount = teams.filter(function (t) { return ready[t.manager_id]; }).length;
      var allReady = draftedCount >= 1 && draftedCount === teams.length;   // every club present has drafted
      var solo = draftedCount < 10;
      var startLabel = SYNC.started ? "Restart season (rebuild from clubs) ▸" : (draftedCount < 2 ? "Start season (you + bots) ▸" : "Start the league ▸");
      var ctl = isF
        ? '<div style="margin-top:10px">' +
            (allReady
              ? '<button class="p" data-act="startLeague">' + startLabel + '</button>' +
                (solo ? '<div class="folsmall" style="margin-top:4px">Empty slots fill with bot clubs to make a full 10-team league. Invite more friends for more human clubs.</div>' : "")
              : '<div class="folsmall">The season starts once every club has drafted.</div>') +
            '<div style="margin-top:8px"><button class="mini" data-act="mkInvite">Create invite code</button> <span id="folInvite" class="folsmall"></span></div>' +
          "</div>"
        : '<div class="folsmall" style="margin-top:10px">Waiting for the commissioner to start the season.</div>';
      var back = SYNC.started ? '<button class="mini" data-act="backToGame">◂ back to the game</button> ' : "";
      var draftBtn = drafted ? "" : '<button class="p" data-act="draftMine" style="margin-bottom:10px">🏏 Draft my squad ▸</button>';
      var practiceBtn = '<button class="mini" data-act="practice" style="margin-top:8px">🎮 Practice vs bots (play now)</button>';
      main.innerHTML = '<div class="folbody"><div class="folcard"><h4><span>' + E(LG.name) + (isF ? " · commissioner" : "") + "</span>" +
        (drafted ? '<span class="folbadge ok">you\'re in</span>' : "") + '</h4><div class="folpad">' + draftBtn +
        "<table><tr><th>Club</th><th>Status</th>" + (isF ? "<th></th>" : "") + "</tr>" + rows + "</table>" + ctl +
        '<div style="margin-top:10px">' + back + practiceBtn + ' <button class="mini" data-act="logout">log out</button></div>' +
        "</div></div></div>";
    }).catch(function (e) { if (isMissingTable(e)) setupNeeded(); else say(e); });
  }
  function delTeam(id, name) {
    if (!confirm('Permanently delete "' + name + '" — its club, squad and orders? This cannot be undone.')) return;
    rpc("founder_delete_team", { p_league_id: LG.id, p_team_id: id })
      .then(function () { showWait(!!(SYNC && SYNC.myTeam)); }).catch(say);
  }

  function mkInvite() {
    var code = ("FO" + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 4)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
    rpc("create_invite", { p_league_id: LG.id, p_code: code, p_role: "manager" })
      .then(function () { var el = wrap.querySelector("#folInvite"); if (el) el.textContent = "Share this code: " + code; })
      .catch(say);
  }

  // Founder assembles the league from everyone's drafted clubs and kicks off.
  // With only one human club, the game's own bot teams fill the league so there
  // is something to play; with two or more, it is a pure human league.
  function startLeague() {
    var defaults = (typeof GD !== "undefined" && GD.teams) ? GD.teams.slice() : [];
    sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id").then(function (clubs) {
      if (!clubs || !clubs.length) { say("Draft your squad first, then start the season."); return; }
      try {
        var world = clubs.map(function (c) { return c.club; });
        if (world.length < 10) {   // fill up to a full 10-team league with bot clubs
          var used = {}; world.forEach(function (t) { used[t.name] = 1; });
          var bots = defaults.filter(function (t) { return !used[t.name]; }).slice(0, Math.max(0, 10 - world.length));
          world = world.concat(bots);
        }
        GD.teams = world;
        if (typeof window.econInit === "function") window.econInit();
        var myName = SYNC.myTeam ? SYNC.myTeam.name : null;
        var mine = GD.teams.findIndex(function (t) { return t.name === myName; });
        App.teamIx = mine >= 0 ? mine : 0;
        balanceBots();
        App.season = null; if (typeof window.seasonInit === "function") window.seasonInit();
        App.round = 1; App.seasonNo = App.seasonNo || 1; App.results = [];
        App.cup = { stage: 0, alive: null, results: [], out: false };
        if (typeof window.mpInit === "function") window.mpInit();
        try { if (typeof window.store === "function") window.store("fo_welcomed", "1"); } catch (e) {}
        if (typeof window.saveGame === "function") window.saveGame(false);
        var snap = (typeof window.snapshot === "function") ? window.snapshot(true) : null;
        if (!snap) { say("Game engine not ready. Reload and try again."); return; }
        rpc("push_league_state", { p_league_id: LG.id, p_snapshot: snap, p_round: 0 }).then(function (ver) {
          SYNC.lastVersion = ver || 1; SYNC.started = true;
          say("🏏 Season started! Matches resolve automatically as orders come in.");
          openWrap(false); location.hash = "#/matches"; if (typeof window.route === "function") window.route();
          schedulePoll();
        }).catch(say);
      } catch (e) { say(e); }
    }).catch(say);
  }

  // Background sync loop: push my saved orders as a packet; pull new snapshots.
  function schedulePoll() {
    if (SYNC && SYNC.pollTimer) return;
    if (SYNC) SYNC.pollTimer = setInterval(pollOnce, 15000);
  }
  function pollOnce() {
    if (!LG || !SYNC || SYNC.practice) return;   // practice mode is a private local game
    try {
      if (SYNC.started && window.App && App.orders && App.orders.saved && App.season && typeof GD !== "undefined" && GD.teams) {
        var sig = JSON.stringify(App.orders) + "|" + App.season.round;
        if (sig !== SYNC.lastOrderSig) {
          SYNC.lastOrderSig = sig;
          var pkt = { fo_packet: 1, teamIx: App.teamIx, club: (GD.teams[App.teamIx] || {}).name, round: App.season.round, manager: (SYNC.me && SYNC.me.display_name) || "manager", orders: App.orders };
          rpc("push_packet", { p_league_id: LG.id, p_round: App.season.round, p_packet: pkt }).catch(function () {});
        }
      }
    } catch (e) {}
    sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round").then(function (a) {
      var st = a[0]; if (st && st.version > SYNC.lastVersion) { SYNC.lastVersion = st.version; applySnapshot(st.snapshot, false); }
    }).catch(function () {});
  }

  function doJoinSignup() {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    var code = val("folCode"), dn = val("folDn"), tn = val("folTn");
    if (!email || !password) { say("Enter your email and password"); return; }
    if (!code || !dn) { say("Enter your invite code and manager name"); return; }
    // Remember the invite so we can finish joining after email confirmation + login.
    lsSet(PEND, JSON.stringify({ code: code, dn: dn, tn: tn }));
    fetch(URL + "/auth/v1/signup", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (!d.access_token) { say("Account created! Check your email, tap the confirmation link, then log in. We'll drop you straight into your league."); renderLogin(); return; }
        JWT = d.access_token; saveSession(d); wrap.querySelector("#folWho").textContent = email;
        return enterApp();
      }).catch(say);
  }

  function sendReset() {
    var email = val("folEmail");
    if (!email) { say("Enter your email"); return; }
    fetch(URL + "/auth/v1/recover", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email }) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); })
      .then(function () { say("If that email has an account, a reset link is on its way."); renderLogin(); }).catch(say);
  }

  // ---- join a league (shown only when you are not in one yet) ----
  function renderEnter() {
    setNavy(false);
    wrap.querySelector("#folWho").textContent = "";
    tabsHidden();
    main.innerHTML =
      '<div class="folbody"><div class="folcard"><h4>Join a league</h4><div class="folpad">' +
      '<div class="folsmall" style="margin-bottom:8px">Enter the invite code from your commissioner.</div>' +
      '<div class="folrow"><input id="folCode" placeholder="invite code"><input id="folDn" placeholder="your name"><input id="folTn" placeholder="team name"><button class="p" data-act="join">Join</button></div>' +
      '<div style="margin-top:12px"><button class="mini" data-act="logout">log out</button></div>' +
      "</div></div></div>";
  }
  function joinLeague() {
    var code = val("folCode"), dn = val("folDn"), tn = val("folTn");
    if (!code || !dn) { say("Enter the invite code and your name"); return; }
    rpc("redeem_invite", { p_code: code, p_display_name: dn, p_team_name: tn || dn + " XI" })
      .then(function (mid) { return sel("members", "id=eq." + mid + "&select=league_id"); })
      .then(function (m) { return enterGameById(m[0].league_id); })
      .catch(say);
  }
  // ============================================================================
  // IN-GAME DRAFT: build a balanced, country-flavoured, unique pool from the
  // manager's server draft_seed, drive the game's real draft screen (pgFounder),
  // relabel the confirm button to "Start Season", and save the squad on confirm.
  // ============================================================================

  // 42 balanced players (same tier structure for everyone), all set to the
  // manager's country with country names, deterministic from their draft_seed.
  function buildCountryPool(seedInt, country) {
    var prev = App.founder;
    App.founder = { identity: "Balanced XI" };   // neutral tilt so pools are equally strong
    var pool;
    try { pool = window.genDraftPool("league-" + (seedInt >>> 0)); }
    finally { App.founder = prev; }
    var rnd = window.rng((seedInt >>> 0) ^ 0x9e3779b9), used = new Set();
    pool.forEach(function (p) {
      p.nat = country;
      var nm = window.natName(country, rnd, used); used.add(nm); p.name = nm;
      fixTechniquePower(p, rnd);
    });
    return pool;
  }

  // Enforce realistic technique/power relationships on a generated player, using
  // the game's own aggregate formulas (aggBat/aggBowl/aggTech). A "level" = 6.25.
  //   technique  = within 2 levels BELOW the headline batting/bowling skill
  //   power      = equal to, or 1–4 levels below, technique
  function fixTechniquePower(p, rnd) {
    var LV = 6.25, s = p.skills || {};
    var clamp = function (v) { return Math.max(5, Math.min(95, Math.round(v))); };
    var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var batAgg = 0.25 * s.vsPace + 0.25 * s.vsSpin + 0.2 * s.rotation + 0.15 * s.temperament + 0.15 * s.power;
    var bowlAgg = isBowler ? (s.wicket + s.economy + s.discipline + s.moveTurn + s.variation + s.stamina) / 6 : 0;
    var headline = Math.max(batAgg, bowlAgg);

    // technique target: at least ~1 level below headline (ideally lower), and no
    // more than 2 levels below. The 1-level cap absorbs the aggregate's slight
    // self-reference so technique lands reliably below the headline.
    var curTech = (s.vsPace + s.vsSpin + s.temperament) / 3;
    var techTarget = Math.max(headline - 2 * LV, Math.min(headline - 1.0 * LV, curTech));
    var dTech = techTarget - curTech;
    s.vsPace = clamp(s.vsPace + dTech); s.vsSpin = clamp(s.vsSpin + dTech); s.temperament = clamp(s.temperament + dTech);

    // power: equal to or 1–4 levels below the new technique
    var newTech = (s.vsPace + s.vsSpin + s.temperament) / 3;
    s.power = clamp(Math.max(newTech - 4 * LV, Math.min(newTech - (rnd() < 0.5 ? 0 : LV * (1 + rnd() * 3)), s.power)));

    if (typeof window.jsDerive === "function") window.jsDerive(p);   // recompute rating
  }

  window.__folBuildPool = buildCountryPool;   // debug/test hook (harmless)

  // Draft happens in the game's OWN founder screen (pgFounder). We hand it a
  // balanced, country-flavoured pool derived from the server draft_seed.
  function startDraft(team) {
    if (typeof window.genDraftPool !== "function" || typeof window.pgFounder !== "function") { say("Game engine not ready. Reload the page and try again."); return; }
    var pool = buildCountryPool(team.draft_seed, team.country);
    App.founder = {
      name: team.name, budget: 1000000, pool: pool, picked: [], identity: "Balanced XI",
      mgr: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager",
      __league: { league_id: LG.id, team_id: team.id }
    };
    openWrap(false);                       // hand the screen to the game's draft
    try { window.pgFounder(); } catch (e) { say(e); }
  }

  // relabel the confirm button to "Start Season" while in league draft mode
  if (typeof window.pgFounder === "function") {
    var _pg = window.pgFounder;
    window.pgFounder = function () {
      var out = _pg.apply(this, arguments);
      try {
        if (App.founder && App.founder.__league) {
          var b = document.querySelector("#page .confirmbtn");
          if (b) b.textContent = "🏏 Confirm my squad";
        }
      } catch (e) {}
      return out;
    };
  }

  // On confirm in league mode, let the game build the club into GD.teams (so it
  // is a real, valid club record), then upload it. The season starts when the
  // commissioner has everyone's clubs.
  if (typeof window.founderConfirm === "function") {
    var _fc = window.founderConfirm;
    window.founderConfirm = function () {
      var lg = App.founder && App.founder.__league;
      var out = _fc.apply(this, arguments);   // game writes the drafted squad into GD.teams[teamIx]
      if (lg) {
        try {
          var club = JSON.parse(JSON.stringify(GD.teams[App.teamIx]));
          rpc("push_club", { p_league_id: lg.league_id, p_club: club, p_team_ix: null }).then(function () {
            say("🏏 Squad locked in! Waiting for the commissioner to start the season.");
            showWait(true);
          }).catch(say);
        } catch (e) { say(e); }
      }
      return out;
    };
  }

  // Multiplayer-first: the league login takes over the moment the site loads,
  // and the page behind it is locked so the solo game stays private until you
  // are in a league — then your game IS the league. A saved session is restored
  // first, so a refresh keeps you logged in.
  openWrap(true);
  restoreSession().then(function () { if (JWT) enterApp(); else renderLogin(); }).catch(function () { renderLogin(); });

  console.info("Fifty Overs League overlay ready.");
})();
