/* ===========================================================================
   THE MATCH-DAY COACH — one authority that picks the side, orders it, plans
   the bowling and calls the toss, for every club in the world.

   WHAT WAS WRONG. The engine's fallback pickXI() was five lines of folklore:
   the best-batting keeper, the five bowlers with the highest threat+control,
   the best remaining bats, sorted by mpos. It could not see the pitch, the
   weather, a man's form, his tiredness, his bowling subtype, whether he plays
   pace or spin, his stamina, his hands or his captaincy - while the ball model
   it feeds models every one of those. Form and fatigue were applied by
   withForm() AFTER the eleven had already been chosen, so a shattered star was
   selected as though he were fresh and only then made tired.

   Meanwhile there were FIVE separate opinions about the same question: this
   fallback, foSmartBowling() in the browser overlay (a genuinely good
   conditions-aware planner), probableXI() (a line-for-line copy of pickXI in
   the matchday page), foTodayFit() (a third conditions model with its own
   fatigue table), and the bots, which had none of it. This file is the one
   authority the brief asks for; the others now call it or quote it.

   THE GOVERNING IDEA, AND WHY THERE IS NO SECOND CRICKET ENGINE IN HERE.
   A selector that scores cricketers with invented weights - "+10 on green" -
   is a second, worse simulation, and it drifts from the first the moment
   anybody tunes a ball. So this file does not price conditions at all. It asks
   the REAL ball model:

       ballDist(bat, bowl, phase, faced, intent, rrDef, pitch, field, over, ctx)

   ...what a cricketer is worth TODAY, on this pitch, under this sky, against a
   reference opponent, averaged over a fixed grid of overs. ballDist is a pure
   function of its arguments (it reads no match state), which is what makes
   this possible at all. Every conditional effect the engine has - pitch class,
   subtype tilts, new-ball swing, grip and wear, the death, vsPace/vsSpin,
   temperament, rotation, power, talents, keeping, fielding - arrives for free
   and stays correct when somebody retunes it.

   tools/matchday-probe.mjs is the measurement behind every claim in these
   comments. Run it after any engine change: the tables it prints are what the
   coach is reading.

   WHAT THE MEASUREMENTS SAID (probe, wickets per over vs a median batsman):

     balanced   fast .176  fastMed .138  medium .115  finger .112  wrist .165
     green      pace +.084/+.074/+.045     spin  -.008 .. -.011
     green+overcast  fast .319  fastMed .282  - against wrist spin .155
     dry        spin +.072/+.085/+.085     pace  +.001
     cracked    wrist +.054  finger +.026  fast +.030      (wrist-spin bounce)
     slow       everything +.002..+.013, but runs -0.24..-0.37 - a SLOW pitch
                is an economy pitch, not a spin pitch, and `medium` (+.009)
                gains on fastMedium (+.002): cutters, exactly as the engine's
                subtype tilt says. This is why the coach has no "slow => pick
                spin" rule: it would be false.
     flat       everyone -.03..-.05 wickets, +0.38..+0.50 runs
     dew later  in the CHASE only: finger spin -.025, wrist -.008

   FAIRNESS. The coach may read its own club to the bone. About the OPPOSITION
   it may read only what a human manager is shown on the scout page - the
   coarse bands (batting depth, attack mix, and the "uneasy against turn /
   can be rushed by pace" reads). It is handed those bands already computed;
   it never sees a rival's raw skills. A bot with omniscience is not a bot
   anybody enjoys losing to.

   DETERMINISM. No randomness, no clock, no network. Same inputs, byte-
   identical plan, which is what lets a healed tick and a browser agree.
   =========================================================================== */

