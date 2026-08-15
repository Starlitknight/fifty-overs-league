/* ============================================================================
   THE TWO SIDES — what each eleven was worth before a ball was bowled.

   This panel used to mark the AFTERNOON: a top order that made four off
   fifteen was a 2.2, however good the three men were. Read beside a headline
   on the club rating scale it said two different things at once, and a manager
   with three internationals at the top of his order was told his top order was
   worth 2.2 out of ten.

   So it marks the SIDE instead. Six departments - the top three, the middle,
   the tail, the seam, the spin and the hands - each the on-paper quality of
   the men who filled it, and above them the eleven's strength on the same
   scale the world rankings and the transfer market are read in. Nothing here
   moves when a catch goes down. What the afternoon was worth is the day's
   points underneath, which is where performance has always belonged.

   The men are the ones who took the field: a banked card seats all eleven in
   its batting order whether they got an innings or not, so the order the
   departments are cut on is the order the captain filed.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foRat) return; window.__foRat = 1;

  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  // WHERE A BATTING ORDER IS CUT. One to four, five to eight, nine down: the
  // cut From the Pavilion marks a side on, and this panel is the same kind of
  // reading - what an eleven is worth, department by department, off the men's
  // own skills.
  //
  // It is NOT the cut the engine's club marking uses (teamRatings in
  // 00-core.js takes one-to-three, four-to-seven, eight-down, the way a scorer
  // adds up an innings). That marking is a different quantity - what the
  // AFTERNOON was worth, which is what the world rankings stand on - and the
  // two are never printed beside each other, so they are free to cut where
  // each of them means to.
  window.FO_BAT_CUT = { top: [0, 4], middle: [4, 8], tail: [8, 11] };
  var ROWS = ["top", "middle", "tail", "seam", "spin", "field"];

  // A MAN'S QUALITY AT ONE JOB, through the engine's own summaries - the same
  // aggBat/aggBowl/aggField/aggKeep the squad room, the scout report and the
  // player page all print, so a batsman cannot be worth 78 on his own page and
  // something else in the eleven he was picked in.
  //
  // A CARD OUT OF THE ARCHIVE CARRIES THE ANSWER, NOT THE WORKING. The save
  // slims every result past the last two down to the basics of each man
  // (foSlimPlayer in the core), which is why the panel found nothing to mark
  // on an older match. Those men now carry `sk` - the same four aggregates,
  // banked at slimming time - so the marking reads whichever it is handed.
  var SK_KEY = { bat: "b", bowl: "w", keep: "k", field: "f" };
  function agg(p, nm) {
    if (!p) return null;
    try {
      var v = ({ bat: aggBat, bowl: aggBowl, keep: aggKeep, field: aggField })[nm](p);
      if (typeof v === "number" && isFinite(v) && p.skills) return Math.max(0, Math.min(99, Math.round(v)));
    } catch (e) {}
    var s = p.sk && p.sk[SK_KEY[nm]];
    return (typeof s === "number" && isFinite(s)) ? Math.max(0, Math.min(99, Math.round(s))) : null;
  }
  function mean(xs) {
    var v = xs.filter(function (x) { return x != null; });
    return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
  }
  // A DEPARTMENT IS PRINTED IN THE SAME LANGUAGE A MAN IS. Nought to ninety-
  // nine, exactly as a player page, a scout report and the squad room print a
  // skill - so a top three of three 55s reads 55, and nobody has to translate
  // between two scales to see whether that is any good. It also puts the old
  // "2.2 out of ten" beyond reach: there is no ten for it to be out of.
  var sk99 = function (v) { return v == null ? null : Math.max(0, Math.min(99, Math.round(v))); };
  // the engine's own two families: fast, fast-medium and medium are seam, the
  // rest turn it
  function isSpin(p) {
    var t = String(p.bowlType || "");
    return !(t === "fast" || t === "fastMedium" || t === "medium");
  }

  // ---- THE WORLD'S OWN CARD FOR A CLUB --------------------------------------
  //
  // world_squads publishes every club's men as the public card - batting,
  // bowling, fielding, rating - and any device may read any club's, the same
  // way the standings are public. __foCardToPlayer turns a card into an engine
  // player whose aggBat/aggBowl/aggField give back the published figures to the
  // number, so a man read this way marks exactly as he would off a full
  // scorecard.
  //
  // The fetch is late and the panel is not, so a club is asked for once, the
  // marks it can make are made without it, and the panel redraws itself where
  // it stands when the answer lands. A club that cannot be placed, or has
  // nothing published, is remembered as such and never asked again.
  var BOOKS = {}, ASKED = {};
  var SB_RAT = "https://egaipdksvztqqgouriyc.supabase.co";
  var KEY_RAT = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  // the men of one club, keyed by name - set by the fetch, and settable by hand
  // so a caller (or a test) can hand the panel a squad it already has
  window.foRatSquad = function (club, players) {
    var by = {};
    (players || []).forEach(function (c) {
      var q = null;
      try { q = window.__foCardToPlayer ? window.__foCardToPlayer(c) : c; } catch (e) {}
      if (q && q.name) by[q.name] = q;
    });
    BOOKS[club] = by;
    return by;
  };
  window.foRatBook = function (club) {
    if (BOOKS[club] !== undefined) return BOOKS[club];
    if (ASKED[club]) return null;
    ASKED[club] = 1;
    var seat = null;
    try { seat = window.__foWT && window.__foWT.clubSeat && window.__foWT.clubSeat(club); } catch (e) {}
    if (!seat) { BOOKS[club] = null; return null; }
    try {
      fetch(SB_RAT + "/rest/v1/world_squads?country_id=eq." + encodeURIComponent(seat.rid) +
        "&slot=eq." + (seat.slot | 0) + "&select=players", { headers: { apikey: KEY_RAT } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (rows) {
          var men = rows && rows[0] && rows[0].players;
          if (men && men.length) window.foRatSquad(club, men); else BOOKS[club] = null;
          redraw();
        })
        .catch(function () { BOOKS[club] = null; });
    } catch (e) { BOOKS[club] = null; }
    return null;
  };
  // THE PANEL REDRAWS ITSELF WHERE IT STANDS. It is built as a string and
  // inserted by whoever asked for it - a report tab, a scorecard - so the only
  // thing that can put a later answer on the screen is the panel itself.
  var LAST = null;
  function redraw() {
    try {
      var el = document.querySelector("#page .fo-rat");
      if (!el || !LAST) return;
      var html = window.foRatingsPanelHTML(LAST.innings, LAST.result);
      if (!html) return;
      var wrap = document.createElement("div");
      wrap.innerHTML = html;
      if (wrap.firstChild) el.parentNode.replaceChild(wrap.firstChild, el);
    } catch (e) {}
  }

  // THE ELEVEN, DEPARTMENT BY DEPARTMENT. Six skills off the men who filled
  // each job, plus the side's strength on the club rating scale (mean card
  // rating, which is exactly what the squad-strength figure on the club page
  // and the world rankings are built from).
  window.foXIStrength = function (innings, nm) {
    var inns = (innings || []).filter(Boolean), mine = null, theirs = null;
    for (var i = 0; i < inns.length; i++) {
      if (!inns[i]) continue;
      if (!mine && inns[i].batTeam === nm) mine = inns[i];
      if (!theirs && inns[i].bowlTeam === nm) theirs = inns[i];
    }
    if (!mine) return null;
    // A CARD NEED NOT NAME THE SIDE THAT WAS BOWLING - a banked friendly names
    // only who batted - and in a two-innings match the other innings IS the
    // other side's, so it is taken rather than given up on.
    if (!theirs) for (var j = 0; j < inns.length; j++) if (inns[j] && inns[j] !== mine) { theirs = inns[j]; break; }
    // A SAVE SLIMMED BEFORE THE AGGREGATES WERE KEPT cannot be repaired - those
    // skills are gone off the disk - but the cricketer usually is not: he is
    // still on a roster, and his card is what "on paper" means. His rating THAT
    // DAY stays the card's; only the departments are read off the man. A
    // cricketer nobody has any more is simply left as he came.
    // AND THE OPPONENT IS NOT ON ANY ROSTER THIS DEVICE HOLDS, which is why one
    // column of the table could be marked and the other left blank - the one
    // thing a comparison must never do. What fills it is the world's own
    // published card for that club (world_squads, readable by anybody, the same
    // door the club pages and the player pages use). NOT a regenerated squad:
    // the generator makes the right men but not the right cricketers, because
    // the World Service calibrates a club onto its rung after it deals them.
    // See foRatBook below - it arrives late and the panel redraws itself.
    var resolve = function (p, club) {
      if (!p || p.skills || p.sk) return p;
      var f = null, src = null;
      try { f = (typeof findPlayer === "function") ? findPlayer(p.name) : null; } catch (e) {}
      if (f && f.p && f.p.skills) src = f.p;
      if (!src) { var bk = window.foRatBook(club); src = (bk && bk[p.name]) || null; }
      if (!src || !src.skills) return p;
      var q = {}; for (var k in src) q[k] = src[k];
      if (typeof p.rating === "number" && p.rating > 0) q.rating = p.rating;
      return q;
    };
    var xi = (mine.bat || []).map(function (b) { return b && b.p; })
      .filter(function (p) { return p && p.name; })
      .map(function (p) { return resolve(p, nm); });
    // a card with no men on it - a hand-built fixture, a card rebuilt from the
    // commentary - is left unmarked rather than marked wrongly
    if (xi.length < 5) return null;
    var cut = window.FO_BAT_CUT;
    var batOf = function (a, b) {
      return sk99(mean(xi.slice(a, b).map(function (p) { return agg(p, "bat"); })));
    };
    // THE ATTACK IS THE MEN WHO BOWLED, not the men who could have. A side
    // that carries a spinner and never gives him the ball has no spin in this
    // match, and a seam attack of four is not judged on the part-timer who was
    // never thrown it. The overs beside each stand for the spells From the
    // Pavilion prints there: how much of the fifty this half of the attack got.
    // HOW LONG HE BOWLED IS NOT ALWAYS WRITTEN THE SAME WAY. The engine's own
    // card counts balls (`b`); a card served or rebuilt for a page counts
    // `balls`, or prints overs in the scorer's O.B - eight point three being
    // fifty-one deliveries and not eight and a third. Reading only the first
    // of the four is why a report out of the archive had no attack on it at
    // all: the men were there, and every one of them had bowled nought.
    var ballsOf = function (br) {
      if (br.b > 0) return br.b | 0;
      if (br.balls > 0) return br.balls | 0;
      var o = br.o != null ? br.o : br.overs;
      if (o == null) return 0;
      var m = /^(\d+)(?:\.(\d))?$/.exec(String(o));
      return m ? (+m[1] * 6 + (+m[2] || 0)) : 0;
    };
    var spells = [];
    for (var bk in ((theirs && theirs.bowlers) || {})) {
      var br = theirs.bowlers[bk];
      if (!br) continue;
      var bb = ballsOf(br);
      if (!bb) continue;
      spells.push({ p: resolve(br.p || { name: bk }, nm), balls: bb });
    }
    var bowlOf = function (list) {
      if (!list.length) return null;
      return sk99(mean(list.map(function (q) { return agg(q.p, "bowl"); })));
    };
    var oversOf = function (list) {
      if (!list.length) return null;
      var b = list.reduce(function (a, q) { return a + q.balls; }, 0);
      return Math.round(b / 6);
    };
    var seamers = spells.filter(function (q) { return !isSpin(q.p); });
    var spinners = spells.filter(function (q) { return isSpin(q.p); });
    // the hands are the whole eleven's ground fielding with the gloves folded
    // in - one man in four hundred deliveries is the keeper's, and the other
    // ten are everybody's
    var fld = mean(xi.map(function (p) { return agg(p, "field"); }));
    var kp = xi.filter(function (p) { return p.keeper; })[0];
    var kv = kp ? agg(kp, "keep") : null;
    var rt = mean(xi.map(function (p) { return (typeof p.rating === "number" && p.rating > 0) ? p.rating : null; }));
    var s = {
      n: xi.length,
      rating: rt == null ? null : Math.round(rt),
      top: batOf(cut.top[0], cut.top[1]),
      middle: batOf(cut.middle[0], cut.middle[1]),
      tail: batOf(cut.tail[0], cut.tail[1]),
      seam: bowlOf(seamers), seamOv: oversOf(seamers),
      spin: bowlOf(spinners), spinOv: oversOf(spinners),
      field: sk99(fld == null ? null : (kv == null ? fld : 0.75 * fld + 0.25 * kv))
    };
    // nothing to say about a side is not the same as a side worth nothing
    if (s.rating == null && !ROWS.some(function (k) { return s[k] != null; })) return null;
    return s;
  };

  // the names From the Pavilion gives them, so a manager who reads both games
  // is reading one vocabulary
  var LABEL = { top: "Batting - Top Order", middle: "Batting - Middle Order",
    tail: "Batting - Tail", seam: "Bowling - Seam", spin: "Bowling - Spin",
    field: "Fielding/Keeping" };
  var OVERS = { seam: "seamOv", spin: "spinOv" };
  // THE SKILL TONES THE REST OF THE GAME USES, so a department that would be
  // painted red on a player's own page is painted red here. A tail reading
  // low is not a fault in the marking: a tail IS low, and a side whose eight
  // and nine can bat shows it by reading higher than the next side's.
  var band = function (v) { return v >= 75 ? "hot" : v >= 50 ? "good" : v >= 30 ? "ok" : "poor"; };
  // AND THE SIDE'S OWN FIGURE, banded on the printed scale rather than on an
  // average of the six - a top order and a tail are not the same quantity and
  // must not be averaged into one.
  //
  // B2 REANCHORED THESE. The old thresholds were foRate's old anchors - a club
  // founded this morning read 10k and an England flagship 60k - and foRate is
  // the identity now, so the figure is a club's mean XI CARD times a thousand.
  // Measured over all 256 clubs: 32.1 at the weakest to 78.4 at the strongest,
  // median 55.9. Left alone, every club from the middle of the second division
  // upward would have painted "hot".
  var strBand = function (v) { return v >= 70000 ? "hot" : v >= 55000 ? "good" : v >= 38000 ? "ok" : "poor"; };

  // The `result` argument is not needed - a side's strength is a function of
  // the men in it - but it is kept so callers that have the record to hand can
  // pass it, and so the signature does not change under them.
  window.foRatingsPanelHTML = function (innings, result) {
    var inns = (innings || []).filter(Boolean);
    var names = [];
    inns.forEach(function (inn) {
      // a banked card can carry the STRING "undefined" where a bowling side
      // was never named - a ghost that walks straight past a falsy check
      [inn.batTeam, inn.bowlTeam].forEach(function (n) {
        if (n && n !== "undefined" && n !== "null" && names.indexOf(n) < 0) names.push(n);
      });
    });
    if (!names.length) return "";
    LAST = { innings: inns, result: result || null };
    // the panel carries its own stylesheet wherever it is asked for - it is not
    // only the scorecard's any more, and unstyled marks are worse than none
    try { css(); } catch (eC) {}
    var sides = [];
    names.forEach(function (n) {
      var s = null;
      try { s = window.foXIStrength(inns, n); } catch (eS) {}
      if (s) sides.push({ nm: n, s: s });
    });
    // AND THE READER'S OWN CLUB GOES FIRST. He is comparing his side with
    // theirs, not two strangers, and the column he cares about should be the
    // one his eye lands on. Everywhere else the order is the card's.
    try {
      var mine = GD.teams[App.teamIx] && GD.teams[App.teamIx].name;
      if (mine && sides.length === 2 && sides[1].nm === mine) sides.reverse();
    } catch (eM) {}
    var pts = [];
    try { pts = (window.foFantasyPoints && window.foFantasyPoints(inns)) || []; } catch (e) {}
    var best = pts.slice(0, 5).map(function (p, i) {
      return "<div class='fo-rat-p'><i>" + (i + 1) + "</i><b>" + E(p.n) + "</b><span>" + E(p.team) + "</span>" +
        "<u>" + p.pts + "</u></div>";
    }).join("");
    if (!sides.length && !best) return "";

    // ONE TABLE, NOT TWO COLUMNS OF CARDS. Both sides were drawn as blocks
    // side by side, which is a comparison on a desk and no comparison at all
    // on a phone: the grid collapses, one side sits above the other, and a
    // reader who wants to know whether his top order outguns theirs has to
    // remember a number while he scrolls. A ratings table is read ACROSS, so
    // it is built across - label, mine, theirs - and it stays that way at any
    // width, the way From the Pavilion has always printed it.
    //
    // The same rows on both sides, too: one side with no spinner used to be a
    // row shorter than the other, so every department below it read against
    // the wrong department opposite. A side with nobody in a department shows
    // a dash, which is itself worth knowing.
    var shownRows = ROWS.filter(function (k) {
      return sides.some(function (x) { return x.s[k] != null; });
    });
    // WHO WINS EACH LINE. The point of two columns is the difference between
    // them, so the better of the two is said in the ink rather than left for
    // the reader to work out - and where they are level, neither is.
    var lead = function (vals) {
      var real = vals.filter(function (v) { return v != null; });
      if (real.length < 2) return null;
      var hi = Math.max.apply(null, real), lo = Math.min.apply(null, real);
      return hi === lo ? null : hi;
    };
    var cell = function (v, hi, fmt, sub) {
      if (v == null) return "<b class='none'>&ndash;</b>";
      var cls = hi == null ? "lvl" : (v === hi ? "up" : "dn");
      return "<b class='" + cls + "'>" + (fmt ? fmt(v) : v) +
        (sub != null ? "<em>(" + sub + ")</em>" : "") + "</b>";
    };
    var head = "<div class='fo-rat-row hd'><span></span>" +
      sides.map(function (x) { return "<i>" + E(x.nm) + "</i>"; }).join("") + "</div>";
    var body = shownRows.map(function (k) {
      var vals = sides.map(function (x) { return x.s[k]; });
      var hi = lead(vals);
      return "<div class='fo-rat-row'><span>" + LABEL[k] + "</span>" +
        vals.map(function (v, i2) {
          // the overs this half of the attack sent down, beside its mark
          var ov = OVERS[k] ? sides[i2].s[OVERS[k]] : null;
          return cell(v, hi, null, ov);
        }).join("") + "</div>";
    }).join("");
    // and the side's own figure, printed through foRate so the whole game reads
    // one scale: the same number the club page, the dossiers and the world
    // rankings put on a squad. It sits at the foot, where a ratings table has
    // always put its total.
    var strs = sides.map(function (x) {
      return x.s.rating == null ? null : (window.foRate ? window.foRate(x.s.rating) : x.s.rating);
    });
    var foot = strs.some(function (v) { return v != null; })
      ? "<div class='fo-rat-row ft'><span>Overall</span>" +
        strs.map(function (v) { return cell(v, lead(strs), function (n) { return n.toLocaleString(); }); }).join("") +
        "</div>"
      : "";
    var table = "<div class='fo-rat-tbl" + (sides.length === 1 ? " one" : "") + "'>" +
      head + body + foot + "</div>";

    // AND THE PANEL IS NAMED AFTER WHAT IS IN IT. A card too old or too thin
    // to mark a side on left "The two sides" standing over nothing but the
    // points - a heading promising a thing the panel had not got.
    return "<div class='panel fo-rat'><h4>" + (sides.length ? "Match ratings" : "The day&rsquo;s points") +
      "</h4><div class='pad'>" +
      (sides.length ? table : "") +
      (best ? (sides.length ? "<div class='fo-rat-sub'>The day&rsquo;s points</div>" : "") + best : "") +
      "</div></div>";
  };

  function css() {
    if (document.getElementById("fo-rat-css")) return;
    var s = document.createElement("style"); s.id = "fo-rat-css";
    s.textContent = [
      // THE TABLE. Three tracks - the department, then a column a side - and
      // the number columns are fixed so the two sides line up down the page
      // however long a club calls itself. It never becomes one column: that
      // is the whole point of it.
      // a ratings table is a narrow thing: given a whole desktop it would put
      // the department at one edge and the figures at the other, which is a
      // comparison nobody can make in one glance
      ".fo-rat-tbl{display:block;font-variant-numeric:tabular-nums;max-width:620px}",
      ".fo-rat-row{display:grid;grid-template-columns:minmax(0,1fr) 120px 120px;align-items:center;" +
        "gap:6px;padding:8px 0;border-top:1px solid rgba(12,27,51,.08)}",
      ".fo-rat-tbl.one .fo-rat-row{grid-template-columns:minmax(0,1fr) 120px}",
      ".fo-rat-row>span{font:500 13px/1.3 Manrope,sans-serif;color:rgba(12,27,51,.62);min-width:0;" +
        "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-rat-row>b{text-align:right;font:700 15px/1.1 Manrope,sans-serif;color:#0C1B2E}",
      // the overs beside a bowling mark, quiet enough not to be read as part of it
      ".fo-rat-row>b em{font-style:normal;font-weight:600;font-size:11px;margin-left:3px;opacity:.62}",
      // the two club names, which are a heading and not a row of figures
      ".fo-rat-row.hd{border-top:0;padding-top:0;padding-bottom:6px;" +
        "border-bottom:1px solid rgba(12,27,51,.16)}",
      // A CLUB'S NAME BREAKS BETWEEN ITS WORDS OR NOT AT ALL. Wrapping anywhere
      // fits the column and reads as gibberish - Leicestershire came out as
      // "LEICESTERS HIRE", which is not a heading, it is a mistake. It takes a
      // second line at a space and a single long word simply gets the room.
      //
      // AND IT IS NOT SHOUTED. Every other micro-label in the room is set in
      // caps, but caps cost about a sixth of the width for nothing, and
      // "LEICESTERSHIRE" then outgrew its column and painted over the club
      // beside it. A club is a name, not a label; it is set like one - which is
      // how the pavilion prints it too. overflow:hidden is the last guard, for
      // a device that never loaded the face and renders it wider still.
      ".fo-rat-row.hd>i{font-style:normal;text-align:right;min-width:0;white-space:normal;" +
        "overflow-wrap:normal;word-break:keep-all;hyphens:none;overflow:hidden;" +
        "font:600 11.5px/1.25 Manrope,sans-serif;align-self:end;color:rgba(12,27,51,.62)}",
      // the total, at the foot where a ratings table has always put it
      ".fo-rat-row.ft{border-top:1.5px solid rgba(12,27,51,.22);margin-top:2px;padding-top:10px}",
      ".fo-rat-row.ft>span{font-weight:700;color:#0C1B2E;letter-spacing:.01em}",
      ".fo-rat-row.ft>b{font-size:16.5px}",
      // who won the line: said in the ink, so the difference is the thing read
      ".fo-rat .up{color:#0E6B4C}",
      ".fo-rat .dn{color:rgba(12,27,51,.45);font-weight:600}",
      ".fo-rat .lvl{color:rgba(12,27,51,.75)}",
      ".fo-rat .none{color:rgba(12,27,51,.28);font-weight:600}",
      // a narrow phone gives the numbers a little less room, never a column less
      "@media(max-width:430px){.fo-rat-row{grid-template-columns:minmax(0,1fr) 92px 92px;gap:4px}" +
        ".fo-rat-tbl.one .fo-rat-row{grid-template-columns:minmax(0,1fr) 92px}" +
        ".fo-rat-row>span{font-size:12px}.fo-rat-row>b{font-size:14.5px}" +
        ".fo-rat-row.ft>b{font-size:15px}.fo-rat-row.hd>i{font-size:10px}}",
      ".fo-rat-sub{margin:15px 0 5px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:rgba(12,27,51,.4)}",
      ".fo-rat-p{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid rgba(12,27,51,.07);font:500 13px/1.3 Manrope,sans-serif}",
      ".fo-rat-p i{font-style:normal;font:700 11px/1 Manrope,sans-serif;color:rgba(12,27,51,.35);width:12px}",
      ".fo-rat-p b{font-weight:600}",
      ".fo-rat-p span{flex:1;min-width:0;font-size:10.5px;color:rgba(12,27,51,.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-rat-p u{text-decoration:none;font:700 13px/1 Manrope,sans-serif;color:#0C1B2E;font-variant-numeric:tabular-nums}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // EVERY SCORECARD GETS ONE. The page is wrapped rather than watched: the
  // innings it was built from are in hand at the moment it paints, which the
  // live match state is not a second later.
  function append(innings, result) {
    try {
      var page = document.getElementById("page"); if (!page) return;
      if (page.querySelector(".fo-rat")) return;
      if (!innings || !innings[1]) return;            // one innings is no match to mark
      css();
      var html = window.foRatingsPanelHTML(innings, result || null);
      if (!html) return;
      var wrap = document.createElement("div");
      wrap.innerHTML = html;
      page.appendChild(wrap.firstChild);
    } catch (e) {}
  }
  function inningsFor(q) {
    try {
      if (q && q.i !== undefined && App.results[+q.i]) return App.results[+q.i].innings;
      if (window.M && M.innings) return M.innings;
      var last = (App.results || [])[(App.results || []).length - 1];
      return last && last.innings;
    } catch (e) { return null; }
  }
  // the same record's result, so a caller that has it can hand it over
  function resultFor(q) {
    try {
      if (q && q.i !== undefined && App.results[+q.i]) return App.results[+q.i].result;
      if (window.M && M.result) return M.result;
      var last = (App.results || [])[(App.results || []).length - 1];
      return last && last.result;
    } catch (e) { return null; }
  }
  function hook() {
    if (typeof window.pgScorecard !== "function" || window.pgScorecard.__foRat) return;
    var prev = window.pgScorecard;
    window.pgScorecard = function (q) {
      var out = prev.apply(this, arguments);
      try {
        window.__foRatLast = inningsFor(q); window.__foRatLastRes = resultFor(q);
        append(window.__foRatLast, window.__foRatLastRes);
      } catch (e) {}
      return out;
    };
    window.pgScorecard.__foRat = 1;
  }
  hook();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hook);
  // a backstop for the paint that beat the hook: the innings the card was
  // built from are remembered, so a late pass never needs the live match
  setInterval(function () {
    hook();
    try {
      if ((location.hash || "").split("?")[0] !== "#/scorecard") return;
      if (document.querySelector("#page .fo-rat")) return;
      append(window.__foRatLast || inningsFor(null), window.__foRatLastRes || resultFor(null));
    } catch (e) {}
  }, 1200);
})();
