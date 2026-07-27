/* ============================================================================
   THE CLUB DOSSIER (#/team?c={country}&s={slot}) — every club's public face.

   A league of blanks has no strategy in it: you cannot fear a side you know
   nothing about, or plan a season against one. So this page tells you what a
   county's own handbook would - who plays for them, how old, what they cost,
   which hand, what they bowl, what the game has made of them, their careers,
   their form, their remaining fixtures and the trophies on the shelf.

   What stays private is the coaching sheet: the fifteen raw skill numbers,
   the training plan, the progress toward the next jump. You can see a man is
   a fine fast bowler; you cannot read his exact economy over the fence.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foClubPg) return; window.__foClubPg = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function cx() { return window.__foCxAPI || null; }
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function flagOf(rid) { try { return ART() + "flags/" + cx().flagFile(rid) + ".svg"; } catch (e) { return ""; } }
  function region(rid) { try { return (cx().regions() || []).filter(function (x) { return x.id === rid; })[0] || null; } catch (e) { return null; } }
  function natName(rid) { var r = region(rid); return (r && r.nm) || rid; }
  function accentOf(rid) { var r = region(rid); return (r && r.ac) || "#B44A22"; }
  function qs() {
    var q = {}, m = (location.hash || "").split("?")[1] || "";
    m.split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ""); });
    return q;
  }
  function claim() {
    try { return window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (e) { return null; }
  }
  function money(n) {
    n = Math.round(+n || 0);
    if (Math.abs(n) >= 1000000) return "$" + (n / 1000000).toFixed(n % 1000000 ? 2 : 0) + "m";
    if (Math.abs(n) >= 1000) return "$" + (n / 1000).toFixed(0) + "k";
    return "$" + n;
  }
  function num(n) { return String(Math.round(+n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  // the served pieces, each cached and each repainting the page as it lands
  var CLUB_CACHE = {}, SQ_CACHE = {}, HON_CACHE = null;
  function grab(url, cb) {
    fetch(SB_URL + url, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { cb(rows && rows[0] ? rows[0] : null); })
      .catch(function () { cb(null); });
  }
  function fetchClub(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (CLUB_CACHE[k]) { cb(CLUB_CACHE[k]); return; }
    grab("/rest/v1/world_clubs?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot + "&select=name,ground,is_boss,manager,identity",
      function (row) { if (row) CLUB_CACHE[k] = row; cb(row); });
  }
  function fetchSquad(cid, slot, cb) {
    var k = cid + ":" + slot;
    if (SQ_CACHE[k]) { cb(SQ_CACHE[k]); return; }
    grab("/rest/v1/world_squads?country_id=eq." + encodeURIComponent(cid) + "&slot=eq." + slot + "&select=players,wage_bill",
      function (row) { if (row) SQ_CACHE[k] = row; cb(row); });
  }
  function fetchHonours(cb) {
    if (HON_CACHE) { cb(HON_CACHE); return; }
    grab("/rest/v1/world_snapshots?key=eq.honours&select=body",
      function (row) { HON_CACHE = (row && row.body) || { seasons: {} }; cb(HON_CACHE); });
  }

  // ROLE, in the language of a scorecard rather than a database
  var ROLE_WORD = { opener: "Opener", top: "Top order", middle: "Middle order", finisher: "Finisher",
    allrounder: "All-rounder", keeper: "Wicketkeeper", seamer: "Seam bowler", pace: "Fast bowler",
    spinner: "Spinner", bowler: "Bowler", tail: "Lower order" };
  var TALENT_WORD = { anchor: "Anchor", safeHands: "Safe hands", bigHitter: "Big hitter", deathBowler: "Death bowler",
    newBall: "New ball", partnership: "Partnership builder", closer: "Closer", enforcer: "Enforcer",
    gun: "Gun fielder", nightwatch: "Nightwatchman", spinKing: "Spin king", swingKing: "Swing king",
    powerplay: "Powerplay specialist", clutch: "Clutch", ironman: "Iron man" };
  function roleWord(r) { return ROLE_WORD[r] || (r ? String(r).charAt(0).toUpperCase() + String(r).slice(1) : "Cricketer"); }
  function talentWord(t) { return TALENT_WORD[t] || String(t || "").replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }); }
  // a rival's nationality flag, by the nation names the generator uses
  var NAT_ID = { England: "eng", Australia: "aus", India: "sub", Pakistan: "pak", "South Africa": "rsa",
    "New Zealand": "nzl", "Sri Lanka": "slk", "West Indies": "win", Ireland: "ire", Netherlands: "ned",
    Zimbabwe: "zim", Afghanistan: "afg", Bangladesh: "bgd", Nepal: "nep", Scotland: "sco", Wales: "wal",
    Kenya: "ken", "United States": "usa", USA: "usa", Canada: "can" };
  function natFlag(n) { var id = NAT_ID[n]; return id ? flagOf(id) : ""; }

  window.foRenderClubPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foClubCss();
    try { document.body.classList.remove("fo-ov-on", "fo-boss-on", "fo-scb-on", "fo-drs-on", "fo-wt-on", "fo-lore-on"); } catch (e) {}
    var q = qs(), cid = q.c || "eng", slot = parseInt(q.s || "0", 10) || 0;
    var cl = claim();
    var isMine = !!(cl && cl.country === cid && cl.slot === slot);
    var tab = q.t || "squad";

    var lg = null; try { lg = window.__foWorldLg ? window.__foWorldLg.get(cid) : null; } catch (e) {}
    try { if (window.__foWorldLg) window.__foWorldLg.want(cid, function () { if ((location.hash || "").indexOf("#/team") === 0) window.foRenderClubPage(); }); } catch (e) {}
    var rk = null; try { rk = JSON.parse(localStorage.getItem("fo_world_rk") || "null"); } catch (e) {}

    var paint = function (info, sq, hon) {
      var ac = accentOf(cid);
      var name = (info && info.name) || (lg && (lg.table || []).filter(function (t) { return t.slot === slot; })[0] || {}).name;
      if (!name) { try { name = ((window.__foWorldNames && window.__foWorldNames.get(cid)) || {})[slot]; } catch (eN) {} }
      if (!name) {
        try {
          var sd = (window.__foPlanet && window.__foPlanet.sidesOf(cid) || []).filter(function (x) { return x.slot === slot; })[0];
          if (sd) name = sd.name;
        } catch (eS) {}
      }
      if (!name) name = "A world club";
      var boss = !!(info && info.is_boss);
      var mgr = info && info.manager;
      var ident = (info && info.identity) || {};
      if (ident && ident.colour) ac = ident.colour;
      var players = (sq && sq.players) || [];
      var bill = (sq && +sq.wage_bill) || 0;

      var rkRow = rk && rk.clubs ? rk.clubs.filter(function (x) { return x.country === cid && x.slot === slot; })[0] : null;
      var tRow = lg && lg.table ? (lg.table.filter(function (t) { return t.slot === slot; })[0] || null) : null;
      var pos = tRow && lg.table ? lg.table.indexOf(tRow) + 1 : 0;
      var ordn = function (n) { return n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th"); };

      // ---- form and the record, from the served results --------------------
      var form = "", played = [];
      if (lg && lg.results && name) {
        played = lg.results.filter(function (r) { return r.home === name || r.away === name; });
        form = played.slice(-5).reverse().map(function (r) {
          var w = r.winner === null ? "T" : r.winner === name ? "W" : "L";
          return "<i class='" + w.toLowerCase() + "'>" + w + "</i>";
        }).join("");
      }

      // ---- the fixtures still to come, off the same schedule the umpire uses
      var fixtures = [];
      try {
        var wt = window.__foWT, pl = window.__foPlanet;
        if (wt && wt.schedMirror && pl) {
          var cal = wt.serverCal(Date.now());
          var nmOv = (window.__foWorldNames && window.__foWorldNames.get(cid)) || {};
          var nameAt = function (s2) {
            if (nmOv[s2]) return nmOv[s2];
            var row = lg && lg.table ? lg.table.filter(function (t) { return t.slot === s2; })[0] : null;
            if (row) return row.name;
            try { return (pl.sidesOf(cid) || []).filter(function (x) { return x.slot === s2; })[0].name; } catch (e3) { return "?"; }
          };
          var rounds = wt.schedMirror(cid, Math.max(1, cal.seasonNo));
          for (var ri = Math.max(0, cal.round - 1); ri < rounds.length && fixtures.length < 5; ri++) {
            for (var fi = 0; fi < rounds[ri].length; fi++) {
              var pr = rounds[ri][fi];
              if (pr[0] !== slot && pr[1] !== slot) continue;
              var home = pr[0] === slot;
              fixtures.push({ round: ri + 1, home: home, foe: nameAt(home ? pr[1] : pr[0]),
                foeSlot: home ? pr[1] : pr[0], now: (ri + 1) === cal.round });
            }
          }
        }
      } catch (eFx) {}

      // ---- the names this season has made ----------------------------------
      var noted = [];
      if (lg && lg.stats) {
        (lg.stats.bat || []).forEach(function (x) { if (x.club === name) noted.push({ n: x.name, w: num(x.runs) + " runs", d: "at " + x.sr + " per hundred balls" }); });
        (lg.stats.bowl || []).forEach(function (x) { if (x.club === name) noted.push({ n: x.name, w: x.wkts + " wickets", d: "at " + x.econ + " an over" }); });
      }
      var shelf = [];
      if (hon && hon.seasons) Object.keys(hon.seasons).sort().forEach(function (sk) {
        var s5 = hon.seasons[sk], sn = sk.slice(1);
        if (s5.league && s5.league[cid] === name) shelf.push("&#127942; " + E(natName(cid)) + " champions &middot; Season " + sn);
        if (s5.championsCup === name) shelf.push("&#127942; CHAMPIONS CUP &middot; Season " + sn);
      });

      // ---- squad arithmetic a manager actually reads ------------------------
      var ages = players.map(function (p) { return +p.age || 0; }).filter(Boolean);
      var avgAge = ages.length ? (ages.reduce(function (a, b) { return a + b; }, 0) / ages.length).toFixed(1) : "—";
      var topRating = players.length ? players[0].rating : 0;
      var seam = players.filter(function (p) { return /pace|seam|medium|fast/i.test(p.type || p.bowl || ""); }).length;
      var spin = players.filter(function (p) { return /spin/i.test(p.type || p.bowl || ""); }).length;

      var crest = ""; try { if (boss) crest = cx().crest(cid) || ""; } catch (eC2) {}

      var mgrLine = mgr
        ? "<span class='fo-cp-mgr human'>&#9733; Managed by " + E(mgr) + "</span>"
        : boss ? "<span class='fo-cp-mgr'>The league's flagship &mdash; never for hire</span>"
        : "<span class='fo-cp-mgr'>Unmanaged &mdash; a steady club of the shires</span>";

      var statCells =
        "<div class='c'><i>World rank</i><b>" + (rkRow ? "#" + rkRow.rank : "&mdash;") + "</b><u>" + (rkRow ? num(rkRow.rating) + " rating" : "unrated") + "</u></div>" +
        "<div class='c'><i>League</i><b>" + (pos ? ordn(pos) : "&mdash;") + "</b><u>" + (tRow ? tRow.pts + " pts &middot; " + tRow.p + " played" : "not yet played") + "</u></div>" +
        "<div class='c'><i>Squad</i><b>" + (players.length || "&mdash;") + "</b><u>" + (ages.length ? "average " + avgAge : "") + "</u></div>" +
        "<div class='c'><i>Wage bill</i><b>" + (bill ? money(bill) : "&mdash;") + "</b><u>a round</u></div>";

      // ---- the roster, the part a rival came for ---------------------------
      var rosterRows = players.map(function (p, i) {
        var fl = natFlag(p.nat);
        var car = p.career || {};
        var line = [];
        if (car.runs) line.push(num(car.runs) + " runs" + (car.hs ? " &middot; best " + car.hs : ""));
        if (car.wkts) line.push(car.wkts + " wickets" + (car.bb ? " &middot; best " + car.bb.w + "-" + car.bb.r : ""));
        if (!line.length) line.push(car.m ? car.m + " matches, still writing his first line" : "Yet to play a first-class ball");
        var tags = (p.talents || []).slice(0, 2).map(function (t) { return "<em>" + E(talentWord(t)) + "</em>"; }).join("");
        return "<div class='fo-cp-p" + (i === 0 ? " star" : "") + "'>" +
          "<div class='fo-cp-pn'>" +
          (fl ? "<img src='" + fl + "' alt='' onerror=\"this.style.display='none'\">" : "") +
          "<b>" + E(p.name) + "</b>" + (p.keeper ? "<s>wk</s>" : "") + "</div>" +
          "<div class='fo-cp-pm'>" + (+p.age || "?") + " &middot; " + E(roleWord(p.role)) +
          " &middot; " + (p.hand === "L" ? "left hand" : "right hand") +
          (p.bowl && p.bowl !== "Does not bowl" ? " &middot; " + E(p.bowl).toLowerCase() : "") + "</div>" +
          "<div class='fo-cp-pc'>" + line.join(" &nbsp;&middot;&nbsp; ") + "</div>" +
          "<div class='fo-cp-pw'>" + E(p.exp || "") + " &middot; " + E(p.form || "") + " form &middot; " + E(p.fatigue || "") + "</div>" +
          (tags ? "<div class='fo-cp-pt'>" + tags + "</div>" : "") +
          "<div class='fo-cp-pr'><b>" + num(p.rating) + "</b><u>" + money(p.wage) + " a round</u>" +
          (p.value ? "<u>valued " + money(p.value) + "</u>" : "") + "</div>" +
          "</div>";
      }).join("");

      var resultRows = played.slice(-8).reverse().map(function (r) {
        var w = r.winner === null ? "t" : r.winner === name ? "w" : "l";
        var foe = r.home === name ? r.away : r.home;
        return "<div class='fo-cp-r " + w + "'><i>R" + r.round + "</i>" +
          "<b>" + (r.home === name ? "h" : "a") + " v " + E(foe) + "</b>" +
          "<span>" + E(r.text || "") + "</span></div>";
      }).join("");

      var fxRows = fixtures.map(function (f) {
        return "<a class='fo-cp-r fx' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + f.foeSlot + "'>" +
          "<i>R" + f.round + "</i><b>" + (f.home ? "home" : "away") + " v " + E(f.foe) + "</b>" +
          "<span>" + (f.now ? "today" : "to come") + "</span></a>";
      }).join("");

      var TABS = [["squad", "The squad"], ["record", "Record"], ["shelf", "Honours"]];
      var tabBar = "<div class='fo-cp-tabs'>" + TABS.map(function (t) {
        return "<a class='" + (tab === t[0] ? "on" : "") + "' href='#/team?c=" + encodeURIComponent(cid) + "&s=" + slot + "&t=" + t[0] + "'>" + t[1] + "</a>";
      }).join("") + "</div>";

      var bodyHTML;
      if (tab === "record") {
        bodyHTML =
          (form ? "<div class='fo-cp-card'><h3>Form <span>latest first</span></h3><div class='fo-cp-form'>" + form + "</div></div>" : "") +
          "<div class='fo-cp-card'><h3>Results</h3>" + (resultRows || "<div class='fo-cp-note dim'>No cricket played yet this season.</div>") + "</div>" +
          "<div class='fo-cp-card'><h3>Fixtures</h3>" + (fxRows || "<div class='fo-cp-note dim'>The season's fixtures are not out yet.</div>") + "</div>" +
          (noted.length ? "<div class='fo-cp-card'><h3>Names the season made</h3>" + noted.map(function (n) {
            return "<div class='fo-cp-note'><b>" + E(n.n) + "</b> &mdash; " + n.w + " <u>" + n.d + "</u></div>"; }).join("") + "</div>" : "");
      } else if (tab === "shelf") {
        bodyHTML = "<div class='fo-cp-card'><h3>The trophy shelf</h3>" +
          (shelf.length ? shelf.map(function (s) { return "<div class='fo-cp-note'>" + s + "</div>"; }).join("")
            : "<div class='fo-cp-note dim'>Bare, for now. Every season writes the next line.</div>") + "</div>" +
          "<div class='fo-cp-card'><h3>The ground</h3><div class='fo-cp-note'>" + E((info && info.ground) || "A ground of their own") + "</div>" +
          "<div class='fo-cp-note dim'>Home advantage is real: their groundsman prepares the strip.</div></div>" +
          (ident && ident.motto ? "<div class='fo-cp-card'><h3>The motto</h3><div class='fo-cp-note'>&ldquo;" + E(ident.motto) + "&rdquo;</div></div>" : "");
      } else {
        bodyHTML =
          "<div class='fo-cp-card'><h3>The squad <span>" + players.length + " men &middot; strongest first</span></h3>" +
          (rosterRows || "<div class='fo-cp-note dim'>The squad list is on its way from the World Service&hellip;</div>") +
          "</div>" +
          (players.length ? "<div class='fo-cp-card'><h3>How they are built</h3>" +
            "<div class='fo-cp-note'>Top man rated <b>" + num(topRating) + "</b> &middot; average age <b>" + avgAge + "</b></div>" +
            "<div class='fo-cp-note'><b>" + seam + "</b> seam &middot; <b>" + spin + "</b> spin &middot; <b>" +
            players.filter(function (p) { return p.keeper; }).length + "</b> keeper</div>" +
            "<div class='fo-cp-note dim'>Their raw skills stay in their own coaching book. Teamsheets go public an hour before every match &mdash; that is your scouting window.</div>" +
            "</div>" : "");
      }

      if (window.__foSideArt) window.__foSideArt(cid);
      page.innerHTML = "<div class='fo-cp' style='--cac:" + E(ac) + "'>" +
        "<div class='fo-cp-in'>" +
        "<a class='fo-cp-back' href='#/nation?n=" + encodeURIComponent(cid) + "'>&lsaquo; " + E(natName(cid)) + " league</a>" +
        "<div class='fo-cp-hero'>" +
        (crest ? "<img class='fo-cp-crest' src='" + crest + "' alt='' onerror=\"this.style.display='none'\">"
               : "<img class='fo-cp-flag' src='" + flagOf(cid) + "' alt='' onerror=\"this.style.display='none'\">") +
        "<div class='fo-cp-id'><div class='fo-cp-k'>" + E(natName(cid)) + (boss ? " &middot; THE FLAGSHIP" : "") + (isMine ? " &middot; YOUR CLUB" : "") + "</div>" +
        "<h1>" + E(name) + "</h1>" +
        "<p>" + E((info && info.ground) || "") + "</p>" + mgrLine + "</div></div>" +
        (isMine ? "<div id='fo-cp-mine'></div>" : "") +
        "<div class='fo-cp-stats'>" + statCells + "</div>" +
        tabBar + bodyHTML +
        (!isMine && cl ? "<a class='fo-cp-cta' href='#/worldclub'>&#9876; Challenge " + E(name) + " to a friendly &rsaquo;</a>" : "") +
        "<div class='fo-cp-foot'><a href='#/rankings'>The world rankings &rsaquo;</a><a href='#/nation?n=" + encodeURIComponent(cid) + "'>The league table &rsaquo;</a></div>" +
        "</div></div>";

      // YOUR OWN CLUB WEARS THE NAME YOU GAVE IT. The world is the authority,
      // so when this device calls the club something else, say so plainly and
      // let one tap settle it either way.
      if (isMine) {
        try {
          var localNm = ""; try { localNm = (userTeam() || {}).name || ""; } catch (eU) {}
          var host = document.getElementById("fo-cp-mine");
          if (host && localNm && name && localNm !== name) {
            host.className = "fo-cp-warn";
            host.innerHTML = "<b>Two names, one club.</b> The world calls you <u>" + E(name) +
              "</u>; this device calls you <u>" + E(localNm) + "</u>." +
              "<div class='fo-cp-warnb'><button type='button' id='fo-cp-push'>Christen it " + E(localNm) + "</button>" +
              "<button type='button' class='ghost' id='fo-cp-pull'>Keep " + E(name) + "</button></div>";
            var push = document.getElementById("fo-cp-push");
            if (push) push.addEventListener("click", function () {
              push.disabled = true; push.textContent = "Telling the world…";
              if (window.__foWorldRename) window.__foWorldRename(localNm, function (ok, err) {
                if (!ok) {
                  push.disabled = false; push.textContent = "Christen it " + localNm;
                  try {
                    var why = host.querySelector(".fo-cp-why");
                    if (!why) { why = document.createElement("div"); why.className = "fo-cp-why"; host.appendChild(why); }
                    why.textContent = String(err || "the world would not take that name");
                  } catch (eW) {}
                  return;
                }
                delete CLUB_CACHE[cid + ":" + slot];
                window.foRenderClubPage();
              });
            });
            var pull = document.getElementById("fo-cp-pull");
            if (pull) pull.addEventListener("click", function () {
              try {
                var t = userTeam(); if (t) { t.name = name; if (typeof saveGame === "function") saveGame(false); }
              } catch (eT) {}
              window.foRenderClubPage();
            });
          } else if (host) {
            host.className = "fo-cp-mineact";
            host.innerHTML = "<a href='#/training'>The nets &rsaquo;</a><a href='#/worldclub'>Club office &rsaquo;</a><a href='#/squad'>Your squad &rsaquo;</a>";
          }
        } catch (eMine) {}
      }
    };

    paint(null, null, null);
    fetchClub(cid, slot, function (info) { paint(info, SQ_CACHE[cid + ":" + slot], HON_CACHE); });
    fetchSquad(cid, slot, function (sq) { paint(CLUB_CACHE[cid + ":" + slot], sq, HON_CACHE); });
    fetchHonours(function (hon) { paint(CLUB_CACHE[cid + ":" + slot], SQ_CACHE[cid + ":" + slot], hon); });
  };

  function foClubCss() {
    if (document.getElementById("fo-cp-css")) return;
    var s = document.createElement("style"); s.id = "fo-cp-css";
    s.textContent = [
      ".fo-cp{min-height:70vh;--cac:#B44A22}",
      // the country stands in the page margins (see __foSideArt); the page
      // itself is clean paper
      ".fo-cp-in{position:relative;max-width:680px;margin:0 auto;padding:20px 14px 80px}",
      "html body #page .fo-cp-back{display:inline-block;font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important;margin-bottom:10px}",
      ".fo-cp-hero{display:flex;gap:14px;align-items:flex-start;background:#0E1A2F;border-radius:18px;border-bottom:3px solid var(--cac);padding:18px 16px;margin-bottom:12px;box-shadow:0 18px 40px rgba(14,26,47,.22)}",
      ".fo-cp-flag{width:44px;height:30px;object-fit:cover;border-radius:4px;flex:none;margin-top:4px}",
      ".fo-cp-crest{width:52px;height:52px;object-fit:contain;flex:none}",
      ".fo-cp-k{font:700 9.5px/1.5 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#E8894A}",
      ".fo-cp-id h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(26px,6.4vw,34px);color:#FFFEFC;margin:4px 0 2px;line-height:1.05}",
      ".fo-cp-id p{font:italic 400 12.5px/1.4 'Fraunces',Georgia,serif;color:rgba(255,254,252,.65);margin:0 0 7px}",
      ".fo-cp-mgr{display:inline-block;font:600 10.5px/1.4 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,254,252,.55)}",
      ".fo-cp-mgr.human{color:#F3D37A}",
      // the two-names notice
      ".fo-cp-warn{background:#FFF6E8;border:1px solid rgba(200,84,47,.35);border-radius:14px;padding:12px 14px;margin-bottom:10px;font:500 12.5px/1.6 Inter,sans-serif;color:#141C28}",
      ".fo-cp-warn u{text-decoration:none;font-weight:700}",
      ".fo-cp-warnb{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}",
      ".fo-cp-warnb button{font:700 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#FFFEFC;background:linear-gradient(180deg,#E8894A,#C8542F);border:0;border-radius:10px;padding:11px 14px;cursor:pointer}",
      ".fo-cp-warnb button.ghost{background:#FFFEFC;color:#141C28;border:1px solid rgba(20,28,40,.2)}",
      ".fo-cp-why{margin-top:8px;font:italic 420 12.5px/1.5 'Fraunces',Georgia,serif;color:#B23230}",
      ".fo-cp-mineact{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap}",
      "html body #page .fo-cp-mineact a{font:600 11px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#B44A22 !important;background:#FFFEFC;border:1px solid rgba(20,28,40,.14);border-radius:999px;padding:9px 14px;text-decoration:none !important}",
      ".fo-cp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}",
      ".fo-cp-stats .c{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:11px 8px;text-align:center}",
      ".fo-cp-stats .c i{display:block;font:700 8px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
      ".fo-cp-stats .c b{display:block;font:700 19px/1.2 Oswald,sans-serif;color:#141C28;margin-top:4px;font-variant-numeric:tabular-nums}",
      ".fo-cp-stats .c u{display:block;text-decoration:none;font:400 9px/1.3 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px}",
      ".fo-cp-tabs{display:flex;gap:6px;margin-bottom:10px}",
      "html body #page .fo-cp-tabs a{flex:1;text-align:center;font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.6) !important;background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:11px 6px;text-decoration:none !important}",
      "html body #page .fo-cp-tabs a.on{color:#FFFEFC !important;background:var(--cac);border-color:transparent}",
      ".fo-cp-card{background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:14px;padding:12px 14px;margin-bottom:10px}",
      ".fo-cp-card h3{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:15px;color:#141C28;margin:0 0 9px}",
      ".fo-cp-card h3 span{font:600 9px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.4);margin-left:6px}",
      // the roster line: a man, what he is, what he has done, what he costs
      ".fo-cp-p{position:relative;padding:10px 92px 10px 0;border-top:1px solid rgba(20,28,40,.08)}",
      ".fo-cp-p:first-of-type{border-top:0}",
      ".fo-cp-p.star .fo-cp-pn b{color:#B44A22}",
      ".fo-cp-pn{display:flex;align-items:center;gap:6px}",
      ".fo-cp-pn img{width:17px;height:12px;object-fit:cover;border-radius:2px;flex:none}",
      ".fo-cp-pn b{font:600 13.5px/1.3 Inter,sans-serif;color:#141C28}",
      ".fo-cp-pn s{text-decoration:none;font:700 8px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#FFFEFC;background:#4A6C8C;border-radius:4px;padding:3px 4px}",
      ".fo-cp-pm{font:500 11.5px/1.5 Inter,sans-serif;color:rgba(20,28,40,.62);margin-top:2px}",
      ".fo-cp-pc{font:italic 420 11.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.72);margin-top:2px}",
      ".fo-cp-pw{font:600 9.5px/1.4 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(20,28,40,.45);margin-top:3px}",
      ".fo-cp-pt{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px}",
      ".fo-cp-pt em{font-style:normal;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--cac);background:rgba(180,74,34,.09);border-radius:5px;padding:4px 6px}",
      ".fo-cp-pr{position:absolute;top:10px;right:0;width:86px;text-align:right}",
      ".fo-cp-pr b{display:block;font:700 15px/1 Oswald,sans-serif;color:#141C28;font-variant-numeric:tabular-nums}",
      ".fo-cp-pr u{display:block;text-decoration:none;font:400 9px/1.35 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px}",
      ".fo-cp-form{display:flex;gap:6px}",
      ".fo-cp-form i{font-style:normal;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;font:700 12px/1 Oswald,sans-serif;color:#FFFEFC}",
      ".fo-cp-form i.w{background:#177A57}.fo-cp-form i.l{background:#B23230}.fo-cp-form i.t{background:#8a6d3b}",
      ".fo-cp-r{display:grid;grid-template-columns:34px minmax(0,1fr);gap:2px 8px;padding:8px 0;border-top:1px solid rgba(20,28,40,.08);text-decoration:none;color:#141C28}",
      ".fo-cp-r:first-of-type{border-top:0}",
      ".fo-cp-r i{grid-row:span 2;font:700 10px/1 Oswald,sans-serif;letter-spacing:.06em;color:rgba(20,28,40,.4);font-style:normal;padding-top:2px}",
      ".fo-cp-r b{font:600 12.5px/1.4 Inter,sans-serif}",
      ".fo-cp-r span{font:italic 420 11.5px/1.4 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6)}",
      ".fo-cp-r.w b{color:#177A57}.fo-cp-r.l b{color:#B23230}",
      "html body #page a.fo-cp-r.fx:hover b{color:#B44A22}",
      ".fo-cp-note{font:500 12.5px/1.6 Inter,sans-serif;color:#141C28;padding:2px 0}",
      ".fo-cp-note u{text-decoration:none;font:italic 420 11.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.55)}",
      ".fo-cp-note.dim{font-style:italic;font-family:'Fraunces',Georgia,serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-cp-cta{display:block;text-align:center;font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:linear-gradient(180deg,#E8894A,#C8542F);border-radius:12px;padding:14px;text-decoration:none !important;box-shadow:0 10px 26px rgba(200,84,47,.3);margin:4px 0 10px}",
      ".fo-cp-foot{display:flex;justify-content:space-between;gap:10px;padding:2px 4px}",
      "html body #page .fo-cp-foot a{font:600 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22 !important;text-decoration:none !important}",
      "@media(max-width:420px){.fo-cp-stats{grid-template-columns:1fr 1fr}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