// ---------------------------------------------------------------------------
// SELECTION-ONLY COEFFICIENTS. Everything here is a WEIGHT ON MEASURED ENGINE
// OUTPUT - how much a manager cares about a thing the engine already priced -
// never a claim about cricket the engine does not make. Each one names the
// mechanic it trades against.
// ---------------------------------------------------------------------------
var FO_MDC = {
  // the phase grid the coach measures over: eleven points, weighted the way a
  // fifty-over innings actually spends its overs. Identical to the probe's.
  GRID: [[2, 'pp'], [5, 'pp'], [8, 'pp'], [13, 'mid'], [19, 'mid'], [25, 'mid'],
         [31, 'mid'], [37, 'mid'], [43, 'death'], [47, 'death'], [49, 'death']],
  // A WICKET AGAINST A RUN. The engine's own exchange rate, near enough: a
  // fifty-over innings is ten wickets and about 250 runs, so a wicket is worth
  // ~25 runs. Used to collapse the two channels of a bowling measurement into
  // one number so bowlers and batsmen can be compared at all.
  WKT_RUNS: 25,
  // how many overs of the innings a frontline bowler is actually expected to
  // send down (10 is the cap; a five-man attack averages 10, a six-man 8.3)
  BOWL_OVERS: 9,
  // A BATSMAN IS WORTH HIS EXPECTED RUNS BEFORE DISMISSAL, and the cap is only
  // there to stop a freak measurement running away with the side. It was set
  // at 95 in the first cut and that was far too low to discriminate with: the
  // probe measures a MEDIAN batsman at 63.9 runs a dismissal on a flat pitch,
  // so every good player in the squad hit the ceiling and read as one man.
  // The side then could not tell its best batsman from its fifth best, and
  // dropping a fine number five looked free. It clips genuine absurdities now
  // and nothing else.
  RPD_CAP: 220,
  // WHAT A SLOT IS WORTH. Balls faced by position in a 50-over innings,
  // normalised to 1 at the top. A number 3 faces roughly what an opener does;
  // a number 9 faces a tenth of it. This is what stops the optimiser picking
  // eleven batsmen: the eleventh best bat adds almost nothing.
  SLOT_BALLS: [1.00, 0.97, 0.92, 0.84, 0.74, 0.62, 0.48, 0.33, 0.20, 0.11, 0.05],
  // AN INNINGS ENDS WHEN TEN WICKETS FALL, AND THE SUM ABOVE DOES NOT KNOW IT.
  //
  // Batting is scored as each man's expected runs times the balls his slot
  // usually faces - which quietly assumes the slot gets its balls. It does not.
  // A side whose seventh and eighth men cannot bat is bowled out with overs in
  // hand, and the good players at the top never get to use them.
  //
  // Measured, and this is why the term exists: on the golden-master fixture
  // green/seed 7 the first cut of the coach dropped a batsman worth 66 to fit
  // a SEVENTH bowler - who never bowls, because the best five take all fifty
  // overs - and left a tail of 39/25/26/33/10. Both sides did the same thing
  // and the match finished 49 all out against 50 for 4. That is precisely the
  // "ridiculous batting tail merely to satisfy bowling" the design forbids.
  //
  // So a side is charged for every seat inside its top seven that a recognised
  // batsman is not filling. CAPABLE is measured against the side's own best
  // man rather than an absolute, so it means the same thing to a great club
  // and a poor one.
  DEPTH_SEATS: 7,
  DEPTH_CAPABLE: 0.42,
  DEPTH_RUNS: 26,
  // ---- THE EXTRA BOWLING OPTION, AND THE PREMIUM THAT WAS PAID TWICE -------
  //
  // There used to be THREE numbers here: SIXTH_BOWLER 6.0, SEVENTH_BOWLER 1.5
  // and a standalone ALLROUND 4.0 "for genuine all-round flexibility". They
  // were audited by tools/matchday-allrounder.mjs - controlled elevens that
  // differ by exactly one man, scored by this file and then PLAYED, 1,200
  // paired fixtures a case, 21,600 matches. Two things came back.
  //
  // 1. ALLROUND WAS SIXTH_BOWLER UNDER ANOTHER NAME. It paid 4.0 per frontline
  //    bowler ranked inside the side's top SEVEN BATSMEN - by rank, not by
  //    ability - and every eleven has seven men in its top seven. Measured on
  //    a side with no all-rounder in it at all, the seventh-best bat was a
  //    specialist quick of 20 runs a dismissal, and he collected the premium:
  //        top seven: T0(75) T1(72) T2(68) T3(65) X(53) Keeper(48) B0(20,FRONTLINE)
  //    So it fired on almost every side, and what actually moved it was how
  //    many frontline bowlers were in the eleven - which is what SIXTH_BOWLER
  //    already says. A side with six bowlers collected 8.0 where a side with
  //    five collected 4.0: a second sixth-bowler bonus, spelled differently.
  //    It is deleted. Case F is the proof that nothing is lost - an
  //    all-rounder who genuinely bowls his ten shows up in the MEASURED bat
  //    and bowl terms, which predicted +32.4 and delivered a 63.1% win rate.
  //
  // 2. THE PREMIUM WAS BLIND TO WHETHER HE CAN BOWL. A sixth option with a
  //    bowling skill of 30 and one with 62 scored IDENTICALLY (216.2 against
  //    216.2), because with six frontline bowlers the best five take all fifty
  //    overs and the sixth man's cost never enters the sum. Played, the two
  //    are not identical at all: the useful one wins 52.67% of the time
  //    (z=3.24). And the flat +10 the useless one collected bought nothing -
  //    he wins 49.04%, if anything slightly worse than a specialist batsman.
  //
  // So the premium survives, at a size the cricket actually paid, and it is
  // now WEIGHTED by how real an option he is: measured against the marginal
  // man of the attack - the fifth-cheapest, the last one who actually bowls -
  // and falling to nothing when his overs are OPTION_SPAN runs dearer.
  //
  // RE-MEASURED FOR PHASE 2A (tools/coach-followup-probe.mjs §1). Off-spell
  // recovery changed what the option is FOR: a healthy five-man attack can
  // now manage its own legs, so a marginal-quality sixth saves only ~1.6
  // runs there - while a workload-stressed frontline still buys real relief
  // (one weary man +6.9, three weary +5.9, and the win column moves with
  // it). The old flat 4.8 was the average of two different situations, so
  // the premium is now QUALITY x NEED: a base for the flexibility itself
  // plus a slope on the summed starting load of the five men who will
  // actually bowl. Fitted by least squares through the six measured
  // frontline states at marginal quality (loadSum 0 -> 1.30 maps to 1.6 ->
  // 5.9 runs saved); optionWeight then scales it by whether the man is a
  // real option at all, exactly as before. No thresholds anywhere: a side
  // one point more tired pays one sliver more insurance.
  //
  // (A STRONG sixth - better than the marginal frontliner - measured 10-21
  // runs, but he takes his ~10 overs on merit and the fifty-over cost
  // allocation above already prices that; the insurance term is only for
  // the option who does NOT get planned overs.)
  S6_BASE: 2.0,
  S6_NEED: 4.0,
  // a seventh is worth a token amount and no more, re-measured on the new
  // engine (probe §2): 0.0 runs with a healthy attack, +4.9 (within +/-2.2)
  // with two weary quicks - and in the stressed case the SIXTH term above is
  // already paying for the same need. Six and seven are deliberately not
  // symmetric formulas; the token stays a token.
  SEVENTH_BOWLER: 1.5,
  // how much dearer than the attack's marginal man an extra option's overs can
  // be before he stops being an option at all
  OPTION_SPAN: 3.0,
  // CAPTAINCY, RE-PRICED FOR THE JUDGEMENT MODEL. The engine's law is no
  // longer the slip: every candidate's score reaches the captain through
  // deterministic reading noise that shrinks continuously with captaincy
  // and never reaches zero, the continuation read carries a
  // confirmation-bias anchor (poor captains persist too long), the field
  // intent is a per-over decision he can fluff, and the organisation
  // sliver rides the fieldAvg pathway. Two consequences for the price:
  // value continues ABOVE 88 (the old law gave literally nothing there),
  // and uniform attacks are no longer worth ~zero, because organisation
  // and the field are attack-independent.
  //
  // Re-measured on that engine (tools/coach-followup-probe.mjs §5, capt
  // 40/64/88 across attack shapes): pace-heavy 0.105 runs a point,
  // spin-heavy 0.101, one tired quick 0.053, balanced 0.037, six options
  // 0.028. Same pricing philosophy as Phase 2A.1: real squads are the
  // heterogeneous kind, so the price follows that cluster - 0.09, a shade
  // under the old 0.10 (the tired-quick cell halved: the anchor means a
  // weak captain now mishandles the weary man rather than the slip
  // randomly rescuing him, and part of that cost was already priced in
  // fatigue).
  //
  // The ceiling moves 88 -> 95: the batteries put 88v95 at ~0.05 runs a
  // point (0.26±0.53 uniform, 0.45±0.50 het over seven points), so a flat
  // 0.09 overpays that last stretch by at most ~0.3 runs - immaterial
  // beside the invariant the shirt test holds, which is unchanged: the
  // whole 40->95 armband premium is ~5 runs, enough to break a genuine
  // tie, nowhere near enough to buy a materially worse cricketer a place.
  CAPT_RUNS: 0.09,
  CAPT_CEIL: 95,
  // the fielding contest is a whole-side term (foFieldLevel); one man's hands
  // move it a little, and the engine already reads catching/fielding through
  // ctx.fieldAvg. This weights the side's mean fielding into the total.
  //
  // RE-PRICED FOR THE 2B FIELDING SLOPES, and the old 0.30 was wrong twice
  // over. This term multiplies the XI's MEAN fielding, so its honest value
  // is the engine's team slope per mean-point - which even on the shipped
  // engine was ~1.6 runs (the 40->80 band was 65.6 over 40 points), so 0.30
  // undercharged the field three to five times and the coach sat a
  // measurably better fielding side on the bench whenever three batting
  // points said otherwise. Under the frozen 2B slopes the team band is
  // 38.9 runs over 40 mean-points: 0.97 a point. Validated on controlled
  // seat contests (docs/fielding-realism/coach-crossover.txt): at 0.95 the
  // coach takes bat 62/field 90 over bat 65/field 30 - the one crossover
  // the cricket itself resolves (4.3±1.9 runs) - and still takes the bat
  // when the measured contest is a tie.
  FIELD_RUNS: 0.95,
  // WHAT THE GLOVES ARE WORTH. Measured (probe section 7): moving the keeper
  // from the world median 74 to 95 buys +0.030 wickets/over against spin on a
  // dry pitch and +0.038 against pace on a green one; dropping to 40 costs
  // -0.037/-0.047. Over a fifty-over innings that is about 1.5-2.3 wickets,
  // i.e. 40-60 runs across the range - which is the same order as a whole
  // grade of batting. The coach therefore prices keeping IN RUNS off the
  // measured slope rather than handing "wicketkeeper" a flat bonus.
  KEEP_SLOPE: 1.55,
  // and the floor below which a man is not a wicketkeeper at all, whatever
  // his batting: byes, missed stumpings and dropped edges stop being a
  // tradeoff and start being a different sport
  KEEP_FLOOR: 30,
  // OPPOSITION. Secondary to conditions and quality by construction: the
  // scout's bands are coarse, so they may tilt a close call and never
  // overturn a real gap.
  OPP_TILT: 0.35,
  // DOCTRINE. A club's identity is a style prior at the margin and nothing
  // more - it may break a tie between comparable cricketers, never buy a
  // materially worse one a place. Bounded to a fraction of a batting grade.
  DOCTRINE_TILT: 2.5
};

// the reference opponents every measurement is taken against. Built once per
// plan from the club's own squad so the yardstick is the standard of cricket
// this match is actually played at, not an absolute that drifts as the world
// gets better or worse.
function foMdcRefs(squad) {
  var men = (squad || []).filter(function (p) { return p && p.name; });
  if (!men.length) return null;
  var by = function (k) {
    return men.slice().sort(function (a, b) { return (b[k] || 0) - (a[k] || 0); });
  };
  // a median batsman and a median bowler of each class, taken from the squad
  var bats = by('bat'), bowlers = men.filter(function (p) { return p.bowlType; });
  var mid = function (arr) { return arr.length ? arr[Math.floor(arr.length / 2)] : null; };
  var pace = bowlers.filter(function (p) { return typeClass(p.bowlType) === 'pace'; });
  var spin = bowlers.filter(function (p) { return typeClass(p.bowlType) === 'spin'; });
  var refBat = mid(bats) || men[0];
  var refPace = mid(pace) || mid(bowlers) || men[0];
  var refSpin = mid(spin) || mid(bowlers) || men[0];
  // the references are stripped of form and fatigue: a yardstick that is
  // itself having a bad week measures nothing
  var strip = function (p) {
    if (!p) return null;
    var q = JSON.parse(JSON.stringify(p));
    q._batAdj = 0; q.formIx = 3; q.formWord = 'steady';
    q.fatigue = 'rested'; q.fatWord = 'rested'; q.fatN = 0;
    return q;
  };
  return { bat: strip(refBat), pace: strip(refPace), spin: strip(refSpin) };
}

// ---------------------------------------------------------------------------
// TODAY'S MAN. The engine plays a cricketer through withForm(), which folds
// his form and his tiredness onto a copy before a ball is bowled. The coach
// must select the man the engine will actually play - so it applies the SAME
// transformation, with one deliberate omission: withForm's per-match random
// swing (CAL.form_amp, seeded on the man and the match) is left out.
//
// That omission is the whole fairness rule for one's OWN side. The swing is
// deterministic, so the coach could read it and know before the toss which of
// its men would have a good day. It is hidden from the manager, so it is
// hidden from the coach: selection sees the form on the card and the fatigue
// on the card, and nothing that has not happened yet.
// ---------------------------------------------------------------------------
function foMdcToday(p) {
  var q = JSON.parse(JSON.stringify(p));
  var formShift = foFormShift(p);            // the VISIBLE run, off the card
  var fatPen = foFatiguePenalty(p);          // the engine's own fatigue law
  // withForm's channels, exactly: batting reaches ballDist only through
  // _batAdj (it never reads p.bat), bowling through threat and control
  q._batAdj = formShift - fatPen;
  q.bat = (p.bat || 50) + q._batAdj;
  var bowlAdj = formShift * 0.72 - fatPen * 0.92;
  if (p.threat) q.threat = p.threat + bowlAdj;
  if (p.control) q.control = p.control + bowlAdj * 0.58;
  q.field = (p.field || 50) - fatPen * 0.34;
  q._fatLoad = foFatigueLoad(p);
  q._fatPen = fatPen;
  q._formShift = formShift;
  return q;
}

