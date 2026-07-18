/* features/career-hub — the Season Hub UI (#/summer, post-prologue).
 * One primary action per visit; everything else is tabs of dense, honest
 * information. Expressive presentation stays with scenes and finals;
 * tables stay tables.
 */
FOC.careerHub = (function () {
  var U = FOC.util, CR = FOC.career, C = FOC.competitions, SL = FOC.storylets;
  var tab = "season";
  function esc(s) { return U.esc(s); }

  function clubNm(v2, id) { return (v2.world.clubsById[id] || {}).name || "?"; }
  function clubDot(v2, id) {
    var c = v2.world.clubsById[id];
    return "<span class='cr-dot' style='background:" + ((c && (c.ac || (c.isUser && "#C8674A"))) || "#8a90a0") + "'></span>";
  }
  var BALLS = { heritage: "The 1987 ball", "new": "A new cherry", promotion: "The promotion ball" };

  function faceImg(face) {
    var art = (window.__foGame && window.__foGame.art) || "client/art/";
    if (!face) face = "gaffer";
    if (face.indexOf("npc:") === 0) return "<span class='sm-mono'>" + esc(face.split(":")[1] || "?") + "</span>";
    if (face.indexOf("player:") === 0) return "<img class='sm-face' src='" + art + (face.split(":")[1] || "bat") + ".png' alt=''>";
    return "<img class='sm-face' src='" + art + face + ".png' alt=''>";
  }

  function sceneHTML(sc) {
    var h = "<div class='sm-scene'>" + faceImg(sc.face) +
      "<div class='sm-bx'><div class='sm-sp'>" + esc(sc.sp) + "</div><div class='sm-tx'>" + esc(sc.tx) + "</div>";
    if (sc.choices) h += "<div class='sm-choices'>" + sc.choices.map(function (c, i) {
      return "<button class='sm-ch' data-ch='" + i + "'>" + esc(c.t) + "</button>";
    }).join("") + "</div>";
    else h += "<div class='sm-choices'><button class='sm-ch sm-cont' data-ch='-1'>Continue ▸</button></div>";
    return h + "</div></div>";
  }

  function briefHTML(v2) {
    var news = (v2.world.news || []).slice(0, 2).map(function (n) { return esc(n.text); });
    var uf = C.userFixture(v2, v2.week);
    var prom = v2.story.promises.filter(function (p) { return p.status === "active"; })[0];
    var bits = [];
    if (news.length) bits.push(news.join(" "));
    if (prom) bits.push("Live promise: " + esc(prom.txt) + " — " + prom.left + " match" + (prom.left === 1 ? "" : "es") + " left.");
    if (uf && uf.status !== "played") bits.push("Next: " + esc(clubNm(v2, uf.homeId === v2.user.clubId ? uf.awayId : uf.homeId)) + " (" + esc(FOC.calendar.week(v2.week).label) + ").");
    if (!bits.length) bits.push("A quiet week. They exist, whatever the Argus implies.");
    return "<div class='sm-scene'>" + faceImg("gaffer") +
      "<div class='sm-bx'><div class='sm-sp'>The Gaffer — while you were away</div><div class='sm-tx'>" + bits.join(" ") + "</div></div></div>";
  }

  function ctaHTML(v2) {
    var uf = C.userFixture(v2, v2.week);
    var wk = FOC.calendar.week(v2.week);
    if (!wk) return "";
    var live = false, saved = false;
    try { live = !!(App.pending && App.pending.__career); saved = !!(App.orders && App.orders.saved); } catch (e) {}
    if (uf && uf.status !== "played") {
      var oppId = uf.homeId === v2.user.clubId ? uf.awayId : uf.homeId;
      var host = v2.world.clubsById[uf.homeId];
      return "<div class='sm-tie'><div class='sm-tie-k'>" + esc(wk.label) + (uf.neutral ? " · neutral ground" : "") + "</div>" +
        "<div class='sm-tie-nm'>" + esc(clubNm(v2, oppId)) + "</div>" +
        "<div class='sm-tie-c'>" + esc(host.ground) + " · " + esc(host.pitch) + " pitch" + (uf.weather ? " · forecast " + esc(uf.weather) : "") + "</div>" +
        (live && saved ? "<button class='sm-go' id='cr-walk'>Walk out ▸</button>"
          : live ? "<button class='sm-go' id='cr-lineup'>Pick your XI ▸</button>"
          : "<button class='sm-go' id='cr-play'>Play the fixture ▸</button>") + "</div>";
    }
    return "<div class='sm-tie'><div class='sm-tie-k'>" + esc(wk.label) + "</div>" +
      "<div class='sm-tie-nm'>" + (uf ? "Your result is in" : "No fixture for you") + "</div>" +
      "<div class='sm-tie-c'>" + (uf ? "The rest of the round plays out when you advance." : "Cup week — you're not in this stage. The world plays on without you.") + "</div>" +
      "<button class='sm-go' id='cr-advance'>Advance the week ▸</button></div>";
  }

  function tableHTML(v2) {
    var rows = C.table(v2);
    var h = "<table class='cr-tbl'><tr><th></th><th style='text-align:left'>Club</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>NRR</th></tr>";
    rows.forEach(function (r, i) {
      var c = v2.world.clubsById[r.clubId];
      h += "<tr class='" + (c.isUser ? "me" : "") + (i === 3 ? " crownline" : "") + "'><td>" + (i + 1) + "</td><td style='text-align:left'>" + clubDot(v2, r.clubId) + esc(c.name) +
        "</td><td>" + r.p + "</td><td>" + r.w + "</td><td>" + r.l + "</td><td>" + r.t + "</td><td><b>" + r.pts + "</b></td><td>" +
        (r.nrr >= 0 ? "+" : "") + r.nrr.toFixed(2) + "</td></tr>";
    });
    h += "</table><div class='cr-note'>— everything above this line qualifies for the Crown Cup —</div>";
    // season leaders: real aggregates from real scorecards
    var runs = [], wkts = [];
    for (var pid in v2.world.playersById) {
      var p = v2.world.playersById[pid];
      if (p.seasonRuns) runs.push({ nm: p.name, club: clubNm(v2, p.clubId), v: p.seasonRuns });
      if (p.seasonWickets) wkts.push({ nm: p.name, club: clubNm(v2, p.clubId), v: p.seasonWickets });
    }
    (v2.flags.userFactsHist || []).forEach(function (f) {
      (f.batLines || []).forEach(function (b) {
        var hit = runs.filter(function (x) { return x.nm === b.nm && x.mine; })[0];
        if (hit) hit.v += b.r; else runs.push({ nm: b.nm, club: (A0() || {}).name || "you", v: b.r, mine: 1 });
      });
      (f.bowlLines || []).forEach(function (b) {
        var hit = wkts.filter(function (x) { return x.nm === b.nm && x.mine; })[0];
        if (hit) hit.v += b.w; else wkts.push({ nm: b.nm, club: (A0() || {}).name || "you", v: b.w, mine: 1 });
      });
    });
    runs.sort(function (a, b) { return b.v - a.v; }); wkts.sort(function (a, b) { return b.v - a.v; });
    if (runs.length || wkts.length) {
      h += "<div class='cr-sec'>Season leaders</div>";
      runs.slice(0, 3).forEach(function (x) { h += "<div class='cr-line'>&#127951; " + esc(x.nm) + " (" + esc(x.club) + ") — " + x.v + " runs</div>"; });
      wkts.slice(0, 3).forEach(function (x) { h += "<div class='cr-line'>&#9918; " + esc(x.nm) + " (" + esc(x.club) + ") — " + x.v + " wickets</div>"; });
    }
    return h;
  }

  function bracketCol(v2, title, pairs) {
    if (!pairs || !pairs.length) return "";
    var h = "<div class='cr-bkcol'><div class='cr-bkt'>" + esc(title) + "</div>";
    pairs.forEach(function (pr) {
      h += "<div class='cr-bkpair'>" + pr.map(function (id) {
        return "<div class='cr-bkteam'>" + clubDot(v2, id) + esc(clubNm(v2, id)) + "</div>";
      }).join("") + "</div>";
    });
    return h + "</div>";
  }
  function cupsHTML(v2) {
    var f = v2.world.competitionsById.founders, cr = v2.world.competitionsById.crown;
    var h = "<div class='cr-sec'>Founders Cup — " + esc(f ? f.stage : "?") + "</div>";
    if (f) {
      h += "<div class='cr-bracket'>" +
        bracketCol(v2, "Play-in", f.playin) +
        bracketCol(v2, "Quarter-finals", f.bracket.qf) +
        bracketCol(v2, "Semi-finals", f.bracket.sf) +
        bracketCol(v2, "Final · neutral ground", f.bracket.final ? [f.bracket.final] : null) +
        "</div>";
      if (f.winner) h += "<div class='cr-line'>🏆 " + esc(clubNm(v2, f.winner)) + " — champions</div>";
      h += "<div class='cr-line'>Out: " + (f.out.length ? f.out.map(function (id) { return esc(clubNm(v2, id)); }).join(", ") : "nobody yet") + "</div>";
      if (f.out.indexOf(v2.user.clubId) >= 0) h += "<div class='cr-line'><b>Your cup is over for this edition — the league remains.</b></div>";
    }
    h += "<div class='cr-sec'>Crown Cup — " + esc(cr ? cr.stage : "?") + "</div>";
    if (cr) {
      h += "<div class='cr-line'>" + esc(cr.note || "") + "</div>";
      h += "<div class='cr-bracket'>" +
        bracketCol(v2, "Semi-finals", cr.bracket.sf) +
        bracketCol(v2, "Final · neutral ground", cr.bracket.final ? [cr.bracket.final] : null) + "</div>";
      if (cr.winner) h += "<div class='cr-line'>🏆 " + esc(clubNm(v2, cr.winner)) + " — champions</div>";
    }
    return h;
  }

  function worldHTML(v2) {
    var h = "<div class='cr-sec'>Clubs and managers</div>";
    Object.keys(v2.world.clubsById).forEach(function (cid) {
      var c = v2.world.clubsById[cid];
      var m = c.managerId && v2.world.managersById[c.managerId];
      h += "<div class='cr-line'><b>" + esc(c.name) + "</b> — " + (m ? esc(m.name) : "no manager") +
        " · form " + esc((c.form || []).slice(-5).join("") || "—") +
        " · " + esc(c.tendency) + (c.isUser ? " · <b>you</b>" : "") + "</div>";
    });
    var tr = (v2.world.transfers || []).slice(-8).reverse();
    if (tr.length) {
      h += "<div class='cr-sec'>Recent transfers</div>";
      tr.forEach(function (d) {
        h += "<div class='cr-line'>" + esc(d.playerName) + ": " + esc(d.fromName) + " → " + esc(d.toName) + " (" + Math.round(d.fee / 1000) + "k, S" + d.season + "W" + d.week + ")</div>";
      });
    }
    return h;
  }

  function rivalHTML(v2) {
    var all = [];
    for (var k in v2.rivalries.clubs) { if (v2.rivalries.clubs[k].level > 0 || v2.rivalries.clubs[k].games > 0) all.push(v2.rivalries.clubs[k]); }
    all.sort(function (a, b) { return FOC.rivalry.score(b) - FOC.rivalry.score(a); });
    if (!all.length) return "<div class='cr-line'>No history yet. Rivalries are earned here, not declared.</div>";
    var h = "";
    all.slice(0, 10).forEach(function (e) {
      h += "<div class='cr-line'><b>" + esc(clubNm(v2, e.a)) + " v " + esc(clubNm(v2, e.b)) + "</b> — " +
        esc(FOC.rivalry.LEVELS[e.level]) + " · " + e.games + " meetings (" + e.aWins + "–" + e.bWins + ")" +
        (e.close ? " · " + e.close + " close" : "") + (e.cupKOs.length ? " · " + e.cupKOs.length + " cup KO" : "") +
        (e.transfers ? " · " + e.transfers + " transfer" + (e.transfers > 1 ? "s" : "") : "") + "</div>";
    });
    return h;
  }

  function historyHTML(v2) {
    var h = "<div class='cr-sec'>Trophies</div>";
    h += (v2.history.trophies || []).length
      ? v2.history.trophies.map(function (t) { return "<div class='cr-line'>🏆 " + esc(t.note || t.kind) + "</div>"; }).join("")
      : "<div class='cr-line'>The cabinet is honest about itself.</div>";
    h += "<div class='cr-sec'>Departures</div>";
    h += (v2.history.departures || []).length
      ? v2.history.departures.slice(-8).reverse().map(function (d) {
          return "<div class='cr-line'>" + esc(d.playerName) + " → " + esc(d.toName) + " (S" + d.season + ", " + Math.round((d.fee || 0) / 1000) + "k)</div>";
        }).join("")
      : "<div class='cr-line'>Nobody has left. Yet.</div>";
    h += "<div class='cr-sec'>Milestones</div>";
    h += (v2.history.milestones || []).slice(-10).reverse().map(function (m) { return "<div class='cr-line'>" + esc(m.note || m.kind) + "</div>"; }).join("") || "<div class='cr-line'>—</div>";
    if ((v2.history.seasonArchives || []).length) {
      h += "<div class='cr-sec'>Season archives</div>";
      v2.history.seasonArchives.forEach(function (a) {
        h += "<div class='cr-line'>Season " + a.season + ": " + (a.table && a.table[0] ? esc(clubNm(v2, a.table[0].clubId)) + " champions" : "") + "</div>";
      });
    }
    return h;
  }

  function settingsHTML(v2) {
    return "<div class='cr-sec'>World seed</div>" +
      "<div class='cr-line'>Seed: <code id='cr-seed'>" + esc(v2.worldSeed) + "</code> — share it and a friend starts the same world; your decisions will still diverge.</div>" +
      "<div class='cr-sec'>Export / import</div>" +
      "<textarea id='cr-io' class='cr-io' rows='3' placeholder='Paste a career export here to import.'></textarea>" +
      "<div style='display:flex;gap:8px;margin-top:6px'>" +
      "<button class='sm-ch' id='cr-export' style='flex:0'>Export</button>" +
      "<button class='sm-ch' id='cr-import' style='flex:0'>Import</button>" +
      "<button class='sm-ch' id='cr-reset' style='flex:0'>Reset career (archives first)</button></div>";
  }

  function outcomeHTML(v2) {
    var o = v2.flags.seasonOutcome; if (!o) return "";
    var h = "<div class='sm-tie'><div class='sm-tie-k'>Season " + v2.seasonNumber + " · the reckoning</div>" +
      "<div class='sm-tie-nm'>" + esc(o.kind === "champions" ? "Champions" : o.kind === "dismissed" || o.kind === "insolvent" ? "The board decides" : "Season complete") + "</div>" +
      "<div class='sm-tie-c'>" + esc(o.txt) + "</div>";
    if (v2.user.employment === "dismissed") {
      h += "<button class='sm-go' id='cr-caretaker'>Take the final-warning season ▸</button>" +
        "<div><button class='sm-skip' id='cr-endcareer'>End the career — view the record</button></div>";
    } else {
      h += "<button class='sm-go' id='cr-next'>Begin season " + (v2.seasonNumber + 1) + " ▸</button>";
    }
    return h + "</div>";
  }

  var TABS = [["season", "Season"], ["table", "Table"], ["cups", "Cups"], ["world", "World"], ["rivals", "Rivalries"], ["history", "History"], ["settings", "Seed & Save"]];

  function render(force) {
    try {
      if (location.hash.indexOf("#/summer") !== 0) return;
      if (!CR.active()) return;                      // prologue still owns the screen
      var page = document.getElementById("page"); if (!page) return;
      var v2 = CR.career();
      var scene = SL.nextScene(v2, CR.api(v2));
      var sig = JSON.stringify([v2.week, v2.seasonNumber, tab, v2.story.pending.length, !!scene,
        (v2.world.news[0] || {}).text, v2.flags.seasonClosed || 0,
        (function () { try { return !!(App.pending && App.pending.__career) && !!(App.orders && App.orders.saved); } catch (e) { return 0; } })()]);
      if (!force && page.__crSig === sig && page.querySelector(".fo-cr")) return;
      page.__crSig = sig;
      var h = "<div class='fo-sm fo-cr'>";
      var ball = (v2.user.matchBall && BALLS[v2.user.matchBall]) ? " · <span title='Your chosen match ball travels with the club'>&#9899; " + esc(BALLS[v2.user.matchBall]) + "</span>" : "";
      h += "<div class='sm-head'><div class='sm-kick'>" + esc((A0() || {}).name || "") + " · Season " + v2.seasonNumber + ball + "</div>" +
        "<h2 class='sm-h1'>" + esc(FOC.calendar.week(v2.week) ? FOC.calendar.label(v2.week) : "Season " + v2.seasonNumber + " — closed") + "</h2></div>";
      h += "<div class='cr-tabs'>" + TABS.map(function (t) {
        return "<button class='cr-tab" + (tab === t[0] ? " on" : "") + "' data-tab='" + t[0] + "'>" + t[1] + "</button>";
      }).join("") + "</div>";
      if (tab === "season") {
        if (v2.flags.seasonClosed) h += outcomeHTML(v2);
        else if (scene) h += sceneHTML(scene.scene);
        else { h += briefHTML(v2); h += ctaHTML(v2); }
      }
      else if (tab === "table") h += "<div style='overflow-x:auto'>" + tableHTML(v2) + "</div>";
      else if (tab === "cups") h += cupsHTML(v2);
      else if (tab === "world") h += worldHTML(v2);
      else if (tab === "rivals") h += rivalHTML(v2);
      else if (tab === "history") h += historyHTML(v2);
      else if (tab === "settings") h += settingsHTML(v2);
      h += "</div>";
      page.innerHTML = h;
      wire(page, v2, scene);
    } catch (e) {}
  }
  function A0() { try { return userTeam(); } catch (e) { return null; } }

  function wire(page, v2, scene) {
    page.querySelectorAll(".cr-tab").forEach(function (b) {
      b.addEventListener("click", function () { tab = b.getAttribute("data-tab"); render(true); });
    });
    page.querySelectorAll(".sm-ch[data-ch]").forEach(function (b) {
      b.addEventListener("click", function () {
        var i = +b.getAttribute("data-ch");
        if (scene && scene.scene.choices && scene.scene.choices[i]) {
          try { scene.scene.choices[i].fx(v2, CR.api(v2)); } catch (e) {}
        }
        SL.popScene(v2); CR.persist(); render(true);
      });
    });
    var play = page.querySelector("#cr-play");
    if (play) play.addEventListener("click", function () { CR.startUserFixture(); });
    var lu = page.querySelector("#cr-lineup");
    if (lu) lu.addEventListener("click", function () { location.hash = "#/lineup"; if (window.route) window.route(); });
    var wk2 = page.querySelector("#cr-walk");
    if (wk2) wk2.addEventListener("click", function () { location.hash = "#/match"; if (window.route) window.route(); });
    var adv = page.querySelector("#cr-advance");
    if (adv) adv.addEventListener("click", function () { CR.advanceWeek(); render(true); });
    var nx = page.querySelector("#cr-next");
    if (nx) nx.addEventListener("click", function () { CR.continueNextSeason(false); render(true); });
    var ct = page.querySelector("#cr-caretaker");
    if (ct) ct.addEventListener("click", function () { CR.continueNextSeason(true); render(true); });
    var ec = page.querySelector("#cr-endcareer");
    if (ec) ec.addEventListener("click", function () { tab = "history"; render(true); });
    var ex = page.querySelector("#cr-export");
    if (ex) ex.addEventListener("click", function () {
      var ta = page.querySelector("#cr-io"); if (ta) { ta.value = FOC.save2.exportCareer(v2); ta.select(); }
    });
    var im = page.querySelector("#cr-import");
    if (im) im.addEventListener("click", function () {
      var ta = page.querySelector("#cr-io"); if (!ta || !ta.value.trim()) return;
      try { FOC.save2.importCareer(CR.scope(), ta.value.trim()); FOC.career._reset(); render(true); }
      catch (e) { ta.value = "Import failed: " + e.message; }
    });
    var rs = page.querySelector("#cr-reset");
    if (rs) rs.addEventListener("click", function () {
      if (!window.confirm("Reset the career? The current one is archived, never deleted.")) return;
      FOC.save2.reset(CR.scope()); FOC.career._reset(); render(true);
    });
  }

  function css() {
    if (document.getElementById("fo-cr-css")) return;
    var st = document.createElement("style"); st.id = "fo-cr-css";
    st.textContent =
      ".cr-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:6px 0 12px}" +
      "html body #page .cr-tab{border:1px solid #d8d0b8;background:#F6F1E3;border-radius:99px;padding:6px 12px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5b6472;min-height:34px}" +
      "html body #page .cr-tab.on{background:#14213D;color:#F1EADA;border-color:#14213D}" +
      ".cr-tbl{width:100%;border-collapse:collapse;font-size:13px;background:#FDFBF4;border:1px solid #e3dcc6;border-radius:10px}" +
      ".cr-tbl th{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:#8a90a0;padding:7px 6px;border-bottom:1px solid #e3dcc6}" +
      ".cr-tbl td{padding:6px;text-align:center;border-bottom:1px dashed #efe9d8;color:#2a3140;font-variant-numeric:tabular-nums}" +
      ".cr-tbl tr.me td{background:#EFF5EC;font-weight:600}" +
      ".cr-sec{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9A24B;margin:14px 0 5px}" +
      ".cr-line{font-size:13.5px;color:#2a3140;padding:3px 0;border-bottom:1px dashed #efe9d8}" +
      ".cr-io{width:100%;box-sizing:border-box;border:1px solid #d8d0b8;border-radius:8px;padding:7px;font-size:11px;font-family:monospace}" +
      ".cr-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:baseline}" +
      ".cr-tbl tr.crownline td{border-bottom:2px solid #C9A24B}" +
      ".cr-note{font-size:11px;color:#B08D2E;text-align:center;margin:4px 0 8px;font-style:italic}" +
      ".cr-bracket{display:flex;gap:14px;overflow-x:auto;padding:6px 0;align-items:center}" +
      ".cr-bkcol{flex:0 0 auto;min-width:150px}" +
      ".cr-bkt{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#8a90a0;margin-bottom:4px}" +
      ".cr-bkpair{border:1px solid #e3dcc6;border-radius:8px;background:#fff;margin:5px 0;overflow:hidden}" +
      ".cr-bkteam{padding:5px 8px;font-size:12.5px;color:#2a3140;border-bottom:1px dashed #efe9d8}" +
      ".cr-bkpair .cr-bkteam:last-child{border-bottom:none}" +
      ".fo-cr .sm-face,.fo-cr .sm-mono{width:88px;height:88px;flex:0 0 88px;font-size:26px}" +
      ".fo-cr button:focus-visible{outline:3px solid #C9A24B;outline-offset:1px}";
    document.head.appendChild(st);
  }

  function init() {
    if (typeof window === "undefined") return;
    css();
    CR.startKeeper();
    window.addEventListener("hashchange", function () {
      if (location.hash.indexOf("#/summer") === 0) setTimeout(function () { render(true); }, 30);
    });
    setInterval(function () {
      // the career begins the moment the prologue hands over
      try { if (CR.prologueDone() && !CR.career()) CR.begin(); } catch (e) {}
      render(false);
    }, 1000);
  }

  return { init: init, render: render };
})();
