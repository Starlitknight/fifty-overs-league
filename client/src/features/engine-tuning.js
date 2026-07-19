/* features/engine-tuning — a deterministic realism layer over ballDist.
 *
 * The pristine engine file is hash-locked, but ballDist is a global
 * function: we wrap it and reshape the probability distribution it returns
 * BEFORE the engine's single seeded draw. Multiplying an outcome's
 * probability by f and renormalizing is exactly a +log(f) shift on its
 * logit — the same currency the engine itself trades in.
 *
 * Fairness rules:
 *  - No extra randomness is consumed (matches stay seed-deterministic).
 *  - Every adjustment is symmetric: it keys off pitch, innings, bowler
 *    type/hand, batter hand, field setting and intent — never off which
 *    team is the user's. Both sides of every match are tuned identically.
 *  - window.__foTuneOff = 1 restores the stock model (A/B benchmarking
 *    and an emergency kill switch).
 *
 * The three upgrades:
 *  A. Pitch wear — surfaces change across a match: dry decks turn more in
 *     the second innings (and late in an innings), cracked pitches get
 *     more uneven bounce, green seamers flatten out after innings one.
 *  B. Matchup geometry — spin turning AWAY from the bat (off-spin to a
 *     left-hander, leg-spin to a right-hander, SLA to a right-hander)
 *     hunts the outside edge; spin turning IN hunts pads and stumps but
 *     edges less. Cross-angle pace finds the edge a touch more often.
 *  C. Field × intent — an attacking field punishes aggression with edges
 *     but leaks boundaries; a spread field smothers boundaries against a
 *     slogger while conceding twos; blockers can sit safely on an
 *     attacking field but score slower.
 */
FOC.engineTuning = (function () {
  var CFG = {
    wear: {
      dry2SpinW: 1.16,      // dry pitch, 2nd innings: spin dismissals up
      dry2SpinDot: 1.04,
      dry2Four: 0.97,
      crack2BLbw: 1.10,     // cracked, 2nd innings: uneven bounce → bowled/lbw
      crack2C: 1.05,
      green2C: 0.88,        // green flattens: seam catches fade in innings 2
      green2BLbw: 0.94,
      green2Four: 1.03,
      lateOver: 35,         // dry/cracked footholes late in ANY innings
      lateSpinW: 1.06
    },
    matchup: {
      awayC: 1.18,          // spin turning away: outside edge to slip/keeper
      awayST: 1.10,         //   ...and beaten in the drift, stumped
      awayDot: 1.02,
      inLBW: 1.18,          // spin turning in: pads and stumps in play
      inB: 1.10,
      inC: 0.85,
      paceCrossC: 1.05,     // pace angling across the bat: edges
      paceSameLBW: 1.05     // pace angling in: lbw
    },
    fieldIntent: {
      attAggC: 1.08,        // attacking field vs attacking bat: edges carry
      attAggFour: 1.02,     //   ...but the ring has gaps
      attBlockDot: 1.05,    // blockers can sit on an attacking field
      attBlockOne: 0.97,
      defAggFour: 0.94,     // spread field vs slogger: boundaries dry up
      defAggTwo: 1.08,      //   ...twos into the gaps instead
      defAggSix: 1.02,      //   ...aerial is the way over a deep-set ring
      defAggW: 0.98
    }
  };
  var W_PITCH = ["wC", "wB", "wLBW", "wST"];   // pitch-driven dismissals (not run outs)
  var W_ALL = ["wC", "wB", "wLBW", "wRO", "wST"];

  function typeClassT(t) {
    return (t === "fast" || t === "fastMedium" || t === "medium") ? "pace" : "spin";
  }
  // does this bowler's stock ball turn away from this batter's outside edge?
  function turnsAway(bowl, bat) {
    var bt = bowl.bowlType;
    if (bt === "fingerSpin") return (bowl.hand || "R") !== (bat.hand || "R");
    if (bt === "wristSpin") return (bowl.hand || "R") === (bat.hand || "R");
    return false;
  }

  function tune(e, bat, bowl, ph, intent, pitch, field, over, inns) {
    var f = {};
    function mul(k, m) { f[k] = (f[k] || 1) * m; }
    function mulAll(keys, m) { for (var i = 0; i < keys.length; i++) mul(keys[i], m); }
    var tc = typeClassT(bowl.bowlType || "fastMedium");
    var C = CFG;

    // A. pitch wear
    if (inns >= 1) {
      if (pitch === "dry" && tc === "spin") {
        mulAll(W_PITCH, C.wear.dry2SpinW);
        mul("dot", C.wear.dry2SpinDot); mul("4", C.wear.dry2Four);
      } else if (pitch === "cracked") {
        mul("wB", C.wear.crack2BLbw); mul("wLBW", C.wear.crack2BLbw); mul("wC", C.wear.crack2C);
      } else if (pitch === "green" && tc === "pace") {
        mul("wC", C.wear.green2C); mul("wB", C.wear.green2BLbw); mul("wLBW", C.wear.green2BLbw);
        mul("4", C.wear.green2Four);
      }
    }
    if ((pitch === "dry" || pitch === "cracked") && tc === "spin" && over >= C.wear.lateOver) {
      mulAll(W_PITCH, C.wear.lateSpinW);
    }

    // B. matchup geometry
    if (tc === "spin") {
      if (turnsAway(bowl, bat)) {
        mul("wC", C.matchup.awayC); mul("wST", C.matchup.awayST); mul("dot", C.matchup.awayDot);
      } else {
        mul("wLBW", C.matchup.inLBW); mul("wB", C.matchup.inB); mul("wC", C.matchup.inC);
      }
    } else {
      if ((bowl.hand || "R") !== (bat.hand || "R")) mul("wC", C.matchup.paceCrossC);
      else mul("wLBW", C.matchup.paceSameLBW);
    }

    // C. field × intent
    if (field === "att") {
      if (intent >= 1) { mul("wC", C.fieldIntent.attAggC); mul("4", C.fieldIntent.attAggFour); }
      else { mul("dot", C.fieldIntent.attBlockDot); mul("1", C.fieldIntent.attBlockOne); }
    } else if (field === "def" && intent >= 2) {
      mul("4", C.fieldIntent.defAggFour); mul("2", C.fieldIntent.defAggTwo);
      mul("6", C.fieldIntent.defAggSix);
      mulAll(W_ALL, C.fieldIntent.defAggW);
    }

    // renormalize
    var out = {}, Z = 0, k;
    for (k in e) { out[k] = e[k] * (f[k] || 1); Z += out[k]; }
    if (!(Z > 0)) return e;
    for (k in out) out[k] /= Z;
    return out;
  }

  function install() {
    if (typeof window === "undefined") return false;
    if (typeof window.ballDist !== "function") return false;
    if (window.ballDist.__foTuned) return true;
    var orig = window.ballDist;
    var wrapped = function (bat, bowl, ph, faced, intent, rrDef, pitch, field, over, ctx) {
      var e = orig.apply(this, arguments);
      try {
        if (window.__foTuneOff) return e;
        var inns = (typeof M !== "undefined" && M) ? (M.inns || 0) : 0;
        return tune(e, bat, bowl, ph, intent, pitch, field, over, inns);
      } catch (err) { return e; }
    };
    wrapped.__foTuned = true;
    wrapped.__foOrig = orig;
    window.ballDist = wrapped;
    return true;
  }

  return { install: install, tune: tune, turnsAway: turnsAway, CFG: CFG };
})();
