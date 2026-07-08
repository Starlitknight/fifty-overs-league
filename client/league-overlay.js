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
    "#folPanel .folsmall{color:rgba(246,244,238,.6);opacity:1;line-height:1.5}";
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
    ".fo-lead{display:flex;gap:14px;align-items:center;padding:16px 18px}" +
    ".fo-lead-ic{width:44px;height:44px;border-radius:11px;background:rgba(200,103,74,.1);display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}" +
    ".fo-ch-leaders .fo-lead:nth-child(2) .fo-lead-ic{background:rgba(77,166,162,.12)}" +
    ".fo-card-h2{margin:0}.fo-lead .fo-card-h2::after{display:none}" +
    ".fo-lead-v{font-size:24px;font-weight:800;color:#12203a}.fo-lead-v span{font-size:13px;font-weight:600;color:#9a9484}" +
    ".fo-kv{width:100%;font-size:13px;border-collapse:collapse}.fo-kv td{padding:10px 18px;border-bottom:1px solid rgba(11,19,34,.055);color:#243040}.fo-kv tr:last-child td{border-bottom:none}.fo-kv td:first-child{color:#7a7566}" +
    ".fo-teal{color:#2b6b68 !important;font-weight:600}" +
    "@media(max-width:900px){.fo-ch-stats{grid-template-columns:repeat(2,1fr)}.fo-ch-grid{grid-template-columns:1fr}.fo-ch-leaders{grid-template-columns:1fr}.fo-ch-name{font-size:26px}.fo-ch-hero{flex-direction:column;align-items:flex-start}}" +
    // ===== FIRST-LOGIN ONBOARDING =====
    "#fo-onb{position:fixed;inset:0;z-index:100000;overflow:auto}" +
    ".fo-ob-shell{min-height:100vh;background:radial-gradient(circle at 20% 0%,rgba(77,166,162,.14),transparent 34%),radial-gradient(circle at 85% 12%,rgba(200,103,74,.12),transparent 30%),linear-gradient(180deg,#0B1322 0%,#08101D 100%);color:#F6F4EE;padding:24px 16px 48px}" +
    ".fo-ob-inner{max-width:960px;margin:0 auto}" +
    ".fo-ob-prog{display:flex;align-items:center;justify-content:center;gap:4px;margin:6px 0 20px;flex-wrap:wrap}" +
    ".fo-ob-step{display:flex;align-items:center;gap:7px;color:rgba(246,244,238,.5);font-size:12px;font-weight:600}" +
    ".fo-ob-dot{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:1px solid rgba(246,244,238,.2);background:rgba(246,244,238,.04)}" +
    ".fo-ob-step.on{color:#F6F4EE}.fo-ob-step.on .fo-ob-dot{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    ".fo-ob-step.done .fo-ob-dot{background:rgba(77,166,162,.25);border-color:" + TEAL + ";color:" + TEAL + "}.fo-ob-step.done{color:rgba(246,244,238,.7)}" +
    ".fo-ob-sep{width:16px;height:1px;background:rgba(246,244,238,.14)}" +
    ".fo-ob-card{background:linear-gradient(160deg,#1C2433,#111B2B);border:1px solid rgba(246,244,238,.09);border-radius:22px;padding:30px 32px;box-shadow:0 18px 50px rgba(11,19,34,.4)}" +
    ".fo-ob-narrow{max-width:560px;margin:0 auto}" +
    ".fo-ob-wordmark{display:flex;align-items:center;gap:14px;margin-bottom:16px}.fo-ob-wm1{font-size:22px;font-weight:800;letter-spacing:3px}.fo-ob-wm1 span{color:" + TERRA + "}.fo-ob-wm2{font-size:10px;letter-spacing:3px;color:rgba(246,244,238,.5);text-transform:uppercase;margin-top:2px}" +
    ".fo-ob-eyebrow{color:" + TEAL + ";font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;margin-bottom:6px}" +
    ".fo-ob-h1{font-size:26px;font-weight:800;margin:0 0 10px;line-height:1.15;letter-spacing:-.3px}" +
    ".fo-ob-lead{color:rgba(246,244,238,.72);font-size:14px;line-height:1.55;margin:0 0 18px}" +
    ".fo-ob-lbl{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:rgba(246,244,238,.5);font-weight:700;margin:12px 0 6px}" +
    ".fo-ob-input{width:100%;padding:12px 14px;border-radius:11px;border:1px solid rgba(246,244,238,.14);background:rgba(11,19,34,.5);color:#F6F4EE;font-size:15px;font-family:inherit}" +
    ".fo-ob-input:focus{outline:none;border-color:" + TEAL + ";box-shadow:0 0 0 3px rgba(77,166,162,.2)}" +
    ".fo-ob-crests{display:flex;gap:10px;flex-wrap:wrap}" +
    ".fo-ob-crest{width:76px;height:76px;border-radius:15px;border:2px solid rgba(246,244,238,.12);background:rgba(246,244,238,.05);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:6px;transition:none}" +
    ".fo-ob-crest img{width:100%;height:100%;object-fit:contain;display:block}" +
    ".fo-ob-crest.on{border-color:" + TEAL + ";box-shadow:0 0 0 3px rgba(77,166,162,.28)}" +
    ".fo-ob-hint{font-weight:400;text-transform:none;letter-spacing:0;color:rgba(246,244,238,.45)}" +
    "#fo-onb select.fo-ob-input{appearance:auto;-webkit-appearance:auto}" +
    ".fo-ob-act{display:flex;gap:12px;justify-content:flex-end;margin-top:22px}" +
    ".fo-ob-cta{background:" + TERRA + ";color:#F6F4EE;border:none;padding:12px 22px;border-radius:11px;font-weight:700;font-size:14px;cursor:pointer}.fo-ob-cta:hover:not(:disabled){background:" + TERRA2 + "}.fo-ob-cta:disabled{opacity:.4;cursor:default}" +
    ".fo-cta-danger{background:" + TERRA + "}" +
    ".fo-ob-ghost{background:transparent;color:rgba(246,244,238,.8);border:1px solid rgba(246,244,238,.2);padding:12px 20px;border-radius:11px;font-weight:600;font-size:14px;cursor:pointer}.fo-ob-ghost:hover{background:rgba(246,244,238,.06)}" +
    // money screen
    ".fo-ob-jobs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:8px 0 18px}" +
    ".fo-ob-job{display:flex;gap:12px;align-items:center;background:rgba(11,19,34,.4);border:1px solid rgba(246,244,238,.08);border-radius:14px;padding:14px}" +
    ".fo-ob-jic{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:20px;flex:none;background:rgba(77,166,162,.14)}" +
    ".fo-ob-muted{color:rgba(246,244,238,.55);font-size:12px;margin-top:2px}" +
    ".fo-ob-tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 18px}" +
    ".fo-ob-tile{background:rgba(11,19,34,.45);border:1px solid rgba(246,244,238,.09);border-radius:14px;padding:16px}" +
    ".fo-ob-tl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:rgba(246,244,238,.5);font-weight:700}.fo-ob-tv{font-size:23px;font-weight:800;margin:5px 0 2px}.fo-ob-ts{font-size:11.5px;color:rgba(246,244,238,.5)}" +
    ".fo-ob-list{margin:6px 0 16px;padding-left:18px;color:rgba(246,244,238,.78);font-size:13.5px;line-height:1.8}.fo-ob-list b{color:#F6F4EE}" +
    ".fo-ob-warn{background:linear-gradient(90deg,rgba(200,103,74,.18),rgba(200,103,74,.06));border:1px solid rgba(200,103,74,.35);border-radius:12px;padding:12px 14px;color:#f0c3b2;font-size:13px;font-weight:600}" +
    ".fo-ob-note{background:rgba(77,166,162,.08);border:1px solid rgba(77,166,162,.22);border-radius:11px;padding:10px 13px;color:rgba(246,244,238,.7);font-size:12.5px;margin-top:6px}" +
    // selectable cards (style/sponsor)
    ".fo-ob-picks{display:flex;flex-direction:column;gap:12px}.fo-ob-picks-3{gap:12px}" +
    ".fo-ob-pick{text-align:left;background:rgba(11,19,34,.42);border:1.5px solid rgba(246,244,238,.1);border-radius:16px;padding:16px 18px;cursor:pointer;color:#F6F4EE;display:block;width:100%}" +
    ".fo-ob-pick:hover{border-color:rgba(246,244,238,.24)}" +
    ".fo-ob-pick.on{border-color:var(--tc);box-shadow:0 0 0 3px color-mix(in srgb,var(--tc) 26%,transparent)}" +
    ".fo-tone-teal{--tc:" + TEAL + "}.fo-tone-terra{--tc:" + TERRA + "}.fo-tone-gold{--tc:#D9A441}.fo-tone-violet{--tc:#8b6bb1}.fo-tone-danger{--tc:#C84F4A}" +
    ".fo-ob-pick-h{display:flex;align-items:center;gap:10px;margin-bottom:3px}.fo-ob-pick-name{font-size:16px;font-weight:800;color:var(--tc)}" +
    ".fo-ob-rec{background:rgba(77,166,162,.16);color:" + TEAL + ";font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 9px;border-radius:999px;border:1px solid rgba(77,166,162,.3)}" +
    ".fo-ob-est{margin-left:auto;text-align:right;font-size:10px;color:rgba(246,244,238,.5);text-transform:uppercase;letter-spacing:.04em}.fo-ob-est b{display:block;font-size:16px;color:#F6F4EE;letter-spacing:0}" +
    ".fo-ob-pick-tag{color:rgba(246,244,238,.62);font-size:12.5px;margin-bottom:10px}" +
    ".fo-ob-pick-grid{display:flex;gap:22px}.fo-ob-pick-grid>div{display:flex;flex-direction:column}.fo-ob-pick-grid span{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:rgba(246,244,238,.45);font-weight:700}.fo-ob-pick-grid b{font-size:15px;margin-top:2px}.fo-ob-pick-grid .fo-risk{color:var(--tc)}" +
    ".fo-ob-splines{margin:0 0 8px;padding-left:16px;font-size:12.5px;color:rgba(246,244,238,.78);line-height:1.6}" +
    ".fo-ob-scen{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.fo-ob-scen span{background:rgba(11,19,34,.4);border-radius:9px;padding:7px 8px;text-align:center;font-size:13px;font-weight:700}.fo-ob-scen i{display:block;font-style:normal;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:rgba(246,244,238,.45);margin-bottom:3px;font-weight:700}" +
    // draft room
    ".fo-ob-draftwrap{max-width:1180px;margin:0 auto}" +
    ".fo-dr-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px;flex-wrap:wrap}" +
    ".fo-dr-hstat{display:flex;gap:8px;flex-wrap:wrap}.fo-dr-hstat span{background:rgba(28,36,51,.7);border:1px solid rgba(246,244,238,.1);border-radius:10px;padding:8px 13px;font-size:12px;color:rgba(246,244,238,.6)}.fo-dr-hstat b{color:#F6F4EE;margin-left:5px}" +
    ".fo-dr-grid{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}" +
    ".fo-dr-main{background:linear-gradient(160deg,#1C2433,#111B2B);border:1px solid rgba(246,244,238,.09);border-radius:16px;padding:14px}" +
    ".fo-dr-filters{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center}" +
    ".fo-dr-chip{background:rgba(11,19,34,.5);border:1px solid rgba(246,244,238,.12);color:rgba(246,244,238,.72);border-radius:999px;padding:6px 13px;font-size:12px;cursor:pointer;font-weight:600}.fo-dr-chip.on{background:" + TERRA + ";border-color:" + TERRA + ";color:#fff}" +
    ".fo-dr-searchi{margin-left:auto;background:rgba(11,19,34,.5);border:1px solid rgba(246,244,238,.12);color:#F6F4EE;border-radius:10px;padding:7px 12px;font-size:12.5px;min-width:150px;font-family:inherit}.fo-dr-searchi:focus{outline:none;border-color:" + TEAL + "}" +
    ".fo-dr-tblwrap{max-height:60vh;overflow:auto;border-radius:10px}" +
    ".fo-dr-tbl{width:100%;border-collapse:collapse;font-size:13px}" +
    ".fo-dr-tbl thead th{position:sticky;top:0;background:#141d2c;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:rgba(246,244,238,.5);font-weight:700;padding:8px 10px;border-bottom:1px solid rgba(246,244,238,.1)}" +
    ".fo-dr-tbl tbody td{padding:9px 10px;border-bottom:1px solid rgba(246,244,238,.06);color:rgba(246,244,238,.86)}.fo-dr-tbl .r{text-align:right}" +
    ".fo-dr-tbl tbody tr:hover td{background:rgba(246,244,238,.03)}.fo-dr-in td{background:rgba(200,103,74,.1) !important}" +
    ".fo-dr-nm{font-weight:600;color:#F6F4EE}.fo-dr-nat{color:rgba(246,244,238,.5);font-size:11px}" +
    // compact per-row skill bars (mirrors the squad view)
    ".fo-sk-wrap{display:flex;flex-direction:column;gap:3px;min-width:118px}" +
    ".fo-sk{display:flex;align-items:center;gap:5px;font-size:9px}" +
    ".fo-sk i{font-style:normal;width:26px;letter-spacing:.4px;color:rgba(246,244,238,.45)}" +
    ".fo-sk b{flex:1;height:5px;border-radius:3px;background:rgba(246,244,238,.1);overflow:hidden;display:block}" +
    ".fo-sk u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ")}" +
    ".fo-sk em{font-style:normal;width:18px;text-align:right;font-size:9.5px;color:rgba(246,244,238,.65);font-variant-numeric:tabular-nums}" +
    ".fo-rl{background:rgba(77,166,162,.14);color:" + TEAL + ";font-size:10px;font-weight:700;padding:2px 7px;border-radius:6px}" +
    ".fo-dr-add{width:28px;height:28px;border-radius:8px;border:1px solid " + TERRA + ";background:" + TERRA + ";color:#fff;font-size:16px;font-weight:700;cursor:pointer;line-height:1}.fo-dr-add.on{background:rgba(11,19,34,.4);color:" + TERRA + "}" +
    ".fo-dr-side{display:flex;flex-direction:column;gap:12px;position:sticky;top:12px}" +
    ".fo-fc{background:linear-gradient(160deg,#1C2433,#0e1626);border:1px solid rgba(246,244,238,.1);border-radius:16px;padding:16px}" +
    ".fo-fc-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:" + TEAL + ";font-weight:800;margin-bottom:10px}" +
    ".fo-fc-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;font-size:12.5px;color:rgba(246,244,238,.62);border-bottom:1px solid rgba(246,244,238,.05)}.fo-fc-row b{color:#F6F4EE;font-weight:700}" +
    ".fo-fc-end{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:11px 13px;border-radius:11px;background:rgba(11,19,34,.5);border:1px solid var(--tc)}.fo-fc-end span{font-size:12px;color:rgba(246,244,238,.7)}.fo-fc-end b{font-size:19px;color:var(--tc)}" +
    ".fo-fc-health{margin-top:8px;text-align:center;font-size:12px;color:rgba(246,244,238,.6)}.fo-fc-health b{color:var(--tc);font-weight:800}" +
    ".fo-fc-scens{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:10px}.fo-fc-scen{background:rgba(11,19,34,.45);border-radius:9px;padding:7px 9px;font-size:12px}.fo-fc-scen span{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:rgba(246,244,238,.45);font-weight:700}.fo-fc-scen b{color:var(--tc)}" +
    ".fo-dr-shape{display:flex;gap:6px;justify-content:space-between}.fo-sh{flex:1;background:rgba(28,36,51,.7);border:1px solid rgba(246,244,238,.08);border-radius:11px;padding:9px 4px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:rgba(246,244,238,.5);font-weight:700}.fo-sh b{display:block;font-size:18px;color:#F6F4EE}" +
    ".fo-adv-panel{background:rgba(28,36,51,.6);border:1px solid rgba(246,244,238,.09);border-radius:16px;padding:14px}.fo-adv-h{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:rgba(246,244,238,.55);font-weight:800;margin-bottom:8px}" +
    ".fo-adv{font-size:12.5px;line-height:1.5;padding:8px 11px;border-radius:10px;margin-bottom:6px;border-left:3px solid}.fo-adv:last-child{margin-bottom:0}" +
    ".fo-adv-warn{background:rgba(217,164,65,.1);border-color:#D9A441;color:#e8cf9a}.fo-adv-danger{background:rgba(200,79,74,.12);border-color:#C84F4A;color:#eab3b0}.fo-adv-ok{background:rgba(77,166,109,.1);border-color:#4DA66D;color:#a9d9ba}.fo-adv-info{background:rgba(77,166,162,.08);border-color:" + TEAL + ";color:rgba(246,244,238,.7)}" +
    ".fo-dr-act{max-width:none;justify-content:space-between;margin-top:16px}.fo-dr-needs{text-align:right;color:rgba(246,244,238,.5);font-size:12px;margin-top:6px}" +
    // risk + report
    ".fo-ob-risk{text-align:center;background:linear-gradient(160deg,#2a1a1a,#1a0f14);border-color:rgba(200,79,74,.4)}.fo-risk-ic{width:60px;height:60px;border-radius:50%;background:rgba(200,79,74,.18);border:1px solid rgba(200,79,74,.4);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 14px}.fo-risk-amt{color:#e58b86}.fo-risk-list{display:inline-block;text-align:left}.fo-ob-risk .fo-ob-act{justify-content:center}" +
    ".fo-ob-check{display:flex;align-items:center;gap:8px;justify-content:center;font-size:13px;color:rgba(246,244,238,.8);margin:8px 0;cursor:pointer}.fo-ob-check input{width:17px;height:17px;accent-color:" + TERRA + "}" +
    ".fo-ob-report{max-width:640px;margin:0 auto}.fo-br-head{display:flex;align-items:center;gap:14px;margin-bottom:16px}.fo-br-crest{width:56px;height:56px;border-radius:13px;background:rgba(11,19,34,.5);border:1px solid rgba(246,244,238,.14);display:flex;align-items:center;justify-content:center;padding:6px}.fo-br-crest img{width:100%;height:100%;object-fit:contain}" +
    ".fo-br-grid{background:rgba(11,19,34,.4);border:1px solid rgba(246,244,238,.08);border-radius:14px;overflow:hidden}.fo-br-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid rgba(246,244,238,.06);font-size:13.5px;color:rgba(246,244,238,.7)}.fo-br-row:last-child{border-bottom:none}.fo-br-row b{font-size:15px}" +
    ".fo-br-advice{margin-top:14px;background:rgba(77,166,162,.07);border:1px solid rgba(77,166,162,.2);border-radius:14px;padding:14px 16px}.fo-br-advh{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:" + TEAL + ";font-weight:800;margin-bottom:5px}.fo-br-advice p{margin:0;font-size:13.5px;line-height:1.55;color:rgba(246,244,238,.82)}" +
    ".fo-tone-teal{color-scheme:normal}b.fo-tone-teal,.fo-tone-teal>b{color:" + TEAL + "}b.fo-tone-terra{color:" + TERRA + "}b.fo-tone-gold{color:#e0b45c}b.fo-tone-danger{color:#e58b86}" +
    "@media(max-width:820px){.fo-dr-grid{grid-template-columns:1fr}.fo-dr-side{position:static}.fo-ob-tiles,.fo-ob-jobs{grid-template-columns:1fr}.fo-ob-card{padding:22px 18px}.fo-ob-h1{font-size:22px}}" +
    // beat the engine's default button/input styling inside the onboarding shell
    "#fo-onb button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-onb .fo-ob-cta{background:" + TERRA + " !important;color:#F6F4EE !important;border:none !important}" +
    "#fo-onb .fo-ob-ghost{background:transparent !important;color:rgba(246,244,238,.82) !important;border:1px solid rgba(246,244,238,.22) !important}" +
    "#fo-onb .fo-ob-crest{background:rgba(11,19,34,.55) !important;color:#F6F4EE !important}" +
    "#fo-onb .fo-ob-pick{background:rgba(11,19,34,.42) !important;color:#F6F4EE !important}" +
    "#fo-onb .fo-dr-add{background:" + TERRA + " !important;color:#fff !important}#fo-onb .fo-dr-add.on{background:rgba(11,19,34,.55) !important;color:" + TERRA + " !important}" +
    "#fo-onb .fo-dr-chip{background:rgba(11,19,34,.55) !important;color:rgba(246,244,238,.72) !important}#fo-onb .fo-dr-chip.on{background:" + TERRA + " !important;color:#fff !important}" +
    "#fo-onb .fo-ob-input,#fo-onb .fo-dr-searchi{background:rgba(11,19,34,.5) !important;color:#F6F4EE !important}" +
    "#fo-onb .fo-dr-tbl tbody tr td{background:transparent !important}" +
    "#fo-onb .fo-dr-tbl tbody tr.fo-dr-in td{background:rgba(200,103,74,.15) !important}" +
    "#fo-onb .fo-dr-tbl tbody tr:hover td{background:rgba(246,244,238,.045) !important}" +
    "#fo-onb .fo-dr-view{cursor:pointer;border-bottom:1px dotted rgba(246,244,238,.35)}#fo-onb .fo-dr-view:hover{color:" + TEAL + "}" +
    // player skill-summary popover
    "#fo-pd .fo-pd-back{position:fixed;inset:0;z-index:100001;background:rgba(8,16,29,.7);display:flex;align-items:center;justify-content:center;padding:16px}" +
    "#fo-pd .fo-pd-card{background:linear-gradient(160deg,#1C2433,#0e1626);border:1px solid rgba(246,244,238,.12);border-radius:18px;padding:20px 22px;width:100%;max-width:420px;box-shadow:0 24px 60px rgba(0,0,0,.5);color:#F6F4EE}" +
    "#fo-pd .fo-pd-h{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}" +
    "#fo-pd .fo-pd-nm{font-size:19px;font-weight:800}#fo-pd .fo-pd-meta{font-size:12px;color:rgba(246,244,238,.6);margin-top:3px}" +
    "#fo-pd .fo-pd-x{background:transparent;border:1px solid rgba(246,244,238,.2);color:rgba(246,244,238,.8);width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:14px}" +
    "#fo-pd .fo-pd-money{display:flex;gap:8px;margin:14px 0}#fo-pd .fo-pd-money span{flex:1;background:rgba(11,19,34,.5);border:1px solid rgba(246,244,238,.08);border-radius:10px;padding:8px 10px;font-size:10.5px;text-transform:uppercase;letter-spacing:.03em;color:rgba(246,244,238,.5);font-weight:700}#fo-pd .fo-pd-money b{display:block;font-size:14px;color:#F6F4EE;margin-top:2px;letter-spacing:0}" +
    "#fo-pd .fo-pd-sec{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:" + TEAL + ";font-weight:800;margin-bottom:8px}" +
    "#fo-pd .fo-pd-bar{display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:12px}#fo-pd .fo-pd-bar span{width:78px;color:rgba(246,244,238,.7)}#fo-pd .fo-pd-bar i{flex:1;height:8px;background:rgba(246,244,238,.08);border-radius:5px;overflow:hidden}#fo-pd .fo-pd-bar b{display:block;height:100%;background:linear-gradient(90deg," + TEAL + "," + TERRA + ");border-radius:5px}#fo-pd .fo-pd-bar em{width:74px;text-align:right;font-style:normal;color:rgba(246,244,238,.62);font-size:11px}" +
    "#fo-pd .fo-pd-tal{margin:12px 0;font-size:12.5px;color:rgba(246,244,238,.72)}#fo-pd .fo-pd-tal b{color:rgba(246,244,238,.55);text-transform:uppercase;font-size:10.5px;letter-spacing:.04em}" +
    "#fo-pd button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-pd .fo-pd-act{display:flex}#fo-pd .fo-pd-add{flex:1;background:" + TERRA + " !important;color:#fff !important;border:none;padding:11px;border-radius:10px;font-weight:700;font-size:13.5px;cursor:pointer}#fo-pd .fo-pd-add.on{background:rgba(11,19,34,.5) !important;color:" + TERRA + " !important;border:1px solid " + TERRA + "}" +
    // league standings — form pips + leader/user accents
    ".fo-standings td,.fo-standings th{padding:6px 8px}" +
    ".fo-standings tr.fo-lead td{box-shadow:inset 3px 0 0 " + TEAL + "}" +
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
        brand.style.cursor = "pointer"; brand.title = "Club home";
        // the app icon is a Home button
        brand.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/club"; if (typeof window.route === "function") window.route(); });
      }
      var mk = function (label, cls, fn) { var el = document.createElement("a"); el.className = cls; el.href = "#"; el.textContent = label; el.addEventListener("click", function (e) { e.preventDefault(); fn(); }); return el; };
      var status = tb.querySelector("#fo-top-status");
      // Practice Game (and, for founders only, an Admin link) live with the main nav,
      // inserted just before the game's right-hand status block.
      var addNav = function (cls, label, fn) {
        var a = tb.querySelector("a." + cls); if (!a) a = mk(label, cls, fn);
        if (status) tb.insertBefore(a, status); else tb.appendChild(a);
      };
      addNav("fo-friendly", "Practice Game", startFriendly);
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
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) { alert("No clubs to play yet — log in to your league first."); if (!(LG && SYNC)) openLeagueMenu(); return; }
      foMatchSetup(null);
    } catch (e) { try { alert("Could not open Practice Game: " + ((e && e.message) || e)); } catch (_) {} say(e); }
  }
  var FO_PITCHES = ["balanced", "flat", "green", "dry", "slow", "cracked", "twoPaced"];
  function foTitle(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }
  function foMatchSetup(preIx) {
    try {
      if (typeof GD === "undefined" || !GD.teams || GD.teams.length < 2) { alert("No clubs to play yet."); return; }
      var ex = document.getElementById("fo-setup"); if (ex) ex.remove();
      var opts = GD.teams.map(function (t, i) { return i === App.teamIx ? "" : "<option value='" + i + "'" + (i === preIx ? " selected" : "") + ">" + E(t.name) + "</option>"; }).join("");
      var pitchOpts = FO_PITCHES.map(function (p) { return "<option value='" + p + "'>" + foTitle(p) + "</option>"; }).join("");
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
  function foPlayFriendly(fr) { foChallenge(fr.oppIx, fr.pitch, fr.weather); }

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
  function foPitchPill(p) { var c = /green|dry|cracked/.test(p) ? "teal" : "muted"; return "<span class='fo-pill fo-pill-" + c + "'>" + E(foTitle(p)) + "</span>"; }
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
        stat("terra", "🏆", "League position", pos, "/ " + (rowsL.length || 10)) +
        stat("teal", "⭐", "Points", me.pts || 0, (me.pts || 0) + " Pts") +
        stat("terra", "🏦", "Bank", foMoney(bank), "Available funds") +
        stat("teal", "💳", "Weekly wages", foMoney(wages), "Total wage bill") +
        stat("terra", "👥", "Supporters", mood, "Mood") + "</div>";

      // Recent results
      var recent = (App.results || []).slice(-4).reverse();
      var recentBody = recent.length
        ? "<table class='fo-tbl'><thead><tr><th>Date</th><th>Match</th><th class='r'>Result</th></tr></thead><tbody>" +
          recent.map(function (r) { return "<tr class='fo-rowlink' data-sc='" + r.ix + "'><td>" + E(r.date || "") + "</td><td>" + E(r.home) + " v " + E(r.away) + "</td><td class='r'>" + E(r.result ? r.result.text : "") + "</td></tr>"; }).join("") + "</tbody></table>"
        : "<div class='fo-empty'><div class='fo-empty-ic'>🗓</div><div><b>No matches played yet</b><div class='small'>First ball coming up soon.</div></div></div>";

      // Upcoming fixtures (+ friendlies), with a Set-lineup action
      var frRows = (foFriendlies || []).map(function (fr, i) {
        return "<tr class='fo-fx-fr'><td>Now</td><td>Friendly</td><td>vs " + E(fr.oppName) + "</td><td>" + foPitchPill(fr.pitch) + "</td><td class='r'><button class='fo-fr-play' data-i='" + i + "'>Play</button></td></tr>";
      }).join("");
      var ups = foUserFixtures().slice(0, 5).map(function (x) {
        return "<tr><td>" + x.date + "<div class='fo-t'>9:00 AM ET</div></td><td>R" + (x.round + 1) + "</td><td>" + (x.isHome ? "vs " : "@ ") + E(x.opp.name) + "</td><td>" + E(x.ground) + " " + foPitchPill(x.pitch) + "</td><td class='r'><button class='fo-setr' data-r='" + x.round + "'>Set lineup</button></td></tr>";
      }).join("");
      var upBody = (frRows || ups)
        ? "<table class='fo-tbl'><thead><tr><th>Date</th><th>Rd</th><th>Match</th><th>Ground</th><th class='r'></th></tr></thead><tbody>" + frRows + ups + "</tbody></table>"
        : "<div class='fo-empty'><div class='fo-empty-ic'>🏏</div><div><b>Season complete</b></div></div>";

      // Leaders
      var ld = foTeamLeaders(t);
      var leaders = "<div class='fo-ch-leaders'>" +
        "<div class='fo-card fo-lead'><div class='fo-lead-ic'>🏏</div><div><div class='fo-card-h2'>Leading run-scorer</div><div class='fo-lead-v'>" + (ld.bat.runs || 0) + " <span>runs</span></div><div class='small'>" + (ld.bat.name ? E(ld.bat.name) : "—") + "</div></div></div>" +
        "<div class='fo-card fo-lead'><div class='fo-lead-ic'>🎯</div><div><div class='fo-card-h2'>Leading wicket-taker</div><div class='fo-lead-v'>" + (ld.bowl.wkts || 0) + " <span>wkts</span></div><div class='small'>" + (ld.bowl.name ? E(ld.bowl.name) : "—") + "</div></div></div></div>";

      // Standings (form pips + row highlight rendered here; kept out of tidyPage)
      var fmap = foFormMap();
      var standRows = rowsL.map(function (x, i) {
        var meRow = x.nm === t.name;
        var fp = (fmap[x.nm] || []).map(function (v) { return "<i class='fo-pip fo-" + v + "'></i>"; }).join("");
        return "<tr class='" + (meRow ? "fo-userrow" : "") + "'><td class='fo-rk'>" + (i === 0 ? "🏆" : (i + 1)) + "</td><td class='fo-scoutname'>" + E(x.nm) + (fp ? " <span class='fo-form'>" + fp + "</span>" : "") + "</td><td class='r'>" + x.p + "</td><td class='r'>" + x.w + "</td><td class='r'>" + x.l + "</td><td class='r'>" + (x.nrr >= 0 ? "+" : "") + x.nrr.toFixed(2) + "</td><td class='r'><b>" + x.pts + "</b></td></tr>";
      }).join("");
      var standings = "<div class='fo-card'><div class='fo-card-h'>League standings</div><div class='fo-card-b'><table class='fo-tbl fo-chtable'><thead><tr><th class='fo-rk'>#</th><th>Club</th><th class='r'>P</th><th class='r'>W</th><th class='r'>L</th><th class='r'>NRR</th><th class='r'>Pts</th></tr></thead><tbody>" + standRows + "</tbody></table></div></div>";

      // Finances
      var fin = "<div class='fo-card'><div class='fo-card-h'>Finances</div><div class='fo-card-b'><table class='fo-kv'>" +
        "<tr><td>Bank</td><td class='r'>" + foMoney(bank) + "</td></tr>" +
        "<tr><td>Weekly wages</td><td class='r'>" + foMoney(wages) + "</td></tr>" +
        "<tr><td>Ground</td><td class='r'>" + E(t.ground || "-") + " · " + (t.seats || 10000).toLocaleString() + " seats</td></tr>" +
        "<tr><td>Stadium condition</td><td class='r fo-teal'>" + cond + "</td></tr></table></div></div>";

      var formPill = pips ? "<span class='fo-hero-pill'>Form <span class='fo-form'>" + pips + "</span></span>" : "<span class='fo-hero-pill'>No matches yet</span>";
      var hero = "<div class='fo-ch-hero'><div class='fo-ch-hero-l'>" +
        "<div class='fo-ch-crest'><img src='" + APPICON + "' alt=''></div><div>" +
        "<div class='fo-ch-eyebrow'>Club home</div><h1 class='fo-ch-name'>" + E(t.name) + "</h1>" +
        "<div class='fo-ch-chips'><span class='fo-ch-chip'>Season " + (App.seasonNo || 1) + "</span><span class='fo-ch-chip'>Round " + (Math.min((S ? S.round : 0) + 1, (S && S.schedule ? S.schedule.length : 9))) + "</span><span class='fo-ch-chip'>" + dateStr + "</span></div>" +
        "</div></div><div class='fo-ch-hero-r'>" + formPill + "</div></div>";

      var html = "<div class='fo-ch'>" +
        "<div class='fo-ch-crumb'>" + E(t.name) + " <span>›</span> Club</div>" + hero + stats +
        "<div class='fo-ch-grid'><div class='fo-ch-col'>" +
        "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Recent results</div><a href='#/matches' class='fo-morelink'>View all results ›</a></div><div class='fo-card-b'>" + recentBody + "</div></div>" +
        "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Upcoming fixtures</div><a href='#/matches' class='fo-morelink'>View full schedule ›</a></div><div class='fo-card-b'>" + upBody + "</div></div>" +
        leaders +
        "</div><div class='fo-ch-col'>" + standings + fin + "</div></div></div>";

      var page = document.getElementById("page"); if (!page) return;
      page.innerHTML = html;
      // wire interactions
      page.querySelectorAll(".fo-rowlink[data-sc]").forEach(function (tr) { tr.addEventListener("click", function () { location.hash = "#/scorecard?i=" + tr.getAttribute("data-sc"); }); });
      page.querySelectorAll(".fo-setr").forEach(function (b) { b.addEventListener("click", function () { foSetOrdersForRound(+b.getAttribute("data-r")); }); });
      page.querySelectorAll(".fo-fr-play").forEach(function (b) { b.addEventListener("click", function () { var fr = foFriendlies[+b.getAttribute("data-i")]; if (fr) foPlayFriendly(fr); }); });
      page.querySelectorAll(".fo-scoutname").forEach(function (c) { c.addEventListener("click", function () { scoutClub(c.textContent || ""); }); });
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
      "<div class='fo-scout-meta'>🏟 " + E(t.ground || "-") + " · Form <span class='fo-form'>" + pips + "</span></div>" +
      "<div class='fo-scout-actions'>" + (isMe ? "" : "<button class='fo-challenge'>🏏 Challenge to a match</button>") + "<button class='fo-scout-back'>← Back</button></div>" +
      "</div>" + kpi + "</div>";
    var links = "<div class='fo-scout-links'>" +
      "<a class='fo-stab" + (foScoutTab === "overview" ? " on" : "") + "' data-tab='overview'>Overview</a>" +
      "<a class='fo-stab" + (foScoutTab === "players" ? " on" : "") + "' data-tab='players'>Players</a></div>";
    var body = foScoutTab === "players" ? foScoutPlayers(t) : foScoutOverview(t, ix);
    return "<div class='crumb'><span>" + E(t.name) + "</span></div><div class='fo-scout'>" + hero +
      "<div class='fo-scout-shell'>" + links + "<div class='fo-scout-body'>" + body + "</div></div></div>";
  }
  function foChallenge(ix, pitch, weather) {
    try {
      try { M = null; } catch (_) {}                       // drop any stale match
      App.tossState = null;
      var me = userTeam();
      App.pending = { oppIx: ix, home: me.name, away: GD.teams[ix].name, ground: me.ground, pitch: pitch || me.homePitch || groundPitch(me.ground), weather: weather || "Sunny", seed: 4200 + ix, date: typeof simDate === "function" ? simDate() : "", comp: "friendly", __friendly: true };
      App.orders.saved = false;                             // must set + save a lineup before it plays
      say("🏏 vs " + GD.teams[ix].name + " — set your lineup, then Save to play.");
      location.hash = "#/orders"; if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }
  function foWireScout(page, ix) {
    page.querySelectorAll(".fo-stab").forEach(function (a) { a.addEventListener("click", function () { foScoutTab = a.getAttribute("data-tab"); page.__scoutSig = null; foRenderScout(); }); });
    page.querySelectorAll(".fo-sortby").forEach(function (a) { a.addEventListener("click", function () { foScoutSort = a.getAttribute("data-s"); page.__scoutSig = null; foRenderScout(); }); });
    var back = page.querySelector(".fo-scout-back"); if (back) back.addEventListener("click", function () { location.hash = "#/matches"; });
    var ch = page.querySelector(".fo-challenge"); if (ch) ch.addEventListener("click", function () { foMatchSetup(ix); });
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
          if (!cell.querySelector(".fo-form")) {                // recent-form pips
            var f = null; for (var k in fmap) { if (name.indexOf(k) >= 0) { f = fmap[k]; break; } }
            if (f && f.length) {
              var sp = document.createElement("span"); sp.className = "fo-form";
              sp.innerHTML = f.map(function (x) { return "<i class='fo-pip fo-" + x + "' title='" + x + "'></i>"; }).join("");
              cell.appendChild(sp);
            }
          }
          di++;
        });
      });
    } catch (e) {}
  }
  var MATCH_TIME = "9:00 AM ET";
  function decorateFixtureTimes() {
    try {
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
  function foOrdersExtras() {
    try {
      if (location.hash.indexOf("#/orders") !== 0) return;
      var page = document.getElementById("page"); if (!page || page.querySelector(".fo-orders-bar")) return;
      var prev = foPreviousOrders();
      var bar = document.createElement("div"); bar.className = "fo-orders-bar";
      bar.innerHTML = "<button class='fo-copyprev'" + (prev ? "" : " disabled title='No previous lineup saved yet'") + ">⧉ Copy previous match orders</button>" +
        "<span class='small'>Reuse your last batting order, captain, keeper and bowling plan.</span>";
      var anchor = page.querySelector(".crumb");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling); else page.insertBefore(bar, page.firstChild);
      var btn = bar.querySelector(".fo-copyprev");
      if (btn && prev) btn.addEventListener("click", function () { foApplyPrevOrders(prev); });
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
      pg.classList.toggle("fo-matchpage", foHashPath() === "#/match" && !!document.querySelector(".mc-top"));
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
    if (pg0 && window.MutationObserver) new MutationObserver(function () { clearTimeout(_mt); _mt = setTimeout(function () { foRenderScout(); decorateFixtureTimes(); tidyPage(); foTagMatchPage(); foRenderPlanner(); foOrdersExtras(); foHidePlayerSkills(); }, 40); }).observe(pg0, { childList: true, subtree: true });
  } catch (e) {}
  if (typeof window.route === "function") { var _rt = window.route; window.route = function () { var r = _rt.apply(this, arguments); bumpBrand(); ensureNav(); foRenderScout(); decorateFixtureTimes(); tidyPage(); foTagMatchPage(); foRenderPlanner(); foOrdersExtras(); foHidePlayerSkills(); return r; }; }
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
        if (App.orders && App.orders.saved) say("🏏 Orders saved — your match resolves at 9:00 AM ET.");
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
  btn.id = "folBtn"; btn.textContent = "🏆 League"; btn.style.display = "none";
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
    return { name: nm, ground: "Neutral Park", players: squad, youth: [], founded: false, homePitch: "balanced", bank: 300000, seats: 9000, supporters: 2600, mood: 3, acadY: 2, acadS: 2 };
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
      var startLabel = SYNC.started ? "Restart season (rebuild from clubs) ▸" : (draftedCount < 2 ? "Start season (you + bots) ▸" : "Start the league ▸");
      var ctl = isF
        ? '<div style="margin-top:10px">' +
            (allReady
              ? '<button class="p" data-act="startLeague">' + startLabel + '</button>' +
                (solo ? '<div class="folsmall" style="margin-top:4px">Empty slots fill with bot clubs to make a full 10-team league. Invite more friends for more human clubs.</div>' : "")
              : '<div class="folsmall">The season starts once every club has drafted.</div>') +
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
    if (!confirm('Permanently delete "' + name + '" — its club, squad and orders? This cannot be undone.')) return;
    rpc("founder_delete_team", { p_league_id: LG.id, p_team_id: id })
      .then(function () {
        // The started league reads its teams from the published snapshot, so the
        // club lingers in the game until the world is rebuilt from the clubs that
        // remain. Offer to do that now (it restarts the season table).
        if (SYNC && SYNC.started) {
          if (confirm('"' + name + '" removed. Rebuild the league now so it disappears from the game? (This restarts the season table from the remaining clubs.)')) { startLeague(); return; }
        }
        say("Deleted " + name + ".");
        showWait(!!(SYNC && SYNC.myTeam));
      }).catch(say);
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
      // While planning a future round, don't auto-push the current round's orders.
      if (SYNC.planRound == null && SYNC.started && window.App && App.orders && App.orders.saved && App.season && typeof GD !== "undefined" && GD.teams) {
        var sig = JSON.stringify(App.orders) + "|" + App.season.round;
        if (sig !== SYNC.lastOrderSig) {
          SYNC.lastOrderSig = sig;
          var pkt = { fo_packet: 1, teamIx: App.teamIx, club: (GD.teams[App.teamIx] || {}).name, round: App.season.round, manager: (SYNC.me && SYNC.me.display_name) || "manager", orders: App.orders };
          rpc("push_packet", { p_league_id: LG.id, p_round: App.season.round, p_packet: pkt }).catch(function () {});
        }
      }
    } catch (e) {}
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
    fetch(URL + "/auth/v1/signup?redirect_to=" + encodeURIComponent(APP_URL), { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password, options: { email_redirect_to: APP_URL } }) })
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
    fetch(URL + "/auth/v1/recover?redirect_to=" + encodeURIComponent(APP_URL), { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email }) })
      .then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error(t || ("HTTP " + r.status)); }); })
      .then(function () { say("If that email has an account, a reset link is on its way."); renderLogin(); }).catch(say);
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
    rpc("redeem_invite", { p_code: code, p_display_name: dn, p_team_name: tn || dn + " XI" })
      .then(function (mid) { lsDel(PEND); return sel("members", "id=eq." + mid + "&select=league_id"); })
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
  // ===========================================================================
  //  FIRST-LOGIN ONBOARDING + DRAFT FINANCE FLOW
  //  8 branded screens that teach the finance model through choices + a live
  //  forecast, then hand the drafted squad to the engine's founderConfirm(). All
  //  finance constants come from finance-config.json (embedded below).
  // ===========================================================================
  var FO_FIN = {
    seasonLength: 18, homeMatches: 9, startingBank: 1000000, ticketPrice: 8, groundCost: 45000,
    health: [{ label: "Excellent", min: 250000 }, { label: "Safe", min: 100000 }, { label: "Tight", min: 25000 }, { label: "Danger", min: 0 }, { label: "Crisis", min: null }],
    styles: [
      { id: "balanced", name: "Balanced", draftBudget: 800000, reserve: 200000, risk: "Low", rec: true, tone: "teal", tag: "Sustainable growth for new managers." },
      { id: "win_now", name: "Win Now", draftBudget: 925000, reserve: 75000, risk: "High", rec: false, tone: "terra", tag: "Spend big on stars." },
      { id: "moneyball", name: "Moneyball", draftBudget: 700000, reserve: 300000, risk: "Medium", rec: false, tone: "violet", tag: "Save cash and hunt value." }
    ],
    sponsors: [
      { id: "community", name: "Community Sponsor", pos: "Safe money. No bonuses.", base: 3500, win: 0, halfway: 0, seasonTop3: 0, champ: 0, tone: "teal", rec: true, lines: ["+$3,500 per matchday", "No bonuses"] },
      { id: "results", name: "Results Sponsor", pos: "Win more, earn more.", base: 2000, win: 3500, halfway: 0, seasonTop3: 0, champ: 0, tone: "terra", lines: ["+$2,000 per matchday", "+$3,500 per win"] },
      { id: "contender", name: "Contender Sponsor", pos: "Back your XI.", base: 0, win: 6000, halfway: 15000, seasonTop3: 20000, champ: 25000, tone: "gold", lines: ["+$6,000 per win", "+$15k top-3 halfway", "+$20k top-3 finish · +$25k champion"] }
    ],
    scenarios: [
      { id: "bad", name: "Bad season", wins: 5, crowd: 4000, t3half: false, t3fin: false, champ: false },
      { id: "average", name: "Average season", wins: 9, crowd: 6000, t3half: false, t3fin: false, champ: false },
      { id: "good", name: "Top-3 season", wins: 13, crowd: 8000, t3half: true, t3fin: true, champ: false },
      { id: "champion", name: "Champion season", wins: 15, crowd: 9500, t3half: true, t3fin: true, champ: true }
    ]
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
    var end = bankAfter + ticket + sponsor - seasonWage - FO_FIN.groundCost;
    return { draftSpent: draftSpent, bankAfter: bankAfter, dailyWage: dailyWage, seasonWage: seasonWage, ticket: ticket, sponsor: sponsor, ground: FO_FIN.groundCost, end: end, health: foHealth(end) };
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
  // Club crest artwork (supplied brand assets, auto-cropped to the shield and
  // compressed to ~6KB webp each so the single-file build stays lean).
  var FO_CRESTS = [
    { id: "wolf", nm: "Wolves", img: "data:image/webp;base64,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" },
    { id: "bull", nm: "Bulls", img: "data:image/webp;base64,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" },
    { id: "crown", nm: "Royals", img: "data:image/webp;base64,UklGRkoRAABXRUJQVlA4WAoAAAAQAAAAbwAAbwAAQUxQSEsFAAABoKTtn9u2+Q8IkC7EjEhTyirnyMrdJpSec2TZQynUQDW9JwfICdxtOD3Z9d7LsilQG9GkIxCY//MQfwwBmMmqRYRDSVIqZzcPgkiBcMYq/wD+HslSGkNg5hD+GrSMIUygFoC7o08ARkPgvA4jVGgIE/i2aufU9ujzXM2iIajtdQ+q1ur2Jg2hMnHfHCk5ZELQuAK16lvZEJxJ+6rAbdfjJL5+G1RICHqog4OWbd3y1jAmIbDJU1d2MMGdCjASgo7wQXCgCg9iREOYPDTUCKqRoqFSLDIHHGsxxSKbRHACnoITSBgBZAoJ/9SC3qHY0sme7k48dqIE+wQiRkzwcQJ/2O/j4iSCuX1E9YsLDNKDxdZ22IbKCHM44iNs8gAWOyVPccHoGarRPOTS5XY7UrZr1kSfRm3DGjr2ZJ9AK1XbrgIh9/xHWpwO7d9XtdkkHrEdx6a2h+ZloBBRqUDOt+gJ1HYcxtikHOWd7FzgfFZeVukYxv0BpuyFK9LjPFtXp3IjDvmM0iH5ZVjnrTm5ukFscdCPEc2mamNVzrVcXuIh33ZMBDPrnLc6vlwLVY9mlrFVV+XjY7Pubaugu9TmU+Uf8rnLR2x1pEzzy/hDHBgWcUV6AgCE8ORK2BsTFKLaJRtC0e975YKkXJKB2lbKlB7in/1BJgmlLvuzXICRbmveD5TK1HUwiDIbXsEdcv8vmIfRYJRfgpQ9Fa76cy2DrWjKWWGKIm2qcDczNdELhbHvo/61PmXag2aqHRXIpU5LuGDIKnW+QwvaFqYVbvC2310LdzewW/KH2lUpwzW5ID0xZS6bIFWjy46Zhu0uecIYmzvFj88AK0vtywXfEw1BCGYKbmyQKNYaUethhCZH08KFSaDgotUhzUsbd0jGDNQ6jiJDa61JvzMtBC8BtmFHYc0pom0Iz+/Sh6SHmM8WzVOjaGjoaOqoMGuPjPGqSJMb/KVzNRalTqdGQ5OjglNELlcRzU9judR6T3fLAN+I9mhiWeKNY4SyFCgcm9n//uNfNtBax7HW+oZiuyyQywZjTkOtbxBEVAZ0HA0Nt2dnzozsDKblw6oFGBfV0LFeuNb123xKAIgp7smVDcNVVqkABx7GqJCGjgV+5h6cAWQ9idQ0JNc/sS4NrObAvI4KasK1TovkRjXCdYXJtH6rf7lHFWWAwc0eQKuXc0CT6q6vtesAQG7YOW8vdQO1nbmWNqQ+0wl2U4UuA9PPu1BfzwU9pBo3UzreNjQKZjr2ipzlHCCr6CHuxcVx8GMB7NkcA2lRVOBx6rc+07maeRDI9ZbpylGlNc4oWn6IWBz7vrkD4HQU55BCvwXAHAC3vbbey/Wgp6ZIe7gzQxX89Ht+YVjhKxVm/47a6FsjpvYk4pGGNn7enUzTZ3Q36NxES3AAoCBq329brPIcRuZ2ueIBgA0wPRcQjdZF96AhZqsOUBj7vkpOMji9FxukcNWj9t7qH2SVc+ymZEIORbb0hfEZPgPMDlFTaVMeIhL3AlK+8TscEuYLibb2Mcsqii9xvckqvo6I5DeJ1PRDs725xtfUk6srb17bJfvC+LgSfAKcwj8QJbBm3yh5q2GuLDBB3HrypEUDbs69jpijn/bibnF8gXqzyeAu3JYZ6QppTRzPGLdWqgAnH11aWfJPHAA49RpiXPb/IIP9P5PgLLhvGsBOJeo7Fy9NwdGnQqTcedOrwJ1bmJT9v2vZr46y2ppmVmph3RaMpCSfJh6crThrCckloZva5j3QOI9x2YC60nvYAcexrcMXx7TLmAT0Y7DvHCaRTvD9LURNHoNzdvVNHRcFAABWUDgg2AsAADAzAJ0BKnAAcAA+YSiQRiQiIaEr1HyggAwJaADRfiDavmT+b8160v3n8WcKuaHs0zm/7f1SeYB+s3Si/rvoA/Yf9ZveJ/4fqh/Y32AP6r/qvSV9l70AP2q9Nr9wPhH/t//J9Ir//5zL2O/4Lw78WPr722zlX3v/aeZXe/8OtQL1X/m97b1H/QegF64/M/87+Zf989ILUp7c+wB+of/D5Cz6z/mf8B7gH8t/rn/L/wvuwfz3/a8un5z/hP+x/jfgJ/kX9K/3H52/6H52fZB+1/sn/rk4Qx+DIXjdOiM94HdJehaB9NfdEYO3ZuWnsCoJuclALnd4pSXU55Upl8/JJrNa4fFMYguUYrYTdW4g5XR5n0rc3ZknKo6XeQIxTcWRTPwN8XMuDvPpG1Oex2K5EsMXZv93stiBkfsAwCtGRbwj2hpMO/Ew6Uxl+t4jIpjdzZMjJAzl0uCh3UatOyGcR/Ns/4eZu/ULug0C5JjOiZRuDVJLFnxu0h/pYqQOQ+X5CeeFOyVd5g30Bic72FKyS0HK90nkFos/oEC/7O7Z82Mnq0AA/v58lLSijMALKK9kwaD2dlIA7I71JosB427J5MHh8EcOm6wAVdNEDba79rfnNIDx6KPXnmIeNCev2GQD+hHDjhjFzPfqnkgzcTlNb92uEZ4zkIOBiYNChMjvY/Y+TxP/+cju8u/kbwS+JTjXR5hkO9se5CK/cXHq0nP8+56wOwK1kc+ddbbTC9hXg5g988XsTP2cHcJ/HLnXg/qARiYwYpnj15b84kpAYSGUKC8LcyroYPgTwAxihcEh53krbrGUAhmUTMElU1+36Z65OLyB6ypcsLG1smP8gb/gXqz6xfit0abYlZcOQXRwL3+r+V6jBVzQwxWmrigaFBvIaZr6jolatH4scv01+hFvHxXBT7ppb8X4B9KbkKqpPxAjByZr5yVB0qGayG3jbjTntGPkVYmHxnT2f1rb7oOoPn+nGziglECZIHZ9hByyLx4osd3i/3VieP3yp7+rzyXUxr5cMFV1vV+y9cTIoapEy621ixSzGKt5d2zTdAboraDuLqGK77XbQE5+iml+OFa+rFtw3gn1mxhX1QfSUR2a1cnvAEI80b8MaHP0HCVkD4PUIhKZdZrRhxia1YEHQye/Fv0cMCliYwf0BNMaM5qcJmFggaZLohcQlD/WaB+e5Khe4VWRQnIoYPsAE7qFJASht/4ealbHVZqdVew/A38K6nyY8ByvYQW2pB5ZKNAvoLx8etC7kUIRa5z2PNGbfBH/JUE2cnlnbV1gz+YzqL1LIhh3KrT2emwAWu/TGZf0lksmW5M9gueZgn2Dh8chZmBfjqZqzAhZYGWhjyts4+2SopVKCy97LGm3dId9Ex5Qx99Dy8R2LfUfYF5fB4lG/Hmg1j0BnyRhXOtHMiVluonHFcEUtcZCji5FFH2wisnjsjwnpx+WygGB4gNAObbxpj9RkeOyg7Ftw1h091ACKsoLMvyPS3X/ZD60v5IZVnl0gdIpnf+IH+/tXJmUdJGq+g5zQLkFOHXJ+bxjAZOX9ozE9VfnvsCYW3SpIBPQ/UkpQirDRHlWYaix2ohuQ6b9PZYELw5ex0DqNmdj/AoCjadUcXjH+PHTbaxiyj7Gp/iG4SC4cTK1tb+Iscujtf0jtr4YWRG1yu1Hnw45LqlZ9XO6HFnF6T4HuDLsKxApiHdmeapr3/i5uPaX42U1As/XmjiGy4e5gBDh/zXkMF/5QJCyRHdOE/v+hvaxx2snMXH/hzNA2y5ZpA8MJTDaK2DH2HabXDHWheGpcoiR8FukG8KIWp6Sf17sGa7PCvsHg5XaDbWVNhm9pvQII5ssA6Rfaf3ao2H5LWrVJQp4dcGma/fvKB7hrv8nPSTr00XiVBw4ggfgVPz725jGU8yxJH9v6QV8YsUdyBOKntjWU1RLUBiqstF6alag3/WEgDKWsQw7EM/BgzX7SH3kwWZmutnUt8+ltj4fPzEggZVIjZ6L9muxRrOKWrMkIv5+2hTa0x5zJ7WFFtGqOox/SjtHXfkh4zkd5RqUoygwGtgcTLl8S1MRRGEOG+hVJH+R/ZXYV17pXw4Nr2I/zck3m/a3UOimZqglYkfXyfcuJrqN306Vt7AD9kzisNnFP/VookGfzhEc/WfWSgVCip3eLPyxY4PsGerwnWBLbKCyHOk1pypFu5N620MdSeFEVN8W8p+K8w8Eg6n+jWE1d4Krm3s93R7z0upEYiNYuCs0SP3iFLvWTvDz/P0pLikrKBhAKJnv6tYaPa4rlyM6u944J0DSWouHcRUdrv5yUc1xsT1M7+6d/w4exQisbT3UyP03iTs0SDN8yU908hO4jrvriOiONcx3nhEJ1HajgWcCJgILwQhUsCrsqsYmgxU9S8ybp5Yv4tJlxQArSadOwtgmdDtgIosxl2JhymYT5vvq9W5hoEwqfjw+iXuqf6ODnqvlvITImQ2GPTsP1V49zAjP6yqBHkyBU5zn2pixLaFL1qb5h8QrT+ngXVIV4cDWT1MD6/SsmYQJ1HbuqfovDsS4BJqUyTpsb0hi5e9k+B/K929/xhsVvebza58U2Zb+inIp4GldXRrSp5XET+SHisBZsPX5MIfWtUCa3wXAXnIseUFwrn3gyu1NUrBuRYoGHKOVOSJMPky8+vbly8e5S1Y6WYxnBGWabpZoIYFhb2qUvZPLdsAWBHWJ/jlJMIs9ihBltd4WTT/CWQ8sH2lfNnAQpG6KZHAAF/77y+UBQdAd82m7dD75456/jIU/ghbZ9zs2rWzfYU2DAvt0CstO/+f/+jsTvseY9gFCe7m+4mrP1UKbQBW1wOmyxfTr45+zLyda7PxqeAtopDPP9kX0NF0tBqCsXDG+5kuYwvYmwNFWHvx+A3ORbBbwDaJ/9e7fDLaS/iBO+q86V27l841njxXeLksy1XjRmwvgMy1Du63a69in5URM/ng/w8baw35/6QNbNxIT2F2/bmsd8x3jVbCQYIB56HQ8PFUxIHuXSQdDqK1+MWS7AIKvfwkWMbhS6bBLffQuxSPQ/GHWQ/yqK1oMOci4LnbOFYPCccPWQHUcmwHsuSaOnbSzu/yVLOEkWol5D1nknn/M37xkeEI9pLgOkRdRAfHrqfFKNQoJi1l3hCLu0KrTM6//VfMONQeahEuLs06Bt3LRSAHAH9A/tKk7mrpFCJmNRx7Y1F/FAHOsRYM7mEy68YXAwCGwRDCdiFRnUhK3HoThUL1TpasZbe4MaMihH+U6Z48kuVZ6L6vazwuEPflA4JaUjZPy+lxEnv7+dwOArf4zXJQUeGBoLE3LlxVQoS6vJ8R3pIv+aR3jc4hLHx1twScP76/WZXj/pKLB88qfbfb8V5uTLKDssTfptfFsIx6MY/BIQd3Rs/chkxFc06d8OUlKPxXWN2rFtSvO0VR3p3ztv2jv4Hx6mQvfnLUXgfOBuVzN/eP5mVgh+ZXyy6F5nz9nkwecYqGogULuRrHbJBM0jiPkoaNdSsaTL99Xq8D1oUBjnDygOi0c/78Nai9ALmun1Jzf9kGWs2aHiVJ6eDjDR7nBkepVJ1a1LHL3QmCJbzsTuLvPF0L8MxfT3cbE386Wp5yyNHH/ulWcIC0u5WU82CLX/nLogA0+7WcPzRfoODS8qw3w+Nj/PijG8GRETzGQw5Rx4LpKjuPm7svzRW4vwV7N4ZqlVoxvsuHXinV7OOoAmFcU9v0meI21wx3nEjZSkKICPXygf/yVrqb8+TWmT+U2E8CNTncVYV73TSn87Qha2CtHv4Kb3AFRDsztCOyMZ3iuP+IbCrvxA7q2tVqK81U5Qtkdw+5EvUfArMgdi1GpJx6tK4Pgint/1aQmbsCAc77gob4vDr+cEuODiX5/6SVjdFghVS/3f7bYh+yptbJRkoIpnKlCT98Bs2AcCUyGteOBDJn3BofUhsgHtvMbzk55wj8bxR6kr63WyXTPYy4ZeZZ1CgnNFfh7nkNqxLcSlTFDuhaRMyQD3JDlGfBV2KXedWwmrOn/bymJqKtb+yf2EtLG4hq7wAAA" },
    { id: "star", nm: "Stars", img: "data:image/webp;base64,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" },
    { id: "tiger", nm: "Tigers", img: "data:image/webp;base64,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" },
    { id: "hawk", nm: "Hawks", img: "data:image/webp;base64,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" },
    { id: "wave", nm: "Breakers", img: "data:image/webp;base64,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" },
    { id: "mountain", nm: "Summits", img: "data:image/webp;base64,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" }
  ];
  var FO_STEPS = ["Club", "Money", "Style", "Sponsor", "Draft", "Report"];
  function foOnbShell(stepIx, body) {
    var prog = FO_STEPS.map(function (s, i) {
      var cls = i < stepIx ? "done" : (i === stepIx ? "on" : "");
      return "<div class='fo-ob-step " + cls + "'><span class='fo-ob-dot'>" + (i < stepIx ? "✓" : (i + 1)) + "</span><span class='fo-ob-slbl'>" + s + "</span></div>";
    }).join("<span class='fo-ob-sep'></span>");
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
      FO_ONB = { team: team, step: 1, needsSetup: needsSetup, country: team.country || NAT[0], clubName: team.name || "", crest: 0, ground: (team.name ? team.name + " Oval" : "Riverview Oval"), style: "balanced", sponsor: "community", scenario: "average", role: "all", riskAck: false };
      foOnbCreate();
    } catch (e) {
      // never leave a new manager on a blank screen — fall back to the engine's draft
      console.warn("Fifty Overs onboarding failed, using the standard draft:", e);
      try { if (!App.founder || !App.founder.pool) App.founder = { name: team.name || "New Club", budget: 1000000, pool: buildCountryPool(team.draft_seed || "fo", team.country || "ENG"), picked: [], identity: "Balanced XI", __league: { league_id: (LG && LG.id) || null, team_id: team.id } }; openWrap(false); window.pgFounder(); }
      catch (e2) { say(e2); }
    }
  }
  window.__foOnb = { start: foOnbStart, draft: foOnbDraft, report: foOnbReport, risk: foOnbRisk, forecast: foForecast, state: function () { return FO_ONB; } };

  // ---- Screen 1 · Create your club -----------------------------------------
  function foOnbCreate() {
    FO_ONB.step = 1;
    var crests = FO_CRESTS.map(function (c, i) {
      return "<button type='button' class='fo-ob-crest " + (FO_ONB.crest === i ? "on" : "") + "' data-crest='" + i + "' title='" + E(c.nm) + "'><img src='" + c.img + "' alt='" + E(c.nm) + "'></button>";
    }).join("");
    var ctyOpts = NAT.map(function (c) { return "<option value='" + E(c) + "'" + (FO_ONB.country === c ? " selected" : "") + ">" + E(c) + "</option>"; }).join("");
    var ctyField = FO_ONB.needsSetup
      ? "<label class='fo-ob-lbl'>Home country <span class='fo-ob-hint'>— you draft players from here</span></label><select id='fo-ob-cty' class='fo-ob-input'>" + ctyOpts + "</select>"
      : "";
    var body =
      "<div class='fo-ob-card fo-ob-narrow'>" +
      "<div class='fo-ob-wordmark'>" + FO_ICON.replace("width='100%' height='100%'", "width='58' height='58'") + "<div><div class='fo-ob-wm1'>FIFTY <span>OVERS</span></div><div class='fo-ob-wm2'>Strategize · Draft · Outthink</div></div></div>" +
      "<h1 class='fo-ob-h1'>Welcome to Fifty Overs</h1>" +
      "<p class='fo-ob-lead'>You are taking over a new club in a 10-team league. Season 1 lasts <b>18 matchdays</b> and you start with <b>$1,000,000</b>.<br>Your job: draft a squad, set your XI, survive the season.</p>" +
      "<label class='fo-ob-lbl'>Club name</label><input id='fo-ob-name' class='fo-ob-input' maxlength='28' value='" + E(FO_ONB.clubName) + "' placeholder='Riverview Rangers'>" +
      "<label class='fo-ob-lbl'>Choose a crest</label><div class='fo-ob-crests'>" + crests + "</div>" +
      "<label class='fo-ob-lbl'>Home ground</label><input id='fo-ob-ground' class='fo-ob-input' maxlength='30' value='" + E(FO_ONB.ground) + "' placeholder='Riverview Oval'>" +
      ctyField +
      "<div class='fo-ob-act'><button class='fo-ob-cta' id='fo-ob-c1'>Continue</button></div></div>";
    var host = foOnbMount(0, body);
    host.querySelectorAll(".fo-ob-crest").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.crest = +b.getAttribute("data-crest"); foOnbCreate(); }); });
    host.querySelector("#fo-ob-c1").addEventListener("click", function () {
      var nm = (host.querySelector("#fo-ob-name").value || "").trim();
      if (nm.length < 2) { host.querySelector("#fo-ob-name").focus(); return; }
      FO_ONB.clubName = nm; FO_ONB.ground = (host.querySelector("#fo-ob-ground").value || "").trim() || (nm + " Oval");
      App.founder.name = nm;
      if (!FO_ONB.needsSetup) { foOnbMoney(); return; }
      // First visit: save the club (name + country) to the league and build the
      // draft pool from the server-issued seed. Manager name comes from signup —
      // never asked twice.
      var cty = (host.querySelector("#fo-ob-cty") || {}).value || FO_ONB.country || NAT[0];
      var btn = host.querySelector("#fo-ob-c1"); btn.disabled = true; btn.textContent = "Saving…";
      rpc("create_league_team", { p_league_id: LG.id, p_team_name: nm, p_manager_name: (SYNC && SYNC.me && SYNC.me.display_name) || "Manager", p_country: cty })
        .then(function (team) {
          SYNC.myTeam = team; FO_ONB.team = team; FO_ONB.needsSetup = false; FO_ONB.country = team.country || cty;
          App.founder.pool = buildCountryPool(team.draft_seed || nm, team.country || cty);
          App.founder.__league.team_id = team.id;
          foOnbMoney();
        })
        .catch(function (e) { btn.disabled = false; btn.textContent = "Continue"; say(e); });
    });
  }

  // ---- Screen 2 · How your money works -------------------------------------
  function foOnbMoney() {
    FO_ONB.step = 2;
    var tile = function (l, v, s, tone) { return "<div class='fo-ob-tile fo-tone-" + (tone || "") + "'><div class='fo-ob-tl'>" + l + "</div><div class='fo-ob-tv'>" + v + "</div>" + (s ? "<div class='fo-ob-ts'>" + s + "</div>" : "") + "</div>"; };
    var body =
      "<div class='fo-ob-card'>" +
      "<div class='fo-ob-eyebrow'>How your money works</div>" +
      "<h1 class='fo-ob-h1'>Your $1,000,000 has two jobs</h1>" +
      "<div class='fo-ob-jobs'><div class='fo-ob-job'><span class='fo-ob-jic fo-tone-teal'>🏏</span><div><b>1 · Build the squad</b><div class='fo-ob-muted'>Draft prices are paid once.</div></div></div>" +
      "<div class='fo-ob-job'><span class='fo-ob-jic fo-tone-terra'>🛡️</span><div><b>2 · Keep the club running</b><div class='fo-ob-muted'>Daily wages every matchday.</div></div></div></div>" +
      "<div class='fo-ob-tiles'>" + tile("Starting bank", "$1,000,000", "Draft + operating money", "teal") +
      tile("Recommended draft spend", "$750k–$850k", "Leaves room to operate", "") +
      tile("Recommended reserve", "$150k–$250k", "Cover wages &amp; injuries", "") + "</div>" +
      "<ul class='fo-ob-list'><li>Every player has a <b>draft price</b> and a <b>daily wage</b>.</li><li>You pay wages every matchday.</li><li>Home matches bring ticket income.</li><li>Wins and sponsors can bring extra money.</li></ul>" +
      "<div class='fo-ob-warn'>⚠ Spend too much in the draft and you may have to release players later.</div>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(1, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbCreate);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbStyle);
  }

  // ---- Screen 3 · Choose your financial style ------------------------------
  function foOnbStyle() {
    FO_ONB.step = 3;
    var cards = FO_FIN.styles.map(function (s) {
      return "<button type='button' class='fo-ob-pick fo-tone-" + s.tone + " " + (FO_ONB.style === s.id ? "on" : "") + "' data-style='" + s.id + "'>" +
        "<div class='fo-ob-pick-h'><span class='fo-ob-pick-name'>" + s.name + "</span>" + (s.rec ? "<span class='fo-ob-rec'>Recommended</span>" : "") + "</div>" +
        "<div class='fo-ob-pick-tag'>" + s.tag + "</div>" +
        "<div class='fo-ob-pick-grid'><div><span>Draft budget</span><b>" + FO$(s.draftBudget) + "</b></div><div><span>Reserve target</span><b>" + FO$(s.reserve) + "</b></div><div><span>Risk</span><b class='fo-risk'>" + s.risk + "</b></div></div></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card'>" +
      "<div class='fo-ob-eyebrow'>Choose your financial style</div>" +
      "<h1 class='fo-ob-h1'>Pick the approach that matches your ambitions</h1>" +
      "<div class='fo-ob-picks'>" + cards + "</div>" +
      "<div class='fo-ob-note'>ⓘ This is a guide, not a lock. You can spend more or less than the suggested budget.</div>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(2, body);
    host.querySelectorAll(".fo-ob-pick").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.style = b.getAttribute("data-style"); foOnbStyle(); }); });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbMoney);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbSponsor);
  }

  // ---- Screen 4 · Choose your sponsor --------------------------------------
  function foOnbSponsor() {
    FO_ONB.step = 4;
    var avg = foScenarioById("average");
    var cards = FO_FIN.sponsors.map(function (s) {
      var est = foSponsorPayout(s, avg);
      return "<button type='button' class='fo-ob-pick fo-tone-" + s.tone + " " + (FO_ONB.sponsor === s.id ? "on" : "") + "' data-sp='" + s.id + "'>" +
        "<div class='fo-ob-pick-h'><span class='fo-ob-pick-name'>" + s.name + "</span>" + (s.rec ? "<span class='fo-ob-rec'>Recommended</span>" : "") + "<span class='fo-ob-est'>Avg season<b>" + FO$(est) + "</b></span></div>" +
        "<div class='fo-ob-pick-tag'>" + s.pos + "</div>" +
        "<ul class='fo-ob-splines'>" + s.lines.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul>" +
        "<div class='fo-ob-scen'>" + ["bad", "average", "good", "champion"].map(function (id) { var sc = foScenarioById(id); return "<span><i>" + sc.name.replace(" season", "") + "</i>" + FO$(foSponsorPayout(s, sc)) + "</span>"; }).join("") + "</div></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card'>" +
      "<div class='fo-ob-eyebrow'>Choose your sponsor</div>" +
      "<h1 class='fo-ob-h1'>Sponsors pay every matchday and for results</h1>" +
      "<div class='fo-ob-picks fo-ob-picks-3'>" + cards + "</div>" +
      "<div class='fo-ob-note'>ⓘ Community = best floor · Results = best middle · Contender = best ceiling. Estimates assume an average season.</div>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue to Draft</button></div></div>";
    var host = foOnbMount(3, body);
    host.querySelectorAll(".fo-ob-pick").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.sponsor = b.getAttribute("data-sp"); foOnbSponsor(); }); });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbStyle);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbDraft);
  }

  function startDraft(team) { foOnbStart(team); }

  // ---- squad shape + advisor -----------------------------------------------
  function foRoleShort(p) {
    if (p.keeper) return "WK";
    if (p.role === "allRounder") return "AR";
    if (p.bowlTypeFull && p.bowlTypeFull !== "none") return (typeof isPace === "function" && isPace(p)) ? "PACE" : "SPIN";
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
    var s = foSquadShape(picked), out = [], st = foStyleById(styleId);
    if (s.wk < 1) out.push({ t: "warn", m: "No wicketkeeper yet — you need at least one." });
    if (s.bowl < 5) out.push({ t: "warn", m: "You have only " + s.bowl + " bowling options. Aim for at least 5 reliable ones." });
    if (fc.end < 0) out.push({ t: "danger", m: "Your wage bill is high — you are projected to lose money this season." });
    else if (fc.bankAfter >= 180000 && s.n >= 8) out.push({ t: "ok", m: "You have kept " + FO$(fc.bankAfter) + " back — room for injuries and mid-season signings." });
    if (fc.draftSpent > st.draftBudget) out.push({ t: "warn", m: "You are over your " + st.name + " draft budget. You can continue, but the club takes on more risk." });
    var ce = null; for (var i = 0; i < picked.length; i++) { if (foDraftPrice(picked[i]) < 40000 && foDailyWage(picked[i]) >= 3200) { ce = picked[i]; break; } }
    if (ce) out.push({ t: "info", m: E(ce.name) + " is cheap to draft but expensive in wages." });
    if (!out.length && s.n >= 11) out.push({ t: "ok", m: "Squad is financially safe and legally shaped." });
    return out;
  }
  function foOnbPick(name) {
    var F = App.founder, p = null; for (var i = 0; i < F.pool.length; i++) if (F.pool[i].name === name) { p = F.pool[i]; break; }
    if (!p) return;
    var ix = F.picked.indexOf(p);
    if (ix >= 0) { F.picked.splice(ix, 1); }
    else {
      var spent = F.picked.reduce(function (s, q) { return s + foDraftPrice(q); }, 0);
      if (spent + foDraftPrice(p) > FO_FIN.startingBank) { return; }   // can't exceed $1M
      if (F.picked.length >= 16) return;
      F.picked.push(p);
    }
    foOnbDraft(true);
  }
  function foTalentName(t) { return String(t || "").replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }).trim(); }
  // Aggregate skill (0-100) via the engine's own summary functions.
  function foAgg(p, nm) { try { return Math.max(0, Math.min(100, Math.round(({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField, end: aggEnd, tech: aggTech })[nm](p)))); } catch (e) { return 0; } }
  // Compact labelled skill bar for the draft table (same idea as the squad view).
  function foSkillCell(p) {
    var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var rows = [["BAT", foAgg(p, "bat")]];
    if (p.keeper) rows.push(["KEEP", foAgg(p, "keep")]);
    else rows.push(["BOWL", isBowler ? foAgg(p, "bowl") : 0]);
    return "<div class='fo-sk-wrap'>" + rows.map(function (r) {
      return "<span class='fo-sk'><i>" + r[0] + "</i><b><u style='width:" + r[1] + "%'></u></b><em>" + r[1] + "</em></span>";
    }).join("") + "</div>";
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
      var barHtml = bars.map(function (b) { var v = Math.max(0, Math.min(100, Math.round(b[1] || 0))); return "<div class='fo-pd-bar'><span>" + b[0] + "</span><i><b style='width:" + v + "%'></b></i><em>" + (word(v) || v) + "</em></div>"; }).join("");
      var talents = (p.talents || []).map(foTalentName).filter(Boolean).join(", ") || "None";
      var inSquad = F.picked.indexOf(p) >= 0;
      var host = document.getElementById("fo-onb"); if (!host) return;
      var old = document.getElementById("fo-pd"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-pd";
      d.innerHTML = "<div class='fo-pd-back'><div class='fo-pd-card'>" +
        "<div class='fo-pd-h'><div><div class='fo-pd-nm'>" + E(p.name) + "</div><div class='fo-pd-meta'><span class='fo-rl'>" + foRoleShort(p) + "</span> " + E(p.nat || "") + " · age " + (p.age || "?") + " · rating " + (p.rating || "-") + "</div></div><button class='fo-pd-x'>✕</button></div>" +
        "<div class='fo-pd-money'><span>Draft<b>" + FO$(foDraftPrice(p)) + "</b></span><span>Daily wage<b>" + FO$(foDailyWage(p)) + "</b></span><span>Season cost<b>" + FO$(foSeasonCost(p)) + "</b></span></div>" +
        "<div class='fo-pd-sec'>Skill summary</div><div class='fo-pd-bars'>" + barHtml + "</div>" +
        "<div class='fo-pd-tal'><b>Talents:</b> " + E(talents) + "</div>" +
        "<div class='fo-pd-act'><button class='fo-pd-add " + (inSquad ? "on" : "") + "'>" + (inSquad ? "− Remove from squad" : "+ Add to squad") + "</button></div>" +
        "</div></div>";
      host.appendChild(d);
      d.querySelector(".fo-pd-x").addEventListener("click", function () { d.remove(); });
      d.querySelector(".fo-pd-back").addEventListener("click", function (e) { if (e.target.classList.contains("fo-pd-back")) d.remove(); });
      d.querySelector(".fo-pd-add").addEventListener("click", function () { foOnbPick(p.name); d.remove(); });
    } catch (e) {}
  }

  // ---- Screen 5 · Draft room with live finance forecast --------------------
  function foOnbDraft(keepScroll) {
    FO_ONB.step = 5;
    var F = App.founder;
    var fc = foForecast(F.picked, FO_ONB.sponsor);
    var shape = foSquadShape(F.picked);
    var role = FO_ONB.role || "all";
    var list = F.pool.slice().sort(function (a, b) { return foDraftPrice(b) - foDraftPrice(a); });
    if (role === "bat") list = list.filter(function (p) { return foRoleShort(p) === "BAT"; });
    if (role === "bowl") list = list.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && p.role !== "allRounder"; });
    if (role === "ar") list = list.filter(function (p) { return p.role === "allRounder"; });
    if (role === "wk") list = list.filter(function (p) { return p.keeper; });
    var q = (FO_ONB.search || "").toLowerCase(); if (q) list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; });

    var rows = list.map(function (p) {
      var inSquad = F.picked.indexOf(p) >= 0;
      var dp = foDraftPrice(p), dw = foDailyWage(p), scst = foSeasonCost(p);
      return "<tr class='" + (inSquad ? "fo-dr-in" : "") + "'>" +
        "<td class='fo-dr-nm'><span class='fo-dr-view' data-p='" + E(p.name).replace(/'/g, "&#39;") + "'>" + E(p.name) + "</span></td>" +
        "<td><span class='fo-rl'>" + foRoleShort(p) + "</span></td>" +
        "<td class='fo-dr-skc'>" + foSkillCell(p) + "</td>" +
        "<td class='fo-dr-nat'>" + E(p.nat || "") + "</td><td class='r'>" + (p.age || "?") + "</td>" +
        "<td class='r'>" + FO$(dp) + "</td><td class='r'>" + FO$(dw) + "</td>" +
        "<td class='r' title='Season cost = draft price + daily wage × 18'>" + FO$(scst) + "</td>" +
        "<td class='r'><button class='fo-dr-add " + (inSquad ? "on" : "") + "' data-p='" + E(p.name).replace(/'/g, "&#39;") + "'>" + (inSquad ? "−" : "+") + "</button></td></tr>";
    }).join("");

    var chip = function (id, lbl) { return "<button class='fo-dr-chip " + (role === id ? "on" : "") + "' data-role='" + id + "'>" + lbl + "</button>"; };
    var hTone = foHealthTone(fc.health);
    var fRow = function (l, v, cls) { return "<div class='fo-fc-row " + (cls || "") + "'><span>" + l + "</span><b>" + v + "</b></div>"; };
    var scen = ["bad", "average", "good", "champion"].map(function (id) { var f = foForecast(F.picked, FO_ONB.sponsor, id); return "<div class='fo-fc-scen fo-tone-" + foHealthTone(f.health) + "'><span>" + foScenarioById(id).name.replace(" season", "") + "</span><b>" + FO$s(f.end) + "</b></div>"; }).join("");
    var advisor = foAdvisor(F.picked, fc, FO_ONB.style).map(function (a) { return "<div class='fo-adv fo-adv-" + a.t + "'>" + a.m + "</div>"; }).join("");
    var ready = foSquadReady(F.picked);

    var body =
      "<div class='fo-ob-draftwrap'>" +
      "<div class='fo-dr-head'><div><div class='fo-ob-eyebrow'>Draft room · " + E(FO_ONB.clubName) + "</div><h1 class='fo-ob-h1'>Build your squad</h1></div>" +
      "<div class='fo-dr-hstat'><span>Bank <b>" + FO$(fc.bankAfter) + "</b></span><span>Squad <b>" + shape.n + "/16</b></span><span>Health <b class='fo-tone-" + hTone + "'>" + fc.health + "</b></span></div></div>" +
      "<div class='fo-dr-grid'>" +
      "<div class='fo-dr-main'><div class='fo-dr-filters'>" + chip("all", "All") + chip("bat", "Batters") + chip("bowl", "Bowlers") + chip("ar", "All-rounders") + chip("wk", "Keepers") +
      "<input id='fo-dr-search' class='fo-dr-searchi' placeholder='Search players…' value='" + E(FO_ONB.search || "") + "'></div>" +
      "<div class='fo-dr-tblwrap'><table class='fo-dr-tbl'><thead><tr><th>Player</th><th>Role</th><th>Skills</th><th>Nat</th><th class='r'>Age</th><th class='r'>Draft price</th><th class='r'>Daily wage</th><th class='r'>Season cost</th><th></th></tr></thead><tbody>" + rows + "</tbody></table></div></div>" +
      "<div class='fo-dr-side'>" +
      "<div class='fo-fc'><div class='fo-fc-h'>Club finance forecast</div>" +
      fRow("Draft spent", FO$(fc.draftSpent) + " / $1,000,000") + fRow("Bank after draft", FO$(fc.bankAfter)) +
      fRow("Daily wage bill", FO$(fc.dailyWage)) + fRow("Season wage cost", "−" + FO$(fc.seasonWage)) +
      fRow("Expected ticket income", "+" + FO$(fc.ticket)) + fRow("Expected sponsor income", "+" + FO$(fc.sponsor)) +
      fRow("Expected ground costs", "−" + FO$(fc.ground)) +
      "<div class='fo-fc-end fo-tone-" + hTone + "'><span>Projected season-end bank</span><b>" + FO$s(fc.end) + "</b></div>" +
      "<div class='fo-fc-health fo-tone-" + hTone + "'>Financial health · <b>" + fc.health + "</b></div>" +
      "<div class='fo-fc-scens'>" + scen + "</div></div>" +
      "<div class='fo-dr-shape'><span class='fo-sh'><b>" + shape.bat + "</b> BAT</span><span class='fo-sh'><b>" + shape.bowl + "</b> BOWL</span><span class='fo-sh'><b>" + shape.ar + "</b> AR</span><span class='fo-sh'><b>" + shape.wk + "</b> WK</span></div>" +
      "<div class='fo-adv-panel'><div class='fo-adv-h'>Advisor</div>" + (advisor || "<div class='fo-adv fo-adv-info'>Start adding players to see advice.</div>") + "</div>" +
      "</div></div>" +
      "<div class='fo-ob-act fo-dr-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c' " + (ready ? "" : "disabled") + "># Continue → Board report</button></div>" +
      (ready ? "" : "<div class='fo-dr-needs'>Need 11+ players, a keeper and 5+ bowling options to continue.</div>") +
      "</div>";
    var host = foOnbMount(4, body);
    host.querySelectorAll(".fo-dr-add").forEach(function (b) { b.addEventListener("click", function () { foOnbPick(b.getAttribute("data-p")); }); });
    host.querySelectorAll(".fo-dr-view").forEach(function (b) { b.addEventListener("click", function () { foDraftDetail(b.getAttribute("data-p")); }); });
    host.querySelectorAll(".fo-dr-chip").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.role = b.getAttribute("data-role"); foOnbDraft(); }); });
    var sb = host.querySelector("#fo-dr-search"); if (sb) sb.addEventListener("input", function () { FO_ONB.search = sb.value; var sc = document.querySelector(".fo-dr-tblwrap"); foOnbDraft(); var s2 = document.querySelector("#fo-dr-search"); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbSponsor);
    var c = host.querySelector("#fo-ob-c"); if (c) c.addEventListener("click", foOnbAfterDraft);
    c && (c.textContent = "Continue → Board report");
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
      "<div class='fo-risk-ic'>⚠</div>" +
      "<h1 class='fo-ob-h1'>This squad is projected to finish the season at <span class='fo-risk-amt'>" + FO$s(fc.end) + "</span>.</h1>" +
      "<p class='fo-ob-lead'>You can continue, but your club may face:</p>" +
      "<ul class='fo-ob-list fo-risk-list'><li>Forced player releases</li><li>Blocked signings</li><li>Supporter mood drop</li></ul>" +
      "<label class='fo-ob-check'><input type='checkbox' id='fo-ob-ack' " + (FO_ONB.riskAck ? "checked" : "") + "> I understand the risk</label>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-revise'>Revise squad</button><button class='fo-ob-cta fo-cta-danger' id='fo-ob-cont' disabled>Continue anyway</button></div></div>";
    var host = foOnbMount(4, body);
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
    var matchdayIncome = Math.round((fc.ticket + fc.sponsor) / FO_FIN.seasonLength);
    var hTone = foHealthTone(fc.health);
    var advice = fc.end >= 250000 ? "A strong, well-funded squad with plenty of room for mid-season moves. Play with confidence."
      : fc.end >= 100000 ? "A competitive squad with a healthy reserve. A good sponsor result or home wins will extend your lead."
        : fc.end >= 25000 ? "A competitive squad, but limited room for mid-season signings. A strong sponsor result or home wins will help."
          : fc.end >= 0 ? "You are running close to the line. Win at home and avoid injuries to stay solvent."
            : "The board is concerned. This squad is projected to overspend — expect forced releases unless results are strong.";
    var kv = function (l, v, tone) { return "<div class='fo-br-row'><span>" + l + "</span><b class='fo-tone-" + (tone || "") + "'>" + v + "</b></div>"; };
    var body =
      "<div class='fo-ob-card fo-ob-report'>" +
      "<div class='fo-br-head'><span class='fo-br-crest'><img src='" + FO_CRESTS[FO_ONB.crest].img + "' alt=''></span><div><div class='fo-ob-eyebrow'>Season 1</div><h1 class='fo-ob-h1'>Board Report</h1></div></div>" +
      "<div class='fo-br-grid'>" + kv("Bank after draft", FO$(fc.bankAfter), "teal") + kv("Daily wage bill", FO$(fc.dailyWage)) +
      kv("Projected matchday income", FO$(matchdayIncome), "teal") + kv("Projected season-end bank", FO$s(fc.end), hTone) +
      kv("Financial status", fc.health, hTone) + "</div>" +
      "<div class='fo-br-advice'><div class='fo-br-advh'>Board advice</div><p>" + advice + "</p></div>" +
      "<div class='fo-ob-act'><button class='fo-ob-ghost' id='fo-ob-b'>Back to draft</button><button class='fo-ob-cta' id='fo-ob-done'>Next · Set your XI for Round 1</button></div></div>";
    var host = foOnbMount(5, body);
    host.querySelector("#fo-ob-b").addEventListener("click", function () { foOnbDraft(); });
    host.querySelector("#fo-ob-done").addEventListener("click", foOnbCommit);
  }

  // ---- Screen 8 · commit + hand off to the real club home ------------------
  function foOnbCommit() {
    try {
      var F = App.founder;
      F.name = FO_ONB.clubName; App.founder.identity = foStyleById(FO_ONB.style).name;
      var fc = foForecast(F.picked, FO_ONB.sponsor);
      // remember the onboarding choices + a flag so we never show this flow again
      try {
        window.store("fo_onb_done", "1"); window.store("fo_sponsor", FO_ONB.sponsor);
        window.store("fo_style", FO_ONB.style); window.store("fo_ground", FO_ONB.ground); window.store("fo_crest", String(FO_ONB.crest));
      } catch (e) {}
      var _bank = Math.round(fc.bankAfter);
      // let the engine build the real club record, then re-point finance at the
      // brief's model ($1M is draft + operating money) and store the sponsor.
      var _confirm = window.founderConfirm;
      window.founderConfirm();                         // builds GD.teams[teamIx] + uploads (existing wrapper)
      try {
        var t = GD.teams[App.teamIx];
        if (t) { t.ground = FO_ONB.ground || t.ground; t.sponsor = FO_ONB.sponsor; t.financialStyle = FO_ONB.style; t.bank = _bank; }
        if (App.fin) { App.fin.bank = _bank; App.fin.sponsorBase = Math.round(foSponsorPayout(foSponsorById(FO_ONB.sponsor), foScenarioById("average")) / FO_FIN.seasonLength); }
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

    App.orders.batOrder = xi.map(function (p) { return p.name; });
    App.orders.captain = xi[0].name;
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
        .sort(function (a, b) { return score(byName[b]) - score(byName[a]); });
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

  // Lift the boot veil (injected by build.sh) now that the brand CSS and the right
  // screen are in place — the engine's original UI never gets a frame to flash.
  try { var _bv = document.getElementById("fo-boot"); if (_bv) _bv.parentNode.removeChild(_bv); } catch (e) {}

  // Debug/test handle for the season planner's engine-facing helpers (no behaviour).
  try { window.__fol = { userFixtures: foUserFixtures, fixtureMeta: foFixtureMeta, plannerHTML: foPlannerHTML, smartBowling: foSmartBowling }; } catch (e) {}

  console.info("Fifty Overs League overlay ready.");
})();
