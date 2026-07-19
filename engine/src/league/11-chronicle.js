  // =========================================================================
  // THE CLUB CHRONICLE. Nothing notable evaporates: every acquisition carries
  // its story, every innings is tagged to its season, milestones and earned
  // nicknames are written into a permanent career, batter-bowler duels
  // accumulate into nemesis records, seasons end in awards, and retired
  // players move into the club museum. One code path: the completeRound and
  // seasonEnd wrappers below run in solo play AND on the resolver's page.
  // =========================================================================
  try {
    var foChCss = document.createElement("style");
    foChCss.textContent =
      ".fo-sq-nickchip{display:inline-block;background:#F6E3B4;color:#7a5c13;border-radius:7px;padding:1px 7px;font-size:10.5px;font-weight:800;margin-left:6px;vertical-align:1px}" +
      ".fo-cp-prov{background:#F0F4F8;border:1px solid rgba(31,78,107,.16);border-radius:10px;padding:10px 13px;font-size:12.5px;color:#243244;margin-bottom:10px}" +
      ".fo-cp-ev{display:flex;gap:9px;align-items:baseline;font-size:12.5px;margin:4px 0;color:#3a4353}" +
      ".fo-cp-ev i{font-style:normal;flex:0 0 82px;color:#8a93a3;font-size:11px;font-weight:700;white-space:nowrap}" +
      ".fo-cp-fr td{color:#8a93a3}.fo-cp-fr td:first-child{font-style:italic}" +
      ".fo-cp-fld{font-size:12.5px;color:#3a4353}" +
      ".fo-fr-tag{display:inline-block;background:#E8EAEE;color:#5a6472;border-radius:6px;padding:0 6px;font-size:10px;font-weight:700;vertical-align:1px;white-space:nowrap}" +
      ".fo-cp-tabs{display:flex;gap:6px;margin:10px 0 2px}" +
      "html body #page a.fo-cp-tab{display:inline-block;border:1px solid rgba(28,36,51,.18);background:#FFFEFC;color:#0E233F !important;border-radius:999px;padding:4px 14px;font-size:12px;font-weight:800;cursor:pointer;text-decoration:none}" +
      "html body #page a.fo-cp-tab.on{background:#0E233F;color:#FFFEFC !important;border-color:#0E233F}" +
      ".fo-cp-scroll table{width:100%;font-size:11.5px}.fo-cp-scroll th,.fo-cp-scroll td{padding:6px 4px;white-space:nowrap}" +
      "@media(max-width:1000px){#page .fo-cp-x{display:none}}" +
      ".fo-mu-troph{display:flex;gap:10px;flex-wrap:wrap;margin:4px 0 10px}" +
      ".fo-mu-cup{background:linear-gradient(135deg,#F59E0B,#c08a2b);color:#fff;border-radius:10px;padding:8px 14px;font-weight:800;font-size:12.5px;box-shadow:0 3px 10px rgba(160,110,20,.3)}" +
      ".fo-mu-leg{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:11px;padding:11px 14px;margin:7px 0}" +
      ".fo-mu-leg b{font-size:14px;color:#0E233F}.fo-mu-leg .small{margin-top:2px}" +
      ".fo-ms-row{display:flex;gap:9px;align-items:baseline;font-size:12.5px;margin:5px 0;color:#3a4353}" +
      ".fo-ms-row b{color:#0E233F}.fo-ms-row i{font-style:normal;margin-left:auto;color:#C95532;font-weight:800;white-space:nowrap}" +
      ".fo-duel{display:flex;gap:8px;align-items:baseline;font-size:12.5px;margin:5px 0;color:#3a4353}" +
      ".fo-duel b{color:#0E233F}.fo-duel em{font-style:normal;margin-left:auto;font-weight:800;color:#8a2f1d;white-space:nowrap}" +
      ".fo-news-voice{color:#5b4a91;font-style:italic}" +
      "@media(max-width:640px){" +
      ".fo-ch-hero{padding:14px 16px}" +
      ".fo-ch-crest{width:54px;height:54px;min-width:54px}.fo-ch-crest img{width:54px;height:54px;border-radius:12px}" +
      ".fo-ch-name{font-size:23px;line-height:1.1}" +
      ".fo-ch-eyebrow{font-size:10px;margin-bottom:3px}" +
      ".fo-ch-chip{font-size:10.5px;padding:3px 8px}" +
      ".fo-ch-hero-r{margin-top:8px}.fo-hero-pill{font-size:11px;padding:5px 10px}" +
      ".fo-race{grid-template-columns:minmax(90px,1fr) minmax(70px,1.2fr) auto;gap:7px}" +
      ".fo-race-l b{font-size:11.5px}.fo-race-l span{font-size:10px}.fo-race-n{font-size:10.5px}}" +
      ".fo-race{display:grid;grid-template-columns:minmax(120px,1.1fr) minmax(90px,1.6fr) auto;gap:10px;align-items:center;margin:7px 0}" +
      ".fo-race-l b{display:block;font-size:12.5px;color:#0E233F;line-height:1.25}.fo-race-l span{font-size:11px;color:#8a93a3}" +
      ".fo-race-bar{height:10px;border-radius:5px;background:#E8EAEE;overflow:hidden}.fo-race-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#4DA6A2,#2b6b68);transition:width .6s ease}" +
      ".fo-race-n{font-size:11.5px;font-weight:800;color:#0E233F;white-space:nowrap;font-variant-numeric:tabular-nums}";
    document.head.appendChild(foChCss);
  } catch (e) {}

  // ---- weather that drains + who fatigue really bites (real, in-engine) ----
  // The per-ball fatigue increment multiplies by p._ageTire, a per-player
  // override the engine reads on every delivery but never sets. ballDist sees
  // each ball's batter, bowler and weather, so it is the one honest seam: we
  // recompute both players' tire rate before the engine rolls each ball.
  // Because raw fatigue itself accrues faster, the engine's own tired
  // warnings, fatigue bars and performance penalties stay in agreement.
  //
  // Where the numbers come from, so none of them are arbitrary:
  // - FO_WX_DRAIN (1.2 / 1.35 / 1.6): the published headline. It is exact for
  //   the reference player: a frontline bowler of league-average stamina.
  // - FO_JOB_R distributes that drain by the physical cost of the job.
  //   Time-motion studies of one-day cricket put a genuine quick's high-
  //   intensity load per delivery at roughly double a spinner's, with keeping
  //   sustained but light and batting the cheapest per ball faced. Stamina
  //   then scales the load around the league-average anchor (55), so fitness
  //   matters most for the players whose job costs the most, in the order
  //   fast > fast-medium > other bowlers > keepers > batters.
  // - On kind days the multiplier is exactly 1: vanilla engine behaviour,
  //   vanilla AI bowling rotation, vanilla calibration. The engine already
  //   prices stamina and role every ball ((1.85-st/100) x fast 1.08 / fm 1.04)
  //   in all weather; the overlay only decides who the WEATHER tax lands on.
  // - The captain's 1.06 in-match tax is interpolated from the engine's own
  //   role taxes (keeper 1.04, genuine fast 1.08): he sets the field, talks
  //   and carries the pressure on every ball. The engine already agrees
  //   captaincy is heavier work; it gives captains the keeper's stricter
  //   recovery thresholds (75/42 instead of 90/48).
  var FO_WX_DRAIN = { scorching: 1.6, hot: 1.35, humid: 1.2 };
  var FO_JOB_R = { fast: 1.25, fastMedium: 1.12, bowler: 1.0, keeper: 0.85, bat: 0.7 };
  window.FO_WX_DRAIN = FO_WX_DRAIN;
  function foStam(p) { return (p && p.skills && p.skills.stamina) || (p && p.stamina) || 50; }
  function foJobLoad(p, asBowler) {
    var R = asBowler
      ? (p.bowlType === "fast" ? FO_JOB_R.fast : p.bowlType === "fastMedium" ? FO_JOB_R.fastMedium : FO_JOB_R.bowler)
      : (p.keeper ? FO_JOB_R.keeper : FO_JOB_R.bat);
    return Math.max(0.35, R * (1 + (55 - foStam(p)) / 80));
  }
  function foTireMult(p, asBowler, wxF) {
    var m = 1 + ((wxF || 1) - 1) * foJobLoad(p, asBowler);
    try {
      var inn = (typeof M !== "undefined") && M && M.innings && M.innings[M.inns];
      if (inn && (asBowler ? inn.captBowlName : inn.captBatName) === p.name) m *= 1.06;
    } catch (e) {}
    return ((typeof foAgeTireFactor === "function") ? foAgeTireFactor(p) : 1) * m;
  }
  try {
    if (typeof window.ballDist === "function" && !window.ballDist.__foWx) {
      var _foBD = window.ballDist;
      window.ballDist = function (bat, bowl, ph, faced, intent, rrDef, pitch, field, over, ctx) {
        try {
          var f = (ctx && FO_WX_DRAIN[String(ctx.weather || "").toLowerCase()]) || 1;
          bat._ageTire = foTireMult(bat, false, f);
          bowl._ageTire = foTireMult(bowl, true, f);
        } catch (e) {}
        return _foBD.apply(this, arguments);
      };
      window.ballDist.__foWx = true;
    }
    // Heavy workloads in draining weather also carry into the NEXT matchday.
    // The engine's flat thresholds (90 balls batted / 48 bowled; 75/42 for
    // keepers and the captain) become EQUAL-FATIGUE thresholds:
    //   threshold = base x staminaScale / sqrt(playerDrain)
    // where staminaScale is the engine's own per-ball fatigue curve inverted
    // (1.35/(1.85-st/100) bowling, 1.25/(1.75-st/100) batting; exactly 1.0 at
    // stamina 50, clamped to [0.85, 1.35]) and playerDrain is the same
    // job-weighted drain the player actually experienced in the match.
    // Only runs in draining weather and only ever ADDS tiredness: it pulls
    // the flag forward for the unfit and the flogged, never erases the
    // engine's own verdict, and kind days stay 100% vanilla.
    if (typeof window.saveMatch === "function" && !window.saveMatch.__foWx) {
      var _foSmWx = window.saveMatch;
      var foThrM = function (p, asBowler) {
        var st = foStam(p);
        var v = asBowler ? 1.35 / (1.85 - st / 100) : 1.25 / (1.75 - st / 100);
        return Math.max(0.85, Math.min(1.35, v));
      };
      window.saveMatch = function (m) {
        var out = _foSmWx.apply(this, arguments);
        try {
          var f = (m && m.meta && FO_WX_DRAIN[String(m.meta.weather || "").toLowerCase()]) || 1;
          if (f > 1 && typeof findPlayer === "function") {
            var capt = (typeof App !== "undefined" && App.orders && App.orders.captain) || null;
            var thr = function (p, asBowler, base) {
              return base * foThrM(p, asBowler) / Math.sqrt(1 + (f - 1) * foJobLoad(p, asBowler));
            };
            for (var ii = 0; ii < (m.innings || []).length; ii++) {
              var inn = m.innings[ii]; if (!inn) continue;
              (inn.bat || []).forEach(function (b) {
                if (!b || !b.p) return;
                var pl = findPlayer(b.p.name); if (!pl || !pl.p) return;
                if (b.b >= thr(pl.p, false, (pl.p.keeper || b.p.name === capt) ? 75 : 90)) pl.p.fatigue = "tired";
              });
              for (var k in (inn.bowlers || {})) {
                var br = inn.bowlers[k]; if (!br) continue;
                var pl2 = findPlayer(k); if (!pl2 || !pl2.p) continue;
                if (br.b >= thr(pl2.p, true, (pl2.p.keeper || k === capt) ? 42 : 48)) pl2.p.fatigue = "tired";
              }
            }
          }
        } catch (e) {}
        return out;
      };
      window.saveMatch.__foWx = 1;
    }
  } catch (e) {}

  // ---- friendlies are for fun, not for the record books: every playerHist
  // entry a non-league match writes gets flagged and excluded everywhere ----
  try {
    if (typeof window.saveMatch === "function" && !window.saveMatch.__foChron) {
      var _foSm = window.saveMatch;
      window.saveMatch = function (m) {
        var league = !!(m && m.meta && m.meta.comp === "league");
        var pre = {};
        if (!league) { try { for (var k in (App.playerHist || {})) pre[k] = App.playerHist[k].length; } catch (e) {} }
        var out = _foSm.apply(this, arguments);
        if (!league) {
          try {
            for (var k2 in (App.playerHist || {})) {
              var h = App.playerHist[k2];
              for (var i = (pre[k2] || 0); i < h.length; i++) h[i].fr = 1;
            }
          } catch (e) {}
        }
        return out;
      };
      window.saveMatch.__foChron = 1;
    }
  } catch (e) {}

  // ---- career + totals helpers ----
  function foClubTotals(name) {
    var h = ((App.playerHist && App.playerHist[name]) || []).filter(function (e) { return !e.fr; }), runs = 0, wkts = 0, hs = 0, hsTxt = null, bw = 0, bwr = 1e9, bbTxt = null;
    h.forEach(function (e) {
      runs += +e.rr || 0; wkts += +e.w || 0;
      if ((+e.rr || 0) > hs) { hs = +e.rr; hsTxt = e.bat; }
      if ((+e.w || 0) > bw || ((+e.w || 0) === bw && (+e.w || 0) > 0 && (+e.cr || 0) < bwr)) { if ((+e.w || 0) > 0) { bw = +e.w; bwr = +e.cr || 0; bbTxt = bw + "/" + (e.cr || 0); } }
    });
    return { runs: runs, wkts: wkts, matches: h.length, hs: hs, hsTxt: hsTxt, bb: bbTxt };
  }
  function foCareerPush(p, ev) { (p._career = p._career || []).push(ev); if (p._career.length > 48) p._career.shift(); }
  function foDisplayName(p) { return p._nick ? p.name.split(" ")[0] + ' "' + p._nick + '" ' + p.name.split(" ").slice(1).join(" ") : p.name; }

  // ---- the chronicle pass around every completed round ----
  // repair: entries are supposed to be stamped (season, round) at round
  // time, but a failure mid-pass leaves league innings unstamped. The saved
  // results are the ground truth: an entry whose teams + date match a league
  // result IS a league innings (round recovered from the result); anything
  // else unstamped is a friendly. Also rescues league entries a previous
  // pass wrongly flagged as friendlies.
  // A snapshot can only contain results for rounds that have been played.
  // Clobber races during mid-season joins produced "results" for rounds the
  // season has not reached - dated a week in the future and poisoning
  // head-to-heads, recent results and player stats. Drop them on every
  // snapshot apply: a league result at or beyond the current round, or a
  // roundless league result dated in the future, is impossible.
  function foPurgeGhosts() {
    try {
      if (typeof App === "undefined" || !App || !App.season || !Array.isArray(App.results)) return;
      var cur = App.season.round;
      if (typeof cur !== "number" || cur < 0) return;
      var dropped = 0;
      App.results = App.results.filter(function (r) {
        if (!r) return true;
        // ghost rows from clobbered snapshots often arrive with their comp
        // field stripped - treat comp-less rows like league rows here
        if (r.comp !== "league" && r.comp != null) return true;
        if (typeof r.round === "number" && r.round >= cur) { dropped++; return false; }
        if (r.round == null || r.comp == null) {
          // can't validate by round: a date in the future is impossible for a
          // played result (legit league rows with fictional future dates all
          // carry comp === "league" AND a valid past round, kept above)
          if (typeof r.round === "number" && r.round < cur && r.comp === "league") return true;
          var tG = Date.parse(r.date || "");
          if (!isNaN(tG) && tG > Date.now() + 26 * 3600000) { dropped++; return false; }
        }
        return true;
      });
      if (dropped) {
        var sn = App.seasonNo || 1;
        Object.keys(App.playerHist || {}).forEach(function (nm) {
          App.playerHist[nm] = (App.playerHist[nm] || []).filter(function (e2) {
            return !(e2 && !e2.fr && e2.s === sn && (e2.r || 0) > cur);
          });
        });
        console.warn("Fifty Overs: dropped " + dropped + " impossible future-round result(s)");
      }
    } catch (e) {}
  }
  window.__foPurgeGhosts = foPurgeGhosts;                       // test hook
  setTimeout(function () { try { foPurgeGhosts(); } catch (e) {} }, 2500);   // the world loaded before the first sync
  function foHistRepair() {
    try {
      var byKey = {};
      (App.results || []).forEach(function (r) {
        if (!r || r.comp !== "league") return;
        byKey[r.home + " v " + r.away + "|" + (r.date || "")] = r;
      });
      var sN = App.seasonNo || 1;
      for (var k in (App.playerHist || {})) App.playerHist[k].forEach(function (e) {
        if (e.s != null) return;
        var r0 = byKey[(e.teams || "") + "|" + (e.date || "")];
        if (r0) { e.s = sN; e.r = (typeof r0.round === "number" ? r0.round + 1 : 1); delete e.fr; }
        else if (!e.fr) e.fr = 1;
      });
    } catch (e) {}
  }
  var foChronBackfill = foHistRepair;
  function foChroniclePre() {
    var pre = { round: (App.season && App.season.round) || 0, results: (App.results || []).length, seasonNo: App.seasonNo || 1, players: {} };
    try {
      GD.teams.forEach(function (t) {
        (t.players || []).forEach(function (p) {
          var h = ((App.playerHist && App.playerHist[p.name]) || []).filter(function (e) { return !e.fr; }), runs = 0, w = 0, hs = 0, bw = 0, bwr = 1e9;
          h.forEach(function (e) {
            runs += +e.rr || 0; w += +e.w || 0;
            if ((+e.rr || 0) > hs) hs = +e.rr;
            if ((+e.w || 0) > bw || ((+e.w || 0) === bw && (+e.w || 0) > 0 && (+e.cr || 0) < bwr)) { if (+e.w) { bw = +e.w; bwr = +e.cr || 0; } }
          });
          var fs = (App.fieldStats && App.fieldStats[p.name]) || {};
          pre.players[p.name] = { n: ((App.playerHist && App.playerHist[p.name]) || []).length, nl: h.length, runs: runs, wkts: w, hs: hs, bw: bw, bwr: bwr, dis: (fs.ct || 0) + (fs.st || 0) };
        });
      });
    } catch (e) {}
    return pre;
  }
  function foChroniclePost(pre) {
    try {
      var sN = pre.seasonNo, rN = pre.round + 1;
      // 1. duels: every dismissal credits bowler > batter on the bowling club
      try {
      (App.results || []).slice(pre.results).forEach(function (r) {
        if (r.comp && r.comp !== "league") return;   // friendlies settle nothing
        (r.innings || []).forEach(function (inn) {
          if (!inn || !inn.bat) return;
          var bt = GD.teams.find(function (t2) { return t2.name === inn.bowlTeam; });
          if (!bt) return;
          inn.bat.forEach(function (b) {
            if (!b || !b.out || !b.p) return;
            var s2 = String(b.out), bowler = null;
            var ix = s2.lastIndexOf(" b ");
            if (ix > 0) bowler = s2.slice(ix + 3).trim();
            else if (s2.indexOf("b ") === 0) bowler = s2.slice(2).trim();
            if (!bowler) return;
            var d = (bt._duels = bt._duels || {});
            var k = bowler + "|" + b.p.name;
            d[k] = (d[k] || 0) + 1;
          });
        });
      });
      GD.teams.forEach(function (t) { var d = t._duels; if (d) { var ks = Object.keys(d); if (ks.length > 300) { ks.sort(function (a, b2) { return d[a] - d[b2]; }).slice(0, ks.length - 300).forEach(function (k) { delete d[k]; }); } } });
      } catch (eDu) {}
      // 2. per player: tag new entries with season+round, write career events
      GD.teams.forEach(function (t) { try {
        var feed = [];
        (t.players || []).forEach(function (p) {
          var h = (App.playerHist && App.playerHist[p.name]) || [];
          var was = pre.players[p.name] || { n: 0, nl: 0, runs: 0, wkts: 0, hs: 0, bw: 0, bwr: 1e9, dis: 0 };
          var newE = h.slice(was.n).filter(function (e) { return !e.fr; });
          if (!newE.length) return;
          newE.forEach(function (e) { e.s = sN; e.r = rN; });
          if (!was.nl) { foCareerPush(p, { s: sN, r: rN, ev: "debut", txt: "Debut for " + t.name }); feed.push({ ev: "debut", name: p.name }); }
          // glovework milestones: every ten dismissals behind the stumps
          if (p.keeper) {
            var fsNow = (App.fieldStats && App.fieldStats[p.name]) || {};
            var disNow = (fsNow.ct || 0) + (fsNow.st || 0);
            if (disNow >= 10 && Math.floor(disNow / 10) > Math.floor((was.dis || 0) / 10)) {
              var dMile = Math.floor(disNow / 10) * 10;
              foCareerPush(p, { s: sN, r: rN, ev: "glove", txt: dMile + " dismissals behind the stumps" });
              feed.push({ ev: "glove", name: p.name, n: dMile });
            }
          }
          var runsCum = was.runs, wktsCum = was.wkts;
          newE.forEach(function (e) {
            var rr = +e.rr || 0, w = +e.w || 0;
            if (rr >= 100) {
              var maiden = !(p._career || []).some(function (c) { return c.ev === "century"; });
              foCareerPush(p, { s: sN, r: rN, ev: "century", txt: (maiden ? "Maiden century" : "Century") + " · " + (e.bat || rr) });
            } else if (rr >= 50 && !(p._career || []).some(function (c) { return c.ev === "fifty" || c.ev === "century"; })) {
              foCareerPush(p, { s: sN, r: rN, ev: "fifty", txt: "Maiden fifty · " + (e.bat || rr) });
            }
            if (w >= 5) {
              var m5 = !(p._career || []).some(function (c) { return c.ev === "fivefor"; });
              foCareerPush(p, { s: sN, r: rN, ev: "fivefor", txt: (m5 ? "Maiden five-for" : "Five-for") + " · " + w + "/" + (e.cr || 0) });
            }
            // personal bests, only once there is a past to beat
            if (was.n > 0 && rr > was.hs && rr >= 30 && rr < 50) foCareerPush(p, { s: sN, r: rN, ev: "hs", txt: "New highest score · " + (e.bat || rr) });
            if (was.n > 0 && rr > was.hs && rr >= 50) foCareerPush(p, { s: sN, r: rN, ev: "hs", txt: "New highest score · " + (e.bat || rr) });
            if (was.n > 0 && w >= 3 && (w > was.bw || (w === was.bw && (+e.cr || 0) < was.bwr))) foCareerPush(p, { s: sN, r: rN, ev: "bb", txt: "New best figures · " + w + "/" + (e.cr || 0) });
            if (rr > was.hs) was.hs = rr;
            if (w > was.bw || (w === was.bw && (+e.cr || 0) < was.bwr)) { if (w) { was.bw = w; was.bwr = +e.cr || 0; } }
            var r2 = runsCum + rr;
            if (r2 >= 500 && Math.floor(r2 / 500) > Math.floor(runsCum / 500)) {
              var mr = Math.floor(r2 / 500) * 500;
              foCareerPush(p, { s: sN, r: rN, ev: "runs", txt: mr.toLocaleString() + " club runs" });
              feed.push({ ev: "runs", name: p.name, n: mr });
            }
            runsCum = r2;
            var w2 = wktsCum + w;
            if (w2 >= 25 && Math.floor(w2 / 25) > Math.floor(wktsCum / 25)) {
              var mw = Math.floor(w2 / 25) * 25;
              foCareerPush(p, { s: sN, r: rN, ev: "wkts", txt: mw + " club wickets" });
              feed.push({ ev: "wkts", name: p.name, n: mw });
            }
            wktsCum = w2;
            // earned nicknames: first deed wins, for life
            if (!p._nick) {
              var econ = (+e.cb || 0) >= 54 ? (+e.cr || 0) / ((+e.cb) / 6) : null;
              // nicknames are rare honours: the deed has to be extraordinary
              var nick = rr >= 150 ? "Colossus"
                : (rr >= 110 && (+e.bb || 0) > 0 && rr / e.bb >= 1.4) ? "Cyclone"
                : ((+e.bb || 0) >= 95 && rr < 55) ? "The Wall"
                : (w >= 7) ? "Demolition"
                : (econ != null && econ < 2.6) ? "Padlock" : null;
              if (nick) {
                p._nick = nick;
                foCareerPush(p, { s: sN, r: rN, ev: "nick", txt: "Earned the nickname “" + nick + "”" });
                feed.push({ ev: "nick", name: p.name, nick: nick });
              }
            }
          });
        });
        if (feed.length) t._chron = { r: rN, s: sN, items: feed.slice(0, 6) };
        else if (t._chron && t._chron.r !== rN) delete t._chron;
      } catch (eTm) {} });
      // 3. awards night on the final matchday: club awards plus a full slate of
      // league-wide categories, every winner into his club's museum and career
      var total = (App.season && App.season.schedule && App.season.schedule.length) || 18;
      if (rN >= total) {
        var agg = [];
        GD.teams.forEach(function (t) {
          (t.players || []).forEach(function (p) {
            var h = (App.playerHist && App.playerHist[p.name]) || [];
            var a = { p: p, t: t, rr: 0, w: 0, balls: 0, outs: 0, cr: 0, cb: 0, inns: 0 };
            h.forEach(function (e) {
              if (e.s !== sN || e.fr) return;
              a.rr += +e.rr || 0; a.w += +e.w || 0; a.balls += +e.bb || 0;
              if (+e.bb > 0) a.inns++;
              if (e.o) a.outs++;
              a.cr += +e.cr || 0; a.cb += +e.cb || 0;
            });
            var fs = (App.fieldStats && App.fieldStats[p.name]) || { ct: 0, st: 0 };
            var base = (t._fsBase && t._fsBase[p.name]) || { ct: 0, st: 0 };
            a.ct = Math.max(0, (fs.ct || 0) - (base.ct || 0));
            a.st = Math.max(0, (fs.st || 0) - (base.st || 0));
            agg.push(a);
          });
        });
        var give = function (winner, kind, line) {
          if (!winner) return;
          var mus = (winner.t._museum = winner.t._museum || { trophies: [], awards: [], legends: [] });
          mus.awards.push({ s: sN, kind: kind, name: winner.p.name, line: line });
          foCareerPush(winner.p, { s: sN, r: rN, ev: "award", txt: kind + ", S" + sN });
          (winner.t._chronAwards = winner.t._chronAwards || { s: sN, list: [] }).list.push({ kind: kind, name: winner.p.name });
        };
        var top = function (score, filter) {
          var best = null, bv = null;
          agg.forEach(function (a) { if (filter && !filter(a)) return; var v = score(a); if (v == null) return; if (bv == null || v > bv) { bv = v; best = a; } });
          return best ? { a: best, v: bv } : null;
        };
        GD.teams.forEach(function (t) { delete t._chronAwards; });
        var r1 = top(function (a) { return a.rr > 0 ? a.rr : null; });
        if (r1) give(r1.a, "Most runs (league)", r1.v + " runs");
        var w1 = top(function (a) { return a.w > 0 ? a.w : null; });
        if (w1) give(w1.a, "Most wickets (league)", w1.v + " wickets");
        var ba = top(function (a) { return a.rr / a.outs; }, function (a) { return a.inns >= 6 && a.outs > 0; });
        if (ba) give(ba.a, "Best batting average (league)", ba.v.toFixed(1) + " over " + ba.a.inns + " innings");
        var sr = top(function (a) { return 100 * a.rr / a.balls; }, function (a) { return a.balls >= 120; });
        if (sr) give(sr.a, "Best strike rate (league)", sr.v.toFixed(0) + " SR");
        var bavg = top(function (a) { return -(a.cr / a.w); }, function (a) { return a.w >= 8; });
        if (bavg) give(bavg.a, "Best bowling average (league)", (-bavg.v).toFixed(1) + " per wicket");
        var ec = top(function (a) { return -(a.cr / (a.cb / 6)); }, function (a) { return a.cb >= 144; });
        if (ec) give(ec.a, "Best economy (league)", (-ec.v).toFixed(2) + " an over");
        var ct = top(function (a) { return !a.p.keeper && a.ct > 0 ? a.ct : null; });
        if (ct) give(ct.a, "Most catches (league)", ct.v + " catches");
        var kd = top(function (a) { return a.p.keeper && (a.ct + a.st) > 0 ? a.ct + a.st : null; });
        if (kd) give(kd.a, "Keeper dismissals (league)", (kd.v) + " dismissals");
        // club awards: your best, your kid
        GD.teams.forEach(function (t) {
          var best = null, bestV = 0, yBest = null, yBestV = 0;
          agg.forEach(function (a) {
            if (a.t !== t) return;
            var v = a.rr + 20 * a.w;
            if (v > bestV) { bestV = v; best = a; }
            if ((a.p.age || 30) <= 23 && v > yBestV) { yBestV = v; yBest = a; }
          });
          if (best) give({ p: best.p, t: t }, "Player of the Season", best.rr + " runs · " + best.w + " wkts");
          if (yBest && (!best || yBest.p !== best.p)) give({ p: yBest.p, t: t }, "Young Player of the Season", yBest.rr + " runs · " + yBest.w + " wkts");
        });
      }
    } catch (e) {}
  }
  try {
    if (typeof window.completeRound === "function" && !window.completeRound.__foChron) {
      var _foCr = window.completeRound;
      window.completeRound = function () {
        var pre = null;
        try { foChronBackfill(); pre = foChroniclePre(); } catch (e) {}
        var out = _foCr.apply(this, arguments);
        try { if (pre) foChroniclePost(pre); } catch (e) {}
        try { if (typeof window.saveGame === "function") window.saveGame(false); } catch (e) {}
        return out;
      };
      window.completeRound.__foChron = 1;
    }
  } catch (e) {}

  // ---- season's end: retirees become legends, the champion banks a trophy ----
  try {
    if (typeof window.seasonEnd === "function" && !window.seasonEnd.__foChron) {
      var _foSe = window.seasonEnd;
      window.seasonEnd = function () {
        var preR = null, rows0 = null, sN = App.seasonNo || 1;
        try {
          rows0 = (typeof leagueRows === "function") ? leagueRows() : [];
          preR = GD.teams.map(function (t) { return { t: t, roster: (t.players || []).map(function (p) { return { name: p.name, age: p.age, nick: p._nick || null }; }) }; });
        } catch (e) {}
        var out = _foSe.apply(this, arguments);
        try {
          if (preR) preR.forEach(function (pr) {
            var t = pr.t, now = {};
            (t.players || []).forEach(function (p) { now[p.name] = 1; });
            var gone = pr.roster.filter(function (x) { return !now[x.name]; });
            if (!gone.length) { delete t._chronFarewell; return; }
            var mus = (t._museum = t._museum || { trophies: [], awards: [], legends: [] });
            gone.forEach(function (x) {
              var tot = foClubTotals(x.name);
              mus.legends.push({ name: x.name, nick: x.nick, age: x.age, s: sN, runs: tot.runs, wkts: tot.wkts, matches: tot.matches, hs: tot.hsTxt || tot.hs, bb: tot.bb });
            });
            if (mus.legends.length > 40) mus.legends = mus.legends.slice(-40);
            t._chronFarewell = { s: sN, names: gone.map(function (x) { return x.nick ? x.name + " “" + x.nick + "”" : x.name; }) };
          });
          if (rows0 && rows0.length) {
            var champ = GD.teams.find(function (t) { return t.name === rows0[0].nm; });
            if (champ) {
              var mc = (champ._museum = champ._museum || { trophies: [], awards: [], legends: [] });
              mc.trophies.push({ s: sN, kind: "League champions" });
            }
            var second = rows0[1] && GD.teams.find(function (t) { return t.name === rows0[1].nm; });
            if (second) {
              var m2 = (second._museum = second._museum || { trophies: [], awards: [], legends: [] });
              m2.trophies.push({ s: sN, kind: "League runners-up" });
            }
          }
          // new season baseline for fielding stats, so next year's awards are honest
          GD.teams.forEach(function (t) {
            t._fsBase = {};
            (t.players || []).forEach(function (p) {
              var fs = (App.fieldStats && App.fieldStats[p.name]) || {};
              t._fsBase[p.name] = { ct: fs.ct || 0, st: fs.st || 0 };
            });
          });
        } catch (e) {}
        return out;
      };
      window.seasonEnd.__foChron = 1;
    }
  } catch (e) {}

  // ---- the dressing room speaks: one situational line per round, seeded ----
  var FO_VOICE = {
    hot: ["“Everything looks like a beach ball right now.”", "“I want the strike. Simple as that.”", "“Best I have felt in years, skipper.”", "“Don't change a thing about my role.”"],
    cold: ["was seen at the nets alone after dark.", "asked the coaches for extra throwdowns.", "has stopped reading The Post, teammates say.", "stayed behind long after training ended."],
    ducks: ["can't buy a run right now, and knows it.", "sat padded up for an hour after the collapse.", "asked the analyst for every ball of his dismissals."],
    settle: ["“Good dressing room, this. I want to repay the fee.”", "“The gaffer sold me the project. Time to deliver.”", "“New badge, same job: win matches.”"]
  };
  function foVoiceItem(t, rdHuman) {
    try {
      var sN = App.seasonNo || 1, cands = [];
      (t.players || []).forEach(function (p) {
        var h = (App.playerHist && App.playerHist[p.name]) || [];
        var recent = h.filter(function (e) { return e.s === sN && !e.fr; }).slice(-2);
        if (p._prov && p._prov.s === sN && p._prov.r === rdHuman) cands.push({ p: p, kind: "settle" });
        else if (recent.length >= 2 && recent.every(function (e) { return (+e.rr || 0) === 0 && e.o && (+e.bb || 0) > 0; })) cands.push({ p: p, kind: "ducks" });
        else if ((p.formIx || 3) >= 6) cands.push({ p: p, kind: "hot" });
        else if ((p.formIx || 3) <= 1) cands.push({ p: p, kind: "cold" });
      });
      if (!cands.length) return null;
      var pick = cands[foHash32("voice" + sN + "-" + rdHuman + "-" + t.name) % cands.length];
      var lines = FO_VOICE[pick.kind];
      var line = lines[foHash32(pick.p.name + rdHuman) % lines.length];
      var isQuote = line.charAt(0) === "“";
      return { pri: 3, h: "<span class='fo-news-voice'>DRESSING ROOM: " + E(foDisplayName(pick.p)) + (isQuote ? " · " + E(line) : " " + E(line)) + "</span>", s: "" };
    } catch (e) { return null; }
  }

  // ---- milestone races: progress bars managers can WATCH fill ----
  function foMilestoneWatch(t, max) {
    var rows = [];
    (t.players || []).forEach(function (p) {
      var tot = foClubTotals(p.name);
      if (!tot.matches) return;
      // every bar shows from ball one: watching it fill is the point
      if (tot.runs > 0) {
        var nextR = (Math.floor(tot.runs / 500) + 1) * 500;
        rows.push({ nm: p.name, label: nextR.toLocaleString() + " club runs", cur: tot.runs, target: nextR, pct: Math.round(100 * (tot.runs - (nextR - 500)) / 500) });
      }
      if (tot.wkts > 0) {
        var nextW = (Math.floor(tot.wkts / 25) + 1) * 25;
        rows.push({ nm: p.name, label: nextW + " club wickets", cur: tot.wkts, target: nextW, pct: Math.round(100 * (tot.wkts - (nextW - 25)) / 25) });
      }
      if (p.keeper) {
        var fs = (App.fieldStats && App.fieldStats[p.name]) || {};
        var dis = (fs.ct || 0) + (fs.st || 0);
        if (dis > 0) {
          var nextD = (Math.floor(dis / 10) + 1) * 10;
          rows.push({ nm: p.name, label: nextD + " keeper dismissals", cur: dis, target: nextD, pct: Math.round(100 * (dis - (nextD - 10)) / 10) });
        }
      }
      // the "N / target" column already carries the number - keep labels short
      if (tot.hs >= 60 && tot.hs < 100) rows.push({ nm: p.name, label: "maiden century", cur: tot.hs, target: 100, pct: Math.round(100 * tot.hs / 100) });
      else if (tot.hs >= 20 && tot.hs < 50) rows.push({ nm: p.name, label: "maiden fifty", cur: tot.hs, target: 50, pct: Math.round(100 * tot.hs / 50) });
    });
    rows.sort(function (a, b) { return b.pct - a.pct; });
    // one bar per player: his closest chase
    var seen = {}, outR = [];
    rows.forEach(function (r) { if (!seen[r.nm]) { seen[r.nm] = 1; outR.push(r); } });
    return outR.slice(0, max || 3);
  }
  function foRaceBar(r) {
    var hot = r.pct >= 90;
    return "<div class='fo-race'><div class='fo-race-l'><b>" + E(r.nm) + "</b><span>" + r.label + "</span></div>" +
      "<div class='fo-race-bar'><i style='width:" + Math.min(100, r.pct) + "%" + (hot ? ";background:linear-gradient(90deg,#F59E0B,#c08a2b)" : "") + "'></i></div>" +
      "<div class='fo-race-n'>" + r.cur.toLocaleString() + " / " + r.target.toLocaleString() + "</div></div>";
  }
  // league-wide season races for the Stats page: watch the leaders pull away
  function foSeasonRaces() {
    var sN = App.seasonNo || 1, list = [];
    GD.teams.forEach(function (t) {
      (t.players || []).forEach(function (p) {
        var h = (App.playerHist && App.playerHist[p.name]) || [], rr = 0, w = 0;
        h.forEach(function (e) { if (e.s === sN && !e.fr) { rr += +e.rr || 0; w += +e.w || 0; } });
        if (rr || w) list.push({ nm: p.name, club: t.name, rr: rr, w: w });
      });
    });
    var runs = list.slice().sort(function (a, b) { return b.rr - a.rr; }).slice(0, 5);
    var wkts = list.slice().sort(function (a, b) { return b.w - a.w; }).slice(0, 5);
    var mkRows = function (arr, key, unit) {
      if (!arr.length || !arr[0][key]) return "<div class='small'>The race starts with the first ball.</div>";
      var lead = arr[0][key];
      return arr.map(function (x) {
        return "<div class='fo-race'><div class='fo-race-l'><b>" + E(x.nm) + "</b><span>" + E(x.club) + "</span></div>" +
          "<div class='fo-race-bar'><i style='width:" + Math.max(3, Math.round(100 * x[key] / lead)) + "%'></i></div>" +
          "<div class='fo-race-n'>" + x[key].toLocaleString() + " " + unit + "</div></div>";
      }).join("");
    };
    return "<div class='grid2'><div class='col'><div class='panel fo-keep'><h4>The run race &middot; season " + sN + "</h4><div class='pad'>" + mkRows(runs, "rr", "runs") + "</div></div></div>" +
      "<div class='col'><div class='panel fo-keep'><h4>The wicket race &middot; season " + sN + "</h4><div class='pad'>" + mkRows(wkts, "w", "wkts") + "</div></div></div></div>";
  }
  // the Stats page carries the races and the club's milestone board
  try {
    if (typeof window.pgStats === "function" && !window.pgStats.__foChron) {
      var _foPgStats = window.pgStats;
      window.pgStats = function () {
        var out = _foPgStats.apply(this, arguments);
        try {
          var page = document.getElementById("page");
          var t = foMyClub();
          if (page && t) {
            var ms = foMilestoneWatch(t, 8);
            var msHtml = ms.length ? ms.map(foRaceBar).join("") : "<div class='small'>No one is in touching distance of a landmark yet.</div>";
            page.insertAdjacentHTML("afterbegin",
              foSeasonRaces() +
              "<div class='panel fo-keep'><h4>Milestone races &middot; " + E(t.name) + "</h4><div class='pad'>" + msHtml +
              "<div class='small' style='margin-top:6px'>Club-career landmarks. Gold bars are nearly there; the museum remembers every one reached.</div></div></div>");
          }
        } catch (e) {}
        return out;
      };
      window.pgStats.__foChron = 1;
    }
  } catch (e) {}

  // ---- career panel on your own players' pages ----
  function foCareerPanel() {
    try {
      if (!/^#\/player\?/.test(location.hash || "")) return;
      var m = /[?&]n=([^&]+)/.exec(location.hash); if (!m) return;
      var name = decodeURIComponent(m[1]);
      var page = document.getElementById("page"); if (!page) return;
      var ex = document.getElementById("fo-career");
      if (ex && ex.getAttribute("data-n") === name) return;
      if (ex) ex.remove();
      // careers are public record: every player in the league has one
      var pl0 = null; try { pl0 = findPlayer(name); } catch (eF) {}
      if (!pl0 || !pl0.p) return;
      var p = pl0.p;
      var t = foMyClub();
      var own = !!(t && (t.players || []).concat(t.youth || []).some(function (x) { return x.name === name; }));
      // Card-consistency: a hero strip with the player's artwork, the card's
      // 0-100 OVR and role label, plus the same fixes inside the info panel.
      try {
        var grid0 = page.querySelector(".fo-pl-grid") || page.querySelector(".grid2");
        if (grid0 && !page.querySelector(".fo-plh")) {
          var acH = FO_PK_AC[foPkKind(p)];
          var handH = p.hand === "L" ? "LHB" : "RHB";
          var btH = (p.btLabel && !/does not bowl/i.test(p.btLabel)) ? (" &middot; " + E(p.btLabel)) : "";
          var hero = document.createElement("div");
          hero.className = "fo-plh"; hero.style.cssText = "--tc:" + acH[0] + ";--tcD:" + acH[1];
          hero.innerHTML = "<div class='fo-plh-art'><img src='" + FO_ART + foPkArt(p) + "' alt=''></div>" +
            "<div class='fo-plh-id'><div class='fo-plh-role'>" + E(foPkRoleLbl(p)) + "</div>" +
            "<div class='fo-plh-name'>" + E(foDisplayName(p)) + "</div>" +
            "<div class='fo-plh-meta'>" + (foQsFlag(p.nat) || "") + " " + E(p.nat || "") + " &middot; age " + (p.age | 0) + " &middot; " + handH + btH + "</div></div>" +
            "<div class='fo-plh-ovr'><b>" + foPkOvr(p) + "</b><i>OVR</i></div>";
          grid0.parentNode.insertBefore(hero, grid0);
          // card consistency inside the Player info panel (all engine layouts)
          var topL = page.querySelector(".ftp-pinfo-top") || page.querySelector(".fo-pinfo-top");
          if (topL) topL.innerHTML = topL.innerHTML.replace(/<b[^>]*>\s*\d[\d,]*\s*<\/b>\s*rating/i, "<b>OVR " + foPkOvr(p) + "</b>");
          Array.prototype.forEach.call(page.querySelectorAll("#page .panel tr"), function (tr) {
            var tds = tr.querySelectorAll("td"); if (tds.length < 2) return;
            var lbl = (tds[0].textContent || "").trim();
            if (/^Rating$/i.test(lbl)) tds[1].innerHTML = "<b>OVR " + foPkOvr(p) + "</b>";
            else if (/^Role$/i.test(lbl)) tds[1].textContent = foPkRoleLbl(p);
          });
        }
      } catch (ePh) {}
      var prov = p._prov;
      var homeTxt = ""; try { homeTxt = " · born in " + foHometown(p); } catch (eH) {}
      var estD = ""; try { estD = foClubEst(pl0.team); } catch (eE) {}
      var signD = ""; try { signD = prov && prov.r ? foRoundDate(prov.s, prov.r) : estD; } catch (eS) {}
      var provTxt = !prov ? "Founding squad · signed " + estD
        : prov.how === "market" ? "Signed from the transfer market · " + signD + (own && prov.fee ? " · " + FO$(prov.fee) + " fee, beaten to by no one" : "")
        : prov.how === "youth" ? (own ? "Found by your scout" + (prov.nat ? " in " + prov.nat : "") + " · signed " + signD + " · your signing, your project" : "A youth-academy find" + (prov.nat ? " from " + prov.nat : "") + " · signed " + signD)
        : "Draft-day original · signed " + estD;
      provTxt += homeTxt;
      // league innings carry a season stamp; everything else (challenge
      // friendlies, practice games, pre-chronicle knocks) is the friendly
      // record and stays out of the league rows
      try { foHistRepair(); } catch (eHr) {}
      var hAll = ((App.playerHist && App.playerHist[name]) || []);
      var h = hAll.filter(function (e) { return !e.fr && e.s != null; });
      var frE = hAll.filter(function (e) { return e.fr || e.s == null; });
      // resolver-played friendlies never reach local history: synthesize
      // innings from the league's stored scorecards so the Friendly record
      // matches on every device (local practice games dedupe by teams+line)
      try {
        var clubN0 = pl0.team && pl0.team.name;
        var seenFk = {}; frE.forEach(function (e0) { seenFk[(e0.teams || "") + "|" + (e0.bat || "-")] = 1; });
        (foFrAllNow(null) || []).forEach(function (c) {
          if (!c || c.status !== "played" || !c.result || foFrBcastState(c).phase !== "done") return;
          if (c.challenger_club !== clubN0 && c.opponent_club !== clubN0) return;
          var batX = null, bowlX = null;
          (c.result.scorecard || []).forEach(function (inn) {
            if (!inn) return;
            (inn.batting || []).forEach(function (b2) { if (b2 && b2.name === name && (b2.b || b2.r || b2.out)) batX = b2; });
            (inn.bowling || []).forEach(function (b2) { if (b2 && b2.name === name && (b2.balls || b2.r || b2.w)) bowlX = b2; });
          });
          if (!batX && !bowlX) return;
          var teams3 = c.challenger_club + " v " + c.opponent_club;
          var bat3 = batX ? (batX.r || 0) + " (" + (batX.b || 0) + ")" : "-";
          if (seenFk[teams3 + "|" + bat3]) return;
          seenFk[teams3 + "|" + bat3] = 1;
          frE.push({ teams: teams3, bat: bat3, rr: batX ? +batX.r || 0 : 0, bb: batX ? +batX.b || 0 : 0,
            o: !!(batX && batX.out && batX.out !== "not out"), w: bowlX ? +bowlX.w || 0 : 0,
            cr: bowlX ? +bowlX.r || 0 : 0, cb: bowlX ? +bowlX.balls || 0 : 0,
            s4: batX ? +batX.f4 || 0 : 0, s6: batX ? +batX.f6 || 0 : 0, fr: 1 });
        });
      } catch (eFrX) {}
      var mkAgg = function () { return { mat: 0, inns: 0, runs: 0, hs: 0, bf: 0, s100: 0, s50: 0, f4: 0, f6: 0, outs: 0, wkts: 0, cr: 0, cb: 0, bw: 0, br: 1e9, w3: 0, w5: 0 }; };
      var feed1 = function (b, e) {
        var rr = +e.rr || 0, w = +e.w || 0, bb = +e.bb || 0, cr = +e.cr || 0, cb = +e.cb || 0;
        b.mat++;
        if (bb > 0 || rr > 0 || e.o) {
          b.inns++; b.outs += e.o ? 1 : 0; b.runs += rr; b.bf += bb;
          if (rr > b.hs) b.hs = rr;
          if (rr >= 100) b.s100++; else if (rr >= 50) b.s50++;
          b.f4 += +e.s4 || 0; b.f6 += +e.s6 || 0;
        }
        b.wkts += w; b.cr += cr; b.cb += cb;
        if (w >= 3) b.w3++;
        if (w >= 5) b.w5++;
        if (w > b.bw || (w === b.bw && w > 0 && cr < b.br)) { if (w) { b.bw = w; b.br = cr; } }
      };
      var batRow = function (lbl, b, cls) {
        var ave = b.outs ? (b.runs / b.outs).toFixed(1) : "–";
        var sr = b.bf ? (100 * b.runs / b.bf).toFixed(1) : "–";
        return "<tr" + (cls ? " class='" + cls + "'" : "") + "><td>" + lbl + "</td><td class='n'>" + b.inns + "</td><td class='n'>" + b.runs + "</td><td class='n'>" + (b.hs || "–") + "</td><td class='n'>" + ave + "</td><td class='n'>" + sr + "</td><td class='n fo-cp-x'>" + b.s100 + "</td><td class='n fo-cp-x'>" + b.s50 + "</td><td class='n fo-cp-x'>" + b.f4 + "</td><td class='n fo-cp-x'>" + b.f6 + "</td></tr>";
      };
      var bowlRow = function (lbl, b, cls) {
        var ave = b.wkts ? (b.cr / b.wkts).toFixed(1) : "–";
        var er = b.cb ? (b.cr / (b.cb / 6)).toFixed(2) : "–";
        var srB = b.wkts ? (b.cb / b.wkts).toFixed(1) : "–";
        return "<tr" + (cls ? " class='" + cls + "'" : "") + "><td>" + lbl + "</td><td class='n'>" + b.wkts + "</td><td class='n'>" + (b.bw ? b.bw + "/" + b.br : "–") + "</td><td class='n'>" + ave + "</td><td class='n'>" + er + "</td><td class='n fo-cp-x'>" + srB + "</td><td class='n fo-cp-x'>" + b.w3 + "</td><td class='n fo-cp-x'>" + b.w5 + "</td></tr>";
      };
      var BAT_HEAD = "<tr><th></th><th class='n'>Inns</th><th class='n'>Runs</th><th class='n'>HS</th><th class='n'>Ave</th><th class='n'>SR</th><th class='n fo-cp-x'>100</th><th class='n fo-cp-x'>50</th><th class='n fo-cp-x'>4s</th><th class='n fo-cp-x'>6s</th></tr>";
      var BOWL_HEAD = "<tr><th></th><th class='n'>Wkts</th><th class='n'>Best</th><th class='n'>Ave</th><th class='n'>ER</th><th class='n fo-cp-x'>SR</th><th class='n fo-cp-x'>3WI</th><th class='n fo-cp-x'>5WI</th></tr>";
      // matches resolved away from this device may predate the chronicle
      // stamps: rebuild the guaranteed moments straight from the history
      try {
        var lg = h.filter(function (e) { return e.s != null; });
        if (lg.length) {
          p._career = p._career || [];
          var has = function (ev) { return p._career.some(function (c0) { return c0.ev === ev; }); };
          var f0 = lg[0];
          if (!has("debut") && !p._career.some(function (c0) { return /first time|debut/i.test(c0.txt || ""); }))
            p._career.unshift({ s: f0.s, r: f0.r || 1, ev: "debut", txt: "First appearance for the club" });
          var seen50 = false, seen100 = false, seen5w = false;
          lg.forEach(function (e) {
            if (!seen100 && (+e.rr || 0) >= 100) { seen100 = true; if (!has("hundred") && !p._career.some(function (c0) { return /century/i.test(c0.txt || ""); })) p._career.push({ s: e.s, r: e.r || 1, ev: "hundred", txt: "Maiden century: " + e.bat }); }
            else if (!seen50 && (+e.rr || 0) >= 50) { seen50 = true; if (!has("fifty") && !p._career.some(function (c0) { return /maiden fifty|first fifty/i.test(c0.txt || ""); })) p._career.push({ s: e.s, r: e.r || 1, ev: "fifty", txt: "Maiden fifty: " + e.bat }); }
            if (!seen5w && (+e.w || 0) >= 5) { seen5w = true; if (!has("fivefor") && !p._career.some(function (c0) { return /five[- ]for/i.test(c0.txt || ""); })) p._career.push({ s: e.s, r: e.r || 1, ev: "fivefor", txt: "Maiden five-for: " + e.bowl }); }
          });
        }
      } catch (eR) {}
      var evs = (p._career || []).slice().reverse().slice(0, 14).map(function (c) {
        var when = "Season " + c.s;
        try {
          var wd = (typeof foRoundDate === "function") ? foRoundDate(c.s, c.r) : null;
          if (wd && !/^S\d+ R\d+$/.test(wd)) when = wd;
        } catch (eW) {}
        return "<div class='fo-cp-ev'><i>" + E(when) + "</i><span>" + E(c.txt) + "</span></div>";
      }).join("") || "<div class='small'>The story starts with the next matchday.</div>";
      var card = document.createElement("div");
      card.className = "panel fo-keep"; card.id = "fo-career"; card.setAttribute("data-n", name);
      var mh = function (s0) { return "<div class='small' style='margin:9px 0 4px;text-transform:uppercase;letter-spacing:.07em;font-size:10px;color:#8a93a3'>" + s0 + "</div>"; };
      var fsF = (App.fieldStats && App.fieldStats[name]) || { ct: 0, st: 0, ro: 0 };
      var fldBits = [(fsF.ct || 0) + (fsF.ct === 1 ? " catch" : " catches")];
      if (p.keeper || fsF.st) fldBits.push((fsF.st || 0) + (fsF.st === 1 ? " stumping" : " stumpings"));
      fldBits.push((fsF.ro || 0) + (fsF.ro === 1 ? " run-out" : " run-outs"));
      var fldLine = "<div class='fo-cp-fld'>" + fldBits.join(" &middot; ") + " <span style='color:#8a93a3'>&middot; all matches</span></div>";
      // one tab per record, FTP-style: a Batting card and a Bowling/Fielding card
      var tabBody = function (entries, perSeason, emptyTxt) {
        var rows = [];
        if (perSeason) {
          var bySeason = {};
          entries.forEach(function (e) { feed1(bySeason[e.s] = bySeason[e.s] || mkAgg(), e); });
          var keys = Object.keys(bySeason).sort(function (a, b2) { return +a - +b2; });
          keys.forEach(function (k) { rows.push({ lbl: "Season " + k, b: bySeason[k], cls: "" }); });
          if (keys.length > 1) { var tot = mkAgg(); entries.forEach(function (e) { feed1(tot, e); }); rows.push({ lbl: "Career", b: tot, cls: "fo-cp-tot" }); }
        } else if (entries.length) {
          var one = mkAgg(); entries.forEach(function (e) { feed1(one, e); });
          rows.push({ lbl: "All friendlies", b: one, cls: "" });
        }
        if (!rows.length) return "<div class='small' style='margin:8px 0 2px'>" + emptyTxt + "</div>";
        return mh("Batting") + "<div class='fo-cp-scroll'><table>" + BAT_HEAD + rows.map(function (x) { return batRow(x.lbl, x.b, x.cls); }).join("") + "</table></div>" +
          mh("Bowling / fielding") + "<div class='fo-cp-scroll'><table>" + BOWL_HEAD + rows.map(function (x) { return bowlRow(x.lbl, x.b, x.cls); }).join("") + "</table></div>" +
          fldLine;
      };
      var lgHtml = tabBody(h, true, "No league innings yet - the record starts on the next matchday.");
      var frHtml = tabBody(frE, false, "No friendlies or practice games yet.");
      card.innerHTML = "<h4>Career &middot; " + E(foDisplayName(p)) + "</h4><div class='pad'>" +
        "<div class='fo-cp-prov'>" + E(provTxt) + "</div>" +
        "<div class='fo-cp-tabs'><a class='fo-cp-tab' data-t='league'>League</a><a class='fo-cp-tab' data-t='fr'>Friendly</a></div>" +
        "<div class='fo-cp-body'></div>" +
        mh("Moments") + evs +
        "</div></div>";
      var cpBody = card.querySelector(".fo-cp-body");
      var setCpTab = function (tb) {
        card.querySelectorAll(".fo-cp-tab").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-t") === tb); });
        cpBody.innerHTML = tb === "fr" ? frHtml : lgHtml;
      };
      card.querySelectorAll(".fo-cp-tab").forEach(function (a) { a.addEventListener("click", function () { setCpTab(a.getAttribute("data-t")); }); });
      setCpTab(h.length || !frE.length ? "league" : "fr");
      // the engine leaves the second column empty once its summary panels are
      // hidden - the career belongs there, right beside Player info
      var panels = Array.prototype.slice.call(page.querySelectorAll(".panel"));
      var col2 = page.querySelector(".grid2 .col:nth-child(2)");
      var hideRe = /^(Batting & fielding|Batting &amp; fielding|Bowling|Skills summary)$/i;
      var col2Free = col2 && !Array.prototype.some.call(col2.children, function (ch) {
        if (ch.id === "fo-career") return false;
        var h0 = ch.querySelector && ch.querySelector("h4");
        if (h0 && hideRe.test((h0.textContent || "").trim())) return false;   // about to be hidden below
        return ch.offsetHeight > 30;
      });
      if (col2 && col2Free) col2.appendChild(card);
      else {
        var skills = panels.filter(function (pn) {
          var h = pn.querySelector("h4");
          return h && /^Skills$/i.test((h.textContent || "").trim());
        })[0] || panels[panels.length - 1];
        if (skills && skills.parentNode) skills.parentNode.insertBefore(card, skills.nextSibling);
        else page.appendChild(card);
      }
      // one format means the engine's Batting & fielding / Bowling panels are
      // single-row aggregates - the career table now carries Ave/SR + totals,
      // so those panels only duplicate it
      panels.forEach(function (pn) {
        var h2 = pn.querySelector("h4");
        if (h2 && /^(Batting & fielding|Batting &amp; fielding|Bowling|Skills summary)$/i.test((h2.textContent || "").trim())) pn.style.display = "none";
      });
      // Recent matches: the engine table only knows innings recorded on this
      // device. Rebuild it from local history PLUS the league's challenge
      // list, so resolver-played friendlies and other managers' practice
      // games appear for every player, on every device.
      try {
        var rmP = panels.filter(function (pn) { var h0 = pn.querySelector("h4"); return h0 && /^Recent matches/i.test((h0.textContent || "").trim()); })[0];
        var rmTb = rmP && rmP.querySelector("table");
        if (rmTb) {
          var pad0 = function (n) { return (n < 10 ? "0" : "") + n; };
          var items = hAll.map(function (e) {
            var it = { at: (Date.parse(e.date || "") || 0) + 9 * 3600000, fr: !!(e.fr || e.s == null), teams: e.teams || "", bat: e.bat || "-", bowl: e.bowl || "-", dateTxt: E(e.date || ""), key: (e.teams || "") + "|" + (e.bat || "-") };
            // league innings this season: link to the scorecard and date the
            // row by its round on the real ET calendar, not the engine's fiction
            try {
              if (!it.fr && e.r != null && e.s === (App.seasonNo || 1)) {
                var rIx9 = (e.r || 0) - 1;
                var res9 = (App.results || []).filter(function (r9) { return r9 && r9.comp === "league" && r9.round === rIx9 && (r9.home + " v " + r9.away) === it.teams; })[0];
                if (res9 && res9.ix != null) it.sc = res9.ix;
                if (rIx9 >= 0) {
                  var dL9 = new Date(); dL9.setHours(9, 0, 0, 0);
                  dL9.setDate(dL9.getDate() + (rIx9 - App.season.round) + (foCurAdvanced() ? 1 : 0));
                  it.at = +dL9;
                  it.dateTxt = E(foWhenTxt(it.at));
                }
              }
            } catch (e9) {}
            return it;
          });
          var seenK = {}; items.forEach(function (x) { seenK[x.key] = 1; });
          var clubNm = pl0.team && pl0.team.name;
          var frAll2 = foFrAllNow(function () {
            var ex2 = document.getElementById("fo-career");
            if (ex2) ex2.removeAttribute("data-n");
            foCareerPanel();
          }) || [];
          frAll2.forEach(function (c) {
            if (!c || c.status !== "played" || !c.result || foFrBcastState(c).phase !== "done") return;
            if (c.challenger_club !== clubNm && c.opponent_club !== clubNm) return;
            var batE = null, bowlE = null;
            (c.result.scorecard || []).forEach(function (inn) {
              if (!inn) return;
              (inn.batting || []).forEach(function (b2) { if (b2 && b2.name === name && (b2.b || b2.r || b2.out)) batE = b2; });
              (inn.bowling || []).forEach(function (b2) { if (b2 && b2.name === name && (b2.balls || b2.r || b2.w)) bowlE = b2; });
            });
            if (!batE && !bowlE) return;
            var teams2 = c.challenger_club + " v " + c.opponent_club;
            var bat2 = batE ? (batE.r || 0) + " (" + (batE.b || 0) + ")" : "-";
            var bowl2 = bowlE ? (bowlE.overs != null ? bowlE.overs : Math.floor((bowlE.balls || 0) / 6) + "." + ((bowlE.balls || 0) % 6)) + "-" + (bowlE.r || 0) + "-" + (bowlE.w || 0) : "-";
            var key2 = teams2 + "|" + bat2;
            if (seenK[key2]) return;   // a practice game played on this device is already in local history
            seenK[key2] = 1;
            var at2 = Date.parse(c.play_at || "") || 0, d2 = new Date(at2);
            items.push({ at: at2, fr: true, id: c.id, teams: teams2, bat: bat2, bowl: bowl2, dateTxt: E(foWhenTxt(at2)) });
          });
          items.sort(function (a, b) { return b.at - a.at; });
          var head0 = rmTb.querySelector("tr");
          var rows2 = items.slice(0, 8).map(function (x) {
            var cls = x.fr ? "One Day<div class='small' style='color:#8a93a3'>Friendly</div>" : "One Day";
            var tCell = x.id ? "<a href='#/friendly?id=" + x.id + "'>" + E(x.teams) + "</a>"
              : (x.sc != null ? "<a href='#/scorecard?i=" + x.sc + "'>" + E(x.teams) + "</a>" : E(x.teams));
            return "<tr><td>" + x.dateTxt + "</td><td>" + cls + "</td><td>" + tCell + "</td><td>" + E(x.bat) + "</td><td>" + E(x.bowl) + "</td><td>-</td></tr>";
          }).join("");
          if (rows2) rmTb.innerHTML = (head0 ? head0.outerHTML : "") + rows2;
        }
      } catch (eRm) {}
      // the Skills panel reads exactly like the squad page's expanded row:
      // Batting / Bowling-or-Reserves / In the field, with words and colours
      try {
        if (own && skills && typeof foSqDetail === "function") {
          var sp = skills.querySelector(".pad");
          if (sp && !sp.querySelector(".fo-sq-detail")) sp.innerHTML = foSqDetail(p, false);
        }
      } catch (eSk) {}
    } catch (e) {}
  }

  // ---- the club museum (#/museum) ----
  function foMuseumHTML(t) {
    var mus = t._museum || { trophies: [], awards: [], legends: [] };
    var cups = (mus.trophies || []).map(function (tr) { return "<span class='fo-mu-cup'>&#127942; " + E(tr.kind) + " &middot; S" + tr.s + "</span>"; }).join("") ||
      "<span class='small'>The cabinet waits for its first trophy.</span>";
    var awards = (mus.awards || []).slice().reverse().map(function (a) {
      var medal = /league/.test(a.kind) ? "&#129351;" : "&#127941;";
      return "<tr><td>S" + a.s + "</td><td>" + medal + " " + E(a.kind) + "</td><td><b>" + E(a.name) + "</b></td><td class='small'>" + E(a.line || "") + "</td></tr>";
    }).join("") || "<tr><td colspan='4' class='small'>Season awards are handed out on the final matchday: league-wide categories for runs, wickets, averages, strike rate, economy and glovework, plus your club's own Player and Young Player of the Season.</td></tr>";
    var legends = (mus.legends || []).slice().reverse().map(function (l) {
      return "<div class='fo-mu-leg'><b>" + E(l.nick ? l.name.split(" ")[0] + " “" + l.nick + "” " + l.name.split(" ").slice(1).join(" ") : l.name) + "</b> <span class='small'>retired S" + l.s + ", age " + l.age + "</span>" +
        "<div class='small'>" + l.matches + " matches &middot; " + (l.runs || 0).toLocaleString() + " runs (HS " + E(String(l.hs || "–")) + ") &middot; " + (l.wkts || 0) + " wickets" + (l.bb ? " (best " + E(l.bb) + ")" : "") + "</div></div>";
    }).join("") || "<div class='small'>No one has hung up the whites yet. When they do, they are remembered here.</div>";
    // records from everyone who ever wore the shirt (current squad + legends)
    var names = (t.players || []).map(function (p) { return p.name; });
    (mus.legends || []).forEach(function (l) { if (names.indexOf(l.name) < 0) names.push(l.name); });
    var rHS = null, rBB = null, rRuns = null, rWkts = null;
    names.forEach(function (nm) {
      var tot = foClubTotals(nm);
      if (!tot.matches) return;
      if (!rHS || tot.hs > rHS.v) rHS = { nm: nm, v: tot.hs, txt: tot.hsTxt || tot.hs };
      if (tot.bb && (!rBB || +tot.bb.split("/")[0] > +rBB.txt.split("/")[0])) rBB = { nm: nm, txt: tot.bb };
      if (!rRuns || tot.runs > rRuns.v) rRuns = { nm: nm, v: tot.runs };
      if (!rWkts || tot.wkts > rWkts.v) rWkts = { nm: nm, v: tot.wkts };
    });
    var rec = "<table class='kv'>" +
      (rHS ? "<tr><td>Highest score</td><td><b>" + E(String(rHS.txt)) + "</b> &middot; " + E(rHS.nm) + "</td></tr>" : "") +
      (rBB ? "<tr><td>Best figures</td><td><b>" + E(rBB.txt) + "</b> &middot; " + E(rBB.nm) + "</td></tr>" : "") +
      (rRuns && rRuns.v ? "<tr><td>Most club runs</td><td><b>" + rRuns.v.toLocaleString() + "</b> &middot; " + E(rRuns.nm) + "</td></tr>" : "") +
      (rWkts && rWkts.v ? "<tr><td>Most club wickets</td><td><b>" + rWkts.v + "</b> &middot; " + E(rWkts.nm) + "</td></tr>" : "") +
      "</table>";
    var nicks = (t.players || []).filter(function (p) { return p._nick; }).map(function (p) {
      return "<span class='fo-sq-nickchip'>" + E(p.name.split(" ")[0]) + " “" + E(p._nick) + "”</span>";
    }).join(" ") || "<span class='small'>Nicknames are earned in the middle, never assigned.</span>";
    return "<div class='fo-of-head'><h2>Club museum</h2><span class='small'>&middot; " + E(t.name) + ", since season one</span>" +
      "<a href='#/club' class='fo-of-admin fo-morelink'>&lsaquo; Club home</a></div>" +
      "<div class='panel fo-keep'><h4>Trophy cabinet</h4><div class='pad'><div class='fo-mu-troph'>" + cups + "</div></div></div>" +
      "<div class='panel fo-keep'><h4>Honours board</h4><div class='pad'><table><tr><th>Season</th><th>Award</th><th>Winner</th><th></th></tr>" + awards + "</table></div></div>" +
      "<div class='panel fo-keep'><h4>Club records</h4><div class='pad'>" + rec + "</div></div>" +
      "<div class='panel fo-keep'><h4>Nicknames in the dressing room</h4><div class='pad'>" + nicks + "</div></div>" +
      "<div class='panel fo-keep'><h4>Legends &middot; retired</h4><div class='pad'>" + legends + "</div></div>";
  }
  function foRenderMuseum() {
    try {
      if (!/^#\/museum/.test(location.hash || "")) return;
      var page = document.getElementById("page"); if (!page) return;
      var t = foMyClub(); if (!t) return;
      if (page.__foMusSig === t.name + "|" + ((t._museum && (t._museum.awards || []).length) || 0) + "|" + ((t._museum && (t._museum.legends || []).length) || 0) && page.querySelector(".fo-mu-troph")) return;
      page.__foMusSig = t.name + "|" + ((t._museum && (t._museum.awards || []).length) || 0) + "|" + ((t._museum && (t._museum.legends || []).length) || 0);
      page.innerHTML = foMuseumHTML(t);
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderMuseum, 20); setTimeout(foCareerPanel, 60); });
  setTimeout(foChronBackfill, 1200);

  // ---- nemesis records for the scout page ----
  function foBattlesCard(opp) {
    try {
      var mine = foMyClub(); if (!mine || !opp || mine === opp) return "";
      var oppNames = {}, myNames = {};
      (opp.players || []).forEach(function (p) { oppNames[p.name] = 1; });
      (mine.players || []).forEach(function (p) { myNames[p.name] = 1; });
      var rows = [];
      var scan = function (duels, bowlOwn) {
        for (var k in (duels || {})) {
          var parts = k.split("|"), bowler = parts[0], batter = parts[1], n = duels[k];
          if (bowlOwn && myNames[bowler] && oppNames[batter]) rows.push({ n: n, txt: "<b>" + E(bowler) + "</b> has removed " + E(batter) + " <em>" + n + "&times;</em>" });
          if (!bowlOwn && oppNames[bowler] && myNames[batter]) rows.push({ n: n, txt: "<b>" + E(bowler) + "</b> has your " + E(batter) + " <em>" + n + "&times;</em>" });
        }
      };
      scan(mine._duels, true);
      scan(opp._duels, false);
      rows.sort(function (a, b) { return b.n - a.n; });
      if (!rows.length) return "";
      return "<div class='panel'><h4>The battles</h4><div class='pad'>" +
        rows.slice(0, 5).map(function (r) { return "<div class='fo-duel'>" + r.txt + "</div>"; }).join("") +
        "<div class='small' style='margin-top:6px'>Dismissals between these clubs, all-time. Old scores get settled.</div></div></div>";
    } catch (e) { return ""; }
  }

  // ===========================================================================
  //  LIVING COMMENTARY moved into the engine core (one comm implementation).
  //  What remains here is sim-scratch cleanup + the umpire-naming decorator.
  // ===========================================================================
  try {
    // (the living-commentary voice now IS the engine comm — engine/src/00-core.js)

    // the anti-repeat memory is sim-scratch: strip it before the innings are
    // frozen into App.results / snapshots
    if (typeof window.saveMatch === "function" && !window.saveMatch.__foComm) {
      var _foSmC = window.saveMatch;
      window.saveMatch = function (m) {
        try { (m && m.innings || []).forEach(function (inn) { if (inn && inn.__foRecent) delete inn.__foRecent; }); } catch (e) {}
        return _foSmC.apply(this, arguments);
      };
      window.saveMatch.__foComm = 1;
    }

    // FTP-style feed: bracket fielding tags, purple milestone interjections,
    // tinted fall-of-wicket rows - and wickets in RED, not orange.
    if (typeof window.ftpCommHTML === "function" && !window.ftpCommHTML.__foRich) {
      var foCommTag = function (L) {
        var t = L.txt || "";
        if (L.out === "wRO") return "direct hit";
        if (/DROPPED/i.test(t)) return "dropped catch";
        if (/Stumping chance missed/i.test(t)) return "chance missed";
        if (/Brilliant stop|diving stop|phenomenal stop|attacks the ball and keeps|saves two/i.test(t)) return "great fielding";
        if (/Misfield|Fumble|fumbles/i.test(t)) return "misfield";
        if (/Rocket Arm/i.test(t)) return "rocket arm";
        if (/Lightning Hands/i.test(t)) return "lightning hands";
        if (/appeal/i.test(t) && !/WICKET/i.test(t)) return "appeal";
        return null;
      };
      var _wk = function (o) { return o && o.charAt(0) === "w" && o !== "wide"; };
      var _rslt = function (o) {
        if (o === "4") return '<span class="four">4</span>';
        if (o === "6") return '<span class="six">6</span>';
        if (_wk(o)) return '<span class="wicket">W</span>';
        if (o === "wide") return '<span class="exb">wd</span>';
        if (o === "noball") return '<span class="exb">nb</span>';
        if (o === "bye" || o === "legbye") return '<span class="exb">b</span>';
        if (o === "dot" || !o) return ".";
        return String(o);
      };
      // the engine's ftpPass/talentize live inside a private IIFE, so both
      // are reimplemented here in full (a bare reference throws and the
      // filters silently fall open)
      var foPassC = function (L, f) {
        f = f || "all"; var t = L.txt || "";
        if (f === "all") return true;
        if (f === "wickets") return _wk(L.out) || /WICKET|out for/i.test(t);
        if (f === "boundaries") return L.out === "4" || L.out === "6";
        if (f === "overs") return !!L.mile || /End of over|DRINKS|Innings break/i.test(t);
        if (f === "highlights") return !!L.mile || _wk(L.out) || L.out === "4" || L.out === "6" || /DROPPED|FIFTY|HUNDRED/i.test(t);
        if (f === "talents") return /machine|breaker|specialist|golden arm|mystery|bouncer|finisher|lightning|rocket arm|safe hands|miser|killer|hunter|starter|anchor/i.test(t);
        return true;
      };
      var FO_TALHIT = ["SIX MACHINE", "PARTNERSHIP BREAKER", "New Ball Specialist", "Golden Arm", "Mystery Ball", "Bouncer", "Finisher", "Lightning Hands", "Rocket Arm", "Safe Hands", "Miser", "Spin Killer", "Pace Hunter", "Fast Starter", "Anchor", "death specialist"];
      window.ftpCommHTML = function (log, filter, limit) {
        var pass = foPassC;
        var tal = function (t) {
          var h = E(t || "");
          for (var ti = 0; ti < FO_TALHIT.length; ti++) {
            var tn = FO_TALHIT[ti].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            h = h.replace(new RegExp("(" + tn + ")", "ig"), '<span class="talent-hit">$1</span>');
          }
          return h;
        };
        var fieldTest = function (L) {
          if (L.out === "wRO") return true;
          return /DROPPED|Misfield|fumbles|Brilliant stop|diving stop|phenomenal stop|attacks the ball|Stumping chance missed|Rocket Arm|Lightning Hands|run out/i.test(L.txt || "");
        };
        // the chase equation rides every second-innings over summary:
        // "Need 41 from 12 overs" / "Need 3 from 8 balls"
        var target = 0;
        try {
          for (var iT = 0; iT < (log || []).length; iT++) {
            var LT = log[iT];
            if (LT && LT.mile && LT.txt) { var mT = /Target (\d+)\./.exec(LT.txt); if (mT) { target = +mT[1]; break; } }
          }
        } catch (eTg) {}
        var rows = (log || []).filter(function (L) { return filter === "fielding" ? fieldTest(L) : pass(L, filter); }).slice(0, limit || 140).map(function (L) {
          if (L.intro) return '<div class="fo-comm-intro">' + tal(L.txt) + "</div>";
          if (L.mile || /^End of over/i.test(L.txt || "")) {
            var txtM = L.txt || "";
            if (target && L.inn === 1) {
              var mO = /^End of over (\d+) .*- .*? (\d+)\/(\d+)\./.exec(txtM);
              if (mO) {
                var needR = target - (+mO[2]), left = 300 - (+mO[1]) * 6;
                if (needR > 0 && left > 0) txtM += " Need " + needR + " from " + (left > 36 ? (left / 6) + " overs." : left + " balls.");
              }
            }
            var cls = L.out === "★" ? "fo-c-mile" : L.out === "✕" ? "fo-c-fow" : L.out === "⚑" ? "fo-c-flag" : "oversummary-bottom";
            return '<div class="' + cls + '"><div class="text">' + tal(txtM) + '</div><div class="clear"></div></div>';
          }
          var rowcls = L.out === "4" ? "four" : L.out === "6" ? "six" : _wk(L.out) ? "line wkt" : "line";
          var tag = foCommTag(L);
          var txt = L.txt || "";
          // the engine appends "Taken safely by <name>." after catches; drop it
          // when the commentary line already names the catcher
          if (L.out === "wC") {
            var mnm = txt.match(/ Taken safely by ([^.]+)\.\s*$/);
            if (mnm && txt.indexOf(mnm[1].split(" ").slice(-1)[0]) < txt.length - mnm[0].length) txt = txt.slice(0, -mnm[0].length);
          }
          return '<div class="' + rowcls + '"><div class="del">' + E(L.no || "") + '</div><div class="rslt">' + _rslt(L.out) +
            '</div><div class="text">' + (tag ? '<b class="fo-ctag">[' + tag + ']</b> ' : "") + tal(txt) + '</div><div class="clear"></div></div>';
        }).join("");
        return rows || '<div class="line"><div class="text" style="padding-left:8px">No commentary matches this filter.</div><div class="clear"></div></div>';
      };
      window.ftpCommHTML.__foRich = 1;
    }

    var foCommCss = document.createElement("style");
    foCommCss.textContent =
      "body.ftpskin #ftpcomm .rslt .wicket{background:#DC2626 !important}" +
      "body.ftpskin #ftpcomm .line.wkt .text{color:#8f231b !important}" +
      "body.ftpskin #ftpcomm .rslt .four{background:#2d6a8f !important}" +
      "#ftpcomm .fo-ctag{font-weight:800;color:#0E233F;font-style:normal}" +
      "#ftpcomm .fo-c-mile{background:#f7f2fb;border-bottom:1px solid #e6daf2;padding:4px 8px;color:#6b3fa0;font-style:italic;font-weight:600}" +
      "#ftpcomm .fo-c-fow{background:#fbf0ee;border-bottom:1px solid #efd6cf;padding:4px 8px;color:#8f231b;font-weight:600}" +
      "#ftpcomm .fo-c-flag{background:#fdf7e8;border-bottom:1px solid #efe2bd;padding:4px 8px;color:#7b5a0a}" +
      "#ftpcomm .fo-c-mile .text,#ftpcomm .fo-c-fow .text,#ftpcomm .fo-c-flag .text{float:none;width:auto;padding:0;color:inherit}" +
      ".fo-trx-gh{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#667085;margin:12px 0 7px}" +
      ".fo-trx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:9px}" +
      ".fo-trx{background:#FFFEFC;border:1px solid #e8e3d6;border-radius:11px;padding:10px 12px}" +
      ".fo-trx-stack{display:flex;height:18px;border-radius:99px;overflow:hidden;margin:8px 0 7px;box-shadow:inset 0 0 0 1px rgba(18,32,58,.08)}" +
      ".fo-trx-stack i{display:flex;align-items:center;justify-content:center;height:100%}" +
      ".fo-trx-stack i em{font-style:normal;font-size:9.5px;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.25)}" +
      ".fo-trx-legend{display:flex;flex-wrap:wrap;gap:4px 10px}" +
      ".fo-trx-lg{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;color:#667085}" +
      ".fo-trx-lg u{width:8px;height:8px;border-radius:3px;display:inline-block;text-decoration:none}" +
      ".fo-trx-lg b{color:#111827}" +
      ".fo-trx>b{font-size:13px;color:#111827}" +
      ".fo-trx-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}" +
      ".fo-trx-chip{font-size:11px;background:#FFFEFC;border:1px solid #DDD8CF;border-radius:999px;padding:3px 9px;color:#667085}" +
      ".fo-trx-chip b{color:#111827}" +
      ".fo-trx-main{background:#fdf3e2;border-color:#ecd9ae;color:#8a5a1d}.fo-trx-main b{color:#8a5a1d}" +
      ".fo-trx-rest{font-size:12px;color:#667085;font-style:italic}" +
      // phones: wide stats tables scroll inside their panel instead of being
      // crushed into ellipsis dots (engine's fo-stattbl is table-layout:fixed)
      "@media(max-width:820px){" +
      "#page .panel .pad{overflow-x:auto;-webkit-overflow-scrolling:touch}" +
      "table.fo-stattbl{table-layout:auto !important;min-width:540px}" +
      "table.fo-stattbl th,table.fo-stattbl td{overflow:visible !important;text-overflow:clip !important;white-space:nowrap}" +
      "}";
    document.head.appendChild(foCommCss);
  } catch (e) { console.warn("living commentary", e); }

  // ---- mobile premium layer: slim sticky header, pill nav, touch polish ----
  try {
    var foMobCss = document.createElement("style");
    foMobCss.textContent =
      ".fo-nav-scroll{display:contents}" +
      "a,button{-webkit-tap-highlight-color:transparent}" +
      // hamburger + drawer: built for phones, dormant on desktop
      "html body #fo-mnav-btn,html body.ftpskin #fo-mnav-btn{display:none;align-items:center;justify-content:center;width:44px;height:44px;background:transparent !important;border:0 !important;color:#FFFEFC !important;padding:0 !important;margin:0 4px 0 -6px;border-radius:10px;cursor:pointer;box-shadow:none !important}" +
      "html body #topbar #fo-mlive{display:none !important}" +
      "#fo-mdrawer,#fo-mandrawer{position:fixed;inset:0;z-index:400;display:none}" +
      "#fo-mdrawer.open,#fo-mandrawer.open{display:block}" +
      "#fo-mdrawer .fo-mdk,#fo-mandrawer .fo-mdk{position:absolute;inset:0;background:rgba(5,18,35,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}" +
      "#fo-mdrawer .fo-mdp,#fo-mandrawer .fo-mdp{position:absolute;top:0;left:0;width:min(82vw,320px);height:100dvh;background:#0E233F;box-shadow:8px 0 30px rgba(0,0,0,.35);padding:0 12px 14px;display:flex;flex-direction:column}" +
      "#fo-mdrawer .fo-mdh,#fo-mandrawer .fo-mdh{flex:0 0 auto;display:flex;align-items:center;gap:9px;height:72px;color:#FFFEFC;font-weight:800;font-size:16px;padding:0 0 0 8px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:8px}" +
      "#fo-mdrawer .fo-mdh img,#fo-mandrawer .fo-mdh img{width:26px;height:26px;border-radius:6px}" +
      "html body #fo-mdrawer .fo-mdx,html body.ftpskin #fo-mdrawer .fo-mdx,html body #fo-mandrawer .fo-mdx,html body.ftpskin #fo-mandrawer .fo-mdx{margin-left:auto;width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:transparent !important;border:0 !important;color:#c7cfda !important;font:400 20px/1 inherit !important;border-radius:10px;cursor:pointer;padding:0 !important;box-shadow:none !important}" +
      "#fo-mdrawer .fo-mdn,#fo-mandrawer .fo-mdn{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:5px}" +
      "#fo-mdrawer a.fo-mdl,#fo-mandrawer a.fo-mdl{flex:0 0 auto;display:flex;align-items:center;min-height:52px;padding:0 16px;border-radius:10px;color:#dfe5ec !important;font-size:17px;font-weight:600;text-decoration:none !important}" +
      "#fo-mdrawer a.fo-mdl.on,#fo-mandrawer a.fo-mdl.on{background:rgba(232,90,42,.16);color:#fff !important;box-shadow:inset 3px 0 0 #e85a2a}" +
      "#fo-mdrawer a.fo-mdl:active,#fo-mandrawer a.fo-mdl:active{background:rgba(255,255,255,.08)}" +
      "#fo-mdrawer .fo-mdf,#fo-mandrawer .fo-mdf{flex:0 0 auto;margin-top:auto;padding-top:12px;border-top:1px solid rgba(255,255,255,.14)}" +
      "body.fo-mnav-lock{overflow:hidden !important}" +
      "@media(max-width:820px){" +
      // header: hamburger | Fifty Overs | next-match chip + bell. The nav
      // pills are gone - every link lives in the drawer, at thumb size.
      "#topbar{position:sticky;top:0;z-index:120;flex-wrap:nowrap;align-items:center;padding:6px 12px !important;box-shadow:0 3px 14px rgba(6,12,24,.35)}" +
      "html body #fo-mnav-btn,html body.ftpskin #fo-mnav-btn{display:inline-flex;order:0;flex:0 0 auto}" +
      "html body #topbar .brand,html body.ftpskin #topbar .brand{order:1;font-size:16px !important;font-weight:800;letter-spacing:-.2px;line-height:1;display:inline-flex;align-items:center;gap:8px;width:auto !important;padding:0 !important;border:0 !important;color:#FFFEFC !important;white-space:nowrap}" +
      "#topbar .brand::after,#topbar .brand::before{display:none !important}" +
      "html body #topbar .brand .fo-brandicon{width:28px;height:28px;vertical-align:middle;margin-right:0}" +
      "html body #topbar #fo-top-status{display:none !important}" +
      "html body #topbar #fo-mlive.on{display:inline-flex !important;order:2;margin-left:auto;align-items:center;gap:6px;background:#e02020 !important;color:#fff !important;border-radius:999px;padding:0 13px;font-size:12.5px;font-weight:800;letter-spacing:.02em;text-decoration:none !important;height:30px;align-self:center;box-sizing:border-box;line-height:1}" +
      "#fo-mlive .live-dot{background:#fff !important}" +
      "#fo-top-status span{font-size:11.5px !important;padding:7px 11px !important}" +
      "#fo-live-icons{order:2;width:auto !important;margin-left:8px !important}" +
      "#fo-clock{display:none !important}" +
      "html body #topbar .fo-nav-scroll{display:none !important}" +
      // breadcrumbs: quiet, one line
      "#page .crumb{font-size:12.5px;opacity:.75;margin:2px 0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      // typography rhythm
      "#page h1{font-size:24px !important;letter-spacing:-.4px}" +
      "#page .page-head{margin-bottom:10px}" +
      "#page .panel h4{font-size:12.5px !important;letter-spacing:.05em}" +
      // inputs at 16px so iOS stops zooming the page on focus
      "#page select,#page input[type=text],#page input[type=number],#page input:not([type]){font-size:16px !important}" +
      // stat values never truncate into dots
      ".fo-stat-v{font-size:clamp(13px,4.2vw,19px) !important;text-overflow:clip !important}" +
      // gentle press feedback
      "#page button{transition:transform .06s ease}" +
      "#page button:active{transform:scale(.98)}" +
      "}";
    document.head.appendChild(foMobCss);
  } catch (e) {}

