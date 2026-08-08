/* ============================================================================
   THE FIFTY OVERS GAZETTE (#/paper) — the newspaper wave. Every morning the
   world prints one front page, and it is the same front page on every phone
   in every timezone, because every line of it is derived:

   - THE LEAD: the user club's latest league match written up as a proper
     story - headline, drop cap, the numbers, the star performers, a pundit
     on the record. Before the first result it runs a preview instead.
   - AROUND THE WORLD: the wire from the living planet (module 27) - other
     nations' results, cup shocks, title winners, farewells.
   - TABLE TALK: where the league stands and what it means.
   - THE WEEK'S BEST: the finest innings and figures of the latest round.
   - NOTES FROM THE NETS: training pops, reported like club gossip.
   - LETTERS + SMALL ADVERTISEMENTS: seeded lore. Same day, same letters.

   Deterministic by construction: prose is assembled from saved results,
   playerHist, the planet's wire and FNV-1a-seeded phrase pools keyed on the
   world day - never from Math.random. The module writes nothing.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foGz) return; window.__foGz = 1;

  function E(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready() { return typeof App !== "undefined" && App && typeof GD !== "undefined" && GD && GD.teams && typeof userTeam === "function"; }
  function h32(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function pick(pool, seed) { return pool[h32(seed) % pool.length]; }
  function ord(n) { return n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4)] || "th"); }

  function worldDay() {
    try { if (window.__foPlanet) return __foPlanet.dayIx(Date.now()); } catch (e) {}
    return Math.floor(Date.now() / 86400000);
  }
  function dateline() {
    var d = new Date();
    var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var MONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return DAYS[d.getUTCDay()] + ", " + d.getUTCDate() + " " + MONS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }

  // ---- the lead story -------------------------------------------------------
  function foGzLead(me, day) {
    var last = null, lastIx = -1;
    for (var i = (App.results || []).length - 1; i >= 0; i--) {
      var r = App.results[i];
      if (r && (!r.comp || r.comp === "league") && (r.home === me.name || r.away === me.name)) { last = r; lastIx = i; break; }
    }
    if (!last) return foGzPreview(me, day);
    var txt = (last.result && last.result.text) || "";
    var won = txt.indexOf(me.name + " won") === 0;
    var tie = /tie/i.test(txt);
    var opp = last.home === me.name ? last.away : last.home;
    var innLine = (last.innings || []).map(function (inn) {
      return inn ? E(inn.batTeam) + " " + inn.runs + "/" + inn.wkts : "";
    }).filter(Boolean).join(" &middot; ");
    // the star performers, read back off the match's own history entries
    var bestBat = null, bestBowl = null;
    try {
      var teams = last.home + " v " + last.away;
      for (var nm in (App.playerHist || {})) {
        (App.playerHist[nm] || []).forEach(function (e) {
          if (!e || e.fr || e.date !== last.date || e.teams !== teams) return;
          if ((e.rr || 0) > 0 && (!bestBat || e.rr > bestBat.rr)) bestBat = { nm: nm, rr: e.rr, bb: e.bb, o: e.o };
          if ((e.w || 0) > 0 && (!bestBowl || e.w > bestBowl.w || (e.w === bestBowl.w && e.cr < bestBowl.cr))) bestBowl = { nm: nm, w: e.w, cr: e.cr };
        });
      }
    } catch (e) {}
    var HEAD_W = ["A DAY THAT BELONGED TO US", "THE GROUND ROARS AGAIN", "POINTS IN THE BAG, HEADS HELD HIGH", "A WIN WORTH THE WALK HOME"];
    var HEAD_L = ["A HARD LESSON, TAKEN STANDING", "NOT OUR DAY, NOT OUR LUCK", "BEATEN, BUT NOT BOWED", "A LONG LOOK IN THE MIRROR"];
    var HEAD_T = ["NOTHING BETWEEN THEM", "A TIE FOR THE AGES"];
    var head = tie ? pick(HEAD_T, "gzh|" + day) : pick(won ? HEAD_W : HEAD_L, "gzh|" + day + "|" + lastIx);
    var PUNDITS = ["Aggie Trueman", "H. R. Fothergill", "Marcus Bell", "The Colonel"];
    var QUOTE_W = ["“That is what the badge is supposed to look like,”", "“You win matches like that in the field, and they did,”", "“The table does not lie, and today it smiled,”"];
    var QUOTE_L = ["“Good sides lose; poor sides learn nothing. This side will learn,”", "“The margin flatters nobody. Back to the nets,”", "“You could see the plan; you could not see the execution,”"];
    var quote = pick(tie ? QUOTE_W : (won ? QUOTE_W : QUOTE_L), "gzq|" + day + "|" + lastIx) + " said " + pick(PUNDITS, "gzp|" + day) + ".";
    var body =
      "<p><span class='fo-gz-drop'>" + E(txt.charAt(0) || "T") + "</span>" + E(txt.slice(1) || "he match was played") +
      ". The scorers made it " + innLine + ", and nobody at the ground argued.</p>" +
      "<p>" +
      (bestBat ? "The innings of the day belonged to <b>" + E(bestBat.nm) + "</b> &mdash; " + bestBat.rr + (bestBat.o ? "" : " not out") + " from " + (bestBat.bb || "?") + " balls. " : "") +
      (bestBowl ? "With the ball it was <b>" + E(bestBowl.nm) + "</b>, " + bestBowl.w + " for " + bestBowl.cr + ", who set the tone. " : "") +
      quote + "</p>";
    return {
      kicker: "The lead &middot; v " + E(opp),
      head: head,
      body: body,
      cta: "<a class='fo-gz-btn' href='#/scorecard?i=" + lastIx + "'>The full scorecard &rsaquo;</a>"
    };
  }
  function foGzPreview(me, day) {
    var S = App.season, opp = null, rd = S ? S.round : 0;
    try {
      var fx = (S.schedule[rd] || []).find(function (f) { return f[0] === App.teamIx || f[1] === App.teamIx; });
      if (fx) opp = GD.teams[fx[0] === App.teamIx ? fx[1] : fx[0]];
    } catch (e) {}
    var HEADS = ["THE SEASON HOLDS ITS BREATH", "ALL EYES ON THE FIRST BALL", "TALK IS CHEAP; THE TOSS IS NOT"];
    return {
      kicker: "The lead &middot; preview",
      head: pick(HEADS, "gzpv|" + day),
      body: "<p><span class='fo-gz-drop'>E</span>verything at " + E(me.name) + " points to the next fixture" +
        (opp ? " &mdash; " + E(opp.name) + " await, and the town has already picked its heroes" : "") +
        ". The nets have been busy, the orders are being argued over, and this paper, as ever, reserves judgement until the first wicket falls.</p>",
      cta: "<a class='fo-gz-btn' href='#/matchday?r=" + rd + "'>The matchday page &rsaquo;</a>"
    };
  }

  // ---- render ---------------------------------------------------------------
  window.foRenderPaperPage = function () {
    var page = document.getElementById("page"); if (!page || !ready()) return;
    foGzCss();
    document.body.classList.add("fo-gz-on");
    var me = userTeam(), sN = App.seasonNo || 1, day = worldDay();

    var lead = foGzLead(me, day);

    // around the world: the living planet's wire
    var wireRows = "";
    try {
      if (window.__foPlanet) wireRows = __foPlanet.genWire(Date.now()).slice(0, 8).map(function (w) {
        return "<div class='fo-gz-wln'>" + E(w.headline) + "</div>";
      }).join("");
    } catch (e) {}
    if (!wireRows) wireRows = "<div class='fo-gz-wln quiet'>The foreign desks are quiet tonight.</div>";

    // table talk
    var tableTalk = "";
    try {
      var rows = leagueRows(), pos = rows.findIndex(function (r) { return r.nm === me.name; }) + 1;
      var top = rows[0], gap = top ? (top.pts - (rows[pos - 1] ? rows[pos - 1].pts : 0)) : 0;
      tableTalk = "<p><b>" + E(top ? top.nm : "") + "</b> lead the league" +
        (pos === 1 ? " &mdash; and that means us. The town may enjoy it quietly; this column intends to enjoy it loudly."
          : ". " + E(me.name) + " sit " + ord(pos) + ", " + (gap > 0 ? gap + " point" + (gap === 1 ? "" : "s") + " off the top" : "level on points") + ", and the run-in will decide what kind of season this was.") + "</p>" +
        "<div class='fo-gz-mini'>" + rows.slice(0, 3).map(function (r, i) {
          return "<div class='fo-gz-mrow" + (r.nm === me.name ? " mine" : "") + "'><i>" + (i + 1) + "</i><span>" + E(r.nm) + "</span><b>" + r.pts + "</b></div>";
        }).join("") + "</div>";
    } catch (e) { tableTalk = "<p>The table is being typeset.</p>"; }

    // the week's best: finest innings + figures of the latest settled round
    var weekBest = "";
    try {
      var maxR = -1;
      for (var nm in (App.playerHist || {})) (App.playerHist[nm] || []).forEach(function (e) { if (e && !e.fr && e.s === sN && (e.r || 0) > maxR) maxR = e.r; });
      var bi = null, bs = null;
      if (maxR >= 0) for (var nm2 in (App.playerHist || {})) (App.playerHist[nm2] || []).forEach(function (e) {
        if (!e || e.fr || e.s !== sN || e.r !== maxR) return;
        if ((e.rr || 0) > 0 && (!bi || e.rr > bi.rr)) bi = { nm: nm2, rr: e.rr, bb: e.bb, o: e.o };
        if ((e.w || 0) > 0 && (!bs || e.w > bs.w || (e.w === bs.w && e.cr < bs.cr))) bs = { nm: nm2, w: e.w, cr: e.cr };
      });
      weekBest = (bi ? "<div class='fo-gz-best'><b>" + bi.rr + (bi.o ? "" : "*") + "</b><span>" + E(bi.nm) + " &middot; bat</span></div>" : "") +
        (bs ? "<div class='fo-gz-best'><b>" + bs.w + "/" + bs.cr + "</b><span>" + E(bs.nm) + " &middot; ball</span></div>" : "");
    } catch (e) {}
    if (!weekBest) weekBest = "<p class='fo-gz-quiet'>Awaiting the first round of the season.</p>";

    // notes from the nets: training pops as club gossip
    var netsNotes = "";
    try {
      if (window.__foPops) netsNotes = __foPops.recent().slice(0, 5).map(function (l) {
        return "<div class='fo-gz-nln'><b>" + E(l.n) + "</b> is said to be sharper than ever &mdash; the " + E(String(l.why || "nets").toLowerCase()) + " have done their work.</div>";
      }).join("");
    } catch (e) {}
    if (!netsNotes) netsNotes = "<div class='fo-gz-nln quiet'>The training ground keeps its secrets this week.</div>";

    // letters to the editor: seeded lore, flavoured by the club's standing
    var LETTERS = [
      { s: "Disgusted of the Long Room", t: "Sir &mdash; The tea at the ground remains an affront to the county. The cricket, I concede, has improved." },
      { s: "A Loyal Member since Founding Day", t: "Sir &mdash; I have watched every home fixture from the same seat, and I say the captain's field placings are either genius or luck. I no longer care which." },
      { s: "The Groundsman's Wife", t: "Sir &mdash; My husband rolls that pitch by moonlight. If the batters cannot cash in on it, they may roll it themselves." },
      { s: "Anonymous, care of the Pavilion", t: "Sir &mdash; I hear the nets have arrows going up all over the board. About time the noticeboard had good news on it." },
      { s: "An Old Fast Bowler", t: "Sir &mdash; In my day we bowled uphill both ways and liked it. Still &mdash; the young quick has something. Keep him fresh." }
    ];
    var li1 = h32("gzl1|" + day + "|" + sN) % LETTERS.length;
    var li2 = (li1 + 1 + (h32("gzl2|" + day) % (LETTERS.length - 1))) % LETTERS.length;
    var letters = [LETTERS[li1], LETTERS[li2]].map(function (L) {
      return "<div class='fo-gz-let'><p>" + L.t + "</p><i>&mdash; " + L.s + "</i></div>";
    }).join("");

    // small advertisements: the back page gags
    var ADS = [
      "<b>LINSEED OIL</b>, by the barrel or the thimble. Bats fed while you wait.",
      "<b>LOST:</b> one match ball, mid-six. Reward for its safe return; questions will not be asked.",
      "<b>PEMBERLEY'S POMADE</b> &mdash; the choice of gentlemen bowlers. Hold your line, hold your hair.",
      "<b>SCOREBOOK LESSONS.</b> Neat wagon wheels a specialty. Enquire at the print shop.",
      "<b>ROOM TO LET</b> overlooking the ground. Wicket views. No fast bowlers before eight.",
      "<b>UMPIRE'S COATS</b> laundered white as a nightwatchman's nerves. Same-day service.",
      "<b>TRIALS SATURDAY.</b> Bring your own bat, your own boots, and no excuses."
    ];
    var adIx = h32("gzad|" + day) % ADS.length;
    var ads = [0, 1, 2].map(function (k) { return "<div class='fo-gz-ad'>" + ADS[(adIx + k * 2) % ADS.length] + "</div>"; }).join("");

    var sec = function (title, body, cls) {
      return "<div class='fo-gz-sec" + (cls ? " " + cls : "") + "'><h3>" + title + "</h3>" + body + "</div>";
    };
    page.innerHTML = "<div class='fo-gz'><div class='fo-gz-in'>" +
      "<div class='fo-gz-mast'>" +
      "<div class='fo-gz-mrule'></div>" +
      "<h1>The Fifty Overs Gazette</h1>" +
      "<div class='fo-gz-date'><span>" + dateline() + "</span><span>Season " + sN + " &middot; world day " + day + "</span><span>Price: tuppence</span></div>" +
      "<div class='fo-gz-mrule'></div>" +
      "</div>" +
      "<div class='fo-gz-lead'>" +
      "<div class='fo-gz-k'>" + lead.kicker + "</div>" +
      "<h2>" + lead.head + "</h2>" +
      "<div class='fo-gz-body'>" + lead.body + "</div>" + lead.cta +
      "</div>" +
      "<div class='fo-gz-cols'>" +
      sec("Around the world", wireRows) +
      sec("Table talk", tableTalk) +
      sec("The week&rsquo;s best", "<div class='fo-gz-bestrow'>" + weekBest + "</div>") +
      sec("Notes from the nets", netsNotes) +
      sec("Letters to the editor", letters) +
      sec("Small advertisements", ads, "ads") +
      "</div>" +
      "<div class='fo-gz-foot'>Printed nightly for the members of " + E(me.name) + " &middot; <a href='#/league'>My league</a> &middot; <a href='#/planet'>World cricket</a> &middot; <a href='#/almanack'>The world almanack</a></div>" +
      "</div></div>";
  };
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/paper") document.body.classList.remove("fo-gz-on"); });

  // the desk gets the paperboy card
  window.foPaperCard = function () {
    if (!ready()) return "";
    var day = worldDay();
    var TEASE = ["The front page is set.", "Hot off the press.", "The morning edition is out.", "Read it before the rivals do."];
    return "<div class='fo-card fo-ls-card pap alma'><div class='fo-card-h2row'><div class='fo-card-h2'>The Gazette</div><span class='fo-ls-k'>daily</span></div>" +
      "<div class='fo-alma-sub'>" + pick(TEASE, "gzt|" + day) + "</div><div class='fo-card-b'>" +
      "<a class='fo-ls-btn ghost' href='#/paper'>Today&rsquo;s paper &rsaquo;</a></div></div>";
  };

  function foGzCss() {
    if (document.getElementById("fo-gz-css")) return;
    var s = document.createElement("style"); s.id = "fo-gz-css";
    s.textContent = [
      "html body.ftpskin.fo-gz-on,html body.fo-gz-on{background:#F3EDDF !important}",
      "html body.fo-gz-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-gz-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-gz{min-height:100vh;padding:66px 16px 40px;color:#221E16;background:radial-gradient(120% 60% at 50% 0%,rgba(255,252,242,.7),rgba(0,0,0,0) 60%)}",
      ".fo-gz-in{max-width:980px;margin:0 auto}",
      // masthead
      ".fo-gz-mast{text-align:center;margin:0 0 18px}",
      ".fo-gz-mrule{border-top:2.5px solid #221E16;border-bottom:1px solid #221E16;height:4px;margin:6px 0}",
      ".fo-gz-mast h1{font-family:Fraunces,Fraunces,Georgia,serif;font-weight:700;font-size:clamp(30px,6vw,52px);line-height:1.05;margin:10px 0;color:#1B1710;letter-spacing:.01em}",
      ".fo-gz-date{display:flex;justify-content:space-between;gap:10px;font-family:Fraunces,Georgia,serif;font-style:normal;font-size:11.5px;color:rgba(34,30,22,.65);padding:0 2px;flex-wrap:wrap}",
      // lead
      ".fo-gz-lead{border-bottom:1px solid rgba(34,30,22,.25);padding:6px 0 18px;margin:0 0 18px}",
      ".fo-gz-k{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8E2F1C;margin:0 0 6px}",
      ".fo-gz-lead h2{font-family:Fraunces,Fraunces,Georgia,serif;font-weight:600;font-size:clamp(24px,4.6vw,38px);line-height:1.08;margin:0 0 12px;color:#1B1710;text-wrap:balance}",
      ".fo-gz-body{font-family:Fraunces,Georgia,serif;font-size:14.5px;line-height:1.65;color:#2A2519;max-width:66ch}",
      ".fo-gz-body p{margin:0 0 10px}",
      ".fo-gz-body b{color:#1B1710}",
      ".fo-gz-drop{float:left;font-family:Fraunces,Fraunces,Georgia,serif;font-size:46px;line-height:.82;padding:4px 7px 0 0;color:#8E2F1C;font-weight:600}",
      ".fo-gz-btn{display:inline-block;font:600 12px/1 Inter,sans-serif;color:#8E2F1C;border:1px solid rgba(142,47,28,.45);border-radius:999px;padding:8px 15px;text-decoration:none;margin-top:6px}",
      ".fo-gz-btn:hover{background:#8E2F1C;color:#F6F1E4}",
      // columns
      ".fo-gz-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 26px}",
      "@media(max-width:760px){.fo-gz-cols{grid-template-columns:minmax(0,1fr)}}",
      ".fo-gz-sec{border-bottom:1px solid rgba(34,30,22,.18);padding:0 0 15px;margin:0 0 15px;break-inside:avoid}",
      ".fo-gz-sec h3{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#1B1710;border-bottom:1.5px solid #221E16;padding:0 0 5px;margin:0 0 10px}",
      ".fo-gz-wln{font-family:Fraunces,Georgia,serif;font-size:12.5px;line-height:1.5;color:#2A2519;padding:5px 0;border-bottom:1px dotted rgba(34,30,22,.2)}",
      ".fo-gz-wln:last-child{border-bottom:none}",
      ".fo-gz-wln.quiet,.fo-gz-nln.quiet,.fo-gz-quiet{font-style:normal;color:rgba(34,30,22,.5)}",
      ".fo-gz-sec p{font-family:Fraunces,Georgia,serif;font-size:13px;line-height:1.6;color:#2A2519;margin:0 0 9px}",
      ".fo-gz-mini{margin-top:4px}",
      ".fo-gz-mrow{display:flex;align-items:baseline;gap:8px;padding:4px 0;border-bottom:1px dotted rgba(34,30,22,.2);font-size:12.5px}",
      ".fo-gz-mrow i{font-style:normal;color:rgba(34,30,22,.45);width:14px}",
      ".fo-gz-mrow span{flex:1}",
      ".fo-gz-mrow b{font-variant-numeric:tabular-nums}",
      ".fo-gz-mrow.mine{background:rgba(142,47,28,.06)}",
      ".fo-gz-bestrow{display:flex;gap:14px;flex-wrap:wrap}",
      ".fo-gz-best{flex:1;min-width:120px;text-align:center;border:1px solid rgba(34,30,22,.25);padding:12px 8px}",
      ".fo-gz-best b{display:block;font-family:Fraunces,Fraunces,Georgia,serif;font-size:28px;font-weight:600;color:#1B1710;font-variant-numeric:tabular-nums}",
      ".fo-gz-best span{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:11.5px;color:rgba(34,30,22,.6)}",
      ".fo-gz-nln{font-family:Fraunces,Georgia,serif;font-size:12.5px;line-height:1.55;color:#2A2519;padding:5px 0;border-bottom:1px dotted rgba(34,30,22,.2)}",
      ".fo-gz-nln:last-child{border-bottom:none}",
      ".fo-gz-let{margin:0 0 12px}",
      ".fo-gz-let p{margin:0 0 3px}",
      ".fo-gz-let i{font-family:Fraunces,Georgia,serif;font-size:11.5px;color:rgba(34,30,22,.55)}",
      ".fo-gz-sec.ads .fo-gz-ad{font-family:Fraunces,Georgia,serif;font-size:12px;line-height:1.5;color:#2A2519;border:1px solid rgba(34,30,22,.3);padding:8px 10px;margin:0 0 8px;text-align:center}",
      ".fo-gz-ad b{letter-spacing:.06em}",
      ".fo-gz-foot{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:11.5px;color:rgba(34,30,22,.6);text-align:center;margin-top:6px}",
      ".fo-gz-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;margin:0 -12px;border-radius:12px;color:#8E2F1C;text-decoration:none}",
      ".fo-gz-foot a:hover{text-decoration:underline}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
