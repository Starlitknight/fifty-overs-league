/* world-client/content — the vertical-slice conversations. Short boxes,
 * original words, real facts. Anchor names come from the bridge (the actual
 * generated squad); match dialogue quotes the actual scorecard or refuses
 * to render.
 */
(function () {
  var D = FOW.dialogue;
  function reg(n) { D.register(n); }
  function nmS(nm) { return nm ? String(nm).split(" ").slice(-1)[0] : ""; }

  // ---- arrival --------------------------------------------------------------
  reg({ id: "arrival.gaffer", sp: "The Gaffer", expr: "portrait.gaffer.serious",
    lines: ["You're late.", "…", "Good. Club's late by twenty years.", "Come on."],
    effects: function (w) { w.flags.metGaffer = 1; FOW.state.note("The Gaffer: waiting at the station. Knew my train before I did."); } });
  reg({ id: "look.timetable", sp: "Timetable", expr: null,
    lines: ["Three trains a day. The last one back left an hour before you arrived.",
      "Someone has ringed Saturday's service to Willowmere in pencil."],
    effects: function (w) { if (w.discoveries.indexOf("timetable") < 0) w.discoveries.push("timetable"); } });

  // ---- club discovery -------------------------------------------------------
  reg({ id: "look.honours", sp: "Honours board", expr: null,
    lines: ["Gold leaf, last touched decades ago.", "The final line reads: CHAMPIONS — and then nothing, for twenty years."],
    effects: function (w) { if (w.discoveries.indexOf("honours") < 0) w.discoveries.push("honours"); } });
  reg({ id: "look.photo", sp: "Faded photograph", expr: null,
    lines: ["A younger Gaffer carries kit bags at the frame's edge.",
      "The man lifting the trophy is unmistakably Reggie Thorne."],
    effects: function (w) {
      if (w.discoveries.indexOf("photo") < 0) w.discoveries.push("photo");
      FOW.state.note("A photograph: the Gaffer and Reggie Thorne, one team, long ago.");
    } });
  reg({ id: "look.volunteers", sp: "Volunteers", expr: null,
    lines: ["Four locals and a roller older than any of them.", "“Square'll be ready Saturday. It's always ready Saturday.”"],
    effects: function (w) { if (w.discoveries.indexOf("volunteers") < 0) w.discoveries.push("volunteers"); } });
  reg({ id: "look.urn", sp: "Tea urn", expr: null,
    lines: ["Still warm. In this club, that counts as infrastructure."] });
  reg({ id: "look.papers", sp: "Committee papers", expr: null,
    lines: ["Provisional status. One season to prove the club deserves permanence.",
      "Margaret has underlined 'solvent' twice."] });
  reg({ id: "look.shelf", sp: "The trophy shelf", expr: null,
    lines: ["Dust, and space.", "Somebody has measured the widest gap. In pencil. Recently."] });

  reg({ id: "meet.argument", sp: null, expr: "cutout.player.bat",
    lines: [
      function (w, B) { var a = B.anchor("captain"); return (a ? a : "The senior batter") + ": “We bat properly for ten overs. THEN we go.”"; },
      function (w, B) { var o = B.anchor("star"); return (o ? o : "The opener") + ": “The game's fifty overs, not sixty. We go from ball one.”"; },
      "They both turn to you at the same moment."
    ],
    choices: [
      { t: "“Start careful. Earn the right to attack.”", fx: function (w) { w.flags.sawArgument = 1; w.flags.argumentSide = "careful"; } },
      { t: "“Intent from the first ball.”", fx: function (w) { w.flags.sawArgument = 1; w.flags.argumentSide = "attack"; } },
      { t: "“Show me on Saturday. Both of you.”", fx: function (w) { w.flags.sawArgument = 1; w.flags.argumentSide = "prove"; } }
    ],
    effects: function (w, B) {
      var a = B.anchor("captain"), o = B.anchor("star");
      if (a) FOW.state.note(a + ": leads the batting. Wants control first.");
      if (o) FOW.state.note(o + ": the aggressor at the top.");
    } });

  reg({ id: "meet.prospect", sp: null, expr: "cutout.player.ar",
    lines: [
      function (w, B) { var k = B.anchor("prospect"); return (k ? k : "The lad") + " doesn't stop bowling when you approach."; },
      "“Been here since seven. Someone had to be.”",
      "“You're the new manager? I'm ready. Whenever. Just saying.”"],
    effects: function (w, B) {
      var k = B.anchor("prospect");
      if (k) FOW.state.note(k + ": bowls alone before anyone arrives. Wants one chance.");
    } });
  reg({ id: "nets.prospect", sp: null, expr: "cutout.player.ar",
    lines: [function (w, B) {
      var t = B.trialFacts();
      var k = B.anchor("prospect");
      if (t && t.mine && t.mine.length) {
        var line = t.mine.filter(function (b) { return b.nm === k; })[0];
        if (line) return (k || "The prospect") + ": “" + line.r + " in the trial. It's in the book now. In ink.”";
      }
      return (k || "The prospect") + ": “Same net. Same length. Every morning until you pick me.”";
    }] });

  reg({ id: "meet.veteran", sp: null, expr: "cutout.player.bat",
    lines: [
      function (w, B) { var v = B.anchor("veteran"); return (v ? v : "The senior pro") + " nods at the empty room."; },
      "“I've seen this club die twice. Third time's yours to prevent.”",
      "“Ask me anything except how long I've got left.”"],
    effects: function (w, B) { var v = B.anchor("veteran"); if (v) FOW.state.note(v + ": " + "seen everything, says little. The room listens when he does."); } });
  reg({ id: "meet.keeper", sp: null, expr: "cutout.player.keeper",
    lines: [
      function (w, B) { var k = B.anchor("keeper"); return (k ? k : "The keeper") + " is re-webbing a glove with dental floss."; },
      "“Keeper sets the standard. Everything in front of me is my business.”"],
    effects: function (w, B) { var k = B.anchor("keeper"); if (k) FOW.state.note(k + ": the gloves, and the standards."); } });
  reg({ id: "meet.bowler", sp: null, expr: "cutout.player.pace",
    lines: [
      function (w, B) { var b = B.anchor("bowler"); return (b ? b : "The quick") + " is asleep under a towel. One eye opens."; },
      "“First over Saturday is mine. That's not a request.”"],
    effects: function (w, B) { var b = B.anchor("bowler"); if (b) FOW.state.note(b + ": takes the new ball. The first over is already his."); } });
  reg({ id: "meet.star", sp: null, expr: "cutout.player.bat",
    lines: [
      function (w, B) { var s = B.anchor("star"); return (s ? s : "The batter") + " is measuring the empty shelf with a pencil."; },
      "“Just seeing what fits. Something should fit.”"],
    effects: function (w, B) { var s = B.anchor("star"); if (s) FOW.state.note(s + ": the heaviest bat in the side. Measures trophy shelves for fun."); } });

  // ---- founding -------------------------------------------------------------
  reg({ id: "founding.margaret", sp: "Margaret Hobb", expr: null, mono: "MH",
    input: { flag: "clubName", placeholder: "The club's name, for the register" },
    lines: ["Thirty-one years I've filed for this club. You're the first manager I've had to dust for.",
      "Paperwork, then. The league requires a name and an identity. Colours first."],
    choices: [
      { t: "Navy and cream — the old way", fx: function (w, B) { w.flags.colour = "navy"; }, next: "founding.crest" },
      { t: "Terracotta and gold — a new flag", fx: function (w, B) { w.flags.colour = "terracotta"; }, next: "founding.crest" },
      { t: "Green and white — the meadow's own", fx: function (w, B) { w.flags.colour = "green"; }, next: "founding.crest" }
    ] });
  reg({ id: "founding.crest", sp: "Margaret Hobb", expr: null, mono: "MH",
    lines: ["And a crest. The stamp is older than I am; choose what it presses."],
    choices: [
      { t: "The harbour lantern", fx: function (w, B) { w.flags.crest = "lantern"; B.found(w); }, next: "founding.done" },
      { t: "Crossed bats and a rose", fx: function (w, B) { w.flags.crest = "bats"; B.found(w); }, next: "founding.done" },
      { t: "The railway wheel", fx: function (w, B) { w.flags.crest = "wheel"; B.found(w); }, next: "founding.done" }
    ] });
  reg({ id: "founding.done", sp: "Margaret Hobb", expr: null, mono: "MH",
    lines: [
      function (w, B) { return "Stamped. " + B.clubName() + ", of this town, in " + (w.flags.colour || "navy") + "."; },
      "The dressing room will want a captain before it wants anything else.",
      "I file. You manage."],
    effects: function (w, B) { FOW.state.note("Founded: " + B.clubName() + ". Provisional status — one season to earn permanence."); } });
  reg({ id: "office.margaret", sp: "Margaret Hobb", expr: null, mono: "MH",
    lines: [function (w, B) {
      var pr = B.activePromise();
      if (pr) return "For your records: a live promise. " + pr + ". I file these too.";
      return "The ledger is current and the tea is not. One of those I can fix.";
    }] });

  // ---- captaincy + philosophy ----------------------------------------------
  reg({ id: "choose.captain", sp: "The Gaffer", expr: "portrait.gaffer.neutral",
    lines: [
      function (w, B) { var c = B.captainCandidates(); return "Armband. Evidence first: " + c.map(function (x) { return x.nm + " — " + x.why; }).join(". ") + "."; },
      "Pick one. Out loud."],
    choices: [] ,
    // choices are built live from the actual squad at open time
    dynChoices: function (w, B) {
      return B.captainCandidates().map(function (c) {
        return { t: c.nm + " (" + c.why + ")", fx: function (w2, B2) { B2.chooseCaptain(c.nm); }, next: "choose.philosophy" };
      });
    } });
  reg({ id: "choose.philosophy", sp: "The Gaffer", expr: "portrait.gaffer.serious",
    lines: ["Last question, and I'll hold you to the answer in August.", "What is this club FOR?"],
    choices: [
      { t: "Courage — the positive option, every time", fx: function (w, B) { B.choosePhilosophy("courage"); }, next: "choose.done" },
      { t: "Discipline — boring things done properly", fx: function (w, B) { B.choosePhilosophy("discipline"); }, next: "choose.done" },
      { t: "Community — nobody bigger than the shirt", fx: function (w, B) { B.choosePhilosophy("community"); }, next: "choose.done" },
      { t: "Ambition — here to take the Crown Ground", fx: function (w, B) { B.choosePhilosophy("ambition"); }, next: "choose.done" }
    ] });
  reg({ id: "choose.done", sp: "The Gaffer", expr: "portrait.gaffer.wry",
    lines: [
      function (w, B) { return nmS(B.anchor("captain")) + " it is. The board's behind you — chalk your XI on it."; },
      "Willowmere on Saturday. Away. The Meadow suits soft hands and hard heads."],
    effects: function (w, B) { w.flags.captainChosen = 1; FOW.state.note("Captain: " + (B.anchor("captain") || "chosen") + ". Willowmere away first."); } });

  // ---- willowmere -----------------------------------------------------------
  reg({ id: "wm.sign", sp: "Village sign", expr: null,
    lines: ["WILLOWMERE — winner, Best Kept Village, four years running.", "Underneath, smaller: 'And we bat all fifty overs.'"] });
  reg({ id: "wm.manager", sp: "Ted Marsh", expr: null, mono: "TM",
    lines: ["Welcome to The Meadow. Thirty years I've managed here.",
      "We'll smile while we beat you. It's the local style.",
      "Soft hands, son. The pitch rewards patience and punishes tourists."] });

  // ---- post-match: the world remembers -------------------------------------
  reg({ id: "post.gaffer", sp: "The Gaffer", expr: null,
    lines: [
      function (w, B) {
        var f = B.lastFacts(); if (!f) return null;
        if (f.tie) return "A tie. Rarest page in the book. Nobody gets to sulk and nobody gets to sing.";
        return f.win ? "First blood: " + f.my + " for " + f.myW + " against their " + f.op + ". It stands forever now."
                     : "First scar: " + f.op + " to our " + f.my + ". It stands forever now. Good.";
      },
      function (w, B) {
        var f = B.lastFacts(); if (!f || !f.topNm) return null;
        return nmS(f.topNm) + "'s " + f.topR + " is in the scorebook. Ink, not opinion.";
      },
      "Get some sleep. The league table wakes up before you do."],
    effects: function (w, B) {
      w.flags.postGafferDone = 1;
      var f = B.lastFacts();
      if (f) FOW.state.note("Willowmere, first competitive match: " + f.my + "/" + f.myW + " v " + f.op + "/" + f.opW + (f.win ? " — won." : f.tie ? " — tied." : " — lost."));
    },
    expr2: function (w, B) { var f = B.lastFacts(); return f && f.win ? "portrait.gaffer.amused" : "portrait.gaffer.serious"; } });
  reg({ id: "post.captain", sp: null, expr: "cutout.player.bat",
    lines: [
      function (w, B) {
        var cap = B.anchor("captain"), f = B.lastFacts();
        if (!cap || !f) return null;
        var line = (f.batLines || []).filter(function (b) { return b.nm === cap; })[0];
        var own = line ? "Made " + line.r + " myself. " : "";
        if (w.flags.argumentSide === "careful") return nmS(cap) + ": “" + own + "You asked for careful starts. That's how I read it out there.”";
        if (w.flags.argumentSide === "attack") return nmS(cap) + ": “" + own + "Intent from ball one, you said. We lived by that today.”";
        return nmS(cap) + ": “" + own + "You told us to show you. Well. Now you've seen.”";
      }] });
  reg({ id: "post.newspaper", sp: "The Argus", expr: null,
    lines: [function (w, B) {
      var h = B.latestHeadline();
      return h ? "Tomorrow's back page: “" + h + "”" : "The presses are still warm. Nothing filed yet.";
    }] });
  reg({ id: "trial.debrief", sp: "The Gaffer", expr: "portrait.gaffer.neutral",
    lines: [function (w, B) {
      var t = B.trialFacts(); if (!t) return null;
      return "Trial's in the book: " + (t.topNm ? t.topNm + " " + t.topR : "quiet cards") + (t.bbNm ? ", " + t.bbNm + " " + t.bbW + "-" + t.bbR : "") + ". Evidence, not verdicts.";
    }] });
})();