// one measurement: what this bowler does to that batsman, here, today.
// Returns wickets and runs per over, averaged over the phase grid.
function foMdcMeasureBowl(bowl, refBat, ctxBase, pitch) {
  var W = 0, R = 0, n = FO_MDC.GRID.length;
  for (var i = 0; i < n; i++) {
    var over = FO_MDC.GRID[i][0], ph = FO_MDC.GRID[i][1];
    var d = ballDist(refBat, bowl, ph, 25, 0, 0, pitch, 'bal', over, ctxBase);
    W += (d.wC || 0) + (d.wB || 0) + (d.wLBW || 0) + (d.wRO || 0) + (d.wST || 0);
    R += (d['1'] || 0) + 2 * (d['2'] || 0) + 3 * (d['3'] || 0) + 4 * (d['4'] || 0) + 6 * (d['6'] || 0)
       + (d.wide || 0) + (d.noball || 0) + (d.bye || 0) + (d.legbye || 0);
  }
  return { w: 6 * W / n, r: 6 * R / n };
}

// and the other way round: what this batsman does to a reference attack.
// Runs per dismissal is the only batting number that honours both halves -
// a man who scores fast and is out every over is not a batsman.
function foMdcMeasureBat(bat, refs, ctxBase, pitch, mix) {
  var pw = mix == null ? 0.62 : mix;         // share of the innings bowled by pace
  var out = { w: 0, r: 0 };
  var one = function (bowl, share) {
    if (!bowl || share <= 0) return;
    var m = foMdcMeasureBowl(bowl, bat, ctxBase, pitch);
    out.w += m.w * share; out.r += m.r * share;
  };
  one(refs.pace, pw); one(refs.spin, 1 - pw);
  var rpd = out.r / Math.max(1e-6, out.w);
  return { rpd: Math.min(FO_MDC.RPD_CAP, rpd), rpo: out.r };
}

// the ball model's context for a pre-match read: an ordinary passage of play,
// with the side's own keeper and fielding standing behind it
function foMdcCtx(weather, keeperQ, fieldAvg, chase) {
  return {
    weather: String(weather || 'sunny').toLowerCase(),
    pship: 20, chase: !!chase, bballs: 12, ballsThisSpell: 6,
    wkts: 3, since: 40, std: 0,
    fieldAvg: fieldAvg == null ? 50 : fieldAvg,
    keeperQuality: keeperQ == null ? FO_KQ_PAR : keeperQ,
    keeperStump: 50, keeperCatch: 50,
    rocketArms: 0, lightningKeeper: false, mixed: false,
    batFat: 0, bowlFat: 0, captBowl: 50, captBat: 50
  };
}

// is this man a real bowling option, or a part-timer the captain would rather
// not use? The engine's own isPT is the authority where it exists.
function foMdcIsFront(p) {
  if (!p || !p.bowlType) return false;
  try { if (typeof isPT === 'function' && isPT(p)) return false; } catch (e) {}
  var t = String(p.bowlTypeFull || p.bowlType || '');
  return !/^(none|partTime)/.test(t);
}
function foMdcCanBowl(p) { return !!(p && p.bowlType && String(p.bowlType) !== 'none'); }
function foMdcIsKeeper(p) { return !!(p && (p.keeper || p.role === 'wicketkeeper')); }

/* ---------------------------------------------------------------------------
   THE PLAYER CARD. Everything the optimiser needs about one cricketer, priced
   in RUNS so that a wicket, a run, a catch and a stumping can be added up.
   Computed once per man per plan; the search below then only adds numbers.
   --------------------------------------------------------------------------- */
function foMdcCard(p, refs, ctx, pitch, paceMix) {
  const today = foMdcToday(p);
  const card = { p: p, today: today, name: p.name };
  // BATTING: expected runs before dismissal, against an attack shaped like
  // today's likely one. The slot weighting is applied later, by the order.
  const b = foMdcMeasureBat(today, refs, ctx, pitch, paceMix);
  card.rpd = b.rpd;
  card.rpo = b.rpo;
  // BOWLING: the two channels, collapsed at the engine's own exchange rate.
  // A bowler's worth is what he saves against what a REPLACEMENT would
  // concede, so it is stated as runs prevented per over and multiplied by the
  // overs he can expect to send down.
  if (foMdcCanBowl(p)) {
    // WHAT A TIRED BOWLER IS, MEASURED RATHER THAN GUESSED. A tired man is hit
    // twice by the engine: foFatiguePenalty takes points off his threat and
    // control before a ball (applied in foMdcToday above), and then ctx.bowlFat
    // - the load he carries into the match - reads again on every delivery he
    // sends down. A batsman only ever pays the first. That asymmetry IS the
    // workload sensitivity the brief asks for, and measuring through the
    // engine's own bowlFat channel means the coach does not have to invent a
    // coefficient for it. (The first cut did invent one, priced a tired quick
    // at 26 runs, and benched a bowler who was still the best in the club.)
    const bowlCtx = {};
    for (const k in ctx) bowlCtx[k] = ctx[k];
    bowlCtx.bowlFat = today._fatLoad || 0;
    const m = foMdcMeasureBowl(today, refs.bat, bowlCtx, pitch);
    card.bowlW = m.w; card.bowlR = m.r;
    // WHAT AN OVER FROM HIM COSTS THE SIDE: the runs he concedes, less the
    // wickets he takes at the engine's own exchange rate. Lower is better,
    // and it is an ABSOLUTE cost rather than a value above replacement
    // deliberately - every eleven has to bowl the same fifty overs, so the
    // honest comparison between two sides is what those fifty overs cost
    // each of them. (An earlier cut scored a bowler at w x 25 - r, which is
    // NEGATIVE for every bowler alive - a median man measures 0.138 wickets
    // and 6.0 runs an over, so 3.45 - 6.02 = -2.6 - and an optimiser handed
    // that will pick as FEW bowlers as the law allows and hand twenty overs
    // to part-timers. The cost formulation cannot have that failure mode:
    // the part-timer's overs are simply dearer.)
    card.bowlCost = m.r - m.w * FO_MDC.WKT_RUNS;
    // kept for the explanation, where "higher is better" reads more naturally
    card.bowlValue = -card.bowlCost;
    card.front = foMdcIsFront(p);
    card.cls = typeClass(p.bowlType);
    // the load is reported for the explanation only; its COST is already
    // inside bowlCost, measured through the engine rather than added on top
    card.load = today._fatLoad || 0;
  } else {
    // a man who cannot bowl at all is not an option: his "cost" is what the
    // side would pay for asking him, which is why he is never asked
    card.bowlCost = Infinity; card.bowlValue = -Infinity;
    card.bowlW = 0; card.bowlR = 0; card.front = false; card.cls = null;
    card.load = 0;
  }
  // KEEPING, MEASURED IN TODAY'S CONDITIONS RATHER THAN AT A FIXED RATE.
  //
  // The keeper reaches the ball model through ctx.keeperQuality, keeperCatch
  // and keeperStump, so what his gloves are worth can be asked of the engine
  // exactly like everything else: bowl the side's own attack at a reference
  // batsman with HIS hands behind the stumps, then again with the world's
  // median gloveman (FO_KQ_PAR), and take the difference over the fifty overs
  // he will keep for.
  //
  // The first cut used one constant slope taken off the probe - but the probe
  // measured a turning dry pitch and a green top, which are precisely where a
  // keeper is worth most. Applied flat, it paid a specialist gloveman the
  // same on a road as on a raging turner, and that is not what the engine
  // does. Measuring it here means the tradeoff against a batsman moves with
  // the surface, which is the whole point of a match-day coach.
  card.keepQ = foMdcIsKeeper(p) ? foKeeperQuality(p) : 0;
  card.canKeep = foMdcIsKeeper(p) && card.keepQ >= FO_MDC.KEEP_FLOOR;
  card.keepValue = 0;
  if (foMdcIsKeeper(p)) {
    const kctx = {}, parCtx = {};
    for (const k in ctx) { kctx[k] = ctx[k]; parCtx[k] = ctx[k]; }
    kctx.keeperQuality = card.keepQ;
    kctx.keeperCatch = foSkE(p, 'catching') || 50;
    kctx.keeperStump = foSkE(p, 'stumping') || 50;
    kctx.lightningKeeper = foMdcHasTal(p, 'lightningHands');
    parCtx.keeperQuality = FO_KQ_PAR; parCtx.keeperCatch = 50; parCtx.keeperStump = 50;
    const blend = function (c2) {
      const a = foMdcMeasureBowl(refs.pace, refs.bat, c2, pitch);
      const b = foMdcMeasureBowl(refs.spin, refs.bat, c2, pitch);
      const pw = paceMix == null ? 0.62 : paceMix;
      return { w: a.w * pw + b.w * (1 - pw), r: a.r * pw + b.r * (1 - pw) };
    };
    const mine = blend(kctx), par = blend(parCtx);
    // fifty overs of his hands, in runs
    card.keepValue = ((mine.w - par.w) * FO_MDC.WKT_RUNS - (mine.r - par.r)) * 50;
  }
  // FIELDING and CAPTAINCY, both whole-side terms, kept as raw numbers here
  card.field = (today.field == null ? 50 : today.field);
  card.capt = (p.capt == null ? 50 : p.capt);
  return card;
}

