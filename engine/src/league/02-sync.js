  // =================================================================
  //  In-game sync engine. Your game IS the multiplayer game: we hand
  //  the screen to the real game and keep it in step with the server –
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
  // re-drafts) after kick-off isn't in it yet · never dump them into someone
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
          // or my club was removed). Draft / wait for a rebuild · the poll below
          // pulls us in automatically once a snapshot that includes us is pushed.
          SYNC.lastVersion = st.version; SYNC.started = true;
          schedulePoll();
          // a relaunched league greets old-era clubs with the relaunch note
          if (foRelaunchCheck(st.snapshot)) return;
          // a club that was drafted and confirmed but fell out of the snapshot
          // (its join was clobbered by the 9 AM banking or lost a joiner race)
          // re-splices itself instead of stranding the manager in the lobby.
          // a commissioner-deleted club has no league_clubs row, so it won't.
          // a rejoin that died mid-flight (tab slept, network dropped between
          // the lookup and the splice) must not wedge the client forever
          if (window.__foRejoin === "busy" && Date.now() - (window.__foRejoinAt || 0) > 120000) window.__foRejoin = null;
          if (!SYNC.isFounder && !window.__foRejoin) {
            window.__foRejoin = "busy"; window.__foRejoinAt = Date.now();
            return sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=club").then(function (rows) {
              var club = rows && rows[0] && rows[0].club;
              if (club && club.name && club.players && club.players.length) { foJoinRunningSeason(JSON.parse(JSON.stringify(club))); return; }
              window.__foRejoin = "lobby";
              return preStart();
            }).catch(function () { window.__foRejoin = "lobby"; return preStart(); });
          }
          // while a rejoin is in flight its status screen owns the wrap;
          // otherwise behave as before and show the lobby / draft
          if (window.__foRejoin === "busy") return;
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
      // the resolver stamps each advance with its New York date - the client
      // uses it to date rounds truthfully and to anchor the 9 AM broadcast
      try { if (snap && snap.__foAdvDate) window.__foAdvDate = String(snap.__foAdvDate); } catch (eAdv) {}
      if (typeof window.restoreFrom === "function") window.restoreFrom(snap);
      foRepairBowlerBatting();
      foUniqueNames();
      foHistRepair();
      foPurgeGhosts();
      if (!SYNC.submittedLoaded) foLoadSubmitted();
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
          if (myClub) { App.fin.bank = myClub.bank || 0; App.fin.ledger = []; App.fin.sponsorBase = foDealResolve(myClub).d.base; }
        }
      } catch (e) {}
      try { if (typeof window.store === "function") window.store("fo_welcomed", "1"); } catch (e) {}
      if (typeof window.saveGame === "function") window.saveGame(false);
      openWrap(false);
      // land on the club home only when there is nowhere better to be - a
      // refresh keeps the page the manager was already on
      if (focus) {
        var h0 = (location.hash || "").split("?")[0];
        if (!h0 || h0 === "#" || h0 === "#/" || h0 === "#/welcome" || h0 === "#/login") location.hash = "#/club";
      }
      if (typeof window.route === "function") window.route();
    } catch (e) {
      console.warn("Fifty Overs applySnapshot failed", e);
      foFatal("Could not load the league season. Reload to try again · if it keeps happening, ask your commissioner to restart the season.");
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
      // straight into the onboarding · it collects club name / crest / country
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
  // scale one squad's skills toward an average-rating target (shared by the
  // bot-balancing pass and the relaunch world builder)
  function foScaleSquadTo(t, tgt) {
    for (var pass = 0; pass < 5; pass++) {
      var avg = t.players.reduce(function (s, p) { return s + (p.rating || 0); }, 0) / Math.max(1, t.players.length);
      var f = Math.max(0.5, Math.min(1.7, tgt / Math.max(1, avg)));
      if (Math.abs(f - 1) < 0.02) break;
      var sf = Math.pow(f, 0.85);
      t.players.forEach(function (p) { for (var k in p.skills) p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * sf))); if (typeof window.jsDerive === "function") window.jsDerive(p); });
    }
  }
  function balanceBots() {
    try {
      var target = humanAvgRating();
      for (var i = 0; i < GD.teams.length; i++) {
        var t = GD.teams[i]; if (t.founded) continue;                 // never touch human clubs
        foScaleSquadTo(t, target * (0.97 + ((i * 89) % 70) / 1000));  // 97-104% of the human level: true peers
        t._botCal = 1;
      }
    } catch (e) { console.warn("balanceBots", e); }
  }

  // Generate fresh bot clubs from the draft pool (so we never depend on whatever
  // GD.teams currently holds · a restarted league was capped by that before).
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
      // The founder can ALWAYS start/restart once at least one club is drafted –
      // clubs still drafting join automatically later (they replace a bot).
      var canStart = SYNC.started || draftedCount >= 1;
      var startLabel = SYNC.started ? "Restart season (rebuild from clubs) ▸" : (draftedCount < 2 ? "Start season (you + bots) ▸" : "Start the league ▸");
      var ctl = isF
        ? '<div style="margin-top:10px">' +
            (canStart
              ? '<button class="p" data-act="startLeague">' + startLabel + '</button>' +
                '<div class="folsmall" style="margin-top:4px">' +
                (allReady ? "" : "Clubs still drafting join automatically when they finish · they take over a bot club. ") +
                (solo ? "Empty slots fill with bot clubs to make a full 10-team league." : "") + "</div>" +
                (SYNC.started ? '<button class="mini" data-act="relaunch" style="margin-top:8px;background:#5a2620;border-color:#7a3a30;color:#f0d0c8">Relaunch league · new era, everyone re-founds ▸</button>' : "")
              : '<div class="folsmall">The season starts once at least one club has drafted.</div>') +
            '<div style="margin-top:8px"><button class="mini" data-act="mkInvite">Create invite code</button> <span id="folInvite" class="folsmall"></span></div>' +
          "</div>"
        : '<div class="folsmall" style="margin-top:10px">' + (SYNC.started
            ? "The season is already running · your club joins as soon as the commissioner restarts it (their lobby has the Restart button). You can jump in the moment that happens; this screen updates itself."
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
    // one standing code for the whole league · share it with every friend
    rpc("league_code", { p_league_id: LG.id })
      .then(function (code) {
        var el = wrap.querySelector("#folInvite");
        if (el) el.innerHTML = "League code: <b style='font-size:16px;letter-spacing:.08em'>" + E((code || "") + "") + "</b> · share the same code with all your friends. It never expires.";
        try { navigator.clipboard && navigator.clipboard.writeText(code + ""); toast("League code copied: " + code); } catch (e) {}
      })
      .catch(function (e) {
        var m = ((e && e.message) || e) + "";
        if (/Could not find the function/i.test(m)) {
          // 0016 not run yet · fall back to classic one-time invites
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
    // after a relaunch, only clubs founded in the current era may be rebuilt -
    // retired squads from the old era must never ride back in
    sel("league_state", "league_id=eq." + LG.id + "&select=snapshot").then(function (aSt) {
      var era = foRelaunchEpochOf(aSt && aSt[0] && aSt[0].snapshot);
      return sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id").then(function (clubs) {
      if (era) clubs = (clubs || []).filter(function (c) { return c && c.club && +c.club.__foEpoch === era; });
      if (!clubs || !clubs.length) { say(era ? "No club from the relaunched era yet - found yours first, then start." : "Draft your squad first, then start the season."); return; }
      try {
        var world = fillBots(clubs.map(function (c) { return c.club; }));   // top up to a full 10-team league
        if (era) world.forEach(function (t) { t.__foEpoch = era; });        // the era rides on every team, bots included
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
      });
    }).catch(say);
  }

  // ===========================================================================
  //  LEAGUE RELAUNCH · new format, everyone re-founds
  //  The commissioner resets the world to fresh bot clubs stamped with a new
  //  era ("epoch"). Every club record carries its era: a manager whose club
  //  belongs to an older era is met with a short note about the relaunch and
  //  walked through the quick-start; their new club replaces a bot via the
  //  battle-tested running-season join. No schema changes - the epoch rides
  //  inside the club JSON and the snapshot's team records.
  // ===========================================================================
  function foRelaunchEpochOf(snap) {
    var ep = 0;
    try { ((snap && snap.teams) || []).forEach(function (t) { if (t && +t.__foEpoch > ep) ep = +t.__foEpoch; }); } catch (e) {}
    return ep;
  }
  // Shared by the sync loop and the poll: when the snapshot belongs to a newer
  // era than my club record, show the relaunch note instead of auto-rejoining.
  // Returns true when the relaunch flow has taken over.
  function foRelaunchCheck(snap) {
    var ep = foRelaunchEpochOf(snap);
    if (!ep || myClubInSnap(snap)) return false;
    if (window.__foRejoin === "busy" && Date.now() - (window.__foRejoinAt || 0) > 120000) window.__foRejoin = null;
    if (window.__foRejoin === "busy" || window.__foRejoin === "gate") return true;
    window.__foRejoin = "busy"; window.__foRejoinAt = Date.now();
    sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=club").then(function (rows) {
      var club = rows && rows[0] && rows[0].club;
      // same era? then this is just a clobbered join - re-splice as before
      if (club && +club.__foEpoch === ep && club.name && club.players && club.players.length) {
        foJoinRunningSeason(JSON.parse(JSON.stringify(club)));
        return;
      }
      window.__foRejoin = "gate";
      window.__foRelaunchEpoch = ep;
      // never finished founding a club (mid-draft when the relaunch hit, or a
      // brand-new joiner)? nothing was retired - straight into the onboarding
      if (!club) { startDraft((SYNC && SYNC.myTeam) || {}); return; }
      foRelaunchGate(ep);
    }).catch(function () { window.__foRejoin = null; });
    return true;
  }
  // The message existing managers see, and the door into the new onboarding.
  function foRelaunchGate(epoch) {
    try {
      window.__foRelaunchEpoch = epoch;
      openWrap(true); setNavy(true);
      var who = wrap.querySelector("#folWho"); if (who) who.textContent = LG ? LG.name : "";
      main.innerHTML = folAuthShell(
        "<h1>A new era is starting</h1>" +
        '<div class="fol-sub">The game has been rebuilt and your commissioner has relaunched the league. Old clubs are retired with honour - everyone founds a fresh club and the table starts from zero.</div>' +
        '<div class="fol-form">' +
        '<div class="folsmall" style="line-height:1.6;margin-bottom:4px">Founding a club is a whole new experience now: the <b>Gaffer</b> walks you through naming your club, choosing its soul, spending your first million and a live warm-up friendly. League matches play at <b>9:00 AM ET</b>.</div>' +
        '<button class="fol-cta" data-act="refound">Found my new club ▸</button>' +
        "</div>" +
        '<div class="fol-links"><a class="fol-mut" data-act="logout">Log out</a></div>' + FOOT);
    } catch (e) { say(e); }
  }
  function foRefound() {
    try {
      // retire this device's old-club state so nothing bleeds into the new era
      try {
        window.store("fo_onb_done", ""); lsDel("fo_qs_new");
        if (SYNC) {
          SYNC.submitted = {}; SYNC.submittedLoaded = false; SYNC.pushedSig = {};
          SYNC.plannedOrders = {}; foSavePlanned();
          SYNC.lastOrderSig = null;
        }
      } catch (e) {}
      startDraft((SYNC && SYNC.myTeam) || {});
    } catch (e) { say(e); }
  }
  // Commissioner action: reset the world to fresh bots (pitched at the
  // quick-start strength budget), stamp the new era, push round 0, and walk
  // straight into the new onboarding yourself.
  function relaunchLeague() {
    var sure = confirm("Relaunch the league for the new era?\n\nEvery current club is retired, the table and results reset, and every manager - including you - founds a fresh club through the new Gaffer-led founding journey. Managers see a note explaining the relaunch the next time they open the game.\n\nThis cannot be undone.");
    if (!sure) return;
    try {
      var epoch = Date.now();
      var world = fillBots([]);
      // bots pitched at the quick-start budget, not at whatever the old squads were
      try {
        var ref = foGenArchetypeSquad("relaunch-" + ((LG && LG.id) || "x"), NAT[0], "rock").players;
        var refAvg = ref.reduce(function (s, p) { return s + (p.rating || 0); }, 0) / Math.max(1, ref.length);
        world.forEach(function (t, i) { foScaleSquadTo(t, refAvg * (0.97 + ((i * 89) % 70) / 1000)); });
      } catch (eCal) {}
      world.forEach(function (t) { t.__foEpoch = epoch; });
      GD.teams = world;
      // a relaunch is a fresh WORLD, not just fresh teams: the snapshot below
      // carries App.* to every member, so the commissioner's old-era treasury,
      // ledger, news feed, market listings and fielding stats must all retire
      // with the old clubs. econInit no-ops while App.fin exists - clear it so
      // the full fresh init (fin/history/market/cup + team defaults) runs.
      App.fin = null;
      App.news = []; App.fieldStats = {};
      if (typeof window.econInit === "function") window.econInit();
      App.teamIx = 0;
      App.season = null; if (typeof window.seasonInit === "function") window.seasonInit();
      App.round = 1; App.seasonNo = 1; App.results = []; App.playerHist = {};
      App.cup = { stage: 0, alive: null, results: [], out: false };
      if (typeof window.mpInit === "function") window.mpInit();
      var snap = (typeof window.snapshot === "function") ? window.snapshot(true) : null;
      if (!snap) { say("Game engine not ready. Reload and try again."); return; }
      rpc("push_league_state", { p_league_id: LG.id, p_snapshot: snap, p_round: 0 }).then(function (ver) {
        SYNC.lastVersion = typeof ver === "number" ? ver : ((SYNC.lastVersion || 0) + 1);
        SYNC.started = true;
        window.__foRelaunchEpoch = epoch;
        window.__foRejoin = null;
        // push_league_state is last-write-wins with no version guard: a
        // resolver pass that read the OLD snapshot before the relaunch will
        // overwrite it minutes later when its sims finish. Watch the era for
        // an hour and re-push the relaunch until it sticks - any new-era club
        // that joined in between is re-spliced by its own join watchdog.
        try { (window.__foRelTimers || []).forEach(clearTimeout); } catch (eT) {}
        window.__foRelTimers = [45, 180, 600, 1800, 3600].map(function (sec) {
          return setTimeout(function () {
            sel("league_state", "league_id=eq." + LG.id + "&select=snapshot").then(function (a2) {
              var cur = a2 && a2[0];
              if (cur && cur.snapshot && foRelaunchEpochOf(cur.snapshot) !== epoch) {
                rpc("push_league_state", { p_league_id: LG.id, p_snapshot: snap, p_round: 0 }).catch(function () {});
              }
            }).catch(function () {});
          }, sec * 1000);
        });
        toast("League relaunched · now found your own new club.");
        foRefound();
      }).catch(say);
    } catch (e) { say(e); }
  }
  window.__foRelaunch = { epochOf: foRelaunchEpochOf, gate: foRelaunchGate, go: relaunchLeague, check: foRelaunchCheck };

  // Background sync loop: push my saved orders as a packet; pull new snapshots.
  function schedulePoll() {
    if (SYNC && SYNC.pollTimer) return;
    if (SYNC) SYNC.pollTimer = setInterval(pollOnce, 15000);
  }
  // Push the current round's packet (orders + club orders). Runs from the
  // 15s poll AND the moment Save orders is clicked, so the green states
  // confirm within a second of saving instead of a poll tick later.
  function foPushCurrentPacket(force) {
    if (!LG || !SYNC || SYNC.practice) return;
    // While planning a future round, don't auto-push the current round's orders.
    if (!(SYNC.planRound == null && SYNC.started && window.App && App.season && typeof GD !== "undefined" && GD.teams)) return;
    var tro = foTrainState();
    // COMPETITION SCOPE: App.orders is shared with the tutorial, friendlies and
    // the Circuit. Never serialize those into a LEAGUE packet - a Circuit XI must
    // not silently become the plan for the next competitive round. Training,
    // youth and market pending are competition-independent and still push.
    var inNonLeague = !!(App.pending && (App.pending.__circuit || App.pending.__friendly || App.pending.__tut) || (typeof M !== "undefined" && M && !M.done && M.meta && (M.meta.__circuit || M.meta.__friendly || M.meta.__tut)));
    var ordersReady = App.orders && App.orders.saved && !inNonLeague;
    var sig = (ordersReady ? JSON.stringify(App.orders) : "-") + "|" + JSON.stringify(tro.training) + "|" + JSON.stringify(tro.youthPending.map(function (y) { return y.name; })) + "|" + JSON.stringify((tro.marketPending || []).map(function (y) { return y.name; })) + "|" + JSON.stringify(tro.seatsPending || null) + "|" + (tro.sponsorPending || "") + "|" + App.season.round;
    if (!force && sig === SYNC.lastOrderSig) return;
    if (!(ordersReady || Object.keys(tro.training).length || tro.youthPending.length || (tro.marketPending || []).length || tro.seatsPending || tro.sponsorPending)) return;
    SYNC.lastOrderSig = sig;
    var pkt = {
      fo_packet: 1, teamIx: App.teamIx, club: (GD.teams[App.teamIx] || {}).name, round: App.season.round,
      manager: (SYNC.me && SYNC.me.display_name) || "manager",
      orders: ordersReady ? App.orders : null,
      fo_training: tro.training, fo_youth: tro.youthPending, fo_market: tro.marketPending || [], fo_seats: tro.seatsPending || null, fo_sponsor: tro.sponsorPending || null
    };
    var pushRound = App.season.round;
    rpc("push_packet", { p_league_id: LG.id, p_round: pushRound, p_packet: pkt }).then(function () {
      if (pkt.orders) {
        SYNC.submitted = SYNC.submitted || {}; SYNC.submitted[pushRound] = true;
        SYNC.__pushInfo = "R" + (pushRound + 1) + " confirmed " + new Date().toLocaleTimeString();
        foRefreshLineupButtons();
      }
    }).catch(function (e) {
      SYNC.lastOrderSig = null;                      // retry on the next poll
      SYNC.__pushInfo = "R" + (pushRound + 1) + " FAILED: " + String((e && e.message) || e).slice(0, 140);
    });
  }
  // the engine's Save orders button is an inline onclick - catch the click as
  // it bubbles and upload right away (planned rounds too), so every green
  // state confirms immediately rather than on the next poll
  document.addEventListener("click", function (ev) {
    try {
      var b = ev.target && ev.target.closest ? ev.target.closest("button.primary") : null;
      if (!b || !/save orders/i.test((b.textContent || "").trim())) return;
      setTimeout(function () {
        try {
          if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
          if (!(App.orders && App.orders.saved)) return;
          if (App.pending && (App.pending.__circuit || App.pending.__friendly || App.pending.__tut)) return;   // never push a non-league XI
          if (SYNC.planRound != null) foPushRound(SYNC.planRound, App.orders);
          else foPushCurrentPacket(true);
          foRefreshLineupButtons();
        } catch (e2) {}
      }, 40);
    } catch (e) {}
  });
  function pollOnce() {
    if (!LG || !SYNC || SYNC.practice) return;   // practice mode is a private local game
    if (SYNC.started && !SYNC.submittedLoaded) { try { foLoadSubmitted(); } catch (e) {} }
    if (SYNC.started && !SYNC.__plannedLoaded) { SYNC.__plannedLoaded = 1; try { foLoadPlanned(); } catch (e) {} }
    try { foRetryPlanned(); } catch (e) {}
    try { foPushCurrentPacket(false); } catch (e) {}
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
    // egress guard: the snapshot is megabytes and this poll runs every 15s on
    // every open tab - ask for the tiny version number first and download the
    // snapshot ONLY when it actually moved
    sel("league_state", "league_id=eq." + LG.id + "&select=version").then(function (a0) {
      var v0 = a0 && a0[0] && a0[0].version;
      if (v0 == null || v0 <= SYNC.lastVersion) return [];
      return sel("league_state", "league_id=eq." + LG.id + "&select=snapshot,version,round");
    }).then(function (a) {
      var st = a && a[0]; if (!st || st.version <= SYNC.lastVersion) return;
      if (document.getElementById("fo-onb")) return;               // never yank the draft room away mid-pick
      SYNC.lastVersion = st.version;
      // auto-enter once a rebuild includes us; if we were parked in the lobby, land on the club page
      if (myClubInSnap(st.snapshot)) { applySnapshot(st.snapshot, wrap.classList.contains("on")); return; }
      // mid-session relaunch: stop play and show the note right away
      foRelaunchCheck(st.snapshot);
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
      '<div class="fol-sub">You\'re signed in · enter the invite code from your commissioner.</div>' +
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
  // Bowling styles have a pecking order: genuine quicks are the rarest thing
  // in the game, wrist spinners close behind (the engine backs this up with a
  // real wicket-threat edge for both). Pools get hard caps; the weakest
  // surplus is demoted to the nearest common style, deterministically.
  var FO_STYLE = {
    seamFast: { bt: "fast", label: "fast" },
    seamFastMedium: { bt: "fastMedium", label: "fast medium" },
    seamMedium: { bt: "medium", label: "medium" },
    wristSpin: { bt: "wristSpin", label: "wrist spin" },
    fingerSpin: { bt: "fingerSpin", label: "finger spin" }
  };
  function foSetBowlStyle(p, style) {
    var oldSt = FO_STYLE[p.bowlTypeFull], newSt = FO_STYLE[style];
    if (!oldSt || !newSt) return;
    if (p.btLabel) p.btLabel = p.btLabel.replace(oldSt.label, newSt.label);
    if (p.role === p.bowlTypeFull) p.role = style;
    p.bowlTypeFull = style;
    p.bowlType = newSt.bt;
  }
  function foEnforceStyleRarity(pool) {
    var caps = { seamFast: 0.05, wristSpin: 0.08, fingerSpin: 0.30 };
    var demoteTo = { seamFast: "seamFastMedium", wristSpin: "fingerSpin", fingerSpin: "seamMedium" };
    ["seamFast", "wristSpin", "fingerSpin"].forEach(function (style) {
      var frontline = pool.filter(function (p) { return FO_STYLE[p.bowlTypeFull]; });
      var have = frontline.filter(function (p) { return p.bowlTypeFull === style; });
      var max = Math.max(1, Math.floor(frontline.length * caps[style]));
      if (have.length <= max) return;
      have.sort(function (a, b) { return (a.rating || 0) - (b.rating || 0); });
      have.slice(0, have.length - max).forEach(function (p) { foSetBowlStyle(p, demoteTo[style]); });
    });
    return pool;
  }
  function buildCountryPool(seedInt, country) {
    // string seeds (league ids, "<club>-scout-3", …) hash to a real uint32 –
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
    foEnforceStyleRarity(pool);
    return pool;
  }

  // ---- pure bowlers bat like bowlers ---------------------------------------
  // A specialist bowler's batting comes from a bottom-heavy curve: mostly
  // dreadful or atrocious, often poor, sometimes ordinary, average at the very
  // best (and rare). Everything derives from the player's NAME, so every
  // client and the resolver agree exactly and re-applying changes nothing.
  function foPureBowler(p) {
    if (!p || p.keeper) return false;
    if (p.role === "allRounder" || p.role === "wicketkeeper") return false;
    return /^(seamFast|seamFastMedium|seamMedium|wristSpin|fingerSpin)$/.test(p.bowlTypeFull || "");
  }
  function foBowlerBatTarget(name) {
    var h = 2166136261, i;
    name = String(name || "");
    for (i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); }
    var x = (h >>> 0) || 1;
    var rr = function () { x = (x * 1103515245 + 12345) >>> 0; return x / 4294967296; };
    var u = rr(), lvl;
    if (u < 0.28) lvl = 2 + rr() * 6;         // atrocious
    else if (u < 0.58) lvl = 6 + rr() * 6;    // dreadful
    else if (u < 0.82) lvl = 11 + rr() * 6;   // poor
    else if (u < 0.95) lvl = 17 + rr() * 6;   // ordinary
    else lvl = 24 + rr() * 6;                 // average - as good as a specialist gets
    return { lvl: lvl, j1: (rr() - 0.5) * 6, j2: (rr() - 0.5) * 6, j3: (rr() - 0.5) * 6, j4: (rr() - 0.5) * 8 };
  }
  function foApplyBowlerBat(p, keepWage) {
    var s = p.skills || (p.skills = {});
    var t = foBowlerBatTarget(p.name);
    var cl = function (v) { return Math.max(4, Math.min(95, Math.round(v))); };
    s.vsPace = cl(t.lvl + t.j1);
    s.vsSpin = cl(t.lvl + t.j2);
    s.rotation = cl(t.lvl - 2 + t.j3);
    s.temperament = cl(t.lvl + 6 + t.j4);     // grit outlasts talent
    s.power = cl(Math.min(s.power == null ? 16 : s.power, t.lvl + 4));
    var w = p.wage;
    if (typeof window.jsDerive === "function") window.jsDerive(p);
    if (keepWage && w != null) p.wage = w;    // a signed contract does not shrink
  }
  // Lower-only, idempotent sweep for squads that already exist (drafted before
  // this rule): any specialist bowler batting well above his name-derived
  // ceiling is brought back down. Applying twice is a no-op.
  function foRepairBowlerBatting() {
    try {
      if (typeof GD === "undefined" || !GD.teams) return 0;
      var n = 0;
      GD.teams.forEach(function (t) {
        (t.players || []).concat(t.injured || [], t.youth || []).forEach(function (p) {
          if (!foPureBowler(p)) return;
          var s = p.skills || {};
          var agg = 0.25 * (s.vsPace || 0) + 0.25 * (s.vsSpin || 0) + 0.2 * (s.rotation || 0) + 0.15 * (s.temperament || 0) + 0.15 * (s.power || 0);
          // only true anomalies (above the "average" band): sane specialists stay
          if (agg > 32) { foApplyBowlerBat(p, true); n++; }
        });
      });
      return n;
    } catch (e) { return 0; }
  }
  setTimeout(function () { try { foRepairBowlerBatting(); } catch (e) {} }, 1500);

  // Enforce realistic technique/power relationships on a generated player, using
  // the game's own aggregate formulas (aggBat/aggBowl/aggTech). A "level" = 6.25.
  //   technique  = within 2 levels BELOW the headline batting/bowling skill
  //   power      = equal to, or 1–4 levels below, technique
  // Pure bowlers skip this path entirely: pulling their technique (vsPace/
  // vsSpin/temperament) toward the BOWLING headline is what quietly made every
  // drafted bowler a capable batter.
  function fixTechniquePower(p, rnd) {
    if (foPureBowler(p)) { foApplyBowlerBat(p); return; }
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
  window.__folRepairBowlerBat = foRepairBowlerBatting;

