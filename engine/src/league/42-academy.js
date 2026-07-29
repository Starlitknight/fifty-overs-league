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
    if (!isFinite(n)) return "\u2014";   // plain text: the ledger escapes what it prints
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  // the umpire's own rules, mirrored so the page can say them out loud
  function cap(lv) { return 2 + Math.max(1, Math.min(5, lv || 2)); }
  function stepCost(lv) { return lv * 60000; }

  function ovrOf(p) {
    try { if (window.AL) return window.AL.ovr(p); } catch (e) {}
    try { if (typeof window.foPkOvr === "function") return window.foPkOvr(p); } catch (e2) {}
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

  function A() { return window.AL || null; }
  function on() { return (location.hash || "").split("?")[0] === "#/academy"; }
  function mast(al) {
    return al.head("The academy", "The Colts",
      "Boys arrive on their own, age on their own, and walk into your first team at twenty-one whether you were " +
      "watching or not. What you decide is how good a place they learn in.");
  }
  function fail(page, al, title, line, href, label) {
    page.innerHTML = al.page({ body: mast(al) + al.empty(title, line) +
      (href ? '<p style="margin-top:16px"><a class="al-btn al-btn--primary" href="' + href + '">' + label + "</a></p>" : "") });
  }

  window.foRenderAcademyPage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}
    page.innerHTML = al.page({ body: mast(al) + al.empty("Walking down to the academy", "Reading the books.") });
    if (!jwt()) {
      fail(page, al, "Your academy belongs to your club",
        "Sign in to the account that holds it and the colts will be here waiting.", "#/worldclub", "Your world club");
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!on()) return;
      if (!st || st.signedIn === false) { fail(page, al, "Sign in first", "The academy is your club's, and the world keeps it."); return; }
      if (!st.claim) {
        fail(page, al, "You don't hold a club yet", "Claim one and its academy comes with it, boys and all.",
          "#/worldclub", "Claim a club");
        return;
      }
      render(page, st);
      // the Colts Cup arrives a beat later; the room does not wait for it
      snapshot("colts/" + st.claim.country).then(function (cup) {
        var box = document.getElementById("fo-ac-cup");
        if (box && on()) box.innerHTML = cupHTML(A(), cup, st.claim.club);
      });
    }).catch(function (e) {
      if (!on()) return;
      fail(page, al, "The world could not be reached",
        String((e && e.message) || e).slice(0, 120) + ". The boys are training regardless — try again in a minute.");
    });
  };

  function render(page, st) {
    var al = A(); if (!al || !on()) return;
    var lv = Math.max(1, Math.min(5, +st.academy || 2));
    var colts = st.youth || [];
    var room = cap(lv), spare = Math.max(0, room - colts.length);
    var bank = Number(st.bank || 0);
    var body = mast(al) + al.subnav("academy");

    // ---- the one decision: how good a place they learn in ------------------
    var canUp = lv < 5 && bank >= stepCost(lv);
    body += al.decide({
      kind: lv < 5 ? "act" : "done",
      title: "Level " + lv + " · " + colts.length + " of " + room + " beds taken" + (spare ? " · " + spare + " free" : " · full"),
      note: lv >= 5
        ? "Level five. There is nowhere further to go; the county sends people to look at yours now."
        : money(lv * UPKEEP) + " a round to run · level " + (lv + 1) + " costs " + money(stepCost(lv)) +
          " and sleeps " + cap(lv + 1),
    });

    if (lv < 5) {
      body += al.sec("Build it up",
        "<p>Level " + (lv + 1) + " gives room for " + cap(lv + 1) + " boys, better cricketers through the door, and " +
        money((lv + 1) * UPKEEP) + " a round to run.</p>" +
        '<p><button type="button" class="al-btn ' + (canUp ? "al-btn--primary" : "") + '" data-fo-acup="' + (lv + 1) + '"' +
        (canUp ? "" : " disabled") + ">" + (canUp ? "Build it · " + money(stepCost(lv)) : "Needs " + money(stepCost(lv))) +
        "</button></p>" +
        al.ledger([["Upkeep now", money(lv * UPKEEP) + " a round"], ["In the bank", money(bank)]]));
    }

    // ---- the boys -----------------------------------------------------------
    body += al.sec("On the books · " + colts.length, colts.length
      ? '<div class="al-players">' + colts.map(function (p) { return colt(al, p); }).join("") + "</div>" +
        '<p class="al-read">A colt costs you nothing in wages — the upkeep covers him. He starts earning the day he ' +
        "takes a senior shirt.</p>"
      : al.empty("Nobody on the books this minute",
          "The academy takes a boy in as soon as there is a bed for him. Come back after the next round."));

    body += '<section class="al-sec" id="fo-ac-cup"><div class="al-sec__head"><h2>The Colts Cup</h2></div>' +
      '<p class="al-read">Reading the boys&rsquo; table&hellip;</p></section>';

    body += al.sec("How it works",
      "<p>The umpire runs the academy on the same clock as the cricket. A boy joins when there is a bed free. At the turn " +
      "of the season every colt gets a year older, and any who reach <b>twenty-one</b> are handed a senior shirt " +
      "automatically — no button, no deadline, nothing to miss while you're asleep.</p>" +
      "<p>Bring one up early if you want him, or let him go to make room. Whatever he learned in the academy he keeps; " +
      "what he never keeps is the nets he was never at.</p>" +
      "<p>Rivals can see what level your academy is — a building is a building — but never who is inside it.</p>");

    page.innerHTML = al.page({ body: body });

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

  // a colt is a row: who he is, how far along he is, and the two calls a
  // manager can make about him
  function colt(al, p) {
    var pr = Math.max(0, Math.min(100, Math.round(+p.promise || 0)));
    var o = ovrOf(p);
    var caps = (p.colts && p.colts.m)
      ? " · " + p.colts.m + (p.colts.m === 1 ? " cap" : " caps") + ", " + p.colts.runs + " runs" +
        (p.colts.wkts ? ", " + p.colts.wkts + " wkts" : "")
      : "";
    return '<div class="al-prow al-prow--static al-prow--face">' +
      '<span class="al-prow__no">' + (p.age || 18) + "</span>" + al.face(p) +
      '<span class="al-prow__who"><b>' + E(p.name) + "</b><i>" + E(roleOf(p)) + " · " + E(ageWord(+p.age || 18)) +
        " · " + E(promiseWord(pr)) + caps + "</i>" + al.meter(pr, "warm") + "</span>" +
      '<span class="al-prow__rate">' + (o == null ? "&mdash;" : o) + "</span>" +
      '<span class="al-prow__act">' +
        '<button type="button" class="al-btn" data-fo-colt="' + E(p.name) + '" data-fo-act="promote">Bring up</button>' +
        '<button type="button" class="al-btn" data-fo-colt="' + E(p.name) + '" data-fo-act="release">Release</button>' +
      "</span></div>";
  }

  // THE COLTS CUP: nine fixtures, one on every second league round, played by
  // the umpire from a side nobody picks. Nothing to submit, nothing to miss.
  function cupHTML(al, cup, myClub) {
    var head = '<div class="al-sec__head"><h2>The Colts Cup</h2><a href="#/academy">' +
      (cup && cup.roundsPlayed ? cup.roundsPlayed + " of " + cup.rounds : "not started") + "</a></div>";
    if (!al) return head;
    if (!cup || !cup.results || !cup.results.length) {
      return head + al.empty("The boys have not started",
        "Their first fixture comes on the second round of the league season. Nine matches, one every other round, and " +
        "the whole country's academies in it.");
    }
    var rows = cup.table.map(function (t, i) {
      return "<tr" + (t.name === myClub ? " class='al-you'" : "") + "><td class='al-pos'>" + (i + 1) + "</td>" +
        "<td class='l al-club'>" + E(t.name) + (t.name === myClub ? "<span class='al-you__tag'>YOU</span>" : "") + "</td>" +
        "<td>" + t.p + "</td><td>" + t.w + "</td><td class='al-s'>" + t.l + "</td>" +
        "<td>" + (t.nrr > 0 ? "+" : "") + t.nrr.toFixed(2) + "</td><td class='al-pts'>" + t.pts + "</td></tr>";
    }).join("");
    var mine = cup.results.filter(function (r) { return r.home === myClub || r.away === myClub; }).slice(-4).reverse();
    var sc = function (x) { return x ? x.r + "/" + x.w : "—"; };
    var recent = mine.length ? al.ledger(mine.map(function (r) {
      var won = r.winner === myClub, tied = r.winner === null;
      return [r.home + " v " + r.away, sc(r.hs) + " · " + sc(r.as), tied ? "" : won ? "pos" : "neg"];
    })) : "";
    var lead = (cup.runs && cup.runs[0])
      ? '<p class="al-read">Leading the cup: ' + E(cup.runs[0].name) + " " + cup.runs[0].runs + " runs" +
        (cup.wickets && cup.wickets[0] ? " · " + E(cup.wickets[0].name) + " " + cup.wickets[0].wkts + " wickets" : "") + "</p>"
      : "";
    return head +
      "<div class='al-tblwrap'><table class='al-tbl'><thead><tr><th></th><th class='l'>Club</th>" +
      "<th>P</th><th>W</th><th class='al-s'>L</th><th>NRR</th><th>Pts</th></tr></thead><tbody>" +
      rows + "</tbody></table></div>" + recent + lead +
      '<p class="al-read">The side picks itself — your colts and the youngest men on the staff — so there is no ' +
      "teamsheet to file and nothing to lose by being asleep.</p>";
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
