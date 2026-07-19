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
      var ttl = Math.min(9000, 3200 + msg.length * 35);   // longer messages linger
      setTimeout(function () { t.classList.remove("on"); setTimeout(function () { t.remove(); }, 350); }, ttl);
      while (_toastHost.children.length > 3) _toastHost.firstChild.remove();
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

  // ---- styles + shell ----
  var css = document.createElement("style");
  css.textContent =
    "#folBtn{position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#C95532;color:#FFFEFC;border:none;border-radius:22px;padding:10px 16px;font:600 14px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer}" +
    "#folWrap{position:fixed;inset:0;z-index:2147483001;background:rgba(8,16,29,.72);display:none}" +
    "#folWrap.on{display:block}" +
    "#folPanel{position:absolute;inset:0;margin:auto;max-width:780px;background:#07162E;color:#FFFEFC;overflow:auto;font:14px/1.45 -apple-system,'Segoe UI',Roboto,Inter,system-ui,sans-serif;-webkit-overflow-scrolling:touch}" +
    "@media(min-width:820px){#folPanel{inset:20px;border-radius:12px}}" +
    "#folPanel a{color:#4DA6A2 !important}" +
    ".folhd{position:sticky;top:0;background:#0E233F;border-bottom:1px solid rgba(246,244,238,.12);padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".folhd h3{margin:0;font-size:15px;flex:1;display:flex;align-items:center;gap:8px}" +
    ".fol-hdicon{width:24px;height:24px;border-radius:7px;display:inline-block;flex:0 0 auto}" +
    ".folbody{padding:12px 14px;display:grid;gap:12px}" +
    ".folcard{background:#0E233F;border:1px solid rgba(246,244,238,.12);border-radius:10px}" +
    ".folcard h4{margin:0;padding:8px 12px;border-bottom:1px solid rgba(246,244,238,.12);font-size:13px;display:flex;justify-content:space-between}" +
    ".folpad{padding:10px 12px}" +
    ".foltabs{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px}" +
    ".foltab{padding:6px 12px;border:1px solid rgba(246,244,238,.12);border-radius:8px;cursor:pointer;font-size:13px}" +
    ".foltab.on{background:#C95532;color:#FFFEFC;border-color:#C95532}" +
    "#folPanel table{width:100%;border-collapse:collapse}#folPanel th,#folPanel td{padding:5px 8px;border-bottom:1px solid rgba(246,244,238,.1);text-align:left}" +
    "#folPanel .n{text-align:right;font-variant-numeric:tabular-nums}" +
    "#folPanel input,#folPanel select,#folPanel button{font:inherit;padding:6px 9px;border:1px solid rgba(246,244,238,.12);border-radius:8px;background:rgba(246,244,238,.06);color:#FFFEFC}" +
    "#folPanel button{cursor:pointer}#folPanel button.p{background:#C95532;color:#FFFEFC;border-color:#C95532}#folPanel button.mini{padding:2px 8px;font-size:12px}" +
    ".folrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.folsmall{font-size:12px;opacity:.7}" +
    ".folbadge{font-size:11px;padding:1px 6px;border-radius:10px;border:1px solid rgba(246,244,238,.12)}.folbadge.ok{color:#4DA6A2;border-color:rgba(77,166,162,.5)}.folbadge.warn{color:#e08b7f;border-color:#8a4a3a}" +
    "#folPin{background:#DC2626;color:#fff;padding:8px 14px;display:none}" +
    ".fclub-p{padding:9px 2px;border-bottom:1px solid rgba(246,244,238,.1)}.fclub-p:last-child{border-bottom:none}" +
    ".fclub-nm{font-weight:700;color:#FFFEFC;font-size:14px}.fclub-nat{font-weight:500;color:#4DA6A2;font-size:11px;margin-left:7px;letter-spacing:.5px}" +
    ".fclub-l1{color:#FFFEFC;font-size:12.5px;margin-top:3px}.fclub-l2,.fclub-l3{color:rgba(246,244,238,.7);font-size:12px;margin-top:2px;line-height:1.4}";
  document.head.appendChild(css);

  // ---- Fifty Overs identity: navy + terracotta, teal accents (login) ----
  var css2 = document.createElement("style");
  css2.textContent =
    "#folWrap{background:#07162E !important}" +
    // Login/signup mode is FULL-BLEED: without this the panel is a centered 780px
    // column whose edges vanish against the dark page · leaving its scrollbar
    // floating weirdly in the middle of the screen. Background: brand gradient +
    // two very faint boundary-rope arcs (abstract cricket field lines).
    "#folPanel.fol-navy{inset:0 !important;max-width:none;border-radius:0;display:flex;flex-direction:column;" +
      "padding:calc(20px + env(safe-area-inset-top,0px)) 20px calc(20px + env(safe-area-inset-bottom,0px));" +
      "background:" +
      "radial-gradient(ellipse 130% 95% at 50% 128%,transparent 59.6%,rgba(246,244,238,.045) 60%,transparent 60.7%)," +
      "radial-gradient(ellipse 105% 75% at 50% 132%,transparent 59.5%,rgba(246,244,238,.03) 60%,transparent 60.9%)," +
      "radial-gradient(circle at 30% 40%,rgba(77,166,162,.18),transparent 32%)," +
      "radial-gradient(circle at 78% 20%,rgba(200,103,74,.08),transparent 28%)," +
      "linear-gradient(180deg,#07162E 0%,#08101D 100%)}" +
    // margin:auto (not align-items:center) so content taller than the window scrolls instead of clipping its top
    "#folPanel.fol-navy #folMain{margin:auto;width:100%;max-width:1120px}" +
    // subtle dark scrollbar (the default white one glows against navy)
    "#folPanel{scrollbar-width:thin;scrollbar-color:rgba(246,244,238,.25) transparent}" +
    "#folPanel::-webkit-scrollbar{width:10px}#folPanel::-webkit-scrollbar-track{background:transparent}" +
    "#folPanel::-webkit-scrollbar-thumb{background:rgba(246,244,238,.18);border-radius:6px;border:2px solid #07162E}#folPanel::-webkit-scrollbar-thumb:hover{background:rgba(246,244,238,.32)}" +
    "#folPanel.fol-navy .folhd{display:none}" +
    // ---- split auth layout: brand lockup left, card right ----
    ".fol-auth{display:flex;align-items:center;gap:56px}" +
    ".fol-brand{flex:1.15;display:flex;flex-direction:column;align-items:center;text-align:center}" +
    ".fol-mark{width:210px;height:auto;filter:drop-shadow(0 0 34px rgba(77,166,162,.28))}" +
    ".fol-word{margin:26px 0 0;font-size:clamp(30px,3.2vw,44px);font-weight:700;letter-spacing:.34em;text-indent:.34em;color:#FFFEFC;white-space:nowrap}" +
    ".fol-word i{font-style:normal;color:#5A7492}" +
    ".fol-tag{margin-top:16px;font-size:15.5px;letter-spacing:.22em;color:rgba(246,244,238,.85)}" +
    ".fol-tag b{color:#C95532;font-weight:400;margin:0 10px}" +
    ".fol-feats{margin-top:12px;font-size:12.5px;letter-spacing:.14em;color:#4DA6A2}" +
    ".fol-feats b{color:rgba(246,244,238,.4);font-weight:400;margin:0 8px}" +
    // clip-path crops a white sliver baked into the icon bitmap's right edge
    ".fol-minilogo{width:56px;height:56px;border-radius:14px;margin-top:56px;opacity:.9;clip-path:inset(1px 5px 1px 1px round 14px)}" +
    ".fol-side{flex:1;display:flex;justify-content:center}" +
    ".fol-card{width:100%;max-width:430px;background:rgba(28,36,51,.82);border:1px solid rgba(246,244,238,.14);border-radius:24px;box-shadow:0 30px 70px -28px rgba(0,0,0,.65),0 1px 0 rgba(246,244,238,.04) inset;padding:36px 32px 26px;backdrop-filter:blur(6px)}" +
    ".fol-logo{display:none;width:64px;height:64px;border-radius:15px;margin:0 auto 18px;clip-path:inset(1px 6px 1px 1px round 15px)}" +
    ".fol-card h1{margin:0;text-align:center;font-size:26px;font-weight:700;letter-spacing:.3px;color:#FFFEFC}" +
    ".fol-card .fol-sub{margin:8px 0 26px;text-align:center;font-size:14px;color:rgba(246,244,238,.65);letter-spacing:.2px}" +
    ".fol-form{display:flex;flex-direction:column;gap:15px}" +
    ".fol-form label{display:block;font-size:13px;font-weight:600;color:rgba(246,244,238,.85);margin:0 0 7px 2px}" +
    ".fol-lrow{display:flex;justify-content:space-between;align-items:baseline}" +
    "#folPanel .fol-lrow a{font-size:12.5px;color:#4DA6A2 !important;cursor:pointer;text-decoration:none}" +
    "#folPanel .fol-lrow a:hover{text-decoration:underline}" +
    "#folPanel .fol-form input{width:100%;min-height:48px;background:rgba(246,244,238,.06);border:1px solid rgba(246,244,238,.12);border-radius:12px;padding:12px 14px;color:#FFFEFC;font-size:16px;transition:border-color .15s,box-shadow .15s}" +
    "#folPanel .fol-form input::placeholder{color:rgba(246,244,238,.38)}" +
    "#folPanel .fol-form input:focus{outline:none;border-color:#4DA6A2;box-shadow:0 0 0 3px rgba(77,166,162,.16)}" +
    "#folPanel .fol-cta{margin-top:10px;min-height:52px;background:#C95532 !important;color:#FFFEFC !important;border:none !important;border-radius:13px;padding:15px;font-size:16.5px;font-weight:700;letter-spacing:.4px;cursor:pointer;transition:filter .15s}" +
    "#folPanel .fol-cta:hover{filter:brightness(1.07)}" +
    ".fol-or{display:flex;align-items:center;gap:14px;margin:20px 0 4px;color:rgba(246,244,238,.45);font-size:12.5px}" +
    ".fol-or:before,.fol-or:after{content:'';flex:1;height:1px;background:rgba(246,244,238,.12)}" +
    ".fol-links{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:12px}" +
    "#folPanel .fol-links a{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 14px;color:#4DA6A2 !important;text-decoration:none;font-size:15px;font-weight:600;cursor:pointer}" +
    "#folPanel .fol-links a.fol-mut{color:rgba(246,244,238,.6) !important;font-weight:500;font-size:13.5px;min-height:34px}" +
    "#folPanel .fol-links a:hover{filter:brightness(1.15)}" +
    ".fol-foot{display:flex;align-items:center;justify-content:center;gap:7px;margin:20px 0 2px;text-align:center;font-size:12px;color:rgba(246,244,238,.45)}" +
    ".fol-foot svg{flex:0 0 auto;opacity:.55}" +
    // ---- mobile: single column, compact monogram on the card, no split pane ----
    "@media(max-width:899px){" +
      ".fol-auth{flex-direction:column;gap:0}" +
      ".fol-brand{display:none}" +
      ".fol-logo{display:block}" +
      "#folPanel.fol-navy{padding-left:20px;padding-right:20px}" +
      ".fol-card{max-width:460px;padding:28px 22px 22px}" +
      ".fol-card h1{font-size:23px}" +
    "}" +
    // ---- modern lobby: the non-navy panel screens (waiting room, league picker,
    //      commissioner lobby) get the same premium treatment as the rest ----
    "#folPanel:not(.fol-navy){background:radial-gradient(circle at 24% 0%,rgba(77,166,162,.10),transparent 36%),linear-gradient(180deg,#07162E 0%,#08101D 100%)}" +
    "#folPanel .folhd{background:rgba(28,36,51,.92);backdrop-filter:blur(6px);border-bottom:1px solid rgba(246,244,238,.1);padding:12px 18px}" +
    "#folPanel .folhd h3{font-size:15px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800}" +
    "#folPanel .folbody{padding:20px 18px;max-width:720px;margin:0 auto}" +
    "#folPanel .folcard{background:rgba(28,36,51,.82);border:1px solid rgba(246,244,238,.14);border-radius:18px;box-shadow:0 24px 60px -30px rgba(0,0,0,.6);overflow:hidden}" +
    "#folPanel .folcard h4{padding:14px 18px;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(246,244,238,.85);border-bottom:1px solid rgba(246,244,238,.1);background:rgba(7,22,46,.35)}" +
    "#folPanel .folpad{padding:16px 18px}" +
    "#folPanel th{font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(246,244,238,.45);border-bottom:1px solid rgba(246,244,238,.14);padding:7px 8px}" +
    "#folPanel td{padding:10px 8px;border-bottom:1px solid rgba(246,244,238,.07);font-size:13.5px}" +
    "#folPanel tr:last-child td{border-bottom:none}" +
    "#folPanel button{border-radius:10px;transition:filter .15s;font-weight:600}" +
    "#folPanel button.p{background:#C95532 !important;border-color:#C95532 !important;color:#FFFEFC !important;padding:11px 18px;font-weight:700}" +
    "#folPanel button.p:hover{filter:brightness(1.07)}" +
    "#folPanel button.mini{background:rgba(246,244,238,.06);border:1px solid rgba(246,244,238,.16);color:rgba(246,244,238,.8);padding:6px 12px;font-size:12.5px}" +
    "#folPanel button.mini:hover{border-color:#4DA6A2;color:#FFFEFC}" +
    "#folPanel .folbadge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;letter-spacing:.3px}" +
    "#folPanel .folbadge.ok{background:rgba(77,166,162,.14)}" +
    "#folPanel .folbadge.warn{background:rgba(200,103,74,.13)}" +
    "#folPanel .folsmall{color:rgba(246,244,238,.6);opacity:1;line-height:1.5}" +
    // ---- toast notifications (replace native alert) ----
    "#fo-toasts{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:2147483200;display:flex;flex-direction:column-reverse;gap:8px;align-items:center;pointer-events:none;max-width:min(92vw,560px)}" +
    ".fo-toast{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;background:rgba(28,36,51,.97);color:#FFFEFC;border:1px solid rgba(246,244,238,.16);border-radius:13px;padding:12px 16px;font:13.5px/1.45 -apple-system,'Segoe UI',Roboto,Inter,system-ui,sans-serif;box-shadow:0 14px 40px -10px rgba(0,0,0,.6);opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s;cursor:pointer;max-width:100%}" +
    ".fo-toast.on{opacity:1;transform:none}" +
    ".fo-toast-ic{flex:none;display:flex;margin-top:1px;color:#4DA6A2}" +
    ".fo-toast-error{border-color:rgba(200,103,74,.5);background:linear-gradient(160deg,rgba(58,32,26,.97),rgba(40,22,20,.97))}" +
    ".fo-toast-error .fo-toast-ic{color:#e58b86}" +
    ".fo-toast-tx{word-break:break-word}" +
    // ---- confirmation modal ----
    "#fo-modal{position:fixed;inset:0;z-index:2147483150;opacity:0;transition:opacity .18s}" +
    "#fo-modal.on{opacity:1}" +
    ".fo-mo-back{position:absolute;inset:0;background:rgba(8,16,29,.66);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}" +
    ".fo-mo-card{width:100%;max-width:400px;background:linear-gradient(160deg,#0E233F,#111B2B);border:1px solid rgba(246,244,238,.14);border-radius:18px;padding:26px 26px 22px;text-align:center;color:#FFFEFC;box-shadow:0 30px 70px -20px rgba(0,0,0,.7);font:14px/1.5 -apple-system,'Segoe UI',Roboto,Inter,system-ui,sans-serif;transform:translateY(8px);transition:transform .18s}" +
    "#fo-modal.on .fo-mo-card{transform:none}" +
    ".fo-mo-ic{width:52px;height:52px;border-radius:50%;background:rgba(77,166,162,.14);color:#4DA6A2;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}" +
    ".fo-mo-dngr .fo-mo-ic{background:rgba(200,79,74,.16);color:#e58b86}" +
    ".fo-mo-card h3{margin:0 0 6px;font-size:17.5px;font-weight:800}" +
    ".fo-mo-card p{margin:0 0 4px;font-size:13.5px;color:rgba(246,244,238,.68)}" +
    ".fo-mo-act{display:flex;gap:10px;margin-top:18px}" +
    ".fo-mo-act button{flex:1;padding:12px;border-radius:11px;font:600 14px inherit;font-family:inherit;cursor:pointer;min-height:46px}" +
    ".fo-mo-cancel{background:rgba(246,244,238,.07);color:#FFFEFC;border:1px solid rgba(246,244,238,.22)}" +
    ".fo-mo-cancel:hover,.fo-mo-cancel:focus{background:rgba(246,244,238,.14);outline:none;border-color:rgba(246,244,238,.4)}" +
    ".fo-mo-ok{background:#4DA6A2;color:#07162E;border:none;font-weight:700}" +
    ".fo-mo-dngr .fo-mo-ok{background:#DC2626;color:#fff}" +
    ".fo-mo-ok:hover{filter:brightness(1.08)}";
  document.head.appendChild(css2);

  // ---- restyle the GAME itself: brand colours (navy/terracotta/teal) on the
  //      light background, and proper mobile layout. Injected after the game's
  //      own <style>, so it wins without touching the pinned engine file. ----
  var css3 = document.createElement("style");
  css3.id = "fo-brand";
  var NAVY = "#07162E", NAVY2 = "#0E233F", TERRA = "#C95532", TERRA2 = "#A64426", TEAL = "#4DA6A2", PAPER = "#FFFEFC";
  css3.textContent =
    // recolour by overriding the engine's own CSS variables (they cascade everywhere)
    ":root{--blue:" + TERRA + ";--blue-dark:" + TERRA2 + ";--orange:" + TEAL + ";--nav:" + NAVY + ";" +
    "--ftp-blue:" + TERRA + ";--ftp-blue-dark:" + TERRA2 + ";--ftp-orange:" + TEAL + ";--ftp-link:#B04A2C;--green:#16A34A}" +
    // the engine scopes its theme with `body.ftpskin ...`, so we match that scope
    "html body.ftpskin #topbar,#topbar{background:" + NAVY + " !important;border-bottom:3px solid " + TERRA + " !important}" +
    // the topbar must never show a scrollbar on ANY viewport (the engine sets
    // overflow-x:auto; at browser zoom the nav can overflow and Windows paints
    // a full-width scroll strip under the header)
    "#topbar{scrollbar-width:none !important}" +
    "#topbar::-webkit-scrollbar{display:none !important;height:0 !important}" +
    "html,body{overflow-x:clip}" +
    "html body.ftpskin #topbar a.on,#topbar a.on{background:" + TERRA + " !important;color:" + PAPER + " !important;box-shadow:inset 0 -3px 0 " + TEAL + " !important}" +
    "#topbar a:hover{background:#16324a !important}" +
    // keep the game's zebra striping / colours out of our own overlay tables
    "#folPanel table tr,#folPanel table tbody tr{background:transparent !important}" +
    "#folPanel td,#folPanel th{color:#FFFEFC !important;background:transparent !important;border-bottom-color:rgba(246,244,238,.12) !important}" +
    "#topbar .brand::before{display:none !important}" +
    "#topbar a[data-nav=\"reports\"],#topbar a[data-nav=\"manual\"],#topbar a[data-nav=\"orders\"]{display:none !important}" +
    ".fo-scoutname{cursor:pointer}" +
    ".fo-brandicon{width:28px;height:28px;border-radius:7px;vertical-align:-9px;margin-right:7px}" +
    // clock sits in the topbar flow (not absolute) so it never overlaps the game's status
    "#fo-clock{color:rgba(246,244,238,.9);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:.3px;align-self:center;padding:0 10px;border-left:1px solid #5b5b5b}" +
    "#topbar a.fo-logout{margin-left:6px}" +
    ".fo-mtime{font-size:10px;color:#C95532;font-weight:600;margin-top:1px}" +
    // upcoming-fixtures list with per-fixture Set lineup buttons
    ".fo-fx{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 2px;border-bottom:1px solid #e7e2d6}" +
    ".fo-fx:last-child{border-bottom:none}" +
    ".fo-fx-main{min-width:0}.fo-fx-sub{color:#7a7566;margin-top:1px}" +
    ".fo-fx-act{display:flex;align-items:center;gap:8px;flex:none}" +
    ".fo-plan-ok{color:" + TEAL + ";font-weight:700;font-size:11px}" +
    ".fo-setr{font-size:12px;padding:5px 12px;border:1px solid " + TERRA + ";background:" + TERRA + ";color:" + PAPER + ";border-radius:6px;cursor:pointer;white-space:nowrap}" +
    ".fo-setr:hover{background:" + TERRA2 + "}" +
    // orders page: copy-previous bar
    ".fo-orders-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 8px}" +
    ".fo-copyprev{font-size:12px;padding:6px 12px;border:1px solid " + TEAL + ";background:" + PAPER + ";color:#2b6b68;border-radius:6px;cursor:pointer}" +
    ".fo-copyprev:hover:not(:disabled){background:" + TEAL + ";color:#fff}.fo-copyprev:disabled{opacity:.5;cursor:default}" +
    // rival club (scout) page · custom hero (high contrast) + FTP-style link banner
    ".fo-scout{max-width:1080px;margin:0 auto}" +
    ".fo-scout-hero{position:relative;overflow:hidden;border-radius:14px;padding:24px 26px;margin:6px 0 14px;display:flex;gap:20px;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;background:linear-gradient(135deg,#0E233F,#07162E 62%);box-shadow:0 10px 30px rgba(7,22,46,.25)}" +
    // the founding date, worn like a crest inscription: serif small caps in
    // heritage gold, flanked by fading hairlines
    ".fo-estd{display:inline-flex;align-items:center;gap:9px;font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-size:10.5px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:#D9B75A;white-space:nowrap}" +
    ".fo-estd::before,.fo-estd::after{content:'';height:1px;width:26px;flex:0 0 auto}" +
    ".fo-estd::before{background:linear-gradient(90deg,transparent,rgba(217,183,90,.8))}" +
    ".fo-estd::after{background:linear-gradient(90deg,rgba(217,183,90,.8),transparent)}" +
    ".fo-c2-est,.fo-scout-est{margin-top:8px}" +
    ".fo-bt-tag{display:inline-block;margin-left:6px;font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#5a6472;background:#EFECE3;border-radius:5px;padding:1px 5px;vertical-align:1px;white-space:nowrap}" +
    ".fo-tal-tag{display:inline-block;margin-left:5px;font-size:9.5px;font-weight:700;color:#5b4a91;background:#EEE8FA;border-radius:5px;padding:1px 6px;vertical-align:1px;white-space:nowrap}" +
    ".fo-scout-hero::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(" + TERRA + "," + TEAL + ")}" +
    ".fo-scout-hero-main{flex:1 1 320px;min-width:230px}" +
    ".fo-scout-eyebrow{color:#e79274;font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;margin-bottom:7px}" +
    ".fo-scout-name{color:#fff;font-size:32px;line-height:1.05;margin:0 0 9px;font-weight:800;letter-spacing:-.4px}" +
    ".fo-scout-meta{color:#c7d0dc;font-size:13px;margin-bottom:16px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".fo-scout-meta .fo-form{margin-left:0}" +
    ".fo-scout-actions{display:flex;gap:10px;flex-wrap:wrap}" +
    ".fo-scout-actions .fo-challenge{background:" + TERRA + ";color:#fff;border:none;padding:10px 18px;border-radius:9px;font-weight:700;cursor:pointer;font-size:14px}" +
    ".fo-scout-actions .fo-challenge:hover{background:" + TERRA2 + "}" +
    ".fo-scout-actions .fo-scout-back{background:rgba(246,244,238,.10);color:" + PAPER + ";border:1px solid rgba(246,244,238,.28);padding:10px 16px;border-radius:9px;cursor:pointer;font-size:14px}" +
    ".fo-scout-actions .fo-scout-back:hover{background:rgba(246,244,238,.2)}" +
    ".fo-scout-kpis{display:grid;grid-template-columns:repeat(2,minmax(118px,1fr));gap:10px;flex:0 1 296px}" +
    ".fo-kpi{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.11);border-radius:10px;padding:11px 14px}" +
    ".fo-kpi span{display:block;color:#9fb0c4;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}" +
    ".fo-kpi b{color:#fff;font-size:22px;font-weight:800}" +
    ".fo-scout-shell{display:flex;gap:14px;align-items:flex-start}" +
    ".fo-scout-links{flex:0 0 148px;background:" + NAVY2 + ";border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(7,22,46,.12)}" +
    "#page .fo-scout-links a,.fo-scout-links a{display:block;padding:11px 15px;color:#d7dbe2 !important;font-size:13px;cursor:pointer;border-bottom:1px solid rgba(246,244,238,.07)}" +
    ".fo-scout-links a:hover{background:rgba(255,255,255,.05)}" +
    "#page .fo-scout-links a.on,.fo-scout-links a.on{background:" + TERRA + ";color:#fff !important;font-weight:700}" +
    // scout: FTP-style player rows + overview extras
    ".fo-sp{padding:11px 2px;border-bottom:1px solid #f0ece1}.fo-sp:last-child{border-bottom:none}" +
    ".fo-sp-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
    ".fo-sp-flag{font-size:15px;line-height:1}" +
    "#page a.fo-sp-nm{font-weight:800;font-size:14.5px;color:#111827 !important;text-decoration:none}" +
    "#page a.fo-sp-nm:hover{color:#C95532 !important}" +
    ".fo-sp-rt{margin-left:auto;font-weight:800;font-variant-numeric:tabular-nums;color:#111827}" +
    ".fo-sp-rt i{font-style:normal;font-weight:600;font-size:10px;color:#9a9484;margin-left:4px;text-transform:uppercase;letter-spacing:.06em}" +
    ".fo-sp-meta{font-size:12px;color:#6b7280;margin-top:3px}" +
    ".fo-sp-tals{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}" +
    ".fo-sp-words{font-size:11.5px;color:#667085;margin-top:5px}" +
    ".fo-sp-word b{font-weight:700}.fo-sp-dot{font-style:normal;margin:0 6px;color:#c9c3b4}" +
    ".fo-q-hi{color:#15803D}.fo-q-mid{color:#7a5a14}.fo-q-lo{color:#DC2626}" +
    ".fo-sc2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}" +
    "@media(max-width:700px){.fo-sc2{grid-template-columns:1fr}}" +
    ".fo-h2h{display:flex;align-items:center;gap:12px;font-size:13px;margin-bottom:8px}" +
    ".fo-h2h b{font-size:20px;font-weight:800;margin-right:5px}.fo-h2h i{font-style:normal;color:#9a9484}" +
    ".fo-sc-leaders{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".fo-sc-leaders ul{margin:0;padding-left:2px;list-style:none}.fo-sc-leaders li{padding:3px 0;font-size:12.5px}" +
    ".fo-sc-leaders li b{margin-left:4px}" +
    ".fo-sc-lh{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#667085;margin-bottom:4px}" +
    ".fo-scout-hero-r{display:flex;flex-direction:column;align-items:flex-end;gap:10px;min-width:0;flex:1 1 400px;max-width:620px}" +
    ".fo-scout-hero-r .fo-scout-kpis{display:grid !important;grid-template-columns:repeat(2,minmax(170px,1fr));gap:10px;width:100%;flex:0 0 auto}" +
    "@media(max-width:900px){.fo-scout-hero-r{align-items:stretch;width:100%}.fo-scout-hero-r .fo-scout-kpis{grid-template-columns:1fr 1fr}.fo-face-chip{text-align:center}}" +
    ".fo-face-chip{background:#F6E3B4;color:#5a4310;border:1px solid #e8cf8c;border-radius:10px;padding:8px 14px;font-size:12.5px;font-weight:800}" +
    ".fo-kpi i{display:block;font-style:normal;font-size:10.5px;color:#aab3c0;margin-top:2px}" +
    ".fo-rel-up{color:#e8a598 !important}.fo-rel-dn{color:#9fd3b4 !important}" +
    ".fo-sc-notes{border:1px solid #cfd9e8 !important;background:#f8fafd}" +
    ".fo-sc-note{font-size:13px;line-height:1.55;color:#2b3648;padding:3px 0}" +
    ".fo-threat{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-threat:last-child{border-bottom:none}" +
    ".fo-tag{flex:none;font-size:10.5px;font-weight:800;padding:3px 10px;border-radius:999px}" +
    ".fo-tag-hot{background:#fbe3e0;color:#DC2626}.fo-tag-strike{background:#f9d9d3;color:#8f2b1d}.fo-tag-watch{background:#efece2;color:#6b6455}" +
    ".fo-sc-merow td{background:#fdf3e2 !important;font-weight:700}" +
    ".fo-sc-you{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#C95532;margin-left:6px}" +
    ".fo-scout-body{flex:1 1 auto;min-width:0}" +
    ".fo-sortbar{margin-bottom:6px}.fo-sortbar a{cursor:pointer;color:" + TERRA2 + "}.fo-sortbar a.on{font-weight:700;text-decoration:underline}" +
    "@media(max-width:640px){.fo-scout-hero{padding:18px}.fo-scout-name{font-size:26px}.fo-scout-kpis{flex:1 1 100%;grid-template-columns:repeat(2,1fr)}.fo-scout-shell{flex-direction:column}.fo-scout-links{flex:none;width:100%;display:flex}.fo-scout-links a{flex:1;text-align:center;border-bottom:none}}" +
    ".fo-fx-fr{background:linear-gradient(90deg,rgba(77,166,162,.08),transparent)}" +
    ".fo-fr-play{font-size:12px;padding:5px 12px;border:1px solid " + TEAL + ";background:" + TEAL + ";color:#fff;border-radius:6px;cursor:pointer;white-space:nowrap}" +
    ".fo-fr-play:hover{background:#3f8a86}" +
    ".fo-fr-x{margin-left:6px;font-size:11px;padding:5px 8px;border:1px solid #d8d2c4;background:#FFFEFC;color:#667085;border-radius:6px;cursor:pointer}" +
    ".fo-fr-x:hover{background:#f2eee4}" +
    // practice setup / break modal
    ".fo-modal{position:fixed;inset:0;z-index:99999;background:rgba(7,22,46,.62);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".fo-modal-card{background:" + PAPER + ";color:#1b2433;border-radius:14px;padding:22px 24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.4)}" +
    ".fo-modal-card h3{margin:2px 0 14px;font-size:21px;color:#111827}" +
    ".fo-modal-eyebrow{color:" + TERRA + ";font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}" +
    ".fo-modal-card label{display:block;font-size:12px;font-weight:600;color:#5b6472;margin:0 0 10px}" +
    ".fo-modal-card label select{display:block;width:100%;margin-top:4px;padding:9px 10px;border:1px solid #cdc7b8;border-radius:8px;background:#FFFEFC;font-size:14px}" +
    ".fo-modal-act{display:flex;gap:10px;margin-top:8px}" +
    ".fo-modal-act .primary{flex:1;background:" + TERRA + ";color:#fff;border:none;padding:11px;border-radius:9px;font-weight:700;cursor:pointer;font-size:14px}" +
    ".fo-modal-act .primary:hover{background:" + TERRA2 + "}" +
    ".fo-modal-act .fo-su-cancel{background:transparent;border:1px solid #cdc7b8;color:#5b6472;padding:11px 16px;border-radius:9px;cursor:pointer}" +
    ".fo-break-card{text-align:center}.fo-break-cond{color:#5b6472;font-size:13px;margin-bottom:6px}" +
    ".fo-break-clock{font-size:46px;font-weight:800;color:#111827;font-variant-numeric:tabular-nums;margin:6px 0 10px;letter-spacing:1px}" +
    // ---- global app shell polish ----
    "html body.ftpskin,body{background:#F1EEE6 !important}" +
    "html body.ftpskin .wrap,.wrap,#page{background:transparent !important}" +
    "html body.ftpskin,body,#page,.panel,.card,button,select,input,h1,h2,h3,h4{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}" +
    // nav: muted inactive, terracotta-underline active (not a full pill)
    "html body.ftpskin #topbar a,#topbar a{color:rgba(246,244,238,.72)}" +
    "html body.ftpskin #topbar a:hover,#topbar a:hover{color:#FFFEFC;background:rgba(246,244,238,.06) !important}" +
    "html body.ftpskin #topbar a.on,#topbar a.on{background:transparent !important;color:#fff !important;box-shadow:inset 0 -3px 0 " + TERRA + " !important}" +
    // Week / Bank / Next → compact status chips
    "#fo-top-status{gap:8px !important;padding:0 4px !important}" +
    "#fo-top-status span{border-left:none !important;background:rgba(246,244,238,.07);border:1px solid rgba(246,244,238,.14);border-radius:9px;padding:6px 11px !important;color:#e9eef2;font-size:11.5px;white-space:nowrap}" +
    // ---- premium Club dashboard ----
    ".fo-ch{max-width:1240px;margin:0 auto;padding:2px 2px 24px}" +
    ".fo-ch-crumb{color:#6b7280;font-size:13px;margin:6px 0 12px}.fo-ch-crumb span{color:#c0bbb0;margin:0 3px}" +
    ".fo-ch-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;background:linear-gradient(135deg,#07162E,#0E233F);border-radius:16px;padding:22px 26px;box-shadow:0 8px 24px rgba(7,22,46,.18)}" +
    ".fo-ch-hero-r{display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:flex-end;flex:0 0 auto}" +
    ".fo-ch-hero-l{display:flex;gap:18px;align-items:center;min-width:0}" +
    ".fo-ch-crest{width:74px;height:74px;border-radius:14px;background:" + PAPER + ";display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 4px 12px rgba(0,0,0,.2)}" +
    ".fo-ch-crest img{width:56px;height:56px;object-fit:contain;border-radius:8px}" +
    ".fo-ch-eyebrow{color:#E8845C;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}" +
    ".fo-ch-name{color:#fff;font-size:34px;font-weight:800;margin:2px 0 10px;letter-spacing:-.5px;line-height:1}" +
    ".fo-ch-chips{display:flex;gap:8px;flex-wrap:wrap}" +
    ".fo-ch-chip{background:rgba(246,244,238,.08);border:1px solid rgba(246,244,238,.14);color:#d7dbe2;font-size:12px;padding:5px 11px;border-radius:8px}" +
    ".fo-hero-pill{background:rgba(246,244,238,.1);border:1px solid rgba(246,244,238,.2);color:#FFFEFC;font-size:12.5px;padding:8px 14px;border-radius:999px;white-space:nowrap}" +
    ".fo-hero-pill .fo-form{margin-left:6px}" +
    ".fo-ch-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:16px 0}" +
    ".fo-stat{position:relative;display:flex;gap:12px;align-items:center;background:#FFFEFC;border:1px solid rgba(7,22,46,.08);border-radius:14px;padding:15px 16px;box-shadow:0 8px 24px rgba(7,22,46,.06);overflow:hidden}" +
    ".fo-stat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}" +
    ".fo-acc-terra::before{background:" + TERRA + "}.fo-acc-teal::before{background:" + TEAL + "}" +
    ".fo-stat-ic{width:44px;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:19px;background:rgba(200,103,74,.1);flex:none}" +
    ".fo-acc-teal .fo-stat-ic{background:rgba(77,166,162,.12)}" +
    ".fo-stat-l{font-size:10.5px;color:#667085;text-transform:uppercase;letter-spacing:.04em;font-weight:700}" +
    ".fo-stat-v{font-size:clamp(16px,1.4vw,25px);font-weight:800;color:#111827;line-height:1.15;white-space:nowrap}" +
    ".fo-stat>div:last-child{min-width:0}" +
    ".fo-news li.fo-rowlink{cursor:pointer;border-radius:8px;padding:4px 6px;margin:0 -6px}" +
    ".fo-news li.fo-rowlink:hover{background:#EEEAE1}.fo-news li.fo-rowlink:hover .fo-news-h{color:#C95532}" +
    ".fo-sp-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;margin-top:9px}" +
    ".fo-sp-choose{text-align:left;background:#FFFEFC;border:1px solid rgba(7,22,46,.15);border-radius:11px;padding:10px 12px;cursor:pointer}" +
    ".fo-sp-choose:hover{border-color:#C95532}" +
    ".fo-sp-choose b{display:block;font-size:14px;color:#111827}" +
    ".fo-sp-choose span{display:block;font-size:11.5px;color:#6b7280;margin-top:3px}" +
    ".fo-stat-s{font-size:11px;color:#9a9484;margin-top:1px}" +
    ".fo-ch-grid{display:grid;grid-template-columns:1.42fr 1fr;gap:16px}" +
    ".fo-ch-col{display:flex;flex-direction:column;gap:16px;min-width:0}" +
    ".fo-ch-min{max-width:860px;margin:0 auto}" +
    ".fo-ch-min .fo-card{margin-top:16px}" +
    ".fo-search{position:relative;margin:0 0 12px auto;max-width:330px}" +
    ".fo-search input{width:100%;box-sizing:border-box;font-size:14px;padding:9px 16px;border-radius:999px;border:1px solid #DDD8CF;background:#FFFEFC;box-shadow:0 2px 10px rgba(18,32,58,.05);outline:none}" +
    "@media(max-width:820px){.fo-search{max-width:none;margin:0 0 8px}.fo-search input{font-size:16px;padding:7px 14px;border-radius:11px}}" +
    ".fo-search input:focus{border-color:#C95532;box-shadow:0 0 0 3px rgba(201,85,50,.14)}" +
    ".fo-search-drop{display:none;position:absolute;left:0;right:0;top:calc(100% + 6px);background:#FFFEFC;border:1px solid #DDD8CF;border-radius:14px;box-shadow:0 14px 36px rgba(18,32,58,.16);z-index:70;overflow:hidden}" +
    ".fo-search-row{display:flex;gap:10px;align-items:baseline;padding:10px 14px;border-bottom:1px solid #f0ece1;cursor:pointer;font-size:13.5px}" +
    ".fo-search-row:last-child{border-bottom:none}.fo-search-row:hover{background:#EEEAE1}" +
    ".fo-search-row b{color:#111827}.fo-search-row .fo-sr-team{margin-left:auto;color:#667085;font-size:12px}" +
    ".fo-ch-quick{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 6px}" +
    ".fo-ch-quick a{font-size:12px;font-weight:700;color:#667085;background:#FFFEFC;border:1px solid #DDD8CF;border-radius:999px;padding:6px 13px;text-decoration:none}" +
    ".fo-ch-quick a:hover{color:#111827;border-color:#cfc9ba}" +
    ".fo-chal-chip{display:inline-flex;gap:6px;align-items:baseline;margin:12px 0 0;background:#fdf3e2;border:1px solid #ecd28f;color:#6a4800;border-radius:999px;padding:7px 14px;font-size:12.5px;text-decoration:none;font-weight:600}" +
    ".fo-intro-now{padding:10px 12px;background:#faf6ea;border-left:3px solid #F59E0B;font-size:12.5px;line-height:1.6;color:#3c4658}" +
    ".fo-lk{cursor:pointer}" +
    ".fo-lk:hover{color:#B04A2C;text-decoration:underline;text-underline-offset:3px}" +
    ".fo-dot{display:inline-block;width:8px;height:8px;border-radius:99px;vertical-align:0}" +
    ".fo-dot-on{background:#16A34A;box-shadow:0 0 0 2px rgba(62,153,96,.25)}.fo-dot-off{background:#8a93a3}" +
    ".fo-bot-chip{font-size:10px;font-weight:800;letter-spacing:.07em;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:2px 8px;color:#c7cfda;vertical-align:1px}" +
    ".fo-bot-mini{font-size:9px;font-weight:800;color:#667085;border:1px solid #d8d2c2;border-radius:6px;padding:0 4px;margin-left:4px;vertical-align:1px}" +
    "#fo-bell{position:relative;display:inline-flex;align-items:center;color:#dfe5ec;cursor:pointer;padding:6px;margin:0 2px;border-radius:9px}" +
    "#fo-bell:hover{background:rgba(246,244,238,.1)}" +
    "#fo-bell i{position:absolute;top:0;right:-2px;background:#C95532;color:#fff;font-style:normal;font-size:9.5px;font-weight:800;min-width:15px;height:15px;border-radius:99px;align-items:center;justify-content:center;display:inline-flex;padding:0 3px}" +
    "#fo-bell-panel{position:fixed;top:52px;right:12px;z-index:200000;background:#FFFEFC;border:1px solid #DDD8CF;border-radius:14px;box-shadow:0 18px 44px rgba(18,32,58,.22);width:min(340px,92vw);overflow:hidden}" +
    ".fo-bell-h{background:#07162E;color:#FFFEFC;font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;padding:10px 14px}" +
    ".fo-bell-row{padding:11px 14px;border-bottom:1px solid #f0ece1;font-size:13px;color:#3c4658;cursor:pointer}" +
    ".fo-bell-act{margin-top:7px;display:flex;gap:8px}" +
    "html body button.fo-watch-live{display:inline-flex;align-items:center;gap:10px;border:0;border-radius:999px;padding:13px 26px 13px 15px;font-weight:800;font-size:14.5px;letter-spacing:.01em;cursor:pointer;background:#B3362C !important;color:#fff !important;box-shadow:0 3px 10px rgba(179,54,44,.25)}" +
    "html body button.fo-watch-live:hover{background:#9E2F26 !important;transform:translateY(-1px)}" +
    ".fo-watch-live .fo-play{width:28px;height:28px;border-radius:99px;background:rgba(255,255,255,.25);display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}" +
    ".fo-watch-live .fo-play svg{margin-left:2px}" +
    "@keyframes foPulseRed{0%,100%{box-shadow:0 6px 20px rgba(255,0,0,.38)}50%{box-shadow:0 6px 30px rgba(255,0,0,.62)}}" +
    "@media(max-width:820px){html body button.fo-watch-live{width:100%;justify-content:center}}" +
    ".fo-mhead{display:flex;gap:22px;align-items:stretch;background:linear-gradient(135deg,#0E233F,#07162E 62%);border-radius:16px;padding:20px 22px;margin:8px 0 14px;color:#c7cfda}" +
    ".fo-mh-l{flex:1 1 auto;min-width:0}" +
    ".fo-mh-eyebrow{font-size:9.5px;font-weight:800;letter-spacing:.09em;color:#ff8a7a;text-transform:uppercase;margin-bottom:9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}" +
    ".fo-mh-cnd{display:inline-flex;gap:5px;margin-left:2px}" +
    ".fo-mh-ic{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:8px;background:rgba(246,244,238,.08);border:1px solid rgba(246,244,238,.14);color:#c7cfda}" +
    ".fo-mh-toss{margin-top:5px;font-size:11.5px;color:#93a0b4}" +
    ".fo-mh-team{display:flex;align-items:baseline;gap:8px;padding:3px 0;color:#93a0b4;font-size:17px}" +
    ".fo-mh-team .fo-mh-nm{font-weight:800}" +
    ".fo-mh-team.win{color:#fff}" +
    ".fo-mh-ov{font-size:12px;color:#93a0b4}" +
    ".fo-mh-sc{margin-left:auto;font-weight:800;font-size:19px;font-variant-numeric:tabular-nums}" +
    ".fo-mh-res{margin-top:9px;font-weight:800;color:#E8A87C;font-size:14.5px}" +
    ".fo-mh-r{flex:0 0 230px;border-left:1px solid rgba(246,244,238,.14);padding-left:20px;display:flex;flex-direction:column;justify-content:center;gap:3px}" +
    ".fo-mh-k{font-size:10px;font-weight:800;letter-spacing:.08em;color:#93a0b4;text-transform:uppercase}" +
    "html body #page .fo-mh-pn a,html body .fo-mh-pn a{font-weight:800;font-size:15px;color:#F59E0B !important;text-decoration:none}" +
    "html body #page .fo-mh-pn a:hover,html body .fo-mh-pn a:hover{color:#FBBF24 !important}" +
    ".fo-mh-pt{font-size:12.5px;color:#93a0b4}" +
    ".fo-mh-pf{font-size:13px;color:#c7cfda;font-weight:600}" +
    "@media(max-width:820px){.fo-mhead{flex-direction:column;gap:10px;padding:16px 16px}.fo-mh-r{flex:0 0 auto;border-left:0;border-top:1px solid rgba(246,244,238,.14);padding:12px 0 0}.fo-mh-team{font-size:14.5px}.fo-mh-sc{font-size:16px}.fo-mh-res{font-size:12.5px;margin-top:7px}.fo-mh-eyebrow{font-size:8.5px}.fo-mh-toss{font-size:10.5px}html body #page .fo-mh-pn a,html body .fo-mh-pn a{font-size:13.5px}.fo-mh-pf{font-size:12px}}" +
    "/* ---- training: energy, cards on phones ---- */" +
    ".fo-en{display:flex;align-items:center;gap:7px;min-width:96px}" +
    ".fo-en-bar{flex:1;height:7px;background:#EBE6DA;border-radius:99px;overflow:hidden;min-width:44px}" +
    ".fo-en-bar u{display:block;height:100%;border-radius:99px;text-decoration:none}" +
    ".fo-en-fresh{background:#16A34A}.fo-en-rested{background:#84B34A}.fo-en-tired{background:#F59E0B}" +
    ".fo-en-w{font-size:11px;font-weight:700;text-transform:capitalize}" +
    ".fo-en-k{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#667085;flex:0 0 auto}" +
    ".fo-en-w-fresh{color:#15803D}.fo-en-w-rested{color:#6B8F3A}.fo-en-w-tired{color:#B45309}" +
    ".fo-tr-pace{font-style:normal;color:#667085}" +
    ".fo-seen{font-size:11px;color:#93a0b4}" +
    "html body #page .fo-scout-links a.fo-stab,#page .fo-scout-links a.fo-stab{color:#3c4658 !important;font-weight:700}" +
    "html body #page .fo-scout-links a.fo-stab.on,#page .fo-scout-links a.fo-stab.on{color:#FFFEFC !important}" +
    ".fo-tr-rep .fo-tr-g.fo-tr-warn,.fo-tr-warn{color:#B45309 !important}" +
    ".fo-tr-rep .fo-tr-g.fo-tr-warn svg{color:#B45309}" +
    ".fo-tr-how{background:transparent;border:1px solid #DDD8CF;border-radius:999px;padding:8px 15px;font-weight:700;font-size:12.5px;color:#3c4658;cursor:pointer}" +
    ".fo-tr-how:hover{border-color:#C95532;color:#B04A2C}" +
    ".fo-trc-list{display:none}" +
    ".fo-trc{background:#FFFEFC;border:1px solid #E4DFD2;border-radius:13px;padding:13px 14px;margin-bottom:10px}" +
    ".fo-trc-h{display:flex;align-items:baseline;gap:8px;margin-bottom:7px}" +
    ".fo-trc-h a{font-size:14.5px;color:#111827 !important;text-decoration:none}" +
    ".fo-trc-warn{margin:7px 0 2px;font-size:11.5px;color:#B45309;background:#FDF3E2;border-radius:8px;padding:6px 9px}" +
    ".fo-trc-row{display:grid;grid-template-columns:1.5fr 1fr;gap:9px;margin:9px 0 7px}" +
    ".fo-trc-row.fo-trc-one{grid-template-columns:1fr}" +
    ".fo-trc-row label{display:flex;flex-direction:column;gap:3px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#667085}" +
    "html body .fo-trc-row select,html body.ftpskin .fo-trc-row select{width:125%;padding:7px 8px;border:1px solid #cdc7b8;border-radius:11px;background:#FFFEFC;transform:scale(.8);transform-origin:left top;margin-bottom:-9px}" +
    ".fo-trc-ws{display:flex;flex-wrap:wrap;gap:6px 12px;margin:2px 0 8px}" +
    ".fo-trc-w{font-size:11px;color:#3c4658;display:inline-flex;align-items:center;gap:5px}" +
    ".fo-trc-w u{width:9px;height:9px;border-radius:3px;display:inline-block}" +
    "@media(max-width:600px){.fo-tr-tbl{display:none}.fo-trc-list{display:block}}" +
    "/* ---- club home, remade ---- */" +
    "html body .fo-ch-hero.fo-ch-hero,html body.ftpskin .fo-ch-hero.fo-ch-hero{display:block;position:relative;overflow:hidden;background:radial-gradient(130% 170% at 88% -30%,#1B3A5F 0%,rgba(27,58,95,0) 55%),linear-gradient(135deg,#0E233F,#07162E 70%) !important;border-radius:18px;padding:24px 24px 16px;box-shadow:0 12px 32px rgba(7,22,46,.22)}" +
    "html body .fo-ch-hero-l.fo-ch-hero-l,html body.ftpskin .fo-ch-hero-l.fo-ch-hero-l,html body .fo-ch-hero-top.fo-ch-hero-top,html body.ftpskin .fo-ch-hero-top.fo-ch-hero-top,html body .fo-hero-pos.fo-hero-pos,html body.ftpskin .fo-hero-pos.fo-hero-pos,html body .fo-hero-prog.fo-hero-prog,html body.ftpskin .fo-hero-prog.fo-hero-prog,html body .fo-hero-hot.fo-hero-hot,html body.ftpskin .fo-hero-hot.fo-hero-hot{background:none !important}" +
    "html body .fo-ch-hero::after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(246,244,238,.024) 0 2px,transparent 2px 16px);pointer-events:none;border-radius:18px}" +
    ".fo-ch-hero-top{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;position:relative;z-index:1}" +
    "html body .fo-ch-crest{box-shadow:0 6px 18px rgba(0,0,0,.35),0 0 0 3px rgba(246,244,238,.1)}" +
    "html body .fo-ch-name{letter-spacing:-.6px}" +
    ".fo-hero-pos{color:#F59E0B;font-weight:800;font-size:12px;letter-spacing:.07em;text-transform:uppercase;margin:3px 0 9px}" +
    ".fo-hero-hot{color:#7CC5C1;font-weight:700}" +
    "html body .fo-ch-chip{background:rgba(246,244,238,.07);border:1px solid rgba(246,244,238,.14);border-radius:999px}" +
    "@media(max-width:820px){html body .fo-ch-hero-top{flex-direction:column;align-items:flex-start;gap:12px}.fo-ch-hero-r{display:flex;gap:8px;flex-wrap:wrap}}" +
    ".fo-hero-prog{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#93a0b4;position:relative;z-index:1}" +
    ".fo-hero-prog .fo-progress-bar{flex:1;height:6px;background:rgba(246,244,238,.12);border-radius:99px;overflow:hidden}" +
    ".fo-hero-prog u{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#C95532,#F59E0B);text-decoration:none}" +
    "html body .fo-next{position:relative;overflow:hidden}" +
    "html body .fo-next::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#C95532,#F59E0B)}" +
    "html body .fo-stat{transition:transform .14s ease,box-shadow .14s ease}" +
    "html body .fo-stat:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(7,22,46,.1)}" +
    ".fo-ch-cols{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:14px;align-items:start;margin-top:2px}" +
    ".fo-ch-mainc>.fo-card,.fo-ch-sidec>.fo-card,.fo-ch-sidec .fo-ch-leaders{margin-top:0}" +
    ".fo-ch-mainc{display:flex;flex-direction:column;gap:14px}" +
    ".fo-ch-sidec{display:flex;flex-direction:column;gap:14px}" +
    "@media(max-width:900px){.fo-ch-cols{grid-template-columns:1fr}}" +
    // cap the dashboard with slack to spare: laptops at 125% OS scaling see a
    // ~1530px CSS viewport, and a 1520px cap left the right edge shaved off
    "html body .wrap:has(.fo-ch-min){max-width:1400px !important;width:calc(100% - 48px)}" +
    "html body #page:has(.fo-ch-min){max-width:1400px !important;padding:4px 0 28px}" +
    "html body .fo-ch.fo-ch-min{max-width:1360px !important;width:100%;margin:0 auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}" +
    "html body #topbar a{padding:15px 13px !important;font-size:13.5px !important}" +
    "@media(max-width:1700px){html body #topbar a{padding:15px 10px !important;font-size:13px !important}#fo-clock{display:none !important}}" +
    "html body:has(.fo-ch-min){background:#f4f1ea !important}" +
    ".fo-ch-min .fo-card{background:#fff;border-radius:12px;border:1px solid rgba(20,36,58,.10);box-shadow:0 4px 14px rgba(20,36,58,.06);display:flex;flex-direction:column}" +
    ".fo-ch-min .fo-card>.fo-card-b{flex:1}" +
    ".fo-ch-min .fo-card-h2{font-size:15.5px;font-weight:700}" +
    ".fo-ch-min .fo-card-h2row{align-items:center;padding:14px 16px 4px}" +
    ".fo-ch-min .fo-card>.fo-card-b{padding:4px 16px 14px}" +
    ".fo-ch-min .fo-chtable{width:100%;table-layout:fixed}" +
    ".fo-ch-min .fo-chtable td{font-size:13px;padding:6px 4px;font-variant-numeric:tabular-nums}.fo-ch-min .fo-chtable th{font-size:10.5px;padding:6px 4px}" +
    ".fo-ch-min .fo-chtable td:nth-child(2),.fo-ch-min .fo-chtable th:nth-child(2){width:auto;white-space:normal;overflow-wrap:anywhere;line-height:1.25}" +
    ".fo-ch-min .fo-chtable td:first-child,.fo-ch-min .fo-chtable th:first-child{width:24px}" +
    ".fo-ch-min .fo-chtable td:nth-child(3),.fo-ch-min .fo-chtable th:nth-child(3),.fo-ch-min .fo-chtable td:nth-child(4),.fo-ch-min .fo-chtable th:nth-child(4),.fo-ch-min .fo-chtable td:nth-child(5),.fo-ch-min .fo-chtable th:nth-child(5){width:19px;text-align:right}" +
    ".fo-ch-min .fo-chtable td:nth-child(6),.fo-ch-min .fo-chtable th:nth-child(6){width:46px;text-align:right}" +
    ".fo-ch-min .fo-chtable td:nth-child(7),.fo-ch-min .fo-chtable th:nth-child(7){width:34px;text-align:right}" +
    ".fo-nr-row b{color:#0a2342;font-weight:700}" +
    ".fo-flg{margin-right:5px;font-style:normal;display:inline-block}" +
    ".fo-cond-sym{display:inline-flex;vertical-align:-2px;margin:0 1px}" +
    // talent call-outs in commentary: a quiet inline highlight that flows
    // with the sentence, never a boxed pill that breaks the line
    "html body .talent-hit,html body.ftpskin .talent-hit{display:inline !important;font:inherit !important;font-weight:700 !important;background:rgba(245,158,11,.18) !important;border:0 !important;border-bottom:1px solid #d9b75a !important;border-radius:2px !important;padding:0 3px !important;margin:0 !important;box-shadow:none !important;color:inherit !important;white-space:normal !important;line-height:inherit !important}" +
    ".fo-tclub{display:block;font-size:10.5px;color:#8a93a3;margin-top:1px;line-height:1.2}" +
    ".fo-emb-cell{font-size:12px;font-weight:700;color:#B04A2C}" +
    ".fo-pv-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}" +
    "@media(max-width:700px){.fo-pv-grid{grid-template-columns:1fr}}" +
    ".fo-pv-team{background:#FFFEFC;border:1px solid rgba(20,36,58,.1);border-radius:12px;padding:13px 15px}" +
    ".fo-pv-team>b{font-size:16px;color:#0E233F}" +
    ".fo-pv-pos{font-size:12.5px;color:#5a6472;margin:2px 0 4px;font-weight:600}" +
    ".fo-pv-k{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#8a93a3;margin:9px 0 2px}" +
    ".fo-pv-p{font-size:13px;color:#0E233F;font-weight:700}.fo-pv-p span{font-weight:600;color:#5a6472}" +
    ".fo-pv-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}" +
    "@media(max-width:700px){.fo-pv-cols{grid-template-columns:1fr}}" +
    ".fo-pv-cdw{margin-top:12px;display:flex;align-items:baseline;gap:10px}" +
    ".fo-pv-cdk{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#93a0b4}" +
    ".fo-pv-cd{font-size:22px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums}" +
    ".fo-pv-h2h{font-size:13px;color:#0E233F;padding:5px 0;border-bottom:1px solid #f0ece1}.fo-pv-h2h:last-child{border-bottom:none}.fo-pv-h2h span{color:#8a93a3;font-size:11px}" +
    ".fo-pv-fact{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:4px 0}.fo-pv-fact span{color:#5a6472}.fo-pv-fact b{color:#0E233F;text-align:right}" +
    "html body .fo-flg img{width:16px !important;height:11px !important;vertical-align:-1px;border-radius:2px;box-shadow:0 0 0 1px rgba(20,36,58,.12)}" +
    ".fo-c2-hero{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,.55fr) minmax(0,1.25fr);gap:24px;align-items:center;background:linear-gradient(135deg,#0a2342,#06182f 70%);border-radius:14px;padding:24px 26px;margin:8px 0 16px;color:#c7cfda}" +
    "@media(max-width:1100px){.fo-c2-hero{grid-template-columns:1fr 1fr}.fo-c2-id{grid-column:1/-1}}" +
    ".fo-c2-id{display:flex;gap:14px;align-items:flex-start;min-width:0}" +
    ".fo-c2-crest{flex:0 0 74px;width:74px;height:74px;border-radius:16px;background:#FFFEFC;display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.3)}" +
    ".fo-c2-crest img{width:62px;height:62px;border-radius:12px}" +
    ".fo-c2-idt{min-width:0}" +
    ".fo-c2-eyebrow{display:none}" +
    "html body #page .fo-c2-name{margin:0;font-size:40px;line-height:1;color:#FFFEFC;letter-spacing:-.5px;text-transform:uppercase;font-weight:800}" +
    ".fo-c2-meta{font-size:13px;color:#c7cfda;margin-top:7px}.fo-c2-meta u{text-decoration:none;color:#5a6b83;margin:0 2px}.fo-c2-meta .fo-c2-gold,.fo-c2-gold{color:#F5C36B;font-weight:800}" +
    "@media(max-width:700px){html body #page .fo-c2-name{font-size:31px !important}}" +
    ".fo-c2-mgr{font-size:12px;color:#9aa3b2;margin-top:3px}.fo-c2-mgr b{color:#FFFEFC}" +
    ".fo-c2-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
    ".fo-c2-chip{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:3px 11px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#dfe5ec}" +
    ".fo-c2-chip.gold{background:rgba(245,158,11,.16);border-color:rgba(245,158,11,.4);color:#F5C36B}" +
    ".fo-c2-frow{display:flex;gap:26px;margin-top:11px;flex-wrap:wrap}" +
    ".fo-o-ms .fo-race{margin:8px 0;grid-template-columns:minmax(0,1.15fr) minmax(52px,1fr) 58px;gap:8px;align-items:center}" +
    ".fo-o-ms .fo-race-l{min-width:0}" +
    ".fo-o-ms .fo-race-l b,.fo-o-ms .fo-race-l span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}" +
    ".fo-o-ms .fo-race-bar{height:8px;border-radius:4px}" +
    ".fo-o-ms .fo-race-bar i{background:linear-gradient(90deg,#4DA6A2,#2b6b68) !important}" +
    ".fo-o-ms .fo-race:first-of-type .fo-race-bar i{background:linear-gradient(90deg,#e85a2a,#c94c22) !important}" +
    ".fo-o-ms .fo-race-n{text-align:right;min-width:0;font-size:11px}" +
    "@media(max-width:760px){.fo-o-ms .fo-race{grid-template-columns:minmax(0,1.5fr) minmax(52px,1fr) auto;gap:7px}.fo-o-ms .fo-race-n{min-width:0;font-size:11px}}" +
    // desktop/phone content swaps: long copy on wide screens, short on phones
    ".fo-sw-m{display:none}" +
    ".fo-wgrp-m{display:none}" +
    ".fo-ch-min .fo-o-leadm{display:none}" +
    ".fo-c2-ndl{font-size:11px;color:#8a93a3;margin-top:2px}" +
    ".fo-c2-wmore{display:inline-flex;align-items:center;min-height:36px;margin-top:4px;font-size:12.5px;font-weight:700;color:#B04A2C !important;text-decoration:none}" +
    ".fo-c2-k{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#8a93a3;font-weight:800;margin-bottom:4px}" +
    ".fo-c2-fs{display:flex;gap:4px}" +
    ".fo-c2-f{display:inline-flex;width:20px;height:20px;border-radius:5px;align-items:center;justify-content:center;font-style:normal;font-size:10.5px;font-weight:800;color:#fff}" +
    ".fo-c2-f.w{background:#16A34A}.fo-c2-f.l{background:#C0392B}.fo-c2-f.t{background:#5a6472}" +
    ".fo-c2-mood{font-size:14px;color:#FFFEFC}.fo-c2-mood b{color:#F5C36B;letter-spacing:.04em}.fo-c2-mood span{color:#9aa3b2;font-size:12px}" +
    ".fo-mood-up,.fo-mood-dn{font-style:normal;font-size:11px}.fo-mood-up{color:#22C55E}.fo-mood-dn{color:#EF4444}" +
    ".fo-c2-dim{color:#8a93a3;font-size:12px}" +
    ".fo-c2-prog{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:13px 15px;align-self:center}" +
    ".fo-c2-pv{font-size:15px;font-weight:800;color:#FFFEFC;margin:1px 0 8px}" +
    ".fo-c2-prog .fo-progress-bar{margin:0 0 7px;height:10px;border-radius:99px;background:rgba(255,255,255,.14)}" +
    ".fo-c2-prog .fo-progress-bar u{display:block;height:100%;border-radius:99px;background:#e85a2a;transition:width .5s ease}" +
    ".fo-c2-ppct{font-size:11px;color:#9aa3b2;text-align:right}" +
    ".fo-c2-next{background:#FFFEFC;border-radius:12px;padding:18px 20px;display:flex;gap:16px;align-items:center;justify-content:space-between;box-shadow:0 8px 28px rgba(0,0,0,.3)}" +
    "@media(max-width:700px){.fo-c2-next{flex-direction:column;align-items:stretch}}" +
    ".fo-c2-nl{min-width:0}" +
    ".fo-c2-nk{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#B04A2C;font-weight:800;margin-bottom:3px}" +
    ".fo-c2-nopp{font-size:24px;font-weight:800;color:#0a2342;letter-spacing:-.3px}" +
    ".fo-c2-nsub{font-size:11.5px;color:#5a6472;margin-top:2px}" +
    ".fo-c2-nchips{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}" +
    ".fo-c2-nchip{background:#F3F1EA;border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:700;color:#41577a}" +
    ".fo-c2-nr{flex:0 0 auto;text-align:right;display:flex;flex-direction:column;gap:3px;align-items:flex-end}" +
    "@media(max-width:700px){.fo-c2-nr{align-items:stretch;text-align:left}}" +
    ".fo-c2-cd{font-size:28px;font-weight:800;color:#0a2342;font-variant-numeric:tabular-nums;letter-spacing:.5px}" +
    // phones: the hero dissolves into three separate cards - identity (dark),
    // next match (white), season progress (white) - instead of one dark slab.
    // !important because the engine restyle paints [class*=hero] !important.
    "@media(max-width:700px){" +
    "html body #page .fo-c2-hero{grid-template-columns:1fr;padding:0;gap:12px;background:none !important;box-shadow:none;margin:8px 0 14px}" +
    "html body #page .fo-c2-id{position:relative;overflow:hidden;background:linear-gradient(135deg,#0E233F,#07162E 62%) !important;border-radius:14px;padding:22px 20px 22px 24px;box-shadow:0 10px 30px rgba(7,22,46,.25)}" +
    "html body #page .fo-c2-id::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(#C95532,#4DA6A2)}" +
    ".fo-c2-id .fo-c2-eyebrow{display:block;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#C95532;margin-bottom:7px}" +
    "html body #page .fo-c2-id .fo-c2-name{text-transform:none !important;letter-spacing:-.4px;line-height:1.08;font-weight:800}" +
    ".fo-c2-id .fo-c2-mgr{margin-top:6px;font-size:12.5px;color:#93a0b4}" +
    ".fo-c2-id .fo-c2-meta{margin-top:8px;color:#aeb9c9;line-height:1.55}" +
    ".fo-c2-id .fo-c2-frow{display:grid;grid-template-columns:auto minmax(0,1fr);gap:0 26px;align-items:start;margin-top:16px}" +
    ".fo-c2-id .fo-c2-mood{font-size:14px;white-space:nowrap}" +
    "html body #page .fo-c2-id .fo-c2-mgr{font-size:13px}" +
    "html body #page .fo-c2-id .fo-c2-meta{font-size:14px}" +
    "html body #page .fo-c2-id .fo-c2-mood{font-size:16px}" +
    "html body #page .fo-c2-id .fo-c2-f{width:24px;height:24px;font-size:12px}" +
    "html body #page .fo-c2-id .fo-c2-k{font-size:11.5px}" +
    "html body #page .fo-c2-next{order:2;border-radius:12px;border:1px solid rgba(20,36,58,.10);box-shadow:0 4px 14px rgba(20,36,58,.06)}" +
    "html body #page .fo-c2-prog{order:3;background:#fff !important;border:1px solid rgba(20,36,58,.10);border-radius:12px;padding:14px 16px;align-self:stretch}" +
    "html body #page .fo-c2-prog .fo-c2-k{color:#8a93a3}html body #page .fo-c2-prog .fo-c2-pv{color:#0a2342}" +
    "html body #page .fo-c2-prog .fo-progress-bar{background:#ece7db}html body #page .fo-c2-ppct{color:#667085}" +
    "}" +
    "html body #page .fo-c2-next .fo-next-cta{font-size:14px;padding:0 20px;min-width:150px;height:42px;box-sizing:border-box;margin-top:7px;display:inline-flex;align-items:center;justify-content:center;gap:6px}" +
    // the engine skin paints every button grey with !important; out-specify it
    "html body button.fo-next-cta,html body.ftpskin #page button.fo-next-cta{background:#e85a2a !important;border:0 !important;color:#fff !important;font:800 14px/1 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif !important}" +
    "html body button.fo-next-cta:hover,html body.ftpskin #page button.fo-next-cta:hover{background:#c94c22 !important}" +
    "html body button.fo-next-cta.fo-done,html body.ftpskin #page button.fo-next-cta.fo-done{background:#15803D !important;color:#fff !important}" +
    ".fo-c2-hero2{grid-template-columns:minmax(0,1.7fr) minmax(0,1fr)}" +
    // the Journey centerpiece: solo story first, the league one step below
    "html body #page .fo-home-j{display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:16px;align-items:center;background:linear-gradient(180deg,#FFFEFC,#FBF6E9);border:2px solid #C9A24B;border-radius:14px;padding:14px 18px 14px 14px;margin:0 0 14px;box-shadow:0 5px 0 rgba(16,27,45,.18);cursor:pointer}" +
    ".fo-home-j .fo-hj-map{position:relative;width:120px;height:96px;border-radius:10px;overflow:hidden;background:#0a1220}" +
    ".fo-home-j .fo-hj-map img{width:100%;height:100%;object-fit:cover}" +
    ".fo-home-j .fo-hj-reg{position:absolute;left:0;right:0;bottom:0;padding:3px 7px;font-family:Oswald,sans-serif;font-weight:600;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:#F3EEDF;background:linear-gradient(transparent,rgba(6,12,22,.85));text-align:left}" +
    ".fo-home-j .fo-hj-eyebrow{font-family:Oswald,sans-serif;font-weight:600;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:var(--cxc,#C8674A)}" +
    ".fo-home-j .fo-hj-opp{display:flex;align-items:center;gap:9px;font-size:16.5px;color:#101B2D;margin-top:4px}" +
    ".fo-home-j .fo-hj-opp b{font-weight:800}" +
    ".fo-home-j .fo-hj-opp img.bossy{width:34px;height:34px;border-radius:50%;object-fit:cover;object-position:50% 6%;border:2px solid var(--cxc,#C8674A);flex:0 0 34px}" +
    ".fo-home-j .fo-hj-quip{font-size:13px;color:#5b6472;font-style:italic;margin-top:4px}" +
    ".fo-home-j .fo-hj-story{font-size:12.5px;color:#8a7b4f;margin-top:7px;padding-top:7px;border-top:1px dashed rgba(201,162,75,.5)}" +
    ".fo-home-j .fo-hj-story a{color:#C8674A}" +
    ".fo-home-j .fo-hj-side{display:flex;flex-direction:column;align-items:center;gap:9px}" +
    ".fo-home-j .fo-hj-tr{font-family:Oswald,sans-serif;font-weight:600;font-size:13px;letter-spacing:1px;color:#8a7b4f;white-space:nowrap}" +
    "html body button.fo-hj-cta,html body.ftpskin #page button.fo-hj-cta{background:#C8674A !important;border:0 !important;color:#FDFAF1 !important;font-family:Oswald,sans-serif !important;font-weight:600 !important;letter-spacing:2px;text-transform:uppercase;font-size:13.5px;border-radius:10px;padding:10px 18px;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18);white-space:nowrap}" +
    "html body button.fo-hj-cta:hover,html body.ftpskin #page button.fo-hj-cta:hover{background:#B5563B !important}" +
    "@media(max-width:700px){html body #page .fo-home-j{grid-template-columns:88px minmax(0,1fr)}.fo-home-j .fo-hj-map{width:88px;height:78px}.fo-home-j .fo-hj-side{grid-column:1/-1;flex-direction:row;justify-content:space-between;width:100%}}" +
    // the league card slims down to a side strip
    "html body #page .fo-c2-next{padding:12px 16px;box-shadow:0 3px 12px rgba(20,36,58,.08);border:1px solid rgba(20,36,58,.10);margin-bottom:2px}" +
    "html body #page .fo-c2-next .fo-c2-nopp{font-size:16px}" +
    "html body #page .fo-c2-next .fo-c2-cd{font-size:20px}" +
    ".fo-c2-grid{display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr;gap:18px;align-items:stretch;margin-top:16px}" +
    ".fo-c2-bottom{display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr;gap:18px;align-items:stretch;margin-top:18px}" +
    "@media(max-width:1250px){.fo-c2-grid,.fo-c2-bottom{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    "@media(max-width:760px){.fo-c2-grid,.fo-c2-bottom{grid-template-columns:1fr;gap:14px}" +
    ".fo-o-watch{order:1}.fo-o-stand{order:2}.fo-o-fx{order:3}.fo-o-news{order:4}" +
    // phone content swaps: short labels, attention-only squad watch, combined
    // leaders card, three fixtures, one featured + three headlines
    ".fo-sw-d{display:none}.fo-sw-m{display:inline}" +
    ".fo-wgrp-d{display:none}.fo-wgrp-m{display:block}" +
    ".fo-ch-min .fo-o-lead{display:none}.fo-ch-min .fo-o-leadm{display:flex}" +
    ".fo-fx-more{display:none}" +
    ".fo-o-news .fo-nr-row:last-child{display:none}" +
    // standings shed P/W/L on phones; the full table lives on Matches
    ".fo-ch-min .fo-chtable td:nth-child(3),.fo-ch-min .fo-chtable th:nth-child(3),.fo-ch-min .fo-chtable td:nth-child(4),.fo-ch-min .fo-chtable th:nth-child(4),.fo-ch-min .fo-chtable td:nth-child(5),.fo-ch-min .fo-chtable th:nth-child(5){display:none}" +
    ".fo-ch-min .fo-chtable td:nth-child(6),.fo-ch-min .fo-chtable th:nth-child(6){width:58px}" +
    ".fo-ch-min .fo-chtable td:nth-child(7),.fo-ch-min .fo-chtable th:nth-child(7){width:40px}" +
    ".fo-ch-min .fo-chtable td{font-size:13px;padding:8px 4px}" +
    ".fo-ch-min .fo-chtable tr.fo-st-x{display:none}" +
    // phone type floor: nothing under 11px, body copy at 13px, 44px tap targets
    ".fo-c2-k,.fo-c2-nk,.fo-c2-whead,.fo-c2-wtag,.fo-c2-ppct,.fo-c2-ndl{font-size:11px}" +
    ".fo-c2-meta,.fo-c2-nsub,.fo-nr-row{font-size:13px}" +
    ".fo-c2-fxd b,.fo-c2-fxm b,.fo-c2-wrn b{font-size:13px}" +
    ".fo-c2-fxd span,.fo-c2-fxm span,.fo-c2-wrn span,.fo-nr-feat span,.fo-c2-wpct,.fo-nr-row u,.fo-nr-row i,.fo-nr-feat i{font-size:11px}" +
    ".fo-c2-fxn{font-size:10px}.fo-c2-nchip{font-size:11px}.fo-c2-wk{font-size:12px}" +
    ".fo-c2-ldk{font-size:13px}.fo-c2-ldr{font-size:12px}" +
    "html body #page .fo-c2-next .fo-next-cta{height:44px;width:100%}" +
    ".fo-c2-wmore{min-height:44px;font-size:13px}" +
    ".fo-c2-fx{min-height:44px}.fo-c2-wr{min-height:44px}" +
    ".fo-live-hero .fo-live-score{white-space:nowrap;font-size:clamp(17px,5.6vw,26px) !important;letter-spacing:-.3px}" +
    ".fo-live-hero .fo-live-score .fo-live-chase{display:block;white-space:normal;font-size:14px;margin-top:5px;letter-spacing:0}" +
      ".fo-live-hero .fo-live-score.fo-live-vs{white-space:normal;line-height:1.25}" +
    ".fo-o-news .fo-nr-row{display:block;position:relative;padding:9px 48px 9px 0}" +
    ".fo-o-news .fo-nr-row u{display:block;margin-top:2px;font-size:11.5px}" +
    ".fo-o-news .fo-nr-row i{position:absolute;right:0;top:10px}" +
    ".fo-o-ms .fo-race{margin:8px 0}" +
    ".fo-o-ms .fo-race-l b{font-size:13px}" +
    ".fo-o-leadm .fo-c2-k{margin-bottom:2px}" +
    
    "}" +
    ".fo-nr-feat{padding:2px 0 10px;border-bottom:1px solid #eee9dd;margin-bottom:4px}" +
    ".fo-nr-feat b{display:block;font-size:16.5px;font-weight:800;color:#0a2342;line-height:1.3}" +
    ".fo-nr-feat span{display:block;font-size:12px;color:#667085;margin-top:4px;line-height:1.45}" +
    ".fo-nr-feat i{font-style:normal;display:block;font-size:10px;color:#5a6472;font-weight:800;letter-spacing:.07em;text-transform:uppercase;margin-top:5px}" +
    ".fo-nr-row{display:flex;gap:10px;align-items:baseline;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0ece1;font-size:13px;color:#14243a}" +
    ".fo-nr-row:last-child{border-bottom:none}" +
    ".fo-nr-row span{min-width:0}.fo-nr-row u{text-decoration:none;color:#8a93a3;font-size:11px}" +
    ".fo-nr-row u::before{content:'\\b7  '}" +
    "@media(max-width:760px){.fo-nr-row u::before{content:''}}" +
    ".fo-nr-row i{font-style:normal;flex:0 0 auto;font-size:11px;color:#5a6472;font-weight:700}" +
    ".fo-c2-ldn{font-size:16px;font-weight:800;color:#0a2342}" +
    ".fo-c2-ldr{font-size:11px;color:#667085;margin:1px 0 8px}" +
    ".fo-c2-ldv{font-size:28px;font-weight:800;color:#0a2342}.fo-c2-ldv span{font-size:13px;color:#667085;font-weight:600}" +
    ".fo-c2-ldk{display:flex;gap:16px;margin-top:8px;font-size:12.5px;color:#667085}.fo-c2-ldk b{color:#0a2342}" +
    ".fo-c2-fbal{font-size:28px;font-weight:800;color:#0a2342;margin-bottom:10px;line-height:1.05}" +
    ".fo-c2-fbal span{display:block;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#a7aeba;margin-top:4px}" +
    ".fo-c2-fkv{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #f0ece1;font-size:12.5px;color:#667085}" +
    ".fo-c2-fkv b{font-variant-numeric:tabular-nums}" +
    ".fo-c2-ftr{margin-top:9px;font-size:11.5px;font-weight:600;color:#667085}" +
    ".fo-c2-ftr i{font-style:normal;font-weight:800}.fo-c2-ftr i.up{color:#15803D}.fo-c2-ftr i.dn{color:#b3402a}" +
    ".fo-c2-whead{display:grid;grid-template-columns:minmax(0,1fr) 58px 106px;column-gap:8px;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:#a7aeba;font-weight:800;margin:2px 0 3px;padding-bottom:5px;border-bottom:1px solid #f0ece1}" +
    ".fo-c2-whead span:last-child{text-align:right}" +
    ".fo-ch-min .fo-ch-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 2px}" +
    "@media(max-width:760px){.fo-ch-min .fo-ch-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    ".fo-ch-min .fo-stat{padding:16px 18px;min-height:92px;box-sizing:border-box}" +
    ".fo-ch-min .fo-stat-ic{width:36px;height:36px;font-size:16px;border-radius:9px}" +
    "@media(max-width:760px){.fo-ch-min .fo-stat{padding:12px 12px;min-height:0}.fo-ch-min .fo-stat-ic{display:none}" +
    ".fo-ch-min .fo-stat-v{font-size:21px}.fo-ch-min .fo-stat-l{font-size:11px;white-space:normal}.fo-ch-min .fo-stat-s{font-size:11px}}" +
    ".fo-c2-bottom .fo-lead{display:flex;gap:12px;align-items:center}" +
    ".fo-c2-bottom .fo-lead .fo-lead-ic{flex:0 0 40px;width:40px;height:40px;border-radius:11px;background:#F3F1EA;display:flex;align-items:center;justify-content:center;color:#B04A2C}" +
    ".fo-c2-fx{display:flex;gap:10px;align-items:center;padding:8px 9px;border:1px solid rgba(28,36,51,.08);border-radius:10px;margin:6px 0;background:#FFFEFC}" +
    ".fo-c2-fx.next{background:#FCF4E7;border-color:rgba(176,74,44,.25)}" +
    ".fo-c2-fxd{flex:0 0 52px}.fo-c2-fxd b{display:block;font-size:12px;color:#0E233F}.fo-c2-fxd span{font-size:10px;color:#8a93a3}" +
    ".fo-c2-fxm{flex:1;min-width:0}.fo-c2-fxm b{display:block;font-size:12.5px;color:#0E233F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-c2-fxm span{font-size:10.5px;color:#8a93a3}" +
    ".fo-c2-fxn{flex:0 0 auto;background:#B04A2C;color:#FFFEFC;border-radius:6px;padding:2px 7px;font-size:9px;font-weight:800;letter-spacing:.06em}" +
    ".fo-c2-fxn.fr{background:#41577a}" +
    ".fo-c2-wok{font-size:13px;font-weight:700;color:#16A34A;padding:6px 0 2px}" +
    ".fo-c2-wsum{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:9px}" +
    ".fo-c2-wk{border-radius:8px;padding:3px 9px;font-size:11px;font-weight:600;background:#F3F1EA;color:#5a6472}.fo-c2-wk b{font-weight:800}" +
    ".fo-c2-wk.g{background:#E3F0E7;color:#1c5537}.fo-c2-wk.a{background:#F6E3B4;color:#7a5c13}.fo-c2-wk.r{background:#F3D8D3;color:#8a2f1d}" +
    ".fo-c2-wr{display:grid;grid-template-columns:minmax(0,1fr) 58px 64px 34px;column-gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-c2-wr:last-child{border-bottom:none}" +
    ".fo-c2-wrn{flex:1;min-width:0}.fo-c2-wrn b{display:block;font-size:12.5px;color:#0E233F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-c2-wrn span{font-size:10.5px;color:#8a93a3}" +
    ".fo-c2-wtag{flex:0 0 auto;font-size:9.5px;font-weight:800;letter-spacing:.05em}" +
    ".fo-c2-wbar{width:64px;height:6px;border-radius:3px;background:#E8EAEE;overflow:hidden}.fo-c2-wbar i{display:block;height:100%;border-radius:3px}" +
    ".fo-c2-wpct{text-align:right;font-size:11px;font-weight:700;color:#3a4353;font-variant-numeric:tabular-nums}" +
    "html body .fo-news{border-top:3px double #C9C2B2}" +
    "html body .fo-news .fo-card-h2{font-family:Georgia,'Times New Roman',serif;font-size:19px;letter-spacing:.2px;color:#111827}" +
    "html body .fo-ch-sidec .fo-ch-leaders{display:grid;grid-template-columns:1fr;gap:14px}" +
    "html body .fo-ch-quick2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}" +
    "@media(max-width:700px){html body .fo-ch-quick2{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
    "html body .fo-ch-quick2 a{display:flex;align-items:center;gap:10px;background:#FFFEFC;border:1px solid #DDD8CF;border-radius:13px;padding:13px 15px;font-weight:700;font-size:13px;color:#111827 !important;text-decoration:none;transition:transform .14s ease,box-shadow .14s ease}" +
    "html body .fo-ch-quick2 a:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(7,22,46,.09)}" +
    "html body .fo-ch-quick2 a i{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:10px;background:rgba(201,85,50,.1);color:#C95532;flex:0 0 auto}" +
    ".fo-l6{display:flex;align-items:center;gap:6px;margin:0 0 10px;flex-wrap:wrap}" +
    ".fo-live-hero .fo-l6{margin:12px 0 2px}" +
    ".fo-l6-k{font-size:10px;font-weight:800;letter-spacing:.08em;color:#667085;text-transform:uppercase;margin-right:4px}" +
    ".fo-live-hero .fo-l6-k{color:#93a0b4}" +
    ".fo-l6 i{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:99px;font-style:normal;font-weight:800;font-size:12px;background:#F6F2E8;border:1px solid #DDD8CF;color:#3c4658}" +
    ".fo-l6 i.f{background:#4DA6A2;border-color:#4DA6A2;color:#fff}" +
    ".fo-l6 i.s{background:#C95532;border-color:#C95532;color:#fff}" +
    ".fo-l6 i.w{background:#DC2626;border-color:#DC2626;color:#fff}" +
    ".fo-l6 i.e{background:#FFFEFC;border-color:#F59E0B;color:#B45309;font-size:10px}" +
    ".fo-lv-cards{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 12px}" +
    ".fo-lv-pc{flex:1 1 150px;min-width:150px;background:#FFFEFC;border:1px solid #DDD8CF;border-left:3px solid #C95532;border-radius:10px;padding:9px 13px;display:flex;flex-direction:column;gap:2px}" +
    ".fo-lv-pc a{font-weight:800;color:#111827;text-decoration:none;font-size:14px}" +
    ".fo-lv-pc a:hover{color:#B04A2C}" +
    ".fo-lv-tag{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#667085;font-weight:700}" +
    ".fo-lv-fig{font-size:12.5px;color:#3c4658}" +
    ".fo-bell-act .fo-bell-acc{background:#15803D;border-color:#15803D;color:#fff}" +
    ".fo-bell-act .fo-bell-dec{background:transparent;border:1px solid #DDD8CF;color:#667085}" +
    ".fo-bell-row:hover{background:#EEEAE1}.fo-bell-row:last-child{border-bottom:none}" +
    "@media(max-width:820px){#fo-bell{order:2;margin-left:6px}#fo-bell-panel{top:96px}}" +
    ".fo-frs-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:0 0 10px}" +
    ".fo-frs-h{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin:8px 0 5px}" +
    ".fo-frs-row{display:flex;gap:10px;align-items:baseline;padding:8px 0;border-bottom:1px solid #f0ece1;font-size:13px;flex-wrap:wrap}" +
    ".fo-frs-row .fo-frs-act{margin-left:auto}" +
    ".fo-frs-on{font-size:10.5px;font-weight:800;letter-spacing:.06em;background:#eef4ee;border:1px solid #d5e0d7;color:#15803D;border-radius:999px;padding:2px 8px}" +
    "html body #ftpcomm,html body .commfeed{max-height:none !important;min-height:0 !important;overflow:visible !important}" +
    ".fo-frs-live{color:#DC2626;font-weight:800;font-size:12px;display:inline-flex;align-items:center;gap:6px}" +
    ".fo-frs-watch{font-weight:800;color:#B04A2C;text-decoration:none;white-space:nowrap}" +
    ".fo-card{background:#FFFEFC;border:1px solid rgba(7,22,46,.08);border-radius:14px;box-shadow:0 8px 24px rgba(7,22,46,.06);overflow:hidden}" +
    ".fo-card-h{background:linear-gradient(135deg,#07162E,#0E233F);color:#FFFEFC;font-weight:700;font-size:14px;padding:13px 18px}" +
    ".fo-card-b{padding:4px 8px 8px}" +
    ".fo-card-h2row{display:flex;justify-content:space-between;align-items:flex-end;padding:15px 18px 4px}" +
    ".fo-card-h2{font-size:15px;font-weight:700;color:#111827;position:relative;padding-bottom:7px}" +
    ".fo-card-h2::after{content:'';position:absolute;left:0;bottom:0;width:26px;height:3px;background:" + TERRA + ";border-radius:2px}" +
    ".fo-morelink{color:" + TERRA2 + " !important;font-size:12.5px;font-weight:600;white-space:nowrap}" +
    ".fo-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-tbl thead th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#9a9484;font-weight:700;padding:8px 12px;border-bottom:1px solid rgba(7,22,46,.08)}" +
    ".fo-tbl tbody td{padding:10px 12px;border-bottom:1px solid rgba(7,22,46,.055);color:#243040}" +
    ".fo-tbl tbody tr:last-child td{border-bottom:none}.fo-tbl .r{text-align:right}" +
    ".fo-tbl .fo-rk{width:34px;text-align:center;color:#9a9484;font-weight:700}" +
    ".fo-tbl .fo-form{margin-left:6px;display:inline-flex;gap:2px;vertical-align:middle}" +
    ".fo-tbl tbody tr:hover td{background:#FFFEFC}.fo-rowlink{cursor:pointer}" +
    ".fo-tbl .fo-scoutname{cursor:pointer;color:#111827;font-weight:600}.fo-tbl .fo-scoutname:hover{color:" + TERRA + "}" +
    ".fo-tbl tr.fo-userrow td{background:rgba(200,103,74,.10)}" +
    ".fo-tbl tr.fo-userrow td:first-child{box-shadow:inset 3px 0 0 " + TERRA + "}" +
    ".fo-t{font-size:10px;color:" + TERRA + ";font-weight:600;margin-top:1px}" +
    ".fo-fx-fr td{background:rgba(77,166,162,.06)}" +
    ".fo-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid transparent;vertical-align:middle}" +
    ".fo-pill-teal{background:rgba(77,166,162,.12);color:#2b6b68;border-color:rgba(77,166,162,.3)}" +
    ".fo-pill-muted{background:#f0ece2;color:#7a7566;border-color:#DDD8CF}" +
    ".fo-empty{display:flex;gap:14px;align-items:center;justify-content:center;padding:26px 20px;color:#667085}" +
    ".fo-empty-ic{width:44px;height:44px;border-radius:50%;background:#f2eee4;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}" +
    ".fo-ch-leaders{display:grid;grid-template-columns:1fr 1fr;gap:16px}" +
    ".fo-ch-leaders .fo-lead{display:flex;gap:14px;align-items:center;padding:16px 18px}" +
    ".fo-ch-leaders .fo-lead-ic{width:44px;height:44px;border-radius:11px;background:rgba(200,103,74,.1);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}" +
    ".fo-ch-leaders .fo-lead:nth-child(2) .fo-lead-ic{background:rgba(77,166,162,.12)}" +
    ".fo-card-h2{margin:0}.fo-ch-leaders .fo-lead .fo-card-h2::after{display:none}" +
    ".fo-ch-leaders .fo-lead-v{font-size:24px;font-weight:800;color:#111827}.fo-lead-v span{font-size:13px;font-weight:600;color:#9a9484}" +
    ".fo-kv{width:100%;font-size:13px;border-collapse:collapse}.fo-kv td{padding:10px 18px;border-bottom:1px solid rgba(7,22,46,.055);color:#243040}.fo-kv tr:last-child td{border-bottom:none}.fo-kv td:first-child{color:#7a7566}" +
    ".fo-teal{color:#2b6b68 !important;font-weight:600}" +
    // next-match anticipation panel + to-do strip + finance health
    ".fo-next{display:flex;justify-content:space-between;align-items:center;gap:18px;background:#FFFEFC;border:1px solid #DDD8CF;border-left:4px solid #C95532;border-radius:14px;padding:16px 20px;margin-top:14px;flex-wrap:wrap}" +
    ".fo-next-l{min-width:0}" +
    ".fo-next-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#C95532}" +
    ".fo-next-opp{font-size:21px;font-weight:800;color:#111827;margin:3px 0 4px;letter-spacing:-.3px}" +
    ".fo-next-sub{font-size:12.5px;color:#6b7280}" +
    ".fo-next-r{display:flex;align-items:center;gap:18px;flex-wrap:wrap}" +
    ".fo-cd{text-align:right}" +
    ".fo-cd-v{font-size:23px;font-weight:800;color:#111827;font-variant-numeric:tabular-nums;letter-spacing:.5px}" +
    ".fo-cd-l{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9a9484}" +
    ".fo-next-cta{border:0;border-radius:10px;padding:12px 22px;font-weight:800;font-size:14px;cursor:pointer;background:#C95532 !important;color:#fff !important;box-shadow:0 4px 14px rgba(201,85,50,.35);animation:foPulse 2.2s ease-in-out infinite}" +
    ".fo-next-cta:hover{background:#a94a28 !important}" +
    ".fo-next-cta.fo-done{background:#eef4ee !important;color:#15803D !important;box-shadow:none;animation:none;border:1px solid #d5e0d7}" +
    "@keyframes foPulse{0%,100%{box-shadow:0 4px 14px rgba(201,85,50,.35)}50%{box-shadow:0 4px 22px rgba(201,85,50,.6)}}" +
    ".fo-todo{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}" +
    ".fo-todo a{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#7a4a12;background:#fdf3e2;border:1px solid #eeddba;border-radius:999px;padding:6px 13px;text-decoration:none;cursor:pointer}" +
    ".fo-todo a:hover{background:#fbead0}" +
    ".fo-todo a.fo-todo-ok{color:#15803D;background:#eef4ee;border-color:#d5e0d7;cursor:default}" +
    ".fo-gains li{margin:3px 0}.fo-gains .fo-gain-up{color:#16A34A;font-weight:700}" +
    ".fo-fin-net{display:flex;justify-content:space-between;align-items:center;background:#EEEAE1;border-radius:9px;padding:9px 12px;margin-top:9px;font-size:12.5px}" +
    ".fo-fin-net b.fo-pos,.fo-pos{color:#16A34A}.fo-fin-net b.fo-neg,b.fo-neg{color:#DC2626}" +
    // mobile: swipeable tables + compact topbar
    ".fo-scrollx{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;scrollbar-width:thin;border-radius:8px;background:linear-gradient(90deg,rgba(0,0,0,.06),transparent 12px) left/16px 100% no-repeat local,linear-gradient(270deg,rgba(0,0,0,.06),transparent 12px) right/16px 100% no-repeat local}" +
    ".fo-scrollx>table{min-width:530px}" +
    // matchday centre + newspaper
    ".fo-md-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:14px}" +
    ".fo-md-card{background:#FFFEFC;border:1px solid #DDD8CF;border-radius:13px;padding:14px 16px}" +
    ".fo-md-teams{font-weight:800;color:#111827;font-size:14.5px;margin-bottom:8px}" +
    ".fo-md-inn{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#3c4658}" +
    ".fo-md-inn b{font-variant-numeric:tabular-nums;font-size:15px;color:#111827}" +
    ".fo-md-inn.on b{color:#C95532}" +
    ".fo-md-status{font-size:12px;color:#6b7280;margin-top:7px;min-height:16px}" +
    ".fo-md-done .fo-md-status{color:#15803D;font-weight:700}" +
    ".fo-md-bar{display:flex;align-items:center;gap:10px;background:#07162E;border-radius:12px;padding:12px 16px;margin-top:14px;flex-wrap:wrap}" +
    ".fo-md-bar button{background:#C95532 !important;color:#fff !important;border:0;border-radius:8px;padding:8px 16px;font-weight:800;cursor:pointer}" +
    ".fo-md-bar button.fo-ghost{background:rgba(246,244,238,.12) !important}" +
    ".fo-md-over{color:#fff;font-weight:800;font-variant-numeric:tabular-nums;min-width:120px}" +
    ".fo-md-bar,.fo-md-bar span{color:#FFFEFC;font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".fo-md-bar button{font-family:inherit}.fo-md-bar button.fo-ghost{color:#FFFEFC !important}" +
    ".fo-md-grid,.fo-md-card{font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif}" +
    ".fo-cond-bar{margin:7px 0 3px;display:flex;gap:6px;flex-wrap:wrap}" +
    ".fo-cond-pill{display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:800}" +
    ".fo-cond-pitch{background:rgba(77,166,162,.16);color:#1f4e5f;border:1px solid rgba(77,166,162,.45)}" +
    ".fo-cond-wx{background:rgba(217,164,65,.18);color:#7a5a14;border:1px solid rgba(217,164,65,.5)}" +
    ".fo-cond-gnd{background:rgba(7,22,46,.06);color:#3c4658;border:1px solid rgba(7,22,46,.14)}" +
    ".fo-comm-full{max-height:72vh;overflow-y:auto;font-size:13.5px;line-height:1.5}" +
    "html,body{-webkit-text-size-adjust:100%;text-size-adjust:100%}" +
    "#page table,#page td,#page th{-webkit-text-size-adjust:100%;text-size-adjust:100%}" +
    "#page tr.fo-rnd-head>td{background:#111827 !important;color:#FFFEFC !important;font-weight:800;font-size:12.5px !important;padding:9px 12px;border-top:16px solid transparent;background-clip:padding-box}" +
    "#page tr.fo-rnd-head>td .small,#page tr.fo-rnd-head>td span{font-size:11.5px !important}" +
    "#page tr.fo-rnd-head>td .fo-fx-chev{font-size:12.5px !important}" +
    "#page tr.fo-rnd-head b,#page tr.fo-rnd-head span{color:#FFFEFC !important}" +
    "html body button.fo-setr,html body.ftpskin button.fo-setr{background:#C95532 !important;border-color:#C95532 !important;color:#FFFEFC !important}" +
    "html body button.fo-setr-done,html body.ftpskin button.fo-setr-done,html body.ftpskin button.primary.fo-setr-done{background:#15803D !important;color:#fff !important;border-color:#15803D !important}" +
    "html body button.fo-setr-done:hover,html body.ftpskin button.fo-setr-done:hover,html body.ftpskin button.primary.fo-setr-done:hover{background:#255738 !important;border-color:#255738 !important;color:#fff !important}" +
    // future rounds are optional planning: ghost until orders are actually in
    "html body button.fo-setr-later:not(.fo-setr-done),html body.ftpskin button.fo-setr-later:not(.fo-setr-done){background:transparent !important;color:#C95532 !important;border-color:rgba(201,85,50,.5) !important}" +
    "html body button.fo-setr-later:not(.fo-setr-done):hover,html body.ftpskin button.fo-setr-later:not(.fo-setr-done):hover{background:rgba(201,85,50,.09) !important}" +
    ".fo-mv-up{color:#15803D;font-weight:800}.fo-mv-dn{color:#b3402a;font-weight:800}" +
    ".fo-gaprow td{text-align:center;color:#9aa3b2;padding:1px 0 !important;font-size:12px;line-height:1}" +
    ".fo-stand-gap{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(28,36,51,.15);font-size:12.5px;color:#5a6472;font-weight:600}" +
    ".fo-fin-line{font-size:13.5px;line-height:1.55}.fo-fin-line b{font-weight:800}" +
    "#fo-update-pill{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483200;background:#07162E;color:#FFFEFC;border:1px solid rgba(246,244,238,.25);border-radius:999px;padding:11px 20px;font:600 13.5px Inter,-apple-system,'Segoe UI',sans-serif;box-shadow:0 12px 34px -10px rgba(0,0,0,.55);cursor:pointer;max-width:92vw;text-align:center}" +
    "#fo-update-pill b{color:#E8A87C}" +
    // live match viewer: links rail | BIG commentary | compact score+details rail
    ".wrap.fo-matchwide,body.ftpskin .wrap.fo-matchwide{max-width:min(1460px,96vw) !important}" +
    "#page.fo-matchpage{display:grid;grid-template-columns:170px minmax(0,1fr) 300px;gap:0 16px;align-items:start;grid-template-areas:'mcrumb mcrumb mcrumb' 'mlinks mbody mside';max-width:1460px !important}" +
    "#page.fo-matchpage>.crumb{grid-area:mcrumb}" +
    "#page.fo-matchpage .ftp-match-shell{display:contents}" +
    "#page.fo-matchpage .ftp-match-links{grid-area:mlinks;margin-top:0}" +
    "#page.fo-matchpage .ftp-match-body{grid-area:mbody;min-width:0;margin-top:0}" +
    "#page.fo-matchpage .mc-top{grid-area:mside;display:flex !important;flex-direction:column !important;gap:12px;margin:0;grid-template-columns:none !important}" +
    "#page.fo-matchpage .mc-top .panel{margin:0;width:auto}" +
    "#page.fo-matchpage .mc-score .scorebig{font-size:26px}" +
    "#page.fo-matchpage .mc-score .pad,#page.fo-matchpage .mc-details .pad{padding:10px 12px;font-size:12.5px}" +
    "#page.fo-matchpage .mc-details table.kv{font-size:12px}" +
    "#page.fo-matchpage .mc-details .fo-detart{display:none}" +
    "#page.fo-matchpage .ftp-match-body .commfeed,#page.fo-matchpage .ftp-match-body #ftpcomm{max-height:calc(100vh - 240px) !important;min-height:58vh;overflow-y:auto}" +
    "#page.fo-matchpage .ftp-match-body .line,#page.fo-matchpage .ftp-match-body .four,#page.fo-matchpage .ftp-match-body .six{font-size:13.5px;line-height:1.55}" +
    "@media(max-width:980px){" +
      "#page.fo-matchpage{display:flex;flex-direction:column;gap:12px}" +
      "#page.fo-matchpage .mc-top{display:contents}" +
      "#page.fo-matchpage>.crumb{order:0}" +
      "#page.fo-matchpage .mc-score{order:1}" +
      "#page.fo-matchpage .ftp-match-links{order:2;display:flex;flex-direction:row;overflow-x:auto;gap:6px;padding:6px}" +
      "#page.fo-matchpage .ftp-match-links a{white-space:nowrap}" +
      "#page.fo-matchpage .ftp-match-links h4{display:none}" +
      "#page.fo-matchpage .ftp-match-body{order:3}" +
      "#page.fo-matchpage .mc-details{order:4}" +
    "}" +
    ".fo-md-track{flex:1;height:6px;border-radius:99px;background:rgba(246,244,238,.15);min-width:120px}" +
    ".fo-md-track u{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#4DA6A2,#C95532);text-decoration:none;width:0}" +
    ".fo-potr{display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,#07162E,#0E233F);border-radius:13px;padding:16px 18px;margin-top:14px;color:#d7dbe2}" +
    ".fo-potr-medal{font-size:26px}" +
    ".fo-potr b{color:#fff;font-size:16px}" +
    ".fo-news li{margin:0 0 9px;padding-left:2px;line-height:1.5}" +
    ".fo-news .fo-news-h{font-weight:800;color:#111827}" +
    ".fo-news .fo-news-s{color:#6b7280;font-size:12px}" +

    // polish pack: consistent motion, hover lift, numeric alignment
    "#page .fo-card,#page .panel,.fo-md-card,.fo-yc{transition:box-shadow .18s ease,transform .18s ease}" +
    "#page .fo-card:hover,.fo-md-card:hover,.fo-yc:hover{box-shadow:0 6px 18px rgba(18,32,58,.08);transform:translateY(-1px)}" +
    "#page button,.fo-yc-sign,.fo-next-cta,.fo-setr{transition:transform .12s ease,box-shadow .12s ease,background .12s ease}" +
    "#page button:active{transform:scale(.97)}" +
    "#page td.r,#page .fo-stat-v,.fo-cd-v,.fo-md-inn b{font-variant-numeric:tabular-nums}" +
    "#page tbody tr{transition:background .12s ease}" +
    "#page tbody tr:hover{background:rgba(77,166,162,.05)}" +
    ".fo-ch-stats{margin:14px 0}" +
    ".fo-ch-grid{gap:14px}.fo-ch-col{gap:14px}" +
    "#page{animation:foPageIn .22s ease}" +
    "@keyframes foPageIn{from{opacity:.55;transform:translateY(3px)}to{opacity:1;transform:none}}" +
    "@media(prefers-reduced-motion:reduce){#page{animation:none}#page .fo-card,#page button{transition:none}}" +
    ".fo-streak{display:inline-flex;align-items:center;gap:6px;background:#fdf3e2;border:1px solid #eeddba;color:#7a4a12;font-size:12px;font-weight:800;border-radius:999px;padding:5px 12px}" +
    ".fo-social{font-size:12px;color:#6b7280;margin-top:8px}" +
    ".fo-social b{color:#1f4e5f}" +
    "@media(max-width:760px){" +
      ".fo-modal-card{max-height:86vh;overflow-y:auto;width:min(94vw,420px)}" +
      ".fo-stat{min-width:0}.fo-stat-body{min-width:0;overflow:hidden}" +
      ".fo-stat-v{font-size:clamp(15px,5vw,22px) !important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-stat-l{font-size:10px !important;letter-spacing:.08em}" +
      ".fo-ch-stats{grid-template-columns:repeat(2,1fr) !important;gap:10px !important}" +
      "#page,#page td,#page p,#page li{font-size:13.5px}" +
      "#page .small,.fo-yc-meta,.fo-news-s{font-size:12px}" +
      "#page h4,.fo-card-h2{font-size:14px}" +
      ".fo-cd-v{font-size:20px}" +
      "#topbar{padding:8px 10px !important;gap:4px 12px !important}" +
      "#topbar a{font-size:13px !important;padding:5px 2px !important}" +
      "#topbar .brand{font-size:15px !important}" +
      "#fo-clock{display:none !important}" +
      "#fo-top-status{gap:5px !important}" +
      "#fo-top-status span{font-size:11px !important;padding:3px 8px !important}" +
      ".fo-tr-tbl{font-size:12.5px}" +
      ".fo-next-cta{width:100%}" +
      ".fo-cd{width:100%}" +
      ".fo-todo a{flex:1 1 auto;justify-content:center}" +
      ".page-head h1{font-size:24px !important}" +
      ".fo-man summary{font-size:14px;padding:12px 13px}" +
      ".fo-man .fo-man-b{padding:10px 13px 13px;font-size:13px}" +
    "}" +
    "@media(max-width:900px){.fo-next{flex-direction:column;align-items:flex-start}.fo-cd{text-align:left}}" +
    "@media(max-width:900px){.fo-ch-stats{grid-template-columns:repeat(2,1fr)}.fo-ch-grid{grid-template-columns:1fr}.fo-ch-leaders{grid-template-columns:1fr}.fo-ch-name{font-size:26px}.fo-ch-hero{flex-direction:column;align-items:flex-start}}" +
    // ===== FIRST-LOGIN ONBOARDING =====
    "#fo-onb{position:fixed;inset:0;z-index:100000;overflow:auto}" +
    // ---- quick-start onboarding (name → pitch → starter → confirm) ----
    ".fo-qs-wrap{max-width:720px;margin:0 auto;padding:18px 16px 120px}" +
    ".fo-qs-top{display:flex;align-items:center;justify-content:space-between;margin:2px 2px 14px}" +
    ".fo-qs-brand{font-weight:800;letter-spacing:1.2px;color:#0a2342;font-size:12px;text-transform:uppercase}" +
    ".fo-qs-dots{display:flex;gap:7px;align-items:center}" +
    ".fo-qs-dot{width:8px;height:8px;border-radius:50%;background:rgba(10,35,66,.18);transition:all .2s}" +
    ".fo-qs-dot.on{background:#C95532;transform:scale(1.3)}" +
    ".fo-qs-dot.done{background:#0a2342}" +
    ".fo-qs-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}" +
    ".fo-qs-arch{position:relative;display:flex;flex-direction:column;gap:5px;text-align:left;padding:13px 12px 11px;border:1.5px solid rgba(10,35,66,.14);border-radius:14px;background:linear-gradient(170deg,#FFFEFC,#F7F3E9);cursor:pointer;font:inherit;overflow:hidden}" +
    ".fo-qs-arch.on{border-color:#C95532;box-shadow:0 0 0 2px rgba(201,85,50,.25),0 10px 22px rgba(10,35,66,.10);background:linear-gradient(170deg,#FFFDF8,#FDEEE6)}" +
    ".fo-qs-arch.on:after{content:'\\2713';position:absolute;top:8px;right:10px;width:20px;height:20px;border-radius:50%;background:#C95532;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}" +
    ".fo-qs-aic{width:34px;height:34px;border-radius:10px;background:#0a2342;color:#F5EFDC;display:flex;align-items:center;justify-content:center}" +
    ".fo-qs-anm{font-size:15.5px;font-weight:800;color:#0a2342;font-family:Georgia,'Times New Roman',serif}" +
    ".fo-qs-arole{font-size:10.5px;letter-spacing:.8px;text-transform:uppercase;color:#C95532;font-weight:700;margin-top:-3px}" +
    ".fo-qs-aline{font-size:12px;color:#4a5568;line-height:1.35;font-style:italic;min-height:32px}" +
    ".fo-qs-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:2px}" +
    ".fo-qs-chip{font-style:normal;font-size:10.5px;font-weight:600;padding:3px 7px;border-radius:99px;line-height:1.15}" +
    ".fo-qs-chip.g{background:rgba(22,163,74,.12);color:#166534;border:1px solid rgba(22,163,74,.25)}" +
    ".fo-qs-chip.w{background:rgba(217,119,6,.12);color:#92400e;border:1px solid rgba(217,119,6,.28)}" +
    ".fo-qs-ctabar{position:fixed;left:0;right:0;bottom:0;z-index:6;padding:10px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(to top,#F5EFDC 62%,rgba(245,239,220,0));display:flex;gap:10px;justify-content:center;align-items:stretch}" +
    ".fo-qs-cta{flex:1;max-width:420px;height:50px;border:none;border-radius:13px;background:#C95532;color:#FFFEFC;font-size:16px;font-weight:800;cursor:pointer;box-shadow:0 10px 24px rgba(201,85,50,.35)}" +
    ".fo-qs-cta:disabled{opacity:.45;cursor:default;box-shadow:none}" +
    // golden first-session strip on the club home
    ".fo-qs-gold{display:flex;gap:14px;align-items:center;justify-content:space-between;border:1.5px solid rgba(201,85,50,.45);background:linear-gradient(150deg,#FFF9EF,#FDEEE0);border-radius:14px;padding:14px 16px;margin:0 0 14px}" +
    ".fo-qs-gk{font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#C95532;font-weight:800}" +
    ".fo-qs-gt{font-weight:800;color:#0a2342;font-size:15.5px;margin:2px 0}" +
    ".fo-qs-gs{font-size:12.5px;color:#5b6472;line-height:1.4}" +
    ".fo-qs-gold-r{display:flex;flex-direction:column;align-items:stretch;min-width:170px}" +
    ".fo-qs-gtweak{font-size:12px;color:#C95532;cursor:pointer;margin-top:7px;text-align:center;text-decoration:underline dotted}" +
    ".fo-qs-gold-ok{font-size:14px;color:#166534;font-weight:600;line-height:1.5}" +
    ".fo-qs-gold-ok a{color:#C95532;cursor:pointer}" +
    ".fo-qs-fp{font-style:normal;color:#D9B75A;margin-left:4px;cursor:help;font-size:.85em;vertical-align:1px}" +
    // the captain wears a different colour scheme, forever
    ".fo-capt-chip{display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:800;font-size:10px;width:16px;height:16px;border-radius:5px;background:linear-gradient(150deg,#D9B75A,#B8933A);color:#0a2342;margin-left:5px;vertical-align:1px;cursor:help;box-shadow:0 1px 3px rgba(0,0,0,.25)}" +
    "tr.fo-capt-glow>td{background:linear-gradient(90deg,rgba(217,183,90,.16),rgba(217,183,90,.05)) !important}" +
    "tr.fo-capt-glow>td:first-child{border-left:3px solid #D9B75A}" +
    ".fo-dc.fo-capt-glow,.fo-sq-item.fo-capt-glow,.fo-c2-wr.fo-capt-glow,.fo-sq-mfx.fo-capt-glow,.fo-sqr-row.fo-capt-glow{background:linear-gradient(120deg,rgba(217,183,90,.16),rgba(217,183,90,.04)) !important;border-left:3px solid #D9B75A !important;border-radius:8px}" +
    ".fo-qs-origin-c{color:#8a6d1f;font-weight:600}" +
    // step 4: captain candidate cards - a full draft-card stat read-out under
    // a navy-and-gold captaincy band, unmistakably different
    ".fo-qs-cgrid{grid-template-columns:1fr 1fr}" +
    "html body button.fo-qs-capt,html body.ftpskin button.fo-qs-capt{position:relative;display:flex;flex-direction:column;text-align:left;padding:0 !important;border:1.5px solid rgba(184,147,58,.55) !important;border-radius:14px;background:#FFFEFC !important;cursor:pointer;font:inherit;overflow:hidden;color:#0a2342 !important}" +
    "html body button.fo-qs-capt.on,html body.ftpskin button.fo-qs-capt.on{border-color:#D9B75A !important;box-shadow:0 0 0 2.5px rgba(217,183,90,.55),0 12px 26px rgba(10,35,66,.18) !important}" +
    ".fo-qs-capt.on:after{content:'\\2713';position:absolute;top:7px;right:9px;width:20px;height:20px;border-radius:50%;background:#D9B75A;color:#0a2342;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}" +
    ".fo-qs-cband{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;background:linear-gradient(120deg,#0a2342,#17365c);width:100%;box-sizing:border-box}" +
    ".fo-qs-cflav{font-size:10.5px;letter-spacing:1.1px;text-transform:uppercase;color:#D9B75A;font-weight:800}" +
    ".fo-qs-ccapt{font-size:10px;color:#9fb0c4;padding-right:16px}.fo-qs-ccapt u{text-decoration:none;color:#EAD9A8;font-weight:800}" +
    ".fo-qs-cbody{display:flex;flex-direction:column;gap:5px;padding:10px 12px 11px;width:100%;box-sizing:border-box}" +
    ".fo-qs-chead{display:flex;align-items:baseline;gap:7px}" +
    ".fo-qs-cflag{font-size:13px}" +
    ".fo-qs-cnm{font-size:16.5px;font-weight:800;color:#0a2342;font-family:Georgia,'Times New Roman',serif}" +
    ".fo-qs-covr{margin-left:auto;font-size:10.5px;color:#5b6472}.fo-qs-covr b{font-size:13px;color:#0a2342}" +
    ".fo-qs-cmeta{font-size:11px;color:#5b6472}" +
    ".fo-qs-capt .fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none;gap:3px;margin-top:6px;padding-top:7px;border-top:1px dashed rgba(10,35,66,.14)}" +
    ".fo-qs-capt .fo-db em{width:78px}" +
    // tutorial: the captain's first call
    ".fo-tut-plan{display:flex;flex-direction:column;gap:3px;width:100%;text-align:left;margin-top:8px;padding:12px 13px;border:1.5px solid rgba(10,35,66,.14);border-radius:12px;background:#FFFEFC;cursor:pointer;font:inherit}" +
    ".fo-tut-plan b{font-size:14px;color:#0a2342}" +
    ".fo-tut-plan span{font-size:12px;color:#5b6472;line-height:1.35}" +
    ".fo-tut-plan:hover{border-color:#C95532;box-shadow:0 0 0 2px rgba(201,85,50,.15)}" +
    "html body button#fo-simres,html body.ftpskin button#fo-simres{margin-left:auto;background:#C95532 !important;color:#FFFEFC !important;border:none !important;border-radius:8px;padding:6px 14px;font-weight:700;font-size:12.5px;cursor:pointer}" +
    "html body button#fo-simres:disabled{opacity:.6;cursor:default}" +
    ".fo-qs-origin{font-size:11.5px;color:#8a6d1f;margin-top:3px;font-style:italic}" +
    // the engine skin's generic button rules (.ftpskin button, button.on) outrank
    // single-class selectors - pin the quick-start controls the house way
    "html body button.fo-qs-cta,html body.ftpskin button.fo-qs-cta{background:#C95532 !important;color:#FFFEFC !important;border:none !important;font-size:16px !important;font-weight:800 !important}" +
    "html body button.fo-qs-cta:hover{background:#B54A2B !important}" +
    "html body button.fo-qs-cta:disabled,html body.ftpskin button.fo-qs-cta:disabled{background:rgba(10,35,66,.10) !important;color:rgba(10,35,66,.45) !important;box-shadow:none !important}" +
    "html body button.fo-qs-arch,html body.ftpskin button.fo-qs-arch{color:#0a2342 !important}" +
    "html body button.fo-qs-arch{background:linear-gradient(170deg,#FFFEFC,#F7F3E9) !important;border:1.5px solid rgba(10,35,66,.14) !important}" +
    "html body button.fo-qs-arch.on,html body.ftpskin button.fo-qs-arch.on{background:linear-gradient(170deg,#FFFDF8,#FDEEE6) !important;border-color:#C95532 !important;box-shadow:0 0 0 2px rgba(201,85,50,.25),0 10px 22px rgba(10,35,66,.10) !important}" +
    "@media(max-width:700px){.fo-qs-grid{grid-template-columns:1fr 1fr;gap:8px}.fo-qs-gold{flex-direction:column;align-items:stretch}.fo-qs-gold-r{min-width:0}}" +
    "@media(max-width:760px){.fo-qs-cgrid{grid-template-columns:1fr}}" +
    // squad composition steppers + live money
    ".fo-comp-grid{display:flex;flex-direction:column;gap:8px;max-width:430px}" +
    ".fo-comp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#FFFEFC;border:1px solid rgba(10,35,66,.12);border-radius:11px;padding:9px 12px}" +
    ".fo-comp-lbl{font-size:13.5px;font-weight:600;color:#0a2342}" +
    ".fo-comp-cap{font-style:normal;font-size:10px;color:#8a6d1f;background:rgba(217,183,90,.18);border:1px solid rgba(217,183,90,.4);border-radius:99px;padding:2px 7px;margin-left:6px;vertical-align:1px}" +
    ".fo-comp-ctl{display:flex;align-items:center;gap:10px}" +
    "html body button.fo-comp-btn,html body.ftpskin button.fo-comp-btn{width:34px;height:34px;border-radius:10px;border:1.5px solid rgba(201,85,50,.5) !important;background:#FFF6F2 !important;color:#C95532 !important;font-size:18px;font-weight:800;cursor:pointer;line-height:1;padding:0 !important}" +
    ".fo-comp-n{min-width:26px;text-align:center;font-size:16px;color:#0a2342}" +
    ".fo-comp-note{min-height:18px;font-size:12px;color:#92400e;margin-top:8px;opacity:0;transition:opacity .25s}" +
    ".fo-comp-money{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}" +
    ".fo-comp-money span{background:#FFFEFC;border:1px solid rgba(10,35,66,.12);border-radius:10px;padding:8px 12px;font-size:12px;display:flex;flex-direction:column;gap:2px;min-width:96px}" +
    ".fo-comp-money i{font-style:normal;font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:#8a94a3}" +
    ".fo-comp-money b{font-size:14.5px;color:#0a2342}.fo-comp-money em{font-style:normal;font-size:10px;color:#8a94a3}" +
    "@media(max-width:370px){.fo-qs-grid{grid-template-columns:1fr}}" +
    ".fo-ob-shell{min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(77,166,162,.08),transparent 34%),radial-gradient(circle at 85% 12%,rgba(200,103,74,.06),transparent 30%),linear-gradient(180deg,#EEEAE1 0%,#EDE8DB 100%);color:#111827;padding:24px 16px 48px}" +
    ".fo-ob-inner{max-width:960px;margin:0 auto}" +
    ".fo-ob-prog{display:flex;align-items:center;justify-content:center;gap:4px;margin:6px 0 20px;flex-wrap:wrap}" +
    ".fo-ob-step{display:flex;align-items:center;gap:7px;color:#9a9484;font-size:12px;font-weight:600}" +
    ".fo-ob-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:1px solid rgba(7,22,46,.25);background:#ece7da}" +
    ".fo-ob-step.on{color:#111827}.fo-ob-step.on .fo-ob-dot{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    ".fo-ob-step.done .fo-ob-dot{background:rgba(77,166,162,.25);border-color:#2b6b68;color:#2b6b68}.fo-ob-step.done{color:#5d6570}" +
    ".fo-ob-sep{width:16px;height:1px;background:#ece7da}" +
    ".fo-ob-card{background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:22px;padding:30px 32px;box-shadow:0 10px 30px rgba(7,22,46,.08)}" +
    ".fo-ob-narrow{max-width:560px;margin:0 auto}" +
    ".fo-ob-wordmark{display:flex;align-items:center;gap:14px;margin-bottom:16px}.fo-ob-wm1{font-size:22px;font-weight:800;letter-spacing:3px}.fo-ob-wm1 span{color:" + TERRA + "}.fo-ob-wm2{font-size:10px;letter-spacing:3px;color:#9a9484;text-transform:uppercase;margin-top:2px}" +
    ".fo-ob-eyebrow{color:#2b6b68;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px}" +
    ".fo-ob-h1{font-size:26px;font-weight:800;margin:0 0 10px;line-height:1.15;letter-spacing:-.3px}" +
    ".fo-ob-lead{color:#545d68;font-size:14px;line-height:1.55;margin:0 0 18px}" +
    ".fo-ob-lbl{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9a9484;font-weight:700;margin:12px 0 6px}" +
    ".fo-ob-input{width:100%;padding:12px 14px;border-radius:11px;border:1px solid rgba(7,22,46,.18);background:#FFFEFC;color:#111827;font-size:15px;font-family:inherit}" +
    ".fo-ob-input:focus{outline:none;border-color:#2b6b68;box-shadow:0 0 0 3px rgba(77,166,162,.2)}" +
    ".fo-ob-hint{font-weight:400;text-transform:none;letter-spacing:0;color:#a39d8d}" +
    "#fo-onb select.fo-ob-input{appearance:auto;-webkit-appearance:auto}" +
    ".fo-ob-act{display:flex;gap:12px;justify-content:flex-end;margin-top:22px}" +
    ".fo-ob-cta{background:" + TERRA + ";color:#FFFEFC;border:none;padding:12px 22px;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer}.fo-ob-cta:hover:not(:disabled){background:" + TERRA2 + "}.fo-ob-cta:disabled{opacity:.4;cursor:default}" +
    ".fo-cta-danger{background:" + TERRA + "}" +
    ".fo-ob-ghost{background:transparent;color:#37424f;border:1px solid rgba(7,22,46,.25);padding:12px 20px;border-radius:11px;font-weight:600;font-size:14px;cursor:pointer}.fo-ob-ghost:hover{background:#ece7da}" +
    // money screen
    ".fo-ob-jobs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0 18px}" +
    ".fo-ob-job{display:flex;gap:12px;align-items:center;background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:14px;padding:14px}" +
    ".fo-ob-jic{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;background:rgba(77,166,162,.14)}" +
    ".fo-ob-muted{color:#667085;font-size:12px;margin-top:2px}" +
    ".fo-ob-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 18px}" +
    ".fo-ob-tile{background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:14px;padding:16px}" +
    ".fo-ob-tl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484;font-weight:700}.fo-ob-tv{font-size:23px;font-weight:800;margin:5px 0 2px}.fo-ob-ts{font-size:11.5px;color:#9a9484}" +
    ".fo-ob-list{margin:6px 0 16px;padding-left:18px;color:#414b57;font-size:13.5px;line-height:1.8}.fo-ob-list b{color:#111827}" +
    ".fo-ob-warn{background:linear-gradient(90deg,rgba(200,103,74,.18),rgba(200,103,74,.06));border:1px solid rgba(200,103,74,.35);border-radius:12px;padding:12px 14px;color:#9c4a30;font-size:13px;font-weight:600}" +
    ".fo-ob-note{background:rgba(77,166,162,.08);border:1px solid rgba(77,166,162,.22);border-radius:11px;padding:10px 13px;color:#5d6570;font-size:12.5px;margin-top:6px}" +
    // selectable cards (style/sponsor)
    ".fo-ob-picks{display:flex;flex-direction:column;gap:12px}.fo-ob-picks-3{gap:12px}" +
    ".fo-ob-pick{text-align:left;background:#f7f4ec;border:1.5px solid rgba(7,22,46,.13);border-radius:16px;padding:16px 18px;cursor:pointer;color:#111827;display:block;width:100%}" +
    ".fo-ob-pick:hover{border-color:rgba(7,22,46,.25)}" +
    ".fo-ob-pick.on{border-color:var(--tc);box-shadow:0 0 0 3px color-mix(in srgb,var(--tc) 26%,transparent)}" +
    ".fo-tone-teal{--tc:#3d8a86}.fo-tone-terra{--tc:" + TERRA + "}.fo-tone-gold{--tc:#F59E0B}.fo-tone-violet{--tc:#8b6bb1}.fo-tone-danger{--tc:#DC2626}" +
    ".fo-ob-pick-h{display:flex;align-items:center;gap:10px;margin-bottom:3px}.fo-ob-pick-name{font-size:16px;font-weight:800;color:var(--tc)}" +
    ".fo-ob-rec{background:rgba(77,166,162,.16);color:#2b6b68;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid rgba(77,166,162,.3)}" +
    ".fo-ob-est{margin-left:auto;text-align:right;font-size:10px;color:#9a9484;text-transform:uppercase;letter-spacing:.04em}.fo-ob-est b{display:block;font-size:16px;color:#111827;letter-spacing:0}" +
    ".fo-ob-pick-tag{color:#737a84;font-size:12.5px;margin-bottom:10px}" +
    ".fo-ob-pick-grid{display:flex;gap:22px}.fo-ob-pick-grid>div{display:flex;flex-direction:column}.fo-ob-pick-grid span{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#a39d8d;font-weight:700}.fo-ob-pick-grid b{font-size:15px;margin-top:2px}.fo-ob-pick-grid .fo-risk{color:var(--tc)}" +
    ".fo-ob-splines{margin:0 0 8px;padding-left:16px;font-size:12.5px;color:#414b57;line-height:1.6}" +
    ".fo-ob-scen{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.fo-ob-scen span{background:#f7f4ec;border-radius:9px;padding:7px 8px;text-align:center;font-size:13px;font-weight:700}.fo-ob-scen i{display:block;font-style:normal;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:#a39d8d;margin-bottom:3px;font-weight:700}" +
    // draft room
    ".fo-ob-draftwrap{max-width:1180px;margin:0 auto}" +
    ".fo-dr-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}" +
    ".fo-dr-hstat{display:flex;gap:8px;flex-wrap:wrap}.fo-dr-hstat span{background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:10px;padding:8px 13px;font-size:12px;color:#7a7566}.fo-dr-hstat b{color:#111827;margin-left:5px}" +
    ".fo-dr-grid{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}" +
    ".fo-dr-main{background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:16px;padding:14px}" +
    ".fo-dr-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center}" +
    ".fo-dr-chip{background:#f7f4ec;border:1px solid rgba(7,22,46,.13);color:#545d68;border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-weight:600}.fo-dr-chip.on{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    ".fo-dr-searchi{margin-left:auto;background:#f7f4ec;border:1px solid rgba(7,22,46,.13);color:#111827;border-radius:10px;padding:7px 12px;font-size:12.5px;min-width:150px;font-family:inherit}.fo-dr-searchi:focus{outline:none;border-color:#2b6b68}" +
    ".fo-dr-tblwrap{max-height:70vh;overflow:auto;border-radius:10px}" +
    ".fo-dr-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-dr-tbl thead th{position:sticky;top:0;background:#f4f0e6;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#9a9484;font-weight:700;padding:8px 10px;border-bottom:1px solid rgba(7,22,46,.13)}" +
    ".fo-dr-tbl tbody td{padding:9px 10px;border-bottom:1px solid rgba(7,22,46,.13);color:#7a7566}.fo-dr-tbl .r{text-align:right}" +
    ".fo-dr-tbl tbody tr:hover td{background:#ece7da}.fo-dr-in td{background:rgba(200,103,74,.1) !important}" +
    ".fo-dr-nm{font-weight:600;color:#111827}.fo-dr-nat{color:#9a9484;font-size:11px}" +
    // compact per-row skill bars (mirrors the squad view)
    ".fo-sk-wrap{display:flex;flex-direction:column;gap:3px;min-width:118px}" +
    ".fo-sk{display:flex;align-items:center;gap:5px;font-size:9px}" +
    ".fo-sk i{font-style:normal;width:26px;letter-spacing:.4px;color:#a39d8d}" +
    ".fo-sk b{flex:1;height:5px;border-radius:3px;background:#ece7da;overflow:hidden;display:block}" +
    ".fo-sk u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ")}" +
    ".fo-sk em{font-style:normal;width:18px;text-align:right;font-size:9.5px;color:#6d7480;font-variant-numeric:tabular-nums}" +
    ".fo-rl{background:rgba(77,166,162,.14);color:#2b6b68;font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px}" +
    ".fo-dr-add{width:28px;height:28px;border-radius:8px;border:1px solid " + TERRA + ";background:" + TERRA + ";color:#fff;font-size:16px;font-weight:700;cursor:pointer;line-height:1}.fo-dr-add.on{background:#f7f4ec;color:" + TERRA + "}" +
    ".fo-dr-side{display:flex;flex-direction:column;gap:12px;position:sticky;top:12px}" +
    ".fo-fc{background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:16px;padding:16px}" +
    ".fo-fc-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#2b6b68;font-weight:800;margin-bottom:10px}" +
    ".fo-fc-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12.5px;color:#737a84;border-bottom:1px solid rgba(7,22,46,.13)}.fo-fc-row b{color:#111827;font-weight:700}" +
    ".fo-fc-end{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:11px 13px;border-radius:11px;background:#f7f4ec;border:1px solid var(--tc)}.fo-fc-end span{font-size:12px;color:#5d6570}.fo-fc-end b{font-size:19px;color:var(--tc)}" +
    ".fo-fc-health{margin-top:8px;text-align:center;font-size:12px;color:#7a7566}.fo-fc-health b{color:var(--tc);font-weight:800}" +
    ".fo-fc-scens{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:10px}.fo-fc-scen{background:#f7f4ec;border-radius:9px;padding:7px 9px;font-size:12px}.fo-fc-scen span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:#a39d8d;font-weight:700}.fo-fc-scen b{color:var(--tc)}" +
    ".fo-dr-shape{display:flex;gap:6px;justify-content:space-between}.fo-sh{flex:1;background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:11px;padding:9px 4px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#9a9484;font-weight:700}.fo-sh b{display:block;font-size:18px;color:#111827}" +
    ".fo-adv-panel{background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:16px;padding:14px}.fo-adv-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#667085;font-weight:800;margin-bottom:8px}" +
    ".fo-adv{font-size:12.5px;line-height:1.5;padding:8px 11px;border-radius:10px;margin-bottom:6px;border-left:3px solid}.fo-adv:last-child{margin-bottom:0}" +
    ".fo-adv-warn{background:rgba(217,164,65,.1);border-color:#F59E0B;color:#8a6a1f}.fo-adv-danger{background:rgba(200,79,74,.12);border-color:#DC2626;color:#9c3f39}.fo-adv-ok{background:rgba(77,166,109,.1);border-color:#4DA66D;color:#2e7d4f}.fo-adv-info{background:rgba(77,166,162,.08);border-color:#2b6b68;color:#5d6570}" +
    ".fo-dr-act{max-width:none;justify-content:space-between;margin-top:16px}.fo-dr-needs{text-align:right;color:#9a9484;font-size:12px;margin-top:6px}" +
    // risk + report
    ".fo-ob-risk{text-align:center;background:#fdf3f0;border-color:rgba(200,79,74,.4)}.fo-risk-ic{width:60px;height:60px;border-radius:50%;background:rgba(200,79,74,.18);border:1px solid rgba(200,79,74,.4);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 14px}.fo-risk-amt{color:#c0392b}.fo-risk-list{display:inline-block;text-align:left}.fo-ob-risk .fo-ob-act{justify-content:center}" +
    ".fo-ob-check{display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px;color:#37424f;margin:8px 0;cursor:pointer}.fo-ob-check input{width:17px;height:17px;accent-color:" + TERRA + "}" +
    ".fo-ob-report{max-width:640px;margin:0 auto}.fo-br-head{display:flex;align-items:center;gap:14px;margin-bottom:16px}.fo-br-crest{width:56px;height:56px;border-radius:13px;background:#f7f4ec;border:1px solid rgba(7,22,46,.13);display:flex;align-items:center;justify-content:center;padding:6px}.fo-br-crest img{width:100%;height:100%;object-fit:contain}" +
    ".fo-br-grid{background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:14px;overflow:hidden}.fo-br-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(7,22,46,.13);font-size:13.5px;color:#5d6570}.fo-br-row:last-child{border-bottom:none}.fo-br-row b{font-size:15px}" +
    ".fo-br-advice{margin-top:14px;background:rgba(77,166,162,.07);border:1px solid rgba(77,166,162,.2);border-radius:14px;padding:14px 16px}.fo-br-advh{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#2b6b68;font-weight:800;margin-bottom:5px}.fo-br-advice p{margin:0;font-size:13.5px;line-height:1.55;color:#2f3a48}" +
    ".fo-tone-teal{color-scheme:normal}b.fo-tone-teal,.fo-tone-teal>b{color:#2b6b68}b.fo-tone-terra{color:" + TERRA + "}b.fo-tone-gold{color:#a97b1e}b.fo-tone-danger{color:#c0392b}" +
    "@media(max-width:820px){.fo-dr-grid{grid-template-columns:1fr}.fo-dr-side{position:static}.fo-ob-tiles,.fo-ob-jobs{grid-template-columns:1fr}.fo-ob-card{padding:22px 18px}.fo-ob-h1{font-size:22px}}" +
    // ===== mockup-fidelity layer: icons, split create, 3-col picks, draft cards =====
    ".fo-i{vertical-align:-3px;flex:none}" +
    ".fo-ob-mid{max-width:980px;margin:0 auto}" +
    ".fo-ob-cols{display:grid;grid-template-columns:1fr 264px;gap:26px;align-items:start}" +
    ".fo-ob-snap{background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:16px;padding:16px}" +
    ".fo-ob-snaph{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#667085;font-weight:800;margin-bottom:10px}" +
    ".fo-snap-row{display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(7,22,46,.13)}.fo-snap-row:last-child{border-bottom:none}" +
    ".fo-snap-row i{width:34px;height:34px;border-radius:9px;background:rgba(77,166,162,.12);color:#2b6b68;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".fo-snap-row b{display:block;font-size:13.5px}.fo-snap-row span{display:block;font-size:11px;color:#9a9484}" +
    ".fo-ob-input:disabled{opacity:.55;cursor:not-allowed}" +
    ".fo-ob-ck{position:absolute;right:-7px;bottom:-7px;width:20px;height:20px;border-radius:50%;background:" + TEAL + ";color:#07162E;display:flex;align-items:center;justify-content:center;border:2px solid #101a2a}" +
    ".fo-ob-jic{color:#111827}.fo-jic-teal{background:rgba(77,166,162,.16);color:#2b6b68}.fo-jic-terra{background:rgba(200,103,74,.16);color:" + TERRA + "}" +
    ".fo-ob-tic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:9px}.fo-tic-teal{background:rgba(77,166,162,.13);color:#2b6b68}.fo-tic-terra{background:rgba(200,103,74,.14);color:" + TERRA + "}" +
    ".fo-ob-chks{display:grid;gap:8px;margin:2px 0 16px}" +
    ".fo-ob-chk{display:flex;gap:9px;align-items:center;font-size:13.5px;color:#37424f}.fo-ob-chk b{color:#111827}.fo-ob-chk i{color:#4DA66D;display:flex}" +
    ".fo-ob-warn{display:flex;gap:9px;align-items:center}.fo-ob-warn i{display:flex;flex:none}" +
    ".fo-ob-note{display:flex;gap:8px;align-items:center}.fo-ob-note i{display:flex;flex:none;color:#2b6b68}" +
    ".fo-ob-act-c{justify-content:center}" +
    // 3-col selectable cards (style + sponsor)
    ".fo-pks{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;align-items:stretch}" +
    ".fo-pk{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;background:#f7f4ec;border:1.5px solid rgba(7,22,46,.13);border-radius:16px;padding:16px 15px 14px;cursor:pointer;color:#111827}" +
    ".fo-pk:hover{border-color:rgba(7,22,46,.25)}" +
    ".fo-pk.on{border-color:var(--tc);box-shadow:0 0 0 3px color-mix(in srgb,var(--tc) 26%,transparent)}" +
    ".fo-rec-ghost{visibility:hidden}" +
    ".fo-pk .fo-ob-rec{margin-bottom:9px}" +
    ".fo-pk-ic{width:46px;height:46px;border-radius:12px;background:color-mix(in srgb,var(--tc) 14%,transparent);color:var(--tc);display:flex;align-items:center;justify-content:center;margin-bottom:7px}" +
    ".fo-pk-name{font-size:16.5px;font-weight:800}" +
    ".fo-pk-tag{font-size:12px;color:#7a7566;line-height:1.45;min-height:34px;margin-top:2px}" +
    ".fo-pk-rows{width:100%;margin-top:9px;border-top:1px solid rgba(7,22,46,.13);padding-top:4px}" +
    ".fo-pk-row{display:flex;justify-content:space-between;align-items:center;padding:6px 2px;font-size:12px;color:#667085}.fo-pk-row b{color:#111827;font-size:12.5px;display:flex;align-items:center;gap:6px}" +
    ".fo-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.fo-dot-teal{background:" + TEAL + "}.fo-dot-terra{background:" + TERRA + "}.fo-dot-gold{background:#F59E0B}" +
    ".fo-sp-big{margin:8px 0 2px;font-size:24px;font-weight:800}.fo-sp-big i{display:block;font-style:normal;font-size:10.5px;font-weight:600;letter-spacing:.03em;color:#9a9484;text-transform:uppercase;margin-top:1px}" +
    ".fo-sp-lines{display:grid;gap:3px;font-size:12px;color:#4a5460;min-height:52px;margin-top:5px}" +
    ".fo-sp-scen{width:100%;margin-top:10px;background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:11px;padding:8px 11px}" +
    ".fo-sp-sh{display:flex;justify-content:space-between;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#a8a291;font-weight:700;padding-bottom:4px}" +
    ".fo-sp-srow{display:flex;justify-content:space-between;font-size:11.5px;color:#6d7480;padding:3.5px 0;border-top:1px solid rgba(7,22,46,.13)}.fo-sp-srow b{color:#111827}" +
    // draft player cards (the game's own card, brand-themed)
    ".fo-dr-sorts{margin-top:-4px}.fo-dr-sortlbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#ada797;font-weight:700;margin-right:2px}" +
    ".fo-dr-sort{padding:4px 11px;font-size:11.5px}" +
    ".fo-dr-none{padding:30px;text-align:center;color:#9a9484}" +
    ".fo-dc{background:#fcfaf5;border:1px solid rgba(7,22,46,.11);border-radius:12px;padding:8px 12px;margin-bottom:7px}" +
    ".fo-dc-in{border-color:rgba(200,103,74,.55);background:rgba(200,103,74,.08)}" +
    ".fo-dc-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}" +
    ".fo-dc-nm{font-size:14.5px;cursor:pointer}.fo-dc-nm:hover{color:#2b6b68}" +
    ".fo-dc-meta{font-size:11.5px;color:#667085}.fo-dc-meta b{color:#243040}" +
    ".fo-dc-fee{margin-left:auto;font-size:14.5px;font-weight:800}" +
    ".fo-dc-sub{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11.5px;color:#667085;margin:5px 0 9px}" +
    ".fo-dc-tal{background:rgba(77,166,162,.1);border:1px solid rgba(77,166,162,.3);color:#2b6b68;font-size:9.5px;font-weight:700;padding:1.5px 7px;border-radius:999px;cursor:help}" +
    ".fo-dc-wage{margin-left:auto;font-variant-numeric:tabular-nums}" +
    ".fo-dc-bars{display:grid;grid-auto-flow:column;grid-template-rows:repeat(3,auto);grid-template-columns:repeat(3,1fr);gap:2px 16px}" +
    ".fo-db{display:flex;align-items:center;gap:6px;font-size:10px}.fo-db i{cursor:help}" +
    ".fo-db i{font-style:normal;width:54px;color:#9a9484;flex:none}" +
    ".fo-db b{flex:1;height:5px;border-radius:3px;background:#ece7da;overflow:hidden;display:block;min-width:40px}" +
    ".fo-db u{display:block;height:100%;border-radius:3px;background:" + TEAL + "}" +
    // bar colour tracks the value: weak red -> ordinary amber -> good teal -> elite green
    ".fo-sk-low{background:#DC2626 !important}.fo-sk-mid{background:#F59E0B !important}.fo-sk-good{background:" + TEAL + " !important}.fo-sk-elite{background:#16A34A !important}" +
    ".fo-dc-flag{font-size:15px;line-height:1}" +
    ".fo-db em{font-style:normal;width:70px;color:#4a5460;flex:none;text-align:right;white-space:nowrap;font-size:9.5px}" +
    "#fo-onb .fo-dr-add{width:auto;min-width:58px;padding:7px 15px;font-size:12.5px;border-radius:9px}" +
    // board report split
    ".fo-br-cols{display:grid;grid-template-columns:1fr 250px;gap:18px;align-items:start}" +
    ".fo-br-row span{display:flex;align-items:center;gap:8px}.fo-br-row span i{display:flex;color:#ada797}" +
    ".fo-br-panel{background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:14px;padding:13px 14px;margin-bottom:12px}" +
    ".fo-br-ph{display:flex;justify-content:space-between;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#9a9484;font-weight:800;margin-bottom:9px}.fo-br-ph b{color:#111827}" +
    ".fo-sq-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#7a7566;padding:4px 0}.fo-sq-row>span:first-child{width:86px;flex:none}.fo-sq-row b{margin-left:auto;color:#111827}" +
    ".fo-sqdots{display:flex;gap:3px}.fo-sqdot{width:7px;height:7px;border-radius:50%;background:#ece7da}.fo-sqdot.on{background:" + TEAL + "}" +
    ".fo-fin-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#7a7566;padding:4px 0}.fo-fin-row>span{width:46px;flex:none}" +
    ".fo-finbar{flex:1;height:6px;border-radius:3px;background:#ece7da;overflow:hidden}.fo-finbar u{display:block;height:100%;border-radius:3px}.fo-fin-teal{background:" + TEAL + "}.fo-fin-terra{background:" + TERRA + "}" +
    ".fo-fin-row em{font-style:normal;font-size:10.5px;color:#5d6570;width:64px;text-align:right;flex:none}" +
    ".fo-fin-end{margin-top:8px;padding-top:8px;border-top:1px solid rgba(7,22,46,.13);font-size:11.5px;color:#7a7566;display:flex;justify-content:space-between}.fo-fin-end b{font-size:13px}" +
    ".fo-ob-report{max-width:900px}" +
    "@media(max-width:860px){.fo-ob-cols{grid-template-columns:1fr}.fo-pks{grid-template-columns:1fr}.fo-br-cols{grid-template-columns:1fr}.fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none}.fo-pk-tag{min-height:0}.fo-sp-lines{min-height:0}}" +
    // squad panel + budget bar (draft sidebar)
    ".fo-budgetbar{height:6px;border-radius:3px;background:#ece7da;overflow:hidden;margin:2px 0 6px}" +
    ".fo-budgetbar u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ");transition:width .3s}" +
    ".fo-sq-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(7,22,46,.13);font-size:12px}" +
    ".fo-sq-item:last-child{border-bottom:none}" +
    ".fo-sq-item b{flex:1;font-weight:600;color:#111827;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-sq-item b:hover{color:#2b6b68}" +
    ".fo-sq-item em{font-style:normal;color:#7a7566;font-variant-numeric:tabular-nums}" +
    "#fo-onb .fo-sq-x{width:22px;height:22px;border-radius:7px;border:1px solid rgba(7,22,46,.13);background:transparent;color:#9a9484;font-size:10px;cursor:pointer;padding:0;line-height:1}" +
    "#fo-onb .fo-sq-x:hover{border-color:#DC2626;color:#c0392b}" +
    ".fo-sq-empty{font-size:12px;color:#a39d8d;padding:8px 0}" +
    // motion + micro-interactions
    ".fo-ob-card,.fo-ob-draftwrap{animation:foIn .3s ease}" +
    "@keyframes foIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
    ".fo-pk{transition:border-color .15s,box-shadow .15s,transform .15s}.fo-pk:hover{transform:translateY(-2px)}" +
    ".fo-dc{transition:border-color .15s,background .15s}.fo-dc:hover{border-color:rgba(7,22,46,.25)}" +
    "#fo-onb button{transition:filter .15s,transform .06s}#fo-onb button:active:not(:disabled){transform:translateY(1px)}" +
    "#fo-onb{font-variant-numeric:tabular-nums}" +
    // dark thin scrollbar inside the draft list
    ".fo-dr-tblwrap{scrollbar-width:thin;scrollbar-color:#7a7566 transparent}" +
    ".fo-dr-tblwrap::-webkit-scrollbar{width:9px}.fo-dr-tblwrap::-webkit-scrollbar-track{background:transparent}" +
    ".fo-dr-tblwrap::-webkit-scrollbar-thumb{background:#ece7da;border-radius:5px;border:2px solid #f4f0e6}.fo-dr-tblwrap::-webkit-scrollbar-thumb:hover{background:#ece7da}" +
    // beat the engine's default button/input styling inside the onboarding shell
    "#fo-onb button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-onb .fo-ob-cta{background:" + TERRA + " !important;color:#FFFEFC !important;border:none !important}" +
    "#fo-onb .fo-ob-ghost{background:transparent !important;color:#2f3a48 !important;border:1px solid rgba(7,22,46,.25) !important}" +
    "#fo-onb .fo-pk{background:#FFFEFC !important;color:#111827 !important}" +
    "#fo-onb .fo-dr-add{background:" + TERRA + " !important;color:#fff !important}#fo-onb .fo-dr-add.on{background:#f7f4ec !important;color:" + TERRA + " !important}" +
    "#fo-onb .fo-dr-chip{background:#f7f4ec !important;color:#545d68 !important}#fo-onb .fo-dr-chip.on{background:" + TERRA + " !important;color:#fff !important}" +
    "#fo-onb .fo-ob-input,#fo-onb .fo-dr-searchi{background:#f7f4ec !important;color:#111827 !important}" +
    "#fo-onb .fo-dr-tbl tbody tr td{background:transparent !important}" +
    "#fo-onb .fo-dr-tbl tbody tr.fo-dr-in td{background:rgba(200,103,74,.15) !important}" +
    "#fo-onb .fo-dr-tbl tbody tr:hover td{background:#ece7da !important}" +
    "#fo-onb .fo-dr-view{cursor:pointer;border-bottom:1px dotted rgba(7,22,46,.13)}#fo-onb .fo-dr-view:hover{color:#2b6b68}" +
    // player skill-summary popover
    "#fo-pd .fo-pd-back{position:fixed;inset:0;z-index:100001;background:rgba(8,16,29,.7);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#fo-pd .fo-pd-card{background:#ffffff;border:1px solid rgba(7,22,46,.13);border-radius:18px;padding:20px 22px;width:100%;max-width:420px;box-shadow:0 24px 60px rgba(0,0,0,.5);color:#111827}" +
    "#fo-pd .fo-pd-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}" +
    "#fo-pd .fo-pd-nm{font-size:19px;font-weight:800}#fo-pd .fo-pd-meta{font-size:12px;color:#7a7566;margin-top:3px}" +
    "#fo-pd .fo-pd-x{background:transparent;border:1px solid rgba(7,22,46,.25);color:#37424f;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px}" +
    "#fo-pd .fo-pd-money{display:flex;gap:8px;margin:14px 0}#fo-pd .fo-pd-money span{flex:1;background:#f7f4ec;border:1px solid rgba(7,22,46,.13);border-radius:10px;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:#9a9484;font-weight:700}#fo-pd .fo-pd-money b{display:block;font-size:14px;color:#111827;margin-top:2px;letter-spacing:0}" +
    "#fo-pd .fo-pd-sec{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#2b6b68;font-weight:800;margin-bottom:8px}" +
    "#fo-pd .fo-pd-bar{display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:12px}#fo-pd .fo-pd-bar span{width:78px;color:#5d6570}#fo-pd .fo-pd-bar i{flex:1;height:8px;background:#ece7da;border-radius:5px;overflow:hidden}#fo-pd .fo-pd-bar b{display:block;height:100%;background:" + TEAL + ";border-radius:5px}#fo-pd .fo-pd-bar em{width:74px;text-align:right;font-style:normal;color:#737a84;font-size:11px}" +
    "#fo-pd .fo-pd-tal{margin:12px 0;font-size:12.5px;color:#545d68}#fo-pd .fo-pd-tal b{color:#667085;text-transform:uppercase;font-size:10.5px;letter-spacing:.04em}" +
    "#fo-pd button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-pd .fo-pd-act{display:flex}#fo-pd .fo-pd-add{flex:1;background:" + TERRA + " !important;color:#fff !important;border:none;padding:11px;border-radius:10px;font-weight:700;font-size:13.5px;cursor:pointer}#fo-pd .fo-pd-add.on{background:#f7f4ec !important;color:" + TERRA + " !important;border:1px solid " + TERRA + "}" +
    // league standings · form pips + leader/user accents
    ".fo-standings td,.fo-standings th{padding:6px 8px}" +
    ".fo-standings tr.fo-lead td:nth-child(2){font-weight:700}" +
    "html body.ftpskin .fo-standings tr.fo-userrow td,.fo-standings tr.fo-userrow td{background:#fbf1ec !important}" +
    ".fo-standings tr.fo-userrow td:first-child{box-shadow:inset 3px 0 0 " + TERRA + "}" +
    ".fo-standings tr:hover td{background:#f4f1ea}" +
    ".fo-form{display:inline-flex;gap:3px;margin-left:7px;vertical-align:middle}" +
    ".fo-pip{width:8px;height:8px;border-radius:2px;display:inline-block;opacity:.9}" +
    ".fo-W{background:#16A34A}.fo-L{background:" + TERRA + "}.fo-T{background:#c3bdae}" +
    "#page a,.panel a{color:#B04A2C !important}" +
    // section headers -> navy
    "html body.ftpskin .panel>h4,html body.ftpskin .card-title,.panel>h4,.card-title,.panel>header,.card>h4,.sec>h4{background:" + NAVY2 + " !important;background-image:none !important;color:" + PAPER + " !important}" +
    // heroes / blue banners -> navy gradient
    "html body.ftpskin [class*=hero],html body.ftpskin [class*=club-home],[class*=hero],[class*=club-home],.page-head,.club-head{background:linear-gradient(160deg," + NAVY2 + "," + NAVY + ") !important;color:" + PAPER + " !important}" +
    // the broad [class*=hero] paint must not double-panel the scout hero's inner columns
    "html body.ftpskin .fo-scout-hero .fo-scout-hero-main,html body.ftpskin .fo-scout-hero .fo-scout-hero-r,html body .fo-scout-hero .fo-scout-hero-main,html body .fo-scout-hero .fo-scout-hero-r{background:none !important}" +
    // primary buttons -> terracotta
    "html body.ftpskin button.primary,html body.ftpskin .confirmbtn,button.primary,.confirmbtn,.btn-primary{background:" + TERRA + " !important;background-image:none !important;border-color:" + TERRA2 + " !important;color:" + PAPER + " !important}" +
    "button.primary:hover,.confirmbtn:hover{background:#b3573c !important}" +
    // mobile layout
    "@media(max-width:640px){" +
    "body{font-size:14px}" +
    "#page{padding:8px !important;overflow-x:hidden}" +
    // topbar WRAPS so every nav item is visible (nothing hidden off-screen)
    "html body.ftpskin #topbar,#topbar{flex-wrap:wrap !important;overflow:visible !important;scrollbar-width:none !important}" +
    "#topbar::-webkit-scrollbar{display:none;height:0}" +
    "html,body{overflow-x:clip}" +
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
    ".fo-gridcells{flex:1 1 100% !important;max-width:100%;white-space:normal !important;line-height:1.6}" +
    ".fo-gcell{margin:0 2px 3px 0 !important}" +
    ".fo-pool{overflow-x:auto}.fo-pooltabs{flex-wrap:wrap}" +
    // freeze the first column (player/date) so it stays visible while the rest scrolls
    "#page .panel table th:first-child,#page .panel table td:first-child{position:sticky;left:0;background:#FFFEFC;z-index:1;box-shadow:1px 0 0 rgba(0,0,0,.12)}" +
    "}" +
    // ===== deep engine-page polish (Matches / Stats / Office / live match) =====
    // page hero: finish the navy band properly · light text, padding, radius
    "#page .page-head{padding:20px 24px;border-radius:14px;box-shadow:0 12px 32px rgba(7,22,46,.18)}" +
    "#page .page-head h1{color:#FFFEFC !important}" +
    "#page .page-head p{color:rgba(246,244,238,.62) !important;margin:3px 0 0}" +
    "#page .page-head .eyebrow{color:#e79274 !important}" +
    "#page .page-head .action-row button{background:rgba(246,244,238,.1);color:#FFFEFC;border:1px solid rgba(246,244,238,.25);border-radius:9px;padding:8px 14px;cursor:pointer}" +
    "#page .page-head .action-row button:hover{background:rgba(246,244,238,.2)}" +
    "#page .page-head .action-row button.primary,#page .page-head .action-row .primary{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    "#page .page-head .action-row label{color:rgba(246,244,238,.8)}" +
    // panels: soft radius, refined title bar instead of flat black
    "#page .panel{border-radius:12px;overflow:hidden;border-color:#e4dfd2;box-shadow:0 3px 14px rgba(7,22,46,.06)}" +
    "#page .panel>h4{background:linear-gradient(160deg," + NAVY2 + "," + NAVY + ") !important;color:#FFFEFC;margin:0;padding:10px 14px;font-size:11.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:800}" +
    "#page .panel table th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484}" +
    // my club's row in any table: terracotta accent, not the engine's mint yellow
    "#page tr.fo-userrow{background:transparent !important}" +
    "#page tr.fo-userrow>td{background:rgba(200,103,74,.09) !important}" +
    "#page tr.fo-userrow>td:first-child{box-shadow:inset 3px 0 0 " + TERRA + "}" +
    // the engine skin paints 'your fixture' rows #feffcc · re-tint to the brand
    'html body.ftpskin tr[style*="eef4ee"] td,html body.ftpskin tr[style*="eef8fb"] td{background:rgba(200,103,74,.09) !important}' +
    'html body.ftpskin tr[style*="eef4ee"] td:first-child,html body.ftpskin tr[style*="eef8fb"] td:first-child{box-shadow:inset 3px 0 0 ' + TERRA + "}" +
    // office KPI tiles
    "#page .kpi-grid .kpi-card{border-radius:12px;border:1px solid #e4dfd2;box-shadow:0 3px 12px rgba(7,22,46,.05);transition:transform .15s,box-shadow .15s}" +
    "#page .kpi-grid .kpi-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(7,22,46,.1)}" +
    "#page .kpi-grid .kpi-card span{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#9a9484;font-weight:700}" +
    "#page .kpi-grid .kpi-card b{color:#111827}" +
    // live match: give the scoreboard visual weight
    "#page .mc-score .panel{border-top:3px solid " + TERRA + "}" +
    "#page .ftp-match-body{border-radius:12px}" +
    // home-pitch picker (create screen)
    ".fo-pitchgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}" +
    "#fo-onb .fo-pitch{text-align:left;background:#FFFEFC !important;border:1.5px solid rgba(7,22,46,.13);border-radius:12px;padding:10px 12px;cursor:pointer;color:#111827 !important}" +
    "#fo-onb .fo-pitch b{display:block;font-size:13px;margin-bottom:2px}" +
    "#fo-onb .fo-pitch span{font-size:11px;color:#667085;line-height:1.35;display:block}" +
    "#fo-onb .fo-pitch.on{border-color:#3d8a86;box-shadow:0 0 0 3px rgba(77,166,162,.22)}" +
    "@media(max-width:700px){.fo-pitchgrid{grid-template-columns:1fr 1fr}}" +
    ".fo-ob-eyebrow{color:#C95532;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px}" +
    ".fo-ob-lbl{font-weight:800 !important;color:#111827 !important;font-size:12px !important;letter-spacing:.09em}" +
    ".fo-ob-lbl .fo-ob-hint{font-weight:600;color:#667085}" +
    ".fo-pitch{border-left:4px solid #c9c2b2 !important}" +
    ".fo-pitch[data-pitch=balanced]{border-left-color:#4DA6A2 !important}" +
    ".fo-pitch[data-pitch=green]{border-left-color:#16A34A !important}" +
    ".fo-pitch[data-pitch=dry]{border-left-color:#C08A2F !important}" +
    ".fo-pitch[data-pitch=flat]{border-left-color:#4A7FC8 !important}" +
    ".fo-pitch[data-pitch=slow]{border-left-color:#667085 !important}" +
    ".fo-pitch[data-pitch=cracked]{border-left-color:#DC2626 !important}" +
    ".fo-pitch[data-pitch=twoPaced]{border-left-color:#8B6BB5 !important}" +
    ".fo-pitch b{color:#111827;font-size:13.5px}" +
    ".fo-ob-cta{padding:15px 40px !important;font-size:15.5px !important;font-weight:800 !important;border-radius:11px !important;box-shadow:0 5px 16px rgba(201,85,50,.38);letter-spacing:.01em}" +
    ".fo-ob-cta:hover{transform:translateY(-1px);box-shadow:0 7px 20px rgba(201,85,50,.5)}" +
    ".fo-ob-sep{flex:1 1 26px;min-width:18px;border-top:2px dotted #c9c2b2;margin:0 6px;align-self:center}" +
    ".fo-ob-prog{display:flex;align-items:center}" +
    ".fo-ob-step.done + .fo-ob-sep, .fo-ob-sep:has(+ .fo-ob-step.done)" + "{border-top-color:#C95532}" +
    ".fo-pitch{border-left-width:6px !important;position:relative;overflow:hidden}" +
    ".fo-pitch[data-pitch=balanced]{background:linear-gradient(90deg,rgba(77,166,162,.10),#fff 55%)}" +
    ".fo-pitch[data-pitch=green]{background:linear-gradient(90deg,rgba(62,153,96,.10),#fff 55%)}" +
    ".fo-pitch[data-pitch=dry]{background:linear-gradient(90deg,rgba(192,138,47,.12),#fff 55%)}" +
    ".fo-pitch[data-pitch=flat]{background:linear-gradient(90deg,rgba(74,127,200,.10),#fff 55%)}" +
    ".fo-pitch[data-pitch=slow]{background:linear-gradient(90deg,rgba(138,132,116,.12),#fff 55%)}" +
    ".fo-pitch[data-pitch=cracked]{background:linear-gradient(90deg,rgba(200,79,74,.10),#fff 55%)}" +
    ".fo-pitch[data-pitch=twoPaced]{background:linear-gradient(90deg,rgba(139,107,181,.10),#fff 55%)}" +
    ".fo-pitch[data-pitch=balanced] b{color:#2d7a76}.fo-pitch[data-pitch=green] b{color:#2f7a4c}.fo-pitch[data-pitch=dry] b{color:#96690f}" +
    ".fo-pitch[data-pitch=flat] b{color:#35619e}.fo-pitch[data-pitch=slow] b{color:#6b6552}.fo-pitch[data-pitch=cracked] b{color:#a23c37}.fo-pitch[data-pitch=twoPaced] b{color:#6b4f95}" +
    ".fo-pitch.on{box-shadow:0 0 0 2px rgba(201,85,50,.35);border-color:#C95532}" +
    ".fo-ob-act{display:block}" +
    ".fo-ob-cta{display:block !important;width:100% !important;padding:17px 20px !important;font-size:16px !important;text-align:center}" +
    ".fo-charter-big{max-width:880px !important;margin:0 auto;padding:64px 72px !important;min-height:62vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}" +
    ".fo-charter-h1{font-size:40px !important;letter-spacing:-.8px;margin:10px 0 2px !important}" +
    ".fo-charter-date{font-size:13px;font-weight:700;color:#667085;letter-spacing:.1em;text-transform:uppercase;margin:2px 0 14px}" +
    ".fo-charter-lead{font-size:16.5px !important;max-width:56ch}" +
    ".fo-charter-big .fo-charter-grant{margin:26px auto;padding:26px 60px}" +
    ".fo-charter-big .fo-charter-grant b{font-size:44px}" +
    ".fo-charter-big .fo-ob-act-c{width:100%;max-width:460px}" +
    "@media(max-width:700px){.fo-charter-big{padding:36px 22px !important;min-height:0}.fo-charter-h1{font-size:28px !important}.fo-charter-big .fo-charter-grant b{font-size:32px}}" +
    ".fo-sp-mono{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px;color:#fff;margin:0 auto 10px;font-family:Georgia,serif}" +
    ".fo-mono-teal{background:#2d7a76}.fo-mono-terra{background:#C95532}.fo-mono-gold{background:#A8842C}" +
    ".fo-sp-ind{display:block;font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#667085;margin:2px 0 10px}" +
    ".fo-sp-fine{display:block;font-size:10.5px;color:#a09a8a;border-top:1px dashed #DDD8CF;padding-top:9px;margin-top:12px}" +
    ".fo-pk-sp .fo-pk-name{display:none}" +
    ".fo-brandmark{display:flex;align-items:center;justify-content:center;height:56px;border-radius:10px;margin:0 auto 12px;width:100%;max-width:200px}" +
    ".fo-brand-pru{background:#ED1B2E;color:#fff;font-weight:800;font-size:15px;letter-spacing:.12em;font-family:Arial,Helvetica,sans-serif}" +
    ".fo-brand-nike{background:#111;color:#fff;font-weight:900;font-size:22px;letter-spacing:.06em;font-style:italic;transform:skewX(-6deg);font-family:'Futura','Arial Black',Arial,sans-serif}" +
    ".fo-brand-emirates{background:#FFFEFC;border:1px solid #eee;color:#D71920;font-weight:600;font-size:24px;font-family:Georgia,'Times New Roman',serif;letter-spacing:.01em}" +
    ".fo-exp-cols{display:grid;grid-template-columns:1fr 1.2fr;gap:20px;align-items:start;margin:6px 0 4px}" +
    ".fo-exp-card{background:#FFFEFC;border:1px solid #DDD8CF;border-radius:13px;padding:16px;box-shadow:0 4px 14px rgba(18,32,58,.06)}" +
    ".fo-exp-h{font-size:16px;color:#111827}.fo-exp-meta{font-size:12px;color:#667085;margin:2px 0 10px}" +
    ".fo-exp-bars .fo-sk{display:grid;grid-template-columns:76px 1fr 26px;gap:8px;align-items:center;margin:5px 0;font-size:12px}" +
    ".fo-exp-bars .fo-sk i{font-style:normal;color:#667085;font-weight:700}" +
    ".fo-exp-bars .fo-sk b{display:block;height:7px;border-radius:99px;background:#efeade;overflow:hidden}" +
    ".fo-exp-bars .fo-sk u{display:block;height:100%;border-radius:99px}" +
    ".fo-exp-bars .fo-sk em{font-style:normal;font-weight:800;color:#111827;text-align:right}" +
    ".fo-exp-tals{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}" +
    ".fo-exp-tal{background:#e8effa;border:1px solid #cfdcf2;color:#35619e;font-size:11.5px;font-weight:700;border-radius:999px;padding:4px 11px}" +
    ".fo-exp-note{margin-top:12px;font-size:11px;color:#a09a8a;border-top:1px dashed #DDD8CF;padding-top:8px;text-align:center}" +
    ".fo-exp-cards{display:flex;flex-direction:column;gap:14px}" +
    ".fo-exp-tag{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#C95532;margin-bottom:4px}" +
    ".fo-exp-money{display:flex;justify-content:space-between;gap:10px;background:#EEEAE1;border-radius:8px;padding:8px 12px;margin:8px 0 10px;font-size:12.5px;color:#667085}" +
    ".fo-exp-money b{color:#111827;font-size:13.5px}" +
    ".fo-dr-sticky{position:sticky;top:0;z-index:40;background:rgba(238,234,225,.96);backdrop-filter:blur(4px);border-bottom:1px solid #DDD8CF;padding:10px 2px;margin-bottom:14px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}" +
    ".fo-dr-spent{flex:1;min-width:240px}" +
    ".fo-dr-spentl{display:flex;justify-content:space-between;font-size:12.5px;color:#667085;margin-bottom:5px}" +
    ".fo-dr-spentl b{color:#111827}" +
    ".fo-dr-counts{display:flex;gap:7px}" +
    ".fo-dr-main{min-width:0}" +
    ".fo-rail{max-width:100%}" +
    ".fo-str-row{display:grid;grid-template-columns:88px 1fr 30px;gap:9px;align-items:center;margin:8px 0;font-size:12.5px}" +
    ".fo-str-row span{color:#667085;font-weight:700}" +
    ".fo-str-bar{display:block;height:8px;border-radius:99px;background:#efeade;overflow:hidden}" +
    ".fo-str-bar u{display:block;height:100%;border-radius:99px}" +
    ".fo-str-row em{font-style:normal;font-weight:800;color:#111827;text-align:right}" +
    ".fo-fin-row2{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#667085;padding:7px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-fin-row2 b{font-size:13.5px}" +
    ".fo-fin-bank{border-bottom:none;margin-top:2px}" +
    ".fo-fin-bank b{font-size:16px;color:#111827}" +
    ".fo-facts{margin:6px 0 4px}" +
    ".fo-fact{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:9px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-fact span{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#667085}" +
    ".fo-fact b{font-size:14px;color:#111827;font-weight:700;text-align:right}" +
    ".fo-segs{display:inline-flex;gap:5px;align-items:center}" +
    ".fo-seg{width:26px;height:8px;border-radius:99px;transition:background .15s ease}" +
    ".fo-segt-low{background:rgba(200,79,74,.14)}.fo-segt-low.on{background:#DC2626}" +
    ".fo-segt-mid{background:rgba(217,164,65,.16)}.fo-segt-mid.on{background:#F59E0B}" +
    ".fo-segt-good{background:rgba(77,166,162,.15)}.fo-segt-good.on{background:#4DA6A2}" +
    ".fo-segt-elite{background:rgba(62,153,96,.15)}.fo-segt-elite.on{background:#16A34A}" +
    ".fo-str-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-str-row:last-child{border-bottom:none}" +
    ".fo-str-row span:first-child{color:#111827;font-weight:600;font-size:13.5px;letter-spacing:-.1px}" +
    ".fo-fact span{font-size:10.5px}" +
    ".fo-fact b{font-size:13.5px;font-weight:600}" +
    ".fo-br-ph{font-size:11px;letter-spacing:.12em;color:#a09a8a}" +
    ".fo-br-cols{align-items:stretch}" +
    ".fo-br-side{display:flex;flex-direction:column;gap:14px}" +
    "body,#page,#topbar,#fo-onb,button,input,select,textarea{font-family:'Inter',ui-sans-serif,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif !important}" +
    "body{-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}" +
    ".fo-ch-name{font-weight:800;letter-spacing:-.8px}" +
    ".fo-stat-v{font-weight:700 !important}" +
    ".fo-stat-l{font-weight:600 !important;letter-spacing:.1em !important;color:#9a9484 !important}" +
    ".fo-card-h2,.fo-card-h{font-weight:700;letter-spacing:-.1px}" +
    ".fo-mchip{font-weight:600}" +
    ".fo-next-opp{font-weight:800;letter-spacing:-.4px}" +
    ".fo-stat-word{font-size:clamp(14px,4vw,19px);font-weight:700;letter-spacing:-.2px}" +
    ".fo-cty.on{border-color:#C95532 !important;background:#fdf3e2 !important;box-shadow:0 0 0 2px rgba(201,85,50,.28) !important;color:#111827 !important;font-weight:800 !important}" +
    ".fo-cty.on::after{content:'\\2713';margin-left:auto;color:#C95532;font-weight:800}" +
    ".fo-pitch.on{border-color:#C95532 !important;box-shadow:0 0 0 2px rgba(201,85,50,.28) !important;background:#fdf9ef !important}" +
    ".fo-pitch.on b::after{content:' \\2713';color:#C95532}" +
    ".fo-pk.on{border-color:#C95532 !important;box-shadow:0 0 0 2px rgba(201,85,50,.28) !important;background:#fdf9ef !important}" +
    ".fo-orders-bar{position:sticky;top:0;z-index:30;background:rgba(238,234,225,.97);backdrop-filter:blur(4px);border-bottom:1px solid #DDD8CF;padding:10px 2px;margin-bottom:12px}" +
    ".fo-coach-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}" +
    ".fo-autopick{background:#C95532 !important;color:#fff !important;border:0;border-radius:9px;padding:10px 18px;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 3px 10px rgba(201,85,50,.3)}" +
    ".fo-coach-hint{font-size:12px;color:#667085}" +
    ".fo-ready{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}" +
    ".fo-rdy{font-size:11.5px;font-weight:700;border-radius:999px;padding:4px 11px;background:#f3efe4;border:1px solid #DDD8CF;color:#667085}" +
    ".fo-rdy.ok{background:#eef4ee;border-color:#d5e0d7;color:#15803D}" +
    ".fo-fit{display:inline-block;min-width:28px;text-align:center;font-weight:800;font-size:11.5px;border-radius:7px;padding:2px 6px;color:#fff}" +
    ".fo-fit-elite{background:#16A34A}.fo-fit-good{background:#4DA6A2}.fo-fit-mid{background:#F59E0B}.fo-fit-low{background:#DC2626}" +
    // match centre: quieter header boxes, readable links rail
    ".fo-matchpage .mc-top .panel .pad{padding:8px 12px !important}" +
    ".fo-matchpage .mc-top h4{font-size:12px !important;padding:7px 12px !important}" +
    ".fo-matchpage .mc-top .kv td{padding:3px 8px !important;font-size:12.5px !important}" +
    "html body .ftp-match-links,html body.ftpskin .ftp-match-links{background:#FFFEFC !important;border:1px solid #DDD8CF !important;border-radius:12px;overflow:hidden}" +
    "html body .ftp-match-links h4,html body.ftpskin .ftp-match-links h4{background:#07162E !important;color:#FFFEFC !important;font-size:12px !important;letter-spacing:.08em;text-transform:uppercase;padding:10px 14px !important;border-radius:0 !important}" +
    "html body .ftp-match-links a,html body.ftpskin .ftp-match-links a{display:block;padding:9px 14px !important;color:#3c4658 !important;background:transparent !important;border-left:3px solid transparent !important;border-bottom:1px solid #f0ece1 !important;font-weight:600;font-size:13px !important;text-decoration:none}" +
    "html body .ftp-match-links a:hover,html body.ftpskin .ftp-match-links a:hover{background:#EEEAE1 !important;color:#111827 !important}" +
    "html body .ftp-match-links a.on,html body.ftpskin .ftp-match-links a.on{background:rgba(201,85,50,.1) !important;color:#111827 !important;border-left-color:#C95532 !important;font-weight:800}" +
    // opponent scout page: contrast pass
    ".fo-scout-hero{background:linear-gradient(135deg,#07162E,#0E233F) !important;color:#e9eef2 !important}" +
    ".fo-scout-hero .fo-scout-name{color:#fff !important}" +
    ".fo-scout-hero .small,.fo-scout-hero span{color:#9aa3b2}" +
    ".fo-scout-kpis b{color:#fff !important}" +

    // the Live Match link is the loudest thing in the nav while a match runs
    "#topbar a.fo-live{background:#C95532 !important;color:#fff !important;border-radius:9px;padding:6px 13px !important;font-weight:800;animation:foPulse 2.2s ease-in-out infinite}" +
    ".fo-setr-done{background:#15803D !important;color:#fff !important;border-color:#15803D !important}" +
    ".fo-setr-done:hover{background:#275a3b !important}" +
    ".fo-next-cta.fo-done{background:#15803D !important;color:#fff !important;border:none;box-shadow:0 3px 10px rgba(47,107,70,.3)}" +
    ".fo-md-live{color:#ff6b5e;font-weight:800;letter-spacing:.08em;animation:foPulse 1.6s ease-in-out infinite;background:rgba(255,107,94,.12);border-radius:8px;padding:6px 12px}" +
    ".fo-br-closure{margin-top:18px;font-size:14px;line-height:1.7;color:#3c4658}" +
    ".fo-br-closure p{margin:0 0 10px}" +
    ".fo-br-luck{font-weight:800;color:#111827}" +
    ".fo-rail-sec{margin:0 0 22px;position:relative}" +
    ".fo-rail-sec::after{content:'\\203A';position:absolute;right:2px;top:56px;bottom:18px;width:40px;display:flex;align-items:center;justify-content:flex-end;padding-right:4px;font-size:26px;font-weight:800;color:#b3552e;background:linear-gradient(90deg,rgba(238,234,225,0),#EEEAE1 78%);pointer-events:none;border-radius:0 12px 12px 0}" +
    ".fo-dr-coach{position:relative;background:#eef4ee;border:1px solid #d5e0d7;border-radius:13px;padding:13px 40px 13px 16px;margin:0 0 14px}" +
    ".fo-dr-coach b{font-size:13.5px;color:#111827}" +
    ".fo-dr-coach-x{position:absolute;top:8px;right:8px;background:transparent;border:none;color:#667085;font-size:14px;cursor:pointer;padding:4px 6px}" +
    ".fo-dr-steps{display:flex;flex-direction:column;gap:6px;margin-top:8px}" +
    ".fo-dr-steps span{display:block;position:relative;padding-left:27px;font-size:12.5px;color:#3c4658;line-height:1.5}" +
    ".fo-dr-steps span b{font-size:inherit}" +
    ".fo-dr-steps span i{position:absolute;left:0;top:1px;width:18px;height:18px;border-radius:99px;background:#15803D;color:#fff;font-style:normal;font-weight:800;font-size:11px;display:inline-flex;align-items:center;justify-content:center}" +
    ".fo-rail-h{display:flex;align-items:baseline;gap:10px;margin:0 0 9px}" +
    ".fo-rail-h b{font-size:16px;color:#111827}" +
    ".fo-rail-h span{font-size:12px;color:#667085}" +
    ".fo-rail-have{margin-left:auto;font-style:normal;font-size:11.5px;font-weight:800;color:#15803D;background:#eef4ee;border:1px solid #d5e0d7;border-radius:999px;padding:3px 10px}" +
    ".fo-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 12px;scrollbar-width:thin}" +
    ".fo-rail>*{flex:0 0 258px;scroll-snap-align:start}" +
    ".fo-rail::-webkit-scrollbar{height:8px}" +
    ".fo-rail::-webkit-scrollbar-thumb{background:#d8d2c2;border-radius:99px}" +
    "@media(max-width:760px){.fo-rail>*{flex-basis:238px}.fo-dr-sticky{top:0;gap:10px}}" +
    ".fo-exp-def{padding:8px 0;border-bottom:1px solid #efeade;font-size:13px}" +
    ".fo-exp-def .fo-exp-gt{display:inline-block;margin-right:8px;color:#111827;font-weight:800}.fo-exp-def span{color:#667085}" +
    ".fo-exp-gnote{font-size:11px;color:#a09a8a;font-style:italic}" +
    ".fo-exp-dh{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#C95532;margin:4px 0 0}" +
    ".fo-exp-tr{display:flex;gap:9px;margin:5px 0;font-size:12.5px;line-height:1.5}" +
    ".fo-exp-tr i{font-style:normal;flex:0 0 92px;font-weight:700;color:#111827}" +
    ".fo-exp-tr span{color:#667085;flex:1;min-width:0}" +
    ".fo-exp-ovr{display:flex;gap:8px;margin:8px 0 0}" +
    ".fo-exp-ovr span{flex:1;background:#EEEAE1;border:1px solid #e8e3d5;border-radius:9px;padding:7px 10px;display:flex;flex-direction:column;gap:1px}" +
    ".fo-exp-ovr i{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#667085}" +
    ".fo-exp-ovr b{font-size:17px;color:#111827;line-height:1.1}" +
    ".fo-exp-talbox{background:#eef4ee;border:1px solid #d5e0d7;border-radius:11px;padding:13px 16px;font-size:13.5px;line-height:1.6;margin-top:16px}" +
    "@media(max-width:760px){.fo-exp-cols{grid-template-columns:1fr}}" +
    ".fo-exp-card .fo-sq-detail{padding:0;background:transparent;border:none;margin-top:4px}" +
    ".fo-exp-card .fo-sq-dcols{display:block}" +
    ".fo-exp-card .fo-sq-train,.fo-exp-card .fo-sq-dfoot a,.fo-exp-card .fo-sq-promote{display:none !important}" +
    ".fo-cnd-sec{margin:24px 0 6px}" +
    ".fo-cnd-h{display:flex;align-items:center;gap:9px;margin:0 0 10px;flex-wrap:wrap}" +
    ".fo-cnd-no{width:22px;height:22px;border-radius:50%;background:#C95532;color:#fff;font-weight:800;font-size:11.5px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 22px}" +
    ".fo-cnd-h b{font-size:15px;color:#111827}" +
    ".fo-cnd-h span{font-size:12px;color:#667085}" +
    ".fo-cnd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(214px,1fr));gap:10px}" +
    ".fo-cnd-grid5{grid-template-columns:repeat(auto-fit,minmax(166px,1fr))}" +
    ".fo-cnd{background:var(--cbg,#fff);border:1px solid var(--cbd,#DDD8CF);border-radius:11px;padding:11px 13px 12px;box-shadow:0 2px 8px rgba(18,32,58,.05);display:flex;flex-direction:column}" +
    ".fo-cnd-t{display:flex;align-items:center;gap:7px;flex-wrap:wrap}" +
    ".fo-cnd-t b{font-size:13.5px;color:var(--cink,#111827);letter-spacing:-.1px}" +
    ".fo-cnd-ic{width:24px;height:24px;border-radius:8px;background:rgba(255,255,255,.85);border:1px solid var(--cbd,#DDD8CF);color:var(--cink,#111827);display:inline-flex;align-items:center;justify-content:center;flex:0 0 24px}" +
    ".fo-cnd p{margin:6px 0 0;font-size:12.5px;line-height:1.5;color:#4d5666}" +
    ".fo-cnd-ex{font-style:italic;color:var(--cink,#667085) !important;opacity:.75;font-size:11.5px !important;border-top:1px dashed var(--cbd,#efeade);padding-top:7px;margin-top:auto !important}" +
    ".fo-cnd p+.fo-cnd-ex{margin-top:8px !important}" +
    ".fo-cnd-chip{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 9px;white-space:nowrap}" +
    ".fo-cnd-rare{background:linear-gradient(135deg,#F59E0B,#c08a2b);color:#fff;box-shadow:0 1px 4px rgba(160,110,20,.3)}" +
    ".fo-cnd-com{background:rgba(255,255,255,.8);border:1px solid var(--cbd,#DDD8CF);color:#667085}" +
    ".fo-cnd-drain{background:#FFFEFC;border:1px solid #e8b4a0;color:#a33a1d}" +
    // one tint per card: bowling styles
    ".fo-cnd--ember{--cbg:#FBEDE5;--cbd:#EFCDB8;--cink:#A33A1D}" +
    ".fo-cnd--plum{--cbg:#F5F0F7;--cbd:#DCCCE4;--cink:#6B4A91}" +
    ".fo-cnd--slate{--cbg:#EFF3F8;--cbd:#CBD8E8;--cink:#35619E}" +
    ".fo-cnd--stone{--cbg:#F7F5F0;--cbd:#DDD8CF;--cink:#5D6779}" +
    ".fo-cnd--sage{--cbg:#EFF5EC;--cbd:#CFE0CB;--cink:#2F6B46}" +
    // pitches
    ".fo-cnd--grass{--cbg:#EBF4EA;--cbd:#C7DEC6;--cink:#2F6B46}" +
    ".fo-cnd--clay{--cbg:#F8EFE3;--cbd:#E7D3B4;--cink:#8A5A1D}" +
    ".fo-cnd--cream{--cbg:#FCF8EC;--cbd:#EADFB8;--cink:#94742A}" +
    ".fo-cnd--olive{--cbg:#F3F4E8;--cbd:#DBDDBE;--cink:#6B6D2F}" +
    ".fo-cnd--rust{--cbg:#FAEDEA;--cbd:#EBC9C0;--cink:#96402E}" +
    ".fo-cnd--iris{--cbg:#F0F1FA;--cbd:#D2D5EE;--cink:#4A4F9E}" +
    // weather
    ".fo-cnd--sun{--cbg:#FEF8E0;--cbd:#F2DE9E;--cink:#A07711}" +
    ".fo-cnd--greyc{--cbg:#F1F2F4;--cbd:#D6DAE0;--cink:#5B6472}" +
    ".fo-cnd--mist{--cbg:#F0F4F6;--cbd:#D3DEE4;--cink:#557286}" +
    ".fo-cnd--humid{--cbg:#EDF5F1;--cbd:#C8E0D5;--cink:#2D7A68}" +
    ".fo-cnd--hotc{--cbg:#FCF0E4;--cbd:#F0CFA8;--cink:#B35C15}" +
    ".fo-cnd--scorch{--cbg:#FBE9E2;--cbd:#EFC0AC;--cink:#A33A1D}" +
    ".fo-cnd--rain{--cbg:#ECF2F9;--cbd:#C9DAEE;--cink:#3C6394}" +
    ".fo-cnd--windc{--cbg:#EDF6F8;--cbd:#C6E2E8;--cink:#2B7683}" +
    ".fo-cnd--ice{--cbg:#F0F6FB;--cbd:#CFE2F0;--cink:#3E6E99}" +
    ".fo-cnd--dusk{--cbg:#F2EFF8;--cbd:#D8CFEA;--cink:#5B4A91}" +
    "@media(max-width:640px){.fo-cnd-grid{grid-template-columns:1fr 1fr}.fo-cnd-ex{display:none}}" +
    ".fo-heat-note{background:#fdf3e2;border:1px solid #ecd9ae;border-left:4px solid #C95532;border-radius:10px;padding:10px 14px;margin:0 0 12px;font-size:13px;color:#5d4a2f;line-height:1.55}" +
    ".fo-heat-note b{color:#8a2f1d}" +
    ".fo-ctygrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:2px 0 14px}" +
    ".fo-cty{display:flex;align-items:center;gap:8px;background:#FFFEFC;border:1px solid #DDD8CF;border-radius:10px;padding:9px 11px;cursor:pointer;font-size:13px;font-weight:600;color:#3c4658;text-align:left;transition:border-color .12s ease,box-shadow .12s ease}" +
    ".fo-cty i{font-style:normal;font-size:17px;line-height:1}" +
    ".fo-cty:hover{border-color:#c9c2b2}" +
    ".fo-cty.on{border-color:#C95532;box-shadow:0 0 0 2px rgba(201,85,50,.18);color:#111827;font-weight:800}" +
    ".fo-clubprev{background:linear-gradient(135deg,#07162E,#0E233F);border-radius:12px;padding:16px;margin-bottom:14px;text-align:center}" +
    ".fo-clubprev-crest{width:52px;height:52px;border-radius:50%;background:#C95532;color:#fff;font-weight:800;font-size:17px;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;margin:0 auto 8px}" +
    ".fo-clubprev-nm{color:#fff;font-weight:800;font-size:16px;letter-spacing:-.2px}" +
    ".fo-clubprev-sub{color:#9aa3b2;font-size:11.5px;margin-top:3px}" +
    "@media(max-width:860px){.fo-ctygrid{grid-template-columns:repeat(3,1fr)}}" +
    "@media(max-width:560px){.fo-ctygrid{grid-template-columns:repeat(2,1fr)}}" +
    // charter (club founded) screen
    ".fo-ob-charter{text-align:center}" +
    ".fo-charter-ic{width:64px;height:64px;border-radius:50%;background:rgba(200,103,74,.12);color:#a95f38;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}" +
    ".fo-charter-grant{background:#FFFEFC;border:1px solid #e4dfd2;border-radius:14px;padding:14px;margin:6px 0 16px}" +
    ".fo-charter-grant span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#9a9484;font-weight:700}" +
    ".fo-charter-grant b{display:block;font-size:30px;font-weight:800;color:#2b6b68;margin:2px 0}" +
    ".fo-ob-charter .fo-ob-chks{display:inline-grid;margin:0 auto 4px}" +
    // training & youth page
    ".fo-tr-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-tr-tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484;padding:7px 8px;border-bottom:1px solid rgba(7,22,46,.1)}" +
    ".fo-tr-tbl td{padding:8px;border-bottom:1px solid rgba(7,22,46,.06);vertical-align:middle}" +
    ".fo-tr-nm b{color:#111827}.fo-tr-meta{display:block;font-size:11px;color:#9a9484}" +
    ".fo-pot{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2.5px 9px;border-radius:999px}" +
    ".fo-pot-star{background:rgba(217,164,65,.15);color:#a97b1e;border:1px solid rgba(217,164,65,.45)}" +
    ".fo-pot-high{background:rgba(62,153,96,.12);color:#2e7d4f;border:1px solid rgba(62,153,96,.4)}" +
    ".fo-pot-useful{background:rgba(77,166,162,.1);color:#2b6b68;border:1px solid rgba(77,166,162,.35)}" +
    ".fo-pot-limited{background:rgba(7,22,46,.05);color:#667085;border:1px solid rgba(7,22,46,.12)}" +
    ".fo-fat{font-size:11.5px;font-weight:600}.fo-fat-ok{color:#2e7d4f}.fo-fat-mid{color:#a97b1e}.fo-fat-bad{color:#c0392b}" +
    "#page .fo-tr-tbl select{font:inherit;font-size:12px;padding:5px 8px;border:1px solid #d8d2c2;border-radius:8px;background:#FFFEFC;color:#111827;max-width:150px}" +
    ".fo-tr-progress{min-width:150px}.fo-tr-bar{height:6px;border-radius:3px;background:#ece7da;overflow:hidden;margin-bottom:3px}" +
    ".fo-tr-bar u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + ",#16A34A)}" +
    ".fo-tr-progress span{font-size:10.5px;color:#9a9484}" +
    ".fo-tr-bulk{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:10px}" +
    "#page .fo-tr-b{font-size:12px;padding:6px 12px;border:1px solid #d8d2c2;background:#FFFEFC;color:#243040;border-radius:8px;cursor:pointer}" +
    "#page .fo-tr-b:hover{border-color:" + TEAL + ";color:#2b6b68}" +
    ".fo-tr-rep .fo-tr-g{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#2e7d4f}" +
    ".fo-tr-rep .fo-tr-rec{color:#2b6b68}.fo-tr-rep .fo-tr-sign{color:#a95f38;font-weight:700}" +
    ".fo-ycs{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}" +
    ".fo-yc{background:#FFFEFC;border:1px solid #e4dfd2;border-radius:12px;padding:13px 14px}" +
    ".fo-yc-genc{border-color:#F59E0B;box-shadow:0 0 0 2px rgba(217,164,65,.3),0 4px 16px rgba(217,164,65,.2);background:linear-gradient(180deg,#FFFDF6,#FFFEFC)}" +
    ".fo-yt{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:2px 9px;margin:5px 0 2px}" +
    ".fo-yt-raw{background:#f3efe4;border:1px solid #DDD8CF;color:#667085}" +
    ".fo-yt-prom{background:#e8f2f1;border:1px solid #c6dedd;color:#2b6b68}" +
    ".fo-yt-gift{background:#fdf3dc;border:1px solid #ecd28f;color:#8a6512}" +
    ".fo-yt-gen{background:linear-gradient(135deg,#F59E0B,#c08a2b);color:#fff;box-shadow:0 1px 5px rgba(160,110,20,.35)}" +
    ".fo-yc-h{display:flex;align-items:center;gap:7px;font-size:14px}.fo-yc-h b{color:#111827;flex:1}" +
    ".fo-yc-meta{font-size:11.5px;color:#667085;margin:3px 0 8px}" +
    ".fo-yc-bars{display:grid;gap:4px;margin-bottom:8px}" +
    ".fo-yc .fo-sk i{color:#9a9484;width:34px}.fo-yc .fo-sk b{background:#ece7da}.fo-yc .fo-sk em{color:#5d6570}" +
    ".fo-yc-money{display:flex;justify-content:space-between;font-size:11.5px;color:#667085;margin-bottom:9px}.fo-yc-money b{color:#111827}" +
    "#page .fo-yc-sign{width:100%;padding:9px;border:none !important;border-radius:9px;background:" + TERRA + " !important;color:#fff !important;font-weight:700;cursor:pointer}" +
    "#page .fo-yc-sign:hover:not(:disabled){filter:brightness(1.07)}#page .fo-yc-sign:disabled{opacity:.45;cursor:default}" +
    ".fo-mk-gone{font-size:11.5px;font-weight:700;color:#667085;background:#ece7da;border-radius:9px;padding:8px;text-align:center}" +
    // game manual
    ".fo-man{max-width:880px}" +
    ".fo-man .fo-man-toc{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 16px}" +
    ".fo-man .fo-man-toc a{font-size:12px;font-weight:700;color:#1f4e5f;background:#e8efe9;border:1px solid #d5e0d7;border-radius:999px;padding:5px 12px;text-decoration:none;cursor:pointer}" +
    ".fo-man .fo-man-toc a:hover{background:#dce8de}" +
    ".fo-man details{background:#FFFEFC;border:1px solid #DDD8CF;border-radius:12px;margin:0 0 10px;overflow:hidden}" +
    ".fo-man summary{cursor:pointer;list-style:none;font-weight:800;font-size:15px;color:#111827;padding:13px 16px;display:flex;align-items:center;gap:10px}" +
    ".fo-man summary::-webkit-details-marker{display:none}" +
    ".fo-man summary:before{content:'+';font-weight:800;color:#C95532;width:16px;text-align:center;flex:0 0 16px}" +
    ".fo-man details[open] summary:before{content:'\\2212'}" +
    ".fo-man details[open] summary{border-bottom:1px solid #efeade}" +
    ".fo-man .fo-man-b{padding:12px 16px 16px;font-size:13.5px;line-height:1.65;color:#3c4658}" +
    ".fo-man .fo-man-b p{margin:0 0 10px}" +
    ".fo-man .fo-man-b ul{margin:0 0 10px;padding-left:20px}" +
    ".fo-man .fo-man-b li{margin:3px 0}" +
    ".fo-man .fo-man-b table{width:100%;border-collapse:collapse;margin:4px 0 12px;font-size:12.5px}" +
    ".fo-man .fo-man-b th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#667085;padding:5px 8px;border-bottom:1px solid #DDD8CF}" +
    ".fo-man .fo-man-b td{padding:6px 8px;border-bottom:1px solid #f0ece1;vertical-align:top}" +
    ".fo-man .fo-man-b td b{color:#111827}" +
    ".fo-man .fo-man-tip{background:#eef4ee;border:1px solid #d5e0d7;border-radius:9px;padding:9px 12px;margin:2px 0 10px;font-size:12.5px}" +
    ".fo-man .fo-man-tip b{color:#1f4e5f}" +
    ".fo-mk-claimed{opacity:.6}" +
    ".fo-yc-view,.fo-mk-view{cursor:pointer}.fo-yc-view:hover,.fo-mk-view:hover{color:#2b6b68 !important}" +
    ".fo-yc-note{font-size:12.5px;color:#5d6570;background:rgba(77,166,162,.07);border:1px solid rgba(77,166,162,.2);border-radius:9px;padding:8px 12px;margin-bottom:11px}" +
    // season progress + momentum chips (club page psychology strip)
    ".fo-season-strip{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 14px}" +
    ".fo-progress{flex:1 1 260px;min-width:220px;background:#FFFEFC;border:1px solid #e4dfd2;border-radius:12px;padding:10px 14px;box-shadow:0 3px 12px rgba(7,22,46,.05)}" +
    ".fo-progress-l{display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484;font-weight:700;margin-bottom:6px}.fo-progress-l b{color:#111827}" +
    ".fo-progress-bar{height:7px;border-radius:4px;background:#efeadf;overflow:hidden}" +
    ".fo-progress-bar u{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ");transition:width .5s ease}" +
    ".fo-mchip{display:inline-flex;align-items:center;gap:7px;background:#FFFEFC;border:1px solid #e4dfd2;border-radius:999px;padding:8px 15px;font-size:12.5px;font-weight:700;color:#111827;box-shadow:0 3px 12px rgba(7,22,46,.05)}" +
    ".fo-mchip i{display:flex}.fo-mchip-hot{border-color:rgba(200,103,74,.45);color:" + TERRA2 + "}.fo-mchip-hot i{color:" + TERRA + "}" +
    ".fo-mchip-goal{border-color:rgba(77,166,162,.45);color:#2b6b68}.fo-mchip-goal i{color:#2b6b68}" +
    // Mobile match view: commentary directly under the scoreboard; match details and
    // the tab links drop below it. Desktop (>900px) layout is untouched. We flatten
    // .mc-top and .ftp-match-shell into #page's flex flow and reorder with `order`.
    "@media(max-width:900px){" +
    "#page.fo-matchpage{display:flex !important;flex-direction:column}" +
    "#page.fo-matchpage>.crumb{order:0}" +
    "#page.fo-matchpage>.mc-top{display:contents !important}" +
    "#page.fo-matchpage>.ftp-match-shell{display:contents !important}" +
    "#page.fo-matchpage .mc-score{order:1;width:100%;flex:none}" +
    "#page.fo-matchpage .ftp-match-body{order:2;width:100%;flex:none}" +
    "#page.fo-matchpage .mc-details{order:3;width:100%;flex:none}" +
    "#page.fo-matchpage .ftp-match-links{order:4;width:100%;flex:none;position:static !important}" +
    "}";
  document.body.appendChild(css3);
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
  function bumpBrand() { try { if (css3.parentNode !== document.body || document.body.lastChild !== css3) document.body.appendChild(css3); } catch (e) {} }
  // Add a "Clubs" nav link -> the game's players browser (pick any club, bot or
  // human, and see its roster). The game ships the page but never links to it.
  // The game runs in days, not weeks: the engine's "Week N" chip goes.
  function foHideWeekChip() {
    try {
      document.querySelectorAll("#fo-top-status span").forEach(function (s) {
        if (/^\s*(Week\s+\d+|Bank\b)/.test(s.textContent || "")) s.style.display = "none";
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
      addNav("fo-training", "Training", function () { location.hash = "#/training"; if (typeof window.route === "function") window.route(); });
      addNav("fo-transfers", "Transfers", function () { location.hash = "#/transfers"; if (typeof window.route === "function") window.route(); });
      // Live Match appears only while a match is actually in progress
      var liveOn = false; try { liveOn = (typeof M !== "undefined") && M && !M.done; } catch (e) {}
      var lv = tb.querySelector("a.fo-live");
      if (liveOn) { if (!lv) addNav("fo-live", "\u25CF Live Match", function () { location.hash = "#/match"; if (typeof window.route === "function") window.route(); }); }
      else if (lv) lv.remove();
      // retired pills (still routable: Matches panel, Live pill, home quick links)
      ["fo-friendly", "fo-matchday"].forEach(function (c) { var st = tb.querySelector("a." + c); if (st) st.remove(); });
      addNav("fo-guide", "Manual", function () { location.hash = "#/guide"; if (typeof window.route === "function") window.route(); });
      try { foBellWire(tb, wrap); } catch (eB) {}
      // Admin is founder-only: add it for the founder, and remove it for everyone
      // else (so a player never inherits a stale Admin link).
      var adm = tb.querySelector("a.fo-league");
      if (SYNC && SYNC.isFounder) { if (!adm) addNav("fo-league", "Admin", openLeagueMenu); }
      else if (adm) adm.remove();
      // date + time (in the topbar flow, to the right of the status)
      var ck = tb.querySelector("#fo-clock");
      if (!ck) { ck = document.createElement("span"); ck.id = "fo-clock"; tickClock(); }
      tb.appendChild(ck);
      // Log out is always the very last item, so it never feels buried in the nav.
      var out = tb.querySelector("a.fo-logout"); if (!out) out = mk("Log out", "fo-logout", doLogout);
      if (out.parentNode !== wrap) wrap.appendChild(out);
      // active-pill marking for overlay-added links (engine handles its own via data-nav)
      try {
        var route0 = (location.hash || "#/club").split("?")[0];
        var navMap = { "fo-training": "#/training", "fo-transfers": "#/transfers", "fo-guide": "#/guide", "fo-matchday": "#/matchday", "fo-live": "#/match" };
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

