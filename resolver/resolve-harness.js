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

  // Also expose the pinned-build hash slot + a ?resolve= marker for the container.
  window.__FO_RESOLVE_READY = true;
  console.info('Fifty Overs resolve harness ready: window.__resolveMatch available.');
})();
