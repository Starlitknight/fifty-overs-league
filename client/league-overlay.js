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
      sign: function () { act("sign_player", { p_league_id: LG.id, p_name: t.getAttribute("data-name") }, renderSquad); },
      drop: function () { act("drop_player", { p_league_id: LG.id, p_name: t.getAttribute("data-name") }, renderSquad); },
      confirm: function () { act("confirm_squad", { p_league_id: LG.id }, function () { say("Squad confirmed!"); renderSquad(); }); },
      issue: issueChallenge, accept: function () { act("accept_challenge", { p_league_id: LG.id, p_challenge_id: t.getAttribute("data-id") }, renderPlay); },
      orders: function () { openOrders(t.getAttribute("data-id")); }, submitOrders: function () { submitOrders(t.getAttribute("data-id")); },
      mkInvite: mkInvite, genFixtures: genFixtures, card: function () { toggleCard(+t.getAttribute("data-i")); }
    };
    if (acts[a]) acts[a]();
  });
  function act(fn, args, then) { rpc(fn, args).then(then).catch(say); }
  function val(id) { var e = wrap.querySelector("#" + id); return e ? (e.value || "").trim() : ""; }

  // ---- auth ----
  function renderLogin() {
    wrap.querySelector("#folWho").textContent = "";
    main.innerHTML =
      '<div class="folbody"><div class="folcard"><h4>Log in to your league</h4><div class="folpad">' +
      '<div class="folrow"><input id="folEmail" type="email" placeholder="email"><input id="folPass" type="password" placeholder="password"></div>' +
      '<div class="folrow" style="margin-top:8px"><button class="p" data-act="login">Log in</button><button data-act="signup">Sign up</button></div>' +
      '<div class="folsmall" style="margin-top:6px">New player? Sign up, then join your league with an invite code.</div>' +
      "</div></div></div>";
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
      curTab = "table"; renderTabs();
    }).catch(say);
  }

  // ---- tabbed shell ----
  function renderTabs() {
    var tabs = [["squad", "Squad"], ["play", "Play"], ["table", "Table"], ["results", "Results"]];
    if (MYMEMBER && MYMEMBER.role === "founder") tabs.push(["founder", "Founder"]);
    wrap.querySelector("#folWho").textContent = LG ? LG.name : "";
    main.innerHTML = '<div class="foltabs">' + tabs.map(function (t) { return '<div class="foltab ' + (curTab === t[0] ? "on" : "") + '" data-act="tab" data-tab="' + t[0] + '">' + t[1] + "</div>"; }).join("") +
      '<span style="flex:1"></span><button class="mini" data-act="logout">log out</button></div><div id="folTab" class="folbody"></div>';
    ({ squad: renderSquad, play: renderPlay, table: renderTable, results: renderResults, founder: renderFounder }[curTab])();
  }
  function tabEl() { return wrap.querySelector("#folTab"); }

  // ---- SQUAD ----
  function renderSquad() {
    var el = tabEl(); el.innerHTML = '<div class="folcard"><div class="folpad folsmall">Loading…</div></div>';
    if (!MYTEAM) { el.innerHTML = '<div class="folcard"><div class="folpad">You have no team here yet. Join with an invite code.</div></div>'; return; }
    Promise.all([
      sel("squads", "team_id=eq." + MYTEAM.id + "&select=roster,budget_spent,confirmed"),
      sel("draft_pools", "manager_id=eq." + MYTEAM.manager_id + "&select=players")
    ]).then(function (r) {
      var squad = r[0][0] || { roster: [], budget_spent: 0, confirmed: false };
      var poolPlayers = (r[1][0] && r[1][0].players) || [], roster = squad.roster || [];
      var have = {}; roster.forEach(function (p) { have[p.name] = 1; });
      var left = (LG.draft_budget || 1000000) - (squad.budget_spent || 0);
      var wk = roster.filter(function (p) { return p.keeper; }).length, bowl = roster.filter(function (p) { return p.bowlTypeFull && p.bowlTypeFull !== "none"; }).length;
      function prow(p, inR) {
        var act = squad.confirmed ? "" : (inR ? '<button class="mini" data-act="drop" data-name="' + E(p.name) + '">drop</button>'
          : '<button class="mini" data-act="sign" data-name="' + E(p.name) + '" ' + ((left - (p.fee || 0)) < 0 ? "disabled" : "") + ">sign</button>");
        return "<tr><td>" + E(p.name) + (p.keeper ? " †" : "") + '</td><td class="folsmall">' + E(p.role || "") + '</td><td class="folsmall">' +
          E(p.bowlTypeFull && p.bowlTypeFull !== "none" ? p.bowlTypeFull : "—") + '</td><td class="n">' + (p.rating || "") + '</td><td class="n">$' + ((p.fee || 0) / 1000) + "k</td><td>" + act + "</td></tr>";
      }
      var rRows = roster.map(function (p) { return prow(p, true); }).join("") || '<tr><td colspan="6" class="folsmall">No players signed yet.</td></tr>';
      var avail = poolPlayers.filter(function (p) { return !have[p.name]; });
      var pRows = avail.length ? avail.map(function (p) { return prow(p, false); }).join("") : '<tr><td colspan="6" class="folsmall">Draft pool empty — the founder deals the draft first.</td></tr>';
      el.innerHTML =
        '<div class="folcard"><h4><span>' + E(MYTEAM.name) + "</span><span>" + (squad.confirmed ? '<span class="folbadge ok">confirmed</span>' : '<span class="folbadge warn">not confirmed</span>') + "</span></h4><div class=folpad>" +
        '<div class="folrow" style="justify-content:space-between"><span class="folsmall">Budget left: <b>$' + left.toLocaleString() + "</b></span><span class=folsmall>" + roster.length + " players · " + wk + " keeper · " + bowl + " bowling</span></div>" +
        "<table><thead><tr><th>Player</th><th>Role</th><th>Bowl</th><th class=n>Rtg</th><th class=n>Fee</th><th></th></tr></thead><tbody>" + rRows + "</tbody></table>" +
        (squad.confirmed ? "" : '<div class="folrow" style="margin-top:8px"><button class="p" data-act="confirm">Confirm squad (≥11, keeper, ≥5 bowlers, in budget)</button></div>') +
        "</div></div>" +
        '<div class="folcard"><h4>Your draft pool</h4><div class=folpad><table><thead><tr><th>Player</th><th>Role</th><th>Bowl</th><th class=n>Rtg</th><th class=n>Fee</th><th></th></tr></thead><tbody>' + pRows + "</tbody></table></div></div>";
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

  // ---- FOUNDER ----
  function renderFounder() {
    var el = tabEl();
    sel("invites", "league_id=eq." + LG.id + "&select=code,role,redeemed_uid&order=created_at").then(function (inv) {
      el.innerHTML =
        '<div class="folcard"><h4>Invite managers</h4><div class=folpad><div class="folrow"><input id="folNewCode" placeholder="code e.g. JOIN-SAM"><button class="p" data-act="mkInvite">Create code</button></div>' +
        "<table style='margin-top:8px'><thead><tr><th>Code</th><th>Role</th><th>Used?</th></tr></thead><tbody>" + (inv.length ? inv.map(function (v) { return "<tr><td>" + E(v.code) + "</td><td>" + v.role + "</td><td>" + (v.redeemed_uid ? "yes" : "—") + "</td></tr>"; }).join("") : '<tr><td colspan=3 class="folsmall">No codes yet.</td></tr>') + "</tbody></table></div></div>" +
        '<div class="folcard"><h4>Season</h4><div class=folpad><div class="folsmall">1) After everyone joins, deal the draft from GitHub Actions → deal-draft → Run with league id <code>' + E(LG.id) + "</code>.</div>" +
        '<div class="folrow" style="margin-top:8px">Start date <input id="folStart" type="date"> <button class="p" data-act="genFixtures">Generate fixtures</button></div><div class="folsmall">2) Matches then resolve automatically.</div></div></div>';
    }).catch(say);
  }
  function mkInvite() { var c = val("folNewCode"); if (!c) { say("Enter a code"); return; } act("create_invite", { p_league_id: LG.id, p_code: c, p_role: "manager" }, renderFounder); }
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

  console.info("Fifty Overs League overlay ready.");
})();
