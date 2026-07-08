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
    "#folPin{background:#a33328;color:#fff;padding:8px 14px;display:none}";
  document.head.appendChild(css);

  // ---- Fifty Overs identity: navy + terracotta, teal accents (login) ----
  var css2 = document.createElement("style");
  css2.textContent =
    "#folWrap{background:#0B1322 !important}" +
    "#folPanel.fol-navy{background:radial-gradient(circle at top,rgba(77,166,162,.14),transparent 38%),linear-gradient(180deg,#0B1322 0%,#08101D 100%);display:flex;align-items:center;justify-content:center;padding:28px 20px}" +
    "#folPanel.fol-navy .folhd{display:none}" +
    ".fol-card{width:100%;max-width:420px;background:#1C2433;border:1px solid rgba(246,244,238,.12);border-radius:24px;box-shadow:0 24px 60px -20px rgba(0,0,0,.6),0 1px 0 rgba(246,244,238,.03) inset;padding:34px 28px 26px}" +
    ".fol-logo{display:block;width:88px;height:auto;margin:0 auto 20px}" +
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

  // Brand the browser tab: "50" app-icon favicon on a navy rounded square + title.
  try {
    var favSvg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>" +
      "<rect width='64' height='64' rx='15' fill='#0B1322'/>" +
      "<g transform='translate(-1.6,3.3) scale(0.29)'>" + MARK + "</g></svg>";
    var favLink = document.querySelector("link[rel~='icon']") || document.createElement("link");
    favLink.rel = "icon"; favLink.type = "image/svg+xml";
    favLink.href = "data:image/svg+xml," + encodeURIComponent(favSvg);
    document.head.appendChild(favLink);
    document.title = "Fifty Overs";
  } catch (e) { /* non-fatal */ }

  // The "50" app icon, inline, for the in-app header (same mark as the favicon/logo).
  var ICON = "<svg class='fol-hdicon' viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'>" +
    "<rect width='64' height='64' rx='15' fill='#0B1322'/><g transform='translate(-1.6,3.3) scale(0.29)'>" + MARK + "</g></svg>";

  var btn = document.createElement("button");
  btn.id = "folBtn"; btn.textContent = "🏆 League";
  document.body.appendChild(btn);

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

  btn.addEventListener("click", function () { openWrap(true); if (!JWT) renderLogin(); else if (SYNC && LG && SYNC.isFounder) showWait(!!SYNC.myTeam); else enterApp(); });

  // ---- one delegated handler for everything ----
  wrap.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]"); if (!t) return;
    var a = t.getAttribute("data-act");
    if (a === "close") { openWrap(false); return; }
    ev.preventDefault();
    var acts = {
      login: doLogin, logout: function () { JWT = ""; LG = null; SYNC = null; renderLogin(); },
      showLogin: renderLogin, showJoin: renderJoin, showForgot: renderForgot,
      sendReset: sendReset, joinNew: doJoinSignup,
      openId: function () { enterGameById(t.getAttribute("data-id")); }, join: joinLeague,
      setupClub: doSetup, startLeague: startLeague, mkInvite: mkInvite,
      delTeam: function () { delTeam(t.getAttribute("data-id"), t.getAttribute("data-name")); },
      backToGame: function () { openWrap(false); if (typeof window.route === "function") window.route(); }
    };
    if (acts[a]) acts[a]();
  });
  function val(id) { var e = wrap.querySelector("#" + id); return e ? (e.value || "").trim() : ""; }

  function setNavy(on) { var pn = wrap.querySelector("#folPanel"); if (pn) pn.classList.toggle("fol-navy", !!on); }

  // ---- auth (Fifty Overs brand login) ----
  // The "50" mark: three terracotta stumps, a paper "5", and a seamed cricket ball for the "0".
  var LOGO = '<svg class="fol-logo" viewBox="0 0 240 200" xmlns="http://www.w3.org/2000/svg" aria-label="Fifty Overs">' + MARK + '</svg>';
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
        if (d.access_token) { JWT = d.access_token; wrap.querySelector("#folWho").textContent = email; enterApp(); }
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
      if (mine && mine.length) { showWait(true); return; }
      var mt = SYNC.myTeam;
      if (mt && mt.country && mt.draft_seed) { startDraft(mt); return; }
      renderSetup();
    }).catch(function (e) { if (isMissingTable(e)) setupNeeded(); else say(e); });
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
      var allReady = teams.length >= 2 && teams.every(function (t) { return ready[t.manager_id]; });
      var ctl = isF
        ? '<div style="margin-top:10px">' +
            (allReady ? '<button class="p" data-act="startLeague">' + (SYNC.started ? "Restart season (rebuild from clubs) ▸" : "Start the league ▸") + '</button>'
                      : '<div class="folsmall">The season starts once every club has drafted.</div>') +
            '<div style="margin-top:8px"><button class="mini" data-act="mkInvite">Create invite code</button> <span id="folInvite" class="folsmall"></span></div>' +
          "</div>"
        : '<div class="folsmall" style="margin-top:10px">Waiting for the commissioner to start the season.</div>';
      var back = SYNC.started ? '<button class="mini" data-act="backToGame">◂ back to the game</button> ' : "";
      main.innerHTML = '<div class="folbody"><div class="folcard"><h4><span>' + E(LG.name) + (isF ? " · commissioner" : "") + "</span>" +
        (drafted ? '<span class="folbadge ok">you\'re in</span>' : "") + '</h4><div class="folpad">' +
        "<table><tr><th>Club</th><th>Status</th>" + (isF ? "<th></th>" : "") + "</tr>" + rows + "</table>" + ctl +
        '<div style="margin-top:10px">' + back + '<button class="mini" data-act="logout">log out</button></div>' +
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
  function startLeague() {
    sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id").then(function (clubs) {
      if (!clubs || clubs.length < 2) { say("Need at least 2 drafted clubs to start."); return; }
      try {
        GD.teams = clubs.map(function (c) { return c.club; });
        var myName = SYNC.myTeam ? SYNC.myTeam.name : null;
        var mine = GD.teams.findIndex(function (t) { return t.name === myName; });
        App.teamIx = mine >= 0 ? mine : 0;
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
    if (!LG || !SYNC) return;
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
        JWT = d.access_token; wrap.querySelector("#folWho").textContent = email;
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
  // are in a league — then your game IS the league.
  openWrap(true);
  if (!JWT) renderLogin(); else enterApp();

  console.info("Fifty Overs League overlay ready.");
})();
