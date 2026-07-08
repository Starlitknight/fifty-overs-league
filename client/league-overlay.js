/* ============================================================================
   Fifty Overs — LEAGUE overlay. Additive multiplayer inside the real game.
   Adds a floating "🏆 League" button that opens a full multiplayer panel
   (login/join, draft, line-ups, challenges, table, results). Fully namespaced
   and closure-scoped: it never touches the game's globals or engine, and its
   click handling uses delegation (no global onclick names). Your solo game keeps
   working exactly as before.
   ========================================================================== */
(function () {
  "use strict";
  var URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var BUILD_HASH = "e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff";

  var JWT = "", LG = null, TEAMS = {}, MYTEAM = null, MYMEMBER = null, curTab = "table", RES = [];
  // the game's own nationality list — each manager picks one as their home country
  var NAT = ["Australia", "India", "Pakistan", "Sri Lanka", "New Zealand", "South Africa", "England", "Netherlands", "West Indies", "Afghanistan", "Ireland", "Zimbabwe"];

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function say(m) { window.alert((m && m.message || m).toString().slice(0, 400)); }
  function headers() { return { apikey: ANON, Authorization: "Bearer " + (JWT || ANON), "content-type": "application/json", "Accept-Profile": "app", "Content-Profile": "app" }; }
  function rpc(fn, args) { return fetch(URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: headers(), body: JSON.stringify(args || {}) }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t || ("HTTP " + r.status)); return t ? JSON.parse(t) : null; }); }); }
  function sel(table, q) { return fetch(URL + "/rest/v1/" + table + "?" + (q || ""), { headers: headers() }).then(function (r) { return r.text().then(function (t) { if (!r.ok) throw new Error(t); return JSON.parse(t); }); }); }

  // ---- styles + shell ----
  var css = document.createElement("style");
  css.textContent =
    "#folBtn{position:fixed;right:14px;bottom:14px;z-index:2147483000;background:#2c7a2c;color:#fff;border:none;border-radius:22px;padding:10px 16px;font:600 14px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.3);cursor:pointer}" +
    "#folWrap{position:fixed;inset:0;z-index:2147483001;background:rgba(10,14,10,.6);display:none}" +
    "#folWrap.on{display:block}" +
    "#folPanel{position:absolute;inset:0;margin:auto;max-width:780px;background:#12160f;color:#e7ebe2;overflow:auto;font:14px/1.45 system-ui;-webkit-overflow-scrolling:touch}" +
    "@media(min-width:820px){#folPanel{inset:20px;border-radius:12px}}" +
    "#folPanel a{color:#7fb3d5}" +
    ".folhd{position:sticky;top:0;background:#171c12;border-bottom:1px solid #333c2e;padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
    ".folhd h3{margin:0;font-size:15px;flex:1}" +
    ".folbody{padding:12px 14px;display:grid;gap:12px}" +
    ".folcard{background:#1b2016;border:1px solid #333c2e;border-radius:8px}" +
    ".folcard h4{margin:0;padding:8px 12px;border-bottom:1px solid #333c2e;font-size:13px;display:flex;justify-content:space-between}" +
    ".folpad{padding:10px 12px}" +
    ".foltabs{display:flex;gap:6px;flex-wrap:wrap;padding:8px 14px}" +
    ".foltab{padding:6px 12px;border:1px solid #333c2e;border-radius:6px;cursor:pointer;font-size:13px}" +
    ".foltab.on{background:#2c7a2c;color:#fff;border-color:#2c7a2c}" +
    "#folPanel table{width:100%;border-collapse:collapse}#folPanel th,#folPanel td{padding:5px 8px;border-bottom:1px solid #2a3123;text-align:left}" +
    "#folPanel .n{text-align:right;font-variant-numeric:tabular-nums}" +
    "#folPanel input,#folPanel select,#folPanel button{font:inherit;padding:6px 9px;border:1px solid #333c2e;border-radius:6px;background:#12160f;color:#e7ebe2}" +
    "#folPanel button{cursor:pointer}#folPanel button.p{background:#2c7a2c;color:#fff;border-color:#2c7a2c}#folPanel button.mini{padding:2px 8px;font-size:12px}" +
    ".folrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.folsmall{font-size:12px;opacity:.75}" +
    ".folbadge{font-size:11px;padding:1px 6px;border-radius:10px;border:1px solid #333c2e}.folbadge.ok{color:#6fcf6f;border-color:#3f7a3f}.folbadge.warn{color:#e08b7f;border-color:#8a4a3a}" +
    "#folPin{background:#a33328;color:#fff;padding:8px 14px;display:none}";
  document.head.appendChild(css);

  // ---- cricket-themed login (From The Pavilion vibe) ----
  var css2 = document.createElement("style");
  css2.textContent =
    "#folPanel.fol-navy{background:#14305a}" +
    "#folPanel.fol-navy .folhd{background:#102546;border-bottom-color:#26406e}" +
    ".fol-hero{background:#14305a;color:#fff;text-align:center;padding:22px 18px 14px}" +
    ".fol-logo{width:78px;height:78px;border-radius:50%;background:#b5312a;display:flex;align-items:center;justify-content:center;font-size:42px;margin:0 auto 8px;box-shadow:0 3px 10px rgba(0,0,0,.35)}" +
    ".fol-hero h1{font-size:30px;letter-spacing:1px;margin:4px 0 0;font-weight:800;line-height:1.05}" +
    ".fol-hero .fol-tag{color:#cdd8ea;font-size:13.5px;font-weight:600;margin:6px 0 16px}" +
    ".fol-auth{max-width:330px;margin:0 auto;display:flex;flex-direction:column;gap:12px}" +
    "#folPanel .fol-auth input{background:transparent;border:none;border-bottom:2px solid #4a6a9a;color:#fff;border-radius:0;padding:9px 2px;font-size:16px}" +
    "#folPanel .fol-auth input::placeholder{color:#9fb3d0}" +
    "#folPanel .fol-red{background:#b5312a !important;color:#fff !important;border:none !important;border-radius:8px;padding:12px;font-weight:800;font-size:16px;cursor:pointer}" +
    "#folPanel .fol-white{background:#fff !important;color:#14305a !important;border:2px solid #7fb3d5 !important;border-radius:8px;padding:11px;font-weight:800;font-size:16px;cursor:pointer}" +
    ".fol-explain{background:#fff;color:#1a2b40;margin:0 12px 16px;border-radius:12px;padding:16px;box-shadow:0 4px 14px rgba(0,0,0,.25);position:relative;top:-6px}" +
    ".fol-explain p{margin:0 0 12px;font-size:15px;line-height:1.45}" +
    ".fol-explain ul{list-style:none;padding:0;margin:0;display:grid;gap:11px}" +
    ".fol-explain li{display:flex;gap:9px;font-size:14px;line-height:1.4;align-items:flex-start}" +
    ".fol-ball{flex:0 0 auto;width:17px;height:17px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#e5534b,#b01e17);box-shadow:inset -3px -3px 0 rgba(0,0,0,.18);margin-top:2px;position:relative}" +
    ".fol-ball:after{content:'';position:absolute;top:3px;bottom:3px;left:50%;width:1px;background:rgba(255,255,255,.5)}";
  document.head.appendChild(css2);

  var btn = document.createElement("button");
  btn.id = "folBtn"; btn.textContent = "🏆 League";
  document.body.appendChild(btn);

  var wrap = document.createElement("div");
  wrap.id = "folWrap";
  wrap.innerHTML =
    '<div id="folPanel">' +
    '<div class="folhd"><h3>🏏 Fifty Overs — League</h3><span class="folsmall" id="folWho"></span><button data-act="close">✕ close</button></div>' +
    '<div id="folPin"></div><div id="folMain"></div></div>';
  document.body.appendChild(wrap);
  var main = wrap.querySelector("#folMain");

  btn.addEventListener("click", function () { wrap.classList.add("on"); if (!JWT) renderLogin(); else if (LG) renderTabs(); else renderEnter(); });

  // ---- one delegated handler for everything ----
  wrap.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]"); if (!t) return;
    var a = t.getAttribute("data-act");
    if (a === "close") { wrap.classList.remove("on"); return; }
    ev.preventDefault();
    var acts = {
      login: doLogin, signup: doSignup, logout: function () { JWT = ""; LG = null; renderLogin(); },
      open: openLeague, join: joinLeague,
      tab: function () { curTab = t.getAttribute("data-tab"); renderTabs(); },
      setup: doSetup, draft: doDraft,
      issue: issueChallenge, accept: function () { act("accept_challenge", { p_league_id: LG.id, p_challenge_id: t.getAttribute("data-id") }, renderPlay); },
      orders: function () { openOrders(t.getAttribute("data-id")); }, submitOrders: function () { submitOrders(t.getAttribute("data-id")); },
      mkInvite: mkInvite, startSeason: startSeason,
      resetSchedule: function () { if (confirm("Clear all upcoming (unresolved) fixtures?")) act("founder_reset_schedule", { p_league_id: LG.id }, renderAdmin); },
      resetLeague: function () { if (confirm("Wipe ALL matches, results and the demo team? (squads kept)")) act("founder_reset_league", { p_league_id: LG.id }, renderAdmin); },
      removeTeam: function () { if (confirm("Remove your own playing team and become admin-only?")) act("founder_remove_own_team", { p_league_id: LG.id }, function () { openLeagueId(LG.id); }); },
      card: function () { toggleCard(+t.getAttribute("data-i")); }
    };
    if (acts[a]) acts[a]();
  });
  function act(fn, args, then) { rpc(fn, args).then(then).catch(say); }
  function val(id) { var e = wrap.querySelector("#" + id); return e ? (e.value || "").trim() : ""; }

  function setNavy(on) { var pn = wrap.querySelector("#folPanel"); if (pn) pn.classList.toggle("fol-navy", !!on); }

  // ---- auth (cricket-styled login) ----
  function renderLogin() {
    wrap.querySelector("#folWho").textContent = "";
    setNavy(true);
    var ball = '<span class="fol-ball"></span>';
    main.innerHTML =
      '<div class="fol-hero">' +
      '<div class="fol-logo">🏏</div>' +
      '<h1>FIFTY OVERS</h1>' +
      '<div class="fol-tag">Multiplayer Cricket League — play your friends</div>' +
      '<div class="fol-auth">' +
      '<input id="folEmail" type="email" placeholder="email">' +
      '<input id="folPass" type="password" placeholder="password">' +
      '<button class="fol-red" data-act="signup">Create account</button>' +
      '<button class="fol-white" data-act="login">Log in</button>' +
      '</div></div>' +
      '<div class="fol-explain">' +
      "<p>An <b>invite-only</b> cricket manager you play with your friends. Draft a squad, set your tactics, and let the real match engine decide the games — fair and identical for everyone.</p>" +
      '<ul>' +
      '<li>' + ball + '<span><b>Draft your own squad</b> — pick a home country and draft players from it on a tight $1,000,000 budget, in the real draft screen.</span></li>' +
      '<li>' + ball + '<span><b>Challenge your friends</b> to matches — the game engine plays every ball, deterministically, so no one can cheat.</span></li>' +
      '<li>' + ball + '<span><b>Play a full season</b> — a home-and-away league table; matches resolve automatically at your league time.</span></li>' +
      '<li>' + ball + '<span><b>Invite-only</b> — your commissioner runs the league and starts the season once everyone has drafted.</span></li>' +
      '</ul>' +
      '<div class="folsmall" style="margin-top:10px">New here? Tap <b>Create account</b>, then join your league with an invite code.</div>' +
      '</div>';
  }
  function authFetch(kind) {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    if (!email || !password) { say("Enter email + password"); return; }
    var path = kind === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
    fetch(URL + path, { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (d.access_token) { JWT = d.access_token; wrap.querySelector("#folWho").textContent = email; renderEnter(); }
        else say("Account created. If email confirmation is on, confirm then log in.");
      }).catch(say);
  }
  function doLogin() { authFetch("login"); }
  function doSignup() { authFetch("signup"); }

  // ---- enter / join a league ----
  function renderEnter() {
    setNavy(true);
    main.innerHTML =
      '<div class="folbody"><div class="folcard"><h4>Your league</h4><div class="folpad">' +
      '<div class="folrow"><input id="folLg" placeholder="league id" size="26"><button class="p" data-act="open">Open</button></div>' +
      '<div class="folsmall" style="margin:8px 0 4px">— or join a new league —</div>' +
      '<div class="folrow"><input id="folCode" placeholder="invite code"><input id="folDn" placeholder="your name"><input id="folTn" placeholder="team name"><button data-act="join">Join</button></div>' +
      "</div></div></div>";
  }
  function joinLeague() {
    var code = val("folCode"), dn = val("folDn"), tn = val("folTn");
    if (!code || !dn) { say("Enter the invite code and your name"); return; }
    rpc("redeem_invite", { p_code: code, p_display_name: dn, p_team_name: tn || dn + " XI" })
      .then(function (mid) { return sel("members", "id=eq." + mid + "&select=league_id"); })
      .then(function (m) { wrap.querySelector("#folLg") && (wrap.querySelector("#folLg").value = m[0].league_id); return openLeagueId(m[0].league_id); })
      .catch(say);
  }
  function openLeague() { openLeagueId(val("folLg").replace(/[^0-9a-fA-F-]/g, "")); }
  function openLeagueId(id) {
    if (!id) { say("Enter a league id"); return; }
    var pin = wrap.querySelector("#folPin");
    return sel("leagues", "id=eq." + id + "&select=id,name,status,build_hash,draft_budget,season_no").then(function (a) {
      if (!a[0]) { say("League not found (or you are not a member)"); return; }
      LG = a[0];
      if (LG.build_hash !== BUILD_HASH) { pin.style.display = "block"; pin.textContent = "⚠ Your game build differs from this league’s pinned engine."; } else pin.style.display = "none";
      return Promise.all([
        sel("teams", "league_id=eq." + id + "&select=id,name,manager_id,ground"),
        sel("members", "league_id=eq." + id + "&select=id,role,display_name"),
        rpc("resolve_manager_id", { p_league_id: id })
      ]);
    }).then(function (r) {
      if (!r) return; var teams = r[0], mem = r[1], myMid = r[2];
      TEAMS = {}; teams.forEach(function (t) { TEAMS[t.id] = t; });
      MYMEMBER = mem.filter(function (m) { return m.id === myMid; })[0] || null;
      MYTEAM = teams.filter(function (t) { return t.manager_id === myMid; })[0] || null;
      // admins (founders) land on the Admin panel; players on their Squad
      curTab = (MYMEMBER && MYMEMBER.role === "founder") ? "admin" : "squad";
      renderTabs();
    }).catch(say);
  }

  // ---- tabbed shell ----
  function renderTabs() {
    setNavy(false);
    // Admin (founder/commissioner) manages; players play. Distinct experiences.
    var isAdmin = MYMEMBER && MYMEMBER.role === "founder";
    var tabs = isAdmin
      ? [["admin", "Admin"], ["table", "Table"], ["results", "Results"]]
      : [["squad", "Squad"], ["play", "Play"], ["table", "Table"], ["results", "Results"]];
    wrap.querySelector("#folWho").textContent = LG ? LG.name : "";
    main.innerHTML = '<div class="foltabs">' + tabs.map(function (t) { return '<div class="foltab ' + (curTab === t[0] ? "on" : "") + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + "</div>"; }).join("") +
      '<span style="flex:1"></span><button class="mini" data-act="logout">log out</button></div><div id="folTab" class="folbody"></div>';
    ({ squad: renderSquad, play: renderPlay, table: renderTable, results: renderResults, admin: renderAdmin }[curTab])();
  }
  function tabEl() { return wrap.querySelector("#folTab"); }

  // ---- SQUAD (set up team → draft in the game → Start Season) ----
  function renderSquad() {
    var el = tabEl(); el.innerHTML = '<div class="folcard"><div class="folpad folsmall">Loading…</div></div>';
    if (!MYTEAM) { el.innerHTML = '<div class="folcard"><div class="folpad">You have no team here yet. Join with an invite code.</div></div>'; return; }
    Promise.all([
      sel("teams", "id=eq." + MYTEAM.id + "&select=id,name,country,draft_seed,manager_id"),
      sel("squads", "team_id=eq." + MYTEAM.id + "&select=roster,budget_spent,confirmed")
    ]).then(function (r) {
      var team = r[0][0] || MYTEAM; MYTEAM = team;
      var squad = r[1][0] || { roster: [], budget_spent: 0, confirmed: false };
      var roster = squad.roster || [], hasSquad = squad.confirmed && roster.length;
      var html = '<div class="folcard"><h4><span>' + E(team.name || "Your team") + "</span>" +
        (hasSquad ? '<span class="folbadge ok">season started</span>' : '<span class="folbadge warn">no squad yet</span>') + "</h4><div class=folpad>";
      if (!team.country || !team.draft_seed) {
        html += '<div class="folsmall" style="margin-bottom:6px">Pick your home country — you\'ll draft players from it.</div>' +
          '<div class="folrow"><input id="folSetTeam" placeholder="team name" value="' + E(team.name || "") + '"><input id="folSetMgr" placeholder="your name" value="' + E((MYMEMBER && MYMEMBER.display_name) || "") + '"></div>' +
          '<div class="folrow" style="margin-top:6px">Home country <select id="folSetCountry">' + NAT.map(function (c) { return "<option>" + c + "</option>"; }).join("") + "</select></div>" +
          '<div class="folrow" style="margin-top:8px"><button class="p" data-act="setup">Save &amp; continue</button></div>';
      } else {
        html += '<div class="folsmall">Country: <b>' + E(team.country) + "</b> · Budget $1,000,000</div>" +
          '<div class="folrow" style="margin-top:6px"><button class="p" data-act="draft">🏏 ' + (hasSquad ? "Re-draft" : "Draft") + ' your squad</button></div>' +
          '<div class="folsmall" style="margin-top:4px">Opens the draft in the game. Pick 11+ (a keeper + 5 bowlers) in budget, then hit <b>Start Season</b>.</div>';
      }
      html += "</div></div>";
      if (hasSquad) {
        var wk = roster.filter(function (p) { return p.keeper; }).length, bowl = roster.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none"; }).length;
        html += '<div class="folcard"><h4>Your squad</h4><div class=folpad>' +
          '<div class="folsmall">' + roster.length + " players · " + wk + " keeper · " + bowl + " bowling · $" + (squad.budget_spent || 0).toLocaleString() + " spent</div>" +
          "<table><thead><tr><th>Player</th><th>Role</th><th>Bowl</th><th class=n>Rtg</th></tr></thead><tbody>" +
          roster.map(function (p) { return "<tr><td>" + E(p.name) + (p.keeper ? " †" : "") + '</td><td class=folsmall>' + E(p.role || "") + '</td><td class=folsmall>' + E(p.bowlTypeFull && p.bowlTypeFull !== "none" ? p.bowlTypeFull : "—") + '</td><td class=n>' + (p.rating || "") + "</td></tr>"; }).join("") +
          "</tbody></table></div></div>";
      }
      el.innerHTML = html;
    }).catch(say);
  }
  function doSetup() {
    var tn = val("folSetTeam"), mgr = val("folSetMgr"), country = val("folSetCountry");
    if (!tn || !mgr) { say("Enter your team name and your name"); return; }
    rpc("create_league_team", { p_league_id: LG.id, p_team_name: tn, p_manager_name: mgr, p_country: country })
      .then(function () { return openLeagueId(LG.id); }).then(function () { curTab = "squad"; renderTabs(); }).catch(say);
  }
  function doDraft() {
    sel("teams", "id=eq." + MYTEAM.id + "&select=id,name,country,draft_seed").then(function (a) {
      var team = a[0];
      if (!team || !team.country || !team.draft_seed) { say("Set up your team (country) first"); return; }
      launchDraft(team);
    }).catch(say);
  }

  // ---- PLAY ----
  function renderPlay() {
    var el = tabEl(); el.innerHTML = '<div class="folcard"><div class="folpad folsmall">Loading…</div></div>';
    sel("challenges", "league_id=eq." + LG.id + "&select=id,from_team_id,to_team_id,pitch,weather,seed,kickoff_at,status&order=kickoff_at").then(function (ch) {
      var others = Object.keys(TEAMS).filter(function (id) { return !MYTEAM || id !== MYTEAM.id; });
      var opts = others.map(function (id) { return '<option value="' + id + '">' + E(TEAMS[id].name) + "</option>"; }).join("");
      var pitches = ["balanced", "green", "dry", "slow", "cracked", "twoPaced"].map(function (p) { return "<option>" + p + "</option>"; }).join("");
      var wx = ["Sunny", "Overcast", "Chilly", "Humid", "Misty", "Windy"].map(function (w) { return "<option>" + w + "</option>"; }).join("");
      function row(c) {
        var canAccept = MYTEAM && c.to_team_id === MYTEAM.id && c.status === "pending";
        var mine = MYTEAM && (c.from_team_id === MYTEAM.id || c.to_team_id === MYTEAM.id);
        return "<tr><td>" + E(TEAMS[c.from_team_id] ? TEAMS[c.from_team_id].name : "?") + " → " + E(TEAMS[c.to_team_id] ? TEAMS[c.to_team_id].name : "?") + '</td><td class="folsmall">' + E(c.pitch) + " · " + E(c.weather) + '</td><td class="folsmall">' + E((c.kickoff_at || "").replace("T", " ").slice(0, 16)) + '</td><td><span class="folbadge">' + c.status + "</span></td><td>" +
          (canAccept ? '<button class="mini" data-act="accept" data-id="' + c.id + '">accept</button> ' : "") +
          (mine && (c.status === "accepted" || c.status === "pending") ? '<button class="mini" data-act="orders" data-id="' + c.id + '">line-up</button>' : "") + "</td></tr>";
      }
      el.innerHTML =
        '<div class="folcard"><h4>Challenge a friend (friendly)</h4><div class=folpad><div class="folrow">vs <select id="folOpp">' + opts + '</select> <select id="folPitch">' + pitches + '</select> <select id="folWx">' + wx + '</select> <input id="folKo" type="datetime-local"> <button class="p" data-act="issue">Challenge</button></div><div class="folsmall" style="margin-top:4px">Kickoff ≥ 1 hour out. It plays automatically.</div></div></div>' +
        '<div class="folcard"><h4>Matches</h4><div class=folpad><table><thead><tr><th>Fixture</th><th>Cond.</th><th>Kickoff</th><th>Status</th><th></th></tr></thead><tbody>' + (ch.length ? ch.map(row).join("") : '<tr><td colspan=5 class="folsmall">No challenges yet.</td></tr>') + "</tbody></table></div></div>" +
        '<div id="folOrders"></div>';
    }).catch(say);
  }
  function issueChallenge() {
    var to = val("folOpp"), pitch = val("folPitch"), wxv = val("folWx"), ko = val("folKo");
    if (!ko) { say("Pick a kickoff time (≥1h out)"); return; }
    rpc("issue_challenge", { p_league_id: LG.id, p_to_team_id: to, p_pitch: pitch, p_weather: wxv, p_seed: Math.floor(Date.parse(ko) / 60000) % 2000000 + 1, p_kickoff_at: new Date(ko).toISOString() }).then(renderPlay).catch(say);
  }
  function intSel(id, def) { var L = { "-1": "defend", "0": "normal", "1": "attack", "2": "all-out" }; return '<select id="' + id + '">' + [-1, 0, 1, 2].map(function (v) { return '<option value="' + v + '" ' + (v === def ? "selected" : "") + ">" + L[v] + "</option>"; }).join("") + "</select>"; }
  function openOrders(cid) {
    sel("squads", "team_id=eq." + MYTEAM.id + "&select=roster").then(function (s) {
      var roster = (s[0] && s[0].roster) || [];
      var o = roster.map(function (p) { return '<option value="' + E(p.name) + '">' + E(p.name) + (p.keeper ? " †" : "") + "</option>"; }).join("");
      wrap.querySelector("#folOrders").innerHTML =
        '<div class="folcard"><h4>Line-up &amp; tactics</h4><div class=folpad><div class="folrow">Captain <select id="folCapt">' + o + '</select> Keeper <select id="folKeep">' + o + "</select></div>" +
        '<div class="folrow" style="margin-top:6px">Intent — PP ' + intSel("folPP", 0) + " Mid " + intSel("folMid", 0) + " Death " + intSel("folDeath", 1) + "</div>" +
        '<div class="folrow" style="margin-top:8px"><button class="p" data-act="submitOrders" data-id="' + cid + '">Save line-up</button> <span class="folsmall">Engine auto-picks a legal XI; captain/keeper/intent are yours.</span></div></div></div>';
      wrap.querySelector("#folOrders").scrollIntoView({ behavior: "smooth" });
    }).catch(say);
  }
  function submitOrders(cid) {
    rpc("submit_orders", { p_league_id: LG.id, p_fixture_id: null, p_challenge_id: cid, p_orders: { captain: val("folCapt"), keeper: val("folKeep"), phaseIntent: { pp: +val("folPP"), mid: +val("folMid"), death: +val("folDeath") } } })
      .then(function () { say("Line-up saved."); wrap.querySelector("#folOrders").innerHTML = ""; }).catch(say);
  }

  // ---- TABLE ----
  function renderTable() {
    var el = tabEl();
    rpc("league_table", { p_league_id: LG.id }).then(function (rows) {
      el.innerHTML = '<div class="folcard"><h4>League table</h4><div class=folpad><table><thead><tr><th>#</th><th>Club</th><th class=n>P</th><th class=n>W</th><th class=n>L</th><th class=n>T</th><th class=n>NRR</th><th class=n>Pts</th></tr></thead><tbody>' +
        rows.map(function (r) { return "<tr" + (MYTEAM && r.team_id === MYTEAM.id ? ' style="background:rgba(44,122,44,.15)"' : "") + "><td>" + r.pos + "</td><td>" + E(r.team_name) + '</td><td class=n>' + r.p + "</td><td class=n>" + r.w + "</td><td class=n>" + r.l + "</td><td class=n>" + r.t + "</td><td class=n>" + (Number(r.nrr) >= 0 ? "+" : "") + Number(r.nrr).toFixed(3) + "</td><td class=n><b>" + r.pts + "</b></td></tr>"; }).join("") +
        "</tbody></table></div></div>";
    }).catch(say);
  }

  // ---- RESULTS ----
  function renderResults() {
    var el = tabEl();
    sel("results", "league_id=eq." + LG.id + "&select=id,comp,home_team_id,away_team_id,result_text,scorecard,resolved_at&order=resolved_at.desc").then(function (res) {
      RES = res;
      el.innerHTML = '<div class="folcard"><h4>Results</h4><div class=folpad>' + (res.length ? res.map(function (r, i) {
        return '<div style="border-bottom:1px solid #2a3123;padding:6px 0"><div class="folrow" style="justify-content:space-between"><b>' + E(r.result_text) + '</b><span class="folbadge">' + r.comp + '</span></div><div class="folsmall">' + E(TEAMS[r.home_team_id] ? TEAMS[r.home_team_id].name : "?") + " v " + E(TEAMS[r.away_team_id] ? TEAMS[r.away_team_id].name : "?") + ' · <a href="#" data-act="card" data-i="' + i + '">scorecard</a></div><div id="folCard' + i + '" style="display:none"></div></div>';
      }).join("") : '<span class="folsmall">No matches played yet.</span>') + "</div></div>";
    }).catch(say);
  }
  function toggleCard(i) {
    var box = wrap.querySelector("#folCard" + i), r = RES[i];
    if (box.style.display !== "none") { box.style.display = "none"; return; }
    box.style.display = "block";
    box.innerHTML = (r.scorecard || []).filter(Boolean).map(function (inn) {
      return '<div style="margin-top:6px"><b>' + E(inn.batTeam) + " " + inn.runs + "/" + inn.wkts + "</b> (" + inn.overs + ")<table><thead><tr><th>Bat</th><th class=n>R</th><th class=n>B</th><th class=n>4s</th><th class=n>6s</th></tr></thead><tbody>" +
        (inn.batting || []).filter(function (b) { return b.b > 0 || b.out !== "not out"; }).map(function (b) { return "<tr><td>" + E(b.name) + "</td><td class=n>" + b.r + "</td><td class=n>" + b.b + "</td><td class=n>" + b.f4 + "</td><td class=n>" + b.f6 + "</td></tr>"; }).join("") + "</tbody></table></div>";
    }).join("");
  }

  // ---- ADMIN (commissioner) ----
  function renderAdmin() {
    var el = tabEl(); el.innerHTML = '<div class="folcard"><div class="folpad folsmall">Loading…</div></div>';
    Promise.all([
      rpc("league_readiness", { p_league_id: LG.id }),
      sel("teams", "league_id=eq." + LG.id + "&select=id,name,manager_id,country"),
      sel("squads", "league_id=eq." + LG.id + "&select=team_id,confirmed"),
      sel("members", "league_id=eq." + LG.id + "&select=id,role,display_name"),
      sel("invites", "league_id=eq." + LG.id + "&select=code,redeemed_uid&order=created_at")
    ]).then(function (r) {
      var rd = r[0] || { teams: 0, drafted: 0, all_ready: false }, teams = r[1], squads = r[2], mem = r[3], inv = r[4];
      var done = {}; squads.forEach(function (s) { done[s.team_id] = s.confirmed; });
      var mById = {}; mem.forEach(function (m) { mById[m.id] = m; });
      var rows = teams.map(function (t) {
        var m = mById[t.manager_id] || {};
        return "<tr><td>" + E(t.name) + '</td><td class=folsmall>' + E(m.display_name || "") + (m.role === "founder" ? " (admin)" : "") + '</td><td class=folsmall>' + E(t.country || "—") + "</td><td>" + (done[t.id] ? '<span class="folbadge ok">drafted</span>' : '<span class="folbadge warn">not yet</span>') + "</td></tr>";
      }).join("") || '<tr><td colspan=4 class="folsmall">No teams yet — share an invite code.</td></tr>';
      var ready = !!rd.all_ready, waiting = Math.max(0, (rd.teams || 0) - (rd.drafted || 0));
      el.innerHTML =
        '<div class="folcard"><h4>Managers (' + (rd.drafted || 0) + "/" + (rd.teams || 0) + ' drafted)</h4><div class=folpad><table><thead><tr><th>Team</th><th>Manager</th><th>Country</th><th>Status</th></tr></thead><tbody>' + rows + "</tbody></table></div></div>" +
        '<div class="folcard"><h4>Invite managers</h4><div class=folpad><div class="folrow"><input id="folNewCode" placeholder="code e.g. JOIN-SAM"><button class="p" data-act="mkInvite">Create code</button></div>' +
        "<table style='margin-top:8px'><thead><tr><th>Code</th><th>Used?</th></tr></thead><tbody>" + (inv.length ? inv.map(function (v) { return "<tr><td>" + E(v.code) + "</td><td>" + (v.redeemed_uid ? "yes" : "—") + "</td></tr>"; }).join("") : '<tr><td colspan=2 class="folsmall">No codes yet.</td></tr>') + "</tbody></table>" +
        '<div class="folsmall" style="margin-top:4px">Share a code with each friend; they Sign up and Join with it.</div></div></div>' +
        '<div class="folcard"><h4>Start the season</h4><div class=folpad>' +
        '<div class="folsmall">Unlocks once <b>every</b> team has joined and drafted.</div>' +
        '<div class="folrow" style="margin-top:8px">Start date <input id="folStart" type="date"> <button class="p" data-act="startSeason" ' + (ready ? "" : "disabled") + '>🚀 Start the league</button></div>' +
        (ready ? '<div class="folsmall" style="margin-top:4px;color:#6fcf6f">Everyone\'s ready — you can start!</div>' : '<div class="folsmall" style="margin-top:4px;color:#e08b7f">Waiting on ' + waiting + ' manager(s) to draft.</div>') +
        "</div></div>" +
        '<div class="folcard"><h4>Controls</h4><div class=folpad>' +
        '<div class="folrow"><button data-act="resetSchedule">Reset schedule</button> <button data-act="resetLeague">Wipe matches &amp; demo</button>' +
        (MYTEAM ? ' <button data-act="removeTeam">Remove my team (admin-only)</button>' : "") + "</div>" +
        '<div class="folsmall" style="margin-top:4px">Reset schedule clears upcoming fixtures. Wipe clears all matches/results and the demo team. To play yourself, use a <b>separate account</b> and Join with a code.</div>' +
        "</div></div>";
    }).catch(say);
  }
  function startSeason() {
    var ids = Object.keys(TEAMS); if (ids.length < 2) { say("Need at least 2 teams"); return; }
    var sd = val("folStart") || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    rpc("founder_start_season", { p_league_id: LG.id, p_fixtures: doubleRR(ids), p_start_date: sd })
      .then(function (n) { say("🚀 Season started — " + n + " fixtures scheduled! Matches play automatically."); curTab = "table"; renderTabs(); }).catch(say);
  }
  function mkInvite() { var c = val("folNewCode"); if (!c) { say("Enter a code"); return; } act("create_invite", { p_league_id: LG.id, p_code: c, p_role: "manager" }, renderAdmin); }
  function doubleRR(ids) {
    var arr = ids.slice(); if (arr.length % 2) arr.push("BYE");
    var m = arr.length, fixed = arr[0], rot = arr.slice(1), rounds = [];
    for (var r = 0; r < m - 1; r++) { var rowarr = [fixed].concat(rot), pairs = []; for (var i = 0; i < m / 2; i++) { var a = rowarr[i], b = rowarr[m - 1 - i]; if (a === "BYE" || b === "BYE") continue; pairs.push(r % 2 === 0 ? [a, b] : [b, a]); } rounds.push(pairs); rot = [rot[rot.length - 1]].concat(rot.slice(0, rot.length - 1)); }
    var second = rounds.map(function (ps) { return ps.map(function (p) { return [p[1], p[0]]; }); });
    var all = rounds.concat(second), out = [], mi = 0;
    for (var rr = 0; rr < all.length; rr++) all[rr].forEach(function (p) { out.push({ round: rr + 1, home_team_id: p[0], away_team_id: p[1], seed: 5000 + mi }); mi++; });
    return out;
  }
  function genFixtures() {
    var ids = Object.keys(TEAMS); if (ids.length < 2) { say("Need at least 2 teams"); return; }
    var sd = val("folStart") || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    rpc("write_fixtures", { p_league_id: LG.id, p_season_no: LG.season_no || 1, p_fixtures: doubleRR(ids), p_start_date: sd })
      .then(function (n) { say("Generated " + n + " fixtures."); curTab = "table"; renderTabs(); }).catch(say);
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

  function launchDraft(team) {
    if (typeof window.genDraftPool !== "function" || typeof window.pgFounder !== "function") { say("Game engine not ready — reload the page."); return; }
    var pool = buildCountryPool(team.draft_seed, team.country);
    App.founder = {
      name: team.name, budget: 1000000, pool: pool, picked: [], identity: "Balanced XI",
      mgr: (MYMEMBER && MYMEMBER.display_name) || "Manager",
      __league: { league_id: LG.id, team_id: team.id }
    };
    wrap.classList.remove("on");           // close the overlay to reveal the game draft
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
          if (b) b.textContent = "🏏 Start Season";
        }
      } catch (e) {}
      return out;
    };
  }

  // on confirm in league mode, save the drafted squad to the server instead of
  // running the solo-game "found a club" flow.
  if (typeof window.founderConfirm === "function") {
    var _fc = window.founderConfirm;
    window.founderConfirm = function () {
      var lg = App.founder && App.founder.__league;
      if (!lg) return _fc.apply(this, arguments);
      var roster = (App.founder.picked || []).map(function (p) { return JSON.parse(JSON.stringify(p)); });
      rpc("submit_league_squad", { p_league_id: lg.league_id, p_roster: roster }).then(function () {
        App.founder.__league = null;
        say("🏏 Season squad saved — you're in the league!");
        wrap.classList.add("on"); curTab = "squad"; openLeagueId(lg.league_id);
      }).catch(say);
    };
  }

  // Multiplayer-first: show the league login as soon as the site loads (the
  // 🏆 League button still reopens it if you close it to see the solo game).
  wrap.classList.add("on");
  if (!JWT) renderLogin(); else if (LG) renderTabs(); else renderEnter();

  console.info("Fifty Overs League overlay ready.");
})();
