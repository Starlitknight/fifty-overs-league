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

   PHASE 4 OF THE ALMANACK. The Gazette is the one screen in the game that
   literally IS a newspaper, so it keeps its centred masthead between two
   rules, its dateline and its drop cap - and everything under the fold is the
   Almanack's own bands, because a newspaper's inside pages are ruled columns
   too. Nothing about the prose generation changed.

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
    }).filter(Boolean).join(" · ");
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
      "<p><span class='al-drop'>" + E(txt.charAt(0) || "T") + "</span>" + E(txt.slice(1) || "he match was played") +
      ". The scorers made it " + innLine + ", and nobody at the ground argued.</p>" +
      "<p>" +
      (bestBat ? "The innings of the day belonged to <b>" + E(bestBat.nm) + "</b> &mdash; " + bestBat.rr + (bestBat.o ? "" : " not out") + " from " + (bestBat.bb || "?") + " balls. " : "") +
      (bestBowl ? "With the ball it was <b>" + E(bestBowl.nm) + "</b>, " + bestBowl.w + " for " + bestBowl.cr + ", who set the tone. " : "") +
      quote + "</p>";
    return {
      kicker: "The lead · v " + E(opp),
      head: head,
      body: body,
      cta: "<a class='al-btn' href='#/scorecard?i=" + lastIx + "'>The full scorecard</a>"
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
      kicker: "The lead · preview",
      head: pick(HEADS, "gzpv|" + day),
      body: "<p><span class='al-drop'>E</span>verything at " + E(me.name) + " points to the next fixture" +
        (opp ? " &mdash; " + E(opp.name) + " await, and the town has already picked its heroes" : "") +
        ". The nets have been busy, the orders are being argued over, and this paper, as ever, reserves judgement until the first wicket falls.</p>",
      cta: "<a class='al-btn' href='#/matchday?r=" + rd + "'>The matchday page</a>"
    };
  }

  // ---- render ---------------------------------------------------------------
  function A() { return window.AL || null; }
  function onPaper() { return (location.hash || "").split("?")[0] === "#/paper"; }

  window.foRenderPaperPage = function () {
    if (!onPaper()) return;
    var page = document.getElementById("page"); if (!page || !ready()) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e0) {}

    var me = userTeam(), sN = App.seasonNo || 1, day = worldDay();
    var lead = foGzLead(me, day);

    // ---- the masthead. The one screen that is allowed one. ----------------
    var body = '<div class="al-paper"><div class="al-paper__rule"></div>' +
      "<h1>The Fifty Overs Gazette</h1>" +
      '<div class="al-paper__date"><span>' + E(dateline()) + "</span>" +
      "<span>Season " + sN + " · world day " + day + "</span><span>Price: tuppence</span></div>" +
      '<div class="al-paper__rule"></div></div>';

    body += al.subnav("paper");

    // ---- the lead --------------------------------------------------------
    body += '<div class="al-mast"><div class="al-mast__eyebrow">' + lead.kicker + "</div>" +
      "<h1>" + lead.head + "</h1></div>" +
      '<div class="al-story">' + lead.body + "</div>" + lead.cta;

    // ---- around the world: the living planet's wire -----------------------
    var wire = [];
    try { if (window.__foPlanet) wire = __foPlanet.genWire(Date.now()).slice(0, 8); } catch (e) {}
    body += al.sec("Around the world", wire.length
      ? '<div class="al-fixlist">' + wire.map(function (w) {
          return '<div class="al-fix al-fix--room"><span class="al-fix__t"><b>' + E(w.headline) + "</b></span></div>";
        }).join("") + "</div>"
      : '<p class="al-read">The foreign desks are quiet tonight.</p>',
      { href: "#/planet", label: "World cricket" });

    // ---- table talk -------------------------------------------------------
    try {
      var rows = leagueRows(), pos = rows.findIndex(function (r) { return r.nm === me.name; }) + 1;
      var top = rows[0], gap = top ? (top.pts - (rows[pos - 1] ? rows[pos - 1].pts : 0)) : 0;
      body += al.sec("Table talk",
        "<p><b>" + E(top ? top.nm : "") + "</b> lead the league" +
        (pos === 1
          ? " — and that means us. The town may enjoy it quietly; this column intends to enjoy it loudly."
          : ". " + E(me.name) + " sit " + ord(pos) + ", " +
            (gap > 0 ? gap + " point" + (gap === 1 ? "" : "s") + " off the top" : "level on points") +
            ", and the run-in will decide what kind of season this was.") + "</p>" +
        al.ledger(rows.slice(0, 3).map(function (r, i) {
          return [(i + 1) + ". " + r.nm, String(r.pts) + " pts", r.nm === me.name ? "pos" : ""];
        })), { href: "#/table", label: "The table" });
    } catch (e) { body += al.sec("Table talk", '<p class="al-read">The table is being typeset.</p>'); }

    // ---- the week's best ---------------------------------------------------
    var best = [];
    try {
      var maxR = -1;
      for (var nm in (App.playerHist || {})) (App.playerHist[nm] || []).forEach(function (e) { if (e && !e.fr && e.s === sN && (e.r || 0) > maxR) maxR = e.r; });
      var bi = null, bs = null;
      if (maxR >= 0) for (var nm2 in (App.playerHist || {})) (App.playerHist[nm2] || []).forEach(function (e) {
        if (!e || e.fr || e.s !== sN || e.r !== maxR) return;
        if ((e.rr || 0) > 0 && (!bi || e.rr > bi.rr)) bi = { nm: nm2, rr: e.rr, bb: e.bb, o: e.o };
        if ((e.w || 0) > 0 && (!bs || e.w > bs.w || (e.w === bs.w && e.cr < bs.cr))) bs = { nm: nm2, w: e.w, cr: e.cr };
      });
      if (bi) best.push(["With the bat · " + bi.nm, bi.rr + (bi.o ? "" : "*") + (bi.bb ? " (" + bi.bb + ")" : "")]);
      if (bs) best.push(["With the ball · " + bs.nm, bs.w + "/" + bs.cr]);
    } catch (e) {}
    body += al.sec("The week's best", best.length ? al.ledger(best)
      : '<p class="al-read">Awaiting the first round of the season.</p>');

    // ---- notes from the nets ------------------------------------------------
    var notes = [];
    try { if (window.__foPops) notes = __foPops.recent().slice(0, 5); } catch (e) {}
    body += al.sec("Notes from the nets", notes.length
      ? '<div class="al-fixlist">' + notes.map(function (l) {
          return '<div class="al-fix al-fix--room"><span class="al-fix__t"><b>' + E(l.n) +
            "</b><i>said to be sharper than ever — the " + E(String(l.why || "nets").toLowerCase()) +
            " have done their work</i></span></div>";
        }).join("") + "</div>"
      : '<p class="al-read">The training ground keeps its secrets this week.</p>',
      { href: "#/training", label: "The nets" });

    // ---- letters and small advertisements: seeded lore ----------------------
    var LETTERS = [
      { s: "Disgusted of the Long Room", t: "Sir — The tea at the ground remains an affront to the county. The cricket, I concede, has improved." },
      { s: "A Loyal Member since Founding Day", t: "Sir — I have watched every home fixture from the same seat, and I say the captain's field placings are either genius or luck. I no longer care which." },
      { s: "The Groundsman's Wife", t: "Sir — My husband rolls that pitch by moonlight. If the batters cannot cash in on it, they may roll it themselves." },
      { s: "Anonymous, care of the Pavilion", t: "Sir — I hear the nets have arrows going up all over the board. About time the noticeboard had good news on it." },
      { s: "An Old Fast Bowler", t: "Sir — In my day we bowled uphill both ways and liked it. Still — the young quick has something. Keep him fresh." }
    ];
    var li1 = h32("gzl1|" + day + "|" + sN) % LETTERS.length;
    var li2 = (li1 + 1 + (h32("gzl2|" + day) % (LETTERS.length - 1))) % LETTERS.length;
    body += al.sec("Letters to the editor", [LETTERS[li1], LETTERS[li2]].map(function (L) {
      return '<p class="al-lede">' + E(L.t) + '</p><p class="al-read">— ' + E(L.s) + "</p>";
    }).join(""));

    var ADS = [
      "LINSEED OIL, by the barrel or the thimble. Bats fed while you wait.",
      "LOST: one match ball, mid-six. Reward for its safe return; questions will not be asked.",
      "PEMBERLEY'S POMADE — the choice of gentlemen bowlers. Hold your line, hold your hair.",
      "SCOREBOOK LESSONS. Neat wagon wheels a specialty. Enquire at the print shop.",
      "ROOM TO LET overlooking the ground. Wicket views. No fast bowlers before eight.",
      "UMPIRE'S COATS laundered white as a nightwatchman's nerves. Same-day service.",
      "TRIALS SATURDAY. Bring your own bat, your own boots, and no excuses."
    ];
    var adIx = h32("gzad|" + day) % ADS.length;
    body += al.sec("Small advertisements", al.ledger([0, 1, 2].map(function (k) {
      return [ADS[(adIx + k * 2) % ADS.length], ""];
    })));

    body += '<p class="al-read">Printed nightly for the members of ' + E(me.name) + ".</p>";
    page.innerHTML = al.page({ body: body });
  };

  // the desk gets the paperboy card
  window.foPaperCard = function () {
    if (!ready()) return "";
    var day = worldDay();
    var TEASE = ["The front page is set.", "Hot off the press.", "The morning edition is out.", "Read it before the rivals do."];
    return "<div class='fo-card fo-ls-card pap alma'><div class='fo-card-h2row'><div class='fo-card-h2'>The Gazette</div><span class='fo-ls-k'>daily</span></div>" +
      "<div class='fo-alma-sub'>" + pick(TEASE, "gzt|" + day) + "</div><div class='fo-card-b'>" +
      "<a class='fo-ls-btn ghost' href='#/paper'>Today&rsquo;s paper &rsaquo;</a></div></div>";
  };

})();
