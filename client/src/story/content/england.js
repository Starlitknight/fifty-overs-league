/* story/content/england — the England storylet pack.
 * Converted from the First Summer's authored chapters into conditional,
 * reusable units. Nothing here fires in a fixed order; everything quotes
 * only real saved facts and withdraws when the facts are missing.
 */
(function () {
  var S = FOC.storylets;
  function sc(sp, face, tx, choices) { return { sp: sp, face: face, tx: tx, choices: choices || null }; }
  function nmS(nm) { return nm ? String(nm).split(" ").slice(-1)[0] : ""; }

  // ---- opening pair (once, early) ------------------------------------------
  S.register({
    id: "openers-talk", on: "lineup", cast: "gaffer", weight: 5, maxUses: 1,
    when: function (v2, api) { return api.userMatches() === 1; },
    scene: function (v2, api) {
      var op = api.confirmedOpeners(); if (!op) return null;
      return sc("The Gaffer", "gaffer",
        "First card of the season, and you've given the new ball's first forty balls to " + op[0] + " and " + op[1] + ". " +
        "Right or wrong isn't the point yet — on purpose is the point. The book will tell us the rest.");
    }
  });

  // ---- conditions dilemma (repeatable, green tops) --------------------------
  S.register({
    id: "conditions-green", on: "preview", cast: "gaffer", weight: 4, cooldown: 4,
    when: function (v2, api) {
      var f = api.nextUserFixture();
      return f && api.fixturePitch(f) === "green" && api.userMatches() >= 1;
    },
    scene: function (v2, api) {
      var f = api.nextUserFixture(); if (!f) return null;
      var condNote = v2.story.notes["role:prospect"] === "conditions selection"
        ? " And a note from your own book: you told " + (api.castName("prospect") || "the prospect") + " he was a conditions player. This is the condition."
        : "";
      return sc("The Gaffer", "gaffer-serious",
        api.clubName(f) + " on a green top. Same dilemma as ever, and it never gets friendlier: the extra seamer shortens your batting, the balanced card leaves overs to part-timers. " +
        "There's no right answer, only your answer — and the scorebook keeps them all." + condNote);
    }
  });

  // ---- the prospect asks (evidence, not potential) --------------------------
  S.register({
    id: "prospect-asks", on: "week", cast: "prospect", weight: 4, maxUses: 1, priority: "urgent",
    when: function (v2, api) {
      var kid = api.castName("prospect");
      return kid && api.userMatches() >= 2 && api.selections(kid) === 0 && api.activePromises().length === 0;
    },
    scene: function (v2, api) {
      var kid = api.castName("prospect"); if (!kid) return null;
      return sc(kid, "player:ar",
        "Boss — " + api.userMatches() + " matches, and my name hasn't been on a sheet yet. I'm not asking you to rate me. I'm asking what I'd have to show you.",
        [
          { t: "Promise him a start within two matches", fx: function (v2b, apiB) { apiB.makePromise("prospect", kid + " starts one of the next two matches", 2); apiB.rapport("dressingRoom", 3); } },
          { t: "“A defined role: conditions player. Green top or dust bowl, you're in the conversation.”", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", 1); apiB.note("prospect", "conditions selection"); } },
          { t: "“No promises. Selection is earned in the Lab and at training.”", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", -2); } }
        ]);
    }
  });

  // ---- captain's bat goes quiet ---------------------------------------------
  S.register({
    id: "captain-form", on: "week", cast: "captain", weight: 4, cooldown: 5,
    when: function (v2, api) {
      var runs = api.captainLastScores(3);
      return runs.length >= 3 && runs.every(function (r) { return r.r < 25; });
    },
    scene: function (v2, api) {
      var cap = api.castName("captain"), runs = api.captainLastScores(3);
      if (!cap || runs.length < 3) return null;
      return sc("The Gaffer", "gaffer-serious",
        cap + "'s last scores read " + runs.map(function (r) { return r.r + (r.out ? "" : "*"); }).join(", ") + ". I deal in columns, and that's the column. The armband weighs more when the bat's quiet — your move, or no move at all.",
        [
          { t: "Back him publicly — no discussion", fx: function (v2b, apiB) { apiB.rapport("captain", 5); apiB.flag("captBacked", 1); } },
          { t: "Keep the armband, drop him down the order", fx: function (v2b, apiB) { apiB.rapport("captain", 1); apiB.flag("captMoved", 1); } },
          { t: "Have the hard conversation about a rest", fx: function (v2b, apiB) { apiB.rapport("captain", -3); apiB.flag("captWarned", 1); } }
        ]);
    }
  });
  // the callback both ways — a later week reads the sheet against the word
  S.register({
    id: "captain-callback", on: "userMatch", cast: "gaffer", weight: 6, maxUses: 2,
    when: function (v2, api) {
      return (v2.flags.captBacked || v2.flags.captWarned || v2.flags.captMoved) && api.lastConfirmedCaptain();
    },
    scene: function (v2, api) {
      var cap = api.castName("captain"), actual = api.lastConfirmedCaptain();
      if (!cap || !actual) return null;
      if (v2.flags.captMoved) {
        delete v2.flags.captMoved;
        var evs = (v2.history.events || []).filter(function (e) { return e.t === "LineupConfirmed"; });
        var lastXi = evs.length ? evs[evs.length - 1].xi : [];
        var pos = lastXi.indexOf(cap) + 1;
        if (!pos) return null;
        return sc("The Gaffer", "gaffer",
          "You said you'd take the pressure off " + nmS(cap) + " by moving him down — the sheet has him at " + pos + ". " +
          (pos >= 5 ? "Word and card agree. He noticed; the room noticed." : "That's still top-order pressure with extra steps. He noticed that too."));
      }
      var kept = actual === cap;
      var backed = !!v2.flags.captBacked;
      delete v2.flags.captBacked; delete v2.flags.captWarned;
      var line = backed
        ? (kept ? "You said you'd back " + nmS(cap) + " and the sheet agreed with your mouth. Players notice when those two match."
                : "You said you'd back " + nmS(cap) + " — then the armband went to " + nmS(actual) + ". I'll manage the cricket; you manage the conversation that's coming.")
        : (kept ? "After the hard words, you handed " + nmS(cap) + " the armband anyway. Mercy or nerves — the room will wonder which."
                : "You said it and did it: " + nmS(actual) + " led the side. Clean. Costly, maybe, but clean.");
      return sc("The Gaffer", "gaffer", line);
    }
  });

  // ---- setback response (real defeat, four answers, none correct) -----------
  S.register({
    id: "setback", on: "userMatch", cast: "gaffer", weight: 6, cooldown: 4,
    when: function (v2, api) {
      var f = api.lastUserFacts();
      return f && !f.win && !f.tie && (f.op - f.my >= 60 || f.myW >= 9 || api.userLossStreak() >= 2);
    },
    scene: function (v2, api) {
      var f = api.lastUserFacts(); if (!f) return null;
      var phil = v2.user.philosophy ? " You told me this club stood for " + v2.user.philosophy.label.toLowerCase() + ". This is where that word costs something." : "";
      return sc("The Gaffer", "gaffer-serious",
        "Beaten " + f.my + " to " + f.op + ", and not by accident." + phil + " How do we respond? No answer on this card is the correct one.",
        [
          { t: "Call the room together tonight", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", 3); } },
          { t: "Speak privately with the captain first", fx: function (v2b, apiB) { apiB.rapport("captain", 3); } },
          { t: "Review the scorecards before saying a word", fx: function (v2b, apiB) { apiB.rapport("gaffer", 3); } },
          { t: "Give them space — next match is the answer", fx: function (v2b, apiB) { apiB.rapport("captain", 1); } }
        ]);
    }
  });

  // ---- being studied (real pattern, stated as fact) -------------------------
  S.register({
    id: "studied", on: "preview", cast: "gaffer", weight: 3, cooldown: 6,
    when: function (v2, api) {
      var pat = api.patterns();
      return api.userMatches() >= 3 && pat && (pat.paceW + pat.spinW) >= 8;
    },
    scene: function (v2, api) {
      var pat = api.patterns(), f = api.nextUserFixture();
      if (!pat || !f) return null;
      return sc("The Gaffer", "gaffer-serious",
        api.clubName(f) + " subscribe to the Argus. What they'll have highlighted: your wickets are " + pat.paceW + " pace, " + pat.spinW + " spin" +
        (pat.topBat ? "; " + pat.topBat.nm + " has " + pat.topBat.runs + " of your runs" : "") +
        ". I'm not telling you to change. I'm telling you they know.");
    }
  });

  // ---- reporter headline (varies, quotes the card) --------------------------
  S.register({
    id: "headline", on: "userMatch", cast: "reporter", weight: 4, cooldown: 2,
    when: function (v2, api) { return !!api.lastUserFacts(); },
    scene: function (v2, api) {
      var f = api.lastUserFacts(); if (!f) return null;
      var variants = f.tie
        ? ["NOTHING BETWEEN THEM — A TIE, AND BOTH SIDES EARNED IT", "SCORES LEVEL: THE RAREST RESULT IN THE BOOK"]
        : f.win
        ? [(f.topNm ? nmS(f.topNm).toUpperCase() + " " + f.topR + " SETTLES IT" : "PROFESSIONAL AFTERNOON FOR THE NEW CLUB"),
           "PROVISIONAL? THE TABLE DISAGREES"]
        : [(f.oppTopNm ? nmS(f.oppTopNm).toUpperCase() + "'S " + f.oppTopR + " TOO GOOD" : "A HARD LESSON, PLAINLY TAUGHT"),
           "QUESTIONS, AND SATURDAY KEEPS ASKING THEM"];
      var pick = variants[FOC.rng.int(v2.rng, "storylets", variants.length, "headline")];
      api.headline(pick);
      return sc("Sam Whitlow — the Argus", "npc:SW",
        "Tomorrow's back page: “" + pick + "”. I print what the scorebook prints — you'll learn to like me in the good weeks.");
    }
  });

  // ---- Thorne needles — earned, not scheduled -------------------------------
  S.register({
    id: "thorne-notice", on: "userMatch", cast: "thorne", weight: 3, cooldown: 5,
    when: function (v2, api) {
      var f = api.lastUserFacts();
      return f && f.win && api.userPosition() <= 4;
    },
    scene: function (v2, api) {
      var f = api.lastUserFacts(); if (!f) return null;
      return sc("Reggie Thorne", "thorne",
        api.userPosition() + (api.userPosition() === 1 ? "st" : api.userPosition() === 2 ? "nd" : api.userPosition() === 3 ? "rd" : "th") +
        " in the table. My scouts filed your scorecard — " + f.my + " for " + f.myW + ". Adequate. The Crown Ground doesn't play adequate.");
    }
  });

  // ---- Gaffer–Thorne clues: order shuffled per career, never guaranteed -----
  function gtOrder(v2) {
    if (!v2.story.gtOrder) v2.story.gtOrder = FOC.rng.shuffle(v2.rng, "storylets", ["gt-scorebook", "gt-photo", "gt-torn-page"], "gt-order");
    return v2.story.gtOrder;
  }
  function gtNext(v2) {
    var order = gtOrder(v2);
    for (var i = 0; i < order.length; i++) if (!(v2.story.seen[order[i]])) return order[i];
    return null;
  }
  var GT = {
    "gt-scorebook": sc("Margaret Hobb — club secretary", "npc:MH",
      "Filing, I found a Marylebone scorebook, 2006. Two names in one handwriting: R. THORNE, capt — and in the assistants' line, a name I believe you know. I don't gossip. I file."),
    "gt-photo": sc("Sam Whitlow — the Argus", "npc:SW",
      "Archive room turned up a photograph: Thorne lifting a plate trophy, and at the frame's edge, carrying the kit bags, a younger version of a face you see every day. Neither man has ever mentioned it in print."),
    "gt-torn-page": sc("Margaret Hobb — club secretary", "npc:MH",
      "The last page of that 2006 scorebook is torn out. I have never known your Gaffer tear a page in his life. Whatever the final of that season says, somebody preferred it unsaid.")
  };
  ["gt-scorebook", "gt-photo", "gt-torn-page"].forEach(function (id) {
    S.register({
      id: id, on: "week", cast: "secretary", weight: 2, maxUses: 1,
      when: function (v2, api) { return api.userMatches() >= 2 && gtNext(v2) === id; },
      scene: function (v2) {
        v2.story.gtClues.push(id);
        return GT[id];
      }
    });
  });

  // ---- rapport is read back, not just written --------------------------------
  S.register({
    id: "room-murmurs", on: "week", cast: "captain", weight: 5, cooldown: 6,
    when: function (v2, api) { return (v2.story.rapport.dressingRoom || 50) <= 38; },
    scene: function (v2, api) {
      var cap = api.castName("captain"); if (!cap) return null;
      return sc(cap, "player:bat",
        "Boss, straight signal from the room: broken promises and cold team sheets are being counted. Nobody's downing tools — but the benefit of the doubt is spent. What you do next gets read closely.",
        [
          { t: "Address the squad and own it", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", 6); } },
          { t: "\u201cResults fix rooms. Nothing else.\u201d", fx: function (v2b, apiB) { apiB.rapport("captain", -2); apiB.flag("hardLine", 1); } }
        ]);
    }
  });
  S.register({
    id: "captain-confides", on: "week", cast: "captain", weight: 3, cooldown: 8, maxUses: 2,
    when: function (v2, api) { return (v2.story.rapport.captain || 50) >= 70; },
    scene: function (v2, api) {
      var cap = api.castName("captain"); if (!cap) return null;
      return sc(cap, "player:bat",
        "Between us: whatever the table says, this room would run through walls for you at the moment. You've backed people in public and told them the truth in private. Keep doing both and we'll carry the rest.");
    }
  });

  // ---- the world reveal: England, the cups, Priya, Thorne ------------------
  S.register({ id: "career-intro-1", on: "_direct", cast: "gaffer", weight: 1,
    scene: function (v2, api) {
      return sc("The Gaffer", "gaffer",
        "Right — the actual landscape. Nine clubs besides us, one league, nine rounds, and every one of them plays whether we watch or not. The Founders Cup is a knockout: lose once and it's over for the year. Finish top four and the Crown Cup lets you in. Nobody waits for us, and I wouldn't have it any other way.");
    } });
  S.register({ id: "career-intro-2", on: "_direct", cast: "peer", weight: 1,
    scene: function (v2, api) {
      var mid = v2.world.peerManagerId, m = mid && v2.world.managersById[mid];
      if (!m) return null;
      var pc = m.clubId && v2.world.clubsById[m.clubId];
      return sc(m.name + (pc ? " — " + pc.name : ""), "npc:PR",
        "We founded clubs the same spring, you and I, which makes us the two newest names on the fixture list. I keep a photograph of an empty trophy cabinet on my desk. One of us fills theirs first. No hard feelings either way — well. Few hard feelings.");
    } });
  S.register({ id: "career-intro-3", on: "_direct", cast: "thorne", weight: 1,
    scene: function (v2, api) {
      return sc("Reggie Thorne", "thorne",
        "The provisional club. I chair the committee that granted you that word, and the committee that can retract it. Finish the season solvent and respectable, and we'll talk again. Fail, and the fixture list simply closes over you like water. Willowmere first, I believe. Do try to be interesting.");
    } });

  // ---- quiet weeks are for working: a real choice on cup-off weeks ----------
  S.register({
    id: "week-focus", on: "week", cast: "gaffer", weight: 6, cooldown: 2,
    when: function (v2, api) {
      var f = api.nextUserFixture();
      return !f;   // no fixture: the week belongs to the manager
    },
    scene: function (v2, api) {
      return sc("The Gaffer", "gaffer",
        "No fixture for us this week. The week doesn't have to be empty — where do we spend it?",
        [
          { t: "Scout the next opponent properly", fx: function (v2b, apiB) {
              var nf = null, w = v2b.week + 1;
              while (!nf && w <= 15) { nf = FOC.competitions.userFixture(v2b, w); w++; }
              if (nf) {
                var oppId = nf.homeId === v2b.user.clubId ? nf.awayId : nf.homeId;
                var opp = v2b.world.clubsById[oppId];
                var mgr2 = opp.managerId && v2b.world.managersById[opp.managerId];
                apiB.headline("SCOUTING FILE: " + opp.name.toUpperCase() + " — form " + ((opp.form || []).slice(-5).join("") || "unknown") +
                  ", " + opp.pitch + " pitch at " + opp.ground + (mgr2 ? ", " + mgr2.name + " favours " + opp.tendency + " cricket" : ""));
                v2b.flags.scouted = oppId;
              }
            } },
          { t: "A long lunch with the captain", fx: function (v2b, apiB) { apiB.rapport("captain", 4); } },
          { t: "An afternoon at the academy nets", fx: function (v2b, apiB) { apiB.rapport("dressingRoom", 2); apiB.note("prospect", v2b.story.notes["role:prospect"] || "developing role"); } }
        ]);
    }
  });

  // ---- the peer manager's parallel career -----------------------------------
  S.register({
    id: "peer-milestone", on: "week", cast: "peer", weight: 3, cooldown: 4,
    when: function (v2, api) { return !!api.peerNote(); },
    scene: function (v2, api) {
      var note = api.peerNote(true); if (!note) return null;
      return sc(note.nm, "npc:PR", note.txt);
    }
  });

  // ---- a transfer offer for one of yours ------------------------------------
  S.register({
    id: "transfer-offer", on: "offer", cast: "secretary", weight: 10, priority: "urgent",
    scene: function (v2, api, ref) {
      var o = ref.data; if (!o || !o.playerName) return null;
      return sc("Margaret Hobb — club secretary", "npc:MH",
        o.buyerName + " have lodged " + Math.round(o.fee / 1000) + "k for " + o.playerName + ". In writing, properly stamped. What do I send back?",
        [
          { t: "Refuse — not for sale", fx: function (v2b, apiB) { apiB.refuseOffer(ref.data); } },
          { t: "Accept the fee" + (api.canSell() ? "" : " (league rules block mid-season sales — noted for the window)"), fx: function (v2b, apiB) { apiB.acceptOffer(ref.data); } }
        ]);
    }
  });

  // ---- an emergent talent somewhere in the world ----------------------------
  S.register({
    id: "talent-noticed", on: "week", cast: "gaffer", weight: 2, maxUses: 2, cooldown: 6,
    when: function (v2, api) { return !!api.talentFact(); },
    scene: function (v2, api) {
      var tf = api.talentFact(); if (!tf) return null;
      return sc("The Gaffer", "gaffer",
        "Worth a line in your notebook: " + tf.nm + " at " + tf.club + " — " + tf.evidence + ". I'm not telling you what he'll become. I'm telling you what he's done.");
    }
  });
})();
