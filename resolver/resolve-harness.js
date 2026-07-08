/* ================================================================
   PHASE 0 — HEADLESS RESOLVE HARNESS  (ADDITIVE; no engine-logic edits)
   Exposes window.__resolveMatch(homeSquad, awaySquad, homeOrders, awayOrders, conds)
   -> { result_text, winner_team, mom, scorecard, worm, log, seed, pitch, meta }
   using the EXACT same code path as simBackground()/stepBall(): it only
   (a) injects squads + a two-sided ordersMap, (b) runs the same ball loop,
   (c) snapshots M into JSON. All live globals are saved and restored, so a
   resolve has zero side effects on the running game.
   ================================================================ */
(function(){
  // NOTE: deliberately sloppy-mode (like the rest of the file) so a bare
  // reassignment updates the SAME global binding the engine calls by name.

  // --- The ONE input-routing addition needed for faithful two-sided play. ---
  // The stock engine dispatches batting intent (stepBall line ~624):
  //     const intent = userBat ? userPhaseIntent(inn) : aiIntent(inn);
  // where userBat is true ONLY for the M.user (home) side. So the home side reads
  // its intent from the global App.orders (userPhaseIntent) and the away side is
  // ALWAYS AI (aiIntent) -- neither reads the per-team orders map. To honor BOTH
  // managers' submitted phaseIntent we redirect BOTH functions to the per-team
  // ordersMap keyed by inn.batTeam (the same pattern plannedBowler() already uses,
  // P16 "per-team orders map"). This changes only the SOURCE of the intent integer;
  // ballDist()/apply() -- how runs/wickets/scores are computed -- are untouched.
  // Gated behind __RESOLVE_ACTIVE so normal gameplay is byte-identical.
  window.__RESOLVE_ACTIVE = false;
  function _resolveIntent(inn){
    if (!(window.__RESOLVE_ACTIVE && typeof M !== 'undefined' && M && M.ordersMap)) return undefined;
    var O = M.ordersMap[inn.batTeam];
    if (!O || !O.phaseIntent) return undefined;
    var over = Math.floor(inn.legal/6), ph = over<10?'pp':(over>=40?'death':'mid');
    var base = (O.phaseIntent[ph] !== undefined) ? O.phaseIntent[ph] : 0;
    // same chase-adjust clamp the stock userPhaseIntent applies
    if (M.target){ var remBalls=300-inn.legal, rem=remBalls/6, req=(M.target-inn.runs)/Math.max(0.5,rem);
      if(req>9.2&&base<2)base=2; else if((req>7.2||req>6.4&&remBalls<90)&&base<1)base=Math.min(1,base+1);
      else if(req<4.2&&inn.wkts<5&&base>-1)base=base-1; }
    return base;
  }
  if (typeof userPhaseIntent === 'function') {
    var _origUserPhaseIntent = userPhaseIntent;
    userPhaseIntent = function(inn){
      var v = _resolveIntent(inn);
      return (v === undefined) ? _origUserPhaseIntent.apply(this, arguments) : v;
    };
  }
  if (typeof aiIntent === 'function') {
    var _origAiIntent = aiIntent;
    aiIntent = function(inn){
      var v = _resolveIntent(inn);
      return (v === undefined) ? _origAiIntent.apply(this, arguments) : v;
    };
  }

  function cloneTeam(sq){
    return { name: sq.name,
             ground: sq.ground || 'Neutral Ground',
             players: (sq.players||[]).map(function(p){ return JSON.parse(JSON.stringify(p)); }) };
  }

  // Honor each side's chosen keeper (orders.keeper is a name) by setting the
  // keeper flag on that squad's players only. If the named keeper isn't in the
  // squad, the squad's own keeper flags are left intact.
  function markKeeper(team, ord){
    if (!ord || !ord.keeper) return;
    var found = team.players.some(function(p){ return p.name === ord.keeper; });
    if (!found) return;
    team.players.forEach(function(p){ p.keeper = (p.name === ord.keeper); });
  }

  function inningsCard(inn){
    if (!inn) return null;
    return {
      batTeam: inn.batTeam, bowlTeam: inn.bowlTeam,
      runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      overs: Math.floor(inn.legal/6)+'.'+(inn.legal%6),
      extras: inn.extras,
      captBatName: inn.captBatName, captBowlName: inn.captBowlName,
      batting: inn.bat.map(function(b){
        return { name:b.p.name, r:b.r, b:b.b, f4:b.f4, f6:b.f6,
                 out:b.out||'not out', sr:(b.b?+(100*b.r/b.b).toFixed(2):0) };
      }),
      bowling: Object.keys(inn.bowlers).map(function(k){ var r=inn.bowlers[k];
        return { name:r.p.name, overs:Math.floor(r.b/6)+'.'+(r.b%6), balls:r.b,
                 r:r.r, w:r.w, econ:(r.b?+(r.r/(r.b/6)).toFixed(2):0) };
      }),
      fow: inn.fow, pships: inn.pships
    };
  }

  // Per-player match consequences (form + fatigue), computed with the EXACT
  // formulas the game applies in saveMatch() (lines ~1915-1932): this is derived
  // post-match state, not engine-core logic. Deterministic from the innings. The
  // server applies these to the roster for OFFICIAL matches only; friendlies
  // discard them. captBat/captBowl come from the per-team orders (via mkInns),
  // so the keeper/captain fatigue thresholds match the real game.
  var FORMW = ['abysmal','poor','shaky','steady','good','strong','excellent'];
  function computeConsequences(m){
    var cons = {};
    function ensure(p){
      if(!cons[p.name]) cons[p.name] = { fatigue: p.fatigue, formIx: (p.formIx==null?3:p.formIx) };
      return cons[p.name];
    }
    for(var i=0;i<m.innings.length;i++){
      var inn = m.innings[i]; if(!inn) continue;
      var capBat = inn.captBatName, capBowl = inn.captBowlName;
      inn.bat.forEach(function(b){
        if(!(b.b>0 || b.out)) return;
        var c = ensure(b.p);
        if(b.r>=50) c.formIx = Math.min(6, c.formIx+1);
        else if(b.r<10 && b.out) c.formIx = Math.max(1, c.formIx-1);
        var thrB = (b.p.keeper || b.p.name===capBat) ? 75 : 90;
        c.fatigue = (b.b>=thrB) ? 'tired' : (c.fatigue==='tired' ? 'rested' : c.fatigue);
      });
      Object.keys(inn.bowlers).forEach(function(k){
        var br = inn.bowlers[k], p = br.p, c = ensure(p);
        if(br.w>=3) c.formIx = Math.min(6, c.formIx+1);
        else if(br.b>=36 && br.w===0 && br.r/(br.b/6)>6.8) c.formIx = Math.max(1, c.formIx-1);
        var thrW = (p.keeper || p.name===capBowl) ? 42 : 48;
        c.fatigue = (br.b>=thrW) ? 'tired' : (c.fatigue==='tired' ? 'rested' : c.fatigue);
      });
    }
    for(var nm in cons) cons[nm].formWord = FORMW[cons[nm].formIx];
    return cons;
  }

  function buildResult(m){
    return {
      result_text: m.result ? m.result.text : '',
      winner_team: m.result ? m.result.winner : null,
      mom: m.result ? m.result.mom : null,
      scorecard: m.innings.map(inningsCard),
      worm: m.worm,
      log: m.log,
      consequences: computeConsequences(m),
      seed: m.seed,
      pitch: m.pitch,
      meta: m.meta
    };
  }

  window.__resolveMatch = function(homeSquad, awaySquad, homeOrders, awayOrders, conds){
    conds = conds || {};
    var home = cloneTeam(homeSquad), away = cloneTeam(awaySquad);
    markKeeper(home, homeOrders); markKeeper(away, awayOrders);

    // snapshot every live global we touch, restore in finally -> no side effects
    var _M = (typeof M!=='undefined'?M:null), _toss = App.tossState, _orders = App.orders,
        _page = App.page, _ome = window.onMatchEnd, _res = window.__RESOLVE_ACTIVE, _up = UI.usePlan;
    try {
      window.__RESOLVE_ACTIVE = true;
      App.page = '__resolve__';                 // render()/renderMatch() become no-ops
      window.onMatchEnd = function(){};         // suppress saveMatch() side effect
      UI.usePlan = true;                        // let plannedBowler() consult the ordersMap
      // neutral globals so no stray App.orders leaks into either side
      App.orders = { batOrder:[], captain:null, keeper:null,
                     phaseIntent:{pp:0,mid:0,death:1}, fieldPlan:{pp:'bal',mid:'bal',death:'bal'},
                     spells:{north:[],south:[]}, compiled:[], saved:false };

      M = newMatch(home, away, conds.pitch || 'balanced', (conds.seed>>>0));
      M.meta = { home:home.name, away:away.name, ground:conds.ground||home.ground,
                 pitch:conds.pitch||'balanced', weather:conds.weather||'Sunny',
                 seed:(conds.seed>>>0), comp:conds.friendly?'friendly':'league',
                 round:(conds.round==null?null:conds.round), date:conds.date||'' };
      M.isUserMatch = false;                    // disables field-plan / keeper-global / ordersFor-fallback leaks
      M.ordersMap = {};
      M.ordersMap[home.name] = homeOrders || null;
      M.ordersMap[away.name] = awayOrders || null;
      App.tossState = { stage:'x' };
      // deterministic toss, identical to simBackground(): home ("user" slot) bats if true
      applyToss(aiTossDecision());
      var g = 0; while (!M.done && g++ < 3000){ autoPick(); stepBall(); }
      return buildResult(M);
    } finally {
      M = _M; App.tossState = _toss; App.orders = _orders; App.page = _page;
      window.onMatchEnd = _ome; window.__RESOLVE_ACTIVE = _res; UI.usePlan = _up;
    }
  };

  // Season rollover for one squad, mirroring the game's seasonEnd() aging (lines
  // ~1461-1476): age++, 31+ skill decline (then jsDerive to recompute rating),
  // retirement at 35+ or (32+ and a 35% roll), and a fresh-season reset of
  // fatigue/form. Deterministic per (seasonNo, teamKey) and independent of other
  // teams (there is no canonical GD.teams order across independent leagues).
  window.__ageSquad = function(players, seasonNo, teamKey){
    var h = ((seasonNo>>>0) * 524287) >>> 0;
    var key = String(teamKey||'');
    for (var i=0;i<key.length;i++){ h = ((h ^ key.charCodeAt(i)) >>> 0); h = ((h*1103515245 + 12345) >>> 0); }
    var rnd = function(){ h = ((h*1103515245 + 12345) >>> 0); return h/4294967296; };
    var HEAVY = ['power','stamina','fielding','catching'];
    var LIGHT = ['vsPace','vsSpin','rotation','wicket','economy','moveTurn'];
    var out = [], retired = [];
    (players||[]).forEach(function(src){
      var p = JSON.parse(JSON.stringify(src));
      p.age = (p.age||18) + 1;
      if (p.age >= 31){
        var dropH = 2 + (p.age-31) + Math.floor(rnd()*2);
        var dropL = 1 + Math.floor((p.age-31)/2);
        HEAVY.forEach(function(sk){ if(p.skills && p.skills[sk]!==undefined) p.skills[sk]=Math.max(5,p.skills[sk]-dropH); });
        LIGHT.forEach(function(sk){ if(p.skills && p.skills[sk]!==undefined && p.skills[sk]>10) p.skills[sk]=Math.max(5,p.skills[sk]-dropL); });
        if (typeof jsDerive === 'function') jsDerive(p);
      }
      p.fatigue = 'rested'; p.formIx = 3; p.formWord = FORMW[3];   // fresh season
      if (p.age >= 35 || (p.age >= 32 && rnd() < 0.35)) retired.push(p.name);
      else out.push(p);
    });
    return { players: out, retired: retired };
  };

  /* ================================================================
     FAIR LEAGUE ECONOMY (ADDITIVE): the engine's weekly tick treats the
     snapshot's own club richly (gate income, its sponsor, full ledger) and
     everyone else with a flat "+25k - costs" formula and NO gate. In a
     multiplayer league every human club deserves the same books. After
     completeRound() we re-settle EVERY club identically from its own squad:
       + its sponsor deal (base + win bonus + halfway/season milestones)
       + home gate (engine attendance() x $9)
       - wage bill - stadium ($1/seat) - academies
     and keep mood/supporters moving for every club, not just the pusher's.
     Season-end prize money stays with the engine (it already pays all clubs).
     ================================================================ */
  var FO_DEALS = {
    community: { base: 45000, win: 0, halfway: 0, seasonTop3: 0, champ: 0 },
    results:   { base: 38000, win: 10000, halfway: 0, seasonTop3: 0, champ: 0 },
    contender: { base: 30000, win: 16000, halfway: 60000, seasonTop3: 90000, champ: 120000 }
  };
  var FO_ACAD = [0, 4000, 8000, 14000, 22000, 32000];
  function foWages(t) { return (t && t.players ? t.players.reduce(function (s, p) { return s + (+p.wage || 0); }, 0) : 0); }
  function foDealOf(t) { return FO_DEALS[(t.sponsorDeal && t.sponsorDeal.id) || t.sponsor] || FO_DEALS.community; }

  var _foCompleteRound = window.completeRound;
  window.completeRound = function () {
    var S = App.season, round = S ? S.round : 0;
    var pre = {}, preAtt = {}, meName = null;
    try {
      GD.teams.forEach(function (t) {
        pre[t.name] = t.bank || 0;
        // gate is priced at the crowd the club walks in with, BEFORE the round
        // mutates mood/supporters — deterministic and matches the forecast.
        try { preAtt[t.name] = Math.min(t.seats || 9000, Math.round((t.supporters || 2600) * (0.55 + 0.13 * (t.mood == null ? 3 : t.mood)))); } catch (e) { preAtt[t.name] = 2400; }
      });
      meName = userTeam().name;
    } catch (e) {}
    var out = _foCompleteRound.apply(this, arguments);
    try {
      var total = (S && S.schedule) ? S.schedule.length : 18;
      var results = (App.results || []).filter(function (r) { return r.comp === 'league' && r.round === round; });
      var rows = null;
      try { rows = leagueRows(); } catch (e) {}
      var posOf = function (nm) { if (!rows) return 99; var i = rows.findIndex(function (r) { return r.nm === nm; }); return i < 0 ? 99 : i + 1; };
      GD.teams.forEach(function (t) {
        var deal = foDealOf(t);
        var acad = (FO_ACAD[Math.max(0, Math.min(5, t.acadY || 0))] || 0) + (FO_ACAD[Math.max(0, Math.min(5, t.acadS || 0))] || 0);
        var net = deal.base - foWages(t) - (t.seats || 9000) - acad;
        var r = results.find(function (x) { return x.home === t.name || x.away === t.name; });
        if (r && r.home === t.name) net += (preAtt[t.name] || 2400) * 9;
        if (r && r.result && r.result.winner === t.name) net += deal.win || 0;
        if (round + 1 === Math.floor(total / 2) && posOf(t.name) <= 3) net += deal.halfway || 0;
        if (round + 1 === total) {
          if (posOf(t.name) <= 3) net += deal.seasonTop3 || 0;
          if (posOf(t.name) === 1) net += deal.champ || 0;
        }
        t.bank = (pre[t.name] || 0) + net;
        // mood/supporters march for every club (engine only moves the pusher's)
        if (t.name !== meName && r) {
          var won = r.result && r.result.winner === t.name;
          t.mood = Math.max(0, Math.min(6, (t.mood == null ? 3 : t.mood) + (won ? 1 : -1)));
          t.supporters = Math.max(800, Math.round((t.supporters || 2600) * (won ? 1.03 : 0.985)));
        }
      });
      // keep the snapshot's fin aligned with ITS club's fair books
      var me = userTeam(); if (App.fin && me) App.fin.bank = me.bank;
    } catch (e) { console.log('fair economy settle failed:', e && e.message); }
    return out;
  };

  /* ================================================================
     FAIR TRAINING + CLUB ORDERS (ADDITIVE): the engine's patched
     applyTraining() honours training programs only for the snapshot's own
     club — everyone else's players are RESET to default programs each round.
     We replace it with the same maths applied even-handedly: every club's
     saved p.training is honoured (bots fall back to sensible defaults), and
     each club gets its own training report stored on the club record so
     every manager sees THEIR gains, not the pusher's.
     Managers submit training programs and youth signings inside their order
     packets (fo_training / fo_youth) — conflict-free per-manager channels.
     ================================================================ */
  var FT_PROGS = {
    'Batting': { vsPace: 25, vsSpin: 25, rotation: 20, temperament: 20, stamina: 10 },
    'New-ball batting': { vsPace: 45, temperament: 25, rotation: 15, stamina: 15 },
    'Spin batting': { vsSpin: 45, rotation: 20, temperament: 20, power: 15 },
    'Power hitting': { power: 50, vsPace: 15, vsSpin: 15, temperament: 10, stamina: 10 },
    'Finishing': { power: 35, temperament: 25, rotation: 20, vsPace: 10, vsSpin: 10 },
    'Bowling': { wicket: 25, economy: 25, discipline: 20, moveTurn: 15, variation: 10, stamina: 5 },
    'New-ball seam': { moveTurn: 30, wicket: 25, discipline: 20, economy: 15, stamina: 10 },
    'Spin bowling': { moveTurn: 30, wicket: 25, variation: 20, economy: 15, discipline: 10 },
    'Death bowling': { economy: 30, discipline: 30, variation: 20, stamina: 15, wicket: 5 },
    'Control bowling': { economy: 40, discipline: 30, variation: 15, stamina: 15 },
    'Keeping': { keeping: 30, catching: 25, stumping: 25, fielding: 15, stamina: 5 },
    'Fielding': { fielding: 40, catching: 30, stamina: 20, power: 10 },
    'Fitness': { stamina: 65, power: 25, fielding: 10 },
    'All-rounder': { vsPace: 15, vsSpin: 15, wicket: 15, economy: 15, fielding: 20, stamina: 20 },
    'Rest': {}
  };
  var FT_INTENSITY = { Light: 0.75, Normal: 1, Intense: 1.20, Rest: 0 };
  var FT_FATRANK = { 'clinically dead': 0, shattered: 1, exhausted: 2, listless: 3, weary: 4, moderate: 5, satisfactory: 6, passable: 7, energetic: 8, revived: 9, rested: 10 };
  var FT_FATNAMES = ['clinically dead', 'shattered', 'exhausted', 'listless', 'weary', 'moderate', 'satisfactory', 'passable', 'energetic', 'revived', 'rested'];
  var FT_FATF = [0.35, 0.45, 0.55, 0.68, 0.78, 0.86, 0.93, 0.97, 1.00, 1.02, 1.04];
  function ftFatScore(p) { var r = FT_FATRANK[String(p.fatigue || 'rested').toLowerCase()]; return r == null ? 4 : r; }
  function ftAgeFactor(age) { return age <= 20 ? 1.35 : age <= 24 ? 1.15 : age <= 29 ? 0.90 : age <= 32 ? 0.55 : 0.25; }
  function ftPotential(p) {
    if (p.training && p.training.potential) return p.training.potential;
    var v = ((p.talent === 'gifted' || (p.talents || []).length >= 2) ? 2 : 0) + (p.age <= 20 ? 2 : p.age <= 24 ? 1 : 0) + ((p.rating || 0) > 3600 ? 1 : 0);
    return v >= 4 ? 'Star' : v >= 3 ? 'High' : v >= 1 ? 'Useful' : 'Limited';
  }
  function ftPotFactor(p) { return { Limited: 0.80, Useful: 1, High: 1.15, Star: 1.30 }[ftPotential(p)] || 1; }
  function ftThreshold(v) { return 80 + (+v || 0) * 1.5; }
  function ftDefaultProgram(p) {
    var PACE = ['seamFast', 'seamFastMedium', 'seamMedium', 'partTimeSeam'];
    if (p.keeper) return 'Keeping';
    if (p.role === 'allRounder') return 'All-rounder';
    if (p.bowlTypeFull && PACE.indexOf(p.bowlTypeFull) >= 0) return 'New-ball seam';
    if (p.bowlTypeFull && p.bowlTypeFull !== 'none') return 'Spin bowling';
    return p.role === 'middleOrderBat' ? 'Finishing' : 'Batting';
  }
  function ftEnsure(p) {
    if (!p.training) p.training = { program: null, intensity: 'Normal', progressBySkill: {}, potential: null };
    if (!p.training.program || !FT_PROGS[p.training.program]) p.training.program = ftDefaultProgram(p);
    if (!FT_INTENSITY.hasOwnProperty(p.training.intensity)) p.training.intensity = 'Normal';
    if (!p.training.progressBySkill) p.training.progressBySkill = {};
    if (!p.training.potential) p.training.potential = ftPotential(p);
    p.trainFocus = p.training.program;
    return p.training;
  }

  // Fair replacement for the engine's applyTraining — identical maths, every club equal.
  window.applyTraining = function () {
    var round = App.season ? App.season.round : 0;
    var h = ((round * 77797 + (App.seasonNo || 1) * 13) >>> 0);
    var rnd = function () { return ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296); };
    GD.teams.forEach(function (t) {
      var report = { round: round + 1, gains: [], recovery: [], signings: [] };
      [[t.players || [], false], [t.youth || [], true]].forEach(function (pair) {
        var pool = pair[0], isYouth = pair[1];
        var overLimit = Math.max(0, pool.length - (isYouth ? 18 : 24));
        var squadEff = Math.max(0.65, 1 - overLimit * 0.03);
        var acad = 1 + (isYouth ? 0.10 * (t.acadY || 0) : 0.08 * (t.acadS || 0));
        pool.forEach(function (p) {
          var tr = ftEnsure(p);
          if (!t.founded && !t.sponsorDeal) { tr.program = ftDefaultProgram(p); tr.intensity = 'Normal'; }  // bots
          if (tr.program === 'Rest' || tr.intensity === 'Rest') {
            var before = p.fatigue || 'rested';
            p.fatigue = FT_FATNAMES[Math.min(10, ftFatScore(p) + 2)] || 'rested';
            if (before !== p.fatigue) report.recovery.push(p.name + ': ' + before + ' → ' + p.fatigue);
            return;
          }
          var base = isYouth ? 34 : 24;
          var pts = base * ftAgeFactor(p.age) * ftPotFactor(p) * acad * FT_FATF[ftFatScore(p)] * (FT_INTENSITY[tr.intensity] || 1) * squadEff;
          if (tr.program === 'All-rounder') pts *= 0.85;
          var weights = FT_PROGS[tr.program] || FT_PROGS[ftDefaultProgram(p)];
          var total = 0; for (var k in weights) total += weights[k]; total = total || 1;
          for (var sk in weights) {
            if (p.skills[sk] === undefined) continue;
            tr.progressBySkill[sk] = (tr.progressBySkill[sk] || 0) + pts * weights[sk] / total;
            var th = ftThreshold(p.skills[sk]);
            while (tr.progressBySkill[sk] >= th && p.skills[sk] < 96) {
              tr.progressBySkill[sk] -= th;
              p.skills[sk]++;
              if (typeof jsDerive === 'function') jsDerive(p);
              report.gains.push(p.name + ': ' + sk + ' +1');
              th = ftThreshold(p.skills[sk]);
            }
          }
        });
      });
      t._trainReport = report;   // snapshot-borne: every manager reads their own club's report
    });
  };

  // Apply each manager's packet-borne club orders. Training BEFORE the round
  // (so this matchday trains on the submitted programs); youth AFTER the fair
  // money settle (fees deduct from the settled bank).
  function foApplyPacketTraining(pkts) {
    (pkts || []).forEach(function (pk) {
      if (!pk || !pk.club || !pk.fo_training) return;
      var t = GD.teams.find(function (x) { return x.name === pk.club; }); if (!t) return;
      for (var nm in pk.fo_training) {
        var want = pk.fo_training[nm] || {};
        var p = (t.players || []).find(function (x) { return x.name === nm; }); if (!p) continue;
        var tr = ftEnsure(p);
        if (want.program && FT_PROGS[want.program]) { tr.program = want.program; p.trainFocus = want.program; }
        if (want.intensity && FT_INTENSITY.hasOwnProperty(want.intensity)) tr.intensity = want.intensity;
      }
    });
  }
  function foApplyPacketYouth(pkts, round) {
    (pkts || []).forEach(function (pk) {
      if (!pk || !pk.club || !pk.fo_youth || !pk.fo_youth.length) return;
      var t = GD.teams.find(function (x) { return x.name === pk.club; }); if (!t) return;
      var cand = pk.fo_youth[0];   // hard cap: one signing per round
      if (!cand || !cand.name) return;
      if ((t.players || []).length >= 18) return;
      if (t.players.find(function (x) { return x.name === cand.name; })) return;
      var fee = Math.max(5000, Math.round(+cand.fee || 0));
      if ((t.bank || 0) < fee) return;
      var p = JSON.parse(JSON.stringify(cand));
      delete p.fee;
      p.fatigue = 'rested'; p.formIx = 3;
      ftEnsure(p);
      t.players.push(p);
      t.bank -= fee;
      t._trainReport = t._trainReport || { round: round + 1, gains: [], recovery: [], signings: [] };
      (t._trainReport.signings = t._trainReport.signings || []).push(p.name + ' (age ' + p.age + ') signed for $' + fee.toLocaleString());
    });
  }

  var _foCR2 = window.completeRound;
  window.completeRound = function () {
    var round = App.season ? App.season.round : 0;
    try { foApplyPacketTraining(window.__FO_PKTS); } catch (e) { console.log('packet training failed:', e && e.message); }
    var out = _foCR2.apply(this, arguments);
    try { foApplyPacketYouth(window.__FO_PKTS, round); } catch (e) { console.log('packet youth failed:', e && e.message); }
    return out;
  };

  // Also expose the pinned-build hash slot + a ?resolve= marker for the container.
  window.__FO_RESOLVE_READY = true;
  console.info('Fifty Overs resolve harness ready: window.__resolveMatch available.');
})();
