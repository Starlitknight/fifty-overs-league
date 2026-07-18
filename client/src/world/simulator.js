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
    var s = { runs: inn.runs || 0, wkts: inn.wkts || 0, balls: inn.legal || 0, topNm: null, topR: -1,
      bbNm: null, bbW: -1, bbR: 0, batLines: [], bowlLines: [], xi: [] };
    (inn.xi || []).forEach(function (p) { if (p && p.name) s.xi.push(p.name); });
    (inn.bat || []).forEach(function (b) {
      if (!b || !b.p) return;
      if (b.b > 0 || b.out) s.batLines.push({ nm: b.p.name, r: b.r || 0, b: b.b || 0, out: !!b.out });
      if (b.r > s.topR) { s.topR = b.r; s.topNm = b.p.name; }
    });
    Object.keys(inn.bowlers || {}).forEach(function (nm) {
      var bw = inn.bowlers[nm]; if (!bw) return;
      s.bowlLines.push({ nm: nm, w: bw.w || 0, r: bw.r || 0 });
      if ((bw.w || 0) > s.bbW || ((bw.w || 0) === s.bbW && (bw.r || 0) < s.bbR)) { s.bbW = bw.w || 0; s.bbR = bw.r || 0; s.bbNm = nm; }
    });
    return s;
  }

  // credit real statistics to persistent players: caps go to the eleven who
  // actually played (the engine names each innings XI), never the whole squad
  function creditStats(v2, f, sim) {
    [f.homeId, f.awayId].forEach(function (cid) {
      var c = v2.world.clubsById[cid]; if (!c || c.isUser) return;
      var byName = {};
      c.rosterIds.forEach(function (pid) { byName[v2.world.playersById[pid].name] = v2.world.playersById[pid]; });
      var capped = {};
      (sim.innings || []).forEach(function (inn) {
        if (!inn) return;
        if (inn.batTeam === c.name) {
          (inn.xi || []).forEach(function (pe) {
            var p = pe && byName[pe.name];
            if (p && !capped[p.id]) { capped[p.id] = 1; p.caps++; p.seasonCaps = (p.seasonCaps || 0) + 1; }
          });
          (inn.bat || []).forEach(function (b) {
            var p = b && b.p && byName[b.p.name]; if (!p) return;
            p.runs += (b.r || 0); p.seasonRuns = (p.seasonRuns || 0) + (b.r || 0);
            if (b.out) { p.dismissals = (p.dismissals || 0) + 1; }
          });
        } else {
          (inn.bxi || []).forEach(function (pe) {
            var p = pe && byName[pe.name];
            if (p && !capped[p.id]) { capped[p.id] = 1; p.caps++; p.seasonCaps = (p.seasonCaps || 0) + 1; }
          });
          Object.keys(inn.bowlers || {}).forEach(function (nm) {
            var p = byName[nm]; if (!p) return;
            p.wickets += (inn.bowlers[nm].w || 0);
            p.seasonWickets = (p.seasonWickets || 0) + (inn.bowlers[nm].w || 0);
          });
        }
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
      batFirstId: (sim.batFirstTeam === home.name) ? f.homeId : ((sim.batFirstTeam === away.name) ? f.awayId : null),
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
      var sponsorship = 2500 + Math.round(c.reputation * 45);
      var hosted = C.weekFixtures(v2, v2.week).some(function (f) { return f.homeId === cid && f.status === "played"; });
      var gate = hosted ? 6000 + Math.round(c.reputation * 150) : 0;
      c.finances.bank += sponsorship + gate - c.finances.wageBill;
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
      var isBowler = !!e.bowlType;
      for (var k in e.skills) {
        if (typeof e.skills[k] !== "number") continue;
        // primary craft moves at full rate, secondary skills at half:
        // batters grow their batting (vs*, temperament, power...), bowlers
        // their bowling craft — nobody improves everything equally
        var batting = /^vs|temper|power|tech|run/i.test(k);
        var primary = isBowler ? !batting : batting;
        var d2 = primary ? delta : (delta > 0 ? Math.floor(delta / 2) : Math.ceil(delta / 2));
        if (!d2) continue;
        e.skills[k] = Math.max(4, Math.min(96, e.skills[k] + d2));
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
      var pitch = f.neutral ? "balanced" : v2.world.clubsById[f.homeId].pitch;
      var ordersMap = {};
      [f.homeId, f.awayId].forEach(function (cid2) {
        var o = FOC.npc.matchOrders(v2, cid2, f);
        if (o) ordersMap[v2.world.clubsById[cid2].name] = o;
      });
      var sim = io.matchRunner(home, away, pitch, f.weather, seed, ordersMap);
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
    C.foundersAdvance(v2, io);
    C.crownSeed(v2);
    C.crownAdvance(v2, io);
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
      // reputation follows results, for every club under the same rule
      var expected = Math.max(1, Math.round(n * (1 - c.reputation / 100)));
      c.reputation = Math.max(15, Math.min(92, c.reputation + Math.max(-5, Math.min(5, expected - (i + 1)))));
      if (i === 0) {
        // ONE trophy ledger for everyone — NPC titles get the same record
        v2.history.trophies.push({ kind: "league", season: v2.seasonNumber, clubId: c.id,
          note: c.name + " — league champions, season " + v2.seasonNumber });
        var mCh = c.managerId && v2.world.managersById[c.managerId];
        if (mCh) mCh.history.push({ season: v2.seasonNumber, clubId: c.id, note: "league title" });
        L("champions", c.name + " are league champions.", { clubId: c.id });
      }
    });
    var founders = v2.world.competitionsById.founders;
    var crown = v2.world.competitionsById.crown;
    [["founders", founders, "lift the Founders Cup"], ["crown", crown, "take the Crown Cup"]].forEach(function (cu) {
      if (!cu[1] || !cu[1].winner) return;
      var wc = v2.world.clubsById[cu[1].winner];
      v2.history.trophies.push({ kind: cu[0], season: v2.seasonNumber, clubId: cu[1].winner,
        note: wc.name + " " + cu[2] + ", season " + v2.seasonNumber });
      var mW = wc.managerId && v2.world.managersById[wc.managerId];
      if (mW) mW.history.push({ season: v2.seasonNumber, clubId: wc.id, note: cu[0] + " cup" });
    });
    for (var mid in v2.world.managersById) {
      var m = v2.world.managersById[mid];
      if (m.clubId && !m.isUser) {
        m.seasonsAtClub = (m.seasonsAtClub || 0) + 1;
        var before = m.clubId;
        FOC.npc.boardReview(v2, m, C.position(v2, m.clubId), n, L);
        if (!m.clubId) { m.lastClubId = before; m.seasonsAtClub = 0; }
      }
    }
    // vacant chairs get filled from the dismissed pool — careers continue
    var vacant = Object.keys(v2.world.clubsById).filter(function (cid) {
      var c = v2.world.clubsById[cid]; return !c.isUser && !c.managerId;
    });
    var free = Object.keys(v2.world.managersById).filter(function (mid2) {
      var m2 = v2.world.managersById[mid2]; return !m2.clubId && !m2.isUser && m2.region === "england";
    });
    vacant.forEach(function (cid) {
      // the man the board just sacked does not get his own chair back
      var pickIx = -1;
      for (var fi = 0; fi < free.length; fi++) {
        if (v2.world.managersById[free[fi]].lastClubId !== cid) { pickIx = fi; break; }
      }
      if (pickIx < 0) return;   // nobody suitable this year — the chair stays empty
      var mid3 = free.splice(pickIx, 1)[0];
      var m3 = v2.world.managersById[mid3];
      m3.clubId = cid; m3.seasonsAtClub = 0;
      v2.world.clubsById[cid].managerId = mid3;
      m3.history.push({ season: v2.seasonNumber, clubId: cid, note: "appointed" });
      L("appointment", m3.name + " takes over at " + v2.world.clubsById[cid].name + ".", {});
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
    // ageing, contracts, retirements and a fresh calendar — same world, next year
    var Lr = log(v2);
    for (var pid in v2.world.playersById) {
      var p = v2.world.playersById[pid];
      p.age++;
      p.seasonRuns = 0; p.seasonWickets = 0; p.seasonCaps = 0;   // season aggregates reset
      if (p.engine) p.engine.age = p.age;
      var c9 = v2.world.clubsById[p.clubId];
      // retirement: the late thirties claim people, gradually not arbitrarily
      if (c9 && p.age >= 36 && RNG.chance(v2.rng, "development", (p.age - 35) * 0.25, "retire?")) {
        c9.rosterIds = c9.rosterIds.filter(function (id9) { return id9 !== p.id; });
        if (c9.captainId === p.id) c9.captainId = c9.rosterIds[0] || null;
        p.retired = v2.seasonNumber;
        v2.history.departures.push(FOC.model.transferRecord(v2, {
          playerId: p.id, playerName: p.name, fromId: c9.id, fromName: c9.name,
          toId: null, toName: "retirement", season: v2.seasonNumber, week: 15, fee: 0,
          caps: p.caps, runs: p.runs, wickets: p.wickets, role: p.engine && p.engine.bowlType ? "bowler" : "batter",
          why: "Retired at " + p.age + " after " + p.caps + " appearances."
        }));
        Lr("retirement", p.name + " retires at " + p.age + " — " + p.runs + " career runs, " + p.wickets + " wickets.", { playerId: p.id });
        continue;
      }
      if (p.contract) {
        p.contract.years--;
        if (p.contract.years <= 0) p.contract = { years: 1 + RNG.int(v2.rng, "transfers", 2), wage: p.contract.wage + 100 };
      }
    }
    // wage bills reflect this year's contracts, not last year's ghosts
    for (var cidW in v2.world.clubsById) {
      var cW = v2.world.clubsById[cidW];
      if (cW.isUser) continue;
      cW.finances.wageBill = cW.rosterIds.reduce(function (sum, pidW) {
        var pW = v2.world.playersById[pidW];
        return sum + ((pW && pW.contract && pW.contract.wage) || 0);
      }, 0);
    }
    // youth intake: thin squads take on the next generation
    for (var cid9 in v2.world.clubsById) {
      var c10 = v2.world.clubsById[cid9];
      if (c10.isUser) continue;
      while (c10.rosterIds.length < 14 && io.squadGen) {
        var gen9 = io.squadGen("intake|" + v2.worldSeed + "|" + c10.key + "|" + v2.seasonNumber + "|" + c10.rosterIds.length, "England", c10.arch, "talisman");
        var y9 = (gen9.players || []).slice().sort(function (a, b) { return (a.age || 30) - (b.age || 30); })[0];
        if (!y9) break;
        var yp = JSON.parse(JSON.stringify(y9)); delete yp.fee;
        yp.age = 17 + RNG.int(v2.rng, "newplayers", 3, "intake-age");
        for (var yk in (yp.skills || {})) {
          if (typeof yp.skills[yk] === "number") yp.skills[yk] = Math.max(4, Math.round(yp.skills[yk] * 0.82));
        }
        try { io.derive(yp); } catch (eY) {}
        var wp9 = FOC.model.playerFromEngine(v2, yp, c10.id);
        wp9.contract = { years: 2, wage: 300 };
        v2.world.playersById[wp9.id] = wp9;
        c10.rosterIds.push(wp9.id);
        c10.finances.wageBill += wp9.contract.wage;
        Lr("intake", c10.name + " register " + wp9.name + ", " + wp9.age + ", from the youth intake.", { playerId: wp9.id });
      }
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
