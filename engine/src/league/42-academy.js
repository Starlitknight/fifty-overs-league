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
  // the umpire's own rules, mirrored so the page can say them out loud
  function cap(lv) { return 2 + Math.max(1, Math.min(5, lv || 2)); }
  function stepCost(lv) { return lv * 60000; }

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
  // how far along a boy is, in words a chairman would use
  function promiseWord(n) {
    return n >= 78 ? "ready" : n >= 70 ? "close" : n >= 62 ? "coming" : "raw";
  }
  function ageWord(a) {
    return a <= 17 ? "still at school" : a === 18 ? "first year" : a === 19 ? "second year" : "final year";
  }

  // --------------------------------------------------------------------------
  window.foRenderAcademyPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Walking down to the academy&hellip;</div>");
    if (!jwt()) {
      page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>Your academy belongs to your club in the served world. Sign in to the account that holds it and the colts will be here waiting.</p>" +
        "<a class='fo-ac-btn' href='#/worldclub'>Your world club &rsaquo;</a></div>");
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!st || st.signedIn === false) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>Sign in first - the academy is your club's, and the world keeps it.</p></div>");
        return;
      }
      if (!st.claim) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>You don't hold a club in the served world yet. Claim one and its academy comes with it, boys and all.</p>" +
          "<a class='fo-ac-btn' href='#/worldclub'>Claim a club &rsaquo;</a></div>");
        return;
      }
      render(page, st);
      // the Colts Cup arrives a beat later; the room does not wait for it
      snapshot("colts/" + st.claim.country).then(function (cup) {
        var box = document.getElementById("fo-ac-cup");
        if (box) box.innerHTML = cupHTML(cup, st.claim.club);
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
      "<div class='fo-ac-hero'><div class='fo-ac-k'>The academy</div>" +
      "<h1>The Colts</h1>" +
      "<p>Boys arrive on their own, age on their own, and walk into your first team at twenty-one whether you were watching or not. What you decide is how good a place they learn in.</p></div>" +
      body +
      "<div class='fo-ac-foot'><a href='#/worldclub'>&lsaquo; Your world club</a><a href='#/training'>The nets &rsaquo;</a></div>" +
      "</div></div>";
  }

  function render(page, st) {
    var lv = Math.max(1, Math.min(5, +st.academy || 2));
    var colts = st.youth || [];
    var room = cap(lv), spare = Math.max(0, room - colts.length);
    var bank = Number(st.bank || 0);
    var pips = "";
    for (var i = 1; i <= 5; i++) pips += "<s class='fo-ac-pip" + (i <= lv ? " on" : "") + "'></s>";

    var up = lv >= 5
      ? "<div class='fo-ac-note'>Level five. There is nowhere further to go; the county sends people to look at yours now.</div>"
      : (function () {
          var cost = stepCost(lv), can = bank >= cost;
          return "<div class='fo-ac-uprow'>" +
            "<div><b>Level " + (lv + 1) + "</b><i>Room for " + cap(lv + 1) + " boys &middot; better cricketers through the door &middot; " +
              money((lv + 1) * UPKEEP) + " a round to run</i></div>" +
            "<button type='button' class='fo-ac-btn" + (can ? "" : " off") + "' data-fo-acup='" + (lv + 1) + "'" + (can ? "" : " disabled") + ">" +
              (can ? "Build it &middot; " + money(cost) : "Needs " + money(cost)) + "</button></div>";
        })();

    var list = colts.length
      ? "<div class='fo-ac-grid'>" + colts.map(coltCard).join("") + "</div>"
      : "<div class='fo-ac-note'>Nobody on the books this minute. The academy takes a boy in as soon as there is a bed for him - come back after the next round.</div>";

    page.innerHTML = shell(
      "<div class='fo-ac-card'><h3>" + E(st.claim.club || "Your club") + "<span>" + E(st.claim.country || "") + "</span></h3>" +
        "<div class='fo-ac-lvl'><div class='fo-ac-pips'>" + pips + "</div>" +
          "<div class='fo-ac-lvt'><b>Level " + lv + "</b><i>" + colts.length + " of " + room + " beds taken" +
          (spare ? " &middot; " + spare + " free" : " &middot; full") + "</i></div></div>" +
        "<div class='fo-ac-money'>" +
          "<div><i>Upkeep</i><b>" + money(lv * UPKEEP) + "</b><u>a round</u></div>" +
          "<div><i>Treasury</i><b>" + money(bank) + "</b><u>at the bank</u></div>" +
        "</div>" + up +
      "</div>" +
      "<div class='fo-ac-card'><h3>On the books<span>" + colts.length + "</span></h3>" + list +
        "<div class='fo-ac-note'>A colt costs you nothing in wages - the academy's upkeep covers him. He starts earning the day he takes a senior shirt.</div>" +
      "</div>" +
      "<div class='fo-ac-card' id='fo-ac-cup'><h3>The Colts Cup</h3>" +
        "<div class='fo-ac-note'>Reading the boys&rsquo; table&hellip;</div></div>" +
      "<div class='fo-ac-card'><h3>How it works</h3>" +
        "<p class='fo-ac-p'>The umpire runs the academy on the same clock as the cricket. A boy joins when there is a bed free. At the turn of the season every colt gets a year older, and any who reach <b>twenty-one</b> are handed a senior shirt automatically - no button, no deadline, nothing to miss while you're asleep.</p>" +
        "<p class='fo-ac-p'>Bring one up early if you want him, or let him go to make room. Whatever he learned in the academy he keeps; what he never keeps is the nets he was never at, so a boy who comes up in your third season doesn't inherit two seasons of somebody else's work.</p>" +
        "<p class='fo-ac-p'>Rivals can see what level your academy is - a building is a building - but never who is inside it.</p>" +
      "</div>");

    var upBtn = page.querySelector("[data-fo-acup]");
    if (upBtn) upBtn.addEventListener("click", function () {
      if (upBtn.disabled) return;
      upBtn.disabled = true; upBtn.textContent = "Building…";
      rpc("world_set_academy", { p_level: +upBtn.getAttribute("data-fo-acup") })
        .then(function () { window.foRenderAcademyPage(); })
        .catch(function (e) { upBtn.disabled = false; upBtn.textContent = "Try again"; alert(String(e.message).slice(0, 160)); });
    });
    page.querySelectorAll("[data-fo-colt]").forEach(function (b) {
      b.addEventListener("click", function () {
        var nm = b.getAttribute("data-fo-colt"), act = b.getAttribute("data-fo-act");
        if (act === "release" && !confirm("Let " + nm + " go? He leaves the club for good.")) return;
        b.disabled = true; b.textContent = act === "promote" ? "Signing…" : "Releasing…";
        rpc("world_colt", { p_name: nm, p_action: act })
          .then(function () {
            // the senior squad has changed, so the world's copy of it must be
            // re-read before any other page shows the old fifteen
            try { if (window.__foWorldRefreshPlan) window.__foWorldRefreshPlan(); } catch (e2) {}
            window.foRenderAcademyPage();
          })
          .catch(function (e) { b.disabled = false; b.textContent = act === "promote" ? "Bring up" : "Release"; alert(String(e.message).slice(0, 160)); });
      });
    });
  }

  // THE COLTS CUP: nine fixtures, one on every second league round, played by
  // the umpire from a side nobody picks. Nothing to submit, nothing to miss.
  function cupHTML(cup, myClub) {
    var head = "<h3>The Colts Cup<span>" + (cup && cup.roundsPlayed ? cup.roundsPlayed + " of " + cup.rounds : "not started") + "</span></h3>";
    if (!cup || !cup.results || !cup.results.length) {
      return head + "<div class='fo-ac-note'>The boys' first fixture comes on the second round of the league season. Nine matches, one every other round, and the whole country's academies in it.</div>";
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
      (card ? "<div class='fo-ac-sub'>Your boys, lately</div>" + card : "") + lead +
      "<div class='fo-ac-note'>The side picks itself &mdash; your colts and the youngest men on the staff &mdash; so there is no teamsheet to file and nothing to lose by being asleep.</div>";
  }

  function coltCard(p) {
    var pr = Math.max(0, Math.min(100, Math.round(+p.promise || 0)));
    var o = ovrOf(p);
    return "<div class='fo-ac-colt'>" +
      "<div class='fo-ac-ch'><b>" + E(p.name) + "</b>" + (o == null ? "" : "<u>" + o + "</u>") + "</div>" +
      "<div class='fo-ac-cm'>" + E(roleOf(p)) + " &middot; " + E(p.age || 18) + ", " + E(ageWord(+p.age || 18)) + "</div>" +
      "<div class='fo-ac-bar'><s style='width:" + pr + "%'></s></div>" +
      "<div class='fo-ac-cm'><em>" + E(promiseWord(pr)) + "</em> &middot; " + pr + "% of the cricketer he'll be</div>" +
      // what he has actually done in the Colts Cup, if he has done anything
      (p.colts && p.colts.m ? "<div class='fo-ac-cm cup'>" + p.colts.m + (p.colts.m === 1 ? " cap" : " caps") +
        " &middot; " + p.colts.runs + " runs" + (p.colts.hs ? " (" + p.colts.hs + " best)" : "") +
        (p.colts.wkts ? " &middot; " + p.colts.wkts + " wkts" : "") + "</div>" : "") +
      "<div class='fo-ac-cbtns'>" +
        "<button type='button' class='fo-ac-mini' data-fo-colt='" + E(p.name) + "' data-fo-act='promote'>Bring up</button>" +
        "<button type='button' class='fo-ac-mini ghost' data-fo-colt='" + E(p.name) + "' data-fo-act='release'>Release</button>" +
      "</div></div>";
  }

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
      "html body #page .fo-ac-foot{display:flex;justify-content:space-between;gap:10px;margin-top:16px;font:600 11px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      "html body #page .fo-ac-foot a{color:#B04A2C !important;text-decoration:none !important}",
      "@media(max-width:480px){html body #page .fo-ac-hero h1{font-size:25px}html body #page .fo-ac-grid{grid-template-columns:1fr 1fr;gap:8px}html body #page .fo-ac-colt{padding:9px 10px}html body #page .fo-ac-ch b{font-size:12.5px}" +
        "html body #page .fo-ac-tbl td.nrr,html body #page .fo-ac-tbl th.nrr{display:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
