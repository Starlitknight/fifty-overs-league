/* story/england — THE FIRST SUMMER: the England campaign content.
 *
 * Chapters are code, not save-data: the save stores only (ch, beat, choices,
 * matches, promises). Every beat is a function (ctx) → descriptor:
 *   {kind:'scene', sp, face, tx, choices?:[{t, fx(ctx)}]}
 *   {kind:'match'}   — the hub offers the tie; a REAL engine match decides it
 * Post-match beats read ctx.facts — honest numbers from the actual
 * scorecard, never invented. Nobody in this file ever labels a player's
 * potential; they present evidence and let the manager conclude.
 */
FOC.england = (function () {
  var U = FOC.util;

  function s(sp, face, tx, choices) {
    return { kind: "scene", sp: sp, face: face, tx: tx, choices: choices || null };
  }
  function score(f) { return f.my + "/" + f.myW + " to their " + f.op + "/" + f.opW; }
  function nmShort(nm) { return nm ? nm.split(" ").slice(-1)[0] : ""; }

  var PHILOSOPHIES = [
    { k: "courage", label: "Courage", line: "We take the positive option. Every time. Even when it costs us." },
    { k: "discipline", label: "Discipline", line: "We do the boring things properly. Overs, angles, fields. Runs follow." },
    { k: "community", label: "Community", line: "This club belongs to the town. Nobody bigger than the shirt." },
    { k: "ambition", label: "Ambition", line: "We're not here to make up the numbers. We're here to take the Crown Ground." }
  ];

  // ---- prologue: the selection table ---------------------------------------
  var PROLOGUE = {
    key: "prologue", title: "Prologue", tag: "The Selection Table", opp: null,
    beats: [
      function (ctx) {
        return s("Margaret Hobb — club secretary", "npc:MH",
          "Keys, ledger, and the pavilion smells of linseed and old tea. I've run this club's paperwork for thirty-one years, and you're the first manager who's had to be shown where the light switch is. " +
          "The Gaffer's waiting in the long room. He's laid the squad out on the table like a hand of cards.");
      },
      function (ctx) {
        var g = ctx.groups();
        return s("The Gaffer", "gaffer",
          "Don't learn twenty names tonight. Learn the shape. " +
          g.bats + " specialist bats, " + g.keepers + " with the gloves, " + g.ars + " who do both jobs, " + g.bowlers + " who take the ball. " +
          "Four units. A club is those four units agreeing to pull the same direction. The names will come to you one match at a time — that's how names are supposed to arrive.");
      },
      function (ctx) {
        return s("The Gaffer", "gaffer-serious",
          "Before a single net: what is this club FOR? Say it now and I'll hold you to it in August.",
          PHILOSOPHIES.map(function (ph) {
            return { t: ph.label + " — " + ph.line, fx: function (c) {
              c.save.philosophy = { k: ph.k, label: ph.label, chChosen: 0 };
              c.choose("prologue", "philosophy", ph.k);
              c.emit("PhilosophyChosen", { k: ph.k });
            } };
          }));
      },
      function (ctx) {
        var cands = ctx.captainCandidates();
        return s("The Gaffer", "gaffer",
          "Captain. I'll give you the evidence, you give me the name. " +
          cands.map(function (c) { return c.nm + " — " + c.why; }).join(" ") +
          " Whoever you pick, pick them out loud.",
          cands.map(function (c) {
            return { t: c.nm + " (" + c.why + ")", fx: function (cx) {
              cx.setCast("captain", c.p);
              cx.choose("prologue", "captain", c.nm);
              cx.emit("CaptainAppointed", { pid: cx.pid(c.p), nm: c.nm, prev: null });
            } };
          }));
      },
      function (ctx) {
        var sen = ctx.pickSenior(), kid = ctx.pickProspect(), fr = ctx.pickFringe();
        var wk = ctx.pickKeeper(), nb = ctx.strikeBowler();
        ctx.setCast("senior", sen); ctx.setCast("prospect", kid); ctx.setCast("fringe", fr);
        if (wk) ctx.setCast("keeper", wk); if (nb) ctx.setCast("strike", nb);
        return s("The Gaffer", "gaffer",
          "Six anchors, then, and the rest of the squad hangs off them. Your captain you've named. " +
          sen.name + " — " + sen.age + ", seen everything, says little. " +
          (wk ? wk.name + " keeps wicket; a keeper sets the standard of a fielding side whether he means to or not. " : "") +
          (nb ? nb.name + " takes the new ball — the first over of the season is already his. " : "") +
          kid.name + " — " + kid.age + ", turned up to pre-season a week early, asking for a chance nobody's promised him. " +
          "And " + fr.name + ", who believes — with some evidence — that there's an XI spot with his name on it that keeps going to other people. " +
          "Learn those six. The other names will introduce themselves one scorecard at a time.");
      },
      function (ctx) {
        return s("Margaret Hobb — club secretary", "npc:MH",
          "One tradition before your first match: the manager chooses the match ball for the season opener. Pick from the cabinet.",
          [
            { t: "The 1987 ball — scuffed, famous, older than half the squad", fx: function (c) { c.save.matchBall = "heritage"; c.choose("prologue", "ball", "heritage"); } },
            { t: "A brand-new cherry, straight out of the wrapper", fx: function (c) { c.save.matchBall = "new"; c.choose("prologue", "ball", "new"); } },
            { t: "The ball from the club's last promotion — kept behind glass", fx: function (c) { c.save.matchBall = "promotion"; c.choose("prologue", "ball", "promotion"); } }
          ]);
      },
      function (ctx) {
        return s("The Gaffer", "gaffer-wink",
          "That's the table set. Willowmere on Saturday — nice ground, soft hands, they'll smile while they beat you if you let them. " +
          "One more offer before match day: I can raise a Trial XI this afternoon — a proper game, a proper scorecard, and the first hard evidence about your own squad. Entirely optional.",
          [
            { t: "Straight to Willowmere — match day is the only trial that counts", fx: function (c) {
                c.choose("prologue", "trial", "no");
              } },
            { t: "Run the trial match — I want evidence before Saturday", fx: function (c) {
                c.choose("prologue", "trial", "yes");
                c.save.flags.trialPending = 1;
              } }
          ]);
      }
    ]
  };

  // ---- the chapter spine ----------------------------------------------------
  var CHAPTERS = [PROLOGUE,
    {
      key: "willowmere", title: "Chapter 1 — Willowmere", tag: "Openers",
      opp: { id: "club_willowmere", nm: "Willowmere CC", city: "Willowmere", ground: "The Meadow",
        pitch: "green", wx: "Overcast", arch: "blade", mult: 0.84, captFlavour: "talisman" },
      beats: [
        function (ctx) {
          var op = ctx.confirmedOpeners();
          return s("The Gaffer", "gaffer",
            "Willowmere. Green pitch, cloud about, and their new-ball pair will ask your openers the same question forty times: are you good enough to leave it? " +
            (op ? "You've pencilled " + op[0] + " and " + op[1] + " at the top. Your call stands — just know WHY it's them." :
              "You haven't named your openers yet. Do it in the lineup room, and do it on purpose — the first forty balls of the season belong to those two.") +
            " Set the XI when you're ready.");
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts(), bits = [];
          if (f.fifties.length) bits.push(f.fifties[0].nm + " made " + f.fifties[0].r + " off " + f.fifties[0].b + " — first fifty of the summer, and the scorebook will remember it longer than he will.");
          if (f.ducks.length) bits.push(nmShort(f.ducks[0]) + " got a duck. Say nothing tomorrow. Everything you need to say, say at training on Tuesday.");
          if (f.threeFors.length) bits.push(f.threeFors[0].nm + " took " + f.threeFors[0].w + " for " + f.threeFors[0].r + ". Three-plus on debut weekend — that's a fact now, not an opinion.");
          if (!bits.length) bits.push("No fifties, no ducks, no big hauls — a quiet card. Quiet cards still count " + (f.win ? "wins" : "losses") + ".");
          return s("The Gaffer", f.win ? "gaffer-laugh" : "gaffer-serious",
            (f.win ? "First blood: " : "First scar: ") + score(f) + ". " + bits.join(" "));
        },
        function (ctx) {
          var f = ctx.facts();
          var head = f.win
            ? "NEW HANDS, OLD MEADOW: " + ctx.clubName().toUpperCase() + " SPOIL WILLOWMERE'S SATURDAY"
            : "WILLOWMERE TOO STREETWISE FOR NEW-LOOK " + ctx.clubName().toUpperCase();
          var det = f.win
            ? (f.topNm ? nmShort(f.topNm) + "'s " + f.topR + " the difference" : "a professional afternoon")
            : (f.oppTopNm ? nmShort(f.oppTopNm) + "'s " + f.oppTopR + " settles it" : "a hard lesson");
          return s("Sam Whitlow — the Argus", "npc:SW",
            "Tomorrow's back page: “" + head + "” — " + det + ". I don't do puff pieces and I don't do hatchet jobs. I print what the scorebook prints. You'll learn to like me in the good weeks.");
        },
        function (ctx) {
          var f = ctx.facts();
          var jab = f.win
            ? (f.topNm ? "Your " + nmShort(f.topNm) + " scored " + f.topR + " against a village new-ball attack. Lovely. Bring him to the Crown Ground and we'll finish the sentence." :
              "You beat Willowmere. So does the weather, most years.")
            : "Willowmere. WILLOWMERE. I have a photograph of their captain holding a raffle prize. Do better, or this is going to be a very short summer.";
          return s("Reggie Thorne", "thorne", jab);
        }
      ]
    },
    {
      key: "ironbridge", title: "Chapter 2 — Ironbridge", tag: "The Bowling Plan",
      opp: { id: "club_ironbridge", nm: "Ironbridge CC", city: "Ironbridge", ground: "Foundry Field",
        pitch: "flat", wx: "Sunny", arch: "express", mult: 0.9, captFlavour: "enforcer" },
      beats: [
        function (ctx) {
          var f0 = ctx.facts(1);
          var split = f0 ? "Last Saturday your wickets split " + f0.paceW + " to pace, " + f0.spinW + " to spin. " : "";
          return s("The Gaffer", "gaffer",
            "Foundry Field is a runway — flat, fast outfield, and Ironbridge's batters swing like shift workers on payday. " + split +
            "This week I want a bowling PLAN, not a bowling hope: who takes the new ball, who bowls the middle, who you're hiding at the death. " +
            "Set your spells in the lineup room. Whatever you write down, I'll read back to you at the innings break.");
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts();
          var used = f.bowlLines.slice().sort(function (a, b) { return b.w - a.w || a.r - b.r; });
          var plan = used.length
            ? "The plan on paper met the plan on grass: " + used.slice(0, 3).map(function (b) { return b.nm.split(" ").slice(-1)[0] + " " + b.w + "-" + b.r; }).join(", ") + "."
            : "The card says the overs got bowled; the details were the captain's on the day.";
          return s("The Gaffer", f.win ? "gaffer-laugh" : "gaffer-serious",
            score(f) + ". " + plan + " " +
            (f.bbNm ? nmShort(f.bbNm) + " finished " + f.bbW + "-" + f.bbR + " — best figures on the card. " : "") +
            (f.win ? "That's what a plan looks like when it survives contact." : "The plan didn't fail — it ran out of overs. Different problem, fixable one."));
        }
      ]
    },
    {
      key: "moorland", title: "Chapter 3 — Moorland", tag: "Conditions",
      opp: { id: "club_moorland", nm: "Moorland CC", city: "High Moor", ground: "High Tor",
        pitch: "green", wx: "Windy", arch: "rock", mult: 0.94, captFlavour: "wall" },
      beats: [
        function (ctx) {
          return s("The Gaffer", "gaffer-serious",
            "High Tor. Six hundred feet up, wind like a debt collector, and a green top that seams all day. Here's the selection dilemma, plainly: " +
            "extra seamer suits the surface but shortens your batting; the balanced card bats deep but leaves overs to part-timers. There is no right answer. There is only YOUR answer.",
            [
              { t: "Pack the seam attack — trust the surface", fx: function (c) { c.choose("moorland", "conditions", "seam"); } },
              { t: "Keep the balanced card — trust the batting", fx: function (c) { c.choose("moorland", "conditions", "balance"); } }
            ]);
        },
        function (ctx) {
          var fr = ctx.cast("fringe");
          return s("The Gaffer", "gaffer",
            "Whichever way you cut it, somebody who played last week carries the drinks this week. " + fr.nm + " has already done the maths in the car park. How do you handle the drop?",
            [
              { t: "Tell him face to face, before the team sheet goes up", fx: function (c) { c.rapport("dressingRoom", 4); c.choose("moorland", "drop", "face"); } },
              { t: "Let the team sheet do the talking", fx: function (c) { c.rapport("dressingRoom", -4); c.choose("moorland", "drop", "sheet"); } }
            ]);
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts();
          var drop = ctx.choice("moorland", "drop") === "face"
            ? "And for what it's worth — the dressing room noticed you did your own bad news this week. That buys quiet loyalty. Spend it carefully."
            : "The team sheet did your talking this week. Cheap at the time. The bill comes later.";
          return s("The Gaffer", f.win ? "gaffer" : "gaffer-serious", score(f) + " in that wind. " + drop);
        },
        function (ctx) {
          return s("Margaret Hobb — club secretary", "npc:MH",
            "Filing the High Tor card, I found something. A Marylebone scorebook, 2006. Same handwriting in two columns: R. THORNE, capt … and underneath, in the assistants' line, a name I believe you know. I've left it on your desk. I don't gossip. I file.");
        }
      ]
    },
    {
      key: "fenholt", title: "Chapter 4 — A Place in the Side", tag: "The Promise",
      opp: { id: "club_fenholt", nm: "Fenholt Athletic", city: "Fenholt", ground: "Brick Lane End",
        pitch: "dry", wx: "Sunny", arch: "finisher", mult: 0.97, captFlavour: "talisman" },
      beats: [
        function (ctx) {
          var fr = ctx.cast("fringe");
          var picked = ctx.selectionCount(fr.pid);
          return s(fr.nm, "player:bat",
            "Boss — straight question, I'll take a straight answer. " + picked + " selection" + (picked === 1 ? "" : "s") + " for me so far this summer. " +
            "I'm not asking for charity. I'm asking where I stand.",
            [
              { t: "Promise him a start within the next two matches", fx: function (c) {
                  c.makePromise(fr.pid, fr.nm + " starts one of the next two campaign matches", 2);
                  c.rapport("dressingRoom", 3);
                } },
              { t: "“I can't promise starts. I can promise you'll always know why.”", fx: function (c) {
                  c.rapport("dressingRoom", 1); c.choose("fenholt", "stance", "honest");
                } },
              { t: "“Earn it in the Lab. The team sheet is the only answer I give.”", fx: function (c) {
                  c.rapport("dressingRoom", -3); c.choose("fenholt", "stance", "hard");
                } }
            ]);
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts(), pr = ctx.activePromises();
          var tail = pr.length
            ? "You're carrying a live promise: " + pr[0].txt + " — " + pr[0].dueMatches + " match" + (pr[0].dueMatches === 1 ? "" : "es") + " left on it. Promises at this club get kept, broken, or replaced. Never forgotten."
            : "No promises on the books. Clean ledger — one way to run a club.";
          return s("The Gaffer", f.win ? "gaffer" : "gaffer-serious", score(f) + ". " + tail);
        }
      ]
    },
    {
      key: "bellminster", title: "Chapter 5 — Bellminster", tag: "They Read Your Scorebook",
      opp: { id: "club_bellminster", nm: "Bellminster CC", city: "Bellminster", ground: "Cathedral Green",
        pitch: "dusty", wx: "Sunny", arch: "wizard", mult: 1.0, captFlavour: "professor" },
      beats: [
        function (ctx) {
          var pat = ctx.patterns();
          return s("The Gaffer", "gaffer-serious",
            "Bellminster don't guess — they subscribe to the Argus. Facts they'll have highlighted: " +
            "your wickets this summer are " + pat.paceW + " pace, " + pat.spinW + " spin; " +
            (pat.topBat ? pat.topBat.nm + " has " + pat.topBat.runs + " of your runs" + (pat.dependence >= 40 ? " — " + pat.dependence + "% of everything you've scored" : "") + "; " : "") +
            (pat.commonOpeners ? "you've opened with " + pat.commonOpeners + " in every match. " : "") +
            "I'm not telling you to change anything. I'm telling you they know. Cathedral Green turns square — their spinners have been raised on it.");
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts();
          return s("The Gaffer", f.win ? "gaffer-laugh" : "gaffer-serious",
            score(f) + ". " + (f.win
              ? "They knew your patterns and it didn't save them. That's the difference between information and cricket."
              : "They did their homework and it showed. Fine. From now on, so do we."));
        }
      ]
    },
    {
      key: "blackstone", title: "Chapter 6 — The Setback", tag: "How You Respond",
      opp: { id: "club_blackstone", nm: "Blackstone Ramblers", city: "Blackstone", ground: "The Quarry",
        pitch: "flat", wx: "Sunny", arch: "express", mult: 1.12, captFlavour: "enforcer" },
      beats: [
        function (ctx) {
          return s("The Gaffer", "gaffer-serious",
            "Blackstone Ramblers. Semi-pro money, two quicks who've played first-class cricket, and a fixture list they treat as a formality. " +
            "This is the strongest side we've met. I'd rather you knew that walking in than found out at 30 for 4.");
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts();
          var evid = [];
          if (f.ducks.length) evid.push(f.ducks.map(nmShort).join(" and ") + " out for nought");
          if (f.myW >= 8) evid.push("eight-plus wickets gone");
          if (!f.win) evid.push("beaten " + score(f));
          var rough = !f.win || evid.length > 0;
          var intro = !f.win
            ? "That's the first real one. " + evid.join(", ") + ". The scorebook doesn't do mercy and neither does the league table."
            : (rough ? "A win with teeth marks in it — " + evid.join(", ") + ". Won ugly is still won, but the wobble was real." :
              "You walked into the hardest fixture on the card and came out clean: " + score(f) + ". I'll say one thing and then never again: that was managed well.");
          if (!rough) return s("The Gaffer", "gaffer-laugh", intro);
          var phil = ctx.save.philosophy ? " You told me in the prologue this club stood for " + ctx.save.philosophy.label.toLowerCase() + ". This is where that word costs something." : "";
          return s("The Gaffer", "gaffer-serious", intro + phil + " So — how do we respond? There's no correct answer on this card. Only yours.",
            [
              { t: "Call the room together tonight — front it as one voice", fx: function (c) { c.rapport("dressingRoom", 3); c.rapport("gaffer", 1); c.choose("blackstone", "response", "rally"); } },
              { t: "A hard week: standards, fitness, fielding until dark", fx: function (c) { c.rapport("dressingRoom", -2); c.rapport("gaffer", 3); c.choose("blackstone", "response", "standards"); } },
              { t: "Absorb it quietly — no speeches, next match is the answer", fx: function (c) { c.rapport("captain", 2); c.choose("blackstone", "response", "quiet"); } },
              { t: "Change the side — someone pays for that card", fx: function (c) { c.rapport("dressingRoom", -4); c.choose("blackstone", "response", "axe"); } }
            ]);
        }
      ]
    },
    {
      key: "kestrel", title: "Chapter 7 — The Captain's Side", tag: "Form Is a Fact",
      opp: { id: "club_kestrel", nm: "Kestrel Park CC", city: "Kestrel Park", ground: "The Aviary",
        pitch: "green", wx: "Overcast", arch: "gloveman", mult: 1.02, captFlavour: "wall" },
      beats: [
        function (ctx) {
          var cap = ctx.cast("captain");
          var runs = ctx.playerScores(cap.nm, 3);
          var line = runs.length
            ? "his last scores read " + runs.map(function (r) { return r.r + (r.out ? "" : "*"); }).join(", ")
            : "the book has nothing on him yet this summer";
          return s("The Gaffer", "gaffer-serious",
            "Your captain. " + cap.nm + " — " + line + ". I don't deal in vibes, I deal in columns, and that's the column. " +
            "The armband weighs more when the bat's quiet. What's your move?",
            [
              { t: "Back him publicly — the armband stays, no discussion", fx: function (c) { c.rapport("captain", 5); c.choose("kestrel", "captain", "back"); } },
              { t: "Keep him captain, redistribute the pressure — drop him down the order", fx: function (c) { c.rapport("captain", 1); c.choose("kestrel", "captain", "redistribute"); } },
              { t: "A temporary rest from the armband — one match, framed as such", fx: function (c) { c.rapport("captain", -3); c.choose("kestrel", "captain", "temporary"); } },
              { t: "Replace him — form is a fact and so is the table", fx: function (c) { c.rapport("captain", -6); c.choose("kestrel", "captain", "replace"); } },
              { t: "Create a leadership group — share the weight formally", fx: function (c) { c.rapport("captain", 2); c.rapport("dressingRoom", 2); c.choose("kestrel", "captain", "group"); } }
            ]);
        },
        { kind: "match" },
        function (ctx) {
          var cap = ctx.cast("captain"), pick = ctx.choice("kestrel", "captain");
          var actual = ctx.lastConfirmedCaptain();
          var kept = actual === cap.nm;
          var said = (pick === "back" || pick === "redistribute" || pick === "group");
          var line;
          if (said && kept) line = "You said you'd back " + nmShort(cap.nm) + " and the team sheet agreed with your mouth. Players notice when those two match.";
          else if (said && !kept) line = "You told me you'd back " + nmShort(cap.nm) + " — then the sheet went up with " + (actual ? nmShort(actual) : "another name") + " as captain. I manage the cricket; you'll manage the conversation that's coming.";
          else if (!said && kept) line = "You talked about taking the armband off " + nmShort(cap.nm) + ", then handed it straight back. Mercy or nerves — he'll wonder which. So will the room.";
          else line = "You said it and you did it: " + (actual ? nmShort(actual) : "a new man") + " led the side. Clean. Costly, maybe, but clean.";
          var f = ctx.facts();
          return s("The Gaffer", f.win ? "gaffer" : "gaffer-serious", score(f) + ". " + line);
        }
      ]
    },
    {
      key: "harrowgate", title: "Chapter 8 — The Qualifier", tag: "The Right Player Exists",
      opp: { id: "club_harrowgate", nm: "Harrowgate CC", city: "Harrowgate", ground: "Spa Ground",
        pitch: "dusty", wx: "Sunny", arch: "wizard", mult: 1.08, captFlavour: "professor" },
      beats: [
        function (ctx) {
          var per = ctx.peripheralForSpin();
          return s("The Gaffer", "gaffer",
            "Win this and the Crown Ground has to open its gates. Harrowgate bowl spin from both ends on a dust bowl — that's not a scouting report, it's a religion. " +
            (per ? "One column worth your eyes: " + per.nm + " — " + per.picks + " selection" + (per.picks === 1 ? "" : "s") + " all summer, and the best numbers against spin in the squad. I'm not picking your side. I'm pointing at a page." :
              "Look down your own card for who actually plays the turning ball — the answer isn't always the name you'd expect.") +
            " Sometimes the right player for the biggest day is the one who's spent all season watching it.");
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts();
          return s("The Gaffer", f.win ? "gaffer-laugh" : "gaffer-serious",
            score(f) + ". " + (f.win
              ? "That's qualification. The Crown Ground can't pretend we don't exist any more. Enjoy tonight; Thorne will have started planning by breakfast."
              : "Not this time. The fixture stands whenever we've earned it again — the door doesn't close, it just gets heavier."));
        }
      ]
    },
    {
      key: "gafferthorne", title: "Chapter 9 — Gaffer and Thorne", tag: "Two Versions",
      opp: null,
      beats: [
        function (ctx) {
          return s("Margaret Hobb — club secretary", "npc:MH",
            "You asked about the scorebook. Marylebone, 2006: R. Thorne captain, and your Gaffer listed as playing assistant — that's an old term for the man who does the selecting the captain doesn't want his fingerprints on. The last page of that season is torn out. I've never known him tear a page in his life.");
        },
        function (ctx) {
          return s("The Gaffer", "gaffer-serious",
            "So you've seen the book. Fine. I was Reggie Thorne's assistant for six seasons, and his friend for five of them. The final that year, there was a selection call — a kid who'd earned his spot against a name who sold memberships. Reggie wanted the name. I picked the kid, because somebody had let me hold the pen that week. We lost the final by four runs. He's never once asked me whether the kid was the right call. That's the whole story.");
        },
        function (ctx) {
          return s("Reggie Thorne", "thorne",
            "He's told you his version? Sweet. Here's the ledger's version: it was MY final, MY club, and he changed MY team sheet an hour before the toss without a word to me. The kid dropped the catch that lost it — you can look that up. He remembers holding the pen. He forgets whose name was on the trophy engraving they'd already half-finished. We were friends. Then he decided being right mattered more.");
        },
        function (ctx) {
          var warm = ctx.save.rapport.gaffer >= 58;
          return s("The Gaffer", "gaffer",
            (warm ? "You've dealt straight with me all summer, so I'll deal straight back: " : "") +
            "he's not lying, you know. Neither am I. Two men can carry the same afternoon out of a ground and never once be describing the same match. What do you want to do with it?",
            [
              { t: "“Did you ever tell him the kid was your mistake to make — not your apology to give?”", fx: function (c) { c.rapport("gaffer", 3); c.choose("gafferthorne", "stance", "press"); } },
              { t: "Let it lie — it's their history, your fixture list", fx: function (c) { c.choose("gafferthorne", "stance", "lie"); } },
              { t: "“At the Crown Ground, you two talk. Before or after, but you talk.”", fx: function (c) { c.rapport("gaffer", 1); c.rapport("captain", 0); c.choose("gafferthorne", "stance", "broker"); } }
            ]);
        }
      ]
    },
    {
      key: "crown", title: "Chapter 10 — The Crown Ground", tag: "He Knows Everything",
      opp: { id: "club_crown", nm: "Crown Ground XI", city: "The Crown Ground", ground: "The Crown Ground",
        pitch: "flat", wx: "Sunny", arch: "rock", mult: 1.18, captFlavour: "talisman", boss: true },
      beats: [
        function (ctx) {
          var prep = ctx.thornePrep();
          return s("The Gaffer", "gaffer-serious",
            "Thorne's staff have pulled every card you've filled in this summer. On his whiteboard, verbatim: " + prep.join(" ") +
            " He's built his plan around everything you've already done. Good. Let him play your past. You manage what happens next.");
        },
        { kind: "match" },
        function (ctx) {
          var f = ctx.facts();
          if (f.win) return s("Reggie Thorne", "thorne",
            score(f) + ". At MY ground. " + (f.topNm ? nmShort(f.topNm) + " with " + f.topR + " — I had a plan for him, you know. I had a plan for all of it. " : "") +
            "Twenty years I've watched managers arrive with a philosophy and leave with an excuse. You appear to have arrived with a club. … Tell your Gaffer the last page of that scorebook is in my desk. He can come and read it whenever he finds the nerve.");
          return s("Reggie Thorne", "thorne",
            score(f) + ". " + (f.op - f.my <= 25 && f.op > f.my ? "Closer than my staff promised me it would be — I'll be having a word about that." : "About what the whiteboard predicted, give or take your batting.") +
            " The fixture stands whenever you've earned it again. I do hope you come back. Winters are dull when nobody's coming for you.");
        }
      ]
    }
  ];

  // ---- epilogue variants (chapter 11) --------------------------------------
  function epilogueScenes(ctx) {
    var v = (ctx.save.epilogue || {}).variant || "victory";
    var out = [];
    if (v === "victory" || v === "loyalty") {
      out.push(s("The Gaffer", "gaffer-laugh",
        "The Crown Ground, taken. I've been in this game since before you owned long trousers and I have never once said what I'm about to say: thank you. " +
        (v === "loyalty" ? "And you did it with the squad that started the summer — every name on that first table still on the last one. That's rarer than the trophy. " : "") +
        "England is yours. The Circuit map has five more flags on it — and the academy here will take our calls now."));
      out.push(s("Reggie Thorne", "thorne",
        "One line for the record: the kid dropped the catch, but the Gaffer was right to pick him. Twenty years to say one sentence. Don't wait twenty years to say yours. Now get off my ground — you've a map to see to."));
    } else if (v === "narrow") {
      out.push(s("The Gaffer", "gaffer-serious",
        "That close. CLOSE is a fact with two faces: it proves we belong on that ground, and it proves belonging isn't enough. The fixture stands. We patch what their plan found, and we go back. This club fails forward or it doesn't bother failing."));
    } else if (v === "heavy") {
      out.push(s("The Gaffer", "gaffer-serious",
        "No varnish: they were better, everywhere, all day. Right. Now we know the size of it. Nobody hides, nobody quits, and nobody mentions moral victories in my pavilion — we weren't within a mile of one. Rebuild, requalify, return. In that order."));
    } else if (v === "damaged") {
      out.push(s("The Gaffer", "gaffer-serious",
        "We lost, and worse — we lost as strangers. Half that dressing room found out my decisions from a team sheet this summer. That's on both of us. Before we talk about Thorne again, we repair THIS room. The Crown Ground isn't going anywhere. Neither am I, unless you'd rather I did."));
    }
    return out;
  }

  return { CHAPTERS: CHAPTERS, PHILOSOPHIES: PHILOSOPHIES, epilogueScenes: epilogueScenes, scene: s };
})();
