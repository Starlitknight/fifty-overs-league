/* ============================================================================
   THE FIFTY OVERS GAZETTE (#/paper) — the morning paper, printed once a day by
   the umpire and read identically by every device. This file FETCHES AND SETS
   IT. It composes nothing and it writes nothing, which is the property worth
   keeping: a newspaper a reader can edit is not a newspaper.

   THE PAGE, in order:

     THE MASTHEAD     letterspaced caps over a double rule; the folio carries
                      the season's own day and the season's public name
     THE LEAD         rubric, head, an italic deck carrying THE NUMBERS, then
                      the report set as book paragraphs in one 38-em measure
     * * *            an asterism, where a newspaper would put a rule
     OF NOTE          the day's individual cricket, as entries
     FROM ABROAD      everything that happened somewhere else, as entries
     THE DAY'S CRICKET  the results, RUN ON as semicolon-separated prose the
                      way an almanack prints them - and filtered to the
                      reader's own nation, which is the only thing on this
                      page that differs between two readers (see gzNation)
     COMMENT          one pundit line, centred under a hairline

   IT IS A YEARBOOK, NOT A BROADSHEET. The previous front page was a
   two-column grid of bordered boxes full of one-line rows, and it read as
   printed scorecards rather than as a paper. The cause was structural: a
   bordered box in a grid is a dashboard shape, twenty wire lines with dotted
   rules under them is a list, and neither becomes journalism by being
   repainted. So there are no boxes here at all, no accent colour, and one
   book face - the hierarchy is entirely type.
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
  // THE DOOR TO THE SERVED WORLD. Every module that reads it declares these for
  // itself - they are `var` inside each IIFE, not globals - and this one used
  // them without declaring them, which threw a ReferenceError on the first
  // fetch. The catch below turned that into GZ.dead and the page printed "the
  // presses are quiet" over a database with a perfectly good paper in it.
  // A silent catch over a missing name is how a typo becomes a blank page.
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
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
    } catch (e) {
      // say it out loud. This exact catch hid a ReferenceError for a whole
      // deploy, and "the presses are quiet" is indistinguishable from a real
      // quiet day unless somebody is told which one it is.
      try { console.warn("gazette: could not reach the press -", e && e.message); } catch (e2) {}
      GZ.busy = false; GZ.dead = true;
    }
    return null;
  }
  // ---- WHOSE NATION IS READING ----------------------------------------------
  //
  // The ONLY thing on this page that differs between two readers, and it is
  // deliberately not a fact the press knows. The paper the umpire prints is one
  // paper: same lead, same briefs, same words, and there is nowhere in a story
  // to say whose club it is - a test in the server holds that. What changes here
  // is which SECTION OF THE SAME DOCUMENT gets printed, the way two people
  // reading one newspaper turn to different pages of the results.
  //
  // That distinction is worth keeping straight, because it is the difference
  // between a personalised paper (which this must never become) and a reader who
  // does not want a hundred and fifty scorelines from leagues he has never seen.
  //
  // A reader with no club yet has no nation to turn to, and gets the lot - which
  // is the honest answer to "whose results?" before he has picked a side.
  var NAT = null, NAT_READ = 0;
  function gzNation() {
    try { if (window.__foWorldClaim && window.__foWorldClaim.country) return window.__foWorldClaim.country; } catch (e) {}
    if (NAT_READ) return NAT;
    NAT_READ = 1;
    try {
      var c = JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (c && c.country) NAT = c.country;
    } catch (e2) {}
    return NAT;
  }

  // ---- AN ARTICLE ------------------------------------------------------------
  //
  // Rubric, head, deck, then the report - and the report is set as real
  // paragraphs rather than one block, because the almanack's whole effect is a
  // single measure of book-set text and a wall of it defeats that.
  //
  // The page never picks a phrase. Two readers must see the same sentence, and
  // the only way to be sure of that is that the sentence was written once, by
  // the press, into the row they both read.
  function gzArticle(st) {
    if (!st) return "";
    var body = String(st.body || st.brief || "");
    // the press writes in sentences; the page decides where the paragraphs fall.
    // Two sentences to a paragraph reads as a report - one reads as a list, and
    // a list is what this page was accused of being.
    // split on ". " by hand rather than with a lookbehind. A regex literal is
    // compiled when the SCRIPT is parsed, not when the function runs, so a
    // lookbehind an older Safari does not know throws a SyntaxError that takes
    // this entire module out - not just the paper. The cheap version is exact.
    var parts = body.split(". "), paras = [], i, cur = "";
    for (i = 0; i < parts.length; i++)
      if (i < parts.length - 1) parts[i] = parts[i] + ".";
    // BY LENGTH, NOT BY COUNT. Two sentences a paragraph sounds tidy and is
    // not: this file's sentences run from four words to thirty, so a fixed
    // count gave a first paragraph of a line and a half with "5 runs." orphaned
    // on its own line, then a paragraph twice its size. Filling to a target
    // measure instead makes every paragraph about three lines whatever the
    // press wrote, and a body of any length sets the same way.
    for (i = 0; i < parts.length; i++) {
      cur = cur ? cur + " " + parts[i] : parts[i];
      // ...but never leave a last sentence stranded as its own paragraph
      if (cur.length >= 170 && i < parts.length - 1) { paras.push(cur); cur = ""; }
    }
    if (cur) paras.push(cur);
    return "<div class='fo-gz-hd'>" +
        "<div class='fo-gz-rub'>" + E(gzKicker(st)) + "</div>" +
        "<h2>" + E(st.headline || "") + "</h2>" +
        (st.deck ? "<div class='fo-gz-deck'>" + E(st.deck) + "</div>" : "") +
      "</div>" +
      paras.map(function (p) { return "<p>" + E(p) + "</p>"; }).join("");
  }

  // an entry in a column: the thing, then what it was, in italic under it
  function gzEntry(st) {
    if (!st) return "";
    var sub = st.brief && st.brief !== st.headline ? st.brief : gzKicker(st);
    return "<div class='fo-gz-ent'><b>" + E(st.headline || "") + "</b>" +
      "<i>" + E(sub) + "</i></div>";
  }

  // ---- THE DAY'S CRICKET, RUN ON ---------------------------------------------
  //
  // An almanack does not print forty rows with a dotted rule under each. It
  // prints the country in small caps and then the day's results as one
  // semicolon-separated sentence, and forty games become six lines. That is the
  // single change that stops this section reading as a printout, and it is why
  // the results are the last thing on the page rather than a table in the middle
  // of it.
  function gzRunOn(iss) {
    var rows = iss.scoreboard || [], names = iss.nations || {}, mine = gzNation();
    if (!rows.length) return "";
    var only = mine && rows.some(function (r) { return r.country === mine; }) ? mine : null;
    var use = only ? rows.filter(function (r) { return r.country === only; }) : rows;
    var order = [], byNat = {};
    use.forEach(function (r) {
      var c = r.country || "";
      if (!byNat[c]) { byNat[c] = []; order.push(c); }
      // `line` names both sides; `text` names only the winner and is what an
      // issue printed before the desk learned to write the sentence.
      byNat[c].push(r.line || r.text || (r.home + " v " + r.away));
    });
    var head = only
      ? "The day&rsquo;s cricket &middot; " + E(names[only] || only)
      : "The day&rsquo;s cricket";
    return "<div class='fo-gz-runon'><h3>" + head + "</h3>" +
      order.map(function (c) {
        return "<div class='fo-gz-grp'>" +
          (only ? "" : "<b>" + E(names[c] || c) + ".</b> ") +
          E(byNat[c].join("; ")) + ".</div>";
      }).join("") +
      (only ? "<div class='fo-gz-foot-note'>Results from the rest of the world are " +
              "printed in each nation&rsquo;s own edition.</div>" : "") +
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
    var mast = function (extra) {
      return "<div class='fo-gz-mast'>" +
        "<h1>The Fifty Overs Gazette</h1>" +
        "<div class='fo-gz-rl'></div>" +
        "<div class='fo-gz-fl'>" + (extra || "") + "</div></div>";
    };
    if (!iss) {
      page.innerHTML = "<div class='fo-gz'><div class='fo-gz-in'>" + mast("") +
        "<p class='fo-gz-quiet'>" + (GZ.dead
          ? "The presses are quiet. Today&rsquo;s edition has not reached us."
          : "The paper is being set&hellip;") + "</p></div></div>";
      return;
    }
    var day = iss.__day | 0;
    // A FINAL IS NOT A TUESDAY. Two days a season the whole world watches one
    // match; the press flags it and the masthead admits it, which in an almanack
    // means a line of type rather than a different layout - the layout is the
    // point of the treatment and changing it would cost more than it buys.
    var big = !!iss.tournament;
    // THE FOLIO. The season's own day and the season's public name, sent by the
    // press: this used to count from the epoch and print the row index, which
    // put "Day 12 of season 1" under an app header reading DAY 5 · SEASON 137.
    // An issue set before that fix carries neither and falls back to its own
    // dateline string.
    var folio = E(iss.dateline || dateline()) +
      " &nbsp;&middot;&nbsp; one edition, the whole world over" +
      (big ? " &nbsp;&middot;&nbsp; <em>finals day</em>" : "");

    // THE TWO COLUMNS UNDER THE ORNAMENT. Of note is the day's individual
    // cricket; from abroad is everything that happened somewhere else. Both are
    // ENTRIES, not wire lines - a thing and then what it was - because the
    // single-line dotted row is what made twenty stories read as one list.
    var notes = (iss.briefs || []).map(gzEntry).join("");
    var world = (iss.back || []).map(gzEntry).join("");
    if (iss.second) notes = gzEntry(iss.second) + notes;

    page.innerHTML = "<div class='fo-gz'><div class='fo-gz-in'>" +
      mast(folio) +
      (iss.thin
        ? "<p class='fo-gz-quiet'>A quiet day. No cricket of consequence reached us " +
          "before we went to press.</p>"
        : "<div class='fo-gz-art'>" + gzArticle(iss.lead) + "</div>" +
          // AN ASTERISM, NOT A FLEURON. This was three ❧ (U+2761), which is in
          // almost no phone's default serif and rendered as three grey specks
          // that looked like dirt on the screen. Asterisks are in every font
          // that has ever existed, and three of them spaced apart is the break
          // an actual book uses.
          "<div class='fo-gz-orn'>&#42; &#42; &#42;</div>" +
          "<div class='fo-gz-two'>" +
            "<div><h3>Of note</h3>" +
              (notes || "<div class='fo-gz-ent quiet'><i>Nothing else to report.</i></div>") +
            "</div>" +
            "<div><h3>From abroad</h3>" +
              (world || "<div class='fo-gz-ent quiet'><i>&mdash;</i></div>") +
            "</div>" +
          "</div>" +
          gzRunOn(iss) +
          (iss.comment ? "<div class='fo-gz-cmt'>" + E(iss.comment) + "</div>" : "")) +
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

  // ---- THE ALMANACK ----------------------------------------------------------
  //
  // Not a newspaper: a yearbook. The front page was a two-column grid of
  // bordered boxes, every one of them full of one-line rows, and the owner's
  // verdict on it was that it read like printed scorecards rather than a paper.
  // He was right, and the reason was structural rather than decorative - a
  // bordered box in a grid is a DASHBOARD shape, and twenty wire lines with
  // dotted rules under them is a LIST. Neither is journalism no matter what
  // colour it is painted.
  //
  // So there are no boxes here at all. One measure of book-set text for the
  // lead, an ornament where a newspaper would put a rule, two columns of
  // entries, and the day's cricket run on as prose the way Wisden actually
  // prints it. The hierarchy is entirely type: size, italic, small caps, and
  // the space between things.
  //
  // ONE FAMILY, and it is a book face rather than a newsprint face. The app
  // names Fraunces in its stylesheets and loads no webfont anywhere, so every
  // page in this game is really rendering Georgia; naming a stack that ends in
  // Georgia is honest about that and picks up Hoefler Text or Baskerville where
  // they exist, which is most phones.
  //
  // NO ACCENT COLOUR. Deliberately - the oxblood that used to mark the kickers
  // was doing the work that a rubric in small caps does better, and an almanack
  // with a spot colour in it is a brochure.
  function foGzCss() {
    if (document.getElementById("fo-gz-css")) return;
    var s = document.createElement("style"); s.id = "fo-gz-css";
    var SER = "'Hoefler Text',Baskerville,'Book Antiqua','Palatino Linotype',Georgia,serif";
    s.textContent = [
      "html body.ftpskin.fo-gz-on,html body.fo-gz-on{background:#F5F1E7 !important}",
      "html body.fo-gz-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-gz-on #page{padding:0 !important;margin:0 !important;background:transparent !important}",
      ".fo-gz{min-height:100vh;padding:70px 22px 46px;color:#241F17;font-family:" + SER + "}",
      ".fo-gz-in{max-width:960px;margin:0 auto}",
      // ---- masthead: letterspaced caps over a double rule, italic folio ----
      ".fo-gz-mast{text-align:center;margin:0 0 34px}",
      ".fo-gz-mast h1{font-family:" + SER + ";font-weight:400;font-size:clamp(23px,5vw,42px);",
      "letter-spacing:.17em;text-transform:uppercase;line-height:1.22;margin:0 0 12px;color:#241F17}",
      ".fo-gz-rl{border-top:1px solid #241F17;border-bottom:1px solid #241F17;height:3px;",
      "width:min(600px,100%);margin:0 auto 11px}",
      ".fo-gz-fl{font-size:11.5px;font-style:italic;color:#5E5545;letter-spacing:.03em;line-height:1.5}",
      ".fo-gz-fl em{font-style:normal;font-variant:small-caps;letter-spacing:.12em}",
      // ---- the lead: one measure, book-set ----
      ".fo-gz-art{max-width:38em;margin:0 auto}",
      ".fo-gz-hd{text-align:center;margin:0 0 22px}",
      ".fo-gz-rub{font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:#6B6250;margin:0 0 13px}",
      ".fo-gz-hd h2{font-family:" + SER + ";font-weight:400;font-size:clamp(23px,4vw,34px);",
      "line-height:1.18;margin:0 0 12px;color:#241F17;text-wrap:balance}",
      // the deck is the NUMBERS, in italic, so the report underneath never has
      // to stop and recite a scoreline - which was the sentence that made this
      // page read like a printout in the first place
      ".fo-gz-deck{font-style:italic;font-size:15px;color:#4C442F;line-height:1.5;",
      "max-width:34em;margin:0 auto;font-variant-numeric:oldstyle-nums}",
      ".fo-gz-art p{font-size:15.5px;line-height:1.74;margin:0;text-indent:1.5em;",
      "text-align:justify;hyphens:auto;-webkit-hyphens:auto;color:#2C2619}",
      ".fo-gz-art p:first-of-type{text-indent:0}",
      ".fo-gz-art p:first-of-type::first-line{font-variant:small-caps;letter-spacing:.045em}",
      // ---- the ornament, where a newspaper would put a rule ----
      ".fo-gz-orn{text-align:center;color:#8A7F68;letter-spacing:.7em;margin:30px 0 26px;font-size:13px}",
      // ---- two columns of entries ----
      ".fo-gz-two{display:grid;grid-template-columns:1fr 1fr;gap:0 40px;max-width:56em;margin:0 auto}",
      "@media(max-width:760px){.fo-gz-two{grid-template-columns:minmax(0,1fr);gap:0}}",
      ".fo-gz-two>div+div{border-left:1px solid #D8CFB9;padding-left:40px}",
      "@media(max-width:760px){.fo-gz-two>div+div{border-left:none;padding-left:0;margin-top:28px}}",
      ".fo-gz h3{font-family:" + SER + ";font-weight:400;font-size:12px;letter-spacing:.3em;",
      "text-transform:uppercase;text-align:center;color:#241F17;margin:0 0 16px;padding:0 0 8px;",
      "border-bottom:1px solid #241F17}",
      ".fo-gz-ent{margin:0 0 14px}",
      ".fo-gz-ent b{display:block;font-weight:400;font-size:16px;line-height:1.22;margin:0 0 2px;color:#241F17}",
      ".fo-gz-ent i{font-style:italic;font-size:13.5px;line-height:1.5;color:#4C442F}",
      ".fo-gz-ent.quiet i{color:#8A7F68}",
      // ---- the day's cricket, run on ----
      ".fo-gz-runon{max-width:56em;margin:32px auto 0;padding-top:22px;border-top:1px solid #241F17}",
      ".fo-gz-grp{margin:0 0 12px;font-size:13px;line-height:1.66;color:#3A3327;text-align:justify;",
      "hyphens:auto;-webkit-hyphens:auto;font-variant-numeric:oldstyle-nums}",
      ".fo-gz-grp b{font-weight:400;font-variant:small-caps;letter-spacing:.11em;font-size:14px;color:#241F17}",
      ".fo-gz-foot-note{font-style:italic;font-size:12px;color:#8A7F68;text-align:center;margin:14px 0 0}",
      // ---- comment, centred under a hairline ----
      ".fo-gz-cmt{max-width:36em;margin:32px auto 0;text-align:center;font-style:italic;",
      "font-size:15.5px;line-height:1.62;padding-top:22px;border-top:1px solid #D8CFB9;color:#3A3327}",
      ".fo-gz-quiet{max-width:34em;margin:44px auto;text-align:center;font-style:italic;",
      "font-size:15px;line-height:1.6;color:#6B6250}",
      // the members' line: the app widens every link into a 44px touch target
      // with a NEGATIVE margin, which is invisible in ordinary prose and makes
      // two links in a flex row sit five pixels on top of each other. Inside
      // this row the margin is cancelled and the gap does the spacing.
      ".fo-gz-foot{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;",
      "gap:4px 8px;font-size:11.5px;line-height:1.6;color:#6B6250;text-align:center;",
      "margin:44px 0 0;padding-top:18px;border-top:1px solid #D8CFB9}",
      ".fo-gz-foot a{flex:0 0 auto;white-space:nowrap;margin:0 !important}",
      ".fo-gz-foot a{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;",
      "margin:0 -12px;border-radius:12px;color:#5A3A22;text-decoration:none}",
      ".fo-gz-foot a:hover{text-decoration:underline}"
    ].join("\n");
    document.head.appendChild(s);
  }
})();
