/* ============================================================================
   THE LIVING SEASON — rivalries, board goals, milestones, the promoter's
   wager, the post-match presser, the away-day digest and the end-of-season
   ceremony. One module, and one rule everything in it obeys:

     EVERY FACT IS DERIVED FROM App.results, DETERMINISTICALLY.

   Matches here are played by humans who are sometimes online and bots that
   never are. Nothing in this file requires anyone to be at the keyboard when
   a ball is bowled: rivals are chosen by a pure function of the season,
   wagers settle themselves from the scorecard, milestones are recomputed
   from the record book, and the two genuinely interactive bits (the presser,
   accepting a wager) default to silence with no mechanical penalty. Two
   clients that saw none of the same rounds render the same season.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foLivingSeason) return; window.__foLivingSeason = 1;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function num(x) { return typeof x === "number" && isFinite(x) ? x : 0; }
  function hashS(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function LSbag() { if (!App.ls || typeof App.ls !== "object") App.ls = {}; if (!App.ls.press) App.ls.press = {}; if (!App.ls.wag) App.ls.wag = {}; return App.ls; }
  function myName() { try { return userTeam().name; } catch (e) { return ""; } }
  function seasonNoOf(r) { return r.seasonNo || (App.seasonNo || 1); }
  function ordinal(n) { var v = n % 100; if (v >= 11 && v <= 13) return n + "th"; return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"); }

  // ---------------------------------------------------------------------------
  // The record book: one pass over every result, memoized on results.length.
  // Career lines per player plus the milestone stream, oldest first.
  // ---------------------------------------------------------------------------
  var _bk = null, _bkN = -1, _bkS = -1;
  function book() {
    var res = App.results || [];
    if (_bk && _bkN === res.length && _bkS === (App.seasonNo || 1)) return _bk;
    var car = {}, events = [];
    var MRUNS = [500, 1000, 2500, 5000], MWK = [25, 50, 100, 200], MCAP = [10, 25, 50, 100];
    function C(nm) {
      return car[nm] || (car[nm] = { m: 0, runs: 0, bf: 0, outs: 0, hs: 0, hsb: 0, fifty: 0, hundred: 0, wk: 0, cb: 0, cr: 0, bw: 0, br: 1e9, ff: 0, team: "" });
    }
    function fire(nm, r, txt, big) { events.push({ n: nm, ix: r.ix, s: seasonNoOf(r), rd: r.round, date: r.date, txt: txt, big: !!big, team: C(nm).team }); }
    res.forEach(function (r) {
      if (!r || !r.innings || r.comp === "youth" || r.comp === "friendly") return;
      var seen = {};
      r.innings.forEach(function (inn) {
        if (!inn) return;
        var fieldTeam = inn.batTeam === r.home ? r.away : r.home;
        (inn.bat || []).forEach(function (b) {
          if (!b || !b.p || !(b.b > 0 || b.out)) return;
          var nm = b.p.name, c = C(nm); c.team = inn.batTeam; seen[nm] = 1;
          var pre = c.runs;
          c.runs += num(b.r); c.bf += num(b.b); if (b.out) c.outs++;
          if (b.r > c.hs) { c.hs = b.r; c.hsb = b.b; }
          if (b.r >= 100) { c.hundred++; if (c.hundred === 1) fire(nm, r, "a maiden century — " + b.r + " off " + b.b, 1); else fire(nm, r, "century no. " + c.hundred + " — " + b.r + " off " + b.b, 1); }
          else if (b.r >= 50) { c.fifty++; if (c.fifty === 1) fire(nm, r, "a first career fifty — " + b.r + " off " + b.b); }
          MRUNS.forEach(function (t) { if (pre < t && c.runs >= t) fire(nm, r, t.toLocaleString() + " career runs"); });
        });
        for (var k in (inn.bowlers || {})) {
          var br = inn.bowlers[k]; if (!br) continue;
          var c2 = C(k); c2.team = fieldTeam; seen[k] = 1;
          var preW = c2.wk;
          c2.wk += num(br.w); c2.cb += num(br.b); c2.cr += num(br.r);
          if (br.w > c2.bw || (br.w === c2.bw && br.r < c2.br)) { c2.bw = br.w; c2.br = br.r; }
          if (br.w >= 5) { c2.ff++; fire(k, r, br.w + "/" + br.r + (c2.ff === 1 ? " — a first five-for" : " — five-for no. " + c2.ff), 1); }
          MWK.forEach(function (t) { if (preW < t && c2.wk >= t) fire(k, r, ordinal(t) + " career wicket", t >= 100); });
        }
      });
      for (var nm2 in seen) {
        var c3 = C(nm2), pre2 = c3.m; c3.m++;
        MCAP.forEach(function (t) { if (pre2 < t && c3.m >= t) fire(nm2, r, t + " appearances for " + (c3.team || "the club")); });
      }
    });
    _bk = { car: car, events: events }; _bkN = res.length; _bkS = App.seasonNo || 1;
    return _bk;
  }

  // ---------------------------------------------------------------------------
  // Season stats: same pass, one season, for awards and goals.
  // ---------------------------------------------------------------------------
  function seasonStats(sNo) {
    var per = {}, res = App.results || [];
    function P(nm, team) { return per[nm] || (per[nm] = { n: nm, team: team, runs: 0, bf: 0, outs: 0, hs: 0, wk: 0, cr: 0, cb: 0, bw: 0, br: 1e9, m: 0 }); }
    res.forEach(function (r) {
      if (!r || !r.innings || r.comp !== "league" || seasonNoOf(r) !== sNo) return;
      var seen = {};
      r.innings.forEach(function (inn) {
        if (!inn) return;
        var fieldTeam = inn.batTeam === r.home ? r.away : r.home;
        (inn.bat || []).forEach(function (b) {
          if (!b || !b.p || !(b.b > 0 || b.out)) return;
          var o = P(b.p.name, inn.batTeam); seen[b.p.name] = 1;
          o.runs += num(b.r); o.bf += num(b.b); if (b.out) o.outs++; if (b.r > o.hs) o.hs = b.r;
        });
        for (var k in (inn.bowlers || {})) {
          var br = inn.bowlers[k], o2 = P(k, fieldTeam); seen[k] = 1;
          o2.wk += num(br.w); o2.cr += num(br.r); o2.cb += num(br.b);
          if (br.w > o2.bw || (br.w === o2.bw && br.r < o2.br)) { o2.bw = br.w; o2.br = br.r; }
        }
      });
      for (var nm in seen) per[nm].m++;
    });
    return per;
  }

  // ---------------------------------------------------------------------------
  // The rival: the closest-strength club, fixed for the whole season by a
  // pure function — every client, online or not, names the same enemy.
  // ---------------------------------------------------------------------------
  function sqAvg(t) { var ps = t.players || []; if (!ps.length) return 0; return ps.reduce(function (a, p) { return a + num(p.rating); }, 0) / ps.length; }
  function rivalName() {
    if (!ready()) return "";
    var me = userTeam(), mine = sqAvg(me);
    var cands = (GD.teams || []).filter(function (t) { return t !== me && t.name !== me.name; });
    if (!cands.length) return "";
    cands.sort(function (a, b) {
      var d = Math.abs(sqAvg(a) - mine) - Math.abs(sqAvg(b) - mine);
      if (d) return d;
      return hashS((App.seasonNo || 1) + a.name) - hashS((App.seasonNo || 1) + b.name);
    });
    return cands[0].name;
  }
  function h2h(rv) {
    var me = myName(), all = { w: 0, l: 0, t: 0 }, season = { w: 0, l: 0 }, last = null;
    (App.results || []).forEach(function (r) {
      if (r.comp !== "league") return;
      var pair = [r.home, r.away];
      if (pair.indexOf(me) < 0 || pair.indexOf(rv) < 0) return;
      var win = r.result && r.result.winner === me, loss = r.result && r.result.winner === rv;
      if (win) all.w++; else if (loss) all.l++; else all.t++;
      if (seasonNoOf(r) === (App.seasonNo || 1)) { if (win) season.w++; else if (loss) season.l++; }
      last = r;
    });
    return { all: all, season: season, last: last };
  }

  // ---------------------------------------------------------------------------
  // Board goals: three per season, generated from the situation, judged live.
  // ---------------------------------------------------------------------------
  function goals() {
    if (!ready()) return [];
    var me = userTeam(), mine = sqAvg(me);
    var rank = 1 + (GD.teams || []).filter(function (t) { return t !== me && sqAvg(t) > mine; }).length;
    var n = (GD.teams || []).length || 10;
    var rows = (typeof leagueRows === "function") ? leagueRows() : [];
    var pos = rows.findIndex(function (x) { return x.nm === me.name; }) + 1;
    var target = rank <= 3 ? 3 : rank <= Math.ceil(n / 2) ? Math.ceil(n / 2) : n - 2;
    var tLbl = target === 3 ? "Finish in the top three" : target === Math.ceil(n / 2) ? "Finish in the top half" : "Finish " + ordinal(target) + " or better";
    var out = [{ k: "pos", txt: tLbl, ok: pos > 0 && pos <= target, live: pos > 0 ? "now " + ordinal(pos) : "no matches yet" }];
    var rv = rivalName();
    if (rv) { var hh = h2h(rv); out.push({ k: "rival", txt: "Beat " + rv + " at least once", ok: hh.season.w > 0, live: hh.season.w > 0 ? "done — " + hh.season.w + " win" + (hh.season.w > 1 ? "s" : "") : hh.season.l > 0 ? "lost " + hh.season.l + " so far" : "not yet played" }); }
    var youngest = (me.players || []).filter(function (p) { return (p.age | 0) <= 24; });
    if (youngest.length) {
      var apps = 0, per = seasonStats(App.seasonNo || 1);
      youngest.forEach(function (p) { if (per[p.name]) apps += per[p.name].m; });
      out.push({ k: "youth", txt: "Give under-24 players 8 appearances", ok: apps >= 8, live: apps + " of 8" });
    } else {
      var hw = 0;
      (App.results || []).forEach(function (r) { if (r.comp === "league" && seasonNoOf(r) === (App.seasonNo || 1) && r.home === me.name && r.result && r.result.winner === me.name) hw++; });
      out.push({ k: "home", txt: "Win 5 at home", ok: hw >= 5, live: hw + " of 5" });
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // The promoter's wager: one offer per fixture, written from the true
  // conditions, settled by reading the scorecard. Reputation, not money —
  // the ledger stays honest, the pride does not.
  // ---------------------------------------------------------------------------
  function nextFixture() {
    if (!ready() || !App.season || !App.season.schedule) return null;
    var S = App.season;
    for (var r = S.round; r < S.schedule.length; r++) {
      var rd2 = S.schedule[r];
      for (var i = 0; i < rd2.length; i++) {
        var f = rd2[i];
        if (f[0] !== App.teamIx && f[1] !== App.teamIx) continue;
        if (S.played && S.played[r + ":" + GD.teams[f[0]].name + ":" + GD.teams[f[1]].name] !== undefined) continue;
        var home = GD.teams[f[0]], away = GD.teams[f[1]];
        return { round: r, home: home, away: away, isHome: f[0] === App.teamIx,
          opp: f[0] === App.teamIx ? away : home,
          ground: home.ground, pitch: (typeof groundPitch === "function") ? groundPitch(home.ground) : "balanced",
          weather: (typeof WXLIST !== "undefined") ? WXLIST[(r * 7 + f[0] * 3) % WXLIST.length] : "Sunny" };
      }
    }
    return null;
  }
  function isPace(pp) { return pp && pp.bowlTypeFull ? /seam/i.test(pp.bowlTypeFull) : false; }
  function isSpin(pp) { return pp && pp.bowlTypeFull ? /(wrist|finger)/i.test(pp.bowlTypeFull) : false; }
  function wagerFor(fx) {
    if (!fx) return null;
    var rv = rivalName(), key = "S" + (App.seasonNo || 1) + "R" + fx.round;
    var pitch = String(fx.pitch || "").toLowerCase(), wx = String(fx.weather || "").toLowerCase();
    var w;
    if (fx.opp.name === rv) w = { t: "derby", line: "Beat " + fx.opp.name + ". The whole league watches a derby.", rep: 3 };
    else if (/green/.test(pitch)) w = { t: "pace", line: "A green one at " + fx.ground + ". Your quicks take six wickets between them.", rep: 2 };
    else if (/dust|turn|dry/.test(pitch)) w = { t: "spin", line: "It will turn at " + fx.ground + ". Four wickets to your spinners.", rep: 2 };
    else if (/flat/.test(pitch)) w = { t: "runs", line: "Flat as a highway. Post 260 or better when you bat.", rep: 2 };
    else if (/overcast|drizzle|mist/.test(wx)) w = { t: "skittle", line: "Heavy skies — bowl " + fx.opp.name + " out, all ten.", rep: 2 };
    else w = { t: "margin", line: "Win with something to spare: 30+ runs, or 4+ wickets in hand.", rep: 2 };
    w.key = key; w.round = fx.round; w.opp = fx.opp.name;
    return w;
  }
  function marginOf(r) {
    var m = /won by (\d+) runs?/i.exec((r.result && r.result.text) || ""); if (m) return { runs: +m[1] };
    m = /won by (\d+) wicket/i.exec((r.result && r.result.text) || ""); if (m) return { wkts: +m[1] };
    return null;
  }
  function resultForRound(sNo, round) {
    var me = myName(), hit = null;
    (App.results || []).forEach(function (r) {
      if (r.comp === "league" && seasonNoOf(r) === sNo && r.round === round && (r.home === me || r.away === me)) hit = r;
    });
    return hit;
  }
  function settleWager(w, r) {
    if (!r || !r.innings) return null;
    var me = myName(), won = r.result && r.result.winner === me;
    var myBat = null, oppBat = null;
    r.innings.forEach(function (inn) { if (!inn) return; if (inn.batTeam === me) myBat = inn; else oppBat = inn; });
    var ok = false;
    if (w.t === "derby") ok = won;
    else if (w.t === "pace" || w.t === "spin") {
      var need = w.t === "pace" ? 6 : 4, got = 0;
      if (oppBat) for (var k in (oppBat.bowlers || {})) { var br = oppBat.bowlers[k]; if (br && br.p && (w.t === "pace" ? isPace(br.p) : isSpin(br.p))) got += num(br.w); }
      ok = got >= need; w.got = got; w.need = need;
    }
    else if (w.t === "runs") ok = !!(myBat && myBat.runs >= 260);
    else if (w.t === "skittle") ok = !!(oppBat && oppBat.wkts >= 10);
    else if (w.t === "margin") {
      var mg = marginOf(r);
      ok = won && !!mg && ((mg.runs && mg.runs >= 30) || (mg.wkts && mg.wkts >= 4));
    }
    return { ok: ok, won: won };
  }
  // every accepted wager, settled from the book — reputation is recomputed,
  // never stored, so it can neither drift nor be edited
  function repLedger() {
    var bagW = LSbag().wag, items = [], rep = 0, streak = 0, run = true;
    Object.keys(bagW).sort(function (a, b) {
      var pa = /S(\d+)R(\d+)/.exec(a), pb = /S(\d+)R(\d+)/.exec(b);
      return (+pa[1] - +pb[1]) || (+pa[2] - +pb[2]);
    }).forEach(function (key) {
      var rec = bagW[key], m2 = /S(\d+)R(\d+)/.exec(key);
      if (!rec || !m2) return;
      var r = resultForRound(+m2[1], +m2[2]);
      if (!r) { items.push({ key: key, line: rec.line, state: "open", rep: rec.rep }); return; }
      var st = settleWager(rec, r);
      if (!st) { items.push({ key: key, line: rec.line, state: "void", rep: 0 }); return; }
      rep += st.ok ? rec.rep : -1;
      items.push({ key: key, line: rec.line, state: st.ok ? "won" : "lost", rep: st.ok ? rec.rep : -1 });
    });
    for (var i = items.length - 1; i >= 0; i--) { if (items[i].state === "open" || items[i].state === "void") continue; if (run && items[i].state === "won") streak++; else run = false; }
    return { items: items, rep: Math.max(0, rep), streak: streak };
  }

  // ---------------------------------------------------------------------------
  // The presser: one question after your latest league result. Answering is
  // optional; silence is a "no comment" and costs nothing — a manager asleep
  // in another timezone is not a worse manager.
  // ---------------------------------------------------------------------------
  function latestUserResult() {
    var me = myName(), res = App.results || [];
    for (var i = res.length - 1; i >= 0; i--) {
      var r = res[i];
      if (r.comp === "league" && (r.home === me || r.away === me)) return r;
    }
    return null;
  }
  function pressFor(r) {
    if (!r || !r.result) return null;
    var me = myName(), won = r.result.winner === me, opp = r.home === me ? r.away : r.home;
    var mg = marginOf(r), big = mg && ((mg.runs && mg.runs >= 60) || (mg.wkts && mg.wkts >= 7)), close = mg && ((mg.runs && mg.runs <= 15) || (mg.wkts && mg.wkts <= 2));
    var mom = (r.result.mom || "").replace(/\s*\(.*\)$/, "");
    var q, a1, a2;
    if (won && big) { q = "That was a demolition of " + opp + ". Is this side better than people think?"; a1 = ["Stay humble", "“One match. We stay humble and go again.”"]; a2 = ["Put the league on notice", "“People should start taking us seriously. That was no accident.”"]; }
    else if (won && close) { q = "You stole that one from " + opp + " at the death. Hearts in mouths?"; a1 = ["Credit the nerve", "“Tight finishes are won by calm heads. We had eleven of them.”"]; a2 = ["Admit the escape", "“We got away with one today. We will be better.”"]; }
    else if (won) { q = "A professional win over " + opp + (mom ? ", and " + mom + " took the honours" : "") + ". Satisfied?"; a1 = ["Praise the match-winner", mom ? "“" + mom + " won us that. Take nothing away from him.”" : "“The dressing room won that together.”"]; a2 = ["Demand more", "“Satisfied is how mid-table clubs talk. We move on.”"]; }
    else if (big) { q = opp + " took you apart today. What do you say to the supporters?"; a1 = ["Own it", "“That was not good enough and it starts with me.”"]; a2 = ["Back the players", "“I will not panic over one bad day. This squad has my full faith.”"]; }
    else { q = "A narrow defeat to " + opp + ". Fine margins, or something missing?"; a1 = ["Fine margins", "“A coin-flip match. Next time the coin lands our side.”"]; a2 = ["Something missing", "“Close is not good enough. Something has to change.”"]; }
    return { key: "S" + seasonNoOf(r) + "R" + r.round, q: q, a1: a1, a2: a2, opp: opp, won: won };
  }

  // ---------------------------------------------------------------------------
  // Away-day digest: what moved while this manager was living their life.
  // Device-local watermark — the world state itself is never touched.
  // ---------------------------------------------------------------------------
  function seenGet() { try { return JSON.parse(localStorage.getItem("fol_ls_seen") || "null"); } catch (e) { return null; } }
  function seenSet(v) { try { localStorage.setItem("fol_ls_seen", JSON.stringify(v)); } catch (e) {} }
  // routing renders the desk twice (explicit route() + the hashchange listener),
  // so the watermark advances on the FIRST render of a world state and the
  // built card is cached for every render after it — otherwise render two
  // reads its own watermark and the digest vanishes before it is ever seen
  var _digHtml = "", _digSig = "";
  function digestCard() {
    if (!ready() || !App.season) return "";
    var S = App.season, curS = App.seasonNo || 1, curR = S.round || 0;
    var sig = curS + ":" + curR;
    if (_digSig === sig) return _digHtml;
    var rows = (typeof leagueRows === "function") ? leagueRows() : [];
    var pos = rows.findIndex(function (x) { return x.nm === myName(); }) + 1;
    var old = seenGet();
    _digSig = sig; _digHtml = "";
    seenSet({ s: curS, r: curR, pos: pos });
    if (!old || old.s !== curS || old.r >= curR) return "";
    var me = myName(), rv = rivalName(), lines = [];
    (App.results || []).forEach(function (r) {
      if (r.comp !== "league" || seasonNoOf(r) !== curS || r.round == null || r.round < old.r || r.round >= curR) return;
      if (!r.result || !r.result.text || /LIVE/.test(r.result.text)) return;
      if (!r.result.winner && !/tie/i.test(r.result.text)) return;
      if (r.home === me || r.away === me) lines.unshift("<b>" + E(r.result.text) + "</b> <span>(R" + (r.round + 1) + " v " + E(r.home === me ? r.away : r.home) + ")</span>");
      else if (rv && (r.home === rv || r.away === rv)) lines.push(E(rv) + ": " + E(r.result.text) + " <span>(R" + (r.round + 1) + ")</span>");
    });
    if (!lines.length) return "";
    var move = (old.pos && pos && old.pos !== pos)
      ? (pos < old.pos ? "Up to <b>" + ordinal(pos) + "</b> from " + ordinal(old.pos) + "." : "Slipped to <b>" + ordinal(pos) + "</b> from " + ordinal(old.pos) + ".")
      : (pos ? "Holding <b>" + ordinal(pos) + "</b>." : "");
    _digHtml = "<div class='fo-card fo-ls-card fo-ls-digest pap tele'><div class='fo-card-h2row'><div class='fo-card-h2'>Club telegraph</div><span class='fo-ls-k'>R" + (old.r + 1) + (curR > old.r + 1 ? "&ndash;" + curR : "") + "</span></div><div class='fo-tele-sub'>While you were away</div><div class='fo-card-b'>" +
      lines.slice(0, 4).map(function (l) { return "<div class='fo-ls-line'>" + l + "</div>"; }).join("") +
      (move ? "<div class='fo-ls-line fo-ls-move'>" + move + "</div>" : "") + "</div></div>";
    return _digHtml;
  }

  // ---------------------------------------------------------------------------
  // Cards for the club page
  // ---------------------------------------------------------------------------
  function rivalCard() {
    var rv = rivalName(); if (!rv) return "";
    var hh = h2h(rv), me = myName();
    var next = null, S = App.season;
    if (S && S.schedule) for (var r = S.round; r < S.schedule.length && !next; r++) (S.schedule[r] || []).forEach(function (f) {
      if (next) return;
      var h = GD.teams[f[0]].name, a = GD.teams[f[1]].name;
      if ((h === me && a === rv) || (h === rv && a === me)) next = { round: r, home: h };
    });
    // the one match on this card that has actually been played should open
    var lastHref = ""; try { lastHref = hh.last ? foMatchHref(hh.last) : ""; } catch (eLh) {}
    var lastLine = hh.last
      ? ("Last meeting: " + (lastHref
          ? "<a class='fo-ls-open' href='" + lastHref + "'>" + E(hh.last.result.text) + " &rsaquo;</a>"
          : E(hh.last.result.text)))
      : "You have never met. Yet.";
    return "<div class='fo-card fo-ls-card fo-ls-rival poster'><div class='fo-card-h2row'><div class='fo-card-h2'>The rivalry</div><span class='fo-ls-k'>grudge fixture</span></div><div class='fo-card-b'>" +
      "<div class='fo-pos-names'><b>" + E(me) + "</b><i>v</i><b>" + E(rv) + "</b></div>" +
      "<div class='fo-ls-h2h'><b>" + hh.all.w + "</b><span>you</span><i>&ndash;</i><b>" + hh.all.l + "</b><span>them</span></div>" +
      "<div class='fo-ls-line'>" + lastLine + "</div>" +
      (next ? "<div class='fo-ls-line'>Next: <b>R" + (next.round + 1) + "</b> at " + E(next.home === me ? "your place" : "theirs") + ". Circle it.</div>" : "<div class='fo-ls-line'>No more meetings this season.</div>") +
      "</div></div>";
  }
  function goalsCard() {
    var gs = goals(); if (!gs.length) return "";
    return "<div class='fo-card fo-ls-card pap letter'><div class='fo-let-head'><i>" + E(myName() || "The Club") + " C.C.</i><b>From the office of the Board</b></div>" +
      "<div class='fo-card-h2row'><div class='fo-card-h2'>Expectations, season " + (App.seasonNo || 1) + "</div><span class='fo-ls-k'>" + gs.filter(function (g) { return g.ok; }).length + "/" + gs.length + "</span></div><div class='fo-card-b'>" +
      gs.map(function (g) { return "<div class='fo-ls-goal" + (g.ok ? " ok" : "") + "'><i>" + (g.ok ? "&#10003;" : "&#9675;") + "</i><div><b>" + E(g.txt) + "</b><span>" + E(g.live) + "</span></div></div>"; }).join("") +
      "<div class='fo-ls-line fo-ls-fine'>Settled on awards night. The board remembers.</div>" +
      "<div class='fo-let-sign'>&mdash; The Board</div></div></div>";
  }
  function wagerCard() {
    var bag = LSbag(), led = repLedger();
    var fx = nextFixture(), offer = fx ? wagerFor(fx) : null;
    var body = "";
    var open = led.items.filter(function (x) { return x.state === "open"; });
    var settled = led.items.filter(function (x) { return x.state === "won" || x.state === "lost"; }).slice(-2);
    settled.forEach(function (x) {
      body += "<div class='fo-ls-line fo-ls-w" + x.state + "'><i>" + (x.state === "won" ? "&#10003;" : "&#10007;") + "</i> " + E(x.line) + " <b>" + (x.rep > 0 ? "+" + x.rep : x.rep) + " rep</b></div>";
    });
    open.forEach(function (x) { body += "<div class='fo-ls-line'><i>&#8987;</i> " + E(x.line) + " <span>settles at stumps</span></div>"; });
    if (offer && !bag.wag[offer.key]) {
      body += "<div class='fo-ls-offer'><div class='fo-ls-line'>&ldquo;" + E(offer.line) + "&rdquo;</div>" +
        "<div class='fo-ls-line fo-ls-fine'>R" + (offer.round + 1) + " v " + E(offer.opp) + " &middot; win it for <b>+" + offer.rep + " rep</b>, miss for &minus;1</div>" +
        "<button type='button' class='fo-ls-btn' data-ls-wager='" + E(offer.key) + "'>Shake on it</button></div>";
    } else if (offer && bag.wag[offer.key] && !open.length) {
      body += "<div class='fo-ls-line fo-ls-fine'>Wager accepted for R" + (offer.round + 1) + ". Play the match.</div>";
    }
    if (!body) body = "<div class='fo-ls-line fo-ls-fine'>The promoter has nothing for you this week.</div>";
    return "<div class='fo-card fo-ls-card tick'><div class='fo-card-h2row'><div class='fo-card-h2'>The promoter&rsquo;s wager</div><span class='fo-ls-k'>Rep <b>" + led.rep + "</b>" + (led.streak > 1 ? " &middot; " + led.streak + " straight" : "") + "</span></div><div class='fo-card-b'>" + body + "</div><div class='fo-tick-stub'>FIFTY OVERS &middot; PROMOTIONS &middot; HONOURED WHEREVER CRICKET IS PLAYED</div></div>";
  }
  function pressCard() {
    var r = latestUserResult(); if (!r) return "";
    var pq = pressFor(r); if (!pq) return "";
    var bag = LSbag(), ans = bag.press[pq.key];
    if (ans) {
      var chosen = ans.a === 1 ? pq.a1 : pq.a2;
      return "<div class='fo-card fo-ls-card pap news'><div class='fo-card-h2row'><div class='fo-card-h2'>The Sporting Gazette</div><span class='fo-ls-k'>as printed</span></div><div class='fo-card-b'>" +
        "<div class='fo-ls-line fo-ls-quote'>" + E(chosen[1]) + "</div><div class='fo-ls-line fo-ls-fine'>&mdash; the " + E(myName() || "club") + " manager, after the " + (pq.won ? "win over " : "defeat to ") + E(pq.opp) + "</div></div></div>";
    }
    return "<div class='fo-card fo-ls-card pap news'><div class='fo-card-h2row'><div class='fo-card-h2'>The Sporting Gazette</div><span class='fo-ls-k'>press room</span></div><div class='fo-card-b'>" +
      "<div class='fo-ls-line fo-ls-q'>&ldquo;" + E(pq.q) + "&rdquo;</div>" +
      "<div class='fo-ls-pressbtns'>" +
      "<button type='button' class='fo-ls-btn ghost' data-ls-press='" + E(pq.key) + "' data-a='1'>" + E(pq.a1[0]) + "</button>" +
      "<button type='button' class='fo-ls-btn ghost' data-ls-press='" + E(pq.key) + "' data-a='2'>" + E(pq.a2[0]) + "</button>" +
      "</div><div class='fo-ls-line fo-ls-fine'>Or say nothing. Silence is also an answer.</div></div></div>";
  }
  function diaryCard() {
    var ev = book().events, me = myName();
    if (!ev.length) return "";
    var mine = ev.filter(function (x) { return x.team === me; }).slice(-4).reverse();
    var others = ev.filter(function (x) { return x.team !== me; }).slice(-2).reverse();
    var rows = mine.map(function (x) { return "<div class='fo-ls-line'><b>" + E(x.n) + "</b> &mdash; " + E(x.txt) + " <span>R" + ((x.rd | 0) + 1) + "</span></div>"; })
      .concat(others.map(function (x) { return "<div class='fo-ls-line fo-ls-dim'>" + E(x.n) + " (" + E(x.team) + ") &mdash; " + E(x.txt) + "</div>"; }));
    if (!rows.length) return "";
    return "<div class='fo-card fo-ls-card pap alma'><div class='fo-card-h2row'><div class='fo-card-h2'>The club almanack</div><a class='fo-morelink' href='#/ceremony'>The season so far &rsaquo;</a></div><div class='fo-alma-sub'>Notable performances, recorded in order</div><div class='fo-card-b'>" + rows.join("") + "</div></div>";
  }

  // ---------------------------------------------------------------------------
  // Awards night
  // ---------------------------------------------------------------------------
  function computeCeremony(sNo) {
    var per = seasonStats(sNo), me = myName();
    var all = Object.keys(per).map(function (k) { return per[k]; });
    var pts = function (o) { return o.runs + o.wk * 20; };
    var byPts = all.slice().sort(function (a, b) { return pts(b) - pts(a); });
    var byRuns = all.slice().sort(function (a, b) { return b.runs - a.runs; });
    var byWk = all.slice().sort(function (a, b) { return (b.wk - a.wk) || (a.cr / Math.max(1, a.wk)) - (b.cr / Math.max(1, b.wk)); });
    var ageOf = function (nm) { var fp = (typeof findPlayer === "function") ? findPlayer(nm) : null; return fp ? (fp.p.age | 0) : 99; };
    var young = byPts.filter(function (o) { return ageOf(o.n) <= 23 && pts(o) > 0; });
    var myBest = byPts.filter(function (o) { return o.team === me; });
    var defin = null, closest = 1e9;
    (App.results || []).forEach(function (r) {
      if (r.comp !== "league" || seasonNoOf(r) !== sNo || (r.home !== me && r.away !== me)) return;
      var mg = marginOf(r), score = mg ? (mg.runs != null ? mg.runs : (10 - mg.wkts) * 4) : 999;
      if (score < closest) { closest = score; defin = r; }
    });
    var rows = (typeof leagueRows === "function") ? leagueRows() : [];
    return {
      s: sNo, table: rows.slice(0, 3).map(function (x) { return { nm: x.nm, pts: x.pts }; }),
      pos: rows.findIndex(function (x) { return x.nm === me; }) + 1,
      mvp: byPts[0] || null, bat: byRuns[0] || null, ball: byWk[0] || null,
      young: young[0] || null, myMvp: myBest[0] || null,
      defining: defin ? { text: defin.result.text, ix: defin.ix, opp: defin.home === me ? defin.away : defin.home } : null,
      goals: goals(), rep: repLedger().rep, me: me, done: false
    };
  }
  window.foRenderCeremony = function () {
    var page = document.getElementById("page"); if (!page) return;
    document.body.classList.add("fo-cer-on");
    foLsCss();
    var bag = LSbag();
    var seasonDone = App.season && App.season.schedule && App.season.round >= App.season.schedule.length;
    // last season's awards night stays on this page only until the new season's
    // first ball; from then on the page turns back into the live season review
    var showStored = bag.cer && bag.cer.done && bag.cer.s === (App.seasonNo || 1) - 1 && !((App.season && App.season.round) > 0);
    var cer = showStored ? bag.cer : computeCeremony(App.seasonNo || 1);
    var live = !showStored;
    var pic = function (nm) {
      try { var fp = (typeof findPlayer === "function") ? findPlayer(nm) : null;
        if (fp && fp.p && typeof foPkArt === "function") return lsArt() + foPkArt(fp.p); } catch (e) {}
      return "";
    };
    var aw = function (icon, ttl, o, line) {
      if (!o) return "";
      var art = pic(o.n);
      return "<div class='fo-cer-aw'>" +
        (art ? "<u class='fo-cer-face'><img src='" + art + "' alt='' loading='lazy' onerror=\"this.parentNode.style.display='none'\"></u>" : "<i>" + icon + "</i>") +
        "<div><span>" + ttl + "</span><b>" + E(o.n || o) + "</b><em>" + line + "</em></div></div>";
    };
    var st = function (o) { return o ? (o.runs + " runs" + (o.wk ? " · " + o.wk + " wkts" : "") + " · " + E(o.team)) : ""; };
    var cbg = lsArt() + "home/" + (window.innerWidth < 760 ? "hgm-blue-hour" : "arches-blue-hour-cup") + ".webp";
    page.innerHTML = "<div class='fo-cer'>" +
      "<img class='fo-cer-bg' src='" + cbg + "' alt='' onerror=\"this.style.display='none'\">" +
      "<div class='fo-cer-veil'></div>" +
      "<div class='fo-cer-in'>" +
      "<div class='fo-cer-eyebrow'>" + (live ? "Season " + cer.s + " · the story so far" : "Season " + cer.s + " · awards night") + "</div>" +
      "<h1>" + (live ? "The Season<br>So Far" : "Awards<br>Night") + "</h1>" +
      (cer.table.length ? "<div class='fo-cer-podium'>" + cer.table.map(function (x, i) {
        return "<div class='fo-cer-step s" + (i + 1) + (x.nm === cer.me ? " me" : "") + "'><b>" + (i + 1) + "</b><span>" + E(x.nm) + "</span><em>" + x.pts + " pts</em></div>";
      }).join("") + (cer.pos > 3 ? "<div class='fo-cer-mypos'>You finished " + ordinal(cer.pos) + "</div>" : "") + "</div>" : "") +
      "<div class='fo-cer-aws'>" +
      aw("&#127942;", live ? "Leading the MVP race" : "Player of the Season", cer.mvp, st(cer.mvp)) +
      aw("&#127951;", "Golden Bat", cer.bat, cer.bat ? cer.bat.runs + " runs · HS " + cer.bat.hs + " · " + E(cer.bat.team) : "") +
      aw("&#128308;", "Golden Ball", cer.ball, cer.ball ? cer.ball.wk + " wickets · best " + cer.ball.bw + "/" + (cer.ball.br === 1e9 ? 0 : cer.ball.br) + " · " + E(cer.ball.team) : "") +
      aw("&#127793;", "Breakout Season", cer.young, cer.young ? st(cer.young) : "") +
      aw("&#11088;", "Your Player of the Season", cer.myMvp, st(cer.myMvp)) +
      "</div>" +
      (cer.defining ? "<div class='fo-cer-def'><span>The match they will talk about</span><b>" + E(cer.defining.text) + "</b><a href='#/report?i=" + cer.defining.ix + "'>Read the report &rsaquo;</a></div>" : "") +
      (cer.goals && cer.goals.length ? "<div class='fo-cer-goals'><span>The board&rsquo;s verdict</span>" + cer.goals.map(function (g) {
        return "<div class='fo-ls-goal" + (g.ok ? " ok" : "") + "'><i>" + (g.ok ? "&#10003;" : "&#10007;") + "</i><div><b>" + E(g.txt) + "</b><span>" + E(g.live) + "</span></div></div>";
      }).join("") + "</div>" : "") +
      "<div class='fo-cer-actions'>" +
      (live && seasonDone && typeof window.seasonEnd === "function" ? "<button type='button' class='fo-ls-btn' onclick='seasonEnd()'>Close the season &rarr;</button>" : "") +
      "<a class='fo-ls-btn ghost' href='#/desk'>" + (live ? "Back to the desk" : "Into the new season &rarr;") + "</a>" +
      "</div></div></div>";
  };
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/ceremony") document.body.classList.remove("fo-cer-on"); });

  // seasonEnd: freeze the ceremony record before the world rolls over,
  // then let the rollover happen, then take the manager to awards night.
  if (typeof window.seasonEnd === "function" && !window.seasonEnd.__foLs) {
    var _se = window.seasonEnd;
    window.seasonEnd = function () {
      try { var bag = LSbag(); var cer = computeCeremony(App.seasonNo || 1); cer.done = true; bag.cer = cer; } catch (e) {}
      var out = _se.apply(this, arguments);
      try { if (typeof saveGame === "function") saveGame(false); location.hash = "#/ceremony"; if (typeof route === "function") route(); } catch (e2) {}
      return out;
    };
    window.seasonEnd.__foLs = 1;
  }

  // ---------------------------------------------------------------------------
  // The Manager's Desk (#/desk): where the club talks back. The press room,
  // the promoter, the board, the rivalry and the record book — one dark page
  // in the world's own cinematic language.
  // ---------------------------------------------------------------------------
  function stripHTML() {
    if (!ready() || !App.season) return "";
    try {
      var paperCard = ""; try { if (typeof window.foPaperCard === "function") paperCard = window.foPaperCard(); } catch (ePc) {}
      var ledCard = ""; try { if (typeof window.foLedgerCard === "function") ledCard = window.foLedgerCard(); } catch (eLc) {}
      var netsCard = ""; try { if (typeof window.foNetsCard === "function") netsCard = window.foNetsCard(); } catch (eNc) {}
      var scoutCard = ""; try { if (typeof window.foScoutCard === "function") scoutCard = window.foScoutCard(); } catch (eSc) {}
      var hbCard = ""; try { if (typeof window.foHonoursCard === "function") hbCard = window.foHonoursCard(); } catch (eHb) {}
      return "<div class='fo-ls-strip'>" + paperCard + digestCard() + scoutCard + hbCard + pressCard() + wagerCard() + ledCard + netsCard + rivalCard() + goalsCard() + diaryCard() + "</div>";
    } catch (e) { window.__foLsErr = String((e && e.stack) || e); return ""; }
  }
  function wireStrip(root) {
    root.querySelectorAll("[data-ls-wager]").forEach(function (b) {
      b.addEventListener("click", function () {
        var fx = nextFixture(), offer = fx ? wagerFor(fx) : null;
        if (!offer || offer.key !== b.getAttribute("data-ls-wager")) return;
        LSbag().wag[offer.key] = { t: offer.t, line: offer.line, rep: offer.rep };
        try { saveGame(false); } catch (e) {}
        window.foRenderDesk();
      });
    });
    root.querySelectorAll("[data-ls-press]").forEach(function (b) {
      b.addEventListener("click", function () {
        LSbag().press[b.getAttribute("data-ls-press")] = { a: +b.getAttribute("data-a") || 1 };
        try { saveGame(false); } catch (e) {}
        window.foRenderDesk();
      });
    });
  }
  function lsArt() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  window.foRenderDesk = function () {
    var page = document.getElementById("page"); if (!page) return;
    foLsCss();
    document.body.classList.add("fo-desk-on");
    var me = null; try { me = userTeam(); } catch (e) {}
    var rows = (typeof leagueRows === "function") ? leagueRows() : [];
    var pos = rows.findIndex(function (x) { return x.nm === (me && me.name); }) + 1;
    var sub = pos ? ordinal(pos) + " in the league &middot; season " + (App.seasonNo || 1) : "Season " + (App.seasonNo || 1);
    var bg = lsArt() + "home/" + (window.innerWidth < 760 ? "hgm" : "hgd") + "-office.webp";
    page.innerHTML = "<div class='fo-desk'>" +
      "<img class='fo-desk-bg' src='" + bg + "' alt='' onerror=\"this.style.display='none'\">" +
      "<div class='fo-desk-veil'></div>" +
      "<div class='fo-desk-in'>" +
      "<div class='fo-cer-eyebrow'>" + E((me && me.name) || "Your club") + " &middot; " + sub + "</div>" +
      "<h1 class='fo-desk-h1'>The Desk</h1>" +
      "<p class='fo-desk-tag'>The morning&rsquo;s post, laid out in the club office.</p>" +
      (stripHTML() || "<div class='fo-ls-card fo-card pap'><div class='fo-card-b'>The desk is quiet. Found a club and the paperwork begins.</div></div>") +
      "<div class='fo-cer-actions'><a class='fo-ls-btn ghost' href='#/home'>&lsaquo; Home ground</a>" +
      "<a class='fo-ls-btn ghost' href='#/ceremony'>The season so far &rsaquo;</a></div>" +
      "</div></div>";
    wireStrip(page);
  };
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/desk") document.body.classList.remove("fo-desk-on"); });

  // The home hub rebuilds itself on a timer with a signature check, so a
  // one-shot injection gets wiped. An observer keeps the Desk button (and its
  // attention dot when the press room or promoter wait on you) in the bar.
  function deskNeedsYou() {
    try {
      if (!ready() || !App.season) return false;
      var r = latestUserResult();
      if (r) { var pq = pressFor(r); if (pq && !LSbag().press[pq.key]) return true; }
      var fx = nextFixture(), offer = fx ? wagerFor(fx) : null;
      if (offer && !LSbag().wag[offer.key]) return true;
      return false;
    } catch (e) { return false; }
  }
  function ensureDeskButton() {
    if ((location.hash || "").split("?")[0] !== "#/home") return;
    var bar = document.querySelector("#page .hg-bar");
    if (!bar || bar.querySelector("#fo-hm-desk")) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "fo-hm-desk";
    b.innerHTML = "<span class='hg-lf'>THE DESK" + (deskNeedsYou() ? " <i class='fo-desk-dot'></i>" : "") + "</span><span class='hg-ls'>DESK</span>";
    b.addEventListener("click", function () { location.hash = "#/desk"; if (typeof window.route === "function") window.route(); });
    bar.insertBefore(b, bar.firstChild);
  }
  try {
    new MutationObserver(function () { try { ensureDeskButton(); ensureCareer(); } catch (e) {} })
      .observe(document.getElementById("page") || document.body, { childList: true, subtree: true });
  } catch (eOb) {}
  window.addEventListener("hashchange", function () { setTimeout(function () { try { ensureDeskButton(); ensureCareer(); } catch (e) {} }, 250); });

  // ---------------------------------------------------------------------------
  // Player pages: the career the record book remembers. The dossier stage
  // rebuilds itself after render, so a one-shot append gets relocated or
  // dropped — the page observer re-ensures the panel instead.
  // ---------------------------------------------------------------------------
  function careerHTML(nm) {
    var bk = book(), c = bk.car[nm];
    if (!c || !c.m) return "";
    var evs = bk.events.filter(function (x) { return x.n === nm; }).slice(-8).reverse();
    var kv = function (k, v) { return "<div class='fo-ls-ck'><span>" + k + "</span><b>" + v + "</b></div>"; };
    return "<div class='panel fo-ls-career'><h4>Career record</h4><div class='pad'>" +
      "<div class='fo-ls-crow'>" +
      kv("Matches", c.m) + kv("Runs", c.runs) +
      kv("Average", c.outs ? (c.runs / c.outs).toFixed(1) : "&ndash;") +
      kv("Strike rate", c.bf ? (100 * c.runs / c.bf).toFixed(1) : "&ndash;") +
      kv("Best", c.hs + (c.hsb ? " (" + c.hsb + ")" : "")) +
      kv("100s / 50s", c.hundred + " / " + c.fifty) +
      (c.cb ? kv("Wickets", c.wk) + kv("Best bowling", c.bw + "/" + (c.br === 1e9 ? 0 : c.br)) + kv("Economy", (c.cr / Math.max(1, c.cb / 6)).toFixed(2)) : "") +
      "</div>" +
      (evs.length ? "<div class='fo-ls-mile'><span class='fo-ls-mh'>Milestones</span>" + evs.map(function (x) {
        return "<div class='fo-ls-line'><b>S" + x.s + (x.rd != null ? " R" + (x.rd + 1) : "") + "</b> &mdash; " + E(x.txt) + "</div>";
      }).join("") + "</div>" : "") +
      "</div></div>";
  }
  function ensureCareer() {
    if ((location.hash || "").split("?")[0] !== "#/player") return;
    var page = document.getElementById("page"); if (!page) return;
    if (page.querySelector(".fo-ls-career")) return;
    var mH = /[?&]n=([^&]+)/.exec(location.hash || ""); if (!mH) return;
    var nm; try { nm = decodeURIComponent(mH[1]); } catch (e) { return; }
    if (!ready()) return;
    var html = careerHTML(nm); if (!html) return;
    foLsCss();
    var host = document.createElement("div"); host.innerHTML = html;
    var col = page.querySelector("#fo-pstage .fo-ps-r") || page;
    col.appendChild(host.firstChild);
  }

  // ---------------------------------------------------------------------------
  // Skin
  // ---------------------------------------------------------------------------
  // The nets and the ledger borrow this sheet's buttons, so it has to be
  // reachable from outside: landing straight on one of those rooms used to
  // paint bare underlined links where the pills should be.
  function foLsCss() {
    if (document.getElementById("fo-ls-css")) return;
    var s = document.createElement("style"); s.id = "fo-ls-css";
    s.textContent = [
      // ---- the desk: the morning's post in the club office ----
      "html body.fo-desk-on{background:#E9E4D8 !important}",
      "html body.fo-desk-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-desk-on #page{padding:0 !important;margin:0 !important;background:#0d0a06 !important}",
      "html body.fo-cer-on #page{padding:0 !important;margin:0 !important;background:#070d18 !important}",
      ".fo-desk{position:relative;min-height:100vh;color:#eaf0fb;padding:72px 18px 40px;isolation:isolate}",
      ".fo-desk-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 38%;z-index:-2}",
      ".fo-desk-veil{position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(13,9,4,.22),rgba(15,11,6,.10) 34%,rgba(13,9,5,.14) 68%,rgba(9,6,3,.30))}",
      ".fo-desk-in{max-width:1120px;margin:0 auto}",
      ".fo-desk-h1{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(40px,6.4vw,72px);line-height:.9;margin:0 0 8px;color:#fff;text-shadow:0 4px 26px rgba(0,0,0,.7)}",
      ".fo-desk-tag{font-family:Georgia,serif;font-style:italic;font-size:14.5px;color:#d8c9a6;margin:0 0 22px;text-shadow:0 2px 10px rgba(0,0,0,.7)}",
      ".fo-desk-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#C95532;box-shadow:0 0 8px rgba(201,85,50,.9);vertical-align:2px}",
      ".fo-ls-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin:14px 0 24px;align-items:start}",
      "@media(max-width:1080px){.fo-ls-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}",
      "@media(max-width:700px){.fo-ls-strip{grid-template-columns:minmax(0,1fr)}}",
      ".fo-ls-card{border-radius:14px;padding:0}",
      ".fo-ls-card .fo-card-h2row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px 0}",
      ".fo-ls-card .fo-card-h2{font-family:Oswald,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#EBC271}",
      ".fo-ls-card .fo-card-b{font-size:12.5px;line-height:1.55;padding:10px 16px 15px}",
      ".fo-ls-card .fo-morelink{font-size:11px;color:#EBC271 !important;text-decoration:none}",
      ".fo-ls-k{font-family:Oswald,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:#7d8fad}.fo-ls-k b{color:#EBC271}",
      ".fo-ls-line{margin:0 0 7px;color:#cfdaec}.fo-ls-line:last-child{margin-bottom:0}",
      // the last meeting is a match you played; it reads as part of the line
      // and only the chevron tells you it opens
      ".fo-ls-line a.fo-ls-open{color:inherit;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.28)}",
      ".fo-ls-line a.fo-ls-open:hover{border-bottom-color:currentColor}",
      ".pap .fo-ls-line a.fo-ls-open{border-bottom-color:rgba(36,29,14,.3)}",
      ".fo-ls-line b{color:#f2f6ff}.fo-ls-line span{color:#7d8fad;font-size:11px}.fo-ls-line i{font-style:normal;margin-right:4px}",
      ".fo-ls-dim{color:#7d8fad}.fo-ls-move b{color:#EBC271}",
      ".fo-ls-fine{font-size:11px;color:#7d8fad}",
      ".fo-ls-quote,.fo-ls-q{font-family:Georgia,serif;font-style:italic;font-size:14.5px;line-height:1.55;color:#e7eefb}",
      ".fo-ls-h2h{display:flex;align-items:baseline;gap:8px;margin-bottom:8px}",
      ".fo-ls-h2h b{font-family:Oswald,sans-serif;font-size:26px;color:#EBC271}.fo-ls-h2h span{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#7d8fad}.fo-ls-h2h i{color:#42536e;font-style:normal}",
      ".fo-ls-goal{display:flex;gap:9px;align-items:flex-start;margin-bottom:8px}",
      ".fo-ls-goal i{font-style:normal;width:18px;height:18px;border-radius:50%;border:1.5px solid rgba(126,158,208,.4);color:#93a5c2;font-size:10px;line-height:15px;text-align:center;flex:none;margin-top:1px}",
      ".fo-ls-goal.ok i{background:#2f9d78;border-color:#2f9d78;color:#fff}",
      ".fo-ls-goal b{display:block;font-size:12.5px;color:#f2f6ff}.fo-ls-goal span{font-size:11px;color:#7d8fad}",
      ".fo-ls-wwon i{color:#5BD0A6}.fo-ls-wlost i{color:#e0704f}.fo-ls-wwon b{color:#5BD0A6}.fo-ls-wlost b{color:#e0704f}",
      ".fo-ls-offer{margin-top:9px;padding:10px 12px;border:1px dashed rgba(235,194,113,.4);border-radius:10px;background:rgba(235,194,113,.06)}",
      // ---- paper: everything the post brought is a physical thing ----
      ".fo-ls-card.pap{background:linear-gradient(172deg,#f8f1de,#f0e6cb 55%,#e9ddbe);color:#3a3020;border:0;border-radius:3px;box-shadow:0 16px 34px rgba(0,0,0,.55),0 2px 7px rgba(0,0,0,.35)}",
      ".fo-ls-strip>.pap:nth-child(odd){transform:rotate(-.5deg)}",
      ".fo-ls-strip>.pap:nth-child(even){transform:rotate(.45deg)}",
      ".fo-ls-strip>.fo-ls-card{transition:transform .22s ease,box-shadow .22s ease}",
      ".fo-ls-strip>.fo-ls-card:hover{transform:rotate(0) translateY(-3px);box-shadow:0 22px 44px rgba(0,0,0,.6),0 3px 9px rgba(0,0,0,.35)}",
      ".pap .fo-card-h2{color:#7c5f1d}.pap .fo-ls-k{color:#93835c}.pap .fo-ls-k b{color:#7c5f1d}",
      ".pap .fo-ls-line{color:#453a22}.pap .fo-ls-line b{color:#241d0e}.pap .fo-ls-line span{color:#93835c}",
      ".pap .fo-ls-dim{color:#93835c}.pap .fo-ls-fine{color:#93835c}.pap .fo-ls-move b{color:#8a4a21}",
      ".pap .fo-ls-quote,.pap .fo-ls-q{color:#241d0e}",
      ".pap .fo-ls-goal i{border-color:#b7a878;color:#93835c}.pap .fo-ls-goal.ok i{background:#2f7a52;border-color:#2f7a52;color:#f8f1de}",
      ".pap .fo-ls-goal b{color:#241d0e}.pap .fo-ls-goal span{color:#93835c}",
      ".pap .fo-ls-wwon i,.pap .fo-ls-wwon b{color:#1f7a52}.pap .fo-ls-wlost i,.pap .fo-ls-wlost b{color:#a13a20}",
      ".pap .fo-morelink{color:#8a4a21 !important}",
      "html body .pap .fo-ls-btn.ghost{color:#8a4a21 !important;box-shadow:inset 0 0 0 1.5px #b56a3f}",
      "html body .pap .fo-ls-btn.ghost:hover{background:rgba(181,106,63,.12) !important}",
      // the telegram: rules above and below, spaced capitals, a wire stamp
      ".tele .fo-card-h2row{border-bottom:2px solid #241d0e;padding-bottom:8px}",
      ".tele .fo-card-h2{color:#241d0e;font-size:11px;letter-spacing:.3em}",
      ".fo-tele-sub{font-family:Oswald,sans-serif;font-size:8.5px;text-transform:uppercase;letter-spacing:.24em;color:#93835c;padding:7px 16px 0}",
      ".tele .fo-card-b{border-top:1px solid rgba(36,29,14,.25);margin-top:7px}",
      // the newspaper clipping: torn top edge, masthead serif, a big pull quote
      ".news{clip-path:polygon(0 7px,3% 2px,7% 8px,12% 1px,18% 7px,24% 2px,31% 8px,38% 3px,45% 7px,52% 1px,59% 8px,66% 2px,73% 7px,80% 3px,87% 8px,93% 2px,97% 7px,100% 3px,100% 100%,0 100%)}",
      ".news .fo-card-h2{font-family:Georgia,serif;font-size:15px;font-weight:700;text-transform:none;letter-spacing:.02em;color:#241d0e;padding-top:4px}",
      ".news .fo-card-h2row{border-bottom:1px solid #241d0e;padding-bottom:6px;box-shadow:0 3px 0 -1px rgba(36,29,14,.35)}",
      ".news .fo-ls-q{position:relative;padding-left:20px;font-size:15px}",
      ".news .fo-ls-q:before{content:'\\201C';position:absolute;left:0;top:-4px;font-family:Georgia,serif;font-size:34px;color:#b7a878}",
      // the board letter: letterhead, minutes, a signature and the seal
      ".fo-let-head{text-align:center;padding:15px 16px 0}",
      ".fo-let-head i{display:block;font-family:Georgia,serif;font-style:italic;font-size:15px;color:#241d0e}",
      ".fo-let-head b{display:block;font-family:Oswald,sans-serif;font-size:8.5px;font-weight:600;text-transform:uppercase;letter-spacing:.26em;color:#93835c;margin-top:3px;padding-bottom:8px;border-bottom:1px solid rgba(36,29,14,.3)}",
      ".letter{position:relative}",
      ".letter .fo-card-h2row{padding-top:9px}",
      ".fo-let-sign{font-family:Georgia,serif;font-style:italic;font-size:14px;color:#241d0e;text-align:right;margin-top:10px;padding-right:36px}",
      ".letter:after{content:'';position:absolute;right:12px;bottom:13px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#c4573a,#8e2f18 70%);box-shadow:0 1px 3px rgba(0,0,0,.4);opacity:.9}",
      // the almanack page: italic sub-head, dotted rules between entries
      ".fo-alma-sub{font-family:Georgia,serif;font-style:italic;font-size:11.5px;color:#93835c;padding:3px 16px 0}",
      ".alma .fo-ls-line{border-bottom:1px dotted rgba(36,29,14,.3);padding-bottom:6px}",
      ".alma .fo-ls-line:last-child{border-bottom:0;padding-bottom:0}",
      // the fixture poster: dark bill among the papers, gold frame, big names
      ".fo-ls-card.poster{background:linear-gradient(168deg,#FDF8EC,#F5EDD8 65%);color:#1E2736;border:1px solid rgba(176,132,9,.55);outline:1px solid rgba(176,132,9,.28);outline-offset:-6px;border-radius:4px;box-shadow:0 12px 26px rgba(60,50,20,.18)}",
      ".poster .fo-card-h2row{justify-content:center;gap:8px}",
      ".poster .fo-card-h2{letter-spacing:.3em}",
      ".poster .fo-ls-k{color:#8A8272}",
      ".fo-pos-names{text-align:center;font-family:Georgia,serif;font-size:16px;color:#1E2736;margin:6px 0 4px}",
      ".fo-pos-names b{display:block;font-size:17px;letter-spacing:.02em}",
      ".fo-pos-names i{display:block;font-style:italic;color:#B08409;font-size:13px;margin:2px 0}",
      ".poster .fo-ls-h2h{justify-content:center}",
      ".poster .fo-ls-line{text-align:center;color:#4A5364}.poster .fo-ls-line b{color:#8A6A1F}",
      // the promoter's ticket: dark stock, gold foil, a perforated stub
      ".fo-ls-card.tick{position:relative;background:linear-gradient(170deg,#FBF3DC,#F3E6C2 70%);color:#4A3B18;border:1px solid rgba(176,132,9,.5);border-radius:6px;box-shadow:0 12px 26px rgba(60,50,20,.18)}",
      ".tick:before,.tick:after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#E9E4D8;top:50%;margin-top:-8px;box-shadow:inset 0 0 0 1px rgba(176,132,9,.35)}",
      ".tick:before{left:-8px}.tick:after{right:-8px}",
      ".tick .fo-card-h2{color:#8A6A1F;letter-spacing:.26em}",
      ".tick .fo-ls-line{color:#4A3B18}.tick .fo-ls-line b{color:#8A5A10}.tick .fo-ls-line span{color:#8A8060}",
      ".tick .fo-ls-fine{color:#8A8060}",
      ".fo-tick-stub{border-top:1px dashed rgba(176,132,9,.45);margin:0 10px;padding:8px 6px 10px;text-align:center;font-family:Oswald,sans-serif;font-size:7.5px;letter-spacing:.3em;text-transform:uppercase;color:#8A8060}",
      "html body.ftpskin .fo-ls-btn,html body .fo-ls-btn{display:inline-flex;align-items:center;min-height:44px;margin-top:8px;border:0 !important;border-radius:999px !important;padding:0 19px !important;background:#C95532 !important;color:#FFFEFC !important;font:600 11px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.14em;cursor:pointer;text-decoration:none}",
      "html body .fo-ls-btn:hover{background:#A64426 !important;color:#FFFEFC !important}",
      "html body .fo-ls-btn.ghost,html body #page .fo-ls-btn.ghost{background:transparent !important;color:#EBC271 !important;box-shadow:inset 0 0 0 1.5px rgba(235,194,113,.55)}",
      "html body .fo-ls-btn.ghost:hover{background:rgba(235,194,113,.1) !important}",
      ".fo-ls-pressbtns{display:flex;gap:8px;flex-wrap:wrap}",
      // career panel on player pages (the dossier below the hero is dark)
      ".fo-ls-career.fo-ls-career{background:rgba(14,26,48,.62);border:1px solid rgba(126,158,208,.2);border-radius:14px;margin:14px 0;overflow:hidden}",
      ".fo-ls-career h4{margin:0;padding:12px 16px 0;font-family:Oswald,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#EBC271;background:transparent;border:0}",
      ".fo-ls-career .pad{padding:10px 16px 14px;color:#cfdaec}",
      ".fo-ls-crow{display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));gap:10px;margin-bottom:4px}",
      ".fo-ls-ck span{display:block;font-family:Oswald,sans-serif;font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:#7d8fad}",
      ".fo-ls-ck b{font-size:15px;color:#f2f6ff;font-variant-numeric:tabular-nums}",
      ".fo-ls-mile{margin-top:10px;border-top:1px solid rgba(126,158,208,.18);padding-top:9px}",
      ".fo-ls-mh{display:block;font-family:Oswald,sans-serif;font-size:9.5px;text-transform:uppercase;letter-spacing:.14em;color:#7d8fad;margin-bottom:6px}",
      // awards night: floodlights over the arches, gold type, no chrome
      "html body.fo-cer-on{background:#070d18 !important}",
      "html body.fo-cer-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      ".fo-cer{position:relative;min-height:100vh;color:#eaf0fb;padding:74px 18px 40px;isolation:isolate}",
      ".fo-cer-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%;z-index:-2}",
      ".fo-cer-veil{position:fixed;inset:0;z-index:-1;background:radial-gradient(80% 50% at 50% 0%,rgba(235,194,113,.10),transparent 60%),linear-gradient(180deg,rgba(6,10,20,.34),rgba(7,12,24,.20) 36%,rgba(5,9,18,.30) 72%,rgba(4,7,14,.48))}",
      ".fo-cer-in{max-width:760px;margin:0 auto}",
      ".fo-cer-face{display:block;width:54px;height:54px;border-radius:50%;overflow:hidden;flex:none;border:2px solid rgba(235,194,113,.7);box-shadow:0 5px 16px rgba(0,0,0,.55);background:#0d1526}",
      ".fo-cer-face img{width:100%;height:100%;object-fit:cover;object-position:50% 12%}",
      ".fo-cer-eyebrow{font-family:Oswald,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.3em;color:#EBC271;margin-bottom:10px}",
      ".fo-cer h1{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(44px,8vw,84px);line-height:.9;margin:0 0 26px;color:#fff}",
      ".fo-cer-podium{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:28px}",
      ".fo-cer-step{position:relative;background:rgba(10,19,36,.82);border:1px solid rgba(126,158,208,.22);border-top:3px solid #7d8fad;border-radius:12px;padding:12px 16px;min-width:150px;backdrop-filter:blur(3px)}",
      ".fo-cer-step b{display:block;font-family:Oswald,sans-serif;font-size:22px;color:#EBC271}",
      ".fo-cer-step span{display:block;font-weight:700;margin:2px 0}.fo-cer-step em{font-style:normal;font-size:11px;color:#93a5c2}",
      ".fo-cer-step.s1{border-top-color:#EBC271;border-color:rgba(235,194,113,.6);box-shadow:0 8px 30px rgba(235,194,113,.16)}",
      ".fo-cer-step.s2{border-top-color:#c8d0dc}.fo-cer-step.s3{border-top-color:#c98a5a}",
      ".fo-cer-step.me{outline:2px solid #C95532}",
      ".fo-cer-mypos{align-self:center;font-family:Georgia,serif;font-style:italic;color:#93a5c2}",
      ".fo-cer-aws{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:26px}",
      ".fo-cer-aw{display:flex;gap:12px;align-items:center;background:rgba(10,19,36,.78);border:1px solid rgba(126,158,208,.18);border-radius:12px;padding:13px 15px;backdrop-filter:blur(3px)}",
      ".fo-cer-aw i{font-style:normal;font-size:24px;flex:none}",
      ".fo-cer-aw span{display:block;font-family:Oswald,sans-serif;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;color:#EBC271}",
      ".fo-cer-aw b{display:block;font-size:16px;margin:1px 0}.fo-cer-aw em{font-style:normal;font-size:11.5px;color:#93a5c2}",
      ".fo-cer-def{background:linear-gradient(135deg,rgba(201,85,50,.16),rgba(14,26,48,.6));border:1px solid rgba(201,85,50,.35);border-radius:12px;padding:15px 17px;margin-bottom:26px}",
      ".fo-cer-def span{display:block;font-family:Oswald,sans-serif;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;color:#e8a08a;margin-bottom:4px}",
      ".fo-cer-def b{display:block;font-size:15px;margin-bottom:6px}",
      "html body #page .fo-cer-def a{color:#EBC271 !important;font-size:12px;text-decoration:none}",
      ".fo-cer-goals{background:rgba(14,26,48,.55);border:1px solid rgba(126,158,208,.18);border-radius:12px;padding:15px 17px;margin-bottom:26px}",
      ".fo-cer-goals>span{display:block;font-family:Oswald,sans-serif;font-size:9.5px;text-transform:uppercase;letter-spacing:.16em;color:#EBC271;margin-bottom:9px}",
      ".fo-cer-goals .fo-ls-goal b{color:#eaf0fb}.fo-cer-goals .fo-ls-goal span{color:#93a5c2}",
      ".fo-cer-goals .fo-ls-goal i{border-color:rgba(126,158,208,.4);color:#93a5c2}",
      ".fo-cer-actions{display:flex;gap:10px;flex-wrap:wrap}"
    ].join("");
    document.head.appendChild(s);
  }
  // The nets and the club ledger borrow this sheet's pill buttons. Landing
  // straight on one of those rooms - which the menu now makes easy - used to
  // paint bare underlined links where the pills should be, because nothing
  // had brought the sheet onto the page yet.
  window.foLsCss = foLsCss;
})();
