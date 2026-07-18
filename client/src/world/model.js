/* world/model — entity constructors and id minting for the persistent world.
 * Pure data helpers: no HTML, no engine globals. Identity is an opaque
 * minted id (prefix + sequence), generated exactly once and never derived
 * from a name — names are editable display data.
 */
FOC.model = (function () {
  function mint(v2, prefix) {
    v2.idSeq = (v2.idSeq || 0) + 1;
    return prefix + "_" + v2.idSeq.toString(36);
  }

  function club(v2, cfg) {
    return {
      id: mint(v2, "c"), key: cfg.key, name: cfg.name, city: cfg.city,
      ground: cfg.ground, pitch: cfg.pitch, arch: cfg.arch,
      reputation: cfg.rep, isUser: !!cfg.isUser,
      managerId: null, rosterIds: [], captainId: null,
      finances: { bank: cfg.bank != null ? cfg.bank : 250000, wageBill: 0 },
      tendency: cfg.tendency || "balanced",   // balanced | attacking | defensive
      form: [],                                // last results, oldest→newest: W/L/T
      founded: cfg.founded || null,            // season number if newly founded
      compHistory: [], goals: cfg.goals || null
    };
  }

  function manager(v2, cfg) {
    return {
      id: mint(v2, "m"), name: cfg.name, clubId: null, region: cfg.region || "england",
      persona: cfg.persona || "",
      traits: cfg.traits,   // ambition loyalty risk prudence youthBias patience adaptability media sellWill rivalry jobSecurity (0-100)
      mood: 55, seasonsAtClub: 0,
      history: [],          // {season, clubId, note}
      memory: []            // {kind, aboutId, note} — transfers, disputes
    };
  }

  function playerFromEngine(v2, p, clubId) {
    // wraps a full engine-compatible player object with immutable identity
    return {
      id: mint(v2, "p"), name: p.name, age: p.age, clubId: clubId,
      contract: null,       // {years, wage}
      injuryWeeks: 0,
      caps: 0, runs: 0, wickets: 0, dismissals: 0,   // career stats, never reset by transfer
      engine: p             // the real skills object the match engine plays with
    };
  }

  function fixture(v2, wk, comp, round, homeId, awayId) {
    return { id: mint(v2, "f"), week: wk, comp: comp, round: round,
      homeId: homeId, awayId: awayId, status: "scheduled",
      weather: null, result: null };
  }

  function transferRecord(v2, o) {
    // a material departure: everything needed to remember it honestly
    return Object.assign({ id: mint(v2, "tr") }, o);
  }

  return { mint: mint, club: club, manager: manager, playerFromEngine: playerFromEngine,
    fixture: fixture, transferRecord: transferRecord };
})();
