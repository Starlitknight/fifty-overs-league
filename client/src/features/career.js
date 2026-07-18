/* features/career — the Career Hub (#/summer once the prologue is done) and
 * the glue between the persistent world and the live engine.
 *
 * The prologue remains the guided onboarding; after it, the simulated
 * season takes control. The user's fixtures play LIVE through the real
 * match centre; everyone else's play headlessly through the same engine.
 * League defeats stand. Cup defeats eliminate. Nothing waits.
 */
FOC.career = (function () {
  var U = FOC.util, A = FOC.adapter, C = FOC.competitions, W = FOC.worldsim;
  var RNG = FOC.rng, SL = FOC.storylets;
  var _v2 = null;

  function esc(s) { return U.esc(s); }
  function scope() { return A.scope(); }

  function genSeed() {
    var t = "";
    try { t = String(Date.now()); } catch (e) { t = "seed"; }
    return U.hash32(scope() + "|" + t + "|" + Math.random()).toString(36);
  }

  function io() {
    var g = window.__foGame || {};
    return {
      squadGen: g.squad,
      derive: function (p) { try { jsDerive(p); } catch (e) {} },
      matchRunner: function (home, away, pitch, wx, seed) { return g.simWorld ? g.simWorld(home, away, pitch, wx, seed) : null; },
      userClubName: (A.team() || {}).name || "Your Club",
      userGround: (A.team() || {}).ground || "Home Ground",
      userManagerName: "The Manager",
      afterWeek: function (v2, L) {
        // rivalries from this week's real results and any fresh transfers
        C.weekFixtures(v2, v2.week).forEach(function (f) { if (f.status === "played") FOC.rivalry.onResult(v2, f, L); });
        v2.world.transfers.forEach(function (dep) {
          if (!dep.__riv && dep.season === v2.seasonNumber && dep.week === v2.week) { dep.__riv = 1; FOC.rivalry.onTransfer(v2, dep, L); }
        });
      }
    };
  }

  function prologueDone() {
    try { return FOC.game.save().ch >= 1; } catch (e) { return false; }
  }
  function career() {
    if (_v2) return _v2;
    _v2 = FOC.save2.load(scope());
    return _v2;
  }
  function active() { return !!career() && prologueDone(); }
  function persist() { if (_v2) FOC.save2.persist(_v2); }

  function begin(seedInput) {
    var pendingSeed = "";
    try { pendingSeed = localStorage.getItem("fo_seed_pending") || ""; localStorage.removeItem("fo_seed_pending"); } catch (eS) {}
    var seed = (seedInput || "").trim() || pendingSeed.trim() || genSeed();
    _v2 = FOC.save2.begin(scope(), seed);
    if (!Object.keys(_v2.world.clubsById).length) {
      FOC.worldgen.generate(_v2, io());
      // an emergent talent exists in SOME worlds — never the same story twice
      if (RNG.chance(_v2.rng, "newplayers", 0.6, "talent-world?")) {
        var ids = Object.keys(_v2.world.clubsById).filter(function (id) { return !_v2.world.clubsById[id].isUser; });
        var host = _v2.world.clubsById[RNG.pick(_v2.rng, "newplayers", ids, "talent-club")];
        var young = host.rosterIds.map(function (pid) { return _v2.world.playersById[pid]; })
          .filter(function (p) { return !p.engine.bowlType && !p.engine.keeper; })
          .sort(function (a, b) { return a.age - b.age; })[0];
        if (young) {
          young.age = Math.min(young.age, 20); young.engine.age = young.age;
          if (RNG.chance(_v2.rng, "newplayers", 0.35, "talent-is-vale?")) young.name = young.engine.name = "Arthur Vale";
          for (var k in young.engine.skills) {
            if (typeof young.engine.skills[k] === "number") young.engine.skills[k] = Math.min(96, young.engine.skills[k] + 8);
          }
          io().derive(young.engine);
          _v2.world.talentId = young.id;
        }
      }
      _v2.history.events.push({ t: "RegionEntered", region: "england", season: 1, week: 1 });
      // the world reveal: who England is, what the cups mean, who is watching
      _v2.story.pending.push({ id: "career-intro-1", week: 1, season: 1 });
      _v2.story.pending.push({ id: "career-intro-2", week: 1, season: 1 });
      _v2.story.pending.push({ id: "career-intro-3", week: 1, season: 1 });
      persist();
    }
    return _v2;
  }

  // ---- the storylet api -----------------------------------------------------
  function api(v2) {
    var a = {};
    a.userMatches = function () {
      return C.fixtures(v2, function (f) {
        return f.status === "played" && (f.homeId === v2.user.clubId || f.awayId === v2.user.clubId);
      }).length;
    };
    a.nextUserFixture = function () { return C.userFixture(v2, v2.week); };
    a.fixturePitch = function (f) {
      var host = v2.world.clubsById[f.homeId];
      return host ? host.pitch : "balanced";
    };
    a.clubName = function (f) {
      var opp = f.homeId === v2.user.clubId ? f.awayId : f.homeId;
      return (v2.world.clubsById[opp] || {}).name || "The opposition";
    };
    a.castName = function (role) { return v2.story.castNames[role] || (FOC.game.save().castNames || {})[role] || null; };
    a.selections = function (nm) {
      var n = 0;
      (v2.history.events || []).forEach(function (e) {
        if (e.t === "LineupConfirmed" && e.xi && e.xi.indexOf(nm) >= 0) n++;
      });
      return n;
    };
    a.activePromises = function () { return v2.story.promises.filter(function (p) { return p.status === "active"; }); };
    a.makePromise = function (role, txt, due) {
      v2.story.promises.push({ id: "pr_" + (v2.story.promises.length + 1), nm: a.castName(role), txt: txt,
        left: due, status: "active", season: v2.seasonNumber });
      v2.history.events.push({ t: "PromiseMade", txt: txt, week: v2.week, season: v2.seasonNumber });
    };
    a.rapport = function (k, d) { var r = v2.story.rapport; r[k] = U.clamp((r[k] || 50) + d, 0, 100); };
    a.note = function (role, txt) { v2.story.notes["role:" + role] = txt; };
    a.flag = function (k, val) { v2.flags[k] = val; };
    a.headline = function (txt) {
      v2.world.news.unshift({ week: v2.week, season: v2.seasonNumber, kind: "headline", text: txt });
    };
    a.lastUserFacts = function () { return v2.flags.lastUserFacts || null; };
    a.userLossStreak = function () {
      var c = v2.world.clubsById[v2.user.clubId], s = 0;
      for (var i = (c.form || []).length - 1; i >= 0 && c.form[i] === "L"; i--) s++;
      return s;
    };
    a.userPosition = function () { return C.position(v2, v2.user.clubId); };
    a.confirmedOpeners = function () {
      var evs = (v2.history.events || []).filter(function (e) { return e.t === "LineupConfirmed"; });
      var last = evs[evs.length - 1];
      return last && last.xi && last.xi.length >= 2 ? [last.xi[0], last.xi[1]] : null;
    };
    a.lastConfirmedCaptain = function () {
      var evs = (v2.history.events || []).filter(function (e) { return e.t === "LineupConfirmed"; });
      return evs.length ? evs[evs.length - 1].captain : null;
    };
    a.captainLastScores = function (n) {
      var cap = a.castName("captain"), out = [];
      (v2.flags.userFactsHist || []).forEach(function (f) {
        (f.batLines || []).forEach(function (b) { if (b.nm === cap) out.push(b); });
      });
      return out.slice(-(n || 3));
    };
    a.patterns = function () {
      var paceW = 0, spinW = 0, runs = {}, top = null;
      (v2.flags.userFactsHist || []).forEach(function (f) {
        paceW += f.paceW || 0; spinW += f.spinW || 0;
        (f.batLines || []).forEach(function (b) { runs[b.nm] = (runs[b.nm] || 0) + b.r; });
      });
      Object.keys(runs).forEach(function (nm) { if (!top || runs[nm] > top.runs) top = { nm: nm, runs: runs[nm] }; });
      return { paceW: paceW, spinW: spinW, topBat: top };
    };
    a.peerNote = function (consume) {
      if (v2.flags.peerNotePending) {
        var stash = v2.flags.peerNotePending;
        if (consume) delete v2.flags.peerNotePending;
        return stash;
      }
      var mid = v2.world.peerManagerId; if (!mid) return null;
      var m = v2.world.managersById[mid], pc = m && m.clubId && v2.world.clubsById[m.clubId];
      if (!m || !pc) return null;
      var k = "peer_s" + v2.seasonNumber + "_w" + v2.week;
      if (v2.flags[k]) return null;
      var pos = C.position(v2, pc.id);
      var f5 = (pc.form || []).slice(-3).join("");
      var txt = null;
      if (pos === 1) txt = "Top of the table with the club I refounded in a car park in March. I'm not calling it a race, but I did check where you are before I called you.";
      else if (f5 === "LLL") txt = "Three straight defeats. The photograph of the empty cabinet stays up. Some weeks that's motivation; this week it's just an empty cabinet. How are you finding it?";
      else if (v2.world.competitionsById.founders && v2.world.competitionsById.founders.out.indexOf(pc.id) >= 0 && !v2.flags.peerCupOut) { v2.flags.peerCupOut = 1; txt = "Out of the Founders Cup. One bad afternoon and the whole ladder's gone — that's knockout cricket, and I chose this life. League table it is, then."; }
      if (!txt) return null;
      v2.flags[k] = 1;
      var note = { nm: m.name + " — " + pc.name, txt: txt };
      v2.flags.peerNotePending = note;   // held for the scene that follows
      return note;
    };
    a.talentFact = function () {
      var tid = v2.world.talentId; if (!tid) return null;
      var p = v2.world.playersById[tid]; if (!p || p.runs < 60) return null;
      var c = v2.world.clubsById[p.clubId];
      return { nm: p.name, club: c ? c.name : "?", evidence: p.runs + " runs at " + p.age + " this season" };
    };
    a.canSell = function () {
      try { return !(typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice); } catch (e) { return true; }
    };
    a.acceptOffer = function (o) {
      if (!a.canSell()) {
        v2.world.news.unshift({ week: v2.week, season: v2.seasonNumber, kind: "transfer",
          text: "The board noted " + o.buyerName + "'s bid for " + o.playerName + " — league rules park it until the window." });
        return;
      }
      try {
        var me = A.team(), ix = -1;
        if ((me.players || []).length <= 12) {
          v2.world.news.unshift({ week: v2.week, season: v2.seasonNumber, kind: "transfer",
            text: "The board blocks the sale of " + o.playerName + " — twelve players is not a squad." });
          return;
        }
        (me.players || []).forEach(function (p, i) { if (p && p.name === o.playerName) ix = i; });
        if (ix < 0) return;
        var pl = me.players.splice(ix, 1)[0];
        try { App.fin.bank = (App.fin.bank || 0) + o.fee; } catch (eB) {}
        try { if (typeof saveGame === "function") saveGame(); } catch (eS) {}
        var buyer = v2.world.clubsById[o.buyerId];
        var wp = FOC.model.playerFromEngine(v2, pl, buyer.id);
        if (pl.__foid) wp.id = pl.__foid;   // identity survives the move
        buyer.finances.bank -= o.fee;       // the buyer's money is real too
        wp.contract = { years: 2, wage: 800 };
        buyer.finances.wageBill += wp.contract.wage;
        v2.world.playersById[wp.id] = wp;
        buyer.rosterIds.push(wp.id);
        var dep = FOC.model.transferRecord(v2, {
          playerId: wp.id, playerName: pl.name, fromId: v2.user.clubId, fromName: (me || {}).name,
          toId: buyer.id, toName: buyer.name, season: v2.seasonNumber, week: v2.week, fee: o.fee,
          caps: 0, runs: 0, wickets: 0, role: pl.bowlType ? "bowler" : (pl.keeper ? "keeper" : "batter"),
          why: "Accepted bid.", fromUser: true
        });
        v2.world.transfers.push(dep); v2.history.departures.push(dep);
        FOC.rivalry.onTransfer(v2, dep, W.log(v2));
        v2.history.events.push({ t: "PlayerDropped", nm: pl.name, week: v2.week, season: v2.seasonNumber, transfer: dep.id });
        v2.world.news.unshift({ week: v2.week, season: v2.seasonNumber, kind: "transfer",
          text: pl.name + " leaves for " + buyer.name + " (" + Math.round(o.fee / 1000) + "k). He remains fully simulated — you may meet him again." });
      } catch (e) {}
    };
    a.refuseOffer = function (o) {
      v2.world.news.unshift({ week: v2.week, season: v2.seasonNumber, kind: "transfer",
        text: o.buyerName + "'s bid for " + o.playerName + " is refused. " + o.buyerName + " will remember the phone call." });
      var buyer = v2.world.clubsById[o.buyerId];
      var m = buyer && buyer.managerId && v2.world.managersById[buyer.managerId];
      if (m) {
        m.memory.push({ kind: "refused", note: "bid for " + o.playerName + " refused S" + v2.seasonNumber });
        var rel = (v2.relationships.managerToManager[m.id] = v2.relationships.managerToManager[m.id] || { trust: 50 });
        rel.trust = Math.max(0, rel.trust - 12);   // fewer calls from this club now
      }
    };
    return a;
  }

  // ---- user fixture flow ----------------------------------------------------
  function startUserFixture() {
    var v2 = career(); if (!v2) return false;
    var f = C.userFixture(v2, v2.week);
    if (!f || f.status === "played") return false;
    if (typeof M !== "undefined" && M && !M.done) return false;
    var g = window.__foGame; if (!g) return false;
    var oppId = f.homeId === v2.user.clubId ? f.awayId : f.homeId;
    var T = W.clubTeam(v2, oppId);
    var ix = -1;
    (GD.teams || []).forEach(function (t, i) { if (t && t.name === T.name) ix = i; });
    if (ix < 0) { GD.teams.push(T); ix = GD.teams.length - 1; } else GD.teams[ix] = T;
    try {
      if (typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice && App.orders)
        window.__foSummerOrdStash = JSON.stringify(App.orders);
    } catch (e) {}
    if (!f.weather) f.weather = RNG.pick(v2.rng, "weather", ["Sunny", "Overcast", "Humid", "Windy"], "user-wx");
    var host = v2.world.clubsById[f.homeId];
    g.challenge(ix, host.pitch, f.weather);
    if (App.pending) {
      App.pending.ground = f.neutral ? "The Crown Ground" : host.ground;
      App.pending.__career = { fid: f.id };
    }
    persist();
    try { location.hash = "#/lineup"; if (typeof window.route === "function") window.route(); } catch (e2) {}
    return true;
  }

  function recordUser(fid) {
    var v2 = career(); if (!v2) return;
    var f = v2.world.fixturesById[fid]; if (!f || f.status === "played") return;
    var me = A.team();
    var sim = { innings: M.innings, result: M.result };
    W.recordUserResult(v2, f, sim);
    var facts = A.extractFacts(M, me.name);
    facts.win = !!(M.result && M.result.winner === me.name);
    facts.tie = !!(M.result && !M.result.winner);
    v2.flags.lastUserFacts = facts;
    (v2.flags.userFactsHist = v2.flags.userFactsHist || []).push(facts);
    v2.flags.userFactsHist = v2.flags.userFactsHist.slice(-30);
    // the confirmed card that actually played is the canonical one
    try {
      v2.history.events.push({ t: "LineupConfirmed", xi: App.orders.batOrder.slice(), captain: App.orders.captain,
        keeper: App.orders.keeper, week: v2.week, season: v2.seasonNumber, context: "career" });
    } catch (eL) {}
    FOC.rivalry.onResult(v2, f, W.log(v2));
    // promises resolve through the confirmed lineup, nothing else
    v2.story.promises.forEach(function (pr) {
      if (pr.status !== "active") return;
      var xi = []; try { xi = App.orders.batOrder || []; } catch (eX) {}
      if (xi.indexOf(pr.nm) >= 0) {
        pr.status = "fulfilled";
        v2.history.events.push({ t: "PromiseFulfilled", txt: pr.txt, week: v2.week, season: v2.seasonNumber });
        v2.story.pending.push({ id: "promise-kept", week: v2.week, season: v2.seasonNumber, data: { nm: pr.nm } });
      } else {
        pr.left--;
        if (pr.left <= 0) {
          pr.status = "broken";
          v2.history.events.push({ t: "PromiseBroken", txt: pr.txt, week: v2.week, season: v2.seasonNumber });
          v2.story.pending.push({ id: "promise-broken", week: v2.week, season: v2.seasonNumber, data: { nm: pr.nm } });
          api(v2).rapport("dressingRoom", -5);
        }
      }
    });
    SL.select(v2, "lineup", api(v2), 1);
    SL.select(v2, "userMatch", api(v2), 2);
    FOC.arcs && FOC.arcs.tick(v2, api(v2), "userMatch");
    persist();
  }

  function advanceWeek() {
    var v2 = career(); if (!v2) return null;
    var res = W.resolveWeek(v2, io());
    if (res.blocked) { persist(); return res; }
    if (res.ok || res.seasonOver) {
      var A2 = api(v2);
      SL.select(v2, "week", A2, 2);
      FOC.arcs && FOC.arcs.tick(v2, A2, "week");
      var uf2 = C.userFixture(v2, v2.week);
      if (uf2 && uf2.status !== "played") SL.select(v2, "preview", A2, 1);
      // a club may come calling for one of yours
      var offer = FOC.transfers.maybeUserOffer(v2, (A.team() || {}).players || []);
      if (offer) {
        v2.history.events.push({ t: "TransferOfferReceived", week: v2.week, season: v2.seasonNumber, data: offer });
        v2.story.pending.push({ id: "transfer-offer", week: v2.week, season: v2.seasonNumber, data: offer });
      }
    }
    if (res.seasonOver && !v2.flags.seasonClosed) {
      v2.flags.seasonClosed = 1;
      var end = W.seasonEnd(v2, io());
      FOC.rivalry.coolAll(v2, W.log(v2));
      v2.flags.seasonOutcome = seasonOutcome(v2, end);
    }
    persist();
    return res;
  }

  // honest seasonal judgement: position, cups, solvency — no disguised triumphs.
  // Philosophy is a real term of employment: Ambition boards demand more,
  // Community boards forgive a place if the dressing room held together.
  function boardTarget(v2) {
    var k = v2.user.philosophy && v2.user.philosophy.k;
    if (k === "ambition") return 5;
    if (k === "community") return (v2.story.rapport.dressingRoom || 50) >= 55 ? 7 : 6;
    return 6;
  }
  function seasonOutcome(v2, end) {
    var pos = end.userPos, n = end.rows.length;
    var bank = 0; try { bank = App.fin.bank || 0; } catch (e) {}
    var wonLeague = end.rows[0] && end.rows[0].clubId === v2.user.clubId;
    var wonFounders = end.founders && end.founders.winner === v2.user.clubId;
    var wonCrown = end.crown && end.crown.winner === v2.user.clubId;
    var o = { pos: pos, n: n, bank: bank, wonLeague: wonLeague, wonFounders: wonFounders, wonCrown: wonCrown };
    if (wonLeague) { o.kind = "champions"; o.txt = "League champions in a provisional season. Permanent status granted without a vote."; }
    else if (wonCrown) { o.kind = "crown"; o.txt = "Crown Cup winners. The establishment will pretend it saw you coming."; }
    else if (wonFounders) { o.kind = "cup"; o.txt = "Founders Cup winners — a knockout club before a league one. Status secured."; }
    else if (pos <= boardTarget(v2) && bank > 0) { o.kind = "secured"; o.txt = "Finished " + pos + " of " + n + ", solvent, against a board target of " + boardTarget(v2) + (v2.user.philosophy ? " (they hold you to " + v2.user.philosophy.label.toLowerCase() + ")" : "") + ". Permanent English status: granted."; }
    else if (pos <= boardTarget(v2) + 2 && bank > 0) { o.kind = "warned"; o.txt = "Finished " + pos + " of " + n + " against a target of " + boardTarget(v2) + ". Status extended one more provisional year — the board's patience is now a named, finite thing."; }
    else if (bank <= 0) { o.kind = "insolvent"; o.txt = "The money ran out. Finishing " + pos + " is a footnote when the wages aren't. The board moves to dismiss."; }
    else { o.kind = "dismissed"; o.txt = "Finished " + pos + " of " + n + ". The board thanks you for the foundations and hands the keys to somebody else."; }
    if (wonLeague || wonFounders || wonCrown) {
      // history.trophies already holds these (worldsim.seasonEnd writes one
      // unified ledger for every club) — only the pavilion cabinet echoes here
      try {
        var mus = (A.team()._museum = A.team()._museum || { trophies: [], awards: [], legends: [] });
        mus.trophies.push({ s: v2.seasonNumber, kind: o.txt });
      } catch (eM) {}
    }
    v2.history.milestones.push({ kind: "season-" + v2.seasonNumber, note: o.txt });
    if (o.kind === "dismissed" || o.kind === "insolvent") v2.user.employment = "dismissed";
    return o;
  }

  function continueNextSeason(asCaretaker) {
    var v2 = career(); if (!v2) return;
    if (v2.user.employment === "dismissed") {
      if (!asCaretaker) return;
      v2.user.employment = "employed";
      v2.user.reputation = Math.max(5, (v2.user.reputation || 30) - 10);
      v2.world.news.unshift({ week: 1, season: v2.seasonNumber + 1, kind: "board",
        text: "The board relents into a final-warning season. The keys stay, the patience doesn't." });
    }
    W.newSeason(v2, io());
    delete v2.flags.seasonClosed; delete v2.flags.seasonOutcome;
    persist();
  }

  // ---- keeper ---------------------------------------------------------------
  function startKeeper() {
    if (typeof window === "undefined") return;
    setInterval(function () {
      try {
        if (typeof App === "undefined") return;
        if (App.pending && App.pending.__career) {
          var v2 = career();
          if (v2 && App.orders && App.orders.saved && !App.pending.__careerGo && !(typeof M !== "undefined" && M && !M.done)) {
            App.pending.__careerGo = 1;
            location.hash = "#/match"; if (typeof window.route === "function") window.route();
          }
        }
        if (typeof M !== "undefined" && M && M.done && M.meta && M.meta.__career && !M.__careerSeen) {
          M.__careerSeen = 1;
          recordUser(M.meta.__career.fid);
          try {
            for (var i = (GD.teams || []).length - 1; i >= 0; i--) {
              if (GD.teams[i] && GD.teams[i].__world && (!App.pending || App.pending.away !== GD.teams[i].name)) GD.teams.splice(i, 1);
            }
          } catch (e3) {}
          try {
            if (window.__foSummerOrdStash) { App.orders = JSON.parse(window.__foSummerOrdStash); window.__foSummerOrdStash = null; }
          } catch (e4) {}
        }
      } catch (e) {}
    }, 2000);
  }

  return { scope: scope, career: career, active: active, begin: begin, persist: persist,
    api: api, io: io, startUserFixture: startUserFixture, recordUser: recordUser,
    advanceWeek: advanceWeek, seasonOutcome: seasonOutcome, continueNextSeason: continueNextSeason,
    startKeeper: startKeeper, prologueDone: prologueDone,
    _reset: function () { _v2 = null; } };
})();

/* promise resolution scenes — registered here so the pack stays factual */
(function () {
  FOC.storylets.register({
    id: "promise-kept", on: "_direct", cast: "prospect", weight: 1,
    scene: function (v2, api, ref) {
      var nm = ref.data && ref.data.nm; if (!nm) return null;
      return { sp: nm, face: "player:ar", tx: "You said I'd get my start, and there was my name on the sheet. Whatever the summer brings — I'll remember which kind of manager you are." };
    }
  });
  FOC.storylets.register({
    id: "promise-broken", on: "_direct", cast: "prospect", weight: 1,
    scene: function (v2, api, ref) {
      var nm = ref.data && ref.data.nm; if (!nm) return null;
      return { sp: nm, face: "player:ar",
        tx: "You gave me a number and I counted to it. The sheets went up without me. I'm not making a scene — I'm asking what your word costs.",
        choices: [
          { t: "Replace the promise — two more matches, guaranteed", fx: function (v2b, apiB) { apiB.makePromise("prospect", nm + " starts one of the next two matches (replacement)", 2); } },
          { t: "An apology and the truth: you picked the XI you believed in", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", -2); } }
        ] };
    }
  });
})();
