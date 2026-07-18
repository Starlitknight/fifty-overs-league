/* world/simulator — the weekly tick that keeps the world moving whether or
 * not the player is watching. NPC fixtures are played through the REAL
 * match engine via an injected runner (never a loose score formula);
 * managers decide, players get hurt and develop, money moves, cups advance.
 *
 * The one thing the simulator never does is play the user's fixture — that
 * belongs to the live match centre, and its result stands forever.
 */
FOC.worldsim = (function () {
  var RNG = FOC.rng, C = FOC.competitions, MDL = FOC.model;

  function log(v2) {
    return function (kind, text, data) {
      v2.world.news.unshift({ week: v2.week, season: v2.seasonNumber, kind: kind, text: text, data: data || {} });
      if (v2.world.news.length > 250) v2.world.news = v2.world.news.slice(0, 250);
      v2.history.events.push({ t: "News", week: v2.week, season: v2.seasonNumber, kind: kind, text: text });
    };
  }

  function clubTeam(v2, clubId) {
    var c = v2.world.clubsById[clubId];
    var ps = c.rosterIds.map(function (pid) { return v2.world.playersById[pid]; });
    var fit = ps.filter(function (p) { return !p.injuryWeeks; });
    if (fit.length < 11) fit = ps;                       // needs must — walking wounded play
    return { name: c.name, ground: c.ground, homePitch: c.pitch,
      players: fit.map(function (p) { return p.engine; }),
      youth: [], founded: false, bank: c.finances.bank, seats: 8000, supporters: 2000,
      mood: 3, acadY: 2, acadS: 2, __world: 1 };
  }

  function extractSide(inn) {
    var s = { runs: inn.runs || 0, wkts: inn.wkts || 0, balls: inn.legal || 0, topNm: null, topR: -1, bbNm: null, bbW: -1, bbR: 0 };
    (inn.bat || []).forEach(function (b) {
      if (b && b.p && b.r > s.topR) { s.topR = b.r; s.topNm = b.p.name; }
    });
    Object.keys(inn.bowlers || {}).forEach(function (nm) {
      var bw = inn.bowlers[nm]; if (!bw) return;
      if ((bw.w || 0) > s.bbW || ((bw.w || 0) === s.bbW && (bw.r || 0) < s.bbR)) { s.bbW = bw.w || 0; s.bbR = bw.r || 0; s.bbNm = nm; }
    });
    return s;
  }

  // credit real statistics to persistent players by name within the two clubs
  function creditStats(v2, f, sim) {
    [f.homeId, f.awayId].forEach(function (cid) {
      var c = v2.world.clubsById[cid]; if (!c || c.isUser) return;
      var byName = {};
      c.rosterIds.forEach(function (pid) { byName[v2.world.playersById[pid].name] = v2.world.playersById[pid]; });
      (sim.innings || []).forEach(function (inn) {
        if (!inn) return;
        if (inn.batTeam === c.name) {
          (inn.bat || []).forEach(function (b) {
            var p = b && b.p && byName[b.p.name];
            if (p) { p.runs += (b.r || 0); if (b.b > 0 || b.out) p.caps = p.caps; }
          });
        } else {
          Object.keys(inn.bowlers || {}).forEach(function (nm) {
            var p = byName[nm]; if (p) p.wickets += (inn.bowlers[nm].w || 0);
          });
        }
      });
      c.rosterIds.forEach(function (pid) {
        var p = v2.world.playersById[pid];
        // an appearance = fielded through a completed fixture for this club
        if (!p.injuryWeeks) p.caps++;
      });
    });
  }

  function recordResult(v2, f, sim) {
    var home = v2.world.clubsById[f.homeId], away = v2.world.clubsById[f.awayId];
    var i0 = sim.innings[0], i1 = sim.innings[1];
    var homeFirst = i0 && i0.batTeam === home.name;
    var hs = extractSide(homeFirst ? i0 : (i1 || {}));
    var as = extractSide(homeFirst ? (i1 || {}) : i0);
    var winnerId = null, tie = false;
    var wnm = sim.result && sim.result.winner;
    if (wnm === home.name) winnerId = f.homeId;
    else if (wnm === away.name) winnerId = f.awayId;
    else tie = true;
    f.status = "played";
    f.result = { winnerId: winnerId, tie: tie, home: hs, away: as,
      text: (sim.result && sim.result.text) || "",
      sig: "r_" + FOC.util.hash32([f.id, hs.runs, hs.wkts, as.runs, as.wkts, wnm].join("|")).toString(36) };
    [ [home, winnerId === f.homeId ? "W" : (tie ? "T" : "L")],
      [away, winnerId === f.awayId ? "W" : (tie ? "T" : "L")] ].forEach(function (x) {
      x[0].form.push(x[1]);
      if (x[0].form.length > 12) x[0].form = x[0].form.slice(-12);
    });
    creditStats(v2, f, sim);
    v2.history.events.push({ t: "MatchCompleted", week: v2.week, season: v2.seasonNumber,
      fixtureId: f.id, comp: f.comp, sig: f.result.sig,
      homeId: f.homeId, awayId: f.awayId, winnerId: winnerId, tie: tie,
      score: hs.runs + "/" + hs.wkts + " v " + as.runs + "/" + as.wkts });
    return f.result;
  }

  // the user's live match reports back through here — same shape, same rules
  function recordUserResult(v2, f, sim) { return recordResult(v2, f, sim); }

  function weeklyInjuries(v2, played, L) {
    played.forEach(function (f) {
      [f.homeId, f.awayId].forEach(function (cid) {
        var c = v2.world.clubsById[cid]; if (!c || c.isUser) return;
        if (!RNG.chance(v2.rng, "injuries", 0.09, "injury?")) return;
        var ps = c.rosterIds.map(function (pid) { return v2.world.playersById[pid]; })
          .filter(function (p) { return !p.injuryWeeks; });
        if (!ps.length) return;
        // age-weighted: old pros break; nobody is struck down for drama
        var weights = ps.map(function (p) { return { p: p, w: p.age >= 33 ? 3 : (p.age >= 29 ? 2 : 1) }; });
        var pick = RNG.weighted(v2.rng, "injuries", weights, "injury-who");
        pick.p.injuryWeeks = 1 + RNG.int(v2.rng, "injuries", 3, "injury-len");
        L("injury", pick.p.name + " (" + c.name + ") picks up a knock — out around " + pick.p.injuryWeeks + " week" + (pick.p.injuryWeeks > 1 ? "s" : "") + ".",
          { playerId: pick.p.id, clubId: cid, weeks: pick.p.injuryWeeks });
      });
    });
    // recovery ticks for everyone
    for (var pid in v2.world.playersById) {
      var p = v2.world.playersById[pid];
      if (p.injuryWeeks > 0) p.injuryWeeks--;
    }
  }

  function weeklyFinances(v2) {
    for (var cid in v2.world.clubsById) {
      var c = v2.world.clubsById[cid]; if (c.isUser) continue;
      var gate = 4000 + Math.round(c.reputation * 120);
      var homeGame = C.weekFixtures(v2, v2.week).some(function (f) { return f.homeId === cid && f.status === "played"; });
      c.finances.bank += (homeGame ? gate * 2 : gate) - c.finances.wageBill;
    }
  }

  function development(v2, io, L) {
    if (v2.week !== 5 && v2.week !== 10 && v2.week !== 15) return;
    for (var pid in v2.world.playersById) {
      var p = v2.world.playersById[pid];
      var e = p.engine; if (!e || !e.skills) continue;
      var delta = 0;
      if (p.age <= 23 && RNG.chance(v2.rng, "development", 0.4, "dev-up?")) delta = 1 + RNG.int(v2.rng, "development", 2);
      else if (p.age >= 34 && RNG.chance(v2.rng, "development", 0.35, "dev-down?")) delta = -(1 + RNG.int(v2.rng, "development", 2));
      if (!delta) continue;
      for (var k in e.skills) {
        if (typeof e.skills[k] === "number") e.skills[k] = Math.max(4, Math.min(96, e.skills[k] + delta));
      }
      try { io.derive(e); } catch (eD) {}
    }
  }

  // resolve the current week: every non-user fixture through the real engine
  function resolveWeek(v2, io) {
    var L = log(v2);
    var wk = FOC.calendar.week(v2.week);
    if (!wk) return { done: true };
    var fx = C.weekFixtures(v2, v2.week);
    var uf = C.userFixture(v2, v2.week);
    if (uf && uf.status !== "played") return { blocked: "user-fixture", fixture: uf };
    var played = [];
    fx.forEach(function (f) {
      if (f.status === "played") { played.push(f); return; }
      if (!f.weather) f.weather = RNG.pick(v2.rng, "weather", ["Sunny", "Overcast", "Humid", "Windy"], "wx");
      var home = clubTeam(v2, f.homeId), away = clubTeam(v2, f.awayId);
      var seed = FOC.util.hash32(v2.worldSeed + "|" + f.id);
      var sim = io.matchRunner(home, away, v2.world.clubsById[f.homeId].pitch, f.weather, seed);
      if (!sim) { L("abandoned", "Fixture " + home.name + " v " + away.name + " could not be completed — rescheduled.", { fixtureId: f.id }); return; }
      recordResult(v2, f, sim);
      played.push(f);
      var r = f.result;
      L("result", home.name + " " + r.home.runs + "/" + r.home.wkts + " v " + away.name + " " + r.away.runs + "/" + r.away.wkts +
        (r.tie ? " — a tie." : " — " + v2.world.clubsById[r.winnerId].name + " win."), { fixtureId: f.id, sig: r.sig });
    });
    weeklyInjuries(v2, played, L);
    weeklyFinances(v2);
    development(v2, io, L);
    for (var mid in v2.world.managersById) {
      var m = v2.world.managersById[mid];
      if (m.clubId && !m.isUser) FOC.npc.decide(v2, m, L);
    }
    FOC.transfers.weeklyMarket(v2, L);
    C.foundersAdvance(v2);
    C.crownSeed(v2);
    C.crownAdvance(v2);
    if (io.afterWeek) io.afterWeek(v2, L);
    v2.week++;
    if (v2.week > FOC.calendar.total()) return { seasonOver: true };
    return { ok: true };
  }

  // season close: judgements, archive, rollover — the world keeps going
  function seasonEnd(v2, io) {
    var L = log(v2);
    var rows = C.table(v2);
    var n = rows.length;
    rows.forEach(function (row, i) {
      var c = v2.world.clubsById[row.clubId];
      c.compHistory.push({ season: v2.seasonNumber, pos: i + 1, pts: row.pts });
      if (i === 0 && !c.isUser) L("champions", c.name + " are league champions.", { clubId: c.id });
    });
    var founders = v2.world.competitionsById.founders;
    var crown = v2.world.competitionsById.crown;
    if (founders && founders.winner) {
      v2.history.trophies.push({ kind: "founders", season: v2.seasonNumber, clubId: founders.winner,
        note: v2.world.clubsById[founders.winner].name + " lift the Founders Cup" });
    }
    if (crown && crown.winner) {
      v2.history.trophies.push({ kind: "crown", season: v2.seasonNumber, clubId: crown.winner,
        note: v2.world.clubsById[crown.winner].name + " take the Crown Cup" });
    }
    for (var mid in v2.world.managersById) {
      var m = v2.world.managersById[mid];
      if (m.clubId && !m.isUser) FOC.npc.boardReview(v2, m, C.position(v2, m.clubId), n, L);
    }
    // vacant chairs get filled from the dismissed pool — careers continue
    var vacant = Object.keys(v2.world.clubsById).filter(function (cid) {
      var c = v2.world.clubsById[cid]; return !c.isUser && !c.managerId;
    });
    var free = Object.keys(v2.world.managersById).filter(function (mid2) {
      var m2 = v2.world.managersById[mid2]; return !m2.clubId && !m2.isUser && m2.region === "england";
    });
    vacant.forEach(function (cid) {
      if (!free.length) return;
      var mid3 = free.shift();
      v2.world.managersById[mid3].clubId = cid;
      v2.world.clubsById[cid].managerId = mid3;
      L("appointment", v2.world.managersById[mid3].name + " takes over at " + v2.world.clubsById[cid].name + ".", {});
    });
    // archive the season in full, then reset the live log
    v2.history.seasonArchives.push({
      season: v2.seasonNumber,
      table: rows.map(function (r) { return { clubId: r.clubId, pts: r.pts, w: r.w, l: r.l, t: r.t, nrr: Math.round(r.nrr * 1000) / 1000 }; }),
      founders: founders ? { winner: founders.winner, out: founders.out } : null,
      crown: crown ? { winner: crown.winner, entrants: crown.entrants } : null,
      events: v2.history.events, news: v2.world.news.slice(0, 120)
    });
    v2.history.events = [];
    var userPos = C.position(v2, v2.user.clubId);
    return { userPos: userPos, rows: rows, founders: founders, crown: crown };
  }

  function newSeason(v2, io) {
    // ageing, contracts, and a fresh calendar — same world, next year
    for (var pid in v2.world.playersById) {
      var p = v2.world.playersById[pid];
      p.age++;
      if (p.contract) {
        p.contract.years--;
        if (p.contract.years <= 0) p.contract = { years: 1 + RNG.int(v2.rng, "transfers", 2), wage: p.contract.wage + 100 };
      }
      if (p.engine) p.engine.age = p.age;
    }
    v2.world.fixturesById = {};
    v2.seasonNumber++; v2.week = 1;
    var ids = Object.keys(v2.world.clubsById);
    var uc = v2.user.clubId;
    var others = RNG.shuffle(v2.rng, "worldgen", ids.filter(function (id) { return id !== uc; }), "s" + v2.seasonNumber + "-order");
    // reuse the generator's league builder shape: user slot 0
    var ordered = [uc].concat(others);
    var weeksByRound = {};
    FOC.calendar.WEEKS.forEach(function (wk) { if (wk.kind === "league") weeksByRound[wk.round] = wk.w; });
    var arr = ordered.slice(1), nn = ordered.length;
    for (var r = 0; r < nn - 1; r++) {
      var wkN = weeksByRound[r + 1];
      var pairs = [[ordered[0], arr[arr.length - 1]]];
      for (var i = 0; i < (nn / 2) - 1; i++) pairs.push([arr[i], arr[arr.length - 2 - i]]);
      /* eslint-disable no-loop-func */
      pairs.forEach(function (pr, pi) {
        var home = (r + pi) % 2 === 0 ? pr[0] : pr[1];
        var away = home === pr[0] ? pr[1] : pr[0];
        var f = MDL.fixture(v2, wkN, "league", r + 1, home, away);
        v2.world.fixturesById[f.id] = f;
      });
      arr.unshift(arr.pop());
    }
    var byRep = ids.slice().sort(function (a, b) { return v2.world.clubsById[a].reputation - v2.world.clubsById[b].reputation; });
    var playin = RNG.shuffle(v2.rng, "cupdraw", byRep.slice(0, 4), "founders-playin-s" + v2.seasonNumber);
    v2.world.competitionsById.founders = { id: "comp_founders", name: "Founders Cup", stage: "playin",
      playin: [[playin[0], playin[1]], [playin[2], playin[3]]], alive: ids.slice(), bracket: {}, out: [], winner: null };
    v2.world.competitionsById.founders.playin.forEach(function (pr) {
      var f = MDL.fixture(v2, 3, "founders", 1, pr[0], pr[1]);
      v2.world.fixturesById[f.id] = f;
    });
    v2.world.competitionsById.crown = { id: "comp_crown", name: "Crown Cup", stage: "pending",
      note: "Entry: top four of the league after Round 9.", entrants: [], bracket: {}, winner: null };
  }

  return { resolveWeek: resolveWeek, seasonEnd: seasonEnd, newSeason: newSeason,
    clubTeam: clubTeam, recordResult: recordResult, recordUserResult: recordUserResult,
    extractSide: extractSide, log: log };
})();
