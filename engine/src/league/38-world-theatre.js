/* ============================================================================
   THE WORLD THEATRE (#/watch?n=rid) — watch ANY nation's live match.

   During a nation's three-hour window its round is genuinely in progress -
   the deterministic clock says exactly where every match stands at this
   minute. This page puts that on a stage: the HOME TEAM'S OWN GROUND as
   the backdrop (each city has painted ground art; where a city has none,
   the nation's landscape art stands in, and the arches at home cover the
   last resort), a broadcast scorebug ticking minute by minute, the
   batters at the crease and the bowler by name from the world's star
   squads, an over ticker, and the round's other matches one tap away.

   Deterministic throughout: every device watching the same match at the
   same minute sees the identical score, the identical over, the identical
   names. No server, no sync - the constraint, kept.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foWT) return; window.__foWT = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function P() { return window.__foPlanet || null; }
  function cx() { return window.__foCxAPI || null; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function qs() {
    var q = {}, m = (location.hash || "").split("?")[1] || "";
    m.split("&").forEach(function (kv) { var p2 = kv.split("="); if (p2[0]) q[p2[0]] = decodeURIComponent(p2[1] || ""); });
    return q;
  }
  function flagOf(rid) { try { return ART() + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; } }

  // the home ground: the city's own painted ground, else the nation's
  // landscape, else the arches - probed in order, phone variants first
  function groundChain(city, rid) {
    var A = ART(), slug = String(city || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
    var out = [];
    if (slug) {
      if (window.innerWidth < 760) out.push(A + "cities/" + slug + "-ground-m.webp");
      out.push(A + "cities/" + slug + "-ground.webp");
    }
    out.push(A + "circuit/" + rid + ".webp");
    out.push(A + "home/arches-summer-noon.webp");
    return out;
  }
  function mountGround(el, chain, i) {
    if (!el || i >= chain.length) return;
    var probe = new Image();
    probe.onload = function () { el.style.backgroundImage = "url('" + chain[i] + "')"; };
    probe.onerror = function () { mountGround(el, chain, i + 1); };
    probe.src = chain[i];
  }

  // deterministic over ticker: the current over's deliveries, seeded on the
  // match and over - ambience under the authoritative scorebug
  var BALL_POOL = ["&middot;", "1", "&middot;", "2", "1", "4", "&middot;", "1", "6", "&middot;", "W", "1", "4", "&middot;", "2", "1"];
  function overBalls(key, ov, upto) {
    var out = [];
    for (var b = 0; b < (upto == null ? 6 : upto); b++) out.push(BALL_POOL[h32(key + "|ov" + ov + "|b" + b) % BALL_POOL.length]);
    return out;
  }
  var COMMS = [
    "pushed into the covers, they scamper", "beaten outside off - a gasp round the ground",
    "clipped off the pads, easy running", "short, pulled hard in front of square",
    "full and straight, dug out late", "drifting in, worked to leg with soft hands",
    "up the hill into the wind, no risk taken", "flighted, driven inside-out - pretty",
    "the field creeps in, the crowd leans forward", "a single to keep the good end"
  ];

  function squadNames(rid, slot, season) {
    try {
      if (window.__foStars && window.__foStars.squadOf) {
        var sq = window.__foStars.squadOf(rid, slot, season);
        if (sq && sq.length) return sq.map(function (p) { return p.name || p; });
      }
    } catch (e) {}
    return null;
  }

  // ---- SPECTATE: the real broadcast theatre, oval and all -------------------
  // THE GAME THAT ACTUALLY HAPPENS: the World Service banks every world
  // match from squads seeded 'world1|rid|slot' and match seed
  // FNV('rid:sN:rR:hHaA') - the same shipped engine this client runs,
  // proven bit-identical by the golden master. Spectate rebuilds those
  // exact squads locally and runs that exact seed, so the broadcast you
  // watch IS the match the server records, ball for ball. Nothing about
  // it is a reconstruction.
  function regionCfg(rid) {
    var r = (cx().regions() || []).filter(function (x) { return x.id === rid; })[0];
    if (!r) return null;
    var boss = (r.clubs || []).filter(function (c) { return c.boss; })[0];
    return { nat: (r.nats && r.nats[0]) || r.nm, arch: r.arch || "rock", capt: (boss && boss.capt) || "talisman" };
  }
  // THE ELEVEN THE UMPIRE BANKED, derived again on this device. Every argument
  // has to be the one the World Service used or the replay is a different match
  // played by different men - which is exactly what happened when clubs stopped
  // sharing one archetype: this asked for the NATION's identity on the shared
  // budget while the umpire generated the club's own identity at the club's own
  // standing. The side record from the planet's table carries both.
  // THE GENERATION IS PART OF THE ADDRESS. A redeal bumps it and every club on
  // earth gets men it has never had; deriving from a stale one produces a squad
  // of fifteen cricketers who do not exist anywhere. It arrives asynchronously
  // (52-served-truth fetches it), so anything derived before it lands is
  // provisional - which is why the cache is dropped when it does.
  var SQ_CACHE = {}, SQ_GEN = null, GUESSED = false;
  function forgetSquads() { SQ_CACHE = {}; SQ_GEN = null; GUESSED = false; }
  function serverSquad(rid, slot) {
    var cfg = regionCfg(rid); if (!cfg) return null;
    try {
      // a squad derived before the world has said which hand it is playing is
      // a GUESS, and the page that drew it is the only page worth repainting
      // when the answer lands
      if (window.__foWorldGen == null) GUESSED = true;
      var gen = (window.__foWorldGen | 0) || 1;
      if (gen !== SQ_GEN) { SQ_CACHE = {}; SQ_GEN = gen; }
      var key = rid + "|" + slot;
      if (SQ_CACHE[key]) return SQ_CACHE[key];
      var sd = null;
      try {
        (window.__foPlanet.sidesOf(rid) || []).forEach(function (x) { if (x.slot === slot) sd = x; });
      } catch (eS) {}
      var g = __foGenArchetypeSquad("world" + gen + "|" + rid + "|" + slot, cfg.nat,
        (sd && sd.arch) || cfg.arch, null, (sd && sd.str) || 1);
      var men = (g && g.players) || null;
      if (men) SQ_CACHE[key] = men;
      return men;
    } catch (e) { return null; }
  }
  // The server's calendar for a world day. It used to do the arithmetic itself
  // (season = day/25, round = day%25 + 1) which was true only while every day
  // was a match day. The planet owns the mapping now; this asks it - INCLUDING
  // the day the season opened on, which the planet takes from the served
  // snapshot. Doing that sum here against a hardcoded day 0 is what made a
  // restarted world announce a round it had not played.
  //   round is NULL on a rest day and through the closing week.
  // the red star: this man is in his country's fifteen as it stands
  function foNS(nm, rid) {
    try { return (window.foNatStar && window.__foServed && window.__foServed.on())
      ? window.foNatStar(nm, null, rid ? { rid: rid } : undefined) : ""; } catch (e) { return ""; }
  }
  function serverCal(now) {
    var pl = P(), d = pl.dayIx(now);
    var a = (pl.anchorOf && pl.anchorOf()) || { start: 0, season: 1 };
    var cyc = pl.CYCLE || 30, rel = d - a.start;
    if (rel < 0) return { seasonNo: a.season, round: null, dayInSeason: rel, rest: true };
    var seasonNo = a.season + Math.floor(rel / cyc), di = rel % cyc;
    var round = pl.roundOfDay ? pl.roundOfDay(di) : null;
    return { seasonNo: seasonNo, round: round, dayInSeason: di, rest: !round,
             leagueOver: di >= (pl.LEAGUE_DAYS || 24) };
  }
  // THE PYRAMID, MIRRORED. This used to deal one league of ten - the world the
  // game had before the divisions - and went on dealing it after the world had
  // two flights of eight. The pairs it handed back were nobody's fixtures: a
  // county drawn against a club it will not meet all summer, on a card that
  // read as truth. The planet owns the circle method now (schedOf, which MUST
  // agree with server/clock.mjs scheduleOf ball for ball) and this only asks
  // it, once per division.
  //
  // MEMBERSHIP IS SEASONAL - promotion and relegation redraw it, and only the
  // snapshot knows how - so the served divisions are read where the world has
  // answered, and the founding split (0-7, 8-15) is the assumption until then.
  function divMembers(rid, div) {
    try {
      var b = window.__foWorldLg && window.__foWorldLg.get(rid);
      var d = b && b.divisions && b.divisions[String(div)];
      if (d && d.length) return d.slice();
    } catch (e) {}
    return div === 2 ? [8, 9, 10, 11, 12, 13, 14, 15] : [0, 1, 2, 3, 4, 5, 6, 7];
  }
  // div 1 or div 2 for one flight's card; no div for the nation's whole day,
  // both flights in the round together - which is what a matchday is
  function schedMirror(rid, seasonNo, div) {
    var pl = P();
    if (!pl || !pl.schedOf) return [];
    if (div === 1 || div === 2) return pl.schedOf(rid, seasonNo, divMembers(rid, div), div);
    var d1 = pl.schedOf(rid, seasonNo, divMembers(rid, 1), 1);
    var d2 = pl.schedOf(rid, seasonNo, divMembers(rid, 2), 2);
    return d1.map(function (rd, i) { return rd.concat(d2[i] || []); });
  }
  function serverFixtures(rid, now) {
    var pl = P(), cal = serverCal(now);
    if (cal.seasonNo < 1 || cal.dayInSeason < 0 || !cal.round) return { cal: cal, fx: [] };
    var sides = pl.sidesOf(rid); if (!sides || sides.length < 10) return { cal: cal, fx: [] };
    // the clubs table is the naming authority - a claimed club wears its
    // manager's chosen name, and orders key by it
    var nmOv = null;
    try { if (window.__foWorldNames) { nmOv = window.__foWorldNames.get(rid); window.__foWorldNames.want(rid); } } catch (eNm) {}
    var bySlot = {};
    sides.forEach(function (s) {
      bySlot[s.slot] = (nmOv && nmOv[s.slot] && nmOv[s.slot] !== s.name)
        ? { slot: s.slot, boss: s.boss, name: nmOv[s.slot], city: s.city, str: s.str }
        : s;
    });
    var fx = schedMirror(rid, cal.seasonNo)[cal.round - 1].map(function (p2) {
      return { home: bySlot[p2[0]], away: bySlot[p2[1]] };
    });
    return { cal: cal, fx: fx };
  }
  // claimed clubs' orders, revealed at the first ball: the World Service's
  // world_round_orders RPC hands back every submitted sheet for a round
  // already in play, keyed by club name - exactly what the umpire feeds the
  // engine. Cached per round; on any failure spectate proceeds with bot
  // orders (with no claims in the league that is already exact).
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var ORD_CACHE = {}, ORD_VAL = {}, LIV_VAL = {};
  function roundOrders(rid, roundNo) {
    var key = rid + ":" + roundNo;
    if (ORD_CACHE[key]) return ORD_CACHE[key];
    var p;
    try {
      var apiBase = "";
      try { apiBase = (localStorage.getItem("fo_world_api") || window.FO_WORLD_API || ""); } catch (eB) {}
      // LIV_VAL: an object (even an empty one) means the world answered and we
      // hold the living state; null means it did not, and we must not pretend
      if (apiBase) { LIV_VAL[key] = {}; p = Promise.resolve({}); }   // that service has no living state to carry
      else p = fetch(SB_URL + "/rest/v1/rpc/world_round_orders", {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: "Bearer " + SB_ANON, "content-type": "application/json" },
        body: JSON.stringify({ p_country: rid, p_round: roundNo })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { LIV_VAL[key] = (j && j.living) || null; return (j && j.orders) || {}; });
    } catch (e) { LIV_VAL[key] = null; p = Promise.resolve({}); }
    p = p.catch(function () { LIV_VAL[key] = null; return {}; }).then(function (v) { ORD_VAL[key] = v; return v; });
    ORD_CACHE[key] = p;
    return p;
  }

  // THE LIVING STATE, LAID BACK OVER THE GENERATED MEN.
  // The World Service owns each cricketer's life - the experience the season
  // gave him, the form of his last five, the tiredness in his arm - and banks
  // the exact state every match was played with. We regenerate the squad from
  // the world seed (as always) and lay that state over it, so the broadcast
  // runs the same eleven the umpire ran. Without this the match on your
  // screen would drift from the match in the book the moment players live.
  var FORMW = ["abysmal", "poor", "shaky", "steady", "good", "strong", "excellent"];
  var EXPLAD = ["atrocious", "dreadful", "poor", "ordinary", "average", "reasonable",
    "capable", "reliable", "accomplished", "expert", "spectacular", "elite"];
  function fatWordOf(n) {
    n = +n || 0;
    return n >= 96 ? "clinically dead" : n >= 88 ? "shattered" : n >= 78 ? "exhausted"
      : n >= 68 ? "listless" : n >= 56 ? "weary" : n >= 44 ? "moderate"
      : n >= 34 ? "satisfactory" : n >= 24 ? "passable" : n >= 14 ? "energetic"
      : n >= 5 ? "revived" : "rested";
  }
  // AND WHO WAS NOT THERE. On an international window round the umpire played
  // the club's fixture without the men their country had taken; the patch
  // marks them {a:true}, and the broadcast has to leave them out too or it
  // would field an eleven the umpire never picked.
  function applyLiving(players, patch) {
    if (!players || !patch) return players;
    var away = {}, gone = 0;
    players.forEach(function (p) { if (p && patch[p.name] && patch[p.name].a) { away[p.name] = 1; gone++; } });
    if (gone) players = players.filter(function (p) { return !(p && away[p.name]); });
    // AND WHAT HE HAD LEARNED BY THAT AFTERNOON, WHICH IS THE HALF THAT LEAKS.
    // The umpire's copy of this has stripped talent state and restored it from
    // the patch for a long time; the broadcast's copy never did, so a man who
    // has earned a talent since bowled the replay with a gift he had not yet
    // been given and the screen quietly disagreed with the card it was meant to
    // be showing. Stripped first, for EVERY man - a cricketer who joined after
    // the match has no patch entry to correct him with - then restored from the
    // only record of what that day actually was.
    players.forEach(function (p) {
      if (!p) return;
      if (p.talEarned && Object.prototype.toString.call(p.talents) === "[object Array]")
        p.talents = p.talents.filter(function (t) { return t !== p.talEarned; });
      delete p.talEarned; delete p.talProg;
    });
    players.forEach(function (p) {
      var L = p && patch[p.name]; if (!L) return;
      if (L.e != null) { p.exp = L.e; p.expWord = EXPLAD[Math.max(0, Math.min(11, Math.floor(L.e / 9)))]; }
      if (L.f != null) { p.formIx = L.f; p.formWord = FORMW[L.f] || "steady"; }
      if (L.n != null) { p.fatN = L.n; p.fatWord = fatWordOf(L.n); p.fatigue = p.fatWord; }
      // the nets moved him: take the skills and remake every rating built on
      // them, by the engine's own mapping
      if (L.s && p.skills) {
        for (var k in L.s) p.skills[k] = L.s[k];
        try { if (typeof jsDerive === "function") jsDerive(p); } catch (e) {}
      }
      if (L.tp) p.talProg = L.tp;
      if (L.te) {
        p.talEarned = L.te;
        if (Object.prototype.toString.call(p.talents) !== "[object Array]") p.talents = [];
        if (p.talents.indexOf(L.te) < 0) p.talents = p.talents.concat([L.te]);
      }
    });
    return players;
  }
  // the eleven a club actually fields: revealed orders when a manager has
  // spoken (mirroring the engine's validity rules), else the engine's own
  // deterministic pick - keeper, the five best bowlers, best bats, mpos order
  function actualXI(players, orders) {
    try {
      var xiN = orders && orders.xi;
      if (xiN && xiN.length === 11) {
        var by = {}; players.forEach(function (p) { by[p.name] = p; });
        var picked = [], seen = {};
        xiN.forEach(function (nm) { if (by[nm] && !seen[nm]) { seen[nm] = 1; picked.push(by[nm]); } });
        if (picked.length === 11 && picked.filter(function (p) { return p.bowlType; }).length >= 5) return picked;
      }
    } catch (e) {}
    var P2 = players.slice();
    var kps = P2.filter(function (p) { return p.keeper; }).sort(function (a, b) { return b.bat - a.bat; });
    var keeper = kps[0] || P2.slice().sort(function (a, b) { return b.bat - a.bat; })[0];
    var bowlers = P2.filter(function (p) { return p.bowlType && p.key !== keeper; }).sort(function (a, b) { return (b.threat + b.control) - (a.threat + a.control); });
    var five = bowlers.slice(0, 5);
    var chosen = {}; chosen[keeper.name] = 1; five.forEach(function (b) { chosen[b.name] = 1; });
    var rest = P2.filter(function (p) { return !chosen[p.name]; }).sort(function (a, b) { return b.bat - a.bat; });
    for (var i = 0; i < rest.length; i++) { if (Object.keys(chosen).length >= 11) break; chosen[rest[i].name] = 1; }
    var xi = P2.filter(function (p) { return chosen[p.name]; });
    xi.sort(function (a, b) { return (a.mpos - b.mpos) || (b.bat - a.bat); });
    return xi;
  }
  // ---- THE BROADCAST SURVIVES A RELOAD ------------------------------------
  // The match on air lives only in memory; a reload used to land the manager
  // on #/match with no match, which falls through to the next fixture's
  // orders sheet - the wrong room entirely. So the theatre notes what is on
  // air and until when; a reload (or a return to #/match) inside that window
  // simply rejoins the broadcast at the live ball, the way television works.
  var WT_RES = "fo_wt_resume";
  function wtRemember(o) { try { localStorage.setItem(WT_RES, JSON.stringify(o)); } catch (e) {} }
  function wtForget() { try { localStorage.removeItem(WT_RES); } catch (e) {} }
  function wtMaybeResume() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/match") return;
      if (typeof M !== "undefined" && M && M.meta && !M.done) return;   // something real is playing
      var o = null; try { o = JSON.parse(localStorage.getItem(WT_RES) || "null"); } catch (eP) {}
      if (!o || !o.until) return;
      if (Date.now() >= o.until) { wtForget(); return; }
      if (o.k === "friendly") window.foWtFriendly(o.fid);
      else window.foWtSpectate(o.rid, null, null, o.fi);
    } catch (e) {}
  }
  (function () {
    var n = 0, t = setInterval(function () {
      if (++n > 40) { clearInterval(t); return; }
      if (!P() || typeof newMatch !== "function") return;
      clearInterval(t);
      wtMaybeResume();
    }, 500);
    window.addEventListener("hashchange", function () { setTimeout(wtMaybeResume, 350); });
  })();
  // #/match with nothing in memory used to bounce straight to #/orders before
  // the resume could act - the reload-lands-on-the-orders-sheet confusion.
  // While a remembered broadcast is inside its window, hold the room open and
  // rejoin instead of bouncing.
  var _wtPgMatch = window.pgMatch;
  window.pgMatch = function (q) {
    try {
      if ((typeof M === "undefined" || !M) && !(window.App && App.pending)) {
        var o = null; try { o = JSON.parse(localStorage.getItem(WT_RES) || "null"); } catch (eP) {}
        if (o && o.until && Date.now() < o.until) {
          var pg = document.getElementById("page");
          if (pg) pg.innerHTML = "<div style='padding:90px 24px;text-align:center;font:400 15px Fraunces,Georgia,serif;color:#6A6354'>Rejoining the broadcast&hellip;</div>";
          wtMaybeResume();   // fires now if the world is aboard; the boot poll covers the rest
          return;
        }
      }
    } catch (e) {}
    return _wtPgMatch ? _wtPgMatch.apply(this, arguments) : undefined;
  };
  // NEVER A MODAL. An alert() freezes every click and every timer behind it -
  // on a slow network the joining curtain armed alert after alert and the
  // whole page read as dead. The theatre now speaks in toasts and writes the
  // reason on the curtain itself, and the page stays alive underneath.
  function wtSay(msg) {
    try { window.__foWtWhy = msg; } catch (e0) {}
    try { if (typeof toast === "function") toast(msg); } catch (e1) { try { console.warn("[theatre] " + msg); } catch (e2) {} }
    try {
      var pg = document.getElementById("page");
      if (pg && /Joining the broadcast|Rejoining the broadcast/.test(pg.textContent || "")) {
        var p2 = pg.querySelector(".fo-wt p") || pg.querySelector("div");
        if (p2) p2.innerHTML = E(msg) + " &middot; <a href='#/league?t=fixtures' style='color:#C9571F;text-decoration:underline'>the fixtures page</a>" +
          " &middot; <a href='#/home' style='color:#C9571F;text-decoration:underline'>the club</a>";
      }
    } catch (e3) {}
  }
  window.foWtSpectate = function (rid, season, round, fi) {
    try {
      if (typeof M !== "undefined" && M && !M.done && M.meta && !M.meta.__spectate) {
        wtSay("A match of yours is in progress - finish it first."); return;
      }
      var sv = serverFixtures(rid, Date.now()), m = sv.fx[fi];
      if (!m) { wtSay("That fixture is not on today's card - the day's fixtures may still be loading. Try again in a moment."); return; }
      var cal = sv.cal, srvRound = cal.round;
      // no early broadcasts: bot or human, a match cannot be watched (and its
      // result cannot be learned) before its scheduled first ball
      var plG = P(), nowG = Date.now();
      var hNowG = (nowG - (plG.EPOCH + plG.dayIx(nowG) * 86400000)) / 3600000;
      var h0G = plG.natHour(rid);
      if (hNowG < h0G) {
        wtSay("The first ball is at " + (function(h9){try{return window.__foPlanet.hhTxt(h9);}catch(e9){return (h9<10?"0":"")+h9+":00";}})(h0G) + " - the broadcast opens then.");
        return;
      }
      // The round's revealed orders AND the living state of the men playing it
      // both come from the World Service, and the broadcast is only the match
      // on record if we have them. So we wait for the world rather than
      // guessing: an unreachable service means no broadcast, not a wrong one.
      var started = false, key = rid + ":" + srvRound;
      var noWorld = function () {
        if (started) return; started = true;
        wtSay("The World Service can't be reached just now - the broadcast waits rather than show a match that isn't the one on record. Try again in a moment.");
      };
      var giveUp = setTimeout(noWorld, 9000);
      roundOrders(rid, srvRound).then(function (om) {
        clearTimeout(giveUp);
        if (started) return;
        if (!LIV_VAL[key]) return noWorld();
        started = true;
        foWtBegin(rid, sv, fi, om || {});
      });
    } catch (e) { wtSay("The broadcast could not start: " + String((e && e.message) || e).slice(0, 120)); try { console.warn("foWtSpectate", e); } catch (e2) {} }
  };
  // CATCH-UP OFF THE MAIN THREAD'S BACK. Joining mid-window can mean
  // hundreds of deliveries; simming them in one synchronous run froze slower
  // machines for minutes and the theatre then painted mid-churn. The pump
  // bowls a small slice per timeslot, narrates progress on the curtain, and
  // only opens the theatre once the match has reached the live ball.
  function wtPump(target0, done) {
    var meta0 = M && M.meta;
    var step = function () {
      try {
        if (!M || M.meta !== meta0) return;                 // superseded by another join
        var upTo = Math.min(target0, window.__foWtBall + 60);
        while (M && !M.done && window.__foWtBall < upTo) { autoPick(); stepBall(); window.__foWtBall++; }
        if (M && !M.done && window.__foWtBall < target0) {
          try {
            var cur = document.querySelector("#page .fo-wt p");
            if (cur) cur.innerHTML = "Joining the broadcast&hellip; catching up to the live ball <b>" +
              Math.min(99, Math.round(100 * window.__foWtBall / Math.max(1, target0))) + "%</b>";
          } catch (eC) {}
          setTimeout(step, 16);
          return;
        }
        done();
      } catch (eP) { wtSay("The broadcast could not start: " + String((eP && eP.message) || eP).slice(0, 120)); }
    };
    step();
  }
  function foWtBegin(rid, sv, fi, ordersMap) {
    try {
      var m = sv.fx[fi], cal = sv.cal, srvRound = cal.round;
      var sqH = serverSquad(rid, m.home.slot), sqA = serverSquad(rid, m.away.slot);
      if (!sqH || !sqA) { wtSay("The squads are still warming up - try again in a moment."); return; }
      var liv = LIV_VAL[rid + ":" + srvRound];
      if (liv) { sqH = applyLiving(sqH, liv[m.home.name]); sqA = applyLiving(sqA, liv[m.away.name]); }
      var home = { name: m.home.name, ground: (m.home.city || m.home.name) + " Ground", players: sqH };
      var away = { name: m.away.name, players: sqA };
      // WHOSE MEN THESE ARE. Every name on a broadcast scorecard is a link,
      // and a link needs to know which club in which nation to ask about. The
      // engine's own playerLink can only write the name, so the theatre leaves
      // the match's two clubs here for the player page to read.
      window.__foWtCtx = { rid: rid, sides: [
        { country: rid, slot: m.home.slot, name: m.home.name },
        { country: rid, slot: m.away.slot, name: m.away.name }] };
      var matchId = rid + ":s" + cal.seasonNo + ":r" + srvRound + ":h" + m.home.slot + "a" + m.away.slot;
      var seed = h32(matchId) || 1;
      window.onMatchEnd = function () {};
      // THE BROADCAST IS THE MATCH THE WORLD RECORDED. The umpire played this
      // fixture on the forecast pitch, under the forecast sky, with every
      // unmanaged club batting on its archetype's doctrine - all three read
      // from the planet's own tables, which this build carries too. Replaying
      // with anything else would show a different game than the banked card.
      var cond = { pitch: "balanced", weather: "Sunny" };
      try { cond = window.__foPlanet.condOf(rid, m.home.slot, cal.seasonNo, srvRound) || cond; } catch (eC) {}
      var om2 = ordersMap || {};
      try {
        [m.home, m.away].forEach(function (side) {
          if (om2[side.name]) return;                      // a manager's sheet stands
          var doc = window.__foPlanet.doctrineOf(rid, side.slot);
          if (doc) om2[side.name] = doc;
        });
      } catch (eD) {}
      M = newMatch(home, away, cond.pitch, seed);
      M.meta = { home: home.name, away: away.name, pitch: cond.pitch, weather: cond.weather, comp: "world", ground: home.ground, __spectate: 1, isUser: false };
      M.isUserMatch = false; M.ordersMap = om2;
      App.tossState = { stage: "x" };
      applyToss(aiTossDecision());
      // THE BROADCAST RUNS ON THE WORLD CLOCK. The full card is paced across
      // the whole three-hour window - one delivery every 18 seconds, an over
      // every couple of minutes - so a live match genuinely lasts the
      // afternoon and every viewer on earth is watching the same ball at the
      // same minute. Joining mid-window fast-forwards to the live ball and
      // then holds broadcast pace; after stumps the theatre replays from the
      // first ball at highlights pace instead.
      var pl2 = P(), nowT = Date.now();
      var winStart = pl2.EPOCH + pl2.dayIx(nowT) * 86400000 + pl2.natHour(rid) * 3600000;
      var winLen = (pl2.LIVE_LEN || 3) * 3600000;
      var BALL_MS = winLen / 600;
      var liveBall = function (t) {
        if (t >= winStart + winLen) return 1e9;          // window over: run to stumps
        var n = Math.floor((t - winStart) / BALL_MS);
        return n > 0 ? n : 0;
      };
      var isLive = nowT >= winStart && nowT < winStart + winLen;
      window.__foWtBall = 0;
      var target0 = isLive ? liveBall(nowT) : 0;         // stumps entry replays from ball one
      wtPump(target0, function () {
        try { if (window.__foWtDrv) clearInterval(window.__foWtDrv); } catch (e) {}
        window.__foWtDrv = setInterval(function () {
          try {
            if ((location.hash || "").split("?")[0] !== "#/match" || !M || !M.meta || !M.meta.__spectate) { clearInterval(window.__foWtDrv); return; }
            if (M.done) { clearInterval(window.__foWtDrv); return; }
            if (isLive) {
              // hold the live minute: bowl only the deliveries the clock has reached
              var tb = liveBall(Date.now()), guard = 0;
              while (M && !M.done && window.__foWtBall < tb && guard++ < 650) { autoPick(); stepBall(); window.__foWtBall++; }
            } else {
              autoPick(); stepBall(); window.__foWtBall++;
            }
          } catch (e) { clearInterval(window.__foWtDrv); }
        }, isLive ? 1000 : 2200);
        wtRemember({ k: "league", rid: rid, fi: fi, until: winStart + winLen });
        location.hash = "#/match";
        if (typeof window.route === "function") window.route();
        // one clean paint after the dust settles, so the stage measures right
        setTimeout(function () { try { if (typeof renderMatch === "function") renderMatch(); } catch (eR9) {} }, 150);
      });
    } catch (e) { wtSay("The broadcast could not start: " + String((e && e.message) || e).slice(0, 120)); try { console.warn("foWtSpectate", e); } catch (e2) {} }
  };

  // ---- FRIENDLIES IN THE THEATRE: watched == recorded, no stakes attached --
  // From the first ball, a friendly is a broadcast like any league match:
  // the detail RPC hands over both clubs (current names), the sealed
  // lineups exactly as the umpire uses them, and the kick-off; the seed is
  // FNV('friendly:'+id) on both hosts. Live it paces on the world clock
  // across a three-hour window; after stumps it replays from ball one.
  // Every friendly is played by the UMPIRE and read on the feed page now -
  // this door stays standing (the club home, the resume chip and the old
  // bell all knock on it) but it opens the reader, never a browser
  // re-simulation. The umpire banks the match at the teamsheet lock and the
  // feed reveals his book ball by ball from the named hour (048).
  window.foWtFriendly = function (fid) {
    try {
      location.hash = "#/feed?fr=" + (parseInt(fid, 10) || fid);
      if (typeof window.route === "function") window.route();
    } catch (e) {}
  };

  // where a nation's card stands right now - and the door straight into one
  // match's live broadcast, for any page that lists fixtures. No hub between
  // a match and its coverage: the row IS the way in.
  window.foWtState = function (rid) {
    try {
      var pl = P(), now = Date.now();
      var cal = serverCal(now);
      var h0 = pl.natHour(rid);
      var hNow = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
      return { round: cal.round, state: !cal.round ? "rest" : hNow < h0 ? "up" : hNow < h0 + (pl.LIVE_LEN || 3) ? "live" : "fin" };
    } catch (e) { return null; }
  };
  window.foWtGoHref = function (rid, hs, as) {
    try {
      var st = window.foWtState(rid);
      if (!st || st.state !== "live") return null;
      var sv = serverFixtures(rid, Date.now());
      var fi = -1;
      (sv.fx || []).forEach(function (m, i) {
        if (fi < 0 && m && m.home && m.away && m.home.slot === (hs | 0) && m.away.slot === (as | 0)) fi = i;
      });
      if (fi < 0) return null;
      // the feed page IS the live coverage now - the umpire simulated at the
      // first ball, and the reader joins instantly at any minute
      return "#/feed?n=" + encodeURIComponent(rid) + "&f=" + fi;
    } catch (e) { return null; }
  };
  window.foRenderWatchPage = function () {
    var page = document.getElementById("page"); if (!page || !P() || !cx()) return;
    foWtCss();
    document.body.classList.add("fo-wt-on");
    var pl = P(), now = Date.now(), p = pl.phaseOf(now);
    var q = qs();
    var regions = (cx().regions() || []).filter(function (r) { return !r.final; });
    var my = null; try { my = (window.__foLgAPI && __foLgAPI.nation && __foLgAPI.nation()) || "eng"; } catch (e) { my = "eng"; }
    var rid = q.n && regions.some(function (r) { return r.id === q.n; }) ? q.n : null;
    if (!rid) {
      // no nation asked for: the loudest live one, else the next to play
      var live = regions.filter(function (r) { return r.id !== my; }).sort(function (a, b) { return pl.natHour(a.id) - pl.natHour(b.id); });
      var hNow = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
      rid = (live.filter(function (r) { var h0 = pl.natHour(r.id); return hNow >= h0 && hNow < h0 + (pl.LIVE_LEN || 3); })[0] ||
             live.filter(function (r) { return pl.natHour(r.id) > hNow; })[0] || live[0] || {}).id;
    }
    if (!rid) { page.innerHTML = "<div class='fo-wt'><p style='padding:80px 20px;color:#fff'>The world is quiet.</p></div>"; return; }
    var region = regions.filter(function (r) { return r.id === rid; })[0];
    var sv = serverFixtures(rid, now);
    var round = sv.cal.round, fx = sv.fx;
    if (!fx.length) {
      page.innerHTML = "<div class='fo-wt'><div class='fo-wt-in'><p style='padding:80px 20px;color:#fff'>No fixtures today in this league - the season is between rounds.</p><a class='fo-wt-back' href='#/planet'>&lsaquo; World cricket</a></div></div>";
      return;
    }
    var fi = Math.max(0, Math.min(fx.length - 1, parseInt(q.f || "0", 10) || 0));
    var m = fx[fi];
    var h0 = pl.natHour(rid);
    var hNowW = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
    var state = hNowW < h0 ? "up" : hNowW < h0 + (pl.LIVE_LEN || 3) ? "live" : "fin";
    // a link marked go=1 wants the broadcast itself, not this page - join it.
    // A JOIN THAT FAILS MUST NOT STRAND THE READER on the curtain: if the
    // broadcast has not started shortly, clear the cached refusal and try
    // once more; if it still will not start, put the fixtures page up.
    if (q.go) {
      // the engine-replay join is retired for league cricket: the umpire
      // simulated this match at the first ball, and the feed page reads it
      location.hash = "#/feed?n=" + encodeURIComponent(rid) + "&f=" + fi;
      if (typeof window.route === "function") window.route();
      return;
    }
    if (false) {
      page.innerHTML = "<div class='fo-wt'><p style='padding:80px 20px;color:#fff;font:400 15px Fraunces,Georgia,serif'>Joining the broadcast&hellip; " +
        "<a href='#/watch?n=" + encodeURIComponent(rid) + "&f=" + fi + "' style='color:#E8B96A;text-decoration:underline'>taking long? open the fixtures page</a></p></div>";
      setTimeout(function () { try { window.foWtSpectate(rid, null, null, fi); } catch (eGo) {} }, 30);
      var goBusy = function () { try { return typeof M !== "undefined" && M && !M.done && M.meta && M.meta.__spectate; } catch (eB) { return false; } };
      setTimeout(function () {
        if ((location.hash || "").split("?")[0] !== "#/watch" || goBusy()) return;
        try { delete ORD_CACHE[rid + ":" + round]; } catch (eC) {}
        try { window.foWtSpectate(rid, null, null, fi); } catch (eG2) {}
      }, 7000);
      setTimeout(function () {
        if ((location.hash || "").split("?")[0] !== "#/watch" || goBusy()) return;
        location.hash = "#/watch?n=" + encodeURIComponent(rid) + "&f=" + fi;
        try { if (typeof window.route === "function") window.route(); } catch (eR) {}
      }, 15000);
      return;
    }

    var hh0 = (function(h9){try{return window.__foPlanet.hhTxt(h9);}catch(e9){return (h9<10?"0":"")+h9+":00";}})(h0);
    // T-minus one hour: the teamsheets are public - show the ACTUAL elevens,
    // a claimed manager's named XI and the engine's own pick for the bots
    var teamsIn = state === "up" && (h0 - hNowW) <= 1;
    var stateChip = state === "live" ? "<span class='fo-wt-live'><i></i>LIVE</span>"
      : state === "up" ? "<span class='fo-wt-soon'>" + (teamsIn ? "TEAMS IN &middot; " : "") + "PLAY AT " + hh0 + "</span>"
      : "<span class='fo-wt-fin'>STUMPS</span>";
    var bugLine = state === "live" ? "In play now &middot; the broadcast has every ball"
      : state === "fin" ? "Played &middot; enter the theatre to watch it back"
      : teamsIn ? "The teamsheets are in &middot; first ball " + hh0
      : "First ball " + hh0;
    var xiHTML = "";
    if (teamsIn) {
      var keyTI = rid + ":" + round, ov = ORD_VAL[keyTI];
      if (ov === undefined) {
        roundOrders(rid, round).then(function () {
          try { if ((location.hash || "").split("?")[0] === "#/watch") window.foRenderWatchPage(); } catch (eTi) {}
        });
        xiHTML = "<div class='fo-wt-teamsin'><span class='ld'>Fetching the named elevens&hellip;</span></div>";
      } else {
        var sqHt = serverSquad(rid, m.home.slot) || [], sqAt = serverSquad(rid, m.away.slot) || [];
        var xiCol = function (nm, sq, ord) {
          var xi = actualXI(sq, ord);
          return "<div class='c'><b>" + E(nm) + "</b>" + (ord ? "<u>manager's named XI</u>" : "<u>the engine's pick</u>") +
            xi.map(function (p, k) { return "<span><i>" + (k + 1) + "</i>" + E(p.name) + foNS(p.name, rid) + (p.keeper ? " &dagger;" : p.bowlType ? " &#9679;" : "") + "</span>"; }).join("") + "</div>";
        };
        xiHTML = "<div class='fo-wt-teamsin'><div class='cols'>" +
          xiCol(m.home.name, sqHt, ov[m.home.name]) + xiCol(m.away.name, sqAt, ov[m.away.name]) + "</div></div>";
      }
    }

    var others = fx.map(function (m2, i2) {
      if (i2 === fi) return "";
      return "<a class='fo-wt-other' href='#/watch?n=" + rid + "&f=" + i2 + "'>" +
        "<b>" + E(m2.home.name) + " v " + E(m2.away.name) + "</b>" +
        "<span" + (state === "live" ? " class='lv'" : "") + ">" + (state === "live" ? "&#9679; in play" : state === "fin" ? "played" : "later today") + "</span></a>";
    }).join("");

    // a clean white page: the stadium painting made the reading matter fight
    // for contrast, so the art stays in the theatre and the listings live on
    // paper like the rest of the daylight game
    page.innerHTML = "<div class='fo-wt'>" +
      "<div class='fo-wt-in'>" +
      "<div class='fo-wt-top'><a class='fo-wt-back' href='#/planet'>&lsaquo; World</a>" +
      "<img class='fo-wt-flag' src='" + flagOf(rid) + "' alt=''>" +
      "<span class='fo-wt-league'>" + E(region ? region.nm : rid) + " &middot; round " + round + "</span>" + stateChip + "</div>" +
      "<div class='fo-wt-stage'>" +
      "<div class='fo-wt-ground'>" + E(m.home.name) + "&rsquo;s ground &middot; " + E(m.home.city || "") + "</div>" +
      "<div class='fo-wt-bug'>" +
      "<div class='fo-wt-teams'><b>" + E(m.home.name) + "</b><i>v</i><b>" + E(m.away.name) + "</b></div>" +
      "<div class='fo-wt-score'>" + bugLine + "</div>" +
      xiHTML +
      (state !== "up" ? "<a class='fo-wt-enter' href='#/feed?n=" + encodeURIComponent(rid) + "&f=" + fi + "'>" +
        (state === "live" ? "Watch the live broadcast &rsaquo;" : "Watch it back &rsaquo;") + "</a>" : "") +
      "</div></div>" +
      (others ? "<div class='fo-wt-rail'><i>Also in this round</i>" + others + "</div>" : "") +
      "<div class='fo-wt-natsw'><i>Other leagues today &middot; first ball, your time</i>" +
      "<div class='fo-wt-nats'>" + regions.filter(function (r) { return r.id !== my; }).sort(function (a, b) { return pl.natHour(a.id) - pl.natHour(b.id); }).map(function (r) {
        var hh2 = pl.natHour(r.id);
        var hNow2 = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
        var on = p.kind === "league" && hNow2 >= hh2 && hNow2 < hh2 + (pl.LIVE_LEN || 3);
        return "<a class='fo-wt-nat" + (r.id === rid ? " sel" : "") + (on ? " on" : "") + "' href='#/watch?n=" + r.id + "'>" +
          "<img src='" + flagOf(r.id) + "' alt=''><i>" + (on ? "live" : (hh2 < 10 ? "0" : "") + hh2 + ":00") + "</i></a>";
      }).join("") + "</div></div>" +
      "</div></div>";

    // the broadcast breathes: refresh while watching, stop when we leave
    try { if (window.__foWtTimer) clearInterval(window.__foWtTimer); } catch (e) {}
    window.__foWtTimer = setInterval(function () {
      if ((location.hash || "").split("?")[0] !== "#/watch") { clearInterval(window.__foWtTimer); return; }
      try { window.foRenderWatchPage(); } catch (e) {}
    }, 25000);
  };
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] !== "#/watch") document.body.classList.remove("fo-wt-on");
  });

  // the server mirror, exported: nation pages list the same fixtures, the
  // same calendar and the same live states the theatre plays from
  window.__foWT = { flagOf: flagOf, forgetSquads: forgetSquads,
    get guessedSquad() { return GUESSED; }, serverFixtures: serverFixtures, serverCal: serverCal, schedMirror: schedMirror, divMembers: divMembers,
    serverSquad: serverSquad, applyLiving: applyLiving,
    // A CLUB WITH NO MANAGER STILL FIELDS ELEVEN MEN. The watch page has
    // named them since it was built - the engine's pick is a pure function of
    // the squad - and the broadcast's Lineups tab was the one room that
    // shrugged and said the XI would be settled at the toss. One function,
    // one answer, wherever it is asked.
    actualXI: actualXI,
    // THE MATCH ON RECORD IS NOT THE MATCH FROM A CLEAN SEED. The umpire plays
    // each round with the men as they were that day - the experience, the
    // form, the tiredness - and with whatever sheets managers filed. The
    // broadcast has always asked the world for both before it shows you a
    // ball. The match REPORT was rebuilding from bare generated squads and no
    // orders, so its replay disagreed with the book and fell back to a
    // scoreline. Same door, same cache, one promise: { orders, living }.
    roundState: function (rid, roundNo) {
      var key = rid + ":" + roundNo;
      return roundOrders(rid, roundNo).then(function (om) {
        return { orders: om || {}, living: LIV_VAL[key] || null };
      }).catch(function () { return { orders: {}, living: null }; });
    } };

  function foWtCss() {
    if (document.getElementById("fo-wt-css")) return;
    var s = document.createElement("style"); s.id = "fo-wt-css";
    // A CLEAN WHITE ROOM. The listings sit on paper like every other daylight
    // page; the only block of colour is the navy broadcast bug, which is the
    // one thing on the page that IS a broadcast.
    s.textContent = [
      // the daylight theme's own cream (#F1EEE6), not clinical white - the
      // page belongs to the same paper as every other room
      "html body.ftpskin.fo-wt-on,html body.fo-wt-on{background:#F1EEE6 !important}",
      "html body.fo-wt-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-wt-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-wt{position:relative;min-height:70vh;color:#14243A}",
      ".fo-wt-in{max-width:680px;margin:0 auto;padding:18px 16px 60px}",
      ".fo-wt-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap}",
      ".fo-wt-back{font:600 13px/1 Manrope,sans-serif;color:#3a4353 !important;text-decoration:none !important;border:1px solid rgba(14,35,63,.22);border-radius:999px;padding:7px 13px;background:#fff}",
      ".fo-wt-flag{width:26px;height:18px;object-fit:cover;border-radius:3px;box-shadow:0 1px 3px rgba(14,35,63,.25)}",
      ".fo-wt-league{font:700 11px/1 Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A}",
      ".fo-wt-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font:800 11px/1 Manrope,sans-serif;letter-spacing:.14em;color:#B23230}",
      ".fo-wt-live i{width:8px;height:8px;border-radius:50%;background:#B23230;animation:foWtPulse 1.2s ease-in-out infinite}",
      "@keyframes foWtPulse{0%,100%{opacity:1}50%{opacity:.25}}",
      ".fo-wt-soon,.fo-wt-fin{margin-left:auto;font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;color:rgba(20,32,47,.55)}",
      ".fo-wt-stage{padding:16px 0 4px}",
      ".fo-wt-ground{font:600 13px/1.4 Manrope,sans-serif;color:rgba(20,32,47,.55);margin-bottom:7px}",
      ".fo-wt-bug{background:#14243A;border-left:3px solid #C9571F;border-radius:16px;padding:15px 17px;color:#FFFEFC;box-shadow:0 8px 24px rgba(14,35,63,.18)}",
      ".fo-wt-teams{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".fo-wt-teams b{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:18px;color:#FFFEFC}",
      ".fo-wt-teams i{font-style:normal;font-size:11px;color:rgba(255,254,252,.5)}",
      ".fo-wt-score{font:700 15px/1.3 Manrope,sans-serif;letter-spacing:.04em;color:#E8B96A;margin-top:7px}",
      ".fo-wt-crease{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font:400 13px/1.5 Manrope,sans-serif;color:rgba(255,254,252,.85);flex-wrap:wrap}",
      ".fo-wt-crease u{text-decoration:none;color:#FFFEFC;font-weight:600}",
      ".fo-wt-over{display:flex;gap:6px;margin-top:10px}",
      ".fo-wt-over i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,254,252,.1);border:1px solid rgba(255,254,252,.18);font:700 11px/1 Manrope,sans-serif;color:#E8DFCE}",
      ".fo-wt-over i.b{background:rgba(232,185,106,.2);border-color:#E8B96A;color:#E8B96A}",
      ".fo-wt-over i.w{background:rgba(255,107,94,.22);border-color:#FF8A7A;color:#FF8A7A}",
      ".fo-wt-comm{font:400 13px/1.5 Fraunces,Georgia,serif;color:rgba(255,254,252,.65);margin-top:9px}",
      ".fo-wt-enter{display:block;width:100%;margin-top:12px;font:700 12px/1 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:#C9571F !important;border:none !important;border-radius:999px !important;padding:13px 16px !important;cursor:pointer;text-align:center;text-decoration:none !important}",
      ".fo-wt-teamsin{margin-top:12px;border-top:1px solid rgba(255,254,252,.14);padding-top:11px}",
      ".fo-wt-teamsin .ld{font:400 13px/1.4 Manrope,sans-serif;color:rgba(255,254,252,.65)}",
      ".fo-wt-teamsin .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      ".fo-wt-teamsin .c b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:13px;margin-bottom:2px}",
      ".fo-wt-teamsin .c u{display:block;text-decoration:none;font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#E8B96A;margin-bottom:6px}",
      ".fo-wt-teamsin .c span{display:flex;align-items:baseline;gap:6px;font:400 13px/1.55 Manrope,sans-serif;color:rgba(255,254,252,.85)}",
      ".fo-wt-teamsin .c span i{font-style:normal;font:700 11px/1 Manrope,sans-serif;color:rgba(255,254,252,.4);width:12px;text-align:right}",
      "@media(max-width:430px){.fo-wt-teamsin .cols{grid-template-columns:1fr}}",
      // the daylight anchor rule would paint the row links terracotta; on
      // paper they read as ink instead, in every state
      "html body #page .fo-wt a.fo-wt-other,html body.ftpskin #page .fo-wt a.fo-wt-other,html body #page .fo-wt a.fo-wt-other:visited,html body #page .fo-wt a.fo-wt-other:hover,html body #page .fo-wt a.fo-wt-other:active{color:#14243A !important;text-decoration:none !important}",
      "html body #page .fo-wt a.fo-wt-nat,html body #page .fo-wt a.fo-wt-nat:hover,html body #page .fo-wt a.fo-wt-back:hover{text-decoration:none !important}",
      ".fo-wt-rail{margin-top:18px}",
      ".fo-wt-rail>i{display:block;font:700 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,32,47,.5);font-style:normal;margin-bottom:8px}",
      ".fo-wt-other{display:flex;justify-content:space-between;gap:10px;align-items:baseline;background:#fff;border:1px solid rgba(14,35,63,.14);border-radius:11px;padding:11px 14px;margin-bottom:7px;text-decoration:none;color:#14243A;box-shadow:0 1px 3px rgba(14,35,63,.05)}",
      ".fo-wt-other b{font:600 12.5px/1.35 Manrope,sans-serif}",
      ".fo-wt-other span{font:400 13px/1.3 Manrope,sans-serif;color:rgba(20,32,47,.5);white-space:nowrap}",
      ".fo-wt-other span.lv{color:#B23230;font-weight:600}",
      ".fo-wt-natsw{margin-top:18px;background:#fff;border:1px solid rgba(14,35,63,.14);border-radius:13px;padding:10px 12px 7px}",
      ".fo-wt-natsw>i{display:block;font:700 11px/1 Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,32,47,.5);font-style:normal;margin-bottom:8px}",
      ".fo-wt-nats{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;mask-image:linear-gradient(90deg,#000 92%,transparent);-webkit-mask-image:linear-gradient(90deg,#000 92%,transparent)}",
      ".fo-wt-nats::-webkit-scrollbar{display:none}",
      ".fo-wt-nat{flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none;opacity:.8}",
      ".fo-wt-nat img{width:30px;height:21px;object-fit:cover;border-radius:4px;border:2px solid transparent;box-shadow:0 1px 3px rgba(14,35,63,.2)}",
      ".fo-wt-nat.sel img{border-color:#C9571F}",
      ".fo-wt-nat.on img{border-color:#B23230;box-shadow:0 0 0 3px rgba(178,50,48,.18)}",
      ".fo-wt-nat.on{opacity:1}",
      ".fo-wt-nat i{font:700 11px/1 Manrope,sans-serif;color:rgba(20,32,47,.55);font-style:normal;letter-spacing:.04em}",
      ".fo-wt-nat.on i{color:#B23230}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
