  // ===========================================================================
  //  Premium Club home. A fully custom, branded dashboard that replaces the
  //  engine's default pgClub (same data + game hooks, modern presentation).
  // ===========================================================================
  var FO_MOODS = ["Furious", "Angry", "Restless", "Steady", "Pleased", "Delighted", "Euphoric"];
  // =========================================================================
  // Finance: the ONE place per-round money math lives. Every page that shows
  // burn, net, runway or projections reads from here. The model mirrors what
  // the resolver actually settles each round (resolve-harness fair-settle):
  //   income = sponsor base (+ gate at the resolver's crowd model, home only)
  //   outgo  = wages (incl. injured) + $1/seat upkeep + academy upkeep table
  // Win bonuses are result-dependent and deliberately excluded from forecasts.
  // =========================================================================
  window.FoFinance = (function () {
    var ACAD = [0, 4000, 8000, 14000, 22000, 32000];
    function club() { try { return foMyClub() || userTeam(); } catch (e) { return userTeam(); } }
    function isMP() { return !!(typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice); }
    function wages(t) { t = t || club(); return (t.players || []).concat(t.injured || []).reduce(function (s2, p) { return s2 + (+p.wage || 0); }, 0); }
    function acadUpkeepAt(level) {
      return isMP() ? (ACAD[Math.max(0, Math.min(5, level || 0))] || 0) : 2500 * (level || 0);
    }
    function acadUpkeep(t) { t = t || club(); return isMP() ? acadUpkeepAt(t.acadS) : 2500 * ((t.acadY || 0) + (t.acadS || 0)); }
    function gateAttendance(t) {
      t = t || club();
      if (!isMP() && typeof attendance === "function") { try { return attendance(t); } catch (e) {} }
      return Math.min(t.seats || 9000, Math.round((t.supporters || 2600) * (0.55 + 0.13 * (t.mood == null ? 3 : t.mood))));
    }
    function gate(t) { return gateAttendance(t) * ((FO_FIN && FO_FIN.ticketPrice) || 9); }
    function sponsorBase(t) { try { return foDealResolve(t || club()).d.base; } catch (e) { return 45000; } }
    function trainIntensityCost(t) {
      if (isMP()) return 0;   // the resolver never charges intensity
      try { return typeof trainingCost === "function" ? trainingCost(t || club()) : 0; } catch (e) { return 0; }
    }
    function paysSponsor() { return isMP(); }
    function chargesWages() { return isMP(); }
    function fixtures() { try { return foUserFixtures() || []; } catch (e) { return []; } }
    function fixtureAt(round) { var fx = fixtures(); for (var i = 0; i < fx.length; i++) if (fx[i].round === round) return fx[i]; return null; }
    function bank() { var t = club(); return (App.fin && App.fin.bank != null) ? App.fin.bank : (t.bank || 0); }
    function roundIncome(round) {
      var t = club(), fx = round == null ? fixtures()[0] : fixtureAt(round);
      return (paysSponsor() ? sponsorBase(t) : 0) + ((fx && fx.isHome) ? gate(t) : 0);
    }
    function roundOutgo() { var t = club(); return (chargesWages() ? wages(t) : 0) + (t.seats || 9000) + acadUpkeep(t) + trainIntensityCost(t); }
    function roundNet(round) { return roundIncome(round) - roundOutgo(); }
    function homeAwaySplit() {
      var t = club(), out = roundOutgo(), base = sponsorBase(t);
      return { homeNet: base + gate(t) - out, awayNet: base - out };
    }
    function avgNet() {
      var fx = fixtures();
      if (!fx.length) { var sp = homeAwaySplit(); return (sp.homeNet + sp.awayNet) / 2; }
      var s2 = 0; fx.forEach(function (f) { s2 += roundNet(f.round); });
      return s2 / fx.length;
    }
    function seasonEndProjection() {
      var s2 = bank(); fixtures().forEach(function (f) { s2 += roundNet(f.round); });
      return s2;
    }
    // first remaining round whose CUMULATIVE balance dips below zero (or null)
    function firstNegativeRound() {
      var s2 = bank(), fx = fixtures();
      for (var i = 0; i < fx.length; i++) { s2 += roundNet(fx[i].round); if (s2 < 0) return fx[i].round + 1; }
      return null;
    }
    return {
      club: club, isMP: isMP, wages: wages, acadUpkeep: acadUpkeep, acadUpkeepAt: acadUpkeepAt, gateAttendance: gateAttendance,
      gate: gate, sponsorBase: sponsorBase, trainIntensityCost: trainIntensityCost, fixtures: fixtures,
      bank: bank, roundIncome: roundIncome, roundOutgo: roundOutgo, roundNet: roundNet,
      homeAwaySplit: homeAwaySplit, avgNet: avgNet, seasonEndProjection: seasonEndProjection,
      paysSponsor: paysSponsor, chargesWages: chargesWages,
      firstNegativeRound: firstNegativeRound, ACAD: ACAD
    };
  })();

  function foWageBill(t) { return (t && t.players) ? t.players.reduce(function (s, p) { return s + (+p.wage || 0); }, 0) : 0; }
  function foMoney(n) { return "$" + Math.round(n || 0).toLocaleString(); }
  function foTeamLeaders(t) {
    var bat = { name: null, runs: 0 }, bowl = { name: null, wkts: 0 };
    try {
      (t.players || []).forEach(function (p) {
        var h = (App.playerHist && App.playerHist[p.name]) || [], runs = 0, wkts = 0;
        h.forEach(function (e) { runs += (+e.rr || 0); wkts += (+e.w || 0); });
        if (runs > bat.runs) bat = { name: p.name, runs: runs };
        if (wkts > bowl.wkts) bowl = { name: p.name, wkts: wkts };
      });
    } catch (e) {}
    return { bat: bat, bowl: bowl };
  }
  function foPitchPill(p) { var c = /green|dry|cracked/.test(p) ? "teal" : "muted"; return "<span class='fo-pill fo-pill-" + c + "'>" + E(foPitchName(p)) + "</span>"; }
  // ms until the next 9:00 AM America/New_York (league matchday time)
  function foNextMatchdayMs() {
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      var p = {}; f.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var sec = (+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second);
      var target = 9 * 3600;
      var left = target - sec; if (left <= 0) left += 24 * 3600;
      return left * 1000;
    } catch (e) { return null; }
  }
  function foCdText(ms) {
    if (ms == null) return "";
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return h + ":" + pad(m) + ":" + pad(ss);
  }
  var foCdTimer = null;
  // daily check-in streak: the cheapest honest habit loop there is
  function foStreak() {
    try {
      var k = "fol_streak_" + ((LG && LG.id) || "solo");
      var s = {}; try { s = JSON.parse(lsGet(k) || "{}"); } catch (e) {}
      var today = new Date().toISOString().slice(0, 10);
      if (s.last === today) return s.n || 1;
      var y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      s.n = (s.last === y) ? (s.n || 0) + 1 : 1;
      s.last = today;
      lsSet(k, JSON.stringify(s));
      return s.n;
    } catch (e) { return 0; }
  }
  // remember last round's table position so the KPI can show movement
  function foPosMovement(pos) {
    try {
      if (!pos) return "";
      try { var emP = (typeof foEmbargo === "function") ? foEmbargo() : null; if (emP && emP.active) return ""; } catch (eP) {}
      var k = "fol_pos_" + ((LG && LG.id) || "solo");
      var st = {}; try { st = JSON.parse(lsGet(k) || "{}"); } catch (e) {}
      var r = (App.season && App.season.round) || 0;
      if (st.round !== r) { st = { round: r, pos: pos, prev: (st.round != null && st.round < r) ? st.pos : st.prev }; lsSet(k, JSON.stringify(st)); }
      else if (st.pos !== pos) { st.pos = pos; lsSet(k, JSON.stringify(st)); }
      if (st.prev == null) return "";
      var d = st.prev - pos;
      if (d > 0) return "<b class='fo-mv-up'>&#9650; " + d + "</b>";
      if (d < 0) return "<b class='fo-mv-dn'>&#9660; " + (-d) + "</b>";
      return "";
    } catch (e) { return ""; }
  }
  // one box that finds anyone: every player (all clubs, plus your U20s) and
  // every club. Players open their player page; clubs open their scout report.
  function foSearchWire(page) {
    var inp = page.querySelector("#fo-search-in"), drop = page.querySelector("#fo-search-drop");
    if (!inp || !drop) return;
    var ix = [];
    try {
      (GD.teams || []).forEach(function (tt, ti) {
        ix.push({ k: "club", n: tt.name, ti: ti });
        (tt.players || []).forEach(function (p) { ix.push({ k: "p", n: p.name, team: tt.name, role: foRoleShort(p) }); });
      });
      var mine = userTeam();
      ((mine && mine.youth) || []).forEach(function (p) { ix.push({ k: "p", n: p.name, team: mine.name, role: "U20" }); });
      // how-the-game-works topics land on the right manual section
      [["Pitch types", "conditions", "pitch green flat crumbling slow sticky two-paced surface"],
       ["Weather", "conditions", "weather rain sunny hot scorching humid dew wind overcast misty chilly drizzle heat"],
       ["Bowling styles & rarity", "conditions", "bowling style fast wrist spin finger seam rarity quick"],
       ["Reading a player", "players", "skill overall batting bowling temperament rotation power stamina wicket threat economy discipline fielding catching keeping stumping talent form fatigue experience captaincy age reserves technique"],
       ["Training programs", "training", "training program intensity rest improve develop coach potential"],
       ["Youth scouting", "youth", "youth prospect scout lottery gifted generation u20 intake"],
       ["Transfer market", "market", "transfer market sign signing fee free agent shelf restock rare"],
       ["Money & the ledger", "money", "money bank wage gate ticket prize finance supporters mood attendance academy stadium"],
       ["Sponsor deals", "sponsors", "sponsor deal nike emirates prudential bonus shirt"],
       ["A matchday, hour by hour", "day", "matchday broadcast live hour embargo stumps lock resolve"],
       ["Reading a finished match", "matchcentre", "scorecard commentary chart fantasy point rating man of the match manhattan worm partnership filter highlight"],
       ["Matchday orders", "orders", "order lineup xi captain keeper intent aggression batting order bowling plan chase toss death powerplay"],
       ["A living league", "world", "cap international umpire almanac press paper hometown retirement record museum moment career"],
       ["Scouting the opposition", "scouting", "scout report challenge rival opponent"],
       ["The table & prizes", "league", "table standing nrr net run rate point prize position"],
       ["Practice games", "practice", "practice friendly bot"],
       ["Ten reliable habits", "tips", "tip habit advice strategy"]].forEach(function (tp) { ix.push({ k: "guide", n: tp[0], sec: tp[1], kw: tp[2] }); });
      [["Squad", "#/squad"], ["Matches", "#/matches"], ["Stats & records", "#/stats"], ["Training centre", "#/training"],
       ["Transfer market", "#/transfers"], ["Office", "#/office"], ["Club museum", "#/museum"], ["Almanac", "#/almanac"],
       ["Matchday centre", "#/matchday"], ["Match Lab", "#/nets"], ["Manual", "#/guide"]].forEach(function (pg) { ix.push({ k: "page", n: pg[0], go: pg[1] }); });
    } catch (e) {}
    var go = function (r) {
      drop.style.display = "none"; inp.value = "";
      if (r.k === "club") location.hash = "#/scout?t=" + r.ti;
      else if (r.k === "page") location.hash = r.go;
      else if (r.k === "guide") {
        location.hash = "#/guide?a=" + r.sec;
        setTimeout(function () {
          var d = document.getElementById("man-" + r.sec);
          if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); }
        }, 380);
      }
      else location.hash = "#/player?n=" + encodeURIComponent(r.n);
      if (typeof window.route === "function") window.route();
    };
    var hits = [];
    var render = function () {
      var q = (inp.value || "").trim().toLowerCase();
      if (q.length < 2) { drop.innerHTML = ""; drop.style.display = "none"; return; }
      var byName = ix.filter(function (r) { return r.n.toLowerCase().indexOf(q) >= 0; });
      var byKw = ix.filter(function (r) { return r.kw && r.n.toLowerCase().indexOf(q) < 0 && r.kw.indexOf(q) >= 0; });
      hits = byName.concat(byKw).slice(0, 8);
      drop.innerHTML = hits.map(function (r, i) {
        var chip = r.k === "club" ? "CLUB" : r.k === "guide" ? "GUIDE" : r.k === "page" ? "PAGE" : E(r.role || "");
        return "<div class='fo-search-row' data-i='" + i + "'><span class='fo-rl'>" + chip + "</span><b>" + E(r.n) + "</b>" + (r.team ? "<span class='fo-sr-team'>" + E(r.team) + "</span>" : "") + "</div>";
      }).join("") || "<div class='fo-search-row'><span class='small'>Nothing matches.</span></div>";
      drop.style.display = "block";
      drop.querySelectorAll(".fo-search-row[data-i]").forEach(function (d) { d.addEventListener("click", function () { go(hits[+d.getAttribute("data-i")]); }); });
    };
    inp.addEventListener("input", render);
    inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter" && hits[0]) go(hits[0]); });
    inp.addEventListener("blur", function () { setTimeout(function () { drop.style.display = "none"; }, 250); });
    inp.addEventListener("focus", render);
  }
  // when an accepted friendly plays before the next league round, the home
  // "next match" card becomes the friendly, countdown and all
  function foNextFriendly() {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      var host = document.querySelector("#page .fo-c2-next"); if (!host || host.__foFr) return;
      var me = userTeam().name;
      // only rows that can still matter: kickoff within the last broadcast hour
      // or in the future. Without this horizon, ascending order + the limit
      // filled the page with long-finished friendlies and the real next one
      // never made the cut - the card silently stayed on the league round.
      var horizon = encodeURIComponent(new Date(Date.now() - 65 * 60000).toISOString());
      sel("league_challenges", "league_id=eq." + LG.id + "&or=(status.eq.accepted,status.eq.played)&play_at=gte." + horizon + "&select=*&order=play_at.asc&limit=8").then(function (rows) {
        rows = (rows || []).filter(function (c) {
          if (!(c.challenger_club === me || c.opponent_club === me) || !c.play_at) return false;
          var ph = foFrBcastState(c).phase;
          return ph === "pre" || ph === "live";
        });
        var ch = rows[0]; if (!ch) return;
        var host2 = document.querySelector("#page .fo-c2-next"); if (!host2 || host2.__foFr) return;
        var fst = foFrBcastState(ch);
        var untilFr = new Date(ch.play_at).getTime() - Date.now();
        var untilLg = Infinity; try { untilLg = foNextMatchdayMs(); } catch (e2) {}
        if (fst.phase === "pre" && !(untilFr > 0 && untilFr < untilLg)) return;
        var vs = ch.challenger_club === me ? ch.opponent_club : ch.challenger_club;
        var when = new Date(ch.play_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + (foTzAbbr() ? " " + foTzAbbr() : "");
        var lgChip = "";
        try { if (App.season && typeof App.season.round === "number") lgChip = "<span class='fo-c2-nchip'>League Round " + (App.season.round + 1) + " follows &middot; 9:00 AM ET</span>"; } catch (eLc) {}
        host2.__foFr = 1;
        if (fst.phase === "live") {
          host2.innerHTML = "<div class='fo-c2-nl'>" +
            "<div class='fo-c2-nk'><span class='live-dot'></span> Friendly &middot; LIVE now</div>" +
            "<div class='fo-c2-nopp'>vs " + E(vs) + "</div>" +
            "<div class='fo-c2-nsub'>" + foFrLiveLine(ch, fst.p) + "</div>" +
            "<div class='fo-c2-nchips'>" + lgChip + "</div></div>" +
            "<div class='fo-c2-nr'><button class='fo-next-cta' id='fo-fr-watch'><span class='fo-play'><svg viewBox='0 0 24 24' width='13' height='13' fill='currentColor'><path d='M8 5v14l11-7z'/></svg></span> Watch live</button></div>";
          var bw = document.getElementById("fo-fr-watch");
          if (bw) bw.addEventListener("click", function () { location.hash = "#/friendly?id=" + ch.id; if (typeof window.route === "function") window.route(); });
          return;
        }
        var attached = false;
        try { attached = !!(ch.orders && ch.orders[me]); } catch (eAo) {}
        var lockedN = untilFr <= 60 * 60000;   // past the lock: preview time, not lineup time
        host2.innerHTML = "<div class='fo-c2-nl'>" +
          "<div class='fo-c2-nk'>Next match &middot; Friendly</div>" +
          "<div class='fo-c2-nopp'>" + (ch.challenger_club === me ? "vs " : "at ") + E(vs) + "</div>" +
          "<div class='fo-c2-nsub'>" + foPitchName(ch.pitch) + " pitch" + (ch.weather ? " &middot; " + E(ch.weather) : "") + "</div>" +
          "<div class='fo-c2-nchips'>" + lgChip + "</div></div>" +
          "<div class='fo-c2-nr'><div class='fo-c2-nk'>Match starts in</div><div class='fo-c2-cd' id='fo-cd-fr'></div>" +
          "<div class='fo-c2-nsub'><b>" + when + "</b></div>" +
          "<div class='fo-c2-ndl'>" + (lockedN ? "Lineups are locked" + (attached ? " &middot; &#10003; yours is in" : " &middot; auto XI plays") : "Lineups lock an hour before kickoff") + "</div>" +
          (lockedN
            ? "<button class='fo-next-cta' id='fo-fr-prev'>Match preview &rsaquo;</button>"
            : "<button class='fo-next-cta" + (attached ? " fo-done" : "") + "' id='fo-fr-prep'>" + (attached ? "Lineup attached &middot; review &rsaquo;" : "Set lineup &rsaquo;") + "</button>") + "</div>";
        var tick = function () {
          var el = document.getElementById("fo-cd-fr");
          if (!el) { clearInterval(iv); return; }
          var left = new Date(ch.play_at).getTime() - Date.now();
          if (left <= 0) { clearInterval(iv); host2.__foFr = 0; foNextFriendly(); return; }
          el.textContent = (typeof foCdText === "function") ? foCdText(left) : when;
        };
        var iv = setInterval(tick, 1000); tick();
        var b = document.getElementById("fo-fr-prep"); if (b) b.addEventListener("click", function () { foChalPrep(ch); });
        var bPv = document.getElementById("fo-fr-prev"); if (bPv) bPv.addEventListener("click", function () { location.hash = "#/friendly?id=" + ch.id; if (typeof window.route === "function") window.route(); });
      }).catch(function () {});
    } catch (e) {}
  }
  function foPremiumClub() {
    try {
      if (typeof userTeam !== "function" || typeof GD === "undefined" || !GD.teams) { return foOrigClub && foOrigClub(); }
      if (typeof seasonInit === "function") seasonInit();
      if (typeof econInit === "function") econInit();
      var t = userTeam(), S = App.season;
      var rowsL = typeof leagueRows === "function" ? leagueRows() : [];
      var pi = rowsL.findIndex(function (x) { return x.nm === t.name; }), me = rowsL[pi] || { p: 0, w: 0, l: 0, pts: 0, nrr: 0 };
      var pos = pi >= 0 ? pi + 1 : "-";
      var bank = (App.fin && App.fin.bank) || 0, wages = foWageBill(t);
      var mood = FO_MOODS[Math.max(0, Math.min(6, t.mood == null ? 3 : t.mood))];
      var cond = (t.mood >= 5) ? "Excellent" : (t.mood >= 3) ? "Good" : (t.mood >= 1) ? "Fair" : "Poor";
      var form = foFormMap()[t.name] || [];
      var pips = form.map(function (x) { return "<i class='fo-pip fo-" + x + "' title='" + x + "'></i>"; }).join("");
      var d = new Date(), dateStr = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) + ", " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      // one computation of the page's load-bearing facts, used everywhere below
      var totalRounds = (S && S.schedule) ? S.schedule.length : 18;
      var played = me.p || 0;
      var streak = 0;
      for (var si = form.length - 1; si >= 0 && String(form[si]).toUpperCase() === "W"; si--) streak++;
      var finSplit = FoFinance.homeAwaySplit();
      var netMD = FoFinance.avgNet();
      var runway = netMD < 0 ? Math.floor(bank / -netMD) : null;
      var nxt = foUserFixtures()[0] || null;

      // each tile carries a long (desktop) and a short (phone) label + subtitle;
      // CSS shows one or the other, so nothing is shrunk to fit
      var stat = function (accent, ic, label, value, sub, mLabel, mSub) {
        return "<div class='fo-stat fo-acc-" + accent + "'><div class='fo-stat-ic'>" + ic + "</div><div class='fo-stat-body'>" +
          "<div class='fo-stat-l'><span class='fo-sw-d'>" + label + "</span><span class='fo-sw-m'>" + (mLabel || label) + "</span></div>" +
          "<div class='fo-stat-v'>" + value + "</div>" +
          (sub ? "<div class='fo-stat-s'><span class='fo-sw-d'>" + sub + "</span><span class='fo-sw-m'>" + (mSub || sub) + "</span></div>" : "") + "</div></div>";
      };
      var mv = foPosMovement(pi >= 0 ? pi + 1 : null);
      var bankSub = runway != null
        ? (runway >= totalRounds - played ? "Covers the season at current burn" : "Covers ~" + runway + " matchday" + (runway === 1 ? "" : "s") + " at current burn")
        : "+" + foMoney(netMD) + " per matchday";
      var bankSubM = runway != null
        ? (runway >= totalRounds - played ? "Season covered" : "~" + runway + " matchday" + (runway === 1 ? "" : "s"))
        : "+" + foMoney(netMD) + " / matchday";
      var sqAvg = function (tt) { return (tt.players || []).length ? Math.round(tt.players.reduce(function (a, q) { return a + (q.rating || 0); }, 0) / tt.players.length) : 0; };
      var mySq = sqAvg(t);
      var sqRank = 1 + (GD.teams || []).filter(function (tt) { return tt !== t && sqAvg(tt) > mySq; }).length;
      var posV = (pos !== "-" && isFinite(+pos))
        ? "<span class='fo-sw-d'>" + pos + "</span><span class='fo-sw-m'>" + foOrdinal(+pos) + "</span>" : pos;
      var emKpi = false;
      try { var emK = (typeof foEmbargo === "function") ? foEmbargo() : null; emKpi = !!(emK && emK.active); } catch (eK) {}
      var stats = "<div class='fo-ch-stats'>" +
        (emKpi
          ? stat("terra", FO_I("trophy", 19), "League position", "&ndash;", "updates at stumps", "League", "at stumps")
          : stat("terra", FO_I("trophy", 19), "League position", posV, "of " + (rowsL.length || 10) + (mv ? " &middot; " + mv + " since last round" : ""), "League", "of " + (rowsL.length || 10))) +
        stat("terra", FO_I("wallet", 19), "Bank", foMoney(bank), bankSub, "Bank", bankSubM) +
        stat("teal", FO_I("bat", 19), "Squad strength", (mySq / 1000).toFixed(1), foOrdinal(sqRank) + " strongest in the league", "Squad", "Ranked " + foOrdinal(sqRank)) +
        stat("terra", FO_I("users", 19), "Supporters", "<span class='fo-stat-word'>" + mood + "</span>", "Mood", "Supporters", (t.supporters ? (+t.supporters).toLocaleString() : "Mood")) + "</div>";

      // Upcoming fixtures (+ friendlies), with a Set-lineup action
      var frRows = (foFriendlies || []).map(function (fr, i) {
        return "<tr class='fo-fx-fr'><td>Now</td><td>Friendly</td><td>vs " + E(fr.oppName) + "</td><td>" + foPitchPill(fr.pitch) + "</td><td class='r'><button class='fo-fr-play' data-i='" + i + "'>Play</button><button class='fo-fr-x' data-i='" + i + "' title='Remove'>&#10005;</button></td></tr>";
      }).join("");
      var ups = foUserFixtures().slice(0, 3).map(function (x) {
        var isNext = nxt && x.round === nxt.round;
        return "<tr><td>" + x.date + "<div class='fo-t'>9:00 AM ET</div></td><td>R" + (x.round + 1) + "</td><td>" + (x.isHome ? "vs " : "@ ") + E(x.opp.name) + "</td><td>" + E(x.ground) + " " + foPitchPill(x.pitch) + "</td><td class='r'><button class='fo-setr" + (isNext ? "" : " fo-setr-later") + "' data-r='" + x.round + "'>" + (isNext ? "Set lineup" : "Plan lineup") + "</button></td></tr>";
      }).join("");
      var upBody = (frRows || ups)
        ? "<table class='fo-tbl'><thead><tr><th>Date</th><th>Rd</th><th>Match</th><th>Ground</th><th class='r'></th></tr></thead><tbody>" + frRows + ups + "</tbody></table>"
        : "<div class='fo-empty'><div class='fo-empty-ic'>" + FO_I("bat", 20) + "</div><div><b>Season complete</b></div></div>";

      // Leaders
      var ld = foTeamLeaders(t);
      var lgStat = function (nm) {
        var h2 = ((App.playerHist || {})[nm] || []).filter(function (e2) { return !e2.fr && e2.s != null; });
        var o2 = { runs: 0, outs: 0, bf: 0, w: 0, cr: 0, cb: 0, inns: 0, hs: 0, bw: 0, br: 1e9, rec: [], recw: [] };
        h2.forEach(function (e2) {
          var rr2 = +e2.rr || 0, w2 = +e2.w || 0, cb2 = +e2.cb || 0;
          if ((+e2.bb || 0) > 0 || rr2 > 0 || e2.o) { o2.inns++; o2.rec.push(rr2); if (rr2 > o2.hs) o2.hs = rr2; }
          o2.runs += rr2; o2.outs += e2.o ? 1 : 0; o2.bf += +e2.bb || 0;
          o2.w += w2; o2.cr += +e2.cr || 0; o2.cb += cb2;
          if (cb2 > 0) o2.recw.push(w2);
          if (w2 > o2.bw || (w2 === o2.bw && w2 > 0 && (+e2.cr || 0) < o2.br)) { if (w2) { o2.bw = w2; o2.br = +e2.cr || 0; } }
        });
        return o2;
      };
      var roleOf = function (nm) { var p2 = (t.players || []).filter(function (x) { return x.name === nm; })[0]; return p2 ? prole(p2.role || "") : ""; };
      var lb1 = ld.bat.name ? lgStat(ld.bat.name) : null;
      var lb2 = ld.bowl.name ? lgStat(ld.bowl.name) : null;
      var leadBat = "<div class='fo-card fo-o-lead'><div class='fo-card-h2row'><div class='fo-card-h2'>Leading run-scorer</div></div><div class='fo-card-b'>" +
        (ld.bat.name ? "<div class='fo-c2-ldn'>" + E(ld.bat.name) + "</div><div class='fo-c2-ldr'>" + E(roleOf(ld.bat.name)) + "</div>" +
          "<div class='fo-c2-ldv'>" + (ld.bat.runs || 0) + " <span>runs</span></div>" +
          "<div class='fo-c2-ldk'><span>" + (lb1 ? lb1.inns : 0) + " inns &middot; Avg <b>" + (lb1 && lb1.outs ? (lb1.runs / lb1.outs).toFixed(1) : "&ndash;") + "</b></span></div>" +
          "<div class='fo-c2-ldk'><span>SR <b>" + (lb1 && lb1.bf ? (100 * lb1.runs / lb1.bf).toFixed(1) : "&ndash;") + "</b> &middot; HS <b>" + (lb1 ? lb1.hs : 0) + "</b></span></div>" +
          (lb1 && lb1.rec.length ? "<div class='fo-c2-ldk'><span>Form: <b>" + lb1.rec.slice(-3).join(", ") + "</b></span></div>" : "")
          : "<div class='small'>No runs on the board yet.</div>") + "</div></div>";
      var leadBowl = "<div class='fo-card fo-o-lead'><div class='fo-card-h2row'><div class='fo-card-h2'>Leading wicket-taker</div></div><div class='fo-card-b'>" +
        (ld.bowl.name ? "<div class='fo-c2-ldn'>" + E(ld.bowl.name) + "</div><div class='fo-c2-ldr'>" + E(roleOf(ld.bowl.name)) + "</div>" +
          "<div class='fo-c2-ldv'>" + (ld.bowl.wkts || 0) + " <span>wkts</span></div>" +
          "<div class='fo-c2-ldk'><span>" + (lb2 ? Math.floor(lb2.cb / 6) + (lb2.cb % 6 ? "." + lb2.cb % 6 : "") : 0) + " overs &middot; Avg <b>" + (lb2 && lb2.w ? (lb2.cr / lb2.w).toFixed(1) : "&ndash;") + "</b></span></div>" +
          "<div class='fo-c2-ldk'><span>Econ <b>" + (lb2 && lb2.cb ? (lb2.cr / (lb2.cb / 6)).toFixed(2) : "&ndash;") + "</b> &middot; Best <b>" + (lb2 && lb2.bw ? lb2.bw + "/" + lb2.br : "&ndash;") + "</b></span></div>" +
          (lb2 && lb2.recw.length ? "<div class='fo-c2-ldk'><span>Recent wkts: <b>" + lb2.recw.slice(-3).join(", ") + "</b></span></div>" : "")
          : "<div class='small'>No wickets yet.</div>") + "</div></div>";
      // phones get both leaders in one card; the two desktop cards hide there
      var leadCombo = "<div class='fo-card fo-o-leadm'><div class='fo-card-h2row'><div class='fo-card-h2'>Season leaders</div><a href='#/stats' class='fo-morelink'>All stats &rsaquo;</a></div><div class='fo-card-b'>" +
        (ld.bat.name
          ? "<div class='fo-c2-k'>Runs</div><div class='fo-c2-ldn'>" + E(ld.bat.name) + "</div>" +
            "<div class='fo-c2-ldk'><span><b>" + (ld.bat.runs || 0) + "</b>" +
            (lb1 && lb1.outs ? " &middot; Avg <b>" + (lb1.runs / lb1.outs).toFixed(1) + "</b>" : "") +
            (lb1 && lb1.bf ? " &middot; SR <b>" + (100 * lb1.runs / lb1.bf).toFixed(1) + "</b>" : "") + "</span></div>"
          : "<div class='small'>No runs on the board yet.</div>") +
        (ld.bowl.name
          ? "<div class='fo-c2-k' style='margin-top:13px'>Wickets</div><div class='fo-c2-ldn'>" + E(ld.bowl.name) + "</div>" +
            "<div class='fo-c2-ldk'><span><b>" + (ld.bowl.wkts || 0) + "</b>" +
            (lb2 && lb2.w ? " &middot; Avg <b>" + (lb2.cr / lb2.w).toFixed(1) + "</b>" : "") +
            (lb2 && lb2.cb ? " &middot; Econ <b>" + (lb2.cr / (lb2.cb / 6)).toFixed(2) + "</b>" : "") + "</span></div>"
          : "") + "</div></div>";

      // Standings: the full ten-row table lives on Matches; here only the story –
      // who leads, where you sit, and the one gap worth chasing
      var standRow = function (x, i) {
        var meRow = x.nm === t.name;
        var botTag = "";
        try { if (SYNC && SYNC.started && !SYNC.practice && LG && window.__foClubMeta && !foClubHuman(x.nm)) botTag = " <span class='fo-bot-mini'>BOT</span>"; } catch (eBt) {}
        // phones keep the top five plus your own row; the rest fold away
        var foldM = i >= 5 && !meRow ? " fo-st-x" : "";
        return "<tr class='" + (meRow ? "fo-userrow" : "") + foldM + "'><td class='fo-rk'>" + (i === 0 ? "<span style='color:#F59E0B;display:inline-flex;vertical-align:-2px'>" + FO_I("trophy", 14) + "</span>" : (i + 1)) + "</td><td class='fo-scoutname'>" + E(x.nm) + botTag + "</td><td class='r'>" + x.p + "</td><td class='r'>" + x.w + "</td><td class='r'>" + x.l + "</td><td class='r'>" + (x.nrr >= 0 ? "+" : "") + x.nrr.toFixed(2) + "</td><td class='r'><b>" + x.pts + "</b></td></tr>";
      };
      var standRows = rowsL.map(standRow).join("");
      var gapLine = "";
      if (played > 0 && pi >= 0) {
        if (pi === 0) {
          var below0 = rowsL[1], lead0 = (me.pts || 0) - ((below0 && below0.pts) || 0);
          gapLine = lead0 > 0 ? lead0 + " pt" + (lead0 === 1 ? "" : "s") + " clear of " + E(below0.nm) : "Level on points with " + E(below0 ? below0.nm : "the chasing pack");
        } else {
          var above0 = rowsL[pi - 1], gap0 = (above0.pts || 0) - (me.pts || 0);
          gapLine = gap0 <= 0 ? "Level on points with " + E(above0.nm) + " above you" : gap0 + " pt" + (gap0 === 1 ? "" : "s") + " behind " + E(above0.nm);
        }
      }
      var standings = "<div class='fo-card fo-o-stand'><div class='fo-card-h2row'><div class='fo-card-h2'>League standings</div><a href='#/matches' class='fo-morelink'>Results &rsaquo;</a></div><div class='fo-card-b'><table class='fo-tbl fo-chtable'><thead><tr><th class='fo-rk'>#</th><th>Club</th><th class='r'>P</th><th class='r'>W</th><th class='r'>L</th><th class='r'>NRR</th><th class='r'>Pts</th></tr></thead><tbody>" + standRows + "</tbody></table>" +
        (gapLine ? "<div class='fo-stand-gap'>" + gapLine + "</div>" : "") + "</div></div>";

      // Finances: one line · the net, and where the season lands. All figures
      // come from FoFinance so this card can never disagree with the Office.
      var remainingMD = FoFinance.fixtures().length;
      var projEnd = FoFinance.seasonEndProjection();
      var finStory = netMD >= 0 ? "building every matchday" : (projEnd >= 0 ? "the bank covers the season" : "the bank runs dry before season&rsquo;s end");
      var finSign = function (v) { return "<b class='" + (v >= 0 ? "fo-pos" : "fo-neg") + "'>" + (v >= 0 ? "+" : "&minus;") + foMoney(Math.abs(v)) + "</b>"; };
      var trendUp = projEnd >= bank;
      var fin = "<div class='fo-card fo-o-fin'><div class='fo-card-h2row'><div class='fo-card-h2'>Finance overview</div><a href='#/office' class='fo-morelink'>View details &rsaquo;</a></div><div class='fo-card-b'>" +
        "<div class='fo-c2-fbal'>" + foMoney(bank) + "<span>Current balance</span></div>" +
        "<div class='fo-c2-fkv'><span>Matchday net</span>" + finSign(netMD) + "</div>" +
        "<div class='fo-c2-fkv'><span>Wage bill / matchday</span><b class='fo-neg'>&minus;" + foMoney(wages) + "</b></div>" +
        (remainingMD > 0 ? "<div class='fo-c2-fkv'><span>Projected (season end)</span><b class='" + (projEnd >= 0 ? "fo-pos" : "fo-neg") + "'>" + foMoney(projEnd) + "</b></div>" : "") +
        "<div class='fo-c2-ftr'><i class='" + (trendUp ? "up" : "dn") + "'>" + (trendUp ? "&#9650;" : "&#9660;") + "</i> " + (trendUp ? "Trending up" : "Trending down") + " &middot; " + finStory + "</div>" +
        "</div></div>";

      // season bests: the two performances worth bragging about
      var bb = null, bbw = null;
      (t.players || []).forEach(function (pl) {
        ((App.playerHist && App.playerHist[pl.name]) || []).forEach(function (e) {
          if ((+e.rr || 0) > 0 && (!bb || e.rr > bb.rr)) bb = { rr: e.rr, txt: e.bat, name: pl.name, vs: e.teams };
          if ((+e.w || 0) > 0 && (!bbw || e.w > bbw.w || (e.w === bbw.w && (+e.cr || 0) < bbw.cr))) bbw = { w: e.w, cr: (+e.cr || 0), txt: e.bowl, name: pl.name, vs: e.teams };
        });
      });
      var bestsCard = "";
      if (bb || bbw) {
        bestsCard = "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Season bests</div><a href='#/stats' class='fo-morelink'>All stats &rsaquo;</a></div><div class='fo-card-b'><table class='fo-kv'>" +
          (bb ? "<tr><td>Best batting</td><td class='r'><b>" + E(bb.txt) + "</b> &middot; " + E(bb.name) + "</td></tr>" : "") +
          (bbw ? "<tr><td>Best bowling</td><td class='r'><b>" + E(String(bbw.txt).replace(/^\d+\.\d+-/, "").split("-").reverse().join("/")) + "</b> &middot; " + E(bbw.name) + "</td></tr>" : "") +
          "</table></div></div>";
      }
      // squad watch: who is hot, who is struggling, who needs a rest
      var hotP = [], coldP = [], tiredP = [];
      var hasPlayed = function (nm) { var h = App.playerHist && App.playerHist[nm]; return !!(h && h.length); };
      (t.players || []).forEach(function (pl) {
        var fi = pl.formIx == null ? 3 : pl.formIx;
        // drafted form is a starting roll - no verdicts before a first match
        if (hasPlayed(pl.name)) {
          if (fi >= 5) hotP.push(pl.name); else if (fi <= 1) coldP.push(pl.name);
        }
        if (pl.fatigue === "tired") tiredP.push(pl.name);
      });
      var enOf = function (p2) { try { return foEnergyOf(p2); } catch (e) { return { pct: 100, word: "fresh", tired: false }; } };
      var wPool = (t.players || []).slice().sort(function (a, b2) { return enOf(a).pct - enOf(b2).pct; });
      var fitN = wPool.filter(function (p2) { return !enOf(p2).tired; }).length;
      var tiredN = wPool.length - fitN;
      var wRow = function (p2) {
        var en = enOf(p2);
        var col = en.tired ? "#DC2626" : en.word === "rested" ? "#c08a2b" : "#16A34A";
        return "<div class='fo-c2-wr'><div class='fo-c2-wrn'><b>" + E(p2.name) + "</b><span>" + E(prole(p2.role || "")) + "</span></div>" +
          "<span class='fo-c2-wtag' style='color:" + col + "'>" + (en.tired ? "TIRED" : en.word === "rested" ? "RESTED" : "FIT") + "</span>" +
          "<div class='fo-c2-wbar'><i style='width:" + en.pct + "%;background:" + col + "'></i></div><span class='fo-c2-wpct'>" + en.pct + "%</span></div>";
      };
      // exceptions only: rows exist ONLY for players who need attention
      // (tired, resting, low tank). A healthy squad is one green line, not
      // a table of FIT / 100% repeated fifteen times.
      var wAttn = wPool.filter(function (p2) { var en = enOf(p2); return en.tired || en.word === "rested" || en.pct < 90; });
      var wOk = "<div class='fo-c2-wok'>&#10003; All " + fitN + " players fit and fresh</div>";
      var watchCard = "<div class='fo-card fo-o-watch'><div class='fo-card-h2row'><div class='fo-card-h2'>Squad watch</div><a href='#/squad' class='fo-morelink'>Manage squad &rsaquo;</a></div><div class='fo-card-b'>" +
        "<div class='fo-c2-wsum'><span class='fo-c2-wk g'><b>" + fitN + "</b> fit</span>" +
        (tiredN ? "<span class='fo-c2-wk a'><b>" + tiredN + "</b> tired</span>" : "") +
        (hotP.length ? "<span class='fo-c2-wk g'><b>" + hotP.length + "</b> in form</span>" : "") +
        (coldP.length ? "<span class='fo-c2-wk r'><b>" + coldP.length + "</b> struggling</span>" : "") + "</div>" +
        (wAttn.length
          ? "<div class='fo-c2-whead'><span>Player</span><span>Status</span><span>Energy</span></div>" +
            "<div class='fo-wgrp-d'>" + wAttn.slice(0, 6).map(wRow).join("") + "</div>" +
            "<div class='fo-wgrp-m'>" + wAttn.slice(0, 3).map(wRow).join("") + "<a class='fo-c2-wmore' href='#/squad'>View full squad &rsaquo;</a></div>"
          : wOk) + "</div></div>";
      // milestone watch: unfinished business is what brings a manager back
      var msRows = [];
      try { msRows = foMilestoneWatch(t); } catch (e) {}
      var msCard = "<div class='fo-card fo-o-ms'><div class='fo-card-h2row'><div class='fo-card-h2'>Club milestones</div><a href='#/museum' class='fo-morelink'>Club museum &rsaquo;</a></div><div class='fo-card-b'>" +
        (msRows.length ? msRows.map(foRaceBar).join("")
          : "<div class='small'>No one is knocking on a landmark yet. The museum keeps everything they have already done.</div>") + "</div></div>";

      var emClub = false, emEnds = 0;
      try { var emC = (typeof foEmbargo === "function") ? foEmbargo() : null; if (emC && emC.active) { emClub = true; emEnds = emC.endsAt || 0; } } catch (eEm) {}
      var posLineTop = emClub ? null
        : (pi >= 0 && played > 0) ? foOrdinal(pos) + " of " + (rowsL.length || 10) + (streak >= 2 ? " · " + streak + "-win streak" : "") : null;
      // ---- hero: crest + identity | season progress | next-match countdown ----
      var isMP = SYNC && SYNC.started && !SYNC.practice;
      var ordersIn = !!(nxt && ((SYNC && SYNC.submitted && SYNC.submitted[nxt.round]) ||
        (App.orders && App.orders.saved && App.season && nxt.round === App.season.round)));
      var fchips = form.length
        ? form.map(function (x) { var u = String(x).toUpperCase(); return "<i class='fo-c2-f " + (u === "W" ? "w" : u === "L" ? "l" : "t") + "'>" + u + "</i>"; }).join("")
        : "<span class='fo-c2-dim'>no matches yet</span>";
      var moodIx = Math.max(0, Math.min(6, t.mood == null ? 3 : t.mood));
      // mood trend vs the previous round, remembered locally per club
      var moodTr = 0;
      try {
        var mk = "fol_mood_" + t.name, crM = (App.season && App.season.round) || 0;
        var stM = JSON.parse(lsGet(mk) || "null");
        if (!stM || typeof stM.m !== "number") stM = { r: crM, m: moodIx, p: null };
        else if (crM > stM.r) stM = { r: crM, m: moodIx, p: stM.m };
        else stM.m = moodIx;
        lsSet(mk, JSON.stringify(stM));
        if (stM.p != null) moodTr = moodIx - stM.p;
      } catch (eMt) {}
      var moodArrow = emClub ? "" : moodTr > 0 ? "<i class='fo-mood-up'>&#9650;</i> " : moodTr < 0 ? "<i class='fo-mood-dn'>&#9660;</i> " : "";
      var pct = Math.round(100 * played / Math.max(1, totalRounds));
      var nextCard = "";
      if (nxt) {
        var oppRow = rowsL.findIndex(function (x) { return x.nm === nxt.opp.name; });
        var oppForm = (foFormMap()[nxt.opp.name] || []).map(function (x) { return "<i class='fo-pip fo-" + x + "'></i>"; }).join("");
        nextCard = "<div class='fo-c2-next'><div class='fo-c2-nl'>" +
          "<div class='fo-c2-nk'>League &middot; Round " + (nxt.round + 1) + "</div>" +
          "<div class='fo-c2-nopp'>" + (nxt.isHome ? "vs " : "at ") + E(nxt.opp.name) + "</div>" +
          "<div class='fo-c2-nsub'>" + E(nxt.ground) + " &middot; " + foPitchName(nxt.pitch) + " pitch" + (nxt.weather ? " &middot; " + E(nxt.weather) : "") + "</div>" +
          "<div class='fo-c2-nchips'>" + (oppRow >= 0 ? "<span class='fo-c2-nchip'>" + foOrdinal(oppRow + 1) + "</span>" : "") + (oppForm ? "<span class='fo-c2-nchip'>Form <span class='fo-form'>" + oppForm + "</span></span>" : "") + "</div></div>" +
          "<div class='fo-c2-nr'>" + (isMP ? "<div class='fo-c2-nk'>Match starts in</div><div class='fo-c2-cd' id='fo-cd'>" + foCdText(foNextMatchdayMs()) + "</div>" : "") +
          "<div class='fo-c2-nsub'><b>" + MATCH_TIME + "</b> &middot; " + E(nxt.date || "") + "</div>" +
          "<div class='fo-c2-ndl'>Lineups lock at 8:00 AM ET</div>" +
          "<button class='fo-next-cta" + (ordersIn ? " fo-done" : "") + "' data-r='" + nxt.round + "'>" + (ordersIn ? "Review lineup &rsaquo;" : "Set lineup &rsaquo;") + "</button></div></div>";
      } else if ((me.p || 0) > 0) {
        nextCard = "<div class='fo-c2-next'><div class='fo-c2-nl'><div class='fo-c2-nk'>Season complete</div>" +
          "<div class='fo-c2-nopp'>You finished " + foOrdinal(pos === "-" ? 10 : pos) + "</div>" +
          "<div class='fo-c2-nsub'>Prize money: " + foMoney((FO_FIN.prizes[(pos === "-" ? 10 : pos) - 1]) || 0) + "</div></div></div>";
      }
      var ctry = (SYNC && SYNC.myTeam && SYNC.myTeam.country) || t.country || (((t.players || [])[0] || {}).nat) || "";
      var ctryFlag = ""; try { ctryFlag = (typeof foFlag === "function" && ctry) ? (foFlag(ctry) || "") : ""; } catch (eFl) {}
      var lgName = (LG && LG.name) ? LG.name : "One Day League";
      var metaBits = ["Season " + (App.seasonNo || 1)];
      if (ctry) metaBits.push((ctryFlag ? ctryFlag + " " : "") + E(ctry));
      metaBits.push(E(lgName));
      if (posLineTop) metaBits.push("<b class='fo-c2-gold'>" + posLineTop + "</b>");
      // ---- the Journey centerpiece: the solo story leads, the league follows
      var journeyCard = "";
      try {
        if (typeof FO_CX_REGIONS !== "undefined") {
          var stJ = foCxState(), curJ = foCxCurrent(stJ);
          var conqN = (stJ.conq || []).length;
          var stS = null; try { stS = foStState(); } catch (eS0) {}
          var hookJ = (stS && stS.hook) ? stS.hook : null;
          var lastLog = (stS && stS.log && stS.log[0]) ? stS.log[0].txt : null;
          if (curJ >= FO_CX_REGIONS.length) {
            journeyCard = "<div class='fo-home-j' data-go='circuit'><div class='fo-hj-map'><img src='" + FO_ART + "circuit/trophy-crown.webp' alt=''></div>" +
              "<div class='fo-hj-main'><div class='fo-hj-eyebrow'>The Journey &middot; complete</div>" +
              "<div class='fo-hj-opp'>World champions.</div>" +
              "<div class='fo-hj-quip'>Six regions, six trophies - and the Thorne Crown, taken at Marylebone. The cabinet is full.</div>" +
              (hookJ || lastLog ? "<div class='fo-hj-story'>" + E(hookJ || lastLog) + " <a href='#/story'>Club story &rsaquo;</a></div>" : "") + "</div>" +
              "<div class='fo-hj-side'><span class='fo-hj-tr'>&#128081; The Crown</span><button class='fo-hj-cta' data-go='circuit'>The Circuit &rsaquo;</button></div></div>";
          } else {
            var rJ = FO_CX_REGIONS[curJ];
            var nextCiJ = -1;
            for (var iJ = 0; iJ < rJ.clubs.length; iJ++) if (!foCxBeaten(stJ, rJ.id, iJ)) { nextCiJ = iJ; break; }
            var cJ = rJ.clubs[Math.max(0, nextCiJ)];
            var oppArt = cJ.boss ? "<img class='bossy' src='" + FO_ART + (cJ.bimg || ("circuit/boss-" + rJ.id + ".webp")) + "' alt=''>" : "";
            var natJ = FO_CX_REGIONS.filter(function (r9) { return !r9.final; }).length;
            journeyCard = "<div class='fo-home-j' data-go='circuit' style='--cxc:" + rJ.ac + "'>" +
              "<div class='fo-hj-map'><img src='" + FO_ART + (rJ.final ? "thorne.png" : "circuit/" + rJ.id + ".webp") + "' alt=''><span class='fo-hj-reg'>" + E(rJ.nm) + "</span></div>" +
              "<div class='fo-hj-main'><div class='fo-hj-eyebrow'>The Journey &middot; " + (rJ.final ? "the World Final" : conqN + " of " + natJ + " regions conquered") + "</div>" +
              "<div class='fo-hj-opp'>" + oppArt + "<span>Next: <b>" + E(cJ.nm) + "</b>" + (cJ.boss ? " &middot; Boss" : "") + " &middot; " + E(cJ.city) + "</span></div>" +
              (cJ.gq ? "<div class='fo-hj-quip'>&ldquo;" + E(cJ.gq.split(". ")[0]) + ".&rdquo; &mdash; the Gaffer</div>" : "") +
              (hookJ || lastLog ? "<div class='fo-hj-story'>" + E(hookJ || lastLog) + " <a href='#/story'>Club story &rsaquo;</a></div>" : "") + "</div>" +
              "<div class='fo-hj-side'><span class='fo-hj-tr'>&#127942; " + conqN + " / 6</span><button class='fo-hj-cta' data-go='circuit'>Continue &rsaquo;</button></div></div>";
          }
        }
      } catch (eJc) {}
      var hero = "<div class='fo-c2-hero fo-c2-hero2'>" +
        "<div class='fo-c2-id'><div class='fo-c2-idt'>" +
        "<div class='fo-c2-eyebrow'>Your club</div>" +
        "<h1 class='fo-c2-name'>" + E(t.name) + "</h1>" +
        "<div class='fo-c2-mgr'>Manager: <b>" + E((SYNC && SYNC.me && SYNC.me.display_name) || "you") + "</b> <i class='fo-dot fo-dot-on'></i></div>" +
        "<div class='fo-c2-meta'>" + metaBits.join(" <u>&middot;</u> ") + "</div>" +
        (function () { try { var eb9 = foEstBadge(t); return eb9 ? "<div class='fo-c2-est'>" + eb9 + "</div>" : ""; } catch (e9) { return ""; } })() +
        "<div class='fo-c2-frow'><div><div class='fo-c2-k'>Form (last 5)</div><div class='fo-c2-fs'>" + fchips + "</div></div>" +
        "<div><div class='fo-c2-k'>Supporters</div><div class='fo-c2-mood'>" + moodArrow + "<b>" + E(String(mood).toUpperCase()) + "</b>" + (t.supporters ? " <span>&middot; " + (+t.supporters).toLocaleString() + "</span>" : "") + "</div></div></div>" +
        "</div></div>" +
        "<div class='fo-c2-prog'><div class='fo-c2-k'>Season progress</div>" +
        "<div class='fo-c2-pv'>Round " + Math.min(played + 1, totalRounds) + " of " + totalRounds + "</div>" +
        "<div class='fo-progress-bar'><u style='width:" + pct + "%'></u></div><div class='fo-c2-ppct'>" + pct + "% complete</div></div>" +
        "</div>" + journeyCard + nextCard;
      // ---- today's to-do: unfinished business pulls you back tomorrow ----
      var todo = [];
      if (nxt && !ordersIn) todo.push("<a data-go='orders' data-r='" + nxt.round + "'>&#9998; Set your lineup for round " + (nxt.round + 1) + "</a>");
      var rep0 = t._trainReport || null;
      if (rep0 && ((rep0.gains || []).length || (rep0.signings || []).length)) todo.push("<a data-go='training'>&#9650; Training report: " + (rep0.gains || []).length + " gain" + ((rep0.gains || []).length === 1 ? "" : "s") + (rep0.signings && rep0.signings.length ? " · " + rep0.signings.length + " signing" + (rep0.signings.length === 1 ? "" : "s") : "") + "</a>");
      try {
        var stT = foTrainState(), rNow = (App.season && App.season.round) || 0;
        if (rNow - (stT.lastSignRound == null ? -99 : stT.lastSignRound) >= FO_SCOUT_COOLDOWN && (t.players || []).length < 18) todo.push("<a data-go='training'>&#9733; Your scout has 3 new prospects</a>");
      } catch (e) {}
      if ((t.players || []).length < 18) todo.push("<a data-go='transfers'>&#8644; Browse the transfer market</a>");
      var todoStrip = "";

      // ---- latest training gains: visible progress feeds the habit loop ----
      var gainsCard = "";
      if (rep0 && ((rep0.gains || []).length || (rep0.recovery || []).length || (rep0.signings || []).length)) {
        var gl = (rep0.gains || []).slice(0, 8).map(function (g) { return "<li><span class='fo-gain-up'>&#9650;</span> " + E(g) + "</li>"; }).join("");
        var more = (rep0.gains || []).length > 8 ? "<li class='small'>+" + ((rep0.gains || []).length - 8) + " more on the Training page</li>" : "";
        var sg = (rep0.signings || []).map(function (g) { return "<li>&#9733; " + E(g) + "</li>"; }).join("");
        gainsCard = "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Latest training gains</div><a class='fo-morelink' href='#/training'>Training centre ›</a></div><div class='fo-card-b'><ul class='fo-gains' style='margin:0;padding-left:6px;list-style:none;font-size:13px'>" + sg + gl + more + "</ul></div></div>";
      }
      var newsCard = "";
      try {
        var hideRdN = null;
        try { var emN = (typeof foEmbargo === "function") ? foEmbargo() : null; if (emN && emN.active) hideRdN = emN.round; } catch (eN0) {}
        var lastRes = null;
        (App.results || []).slice().reverse().some(function (r0) {
          if (hideRdN != null && r0 && r0.round === hideRdN) return false;
          if (r0 && r0.comp === "league" && r0.result && (r0.home === t.name || r0.away === t.name)) { lastRes = r0; return true; }
          return false;
        });
        if (!lastRes) (App.results || []).slice().reverse().some(function (r0) { if (hideRdN != null && r0 && r0.round === hideRdN) return false; if (r0 && r0.comp === "league" && r0.result) { lastRes = r0; return true; } return false; });
        var evsN = [];
        GD.teams.forEach(function (tt) {
          (tt.players || []).forEach(function (p2) {
            (p2._career || []).forEach(function (c3) {
              if (c3.ev === "debut") return;
              if (hideRdN != null && (c3.s || 0) === (App.seasonNo || 1) && (c3.r || 0) === hideRdN + 1) return;
              evsN.push({ s: c3.s || 0, r: c3.r || 0, ev: c3.ev || "", txt: c3.txt || "", club: tt.name, who: p2.name });
            });
          });
        });
        evsN.sort(function (a, b2) { return (b2.s - a.s) || (b2.r - a.r); });
        var nrDate = function (s2, r2) {
          try {
            var wd = foRoundDate(s2, r2);
            var dd = new Date(wd);
            if (!isNaN(dd)) return dd.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
          } catch (e2) {}
          return "";
        };
        var featDate = lastRes && typeof lastRes.round === "number" ? nrDate(App.seasonNo || 1, lastRes.round + 1) : "";
        var feat = lastRes ? "<div class='fo-nr-feat'><b>" + E(lastRes.result.text) + "</b>" +
          "<span>" + E(lastRes.home) + " v " + E(lastRes.away) + (lastRes.result.mom ? " &middot; star: " + E(lastRes.result.mom) : "") + "</span>" +
          (featDate ? "<i>" + featDate + "</i>" : "") + "</div>" : "";
        var nrPhrase = function (e3) {
          var who = foOrdSurname(e3.who);
          var tail = (e3.txt.split("\u00b7")[1] || "").trim();
          switch (e3.ev) {
            case "fifty": return who + " scores a maiden fifty" + (tail ? " &mdash; " + tail : "");
            case "century": return who + " scores " + (/maiden/i.test(e3.txt) ? "a maiden century" : "a century") + (tail ? " &mdash; " + tail : "");
            case "fivefor": return who + " takes " + (/maiden/i.test(e3.txt) ? "a maiden five-for" : "a five-for") + (tail ? " &mdash; " + tail : "");
            case "hs": return who + " posts a new highest score" + (tail ? " &mdash; " + tail : "");
            case "bb": return who + " records career-best figures" + (tail ? " &mdash; " + tail : "");
            case "runs": case "wkts": return who + " reaches " + e3.txt.toLowerCase();
            case "glove": return who + ": " + e3.txt.toLowerCase();
            case "nick": return who + " " + e3.txt.replace(/^Earned/, "earns");
            case "award": return who + " wins " + e3.txt;
            default: return who + " &middot; " + e3.txt;
          }
        };
        // a new manager joining the league leads the page
        var joinRows = [];
        try {
          var metaJ = foClubMetaNow() || {};
          var joins = [];
          for (var jn in metaJ) {
            var jm = metaJ[jn]; if (!jm || !jm.est) continue;
            var jd = new Date(jm.est); if (isNaN(jd)) continue;
            if (Date.now() - jd.getTime() > 10 * 86400000) continue;
            joins.push({ club: jn, mgr: jm.manager || "", d: jd });
          }
          joins.sort(function (a, b2) { return b2.d - a.d; });
          joinRows = joins.slice(0, 2).map(function (j) {
            // clickable once the club is actually in the season; before that
            // (still drafting / join still landing) say so instead
            var inWorld = false;
            try { inWorld = (GD.teams || []).some(function (t9) { return t9 && t9.name === j.club; }); } catch (eIw) {}
            var mgrBits = [];
            if (j.mgr) mgrBits.push("manager " + E(j.mgr));
            if (!inWorld) mgrBits.push("still drafting their squad");
            return "<div class='fo-nr-row'><span><b" + (inWorld ? " class='fo-scoutname' style='cursor:pointer;text-decoration:underline;text-decoration-color:rgba(28,36,51,.25);text-underline-offset:2px'" : "") + ">" + E(j.club) + "</b> joins the league" +
              (mgrBits.length ? " <u>" + mgrBits.join(" &middot; ") + "</u>" : "") + "</span><i>" + j.d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) + "</i></div>";
          });
        } catch (eJn) {}
        var nrRows = joinRows.concat(evsN.slice(0, 4).map(function (e3) {
          return "<div class='fo-nr-row'><span>" + nrPhrase(e3) + " <u>" + E(e3.club) + "</u></span><i>" + nrDate(e3.s, e3.r) + "</i></div>";
        })).slice(0, 4).join("");
        newsCard = "<div class='fo-card fo-o-news'><div class='fo-card-h2row'><div class='fo-card-h2'>Club newsroom</div><a href='#/matchday' class='fo-morelink'>View all &rsaquo;</a></div><div class='fo-card-b'>" +
          (feat || nrRows ? feat + nrRows : "<div class='small'>The story starts with the first matchday.</div>") +
          "</div></div>";
      } catch (e) {}
      setTimeout(foChalAlert, 30);   // async one-line challenge nudge
      // minimal home: hero, search, the next match, four numbers, the paper.
      // Everything else lives on its own page (Matches, Squad, Stats, Office).
      var search = "<div class='fo-search'><input id='fo-search-in' type='search' placeholder='Search players, clubs, or how anything works\u2026' autocomplete='off' spellcheck='false'><div class='fo-search-drop' id='fo-search-drop'></div></div>";
      var qk = function (href, ic, lbl) { return "<a href='" + href + "'><i>" + FO_I(ic, 18) + "</i><span>" + lbl + "</span></a>"; };
      var quick = "<div class='fo-ch-quick fo-ch-quick2'>" +
        qk("#/matches", "calendar", "Fixtures &amp; results") + qk("#/matchday", "target", "Matchday centre") +
        qk("#/nets", "bat", "Match Lab") + qk("#/guide", "info", "Manual") + "</div>";
      // upcoming fixtures card: league rounds + accepted friendlies in time order
      var fxItems = [];
      var fxAt = function (rn) {
        try {
          var d9 = new Date(); d9.setHours(9, 0, 0, 0);
          d9.setDate(d9.getDate() + (rn - App.season.round) + (foCurAdvanced() ? 1 : 0));
          return +d9;
        } catch (e9) { return 0; }
      };
      foUserFixtures().slice(0, 5).forEach(function (x) {
        var isN = nxt && x.round === nxt.round;
        fxItems.push({ at: fxAt(x.round), html: "<div class='fo-c2-fx" + (isN ? " next" : "") + "'>" +
          "<div class='fo-c2-fxd'><b>" + E(x.date) + "</b><span>9:00 AM</span></div>" +
          "<div class='fo-c2-fxm'><b>" + (x.isHome ? "vs " : "@ ") + E(x.opp.name) + "</b><span>Round " + (x.round + 1) + " &middot; " + (x.isHome ? "Home" : "Away") + (isN ? " &middot; " + E(foPitchName(x.pitch)) + " pitch" : "") + (x.weather ? " &middot; " + E(x.weather) : "") + "</span></div>" +
          (isN ? "<span class='fo-c2-fxn'>NEXT</span>" : "") + "</div>" });
      });
      try {
        (window.__foFrAll || []).forEach(function (c2f) {
          if (!c2f || (c2f.challenger_club !== t.name && c2f.opponent_club !== t.name)) return;
          if (c2f.status !== "accepted" || foFrBcastState(c2f).phase !== "pre") return;
          var dF = new Date(c2f.play_at);
          var pd2 = function (n) { return (n < 10 ? "0" : "") + n; };
          fxItems.push({ at: +dF || 0, html: "<div class='fo-c2-fx'><div class='fo-c2-fxd'><b>" + dF.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + "</b><span>" + pd2(dF.getHours()) + ":" + pd2(dF.getMinutes()) + "</span></div>" +
            "<div class='fo-c2-fxm'><b>" + (c2f.challenger_club === t.name ? "vs " + E(c2f.opponent_club) : "@ " + E(c2f.challenger_club)) + "</b><span>Friendly &middot; " + foPitchName(c2f.pitch || "balanced") + "</span></div>" +
            "<span class='fo-c2-fxn fr'>FR</span></div>" });
        });
      } catch (eFx) {}
      fxItems.sort(function (a9, b9) { return (a9.at || 0) - (b9.at || 0); });   // soonest first, friendlies in their true slot
      var fxH = fxItems.slice(0, 6).map(function (x) { return x.html; });
      var fxCard = "<div class='fo-card fo-o-fx'><div class='fo-card-h2row'><div class='fo-card-h2'>Upcoming fixtures</div><a href='#/matches' class='fo-morelink'>View all &rsaquo;</a></div><div class='fo-card-b'>" +
        (fxH.length ? fxH.slice(0, 3).join("") + (fxH.length > 3 ? "<div class='fo-fx-more'>" + fxH.slice(3).join("") + "</div>" : "") : "<div class='small'>Season complete.</div>") +
        "<a class='fo-c2-wmore' href='#/matches'>View full fixture list &rsaquo;</a></div></div>";
      var trainCard = "";
      if (rep0 && (rep0.gains || []).length) {
        trainCard = "<div class='fo-card'><div class='fo-card-h2row'><div class='fo-card-h2'>Training insight</div><a href='#/training' class='fo-morelink'>Go to Training &rsaquo;</a></div><div class='fo-card-b'>" +
          "<div class='fo-fin-line'><b>" + rep0.gains.length + "</b> training gain" + (rep0.gains.length === 1 ? "" : "s") + " after the last matchday." +
          "<div class='small' style='margin-top:4px'>" + E(rep0.gains[0] || "") + (rep0.gains.length > 1 ? " &middot; +" + (rep0.gains.length - 1) + " more" : "") + "</div></div></div></div>";
      }
      // first-session golden path: exactly ONE "needs you today" item
      var goldCard = "";
      try { goldCard = foQsGolden(nxt, ordersIn, t); } catch (eQg) {}
      // a freshly founded club owes its manager one warm-up: launch it once
      try {
        // the warm-up invite is a first-session thing: a flag older than a day
        // (manager closed the tab mid-onboarding, came back next week) expires
        var tuF = lsGet("fo_qs_tut");
        if (tuF && (+tuF ? Date.now() - +tuF > 24 * 3600000 : false)) { lsDel("fo_qs_tut"); tuF = null; }
        if (tuF && !document.getElementById("fo-tut")) setTimeout(foQsTutorial, 500);
      } catch (eTu) {}
      var html = "<div class='fo-ch fo-ch-min'>" + search + hero + goldCard + "<div id='fo-chal-alert'></div>" + stats +
        "<div class='fo-c2-grid'>" + newsCard + standings + fxCard + watchCard + "</div>" +
        "<div class='fo-c2-bottom'>" + leadBat + leadBowl + leadCombo + msCard + fin + "</div></div>";
      setTimeout(foNextFriendly, 80);

      var page = document.getElementById("page"); if (!page) return;
      page.innerHTML = html;
      // wire interactions
      try { foSearchWire(page); } catch (eSw) {}
      page.querySelectorAll(".fo-rowlink[data-sc]").forEach(function (tr) { tr.addEventListener("click", function () { location.hash = "#/scorecard?i=" + tr.getAttribute("data-sc"); }); });
      page.querySelectorAll(".fo-setr").forEach(function (b) { b.addEventListener("click", function () { foSetOrdersForRound(+b.getAttribute("data-r")); }); });
      page.querySelectorAll(".fo-fr-play").forEach(function (b) { b.addEventListener("click", function () { var fr = foFriendlies[+b.getAttribute("data-i")]; if (fr) foPlayFriendly(fr); }); });
      page.querySelectorAll(".fo-fr-x").forEach(function (b) { b.addEventListener("click", function () { foRemoveFriendly(+b.getAttribute("data-i")); }); });
      page.querySelectorAll(".fo-scoutname").forEach(function (c) { c.addEventListener("click", function () { scoutClub(c.textContent || ""); }); });
      var cta = page.querySelector(".fo-next-cta[data-r]");
      if (cta) cta.addEventListener("click", function () { foSetOrdersForRound(+cta.getAttribute("data-r")); });
      foQsGoldenWire(page);
      page.querySelectorAll(".fo-todo a[data-go]").forEach(function (a) {
        a.addEventListener("click", function () {
          var go = a.getAttribute("data-go");
          if (go === "orders") foSetOrdersForRound(+a.getAttribute("data-r"));
          else { location.hash = "#/" + go; if (typeof window.route === "function") window.route(); }
        });
      });
      // the Journey centerpiece: the whole card walks you to the Circuit
      page.querySelectorAll(".fo-home-j[data-go]").forEach(function (jc) {
        jc.addEventListener("click", function (ev) {
          if (ev.target && ev.target.closest && ev.target.closest("a")) return;   // Club story link keeps its own hash
          location.hash = "#/circuit"; if (typeof window.route === "function") window.route();
        });
      });
      // live countdown; the interval kills itself when the element leaves the page
      if (foCdTimer) { clearInterval(foCdTimer); foCdTimer = null; }
      var cdEl = page.querySelector("#fo-cd");
      if (cdEl) foCdTimer = setInterval(function () {
        var el = document.getElementById("fo-cd");
        if (!el) { clearInterval(foCdTimer); foCdTimer = null; return; }
        el.textContent = foCdText(foNextMatchdayMs());
      }, 1000);
    } catch (e) { console.warn("foPremiumClub", e); if (foOrigClub) try { foOrigClub(); } catch (e2) {} }
  }
  // Show the real match time (league rounds resolve at 09:00 New York) next to the
  // date in any fixtures/results table. Safe: only tables that have a "Date" header.
  // Open a rival club's page (in the game, not a dark modal): a hero banner with
  // position + form, recent results, upcoming fixtures, and a sortable Players tab
  // · with a Challenge button. Reached by clicking a club name in any table.
  // One round a day at 9:00 AM New York. Once the resolver has advanced
  // today's round (snapshot stamp), the CURRENT round plays TOMORROW - so a
  // round played this morning keeps today's date instead of yesterday's.
  function foCurAdvanced() {
    try {
      var adv = window.__foAdvDate; if (!adv) return false;
      var f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
      return String(adv) >= f.format(new Date());
    } catch (e) { return false; }
  }
  function foDailyDate(r, opts) {
    var curR = (typeof App !== "undefined" && App.season) ? App.season.round : 0;
    var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (r - curR) + (foCurAdvanced() ? 1 : 0));
    return d.toLocaleDateString("en-GB", opts || { day: "2-digit", month: "short" });
  }
  var foScoutIx = null, foScoutTab = "overview", foScoutSort = "rating";
  // a club's flag emoji, from its country (or its dressing room's majority)
  function foClubFlagEmo(nm) {
    try {
      var ts = (typeof GD !== "undefined" && GD.teams) || [], t = null;
      for (var i = 0; i < ts.length; i++) if (ts[i] && ts[i].name === nm) { t = ts[i]; break; }
      if (!t) return "";
      var mine = App.teamIx != null && ts[App.teamIx] === t;
      var c = (mine && SYNC && SYNC.myTeam && SYNC.myTeam.country) || t.country || (((t.players || [])[0] || {}).nat) || "";
      return (c && typeof foFlag === "function") ? (foFlag(c) || "") : "";
    } catch (e) { return ""; }
  }
  // stamp country flags onto club names in any league table / standings panel
  function foFlagStandings() {
    try {
      if (!(typeof GD !== "undefined" && GD.teams)) return;
      var names = GD.teams.map(function (t) { return t && t.name; }).filter(Boolean);
      document.querySelectorAll("#page .panel, #page .fo-card").forEach(function (pn) {
        var h = pn.querySelector("h4, .fo-card-h2"); if (!h) return;
        if (!/league table|league standings/i.test(h.textContent || "")) return;
        pn.querySelectorAll("tbody tr").forEach(function (tr) {
          var tds = tr.querySelectorAll("td");
          for (var i = 0; i < tds.length; i++) {
            var td = tds[i], txt = (td.textContent || "").trim();
            var nm = null;
            for (var j = 0; j < names.length; j++) if (txt === names[j] || txt.indexOf(names[j]) === 0) { nm = names[j]; break; }
            if (!nm) continue;
            if (!td.querySelector(".fo-flg")) {
              var fl = foClubFlagEmo(nm);
              // foFlag returns markup (an <img> flag), not an emoji character
              if (fl) {
                var sp = document.createElement("span"); sp.className = "fo-flg"; sp.innerHTML = fl;
                td.insertBefore(sp, td.firstChild);
              }
            }
            // bots wear a quiet tag so human rivals stand out at a glance
            try {
              if (!td.querySelector(".fo-bot-mini") && SYNC && SYNC.started && !SYNC.practice && LG && window.__foClubMeta && !foClubHuman(nm)) {
                var bt = document.createElement("span"); bt.className = "fo-bot-mini"; bt.textContent = "BOT";
                td.appendChild(bt);
              }
            } catch (eB) {}
            break;
          }
        });
      });
    } catch (e) {}
  }
  function scoutClub(cellText) {
    var idx = -1;
    if (typeof GD !== "undefined" && GD.teams) { for (var i = 0; i < GD.teams.length; i++) { if (GD.teams[i] && cellText.indexOf(GD.teams[i].name) >= 0) { idx = i; break; } } }
    if (idx < 0) return;
    foScoutIx = idx; foScoutTab = "overview"; foScoutSort = "rating";
    location.hash = "#/scout?t=" + idx;
  }
  // What a scout is FOR: how do you beat this team? Shape, notes and threats
  // are computed from the squad and the season's own numbers.
  function foScoutBrief(t, ix) {
    var out = { rel: null, depth: "", depthSub: "", attack: "", attackSub: "", notes: [], threats: [] };
    try {
      var players = (t.players || []).slice();
      var mine = null; try { mine = userTeam(); } catch (e) {}
      var avg = function (arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : 0; };
      var theirAvg = avg(players.map(function (p) { return p.rating || 0; }));
      if (mine && mine.name !== t.name) {
        var myAvg = avg((mine.players || []).map(function (p) { return p.rating || 0; }));
        if (myAvg > 0) out.rel = Math.round(100 * (theirAvg / myAvg - 1));
      }
      out.strength = Math.round(theirAvg);
      // batting depth from the game's own aggregate, best XI by batting
      var bats = players.map(function (p) { return foAgg(p, "bat"); }).sort(function (a, b) { return b - a; });
      var capable = bats.filter(function (v) { return v >= 48; }).length;
      var thinAt = capable + 1;
      if (capable >= 8) { out.depth = "Deep"; out.depthSub = "runs all the way down"; }
      else if (capable >= 6) { out.depth = "Solid"; out.depthSub = "thin after #" + Math.min(8, thinAt); }
      else { out.depth = "Top-heavy"; out.depthSub = "thin after #" + Math.max(3, capable); }
      // attack mix from frontline bowlers
      var front = players.filter(function (p) { return p.bowlTypeFull ? !/^(none|partTime)/.test(p.bowlTypeFull) : !!p.bowlType; });
      var pace = front.filter(function (p) { return foIsPace(p); }).length, spin = front.length - pace;
      if (!spin) { out.attack = "Pace-heavy"; out.attackSub = "no frontline spin"; }
      else if (!pace) { out.attack = "Spin-only"; out.attackSub = "no frontline seam"; }
      else if (pace >= spin * 2) { out.attack = "Pace-leaning"; out.attackSub = spin + " spinner" + (spin > 1 ? "s" : ""); }
      else if (spin >= pace * 2) { out.attack = "Spin-leaning"; out.attackSub = pace + " seamer" + (pace > 1 ? "s" : ""); }
      else { out.attack = "Balanced attack"; out.attackSub = pace + " pace · " + spin + " spin"; }
      // season numbers per player
      var stats = players.map(function (p) {
        var h = (App.playerHist && App.playerHist[p.name]) || [];
        var runs = 0, balls = 0, wkts = 0, conceded = 0;
        h.forEach(function (e2) { runs += e2.rr || 0; balls += e2.bb || 0; wkts += e2.w || 0; conceded += e2.cr || 0; });
        return { p: p, runs: runs, balls: balls, wkts: wkts, conceded: conceded };
      });
      var teamRuns = stats.reduce(function (a, x) { return a + x.runs; }, 0);
      // note: openers' share of runs
      var openers = stats.filter(function (x) { return x.p.role === "opener"; });
      var opRuns = openers.reduce(function (a, x) { return a + x.runs; }, 0);
      if (teamRuns >= 100 && opRuns / teamRuns >= 0.45) out.notes.push("Their openers score " + Math.round(100 * opRuns / teamRuns) + "% of the runs - early wickets decapitate the innings.");
      // note: middle order vs spin (scouting read from ability, phrased as words)
      var mid = players.slice().sort(function (a, b) { return foAgg(b, "bat") - foAgg(a, "bat"); }).slice(3, 7);
      if (mid.length >= 3) {
        var vsSpin = avg(mid.map(function (p) { return (p.skills && p.skills.vsSpin) || 0; }));
        var vsPace = avg(mid.map(function (p) { return (p.skills && p.skills.vsPace) || 0; }));
        if (vsSpin < 42 && vsSpin < vsPace - 8) out.notes.push("The middle order looks uneasy against the turning ball - a Crumbling or Slow track with early spin is your best route.");
        else if (vsPace < 42 && vsPace < vsSpin - 8) out.notes.push("The middle order can be rushed by pace - a Green top and a hard new-ball burst pays.");
      }
      // note: strike bowler stamina
      var strike = stats.filter(function (x) { return x.wkts > 0; }).sort(function (a, b) { return b.wkts - a.wkts; })[0];
      if (strike && ((strike.p.skills && strike.p.skills.stamina) || 99) < 45) out.notes.push("Strike bowler " + strike.p.name + " fades in long spells - see off the opening burst and cash in later.");
      // note: left-handers
      var lefties = players.filter(function (p) { return p.hand === "L"; }).length;
      if (lefties >= 5) out.notes.push(lefties + " left-handers in the squad - matchups that turn the ball away from them play up.");
      if (!out.notes.length) out.notes.push("No glaring weakness in the numbers yet - beat them with conditions: pick the pitch that suits your attack, not theirs.");
      // key threats: top bat, top bowler, plus one to watch
      var wordy = function (p) { return String(p.formWord || "").toLowerCase(); };
      var tb2 = stats.filter(function (x) { return x.runs > 0 && x.balls > 0; }).sort(function (a, b) { return b.runs - a.runs; })[0];
      if (tb2) out.threats.push({ nm: tb2.p.name, sub: (typeof prole === "function" ? prole(tb2.p.role) : "") + " · " + tb2.runs + " runs @ " + Math.round(100 * tb2.runs / tb2.balls) + " SR", tag: /good|strong|hot/.test(wordy(tb2.p)) ? "In form" : "Top scorer", tone: "hot" });
      var tw = stats.filter(function (x) { return x.wkts > 0; }).sort(function (a, b) { return b.wkts - a.wkts; })[0];
      if (tw) out.threats.push({ nm: tw.p.name, sub: (tw.p.btLabel || "bowler") + " · " + tw.wkts + " wkts @ " + (tw.wkts ? (tw.conceded / tw.wkts).toFixed(1) : "-"), tag: "Strike threat", tone: "strike" });
      var watch = players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).filter(function (p) { return (!tb2 || p.name !== tb2.p.name) && (!tw || p.name !== tw.p.name); })[0];
      if (watch) out.threats.push({ nm: watch.name, sub: (typeof prole === "function" ? prole(watch.role) : "") + " · their highest-rated player", tag: "Watch", tone: "watch" });
    } catch (e) {}
    return out;
  }
  function foScoutOverview(t, ix) {
    var pad0 = function (n) { return (n < 10 ? "0" : "") + n; };
    var frAll = [];
    try {
      frAll = foFrAllNow(function () {
        var pg0 = document.getElementById("page");
        if (pg0 && location.hash.indexOf("#/scout") === 0) { pg0.__scoutSig = null; foRenderScout(); }
      }) || [];
    } catch (eFa) {}
    var frMine = frAll.filter(function (c) { return c && (c.challenger_club === t.name || c.opponent_club === t.name); });
    var frTag = function (c) {
      // practice = a bot on either side; without roster data, say Friendly
      try { if (foClubMetaNow() && (!foClubHuman(c.challenger_club) || !foClubHuman(c.opponent_club))) return "Practice"; } catch (e0) {}
      return "Friendly";
    };
    var res = (App.results || []).filter(function (r) { return r.home === t.name || r.away === t.name; });
    // league results are dated by their round on the real ET calendar - the
    // engine's own r.date runs on a fictional schedule and reads days ahead
    var lgAt = function (rn) {
      try {
        var d9 = new Date(); d9.setHours(9, 0, 0, 0);
        d9.setDate(d9.getDate() + (rn - App.season.round) + (foCurAdvanced() ? 1 : 0));
        return +d9;
      } catch (e9) { return 0; }
    };
    var resList = res.map(function (r) {
      var atR = (Date.parse(r.date || "") || 0) + 9 * 3600000, dTxtR = E(r.date || "");
      try {
        if (r.comp === "league" && r.round != null) {
          atR = lgAt(r.round);
          dTxtR = E(foWhenTxt(atR));
        }
      } catch (eDr) {}
      return { at: atR, html: "<tr class='rowlink' data-sc='" + r.ix + "'><td>" + dTxtR + "</td><td>" + E(r.home) + " v " + E(r.away) + "</td><td>" + E(r.result ? r.result.text : "") + "</td></tr>" };
    });
    frMine.forEach(function (c) {
      if (c.status !== "played" || !c.result || foFrBcastState(c).phase !== "done") return;
      var rt = c.result.result_text || "played";
      // a practice game played on this device is already in App.results
      var dup = res.some(function (r) { return r.result && r.result.text === rt && ((r.home === c.challenger_club && r.away === c.opponent_club) || (r.home === c.opponent_club && r.away === c.challenger_club)); });
      if (dup) return;
      var at = Date.parse(c.play_at || "") || 0, d = new Date(at);
      var dTxt = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + " " + pad0(d.getHours()) + ":" + pad0(d.getMinutes());
      resList.push({ at: at, html: "<tr class='rowlink' data-fr='" + c.id + "'><td>" + dTxt + "</td><td>" + E(c.challenger_club) + " v " + E(c.opponent_club) + " <span class='fo-fr-tag'>" + frTag(c) + "</span></td><td>" + E(rt) + "</td></tr>" });
    });
    resList.sort(function (a, b) { return b.at - a.at; });
    var resRows = resList.slice(0, 6).map(function (x) { return x.html; }).join("") || "<tr><td colspan='3' class='small'>No matches played yet.</td></tr>";
    var ups = [], grounds = {}, S = App.season, myIx = App.teamIx;
    var roundTs = function (r0) { var d = new Date(); d.setHours(9, 0, 0, 0); d.setDate(d.getDate() + (r0 - S.round) + (foCurAdvanced() ? 1 : 0)); return +d; };
    if (S && S.schedule) for (var r = S.round; r < S.schedule.length && ups.length < 5; r++) {
      var rd = S.schedule[r] || [];
      for (var i = 0; i < rd.length; i++) {
        var f = rd[i]; if (f[0] !== ix && f[1] !== ix) continue; if (S.played[fixtureKey(r, f)] !== undefined) continue;
        var home = GD.teams[f[0]], opp = GD.teams[f[0] === ix ? f[1] : f[0]];
        var gtxt = E(home.ground) + " (" + foPitchName(groundPitch(home.ground)) + ")";
        grounds[gtxt] = 1;
        var isMe = (f[0] === myIx || f[1] === myIx) && ix !== myIx;
        ups.push({ at: roundTs(r), me: isMe, html: "<tr" + (isMe ? " class='fo-sc-merow'" : "") + "><td>" + foDailyDate(r) + "</td><td>R" + (r + 1) + "</td><td>" + (f[0] === ix ? "vs " : "@ ") + E(opp.name) + (isMe ? " <span class='fo-sc-you'>your match</span>" : "") + "</td>", g: "<td class='small'>" + gtxt + "</td></tr>" });
      }
    }
    // scheduled friendlies sit among the league fixtures, time and all
    frMine.forEach(function (c) {
      if (c.status !== "accepted" || foFrBcastState(c).phase !== "pre") return;
      var at = Date.parse(c.play_at || "") || 0, d = new Date(at);
      var homeT = null; try { homeT = GD.teams.filter(function (x) { return x.name === c.challenger_club; })[0]; } catch (eH) {}
      var gtxt2 = (homeT ? E(homeT.ground) + " " : "") + "(" + foPitchName(c.pitch || "balanced") + ")";
      grounds[gtxt2] = 1;
      var isHome = c.challenger_club === t.name;
      var dTxt = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + pad0(d.getHours()) + ":" + pad0(d.getMinutes());
      ups.push({ at: at, me: false, html: "<tr><td>" + dTxt + "</td><td><span class='fo-fr-tag'>" + frTag(c) + "</span></td><td>" + (isHome ? "vs " : "@ ") + E(isHome ? c.opponent_club : c.challenger_club) + "</td>", g: "<td class='small'>" + gtxt2 + "</td></tr>" });
    });
    ups.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    var oneGround = Object.keys(grounds).length === 1 ? Object.keys(grounds)[0] : null;
    var upRows = ups.slice(0, 6).map(function (u) { return u.html + (oneGround ? "</tr>" : u.g); }).join("") || "<tr><td colspan='4' class='small'>Season complete.</td></tr>";
    var upNote = oneGround ? "<div class='small' style='margin-bottom:6px'>All matches at " + oneGround + ", " + MATCH_TIME + ".</div>" : "";
    // head-to-head vs MY club, like a rivalry page
    var h2h = "";
    try {
      var mine = userTeam().name;
      if (t.name !== mine) {
        var meets = (App.results || []).filter(function (r) { return (r.home === t.name && r.away === mine) || (r.home === mine && r.away === t.name); });
        var myW = 0, thW = 0, meetAll = [];
        meets.forEach(function (r) {
          if (r.result && r.result.winner === mine) myW++; else if (r.result && r.result.winner === t.name) thW++;
          var dTx9 = E(r.date || ""), at9 = Date.parse(r.date || "") || 0;
          try {
            if (r.comp === "league" && r.round != null) {
              var dA = new Date(); dA.setHours(9, 0, 0, 0); dA.setDate(dA.getDate() + (r.round - App.season.round) + (foCurAdvanced() ? 1 : 0)); at9 = +dA;
              dTx9 = E(foWhenTxt(at9));
            }
          } catch (eD9) {}
          meetAll.push({ at: at9, html: "<tr class='rowlink' data-sc='" + r.ix + "'><td>" + dTx9 + "</td><td>" + E(r.result ? r.result.text : "") + "</td></tr>" });
        });
        // challenge friendlies count too - a rivalry is a rivalry
        try {
          (window.__foFrAll || []).forEach(function (cF) {
            if (!cF || cF.status !== "played" || !cF.result || !cF.result.result_text) return;
            var pairF = [cF.challenger_club, cF.opponent_club];
            if (!(pairF.indexOf(t.name) >= 0 && pairF.indexOf(mine) >= 0)) return;
            if (typeof foFrBcastState === "function" && foFrBcastState(cF).phase !== "done") return;   // still on air: no spoilers
            var rtF = cF.result.result_text;
            if (rtF.indexOf(mine) === 0) myW++; else if (rtF.indexOf(t.name) === 0) thW++;
            var dF9 = new Date(cF.play_at);
            meetAll.push({ at: +dF9 || 0, html: "<tr class='rowlink' data-fr='" + cF.id + "'><td>" + dF9.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + ("0" + dF9.getHours()).slice(-2) + ":" + ("0" + dF9.getMinutes()).slice(-2) + " <span class='fo-fr-tag'>Friendly</span></td><td>" + E(rtF) + "</td></tr>" });
          });
        } catch (eFh) {}
        meetAll.sort(function (a9, b9) { return b9.at - a9.at; });
        var meetRows = meetAll.slice(0, 5).map(function (x9) { return x9.html; }).join("") || "<tr><td colspan='2' class='small'>You have not met yet. First blood awaits.</td></tr>";
        h2h = "<div class='panel'><h4>Head to head</h4><div class='pad'>" +
          "<div class='fo-h2h'><span><b>" + myW + "</b> " + E(mine) + "</span><i>v</i><span><b>" + thW + "</b> " + E(t.name) + "</span></div>" +
          "<table><tr><th>Date</th><th>Result</th></tr>" + meetRows + "</table></div></div>";
      }
    } catch (e) {}
    // the actual scout report: how do you beat them, and who hurts you
    var brief = foScoutBrief(t, ix);
    var notes = "<div class='panel fo-sc-notes'><h4>&#128203; Scouting notes</h4><div class='pad'>" +
      brief.notes.map(function (n) { return "<div class='fo-sc-note'>" + E(n) + "</div>"; }).join("") + "</div></div>";
    var threats = "";
    if (brief.threats.length) threats = "<div class='panel'><h4>Key threats</h4><div class='pad'>" +
      brief.threats.map(function (th) {
        return "<div class='fo-threat'><div><a class='fo-sp-nm' href='#/player?n=" + encodeURIComponent(th.nm) + "'>" + E(th.nm) + "</a>" +
          "<div class='small'>" + E(th.sub) + "</div></div><span class='fo-tag fo-tag-" + th.tone + "'>" + E(th.tag) + "</span></div>";
      }).join("") + "</div></div>";
    var battles = "";
    try { battles = foBattlesCard(t); } catch (e) {}
    // broadcasts involving this club - every match in the league is public,
    // so any manager can tune in to any other manager's game live
    var liveStrip = "";
    try {
      var lv = [];
      var em2 = (typeof foEmbargo === "function") ? foEmbargo() : { active: false };
      if (em2 && em2.active) {
        (foLeagueRounds()[em2.round] || []).forEach(function (r0) {
          if (r0 && (r0.home === t.name || r0.away === t.name) && r0.ix != null)
            lv.push({ on: !em2.pre, txt: E(r0.home) + " v " + E(r0.away), sub: em2.pre ? "League matchday &middot; play begins 9:00 AM ET" : "League matchday", go: "#/scorecard?i=" + r0.ix });
        });
      }
      frMine.forEach(function (c) {
        if (c.status !== "accepted" && c.status !== "played") return;
        var stF = foFrBcastState(c);
        var ttl = E(c.challenger_club) + " v " + E(c.opponent_club);
        if (stF.phase === "live") lv.push({ on: true, txt: ttl, sub: frTag(c), go: "#/friendly?id=" + c.id });
        else if (stF.phase === "pre") lv.push({ on: false, txt: ttl, sub: frTag(c) + " &middot; " + new Date(c.play_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }), go: "#/friendly?id=" + c.id });
      });
      if (lv.length) {
        lv.sort(function (a, b) { return (b.on ? 1 : 0) - (a.on ? 1 : 0); });
        var anyOn = lv.some(function (l) { return l.on; });
        liveStrip = "<div class='panel fo-keep'><h4>" + (anyOn ? "<span class='live-dot'></span> On air" : "&#128250; On air soon") + "</h4><div class='pad'>" +
          lv.map(function (l) {
            return "<div class='fo-live-row'><b>" + l.txt + "</b><span>" + l.sub + "</span><a href='" + l.go + "'>" + (l.on ? "Watch live" : "Tune in") + " &rsaquo;</a></div>";
          }).join("") +
          "<div class='small' style='margin-top:8px;color:#667085'>Every broadcast in the league is public - tune in to any manager's match, ball by ball.</div></div></div>";
      }
    } catch (eLv) {}
    // recent events: milestones, call-ups, nicknames, farewells - the club's
    // recent life beyond bare results, straight from its players' careers
    var events = "";
    try {
      var evs = [];
      (t.players || []).forEach(function (p) {
        (p._career || []).forEach(function (c) {
          if (c.ev === "debut") return;
          evs.push({ s: c.s || 0, r: c.r || 0, txt: p.name + " \u00b7 " + (c.txt || "") });
        });
      });
      evs.sort(function (a, b) { return (b.s - a.s) || (b.r - a.r); });
      if (evs.length) events = "<div class='panel'><h4>Recent events</h4><div class='pad'><table>" +
        evs.slice(0, 8).map(function (e2) {
          var d = (typeof foRoundDate === "function") ? foRoundDate(e2.s, e2.r) : "S" + e2.s + " R" + e2.r;
          return "<tr><td class='small' style='white-space:nowrap'>" + E(d) + "</td><td>" + E(e2.txt) + "</td></tr>";
        }).join("") + "</table></div></div>";
    } catch (eEv) {}
    return notes +
      "<div class='fo-sc2'>" + threats + h2h + "</div>" + battles + liveStrip +
      "<div class='panel'><h4>Recent results <span class='small' style='font-weight:400'>&middot; last 5</span></h4><div class='pad'><table><tr><th>Date</th><th>Match</th><th>Result</th></tr>" + resRows + "</table></div></div>" +
      "<div class='panel'><h4>Upcoming fixtures <span class='small' style='font-weight:400'>&middot; next 5</span></h4><div class='pad'>" + upNote + "<table><tr><th>Date</th><th>Rd</th><th>Opponent</th>" + (oneGround ? "" : "<th>Ground</th>") + "</tr>" + upRows + "</table></div></div>" + events;
  }
  // Tone a scouting word: skill words rank via the engine's WORDS ladder,
  // fatigue words via their own ladder. Green reads strong, red reads weak.
  function foWordTone(w) {
    try {
      w = String(w || "").toLowerCase();
      var FAT = ["clinically dead", "shattered", "exhausted", "listless", "weary", "moderate", "satisfactory", "passable", "energetic", "revived", "rested"];
      var fi = FAT.indexOf(w);
      if (fi >= 0) return fi >= 8 ? "hi" : fi >= 5 ? "mid" : "lo";
      if (typeof WORDS !== "undefined") {
        var wi = WORDS.indexOf(w);
        if (wi >= 0) return wi >= 9 ? "hi" : wi >= 5 ? "mid" : "lo";
      }
    } catch (e) {}
    return "mid";
  }
  function foScoutPlayers(t) {
    var players = (t.players || []).slice();
    if (foScoutSort === "age") players.sort(function (a, b) { return (a.age || 0) - (b.age || 0) || (b.rating || 0) - (a.rating || 0); });
    else if (foScoutSort === "wage") players.sort(function (a, b) { return (b.wage || 0) - (a.wage || 0); });
    else players.sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    var ttip = function (tl) { try { return (typeof TALTIPS !== "undefined" && TALTIPS[tl]) || ""; } catch (e) { return ""; } };
    var wordOf = function (v) { try { return (typeof word === "function") ? word(v) : ""; } catch (e) { return ""; } };
    var wSpan = function (w, lbl) {
      if (!w) return "";
      return "<span class='fo-sp-word'><b class='fo-q-" + foWordTone(w) + "'>" + E(String(w)) + "</b> " + lbl + "</span>";
    };
    var rows = players.map(function (p) {
      var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? (foFlag(p.nat) || "") : ""; } catch (e) {}
      var hand = p.hand === "L" ? "Left hand batsman" : "Right hand batsman";
      var bowl = (p.btLabel && p.btLabel !== "Does not bowl") ? p.btLabel : "Does not bowl";
      var tals = (p.talents || []).map(function (tl) { return "<span class='fo-dc-tal' title='" + E(ttip(tl)) + "'>" + E(foTalentName(tl)) + "</span>"; }).join("");
      var words = [
        wSpan(p.expWord || wordOf(p.exp), "experience"),
        wSpan(p.formWord, "form"),
        wSpan(p.fatigue || "rested", "fatigue"),
        wSpan(p.captWord || wordOf(p.capt), "captaincy")
      ].filter(Boolean).join("<i class='fo-sp-dot'>·</i>");
      return "<div class='fo-sp'>" +
        "<div class='fo-sp-h'>" + (flag ? "<span class='fo-sp-flag'>" + flag + "</span>" : "") +
        "<a class='fo-sp-nm' href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + "</a>" +
        (p.keeper ? "<span class='small'>(wk)</span>" : "") +
        "<span class='fo-rl'>" + foRoleShort(p) + "</span>" +
        "<span class='fo-sp-rt'>" + ((p.rating || 0) / 1000).toFixed(1) + "<i>OVR</i></span></div>" +
        "<div class='fo-sp-meta'>" + (p.age || "?") + " years old · " + FO$(p.wage || 0) + " wage · " + hand + " · " + E(bowl) + "</div>" +
        (tals ? "<div class='fo-sp-tals'>" + tals + "</div>" : "") +
        (words ? "<div class='fo-sp-words'>" + words + "</div>" : "") +
        "</div>";
    }).join("");
    var sortBar = "<div class='fo-sortbar small'>Sort by: " +
      "<a class='fo-sortby" + (foScoutSort === "rating" ? " on" : "") + "' data-s='rating'>Rating</a> · " +
      "<a class='fo-sortby" + (foScoutSort === "age" ? " on" : "") + "' data-s='age'>Age</a> · " +
      "<a class='fo-sortby" + (foScoutSort === "wage" ? " on" : "") + "' data-s='wage'>Wage</a></div>";
    return "<div class='panel'><h4>Players · " + players.length + "</h4><div class='pad'>" + sortBar + rows + "</div></div>";
  }
  function foScoutHTML(ix) {
    var t = GD.teams[ix], players = (t.players || []);
    var avg = players.length ? Math.round(players.reduce(function (s, p) { return s + (p.rating || 0); }, 0) / players.length) : 0;
    var rows = typeof leagueRows === "function" ? leagueRows() : [];
    var pi = rows.findIndex(function (x) { return x.nm === t.name; }), pos = pi >= 0 ? pi + 1 : null, rec = rows[pi] || null;
    var form = foFormMap()[t.name] || [];
    var pips = form.map(function (x) { return "<i class='fo-pip fo-" + x + "' title='" + x + "'></i>"; }).join("") || "<span class='small'>no matches yet</span>";
    var isMe = ix === App.teamIx;
    var brief = foScoutBrief(t, ix);
    var relTxt = "";
    if (brief.rel != null) relTxt = "<i class='" + (brief.rel > 0 ? "fo-rel-up" : "fo-rel-dn") + "'>" + (brief.rel > 0 ? "+" : "") + brief.rel + "% vs you</i>";
    // fourth tile: the fixture that matters (or your own supporter base)
    var meet = null;
    if (!isMe && App.season && App.season.schedule) {
      for (var fr2 = App.season.round; fr2 < App.season.schedule.length; fr2++) {
        var hit = (App.season.schedule[fr2] || []).some(function (f2) {
          return (f2[0] === ix && f2[1] === App.teamIx) || (f2[1] === ix && f2[0] === App.teamIx);
        });
        if (hit) { meet = { r: fr2 + 1, d: foDailyDate(fr2, { day: "numeric", month: "short" }) }; break; }
      }
    }
    var kpi4 = isMe
      ? "<div class='fo-kpi'><span>Supporters</span><b>" + ((t.supporters || 0) / 1000).toFixed(1) + "k</b><i>the faithful</i></div>"
      : (meet ? "<div class='fo-kpi'><span>Next meeting</span><b>R" + meet.r + "</b><i>" + E(meet.d) + "</i></div>"
        : "<div class='fo-kpi'><span>Next meeting</span><b>–</b><i>not this season</i></div>");
    var kpi = "<div class='fo-scout-kpis'>" +
      "<div class='fo-kpi'><span>Squad strength</span><b>" + (avg / 1000).toFixed(1) + "</b>" + relTxt + "</div>" +
      "<div class='fo-kpi'><span>Batting depth</span><b>" + brief.depth + "</b><i>" + brief.depthSub + "</i></div>" +
      "<div class='fo-kpi'><span>Attack mix</span><b>" + brief.attack + "</b><i>" + brief.attackSub + "</i></div>" + kpi4 + "</div>";
    var ordinal = pos ? (pos + (["th", "st", "nd", "rd"][((pos % 100) - 20) % 10] || ["th", "st", "nd", "rd"][pos % 100] || "th")) : null;
    var scFlag = "";
    try {
      var scC = (isMe && SYNC && SYNC.myTeam && SYNC.myTeam.country) || t.country || (((t.players || [])[0] || {}).nat) || "";
      if (scC && typeof foFlag === "function") scFlag = ((foFlag(scC) || "") + " " + E(scC) + " · ").replace(/^ /, "");
    } catch (eFl) {}
    var hero = "<div class='fo-scout-hero'><div class='fo-scout-hero-main'>" +
      "<div class='fo-scout-eyebrow'>" + (isMe ? "Your club" : "Scout report") + "</div>" +
      "<h1 class='fo-scout-name'>" + E(t.name) + "</h1>" +
      "<div class='fo-scout-meta'>" + scFlag + (ordinal ? ordinal + " place · " : "") + (rec ? rec.w + "–" + rec.l + "–" + rec.t : "0–0–0") + " · " + E(t.ground || "-") + "" + " · Form <span class='fo-form'>" + pips + "</span>" + (function () {
        try {
          if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return "";
          if (isMe) return " · Manager <b>" + E((SYNC.me && SYNC.me.display_name) || "you") + "</b> <i class='fo-dot fo-dot-on' title='online'></i>";
          if (foClubHuman(t.name)) {
            var on = foClubOnline(t.name);
            var seen = foLastSeenTxt(t.name);
            return " · Manager <b>" + E(foClubManager(t.name) || "") + "</b>" +
              (on === null ? "" : " <i class='fo-dot " + (on ? "fo-dot-on" : "fo-dot-off") + "'></i>") +
              (seen ? " <span class='fo-seen'>" + E(seen) + "</span>" : "");
          }
          if (!foClubMetaNow()) return "";   // roster still loading: say nothing rather than guess
          return " · <span class='fo-bot-chip'>BOT · computer managed</span>";
        } catch (e) { return ""; }
      })() + "</div>" +
      (function () { try { var eb8 = foEstBadge(t); return eb8 ? "<div class='fo-scout-est'>" + eb8 + "</div>" : ""; } catch (e8) { return ""; } })() +
      "<div class='fo-scout-actions'>" + (isMe ? "" : "<button class='fo-challenge'>Challenge to a match</button>") + "<button class='fo-scout-back'>← Back</button></div>" +
      "</div><div class='fo-scout-hero-r'>" + kpi + "</div></div>";
    var links = "<div class='fo-scout-links'>" +
      "<a class='fo-stab" + (foScoutTab === "overview" ? " on" : "") + "' data-tab='overview'>Overview</a>" +
      "<a class='fo-stab" + (foScoutTab === "players" ? " on" : "") + "' data-tab='players'>Players</a></div>";
    var body = foScoutTab === "players" ? foScoutPlayers(t) : foScoutOverview(t, ix);
    return "<div class='crumb'><span>" + E(t.name) + "</span></div><div class='fo-scout'>" + hero +
      "<div class='fo-scout-shell'>" + links + "<div class='fo-scout-body'>" + body + "</div></div></div>";
  }
  // Human-vs-human challenge: pick pitch, weather and a time; the opponent
  // must accept before the resolver plays it. Bots fall back to practice.
  function foChallengeSmart(ix) {
    if (!(SYNC && SYNC.started && !SYNC.practice && LG)) { foChallenge(ix); return; }
    sel("league_clubs", "league_id=eq." + LG.id + "&select=club,manager_id").then(function (rows) {
      var opp = GD.teams[ix];
      var human = (rows || []).some(function (r) { return r.club && r.club.name === opp.name && r.manager_id !== SYNC.myMid; });
      if (!human) { foMatchSetup(ix); return; }   // bots: full setup (opponent preset, pick pitch + weather)
      var ex = document.getElementById("fo-chal"); if (ex) ex.remove();
      var pitches = FO_PITCHES.map(function (p) { return "<option value='" + p + "'>" + foPitchName(p) + "</option>"; }).join("");
      var wx = (typeof WXLIST !== "undefined" ? WXLIST : ["Sunny"]).map(function (w) { return "<option>" + w + "</option>"; }).join("");
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      // no free typing, no Enter: day / hour / minute dropdowns in the same
      // 24-hour clock the header shows, confirmed by the Send button
      var dflt = new Date(Date.now() + 2 * 3600e3); dflt.setMinutes(0, 0, 0);
      var today0 = new Date(); today0.setHours(0, 0, 0, 0);
      var dfltDayIx = Math.round((new Date(dflt.getFullYear(), dflt.getMonth(), dflt.getDate()) - today0) / 86400000);
      var dayOpts = [];
      for (var di = 0; di < 7; di++) {
        var dd = new Date(today0); dd.setDate(dd.getDate() + di);
        var lbl = (di === 0 ? "Today" : di === 1 ? "Tomorrow" : dd.toLocaleDateString("en-GB", { weekday: "short" })) + " " + dd.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        dayOpts.push("<option value='" + di + "'" + (di === dfltDayIx ? " selected" : "") + ">" + lbl + "</option>");
      }
      var hrOpts = []; for (var hi = 0; hi < 24; hi++) hrOpts.push("<option value='" + hi + "'" + (hi === dflt.getHours() ? " selected" : "") + ">" + pad(hi) + "</option>");
      var mnOpts = [0, 15, 30, 45].map(function (mi) { return "<option value='" + mi + "'" + (mi === 0 ? " selected" : "") + ">" + pad(mi) + "</option>"; }).join("");
      var m = document.createElement("div"); m.id = "fo-chal"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Challenge</div><h3>Challenge " + E(opp.name) + "</h3>" +
        "<div class='small' style='margin:4px 0 10px'>They must accept before the match is played. Schedule it at least <b>75 minutes ahead</b>; lineups lock exactly <b>one hour before kickoff</b>. Times are on the 24-hour clock <b>in your timezone (" + E(foTzAbbr() || "local") + ")</b>.</div>" +
        "<div class='ctlrow'><span>Pitch</span><select id='fo-chal-p'>" + pitches + "</select></div>" +
        "<div class='ctlrow'><span>Weather</span><select id='fo-chal-w'>" + wx + "</select></div>" +
        "<div class='ctlrow'><span>Play on</span><select id='fo-chal-d'>" + dayOpts.join("") + "</select>" +
        "<span>at</span><select id='fo-chal-h'>" + hrOpts.join("") + "</select><b>:</b><select id='fo-chal-m'>" + mnOpts + "</select></div>" +
        "<div class='small' id='fo-chal-prev' style='margin:8px 0 0;color:#1f4e5f;font-weight:600'></div>" +
        "<div style='display:flex;gap:8px;margin-top:12px'><button class='fo-yc-sign' id='fo-chal-go'>Send challenge</button><button class='mini' id='fo-chal-x'>Cancel</button></div></div>";
      document.body.appendChild(m);
      // spell the pick out in both clocks, so nobody schedules 3 hours adrift
      var chalPickT = function () {
        var t9 = new Date(today0);
        t9.setDate(t9.getDate() + (+m.querySelector("#fo-chal-d").value || 0));
        t9.setHours(+m.querySelector("#fo-chal-h").value || 0, +m.querySelector("#fo-chal-m").value || 0, 0, 0);
        return t9;
      };
      var chalPrev = function () {
        try {
          var t9 = chalPickT(), el9 = m.querySelector("#fo-chal-prev");
          var loc = t9.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " + pad(t9.getHours()) + ":" + pad(t9.getMinutes()) + " " + (foTzAbbr() || "your time");
          var et = t9.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }) + " ET";
          el9.innerHTML = "Kicks off " + E(loc) + (loc.indexOf(" ET") < 0 ? " <span style='color:#8a93a3;font-weight:400'>(" + E(et) + " &middot; league clock)</span>" : "");
        } catch (e9) {}
      };
      ["fo-chal-d", "fo-chal-h", "fo-chal-m"].forEach(function (id9) { m.querySelector("#" + id9).addEventListener("change", chalPrev); });
      chalPrev();
      m.querySelector("#fo-chal-x").addEventListener("click", function () { m.remove(); });
      m.querySelector("#fo-chal-go").addEventListener("click", function () {
        var t = chalPickT();
        if (t - Date.now() < 75 * 60000) { say("Pick a time at least 75 minutes ahead - lineups lock an hour before kickoff, so both managers need a window to attach one."); return; }
        var slotProb = foFrSlotProblem(t, [userTeam().name, opp.name]);
        if (slotProb) { say(slotProb); return; }
        rpc("challenge_create", {
          p_league_id: LG.id, p_club: userTeam().name, p_opponent: opp.name,
          p_pitch: m.querySelector("#fo-chal-p").value || "balanced",
          p_weather: m.querySelector("#fo-chal-w").value || "Sunny", p_play_at: t.toISOString()
        }).then(function (newId) {
          m.remove();
          toast("Challenge sent to " + opp.name + " for " + t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " + pad(t.getHours()) + ":" + pad(t.getMinutes()) + (foTzAbbr() ? " " + foTzAbbr() : "") + ". You'll hear their answer in the bell.");
          // best effort: attach my current saved lineup right away, so the
          // match has a real XI even if I never come back to it
          try { if (App.orders && App.orders.saved && newId) rpc("challenge_set_orders", { p_id: newId, p_club: userTeam().name, p_orders: App.orders }).catch(function () {}); } catch (eAt) {}
        }).catch(function (e) {
            var s = ((e && e.message) || e) + "";
            if (/Could not find the function/i.test(s)) say("Challenges need the 0017 SQL run in Supabase (ask your commissioner).");
            else say(e);
          });
      });
    }).catch(function () { foMatchSetup(ix); });
  }
  function foChallenge(ix, pitch, weather) {
    try {
      try { M = null; } catch (_) {}                       // drop any stale match
      App.tossState = null;
      var me = userTeam();
      App.pending = { oppIx: ix, home: me.name, away: GD.teams[ix].name, ground: me.ground, pitch: pitch || me.homePitch || groundPitch(me.ground), weather: weather || "Sunny", seed: 4200 + ix, date: typeof simDate === "function" ? simDate() : "", comp: "friendly", __friendly: true };
      App.orders.saved = false;                             // must set + save a lineup before it plays
      say("vs " + GD.teams[ix].name + " · set your lineup, then Save to play.");
      location.hash = "#/orders"; if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }
  function foWireScout(page, ix) {
    page.querySelectorAll(".fo-stab").forEach(function (a) { a.addEventListener("click", function () { foScoutTab = a.getAttribute("data-tab"); page.__scoutSig = null; foRenderScout(); }); });
    page.querySelectorAll(".fo-sortby").forEach(function (a) { a.addEventListener("click", function () { foScoutSort = a.getAttribute("data-s"); page.__scoutSig = null; foRenderScout(); }); });
    var back = page.querySelector(".fo-scout-back"); if (back) back.addEventListener("click", function () { location.hash = "#/matches"; });
    var ch = page.querySelector(".fo-challenge"); if (ch) ch.addEventListener("click", function () { foChallengeSmart(ix); });
    page.querySelectorAll("tr.rowlink[data-sc]").forEach(function (tr) { tr.style.cursor = "pointer"; tr.addEventListener("click", function () { location.hash = "#/scorecard?i=" + tr.getAttribute("data-sc"); }); });
    page.querySelectorAll("tr.rowlink[data-fr]").forEach(function (tr) { tr.style.cursor = "pointer"; tr.addEventListener("click", function () { location.hash = "#/friendly?id=" + tr.getAttribute("data-fr"); }); });
  }
  function foRenderScout() {
    try {
      if (location.hash.indexOf("#/scout") !== 0) return;
      var m = /[?&]t=(\d+)/.exec(location.hash), ix = m ? +m[1] : foScoutIx;
      if (ix == null || typeof GD === "undefined" || !GD.teams || !GD.teams[ix]) return;
      foScoutIx = ix;
      var page = document.getElementById("page"); if (!page) return;
      var sig = "scout|" + ix + "|" + foScoutTab + "|" + foScoutSort;
      if (page.__scoutSig === sig && page.querySelector(".fo-scout")) return;   // unchanged
      page.__scoutSig = sig;
      page.innerHTML = foScoutHTML(ix);
      foWireScout(page, ix);
      try { if (window.__foLive) window.__foLive.mask(); } catch (eM) {}
    } catch (e) {}
  }
  // Recent league form per club (oldest→newest, last 5): W / L / T.
  function foFormMap() {
    var m = {};
    try {
      // the just-banked round stays under embargo until stumps: form must not
      // reveal a result before the broadcast reaches it
      var hideRd = null;
      try { var emF = (typeof foEmbargo === "function") ? foEmbargo() : null; if (emF && emF.active) hideRd = emF.round; } catch (e0) {}
      (App.results || []).forEach(function (r) {
        if (!r || r.comp !== "league" || !r.result) return;
        if (hideRd != null && r.round === hideRd) return;
        var w = r.result.winner;
        [r.home, r.away].forEach(function (nm) { (m[nm] = m[nm] || []).push(!w ? "T" : (w === nm ? "W" : "L")); });
      });
      for (var k in m) m[k] = m[k].slice(-5);
    } catch (e) {}
    return m;
  }
  // Trim the game page per preferences: hide Office academies, and make the
  // league-table club names clickable to open that club's scout report.
  // Mobile: any table wider than the screen scrolls in place instead of
  // being clipped. Idempotent · skips tables already wrapped.
  function foMobileTables() {
    try {
      var docW = document.documentElement.clientWidth;
      if (docW > 760) return;
      document.querySelectorAll("#page table").forEach(function (tb) {
        if (tb.closest(".fo-scrollx")) return;
        var r = tb.getBoundingClientRect();
        if (r.width <= docW - 8 && tb.scrollWidth <= tb.clientWidth + 4) return;
        var wrap = document.createElement("div");
        wrap.className = "fo-scrollx";
        tb.parentNode.insertBefore(wrap, tb);
        wrap.appendChild(tb);
      });
    } catch (e) {}
  }
  // Touch devices have no hover: tapping anything with a title tooltip
  // (skill labels, talent chips) shows it as a toast instead.
  document.addEventListener("click", function (ev) {
    try {
      if (!window.matchMedia || !matchMedia("(hover: none)").matches) return;
      var el = ev.target.closest("[title]");
      if (!el || !el.title) return;
      var tag = el.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "SELECT" || tag === "INPUT" || tag === "OPTION") return;
      // one tip at a time, pinned to the bottom so it never covers the nav
      var tip = document.getElementById("fo-taptip");
      if (!tip) { tip = document.createElement("div"); tip.id = "fo-taptip"; document.body.appendChild(tip); }
      tip.textContent = el.title.slice(0, 300);
      tip.classList.add("on");
      clearTimeout(tip.__t);
      tip.__t = setTimeout(function () { tip.classList.remove("on"); }, 2600);
    } catch (e) {}
  }, true);
  setInterval(function () { try { foFriendlyKeeper(); } catch (e) {} }, 5000);
  setTimeout(function () { foFriendlyKeeper.__ready = 1; try { foFriendlyKeeper(); } catch (e) {} }, 2500);
  var _foMobT;
  window.addEventListener("resize", function () { clearTimeout(_foMobT); _foMobT = setTimeout(foMobileTables, 150); });
  window.addEventListener("hashchange", function () { setTimeout(foMobileTables, 60); });

  function tidyPage() {
    try {
      var isFounder = !!(SYNC && SYNC.isFounder);
      document.querySelectorAll("#page .panel, #page .card").forEach(function (pn) {
        if (pn.classList && pn.classList.contains("fo-keep")) return;
        var h = pn.querySelector("h4, .card-title"); if (!h) return;
        var t = h.textContent.trim().toLowerCase();
        var hide = t === "academies" || t.indexOf("academy") >= 0 || t.indexOf("training centre") >= 0 || t.indexOf("training center") >= 0 ||
          t.indexOf("founder league") >= 0 || t.indexOf("commissioner") >= 0 ||   // no longer needed in Office
          (t.indexOf("danger zone") >= 0 && !isFounder);                          // reset game is admin-only
        if (hide) pn.style.display = "none";
      });
      // remove the manual "Complete AI round" / "Sim whole round" sim controls
      document.querySelectorAll("#page button").forEach(function (b) {
        var bt = (b.textContent || "").trim();
        if (bt === "Complete AI round" || bt === "Sim whole round") b.style.display = "none";
      });
      document.querySelectorAll("#page .small").forEach(function (el) {
        if (/^Complete AI round only plays/.test((el.textContent || "").trim())) el.style.display = "none";
      });
      // League mode: "Prepare" only sets orders (matches auto-resolve), so relabel it.
      if (SYNC && SYNC.started) {
        document.querySelectorAll("#page button").forEach(function (b) {
          if (!/startLeagueMatch/.test(b.getAttribute("onclick") || "")) return;
          b.classList.add("fo-setr");
          if (!b.getAttribute("data-r") && App.season) b.setAttribute("data-r", App.season.round);
          if (!b.classList.contains("fo-setr-done")) b.textContent = "Set lineup";
        });
        foRefreshLineupButtons();
      }
      // the engine's placeholder competition name becomes the real league's name
      var lgName = (LG && LG.name) ? LG.name : "League";
      document.querySelectorAll("#page h4, #page td").forEach(function (el) {
        if ((el.textContent || "").indexOf("Chat Division 1") >= 0) {
          el.innerHTML = el.innerHTML.replace(/League table - Chat Division 1/g, "League table &middot; " + E(lgName))
                                     .replace(/One Day - Chat Division 1/g, "One Day &middot; " + E(lgName))
                                     .replace(/Chat Division 1/g, E(lgName));
        }
      });
      var fmap = foFormMap(), myName = "";
      try { if (typeof userTeam === "function") myName = userTeam().name; } catch (e) {}
      document.querySelectorAll("#page table").forEach(function (tb) {
        var clubIx = -1, ptsIx = -1;
        tb.querySelectorAll("th").forEach(function (th) { var t = th.textContent.trim().toLowerCase(); if (t === "club") clubIx = th.cellIndex; if (t === "pts") ptsIx = th.cellIndex; });
        if (clubIx < 0 || ptsIx < 0) return;                    // only the standings table
        if (tb.closest && tb.closest(".fo-ch")) return;         // premium Club renders its own standings
        tb.classList.add("fo-standings");
        var di = 0;
        tb.querySelectorAll("tr").forEach(function (tr) {
          if (tr.querySelector("th")) return;
          var cell = tr.children[clubIx]; if (!cell) return;
          var name = (cell.textContent || "").trim();
          if (!cell.dataset.foScout) {
            cell.dataset.foScout = "1"; cell.classList.add("fo-scoutname");
            cell.addEventListener("click", function () { scoutClub(cell.textContent || ""); });
          }
          if (di === 0) tr.classList.add("fo-lead");            // league leader
          if (myName && name.indexOf(myName) >= 0) tr.classList.add("fo-userrow");
          di++;
        });
      });
    } catch (e) {}
  }
  var MATCH_TIME = "9:00 AM ET";
  function decorateFixtureTimes() {
    try {
      // the engine dates rounds weekly (solo roots); this league is daily –
      // rewrite every printed round date anchored to TODAY's current round
      var dailyDate = function (roundIx) {
        return foDailyDate(roundIx, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      };
      document.querySelectorAll("#page td[colspan]").forEach(function (td) {
        var m = (td.textContent || "").match(/Round\s+(\d+)\s+·/);
        if (m) td.innerHTML = td.innerHTML.replace(/·\s*[^(<]*\d{4}/, "· " + dailyDate(+m[1] - 1) + " ");
      });
      document.querySelectorAll("#page h4").forEach(function (h) {
        var m = (h.textContent || "").match(/Round\s+(\d+)\s+of\s+\d+/);
        if (m) h.innerHTML = h.innerHTML.replace(/-\s*[^<]*\d{4}/, "- " + dailyDate(+m[1] - 1));
      });
      document.querySelectorAll("#page table").forEach(function (tb) {
        var dateIx = -1, ths = tb.querySelectorAll("th");
        ths.forEach(function (th) { if (dateIx < 0 && /^\s*date\s*$/i.test(th.textContent)) dateIx = th.cellIndex; });
        if (dateIx < 0) return;
        tb.querySelectorAll("tr").forEach(function (tr) {
          if (tr.querySelector("th")) return;                 // skip header rows
          var cell = tr.children[dateIx]; if (!cell) return;
          if (cell.querySelector(".fo-mtime")) return;        // already decorated
          if (cell.hasAttribute("colspan")) return;           // empty-state rows, not dates
          var txt = (cell.textContent || "").trim();
          if (!txt || !/\d/.test(txt) || /\d:\d/.test(txt)) return;   // needs a date, no time yet
          var s = document.createElement("div"); s.className = "fo-mtime"; s.textContent = MATCH_TIME;
          cell.appendChild(s);
        });
      });
    } catch (e) {}
  }
  // Orders page: a "Copy previous match orders" button so a manager can reuse the
  // batting order, captain, keeper and bowling plan from their last set lineup.
  function foPreviousOrders() {
    try {
      if (App.defaults && App.defaults.batOrder && App.defaults.batOrder.length) return App.defaults;
      if (SYNC && SYNC.plannedOrders) {
        var rounds = Object.keys(SYNC.plannedOrders).map(Number).sort(function (a, b) { return b - a; });
        for (var i = 0; i < rounds.length; i++) { var o = SYNC.plannedOrders[rounds[i]]; if (o && o.batOrder && o.batOrder.length) return o; }
      }
    } catch (e) {}
    return null;
  }
  function foApplyPrevOrders(prev) {
    try {
      App.orders.batOrder = (prev.batOrder || []).slice();
      App.orders.captain = prev.captain; App.orders.keeper = prev.keeper;
      if (prev.spells) App.orders.spells = JSON.parse(JSON.stringify(prev.spells));
      App.orders.grid = null; App.orders.saved = false;    // reseed the grid from the copied spells
      if (typeof pgOrders === "function") pgOrders();
    } catch (e) { say(e); }
  }
  // One number a manager can act on: how suited each player is to TODAY's
  // pitch and weather (form and fatigue included). Replaces raw stat-reading.
  function foTodayFit(p) {
    var pend = App.pending || {}, pitch = pend.pitch || "balanced", wx = String(pend.weather || "").toLowerCase();
    var k; try { k = (typeof S === "function") ? S(p) : (p.skills || {}); } catch (e) { k = p.skills || {}; }
    var bowler = p.bowlTypeFull && p.bowlTypeFull !== "none";
    var v;
    if (bowler) {
      v = 0.55 * (p.threat || 0) + 0.45 * (p.control || 0);
      var pace = foIsPace(p);
      if (pace && (pitch === "green" || pitch === "cracked" || /overcast|humid|misty/.test(wx))) v += 10;
      if (!pace && (pitch === "dry" || pitch === "slow")) v += 10;
      if (!pace && /dew/.test(wx)) v -= 6;
    } else {
      var spinW = (pitch === "dry" || pitch === "slow") ? 0.42 : 0.28;
      v = (0.70 - spinW) * (k.vsPace || 0) + spinW * (k.vsSpin || 0) + 0.15 * (k.temperament || 0) + 0.15 * (k.power || 0);
      if ((pitch === "green" || /overcast|humid/.test(wx)) && (k.vsPace || 0) > 60) v += 5;
    }
    v *= 0.90 + 0.033 * (p.formIx == null ? 3 : p.formIx);
    var fr = { "clinically dead": 0.70, shattered: 0.74, exhausted: 0.78, listless: 0.84, weary: 0.90, moderate: 0.95, satisfactory: 0.98 }[String(p.fatigue || "rested").toLowerCase()];
    if (fr) v *= fr;
    return Math.max(1, Math.min(99, Math.round(v)));
  }
  function foPoolToday() {
    try {
      if (location.hash.indexOf("#/orders") !== 0) return;
      var pool = null;
      document.querySelectorAll("#page .panel").forEach(function (pn) {
        var h = pn.querySelector("h4");
        if (h && /available players/i.test(h.textContent || "")) pool = pn.querySelector("table");
      });
      if (!pool) pool = document.querySelector("#page .pool-mini table");
      if (!pool) return;
      var t = userTeam(); if (!t) return;
      var head = pool.querySelector("tr");
      if (head && !head.querySelector(".fo-today-th")) {
        var th = document.createElement("th"); th.className = "n fo-today-th"; th.textContent = "Today";
        th.title = "Fit for this pitch, weather, form and freshness"; head.appendChild(th);
      }
      var rows = [].slice.call(pool.querySelectorAll("tr")).filter(function (r) { return !r.querySelector("th"); });
      rows.forEach(function (r) {
        var nm = (r.cells[0] && r.cells[0].textContent || "").trim();
        var p = (t.players || []).find(function (x) { return nm.indexOf(x.name) >= 0; });
        var v = p ? foTodayFit(p) : 0;
        var cell = r.querySelector(".fo-today-td");
        if (!cell) { cell = document.createElement("td"); cell.className = "n fo-today-td"; r.appendChild(cell); }
        cell.innerHTML = "<span class='fo-fit fo-fit-" + foSkTone(v) + "'>" + v + "</span>";
        r.dataset.foFit = v;
        var tired = p && /exhausted|shattered|clinically|listless/.test(String(p.fatigue || "").toLowerCase());
        r.style.opacity = tired ? ".55" : "";
      });
      rows.sort(function (a, b) { return (+b.dataset.foFit || 0) - (+a.dataset.foFit || 0); })
        .forEach(function (r) { r.parentNode.appendChild(r); });
      // tabs re-render the rows: decorate again after a click
      document.querySelectorAll("#page .player-pool-tabs button").forEach(function (b) {
        if (b.dataset.foT) return; b.dataset.foT = "1";
        b.addEventListener("click", function () { setTimeout(foPoolToday, 60); });
      });
    } catch (e) {}
  }
  // Nets are for YOUR players: both sides come from your own squad.
  function foNetsOwnTeam() {
    // Retired: the Match lab (pgNets override, end of file) owns the whole
    // nets page now, including defaults, presets and the skill cards.
  }
  // ---- Nets: the whole skill card of both players in the session ------------
  // The engine's nets page only names the matchup; managers want to SEE who
  // they put in the nets. Both pickers slide into a full player card - flag,
  // role, age, hand, bowling type, talents and the complete 7-skill read-out -
  // and the wall of condition selects becomes one labelled grid.
  function foNetsCss() {
    if (document.getElementById("fo-nets-css")) return;
    var st = document.createElement("style"); st.id = "fo-nets-css";
    st.textContent =
      "#fo-nets-cards{display:grid;grid-template-columns:1fr 34px 1fr;gap:12px;align-items:stretch;margin:6px 0 16px}" +
      ".fo-net-card{background:#FFFEFC;border:1px solid rgba(7,22,46,.11);border-radius:14px;padding:13px 15px;box-shadow:0 1px 3px rgba(7,22,46,.05)}" +
      ".fo-net-bat{border-top:3px solid #2b6b68}.fo-net-bowl{border-top:3px solid #C95532}" +
      ".fo-net-role{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:9px;color:#667085}" +
      ".fo-net-bat .fo-net-role{color:#2b6b68}.fo-net-bowl .fo-net-role{color:#a4552e}" +
      ".fo-net-slot select{width:100%;max-width:100%;padding:9px 11px;border:1px solid rgba(7,22,46,.16);border-radius:10px;background:#fcfaf5;font-weight:700;font-size:13.5px;margin-bottom:10px}" +
      ".fo-net-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}" +
      ".fo-net-flag{font-size:16px;line-height:1}" +
      ".fo-net-nm{font-weight:800;font-size:16.5px;color:#111827;text-decoration:none}" +
      ".fo-net-nm:hover{color:#2b6b68;text-decoration:underline}" +
      ".fo-net-meta{font-size:11.5px;color:#7a7566;margin:4px 0 8px}" +
      ".fo-net-tals{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 9px}" +
      ".fo-net-card .fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none;gap:4px}" +
      ".fo-net-card .fo-db{font-size:10.5px}" +
      ".fo-net-v{align-self:center;justify-self:center;width:30px;height:30px;border-radius:50%;background:#efece2;color:#667085;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}" +
      "#page.fo-nets .fo-net-ctl{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px 12px;align-items:end}" +
      ".fo-nc{display:flex;flex-direction:column;gap:4px;min-width:0}" +
      ".fo-nc label{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#9a9484}" +
      ".fo-nc select,.fo-nc input{width:100%;padding:8px 10px;border:1px solid rgba(7,22,46,.15);border-radius:9px;background:#FFFEFC;font-size:12.5px;box-sizing:border-box}" +
      "#page.fo-nets .fo-net-ctl button.primary{grid-column:1/-1;padding:12px 16px;border-radius:11px;font-weight:800;font-size:14px}" +
      "@media(max-width:760px){#fo-nets-cards{grid-template-columns:1fr}.fo-net-v{margin:-4px auto}}";
    document.head.appendChild(st);
  }
  function foNetsCardHtml(p, kind) {
    var role = kind === "bat" ? "Batter" : "Bowler";
    var head = "<div class='fo-net-role'>In the nets · " + role + "</div><div class='fo-net-slot' data-kind='" + kind + "'></div>";
    if (!p) return "<div class='fo-net-card fo-net-" + kind + "'>" + head + "<div class='small'>Pick a player.</div></div>";
    var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? (foFlag(p.nat) || "") : ""; } catch (e) {}
    var isB = p.bowlTypeFull ? p.bowlTypeFull !== "none" : !!p.bowlType;
    var bt = p.btLabel || (isB ? String(p.bowlTypeFull || p.bowlType) : "Does not bowl");
    var hand = (p.hand === "L" ? "Left-hand bat" : "Right-hand bat");
    var ttip = function (t) { try { return (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; } catch (e) { return ""; } };
    var tals = (p.talents || []).map(function (t) { return "<span class='fo-dc-tal' title='" + E(ttip(t)) + "'>" + E(foTalentName(t)) + "</span>"; }).join("");
    return "<div class='fo-net-card fo-net-" + kind + "'>" + head +
      "<div class='fo-net-head'>" + (flag ? "<span class='fo-net-flag'>" + flag + "</span>" : "") +
      "<a class='fo-net-nm' href='#/player?n=" + encodeURIComponent(p.name) + "'>" + E(p.name) + (p.keeper ? " &dagger;" : "") + "</a>" +
      "<span class='fo-rl'>" + foRoleShort(p) + "</span></div>" +
      "<div class='fo-net-meta'>Age " + (p.age || "?") + " · " + hand + " · " + E(bt) + ((p.expWord || p.exp) ? " · exp " + E(String(p.expWord || p.exp)) : "") + "</div>" +
      (tals ? "<div class='fo-net-tals'>" + tals + "</div>" : "") +
      foSkillBars(p) + "</div>";
  }
  function foNetsCards() {
    try {
      if (!/^#\/nets/.test(location.hash || "")) return;
      if (typeof netsState === "undefined" || typeof findPlayer !== "function") return;
      var page = document.getElementById("page"); if (!page) return;
      var firstPanel = page.querySelector(".panel"); if (!firstPanel) return;
      page.classList.add("fo-nets");
      foNetsCss();
      var batP = null, bowlP = null;
      try { batP = (findPlayer(netsState.bat || "") || {}).p || null; } catch (e) {}
      try { bowlP = (findPlayer(netsState.bowl || "") || {}).p || null; } catch (e) {}
      var key = (netsState.bat || "") + "|" + (netsState.bowl || "");
      var ex = document.getElementById("fo-nets-cards");
      if (ex && ex.getAttribute("data-key") === key) return;
      if (ex) ex.remove();
      var wrap = document.createElement("div");
      wrap.id = "fo-nets-cards"; wrap.setAttribute("data-key", key);
      wrap.innerHTML = foNetsCardHtml(batP, "bat") + "<div class='fo-net-v'>v</div>" + foNetsCardHtml(bowlP, "bowl");
      page.insertBefore(wrap, firstPanel);
      // the engine's own player pickers slide into the cards, alive and wired
      page.querySelectorAll(".ctlrow select").forEach(function (s) {
        var oc = s.getAttribute("onchange") || "";
        var kind = /netsState\.bat=this\.value/.test(oc) ? "bat" : (/netsState\.bowl=this\.value/.test(oc) ? "bowl" : null);
        if (!kind) return;
        var row = s.closest(".ctlrow");
        var slot = wrap.querySelector(".fo-net-slot[data-kind='" + kind + "']");
        if (slot) slot.appendChild(s);
        if (row) row.style.display = "none";
      });
      // keep some mystery: the matchup meters stay, the exact per-ball odds go
      page.querySelectorAll(".panel h4").forEach(function (h) {
        if (!/Matchup strength/i.test(h.textContent || "")) return;
        h.textContent = "Matchup read - this exact situation";
        h.parentNode.querySelectorAll(".col.small").forEach(function (c) {
          if (/per-ball odds/i.test(c.textContent || "")) c.remove();
        });
      });
      // the conditions row: label every control, show renamed pitches
      page.querySelectorAll(".ctlrow").forEach(function (r) {
        if (r.getAttribute("data-fo-ctl") || r.textContent.indexOf("Balls:") < 0) return;
        r.setAttribute("data-fo-ctl", "1"); r.classList.add("fo-net-ctl");
        var kids = Array.prototype.slice.call(r.children);
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i];
          if (el.tagName !== "SPAN") continue;
          var ctrl = kids[i + 1];
          if (!ctrl || (ctrl.tagName !== "SELECT" && ctrl.tagName !== "INPUT")) continue;
          var box = document.createElement("div"); box.className = "fo-nc";
          r.insertBefore(box, el);
          var lab = document.createElement("label"); lab.textContent = el.textContent.replace(/:\s*$/, "");
          box.appendChild(lab); box.appendChild(ctrl); el.remove();
        }
        // the engine's decorateConditions has already title-cased the option
        // text (and with no value attr, the value: "Dry", "Two-Paced") - map
        // back to the real ids, then show our pitch names
        var pit = r.querySelector("select[onchange*='netsState.pitch']");
        if (pit) {
          var PMAP = { balanced: "balanced", flat: "flat", green: "green", dry: "dry", slow: "slow", cracked: "cracked", twopaced: "twoPaced" };
          var pNorm = function (v) { return PMAP[String(v == null ? "" : v).replace(/[^a-z]/gi, "").toLowerCase()] || null; };
          Array.prototype.forEach.call(pit.options, function (o) {
            var id = pNorm(o.value || o.textContent); if (!id) return;
            o.value = id; o.textContent = foPitchName(id);
          });
          var curId = pNorm(netsState.pitch);
          if (curId) { netsState.pitch = curId; pit.value = curId; }
        }
        var btn = r.querySelector("button.primary");
        if (btn) { btn.textContent = "Bowl the session"; r.appendChild(btn); }
      });
    } catch (e) {}
  }
  // ---- live friendlies run on the WALL CLOCK -------------------------------
  // A friendly plays at 10s a delivery whether the app is open or not. We
  // persist {seed, orders, toss, startAt}; on return we replay silently to
  // where the clock says the match should be. Come back after ~100 minutes
  // and it has finished: the result is in your friendly history.
  function foFrKey() { return "fol_livefr_v2"; }   // one live friendly per device
  function foFrHistKey() { return "fol_frhist_" + (LG ? LG.id : "solo"); }
  var FO_BALL_MS = 6000;   // 6s a ball: ~30 min an innings, an hour a match
  function foFrHist() { try { return JSON.parse(lsGet(foFrHistKey()) || "[]"); } catch (e) { return []; } }
  // compact scorecard (the same shape the resolver banks for challenge
  // friendlies) so a practice result stays viewable after league snapshots
  // replace App.results
  function foInnCard(inn) {
    if (!inn) return null;
    return {
      batTeam: inn.batTeam, bowlTeam: inn.bowlTeam,
      runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      overs: Math.floor(inn.legal / 6) + "." + (inn.legal % 6),
      extras: inn.extras,
      captBatName: inn.captBatName, captBowlName: inn.captBowlName,
      batting: (inn.bat || []).map(function (b) {
        return { name: b.p.name, r: b.r, b: b.b, f4: b.f4, f6: b.f6, out: b.out || "not out", sr: (b.b ? +(100 * b.r / b.b).toFixed(2) : 0) };
      }),
      bowling: Object.keys(inn.bowlers || {}).map(function (k) {
        var r = inn.bowlers[k];
        return { name: r.p.name, overs: Math.floor(r.b / 6) + "." + (r.b % 6), balls: r.b, r: r.r, w: r.w, mdn: r.mdn || 0, econ: (r.b ? +(r.r / (r.b / 6)).toFixed(2) : 0) };
      }),
      fow: inn.fow || null, pships: inn.pships || null
    };
  }
  function foSaveFrHist(m) {
    try {
      var i1 = m.innings[0], i2 = m.innings[1];
      var h = foFrHist();
      var savedIx = null;
      try { (App.results || []).forEach(function (r0) { if (r0.comp === "friendly" && r0.result && r0.result.text === ((m.result && m.result.text) || "")) savedIx = r0.ix; }); } catch (eSx) {}
      var card = null;
      try { card = { scorecard: (m.innings || []).map(foInnCard), worm: m.worm || null }; } catch (eC) {}
      h.unshift({
        at: m.__at || Date.now(), opp: (m.meta && m.meta.away) || "", ground: (m.meta && m.meta.ground) || "",
        pitch: (m.meta && m.meta.pitch) || "", wx: (m.meta && m.meta.weather) || "", ix: savedIx,
        txt: (m.result && m.result.text) || "", mom: (m.result && m.result.mom) || "",
        card: card,
        s1: i1 ? i1.batTeam + " " + i1.runs + "/" + i1.wkts : "", s2: i2 ? i2.batTeam + " " + i2.runs + "/" + i2.wkts : ""
      });
      lsSet(foFrHistKey(), JSON.stringify(h.slice(0, 20)));
    } catch (e) {}
  }
  // Rebuild the stored friendly deterministically to where the wall clock says
  // it should be. Same seed, same orders, same toss -> the identical match.
  // NEVER navigates (the Live Match tab is always in the nav while it runs) and
  // NEVER wipes the stored state on a transient error.
  function foFrResume(st) {
    var target = Math.floor((Date.now() - st.startAt) / FO_BALL_MS);
    if (target < 1) target = 1;
    App.orders = st.orders; App.orders.saved = true;
    App.orders.tossCall = (st.toss && st.toss.call) || "H";
    App.orders.tossDecision = (st.toss && st.toss.decision) || "bat";
    App.pending = st.pending;
    var prevPage = App.page; App.page = "__resolve__";
    try {
      try { M = null; } catch (e) {}
      if (typeof startPendingIfNeeded === "function") startPendingIfNeeded();
      if (App.tossState && App.tossState.stage !== "done" && typeof resolveToss === "function") resolveToss(App.orders.tossCall || "H");
      var guard = 0;
      while (M && !M.done && (M.log || []).length < target && guard++ < 3000) {
        if (typeof autoPick === "function") autoPick();      // handles innings breaks
        if (typeof stepBall === "function") stepBall(); else break;
      }
    } finally {
      // a throw mid-replay must never leave App.page at "__resolve__" - that
      // freezes every renderMatch for the rest of the session
      App.page = prevPage;
    }
    if (M && M.done) {
      M.__foArchived = 1; foSaveFrHist(M); lsSet(foFrKey(), "");
      toast("Full time in your friendly: " + ((M.result && M.result.text) || "match complete") + " · the scorecard is in Live Match, and it's saved under Friendlies on the Matches page.");
    } else if (M) {
      var ov = Math.floor(((M.innings[1] ? 300 : 0) + ((M.innings[M.innings[1] ? 1 : 0] || {}).legal || 0)) / 6);
      toast("Your friendly has moved with the clock · over " + ov + " live now. Watch it in Live Match.");
    }
    // repaint only if the user is already looking at the match page
    if (foHashPath() === "#/match" && typeof window.route === "function") window.route();
  }
  try {
    // (the started-innings toss guard now lives in the engine's applyToss)
  } catch (e) {}
  window.__foFrTest = { resume: function (st) { return foFrResume(st); }, keeper: function () { return foFriendlyKeeper(); } };
  function foFriendlyKeeper() {
    try {
      var live = (typeof M !== "undefined") && M && !M.done && M.meta && M.meta.__friendly;
      if (live) {
        var now = Date.now();
        var raw0 = lsGet(foFrKey()), st0 = null; try { st0 = JSON.parse(raw0 || "null"); } catch (e) {}
        // The wall clock is the truth. If this live match is far behind it -
        // e.g. a page reload made the engine restart the fixture from over 0 -
        // rebuild it deterministically from the stored state instead.
        if (st0 && st0.startAt && st0.pending && M.meta && st0.pending.seed === M.meta.seed) {
          var tgt0 = Math.floor((now - st0.startAt) / FO_BALL_MS);
          if ((M.log || []).length < tgt0 - 12 && (!foFriendlyKeeper._rz || now - foFriendlyKeeper._rz > 30000)) {
            foFriendlyKeeper._rz = now;
            try { foFrResume(st0); } catch (e) {}
            return;
          }
        }
        var startAt = (st0 && st0.startAt) || (now - (M.log || []).length * FO_BALL_MS);
        if (!foFriendlyKeeper._t || now - foFriendlyKeeper._t > 4000) {
          foFriendlyKeeper._t = now;
          var tossCall = (App.tossState && App.tossState.call) || App.orders.tossCall || "H";
          var userBatFirst = M.batFirstTeam === (M.user && M.user.name);
          lsSet(foFrKey(), JSON.stringify({
            pending: M.meta, orders: App.orders, startAt: startAt,
            toss: { call: tossCall, decision: App.orders.tossDecision || (userBatFirst ? "bat" : "bowl") }
          }));
        }
        return;
      }
      if (typeof M !== "undefined" && M && M.done && M.meta && M.meta.__friendly) {
        if (!M.__foArchived) { M.__foArchived = 1; foSaveFrHist(M); }
        lsSet(foFrKey(), "");
        return;
      }
      // nothing live: if a friendly is stored, move it to where the clock says
      // (but let the engine finish booting first - its late autosave restore
      // used to fight the rebuilt match)
      if (!foFriendlyKeeper.__ready) return;
      if (!foFriendlyKeeper.__synced) {
        var raw = lsGet(foFrKey()); if (!raw) return;
        var st = null; try { st = JSON.parse(raw); } catch (e) {}
        if (!st || !st.pending || !st.orders || !st.startAt) { return; }
        if (typeof GD === "undefined" || !GD.teams || !GD.teams.length) return;
        foFriendlyKeeper.__synced = 1;
        try { foFrResume(st); } catch (e) {
          // a failed first resume must stay retryable (bounded), or the stored
          // friendly freezes at over 0 for the whole session
          if ((foFriendlyKeeper.__syncTries = (foFriendlyKeeper.__syncTries || 0) + 1) < 5) foFriendlyKeeper.__synced = 0;
          try { console.warn("friendly resume failed:", e && e.message); } catch (e2) {}
        }
      }
    } catch (e) {}
  }
  function foOrdersExtras() {
    try {
      if (location.hash.indexOf("#/orders") !== 0) { if (window.__foOrdT) { clearInterval(window.__foOrdT); window.__foOrdT = null; } return; }
      var page = document.getElementById("page"); if (!page) return;
      // heat advisory: in draining weather a sixth bowling option is worth
      // real overs (the old auto-pick/status bar is gone - the rebuilt page
      // carries its own actions, and Save states show on the buttons)
      var wxRaw = (App.pending && App.pending.weather) || "";
      var drain = (window.FO_WX_DRAIN || {})[String(wxRaw).toLowerCase()];
      if (!drain || page.querySelector(".fo-heat-note")) return;
      var dPct = Math.round((drain - 1) * 100);
      var who = "";
      try {
        var t0 = userTeam();
        var pc = function (p, asB) { return Math.round((drain - 1) * foJobLoad(p, asB) * 100); };
        var bs = (t0.players || []).filter(function (p) { return p.bowlType; }).map(function (p) { return pc(p, true); });
        var xs = (t0.players || []).map(function (p) { return pc(p, false); });
        var rng = function (a) { var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a); return lo === hi ? lo + "%" : lo + "&ndash;" + hi + "%"; };
        if (bs.length && xs.length) who = " Your bowlers tire <b>" + rng(bs) + "</b> faster (genuine pace and low stamina feel it most), your batters <b>" + rng(xs) + "</b>.";
      } catch (e) {}
      var note = document.createElement("div"); note.className = "fo-heat-note fo-keep";
      note.innerHTML = "<b>" + E(String(wxRaw)) + " forecast: fatigue runs faster today.</b>" + who + " Bowlers fade late in spells and heavy workloads carry into the next fixture" +
        (dPct >= 30 ? ". Keep spells short: a sixth bowling option earns his keep, and batting depth pays." : ". Keep an eye on your frontline bowlers' overs.");
      var anchor = page.querySelector(".fo-ord-cond") || page.querySelector(".crumb");
      if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(note, anchor.nextSibling);
      else page.insertBefore(note, page.firstChild);
    } catch (e) {}
  }
  // Tag #page while a live match is on screen, so the mobile reorder CSS applies
  // only there (and never touches the desktop layout).
  // Opponent player pages: a rival's players are scoutable, but their skill bars
  // and skills-summary are hidden · only your own players reveal their skills.
  function foHidePlayerSkills() {
    try {
      if (foHashPath() !== "#/player") return;
      var page = document.getElementById("page"); if (!page) return;
      var m = /[?&]n=([^&]+)/.exec(location.hash); if (!m) return;
      var name = decodeURIComponent(m[1]);
      var mine = false;
      try {
        var me = userTeam();
        var chk = function (nm) { return !!nm && (me.players || []).concat(me.youth || []).some(function (p) { return p.name === nm; }); };
        // the page may have resolved a link with baggage ("Name 4w", "Name †")
        // to the real player - judge ownership by the resolved name too
        mine = chk(name) || chk(window.__foPlayerN);
      } catch (e) {}
      if (mine) return;                                     // own player · show everything
      page.querySelectorAll(".panel").forEach(function (pn) {
        var h = pn.querySelector("h4"); if (!h) return;
        var t = h.textContent.trim().toLowerCase();
        if (t === "skills" || t === "skills summary") pn.style.display = "none";
      });
    } catch (e) {}
  }
  function foHashPath() { return (location.hash || "").split("?")[0]; }   // "#/match" not "#/matches"
  // The engine's renderMatch() writes straight into #page with no page guard,
  // and its autoplay guard tests indexOf('#/match') - which also matches
  // #/matches and #/matchday - so a running match repainted itself over other
  // pages on every tick. Guard the renderer and fix the autoplay path test.
  try {
    // (the away-from-match render guard is the first line of the engine's
    // renderMatch now)
    if (typeof window.foEnsureAutoplay === "function") {
      window.foEnsureAutoplay = function () {
        if (window.__ap || typeof M === "undefined" || !M || M.done) return;
        window.__ap = setInterval(function () {
          var onMatch = (location.hash || "").split("?")[0] === "#/match";
          if (typeof M === "undefined" || !M || M.done || !onMatch) {
            clearInterval(window.__ap); window.__ap = null;
            if (typeof M !== "undefined" && M && M.done && onMatch && typeof window.renderMatch === "function") window.renderMatch();
            return;
          }
          if (typeof doBall === "function") doBall();
        }, UI.apMs || 1600);
      };
    }
  } catch (e) {}
  // Match ratings: the engine scores Fielding/Keeping unconditionally (a flat
  // baseline plus events), so a team that has only BATTED showed a fielding
  // rating. No fielding until you have actually fielded.
  try {
    if (typeof window.teamRatings === "function" && !window.teamRatings.__fo) {
      var _foTR = window.teamRatings;
      window.teamRatings = function (r, teamName) {
        var out = _foTR.apply(this, arguments);
        try {
          var fielded = (r.innings || []).some(function (inn) { return inn && inn.bowlTeam === teamName && (inn.legal || 0) > 0; });
          if (!fielded && out && out["Fielding/Keeping"]) out["Fielding/Keeping"] = [null, null];
        } catch (e) {}
        return out;
      };
      window.teamRatings.__fo = 1;
    }
  } catch (e) {}
  // Some log lines already carry the "Bowler to Striker :" prefix that the
  // renderer prepends again - strip the duplicate before any feed renders.
  try {
    if (typeof window.ftpCommHTML === "function" && !window.ftpCommHTML.__fo) {
      var _ftpC = window.ftpCommHTML;
      window.ftpCommHTML = function (log, filter, limit) {
        var clean = (log || []).map(function (L) {
          try {
            if (L && L.bowlerNm && L.strikerNm && L.txt) {
              var pre = String(L.bowlerNm).split(" ").slice(-1)[0] + " to " + String(L.strikerNm).split(" ").slice(-1)[0] + " : ";
              if (L.txt.indexOf(pre) === 0) {
                var c = {}; for (var k in L) c[k] = L[k];
                c.txt = L.txt.slice(pre.length);
                return c;
              }
            }
          } catch (e) {}
          return L;
        });
        return _ftpC.call(this, clean, filter, limit);
      };
      window.ftpCommHTML.__fo = 1;
    }
  } catch (e) {}
  function foTagMatchPage() {
    try {
      var pg = document.getElementById("page"); if (!pg) return;
      var on = foHashPath() === "#/match" && !!document.querySelector(".mc-top");
      pg.classList.toggle("fo-matchpage", on);
      if (pg.parentElement) pg.parentElement.classList.toggle("fo-matchwide", on);
      if (on) {
        // broadcast pace: a LIVE match runs 6s a ball (about 30 min an innings,
        // an hour a match); replaying an already-played match runs twice as
        // fast (3s a ball, ~30 min). The speed control stays hidden.
        try {
          var __rep = false;
          try { __rep = !!(typeof M !== "undefined" && M && M.meta && (App.results || []).some(function (rr) { return rr.seed === M.meta.seed && rr.home === M.meta.home && rr.away === M.meta.away; })); } catch (e) {}
          // an interactive friendly (the tutorial warm-up, a challenge lineup)
          // is the manager's OWN match: they keep the speed select and the
          // turbo option. Broadcast pacing is for league viewing and replays.
          var __mine = false;
          try { __mine = !!(typeof M !== "undefined" && M && M.meta && ((!M.done && M.meta.comp === "friendly" && !__rep) || M.meta.__tut)); } catch (e) {}
          if (!__mine) {
            var __want = __rep ? 3000 : 6000;
            if (UI.apMs !== __want) {
              UI.apMs = __want;
              if (window.__ap) { clearInterval(window.__ap); window.__ap = null; if (typeof window.foEnsureAutoplay === "function") window.foEnsureAutoplay(); }
            }
            document.querySelectorAll("#page select[title='commentary speed']").forEach(function (s) {
              var row = s.previousElementSibling;
              if (row && /commentary speed/i.test(row.textContent || "")) row.style.display = "none";
              s.style.display = "none";
            });
          }
          if (typeof UI !== "undefined" && UI.matchTab === "Scorecard" && M && M.innings) {
            var mb = document.querySelector(".ftp-match-body");
            if (mb) foBowlOrderFix(mb, M.innings.filter(Boolean), M.log);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }
  // ---- match centre polish: conditions chips, chronological commentary, ------
  // ---- worm axes, bowlers in the order they actually bowled -------------------
  // The order bowlers came on, from the ball-by-ball log (array order survives
  // the jsonb round-trip through Supabase; OBJECT key order does not, which is
  // why league scorecards showed bowlers shuffled). Falls back to key order.
  function foBowlingOrder(inn, log, innIx) {
    var seen = {}, order = [];
    (log || []).slice().reverse().forEach(function (L) {
      if (!L || (L.inn || 0) !== innIx || !L.bowlerNm) return;
      if (!seen[L.bowlerNm]) { seen[L.bowlerNm] = 1; order.push(L.bowlerNm); }
    });
    if (order.length) return order;
    return inn && inn.bowlers ? Object.keys(inn.bowlers) : [];
  }
  function foBowlOrderFix(root, innsArr, log) {
    try {
      var tables = [];
      root.querySelectorAll("table").forEach(function (tb) {
        var th = tb.querySelector("th");
        if (th && /^Bowler/.test(th.textContent || "")) tables.push(tb);
      });
      tables.forEach(function (tb, i) {
        var inn = innsArr[i]; if (!inn || !inn.bowlers) return;
        var order = foBowlingOrder(inn, log, i);
        // the card abbreviates names ("D. van Dijk RF"), so match both forms
        var keys = order.map(function (nm) {
          var parts = String(nm).split(" ");
          return [nm, parts[0].charAt(0) + ". " + parts.slice(1).join(" ")];
        });
        var rows = Array.prototype.slice.call(tb.querySelectorAll("tr")).filter(function (r) { return r.querySelector("td"); });
        var pos = function (r) {
          var nm = (r.querySelector("td").textContent || "").trim();
          for (var k = 0; k < keys.length; k++) if (nm.indexOf(keys[k][0]) === 0 || nm.indexOf(keys[k][1]) === 0) return k;
          return 99;
        };
        // only touch the DOM when actually out of order - re-appending rows on
        // every pass moved the player links out from under clicks and taps
        var sorted = rows.slice().sort(function (a, b) { return pos(a) - pos(b); });
        var inOrder = rows.every(function (r, i) { return r === sorted[i]; });
        if (!inOrder) sorted.forEach(function (r) { r.parentNode.appendChild(r); });
      });
    } catch (e) {}
  }
  function foWorm2(worm, innings, target) {
    try {
      var all = (worm || []).filter(Boolean); if (!all.length) return null;
      var mx = (target || 0), mo = 50;
      all.forEach(function (w) { w.forEach(function (pt) { if (pt[1] > mx) mx = pt[1]; if (pt[0] > mo) mo = pt[0]; }); });
      mx += 12;
      var X = function (o) { return 42 + o / mo * 430; }, Y = function (r) { return 188 - r / mx * 160; };
      var grid = "";
      for (var o = 0; o <= mo; o += 10) grid += "<line x1='" + X(o).toFixed(1) + "' y1='188' x2='" + X(o).toFixed(1) + "' y2='24' stroke='#ece7da'/>" +
        "<text x='" + X(o).toFixed(1) + "' y='201' font-size='9.5' fill='#667085' text-anchor='middle'>" + o + "</text>";
      var step = mx > 260 ? 100 : 50;
      for (var rv = step; rv <= mx - 8; rv += step) grid += "<line x1='42' y1='" + Y(rv).toFixed(1) + "' x2='472' y2='" + Y(rv).toFixed(1) + "' stroke='#ece7da'/>";
      for (var rv2 = 0; rv2 <= mx - 8; rv2 += step) grid += "<text x='37' y='" + (Y(rv2) + 3).toFixed(1) + "' font-size='9.5' fill='#667085' text-anchor='end'>" + rv2 + "</text>";
      var line = function (w, col) {
        return "<polyline fill='none' stroke='" + col + "' stroke-width='2' points='" + w.map(function (pt) { return X(pt[0]).toFixed(1) + "," + Y(pt[1]).toFixed(1); }).join(" ") + "'/>" +
          w.filter(function (pt, i) { return i > 0 && (pt[2] || 0) > (w[i - 1][2] || 0); }).map(function (pt) { return "<circle cx='" + X(pt[0]).toFixed(1) + "' cy='" + Y(pt[1]).toFixed(1) + "' r='3' fill='#DC2626'/>"; }).join("");
      };
      var tgt = (target && target > 1) ? "<line x1='42' y1='" + Y(target).toFixed(1) + "' x2='472' y2='" + Y(target).toFixed(1) + "' stroke='#C95532' stroke-dasharray='4 3'/>" : "";
      return "<svg viewBox='0 0 500 218' style='max-width:100%;width:520px'>" + grid +
        "<line x1='42' y1='188' x2='472' y2='188' stroke='#9a9484'/><line x1='42' y1='24' x2='42' y2='188' stroke='#9a9484'/>" + tgt +
        (worm[0] ? line(worm[0], "#2d6a8f") : "") + (worm[1] ? line(worm[1], "#F59E0B") : "") +
        "<text x='257' y='215' font-size='10.5' fill='#6b7280' text-anchor='middle'>Overs</text>" +
        "<text x='12' y='106' font-size='10.5' fill='#6b7280' transform='rotate(-90 12 106)' text-anchor='middle'>Runs</text></svg>" +
        "<div class='small' style='margin-top:4px'><span style='color:#2d6a8f'>■</span> " + E(innings[0] ? innings[0].batTeam : "") + " &nbsp; <span style='color:#F59E0B'>■</span> " + E(innings[1] ? innings[1].batTeam : "") + " &nbsp; <span style='color:#DC2626'>●</span> wicket" + ((target && target > 1) ? " &nbsp; <span style='color:#C95532'>––– target</span>" : "") + "</div>";
    } catch (e) { return null; }
  }
  function foScorecardPolish() {
    try {
      if (!/^#\/scorecard/.test(location.hash || "")) return;
      var page = document.getElementById("page"); if (!page) return;
      var mIx = (location.hash || "").match(/[?&]i=(\d+)/);
      var rObj = null;
      if (mIx && App.results[+mIx[1]]) rObj = App.results[+mIx[1]];
      else if (typeof M !== "undefined" && M) rObj = { log: M.log, worm: M.worm, innings: M.innings, pitch: M.pitch, weather: M.meta && M.meta.weather, ground: M.meta && M.meta.ground };
      if (!rObj) return;
      var innings = (rObj.innings || []).filter(Boolean);
      // (2) the conditions deserve better than a grey afterthought
      var sub = page.querySelector(".navsub");
      if (sub && !sub.querySelector(".fo-cond-pill")) {
        var b0 = sub.querySelector("b"), toss = sub.querySelector(".fo-toss");
        var pieces = [];
        if (rObj.pitch) pieces.push("<span class='fo-cond-pill fo-cond-pitch'>" + E(foPitchName(rObj.pitch)) + " pitch</span>");
        if (rObj.weather) pieces.push("<span class='fo-cond-pill fo-cond-wx'>" + E(String(rObj.weather)) + "</span>");
        if (rObj.ground) pieces.push("<span class='fo-cond-pill fo-cond-gnd'>" + E(String(rObj.ground)) + "</span>");
        if (pieces.length) {
          var frag = document.createElement("div");
          if (b0) frag.appendChild(b0);
          var bar = document.createElement("div"); bar.className = "fo-cond-bar"; bar.innerHTML = pieces.join("");
          frag.appendChild(bar);
          if (toss) frag.appendChild(toss);
          sub.innerHTML = ""; while (frag.firstChild) sub.appendChild(frag.firstChild);
        }
      }
      var tab = App._scTab || "card";
      // (5) bowlers in the order they bowled, not by wickets
      if (tab === "card") foBowlOrderFix(page, innings, rObj.log);
      // (3) the whole match, first ball first, in a roomy feed
      if (tab === "comm") {
        var box = page.querySelector("#ftpcomm");
        if (box && !box.classList.contains("fo-comm-full") && rObj.log && typeof window.ftpCommHTML === "function") {
          box.classList.add("fo-comm-full");
          box.innerHTML = window.ftpCommHTML(rObj.log.slice().reverse(), "all", 100000);
        }
      }
      // (4) a worm with real axes
      if (tab === "worm") {
        page.querySelectorAll(".panel").forEach(function (pn) {
          var h = pn.querySelector("h4");
          if (!h || !/Worm/i.test(h.textContent) || pn.getAttribute("data-fo-worm")) return;
          var tgtR = (innings[1] && innings[0]) ? innings[0].runs + 1 : 0;
          var w2 = foWorm2(rObj.worm, innings, tgtR);
          if (w2) { pn.setAttribute("data-fo-worm", "1"); pn.querySelector(".pad").innerHTML = w2; }
        });
      }
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foScorecardPolish, 30); });

  // ---- Season planner: pre-set orders for every upcoming fixture ---------------
  // League packets are keyed by round, so a manager can set orders for any future
  // round now (or submit their current orders for the whole season at once). The
  // resolver picks up each round's packet when that round plays.
  function foUserFixtures() {
    var out = [];
    try {
      var S = App.season; if (!S || !S.schedule) return out;
      for (var r = S.round; r < S.schedule.length; r++) {
        var rd = S.schedule[r] || [];
        for (var i = 0; i < rd.length; i++) {
          var f = rd[i];
          if (f[0] !== App.teamIx && f[1] !== App.teamIx) continue;
          if (S.played[fixtureKey(r, f)] !== undefined) continue;
          out.push(foFixtureInfo(r, f));
        }
      }
    } catch (e) {}
    return out;
  }
  function foFixtureInfo(r, f) {
    var home = GD.teams[f[0]], away = GD.teams[f[1]], oppIx = f[0] === App.teamIx ? f[1] : f[0];
    var isHome = f[0] === App.teamIx;
    var pitch = home.name === userTeam().name ? (home.homePitch || groundPitch(home.ground)) : groundPitch(home.ground);
    var weather = WXLIST[(((r * 7 + f[0] * 3) % WXLIST.length) + WXLIST.length) % WXLIST.length];
    return { round: r, f: f, oppIx: oppIx, opp: GD.teams[oppIx], home: home, away: away, ground: home.ground, pitch: pitch, weather: weather, isHome: isHome, seed: 5000 + r * 10 + f[0], date: foDailyDate(r) };
  }
  function foFixtureMeta(r) {
    var S = App.season, rd = (S && S.schedule[r]) || [];
    for (var i = 0; i < rd.length; i++) { var f = rd[i]; if (f[0] === App.teamIx || f[1] === App.teamIx) { var x = foFixtureInfo(r, f); return { oppIx: x.oppIx, home: x.home.name, away: x.away.name, ground: x.ground, pitch: x.pitch, weather: x.weather, seed: x.seed, date: x.date, comp: "league", round: r }; } }
    return null;
  }
  function foPlannedKey() { return "fol_planned_" + ((LG && LG.id) || "solo"); }
  function foSavePlanned() {
    try { lsSet(foPlannedKey(), JSON.stringify(SYNC.plannedOrders || {})); } catch (e) {}
  }
  function foLoadPlanned() {
    try {
      var raw = lsGet(foPlannedKey()); if (!raw) return;
      var obj = JSON.parse(raw) || {};
      SYNC.plannedOrders = SYNC.plannedOrders || {};
      for (var k in obj) if (!SYNC.plannedOrders[k]) SYNC.plannedOrders[k] = obj[k];
    } catch (e) {}
  }
  // A lineup upload is only "in" when the server CONFIRMS it. Failures are
  // recorded, surfaced once, and retried by the sync poll until they land -
  // a phone losing signal for a moment must never silently cost a lineup.
  function foPushRound(r, orders) {
    if (!(LG && SYNC)) return;
    var clone = JSON.parse(JSON.stringify(orders)); clone.saved = true;
    var sig = JSON.stringify(clone);
    SYNC.pushedSig = SYNC.pushedSig || {};
    if (SYNC.pushedSig[r] === sig) return;                 // confirmed on the server, unchanged
    SYNC.plannedOrders = SYNC.plannedOrders || {}; SYNC.plannedOrders[r] = clone;
    foSavePlanned();
    var pkt = { fo_packet: 1, teamIx: App.teamIx, club: (GD.teams[App.teamIx] || {}).name, round: r, manager: (SYNC.me && SYNC.me.display_name) || "manager", orders: clone };
    rpc("push_packet", { p_league_id: LG.id, p_round: r, p_packet: pkt }).then(function () {
      SYNC.pushedSig[r] = sig;                             // mark ONLY on success
      SYNC.submitted = SYNC.submitted || {}; SYNC.submitted[r] = true;
      SYNC.__pushInfo = "R" + (r + 1) + " confirmed " + new Date().toLocaleTimeString();
      try { foRefreshLineupButtons(); } catch (e) {}
    }).catch(function (e) {
      SYNC.__pushInfo = "R" + (r + 1) + " FAILED: " + String((e && e.message) || e).slice(0, 140);
      var now = Date.now();
      if (!SYNC.__pushToastAt || now - SYNC.__pushToastAt > 60000) {
        SYNC.__pushToastAt = now;
        toast("Couldn't upload your round " + (r + 1) + " lineup · I'll keep retrying in the background.");
      }
    });
  }
  // any planned round the server hasn't confirmed gets re-sent by the poll
  function foRetryPlanned() {
    try {
      if (!(LG && SYNC && SYNC.started)) return;
      var po = SYNC.plannedOrders || {};
      for (var k in po) {
        var r = +k;
        if (App.season && r < App.season.round) { delete po[k]; foSavePlanned(); continue; }
        if (!(SYNC.pushedSig && SYNC.pushedSig[r])) foPushRound(r, po[k]);
      }
    } catch (e) {}
  }
  function foFlushPlan() {
    try {
      if (!(LG && SYNC && SYNC.started && App.orders && App.orders.saved)) return;
      if (SYNC.planRound == null) return;
      foPushRound(SYNC.planRound, App.orders);
      toast("\u2713 Orders are in for Round " + (SYNC.planRound + 1) + " \u00b7 it plays " + foDailyDate(SYNC.planRound, { weekday: "short", day: "numeric", month: "short" }) + " at 9:00 AM ET.");
      // These orders belong to a FUTURE round. Un-save the working copy so the
      // current-round auto-push can't resubmit them for today's match - and so
      // a genuine current-round save later still pushes (the old signature
      // trick blocked identical lineups from ever uploading).
      try { App.orders.saved = false; } catch (e) {}
      foRenderPlanner();
    } catch (e) {}
  }
  function foSetOrdersForRound(r) {
    try {
      SYNC.planRound = (App.season && r === App.season.round) ? null : r;
      var meta = foFixtureMeta(r); if (meta) App.pending = meta;
      if (SYNC.plannedOrders && SYNC.plannedOrders[r]) App.orders = JSON.parse(JSON.stringify(SYNC.plannedOrders[r]));
      else App.orders.saved = false;                        // start from the current template
      location.hash = "#/orders"; if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }
  function foLoadSubmitted() {
    if (!(LG && SYNC) || SYNC.submittedLoading || SYNC.submittedLoaded) return;
    if (!SYNC.myMid) return;                     // identity not resolved yet - retry later
    SYNC.submittedLoading = true;
    sel("league_packets", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=round").then(function (a) {
      SYNC.submitted = SYNC.submitted || {};
      (a || []).forEach(function (row) { SYNC.submitted[row.round] = true; });
      SYNC.submittedLoaded = true; SYNC.__pktInfo = "loaded " + (a || []).length + " round(s)";
      SYNC.__plannerSig = null; foRefreshLineupButtons();
    }).catch(function (e) { SYNC.submittedLoading = false; SYNC.__pktInfo = "error: " + String((e && e.message) || e).slice(0, 160); });
  }
  // A lean per-fixture "Set lineup" list (no big season planner): each upcoming
  // fixture gets a button on the right that opens that round's orders.
  function foPlannerHTML(fx, limit) {
    var shown = limit ? fx.slice(0, limit) : fx;
    var frRows = (foFriendlies || []).map(function (fr, i) {
      return "<div class='fo-fx fo-fx-fr'>" +
        "<div class='fo-fx-main'><b>Friendly</b> vs " + E(fr.oppName) +
          "<div class='small fo-fx-sub'>" + E(foTitle(fr.pitch)) + " pitch · " + E(fr.weather) + " · practice</div></div>" +
        "<div class='fo-fx-act'><button class='fo-fr-play' data-i='" + i + "'>Play</button>" +
          "<button class='fo-fr-x' data-i='" + i + "' title='Remove'>✕</button></div>" +
        "</div>";
    }).join("");
    var rows = shown.map(function (x) {
      var done = SYNC.submitted && SYNC.submitted[x.round];
      return "<div class='fo-fx'>" +
        "<div class='fo-fx-main'><b>R" + (x.round + 1) + "</b> " + (x.isHome ? "vs " : "@ ") + E(x.opp.name) +
          "<div class='small fo-fx-sub'>" + x.date + " · 9:00 AM ET · " + E(x.ground) + " · " + E(x.pitch) + "/" + E(x.weather) + "</div></div>" +
        "<div class='fo-fx-act'>" + (done ? "<span class='fo-plan-ok'>✓ lineup set</span>" : "") +
          "<button class='fo-setr' data-r='" + x.round + "'>" + (done ? "Edit lineup" : "Set lineup") + "</button></div>" +
        "</div>";
    }).join("");
    var more = (limit && fx.length > limit) ? "<div class='small' style='margin-top:6px'><a href='#/matches'>See all " + fx.length + " fixtures →</a></div>" : "";
    return "<div class='panel fo-planner'><h4>Your upcoming matches</h4><div class='pad'>" +
      "<div class='small' style='margin-bottom:6px'>League matches play automatically at <b>9:00 AM ET</b> and lineups lock an hour before the start. Set a lineup ahead of time (blank ones auto-select), or play a friendly any time.</div>" +
      frRows + rows + more + "</div></div>";
  }
  function foWirePlanner(root) {
    root.querySelectorAll(".fo-setr").forEach(function (b) { if (b.__w) return; b.__w = 1; b.addEventListener("click", function () { foSetOrdersForRound(+b.getAttribute("data-r")); }); });
    root.querySelectorAll(".fo-fr-play").forEach(function (b) { if (b.__w) return; b.__w = 1; b.addEventListener("click", function () { var fr = foFriendlies[+b.getAttribute("data-i")]; if (fr) foPlayFriendly(fr); }); });
    root.querySelectorAll(".fo-fr-x").forEach(function (b) { if (b.__w) return; b.__w = 1; b.addEventListener("click", function () { foFriendlies.splice(+b.getAttribute("data-i"), 1); foFrSchedSave(); if (SYNC) SYNC.__plannerSig = null; foRenderPlanner(); }); });
  }
  function foRenderPlanner() {
    try {
      return;                                              // retired: the fixtures table now carries Set lineup buttons
      if (!(SYNC && SYNC.started) || SYNC.practice) return;
      if (App.page !== "matches") return;                  // the Club home renders its own fixtures
      var page = document.getElementById("page"); if (!page) return;
      if (!SYNC.submittedLoaded) foLoadSubmitted();
      var fx = foUserFixtures(), frs = foFriendlies || [];
      var existing = page.querySelector(".fo-planner");
      if (!fx.length && !frs.length) { if (existing) existing.remove(); return; }
      var limit = App.page === "club" ? 5 : 0;              // compact on the club home; full on Matches
      var sig = App.page + "|fr" + frs.map(function (f) { return f.oppName; }).join(",") + "|" + fx.map(function (x) { return x.round + (SYNC.submitted && SYNC.submitted[x.round] ? "y" : "n"); }).join(",");
      if (existing && SYNC.__plannerSig === sig) return;    // unchanged · leave the DOM alone (avoids observer loop)
      SYNC.__plannerSig = sig;
      var html = foPlannerHTML(fx, limit);
      if (existing) { existing.outerHTML = html; }
      else {
        var d = document.createElement("div"); d.innerHTML = html; var node = d.firstChild;
        // Insert high up (right after the hero/heading) so it's immediately visible,
        // not buried at the bottom of the page.
        var anchor = page.querySelector(".welcome-hero, .page-head");
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(node, anchor.nextSibling);
        else if (page.firstChild) page.insertBefore(node, page.firstChild.nextSibling);
        else page.appendChild(node);
      }
      foWirePlanner(page);
    } catch (e) {}
  }
  // ---- build identity + self-update ----------------------------------------
  // GitHub Pages caches each URL for ~10 minutes per CDN node and the browser
  // caches on top, so different loads can serve DIFFERENT builds. Every build
  // is stamped (build.sh replaces the placeholder) and version.json says what
  // is actually deployed; when they disagree, one tap reloads with a
  // cache-busting query that forces the CDN to hand over the new build.
  var FO_BUILD = "__FO_BUILD__";
  try { window.FO_BUILD = FO_BUILD; console.info("Fifty Overs build", FO_BUILD); } catch (e) {}
  function foBase() {
    return location.pathname.replace(/client\/game\.html.*$/, "").replace(/index\.html.*$/, "");
  }
  function foCheckUpdate() {
    try {
      if (/^file:/.test(location.protocol) || FO_BUILD.indexOf("__") === 0) return;
      fetch(foBase() + "version.json?t=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (v) {
        if (!v || !v.build || v.build === FO_BUILD) return;
        if (foCheckUpdate._seen === v.build) return;
        foCheckUpdate._seen = v.build;
        var live = false; try { live = (typeof M !== "undefined") && M && !M.done; } catch (e) {}
        var el = document.createElement("div");
        el.id = "fo-update-pill";
        el.innerHTML = "A new version is ready &middot; <b>tap to update</b>" + (live ? " (your live match resumes at the right over)" : "");
        el.addEventListener("click", function () {
          location.replace(location.pathname + "?v=" + encodeURIComponent(v.build) + location.hash);
        });
        var old = document.getElementById("fo-update-pill"); if (old) old.remove();
        document.body.appendChild(el);
      }).catch(function () {});
    } catch (e) {}
  }
  setTimeout(foCheckUpdate, 8000);
  setInterval(foCheckUpdate, 240000);
  function tickClock() {
    try {
      var c = document.getElementById("fo-clock"); if (!c) return;
      var d = new Date();
      c.textContent = d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) + " " +
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (!c.title) c.title = "Build " + FO_BUILD;
    } catch (e) {}
  }
  setInterval(tickClock, 1000);
  // The game's ↩ "return to match" icon appears for any pending fixture, which lets
  // a match start with a default lineup. Show it ONLY while a match is truly live.
  setInterval(function () {
    try {
      var box = document.getElementById("fo-live-icons"); if (!box) return;
      var live = (typeof M !== "undefined" && M && !M.done);
      box.style.display = live ? "" : "none";
    } catch (e) {}
  }, 300);
  // re-apply fixture match-times after any re-render of the game page
  try {
    var _mt = null, pg0 = document.getElementById("page");
    // The page MutationObserver is retired. The same sweep now runs:
    //   - synchronously after every navigation (foAfterRoute below)
    //   - debounced after every match render (foMatchRenderHooks)
    //   - on a slow safety-net interval for any async DOM writer
    window.foDecorateSweep = function () { foRenderScout(); foFlagStandings(); foCondSymbols(); foBowlOrderSort(); foBowlTypeTags(); foFranchiseBadges(); foStatsClubTags(); foMatchSimControls(); decorateFixtureTimes(); tidyPage(); try { foFriendliesPanel(); } catch (eFr) {} setTimeout(foLinkifyNames, 320); setTimeout(foLinkifyNames, 1000); foMobileTables(); foOfficeExtras(); foFixWIFlags(); foNetsOwnTeam(); foFriendlyKeeper(); foTagMatchPage(); foRenderPlanner(); foOrdersExtras(); foHidePlayerSkills(); foScorecardPolish(); foRoundBands(); foRefreshLineupButtons(); foCareerPanel(); foHideWeekChip(); };
    var _sw = null;
    window.foSweepSoon = function () { clearTimeout(_sw); _sw = setTimeout(window.foDecorateSweep, 40); };
    foMatchRenderHooks.push(window.foSweepSoon);
    setInterval(window.foSweepSoon, 1500);
  } catch (e) {}
  // first-class post-route decoration (core route() calls this in a finally)
  window.foAfterRoute = function () { bumpBrand(); ensureNav(); try { foUniqueNames(); } catch (e) {} foRenderTraining(); foRenderMarket(); foRenderManual(); foRenderMatchday(); foPolishSquad(); foDecorateMatchRows(); foFlagStandings(); foCondSymbols(); foBowlOrderSort(); foBowlTypeTags(); foFranchiseBadges(); foStatsClubTags(); foMatchSimControls(); foRenderScout(); decorateFixtureTimes(); tidyPage(); try { foFriendliesPanel(); } catch (eFr) {} setTimeout(foLinkifyNames, 320); setTimeout(foLinkifyNames, 1000); foTagMatchPage(); foRenderPlanner(); foOrdersExtras(); foHidePlayerSkills(); foScorecardPolish(); foRoundBands(); foRefreshLineupButtons(); try { foRenderSettings(); } catch (e) {} try { foRenderMuseum(); foCareerPanel(); } catch (e) {} try { window.foDecorateSweep(); } catch (e) {} };
  window.addEventListener("hashchange", function () { setTimeout(foRenderScout, 0); });
  window.addEventListener("hashchange", bumpBrand);
  ensureNav();

  // League fixtures resolve in the background at 09:00 New York · the manager only
  // sets orders (which auto-upload as a packet). So the interactive match viewer is
  // never used for a league game: clicking Matches (or saving orders) must land on
  // the fixtures list, not the live viewer. #/match stays reachable for Practice
  // Games and replays (those set no `league` comp / create a live match M).
  function foLeaguePendingOnly() {
    try {
      var liveFriendly = (typeof M !== "undefined" && M && !M.done);
      // Practice mode is a private local season · its matches ARE played by hand.
      return SYNC && SYNC.started && !SYNC.practice && App && App.pending && App.pending.comp === "league" && !liveFriendly;
    } catch (e) { return false; }
  }
  // Never spin up the interactive match engine for a real league fixture · those
  // are resolved by the background resolver. (Practice matches play normally.)
  if (typeof window.startPendingIfNeeded === "function") {
    var _spin = window.startPendingIfNeeded;
    window.startPendingIfNeeded = function () {
      try { if (App && App.pending && App.pending.__chal) return; } catch (e) {}   // challenge friendlies play on the server, never locally
      // practice vs bots: bank the match and broadcast it ball by ball, the
      // same experience as friendlies and league matchdays
      try {
        if (!window.__foPracRun && App && App.pending && App.pending.__friendly && !App.pending.__tut && !App.pending.__circuit && !App.pending.__camp && !App.pending.__career && App.orders && App.orders.saved && !(typeof M !== "undefined" && M && !M.done)) {
          var cP = foPracBroadcast();
          if (cP && cP.id) {
            try { foFriendlies = (foFriendlies || []).filter(function (f) { return f.oppName !== cP.opponent_club; }); foFrSchedSave(); } catch (eSch) {}
            var goPrac = function (pid) {
              toast("The umpires are out - your practice match is LIVE.");
              location.hash = "#/friendly?id=" + pid;
              if (typeof window.route === "function") try { window.route(); } catch (eRt) {}
              setTimeout(foRenderFriendlyLive, 30);
            };
            if (SYNC && SYNC.started && !SYNC.practice && LG) {
              // record it like a friendly, so every device sees the broadcast
              rpc("practice_record", {
                p_league_id: LG.id, p_club: cP.challenger_club, p_opponent: cP.opponent_club,
                p_pitch: cP.pitch, p_weather: cP.weather, p_result: cP.result
              }).then(function (nid) {
                try {
                  lsSet(foPracBcKey(), "null");                       // the server copy wins
                  var at0 = +String(cP.id).slice(5);
                  var h2 = foFrHist().filter(function (e2) { return e2.at !== at0; });
                  lsSet(foFrHistKey(), JSON.stringify(h2));           // no duplicate row
                } catch (eDd) {}
                window.__foFrSig = null; window.__foFrFetchAt = 0;
                setTimeout(foBellPoll, 400);
                goPrac(nid);
              }).catch(function (eRpc) {
                var sR = ((eRpc && eRpc.message) || eRpc) + "";
                if (/Could not find the function/i.test(sR)) setTimeout(function () { toast("Heads up: run migration 0020 in Supabase so practice broadcasts show on every device."); }, 2500);
                goPrac(cP.id);                                          // this device only for now
              });
            } else goPrac(cP.id);
            return;
          }
        }
      } catch (e2) {}
      try { if (SYNC && SYNC.started && !SYNC.practice && App && App.pending && App.pending.comp === "league" && !(typeof M !== "undefined" && M && !M.done)) return; } catch (e) {}
      return _spin.apply(this, arguments);
    };
  }
  // The tutorial warm-up promises "nothing counts". The engine's saveMatch
  // still marks long-batting/bowling players tired, shifts form, files a
  // result row and appends career/fielding lines - the fatigue would poison
  // the golden card's suggested XI minutes later (pickXI docks tired
  // players), and the rest contradicts the promise on every player page.
  // Snapshot everything the warm-up would touch and put it all back.
  if (typeof window.saveMatch === "function") {
    var _fosm = window.saveMatch;
    window.saveMatch = function (m) {
      var tut = !!(m && m.meta && m.meta.__tut);
      var stash = null, scrub = null;
      if (tut) {
        try {
          stash = []; scrub = { res: (App.results || []).length, hist: {}, field: {} };
          ((typeof GD !== "undefined" && GD.teams) || []).forEach(function (t) {
            if (!t || (t.name !== m.meta.home && t.name !== m.meta.away)) return;
            (t.players || []).forEach(function (p) {
              stash.push([p, p.fatigue, p.formIx, p.formWord]);
              scrub.hist[p.name] = ((App.playerHist || {})[p.name] || []).length;
              var fs0 = (App.fieldStats || {})[p.name];
              scrub.field[p.name] = fs0 ? JSON.stringify(fs0) : null;
            });
          });
        } catch (e) { stash = null; scrub = null; }
      }
      var r = _fosm.apply(this, arguments);
      if (stash) {
        try { stash.forEach(function (s) { s[0].fatigue = s[1]; s[0].formIx = s[2]; s[0].formWord = s[3]; }); } catch (e) {}
      }
      if (scrub) {
        try {
          // drop the warm-up's result row, career lines and fielding tallies
          if (App.results && App.results.length > scrub.res) App.results.length = scrub.res;
          for (var nm9 in scrub.hist) {
            var h9 = (App.playerHist || {})[nm9];
            if (!h9) continue;
            if (scrub.hist[nm9] > 0) h9.length = scrub.hist[nm9];
            else delete App.playerHist[nm9];
          }
          for (var nf9 in scrub.field) {
            if (!App.fieldStats) break;
            if (scrub.field[nf9]) App.fieldStats[nf9] = JSON.parse(scrub.field[nf9]);
            else delete App.fieldStats[nf9];
          }
          // ...and put the manager's real plan back where the warm-up plan sat
          if (window.__foTutOrders) {
            var o9 = JSON.parse(window.__foTutOrders); window.__foTutOrders = null;
            if (App.orders) {
              App.orders.phaseIntent = o9.pi || { pp: 0, mid: 0, death: 1 };
              App.orders.fieldPlan = o9.fp || { pp: "att", mid: "bal", death: "def" };
              if (o9.bo) App.orders.batOrder = o9.bo;
              if (o9.sp) App.orders.spells = o9.sp;
              if (o9.cap !== undefined && o9.cap !== null) App.orders.captain = o9.cap;
              if (o9.kp !== undefined && o9.kp !== null) App.orders.keeper = o9.kp;
              if (o9.tc !== undefined) App.orders.tossCall = o9.tc;
              if (o9.td !== undefined) App.orders.tossDecision = o9.td;
            }
            App.defaults = o9.defaults || null;
          }
        } catch (e) {}
      }
      return r;
    };
  }
  function foOnHash() {
    try {
      // #/create: the quick-start flow, straight off the invite link. A manager
      // who already founded a club just lands on the club home.
      if ((location.hash || "").indexOf("#/create") === 0) {
        location.hash = "#/club"; foOnHash._last = "#/club";
        if (LG && SYNC && !lsGet("fo_onb_done") && !window.store("fo_onb_done")) {
          // The done-flags are device-local. A manager whose club already lives
          // on the server (second phone, cleared storage) must NOT re-onboard -
          // committing again would push a fresh squad over their real club. On
          // lookup failure do nothing: syncTick/preStart routes the truly
          // clubless into onboarding anyway.
          sel("league_clubs", "league_id=eq." + LG.id + "&manager_id=eq." + SYNC.myMid + "&select=manager_id").then(function (mine) {
            if (mine && mine.length) { try { window.store("fo_onb_done", "1"); } catch (e) {} return; }
            startDraft((SYNC && SYNC.myTeam) || {});
          }).catch(function () {});
        }
        return;
      }
      // Saving orders for a challenge friendly: attach the lineup to the
      // challenge and land back on Matches with a spelled-out confirmation.
      if (foHashPath() === "#/match" && App && App.pending && App.pending.__chal) {
        var chP = App.pending.__chal;
        App.pending = null;
        if (App.orders && App.orders.saved) foChalAttach(chP);
        location.hash = "#/matches"; foOnHash._last = "#/matches"; return;
      }
      // abandoned the challenge lineup: drop the fake fixture again
      if (foHashPath() !== "#/orders" && foHashPath() !== "#/match" && App && App.pending && App.pending.__chal) App.pending = null;
      // League games have no live viewer: bounce #/match back to the fixtures list.
      if (foHashPath() === "#/match" && foLeaguePendingOnly()) {
        if (App.orders && App.orders.saved) say("Orders are in · your match plays " + (typeof foDailyDate === "function" && App.season ? foDailyDate(App.season.round, { weekday: "short", day: "numeric", month: "short" }) : "") + " at 9:00 AM ET. Lineups lock an hour before the start.");
        location.hash = "#/matches"; foOnHash._last = "#/matches"; return;
      }
      // Saving league orders must never dump the manager into a running
      // friendly: the engine's "Save orders -> match" jump lands on #/match,
      // and the live-friendly exception above would let it through.
      if (foHashPath() === "#/match" && (foOnHash._last || "").indexOf("#/orders") === 0 &&
          SYNC && SYNC.started && !SYNC.practice && App && App.pending && App.pending.comp === "league") {
        toast("Orders are in · your league match plays " + (App.season ? foDailyDate(App.season.round, { weekday: "short", day: "numeric", month: "short" }) + " " : "") + "at 9:00 AM ET (lineups lock an hour before). Your friendly is under Live Match.");
        location.hash = "#/matches"; foOnHash._last = "#/matches"; return;
      }
      foOnHash._last = location.hash || "";
      // Leaving the Orders page while planning a future round → submit that round.
      if (location.hash.indexOf("#/orders") !== 0 && SYNC && SYNC.planRound != null) {
        foFlushPlan(); SYNC.planRound = null;
      }
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foOnHash, 0); });

  // Shared "50" logo mark (stumps + paper "5" + seamed cricket-ball "0"), reused
  // by the login logo and the browser-tab favicon so they stay identical.
  var MARK =
    '<g fill="#C95532">' +
    '<rect x="94" y="20" width="16" height="5" rx="2.5"/><rect x="114" y="20" width="16" height="5" rx="2.5"/><rect x="134" y="20" width="16" height="5" rx="2.5"/>' +
    '<rect x="97.5" y="24" width="9" height="40" rx="4.5"/><rect x="117.5" y="24" width="9" height="40" rx="4.5"/><rect x="137.5" y="24" width="9" height="40" rx="4.5"/>' +
    '</g>' +
    '<path d="M96 74 H44 V116 H78 a20 20 0 1 1 -20 20 H40" fill="none" stroke="#FFFEFC" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<g transform="translate(150,136)">' +
    '<circle r="42" fill="none" stroke="#FFFEFC" stroke-width="16"/>' +
    '<path d="M0 -34 Q10 0 0 34" fill="none" stroke="#FFFEFC" stroke-width="3"/>' +
    '<g stroke="#FFFEFC" stroke-width="2.4" stroke-linecap="round">' +
    '<path d="M-6 -24 L2 -22"/><path d="M-7 -12 L2 -11"/><path d="M-7 0 L3 0"/><path d="M-7 12 L2 11"/><path d="M-6 24 L2 22"/>' +
    '<path d="M8 -22 L14 -19"/><path d="M9 -11 L15 -9"/><path d="M9 0 L15 0"/><path d="M9 11 L15 9"/><path d="M8 22 L14 19"/>' +
    '</g></g>';

  // Brand the browser tab with the real designed app icon + apple-touch-icon.
  try {
    var favLink = document.querySelector("link[rel~='icon']") || document.createElement("link");
    favLink.rel = "icon"; favLink.type = "image/png"; favLink.href = FAVICON;
    document.head.appendChild(favLink);
    var apple = document.createElement("link"); apple.rel = "apple-touch-icon"; apple.href = APPICON;
    document.head.appendChild(apple);
    document.title = "Fifty Overs";
  } catch (e) { /* non-fatal */ }

  // The real designed app icon, for the in-app header.
  var ICON = '<img class="fol-hdicon" src="' + APPICON + '" alt="">';

  // The floating bottom-right button is gone; the app icon in the game's top bar
  // opens the league menu instead. Keep the element (hidden) so old refs are safe.
  var btn = document.createElement("button");
  btn.id = "folBtn"; btn.textContent = "League"; btn.style.display = "none";
  function openLeagueMenu() { openWrap(true); if (!JWT) renderWelcome(); else if (SYNC && LG) showWait(!!SYNC.myTeam); else enterApp(); }
  function doLogout() { JWT = ""; LG = null; SYNC = null; clearSession(); openWrap(true); renderLogin(); }

  var wrap = document.createElement("div");
  wrap.id = "folWrap";
  wrap.innerHTML =
    '<div id="folPanel">' +
    '<div class="folhd"><h3>' + ICON + 'Fifty Overs</h3><span class="folsmall" id="folWho"></span></div>' +
    '<div id="folPin"></div><div id="folMain"></div></div>';
  document.body.appendChild(wrap);
  var main = wrap.querySelector("#folMain");

  // Open/close the overlay. While it is on it covers the whole screen, so we lock
  // the page behind it: the public never touches the solo game underneath.
  function openWrap(on) {
    wrap.classList.toggle("on", !!on);
    document.documentElement.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }

  btn.addEventListener("click", openLeagueMenu);

  // ---- one delegated handler for everything ----
  wrap.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act]"); if (!t) return;
    var a = t.getAttribute("data-act");
    if (a === "close") { openWrap(false); return; }
    ev.preventDefault();
    var acts = {
      login: doLogin, logout: doLogout,
      showLogin: renderLogin, showJoin: renderJoin, showForgot: renderForgot,
      showWelcome: renderWelcome,
      soloStart: function () {
        var nmEl = wrap.querySelector("#folClubNm");
        foSoloBegin(nmEl ? nmEl.value : "");
      },
      soloContinue: function () { foSoloBegin(""); },
      sendReset: sendReset, joinNew: doJoinSignup,
      openId: function () { enterGameById(t.getAttribute("data-id")); }, join: joinLeague,
      startLeague: startLeague, mkInvite: mkInvite,
      relaunch: relaunchLeague, refound: foRefound,
      delTeam: function () { delTeam(t.getAttribute("data-id"), t.getAttribute("data-name")); },
      draftMine: draftMine, practice: practice,
      reload: function () { location.reload(); },
      backToGame: function () { openWrap(false); if (typeof window.route === "function") window.route(); }
    };
    if (acts[a]) acts[a]();
  });
  // Enter in any panel input triggers that screen's primary action.
  wrap.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter" || !ev.target || ev.target.tagName !== "INPUT") return;
    var primary = ["login", "joinNew", "sendReset", "join"].map(function (a) { return wrap.querySelector('[data-act="' + a + '"]'); }).filter(Boolean)[0];
    if (primary && !primary.disabled) { ev.preventDefault(); primary.click(); }
  });
  function val(id) { var e = wrap.querySelector("#" + id); return e ? (e.value || "").trim() : ""; }

  function setNavy(on) { var pn = wrap.querySelector("#folPanel"); if (pn) pn.classList.toggle("fol-navy", !!on); }

  // Never leave the panel blank: show progress while we talk to the server, and a
  // recoverable error card (instead of silence) when something goes wrong.
  function foLoading(msg) {
    setNavy(false);
    main.innerHTML = '<div class="folbody"><div class="folcard"><div class="folpad" style="text-align:center;padding:28px 12px"><div class="folsmall">' + E(msg || "Loading…") + "</div></div></div></div>";
  }
  function foFatal(msg) {
    openWrap(true); setNavy(false);
    main.innerHTML = '<div class="folbody"><div class="folcard"><h4>Something went wrong</h4><div class="folpad">' +
      '<div class="folsmall" style="line-height:1.5;margin-bottom:10px">' + E(msg) + "</div>" +
      '<button class="mini" data-act="reload">&#8635; Reload</button> <button class="mini" data-act="logout">log out</button>' +
      "</div></div></div>";
  }

  // ---- auth (Fifty Overs brand login) ----
  // The "50" mark: three terracotta stumps, a paper "5", and a seamed cricket ball for the "0".
  var LOGO = '<img class="fol-logo" src="' + APPICON + '" alt="Fifty Overs">';
  // The primary "50" mark, redrawn as inline SVG for the dark background:
  // terracotta stumps, paper "5", seamed-ball "0" (the brand PNGs are navy-on-paper
  // and megabytes big · vector keeps the single-file build small and crisp).
  var FOL_MARK =
    '<svg class="fol-mark" viewBox="0 0 224 170" fill="none" aria-hidden="true">' +
    '<g fill="#C95532"><rect x="88" y="6" width="9" height="30" rx="2.5"/><rect x="86" y="2" width="13" height="6" rx="2"/>' +
    '<rect x="107" y="6" width="9" height="30" rx="2.5"/><rect x="105" y="2" width="13" height="6" rx="2"/>' +
    '<rect x="126" y="6" width="9" height="30" rx="2.5"/><rect x="124" y="2" width="13" height="6" rx="2"/></g>' +
    '<path d="M104 50 H62 v34 h21 a27 27 0 1 1 -22 45" stroke="#FFFEFC" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="156" cy="113" r="45" stroke="#FFFEFC" stroke-width="11"/>' +
    '<path d="M149 76 c-7 24 -7 50 2 74" stroke="#FFFEFC" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="8 8" opacity=".9"/>' +
    '<path d="M164 76 c7 24 7 50 -2 74" stroke="#FFFEFC" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="8 8" opacity=".9"/>' +
    "</svg>";
  var ICON_JOIN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>';
  var FOOT =
    '<div class="fol-foot"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>' +
    "Secure access. Your club, your data.</div>";
  // Split auth shell: brand lockup on the left, the card on the right; on mobile
  // the brand pane collapses and the compact monogram tops the card instead.
  function folAuthShell(card) {
    return '<div class="fol-auth">' +
      '<div class="fol-brand">' + FOL_MARK +
      '<div class="fol-word">FIFTY <i>OVERS</i></div>' +
      '<div class="fol-tag"><b>&middot;</b>A living cricket world.<b>&middot;</b></div>' +
      '<div class="fol-feats">Found a club<b>&middot;</b>Play a career<b>&middot;</b>Bring your friends.</div>' +
      '<img class="fol-minilogo" src="' + APPICON + '" alt="">' +
      "</div>" +
      '<div class="fol-side"><div class="fol-card">' + LOGO + card + "</div></div></div>";
  }

  // ---- solo-first front door -------------------------------------------------
  // The career is the front door; leagues are the bonus built on the same
  // engine. Solo runs entirely locally — no account, no server.
  function foHasSoloSave() {
    try { return localStorage.getItem("fo_welcomed") === "1"; } catch (e) {}
    return false;
  }
  function foSoloBegin(name) {
    try {
      var nm = String(name || "").trim().slice(0, 26);
      try { window.store("fo_welcomed", "1"); window.store("fo_club", "0"); } catch (e0) {
        try { localStorage.setItem("fo_welcomed", "1"); localStorage.setItem("fo_club", "0"); } catch (e1) {}
      }
      if (nm && typeof GD !== "undefined" && GD.teams && GD.teams[0]) GD.teams[0].name = nm;
      try { if (typeof saveGame === "function") saveGame(false); } catch (e3) {}
      openWrap(false);
      location.hash = "#/circuit";
      if (typeof window.route === "function") window.route();
    } catch (e) { say(e); }
  }
  function renderWelcome() {
    wrap.querySelector("#folWho").textContent = "";
    setNavy(true);
    var has = foHasSoloSave() && !window.__folSoloForce;
    main.innerHTML = folAuthShell(
      "<h1>" + (has ? "Welcome back, boss" : "Your club is waiting") + "</h1>" +
      '<div class="fol-sub" style="display:flex;gap:10px;align-items:center;text-align:left">' +
      '<img src="' + FO_ART + 'gaffer.png" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover;object-position:50% 8%;flex:0 0 52px">' +
      "<span>&ldquo;" + (has ? "The Circuit doesn&rsquo;t wait and neither do I. Pick up where we left off."
        : "I&rsquo;m the Gaffer. Give the club a name and I&rsquo;ll walk you through the rest &mdash; squad, captain, first match. No account needed.") + "&rdquo;</span></div>" +
      '<div class="fol-form">' +
      (has ? '<button class="fol-cta" data-act="soloContinue">Continue playing ▸</button>'
           : '<div><label for="folClubNm">Club name</label><input id="folClubNm" type="text" maxlength="26" placeholder="e.g. Harbour Town CC"></div>' +
             '<button class="fol-cta" data-act="soloStart">Start playing ▸</button>') +
      "</div>" +
      '<div class="fol-or">or play with friends</div>' +
      '<div class="fol-links"><a data-act="showLogin">Sign in to a league</a><a data-act="showJoin">' + ICON_JOIN + "Join with invite code</a></div>" +
      FOOT);
  }
  function renderLogin() {
    wrap.querySelector("#folWho").textContent = "";
    setNavy(true);
    main.innerHTML = folAuthShell(
      "<h1>Welcome back</h1>" +
      '<div class="fol-sub">Sign in to manage your club.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folEmail">Email address</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<div><div class="fol-lrow"><label for="folPass">Password</label><a data-act="showForgot">Forgot password?</a></div>' +
      '<input id="folPass" type="password" autocomplete="current-password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"></div>' +
      '<button class="fol-cta" data-act="login">Log In</button>' +
      "</div>" +
      '<div class="fol-or">or</div>' +
      '<div class="fol-links"><a data-act="showWelcome">&#9666; Solo career</a><a data-act="showJoin">' + ICON_JOIN + "Join with invite code</a></div>" +
      FOOT);
  }

  // New manager: create an account and step straight into a league with an invite code.
  function renderJoin() {
    setNavy(true);
    main.innerHTML = folAuthShell(
      "<h1>Join your league</h1>" +
      '<div class="fol-sub">Create your account with the invite code from your commissioner.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folEmail">Email address</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<div><label for="folPass">Password</label><input id="folPass" type="password" autocomplete="new-password" placeholder="choose a password"></div>' +
      '<div><label for="folCode">Invite code</label><input id="folCode" placeholder="from your commissioner"></div>' +
      '<div><label for="folDn">Manager name</label><input id="folDn" placeholder="your name"></div>' +
      '<div><label for="folTn">Team name</label><input id="folTn" placeholder="your club"></div>' +
      '<button class="fol-cta" data-act="joinNew">Create account and join</button>' +
      "</div>" +
      '<div class="fol-links"><a class="fol-mut" data-act="showLogin">Back to log in</a></div>' +
      FOOT);
  }

  function renderForgot() {
    setNavy(true);
    main.innerHTML = folAuthShell(
      "<h1>Reset your password</h1>" +
      '<div class="fol-sub">We\'ll email you a reset link.</div>' +
      '<div class="fol-form">' +
      '<div><label for="folEmail">Email address</label><input id="folEmail" type="email" autocomplete="email" placeholder="you@club.com"></div>' +
      '<button class="fol-cta" data-act="sendReset">Send reset link</button>' +
      "</div>" +
      '<div class="fol-links"><a class="fol-mut" data-act="showLogin">Back to log in</a></div>' +
      FOOT);
  }

  function doLogin() {
    var email = val("folEmail"), password = wrap.querySelector("#folPass").value;
    if (!email || !password) { say("Enter your email and password"); return; }
    busyBtn("login", "Signing in…");
    fetch(URL + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "content-type": "application/json" }, body: JSON.stringify({ email: email, password: password }) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error_description || d.msg || d.error || ("HTTP " + r.status)); return d; }); })
      .then(function (d) {
        if (d.access_token) { JWT = d.access_token; saveSession(d); wrap.querySelector("#folWho").textContent = email; enterApp(); }
        else { unbusyBtn("login"); say("Check your email to confirm your account, then log in."); }
      }).catch(function (e) { unbusyBtn("login"); say(e); });
  }

  // After login, go straight into the league: RLS scopes `leagues` to the ones
  // you belong to, so no league id is ever needed. One league opens directly
  // (admin -> Admin, player -> Squad); several show a quick picker; none shows
  // the join-by-invite form.
  function enterApp() {
    foLoading("Signing you in…");
    return redeemPending().then(function () {
      return sel("leagues", "select=id,name,status,build_hash,draft_budget,season_no");
    }).then(function (ls) {
      if (!ls || !ls.length) { renderEnter(); return; }
      if (ls.length === 1) { return enterGame(ls[0]); }
      renderPicker(ls);
    }).catch(function () { renderEnter(); });
  }
  // If the user signed up with an invite code (and email confirmation was on, so
  // it could not be redeemed at signup), redeem it now that they are logged in.
  function redeemPending() {
    var raw = lsGet(PEND); if (!raw) return Promise.resolve();
    var p; try { p = JSON.parse(raw); } catch (e) { lsDel(PEND); return Promise.resolve(); }
    if (!p || !p.code) return Promise.resolve();   // no code left, but keep names for prefill
    return rpc("redeem_invite", { p_code: p.code, p_display_name: p.dn, p_team_name: p.tn || (p.dn + " XI") })
      .then(function () { lsDel(PEND); })
      .catch(function (e) {
        // Network hiccup (TypeError): keep everything so a flaky connection can't eat
        // a valid invite. Definitive rejection (already a member / spent code): drop
        // the dead code but keep the names so the join form can prefill them.
        if (!(e && e.name === "TypeError")) lsSet(PEND, JSON.stringify({ dn: p.dn, tn: p.tn }));
      });
  }
  function renderPicker(ls) {
    setNavy(false);
    wrap.querySelector("#folWho").textContent = "";
    main.innerHTML = '<div class="folbody"><div class="folcard"><h4>Your leagues</h4><div class="folpad" style="display:grid;gap:8px">' +
      ls.map(function (l) { return '<button class="p" style="text-align:left" data-act="openId" data-id="' + l.id + '">' + E(l.name) + "</button>"; }).join("") +
      '</div></div></div>';
  }
  function enterGameById(id) {
    return sel("leagues", "id=eq." + id + "&select=id,name,status,build_hash,draft_budget,season_no")
      .then(function (a) { if (a[0]) return enterGame(a[0]); });
  }

