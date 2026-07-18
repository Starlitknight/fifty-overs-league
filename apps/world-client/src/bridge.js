/* world-client/bridge — the ONLY module that touches legacy globals
 * (FOC.*, App, GD, userTeam, location.hash). Everything the world needs
 * from the cricket simulation passes through here, by stable ids and
 * plain facts. If it isn't in this file, it doesn't read legacy state.
 */
FOW.bridge = (function () {
  // legacy access goes through the intentional exports only:
  // __foSummer (campaign/career modules) and __foGame (engine plumbing)
  function ready() {
    try { return !!(window.__foSummer && window.__foSummer.career) && !!window.__foGame && typeof userTeam === "function"; }
    catch (e) { return false; }
  }
  function S() { return window.__foSummer; }
  function v1() { return S().save(); }
  function v2() { return S().career.career(); }
  function team() { try { return userTeam(); } catch (e) { return null; } }
  function players() { return (team() || {}).players || []; }

  // ---- anchors: real names from the real squad ------------------------------
  function anchor(role) {
    var s = v1();
    if (role === "captain") {
      if (s.castNames.captain) return s.castNames.captain;
      var c = captainCandidates()[0]; return c ? c.nm : null;
    }
    var ps = players().slice();
    if (!ps.length) return null;
    if (role === "veteran") return ps.sort(function (a, b) { return (b.age || 0) - (a.age || 0); })[0].name;
    if (role === "prospect") return ps.sort(function (a, b) { return (a.age || 0) - (b.age || 0); })[0].name;
    if (role === "star") return ps.sort(function (a, b) { return (b.bat || 0) - (a.bat || 0); })[0].name;
    if (role === "keeper") {
      var k = ps.filter(function (p) { return p.keeper; }).sort(function (a, b) { return (b.keep || 0) - (a.keep || 0); })[0];
      return k ? k.name : null;
    }
    if (role === "bowler") {
      var b = ps.filter(function (p) { return p.bowlType; })
        .sort(function (x, y) { return ((y.threat || 0) + (y.control || 0)) - ((x.threat || 0) + (x.control || 0)); })[0];
      return b ? b.name : null;
    }
    return null;
  }
  function captainCandidates() {
    try { return S().engine.makeCtx(v1()).captainCandidates(); } catch (e) { return []; }
  }

  // ---- founding -------------------------------------------------------------
  function clubName() { return (team() || {}).name || "the club"; }
  function found(w) {
    try {
      var nm = (w.flags.clubName || "").trim().slice(0, 26);
      if (nm && team()) team().name = nm;
      w.flags.founded = 1;
      var s = v1();
      S().events.emit(s, "ClubFounded", { nm: clubName(), colour: w.flags.colour, crest: w.flags.crest });
      S().saveMod.persist(s);
      try { if (typeof saveGame === "function") saveGame(false); } catch (e2) {}
    } catch (e) {}
  }
  function chooseCaptain(nm) {
    try {
      var s = v1(), ctx = S().engine.makeCtx(s);
      var p = players().filter(function (x) { return x.name === nm; })[0];
      if (p) ctx.setCast("captain", p);
      ctx.setCast("senior", ctx.pickSenior());
      ctx.setCast("prospect", ctx.pickProspect());
      ctx.setCast("fringe", ctx.pickFringe());
      var wk = ctx.pickKeeper(); if (wk) ctx.setCast("keeper", wk);
      var sb = ctx.strikeBowler(); if (sb) ctx.setCast("strike", sb);
      S().events.emit(s, "CaptainAppointed", { nm: nm, prev: null });
      S().saveMod.persist(s);
    } catch (e) {}
  }
  function choosePhilosophy(k) {
    try {
      var s = v1();
      var PH = { courage: "Courage", discipline: "Discipline", community: "Community", ambition: "Ambition" };
      s.philosophy = { k: k, label: PH[k] || k, chChosen: 0 };
      S().events.emit(s, "PhilosophyChosen", { k: k });
      // the world's onboarding replaces the chapter prologue: hand over
      s.ch = 1; s.beat = 0;
      S().saveMod.persist(s);
      S().career.begin();
    } catch (e) {}
  }

  // ---- fixtures and facts ---------------------------------------------------
  function nextOpponentKey() {
    try {
      var w2 = v2(); if (!w2) return null;
      var f = S().world.comps.userFixture(w2, w2.week);
      if (!f) return null;
      var opp = f.homeId === w2.user.clubId ? f.awayId : f.homeId;
      return (w2.world.clubsById[opp] || {}).key || null;
    } catch (e) { return null; }
  }
  function fixtureLive() { try { return !!(App.pending && App.pending.__career); } catch (e) { return false; } }
  function xiConfirmed() { try { return fixtureLive() && !!(App.orders && App.orders.saved); } catch (e) { return false; } }
  function userMatchCount() {
    try { return ((v2() || {}).flags.userFactsHist || []).length; } catch (e) { return 0; }
  }
  function lastFacts() { try { return (v2() || {}).flags.lastUserFacts || null; } catch (e) { return null; } }
  function latestHeadline() {
    try {
      var n = ((v2() || {}).world.news || []).filter(function (x) { return x.kind === "headline" || x.kind === "result"; })[0];
      return n ? n.text : null;
    } catch (e) { return null; }
  }
  function activePromise() {
    try {
      var pr = ((v2() || {}).story.promises || []).filter(function (p) { return p.status === "active"; })[0];
      return pr ? pr.txt : null;
    } catch (e) { return null; }
  }
  function trialFacts() {
    try {
      var m = (v1().matches || []).filter(function (x) { return x.key === "trial"; }).slice(-1)[0];
      return m ? { topNm: m.facts.topNm, topR: m.facts.topR, bbNm: m.facts.bbNm, bbW: m.facts.bbW, bbR: m.facts.bbR, mine: m.facts.batLines } : null;
    } catch (e) { return null; }
  }
  function trialDone() { return !!trialFacts(); }

  // ---- actions that leave the world (and come back) -------------------------
  function openLineup(withFixture) {
    try {
      if (withFixture && !fixtureLive()) S().career.startUserFixture();
      else { location.hash = "#/lineup"; if (window.route) window.route(); }
    } catch (e) {}
  }
  function walkout() {
    try { location.hash = "#/match"; if (window.route) window.route(); } catch (e) {}
  }
  function startTrial() { try { S().engine.playTrial(v1()); } catch (e) {} }
  function openCareer() { try { location.hash = "#/summer"; if (window.route) window.route(); } catch (e) {} }

  // engine surfaces are "away from the world"; the watcher brings us home
  function inLegacySurface() {
    try { return /#\/(lineup|match|summer|scorecard|orders)/.test(location.hash || ""); } catch (e) { return false; }
  }

  return { ready: ready, anchor: anchor, captainCandidates: captainCandidates,
    clubName: clubName, found: found, chooseCaptain: chooseCaptain, choosePhilosophy: choosePhilosophy,
    nextOpponentKey: nextOpponentKey, fixtureLive: fixtureLive, xiConfirmed: xiConfirmed,
    userMatchCount: userMatchCount, lastFacts: lastFacts, latestHeadline: latestHeadline,
    activePromise: activePromise, trialFacts: trialFacts, trialDone: trialDone,
    openLineup: openLineup, walkout: walkout, startTrial: startTrial, openCareer: openCareer,
    inLegacySurface: inLegacySurface };
})();