/* ---------------------------------------------------------------------------
   WHAT AN ELEVEN IS WORTH. Compositional, because that is the whole difficulty
   of selection: the second spinner is worth less than the first, the keeper's
   gloves only count once, and an all-rounder's value depends on who else is
   in. Scoring men independently and taking the top eleven is exactly the
   mistake the old fallback made.
   --------------------------------------------------------------------------- */
// THE HARD LAWS. A side that breaks one of these is not a side, and no amount
// of cricket value anywhere else buys it a place: exactly eleven, a genuine
// wicketkeeper, and five men who can legitimately bowl. They are checked
// before an eleven is scored at all, so the optimiser cannot trade its way
// out of them - and foMdcLegal is what the tests assert against.
function foMdcLegal(cards) {
  if (!cards || cards.length !== 11) return false;
  let keeper = 0, bowl = 0;
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].canKeep) keeper++;
    if (foMdcCanBowl(cards[i].p)) bowl++;
  }
  return keeper >= 1 && bowl >= 5;
}

function foMdcScoreXI(cards, doctrine) {
  // 1. BATTING, by the order the side would actually bat in. The men are
  // sorted by what they are worth with the bat and paid by the balls that
  // slot faces - so the ninth-best batsman in the side is worth a twentieth
  // of the best, which is what stops eleven batsmen being the answer.
  const byBat = cards.slice().sort(function (a, b) {
    return b.rpd - a.rpd || (a.name < b.name ? -1 : 1);
  });
  let bat = 0;
  for (let i = 0; i < byBat.length; i++) bat += byBat[i].rpd * (FO_MDC.SLOT_BALLS[i] || 0.03);
  // ...and the depth charge: how many of the top seven seats are held by a man
  // who can actually bat (see DEPTH_* above)
  const bestRpd = byBat.length ? byBat[0].rpd : 0;
  let capable = 0;
  for (let i = 0; i < byBat.length && i < FO_MDC.DEPTH_SEATS; i++) {
    if (byBat[i].rpd >= bestRpd * FO_MDC.DEPTH_CAPABLE) capable++;
  }
  // ...AND THE CHARGE IS CONVEX, WHICH IT WAS NOT, AND THAT WAS THE LAST
  // SYSTEMATIC BIAS IN THIS FILE.
  //
  // It used to be linear: 26 runs for every unfilled seat. Measured
  // (tools/matchday-exchange.mjs), that is far too steep for the FIRST seat.
  // Sweeping a lower-order man's batting and watching the coach's own score
  // against the win rate he actually delivers:
  //
  //     below the threshold (skill 20 -> 44)   4.2 model points buy 1.48
  //                                            win-points - a slope of 0.352
  //     TOP-ORDER batsman, same measurement    a slope of 0.347
  //     crossing the threshold (44 -> 56)     34.3 model points buy 3.16
  //                                            win-points - a slope of 0.092
  //
  // So SLOT_BALLS is right - a lower-order run and a top-order run are priced
  // on one scale, within a hundredth. What is wrong is the cliff: releasing ONE
  // seat is worth about a quarter of what the linear charge paid for it. And
  // the men who release a seat are precisely the all-rounders, which is why the
  // controlled contests kept over-scoring sides that stacked them.
  //
  // AND IT IS STILL LINEAR, WHICH IS A MEASURED DECISION AND NOT AN OVERSIGHT.
  //
  // A quadratic charge was written, built and played, precisely because of the
  // measurement above: gap x gap / 4 leaves the four-seat catastrophe priced
  // where it was (104) and makes one seat cheap (6.5 instead of 26). On the
  // controlled contests it did what it was meant to - the C, G and H residuals
  // fell hard - and it was still WRONG, for two reasons that only showed up
  // when it was tested properly.
  //
  // First, it cannot be the explanation. Cases F, G and H all move the same
  // single seat (gap 1 -> 0) and the cricket pays them +13.1, +3.9 and +2.2
  // win-points. One term with one value per seat moves all three together, so
  // no setting of it can separate them: making C/G/H fit broke F by 25 points
  // and the mean absolute error over the controlled set ROSE, 5.87 to 6.51.
  //
  // Second, and decisively, it introduced the very bias this pass exists to
  // remove. On 30 generated squads across five conditions - 197 near-miss
  // comparisons, tools/matchday-regret.mjs - the quadratic charge made the
  // coach keep all-rounders it should not have kept, because the depth charge
  // is what protects specialist batting:
  //
  //     keeping an all-rounder over a...     LINEAR          QUADRATIC
  //       specialist batsman                 +5.76 (72.7%)   +2.77 (60.0%)
  //       specialist bowler                  +6.84 (75.9%)   +9.16 (85.7%)
  //       difference                          1.08 +/- 1.76   6.39 +/- 1.43
  //                                           z = 0.6 (none)  z = 4.5 (real)
  //
  // Overall accuracy rose slightly (76.2% -> 78.7%) and the ROLE SYMMETRY,
  // which is the thing that matters, got significantly worse. The linear charge
  // stays.
  bat -= Math.max(0, FO_MDC.DEPTH_SEATS - capable) * FO_MDC.DEPTH_RUNS;

  // 2. BOWLING. Fifty overs have to be bowled, whoever is in the side, so an
  // attack is worth what those fifty overs COST: the cheapest options bowl
  // first, ten apiece at most (the engine's own cap, and the reason five
  // bowlers is the minimum), and whatever is left over goes to the next man
  // however dear he is. A side with three frontline bowlers pays part-timer
  // prices for twenty overs, and that is exactly the loss it should show.
  const bowlers = cards.filter(function (c) { return foMdcCanBowl(c.p); })
    .sort(function (a, b) { return a.bowlCost - b.bowlCost || (a.name < b.name ? -1 : 1); });
  const front = bowlers.filter(function (c) { return c.front; });
  let cost = 0, left = 50;
  for (let i = 0; i < bowlers.length && left > 0; i++) {
    const ov = Math.min(10, left);
    // THE DRAIN IS ALREADY IN THE PRICE, and nothing is added on top here. A
    // tired bowler's cost was measured with his own load on the ball model's
    // bowlFat channel (foMdcCard), so it is dearer per over than a fresh
    // man's, and multiplying by the overs he sends down is what makes the
    // charge workload-sensitive: ten overs from a shattered quick cost ten
    // times his inflated rate. An earlier cut ALSO added a hand-written
    // `load x overs x 0.5` here, which double-charged the same tiredness at a
    // coefficient nobody had measured and benched a club's best bowler.
    cost += bowlers[i].bowlCost * ov;
    left -= ov;
  }
  // a side that cannot physically bowl fifty overs is barely a side
  if (left > 0) cost += left * 12;
  // the attack is a cost, so it enters the total negatively
  let bowl = -cost;
  // FLEXIBILITY: somewhere for the captain to turn on a day when a plan is not
  // working - but only if the man he turns to can bowl. See SIXTH_BOWLER above
  // for the measurement; the short version is that the extra option's overs
  // are never bought by the fifty-over allocation (the best five take them
  // all), so his quality has to enter here or it never enters at all.
  //
  // The yardstick is the MARGINAL man of the attack: the fifth-cheapest front
  // option, the last one who actually gets overs. An extra bowler as good as
  // him is a full option; one whose overs are OPTION_SPAN runs dearer is not
  // an option at all, whatever his card says.
  const marginal = front.length >= 5 ? front[4].bowlCost
                 : (front.length ? front[front.length - 1].bowlCost : 0);
  const optionWeight = function (c) {
    if (!c || !isFinite(c.bowlCost)) return 0;
    return Math.max(0, Math.min(1, 1 - (c.bowlCost - marginal) / FO_MDC.OPTION_SPAN));
  };
  // QUALITY x NEED (see S6_BASE/S6_NEED above): the need is the summed
  // starting tank of the five men whose fifty overs the allocation just
  // priced - the engine's own foFatigueLoad, already on every card as
  // c.load. A fresh attack pays the base for flexibility alone; a leggy one
  // pays more, because the sixth man's overs are the rest the frontline can
  // now actually bank (off-spell recovery, Phase 2A).
  let needLoad = 0;
  for (let i = 0; i < Math.min(5, bowlers.length); i++) needLoad += bowlers[i].load || 0;
  if (front.length >= 6) bowl += (FO_MDC.S6_BASE + FO_MDC.S6_NEED * needLoad) * optionWeight(front[5]);
  if (front.length >= 7) bowl += FO_MDC.SEVENTH_BOWLER * optionWeight(front[6]);

  // 3. THE GLOVES. Exactly one man keeps; the side is worth his hands.
  const keepers = cards.filter(function (c) { return c.canKeep; })
    .sort(function (a, b) { return b.keepQ - a.keepQ || (a.name < b.name ? -1 : 1); });
  const keeper = keepers[0] || null;
  const keep = keeper ? keeper.keepValue : -1e6;   // no keeper: not a legal side

  // 4. THE HANDS. One whole-side number, the way foFieldLevel reads it.
  let fld = 0;
  for (let i = 0; i < cards.length; i++) fld += cards[i].field;
  fld = (fld / Math.max(1, cards.length) - 50) * FO_MDC.FIELD_RUNS;

  // 5. THE CAPTAIN. aiPickBowler's judgement noise, the continuation anchor,
  // the field decision and the organisation sliver are the mechanics; the
  // coach prices the best captain available in this eleven against an
  // ordinary one.
  let capt = 0;
  for (let i = 0; i < cards.length; i++) capt = Math.max(capt, cards[i].capt);
  capt = (Math.min(FO_MDC.CAPT_CEIL, capt) - 50) * FO_MDC.CAPT_RUNS;

  // 6. THERE IS NO ALL-ROUNDER PREMIUM, and that is a measured decision - see
  // SIXTH_BOWLER at the head of this file. The term that stood here paid 4.0
  // per frontline bowler inside the top seven BY BATTING RANK, which every
  // eleven has seven of, so it fired on a genuine number eleven in a thin side
  // and what actually moved it was the number of bowlers in the eleven: the
  // sixth-bowler premium again, under a second name. An all-rounder is worth
  // his batting and his bowling, both of which are measured above, plus the
  // option he gives the captain, which is priced once in the bowling term.
  const allr = 0;

  // 7. DOCTRINE, at the margin and nowhere else.
  let doc = 0;
  if (doctrine && doctrine.select) {
    for (let i = 0; i < cards.length; i++) doc += foMdcDoctrineTilt(cards[i], doctrine);
  }

  return { total: bat + bowl + keep + fld + capt + allr + doc,
           bat: bat, bowl: bowl, keep: keep, field: fld, capt: capt,
           allround: allr, doctrine: doc, keeper: keeper, attack: bowlers, front: front };
}

