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
  // ---- WHERE THE PAPER COMES FROM -------------------------------------------
  //
  // world_gazette. One row, composed by the umpire once a world day from the
  // record it actually played, and read identically by every device.
  //
  // It used to be built here, out of App.results and App.playerHist - THIS
  // DEVICE'S SAVE - so the lead was the reader's own last match and the paper
  // was a different paper on every phone. The wire beside it came from module
  // 27's client-derived planet, a world that is a pure function of the UTC date
  // and has no connection to the one the umpire plays; nothing in the client
  // read world_nat_matches at all, so the internationals this world stages
  // every window appeared on no page in the game.
  //
  // The page now fetches and renders. It composes nothing, and it still writes
  // nothing, which is the property worth keeping: a newspaper a reader can edit
  // is not a newspaper.
  var GZ = { issue: null, busy: false, dead: false };
  function gzFetch(cb) {
    if (GZ.issue || GZ.busy || GZ.dead) return GZ.issue;
    GZ.busy = true;
    try {
      fetch(SB_URL + "/rest/v1/world_gazette?select=world_day,issue&limit=1",
            { headers: { apikey: SB_ANON } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          GZ.busy = false;
          var r = rows && rows[0];
          if (r && r.issue) { GZ.issue = r.issue; GZ.issue.__day = r.world_day; }
          else GZ.dead = true;
          if (cb) cb();
        })
        .catch(function () { GZ.busy = false; GZ.dead = true; if (cb) cb(); });
    } catch (e) { GZ.busy = false; GZ.dead = true; }
    return null;
  }
  // a column with a rule over it, which is all a newspaper section is
  function sec(title, body, cls) {
    if (!body) return "";
    return "<div class='fo-gz-sec " + (cls || "") + "'><div class='fo-gz-sh'>" +
      title + "</div>" + body + "</div>";
  }

  // a story's own words, already chosen by the press. The page never picks a
  // phrase: two readers must see the same sentence, and the only way to be sure
  // is that the sentence was written once.
  function gzStory(st, big) {
    if (!st) return "";
    return "<div class='fo-gz-" + (big ? "lead" : "sec") + "'>" +
      (big ? "<div class='fo-gz-k'>" + E(gzKicker(st)) + "</div><h2>" + E(st.headline || "") + "</h2>" +
             "<div class='fo-gz-by'>By our cricket correspondent</div>" +
             "<div class='fo-gz-body'>" + E(st.body || st.brief || "") + "</div>"
           : "<h3>" + E(st.headline || "") + "</h3><p>" + E(st.body || st.brief || "") + "</p>") +
      "</div>";
  }
  // WHAT KIND OF STORY THIS IS, said plainly above the headline. The reader
  // should be able to tell an international from a county game without reading
  // the names, which is what a kicker is for.
  function gzKicker(st) {
    var k = st && st.kind;
    return k === "cupFinal" ? "The final"
      : k === "cupTie" ? "The cup"
      : k === "intlResult" ? "International"
      : k === "intlFeat" ? "International · the men"
      : k === "titleDecided" ? "The championship"
      : k === "worldRecord" ? "A record"
      : k === "oddity" ? "Out of the ordinary"
      : k === "milestone" ? "Milestone"
      : "From the leagues";
  }

  window.foRenderPaperPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    document.body.classList.add("fo-gz-on");
    foGzCss();
    var iss = GZ.issue || gzFetch(function () { window.foRenderPaperPage(); });
    if (!iss) {
      page.innerHTML = "<div class='fo-gz'><div class='fo-gz-in'>" +
        "<div class='fo-gz-mast'><div class='fo-gz-ears'><span class='ear'>&nbsp;</span>" +
        "<h1>The Fifty Overs Gazette</h1><span class='ear r'>&nbsp;</span></div>" +
        "<div class='fo-gz-mrule'></div></div>" +
        "<p class='fo-gz-quiet'>" + (GZ.dead
          ? "The presses are quiet. Today&rsquo;s edition has not reached us."
          : "The paper is being set&hellip;") + "</p></div></div>";
      return;
    }
    var day = iss.__day | 0;
    // THE FRONT PAGE CHANGES FOR A FINAL. Two days a season the whole world
    // watches one match, and a paper that prints them in a Tuesday's shape
    // wastes the occasion - so the press flags it and the page obeys.
    var big = !!iss.tournament;
    var briefs = (iss.briefs || []).map(function (b) {
      return "<div class='fo-gz-wln'>" + E(b.brief || b.headline || "") + "</div>";
    }).join("") || "<div class='fo-gz-wln quiet'>Nothing else to report.</div>";
    var board = (iss.scoreboard || []).map(function (r) {
      return "<div class='fo-gz-mrow'><i>&bull;</i><span>" + E(r.text || (r.home + " v " + r.away)) + "</span></div>";
    }).join("") || "<div class='fo-gz-wln quiet'>No cricket was played.</div>";
    var back = (iss.back || []).map(function (b) {
      return "<div class='fo-gz-nln'>" + E(b.brief || b.headline || "") + "</div>";
    }).join("") || "<div class='fo-gz-wln quiet'>&mdash;</div>";

    page.innerHTML = "<div class='fo-gz'><div class='fo-gz-in'>" +
      "<div class='fo-gz-mast'>" +
      "<div class='fo-gz-ears'><span class='ear'>" + (big ? "Final<br>day" : "Day<br>" + day) + "</span>" +
      "<h1>The Fifty Overs Gazette</h1>" +
      "<span class='ear r'>Price<br>tuppence</span></div>" +
      "<div class='fo-gz-mrule'></div>" +
      "<div class='fo-gz-folio'>" + E(iss.dateline || dateline()) +
        " &nbsp;&bull;&nbsp; No. " + day + " &nbsp;&bull;&nbsp; One edition, the whole world over</div>" +
      "<div class='fo-gz-mrule thin'></div>" +
      "</div>" +
      (iss.thin
        ? "<p class='fo-gz-quiet'>A quiet day. No cricket of consequence reached us before we went to press.</p>"
        : gzStory(iss.lead, true) +
          "<div class='fo-gz-cols'>" +
          (iss.second ? sec("Also today", gzStory(iss.second, false)) : "") +
          sec("In brief", briefs) +
          sec("The scoreboard", "<div class='fo-gz-mini'>" + board + "</div>") +
          sec("From around the world", back) +
          (iss.comment ? sec("Comment", "<p>" + E(iss.comment) + "</p>") : "") +
          "</div>") +
      "<div class='fo-gz-foot'>One paper, printed for every club in the world &middot; " +
      "<a href='#/league'>My league</a> &middot; <a href='#/rankings'>The rankings</a></div>" +
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
      ".fo-gz-ears{display:flex;align-items:center;justify-content:space-between;gap:8px}",
      ".fo-gz-ears h1{flex:1;text-align:center}",
      ".fo-gz-ears .ear{flex:0 0 auto;font-family:Fraunces,Georgia,serif;font-size:10.5px;line-height:1.45;color:rgba(34,30,22,.6);border:1px solid rgba(34,30,22,.3);padding:5px 9px;text-align:center;min-width:64px}",
      "@media(max-width:560px){.fo-gz-ears .ear{display:none}}",
      ".fo-gz-folio{font-family:Fraunces,Georgia,serif;font-size:11.5px;letter-spacing:.04em;color:rgba(34,30,22,.65);padding:5px 0 4px;font-variant-caps:all-small-caps}",
      ".fo-gz-mrule.thin{border-top:1px solid #221E16;border-bottom:none;height:0;margin:0 0 4px}",
      ".fo-gz-by{font-family:Fraunces,Georgia,serif;font-style:italic;font-size:12px;color:rgba(34,30,22,.55);margin:0 0 10px}",
      ".fo-gz-mrule{border-top:2.5px solid #221E16;border-bottom:1px solid #221E16;height:4px;margin:6px 0}",
      ".fo-gz-mast h1{font-family:Fraunces,Fraunces,Georgia,serif;font-weight:700;font-size:clamp(30px,6vw,52px);line-height:1.05;margin:10px 0;color:#1B1710;letter-spacing:.01em}",
      // lead
      ".fo-gz-lead{border-bottom:1px solid rgba(34,30,22,.25);padding:6px 0 18px;margin:0 0 18px}",
      ".fo-gz-k{font-family:Manrope,sans-serif;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8E2F1C;margin:0 0 6px}",
      ".fo-gz-lead h2{font-family:Fraunces,Fraunces,Georgia,serif;font-weight:600;font-size:clamp(24px,4.6vw,38px);line-height:1.08;margin:0 0 12px;color:#1B1710;text-wrap:balance}",
      ".fo-gz-body{font-family:Fraunces,Georgia,serif;font-size:14.5px;line-height:1.65;color:#2A2519;max-width:66ch;text-align:justify;hyphens:auto;-webkit-hyphens:auto}",
      ".fo-gz-body p{margin:0 0 10px}",
      ".fo-gz-body b{color:#1B1710}",
      ".fo-gz-drop{float:left;font-family:Fraunces,Fraunces,Georgia,serif;font-size:46px;line-height:.82;padding:4px 7px 0 0;color:#8E2F1C;font-weight:600}",
      ".fo-gz-btn{display:inline-block;font:600 13px/1 Manrope,sans-serif;color:#8E2F1C;border:1px solid rgba(142,47,28,.45);border-radius:999px;padding:8px 15px;text-decoration:none;margin-top:6px}",
      ".fo-gz-btn:hover{background:#8E2F1C;color:#F6F1E4}",
      // columns
      ".fo-gz-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 26px}",
      "@media(max-width:760px){.fo-gz-cols{grid-template-columns:minmax(0,1fr)}}",
      ".fo-gz-sec{border-bottom:1px solid rgba(34,30,22,.18);padding:0 0 15px;margin:0 0 15px;break-inside:avoid}",
      ".fo-gz-sec h3{font-family:Manrope,sans-serif;font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:#1B1710;border-bottom:1.5px solid #221E16;padding:0 0 5px;margin:0 0 10px}",
      ".fo-gz-wln{font-family:Fraunces,Georgia,serif;font-size:12px;line-height:1.5;color:#2A2519;padding:5px 0;border-bottom:1px dotted rgba(34,30,22,.2)}",
      ".fo-gz-wln::first-line{font-variant-caps:normal}",
      ".fo-gz-wln:last-child{border-bottom:none}",
      ".fo-gz-wln.quiet,.fo-gz-nln.quiet,.fo-gz-quiet{font-style:normal;color:rgba(34,30,22,.5)}",
      ".fo-gz-sec p{font-family:Fraunces,Georgia,serif;font-size:13px;line-height:1.6;color:#2A2519;margin:0 0 9px;text-align:justify;hyphens:auto;-webkit-hyphens:auto}",
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
      // the members' line: centred inline links were overlapping each other on
      // a phone when the row wrapped, so it is a wrapping row with a real gap
      ".fo-gz-foot{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:4px 8px;",
      "font-family:Fraunces,Georgia,serif;font-style:normal;font-size:11.5px;line-height:1.6;",
      "color:rgba(34,30,22,.6);text-align:center;margin-top:6px}",
      // the app widens every link into a 44px touch target with a NEGATIVE
      // margin, which is invisible in ordinary prose and makes two links in a
      // flex row sit five pixels on top of each other. Inside this row the
      // margin is cancelled and the gap does the spacing instead.
      ".fo-gz-foot a{flex:0 0 auto;white-space:nowrap;margin:0 !important}",
      ".fo-gz-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;margin:0 -12px;border-radius:12px;color:#8E2F1C;text-decoration:none}",
      ".fo-gz-foot a:hover{text-decoration:underline}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
