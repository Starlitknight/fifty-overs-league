/* story/engine — the campaign state machine.
 *
 * Owns: beat progression, the ctx object handed to content beats, the
 * promise ledger, fail-forward losses (a defeat never ends the campaign —
 * the fixture stands and the story continues), and the write-once epilogue
 * record. All story effects live in the campaign save; player skills are
 * never touched.
 */
FOC.game = (function () {
  var U = FOC.util, E = FOC.events, A = FOC.adapter, EN = FOC.england;

  var _save = null;

  function save() {
    if (!_save) {
      _save = FOC.save.load(A.scope());
      bootstrap(_save);
    }
    return _save;
  }
  function persist() { if (_save) FOC.save.persist(_save); }

  function bootstrap(s) {
    if (!A.engineReady()) return;
    FOC.ids.ensurePlayers(s, A.players());
    if (!s.flags.founded) {
      s.flags.founded = 1;
      s.flags.foundingRoster = A.players().map(function (p) { return p.name; });
      E.emit(s, "ClubFounded", { nm: (A.team() || {}).name });
      E.emit(s, "RegionEntered", { region: "england" });
      FOC.save.persist(s);
    }
  }

  function chapter(s) { return EN.CHAPTERS[s.ch] || null; }
  function chapterByKey(key) {
    var hit = null;
    EN.CHAPTERS.forEach(function (c) { if (c.key === key) hit = c; });
    return hit;
  }

  // ---- the ctx handed to every content beat --------------------------------
  function agg(p, k) { return (p && typeof p[k] === "number") ? p[k] : 0; }

  function campaignLineups(s) {
    return E.ofType(s, "LineupConfirmed").filter(function (e) { return e.data.context === "campaign"; });
  }

  function makeCtx(s) {
    var ctx = { save: s, U: U };
    ctx.clubName = function () { return (A.team() || {}).name || "the club"; };
    ctx.pid = function (p) { return FOC.ids.playerId(s, p); };
    ctx.emit = function (t, d) { E.emit(s, t, d); persist(); };
    ctx.choose = function (chKey, k, v) { (s.choices[chKey] = s.choices[chKey] || {})[k] = v; persist(); };
    ctx.choice = function (chKey, k) { return (s.choices[chKey] || {})[k]; };
    ctx.rapport = function (k, d) { s.rapport[k] = U.clamp((s.rapport[k] || 50) + d, 0, 100); persist(); };
    ctx.setCast = function (role, p) {
      if (!p) return;
      s.cast[role] = ctx.pid(p); s.castNames[role] = p.name; persist();
    };
    ctx.cast = function (role) { return { pid: s.cast[role], nm: s.castNames[role] || "—" }; };

    ctx.groups = function () {
      var ps = A.players(), g = { bats: 0, keepers: 0, ars: 0, bowlers: 0 };
      ps.forEach(function (p) {
        if (!p) return;
        if (p.keeper) g.keepers++;
        else if (p.bowlType && !A.isPartTimer(p)) g.bowlers++;
        else if (p.bowlType) g.ars++;
        else g.bats++;
      });
      return g;
    };
    ctx.captainCandidates = function () {
      var ps = A.players().slice(), out = [], used = {};
      function take(p, why) { if (p && !used[p.name]) { used[p.name] = 1; out.push({ p: p, nm: p.name, why: why }); } }
      var byCapt = ps.slice().sort(function (a, b) { return (b.capt || 0) - (a.capt || 0); });
      take(byCapt[0], "the squad's top leadership marks");
      var byAge = ps.slice().sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
      take(byAge[0] && used[byAge[0].name] ? byAge[1] : byAge[0], "the senior head — " + ((byAge[0] && used[byAge[0].name] ? byAge[1] : byAge[0]) || {}).age + " years old");
      var byBat = ps.slice().sort(function (a, b) { return agg(b, "bat") - agg(a, "bat"); });
      var bb = byBat[0]; if (bb && used[bb.name]) bb = byBat[1]; if (bb && used[bb.name]) bb = byBat[2];
      take(bb, "the heaviest bat in the squad");
      return out.slice(0, 3);
    };
    ctx.pickSenior = function () {
      var ps = A.players().slice().sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
      return ps[0];
    };
    ctx.pickProspect = function () {
      var ps = A.players().slice().sort(function (a, b) { return (a.age || 0) - (b.age || 0); });
      return ps[0];
    };
    ctx.pickFringe = function () {
      var t = A.team(); if (!t) return null;
      var inXI = {};
      try { (typeof pickXI === "function" ? pickXI(t) : []).forEach(function (p) { inXI[p.name] = 1; }); } catch (e) {}
      var out = A.players().filter(function (p) { return p && !inXI[p.name]; })
        .sort(function (a, b) { return agg(b, "bat") - agg(a, "bat"); });
      return out[0] || A.players()[A.players().length - 1];
    };

    ctx.confirmedOpeners = function () {
      try {
        if (App.orders && App.orders.saved && App.orders.batOrder && App.orders.batOrder.length >= 2)
          return [App.orders.batOrder[0], App.orders.batOrder[1]];
      } catch (e) {}
      return null;
    };
    ctx.facts = function (back) {
      var m = s.matches[s.matches.length - 1 - (back || 0)];
      if (!m) return null;
      var f = U.deep(m.facts); f.win = m.win;   // beats read the result off the facts
      return f;
    };
    ctx.selectionCount = function (pidOrNm) {
      // accept a stable id or a display name; sheets store names
      var nm = pidOrNm;
      if (s.idmap) {
        for (var k in s.idmap) {
          if (s.idmap[k] === pidOrNm) { nm = k.split("|")[1]; break; }
        }
      }
      var n = 0;
      campaignLineups(s).forEach(function (e) {
        if (e.data.xi.indexOf(nm) >= 0) n++;
      });
      return n;
    };
    ctx.makePromise = function (pid, txt, dueMatches) {
      var pr = { id: "pr_" + (s.promises.length + 1), pid: pid, nm: s.castNames.fringe, txt: txt,
        madeCh: s.ch, dueMatches: dueMatches, left: dueMatches, status: "active" };
      s.promises.push(pr);
      E.emit(s, "PromiseMade", { id: pr.id, pid: pid, txt: txt, due: dueMatches });
      persist();
      return pr;
    };
    ctx.activePromises = function () {
      return s.promises.filter(function (p) { return p.status === "active"; });
    };
    ctx.patterns = function () {
      var paceW = 0, spinW = 0, runs = {}, total = 0;
      s.matches.forEach(function (m) {
        paceW += m.facts.paceW || 0; spinW += m.facts.spinW || 0;
        (m.facts.batLines || []).forEach(function (b) { runs[b.nm] = (runs[b.nm] || 0) + b.r; total += b.r; });
      });
      var topBat = null;
      Object.keys(runs).forEach(function (nm) { if (!topBat || runs[nm] > topBat.runs) topBat = { nm: nm, runs: runs[nm] }; });
      var lus = campaignLineups(s), oc = {};
      lus.forEach(function (e) { var k = e.data.xi.slice(0, 2).join(" & "); oc[k] = (oc[k] || 0) + 1; });
      var commonOpeners = null;
      Object.keys(oc).forEach(function (k) { if (oc[k] === lus.length && lus.length > 1) commonOpeners = k; });
      return { paceW: paceW, spinW: spinW, topBat: topBat,
        dependence: (topBat && total) ? Math.round(100 * topBat.runs / total) : 0,
        commonOpeners: commonOpeners };
    };
    ctx.playerScores = function (nm, n) {
      var out = [];
      s.matches.forEach(function (m) {
        (m.facts.batLines || []).forEach(function (b) { if (b.nm === nm) out.push({ r: b.r, b: b.b, out: b.out }); });
      });
      return out.slice(-(n || 3));
    };
    ctx.lastConfirmedCaptain = function () {
      var lus = campaignLineups(s);
      return lus.length ? lus[lus.length - 1].data.captain : null;
    };
    ctx.peripheralForSpin = function () {
      var counts = {};
      campaignLineups(s).forEach(function (e) { e.data.xi.forEach(function (nm) { counts[nm] = (counts[nm] || 0) + 1; }); });
      var ps = A.players().filter(function (p) { return p && !p.keeper; });
      var median = campaignLineups(s).length / 2;
      var per = ps.filter(function (p) { return (counts[p.name] || 0) <= median; })
        .sort(function (a, b) { return ((b.skills || {}).vsSpin || 0) - ((a.skills || {}).vsSpin || 0); })[0];
      return per ? { nm: per.name, picks: counts[per.name] || 0 } : null;
    };
    ctx.thornePrep = function () {
      var out = [], lus = campaignLineups(s), pat = ctx.patterns();
      if (lus.length) {
        var counts = {};
        lus.forEach(function (e) { e.data.xi.forEach(function (nm) { counts[nm] = (counts[nm] || 0) + 1; }); });
        var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 3)
          .map(function (nm) { return nm.split(" ").slice(-1)[0]; });
        out.push("“Most-picked names: " + top.join(", ") + " — " + lus.length + " team sheets on file.”");
        var op = U.mode(lus.map(function (e) { return e.data.xi.slice(0, 2).join(" & "); }));
        if (op) out.push("“Opening pair: " + op + ".”");
        if (lus.length >= 2) {
          var a = lus[lus.length - 2].data.xi, b = lus[lus.length - 1].data.xi;
          var ch = b.filter(function (nm) { return a.indexOf(nm) < 0; }).length;
          out.push("“Last two sheets: " + ch + " change" + (ch === 1 ? "" : "s") + ".”");
        }
      }
      if (pat.topBat) out.push("“" + pat.topBat.nm + ": " + pat.topBat.runs + " runs — " + pat.dependence + "% of their output. Remove him, remove them.”");
      var wk = {}, bw = null;
      s.matches.forEach(function (m) { (m.facts.bowlLines || []).forEach(function (l) { wk[l.nm] = (wk[l.nm] || 0) + l.w; }); });
      Object.keys(wk).forEach(function (nm) { if (!bw || wk[nm] > wk[bw]) bw = nm; });
      if (bw) out.push("“" + bw + " leads their attack: " + wk[bw] + " wickets.”");
      if (!out.length) out.push("“No sheets on file. Nobody arrives at my ground without a paper trail — except, apparently, you.”");
      return out;
    };
    return ctx;
  }

  // ---- interstitials (serializable, rebuilt at render time) ----------------
  function interstitial(s) {
    var q = (s.flags.inter || []);
    if (!q.length) return null;
    var it = q[0], ctx = makeCtx(s);
    if (it.kind === "loss") {
      var f = ctx.facts();
      return EN.scene("The Gaffer", "gaffer-serious",
        "Beaten, " + (f ? f.my + "/" + f.myW + " against " + f.op + "/" + f.opW : "and it stings") + ". " +
        (f && f.oppTopNm ? f.oppTopNm + "'s " + f.oppTopR + " was the difference. " : "") +
        "The fixture stands — this club fails forward. Patch what they found, pick your XI again, and we go back out.");
    }
    if (it.kind === "promiseFulfilled") {
      return EN.scene(it.nm, "player:bat",
        "You said I'd get my start, and there was my name on the sheet. Whatever happens the rest of the summer — I'll remember which kind of manager you are.");
    }
    if (it.kind === "promiseBroken") {
      return EN.scene(it.nm, "player:bat",
        "Two matches, you said. I counted. Both sheets went up without me. I'm not making a scene — I'm asking what your word costs.",
        [
          { t: "Replace the promise: he starts within the next two, guaranteed", fx: function (c) {
              var pr = { id: "pr_" + (s.promises.length + 1), pid: it.pid, nm: it.nm,
                txt: it.nm + " starts one of the next two campaign matches (replacement promise)",
                madeCh: s.ch, dueMatches: 2, left: 2, status: "active", replacement: 1 };
              s.promises.push(pr);
              E.emit(s, "PromiseMade", { id: pr.id, pid: it.pid, txt: pr.txt, due: 2, replacement: true });
            } },
          { t: "“No new promises. An apology, and the truth: I picked the XI I believed in.”", fx: function (c) {
              c.rapport("dressingRoom", -2);
            } }
        ]);
    }
    return null;
  }
  function popInterstitial(s) { (s.flags.inter || []).shift(); persist(); }

  // ---- beat resolution ------------------------------------------------------
  function currentBeat(s) {
    if (s.status === "complete" && s.ch >= 11) return null;
    if (s.ch >= 11) {
      // epilogue playthrough
      var eps = EN.epilogueScenes(makeCtx(s));
      return s.beat < eps.length ? eps[s.beat] : null;
    }
    var c = chapter(s); if (!c) return null;
    var b = c.beats[s.beat];
    if (!b) return null;
    if (typeof b === "function") { try { return b(makeCtx(s)); } catch (e) { return EN.scene("The Gaffer", "gaffer", "…lost my thread. Carry on."); } }
    return b;   // {kind:'match'}
  }

  function advance(s) {
    if (s.ch >= 11) {
      var eps = EN.epilogueScenes(makeCtx(s));
      s.beat++;
      if (s.beat >= eps.length) {
        if (s.flags.crownWon) s.status = "complete";
        else { s.ch = 10; s.beat = 1; }   // fail forward: the fixture stands — rematch
      }
      persist(); return;
    }
    var c = chapter(s); if (!c) return;
    s.beat++;
    if (s.beat >= c.beats.length) {
      E.emit(s, "ChapterCompleted", { key: c.key });
      s.ch++; s.beat = 0;
    }
    persist();
  }

  function choose(s, i) {
    var b = currentBeat(s);
    // interstitial choices are handled by the UI via chooseInter
    if (!b || !b.choices || !b.choices[i]) return;
    try { b.choices[i].fx(makeCtx(s)); } catch (e) {}
    advance(s);
  }

  // ---- matches --------------------------------------------------------------
  function matchSpec(s) {
    var c = chapter(s); if (!c || !c.opp) return null;
    var spec = U.deep(c.opp);
    spec.chKey = c.key;
    spec.seed = (s.losses[c.key] || 0);   // a rematch meets a re-cut of the same cloth
    spec.wxKeep = spec.wx;
    if (c.key === "bellminster" && s.matches.length) {
      // they read the actual scorebook: counter whichever attack has hurt more
      var pat = makeCtx(s).patterns();
      spec.boost = { skill: (pat.paceW >= pat.spinW) ? "vsPace" : "vsSpin", mult: 1.06 };
    }
    return spec;
  }

  function playMatch(s) {
    var spec = matchSpec(s); if (!spec) return false;
    return A.startMatch(s, spec);
  }

  function scanPromises(s) {
    var lus = campaignLineups(s);
    var lastXI = lus.length ? lus[lus.length - 1].data.xi : [];
    s.promises.forEach(function (pr) {
      if (pr.status !== "active") return;
      if (lastXI.indexOf(pr.nm) >= 0) {
        pr.status = "fulfilled";
        E.emit(s, "PromiseFulfilled", { id: pr.id, pid: pr.pid });
        (s.flags.inter = s.flags.inter || []).push({ kind: "promiseFulfilled", pid: pr.pid, nm: pr.nm });
        var r = s.rapport; r.dressingRoom = U.clamp((r.dressingRoom || 50) + 4, 0, 100);
      } else {
        pr.left--;
        if (pr.left <= 0) {
          pr.status = "broken";
          E.emit(s, "PromiseBroken", { id: pr.id, pid: pr.pid });
          (s.flags.inter = s.flags.inter || []).push({ kind: "promiseBroken", pid: pr.pid, nm: pr.nm });
          var r2 = s.rapport; r2.dressingRoom = U.clamp((r2.dressingRoom || 50) - 5, 0, 100);
        }
      }
    });
  }

  function epilogueVariant(s, win, facts) {
    if (win) {
      var founding = s.flags.foundingRoster || [], now = {};
      A.players().forEach(function (p) { if (p) now[p.name] = 1; });
      var intact = founding.length > 0 && founding.every(function (nm) { return now[nm]; });
      return intact ? "loyalty" : "victory";
    }
    if ((s.rapport.dressingRoom || 50) < 45 || (s.rapport.captain || 50) < 42) return "damaged";
    return (Math.abs((facts.op || 0) - (facts.my || 0)) <= 25) ? "narrow" : "heavy";
  }

  function onMatchDone(tag, win, facts, oppName) {
    var s = save();
    var c = chapter(s);
    var chKey = (tag && tag.key) || (c && c.key);
    if (!chKey) return;
    A.recordMatch(s, chKey, win, facts, oppName);
    scanPromises(s);
    if (chKey === "crown") {
      var v = epilogueVariant(s, win, facts);
      if (!s.epilogue) s.epilogue = { first: v, variant: v, attempts: 1, permanent: true };
      else { s.epilogue.variant = v; s.epilogue.attempts++; }
      if (win) {
        s.flags.crownWon = 1;
        E.emit(s, "RegionalBossDefeated", { region: "england", boss: "Reggie Thorne" });
        // hand the conquest to the wider world: England opens on the Circuit map
        try {
          var g = window.__foGame;
          if (g && g.story) {
            var stT = g.story.state();
            g.story.log(stT, "moment", "The Crown Ground fell — the First Summer campaign is won.");
            g.story.save(stT);
          }
        } catch (e) {}
      }
    }
    if (win) {
      // move past the match beat into the post-match scenes
      s.beat++;
      persist();
    } else {
      if (chKey === "crown") { s.beat++; persist(); }   // ch10 loss still plays Thorne's needle + epilogue
      else (s.flags.inter = s.flags.inter || []).push({ kind: "loss", chKey: chKey });
      persist();
    }
  }

  // list for the hub rail
  function list(s) {
    return EN.CHAPTERS.map(function (c, i) {
      var st = i < s.ch ? "done" : (i === s.ch ? "now" : "locked");
      var rec = null;
      s.matches.forEach(function (m) { if (m.key === c.key) rec = m; });
      return { i: i, key: c.key, title: c.title, tag: c.tag, state: st, hasMatch: !!c.opp,
        result: rec ? { win: rec.win, my: rec.my, op: rec.op, opp: rec.opp, rematch: rec.rematch } : null };
    });
  }

  function init() {
    A.startKeeper(onMatchDone);
  }

  return { save: save, persist: persist, chapter: chapter, chapterByKey: chapterByKey,
    makeCtx: makeCtx, currentBeat: currentBeat, advance: advance, choose: choose,
    matchSpec: matchSpec, playMatch: playMatch, onMatchDone: onMatchDone,
    interstitial: interstitial, popInterstitial: popInterstitial, scanPromises: scanPromises,
    epilogueVariant: epilogueVariant, list: list, init: init,
    _resetForTest: function () { _save = null; } };
})();