// A CLUB'S IDENTITY, AS A STYLE PRIOR. The world's four archetypes
// (27-living-planet.js ARCH_DOCTRINE) say how a club likes to BAT; this is the
// same identity expressed as a nudge in selection. Bounded to
// DOCTRINE_TILT, which is a fraction of one batting grade: enough to break a
// tie between two comparable cricketers, never enough to pick a worse side.
function foMdcDoctrineTilt(card, doctrine) {
  const s = doctrine && doctrine.select;
  if (!s) return 0;
  let v = 0;
  const T = FO_MDC.DOCTRINE_TILT;
  if (s.pace && card.cls === 'pace' && card.front) v += T;
  if (s.spin && card.cls === 'spin' && card.front) v += T;
  if (s.batting && !card.front && card.rpd > 0) v += T * 0.6;
  if (s.power) {
    const pw = foSkE(card.p, 'power') || 50;
    v += T * 0.5 * Math.max(-1, Math.min(1, (pw - 55) / 25));
  }
  return v;
}

/* ---------------------------------------------------------------------------
   THE SEARCH. C(15,11) is 1365 elevens and each is a sum over eleven cards, so
   the exact search is a few hundred thousand additions - well under a
   millisecond, and it is the same answer every time by construction. It is
   used whenever the arithmetic is affordable.

   Above that (a squad that has grown, an international pool) the exhaustive
   walk is replaced by a deterministic bounded search: the squad is trimmed to
   the strongest candidates in each role first - keepers, frontline bowlers and
   batsmen ranked on their own cards - and the exact search then runs over that
   pool. foMdcSearchIsExact() reports which was used, and the test suite proves
   the two agree on ordinary squads.
   --------------------------------------------------------------------------- */
var FO_MDC_EXACT_MAX = 24;      // C(24,11) is 2.5m - still cheap; beyond it, prune

function foMdcChooseXI(cards, doctrine) {
  const n = cards.length;
  if (n <= 11) return { xi: cards.slice(), exact: true, legal: foMdcLegal(cards),
                        score: foMdcScoreXI(cards, doctrine) };
  let pool = cards, pruned = false;
  if (n > FO_MDC_EXACT_MAX) {
    pool = foMdcPrune(cards);
    pruned = true;
  }
  const best = foMdcExactSearch(pool, doctrine);
  best.exact = !pruned;
  return best;
}

// the exhaustive walk, in a fixed order so ties break identically forever
function foMdcExactSearch(cards, doctrine) {
  const n = cards.length;
  const idx = [];
  for (let i = 0; i < 11; i++) idx.push(i);
  let bestScore = null, bestSet = null;
  // and a fallback for a squad so broken that NO eleven is legal - the best
  // illegal side is still the answer the umpire needs, and a weak club must
  // never be handed nothing
  let bestAny = null, bestAnySet = null;
  for (;;) {
    const pick = [];
    for (let i = 0; i < 11; i++) pick.push(cards[idx[i]]);
    const sc = foMdcScoreXI(pick, doctrine);
    if (bestAny === null || sc.total > bestAny.total + 1e-9) { bestAny = sc; bestAnySet = idx.slice(); }
    if (foMdcLegal(pick) && (bestScore === null || sc.total > bestScore.total + 1e-9)) {
      bestScore = sc; bestSet = idx.slice();
    }
    // advance the combination
    let i2 = 10;
    while (i2 >= 0 && idx[i2] === n - 11 + i2) i2--;
    if (i2 < 0) break;
    idx[i2]++;
    for (let j = i2 + 1; j < 11; j++) idx[j] = idx[j - 1] + 1;
  }
  const set = bestSet || bestAnySet;
  const xi = set.map(function (i) { return cards[i]; });
  return { xi: xi, score: bestSet ? bestScore : bestAny, legal: !!bestSet };
}

// DETERMINISTIC PRUNING for an unusually large pool: keep everyone who could
// plausibly earn a place - the best keepers, the best frontline bowlers, the
// best bats - and let the exact search decide among them.
function foMdcPrune(cards) {
  const keep = {}, out = [];
  const take = function (arr, n) {
    for (let i = 0; i < arr.length && i < n; i++) {
      if (!keep[arr[i].name]) { keep[arr[i].name] = 1; out.push(arr[i]); }
    }
  };
  const byName = function (a, b) { return a.name < b.name ? -1 : 1; };
  take(cards.slice().sort(function (a, b) { return b.keepQ - a.keepQ || byName(a, b); }), 3);
  take(cards.slice().filter(function (c) { return c.front; })
    .sort(function (a, b) { return b.bowlValue - a.bowlValue || byName(a, b); }), 9);
  take(cards.slice().sort(function (a, b) { return b.rpd - a.rpd || byName(a, b); }), 11);
  take(cards.slice().sort(function (a, b) {
    return (b.bowlValue + b.rpd * 0.2) - (a.bowlValue + a.rpd * 0.2) || byName(a, b);
  }), 4);
  // a stable order, so the search enumerates identically every time
  return out.sort(byName);
}

/* ---------------------------------------------------------------------------
   THE BATTING ORDER. Membership is settled; this decides who faces the new
   ball and who finishes. Each slot has a JOB, and the job is scored off the
   same measured cards plus the skills the engine reads for that job - never a
   role label, because a label must not beat a large ability gap.
   --------------------------------------------------------------------------- */
