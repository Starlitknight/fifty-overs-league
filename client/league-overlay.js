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
    // ===== mockup-fidelity layer: icons, split create, 3-col picks, draft cards =====
    ".fo-i{vertical-align:-3px;flex:none}" +
    ".fo-ob-mid{max-width:980px;margin:0 auto}" +
    ".fo-ob-cols{display:grid;grid-template-columns:1fr 264px;gap:26px;align-items:start}" +
    ".fo-ob-snap{background:rgba(11,19,34,.45);border:1px solid rgba(246,244,238,.09);border-radius:16px;padding:16px}" +
    ".fo-ob-snaph{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:rgba(246,244,238,.55);font-weight:800;margin-bottom:10px}" +
    ".fo-snap-row{display:flex;gap:11px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(246,244,238,.06)}.fo-snap-row:last-child{border-bottom:none}" +
    ".fo-snap-row i{width:34px;height:34px;border-radius:9px;background:rgba(77,166,162,.12);color:" + TEAL + ";display:flex;align-items:center;justify-content:center;flex:none}" +
    ".fo-snap-row b{display:block;font-size:13.5px}.fo-snap-row span{display:block;font-size:11px;color:rgba(246,244,238,.5)}" +
    ".fo-ob-input:disabled{opacity:.55;cursor:not-allowed}" +
    ".fo-ob-crest{position:relative}" +
    ".fo-ob-crest svg{width:38px;height:38px}" +
    ".fo-ob-ck{position:absolute;right:-7px;bottom:-7px;width:20px;height:20px;border-radius:50%;background:" + TEAL + ";color:#0B1322;display:flex;align-items:center;justify-content:center;border:2px solid #101a2a}" +
    ".fo-ob-jic{color:#F6F4EE}.fo-jic-teal{background:rgba(77,166,162,.16);color:" + TEAL + "}.fo-jic-terra{background:rgba(200,103,74,.16);color:" + TERRA + "}" +
    ".fo-ob-tic{width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;margin-bottom:9px}.fo-tic-teal{background:rgba(77,166,162,.13);color:" + TEAL + "}.fo-tic-terra{background:rgba(200,103,74,.14);color:" + TERRA + "}" +
    ".fo-ob-chks{display:grid;gap:8px;margin:2px 0 16px}" +
    ".fo-ob-chk{display:flex;gap:9px;align-items:center;font-size:13.5px;color:rgba(246,244,238,.8)}.fo-ob-chk b{color:#F6F4EE}.fo-ob-chk i{color:#4DA66D;display:flex}" +
    ".fo-ob-warn{display:flex;gap:9px;align-items:center}.fo-ob-warn i{display:flex;flex:none}" +
    ".fo-ob-note{display:flex;gap:8px;align-items:center}.fo-ob-note i{display:flex;flex:none;color:" + TEAL + "}" +
    ".fo-ob-act-c{justify-content:center}" +
    // 3-col selectable cards (style + sponsor)
    ".fo-pks{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;align-items:stretch}" +
    ".fo-pk{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px;background:rgba(11,19,34,.42);border:1.5px solid rgba(246,244,238,.1);border-radius:16px;padding:16px 15px 14px;cursor:pointer;color:#F6F4EE}" +
    ".fo-pk:hover{border-color:rgba(246,244,238,.24)}" +
    ".fo-pk.on{border-color:var(--tc);box-shadow:0 0 0 3px color-mix(in srgb,var(--tc) 26%,transparent)}" +
    ".fo-rec-ghost{visibility:hidden}" +
    ".fo-pk .fo-ob-rec{margin-bottom:9px}" +
    ".fo-pk-ic{width:46px;height:46px;border-radius:12px;background:color-mix(in srgb,var(--tc) 14%,transparent);color:var(--tc);display:flex;align-items:center;justify-content:center;margin-bottom:7px}" +
    ".fo-pk-name{font-size:16.5px;font-weight:800}" +
    ".fo-pk-tag{font-size:12px;color:rgba(246,244,238,.6);line-height:1.45;min-height:34px;margin-top:2px}" +
    ".fo-pk-rows{width:100%;margin-top:9px;border-top:1px solid rgba(246,244,238,.08);padding-top:4px}" +
    ".fo-pk-row{display:flex;justify-content:space-between;align-items:center;padding:6px 2px;font-size:12px;color:rgba(246,244,238,.55)}.fo-pk-row b{color:#F6F4EE;font-size:12.5px;display:flex;align-items:center;gap:6px}" +
    ".fo-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.fo-dot-teal{background:" + TEAL + "}.fo-dot-terra{background:" + TERRA + "}.fo-dot-gold{background:#D9A441}" +
    ".fo-sp-big{margin:8px 0 2px;font-size:24px;font-weight:800}.fo-sp-big i{display:block;font-style:normal;font-size:10.5px;font-weight:600;letter-spacing:.03em;color:rgba(246,244,238,.5);text-transform:uppercase;margin-top:1px}" +
    ".fo-sp-lines{display:grid;gap:3px;font-size:12px;color:rgba(246,244,238,.75);min-height:52px;margin-top:5px}" +
    ".fo-sp-scen{width:100%;margin-top:10px;background:rgba(11,19,34,.5);border:1px solid rgba(246,244,238,.07);border-radius:11px;padding:8px 11px}" +
    ".fo-sp-sh{display:flex;justify-content:space-between;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:rgba(246,244,238,.42);font-weight:700;padding-bottom:4px}" +
    ".fo-sp-srow{display:flex;justify-content:space-between;font-size:11.5px;color:rgba(246,244,238,.65);padding:3.5px 0;border-top:1px solid rgba(246,244,238,.05)}.fo-sp-srow b{color:#F6F4EE}" +
    // draft player cards (the game's own card, brand-themed)
    ".fo-dr-sorts{margin-top:-4px}.fo-dr-sortlbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:rgba(246,244,238,.4);font-weight:700;margin-right:2px}" +
    ".fo-dr-sort{padding:4px 11px;font-size:11.5px}" +
    ".fo-dr-none{padding:30px;text-align:center;color:rgba(246,244,238,.5)}" +
    ".fo-dc{background:rgba(11,19,34,.42);border:1px solid rgba(246,244,238,.08);border-radius:14px;padding:12px 14px;margin-bottom:10px}" +
    ".fo-dc-in{border-color:rgba(200,103,74,.55);background:rgba(200,103,74,.08)}" +
    ".fo-dc-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}" +
    ".fo-dc-nm{font-size:14.5px;cursor:pointer}.fo-dc-nm:hover{color:" + TEAL + "}" +
    ".fo-dc-meta{font-size:11.5px;color:rgba(246,244,238,.55)}.fo-dc-meta b{color:rgba(246,244,238,.85)}" +
    ".fo-dc-fee{margin-left:auto;font-size:14.5px;font-weight:800}" +
    ".fo-dc-sub{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:11.5px;color:rgba(246,244,238,.55);margin:5px 0 9px}" +
    ".fo-dc-tal{background:rgba(77,166,162,.1);border:1px solid rgba(77,166,162,.3);color:" + TEAL + ";font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px}" +
    ".fo-dc-wage{margin-left:auto;font-variant-numeric:tabular-nums}" +
    ".fo-dc-bars{display:grid;grid-auto-flow:column;grid-template-rows:repeat(3,auto);grid-template-columns:repeat(3,1fr);gap:4px 18px}" +
    ".fo-db{display:flex;align-items:center;gap:7px;font-size:10.5px}" +
    ".fo-db i{font-style:normal;width:60px;color:rgba(246,244,238,.5);flex:none}" +
    ".fo-db b{flex:1;height:5px;border-radius:3px;background:rgba(246,244,238,.09);overflow:hidden;display:block;min-width:40px}" +
    ".fo-db u{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg," + TEAL + "," + TERRA + ")}" +
    ".fo-db em{font-style:normal;width:74px;color:rgba(246,244,238,.75);flex:none;text-align:right;white-space:nowrap}" +
    "#fo-onb .fo-dr-add{width:auto;min-width:58px;padding:7px 15px;font-size:12.5px;border-radius:9px}" +
    // board report split
    ".fo-br-cols{display:grid;grid-template-columns:1fr 250px;gap:18px;align-items:start}" +
    ".fo-br-row span{display:flex;align-items:center;gap:8px}.fo-br-row span i{display:flex;color:rgba(246,244,238,.4)}" +
    ".fo-br-panel{background:rgba(11,19,34,.45);border:1px solid rgba(246,244,238,.08);border-radius:14px;padding:13px 14px;margin-bottom:12px}" +
    ".fo-br-ph{display:flex;justify-content:space-between;font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:rgba(246,244,238,.5);font-weight:800;margin-bottom:9px}.fo-br-ph b{color:#F6F4EE}" +
    ".fo-sq-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:rgba(246,244,238,.6);padding:4px 0}.fo-sq-row>span:first-child{width:86px;flex:none}.fo-sq-row b{margin-left:auto;color:#F6F4EE}" +
    ".fo-sqdots{display:flex;gap:3px}.fo-sqdot{width:7px;height:7px;border-radius:50%;background:rgba(246,244,238,.12)}.fo-sqdot.on{background:" + TEAL + "}" +
    ".fo-fin-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:rgba(246,244,238,.6);padding:4px 0}.fo-fin-row>span{width:46px;flex:none}" +
    ".fo-finbar{flex:1;height:6px;border-radius:3px;background:rgba(246,244,238,.09);overflow:hidden}.fo-finbar u{display:block;height:100%;border-radius:3px}.fo-fin-teal{background:" + TEAL + "}.fo-fin-terra{background:" + TERRA + "}" +
    ".fo-fin-row em{font-style:normal;font-size:10.5px;color:rgba(246,244,238,.7);width:64px;text-align:right;flex:none}" +
    ".fo-fin-end{margin-top:8px;padding-top:8px;border-top:1px solid rgba(246,244,238,.08);font-size:11.5px;color:rgba(246,244,238,.6);display:flex;justify-content:space-between}.fo-fin-end b{font-size:13px}" +
    ".fo-ob-report{max-width:900px}" +
    "@media(max-width:860px){.fo-ob-cols{grid-template-columns:1fr}.fo-pks{grid-template-columns:1fr}.fo-br-cols{grid-template-columns:1fr}.fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none}.fo-pk-tag{min-height:0}.fo-sp-lines{min-height:0}}" +
    // beat the engine's default button/input styling inside the onboarding shell
    "#fo-onb button{font-family:inherit;min-height:0;box-shadow:none}" +
    "#fo-onb .fo-ob-cta{background:" + TERRA + " !important;color:#F6F4EE !important;border:none !important}" +
    "#fo-onb .fo-ob-ghost{background:transparent !important;color:rgba(246,244,238,.82) !important;border:1px solid rgba(246,244,238,.22) !important}" +
    "#fo-onb .fo-ob-crest{background:rgba(11,19,34,.55) !important;color:#F6F4EE !important}" +
    "#fo-onb .fo-pk{background:rgba(11,19,34,.42) !important;color:#F6F4EE !important}" +
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
  // Club crests: simple vector marks (the supplied bitmaps are cut off at the
  // source-canvas edges, so they can never render cleanly — these monoline SVG
  // marks match the brand mockup, weigh ~300 bytes each and scale perfectly).
  function foCrestSvg(tone, inner) {
    return "<svg viewBox='0 0 48 48' fill='none' stroke='" + tone + "' stroke-width='2.8' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + inner + "</svg>";
  }
  var FO_CRESTS = [
    { id: "anchor", nm: "Harbour", tone: "#4DA6A2", d: "<circle cx='24' cy='10' r='4'/><path d='M24 14v24M14 22h20M10 29a14 14 0 0 0 28 0M10 29l-4 3m38-3 4 3' stroke-width='2.8'/>" },
    { id: "lion", nm: "Crown", tone: "#C8674A", d: "<path d='M9 35 12 16l8 9 4-13 4 13 8-9 3 19Z' fill='#C8674A' stroke='#C8674A'/><path d='M9 39h30'/>" },
    { id: "compass", nm: "Compass", tone: "#F6F4EE", d: "<circle cx='24' cy='24' r='16'/><path d='M24 10l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z' fill='#4DA6A2' stroke='#4DA6A2' stroke-width='1.6'/>" },
    { id: "mountain", nm: "Summit", tone: "#F6F4EE", d: "<path d='M5 37 18 15l7 11 5-7 13 18Z'/><path d='M15 20l3 4 3-4' stroke='#4DA6A2'/>" },
    { id: "bats", nm: "Willow", tone: "#C8674A", d: "<path d='M12 8 33 29m3-21L15 29'/><path d='M30 26l6 6m-24-6-6 6' stroke-width='4.6'/><circle cx='24' cy='40' r='4.5' fill='#C8674A' stroke='#C8674A'/>" },
    { id: "tower", nm: "Citadel", tone: "#4DA6A2", d: "<path d='M14 40V16h-3V8h5v4h5V8h6v4h5V8h5v8h-3v24Z'/><path d='M21 40v-8a3 3 0 0 1 6 0v8'/>" },
    { id: "wave", nm: "Breakers", tone: "#4DA6A2", d: "<path d='M8 34c1-12 10-19 19-16 7 3 8 12 2 15-4 2-9 0-9-5 0-3 3-5 5-4'/><path d='M6 40h36' stroke='#C8674A'/>" },
    { id: "star", nm: "Stars", tone: "#D9A441", d: "<path d='M24 7l5 11 12 1.4-9 8 2.7 11.6L24 33l-10.7 6 2.7-11.6-9-8L19 18Z' fill='#D9A441' stroke='#D9A441' stroke-linejoin='round'/>" }
  ];
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
      return "<button type='button' class='fo-ob-crest " + (FO_ONB.crest === i ? "on" : "") + "' data-crest='" + i + "' title='" + E(c.nm) + "'>" + foCrestSvg(c.tone, c.d) + (FO_ONB.crest === i ? "<span class='fo-ob-ck'>" + FO_I("check", 12) + "</span>" : "") + "</button>";
    }).join("");
    var ctyOpts = NAT.map(function (c) { return "<option value='" + E(c) + "'" + (FO_ONB.country === c ? " selected" : "") + ">" + E(c) + "</option>"; }).join("");
    var ctyField = "<label class='fo-ob-lbl'>Home country <span class='fo-ob-hint'>— you draft players from here</span></label>" +
      "<select id='fo-ob-cty' class='fo-ob-input'" + (FO_ONB.needsSetup ? "" : " disabled") + ">" + ctyOpts + "</select>";
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-cols'>" +
      "<div class='fo-ob-colmain'>" +
      "<h1 class='fo-ob-h1'>Found your club</h1>" +
      "<p class='fo-ob-lead'>You're taking over a new club in a 10-team private league. Create your identity before entering the draft.</p>" +
      "<label class='fo-ob-lbl'>Manager name</label><input class='fo-ob-input' value='" + E((SYNC && SYNC.me && SYNC.me.display_name) || "Manager") + "' disabled>" +
      "<label class='fo-ob-lbl'>Club name</label><input id='fo-ob-name' class='fo-ob-input' maxlength='28' value='" + E(FO_ONB.clubName) + "' placeholder='Harbor City CC'>" +
      ctyField +
      "<label class='fo-ob-lbl'>Home ground name</label><input id='fo-ob-ground' class='fo-ob-input' maxlength='30' value='" + E(FO_ONB.ground) + "' placeholder='Harbor Oval'>" +
      "<label class='fo-ob-lbl'>Choose your crest</label><div class='fo-ob-crests'>" + crests + "</div>" +
      "<div class='fo-ob-act'><button class='fo-ob-cta' id='fo-ob-c1'>Continue</button></div>" +
      "</div>" +
      "<aside class='fo-ob-snap'><div class='fo-ob-snaph'>Season 1 snapshot</div>" +
      "<div class='fo-snap-row'><i>" + FO_I("users") + "</i><div><b>10-team league</b></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("calendar") + "</i><div><b>18 matchdays</b></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("coins") + "</i><div><b>$1,000,000</b><span>starting bank</span></div></div>" +
      "<div class='fo-snap-row'><i>" + FO_I("bat") + "</i><div><b>14&#8211;16 player</b><span>squad draft</span></div></div>" +
      "</aside></div></div>";
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
      chk("Home matches bring in ticket income.") + chk("Wins and sponsors bring in extra money.") + "</div>" +
      "<div class='fo-ob-warn'><i>" + FO_I("warn", 17) + "</i>Spend too much in the draft and you may have to release players later.</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(1, body);
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbCreate);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbStyle);
  }

  // ---- Screen 3 · Choose your financial style ------------------------------
  function foOnbStyle() {
    FO_ONB.step = 3;
    var icons = { balanced: "scales", win_now: "trophy", moneyball: "chart" };
    var kv = function (l, v, dot) { return "<div class='fo-pk-row'><span>" + l + "</span><b>" + (dot ? "<i class='fo-dot fo-dot-" + dot + "'></i>" : "") + v + "</b></div>"; };
    var cards = FO_FIN.styles.map(function (s) {
      var dot = s.risk === "Low" ? "teal" : s.risk === "High" ? "terra" : "gold";
      return "<button type='button' class='fo-pk fo-tone-" + s.tone + " " + (FO_ONB.style === s.id ? "on" : "") + "' data-style='" + s.id + "'>" +
        (s.rec ? "<span class='fo-ob-rec'>Recommended</span>" : "<span class='fo-ob-rec fo-rec-ghost'>&nbsp;</span>") +
        "<span class='fo-pk-ic'>" + FO_I(icons[s.id] || "scales", 26) + "</span>" +
        "<span class='fo-pk-name'>" + s.name + "</span>" +
        "<span class='fo-pk-tag'>" + s.tag + "</span>" +
        "<span class='fo-pk-rows'>" + kv("Draft budget", FO$(s.draftBudget)) + kv("Reserve target", FO$(s.reserve)) + kv("Risk level", s.risk, dot) + "</span></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>Choose your strategy</div>" +
      "<h1 class='fo-ob-h1'>Pick an approach to guide your draft and finances</h1>" +
      "<div class='fo-pks'>" + cards + "</div>" +
      "<div class='fo-ob-note'><i>" + FO_I("info", 15) + "</i>This is a guide, not a lock. You can spend more or less than the suggested budget.</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue</button></div></div>";
    var host = foOnbMount(2, body);
    host.querySelectorAll(".fo-pk").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.style = b.getAttribute("data-style"); foOnbStyle(); }); });
    host.querySelector("#fo-ob-b").addEventListener("click", foOnbMoney);
    host.querySelector("#fo-ob-c").addEventListener("click", foOnbSponsor);
  }

  // ---- Screen 4 · Choose your sponsor --------------------------------------
  function foOnbSponsor() {
    FO_ONB.step = 4;
    var icons = { community: "users", results: "target", contender: "trophy" };
    var cards = FO_FIN.sponsors.map(function (s) {
      // headline: the guaranteed matchday money; bonuses listed under it
      var head = s.base > 0 ? FO$(s.base) : "$0";
      var headSub = s.base > 0 ? "per matchday" : "guaranteed";
      var scen = ["bad", "average", "good", "champion"].map(function (id) {
        var sc = foScenarioById(id);
        return "<div class='fo-sp-srow'><span>" + sc.name + " (" + sc.wins + " wins)</span><b>" + FO$(foSponsorPayout(s, sc)) + "</b></div>";
      }).join("");
      return "<button type='button' class='fo-pk fo-pk-sp fo-tone-" + s.tone + " " + (FO_ONB.sponsor === s.id ? "on" : "") + "' data-sp='" + s.id + "'>" +
        (s.rec ? "<span class='fo-ob-rec'>Recommended for most clubs</span>" : "<span class='fo-ob-rec fo-rec-ghost'>&nbsp;</span>") +
        "<span class='fo-pk-ic'>" + FO_I(icons[s.id] || "users", 26) + "</span>" +
        "<span class='fo-pk-name'>" + s.name + "</span>" +
        "<span class='fo-pk-tag'>" + s.pos + "</span>" +
        "<span class='fo-sp-big'>" + head + "<i>" + headSub + "</i></span>" +
        "<span class='fo-sp-lines'>" + s.lines.filter(function (l) { return !(s.base > 0 && /per matchday/.test(l)); }).map(function (l) { return "<span>" + l + "</span>"; }).join("") + "</span>" +
        "<span class='fo-sp-scen'><span class='fo-sp-sh'><span>Season scenario</span><b>Income</b></span>" + scen + "</span></button>";
    }).join("");
    var body =
      "<div class='fo-ob-card fo-ob-mid'>" +
      "<div class='fo-ob-eyebrow'>Choose your sponsor</div>" +
      "<h1 class='fo-ob-h1'>Sponsors provide matchday income and bonuses</h1>" +
      "<div class='fo-pks'>" + cards + "</div>" +
      "<div class='fo-ob-note'><i>" + FO_I("info", 15) + "</i>Community = best floor &middot; Results = best middle &middot; Contender = best ceiling. Estimates are based on an average season.</div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back</button><button class='fo-ob-cta' id='fo-ob-c'>Continue to draft</button></div></div>";
    var host = foOnbMount(3, body);
    host.querySelectorAll(".fo-pk").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.sponsor = b.getAttribute("data-sp"); foOnbSponsor(); }); });
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
  // The engine's skill word ("ordinary", "elite", "world class", …).
  function foWord(v) { try { return (typeof word === "function") ? word(v) : ""; } catch (e) { return ""; } }
  // The game's full 7-skill read-out (Batting/Bowling/Keeping/Endurance/
  // Technique/Power/Fielding), each a bar + the engine's word for it.
  function foSkillBars(p) {
    var isBowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var pw = 0; try { pw = (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) {}
    var bars = [["Batting", foAgg(p, "bat")], ["Bowling", isBowler ? foAgg(p, "bowl") : 0], ["Keeping", foAgg(p, "keep")],
      ["Endurance", foAgg(p, "end")], ["Technique", foAgg(p, "tech")], ["Power", Math.max(0, Math.min(100, Math.round(pw)))],
      ["Fielding", foAgg(p, "field")]];
    return "<div class='fo-dc-bars'>" + bars.map(function (b) {
      return "<span class='fo-db'><i>" + b[0] + "</i><b><u style='width:" + b[1] + "%'></u></b><em>" + (foWord(b[1]) || b[1]) + "</em></span>";
    }).join("") + "</div>";
  }
  // One draft-room player card — the game's own card, in the brand theme.
  function foDraftCard(p, inSquad) {
    var nm = E(p.name).replace(/'/g, "&#39;");
    var bt = (typeof foBT === "function") ? foBT(p) : "";
    var meta = (p.hand === "L" ? "Left" : "Right") + " hand batsman" + (bt ? " | " + bt : "") + (p.expWord || p.exp ? " · exp " + E(p.expWord || p.exp) : "");
    var tals = (p.talents || []).map(function (t) { return "<span class='fo-dc-tal'>" + E(foTalentName(t)) + "</span>"; }).join("");
    return "<div class='fo-dc " + (inSquad ? "fo-dc-in" : "") + "'>" +
      "<div class='fo-dc-h'>" +
      "<span class='fo-rl'>" + foRoleShort(p) + "</span>" +
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
    var sk = FO_ONB.sortKey || "fee";
    var sortVal = function (p) {
      if (sk === "rating") return p.rating || 0;
      if (sk === "bat") return foAgg(p, "bat");
      if (sk === "bowl") return (p.bowlTypeFull && p.bowlTypeFull !== "none") ? foAgg(p, "bowl") : 0;
      if (sk === "power") { try { return (typeof S === "function" ? S(p).power : (p.skills && p.skills.power)) || 0; } catch (e) { return 0; } }
      if (sk === "field") return foAgg(p, "field");
      if (sk === "keep") return foAgg(p, "keep");
      if (sk === "age") return -(p.age || 99);      // youngest first
      return foDraftPrice(p);
    };
    var list = F.pool.slice().sort(function (a, b) { return sortVal(b) - sortVal(a); });
    if (role === "bat") list = list.filter(function (p) { return foRoleShort(p) === "BAT"; });
    if (role === "bowl") list = list.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none" && p.role !== "allRounder"; });
    if (role === "ar") list = list.filter(function (p) { return p.role === "allRounder"; });
    if (role === "wk") list = list.filter(function (p) { return p.keeper; });
    var q = (FO_ONB.search || "").toLowerCase(); if (q) list = list.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; });

    var rows = list.map(function (p) { return foDraftCard(p, F.picked.indexOf(p) >= 0); }).join("");

    var chip = function (id, lbl) { return "<button class='fo-dr-chip " + (role === id ? "on" : "") + "' data-role='" + id + "'>" + lbl + "</button>"; };
    var sChip = function (id, lbl) { return "<button class='fo-dr-chip fo-dr-sort " + (sk === id ? "on" : "") + "' data-sort='" + id + "'>" + lbl + "</button>"; };
    var sortRow = "<span class='fo-dr-sortlbl'>Sort</span>" + sChip("fee", "Price") + sChip("rating", "Rating") + sChip("bat", "Bat") + sChip("bowl", "Bowl") + sChip("power", "Power") + sChip("field", "Field") + sChip("keep", "Keep") + sChip("age", "Age");
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
      "<div class='fo-dr-filters fo-dr-sorts'>" + sortRow + "</div>" +
      "<div class='fo-dr-tblwrap'>" + (rows || "<div class='fo-dr-none'>No players match.</div>") + "</div></div>" +
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
    host.querySelectorAll(".fo-dr-chip[data-role]").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.role = b.getAttribute("data-role"); foOnbDraft(); }); });
    host.querySelectorAll(".fo-dr-sort").forEach(function (b) { b.addEventListener("click", function () { FO_ONB.sortKey = b.getAttribute("data-sort"); foOnbDraft(); }); });
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
      "<div class='fo-risk-ic'>" + FO_I("warn", 26) + "</div>" +
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
    var kv = function (ic, l, v, tone) { return "<div class='fo-br-row'><span><i>" + FO_I(ic, 15) + "</i>" + l + "</span><b class='fo-tone-" + (tone || "") + "'>" + v + "</b></div>"; };
    var shape = foSquadShape(F.picked);
    var dots = function (n, of) { var s = ""; for (var i = 0; i < of; i++) s += "<i class='fo-sqdot" + (i < n ? " on" : "") + "'></i>"; return s; };
    var sqRow = function (l, n, of) { return "<div class='fo-sq-row'><span>" + l + "</span><span class='fo-sqdots'>" + dots(n, of) + "</span><b>" + n + "</b></div>"; };
    var income = fc.ticket + fc.sponsor, costs = fc.ground, wages = fc.seasonWage;
    var mx = Math.max(income, costs, wages, 1);
    var fin = function (l, v, tone) { return "<div class='fo-fin-row'><span>" + l + "</span><b class='fo-finbar'><u class='fo-fin-" + tone + "' style='width:" + Math.round(100 * v / mx) + "%'></u></b><em>" + FO$(v) + "</em></div>"; };
    var body =
      "<div class='fo-ob-card fo-ob-report'>" +
      "<div class='fo-br-cols'><div class='fo-br-main'>" +
      "<div class='fo-br-head'><span class='fo-br-crest'>" + foCrestSvg(FO_CRESTS[FO_ONB.crest].tone, FO_CRESTS[FO_ONB.crest].d) + "</span><div><div class='fo-ob-eyebrow'>Season 1</div><h1 class='fo-ob-h1'>Board Report</h1></div></div>" +
      "<div class='fo-br-grid'>" + kv("wallet", "Bank after draft", FO$(fc.bankAfter), "teal") + kv("coins", "Daily wage bill", FO$(fc.dailyWage)) +
      kv("chart", "Projected matchday income", FO$(matchdayIncome), "teal") + kv("target", "Projected season-end bank", FO$s(fc.end), hTone) +
      kv("shieldCheck", "Financial status", fc.health, hTone) + "</div>" +
      "<div class='fo-br-advice'><div class='fo-br-advh'>" + FO_I("users", 14) + " Board advice</div><p>" + advice + "</p></div>" +
      "</div><aside class='fo-br-side'>" +
      "<div class='fo-br-panel'><div class='fo-br-ph'>Squad overview <b>" + shape.n + "/16</b></div>" +
      sqRow("Batters", shape.bat, 7) + sqRow("Bowlers", shape.bowl, 7) + sqRow("All-rounders", shape.ar, 5) + sqRow("Wicketkeepers", shape.wk, 3) + "</div>" +
      "<div class='fo-br-panel'><div class='fo-br-ph'>Your finances</div>" +
      fin("Income", income, "teal") + fin("Costs", costs, "terra") + fin("Wages", wages, "terra") +
      "<div class='fo-fin-end'>Projected end bank <b class='fo-tone-" + hTone + "'>" + FO$s(fc.end) + "</b></div></div>" +
      "</aside></div>" +
      "<div class='fo-ob-act fo-ob-act-c'><button class='fo-ob-ghost' id='fo-ob-b'>Back to draft</button><button class='fo-ob-cta' id='fo-ob-done'>Next: Set your XI for Round 1</button></div></div>";
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
