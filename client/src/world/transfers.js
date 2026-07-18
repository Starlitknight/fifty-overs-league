/* world/transfers — players move for reasons: money, opportunity, ambition.
 * Every material departure is recorded in full (history.departures) and the
 * player keeps their immutable id and career statistics wherever they go.
 * A former player is never deleted — they are simply somewhere else now.
 */
FOC.transfers = (function () {
  var RNG = FOC.rng, MDL = FOC.model;

  function valuation(p) {
    var e = p.engine || {};
    var skill = (e.bat || 40) + ((e.threat || 0) + (e.control || 0)) / 2;
    var ageF = p.age <= 23 ? 1.5 : (p.age <= 28 ? 1.2 : (p.age <= 32 ? 0.8 : 0.45));
    return Math.round(skill * ageF * 400);
  }

  function weakestRole(v2, c) {
    var bats = 0, bowls = 0;
    c.rosterIds.forEach(function (pid) {
      var p = v2.world.playersById[pid];
      if (p.engine.bowlType) bowls++; else bats++;
    });
    return bowls < 6 ? "bowler" : "batter";
  }

  function bestSellable(v2, seller, role) {
    var best = null;
    seller.rosterIds.forEach(function (pid) {
      var p = v2.world.playersById[pid];
      var isBowler = !!p.engine.bowlType;
      if ((role === "bowler") !== isBowler) return;
      if (seller.captainId === pid) return;              // captains don't go quietly
      if (!best || valuation(p) > valuation(best)) best = p;
    });
    return best;
  }

  function execute(v2, p, fromClub, toClub, fee, why, log) {
    // full departure record — the club remembers even when the fans forget
    var dep = MDL.transferRecord(v2, {
      playerId: p.id, playerName: p.name, fromId: fromClub.id, fromName: fromClub.name,
      toId: toClub.id, toName: toClub.name, season: v2.seasonNumber, week: v2.week,
      fee: fee, contract: p.contract ? { years: p.contract.years, wage: p.contract.wage } : null,
      caps: p.caps, runs: p.runs, wickets: p.wickets, why: why,
      role: p.engine.bowlType ? "bowler" : (p.engine.keeper ? "keeper" : "batter")
    });
    v2.world.transfers.push(dep);
    v2.history.departures.push(dep);
    fromClub.rosterIds = fromClub.rosterIds.filter(function (id) { return id !== p.id; });
    toClub.rosterIds.push(p.id);
    p.clubId = toClub.id;
    p.contract = { years: 1 + RNG.int(v2.rng, "transfers", 3), wage: (p.contract ? p.contract.wage : 600) + 150 };
    fromClub.finances.bank += fee; toClub.finances.bank -= fee;
    fromClub.finances.wageBill = Math.max(0, fromClub.finances.wageBill - (dep.contract ? dep.contract.wage : 0));
    toClub.finances.wageBill += p.contract.wage;
    if (fromClub.captainId === p.id) fromClub.captainId = fromClub.rosterIds[0] || null;
    log("transfer", p.name + " leaves " + fromClub.name + " for " + toClub.name + " (" + Math.round(fee / 1000) + "k). " + why,
      { transferId: dep.id, playerId: p.id, fromId: fromClub.id, toId: toClub.id, fee: fee });
    return dep;
  }

  // weekly NPC↔NPC market: rich ambitious clubs shop; willing sellers sell
  function weeklyMarket(v2, log) {
    if (v2.week % 3 !== 0) return;   // windows: every third week, not a bazaar
    var ids = Object.keys(v2.world.clubsById);
    var buyers = ids.filter(function (cid) {
      var c = v2.world.clubsById[cid], m = c.managerId && v2.world.managersById[c.managerId];
      return c && !c.isUser && m && c.finances.bank > 220000 && m.traits.ambition >= 55;
    });
    buyers.forEach(function (cid) {
      var c = v2.world.clubsById[cid], m = v2.world.managersById[c.managerId];
      if (!RNG.chance(v2.rng, "transfers", 0.28 + m.traits.risk / 400, "npc-bid?")) return;
      var role = weakestRole(v2, c);
      var sellers = ids.filter(function (sid) {
        if (sid === cid) return false;
        var sc = v2.world.clubsById[sid], sm = sc.managerId && v2.world.managersById[sc.managerId];
        return sc && !sc.isUser && sm && (sm.traits.sellWill >= 55 || sc.finances.bank < 90000);
      });
      if (!sellers.length) return;
      var sc2 = v2.world.clubsById[RNG.pick(v2.rng, "transfers", sellers, "npc-seller")];
      var p = bestSellable(v2, sc2, role);
      if (!p) return;
      var fee = Math.round(valuation(p) * RNG.range(v2.rng, "transfers", 0.9, 1.25, "npc-fee"));
      if (fee > c.finances.bank * 0.5) return;   // prudence beats appetite
      var sm2 = v2.world.managersById[sc2.managerId];
      execute(v2, p, sc2, c, fee, m.name + " wanted a " + role + "; " + sm2.name + " wanted the money.", log);
      sm2.memory.push({ kind: "sold", aboutId: p.id, note: "sold to " + c.name + " for " + Math.round(fee / 1000) + "k" });
      m.memory.push({ kind: "bought", aboutId: p.id, note: "signed from " + sc2.name });
    });
  }

  // occasionally an NPC club bids for a USER player — an offer, never a raid
  function maybeUserOffer(v2, userPlayers, log) {
    if (v2.week % 4 !== 0) return null;
    if (!RNG.chance(v2.rng, "transfers", 0.35, "user-offer?")) return null;
    var ids = Object.keys(v2.world.clubsById).filter(function (cid) {
      var c = v2.world.clubsById[cid];
      return c && !c.isUser && c.finances.bank > 260000;
    });
    if (!ids.length || !userPlayers.length) return null;
    var buyer = v2.world.clubsById[RNG.pick(v2.rng, "transfers", ids, "user-offer-club")];
    // they bid for form, not for your favourite: highest recent aggregate
    var target = userPlayers[RNG.int(v2.rng, "transfers", Math.min(5, userPlayers.length), "user-offer-target")];
    var fee = Math.round((40 + (target.bat || 40)) * 450 * RNG.range(v2.rng, "transfers", 0.9, 1.3));
    return { buyerId: buyer.id, buyerName: buyer.name, playerName: target.name, fee: fee };
  }

  return { valuation: valuation, execute: execute, weeklyMarket: weeklyMarket,
    maybeUserOffer: maybeUserOffer, weakestRole: weakestRole, bestSellable: bestSellable };
})();