function foMdcBattingOrder(xi, ctx, pitch, refs, doctrine) {
  const newBallHostile = foMdcNewBallBite(pitch, ctx.weather);
  const turns = (pitch === 'dry' || pitch === 'cracked' || pitch === 'slow');
  const left = xi.slice();
  const order = [];
  const takeBest = function (fn) {
    let bi = 0;
    for (let i = 1; i < left.length; i++) {
      const d = fn(left[i]) - fn(left[bi]);
      if (d > 1e-9 || (Math.abs(d) <= 1e-9 && left[i].name < left[bi].name)) bi = i;
    }
    return left.splice(bi, 1)[0];
  };
  const sk = function (c, k) { return foSkE(c.p, k) || 50; };
  // OPENERS: survive the new ball and score off it. vsPace and temperament are
  // the two the engine reads hardest early; the coach weights them up when the
  // new ball genuinely bites (measured: green+overcast nearly doubles a
  // seamer's wicket rate, and a +15 vsPace lean is worth +4.4 runs a dismissal
  // there against +9.8 on a flat day).
  const openScore = function (c) {
    return c.rpd * 0.55
      + (sk(c, 'vsPace') - 50) * (newBallHostile ? 0.55 : 0.32)
      + (sk(c, 'temperament') - 50) * 0.30
      + (sk(c, 'rotation') - 50) * 0.14
      + (foMdcHasTal(c.p, 'fastStarter') ? 6 : 0)
      + (foMdcHasTal(c.p, 'anchor') ? 3 : 0)
      // a frontline quick opening the batting is a tired quick at the top of
      // his mark: the engine drains him and the captain needs him
      - (c.front && c.cls === 'pace' ? 7 : 0);
  };
  order.push(takeBest(openScore), takeBest(openScore));
  // THREE: the best all-conditions batsman left, because he may arrive in the
  // first over or the thirtieth.
  const threeScore = function (c) {
    return c.rpd * 0.80 + (sk(c, 'temperament') - 50) * 0.26
      + (sk(c, 'vsPace') + sk(c, 'vsSpin') - 100) * 0.10
      - (c.front && c.cls === 'pace' ? 5 : 0);
  };
  order.push(takeBest(threeScore));
  // FOUR and FIVE: the run creators, weighted to whichever bowling the
  // conditions say they will mostly face.
  const midScore = function (c) {
    return c.rpd * 0.78
      + (sk(c, turns ? 'vsSpin' : 'vsPace') - 50) * 0.30
      + (sk(c, 'rotation') - 50) * 0.18
      + (foMdcHasTal(c.p, turns ? 'spinKiller' : 'paceHunter') ? 5 : 0);
  };
  order.push(takeBest(midScore), takeBest(midScore));
  // SIX and SEVEN: finishing. Power and the death talents, which the engine
  // pays only in overs 41-50 (finisher +0.145 fours/+0.185 sixes, measured).
  const finScore = function (c) {
    return c.rpd * 0.45
      + (sk(c, 'power') - 50) * 0.42
      + (sk(c, 'rotation') - 50) * 0.16
      + (foMdcHasTal(c.p, 'finisher') ? 8 : 0)
      + (foMdcHasTal(c.p, 'sixMachine') ? 6 : 0);
  };
  order.push(takeBest(finScore), takeBest(finScore));
  // AND THE TAIL, on what they are actually worth with the bat.
  while (left.length) order.push(takeBest(function (c) { return c.rpd; }));
  return order;
}
function foMdcHasTal(p, t) {
  const T = (p && p.talents) || [];
  for (let i = 0; i < T.length; i++) if (T[i] === t) return true;
  return false;
}
// does the new ball bite today? Straight off the engine's own conditions: the
// green/overcast/humid/misty family is where a seamer's wicket rate jumps.
function foMdcNewBallBite(pitch, weather) {
  const wx = String(weather || '').toLowerCase();
  return pitch === 'green' || wx === 'overcast' || wx === 'humid' || wx === 'misty';
}

/* ---------------------------------------------------------------------------
   THE BOWLING PLAN — DELIBERATELY PARTIAL.

   The in-match captain (aiPickBowler) already reads the phase, the pitch, the
   size of the stand, how long a man has been on, his tiredness, his overs
   left, movement and turn, his talents and his own captaincy. Every over the
   coach paints is an over that captain cannot react in. A fully painted fifty
   is therefore usually WORSE than a good captain, and it silently deletes
   captaincy as a skill.

   So Auto states intentions and leaves the rest open:

     the new ball   the opening pair, for the overs the swing actually lasts.
                    The engine's new-ball term decays as exp(-over/8), so it is
                    down to a third by over 9 and a tenth by 18: the coach
                    assigns the opening burst and stops.
     the death      the last overs are where a specialist is worth most
                    (deathSpecialist pays +0.105 wickets and +0.135 dots in
                    41-50 and nothing before), and where a captain who has
                    burned his best man has no answer. The coach protects them.
     the middle     left to the captain, except where the conditions make one
                    man plainly right - a real turner with a real spinner.

   Everything unassigned is a hole, and plannedBowler() returns null on a hole,
   which is exactly the signal aiPickBowler waits for.
   --------------------------------------------------------------------------- */
function foMdcBowlingPlan(xi, ctx, pitch, refs, doctrine) {
  const opts = xi.filter(function (c) { return foMdcCanBowl(c.p); })
    .sort(function (a, b) { return b.bowlValue - a.bowlValue || (a.name < b.name ? -1 : 1); });
  const plan = new Array(51);           // 1-indexed; holes are the point
  if (opts.length < 2) return { plan: plan, assigned: 0, notes: [] };
  const notes = [];
  const used = {};
  const give = function (over, c) {
    if (over < 1 || over > 50 || plan[over] || !c) return false;
    if ((used[c.name] || 0) >= 10) return false;
    // the engine's own law: nobody bowls two in a row
    if (plan[over - 1] === c.name || plan[over + 1] === c.name) return false;
    plan[over] = c.name; used[c.name] = (used[c.name] || 0) + 1;
    return true;
  };
  // THE NEW BALL. How long the burst lasts is read off the engine's decay:
  // where the new ball genuinely bites, it is worth six overs each end; where
  // it does not, three, and the captain takes it from there.
  const bite = foMdcNewBallBite(pitch, ctx.weather);
  const nbScore = function (c) {
    // measure him where he would actually bowl - the first over - rather than
    // over the whole grid, so a swing bowler is judged on swing
    const d = ballDist(refs.bat, c.today, 'pp', 8, 0, 0, pitch, 'bal', 2, ctx);
    const w = (d.wC || 0) + (d.wB || 0) + (d.wLBW || 0) + (d.wRO || 0) + (d.wST || 0);
    const r = (d['1'] || 0) + 2 * (d['2'] || 0) + 3 * (d['3'] || 0) + 4 * (d['4'] || 0) + 6 * (d['6'] || 0);
    return (w * FO_MDC.WKT_RUNS - r) + (foMdcHasTal(c.p, 'newBallSpecialist') ? 3 : 0);
  };
  const openers = opts.slice().sort(function (a, b) {
    return nbScore(b) - nbScore(a) || (a.name < b.name ? -1 : 1);
  }).slice(0, 2);
  // THE BURST IS THE CONDITIONS', AND ONLY WHERE THE CONDITIONS SPEAK — a
  // measured conclusion twice over. The old engine needed a painted burst to
  // stop the captain churning one-over bowlers; Phase 2A's continuation gate
  // means he holds sensible spells by himself, so painting is only worth
  // anything where the coach genuinely knows better than the ranking.
  // Measured on the new engine (tools/coach-followup-probe.mjs §3, bursts
  // 0/2/3/4/5/6 by pitch): on green under cloud the nominated swing pair
  // saves ~5.7 runs over leaving it open, and two overs painted do as well
  // as six - the value is naming the RIGHT PAIR, not the length. On
  // balanced and flat decks painting saves nothing at all (0 painted was
  // marginally the best row) and costs flexibility: the captain brings his
  // openers back at the death 4.2 overs a match unpainted against 2.9
  // painted. So where the ball bites the coach nominates the burst it
  // always did, and where it does not it paints nothing and trusts the
  // captain the engine now has. Stamina still sets no burst length - the
  // per-man spell question remains the captain's, over by over, through the
  // tank his score already reads.
  const burst = bite ? 6 : 0;
  for (let i = 0; i < burst; i++) {
    give(1 + i * 2, openers[0]);
    give(2 + i * 2, openers[1]);
  }
  if (burst && openers.length) {
    notes.push('new ball: ' + openers.map(function (c) { return c.name; }).join(' and ') +
      ' for ' + burst + ' overs each (the ball is doing something)');
  } else if (openers.length) {
    notes.push('new ball: left to the captain - conditions do not separate the seamers');
  }
  // THE DEATH, PLANNED ON THE MAN WHO WILL ACTUALLY ARRIVE THERE. Protect
  // the last four overs for the best death options, and leave 41-46 to the
  // captain - he knows the score and the coach does not.
  //
  // The old rule here categorically refused an opener the death slots,
  // because under the old engine the tank never drained by resting and a man
  // who bowled six early overs arrived at over 47 carrying every one of
  // them. Phase 2A repealed that physics: off-spell recovery means a quick
  // who bowls four with the new ball projects to a tank of ~0.10-0.14 at
  // the death - UNDER the 0.12 ramp, effectively fresh - and the played
  // comparison (tools/coach-followup-probe.mjs §4) has him dead level with
  // a rested closer, while a pre-tired man (projected 0.27) is still
  // rightly worse. A category cannot say all of that; a projection can.
  //
  // So every candidate is scored AS HE WILL BE AT OVER 47: his planned
  // overs so far (the painted burst) run through foFatProject - the same
  // pure law apply() charges ball by ball, not a coach-side copy - and the
  // result enters ballDist through ctx.bowlFat, exactly the channel the
  // match itself will read. An opener returns when his projected self is
  // genuinely the best answer; a tired or low-stamina one stands aside, and
  // nobody is excluded for the shape of his morning.
  const plannedOvers = {};
  for (let o = 1; o <= 50; o++) if (plan[o]) {
    (plannedOvers[plan[o]] = plannedOvers[plan[o]] || []).push(o - 1);
  }
  const deathScore = function (c) {
    const dctx = {};
    for (const k in ctx) dctx[k] = ctx[k];
    dctx.bowlFat = foFatProject(c.today, plannedOvers[c.name] || [], 46);
    const d = ballDist(refs.bat, c.today, 'death', 40, 1, 0, pitch, 'bal', 47, dctx);
    const w = (d.wC || 0) + (d.wB || 0) + (d.wLBW || 0) + (d.wRO || 0) + (d.wST || 0);
    const r = (d['1'] || 0) + 2 * (d['2'] || 0) + 3 * (d['3'] || 0) + 4 * (d['4'] || 0) + 6 * (d['6'] || 0);
    return (w * FO_MDC.WKT_RUNS - r) + (foMdcHasTal(c.p, 'deathSpecialist') ? 4 : 0);
  };
  const closers = opts.slice().sort(function (a, b) {
    return deathScore(b) - deathScore(a) || (a.name < b.name ? -1 : 1);
  });
  const dPair = closers.slice(0, 2);
  if (dPair.length === 2) {
    give(47, dPair[0]); give(48, dPair[1]); give(49, dPair[0]); give(50, dPair[1]);
    const opened = {};
    openers.slice(0, burst ? 2 : 0).forEach(function (c) { if (c) opened[c.name] = 1; });
    const returns = dPair.filter(function (c) { return opened[c.name]; });
    notes.push('death: ' + dPair.map(function (c) { return c.name; }).join(' and ') + ' hold overs 47-50' +
      (returns.length ? ' (' + returns.map(function (c) { return c.name; }).join(' and ') +
        ' returning - projected fresh enough)' : ''));
  }
  // THE MIDDLE, only where the surface makes it obvious. A real turner with a
  // real spinner is the one middle-overs call the coach is more sure of than
  // the captain, because the captain re-reads it every over anyway.
  if (pitch === 'dry' || pitch === 'cracked') {
    const spinners = opts.filter(function (c) { return c.cls === 'spin'; });
    if (spinners.length) {
      const best = spinners[0];
      let put = 0;
      for (let o = 21; o <= 34 && put < 4; o += 3) if (give(o, best)) put++;
      if (put) notes.push('middle: ' + best.name + ' gets ' + put + ' overs on a turning pitch');
    }
  }
  let assigned = 0;
  for (let o = 1; o <= 50; o++) if (plan[o]) assigned++;
  return { plan: plan, assigned: assigned, notes: notes, openers: openers, closers: dPair };
}

