/* world/generator — builds the persistent England world from the career seed.
 *
 * Ten clubs (nine NPC + the player's), each with a named manager, a full
 * engine-compatible roster, finances and tendencies; a nine-round league;
 * the Founders Cup play-in draw (persisted — reloading never rerolls it);
 * and the wider cast of international managers who exist in the world long
 * before the player ever meets them.
 */
FOC.worldgen = (function () {
  var MDL = FOC.model, RNG = FOC.rng;

  var CLUBS = [
    { key: "willowmere", ac: "#5B8C5A", name: "Willowmere CC", city: "Willowmere", ground: "The Meadow", pitch: "green", arch: "blade", rep: 38, mult: 0.86,
      mgr: { name: "Ted Marsh", persona: "thirty years at one club; charming in print, immovable in selection",
        traits: { ambition: 30, loyalty: 90, risk: 25, prudence: 75, youthBias: 45, patience: 85, adaptability: 35, media: 75, sellWill: 20, rivalry: 40, jobSecurity: 85 } } },
    { key: "ironbridge", ac: "#B3541E", name: "Ironbridge CC", city: "Ironbridge", ground: "Foundry Field", pitch: "flat", arch: "express", rep: 45, mult: 0.92,
      mgr: { name: "Frank Ostler", persona: "attacks with the bat, the ball and the budget; apologises to none of them",
        traits: { ambition: 80, loyalty: 40, risk: 85, prudence: 20, youthBias: 35, patience: 30, adaptability: 55, media: 60, sellWill: 55, rivalry: 70, jobSecurity: 45 } } },
    { key: "moorland", ac: "#4E6E81", name: "Moorland CC", city: "High Moor", ground: "High Tor", pitch: "green", arch: "rock", rep: 42, mult: 0.9,
      mgr: { name: "Gwen Sorley", persona: "plays kids nobody else would and demands standards nobody else could",
        traits: { ambition: 55, loyalty: 70, risk: 45, prudence: 60, youthBias: 90, patience: 60, adaptability: 50, media: 30, sellWill: 45, rivalry: 35, jobSecurity: 60 } } },
    { key: "fenholt", ac: "#8E5BA6", name: "Fenholt Athletic", city: "Fenholt", ground: "Brick Lane End", pitch: "dry", arch: "finisher", rep: 40, mult: 0.9, founded: 1,
      mgr: { name: "Priya Raman", persona: "refounded Fenholt the same spring you arrived; keeps a photograph of an empty trophy cabinet as motivation", peer: true,
        traits: { ambition: 85, loyalty: 60, risk: 60, prudence: 65, youthBias: 65, patience: 50, adaptability: 70, media: 55, sellWill: 35, rivalry: 55, jobSecurity: 50 } } },
    { key: "bellminster", ac: "#B08D2E", name: "Bellminster CC", city: "Bellminster", ground: "Cathedral Green", pitch: "dry", arch: "wizard", rep: 55, mult: 1.0,
      mgr: { name: "Alan Whitgift", persona: "reads every scorebook in the league and quotes yours back at you",
        traits: { ambition: 60, loyalty: 55, risk: 35, prudence: 70, youthBias: 40, patience: 40, adaptability: 80, media: 45, sellWill: 40, rivalry: 50, jobSecurity: 65 } } },
    { key: "blackstone", ac: "#3B3B3B", name: "Blackstone Ramblers", city: "Blackstone", ground: "The Quarry", pitch: "flat", arch: "express", rep: 65, mult: 1.06,
      mgr: { name: "Vic Crane", persona: "semi-pro money, pro expectations; sells anyone at the right price except his opening bowlers",
        traits: { ambition: 75, loyalty: 30, risk: 60, prudence: 45, youthBias: 20, patience: 35, adaptability: 60, media: 65, sellWill: 80, rivalry: 65, jobSecurity: 40 } } },
    { key: "kestrel", ac: "#2E7A8C", name: "Kestrel Park CC", city: "Kestrel Park", ground: "The Aviary", pitch: "green", arch: "gloveman", rep: 52, mult: 0.98,
      mgr: { name: "Sam Iredale", persona: "believes a fielding side is a moral position; warm until the team sheet goes up",
        traits: { ambition: 45, loyalty: 75, risk: 30, prudence: 80, youthBias: 55, patience: 70, adaptability: 45, media: 40, sellWill: 30, rivalry: 30, jobSecurity: 70 } } },
    { key: "harrowgate", ac: "#A64253", name: "Harrowgate CC", city: "Harrowgate", ground: "Spa Ground", pitch: "dry", arch: "wizard", rep: 58, mult: 1.02,
      mgr: { name: "Nerys Fell", persona: "two spinners minimum, three when nervous; runs the tightest budget in the league",
        traits: { ambition: 55, loyalty: 65, risk: 40, prudence: 90, youthBias: 50, patience: 65, adaptability: 55, media: 35, sellWill: 45, rivalry: 45, jobSecurity: 75 } } },
    { key: "crown", ac: "#14213D", name: "Crown Ground XI", city: "The Crown Ground", ground: "The Crown Ground", pitch: "flat", arch: "rock", rep: 80, mult: 1.14,
      mgr: { name: "Reggie Thorne", persona: "the institution; protects the club from everything, occasionally including its own players",
        traits: { ambition: 90, loyalty: 50, risk: 40, prudence: 60, youthBias: 25, patience: 55, adaptability: 65, media: 85, sellWill: 25, rivalry: 85, jobSecurity: 55 } } }
  ];

  // international figures — they exist now, tour later; contradictions, not stereotypes
  var WORLD_MANAGERS = [
    { name: "Desmond Clarke", region: "west-indies", persona: "captain-manager who preaches expression and then hands you a forty-page plan" },
    { name: "Thandi Mokoena", region: "southern-africa", persona: "builds academies like fortresses; nurturing in the corridor, merciless at the selection table" },
    { name: "Arjun Mehta", region: "subcontinent", persona: "the sharpest tactical mind in club cricket, employed by owners who want tomorrow's result yesterday" },
    { name: "Merv Callahan", region: "australia", persona: "serial winner who will fight anyone on your behalf, including you" },
    { name: "Kiri Waititi", region: "new-zealand", persona: "remembers every volunteer's name and drops his best mate without blinking" }
  ];

  function jitter(v2, base, amt, tag) { return Math.round(base + RNG.range(v2.rng, "worldgen", -amt, amt, tag)); }

  function buildRoster(v2, club, mult, io) {
    var gen = io.squadGen("world|" + v2.worldSeed + "|" + club.key, "England", club.arch, "talisman");
    (gen.players || []).forEach(function (p0) {
      var p = JSON.parse(JSON.stringify(p0)); delete p.fee;
      for (var k in (p.skills || {})) {
        if (typeof p.skills[k] === "number") {
          var m = mult * (1 + RNG.range(v2.rng, "worldgen", -0.04, 0.04));
          p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * m)));
        }
      }
      p.fatigue = "rested"; p.formIx = 3;
      try { io.derive(p); } catch (e) {}
      var wp = MDL.playerFromEngine(v2, p, club.id);
      wp.contract = { years: 1 + RNG.int(v2.rng, "worldgen", 3), wage: 400 + RNG.int(v2.rng, "worldgen", 900) };
      v2.world.playersById[wp.id] = wp;
      club.rosterIds.push(wp.id);
      club.finances.wageBill += wp.contract.wage;
    });
    // captain: best leadership marks in the generated squad
    var best = null;
    club.rosterIds.forEach(function (pid) {
      var wp = v2.world.playersById[pid];
      if (!best || (wp.engine.capt || 0) > (v2.world.playersById[best].engine.capt || 0)) best = pid;
    });
    club.captainId = best;
  }

  // circle-method round robin for 10 teams; user at slot 0, willowmere at
  // slot 9 so the career's first competitive fixture is Willowmere away
  function leagueFixtures(v2, clubIds) {
    var n = clubIds.length, rounds = n - 1;
    var arr = clubIds.slice(1);           // rotate all but clubIds[0]
    var weeksByRound = {};
    FOC.calendar.WEEKS.forEach(function (wk) { if (wk.kind === "league") weeksByRound[wk.round] = wk.w; });
    for (var r = 0; r < rounds; r++) {
      var wk = weeksByRound[r + 1];
      var pairs = [[clubIds[0], arr[arr.length - 1]]];
      for (var i = 0; i < (n / 2) - 1; i++) pairs.push([arr[i], arr[arr.length - 2 - i]]);
      pairs.forEach(function (pr, pi) {
        var home = (r + pi) % 2 === 0 ? pr[0] : pr[1];
        var away = home === pr[0] ? pr[1] : pr[0];
        var f = MDL.fixture(v2, wk, "league", r + 1, home, away);
        v2.world.fixturesById[f.id] = f;
      });
      arr.unshift(arr.pop());
    }
  }

  function generate(v2, io) {
    var W = v2.world;
    var userClub = null;
    CLUBS.forEach(function (cfg) {
      var c = MDL.club(v2, Object.assign({}, cfg, { bank: 150000 + cfg.rep * 3000 }));
      c.reputation = jitter(v2, cfg.rep, 4, "club-rep");
      W.clubsById[c.id] = c;
      var m = MDL.manager(v2, cfg.mgr);
      m.clubId = c.id; c.managerId = m.id;
      if (cfg.mgr.peer) { m.isPeer = true; v2.world.peerManagerId = m.id; }
      if (cfg.key === "crown") v2.world.thorneManagerId = m.id;
      W.managersById[m.id] = m;
      buildRoster(v2, c, cfg.mult, io);
    });
    // the player's club: real engine roster, referenced not duplicated
    var uc = MDL.club(v2, { key: "user", name: io.userClubName, city: "Home", ground: io.userGround,
      pitch: io.userPitch || "balanced", arch: "user", rep: 35, isUser: true, founded: 1,
      goals: { league: 6, note: "Finish 6th or higher and stay solvent — provisional status depends on it." } });
    uc.rosterRef = "engine";
    W.clubsById[uc.id] = uc;
    v2.user.clubId = uc.id;
    var um = MDL.manager(v2, { name: io.userManagerName || "You", persona: "the new arrival",
      traits: { ambition: 50, loyalty: 50, risk: 50, prudence: 50, youthBias: 50, patience: 50, adaptability: 50, media: 50, sellWill: 50, rivalry: 50, jobSecurity: 50 } });
    um.clubId = uc.id; uc.managerId = um.id; um.isUser = true;
    W.managersById[um.id] = um;
    v2.user.managerId = um.id;

    WORLD_MANAGERS.forEach(function (wm) {
      var m2 = MDL.manager(v2, { name: wm.name, persona: wm.persona, region: wm.region,
        traits: { ambition: 60, loyalty: 60, risk: 50, prudence: 60, youthBias: 50, patience: 55, adaptability: 60, media: 50, sellWill: 40, rivalry: 50, jobSecurity: 60 } });
      W.managersById[m2.id] = m2;   // no England club — they exist beyond this league
    });

    // league: user at slot 0, willowmere last so they meet in round 1
    var ids = Object.keys(W.clubsById);
    var wm9 = ids.filter(function (id) { return W.clubsById[id].key === "willowmere"; })[0];
    var ordered = [uc.id].concat(ids.filter(function (id) { return id !== uc.id && id !== wm9; })).concat([wm9]);
    leagueFixtures(v2, ordered);

    // Founders Cup play-in draw: four lowest-reputation clubs, drawn and PERSISTED
    var byRep = ids.slice().sort(function (a, b) { return W.clubsById[a].reputation - W.clubsById[b].reputation; });
    var playin = RNG.shuffle(v2.rng, "cupdraw", byRep.slice(0, 4), "founders-playin");
    v2.world.competitionsById.founders = {
      id: "comp_founders", name: "Founders Cup", stage: "playin",
      playin: [[playin[0], playin[1]], [playin[2], playin[3]]],
      alive: ids.slice(), bracket: {}, out: [], winner: null
    };
    var wkPlayin = 3;
    v2.world.competitionsById.founders.playin.forEach(function (pr) {
      var f = MDL.fixture(v2, wkPlayin, "founders", 1, pr[0], pr[1]);
      v2.world.fixturesById[f.id] = f;
    });
    v2.world.competitionsById.crown = {
      id: "comp_crown", name: "Crown Cup", stage: "pending",
      note: "Entry: top four of the league after Round 9.", entrants: [], bracket: {}, winner: null
    };
    return v2;
  }

  return { generate: generate, CLUBS: CLUBS, WORLD_MANAGERS: WORLD_MANAGERS };
})();
