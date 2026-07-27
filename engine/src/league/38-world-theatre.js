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
  function serverSquad(rid, slot) {
    var cfg = regionCfg(rid); if (!cfg) return null;
    try {
      var g = __foGenArchetypeSquad("world1|" + rid + "|" + slot, cfg.nat, cfg.arch, slot === 0 ? cfg.capt : "general");
      return (g && g.players) || null;
    } catch (e) { return null; }
  }
  // the server's calendar: season/round for a world day (season 1 = day 5)
  var WORLD_START = 0;
  function serverCal(now) {
    var d = P().dayIx(now), rel = d - WORLD_START;
    return { seasonNo: Math.floor(rel / 25) + 1, round: (rel % 25) + 1, dayInSeason: rel % 25 };
  }
  // the server's schedule, mirrored: same circle method, same season shuffle
  function schedMirror(rid, seasonNo) {
    var N = 10, idx = []; for (var z = 0; z < N; z++) idx.push(z);
    var seed = h32(rid + "|order|" + seasonNo);
    for (var i = N - 1; i > 0; i--) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; var j = seed % (i + 1); var t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var list = idx.slice(), rounds = [];
    for (var r = 0; r < N - 1; r++) {
      var rd = [];
      for (var k = 0; k < N / 2; k++) { var a = list[k], b = list[N - 1 - k]; rd.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(rd);
      list = [list[0], list[N - 1]].concat(list.slice(1, N - 1));
    }
    for (var r2 = 0; r2 < N - 1; r2++) rounds.push(rounds[r2].map(function (f) { return [f[1], f[0]]; }));
    return rounds;
  }
  function serverFixtures(rid, now) {
    var pl = P(), cal = serverCal(now);
    if (cal.seasonNo < 1 || cal.dayInSeason < 0 || cal.dayInSeason > 17) return { cal: cal, fx: [] };
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
      if (apiBase) p = Promise.resolve({});    // the plain-JSON service has no RPC surface
      else p = fetch(SB_URL + "/rest/v1/rpc/world_round_orders", {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: "Bearer " + SB_ANON, "content-type": "application/json" },
        body: JSON.stringify({ p_country: rid, p_round: roundNo })
      }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { LIV_VAL[key] = (j && j.living) || null; return (j && j.orders) || {}; });
    } catch (e) { p = Promise.resolve({}); }
    p = p.catch(function () { return {}; }).then(function (v) { ORD_VAL[key] = v; return v; });
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
  function applyLiving(players, patch) {
    if (!players || !patch) return players;
    players.forEach(function (p) {
      var L = p && patch[p.name]; if (!L) return;
      if (L.e != null) { p.exp = L.e; p.expWord = EXPLAD[Math.max(0, Math.min(11, Math.floor(L.e / 9)))]; }
      if (L.f != null) { p.formIx = L.f; p.formWord = FORMW[L.f] || "steady"; }
      if (L.n != null) { p.fatN = L.n; p.fatWord = fatWordOf(L.n); p.fatigue = p.fatWord; }
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
  window.foWtSpectate = function (rid, season, round, fi) {
    try {
      if (typeof M !== "undefined" && M && !M.done && M.meta && !M.meta.__spectate) {
        alert("A match of yours is in progress - finish it first."); return;
      }
      var sv = serverFixtures(rid, Date.now()), m = sv.fx[fi];
      if (!m) return;
      var cal = sv.cal, srvRound = cal.round;
      // no early broadcasts: bot or human, a match cannot be watched (and its
      // result cannot be learned) before its scheduled first ball
      var plG = P(), nowG = Date.now();
      var hNowG = (nowG - (plG.EPOCH + plG.dayIx(nowG) * 86400000)) / 3600000;
      var h0G = plG.natHour(rid);
      if (hNowG < h0G) {
        alert("The first ball is at " + (h0G < 10 ? "0" : "") + h0G + ":00 UTC - the broadcast opens then.");
        return;
      }
      // fetch the round's revealed orders first (fast, cached); a slow or
      // failed service never blocks the broadcast - after 2.5s we go with
      // bot orders, which is exact whenever no club in the league is claimed
      var started = false;
      var begin = function (om) { if (started) return; started = true; foWtBegin(rid, sv, fi, om || {}); };
      var fallbackT = setTimeout(function () { begin({}); }, 2500);
      roundOrders(rid, srvRound).then(function (om) { clearTimeout(fallbackT); begin(om); });
    } catch (e) { try { console.warn("foWtSpectate", e); } catch (e2) {} }
  };
  function foWtBegin(rid, sv, fi, ordersMap) {
    try {
      var m = sv.fx[fi], cal = sv.cal, srvRound = cal.round;
      var sqH = serverSquad(rid, m.home.slot), sqA = serverSquad(rid, m.away.slot);
      if (!sqH || !sqA) { alert("The squads are still warming up - try again in a moment."); return; }
      var liv = LIV_VAL[rid + ":" + srvRound];
      if (liv) { applyLiving(sqH, liv[m.home.name]); applyLiving(sqA, liv[m.away.name]); }
      var home = { name: m.home.name, ground: (m.home.city || m.home.name) + " Ground", players: sqH };
      var away = { name: m.away.name, players: sqA };
      var matchId = rid + ":s" + cal.seasonNo + ":r" + srvRound + ":h" + m.home.slot + "a" + m.away.slot;
      var seed = h32(matchId) || 1;
      window.onMatchEnd = function () {};
      M = newMatch(home, away, "balanced", seed);
      M.meta = { home: home.name, away: away.name, pitch: "balanced", weather: "Sunny", comp: "world", ground: home.ground, __spectate: 1, isUser: false };
      M.isUserMatch = false; M.ordersMap = ordersMap || {};
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
      while (M && !M.done && window.__foWtBall < target0) { autoPick(); stepBall(); window.__foWtBall++; }
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
      location.hash = "#/match";
      if (typeof window.route === "function") window.route();
    } catch (e) { try { console.warn("foWtSpectate", e); } catch (e2) {} }
  };

  // ---- FRIENDLIES IN THE THEATRE: watched == recorded, no stakes attached --
  // From the first ball, a friendly is a broadcast like any league match:
  // the detail RPC hands over both clubs (current names), the sealed
  // lineups exactly as the umpire uses them, and the kick-off; the seed is
  // FNV('friendly:'+id) on both hosts. Live it paces on the world clock
  // across a three-hour window; after stumps it replays from ball one.
  window.foWtFriendly = function (fid) {
    try {
      if (typeof M !== "undefined" && M && !M.done && M.meta && !M.meta.__spectate) {
        alert("A match of yours is in progress - finish it first."); return;
      }
      fetch(SB_URL + "/rest/v1/rpc/world_friendly_detail", {
        method: "POST",
        headers: { apikey: SB_ANON, Authorization: "Bearer " + SB_ANON, "content-type": "application/json" },
        body: JSON.stringify({ p_id: +fid })
      }).then(function (r) { return r.text().then(function (t) { var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {} if (!r.ok) throw new Error((j && j.message) || "HTTP " + r.status); return j; }); })
        .then(function (d) {
          if (!d || !d.home) return;
          var nowT = Date.now();
          if (nowT < d.playAtMs) {
            var dD = new Date(d.playAtMs), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
            alert("The first ball is at " + p2(dD.getHours()) + ":" + p2(dD.getMinutes()) + " - the broadcast opens then.");
            return;
          }
          var sqH = serverSquad(d.home.country, d.home.slot), sqA = serverSquad(d.away.country, d.away.slot);
          if (!sqH || !sqA) { alert("The squads are still warming up - try again in a moment."); return; }
          if (d.living) { applyLiving(sqH, d.living[d.home.name]); applyLiving(sqA, d.living[d.away.name]); }
          var home = { name: d.home.name, ground: d.home.name + "'s ground", players: sqH };
          var away = { name: d.away.name, players: sqA };
          var seed = h32("friendly:" + d.id) || 1;
          window.onMatchEnd = function () {};
          M = newMatch(home, away, "balanced", seed);
          M.meta = { home: home.name, away: away.name, pitch: "balanced", weather: "Sunny", comp: "friendly", ground: home.ground, __spectate: 1, isUser: false };
          M.isUserMatch = false; M.ordersMap = d.orders || {};
          App.tossState = { stage: "x" };
          applyToss(aiTossDecision());
          var winStart = d.playAtMs, winLen = 3 * 3600000, BALL_MS = winLen / 600;
          var liveBall = function (t) {
            if (t >= winStart + winLen) return 1e9;
            var n = Math.floor((t - winStart) / BALL_MS);
            return n > 0 ? n : 0;
          };
          var isLive = nowT >= winStart && nowT < winStart + winLen;
          window.__foWtBall = 0;
          var target0 = isLive ? liveBall(nowT) : 0;
          while (M && !M.done && window.__foWtBall < target0) { autoPick(); stepBall(); window.__foWtBall++; }
          try { if (window.__foWtDrv) clearInterval(window.__foWtDrv); } catch (e) {}
          window.__foWtDrv = setInterval(function () {
            try {
              if ((location.hash || "").split("?")[0] !== "#/match" || !M || !M.meta || !M.meta.__spectate) { clearInterval(window.__foWtDrv); return; }
              if (M.done) { clearInterval(window.__foWtDrv); return; }
              if (isLive) {
                var tb = liveBall(Date.now()), guard = 0;
                while (M && !M.done && window.__foWtBall < tb && guard++ < 650) { autoPick(); stepBall(); window.__foWtBall++; }
              } else {
                autoPick(); stepBall(); window.__foWtBall++;
              }
            } catch (e) { clearInterval(window.__foWtDrv); }
          }, isLive ? 1000 : 2200);
          location.hash = "#/match";
          if (typeof window.route === "function") window.route();
        })
        .catch(function (e) { alert(String(e.message || "The world could not be reached.").slice(0, 140)); });
    } catch (e) { try { console.warn("foWtFriendly", e); } catch (e2) {} }
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

    var hh0 = (h0 < 10 ? "0" : "") + h0 + ":00 UTC";
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
            xi.map(function (p, k) { return "<span><i>" + (k + 1) + "</i>" + E(p.name) + (p.keeper ? " &dagger;" : p.bowlType ? " &#9679;" : "") + "</span>"; }).join("") + "</div>";
        };
        xiHTML = "<div class='fo-wt-teamsin'><div class='cols'>" +
          xiCol(m.home.name, sqHt, ov[m.home.name]) + xiCol(m.away.name, sqAt, ov[m.away.name]) + "</div></div>";
      }
    }

    var others = fx.map(function (m2, i2) {
      if (i2 === fi) return "";
      return "<a class='fo-wt-other' href='#/watch?n=" + rid + "&f=" + i2 + "'>" +
        "<b>" + E(m2.home.name) + " v " + E(m2.away.name) + "</b>" +
        "<span>" + (state === "live" ? "&#9679; in play" : state === "fin" ? "played" : "later today") + "</span></a>";
    }).join("");

    page.innerHTML = "<div class='fo-wt'>" +
      "<div class='fo-wt-bg' id='fo-wt-bg'></div><div class='fo-wt-veil'></div>" +
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
      (state !== "up" ? "<button type='button' class='fo-wt-enter' onclick='foWtSpectate(\"" + rid + "\",0,0," + fi + ")'>" +
        (state === "live" ? "Enter the broadcast theatre &rsaquo;" : "Watch it back in the theatre &rsaquo;") + "</button>" : "") +
      "</div></div>" +
      (others ? "<div class='fo-wt-rail'><i>Also in this round</i>" + others + "</div>" : "") +
      "<div class='fo-wt-nats'>" + regions.filter(function (r) { return r.id !== my; }).sort(function (a, b) { return pl.natHour(a.id) - pl.natHour(b.id); }).map(function (r) {
        var hh2 = pl.natHour(r.id);
        var hNow2 = (now - (pl.EPOCH + pl.dayIx(now) * 86400000)) / 3600000;
        var on = p.kind === "league" && hNow2 >= hh2 && hNow2 < hh2 + (pl.LIVE_LEN || 3);
        return "<a class='fo-wt-nat" + (r.id === rid ? " sel" : "") + (on ? " on" : "") + "' href='#/watch?n=" + r.id + "'>" +
          "<img src='" + flagOf(r.id) + "' alt=''><i>" + (hh2 < 10 ? "0" : "") + hh2 + "</i></a>";
      }).join("") + "</div>" +
      "</div></div>";

    mountGround(document.getElementById("fo-wt-bg"), groundChain(m.home.city, rid), 0);

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
  window.__foWT = { serverFixtures: serverFixtures, serverCal: serverCal, schedMirror: schedMirror,
    serverSquad: serverSquad, applyLiving: applyLiving };

  function foWtCss() {
    if (document.getElementById("fo-wt-css")) return;
    var s = document.createElement("style"); s.id = "fo-wt-css";
    s.textContent = [
      "html body.ftpskin.fo-wt-on,html body.fo-wt-on{background:#07101E !important}",
      "html body.fo-wt-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-wt-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-wt{position:relative;min-height:100vh;color:#FFFEFC;isolation:isolate}",
      ".fo-wt-bg{position:fixed;inset:0;background-size:cover;background-position:50% 40%;z-index:-2;transition:background-image .4s ease}",
      ".fo-wt-veil{position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(7,16,30,.72),rgba(7,16,30,.25) 30%,rgba(7,16,30,.3) 62%,rgba(7,16,30,.88))}",
      ".fo-wt-in{max-width:680px;margin:0 auto;padding:64px 16px 90px;display:flex;flex-direction:column;min-height:100vh}",
      ".fo-wt-top{display:flex;align-items:center;gap:9px;flex-wrap:wrap}",
      ".fo-wt-back{font:600 12px/1 Inter,sans-serif;color:rgba(255,254,252,.8);text-decoration:none;border:1px solid rgba(255,254,252,.25);border-radius:999px;padding:7px 13px}",
      ".fo-wt-flag{width:26px;height:18px;object-fit:cover;border-radius:3px}",
      ".fo-wt-league{font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#E8DFCE}",
      ".fo-wt-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font:800 10px/1 Oswald,sans-serif;letter-spacing:.14em;color:#FF6B5E}",
      ".fo-wt-live i{width:8px;height:8px;border-radius:50%;background:#FF6B5E;animation:foWtPulse 1.2s ease-in-out infinite}",
      "@keyframes foWtPulse{0%,100%{opacity:1}50%{opacity:.25}}",
      ".fo-wt-soon,.fo-wt-fin{margin-left:auto;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;color:rgba(255,254,252,.65)}",
      ".fo-wt-stage{flex:1;display:flex;flex-direction:column;justify-content:flex-end;padding:40px 0 12px}",
      ".fo-wt-ground{font:italic 400 12.5px/1.4 'Fraunces',Georgia,serif;color:rgba(255,254,252,.75);text-shadow:0 2px 10px rgba(0,0,0,.6);margin-bottom:8px}",
      ".fo-wt-bug{background:rgba(6,13,26,.82);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgba(255,254,252,.14);border-left:3px solid #C95532;border-radius:16px;padding:15px 17px;box-shadow:0 18px 44px rgba(0,0,0,.5)}",
      ".fo-wt-teams{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}",
      ".fo-wt-teams b{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:18px}",
      ".fo-wt-teams i{font-style:italic;font-size:11px;color:rgba(255,254,252,.5)}",
      ".fo-wt-score{font:700 15px/1.3 Oswald,sans-serif;letter-spacing:.04em;color:#E8B96A;margin-top:7px}",
      ".fo-wt-crease{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font:400 11.5px/1.5 Inter,sans-serif;color:rgba(255,254,252,.8);flex-wrap:wrap}",
      ".fo-wt-crease u{text-decoration:none;color:#FFFEFC;font-weight:600}",
      ".fo-wt-over{display:flex;gap:6px;margin-top:10px}",
      ".fo-wt-over i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,254,252,.1);border:1px solid rgba(255,254,252,.18);font:700 11px/1 Oswald,sans-serif;color:#E8DFCE}",
      ".fo-wt-over i.b{background:rgba(232,185,106,.2);border-color:#E8B96A;color:#E8B96A}",
      ".fo-wt-over i.w{background:rgba(255,107,94,.22);border-color:#FF6B5E;color:#FF6B5E}",
      ".fo-wt-comm{font:italic 400 12px/1.5 'Fraunces',Georgia,serif;color:rgba(255,254,252,.65);margin-top:9px}",
      ".fo-wt-enter{display:block;width:100%;margin-top:12px;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:#C95532 !important;border:none !important;border-radius:999px !important;padding:13px 16px !important;cursor:pointer}",
      ".fo-wt-teamsin{margin-top:12px;border-top:1px solid rgba(255,254,252,.14);padding-top:11px}",
      ".fo-wt-teamsin .ld{font:italic 400 12px/1.4 'Fraunces',Georgia,serif;color:rgba(255,254,252,.65)}",
      ".fo-wt-teamsin .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      ".fo-wt-teamsin .c b{display:block;font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:13px;margin-bottom:2px}",
      ".fo-wt-teamsin .c u{display:block;text-decoration:none;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#E8B96A;margin-bottom:6px}",
      ".fo-wt-teamsin .c span{display:flex;align-items:baseline;gap:6px;font:400 11.5px/1.55 Inter,sans-serif;color:rgba(255,254,252,.85)}",
      ".fo-wt-teamsin .c span i{font-style:normal;font:700 9px/1 Oswald,sans-serif;color:rgba(255,254,252,.4);width:12px;text-align:right}",
      "@media(max-width:430px){.fo-wt-teamsin .cols{grid-template-columns:1fr}}",
      ".fo-wt-rail{margin-top:14px}",
      ".fo-wt-rail>i{display:block;font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,254,252,.5);font-style:normal;margin-bottom:7px}",
      ".fo-wt-other{display:flex;justify-content:space-between;gap:10px;align-items:baseline;background:rgba(6,13,26,.6);border:1px solid rgba(255,254,252,.1);border-radius:11px;padding:9px 13px;margin-bottom:7px;text-decoration:none;color:#FFFEFC}",
      ".fo-wt-other b{font:600 12px/1.3 Inter,sans-serif}",
      ".fo-wt-other span{font:400 11px/1.3 Inter,sans-serif;color:rgba(255,254,252,.6);white-space:nowrap}",
      ".fo-wt-nats{display:flex;gap:7px;overflow-x:auto;margin-top:14px;padding-bottom:4px}",
      ".fo-wt-nat{flex:none;display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;opacity:.75}",
      ".fo-wt-nat img{width:28px;height:20px;object-fit:cover;border-radius:4px;border:2px solid transparent}",
      ".fo-wt-nat.sel img{border-color:#C95532}",
      ".fo-wt-nat.on img{border-color:#FF6B5E;box-shadow:0 0 0 3px rgba(255,107,94,.25)}",
      ".fo-wt-nat.on{opacity:1}",
      ".fo-wt-nat i{font:700 8.5px/1 Oswald,sans-serif;color:rgba(255,254,252,.6);font-style:normal}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