// the plan as the saved-orders format wants it: spells per end. The engine
// compiles spells back into the 1-50 array, so a plan expressed here survives
// the round trip through a manager's saved sheet.
function foMdcPlanToSpells(plan) {
  const out = { north: [], south: [] };
  let cur = null;
  for (let o = 1; o <= 50; o++) {
    const nm = plan[o];
    if (!nm) { cur = null; continue; }
    const end = (o % 2 === 1) ? 'north' : 'south';
    if (cur && cur.end === end && cur.bowler === nm && o === cur.next) {
      cur.n++; cur.next = o + 2; continue;
    }
    cur = { end: end, bowler: nm, first: o, n: 1, next: o + 2, field: 'bal' };
    out[end].push({ bowler: nm, first: o, n: 1, field: 'bal' });
    cur.ref = out[end][out[end].length - 1];
  }
  // recount each spell's length from the plan itself, so the compiled array
  // that comes back out is the array that went in
  ['north', 'south'].forEach(function (end) {
    out[end].forEach(function (sp) {
      let n = 0, o = sp.first;
      while (o <= 50 && plan[o] === sp.bowler) { n++; o += 2; }
      sp.n = Math.max(1, n);
    });
  });
  return out;
}

/* ---------------------------------------------------------------------------
   THE TOSS — A MEASUREMENT, NOT FOLKLORE.

   tools/matchday-toss.mjs plays every fixture BOTH WAYS from the same seed
   (A bats first / B bats first) so any strength difference between the two
   clubs cancels exactly, and counts how often the side batting first won.
   36,000 matches, 1,500 pairs a cell, neutral ground, error bars over PAIRS
   rather than matches because the two runs in a pair are not independent.
   The whole table is in docs/matchday-coach/toss.txt. What it found:

     pitch     weather      bat-1st %   SE     verdict
     balanced  Sunny          53.00    0.80    BAT
     flat      Sunny          52.88    0.69    BAT
     green     Sunny          47.65    0.82    BOWL
     dry       Sunny          57.05    0.85    BAT   <- the largest edge anywhere
     slow      Sunny          52.90    0.79    BAT
     cracked   Sunny          54.55    0.85    BAT
     twoPaced  Sunny          52.18    0.79    BAT
     green     Overcast       47.00    0.87    BOWL
     green     Humid          48.48    0.85    no measurable edge
     green     Misty          46.30    0.84    BOWL
     dry       Dew later      51.07    0.85    no measurable edge
     balanced  Drizzle        54.88    0.78    BAT
     POOLED                   51.50    0.24

   AND IT KILLED TWO RULES THIS FILE USED TO CARRY, both of them mine, both of
   them folklore dressed as a coefficient:

     "swing weather is a first-innings weapon, -10 points"
        FALSE, or at any rate invisible. The four GREEN cells - sunny,
        overcast, humid, misty - land between 46.30 and 48.48, and the largest
        gap between any two of them is 2.2 +/- 1.2 (z = 1.8). The green top is
        the signal; the sky above it is not. The rule is gone rather than
        shrunk, because a coefficient nobody has measured is exactly the
        second cricket engine this file exists to avoid.

     "dew makes defending a total the losing half of the deal, -35 points"
        Right in SIGN, wrong by a factor of six. Dry with dew later measures
        51.07 against dry in the sun at 57.05: dew is worth about SIX points
        (-5.98 +/- 1.20, z = 5.0), and what it does is turn the strongest
        bat-first pitch in the game into a coin flip. It is the only weather
        term that survives, and it is a large one.

   AND FOUR PITCHES ARE ONE PITCH, as far as the toss is concerned. balanced
   52.88, flat 52.90, slow 53.00 and twoPaced 52.18 are mutually
   indistinguishable; writing four numbers down would be four decimal places
   of noise pretending to be cricket. They are pooled at +2.74 +/- 0.4, which
   is a single measured band and says BAT on all four.

   IS THE EDGE JUST ONE TUNING CONSTANT? No - and this was bisected rather
   than argued, per CLAUDE.md. Zeroing the whole chase model (chase_risk,
   chase_four, chase_six, chase_dot) and re-measuring moved the pooled
   bat-first share from 51.50 to 52.56 - the WRONG way - while the second
   innings gained 10-19 runs. The chase-pressure model costs a chasing side
   runs in already-lost causes and roughly zero wins. The bat-first edge is
   emergent from fifty overs of information the chasing captain does not have,
   not a constant anybody can retune away.

   So the model is: the PITCH decides, and dew is the one sky that speaks.
   Home advantage is deliberately not in here, and that is measured too:
   --home on the same matchup gave 54.33 +/- 2.05 against 56.08 +/- 1.92
   neutral, no measurable difference.

   ONE HONEST CAVEAT. This table is an AVERAGE over four squad match-ups, not
   a law. A single matchup on balanced/Sunny measured 56.08 +/- 1.92 against
   the four-matchup 53.00 +/- 0.80 - suggestive (z = 1.5) but not established.
   A side's own balance may move the right answer further than the pitch does,
   and that is the next thing worth measuring if the advice ever matters more
   than it does today.
   --------------------------------------------------------------------------- */
// the measured share of matches won by the side batting first, by pitch, on a
// neutral ground. Anything not in the table is a coin flip, which is the
// honest answer for a surface nobody has measured.
var FO_MDC_TOSS = {
  // the four that cannot be told apart, pooled: +2.74 points
  balanced: { bat: 0.5274 }, flat: { bat: 0.5274 },
  slow:     { bat: 0.5274 }, twoPaced: { bat: 0.5274 },
  // green, pooled across all four skies: -2.6 points, bowl first
  green:    { bat: 0.4740 },
  // and the two that stand on their own
  dry:      { bat: 0.5705 }, cracked: { bat: 0.5455 }
};
// dew later, measured on the pitch where it matters most: 57.05 -> 51.07.
var FO_MDC_TOSS_DEW = -0.0598;

function foMdcToss(pitch, weather, opts) {
  const wx = String(weather || '').toLowerCase();
  const P = (FO_MDC_TOSS && FO_MDC_TOSS[pitch]) || null;
  let bat = P ? P.bat : 0.5;
  if (wx === 'dew later') bat += FO_MDC_TOSS_DEW;
  return { bat: bat >= 0.5, margin: bat - 0.5 };
}

/* ===========================================================================
   THE ONE ENTRY POINT.

   planMatchDay({team, pitch, weather, homeAway, oppositionScout, doctrine,
                 mode, unavailable})
     -> {xi, battingOrder, captain, keeper, tossDecision, bowlingPlan,
         spells, explanation}

   Pure. No clock, no randomness, no network, no mutation of the squad.
   =========================================================================== */
