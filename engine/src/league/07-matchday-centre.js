  // ===========================================================================
  //  MATCHDAY CENTRE · replay the latest round like a live blog, from the
  //  worm data every result already carries. Plus the round's best performer.
  // ===========================================================================
  function foLeagueRounds() {
    var out = {};
    try { (App.results || []).forEach(function (r) { if (r.comp === "league" && r.round != null) (out[r.round] = out[r.round] || []).push(r); }); } catch (e) {}
    return out;
  }
  function foLastRoundIx() {
    var ks = Object.keys(foLeagueRounds()).map(Number);
    return ks.length ? Math.max.apply(null, ks) : -1;
  }
  function foPerfList(results) {
    var out = [];
    (results || []).forEach(function (r) {
      (r.innings || []).forEach(function (inn) {
        if (!inn) return;
        (inn.bat || []).forEach(function (b) {
          if (!b || !b.p || !(b.b > 0)) return;
          var sc = b.r + (b.f6 || 0) * 2 + (b.f4 || 0) + (b.r >= 50 ? 12 : 0) + (b.r >= 100 ? 25 : 0);
          out.push({ name: b.p.name, club: inn.batTeam, line: b.r + (b.out ? "" : "*") + " (" + b.b + ")", sc: sc, kind: "bat", r: b.r, b: b.b });
        });
        for (var k in (inn.bowlers || {})) {
          var br = inn.bowlers[k]; if (!br || !br.p) continue;
          var ov = br.b / 6, econ = ov ? br.r / ov : 0;
          var sc2 = br.w * 21 - econ * 1.5 + (br.w >= 4 ? 14 : 0);
          out.push({ name: k, club: inn.bowlTeam, line: br.w + "/" + br.r + " (" + Math.floor(br.b / 6) + (br.b % 6 ? "." + br.b % 6 : "") + ")", sc: sc2, kind: "bowl", w: br.w });
        }
      });
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    return out;
  }
  function foWormAt(w, ov) {
    var best = [0, 0, 0];
    for (var i = 0; i < (w || []).length; i++) { if (w[i][0] <= ov + 1e-6) best = w[i]; else break; }
    return best;
  }
  var FO_MD = { t: 0, speed: 2, timer: null, round: -1 };
  function foMatchdayPage() {
    var page = document.getElementById("page"); if (!page) return;
    var rd = foLastRoundIx();
    if (rd < 0) {
      page.innerHTML = "<div class='crumb'>Matchday</div>" +
        "<div class='page-head'><div><div class='eyebrow'>Matchday centre</div><h1>The season starts here</h1><p>Every round replays here ball by ball once it's played, at " + MATCH_TIME + ". Until then, set your lineup on the Matches page.</p></div></div>";
      return;
    }
    var results = foLeagueRounds()[rd] || [];
    var seenKey = "fol_md_" + ((LG && LG.id) || "solo") + "_" + rd;
    var seen = !!lsGet(seenKey);
    // LIVE window: the round resolves at 9:00 AM ET and "broadcasts" at one
    // over a minute. Visit inside the window and the replay is already at the
    // right over; everyone in the league sees the same moment.
    var liveT = null;
    try {
      var f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit" });
      var p = {}; f.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var mins = (+p.hour) * 60 + (+p.minute) - 9 * 60;
      if (mins >= 0 && mins <= 60 && SYNC && SYNC.started && !SYNC.practice) liveT = Math.max(0.5, Math.min(100, mins * 5 / 3));
    } catch (e) {}
    if (FO_MD.round !== rd) { FO_MD.round = rd; FO_MD.t = liveT != null ? liveT : (seen ? 101 : 0); }
    else if (liveT != null && !FO_MD.timer && FO_MD.t < liveT) FO_MD.t = liveT;
    var my = ""; try { my = userTeam().name; } catch (e) {}
    var cards = results.map(function (r, i) {
      var mine = (r.home === my || r.away === my) ? " style='border-color:#C95532'" : "";
      return "<div class='fo-md-card' data-i='" + i + "'" + mine + "><div class='fo-md-teams'>" + E(r.home) + " v " + E(r.away) + "</div>" +
        "<div class='fo-md-inn' data-inn='0'><span></span><b></b></div>" +
        "<div class='fo-md-inn' data-inn='1'><span></span><b></b></div>" +
        "<div class='fo-md-status'></div>" +
        "<div style='margin-top:8px'><a class='fo-morelink' href='#/scorecard?i=" + r.ix + "'>Full scorecard ›</a></div></div>";
    }).join("");
    page.innerHTML =
      "<div class='crumb'>Matchday</div>" +
      "<div class='page-head'><div><div class='eyebrow'>Round " + (rd + 1) + "</div><h1>Matchday centre</h1><p>Every game of the round, ball by ball. Press play and watch it unfold.</p></div></div>" +
      "<div class='fo-md-bar'>" + (liveT != null ? "<span class='fo-md-live'>&#9679; LIVE</span>" : "") +
      "<button id='fo-md-play'>" + (FO_MD.t > 100 ? "Replay" : "Play") + "</button>" +
      "<button class='fo-ghost' id='fo-md-speed'>" + FO_MD.speed + "×</button>" +
      "<button class='fo-ghost' id='fo-md-skip'>Skip to result</button>" +
      "<span class='fo-md-over' id='fo-md-over'></span><span class='fo-md-track'><u id='fo-md-prog'></u></span></div>" +
      "<div class='fo-md-grid'>" + cards + "</div>" +
      "<div id='fo-md-potr'></div>";
    var paint = function () {
      var T = FO_MD.t;
      results.forEach(function (r, i) {
        var card = page.querySelector(".fo-md-card[data-i='" + i + "']"); if (!card) return;
        var i1 = r.innings && r.innings[0], i2 = r.innings && r.innings[1];
        var w1 = (r.worm && r.worm[0]) || [], w2 = (r.worm && r.worm[1]) || [];
        var end1 = w1.length ? w1[w1.length - 1][0] : 50;
        var rows = card.querySelectorAll(".fo-md-inn");
        var s1 = foWormAt(w1, Math.min(T, end1));
        rows[0].querySelector("span").textContent = i1 ? i1.batTeam : "";
        rows[0].querySelector("b").textContent = (T <= 0) ? "" : (s1[1] + "/" + s1[2] + " (" + Math.min(T, end1).toFixed(0) + " ov)");
        rows[0].classList.toggle("on", T > 0 && T < end1);
        var t2 = T - end1;
        var s2 = foWormAt(w2, Math.max(0, t2));
        var end2 = w2.length ? w2[w2.length - 1][0] : 50;
        rows[1].querySelector("span").textContent = i2 ? i2.batTeam : "";
        rows[1].querySelector("b").textContent = (t2 <= 0 || !i2) ? "" : (s2[1] + "/" + s2[2] + " (" + Math.min(t2, end2).toFixed(0) + " ov)");
        rows[1].classList.toggle("on", i2 && t2 > 0 && t2 < end2);
        var st = card.querySelector(".fo-md-status");
        if (t2 >= end2 || T > 100) { st.textContent = (r.result && r.result.text) || ""; card.classList.add("fo-md-done"); }
        else if (i2 && t2 > 0) {
          var target = (i1 ? i1.runs : 0) + 1, need = target - s2[1], balls = Math.round((end2 - t2) * 6);
          st.textContent = need > 0 ? (i2.batTeam + " need " + need + " off " + Math.max(0, balls) + " balls") : "";
          card.classList.remove("fo-md-done");
        } else { st.textContent = T > 0 ? "First innings in progress" : "Starts at the top of the hour…"; card.classList.remove("fo-md-done"); }
      });
      var ov = document.getElementById("fo-md-over"), pr = document.getElementById("fo-md-prog");
      if (ov) ov.textContent = T <= 0 ? "Ready" : (T > 100 ? "Full time" : (T <= 50 ? "1st innings · over " + Math.min(50, T).toFixed(0) : "2nd innings · over " + Math.min(50, T - 50).toFixed(0)));
      if (pr) pr.style.width = Math.min(100, T) + "%";
      var potr = document.getElementById("fo-md-potr");
      if (potr && (T > 100)) {
        if (!potr.innerHTML) {
          var best = foPerfList(results)[0];
          if (best) potr.innerHTML = "<div class='fo-potr'><span class='fo-potr-medal'>🏅</span><div><div class='small' style='color:#9aa3b2;text-transform:uppercase;letter-spacing:.12em;font-size:10.5px'>Player of the round</div><b>" + E(best.name) + "</b> · " + E(best.club) + " · " + E(best.line) + "</div></div>";
          lsSet(seenKey, "1");
        }
      } else if (potr && T <= 100) potr.innerHTML = "";
    };
    var stop = function () { if (FO_MD.timer) { clearInterval(FO_MD.timer); FO_MD.timer = null; } };
    var run = function () {
      stop();
      if (FO_MD.t > 100) FO_MD.t = 0;
      FO_MD.timer = setInterval(function () {
        if (!document.getElementById("fo-md-prog")) { stop(); return; }
        FO_MD.t += 0.5 * FO_MD.speed;
        if (FO_MD.t > 101) { FO_MD.t = 101; stop(); var b = document.getElementById("fo-md-play"); if (b) b.textContent = "Replay"; }
        paint();
      }, 110);
      var b = document.getElementById("fo-md-play"); if (b) b.textContent = "Pause";
    };
    page.querySelector("#fo-md-play").addEventListener("click", function () {
      if (FO_MD.timer) { stop(); this.textContent = "Play"; } else run();
    });
    page.querySelector("#fo-md-speed").addEventListener("click", function () {
      FO_MD.speed = FO_MD.speed >= 8 ? 1 : FO_MD.speed * 2; this.textContent = FO_MD.speed + "×";
    });
    page.querySelector("#fo-md-skip").addEventListener("click", function () { stop(); FO_MD.t = 101; paint(); var b = document.getElementById("fo-md-play"); if (b) b.textContent = "Replay"; });
    paint();
    if (liveT != null && FO_MD.t <= 100) run();       // live window: rolling by itself
  }
  function foRenderMatchday() {
    try {
      if (/^#\/matchday/.test(location.hash || "")) {
        var pgM = document.getElementById("page");
        var em2 = (typeof foEmbargo === "function") ? foEmbargo() : { active: false };
        if (em2.active && pgM && typeof foLiveBoardHTML === "function") {
          // during the broadcast hour the centre IS the live board: no replay
          // clock, no fast-forward, no results until stumps
          if (!pgM.querySelector(".fo-live-row")) {
            pgM.innerHTML = "<div class='crumb'>Matchday &raquo; Live</div>" +
              "<div class='page-head'><div><div class='eyebrow'>Round " + (em2.round + 1) + "</div><h1>Matchday live</h1><p>Five grounds, one hour of cricket. Scores tick in as play unfolds; the full story lands at stumps.</p></div></div>" +
              foLiveBoardHTML();
          }
          return;
        }
        // after the hour: the replay centre, minus the spoiler pedals
        if (pgM) setTimeout(function () {
          Array.prototype.slice.call(pgM.querySelectorAll("button")).forEach(function (b0) {
            if (/^2\s*[x\u00d7]$/i.test((b0.textContent || "").trim()) || /skip to result/i.test(b0.textContent || "")) b0.remove();
          });
        }, 120);
      }
    } catch (eL) {}
    if (!/^#\/matchday/.test(location.hash || "")) { if (FO_MD.timer) { clearInterval(FO_MD.timer); FO_MD.timer = null; } return; }
    try { bumpBrand(); } catch (e) {}
    try { foMatchdayPage(); } catch (e) { console.warn("foMatchdayPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-matchday")); });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderMatchday, 15); });

  // ---- prepare a lineup for an accepted challenge: one clear path ----
  // short name of the device's timezone ("EDT", "PDT", "IST") - friendly
  // times are stored absolutely but READ in each manager's local clock, so
  // every rendered time says which clock it is on
  function foTzAbbr() {
    try {
      if (window.__foTzAb) return window.__foTzAb;
      var parts = new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ");
      window.__foTzAb = parts[parts.length - 1] || "";
      return window.__foTzAb;
    } catch (e) { return ""; }
  }
  function foChalWhen(ch) {
    if (!ch || !ch.play_at) return "";
    var t = new Date(ch.play_at), pad = function (n) { return (n < 10 ? "0" : "") + n; };
    var ab = foTzAbbr();
    return t.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " " + pad(t.getHours()) + ":" + pad(t.getMinutes()) + (ab ? " " + ab : "");
  }
  // bowler style in the engine's own commentary shorthand: rfm, fs, ws...
  function foBowlCode(p) {
    if (!p || !p.bowlTypeFull || p.bowlTypeFull === "none") return "";
    var h = p.hand === "L" ? "l" : "r";
    return { seamFast: h + "f", seamFastMedium: h + "fm", seamMedium: h + "m",
      fingerSpin: "fs", wristSpin: "ws", partTimeSeam: "pt seam", partTimeSpin: "pt spin" }[p.bowlTypeFull] || "";
  }
  // real scorecards list bowlers in the order they came on, not by best
  // figures. The commentary log knows who bowled when - reorder the engine's
  // wickets-first bowling tables to match the innings as it happened.
  function foBowlOrderSort() {
    try {
      var r = null, hash0 = location.hash || "";
      var mSc = /^#\/scorecard\?i=(\d+)/.exec(hash0);
      if (mSc) r = ((typeof App !== "undefined" && App.results) || [])[+mSc[1]];
      else {
        // friendly and practice full-time pages carry their result in the cache
        var mFr = /^#\/friendly\?id=([\w-]+)/.exec(hash0);
        var ch0 = mFr && window.__foFrCache;
        if (ch0 && ch0.id === mFr[1] && ch0.row && ch0.row.result) r = ch0.row.result;
      }
      if (!r || !r.log || !r.log.length) return;
      var page = document.getElementById("page"); if (!page) return;
      var chron = r.log.slice().reverse();
      var inns = [[]], prevNo = -1;
      chron.forEach(function (L) {
        if (!L || L.mile || !L.no) return;
        var mN = /^(\d+)\.(\d+)$/.exec(L.no); if (!mN) return;
        var noV = (+mN[1]) * 10 + (+mN[2]);
        if (noV < prevNo) inns.push([]);          // over.ball rewound: new innings
        prevNo = noV;
        var mB = /^([A-Za-z'\u00C0-\u024F .-]+?) to /.exec(L.txt || ""); if (!mB) return;
        var tok = mB[1].trim().split(/\s+/).pop().toLowerCase();
        var arr = inns[inns.length - 1];
        if (arr.indexOf(tok) < 0) arr.push(tok);
      });
      var bIx = 0;
      page.querySelectorAll("table").forEach(function (tb) {
        var ths = Array.prototype.slice.call(tb.querySelectorAll("th")).map(function (x) { return (x.textContent || "").trim().toLowerCase(); });
        if (!ths.length || !(ths[0].indexOf("bowler") === 0 || ths[0].indexOf("bowling") === 0) || ths.indexOf("econ") < 0) return;
        var ord = inns[bIx++] || [];
        if (!ord.length || tb.__foBowlOrd) return;
        tb.__foBowlOrd = 1;
        var body = tb.tBodies[0] || tb;
        var trs = Array.prototype.slice.call(body.querySelectorAll("tr")).filter(function (tr) { return tr.querySelector("td"); });
        trs.map(function (tr, i2) {
          var td = tr.querySelector("td"), clone = td.cloneNode(true);
          var tag = clone.querySelector(".fo-bt-tag"); if (tag) tag.remove();
          var nm = (clone.textContent || "").replace(/\s*\(.*\)$/, "").trim();
          var k2 = ord.indexOf(nm.split(/\s+/).pop().toLowerCase());
          return { tr: tr, k: k2 < 0 ? 99 : k2, i: i2 };
        }).sort(function (a3, b3) { return (a3.k - b3.k) || (a3.i - b3.i); })
          .forEach(function (x3) { body.appendChild(x3.tr); });
      });
    } catch (e) {}
  }
  // every bowling card names the bowler's type - any table with an Econ column
  function foBowlTypeTags() {
    try {
      var page = document.getElementById("page"); if (!page || typeof findPlayer !== "function") return;
      // the page knows which two clubs are playing - use that to break ties
      var mClubs = [];
      try {
        var h9 = location.hash || "", rM = null;
        var mS9 = /^#\/scorecard\?i=(\d+)/.exec(h9);
        if (mS9) rM = ((typeof App !== "undefined" && App.results) || [])[+mS9[1]];
        if (rM) mClubs = [rM.home, rM.away].filter(Boolean);
        else if (/^#\/match/.test(h9)) {
          // the LIVE match tab: the two clubs come from the running match,
          // so abbreviated bowler names ("J. Cole") can still be resolved
          try { if (typeof M !== "undefined" && M && M.meta) mClubs = [M.meta.home, M.meta.away].filter(Boolean); } catch (eLm9) {}
        } else {
          var mF9 = /^#\/friendly\?id=([\w-]+)/.exec(h9);
          var chF9 = mF9 && window.__foFrCache;
          if (chF9 && chF9.id === mF9[1] && chF9.row) mClubs = [chF9.row.challenger_club, chF9.row.opponent_club].filter(Boolean);
        }
      } catch (eMc9) {}
      page.querySelectorAll("table").forEach(function (tb) {
        if (tb.__foBtTags) return;
        var ths = Array.prototype.slice.call(tb.querySelectorAll("th")).map(function (x) { return (x.textContent || "").trim().toLowerCase(); });
        var isBowl9 = ths.indexOf("econ") >= 0;
        var isBat9 = !isBowl9 && ths.length && (ths[0].indexOf("batter") === 0 || ths[0].indexOf("batting") === 0) && ths.indexOf("sr") >= 0;
        if (!isBowl9 && !isBat9) return;
        tb.__foBtTags = 1;
        var sideClub = null;
        try {
          var thRaw0 = ((tb.querySelector("th") || {}).textContent || "").trim();
          var mPar9 = /\(([^)]+)\)/.exec(thRaw0);
          if (mPar9 && mClubs.indexOf(mPar9[1]) >= 0) sideClub = mPar9[1];   // "Bowling (Wellington)"
          if (!sideClub && mClubs.length === 2) {
            var elW9 = tb, hops9 = 0, inn9 = null;
            while (elW9 && hops9++ < 4 && !inn9) {
              var sib9 = elW9.previousElementSibling;
              while (sib9 && !inn9) {
                var tx9 = sib9.textContent || "";
                var hasA9 = tx9.indexOf(mClubs[0]) >= 0, hasB9 = tx9.indexOf(mClubs[1]) >= 0;
                if (hasA9 !== hasB9) inn9 = hasA9 ? mClubs[0] : mClubs[1];   // an innings header names ONE side
                sib9 = sib9.previousElementSibling;
              }
              elW9 = elW9.parentElement;
            }
            if (inn9) sideClub = isBat9 ? inn9 : (inn9 === mClubs[0] ? mClubs[1] : mClubs[0]);
          }
        } catch (eSc9) {}
        Array.prototype.slice.call(tb.querySelectorAll("tr")).forEach(function (tr) {
          var td = tr.querySelector("td"); if (!td || td.querySelector(".fo-bt-tag") || td.querySelector(".fo-tal-tag")) return;
          var nameEl9 = td.querySelector("a, b") || td;
          var nm = (nameEl9.textContent || "").replace(/[\u2020*]/g, "").replace(/\s*\(c\)\s*$/i, "").trim(); if (!nm) return;
          var nmC = nm.replace(/\s*\(.*\)$/, "").trim();
          var hit = findPlayer(nm) || findPlayer(nmC);
          if (!hit) {
            // scorecards abbreviate to "S. Akram" - gather every match, then
            // narrow by what the page knows: the two clubs playing, which side
            // this table belongs to, and (for bowling) who actually bowls
            var mAb = /^([A-Za-z])\.\s+(.+)$/.exec(nmC);
            if (mAb) {
              var cands9 = [], tgt9 = mAb[2].toLowerCase();
              (GD.teams || []).forEach(function (t9) {
                (t9.players || []).forEach(function (p9) {
                  var ps = String(p9.name || "").split(/\s+/); if (ps.length < 2) return;
                  // commentary abbreviations drop name particles: "de Kock" -> "T. Kock"
                  if (ps[0].charAt(0).toLowerCase() === mAb[1].toLowerCase() &&
                      (ps.slice(1).join(" ").toLowerCase() === tgt9 || ps[ps.length - 1].toLowerCase() === tgt9)) cands9.push({ p: p9, club: t9.name });
                });
              });
              var narrow9 = function (arr9, f9) { var a9 = arr9.filter(f9); return a9.length ? a9 : arr9; };
              if (cands9.length > 1 && mClubs.length) cands9 = narrow9(cands9, function (c9) { return mClubs.indexOf(c9.club) >= 0; });
              if (cands9.length > 1 && sideClub) cands9 = narrow9(cands9, function (c9) { return c9.club === sideClub; });
              if (cands9.length > 1 && isBowl9) cands9 = narrow9(cands9, function (c9) { return c9.p.bowlTypeFull && c9.p.bowlTypeFull !== "none"; });
              if (cands9.length) hit = { p: cands9[0].p };
            }
          }
          if (!hit) {
            var rn9 = (window.__FO_RENAMES || {})[nmC];
            if (rn9) hit = findPlayer(rn9);
          }
          if (!hit) {
            var lc9 = nmC.toLowerCase(), cand9 = null, dupe9 = false;
            (GD.teams || []).forEach(function (t8) {
              (t8.players || []).forEach(function (p8) {
                if (p8 && String(p8.name || "").toLowerCase() === lc9) { if (cand9 && cand9 !== p8) dupe9 = true; cand9 = p8; }
              });
            });
            if (cand9 && !dupe9) hit = { p: cand9 };
          }
          if (!hit || !hit.p) return;
          // a name we resolved is a name you can visit
          if (!td.querySelector("a") && hit.p.name) {
            try { nameEl9.innerHTML = "<a href='#/player?n=" + encodeURIComponent(hit.p.name) + "'>" + nameEl9.innerHTML + "</a>"; } catch (eLk9) {}
          }
          var host = nameEl9 === td ? (td.querySelector("b") || td) : nameEl9;
          var add9 = "";
          if (isBowl9) {
            var code = foBowlCode(hit.p);
            if (code) add9 += " <span class='fo-bt-tag' title='" + E(hit.p.btLabel || "") + "'>" + code + "</span>";
          }
          // talents ride along on every scorecard row, with their explanation
          (hit.p.talents || []).slice(0, 2).forEach(function (tl9) {
            var tip9 = ""; try { tip9 = (typeof TALTIPS !== "undefined" && TALTIPS[tl9]) || ""; } catch (eT9) {}
            add9 += " <span class='fo-tal-tag' title='" + E(tip9) + "'>" + E(foTalentName(tl9)) + "</span>";
          });
          if (add9) host.insertAdjacentHTML("beforeend", add9);
        });
      });
    } catch (e) {}
  }
  // ONE format for every match date-time, in the viewer's own clock:
  // "11 Jul, 15:00 EDT" - league 9 AMs included, no special red pills
  function foWhenTxt(ts) {
    var d = new Date(ts); if (isNaN(d)) return "";
    var pd = function (n) { return (n < 10 ? "0" : "") + n; };
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " + pd(d.getHours()) + ":" + pd(d.getMinutes()) + (foTzAbbr() ? " " + foTzAbbr() : "");
  }
  // the founding date as a crest inscription for the navy hero banners
  function foEstBadge(t) {
    try {
      if (!t || typeof foClubEst !== "function") return "";
      var d = new Date(foClubEst(t)); if (isNaN(d)) return "";
      var txt = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      return "<span class='fo-estd' title='Founded " + E(txt) + "'>Estd " + E(txt) + "</span>";
    } catch (e) { return ""; }
  }
  // a club name that goes somewhere: the club's scout page
  function foClubLink(nm) {
    try {
      var ix9 = (GD.teams || []).findIndex(function (t9) { return t9 && t9.name === nm; });
      if (ix9 >= 0) return "<a class='fo-crumb-club' href='#/scout?t=" + ix9 + "'>" + E(nm) + "</a>";
    } catch (e9) {}
    return E(nm);
  }
  // ---- live audience: who is watching this broadcast ----------------------
  // any member on a live view pings watch_match (25s heartbeat); the hero
  // shows how many are on it now and who has dropped by. Requires the 0021
  // SQL - absent, the whole thing quietly stays blank.
  function foWatchPing(key) {
    try {
      if (!key || !(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      var st = window.__foWatch || (window.__foWatch = {});
      var now = Date.now();
      if (st.k !== key) { st.k = key; st.ping = 0; st.get = 0; st.rows = null; }
      if (!st.dead && now - st.ping > 25000) {
        st.ping = now;
        rpc("watch_match", { p_league_id: LG.id, p_key: key, p_club: userTeam().name }).catch(function (e2) {
          if (/Could not find the function/i.test(((e2 && e2.message) || e2) + "")) st.dead = 1;
        });
      }
      if (!st.dead && now - st.get > 12000) {
        st.get = now;
        sel("league_watchers", "league_id=eq." + LG.id + "&match_key=eq." + encodeURIComponent(key) + "&select=club,last_seen&order=last_seen.desc&limit=40")
          .then(function (rows) { st.rows = rows || []; foWatchPaint(st); }).catch(function () {});
      }
      foWatchPaint(st);
    } catch (e) {}
  }
  function foWatchPaint(st) {
    try {
      var el = document.getElementById("fo-watchers"); if (!el || !st || !st.rows) return;
      var me = userTeam().name, now = Date.now();
      var live = [], past = [];
      st.rows.forEach(function (r) {
        if (!r || !r.club) return;
        (now - Date.parse(r.last_seen) < 90000 ? live : past).push(r.club === me ? "you" : r.club);
      });
      if (!live.length && !past.length) { el.innerHTML = ""; return; }
      var eye = "<svg viewBox='0 0 24 24' width='13' height='13' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' style='flex:0 0 auto'><path d='M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z'/><circle cx='12' cy='12' r='3'/></svg>";
      el.innerHTML = eye + "<b>" + live.length + "</b> watching now" +
        (live.length ? " &middot; " + live.slice(0, 6).map(function (x) { return E(x); }).join(", ") + (live.length > 6 ? " +" + (live.length - 6) + " more" : "") : "") +
        (past.length ? " <span class='fo-watch-past'>&middot; dropped by " + past.slice(0, 5).map(function (x) { return E(x); }).join(", ") + (past.length > 5 ? " +" + (past.length - 5) : "") + "</span>" : "");
    } catch (e) {}
  }
  function foChalAttach(ch, done) {
    rpc("challenge_set_orders", { p_id: ch.id, p_club: userTeam().name, p_orders: App.orders })
      .then(function () {
        toast("✓ Lineup attached · friendly vs " + (ch.challenger_club === userTeam().name ? ch.opponent_club : ch.challenger_club) + " begins " + foChalWhen(ch) + ".");
        if (done) done(true);
      }).catch(function (e) {
        var s = ((e && e.message) || e) + "";
        if (/lock/i.test(s) || /already played/i.test(s)) say("Lineups are locked - they close exactly one hour before kickoff. The XI attached before the lock plays. Kickoff: " + foChalWhen(ch) + ".");
        else say(e);
        if (done) done(false);
      });
  }
  function foChalPrep(ch) {
    try {
      var me = userTeam().name;
      var vs = ch.challenger_club === me ? ch.opponent_club : ch.challenger_club;
      var when = foChalWhen(ch);
      var ex = document.getElementById("fo-chprep"); if (ex) ex.remove();
      var locked = ch.play_at && (new Date(ch.play_at) - Date.now() <= 60 * 60000);
      var m = document.createElement("div"); m.id = "fo-chprep"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Friendly</div><h3>vs " + E(vs) + "</h3>" +
        "<div class='small' style='margin:4px 0 10px'>" + foPitchName(ch.pitch) + " pitch &middot; " + E(ch.weather || "") + (when ? " &middot; kicks off " + when : "") + "</div>" +
        (locked
          ? "<div class='small' style='margin:0 0 12px'><b>&#128274; Lineups are locked.</b> They close exactly one hour before kickoff so the engine can prepare the match. Whatever was attached before the lock plays - if nothing was, a sensible automatic XI takes the field.</div>" +
            "<div class='fo-modal-act'><button class='fo-su-cancel' id='fo-chprep-x'>Close</button></div>"
          : "<div class='small' style='margin:0 0 12px'>The match kicks off on schedule and plays out ball by ball for an hour, live for both managers. Open Orders, set your XI and hit <b>Save orders</b> - it attaches to this friendly automatically. <b>Lineups lock exactly one hour before kickoff</b>; until then you can re-attach as often as you like.</div>" +
            "<div class='fo-modal-act'><button class='primary' id='fo-chprep-ord'>Set lineup in Orders</button><button id='fo-chprep-att'>Attach my saved lineup</button><button class='fo-su-cancel' id='fo-chprep-x'>Close</button></div>") +
        "</div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e2) { if (e2.target === m) m.remove(); });
      m.querySelector("#fo-chprep-x").addEventListener("click", function () { m.remove(); });
      if (locked) return;
      m.querySelector("#fo-chprep-ord").addEventListener("click", function () {
        m.remove();
        // give the Orders page the real fixture (crumb, ground, pitch,
        // weather) and let the save intercept attach the lineup
        try {
          var home = ch.challenger_club, homeT = null;
          (GD.teams || []).forEach(function (t2) { if (t2.name === home) homeT = t2; });
          App.pending = {
            home: home, away: ch.opponent_club,
            ground: (homeT && homeT.ground) || userTeam().ground,
            pitch: ch.pitch || "balanced", weather: ch.weather || "Sunny",
            seed: "-", date: foChalWhen(ch), comp: "friendly", __chal: ch
          };
          App.orders.saved = false;
        } catch (eP) {}
        location.hash = "#/orders"; if (typeof window.route === "function") window.route();
      });
      m.querySelector("#fo-chprep-att").addEventListener("click", function () {
        if (!(App.orders && App.orders.saved)) { say("Save a lineup on the Orders screen first, then attach it here."); return; }
        foChalAttach(ch, function (ok) { if (ok) m.remove(); });
      });
    } catch (e) {}
  }
  // ---- notification bell: friendly challenges and their outcomes ----
  var FO_BELL = { events: [], unseen: 0, rows: [] };
  function foBellSeenKey() { return "fol_bellseen_" + (LG ? LG.id : "solo"); }
  function foBellEvents(rows, me) {
    var ev = [];
    (rows || []).forEach(function (c) {
      var mineSent = c.challenger_club === me;
      var vs = mineSent ? c.opponent_club : c.challenger_club;
      var when = c.play_at ? new Date(c.play_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + (foTzAbbr() ? " " + foTzAbbr() : "") : "";
      if (c.status === "pending" && !mineSent && !foFrDead(c)) ev.push({ k: c.id + ":pending", t: "\u2694 " + vs + " challenge you to a friendly" + (when ? " \u00b7 " + when : ""), ch: c });
      else if ((c.status === "accepted" || c.status === "played") && foFrBcastState(c).phase === "live") ev.push({ k: c.id + ":live", t: "\ud83d\udd34 LIVE: friendly vs " + vs + " \u00b7 watch ball by ball", go: "#/friendly?id=" + c.id, ch: c });
      else if (c.status === "accepted") ev.push({ k: c.id + ":accepted", t: (mineSent ? vs + " accepted your challenge" : "Friendly vs " + vs + " is on") + (when ? " \u00b7 " + when : ""), ch: c });
      else if (c.status === "declined" && mineSent) ev.push({ k: c.id + ":declined", t: vs + " declined your challenge", ch: c });
      else if (c.status === "played" && c.result && foFrBcastState(c).phase === "done") ev.push({ k: c.id + ":played", t: "Full time in the friendly: " + (c.result.result_text || "played"), go: "#/friendly?id=" + c.id, ch: c });
    });
    return ev.slice(0, 10);
  }
  function foBellBadge() {
    var n = document.getElementById("fo-bell-n"); if (!n) return;
    n.textContent = FO_BELL.unseen > 9 ? "9+" : String(FO_BELL.unseen);
    n.style.display = FO_BELL.unseen ? "inline-flex" : "none";
  }
  function foBellPoll() {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      var me = userTeam().name;
      sel("league_challenges", "league_id=eq." + LG.id + "&select=*&order=created_at.desc&limit=24").then(function (rows) {
        window.__foFrAll = rows || [];
        rows = (rows || []).filter(function (c) { return c.challenger_club === me || c.opponent_club === me; });
        FO_BELL.rows = rows;
        FO_BELL.events = foBellEvents(rows, me);
        var seen = {}; try { seen = JSON.parse(lsGet(foBellSeenKey()) || "{}"); } catch (e) {}
        FO_BELL.unseen = FO_BELL.events.filter(function (e2) { return !seen[e2.k]; }).length;
        foBellBadge();
      }).catch(function () {});
    } catch (e) {}
  }
  setInterval(foBellPoll, 60000);
  setTimeout(foBellPoll, 3000);
  function foBellWire(tb, wrap) {
    if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
    if (tb.querySelector("#fo-bell")) return;
    var bell = document.createElement("span"); bell.id = "fo-bell"; bell.title = "Notifications";
    bell.innerHTML = "<svg viewBox='0 0 24 24' width='17' height='17' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9'/><path d='M13.7 21a2 2 0 0 1-3.4 0'/></svg><i id='fo-bell-n' style='display:none'></i>";
    var status = tb.querySelector("#fo-top-status");
    if (status && status.parentNode === tb) tb.insertBefore(bell, status); else tb.appendChild(bell);
    bell.addEventListener("click", function () {
      var pn = document.getElementById("fo-bell-panel");
      if (pn) { pn.remove(); return; }
      pn = document.createElement("div"); pn.id = "fo-bell-panel";
      pn.innerHTML = "<div class='fo-bell-h'>Notifications</div>" +
        (FO_BELL.events.length ? FO_BELL.events.map(function (e2, i) {
          var act = (e2.ch && e2.ch.status === "pending" && /:pending$/.test(e2.k))
            ? "<div class='fo-bell-act'><button class='mini fo-bell-acc' data-i='" + i + "'>Accept</button><button class='mini fo-bell-dec' data-i='" + i + "'>Decline</button></div>" : "";
          return "<div class='fo-bell-row' data-i='" + i + "'>" + E(e2.t) + act + "</div>";
        }).join("") : "<div class='fo-bell-row small'>Nothing yet. Friendly challenges and their results land here.</div>");
      document.body.appendChild(pn);
      // answer a challenge straight from the notification
      pn.querySelectorAll(".fo-bell-acc,.fo-bell-dec").forEach(function (b2) {
        b2.addEventListener("click", function (evB) {
          evB.stopPropagation();
          var e2 = FO_BELL.events[+b2.getAttribute("data-i")]; if (!e2 || !e2.ch) return;
          var acc = b2.classList.contains("fo-bell-acc");
          rpc("challenge_respond", { p_id: e2.ch.id, p_accept: acc }).then(function () {
            pn.remove();
            if (acc) {
              toast("Challenge accepted \u00b7 kicks off " + foChalWhen(e2.ch) + ". Set your lineup from the Matches page - lineups lock an hour before the start.");
              try { if (App.orders && App.orders.saved) rpc("challenge_set_orders", { p_id: e2.ch.id, p_club: userTeam().name, p_orders: App.orders }).catch(function () {}); } catch (eAt) {}
            } else toast("Challenge declined.");
            window.__foFrSig = null; window.__foFrFetchAt = 0;
            setTimeout(foBellPoll, 400);
          }).catch(say);
        });
      });
      // opening marks everything read
      var seen = {}; try { seen = JSON.parse(lsGet(foBellSeenKey()) || "{}"); } catch (e) {}
      FO_BELL.events.forEach(function (e2) { seen[e2.k] = 1; });
      lsSet(foBellSeenKey(), JSON.stringify(seen));
      FO_BELL.unseen = 0; foBellBadge();
      pn.querySelectorAll(".fo-bell-row[data-i]").forEach(function (d) {
        d.addEventListener("click", function () {
          pn.remove();
          var e2 = FO_BELL.events[+d.getAttribute("data-i")];
          if (e2 && e2.go) { location.hash = e2.go; if (typeof window.route === "function") window.route(); return; }
          if (e2 && e2.ch && e2.ch.status === "accepted") { foChalPrep(e2.ch); return; }
          location.hash = "#/matches"; if (typeof window.route === "function") window.route();
        });
      });
      setTimeout(function () {
        var close = function (ev) { if (!pn.contains(ev.target) && ev.target !== bell && !bell.contains(ev.target)) { pn.remove(); document.removeEventListener("click", close); } };
        document.addEventListener("click", close);
      }, 50);
    });
  }
  // the practice button opens through delegation, so a re-rendered panel can
  // never lose the handler
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("#fo-frs-new") : null;
    if (b) { ev.preventDefault(); startFriendly(); }
  });
  // ---- one match at a time, and the league's protected morning window ----
  function foETHour(dt) {
    try {
      var s2 = dt.toLocaleString("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit" });
      var m2 = /(\d+):(\d+)/.exec(s2); return m2 ? ((+m2[1]) % 24) + (+m2[2]) / 60 : null;
    } catch (e) { return null; }
  }
  // how long a club is on air right now: own live match, the league broadcast
  // hour, or a live friendly / practice broadcast
  function foClubBusyUntil(nm) {
    var until = 0;
    try { if (typeof M !== "undefined" && M && !M.done) until = Math.max(until, Date.now() + 30 * 60000); } catch (e0) {}
    try { var em = (typeof foEmbargo === "function") ? foEmbargo() : null; if (em && em.active) until = Math.max(until, em.endsAt || 0); } catch (e1) {}
    try {
      ((window.__foFrAll) || []).forEach(function (c) {
        if (!c || (c.status !== "accepted" && c.status !== "played")) return;
        if (c.challenger_club !== nm && c.opponent_club !== nm) return;
        var st = foFrBcastState(c);
        if (st.phase === "live") until = Math.max(until, st.endsAt);
      });
    } catch (e2) {}
    return until;
  }
  // can a friendly/practice start at `when` for these clubs? null = fine,
  // else the reason it can't
  function foFrSlotProblem(when, clubs) {
    var h = foETHour(when);
    if (h != null && h >= 8 && h < 10) return "League matches play at 9:00 AM ET, so friendlies can't start between 8:00 and 10:00 AM ET. Pick a time outside that window.";
    for (var i = 0; i < clubs.length; i++) {
      var busy = foClubBusyUntil(clubs[i]);
      if (when.getTime() < busy) return E(clubs[i]) + " is on air until " + new Date(busy).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " \u00b7 one match at a time. Schedule it after that.";
    }
    var clash = null;
    try {
      ((window.__foFrAll) || []).forEach(function (c) {
        if (clash || !c || (c.status !== "pending" && c.status !== "accepted")) return;
        var involved = clubs.some(function (nm) { return c.challenger_club === nm || c.opponent_club === nm; });
        if (!involved) return;
        var t0 = Date.parse(c.play_at); if (isNaN(t0)) return;
        if (Math.abs(t0 - when.getTime()) < FO_FR_MIN * 60000) clash = c;
      });
    } catch (e3) {}
    if (clash) return "That overlaps a friendly already booked for " + new Date(Date.parse(clash.play_at)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + " \u00b7 one match at a time.";
    return null;
  }
  // ---- friendly broadcasts: the match is banked early by the resolver and
  // REVEALED ball by ball from play_at, exactly like a league matchday ----
  var FO_FR_MIN = 60;
  // a challenge nobody accepted before its scheduled time is dead weight
  function foFrDead(c) {
    try { return !!(c && c.status === "pending" && foFrBcastState(c).phase !== "pre"); } catch (e) { return false; }
  }
  function foFrBcastState(c) {
    var t0 = c && c.play_at ? Date.parse(c.play_at) : NaN;
    if (isNaN(t0)) return { phase: "none" };
    var end = t0 + FO_FR_MIN * 60000, now = Date.now();
    if (now < t0) return { phase: "pre", t0: t0, endsAt: end };
    if (now < end) return { phase: "live", t0: t0, endsAt: end, p: (now - t0) / (FO_FR_MIN * 60000) };
    return { phase: "done", t0: t0, endsAt: end };
  }
  function foFrLiveLine(c, p) {
    try {
      var r = c.result; if (!r || !r.worm || !window.__foLive) return "under way";
      var st = window.__foLive.state({ worm: r.worm, innings: (r.scorecard || []) }, p);
      return st ? st.line + (st.chase ? " &middot; " + st.chase : "") : "under way";
    } catch (e) { return "under way"; }
  }
  // Match ratings fairness: the engine sums whatever units played, so a side
  // whose middle order or tail never batted loses that whole block from its
  // Overall - dominance read as weakness. Units only one side used are shown
  // greyed and excluded from BOTH totals, so Overall compares like with like.
  function foFairRatings(html) {
    try {
      if (!html || html.indexOf("like with like") >= 0) return html;
      var host = document.createElement("div"); host.innerHTML = html;
      var tb = host.querySelector("table"); if (!tb) return html;
      var trs = Array.prototype.slice.call(tb.querySelectorAll("tr"));
      var sums = [0, 0], overallTr = null, dropped = false;
      var val = function (td) {
        var t = (td.textContent || "").trim();
        if (t === "-" || t === "\u2013") return null;
        var m = t.replace(/,/g, "").match(/-?\d+/);
        return m ? +m[0] : null;
      };
      trs.forEach(function (tr) {
        if (tr.querySelector("th")) return;
        var tds = tr.querySelectorAll("td");
        if (tds.length < 3) return;
        if (/overall/i.test(tds[0].textContent)) { overallTr = tr; return; }
        var a = val(tds[1]), b = val(tds[2]);
        if (a != null && b != null) { sums[0] += a; sums[1] += b; return; }
        [1, 2].forEach(function (ci) {
          if (val(tds[ci]) != null) {
            dropped = true;
            tds[ci].classList.add("fo-rx");
            tds[ci].title = "shown, not counted: the other side's unit didn't play";
          }
        });
      });
      if (overallTr) {
        var otds = overallTr.querySelectorAll("td");
        if (otds.length >= 3) {
          var wa = sums[0] >= sums[1];
          otds[1].innerHTML = "<b" + (wa ? " style='color:#1c5537'" : "") + ">" + sums[0].toLocaleString() + "</b>";
          otds[2].innerHTML = "<b" + (!wa ? " style='color:#1c5537'" : "") + ">" + sums[1].toLocaleString() + "</b>";
        }
      }
      var note = host.querySelector("div.small");
      if (note) note.innerHTML += (dropped ? " Greyed units were used by only one side and are left out of Overall, so the totals compare like with like." : " Overall counts only units both sides used, so the totals compare like with like.");
      return host.innerHTML;
    } catch (e) { return html; }
  }
  try {
    if (typeof window.ratingsTable === "function" && !window.ratingsTable.__foFair) {
      var _foRT = window.ratingsTable;
      window.ratingsTable = function () { return foFairRatings(_foRT.apply(this, arguments)); };
      window.ratingsTable.__foFair = 1;
    }
  } catch (e) {}
  function foFrScoreTables(r) {
    try {
      if (typeof window.foScorecardCards === "function") return window.foScorecardCards(r.scorecard || []);
    } catch (e) {}
    return "";
  }

  // who is at the crease right now, from the banked per-ball tracker
  function foFrTrackAt(r, upto) {
    var tk = null;
    try { (r.track || []).forEach(function (t2) { if (t2 && t2.L <= upto && (!tk || t2.L > tk.L)) tk = t2; }); } catch (e) {}
    return tk;
  }
  // pull "X won the toss and chose to bat/bowl" out of a banked commentary
  // log (the crowd-intro line carries it for every competition)
  function foTossFromLog(log) {
    try {
      for (var i = 0; i < (log || []).length; i++) {
        var L = log[i];
        if (!L || !L.txt) continue;
        var mt = /([A-Za-z0-9' -]+ won the toss and chose to (?:bat|bowl))/.exec(L.txt);
        if (mt) return mt[1].trim() + ".";
      }
    } catch (e) {}
    return "";
  }
  // condition glyphs in the onboarding monoline style
  function foMhIcons(pitch, weather) {
    var IC = function (path, title) { return "<span class='fo-mh-ic' title='" + E(title) + "'><svg viewBox='0 0 24 24' width='15' height='15' fill='none' stroke='currentColor' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + path + "</svg></span>"; };
    var PG = {
      balanced: "<circle cx='12' cy='12' r='8'/><path d='M9.6 5.6c2.4 4 2.4 8.8 0 12.8M14.4 5.6c-2.4 4-2.4 8.8 0 12.8'/>",
      flat: "<path d='M4 15h16M6 10h12'/>",
      green: "<path d='M12 21c-5 0-8-3-8-8 5 0 8 3 8 8zM12 21c0-7 2-12 8-16-1 7-3 12-8 16z'/>",
      dry: "<path d='M12 3v5M8 8l-3 4M16 8l3 4M12 12v9M7 16l-3 4M17 16l3 4'/>",
      slow: "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 3'/>",
      cracked: "<path d='M5 20l4-8-2-3 4-6M13 20l2-6 4-2-1-6'/>",
      twoPaced: "<path d='M6 6l6 6-6 6M13 6l6 6-6 6'/>"
    };
    var WG = {
      sunny: "<circle cx='12' cy='12' r='4'/><path d='M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1'/>",
      overcast: "<path d='M17 18H7a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18 8.5 4.5 4.5 0 0 1 17 18z'/>",
      humid: "<path d='M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z'/>",
      hot: "<circle cx='12' cy='12' r='4'/><path d='M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5'/>",
      scorching: "<circle cx='12' cy='12' r='5'/><path d='M12 1v4M12 19v4M1 12h4M19 12h4M4 4l3 3M17 17l3 3M20 4l-3 3M7 17l-3 3'/>",
      drizzle: "<path d='M17 13H7a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18 3.5 4.5 4.5 0 0 1 17 13z'/><path d='M8 17l-1 3M12 17l-1 3M16 17l-1 3'/>",
      windy: "<path d='M3 8h10a3 3 0 1 0-3-3M3 13h14a3 3 0 1 1-3 3M3 18h7'/>",
      chilly: "<path d='M12 2v20M4 6l16 12M20 6L4 18'/>",
      misty: "<path d='M4 9h16M2 13h20M5 17h14'/>",
      "dew later": "<path d='M17 12H7a4 4 0 1 1 .6-7.96A5.5 5.5 0 0 1 18 2.5 4.5 4.5 0 0 1 17 12z'/><path d='M12 15c1.5 2 3 3.5 3 5.2a3 3 0 0 1-6 0c0-1.7 1.5-3.2 3-5.2z'/>"
    };
    var pk = String(pitch || "").trim(), wk = String(weather || "").trim().toLowerCase();
    var out = "";
    if (PG[pk]) out += IC(PG[pk], foPitchName(pk) + " pitch");
    if (WG[wk]) out += IC(WG[wk], weather);
    else if (wk) out += IC(WG.overcast, weather);
    return out ? "<span class='fo-mh-cnd'>" + out + "</span>" : "";
  }
  // the navy broadsheet result header, shared by league, friendly and
  // practice full-time pages. cards = innings in the banked card shape.
  // meta: { kind, seasonNo, roundNo, dateStr, pitch, weather, toss }
  function foMheadHTML(cards, resultText, meta, potm) {
    try {
      meta = meta || {};
      var sc0 = (cards || [])[0], sc1 = (cards || [])[1];
      if (!sc0) return "";
      var line = function (inn, chase) {
        if (!inn) return "";
        var win = resultText && inn.batTeam && resultText.indexOf(inn.batTeam) === 0;
        var tot = inn.runs + (inn.wkts >= 10 ? "" : "/" + inn.wkts);
        var ov = chase
          ? "<span class='fo-mh-ov'>(" + E(String(inn.overs || "")) + "/50 ov, T:" + (sc0.runs + 1) + ")</span>"
          : "<span class='fo-mh-ov'>(" + E(String(inn.overs || "")) + " ov)</span>";
        return "<div class='fo-mh-team" + (win ? " win" : "") + "'><span class='fo-mh-nm'>" + E(inn.batTeam || "") + "</span>" + ov + "<span class='fo-mh-sc'>" + tot + "</span></div>";
      };
      var figs = function (name) {
        var parts = [];
        (cards || []).forEach(function (inn) {
          if (!inn) return;
          (inn.batting || []).forEach(function (x) { if (x.name === name && (x.b || (x.out && x.out !== "not out"))) parts.push((x.r || 0) + (x.out === "not out" ? "*" : "") + " (" + (x.b || 0) + ")"); });
          (inn.bowling || []).forEach(function (x) { if (x.name === name) parts.push((x.w || 0) + "/" + (x.r || 0)); });
        });
        return parts.join(" &amp; ");
      };
      var pomHtml = "";
      if (potm && potm.n) {
        // the engine's mom string can arrive as "Jayant Dixit 4w" - figures
        // glued to the name. Match the longest real player name from the
        // card and let the figures line below carry the numbers.
        try {
          var nRaw = String(potm.n).trim(), best = null;
          (cards || []).forEach(function (inn9) {
            if (!inn9) return;
            ["batting", "bowling"].forEach(function (k9) {
              (inn9[k9] || []).forEach(function (x9) {
                if (x9 && x9.name && nRaw.indexOf(x9.name) === 0 && (!best || x9.name.length > best.length)) best = x9.name;
              });
            });
          });
          if (best) potm = { n: best, team: potm.team, sub: potm.sub };
          else potm = { n: nRaw.replace(/\s+\d[\w*\/.]*$/, ""), team: potm.team, sub: potm.sub };
        } catch (eNm) {}
        var pf = figs(potm.n);
        pomHtml = "<div class='fo-mh-r'><div class='fo-mh-k'>Player of the match</div>" +
          "<div class='fo-mh-pn'><a href='#/player?n=" + encodeURIComponent(potm.n) + "'>" + E(potm.n) + "</a>" + (potm.team ? "<span class='fo-mh-pt'> &middot; " + E(potm.team) + "</span>" : "") + "</div>" +
          (pf ? "<div class='fo-mh-pf'>" + pf + "</div>" : (potm.sub ? "<div class='fo-mh-pf'>" + potm.sub + "</div>" : "")) + "</div>";
      }
      var eye = ["FULL TIME"];
      if (meta.kind) eye.push(meta.kind);
      if (meta.seasonNo) eye.push("SEASON " + meta.seasonNo);
      if (meta.roundNo) eye.push("ROUND " + meta.roundNo);
      if (meta.dateStr) eye.push(E(meta.dateStr));
      return "<div class='fo-mhead'><div class='fo-mh-l'>" +
        "<div class='fo-mh-eyebrow'>" + eye.join(" &middot; ") + foMhIcons(meta.pitch, meta.weather) + "</div>" +
        line(sc0, false) + line(sc1, true) +
        "<div class='fo-mh-res'>" + E(resultText || "Played") + "</div>" +
        ((meta.ground || meta.toss) ? "<div class='fo-mh-toss'>" + [meta.ground ? E(meta.ground) : null, meta.toss ? E(meta.toss) : null].filter(Boolean).join(" &middot; ") + "</div>" : "") +
        "</div>" + pomHtml + "</div>";
    } catch (e) { return ""; }
  }
  function foLast6HTML(chron, upto) {
    try {
      var balls = [];
      for (var i = Math.min(upto, chron.length) - 1; i >= 0 && balls.length < 6; i--) {
        var L = chron[i];
        if (!L || L.mile || !L.no || !L.out) continue;
        balls.push(L.out);
      }
      if (!balls.length) return "";
      balls.reverse();   // oldest of the six on the left, like a TV strip
      var chip = function (o) {
        if (o === "dot") return "<i>&bull;</i>";
        if (o === "wide") return "<i class='e'>wd</i>";
        if (o === "noball") return "<i class='e'>nb</i>";
        if (o === "bye") return "<i class='e'>b</i>";
        if (o === "legbye") return "<i class='e'>lb</i>";
        if (o && o.charAt(0) === "w") return "<i class='w'>W</i>";
        if (o === "4") return "<i class='f'>4</i>";
        if (o === "6") return "<i class='s'>6</i>";
        return "<i>" + E(String(o).slice(0, 2)) + "</i>";
      };
      return "<div class='fo-l6'><span class='fo-l6-k'>Last 6 balls</span>" + balls.map(chip).join("") + "</div>";
    } catch (e) { return ""; }
  }
  function foFrCrease(tk) {
    if (!tk) return "";
    var pc = function (x, tag, fig) {
      if (!x) return "";
      return "<div class='fo-lv-pc'><span class='fo-lv-tag'>" + tag + "</span><a href='#/player?n=" + encodeURIComponent(x.n) + "'>" + E(x.n) + "</a><span class='fo-lv-fig'>" + fig + "</span></div>";
    };
    var bat = function (x, tag) { return !x ? "" : pc(x, tag, "<b>" + (x.r || 0) + "*</b> (" + (x.b || 0) + ")" + ((x.f4 || x.f6) ? " &middot; " + (x.f4 || 0) + "x4 " + (x.f6 || 0) + "x6" : "")); };
    return "<div class='fo-lv-cards'>" +
      bat(tk.s, "Striker &#9733;") + bat(tk.ns, "Non-striker") +
      (tk.bw ? pc(tk.bw, "Bowler", "<b>" + (tk.bw.w || 0) + "/" + (tk.bw.r || 0) + "</b> (" + Math.floor((tk.bw.b || 0) / 6) + "." + ((tk.bw.b || 0) % 6) + " ov)") : "") + "</div>";
  }
  // a live scorecard built ONLY from what the broadcast has revealed: batters
  // and bowlers carry their figures as of the last shown ball - no spoilers
  function foFrLiveScore(r, tk, upto) {
    try {
      if (!tk) return "";
      var html = "";
      for (var ii = 0; ii < tk.i; ii++) {
        var doneInn = (r.scorecard || [])[ii];
        if (doneInn) html += foFrScoreTables({ scorecard: [doneInn] });
      }
      var seenBat = {}, orderBat = [], seenBowl = {}, orderBowl = [];
      (r.track || []).forEach(function (t2) {
        if (!t2 || t2.i !== tk.i || t2.L > upto) return;
        [t2.s, t2.ns].forEach(function (x) { if (!x) return; if (!seenBat[x.n]) orderBat.push(x.n); seenBat[x.n] = x; });
        if (t2.bw) { if (!seenBowl[t2.bw.n]) orderBowl.push(t2.bw.n); seenBowl[t2.bw.n] = t2.bw; }
      });
      var fin = (r.scorecard || [])[tk.i] || {};
      var outTxt = {}; (fin.batting || []).forEach(function (b2) { outTxt[b2.name] = b2.out; });
      var atCrease = {}; if (tk.s) atCrease[tk.s.n] = 1; if (tk.ns) atCrease[tk.ns.n] = 1;
      var bat = orderBat.map(function (n) {
        var x = seenBat[n];
        var st2 = atCrease[n] ? "<span style='color:#15803D;font-weight:700'>batting</span>" : E(outTxt[n] && outTxt[n] !== "not out" ? outTxt[n] : "");
        var star2 = (atCrease[n] || !outTxt[n] || outTxt[n] === "not out") ? "*" : "";
        return "<tr><td><b>" + E(n) + "</b><div class='small'>" + st2 + "</div></td><td class='n'><b>" + (x.r || 0) + star2 + "</b></td><td class='n'>" + (x.b || 0) + "</td><td class='n'>" + (x.f4 || 0) + "</td><td class='n'>" + (x.f6 || 0) + "</td><td class='n'>" + (x.b ? (100 * x.r / x.b).toFixed(1) : 0) + "</td></tr>";
      }).join("");
      var bowl = orderBowl.map(function (n) {
        var x = seenBowl[n];
        return "<tr><td><b>" + E(n) + "</b></td><td class='n'>" + Math.floor((x.b || 0) / 6) + "." + ((x.b || 0) % 6) + "</td><td class='n'>" + (x.r || 0) + "</td><td class='n'>" + (x.w || 0) + "</td><td class='n'>" + (x.b ? (x.r / (x.b / 6)).toFixed(2) : 0) + "</td></tr>";
      }).join("");
      html += "<div class='panel fo-sci'><div class='fo-sci-head'><b>" + E(fin.batTeam || "") + "</b><span>" + tk.sc[0] + "/" + tk.sc[1] + " <em>(" + Math.floor(tk.sc[2] / 6) + "." + (tk.sc[2] % 6) + " ov)</em></span></div><div class='pad'>" +
        "<table class='fo-sct'><thead><tr><th>Batting</th><th class='n'>R</th><th class='n'>B</th><th class='n'>4s</th><th class='n'>6s</th><th class='n'>SR</th></tr></thead><tbody>" + bat + "</tbody></table>" +
        "<table class='fo-sct' style='margin-top:12px'><thead><tr><th>Bowling</th><th class='n'>O</th><th class='n'>R</th><th class='n'>W</th><th class='n'>Econ</th></tr></thead><tbody>" + bowl + "</tbody></table>" +
        "</div></div>";
      return html;
    } catch (e) { return ""; }
  }
  function foFrLiveCharts(r, tk) {
    try {
      if (!tk || typeof foMatchCharts !== "function") return "";
      var lim = tk.sc[2] / 6 + 0.001;
      var worms = (r.worm || []).map(function (arr, i) {
        if (!arr || i > tk.i) return [];
        return i < tk.i ? arr : arr.filter(function (pt) { return pt && pt[0] <= lim; });
      }).slice(0, tk.i + 1);
      var all = (r.scorecard || []).slice(0, tk.i + 1).map(function (inn) { return { batTeam: (inn && inn.batTeam) || "" }; });
      if (!worms[0] || !worms[0].length) return "";
      return foMatchCharts(all, worms);
    } catch (e) { return ""; }
  }
  function foFrLiveDraw(c, id) {
    var page = document.getElementById("page"); if (!page) return;
    var st = foFrBcastState(c);
    if (st.phase !== "live") { foRenderFriendlyLive(); return; }
    var r = c.result || {};
    var log = (r.log || []).slice().reverse();   // chronological
    var upto = Math.max(2, Math.floor(st.p * log.length));
    var vis = log.slice(0, upto).reverse();      // newest ball first
    var kind = c.__practice ? "Practice" : "Friendly";
    var head = "<div class='crumb'>" + foClubLink(c.challenger_club) + " v " + foClubLink(c.opponent_club) + " &raquo; " + kind + "</div>";
    var tk = foFrTrackAt(r, upto);
    var tab = window.__foFrLTab || "feed";
    var cf = window.__foFrLCF || "all";
    var bar = "<div class='fo-sctabs'>" + [["feed", "Live feed"], ["score", "Scorecard"], ["charts", "Charts"], ["ratings", "Match ratings"]].map(function (t2) {
      return "<button class='fo-sctab fo-frltab" + (tab === t2[0] ? " on" : "") + "' data-t='" + t2[0] + "'>" + t2[1] + "</button>";
    }).join("") + "</div>";
    var body = "";
    if (tab === "score") {
      body = foFrLiveScore(r, tk, upto) || "<div class='panel'><div class='pad small'>The live scorecard was not tracked for this match &middot; friendlies from now on carry it. The full card lands at stumps.</div></div>";
    } else if (tab === "charts") {
      var ch2 = foFrLiveCharts(r, tk);
      body = ch2 ? "<div class='panel'><h4>Charts &middot; so far</h4><div class='pad'>" + ch2 + "</div></div>" : "<div class='panel'><div class='pad small'>Charts build as play unfolds &middot; the full set lands at stumps.</div></div>";
    } else if (tab === "ratings") {
      body = "<div class='panel'><div class='pad small'>Match ratings are compiled at stumps &middot; they land with the final scorecard.</div></div>";
    } else {
      var cfBar = "<div class='fo-cfilters'>" + [["all", "All"], ["wickets", "Wickets"], ["boundaries", "Boundaries"], ["fielding", "Fielding"], ["talents", "Talents"], ["highlights", "Highlights"]].map(function (ff) {
        return "<button class='fo-sctab fo-frlcf" + (cf === ff[0] ? " on" : "") + "' data-f='" + ff[0] + "'>" + ff[1] + "</button>";
      }).join("") + "</div>";
      var over0 = upto >= log.length ? "<div class='fo-c-mile'><div class='text'>That is the last ball - the umpires check the paperwork. The official result lands at stumps.</div><div class='clear'></div></div>" : "";
      body = "<div class='panel'><h4>Ball-by-ball</h4><div class='pad'>" + cfBar + "<div id='ftpcomm' class='ftpskin'>" +
        over0 + (typeof ftpCommHTML === "function" ? ftpCommHTML(vis, cf, 5000) : "") + "</div></div></div>";
    }
    page.innerHTML = "<div id='fo-fr-live'>" + head +
      "<div class='fo-live-hero'><div class='fo-live-tag'><span class='live-dot'></span> LIVE &middot; " + kind.toUpperCase() + "</div>" +
      "<div class='fo-live-score'>" + foFrLiveLine(c, st.p) + "</div>" +
      "<div class='fo-live-sub'>" + kind + " &middot; " + foPitchName(c.pitch) + " pitch &middot; " + E(c.weather || "") + (r.toss ? " &middot; " + E(r.toss) : "") + "</div>" +
      foLast6HTML(log, upto) +
      "<div class='fo-live-watch' id='fo-watchers'></div></div>" +
      foFrCrease(tk) + bar + body + "</div>";
    try { foWatchPing("fr-" + id); } catch (eWp2) {}
    window.__foFrLiveRow = { id: id, c: c };
    window.__foFrCache = { id: id, html: page.innerHTML, done: false };
  }
  window.__foFrLiveTest = function (c, id) { foFrLiveDraw(c, id); };   // debug/test hook (harmless)
  // live tab + filter clicks redraw instantly from the last fetched row
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest(".fo-frltab,.fo-frlcf") : null;
    if (!b) return;
    ev.preventDefault();
    if (b.classList.contains("fo-frlcf")) window.__foFrLCF = b.getAttribute("data-f");
    else window.__foFrLTab = b.getAttribute("data-t");
    var lr = window.__foFrLiveRow;
    if (lr && (location.hash || "").indexOf(lr.id) >= 0) foFrLiveDraw(lr.c, lr.id);
  });
  function foFrDoneRender(c, id) {
    var page = document.getElementById("page"); if (!page) return;
    var r = c.result || {};
    var log = (r.log || []).slice().reverse();   // chronological
    var head = "<div class='crumb'>" + foClubLink(c.challenger_club) + " v " + foClubLink(c.opponent_club) + " &raquo; " + (c.__practice ? "Practice" : "Friendly") + "</div>";
    // broadsheet result header, shared with league scorecards
    var hero = "";
    try {
      var topF = r.fantasy && r.fantasy[0];
      var dateF = "";
      try { if (c.play_at) dateF = new Date(c.play_at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }); } catch (eD) {}
      hero = foMheadHTML(r.scorecard, r.result_text,
        { kind: c.__practice ? "PRACTICE" : "FRIENDLY", dateStr: dateF, pitch: c.pitch, weather: c.weather, ground: (r.meta && r.meta.ground) || "", toss: r.toss || foTossFromLog(r.log) },
        topF ? { n: topF.n, team: topF.team, sub: (topF.pts || 0) + " fantasy pts" } : (r.mom ? { n: r.mom } : null));
    } catch (eMh) {}
    if (!hero) hero = "<div class='fo-live-hero'><div class='fo-live-tag'>FULL TIME &middot; " + (c.__practice ? "PRACTICE" : "FRIENDLY") + "</div>" +
      "<div class='fo-live-score'>" + E(r.result_text || "Played") + "</div>" +
      "<div class='fo-live-sub'>" + foPitchName(c.pitch) + " pitch &middot; " + E(c.weather || "") + "</div></div>";
    var pom = "";
    var tab = window.__foFrTab || "score";
    var bar = "<div class='fo-sctabs'>" + [["score", "Scorecard"], ["comm", "Commentary"], ["charts", "Charts"], ["ratings", "Match ratings"], ["orders", "Orders"], ["fantasy", "Fantasy points"]].map(function (t2) {
      return "<button class='fo-sctab fo-frtab" + (tab === t2[0] ? " on" : "") + "' data-t='" + t2[0] + "'>" + t2[1] + "</button>";
    }).join("") + "</div>";
    var notRec = function (what) { return "<div class='panel'><div class='pad small'>" + what + " were not recorded for this match &middot; friendlies played from now on carry them.</div></div>"; };
    var body = "";
    var cf = window.__foFrCF || "all";
    if (tab === "ratings") {
      body = r.ratings_html ? "<div class='panel'><h4>Match ratings</h4><div class='pad'>" + foFairRatings(r.ratings_html) + "</div></div>" : notRec("Match ratings");
    } else if (tab === "fantasy") {
      if (r.fantasy && r.fantasy.length) {
        var frows = r.fantasy.slice(0, 22).map(function (x, i) {
          return "<tr" + (i === 0 ? " style='background:#fdf3e2'" : "") + "><td class='n'>" + (i + 1) + "</td><td><b>" + E(x.n) + "</b>" + (i === 0 ? " &#9733;" : "") + "<div class='small'>" + E(x.team || "") + "</div></td><td class='n'>" + (x.bat || 0) + "</td><td class='n'>" + (x.bowl || 0) + "</td><td class='n'>" + (x.field || 0) + "</td><td class='n'><b>" + (x.pts || 0) + "</b></td></tr>";
        }).join("");
        body = "<div class='panel'><h4>Fantasy points</h4><div class='pad'><table class='fo-sct'><thead><tr><th class='n'>#</th><th>Player</th><th class='n'>Bat</th><th class='n'>Bowl</th><th class='n'>Field</th><th class='n'>Pts</th></tr></thead><tbody>" + frows + "</tbody></table></div></div>";
      } else body = notRec("Fantasy points");
    } else if (tab === "orders") {
      var osec = (r.scorecard || []).map(function (inn) {
        if (!inn) return "";
        var xi = (inn.batting || []).map(function (b2, i2) {
          return "<tr><td class='n'>" + (i2 + 1) + "</td><td><b>" + E(b2.name) + "</b>" + (inn.captBatName === b2.name ? " <span class='fo-rl'>C</span>" : "") + "</td></tr>";
        }).join("");
        return "<div class='panel'><h4>" + E(inn.batTeam) + " &middot; batting order</h4><div class='pad'><table class='fo-sct'><tbody>" + xi + "</tbody></table>" +
          (inn.captBowlName ? "<div class='small' style='margin-top:6px'>" + E(inn.bowlTeam || "") + " captain in the field: <b>" + E(inn.captBowlName) + "</b></div>" : "") + "</div></div>";
      }).join("");
      body = osec || notRec("Orders");
    } else if (tab === "comm") {
      var cfBar = "<div class='fo-cfilters'>" + [["all", "All"], ["wickets", "Wickets"], ["boundaries", "Boundaries"], ["fielding", "Fielding"], ["talents", "Talents"], ["highlights", "Highlights"]].map(function (ff) {
        return "<button class='fo-sctab fo-frcf" + (cf === ff[0] ? " on" : "") + "' data-f='" + ff[0] + "'>" + ff[1] + "</button>";
      }).join("") + "</div>";
      body = log.length ? "<div class='panel'><h4>Ball-by-ball</h4><div class='pad'>" + cfBar + "<div id='ftpcomm' class='ftpskin'>" +
        (typeof ftpCommHTML === "function" ? ftpCommHTML(log, cf, 5000) : "") +
        (cf === "all" ? "<div class='fo-c-mile'><div class='text'>FULL TIME - " + E(r.result_text || "match complete") + ".</div><div class='clear'></div></div>" : "") + "</div></div></div>" : "<div class='panel'><div class='pad small'>No commentary was recorded for this match.</div></div>";
    } else if (tab === "charts") {
      try { if (r.worm && r.worm[0] && typeof foMatchCharts === "function") body = "<div class='panel'><h4>Charts</h4><div class='pad'>" + foMatchCharts(r.scorecard || [], r.worm) + "</div></div>"; } catch (eCh) {}
      if (!body) body = "<div class='panel'><div class='pad small'>No chart data was recorded for this match.</div></div>";
    } else {
      body = foFrScoreTables(r) || "<div class='panel'><div class='pad small'>No scorecard was recorded for this match.</div></div>";
    }
    page.innerHTML = "<div id='fo-fr-live'>" + head + hero + bar + pom + body + "</div>";
    window.__foFrCache = { id: id, row: c, html: page.innerHTML, done: true };
  }
  // tab + filter clicks are delegated, so they keep working after a cache restore
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest(".fo-frtab,.fo-frcf") : null;
    if (!b) return;
    ev.preventDefault();
    if (b.classList.contains("fo-frcf")) window.__foFrCF = b.getAttribute("data-f");
    else window.__foFrTab = b.getAttribute("data-t");
    var cc = window.__foFrCache;
    if (cc && cc.row) foFrDoneRender(cc.row, cc.id);
  });
  function foRenderFriendlyLive() {
    try {
      var mh = (location.hash || "").match(/^#\/friendly\?id=([\w-]+)/); if (!mh) return;
      var page = document.getElementById("page"); if (!page) return;
      // the engine re-renders #page on its own ticks (it does not know this
      // route): restore the cached page instantly instead of re-fetching, and
      // never re-fetch a finished match at all
      var cache = window.__foFrCache;
      if (cache && cache.id === mh[1]) {
        if (!page.querySelector("#fo-fr-live")) page.innerHTML = cache.html;
        if (cache.done) return;
      }
      // prac-<ts>: a locally banked practice broadcast (vs bots)
      if (mh[1].indexOf("prac-") === 0) {
        var pc = foPracBc();
        if (pc && pc.id === mh[1]) {
          var stP = foFrBcastState(pc);
          if (stP.phase === "live") { foFrLiveDraw(pc, mh[1]); return; }
          foFrDoneRender(pc, mh[1]); return;
        }
        mh = [mh[0], "hist-" + mh[1].slice(5)];   // broadcast gone: fall back to the stored card
      }
      // hist-<ts>: a locally saved practice game - no server round trip
      if (mh[1].indexOf("hist-") === 0) {
        var hk = mh[1].slice(5), he = null;
        (foFrHist() || []).forEach(function (e2) { if (String(e2.at) === hk) he = e2; });
        if (!he) { page.innerHTML = "<div class='crumb'>Practice game</div><div class='panel'><div class='pad small'>That practice game is no longer stored on this device.</div></div>"; return; }
        var meN = ""; try { meN = userTeam().name; } catch (eN) {}
        foFrDoneRender({
          challenger_club: meN, opponent_club: he.opp,
          pitch: he.pitch || "", weather: he.wx || he.ground || "",
          play_at: new Date(he.at).toISOString(),
          result: { result_text: he.txt, mom: he.mom, scorecard: (he.card && he.card.scorecard) || [], worm: he.card && he.card.worm }
        }, mh[1]);
        return;
      }
      if (!page.querySelector("#fo-fr-live")) page.innerHTML = "<div id='fo-fr-live'><div class='crumb'>Friendly &raquo; Live</div><div class='panel'><div class='pad small'>Tuning in&hellip;</div></div></div>";
      sel("league_challenges", "id=eq." + mh[1] + "&select=*").then(function (rows) {
        var c = rows && rows[0]; if (!c) { page.innerHTML = "<div class='panel'><div class='pad small'>That friendly is gone.</div></div>"; return; }
        try { var othP = c.challenger_club === userTeam().name ? c.opponent_club : c.challenger_club; if (!foClubHuman(othP)) c.__practice = true; } catch (ePr) {}
        if ((location.hash || "").indexOf(mh[1]) < 0) return;   // navigated away
        var st = foFrBcastState(c);
        var title = E(c.challenger_club) + " v " + E(c.opponent_club);
        var when = c.play_at ? new Date(c.play_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
        var head = "<div class='crumb'>" + foClubLink(c.challenger_club) + " v " + foClubLink(c.opponent_club) + " &raquo; " + (c.__practice ? "Practice" : "Friendly") + "</div>";
        if (st.phase === "pre") {
          // the wait is a proper pre-match show: countdown, form, leaders,
          // key battles, a conditions read, head-to-head and match facts.
          // Rendered ONCE and cached - the engine's page ticks restore it
          // instead of refetch-flashing every few seconds.
          var kindP = (c.__practice ? "Practice" : "Friendly");
          var lockT = new Date(Date.parse(c.play_at) - 3600000);
          var lockedP = Date.now() >= +lockT;
          var ordN = 0; try { ordN = Object.keys(c.orders || {}).length; } catch (eOn) {}
          var preKey = mh[1] + ":" + (lockedP ? 1 : 0) + ":" + ordN;
          if (page.__foFrPre === preKey && page.querySelector(".fo-pv")) { try { foWatchPing("fr-" + mh[1]); } catch (eW1) {} return; }
          page.__foFrPre = preKey;
          var fmtT9 = function (d9) { return d9.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + (foTzAbbr() ? " " + foTzAbbr() : ""); };
          var homeT9 = null; (GD.teams || []).forEach(function (t9) { if (t9 && t9.name === c.challenger_club) homeT9 = t9; });
          var xiRow9 = function (nm9) {
            var inOrd = false; try { inOrd = !!(c.orders && c.orders[nm9]); } catch (eXi) {}
            return "<div class='fo-pv-fact'><span>" + E(nm9) + " XI</span><b>" + (inOrd ? "&#10003; attached" : (lockedP ? "auto XI plays" : "auto XI unless attached")) + "</b></div>";
          };
          var pv9 = "";
          try {
            var em9 = (typeof foEmbargo === "function") ? foEmbargo() : { active: false };
            pv9 = foMatchPreviewHTML(
              { home: c.challenger_club, away: c.opponent_club, ground: (homeT9 && homeT9.ground) || "", pitch: c.pitch, weather: c.weather },
              em9.active ? em9.round : null,
              { firstBall: fmtT9(new Date(c.play_at)), lock: (lockedP ? "Locked at " : "Lock at ") + fmtT9(lockT),
                extraFacts: xiRow9(c.challenger_club) + xiRow9(c.opponent_club) });
          } catch (ePv9) {}
          var preHtml = "<div id='fo-fr-live'>" + head +
            "<div class='fo-live-hero'><div class='fo-live-tag'>" + kindP.toUpperCase() + " &middot; " + when + (foTzAbbr() ? " " + foTzAbbr() : "") + "</div>" +
            "<div class='fo-live-score fo-live-vs'>" + title + "</div>" +
            "<div class='fo-live-sub'>" + foPitchName(c.pitch) + " pitch &middot; " + E(c.weather || "") + (lockedP ? " &middot; lineups are locked" : "") + " &middot; play begins on the hour, ball by ball</div>" +
            "<div class='fo-pv-cdw'><span class='fo-pv-cdk'>First ball in</span><b class='fo-pv-cd' id='fo-fr-cd'>" + foCdText(Date.parse(c.play_at) - Date.now()) + "</b></div>" +
            "<div class='fo-live-watch' id='fo-watchers'></div></div>" + pv9 + "</div>";
          page.innerHTML = preHtml;
          window.__foFrCache = { id: mh[1], html: preHtml, done: false };
          try { foWatchPing("fr-" + mh[1]); } catch (eW2) {}
          if (window.__foFrCdIv) clearInterval(window.__foFrCdIv);
          window.__foFrCdIv = setInterval(function () {
            var el9 = document.getElementById("fo-fr-cd");
            if (!el9 || (location.hash || "").indexOf(mh[1]) < 0) { clearInterval(window.__foFrCdIv); window.__foFrCdIv = null; return; }
            var left9 = Date.parse(c.play_at) - Date.now();
            if (left9 <= 0) {
              clearInterval(window.__foFrCdIv); window.__foFrCdIv = null;
              window.__foFrCache = null; page.__foFrPre = null;
              foRenderFriendlyLive(); return;                 // the toss: over to the live view
            }
            el9.textContent = foCdText(left9);
            try { var ch9 = window.__foFrCache; if (ch9 && ch9.id === mh[1] && !ch9.done) ch9.html = page.innerHTML; } catch (eCh9) {}
          }, 1000);
          return;
        }
        if (st.phase === "live" && !c.result) {
          page.innerHTML = head + "<div class='fo-live-hero'><div class='fo-live-tag'><span class='live-dot'></span> DELAYED AT THE TOSS</div>" +
            "<div class='fo-live-score fo-live-vs'>" + title + "</div>" +
            "<div class='fo-live-sub'>The league engine is warming up &middot; play catches up the moment it arrives. Keep this page open.</div></div>";
          return;
        }
        var r = c.result || {};
        var log = (r.log || []).slice().reverse();   // stored newest-first -> chronological
        if (st.phase === "live") { foFrLiveDraw(c, mh[1]); return; }
        // done: full time - a proper little match centre with sub-tabs
        foFrDoneRender(c, mh[1]);
      }).catch(function () {
        var pg2 = document.getElementById("page");
        if (pg2 && /Tuning in/.test(pg2.textContent || "")) pg2.innerHTML = "<div class='crumb'>Friendly</div><div class='panel'><div class='pad small'>Could not load this friendly &middot; check your connection and try again.</div></div>";
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderFriendlyLive, 20); });
  document.addEventListener("click", function (ev) {
    var a0 = ev.target && ev.target.closest ? ev.target.closest("a[href^='#/friendly?id=']") : null;
    if (!a0) return;
    ev.preventDefault();
    location.hash = a0.getAttribute("href");
    if (typeof window.route === "function") try { window.route(); } catch (e) {}
    setTimeout(foRenderFriendlyLive, 10); setTimeout(foRenderFriendlyLive, 400);
  });
  if (typeof window.route === "function" && !window.route.__foFrLive) {
    var _rtFr = window.route;
    window.route = function () { var r2 = _rtFr.apply(this, arguments); try { foRenderFriendlyLive(); } catch (e) {} return r2; };
    window.route.__foFrLive = 1;
  }
  setInterval(function () { try { if (/^#\/friendly\?/.test(location.hash || "")) foRenderFriendlyLive(); } catch (e) {} }, 6000);
  // ---- friendlies: one panel on the Matches page for the whole lifecycle -
  // practice games, incoming/sent challenges, upcoming friendlies, results ----
  function foFriendliesPanel() {
    try {
      if (App.page !== "matches") return;
      var page = document.getElementById("page"); if (!page) return;
      var legacy = page.querySelector("#fo-frhist"); if (legacy) legacy.remove();
      foFrSchedLoad();
      var t = userTeam(); var me = t.name;
      var mp = !!(SYNC && SYNC.started && !SYNC.practice && LG);
      var frWhen = function (ts) { return foWhenTxt(ts); };
      // ---- one chronological list: practice + challenges, oldest first ----
      var entries = [];
      (foFriendlies || []).forEach(function (fr, i) {
        entries.push({ ts: Date.now(), up: true, html: "<tr class='fo-fx-fr'><td>Now</td><td>Practice</td><td>vs " + E(fr.oppName) + " <span class='small'>" + foPitchName(fr.pitch) + ", " + E(fr.weather || "") + "</span></td><td class='r'><button class='fo-fr-play' data-i='" + i + "'>Play</button> <button class='fo-fr-x' data-i='" + i + "' title='Remove'>&#10005;</button></td></tr>" });
      });
      try {
        (foFrHist() || []).forEach(function (e2) {
          var ts = +new Date(e2.at) || 0;
          var res, upP = false;
          var bcP = foPracBc();
          if (bcP && bcP.id === "prac-" + e2.at) {
            var fstP = foFrBcastState(bcP);
            upP = fstP.phase === "live";
            res = fstP.phase === "live"
              ? "<a class='fo-frs-live' href='#/friendly?id=prac-" + e2.at + "'><span class='live-dot'></span> LIVE &middot; " + foFrLiveLine(bcP, fstP.p) + " &middot; watch &rsaquo;</a>"
              : "<a href='#/friendly?id=prac-" + e2.at + "'>" + E(e2.txt) + "</a>";
          } else if (e2.card && e2.card.scorecard) {
            // the stored card outlives App.results (league snapshots replace it)
            res = "<a href='#/friendly?id=hist-" + e2.at + "'>" + E(e2.txt) + "</a>";
          } else {
            // older entries: link only while the engine still holds the result
            var ix = null;
            try { (App.results || []).forEach(function (r0, i0) { if (r0.comp === "friendly" && r0.result && r0.result.text === e2.txt && (r0.away === e2.opp || r0.home === e2.opp)) ix = (r0.ix != null ? r0.ix : i0); }); } catch (eIx) {}
            res = ix != null ? "<a href='#/scorecard?i=" + ix + "'>" + E(e2.txt) + "</a>" : E(e2.txt);
          }
          var cond = (e2.pitch || e2.wx) ? " <span class='small'>" + foPitchName(e2.pitch || "") + (e2.wx ? ", " + E(e2.wx) : "") + "</span>" : (e2.ground ? " <span class='small'>" + E(e2.ground) + "</span>" : "");
          entries.push({ ts: ts, up: upP, html: "<tr><td>" + frWhen(e2.at) + "</td><td>Practice</td><td>vs " + E(e2.opp) + cond + "</td><td>" + res + "</td></tr>" });
        });
      } catch (eH) {}
      if (mp && window.__foFrRows) {
        var seenK = "fol_chseen_" + LG.id, seen = {};
        try { seen = JSON.parse(lsGet(seenK) || "{}"); } catch (e) {}
        window.__foFrRows.forEach(function (c) {
          var mineSent = c.challenger_club === me;
          var vs = mineSent ? c.opponent_club : c.challenger_club;
          var ts = c.play_at ? +new Date(c.play_at) : (+new Date(c.created_at) || 0);
          var when = c.play_at ? frWhen(c.play_at) : "";
          var fst = foFrBcastState(c);
          if (foFrDead(c)) return;   // expired unanswered challenge: gone
          var act = "";
          if (c.status === "pending" && !mineSent) act = "<button class='mini fo-ch-acc' data-id='" + c.id + "'>Accept</button> <button class='mini fo-ch-dec' data-id='" + c.id + "'>Decline</button>";
          else if (c.status === "pending") act = "<span class='small'>awaiting their reply</span>";
          else if ((c.status === "accepted" || c.status === "played") && fst.phase === "live")
            act = "<a class='fo-frs-live' href='#/friendly?id=" + c.id + "'><span class='live-dot'></span> LIVE &middot; " + foFrLiveLine(c, fst.p) + " &middot; watch &rsaquo;</a>";
          else if (c.status === "accepted" && fst.phase === "done") act = "<span class='small'>delayed &middot; waiting on the league engine</span>";
          else if (c.status === "accepted") {
            var hasOrd = false; try { hasOrd = !!(c.orders && c.orders[me]); } catch (eO) {}
            var lkd = c.play_at && (new Date(c.play_at) - Date.now() <= 60 * 60000);
            act = "<span class='fo-frs-on'>ON</span> " + (lkd
              ? "<span class='small'>&#128274; lineups locked" + (hasOrd ? " \u00b7 <span style='color:#15803D'>&#10003; yours is in</span>" : " \u00b7 auto XI plays") + "</span> <a href='#/friendly?id=" + c.id + "'>Preview &rsaquo;</a>"
              : "<button class='mini fo-ch-ord' data-id='" + c.id + "'>" + (hasOrd ? "Edit lineup" : "Prepare lineup") + "</button>" + (hasOrd ? " <span class='small' style='color:#15803D'>&#10003; lineup attached</span>" : ""));
          }
          else if (c.status === "declined") act = "<span class='small'>declined</span>";
          else if (c.status === "expired") act = "<span class='small'>expired</span>";
          else if (c.status === "played" && c.result && fst.phase === "done") {
            act = "<a href='#/friendly?id=" + c.id + "'>" + E(c.result.result_text || "played") + "</a>";
            if (!seen[c.id]) { toast("Friendly result: " + (c.result.result_text || "played")); seen[c.id] = 1; }
          }
          else if (c.status === "played" && fst.phase === "pre") {
            // banked early by the resolver: the broadcast has not started yet -
            // say when it kicks off, never the result
            act = "<span class='fo-frs-on'>ON</span> <span class='small'>kicks off " + when + "</span> <a href='#/friendly?id=" + c.id + "'>Preview &rsaquo;</a>";
          }
          var typLbl = "Friendly"; try { if (!foClubHuman(vs)) typLbl = "Practice"; } catch (eTL) {}
          var upC = c.status === "pending" || c.status === "accepted" || (c.status === "played" && fst.phase === "live");
          entries.push({ ts: ts, up: upC, html: "<tr><td>" + when + "</td><td>" + typLbl + "</td><td>" + (mineSent ? "vs " : "from ") + E(vs) + " <span class='small'>" + foPitchName(c.pitch) + ", " + E(c.weather || "") + "</span></td><td>" + act + "</td></tr>" });
        });
        lsSet(seenK, JSON.stringify(seen));
      }
      // my league fixtures and results join the same list - one page, one
      // chronology, FTP style: date, type, match, result or action
      try {
        var lgAt9 = function (rn) {
          var d9 = new Date(); d9.setHours(9, 0, 0, 0);
          d9.setDate(d9.getDate() + (rn - App.season.round) + (foCurAdvanced() ? 1 : 0));
          return +d9;
        };
        var emL = (typeof foEmbargo === "function") ? foEmbargo() : { active: false };
        (App.results || []).forEach(function (r9) {
          if (!r9 || r9.comp !== "league" || (r9.home !== me && r9.away !== me)) return;
          var rIx9 = typeof r9.round === "number" ? r9.round : 0;
          var onAir9 = emL.active && emL.round === rIx9;
          var res9 = onAir9
            ? "<a class='fo-frs-live' href='#/scorecard?i=" + r9.ix + "'>" + (emL.pre ? "plays 9:00 AM ET &middot; preview &rsaquo;" : "<span class='live-dot'></span> LIVE &middot; watch &rsaquo;") + "</a>"
            : "<a href='#/scorecard?i=" + r9.ix + "'>" + E((r9.result && r9.result.text) || "played") + "</a>";
          entries.push({ ts: lgAt9(rIx9), up: onAir9, html: "<tr><td>" + E(foWhenTxt(lgAt9(rIx9))) + "</td><td>League <span class='small'>R" + (rIx9 + 1) + "</span></td><td>" + E(r9.home) + " v " + E(r9.away) + "</td><td>" + res9 + "</td></tr>" });
        });
        (typeof foUserFixtures === "function" ? foUserFixtures() : []).forEach(function (x9) {
          var isN9 = App.season && x9.round === App.season.round;
          var subIn9 = !!((SYNC && SYNC.submitted && SYNC.submitted[x9.round]) || (App.orders && App.orders.saved && App.season && x9.round === App.season.round));
          entries.push({ ts: lgAt9(x9.round), up: true, html: "<tr" + (isN9 ? " class='fo-fx-fr'" : "") + "><td>" + E(foWhenTxt(lgAt9(x9.round))) + "</td><td>League <span class='small'>R" + (x9.round + 1) + "</span></td><td>" + (x9.isHome ? "vs " : "@ ") + E(x9.opp.name) + " <span class='small'>" + E(foPitchName(x9.pitch) || "") + (x9.weather ? ", " + E(x9.weather) : "") + "</span></td><td class='r'><button class='mini fo-setr' data-r='" + x9.round + "'>" + (subIn9 ? "Edit lineup" : (isN9 ? "Set lineup" : "Plan lineup")) + "</button>" + (subIn9 ? " <span class='small' style='color:#15803D'>&#10003;</span>" : "") + "</td></tr>" });
        });
      } catch (eLgRows) {}
      // one straight chronology, oldest match first; only the deep history
      // tail is trimmed (the newest 14 results always stay)
      entries.sort(function (a2, b2) { return (a2.ts || 0) - (b2.ts || 0); });
      var doneTotal = entries.filter(function (e4) { return !e4.up; }).length;
      var dropOld = Math.max(0, doneTotal - 14), dropped9 = 0;
      entries = entries.filter(function (e4) { return e4.up ? true : ++dropped9 > dropOld; });
      // IDEMPOTENT render: this runs from the page MutationObserver, so a
      // remove+recreate here re-triggers the observer forever and the panel
      // churns ~20x/sec - real clicks then land on a node that no longer
      // exists by mouseup and simply die. Only touch the DOM when the
      // rendered HTML actually changed.
      var inner = "<h4>All matches <span class='small' style='font-weight:400'>&middot; league, friendlies &amp; practice &middot; oldest first</span></h4><div class='pad'>" +
        "<div class='fo-frs-bar'><button class='primary' id='fo-frs-new'>New practice game</button><span class='small'>No points, no fatigue.</span></div>" +
        (entries.length ? "<table><tr><th>Date</th><th>Type</th><th>Match</th><th>Result</th></tr>" + entries.map(function (e3) { return e3.html; }).join("") + "</table>" : "<div class='small' style='margin-top:8px'>No matches yet. Set up a practice game above, or challenge a rival from their club page.</div>") +
        "</div>";
      var pnl = page.querySelector("#fo-frs");
      if (pnl && pnl.__foInner === inner) { foFrsRefetch(me); return; }
      if (!pnl) {
        pnl = document.createElement("div");
        pnl.className = "panel fo-keep"; pnl.id = "fo-frs";
        var anchor = null;
        page.querySelectorAll(".panel h4").forEach(function (h) { if (/Fixtures & results/i.test(h.textContent || "")) anchor = h.parentNode; });
        if (anchor) anchor.parentNode.insertBefore(pnl, anchor);
        else page.appendChild(pnl);
      }
      pnl.innerHTML = inner;
      pnl.__foInner = inner;
      pnl.querySelectorAll(".fo-fr-play").forEach(function (b2) { b2.addEventListener("click", function () { var fr = foFriendlies[+b2.getAttribute("data-i")]; if (fr) foPlayFriendly(fr); }); });
      pnl.querySelectorAll(".fo-fr-x").forEach(function (b2) { b2.addEventListener("click", function () { foRemoveFriendly(+b2.getAttribute("data-i")); }); });
      pnl.querySelectorAll(".fo-ch-acc,.fo-ch-dec").forEach(function (b2) {
        b2.addEventListener("click", function () {
          rpc("challenge_respond", { p_id: b2.getAttribute("data-id"), p_accept: b2.classList.contains("fo-ch-acc") })
            .then(function () {
              if (b2.classList.contains("fo-ch-acc")) {
                var cA = (window.__foFrRows || []).filter(function (x) { return String(x.id) === b2.getAttribute("data-id"); })[0];
                toast("Challenge accepted" + (cA ? " \u00b7 kicks off " + foChalWhen(cA) : "") + ".");
                try { if (App.orders && App.orders.saved && cA) rpc("challenge_set_orders", { p_id: cA.id, p_club: userTeam().name, p_orders: App.orders }).catch(function () {}); } catch (eAt) {}
              } else toast("Challenge declined.");
              window.__foFrSig = null; window.__foFrFetchAt = 0; foFriendliesPanel();
            })
            .catch(say);
        });
      });
      pnl.querySelectorAll(".fo-ch-ord").forEach(function (b2) {
        b2.addEventListener("click", function () {
          var c2 = (window.__foFrRows || []).filter(function (x) { return String(x.id) === b2.getAttribute("data-id"); })[0];
          if (c2) foChalPrep(c2);
        });
      });
      pnl.querySelectorAll(".fo-setr").forEach(function (b2) {
        b2.addEventListener("click", function () { foSetOrdersForRound(+b2.getAttribute("data-r")); });
      });
      // the unified list replaces the separate fixtures cards - one list, no maze
      try {
        page.querySelectorAll(".panel").forEach(function (pn9) {
          if (pn9 === pnl) return;
          var h9 = pn9.querySelector("h4"); if (!h9) return;
          var tx9 = (h9.textContent || "").trim();
          if (/^Fixtures & results/i.test(tx9) || /^Round \d+ of \d+/i.test(tx9)) pn9.style.display = "none";
        });
      } catch (eHd) {}
      foFrsRefetch(me);
    } catch (e) {}
  }
  // refresh the challenge data (throttled - the panel renderer runs on every
  // page mutation); re-render only when the data actually changed
  function foFrsRefetch(me) {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      if (window.__foFrFetchAt && Date.now() - window.__foFrFetchAt < 10000) return;
      window.__foFrFetchAt = Date.now();
      sel("league_challenges", "league_id=eq." + LG.id + "&select=*&order=created_at.desc&limit=24").then(function (rows) {
        window.__foFrAll = rows || [];
        rows = (rows || []).filter(function (c) { return c.challenger_club === me || c.opponent_club === me; });
        var sig = JSON.stringify(rows.map(function (c) { return c.id + ":" + c.status + ":" + !!c.result; }));
        if (sig !== window.__foFrSig) {
          window.__foFrSig = sig; window.__foFrRows = rows;
          foFriendliesPanel();
        } else window.__foFrRows = rows;
      }).catch(function () {});
    } catch (e) {}
  }
  // the league's full challenge list (every manager's matches) - kept fresh
  // by the bell poll; the first caller on a cold page fetches it once and cb
  // fires when it lands so the page can repaint
  function foFrAllNow(cb) {
    if (window.__foFrAll !== undefined) return window.__foFrAll;
    if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return [];   // pre-login: do not cache
    if (!window.__foFrAllReq) {
      window.__foFrAllReq = 1;
      sel("league_challenges", "league_id=eq." + LG.id + "&select=*&order=created_at.desc&limit=24").then(function (rows) {
        window.__foFrAll = rows || [];
        if (cb) cb();
      }).catch(function () {});
    }
    return null;
  }
  // live rows tick over even when nothing else repaints the page
  setInterval(function () { try { if (App.page === "matches") foFriendliesPanel(); } catch (e) {} }, 6000);
  // home: a one-line nudge when a challenge needs the manager's attention
  function foChalAlert() {
    try {
      if (!(SYNC && SYNC.started && !SYNC.practice && LG)) return;
      var host = document.getElementById("fo-chal-alert"); if (!host) return;
      var me = userTeam().name;
      sel("league_challenges", "league_id=eq." + LG.id + "&select=*&order=created_at.desc&limit=12").then(function (rows) {
        rows = (rows || []).filter(function (c) { return c.challenger_club === me || c.opponent_club === me; });
        var host2 = document.getElementById("fo-chal-alert"); if (!host2) return;
        var inc = rows.filter(function (c) { return c.status === "pending" && c.opponent_club === me && !foFrDead(c); })[0];
        var up = rows.filter(function (c) { return c.status === "accepted"; })[0];
        if (inc) host2.innerHTML = "<a class='fo-chal-chip' href='#/matches'>&#9876; " + E(inc.challenger_club) + " challenge you to a friendly &middot; <b>respond &rsaquo;</b></a>";
        else if (up) host2.innerHTML = "<a class='fo-chal-chip' href='#/matches'>&#9876; Friendly " + (up.challenger_club === me ? "vs " + E(up.opponent_club) : "vs " + E(up.challenger_club)) + " &middot; " + new Date(up.play_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + " &middot; <b>Matches &rsaquo;</b></a>";
      }).catch(function () {});
    } catch (e) {}
  }

  // ---- stadium expansion: a long-term money sink to rival the academy --------
  var FO_SEAT_STEP = 1500, FO_SEAT_RATE = 80, FO_SEAT_CAP = 15000;
  var FO_DEAL_INFO = {
    community: { name: "Prudential", base: 45000, win: 0, line: "$45,000 every matchday, win or lose. No win bonus." },
    results:   { name: "Nike",       base: 38000, win: 13000, line: "$38,000 every matchday, plus $13,000 for every win." },
    contender: { name: "Emirates",   base: 15000, win: 45000, line: "$15,000 every matchday, plus $45,000 for every win." }
  };
  function foDealResolve(t) {
    var id = (t && t.sponsorDeal && t.sponsorDeal.id) || (t && t.sponsor) || null;
    return FO_DEAL_INFO[id] ? { id: id, d: FO_DEAL_INFO[id], known: true } : { id: "community", d: FO_DEAL_INFO.community, known: false };
  }
  function foOfficeExtras() {
    // Retired: the Office page is fully rendered by the pgOffice override
    // (see the office module at the end of this file); sync diagnostics and
    // saves live on #/settings.
  }
  window.addEventListener("hashchange", function () { setTimeout(foOfficeExtras, 30); });

  // ---- the newspaper: a digest of the latest round for the club home ---------
  function foNewsDigest() {
    var rd = foLastRoundIx(); if (rd < 0) return "";
    try {
      var em0 = (typeof foEmbargo === "function") ? foEmbargo() : { active: false };
      if (em0.active && em0.round === rd) {
        return "<div class='fo-card fo-news'><div class='fo-card-h2row'><div class='fo-card-h2'>The Fifty Overs Post &middot; Round " + (rd + 1) + "</div><a class='fo-morelink' href='#/matchday'>Watch live &rsaquo;</a></div>" +
          "<div class='fo-card-b'><div style='font-size:13px;line-height:1.65'>&#128308; <b>Play is underway at every ground.</b> Scores are coming in over the hour; the Post goes to print at stumps.</div></div></div>";
      }
    } catch (e0) {}
    var results = foLeagueRounds()[rd] || []; if (!results.length) return "";
    var my = ""; try { my = userTeam().name; } catch (e) {}
    var items = [];
    results.forEach(function (r) {
      var txt = (r.result && r.result.text) || "";
      var star = foPerfList([r])[0];
      var mine = r.home === my || r.away === my;
      items.push({ pri: mine ? 0 : 2, h: txt, s: E(r.ground || "") + (star ? " · star: " + E(star.name) + " " + E(star.line) : ""), sc: r.ix });
      foPerfList([r]).forEach(function (p) {
        if (p.kind === "bat" && p.r >= 100) items.push({ pri: 1, h: "CENTURY: " + E(p.name) + " " + E(p.line), s: "for " + E(p.club), sc: r.ix });
        if (p.kind === "bowl" && p.w >= 5) items.push({ pri: 1, h: (p.w >= 8 ? "EIGHT-FOR" : p.w === 7 ? "SEVEN-FOR" : p.w === 6 ? "SIX-FOR" : "FIVE-FOR") + ": " + E(p.name) + " " + E(p.line), s: "for " + E(p.club), sc: r.ix });
      });
    });
    try {
      GD.teams.forEach(function (t) {
        var rep = t._trainReport || {};
        (rep.signings || []).forEach(function (s) { items.push({ pri: 3, h: E(t.name) + ": " + E(s), s: "" }); });
        (rep.injuries || []).forEach(function (s) { items.push({ pri: 1, h: "INJURY: " + E(s), s: E(t.name) }); });
        // the chronicle: debuts, milestones and nicknames from this round
        if (t._chron && t._chron.r === rd + 1) (t._chron.items || []).forEach(function (c) {
          if (c.ev === "debut") items.push({ pri: 1, h: "DEBUT: " + E(c.name) + " takes the field for the first time", s: "for " + E(t.name) });
          if (c.ev === "runs") items.push({ pri: 1, h: "MILESTONE: " + E(c.name) + " reaches " + (+c.n).toLocaleString() + " club runs", s: "for " + E(t.name) });
          if (c.ev === "wkts") items.push({ pri: 1, h: "MILESTONE: " + E(c.name) + " takes his " + c.n + "th wicket for the club", s: "for " + E(t.name) });
          if (c.ev === "glove") items.push({ pri: 1, h: "MILESTONE: " + E(c.name) + " claims his " + c.n + "th dismissal behind the stumps", s: "for " + E(t.name) });
          if (c.ev === "nick") items.push({ pri: 1, h: "NICKNAME: " + E(c.name) + " will be known as “" + E(c.nick) + "” after that performance", s: "so say the fans of " + E(t.name) });
          if (c.ev === "cap") items.push({ pri: 0, h: "CALL-UP: " + E(c.name) + " selected for " + E(c.nat), s: "the " + (c.n > 1 ? c.n + (c.n === 2 ? "nd" : c.n === 3 ? "rd" : "th") + " cap for" : "first cap for") + " the " + E(t.name) + " man" });
        });
        if (t._chronFarewell && t._chronFarewell.s === (App.seasonNo || 1) - 1) t._chronFarewell.names.forEach(function (nm) {
          items.push({ pri: 0, h: "FAREWELL: " + E(nm) + " retires", s: "a " + E(t.name) + " career remembered in the museum · he " + foDestiny(nm) });
        });
        if (t._chronAwards && t._chronAwards.s === (App.seasonNo || 1)) (t._chronAwards.list || []).slice(0, 3).forEach(function (aw) {
          items.push({ pri: 0, h: "AWARD: " + E(aw.name) + " · " + E(aw.kind), s: "for " + E(t.name) });
        });
      });
    } catch (e) {}
    // the dressing-room line keeps a reserved seat at the end of the page
    var voiceLi = "";
    try {
      var vt = foMyClub();
      var vi = vt && foVoiceItem(vt, rd + 1);
      if (vi) voiceLi = "<li><div class='fo-news-h'>" + vi.h + "</div></li>";
    } catch (e) {}
    try {
      if (typeof foMarketRefreshIn === "function" && foMarketRefreshIn() === 1) items.push({ pri: 4, h: "RUMOUR: fresh names reach the market after the next matchday", s: "the scouts are already whispering about who arrives" });
    } catch (e) {}
    items.sort(function (a, b) { return a.pri - b.pri; });
    var lis = items.slice(0, 6).map(function (it) {
      var link = it.sc != null ? " class='fo-rowlink' data-sc='" + it.sc + "' title='Open the scorecard'" : "";
      return "<li" + link + "><div class='fo-news-h'>" + it.h + "</div>" + (it.s ? "<div class='fo-news-s'>" + it.s + "</div>" : "") + "</li>";
    }).join("") + voiceLi;
    var byline = "";
    try { byline = "<div class='fo-news-by'>Reporting: " + E(foBeatWriter()) + "</div>"; } catch (e) {}
    return "<div class='fo-card fo-news'><div class='fo-card-h2row'><div class='fo-card-h2'>The Fifty Overs Post · Round " + (rd + 1) + "</div><a class='fo-morelink' href='#/matchday'>Watch the matchday ›</a></div><div class='fo-card-b'><ul style='margin:0;padding-left:4px;list-style:none;font-size:13px'>" + lis + "</ul>" + byline + "</div></div>";
  }

  // ---- the Training page ------------------------------------------------------
  function foTrainingPage() {
    var page = document.getElementById("page"); if (!page) return;
    var t = foMyClub();
    if (!t || !t.players || !t.players.length) { page.innerHTML = "<div class='crumb'>Training</div><div class='panel'><h4>Training</h4><div class='pad'>No squad yet · finish your draft first.</div></div>"; return; }
    var st = foTrainState();
    try {
      var dirty = false;
      for (var nmT in st.training) {
        var oT = st.training[nmT] || {};
        var wantI = oT.program === "Rest" ? "Rest" : "Normal";
        if (oT.intensity !== wantI) { oT.intensity = wantI; dirty = true; }
      }
      if (dirty) foTrainSave(st);
    } catch (eSc) {}
    var round = (App.season && App.season.round) || 0;
    var rep = t._trainReport || (App.trainingReports && App.trainingReports[0]) || null;
    var ward = (t.injured && t.injured.length)
      ? "<div class='fo-yc-note' style='border-color:#e8c9c2;background:#fbeeea'><b>Injury ward:</b> " + t.injured.map(function (p) { return E(p.name) + " (" + (p._inj || 1) + " matchday" + ((p._inj || 1) === 1 ? "" : "s") + ")"; }).join(" · ") + "</div>"
      : "";

    var progOpts = function (cur) {
      return FO_TR_PROGS.map(function (k) { return "<option value='" + k + "'" + (cur === k ? " selected" : "") + ">" + k + "</option>"; }).join("");
    };

    var potCls = { Star: "star", High: "high", Useful: "useful", Limited: "limited" };

    var sorted = t.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
    var enBar = function (en, lbl) {
      return "<div class='fo-en' title='" + E(en.raw) + "'>" + (lbl ? "<span class='fo-en-k'>Energy</span>" : "") + "<div class='fo-en-bar'><u class='fo-en-" + en.word + "' style='width:" + en.pct + "%'></u></div><span class='fo-en-w fo-en-w-" + en.word + "'>" + en.word + "</span></div>";
    };
    var gainOf = function (p, tr, pr) {
      if (pr.pct > 0) return foSkillLabel(pr.skill) + " &middot; " + pr.pct + "%";
      var w0 = FO_TR_PROGMAP[tr.program] || {};
      var tops = Object.keys(w0).sort(function (a, b) { return (w0[b] || 0) - (w0[a] || 0); }).slice(0, 2).map(foSkillLabel);
      return tops.length ? "targets " + tops.join(", ") : "resting";
    };
    var rows = sorted.map(function (p) {
      var tr = foTrOf(p), pr = foTrProgress(p), en = foEnergyOf(p);
      var flag = ""; try { flag = (typeof foFlag === "function" && p.nat) ? foFlag(p.nat) : ""; } catch (e) {}
      return "<tr>" +
        "<td class='fo-tr-nm'>" + flag + " <a class='fo-tr-link' href='#/player?n=" + encodeURIComponent(p.name) + "'><b>" + E(p.name) + "</b></a><span class='fo-tr-meta'>" + foRoleShort(p) + " · age " + (p.age || "?") + "</span></td>" +
        "<td>" + enBar(en) + "</td>" +
        "<td><select class='fo-tr-prog' data-p='" + E(p.name).replace(/'/g, "&#39;") + "'>" + progOpts(tr.program) + "</select></td>" +
        "<td class='fo-tr-progress'><div class='fo-tr-bar' title='" + E(gainOf(p, tr, pr) + " \u00b7 " + foTrPace(p, tr)) + "'><u style='width:" + pr.pct + "%'></u></div></td>" +
        "</tr>";
    }).join("");
    // phone: per-player decision cards instead of a five-column scroll
    var cards = sorted.map(function (p) {
      var tr = foTrOf(p), pr = foTrProgress(p), en = foEnergyOf(p);
      var w0 = FO_TR_PROGMAP[tr.program] || {};
      var chips = Object.keys(w0).sort(function (a, b) { return (w0[b] || 0) - (w0[a] || 0); }).slice(0, 3).map(function (k) {
        return "<span class='fo-trc-w'><u style='background:" + (FO_SK_COLOR[k] || "#667085") + "'></u>" + E(foSkillLabel(k)) + " <b>" + w0[k] + "%</b></span>";
      }).join("");
      var warn = (en.tired && tr.program !== "Rest" && tr.intensity !== "Rest")
        ? "<div class='fo-trc-warn'>&#9888; Tired players train slowly &middot; consider <b>Rest</b>.</div>" : "";
      return "<div class='fo-trc'>" +
        "<div class='fo-trc-h'><a href='#/player?n=" + encodeURIComponent(p.name) + "'><b>" + E(p.name) + "</b></a><span class='fo-tr-meta'>" + foRoleShort(p) + " · age " + (p.age || "?") + "</span></div>" +
        enBar(en, true) + warn +
        "<div class='fo-trc-row fo-trc-one'><label>Program<select class='fo-tr-prog' data-p='" + E(p.name).replace(/'/g, "&#39;") + "'>" + progOpts(tr.program) + "</select></label></div>" +
        (chips ? "<div class='fo-trc-ws'>" + chips + "</div>" : "<div class='fo-trc-ws small'>Recovery week &middot; energy climbs instead of skills.</div>") +
        "<div class='fo-tr-progress'><div class='fo-tr-bar' title='" + E(gainOf(p, tr, pr) + " \u00b7 " + foTrPace(p, tr)) + "'><u style='width:" + pr.pct + "%'></u></div></div>" +
        "</div>";
    }).join("");

    var tiredNow = t.players.filter(function (p) { return foEnergyOf(p).tired && foTrOf(p).program !== "Rest" && foTrOf(p).intensity !== "Rest"; });
    var tiredHtml = tiredNow.slice(0, 4).map(function (p) {
      return "<div class='fo-tr-g fo-tr-warn'>" + FO_I("warn", 14) + " " + E(p.name) + " is tired and will train poorly until he rests.</div>";
    }).join("") + (tiredNow.length > 4 ? "<div class='fo-tr-g fo-tr-warn small'>+" + (tiredNow.length - 4) + " more tired players below</div>" : "");
    var repHtml = "";
    if (rep && (rep.gains || []).length + (rep.recovery || []).length + (rep.signings || []).length) {
      repHtml = ward + "<div class='panel'><h4>This week in the nets · after matchday " + (rep.round || round) + "</h4><div class='pad fo-tr-rep'>" +
        (rep.signings || []).map(function (g) { return "<div class='fo-tr-g fo-tr-sign'>" + FO_I("users", 14) + " " + E(g) + "</div>"; }).join("") +
        (rep.gains || []).map(function (g) { return "<div class='fo-tr-g'>" + FO_I("checkCircle", 14) + " " + E(g) + "</div>"; }).join("") +
        (rep.recovery || []).map(function (g) { return "<div class='fo-tr-g fo-tr-rec'>" + FO_I("shield", 14) + " " + E(g) + "</div>"; }).join("") +
        tiredHtml +
        "</div></div>";
    } else {
      repHtml = ward + "<div class='panel'><h4>This week in the nets</h4><div class='pad fo-tr-rep'><div class='small'>Gains land after each matchday.</div>" + tiredHtml + "</div></div>";
    }

    // youth scout panel: pick a country, reveal a shortlist of three, sign one
    var canSignIn = Math.max(0, FO_SCOUT_COOLDOWN - (round - st.lastSignRound));
    var squadFull = (t.players || []).length >= 18;
    var signBlock = st.youthPending.length ? "Signing pending" :
      (canSignIn > 0 ? "Sign in " + canSignIn + " matchday" + (canSignIn === 1 ? "" : "s") :
      (squadFull ? "Squad full (18)" : null));
    var revealIn = st.scoutReveal ? Math.max(0, FO_SCOUT_REVEAL_GAP - (round - st.scoutReveal.round)) : 0;
    var natSel = "<select id='fo-yc-nat'>" + foScoutNats().map(function (n) {
      var cur = (st.scoutReveal && st.scoutReveal.nat) || st.scoutNat || foScoutDefaultNat();
      return "<option" + (cur === n ? " selected" : "") + ">" + n + "</option>";
    }).join("") + "</select>";
    var scouts = foScoutList();
    var scoutCards = scouts.map(function (p, i) {
      var yt = FO_YT[p._ytier || "raw"] || FO_YT.raw;
      var act = "<button class='pkm-act fo-ycsign-mini' data-i='" + i + "'" + (signBlock ? " disabled title='" + E(signBlock) + "'" : "") + ">" + (signBlock || "Sign") + "</button>";
      var foot = "<span class='pkm-fee'>Free &middot; " + FO$(foDailyWage(p)) + "/day</span>" + act;
      return "<div class='pkm-cell fo-yc-cell" + (p._ytier === "gen" ? " pkm-gen" : "") + "' data-i='" + i + "'>" +
        foPkMini(p, { tag: yt.lbl, foot: foot }) + "</div>";
    }).join("") || "<div class='small'>The scout came back empty-handed; reveal again next window.</div>";
    var scoutNote = st.youthPending.length
      ? "<b>" + E(st.youthPending[0].name) + "</b> has agreed terms · the signing completes after the next matchday."
      : (canSignIn > 0 ? "Your scout can bring in the next signing in <b>" + canSignIn + "</b> matchday(s)." : "Your scout is ready · you can sign one player now.");
    var scoutBody;
    if (signBlock) {
      // no shortlist to stare at while signing is impossible - just the clock
      var waitTxt = st.youthPending.length
        ? "<b>" + E(st.youthPending[0].name) + "</b> has agreed terms · the signing completes after the next matchday. The scout travels again once he is in."
        : (canSignIn > 0
          ? "The scout rests between signings · the next reveal unlocks in <b>" + canSignIn + "</b> matchday" + (canSignIn === 1 ? "" : "s") + "."
          : "The squad is full (18) · free a spot before the scout travels again.");
      scoutBody = "<div class='fo-yc-note'>&#9203; " + waitTxt + "</div>";
    } else if (!st.scoutReveal) {
      scoutBody = "<div class='fo-yc-note'>Send the scout out and see who he finds. Pick a country, then reveal his shortlist of three.</div>" +
        "<div class='ctlrow' style='margin:8px 0'><span class='small'>Scout in:</span>" + natSel +
        "<button class='fo-yc-sign' id='fo-yc-reveal'>&#128269; Reveal youth scout</button></div>";
    } else if (revealIn === 0) {
      scoutBody = "<div class='fo-yc-note'>" + scoutNote + " The scout is ready to travel again.</div>" +
        "<div class='ctlrow' style='margin:8px 0'><span class='small'>Next trip:</span>" + natSel +
        "<button class='fo-yc-sign' id='fo-yc-reveal'>&#128269; Reveal a new shortlist</button></div>" +
        "<div class='pkm-grid'>" + scoutCards + "</div>";
    } else {
      scoutBody = "<div class='fo-yc-note'>" + scoutNote + " Scouted in <b>" + E((st.scoutReveal.nat || foScoutDefaultNat())) + "</b>; a new shortlist can be revealed in <b>" + revealIn + "</b> matchday(s).</div>" +
        "<div class='pkm-grid'>" + scoutCards + "</div>";
    }

    page.innerHTML =
      "<div class='crumb'>" + E(t.name) + " &raquo; Training</div>" +
      "<div class='page-head'><div><div class='eyebrow'>Development centre</div><h1>Training &amp; Youth</h1><p>Programs update after every matchday.</p></div>" +
      "<div><button class='fo-tr-how' id='fo-tr-how'>How training works</button></div></div>" +
      repHtml +
      "<div class='panel'><h4>Training programs</h4><div class='pad'>" +

      "<table class='fo-tr-tbl'><thead><tr><th>Player</th><th>Energy</th><th>Program</th><th>Next gain</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<div class='fo-trc-list'>" + cards + "</div>" +
      "<div class='small' style='margin-top:8px'>Skill gains raise wages automatically. The Rest program recovers energy instead of training. Squads over 24 players train slower.</div>" +
      "</div></div>" +
      "<div class='panel'><h4>Youth scout &middot; ages 18&#8211;20</h4><div class='pad'>" +
      scoutBody +
      "<div class='small' style='margin-top:8px'>Signings are <b>free</b> - quality is the lottery. Most finds are raw, <b>&#9733; Gifted</b> is rare, and once in a generation the scout unearths a jewel. One reveal per " + FO_SCOUT_REVEAL_GAP + " matchdays; one signing per " + FO_SCOUT_COOLDOWN + " matchdays; squad cap 18.</div>" +
      "</div></div>";

    var trRedraw = function () { var y = window.scrollY; foTrainingPage(); window.scrollTo(0, y); };
    page.querySelectorAll(".fo-tr-prog").forEach(function (s) { s.addEventListener("change", function () { foSetTraining(s.getAttribute("data-p"), "program", s.value); trRedraw(); }); });

    var howB = page.querySelector("#fo-tr-how");
    if (howB) howB.addEventListener("click", function () {
      var ex = document.getElementById("fo-tr-howm"); if (ex) { ex.remove(); return; }
      var m = document.createElement("div"); m.id = "fo-tr-howm"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card' style='max-width:720px;max-height:84vh;overflow:auto'><div class='fo-modal-eyebrow'>Development centre</div><h3>How training works</h3>" +
        "<div class='small' style='line-height:1.65;margin:6px 0 14px'>Every matchday, each player banks progress toward the skills in his program. When a skill's progress bar fills, the skill goes up one point and his wage rises with it. " +
        "<b>Speed</b> depends on age (young players learn fastest, veterans barely move), energy (tired players train poorly) and your academy level. The <b>Rest</b> program recovers energy instead of training.</div>" +
        "<h3 style='font-size:15px'>What each program trains</h3>" +
        "<div class='small' style='margin:2px 0 8px;color:#667085'>Every session splits its progress across these skills, in these proportions.</div>" +
        foProgExplainHTML() +
        "<div class='fo-modal-act' style='margin-top:12px'><button class='fo-su-cancel' id='fo-tr-howx'>Close</button></div></div>";
      document.body.appendChild(m);
      m.addEventListener("click", function (e2) { if (e2.target === m) m.remove(); });
      m.querySelector("#fo-tr-howx").addEventListener("click", function () { m.remove(); });
    });

    page.querySelectorAll(".fo-ycsign-mini[data-i]").forEach(function (b) { b.addEventListener("click", function () { foSignYouth(scouts[+b.getAttribute("data-i")]); }); });
    var natS = page.querySelector("#fo-yc-nat");
    if (natS) natS.addEventListener("change", function () { var st2 = foTrainState(); st2.scoutNat = natS.value; foTrainSave(st2); });
    var revealB = page.querySelector("#fo-yc-reveal");
    if (revealB) revealB.addEventListener("click", function () {
      var st2 = foTrainState();
      var nat2 = (page.querySelector("#fo-yc-nat") || {}).value || st2.scoutNat || foScoutDefaultNat();
      st2.scoutReveal = { round: round, nat: nat2 };
      st2.scoutNat = nat2;
      foTrainSave(st2);
      toast("The scout is back from " + nat2 + " with three names.");
      foTrainingPage();
    });
    page.querySelectorAll(".fo-yc-cell[data-i]").forEach(function (c) { c.addEventListener("click", function (ev) { if (ev.target.closest("button")) return; foYouthDetail(scouts[+c.getAttribute("data-i")]); }); });
  }
  // The engine's own hashchange handler calls its INTERNAL route (bypassing the
  // window.route wrapper) and falls back to the club page for hashes it doesn't
  // know · so re-assert the training page one tick after every hash change.
  window.addEventListener("hashchange", function () { setTimeout(foRenderTraining, 15); });
  // (a) Squad polish: value-coloured skill bars + sortable Capt column.
  try { if (typeof GRIDKEYS !== "undefined") GRIDKEYS.Capt = function (p) { return (p && p.capt) || 0; }; } catch (e) {}
  // (14) Set lineup buttons directly on my rows in the Fixtures & results table.
  // the engine's Fixtures & results rows end in sc / rpt / replay cells;
  // fold them into ONE link: the result text opens the scorecard
  function foFxResultLinks() {
    try {
      if (App.page !== "matches") return;
      var page = document.getElementById("page"); if (!page) return;
      // stray "sc" links (the cup panel and friends): the result text before
      // them becomes the link, everywhere
      page.querySelectorAll("a[href*='scorecard']").forEach(function (a0) {
        if ((a0.textContent || "").trim() !== "sc" || a0.__foSc) return;
        a0.__foSc = 1;
        var pv = a0.previousSibling;
        if (pv && pv.nodeType === 3 && pv.textContent.trim()) { a0.textContent = pv.textContent.trim(); pv.textContent = " "; }
        else a0.textContent = "open \u203a";
      });
      var frTbl = null;
      page.querySelectorAll(".panel").forEach(function (pn0) { var h0 = pn0.querySelector("h4"); if (h0 && /Fixtures & results/i.test(h0.textContent || "")) frTbl = pn0.querySelector("table"); });
      if (!frTbl || frTbl.__foClean) return;
      frTbl.__foClean = 1;
      var hr = frTbl.rows[0];
      while (hr && hr.cells.length > 6) hr.deleteCell(-1);
      if (hr && hr.cells[1] && /class/i.test(hr.cells[1].textContent)) hr.cells[1].textContent = "Type";
      var bandDate = null;
      var openMap = (window.__foFxOpen = window.__foFxOpen || {});
      var curBand = null, groups = [];
      var timeShort = String(MATCH_TIME || "9:00 AM ET").replace(/\s*ET\s*$/, "");
      Array.prototype.slice.call(frTbl.rows, 1).forEach(function (tr) {
        var c0 = tr.cells[0];
        if (tr.cells.length === 1 && c0 && c0.colSpan) {
          if (c0.colSpan > 6) c0.colSpan = 6;
          // date the band from the round number itself (the printed text may
          // still carry the engine's weekly fiction at this point, and the
          // row dates must never depend on which decorator ran first)
          var mN = (c0.textContent || "").match(/Round\s+(\d+)/);
          if (mN) {
            bandDate = foDailyDate(+mN[1] - 1, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
            c0.innerHTML = c0.innerHTML.replace(/\u00b7\s*[^(<]*\d{4}\s*/, "\u00b7 " + bandDate + " ");
          } else {
            var mB = (c0.textContent || "").match(/\u00b7\s*([^(]+?)\s*\(/);
            if (mB) bandDate = mB[1].trim();
          }
          tr.classList.add("fo-rnd-head");
          curBand = { tr: tr, label: (c0.textContent || "").trim(), rows: [] };
          groups.push(curBand);
          return;
        }
        if (tr.cells.length < 9) return;
        if (curBand) curBand.rows.push(tr);
        // "Jul 8, 9:00 AM" instead of a bare round number
        if (bandDate) {
          var mD = bandDate.match(/(\d{1,2})\s+([A-Za-z]{3})/);
          tr.cells[0].innerHTML = (mD ? mD[2] + " " + mD[1] : bandDate) + ", " + timeShort;
        }
        if (tr.cells[1] && /^\s*Lg\s*$/.test(tr.cells[1].textContent)) tr.cells[1].textContent = "League";
        var resTd = tr.cells[5];
        var scA = tr.cells[6] && tr.cells[6].querySelector("a[href*='scorecard']");
        if (scA) {
          var a2 = document.createElement("a");
          a2.href = scA.getAttribute("href");
          a2.textContent = resTd.textContent.trim();
          resTd.textContent = ""; resTd.appendChild(a2);
        }
        tr.deleteCell(8); tr.deleteCell(7); tr.deleteCell(6);
        // my own unplayed games carry a lineup button right in the row
        try {
          if (SYNC && SYNC.started && !SYNC.practice && curBand && /not played/i.test(resTd.textContent)) {
            var mR = curBand.label.match(/Round\s+(\d+)/);
            var rIx = mR ? +mR[1] - 1 : -1;
            var curR2 = (App.season && typeof App.season.round === "number") ? App.season.round : 0;
            var meN2 = ""; try { meN2 = userTeam().name; } catch (eU) {}
            var mine = meN2 && (tr.cells[2].textContent.trim() === meN2 || tr.cells[3].textContent.trim() === meN2);
            if (mine && rIx >= curR2) {
              var bL = document.createElement("button");
              bL.className = "fo-setr" + (rIx > curR2 ? " fo-setr-later" : "");
              bL.setAttribute("data-r", rIx);
              bL.textContent = rIx > curR2 ? "Plan lineup" : "Set lineup";
              bL.style.marginLeft = "8px";
              bL.addEventListener("click", function (ev) { ev.stopPropagation(); foSetOrdersForRound(+bL.getAttribute("data-r")); });
              resTd.appendChild(bL);
            }
          }
        } catch (eSl) {}
      });
      // collapsible rounds: the current round and the latest played round
      // start open; every band header toggles its rows
      var lastPlayed = null;
      groups.forEach(function (g) { if (/\(played\)/i.test(g.label)) lastPlayed = g; });
      groups.forEach(function (g) {
        var key = g.label.replace(/\s*\((played|current|upcoming)\)\s*$/i, "");
        var dflt = /\(current\)/i.test(g.label) || g === lastPlayed;
        var open = openMap[key] != null ? openMap[key] : dflt;
        var apply = function () {
          g.rows.forEach(function (row) { row.style.display = open ? "" : "none"; });
          var c1 = g.tr.cells[0];
          var chev = c1.querySelector(".fo-fx-chev");
          if (!chev) { chev = document.createElement("span"); chev.className = "fo-fx-chev"; c1.insertBefore(chev, c1.firstChild); }
          chev.innerHTML = open ? "&#9662; " : "&#9656; ";
        };
        apply();
        g.tr.style.cursor = "pointer";
        g.tr.addEventListener("click", function () { open = !open; openMap[key] = open; apply(); });
      });
    } catch (e) {}
  }
  setInterval(function () { try { foFxResultLinks(); } catch (e) {} }, 1500);
  function foDecorateMatchRows() {
    try {
      if (App.page !== "matches") return;
      var page = document.getElementById("page"); if (!page) return;
      // the engine repaints this page once after routing, so the cleaner
      // sweeps a few times; the __foClean marker keeps it idempotent
      foFxResultLinks();
      [350, 900, 2000].forEach(function (ms) { setTimeout(foFxResultLinks, ms); });
      foRefreshLineupButtons();
    } catch (e) {}
  }
  // Every Set-lineup button carries data-r; this keeps them all honest - green
  // "Orders ready" the moment a round's packet exists, wherever the button lives.
  function foStatsOwnRows() {
    try {
      if ((location.hash || "").indexOf("#/stats") !== 0) return;
      var page = document.getElementById("page"); if (!page) return;
      var mine = {}; try { (userTeam().players || []).forEach(function (p2) { mine[p2.name] = 1; }); } catch (e0) { return; }
      page.querySelectorAll("table tr").forEach(function (tr) {
        if (tr.__foOwn || !tr.cells || tr.cells.length < 2 || tr.querySelector("th")) return;
        tr.__foOwn = 1;
        var a = tr.querySelector("a[href*='player']");
        var txt = (a ? a.textContent : tr.cells[0].textContent + " " + tr.cells[1].textContent) || "";
        for (var nm in mine) { if (txt.indexOf(nm) >= 0) { tr.classList.add("fo-userrow"); break; } }
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { [120, 500, 1200].forEach(function (ms) { setTimeout(foStatsOwnRows, ms); }); });
  setInterval(function () { try { foStatsOwnRows(); } catch (e) {} }, 2500);

  // ===========================================================================
  //  THE ILLUSTRATED MATCH - the live match as cinema. The ground painting is
  //  the set, the weather plays itself, the striker and bowler stand in the
  //  frame as illustrated figures, and every delivery lands as a MOMENT with
  //  the engine's own commentary line under it. Mounted INSIDE the #fo-oval
  //  theatre column (above the field), re-rendered via foMatchRenderHooks on
  //  every real ball - presentation only, the engine stays the sole truth.
  // ===========================================================================
  // cities with a dedicated LIVE-match canvas: a real delivery in progress,
  // painted to sit beneath the running match UI (the static -ground.webp
  // stays on the city page's "Visit the ground" view)
  var FO_CITY_LIVE = { Dublin: 1, Belfast: 1, Cork: 1, Amsterdam: 1, Rotterdam: 1, Utrecht: 1 };
  function foMstArt() {
    try {
      var cx = M.meta && M.meta.__circuit;
      if (cx != null && FO_CX_REGIONS[cx.r]) {
        var r = FO_CX_REGIONS[cx.r], c = r.clubs[cx.c];
        var L = FO_CITY[c.city];
        var ga = (L && L.groundArt) || (typeof FO_CITY_GROUNDS !== "undefined" && FO_CITY_GROUNDS[c.city] ? "cities/" + foCitySlug(c.city) + "-ground.webp" : null);
        if (ga) {
          var gnm = (L && L.groundNm) || (typeof FO_CITY_GROUNDS !== "undefined" && FO_CITY_GROUNDS[c.city]) || c.city;
          if (FO_CITY_LIVE[c.city]) ga = "cities/" + foCitySlug(c.city) + "-live.webp";
          // twelve grounds ship a night painting too - pick day or night per
          // match (stable for that match) so the theatre gets both
          else if (typeof FO_CITY_NIGHT !== "undefined" && FO_CITY_NIGHT[c.city]) {
            var sdN = 0;
            try { sdN = (M.meta.seed >>> 0) || 0; } catch (eN0) {}
            if (!sdN) { try { sdN = foHash32((M.meta.home || "") + "|" + (M.meta.away || "")); } catch (eN1) { sdN = 0; } }
            if (sdN % 2 === 1) ga = "cities/" + foCitySlug(c.city) + "-ground-night.webp";
          }
          // Dublin owns a second canvas for the rain
          if (c.city === "Dublin" && /rain|drizzle|storm|shower|wet/.test(((M.meta.weather || "") + "").toLowerCase())) ga = "cities/dublin-ground-rain.webp";
          return { img: FO_ART + ga, mode: "ground", ac: r.ac, gnm: gnm, city: c.city };
        }
        return { img: FO_ART + "circuit/" + (r.bg || (r.id + ".webp")), mode: "region", ac: r.ac, gnm: c.city + (c.boss ? " Colosseum" : " Oval"), city: c.city };
      }
    } catch (e) {}
    return { img: FO_ART + "cities/london-ground.webp", mode: "generic", ac: "#2E7A3C", gnm: (M.meta && M.meta.ground) || "The ground", city: "" };
  }
  var FO_MST_TITLES = { "6": "SIX!", "4": "FOUR!", dot: "Dot ball", "1": "Single", "2": "Two runs", "3": "Three!", wide: "Wide", noball: "NO BALL!", bye: "Byes", legbye: "Leg byes" };
  // (the Gaffer's ball-by-ball punditry retired from the broadcast - the
  // venue speaks for itself)
  // --- the manager's hand: manual balls by default, opt-in slow auto-play,
  // --- and timed prompts at the moments that matter ------------------------
  function foMstAuto() { return !!window.__foMstAuto; }
  function foMstKillAp() { try { if (window.__ap) { clearInterval(window.__ap); window.__ap = null; } } catch (e) {} }
  // the engine restarts its autoplay interval after every render - while the
  // manager is in manual mode (or a prompt holds play), keep putting it down
  setInterval(function () {
    try {
      if ((location.hash || "").split("?")[0] !== "#/match") return;
      if (typeof M === "undefined" || !M || M.done) return;
      if (document.getElementById("fo-mst-ask")) window.__foMstHold = true;
      else if (window.__foMstHold && !window.__foMstAskT) window.__foMstHold = false;
      if (!foMstAuto() || window.__foMstHold) { foMstKillAp(); try { if (UI.apMs < 900000) UI.apMs = 999999; } catch (eAp) {} }
      // the broadcast never stalls: once a hold lifts, restore the pace
      else { try { if (UI.apMs > 900000) { UI.apMs = foThMs(); foMstKillAp(); if (typeof foEnsureAutoplay === "function") foEnsureAutoplay(); } } catch (eAp2) {} }
    } catch (e) {}
  }, 250);
  // the last line of defence: while a prompt holds play, no delivery may be
  // bowled - whoever asks
  try {
    if (typeof window.doBall === "function" && !window.doBall.__foHold) {
      var _foDb = window.doBall;
      window.doBall = function () {
        var onM = (location.hash || "").split("?")[0] === "#/match";
        if (onM && window.__foMstHold) return;
        if (onM && !foMstAuto() && !window.__foMstStep) return;
        return _foDb.apply(this, arguments);
      };
      window.doBall.__foHold = 1;
    }
  } catch (eDb) {}
  function foMstResume() {
    window.__foMstHold = false;
    try { if (foMstAuto() && typeof foEnsureAutoplay === "function") { UI.apMs = foThMs(); foEnsureAutoplay(); } } catch (e) {}
  }
  function foMstAsk(opts) {
    try {
      var st = document.getElementById("fo-mstage"); if (!st) return;
      var oldA = document.getElementById("fo-mst-ask"); if (oldA) oldA.remove();
      window.__foMstHold = true; foMstKillAp();
      var d = document.createElement("div"); d.id = "fo-mst-ask"; d.className = "fo-mst-ask";
      var anyCard = opts.options.some(function (o) { return !!o.p; });
      d.innerHTML = "<div class='ask-bx" + (anyCard ? " wide" : "") + "'><div class='ask-t'>" + opts.title + "</div>" +
        (opts.sub ? "<div class='ask-s'>" + opts.sub + "</div>" : "") +
        "<div class='ask-opts" + (anyCard ? " cards" : "") + "'>" + opts.options.map(function (o, i) {
          // the choice IS the player: his full holo card, scaled to the hand
          var cardH = "";
          if (o.p) {
            try {
              var cb = foHoloCardHTML(o.p);
              cardH = "<span class='cardbox'><span class='cardscale'><span class='fo-phw ph-" + cb.tier + "' style='--tc:" + cb.ac[0] + ";--tcD:" + cb.ac[1] + "'>" + cb.html + "</span></span></span>";
            } catch (eCb) {}
          }
          if (cardH) {
            var ov9 = ""; try { ov9 = foPkOvr(o.p); } catch (eOv) {}
            var rl9 = (o.p.btLabel && !/does not bowl/i.test(o.p.btLabel)) ? o.p.btLabel : (o.p.keeper ? "Keeper-bat" : "Batsman");
            return "<div role='button' tabindex='0' class='askopt" + (o.def ? " def" : "") + "' data-ask='" + i + "'>" + cardH +
              "<span class='who'><b>" + E(o.p.name) + "</b><i>" + (ov9 ? ov9 + " OVR &middot; " : "") + E(rl9) + "</i></span>" +
              "<span class='tag'>" + (o.meta || "") + "</span></div>";
          }
          return "<button type='button' data-ask='" + i + "'" + (o.def ? " class='def'" : "") + ">" + o.label + (o.meta ? "<i>" + o.meta + "</i>" : "") + "</button>";
        }).join("") + "</div>" +
        "<div class='ask-bar'><i style='animation-duration:" + opts.secs + "s'></i></div></div>";
      st.appendChild(d);
      try { d.querySelectorAll(".fo-phw").forEach(function (w9) { foHoloTilt(w9); }); } catch (eTl) {}
      var done = false;
      window.__foMstAskEnd = null;
      var finish = function (cb, why) {
        if (done) return; done = true;
        window.__foMstAskEnd = why || "?";
        try { d.remove(); } catch (e) {}
        if (window.__foMstAskT) { clearTimeout(window.__foMstAskT); window.__foMstAskT = null; }
        if (cb) { try { cb(); } catch (e) {} }
        foMstResume();
        try { renderMatch(); } catch (e) {}
      };
      d.querySelectorAll("[data-ask]").forEach(function (b) {
        b.addEventListener("click", function () { finish(opts.options[+b.getAttribute("data-ask")].cb, "click"); });
      });
      window.__foMstAskT = setTimeout(function () { finish(null, "timeout"); }, opts.secs * 1000);
    } catch (e) { window.__foMstHold = false; try { console.warn("foMstAsk", e); } catch (e2) {} }
  }
  // ===========================================================================
  //  BROADCAST THEATRE - the venue is the interface. The stage fills the whole
  //  viewport; score, players and commentary become restrained overlays; the
  //  old tabs live on inside a slide-in drawer opened from a vertical icon
  //  rail; the animated oval docks as a retractable "live ball" pane. Purely
  //  presentational: the engine's outcomes are never touched here.
  // ===========================================================================
  // venue-specific focal points: where the painting's heart is, so cover-crop
  // keeps the landmark (mountain, pavilion, gasometer) in frame
  var FO_TH_FOCAL = {
    "Cape Town": "52% 56%", Dublin: "center 42%", London: "center 46%", Leeds: "center 48%",
    Mumbai: "center 50%", Kingston: "center 52%", Wellington: "center 50%", Perth: "center 52%"
  };
  // portrait phones crop the same painting differently: keep the pitch low in
  // frame and the landmark/skyline clear of the top chrome
  var FO_TH_FOCAL_M = {
    "Cape Town": "56% 58%", Johannesburg: "50% 58%", Dublin: "46% 48%", London: "center 52%",
    Leeds: "center 54%", Mumbai: "center 56%", Kingston: "center 58%", Wellington: "center 56%",
    Perth: "center 58%"
  };
  // one broadcast pace, three tempos: the viewer picks 1x / 2x / 4x
  function foThMs() { return Math.round(3200 / (window.__foThMult || 1)); }
  function foThSetSpeed(m) {
    try {
      window.__foThMult = m;
      if (typeof UI !== "undefined") UI.apMs = foThMs();
      if (window.__ap) { clearInterval(window.__ap); window.__ap = null; }
      if (typeof foEnsureAutoplay === "function" && typeof M !== "undefined" && M && !M.done) foEnsureAutoplay();
      if (typeof renderMatch === "function") renderMatch();
    } catch (e) {}
  }
  // moment cut-in: full character art earns the screen for ~2.5s, then leaves
  function foThCut(img, big, name) {
    try {
      if (!img) return;
      var old = document.getElementById("fo-th-cut"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-th-cut";
      d.innerHTML = "<img src='" + img + "' alt=''><span class='ct'><b>" + E(big) + "</b><i>" + E(name || "") + "</i></span>";
      document.body.appendChild(d);
      setTimeout(function () { try { d.classList.add("out"); } catch (e) {} }, 2100);
      setTimeout(function () { try { d.remove(); } catch (e) {} }, 2650);
    } catch (e) {}
  }
  // the big moment cut-in, holo-card edition: the player's ACTUAL card at
  // near full size, fonts legible, held for ~3s
  function foThCutCard(p, big, sub) {
    try {
      if (!p) return;
      var cb = foHoloCardHTML(p);
      var old = document.getElementById("fo-th-cut"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "fo-th-cut"; d.className = "pcut";
      d.innerHTML =
        "<span class='cardbox'><span class='cardscale'><span class='fo-phw ph-" + cb.tier + "' style='--tc:" + cb.ac[0] + ";--tcD:" + cb.ac[1] + "'>" + cb.html + "</span></span></span>" +
        "<span class='ct'><b>" + E(big) + "</b><i>" + E(sub || "") + "</i></span>";
      document.body.appendChild(d);
      setTimeout(function () { try { d.classList.add("out"); } catch (e) {} }, 2700);
      setTimeout(function () { try { d.remove(); } catch (e) {} }, 3250);
    } catch (e) {}
  }
  var FO_TH_ICONS = {
    field: "<svg viewBox='0 0 24 24'><ellipse cx='12' cy='12' rx='9' ry='6.6' fill='none' stroke='currentColor' stroke-width='1.7'/><rect x='10.7' y='8.4' width='2.6' height='7.2' rx='1.1' fill='currentColor'/></svg>",
    Commentary: "<svg viewBox='0 0 24 24'><path d='M4 5.5h16v10.5H10l-5.5 4v-4H4z' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linejoin='round'/></svg>",
    Scorecard: "<svg viewBox='0 0 24 24'><path d='M5 6h14M5 11h14M5 16h9' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round'/></svg>",
    Worm: "<svg viewBox='0 0 24 24'><path d='M3.5 17.5l5.5-6 4.5 3 7-8.5' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/></svg>",
    Orders: "<svg viewBox='0 0 24 24'><path d='M4 8h16M4 16h16' stroke='currentColor' stroke-width='1.7' stroke-linecap='round'/><circle cx='9' cy='8' r='2.4' fill='currentColor'/><circle cx='15' cy='16' r='2.4' fill='currentColor'/></svg>",
    gaffer: "<svg viewBox='0 0 24 24'><circle cx='12' cy='8.4' r='3.4' fill='none' stroke='currentColor' stroke-width='1.7'/><path d='M5 19.5c1.4-3.6 4-5.2 7-5.2s5.6 1.6 7 5.2' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round'/></svg>"
  };
  var FO_TH_RAIL = [
    ["field", "Ball animation"], ["Commentary", "Commentary"], ["Scorecard", "Scorecard"],
    ["Worm", "Worm & partnerships"], ["Orders", "Tactics & orders"]
  ];
  function foThDrawer(open) {
    document.body.classList.toggle("fo-thd", !!open);
  }
  // one controlled state for the phone command sheet: live | oval | score |
  // tactics. Pure presentation - it only chooses what is visible and which
  // engine tab renders; the broadcast itself never pauses for it.
  function foMobIsOn() {
    try { return window.matchMedia("(max-width:767.98px) and (orientation:portrait)").matches; } catch (e) { return false; }
  }
  function foMobSheet(st) {
    try {
      document.body.setAttribute("data-mobsheet", st);
      if (st !== "oval") document.body.classList.remove("fo-mob-xl");
      if (foMobIsOn()) {
        if (st === "score" || st === "tactics") {
          try {
            if (typeof UI !== "undefined") {
              if (st === "tactics") { if (UI.matchTab !== "Orders" && UI.matchTab !== "Lineups") UI.matchTab = "Orders"; }
              else if (["Scorecard", "Commentary", "Worm", "Partnerships", "Match Ratings", "Charts", "Details", "Rivalry"].indexOf(UI.matchTab) < 0) UI.matchTab = "Scorecard";
              document.body.setAttribute("data-thtab", UI.matchTab);
            }
          } catch (e1) {}
          foThDrawer(true);
          try { if (typeof renderMatch === "function") renderMatch(); } catch (e2) {}
        } else foThDrawer(false);
      }
      foMobTalkHome();
      document.querySelectorAll("#fo-mob-nav [data-mob]").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-mob") === st);
      });
    } catch (e) {}
  }
  try { window.foMobSheet = foMobSheet; } catch (eMx) {}
  // the field-talk row lives in the oval pane; on phones the TACTICS sheet
  // borrows it, and it goes home the moment the sheet (or the phone) is gone
  function foMobTalkHome() {
    try {
      var talk = document.getElementById("fo-mst-talk"), tac = document.getElementById("fo-mob-tac"), ov = document.getElementById("fo-oval");
      var wantTac = foMobIsOn() && document.body.getAttribute("data-mobsheet") === "tactics";
      if (wantTac && talk && tac && talk.parentNode !== tac) tac.appendChild(talk);
      else if (!wantTac && talk && ov && talk.parentNode !== ov) {
        var sv = ov.querySelector(".ov-svg");
        if (sv && sv.parentNode === ov) ov.insertBefore(talk, sv.nextSibling); else ov.appendChild(talk);
      }
    } catch (e) {}
  }
  function foThChrome(on) {
    var rail = document.getElementById("fo-th-rail");
    if (!on) {
      ["fo-th", "fo-thd", "fo-th-ov0", "fo-th-gfon", "fo-th-pin"].forEach(function (c) { document.body.classList.remove(c); });
      document.body.removeAttribute("data-thtab");
      ["fo-th-rail", "fo-thd-x", "fo-th-gf", "fo-th-cut", "fo-th-gauge", "fo-mob-sheet", "fo-mob-nav", "fo-mstage"].forEach(function (id) { var e9 = document.getElementById(id); if (e9) e9.remove(); });
      document.body.removeAttribute("data-mobsheet");
      document.body.classList.remove("fo-mob-xl");
      return;
    }
    foThCss();
    document.body.classList.add("fo-th");
    document.body.setAttribute("data-thtab", (typeof UI !== "undefined" && UI.matchTab) || "Scorecard");
    if (!rail) {
      rail = document.createElement("div"); rail.id = "fo-th-rail";
      rail.innerHTML = FO_TH_RAIL.map(function (r9) {
        return "<button type='button' data-th='" + r9[0] + "' title='" + r9[1] + "'>" + (FO_TH_ICONS[r9[0]] || "") + "</button>";
      }).join("");
      document.body.appendChild(rail);
      // phones open the field pane on demand (bottom sheet), desktop docks it
      if (window.innerWidth <= 760 || window.innerHeight <= 520) document.body.classList.add("fo-th-ov0");
      rail.addEventListener("click", function (ev9) {
        var b9 = ev9.target.closest("[data-th]"); if (!b9) return;
        var k9 = b9.getAttribute("data-th");
        if (k9 === "field") { document.body.classList.toggle("fo-th-ov0"); return; }
        if (k9 === "gaffer") {
          b9.classList.remove("ping");
          if (!window.__foThGfL) return;
          clearTimeout(window.__foThGfT);
          document.body.classList.toggle("fo-th-gfon");
          return;
        }
        try {
          if (document.body.classList.contains("fo-thd") && UI.matchTab === k9) { foThDrawer(false); return; }
          UI.matchTab = k9;
          document.body.setAttribute("data-thtab", k9);
          foThDrawer(true);
          if (typeof renderMatch === "function") renderMatch();
        } catch (e9) {}
      });
    }
    // rail active states follow the live UI
    try {
      var dOn = document.body.classList.contains("fo-thd");
      rail.querySelectorAll("[data-th]").forEach(function (b8) {
        var k8 = b8.getAttribute("data-th");
        if (k8 === "field") b8.classList.toggle("on", !document.body.classList.contains("fo-th-ov0"));
        else if (k8 === "gaffer") b8.classList.toggle("on", document.body.classList.contains("fo-th-gfon"));
        else b8.classList.toggle("on", dOn && UI.matchTab === k8);
      });
    } catch (eRs) {}
    // ---- phone portrait chrome: bottom command sheet + tab bar ----
    if (!document.getElementById("fo-mob-nav")) {
      var sh9 = document.createElement("div"); sh9.id = "fo-mob-sheet";
      sh9.innerHTML = "<div class='sh-grip'></div><div id='fo-mob-tac'></div>";
      document.body.appendChild(sh9);
      var nv9 = document.createElement("div"); nv9.id = "fo-mob-nav";
      nv9.innerHTML = [
        ["live", "Live", "<svg viewBox='0 0 24 24'><circle cx='12' cy='12' r='2.4' fill='currentColor'/><path d='M7.6 7.6a6.2 6.2 0 0 0 0 8.8M16.4 7.6a6.2 6.2 0 0 1 0 8.8' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round'/></svg>"],
        ["oval", "Oval", FO_TH_ICONS.field],
        ["score", "Score", FO_TH_ICONS.Scorecard],
        ["tactics", "Tactics", FO_TH_ICONS.Orders]
      ].map(function (t9) { return "<button type='button' data-mob='" + t9[0] + "' aria-label='" + t9[1] + "'>" + t9[2] + "<span>" + t9[1] + "</span></button>"; }).join("");
      document.body.appendChild(nv9);
      nv9.addEventListener("click", function (e9) {
        var b9 = e9.target.closest("[data-mob]"); if (!b9) return;
        var k9 = b9.getAttribute("data-mob");
        var cur9 = document.body.getAttribute("data-mobsheet") || "live";
        foMobSheet(k9 === cur9 && k9 !== "live" ? "live" : k9);
      });
      document.addEventListener("click", function (e7) {
        var a7 = e7.target && e7.target.closest ? e7.target.closest(".ftp-match-links a") : null;
        if (!a7) return;
        setTimeout(function () { try { document.body.setAttribute("data-thtab", (typeof UI !== "undefined" && UI.matchTab) || "Scorecard"); } catch (e6) {} }, 0);
      });
      // the grip: drag DOWN to step back toward the live ground, drag UP
      // (in the oval sheet) to take the ball animation full screen. The grip
      // CAPTURES the pointer - mobile browsers love cancelling drags that
      // cross moving panels, and capture keeps the stream alive.
      var drY9 = null;
      sh9.addEventListener("pointerdown", function (e8) {
        if (e8.clientY < sh9.getBoundingClientRect().top + 36) {
          drY9 = e8.clientY;
          try { if (e8.target && e8.target.setPointerCapture) e8.target.setPointerCapture(e8.pointerId); } catch (eC) {}
          e8.preventDefault();
        }
      });
      var drMove9 = function (e8) {
        if (drY9 == null) return;
        var dy9 = e8.clientY - drY9;
        if (dy9 > 44) {
          drY9 = null;
          if (document.body.classList.contains("fo-mob-xl")) document.body.classList.remove("fo-mob-xl");
          else foMobSheet("live");
        } else if (dy9 < -44) {
          drY9 = null;
          if (document.body.getAttribute("data-mobsheet") === "oval") document.body.classList.add("fo-mob-xl");
        }
      };
      sh9.addEventListener("pointermove", drMove9);
      document.addEventListener("pointermove", drMove9);
      var drEnd9 = function () { drY9 = null; };
      sh9.addEventListener("pointerup", drEnd9);
      sh9.addEventListener("pointercancel", drEnd9);
      document.addEventListener("pointerup", drEnd9);
    }
    if (!document.body.getAttribute("data-mobsheet")) foMobSheet("live");
    foMobTalkHome();
    // drawer close
    if (!document.getElementById("fo-thd-x")) {
      var x9 = document.createElement("button");
      x9.id = "fo-thd-x"; x9.type = "button"; x9.innerHTML = "&#10005;"; x9.title = "Close";
      document.body.appendChild(x9);
      x9.addEventListener("click", function () { foThDrawer(false); try { foThChrome(true); } catch (e8) {} });
    }
    // the oval docks as the LIVE BALL pane: give it a header + collapse/pin
    try {
      var ov9 = document.getElementById("fo-oval");
      if (ov9 && !document.getElementById("fo-ovhd")) {
        var hd9 = document.createElement("div"); hd9.id = "fo-ovhd";
        hd9.innerHTML = "<b>Live ball</b><span id='fo-ovhd-sub'></span>" +
          "<button type='button' id='fo-ovpin' title='Keep open behind panels'>&#9737;</button>" +
          "<button type='button' id='fo-ovx' title='Collapse'>&#8722;</button>";
        ov9.insertBefore(hd9, ov9.firstChild);
        hd9.querySelector("#fo-ovx").addEventListener("click", function () { document.body.classList.add("fo-th-ov0"); try { foThChrome(true); } catch (e7) {} });
        hd9.querySelector("#fo-ovpin").addEventListener("click", function () { document.body.classList.toggle("fo-th-pin"); this.classList.toggle("on", document.body.classList.contains("fo-th-pin")); });
      }
    } catch (eOv) {}
  }
  function foThCss() {
    if (document.getElementById("fo-th-css")) return;
    var s = document.createElement("style"); s.id = "fo-th-css";
    s.textContent =
      // ---- the shell: stage fills the viewport, page chrome dissolves ----
      "html:has(body.fo-th){overflow:hidden;background:#071527}" +
      "html body.fo-th,html body.ftpskin.fo-th{overflow:hidden;height:100vh;background:#071527 !important}" +
      "html body.fo-th .wrap,html body.fo-th #page,html body.ftpskin.fo-th .wrap,html body.ftpskin.fo-th #page{background:transparent !important}" +
      // two stage layers: the painting never repaints between balls
      ".fo-mst-scene{position:absolute;inset:0;z-index:0}" +
      ".fo-mst-ui{position:absolute;inset:0;z-index:5}" +
      ".fo-mst .fo-mst-ui.k-boundary .fo-mst-moment .t{color:#f9c957}" +
      ".fo-mst .fo-mst-ui.k-wicket .fo-mst-moment .t{color:#ff6c61}" +
      ".fo-mst .fo-mst-ui.k-dot .fo-mst-moment .t{color:#c7e4e8}" +
      ".fo-mst .fo-mst-ui.k-done .fo-mst-moment .t{color:#8fe3a4}" +
      "html body.fo-th #topbar,html body.ftpskin.fo-th #topbar{position:fixed;top:0;left:0;right:0;z-index:60;background:linear-gradient(180deg,rgba(4,10,20,.62),rgba(4,10,20,.26) 60%,transparent) !important;border-bottom:none !important;box-shadow:none !important}" +
      "body.fo-th #fo-top-status,body.fo-th #fo-clock{display:none !important}" +
      "html body.fo-th #page{overflow:visible !important;padding-bottom:0 !important}" +
      "html body.fo-th #fo-mstage{position:fixed !important;inset:0 !important;height:100vh !important;min-height:100vh !important;width:100vw;max-width:none !important;border-radius:0 !important;margin:0 !important;z-index:1}" +
      // the stage sits on body now: restate the #page-scoped control styling
      "html body.fo-th #fo-mstage .fo-mst-next{font-family:Oswald,sans-serif !important;font-weight:600 !important;letter-spacing:1.8px;text-transform:uppercase;font-size:12.5px;background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;color:#101B2D !important;border:none !important;border-radius:999px;padding:11px 22px;cursor:pointer;box-shadow:0 4px 0 rgba(16,27,45,.35),0 8px 22px rgba(201,162,75,.3) !important}" +
      "html body.fo-th #fo-mstage .fo-mst-next:hover{filter:brightness(1.06)}" +
      "html body.fo-th #fo-mstage .fo-mst-next:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(16,27,45,.35) !important}" +
      // the accelerator docks right under the LIVE BALL pane, big enough to
      // never miss - and steps aside while an analysis drawer is open
      "@media(min-width:761px){html body.fo-th #fo-mstage .fo-mst-next{position:fixed;right:212px;top:calc(50% + 208px);z-index:56;width:252px;min-height:56px;font-size:15px;letter-spacing:2.4px;padding:17px 20px !important;text-align:center}}" +
      "body.fo-th #fo-mst-spd{display:flex;gap:8px;align-items:center}" +
      "html body.fo-th #fo-mst-spd button{flex:1;min-height:48px;min-width:64px;font-family:Oswald,sans-serif !important;font-weight:600 !important;font-size:15px;letter-spacing:1.5px;background:rgba(5,20,40,.72) !important;border:1.5px solid rgba(255,255,255,.3) !important;color:rgba(255,255,255,.85) !important;border-radius:12px;cursor:pointer;backdrop-filter:blur(8px);padding:10px 0;box-shadow:none !important}" +
      "html body.fo-th #fo-mst-spd button.on{background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;border-color:#F0B94E !important;color:#101B2D !important;box-shadow:0 4px 0 rgba(16,27,45,.35),0 8px 22px rgba(201,162,75,.3) !important}" +
      "@media(min-width:761px){body.fo-th #fo-mst-spd{position:fixed;right:212px;top:calc(50% + 208px);z-index:56;width:252px}}" +
      "body.fo-th.fo-thd #fo-mst-spd{display:none}" +
      "@media(min-width:761px){body.fo-th.fo-th-ov0 #fo-mst-spd{top:50%;transform:translateY(-50%)}}" +
      "body.fo-th.fo-thd #fo-mstage .fo-mst-next{display:none}" +
      "@media(min-width:761px){body.fo-th.fo-th-ov0 #fo-mstage .fo-mst-next{top:50%;transform:translateY(-50%)}}" +
      "@media(min-width:761px){body.fo-th.fo-th-ov0 #fo-mstage .fo-mst-next:active{transform:translateY(calc(-50% + 2px))}}" +
      "html body.fo-th .fo-mst-ask .ask-opts button{display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left;font-size:13.5px;font-weight:700;color:#fff !important;background:rgba(255,255,255,.07) !important;border:1.5px solid rgba(255,255,255,.22) !important;border-radius:11px;padding:11px 14px;cursor:pointer;box-shadow:none !important}" +
      "html body.fo-th .fo-mst-ask .ask-opts button:hover{border-color:#F3D37A !important;background:rgba(240,185,78,.12) !important}" +
      "html body.fo-th .fo-mst-ask .ask-opts button.def{border-color:rgba(240,185,78,.55) !important;background:rgba(240,185,78,.14) !important}" +
      "body.fo-th .fo-mst-bg img{object-position:var(--thfocal,center 50%)}" +
      // the painting is the star: NO mood dimming, whatever the forecast -
      // just thin readability gradients at the very edges
      "body.fo-th .fo-mst-veil,body.fo-th .fo-mst.wx-gloom .fo-mst-veil{background:linear-gradient(180deg,rgba(3,15,31,.5) 0%,rgba(3,15,31,.12) 9%,transparent 18%,transparent 78%,rgba(3,15,31,.16) 88%,rgba(3,15,31,.55) 100%) !important}" +
      "body.fo-th .fo-mst-cold{display:none !important}" +
      "body.fo-th .fo-mst-mist{animation:none !important;opacity:.18 !important}" +
      "body.fo-th .fo-mst.wx-humid .fo-mst-mist{opacity:.18 !important}" +
      "body.fo-th #page>.crumb,body.fo-th #page>.panel,body.fo-th #page .mc-top{display:none !important}" +
      "html body.fo-th #page .mc-main{display:none !important}" +
      "body.fo-th .mc-cards{display:none !important}" +
      // ---- top chrome: venue chip / scorebug / compact controls ----
      "body.fo-th .fo-mst-top{top:54px;left:18px;right:74px;align-items:flex-start}" +
      "body.fo-th .fo-mst-score{top:8px;left:50%;right:auto;transform:translateX(-50%);width:auto;min-width:330px;padding:13px 38px 14px;background:rgba(5,20,40,.74);border:1px solid rgba(255,255,255,.2);border-radius:16px;backdrop-filter:blur(12px);box-shadow:0 10px 30px rgba(0,0,0,.4);z-index:61}" +
      "body.fo-th .fo-mst-score .tm{display:inline-block;font-family:Oswald,sans-serif;font-weight:600;font-size:22px;letter-spacing:1px;color:#fff;margin-right:12px;vertical-align:baseline}" +
      "body.fo-th .fo-mst-score b{display:inline-block;font-size:44px;vertical-align:baseline}" +
      "body.fo-th .fo-mst-score .ovs{display:block;font-family:Oswald,sans-serif;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#F3D37A;margin-top:4px}" +
      "body.fo-th .fo-mst-score i{display:block;color:rgba(255,255,255,.8);font-size:11px;margin-top:3px}" +
      "body.fo-th .fo-mst-score i.tossl{color:rgba(255,255,255,.62);font-size:10px;letter-spacing:1.2px}" +
      "body.fo-th .fo-mst-ctlg{position:relative}" +
      "html body.fo-th #page .fo-mst-ic{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(5,22,43,.72) !important;color:rgba(255,255,255,.9) !important;border:1.5px solid rgba(255,255,255,.3) !important;font-size:13px;font-weight:700;font-family:Oswald,sans-serif;cursor:pointer;backdrop-filter:blur(8px);box-shadow:none !important;padding:0}" +
      "html body.fo-th #page .fo-mst-ic:hover{border-color:#F3D37A !important;color:#F3D37A !important}" +
      "html body.fo-th #page .fo-mst-ic.play.on{color:#8fe3a4 !important;border-color:rgba(143,227,164,.6) !important}" +
      "html body.fo-th #page .fo-mst-ic.next{background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;color:#101B2D !important;border:none !important;font-size:20px}" +
      // ---- player chips: circular portrait + name plate, not a mural ----
      "body.fo-th .fo-mst-p{position:absolute;top:auto;bottom:22px;height:auto;width:auto;max-width:430px;display:flex;flex-direction:row;align-items:center;gap:15px;padding:8px 26px 8px 9px;background:rgba(5,20,40,.74);border:1px solid rgba(255,255,255,.2);border-radius:999px;backdrop-filter:blur(10px);box-shadow:0 10px 30px rgba(0,0,0,.45)}" +
      "body.fo-th .fo-mst-p.pbat{left:20px}" +
      "body.fo-th .fo-mst-p.pbowl{right:20px;flex-direction:row-reverse;padding:8px 9px 8px 26px}" +
      "body.fo-th .fo-mst-p img{position:static;width:104px;height:104px;border-radius:50%;object-fit:cover;object-position:50% 10%;border:2.5px solid rgba(240,185,78,.75);opacity:1;filter:none;mask-image:none;-webkit-mask-image:none;clip-path:none !important;flex:0 0 104px}" +
      "body.fo-th .fo-mst-p.pbowl img{border-color:rgba(34,211,224,.7)}" +
      "body.fo-th .fo-mst-p::after{display:none}" +
      "body.fo-th .fo-mst-p .pc{position:static;padding:0}" +
      "body.fo-th .fo-mst-p .rl{font-size:10.5px}" +
      "body.fo-th .fo-mst-p .nm{font-size:21px}" +
      "body.fo-th .fo-mst-p .st{font-size:15.5px}" +
      "body.fo-th .fo-mst-p .stars{font-size:13px}" +
      // ---- the lower third: transient label, ribbon, over beads ----
      // the lower third holds absolutely still between balls: no entrance
      // slide, fixed row heights - only the label's opacity breathes
      "body.fo-th .fo-mst-moment{top:auto;bottom:84px;left:50%;transform:translateX(-50%);width:min(820px,72vw);display:flex;flex-direction:column;align-items:center;gap:8px;animation:none !important}" +
      // the result label holds absolutely still: no fade-out, no re-entrance -
      // the text simply changes when the next ball lands
      "body.fo-th .fo-mst-moment .t{margin:0;font-size:29px;letter-spacing:6px;line-height:1;height:29px;transition:none;animation:none !important;opacity:1 !important}" +
      "body.fo-th .fo-mst-moment .t:empty{visibility:hidden}" +
      "body.fo-th .fo-mst-moment .rib{min-height:42px}" +
      
      "body.fo-th .fo-mst-moment .t.settle{opacity:0}" +
      "body.fo-th .fo-mst-moment .rib{display:flex;align-items:center;gap:10px;max-width:100%;padding:9px 16px;background:rgba(5,20,40,.72);border:1px solid rgba(255,255,255,.16);border-radius:12px;backdrop-filter:blur(10px)}" +
      "body.fo-th .fo-mst-moment .rib:not(:has(p)):not(:has(.chip)){display:none}" +
      "body.fo-th .fo-mst-moment .rib .chip{border:none;background:none;padding:0;color:#F3D37A;backdrop-filter:none;font-size:12.5px}" +
      "body.fo-th .fo-mst-moment .rib .kph{font-family:Oswald,sans-serif;font-size:12.5px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:#22D3E0;white-space:nowrap}" +
      "body.fo-th .fo-mst-moment .rib p{margin:0;font-family:Oswald,sans-serif;font-size:15.5px;font-weight:500;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.96);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:680px}" +
      "body.fo-th .fo-mst-score .mbs{display:flex;gap:7px;justify-content:center;margin-top:9px;min-height:30px}" +
      "body.fo-th .fo-mst-score .mb{width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-family:Oswald,sans-serif;font-weight:600;font-size:13.5px;color:#fff;background:rgba(255,255,255,.13);border:1.5px solid rgba(255,255,255,.24)}" +
      "body.fo-th .fo-mst-score .mb.b4{background:#f3c254;border-color:#f3c254;color:#2f2109}" +
      "body.fo-th .fo-mst-score .mb.bw{background:#d8504b;border-color:#d8504b;color:#fff}" +
      "body.fo-th .fo-mst-score .mb.bx{background:#9db7d4;border-color:#9db7d4;color:#0f2036}" +
      // ---- the speedo: half-dial above the bowler, re-armed every ball ----
      "body.fo-th #fo-th-gauge{position:fixed;right:80px;top:calc(50% + 208px);width:124px;pointer-events:none;text-align:center;z-index:55;background:rgba(5,20,40,.72);border:1px solid rgba(255,255,255,.18);border-radius:14px;backdrop-filter:blur(10px);box-shadow:0 8px 24px rgba(0,0,0,.4);padding:7px 6px 3px}" +
      "body.fo-th #fo-th-gauge svg{display:block;width:100%;height:auto;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}" +
      "body.fo-th #fo-th-gauge .ndl{transform-origin:50px 50px;transition:transform .6s cubic-bezier(.25,.9,.35,1.08)}" +
      "body.fo-th #fo-th-gauge .arc{transition:stroke-dashoffset .6s cubic-bezier(.25,.9,.35,1)}" +
      "body.fo-th.fo-thd #fo-th-gauge{display:none !important}" +
      "@media(min-width:761px){body.fo-th.fo-th-ov0 #fo-th-gauge{top:50%;transform:translateY(calc(-50% + 52px))}}" +
      "body.fo-th #fo-th-gauge .gv{position:absolute;left:0;right:0;bottom:-3px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.8)}" +
      "body.fo-th #fo-th-gauge .gv b{font-family:Oswald,sans-serif;font-weight:600;font-size:19px;letter-spacing:1px}" +
      "body.fo-th #fo-th-gauge .gv i{font-style:normal;font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:#F3D37A;margin-left:4px}" +
      "@media (prefers-reduced-motion:reduce){body.fo-th #fo-th-gauge .ndl,body.fo-th #fo-th-gauge .arc{transition:none !important}}" +
      "@media(max-width:760px){body.fo-th #fo-th-gauge{display:none !important}}" +
      // ---- analysis rail ----
      "#fo-th-rail{position:fixed;right:14px;top:50%;transform:translateY(-50%);z-index:55;display:flex;flex-direction:column;gap:10px}" +
      "#fo-th-rail button{position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(5,20,40,.72);border:1.5px solid rgba(255,255,255,.28);color:rgba(255,255,255,.85);cursor:pointer;backdrop-filter:blur(10px);transition:border-color .15s ease,color .15s ease;padding:0}" +
      "#fo-th-rail button svg{width:19px;height:19px}" +
      "#fo-th-rail button:hover{border-color:#F3D37A;color:#F3D37A}" +
      "#fo-th-rail button.on{border-color:#F0B94E;color:#F0B94E;box-shadow:0 0 0 3px rgba(240,185,78,.25)}" +
      "#fo-th-rail button.ping::after{content:'';position:absolute;top:3px;right:3px;width:9px;height:9px;border-radius:50%;background:#C8674A;border:1.5px solid rgba(5,20,40,.9)}" +
      // ---- the drawer: the old match-centre lives on, translucent ----
      "html body.fo-th #page .ftp-match-shell{display:none !important}" +
      "html body.fo-th.fo-thd #page .ftp-match-shell{display:block !important;position:fixed !important;z-index:56;right:74px;top:62px;bottom:16px;left:auto;width:min(560px,calc(100vw - 150px));overflow:auto;background:rgba(7,18,36,.86);border:1px solid rgba(255,255,255,.18);border-radius:16px;backdrop-filter:blur(14px);padding:14px;box-shadow:0 24px 70px rgba(0,0,0,.55);margin:0}" +
      "#fo-thd-x{display:none;position:fixed;z-index:57;top:74px;right:88px;width:34px;height:34px;border-radius:999px;background:rgba(5,20,40,.85);border:1.5px solid rgba(255,255,255,.3);color:#fff;font-size:13px;cursor:pointer;align-items:center;justify-content:center}" +
      "body.fo-th.fo-thd #fo-thd-x{display:flex}" +
      "html body.fo-th.fo-thd #page .ftp-match-links{display:flex !important;flex-direction:row;flex-wrap:wrap;gap:4px;background:transparent !important;border:none !important;box-shadow:none !important;padding:0 34px 10px 0;margin:0;position:static}" +
      "html body.fo-th.fo-thd #page .ftp-match-links h4{display:none}" +
      "html body.fo-th.fo-thd #page .ftp-match-links a{white-space:nowrap;font-size:11px !important;font-weight:600;letter-spacing:.6px;padding:7px 12px !important;border:none !important;border-radius:8px;background:rgba(255,255,255,.09) !important;color:#dfe5f0 !important;cursor:pointer}" +
      "html body.fo-th.fo-thd #page .ftp-match-links a.on{background:#F0B94E !important;color:#101B2D !important}" +
      "html body.fo-th.fo-thd #page .ftp-match-shell .mc-main{display:block !important}" +
      "html body.fo-th.fo-thd #page .ftp-match-shell .panel{background:rgba(255,253,247,.97);border-radius:12px;border:none}" +
      "html body.fo-th.fo-thd #page .ftp-match-shell .match-subpanel{margin-top:10px}" +
      // one panel per rail icon: commentary shows the feed, the rest show
      // their tab panel - nothing is rendered twice
      "body.fo-th[data-thtab='Commentary'] .ftp-match-shell .match-subpanel{display:none !important}" +
      "body.fo-th:not([data-thtab='Commentary']) .ftp-match-shell .mc-comm{display:none !important}" +
      // ---- the LIVE BALL pane (the docked oval) ----
      "html body.fo-th #fo-oval{position:fixed !important;left:auto !important;right:74px !important;top:50% !important;bottom:auto !important;transform:translateY(-52%);width:390px !important;max-width:390px !important;min-width:0 !important;margin:0 !important;z-index:54;background:rgba(6,16,32,.78);border:1px solid rgba(255,255,255,.2);border-radius:16px !important;backdrop-filter:blur(12px);box-shadow:0 18px 50px rgba(0,0,0,.5);overflow:hidden}" +
      "body.fo-th.fo-th-ov0 #fo-oval{display:none !important}" +
      "body.fo-th.fo-thd:not(.fo-th-pin) #fo-oval{display:none !important}" +
      // pinned: the pane steps left so the drawer and the field share the screen
      "@media(min-width:1200px){html body.fo-th.fo-thd.fo-th-pin #fo-oval{right:calc(86px + min(560px,calc(100vw - 150px))) !important}}" +
      "@media(max-width:1199.98px){body.fo-th.fo-thd.fo-th-pin #fo-oval{display:none !important}}" +
      "body.fo-th #fo-oval .ov-board,body.fo-th #fo-oval .ov-who{display:none !important}" +
      "body.fo-th #fo-oval .ov-svg{background:transparent}" +
      "#fo-ovhd{display:flex;align-items:center;gap:8px;padding:9px 12px 7px;color:#fff}" +
      "#fo-ovhd b{font-family:Oswald,sans-serif;font-weight:600;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#F3D37A}" +
      "#fo-ovhd span{flex:1;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#fo-ovhd button{width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.85);font-size:12px;line-height:1;cursor:pointer;padding:0}" +
      "#fo-ovhd button:hover{border-color:#F3D37A;color:#F3D37A}" +
      "#fo-ovhd #fo-ovpin.on{color:#F0B94E;border-color:#F0B94E}" +
      "body.fo-th #fo-mst-talk{background:transparent;border-top:1px solid rgba(255,255,255,.12)}" +
      "body.fo-th #fo-oval .ov-note{color:rgba(255,255,255,.4)}" +
      "body.fo-th #fo-oval .ov-snd{border-color:rgba(255,255,255,.25);color:rgba(255,255,255,.6)}" +
      // ---- gaffer bubble + cut-ins + modal layering ----
      "#fo-th-gf{position:fixed;left:22px;bottom:132px;z-index:57;max-width:340px;display:none;align-items:flex-start;gap:10px;background:rgba(7,18,36,.92);border:1px solid rgba(240,185,78,.45);border-radius:14px;padding:11px 15px;backdrop-filter:blur(12px);color:#fff;box-shadow:0 16px 44px rgba(0,0,0,.5)}" +
      "body.fo-th.fo-th-gfon #fo-th-gf{display:flex;animation:foThGfIn .3s ease}" +
      "@keyframes foThGfIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      "#fo-th-gf img{width:40px;height:40px;border-radius:50%;object-fit:cover;object-position:50% 8%;border:1.5px solid rgba(240,185,78,.6);flex:0 0 40px}" +
      "#fo-th-gf span{font-size:12px;line-height:1.45;color:rgba(255,255,255,.9)}" +
      "#fo-th-gf b{display:block;font-family:Oswald,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#F3D37A;margin-bottom:2px}" +
      "#fo-th-cut{position:fixed;left:-8px;bottom:0;z-index:53;height:min(60vh,540px);pointer-events:none;animation:foThCutIn .38s ease}" +
      "#fo-th-cut.out{opacity:0;transition:opacity .5s ease}" +
      "@keyframes foThCutIn{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}" +
      "#fo-th-cut img{height:100%;filter:drop-shadow(0 12px 34px rgba(0,0,0,.6));mask-image:linear-gradient(to bottom,#000 78%,transparent 100%);-webkit-mask-image:linear-gradient(to bottom,#000 78%,transparent 100%)}" +
      "#fo-th-cut .ct{position:absolute;left:16px;bottom:16vh;display:flex;flex-direction:column;color:#fff;text-shadow:0 3px 16px rgba(0,0,0,.9)}" +
      "#fo-th-cut .ct b{font-family:Oswald,sans-serif;font-weight:600;font-size:30px;letter-spacing:5px;color:#F3D37A}" +
      "#fo-th-cut .ct i{font-style:normal;font-family:Oswald,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase}" +
      // holo-card cut-in: the real card, big enough to read
      "#fo-th-cut.pcut{left:30px;bottom:auto;top:50%;transform:translateY(-50%);height:auto;display:flex;align-items:center;gap:20px;animation:foThCutIn .38s ease}" +
      "#fo-th-cut.pcut .cardbox{display:block;width:345px;height:454px;overflow:hidden;border-radius:15px;box-shadow:0 28px 70px rgba(0,0,0,.65)}" +
      "#fo-th-cut.pcut .cardscale{display:block;width:430px;transform:scale(.8);transform-origin:top left}" +
      "#fo-th-cut.pcut .ct{position:static;display:flex;flex-direction:column;gap:2px}" +
      "@media(max-width:1250px){#fo-th-cut.pcut .cardbox{width:259px;height:340px}#fo-th-cut.pcut .cardscale{transform:scale(.6)}#fo-th-cut.pcut .ct b{font-size:24px}}" +
      "@media(max-width:760px){#fo-th-cut.pcut{left:8px;gap:10px}#fo-th-cut.pcut .cardbox{width:194px;height:255px}#fo-th-cut.pcut .cardscale{transform:scale(.45)}#fo-th-cut.pcut .ct b{font-size:19px;letter-spacing:3px}}" +
      // the on-demand bowling change lives with the field talk
      "html body #page #fo-mst-talk .tb.tbc,html body.ftpskin #page #fo-mst-talk .tb.tbc{margin-left:auto;color:#F3D37A !important;border-color:rgba(243,211,122,.55) !important}" +
      "body.fo-th .fo-mst-ask{position:fixed;z-index:80}" +
      "body.fo-th #fo-toasts{top:64px;bottom:auto;z-index:81}" +
      "#fo-commfull{z-index:3000}" +
      "@media (prefers-reduced-motion:reduce){#fo-th-cut,#fo-th-gf,body.fo-th .fo-mst-moment{animation:none !important}}" +
      // ---- tablet ----
      "@media(max-width:1100px){body.fo-th .fo-mst-score{top:50px}body.fo-th .fo-mst-top{top:96px}}" +
      // ---- phones: portrait broadcast ----
      "@media(max-width:760px){" +
      "body.fo-th .fo-mst-top{top:104px !important;left:8px;right:56px;flex-direction:row;align-items:flex-start}" +
      "body.fo-th .fo-mst-wx{max-width:56vw}" +
      "body.fo-th .fo-mst-score{top:52px;min-width:0;padding:9px 18px 10px}" +
      "body.fo-th .fo-mst-score b{font-size:27px}" +
      "body.fo-th .fo-mst-score .tm{font-size:14px;margin-right:8px}" +
      "body.fo-th .fo-mst-score .ovs{font-size:11px;letter-spacing:2.2px}" +
      "body.fo-th .fo-mst-score i{display:none}" +
      "body.fo-th .fo-mst-p{top:auto !important;bottom:88px !important;height:auto !important;width:auto !important;max-width:47vw;padding:4px 13px 4px 5px;gap:9px}" +
      "body.fo-th .fo-mst-p.pbat{left:8px}body.fo-th .fo-mst-p.pbowl{right:8px;padding:4px 5px 4px 13px}" +
      "body.fo-th .fo-mst-p img{width:56px;height:56px;flex-basis:56px;border-width:2px}" +
      "body.fo-th .fo-mst-p .nm{font-size:13px}" +
      "body.fo-th .fo-mst-p .st{font-size:12px}" +
      "body.fo-th .fo-mst-p .stars{display:none}" +
      "body.fo-th .fo-mst-moment{bottom:8px;width:96vw;background:none;border:none;padding:0;backdrop-filter:none;gap:6px}" +
      "body.fo-th .fo-mst-moment .t{font-size:22px;letter-spacing:4px}" +
      "body.fo-th .fo-mst-moment .rib p{font-size:10.5px;letter-spacing:1.1px}" +
      "body.fo-th .fo-mst-score .mbs{display:none}" +
      "#fo-th-rail{right:6px;gap:7px}" +
      "#fo-th-rail button{width:38px;height:38px}" +
      "#fo-th-rail button svg{width:16px;height:16px}" +
      // the field pane becomes a bottom sheet; the drawer goes full-bleed
      "html body.fo-th #fo-oval{left:8px !important;right:8px !important;top:auto !important;bottom:8px !important;transform:none;width:auto !important;max-width:none !important}" +
      "html body.fo-th.fo-thd #page .ftp-match-shell{left:8px;right:8px;top:52px;bottom:8px;width:auto}" +
      "#fo-thd-x{top:60px;right:20px}" +
      "#fo-th-gf{left:8px;right:56px;bottom:150px;max-width:none}" +
      "body.fo-th:not(.fo-th-ov0) #fo-th-gf{display:none !important}" +
      "#fo-th-cut{height:44vh}" +
      "#fo-th-cut .ct b{font-size:22px}" +
      "}" +
      // ==== phone LANDSCAPE: the cinematic desktop layout, compacted so the
      // ==== controls stay above the fold on a 390px-tall screen
      "@media (max-height:520px) and (orientation:landscape){" +
      "body.fo-th .fo-mst-score{top:38px !important;padding:8px 22px 9px;min-width:0}" +
      "body.fo-th .fo-mst-score b{font-size:30px}" +
      "body.fo-th .fo-mst-score .tm{font-size:15px}" +
      "body.fo-th .fo-mst-score i{display:none}" +
      "body.fo-th .fo-mst-score .mbs{display:none}" +
      "body.fo-th .fo-mst-top{top:112px !important}" +
      "html body.fo-th #fo-mstage .fo-mst-next{position:fixed;left:auto;right:14px;top:auto !important;bottom:12px;transform:none;width:210px;min-height:46px;font-size:13px;letter-spacing:2px;padding:12px !important;text-align:center;z-index:56}" +
      "body.fo-th #fo-mst-spd{position:fixed;left:auto;right:14px;top:auto;bottom:12px;width:210px;z-index:56}" +
      "html body.fo-th #fo-mst-spd button{min-height:42px;font-size:13px}" +
      "#fo-th-gauge{display:none !important}" +
      "html body.fo-th #fo-oval{width:300px !important;max-width:300px !important;transform:translateY(-50%);max-height:calc(100vh - 16px);overflow:hidden}" +
      "body.fo-th #fo-oval .ov-svg svg{max-height:calc(100vh - 150px)}" +
      "body.fo-th .fo-mst-p{bottom:12px !important;max-width:300px;padding:6px 16px 6px 8px;gap:9px}" +
      "body.fo-th .fo-mst-p img{width:54px;height:54px;flex:0 0 54px}" +
      "body.fo-th .fo-mst-p .nm{font-size:15px}" +
      "body.fo-th .fo-mst-p .st{font-size:12px}" +
      "body.fo-th .fo-mst-p .stars{display:none}" +
      "body.fo-th .fo-mst-p.pbowl{right:240px}" +
      "body.fo-th:not(.fo-th-ov0):not(.fo-thd) .fo-mst-p{display:none}" +
      "body.fo-th:not(.fo-th-ov0):not(.fo-thd) #fo-mstage .fo-mst-next,body.fo-th:not(.fo-th-ov0):not(.fo-thd) #fo-mst-spd{right:330px}" +
      "body.fo-th .fo-mst-moment{bottom:76px;width:min(460px,52vw)}" +
      "body.fo-th:not(.fo-th-ov0):not(.fo-thd) .fo-mst-moment{left:37%}" +
      "body.fo-th .fo-mst-moment .t{font-size:19px;letter-spacing:3px;height:auto}" +
      "}" +
      // ==== phone PORTRAIT: the ground is the stage, commands rise from a
      // ==== bottom sheet. A different composition, not a shrunken desktop.
      "#fo-mob-sheet,#fo-mob-nav{display:none}" +
      ".fo-mst-wx .cty-m{display:none}" +
      "@media (max-width:767.98px) and (orientation:portrait){" +
      // shell: dynamic viewport, safe areas, nothing scrolls
      "html body.fo-th #fo-mstage{height:100dvh !important;min-height:100dvh !important;z-index:50 !important}" +
      "#fo-mstage::after{content:'';position:absolute;left:0;right:0;bottom:0;z-index:6;height:calc(176px + env(safe-area-inset-bottom));background:rgba(7,17,33,.9);border:1px solid rgba(255,255,255,.14);border-bottom:none;border-radius:20px 20px 0 0;backdrop-filter:blur(14px);box-shadow:0 -14px 40px rgba(0,0,0,.5);transition:height .28s ease;pointer-events:none}" +
      "body.fo-th[data-mobsheet='oval'] #fo-mstage::after{height:calc(60dvh + env(safe-area-inset-bottom))}" +
      "body.fo-th[data-mobsheet='score'] #fo-mstage::after,body.fo-th[data-mobsheet='tactics'] #fo-mstage::after{height:calc(88dvh + env(safe-area-inset-bottom))}" +
      "@media (prefers-reduced-motion:reduce){#fo-mstage::after{transition:none}}" +
      "body.fo-th #fo-mstage .fo-mst-ui{z-index:auto}" +
      "body.fo-th #fo-mstage .fo-mst-scene{z-index:0}" +
      "html body.fo-th #topbar,html body.ftpskin.fo-th #topbar{background:rgba(6,14,26,.82) !important;backdrop-filter:blur(10px);padding-top:env(safe-area-inset-top)}" +
      "body.fo-th #fo-bell{display:none !important}" +
      "#fo-th-rail{display:none !important}" +
      "#fo-thd-x{display:none !important}" +
      "body.fo-th .fo-mst-bg img{object-position:var(--thfocal-m,50% 56%)}" +
      // scorebug: ONE horizontal bug - team, score dominant, overs
      "body.fo-th .fo-mst-score{top:calc(56px + env(safe-area-inset-top));left:50%;right:auto;transform:translateX(-50%);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:2px 12px;width:max-content;min-width:0;max-width:calc(100vw - 20px);padding:8px 17px 9px;border-radius:14px}" +
      "body.fo-th .fo-mst-score .tm{font-size:11.5px;letter-spacing:1.6px;text-transform:uppercase;color:#F3D37A;margin:0}" +
      "body.fo-th .fo-mst-score b{font-size:27px;line-height:1}" +
      "body.fo-th .fo-mst-score .ovs{display:inline;font-size:10px;letter-spacing:2px;margin:0}" +
      "body.fo-th .fo-mst-score i{display:none}" +
      "body.fo-th .fo-mst-score i.chase{display:block;flex-basis:100%;text-align:center;font-size:9.5px;letter-spacing:.6px;color:rgba(255,255,255,.78);margin-top:1px}" +
      // conditions: one small centred pill - CITY / WEATHER / PITCH / FIELD
      "body.fo-th .fo-mst-top{position:static !important;display:contents}" +
      "body.fo-th .fo-mst-wx{position:fixed;z-index:52;top:calc(122px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:max-content;max-width:calc(100vw - 16px);display:flex;align-items:center;justify-content:center;flex-wrap:wrap;background:rgba(6,14,26,.62);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:6px 15px;backdrop-filter:blur(8px)}" +
      "body.fo-th .fo-mst-wx span{background:none !important;border:none !important;padding:0 !important;margin:0 !important;font-size:8.5px;letter-spacing:1px;white-space:nowrap;color:#F5EFDC}" +
      "body.fo-th .fo-mst-wx span+span::before{content:'\\2022';margin:0 6px;color:#F0B94E}" +
      "body.fo-th .fo-mst-wx .gnd{display:none}" +
      "body.fo-th .fo-mst-wx .cty-m{display:inline}" +
      "body.fo-th .fo-mst-wx .cty-m::before{content:none !important}" +
      "body.fo-th .fo-mst-ctlg{position:static}" +
      // matchup strip: one compact bar, batter left, bowler right
      "body.fo-th .fo-mst-p{position:fixed;top:auto !important;bottom:calc(196px + env(safe-area-inset-bottom)) !important;height:64px !important;max-width:none;padding:6px 10px;gap:9px;border-radius:0;background:rgba(7,18,36,.8);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(8px);box-shadow:0 8px 22px rgba(0,0,0,.4);z-index:50}" +
      "body.fo-th .fo-mst-p.pbat{left:10px;right:calc(50vw + .5px);border-radius:15px 5px 5px 15px;border-right:none}" +
      "body.fo-th .fo-mst-p.pbowl{left:calc(50vw + .5px);right:10px;border-radius:5px 15px 15px 5px;flex-direction:row-reverse;padding:6px 10px;border-left-color:rgba(255,255,255,.1)}" +
      "body.fo-th .fo-mst-p img{width:40px;height:40px;flex:0 0 40px;border-width:1.5px;object-position:50% 12%}" +
      "body.fo-th .fo-mst-p .pc{min-width:0}" +
      "body.fo-th .fo-mst-p.pbowl .pc{text-align:right}" +
      "body.fo-th .fo-mst-p .rl{display:none}" +
      "body.fo-th .fo-mst-p .nm{font-size:11.5px;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "body.fo-th .fo-mst-p .st{font-size:10.5px}" +
      "body.fo-th .fo-mst-p .stars{display:block;font-size:8.5px;letter-spacing:1px;line-height:1.2;margin-top:1px;white-space:nowrap}" +
      "body.fo-th[data-mobsheet='score'] .fo-mst-p,body.fo-th[data-mobsheet='tactics'] .fo-mst-p{display:none !important}" +
      "body.fo-th[data-mobsheet='score'] .fo-mst-wx,body.fo-th[data-mobsheet='tactics'] .fo-mst-wx{display:none !important}" +
      "body.fo-th[data-mobsheet='oval'] .fo-mst-p{bottom:calc(60dvh - 84px + env(safe-area-inset-bottom)) !important;z-index:53;background:transparent;border-color:transparent;backdrop-filter:none;box-shadow:none}" +
      // the command sheet itself: frosted navy, rounded, animated snap
      "#fo-mob-sheet{display:block;position:fixed;left:0;right:0;bottom:0;z-index:51;background:none;border:none;box-shadow:none;height:calc(176px + env(safe-area-inset-bottom));transition:height .28s ease;touch-action:none;pointer-events:none}" +
      "#fo-mob-sheet .sh-grip{pointer-events:auto;width:100%;height:26px;margin:1px 0 0;display:flex;align-items:center;justify-content:center;touch-action:none}" +
      "#fo-mob-sheet .sh-grip::after{content:'';width:44px;height:4.5px;border-radius:999px;background:rgba(255,255,255,.3)}" +
      "#fo-mob-tac{pointer-events:auto}" +
      "body.fo-th[data-mobsheet='oval'] #fo-mob-sheet{height:calc(60dvh + env(safe-area-inset-bottom))}" +
      "body.fo-th[data-mobsheet='score'] #fo-mob-sheet,body.fo-th[data-mobsheet='tactics'] #fo-mob-sheet{height:calc(88dvh + env(safe-area-inset-bottom))}" +
      "@media (prefers-reduced-motion:reduce){#fo-mob-sheet{transition:none}}" +
      // tab bar: LIVE / OVAL / SCORE / TACTICS
      "html body #fo-mob-nav{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:58;justify-content:space-around;padding:2px 6px calc(4px + env(safe-area-inset-bottom))}" +
      "html body #fo-mob-nav button{flex:1;max-width:120px;min-height:48px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:none !important;border:none !important;box-shadow:none !important;color:rgba(255,255,255,.7);cursor:pointer;padding:5px 0;border-radius:10px}" +
      "html body #fo-mob-nav button svg{width:20px;height:20px}" +
      "html body #fo-mob-nav button span{font-family:Oswald,sans-serif;font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase}" +
      "html body #fo-mob-nav button.on{color:#F0B94E}" +
      "html body #fo-mob-nav button.on span{border-bottom:2px solid #F0B94E;padding-bottom:1px}" +
      // latest delivery: chip + line, result as a small badge on the right
      "body.fo-th .fo-mst-moment{top:auto;left:50%;transform:translateX(-50%);bottom:calc(128px + env(safe-area-inset-bottom));width:calc(100vw - 30px);background:none;border:none;padding:0;backdrop-filter:none;display:flex;flex-direction:row-reverse;align-items:center;gap:8px;z-index:53}" +
      "body.fo-th .fo-mst-moment .t{height:auto;min-height:0;font-size:10px;letter-spacing:1.8px;padding:4px 10px;border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(6,14,26,.62);flex:0 0 auto;text-shadow:none;animation:none !important}" +
      "body.fo-th .fo-mst-moment .rib{flex:1;min-width:0;min-height:0;justify-content:flex-start;background:none;border:none;padding:0;backdrop-filter:none}" +
      "body.fo-th .fo-mst-moment .rib p{font-size:12.5px;letter-spacing:.2px;text-transform:none;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#F5EFDC;text-shadow:0 1px 6px rgba(0,0,0,.7)}" +
      "body.fo-th .fo-mst-moment .rib .kph{display:none}" +
      "body.fo-th[data-mobsheet='score'] .fo-mst-moment,body.fo-th[data-mobsheet='tactics'] .fo-mst-moment{display:none !important}" +
      "body.fo-th[data-mobsheet='oval'] .fo-mst-moment{bottom:calc(60dvh - 134px + env(safe-area-inset-bottom))}" +
      // the tempo row: the thumb target where NEXT BALL used to live
      "html body.fo-th #fo-mstage .fo-mst-next{position:fixed;left:14px;right:14px;top:auto;transform:none;width:auto;min-height:50px;z-index:57;bottom:calc(64px + env(safe-area-inset-bottom));font-size:15px;letter-spacing:2.8px;padding:14px !important;text-align:center;border-radius:14px}" +
      "html body.fo-th #fo-mstage .fo-mst-next:active{transform:translateY(1px)}" +
      "body.fo-th #fo-mst-spd{position:fixed;left:14px;right:14px;top:auto;transform:none;width:auto;z-index:57;bottom:calc(64px + env(safe-area-inset-bottom))}" +
      "html body.fo-th #fo-mst-spd button{min-height:46px}" +
      "body.fo-th[data-mobsheet='oval'] #fo-mst-spd{left:50%;right:auto;transform:translateX(-50%);width:230px;bottom:calc(62px + env(safe-area-inset-bottom))}" +
      "body.fo-th[data-mobsheet='oval'] #fo-mst-spd button{min-height:40px;font-size:13px}" +
      // the LIVE BALL pane docks INSIDE the oval sheet - never a separate page
      "body.fo-th[data-mobsheet]:not([data-mobsheet='oval']) #fo-oval{display:none !important}" +
      "html body.fo-th[data-mobsheet='oval'] #fo-oval{display:block !important;position:fixed !important;left:12px !important;right:12px !important;top:auto !important;bottom:calc(128px + env(safe-area-inset-bottom)) !important;transform:none;width:auto !important;max-width:none !important;max-height:calc(60dvh - 250px);z-index:54;background:transparent;border:none;border-radius:0 !important;box-shadow:none;backdrop-filter:none;overflow:visible}" +
      // .ov-svg IS the <svg>: cap its height and let the viewBox letterbox it
      "body.fo-th[data-mobsheet='oval'] #fo-oval .ov-svg{max-height:calc(60dvh - 290px);margin:0 auto;background:transparent}" +
      // drag the grip UP and the ball animation takes the whole screen
      "body.fo-th.fo-mob-xl[data-mobsheet='oval'] #fo-mob-sheet,body.fo-th.fo-mob-xl[data-mobsheet='oval'] #fo-mstage::after{height:calc(100dvh - 48px - env(safe-area-inset-top))}" +
      "body.fo-th.fo-mob-xl[data-mobsheet='oval'] .fo-mst-p{bottom:calc(100dvh - 176px) !important}" +
      // full screen means full screen: the scorebug and conditions yield to
      // the animation (the grip at the very top brings them back)
      "body.fo-th.fo-mob-xl[data-mobsheet='oval'] .fo-mst-score,body.fo-th.fo-mob-xl[data-mobsheet='oval'] .fo-mst-wx{display:none !important}" +
      "body.fo-th.fo-mob-xl[data-mobsheet='oval'] .fo-mst-moment{bottom:calc(100dvh - 204px)}" +
      "html body.fo-th.fo-mob-xl[data-mobsheet='oval'] #fo-oval{max-height:calc(100dvh - 336px)}" +
      "body.fo-th.fo-mob-xl[data-mobsheet='oval'] #fo-oval .ov-svg{max-height:calc(100dvh - 356px)}" +
      "body.fo-th #fo-ovhd{display:none}" +
      "body.fo-th #fo-oval .ov-note{display:none}" +
      "body.fo-th #fo-ovhd button{display:none}" +
      "body.fo-th #fo-oval #fo-mst-talk{display:none}" +
      // gaffer bubble rides above the sheet
      "#fo-th-gf{left:10px;right:10px;bottom:calc(206px + env(safe-area-inset-bottom));max-width:none}" +
      // SCORE / TACTICS: the engine tabs render inside the tall sheet
      "html body.fo-th.fo-thd #page .ftp-match-shell{left:10px;right:10px;top:auto;bottom:calc(60px + env(safe-area-inset-bottom));height:calc(88dvh - 82px);width:auto;z-index:56;background:transparent;border:none;box-shadow:none;backdrop-filter:none;padding:2px 2px 8px;border-radius:0;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}" +
      "body.fo-th[data-mobsheet='tactics'].fo-thd #page .ftp-match-shell{height:calc(88dvh - 200px)}" +
      "html body.fo-th.fo-thd #page .ftp-match-links{position:sticky;top:0;z-index:2;background:rgba(7,17,33,.96) !important;padding:6px 0 10px;margin:0}" +
      "html body.fo-th.fo-thd #page .ftp-match-links a{min-height:34px;display:inline-flex;align-items:center}" +
      // tactics: the live field-talk row pinned at the sheet top
      "#fo-mob-tac{display:none;margin:8px 12px 6px}" +
      "body.fo-th[data-mobsheet='tactics'] #fo-mob-tac{display:block}" +
      "body.fo-th #fo-mob-tac #fo-mst-talk{display:flex;flex-wrap:wrap;align-items:center;gap:7px;background:transparent;border:none;padding:0 0 8px;border-bottom:1px solid rgba(255,255,255,.12)}" +
      "html body #fo-mob-tac #fo-mst-talk .tl{font-family:Oswald,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:#F3D37A;margin-right:2px}" +
      "html body #fo-mob-tac #fo-mst-talk .tb{min-height:38px;font-size:12px;font-weight:600;padding:8px 13px;border-radius:999px;background:rgba(255,255,255,.08) !important;border:1.5px solid rgba(255,255,255,.22) !important;color:#fff !important;cursor:pointer;box-shadow:none !important}" +
      "html body #fo-mob-tac #fo-mst-talk .tb.on{background:#F0B94E !important;border-color:#F0B94E !important;color:#101B2D !important}" +
      "html body #fo-mob-tac #fo-mst-talk .tb.tbc{margin-left:auto;color:#F3D37A !important;border-color:rgba(243,211,122,.55) !important;background:rgba(243,211,122,.08) !important}" +
      // cut-ins float above the sheet but below the tab bar
      "#fo-th-cut{z-index:57}" +
      "body.fo-th #fo-toasts{top:calc(60px + env(safe-area-inset-top))}" +
      "}";
    document.head.appendChild(s);
  }
  function foMatchStage() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/match") { document.body.classList.remove("fo-stage-on"); foThChrome(false); return; }
      if (typeof M === "undefined" || !M || !M.innings || !M.meta) return;
      var page = document.getElementById("page"); if (!page) return;
      var mcTop = page.querySelector(".mc-top");
      // the engine's re-render wipes the field pane; remount it in the SAME
      // frame so the theatre never flickers between balls
      if (!document.getElementById("fo-oval")) { try { if (typeof FOC !== "undefined" && FOC.oval && FOC.oval.tick) FOC.oval.tick(); } catch (eOt) {} }
      var oval = document.getElementById("fo-oval");
      // re-home the pane on <body>: the engine's per-ball #page re-render can
      // never destroy it there, so the LIVE BALL animation never flickers
      if (oval && oval.parentNode !== document.body) document.body.appendChild(oval);
      if (!mcTop && !oval) { document.body.classList.remove("fo-stage-on"); foThChrome(false); return; }
      var inn = M.innings[M.inns]; if (!inn) return;
      // the broadcast runs itself: every match auto-plays at the measured pace,
      // and "Next ball" simply refuses to wait for the next tick
      if (window.__foMstM !== M) {
        window.__foMstM = M; window.__foMstAuto = true; window.__foMstHold = false;
        window.__foThMult = 1;
        window.__foMstLL = M.log.length;
        var oldAsk0 = document.getElementById("fo-mst-ask"); if (oldAsk0) oldAsk0.remove();
        try { UI.apMs = foThMs(); if (typeof foEnsureAutoplay === "function" && !M.done) foEnsureAutoplay(); } catch (eAp0) {}
      }
      if (!window.__foMstAuto) window.__foMstAuto = true;   // no pause in the broadcast era
      var userBatNow = inn.batTeam === M.user.name;
      // a manual bowler pick is consumed once the picked man is actually into
      // his over (a mid-over pick stays pending for the NEXT over)
      try { if (inn.legal % 6 !== 0 && UI.userBowler && inn.curBowlerName === UI.userBowler) { UI.userBowler = null; UI.usePlan = true; } } catch (eUb) {}
      if (!foMstAuto() || window.__foMstHold) foMstKillAp();
      // team talk lives in the centre theatre now: field calls when bowling,
      // batting intent when batting - wired straight into the live orders
      try {
        if (oval && !M.done) {
          var tb2 = document.getElementById("fo-mst-talk");
          if (!tb2) {
            tb2 = document.createElement("div"); tb2.id = "fo-mst-talk";
            var sv2 = oval.querySelector(".ov-svg");
            if (sv2 && sv2.parentNode === oval) oval.insertBefore(tb2, sv2.nextSibling); else oval.appendChild(tb2);
          }
          var ov3 = Math.floor(inn.legal / 6), ph3 = ov3 < 10 ? "pp" : (ov3 >= 40 ? "death" : "mid");
          var h3;
          if (userBatNow) {
            var cur3 = (App.orders.phaseIntent && App.orders.phaseIntent[ph3] !== undefined) ? App.orders.phaseIntent[ph3] : 0;
            h3 = "<span class='tl'>Batting</span>" + [[-1, "Defensive"], [0, "Steady"], [1, "Aggressive"], [2, "Launch"]].map(function (o3) {
              return "<button type='button' class='tb" + (cur3 === o3[0] ? " on" : "") + "' onclick=\"foTeamTalk('bat','" + ph3 + "'," + o3[0] + ")\">" + o3[1] + "</button>";
            }).join("");
          } else {
            var cf3 = (App.orders.fieldPlan && App.orders.fieldPlan[ph3]) || "bal";
            h3 = "<span class='tl'>Field</span>" + [["att", "Attack"], ["bal", "Balanced"], ["def", "Defence"]].map(function (o4) {
              return "<button type='button' class='tb" + (cf3 === o4[0] ? " on" : "") + "' onclick=\"foTeamTalk('field','" + ph3 + "','" + o4[0] + "')\">" + o4[1] + "</button>";
            }).join("") + "<button type='button' class='tb tbc' onclick='foThBowlAsk()'>Bowling change &#9654;</button>";
          }
          if (tb2.__h !== h3) { tb2.__h = h3; tb2.innerHTML = h3; }
        } else if (M.done) { var tbx = document.getElementById("fo-mst-talk"); if (tbx) tbx.remove(); }
      } catch (eT) {}
      // rebuild only when the broadcast moved on (or the theatre re-homed us)
      var old = document.getElementById("fo-mstage");
      // field posture comes from the theatre's (now hidden) board - no info lost
      var fld = ""; try { fld = ((document.getElementById("ov-fld") || {}).textContent || "").trim(); } catch (eF) {}
      var sig = M.inns + ":" + M.log.length + ":" + inn.runs + "/" + inn.wkts + ":" + (M.done ? 1 : 0) + ":" + (oval ? "ov" : "mc") + ":" + fld + ":" + (foMstAuto() ? 1 : 0) + ":" + (window.__foThMult || 1);
      if (old && old.__foSig === sig && (!oval || old.parentNode === oval.parentNode)) return;
      var art = foMstArt();
      var wx = ((M.meta.weather || "") + "").toLowerCase();
      var rainy = /rain|drizzle|storm|shower|wet/.test(wx);
      var gloomy = /overcast|cloud/.test(wx);
      var sunny = /sunny|clear/.test(wx), heat = /hot|scorch/.test(wx);
      var misty = /mist|fog/.test(wx), humid = /humid|dew/.test(wx);
      var windy = /windy|breez|gale/.test(wx), chilly = /chill|cold/.test(wx);
      var s1 = inn.bat && inn.bat[inn.striker];
      var bw = (inn.bxi || []).filter(function (p) { return p.name === inn.curBowlerName; })[0];
      var brec = bw && inn.bowlers ? inn.bowlers[bw.name] : null;
      var userBat = inn.batTeam === M.user.name;
      // the last real delivery of THIS innings drives the moment
      var L = null;
      for (var i = 0; i < Math.min(4, M.log.length); i++) { if (!M.log[i].mile && M.log[i].inn === M.inns) { L = M.log[i]; break; } }
      var kind = "", title = "", copy = "";
      if (M.done) { kind = "done"; title = "FULL TIME"; copy = (M.result && M.result.text) || ""; }
      else if (L) {
        var o = L.out;
        title = FO_MST_TITLES[o] || (typeof isWkt === "function" && isWkt(o) ? "WICKET!" : "");
        kind = (o === "4" || o === "6") ? "boundary" : (typeof isWkt === "function" && isWkt(o)) ? "wicket" : (o === "dot") ? "dot" : "run";
        if (!title) { title = "Dot ball"; kind = "dot"; }
        copy = L.txt || "";
      } else { kind = "start"; title = M.inns ? "THE CHASE" : "PLAY"; copy = (userBat ? "Your openers" : "Their openers") + " walk out at " + art.gnm + "."; }
      // ball speed, broadcast-style: the engine keeps no velocity, so this is
      // deterministic decoration - type sets the band, the bowler's rating
      // sets where he lives in it, the seed wobbles it ball to ball
      var kphTx = "";
      try {
        if (L && bw && !L.mile && !M.done) {
          var bt9 = bw.bowlType || "";
          var band9 = bt9 === "fast" ? [138, 152] : bt9 === "fastMedium" ? [129, 140] : bt9 === "medium" ? [117, 129] :
            bt9 === "wristSpin" ? [78, 90] : (bt9 === "fingerSpin" || bt9 === "offSpin") ? [82, 94] : [112, 126];
          var rt9 = 50; try { if (window.foStarsFor) rt9 = window.foStarsFor.bowl(bw) || 50; } catch (eR9) {}
          var mid9 = band9[0] + (Math.max(20, Math.min(95, rt9)) - 20) / 75 * (band9[1] - band9[0] - 5);
          var j9 = 0; try { j9 = (foHash32((((M.meta && M.meta.seed) || 0) + "") + "|" + (L.no || "") + "|kph") % 7) - 3; } catch (eJ9) {}
          kphTx = Math.round(mid9 + j9 + 2) + " kph";
        }
      } catch (eKp) {}
      // the speedo: a racing sweep above the bowler, 60-160 kph across a
      // half-dial. ONE persistent dial on <body> - each ball only moves the
      // needle (CSS transitions do the sweep), so the plate never blinks.
      try {
        var gEl = document.getElementById("fo-th-gauge");
        if (kphTx && bw && !M.done) {
          var kv9 = parseInt(kphTx, 10) || 0;
          var f9 = Math.max(0, Math.min(1, (kv9 - 60) / 100));
          var ang9 = (-90 + f9 * 180).toFixed(1);
          if (!gEl) {
            gEl = document.createElement("div"); gEl.id = "fo-th-gauge";
            gEl.innerHTML = "<svg viewBox='0 0 100 58'>" +
              "<defs><linearGradient id='foGg' gradientUnits='userSpaceOnUse' x1='10' y1='50' x2='90' y2='50'><stop offset='0' stop-color='#22D3E0'/><stop offset='.55' stop-color='#F0B94E'/><stop offset='1' stop-color='#E0504B'/></linearGradient></defs>" +
              "<path d='M10 50 A40 40 0 0 1 90 50' fill='none' stroke='rgba(255,255,255,.16)' stroke-width='7' stroke-linecap='round'/>" +
              "<path d='M10 50 A40 40 0 0 1 90 50' fill='none' stroke='url(#foGg)' stroke-width='7' stroke-linecap='round' stroke-dasharray='125.7' stroke-dashoffset='125.7' class='arc'/>" +
              "<line x1='50' y1='50' x2='50' y2='17' stroke='#fff' stroke-width='2.4' stroke-linecap='round' class='ndl' style='transform:rotate(-90deg)'/>" +
              "<circle cx='50' cy='50' r='3.4' fill='#fff'/></svg>" +
              "<span class='gv'><b>0</b><i>kph</i></span>";
            document.body.appendChild(gEl);
          }
          gEl.style.display = "";
          gEl.querySelector(".arc").style.strokeDashoffset = (125.7 * (1 - f9)).toFixed(1);
          gEl.querySelector(".ndl").style.transform = "rotate(" + ang9 + "deg)";
          gEl.querySelector(".gv b").textContent = kv9;
        } else if (gEl) gEl.style.display = "none";
      } catch (eGa) {}
      // this over, as beads
      var cur = [];
      for (var i2 = 0; i2 < M.log.length; i2++) {
        var L2 = M.log[i2]; if (L2.inn !== M.inns || L2.mile) continue;
        if (Math.floor(parseFloat(L2.no)) === Math.floor(Math.max(0, inn.legal - 1) / 6)) cur.unshift(L2); else break;
      }
      var beads = cur.map(function (L3) {
        var oo = L3.out, cls = oo === "4" || oo === "6" ? " b4" : (typeof isWkt === "function" && isWkt(oo)) ? " bw" : (oo === "wide" || oo === "noball") ? " bx" : "";
        var sym = oo === "4" ? "4" : oo === "6" ? "6" : (typeof isWkt === "function" && isWkt(oo)) ? "W" : oo === "dot" ? "&middot;" : (["1", "2", "3"].indexOf(oo) >= 0 ? oo : "+");
        return "<span class='mb" + cls + "'>" + sym + "</span>";
      }).join("");
      var tgt = M.target ? ("Target " + M.target + " &middot; need " + Math.max(0, M.target - inn.runs) + " off " + Math.max(0, (typeof foBallCap === "function" ? foBallCap() : 300) - inn.legal)) : "First innings";
      // the toss, told plainly: who called it right and what they did with it
      var tossTx = "";
      try {
        var tt0 = (App.tossState && App.tossState.txt) || "";
        var tM0 = /^(.+?) won the toss and chose to (bat|bowl)/.exec(tt0);
        if (tM0) tossTx = tM0[1] + " won the toss &middot; chose to " + tM0[2];
      } catch (eTs) {}
      // the broadcast never stops: the only control is its tempo
      var spdNow = window.__foThMult || 1;
      var ctlBtns = (!M.done ?
        "<div class='fo-mst-spd' id='fo-mst-spd'>" + [1, 2, 4].map(function (m9) {
          return "<button type='button' data-spd='" + m9 + "'" + (spdNow === m9 ? " class='on'" : "") + ">" + m9 + "&times;</button>";
        }).join("") + "</div>"
        : "<button type='button' class='fo-mst-next' id='fo-mst-done'>Continue &#9654;</button>");
      var pArt = function (p) { try { return FO_ART + foPkArt(p); } catch (e) { return ""; } };
      // the who-card stars now live HERE - same math as the theatre's
      var FS = window.foStarsFor, batStars = "", bowlStars = "";
      try { if (FS && s1) batStars = "<div class='stars'>" + FS.html(FS.stars(FS.bat(s1.p))) + "</div>"; } catch (eS1) {}
      try { if (FS && bw) bowlStars = "<div class='stars'>" + FS.html(FS.stars(FS.bowl(bw))) + "</div>"; } catch (eS2) {}
      var batPanel = (!M.done && s1) ?
        "<div class='fo-mst-p pbat'><img src='" + pArt(s1.p) + "' alt=''><div class='pc'>" +
        "<div class='rl'>On strike &middot; " + (s1.p.hand === "L" ? "LHB" : "RHB") + "</div>" +
        "<div class='nm'>" + E(s1.p.name) + "</div>" +
        "<div class='st'>" + s1.r + "* (" + s1.b + ")</div>" + batStars + "</div></div>" : "";
      var bowlPanel = (!M.done && bw) ?
        "<div class='fo-mst-p pbowl'><img src='" + pArt(bw) + "' alt=''><div class='pc'>" +
        "<div class='rl'>" + E((bw.btLabel || "bowling").toUpperCase()) + "</div>" +
        "<div class='nm'>" + E(bw.name) + "</div>" +
        "<div class='st'>" + (brec ? Math.floor(brec.b / 6) + "." + (brec.b % 6) + "&ndash;" + brec.r + "&ndash;" + brec.w : "new spell") + "</div>" + bowlStars + "</div></div>" : "";
      // the stage is TWO layers: a scene (the painting + weather, static for
      // the whole match) and a UI skin repainted per ball. Patching only the
      // skin keeps the artwork untouched between deliveries - no flash, no
      // "page refresh" feel.
      var sceneCls = "fo-mst" + (rainy ? " wx-rain" : "") + (gloomy ? " wx-gloom" : "") +
        (sunny ? " wx-sun" : "") + (heat ? " wx-heat" : "") + (misty ? " wx-mist" : "") +
        (humid ? " wx-humid" : "") + (windy ? " wx-wind" : "") + (chilly ? " wx-chill" : "") + " m-" + art.mode;
      var artKey = art.img + "|" + sceneCls;
      var uiHTML =
        "<div class='fo-mst-top'>" +
        "<div class='fo-mst-wx'><span class='gnd'>" + E(art.gnm) + (art.city ? " &middot; " + E(art.city) : "") + "</span>" + (art.city ? "<span class='cty-m'>" + E(art.city) + "</span>" : "") + "<span>" + E(M.meta.weather || "") + "</span><span>" + E(M.pitch || "") + " pitch</span>" + (fld ? "<span class='fld'>" + E(fld) + "</span>" : "") + "</div>" +
        "<div class='fo-mst-ctlg'>" + ctlBtns + "</div></div>" +
        "<div class='fo-mst-score'><span class='tm'>" + E(inn.batTeam) + "</span><b>" + inn.runs + "/" + inn.wkts + "</b><span class='ovs'>" + Math.floor(inn.legal / 6) + "." + (inn.legal % 6) + " overs</span><i class='" + (M.target ? "chase" : "fi") + "'>" + tgt + "</i>" +
        (tossTx ? "<i class='tossl'>" + tossTx + "</i>" : "") +
        "<div class='mbs'>" + (beads || "<span class='mb'>&ndash;</span>") + "</div></div>" +
        batPanel + bowlPanel +
        // the broadcast lower third: transient result label, then a slim ribbon
        // (ball number + the line), then this over as beads
        "<div class='fo-mst-moment'>" +
        "<div class='t'>" + title + "</div>" +
        "<div class='rib'>" + (L && !M.done ? "<span class='chip'>" + E(L.no || "") + "</span>" : "") +
        (kphTx ? "<span class='kph'>" + kphTx + "</span>" : "") +
        (copy ? "<p>" + E(copy) + "</p>" : "") + "</div></div>";
      var el;
      if (old && old.__foArtKey === artKey) {
        el = old;
        var ui0 = el.querySelector(".fo-mst-ui");
        if (ui0) { ui0.className = "fo-mst-ui k-" + kind; ui0.innerHTML = uiHTML; }
      } else {
        el = document.createElement("section");
        el.id = "fo-mstage";
        el.className = sceneCls;
        el.__foArtKey = artKey;
        el.innerHTML =
          "<div class='fo-mst-scene'>" +
          "<div class='fo-mst-bg'><img src='" + art.img + "' alt=''></div><div class='fo-mst-veil'></div>" +
          (rainy ? "<div class='fo-mst-rain'></div>" : "") +
          (sunny || heat ? "<div class='fo-mst-sun'></div>" : "") +
          (misty || humid ? "<div class='fo-mst-mist'></div>" : "") +
          (windy ? "<div class='fo-mst-wind'></div>" : "") +
          (chilly ? "<div class='fo-mst-cold'></div>" : "") + "</div>" +
          "<div class='fo-mst-ui k-" + kind + "'>" + uiHTML + "</div>";
        // the stage lives on BODY, outside #page: the engine's per-ball page
        // re-render can never touch it, so the painting is rock steady.
        // An open prompt survives the rebuild - its clock, not a repaint,
        // decides when it goes
        var askKeep = old ? old.querySelector("#fo-mst-ask") : null;
        if (old) { old.replaceWith(el); if (askKeep) el.appendChild(askKeep); }
        else document.body.appendChild(el);
      }
      if (el.parentNode !== document.body) document.body.appendChild(el);
      el.style.setProperty("--cxc", art.ac);
      el.__foSig = sig;
      document.body.classList.add("fo-stage-on");
      // ---- broadcast theatre: the venue IS the interface ----
      try {
        el.style.setProperty("--thfocal", FO_TH_FOCAL[art.city] || "center 50%");
        el.style.setProperty("--thfocal-m", FO_TH_FOCAL_M[art.city] || "50% 56%");
        foThChrome(true);
      } catch (eTh) {}
      var db = el.querySelector("#fo-mst-done");
      if (db) db.addEventListener("click", function () { location.hash = "#/circuit"; if (typeof window.route === "function") window.route(); });
      el.querySelectorAll("#fo-mst-spd [data-spd]").forEach(function (sb9) {
        sb9.addEventListener("click", function () { foThSetSpeed(+sb9.getAttribute("data-spd")); });
      });
      var nb = el.querySelector("#fo-mst-next");
      if (nb) nb.addEventListener("click", function () {
        try { if (window.__foMstHold && !document.getElementById("fo-mst-ask") && !window.__foMstAskT) window.__foMstHold = false; } catch (eH) {}
        if (window.__foMstHold || document.getElementById("fo-mst-ask") || !M || M.done) return;
        try {
          var before = M.log.length;
          window.__foMstStep = 1;
          doBall();
          window.__foMstStep = 0;
          // an innings break or a wedged state can swallow the tap - punch
          // through with the sim recipe, never over a manual bowler pick
          if (M && !M.done && M.log.length === before) {
            if (!UI.userBowler && typeof autoPick === "function") autoPick();
            if (typeof stepBall === "function") stepBall();
            if (typeof renderMatch === "function") renderMatch();
          }
        } catch (eNb) {}
        try { if (!foMstAuto()) UI.apMs = 999999; } catch (eNa) {}
      });
      // the timed prompts: fired once per fresh delivery, never on re-renders
      var prevLL = (window.__foMstLL || 0);
      var newBall = M.log.length > prevLL;
      window.__foMstLL = M.log.length;
      // moment cut-ins: the player's actual holo card, near full size, for the
      // moments that earn it - a wicket shows the man who fell, a milestone
      // the man who made it. (When the user is batting, the who-walks-in
      // prompt with its dealt cards IS the wicket moment.)
      if (newBall && !document.getElementById("fo-mst-ask")) {
        try {
          if (kind === "wicket" && !userBatNow) {
            var pOut = null;
            try {
              var fw9 = inn.fow && inn.fow[inn.fow.length - 1];
              if (fw9 && fw9.who) inn.bat.forEach(function (bb9) { if (bb9 && bb9.p && bb9.p.name === fw9.who) pOut = bb9.p; });
            } catch (eFw) {}
            if (pOut) foThCutCard(pOut, "WICKET", pOut.name + " departs");
            else if (bw) foThCut(pArt(bw), "WICKET", bw.name);
          } else if (kind !== "wicket") {
            var freshL = M.log.slice(0, Math.max(0, M.log.length - prevLL));
            for (var fm = 0; fm < freshL.length; fm++) {
              if (!freshL[fm].mile) continue;
              var mtx = freshL[fm].txt || "";
              if (/HUNDRED|CENTURY/i.test(mtx) && s1) { foThCutCard(s1.p, "HUNDRED!", s1.p.name); break; }
              if (/FIFTY/i.test(mtx) && s1) { foThCutCard(s1.p, "FIFTY!", s1.p.name); break; }
            }
          }
        } catch (eCt) {}
      }
      if (newBall && !M.done && !document.getElementById("fo-mst-ask")) {
        if (kind === "wicket" && userBatNow && s1 && s1.b === 0 && inn.nextBat <= 10) {
          // 5 seconds: promote a batsman, or the planned man walks in
          var si = inn.striker, cands = [];
          for (var jx = inn.nextBat; jx <= 10 && cands.length < 3; jx++) if (inn.bat[jx] && !inn.bat[jx].out) cands.push(jx);
          if (cands.length) {
            foMstAsk({
              title: "Wicket &middot; who walks in?",
              sub: E(s1.p.name) + " is next on the card &mdash; or promote someone.",
              secs: 5,
              options: [{ label: E(s1.p.name), meta: "as planned", def: 1, p: s1.p, cb: null }].concat(cands.map(function (j2) {
                return { label: E(inn.bat[j2].p.name), meta: "promote", p: inn.bat[j2].p, cb: function () {
                  try { if (inn.bat[si] && inn.bat[si].p === s1.p && inn.bat[si].b === 0) { var t2 = inn.bat[si]; inn.bat[si] = inn.bat[j2]; inn.bat[j2] = t2; } } catch (eSw) {}
                } };
              }))
            });
          }
        }
        // no automatic over-end interruption any more: the plan bowls itself,
        // and the manager reaches for "Bowling change" in the pane when they
        // want a different man for the coming overs
      }
    } catch (e) {}
  }
  // on-demand bowling change: opens the dealt-cards prompt for the NEXT over.
  // The pick writes UI.userBowler, exactly as the old timed prompt did.
  window.foThBowlAsk = function () {
    try {
      if (typeof M === "undefined" || !M || M.done) return;
      var innB = M.innings[M.inns]; if (!innB || innB.batTeam === M.user.name) return;
      var overB = Math.floor(innB.legal / 6) + (innB.legal % 6 === 0 ? 0 : 1);
      var plannedB = null; try { plannedB = (typeof plannedBowler === "function") ? plannedBowler(innB, overB) : null; } catch (ePb) {}
      var avB = []; try { avB = availableBowlers(innB) || []; } catch (eAb2) {}
      var optsB = [];
      if (plannedB) optsB.push({ label: E(plannedB.name), meta: "as planned", def: 1, p: plannedB, cb: null });
      avB.filter(function (pB) { return (!plannedB || pB.name !== plannedB.name) && pB.name !== innB.curBowlerName; }).slice(0, 3).forEach(function (pB) {
        var recB = innB.bowlers[pB.name];
        optsB.push({ label: E(pB.name), meta: recB ? (Math.floor((recB.b || 0) / 6) + "-" + (recB.r || 0) + "-" + (recB.w || 0)) : "fresh", p: pB, cb: function () {
          try { UI.userBowler = pB.name; UI.usePlan = false; } catch (eBw2) {}
        } });
      });
      if (optsB.length) foMstAsk({ title: "Bowling change &middot; who takes the next over?", sub: "The change comes on at the end of this over.", secs: 20, options: optsB });
    } catch (eBa) {}
  };
  try {
    if (window.foTeamTalk && !window.foTeamTalk.__foSpell) {
      var _foTT = window.foTeamTalk;
      window.foTeamTalk = function (kind, ph, v) {
        var r0 = _foTT.apply(this, arguments);
        try {
          if (kind === "field" && App && App.orders && App.orders.spells) {
            ["north", "south"].forEach(function (e2) { (App.orders.spells[e2] || []).forEach(function (x2) { if (x2 && x2.field) x2.field = null; }); });
          }
        } catch (eTT) {}
        return r0;
      };
      window.foTeamTalk.__foSpell = 1;
    }
  } catch (eTW) {}
  // the story stays short: the visible feed holds ~5 overs; the full book
  // opens in its own full-screen reader
  function foCommFull() {
    try {
      var ex = document.getElementById("fo-commfull"); if (ex) { ex.remove(); return; }
      if (typeof M === "undefined" || !M || !M.log) return;
      var rows = M.log.map(function (L9) {
        var o9 = L9.out;
        var bg9 = (typeof isWkt === "function" && isWkt(o9)) ? "background:#fbe9e7;" : (o9 === "6" ? "background:#fdf6df;" : (o9 === "4" ? "background:#eef4fa;" : ""));
        return "<div class='bl " + (L9.mile ? "mile" : "") + "' style='" + bg9 + "'><b>" + E(L9.no || "") + "</b> " + E(L9.txt || "") + "</div>";
      }).join("");
      var d9 = document.createElement("div"); d9.id = "fo-commfull";
      d9.innerHTML = "<div class='cf-bx'><div class='cf-hd'><span>Full commentary &middot; every ball</span><button type='button' id='fo-commfull-x'>&#10005;</button></div><div class='cf-feed commfeed'>" + (rows || "<span class='small'>No balls yet.</span>") + "</div></div>";
      document.body.appendChild(d9);
      d9.addEventListener("click", function (ev9) { if (ev9.target === d9 || ev9.target.id === "fo-commfull-x") d9.remove(); });
    } catch (eCf) {}
  }
  function foCommBtn() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/match") return;
      var feed = document.querySelector(".ftp-match-body .commfeed");
      if (!feed || document.getElementById("fo-commfull-btn")) return;
      var b9 = document.createElement("button");
      b9.type = "button"; b9.id = "fo-commfull-btn"; b9.textContent = "Full commentary \u25B8";
      feed.parentNode.insertBefore(b9, feed.nextSibling);
      b9.addEventListener("click", foCommFull);
    } catch (eCb) {}
  }
  try { foMatchRenderHooks.push(foCommBtn); } catch (eCB2) {}
  setInterval(foCommBtn, 1200);
  try { foMatchRenderHooks.push(foMatchStage); } catch (eMS) {}
  setInterval(foMatchStage, 1000);
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/match") { document.body.classList.remove("fo-stage-on"); foThChrome(false); } });
  try {
    var msCss = document.createElement("style"); msCss.id = "fo-mst-css";
    msCss.textContent =
      ".fo-mst{position:relative;min-height:460px;height:min(52vh,640px);border-radius:16px;overflow:hidden;margin:0 0 14px;isolation:isolate;background:#081a2b;width:100%;max-width:100%}" +
      // the theatre's score board and who-cards are duplicated in the hero -
      // hide them so the oval pane shrinks to just the living field
      "html body #page.fo-ovalgrid.fo-matchpage #fo-oval .ov-board,html body #page.fo-ovalgrid.fo-matchpage #fo-oval .ov-who{display:none !important}" +
      // and the animation pane narrows: the commentary column gets the room
      "html body #page.fo-ovalgrid.fo-matchpage{grid-template-columns:minmax(380px,42%) minmax(0,1fr) !important}" +
      // the stage owns a full-width grid row above the theatre; the oval and
      // the commentary column sit side by side underneath it
      "html body #page.fo-ovalgrid.fo-matchpage{grid-template-rows:auto auto auto auto auto 1fr !important;grid-template-areas:'mcrumb mcrumb' 'mlinks mlinks' 'mstage mstage' 'moval mbody' 'mtop mbody' 'mrest mbody' !important}" +
      "html body #page.fo-ovalgrid.fo-matchpage #fo-mstage{grid-area:mstage}" +
      "html body #page.fo-ovalgrid .fo-mst{order:-2}" +
      // the theatre's margin:0 auto turns off flex stretching on phones - the
      // column then sizes to its content and hangs off the screen edge
      "html body #page.fo-ovalgrid #fo-oval{width:100% !important;max-width:100% !important;min-width:0 !important;margin-left:0 !important;margin-right:0 !important}" +
      ".fo-mst-bg{position:absolute;inset:0;z-index:0}" +
      ".fo-mst-bg img{width:100%;height:100%;object-fit:cover;object-position:center 44%}" +
      ".fo-mst.m-region .fo-mst-bg img{filter:blur(5px) saturate(.9) brightness(.8);transform:scale(1.06)}" +
      ".fo-mst-veil{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(3,16,33,.8) 0%,rgba(3,16,33,.3) 11%,rgba(3,16,33,0) 26%,rgba(3,16,33,0) 74%,rgba(3,16,33,.3) 89%,rgba(3,16,33,.8) 100%),linear-gradient(0deg,rgba(3,15,31,.9) 0%,transparent 34%,transparent 78%,rgba(3,15,31,.3) 100%)}" +
      ".fo-mst.wx-gloom .fo-mst-veil{background:linear-gradient(90deg,rgba(3,16,33,.92) 0%,rgba(3,16,33,.5) 20%,rgba(3,16,33,.14) 45%,rgba(3,16,33,.2) 62%,rgba(3,16,33,.88) 100%),linear-gradient(0deg,rgba(3,15,31,.94) 0%,rgba(6,14,26,.2) 42%,rgba(3,15,31,.5) 100%)}" +
      ".fo-mst-rain{position:absolute;inset:-80px;z-index:2;pointer-events:none;opacity:.17;background-image:repeating-linear-gradient(108deg,transparent 0 22px,rgba(216,237,255,.7) 23px,transparent 24px 35px);background-size:48px 48px;animation:foMstRain 1.2s linear infinite;mask-image:linear-gradient(to bottom,#000,transparent 78%)}" +
      "@keyframes foMstRain{from{transform:translate3d(-20px,-30px,0)}to{transform:translate3d(18px,35px,0)}}" +
      // every forecast wears its own light: golden sun, amber heat, drifting
      // mist, streaking wind, a cold blue bite
      ".fo-mst-sun{position:absolute;inset:0;z-index:2;pointer-events:none;background:radial-gradient(85% 60% at 72% -12%,rgba(255,214,120,.34),rgba(255,190,90,.10) 45%,transparent 65%);mix-blend-mode:screen}" +
      ".fo-mst.wx-heat .fo-mst-sun{background:radial-gradient(92% 68% at 70% -10%,rgba(255,186,76,.52),rgba(255,140,50,.16) 48%,transparent 70%)}" +
      ".fo-mst-mist{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(216,226,238,.22),rgba(216,226,238,.05) 40%,rgba(206,220,232,.28) 100%);animation:foMstMist 9s ease-in-out infinite alternate}" +
      ".fo-mst.wx-humid .fo-mst-mist{opacity:.5}" +
      "@keyframes foMstMist{from{opacity:.72}to{opacity:1}}" +
      ".fo-mst-wind{position:absolute;inset:-60px;z-index:2;pointer-events:none;opacity:.10;background-image:repeating-linear-gradient(170deg,transparent 0 34px,rgba(230,240,250,.8) 35px,transparent 36px 60px);background-size:70px 70px;animation:foMstWind 1.6s linear infinite;mask-image:linear-gradient(to bottom,#000 20%,transparent 85%)}" +
      "@keyframes foMstWind{from{transform:translate3d(-40px,0,0)}to{transform:translate3d(30px,0,0)}}" +
      ".fo-mst-cold{position:absolute;inset:0;z-index:2;pointer-events:none;background:linear-gradient(180deg,rgba(140,180,220,.16),rgba(90,130,180,.10));mix-blend-mode:multiply}" +
      "@media (prefers-reduced-motion:reduce){.fo-mst-mist,.fo-mst-wind{animation:none !important}}" +
      ".fo-mst-top{position:absolute;z-index:6;top:12px;left:14px;right:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}" +
      ".fo-mst-wx{display:inline-flex;gap:2px;align-items:center;padding:5px 6px;border-radius:12px;background:rgba(5,22,43,.72);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(10px)}" +
      ".fo-mst-wx span{padding:4px 8px;color:rgba(255,255,255,.85);font-family:Oswald,sans-serif;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;white-space:nowrap}" +
      ".fo-mst-ctlg{display:inline-flex;gap:8px;align-items:center}" +
      "html body #page .fo-mst-next,html body.ftpskin #page .fo-mst-next{font-family:Oswald,sans-serif !important;font-weight:600 !important;letter-spacing:1.8px;text-transform:uppercase;font-size:12.5px;background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;color:#101B2D !important;border:none !important;border-radius:999px;padding:11px 22px;cursor:pointer;box-shadow:0 4px 0 rgba(16,27,45,.35),0 8px 22px rgba(201,162,75,.3) !important}" +
      "html body #page .fo-mst-next:hover{filter:brightness(1.06)}" +
      "html body #page .fo-mst-next:active{transform:translateY(2px);box-shadow:0 2px 0 rgba(16,27,45,.35) !important}" +
      "html body #page .fo-mst-autob,html body.ftpskin #page .fo-mst-autob{font-family:Oswald,sans-serif !important;font-weight:600 !important;letter-spacing:1.5px;text-transform:uppercase;font-size:10.5px;background:rgba(5,22,43,.72) !important;color:rgba(255,255,255,.8) !important;border:1.5px solid rgba(255,255,255,.3) !important;border-radius:999px;padding:10px 16px;cursor:pointer;backdrop-filter:blur(8px);box-shadow:none !important}" +
      "html body #page .fo-mst-autob.on,html body.ftpskin #page .fo-mst-autob.on{color:#8fe3a4 !important;border-color:rgba(143,227,164,.6) !important}" +
      // the timed prompts: a wicket asks who walks in (5s), an over-end asks
      // who bowls (3s) - then the plan continues on its own
      ".fo-mst-ask{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:rgba(4,11,22,.62);backdrop-filter:blur(3px)}" +
      ".fo-mst-ask .ask-bx{width:min(480px,92%);background:rgba(7,18,36,.94);border:1px solid rgba(240,185,78,.4);border-radius:16px;padding:16px 18px;box-shadow:0 20px 60px rgba(0,0,0,.6);color:#fff}" +
      ".fo-mst-ask .ask-bx.wide{width:min(880px,97%);max-height:96%;overflow:auto}" +
      // the choices are the cards themselves - a dealt hand of holo cards
      ".fo-mst-ask .ask-opts.cards{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:10px;align-items:flex-start}" +
      ".fo-mst-ask .askopt{position:relative;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;border-radius:12px;padding:5px 5px 7px;border:2px solid rgba(255,255,255,.16);background:rgba(255,255,255,.04);transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}" +
      ".fo-mst-ask .askopt .who{display:block;text-align:center;color:#fff;line-height:1.3;margin-top:2px}" +
      ".fo-mst-ask .askopt .who b{display:block;font-family:Oswald,sans-serif;font-weight:600;font-size:13.5px;letter-spacing:.5px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-mst-ask .askopt .who i{font-style:normal;font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;color:rgba(255,255,255,.72)}" +
      ".fo-mst-ask .askopt:hover{transform:translateY(-5px);border-color:#F3D37A;box-shadow:0 14px 34px rgba(0,0,0,.5)}" +
      ".fo-mst-ask .askopt.def{border-color:rgba(240,185,78,.6);background:rgba(240,185,78,.08)}" +
      ".fo-mst-ask .phc-tals,.fo-mst-ask .phc-meta,.fo-mst-ask .phc-ft{display:none !important}" +
      ".fo-mst-ask .cardbox{display:block;width:190px;height:250px;overflow:hidden;border-radius:9px}" +
      ".fo-mst-ask .cardscale{display:block;width:430px;transform:scale(.4418);transform-origin:top left}" +
      ".fo-mst-ask .askopt .tag{position:static;transform:none;font-family:Oswald,sans-serif;font-size:9px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:#F3D37A;white-space:nowrap}" +
      ".fo-mst-ask .askopt.def .tag{color:#8fe3a4}" +
      "@media(max-width:760px){.fo-mst-ask .cardbox{width:132px;height:175px}.fo-mst-ask .cardscale{transform:scale(.307)}.fo-mst-ask .ask-opts.cards{gap:7px}.fo-mst-ask .askopt{padding:4px 4px 6px}.fo-mst-ask .askopt .who b{font-size:12px;max-width:132px}.fo-mst-ask .ask-bx.wide{padding:12px 10px}}" +
      ".fo-mst-ask .ask-t{font-family:Oswald,sans-serif;font-weight:600;font-size:19px;letter-spacing:1.6px;text-transform:uppercase;color:#F3D37A}" +
      ".fo-mst-ask .ask-s{font-size:12.5px;color:rgba(255,255,255,.8);margin-top:3px}" +
      ".fo-mst-ask .ask-opts{display:flex;flex-direction:column;gap:7px;margin-top:12px}" +
      "html body #page .fo-mst-ask .ask-opts button,html body.ftpskin #page .fo-mst-ask .ask-opts button{display:flex;justify-content:space-between;align-items:center;gap:10px;text-align:left;font-size:13.5px;font-weight:700;color:#fff !important;background:rgba(255,255,255,.07) !important;border:1.5px solid rgba(255,255,255,.22) !important;border-radius:11px;padding:11px 14px;cursor:pointer;box-shadow:none !important}" +
      "html body #page .fo-mst-ask .ask-opts button:hover{border-color:#F3D37A !important;background:rgba(240,185,78,.12) !important}" +
      "html body #page .fo-mst-ask .ask-opts button.def{border-color:rgba(240,185,78,.55) !important;background:rgba(240,185,78,.14) !important}" +
      ".fo-mst-ask .ask-opts button i{font-style:normal;font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:1.6px;text-transform:uppercase;color:#F3D37A}" +
      ".fo-mst-ask .ask-bar{height:4px;border-radius:99px;background:rgba(255,255,255,.14);margin-top:13px;overflow:hidden}" +
      ".fo-mst-ask .ask-bar i{display:block;height:100%;background:linear-gradient(90deg,#F0B94E,#C9A24B);animation:foMstAskT linear forwards}" +
      "@keyframes foMstAskT{from{width:100%}to{width:0}}" +
      // team talk in the centre theatre
      "#fo-mst-talk{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:9px 12px;background:#0F1A2E;border-top:1px solid #24334f}" +
      "#fo-mst-talk .tl{font-family:Oswald,sans-serif;font-size:9.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8ea0c0;margin-right:4px}" +
      "html body #page #fo-mst-talk .tb,html body.ftpskin #page #fo-mst-talk .tb{font-size:11px;font-weight:700;color:#c7d2e4 !important;background:rgba(255,255,255,.06) !important;border:1.5px solid rgba(255,255,255,.18) !important;border-radius:9px;padding:7px 13px;cursor:pointer;box-shadow:none !important}" +
      "html body #page #fo-mst-talk .tb.on,html body.ftpskin #page #fo-mst-talk .tb.on{color:#101B2D !important;background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;border-color:#F3D37A !important}" +
      // the old ways retire: engine speed row, display filter, sim button and
      // the commentary-column team talk all step aside for the new controls
      "body.fo-stage-on .mc-controls .ctlrow{display:none !important}" +
      "body.fo-stage-on .mc-controls div.small{display:none !important}" +
      "body.fo-stage-on #fo-simres{display:none !important}" +
      "body.fo-stage-on .ftp-match-body .fo-teamtalk{display:none !important}" +
      ".fo-mst-score{position:absolute;z-index:6;top:58px;left:0;right:0;text-align:center;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.8);pointer-events:none}" +
      ".fo-mst-score b{display:block;font-family:Oswald,sans-serif;font-weight:600;font-size:44px;line-height:1;letter-spacing:1px}" +
      ".fo-mst-score span{display:block;font-size:12px;color:rgba(255,255,255,.85);margin-top:2px}" +
      ".fo-mst-score i{display:block;font-style:normal;font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#F3D37A;margin-top:3px}" +
      ".fo-mst-p{position:absolute;z-index:3;top:auto;bottom:70px;height:64%;width:17%;max-width:235px;display:flex;flex-direction:column;justify-content:flex-end;pointer-events:none}" +
      ".fo-mst-p.pbat{left:0}.fo-mst-p.pbowl{right:0}" +
      ".fo-mst-p img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 30%;opacity:.94;filter:saturate(.94) contrast(1.03);mask-image:linear-gradient(to bottom,#000 45%,rgba(0,0,0,.93) 72%,transparent 100%)}" +
      ".fo-mst-p.pbat img{clip-path:polygon(0 0,100% 0,82% 100%,0 100%)}" +
      ".fo-mst-p.pbowl img{clip-path:polygon(18% 0,100% 0,100% 100%,0 100%)}" +
      ".fo-mst-p::after{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(to top,rgba(5,19,38,.95),transparent 58%)}" +
      ".fo-mst-p .pc{position:relative;z-index:2;padding:0 14px 12px;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.8)}" +
      ".fo-mst-p.pbowl .pc{text-align:right}" +
      ".fo-mst-p .rl{color:#f5c85b;font-family:Oswald,sans-serif;font-size:8.5px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase}" +
      ".fo-mst-p .nm{font-family:Oswald,sans-serif;font-weight:600;font-size:16.5px;letter-spacing:.4px;line-height:1.12;margin:2px 0 2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}" +
      ".fo-mst-p .st{color:rgba(255,255,255,.88);font-size:12px;font-weight:700}" +
      ".fo-mst-p .stars{font-size:11.5px;letter-spacing:1px;line-height:1;margin-top:3px;white-space:nowrap}" +
      ".fo-mst-p .stars em{font-style:normal;color:rgba(255,255,255,.28)}" +
      ".fo-mst-p.pbat .stars em.f{color:#F0B94E}" +
      ".fo-mst-p.pbat .stars em.h{background:linear-gradient(90deg,#F0B94E 50%,rgba(255,255,255,.28) 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-mst-p.pbowl .stars em.f{color:#22D3E0}" +
      ".fo-mst-p.pbowl .stars em.h{background:linear-gradient(90deg,#22D3E0 50%,rgba(255,255,255,.28) 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-mst-p .stars .st{text-decoration:none}" +
      ".fo-mst-wx .fld{color:#FFB27A !important}" +
      ".fo-mst-moment{position:absolute;z-index:5;left:50%;top:52%;width:min(520px,46%);transform:translate(-50%,-50%);text-align:center;color:#fff;text-shadow:0 3px 20px rgba(0,0,0,.85);animation:foMstIn .38s ease-out}" +
      "@keyframes foMstIn{0%{opacity:0;transform:translate(-50%,-45%) scale(.92)}65%{opacity:1;transform:translate(-50%,-51%) scale(1.035)}100%{transform:translate(-50%,-50%) scale(1)}}" +
      ".fo-mst-moment .chip{display:inline-flex;padding:5px 11px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(7,25,48,.66);backdrop-filter:blur(8px);color:rgba(255,255,255,.85);font-family:Oswald,sans-serif;font-size:10px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase}" +
      ".fo-mst-moment .t{margin:10px 0 7px;font-family:Oswald,sans-serif;font-weight:600;font-size:clamp(48px,6.5vw,92px);line-height:.9;letter-spacing:2px;text-transform:uppercase}" +
      ".fo-mst.k-boundary .fo-mst-moment .t{color:#f9c957}" +
      ".fo-mst.k-wicket .fo-mst-moment .t{color:#ff6c61}" +
      ".fo-mst.k-dot .fo-mst-moment .t{color:#c7e4e8}" +
      ".fo-mst.k-done .fo-mst-moment .t{color:#8fe3a4}" +
      ".fo-mst-moment p{max-width:440px;margin:0 auto;color:rgba(255,255,255,.92);font-family:Georgia,serif;font-size:15px;line-height:1.45}" +
      ".fo-mst-foot{position:absolute;z-index:7;left:14px;right:14px;bottom:12px;min-height:46px;display:flex;justify-content:space-between;align-items:center;gap:14px;padding:8px 12px;border-radius:13px;background:rgba(5,20,40,.8);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(10px);color:#fff}" +
      ".fo-mst-foot .gf{font-size:11.5px;color:rgba(255,255,255,.82);line-height:1.4}" +
      ".fo-mst-foot .gf b{color:#f7c75b;font-family:Oswald,sans-serif;font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;margin-right:4px}" +
      ".fo-mst-foot .mbs{display:flex;gap:6px;align-items:center;flex:0 0 auto}" +
      ".fo-mst-foot .mb{width:27px;height:27px;display:flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);font-size:11px;font-weight:800}" +
      ".fo-mst-foot .mb.b4{color:#2f2109;background:#f3c254;border-color:#f3c254}" +
      ".fo-mst-foot .mb.bw{background:#d8504b;border-color:#d8504b}" +
      ".fo-mst-foot .mb.bx{color:#0f2036;background:#9db7d4}" +
      "body.fo-stage-on .bigflash{display:none !important}" +
      "html body #page #fo-commfull-btn,html body.ftpskin #page #fo-commfull-btn{display:block;margin:8px auto 2px;font-family:Oswald,sans-serif !important;font-weight:600 !important;font-size:10.5px;letter-spacing:1.8px;text-transform:uppercase;color:#5a6472 !important;background:transparent !important;border:1.5px solid #d8d2c5 !important;border-radius:999px;padding:8px 18px;cursor:pointer;box-shadow:none !important}" +
      "html body #page #fo-commfull-btn:hover{color:#0E233F !important;border-color:#8a7a46 !important}" +
      "#fo-commfull{position:fixed;inset:0;z-index:3000;background:rgba(7,13,24,.72);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px}" +
      "#fo-commfull .cf-bx{width:min(860px,96vw);height:min(88vh,900px);background:#FFFEFC;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,.5)}" +
      "#fo-commfull .cf-hd{display:flex;justify-content:space-between;align-items:center;background:#07162E;color:#FFFEFC;padding:12px 16px;font-family:Oswald,sans-serif;font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase}" +
      "html body #fo-commfull #fo-commfull-x{background:none !important;border:none !important;color:#FFFEFC !important;font-size:15px;cursor:pointer;box-shadow:none !important}" +
      "#fo-commfull .cf-feed{flex:1;overflow-y:auto;padding:10px 14px;font-size:13px;line-height:1.5}" +
      "#fo-commfull .cf-feed .bl{padding:7px 9px;border-bottom:1px solid #eee8dc}" +
      "#fo-commfull .cf-feed .bl.mile{background:#f4f0e6;font-weight:600}" +
      "@media (prefers-reduced-motion:reduce){.fo-mst-rain,.fo-mst-moment{animation:none !important}}" +
      // phones: every layer gets its own band - chips+buttons, score, players,
      // moment card, beads - so nothing ever prints over anything else
      "@media(max-width:760px){.fo-mst,#fo-oval .fo-mst{min-height:600px;border-radius:12px}" +
      ".fo-mst-top{flex-direction:column;align-items:flex-end;gap:6px}.fo-mst-wx{align-self:flex-start;flex-wrap:wrap;row-gap:4px}" +
      ".fo-mst-wx span{font-size:8.5px;padding:3px 6px}" +
      "html body #page .fo-mst-next{font-size:11px;padding:10px 16px}" +
      "html body #page .fo-mst-autob{font-size:9.5px;padding:9px 12px}" +
      ".fo-mst-score,#fo-oval .fo-mst-score{top:118px}" +
      ".fo-mst-score b,#fo-oval .fo-mst-score b{font-size:32px}" +
      ".fo-mst-p,#fo-oval .fo-mst-p{top:205px;bottom:auto;height:160px;width:36%}" +
      ".fo-mst-p .nm,#fo-oval .fo-mst-p .nm{font-size:12.5px}" +
      ".fo-mst-p .stars{font-size:10px;letter-spacing:.6px}" +
      ".fo-mst-p .pc{padding:0 10px 8px}" +
      // the moment becomes a readable card - a soft scrim instead of raw text
      // floating on the painting
      ".fo-mst-moment,#fo-oval .fo-mst-moment{top:auto;bottom:74px;transform:translate(-50%,0);width:94%;background:linear-gradient(180deg,rgba(7,22,44,.78),rgba(7,22,44,.62));border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:10px 12px 12px;backdrop-filter:blur(6px)}" +
      ".fo-mst-moment .t,#fo-oval .fo-mst-moment .t{font-size:28px;margin:7px 0 6px}" +
      ".fo-mst-moment p,#fo-oval .fo-mst-moment p{font-size:12.5px;max-width:none}" +
      "@keyframes foMstIn{0%{opacity:0;transform:translate(-50%,10px) scale(.94)}100%{opacity:1;transform:translate(-50%,0) scale(1)}}" +
      ".fo-mst-foot{flex-wrap:wrap;justify-content:center;min-height:0;padding:6px 10px}.fo-mst-foot .gf{display:none}" +
      // toasts ride at the top on phones while the stage is on - the bottom
      // of the screen belongs to the moment card and the over beads
      "body.fo-stage-on #fo-toasts{bottom:auto;top:66px}}";
    document.head.appendChild(msCss);
  } catch (eMc) {}
