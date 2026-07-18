/* story/arcs — authored, conditional arc state machines.
 *
 * An arc is not a chapter: each stage is entered only when its real-world
 * condition is true, so the same arc lands at different times (or never)
 * across careers. State lives in v2.story.arcs[id] = {stage, data}.
 * Scenes are pushed through the ordinary storylet queue and obey the same
 * rule as everything else: quote saved facts or stay silent.
 *
 * Shape: Seed → Pressure → Choice → Delayed consequence → Resolution/rupture.
 */
FOC.arcs = (function () {
  var SL = FOC.storylets;
  function st(v2, id) { return v2.story.arcs = v2.story.arcs || {}, v2.story.arcs[id] = v2.story.arcs[id] || { stage: "dormant", data: {} }; }
  function fire(v2, defId) { v2.story.pending.push({ id: defId, week: v2.week, season: v2.seasonNumber, arc: 1 }); }
  function sc(sp, face, tx, choices) { return { sp: sp, face: face, tx: tx, choices: choices || null }; }
  function nmS(nm) { return nm ? String(nm).split(" ").slice(-1)[0] : ""; }

  var ARCS = [];

  // ---- 1 · captaincy legitimacy --------------------------------------------
  ARCS.push({
    id: "captaincy",
    tick: function (v2, api, trigger) {
      var a = st(v2, "captaincy");
      var cap = api.castName("captain"); if (!cap) return;
      var runs = api.captainLastScores(4);
      if (a.stage === "dormant" && runs.length >= 4 && runs.filter(function (r) { return r.r < 20; }).length >= 3) {
        a.stage = "pressure";
        // the successor is a fact, not an invention: next-best leadership marks
        var ps = FOC.adapter.players().filter(function (p) { return p && p.name !== cap; })
          .sort(function (x, y) { return (y.capt || 0) - (x.capt || 0); });
        a.data.successor = ps[0] ? ps[0].name : null;
        fire(v2, "arc-capt-pressure");
      } else if (a.stage === "chosen" && trigger === "userMatch") {
        var f = api.lastUserFacts();
        var capLine = f && (f.batLines || []).filter(function (b) { return b.nm === cap; })[0];
        if (a.data.backed && capLine && capLine.r >= 50) { a.stage = "resolved"; a.data.vindicated = capLine.r; fire(v2, "arc-capt-vindicated"); }
        else if (!a.data.backed && api.lastConfirmedCaptain() && api.lastConfirmedCaptain() !== cap) {
          a.stage = "resolved"; a.data.succeeded = api.lastConfirmedCaptain(); fire(v2, "arc-capt-succession");
        }
      }
    }
  });
  SL.register({ id: "arc-capt-pressure", on: "_arc", cast: "captain", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "captaincy"), cap = api.castName("captain");
      if (!cap) return null;
      return sc("The Gaffer", "gaffer-serious",
        "This is now a question, not a wobble: " + cap + "'s bat has gone quiet for a month" +
        (a.data.successor ? ", and half the room can see " + a.data.successor + " standing at slip with leadership marks nearly as good" : "") +
        ". Legitimacy isn't given by the armband — it's renewed weekly. Where do you stand?",
        [
          { t: "The captain is the captain. Full stop.", fx: function (v2b) { var a2 = st(v2b, "captaincy"); a2.stage = "chosen"; a2.data.backed = 1; } },
          { t: "Nobody's spot is above the scorebook — his included.", fx: function (v2b) { var a2 = st(v2b, "captaincy"); a2.stage = "chosen"; a2.data.backed = 0; } }
        ]);
    } });
  SL.register({ id: "arc-capt-vindicated", on: "_arc", cast: "captain", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "captaincy"), cap = api.castName("captain");
      return sc(cap || "Your captain", "player:bat",
        (a.data.vindicated || 50) + " today. I knew the runs were there; what I didn't know was whether you'd wait for them. You did. That's between us now — the kind of thing a dressing room doesn't forget.");
    } });
  SL.register({ id: "arc-capt-succession", on: "_arc", cast: "gaffer", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "captaincy");
      return sc("The Gaffer", "gaffer",
        nmS(a.data.succeeded) + " leads the side now, and you did it by the book: said the scorebook ruled, then followed it. The old captain will carry it one of two ways, and which way depends mostly on how you treat him from here.");
    } });

  // ---- 2 · the prospect pathway --------------------------------------------
  ARCS.push({
    id: "prospect",
    tick: function (v2, api, trigger) {
      var a = st(v2, "prospect");
      var kid = api.castName("prospect"); if (!kid) return;
      if (trigger !== "userMatch") return;
      var f = api.lastUserFacts(); if (!f) return;
      var line = (f.batLines || []).filter(function (b) { return b.nm === kid; })[0] ||
                 (f.bowlLines || []).filter(function (b) { return b.nm === kid; })[0];
      if (a.stage === "dormant" && line) { a.stage = "debut"; a.data.debut = line; fire(v2, "arc-kid-debut"); }
      else if (a.stage === "debut" && line && (line.r >= 40 || line.w >= 3)) {
        a.stage = "arrived"; a.data.big = line; fire(v2, "arc-kid-arrived");
      } else if (a.stage === "arrived" && api.selections(kid) >= 4) {
        a.stage = "established"; fire(v2, "arc-kid-established");
      }
    }
  });
  SL.register({ id: "arc-kid-debut", on: "_arc", cast: "prospect", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "prospect"), kid = api.castName("prospect"), d = a.data.debut || {};
      return sc(kid, "player:ar",
        "First real scorecard with my name in it" + (d.r != null ? ": " + d.r + (d.b ? " off " + d.b : "") : (d.w != null ? ": " + d.w + " for " + d.rc : "")) +
        ". I know it's one line in one book. But it's my line, and I'd like there to be more of them.");
    } });
  SL.register({ id: "arc-kid-arrived", on: "_arc", cast: "gaffer", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "prospect"), kid = api.castName("prospect"), d = a.data.big || {};
      return sc("The Gaffer", "gaffer",
        kid + ", " + (d.r >= 40 ? d.r + " under pressure" : d.w + " wickets") + ". I present evidence, not prophecy — and the evidence now says this is a cricketer, not a hopeful. Other clubs read scorebooks too. Worth remembering when his contract comes up.");
    } });
  SL.register({ id: "arc-kid-established", on: "_arc", cast: "prospect", weight: 1,
    scene: function (v2, api) {
      var kid = api.castName("prospect");
      return sc(kid, "player:ar",
        "Four sheets with my name on. I stopped checking whether I'm playing and started checking who we're playing. Thought you'd want to know the difference arrived.");
    } });

  // ---- 3 · Gaffer and Thorne: from clues to a reckoning (or never) ---------
  ARCS.push({
    id: "gafferthorne",
    tick: function (v2, api, trigger) {
      var a = st(v2, "gafferthorne");
      var clues = (v2.story.gtClues || []).length;
      if (a.stage === "dormant" && clues >= 2) { a.stage = "question"; fire(v2, "arc-gt-question"); }
      else if (a.stage === "pressed" && trigger === "userMatch") {
        // the reckoning only comes after actually facing Thorne's club
        var f = api.lastUserFacts();
        var crown = Object.keys(v2.world.clubsById).filter(function (id) { return v2.world.clubsById[id].key === "crown"; })[0];
        var uf = (v2.flags.userFactsHist || []).length;
        var met = FOC.competitions.fixtures(v2, function (fx) {
          return fx.status === "played" && ((fx.homeId === crown && fx.awayId === v2.user.clubId) || (fx.awayId === crown && fx.homeId === v2.user.clubId));
        }).length > 0;
        if (met && f) { a.stage = "reckoning"; a.data.won = !!f.win; fire(v2, "arc-gt-reckoning"); }
      }
      // "let it lie" careers simply never advance — permanent uncertainty is an ending
    }
  });
  SL.register({ id: "arc-gt-question", on: "_arc", cast: "gaffer", weight: 1,
    scene: function (v2, api) {
      return sc("The Gaffer", "gaffer-serious",
        "You've been collecting pieces of 2006 — the scorebook, the rest of it. So ask me, or don't. But decide, because half-knowing a thing poisons it.",
        [
          { t: "Ask him for the whole story", fx: function (v2b) { var a2 = st(v2b, "gafferthorne"); a2.stage = "pressed"; a2.data.asked = 1;
              v2b.story.pending.push({ id: "arc-gt-story", week: v2b.week, season: v2b.seasonNumber, arc: 1 }); } },
          { t: "Let it lie — it's his history, our fixture list", fx: function (v2b) { var a2 = st(v2b, "gafferthorne"); a2.stage = "closed"; } }
        ]);
    } });
  SL.register({ id: "arc-gt-story", on: "_arc", cast: "gaffer", weight: 1,
    scene: function (v2) {
      return sc("The Gaffer", "gaffer-serious",
        "2006, Marylebone. I was Reggie's playing assistant; he was my friend. Before the final, a selection call — a kid who'd earned it against a name who sold memberships. Board money leaned on Reggie; I held the pen and picked the kid. We lost by four runs, the kid dropped the catch, and neither of us has said the honest sentence since: we were both right, and it cost us anyway. Now you know what you're managing.");
    } });
  SL.register({ id: "arc-gt-reckoning", on: "_arc", cast: "thorne", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "gafferthorne");
      return sc("Reggie Thorne", "thorne",
        a.data.won
          ? "Your club beat mine, and your Gaffer finally has a scoreline he'd rather talk about than 2006. Tell him the torn page is in my desk. He can come and read it whenever he finds the nerve — and tell him... the kid was the right call. Twenty years to say one sentence."
          : "My club beat yours, which spares your Gaffer a conversation he's been rehearsing for twenty years. The page stays in my desk. Some accounts are better left open — it gives old men a reason to keep score.");
    } });

  // ---- 4 · Priya Raman: benchmark, confidante, rival ------------------------
  ARCS.push({
    id: "peer",
    tick: function (v2, api, trigger) {
      if (trigger !== "week" || v2.week !== 10) return;
      var a = st(v2, "peer");
      if (a.stage !== "dormant") return;
      var mid = v2.world.peerManagerId, m = mid && v2.world.managersById[mid];
      var pc = m && m.clubId && v2.world.clubsById[m.clubId];
      if (!pc) return;
      a.stage = "midseason";
      a.data.peerPos = FOC.competitions.position(v2, pc.id);
      a.data.userPos = api.userPosition();
      fire(v2, "arc-peer-mid");
    }
  });
  SL.register({ id: "arc-peer-mid", on: "_arc", cast: "peer", weight: 1,
    scene: function (v2, api) {
      var a = st(v2, "peer");
      var ahead = a.data.peerPos < a.data.userPos;
      return sc("Priya Raman", "npc:PR",
        (ahead ? "Midway: I'm " + a.data.peerPos + ", you're " + a.data.userPos + ". I'd apologise for enjoying it, but we promised each other honesty over sentiment. "
               : "Midway: you're " + a.data.userPos + ", I'm " + a.data.peerPos + ". Noted, filed, and photographed next to the empty cabinet. ") +
        "Either way — the two new clubs are still standing in a league that expected neither of us to be. That's worth one drink. One.",
        [
          { t: "Trade honest notes on the league (friends first)", fx: function (v2b) {
              var rel = (v2b.relationships.managerToManager[v2b.world.peerManagerId] = v2b.relationships.managerToManager[v2b.world.peerManagerId] || { trust: 50 });
              rel.trust = Math.min(100, rel.trust + 10); } },
          { t: "Keep your cards close (rivals first)", fx: function (v2b) {
              var rel = (v2b.relationships.managerToManager[v2b.world.peerManagerId] = v2b.relationships.managerToManager[v2b.world.peerManagerId] || { trust: 50 });
              rel.trust = Math.max(0, rel.trust - 8); } }
        ]);
    } });

  // ---- 5 · the returning former player --------------------------------------
  ARCS.push({
    id: "former",
    tick: function (v2, api, trigger) {
      var a = st(v2, "former");
      var dep = (v2.history.departures || []).filter(function (d) { return d.fromUser && d.toId; })[0];
      if (!dep) return;
      if (a.stage === "dormant") {
        // reunion: a fixture against his new club is on the calendar
        var nf = null;
        for (var w = v2.week; w <= 15 && !nf; w++) {
          var f = FOC.competitions.userFixture(v2, w);
          if (f && (f.homeId === dep.toId || f.awayId === dep.toId)) nf = f;
        }
        if (nf && nf.week === v2.week) { a.stage = "reunion"; a.data.dep = { nm: dep.playerName, club: dep.toName, fee: dep.fee }; fire(v2, "arc-former-reunion"); }
      } else if (a.stage === "reunion" && trigger === "userMatch") {
        var f2 = api.lastUserFacts(); if (!f2) return;
        // what did he ACTUALLY do against you? quote it or note the quiet day
        var opp = null;
        (v2.flags.userFactsHist || []).slice(-1).forEach(function (ff) { opp = ff; });
        a.stage = "aftermath";
        a.data.oppTop = f2.oppTopNm === a.data.dep.nm ? f2.oppTopR : null;
        fire(v2, "arc-former-aftermath");
      }
    }
  });
  SL.register({ id: "arc-former-reunion", on: "_arc", cast: "secretary", weight: 1,
    scene: function (v2) {
      var a = st(v2, "former");
      return sc("Margaret Hobb — club secretary", "npc:MH",
        "A note for your team talk: " + a.data.dep.nm + " is in " + a.data.dep.club + "'s squad this week. We sold him for " + Math.round((a.data.dep.fee || 0) / 1000) + "k; he knows every net session we run. I file. You manage.");
    } });
  SL.register({ id: "arc-former-aftermath", on: "_arc", cast: "gaffer", weight: 1,
    scene: function (v2) {
      var a = st(v2, "former");
      return sc("The Gaffer", "gaffer",
        a.data.oppTop != null
          ? a.data.dep.nm + " top-scored against us — " + a.data.oppTop + ". No revenge script wrote that; he's simply good, and we knew it when we cashed the cheque. Both things are true and both were your call."
          : a.data.dep.nm + " had a quiet one against his old club. No fairy tale either way — the engine doesn't do sentiment, and honestly, neither should we.");
    } });

  // ---- 6 · public trust ------------------------------------------------------
  ARCS.push({
    id: "trust",
    tick: function (v2, api, trigger) {
      var a = st(v2, "trust");
      var broken = (v2.story.promises || []).filter(function (p) { return p.status === "broken"; }).length;
      var kept = (v2.story.promises || []).filter(function (p) { return p.status === "fulfilled"; }).length;
      if (a.stage === "dormant" && broken >= 2) { a.stage = "strained"; fire(v2, "arc-trust-strained"); }
      else if (a.stage === "strained" && kept > broken) { a.stage = "restored"; fire(v2, "arc-trust-restored"); }
    }
  });
  SL.register({ id: "arc-trust-strained", on: "_arc", cast: "reporter", weight: 1,
    scene: function (v2) {
      var broken = (v2.story.promises || []).filter(function (p) { return p.status === "broken"; }).length;
      return sc("Sam Whitlow — the Argus", "npc:SW",
        "I'm running a piece on manager's promises. My count says " + broken + " made to players at your club and not kept. I print counts, not opinions — but readers form the opinions, and so do dressing rooms. Anything you'd like on the record?",
        [
          { t: "“Print it. And print the next six months too.”", fx: function (v2b) { v2b.flags.trustChallenge = 1; } },
          { t: "“No comment.”", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", -2); } }
        ]);
    } });
  SL.register({ id: "arc-trust-restored", on: "_arc", cast: "reporter", weight: 1,
    scene: function (v2) {
      return sc("Sam Whitlow — the Argus", "npc:SW",
        "Follow-up piece, as promised: the ledger has turned — more promises kept than broken now, and the room knows it. I'd call it a redemption arc but my editor says I'm not allowed the word 'arc'. Good week to be your press officer, if you had one.");
    } });

  function tick(v2, api, trigger) {
    ARCS.forEach(function (arc) { try { arc.tick(v2, api, trigger); } catch (e) {} });
  }

  return { tick: tick, ARCS: ARCS, _st: st };
})();