function planMatchDay(req) {
  req = req || {};
  const team = req.team || {};
  const pitch = req.pitch || 'balanced';
  const weather = req.weather || 'sunny';
  const doctrine = req.doctrine || null;
  const scout = req.oppositionScout || null;
  const out = { xi: [], battingOrder: [], captain: null, keeper: null,
                tossDecision: 'bat', bowlingPlan: null, spells: { north: [], south: [] },
                explanation: {} };
  // AVAILABILITY FIRST: a man who is not there cannot be picked, and nothing
  // downstream should have to remember that.
  const gone = {};
  (req.unavailable || []).forEach(function (n) { gone[typeof n === 'string' ? n : (n && n.name)] = 1; });
  const squad = (team.players || []).filter(function (p) { return p && p.name && !gone[p.name]; });
  if (!squad.length) return out;

  const refs = foMdcRefs(squad);
  if (!refs) return out;
  // the share of the innings the opposition is likely to bowl with pace,
  // taken from the scout's PUBLIC attack band and nothing finer
  const paceMix = foMdcPaceMix(scout);
  // the side's own hands and gloves stand behind every measurement; a first
  // pass with the world's par keeper is enough to rank, and the chosen
  // keeper's real quality then rides in the ball model for the match itself
  const ctx = foMdcCtx(weather, FO_KQ_PAR, 50, false);
  const cards = squad.map(function (p) { return foMdcCard(p, refs, ctx, pitch, paceMix); });
  // the opposition's coarse weaknesses, as a small tilt on the cards
  foMdcApplyScout(cards, scout);

  const chosen = foMdcChooseXI(cards, doctrine);
  const xi = chosen.xi;
  out.exactSearch = !!chosen.exact;
  out.xi = xi.map(function (c) { return c.name; });

  // the order, the gloves, the armband
  const order = foMdcBattingOrder(xi, ctx, pitch, refs, doctrine);
  out.battingOrder = order.map(function (c) { return c.name; });
  const keeper = (chosen.score && chosen.score.keeper) || null;
  out.keeper = keeper ? keeper.name : (xi[0] && xi[0].name) || null;
  // THE CAPTAIN: the best leader among men who already deserve their place.
  // Never a man dragged in to wear the armband - the measured value of
  // captaincy (CAPT_RUNS) is far below the cost of a worse cricketer.
  let capt = xi[0];
  for (let i = 1; i < xi.length; i++) {
    if (xi[i].capt > capt.capt || (xi[i].capt === capt.capt && xi[i].name < capt.name)) capt = xi[i];
  }
  out.captain = capt ? capt.name : null;

  const bowling = foMdcBowlingPlan(xi, ctx, pitch, refs, doctrine);
  out.bowlingPlan = bowling.plan;
  out.spells = foMdcPlanToSpells(bowling.plan);
  out.assignedOvers = bowling.assigned;
  out.openOvers = 50 - bowling.assigned;

  const toss = foMdcToss(pitch, weather, req);
  out.tossDecision = toss.bat ? 'bat' : 'bowl';

  out.explanation = {
    conditions: pitch + ' / ' + String(weather).toLowerCase(),
    newBallBites: foMdcNewBallBite(pitch, weather),
    paceMix: paceMix,
    score: chosen.score ? {
      total: Math.round(chosen.score.total * 10) / 10,
      bat: Math.round(chosen.score.bat * 10) / 10,
      bowl: Math.round(chosen.score.bowl * 10) / 10,
      keep: Math.round(chosen.score.keep * 10) / 10,
      field: Math.round(chosen.score.field * 10) / 10,
      capt: Math.round(chosen.score.capt * 10) / 10,
      allround: Math.round(chosen.score.allround * 10) / 10,
      doctrine: Math.round(chosen.score.doctrine * 10) / 10
    } : null,
    attack: xi.filter(function (c) { return c.front; }).map(function (c) {
      return { name: c.name, type: c.p.bowlType, cls: c.cls,
               value: Math.round(c.bowlValue * 100) / 100, wkts: Math.round(c.bowlW * 1000) / 1000 };
    }),
    pace: xi.filter(function (c) { return c.front && c.cls === 'pace'; }).length,
    spin: xi.filter(function (c) { return c.front && c.cls === 'spin'; }).length,
    keeperQuality: keeper ? Math.round(keeper.keepQ) : null,
    bowlingNotes: bowling.notes,
    tossMargin: Math.round(toss.margin * 1000) / 1000,
    cards: cards.map(function (c) {
      return { name: c.name, rpd: Math.round(c.rpd * 10) / 10,
               bowl: Math.round(c.bowlValue * 100) / 100,
               keep: c.canKeep ? Math.round(c.keepQ) : null,
               fatPen: Math.round((c.today._fatPen || 0) * 100) / 100,
               form: Math.round((c.today._formShift || 0) * 100) / 100,
               picked: out.xi.indexOf(c.name) >= 0 };
    })
  };
  return out;
}

// WHAT SHARE OF THE OVERS COMES DOWN AT PACE. Read off the scout's published
// attack band - the same words a human is shown - and nothing finer.
function foMdcPaceMix(scout) {
  if (!scout || !scout.attack) return 0.62;
  const a = String(scout.attack).toLowerCase();
  if (a.indexOf('pace-heavy') >= 0) return 0.90;
  if (a.indexOf('spin-only') >= 0) return 0.15;
  if (a.indexOf('pace-lean') >= 0) return 0.75;
  if (a.indexOf('spin-lean') >= 0) return 0.40;
  return 0.62;
}

// THE OPPOSITION, AT THE MARGIN. The scout page publishes two coarse reads a
// human can act on - a middle order uneasy against turn, or one that can be
// rushed by pace. They tilt a close selection call by OPP_TILT and can never
// overturn a real gap in quality, which is what stops matchup teams.
function foMdcApplyScout(cards, scout) {
  if (!scout) return;
  const weakSpin = !!scout.weakVsSpin, weakPace = !!scout.weakVsPace;
  if (!weakSpin && !weakPace) return;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c.front) continue;
    // the tilt is a discount on what his overs cost - the channel the
    // optimiser actually reads - and bowlValue follows it for the explanation
    if (weakSpin && c.cls === 'spin') { c.bowlCost -= FO_MDC.OPP_TILT; c.bowlValue = -c.bowlCost; }
    if (weakPace && c.cls === 'pace') { c.bowlCost -= FO_MDC.OPP_TILT; c.bowlValue = -c.bowlCost; }
  }
}

/* ---------------------------------------------------------------------------
   WHAT MAY BE KNOWN ABOUT THE OPPOSITION, computed in ONE place so a bot and a
   human are told the same thing.

   The scout page (01-club-home.js foScoutBrief) publishes coarse BANDS to a
   manager: how the attack splits between pace and spin, how deep the batting
   goes, and two prose reads - a middle order "uneasy against the turning ball"
   or one that "can be rushed by pace". Those bands are computed from numbers a
   manager may not see, but the BANDS THEMSELVES are shown to him, and they are
   all the coach gets. The thresholds below are the scout page's own, quoted so
   the two cannot drift: mid-order mean under 42 and at least 8 clear of the
   other lean.

   This is the fairness rule in code. A bot never touches a rival's raw skills;
   it reads the same sentence the human reads.
   --------------------------------------------------------------------------- */
function foMdcPublicScout(squad) {
  const men = (squad || []).filter(function (p) { return p && p.name; });
  if (!men.length) return null;
  const front = men.filter(foMdcIsFront);
  let pace = 0, spin = 0;
  front.forEach(function (p) { if (typeClass(p.bowlType) === 'pace') pace++; else spin++; });
  let attack = 'Balanced attack';
  if (!spin && pace) attack = 'Pace-heavy';
  else if (!pace && spin) attack = 'Spin-only';
  else if (pace >= spin * 2) attack = 'Pace-leaning';
  else if (spin >= pace * 2) attack = 'Spin-leaning';
  // the middle order the scout page reads: men 4-7 by batting
  const byBat = men.slice().sort(function (a, b) { return (b.bat || 0) - (a.bat || 0); }).slice(3, 7);
  const mean = function (k) {
    if (!byBat.length) return 50;
    let t = 0;
    for (let i = 0; i < byBat.length; i++) t += (foSkE(byBat[i], k) || 50);
    return t / byBat.length;
  };
  const vsSpin = mean('vsSpin'), vsPace = mean('vsPace');
  const out = { attack: attack, pace: pace, spin: spin };
  if (byBat.length >= 3) {
    if (vsSpin < 42 && vsSpin < vsPace - 8) out.weakVsSpin = true;
    else if (vsPace < 42 && vsPace < vsSpin - 8) out.weakVsPace = true;
  }
  // batting depth, the scout's own band - carried for the explanation only
  const bats = men.map(function (p) { return p.bat || 0; }).sort(function (a, b) { return b - a; });
  const capable = bats.filter(function (v) { return v >= 48; }).length;
  out.depth = capable >= 8 ? 'Deep' : capable >= 6 ? 'Solid' : 'Top-heavy';
  return out;
}

// the coach, as the rest of the game reaches it
try {
  window.planMatchDay = planMatchDay;
  window.foMdcPublicScout = foMdcPublicScout;
  window.FO_MDC = FO_MDC;
  window.foMdcToday = foMdcToday;
  window.foMdcCard = foMdcCard;
  window.foMdcScoreXI = foMdcScoreXI;
  window.foMdcChooseXI = foMdcChooseXI;
  window.foMdcExactSearch = foMdcExactSearch;
  window.foMdcRefs = foMdcRefs;
  window.foMdcCtx = foMdcCtx;
  window.foMdcToss = foMdcToss;
  window.foMdcPlanToSpells = foMdcPlanToSpells;
  window.foMdcIsFront = foMdcIsFront;
} catch (eMdc) {}
