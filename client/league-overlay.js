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
      // runs, wiping the Supabase fragment — so also read the ORIGINAL navigation
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
    // Login/signup mode is FULL-BLEED: without this the panel is a centered 780px
    // column whose edges vanish against the dark page — leaving its scrollbar
    // floating weirdly in the middle of the screen. Background: brand gradient +
    // two very faint boundary-rope arcs (abstract cricket field lines).
    "#folPanel.fol-navy{inset:0 !important;max-width:none;border-radius:0;display:flex;flex-direction:column;" +
      "padding:calc(20px + env(safe-area-inset-top,0px)) 20px calc(20px + env(safe-area-inset-bottom,0px));" +
      "background:" +
      "radial-gradient(ellipse 130% 95% at 50% 128%,transparent 59.6%,rgba(246,244,238,.045) 60%,transparent 60.7%)," +
      "radial-gradient(ellipse 105% 75% at 50% 132%,transparent 59.5%,rgba(246,244,238,.03) 60%,transparent 60.9%)," +
      "radial-gradient(circle at 30% 40%,rgba(77,166,162,.18),transparent 32%)," +
      "radial-gradient(circle at 78% 20%,rgba(200,103,74,.08),transparent 28%)," +
      "linear-gradient(180deg,#0B1322 0%,#08101D 100%)}" +
    // margin:auto (not align-items:center) so content taller than the window scrolls instead of clipping its top
    "#folPanel.fol-navy #folMain{margin:auto;width:100%;max-width:1120px}" +
    // subtle dark scrollbar (the default white one glows against navy)
    "#folPanel{scrollbar-width:thin;scrollbar-color:rgba(246,244,238,.25) transparent}" +
    "#folPanel::-webkit-scrollbar{width:10px}#folPanel::-webkit-scrollbar-track{background:transparent}" +
    "#folPanel::-webkit-scrollbar-thumb{background:rgba(246,244,238,.18);border-radius:6px;border:2px solid #0B1322}#folPanel::-webkit-scrollbar-thumb:hover{background:rgba(246,244,238,.32)}" +
    "#folPanel.fol-navy .folhd{display:none}" +
    // ---- split auth layout: brand lockup left, card right ----
    ".fol-auth{display:flex;align-items:center;gap:56px}" +
    ".fol-brand{flex:1.15;display:flex;flex-direction:column;align-items:center;text-align:center}" +
    ".fol-mark{width:210px;height:auto;filter:drop-shadow(0 0 34px rgba(77,166,162,.28))}" +
    ".fol-word{margin:26px 0 0;font-size:clamp(30px,3.2vw,44px);font-weight:700;letter-spacing:.34em;text-indent:.34em;color:#F6F4EE;white-space:nowrap}" +
    ".fol-word i{font-style:normal;color:#5A7492}" +
    ".fol-tag{margin-top:16px;font-size:15.5px;letter-spacing:.22em;color:rgba(246,244,238,.85)}" +
    ".fol-tag b{color:#C8674A;font-weight:400;margin:0 10px}" +
    ".fol-feats{margin-top:12px;font-size:12.5px;letter-spacing:.14em;color:#4DA6A2}" +
    ".fol-feats b{color:rgba(246,244,238,.4);font-weight:400;margin:0 8px}" +
    // clip-path crops a white sliver baked into the icon bitmap's right edge
    ".fol-minilogo{width:56px;height:56px;border-radius:14px;margin-top:56px;opacity:.9;clip-path:inset(1px 5px 1px 1px round 14px)}" +
    ".fol-side{flex:1;display:flex;justify-content:center}" +
    ".fol-card{width:100%;max-width:430px;background:rgba(28,36,51,.82);border:1px solid rgba(246,244,238,.14);border-radius:24px;box-shadow:0 30px 70px -28px rgba(0,0,0,.65),0 1px 0 rgba(246,244,238,.04) inset;padding:36px 32px 26px;backdrop-filter:blur(6px)}" +
    ".fol-logo{display:none;width:64px;height:64px;border-radius:15px;margin:0 auto 18px;clip-path:inset(1px 6px 1px 1px round 15px)}" +
    ".fol-card h1{margin:0;text-align:center;font-size:26px;font-weight:700;letter-spacing:.3px;color:#F6F4EE}" +
    ".fol-card .fol-sub{margin:8px 0 26px;text-align:center;font-size:14px;color:rgba(246,244,238,.65);letter-spacing:.2px}" +
    ".fol-form{display:flex;flex-direction:column;gap:15px}" +
    ".fol-form label{display:block;font-size:13px;font-weight:600;color:rgba(246,244,238,.85);margin:0 0 7px 2px}" +
    ".fol-lrow{display:flex;justify-content:space-between;align-items:baseline}" +
    "#folPanel .fol-lrow a{font-size:12.5px;color:#4DA6A2 !important;cursor:pointer;text-decoration:none}" +
    "#folPanel .fol-lrow a:hover{text-decoration:underline}" +
    "#folPanel .fol-form input{width:100%;min-height:48px;background:rgba(246,244,238,.06);border:1px solid rgba(246,244,238,.12);border-radius:12px;padding:12px 14px;color:#F6F4EE;font-size:16px;transition:border-color .15s,box-shadow .15s}" +
    "#folPanel .fol-form input::placeholder{color:rgba(246,244,238,.38)}" +
    "#folPanel .fol-form input:focus{outline:none;border-color:#4DA6A2;box-shadow:0 0 0 3px rgba(77,166,162,.16)}" +
    "#folPanel .fol-cta{margin-top:10px;min-height:52px;background:#C8674A !important;color:#F6F4EE !important;border:none !important;border-radius:13px;padding:15px;font-size:16.5px;font-weight:700;letter-spacing:.4px;cursor:pointer;transition:filter .15s}" +
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
    "#folPanel:not(.fol-navy){background:radial-gradient(circle at 24% 0%,rgba(77,166,162,.10),transparent 36%),linear-gradient(180deg,#0B1322 0%,#08101D 100%)}" +
    "#folPanel .folhd{background:rgba(28,36,51,.92);backdrop-filter:blur(6px);border-bottom:1px solid rgba(246,244,238,.1);padding:12px 18px}" +
    "#folPanel .folhd h3{font-size:15px;letter-spacing:1.5px;text-transform:uppercase;font-weight:800}" +
    "#folPanel .folbody{padding:20px 18px;max-width:720px;margin:0 auto}" +
    "#folPanel .folcard{background:rgba(28,36,51,.82);border:1px solid rgba(246,244,238,.14);border-radius:18px;box-shadow:0 24px 60px -30px rgba(0,0,0,.6);overflow:hidden}" +
    "#folPanel .folcard h4{padding:14px 18px;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(246,244,238,.85);border-bottom:1px solid rgba(246,244,238,.1);background:rgba(11,19,34,.35)}" +
    "#folPanel .folpad{padding:16px 18px}" +
    "#folPanel th{font-size:10.5px;letter-spacing:1.2px;text-transform:uppercase;color:rgba(246,244,238,.45);border-bottom:1px solid rgba(246,244,238,.14);padding:7px 8px}" +
    "#folPanel td{padding:10px 8px;border-bottom:1px solid rgba(246,244,238,.07);font-size:13.5px}" +
    "#folPanel tr:last-child td{border-bottom:none}" +
    "#folPanel button{border-radius:10px;transition:filter .15s;font-weight:600}" +
    "#folPanel button.p{background:#C8674A !important;border-color:#C8674A !important;color:#F6F4EE !important;padding:11px 18px;font-weight:700}" +
    "#folPanel button.p:hover{filter:brightness(1.07)}" +
    "#folPanel button.mini{background:rgba(246,244,238,.06);border:1px solid rgba(246,244,238,.16);color:rgba(246,244,238,.8);padding:6px 12px;font-size:12.5px}" +
    "#folPanel button.mini:hover{border-color:#4DA6A2;color:#F6F4EE}" +
    "#folPanel .folbadge{font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;letter-spacing:.3px}" +
    "#folPanel .folbadge.ok{background:rgba(77,166,162,.14)}" +
    "#folPanel .folbadge.warn{background:rgba(200,103,74,.13)}" +
    "#folPanel .folsmall{color:rgba(246,244,238,.6);opacity:1;line-height:1.5}" +
    // ---- toast notifications (replace native alert) ----
    "#fo-toasts{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483200;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;max-width:min(92vw,560px)}" +
    ".fo-toast{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;background:rgba(28,36,51,.97);color:#F6F4EE;border:1px solid rgba(246,244,238,.16);border-radius:13px;padding:12px 16px;font:13.5px/1.45 -apple-system,'Segoe UI',Roboto,Inter,system-ui,sans-serif;box-shadow:0 14px 40px -10px rgba(0,0,0,.6);opacity:0;transform:translateY(-8px);transition:opacity .25s,transform .25s;cursor:pointer;max-width:100%}" +
    ".fo-toast.on{opacity:1;transform:none}" +
    ".fo-toast-ic{flex:none;display:flex;margin-top:1px;color:#4DA6A2}" +
    ".fo-toast-error{border-color:rgba(200,103,74,.5);background:linear-gradient(160deg,rgba(58,32,26,.97),rgba(40,22,20,.97))}" +
    ".fo-toast-error .fo-toast-ic{color:#e58b86}" +
    ".fo-toast-tx{word-break:break-word}" +
    // ---- confirmation modal ----
    "#fo-modal{position:fixed;inset:0;z-index:2147483150;opacity:0;transition:opacity .18s}" +
    "#fo-modal.on{opacity:1}" +
    ".fo-mo-back{position:absolute;inset:0;background:rgba(8,16,29,.66);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}" +
    ".fo-mo-card{width:100%;max-width:400px;background:linear-gradient(160deg,#1C2433,#111B2B);border:1px solid rgba(246,244,238,.14);border-radius:18px;padding:26px 26px 22px;text-align:center;color:#F6F4EE;box-shadow:0 30px 70px -20px rgba(0,0,0,.7);font:14px/1.5 -apple-system,'Segoe UI',Roboto,Inter,system-ui,sans-serif;transform:translateY(8px);transition:transform .18s}" +
    "#fo-modal.on .fo-mo-card{transform:none}" +
    ".fo-mo-ic{width:52px;height:52px;border-radius:50%;background:rgba(77,166,162,.14);color:#4DA6A2;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}" +
    ".fo-mo-dngr .fo-mo-ic{background:rgba(200,79,74,.16);color:#e58b86}" +
    ".fo-mo-card h3{margin:0 0 6px;font-size:17.5px;font-weight:800}" +
    ".fo-mo-card p{margin:0 0 4px;font-size:13.5px;color:rgba(246,244,238,.68)}" +
    ".fo-mo-act{display:flex;gap:10px;margin-top:18px}" +
    ".fo-mo-act button{flex:1;padding:12px;border-radius:11px;font:600 14px inherit;font-family:inherit;cursor:pointer;min-height:46px}" +
    ".fo-mo-cancel{background:rgba(246,244,238,.07);color:#F6F4EE;border:1px solid rgba(246,244,238,.22)}" +
    ".fo-mo-cancel:hover,.fo-mo-cancel:focus{background:rgba(246,244,238,.14);outline:none;border-color:rgba(246,244,238,.4)}" +
    ".fo-mo-ok{background:#4DA6A2;color:#0B1322;border:none;font-weight:700}" +
    ".fo-mo-dngr .fo-mo-ok{background:#C84F4A;color:#fff}" +
    ".fo-mo-ok:hover{filter:brightness(1.08)}";
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
    "#topbar a[data-nav=\"reports\"],#topbar a[data-nav=\"manual\"],#topbar a[data-nav=\"orders\"]{display:none !important}" +
    ".fo-scoutname{cursor:pointer;text-decoration:underline;text-decoration-color:rgba(200,103,74,.5)}" +
    ".fo-brandicon{width:28px;height:28px;border-radius:7px;vertical-align:-9px;margin-right:7px}" +
    // clock sits in the topbar flow (not absolute) so it never overlaps the game's status
    "#fo-clock{color:rgba(246,244,238,.9);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap;letter-spacing:.3px;align-self:center;padding:0 10px;border-left:1px solid #5b5b5b}" +
    "#topbar a.fo-logout{margin-left:6px}" +
    ".fo-mtime{font-size:10px;color:#C8674A;font-weight:600;margin-top:1px}" +
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
    // rival club (scout) page — custom hero (high contrast) + FTP-style link banner
    ".fo-scout{max-width:1080px;margin:0 auto}" +
    ".fo-scout-hero{position:relative;overflow:hidden;border-radius:14px;padding:24px 26px;margin:6px 0 14px;display:flex;gap:20px;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;background:linear-gradient(135deg,#16294a,#0B1322 62%);box-shadow:0 10px 30px rgba(11,19,34,.25)}" +
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
    ".fo-scout-links{flex:0 0 148px;background:" + NAVY2 + ";border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(11,19,34,.12)}" +
    ".fo-scout-links a{display:block;padding:11px 15px;color:#d7dbe2 !important;font-size:13px;cursor:pointer;border-bottom:1px solid rgba(246,244,238,.07)}" +
    ".fo-scout-links a:hover{background:rgba(255,255,255,.05)}" +
    ".fo-scout-links a.on{background:" + TERRA + ";color:#fff !important;font-weight:700}" +
    ".fo-scout-body{flex:1 1 auto;min-width:0}" +
    ".fo-sortbar{margin-bottom:6px}.fo-sortbar a{cursor:pointer;color:" + TERRA2 + "}.fo-sortbar a.on{font-weight:700;text-decoration:underline}" +
    "@media(max-width:640px){.fo-scout-hero{padding:18px}.fo-scout-name{font-size:26px}.fo-scout-kpis{flex:1 1 100%;grid-template-columns:repeat(2,1fr)}.fo-scout-shell{flex-direction:column}.fo-scout-links{flex:none;width:100%;display:flex}.fo-scout-links a{flex:1;text-align:center;border-bottom:none}}" +
    ".fo-fx-fr{background:linear-gradient(90deg,rgba(77,166,162,.08),transparent)}" +
    ".fo-fr-play{font-size:12px;padding:5px 12px;border:1px solid " + TEAL + ";background:" + TEAL + ";color:#fff;border-radius:6px;cursor:pointer;white-space:nowrap}" +
    ".fo-fr-play:hover{background:#3f8a86}" +
    ".fo-fr-x{margin-left:6px;font-size:11px;padding:5px 8px;border:1px solid #d8d2c4;background:#fff;color:#8a8474;border-radius:6px;cursor:pointer}" +
    ".fo-fr-x:hover{background:#f2eee4}" +
    // practice setup / break modal
    ".fo-modal{position:fixed;inset:0;z-index:99999;background:rgba(11,19,34,.62);display:flex;align-items:center;justify-content:center;padding:16px}" +
    ".fo-modal-card{background:" + PAPER + ";color:#1b2433;border-radius:14px;padding:22px 24px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.4)}" +
    ".fo-modal-card h3{margin:2px 0 14px;font-size:21px;color:#12203a}" +
    ".fo-modal-eyebrow{color:" + TERRA + ";font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}" +
    ".fo-modal-card label{display:block;font-size:12px;font-weight:600;color:#5b6472;margin:0 0 10px}" +
    ".fo-modal-card label select{display:block;width:100%;margin-top:4px;padding:9px 10px;border:1px solid #cdc7b8;border-radius:8px;background:#fff;font-size:14px}" +
    ".fo-modal-act{display:flex;gap:10px;margin-top:8px}" +
    ".fo-modal-act .primary{flex:1;background:" + TERRA + ";color:#fff;border:none;padding:11px;border-radius:9px;font-weight:700;cursor:pointer;font-size:14px}" +
    ".fo-modal-act .primary:hover{background:" + TERRA2 + "}" +
    ".fo-modal-act .fo-su-cancel{background:transparent;border:1px solid #cdc7b8;color:#5b6472;padding:11px 16px;border-radius:9px;cursor:pointer}" +
    ".fo-break-card{text-align:center}.fo-break-cond{color:#5b6472;font-size:13px;margin-bottom:6px}" +
    ".fo-break-clock{font-size:46px;font-weight:800;color:#12203a;font-variant-numeric:tabular-nums;margin:6px 0 10px;letter-spacing:1px}" +
    // ---- global app shell polish ----
    "html body.ftpskin,body{background:#F1EEE6 !important}" +
    "html body.ftpskin .wrap,.wrap,#page{background:transparent !important}" +
    "html body.ftpskin,body,#page,.panel,.card,button,select,input,h1,h2,h3,h4{font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}" +
    // nav: muted inactive, terracotta-underline active (not a full pill)
    "html body.ftpskin #topbar a,#topbar a{color:rgba(246,244,238,.72)}" +
    "html body.ftpskin #topbar a:hover,#topbar a:hover{color:#F6F4EE;background:rgba(246,244,238,.06) !important}" +
    "html body.ftpskin #topbar a.on,#topbar a.on{background:transparent !important;color:#fff !important;box-shadow:inset 0 -3px 0 " + TERRA + " !important}" +
    // Week / Bank / Next → compact status chips
    "#fo-top-status{gap:8px !important;padding:0 4px !important}" +
    "#fo-top-status span{border-left:none !important;background:rgba(246,244,238,.07);border:1px solid rgba(246,244,238,.14);border-radius:9px;padding:6px 11px !important;color:#e9eef2;font-size:11.5px;white-space:nowrap}" +
    // ---- premium Club dashboard ----
    ".fo-ch{max-width:1240px;margin:0 auto;padding:2px 2px 24px}" +
    ".fo-ch-crumb{color:#6b7280;font-size:13px;margin:6px 0 12px}.fo-ch-crumb span{color:#c0bbb0;margin:0 3px}" +
    ".fo-ch-hero{display:flex;justify-content:space-between;align-items:center;gap:16px;background:linear-gradient(135deg,#0B1322,#1C2433);border-radius:16px;padding:22px 26px;box-shadow:0 8px 24px rgba(11,19,34,.18)}" +
    ".fo-ch-hero-l{display:flex;gap:18px;align-items:center;min-width:0}" +
    ".fo-ch-crest{width:74px;height:74px;border-radius:14px;background:" + PAPER + ";display:flex;align-items:center;justify-content:center;flex:none;box-shadow:0 4px 12px rgba(0,0,0,.2)}" +
    ".fo-ch-crest img{width:56px;height:56px;object-fit:contain;border-radius:8px}" +
    ".fo-ch-eyebrow{color:" + TEAL + ";font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}" +
    ".fo-ch-name{color:#fff;font-size:34px;font-weight:800;margin:2px 0 10px;letter-spacing:-.5px;line-height:1}" +
    ".fo-ch-chips{display:flex;gap:8px;flex-wrap:wrap}" +
    ".fo-ch-chip{background:rgba(246,244,238,.08);border:1px solid rgba(246,244,238,.14);color:#d7dbe2;font-size:12px;padding:5px 11px;border-radius:8px}" +
    ".fo-hero-pill{background:rgba(246,244,238,.1);border:1px solid rgba(246,244,238,.2);color:#F6F4EE;font-size:12.5px;padding:8px 14px;border-radius:999px;white-space:nowrap}" +
    ".fo-hero-pill .fo-form{margin-left:6px}" +
    ".fo-ch-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin:16px 0}" +
    ".fo-stat{position:relative;display:flex;gap:12px;align-items:center;background:#fff;border:1px solid rgba(11,19,34,.08);border-radius:14px;padding:15px 16px;box-shadow:0 8px 24px rgba(11,19,34,.06);overflow:hidden}" +
    ".fo-stat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}" +
    ".fo-acc-terra::before{background:" + TERRA + "}.fo-acc-teal::before{background:" + TEAL + "}" +
    ".fo-stat-ic{width:44px;height:44px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:19px;background:rgba(200,103,74,.1);flex:none}" +
    ".fo-acc-teal .fo-stat-ic{background:rgba(77,166,162,.12)}" +
    ".fo-stat-l{font-size:10.5px;color:#8a8474;text-transform:uppercase;letter-spacing:.04em;font-weight:700}" +
    ".fo-stat-v{font-size:25px;font-weight:800;color:#12203a;line-height:1.15}" +
    ".fo-stat-s{font-size:11px;color:#9a9484;margin-top:1px}" +
    ".fo-ch-grid{display:grid;grid-template-columns:1.42fr 1fr;gap:16px}" +
    ".fo-ch-col{display:flex;flex-direction:column;gap:16px;min-width:0}" +
    ".fo-card{background:#fff;border:1px solid rgba(11,19,34,.08);border-radius:14px;box-shadow:0 8px 24px rgba(11,19,34,.06);overflow:hidden}" +
    ".fo-card-h{background:linear-gradient(135deg,#0B1322,#1C2433);color:#F6F4EE;font-weight:700;font-size:14px;padding:13px 18px}" +
    ".fo-card-b{padding:4px 8px 8px}" +
    ".fo-card-h2row{display:flex;justify-content:space-between;align-items:flex-end;padding:15px 18px 4px}" +
    ".fo-card-h2{font-size:15px;font-weight:700;color:#12203a;position:relative;padding-bottom:7px}" +
    ".fo-card-h2::after{content:'';position:absolute;left:0;bottom:0;width:26px;height:3px;background:" + TERRA + ";border-radius:2px}" +
    ".fo-morelink{color:" + TERRA2 + " !important;font-size:12.5px;font-weight:600;white-space:nowrap}" +
    ".fo-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-tbl thead th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#9a9484;font-weight:700;padding:8px 12px;border-bottom:1px solid rgba(11,19,34,.08)}" +
    ".fo-tbl tbody td{padding:10px 12px;border-bottom:1px solid rgba(11,19,34,.055);color:#243040}" +
    ".fo-tbl tbody tr:last-child td{border-bottom:none}.fo-tbl .r{text-align:right}" +
    ".fo-tbl .fo-rk{width:34px;text-align:center;color:#9a9484;font-weight:700}" +
    ".fo-tbl .fo-form{margin-left:6px;display:inline-flex;gap:2px;vertical-align:middle}" +
    ".fo-tbl tbody tr:hover td{background:#faf8f3}.fo-rowlink{cursor:pointer}" +
    ".fo-tbl .fo-scoutname{cursor:pointer;color:#12203a;font-weight:600}.fo-tbl .fo-scoutname:hover{color:" + TERRA + "}" +
    ".fo-tbl tr.fo-userrow td{background:rgba(200,103,74,.10)}" +
    ".fo-tbl tr.fo-userrow td:first-child{box-shadow:inset 3px 0 0 " + TERRA + "}" +
    ".fo-t{font-size:10px;color:" + TERRA + ";font-weight:600;margin-top:1px}" +
    ".fo-fx-fr td{background:rgba(77,166,162,.06)}" +
    ".fo-pill{display:inline-block;font-size:10.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid transparent;vertical-align:middle}" +
    ".fo-pill-teal{background:rgba(77,166,162,.12);color:#2b6b68;border-color:rgba(77,166,162,.3)}" +
    ".fo-pill-muted{background:#f0ece2;color:#7a7566;border-color:#e2ddd0}" +
    ".fo-empty{display:flex;gap:14px;align-items:center;justify-content:center;padding:26px 20px;color:#8a8474}" +
    ".fo-empty-ic{width:44px;height:44px;border-radius:50%;background:#f2eee4;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}" +
    ".fo-ch-leaders{display:grid;grid-template-columns:1fr 1fr;gap:16px}" +
    ".fo-ch-leaders .fo-lead{display:flex;gap:14px;align-items:center;padding:16px 18px}" +
    ".fo-ch-leaders .fo-lead-ic{width:44px;height:44px;border-radius:11px;background:rgba(200,103,74,.1);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}" +
    ".fo-ch-leaders .fo-lead:nth-child(2) .fo-lead-ic{background:rgba(77,166,162,.12)}" +
    ".fo-card-h2{margin:0}.fo-ch-leaders .fo-lead .fo-card-h2::after{display:none}" +
    ".fo-ch-leaders .fo-lead-v{font-size:24px;font-weight:800;color:#12203a}.fo-lead-v span{font-size:13px;font-weight:600;color:#9a9484}" +
    ".fo-kv{width:100%;font-size:13px;border-collapse:collapse}.fo-kv td{padding:10px 18px;border-bottom:1px solid rgba(11,19,34,.055);color:#243040}.fo-kv tr:last-child td{border-bottom:none}.fo-kv td:first-child{color:#7a7566}" +
    ".fo-teal{color:#2b6b68 !important;font-weight:600}" +
    // next-match anticipation panel + to-do strip + finance health
    ".fo-next{display:flex;justify-content:space-between;align-items:center;gap:18px;background:#fff;border:1px solid #e2ddd0;border-left:4px solid #C0562F;border-radius:14px;padding:16px 20px;margin-top:14px;flex-wrap:wrap}" +
    ".fo-next-l{min-width:0}" +
    ".fo-next-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#C0562F}" +
    ".fo-next-opp{font-size:21px;font-weight:800;color:#12203a;margin:3px 0 4px;letter-spacing:-.3px}" +
    ".fo-next-sub{font-size:12.5px;color:#6b7280}" +
    ".fo-next-r{display:flex;align-items:center;gap:18px;flex-wrap:wrap}" +
    ".fo-cd{text-align:right}" +
    ".fo-cd-v{font-size:23px;font-weight:800;color:#12203a;font-variant-numeric:tabular-nums;letter-spacing:.5px}" +
    ".fo-cd-l{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9a9484}" +
    ".fo-next-cta{border:0;border-radius:10px;padding:12px 22px;font-weight:800;font-size:14px;cursor:pointer;background:#C0562F !important;color:#fff !important;box-shadow:0 4px 14px rgba(192,86,47,.35);animation:foPulse 2.2s ease-in-out infinite}" +
    ".fo-next-cta:hover{background:#a94a28 !important}" +
    ".fo-next-cta.fo-done{background:#eef4ee !important;color:#2f6b46 !important;box-shadow:none;animation:none;border:1px solid #d5e0d7}" +
    "@keyframes foPulse{0%,100%{box-shadow:0 4px 14px rgba(192,86,47,.35)}50%{box-shadow:0 4px 22px rgba(192,86,47,.6)}}" +
    ".fo-todo{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}" +
    ".fo-todo a{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:#7a4a12;background:#fdf3e2;border:1px solid #eeddba;border-radius:999px;padding:6px 13px;text-decoration:none;cursor:pointer}" +
    ".fo-todo a:hover{background:#fbead0}" +
    ".fo-todo a.fo-todo-ok{color:#2f6b46;background:#eef4ee;border-color:#d5e0d7;cursor:default}" +
    ".fo-gains li{margin:3px 0}.fo-gains .fo-gain-up{color:#3E9960;font-weight:700}" +
    ".fo-fin-net{display:flex;justify-content:space-between;align-items:center;background:#f6f4ee;border-radius:9px;padding:9px 12px;margin-top:9px;font-size:12.5px}" +
    ".fo-fin-net b.fo-pos,.fo-pos{color:#3E9960}.fo-fin-net b.fo-neg,b.fo-neg{color:#C84F4A}" +
    // mobile: swipeable tables + compact topbar
    ".fo-scrollx{overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;scrollbar-width:thin;border-radius:8px;background:linear-gradient(90deg,rgba(0,0,0,.06),transparent 12px) left/16px 100% no-repeat local,linear-gradient(270deg,rgba(0,0,0,.06),transparent 12px) right/16px 100% no-repeat local}" +
    ".fo-scrollx>table{min-width:530px}" +
    // matchday centre + newspaper
    ".fo-md-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:14px}" +
    ".fo-md-card{background:#fff;border:1px solid #e2ddd0;border-radius:13px;padding:14px 16px}" +
    ".fo-md-teams{font-weight:800;color:#12203a;font-size:14.5px;margin-bottom:8px}" +
    ".fo-md-inn{display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#3c4658}" +
    ".fo-md-inn b{font-variant-numeric:tabular-nums;font-size:15px;color:#12203a}" +
    ".fo-md-inn.on b{color:#C0562F}" +
    ".fo-md-status{font-size:12px;color:#6b7280;margin-top:7px;min-height:16px}" +
    ".fo-md-done .fo-md-status{color:#2f6b46;font-weight:700}" +
    ".fo-md-bar{display:flex;align-items:center;gap:10px;background:#0B1322;border-radius:12px;padding:12px 16px;margin-top:14px;flex-wrap:wrap}" +
    ".fo-md-bar button{background:#C0562F !important;color:#fff !important;border:0;border-radius:8px;padding:8px 16px;font-weight:800;cursor:pointer}" +
    ".fo-md-bar button.fo-ghost{background:rgba(246,244,238,.12) !important}" +
    ".fo-md-over{color:#fff;font-weight:800;font-variant-numeric:tabular-nums;min-width:120px}" +
    ".fo-md-track{flex:1;height:6px;border-radius:99px;background:rgba(246,244,238,.15);min-width:120px}" +
    ".fo-md-track u{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#4DA6A2,#C0562F);text-decoration:none;width:0}" +
    ".fo-potr{display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,#0B1322,#1C2433);border-radius:13px;padding:16px 18px;margin-top:14px;color:#d7dbe2}" +
    ".fo-potr-medal{font-size:26px}" +
    ".fo-potr b{color:#fff;font-size:16px}" +
    ".fo-news li{margin:0 0 9px;padding-left:2px;line-height:1.5}" +
    ".fo-news .fo-news-h{font-weight:800;color:#12203a}" +
    ".fo-news .fo-news-s{color:#6b7280;font-size:12px}" +
    ".fo-pick{cursor:pointer}" +
    ".fo-pick-on{background:#1f4e5f !important;color:#fff !important;border-color:#1f4e5f !important}" +
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
    ".fo-ob-shell{min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(77,166,162,.08),transparent 34%),radial-gradient(circle at 85% 12%,rgba(200,103,74,.06),transparent 30%),linear-gradient(180deg,#F5F1E6 0%,#EDE8DB 100%);color:#12203a;padding:24px 16px 48px}" +
    ".fo-ob-inner{max-width:960px;margin:0 auto}" +
    ".fo-ob-prog{display:flex;align-items:center;justify-content:center;gap:4px;margin:6px 0 20px;flex-wrap:wrap}" +
    ".fo-ob-step{display:flex;align-items:center;gap:7px;color:#9a9484;font-size:12px;font-weight:600}" +
    ".fo-ob-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:1px solid rgba(11,19,34,.25);background:#ece7da}" +
    ".fo-ob-step.on{color:#12203a}.fo-ob-step.on .fo-ob-dot{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    ".fo-ob-step.done .fo-ob-dot{background:rgba(77,166,162,.25);border-color:#2b6b68;color:#2b6b68}.fo-ob-step.done{color:#5d6570}" +
    ".fo-ob-sep{width:16px;height:1px;background:#ece7da}" +
    ".fo-ob-card{background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:22px;padding:30px 32px;box-shadow:0 10px 30px rgba(11,19,34,.08)}" +
    ".fo-ob-narrow{max-width:560px;margin:0 auto}" +
    ".fo-ob-wordmark{display:flex;align-items:center;gap:14px;margin-bottom:16px}.fo-ob-wm1{font-size:22px;font-weight:800;letter-spacing:3px}.fo-ob-wm1 span{color:" + TERRA + "}.fo-ob-wm2{font-size:10px;letter-spacing:3px;color:#9a9484;text-transform:uppercase;margin-top:2px}" +
    ".fo-ob-eyebrow{color:#2b6b68;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px}" +
    ".fo-ob-h1{font-size:26px;font-weight:800;margin:0 0 10px;line-height:1.15;letter-spacing:-.3px}" +
    ".fo-ob-lead{color:#545d68;font-size:14px;line-height:1.55;margin:0 0 18px}" +
    ".fo-ob-lbl{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#9a9484;font-weight:700;margin:12px 0 6px}" +
    ".fo-ob-input{width:100%;padding:12px 14px;border-radius:11px;border:1px solid rgba(11,19,34,.18);background:#fff;color:#12203a;font-size:15px;font-family:inherit}" +
    ".fo-ob-input:focus{outline:none;border-color:#2b6b68;box-shadow:0 0 0 3px rgba(77,166,162,.2)}" +
    ".fo-ob-hint{font-weight:400;text-transform:none;letter-spacing:0;color:#a39d8d}" +
    "#fo-onb select.fo-ob-input{appearance:auto;-webkit-appearance:auto}" +
    ".fo-ob-act{display:flex;gap:12px;justify-content:flex-end;margin-top:22px}" +
    ".fo-ob-cta{background:" + TERRA + ";color:#F6F4EE;border:none;padding:12px 22px;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer}.fo-ob-cta:hover:not(:disabled){background:" + TERRA2 + "}.fo-ob-cta:disabled{opacity:.4;cursor:default}" +
    ".fo-cta-danger{background:" + TERRA + "}" +
    ".fo-ob-ghost{background:transparent;color:#37424f;border:1px solid rgba(11,19,34,.25);padding:12px 20px;border-radius:11px;font-weight:600;font-size:14px;cursor:pointer}.fo-ob-ghost:hover{background:#ece7da}" +
    // money screen
    ".fo-ob-jobs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0 18px}" +
    ".fo-ob-job{display:flex;gap:12px;align-items:center;background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:14px;padding:14px}" +
    ".fo-ob-jic{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;background:rgba(77,166,162,.14)}" +
    ".fo-ob-muted{color:#8a8474;font-size:12px;margin-top:2px}" +
    ".fo-ob-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 18px}" +
    ".fo-ob-tile{background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:14px;padding:16px}" +
    ".fo-ob-tl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484;font-weight:700}.fo-ob-tv{font-size:23px;font-weight:800;margin:5px 0 2px}.fo-ob-ts{font-size:11.5px;color:#9a9484}" +
    ".fo-ob-list{margin:6px 0 16px;padding-left:18px;color:#414b57;font-size:13.5px;line-height:1.8}.fo-ob-list b{color:#12203a}" +
    ".fo-ob-warn{background:linear-gradient(90deg,rgba(200,103,74,.18),rgba(200,103,74,.06));border:1px solid rgba(200,103,74,.35);border-radius:12px;padding:12px 14px;color:#9c4a30;font-size:13px;font-weight:600}" +
    ".fo-ob-note{background:rgba(77,166,162,.08);border:1px solid rgba(77,166,162,.22);border-radius:11px;padding:10px 13px;color:#5d6570;font-size:12.5px;margin-top:6px}" +
    // selectable cards (style/sponsor)
    ".fo-ob-picks{display:flex;flex-direction:column;gap:12px}.fo-ob-picks-3{gap:12px}" +
    ".fo-ob-pick{text-align:left;background:#f7f4ec;border:1.5px solid rgba(11,19,34,.13);border-radius:16px;padding:16px 18px;cursor:pointer;color:#12203a;display:block;width:100%}" +
    ".fo-ob-pick:hover{border-color:rgba(11,19,34,.25)}" +
    ".fo-ob-pick.on{border-color:var(--tc);box-shadow:0 0 0 3px color-mix(in srgb,var(--tc) 26%,transparent)}" +
    ".fo-tone-teal{--tc:#3d8a86}.fo-tone-terra{--tc:" + TERRA + "}.fo-tone-gold{--tc:#D9A441}.fo-tone-violet{--tc:#8b6bb1}.fo-tone-danger{--tc:#C84F4A}" +
    ".fo-ob-pick-h{display:flex;align-items:center;gap:10px;margin-bottom:3px}.fo-ob-pick-name{font-size:16px;font-weight:800;color:var(--tc)}" +
    ".fo-ob-rec{background:rgba(77,166,162,.16);color:#2b6b68;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid rgba(77,166,162,.3)}" +
    ".fo-ob-est{margin-left:auto;text-align:right;font-size:10px;color:#9a9484;text-transform:uppercase;letter-spacing:.04em}.fo-ob-est b{display:block;font-size:16px;color:#12203a;letter-spacing:0}" +
    ".fo-ob-pick-tag{color:#737a84;font-size:12.5px;margin-bottom:10px}" +
    ".fo-ob-pick-grid{display:flex;gap:22px}.fo-ob-pick-grid>div{display:flex;flex-direction:column}.fo-ob-pick-grid span{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#a39d8d;font-weight:700}.fo-ob-pick-grid b{font-size:15px;margin-top:2px}.fo-ob-pick-grid .fo-risk{color:var(--tc)}" +
    ".fo-ob-splines{margin:0 0 8px;padding-left:16px;font-size:12.5px;color:#414b57;line-height:1.6}" +
    ".fo-ob-scen{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.fo-ob-scen span{background:#f7f4ec;border-radius:9px;padding:7px 8px;text-align:center;font-size:13px;font-weight:700}.fo-ob-scen i{display:block;font-style:normal;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:#a39d8d;margin-bottom:3px;font-weight:700}" +
    // draft room
    ".fo-ob-draftwrap{max-width:1180px;margin:0 auto}" +
    ".fo-dr-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}" +
    ".fo-dr-hstat{display:flex;gap:8px;flex-wrap:wrap}.fo-dr-hstat span{background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:10px;padding:8px 13px;font-size:12px;color:#7a7566}.fo-dr-hstat b{color:#12203a;margin-left:5px}" +
    ".fo-dr-grid{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}" +
    ".fo-dr-main{background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:16px;padding:14px}" +
    ".fo-dr-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center}" +
    ".fo-dr-chip{background:#f7f4ec;border:1px solid rgba(11,19,34,.13);color:#545d68;border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-weight:600}.fo-dr-chip.on{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    ".fo-dr-searchi{margin-left:auto;background:#f7f4ec;border:1px solid rgba(11,19,34,.13);color:#12203a;border-radius:10px;padding:7px 12px;font-size:12.5px;min-width:150px;font-family:inherit}.fo-dr-searchi:focus{outline:none;border-color:#2b6b68}" +
    ".fo-dr-tblwrap{max-height:70vh;overflow:auto;border-radius:10px}" +
    ".fo-dr-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-dr-tbl thead th{position:sticky;top:0;background:#f4f0e6;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#9a9484;font-weight:700;padding:8px 10px;border-bottom:1px solid rgba(11,19,34,.13)}" +
    ".fo-dr-tbl tbody td{padding:9px 10px;border-bottom:1px solid rgba(11,19,34,.13);color:#7a7566}.fo-dr-tbl .r{text-align:right}" +
    ".fo-dr-tbl tbody tr:hover td{background:#ece7da}.fo-dr-in td{background:rgba(200,103,74,.1) !important}" +
    ".fo-dr-nm{font-weight:600;color:#12203a}.fo-dr-nat{color:#9a9484;font-size:11px}" +
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
    ".fo-fc{background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:16px;padding:16px}" +
    ".fo-fc-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#2b6b68;font-weight:800;margin-bottom:10px}" +
    ".fo-fc-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12.5px;color:#737a84;border-bottom:1px solid rgba(11,19,34,.13)}.fo-fc-row b{color:#12203a;font-weight:700}" +
    ".fo-fc-end{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:11px 13px;border-radius:11px;background:#f7f4ec;border:1px solid var(--tc)}.fo-fc-end span{font-size:12px;color:#5d6570}.fo-fc-end b{font-size:19px;color:var(--tc)}" +
    ".fo-fc-health{margin-top:8px;text-align:center;font-size:12px;color:#7a7566}.fo-fc-health b{color:var(--tc);font-weight:800}" +
    ".fo-fc-scens{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:10px}.fo-fc-scen{background:#f7f4ec;border-radius:9px;padding:7px 9px;font-size:12px}.fo-fc-scen span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:#a39d8d;font-weight:700}.fo-fc-scen b{color:var(--tc)}" +
    ".fo-dr-shape{display:flex;gap:6px;justify-content:space-between}.fo-sh{flex:1;background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:11px;padding:9px 4px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#9a9484;font-weight:700}.fo-sh b{display:block;font-size:18px;color:#12203a}" +
    ".fo-adv-panel{background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:16px;padding:14px}.fo-adv-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#8a8474;font-weight:800;margin-bottom:8px}" +
    ".fo-adv{font-size:12.5px;line-height:1.5;padding:8px 11px;border-radius:10px;margin-bottom:6px;border-left:3px solid}.fo-adv:last-child{margin-bottom:0}" +
    ".fo-adv-warn{background:rgba(217,164,65,.1);border-color:#D9A441;color:#8a6a1f}.fo-adv-danger{background:rgba(200,79,74,.12);border-color:#C84F4A;color:#9c3f39}.fo-adv-ok{background:rgba(77,166,109,.1);border-color:#4DA66D;color:#2e7d4f}.fo-adv-info{background:rgba(77,166,162,.08);border-color:#2b6b68;color:#5d6570}" +
    ".fo-dr-act{max-width:none;justify-content:space-between;margin-top:16px}.fo-dr-needs{text-align:right;color:#9a9484;font-size:12px;margin-top:6px}" +
    // risk + report
    ".fo-ob-risk{text-align:center;background:#fdf3f0;border-color:rgba(200,79,74,.4)}.fo-risk-ic{width:60px;height:60px;border-radius:50%;background:rgba(200,79,74,.18);border:1px solid rgba(200,79,74,.4);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 14px}.fo-risk-amt{color:#c0392b}.fo-risk-list{display:inline-block;text-align:left}.fo-ob-risk .fo-ob-act{justify-content:center}" +
    ".fo-ob-check{display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px;color:#37424f;margin:8px 0;cursor:pointer}.fo-ob-check input{width:17px;height:17px;accent-color:" + TERRA + "}" +
    ".fo-ob-report{max-width:640px;margin:0 auto}.fo-br-head{display:flex;align-items:center;gap:14px;margin-bottom:16px}.fo-br-crest{width:56px;height:56px;border-radius:13px;background:#f7f4ec;border:1px solid rgba(11,19,34,.13);display:flex;align-items:center;justify-content:center;padding:6px}.fo-br-crest img{width:100%;height:100%;object-fit:contain}" +
    ".fo-br-grid{background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:14px;overflow:hidden}.fo-br-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(11,19,34,.13);font-size:13.5px;color:#5d6570}.fo-br-row:last-child{border-bottom:none}.fo-br-row b{font-size:15px}" +
    ".fo-br-advice{margin-top:14px;background:rgba(77,166,162,.07);border:1px solid rgba(77,166,162,.2);border-radius:14px;padding:14px 16px}.fo-br-advh{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#2b6b68;font-weight:800;margin-bottom:5px}.fo-br-advice p{margin:0;font-size:13.5px;line-height:1.55;color:#2f3a48}" +
    ".fo-tone-teal{color-scheme:normal}b.fo-tone-teal,.fo-tone-teal>b{color:#2b6b68}b.fo-tone-terra{color:" + TERRA + "}b.fo-tone-gold{color:#a97b1e}b.fo-tone-danger{color:#c0392b}" +
    "@media(max-width:820px){.fo-dr-grid{grid-template-columns:1fr}.fo-dr-side{position:static}.fo-ob-tiles,.fo-ob-jobs{grid-template-columns:1fr}.fo-ob-card{padding:22px 18px}.fo-ob-h1{font-size:22px}}" +
    // ===== mockup-fidelity layer: icons, split create, 3-col picks, draft cards =====
    ".fo-i{vertical-align:-3px;flex:none}" +
    ".fo-ob-mid{max-width:980px;margin:0 auto}" +
    ".fo-ob-cols{display:grid;grid-template-columns:1fr 264px;gap:26px;align-items:start}" +
    ".fo-ob-snap{background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:16px;padding:16px}" +
    ".fo-ob-snaph{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#8a8474;font-weight:800;margin-bottom:10px}" +
    ".fo-snap-row{display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(11,19,34,.13)}.fo-snap-row:last-child{border-bottom:none}" +
    ".fo-snap-row i{width:34px;height:34px;border-radius:9px;background:rgba(77,166,162,.12);color:#2b6b68;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".fo-snap-row b{display:block;font-size:13.5px}.fo-snap-row span{display:block;font-size:11px;color:#9a9484}" +
    ".fo-ob-input:disabled{opacity:.55;cursor:not-allowed}" +
    ".fo-ob-ck{position:absolute;right:-7px;bottom:-7px;width:20px;height:20px;border-radius:50%;background:" + TEAL + ";color:#0B1322;display:flex;align-items:center;justify-content:center;border:2px solid #101a2a}" +
    ".fo-ob-jic{color:#12203a}.fo-jic-teal{background:rgba(77,166,162,.16);color:#2b6b68}.fo-jic-terra{background:rgba(200,103,74,.16);color:" + TERRA + "}" +
    ".fo-ob-tic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:9px}.fo-tic-teal{background:rgba(77,166,162,.13);color:#2b6b68}.fo-tic-terra{background:rgba(200,103,74,.14);color:" + TERRA + "}" +
    ".fo-ob-chks{display:grid;gap:8px;margin:2px 0 16px}" +
    ".fo-ob-chk{display:flex;gap:9px;align-items:center;font-size:13.5px;color:#37424f}.fo-ob-chk b{color:#12203a}.fo-ob-chk i{color:#4DA66D;display:flex}" +
    ".fo-ob-warn{display:flex;gap:9px;align-items:center}.fo-ob-warn i{display:flex;flex:none}" +
    ".fo-ob-note{display:flex;gap:8px;align-items:center}.fo-ob-note i{display:flex;flex:none;color:#2b6b68}" +
    ".fo-ob-act-c{justify-content:center}" +
    // 3-col selectable cards (style + sponsor)
    ".fo-pks{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;align-items:stretch}" +
    ".fo-pk{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;background:#f7f4ec;border:1.5px solid rgba(11,19,34,.13);border-radius:16px;padding:16px 15px 14px;cursor:pointer;color:#12203a}" +
    ".fo-pk:hover{border-color:rgba(11,19,34,.25)}" +
    ".fo-pk.on{border-color:var(--tc);box-shadow:0 0 0 3px color-mix(in srgb,var(--tc) 26%,transparent)}" +
    ".fo-rec-ghost{visibility:hidden}" +
    ".fo-pk .fo-ob-rec{margin-bottom:9px}" +
    ".fo-pk-ic{width:46px;height:46px;border-radius:12px;background:color-mix(in srgb,var(--tc) 14%,transparent);color:var(--tc);display:flex;align-items:center;justify-content:center;margin-bottom:7px}" +
    ".fo-pk-name{font-size:16.5px;font-weight:800}" +
    ".fo-pk-tag{font-size:12px;color:#7a7566;line-height:1.45;min-height:34px;margin-top:2px}" +
    ".fo-pk-rows{width:100%;margin-top:9px;border-top:1px solid rgba(11,19,34,.13);padding-top:4px}" +
    ".fo-pk-row{display:flex;justify-content:space-between;align-items:center;padding:6px 2px;font-size:12px;color:#8a8474}.fo-pk-row b{color:#12203a;font-size:12.5px;display:flex;align-items:center;gap:6px}" +
    ".fo-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.fo-dot-teal{background:" + TEAL + "}.fo-dot-terra{background:" + TERRA + "}.fo-dot-gold{background:#D9A441}" +
    ".fo-sp-big{margin:8px 0 2px;font-size:24px;font-weight:800}.fo-sp-big i{display:block;font-style:normal;font-size:10.5px;font-weight:600;letter-spacing:.03em;color:#9a9484;text-transform:uppercase;margin-top:1px}" +
    ".fo-sp-lines{display:grid;gap:3px;font-size:12px;color:#4a5460;min-height:52px;margin-top:5px}" +
    ".fo-sp-scen{width:100%;margin-top:10px;background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:11px;padding:8px 11px}" +
    ".fo-sp-sh{display:flex;justify-content:space-between;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#a8a291;font-weight:700;padding-bottom:4px}" +
    ".fo-sp-srow{display:flex;justify-content:space-between;font-size:11.5px;color:#6d7480;padding:3.5px 0;border-top:1px solid rgba(11,19,34,.13)}.fo-sp-srow b{color:#12203a}" +
    // draft player cards (the game's own card, brand-themed)
    ".fo-dr-sorts{margin-top:-4px}.fo-dr-sortlbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#ada797;font-weight:700;margin-right:2px}" +
    ".fo-dr-sort{padding:4px 11px;font-size:11.5px}" +
    ".fo-dr-none{padding:30px;text-align:center;color:#9a9484}" +
    ".fo-dc{background:#fcfaf5;border:1px solid rgba(11,19,34,.11);border-radius:12px;padding:8px 12px;margin-bottom:7px}" +
    ".fo-dc-in{border-color:rgba(200,103,74,.55);background:rgba(200,103,74,.08)}" +
    ".fo-dc-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}" +
    ".fo-dc-nm{font-size:14.5px;cursor:pointer}.fo-dc-nm:hover{color:#2b6b68}" +
    ".fo-dc-meta{font-size:11.5px;color:#8a8474}.fo-dc-meta b{color:#243040}" +
    ".fo-dc-fee{margin-left:auto;font-size:14.5px;font-weight:800}" +
    ".fo-dc-sub{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11.5px;color:#8a8474;margin:5px 0 9px}" +
    ".fo-dc-tal{background:rgba(77,166,162,.1);border:1px solid rgba(77,166,162,.3);color:#2b6b68;font-size:9.5px;font-weight:700;padding:1.5px 7px;border-radius:999px;cursor:help}" +
    ".fo-dc-wage{margin-left:auto;font-variant-numeric:tabular-nums}" +
    ".fo-dc-bars{display:grid;grid-auto-flow:column;grid-template-rows:repeat(3,auto);grid-template-columns:repeat(3,1fr);gap:2px 16px}" +
    ".fo-db{display:flex;align-items:center;gap:6px;font-size:10px}.fo-db i{cursor:help}" +
    ".fo-db i{font-style:normal;width:54px;color:#9a9484;flex:none}" +
    ".fo-db b{flex:1;height:5px;border-radius:3px;background:#ece7da;overflow:hidden;display:block;min-width:40px}" +
    ".fo-db u{display:block;height:100%;border-radius:3px;background:" + TEAL + "}" +
    // bar colour tracks the value: weak red -> ordinary amber -> good teal -> elite green
    ".fo-sk-low{background:#C84F4A !important}.fo-sk-mid{background:#D9A441 !important}.fo-sk-good{background:" + TEAL + " !important}.fo-sk-elite{background:#3E9960 !important}" +
    ".fo-dc-flag{font-size:15px;line-height:1}" +
    ".fo-db em{font-style:normal;width:70px;color:#4a5460;flex:none;text-align:right;white-space:nowrap;font-size:9.5px}" +
    "#fo-onb .fo-dr-add{width:auto;min-width:58px;padding:7px 15px;font-size:12.5px;border-radius:9px}" +
    // board report split
    ".fo-br-cols{display:grid;grid-template-columns:1fr 250px;gap:18px;align-items:start}" +
    ".fo-br-row span{display:flex;align-items:center;gap:8px}.fo-br-row span i{display:flex;color:#ada797}" +
    ".fo-br-panel{background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:14px;padding:13px 14px;margin-bottom:12px}" +
    ".fo-br-ph{display:flex;justify-content:space-between;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#9a9484;font-weight:800;margin-bottom:9px}.fo-br-ph b{color:#12203a}" +
    ".fo-sq-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#7a7566;padding:4px 0}.fo-sq-row>span:first-child{width:86px;flex:none}.fo-sq-row b{margin-left:auto;color:#12203a}" +
    ".fo-sqdots{display:flex;gap:3px}.fo-sqdot{width:7px;height:7px;border-radius:50%;background:#ece7da}.fo-sqdot.on{background:" + TEAL + "}" +
    ".fo-fin-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:#7a7566;padding:4px 0}.fo-fin-row>span{width:46px;flex:none}" +
    ".fo-finbar{flex:1;height:6px;border-radius:3px;background:#ece7da;overflow:hidden}.fo-finbar u{display:block;height:100%;border-radius:3px}.fo-fin-teal{background:" + TEAL + "}.fo-fin-terra{background:" + TERRA + "}" +
    ".fo-fin-row em{font-style:normal;font-size:10.5px;color:#5d6570;width:64px;text-align:right;flex:none}" +
    ".fo-fin-end{margin-top:8px;padding-top:8px;border-top:1px solid rgba(11,19,34,.13);font-size:11.5px;color:#7a7566;display:flex;justify-content:space-between}.fo-fin-end b{font-size:13px}" +
    ".fo-ob-report{max-width:900px}" +
    "@media(max-width:860px){.fo-ob-cols{grid-template-columns:1fr}.fo-pks{grid-template-columns:1fr}.fo-br-cols{grid-template-columns:1fr}.fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none}.fo-pk-tag{min-height:0}.fo-sp-lines{min-height:0}}" +
    // squad panel + budget bar (draft sidebar)
    ".fo-budgetbar{height:6px;border-radius:3px;background:#ece7da;overflow:hidden;margin:2px 0 6px}" +
    ".fo-budgetbar u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ");transition:width .3s}" +
    ".fo-sq-item{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(11,19,34,.13);font-size:12px}" +
    ".fo-sq-item:last-child{border-bottom:none}" +
    ".fo-sq-item b{flex:1;font-weight:600;color:#12203a;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-sq-item b:hover{color:#2b6b68}" +
    ".fo-sq-item em{font-style:normal;color:#7a7566;font-variant-numeric:tabular-nums}" +
    "#fo-onb .fo-sq-x{width:22px;height:22px;border-radius:7px;border:1px solid rgba(11,19,34,.13);background:transparent;color:#9a9484;font-size:10px;cursor:pointer;padding:0;line-height:1}" +
    "#fo-onb .fo-sq-x:hover{border-color:#C84F4A;color:#c0392b}" +
    ".fo-sq-empty{font-size:12px;color:#a39d8d;padding:8px 0}" +
    // motion + micro-interactions
    ".fo-ob-card,.fo-ob-draftwrap{animation:foIn .3s ease}" +
    "@keyframes foIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}" +
    ".fo-pk{transition:border-color .15s,box-shadow .15s,transform .15s}.fo-pk:hover{transform:translateY(-2px)}" +
    ".fo-dc{transition:border-color .15s,background .15s}.fo-dc:hover{border-color:rgba(11,19,34,.25)}" +
    "#fo-onb button{transition:filter .15s,transform .06s}#fo-onb button:active:not(:disabled){transform:translateY(1px)}" +
    "#fo-onb{font-variant-numeric:tabular-nums}" +
    // dark thin scrollbar inside the draft list
    ".fo-dr-tblwrap{scrollbar-width:thin;scrollbar-color:#7a7566 transparent}" +
    ".fo-dr-tblwrap::-webkit-scrollbar{width:9px}.fo-dr-tblwrap::-webkit-scrollbar-track{background:transparent}" +
    ".fo-dr-tblwrap::-webkit-scrollbar-thumb{background:#ece7da;border-radius:5px;border:2px solid #f4f0e6}.fo-dr-tblwrap::-webkit-scrollbar-thumb:hover{background:#ece7da}" +
    // beat the engine's default button/input styling inside the onboarding shell
    "#fo-onb button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-onb .fo-ob-cta{background:" + TERRA + " !important;color:#F6F4EE !important;border:none !important}" +
    "#fo-onb .fo-ob-ghost{background:transparent !important;color:#2f3a48 !important;border:1px solid rgba(11,19,34,.25) !important}" +
    "#fo-onb .fo-pk{background:#fff !important;color:#12203a !important}" +
    "#fo-onb .fo-dr-add{background:" + TERRA + " !important;color:#fff !important}#fo-onb .fo-dr-add.on{background:#f7f4ec !important;color:" + TERRA + " !important}" +
    "#fo-onb .fo-dr-chip{background:#f7f4ec !important;color:#545d68 !important}#fo-onb .fo-dr-chip.on{background:" + TERRA + " !important;color:#fff !important}" +
    "#fo-onb .fo-ob-input,#fo-onb .fo-dr-searchi{background:#f7f4ec !important;color:#12203a !important}" +
    "#fo-onb .fo-dr-tbl tbody tr td{background:transparent !important}" +
    "#fo-onb .fo-dr-tbl tbody tr.fo-dr-in td{background:rgba(200,103,74,.15) !important}" +
    "#fo-onb .fo-dr-tbl tbody tr:hover td{background:#ece7da !important}" +
    "#fo-onb .fo-dr-view{cursor:pointer;border-bottom:1px dotted rgba(11,19,34,.13)}#fo-onb .fo-dr-view:hover{color:#2b6b68}" +
    // player skill-summary popover
    "#fo-pd .fo-pd-back{position:fixed;inset:0;z-index:100001;background:rgba(8,16,29,.7);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#fo-pd .fo-pd-card{background:#ffffff;border:1px solid rgba(11,19,34,.13);border-radius:18px;padding:20px 22px;width:100%;max-width:420px;box-shadow:0 24px 60px rgba(0,0,0,.5);color:#12203a}" +
    "#fo-pd .fo-pd-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}" +
    "#fo-pd .fo-pd-nm{font-size:19px;font-weight:800}#fo-pd .fo-pd-meta{font-size:12px;color:#7a7566;margin-top:3px}" +
    "#fo-pd .fo-pd-x{background:transparent;border:1px solid rgba(11,19,34,.25);color:#37424f;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px}" +
    "#fo-pd .fo-pd-money{display:flex;gap:8px;margin:14px 0}#fo-pd .fo-pd-money span{flex:1;background:#f7f4ec;border:1px solid rgba(11,19,34,.13);border-radius:10px;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:#9a9484;font-weight:700}#fo-pd .fo-pd-money b{display:block;font-size:14px;color:#12203a;margin-top:2px;letter-spacing:0}" +
    "#fo-pd .fo-pd-sec{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#2b6b68;font-weight:800;margin-bottom:8px}" +
    "#fo-pd .fo-pd-bar{display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:12px}#fo-pd .fo-pd-bar span{width:78px;color:#5d6570}#fo-pd .fo-pd-bar i{flex:1;height:8px;background:#ece7da;border-radius:5px;overflow:hidden}#fo-pd .fo-pd-bar b{display:block;height:100%;background:" + TEAL + ";border-radius:5px}#fo-pd .fo-pd-bar em{width:74px;text-align:right;font-style:normal;color:#737a84;font-size:11px}" +
    "#fo-pd .fo-pd-tal{margin:12px 0;font-size:12.5px;color:#545d68}#fo-pd .fo-pd-tal b{color:#8a8474;text-transform:uppercase;font-size:10.5px;letter-spacing:.04em}" +
    "#fo-pd button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-pd .fo-pd-act{display:flex}#fo-pd .fo-pd-add{flex:1;background:" + TERRA + " !important;color:#fff !important;border:none;padding:11px;border-radius:10px;font-weight:700;font-size:13.5px;cursor:pointer}#fo-pd .fo-pd-add.on{background:#f7f4ec !important;color:" + TERRA + " !important;border:1px solid " + TERRA + "}" +
    // league standings — form pips + leader/user accents
    ".fo-standings td,.fo-standings th{padding:6px 8px}" +
    ".fo-standings tr.fo-lead td:nth-child(2){font-weight:700}" +
    "html body.ftpskin .fo-standings tr.fo-userrow td,.fo-standings tr.fo-userrow td{background:#fbf1ec !important}" +
    ".fo-standings tr.fo-userrow td:first-child{box-shadow:inset 3px 0 0 " + TERRA + "}" +
    ".fo-standings tr:hover td{background:#f4f1ea}" +
    ".fo-form{display:inline-flex;gap:3px;margin-left:7px;vertical-align:middle}" +
    ".fo-pip{width:8px;height:8px;border-radius:2px;display:inline-block;opacity:.9}" +
    ".fo-W{background:#2f8f6b}.fo-L{background:" + TERRA + "}.fo-T{background:#c3bdae}" +
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
    ".fo-gridcells{flex:1 1 100% !important;max-width:100%;white-space:normal !important;line-height:1.6}" +
    ".fo-gcell{margin:0 2px 3px 0 !important}" +
    ".fo-pool{overflow-x:auto}.fo-pooltabs{flex-wrap:wrap}" +
    // freeze the first column (player/date) so it stays visible while the rest scrolls
    "#page .panel table th:first-child,#page .panel table td:first-child{position:sticky;left:0;background:#fff;z-index:1;box-shadow:1px 0 0 rgba(0,0,0,.12)}" +
    "}" +
    // ===== deep engine-page polish (Matches / Stats / Office / live match) =====
    // page hero: finish the navy band properly — light text, padding, radius
    "#page .page-head{padding:20px 24px;border-radius:14px;box-shadow:0 12px 32px rgba(11,19,34,.18)}" +
    "#page .page-head h1{color:#F6F4EE !important}" +
    "#page .page-head p{color:rgba(246,244,238,.62) !important;margin:3px 0 0}" +
    "#page .page-head .eyebrow{color:#e79274 !important}" +
    "#page .page-head .action-row button{background:rgba(246,244,238,.1);color:#F6F4EE;border:1px solid rgba(246,244,238,.25);border-radius:9px;padding:8px 14px;cursor:pointer}" +
    "#page .page-head .action-row button:hover{background:rgba(246,244,238,.2)}" +
    "#page .page-head .action-row button.primary,#page .page-head .action-row .primary{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    "#page .page-head .action-row label{color:rgba(246,244,238,.8)}" +
    // panels: soft radius, refined title bar instead of flat black
    "#page .panel{border-radius:12px;overflow:hidden;border-color:#e4dfd2;box-shadow:0 3px 14px rgba(11,19,34,.06)}" +
    "#page .panel>h4{background:linear-gradient(160deg," + NAVY2 + "," + NAVY + ") !important;color:#F6F4EE;margin:0;padding:10px 14px;font-size:11.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:800}" +
    "#page .panel table th{font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484}" +
    // my club's row in any table: terracotta accent, not the engine's mint yellow
    "#page tr.fo-userrow{background:transparent !important}" +
    "#page tr.fo-userrow>td{background:rgba(200,103,74,.09) !important}" +
    "#page tr.fo-userrow>td:first-child{box-shadow:inset 3px 0 0 " + TERRA + "}" +
    // the engine skin paints 'your fixture' rows #feffcc — re-tint to the brand
    'html body.ftpskin tr[style*="eef4ee"] td,html body.ftpskin tr[style*="eef8fb"] td{background:rgba(200,103,74,.09) !important}' +
    'html body.ftpskin tr[style*="eef4ee"] td:first-child,html body.ftpskin tr[style*="eef8fb"] td:first-child{box-shadow:inset 3px 0 0 ' + TERRA + "}" +
    // office KPI tiles
    "#page .kpi-grid .kpi-card{border-radius:12px;border:1px solid #e4dfd2;box-shadow:0 3px 12px rgba(11,19,34,.05);transition:transform .15s,box-shadow .15s}" +
    "#page .kpi-grid .kpi-card:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(11,19,34,.1)}" +
    "#page .kpi-grid .kpi-card span{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:#9a9484;font-weight:700}" +
    "#page .kpi-grid .kpi-card b{color:#12203a}" +
    // live match: give the scoreboard visual weight
    "#page .mc-score .panel{border-top:3px solid " + TERRA + "}" +
    "#page .ftp-match-body{border-radius:12px}" +
    // home-pitch picker (create screen)
    ".fo-pitchgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}" +
    "#fo-onb .fo-pitch{text-align:left;background:#fff !important;border:1.5px solid rgba(11,19,34,.13);border-radius:12px;padding:10px 12px;cursor:pointer;color:#12203a !important}" +
    "#fo-onb .fo-pitch b{display:block;font-size:13px;margin-bottom:2px}" +
    "#fo-onb .fo-pitch span{font-size:11px;color:#8a8474;line-height:1.35;display:block}" +
    "#fo-onb .fo-pitch.on{border-color:#3d8a86;box-shadow:0 0 0 3px rgba(77,166,162,.22)}" +
    "@media(max-width:700px){.fo-pitchgrid{grid-template-columns:1fr 1fr}}" +
    ".fo-ob-eyebrow{color:#C0562F;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px}" +
    ".fo-ob-lbl{font-weight:800 !important;color:#12203a !important;font-size:12px !important;letter-spacing:.09em}" +
    ".fo-ob-lbl .fo-ob-hint{font-weight:600;color:#8a8474}" +
    ".fo-pitch{border-left:4px solid #c9c2b2 !important}" +
    ".fo-pitch[data-pitch=balanced]{border-left-color:#4DA6A2 !important}" +
    ".fo-pitch[data-pitch=green]{border-left-color:#3E9960 !important}" +
    ".fo-pitch[data-pitch=dry]{border-left-color:#C08A2F !important}" +
    ".fo-pitch[data-pitch=flat]{border-left-color:#4A7FC8 !important}" +
    ".fo-pitch[data-pitch=slow]{border-left-color:#8a8474 !important}" +
    ".fo-pitch[data-pitch=cracked]{border-left-color:#C84F4A !important}" +
    ".fo-pitch[data-pitch=twoPaced]{border-left-color:#8B6BB5 !important}" +
    ".fo-pitch b{color:#12203a;font-size:13.5px}" +
    ".fo-ob-cta{padding:15px 40px !important;font-size:15.5px !important;font-weight:800 !important;border-radius:11px !important;box-shadow:0 5px 16px rgba(192,86,47,.38);letter-spacing:.01em}" +
    ".fo-ob-cta:hover{transform:translateY(-1px);box-shadow:0 7px 20px rgba(192,86,47,.5)}" +
    ".fo-ob-sep{flex:1 1 26px;min-width:18px;border-top:2px dotted #c9c2b2;margin:0 6px;align-self:center}" +
    ".fo-ob-prog{display:flex;align-items:center}" +
    ".fo-ob-step.done + .fo-ob-sep, .fo-ob-sep:has(+ .fo-ob-step.done)" + "{border-top-color:#C0562F}" +
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
    ".fo-pitch.on{box-shadow:0 0 0 2px rgba(192,86,47,.35);border-color:#C0562F}" +
    ".fo-ob-act{display:block}" +
    ".fo-ob-cta{display:block !important;width:100% !important;padding:17px 20px !important;font-size:16px !important;text-align:center}" +
    ".fo-charter-big{max-width:880px !important;margin:0 auto;padding:64px 72px !important;min-height:62vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}" +
    ".fo-charter-h1{font-size:40px !important;letter-spacing:-.8px;margin:10px 0 2px !important}" +
    ".fo-charter-date{font-size:13px;font-weight:700;color:#8a8474;letter-spacing:.1em;text-transform:uppercase;margin:2px 0 14px}" +
    ".fo-charter-lead{font-size:16.5px !important;max-width:56ch}" +
    ".fo-charter-big .fo-charter-grant{margin:26px auto;padding:26px 60px}" +
    ".fo-charter-big .fo-charter-grant b{font-size:44px}" +
    ".fo-charter-big .fo-ob-act-c{width:100%;max-width:460px}" +
    "@media(max-width:700px){.fo-charter-big{padding:36px 22px !important;min-height:0}.fo-charter-h1{font-size:28px !important}.fo-charter-big .fo-charter-grant b{font-size:32px}}" +
    ".fo-sp-mono{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:21px;color:#fff;margin:0 auto 10px;font-family:Georgia,serif}" +
    ".fo-mono-teal{background:#2d7a76}.fo-mono-terra{background:#C0562F}.fo-mono-gold{background:#A8842C}" +
    ".fo-sp-ind{display:block;font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#8a8474;margin:2px 0 10px}" +
    ".fo-sp-fine{display:block;font-size:10.5px;color:#a09a8a;border-top:1px dashed #e2ddd0;padding-top:9px;margin-top:12px}" +
    ".fo-pk-sp .fo-pk-name{display:none}" +
    ".fo-brandmark{display:flex;align-items:center;justify-content:center;height:56px;border-radius:10px;margin:0 auto 12px;width:100%;max-width:200px}" +
    ".fo-brand-pru{background:#ED1B2E;color:#fff;font-weight:800;font-size:15px;letter-spacing:.12em;font-family:Arial,Helvetica,sans-serif}" +
    ".fo-brand-nike{background:#111;color:#fff;font-weight:900;font-size:22px;letter-spacing:.06em;font-style:italic;transform:skewX(-6deg);font-family:'Futura','Arial Black',Arial,sans-serif}" +
    ".fo-brand-emirates{background:#fff;border:1px solid #eee;color:#D71920;font-weight:600;font-size:24px;font-family:Georgia,'Times New Roman',serif;letter-spacing:.01em}" +
    ".fo-exp-cols{display:grid;grid-template-columns:1fr 1.2fr;gap:20px;align-items:start;margin:6px 0 4px}" +
    ".fo-exp-card{background:#fff;border:1px solid #e2ddd0;border-radius:13px;padding:16px;box-shadow:0 4px 14px rgba(18,32,58,.06)}" +
    ".fo-exp-h{font-size:16px;color:#12203a}.fo-exp-meta{font-size:12px;color:#8a8474;margin:2px 0 10px}" +
    ".fo-exp-bars .fo-sk{display:grid;grid-template-columns:76px 1fr 26px;gap:8px;align-items:center;margin:5px 0;font-size:12px}" +
    ".fo-exp-bars .fo-sk i{font-style:normal;color:#5d6779;font-weight:700}" +
    ".fo-exp-bars .fo-sk b{display:block;height:7px;border-radius:99px;background:#efeade;overflow:hidden}" +
    ".fo-exp-bars .fo-sk u{display:block;height:100%;border-radius:99px}" +
    ".fo-exp-bars .fo-sk em{font-style:normal;font-weight:800;color:#12203a;text-align:right}" +
    ".fo-exp-tals{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap}" +
    ".fo-exp-tal{background:#e8effa;border:1px solid #cfdcf2;color:#35619e;font-size:11.5px;font-weight:700;border-radius:999px;padding:4px 11px}" +
    ".fo-exp-note{margin-top:12px;font-size:11px;color:#a09a8a;border-top:1px dashed #e2ddd0;padding-top:8px;text-align:center}" +
    ".fo-exp-cards{display:flex;flex-direction:column;gap:14px}" +
    ".fo-exp-tag{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#C0562F;margin-bottom:4px}" +
    ".fo-exp-money{display:flex;justify-content:space-between;gap:10px;background:#f6f4ee;border-radius:8px;padding:8px 12px;margin:8px 0 10px;font-size:12.5px;color:#5d6779}" +
    ".fo-exp-money b{color:#12203a;font-size:13.5px}" +
    ".fo-dr-sticky{position:sticky;top:0;z-index:40;background:rgba(245,241,230,.96);backdrop-filter:blur(4px);border-bottom:1px solid #e2ddd0;padding:10px 2px;margin-bottom:14px;display:flex;gap:18px;align-items:center;flex-wrap:wrap}" +
    ".fo-dr-spent{flex:1;min-width:240px}" +
    ".fo-dr-spentl{display:flex;justify-content:space-between;font-size:12.5px;color:#5d6779;margin-bottom:5px}" +
    ".fo-dr-spentl b{color:#12203a}" +
    ".fo-dr-counts{display:flex;gap:7px}" +
    ".fo-dr-main{min-width:0}" +
    ".fo-rail{max-width:100%}" +
    ".fo-str-row{display:grid;grid-template-columns:88px 1fr 30px;gap:9px;align-items:center;margin:8px 0;font-size:12.5px}" +
    ".fo-str-row span{color:#5d6779;font-weight:700}" +
    ".fo-str-bar{display:block;height:8px;border-radius:99px;background:#efeade;overflow:hidden}" +
    ".fo-str-bar u{display:block;height:100%;border-radius:99px}" +
    ".fo-str-row em{font-style:normal;font-weight:800;color:#12203a;text-align:right}" +
    ".fo-fin-row2{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#5d6779;padding:7px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-fin-row2 b{font-size:13.5px}" +
    ".fo-fin-bank{border-bottom:none;margin-top:2px}" +
    ".fo-fin-bank b{font-size:16px;color:#12203a}" +
    ".fo-facts{margin:6px 0 4px}" +
    ".fo-fact{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:9px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-fact span{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#8a8474}" +
    ".fo-fact b{font-size:14px;color:#12203a;font-weight:700;text-align:right}" +
    ".fo-segs{display:inline-flex;gap:5px;align-items:center}" +
    ".fo-seg{width:26px;height:8px;border-radius:99px;transition:background .15s ease}" +
    ".fo-segt-low{background:rgba(200,79,74,.14)}.fo-segt-low.on{background:#C84F4A}" +
    ".fo-segt-mid{background:rgba(217,164,65,.16)}.fo-segt-mid.on{background:#D9A441}" +
    ".fo-segt-good{background:rgba(77,166,162,.15)}.fo-segt-good.on{background:#4DA6A2}" +
    ".fo-segt-elite{background:rgba(62,153,96,.15)}.fo-segt-elite.on{background:#3E9960}" +
    ".fo-str-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid #f0ece1}" +
    ".fo-str-row:last-child{border-bottom:none}" +
    ".fo-str-row span:first-child{color:#12203a;font-weight:600;font-size:13.5px;letter-spacing:-.1px}" +
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
    ".fo-cty.on{border-color:#C0562F !important;background:#fdf3e2 !important;box-shadow:0 0 0 2px rgba(192,86,47,.28) !important;color:#12203a !important;font-weight:800 !important}" +
    ".fo-cty.on::after{content:'\\2713';margin-left:auto;color:#C0562F;font-weight:800}" +
    ".fo-pitch.on{border-color:#C0562F !important;box-shadow:0 0 0 2px rgba(192,86,47,.28) !important;background:#fdf9ef !important}" +
    ".fo-pitch.on b::after{content:' \\2713';color:#C0562F}" +
    ".fo-pk.on{border-color:#C0562F !important;box-shadow:0 0 0 2px rgba(192,86,47,.28) !important;background:#fdf9ef !important}" +
    ".fo-orders-bar{position:sticky;top:0;z-index:30;background:rgba(245,241,230,.97);backdrop-filter:blur(4px);border-bottom:1px solid #e2ddd0;padding:10px 2px;margin-bottom:12px}" +
    ".fo-coach-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}" +
    ".fo-autopick{background:#C0562F !important;color:#fff !important;border:0;border-radius:9px;padding:10px 18px;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 3px 10px rgba(192,86,47,.3)}" +
    ".fo-coach-hint{font-size:12px;color:#8a8474}" +
    ".fo-ready{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}" +
    ".fo-rdy{font-size:11.5px;font-weight:700;border-radius:999px;padding:4px 11px;background:#f3efe4;border:1px solid #e2ddd0;color:#8a8474}" +
    ".fo-rdy.ok{background:#eef4ee;border-color:#d5e0d7;color:#2f6b46}" +
    ".fo-fit{display:inline-block;min-width:28px;text-align:center;font-weight:800;font-size:11.5px;border-radius:7px;padding:2px 6px;color:#fff}" +
    ".fo-fit-elite{background:#3E9960}.fo-fit-good{background:#4DA6A2}.fo-fit-mid{background:#D9A441}.fo-fit-low{background:#C84F4A}" +
    // match centre: quieter header boxes, readable links rail
    ".fo-matchpage .mc-top .panel .pad{padding:8px 12px !important}" +
    ".fo-matchpage .mc-top h4{font-size:12px !important;padding:7px 12px !important}" +
    ".fo-matchpage .mc-top .kv td{padding:3px 8px !important;font-size:12.5px !important}" +
    ".ftp-match-links{background:#fff !important;border:1px solid #e2ddd0 !important;border-radius:12px;overflow:hidden}" +
    ".ftp-match-links h4{background:#0B1322 !important;color:#fff !important;font-size:12px !important;letter-spacing:.06em;text-transform:uppercase}" +
    ".ftp-match-links a{display:block;padding:9px 14px !important;color:#3c4658 !important;background:transparent !important;border-left:3px solid transparent;font-weight:600;text-decoration:none}" +
    ".ftp-match-links a:hover{background:#f6f4ee !important}" +
    ".ftp-match-links a.on{background:#fdf3e2 !important;color:#12203a !important;border-left-color:#C0562F !important;font-weight:800}" +
    // opponent scout page: contrast pass
    ".fo-scout-hero{background:linear-gradient(135deg,#0B1322,#1C2433) !important;color:#e9eef2 !important}" +
    ".fo-scout-hero .fo-scout-name{color:#fff !important}" +
    ".fo-scout-hero .small,.fo-scout-hero span{color:#9aa3b2}" +
    ".fo-scout-kpis b{color:#fff !important}" +
    ".fo-scout-links a{color:#3c4658 !important;font-weight:600}" +
    ".fo-scout-links a.on{color:#12203a !important;border-color:#C0562F !important;font-weight:800}" +
    // the Live Match link is the loudest thing in the nav while a match runs
    "#topbar a.fo-live{background:#C0562F !important;color:#fff !important;border-radius:9px;padding:6px 13px !important;font-weight:800;animation:foPulse 2.2s ease-in-out infinite}" +
    ".fo-setr-done{background:#2f6b46 !important;color:#fff !important;border-color:#2f6b46 !important}" +
    ".fo-setr-done:hover{background:#275a3b !important}" +
    ".fo-next-cta.fo-done{background:#2f6b46 !important;color:#fff !important;border:none;box-shadow:0 3px 10px rgba(47,107,70,.3)}" +
    ".fo-md-live{color:#ff6b5e;font-weight:800;letter-spacing:.08em;animation:foPulse 1.6s ease-in-out infinite;background:rgba(255,107,94,.12);border-radius:8px;padding:6px 12px}" +
    ".fo-br-closure{margin-top:18px;font-size:14px;line-height:1.7;color:#3c4658}" +
    ".fo-br-closure p{margin:0 0 10px}" +
    ".fo-br-luck{font-weight:800;color:#12203a}" +
    ".fo-rail-sec{margin:0 0 22px}" +
    ".fo-rail-h{display:flex;align-items:baseline;gap:10px;margin:0 0 9px}" +
    ".fo-rail-h b{font-size:16px;color:#12203a}" +
    ".fo-rail-h span{font-size:12px;color:#8a8474}" +
    ".fo-rail-have{margin-left:auto;font-style:normal;font-size:11.5px;font-weight:800;color:#2f6b46;background:#eef4ee;border:1px solid #d5e0d7;border-radius:999px;padding:3px 10px}" +
    ".fo-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 12px;scrollbar-width:thin}" +
    ".fo-rail>*{flex:0 0 258px;scroll-snap-align:start}" +
    ".fo-rail::-webkit-scrollbar{height:8px}" +
    ".fo-rail::-webkit-scrollbar-thumb{background:#d8d2c2;border-radius:99px}" +
    "@media(max-width:760px){.fo-rail>*{flex-basis:238px}.fo-dr-sticky{top:0;gap:10px}}" +
    ".fo-exp-def{padding:8px 0;border-bottom:1px solid #efeade;font-size:13px}" +
    ".fo-exp-def b{display:inline-block;min-width:96px;color:#12203a}.fo-exp-def span{color:#5d6779}" +
    ".fo-exp-talbox{background:#eef4ee;border:1px solid #d5e0d7;border-radius:11px;padding:13px 16px;font-size:13.5px;line-height:1.6;margin-top:16px}" +
    "@media(max-width:760px){.fo-exp-cols{grid-template-columns:1fr}}" +
    ".fo-ctygrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:2px 0 14px}" +
    ".fo-cty{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2ddd0;border-radius:10px;padding:9px 11px;cursor:pointer;font-size:13px;font-weight:600;color:#3c4658;text-align:left;transition:border-color .12s ease,box-shadow .12s ease}" +
    ".fo-cty i{font-style:normal;font-size:17px;line-height:1}" +
    ".fo-cty:hover{border-color:#c9c2b2}" +
    ".fo-cty.on{border-color:#C0562F;box-shadow:0 0 0 2px rgba(192,86,47,.18);color:#12203a;font-weight:800}" +
    ".fo-clubprev{background:linear-gradient(135deg,#0B1322,#1C2433);border-radius:12px;padding:16px;margin-bottom:14px;text-align:center}" +
    ".fo-clubprev-crest{width:52px;height:52px;border-radius:50%;background:#C0562F;color:#fff;font-weight:800;font-size:17px;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;margin:0 auto 8px}" +
    ".fo-clubprev-nm{color:#fff;font-weight:800;font-size:16px;letter-spacing:-.2px}" +
    ".fo-clubprev-sub{color:#9aa3b2;font-size:11.5px;margin-top:3px}" +
    "@media(max-width:860px){.fo-ctygrid{grid-template-columns:repeat(3,1fr)}}" +
    "@media(max-width:560px){.fo-ctygrid{grid-template-columns:repeat(2,1fr)}}" +
    // charter (club founded) screen
    ".fo-ob-charter{text-align:center}" +
    ".fo-charter-ic{width:64px;height:64px;border-radius:50%;background:rgba(200,103,74,.12);color:#a95f38;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}" +
    ".fo-charter-grant{background:#faf8f3;border:1px solid #e4dfd2;border-radius:14px;padding:14px;margin:6px 0 16px}" +
    ".fo-charter-grant span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#9a9484;font-weight:700}" +
    ".fo-charter-grant b{display:block;font-size:30px;font-weight:800;color:#2b6b68;margin:2px 0}" +
    ".fo-ob-charter .fo-ob-chks{display:inline-grid;margin:0 auto 4px}" +
    // training & youth page
    ".fo-tr-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-tr-tbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484;padding:7px 8px;border-bottom:1px solid rgba(11,19,34,.1)}" +
    ".fo-tr-tbl td{padding:8px;border-bottom:1px solid rgba(11,19,34,.06);vertical-align:middle}" +
    ".fo-tr-nm b{color:#12203a}.fo-tr-meta{display:block;font-size:11px;color:#9a9484}" +
    ".fo-pot{font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:2.5px 9px;border-radius:999px}" +
    ".fo-pot-star{background:rgba(217,164,65,.15);color:#a97b1e;border:1px solid rgba(217,164,65,.45)}" +
    ".fo-pot-high{background:rgba(62,153,96,.12);color:#2e7d4f;border:1px solid rgba(62,153,96,.4)}" +
    ".fo-pot-useful{background:rgba(77,166,162,.1);color:#2b6b68;border:1px solid rgba(77,166,162,.35)}" +
    ".fo-pot-limited{background:rgba(11,19,34,.05);color:#8a8474;border:1px solid rgba(11,19,34,.12)}" +
    ".fo-fat{font-size:11.5px;font-weight:600}.fo-fat-ok{color:#2e7d4f}.fo-fat-mid{color:#a97b1e}.fo-fat-bad{color:#c0392b}" +
    "#page .fo-tr-tbl select{font:inherit;font-size:12px;padding:5px 8px;border:1px solid #d8d2c2;border-radius:8px;background:#fff;color:#12203a;max-width:150px}" +
    ".fo-tr-progress{min-width:150px}.fo-tr-bar{height:6px;border-radius:3px;background:#ece7da;overflow:hidden;margin-bottom:3px}" +
    ".fo-tr-bar u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + ",#3E9960)}" +
    ".fo-tr-progress span{font-size:10.5px;color:#9a9484}" +
    ".fo-tr-bulk{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-bottom:10px}" +
    "#page .fo-tr-b{font-size:12px;padding:6px 12px;border:1px solid #d8d2c2;background:#fff;color:#243040;border-radius:8px;cursor:pointer}" +
    "#page .fo-tr-b:hover{border-color:" + TEAL + ";color:#2b6b68}" +
    ".fo-tr-rep .fo-tr-g{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:#2e7d4f}" +
    ".fo-tr-rep .fo-tr-rec{color:#2b6b68}.fo-tr-rep .fo-tr-sign{color:#a95f38;font-weight:700}" +
    ".fo-ycs{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}" +
    ".fo-yc{background:#faf8f3;border:1px solid #e4dfd2;border-radius:12px;padding:13px 14px}" +
    ".fo-yc-h{display:flex;align-items:center;gap:7px;font-size:14px}.fo-yc-h b{color:#12203a;flex:1}" +
    ".fo-yc-meta{font-size:11.5px;color:#8a8474;margin:3px 0 8px}" +
    ".fo-yc-bars{display:grid;gap:4px;margin-bottom:8px}" +
    ".fo-yc .fo-sk i{color:#9a9484;width:34px}.fo-yc .fo-sk b{background:#ece7da}.fo-yc .fo-sk em{color:#5d6570}" +
    ".fo-yc-money{display:flex;justify-content:space-between;font-size:11.5px;color:#8a8474;margin-bottom:9px}.fo-yc-money b{color:#12203a}" +
    "#page .fo-yc-sign{width:100%;padding:9px;border:none !important;border-radius:9px;background:" + TERRA + " !important;color:#fff !important;font-weight:700;cursor:pointer}" +
    "#page .fo-yc-sign:hover:not(:disabled){filter:brightness(1.07)}#page .fo-yc-sign:disabled{opacity:.45;cursor:default}" +
    ".fo-mk-gone{font-size:11.5px;font-weight:700;color:#8a8474;background:#ece7da;border-radius:9px;padding:8px;text-align:center}" +
    // game manual
    ".fo-man{max-width:880px}" +
    ".fo-man .fo-man-toc{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 16px}" +
    ".fo-man .fo-man-toc a{font-size:12px;font-weight:700;color:#1f4e5f;background:#e8efe9;border:1px solid #d5e0d7;border-radius:999px;padding:5px 12px;text-decoration:none;cursor:pointer}" +
    ".fo-man .fo-man-toc a:hover{background:#dce8de}" +
    ".fo-man details{background:#fff;border:1px solid #e2ddd0;border-radius:12px;margin:0 0 10px;overflow:hidden}" +
    ".fo-man summary{cursor:pointer;list-style:none;font-weight:800;font-size:15px;color:#12203a;padding:13px 16px;display:flex;align-items:center;gap:10px}" +
    ".fo-man summary::-webkit-details-marker{display:none}" +
    ".fo-man summary:before{content:'+';font-weight:800;color:#C0562F;width:16px;text-align:center;flex:0 0 16px}" +
    ".fo-man details[open] summary:before{content:'\\2212'}" +
    ".fo-man details[open] summary{border-bottom:1px solid #efeade}" +
    ".fo-man .fo-man-b{padding:12px 16px 16px;font-size:13.5px;line-height:1.65;color:#3c4658}" +
    ".fo-man .fo-man-b p{margin:0 0 10px}" +
    ".fo-man .fo-man-b ul{margin:0 0 10px;padding-left:20px}" +
    ".fo-man .fo-man-b li{margin:3px 0}" +
    ".fo-man .fo-man-b table{width:100%;border-collapse:collapse;margin:4px 0 12px;font-size:12.5px}" +
    ".fo-man .fo-man-b th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#8a8474;padding:5px 8px;border-bottom:1px solid #e2ddd0}" +
    ".fo-man .fo-man-b td{padding:6px 8px;border-bottom:1px solid #f0ece1;vertical-align:top}" +
    ".fo-man .fo-man-b td b{color:#12203a}" +
    ".fo-man .fo-man-tip{background:#eef4ee;border:1px solid #d5e0d7;border-radius:9px;padding:9px 12px;margin:2px 0 10px;font-size:12.5px}" +
    ".fo-man .fo-man-tip b{color:#1f4e5f}" +
    ".fo-mk-claimed{opacity:.6}" +
    ".fo-yc-view,.fo-mk-view{cursor:pointer}.fo-yc-view:hover,.fo-mk-view:hover{color:#2b6b68 !important}" +
    ".fo-yc-note{font-size:12.5px;color:#5d6570;background:rgba(77,166,162,.07);border:1px solid rgba(77,166,162,.2);border-radius:9px;padding:8px 12px;margin-bottom:11px}" +
    // season progress + momentum chips (club page psychology strip)
    ".fo-season-strip{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 14px}" +
    ".fo-progress{flex:1 1 260px;min-width:220px;background:#fff;border:1px solid #e4dfd2;border-radius:12px;padding:10px 14px;box-shadow:0 3px 12px rgba(11,19,34,.05)}" +
    ".fo-progress-l{display:flex;justify-content:space-between;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9a9484;font-weight:700;margin-bottom:6px}.fo-progress-l b{color:#12203a}" +
    ".fo-progress-bar{height:7px;border-radius:4px;background:#efeadf;overflow:hidden}" +
    ".fo-progress-bar u{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ");transition:width .5s ease}" +
    ".fo-mchip{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid #e4dfd2;border-radius:999px;padding:8px 15px;font-size:12.5px;font-weight:700;color:#12203a;box-shadow:0 3px 12px rgba(11,19,34,.05)}" +
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
      fl.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
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
      // Practice Game (and, for founders only, an Admin link) live with the main nav,
      // inserted just before the game's right-hand status block.
      var addNav = function (cls, label, fn) {
        var a = tb.querySelector("a." + cls); if (!a) a = mk(label, cls, fn);
        if (status) tb.insertBefore(a, status); else tb.appendChild(a);
      };
      addNav("fo-training", "Training", function () { location.hash = "#/training"; if (typeof window.route === "function") window.route(); });
      addNav("fo-transfers", "Transfers", function () { location.hash = "#/transfers"; if (typeof window.route === "function") window.route(); });
      // Live Match appears only while a match is actually in progress
      var liveOn = false; try { liveOn = (typeof M !== "undefined") && M && !M.done; } catch (e) {}
      var lv = tb.querySelector("a.fo-live");
      if (liveOn) { if (!lv) addNav("fo-live", "\u25CF Live Match", function () { location.hash = "#/match"; if (typeof window.route === "function") window.route(); }); }
      else if (lv) lv.remove();
      addNav("fo-friendly", "Practice Game", startFriendly);
      var showMd = false; try { showMd = (SYNC && SYNC.started) || (App.results || []).some(function (r) { return r.comp === "league"; }); } catch (e) {}
      if (showMd) addNav("fo-matchday", "Matchday", function () { location.hash = "#/matchday"; if (typeof window.route === "function") window.route(); });
      addNav("fo-guide", "Manual", function () { location.hash = "#/guide"; if (typeof window.route === "function") window.route(); });
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
      tb.appendChild(out);
    } catch (e) {}
  }
  // Practice Game opens a setup screen (opponent + pitch + weather); after a short
  // breather it drops you on the lineup. Nothing is randomised or auto-started.
  var foFriendlies = [];
  function startFriendly() {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) {
        // on slow connections the league snapshot may still be loading —
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
  // display names only — the engine's pitch ids never change
  var FO_PITCH_NAMES = { balanced: "Balanced", flat: "Flat", green: "Green", dry: "Crumbling", slow: "Slow", cracked: "Sticky", twoPaced: "Two-paced" };
  function foPitchName(id) { var k = String(id == null ? "" : (id.id || id)).trim(); return FO_PITCH_NAMES[k] || foTitle(k); }
  function foTitle(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }
  function foMatchSetup(preIx) {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) { alert("No clubs to play yet."); return; }
      var ex = document.getElementById("fo-setup"); if (ex) ex.remove();
      var opts = GD.teams.map(function (t, i) { return i === App.teamIx ? "" : "<option value='" + i + "'" + (i === preIx ? " selected" : "") + ">" + E(t.name) + "</option>"; }).join("");
      var pitchOpts = FO_PITCHES.map(function (p) { return "<option value='" + p + "'>" + foPitchName(p) + "</option>"; }).join("");
      var wxOpts = (typeof WXLIST !== "undefined" ? WXLIST : ["Sunny"]).map(function (w) { return "<option>" + w + "</option>"; }).join("");
      var m = document.createElement("div"); m.id = "fo-setup"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Practice match</div><h3>Set up a friendly</h3>" +
        "<label>Opponent<select id='fo-su-opp'>" + opts + "</select></label>" +
        "<label>Pitch<select id='fo-su-pitch'>" + pitchOpts + "</select></label>" +
        "<label>Weather<select id='fo-su-wx'>" + wxOpts + "</select></label>" +
        "<div class='fo-modal-act'><button class='fo-su-go primary'>Schedule friendly ▸</button><button class='fo-su-cancel'>Cancel</button></div></div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e) { if (e.target === m) m.remove(); });
      m.querySelector(".fo-su-cancel").addEventListener("click", function () { m.remove(); });
      m.querySelector(".fo-su-go").addEventListener("click", function () {
        var ix = parseInt(m.querySelector("#fo-su-opp").value, 10);
        if (isNaN(ix)) { alert("Pick an opponent first."); return; }
        var pitch = m.querySelector("#fo-su-pitch").value, wx = m.querySelector("#fo-su-wx").value;
        m.remove();
        foBreakScreen(foAddFriendly(ix, pitch, wx));
      });
    } catch (e) { say(e); }
  }
  function foAddFriendly(ix, pitch, wx) {
    foFriendlies = (foFriendlies || []).filter(function (f) { return f.oppName !== GD.teams[ix].name; });   // one per opponent
    var fr = { oppIx: ix, oppName: GD.teams[ix].name, pitch: pitch, weather: wx, seed: 4200 + ix * 7 + foFriendlies.length * 13 };
    foFriendlies.push(fr);
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
        "<div class='small'>Take a breather — your lineup opens when the timer ends.</div>" +
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
    foChallenge(fr.oppIx, fr.pitch, fr.weather);
  }
  function foRemoveFriendly(i) {
    var fr = foFriendlies[i]; if (!fr) return;
    try {
      if (typeof M !== "undefined" && M && !M.done && App.pending && App.pending.__friendly && App.pending.away === fr.oppName) {
        say("That friendly is being played right now — finish or abandon the match first."); return;
      }
    } catch (e) {}
    foConfirm({ title: "Remove the friendly vs " + fr.oppName + "?", body: "You can schedule another from their club page any time.", confirm: "Remove", cancel: "Keep it" })
      .then(function (ok) { if (!ok) return; foFriendlies.splice(i, 1); if (typeof window.route === "function") window.route(); });
  }

  // ===========================================================================
  //  Premium Club home. A fully custom, branded dashboard that replaces the
  //  engine's default pgClub (same data + game hooks, modern presentation).
  // ===========================================================================
  var FO_MOODS = ["Furious", "Angry", "Restless", "Steady", "Pleased", "Delighted", "Euphoric"];
  function foWageBill(t) { return (t && t.players) ? t.players.reduce(function (s, p) { return s + (+p.wage || 0); }, 0) : 0; }
  function foMoney(n) { return "$" + Math.round(n || 0).toLocaleString(); }
  function foTeamLeaders(t) {
    var bat = { name: null, runs: 0 }, bowl = { name: null, wkts: 0 };
    try {
      (t.players || []).forEach(function (p) {
        var h = (App.playerHist && App.playerHist[p.name]) || [], runs = 0, wkts = 0;
        h.forEach(function (e) { var bm = /(\d+)/.exec(e.bat || ""); if (bm) runs += parseInt(bm[1], 10); var wm = /(\d+)\s*[-\/]/.exec(e.bowl || ""); if (wm) wkts += parseInt(wm[1], 10); });
        if (runs > bat.runs) bat = { name: p.name, runs: runs };
        if (wkts > bowl.wkts) bowl = { name: p.name, wkts: wkts };
      });
    } catch (e) {}
    return { bat: bat, bowl: bowl };
  }
  function foPitchPill(p) { var c = /green|dry|cracked/.test(p) ? "teal" : "muted"; return "<span class='fo-pill fo-pill-" + c + "'>" + E(foPitchName(p)) + "</span>"; }
  // ms until the next 9:00 AM America/New_York (league matchday time)
  function foNextMatchdayMs() {
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      var p = {}; f.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var sec = (+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second);
      var target = 9 * 3600;
      var left = target - sec; if (left <= 0) left += 24 * 3600;
      return left * 1000;
    } catch (e) { return null; }
  }
  function foCdText(ms) {
    if (ms == null) return "";
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return h + ":" + pad(m) + ":" + pad(ss);
  }
  var foCdTimer = null;
  // daily check-in streak: the cheapest honest habit loop there is
  function foStreak() {
    try {
      var k = "fol_streak_" + ((LG && LG.id) || "solo");
      var s = {}; try { s = JSON.parse(lsGet(k) || "{}"); } catch (e) {}
      var today = new Date().toISOString().slice(0, 10);
      if (s.last === today) return s.n || 1;
      var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      s.n = (s.last === y) ? (s.n || 0) + 1 : 1;
      s.last = today;
      lsSet(k, JSON.stringify(s));
      return s.n;
    } catch (e) { return 0; }
  }
  function foPremiumClub() {
    try {
      if (typeof userTeam !== "function" || typeof GD === "undefined" || !GD.teams) { return foOrigClub && foOrigClub(); }
      if (typeof seasonInit === "function") seasonInit();
      if (typeof econInit === "function") econInit();
      var t = userTeam(), S = App.season;
      var rowsL = typeof leagueRows === "function" ? leagueRows() : [];
      var pi = rowsL.findIndex(function (x) { return x.nm === t.name; }), me = rowsL[pi] || { p: 0, w: 0, l: 0, pts: 0, nrr: 0 };
      var pos = pi >= 0 ? pi + 1 : "-";
      var bank = (App.fin && App.fin.bank) || 0, wages = foWageBill(t);
      var mood = FO_MOODS[Math.max(0, Math.min(6, t.mood == null ? 3 : t.mood))];
      var cond = (t.mood >= 5) ? "Excellent" : (t.mood >= 3) ? "Good" : (t.mood >= 1) ? "Fair" : "Poor";
      var form = foFormMap()[t.name] || [];
      var pips = form.map(function (x) { return "<i class='fo-pip fo-" + x + "' title='" + x + "'></i>"; }).join("");
      var d = new Date(), dateStr = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      var stat = function (accent, ic, label, value, sub) {
        return "<div class='fo-stat fo-acc-" + accent + "'><div class='fo-stat-ic'>" + ic + "</div><div class='fo-stat-body'>" +
          "<div class='fo-stat-l'>" + label + "</div><div class='fo-stat-v'>" + value + "</div>" + (sub ? "<div class='fo-stat-s'>" + sub + "</div>" : "") + "</div></div>";
      };
      var stats = "<div class='fo-ch-stats'>" +
        stat("terra", FO_I("trophy", 19), "League position", pos, "/ " + (rowsL.length || 10)) +
        stat("teal", FO_I("chart", 19), "Points", me.pts || 0, (me.w || 0) + "W · " + (me.l || 0) + "L") +
        stat("terra", FO_I("wallet", 19), "Bank", foMoney(bank), "Available funds") +
        stat("teal", FO_I("coins", 19), "Weekly wages", foMoney(wages), "Total wage bill") +
        stat("terra", FO_I("users", 19), "Supporters", "<span class='fo-stat-word'>" + mood + "</span>", "Mood") + "</div>";

      // Recent results
      var recent = (App.results || []).slice(-4).reverse();
      var recentBody = recent.length
        ? "<table class='fo-tbl'><thead><tr><th>Date</th><th>Match</th><th class='r'>Result</th></tr></thead><tbody>" +
          recent.map(function (r) { return "<tr class='fo-rowlink' data-sc='" + r.ix + "'><td>" + E(r.date || "") + "</td><td>" + E(r.home) + " v " + E(r.away) + "</td><td class='r'>" + E(r.result ? r.result.text : "") + "</td></tr>"; }).join("") + "</tbody></table>"
        : "<div class='fo-empty'><div class='fo-empty-ic'>" + FO_I("calendar", 20) + "</div><div><b>No matches played yet</b><div class='small'>First ball coming up soon.</div></div></div>";

      // Upcoming fixtures (+ friendlies), with a Set-lineup action
      var frRows = (foFriendlies || []).map(function (fr, i) {
        return "<tr class='fo-fx-fr'><td>Now</td><td>Friendly</td><td>vs " + E(fr.oppName) + "</td><td>" + foPitchPill(fr.pitch) + "</td><td class='r'><button class='fo-fr-play' data-i='" + i + "'>Play</button><button class='fo-fr-x' data-i='" + i + "' title='Remove'>&#10005;</button></td></tr>";
      }).join("");
      var ups = foUserFixtures().slice(0, 5).map(function (x) {
        return "<tr><td>" + x.date + "<div class='fo-t'>9:00 AM ET</div></td><td>R" + (x.round + 1) + "</td><td>" + (x.isHome ? "vs " : "@ ") + E(x.opp.name) + "</td><td>" + E(x.ground) + " " + foPitchPill(x.pitch) + "</td><td class='r'><button class='fo-setr' data-r='" + x.round + "'>Set lineup</button></td></tr>";
      }).join("");
      var upBody = (frRows || ups)
        ? "<table class='fo-tbl'><thead><tr><th>Date</th><th>Rd</th><th>Match</th><th>Ground</th><th class='r'></th></tr></thead><tbody>" + frRows + ups + "</tbody></table>"
        : "<div class='fo-empty'><div class='fo-empty-ic'>" + FO_I("bat", 20) + "</div><div><b>Season complete</b></div></div>";

      // Leaders
      var ld = foTeamLeaders(t);
      var leaders = "<div class='fo-ch-leaders'>" +
        "<div class='fo-card fo-lead'><div class='fo-lead-ic'>" + FO_I("bat", 19) + "</div><div><div class='fo-card-h2'>Leading run-scorer</div><div class='fo-lead-v'>" + (ld.bat.runs || 0) + " <span>runs</span></div><div class='small'>" + (ld.bat.name ? E(ld.bat.name) : "—") + "</div></div></div>" +
        "<div class='fo-card fo-lead'><div class='fo-lead-ic'>" + FO_I("target", 19) + "</div><div><div class='fo-card-h2'>Leading wicket-taker</div><div class='fo-lead-v'>" + (ld.bowl.wkts || 0) + " <span>wkts</span></div><div class='small'>" + (ld.bowl.name ? E(ld.bowl.name) : "—") + "</div></div></div></div>";

      // Standings (form pips + row highlight rendered here; kept out of tidyPage)
      var fmap = foFormMap();
      var standRows = rowsL.map(function (x, i) {
        var meRow = x.nm === t.name;
        return "<tr class='" + (meRow ? "fo-userrow" : "") + "'><td class='fo-rk'>" + (i === 0 ? "<span style='color:#D9A441;display:inline-flex;vertical-align:-2px'>" + FO_I("trophy", 14) + "</span>" : (i + 1)) + "</td><td class='fo-scoutname'>" + E(x.nm) + "</td><td class='r'>" + x.p + "</td><td class='r'>" + x.w + "</td><td class='r'>" + x.l + "</td><td class='r'>" + (x.nrr >= 0 ? "+" : "") + x.nrr.toFixed(2) + "</td><td class='r'><b>" + x.pts + "</b></td></tr>";
      }).join("");
      var standings = "<div class='fo-card'><div class='fo-card-h'>League standings</div><div class='fo-card-b'><table class='fo-tbl fo-chtable'><thead><tr><th class='fo-rk'>#</th><th>Club</th><th class='r'>P</th><th class='r'>W</th><th class='r'>L</th><th class='r'>NRR</th><th class='r'>Pts</th></tr></thead><tbody>" + standRows + "</tbody></table></div></div>";

      // Finances
      // net per matchday: sponsor + expected gate share − wages − stadium − academy
      var AC = [0, 4000, 8000, 14000, 22000, 32000];
      var sponsorBase = (t.sponsorDeal && t.sponsorDeal.base) || (App.fin && App.fin.sponsorBase) || 25000;
      var gateEst = Math.round(Math.min(t.seats || 9000, (t.supporters || 2400) * (0.55 + 0.13 * (t.mood == null ? 3 : t.mood))) * FO_FIN.ticketPrice * 0.5);
      var netMD = sponsorBase + gateEst - wages - (t.seats || 9000) - (AC[t.acadY || 0] || 0) - (AC[t.acadS || 0] || 0);
      var runway = netMD < 0 ? Math.floor(bank / -netMD) : null;
      var health = foHealth(bank);
      var fin = "<div class='fo-card'><div class='fo-card-h'>Finances</div><div class='fo-card-b'><table class='fo-kv'>" +
        "<tr><td>Bank</td><td class='r'>" + foMoney(bank) + " · <b class='" + (health === "Danger" || health === "Crisis" ? "fo-neg" : "fo-teal") + "'>" + health + "</b></td></tr>" +
        "<tr><td>Wages / matchday</td><td class='r'>" + foMoney(wages) + "</td></tr>" +
        "<tr><td>Sponsor / matchday</td><td class='r'>" + foMoney(sponsorBase) + "</td></tr>" +
        "<tr><td>Ground</td><td class='r'>" + E(t.ground || "-") + " · " + (t.seats || 9000).toLocaleString() + " seats</td></tr>" +
        "<tr><td>Stadium condition</td><td class='r fo-teal'>" + cond + "</td></tr></table>" +
        "<div class='fo-fin-net'><span>Typical matchday net</span><b class='" + (netMD >= 0 ? "fo-pos" : "fo-neg") + "'>" + (netMD >= 0 ? "+" : "&minus;") + foMoney(Math.abs(netMD)) + "</b></div>" +
        (runway != null && runway <= 6 ? "<div class='fo-fin-net'><span>Runway at this burn</span><b class='fo-neg'>~" + runway + " matchdays</b></div>" : "") +
        "</div></div>";

      var formPill = pips ? "<span class='fo-hero-pill'>Form <span class='fo-form'>" + pips + "</span></span>" : "<span class='fo-hero-pill'>No matches yet</span>";
      var hero = "<div class='fo-ch-hero'><div class='fo-ch-hero-l'>" +
        "<div class='fo-ch-crest'><img src='" + APPICON + "' alt=''></div><div>" +
        "<div class='fo-ch-eyebrow'>Club home</div><h1 class='fo-ch-name'>" + E(t.name) + "</h1>" +
        "<div class='fo-ch-chips'><span class='fo-ch-chip'>Season " + (App.seasonNo || 1) + "</span><span class='fo-ch-chip'>Round " + (Math.min((S ? S.round : 0) + 1, (S && S.schedule ? S.schedule.length : 9))) + "</span><span class='fo-ch-chip'>" + dateStr + "</span></div>" +
        "</div></div><div class='fo-ch-hero-r'>" + formPill + "</div></div>";

      // ---- season momentum strip: progress bar + streak + goal-gradient nudge ----
      var totalRounds = (S && S.schedule) ? S.schedule.length : 18;
      var played = me.p || 0;
      var strip = "<div class='fo-season-strip'>" +
        "<div class='fo-progress'><div class='fo-progress-l'><span>Season " + (App.seasonNo || 1) + " progress</span><b>Matchday " + Math.min(played + 1, totalRounds) + " of " + totalRounds + "</b></div>" +
        "<div class='fo-progress-bar'><u style='width:" + Math.round(100 * played / Math.max(1, totalRounds)) + "%'></u></div></div>";
      // current unbeaten/win streak from the form pips (most recent last)
      var streak = 0;
      for (var si = form.length - 1; si >= 0 && String(form[si]).toUpperCase() === "W"; si--) streak++;
      if (streak >= 2) strip += "<span class='fo-mchip fo-mchip-hot'><i>" + FO_I("trophy", 15) + "</i>" + streak + "-match win streak</span>";
      // goal gradient: how close is the next rung of the table?
      if (pi > 0 && played > 0) {
        var above = rowsL[pi - 1], gap = (above.pts || 0) - (me.pts || 0);
        strip += "<span class='fo-mchip fo-mchip-goal'><i>" + FO_I("target", 15) + "</i>" +
          (gap <= 0 ? "Level on points with " + E(above.nm) : gap + " pt" + (gap === 1 ? "" : "s") + " from " + foOrdinal(pi) + " place") + "</span>";
      } else if (pi === 0 && played > 0) {
        var below = rowsL[1], lead = (me.pts || 0) - ((below && below.pts) || 0);
        strip += "<span class='fo-mchip fo-mchip-goal'><i>" + FO_I("trophy", 15) + "</i>Top of the table" + (lead > 0 ? " — " + lead + " pt" + (lead === 1 ? "" : "s") + " clear" : "") + "</span>";
      }
      // check-in streak: reward showing up, every day
      var stk = foStreak();
      if (stk >= 2) strip += "<span class='fo-mchip'>&#128293; " + stk + "-day check-in streak</span>";
      // goal gradient in money: what one more place is worth
      if (pi > 0 && (me.p || 0) > 0) {
        var prizeUp = (FO_FIN.prizes[pi - 1] || 0) - (FO_FIN.prizes[pi] || 0);
        if (prizeUp > 0) strip += "<span class='fo-mchip fo-mchip-goal'><i>" + FO_I("coins", 15) + "</i>One place up is worth +" + foMoney(prizeUp) + " at season&rsquo;s end</span>";
      }
      strip += "</div>";

      // ---- next match: anticipation panel with countdown + lineup-state CTA ----
      var nxt = foUserFixtures()[0] || null;
      var isMP = SYNC && SYNC.started && !SYNC.practice;
      var ordersIn = !!(App.orders && App.orders.saved && nxt && App.season && nxt.round === App.season.round);
      var nextPanel = "";
      if (nxt) {
        var oppRow = rowsL.findIndex(function (x) { return x.nm === nxt.opp.name; });
        var oppForm = (foFormMap()[nxt.opp.name] || []).map(function (x) { return "<i class='fo-pip fo-" + x + "'></i>"; }).join("");
        var cd = isMP
          ? "<div class='fo-cd'><div class='fo-cd-v' id='fo-cd'>" + foCdText(foNextMatchdayMs()) + "</div><div class='fo-cd-l'>Until match time · " + MATCH_TIME + "</div></div>"
          : "";
        nextPanel = "<div class='fo-next'><div class='fo-next-l'>" +
          "<div class='fo-next-eyebrow'>Next match · Round " + (nxt.round + 1) + "</div>" +
          "<div class='fo-next-opp'>" + (nxt.isHome ? "vs " : "at ") + E(nxt.opp.name) + "</div>" +
          "<div class='fo-next-sub'>" + E(nxt.ground) + " · " + foPitchName(nxt.pitch) + " pitch" +
          (oppRow >= 0 ? " · they are " + foOrdinal(oppRow + 1) : "") +
          (oppForm ? " · form <span class='fo-form'>" + oppForm + "</span>" : "") + "</div>" +
          "</div><div class='fo-next-r'>" + cd +
          "<button class='fo-next-cta" + (ordersIn ? " fo-done" : "") + "' data-r='" + nxt.round + "'>" +
          (ordersIn ? "&#10003; Orders in — review lineup" : "Set your lineup") + "</button></div></div>";
      } else if ((me.p || 0) > 0) {
        nextPanel = "<div class='fo-next'><div class='fo-next-l'><div class='fo-next-eyebrow'>Season complete</div>" +
          "<div class='fo-next-opp'>You finished " + foOrdinal(pos === "-" ? 10 : pos) + "</div>" +
          "<div class='fo-next-sub'>Prize money: " + foMoney((FO_FIN.prizes[(pos === "-" ? 10 : pos) - 1]) || 0) + "</div></div></div>";
      }

      // ---- today's to-do: unfinished business pulls you back tomorrow ----
      var todo = [];
      if (nxt && !ordersIn) todo.push("<a data-go='orders' data-r='" + nxt.round + "'>&#9998; Set your lineup for round " + (nxt.round + 1) + "</a>");
      var rep0 = t._trainReport || null;
      if (rep0 && ((rep0.gains || []).length || (rep0.signings || []).length)) todo.push("<a data-go='training'>&#9650; Training report: " + (rep0.gains || []).length + " gain" + ((rep0.gains || []).length === 1 ? "" : "s") + (rep0.signings && rep0.signings.length ? " · " + rep0.signings.length + " signing" + (rep0.signings.length === 1 ? "" : "s") : "") + "</a>");
      try {
        var stT = foTrainState(), rNow = (App.season && App.season.round) || 0;
        if (rNow - (stT.lastSignRound == null ? -99 : stT.lastSignRound) >= FO_SCOUT_COOLDOWN && (t.players || []).length < 18) todo.push("<a data-go='training'>&#9733; Your scout has 3 new prospects</a>");
      } catch (e) {}
      if ((t.players || []).length < 18) todo.push("<a data-go='transfers'>&#8644; Browse the transfer market</a>");
      var todoStrip = "";

      // ---- latest training gains: visible progress feeds the habit loop ----
      var gainsCard = "";
      if (rep0 && ((rep0.gains || []).length || (rep0.recovery || []).length || (rep0.signings || []).length)) {
        var gl = (rep0.gains || []).slice(0, 8).map(function (g) { return "<li><span class='fo-gain-up'>&#9650;</span> " + E(g) + "</li>"; }).join("");
        var more = (rep0.gains || []).length > 8 ? "<li class='small'>+" + ((rep0.gains || []).length - 8) + " more on the Training page</li>" : "";
        var sg = (rep0.signings || []).map(function (g) { return "<li>&#9733; " + E(g) + "</li>"; }).join("");
        gainsCard = "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Latest training gains</div><a class='fo-morelink' href='#/training'>Training centre ›</a></div><div class='fo-card-b'><ul class='fo-gains' style='margin:0;padding-left:6px;list-style:none;font-size:13px'>" + sg + gl + more + "</ul></div></div>";
      }
      var newsCard = "";
      try { newsCard = foNewsDigest(); } catch (e) {}
      setTimeout(foChallengesCard, 30);   // async card injected under the news
      var html = "<div class='fo-ch'>" +
        "<div class='fo-ch-crumb'>" + E(t.name) + " <span>›</span> Club</div>" + hero + nextPanel + todoStrip + strip + stats +
        "<div class='fo-ch-grid'><div class='fo-ch-col'>" + newsCard +
        "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Recent results</div><a href='#/matches' class='fo-morelink'>View all results ›</a></div><div class='fo-card-b'>" + recentBody + "</div></div>" +
        "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Upcoming fixtures</div><a href='#/matches' class='fo-morelink'>View full schedule ›</a></div><div class='fo-card-b'>" + upBody + "</div></div>" +
        leaders + gainsCard +
        "</div><div class='fo-ch-col'>" + standings + fin + "</div></div></div>";

      var page = document.getElementById("page"); if (!page) return;
      page.innerHTML = html;
      // wire interactions
      page.querySelectorAll(".fo-rowlink[data-sc]").forEach(function (tr) { tr.addEventListener("click", function () { location.hash = "#/scorecard?i=" + tr.getAttribute("data-sc"); }); });
      page.querySelectorAll(".fo-setr").forEach(function (b) { b.addEventListener("click", function () { foSetOrdersForRound(+b.getAttribute("data-r")); }); });
      page.querySelectorAll(".fo-fr-play").forEach(function (b) { b.addEventListener("click", function () { var fr = foFriendlies[+b.getAttribute("data-i")]; if (fr) foPlayFriendly(fr); }); });
      page.querySelectorAll(".fo-fr-x").forEach(function (b) { b.addEventListener("click", function () { foRemoveFriendly(+b.getAttribute("data-i")); }); });
      page.querySelectorAll(".fo-scoutname").forEach(function (c) { c.addEventListener("click", function () { scoutClub(c.textContent || ""); }); });
      // social proof: predictions already in for this round (async, quiet fail)
      try {
        if (SYNC && SYNC.started && !SYNC.practice && LG && nxt) {
          sel("league_predictions", "league_id=eq." + LG.id + "&round=eq." + nxt.round + "&select=manager_id").then(function (rows) {
            var n = (rows || []).length; if (!n) return;
            var el = page.querySelector(".fo-next-l"); if (!el || el.querySelector(".fo-social")) return;
            var d = document.createElement("div"); d.className = "fo-social";
            d.innerHTML = "<b>" + n + " manager" + (n === 1 ? " has" : "s have") + "</b> already called this round in predictions.";
            el.appendChild(d);
          }).catch(function () {});
        }
      } catch (e) {}
      var cta = page.querySelector(".fo-next-cta[data-r]");
      if (cta) cta.addEventListener("click", function () { foSetOrdersForRound(+cta.getAttribute("data-r")); });
      page.querySelectorAll(".fo-todo a[data-go]").forEach(function (a) {
        a.addEventListener("click", function () {
          var go = a.getAttribute("data-go");
          if (go === "orders") foSetOrdersForRound(+a.getAttribute("data-r"));
          else { location.hash = "#/" + go; if (typeof window.route === "function") window.route(); }
        });
      });
      // live countdown; the interval kills itself when the element leaves the page
      if (foCdTimer) { clearInterval(foCdTimer); foCdTimer = null; }
      var cdEl = page.querySelector("#fo-cd");
      if (cdEl) foCdTimer = setInterval(function () {
        var el = document.getElementById("fo-cd");
        if (!el) { clearInterval(foCdTimer); foCdTimer = null; return; }
        el.textContent = foCdText(foNextMatchdayMs());
      }, 1000);
    } catch (e) { console.warn("foPremiumClub", e); if (foOrigClub) try { foOrigClub(); } catch (e2) {} }
  }
  // Show the real match time (league rounds resolve at 09:00 New York) next to the
  // date in any fixtures/results table. Safe: only tables that have a "Date" header.
  // Open a rival club's page (in the game, not a dark modal): a hero banner with
  // position + form, recent results, upcoming fixtures, and a sortable Players tab
  // — with a Challenge button. Reached by clicking a club name in any table.
  var foScoutIx = null, foScoutTab = "overview", foScoutSort = "rating";
  function scoutClub(cellText) {
    var idx = -1;
    if (typeof GD !== "undefined" && GD.teams) { for (var i = 0; i < GD.teams.length; i++) { if (GD.teams[i] && cellText.indexOf(GD.teams[i].name) >= 0) { idx = i; break; } } }
    if (idx < 0) return;
    foScoutIx = idx; foScoutTab = "overview"; foScoutSort = "rating";
    location.hash = "#/scout?t=" + idx;
  }
  function foScoutOverview(t, ix) {
    var res = (App.results || []).filter(function (r) { return r.home === t.name || r.away === t.name; }).slice(-6).reverse();
    var resRows = res.map(function (r) {
      return "<tr class='rowlink' data-sc='" + r.ix + "'><td>" + E(r.date || "") + "</td><td>" + E(r.home) + " v " + E(r.away) + "</td><td>" + E(r.result ? r.result.text : "") + "</td></tr>";
    }).join("") || "<tr><td colspan='3' class='small'>No matches played yet.</td></tr>";
    var ups = [], S = App.season;
    if (S && S.schedule) for (var r = S.round; r < S.schedule.length && ups.length < 8; r++) {
      var rd = S.schedule[r] || [];
      for (var i = 0; i < rd.length; i++) {
        var f = rd[i]; if (f[0] !== ix && f[1] !== ix) continue; if (S.played[fixtureKey(r, f)] !== undefined) continue;
        var home = GD.teams[f[0]], opp = GD.teams[f[0] === ix ? f[1] : f[0]], d = new Date(2026, 6, 4); d.setDate(d.getDate() + 7 * r);
        ups.push("<tr><td>" + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + "</td><td>R" + (r + 1) + "</td><td>" + (f[0] === ix ? "vs " : "@ ") + E(opp.name) + "</td><td class='small'>" + E(home.ground) + " (" + groundPitch(home.ground) + ")</td></tr>");
      }
    }
    var upRows = ups.join("") || "<tr><td colspan='4' class='small'>Season complete.</td></tr>";
    return "<div class='panel'><h4>Recent results</h4><div class='pad'><table><tr><th>Date</th><th>Match</th><th>Result</th></tr>" + resRows + "</table></div></div>" +
      "<div class='panel'><h4>Upcoming fixtures</h4><div class='pad'><table><tr><th>Date</th><th>Rd</th><th>Opponent</th><th>Ground</th></tr>" + upRows + "</table></div></div>";
  }
  function foScoutPlayers(t) {
    var players = (t.players || []).slice();
    if (foScoutSort === "age") players.sort(function (a, b) { return (a.age || 0) - (b.age || 0) || (b.rating || 0) - (a.rating || 0); });
    else players.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    var rows = players.map(function (p, i) {
      var hand = p.hand === "L" ? "LHB" : "RHB";
      var bowl = p.btLabel && p.btLabel !== "Does not bowl" ? p.btLabel : "—";
      var role = typeof prole === "function" ? prole(p.role) : (p.role || "");
      var link = "<a href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + "</a>";
      return "<tr><td class='n'>" + (i + 1) + "</td><td>" + link + " <span class='small'>" + E(p.nat || "") + "</span></td><td class='n'>" + (p.age || "?") + "</td><td class='small'>" + E(role) + "</td><td class='small'>" + hand + "</td><td class='small'>" + E(bowl) + "</td><td class='n'>" + (p.rating || 0).toLocaleString() + "</td></tr>";
    }).join("");
    var sortBar = "<div class='fo-sortbar small'>Sort by: " +
      "<a class='fo-sortby" + (foScoutSort === "rating" ? " on" : "") + "' data-s='rating'>Rating</a> · " +
      "<a class='fo-sortby" + (foScoutSort === "age" ? " on" : "") + "' data-s='age'>Age</a></div>";
    return "<div class='panel'><h4>Players</h4><div class='pad'>" + sortBar + "<div style='overflow-x:auto'><table><tr><th>#</th><th>Player</th><th>Age</th><th>Role</th><th>Bat</th><th>Bowl</th><th>Rating</th></tr>" + rows + "</table></div></div></div>";
  }
  function foScoutHTML(ix) {
    var t = GD.teams[ix], players = (t.players || []);
    var avg = players.length ? Math.round(players.reduce(function (s, p) { return s + (p.rating || 0); }, 0) / players.length) : 0;
    var rows = typeof leagueRows === "function" ? leagueRows() : [];
    var pi = rows.findIndex(function (x) { return x.nm === t.name; }), pos = pi >= 0 ? pi + 1 : null, rec = rows[pi] || null;
    var form = foFormMap()[t.name] || [];
    var pips = form.map(function (x) { return "<i class='fo-pip fo-" + x + "' title='" + x + "'></i>"; }).join("") || "<span class='small'>no matches yet</span>";
    var kpi = "<div class='fo-scout-kpis'>" +
      "<div class='fo-kpi'><span>Position</span><b>" + (pos || "-") + "</b></div>" +
      "<div class='fo-kpi'><span>W–L–T</span><b>" + (rec ? rec.w + "–" + rec.l + "–" + rec.t : "0–0–0") + "</b></div>" +
      "<div class='fo-kpi'><span>Avg rating</span><b>" + avg.toLocaleString() + "</b></div>" +
      "<div class='fo-kpi'><span>Squad</span><b>" + players.length + "</b></div></div>";
    var isMe = ix === App.teamIx;
    var hero = "<div class='fo-scout-hero'><div class='fo-scout-hero-main'>" +
      "<div class='fo-scout-eyebrow'>" + (isMe ? "Your club" : "Scout report") + "</div>" +
      "<h1 class='fo-scout-name'>" + E(t.name) + "</h1>" +
      "<div class='fo-scout-meta'>" + E(t.ground || "-") + " · Form <span class='fo-form'>" + pips + "</span></div>" +
      "<div class='fo-scout-actions'>" + (isMe ? "" : "<button class='fo-challenge'>Challenge to a match</button>") + "<button class='fo-scout-back'>← Back</button></div>" +
      "</div>" + kpi + "</div>";
    var links = "<div class='fo-scout-links'>" +
      "<a class='fo-stab" + (foScoutTab === "overview" ? " on" : "") + "' data-tab='overview'>Overview</a>" +
      "<a class='fo-stab" + (foScoutTab === "players" ? " on" : "") + "' data-tab='players'>Players</a></div>";
    var body = foScoutTab === "players" ? foScoutPlayers(t) : foScoutOverview(t, ix);
    return "<div class='crumb'><span>" + E(t.name) + "</span></div><div class='fo-scout'>" + hero +
      "<div class='fo-scout-shell'>" + links + "<div class='fo-scout-body'>" + body + "</div></div></div>";
  }
  // Human-vs-human challenge: pick pitch, weather and a time; the opponent
  // must accept before the resolver plays it. Bots fall back to practice.
  function foChallengeSmart(ix) {
    if (!(SYNC && SYNC.started && !SYNC.practice && LG)) { foChallenge(ix); return; }
    sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id").then(function (rows) {
      var opp = GD.teams[ix];
      var human = (rows || []).some(function (r) { return r.club && r.club.name === opp.name && r.manager_id !== SYNC.myMid; });
      if (!human) { foMatchSetup(ix); return; }   // bots: full setup (opponent preset, pick pitch + weather)
      var ex = document.getElementById("fo-chal"); if (ex) ex.remove();
      var pitches = FO_PITCHES.map(function (p) { return "<option value='" + p + "'>" + foPitchName(p) + "</option>"; }).join("");
      var wx = (typeof WXLIST !== "undefined" ? WXLIST : ["Sunny"]).map(function (w) { return "<option>" + w + "</option>"; }).join("");
      var dflt = new Date(Date.now() + 3 * 3600e3); dflt.setMinutes(0, 0, 0);
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      var dv = dflt.getFullYear() + "-" + pad(dflt.getMonth() + 1) + "-" + pad(dflt.getDate()) + "T" + pad(dflt.getHours()) + ":00";
      var m = document.createElement("div"); m.id = "fo-chal"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Challenge</div><h3>Challenge " + E(opp.name) + "</h3>" +
        "<div class='small' style='margin:4px 0 10px'>They must accept before the match is played. Both sides can attach a lineup up to match time; the game is played at your chosen time and does not affect the league.</div>" +
        "<div class='ctlrow'><span>Pitch</span><select id='fo-chal-p'>" + pitches + "</select></div>" +
        "<div class='ctlrow'><span>Weather</span><select id='fo-chal-w'>" + wx + "</select></div>" +
        "<div class='ctlrow'><span>Play at</span><input id='fo-chal-t' type='datetime-local' value='" + dv + "'></div>" +
        "<div style='display:flex;gap:8px;margin-top:12px'><button class='fo-yc-sign' id='fo-chal-go'>Send challenge</button><button class='mini' id='fo-chal-x'>Cancel</button></div></div>";
      document.body.appendChild(m);
      m.querySelector("#fo-chal-x").addEventListener("click", function () { m.remove(); });
      m.querySelector("#fo-chal-go").addEventListener("click", function () {
        var t = new Date(m.querySelector("#fo-chal-t").value);
        if (!(t > new Date())) { say("Pick a time in the future."); return; }
        rpc("challenge_create", {
          p_league_id: LG.id, p_club: userTeam().name, p_opponent: opp.name,
          p_pitch: m.querySelector("#fo-chal-p").value || "balanced",
          p_weather: m.querySelector("#fo-chal-w").value || "Sunny", p_play_at: t.toISOString()
        }).then(function () { m.remove(); toast("Challenge sent to " + opp.name + ". You'll see their answer on your club page."); })
          .catch(function (e) {
            var s = ((e && e.message) || e) + "";
            if (/Could not find the function/i.test(s)) say("Challenges need the 0017 SQL run in Supabase (ask your commissioner).");
            else say(e);
          });
      });
    }).catch(function () { foMatchSetup(ix); });
  }
  function foChallenge(ix, pitch, weather) {
    try {
      try { M = null; } catch (_) {}                       // drop any stale match
      App.tossState = null;
      var me = userTeam();
      App.pending = { oppIx: ix, home: me.name, away: GD.teams[ix].name, ground: me.ground, pitch: pitch || me.homePitch || groundPitch(me.ground), weather: weather || "Sunny", seed: 4200 + ix, date: typeof simDate === "function" ? simDate() : "", comp: "friendly", __friendly: true };
      App.orders.saved = false;                             // must set + save a lineup before it plays
      say("vs " + GD.teams[ix].name + " — set your lineup, then Save to play.");
      location.hash = "#/orders"; if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }
  function foWireScout(page, ix) {
    page.querySelectorAll(".fo-stab").forEach(function (a) { a.addEventListener("click", function () { foScoutTab = a.getAttribute("data-tab"); page.__scoutSig = null; foRenderScout(); }); });
    page.querySelectorAll(".fo-sortby").forEach(function (a) { a.addEventListener("click", function () { foScoutSort = a.getAttribute("data-s"); page.__scoutSig = null; foRenderScout(); }); });
    var back = page.querySelector(".fo-scout-back"); if (back) back.addEventListener("click", function () { location.hash = "#/matches"; });
    var ch = page.querySelector(".fo-challenge"); if (ch) ch.addEventListener("click", function () { foChallengeSmart(ix); });
    page.querySelectorAll("tr.rowlink[data-sc]").forEach(function (tr) { tr.style.cursor = "pointer"; tr.addEventListener("click", function () { location.hash = "#/scorecard?i=" + tr.getAttribute("data-sc"); }); });
  }
  function foRenderScout() {
    try {
      if (location.hash.indexOf("#/scout") !== 0) return;
      var m = /[?&]t=(\d+)/.exec(location.hash), ix = m ? +m[1] : foScoutIx;
      if (ix == null || typeof GD === "undefined" || !GD.teams || !GD.teams[ix]) return;
      foScoutIx = ix;
      var page = document.getElementById("page"); if (!page) return;
      var sig = "scout|" + ix + "|" + foScoutTab + "|" + foScoutSort;
      if (page.__scoutSig === sig && page.querySelector(".fo-scout")) return;   // unchanged
      page.__scoutSig = sig;
      page.innerHTML = foScoutHTML(ix);
      foWireScout(page, ix);
    } catch (e) {}
  }
  // Recent league form per club (oldest→newest, last 5): W / L / T.
  function foFormMap() {
    var m = {};
    try {
      (App.results || []).forEach(function (r) {
        if (!r || r.comp !== "league" || !r.result) return;
        var w = r.result.winner;
        [r.home, r.away].forEach(function (nm) { (m[nm] = m[nm] || []).push(!w ? "T" : (w === nm ? "W" : "L")); });
      });
      for (var k in m) m[k] = m[k].slice(-5);
    } catch (e) {}
    return m;
  }
  // Trim the game page per preferences: hide Office academies, and make the
  // league-table club names clickable to open that club's scout report.
  // Mobile: any table wider than the screen scrolls in place instead of
  // being clipped. Idempotent — skips tables already wrapped.
  function foMobileTables() {
    try {
      var docW = document.documentElement.clientWidth;
      if (docW > 760) return;
      document.querySelectorAll("#page table").forEach(function (tb) {
        if (tb.closest(".fo-scrollx")) return;
        var r = tb.getBoundingClientRect();
        if (r.width <= docW - 8 && tb.scrollWidth <= tb.clientWidth + 4) return;
        var wrap = document.createElement("div");
        wrap.className = "fo-scrollx";
        tb.parentNode.insertBefore(wrap, tb);
        wrap.appendChild(tb);
      });
    } catch (e) {}
  }
  // Touch devices have no hover: tapping anything with a title tooltip
  // (skill labels, talent chips) shows it as a toast instead.
  document.addEventListener("click", function (ev) {
    try {
      if (!window.matchMedia || !matchMedia("(hover: none)").matches) return;
      var el = ev.target.closest("[title]");
      if (!el || !el.title) return;
      var tag = el.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "SELECT" || tag === "INPUT" || tag === "OPTION") return;
      toast(el.title.slice(0, 300));
    } catch (e) {}
  }, true);
  setInterval(function () { try { foFriendlyKeeper(); } catch (e) {} }, 5000);
  var _foMobT;
  window.addEventListener("resize", function () { clearTimeout(_foMobT); _foMobT = setTimeout(foMobileTables, 150); });
  window.addEventListener("hashchange", function () { setTimeout(foMobileTables, 60); });

  function tidyPage() {
    try {
      var isFounder = !!(SYNC && SYNC.isFounder);
      document.querySelectorAll("#page .panel, #page .card").forEach(function (pn) {
        var h = pn.querySelector("h4, .card-title"); if (!h) return;
        var t = h.textContent.trim().toLowerCase();
        var hide = t === "academies" || t.indexOf("academy") >= 0 || t.indexOf("training centre") >= 0 || t.indexOf("training center") >= 0 ||
          t.indexOf("founder league") >= 0 || t.indexOf("commissioner") >= 0 ||   // no longer needed in Office
          (t.indexOf("danger zone") >= 0 && !isFounder);                          // reset game is admin-only
        if (hide) pn.style.display = "none";
      });
      // remove the manual "Complete AI round" / "Sim whole round" sim controls
      document.querySelectorAll("#page button").forEach(function (b) {
        var bt = (b.textContent || "").trim();
        if (bt === "Complete AI round" || bt === "Sim whole round") b.style.display = "none";
      });
      document.querySelectorAll("#page .small").forEach(function (el) {
        if (/^Complete AI round only plays/.test((el.textContent || "").trim())) el.style.display = "none";
      });
      // League mode: "Prepare" only sets orders (matches auto-resolve), so relabel it.
      if (SYNC && SYNC.started) {
        document.querySelectorAll("#page button").forEach(function (b) {
          if (/startLeagueMatch/.test(b.getAttribute("onclick") || "")) b.textContent = "Set lineup";
        });
      }
      // the engine's placeholder competition name becomes the real league's name
      var lgName = (LG && LG.name) ? LG.name : "League";
      document.querySelectorAll("#page h4, #page td").forEach(function (el) {
        if ((el.textContent || "").indexOf("Chat Division 1") >= 0) {
          el.innerHTML = el.innerHTML.replace(/League table - Chat Division 1/g, "League table &middot; " + E(lgName))
                                     .replace(/One Day - Chat Division 1/g, "One Day &middot; " + E(lgName))
                                     .replace(/Chat Division 1/g, E(lgName));
        }
      });
      var fmap = foFormMap(), myName = "";
      try { if (typeof userTeam === "function") myName = userTeam().name; } catch (e) {}
      document.querySelectorAll("#page table").forEach(function (tb) {
        var clubIx = -1, ptsIx = -1;
        tb.querySelectorAll("th").forEach(function (th) { var t = th.textContent.trim().toLowerCase(); if (t === "club") clubIx = th.cellIndex; if (t === "pts") ptsIx = th.cellIndex; });
        if (clubIx < 0 || ptsIx < 0) return;                    // only the standings table
        if (tb.closest && tb.closest(".fo-ch")) return;         // premium Club renders its own standings
        tb.classList.add("fo-standings");
        var di = 0;
        tb.querySelectorAll("tr").forEach(function (tr) {
          if (tr.querySelector("th")) return;
          var cell = tr.children[clubIx]; if (!cell) return;
          var name = (cell.textContent || "").trim();
          if (!cell.dataset.foScout) {
            cell.dataset.foScout = "1"; cell.classList.add("fo-scoutname");
            cell.addEventListener("click", function () { scoutClub(cell.textContent || ""); });
          }
          if (di === 0) tr.classList.add("fo-lead");            // league leader
          if (myName && name.indexOf(myName) >= 0) tr.classList.add("fo-userrow");
          di++;
        });
      });
    } catch (e) {}
  }
  var MATCH_TIME = "9:00 AM ET";
  function decorateFixtureTimes() {
    try {
      // the engine dates rounds weekly (solo roots); this league is daily —
      // rewrite every printed round date anchored to TODAY's current round
      var curR = (typeof App !== "undefined" && App.season) ? App.season.round : 0;
      var dailyDate = function (roundIx) {
        var d = new Date(); d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + (roundIx - curR));
        return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      };
      document.querySelectorAll("#page td[colspan]").forEach(function (td) {
        var m = (td.textContent || "").match(/Round\s+(\d+)\s+·/);
        if (m) td.innerHTML = td.innerHTML.replace(/·\s*[^(<]*\d{4}/, "· " + dailyDate(+m[1] - 1) + " ");
      });
      document.querySelectorAll("#page h4").forEach(function (h) {
        var m = (h.textContent || "").match(/Round\s+(\d+)\s+of\s+\d+/);
        if (m) h.innerHTML = h.innerHTML.replace(/-\s*[^<]*\d{4}/, "- " + dailyDate(+m[1] - 1));
      });
      document.querySelectorAll("#page table").forEach(function (tb) {
        var dateIx = -1, ths = tb.querySelectorAll("th");
        ths.forEach(function (th) { if (dateIx < 0 && /^\s*date\s*$/i.test(th.textContent)) dateIx = th.cellIndex; });
        if (dateIx < 0) return;
        tb.querySelectorAll("tr").forEach(function (tr) {
          if (tr.querySelector("th")) return;                 // skip header rows
          var cell = tr.children[dateIx]; if (!cell) return;
          if (cell.querySelector(".fo-mtime")) return;        // already decorated
          var txt = (cell.textContent || "").trim();
          if (!txt || /\d:\d/.test(txt)) return;              // needs a date, no time yet
          var s = document.createElement("div"); s.className = "fo-mtime"; s.textContent = MATCH_TIME;
          cell.appendChild(s);
        });
      });
    } catch (e) {}
  }
  // Orders page: a "Copy previous match orders" button so a manager can reuse the
  // batting order, captain, keeper and bowling plan from their last set lineup.
  function foPreviousOrders() {
    try {
      if (App.defaults && App.defaults.batOrder && App.defaults.batOrder.length) return App.defaults;
      if (SYNC && SYNC.plannedOrders) {
        var rounds = Object.keys(SYNC.plannedOrders).map(Number).sort(function (a, b) { return b - a; });
        for (var i = 0; i < rounds.length; i++) { var o = SYNC.plannedOrders[rounds[i]]; if (o && o.batOrder && o.batOrder.length) return o; }
      }
    } catch (e) {}
    return null;
  }
  function foApplyPrevOrders(prev) {
    try {
      App.orders.batOrder = (prev.batOrder || []).slice();
      App.orders.captain = prev.captain; App.orders.keeper = prev.keeper;
      if (prev.spells) App.orders.spells = JSON.parse(JSON.stringify(prev.spells));
      App.orders.grid = null; App.orders.saved = false;    // reseed the grid from the copied spells
      if (typeof pgOrders === "function") pgOrders();
    } catch (e) { say(e); }
  }
  // One number a manager can act on: how suited each player is to TODAY's
  // pitch and weather (form and fatigue included). Replaces raw stat-reading.
  function foTodayFit(p) {
    var pend = App.pending || {}, pitch = pend.pitch || "balanced", wx = String(pend.weather || "").toLowerCase();
    var k; try { k = (typeof S === "function") ? S(p) : (p.skills || {}); } catch (e) { k = p.skills || {}; }
    var bowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var v;
    if (bowler) {
      v = 0.55 * (p.threat || 0) + 0.45 * (p.control || 0);
      var pace = foIsPace(p);
      if (pace && (pitch === "green" || pitch === "cracked" || /overcast|humid|misty/.test(wx))) v += 10;
      if (!pace && (pitch === "dry" || pitch === "slow")) v += 10;
      if (!pace && /dew/.test(wx)) v -= 6;
    } else {
      var spinW = (pitch === "dry" || pitch === "slow") ? 0.42 : 0.28;
      v = (0.70 - spinW) * (k.vsPace || 0) + spinW * (k.vsSpin || 0) + 0.15 * (k.temperament || 0) + 0.15 * (k.power || 0);
      if ((pitch === "green" || /overcast|humid/.test(wx)) && (k.vsPace || 0) > 60) v += 5;
    }
    v *= 0.90 + 0.033 * (p.formIx == null ? 3 : p.formIx);
    var fr = { "clinically dead": 0.70, shattered: 0.74, exhausted: 0.78, listless: 0.84, weary: 0.90, moderate: 0.95, satisfactory: 0.98 }[String(p.fatigue || "rested").toLowerCase()];
    if (fr) v *= fr;
    return Math.max(1, Math.min(99, Math.round(v)));
  }
  function foPoolToday() {
    try {
      if (location.hash.indexOf("#/orders") !== 0) return;
      var pool = null;
      document.querySelectorAll("#page .panel").forEach(function (pn) {
        var h = pn.querySelector("h4");
        if (h && /available players/i.test(h.textContent || "")) pool = pn.querySelector("table");
      });
      if (!pool) pool = document.querySelector("#page .pool-mini table");
      if (!pool) return;
      var t = userTeam(); if (!t) return;
      var head = pool.querySelector("tr");
      if (head && !head.querySelector(".fo-today-th")) {
        var th = document.createElement("th"); th.className = "n fo-today-th"; th.textContent = "Today";
        th.title = "Fit for this pitch, weather, form and freshness"; head.appendChild(th);
      }
      var rows = [].slice.call(pool.querySelectorAll("tr")).filter(function (r) { return !r.querySelector("th"); });
      rows.forEach(function (r) {
        var nm = (r.cells[0] && r.cells[0].textContent || "").trim();
        var p = (t.players || []).find(function (x) { return nm.indexOf(x.name) >= 0; });
        var v = p ? foTodayFit(p) : 0;
        var cell = r.querySelector(".fo-today-td");
        if (!cell) { cell = document.createElement("td"); cell.className = "n fo-today-td"; r.appendChild(cell); }
        cell.innerHTML = "<span class='fo-fit fo-fit-" + foSkTone(v) + "'>" + v + "</span>";
        r.dataset.foFit = v;
        var tired = p && /exhausted|shattered|clinically|listless/.test(String(p.fatigue || "").toLowerCase());
        r.style.opacity = tired ? ".55" : "";
      });
      rows.sort(function (a, b) { return (+b.dataset.foFit || 0) - (+a.dataset.foFit || 0); })
        .forEach(function (r) { r.parentNode.appendChild(r); });
      // tabs re-render the rows: decorate again after a click
      document.querySelectorAll("#page .player-pool-tabs button").forEach(function (b) {
        if (b.dataset.foT) return; b.dataset.foT = "1";
        b.addEventListener("click", function () { setTimeout(foPoolToday, 60); });
      });
    } catch (e) {}
  }
  // Nets are for YOUR players: both sides come from your own squad.
  function foNetsOwnTeam() {
    try {
      if (!/^#\/nets/.test(location.hash || "")) return;
      if (typeof netsState === "undefined" || typeof App === "undefined") return;
      if (netsState.batClub !== App.teamIx || netsState.bowlClub !== App.teamIx) {
        netsState.batClub = App.teamIx; netsState.bowlClub = App.teamIx;
        if (typeof pgNets === "function") { pgNets(); return; }
      }
      // hide the club pickers only (the player select in the same row moves
      // into the skill cards below)
      document.querySelectorAll("#page select").forEach(function (s) {
        var oc = s.getAttribute("onchange") || "";
        if (/netsState\.(bat|bowl)Club/.test(oc)) s.style.display = "none";
      });
      foNetsCards();
    } catch (e) {}
  }
  // ---- Nets: the whole skill card of both players in the session ------------
  // The engine's nets page only names the matchup; managers want to SEE who
  // they put in the nets. Both pickers slide into a full player card - flag,
  // role, age, hand, bowling type, talents and the complete 7-skill read-out -
  // and the wall of condition selects becomes one labelled grid.
  function foNetsCss() {
    if (document.getElementById("fo-nets-css")) return;
    var st = document.createElement("style"); st.id = "fo-nets-css";
    st.textContent =
      "#fo-nets-cards{display:grid;grid-template-columns:1fr 34px 1fr;gap:12px;align-items:stretch;margin:6px 0 16px}" +
      ".fo-net-card{background:#fff;border:1px solid rgba(11,19,34,.11);border-radius:14px;padding:13px 15px;box-shadow:0 1px 3px rgba(11,19,34,.05)}" +
      ".fo-net-bat{border-top:3px solid #2b6b68}.fo-net-bowl{border-top:3px solid #C8674A}" +
      ".fo-net-role{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:9px;color:#8a8474}" +
      ".fo-net-bat .fo-net-role{color:#2b6b68}.fo-net-bowl .fo-net-role{color:#a4552e}" +
      ".fo-net-slot select{width:100%;max-width:100%;padding:9px 11px;border:1px solid rgba(11,19,34,.16);border-radius:10px;background:#fcfaf5;font-weight:700;font-size:13.5px;margin-bottom:10px}" +
      ".fo-net-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".fo-net-flag{font-size:16px;line-height:1}" +
      ".fo-net-nm{font-weight:800;font-size:16.5px;color:#12203a;text-decoration:none}" +
      ".fo-net-nm:hover{color:#2b6b68;text-decoration:underline}" +
      ".fo-net-meta{font-size:11.5px;color:#7a7566;margin:4px 0 8px}" +
      ".fo-net-tals{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 9px}" +
      ".fo-net-card .fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none;gap:4px}" +
      ".fo-net-card .fo-db{font-size:10.5px}" +
      ".fo-net-v{align-self:center;justify-self:center;width:30px;height:30px;border-radius:50%;background:#efece2;color:#8a8474;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}" +
      "#page.fo-nets .fo-net-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px 12px;align-items:end}" +
      ".fo-nc{display:flex;flex-direction:column;gap:4px;min-width:0}" +
      ".fo-nc label{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a9484}" +
      ".fo-nc select,.fo-nc input{width:100%;padding:8px 10px;border:1px solid rgba(11,19,34,.15);border-radius:9px;background:#fff;font-size:12.5px;box-sizing:border-box}" +
      "#page.fo-nets .fo-net-ctl button.primary{grid-column:1/-1;padding:12px 16px;border-radius:11px;font-weight:800;font-size:14px}" +
      "@media(max-width:760px){#fo-nets-cards{grid-template-columns:1fr}.fo-net-v{margin:-4px auto}}";
    document.head.appendChild(st);
  }
  function foNetsCardHtml(p, kind) {
    var role = kind === "bat" ? "Batter" : "Bowler";
    var head = "<div class='fo-net-role'>In the nets · " + role + "</div><div class='fo-net-slot' data-kind='" + kind + "'></div>";
    if (!p) return "<div class='fo-net-card fo-net-" + kind + "'>" + head + "<div class='small'>Pick a player.</div></div>";
    var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? (foFlag(p.nat) || "") : ""; } catch (e) {}
    var isB = p.bowlTypeFull ? p.bowlTypeFull !== "none" : !!p.bowlType;
    var bt = p.btLabel || (isB ? String(p.bowlTypeFull || p.bowlType) : "Does not bowl");
    var hand = (p.hand === "L" ? "Left-hand bat" : "Right-hand bat");
    var ttip = function (t) { try { return (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; } catch (e) { return ""; } };
    var tals = (p.talents || []).map(function (t) { return "<span class='fo-dc-tal' title='" + E(ttip(t)) + "'>" + E(foTalentName(t)) + "</span>"; }).join("");
    return "<div class='fo-net-card fo-net-" + kind + "'>" + head +
      "<div class='fo-net-head'>" + (flag ? "<span class='fo-net-flag'>" + flag + "</span>" : "") +
      "<a class='fo-net-nm' href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + (p.keeper ? " &dagger;" : "") + "</a>" +
      "<span class='fo-rl'>" + foRoleShort(p) + "</span></div>" +
      "<div class='fo-net-meta'>Age " + (p.age || "?") + " · " + hand + " · " + E(bt) + ((p.expWord || p.exp) ? " · exp " + E(String(p.expWord || p.exp)) : "") + "</div>" +
      (tals ? "<div class='fo-net-tals'>" + tals + "</div>" : "") +
      foSkillBars(p) + "</div>";
  }
  function foNetsCards() {
    try {
      if (!/^#\/nets/.test(location.hash || "")) return;
      if (typeof netsState === "undefined" || typeof findPlayer !== "function") return;
      var page = document.getElementById("page"); if (!page) return;
      var firstPanel = page.querySelector(".panel"); if (!firstPanel) return;
      page.classList.add("fo-nets");
      foNetsCss();
      var batP = null, bowlP = null;
      try { batP = (findPlayer(netsState.bat || "") || {}).p || null; } catch (e) {}
      try { bowlP = (findPlayer(netsState.bowl || "") || {}).p || null; } catch (e) {}
      var key = (netsState.bat || "") + "|" + (netsState.bowl || "");
      var ex = document.getElementById("fo-nets-cards");
      if (ex && ex.getAttribute("data-key") === key) return;
      if (ex) ex.remove();
      var wrap = document.createElement("div");
      wrap.id = "fo-nets-cards"; wrap.setAttribute("data-key", key);
      wrap.innerHTML = foNetsCardHtml(batP, "bat") + "<div class='fo-net-v'>v</div>" + foNetsCardHtml(bowlP, "bowl");
      page.insertBefore(wrap, firstPanel);
      // the engine's own player pickers slide into the cards, alive and wired
      page.querySelectorAll(".ctlrow select").forEach(function (s) {
        var oc = s.getAttribute("onchange") || "";
        var kind = /netsState\.bat=this\.value/.test(oc) ? "bat" : (/netsState\.bowl=this\.value/.test(oc) ? "bowl" : null);
        if (!kind) return;
        var row = s.closest(".ctlrow");
        var slot = wrap.querySelector(".fo-net-slot[data-kind='" + kind + "']");
        if (slot) slot.appendChild(s);
        if (row) row.style.display = "none";
      });
      // the conditions row: label every control, show renamed pitches
      page.querySelectorAll(".ctlrow").forEach(function (r) {
        if (r.getAttribute("data-fo-ctl") || r.textContent.indexOf("Balls:") < 0) return;
        r.setAttribute("data-fo-ctl", "1"); r.classList.add("fo-net-ctl");
        var kids = Array.prototype.slice.call(r.children);
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i];
          if (el.tagName !== "SPAN") continue;
          var ctrl = kids[i + 1];
          if (!ctrl || (ctrl.tagName !== "SELECT" && ctrl.tagName !== "INPUT")) continue;
          var box = document.createElement("div"); box.className = "fo-nc";
          r.insertBefore(box, el);
          var lab = document.createElement("label"); lab.textContent = el.textContent.replace(/:\s*$/, "");
          box.appendChild(lab); box.appendChild(ctrl); el.remove();
        }
        // the engine's decorateConditions has already title-cased the option
        // text (and with no value attr, the value: "Dry", "Two-Paced") - map
        // back to the real ids, then show our pitch names
        var pit = r.querySelector("select[onchange*='netsState.pitch']");
        if (pit) {
          var PMAP = { balanced: "balanced", flat: "flat", green: "green", dry: "dry", slow: "slow", cracked: "cracked", twopaced: "twoPaced" };
          var pNorm = function (v) { return PMAP[String(v == null ? "" : v).replace(/[^a-z]/gi, "").toLowerCase()] || null; };
          Array.prototype.forEach.call(pit.options, function (o) {
            var id = pNorm(o.value || o.textContent); if (!id) return;
            o.value = id; o.textContent = foPitchName(id);
          });
          var curId = pNorm(netsState.pitch);
          if (curId) { netsState.pitch = curId; pit.value = curId; }
        }
        var btn = r.querySelector("button.primary");
        if (btn) { btn.textContent = "Bowl the session"; r.appendChild(btn); }
      });
    } catch (e) {}
  }
  // ---- live friendlies run on the WALL CLOCK -------------------------------
  // A friendly plays at 10s a delivery whether the app is open or not. We
  // persist {seed, orders, toss, startAt}; on return we replay silently to
  // where the clock says the match should be. Come back after ~100 minutes
  // and it has finished: the result is in your friendly history.
  function foFrKey() { return "fol_livefr_" + (LG ? LG.id : "solo"); }
  function foFrHistKey() { return "fol_frhist_" + (LG ? LG.id : "solo"); }
  var FO_BALL_MS = 10000;
  function foFrHist() { try { return JSON.parse(lsGet(foFrHistKey()) || "[]"); } catch (e) { return []; } }
  function foSaveFrHist(m) {
    try {
      var i1 = m.innings[0], i2 = m.innings[1];
      var h = foFrHist();
      h.unshift({
        at: Date.now(), opp: (m.meta && m.meta.away) || "", ground: (m.meta && m.meta.ground) || "",
        txt: (m.result && m.result.text) || "", mom: (m.result && m.result.mom) || "",
        s1: i1 ? i1.batTeam + " " + i1.runs + "/" + i1.wkts : "", s2: i2 ? i2.batTeam + " " + i2.runs + "/" + i2.wkts : ""
      });
      lsSet(foFrHistKey(), JSON.stringify(h.slice(0, 20)));
    } catch (e) {}
  }
  function foFriendlyKeeper() {
    try {
      var live = (typeof M !== "undefined") && M && !M.done && M.meta && M.meta.__friendly;
      if (live) {
        var now = Date.now();
        var raw0 = lsGet(foFrKey()), st0 = null; try { st0 = JSON.parse(raw0 || "null"); } catch (e) {}
        var startAt = (st0 && st0.startAt) || (now - (M.log || []).length * FO_BALL_MS);
        if (!foFriendlyKeeper._t || now - foFriendlyKeeper._t > 4000) {
          foFriendlyKeeper._t = now;
          var tossCall = (App.tossState && App.tossState.call) || App.orders.tossCall || "H";
          var userBatFirst = M.batFirstTeam === (M.user && M.user.name);
          lsSet(foFrKey(), JSON.stringify({
            pending: M.meta, orders: App.orders, startAt: startAt,
            toss: { call: tossCall, decision: App.orders.tossDecision || (userBatFirst ? "bat" : "bowl") }
          }));
        }
        return;
      }
      if (typeof M !== "undefined" && M && M.done && M.meta && M.meta.__friendly) {
        if (!M.__foArchived) { M.__foArchived = 1; foSaveFrHist(M); }
        lsSet(foFrKey(), "");
        return;
      }
      // nothing live: if a friendly is stored, move it to where the clock says
      if (SYNC && !SYNC.__frSynced) {
        var raw = lsGet(foFrKey()); if (!raw) return;
        var st = null; try { st = JSON.parse(raw); } catch (e) {}
        if (!st || !st.pending || !st.orders || !st.startAt) { return; }
        SYNC.__frSynced = 1;
        if (typeof GD === "undefined" || !GD.teams || !GD.teams.length) return;
        var target = Math.floor((Date.now() - st.startAt) / FO_BALL_MS);
        try {
          App.orders = st.orders; App.orders.saved = true;
          App.orders.tossCall = (st.toss && st.toss.call) || "H";
          App.orders.tossDecision = (st.toss && st.toss.decision) || "bat";
          App.pending = st.pending;
          var prevPage = App.page; App.page = "__resolve__";
          try { M = null; } catch (e) {}
          if (typeof startPendingIfNeeded === "function") startPendingIfNeeded();
          if (App.tossState && App.tossState.stage !== "done" && typeof resolveToss === "function") resolveToss(App.orders.tossCall || "H");
          var guard = 0;
          while (M && !M.done && (M.log || []).length < target && guard++ < 800) {
            if (typeof stepBall === "function") stepBall(); else break;
          }
          App.page = prevPage;
          if (M && M.done) {
            M.__foArchived = 1; foSaveFrHist(M); lsSet(foFrKey(), "");
            toast("Full time in your friendly: " + ((M.result && M.result.text) || "match complete") + " — scorecard in Live Match.");
            location.hash = "#/match"; if (typeof window.route === "function") window.route();
          } else if (M) {
            toast("Your friendly has moved on with the clock — over " + Math.floor(((M.innings[1] ? 300 : 0) + (M.innings[M.innings[1] ? 1 : 0] || {}).legal || 0) / 6) + " now. Rejoining live.");
            location.hash = "#/match"; if (typeof window.route === "function") window.route();
          }
        } catch (e) { lsSet(foFrKey(), ""); }
      }
    } catch (e) {}
  }
  function foOrdersExtras() {
    try {
      if (location.hash.indexOf("#/orders") !== 0) { if (window.__foOrdT) { clearInterval(window.__foOrdT); window.__foOrdT = null; } return; }
      var page = document.getElementById("page"); if (!page || page.querySelector(".fo-orders-bar")) return;
      var prev = foPreviousOrders();
      var bar = document.createElement("div"); bar.className = "fo-orders-bar";
      bar.innerHTML =
        "<div class='fo-coach-row'>" +
        "<button class='fo-autopick'>&#9889; Auto-pick everything</button>" +
        "<button class='fo-copyprev'" + (prev ? "" : " disabled title='No previous lineup saved yet'") + ">&#10697; Copy previous</button>" +
        "<span class='fo-coach-hint'>Fill it in one tap, then adjust anything below.</span></div>" +
        "<div class='fo-ready' id='fo-ready'></div>";
      var anchor = page.querySelector(".crumb");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling); else page.insertBefore(bar, page.firstChild);
      var btn = bar.querySelector(".fo-copyprev");
      if (btn && prev) btn.addEventListener("click", function () { foApplyPrevOrders(prev); });
      bar.querySelector(".fo-autopick").addEventListener("click", function () {
        try {
          if (typeof suggestOrders === "function") suggestOrders();
          if (typeof window.pgOrders === "function") window.pgOrders();
          toast("XI, captain, keeper and bowling plan filled. Adjust anything, then save.");
          setTimeout(foOrdersExtras, 60);   // page repainted: re-attach the bar
          setTimeout(foPoolToday, 120);
        } catch (e) { say(e); }
      });
      // live readiness: the page tells you what is still missing
      var paint = function () {
        var el = document.getElementById("fo-ready"); if (!el) return;
        var o = (typeof App !== "undefined" && App.orders) || {};
        var chip = function (ok, lbl) { return "<span class='fo-rdy" + (ok ? " ok" : "") + "'>" + (ok ? "&#10003; " : "&#9675; ") + lbl + "</span>"; };
        var xi = (o.batOrder || []).filter(Boolean).length;
        var overs = 0; try { overs = (o.compiled || []).filter(Boolean).length; } catch (e) {}
        el.innerHTML =
          chip(xi >= 11, "Batting order (" + Math.min(xi, 11) + "/11)") +
          chip(!!o.captain, "Captain") +
          chip(!!o.keeper, "Keeper") +
          chip(overs >= 50, "Bowling plan (" + Math.min(overs, 50) + "/50 overs)") +
          chip(!!o.saved, o.saved ? "Saved" : "Not saved yet");
      };
      paint();
      foPoolToday();
      if (window.__foOrdT) clearInterval(window.__foOrdT);
      window.__foOrdT = setInterval(function () {
        if (location.hash.indexOf("#/orders") !== 0 || !document.getElementById("fo-ready")) { clearInterval(window.__foOrdT); window.__foOrdT = null; return; }
        paint();
      }, 900);
    } catch (e) {}
  }
  // Tag #page while a live match is on screen, so the mobile reorder CSS applies
  // only there (and never touches the desktop layout).
  // Opponent player pages: a rival's players are scoutable, but their skill bars
  // and skills-summary are hidden — only your own players reveal their skills.
  function foHidePlayerSkills() {
    try {
      if (foHashPath() !== "#/player") return;
      var page = document.getElementById("page"); if (!page) return;
      var m = /[?&]n=([^&]+)/.exec(location.hash); if (!m) return;
      var name = decodeURIComponent(m[1]);
      var mine = false;
      try { var me = userTeam(); mine = (me.players || []).concat(me.youth || []).some(function (p) { return p.name === name; }); } catch (e) {}
      if (mine) return;                                     // own player — show everything
      page.querySelectorAll(".panel").forEach(function (pn) {
        var h = pn.querySelector("h4"); if (!h) return;
        var t = h.textContent.trim().toLowerCase();
        if (t === "skills" || t === "skills summary") pn.style.display = "none";
      });
    } catch (e) {}
  }
  function foHashPath() { return (location.hash || "").split("?")[0]; }   // "#/match" not "#/matches"
  function foTagMatchPage() {
    try {
      var pg = document.getElementById("page"); if (!pg) return;
      var on = foHashPath() === "#/match" && !!document.querySelector(".mc-top");
      pg.classList.toggle("fo-matchpage", on);
      if (on) {
        // every match plays at the same broadcast pace: one over a minute
        // (10s a ball, ~50 min an innings), and the speed control goes away
        try {
          if (UI.apMs !== 10000) {
            UI.apMs = 10000;
            if (window.__ap) { clearInterval(window.__ap); window.__ap = null; if (typeof window.foEnsureAutoplay === "function") window.foEnsureAutoplay(); }
          }
          document.querySelectorAll("#page select[title='commentary speed']").forEach(function (s) {
            var row = s.previousElementSibling;
            if (row && /commentary speed/i.test(row.textContent || "")) row.style.display = "none";
            s.style.display = "none";
          });
        } catch (e) {}
      }
    } catch (e) {}
  }
  // ---- Season planner: pre-set orders for every upcoming fixture ---------------
  // League packets are keyed by round, so a manager can set orders for any future
  // round now (or submit their current orders for the whole season at once). The
  // resolver picks up each round's packet when that round plays.
  function foUserFixtures() {
    var out = [];
    try {
      var S = App.season; if (!S || !S.schedule) return out;
      for (var r = S.round; r < S.schedule.length; r++) {
        var rd = S.schedule[r] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== App.teamIx && f[1] !== App.teamIx) continue;
          if (S.played[fixtureKey(r, f)] !== undefined) continue;
          out.push(foFixtureInfo(r, f));
        }
      }
    } catch (e) {}
    return out;
  }
  function foFixtureInfo(r, f) {
    var home = GD.teams[f[0]], away = GD.teams[f[1]], oppIx = f[0] === App.teamIx ? f[1] : f[0];
    var isHome = f[0] === App.teamIx;
    var pitch = home.name === userTeam().name ? (home.homePitch || groundPitch(home.ground)) : groundPitch(home.ground);
    var weather = WXLIST[(((r * 7 + f[0] * 3) % WXLIST.length) + WXLIST.length) % WXLIST.length];
    var d = new Date(2026, 6, 4); d.setDate(d.getDate() + 7 * r);
    return { round: r, f: f, oppIx: oppIx, opp: GD.teams[oppIx], home: home, away: away, ground: home.ground, pitch: pitch, weather: weather, isHome: isHome, seed: 5000 + r * 10 + f[0], date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) };
  }
  function foFixtureMeta(r) {
    var S = App.season, rd = (S && S.schedule[r]) || [];
    for (var i = 0; i < rd.length; i++) { var f = rd[i]; if (f[0] === App.teamIx || f[1] === App.teamIx) { var x = foFixtureInfo(r, f); return { oppIx: x.oppIx, home: x.home.name, away: x.away.name, ground: x.ground, pitch: x.pitch, weather: x.weather, seed: x.seed, date: x.date, comp: "league", round: r }; } }
    return null;
  }
  function foPushRound(r, orders) {
    if (!(LG && SYNC)) return;
    var clone = JSON.parse(JSON.stringify(orders)); clone.saved = true;
    var sig = JSON.stringify(clone);
    SYNC.pushedSig = SYNC.pushedSig || {};
    if (SYNC.pushedSig[r] === sig) return;                 // already submitted, unchanged
    SYNC.pushedSig[r] = sig;
    SYNC.submitted = SYNC.submitted || {}; SYNC.submitted[r] = true;
    SYNC.plannedOrders = SYNC.plannedOrders || {}; SYNC.plannedOrders[r] = clone;
    var pkt = { fo_packet: 1, teamIx: App.teamIx, club: (GD.teams[App.teamIx] || {}).name, round: r, manager: (SYNC.me && SYNC.me.display_name) || "manager", orders: clone };
    rpc("push_packet", { p_league_id: LG.id, p_round: r, p_packet: pkt }).catch(function () {});
  }
  function foFlushPlan() {
    try {
      if (!(LG && SYNC && SYNC.started && App.orders && App.orders.saved)) return;
      if (SYNC.planRound == null) return;
      foPushRound(SYNC.planRound, App.orders);
      // Don't let the current-round auto-push (pollOnce) resubmit these future-round
      // orders for the current round — mark the signature as already handled.
      try { SYNC.lastOrderSig = JSON.stringify(App.orders) + "|" + (App.season ? App.season.round : 0); } catch (e) {}
      foRenderPlanner();
    } catch (e) {}
  }
  function foSetOrdersForRound(r) {
    try {
      SYNC.planRound = (App.season && r === App.season.round) ? null : r;
      var meta = foFixtureMeta(r); if (meta) App.pending = meta;
      if (SYNC.plannedOrders && SYNC.plannedOrders[r]) App.orders = JSON.parse(JSON.stringify(SYNC.plannedOrders[r]));
      else App.orders.saved = false;                        // start from the current template
      location.hash = "#/orders"; if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }
  function foLoadSubmitted() {
    if (!(LG && SYNC) || SYNC.submittedLoading) return;
    SYNC.submittedLoading = true;
    sel("league_packets", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=round").then(function (a) {
      SYNC.submitted = SYNC.submitted || {};
      (a || []).forEach(function (row) { SYNC.submitted[row.round] = true; });
      SYNC.submittedLoaded = true; SYNC.__plannerSig = null; foRenderPlanner();
    }).catch(function () { SYNC.submittedLoaded = true; });
  }
  // A lean per-fixture "Set lineup" list (no big season planner): each upcoming
  // fixture gets a button on the right that opens that round's orders.
  function foPlannerHTML(fx, limit) {
    var shown = limit ? fx.slice(0, limit) : fx;
    var frRows = (foFriendlies || []).map(function (fr, i) {
      return "<div class='fo-fx fo-fx-fr'>" +
        "<div class='fo-fx-main'><b>Friendly</b> vs " + E(fr.oppName) +
          "<div class='small fo-fx-sub'>" + E(foTitle(fr.pitch)) + " pitch · " + E(fr.weather) + " · practice</div></div>" +
        "<div class='fo-fx-act'><button class='fo-fr-play' data-i='" + i + "'>Play</button>" +
          "<button class='fo-fr-x' data-i='" + i + "' title='Remove'>✕</button></div>" +
        "</div>";
    }).join("");
    var rows = shown.map(function (x) {
      var done = SYNC.submitted && SYNC.submitted[x.round];
      return "<div class='fo-fx'>" +
        "<div class='fo-fx-main'><b>R" + (x.round + 1) + "</b> " + (x.isHome ? "vs " : "@ ") + E(x.opp.name) +
          "<div class='small fo-fx-sub'>" + x.date + " · 9:00 AM ET · " + E(x.ground) + " · " + E(x.pitch) + "/" + E(x.weather) + "</div></div>" +
        "<div class='fo-fx-act'>" + (done ? "<span class='fo-plan-ok'>✓ lineup set</span>" : "") +
          "<button class='fo-setr' data-r='" + x.round + "'>" + (done ? "Edit lineup" : "Set lineup") + "</button></div>" +
        "</div>";
    }).join("");
    var more = (limit && fx.length > limit) ? "<div class='small' style='margin-top:6px'><a href='#/matches'>See all " + fx.length + " fixtures →</a></div>" : "";
    return "<div class='panel fo-planner'><h4>Your upcoming matches</h4><div class='pad'>" +
      "<div class='small' style='margin-bottom:6px'>League matches play automatically at <b>9:00 AM ET</b>. Set a lineup ahead of time (blank ones auto-select), or play a friendly any time.</div>" +
      frRows + rows + more + "</div></div>";
  }
  function foWirePlanner(root) {
    root.querySelectorAll(".fo-setr").forEach(function (b) { if (b.__w) return; b.__w = 1; b.addEventListener("click", function () { foSetOrdersForRound(+b.getAttribute("data-r")); }); });
    root.querySelectorAll(".fo-fr-play").forEach(function (b) { if (b.__w) return; b.__w = 1; b.addEventListener("click", function () { var fr = foFriendlies[+b.getAttribute("data-i")]; if (fr) foPlayFriendly(fr); }); });
    root.querySelectorAll(".fo-fr-x").forEach(function (b) { if (b.__w) return; b.__w = 1; b.addEventListener("click", function () { foFriendlies.splice(+b.getAttribute("data-i"), 1); if (SYNC) SYNC.__plannerSig = null; foRenderPlanner(); }); });
  }
  function foRenderPlanner() {
    try {
      return;                                              // retired: the fixtures table now carries Set lineup buttons
      if (!(SYNC && SYNC.started) || SYNC.practice) return;
      if (App.page !== "matches") return;                  // the Club home renders its own fixtures
      var page = document.getElementById("page"); if (!page) return;
      if (!SYNC.submittedLoaded) foLoadSubmitted();
      var fx = foUserFixtures(), frs = foFriendlies || [];
      var existing = page.querySelector(".fo-planner");
      if (!fx.length && !frs.length) { if (existing) existing.remove(); return; }
      var limit = App.page === "club" ? 5 : 0;              // compact on the club home; full on Matches
      var sig = App.page + "|fr" + frs.map(function (f) { return f.oppName; }).join(",") + "|" + fx.map(function (x) { return x.round + (SYNC.submitted && SYNC.submitted[x.round] ? "y" : "n"); }).join(",");
      if (existing && SYNC.__plannerSig === sig) return;    // unchanged — leave the DOM alone (avoids observer loop)
      SYNC.__plannerSig = sig;
      var html = foPlannerHTML(fx, limit);
      if (existing) { existing.outerHTML = html; }
      else {
        var d = document.createElement("div"); d.innerHTML = html; var node = d.firstChild;
        // Insert high up (right after the hero/heading) so it's immediately visible,
        // not buried at the bottom of the page.
        var anchor = page.querySelector(".welcome-hero, .page-head");
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
        else if (page.firstChild) page.insertBefore(node, page.firstChild.nextSibling);
        else page.appendChild(node);
      }
      foWirePlanner(page);
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
  // The game's ↩ "return to match" icon appears for any pending fixture, which lets
  // a match start with a default lineup. Show it ONLY while a match is truly live.
  setInterval(function () {
    try {
      var box = document.getElementById("fo-live-icons"); if (!box) return;
      var live = (typeof M !== "undefined" && M && !M.done);
      box.style.display = live ? "" : "none";
    } catch (e) {}
  }, 300);
  // re-apply fixture match-times after any re-render of the game page
  try {
    var _mt = null, pg0 = document.getElementById("page");
    if (pg0 && window.MutationObserver) new MutationObserver(function () { clearTimeout(_mt); _mt = setTimeout(function () { foRenderScout(); decorateFixtureTimes(); tidyPage(); foMobileTables(); foOfficeExtras(); foFixWIFlags(); foNetsOwnTeam(); foFriendlyKeeper(); foTagMatchPage(); foRenderPlanner(); foOrdersExtras(); foHidePlayerSkills(); }, 40); }).observe(pg0, { childList: true, subtree: true });
  } catch (e) {}
  if (typeof window.route === "function") { var _rt = window.route; window.route = function () { var r = _rt.apply(this, arguments); bumpBrand(); ensureNav(); foRenderTraining(); foRenderMarket(); foRenderManual(); foRenderMatchday(); foPolishSquad(); foDecorateMatchRows(); foRenderScout(); decorateFixtureTimes(); tidyPage(); foTagMatchPage(); foRenderPlanner(); foOrdersExtras(); foHidePlayerSkills(); return r; }; }
  window.addEventListener("hashchange", function () { setTimeout(foRenderScout, 0); });
  window.addEventListener("hashchange", bumpBrand);
  ensureNav();

  // League fixtures resolve in the background at 09:00 New York — the manager only
  // sets orders (which auto-upload as a packet). So the interactive match viewer is
  // never used for a league game: clicking Matches (or saving orders) must land on
  // the fixtures list, not the live viewer. #/match stays reachable for Practice
  // Games and replays (those set no `league` comp / create a live match M).
  function foLeaguePendingOnly() {
    try {
      var liveFriendly = (typeof M !== "undefined" && M && !M.done);
      // Practice mode is a private local season — its matches ARE played by hand.
      return SYNC && SYNC.started && !SYNC.practice && App && App.pending && App.pending.comp === "league" && !liveFriendly;
    } catch (e) { return false; }
  }
  // Never spin up the interactive match engine for a real league fixture — those
  // are resolved by the background resolver. (Practice matches play normally.)
  if (typeof window.startPendingIfNeeded === "function") {
    var _spin = window.startPendingIfNeeded;
    window.startPendingIfNeeded = function () {
      try { if (SYNC && SYNC.started && !SYNC.practice && App && App.pending && App.pending.comp === "league" && !(typeof M !== "undefined" && M && !M.done)) return; } catch (e) {}
      return _spin.apply(this, arguments);
    };
  }
  function foOnHash() {
    try {
      // League games have no live viewer: bounce #/match back to the fixtures list.
      if (foHashPath() === "#/match" && foLeaguePendingOnly()) {
        if (App.orders && App.orders.saved) say("Orders saved — your match resolves at 9:00 AM ET.");
        location.hash = "#/matches"; return;
      }
      // Leaving the Orders page while planning a future round → submit that round.
      if (location.hash.indexOf("#/orders") !== 0 && SYNC && SYNC.planRound != null) {
        foFlushPlan(); SYNC.planRound = null;
      }
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foOnHash, 0); });

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
  btn.id = "folBtn"; btn.textContent = "League"; btn.style.display = "none";
  function openLeagueMenu() { openWrap(true); if (!JWT) renderLogin(); else if (SYNC && LG) showWait(!!SYNC.myTeam); else enterApp(); }
  function doLogout() { JWT = ""; LG = null; SYNC = null; clearSession(); openWrap(true); renderLogin(); }

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
      login: doLogin, logout: doLogout,
      showLogin: renderLogin, showJoin: renderJoin, showForgot: renderForgot,
      sendReset: sendReset, joinNew: doJoinSignup,
      openId: function () { enterGameById(t.getAttribute("data-id")); }, join: joinLeague,
      startLeague: startLeague, mkInvite: mkInvite,
      delTeam: function () { delTeam(t.getAttribute("data-id"), t.getAttribute("data-name")); },
      draftMine: draftMine, practice: practice,
      reload: function () { location.reload(); },
      backToGame: function () { openWrap(false); if (typeof window.route === "function") window.route(); }
    };
    if (acts[a]) acts[a]();
  });
  // Enter in any panel input triggers that screen's primary action.
  wrap.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || !ev.target || ev.target.tagName !== "INPUT") return;
    var primary = ["login", "joinNew", "sendReset", "join"].map(function (a) { return wrap.querySelector('[data-act="' + a + '"]'); }).filter(Boolean)[0];
    if (primary && !primary.disabled) { ev.preventDefault(); primary.click(); }
  });
  function val(id) { var e = wrap.querySelector("#" + id); return e ? (e.value || "").trim() : ""; }

  function setNavy(on) { var pn = wrap.querySelector("#folPanel"); if (pn) pn.classList.toggle("fol-navy", !!on); }

  // Never leave the panel blank: show progress while we talk to the server, and a
  // recoverable error card (instead of silence) when something goes wrong.
  function foLoading(msg) {
    setNavy(false);
    main.innerHTML = '<div class="folbody"><div class="folcard"><div class="folpad" style="text-align:center;padding:28px 12px"><div class="folsmall">' + E(msg || "Loading…") + "</div></div></div></div>";
  }
  function foFatal(msg) {
    openWrap(true); setNavy(false);
    main.innerHTML = '<div class="folbody"><div class="folcard"><h4>Something went wrong</h4><div class="folpad">' +
      '<div class="folsmall" style="line-height:1.5;margin-bottom:10px">' + E(msg) + "</div>" +
      '<button class="mini" data-act="reload">&#8635; Reload</button> <button class="mini" data-act="logout">log out</button>' +
      "</div></div></div>";
  }

  // ---- auth (Fifty Overs brand login) ----
  // The "50" mark: three terracotta stumps, a paper "5", and a seamed cricket ball for the "0".
  var LOGO = '<img class="fol-logo" src="' + APPICON + '" alt="Fifty Overs">';
  // The primary "50" mark, redrawn as inline SVG for the dark background:
  // terracotta stumps, paper "5", seamed-ball "0" (the brand PNGs are navy-on-paper
  // and megabytes big — vector keeps the single-file build small and crisp).
  var FOL_MARK =
    '<svg class="fol-mark" viewBox="0 0 224 170" fill="none" aria-hidden="true">' +
    '<g fill="#C8674A"><rect x="88" y="6" width="9" height="30" rx="2.5"/><rect x="86" y="2" width="13" height="6" rx="2"/>' +
    '<rect x="107" y="6" width="9" height="30" rx="2.5"/><rect x="105" y="2" width="13" height="6" rx="2"/>' +
    '<rect x="126" y="6" width="9" height="30" rx="2.5"/><rect x="124" y="2" width="13" height="6" rx="2"/></g>' +
    '<path d="M104 50 H62 v34 h21 a27 27 0 1 1 -22 45" stroke="#F6F4EE" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="156" cy="113" r="45" stroke="#F6F4EE" stroke-width="11"/>' +
    '<path d="M149 76 c-7 24 -7 50 2 74" stroke="#F6F4EE" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="8 8" opacity=".9"/>' +
    '<path d="M164 76 c7 24 7 50 -2 74" stroke="#F6F4EE" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="8 8" opacity=".9"/>' +
    "</svg>";
  var ICON_JOIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>';
  var FOOT =
    '<div class="fol-foot"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>' +
    "Secure access. Your club, your data.</div>";
  // Split auth shell: brand lockup on the left, the card on the right; on mobile
  // the brand pane collapses and the compact monogram tops the card instead.
  function folAuthShell(card) {
    return '<div class="fol-auth">' +
      '<div class="fol-brand">' + FOL_MARK +
      '<div class="fol-word">FIFTY <i>OVERS</i></div>' +
      '<div class="fol-tag"><b>&middot;</b>Private cricket leagues.<b>&middot;</b></div>' +
      '<div class="fol-feats">Draft squads<b>&middot;</b>Set orders<b>&middot;</b>Watch every ball.</div>' +
      '<img class="fol-minilogo" src="' + APPICON + '" alt="">' +
      "</div>" +
      '<div class="fol-side"><div class="fol-card">' + LOGO + card + "</div></div></div>";
  }

  function renderLogin() {
    wrap.querySelector("#folWho").textContent = "";
    setNavy(true);
    main.innerHTML = folAuthShell(
      "<h1>Welcome back</h1>" +
      '<div class="fol-sub">Sign in to manage your club.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folEmail">Email address</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<div><div class="fol-lrow"><label for="folPass">Password</label><a data-act="showForgot">Forgot password?</a></div>' +
      '<input id="folPass" type="password" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"></div>' +
      '<button class="fol-cta" data-act="login">Log In</button>' +
      "</div>" +
      '<div class="fol-or">or</div>' +
      '<div class="fol-links"><a data-act="showJoin">' + ICON_JOIN + "Join with invite code</a></div>" +
      FOOT);
  }

  // New manager: create an account and step straight into a league with an invite code.
  function renderJoin() {
    setNavy(true);
    main.innerHTML = folAuthShell(
      "<h1>Join your league</h1>" +
      '<div class="fol-sub">Create your account with the invite code from your commissioner.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folEmail">Email address</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<div><label for="folPass">Password</label><input id="folPass" type="password" autocomplete="new-password" placeholder="choose a password"></div>' +
      '<div><label for="folCode">Invite code</label><input id="folCode" placeholder="from your commissioner"></div>' +
      '<div><label for="folDn">Manager name</label><input id="folDn" placeholder="your name"></div>' +
      '<div><label for="folTn">Team name</label><input id="folTn" placeholder="your club"></div>' +
      '<button class="fol-cta" data-act="joinNew">Create account and join</button>' +
      "</div>" +
      '<div class="fol-links"><a class="fol-mut" data-act="showLogin">Back to log in</a></div>' +
      FOOT);
  }

  function renderForgot() {
    setNavy(true);
    main.innerHTML = folAuthShell(
      "<h1>Reset your password</h1>" +
      '<div class="fol-sub">We\'ll email you a reset link.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folEmail">Email address</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<button class="fol-cta" data-act="sendReset">Send reset link</button>' +
      "</div>" +
      '<div class="fol-links"><a class="fol-mut" data-act="showLogin">Back to log in</a></div>' +
      FOOT);
  }

  function doLogin() {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    if (!email || !password) { say("Enter your email and password"); return; }
    busyBtn("login", "Signing in…");
    fetch(URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (d.access_token) { JWT = d.access_token; saveSession(d); wrap.querySelector("#folWho").textContent = email; enterApp(); }
        else { unbusyBtn("login"); say("Check your email to confirm your account, then log in."); }
      }).catch(function (e) { unbusyBtn("login"); say(e); });
  }

  // After login, go straight into the league: RLS scopes `leagues` to the ones
  // you belong to, so no league id is ever needed. One league opens directly
  // (admin -> Admin, player -> Squad); several show a quick picker; none shows
  // the join-by-invite form.
  function enterApp() {
    foLoading("Signing you in…");
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
    if (!p || !p.code) return Promise.resolve();   // no code left, but keep names for prefill
    return rpc("redeem_invite", { p_code: p.code, p_display_name: p.dn, p_team_name: p.tn || (p.dn + " XI") })
      .then(function () { lsDel(PEND); })
      .catch(function (e) {
        // Network hiccup (TypeError): keep everything so a flaky connection can't eat
        // a valid invite. Definitive rejection (already a member / spent code): drop
        // the dead code but keep the names so the join form can prefill them.
        if (!(e && e.name === "TypeError")) lsSet(PEND, JSON.stringify({ dn: p.dn, tn: p.tn }));
      });
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
    foLoading("Loading " + (league.name || "your league") + "…");
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
    }).catch(function (e) { foFatal("Could not load the league (" + ((e && e.message) || e) + "). Check your connection and reload."); });
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

  // Is MY club part of the published season snapshot? A member who joins (or
  // re-drafts) after kick-off isn't in it yet — never dump them into someone
  // else's club; send them to the draft / waiting lobby instead.
  function myClubInSnap(snap) {
    try {
      if (!SYNC || !SYNC.myTeam || !SYNC.myTeam.name) return false;
      return !!(snap && snap.teams && snap.teams.some(function (t) { return t && t.name === SYNC.myTeam.name; }));
    } catch (e) { return false; }
  }
  function syncTick(first) {
    if (!LG) return Promise.resolve();
    return sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round").then(function (a) {
      var st = a[0];
      if (st) {
        if (!myClubInSnap(st.snapshot)) {
          // Season is running but my club isn't in it yet (joined after kick-off,
          // or my club was removed). Draft / wait for a rebuild — the poll below
          // pulls us in automatically once a snapshot that includes us is pushed.
          SYNC.lastVersion = st.version; SYNC.started = true;
          schedulePoll();
          return preStart();
        }
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
      foReapplyTraining();
      // The snapshot's App.fin belongs to whoever pushed it. Members must see THEIR
      // club's treasury (t.bank, settled fairly by the resolver), not the pusher's.
      try {
        if (snap && typeof snap.teamIx === "number" && snap.teamIx !== App.teamIx && App.fin) {
          var myClub = GD.teams[App.teamIx];
          if (myClub) { App.fin.bank = myClub.bank || 0; App.fin.ledger = []; App.fin.sponsorBase = (myClub.sponsorDeal && myClub.sponsorDeal.base) || App.fin.sponsorBase; }
        }
      } catch (e) {}
      try { if (typeof window.store === "function") window.store("fo_welcomed", "1"); } catch (e) {}
      if (typeof window.saveGame === "function") window.saveGame(false);
      openWrap(false);
      if (focus) location.hash = "#/club";
      if (typeof window.route === "function") window.route();
    } catch (e) {
      console.warn("Fifty Overs applySnapshot failed", e);
      foFatal("Could not load the league season. Reload to try again — if it keeps happening, ask your commissioner to restart the season.");
    }
  }

  // Before the season starts: draft in the game, then wait for kick-off.
  function preStart() {
    return sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=manager_id").then(function (mine) {
      var drafted = !!(mine && mine.length);
      // the commissioner's home base is the admin lobby (invite / manage / start),
      // where they can also draft their own club when they want.
      if (SYNC.isFounder) { showWait(drafted); return; }
      if (drafted) { showWait(true); return; }
      // straight into the onboarding — it collects club name / crest / country
      // itself when the team row is missing or incomplete (no separate setup page)
      startDraft(SYNC.myTeam || {});
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
        var tgt = target * (0.97 + ((i * 89) % 70) / 1000);           // 97-104% of the human level: true peers
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

  // Generate fresh bot clubs from the draft pool (so we never depend on whatever
  // GD.teams currently holds — a restarted league was capped by that before).
  var BOT_NAMES = ["Riverside Rovers", "Coastal Comets", "Summit Strikers", "Valley Vanguard", "Harbour Hawks", "Prairie Pioneers", "Delta Dynamos", "Frontier Falcons", "Metro Mavericks", "Highland Hunters", "Canyon Kings", "Orchard Owls"];
  function byRating(a, b) { return (b.rating || 0) - (a.rating || 0); }
  function makeBotTeam(i, taken) {
    var cty = NAT[i % NAT.length];
    var pool = buildCountryPool(700003 + i * 104729, cty);
    var keepers = pool.filter(function (p) { return p.keeper; }).sort(byRating);
    var bowlers = pool.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !p.keeper; }).sort(byRating);
    var others = pool.filter(function (p) { return !p.keeper && (!p.bowlTypeFull || p.bowlTypeFull === "none"); }).sort(byRating);
    var squad = []; if (keepers[0]) squad.push(keepers[0]);
    squad = squad.concat(bowlers.slice(0, 6)).concat(others.slice(0, 7));
    var chosen = {}; squad.forEach(function (p) { chosen[p.name] = 1; });
    var rest = pool.filter(function (p) { return !chosen[p.name]; }).sort(byRating);
    while (squad.length < 14 && rest.length) squad.push(rest.shift());
    squad = squad.slice(0, 14).map(function (p) { var q = JSON.parse(JSON.stringify(p)); delete q.fee; q.fatigue = "rested"; q.formIx = 3; return q; });
    var nm = BOT_NAMES[i % BOT_NAMES.length]; while (taken && taken[nm]) nm = nm + " II";
    var pitches = ["green", "dry", "flat", "slow", "cracked", "balanced"];
    return { name: nm, ground: "Neutral Park", players: squad, youth: [], founded: false, homePitch: pitches[i % pitches.length], bank: 300000, seats: 9000, supporters: 2600, mood: 3, acadY: 2, acadS: 2 };
  }
  function fillBots(world) {
    var taken = {}; world.forEach(function (t) { taken[t.name] = 1; });
    var i = 0;
    while (world.length < 10 && i < 40) { try { var b = makeBotTeam(i, taken); taken[b.name] = 1; world.push(b); } catch (e) { break; } i++; }
    return world;
  }

  // draft (or set up + draft) my own club, from the lobby.
  function draftMine() { startDraft((SYNC && SYNC.myTeam) || {}); }

  // Practice Game: a private local season against ALL the league's clubs (your
  // friends' real squads + bots). Play matches interactively; nothing syncs.
  function practice() {
    var go = function (world, myName) {
      GD.teams = world;
      if (typeof window.econInit === "function") window.econInit();
      var mine = myName ? GD.teams.findIndex(function (t) { return t.name === myName; }) : 0;
      App.teamIx = mine >= 0 ? mine : 0;
      App.season = null; if (typeof window.seasonInit === "function") window.seasonInit();
      App.round = 1; App.seasonNo = App.seasonNo || 1; App.results = []; App.cup = { stage: 0, alive: null, results: [], out: false };
      if (typeof window.mpInit === "function") window.mpInit();
      SYNC.practice = true;
      if (SYNC.pollTimer) { clearInterval(SYNC.pollTimer); SYNC.pollTimer = null; }
      try { if (typeof window.store === "function") window.store("fo_welcomed", "1"); } catch (e) {}
      if (typeof window.saveGame === "function") window.saveGame(false);
      openWrap(false); location.hash = "#/matches"; if (typeof window.route === "function") window.route();
    };
    // if the league season is live, practise against those very teams
    if (SYNC.started && typeof GD !== "undefined" && GD.teams && GD.teams.length >= 2) {
      go(GD.teams.slice(), SYNC.myTeam ? SYNC.myTeam.name : null); return;
    }
    sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=club").then(function (rows) {
      var myClub = (rows && rows[0] && rows[0].club) || makeBotTeam(0);
      myClub.founded = true;
      var world = fillBots([myClub]); GD.teams = world; balanceBots();
      go(world, myClub.name);
    }).catch(function (e) { if (isMissingTable(e)) setupNeeded(); else { try { alert("Could not start Practice Game: " + ((e && e.message) || e)); } catch (_) {} say(e); } });
  }

  // Minimal onboarding: pick home country + names, then draft in the game.
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
      // The founder can ALWAYS start/restart once at least one club is drafted —
      // clubs still drafting join automatically later (they replace a bot).
      var canStart = SYNC.started || draftedCount >= 1;
      var startLabel = SYNC.started ? "Restart season (rebuild from clubs) ▸" : (draftedCount < 2 ? "Start season (you + bots) ▸" : "Start the league ▸");
      var ctl = isF
        ? '<div style="margin-top:10px">' +
            (canStart
              ? '<button class="p" data-act="startLeague">' + startLabel + '</button>' +
                '<div class="folsmall" style="margin-top:4px">' +
                (allReady ? "" : "Clubs still drafting join automatically when they finish — they take over a bot club. ") +
                (solo ? "Empty slots fill with bot clubs to make a full 10-team league." : "") + "</div>"
              : '<div class="folsmall">The season starts once at least one club has drafted.</div>') +
            '<div style="margin-top:8px"><button class="mini" data-act="mkInvite">Create invite code</button> <span id="folInvite" class="folsmall"></span></div>' +
          "</div>"
        : '<div class="folsmall" style="margin-top:10px">' + (SYNC.started
            ? "The season is already running — your club joins as soon as the commissioner restarts it (their lobby has the Restart button). You can jump in the moment that happens; this screen updates itself."
            : "Waiting for the commissioner to start the season.") + "</div>";
      var back = SYNC.started ? '<button class="mini" data-act="backToGame">◂ back to the game</button> ' : "";
      var draftBtn = drafted ? "" : '<button class="p" data-act="draftMine" style="margin-bottom:10px">Draft my squad ▸</button>';
      var practiceBtn = '<button class="mini" data-act="practice" style="margin-top:8px">Practice vs bots</button>';
      main.innerHTML = '<div class="folbody"><div class="folcard"><h4><span>' + E(LG.name) + (isF ? " · commissioner" : "") + "</span>" +
        (drafted ? '<span class="folbadge ok">you\'re in</span>' : "") + '</h4><div class="folpad">' + draftBtn +
        "<table><tr><th>Club</th><th>Status</th>" + (isF ? "<th></th>" : "") + "</tr>" + rows + "</table>" + ctl +
        '<div style="margin-top:10px">' + back + practiceBtn + ' <button class="mini" data-act="logout">log out</button></div>' +
        "</div></div></div>";
    }).catch(function (e) { if (isMissingTable(e)) setupNeeded(); else say(e); });
  }
  function delTeam(id, name) {
    foConfirm({
      danger: true, title: 'Delete "' + name + '"?',
      body: "Its club, squad and orders are permanently removed. This cannot be undone.",
      confirm: "Delete club", cancel: "Keep it"
    }).then(function (ok) {
      if (!ok) return;
      rpc("founder_delete_team", { p_league_id: LG.id, p_team_id: id })
        .then(function () {
          // The started league reads its teams from the published snapshot, so the
          // club lingers in the game until the world is rebuilt from the clubs that
          // remain. Offer to do that now (it restarts the season table).
          if (SYNC && SYNC.started) {
            return foConfirm({
              title: '"' + name + '" removed',
              body: "Rebuild the league now so it disappears from the game? This restarts the season table from the remaining clubs.",
              confirm: "Rebuild now", cancel: "Later"
            }).then(function (ok2) { if (ok2) { startLeague(); } else { say("Deleted " + name + "."); showWait(!!(SYNC && SYNC.myTeam)); } });
          }
          say("Deleted " + name + ".");
          showWait(!!(SYNC && SYNC.myTeam));
        }).catch(say);
    });
  }

  function mkInvite() {
    // one standing code for the whole league — share it with every friend
    rpc("league_code", { p_league_id: LG.id })
      .then(function (code) {
        var el = wrap.querySelector("#folInvite");
        if (el) el.innerHTML = "League code: <b style='font-size:16px;letter-spacing:.08em'>" + E((code || "") + "") + "</b> — share the same code with all your friends. It never expires.";
        try { navigator.clipboard && navigator.clipboard.writeText(code + ""); toast("League code copied: " + code); } catch (e) {}
      })
      .catch(function (e) {
        var m = ((e && e.message) || e) + "";
        if (/Could not find the function/i.test(m)) {
          // 0016 not run yet — fall back to classic one-time invites
          var code = ("FO" + Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 4)).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
          rpc("create_invite", { p_league_id: LG.id, p_code: code, p_role: "manager" })
            .then(function () { var el = wrap.querySelector("#folInvite"); if (el) el.textContent = "Share this code (single use): " + code; })
            .catch(say);
        } else say(e);
      });
  }

  // Founder assembles the league from everyone's drafted clubs and kicks off.
  // With only one human club, the game's own bot teams fill the league so there
  // is something to play; with two or more, it is a pure human league.
  function startLeague() {
    sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id").then(function (clubs) {
      if (!clubs || !clubs.length) { say("Draft your squad first, then start the season."); return; }
      try {
        var world = fillBots(clubs.map(function (c) { return c.club; }));   // top up to a full 10-team league
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
          say("Season started! Matches resolve automatically as orders come in.");
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
      // While planning a future round, don't auto-push the current round's orders.
      if (SYNC.planRound == null && SYNC.started && window.App && App.season && typeof GD !== "undefined" && GD.teams) {
        var tro = foTrainState();
        var ordersReady = App.orders && App.orders.saved;
        var sig = (ordersReady ? JSON.stringify(App.orders) : "-") + "|" + JSON.stringify(tro.training) + "|" + JSON.stringify(tro.youthPending.map(function (y) { return y.name; })) + "|" + JSON.stringify((tro.marketPending || []).map(function (y) { return y.name; })) + "|" + JSON.stringify(tro.seatsPending || null) + "|" + App.season.round;
        if (sig !== SYNC.lastOrderSig && (ordersReady || Object.keys(tro.training).length || tro.youthPending.length || (tro.marketPending || []).length || tro.seatsPending)) {
          SYNC.lastOrderSig = sig;
          var pkt = {
            fo_packet: 1, teamIx: App.teamIx, club: (GD.teams[App.teamIx] || {}).name, round: App.season.round,
            manager: (SYNC.me && SYNC.me.display_name) || "manager",
            orders: ordersReady ? App.orders : null,
            fo_training: tro.training, fo_youth: tro.youthPending, fo_market: tro.marketPending || [], fo_seats: tro.seatsPending || null
          };
          rpc("push_packet", { p_league_id: LG.id, p_round: App.season.round, p_packet: pkt }).catch(function () {});
        }
      }
    } catch (e) {}
    // transfer news: tell everyone when a club claims a market player
    if (SYNC.started) {
      sel("league_market", "league_id=eq." + LG.id + "&select=player_name,club,manager_id&order=created_at.desc&limit=6").then(function (rows) {
        if (!SYNC.__mkSeen) { SYNC.__mkSeen = {}; (rows || []).forEach(function (r) { SYNC.__mkSeen[r.player_name] = 1; }); return; }
        (rows || []).forEach(function (r) {
          if (SYNC.__mkSeen[r.player_name]) return;
          SYNC.__mkSeen[r.player_name] = 1;
          if (!(SYNC.myMid && r.manager_id === SYNC.myMid)) toast(r.player_name + " has signed for " + r.club + ".");
        });
      }).catch(function () {});
    }
    sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round").then(function (a) {
      var st = a[0]; if (!st || st.version <= SYNC.lastVersion) return;
      if (document.getElementById("fo-onb")) return;               // never yank the draft room away mid-pick
      SYNC.lastVersion = st.version;
      // auto-enter once a rebuild includes us; if we were parked in the lobby, land on the club page
      if (myClubInSnap(st.snapshot)) applySnapshot(st.snapshot, wrap.classList.contains("on"));
    }).catch(function () {});
  }

  function doJoinSignup() {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    var code = val("folCode"), dn = val("folDn"), tn = val("folTn");
    if (!email || !password) { say("Enter your email and password"); return; }
    if (!code || !dn) { say("Enter your invite code and manager name"); return; }
    // Remember the invite so we can finish joining after email confirmation + login.
    lsSet(PEND, JSON.stringify({ code: code, dn: dn, tn: tn }));
    busyBtn("joinNew", "Creating account\u2026");
    fetch(URL + "/auth/v1/signup?redirect_to=" + encodeURIComponent(APP_URL), { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password, options: { email_redirect_to: APP_URL } }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (!d.access_token) { say("Account created! Check your email, tap the confirmation link, then log in. We'll drop you straight into your league."); renderLogin(); return; }
        JWT = d.access_token; saveSession(d); wrap.querySelector("#folWho").textContent = email;
        return enterApp();
      }).catch(function (e) { unbusyBtn("joinNew"); say(e); });
  }

  function sendReset() {
    var email = val("folEmail");
    if (!email) { say("Enter your email"); return; }
    busyBtn("sendReset", "Sending\u2026");
    fetch(URL + "/auth/v1/recover?redirect_to=" + encodeURIComponent(APP_URL), { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email }) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); })
      .then(function () { say("If that email has an account, a reset link is on its way."); renderLogin(); }).catch(function (e) { unbusyBtn("sendReset"); say(e); });
  }

  // ---- join a league (shown only when you are not in one yet) ----
  function renderEnter() {
    setNavy(true);
    wrap.querySelector("#folWho").textContent = "";
    // pre-fill from the invite remembered at signup, if we still have it
    var p = null; try { p = JSON.parse(lsGet(PEND) || "null"); } catch (e) {}
    main.innerHTML = folAuthShell(
      "<h1>Join your league</h1>" +
      '<div class="fol-sub">You\'re signed in — enter the invite code from your commissioner.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folCode">Invite code</label><input id="folCode" placeholder="from your commissioner" value="' + E((p && p.code) || "") + '"></div>' +
      '<div><label for="folDn">Manager name</label><input id="folDn" placeholder="your name" value="' + E((p && p.dn) || "") + '"></div>' +
      '<div><label for="folTn">Team name</label><input id="folTn" placeholder="your club" value="' + E((p && p.tn) || "") + '"></div>' +
      '<button class="fol-cta" data-act="join">Join</button>' +
      "</div>" +
      '<div class="fol-links"><a class="fol-mut" data-act="logout">Log out</a></div>' +
      FOOT);
  }
  function joinLeague() {
    var code = val("folCode"), dn = val("folDn"), tn = val("folTn");
    if (!code || !dn) { say("Enter the invite code and your name"); return; }
    busyBtn("join", "Joining\u2026");
    rpc("redeem_invite", { p_code: code, p_display_name: dn, p_team_name: tn || dn + " XI" })
      .then(function (mid) { lsDel(PEND); return sel("members", "id=eq." + mid + "&select=league_id"); })
      .then(function (m) { return enterGameById(m[0].league_id); })
      .catch(function (e) { unbusyBtn("join"); say(e); });
  }
  // ============================================================================
  // IN-GAME DRAFT: build a balanced, country-flavoured, unique pool from the
  // manager's server draft_seed, drive the game's real draft screen (pgFounder),
  // relabel the confirm button to "Start Season", and save the squad on confirm.
  // ============================================================================

  // 42 balanced players (same tier structure for everyone), all set to the
  // manager's country with country names, deterministic from their draft_seed.
  function buildCountryPool(seedInt, country) {
    // string seeds (league ids, "<club>-scout-3", …) hash to a real uint32 —
    // `str >>> 0` is always 0, which made every string-seeded pool identical
    if (typeof seedInt === "string") {
      var h = 2166136261;
      for (var si = 0; si < seedInt.length; si++) { h ^= seedInt.charCodeAt(si); h = Math.imul(h, 16777619); }
      seedInt = h >>> 0;
    }
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
  window.__folOnbPreview = function (step) { try {
    if (!FO_ONB) FO_ONB = { team: {}, step: 1, needsSetup: true, country: NAT[0], clubName: "Thunder Empire", ground: "Riverview Oval", pitch: "balanced", style: "balanced", sponsor: null, scenario: "average", role: "all", riskAck: false };
    FO_ONB.needsSetup = true;
    if (step && step !== "create") {
      FO_ONB.clubName = FO_ONB.clubName || "Thunder Empire";
      if (!App.founder || !App.founder.pool) App.founder = { name: FO_ONB.clubName, budget: 1000000, pool: buildCountryPool("fo-preview", FO_ONB.country), picked: [], identity: "Balanced XI" };
      if (step === "draft" || step === "report" || step === "players") FO_ONB.sponsor = FO_ONB.sponsor || "community";
      if (step === "report" && !App.founder.picked.length) {
        // draft a legal squad WITHIN the $1M budget, best value first
        var _pool = App.founder.pool.slice(), _byR = function (a, b) { return (b.rating || 0) - (a.rating || 0); };
        var _spent = 0, _picked = [], _used = {};
        var _take = function (list, n) {
          list.sort(_byR).forEach(function (p) {
            if (n <= 0 || _used[p.name]) return;
            var fee = foDraftPrice(p);
            if (_spent + fee > 940000) return;
            _used[p.name] = 1; _picked.push(p); _spent += fee; n--;
          });
        };
        _take(_pool.filter(function (p) { return p.keeper; }), 1);
        _take(_pool.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !p.keeper; }), 6);
        _take(_pool.filter(function (p) { return !p.keeper && (!p.bowlTypeFull || p.bowlTypeFull === "none"); }), 6);
        App.founder.picked = _picked;
      }
    }
    ({ create: foOnbCreate, charter: foOnbCharter, money: foOnbMoney, sponsor: foOnbSponsor, players: foOnbPlayers, draft: foOnbDraft, report: foOnbReport }[step || "create"] || foOnbCreate)();
  } catch (e) { console.warn("onb preview", e); } };   // debug/test hook (harmless)

  // Draft happens in the game's OWN founder screen (pgFounder). We hand it a
  // balanced, country-flavoured pool derived from the server draft_seed.
  // ===========================================================================
  //  FIRST-LOGIN ONBOARDING + DRAFT FINANCE FLOW
  //  8 branded screens that teach the finance model through choices + a live
  //  forecast, then hand the drafted squad to the engine's founderConfirm(). All
  //  finance constants come from finance-config.json (embedded below).
  // ===========================================================================
  // Finance model calibrated to the ENGINE's real weekly economy tick:
  //   income  = sponsor base (+ win bonus) + home gate (attendance x $9)
  //   costs   = wage bill + stadium ($1/seat on 9,000 seats) + academies ($16k at lvl 2/2)
  //   prizes  = engine PRIZES by final position at season end
  // Crowds follow the engine's attendance() = supporters x (0.55 + 0.13 x mood).
  var FO_FIN = {
    seasonLength: 18, homeMatches: 9, startingBank: 1000000, ticketPrice: 9,
    stadiumCost: 9000, academyCost: 16000,
    health: [{ label: "Excellent", min: 250000 }, { label: "Safe", min: 100000 }, { label: "Tight", min: 25000 }, { label: "Danger", min: 0 }, { label: "Crisis", min: null }],
    styles: [
      { id: "balanced", name: "Balanced", draftBudget: 800000, reserve: 200000, risk: "Low", rec: true, tone: "teal", tag: "Sustainable growth for new managers." },
      { id: "win_now", name: "Win Now", draftBudget: 925000, reserve: 75000, risk: "High", rec: false, tone: "terra", tag: "Spend big on stars." },
      { id: "moneyball", name: "Moneyball", draftBudget: 700000, reserve: 300000, risk: "Medium", rec: false, tone: "violet", tag: "Save cash and hunt value." }
    ],
    sponsors: [
      { id: "community", name: "Prudential", ind: "Insurance \u00b7 London, est. 1848", pos: "Steady money, no strings.", base: 45000, win: 0, halfway: 0, seasonTop3: 0, champ: 0, tone: "teal", rec: false, lines: ["No result bonuses", "Guaranteed all season"] },
      { id: "results", name: "Nike", ind: "Sportswear \u00b7 Beaverton, Oregon", pos: "Paid to win.", base: 38000, win: 13000, halfway: 0, seasonTop3: 0, champ: 0, tone: "terra", lines: ["+$13,000 per win", "Paid on results"] },
      { id: "contender", name: "Emirates", ind: "Airline \u00b7 Dubai", pos: "Fly with the winners.", base: 15000, win: 45000, halfway: 0, seasonTop3: 0, champ: 0, tone: "gold", lines: ["+$45,000 per win", "The league's biggest win bonus"] }
    ],
    scenarios: [
      { id: "bad", name: "Bad season", wins: 5, crowd: 2100, finish: 8, t3half: false, t3fin: false, champ: false },
      { id: "average", name: "Average season", wins: 9, crowd: 2450, finish: 5, t3half: false, t3fin: false, champ: false },
      { id: "good", name: "Top-3 season", wins: 13, crowd: 2900, finish: 3, t3half: true, t3fin: true, champ: false },
      { id: "champion", name: "Champion season", wins: 15, crowd: 3300, finish: 1, t3half: true, t3fin: true, champ: true }
    ],
    prizes: [200000, 160000, 130000, 110000, 90000, 75000, 60000, 50000, 40000, 30000]
  };

  function foDraftPrice(p) { return (p && p.fee != null) ? p.fee : Math.max(8000, Math.round((((p && p.rating) || 3000) - 2800) * 40 + 8000)); }
  function foDailyWage(p) { return (p && p.wage != null) ? p.wage : Math.max(700, Math.round(((p && p.fee) || 40000) * 0.028 / 10) * 10); }
  function foSeasonCost(p) { return foDraftPrice(p) + foDailyWage(p) * FO_FIN.seasonLength; }
  function foSponsorById(id) { for (var i = 0; i < FO_FIN.sponsors.length; i++) if (FO_FIN.sponsors[i].id === id) return FO_FIN.sponsors[i]; return FO_FIN.sponsors[0]; }
  function foStyleById(id) { for (var i = 0; i < FO_FIN.styles.length; i++) if (FO_FIN.styles[i].id === id) return FO_FIN.styles[i]; return FO_FIN.styles[0]; }
  function foScenarioById(id) { for (var i = 0; i < FO_FIN.scenarios.length; i++) if (FO_FIN.scenarios[i].id === id) return FO_FIN.scenarios[i]; return FO_FIN.scenarios[1]; }
  function foSponsorPayout(sp, sc) { var v = sp.base * FO_FIN.seasonLength + sp.win * sc.wins; if (sc.t3half) v += sp.halfway; if (sc.t3fin) v += sp.seasonTop3; if (sc.champ) v += sp.champ; return v; }
  function foTicket(sc) { return FO_FIN.homeMatches * sc.crowd * FO_FIN.ticketPrice; }
  function foHealth(end) { for (var i = 0; i < FO_FIN.health.length; i++) { var h = FO_FIN.health[i]; if (h.min == null || end >= h.min) return h.label; } return "Crisis"; }
  function foHealthTone(label) { return { Excellent: "teal", Safe: "teal", Tight: "gold", Danger: "terra", Crisis: "danger" }[label] || "gold"; }
  // The whole forecast for a set of picks + sponsor, under one scenario.
  function foForecast(picked, sponsorId, scenarioId) {
    var draftSpent = 0, dailyWage = 0;
    for (var i = 0; i < picked.length; i++) { draftSpent += foDraftPrice(picked[i]); dailyWage += foDailyWage(picked[i]); }
    var bankAfter = FO_FIN.startingBank - draftSpent, seasonWage = dailyWage * FO_FIN.seasonLength;
    var sc = foScenarioById(scenarioId || "average"), sp = foSponsorById(sponsorId);
    var ticket = foTicket(sc), sponsor = foSponsorPayout(sp, sc);
    var fixed = (FO_FIN.stadiumCost + FO_FIN.academyCost) * FO_FIN.seasonLength;
    var prize = FO_FIN.prizes[(sc.finish || 8) - 1] || 30000;
    var end = bankAfter + ticket + sponsor + prize - seasonWage - fixed;
    return { draftSpent: draftSpent, bankAfter: bankAfter, dailyWage: dailyWage, seasonWage: seasonWage, ticket: ticket, sponsor: sponsor, prize: prize, ground: fixed, end: end, health: foHealth(end) };
  }
  var FO$ = function (n) { return "$" + Math.round(n || 0).toLocaleString(); };
  var FO$s = function (n) { return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n || 0)).toLocaleString(); };

  // ---- onboarding state + shell --------------------------------------------
  var FO_ONB = null;
  var FO_ICON =
    "<svg viewBox='0 0 1024 1024' width='100%' height='100%' xmlns='http://www.w3.org/2000/svg'>" +
    "<rect x='64' y='64' width='896' height='896' rx='220' fill='#101B2D'/>" +
    "<g fill='#C8674A'><rect x='418' y='215' width='42' height='138' rx='10'/><rect x='492' y='215' width='42' height='138' rx='10'/><rect x='566' y='215' width='42' height='138' rx='10'/><rect x='410' y='200' width='58' height='18' rx='9'/><rect x='484' y='200' width='58' height='18' rx='9'/><rect x='558' y='200' width='58' height='18' rx='9'/></g>" +
    "<path d='M280 394H560V455H335L313 556C342 531 381 518 429 518C501 518 560 542 605 589C650 636 672 695 672 766C672 838 647 897 596 944C546 991 482 1015 404 1015C337 1015 282 999 239 966C196 934 170 888 161 830H230C237 869 255 899 285 920C315 941 354 951 401 951C460 951 509 934 548 900C586 866 605 821 605 764C605 709 587 664 551 629C515 594 469 577 413 577C354 577 307 597 272 637H207L280 394Z' fill='#F6F4EE' transform='translate(5 -140) scale(.86)'/>" +
    "<circle cx='625' cy='615' r='194' stroke='#F6F4EE' stroke-width='58' fill='none'/>" +
    "<path d='M625 809C579 750 579 480 625 421' stroke='#F6F4EE' stroke-width='38' stroke-linecap='round' fill='none'/>" +
    "<path d='M690 460C704 555 704 674 690 770' stroke='#F6F4EE' stroke-width='24' stroke-linecap='round' stroke-dasharray='52 42' fill='none'/>" +
    "<path d='M622 460C636 555 636 674 622 770' stroke='#F6F4EE' stroke-width='24' stroke-linecap='round' stroke-dasharray='52 42' fill='none'/></svg>";
  // Monoline icon set (feather-style, stroke = currentColor) — replaces emoji.
  var FO_ICONS = {
    bat: "<path d='M5 19l-1 1m2-2L17 7a2.4 2.4 0 0 1 3.4 3.4L9.5 21.5a2 2 0 0 1-2.8 0L6 20.8a2 2 0 0 1 0-2.8Z'/><circle cx='5.5' cy='5.5' r='2'/>",
    shield: "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/>",
    shieldCheck: "<path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/><path d='m9 11.5 2 2 4-4'/>",
    wallet: "<rect x='3' y='6' width='18' height='13' rx='2.5'/><path d='M3 10h18M16 15h2'/>",
    tag: "<path d='M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8Z' transform='scale(.92) translate(1 1)'/><circle cx='7.5' cy='7.5' r='1.4'/>",
    check: "<path d='m5 12.5 4.5 4.5L19 7.5'/>",
    checkCircle: "<circle cx='12' cy='12' r='9'/><path d='m8.5 12.2 2.4 2.4 4.6-4.8'/>",
    warn: "<path d='M10.3 3.6 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z'/><path d='M12 9v5'/><circle cx='12' cy='17.2' r='.6' fill='currentColor'/>",
    info: "<circle cx='12' cy='12' r='9'/><path d='M12 11v5'/><circle cx='12' cy='8' r='.7' fill='currentColor'/>",
    scales: "<path d='M12 4v16m-5 0h10M7 5.5h10'/><path d='M7 5.5 4 12a3.4 3.4 0 0 0 6 0L7 5.5Zm10 0L14 12a3.4 3.4 0 0 0 6 0l-3-6.5Z'/>",
    trophy: "<path d='M8 21h8m-4-4v4M7 4h10v6a5 5 0 0 1-10 0V4Z'/><path d='M7 6H4a3 3 0 0 0 3.4 4M17 6h3a3 3 0 0 1-3.4 4'/>",
    chart: "<path d='M4 20V13M10 20V5M16 20v-9M21 20H3'/>",
    users: "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.9M15.5 3.3a4 4 0 0 1 0 7.4'/>",
    calendar: "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M16 3v4M8 3v4M3 10h18'/>",
    coins: "<ellipse cx='12' cy='6' rx='8' ry='3'/><path d='M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6'/><path d='M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6'/>",
    target: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='4.5'/><circle cx='12' cy='12' r='.8' fill='currentColor'/>"
  };
  function FO_I(name, size) {
    return "<svg class='fo-i' width='" + (size || 18) + "' height='" + (size || 18) + "' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + (FO_ICONS[name] || "") + "</svg>";
  }
  var FO_STEPS = ["Club", "Charter", "Money", "Sponsor", "Players", "Draft", "Report"];
  function foOnbShell(stepIx, body) {
    var prog = FO_STEPS.map(function (s, i) {
      var cls = i < stepIx ? "done" : (i === stepIx ? "on" : "");
      return "<div class='fo-ob-step " + cls + "'><span class='fo-ob-dot'>" + (i < stepIx ? "✓" : (i + 1)) + "</span><span class='fo-ob-slbl'>" + s + "</span></div>";
    }).join("<span class='fo-ob-sep' aria-hidden='true'></span>");
    return "<div class='fo-ob-shell'><div class='fo-ob-inner'><div class='fo-ob-prog'>" + prog + "</div>" + body + "</div></div>";
  }
  function foOnbMount(stepIx, body) {
    var host = document.getElementById("fo-onb");
    if (!host) { host = document.createElement("div"); host.id = "fo-onb"; document.body.appendChild(host); }
    host.innerHTML = foOnbShell(stepIx, body);
    host.style.display = "block";
    try { openWrap(false); } catch (e) {}
    return host;
  }
  function foOnbClose() { var h = document.getElementById("fo-onb"); if (h) { h.style.display = "none"; h.innerHTML = ""; } }

  function foOnbStart(team) {
    if (typeof window.genDraftPool !== "function" || typeof window.pgFounder !== "function") { say("Game engine not ready. Reload the page and try again."); return; }
    team = team || {};
    try {
      // A brand-new manager may not have a team row (or country) yet — the create
      // screen collects club name + country and saves them; the pool is built then.
      var needsSetup = !(team.country && team.draft_seed);
      var pool = needsSetup ? [] : buildCountryPool(team.draft_seed || team.name || "fo-" + Date.now(), team.country || "ENG");
      App.founder = {
        name: team.name || "New Club", budget: 1000000, pool: pool, picked: [], identity: "Balanced XI",
        mgr: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager",
        __league: { league_id: (LG && LG.id) || null, team_id: team.id }
      };
      FO_ONB = { team: team, step: 1, needsSetup: needsSetup, country: team.country || NAT[0], clubName: team.name || "", ground: (team.name ? team.name + " Oval" : "Riverview Oval"), pitch: "balanced", style: "balanced", sponsor: null, scenario: "average", role: "all", riskAck: false };
      foOnbCreate();
    } catch (e) {
      // never leave a new manager on a blank screen — fall back to the engine's draft
      console.warn("Fifty Overs onboarding failed, using the standard draft:", e);
      try { if (!App.founder || !App.founder.pool) App.founder = { name: team.name || "New Club", budget: 1000000, pool: buildCountryPool(team.draft_seed || "fo", team.country || "ENG"), picked: [], identity: "Balanced XI", __league: { league_id: (LG && LG.id) || null, team_id: team.id } }; openWrap(false); window.pgFounder(); }
      catch (e2) { say(e2); }
    }
  }
  window.__foOnb = { start: foOnbStart, draft: foOnbDraft, report: foOnbReport, risk: foOnbRisk, forecast: foForecast, state: function () { return FO_ONB; } };

  // Engine pitch types and what they actually do in the match engine.
  var FO_PITCH_CARDS = [
    { id: "balanced", nm: "Balanced", d: "Fair contest. No one gets favours." },
    { id: "green", nm: "Green", d: "Seamers move it, especially with the new ball. Draft pace." },
    { id: "dry", nm: "Crumbling", d: "Turns square as it wears. Spinners thrive; draft slow bowlers." },
    { id: "flat", nm: "Flat", d: "A batter's paradise: boundaries flow, wickets are rare." },
    { id: "slow", nm: "Slow", d: "Low and grippy. Hard to hit boundaries; suits patient sides." },
    { id: "cracked", nm: "Sticky", d: "Unpredictable bounce. Wickets for everyone." },
    { id: "twoPaced", nm: "Two-paced", d: "Some balls hurry, some hold. Timing is never safe." }
  ];
  // ---- Screen 1 · Create your club -----------------------------------------
  function foOnbCreate() {
    FO_ONB.step = 1;
    if (!FO_ONB.country) FO_ONB.country = NAT[0];
    var flagOf = function (c) { try { return (typeof foFlag === "function" && foFlag(c)) || ""; } catch (e) { return ""; } };
    var ctyField = "<label class='fo-ob-lbl'>Home country <span class='fo-ob-hint'>: you draft players from here</span></label>" +
      (FO_ONB.needsSetup
        ? "<div class='fo-ctygrid'>" + NAT.map(function (c) {
            return "<button type='button' class='fo-cty" + (FO_ONB.country === c ? " on" : "") + "' data-cty='" + E(c) + "'><i>" + flagOf(c) + "</i><span>" + E(c) + "</span></button>";
          }).join("") + "</div>"
        : "<div class='fo-ctygrid'><button type='button' class='fo-cty on' disabled><i>" + flagOf(FO_ONB.country) + "</i><span>" + E(FO_ONB.country) + "</span></button></div>");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-cols'>" +
      "<div class='fo-ob-colmain'>" +
      "<div class='fo-ob-eyebrow'>Welcome to Fifty Overs</div>" +
      "<h1 class='fo-ob-h1'>Found your club</h1>" +
      "<p class='fo-ob-lead'>A private league between you and your friends: draft real players, set a line-up each matchday, and one match plays out every day. Start with your club's identity. Everything here is yours for the whole season.</p>" +
      "<label class='fo-ob-lbl'>Manager name</label><input class='fo-ob-input' value='" + E((SYNC && SYNC.me && SYNC.me.display_name) || "Manager") + "' disabled>" +
      "<label class='fo-ob-lbl'>Club name</label><input id='fo-ob-name' class='fo-ob-input' maxlength='28' value='" + E(FO_ONB.clubName) + "' placeholder='Harbor City CC'>" +
      ctyField +
      "<label class='fo-ob-lbl'>Home ground name</label><input id='fo-ob-ground' class='fo-ob-input' maxlength='30' value='" + E(FO_ONB.ground) + "' placeholder='Harbor Oval'>" +
      "<label class='fo-ob-lbl'>Home pitch <span class='fo-ob-hint'>: you play 9 of your 18 matches on it, so draft a squad to match</span></label>" +
      "<div class='fo-pitchgrid'>" + FO_PITCH_CARDS.map(function (pt) {
        return "<button type='button' class='fo-pitch " + (FO_ONB.pitch === pt.id ? "on" : "") + "' data-pitch='" + pt.id + "'><b>" + pt.nm + "</b><span>" + pt.d + "</span></button>";
      }).join("") + "</div>" +
      "<div class='fo-ob-act'><button class='fo-ob-cta' id='fo-ob-c1'>Continue</button></div>" +
      "</div>" +
      "<aside class='fo-ob-snap'>" +
      "<div class='fo-clubprev' id='fo-prev'><div class='fo-clubprev-crest' id='fo-prev-cr'></div>" +
      "<div class='fo-clubprev-nm' id='fo-prev-nm'></div><div class='fo-clubprev-sub' id='fo-prev-sub'></div></div>" +
      "<div class='fo-ob-snaph'>Season 1 snapshot</div>" +
      "<div class='fo-snap-row'><i>" + FO_I("users") + "</i><div><b>10-team league</b></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("calendar") + "</i><div><b>18 matchdays</b></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("coins") + "</i><div><b>$1,000,000</b><span>starting bank</span></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("bat") + "</i><div><b>11&#8211;16 player</b><span>squad draft</span></div></div>" +
      "</aside></div></div>";
    var host = foOnbMount(0, body);
    // live identity preview: watching "your" club take shape as you type
    var updPrev = function () {
      var nm = ((host.querySelector("#fo-ob-name") || {}).value || "").trim() || "Your Club";
      var gr = ((host.querySelector("#fo-ob-ground") || {}).value || "").trim() || (nm.split(" ")[0] + " Oval");
      var ini = nm.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 3).toUpperCase();
      var cr = host.querySelector("#fo-prev-cr"), pn = host.querySelector("#fo-prev-nm"), ps = host.querySelector("#fo-prev-sub");
      if (cr) cr.textContent = ini || "FC";
      if (pn) pn.textContent = nm;
      if (ps) ps.innerHTML = flagOf(FO_ONB.country) + " " + E(FO_ONB.country) + " &middot; " + E(gr) + " &middot; " + E(foPitchName(FO_ONB.pitch || "balanced")) + " pitch";
    };
    ["fo-ob-name", "fo-ob-ground"].forEach(function (id) { var el = host.querySelector("#" + id); if (el) el.addEventListener("input", updPrev); });
    // selections flip in place: no re-render, nothing typed is lost, no scroll jump
    host.querySelectorAll(".fo-cty[data-cty]").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.country = b.getAttribute("data-cty");
        host.querySelectorAll(".fo-cty").forEach(function (x) { x.classList.toggle("on", x === b); });
        updPrev();
      });
    });
    host.querySelectorAll(".fo-pitch").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.pitch = b.getAttribute("data-pitch");
        host.querySelectorAll(".fo-pitch").forEach(function (x) { x.classList.toggle("on", x === b); });
        updPrev();
      });
    });
    updPrev();
    host.querySelector("#fo-ob-c1").addEventListener("click", function () {
      var nm = (host.querySelector("#fo-ob-name").value || "").trim();
      if (nm.length < 2) { host.querySelector("#fo-ob-name").focus(); return; }
      FO_ONB.clubName = nm; FO_ONB.ground = (host.querySelector("#fo-ob-ground").value || "").trim() || (nm + " Oval");
      App.founder.name = nm;
      if (!FO_ONB.needsSetup) { foOnbCharter(); return; }
      // First visit: save the club (name + country) to the league and build the
      // draft pool from the server-issued seed. Manager name comes from signup —
      // never asked twice.
      var cty = FO_ONB.country || NAT[0];
      var btn = host.querySelector("#fo-ob-c1"); btn.disabled = true; btn.textContent = "Saving…";
      rpc("create_league_team", { p_league_id: LG.id, p_team_name: nm, p_manager_name: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager", p_country: cty })
        .then(function (team) {
          SYNC.myTeam = team; FO_ONB.team = team; FO_ONB.needsSetup = false; FO_ONB.country = team.country || cty;
          App.founder.pool = buildCountryPool(team.draft_seed || nm, team.country || cty);
          App.founder.__league.team_id = team.id;
          foOnbCharter();
        })
        .catch(function (e) { btn.disabled = false; btn.textContent = "Continue"; say(e); });
    });
  }

  // ---- Screen 2 · The club is founded (charter + the sponsor's grant) ------
  function foOnbCharter() {
    FO_ONB.step = 2;
    var pt = FO_PITCH_CARDS.find(function (x) { return x.id === FO_ONB.pitch; }) || FO_PITCH_CARDS[0];
    var body =
      "<div class='fo-ob-card fo-ob-charter fo-charter-big'>" +
      "<div class='fo-charter-ic'>" + FO_I("trophy", 40) + "</div>" +
      "<div class='fo-ob-eyebrow'>The charter is signed</div>" +
      "<h1 class='fo-ob-h1 fo-charter-h1'>" + E(FO_ONB.clubName) + " is founded</h1>" +
      "<div class='fo-charter-date'>Founded " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + "</div>" +
      "<p class='fo-ob-lead fo-charter-lead'>The board is seated, the groundsman has the keys to <b>" + E(FO_ONB.ground) + "</b>" +
      (pt.id !== "balanced" ? ", a <b>" + pt.nm.toLowerCase() + "</b> deck," : "") +
      " and your founding sponsor has wired the grant to get the club off the ground.</p>" +
      "<div class='fo-charter-grant'><span>Founding grant</span><b>$1,000,000</b></div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Show me the money</button></div></div>";
    var host = foOnbMount(1, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbCreate);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbMoney);
  }

  // ---- Screen 3 · How your money works -------------------------------------
  function foOnbMoney() {
    FO_ONB.step = 3;
    var tile = function (ic, l, v, s, tone) { return "<div class='fo-ob-tile'><span class='fo-ob-tic fo-tic-" + (tone || "teal") + "'>" + FO_I(ic, 17) + "</span><div class='fo-ob-tl'>" + l + "</div><div class='fo-ob-tv'>" + v + "</div>" + (s ? "<div class='fo-ob-ts'>" + s + "</div>" : "") + "</div>"; };
    var chk = function (t) { return "<div class='fo-ob-chk'><i>" + FO_I("checkCircle", 17) + "</i><span>" + t + "</span></div>"; };
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>How your money works</div>" +
      "<h1 class='fo-ob-h1'>Your $1,000,000 has two jobs</h1>" +
      "<div class='fo-ob-jobs'><div class='fo-ob-job'><span class='fo-ob-jic fo-jic-teal'>" + FO_I("bat", 20) + "</span><div><b>Build the squad</b><div class='fo-ob-muted'>Spend in the draft to sign the best players.</div></div></div>" +
      "<div class='fo-ob-job'><span class='fo-ob-jic fo-jic-terra'>" + FO_I("shield", 20) + "</span><div><b>Keep the club running</b><div class='fo-ob-muted'>Cover wages, costs and build a healthy future.</div></div></div></div>" +
      "<div class='fo-ob-tiles'>" + tile("wallet", "Starting bank", "$1,000,000", "Draft + operating money", "teal") +
      tile("tag", "Recommended draft spend", "$750k&#8211;$850k", "Leaves room to operate", "terra") +
      tile("shieldCheck", "Recommended reserve", "$150k&#8211;$250k", "Cover wages &amp; injuries", "teal") + "</div>" +
      "<div class='fo-ob-chks'>" + chk("Every player has a <b>draft price</b> and a <b>daily wage</b>.") + chk("You pay wages to your squad every matchday.") +
      chk("Home matches bring ticket income (about $22k a game).") + chk("Running the club costs about $25k every matchday on top of wages.") + chk("Sponsors, wins and prize money keep you solvent.") + "</div>" +
      "<div class='fo-ob-warn'><i>" + FO_I("warn", 17) + "</i>Spend too much in the draft and you may have to release players later.</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(2, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbCharter);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbSponsor);
  }

  // ---- Screen 4 · Choose your sponsor --------------------------------------
  function foOnbSponsor() {
    FO_ONB.step = 4;
    var marks = {
      community: "<span class='fo-brandmark fo-brand-pru'>PRUDENTIAL</span>",
      results: "<span class='fo-brandmark fo-brand-nike'>NIKE</span>",
      contender: "<span class='fo-brandmark fo-brand-emirates'>Emirates</span>"
    };
    var cards = FO_FIN.sponsors.map(function (s) {
      var terms = s.lines.map(function (l) { return "<span>" + l + "</span>"; }).join("");
      return "<button type='button' class='fo-pk fo-pk-sp fo-tone-" + s.tone + " " + (FO_ONB.sponsor === s.id ? "on" : "") + "' data-sp='" + s.id + "'>" +
        marks[s.id] +
        "<span class='fo-pk-name'>" + s.name + "</span>" +
        "<span class='fo-sp-ind'>" + s.ind + "</span>" +
        "<span class='fo-sp-big'>" + FO$(s.base) + "<i>per matchday</i></span>" +
        "<span class='fo-sp-lines'>" + terms + "</span>" +
        "<span class='fo-sp-fine'>Term: 18 matchdays &middot; season 1</span></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>Your first big decision</div>" +
      "<h1 class='fo-ob-h1'>Three sponsors want your shirt</h1>" +
      "<p class='fo-ob-lead'>Each offer pays after every match, all season. The terms differ in how much of your money rides on results. The deal locks in for Season 1 and cannot be renegotiated.</p>" +
      "<div class='fo-pks'>" + cards + "</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'" + (FO_ONB.sponsor ? "" : " disabled") + ">Sign with " + (FO_ONB.sponsor ? foSponsorById(FO_ONB.sponsor).name : "&hellip;") + "</button></div></div>";
    var host = foOnbMount(3, body);
    host.querySelectorAll(".fo-pk").forEach(function (b) {
      b.addEventListener("click", function () {
        FO_ONB.sponsor = b.getAttribute("data-sp");
        host.querySelectorAll(".fo-pk").forEach(function (x) { x.classList.toggle("on", x === b); });
        var c2 = host.querySelector("#fo-ob-c");
        if (c2) { c2.disabled = false; c2.innerHTML = "Sign with " + E(foSponsorById(FO_ONB.sponsor).name); }
      });
    });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbMoney);
    host.querySelector("#fo-ob-c").addEventListener("click", function () {
      if (!FO_ONB.sponsor) { say("Pick a sponsor first. This deal pays you every matchday all season."); return; }
      foOnbPlayers();
    });
  }

  function startDraft(team) { foOnbStart(team); }

  // ---- squad shape + advisor -----------------------------------------------
  function foRoleShort(p) {
    if (p.keeper) return "WK";
    if (p.role === "allRounder") return "AR";
    if (p.bowlTypeFull ? p.bowlTypeFull !== "none" : p.bowlType) return foIsPace(p) ? "PACE" : "SPIN";
    return "BAT";
  }
  function foSquadShape(picked) {
    var bowl = 0, wk = 0, ar = 0, bat = 0;
    picked.forEach(function (p) {
      if (p.bowlTypeFull && p.bowlTypeFull !== "none") bowl++;
      if (p.keeper) wk++;
      if (p.role === "allRounder") ar++;
      else if (!(p.bowlTypeFull && p.bowlTypeFull !== "none") && !p.keeper) bat++;
    });
    return { n: picked.length, bowl: bowl, wk: wk, ar: ar, bat: bat };
  }
  function foSquadReady(picked) { var s = foSquadShape(picked); return s.n >= 11 && s.wk >= 1 && s.bowl >= 5; }
  function foAdvisor(picked, fc, styleId) {
    var s = foSquadShape(picked), out = [];
    if (s.wk < 1) out.push({ t: "warn", m: "No wicketkeeper yet — you need at least one." });
    if (s.bowl < 5) out.push({ t: "warn", m: "You have only " + s.bowl + " bowling options. Aim for at least 5 reliable ones." });
    if (fc.end < 0) out.push({ t: "danger", m: "Your wage bill is high — you are projected to lose money this season." });
    else if (fc.bankAfter >= 180000 && s.n >= 8) out.push({ t: "ok", m: "You have kept " + FO$(fc.bankAfter) + " back — room for injuries and mid-season signings." });
    if (fc.draftSpent > 900000) out.push({ t: "warn", m: "Under " + FO$(1000000 - fc.draftSpent) + " left in reserve — one bad month could sink you." });
    var pt = (FO_ONB && FO_ONB.pitch) || "balanced";
    if ((pt === "green" || pt === "cracked") && s.n >= 6 && picked.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && foIsPace(p); }).length < 3) out.push({ t: "info", m: "Your home pitch is " + foPitchName(pt).toLowerCase() + " — pace bowlers will love it. Consider drafting more seamers." });
    if (pt === "dry" && s.n >= 6 && picked.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !foIsPace(p); }).length < 2) out.push({ t: "info", m: "Your home pitch is crumbling — it will turn. Consider drafting more spinners." });
    var ce = null; for (var i = 0; i < picked.length; i++) { if (foDraftPrice(picked[i]) < 40000 && foDailyWage(picked[i]) >= 3200) { ce = picked[i]; break; } }
    if (ce) out.push({ t: "info", m: E(ce.name) + " is cheap to draft but expensive in wages." });
    if (!out.length && s.n >= 11) out.push({ t: "ok", m: "Squad is financially safe and legally shaped." });
    return out;
  }
  function foOnbPick(name) {
    var F = App.founder, p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === name) { p = F.pool[i]; break; }
    if (!p) return;
    var ix = F.picked.indexOf(p);
    var before = foSquadShape(F.picked);
    if (ix >= 0) { F.picked.splice(ix, 1); }
    else {
      var spent = F.picked.reduce(function (s, q) { return s + foDraftPrice(q); }, 0);
      if (spent + foDraftPrice(p) > FO_FIN.startingBank) { toast("Not enough budget left for " + p.name + " — " + FO$(FO_FIN.startingBank - spent) + " remaining.", "error"); return; }
      if (F.picked.length >= 16) { toast("Squad is full (16). Drop someone to sign " + p.name + ".", "error"); return; }
      F.picked.push(p);
      // milestone feedback: celebrate each squad requirement the moment it's met
      var after = foSquadShape(F.picked);
      if (before.wk === 0 && after.wk === 1) toast("Keeper secured — " + p.name + " takes the gloves.");
      else if (before.bowl === 4 && after.bowl === 5) toast("Five bowling options — you can cover all 50 overs.");
      else if (before.n === 10 && after.n === 11) toast("Eleven players — your XI is complete. Add depth or continue.");
      else if (after.n === 16) toast("Squad full — 16 players signed.");
    }
    if (!foDraftPatch(name)) foOnbDraft(true);
  }
  function foOrdinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function foTalentName(t) { return String(t || "").replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }).trim(); }
  // Aggregate skill (0-100) via the engine's own summary functions.
  function foAgg(p, nm) { try { return Math.max(0, Math.min(100, Math.round(({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField, end: aggEnd, tech: aggTech })[nm](p)))); } catch (e) { return 0; } }
  // The engine's skill word ("ordinary", "elite", "world class", …).
  function foWord(v) { try { return (typeof word === "function") ? word(v) : ""; } catch (e) { return ""; } }
  // Bar tone by value: weak -> red, ordinary -> amber, good -> teal, elite -> green.
  function foSkTone(v) { return v >= 75 ? "elite" : v >= 50 ? "good" : v >= 30 ? "mid" : "low"; }
  // The game's full 7-skill read-out (Batting/Bowling/Keeping/Endurance/
  // Technique/Power/Fielding), each a bar + the engine's word for it.
  function foSkillBars(p) {
    var isBowler = p.bowlTypeFull ? p.bowlTypeFull !== "none" : !!p.bowlType;
    var pw = 0; try { pw = (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) {}
    var bars = [["Batting", foAgg(p, "bat")], ["Bowling", isBowler ? foAgg(p, "bowl") : 0], ["Keeping", foAgg(p, "keep")],
      ["Endurance", foAgg(p, "end")], ["Technique", foAgg(p, "tech")], ["Power", Math.max(0, Math.min(100, Math.round(pw)))],
      ["Fielding", foAgg(p, "field")]];
    var tip = function (label) { try { return (typeof TIPS !== "undefined" && TIPS[label]) ? TIPS[label] : ""; } catch (e) { return ""; } };
    return "<div class='fo-dc-bars'>" + bars.map(function (b) {
      return "<span class='fo-db'><i title='" + E(tip(b[0])) + "'>" + b[0] + "</i><b><u class='fo-sk-" + foSkTone(b[1]) + "' style='width:" + b[1] + "%'></u></b><em>" + (foWord(b[1]) || b[1]) + "</em></span>";
    }).join("") + "</div>";
  }
  // One draft-room player card — the game's own card, in the brand theme.
  function foDraftCard(p, inSquad) {
    var nm = E(p.name).replace(/'/g, "&#39;");
    var bt = (typeof foBT === "function") ? foBT(p) : "";
    var meta = (p.hand === "L" ? "Left" : "Right") + " hand batsman" + (bt ? " | " + bt : "") + (p.expWord || p.exp ? " · exp " + E(p.expWord || p.exp) : "");
    var ttip = function (t) { try { return (typeof TALTIPS !== "undefined" && TALTIPS[t]) ? TALTIPS[t] : ""; } catch (e) { return ""; } };
    var tals = (p.talents || []).map(function (t) { return "<span class='fo-dc-tal' title='" + E(ttip(t)) + "'>" + E(foTalentName(t)) + "</span>"; }).join("");
    var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? foFlag(p.nat) : ""; } catch (e) {}
    return "<div class='fo-dc " + (inSquad ? "fo-dc-in" : "") + "'>" +
      "<div class='fo-dc-h'>" +
      "<span class='fo-rl'>" + foRoleShort(p) + "</span>" +
      (flag ? "<span class='fo-dc-flag'>" + flag + "</span>" : "") +
      "<b class='fo-dc-nm fo-dr-view' data-p='" + nm + "'>" + E(p.name) + (p.keeper ? " &dagger;" : "") + "</b>" +
      "<span class='fo-dc-meta'>" + E(p.nat || "") + " · age " + (p.age || "?") + " · rating <b>" + (p.rating ? p.rating.toLocaleString() : "-") + "</b></span>" +
      "<span class='fo-dc-fee'>" + FO$(foDraftPrice(p)) + "</span>" +
      "<button class='fo-dr-add " + (inSquad ? "on" : "") + "' data-p='" + nm + "'>" + (inSquad ? "Drop" : "Sign") + "</button>" +
      "</div>" +
      "<div class='fo-dc-sub'><span>" + meta + "</span>" + tals +
      "<span class='fo-dc-wage'>wage " + FO$(foDailyWage(p)) + "/day · season " + FO$(foSeasonCost(p)) + "</span></div>" +
      foSkillBars(p) + "</div>";
  }
  // A player's skill-summary card (bars, not a raw line) — opened by clicking a
  // name in the draft table.
  function foDraftDetail(name) {
    try {
      var F = App.founder, p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === name) { p = F.pool[i]; break; }
      if (!p) return;
      var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
      var agg = function (nm) { try { return Math.round(({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField, end: aggEnd, tech: aggTech })[nm](p)); } catch (e) { return 0; } };
      var pw = 0; try { pw = (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) {}
      var bars = [["Batting", agg("bat")], ["Bowling", isBowler ? agg("bowl") : 0], ["Keeping", agg("keep")], ["Fielding", agg("field")], ["Power", pw], ["Technique", agg("tech")], ["Endurance", agg("end")]];
      var word = function (v) { try { return typeof window.word === "function" ? window.word(v) : ""; } catch (e) { return ""; } };
      var barHtml = bars.map(function (b) { var v = Math.max(0, Math.min(100, Math.round(b[1] || 0))); return "<div class='fo-pd-bar'><span>" + b[0] + "</span><i><b class='fo-sk-" + foSkTone(v) + "' style='width:" + v + "%'></b></i><em>" + (word(v) || v) + "</em></div>"; }).join("");
      var talents = (p.talents || []).map(function (t) { var d = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; return "<span title='" + E(d) + "' style='text-decoration:underline dotted'>" + E(foTalentName(t)) + "</span>"; }).join(", ") || "None";
      var inSquad = F.picked.indexOf(p) >= 0;
      var host = document.getElementById("fo-onb"); if (!host) return;
      var old = document.getElementById("fo-pd"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-pd";
      d.innerHTML = "<div class='fo-pd-back'><div class='fo-pd-card'>" +
        "<div class='fo-pd-h'><div><div class='fo-pd-nm'>" + ((typeof foFlag === "function" && p.nat) ? foFlag(p.nat) + " " : "") + E(p.name) + "</div><div class='fo-pd-meta'><span class='fo-rl'>" + foRoleShort(p) + "</span> " + E(p.nat || "") + " · age " + (p.age || "?") + " · rating " + (p.rating || "-") + "</div></div><button class='fo-pd-x'>✕</button></div>" +
        "<div class='fo-pd-money'><span>Draft<b>" + FO$(foDraftPrice(p)) + "</b></span><span>Daily wage<b>" + FO$(foDailyWage(p)) + "</b></span><span>Season cost<b>" + FO$(foSeasonCost(p)) + "</b></span></div>" +
        "<div class='fo-pd-sec'>Skill summary</div><div class='fo-pd-bars'>" + barHtml + "</div>" +
        "<div class='fo-pd-tal'><b>Talents:</b> " + talents + "</div>" +
        "<div class='fo-pd-act'><button class='fo-pd-add " + (inSquad ? "on" : "") + "'>" + (inSquad ? "− Remove from squad" : "+ Add to squad") + "</button></div>" +
        "</div></div>";
      host.appendChild(d);
      d.querySelector(".fo-pd-x").addEventListener("click", function () { d.remove(); });
      d.querySelector(".fo-pd-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-pd-back")) d.remove(); });
      d.querySelector(".fo-pd-add").addEventListener("click", function () { foOnbPick(p.name); d.remove(); });
    } catch (e) {}
  }

  // ---- Screen 5 · Draft room with live finance forecast --------------------
  // ---- Screen 5 · Reading a player (tutorial before the draft) --------------
  function foOnbPlayers() {
    FO_ONB.step = 5;
    var pool = (App.founder && App.founder.pool) || [];
    var byRat = function (a, b) { return (b.rating || 0) - (a.rating || 0); };
    var batter = pool.filter(function (p) { return (!p.bowlTypeFull || p.bowlTypeFull === "none") && !p.keeper; }).sort(byRat)[0];
    var bowler = pool.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none"; }).sort(byRat)[0];
    var mkCard = function (ex, tagLbl) {
      if (!ex) return "";
      var flag = ""; try { flag = foFlag(ex.nat || FO_ONB.country) || ""; } catch (e) {}
      var hand = (ex.hand === "L" ? "LHB" : "RHB");
      var bt = ex.btLabel || ((ex.bowlTypeFull && ex.bowlTypeFull !== "none") ? ex.bowlTypeFull : "Does not bowl");
      var bars = [["Batting", foAgg(ex, "bat")], ["Bowling", (ex.bowlTypeFull && ex.bowlTypeFull !== "none") ? foAgg(ex, "bowl") : 0], ["Keeping", foAgg(ex, "keep")], ["Technique", foAgg(ex, "tech")], ["Power", foAgg(ex, "power") || Math.round((ex.skills && ex.skills.power) || 0)], ["Endurance", foAgg(ex, "end")], ["Fielding", foAgg(ex, "field")]];
      var barHtml = bars.map(function (b) { return "<span class='fo-sk'><i>" + b[0] + "</i><b><u class='fo-sk-" + foSkTone(b[1]) + "' style='width:" + b[1] + "%'></u></b><em>" + b[1] + "</em></span>"; }).join("");
      var tal = (ex.talents || []).map(function (t) { return "<span class='fo-exp-tal'>" + E(String(t).replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); })) + "</span>"; }).join("");
      return "<div class='fo-exp-card'><div class='fo-exp-tag'>" + tagLbl + "</div><div class='fo-exp-h'>" + flag + " <b>" + E(ex.name) + "</b></div>" +
        "<div class='fo-exp-meta'>" + hand + " &middot; " + E(bt) + " &middot; age " + ex.age + "</div>" +
        "<div class='fo-exp-money'><span>Fee <b>" + FO$(foDraftPrice(ex)) + "</b></span><span>Wage <b>" + FO$(foDailyWage(ex)) + "</b>/matchday</span></div>" +
        "<div class='fo-exp-bars'>" + barHtml + "</div>" +
        (tal ? "<div class='fo-exp-tals'>" + tal + "</div>" : "") + "</div>";
    };
    var defs = [
      ["Batting", "Run-scoring ability against all bowling."],
      ["Bowling", "Wicket threat and control with the ball. Zero means he does not bowl."],
      ["Keeping", "Glovework: byes saved, catches, stumpings."],
      ["Technique", "Overall polish. It correlates with everything but tracks his headline skill most: for a bowler, the accuracy and repeatability of his craft; for a batter, soundness against pace and spin. Temperament under pressure counts for everyone."],
      ["Power", "Boundary and six hitting."],
      ["Endurance", "How long he lasts before fatigue dulls everything."],
      ["Fielding", "Catches, run-outs, runs saved in the field."],
      ["Hand &amp; style", "RHB/LHB and the bowling arm and type (fast, fast medium, medium, finger spin, wrist spin). Batters have separate skills against pace and spin, so matchups are real."],
      ["Age", "Young players improve fastest in training and recover quickly. Players past 30 fade late in innings and long spells, and decline between seasons."],
      ["Fee &amp; wage", "The fee is paid once, at the draft. The wage is paid every matchday, all season. Better players cost more of both, so a full squad of stars will drain the bank."]
    ].map(function (d) { return "<div class='fo-exp-def'><b>" + d[0] + "</b><span>" + d[1] + "</span></div>"; }).join("");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>Know what you are buying</div>" +
      "<h1 class='fo-ob-h1'>How to read a player</h1>" +
      "<p class='fo-ob-lead'>Two real players from your draft pool, a batter and a bowler. Bars are coloured honestly: <b style='color:#C84F4A'>red</b> is a liability, <b style='color:#D9A441'>amber</b> does a job, <b style='color:#2d7a76'>teal</b> is good, <b style='color:#3E9960'>green</b> wins matches.</p>" +
      "<div class='fo-exp-cols'><div class='fo-exp-cards'>" + mkCard(batter, "The batter") + mkCard(bowler, "The bowler") + "</div><div class='fo-exp-defs'>" + defs + "</div></div>" +
      "<div class='fo-exp-talbox'><b>Talents</b> are permanent traits that fire in specific situations: a <i>Finisher</i> finds boundaries at the death, a <i>New-ball Specialist</i> is deadly in his first spell, a <i>Spin Killer</i> feasts on slow bowling. Tap any talent chip in the game to see what it does.</div>" +
      "<p class='fo-ob-lead' style='margin-top:14px'>Next: the draft room. Sign <b>11 to 16 players</b> with your <b>$1,000,000</b>. Every fee brings a wage bill behind it, so leave a reserve.</p>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Enter the draft room</button></div></div>";
    var host = foOnbMount(4, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbSponsor);
    host.querySelector("#fo-ob-c").addEventListener("click", function () { foOnbDraft(); });
  }

  // Re-render only what a signing changes: the player's own card, the sticky
  // budget strip, the side panels, the rail pills and the footer. Rails and
  // page scroll are untouched, so nothing jumps.
  function foDraftBucket(p) { var r = foRoleShort(p); return r === "WK" ? "wk" : r === "BAT" ? "bat" : r === "AR" ? "ar" : r === "PACE" ? "pace" : "spin"; }
  function foDraftWireCard(el) {
    el.querySelectorAll(".fo-dr-add").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    el.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
  }
  function foDraftStickyHtml(fc, shape) {
    var spentPct = Math.min(100, Math.round(fc.draftSpent / 10000));
    return "<div class='fo-dr-spent'><div class='fo-dr-spentl'><span>Spent <b>" + FO$(fc.draftSpent) + "</b> of $1,000,000</span><span><b>" + FO$(fc.bankAfter) + "</b> left</span></div>" +
      "<div class='fo-budgetbar'><u style='width:" + spentPct + "%'></u></div></div>" +
      "<div class='fo-dr-counts'><span class='fo-sh'><b>" + shape.n + "</b>/16</span><span class='fo-sh'><b>" + shape.bat + "</b> BAT</span><span class='fo-sh'><b>" + shape.bowl + "</b> BOWL</span><span class='fo-sh'><b>" + shape.ar + "</b> AR</span><span class='fo-sh'><b>" + shape.wk + "</b> WK</span></div>";
  }
  function foDraftSideHtml(F, shape, fc) {
    var advisor = foAdvisor(F.picked, fc, FO_ONB.style).map(function (a) { return "<div class='fo-adv fo-adv-" + a.t + "'>" + a.m + "</div>"; }).join("");
    return "<div class='fo-adv-panel'><div class='fo-adv-h'>Your squad &middot; " + shape.n + "/16</div>" +
      (F.picked.slice().sort(function (a, b) { return foDraftPrice(b) - foDraftPrice(a); }).map(function (p) {
        var nm = E(p.name).replace(/'/g, "&#39;");
        return "<div class='fo-sq-item'><span class='fo-rl'>" + foRoleShort(p) + "</span><b class='fo-dr-view' data-p='" + nm + "'>" + E(p.name) + "</b><em>" + FO$(foDraftPrice(p)) + "</em><button class='fo-sq-x' data-p='" + nm + "' title='Remove'>&#10005;</button></div>";
      }).join("") || "<div class='fo-sq-empty'>Empty. Swipe through the rails and sign players; they appear here.</div>") + "</div>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Advisor</div>" + (advisor || "<div class='fo-adv fo-adv-info'>Start adding players to see advice.</div>") + "</div>";
  }
  function foDraftPatch(playerName) {
    var host = document.getElementById("fo-onb"); if (!host || !host.querySelector(".fo-dr-sticky")) return false;
    var F = App.founder;
    var fc = foForecast(F.picked, FO_ONB.sponsor), shape = foSquadShape(F.picked);
    // 1. the toggled player's card, swapped in place
    if (playerName) {
      var p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === playerName) { p = F.pool[i]; break; }
      if (p) {
        var esc2 = E(playerName).replace(/'/g, "&#39;");
        var btn = host.querySelector(".fo-rail .fo-dr-add[data-p='" + esc2 + "']");
        var card = btn && btn.closest(".fo-dc");
        if (card) {
          var tmp = document.createElement("div");
          tmp.innerHTML = foDraftCard(p, F.picked.indexOf(p) >= 0);
          var fresh = tmp.firstChild;
          card.parentNode.replaceChild(fresh, card);
          foDraftWireCard(fresh);
        }
      }
    }
    // 2. sticky strip
    var st = host.querySelector(".fo-dr-sticky"); if (st) st.innerHTML = foDraftStickyHtml(fc, shape);
    // 3. side panels (+ rebind)
    var side = host.querySelector(".fo-dr-side");
    if (side) {
      side.innerHTML = foDraftSideHtml(F, shape, fc);
      side.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
      side.querySelectorAll(".fo-sq-x").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    }
    // 4. rail pills
    host.querySelectorAll(".fo-rail-sec").forEach(function (sec) {
      var rail = sec.querySelector(".fo-rail"); if (!rail) return;
      var k = rail.getAttribute("data-rail");
      var have = F.picked.filter(function (q) { return foDraftBucket(q) === k; }).length;
      var pill = sec.querySelector(".fo-rail-have");
      if (have && !pill) { pill = document.createElement("em"); pill.className = "fo-rail-have"; sec.querySelector(".fo-rail-h").appendChild(pill); }
      if (pill) { if (have) pill.textContent = have + " signed"; else pill.remove(); }
    });
    // 5. footer: continue button + requirements note
    var ready = foSquadReady(F.picked);
    var c = host.querySelector("#fo-ob-c"); if (c) c.disabled = !ready;
    var needs = host.querySelector(".fo-dr-needs");
    if (!ready && !needs) {
      needs = document.createElement("div"); needs.className = "fo-dr-needs";
      needs.textContent = "Need 11+ players, a keeper and 5+ bowling options to continue.";
      var wrapEl = host.querySelector(".fo-ob-draftwrap"); if (wrapEl) wrapEl.appendChild(needs);
    } else if (ready && needs) needs.remove();
    return true;
  }
  function foOnbDraft(keepScroll) {
    FO_ONB.step = 6;
    // preserve every rail's swipe position and the page scroll across re-renders
    var _rails = {}, _pageY = 0;
    try {
      _pageY = (document.getElementById("fo-onb") || {}).scrollTop || 0;
      document.querySelectorAll(".fo-rail").forEach(function (r) { _rails[r.getAttribute("data-rail")] = r.scrollLeft; });
    } catch (e) {}
    var F = App.founder;
    var fc = foForecast(F.picked, FO_ONB.sponsor);
    var shape = foSquadShape(F.picked);
    var byRat = function (a, b) { return (b.rating || 0) - (a.rating || 0); };
    var RAILS = [
      ["wk", "Wicketkeepers", "Every XI needs one behind the stumps"],
      ["bat", "Batters", "Your top order lives here"],
      ["ar", "All-rounders", "Bat and ball; the glue of a squad"],
      ["pace", "Pace bowlers", "New-ball and death overs"],
      ["spin", "Spinners", "Grip and squeeze through the middle"]
    ];
    var bucket = function (p) { var r = foRoleShort(p); return r === "WK" ? "wk" : r === "BAT" ? "bat" : r === "AR" ? "ar" : r === "PACE" ? "pace" : "spin"; };
    var railsHtml = RAILS.map(function (rl) {
      var players = F.pool.filter(function (p) { return bucket(p) === rl[0]; }).sort(byRat);
      if (!players.length) return "";
      var cards = players.map(function (p) { return foDraftCard(p, F.picked.indexOf(p) >= 0); }).join("");
      var have = F.picked.filter(function (p) { return bucket(p) === rl[0]; }).length;
      return "<div class='fo-rail-sec'><div class='fo-rail-h'><b>" + rl[1] + "</b><span>" + rl[2] + "</span>" +
        (have ? "<em class='fo-rail-have'>" + have + " signed</em>" : "") + "</div>" +
        "<div class='fo-rail' data-rail='" + rl[0] + "'>" + cards + "</div></div>";
    }).join("");
    var spentPct = Math.min(100, Math.round(fc.draftSpent / 10000));
    var ready = foSquadReady(F.picked);
    var advisor = foAdvisor(F.picked, fc, FO_ONB.style).map(function (a) { return "<div class='fo-adv fo-adv-" + a.t + "'>" + a.m + "</div>"; }).join("");

    var body =
      "<div class='fo-ob-draftwrap'>" +
      "<div class='fo-dr-head'><div><div class='fo-ob-eyebrow'>Draft room &middot; " + E(FO_ONB.clubName) + "</div><h1 class='fo-ob-h1'>Build your squad</h1></div></div>" +
      "<div class='fo-dr-sticky'><div class='fo-dr-spent'><div class='fo-dr-spentl'><span>Spent <b>" + FO$(fc.draftSpent) + "</b> of $1,000,000</span><span><b>" + FO$(fc.bankAfter) + "</b> left</span></div>" +
      "<div class='fo-budgetbar'><u style='width:" + spentPct + "%'></u></div></div>" +
      "<div class='fo-dr-counts'><span class='fo-sh'><b>" + shape.n + "</b>/16</span><span class='fo-sh'><b>" + shape.bat + "</b> BAT</span><span class='fo-sh'><b>" + shape.bowl + "</b> BOWL</span><span class='fo-sh'><b>" + shape.ar + "</b> AR</span><span class='fo-sh'><b>" + shape.wk + "</b> WK</span></div></div>" +
      "<div class='fo-dr-grid'>" +
      "<div class='fo-dr-main'>" + railsHtml + "</div>" +
      "<div class='fo-dr-side'>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Your squad &middot; " + shape.n + "/16</div>" +
      (F.picked.slice().sort(function (a, b) { return foDraftPrice(b) - foDraftPrice(a); }).map(function (p) {
        var nm = E(p.name).replace(/'/g, "&#39;");
        return "<div class='fo-sq-item'><span class='fo-rl'>" + foRoleShort(p) + "</span><b class='fo-dr-view' data-p='" + nm + "'>" + E(p.name) + "</b><em>" + FO$(foDraftPrice(p)) + "</em><button class='fo-sq-x' data-p='" + nm + "' title='Remove'>&#10005;</button></div>";
      }).join("") || "<div class='fo-sq-empty'>Empty. Swipe through the rails and sign players; they appear here.</div>") + "</div>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Advisor</div>" + (advisor || "<div class='fo-adv fo-adv-info'>Start adding players to see advice.</div>") + "</div>" +
      "</div></div>" +
      "<div class='fo-ob-act fo-dr-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c' " + (ready ? "" : "disabled") + ">Continue &#8594; Board report</button></div>" +
      (ready ? "" : "<div class='fo-dr-needs'>Need 11+ players, a keeper and 5+ bowling options to continue.</div>") +
      "</div>";
    var host = foOnbMount(5, body);
    if (keepScroll) requestAnimationFrame(function () {
      try {
        host.scrollTop = _pageY;
        host.querySelectorAll(".fo-rail").forEach(function (r) { var k = r.getAttribute("data-rail"); if (_rails[k]) r.scrollLeft = _rails[k]; });
      } catch (e) {}
    });
    host.querySelectorAll(".fo-dr-add").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    host.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
    host.querySelectorAll(".fo-sq-x").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbPlayers);
    var c = host.querySelector("#fo-ob-c"); if (c) c.addEventListener("click", foOnbAfterDraft);
  }

  function foOnbAfterDraft() {
    if (!foSquadReady(App.founder.picked)) return;
    var fc = foForecast(App.founder.picked, FO_ONB.sponsor);
    var bad = foForecast(App.founder.picked, FO_ONB.sponsor, "bad");
    if ((fc.end < 0 || bad.end < -60000) && !FO_ONB.riskAck) { foOnbRisk(fc); return; }
    foOnbReport();
  }

  // ---- Screen 6 · Risk warning ---------------------------------------------
  function foOnbRisk(fc) {
    FO_ONB.step = 5;
    var body =
      "<div class='fo-ob-card fo-ob-narrow fo-ob-risk'>" +
      "<div class='fo-risk-ic'>" + FO_I("warn", 26) + "</div>" +
      "<h1 class='fo-ob-h1'>This squad is projected to finish the season at <span class='fo-risk-amt'>" + FO$s(fc.end) + "</span>.</h1>" +
      "<p class='fo-ob-lead'>You can continue, but your club may face:</p>" +
      "<ul class='fo-ob-list fo-risk-list'><li>Forced player releases</li><li>Blocked signings</li><li>Supporter mood drop</li></ul>" +
      "<label class='fo-ob-check'><input type='checkbox' id='fo-ob-ack' " + (FO_ONB.riskAck ? "checked" : "") + "> I understand the risk</label>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-revise'>Revise squad</button><button class='fo-ob-cta fo-cta-danger' id='fo-ob-cont' disabled>Continue anyway</button></div></div>";
    var host = foOnbMount(5, body);
    var ack = host.querySelector("#fo-ob-ack"), cont = host.querySelector("#fo-ob-cont");
    var sync = function () { FO_ONB.riskAck = ack.checked; cont.disabled = !ack.checked; };
    ack.addEventListener("change", sync); sync();
    host.querySelector("#fo-ob-revise").addEventListener("click", function () { foOnbDraft(); });
    cont.addEventListener("click", function () { FO_ONB.riskAck = true; foOnbReport(); });
  }

  // ---- Screen 7 · Season 1 Board Report ------------------------------------
  function foOnbReport() {
    FO_ONB.step = 6;
    var F = App.founder, fc = foForecast(F.picked, FO_ONB.sponsor);
    var sp = foSponsorById(FO_ONB.sponsor);
    var shape = foSquadShape(F.picked);
    var avg = function (arr) { return arr.length ? Math.round(arr.reduce(function (s, v) { return s + v; }, 0) / arr.length) : 0; };
    var topN = function (vals, n) { return vals.sort(function (a, b) { return b - a; }).slice(0, n); };
    var batStr = avg(topN(F.picked.map(function (p) { return foAgg(p, "bat"); }), 7));
    var bowlStr = avg(topN(F.picked.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none"; }).map(function (p) { return foAgg(p, "bowl"); }), 6));
    var fieldStr = avg(F.picked.map(function (p) { return foAgg(p, "field"); }));
    var keepStr = avg(topN(F.picked.filter(function (p) { return p.keeper; }).map(function (p) { return foAgg(p, "keep"); }), 1));
    var starsOf = function (v) { return v >= 78 ? 5 : v >= 66 ? 4 : v >= 54 ? 3 : v >= 40 ? 2 : 1; };
    var starRow = function (l, v) {
      var n = starsOf(v), tone = foSkTone(v), s = "";
      for (var i = 0; i < 5; i++) s += "<i class='fo-seg fo-segt-" + tone + (i < n ? " on" : "") + "'></i>";
      return "<div class='fo-str-row'><span>" + l + "</span><span class='fo-segs'>" + s + "</span></div>";
    };
    var fact = function (l, v) { return "<div class='fo-fact'><span>" + l + "</span><b>" + v + "</b></div>"; };
    var body =
      "<div class='fo-ob-card fo-ob-report'>" +
      "<div class='fo-br-cols'><div class='fo-br-main'>" +
      "<div class='fo-br-head'><span class='fo-br-crest'><img src='" + APPICON + "' alt=''></span><div><div class='fo-ob-eyebrow'>Season 1</div><h1 class='fo-ob-h1'>Board Report</h1></div></div>" +
      "<div class='fo-facts'>" +
      fact("Squad", shape.n + " players") +
      fact("Balance", shape.bat + " BAT &middot; " + shape.bowl + " BOWL &middot; " + shape.ar + " AR &middot; " + shape.wk + " WK") +
      fact("Sponsor", E(sp.name)) +
      fact("Bank", FO$(fc.bankAfter)) +
      fact("First matchday", "9:00 AM ET") + "</div>" +
      "<div class='fo-br-closure'><p>The paperwork is done. Your name is on the office door, " + E(sp.name) + "&rsquo;s name is on the shirts, and out past the pavilion the groundsman is rolling your " + E(foPitchName(FO_ONB.pitch || "balanced").toLowerCase()) + " pitch flat for the first morning.</p>" +
      "<p>From here it is cricket: one match every day, eighteen rounds, nine other managers who want what you want. Pick your eleven, trust your judgement, and enjoy every ball.</p>" +
      "<p class='fo-br-luck'>Good luck, " + E((SYNC && SYNC.me && SYNC.me.display_name) || "manager") + ". The season starts now.</p></div>" +
      "</div><aside class='fo-br-side'>" +
      "<div class='fo-clubprev' style='margin-bottom:0'><div class='fo-clubprev-crest'>" + E(FO_ONB.clubName.split(/\s+/).map(function (w) { return w[0] || ""; }).join("").slice(0, 3).toUpperCase()) + "</div>" +
      "<div class='fo-clubprev-nm'>" + E(FO_ONB.clubName) + "</div>" +
      "<div class='fo-clubprev-sub'>" + (function () { try { return foFlag(FO_ONB.country) || ""; } catch (e) { return ""; } })() + " " + E(FO_ONB.country || "") + " &middot; " + E(FO_ONB.ground) + "</div>" +
      "<div class='fo-clubprev-sub'>Founded " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) + "</div></div>" +
      "<div class='fo-br-panel' style='flex:1'><div class='fo-br-ph'>Squad strength</div>" +
      starRow("Batting", batStr) + starRow("Bowling", bowlStr) + starRow("Fielding", fieldStr) + starRow("Keeping", keepStr) + "</div>" +
      "</aside></div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back to draft</button><button class='fo-ob-cta' id='fo-ob-done'>Enter the League</button></div></div>";
    var host = foOnbMount(6, body);
    host.querySelector("#fo-ob-b").addEventListener("click", function () { foOnbDraft(); });
    host.querySelector("#fo-ob-done").addEventListener("click", foOnbCommit);
  }

  // ---- Screen 8 · commit + hand off to the real club home ------------------
  function foOnbCommit() {
    try {
      var F = App.founder;
      F.name = FO_ONB.clubName; App.founder.identity = "Founding XI";
      var fc = foForecast(F.picked, FO_ONB.sponsor);
      // remember the onboarding choices + a flag so we never show this flow again
      try {
        window.store("fo_onb_done", "1"); window.store("fo_sponsor", FO_ONB.sponsor);
        window.store("fo_ground", FO_ONB.ground); window.store("fo_pitch", FO_ONB.pitch);
      } catch (e) {}
      var _bank = Math.round(fc.bankAfter);
      // let the engine build the real club record, then re-point finance at the
      // brief's model ($1M is draft + operating money) and store the sponsor.
      var _confirm = window.founderConfirm;
      window.founderConfirm();                         // builds GD.teams[teamIx] + uploads (existing wrapper)
      try {
        var t = GD.teams[App.teamIx];
        if (t) { t.ground = FO_ONB.ground || t.ground; t.sponsor = FO_ONB.sponsor; t.homePitch = FO_ONB.pitch || "balanced"; t.bank = _bank; }
        var _deal = foSponsorById(FO_ONB.sponsor);
        t.sponsorDeal = { id: _deal.id, base: _deal.base, win: _deal.win, halfway: _deal.halfway, seasonTop3: _deal.seasonTop3, champ: _deal.champ };
        if (App.fin) { App.fin.bank = _bank; App.fin.sponsorBase = _deal.base; }
        if (typeof window.saveGame === "function") window.saveGame(false);
      } catch (e) {}
      foOnbClose();
      // the existing post-confirm flow (showWait / club home) now owns the screen
    } catch (e) { say(e); foOnbClose(); }
  }

  // relabel the confirm button to "Start Season" while in league draft mode
  if (typeof window.pgFounder === "function") {
    var _pg = window.pgFounder;
    window.pgFounder = function () {
      var out = _pg.apply(this, arguments);
      try {
        if (App.founder && App.founder.__league) {
          var b = document.querySelector("#page .confirmbtn");
          if (b) b.textContent = "Confirm my squad";
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
            // Season already running? No waiting room — take over a bot club and play.
            if (SYNC && SYNC.started && !(SYNC.isFounder)) { foJoinRunningSeason(club); return; }
            showWait(true);
          }).catch(say);
        } catch (e) { say(e); }
      }
      return out;
    };
  }

  // Splice my freshly-drafted club into the RUNNING season by taking over a bot
  // club: the bot's identity is renamed to my club everywhere in the snapshot
  // (fixtures, table, results), then its record is replaced with my squad.
  function foJoinRunningSeason(club) {
    openWrap(true); foLoading("Joining the season…");
    sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round").then(function (a) {
      var st = a[0];
      if (!st || !st.snapshot || !st.snapshot.teams) { showWait(true); return; }
      var snap = st.snapshot;
      var already = snap.teams.some(function (t) { return t && t.name === club.name; });
      var target = already ? club.name : null;
      if (!target) {
        var bots = snap.teams.filter(function (t) { return t && !t.founded; });
        if (!bots.length) { say("The league is already full of human clubs — ask your commissioner to restart the season to fit you in."); showWait(true); return; }
        // take over the bottom-most bot (least disruption to the title race)
        var bot = bots[bots.length - 1];
        target = bot.name;
      }
      var raw = JSON.stringify(snap);
      if (target !== club.name) raw = raw.split(JSON.stringify(target).slice(1, -1)).join(JSON.stringify(club.name).slice(1, -1));
      var s2 = JSON.parse(raw);
      var ix = s2.teams.findIndex(function (t) { return t && t.name === club.name; });
      if (ix < 0) { showWait(true); return; }
      club.founded = true;
      s2.teams[ix] = club;
      return rpc("member_push_state", { p_league_id: LG.id, p_snapshot: s2, p_round: st.round || 0 }).then(function (ver) {
        SYNC.lastVersion = typeof ver === "number" ? ver : (st.version + 1);
        SYNC.started = true;
        applySnapshot(s2, true);
      });
    }).catch(function (e) {
      var msg = ((e && e.message) || e) + "";
      if (/Could not find the function|member_push_state/i.test(msg)) {
        say("Squad locked in! Ask your commissioner to hit 'Restart season' to bring your club in (or run the 0013 SQL to enable instant joining).");
      } else say(e);
      showWait(true);
    });
  }

  // ---- Smarter "Suggest all" bowling attack ---------------------------------
  // The stock suggestOrders() hands every bowler a flat 5-over spell. Real
  // captaincy reads the pitch and weather, leans on the bowlers those conditions
  // suit, and rotates them through varied 2-5 over spells (best bowlers bowl the
  // most). We build a full 50-over plan honouring the engine's rules (each end is
  // its own over-set, no bowler two overs running, max 10 each) and derive the
  // north/south spells from it — exactly the shape the engine expects.
  function foCapDist(n) {
    // n bowler caps summing to 50, each 2..10, biased so the top names bowl more.
    var w = 0, i, caps = [];
    for (i = 0; i < n; i++) { caps[i] = 0; w += (n - i); }
    for (i = 0; i < n; i++) caps[i] = Math.max(2, Math.min(10, Math.round(50 * (n - i) / w)));
    var sum = function () { return caps.reduce(function (a, b) { return a + b; }, 0); };
    var guard = 0;
    while (sum() < 50 && guard++ < 500) { // top up the best available bowlers first
      var up = -1; for (i = 0; i < n; i++) if (caps[i] < 10) { up = i; break; }
      if (up < 0) break; caps[up]++;
    }
    guard = 0;
    while (sum() > 50 && guard++ < 500) { // trim from the weakest first
      var dn = -1; for (i = n - 1; i >= 0; i--) if (caps[i] > 2) { dn = i; break; }
      if (dn < 0) break; caps[dn]--;
    }
    return caps;
  }
  // Split a bowler's over allocation into varied 2-5 chunks, never stranding a 1.
  function foChunks(c) {
    var out = [], pat = [3, 2, 4, 3, 5, 2], pi = 0;
    while (c > 0) {
      var L = Math.min(pat[pi++ % pat.length], 5, c);
      if (c - L === 1) L = (L - 1 >= 2) ? L - 1 : c;
      L = Math.max(1, L);
      out.push(L); c -= L;
    }
    return out;
  }
  // Round-robin the bowlers' chunks into a spell order so no two consecutive
  // spells share a bowler (keeps them as distinct spells; within one end the overs
  // are two apart, so this is never a back-to-back match over).
  function foInterleave(mains, chunks) {
    var order = [], idx = {}, last = null, guard = 0;
    mains.forEach(function (m) { idx[m] = 0; });
    var left = function (m) { return chunks[m].length - idx[m]; };
    while (guard++ < 400) {
      var avail = mains.filter(function (m) { return left(m) > 0 && m !== last; });
      if (!avail.length) avail = mains.filter(function (m) { return left(m) > 0; });
      if (!avail.length) break;
      avail.sort(function (x, y) { return left(y) - left(x); });
      var m = avail[0];
      order.push({ bowler: m, n: chunks[m][idx[m]++] });
      last = m;
    }
    return order;
  }
  // Swap apart any two neighbouring spells that share a bowler (which would merge
  // into one over-long spell), preserving each bowler's total.
  function foDeAdjacent(order) {
    for (var i = 1; i < order.length; i++) {
      if (order[i].bowler !== order[i - 1].bowler) continue;
      for (var j = i + 1; j < order.length; j++) {
        if (order[j].bowler !== order[i - 1].bowler && (i + 1 >= order.length || order[j].bowler !== order[i + 1].bowler)) {
          var t = order[i]; order[i] = order[j]; order[j] = t; break;
        }
      }
    }
    return order;
  }
  function foSmartBowling() {
    // App/userTeam/isPT are const bindings in the engine realm (not on window);
    // typeClass/pickXI/pgOrders are function declarations. All resolve bare here.
    if (typeof App === "undefined" || typeof userTeam !== "function" || typeof pickXI !== "function" || typeof typeClass !== "function") return foOrigSuggest();
    var t = userTeam(), xi = pickXI(t);
    var bs = xi.filter(function (p) { return p.bowlType && !isPT(p); });
    if (bs.length < 5) return foOrigSuggest();      // need 5+ to cover 50 legally

    // ---- batting order built for the CONDITIONS, not the roster sheet ----
    var pend0 = App.pending || {}, pitch0 = pend0.pitch || "balanced";
    var wx0 = String(pend0.weather || "").toLowerCase();
    var newBallBites = pitch0 === "green" || pitch0 === "cracked" || /overcast|humid|misty|drizzle/.test(wx0);
    var turnLater = pitch0 === "dry" || pitch0 === "slow" || pitch0 === "twoPaced";
    var SK = function (p) { try { return (typeof S === "function") ? S(p) : (p.skills || {}); } catch (e) { return p.skills || {}; } };
    var tHas = function (p, tl) { return (p.talents || []).indexOf(tl) >= 0; };
    var shade = function (p, s) {
      s *= 0.90 + 0.033 * (p.formIx == null ? 3 : p.formIx);
      var fr = { "clinically dead": 0.72, shattered: 0.76, exhausted: 0.80, listless: 0.85, weary: 0.90, moderate: 0.94, satisfactory: 0.97 }[String(p.fatigue || "rested").toLowerCase()];
      return fr ? s * fr : s;
    };
    var openScore = function (p) {   // survive the new ball
      var k = SK(p);
      var s = (newBallBites ? 0.55 : 0.45) * (k.vsPace || 0) + 0.25 * (k.temperament || 0) + 0.15 * (k.rotation || 0) + 0.05 * (k.vsSpin || 0);
      if (tHas(p, "fastStarter")) s += 7;
      if (tHas(p, "anchor")) s += 5;
      if (tHas(p, "newBallSpecialist")) s -= 4;    // save frontline bowlers' legs
      return shade(p, s);
    };
    var midScore = function (p) {    // own the middle overs
      var k = SK(p);
      var spinW = turnLater ? 0.42 : 0.30;
      var s = (0.72 - spinW) * (k.vsPace || 0) + spinW * (k.vsSpin || 0) + 0.18 * (k.rotation || 0) + 0.10 * (k.temperament || 0);
      if (tHas(p, "anchor")) s += 4;
      if (tHas(p, "spinKiller") && turnLater) s += 7;
      return shade(p, s);
    };
    var finScore = function (p) {    // hit at the death
      var k = SK(p);
      var s = 0.50 * (k.power || 0) + 0.22 * (k.temperament || 0) + 0.18 * (k.rotation || 0) + 0.10 * (k.vsPace || 0);
      if (tHas(p, "finisher")) s += 9;
      if (tHas(p, "sixMachine")) s += 6;
      return shade(p, s);
    };
    var pool2 = xi.slice(), orderNames = [];
    var takeBest = function (fn) {
      pool2.sort(function (a, b) { return fn(b) - fn(a); });
      var p2 = pool2.shift(); if (p2) orderNames.push(p2.name); return p2;
    };
    takeBest(openScore); takeBest(openScore);                 // openers
    takeBest(midScore); takeBest(midScore); takeBest(midScore); // 3-5
    takeBest(finScore); takeBest(finScore);                   // 6-7 finishers
    // tail: remaining by plain batting, best first
    pool2.sort(function (a, b) { return (b.bat || 0) - (a.bat || 0); });
    pool2.forEach(function (p2) { orderNames.push(p2.name); });
    App.orders.batOrder = orderNames;
    // captain: the XI's best leader — captaincy skill first, experience as tiebreak
    var cap = xi.slice().sort(function (a, b) {
      return ((b.capt || 0) + (b.exp || 0) * 0.25) - ((a.capt || 0) + (a.exp || 0) * 0.25);
    })[0] || xi[0];
    App.orders.captain = cap.name;
    App.orders.keeper = (xi.find(function (p) { return p.keeper; }) || xi[0]).name;

    // Read the fixture's pitch + weather (App.pending is the next match's meta).
    var pend = App.pending || {}, pitch = pend.pitch || "balanced";
    var wx = String(pend.weather || "").toLowerCase();
    var seamPitch = pitch === "green" || pitch === "cracked" || pitch === "twoPaced";
    var seamWx = /overcast|humid|drizzle|dew|swing/.test(wx);
    var spinPitch = pitch === "dry" || pitch === "slow" || pitch === "cracked";
    var isPace = function (p) { return typeClass(p.bowlType) === "pace"; };
    var isSpin = function (p) { return typeClass(p.bowlType) === "spin"; };
    var has = function (p, tl) { return (p.talents || []).indexOf(tl) >= 0; };
    var score = function (p) {
      var s = 0.55 * (p.threat || 0) + 0.45 * (p.control || 0);
      // form (0-6, 3 = steady) and fatigue shade the ranking
      s *= 0.90 + 0.033 * (p.formIx == null ? 3 : p.formIx);
      var fr = { "clinically dead": 0.72, shattered: 0.76, exhausted: 0.80, listless: 0.85, weary: 0.90, moderate: 0.94, satisfactory: 0.97 }[String(p.fatigue || "rested").toLowerCase()];
      if (fr) s *= fr;
      if (isPace(p) && (seamPitch || seamWx)) s += 12;
      if (isSpin(p) && spinPitch) s += 12;
      if (has(p, "newBallSpecialist")) s += 6;
      if (has(p, "deathSpecialist")) s += 4;
      return s;
    };
    var ranked = bs.slice().sort(function (a, b) { return score(b) - score(a); });
    var paceOf = {}; bs.forEach(function (p) { paceOf[p.name] = isPace(p); });
    var caps = {}, capArr = foCapDist(ranked.length);
    ranked.forEach(function (p, i) { caps[p.name] = capArr[i]; });

    // Partition the bowlers into DISJOINT north/south groups (each covering its 25
    // overs), so no bowler is at both ends and back-to-back overs are impossible.
    // Pace bowlers are placed first and spread across the two ends so each powerplay
    // can open with seam; the one "straddler" that may span both ends tends to be a
    // spinner and is kept out of the powerplay (north death + south middle).
    var nc = {}, sc = {}, nSum = 0, sSum = 0, straddler = null;
    var ordered = ranked.filter(function (p) { return paceOf[p.name]; }).concat(ranked.filter(function (p) { return !paceOf[p.name]; }));
    ordered.forEach(function (p) {
      var nm = p.name, c = caps[nm], take;
      if (nSum <= sSum) {                                   // fill the emptier end first
        if (nSum + c <= 25) { nc[nm] = c; nSum += c; }
        else { take = 25 - nSum; if (take > 0) { nc[nm] = take; nSum = 25; } sc[nm] = c - take; sSum += c - take; straddler = nm; }
      } else {
        if (sSum + c <= 25) { sc[nm] = c; sSum += c; }
        else { take = 25 - sSum; if (take > 0) { sc[nm] = take; sSum = 25; } nc[nm] = c - take; nSum += c - take; straddler = nm; }
      }
    });
    if (nSum !== 25 || sSum !== 25) return foOrigSuggest();               // couldn't tile 25/25
    if (straddler && (nc[straddler] > 5 || sc[straddler] > 5)) return foOrigSuggest(); // rare

    var byName = {}; bs.forEach(function (p) { byName[p.name] = p; });
    var spells = { north: [], south: [] };
    [["north", nc, 1], ["south", sc, 2]].forEach(function (E) {
      var end = E[0], counts = {}, first = E[2], k;
      for (k in E[1]) counts[k] = E[1][k];                   // clone (we deduct as we lay spells)
      var overs = []; for (var o = first; o <= 50; o += 2) overs.push(o);
      var strN = straddler && counts[straddler] ? counts[straddler] : 0;

      // Powerplay (this end's first 5 overs = match overs ≤10): cover it with seam.
      var paceMains = Object.keys(counts).filter(function (n) { return n !== straddler && paceOf[n] && counts[n] > 0; })
        .sort(function (a, b) {
          var nb = (has(byName[b], "newBallSpecialist") ? 1 : 0) - (has(byName[a], "newBallSpecialist") ? 1 : 0);
          return nb || (score(byName[b]) - score(byName[a]));
        });
      var order = [], ppCovered = 0, lastPP = null;
      while (ppCovered < 5) {
        var cand = paceMains.filter(function (n) { return counts[n] > 0 && n !== lastPP; });
        if (!cand.length) break;
        var pk = cand[0], need = 5 - ppCovered, L = Math.min(counts[pk], 5);
        if (L > need) L = Math.max(need, 2);
        if (counts[pk] - L === 1) L = Math.max(2, L - 1);
        order.push({ bowler: pk, n: L }); counts[pk] -= L; ppCovered += L; lastPP = pk;
      }

      // Remaining overs: chunk what's left (spin welcome now) and interleave.
      var restMains = Object.keys(counts).filter(function (n) { return n !== straddler && counts[n] > 0; });
      var chunks = {}; restMains.forEach(function (n) { chunks[n] = foChunks(counts[n]); });
      order = order.concat(foInterleave(restMains, chunks));

      if (strN) {
        var sp = { bowler: straddler, n: strN };
        if (end === "north") { order.push(sp); }             // straddler bowls the death at north
        else {                                               // and the middle at south (never the powerplay)
          var cum = 0, ins = order.length, m;
          for (m = 0; m < order.length; m++) { cum += order[m].n; if (cum >= 5) { ins = m + 1; break; } }
          order.splice(ins, 0, sp);
        }
      }
      order = foDeAdjacent(order);
      // death overs (each end's final spell): hand them to the best death bowler
      var deathScore = function (n) {
        var p3 = byName[n]; if (!p3) return -1;
        var k3 = (typeof S === "function") ? S(p3) : (p3.skills || {});
        return (has(p3, "deathSpecialist") ? 40 : 0) + 0.5 * (k3.economy || 0) + 0.3 * (k3.variation || 0) + 0.2 * (k3.discipline || 0);
      };
      var bestIx = -1, bestVal = -1;
      for (var di = 1; di < order.length - 1; di++) {         // keep the PP head intact
        var v = deathScore(order[di].bowler);
        if (v > bestVal && order[di].bowler !== order[order.length - 1].bowler) { bestVal = v; bestIx = di; }
      }
      if (bestIx > 0 && order.length > 2 && bestVal > deathScore(order[order.length - 1].bowler)) {
        var sp2 = order.splice(bestIx, 1)[0];
        if (order[order.length - 1].bowler !== sp2.bowler) order.push(sp2);
        else order.splice(order.length - 1, 0, sp2);
        order = foDeAdjacent(order);
      }

      var oi = 0;
      order.forEach(function (sp) {
        var f = overs[oi];
        spells[end].push({ bowler: sp.bowler, first: f, n: sp.n, field: f <= 10 ? "att" : (f >= 41 ? "def" : "bal") });
        oi += sp.n;
      });
    });
    if (!spells.north.length || !spells.south.length) return foOrigSuggest();
    App.orders.spells = spells;
    App.orders.grid = null;                          // let the grid reseed from the new plan
    try { pgOrders(); } catch (e) {}
  }
  // The engine dates rounds a week apart (its solo roots). This league plays
  // one round per day at 9:00 AM ET: round dates anchor to TODAY's round.
  try {
    if (typeof fo55RoundDate === "function") {
      var _foRD = fo55RoundDate;
      fo55RoundDate = function (roundNo) {
        try {
          var cur = (typeof App !== "undefined" && App.season) ? App.season.round : 0;
          var d = new Date(); d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + (roundNo - cur));
          return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
        } catch (e) { return _foRD(roundNo); }
      };
      window.fo55RoundDate = fo55RoundDate;
    }
  } catch (e) {}

  var foOrigSuggest = window.suggestOrders;
  if (typeof foOrigSuggest === "function") {
    window.suggestOrders = function () { try { return foSmartBowling(); } catch (e) { return foOrigSuggest(); } };
  }
  // Swap the engine's Club home for the premium branded dashboard.
  var foOrigClub = window.pgClub;
  if (typeof foOrigClub === "function") window.pgClub = foPremiumClub;

  // Multiplayer-first: the league login takes over the moment the site loads,
  // and the page behind it is locked so the solo game stays private until you
  // are in a league — then your game IS the league. A saved session is restored
  // first, so a refresh keeps you logged in.
  var _authRedirect = foConsumeAuthHash();
  openWrap(true);
  foLoading("Signing you in…");
  if (_authRedirect === "ok") { enterApp(); }
  else if (_authRedirect === "error") { renderLogin(); setTimeout(function () { say("That email link expired or was already used. Log in with your email and password below."); }, 60); }
  else restoreSession().then(function () { if (JWT) enterApp(); else renderLogin(); }).catch(function () { renderLogin(); });

  // ===========================================================================
  //  TRAINING & YOUTH SCOUTING (From-the-Pavilion-style)
  //  The engine already carries the training MODEL (weighted programs, potential
  //  tiers, age/fatigue/academy factors, progress thresholds) — this adds the UI
  //  and the multiplayer plumbing: choices ride the order packet (fo_training /
  //  fo_youth) and the resolver applies them even-handedly for every club.
  // ===========================================================================
  var FO_TR_PROGS = ["Batting", "New-ball batting", "Spin batting", "Power hitting", "Finishing",
    "Bowling", "New-ball seam", "Spin bowling", "Death bowling", "Control bowling",
    "Keeping", "Fielding", "Fitness", "All-rounder", "Rest"];
  var FO_TR_INT = ["Light", "Normal", "Intense", "Rest"];
  var FO_TR_PROGMAP = {
    "Batting": { vsPace: 25, vsSpin: 25, rotation: 20, temperament: 20, stamina: 10 },
    "New-ball batting": { vsPace: 45, temperament: 25, rotation: 15, stamina: 15 },
    "Spin batting": { vsSpin: 45, rotation: 20, temperament: 20, power: 15 },
    "Power hitting": { power: 50, vsPace: 15, vsSpin: 15, temperament: 10, stamina: 10 },
    "Finishing": { power: 35, temperament: 25, rotation: 20, vsPace: 10, vsSpin: 10 },
    "Bowling": { wicket: 25, economy: 25, discipline: 20, moveTurn: 15, variation: 10, stamina: 5 },
    "New-ball seam": { moveTurn: 30, wicket: 25, discipline: 20, economy: 15, stamina: 10 },
    "Spin bowling": { moveTurn: 30, wicket: 25, variation: 20, economy: 15, discipline: 10 },
    "Death bowling": { economy: 30, discipline: 30, variation: 20, stamina: 15, wicket: 5 },
    "Control bowling": { economy: 40, discipline: 30, variation: 15, stamina: 15 },
    "Keeping": { keeping: 30, catching: 25, stumping: 25, fielding: 15, stamina: 5 },
    "Fielding": { fielding: 40, catching: 30, stamina: 20, power: 10 },
    "Fitness": { stamina: 65, power: 25, fielding: 10 },
    "All-rounder": { vsPace: 15, vsSpin: 15, wicket: 15, economy: 15, fielding: 20, stamina: 20 },
    "Rest": {}
  };
  function foTrKey() { return "fol_train_" + (LG ? LG.id : "solo"); }
  function foTrainState() {
    var raw = lsGet(foTrKey()), s = null;
    try { s = JSON.parse(raw || "null"); } catch (e) {}
    if (!s || typeof s !== "object") s = {};
    if (!s.training) s.training = {};
    if (!s.youthPending) s.youthPending = [];
    if (s.lastSignRound == null) s.lastSignRound = -99;
    return s;
  }
  function foTrainSave(s) { lsSet(foTrKey(), JSON.stringify(s)); }
  function foIsPace(p) {
    if (!p) return false;
    if (p.bowlTypeFull && p.bowlTypeFull !== "none") return /seam/i.test(p.bowlTypeFull);
    try { return typeClass(p.bowlType) === "pace"; } catch (e) { return false; }
  }
  // West Indies has no national emoji/flag: use the canonical cricket look,
  // a palm tree on an island against maroon, wherever the WI flag appears.
  var FO_WI_FLAG = "data:image/svg+xml," + encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 40'>" +
    "<rect width='60' height='40' rx='3' fill='#7B1F3A'/>" +
    "<circle cx='20' cy='15' r='8' fill='#F4A61D'/>" +
    "<path d='M12 35c9-3 27-3 36 0v5H12z' fill='#E8D9A0'/>" +
    "<path d='M37 34c1-6 0-11-2-15l4-1c2 5 2 11 1 16z' fill='#6B4A2B'/>" +
    "<path d='M38 18c-7-4-13-3-17 1 7 0 12 1 17 2z' fill='#2F7A3D'/>" +
    "<path d='M38 18c7-4 13-3 17 1-7 0-12 1-17 2z' fill='#2F7A3D'/>" +
    "<path d='M38 18c-5-6-10-8-15-6 5 2 10 4 15 8z' fill='#3E9960'/>" +
    "<path d='M38 18c5-6 10-8 15-6-5 2-10 4-15 8z' fill='#3E9960'/>" +
    "<path d='M38 18c0-7-2-11-7-13 2 4 4 9 7 13z' fill='#2F7A3D'/>" +
    "</svg>");
  function foWIFlagImg() { return '<img class="foflag" src="' + FO_WI_FLAG + '" alt="West Indies" title="West Indies">'; }
  // overlay render sites go through this wrapper; engine-rendered pages are
  // swept by foFixWIFlags() on every route
  try {
    var _foFlagOrig = (typeof foFlag === "function") ? foFlag : null;
    window.foFlag = function (nat) {
      if (/west indies/i.test((nat || "") + "")) return foWIFlagImg();
      return _foFlagOrig ? _foFlagOrig.apply(this, arguments) : "";
    };
    foFlag = window.foFlag;
  } catch (e) {}
  function foFixWIFlags() {
    try {
      document.querySelectorAll('img.foflag[title="West Indies"]').forEach(function (i) {
        if (i.getAttribute("src") !== FO_WI_FLAG) i.src = FO_WI_FLAG;
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foFixWIFlags, 80); });

  function foMyClub() { try { return GD.teams[App.teamIx]; } catch (e) { return null; } }
  function foTrDefault(p) {
    if (p.keeper) return "Keeping";
    if (p.role === "allRounder") return "All-rounder";
    if (p.bowlTypeFull && p.bowlTypeFull !== "none") return foIsPace(p) ? "New-ball seam" : "Spin bowling";
    return p.role === "middleOrderBat" ? "Finishing" : "Batting";
  }
  function foTrOf(p) {
    var st = foTrainState(), o = st.training[p.name] || {};
    return {
      program: o.program || (p.training && p.training.program) || foTrDefault(p),
      intensity: o.intensity || (p.training && p.training.intensity) || "Normal"
    };
  }
  function foPotential(p) {
    if (p.training && p.training.potential) return p.training.potential;
    var v = ((p.talent === "gifted" || (p.talents || []).length >= 2) ? 2 : 0) + (p.age <= 20 ? 2 : p.age <= 24 ? 1 : 0) + ((p.rating || 0) > 3600 ? 1 : 0);
    return v >= 4 ? "Star" : v >= 3 ? "High" : v >= 1 ? "Useful" : "Limited";
  }
  var FO_SKILL_LABELS = { vsPace: "vs pace", vsSpin: "vs spin", rotation: "strike rotation", temperament: "temperament", power: "power", stamina: "stamina", wicket: "wicket threat", economy: "economy", discipline: "discipline", moveTurn: "movement/turn", variation: "variation", keeping: "keeping", catching: "catching", stumping: "stumping", fielding: "fielding" };
  function foSkillLabel(k) { return FO_SKILL_LABELS[k] || k; }
  function foTrProgress(p) {
    // best progress toward the next +1 across the player's trained skills
    var tr = p.training || {}, prog = tr.progressBySkill || {}, best = 0, bestSk = "";
    for (var sk in prog) {
      var th = 80 + ((p.skills && p.skills[sk]) || 0) * 1.5;
      var pc = 100 * (prog[sk] || 0) / th;
      if (pc > best) { best = pc; bestSk = sk; }
    }
    if (!bestSk) {
      var w = FO_TR_PROGMAP[foTrOf(p).program] || {};
      var ks = Object.keys(w).sort(function (a, b) { return (w[b] || 0) - (w[a] || 0); });
      bestSk = ks[0] || "stamina";
    }
    return { skill: bestSk, pct: Math.min(99, Math.round(best)) };
  }
  function foSetTraining(name, field, value) {
    var st = foTrainState();
    st.training[name] = st.training[name] || {};
    st.training[name][field] = value;
    foTrainSave(st);
    // apply locally so the squad/office pages reflect it immediately
    try {
      var t = foMyClub(), p = t && t.players.find(function (x) { return x.name === name; });
      if (p) {
        if (!p.training) p.training = { program: null, intensity: "Normal", progressBySkill: {} };
        if (field === "program") { p.training.program = value; p.trainFocus = value; }
        else p.training.intensity = value;
        if (typeof window.saveGame === "function") window.saveGame(false);
      }
    } catch (e) {}
  }
  // Reapply my saved choices whenever a fresh snapshot lands (the snapshot only
  // carries choices the resolver has already seen).
  function foReapplyTraining() {
    try {
      var st = foTrainState(), t = foMyClub(); if (!t) return;
      for (var nm in st.training) {
        var p = t.players.find(function (x) { return x.name === nm; }); if (!p) continue;
        if (!p.training) p.training = { program: null, intensity: "Normal", progressBySkill: {} };
        if (st.training[nm].program) { p.training.program = st.training[nm].program; p.trainFocus = st.training[nm].program; }
        if (st.training[nm].intensity) p.training.intensity = st.training[nm].intensity;
      }
      // youth + market: drop pending signings that made it into the squad
      var before = st.youthPending.length + (st.marketPending || []).length;
      st.youthPending = st.youthPending.filter(function (y) { return !t.players.find(function (x) { return x.name === y.name; }); });
      st.marketPending = (st.marketPending || []).filter(function (y) { return !t.players.find(function (x) { return x.name === y.name; }); });
      if (st.youthPending.length + st.marketPending.length !== before) { foTrainSave(st); toast("Your new signing has joined the squad."); }
    } catch (e) {}
  }

  // ---- youth scouting: deterministic shortlist of 18-20 year olds ------------
  function foScoutSeed() {
    var r = (App.season && App.season.round) || 0;
    var t = foMyClub();
    return (LG ? LG.id : "solo") + "-scout-" + ((t && t.name) || "club") + "-" + r;
  }
  function foScoutList() {
    var t = foMyClub(); if (!t) return [];
    var country = (SYNC && SYNC.myTeam && SYNC.myTeam.country) || "England";
    var pool = [];
    try { pool = buildCountryPool(foScoutSeed(), country); } catch (e) { return []; }
    var young = pool.filter(function (p) { return (p.age || 99) <= 20 && !t.players.find(function (x) { return x.name === p.name; }); });
    young.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    // a keeper or bowler among the three when possible, for useful variety
    var picks = [], used = {};
    var take = function (p) { if (p && !used[p.name] && picks.length < 3) { used[p.name] = 1; picks.push(p); } };
    take(young.find(function (p) { return p.keeper; }));
    take(young.find(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && !p.keeper; }));
    young.forEach(take);
    return picks.map(function (p) {
      var q = JSON.parse(JSON.stringify(p));
      q.fee = Math.max(8000, Math.round(foDraftPrice(p) * 0.75 / 500) * 500);   // raw youth come cheaper
      return q;
    });
  }
  var FO_SCOUT_COOLDOWN = 3;   // matchdays between signings
  function foSignYouth(cand) {
    var st = foTrainState(), t = foMyClub(); if (!t) return;
    var round = (App.season && App.season.round) || 0;
    if (st.youthPending.length) { say("You already have a signing awaiting confirmation — it completes after the next matchday."); return; }
    if (round - st.lastSignRound < FO_SCOUT_COOLDOWN) { say("Your scout needs " + (FO_SCOUT_COOLDOWN - (round - st.lastSignRound)) + " more matchday(s) before the next signing."); return; }
    if ((t.players || []).length >= 18) { say("Squad is full (18) — release someone first."); return; }
    var bank = (App.fin && App.fin.bank) || t.bank || 0;
    if (bank < cand.fee) { say("Not enough in the bank — the signing fee is " + FO$(cand.fee) + "."); return; }
    foConfirm({
      title: "Sign " + cand.name + "?",
      body: "Age " + cand.age + " · " + foRoleShort(cand) + " · " + FO$(cand.fee) + " signing fee, then " + FO$(foDailyWage(cand)) + "/matchday wages. Young players train the fastest in the game.",
      confirm: "Sign " + cand.name.split(" ")[0], cancel: "Not yet"
    }).then(function (ok) {
      if (!ok) return;
      st.lastSignRound = round;
      st.youthPending = [cand];
      foTrainSave(st);
      if (SYNC && SYNC.started && !SYNC.practice) {
        toast(cand.name + " agreed terms — the signing completes after the next matchday.");
      } else {
        // solo / practice: apply immediately through the engine's own books
        try {
          var p = JSON.parse(JSON.stringify(cand)); delete p.fee;
          p.fatigue = "rested"; p.formIx = 3;
          t.players.push(p);
          if (typeof window.ledger === "function" && window.ledger.length >= 3) window.ledger("Transfer", "Youth signing: " + p.name, -cand.fee);
          else if (typeof window.ledger === "function") window.ledger("Youth signing: " + p.name, -cand.fee);
          else if (App.fin) App.fin.bank -= cand.fee;
          st.youthPending = []; foTrainSave(st);
          if (typeof window.saveGame === "function") window.saveGame(false);
          toast(cand.name + " joins the squad!");
        } catch (e) { say(e); }
      }
      foTrainingPage();
    });
  }

  // Full detail card for a scouted youngster (same layout as the draft popover).
  function foYouthDetail(p, isMarket) {
    if (!p) return;
    var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var pw = 0; try { pw = (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) {}
    var bars = [["Batting", foAgg(p, "bat")], ["Bowling", isBowler ? foAgg(p, "bowl") : 0], ["Keeping", foAgg(p, "keep")], ["Fielding", foAgg(p, "field")], ["Power", Math.round(pw)], ["Technique", foAgg(p, "tech")], ["Endurance", foAgg(p, "end")]];
    var barHtml = bars.map(function (b) { var v = Math.max(0, Math.min(100, Math.round(b[1] || 0))); return "<div class='fo-pd-bar'><span>" + b[0] + "</span><i><b class='fo-sk-" + foSkTone(v) + "' style='width:" + v + "%'></b></i><em>" + (foWord(v) || v) + "</em></div>"; }).join("");
    var talents = (p.talents || []).map(function (t) { var d = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; return "<span title='" + E(d) + "' style='text-decoration:underline dotted'>" + E(foTalentName(t)) + "</span>"; }).join(", ") || "None";
    var bt = (typeof foBT === "function") ? foBT(p) : "";
    var old = document.getElementById("fo-pd"); if (old) old.remove();
    var d = document.createElement("div"); d.id = "fo-pd";
    d.innerHTML = "<div class='fo-pd-back'><div class='fo-pd-card'>" +
      "<div class='fo-pd-h'><div><div class='fo-pd-nm'>" + ((typeof foFlag === "function" && p.nat) ? foFlag(p.nat) + " " : "") + E(p.name) + "</div><div class='fo-pd-meta'><span class='fo-rl'>" + foRoleShort(p) + "</span> " + E(p.nat || "") + " · age " + (p.age || "?") + (bt ? " · " + E(bt) : "") + " · exp " + E(p.expWord || p.exp || "-") + "</div></div><button class='fo-pd-x'>&#10005;</button></div>" +
      "<div class='fo-pd-money'><span>Signing fee<b>" + FO$(p.fee) + "</b></span><span>Daily wage<b>" + FO$(foDailyWage(p)) + "</b></span><span>Season wages<b>" + FO$(foDailyWage(p) * FO_FIN.seasonLength) + "</b></span></div>" +
      "<div class='fo-pd-sec'>Skill summary</div><div class='fo-pd-bars'>" + barHtml + "</div>" +
      "<div class='fo-pd-tal'><b>Talents:</b> " + talents + "</div>" +
      "<div class='fo-pd-act'><button class='fo-pd-add'>Sign " + E(p.name.split(" ")[0]) + " &mdash; " + FO$(p.fee) + "</button></div>" +
      "</div></div>";
    document.body.appendChild(d);
    d.querySelector(".fo-pd-x").addEventListener("click", function () { d.remove(); });
    d.querySelector(".fo-pd-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-pd-back")) d.remove(); });
    d.querySelector(".fo-pd-add").addEventListener("click", function () { d.remove(); if (isMarket) foMarketClaim(p); else foSignYouth(p); });
  }

  // ===========================================================================
  //  TRANSFER MARKET — computer-generated free agents, one shared pool per
  //  league. Claims are first-come-first-served through the database (0014);
  //  the roster change itself rides the order packet (fo_market) and is
  //  applied by the resolver after the fair money settle.
  // ===========================================================================
  function foMarketPool() {
    var t = foMyClub(); if (!t) return [];
    var season = (typeof App !== "undefined" && App.seasonNo) || 1;
    var seed = (LG ? LG.id : "solo") + "-market-s" + season;
    var out = [], seen = {};
    var countries = [(SYNC && SYNC.myTeam && SYNC.myTeam.country) || "England", "Australia", "India", "South Africa", "New Zealand", "West Indies"];
    for (var c = 0; c < countries.length; c++) {
      var pool = [];
      try { pool = buildCountryPool(seed + "-" + countries[c], countries[c]); } catch (e) { continue; }
      pool.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
      // one of each trade per country, so the market isn't 18 copies of the
      // engine's highest-rated archetype (spinners): bat, seam, spin, keep/AR
      var got = {};
      for (var i = 0; i < pool.length; i++) {
        var p = pool[i];
        if ((p.age || 0) < 21 || seen[p.name]) continue;
        var cls = p.keeper ? "keep"
          : (p.bowlTypeFull && p.bowlTypeFull !== "none")
            ? (foIsPace(p) ? "pace" : "spin")
            : "bat";
        if (got[cls]) continue;
        got[cls] = 1; seen[p.name] = 1;
        var q = JSON.parse(JSON.stringify(p));
        q.fee = Math.max(10000, Math.round(foDraftPrice(p) * 1.15 / 500) * 500);   // mid-season premium
        out.push(q);
        if (got.bat && got.pace && got.spin && got.keep) break;
      }
    }
    out.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    return out.slice(0, 18);
  }
  function foMarketPage() {
    var page = document.getElementById("page"); if (!page) return;
    var t = foMyClub();
    if (!t || !t.players || !t.players.length) { page.innerHTML = "<div class='crumb'>Transfers</div><div class='panel'><h4>Transfer market</h4><div class='pad'>No squad yet — finish your draft first.</div></div>"; return; }
    var pool = foMarketPool();
    var renderList = function (claims) {
      var byName = {}; (claims || []).forEach(function (c) { byName[c.player_name] = c; });
      var st = foTrainState();
      var pendingNames = {}; (st.marketPending || []).forEach(function (m) { pendingNames[m.name] = 1; });
      var bank = (App.fin && App.fin.bank) || t.bank || 0;
      var cards = pool.map(function (p, i) {
        var claim = byName[p.name];
        var mine = claim && SYNC && SYNC.myMid && claim.manager_id === SYNC.myMid;
        var pending = pendingNames[p.name];
        var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? foFlag(p.nat) : ""; } catch (e) {}
        var bars = [["Bat", foAgg(p, "bat")], [(p.keeper ? "Keep" : "Bowl"), p.keeper ? foAgg(p, "keep") : ((p.bowlTypeFull && p.bowlTypeFull !== "none") ? foAgg(p, "bowl") : 0)], ["Field", foAgg(p, "field")]];
        var barHtml = bars.map(function (b) { return "<span class='fo-sk'><i>" + b[0] + "</i><b><u class='fo-sk-" + foSkTone(b[1]) + "' style='width:" + b[1] + "%'></u></b><em>" + b[1] + "</em></span>"; }).join("");
        var act;
        if (claim) act = "<div class='fo-mk-gone'>" + (mine ? "Joining your club" : "Signed by <b>" + E(claim.club) + "</b>") + "</div>";
        else if (pending) act = "<div class='fo-mk-gone'>Joining after next matchday</div>";
        else act = "<button class='fo-yc-sign fo-mk-claim' data-i='" + i + "'" + (bank < p.fee ? " disabled title='Not enough in the bank'" : "") + ">Sign — " + FO$(p.fee) + "</button>";
        return "<div class='fo-yc" + (claim ? " fo-mk-claimed" : "") + "'>" +
          "<div class='fo-yc-h'>" + flag + " <b class='fo-mk-view' data-i='" + i + "'>" + E(p.name) + "</b></div>" +
          "<div class='fo-yc-meta'>" + foRoleShort(p) + " · age " + p.age + " · rating " + (p.rating || 0).toLocaleString() + "</div>" +
          "<div class='fo-yc-bars'>" + barHtml + "</div>" +
          "<div class='fo-yc-money'><span>Fee <b>" + FO$(p.fee) + "</b></span><span>Wage <b>" + FO$(foDailyWage(p)) + "/day</b></span></div>" + act + "</div>";
      }).join("");
      page.innerHTML =
        "<div class='crumb'>" + E(t.name) + " &raquo; Transfers</div>" +
        "<div class='page-head'><div><div class='eyebrow'>Free agents</div><h1>Transfer market</h1><p>One shared pool for the whole league — when a club signs a player, they're gone for everyone. First come, first served.</p></div></div>" +
        "<div class='panel'><h4>Available this season</h4><div class='pad'>" +
        "<div class='fo-yc-note'>Bank: <b>" + FO$(bank) + "</b> · Squad: <b>" + t.players.length + "/18</b>. Signings join your squad after the next matchday resolves.</div>" +
        "<div class='fo-ycs'>" + cards + "</div></div></div>";
      page.querySelectorAll(".fo-mk-claim").forEach(function (b) { b.addEventListener("click", function () { foMarketClaim(pool[+b.getAttribute("data-i")]); }); });
      page.querySelectorAll(".fo-mk-view").forEach(function (b) { b.addEventListener("click", function () { foYouthDetail(pool[+b.getAttribute("data-i")], true); }); });
    };
    if (SYNC && SYNC.started && !SYNC.practice && LG) {
      sel("league_market", "league_id=eq." + LG.id + "&select=player_name,club,manager_id").then(renderList).catch(function () { renderList([]); });
    } else renderList([]);
  }
  function foMarketClaim(p) {
    var t = foMyClub(); if (!t || !p) return;
    if ((t.players || []).length >= 18) { say("Squad is full (18) — release someone first."); return; }
    var bank = (App.fin && App.fin.bank) || t.bank || 0;
    if (bank < p.fee) { say("Not enough in the bank — the fee is " + FO$(p.fee) + "."); return; }
    foConfirm({
      title: "Sign " + p.name + "?",
      body: "Age " + p.age + " · " + foRoleShort(p) + " · " + FO$(p.fee) + " transfer fee, then " + FO$(foDailyWage(p)) + "/matchday wages. First club to sign gets the player.",
      confirm: "Sign — " + FO$(p.fee), cancel: "Not yet"
    }).then(function (ok) {
      if (!ok) return;
      if (SYNC && SYNC.started && !SYNC.practice && LG) {
        rpc("market_claim", { p_league_id: LG.id, p_player_name: p.name, p_player: p, p_price: p.fee, p_club: t.name })
          .then(function () {
            var st = foTrainState();
            (st.marketPending = st.marketPending || []).push(p);
            foTrainSave(st);
            toast(p.name + " is yours! The signing completes after the next matchday.");
            foMarketPage();
          })
          .catch(function (e) {
            var msg = ((e && e.message) || e) + "";
            if (/already claimed/i.test(msg)) { toast("Too slow — another club signed " + p.name + " first.", "error"); foMarketPage(); }
            else if (/Could not find the function|market_claim/i.test(msg)) say("The transfer market needs the 0014 SQL run in Supabase first (ask your commissioner).");
            else say(e);
          });
      } else {
        // solo/practice: instant
        try {
          var q = JSON.parse(JSON.stringify(p)); delete q.fee;
          q.fatigue = "rested"; q.formIx = 3;
          t.players.push(q);
          if (typeof window.ledger === "function" && window.ledger.length >= 3) window.ledger("Transfer", "Signed " + q.name, -p.fee);
          else if (App.fin) App.fin.bank -= p.fee;
          if (typeof window.saveGame === "function") window.saveGame(false);
          toast(p.name + " joins the squad!");
          foMarketPage();
        } catch (e) { say(e); }
      }
    });
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderMarket, 15); });
  function foRenderMarket() {
    if (!/^#\/transfers/.test(location.hash || "")) return;
    try { bumpBrand(); } catch (e) {}
    try { foMarketPage(); } catch (e) { console.warn("foMarketPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-transfers")); });
    } catch (e) {}
  }


  // ===========================================================================
  //  GAME MANUAL — how everything works, in one place (#/guide).
  // ===========================================================================
  function foManualSec(id, title, body) {
    return "<details id='man-" + id + "'" + (id === "basics" ? " open" : "") + "><summary>" + title + "</summary><div class='fo-man-b'>" + body + "</div></details>";
  }
  function foManualPage() {
    var page = document.getElementById("page"); if (!page) return;
    var secs = [
      ["basics", "Welcome to the league", [
        "<p>Fifty Overs is a private cricket management league for ten clubs. You run one; friends run the others, and the computer manages any club that has not been claimed yet. There are no purchases or boosts. Results come from three inputs: the squad you draft, the budget you manage, and the orders you submit each matchday.</p>",
        "<p>The league plays <b>one matchday every day at " + MATCH_TIME + "</b>. Between matchdays, the game is yours: study the next opponent, pick your XI, plan who bowls when, set the week&rsquo;s training, chase a signing. When the clock strikes, every fixture in the round is played at once by the match engine, using exactly what each manager submitted. If you submit nothing, an automatic lineup is used. It is reasonable, but it does not know your plans.</p>",
        "<p>Matches are full 50-over contests simulated ball by ball. Batters score more freely once set, bowlers lose effectiveness through long spells, and a rising required rate increases the chance of wickets in a chase. Every attribute on a player&rsquo;s card affects the simulation, along with form, fatigue, experience and age.</p>",
        "<div class='fo-man-tip'><b>The five-minute day:</b> read the result and your training report, glance at the table, open the next fixture, set your lineup, adjust one or two training programs. That is the whole routine. Doing it daily is the single biggest factor in finishing higher.</div>"
      ].join("")],
      ["club", "Founding your club", [
        "<p>Your story starts with a <b>$1,000,000 founding grant</b> and an empty dressing room. The draft is where most titles are quietly won or lost, so hold three thoughts as you spend:</p>",
        "<ul><li><b>Eleven jobs, not eleven stars.</b> A functional XI needs six or seven capable batters, a genuine wicketkeeper, and at least five bowling options to cover fifty overs. Squads short on bowling lose matches they would otherwise win.</li>",
        "<li><b>Money spent is wages promised.</b> Every dollar of fee brings a wage bill behind it, due every single matchday. Spending the entire grant on fees leaves nothing for the wage bill or the transfer market. Keep a reserve.</li>",
        "<li><b>Draft for your ground.</b> Half your matches are at home, and you choose what your groundsman prepares:</li></ul>",
        "<table><tr><th>Pitch</th><th>What it plays like</th><th>Build around it</th></tr>" +
        "<tr><td><b>Balanced</b></td><td>An honest surface. Skill decides.</td><td>No bias. Pick the best players you can.</td></tr>" +
        "<tr><td><b>Green</b></td><td>The ball nips around, brutally so with the new ball.</td><td>Stack seamers; pick batters who can survive the first ten.</td></tr>" +
        "<tr><td><b>Crumbling</b></td><td>Starts fine, turns square as the ball ages.</td><td>Two or three spinners, and batters who play spin well.</td></tr>" +
        "<tr><td><b>Flat</b></td><td>Heavily favours batting. Par is around 300.</td><td>Power hitters, and bowlers who don&rsquo;t crumble when hit.</td></tr>" +
        "<tr><td><b>Slow</b></td><td>Low, gripping, boundaries die in the outfield.</td><td>Patient batters who run hard; cutters and spin.</td></tr>" +
        "<tr><td><b>Sticky</b></td><td>Unpredictable bounce. High wicket rates for all bowler types.</td><td>Batting depth; a capable batter at eight.</td></tr>" +
        "<tr><td><b>Two-paced</b></td><td>Uneven pace off the surface; timing is difficult.</td><td>Patient batters; cutters and change-ups.</td></tr></table>",
        "<p>The pitch applies to both sides in every home game, so build a squad that benefits from it more than visitors do.</p>"
      ].join("")],
      ["players", "Reading a player", [
        "<p>Open any player and you&rsquo;ll find seven core skills for batters (how they play <b>pace</b> and <b>spin</b>, how they <b>rotate strike</b>, their <b>temperament</b>, raw <b>power</b>, <b>endurance</b> and <b>fielding</b>) and, for bowlers, the tools of the trade: <b>wicket-taking threat</b>, <b>economy</b>, <b>discipline</b>, <b>movement or turn</b>, <b>variation</b>, <b>stamina</b>. Hover any label in the game for what it does. Bars are coloured honestly: <b style='color:#C84F4A'>red</b> is a liability, <b style='color:#D9A441'>amber</b> does a job, teal is good, and <b style='color:#3E9960'>green</b> wins matches.</p>",
        "<p>But the card only starts there. Four quieter things decide whether the skills show up on the day:</p>",
        "<ul><li><b>Form</b> rises and falls with performances. A fifty lifts a batter; three cheap dismissals hollow him out. An in-form 70-rated batter will frequently outscore an out-of-form 85. Check form before every selection; it&rsquo;s the most ignored column in the game.</li>",
        "<li><b>Fatigue</b> is a ladder of words, from <i>rested</i> down through <i>weary</i> and <i>listless</i> to the ominous <i>clinically dead</i>. Tired batters find fielders; tired bowlers serve up half-volleys. Playing a shattered star is usually worse than playing a fresh squad player. Stamina and youth slow the slide; the Rest program reverses it.</li>",
        "<li><b>Experience</b> is invisible until the game gets tense: a big chase, wickets down, the death overs. That&rsquo;s when experienced players keep their heads and rookies play the shot they&rsquo;ll regret. An experienced middle-order batter measurably reduces collapse risk in tight games.</li>",
        "<li><b>Age</b> shapes everything: young players learn fast in training and run all day, but the game&rsquo;s pressure moments expose them. Players past thirty tire faster: older batters decline late in long innings, and older bowlers lose effectiveness late in long spells.</li></ul>",
        "<p><b>Talents</b> are permanent traits that apply in specific situations:</p>",
        "<table><tr><th>Talent</th><th>When it bites</th></tr>" +
        "<tr><td><b>Finisher</b></td><td>Finds boundaries at the death that others can&rsquo;t.</td></tr>" +
        "<tr><td><b>Anchor</b></td><td>Hard to dismiss while an innings is being built.</td></tr>" +
        "<tr><td><b>Six Machine</b></td><td>Clears the rope when given licence to swing.</td></tr>" +
        "<tr><td><b>Fast Starter</b></td><td>Skips the nervous new-batter phase.</td></tr>" +
        "<tr><td><b>Spin Killer / Pace Hunter</b></td><td>Feasts on that bowling type.</td></tr>" +
        "<tr><td><b>New-ball Specialist</b></td><td>Significantly more dangerous in the opening spell.</td></tr>" +
        "<tr><td><b>Death Specialist</b></td><td>Keeps his nerve (and his yorker) in the last ten.</td></tr>" +
        "<tr><td><b>Partnership Breaker</b></td><td>Strikes when a stand is getting comfortable.</td></tr>" +
        "<tr><td><b>Mystery Ball</b></td><td>A spinner new batters simply can&rsquo;t read.</td></tr>" +
        "<tr><td><b>Miser</b></td><td>Bowls a higher share of dot balls.</td></tr></table>"
      ].join("")],
      ["orders", "Matchday orders", [
        "<p>Open <b>Matches</b> and hit <b>Set lineup</b> on your next fixture. This is the heart of the game, and there is real craft in it:</p>",
        "<ul><li><b>The XI.</b> Balance first: a keeper, enough bowling for fifty overs, batting depth for the pitch you&rsquo;re on. Then form and freshness: bench the exhausted, back the in-form.</li>",
        "<li><b>Batting order.</b> Openers face the hardest overs, so send technique and temperament, not just talent. Your best player bats three or four, where he faces enough balls to matter. Save a finisher and some muscle for six and seven. Batting a keeper too high burns him for the fielding innings.</li>",
        "<li><b>Bowling plan.</b> Seamers are at their most dangerous with the new ball; the first ten overs are theirs. Spinners grip harder as the ball roughens; the middle overs are where they squeeze and strike. Death overs favour bowlers with the Death Specialist talent, good economy and variation. Schedule your fifth bowler&rsquo;s overs in the quietest phase, usually overs 25 to 40.</li>",
        "<li><b>Intent.</b> Per phase, you choose how hard to push. Aggression buys boundaries and sells wickets; caution does the reverse. Higher aggression suits flat pitches; caution early suits green ones. Because set batters score much faster than new ones, keeping wickets in hand early usually raises the final total.</li>",
        "<li><b>Captain.</b> Give it to experience and captaincy skill, not to your best batter by default. Captaincy skill improves fielding pressure across the whole innings on both sides of the ball.</li>",
        "<li><b>Keeper.</b> Keeping skill reduces byes and increases catches and stumpings. A weak keeper costs several runs and chances per match.</li></ul>",
        "<div class='fo-man-tip'><b>Chasing?</b> The engine models scoreboard pressure honestly: a chase that stays near the rate feels normal, but let the required rate climb past eight and every ball gets heavier, especially against experienced bowlers, and especially for inexperienced batters. Keep chases close to the required rate throughout; plans that rely on late acceleration fail more often than they succeed.</div>"
      ].join("")],
      ["pitchwx", "Pitch, weather &amp; the toss", [
        "<p>Before every match you can see the ground, the pitch and the sky. Read them like a real captain would:</p>",
        "<table><tr><th>Sky</th><th>What it means</th></tr>" +
        "<tr><td><b>Sunny / Hot / Scorching</b></td><td>A batting day. The hotter it gets, the truer the ball comes on.</td></tr>" +
        "<tr><td><b>Overcast / Misty</b></td><td>Seamers&rsquo; weather. The ball hoops around, especially early; expect 20&ndash;30 fewer runs and jittery top orders.</td></tr>" +
        "<tr><td><b>Humid</b></td><td>The new ball talks for the seamers, then it fades. Survive the burst.</td></tr>" +
        "<tr><td><b>Windy</b></td><td>Sixes die at the rope. Run twos instead of swinging harder.</td></tr>" +
        "<tr><td><b>Drizzle / Chilly</b></td><td>Slow, scrappy cricket. Boundaries are earned.</td></tr>" +
        "<tr><td><b>Dew later</b></td><td>In the second innings the ball is harder to grip: spinners are less effective and chasing becomes easier. If dew is forecast, bowling first is statistically favourable.</td></tr></table>",
        "<p>The toss is decided automatically. You do not control it, but pitch choice and weather both shift the balance of the fixture, and the forecast is shown on the order screen before you commit a lineup.</p>"
      ].join("")],
      ["money", "Money: the honest ledger", [
        "<p>Every matchday your club settles its books, and every line is real. What comes in: your <b>sponsor&rsquo;s payment</b> (see the next section) and, at home games, the <b>gate</b>: your supporters, times ticket money. What goes out: <b>every player&rsquo;s wage</b>, <b>stadium upkeep</b>, and your <b>academy</b>, if you run one.</p>",
        "<p>The gate is where results turn into money. Winning raises supporter mood and attendance; losing lowers both. A winning club&rsquo;s home gate can be roughly 50% larger than a struggling club&rsquo;s, up to the ground&rsquo;s capacity.</p>",
        "<p>At season&rsquo;s end the league pays <b>prize money by final position, $200,000 down to $30,000</b>, with real gaps between places. Every position is worth real money, so late-season places still matter.</p>",
        "<ul><li><b>Wages are the tide.</b> They&rsquo;re your biggest cost and they never pause. Judge every signing by fee <i>plus</i> a season of wages, not the sticker price.</li>",
        "<li><b>The academy is a deliberate money pit.</b> It makes your whole squad train faster and it costs a fortune at higher levels. It accelerates development substantially but is one of the largest costs in the game. Commit to it only with a plan for paying for it.</li>",
        "<li><b>Watch the club page.</b> It shows your bank health and, when things get ugly, a runway estimate in matchdays. If you see a runway number at all, act: trim a wage, skip a signing, downgrade an academy.</li></ul>"
      ].join("")],
      ["sponsors", "Sponsor deals: a bet on yourself", [
        "<p>At founding you signed one of three deals. Each pays every matchday, all season; they differ in how much of your money rides on results:</p>",
        "<table><tr><th>Deal</th><th>Character</th><th>Best for</th></tr>" +
        "<tr><td><b>Prudential</b></td><td>The biggest guaranteed payment in the league, and not a cent more, whatever happens.</td><td>Rebuilds, heavy academy spenders, and honest mid-table sides.</td></tr>" +
        "<tr><td><b>Nike</b></td><td>A slightly smaller base, plus a solid bonus for every win. Comes out ahead of Prudential around a winning season: ten or more wins.</td><td>Good sides that expect a winning record but wouldn&rsquo;t bet the house on a trophy.</td></tr>" +
        "<tr><td><b>Emirates</b></td><td>A small retainer and an enormous bonus for every win. Out-earns everyone across a title-class season; a poor season costs six figures.</td><td>Squads built to win now, and managers who mean it.</td></tr></table>",
        "<p>Choose based on a realistic estimate of your squad&rsquo;s strength: each deal is the best option within a specific band of expected wins.</p>"
      ].join("")],
      ["training", "Training: where seasons compound", [
        "<p>The <b>Training</b> tab assigns every player a weekly program: batting schools (new-ball technique, playing spin, power, finishing), bowling schools (new-ball seam, spin, death-overs control), keeping, fielding, fitness, all-round work, or <b>Rest</b>, which trades a week of progress for recovered legs. Gains land when the matchday resolves, and your report names every improvement.</p>",
        "<ul><li><b>Age drives training speed.</b> The same program moves a 19-year-old roughly three times as far as a player in his thirties.</li>",
        "<li><b>Potential matters.</b> High-potential players gain more from every session. A young, high-potential player is the best long-term asset available.</li>",
        "<li><b>Tired players don&rsquo;t learn.</b> Fatigue quietly strangles progress before it hurts match output. Rotate Rest through your bowlers especially; they carry the heaviest legs.</li>",
        "<li><b>The last points are the steepest.</b> Lifting a skill from good to great takes far longer than from poor to decent. Sometimes the smart program fixes a weakness instead of polishing a strength.</li>",
        "<li><b>Train with intent.</b> A finisher doesn&rsquo;t need new-ball technique; your death bowler doesn&rsquo;t need a spin school. Match the program to the job the player actually does on Saturdays.</li></ul>",
        "<div class='fo-man-tip'><b>Note:</b> academy level, squad age and rest discipline compound. None shows much in a single week; over a season the difference is significant.</div>"
      ].join("")],
      ["youth", "Youth scouting", [
        "<p>Your scout brings <b>three local prospects, aged 18 to 20</b>, to the Training page every matchday, new faces each round. Click a name for the full workup: skills, talents, and the scout&rsquo;s read on potential.</p>",
        "<ul><li>Youth arrive with low current skills and low fees. Their value is future training gains, so judge them on potential and talents rather than current ratings.</li>",
        "<li>The paperwork limits you to <b>one youth signing every " + FO_SCOUT_COOLDOWN + " matchdays</b>, and the squad caps at 18, so every seat you fill is a seat you can&rsquo;t offer a market star later.</li>",
        "<li>Signings join when the next matchday resolves. Put them straight on a training program; that&rsquo;s what you bought them for.</li></ul>"
      ].join("")],
      ["market", "The transfer market", [
        "<p>The <b>Transfers</b> tab holds the season&rsquo;s pool of <b>18 established free agents</b>: proven players, 21 and up, one of each trade from six cricket nations. Every club sees the same pool, all season, and it <b>never restocks</b>.</p>",
        "<ul><li><b>First come, first served, league-wide.</b> When any club signs a player he is removed for everyone, the card shows who signed him, and the league is notified. If a player fixes a real weakness in your squad, delaying gives rivals the chance to sign him first.</li>",
        "<li>Fees carry a mid-season premium and wages start the day he arrives. The question is never &ldquo;is he good?&rdquo; It&rsquo;s &ldquo;is he worth more to me than the reserve he empties?&rdquo;</li>",
        "<li>Signings join after the next matchday resolves, squad cap 18.</li></ul>",
        "<div class='fo-man-tip'><b>Suggestion:</b> decide early which two or three players you would sign and at what bank balance, so the decision is already made when the moment comes.</div>"
      ].join("")],
      ["league", "The table, the run rate, the prizes", [
        "<p>Ten clubs, a full round robin, one round a day. Two points a win; ties and washouts split one. Level on points, <b>net run rate</b> decides, so a ten-run win chased lazily and a ten-run win chased hard are not the same result. Margins are money.</p>",
        "<p>Friends can <b>join mid-season</b>: a newcomer takes over a computer club, drafts a fresh squad, and inherits the fixtures. The table does not reset, but a well-drafted late joiner can still affect the title race.</p>",
        "<p>Season prizes run <b>$200k, $160k, $130k, $110k, $90k, $75k, $60k, $50k, $40k, $30k</b>, first to tenth. Every place in the final table pays differently, so no fixture is meaningless.</p>"
      ].join("")],
      ["practice", "Practice games", [
        "<p><b>Practice Game</b> in the nav plays a friendly against any club in your league. You choose the opponent, the pitch, and the weather. Nothing carries over: no money, no fatigue, no points, no consequences.</p>",
        "<p>Use it like a professional: rehearse a batting order before a big fixture, audition a young bowler at the death, or play on the exact pitch you&rsquo;ll face away next week. A live practice match can be left and resumed from the <b>&#9679; Live Match</b> link that appears while it&rsquo;s running.</p>"
      ].join("")],
      ["tips", "Ten reliable habits", [
        "<ul><li><b>Set orders every day.</b> The automatic lineup is adequate; a considered one is consistently better.</li>",
        "<li><b>Check form and fatigue before names.</b> The best manager fields the best <i>available</i> team, not the best team sheet.</li>",
        "<li><b>Bank two or three matchdays of wages, always.</b> Losing streaks cut your gate at the exact moment you need it.</li>",
        "<li><b>Draft for your home pitch.</b> Half your matches are played on it.</li>",
        "<li><b>Protect wickets early, cash in late.</b> Set batters score in ways new batters can&rsquo;t. Collapse-proof beats explosive.</li>",
        "<li><b>Rest bowlers one week before they break, not one after.</b> The fatigue ladder goes down much faster than it comes up.</li>",
        "<li><b>Prioritise training your youngest players.</b> Youth, potential and academy level multiply together; nothing else in the game compounds like this.</li>",
        "<li><b>Buy the player who fixes your worst day</b>, not the one with the prettiest rating.</li>",
        "<li><b>Captaincy is a skill, not an honour.</b> Field placings win quiet runs all season.</li>",
        "<li><b>Read the training report and ledger after every matchday.</b> They state exactly what is and is not working.</li></ul>"
      ].join("")]
    ];
    var toc = secs.map(function (s) { return "<a data-sec='" + s[0] + "'>" + s[1].replace(/&amp;/g, "&").replace(/:.*$/, "") + "</a>"; }).join("");
    page.innerHTML =
      "<div class='fo-man'><div class='crumb'>Manual</div>" +
      "<div class='page-head'><div><div class='eyebrow'>How to play</div><h1>The Manager&rsquo;s Manual</h1><p>How every system in the game works, and what to consider when using it.</p></div></div>" +
      "<div class='fo-man-toc'>" + toc + "</div>" +
      secs.map(function (s) { return foManualSec(s[0], s[1], s[2]); }).join("") + "</div>";
    page.querySelectorAll(".fo-man-toc a").forEach(function (a) {
      a.addEventListener("click", function () {
        var d = document.getElementById("man-" + a.getAttribute("data-sec")); if (!d) return;
        d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    foMobileTables();
  }
  function foRenderManual() {
    if (!/^#\/guide/.test(location.hash || "")) return;
    try { bumpBrand(); } catch (e) {}
    try { foManualPage(); } catch (e) { console.warn("foManualPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-guide")); });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderManual, 15); });


  // ===========================================================================
  //  MATCHDAY CENTRE — replay the latest round like a live blog, from the
  //  worm data every result already carries. Plus the round's best performer.
  // ===========================================================================
  function foLeagueRounds() {
    var out = {};
    try { (App.results || []).forEach(function (r) { if (r.comp === "league" && r.round != null) (out[r.round] = out[r.round] || []).push(r); }); } catch (e) {}
    return out;
  }
  function foLastRoundIx() {
    var ks = Object.keys(foLeagueRounds()).map(Number);
    return ks.length ? Math.max.apply(null, ks) : -1;
  }
  function foPerfList(results) {
    var out = [];
    (results || []).forEach(function (r) {
      (r.innings || []).forEach(function (inn) {
        if (!inn) return;
        (inn.bat || []).forEach(function (b) {
          if (!b || !b.p || !(b.b > 0)) return;
          var sc = b.r + (b.f6 || 0) * 2 + (b.f4 || 0) + (b.r >= 50 ? 12 : 0) + (b.r >= 100 ? 25 : 0);
          out.push({ name: b.p.name, club: inn.batTeam, line: b.r + (b.out ? "" : "*") + " (" + b.b + ")", sc: sc, kind: "bat", r: b.r, b: b.b });
        });
        for (var k in (inn.bowlers || {})) {
          var br = inn.bowlers[k]; if (!br || !br.p) continue;
          var ov = br.b / 6, econ = ov ? br.r / ov : 0;
          var sc2 = br.w * 21 - econ * 1.5 + (br.w >= 4 ? 14 : 0);
          out.push({ name: k, club: inn.bowlTeam, line: br.w + "/" + br.r + " (" + Math.floor(br.b / 6) + (br.b % 6 ? "." + br.b % 6 : "") + ")", sc: sc2, kind: "bowl", w: br.w });
        }
      });
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    return out;
  }
  function foWormAt(w, ov) {
    var best = [0, 0, 0];
    for (var i = 0; i < (w || []).length; i++) { if (w[i][0] <= ov + 1e-6) best = w[i]; else break; }
    return best;
  }
  var FO_MD = { t: 0, speed: 2, timer: null, round: -1 };
  function foMatchdayPage() {
    var page = document.getElementById("page"); if (!page) return;
    var rd = foLastRoundIx();
    if (rd < 0) {
      page.innerHTML = "<div class='crumb'>Matchday</div>" +
        "<div class='page-head'><div><div class='eyebrow'>Matchday centre</div><h1>The season starts here</h1><p>Every round replays here ball by ball once it's played — at " + MATCH_TIME + ". Until then, get your predictions in.</p></div></div>" +
        "<div id='fo-md-predict'></div>";
      foRenderPredictions();
      return;
    }
    var results = foLeagueRounds()[rd] || [];
    var seenKey = "fol_md_" + ((LG && LG.id) || "solo") + "_" + rd;
    var seen = !!lsGet(seenKey);
    // LIVE window: the round resolves at 9:00 AM ET and "broadcasts" at one
    // over a minute. Visit inside the window and the replay is already at the
    // right over; everyone in the league sees the same moment.
    var liveT = null;
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit" });
      var p = {}; f.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var mins = (+p.hour) * 60 + (+p.minute) - 9 * 60;
      if (mins >= 0 && mins <= 100 && SYNC && SYNC.started && !SYNC.practice) liveT = Math.max(0.5, Math.min(100, mins));
    } catch (e) {}
    if (FO_MD.round !== rd) { FO_MD.round = rd; FO_MD.t = liveT != null ? liveT : (seen ? 101 : 0); }
    else if (liveT != null && !FO_MD.timer && FO_MD.t < liveT) FO_MD.t = liveT;
    var my = ""; try { my = userTeam().name; } catch (e) {}
    var cards = results.map(function (r, i) {
      var mine = (r.home === my || r.away === my) ? " style='border-color:#C0562F'" : "";
      return "<div class='fo-md-card' data-i='" + i + "'" + mine + "><div class='fo-md-teams'>" + E(r.home) + " v " + E(r.away) + "</div>" +
        "<div class='fo-md-inn' data-inn='0'><span></span><b></b></div>" +
        "<div class='fo-md-inn' data-inn='1'><span></span><b></b></div>" +
        "<div class='fo-md-status'></div>" +
        "<div style='margin-top:8px'><a class='fo-morelink' href='#/scorecard?i=" + r.ix + "'>Full scorecard ›</a></div></div>";
    }).join("");
    page.innerHTML =
      "<div class='crumb'>Matchday</div>" +
      "<div class='page-head'><div><div class='eyebrow'>Round " + (rd + 1) + "</div><h1>Matchday centre</h1><p>Every game of the round, ball by ball. Press play and watch it unfold.</p></div></div>" +
      "<div class='fo-md-bar'>" + (liveT != null ? "<span class='fo-md-live'>&#9679; LIVE</span>" : "") +
      "<button id='fo-md-play'>" + (FO_MD.t > 100 ? "Replay" : "Play") + "</button>" +
      "<button class='fo-ghost' id='fo-md-speed'>" + FO_MD.speed + "×</button>" +
      "<button class='fo-ghost' id='fo-md-skip'>Skip to result</button>" +
      "<span class='fo-md-over' id='fo-md-over'></span><span class='fo-md-track'><u id='fo-md-prog'></u></span></div>" +
      "<div class='fo-md-grid'>" + cards + "</div>" +
      "<div id='fo-md-potr'></div>" +
      "<div id='fo-md-predict'></div>";
    var paint = function () {
      var T = FO_MD.t;
      results.forEach(function (r, i) {
        var card = page.querySelector(".fo-md-card[data-i='" + i + "']"); if (!card) return;
        var i1 = r.innings && r.innings[0], i2 = r.innings && r.innings[1];
        var w1 = (r.worm && r.worm[0]) || [], w2 = (r.worm && r.worm[1]) || [];
        var end1 = w1.length ? w1[w1.length - 1][0] : 50;
        var rows = card.querySelectorAll(".fo-md-inn");
        var s1 = foWormAt(w1, Math.min(T, end1));
        rows[0].querySelector("span").textContent = i1 ? i1.batTeam : "";
        rows[0].querySelector("b").textContent = (T <= 0) ? "" : (s1[1] + "/" + s1[2] + " (" + Math.min(T, end1).toFixed(0) + " ov)");
        rows[0].classList.toggle("on", T > 0 && T < end1);
        var t2 = T - end1;
        var s2 = foWormAt(w2, Math.max(0, t2));
        var end2 = w2.length ? w2[w2.length - 1][0] : 50;
        rows[1].querySelector("span").textContent = i2 ? i2.batTeam : "";
        rows[1].querySelector("b").textContent = (t2 <= 0 || !i2) ? "" : (s2[1] + "/" + s2[2] + " (" + Math.min(t2, end2).toFixed(0) + " ov)");
        rows[1].classList.toggle("on", i2 && t2 > 0 && t2 < end2);
        var st = card.querySelector(".fo-md-status");
        if (t2 >= end2 || T > 100) { st.textContent = (r.result && r.result.text) || ""; card.classList.add("fo-md-done"); }
        else if (i2 && t2 > 0) {
          var target = (i1 ? i1.runs : 0) + 1, need = target - s2[1], balls = Math.round((end2 - t2) * 6);
          st.textContent = need > 0 ? (i2.batTeam + " need " + need + " off " + Math.max(0, balls) + " balls") : "";
          card.classList.remove("fo-md-done");
        } else { st.textContent = T > 0 ? "First innings in progress" : "Starts at the top of the hour…"; card.classList.remove("fo-md-done"); }
      });
      var ov = document.getElementById("fo-md-over"), pr = document.getElementById("fo-md-prog");
      if (ov) ov.textContent = T <= 0 ? "Ready" : (T > 100 ? "Full time" : (T <= 50 ? "1st innings · over " + Math.min(50, T).toFixed(0) : "2nd innings · over " + Math.min(50, T - 50).toFixed(0)));
      if (pr) pr.style.width = Math.min(100, T) + "%";
      var potr = document.getElementById("fo-md-potr");
      if (potr && (T > 100)) {
        if (!potr.innerHTML) {
          var best = foPerfList(results)[0];
          if (best) potr.innerHTML = "<div class='fo-potr'><span class='fo-potr-medal'>🏅</span><div><div class='small' style='color:#9aa3b2;text-transform:uppercase;letter-spacing:.12em;font-size:10.5px'>Player of the round</div><b>" + E(best.name) + "</b> · " + E(best.club) + " · " + E(best.line) + "</div><div style='margin-left:auto' class='small'>Think you saw it coming? Call the next round below.</div></div>";
          lsSet(seenKey, "1");
        }
      } else if (potr && T <= 100) potr.innerHTML = "";
    };
    var stop = function () { if (FO_MD.timer) { clearInterval(FO_MD.timer); FO_MD.timer = null; } };
    var run = function () {
      stop();
      if (FO_MD.t > 100) FO_MD.t = 0;
      FO_MD.timer = setInterval(function () {
        if (!document.getElementById("fo-md-prog")) { stop(); return; }
        FO_MD.t += 0.5 * FO_MD.speed;
        if (FO_MD.t > 101) { FO_MD.t = 101; stop(); var b = document.getElementById("fo-md-play"); if (b) b.textContent = "Replay"; }
        paint();
      }, 110);
      var b = document.getElementById("fo-md-play"); if (b) b.textContent = "Pause";
    };
    page.querySelector("#fo-md-play").addEventListener("click", function () {
      if (FO_MD.timer) { stop(); this.textContent = "Play"; } else run();
    });
    page.querySelector("#fo-md-speed").addEventListener("click", function () {
      FO_MD.speed = FO_MD.speed >= 8 ? 1 : FO_MD.speed * 2; this.textContent = FO_MD.speed + "×";
    });
    page.querySelector("#fo-md-skip").addEventListener("click", function () { stop(); FO_MD.t = 101; paint(); var b = document.getElementById("fo-md-play"); if (b) b.textContent = "Replay"; });
    paint();
    if (liveT != null && FO_MD.t <= 100) run();       // live window: rolling by itself
    foRenderPredictions();
  }
  function foRenderMatchday() {
    if (!/^#\/matchday/.test(location.hash || "")) { if (FO_MD.timer) { clearInterval(FO_MD.timer); FO_MD.timer = null; } return; }
    try { bumpBrand(); } catch (e) {}
    try { foMatchdayPage(); } catch (e) { console.warn("foMatchdayPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-matchday")); });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderMatchday, 15); });

  // ---- challenge friendlies: inbox/outbox card on the club home --------------
  function foChallengesCard() {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      if (!/^#\/club|^$/.test(location.hash || "")) return;
      var page = document.getElementById("page");
      if (!page || page.querySelector("#fo-chal-card")) return;
      var col = page.querySelector(".fo-ch-col"); if (!col) return;
      var me = userTeam().name;
      sel("league_challenges", "league_id=eq." + LG.id + "&select=*&order=created_at.desc&limit=12").then(function (rows) {
        rows = (rows || []).filter(function (c) { return c.challenger_club === me || c.opponent_club === me; });
        if (!rows.length) return;
        var seenK = "fol_chseen_" + LG.id, seen = {};
        try { seen = JSON.parse(lsGet(seenK) || "{}"); } catch (e) {}
        var items = rows.slice(0, 5).map(function (c) {
          var mineSent = c.challenger_club === me;
          var vs = mineSent ? c.opponent_club : c.challenger_club;
          var when = new Date(c.play_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
          var line = "<b>" + (mineSent ? "vs " : "from ") + E(vs) + "</b> · " + foPitchName(c.pitch) + ", " + E(c.weather) + " · " + when;
          var act = "";
          if (c.status === "pending" && !mineSent) act = "<button class='mini fo-ch-acc' data-id='" + c.id + "'>Accept</button> <button class='mini fo-ch-dec' data-id='" + c.id + "'>Decline</button>";
          else if (c.status === "pending") act = "<span class='small'>awaiting reply</span>";
          else if (c.status === "accepted") act = "<span class='small'>on! </span><button class='mini fo-ch-ord' data-id='" + c.id + "' title='Attach your currently saved lineup'>Use my lineup</button>";
          else if (c.status === "declined") act = "<span class='small'>declined</span>";
          else if (c.status === "played" && c.result) {
            act = "<b class='small'>" + E(c.result.result_text || "") + "</b>";
            if (!seen[c.id]) { toast("Challenge result: " + (c.result.result_text || "played")); seen[c.id] = 1; }
          }
          return "<li style='margin:0 0 8px'>" + line + "<div style='margin-top:3px'>" + act + "</div></li>";
        }).join("");
        lsSet(seenK, JSON.stringify(seen));
        var card = document.createElement("div");
        card.className = "fo-card"; card.id = "fo-chal-card";
        card.innerHTML = "<div class='fo-card-h2row'><div class='fo-card-h2'>Challenge matches</div></div><div class='fo-card-b'><ul style='margin:0;padding-left:4px;list-style:none;font-size:13px'>" + items + "</ul></div>";
        col.insertBefore(card, col.firstChild);
        card.querySelectorAll(".fo-ch-acc,.fo-ch-dec").forEach(function (b) {
          b.addEventListener("click", function () {
            rpc("challenge_respond", { p_id: b.getAttribute("data-id"), p_accept: b.classList.contains("fo-ch-acc") })
              .then(function () { toast(b.classList.contains("fo-ch-acc") ? "Challenge accepted — attach your lineup any time before the match." : "Challenge declined."); card.remove(); foChallengesCard(); })
              .catch(say);
          });
        });
        card.querySelectorAll(".fo-ch-ord").forEach(function (b) {
          b.addEventListener("click", function () {
            if (!(App.orders && App.orders.saved)) { say("Save a lineup on the Orders screen first, then attach it here."); return; }
            rpc("challenge_set_orders", { p_id: b.getAttribute("data-id"), p_club: me, p_orders: App.orders })
              .then(function () { toast("Lineup attached to the challenge."); })
              .catch(say);
          });
        });
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- predictions league: one tap per fixture, bragging rights forever ------
  // Picks live in memory first (FO_PRED), then localStorage, then the server.
  // The matchday page re-renders often (route hooks, live ticker, hashchange),
  // so the in-memory copy is the single source of truth for highlights: it
  // survives every rebuild even where localStorage is unavailable (iOS private
  // browsing), and every submit sends the FULL merged pick set so a fast tap
  // can never wipe earlier picks off the server.
  function foPredKey(rd) { return "fol_pred_" + ((LG && LG.id) || "solo") + "_" + rd; }
  var FO_PRED = { key: "", picks: {}, fetched: false };
  function foPredPicks(rd) {
    var key = foPredKey(rd);
    if (FO_PRED.key !== key) {
      var p = {}; try { p = JSON.parse(lsGet(key) || "{}"); } catch (e) {}
      FO_PRED = { key: key, picks: p, fetched: false };
    }
    return FO_PRED.picks;
  }
  function foPredApply(host) {
    host.querySelectorAll(".fo-pick").forEach(function (b) {
      b.classList.toggle("fo-pick-on", FO_PRED.picks[b.getAttribute("data-k")] === b.getAttribute("data-v"));
    });
  }
  function foRenderPredictions() {
    var host = document.getElementById("fo-md-predict"); if (!host) return;
    if (!(SYNC && SYNC.started && !SYNC.practice && LG)) { host.innerHTML = ""; return; }
    var S = App.season; if (!S || !S.schedule || S.round >= S.schedule.length) { host.innerHTML = ""; return; }
    var rd = S.round, fixtures = S.schedule[rd] || [];
    var mine = foPredPicks(rd);
    // house rules: one side per fixture (a pick REPLACES the other side, the
    // key is the fixture), at most five picks a round, and nothing stale -
    // picks for fixtures not in this round are pruned
    var valid = {};
    fixtures.forEach(function (f) { try { valid[GD.teams[f[0]].name + "|" + GD.teams[f[1]].name] = 1; } catch (e) {} });
    var nPicks = 0, pruned = false;
    Object.keys(mine).forEach(function (kk) {
      if (!valid[kk] || ++nPicks > 5) { delete mine[kk]; pruned = true; }
    });
    if (pruned) lsSet(FO_PRED.key, JSON.stringify(mine));
    // idempotent: the card is already up for this round — refresh highlights
    // in place instead of tearing down buttons mid-interaction
    if (host.getAttribute("data-rd") === FO_PRED.key && host.querySelector(".fo-pick")) { foPredApply(host); return; }
    host.setAttribute("data-rd", FO_PRED.key);
    var rows = fixtures.map(function (f, i) {
      var h = GD.teams[f[0]].name, a = GD.teams[f[1]].name, k = h + "|" + a;
      var pick = mine[k];
      return "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid #f0ece1'>" +
        "<button class='mini fo-pick" + (pick === h ? " fo-pick-on" : "") + "' data-k='" + E(k) + "' data-v='" + E(h) + "'>" + E(h) + "</button>" +
        "<span class='small'>v</span>" +
        "<button class='mini fo-pick" + (pick === a ? " fo-pick-on" : "") + "' data-k='" + E(k) + "' data-v='" + E(a) + "'>" + E(a) + "</button></div>";
    }).join("");
    host.innerHTML = "<div class='fo-card' style='margin-top:14px'><div class='fo-card-h2row'><div class='fo-card-h2'>Predictions · round " + (rd + 1) + "</div><span class='small'>1 point per correct call</span></div><div class='fo-card-b'>" + rows +
      "<div id='fo-pred-board' class='small' style='margin-top:10px'>Loading leaderboard…</div></div></div>";
    // restore from the server once per round, filling only the gaps: a pick
    // made on this device right now always beats a stale server row
    if (!FO_PRED.fetched) {
      FO_PRED.fetched = true;
      sel("league_predictions", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&round=eq." + rd + "&select=picks").then(function (rows2) {
        var srv = (rows2 && rows2[0] && rows2[0].picks) || null; if (!srv) return;
        var merged = false;
        for (var k2 in srv) {
          if (k2 in FO_PRED.picks || !valid[k2]) continue;
          if (Object.keys(FO_PRED.picks).length >= 5) break;
          FO_PRED.picks[k2] = srv[k2]; merged = true;
        }
        if (merged) lsSet(FO_PRED.key, JSON.stringify(FO_PRED.picks));
        var h2 = document.getElementById("fo-md-predict");
        if (h2) foPredApply(h2);
      }).catch(function () { FO_PRED.fetched = false; });
    }
    host.querySelectorAll(".fo-pick").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-k"), v = b.getAttribute("data-v");
        if (!(k in FO_PRED.picks) && Object.keys(FO_PRED.picks).length >= 5) {
          say("Five predictions a round is the cap. Change one of your existing picks instead."); return;
        }
        FO_PRED.picks[k] = v; lsSet(FO_PRED.key, JSON.stringify(FO_PRED.picks));
        // highlight immediately, in place
        var row = b.parentNode;
        row.querySelectorAll(".fo-pick").forEach(function (x) { x.classList.toggle("fo-pick-on", x === b); });
        rpc("predictions_submit", { p_league_id: LG.id, p_round: rd, p_picks: FO_PRED.picks })
          .then(function () { toast("Prediction locked: " + v); })
          .catch(function (e) {
            var m = ((e && e.message) || e) + "";
            if (/Could not find the function/i.test(m)) say("Predictions need the 0015 SQL run in Supabase (ask your commissioner).");
            else say(e);
          });
      });
    });
    // leaderboard: everyone's picks vs everyone's results
    Promise.all([
      sel("league_predictions", "league_id=eq." + LG.id + "&select=manager_id,round,picks"),
      sel("teams", "league_id=eq." + LG.id + "&select=manager_id,name")
    ]).then(function (r) {
      var names = {}; (r[1] || []).forEach(function (t) { names[t.manager_id] = t.name; });
      var byRound = foLeagueRounds();
      var pts = {};
      (r[0] || []).forEach(function (row) {
        var res = byRound[row.round]; if (!res) return;
        var winners = {}; res.forEach(function (m) { winners[m.home + "|" + m.away] = m.result && m.result.winner; });
        var p = row.picks || {};
        for (var k in p) if (winners[k] && winners[k] === p[k]) pts[row.manager_id] = (pts[row.manager_id] || 0) + 1;
        if (!(row.manager_id in pts)) pts[row.manager_id] = pts[row.manager_id] || 0;
      });
      var board = Object.keys(pts).map(function (m) { return { nm: names[m] || "Manager", p: pts[m] }; }).sort(function (a, b) { return b.p - a.p; });
      var el = document.getElementById("fo-pred-board"); if (!el) return;
      var myN = 0; try { myN = Object.keys(FO_PRED.picks || {}).length; } catch (e) {}
      el.innerHTML = board.length
        ? "<b>Leaderboard:</b> " + board.map(function (x, i) { return (i + 1) + ". " + E(x.nm) + " (" + x.p + ")"; }).join(" · ")
        : (myN ? "Your " + myN + " pick" + (myN > 1 ? "s are" : " is") + " locked in. Points land when the round is played." : "No predictions yet this season — be first.");
    }).catch(function () { var el = document.getElementById("fo-pred-board"); if (el) el.textContent = ""; });
  }

  // ---- stadium expansion: a long-term money sink to rival the academy --------
  var FO_SEAT_STEP = 1500, FO_SEAT_RATE = 80, FO_SEAT_CAP = 15000;
  function foOfficeExtras() {
    try {
      if (!/^#\/office/.test(location.hash || "")) return;
      var page = document.getElementById("page"); if (!page || page.querySelector("#fo-stadium")) return;
      var t = foMyClub(); if (!t) return;
      var st = foTrainState();
      var seats = t.seats || 9000;
      var pending = st.seatsPending && st.seatsPending.target > seats;
      if (st.seatsPending && st.seatsPending.target <= seats) { delete st.seatsPending; foTrainSave(st); pending = false; }
      var cost = FO_SEAT_STEP * FO_SEAT_RATE;
      var atCap = seats >= FO_SEAT_CAP;
      var card = document.createElement("div");
      card.className = "panel"; card.id = "fo-stadium";
      card.innerHTML = "<h4>Stadium</h4><div class='pad'>" +
        "<div style='display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px'><span>Capacity <b>" + seats.toLocaleString() + "</b> seats · upkeep <b>" + FO$(seats) + "</b>/matchday</span></div>" +
        "<div class='small' style='margin:6px 0 10px'>Bigger stands mean bigger gates when the town is behind you — and a bigger upkeep bill when it isn't. Expansion completes after the next matchday.</div>" +
        (atCap ? "<div class='fo-mk-gone'>The council won't approve anything bigger.</div>"
          : pending ? "<div class='fo-mk-gone'>Builders on site — new stand opens after the next matchday.</div>"
          : "<button class='fo-yc-sign' id='fo-seat-buy'>Extend the stand — +" + FO_SEAT_STEP.toLocaleString() + " seats for " + FO$(cost) + "</button>") +
        "</div>";
      var firstPanel = page.querySelector(".panel");
      if (firstPanel && firstPanel.parentNode) firstPanel.parentNode.insertBefore(card, firstPanel); else page.appendChild(card);
      var btn = card.querySelector("#fo-seat-buy");
      if (btn) btn.addEventListener("click", function () {
        var bank = (App.fin && App.fin.bank) || t.bank || 0;
        if (bank < cost) { say("Not enough in the bank — the builders want " + FO$(cost) + " up front."); return; }
        foConfirm({
          title: "Extend the stand?",
          body: "+" + FO_SEAT_STEP.toLocaleString() + " seats for " + FO$(cost) + ". Upkeep rises " + FO$(FO_SEAT_STEP) + " per matchday, and the extra gate only pays if the crowds come.",
          confirm: "Build it — " + FO$(cost), cancel: "Not yet"
        }).then(function (ok) {
          if (!ok) return;
          if (SYNC && SYNC.started && !SYNC.practice && LG) {
            var st2 = foTrainState();
            st2.seatsPending = { add: FO_SEAT_STEP, cost: cost, target: seats + FO_SEAT_STEP };
            foTrainSave(st2);
            toast("Builders booked — the new stand opens after the next matchday.");
            var el = document.getElementById("fo-stadium"); if (el) { el.remove(); foOfficeExtras(); }
          } else {
            t.seats = seats + FO_SEAT_STEP;
            if (typeof window.ledger === "function" && window.ledger.length >= 3) window.ledger("Stadium", "Stand extension", -cost);
            else if (App.fin) App.fin.bank -= cost;
            if (typeof window.saveGame === "function") window.saveGame(false);
            toast("New stand open: " + t.seats.toLocaleString() + " seats.");
            var el2 = document.getElementById("fo-stadium"); if (el2) { el2.remove(); foOfficeExtras(); }
          }
        });
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foOfficeExtras, 30); });

  // ---- the newspaper: a digest of the latest round for the club home ---------
  function foNewsDigest() {
    var rd = foLastRoundIx(); if (rd < 0) return "";
    var results = foLeagueRounds()[rd] || []; if (!results.length) return "";
    var my = ""; try { my = userTeam().name; } catch (e) {}
    var items = [];
    results.forEach(function (r) {
      var txt = (r.result && r.result.text) || "";
      var star = foPerfList([r])[0];
      var mine = r.home === my || r.away === my;
      items.push({ pri: mine ? 0 : 2, h: txt, s: E(r.ground || "") + (star ? " · star: " + E(star.name) + " " + E(star.line) : "") });
    });
    var perfs = foPerfList(results);
    perfs.forEach(function (p) {
      if (p.kind === "bat" && p.r >= 100) items.push({ pri: 1, h: "CENTURY: " + E(p.name) + " " + E(p.line), s: "for " + E(p.club) });
      if (p.kind === "bowl" && p.w >= 5) items.push({ pri: 1, h: "FIVE-FOR: " + E(p.name) + " " + E(p.line), s: "for " + E(p.club) });
    });
    try {
      GD.teams.forEach(function (t) {
        var rep = t._trainReport || {};
        (rep.signings || []).forEach(function (s) { items.push({ pri: 3, h: E(t.name) + ": " + E(s), s: "" }); });
        (rep.injuries || []).forEach(function (s) { items.push({ pri: 1, h: "INJURY: " + E(s), s: E(t.name) }); });
      });
    } catch (e) {}
    items.sort(function (a, b) { return a.pri - b.pri; });
    var lis = items.slice(0, 6).map(function (it) { return "<li><div class='fo-news-h'>" + it.h + "</div>" + (it.s ? "<div class='fo-news-s'>" + it.s + "</div>" : "") + "</li>"; }).join("");
    return "<div class='fo-card fo-news'><div class='fo-card-h2row'><div class='fo-card-h2'>The Fifty Overs Post · Round " + (rd + 1) + "</div><a class='fo-morelink' href='#/matchday'>Watch the matchday ›</a></div><div class='fo-card-b'><ul style='margin:0;padding-left:4px;list-style:none;font-size:13px'>" + lis + "</ul></div></div>";
  }

  // ---- the Training page ------------------------------------------------------
  function foTrainingPage() {
    var page = document.getElementById("page"); if (!page) return;
    var t = foMyClub();
    if (!t || !t.players || !t.players.length) { page.innerHTML = "<div class='crumb'>Training</div><div class='panel'><h4>Training</h4><div class='pad'>No squad yet — finish your draft first.</div></div>"; return; }
    var st = foTrainState();
    var round = (App.season && App.season.round) || 0;
    var rep = t._trainReport || (App.trainingReports && App.trainingReports[0]) || null;
    var ward = (t.injured && t.injured.length)
      ? "<div class='fo-yc-note' style='border-color:#e8c9c2;background:#fbeeea'><b>Injury ward:</b> " + t.injured.map(function (p) { return E(p.name) + " (" + (p._inj || 1) + " matchday" + ((p._inj || 1) === 1 ? "" : "s") + ")"; }).join(" · ") + "</div>"
      : "";

    var progOpts = function (cur) { return FO_TR_PROGS.map(function (k) { return "<option value='" + k + "'" + (cur === k ? " selected" : "") + ">" + k + "</option>"; }).join(""); };
    var intOpts = function (cur) { return FO_TR_INT.map(function (k) { return "<option value='" + k + "'" + (cur === k ? " selected" : "") + ">" + k + "</option>"; }).join(""); };
    var potCls = { Star: "star", High: "high", Useful: "useful", Limited: "limited" };

    var rows = t.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).map(function (p) {
      var tr = foTrOf(p), pr = foTrProgress(p), pot = foPotential(p);
      var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? foFlag(p.nat) : ""; } catch (e) {}
      var fat = String(p.fatigue || "rested");
      var fatTone = /rested|revived|energetic|passable/.test(fat) ? "ok" : /satisfactory|moderate/.test(fat) ? "mid" : "bad";
      var gainLbl = foSkillLabel(pr.skill) + (pr.pct > 0 ? " · " + pr.pct + "%" : " · first session tonight");
      return "<tr>" +
        "<td class='fo-tr-nm'>" + flag + " <a class='fo-tr-link' href='#/player?n=" + encodeURIComponent(p.name) + "'><b>" + E(p.name) + "</b></a><span class='fo-tr-meta'>" + foRoleShort(p) + " · age " + (p.age || "?") + "</span></td>" +
        "<td><span class='fo-fat fo-fat-" + fatTone + "'>" + E(fat) + "</span></td>" +
        "<td><select class='fo-tr-prog' data-p='" + E(p.name).replace(/'/g, "&#39;") + "'>" + progOpts(tr.program) + "</select></td>" +
        "<td class='fo-tr-progress'><div class='fo-tr-bar' title='Progress to the next +1'><u style='width:" + pr.pct + "%'></u></div><span>" + gainLbl + "</span></td>" +
        "</tr>";
    }).join("");

    var repHtml = "";
    if (rep && (rep.gains || []).length + (rep.recovery || []).length + (rep.signings || []).length) {
      repHtml = ward + "<div class='panel'><h4>This week in the nets · after matchday " + (rep.round || round) + "</h4><div class='pad fo-tr-rep'>" +
        (rep.signings || []).map(function (g) { return "<div class='fo-tr-g fo-tr-sign'>" + FO_I("users", 14) + " " + E(g) + "</div>"; }).join("") +
        (rep.gains || []).map(function (g) { return "<div class='fo-tr-g'>" + FO_I("checkCircle", 14) + " " + E(g) + "</div>"; }).join("") +
        (rep.recovery || []).map(function (g) { return "<div class='fo-tr-g fo-tr-rec'>" + FO_I("shield", 14) + " " + E(g) + "</div>"; }).join("") +
        "</div></div>";
    } else {
      repHtml = "<div class='panel'><h4>This week in the nets</h4><div class='pad small'>Gains land after each matchday. Younger players and higher-potential players improve fastest; tired players train poorly — use Rest.</div></div>";
    }

    // youth scout panel
    var canSignIn = Math.max(0, FO_SCOUT_COOLDOWN - (round - st.lastSignRound));
    var scouts = foScoutList();
    var scoutCards = scouts.map(function (p, i) {
      var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? foFlag(p.nat) : ""; } catch (e) {}
      var pot = foPotential(p);
      var bars = [["Bat", foAgg(p, "bat")], [(p.keeper ? "Keep" : "Bowl"), p.keeper ? foAgg(p, "keep") : ((p.bowlTypeFull && p.bowlTypeFull !== "none") ? foAgg(p, "bowl") : 0)], ["Field", foAgg(p, "field")]];
      var barHtml = bars.map(function (b) { return "<span class='fo-sk'><i>" + b[0] + "</i><b><u class='fo-sk-" + foSkTone(b[1]) + "' style='width:" + b[1] + "%'></u></b><em>" + b[1] + "</em></span>"; }).join("");
      return "<div class='fo-yc'>" +
        "<div class='fo-yc-h'>" + flag + " <b class='fo-yc-view' data-i='" + i + "'>" + E(p.name) + "</b></div>" +
        "<div class='fo-yc-meta'>" + foRoleShort(p) + " · age " + p.age + " · rating " + (p.rating || 0).toLocaleString() + "</div>" +
        "<div class='fo-yc-bars'>" + barHtml + "</div>" +
        "<div class='fo-yc-money'><span>Fee <b>" + FO$(p.fee) + "</b></span><span>Wage <b>" + FO$(foDailyWage(p)) + "/day</b></span></div>" +
        "<button class='fo-yc-sign' data-i='" + i + "'" + ((st.youthPending.length || canSignIn > 0) ? " disabled" : "") + ">Sign</button>" +
        "</div>";
    }).join("") || "<div class='small'>No eligible young players found this matchday — the shortlist refreshes after each round.</div>";
    var scoutNote = st.youthPending.length
      ? "<b>" + E(st.youthPending[0].name) + "</b> has agreed terms — the signing completes after the next matchday."
      : (canSignIn > 0 ? "Your scout can bring in the next signing in <b>" + canSignIn + "</b> matchday(s)." : "Your scout is ready — you can sign one player now.");

    page.innerHTML =
      "<div class='crumb'>" + E(t.name) + " &raquo; Training</div>" +
      "<div class='page-head'><div><div class='eyebrow'>Development centre</div><h1>Training &amp; Youth</h1><p>Programs update after every matchday. Young legs learn fastest.</p></div></div>" +
      repHtml +
      "<div class='panel'><h4>Training programs</h4><div class='pad'>" +
      "<div class='fo-tr-bulk'><span class='small'>Quick set:</span>" +
      "<button class='fo-tr-b' data-m='role'>Best fit by role</button>" +
      "<button class='fo-tr-b' data-m='restTired'>Rest the tired</button></div>" +
      "<table class='fo-tr-tbl'><thead><tr><th>Player</th><th>Fatigue</th><th>Program</th><th>Next gain</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<div class='small' style='margin-top:8px'>Skill gains raise wages automatically. Squads over 24 players train slower.</div>" +
      "</div></div>" +
      "<div class='panel'><h4>Youth scout &middot; ages 18&#8211;20</h4><div class='pad'>" +
      "<div class='fo-yc-note'>" + scoutNote + "</div>" +
      "<div class='fo-ycs'>" + scoutCards + "</div>" +
      "<div class='small' style='margin-top:8px'>The shortlist refreshes every matchday from your home country. One signing per " + FO_SCOUT_COOLDOWN + " matchdays; squad cap 18.</div>" +
      "</div></div>";

    page.querySelectorAll(".fo-tr-prog").forEach(function (s) { s.addEventListener("change", function () { foSetTraining(s.getAttribute("data-p"), "program", s.value); }); });
    page.querySelectorAll(".fo-tr-b").forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-m");
        t.players.forEach(function (p) {
          if (m === "role") foSetTraining(p.name, "program", foTrDefault(p));
          if (m === "restTired" && !/rested|revived|energetic|passable|satisfactory/.test(String(p.fatigue || "rested"))) foSetTraining(p.name, "program", "Rest");
        });
        foTrainingPage();
        toast("Training updated for the squad.");
      });
    });
    page.querySelectorAll(".fo-yc-sign").forEach(function (b) { b.addEventListener("click", function () { foSignYouth(scouts[+b.getAttribute("data-i")]); }); });
    page.querySelectorAll(".fo-yc-view").forEach(function (b) { b.addEventListener("click", function () { foYouthDetail(scouts[+b.getAttribute("data-i")]); }); });
  }
  // The engine's own hashchange handler calls its INTERNAL route (bypassing the
  // window.route wrapper) and falls back to the club page for hashes it doesn't
  // know — so re-assert the training page one tick after every hash change.
  window.addEventListener("hashchange", function () { setTimeout(foRenderTraining, 15); });
  // (a) Squad polish: value-coloured skill bars + sortable Capt column.
  try { if (typeof GRIDKEYS !== "undefined") GRIDKEYS.Capt = function (p) { return (p && p.capt) || 0; }; } catch (e) {}
  // (14) Set lineup buttons directly on my rows in the Fixtures & results table.
  function foDecorateMatchRows() {
    try {
      if (App.page !== "matches" || !(SYNC && SYNC.started) || SYNC.practice) return;
      var page = document.getElementById("page"); if (!page) return;
      // friendlies live in their own history, separate from the league record
      if (!page.querySelector("#fo-frhist")) {
        var fh = foFrHist();
        if (fh.length) {
          var rows2 = fh.map(function (e) {
            var d = new Date(e.at).toLocaleDateString([], { month: "short", day: "numeric" });
            return "<tr><td>" + d + "</td><td>vs " + E(e.opp) + "</td><td>" + E(e.s1) + (e.s2 ? " · " + E(e.s2) : "") + "</td><td><b>" + E(e.txt) + "</b></td></tr>";
          }).join("");
          var pnl = document.createElement("div");
          pnl.className = "panel"; pnl.id = "fo-frhist";
          pnl.innerHTML = "<h4>Friendlies</h4><div class='pad'><table><tr><th>Date</th><th>Opponent</th><th>Scores</th><th>Result</th></tr>" + rows2 + "</table></div>";
          page.appendChild(pnl);
        }
      }
      page.querySelectorAll('tr[style*="eef4ee"], tr[style*="eef8fb"]').forEach(function (tr) {
        if (tr.__foSetr) return;
        var cells = tr.querySelectorAll("td"); if (cells.length < 5) return;
        var last = cells[cells.length - 1];
        if (!/not played/i.test(last.textContent)) return;
        var rd = parseInt((cells[0].textContent.match(/\d+/) || [])[0], 10); if (!rd) return;
        tr.__foSetr = 1;
        var done = SYNC.submitted && SYNC.submitted[rd - 1];
        var b = document.createElement("button");
        b.className = "fo-setr" + (done ? " fo-setr-done" : "");
        b.innerHTML = done ? "&#10003; Orders ready" : "Set lineup"; b.style.marginLeft = "8px";
        b.title = done ? "Click to edit this round's lineup" : "";
        b.addEventListener("click", function () { foSetOrdersForRound(rd - 1); });
        last.appendChild(b);
      });
    } catch (e) {}
  }
  function foPolishSquad() {
    try {
      var page = document.getElementById("page"); if (!page) return;
      // colour every engine skill bar by its value (green-only bars read as noise)
      page.querySelectorAll(".bar>i").forEach(function (i) {
        var v = parseFloat(i.style.width) || 0;
        i.style.background = v >= 75 ? "#3E9960" : v >= 50 ? "#4DA6A2" : v >= 30 ? "#D9A441" : "#C84F4A";
      });
      // the grid's Capt header is hard-coded unsortable — wire it up
      page.querySelectorAll("th").forEach(function (th) {
        if (th.textContent.replace(/[^A-Za-z]/g, "") !== "Capt" || th.__foWired) return;
        th.__foWired = 1; th.style.cursor = "pointer"; th.title = "Captaincy - click to sort";
        th.addEventListener("click", function () { try { window.gridSort("Capt"); } catch (e) {} });
      });
    } catch (e) {}
  }

  function foRenderTraining() {
    if (!/^#\/training/.test(location.hash || "")) return;
    try { bumpBrand(); } catch (e) {}
    try { foTrainingPage(); } catch (e) { console.warn("foTrainingPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-training")); });
    } catch (e) {}
  }

  // Lift the boot veil (injected by build.sh) now that the brand CSS and the right
  // screen are in place — the engine's original UI never gets a frame to flash.
  try { var _bv = document.getElementById("fo-boot"); if (_bv) _bv.parentNode.removeChild(_bv); } catch (e) {}

  // Debug/test handle for the season planner's engine-facing helpers (no behaviour).
  try { window.__fol = { userFixtures: foUserFixtures, fixtureMeta: foFixtureMeta, plannerHTML: foPlannerHTML, smartBowling: foSmartBowling }; } catch (e) {}

  console.info("Fifty Overs League overlay ready.");
})();
