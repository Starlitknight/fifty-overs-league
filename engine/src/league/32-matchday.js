// ---- 32-matchday.js — MATCHDAY: the pre-match ritual --------------------------
// The owner's named weakest link, now a room of its own. One page per
// fixture (#/matchday?r=N), reached from the home NEXT MATCH button and from
// every upcoming row on the fixture list: the pitch and the sky in one line
// each, the head-to-head ledger, both probable XIs, the broadcaster's win
// percentage, and a pundit with opinions. Everything on the page derives
// from shared state (squads, results, schedule) — same page on every
// device, nothing to sync, offline managers lose nothing.
(function () {
  "use strict";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function h32(s) { var h = 2166136261 >>> 0; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function q(name) { var m = new RegExp("[?&]" + name + "=([^&]+)").exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : null; }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function ovrOf(p) { try { if (typeof foPkOvr === "function") return foPkOvr(p); } catch (e) {} return (p && p.rating ? Math.round(p.rating / 1000) : 50); }

  var PITCH_LINE = {
    green: "A green top - the ball will talk all morning; play late, play straight.",
    dry: "Bone dry and turning - spinners will smile from the tenth over.",
    flat: "A road. Whoever bats deepest cashes in.",
    balanced: "A true surface - fair to bat, ball and nerve alike.",
    slow: "Slow and grippy - timing dies here; run hard and stay patient.",
    cracked: "Cracked and two-paced - survive the surprises and the runs will come.",
    twoPaced: "Two-paced - one ball skids, the next holds; soft hands, cool heads."
  };
  var WX_LINE = {
    Sunny: "Sun on the ground all day - bring your batting appetite.",
    Overcast: "Low cloud - the seamers will want the new ball early.",
    Cloudy: "Grey but dry - a little help for the quicks, no excuses for anyone.",
    Humid: "Heavy, humid air - swing early, tired legs late.",
    Hot: "A scorcher - fatigue will pick the last hour's winner.",
    Windy: "A stiff crosswind - spinners will love drifting it in.",
    Scorching: "A scorcher - hydrate, rotate the quicks, and bat time.",
    Drizzle: "Drizzle about - the ball will zip whenever the covers come off.",
    Muggy: "Muggy and close - swing for the seamers, sweat for everyone."
  };
  var PUNDITS = ["Reggie Thorne", "Marjorie Clews", "Sam Okafor", "Dickie Farthing"];
  var BANTER = [
    "{fav} arrive as favourites, but {dog} have made a career of ignoring scripts.",
    "Everything says {fav}. Which is exactly when cricket clears its throat.",
    "{dog} have nothing to lose, and sides with nothing to lose are the ones I never bet against.",
    "On paper it's {fav}. On {pitch} pitches, paper burns.",
    "If {dogStar} gets going early, forget the percentages entirely.",
    "{fav} by a distance - unless the toss goes wrong and the sky stays interesting.",
    "I have seen {dog} ruin better sides than this for fun. Watch the first ten overs."
  ];

  // the ACTUAL XI: saved orders if the coach has spoken, else the very
  // eleven the engine will field - keeper, the five best bowlers, best
  // bats, in match order. No "probable" guesswork: this is the teamsheet.
  function probableXI(team, mine) {
    try {
      if (mine && App.orders && App.orders.saved && App.orders.batOrder && App.orders.batOrder.length >= 11) {
        var byName = {}; (team.players || []).forEach(function (p) { byName[p.name] = p; });
        var xi = App.orders.batOrder.slice(0, 11).map(function (nm) { return byName[nm]; }).filter(Boolean);
        if (xi.length === 11) return { xi: xi, fromOrders: true };
      }
    } catch (e) {}
    var P = (team.players || []).slice();
    if (!P.length) return { xi: [], fromOrders: false };
    var kps = P.filter(function (p) { return p.keeper; }).sort(function (a, b) { return b.bat - a.bat; });
    var keeper = kps[0] || P.slice().sort(function (a, b) { return b.bat - a.bat; })[0];
    var bowlers = P.filter(function (p) { return p.bowlType && p.key !== keeper; }).sort(function (a, b) { return (b.threat + b.control) - (a.threat + a.control); });
    var chosen = {}; chosen[keeper.name] = 1;
    bowlers.slice(0, 5).forEach(function (b) { chosen[b.name] = 1; });
    var rest = P.filter(function (p) { return !chosen[p.name]; }).sort(function (a, b) { return b.bat - a.bat; });
    for (var i = 0; i < rest.length; i++) { if (Object.keys(chosen).length >= 11) break; chosen[rest[i].name] = 1; }
    var xi2 = P.filter(function (p) { return chosen[p.name]; });
    xi2.sort(function (a, b) { return (a.mpos - b.mpos) || (b.bat - a.bat); });
    return { xi: xi2.slice(0, 11), fromOrders: false };
  }
  function xiStrength(xi) { return xi.length ? xi.reduce(function (s, p) { return s + ovrOf(p); }, 0) / xi.length : 50; }

  // ONE PRE-MATCH PAGE. This room derives everything from the retired local
  // sim, which for a club held in the served world means a fixture nobody will
  // play - the wrong round, the wrong opponent, at Neutral Park. The world has
  // its own build-up (#/preview, module 51) off the umpire's schedule, so a
  // claimed club is sent there and this room is left to the devices that have
  // never claimed anything and really are playing their own season.
  function servedElsewhere() {
    try {
      var cl = window.__foWorldClaim;
      if (!cl) { try { cl = JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC) {} }
      if (!cl || !cl.country || cl.slot == null) return false;
      var fx = (typeof window.foNextFixture === "function") ? window.foNextFixture() : null;
      if (fx && fx.href) {
        // replace, not push: the back button should leave the build-up, not
        // bounce off this door a second time
        try { location.replace(fx.href); } catch (eR) { location.hash = fx.href; }
        try { if (typeof window.route === "function") window.route(); } catch (eR2) {}
        return true;
      }
      // held in the world but its schedule has not landed yet: say so rather
      // than draw a match off the old sim
      var page = document.getElementById("page");
      if (page) {
        page.innerHTML = "<div class='fo-md'><div class='fo-md-mast'><h1>The build-up</h1>" +
          "<p>Reaching the world for your next fixture&hellip; if nothing appears, the season is played out.</p>" +
          "<p><a href='#/fixtures'>The fixture list &rsaquo;</a></p></div></div>";
      }
      return true;
    } catch (e) { return false; }
  }

  function foRenderMatchdayPage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/matchday") return;
      if (servedElsewhere()) return;
      if (!ready()) return;
      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on");
      try { if (typeof seasonInit === "function") seasonInit(); } catch (eS) {}
      var S = App.season; if (!S || !S.schedule) return;
      var me = userTeam(), myIx = App.teamIx;
      var r = parseInt(q("r") || String(S.round | 0), 10);
      if (!(r >= 0) || r >= S.schedule.length) r = S.round | 0;
      var f = (S.schedule[r] || []).filter(function (x) { return x[0] === myIx || x[1] === myIx; })[0];
      if (!f) { page.innerHTML = "<div class='fo-md'><div class='fo-md-mast'><h1>No fixture</h1><p>You have no match in round " + (r + 1) + ".</p></div></div>"; return; }
      var home = GD.teams[f[0]], away = GD.teams[f[1]], isHome = f[0] === myIx;
      var opp = isHome ? away : home;
      var played = false;
      try { played = S.played && S.played[fixtureKey(r, f)] !== undefined; } catch (eP) {}

      // the square and the sky - same derivations as the fixture list
      var pitch = (typeof groundPitch === "function") ? groundPitch(home.ground) : "balanced";
      var wx = (typeof WXLIST !== "undefined") ? WXLIST[(r * 7 + f[0] * 3) % WXLIST.length] : "Sunny";
      var when = "";
      try { if (typeof window.foRoundTimeTxt === "function" && !played) when = window.foRoundTimeTxt(r) || ""; } catch (eW) {}

      // head-to-head, all seasons, from the shared record
      var hw = 0, aw = 0, ties = 0, lastLine = "";
      (App.results || []).forEach(function (res) {
        if (!res || res.comp !== "league" || !res.result) return;
        var pair = (res.home === home.name && res.away === away.name) || (res.home === away.name && res.away === home.name);
        if (!pair) return;
        if (res.result.winner === home.name) hw++;
        else if (res.result.winner === away.name) aw++;
        else if (res.result.winner === null) ties++;
        lastLine = (res.result.text || "") + (res.seasonNo ? " (S" + res.seasonNo + ")" : "");
      });

      // both elevens, and the broadcaster's number
      var pHome = probableXI(home, isHome), pAway = probableXI(away, !isHome);
      var sH = xiStrength(pHome.xi) + 2;                     // home ground is worth a nudge
      var sA = xiStrength(pAway.xi);
      var probHome = Math.round(100 / (1 + Math.pow(10, -(sH - sA) / 12)));
      probHome = Math.max(8, Math.min(92, probHome));
      var myProb = isHome ? probHome : 100 - probHome;

      // stakes from the live table
      var stakes = "";
      try {
        var rows = leagueRows();
        var posOf = function (nm) { return rows.findIndex(function (x) { return x.nm === nm; }) + 1; };
        var ordn = function (n) { return n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"); };
        // a club the table does not carry has no position, and "0th hosts 1st"
        // is worse than saying nothing at all
        var pH = posOf(home.name), pA = posOf(away.name);
        if (pH > 0 && pA > 0) stakes = ordn(pH) + " hosts " + ordn(pA);
      } catch (eT) {}

      // the pundit speaks (deterministically)
      var seed = h32("md|" + (App.seasonNo || 1) + "|" + r + "|" + home.name + "|" + away.name);
      var fav = probHome >= 50 ? home : away, dog = probHome >= 50 ? away : home;
      var dogStar = (probableXI(dog, false).xi[0] || {}).name || dog.name;
      var pundit = PUNDITS[seed % PUNDITS.length];
      var line = BANTER[(seed >>> 3) % BANTER.length]
        .replace("{fav}", fav.name).replace("{dog}", dog.name)
        .replace("{dogStar}", dogStar).replace("{pitch}", pitch);

  // the red star: this man is in his country's fifteen as it stands
  function foNS(nm, rid) {
    try { return (window.foNatStar && window.__foServed && window.__foServed.on())
      ? window.foNatStar(nm, null, rid ? { rid: rid } : undefined) : ""; } catch (e) { return ""; }
  }
      var xiCol = function (team, prob, label) {
        return "<div class='fo-md-xi'><i>" + E(label) + (prob.fromOrders ? " &middot; your card" : " &middot; the XI") + "</i>" +
          prob.xi.map(function (p, k) {
            return "<div class='p'><u>" + (k + 1) + "</u><b>" + E(p.name) + foNS(p.name) + "</b>" +
              (p.keeper || p.role === "wicketkeeper" ? "<em>&dagger;</em>" : p.bowlType ? "<em>&#9679;</em>" : "") + "</div>";
          }).join("") + "</div>";
      };

      // what a manager can DO from here depends on where the fixture stands
      var live = false;
      try { live = !played && r === (S.round | 0) && window.__foEngClock && window.__foEngClock.liveNow(); } catch (eL) {}
      var reportIx = null;
      if (played) {
        (App.results || []).forEach(function (res) {
          if (res && res.comp === "league" && (res.round | 0) === r && (res.home === me.name || res.away === me.name)) reportIx = res.ix;
        });
      }
      var ctas = played
        ? "<a class='fo-md-cta' href='#/report?i=" + reportIx + "'>Read the report &rsaquo;</a>"
        : (live ? "<a class='fo-md-cta hot' href='#/home'>&#9679; LIVE NOW &middot; take your seat &rsaquo;</a>" : "") +
          "<a class='fo-md-cta" + (live ? "" : " hot") + "' href='#/orders'>" +
          ((App.orders && App.orders.saved) ? "Orders saved &#10003; &middot; change the plan" : "Set your orders") + " &rsaquo;</a>";

      page.innerHTML =
        "<div class='fo-md'>" +
        "<div class='fo-md-mast'>" +
        "<div class='fo-md-kick'>Matchday &middot; Round " + (r + 1) + (when ? " &middot; " + E(when) : "") + (stakes ? " &middot; " + E(stakes) : "") + "</div>" +
        "<h1>" + E(home.name) + " <span>v</span> " + E(away.name) + "</h1>" +
        "<p>" + E(home.ground) + "</p>" +
        "<div class='fo-md-prob'><div class='bar'><i style='width:" + probHome + "%'></i></div>" +
        "<div class='lbl'><span>" + E(home.name) + " " + probHome + "%</span><span>" + (100 - probHome) + "% " + E(away.name) + "</span></div></div>" +
        "<div class='fo-md-ctas'>" + ctas + "</div>" +
        "</div>" +
        "<div class='fo-md-sec'><h2>The square and the sky</h2>" +
        "<div class='fo-md-line'><i>Pitch</i><span>" + E(PITCH_LINE[pitch] || "A surface with secrets.") + "</span></div>" +
        "<div class='fo-md-line'><i>Weather</i><span>" + E(WX_LINE[wx] || ("A " + String(wx).toLowerCase() + " day at the ground - adapt or be adapted.")) + "</span></div>" +
        "</div>" +
        "<div class='fo-md-sec'><h2>Head to head</h2>" +
        (hw + aw + ties > 0
          ? "<div class='fo-md-h2h'><b>" + hw + "</b><i>" + E(home.name) + "</i><u>&mdash;</u><b>" + aw + "</b><i>" + E(away.name) + "</i>" + (ties ? "<s>" + ties + " tied</s>" : "") + "</div>" +
            (lastLine ? "<p class='fo-md-last'>Last time: " + E(lastLine) + "</p>" : "")
          : "<p class='fo-md-last'>These two have never met. Someone's record starts today.</p>") +
        "</div>" +
        "<div class='fo-md-sec'><h2>The elevens</h2><div class='fo-md-xis'>" +
        xiCol(home, pHome, home.name) + xiCol(away, pAway, away.name) +
        "</div></div>" +
        "<div class='fo-md-sec pundit'><h2>From the commentary box</h2>" +
        "<p class='fo-md-quote'>&ldquo;" + E(line) + "&rdquo;</p><i>&mdash; " + E(pundit) + "</i>" +
        "</div>" +
        "<div class='fo-md-foot'><a href='#/fixtures'>&#8592; The fixture list</a><a href='#/league'>The table &rsaquo;</a></div>" +
        "</div>";
    } catch (e) { try { console.warn("foRenderMatchdayPage", e); } catch (e2) {} }
  }

  var CSS = [
    "html body #page .fo-md{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#1B2432}",
    "html body #page .fo-md-mast{background:linear-gradient(150deg,#FFFEFB,#F6F1E4 70%,#F0E9D6) !important;border:1px solid rgba(20,28,40,.1);border-radius:22px;padding:24px 26px 20px;box-shadow:0 22px 50px rgba(30,38,52,.12)}",
    "html body #page .fo-md-kick{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;color:#B44A22}",
    "html body #page .fo-md-kick:after{content:'';display:block;width:34px;border-top:2px solid #C9571F;margin-top:7px}",
    "html body #page .fo-md-mast h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:29px;letter-spacing:-.015em;margin:8px 0 4px;line-height:1.1}",
    "html body #page .fo-md-mast h1 span{font-style:normal;font-weight:400;color:rgba(20,28,40,.4);font-size:.7em}",
    "html body #page .fo-md-mast>p{font:420 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55);margin:0 0 14px}",
    "html body #page .fo-md-prob .bar{height:9px;border-radius:999px;background:rgba(20,28,40,.1);overflow:hidden}",
    "html body #page .fo-md-prob .bar i{display:block;height:100%;background:linear-gradient(90deg,#C9571F,#B44A22);border-radius:999px}",
    "html body #page .fo-md-prob .lbl{display:flex;justify-content:space-between;font:700 11px/1 Oswald,sans-serif;letter-spacing:.08em;margin-top:6px;color:rgba(20,28,40,.65)}",
    "html body #page .fo-md-ctas{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}",
    "html body #page .fo-md-cta{font:700 13px/1 Oswald,sans-serif;border-radius:999px;padding:11px 16px;text-decoration:none;background:#FFFEFC;border:1px solid rgba(20,28,40,.15);color:rgba(20,28,40,.75)}",
    "html body #page .fo-md-cta.hot{background:#C9571F;border-color:#C9571F;color:#FFFEFC}",
    "html body #page .fo-md-cta.hot:hover{background:#B44A22;text-decoration:none}",
    "html body #page .fo-md-sec{margin-top:16px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:18px;padding:16px 18px;box-shadow:0 8px 26px rgba(30,38,52,.07)}",
    "html body #page .fo-md-sec h2{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:16px;margin:0 0 10px}",
    "html body #page .fo-md-line{display:flex;gap:12px;align-items:baseline;padding:6px 0;border-top:1px solid rgba(20,28,40,.06)}",
    "html body #page .fo-md-line i{flex:none;width:64px;font:700 11px/1.4 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#B44A22;font-style:normal}",
    "html body #page .fo-md-line span{font:400 13px/1.5 Oswald,sans-serif;color:rgba(20,28,40,.75)}",
    "html body #page .fo-md-h2h{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}",
    "html body #page .fo-md-h2h b{font-family:Oswald,sans-serif;font-weight:700;font-size:24px}",
    "html body #page .fo-md-h2h i{font:400 13px/1.3 Oswald,sans-serif;font-style:normal;color:rgba(20,28,40,.55)}",
    "html body #page .fo-md-h2h u{text-decoration:none;color:rgba(20,28,40,.3)}",
    "html body #page .fo-md-h2h s{text-decoration:none;font:400 13px/1 Oswald,sans-serif;color:rgba(20,28,40,.45)}",
    "html body #page .fo-md-last{font:400 13px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.6);margin:8px 0 0}",
    "html body #page .fo-md-xis{display:grid;grid-template-columns:1fr 1fr;gap:14px}",
    "html body #page .fo-md-xi>i{display:block;font:700 11px/1.3 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.5);font-style:normal;margin-bottom:6px}",
    "html body #page .fo-md-xi .p{display:flex;gap:7px;align-items:baseline;padding:3px 0;font:500 13px/1.3 Oswald,sans-serif}",
    "html body #page .fo-md-xi .p u{text-decoration:none;font-size:10px;color:rgba(20,28,40,.4);width:14px;font-variant-numeric:tabular-nums}",
    "html body #page .fo-md-xi .p b{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    "html body #page .fo-md-xi .p em{font-style:normal;font-size:10px;color:#B44A22}",
    "html body #page .fo-md-sec.pundit{background:linear-gradient(150deg,#FFFEFB,#F6F1E4) !important}",
    "html body #page .fo-md-quote{font:420 14.5px/1.6 Fraunces,Georgia,serif;color:rgba(20,28,40,.78);margin:0 0 6px}",
    "html body #page .fo-md-sec.pundit>i{font:700 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22;font-style:normal}",
    "html body #page .fo-md-foot{display:flex;gap:10px;justify-content:space-between;margin-top:18px;flex-wrap:wrap}",
    "html body #page .fo-md-foot a{font:600 13px/1 Oswald,sans-serif;color:rgba(20,28,40,.65);background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:9px 16px;text-decoration:none}",
    "html body #page .fo-md-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5);text-decoration:none}",
    "@media(max-width:460px){html body #page .fo-md-mast h1{font-size:23px}html body #page .fo-md-xis{grid-template-columns:1fr}}"
  ].join("\n");
  function mount() {
    try {
      var s = document.getElementById("fo-md-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-md-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
  window.addEventListener("hashchange", function () {
    if ((location.hash || "").split("?")[0] === "#/matchday") setTimeout(foRenderMatchdayPage, 40);
  });
  window.foRenderMatchdayPage = foRenderMatchdayPage;
})();
