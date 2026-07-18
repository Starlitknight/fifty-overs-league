/* legacy/adapter — the only module that touches engine globals.
 *
 * It translates between the campaign's world (stable ids, drafts, events)
 * and the pristine engine's world (App.orders by display name, GD.teams,
 * the global live match M). The engine is never modified; orders written
 * here use the exact structure the engine's own suggestOrders() produces.
 *
 * A campaign tie rides the friendly plumbing (comp:'friendly' + __camp meta),
 * which the overlay's competition-scope guard already excludes from
 * multiplayer league packets — campaign lineups can never leak into a
 * league round, and campaign results never touch league standings.
 */
FOC.adapter = (function () {
  var U = FOC.util, E = FOC.events;

  function gm() { return (typeof window !== "undefined" && window.__foGame) || null; }
  function engineReady() {
    return typeof App !== "undefined" && typeof GD !== "undefined" && typeof userTeam === "function";
  }
  function team() { try { return engineReady() ? userTeam() : null; } catch (e) { return null; } }
  function players() { var t = team(); return (t && t.players) || []; }

  // save scope: one campaign per manager identity, stable across reloads —
  // the same key the Circuit uses (SYNC.myMid), so solo worlds and league
  // membership never shadow each other's campaign
  function scope() {
    try { if (typeof SYNC !== "undefined" && SYNC && SYNC.myMid) return String(SYNC.myMid); } catch (e) {}
    return "solo";
  }

  // ---- orders ---------------------------------------------------------------
  function ordersSnapshot() {
    try { return U.deep(App.orders); } catch (e) { return null; }
  }

  function isPartTimer(p) {
    try { return typeof isPT === "function" ? isPT(p) : false; } catch (e) { return false; }
  }

  // draft = {xi:[names in batting order], captain, keeper}
  // Neutral validation: `errors` block Confirm (the engine could not play the
  // card as written); `facts` are observations, stated without judgement.
  // Pass the campaign save as `save` to include promise-deadline and
  // order-change observations.
  function validate(draft, save) {
    var errors = [], facts = [];
    var roster = {}, seen = {};
    players().forEach(function (p) { if (p) roster[p.name] = p; });
    var xi = (draft && draft.xi) || [];
    if (xi.length !== 11) errors.push("An XI is eleven names — this card has " + xi.length + ".");
    xi.forEach(function (nm) {
      if (!roster[nm]) errors.push(nm + " is not on your roster.");
      if (seen[nm]) errors.push(nm + " appears twice.");
      seen[nm] = 1;
    });
    if (!draft.keeper) errors.push("No wicketkeeper designated.");
    else if (xi.indexOf(draft.keeper) < 0) errors.push("Designated keeper " + draft.keeper + " is not in the XI.");
    if (!draft.captain) errors.push("No captain designated.");
    else if (xi.indexOf(draft.captain) < 0) errors.push("Designated captain " + draft.captain + " is not in the XI.");
    // neutral facts (never "too weak" / "bad pick")
    if (!errors.length) {
      var kp = roster[draft.keeper];
      if (kp && !kp.keeper) facts.push(draft.keeper + " has no wicketkeeping background; the gloves are a choice, not a habit.");
      var frontline = 0, part = 0, pace = 0, spin = 0;
      xi.forEach(function (nm) {
        var p = roster[nm]; if (!p || !p.bowlType) return;
        if (isPartTimer(p)) { part++; return; }
        frontline++;
        if (/spin/i.test(p.bowlType)) spin++; else pace++;
      });
      facts.push("Bowling cover: " + frontline + " frontline (" + pace + " pace, " + spin + " spin)" +
        (part ? " plus " + part + " part-time" : "") + ". Fifty overs must come from somewhere.");
      // the generated plan, summarised — the advanced editor stays optional
      try {
        var plan = buildSpells(xi.map(function (nm) { return roster[nm]; }));
        if (plan) {
          var tots = { pace: 0, spin: 0 };
          [].concat(plan.north, plan.south).forEach(function (sp2) {
            var b2 = roster[sp2.bowler];
            if (b2) tots[/spin/i.test(b2.bowlType || "") ? "spin" : "pace"] += sp2.n || 0;
          });
          facts.push("Default plan covers " + (tots.pace + tots.spin) + " of 50 overs: " + tots.pace + " pace, " + tots.spin + " spin; the captain fills the rest on the day.");
        } else facts.push("Fewer than five frontline bowlers: the captain improvises all fifty overs.");
      } catch (eP2) {}
      var lefties = xi.filter(function (nm) { return roster[nm] && /l/i.test(roster[nm].hand || ""); }).length;
      if (lefties) facts.push(lefties + " left-hander" + (lefties > 1 ? "s" : "") + " in the order.");
      // fatigue / availability — stated, not judged
      xi.forEach(function (nm) {
        var p = roster[nm];
        if (p && p.fatigue && p.fatigue !== "rested") facts.push(nm + " is " + p.fatigue + ".");
      });
      // planned overs beyond a bowler's legal ten
      try {
        var tot = {};
        [].concat((App.orders.spells || {}).north || [], (App.orders.spells || {}).south || [])
          .forEach(function (sp) { if (sp && sp.bowler) tot[sp.bowler] = (tot[sp.bowler] || 0) + (sp.n || 0); });
        Object.keys(tot).forEach(function (nm) {
          if (tot[nm] > 10) facts.push("The current plan pencils " + tot[nm] + " overs for " + nm + "; ten is the legal limit — the captain will trim on the day.");
        });
      } catch (eSp) {}
      if (save) {
        // live promise deadlines
        (save.promises || []).forEach(function (pr) {
          if (pr.status !== "active") return;
          if (xi.indexOf(pr.nm) >= 0) facts.push("This card keeps a live promise: " + pr.txt + ".");
          else facts.push("Live promise: " + pr.txt + " — " + pr.left + " match" + (pr.left === 1 ? "" : "es") + " left, and " + pr.nm + " is not on this card.");
        });
        // large batting-position moves vs the last confirmed campaign/league card
        try {
          var lus = (save.events || []).filter(function (e) { return e.t === "LineupConfirmed"; });
          var prevXi = lus.length ? lus[lus.length - 1].data.xi : null;
          if (prevXi) xi.forEach(function (nm, i) {
            var j = prevXi.indexOf(nm);
            if (j >= 0 && Math.abs(j - i) >= 3) facts.push(nm + " moves from " + (j + 1) + " to " + (i + 1) + " in the order.");
          });
        } catch (eMv) {}
      }
    }
    return { ok: !errors.length, errors: errors, facts: facts };
  }

  // engine-identical default spells (mirrors the engine's suggestOrders)
  function buildSpells(xiPlayers) {
    var bs = xiPlayers.filter(function (p) { return p && p.bowlType && !isPartTimer(p); })
      .sort(function (a, b) { return ((b.threat || 0) + (b.control || 0)) - ((a.threat || 0) + (a.control || 0)); });
    if (bs.length < 5) return null;
    var b1 = bs[0], b2 = bs[1], b3 = bs[2], b4 = bs[3], b5 = bs[4];
    return {
      north: [{ bowler: b1.name, first: 1, n: 5, field: "att" }, { bowler: b3.name, first: 11, n: 10, field: "bal" },
              { bowler: b5.name, first: 31, n: 5, field: "bal" }, { bowler: b1.name, first: 41, n: 5, field: "def" }],
      south: [{ bowler: b2.name, first: 2, n: 5, field: "att" }, { bowler: b4.name, first: 12, n: 10, field: "bal" },
              { bowler: b2.name, first: 32, n: 5, field: "bal" }, { bowler: b5.name, first: 42, n: 5, field: "def" }]
    };
  }

  // The ONLY mutation path: a validated draft becomes real engine orders.
  // Emits LineupConfirmed (+ selection diffs) exactly once per confirm.
  function applyOrders(save, draft) {
    var v = validate(draft, save);
    if (!v.ok) return v;
    var roster = {}; players().forEach(function (p) { if (p) roster[p.name] = p; });
    var prev = (App.orders && App.orders.saved && App.orders.batOrder && App.orders.batOrder.length === 11)
      ? App.orders.batOrder.slice() : null;
    var prevCapt = App.orders && App.orders.captain;

    App.orders.batOrder = draft.xi.slice();
    App.orders.captain = draft.captain;
    App.orders.keeper = draft.keeper;
    // keep existing spells only if every named bowler is still in the XI
    var keep = false;
    try {
      var sp = App.orders.spells || {};
      var names = [].concat(sp.north || [], sp.south || []).map(function (s) { return s.bowler; }).filter(Boolean);
      keep = names.length > 0 && names.every(function (nm) { return draft.xi.indexOf(nm) >= 0; });
    } catch (e) {}
    if (!keep) {
      var built = buildSpells(draft.xi.map(function (nm) { return roster[nm]; }));
      if (built) App.orders.spells = built;
      else App.orders.spells = { north: [], south: [] };   // AI captain decides
    }
    App.orders.saved = true;
    try { App.defaults = U.deep(App.orders); } catch (e2) {}
    try { if (typeof saveGame === "function") saveGame(); } catch (e3) {}
    // league context: push the packet through the overlay's guarded path,
    // which refuses to serialize friendly/circuit/campaign orders
    try { var g = gm(); if (g && g.pushPacket) g.pushPacket(); } catch (e4) {}

    // canonical events
    var ids = FOC.ids;
    if (prev) {
      draft.xi.forEach(function (nm) {
        if (prev.indexOf(nm) < 0) E.emit(save, "PlayerSelected", { pid: ids.playerId(save, roster[nm]), nm: nm });
      });
      prev.forEach(function (nm) {
        if (draft.xi.indexOf(nm) < 0) E.emit(save, "PlayerDropped", { pid: roster[nm] ? ids.playerId(save, roster[nm]) : null, nm: nm });
      });
    }
    if (prevCapt && prevCapt !== draft.captain) {
      E.emit(save, "CaptainAppointed", { pid: ids.playerId(save, roster[draft.captain]), nm: draft.captain, prev: prevCapt });
    }
    E.emit(save, "LineupConfirmed", {
      xi: draft.xi.slice(), captain: draft.captain, keeper: draft.keeper,
      context: (App.pending && App.pending.__camp) ? "campaign" :
               (App.pending && (App.pending.__friendly || App.pending.__circuit)) ? "friendly" : "league"
    });
    FOC.save.persist(save);
    return { ok: true, errors: [], facts: v.facts };
  }

  // ---- campaign matches -----------------------------------------------------
  // Real engine matches against a generated England XI, on their ground,
  // under their conditions. Never simulated by hand, never faked.
  function buildOpponent(spec) {
    var g = gm(); if (!g || !g.squad) return null;
    var gen = g.squad("summer|" + spec.id + "|" + (spec.seed || 0), "England", spec.arch, spec.captFlavour || "talisman");
    var ps = (gen.players || []).map(function (p0) {
      var p = U.deep(p0); delete p.fee;
      for (var k in (p.skills || {})) {
        if (typeof p.skills[k] === "number") p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * (spec.mult || 1))));
      }
      p.fatigue = "rested"; p.formIx = 3;
      try { jsDerive(p); } catch (e) {}
      return p;
    });
    if (spec.boost && spec.boost.skill) {
      // an opponent that has genuinely read your scorebook: a solo-difficulty
      // adjustment on THEIR generated squad (never on the player's squad)
      ps.forEach(function (p) {
        if (p.bowlType || p.keeper || !p.skills) return;
        if (typeof p.skills[spec.boost.skill] === "number") {
          p.skills[spec.boost.skill] = Math.min(96, Math.round(p.skills[spec.boost.skill] * (spec.boost.mult || 1.06)));
          try { jsDerive(p); } catch (e) {}
        }
      });
    }
    if (spec.rename) {
      // stable, deterministic renames (e.g. Thorne's named lieutenants)
      Object.keys(spec.rename).forEach(function (ixs) {
        var i = +ixs; if (ps[i]) ps[i].name = spec.rename[ixs];
      });
    }
    return { name: spec.nm, ground: spec.ground, players: ps, youth: [], founded: false,
      homePitch: spec.pitch, bank: 300000, seats: spec.boss ? 22000 : 7000,
      supporters: 2200, mood: 3, acadY: 2, acadS: 2, __camp: 1 };
  }

  function startMatch(save, spec) {
    var g = gm();
    if (!engineReady() || !g || !g.challenge) return false;
    if (typeof M !== "undefined" && M && !M.done) return false;   // a match is live
    var T = buildOpponent(spec); if (!T) return false;
    var ix = -1;
    (GD.teams || []).forEach(function (t, i) { if (t && t.name === T.name) ix = i; });
    if (ix < 0) { GD.teams.push(T); ix = GD.teams.length - 1; } else GD.teams[ix] = T;
    // protect a live league plan exactly like the Circuit does
    try {
      if (typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice && App.orders)
        window.__foSummerOrdStash = JSON.stringify(App.orders);
    } catch (e) {}
    g.challenge(ix, spec.pitch, spec.wx);
    if (App.pending) {
      App.pending.ground = T.ground;
      App.pending.__camp = { ch: save.ch, key: spec.chKey };
    }
    save.flags.liveMatch = { chKey: spec.chKey, rematch: (save.losses[spec.chKey] || 0) };
    FOC.save.persist(save);
    // the campaign sets its XI in the lineup room, not the legacy orders page
    try { location.hash = "#/lineup"; if (typeof window.route === "function") window.route(); } catch (e2) {}
    return true;
  }

  // honest facts from a REAL finished match — the only source of story truth
  function extractFacts(match, meName) {
    var f = { my: 0, op: 0, myW: 0, opW: 0, topNm: null, topR: -1, topB: 0, bbNm: null, bbW: -1, bbR: 0,
      ducks: [], fifties: [], threeFors: [], paceW: 0, spinW: 0, oppTopNm: null, oppTopR: -1,
      batLines: [], bowlLines: [] };
    var byName = {};
    try { (userTeam().players || []).forEach(function (p) { if (p) byName[p.name] = p; }); } catch (e) {}
    [match.innings[0], match.innings[1]].forEach(function (inn) {
      if (!inn) return;
      if (inn.batTeam === meName) {
        f.my = inn.runs || 0; f.myW = inn.wkts || 0;
        (inn.bat || []).forEach(function (b) {
          if (!b || !b.p) return;
          if (b.b > 0 || b.out) f.batLines.push({ nm: b.p.name, r: b.r, b: b.b, out: !!b.out });
          if (b.r > f.topR) { f.topR = b.r; f.topNm = b.p.name; f.topB = b.b; }
          if (b.out && b.r === 0) f.ducks.push(b.p.name);
          if (b.r >= 50) f.fifties.push({ nm: b.p.name, r: b.r, b: b.b });
        });
      } else {
        f.op = inn.runs || 0; f.opW = inn.wkts || 0;
        (inn.bat || []).forEach(function (b) {
          if (b && b.p && b.r > f.oppTopR) { f.oppTopR = b.r; f.oppTopNm = b.p.name; }
        });
        Object.keys(inn.bowlers || {}).forEach(function (nm) {
          var bw = inn.bowlers[nm]; if (!bw) return;
          f.bowlLines.push({ nm: nm, w: bw.w || 0, r: bw.r || 0 });
          if ((bw.w || 0) > f.bbW || ((bw.w || 0) === f.bbW && (bw.r || 0) < f.bbR)) { f.bbW = bw.w || 0; f.bbR = bw.r || 0; f.bbNm = nm; }
          if ((bw.w || 0) >= 3) f.threeFors.push({ nm: nm, w: bw.w, r: bw.r });
          var pl = byName[nm];
          if (pl && pl.bowlType) { if (/spin/i.test(pl.bowlType)) f.spinW += (bw.w || 0); else f.paceW += (bw.w || 0); }
        });
      }
    });
    return f;
  }

  // record a finished campaign match into the save (idempotent per match)
  function recordMatch(save, chKey, win, facts, oppName) {
    var rec = { ch: save.ch, key: chKey, n: save.matches.length + 1, opp: oppName, win: !!win,
      my: facts.my, op: facts.op, facts: facts, rematch: save.losses[chKey] || 0 };
    rec.sig = FOC.ids.matchSig({ ch: rec.ch, n: rec.n, opp: rec.opp, my: rec.my, op: rec.op, win: rec.win, topNm: facts.topNm, bbNm: facts.bbNm });
    save.matches.push(rec);
    if (!win) save.losses[chKey] = (save.losses[chKey] || 0) + 1;
    E.emit(save, "MatchCompleted", { sig: rec.sig, key: chKey, win: rec.win, my: rec.my, op: rec.op });
    delete save.flags.liveMatch;
    FOC.save.persist(save);
    return rec;
  }

  // the campaign keeper: walks the manager out once the XI is confirmed, and
  // hands finished ties to the story engine. Mirrors the Circuit's keeper.
  function startKeeper(onDone) {
    if (typeof window === "undefined") return;
    setInterval(function () {
      try {
        if (typeof App === "undefined" || typeof GD === "undefined") return;
        if (App && App.pending && App.pending.__camp && GD.teams) {
          var nm = App.pending.away, found = -1;
          GD.teams.forEach(function (t, i) { if (t && t.name === nm) found = i; });
          if (found >= 0) App.pending.oppIx = found;
          if (App.orders && App.orders.saved && !App.pending.__campGo && !(typeof M !== "undefined" && M && !M.done)) {
            App.pending.__campGo = 1;
            location.hash = "#/match"; if (typeof window.route === "function") window.route();
          }
        }
        if (typeof M !== "undefined" && M && M.done && M.meta && M.meta.__camp && !M.__campSeen) {
          M.__campSeen = 1;
          var me = null; try { me = userTeam(); } catch (e1) {}
          var win = false;
          try { win = !!(M.result && me && M.result.winner === me.name); } catch (e2) {}
          var facts = extractFacts(M, me ? me.name : "");
          // visitors leave the world once the tie is done
          try {
            for (var i = (GD.teams || []).length - 1; i >= 0; i--) {
              if (GD.teams[i] && GD.teams[i].__camp && (!App.pending || App.pending.away !== GD.teams[i].name)) GD.teams.splice(i, 1);
            }
          } catch (e3) {}
          // give the league its plan back, untouched
          try {
            if (window.__foSummerOrdStash) { App.orders = JSON.parse(window.__foSummerOrdStash); window.__foSummerOrdStash = null; }
          } catch (e4) {}
          if (onDone) onDone(M.meta.__camp, win, facts, M.meta.away);
        }
      } catch (e) {}
    }, 2000);
  }

  return { engineReady: engineReady, team: team, players: players, scope: scope,
    ordersSnapshot: ordersSnapshot, validate: validate, buildSpells: buildSpells,
    applyOrders: applyOrders, buildOpponent: buildOpponent, startMatch: startMatch,
    extractFacts: extractFacts, recordMatch: recordMatch, startKeeper: startKeeper,
    isPartTimer: isPartTimer };
})();
