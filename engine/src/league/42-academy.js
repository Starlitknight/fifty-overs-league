/* ============================================================================
   THE ACADEMY (#/academy) — the colts, and what a club pays to bring them on.

   Every club in the served world runs one, bot or human. The umpire works it:
   a boy arrives whenever there is room, every colt ages a year at the season
   rollover, and one who reaches twenty-one is handed a senior shirt whether
   his manager was watching or not. A club nobody logs into still produces
   cricketers - which is the whole point, because half this world is asleep
   when the other half is playing.

   What a MANAGER decides is only ever two things: how good an academy to pay
   for, and whether a boy is ready early. Both go through the world's own
   RPCs, which re-validate everything; this page could lie all it liked and
   the server would shrug.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foAcad) return; window.__foAcad = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var UPKEEP = 900;                       // a level costs this much a round
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (jwt() || SB_ANON), "content-type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw new Error((d && (d.message || d.hint)) || t || ("HTTP " + r.status));
      return d;
    }); });
  }
  function sel(path) {
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; });
  }
  function snapshot(key) {
    return sel("world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body")
      .then(function (rows) { return rows && rows[0] && rows[0].body; })
      .catch(function () { return null; });
  }
  function money(v) {
    var n = Number(v);
    if (!isFinite(n)) return "&mdash;";
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  // THE UMPIRE'S OWN RULES, mirrored so the page can say them out loud before
  // the manager spends anything. docs/ACADEMY.md is the authority and
  // server/economy.mjs is the arithmetic; these must not drift from either.
  var UPKEEP = [0, 6000, 14000, 26000, 44000, 70000];   // by level, a round
  var BUILD = [0, 400000, 900000, 1800000, 3200000];    // from level n to n+1
  var LEAVE_AT = 21;

  // A WAGE IS PRINTED IN FULL. money() rounds to the nearest thousand, which is
  // right for a transfer fee and wrong here: a boy at 1,310 a round and a boy
  // at 1,490 are a different decision, and both read "$1k".
  function wage(v) {
    var n = Math.round(Number(v) || 0);
    return "$" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function ovrOf(p) {
    try { if (typeof window.foPkOvr === "function") return window.foPkOvr(p); } catch (e) {}
    return null;
  }
  function roleOf(p) {
    var r = String((p && p.role) || "").toLowerCase();
    if (p && p.keeper) return "Wicketkeeper";
    if (/open/.test(r)) return "Opener";
    if (/allround|all-round/.test(r)) return "All-rounder";
    if (/seam|pace|spin|bowl/.test(r)) return "Bowler";
    if (/finish|middle|anchor|bat/.test(r)) return "Batter";
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Cricketer";
  }
  // HOW LONG YOU HAVE HIM. This is the read the whole academy turns on: a boy
  // walks at twenty-one, so his age is not decoration - it is the number of
  // seasons of nets you are buying, and it is why a sixteen-year-old rated
  // lower than a twenty-year-old is very often the better signing.
  function yearsLeft(age) { return Math.max(0, LEAVE_AT - (+age || 18)); }
  function yearsWord(age) {
    var n = yearsLeft(age);
    return n <= 0 ? "leaves at the turn of the year"
         : n === 1 ? "one season left in the academy"
         : n + " seasons left in the academy";
  }

  // the fifteen skills, grouped the way a coach would read them out
  var SKILLS = [
    ["Batting", ["vsPace", "vsSpin", "rotation", "power", "temperament"]],
    ["Bowling", ["wicket", "economy", "discipline", "moveTurn", "variation", "stamina"]],
    ["In the field", ["fielding", "catching", "keeping", "stumping"]]
  ];
  var SKILL_NM = {
    vsPace: "against pace", vsSpin: "against spin", rotation: "strike rotation",
    power: "power", temperament: "temperament", wicket: "wicket-taking",
    economy: "economy", discipline: "discipline", moveTurn: "movement", variation: "variation",
    stamina: "stamina", fielding: "ground fielding", catching: "catching",
    keeping: "keeping", stumping: "stumping"
  };
  function skillGrid(p) {
    var sk = (p && p.skills) || {}, out = "";
    for (var g = 0; g < SKILLS.length; g++) {
      var rows = "";
      for (var i = 0; i < SKILLS[g][1].length; i++) {
        var k = SKILLS[g][1][i], v = +sk[k];
        if (!isFinite(v)) continue;
        rows += "<div class='fo-ac-sk'><i>" + E(SKILL_NM[k] || k) + "</i>" +
          "<s><u style='width:" + Math.max(2, Math.min(100, v)) + "%'></u></s><b>" + Math.round(v) + "</b></div>";
      }
      if (rows) out += "<div class='fo-ac-skg'><h5>" + E(SKILLS[g][0]) + "</h5>" + rows + "</div>";
    }
    return out ? "<div class='fo-ac-skills'>" + out + "</div>" : "";
  }

  // --------------------------------------------------------------------------
  window.foRenderAcademyPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Walking down to the academy&hellip;</div>");
    if (!jwt()) {
      page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>" +
        (window.__foAuthPending
          ? "Reaching your club&hellip; the boys will be here in a moment."
          : "Your academy belongs to your club in the served world. Sign in to the account that holds it and the boys will be here waiting.") +
        "</p></div>");
      return;
    }
    rpc("world_my_academy").then(function (ac) {
      if (!ac || ac.signedIn === false) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>Sign in first - the academy is your club&rsquo;s, and the world keeps it.</p></div>");
        return;
      }
      if (!ac.country) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>You don&rsquo;t hold a club in the served world yet. One is claimed for you on the next load, and its academy comes with it, boys and all.</p></div>");
        return;
      }
      render(page, ac);
      // the Colts Cup arrives a beat later; the room does not wait for it
      snapshot("colts/" + ac.country).then(function (cup) {
        var box = document.getElementById("fo-ac-cup");
        if (box) box.innerHTML = cupHTML(cup, ac.club);
      });
    }).catch(function (e) {
      page.innerHTML = shell("<div class='fo-ac-note'>The world could not be reached (" + E(String(e.message).slice(0, 90)) +
        "). The boys are training regardless - try again in a minute.</div>");
    });
  };

  function shell(body) {
    // the room keeps its own table: the club that matters here is the one in
    // the served world, not whatever the device calls home
    return "<div class='fo-ac' data-fo-owntable><div class='fo-ac-in'>" +
      "<div class='fo-ac-hero'><div class='fo-ac-k'>Your club</div>" +
      "<h1>Youth Academy</h1></div>" +
      body +
      "<div class='fo-ac-foot'><a href='#/squad'>&lsaquo; The squad</a><a href='#/training'>The nets &rsaquo;</a></div>" +
      "</div></div>";
  }

  // THE SCOUTING TRIP. One a rest day, a nation of your choosing, and the boy
  // is shown in full before you decide - because the decision IS the reading.
  function scoutHTML(ac) {
    var pend = ac.pending;
    if (pend && pend.recruit) return recruitHTML(pend, ac);

    var nations = ac.nations || [];
    var opts = nations.map(function (n) {
      return "<option value='" + E(n.id) + "'" + (n.id === ac.country ? " selected" : "") + ">" +
        E(n.name) + (Number(n.fee) ? " · " + money(n.fee) : " · home, free") + "</option>";
    }).join("");

    if (!ac.restDay) {
      return "<div class='fo-ac-note'><b>There is cricket on today.</b> The scout travels on rest days &mdash; " +
        (ac.restDays || []).length + " of them a season &mdash; and comes back with one boy each time.</div>";
    }
    if (ac.scoutedToday) {
      return "<div class='fo-ac-note'><b>Today&rsquo;s trip is made.</b> The scout is out again on the next rest day.</div>";
    }
    return "<div class='fo-ac-scout'>" +
      "<div class='fo-ac-srow'><select id='fo-ac-nat' class='fo-ac-sel'>" + opts + "</select>" +
      "<button type='button' class='fo-ac-btn' id='fo-ac-go'>Scout a recruit</button></div>" +
      "<div class='fo-ac-note thin'>A nation leans toward what it is known for &mdash; South Africa turns out quicks, India spinners and wristy batsmen &mdash; but every nation makes every kind of cricketer, and a gem is no likelier in one than another. You are buying a type, not a better shop.</div>" +
      "</div>";
  }

  // THE BOY ON THE TABLE. Everything about him, and two buttons.
  function recruitHTML(pend, ac) {
    var p = pend.recruit, o = ovrOf(p);
    var nat = (ac.nations || []).filter(function (n) { return n.id === pend.nation; })[0];
    return "<div class='fo-ac-offer'>" +
      "<div class='fo-ac-oh'><div><b>" + E(p.name) + "</b>" +
        "<i>" + E(roleOf(p)) + " &middot; " + E(p.age) + " years old &middot; found in " + E((nat && nat.name) || pend.nation) + "</i></div>" +
        (o == null ? "" : "<u>" + o + "</u>") + "</div>" +
      "<div class='fo-ac-orow'>" +
        "<span><i>Wage if signed</i><b>" + wage(p.wage) + "</b><u>a round, every round</u></span>" +
        "<span><i>He is yours for</i><b>" + yearsLeft(p.age) + "</b><u>" + (yearsLeft(p.age) === 1 ? "season" : "seasons") + "</u></span>" +
      "</div>" +
      skillGrid(p) +
      "<div class='fo-ac-note thin'>What you see is what there is. Nothing is hidden and nothing is promised: the nets work on these numbers at the ordinary rate, faster because he is young, and four seasons of them move a cricketer by about a tenth. Judge him on what he already is, against how old he is.</div>" +
      "<div class='fo-ac-obtns'>" +
        "<button type='button' class='fo-ac-btn' data-fo-rec='sign'>Sign him to the academy</button>" +
        "<button type='button' class='fo-ac-btn ghost' data-fo-rec='release'>Let him go</button>" +
      "</div></div>";
  }

  function render(page, ac) {
    var lv = Math.max(1, Math.min(5, +ac.level || 2));
    var boys = ac.youth || [];
    var bank = Number(ac.bank || 0);
    var floor = +ac.floor || 15;
    var pips = "";
    for (var i = 1; i <= 5; i++) pips += "<s class='fo-ac-pip" + (i <= lv ? " on" : "") + "'></s>";

    var up = lv >= 5
      ? "<div class='fo-ac-note'>Level five. There is nowhere further to go; the county sends people to look at yours now.</div>"
      : (function () {
          var cost = Number(ac.nextCost || BUILD[lv]), can = bank >= cost && bank >= 0;
          return "<div class='fo-ac-uprow'>" +
            "<div><b>Level " + (lv + 1) + "</b><i>Better cricketers through the door, more often &middot; " +
              money(ac.nextUpkeep || UPKEEP[lv + 1]) + " a round to run</i></div>" +
            "<button type='button' class='fo-ac-btn" + (can ? "" : " off") + "' data-fo-acup='" + (lv + 1) + "'" + (can ? "" : " disabled") + ">" +
              (can ? "Build it &middot; " + money(cost) : "Needs " + money(cost)) + "</button></div>";
        })();

    // WHO IS ABOUT TO WALK. The warning the design promised, a week out - except
    // it is shown every day he is twenty, because a page a manager may not open
    // is not a warning at all.
    var leaving = boys.filter(function (y) { return yearsLeft(y.age) <= 1; });
    var warn = leaving.length
      ? "<div class='fo-ac-warn'><b>" + leaving.length + (leaving.length === 1 ? " boy leaves" : " boys leave") +
        " at the turning of the year.</b> " + E(leaving.map(function (y) { return y.name; }).join(", ")) +
        " &mdash; twenty-one, and gone from the world unless you hand " +
        (leaving.length === 1 ? "him a senior contract" : "them senior contracts") + " first.</div>"
      : "";

    var shortBy = Math.max(0, floor - boys.length);
    var bar = shortBy
      ? "<div class='fo-ac-warn cup'><b>You cannot field a Colts Cup side.</b> The competition asks for " + floor +
        " men under twenty-one and you have " + boys.length + ". " + shortBy +
        (shortBy === 1 ? " more boy" : " more boys") + " and the tie is yours to play; short of it, it is forfeited in public.</div>"
      : "";

    var list = boys.length
      ? "<div class='fo-ac-grid'>" + boys.slice().sort(function (a, b) {
          return (a.age || 0) - (b.age || 0) || ((ovrOf(b) || 0) - (ovrOf(a) || 0));
        }).map(function (p) { return coltCard(p, ac); }).join("") + "</div>"
      : "<div class='fo-ac-note'>Nobody on the books. Scout a recruit on the next rest day.</div>";

    page.innerHTML = shell(
      warn + bar +
      "<div class='fo-ac-card'><h3>The scout<span>" + ((ac.restDays || []).length) + " rest days a season</span></h3>" +
        scoutHTML(ac) + "</div>" +
      "<div class='fo-ac-card'><h3>" + E(ac.club || "Your club") + "<span>Level " + lv + "</span></h3>" +
        "<div class='fo-ac-lvl'><div class='fo-ac-pips'>" + pips + "</div>" +
          "<div class='fo-ac-lvt'><b>Level " + lv + "</b><i>" + boys.length + " on the books &middot; " +
          (shortBy ? shortBy + " short of a Colts Cup side" : "a Colts Cup side and " + (boys.length - floor) + " to spare") +
          "</i></div></div>" +
        "<div class='fo-ac-money'>" +
          "<div><i>Upkeep</i><b>" + money(ac.upkeep || UPKEEP[lv]) + "</b><u>a round</u></div>" +
          "<div><i>Their wages</i><b>" + wage(boys.reduce(function (t, y) { return t + (+y.wage || 0); }, 0)) + "</b><u>a round</u></div>" +
          "<div><i>Treasury</i><b>" + money(bank) + "</b><u>at the bank</u></div>" +
        "</div>" + up +
      "</div>" +
      "<div class='fo-ac-card'><h3>On the books<span>" + boys.length + " of " + floor + "</span></h3>" + list + "</div>" +
      "<div class='fo-ac-card' id='fo-ac-cup'><h3>The Colts Cup</h3>" +
        "<div class='fo-ac-note'>Reading the boys&rsquo; table&hellip;</div></div>" +
      "");

    var go = document.getElementById("fo-ac-go");
    if (go) go.addEventListener("click", function () {
      var sel2 = document.getElementById("fo-ac-nat");
      go.disabled = true; go.textContent = "Travelling…";
      rpc("world_scout", { p_nation: sel2 ? sel2.value : ac.country })
        .then(function () { window.foRenderAcademyPage(); })
        .catch(function (e) { go.disabled = false; go.textContent = "Scout a recruit"; alert(String(e.message).slice(0, 200)); });
    });
    page.querySelectorAll("[data-fo-rec]").forEach(function (b) {
      b.addEventListener("click", function () {
        var act = b.getAttribute("data-fo-rec");
        if (act === "release" && !confirm("Let him go? He walks away and you will not see him again.")) return;
        b.disabled = true; b.textContent = act === "sign" ? "Signing…" : "Letting him go…";
        rpc("world_recruit", { p_action: act })
          .then(function () { window.foRenderAcademyPage(); })
          .catch(function (e) { b.disabled = false; window.foRenderAcademyPage(); alert(String(e.message).slice(0, 200)); });
      });
    });
    var upBtn = page.querySelector("[data-fo-acup]");
    if (upBtn) upBtn.addEventListener("click", function () {
      if (upBtn.disabled) return;
      upBtn.disabled = true; upBtn.textContent = "Building…";
      rpc("world_set_academy", { p_level: +upBtn.getAttribute("data-fo-acup") })
        .then(function () { window.foRenderAcademyPage(); })
        .catch(function (e) { upBtn.disabled = false; upBtn.textContent = "Try again"; alert(String(e.message).slice(0, 200)); });
    });
    page.querySelectorAll("[data-fo-colt]").forEach(function (b) {
      b.addEventListener("click", function () {
        var nm = b.getAttribute("data-fo-colt"), act = b.getAttribute("data-fo-act");
        if (act === "release" && !confirm("Let " + nm + " go? He leaves the club for good.")) return;
        if (act === "promote" && !confirm("Hand " + nm + " a senior contract for " + money(ac.promoteFee) + "?")) return;
        b.disabled = true; b.textContent = act === "promote" ? "Signing…" : "Releasing…";
        rpc("world_colt", { p_name: nm, p_action: act })
          .then(function () {
            // the senior squad has changed, so the world's copy of it must be
            // re-read before any other page shows the old fifteen
            try { if (window.__foWorldRefreshPlan) window.__foWorldRefreshPlan(); } catch (e2) {}
            window.foRenderAcademyPage();
          })
          .catch(function (e) { b.disabled = false; b.textContent = act === "promote" ? "Senior shirt" : "Release"; alert(String(e.message).slice(0, 200)); });
      });
    });
  }

  // THE COLTS CUP: the boys' own competition, played in its own week.
  function cupHTML(cup, myClub) {
    var head = "<h3>The Colts Cup<span>" + (cup && cup.roundsPlayed ? cup.roundsPlayed + " of " + cup.rounds : "not started") + "</span></h3>";
    if (!cup || !cup.results || !cup.results.length) {
      return head + "<div class='fo-ac-note'>Week four of the season belongs to the academies: the league stands down and every club in the country goes into one hat. You must be able to name fifteen men under twenty-one, or the tie is forfeited.</div>";
    }
    var rows = cup.table.map(function (t, i) {
      return "<tr" + (t.name === myClub ? " class='me'" : "") + "><td>" + (i + 1) + "</td><td class='nm'>" + E(t.name) + "</td>" +
        "<td>" + t.p + "</td><td>" + t.w + "</td><td>" + t.l + "</td><td class='pt'>" + t.pts + "</td>" +
        "<td class='nrr'>" + (t.nrr > 0 ? "+" : "") + t.nrr.toFixed(2) + "</td></tr>";
    }).join("");
    var mine = cup.results.filter(function (r) { return r.home === myClub || r.away === myClub; }).slice(-4).reverse();
    var card = mine.map(function (r) {
      var won = r.winner === myClub, tied = r.winner === null;
      var sc = function (s) { return s ? s.r + "/" + s.w : "&mdash;"; };
      return "<div class='fo-ac-res'><i class='" + (tied ? "t" : won ? "w" : "l") + "'>" + (tied ? "T" : won ? "W" : "L") + "</i>" +
        "<b>" + E(r.home) + "</b><u>" + sc(r.hs) + "</u><em>v</em><b>" + E(r.away) + "</b><u>" + sc(r.as) + "</u></div>";
    }).join("");
    var lead = (cup.runs && cup.runs[0])
      ? "<div class='fo-ac-note'>Leading the cup: <b>" + E(cup.runs[0].name) + "</b> " + cup.runs[0].runs + " runs" +
        (cup.wickets && cup.wickets[0] ? ", <b>" + E(cup.wickets[0].name) + "</b> " + cup.wickets[0].wkts + " wickets" : "") + ".</div>"
      : "";
    return head +
      "<div class='fo-ac-tw'><table class='fo-ac-tbl'><thead><tr><th></th><th class='nm'>Club</th><th>P</th><th>W</th><th>L</th><th class='pt'>Pts</th><th class='nrr'>NRR</th></tr></thead><tbody>" +
        rows + "</tbody></table></div>" +
      (card ? "<div class='fo-ac-sub'>Your boys, lately</div>" + card : "") + lead;
  }

  function coltCard(p, ac) {
    var o = ovrOf(p), left = yearsLeft(p.age);
    return "<div class='fo-ac-colt" + (left <= 1 ? " going" : "") + "'>" +
      "<div class='fo-ac-ch'><b>" + E(p.name) + "</b>" + (o == null ? "" : "<u>" + o + "</u>") + "</div>" +
      "<div class='fo-ac-cm'>" + E(roleOf(p)) + " &middot; " + E(p.age || 18) +
        (p.from ? " &middot; " + E(p.from) : "") + "</div>" +
      "<div class='fo-ac-cm" + (left <= 1 ? " going" : "") + "'>" + E(yearsWord(p.age)) +
        " &middot; " + wage(p.wage) + " a round</div>" +
      // what he has actually done in the Colts Cup, if he has done anything
      (p.colts && p.colts.m ? "<div class='fo-ac-cm cup'>" + p.colts.m + (p.colts.m === 1 ? " cap" : " caps") +
        " &middot; " + p.colts.runs + " runs" + (p.colts.hs ? " (" + p.colts.hs + " best)" : "") +
        (p.colts.wkts ? " &middot; " + p.colts.wkts + " wkts" : "") + "</div>" : "") +
      "<div class='fo-ac-cbtns'>" +
        "<button type='button' class='fo-ac-mini' data-fo-colt='" + E(p.name) + "' data-fo-act='promote'>Senior shirt</button>" +
        "<button type='button' class='fo-ac-mini ghost' data-fo-colt='" + E(p.name) + "' data-fo-act='release'>Release</button>" +
      "</div></div>";
  }

  // The academy was the first of the world rooms, and its plate-and-cards
  // became the house style for the rest of them. Other rooms call this and
  // add only what is their own, so there is one stylesheet, not five.
  window.__foRoomCss = function () { css(); };
  function css() {
    if (document.getElementById("fo-ac-css")) return;
    var s = document.createElement("style"); s.id = "fo-ac-css";
    s.textContent = [
      "html body #page .fo-ac{max-width:680px;margin:26px auto 44px;padding:0 14px;color:#141C28}",
      "html body #page .fo-ac-hero{background:linear-gradient(150deg,#0B1D3A,#07162E 70%) !important;border-radius:22px;padding:24px 26px 22px;color:#FFFEFC;box-shadow:0 22px 50px rgba(7,22,46,.35);border-bottom:3px solid #C95532}",
      "html body #page .fo-ac-k{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.24em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-ac-hero h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:30px;letter-spacing:-.015em;margin:8px 0;color:#FFFEFC;line-height:1.05}",
      "html body #page .fo-ac-hero p{font:italic 420 13px/1.6 'Fraunces',Georgia,serif;color:rgba(255,254,252,.78);margin:0;max-width:52ch}",
      "html body #page .fo-ac-card{margin-top:14px;background:#FFFEFC;border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:14px 16px}",
      "html body #page .fo-ac-card h3{margin:0 0 10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#8A6A1F;display:flex;align-items:center;gap:8px}",
      "html body #page .fo-ac-card h3 span{margin-left:auto;font-size:9px;color:rgba(20,28,40,.45);letter-spacing:.12em}",
      "html body #page .fo-ac-p{font:400 13px/1.6 Inter,sans-serif;color:rgba(20,28,40,.72);margin:0 0 10px}",
      "html body #page .fo-ac-p:last-child{margin-bottom:0}",
      "html body #page .fo-ac-note{font:italic 400 12.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.55);margin-top:10px}",
      "html body #page .fo-ac-lvl{display:flex;align-items:center;gap:12px;flex-wrap:wrap}",
      "html body #page .fo-ac-pips{display:flex;gap:5px}",
      "html body #page .fo-ac-pip{display:block;width:18px;height:18px;border-radius:5px;background:rgba(20,28,40,.1);border:1px solid rgba(20,28,40,.14)}",
      "html body #page .fo-ac-pip.on{background:linear-gradient(180deg,#E8B96A,#C08A2E);border-color:rgba(138,106,31,.6)}",
      "html body #page .fo-ac-lvt b{display:block;font:700 17px/1.1 Oswald,sans-serif;color:#141C28}",
      "html body #page .fo-ac-lvt i{display:block;font-style:normal;font:500 11.5px/1.4 Inter,sans-serif;color:rgba(20,28,40,.55);margin-top:2px}",
      "html body #page .fo-ac-money{display:flex;gap:10px;margin:12px 0 4px}",
      "html body #page .fo-ac-money>div{flex:1;background:rgba(255,255,255,.85);border:1px solid rgba(20,28,40,.12);border-radius:12px;padding:9px 11px;min-width:0}",
      "html body #page .fo-ac-money i{display:block;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
      "html body #page .fo-ac-money b{display:block;font:700 17px/1.2 Oswald,sans-serif;color:#141C28;margin-top:4px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-money u{display:block;text-decoration:none;font:500 10px/1.2 Inter,sans-serif;color:rgba(20,28,40,.45);margin-top:1px}",
      "html body #page .fo-ac-uprow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:11px;border-top:1px solid rgba(20,28,40,.08)}",
      "html body #page .fo-ac-uprow>div{flex:1 1 190px;min-width:0}",
      "html body #page .fo-ac-uprow b{display:block;font:700 13px/1.2 Oswald,sans-serif;letter-spacing:.04em;color:#141C28}",
      "html body #page .fo-ac-uprow i{display:block;font-style:normal;font:400 11.5px/1.45 Inter,sans-serif;color:rgba(20,28,40,.55);margin-top:3px}",
      "html body #page .fo-ac-btn{display:inline-block;font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:linear-gradient(180deg,#E8894A,#C8542F) !important;border:0 !important;border-radius:999px !important;padding:11px 17px !important;cursor:pointer;text-decoration:none !important}",
      "html body #page .fo-ac-btn.off{background:rgba(20,28,40,.12) !important;color:rgba(20,28,40,.5) !important;cursor:default}",
      "html body #page .fo-ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}",
      "html body #page .fo-ac-colt{background:rgba(250,246,238,.9);border:1px solid rgba(20,28,40,.12);border-radius:13px;padding:11px 12px}",
      "html body #page .fo-ac-ch{display:flex;align-items:baseline;gap:8px}",
      "html body #page .fo-ac-ch b{flex:1;min-width:0;font:600 13.5px/1.25 Inter,sans-serif;color:#141C28;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-ac-ch u{flex:none;text-decoration:none;font:700 13px/1 Oswald,sans-serif;color:#8A6A1F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-cm{font:500 10.5px/1.45 Inter,sans-serif;color:rgba(20,28,40,.55);margin-top:3px}",
      "html body #page .fo-ac-cm em{font-style:normal;font-weight:700;color:#B44A22;text-transform:uppercase;letter-spacing:.08em;font-size:9.5px}",
      "html body #page .fo-ac-bar{height:6px;border-radius:999px;background:rgba(20,28,40,.09);margin:8px 0 5px;overflow:hidden}",
      "html body #page .fo-ac-bar s{display:block;height:100%;text-decoration:none;background:linear-gradient(90deg,#E8B96A,#C8542F)}",
      "html body #page .fo-ac-cbtns{display:flex;gap:6px;margin-top:9px}",
      // THE SCOUT, THE OFFER AND THE WARNINGS
      "html body #page .fo-ac-srow{display:flex;gap:8px;align-items:stretch;flex-wrap:wrap}",
      "html body #page .fo-ac-sel{flex:1 1 190px;min-width:0;font:500 13px/1.2 Inter,sans-serif;color:#141C28;background:#FFFEFC;border:1px solid rgba(20,28,40,.2);border-radius:10px;padding:10px 11px;cursor:pointer}",
      "html body #page .fo-ac-note.thin{font-size:11.5px;line-height:1.55;color:rgba(20,28,40,.55);margin-top:9px}",
      "html body #page .fo-ac-warn{background:#FFF6DA;border:1px solid rgba(200,84,47,.28);border-left:3px solid #C8542F;border-radius:11px;padding:11px 13px;margin:0 0 12px;font:500 12.5px/1.55 Inter,sans-serif;color:#5A3410}",
      "html body #page .fo-ac-warn b{display:block;font:700 13px/1.4 Inter,sans-serif;color:#141C28;margin-bottom:2px}",
      "html body #page .fo-ac-warn.cup{background:#F3F6FA;border-left-color:#2F5FC8;color:#20304A}",
      "html body #page .fo-ac-offer{background:#FFFEFC;border:1px solid rgba(20,28,40,.14);border-radius:13px;padding:13px 14px}",
      "html body #page .fo-ac-oh{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}",
      "html body #page .fo-ac-oh b{display:block;font:600 19px/1.15 Fraunces,Georgia,serif;color:#141C28}",
      "html body #page .fo-ac-oh i{display:block;margin-top:3px;font:500 11.5px/1.4 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.55)}",
      "html body #page .fo-ac-oh u{flex:0 0 auto;text-decoration:none;font:700 20px/1 Oswald,sans-serif;color:#C8542F;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-orow{display:flex;gap:10px;margin:12px 0 4px}",
      "html body #page .fo-ac-orow span{flex:1;background:rgba(250,246,238,.9);border-radius:10px;padding:9px 10px}",
      "html body #page .fo-ac-orow i{display:block;font:700 8.5px/1 Oswald,sans-serif;font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-ac-orow b{display:block;margin-top:4px;font:700 17px/1 Oswald,sans-serif;color:#141C28;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-orow u{display:block;margin-top:2px;text-decoration:none;font:500 10.5px/1.3 Inter,sans-serif;color:rgba(20,28,40,.5)}",
      "html body #page .fo-ac-skills{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px;margin:12px 0 2px}",
      "html body #page .fo-ac-skg h5{margin:0 0 5px;font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-ac-sk{display:flex;align-items:center;gap:7px;margin:0 0 3px}",
      "html body #page .fo-ac-sk i{flex:0 0 86px;font:500 10.5px/1.3 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.6)}",
      "html body #page .fo-ac-sk s{flex:1;height:5px;border-radius:999px;background:rgba(20,28,40,.09);text-decoration:none;overflow:hidden}",
      "html body #page .fo-ac-sk s u{display:block;height:100%;text-decoration:none;background:linear-gradient(90deg,#E8B96A,#C8542F)}",
      "html body #page .fo-ac-sk b{flex:0 0 20px;text-align:right;font:600 10.5px/1 Inter,sans-serif;color:#141C28;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-obtns{display:flex;gap:8px;margin-top:13px;flex-wrap:wrap}",
      "html body #page .fo-ac-obtns .fo-ac-btn{flex:1 1 150px}",
      "html body #page .fo-ac-btn.ghost{background:transparent !important;border:1px solid rgba(20,28,40,.22) !important;color:rgba(20,28,40,.62) !important}",
      "html body #page .fo-ac-colt.going{border-color:rgba(200,84,47,.35);background:#FFF9EC}",
      "html body #page .fo-ac-cm.going{color:#C8542F;font-weight:600}",
      "@media(max-width:480px){html body #page .fo-ac-skills{grid-template-columns:1fr}html body #page .fo-ac-sk i{flex-basis:78px}" +
        "html body #page .fo-ac-cbtns{flex-direction:column}html body #page .fo-ac-mini{padding:8px 4px !important}}",
      "html body #page .fo-ac-mini{flex:1;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;color:#FFFEFC !important;background:#141C28 !important;border:0 !important;border-radius:999px !important;padding:9px 4px !important;cursor:pointer}",
      "html body #page .fo-ac-mini.ghost{background:transparent !important;border:1px solid rgba(20,28,40,.22) !important;color:rgba(20,28,40,.6) !important}",
      "html body #page .fo-ac-cm.cup{color:#8A6A1F;font-weight:600;margin-top:5px}",
      "html body #page .fo-ac-sub{margin:14px 0 7px;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-ac-tw{overflow-x:auto;-webkit-overflow-scrolling:touch}",
      "html body #page .fo-ac-tbl{width:100%;border-collapse:collapse;font:500 12px/1.3 Inter,sans-serif;font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-tbl th{font:700 8.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.42);text-align:right;padding:0 0 7px}",
      "html body #page .fo-ac-tbl th.nm{text-align:left}",
      "html body #page .fo-ac-tbl td{text-align:right;padding:6px 0;border-top:1px solid rgba(20,28,40,.07);color:rgba(20,28,40,.7);white-space:nowrap}",
      "html body #page .fo-ac-tbl td.nm{text-align:left;width:99%;padding-right:12px;color:#141C28;white-space:nowrap}",
      "html body #page .fo-ac-tbl tr{border:0 !important;box-shadow:none !important;background:transparent}",
      "html body #page .fo-ac-tbl td,html body #page .fo-ac-tbl th{border-left:0 !important;border-right:0 !important}",
      "html body #page .fo-ac-tbl td.pt{font-weight:700;color:#141C28;padding-left:10px}",
      "html body #page .fo-ac-tbl td.nrr,html body #page .fo-ac-tbl th.nrr{padding-left:10px;color:rgba(20,28,40,.45)}",
      "html body #page .fo-ac-tbl tr.me td{background:rgba(232,185,106,.16)}",
      "html body #page .fo-ac-tbl tr.me td.nm{font-weight:700}",
      "html body #page .fo-ac-res{display:flex;align-items:center;gap:6px;padding:6px 0;border-top:1px solid rgba(20,28,40,.07);font:500 11.5px/1.3 Inter,sans-serif;flex-wrap:wrap}",
      "html body #page .fo-ac-res i{flex:none;font-style:normal;font:700 9px/1 Oswald,sans-serif;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border-radius:5px;color:#FFFEFC;background:#B23230}",
      "html body #page .fo-ac-res i.w{background:#177A57}",
      "html body #page .fo-ac-res i.t{background:#8a6d3b}",
      "html body #page .fo-ac-res b{color:#141C28;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page .fo-ac-res u{text-decoration:none;color:rgba(20,28,40,.55);font-variant-numeric:tabular-nums}",
      "html body #page .fo-ac-res em{font-style:normal;color:rgba(20,28,40,.35);font-size:10px}",
      "html body #page .fo-ac-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:18px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      // a room door is a thumb target, not a caption: 44px of it, with the
      // hit area the phone actually needs
      "html body #page .fo-ac-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;margin:0 -14px;border-radius:12px;color:#B04A2C !important;text-decoration:none !important}",
      "html body #page .fo-ac-foot a:hover{background:rgba(176,74,44,.09)}",
      "html body #page .fo-ac-foot a:active{background:rgba(176,74,44,.16)}",
      "@media(max-width:480px){html body #page .fo-ac-hero h1{font-size:25px}html body #page .fo-ac-grid{grid-template-columns:1fr 1fr;gap:8px}html body #page .fo-ac-colt{padding:9px 10px}html body #page .fo-ac-ch b{font-size:12.5px}" +
        "html body #page .fo-ac-tbl td.nrr,html body #page .fo-ac-tbl th.nrr{display:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
