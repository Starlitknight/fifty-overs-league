  // =========================================================================
  // ORDERS, REBUILT. A batting list (arrows + C/WK chips - duplicates are
  // impossible) and a paint-the-overs bowling board: pick a bowler as the
  // brush, tap overs to paint his spells - any shape, any length. Everything
  // compiles into the engine's own grid/spells model, so the resolver and
  // the AI captain see exactly what they always saw. Sub-panels re-render
  // in place - no page rebuilds.
  // =========================================================================
  var FO_ORD_COLS = ["#2d6a8f", "#a33328", "#1c5537", "#c08a2b", "#6a4a8f", "#0E6E6A", "#8f5a2d"];
  try {
    // (set-XI honoring — ordersMap / saved user XI — now lives in the
    // engine's pickXI itself)
  } catch (e) {}
  // the chosen XI as player objects; heals itself if names went stale
  function foOrdXI() {
    var t = userTeam();
    var by = {}; (t.players || []).forEach(function (p) { by[p.name] = p; });
    var names = (App.orders.xi || []).filter(function (nm) { return by[nm]; });
    if (names.length !== 11 || names.filter(function (nm) { return by[nm].bowlType; }).length < 5) {
      names = pickXI(t).map(function (p) { return p.name; });
      App.orders.xi = names;
    } else App.orders.xi = names;
    return names.map(function (nm) { return by[nm]; });
  }
  function foOrdTotals() {
    var g = App.orders.grid || [], tot = {};
    for (var o = 1; o <= 50; o++) if (g[o]) tot[g[o]] = (tot[g[o]] || 0) + 1;
    return tot;
  }
  function foOrdSurname(nm) { var b = String(nm || "").split(" "); return b.length > 1 ? b.slice(1).join(" ") : nm; }
  function foOrdPool(withPT) {
    var xi = foOrdXI();
    var pool = xi.filter(function (p) { return p.bowlType; })
      .sort(function (a, b) { return (isPT(a) - isPT(b)) || (aggBowl(b) - aggBowl(a)); });
    return withPT ? pool : pool.filter(function (p) { return !isPT(p); });
  }
  function foOrdColors() {
    var map = {};
    foOrdPool(true).forEach(function (p, i) { map[p.name] = FO_ORD_COLS[i % FO_ORD_COLS.length]; });
    return map;
  }
  // ---- WHAT EACH MAN IS TOLD -------------------------------------------------
  // The phase plan is the innings; a man's own instruction is his licence
  // within it. Defend/Normal/Attack/Launch shift the plan by -1/0/+1/+2 when
  // he is on strike, and the engine reads it from the saved sheet - so the
  // umpire plays your instruction whether you watch or not.
  var MB_W = [["-1", "D", "Defend", "d"], ["0", "N", "Normal", ""], ["1", "A", "Attack", "a"], ["2", "L", "Launch", "l"]];
  function foMbVal(nm) {
    var m = App.orders && App.orders.manBat; if (!m) return 0;
    var v = +m[nm]; return isFinite(v) ? Math.max(-1, Math.min(2, v)) : 0;
  }
  function foMbRow(nm) { var v = foMbVal(nm); return MB_W.filter(function (x) { return +x[0] === v; })[0] || MB_W[1]; }
  function foMbLetter(nm) { return foMbRow(nm)[1]; }
  function foMbCls(nm) { var c = foMbRow(nm)[3]; return c ? "mb-" + c : ""; }
  function foMbTitle(nm) {
    var w = foMbRow(nm)[2];
    return w + " - tap to change how " + foOrdSurname(nm) + " bats within the plan";
  }
  function foMbCycle(nm) {
    if (!App.orders.manBat) App.orders.manBat = {};
    var v = foMbVal(nm), ix = 0;
    MB_W.forEach(function (x, i) { if (+x[0] === v) ix = i; });
    var nv = +MB_W[(ix + 1) % MB_W.length][0];
    if (nv === 0) delete App.orders.manBat[nm]; else App.orders.manBat[nm] = nv;
  }
  // a bowler's own field: how HE is set when he has the ball
  var MF_W = [["", "Plan"], ["att", "Attack"], ["bal", "Balanced"], ["def", "Defend"]];
  function foMfVal(nm) {
    var m = App.orders && App.orders.manBowl; var v = m ? m[nm] : "";
    return (v === "att" || v === "bal" || v === "def") ? v : "";
  }
  function foMfSet(nm, v) {
    if (!App.orders.manBowl) App.orders.manBowl = {};
    if (!v) delete App.orders.manBowl[nm]; else App.orders.manBowl[nm] = v;
  }
  function foMfShort(nm) {
    var v = foMfVal(nm);
    return v === "att" ? "Att" : v === "def" ? "Def" : v === "bal" ? "Bal" : "Plan";
  }
  function foMfTitle(nm) {
    var v = foMfVal(nm);
    return (v === "att" ? "Attacking field" : v === "def" ? "Defensive field" : v === "bal" ? "Balanced field" : "Follows the phase plan") +
      " - tap to change how " + foOrdSurname(nm) + " is set";
  }
  function foMfCycle(nm) {
    var order = ["", "att", "bal", "def"], v = foMfVal(nm);
    foMfSet(nm, order[(order.indexOf(v) + 1) % order.length]);
  }
  // ONE PLACE UP OR DOWN THE ORDER.
  // Only inside the XI: the eleventh man cannot be nudged onto the bench by an
  // arrow, because dropping a man from the side has consequences (his overs,
  // the gloves, the armband) that belong to the bench swap, not to this.
  // The scroll position is held across the redraw - a manager moving a man
  // from eight to three taps five times, and the list must not jump under him.
  function foOrdMove(nm, step) {
    try {
      var bo = (App.orders && App.orders.batOrder) || [];
      var last = Math.min(10, bo.length - 1);
      var from = bo.indexOf(nm), to = from + step;
      if (from < 0 || from > last || to < 0 || to > last) return;
      bo.splice(from, 1);
      bo.splice(to, 0, nm);
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      foOrdersUI();
      try { window.scrollTo(0, y); } catch (e2) {}
    } catch (e) {}
  }
  function foOrdFieldRows() {
    var tot = foOrdTotals();
    var pool = foOrdPool(true).filter(function (p) { return (tot[p.name] || 0) > 0; });
    if (!pool.length) return "";
    return "<div class='fo-og-fh'>How they are set</div><div class='fo-og-fields'>" + pool.map(function (p) {
      var cur = foMfVal(p.name);
      return "<div class='fo-og-frow'><b>" + E(foOrdSurname(p.name)) + "</b><span>" +
        MF_W.map(function (x) {
          return "<button class='fo-og-f" + (cur === x[0] ? " on" : "") + "' data-fo-mf='" + E(p.name) + "' data-fo-mfv='" + x[0] + "'>" + x[1] + "</button>";
        }).join("") + "</span></div>";
    }).join("") + "</div>";
  }

  function foOrdBatRows() {
    var t = userTeam(), xi = foOrdXI();
    var byName = {}; xi.forEach(function (p) { byName[p.name] = p; });
    // batting order = a permutation of the XI, always: drop strangers, add missing
    App.orders.batOrder = (App.orders.batOrder || []).filter(function (n) { return byName[n]; });
    xi.forEach(function (p) { if (App.orders.batOrder.indexOf(p.name) < 0) App.orders.batOrder.push(p.name); });
    return App.orders.batOrder.slice(0, 11).map(function (nm, i) {
      var p = byName[nm] || {};
      var isC = App.orders.captain === nm, isW = App.orders.keeper === nm;
      var bv = Math.round(aggBat(p) || 0);
      var bc = bv >= 70 ? "#16A34A" : bv >= 50 ? "#4DA6A2" : bv >= 30 ? "#c08a2b" : "#b3402a";
      var tals = (p.talents || []).slice(0, 2).map(function (t2) { return "<span class='fo-sq-talent' title='" + E((typeof TALTIPS !== "undefined" && TALTIPS[t2]) || "") + "'>" + E(typeof ptal === "function" ? ptal(t2) : t2) + "</span>"; }).join("");
      return "<div class='fo-ob-row'>" +
        "<span class='fo-ob-n" + (i < 3 ? " top" : "") + "'>" + (i + 1) + "</span>" +
        "<div class='fo-ob-who'><b>" + E(nm) + (p.keeper ? " <s title='wicketkeeper'>&dagger;</s>" : "") + tals + "</b><span class='small'>" + E(prole(p.role || "")) + " · bat <b style='color:" + bc + "'>" + bv + "</b>" + (p.bowlType ? " · " + E(shortBT(p)) : "") + "</span></div>" +
        "<button class='fo-ob-chip fo-ob-mb " + foMbCls(nm) + "' data-fo-mb='" + E(nm) + "' title='" + E(foMbTitle(nm)) + "'>" + foMbLetter(nm) + "</button>" +
        "<button class='fo-ob-chip" + (isC ? " on" : "") + "' data-fo-capt='" + E(nm) + "' title='captain'>C</button>" +
        "<button class='fo-ob-chip" + (isW ? " on" : "") + "' data-fo-wk='" + E(nm) + "' title='wicketkeeper'>WK</button>" +
        "<span class='fo-ob-mv'><button data-fo-up='" + i + "' " + (i === 0 ? "disabled" : "") + ">&#9650;</button><button data-fo-dn='" + i + "' " + (i === 10 ? "disabled" : "") + ">&#9660;</button><button class='fo-ob-swap' data-fo-swap='" + E(nm) + "' title='swap with a bench player'>&#8644;</button></span>" +
        "</div>";
    }).join("");
  }
  function foOrdBowlBody() {
    var v = compilePlan();
    var tot = foOrdTotals(), colors = foOrdColors();
    var pool = foOrdPool(true);   // every XI player who can bowl, part-timers included
    if (!window.__foOrdBrush || !pool.some(function (p) { return p.name === window.__foOrdBrush; }))
      window.__foOrdBrush = pool[0] ? pool[0].name : "";
    var chips = pool.map(function (p) {
      var on = window.__foOrdBrush === p.name;
      var bw = Math.round(aggBowl(p) || 0);
      var bwc = bw >= 70 ? "#16A34A" : bw >= 50 ? "#4DA6A2" : bw >= 30 ? "#c08a2b" : "#b3402a";
      var tal = (p.talents || [])[0];
      var talTxt = tal ? " · " + E(typeof ptal === "function" ? ptal(tal) : tal) : "";
      var titleT = (p.talents || []).map(function (t2) { return (typeof ptal === "function" ? ptal(t2) : t2); }).join(", ");
      return "<button class='fo-og-b" + (on ? " on" : "") + "' data-fo-brush='" + E(p.name) + "' title='" + E(p.name) + " · " + E(shortBT(p)) + " · bowl " + bw + (titleT ? " · " + E(titleT) : "") + "'>" +
        "<em style='background:" + (colors[p.name] || "#888") + "'></em>" +
        "<span class='fo-og-bt'><b>" + E(foOrdSurname(p.name)) + (isPT(p) ? " <s>pt</s>" : "") + "</b><i>" + E(shortBT(p)) + " · <n style='color:" + (on ? "#c7cfda" : bwc) + "'>" + bw + "</n>" + talTxt + "</i></span>" +
        "<u>" + (tot[p.name] || 0) + "</u></button>";
    }).join("") +
      "<button class='fo-og-b fo-og-clear' data-fo-clearall title='wipe the whole plan'>&#8709; Clear all</button>";

    var g = App.orders.grid || [], rows = "";
    for (var r0 = 0; r0 < 5; r0++) {
      var cells2 = "";
      for (var c0 = 1; c0 <= 10; c0++) {
        var o = r0 * 10 + c0, nm = g[o];
        cells2 += "<button class='fo-og-c' data-fo-cell='" + o + "' title='over " + o + (nm ? " · " + E(nm) : " · AI decides") + "' style='" + (nm ? "background:" + (colors[nm] || "#888") + " !important;color:#FFFEFC !important;border-color:transparent !important" : "") + "'>" + o + "</button>";
      }
      var hint = r0 === 0 ? "powerplay" : r0 === 4 ? "death" : "";
      rows += "<div class='fo-og-row'><span class='fo-og-l'>" + (r0 * 10 + 1) + "&ndash;" + (r0 * 10 + 10) + (hint ? "<i>" + hint + "</i>" : "") + "</span>" + cells2 + "</div>";
    }
    var tchips = Object.keys(tot).map(function (nm) {
      var over = tot[nm] > 10;
      return "<span class='fo-os-tchip" + (over ? " bad" : "") + "'><i style='background:" + (colors[nm] || "#888") + "'></i>" + E(foOrdSurname(nm)) + " " + tot[nm] + "/10</span>";
    }).join("");
    var covered = v.covered || 0;
    var bad = (v.warns || []).filter(function (w) { return /double-booked|consecutive|max 10|not a/.test(w); });
    return "<div class='fo-og-pal'>" + chips + "</div>" + rows + foOrdFieldRows() +
      "<div class='fo-os-tot'>" + tchips + "<span class='fo-os-cov'>" + covered + "/50 overs planned" + (covered < 50 ? " · the AI captain covers the rest" : "") + "</span></div>" +
      (bad.length ? "<div class='fo-os-warn'>&#9888; " + bad.map(E).join(" · ") + "</div>" : "");
  }
  function foOrdBenchSheet(outNm) {
    var old = document.getElementById("fo-osheet"); if (old) old.remove();
    var t = userTeam(), xi = foOrdXI();
    var by = {}; xi.forEach(function (p) { by[p.name] = p; });
    var out = by[outNm]; if (!out) return;
    var bowlersLeft = xi.filter(function (p) { return p.bowlType && p.name !== outNm; }).length;
    var bench = (t.players || []).filter(function (p) { return !by[p.name]; });
    var rows = bench.map(function (p) {
      var ok = (bowlersLeft + (p.bowlType ? 1 : 0)) >= 5;
      var bits = [E(prole(p.role || "")), "bat " + Math.round(aggBat(p) || 0)];
      if (p.bowlType) bits.push(E(shortBT(p)) + " " + Math.round(aggBowl(p) || 0));
      if (p.keeper) bits.push("keeper");
      var tals = (p.talents || []).map(function (t2) { return (typeof ptal === "function" ? ptal(t2) : t2); }).join(", ");
      // his stars, the same language as the cards he'd be joining: gold with
      // the bat for every man, teal with the ball where he bowls
      var sts = "<span class='osh-sts'><span class='osh-st bat'>" + foOrdStarHTML(foOrdStars(foOrdBatComp(p))) + "</span>" +
        (p.bowlType && p.bowlType !== "none" ? "<span class='osh-st bwl'>" + foOrdStarHTML(foOrdStars(foOrdBowlComp(p))) + "</span>" : "") + "</span>";
      return "<button class='fo-osh-row' data-fo-bench='" + E(p.name) + "' " + (ok ? "" : "disabled") + ">" +
        "<div><b>" + E(p.name) + "</b>" + sts + "<span class='small'>" + bits.join(" · ") + (tals ? " · " + E(tals) : "") + "</span></div>" +
        (ok ? "" : "<span class='fo-osh-note bad'>would leave fewer than five bowlers</span>") + "</button>";
    }).join("") || "<div class='small' style='padding:8px 2px'>No one on the bench - the whole squad is in the XI.</div>";
    var m = document.createElement("div"); m.id = "fo-osheet";
    m.innerHTML = "<div class='fo-osh-card'><div class='fo-osh-h'><b>Replace " + E(outNm) + "</b><span class='small'>pick from the bench</span><button id='fo-osh-x'>&#10005;</button></div>" + rows + "</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      var x = ev.target.closest ? ev.target.closest("#fo-osh-x") : null;
      if (x || ev.target === m) { m.remove(); return; }
      var b = ev.target.closest ? ev.target.closest("[data-fo-bench]") : null;
      if (!b || b.disabled) return;
      var inNm = b.getAttribute("data-fo-bench");
      // a swap pins the XI: if none was pinned yet, the current order's
      // eleven becomes it, so the engine fields the side the manager built
      if (!App.orders.xi || !App.orders.xi.length) App.orders.xi = (App.orders.batOrder || []).slice(0, 11);
      var ix = App.orders.xi.indexOf(outNm);
      if (ix >= 0) App.orders.xi[ix] = inNm;
      var bix = App.orders.batOrder.indexOf(outNm);
      if (bix >= 0) App.orders.batOrder[bix] = inNm;
      // the departing man leaves the bowling plan and any C/WK armband
      gridState();
      for (var o = 1; o <= 50; o++) if (App.orders.grid[o] === outNm) App.orders.grid[o] = null;
      gridToSpells();
      var xi2 = foOrdXI();
      if (App.orders.captain === outNm) App.orders.captain = xi2.slice().sort(function (a, b2) { return (b2.capt || 0) - (a.capt || 0); })[0].name;
      if (App.orders.keeper === outNm) App.orders.keeper = (xi2.filter(function (p) { return p.keeper; })[0] || xi2[0]).name;
      m.remove();
      if (document.getElementById("fo-ord-xi-list")) foOrdersUI(); else foOrdRepaint();
    });
  }
  function foOrdRepaint(which) {
    var b1 = document.getElementById("fo-bat-rows"), b2 = document.getElementById("fo-bowl-body");
    if (b1 && which !== "bowl") b1.innerHTML = foOrdBatRows();
    if (b2 && which !== "bat") b2.innerHTML = foOrdBowlBody();
  }
  function foOrdSheet(phIx, par) {
    var old = document.getElementById("fo-osheet"); if (old) old.remove();
    var t = userTeam(), ph = FO_ORD_PH[phIx];
    var slotN = foOrdSlotOvers(ph, par).length;
    var tot = foOrdTotals();
    var cur = foOrdSlotOwner(ph, par);
    var other = foOrdSlotOwner(ph, par === 1 ? 0 : 1);
    var pool = (t.players || []).filter(function (p) { return p.bowlType; })
      .sort(function (a, b) { return (isPT(a) - isPT(b)) || (aggBowl(b) - aggBowl(a)); });
    var rows = pool.map(function (p) {
      var mine = cur && cur.nm === p.name ? (tot[p.name] || 0) - cur.n : (tot[p.name] || 0);
      var after = mine + slotN;
      var sameEndClash = other && other.nm === p.name;   // both ends of a phase = back-to-back overs
      var dis = sameEndClash || after > 10;
      var why = sameEndClash ? "already bowling the other end this phase" : (after > 10 ? "would pass 10 overs (" + after + ")" : (mine ? mine + " ov planned elsewhere" : ""));
      return "<button class='fo-osh-row' data-fo-pick='" + E(p.name) + "' " + (dis ? "disabled" : "") + ">" +
        "<div><b>" + E(p.name) + (isPT(p) ? " <span class='fo-osh-pt'>part-time</span>" : "") + "</b><span class='small'>" + E(shortBT(p)) + " · bowl " + Math.round(aggBowl(p) || 0) + "</span></div>" +
        "<span class='fo-osh-note" + (dis ? " bad" : "") + "'>" + E(why) + "</span></button>";
    }).join("");
    var m = document.createElement("div"); m.id = "fo-osheet";
    m.innerHTML = "<div class='fo-osh-card'><div class='fo-osh-h'><b>" + ph.lbl + " · " + (par === 1 ? "End A" : "End B") + "</b><span class='small'>" + slotN + " overs, never back-to-back</span><button id='fo-osh-x'>&#10005;</button></div>" +
      "<button class='fo-osh-row fo-osh-ai' data-fo-pick=''><div><b>Let the AI captain decide</b><span class='small'>leave these overs unplanned</span></div></button>" + rows + "</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) {
      var x = ev.target.closest ? ev.target.closest("#fo-osh-x") : null;
      if (x || ev.target === m) { m.remove(); return; }
      var b = ev.target.closest ? ev.target.closest("[data-fo-pick]") : null;
      if (!b || b.disabled) return;
      foOrdSetSlot(phIx, par, b.getAttribute("data-fo-pick") || null);
      m.remove();
      foOrdRepaint("bowl");
    });
  }
  // The conditions card: what the pitch + weather actually do in the engine,
  // which of YOUR bowlers suit them, and who to fear in their XI. The sim
  // models all of this - the selection screen finally says so.
  function foCondRead(opp) {
    try {
      if (!opp || !App.pending) return "";
      var pitch = String(opp.pitch || "balanced").toLowerCase(), wx = String(opp.weather || "").toLowerCase();
      var P = {
        green: "a green seamer - movement for the quicks, spin does little",
        dry: "a dry turner - it grips and spins more every over",
        cracked: "cracked - uneven bounce brings bowled and lbw into play",
        flat: "flat - a batting paradise, bowlers earn nothing cheap",
        slow: "slow - the ball holds in the pitch, timing is hard",
        balanced: "fair for everyone - skill decides it"
      };
      var W = {
        overcast: "cloud cover helps the seamers all day",
        humid: "heavy air - swing early, and everyone tires faster",
        drizzle: "drizzle about: boundaries are harder, and rain could shorten the chase (DLS)",
        hot: "hot - bowlers tire quicker, rotate your spells",
        scorching: "scorching - fatigue bites hard, a sixth bowling option earns his keep",
        "dew later": "dew later - gripping the ball gets harder, chasing gets easier",
        windy: "windy - big hits are riskier",
        chilly: "chilly - lively for the seamers early",
        misty: "misty - the new ball does a bit extra",
        sunny: "good batting weather"
      };
      var wantSpin = pitch === "dry" || pitch === "slow";
      var wantSeam = pitch === "green" || pitch === "cracked" || wx === "overcast" || wx === "humid" || wx === "misty" || wx === "chilly";
      var me = userTeam();
      var suited = (me.players || []).filter(function (p) {
        if (!p || !p.bowlType || p.bowlType === "none") return false;
        var spin = /spin/i.test(p.bowlTypeFull || p.bowlType);
        return wantSpin ? spin : (wantSeam ? !spin : false);
      }).sort(function (a, b) { return ((b.skills && b.skills.wicket) || 0) - ((a.skills && a.skills.wicket) || 0); }).slice(0, 2)
        .map(function (p) { return p.name.split(" ").slice(-1)[0]; });
      var suitTxt = suited.length ? (" Suits " + (wantSpin ? "your spinners" : "your seamers") + ": <b>" + suited.map(E).join(", ") + "</b>.") : "";
      // their dangermen: top of the opposition's squad by rating
      var oppT = null;
      try { oppT = (GD.teams || []).filter(function (t9) { return t9 && t9.name === App.pending.away; })[0] || GD.teams[App.pending.oppIx]; } catch (e1) {}
      var danger = "";
      if (oppT && oppT.players) {
        var top3 = oppT.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).slice(0, 3)
          .map(function (p) { return E(p.name.split(" ").slice(-1)[0]) + " <span class='small'>(" + E((typeof prole === "function" ? prole(p.role) : p.role) || "") + ")</span>"; });
        if (top3.length) danger = "<div style='margin-top:3px'>Their dangermen: " + top3.join(" · ") + "</div>";
      }
      return "<div class='fo-ord-read small'><b>The read:</b> " + (P[pitch] || P.balanced) + (W[wx] ? "; " + W[wx] : "") + "." + suitTxt + danger + "</div>";
    } catch (e) { return ""; }
  }
  // The Gaffer reads the same conditions the engine will use, in his own
  // voice: one line on the pitch, one clause on the sky, then the plan.
  // Deterministic - keyed purely off the served pitch and weather, so the
  // same fixture says the same thing on every device.
  function foOrdGafferSays(opp) {
    var pitch = String((opp && opp.pitch) || "balanced").toLowerCase();
    var wx = String((opp && opp.weather) || "").toLowerCase();
    var P = {
      green: "There's grass on this one, boss - it'll seam about all morning",
      dry: "It's a dry crumbler, boss - it'll turn more every over",
      cracked: "A sticky pitch, boss - the bounce will misbehave",
      flat: "Flat as a road, boss - a batting day if ever I saw one",
      slow: "A slow old deck, boss - timing won't come easy",
      twoPaced: "It's two-paced, boss - some skid on, some hold up",
      balanced: "A fair pitch, boss - skill will decide it"
    };
    var W = {
      overcast: "and this cloud will keep the seamers interested",
      humid: "and the air's heavy - swing early, tired legs late",
      drizzle: "and there's drizzle about - keep one eye on the rain",
      hot: "and it's hot out - spells will tire quickly",
      scorching: "and it's scorching - fatigue will bite hard",
      "dew later": "and dew's due later - gripping the ball gets harder",
      windy: "and it's blowy - big hits carry risk",
      chilly: "and it's chilly - lively for the quicks early",
      misty: "and it's misty - the new ball will do a bit",
      sunny: "and the sun's out - good batting weather"
    };
    return (P[pitch] || P.balanced) + (W[wx] ? ", " + W[wx] : "") + ". My plan's below - move anything you like.";
  }
  // ---- simple mode: the whole sheet is a lot for a new manager. Until
  // they've played a handful of matches (or ask for the full editor), the
  // orders page is one readable Gaffer plan and one button.
  // the plan screen IS the orders editor now (drag the order, tap the
  // overs) - everyone lands here; the legacy full editor stays reachable
  // only for anyone with a stored 'full' preference
  function foOrdMode() {
    return lsGet("fo_ord_mode") === "full" ? "full" : "simple";
  }
  // Stars are RELATIVE to this club's own squad (quintiles): a new manager
  // can't read a 0-100 skill number, but five gold stars on his best player
  // and one on his weakest needs no manual.
  // The score behind them is a COMPOSITE: the discipline aggregate is the
  // main ingredient (60%), technique and power season it (20% each) - so a
  // low-technique big hitter and a low-power technician rate the same.
  function foOrdBatComp(p) {
    var sk = p.skills || {};
    return 0.6 * (aggBat(p) || 0) + 0.2 * (((sk.vsPace || 0) + (sk.vsSpin || 0)) / 2) + 0.2 * (sk.power || 0);
  }
  function foOrdBowlComp(p) {
    var sk = p.skills || {};
    return 0.6 * (aggBowl(p) || 0) + 0.2 * (sk.wicket || 0) + 0.2 * (sk.economy || 0);
  }
  // the batting order shows BATTING stars for everyone (a tail-ender must
  // never out-star the opener); bowling stars live on the bowler cards
  // ABSOLUTE calibration, out of ten: composite 15 or below (dreadful in
  // everything) is 0 stars, 92+ (legendary in all three ingredients) is 10,
  // linear between. The same ladder for every player in the world - a
  // starting club reads ~4-5 stars with the whole climb ahead of it.
  function foOrdStars(comp) {
    return Math.max(0, Math.min(10, Math.round(((comp - 15) / 77 * 10) * 2) / 2));
  }
  // FTP-style role glyphs beside each name: bat / ball / bat+ball / stumps.
  // Keeper wins (the gloves define his job), then the declared all-rounder,
  // then anyone with a bowling type, then the pure batter.
  var FO_RIC = {
    // an angled willow bat: handle top-right, blade bottom-left
    bat: "<svg viewBox='0 0 16 16'><g transform='rotate(40 8 8)'><rect x='7' y='1' width='2' height='3.4' rx='.9' fill='#7a5230'/><rect x='5.5' y='4.2' width='5' height='9.6' rx='2.1' fill='#C9A24B'/></g></svg>",
    // a solid red cricket ball with a quiet darker-red seam
    bwl: "<svg viewBox='0 0 16 16'><circle cx='8' cy='8' r='6.4' fill='#C2352A'/><path d='M4 5.2c2.5 1.3 5.5 1.3 8 0M4 10.8c2.5-1.3 5.5-1.3 8 0' stroke='#8f231b' stroke-width='.9' fill='none' stroke-linecap='round'/></svg>",
    // both: an angled bat on the left, a red ball on the right
    ar: "<svg viewBox='0 0 16 16'><g transform='rotate(40 5 8)'><rect x='4.4' y='1.6' width='1.5' height='2.5' rx='.7' fill='#7a5230'/><rect x='3.4' y='3.9' width='3.6' height='7.2' rx='1.5' fill='#C9A24B'/></g><circle cx='11.3' cy='10.6' r='4.1' fill='#C2352A'/><path d='M8.3 8.9c1.9.8 4.1.8 6 0' stroke='#8f231b' stroke-width='.7' fill='none' stroke-linecap='round'/></svg>",
    // three brown stumps with two bails that BOTH rest on the middle stump
    // (bail 1 bridges left+middle, bail 2 bridges middle+right)
    wk: "<svg viewBox='0 0 16 16'><g fill='#7a5230'><rect x='2.7' y='2.4' width='2.2' height='11.4' rx='.6'/><rect x='6.9' y='2.4' width='2.2' height='11.4' rx='.6'/><rect x='11.1' y='2.4' width='2.2' height='11.4' rx='.6'/></g><g fill='#a9803f'><rect x='3.4' y='1.1' width='4.9' height='1.5' rx='.7'/><rect x='7.7' y='1.1' width='4.9' height='1.5' rx='.7'/></g></svg>"
  };
  function foOrdRoleIcon(p) {
    var k = p.keeper ? "wk"
      : (p.role === "allRounder" ? "ar"
        : (p.bowlType && p.bowlType !== "none" ? "bwl" : "bat"));
    var TT = { bat: "Batter", bwl: "Bowler", ar: "All-rounder", wk: "Wicket-keeper" };
    return "<span class='ric' title='" + TT[k] + "'>" + FO_RIC[k] + "</span>";
  }
  // ONE LADDER FOR THE WHOLE GAME, PUBLISHED. These live inside the closure
  // that modules 00-12 share, so every room built after it - the previews, the
  // club dossiers, anything that wants to say how good a cricketer is - had no
  // way to reach them and would have had to invent a second calibration. A
  // second calibration is a second truth. Hand the real one out instead.
  // NOT __foStars: that name already belongs to the world's star PLAYERS
  // (module 28). This is the rating ladder, and it says so.
  try {
    window.__foStarLadder = {
      bat: function (p) { return foOrdBatComp(p); },
      bowl: function (p) { return foOrdBowlComp(p); },
      stars: function (c) { return foOrdStars(c); },
      html: function (n) { return foOrdStarHTML(n); },
      roleIcon: function (p) { return foOrdRoleIcon(p); }
    };
  } catch (eSx) {}
  function foOrdStarHTML(n) {
    var full = Math.floor(n), half = (n - full) >= 0.5;
    var s = "";
    for (var i = 1; i <= 10; i++) s += "<em class='" + (i <= full ? "f" : (half && i === full + 1 ? "h" : "")) + "'>&#9733;</em>";
    return "<s class='st' title='" + n + " / 10'>" + s + "</s>";
  }
  // one plain-language line on WHY this player is in the sheet
  function foOrdWhy(p, boIx) {
    try {
      var bits = [];
      if (App.orders.captain === p.name) bits.push("The captain - coolest head at the club.");
      if (App.orders.keeper === p.name) bits.push("Your best gloves - he keeps wicket.");
      if (boIx === 0 || boIx === 1) bits.push("Opens the innings - he faces the new ball.");
      else if (p.bowlType && p.bowlType !== "none") bits.push(/spin/i.test(p.bowlTypeFull || p.bowlType) ? "Part of the attack - the spin option." : "Part of the seam attack.");
      var bestK = null, bestV = -1;
      for (var k in (p.skills || {})) if (typeof p.skills[k] === "number" && p.skills[k] > bestV) { bestV = p.skills[k]; bestK = k; }
      if (bestK) bits.push("Strongest suit: " + (foSkillLabel(bestK) || bestK) + ".");
      return bits.join(" ");
    } catch (e) { return ""; }
  }
  // micro-bars: three tiny value-coloured columns that read red/green at a
  // glance - the depth of a skill table in the footprint of a word
  function foOrdVCol(v) { return v >= 75 ? "#3E9455" : v >= 55 ? "#7BA23F" : v >= 38 ? "#D9A441" : "#C0552E"; }
  var FO_ORD_BT = { seamFast: "Fast", seamFastMedium: "Fast-medium", seamMedium: "Medium", wristSpin: "Wrist spin", fingerSpin: "Finger spin", partTimeSeam: "Part-time seam", partTimeSpin: "Part-time spin" };
  function foOrdBType(p) {
    var lbl = FO_ORD_BT[p.bowlTypeFull] || (p.bowlType ? String(p.bowlType) : "");
    return lbl ? ((p.hand === "L" ? "Left-arm " : "") + lbl).replace("Left-arm Fast", "Left-arm fast").replace("Left-arm Wrist", "Left-arm wrist").replace("Left-arm Finger", "Left-arm finger").replace("Left-arm Medium", "Left-arm medium").replace("Left-arm Part", "Left-arm part") : "";
  }
  function foOrdTalPills(p, max) {
    return (p.talents || []).slice(0, max || 2).map(function (t2) {
      var tip = (typeof TALTIPS !== "undefined" && TALTIPS[t2]) || "";
      return "<span class='fo-ord-tp' title='" + E(tip) + "'>" + E(typeof ptal === "function" ? ptal(t2) : t2) + "</span>";
    }).join("");
  }
  // tap a chip: the full trading card, so names grow into players
  function foOrdPlayerCard(nm) {
    try {
      var t = userTeam(), p = ((t && t.players) || []).filter(function (x) { return x.name === nm; })[0];
      if (!p) return;
      var boIx = (App.orders.batOrder || []).indexOf(nm);
      var tals = (p.talents || []).map(function (t2) {
        var lbl = (typeof ptal === "function" ? ptal(t2) : t2);
        var tip = (typeof TALTIPS !== "undefined" && TALTIPS[t2]) || "";
        return "<div class='tl'><b>" + E(lbl) + "</b>" + (tip ? " - " + E(tip) : "") + "</div>";
      }).join("");
      var form = "";
      try { if (p.formIx != null && typeof FORMW_UI !== "undefined") form = "Form: <b>" + E(FORMW_UI[p.formIx] || "") + "</b> · "; } catch (eF) {}
      var why = foOrdWhy(p, boIx);
      var ex = document.getElementById("fo-ord-pc"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-ord-pc"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card' style='max-width:340px'>" +
        "<div class='fo-modal-eyebrow'>" + (boIx >= 0 && boIx < 11 ? "Batting at #" + (boIx + 1) : "The bench") + "</div>" +
        foPkMini(p, { foot: "" }) +
        (why ? "<div class='fo-j-gbox' style='max-width:none;margin:10px 0 0'><img class='gf' src='" + FO_ART + "gaffer.png' alt=''>" +
          "<span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;" + E(why) + "&rdquo;</span></span></div>" : "") +
        (tals ? "<div class='fo-ord-pctal'>" + tals + "</div>" : "") +
        "<div class='small' style='margin-top:7px;color:#8a93a3'>" + form + "Fatigue: <b>" + E(String(p.fatigue || "rested")) + "</b> · age " + (p.age | 0) + "</div>" +
        (boIx >= 0 && boIx < 11 ? "<div class='fo-ord-pcx2'>" +
          (App.orders.captain !== p.name ? "<button type='button' id='fo-ord-mkc'>Make captain</button>" : "") +
          (p.keeper && App.orders.keeper !== p.name ? "<button type='button' id='fo-ord-mkk'>Give him the gloves</button>" : "") +
          "</div>" : "") +
        "<div class='fo-modal-act'><button class='fo-su-go primary' id='fo-ord-pcx'>Got it ▸</button></div></div>";
      document.body.appendChild(m);
      m.querySelector("#fo-ord-pcx").addEventListener("click", function () { m.remove(); });
      m.addEventListener("click", function (ev) { if (ev.target === m) m.remove(); });
      // the name on the card is a doorway: open the full player page fresh
      try {
        var nmEl = m.querySelector(".pkm-nm");
        if (nmEl) {
          nmEl.style.cursor = "pointer"; nmEl.style.textDecoration = "underline"; nmEl.title = "Open full profile";
          nmEl.addEventListener("click", function (e9) {
            e9.stopPropagation();
            window.open(location.href.split("#")[0] + "#/player?n=" + encodeURIComponent(p.name), "_blank");
          });
        }
      } catch (eNl) {}
      var mkC = m.querySelector("#fo-ord-mkc"), mkK = m.querySelector("#fo-ord-mkk");
      if (mkC) mkC.addEventListener("click", function () { App.orders.captain = p.name; m.remove(); foOrdersUI(); toast(p.name + " takes the captaincy."); });
      if (mkK) mkK.addEventListener("click", function () { App.orders.keeper = p.name; m.remove(); foOrdersUI(); toast(p.name + " takes the gloves."); });
    } catch (e) {}
  }
  // the saved plan as a matchday visual: game-plan cards, the XI strip,
  // a tempo curve, and the fifty overs of bowling as a coloured timeline
  // WHICH HALF OF THE SHEET IS OPEN. Batting and bowling used to share one
  // long page, and a manager scrolling for the overs grid waded through the
  // whole XI to reach it. They are two jobs, so they are two pages, and the
  // choice is remembered.
  function foOrdTab() {
    var v = null; try { v = lsGet("fo_ord_tab"); } catch (e) {}
    return v === "bowl" ? "bowl" : "bat";
  }
  function foOrdTabBar(tab) {
    return "<div class='fo-ord-tabs'>" +
      "<button type='button' class='" + (tab === "bat" ? "on" : "") + "' data-fo-ordtab='bat'>Batting</button>" +
      "<button type='button' class='" + (tab === "bowl" ? "on" : "") + "' data-fo-ordtab='bowl'>Bowling</button></div>";
  }
  function foOrdPlanVisual(tab) {
    try {
      gridState();
      var bo = App.orders.batOrder || [], sn = foOrdSurname;
      var t = userTeam(), by = {}; ((t && t.players) || []).forEach(function (p) { by[p.name] = p; });
      var pi = App.orders.phaseIntent || {}, fp = App.orders.fieldPlan || {};
      // quality is visible: stars relative to this squad, role words, and a
      // bench row so the XI reads as a CHOICE the manager can question
      var ROLE_W = { pace: "Seam", spin: "Spin", wk: "Keeper", bat: "Batter" };
      // one name format everywhere: first initial, dot, surname
      var dispNm = function (nm) { return nm.charAt(0) + ". " + sn(nm); };
      var chip = function (nm, i, dim) {
        var p = by[nm] || {}, sk = p.skills || {};
        // C and the gloves live ON the cards: filled on the holder, ghost on
        // everyone eligible - one tap moves the armband
        var isC = App.orders.captain === nm, isK = App.orders.keeper === nm;
        var tag = dim ? "" :
          "<i class='bdg bdg-mb " + foMbCls(nm) + "' data-fo-mb='" + E(nm) + "' title='" + E(foMbTitle(nm)) + "'>" + foMbLetter(nm) + "</i>" +
          "<i class='bdg" + (isC ? " on" : "") + "' data-fo-mkc='" + E(nm) + "' title='" + (isC ? "Captain" : "Make captain") + "'>C</i>" +
          (p.keeper ? "<i class='bdg" + (isK ? " on" : "") + "' data-fo-mkk='" + E(nm) + "' title='" + (isK ? "Wicket-keeper" : "Give him the gloves") + "'>WK</i>" : "");
        var role = p.bowlType && p.bowlType !== "none" ? (/spin/i.test(p.bowlTypeFull || p.bowlType) ? "spin" : "pace") : (p.keeper ? "wk" : "bat");
        var pills = foOrdTalPills(p, 2);
        // ARROWS ON THE XI, A GRIP ON THE BENCH.
        // Dragging is fine on a desk and a nuisance on a phone: you must hold,
        // then travel, and the list is trying to scroll under your thumb the
        // whole way. So a man in the order gets a stacked up/down pair, which
        // is one tap per place and cannot be fumbled. The bench keeps the grip
        // because a bench man is not moving one place - he is being carried
        // onto a slot in the XI, which only dragging expresses.
        // The rail sits BESIDE the card, never inside it. The card is itself a
        // <button>; a control nested in a button is ambiguous - WebKit can
        // report the click against the outer button, and no keyboard can reach
        // the inner one. Outside, these are ordinary buttons that behave like
        // buttons everywhere.
        var mvR = i == null ? "" :
          "<span class='mv'>" +
            "<button type='button' class='mvb" + (i === 0 ? " off" : "") + "' data-fo-mv='up:" + E(nm) +
              "' title='Move up' aria-label='Move " + E(dispNm(nm)) + " up the order'>&#x25B2;</button>" +
            "<button type='button' class='mvb" + (i >= xiNames.length - 1 ? " off" : "") + "' data-fo-mv='dn:" + E(nm) +
              "' title='Move down' aria-label='Move " + E(dispNm(nm)) + " down the order'>&#x25BC;</button>" +
            "<button type='button' class='mvb mvs' data-fo-swap='" + E(nm) +
              "' title='Swap him out' aria-label='Replace " + E(dispNm(nm)) + " from the bench'>&#x21C4;</button>" +
          "</span>";
        var card = "<button type='button' class='xc xc-" + role + (dim ? " xc-dim" : "") + "' data-fo-pc='" + E(nm) + "'>" +
          (i == null ? "<span class='dh' title='Drag to move' aria-hidden='true'>&#x2261;</span>" : "") +
          "<span class='r1'>" + (i != null ? "<u>" + (i + 1) + "</u>" : "") + "<b>" + E(dispNm(nm)) + "</b>" + foOrdRoleIcon(p) + tag +
          "<span class='hd'>" + (p.hand === "L" ? "LHB" : "RHB") + "</span>" +
          "<span class='ov' title='Overall rating'><b>" + foPkOvr(p) + "</b></span></span>" +
          "<span class='r2'>" + foOrdStarHTML(foOrdStars(foOrdBatComp(p))) + "</span>" +
          "<span class='r3'>" + (pills || "") + "</span></button>";
        return i == null ? card : "<div class='xcw'>" + mvR + card + "</div>";
      };
      var xiNames = bo.slice(0, 11);
      var benchNames = ((t && t.players) || []).map(function (p9) { return p9.name; }).filter(function (nm) { return xiNames.indexOf(nm) < 0; });
      // vertical, editable: the XI as a draggable list, the bench beside it
      var xiCol = "<div class='pv-xi'><div class='fo-ord-vzh' style='margin-top:2px'>Batting order <span>&middot; tap &#x25B2;&#x25BC; to move a man, or drag him &middot; tap a man's letter to tell him how to bat: N normal, A attack, L launch, D defend</span></div><div class='fo-ord-xis' id='fo-ord-xi-list'>" + xiNames.map(function (nm, i) { return chip(nm, i, false); }).join("") + "</div></div>";
      var benchCol = "<div class='pv-bench'><div class='fo-ord-vzh' style='margin-top:2px'>Bench</div><div class='fo-ord-xis' id='fo-ord-bench-list'>" + benchNames.map(function (nm) { return chip(nm, null, true); }).join("") + "</div></div>";
      // one lane per bowling option (even the unused sixth): filled blocks
      // are his overs, and every cell is a BUTTON - tap an empty over to
      // hand it to that bowler, tap his own to take it back
      var g = App.orders.grid || {}, tot = {}, first = {};
      for (var o = 1; o <= 50; o++) {
        var nm2 = g[o];
        if (nm2) { tot[nm2] = (tot[nm2] || 0) + 1; if (first[nm2] == null) first[nm2] = o; }
      }
      var bowlNames = xiNames.filter(function (nm9) { var p9 = by[nm9]; return p9 && p9.bowlType && p9.bowlType !== "none"; })
        .sort(function (a, b) { return (first[a] || 99) - (first[b] || 99); });
      // the fifty-wide desktop lanes are retired: the two-ends board below is
      // the bowling board on every width, phone and desk alike
      // each bowler as a small card: type, overs, bowling stars (ranked
      // against the club's other bowlers), stamina, and his talents
      // bowler cards mirror the batting cards: name row with OVR right,
      // stars beneath (navy = with the ball), talents last
      // ONE line, both groups: the whole toss - call AND decision - reads as
      // a single sentence, so the buttons are cut small enough to share a
      // 393px phone row and the row itself never wraps
      var toss = "<div class='pv-toss'><div class='fo-ord-vzh' style='margin-top:2px'>Toss</div><div class='fo-ord-toss'>" +
        "<span class='tg'><span class='tl'>Call</span>" +
        "<button type='button' data-fo-toss='call:H' class='" + ((App.orders.tossCall || "H") === "H" ? "on" : "") + "'>Heads</button>" +
        "<button type='button' data-fo-toss='call:T' class='" + (App.orders.tossCall === "T" ? "on" : "") + "'>Tails</button></span>" +
        "<span class='tg'><span class='tl'>If we win</span>" +
        "<button type='button' data-fo-toss='dec:bat' class='" + (App.orders.tossDecision !== "bowl" ? "on" : "") + "'>Bat first</button>" +
        "<button type='button' data-fo-toss='dec:bowl' class='" + (App.orders.tossDecision === "bowl" ? "on" : "") + "'>Bowl first</button></span>" +
        "</div></div>";
      // phones: the 50-cell lanes are unusably narrow. Instead: arm a bowler,
      // then tap big over-cells in a 10-per-row grid. Same data, same guards.
      var armNm = window.__foOrdArm;
      if (bowlNames.indexOf(armNm) < 0) armNm = null;
      if (!armNm) { for (var iA = 0; iA < bowlNames.length; iA++) { if ((tot[bowlNames[iA]] || 0) < 10) { armNm = bowlNames[iA]; break; } } armNm = armNm || bowlNames[0]; }
      window.__foOrdArm = armNm;
      var colorIx = {}; bowlNames.forEach(function (n9, i9) { colorIx[n9] = i9 % 6; });
      var inits = function (nm9) { var a9 = String(nm9).split(" "); return (a9[0].charAt(0) + (a9.length > 1 ? a9[a9.length - 1].charAt(0) : "")).toUpperCase(); };
      var mgrid = "<div class='fo-ord-mgrid'>" +
        "<div class='mg-hint'>Pick a bowler, then tap overs to hand them to him &middot; tap his over again to clear it. The list runs over 1 to over 50. Tap a bowler's badge to set his field: attacking, balanced or defensive.</div>" +
        "<div class='fo-ord-clearrow'>" +
        "<button type='button' class='fo-ord-autop' data-fo-act='autobowl'>Auto pick</button>" +
        "<button type='button' class='fo-ord-clearp' data-fo-clearplan>&#8709; Clear the bowling plan</button></div>" +
        "<div class='mg-chips'>" + bowlNames.map(function (n9) {
          // one small card per bowler, two to a row: name and OVR, his type
          // and overs, his field badge, and only the stars he HAS - the ten
          // fixed placeholders made every card the same width of grey
          var p9c = by[n9] || {};
          var st9 = (function (nS) {
            var fullS = Math.floor(nS), halfS = (nS - fullS) >= 0.5, tS = "";
            for (var iS = 0; iS < fullS; iS++) tS += "<em class='f'>&#9733;</em>";
            if (halfS) tS += "<em class='h'>&#9733;</em>";
            return "<s class='st' title='" + nS + " / 10'>" + (tS || "<em>&#9733;</em>") + "</s>";
          })(foOrdStars(foOrdBowlComp(p9c)));
          return "<button type='button' class='mgb mgb-c" + colorIx[n9] + (n9 === armNm ? " on" : "") + "' data-fo-arm='" + E(n9) + "'>" +
            "<span class='bw-h'><b>" + E(dispNm(n9)) + "</b><span class='ov' title='Overall rating'><b>" + foPkOvr(p9c) + "</b></span></span>" +
            "<span class='bw-m'><span class='bt'>" + E(foOrdBType(p9c)) + " &middot; " + (tot[n9] || 0) + " ov</span>" +
            "<s class='fbd" + (foMfVal(n9) ? " on" : "") + "' data-fo-mfc='" + E(n9) + "' title='" + E(foMfTitle(n9)) + "'>" + foMfShort(n9) + "</s></span>" +
            "<span class='r2'>" + st9 + "</span>" +
            "<span class='r3'>" + foOrdTalPills(p9c, 2) + "</span></button>";
        }).join("") + "</div>" +
        "<div class='mg-grid'>" + (function () {
          // THE TWO ENDS OF THE GROUND. Overs alternate ends the way an
          // innings actually runs: 1, 3, 5... from the Pavilion End, 2, 4,
          // 6... from the Far End, each pair side by side. The pleasant
          // consequence is real cricket's own shape - a bowler on a spell
          // alternates overs, so his overs STACK straight down the end he is
          // bowling from, and "never two in a row" becomes visible: two in a
          // row would mean bowling from both ends at once.
          var cell9 = function (o9) {
            var b9 = g[o9];
            return "<button type='button' class='mgc" + (b9 ? " mgc-c" + colorIx[b9] : "") + (o9 <= 10 ? " pp" : o9 >= 41 ? " dth" : "") + "' data-mo='" + o9 + "'><em>" + o9 + "</em>" +
              (b9 ? "<b>" + inits(b9) + "</b><span class='mgn'>" + E(dispNm(b9)) + "</span>" : "<span class='mgn mgn-e'>&mdash;</span>") + "</button>";
          };
          var h9 = "<span class='mg-endh'>Pavilion End</span><span class='mg-endh'>Far End</span>";
          for (var pr9 = 0; pr9 < 25; pr9++) {
            var oL9 = pr9 * 2 + 1;
            if (oL9 === 1) h9 += "<span class='mg-ph pp'>Powerplay &middot; overs 1-10</span>";
            if (oL9 === 11) h9 += "<span class='mg-ph'>Middle &middot; overs 11-40</span>";
            if (oL9 === 41) h9 += "<span class='mg-ph dth'>Death &middot; overs 41-50</span>";
            h9 += cell9(oL9) + cell9(oL9 + 1);
          }
          return h9;
        })() + "</div></div>";
      // two pages, one sheet: the tab decides which half paints
      if (tab === "bowl")
        return "<div class='fo-ord-planv'>" +
          "<div class='pv-bowl'><div class='fo-ord-vzh'>Bowling</div>" + mgrid + "</div></div>";
      return "<div class='fo-ord-planv'>" + toss + xiCol + benchCol + "</div>";
    } catch (e) { return ""; }
  }
  // scorecards speak the same star language: gold batting stars on the
  // batting card, navy bowling stars on the bowling card, talents removed.
  // Players whose club has left the world (old circuit visitors) simply
  // show no stars - the lookup is by live rosters.
  // Visiting clubs (the Circuit's opponents) leave the world when a tie ends,
  // taking their player objects with them - so their scorecard stars are
  // remembered here: a small persistent name -> star-values map, written
  // whenever a circuit squad is generated or archived.
  function foStarmapAdd(list) {
    try {
      var m = {}; try { m = JSON.parse(lsGet("fo_starmap") || "{}"); } catch (e0) {}
      (list || []).forEach(function (p9) {
        if (p9 && p9.name) m[p9.name] = { b: foOrdStars(foOrdBatComp(p9)), w: foOrdStars(foOrdBowlComp(p9)) };
      });
      var ks = Object.keys(m);
      if (ks.length > 800) ks.slice(0, ks.length - 800).forEach(function (k9) { delete m[k9]; });
      lsSet("fo_starmap", JSON.stringify(m));
    } catch (e) {}
  }
  function foStarmapGet(nm9) {
    try { return (JSON.parse(lsGet("fo_starmap") || "{}") || {})[nm9] || null; } catch (e) { return null; }
  }
  try { window.foStarmapAdd = foStarmapAdd; } catch (eSm) {}
  function foScStars(root) {
    try {
      root = root || document.getElementById("page") || document;
      var by9 = {};
      (GD.teams || []).forEach(function (t9) { ((t9.players || []).concat(t9.youth || [])).forEach(function (p9) { by9[p9.name] = p9; }); });
      root.querySelectorAll("table.fo-sct td.fo-sci-nm, table.ftp-scorecard tbody td:first-child, table.ftp-bowling tbody td:first-child").forEach(function (td) {
        td.querySelectorAll(".fo-tal-tag").forEach(function (x9) { x9.remove(); });
        if (td.querySelector(".fo-scst")) return;
        var a9 = td.querySelector("a"); if (!a9) return;
        var nm9 = null;
        try { nm9 = decodeURIComponent((a9.getAttribute("href") || "").split("n=")[1] || ""); } catch (e0) {}
        if (!nm9) return;
        var tb9 = td.closest("table");
        var bowl9 = !!(tb9 && (tb9.classList.contains("fo-sct-bowl") || tb9.classList.contains("ftp-bowling")));
        var p9 = by9[nm9], starsN = null;
        if (p9) starsN = foOrdStars(bowl9 ? foOrdBowlComp(p9) : foOrdBatComp(p9));
        else { var e9 = foStarmapGet(nm9); if (e9) starsN = bowl9 ? e9.w : e9.b; }   // departed circuit visitor
        if (starsN == null) return;
        var s9 = document.createElement("span");
        s9.className = "fo-scst " + (bowl9 ? "fo-scst-w" : "fo-scst-b");
        s9.innerHTML = foOrdStarHTML(starsN);
        // stars go AFTER the name AND its captain (c) / keeper (†) / bowl-type
        // marks - inserting right after the anchor shoved those marks past the
        // stars. Anchor on the last such mark when present, else the name.
        var marks9 = td.querySelectorAll(".fo-sci-cap, .fo-bt-tag");
        (marks9.length ? marks9[marks9.length - 1] : a9).insertAdjacentElement("afterend", s9);
      });
    } catch (e) {}
  }
  // decorate now AND a tick later: the hook fires from the core renderer,
  // but the patch layer rebuilds the live tab shell after core returns -
  // the deferred pass stars the freshly rebuilt tables without waiting for
  // the safety-net interval (which reads as flicker mid-broadcast)
  try { if (typeof foMatchRenderHooks !== "undefined") foMatchRenderHooks.push(function () { foScStars(); setTimeout(foScStars, 0); }); } catch (eH) {}
  // #/match: the live Scorecard tab is appended AFTER the core render (the
  // patch layer builds the tab shell around it), so the render hook fires too
  // early there - the interval is what actually stars the live tables.
  setInterval(function () {
    try { if (/^#\/(scorecard|reports|match|friendly|matchday)/.test(location.hash || "")) foScStars(); } catch (e) {}
  }, 800);
  // the oval's who-cards borrow the star language
  try { window.foStarsFor = { bat: foOrdBatComp, bowl: foOrdBowlComp, stars: foOrdStars, html: foOrdStarHTML, btype: foOrdBType }; } catch (eSF) {}
  function foOrdersUI() {
    var page = document.getElementById("page"); if (!page) return;
    var t = userTeam(), xi = foOrdXI();
    if (!App.orders.batOrder || !App.orders.batOrder.length) App.orders.batOrder = xi.map(function (p) { return p.name; });
    if (!App.orders.tossCall) App.orders.tossCall = "H";
    if (!App.orders.captain) App.orders.captain = xi.slice().sort(function (a, b) { return (b.capt || 0) - (a.capt || 0); })[0].name;
    if (!App.orders.keeper || !xi.some(function (p) { return p.name === App.orders.keeper; }))
      App.orders.keeper = (xi.filter(function (p) { return p.keeper; })[0] || xi[0]).name;
    gridState();
    // A LEAGUE MATCH IS THE UMPIRE'S TO PLAY. On a device holding a world
    // claim, a pending league fixture can only be a ghost off the retired
    // local sim - another round, another opponent, at a ground called Neutral
    // Park - because real league cricket is played by the server, not here.
    // Only an arranged friendly legitimately pends on a claimed device. So a
    // league ghost dies at the door, and the banner reads the world instead:
    // the umpire's own next fixture, its real ground, and the conditions the
    // engine will actually use - condOf, the same pure function the served
    // preview and the resolver both read.
    var wOpp = null;
    try {
      var cl9 = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (cl9 && cl9.country && cl9.slot != null) {
        var arranged = App.pending && (App.pending.__friendly || App.pending.__chal || App.pending.comp === "friendly");
        if (App.pending && !arranged) App.pending = null;
        if (!App.pending && typeof window.foNextFixture === "function") {
          var fx9 = window.foNextFixture();
          if (fx9 && fx9.served) {
            var meNm9 = t.name, opNm9 = (fx9.opp && fx9.opp.name) || "a club";
            var c9 = null;
            try {
              var P9 = window.__foPlanet;
              if (P9 && P9.condOf) c9 = P9.condOf(cl9.country, fx9.world.h, fx9.world.season, fx9.round);
            } catch (eC9) {}
            wOpp = { home: fx9.isHome ? meNm9 : opNm9, away: fx9.isHome ? opNm9 : meNm9,
                     ground: fx9.ground || "", pitch: (c9 && c9.pitch) || "balanced",
                     weather: (c9 && c9.weather) || "", comp: "league", round: fx9.round, __served: true };
          }
        }
      }
    } catch (eW9) {}
    var opp = App.pending || wOpp;
    if (!opp) { try { if (App.season && App.season.schedule) opp = foFixtureMeta(App.season.round); } catch (eFm) {} }
    if (!opp) opp = { home: t.name, away: "(practice)", ground: t.ground, pitch: "balanced", weather: "-" };
    // the auto-planner reads App.pending for pitch and weather; on a claimed
    // device the real conditions live in this banner instead, so hand them over
    try { window.__foOrdCond = { pitch: opp.pitch, weather: opp.weather }; } catch (eOc) {}
    var cond = "<div class='fo-ord-cond'><b>" + E(opp.home) + " v " + E(opp.away) + "</b> · " + E(foPitchName(opp.pitch)) + " pitch · " + E(opp.weather || "") + " · " + E(opp.ground || "") + "</div>" + foCondRead(opp);
    var sel2 = function (id, opts, cur) {
      return "<select data-fo-sel='" + id + "'>" + opts.map(function (o2) { return "<option value='" + o2[0] + "'" + (String(cur) === String(o2[0]) ? " selected" : "") + ">" + o2[1] + "</option>"; }).join("") + "</select>";
    };
    var INT = [[-1, "Defend"], [0, "Normal"], [1, "Attack"], [2, "Launch"]];
    var FLD = [["bal", "Balanced"], ["att", "Attacking"], ["def", "Defensive"]];
    var cell2 = function (lbl, inner) { return "<label class='fo-ord-cell'><span>" + lbl + "</span>" + inner + "</label>"; };
    // the tactics follow their discipline: intent and the toss live with the
    // bat, the field lives with the ball
    var tacBat = "<div class='fo-ord-tac'>" +
      "<div class='fo-ord-tach'>Batting intent</div>" +
      "<div class='fo-ord-tr3'>" + cell2("Powerplay", sel2("pi:pp", INT, App.orders.phaseIntent.pp)) + cell2("Middle", sel2("pi:mid", INT, App.orders.phaseIntent.mid)) + cell2("Death", sel2("pi:death", INT, App.orders.phaseIntent.death)) + "</div>" +
      "<div class='fo-ord-tach'>Toss</div>" +
      "<div class='fo-ord-tr3'>" + cell2("Call", sel2("toss:call", [["H", "Heads"], ["T", "Tails"]], App.orders.tossCall || "H")) + cell2("If won", sel2("toss:dec", [["bat", "Bat"], ["bowl", "Bowl"]], App.orders.tossDecision || "bat")) + "<span></span></div></div>";
    var tacBowl = "<div class='fo-ord-tac'>" +
      "<div class='fo-ord-tach'>Field when bowling</div>" +
      "<div class='fo-ord-tr3'>" + cell2("Powerplay", sel2("fp:pp", FLD, App.orders.fieldPlan.pp)) + cell2("Middle", sel2("fp:mid", FLD, App.orders.fieldPlan.mid)) + cell2("Death", sel2("fp:death", FLD, App.orders.fieldPlan.death)) + "</div></div>";
    var prev = null; try { prev = (typeof foPreviousOrders === "function") ? foPreviousOrders() : null; } catch (e) {}
    // ---- simple mode: the Gaffer fills the sheet, the manager reads it -----
    if (foOrdMode() === "simple") {
      try {
        // only auto-plan an EMPTY sheet - a saved or hand-painted plan is kept
        gridState();
        var painted0 = 0; for (var oS = 1; oS <= 50; oS++) if (App.orders.grid && App.orders.grid[oS]) painted0++;
        // the Gaffer fills an EMPTY sheet - but never refills one the manager
        // has just deliberately cleared, or the clear button undoes itself
        if (!painted0 && !App.orders.saved && !App.orders.noAutoPlan) { suggestOrders(); App.orders.grid = null; App.orders.gridBowlers = null; gridState(); gridToSpells(); }
      } catch (eSg) {}
      // the fixture IS the occasion: a broadcast-sized matchup title, the
      // conditions in one quiet line beneath, and no conditions essay
      var tabS = foOrdTab();
      page.innerHTML =
        "<div class='fo-ord-hero'><span class='h-t'>" + E(opp.home) + "</span><span class='h-v'>v</span><span class='h-t'>" + E(opp.away) + "</span></div>" +
        "<div class='fo-ord-herosub'>" + E(foPitchName(opp.pitch)) + " pitch &middot; " + E(opp.weather || "") + " &middot; " + E(opp.ground || "") + "</div>" +
        foOrdTabBar(tabS) +
        "<div class='panel fo-keep'><h4>The Gaffer's plan &middot; " + (tabS === "bowl" ? "Bowling" : "Batting") + "</h4><div class='pad'>" +
        (tabS === "bat" ? "<div class='fo-j-gbox' style='max-width:none;margin:2px 0 10px'><img class='gf' src='" + FO_ART + "gaffer.png' alt=''>" +
        "<span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;" + foOrdGafferSays(opp) + "&rdquo;</span></span></div>" : "") +
        foOrdPlanVisual(tabS) +
        "<div class='fo-ord-acts' style='margin-top:12px'>" +
        "<button class='primary fo-ord-save'>" + (App.pending ? "Play with this plan &#9654;" : "Save this plan") + "</button>" +
        (SYNC && SYNC.started && !SYNC.practice && App.pending && !App.pending.__friendly
          ? "<span class='small'>League lineups lock an hour before the 9:00 AM ET start.</span>"
          : (App.pending ? "" : "<span class='small'>Orders apply to your next fixture.</span>")) + "</div>" +
        "</div></div>";
      foOrdWire(page);
      return;
    }
    var tabA = foOrdTab();
    page.innerHTML = cond + foOrdTabBar(tabA) +
      "<div class='fo-ord-cols fo-ord-one'>" +
      (tabA === "bat"
        ? "<div class='panel fo-keep'><h4>Batting order</h4><div class='pad'>" +
          "<div class='small' style='margin-bottom:6px'>Arrows move a batter · tap <b>C</b> for captain, <b>WK</b> for the gloves · tap the letter to tell a man how to bat: <b>N</b>ormal, <b>A</b>ttack, <b>L</b>aunch, <b>D</b>efend.</div>" +
          "<div id='fo-bat-rows'>" + foOrdBatRows() + "</div>" + tacBat + "</div></div>"
        : "<div class='panel fo-keep'><h4>Bowling plan</h4><div class='pad'>" +
          "<div class='fo-og-hint'>Pick a bowler &middot; tap overs to paint his spells &middot; tap again to clear. Ten overs each, never two in a row.</div>" +
          "<div id='fo-bowl-body'>" + foOrdBowlBody() + "</div>" + tacBowl + "</div></div>") + "</div>" +
      "<div class='fo-ord-acts'>" +
      "<button class='primary fo-ord-save'>Save orders" + (App.pending ? "" : "") + "</button>" +
      "<button data-fo-act='suggest'>Suggest lineup</button>" +
      (prev ? "<button data-fo-act='prev'>Copy previous match</button>" : "") +
      "<button data-fo-act='clear'>Clear</button>" +
      "<button data-fo-act='simplemode'>Gaffer's plan</button>" +
      "<span class='small'>" + (SYNC && SYNC.started && !SYNC.practice && App.pending && !App.pending.__friendly
        ? "League lineups lock an hour before the 9:00 AM ET start."
        : (App.pending ? "The match starts the moment you save." : "Orders apply to your next fixture.")) + "</span></div>";
    foOrdWire(page);
  }
  function foOrdWire(page) {
    if (page.__foOrdWired) return;
    {
      page.__foOrdWired = 1;
      page.addEventListener("click", function (ev) {
        try {
          if (!/^#\/orders/.test(location.hash || "")) return;
          var q = function (sel3) { return ev.target.closest ? ev.target.closest(sel3) : null; };
          var el;
          // FIRST, ALWAYS. An arrow tap is never a drag and never a card open,
          // so nothing downstream may swallow it.
          if ((el = q("[data-fo-mv]"))) {
            var mvA = el.getAttribute("data-fo-mv").split(":");
            foOrdMove(mvA.slice(1).join(":"), mvA[0] === "up" ? -1 : 1);
            return;
          }
          if ((el = q("[data-fo-ordtab]"))) {
            try { lsSet("fo_ord_tab", el.getAttribute("data-fo-ordtab")); } catch (eT9) {}
            foOrdersUI();
            try { window.scrollTo(0, 0); } catch (eS9) {}   // a tab is a page: it opens at its top
            return;
          }
          if ((el = q("[data-fo-up]"))) { var i1 = +el.getAttribute("data-fo-up"); var a1 = App.orders.batOrder; var tmp1 = a1[i1 - 1]; a1[i1 - 1] = a1[i1]; a1[i1] = tmp1; foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-dn]"))) { var i2 = +el.getAttribute("data-fo-dn"); var a2 = App.orders.batOrder; var tmp2 = a2[i2 + 1]; a2[i2 + 1] = a2[i2]; a2[i2] = tmp2; foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-swap]"))) { foOrdBenchSheet(el.getAttribute("data-fo-swap")); return; }
          if ((el = q("[data-fo-mb]"))) {
            foMbCycle(el.getAttribute("data-fo-mb"));
            // the letter must change where the eye is: the plan view has no
            // fo-bat-rows, so repainting only that left it reading N forever
            if (document.getElementById("fo-ord-xi-list")) foOrdersUI(); else foOrdRepaint("bat");
            return;
          }
          if ((el = q("[data-fo-mf]"))) { foMfSet(el.getAttribute("data-fo-mf"), el.getAttribute("data-fo-mfv") || ""); foOrdRepaint("bowl"); return; }
          if ((el = q("[data-fo-capt]"))) { App.orders.captain = el.getAttribute("data-fo-capt"); foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-wk]"))) { App.orders.keeper = el.getAttribute("data-fo-wk"); foOrdRepaint("bat"); return; }
          if ((el = q("[data-fo-clearall]"))) {
            gridState();
            for (var o6 = 1; o6 <= 50; o6++) App.orders.grid[o6] = null;
            gridToSpells();
            foOrdRepaint("bowl");
            return;
          }
          if ((el = q("[data-fo-brush]"))) { window.__foOrdBrush = el.getAttribute("data-fo-brush") || ""; foOrdRepaint("bowl"); return; }
          if ((el = q("[data-fo-cell]"))) {
            gridState();
            var o5 = +el.getAttribute("data-fo-cell");
            var br5 = window.__foOrdBrush || "";
            App.orders.grid[o5] = (!br5 || App.orders.grid[o5] === br5) ? null : br5;
            if (br5 && App.orders.gridBowlers.indexOf(br5) < 0) App.orders.gridBowlers.push(br5);
            App.orders.noAutoPlan = 0;
            gridToSpells();
            foOrdRepaint("bowl");
            return;
          }
          if ((el = q(".fo-ord-save"))) {
            // a first-timer can reach Save with zero overs painted - the AI
            // quietly improvises, which is a lesson nobody gets to learn.
            // Say it once and offer the one-tap fix.
            try {
              gridState();
              var painted = 0; for (var oC = 1; oC <= 50; oC++) if (App.orders.grid && App.orders.grid[oC]) painted++;
              var sp0 = App.orders.spells || {};
              var anyPlan = painted > 0 || ((sp0.north || []).some(function (s9) { return s9 && s9.bowler; })) || ((sp0.south || []).some(function (s9) { return s9 && s9.bowler; }));
              if (!anyPlan && App.pending && !el.__foNudged) {
                el.__foNudged = 1;
                foConfirm({ title: "No bowling plan", body: "You haven't painted any overs, so your AI captain will improvise the bowling. Want a suggested plan first? You can still repaint it before saving.",
                  confirm: "Suggest a plan", cancel: "Play as is" })
                  .then(function (ok) {
                    if (ok) { try { suggestOrders(); App.orders.grid = null; App.orders.gridBowlers = null; gridState(); gridToSpells(); } catch (eS9) {} foOrdersUI(); toast("Plan suggested - look it over, then Save."); }
                    else { var b9 = document.querySelector(".fo-ord-save"); if (b9) { b9.__foNudged = 1; b9.click(); } }
                  });
                return;
              }
            } catch (eNg) {}
            // eleven men and nobody to stand behind the stumps? Not on my watch
            try {
              if (!foOrdXI().some(function (p9) { return p9.keeper; })) {
                toast("You can't take the field without a wicket-keeper - swap one into the XI.");
                return;
              }
            } catch (eWk) {}
            // today's league round locks at 8:00 AM ET while the engine warms up
            try {
              if (SYNC && SYNC.started && !SYNC.practice && LG && !App.pending && !SYNC.planRound) {
                var hET = foETHour(new Date());
                if (hET != null && hET >= 8 && hET < 10) {
                  say("Lineups for today's round locked at 8:00 AM ET \u00b7 the round plays at 9:00 and everything unlocks at stumps. You can still plan future rounds from the Matches page.");
                  return;
                }
              }
            } catch (eLk) {}
            App.orders.saved = true;
            App.defaults = JSON.parse(JSON.stringify(App.orders));
            // file it with the World Service too: this sheet IS the club's
            // plan for every round still to play, played by the umpire at the
            // nation's hour whether the manager is there or not
            var filed = false;
            try {
              filed = !!(window.__foWorldPushOrders && window.__foWorldPushOrders(App.orders, function (err) {
                try { if (err) toast("Saved here, but the world did not take it: " + String(err.message || err).slice(0, 70)); } catch (e9) {}
              }));
            } catch (eW9) {}
            if (App.pending) { location.hash = "#/match"; if (typeof window.route === "function") window.route(); }
            else {
              // saving IS leaving: the sheet is filed, so the room's work is
              // done - back to the club, with the confirmation riding along
              try { App.orders.saved = true; if (typeof saveGame === "function") saveGame(false); } catch (eSv) {}
              location.hash = "#/home"; if (typeof window.route === "function") window.route();
              toast(filed ? "Orders set \u00b7 the umpire has your sheet." : "Orders set.");
            }
            return;
          }
          // the click fired by a just-finished drag must not read as a tap -
          // the flag self-expires so it can never swallow a LATER real click
          if (window.__foOrdDragged) return;
          if ((el = q("[data-fo-clearplan]"))) {
            gridState();
            for (var oP = 1; oP <= 50; oP++) App.orders.grid[oP] = null;
            App.orders.gridBowlers = [];
            App.orders.noAutoPlan = 1;
            gridToSpells();
            foOrdersUI();
            toast("The bowling plan is clear - paint it again, or let the AI captain improvise.");
            return;
          }
          if ((el = q("[data-fo-mb]"))) { foMbCycle(el.getAttribute("data-fo-mb")); foOrdersUI(); return; }
          if ((el = q("[data-fo-mfc]"))) { foMfCycle(el.getAttribute("data-fo-mfc")); foOrdersUI(); return; }
          if ((el = q("[data-fo-mkc]"))) { App.orders.captain = el.getAttribute("data-fo-mkc"); foOrdersUI(); return; }
          if ((el = q("[data-fo-mkk]"))) { App.orders.keeper = el.getAttribute("data-fo-mkk"); foOrdersUI(); return; }
          if ((el = q("[data-fo-toss]"))) {
            var pr9 = el.getAttribute("data-fo-toss").split(":");
            if (pr9[0] === "call") App.orders.tossCall = pr9[1];
            else App.orders.tossDecision = pr9[1];
            foOrdersUI();
            return;
          }
          // phone bowling grid: arm a bowler, then tap overs
          if ((el = q("[data-fo-arm]"))) { window.__foOrdArm = el.getAttribute("data-fo-arm"); foOrdersUI(); return; }
          if ((el = q("[data-mo]"))) {
            var oM = +el.getAttribute("data-mo"), nmM = window.__foOrdArm;
            if (!nmM) return;
            gridState();
            var gM = App.orders.grid;
            if (gM[oM] === nmM) gM[oM] = null;
            else {
              var cM = 0; for (var oC8 = 1; oC8 <= 50; oC8++) if (gM[oC8] === nmM) cM++;
              if (cM >= 10) { toast("Ten overs is the limit for one bowler."); return; }
              if (gM[oM - 1] === nmM || gM[oM + 1] === nmM) { toast("No bowler can bowl two overs in a row."); return; }
              gM[oM] = nmM;
              if (App.orders.gridBowlers && App.orders.gridBowlers.indexOf(nmM) < 0) App.orders.gridBowlers.push(nmM);
            }
            gridToSpells();
            foOrdersUI();
            return;
          }
          // tap an over cell: give it to that lane's bowler, or take it back
          if ((el = q("[data-lo]"))) {
            var oT = +el.getAttribute("data-lo"), nmT = el.getAttribute("data-ln");
            gridState();
            App.orders.noAutoPlan = 0;
            var gT = App.orders.grid;
            if (gT[oT] === nmT) gT[oT] = null;
            else {
              var cT = 0; for (var oC9 = 1; oC9 <= 50; oC9++) if (gT[oC9] === nmT) cT++;
              if (cT >= 10) { toast("Ten overs is the limit for one bowler."); return; }
              if (gT[oT - 1] === nmT || gT[oT + 1] === nmT) { toast("No bowler can bowl two overs in a row."); return; }
              gT[oT] = nmT;
              if (App.orders.gridBowlers && App.orders.gridBowlers.indexOf(nmT) < 0) App.orders.gridBowlers.push(nmT);
            }
            gridToSpells();
            foOrdersUI();
            return;
          }
          if ((el = q("[data-fo-pc]"))) { foOrdPlayerCard(el.getAttribute("data-fo-pc")); return; }
          if ((el = q("[data-fo-act]"))) {
            var act = el.getAttribute("data-fo-act");
            if (act === "autobowl") {
              try {
                var keepB0 = (App.orders.batOrder || []).slice(), keepC0 = App.orders.captain, keepK0 = App.orders.keeper;
                var tmpP0 = null;
                if (!App.pending && window.__foOrdCond) { tmpP0 = { pitch: window.__foOrdCond.pitch, weather: window.__foOrdCond.weather }; App.pending = tmpP0; }
                suggestOrders();
                if (tmpP0 && App.pending === tmpP0) App.pending = null;
                if (keepB0.length) App.orders.batOrder = keepB0;
                if (keepC0) App.orders.captain = keepC0;
                if (keepK0) App.orders.keeper = keepK0;
                App.orders.grid = null; App.orders.gridBowlers = null; App.orders.noAutoPlan = 0;
                gridState(); gridToSpells();
              } catch (eAB) {}
              foOrdersUI();
              toast("The Gaffer has set the overs for these conditions - look it over, then Save.");
              return;
            }
            if (act === "suggest" || act === "reroll") { try { suggestOrders(); App.orders.grid = null; App.orders.gridBowlers = null; gridState(); gridToSpells(); } catch (eS) {} foOrdersUI(); if (act === "reroll") toast("Fresh plan set - same conditions, new thinking."); }
            else if (act === "prev") { try { var pv = foPreviousOrders(); if (pv) foApplyPrevOrders(pv); } catch (eP) {} foOrdersUI(); }
            else if (act === "clear") { App.orders.batOrder = []; App.orders.spells = { north: [], south: [] }; App.orders.grid = null; App.orders.gridBowlers = null; App.orders.captain = null; foOrdersUI(); }
            else if (act === "fine") { try { lsSet("fo_ord_mode", "full"); } catch (eM1) {} foOrdersUI(); }
            else if (act === "simplemode") { try { lsSet("fo_ord_mode", "simple"); } catch (eM2) {} foOrdersUI(); }
            return;
          }
        } catch (e) {}
      });
      // drag ANYWHERE on a card to reorder; a plain tap still opens the
      // player card. Mouse: a 6px move starts the drag. Touch: a short hold
      // starts it (so the list still scrolls naturally); wandering off
      // during the hold cancels it and lets the scroll through. Dragging a
      // bench man onto an XI slot swaps him in (five bowling options kept).
      page.addEventListener("pointerdown", function (ev) {
        try {
          if (!/^#\/orders/.test(location.hash || "")) return;
          var chipEl = ev.target.closest ? ev.target.closest(".fo-ord-xis .xc") : null;
          if (!chipEl) return;
          var list = document.getElementById("fo-ord-xi-list"); if (!list) return;
          var fromBench = chipEl.classList.contains("xc-dim");
          var nm = chipEl.getAttribute("data-fo-pc");
          var sx = ev.clientX, sy = ev.clientY;
          var isTouch = ev.pointerType === "touch";
          var r0 = chipEl.getBoundingClientRect();
          var dragging = false, tgtIx = -1, ghost = null, holdT = null;
          var blockScroll = function (e3) { e3.preventDefault(); };
          var begin = function () {
            if (dragging) return;
            dragging = true;
            ghost = chipEl.cloneNode(true);
            ghost.classList.add("xc-ghost");
            ghost.style.width = r0.width + "px";
            document.body.appendChild(ghost);
            chipEl.classList.add("xc-src");
            document.addEventListener("touchmove", blockScroll, { passive: false });
          };
          // the ≡ handle drags INSTANTLY on touch (its touch-action:none stops
          // the browser claiming the gesture for scroll); anywhere else on the
          // card a short hold starts the drag so the list still scrolls
          var onHandle = !!(ev.target.closest && ev.target.closest(".dh"));
          if (isTouch) { if (onHandle) begin(); else holdT = setTimeout(begin, 260); }
          var place = function (x, y) {
            ghost.style.left = (x - 24) + "px";
            ghost.style.top = (y - r0.height / 2) + "px";
            var chips9 = [].slice.call(list.querySelectorAll(".xc"));
            tgtIx = -1;
            chips9.forEach(function (c9, i9) {
              c9.classList.remove("xc-tgt");
              var r9 = c9.getBoundingClientRect();
              if (y >= r9.top && y <= r9.bottom) tgtIx = i9;
            });
            if (tgtIx >= 0) chips9[tgtIx].classList.add("xc-tgt");
          };
          var cleanup = function () {
            clearTimeout(holdT);
            document.removeEventListener("pointermove", mv);
            document.removeEventListener("pointerup", up);
            document.removeEventListener("touchmove", blockScroll);
            if (ghost) ghost.remove();
            chipEl.classList.remove("xc-src");
          };
          var mv = function (e2) {
            var dx = e2.clientX - sx, dy = e2.clientY - sy, d2 = dx * dx + dy * dy;
            if (!dragging) {
              if (!isTouch && d2 > 36) begin();
              else if (isTouch && d2 > 120) { cleanup(); return; }   // scroll intent
              if (!dragging) return;
            }
            place(e2.clientX, e2.clientY);
          };
          var up = function () {
            var was = dragging;
            cleanup();
            if (!was) return;   // plain tap: the native click opens the card
            window.__foOrdDragged = true; setTimeout(function () { window.__foOrdDragged = false; }, 250);
            if (tgtIx < 0) { foOrdersUI(); return; }
            var bo9 = App.orders.batOrder;
            if (!fromBench) {
              var from9 = bo9.indexOf(nm);
              if (from9 >= 0 && tgtIx !== from9) { bo9.splice(from9, 1); bo9.splice(tgtIx, 0, nm); }
            } else {
              var outNm = bo9[tgtIx];
              var t9 = userTeam(), by9 = {}; ((t9 && t9.players) || []).forEach(function (p9) { by9[p9.name] = p9; });
              var xiAfter = bo9.slice(0, 11).map(function (n9) { return n9 === outNm ? nm : n9; });
              var bowlN9 = xiAfter.filter(function (n9) { return by9[n9] && by9[n9].bowlType && by9[n9].bowlType !== "none"; }).length;
              if (bowlN9 < 5) { toast("That leaves fewer than five bowling options - swap him for a bowler instead."); foOrdersUI(); return; }
              if (!xiAfter.some(function (n9) { return by9[n9] && by9[n9].keeper; })) { toast("That leaves no wicket-keeper in the XI - keep one in."); foOrdersUI(); return; }
              bo9[tgtIx] = nm;
              // the man coming out loses his overs; captaincy and gloves self-heal
              try { gridState(); for (var o9 = 1; o9 <= 50; o9++) if (App.orders.grid[o9] === outNm) App.orders.grid[o9] = null; gridToSpells(); } catch (e9) {}
              if (App.orders.captain === outNm) App.orders.captain = xiAfter.map(function (n9) { return by9[n9]; }).filter(Boolean).sort(function (a, b) { return (b.capt || 0) - (a.capt || 0); })[0].name;
              if (App.orders.keeper === outNm) { var k9 = xiAfter.map(function (n9) { return by9[n9]; }).filter(function (p9) { return p9 && p9.keeper; })[0]; App.orders.keeper = (k9 || by9[xiAfter[0]]).name; }
            }
            foOrdersUI();
          };
          document.addEventListener("pointermove", mv);
          document.addEventListener("pointerup", up);
        } catch (e) {}
      });
      page.addEventListener("change", function (ev) {
        try {
          if (!/^#\/orders/.test(location.hash || "")) return;
          var sl = ev.target && ev.target.getAttribute ? ev.target.getAttribute("data-fo-sel") : null;
          if (!sl) return;
          var pr = sl.split(":"), v = ev.target.value;
          if (pr[0] === "pi") App.orders.phaseIntent[pr[1]] = +v;
          else if (pr[0] === "fp") App.orders.fieldPlan[pr[1]] = v;
          else if (sl === "toss:call") App.orders.tossCall = v;
          else if (sl === "toss:dec") App.orders.tossDecision = v;
        } catch (e) {}
      });
    }
  }
  try {
    var foOrdCss = document.createElement("style");
    foOrdCss.textContent =
      // the changing-room backdrop: a full-viewport fixed scene behind the
      // orders page, its cream centre holding the plan. The white content
      // wrap goes transparent so the room shows edge to edge; --fo-ord-bg is
      // set on <body> at render time so the art path resolves from both
      // index.html (client/art/) and client/game.html (art/). A faint cream
      // wash keeps text crisp over the busier corners.
      // a dedicated fixed layer (unique id, so the skin's re-appended brand
      // sheet can never win it back the way it does a body-level rule).
      // The horizontal gradient FADES the art into cream where the plan sits:
      // shelves and kit stay vivid at the edges, the centre is a clean page.
      "#fo-ord-bg{position:fixed;inset:0;z-index:-1;background-image:linear-gradient(90deg,rgba(244,239,226,.10) 0%,rgba(244,239,226,.72) 16%,rgba(244,239,226,.94) 30%,rgba(244,239,226,.94) 70%,rgba(244,239,226,.72) 84%,rgba(244,239,226,.10) 100%),var(--fo-ord-bg);background-size:cover;background-position:center center;background-repeat:no-repeat;pointer-events:none}" +
      // phones: a portrait screen cover-crops the wide scene to its EMPTY
      // cream middle - frame the art-rich right side (pads, ball, cap, rainy
      // window) instead, under a light wash so it reads behind the cards
      "@media(max-width:820px){#fo-ord-bg{background-position:86% 50%;background-image:linear-gradient(rgba(244,239,226,.32),rgba(244,239,226,.42)),var(--fo-ord-bg)}" +
      // slim gutters so a slice of the room shows beside the cards
      "html body.fo-ord-room .wrap{padding-left:13px!important;padding-right:13px!important}}" +
      // the white content wrap goes clear so the room shows through, and the
      // plan keeps to the cream centre of the scene
      "html body.fo-ord-room .wrap{background:transparent!important;box-shadow:none!important}" +
      "html body.fo-ord-room #page{background:transparent!important;max-width:1120px;margin:0 auto}" +
      // ---- one-screen plan: on wide desktops the sheet splits into two
      // columns (toss + batting left, bench + bowling right) with compact
      // cards, so the whole plan fits a laptop window without scrolling
      ".fo-ord-planv{display:flex;flex-direction:column}" +
      // batting + bench sit side by side; BOWLING keeps the full page width so
      // the fifty over-cells stay readable and tappable
      "@media(min-width:900px){.fo-ord-planv{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 16px;grid-template-areas:'toss toss' 'xi bench' 'bowl bowl';align-items:start}.pv-toss{grid-area:toss}.pv-xi{grid-area:xi}.pv-bench{grid-area:bench}.pv-bowl{grid-area:bowl}}" +
      "@media(min-width:1180px){" +
      // compact cards: tighter padding, smaller stars, slimmer talent row -
      // the whole plan should sit inside one laptop screen
      ".fo-ord-xis{gap:3px}" +
      "html body #page .fo-ord-xis button.xc{padding:2px 9px!important;gap:0!important}" +
      ".fo-ord-xis .xc .st{font-size:10.5px;letter-spacing:.8px;line-height:1}" +
      ".fo-ord-xis .xc .r3{min-height:9px}" +   // slim but CONSTANT: cards stay the same height with or without a talent
      ".fo-ord-xis .xc .ov b{font-size:14px}" +
      ".fo-ord-bws{gap:4px;grid-template-columns:repeat(auto-fill,minmax(185px,1fr))}" +
      ".fo-ord-bws .bw{padding:3px 9px;gap:1px}" +
      ".fo-ord-bws .bw .r3{min-height:0}.fo-ord-bws .bw .r3:empty{display:none}" +
      ".fo-ord-vzh{margin:8px 0 4px}" +
      ".fo-ord-planv .fo-j-gbox{padding:7px 11px}" +
      "}" +
      // ---- the batting / bowling tab bar: two pages, one sheet -------------
      ".fo-ord-tabs{display:flex;gap:6px;margin:10px 0 12px}" +
      "html body.ftpskin #page .fo-ord-tabs button,html body #page .fo-ord-tabs button{flex:1;padding:11px 0;border-radius:12px;border:1px solid rgba(28,36,51,.16)!important;background:#FFFEFC!important;color:#5b6472!important;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;box-shadow:none!important}" +
      "html body #page .fo-ord-tabs button.on{background:#0E233F!important;border-color:#0E233F!important;color:#FFFEFC!important}" +
      // ---- the bowling board, every width: arm a bowler, tap overs at
      // either end. The bowler chips ride sticky at the top so assigning
      // over 43 never means scrolling back up to re-arm a man
      ".fo-ord-mgrid{display:block;max-width:620px}" +

      ".mg-ph{display:block;margin:10px 0 4px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8a93a3}" +
      ".mg-ph.pp{color:#4E7A4E}.mg-ph.dth{color:#B04A2C}" +
      ".mg-hint{font-size:11.5px;color:#5b6472;line-height:1.5;margin:0 0 8px}" +
      ".mg-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px;margin:0 0 10px}" +
      "html body #page .mg-chips button.mgb{display:flex;flex-direction:column;align-items:stretch;gap:2px;border:2px solid rgba(28,36,51,.14)!important;background:#FFFEFC!important;border-radius:10px;padding:6px 8px;cursor:pointer;text-align:left;min-width:0}" +
      // armed: a heavy terracotta frame and a warm tint, the TEXT staying
      // dark - the last version painted the whole card terracotta and the
      // stars fought it
      "html body #page .mg-chips button.mgb.on{border-color:#B04A2C!important;background:#FFF3EC!important}" +
      ".mg-chips .mgb.on .bw-h b{color:#B04A2C}" +
      ".mg-chips .mgb .bw-h{display:flex;align-items:center;gap:6px;min-width:0}" +
      ".mg-chips .mgb .bw-h b{font-size:11.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}" +
      ".mg-chips .mgb .bw-m{display:flex;align-items:center;gap:5px;min-width:0}" +
      ".mg-chips .mgb .bt{font-size:8px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#a9812f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}" +
      ".mg-chips .mgb .bw-m s.fbd{margin-left:auto;flex:0 0 auto}" +
      ".mg-chips .mgb .ov{margin-left:auto;flex:0 0 auto}" +
      ".mg-chips .mgb .ov b{font-size:13.5px;font-weight:800;color:#B04A2C}" +
      ".mg-chips .mgb .r2{line-height:1}" +
      ".mg-chips .mgb .r3{display:flex;gap:4px;min-width:0;overflow:hidden}" +
      ".mg-chips .mgb .r3:empty{display:none}" +
      ".mg-chips .mgb .r3 .fo-ord-tp{font-size:7.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#8a93a3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:none;border:0;padding:0}" +
      ".mg-chips .mgb s{text-decoration:none;font-size:9.5px;font-weight:700;letter-spacing:.03em;color:#8a93a3;border:1px solid rgba(28,36,51,.16);border-radius:6px;padding:2px 6px}" +
      ".mg-chips .mgb s.on{color:#FFFEFC;background:#0E233F;border-color:#0E233F}" +
      ".fo-ord-clearrow{display:flex;justify-content:flex-start;align-items:center;gap:7px;flex-wrap:wrap;margin:9px 0 2px}" +
      "html body.ftpskin #page button.fo-ord-autop,html body #page button.fo-ord-autop{border:1px solid #0E233F!important;background:#0E233F!important;color:#FFFEFC!important;border-radius:999px;padding:7px 14px;font-size:11px;font-weight:800;letter-spacing:.02em;cursor:pointer}" +
      "html body #page button.fo-ord-autop:hover{background:#1d3a63!important;border-color:#1d3a63!important}" +
      "html body.ftpskin #page button.fo-ord-clearp,html body #page button.fo-ord-clearp{border:1px solid rgba(28,36,51,.16)!important;background:#FFFEFC!important;color:#5a6472!important;border-radius:999px;padding:7px 13px;font-size:11px;font-weight:700;letter-spacing:.02em;cursor:pointer}" +
      "html body #page button.fo-ord-clearp:hover{border-color:#B04A2C!important;color:#B04A2C!important}" +
      // the two ends side by side, over pairs down the page: odd overs from
      // the Pavilion End on the left, even from the Far End on the right,
      // the phase headers spanning both
      ".mg-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:3px 8px;align-items:stretch}" +
      ".mg-ph{grid-column:1/-1}" +
      ".mg-endh{font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#41577a;text-align:center;padding:3px 0 4px;border-bottom:2px solid rgba(28,36,51,.14)}" +
      "html body #page .mg-grid button.mgc{display:flex;align-items:center;gap:6px;border:1px solid rgba(28,36,51,.16)!important;border-left:4px solid #c8cfd9!important;background:#FFFEFC!important;border-radius:8px;height:40px;padding:0 6px 0 0!important;cursor:pointer;overflow:hidden}" +
      "html body #page .mg-grid button.mgc.pp{border-left-color:#4E7A4E!important}" +
      "html body #page .mg-grid button.mgc.dth{border-left-color:#B04A2C!important}" +
      ".mg-grid .mgc em{font-style:normal;width:22px;text-align:right;font-size:10.5px;font-weight:700;color:#8a93a3;flex:0 0 auto;font-variant-numeric:tabular-nums}" +
      ".mg-grid .mgc b{display:flex;align-items:center;justify-content:center;height:22px;width:28px;flex:0 0 auto;border-radius:6px;font-size:9.5px;font-weight:800;color:#fff}" +
      ".mg-grid .mgc .mgn{font-size:11.5px;font-weight:700;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}" +
      ".mg-grid .mgc .mgn-e{color:#b6bdc9;font-weight:600;font-style:italic}" +
      // one uniform navy for every bowler's cells - the initials tell them
      // apart, the colour stays calm
      ".mg-chips .mgb i{display:none}" +
      ".mg-grid .mgc-c0 b,.mg-grid .mgc-c1 b,.mg-grid .mgc-c2 b,.mg-grid .mgc-c3 b,.mg-grid .mgc-c4 b,.mg-grid .mgc-c5 b{background:#41577a}" +
      // ---- the ≡ drag handle: hidden for mouse users (drag-anywhere covers
      // them), a fat instant-drag target on touch screens
      ".fo-ord-xis .xc .dh{display:none}" +
      "@media(pointer:coarse){.fo-ord-xis .xc .dh{display:flex;align-items:center;justify-content:center;position:absolute;right:4px;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:8px;background:#EEF2F7;color:#41577a;font-size:17px;font-weight:400;touch-action:none}}" +
      // the up/down rail on every man in the XI - on a desk as well as a phone,
      // because one tap per place beats a drag on either
      "html body #page .fo-ord-xis button.xc{position:relative}" +
      // the bench keeps its grip on the right, where the drag has always been
      "@media(pointer:coarse){html body #page .fo-ord-xis button.xc.xc-dim{padding-right:46px!important}}" +
      // a row is the rail and then the card; the rail is a sibling, not a
      // passenger, so its buttons are real buttons the keyboard can reach
      ".fo-ord-xis .xcw{display:flex;align-items:stretch;gap:5px;min-width:0}" +
      ".fo-ord-xis .xcw>.mv{flex:0 0 auto;display:flex;flex-direction:column;justify-content:center;gap:3px;touch-action:manipulation}" +
      "html body #page .fo-ord-xis .xcw>button.xc{flex:1 1 auto;min-width:0}" +
      "html body.ftpskin #page .fo-ord-xis button.mvb,html body #page .fo-ord-xis button.mvb{display:flex!important;align-items:center;justify-content:center;width:34px;min-width:0;min-height:20px!important;height:auto;flex:1 1 0;margin:0!important;padding:0!important;border:1px solid rgba(28,36,51,.12)!important;border-radius:7px;background:#EEF2F7!important;color:#41577a!important;font-size:10px;line-height:1;cursor:pointer;box-shadow:none!important;-webkit-user-select:none;user-select:none;transition:background .12s,color .12s}" +
      "html body #page .fo-ord-xis button.mvb:hover{background:#DCE5F0!important;border-color:#B04A2C!important;color:#B04A2C!important}" +
      "html body #page .fo-ord-xis button.mvb:active{background:#B04A2C!important;color:#FFFEFC!important}" +
      "html body #page .fo-ord-xis button.mvb.off{opacity:.25;pointer-events:none}" +
      "html body #page .fo-ord-xis button.mvb.mvs{font-size:13px;color:#B04A2C!important}" +
      // the player-card modal is narrow: slim the v2 art panel so the name
      // never truncates beside the OVR
      "#fo-ord-pc .pkm{padding-left:84px}" +
      "#fo-ord-pc .pkm-art{width:74px}" +
      "#fo-ord-pc .pkm-nm{white-space:normal;overflow:visible;text-overflow:clip;font-size:16px;line-height:1.15}" +   // the narrow modal wraps the full name instead of ellipsizing it
      // FTP-style role glyphs beside every name in the order
      ".fo-ord-xis .xc .ric{display:inline-flex;width:16px;height:16px;flex:0 0 auto;align-items:center;margin-left:5px}" +
      ".fo-ord-xis .xc .ric svg{width:16px;height:16px;display:block}" +
      ".fo-ord-xis .xc.xc-dim .ric{opacity:.55}" +
      // scorecard talent tags are retired: hide them instantly so the old
      // look never flashes while the star decorator catches up
      "table.fo-sct .fo-tal-tag,table.ftp-scorecard .fo-tal-tag,table.ftp-bowling .fo-tal-tag{display:none!important}" +
      ".fo-ord-cond{background:#F0F4F8;border:1px solid rgba(31,78,107,.16);border-radius:10px;padding:9px 13px;font-size:12.5px;color:#243244;margin:6px 0 10px}" +
      ".fo-ord-read{background:#FBF7EC;border:1px solid rgba(201,162,75,.35);border-left:4px solid #C9A24B;border-radius:10px;padding:9px 13px;color:#4a4234;margin:0 0 10px;line-height:1.5}" +
      ".fo-ord-strat{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:2px 0 4px}" +
      "@media(max-width:640px){.fo-ord-strat{grid-template-columns:1fr}}" +
      "html body.ftpskin #page button.fo-ord-pcard,html body #page button.fo-ord-pcard{text-align:left;border:2px solid rgba(28,36,51,.12) !important;background:#FFFEFC !important;border-radius:12px;padding:10px 12px;cursor:pointer;display:flex;flex-direction:column;gap:3px;min-width:0}" +
      "html body.ftpskin #page button.fo-ord-pcard.on,html body #page button.fo-ord-pcard.on{border-color:#B04A2C !important;background:#FFF6F2 !important;box-shadow:0 3px 0 rgba(176,74,44,.22)}" +
      ".fo-ord-pcard .ic{font-size:19px;line-height:1}" +
      ".fo-ord-pcard b{font-size:13.5px;color:#0E233F}" +
      ".fo-ord-pcard.on b{color:#B04A2C}" +
      ".fo-ord-pcard .sub{font-size:11px;color:#6b7280;line-height:1.4;font-weight:500}" +
      ".fo-ord-xinote{background:#F0F4F8;border:1px solid rgba(31,78,107,.14);border-radius:9px;padding:7px 11px;font-size:11.5px;color:#3a4353;margin:0 0 8px;line-height:1.5}" +
      ".fo-ord-xiwrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start;max-width:820px}" +
      "@media(max-width:700px){.fo-ord-xiwrap{grid-template-columns:1fr}}" +
      ".fo-ord-xis{display:flex;flex-direction:column;gap:5px}" +
      ".fo-ord-xis .xc.xc-src{opacity:.35}" +
      ".fo-ord-xis .xc.xc-tgt{border-color:#B04A2C !important;box-shadow:0 0 0 2px rgba(176,74,44,.25)}" +
      ".xc-ghost{position:fixed;z-index:9999;pointer-events:none;opacity:.92;transform:rotate(1.5deg);box-shadow:0 10px 24px rgba(16,27,45,.3) !important;background:#FFFEFC;border:1px solid rgba(28,36,51,.2);border-radius:10px;display:flex;padding:6px 9px;gap:6px;list-style:none}" +
      "html body.ftpskin #page button.fo-ord-xis-btn,html body #page .fo-ord-xis button.xc{display:flex;flex-direction:column;align-items:stretch;gap:2px;background:#FFFEFC !important;border:1px solid rgba(28,36,51,.12) !important;border-radius:9px;padding:4px 9px;cursor:grab;min-width:0;text-align:left;width:100%}" +
      "html body #page .fo-ord-xis button.xc:hover{border-color:#B04A2C !important}" +
      ".fo-ord-xis .xc.xc-dim{opacity:.62}" +
      ".fo-ord-xis .xc .r1{display:flex;align-items:center;gap:6px;min-width:0;width:100%}" +
      ".fo-ord-xis .xc .r1 .hd{font-size:8px;font-weight:800;color:#9aa3af;letter-spacing:.04em;flex:0 0 auto}" +
      ".fo-ord-xis .xc .r1 .ov,.fo-ord-bws .bw .bw-h .ov{margin-left:auto;display:inline-flex;align-items:baseline;gap:2px;flex:0 0 auto}" +
      ".fo-ord-xis .xc .ov b,.fo-ord-bws .bw .ov b{font-size:16.5px;font-weight:800;color:#B04A2C}" +
      ".fo-ord-xis .xc .r2,.fo-ord-bws .bw .r2{margin-top:-1px}" +
      ".fo-ord-pcx2{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}" +
      "html body #page .fo-ord-pcx2 button,html body .fo-modal .fo-ord-pcx2 button{border:1px solid rgba(28,36,51,.2);background:#FFFEFC;color:#0E233F;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer}" +
      ".fo-ord-xis .xc .r1 b{font-size:11.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-ord-xis .xc u{width:17px;height:17px;background:#EEF2F7;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;text-decoration:none;font-size:9px;font-weight:800;color:#41577a;flex:0 0 auto}" +
      ".fo-ord-xis .xc i{font-style:normal;font-size:8px;background:#0E233F;color:#FFFEFC;border-radius:4px;padding:1px 4px;font-weight:800;flex:0 0 auto}" +
      ".fo-ord-xis .xc i.bdg{background:transparent;color:#c3c9d2;border:1px solid rgba(28,36,51,.16);cursor:pointer}" +
      // the instruction badge: N is quiet, the rest carry the colour of the risk
      ".fo-ord-xis .xc i.bdg-mb{color:#8a93a3}" +
      ".fo-ord-xis .xc i.bdg-mb.mb-d{background:#EAF1F8;color:#1D4E89;border-color:rgba(29,78,137,.4)}" +
      ".fo-ord-xis .xc i.bdg-mb.mb-a{background:#FDF1E4;color:#B0631A;border-color:rgba(176,99,26,.45)}" +
      ".fo-ord-xis .xc i.bdg-mb.mb-l{background:#FBE9E6;color:#B23230;border-color:rgba(178,50,48,.5)}" +
      // and a bowler's field, on his own lane
      ".fo-ord-lane .ln i.fbd{display:inline-block;margin-left:5px;font-style:normal;font-size:8.5px;font-weight:700;letter-spacing:.04em;color:#8a93a3;background:transparent;border:1px solid rgba(28,36,51,.16);border-radius:5px;padding:1px 4px;cursor:pointer;vertical-align:1px}" +
      ".fo-ord-lane .ln i.fbd.on{color:#FFFEFC;background:#0E233F;border-color:#0E233F}" +
      ".fo-ord-xis .xc i.bdg:hover{border-color:#B04A2C;color:#B04A2C}" +
      ".fo-ord-xis .xc i.bdg.on{background:#0E233F;color:#FFFEFC;border-color:#0E233F}" +
      ".fo-ord-xis .xc .r2{display:flex;align-items:center;gap:6px;width:100%}" +
      ".fo-ord-xis .xc .st,.fo-ord-bws .bw .st{text-decoration:none;font-size:13px;letter-spacing:1.2px;line-height:1;white-space:nowrap}" +
      ".mg-chips .mgb .st{text-decoration:none;font-size:11px;letter-spacing:.6px;line-height:1;white-space:nowrap}" +
      ".fo-ord-xis .xc .st em,.fo-ord-bws .bw .st em,.mg-chips .mgb .st em{font-style:normal;color:#d8d3c6}.fo-ord-xis .xc .st em.f{color:#D9A441}.fo-ord-bws .bw .st em.f,.mg-chips .mgb .st em.f{color:#0FB4C4}" +
      ".fo-ord-xis .xc .st em.h{background:linear-gradient(90deg,#D9A441 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".mg-chips .mgb .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      // the bench sheet's stars: gold batting, teal bowling, side by side
      ".fo-osh-row .osh-sts{display:flex;gap:10px;margin:2px 0 1px;flex-wrap:wrap}" +
      ".fo-osh-row .osh-st .st{text-decoration:none;font-size:11px;letter-spacing:.6px;line-height:1;white-space:nowrap}" +
      ".fo-osh-row .osh-st .st em{font-style:normal;color:#d8d3c6}" +
      ".fo-osh-row .osh-st.bat .st em.f{color:#D9A441}" +
      ".fo-osh-row .osh-st.bat .st em.h{background:linear-gradient(90deg,#D9A441 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-osh-row .osh-st.bwl .st em.f{color:#0FB4C4}" +
      ".fo-osh-row .osh-st.bwl .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-scst{white-space:nowrap;margin-left:7px;display:inline-block;vertical-align:1px}" +
      ".fo-scst .st{text-decoration:none;font-size:12px;letter-spacing:.9px;line-height:1;white-space:nowrap}" +
      ".fo-scst .st em{font-style:normal;color:#e2ddd2}" +
      ".fo-scst-b .st em.f{color:#D9A441}" +
      ".fo-scst-b .st em.h{background:linear-gradient(90deg,#D9A441 50%,#e2ddd2 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-scst-w .st em.f{color:#0FB4C4}" +
      ".fo-scst-w .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#e2ddd2 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-ord-bws .bw .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#d8d3c6 50%);-webkit-background-clip:text;background-clip:text;color:transparent}" +
      ".fo-ord-xis .xc .rl{font-size:9px;letter-spacing:.05em;text-transform:uppercase;font-weight:800;color:#8a93a3;margin-left:auto}" +
                  ".fo-ord-pctal{margin-top:8px;display:flex;flex-direction:column;gap:4px}" +
      ".fo-ord-pctal .tl{background:#FBF7EC;border:1px solid rgba(201,162,75,.3);border-radius:8px;padding:5px 9px;font-size:11.5px;color:#4a4234;line-height:1.4}" +
      ".fo-ord-vzh{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#41577a;font-weight:800;margin:13px 0 6px}" +
      ".fo-ord-vzh span{color:#9aa3af;letter-spacing:.02em;text-transform:none;font-weight:600}" +
      ".fo-ord-curve{width:100%;height:56px;display:block;background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:10px}" +
      ".fo-ord-ph3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:7px}" +
      ".fo-ord-ph3>div{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:9px;padding:6px 9px;min-width:0}" +
      ".fo-ord-ph3 b{display:block;font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;color:#8a93a3;font-weight:800}" +
      ".fo-ord-ph3 span{display:block;font-size:12px;font-weight:700;color:#0E233F;margin-top:1px}" +
      ".fo-ord-ph3 span.f{font-weight:600;color:#41577a;font-size:11px}" +
      "@media(max-width:480px){.fo-ord-ph3{grid-template-columns:repeat(3,minmax(0,1fr))}.fo-ord-ph3 span{font-size:11px}}" +
      ".fo-ord-lanes{display:flex;flex-direction:column;gap:3px;background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:10px;padding:9px 10px}" +
      ".fo-ord-lane{display:flex;align-items:center;gap:8px}" +
      ".fo-ord-lane .ln{flex:0 0 116px;font-size:10.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}" +
      ".fo-ord-lane .lt{flex:1;display:flex;gap:1px;height:13px;min-width:0}" +
      ".fo-ord-lane .lt i{flex:1;min-width:0;background:rgba(28,36,51,.05);border-radius:1px;cursor:pointer}" +
      ".fo-ord-lane .lt i:hover{outline:1px solid #B04A2C}" +
      ".fo-ord-lane .lt{height:15px}" +
      ".fo-ord-lane .lt i.pp,.fo-ord-lane .lt i.dth{background:rgba(201,162,75,.15)}" +
      ".fo-ord-lane .lt i.f{background:#41577a}" +
      ".fo-ord-lane u{flex:0 0 22px;text-decoration:none;font-size:9.5px;color:#8a93a3;font-weight:700}" +
      ".fo-ord-lane.lax .lt{height:auto;gap:1px}" +
      ".fo-ord-lane.lax em{font-style:normal;font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:800;color:#33415e;text-align:center;min-width:0;overflow:hidden;white-space:nowrap}" +
      ".fo-ord-lane.lax .lt.lnum em{font-size:8px;color:#b0a67f}" +   // the over numbers stay quiet; only the phase words darken
      ".fo-ord-lane .lt.lnum{position:relative;display:block;height:10px}" +
      ".fo-ord-lane .lt.lnum em{position:absolute;top:0;transform:translateX(-50%);font-style:normal;font-size:7.5px;font-weight:700;color:#8a93a3;letter-spacing:0;text-transform:none}" +
      "html body #page .fo-ord-hero,html body.ftpskin #page .fo-ord-hero{display:flex;align-items:baseline;justify-content:center;gap:14px;flex-wrap:wrap;margin:8px 0 2px;text-align:center;background:transparent !important;border:none !important;box-shadow:none !important;padding:0 !important}" +
      "html body #page .fo-ord-hero .h-t{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.6px;font-size:27px;color:#0E233F !important;line-height:1.08}" +
      "html body #page .fo-ord-hero .h-v{font-family:Oswald,sans-serif;font-size:13px;color:#B04A2C !important;font-weight:600;text-transform:uppercase;letter-spacing:2px}" +
      "html body #page .fo-ord-herosub,html body.ftpskin #page .fo-ord-herosub{text-align:center;font-family:Oswald,sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:13px;font-weight:600;color:#33415e !important;margin:0 0 10px;background:transparent !important;border:none !important;box-shadow:none !important;padding:0 !important}" +
      "@media(max-width:600px){.fo-ord-hero .h-t{font-size:21px}.fo-ord-hero{gap:9px}}" +
      "@media(max-width:480px){.fo-ord-lane .ln{flex-basis:96px;font-size:9.5px}.fo-ord-lane.lax em{font-size:6.5px}.fo-ord-lane .lt.lnum em{font-size:6.5px}}" +
      ".fo-ord-tp{display:inline;background:none;border:none;padding:0;color:#b3bac4;font-size:7.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}" +
      ".fo-ord-tp + .fo-ord-tp:before{content:'· ';color:#d3d8de}" +
      ".fo-ord-xis .xc .r2{justify-content:space-between}" +
      ".fo-ord-xis .xc .r3,.fo-ord-bws .bw .r3{display:flex;flex-wrap:wrap;gap:3px;width:100%;min-height:11px;align-items:center}" +
      ".fo-ord-bws{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:6px;margin-top:8px}" +
      "html body.ftpskin #page .fo-ord-bws button.bw,html body #page .fo-ord-bws button.bw{display:flex;flex-direction:column;gap:3px;background:#FFFEFC !important;border:1px solid rgba(28,36,51,.12) !important;border-radius:9px;padding:5px 10px;cursor:pointer;text-align:left;min-width:0}" +
      ".fo-ord-toss{display:flex;align-items:center;gap:5px 12px;flex-wrap:nowrap}" +
      ".fo-ord-toss .tg{display:flex;align-items:center;gap:5px;flex-wrap:nowrap}" +
      ".fo-ord-toss .tl{font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:800;color:#8a93a3;white-space:nowrap}" +
      // the ftpskin base sheet sets 'font:bold 11.5px ... !important' and its
      // own padding on every button - the toss row's cuts must out-shout it
      "html body.ftpskin #page .fo-ord-toss button,html body #page .fo-ord-toss button{border:1px solid rgba(28,36,51,.16) !important;background:#FFFEFC !important;color:#3a4353 !important;border-radius:99px;padding:4px 9px !important;font-size:10.5px !important;font-weight:700;cursor:pointer;white-space:nowrap;min-height:0}" +
      "html body.ftpskin #page .fo-ord-toss button.on,html body #page .fo-ord-toss button.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      // the narrowest phones: shave gaps, padding and type until all four
      // choices still share the one line
      "@media(max-width:400px){.fo-ord-toss{gap:4px 8px}.fo-ord-toss .tg{gap:4px}.fo-ord-toss .tl{font-size:8.5px}" +
      "html body.ftpskin #page .fo-ord-toss button,html body #page .fo-ord-toss button{padding:3px 7px !important;font-size:9.5px !important}}" +
      "html body #page .fo-ord-bws button.bw:hover{border-color:#B04A2C !important}" +
      ".fo-ord-bws .bw-h{display:flex;align-items:center;gap:6px;width:100%;min-width:0}" +
      ".fo-ord-bws .bw-h i{width:10px;height:10px;border-radius:3px;flex:0 0 auto}" +
      ".fo-ord-bws .bw-h b{font-size:11.5px;font-weight:800;color:#243244;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-ord-bws .bw-h .bt{font-size:9px;letter-spacing:.04em;text-transform:uppercase;font-weight:800;color:#a06a2c;white-space:nowrap}" +
      ".fo-ord-bws .bw-h u{text-decoration:none;font-size:10px;color:#8a93a3;font-weight:700;margin-left:auto;flex:0 0 auto}" +
      ".fo-ord-bws .bw-r{display:flex;align-items:flex-end;gap:6px;flex-wrap:wrap;width:100%}" +
      ".fo-ord-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:14px;align-items:start}" +
      "@media(max-width:860px){.fo-ord-cols{grid-template-columns:1fr}}" +
      ".fo-ob-row{display:flex;align-items:center;gap:8px;padding:6px 8px;background:#FFFEFC;border:1px solid rgba(28,36,51,.08);border-radius:9px;margin:4px 0}" +
      ".fo-ob-n{flex:0 0 22px;height:22px;display:inline-flex;align-items:center;justify-content:center;background:#EEF2F7;color:#41577a;border-radius:50%;font-size:11px;font-weight:800}" +
      ".fo-ob-n.top{background:#F6E9CE;color:#8a5c13}" +
      ".fo-ob-who b s{text-decoration:none;color:#B04A2C;font-weight:800}" +
      ".fo-ob-who{flex:1;min-width:0}.fo-ob-who>b{display:block;font-size:13px;color:#0E233F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fo-ob-who .small{font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}" +
      "html body.ftpskin #page button.fo-ob-chip,html body #page button.fo-ob-chip{flex:0 0 auto;border:1px solid rgba(28,36,51,.2) !important;background:#FFFEFC !important;color:#8a93a3 !important;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:800;cursor:pointer}" +
      // a man's own instruction: the letter carries the colour of the risk
      "html body #page button.fo-ob-chip.fo-ob-mb{min-width:22px}" +
      "html body #page button.fo-ob-chip.mb-d{background:#EAF1F8 !important;color:#1D4E89 !important;border-color:rgba(29,78,137,.35) !important}" +
      "html body #page button.fo-ob-chip.mb-a{background:#FDF1E4 !important;color:#B0631A !important;border-color:rgba(176,99,26,.4) !important}" +
      "html body #page button.fo-ob-chip.mb-l{background:#FBE9E6 !important;color:#B23230 !important;border-color:rgba(178,50,48,.45) !important}" +
      // how each bowler is set when he has the ball
      ".fo-og-fh{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(28,36,51,.45);margin:12px 0 6px}" +
      ".fo-og-fields{display:flex;flex-direction:column;gap:5px}" +
      ".fo-og-frow{display:flex;align-items:center;gap:9px;flex-wrap:wrap}" +
      ".fo-og-frow>b{flex:1 1 90px;min-width:0;font-size:12.5px;color:#0E233F;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".fo-og-frow>span{display:flex;gap:3px;flex:0 0 auto}" +
      "html body.ftpskin #page button.fo-og-f,html body #page button.fo-og-f{border:1px solid rgba(28,36,51,.16) !important;background:#FFFEFC !important;color:#5a6472 !important;border-radius:999px;padding:4px 9px;font-size:10.5px;font-weight:700;cursor:pointer}" +
      "html body #page button.fo-og-f.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      "html body.ftpskin #page button.fo-ob-chip.on,html body #page button.fo-ob-chip.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      ".fo-ob-mv{display:flex;gap:3px}" +
      "html body.ftpskin #page .fo-ob-mv button,html body #page .fo-ob-mv button{border:1px solid rgba(28,36,51,.14) !important;background:#FBFAF7 !important;color:#5a6472 !important;border-radius:6px;font-size:9px;line-height:1;padding:6px 8px;cursor:pointer}" +
      "html body #page .fo-ob-mv button:disabled{opacity:.25;cursor:default}" +
      "html body.ftpskin #page button.fo-ob-swap,html body #page button.fo-ob-swap{color:#B04A2C !important;font-size:11px !important}" +
      ".fo-os-ph{display:flex;gap:10px;align-items:center;margin:7px 0;padding:8px 10px;background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:10px}" +
      ".fo-os-phl{flex:0 0 86px}.fo-os-phl b{display:block;font-size:12.5px;color:#0E233F}.fo-os-phl span{font-size:10.5px;color:#8a93a3}" +
      ".fo-os-slots{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
      "html body.ftpskin #page button.fo-os-slot,html body #page button.fo-os-slot{display:block;text-align:left;border:1px solid rgba(28,36,51,.14) !important;background:#FFFEFC !important;border-radius:9px;padding:6px 10px;cursor:pointer;min-width:0}" +
      ".fo-os-slot i{display:block;font-style:normal;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#b6bcc7;font-weight:800}" +
      ".fo-os-slot b{display:block;font-size:13px;color:#0E233F;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-os-slot b em{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px}" +
      ".fo-os-slot span{display:block;font-size:10.5px;color:#8a93a3}" +
      ".fo-os-ai{color:#8a93a3;font-weight:600}" +
      ".fo-os-tl{display:flex;align-items:center;margin:10px 0 6px}" +
      ".fo-os-tl i{flex:1;height:12px;margin-right:1px;border-radius:2px}" +
      ".fo-os-tl u{flex:0 0 5px}" +
      ".fo-os-tot{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:11px}" +
      ".fo-os-tchip{display:inline-flex;align-items:center;gap:5px;font-weight:700;color:#3a4353}.fo-os-tchip i{width:9px;height:9px;border-radius:2px;display:inline-block}" +
      ".fo-os-tchip.bad{color:#b3402a}" +
      ".fo-os-cov{margin-left:auto;color:#8a93a3}" +
      ".fo-os-warn{margin-top:7px;background:#F6E3B4;border:1px solid #e8cf8c;border-radius:8px;padding:6px 10px;font-size:11.5px;color:#5a4310;font-weight:600}" +
      ".fo-ord-tac{margin-top:12px;border-top:1px dashed rgba(28,36,51,.14);padding-top:8px}" +
      ".fo-ord-tach{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#41577a;font-weight:800;margin:9px 0 4px}" +
      ".fo-ord-tr3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:2px}" +
      ".fo-ord-cell{display:flex;flex-direction:column;gap:3px;min-width:0}" +
      ".fo-ord-cell span{font-size:10.5px;color:#5a6472;font-weight:700}" +
      ".fo-ord-cell select{width:100%;font-size:12px;padding:4px 6px;border-radius:8px;box-sizing:border-box}" +
      ".fo-ord-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}" +
      "@media(max-width:760px){.fo-ord-acts{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fo-ord-acts button{width:100%;min-height:44px;box-sizing:border-box;margin:0 !important}.fo-ord-acts .small{grid-column:1/-1;text-align:center}}" +
      "#fo-osheet{position:fixed;inset:0;background:rgba(10,18,32,.45);z-index:2600;display:flex;align-items:flex-end;justify-content:center}" +
      "@media(min-width:700px){#fo-osheet{align-items:center}}" +
      ".fo-osh-card{background:#FFFEFC;border-radius:16px 16px 0 0;max-width:520px;width:100%;max-height:72vh;overflow-y:auto;padding:12px 14px 16px;box-shadow:0 -8px 40px rgba(7,22,46,.3)}" +
      "@media(min-width:700px){.fo-osh-card{border-radius:16px}}" +
      ".fo-osh-h{display:flex;align-items:baseline;gap:10px;margin-bottom:8px}.fo-osh-h b{font-size:14px;color:#0E233F}" +
      "html body .fo-osh-h button{margin-left:auto;border:none;background:#E8EAEE;border-radius:8px;padding:4px 9px;cursor:pointer;color:#5a6472}" +
      "html body button.fo-osh-row{display:flex;width:100%;align-items:center;gap:10px;text-align:left;background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:10px;padding:8px 11px;margin:5px 0;cursor:pointer}" +
      "html body button.fo-osh-row:disabled{opacity:.45;cursor:default}" +
      ".fo-osh-row b{font-size:13px;color:#0E233F}.fo-osh-row .small{display:block}" +
      ".fo-osh-note{margin-left:auto;font-size:10.5px;color:#8a93a3;text-align:right}.fo-osh-note.bad{color:#b3402a}" +
      ".fo-osh-pt{display:inline-block;background:#EEE8FA;color:#5b4a91;border-radius:6px;padding:0 6px;font-size:9.5px;font-weight:700;margin-left:5px}" +
      ".fo-osh-ai b{color:#5a6472}" +
      "html body.ftpskin #page button.fo-og-tgl,html body #page button.fo-og-tgl{border:none !important;background:none !important;color:#B04A2C !important;font-weight:800;font-size:12px;cursor:pointer;padding:0}" +
      ".fo-og-pal{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:6px;margin-bottom:4px}" +
      ".fo-og-note{font-size:10.5px;color:#8a93a3;margin:0 0 9px}" +
      ".fo-og-hint{font-size:12.5px;color:#3a4353;margin-bottom:9px}" +
      "html body.ftpskin #page button.fo-og-b,html body #page button.fo-og-b{display:flex;width:100%;align-items:center;justify-content:flex-start;gap:7px;border:1px solid rgba(28,36,51,.16) !important;background:#FFFEFC !important;color:#0E233F !important;border-radius:11px;padding:6px 10px;font-size:12.5px;font-weight:700;cursor:pointer;min-width:0;white-space:nowrap;overflow:hidden}" +
      ".fo-og-bt{flex:1;min-width:0;text-align:left}" +
      ".fo-og-bt b{display:block;font-size:12.5px;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-og-bt i{display:block;font-style:normal;font-size:10px;font-weight:600;color:#8a93a3;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-og-b.on .fo-og-bt i{color:#c7cfda}" +
      ".fo-og-bt n{font-weight:800}" +
      "html body.ftpskin #page button.fo-og-clear,html body #page button.fo-og-clear{border-style:dashed !important;color:#8a3a28 !important;justify-content:center}" +
      "html body.ftpskin #page button.fo-og-b.on,html body #page button.fo-og-b.on{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      ".fo-og-b em{width:9px;height:9px;border-radius:2px;display:inline-block}" +
      ".fo-og-b u{text-decoration:none;color:#8a93a3;font-weight:600}.fo-og-b.on u{color:#c7cfda}" +
      ".fo-og-row{display:flex;gap:4px;align-items:center;margin:4px 0}" +
      ".fo-og-l{flex:0 0 56px;width:56px;max-width:56px;overflow:hidden;font-size:10px;color:#a7aeba;font-weight:700;text-align:right;padding-right:3px;line-height:1.25}" +
      "html body.ftpskin #page button.fo-og-c,html body #page button.fo-og-c{flex:1;min-width:0;height:36px;border:1px solid rgba(28,36,51,.14);background:#FBFAF7;color:#8a93a3;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;padding:0}" +
      ".fo-og-b s{text-decoration:none;background:#EEE8FA;color:#5b4a91;border-radius:5px;padding:0 4px;font-size:9px;font-weight:700}" +
      "html body.ftpskin #page button.fo-og-more,html body #page button.fo-og-more{border-style:dashed !important;color:#8a93a3 !important}" +
      ".fo-og-l i{display:block;font-style:normal;font-size:7.5px;color:#c0b9a8;text-transform:uppercase;letter-spacing:.03em;font-weight:800;white-space:nowrap}" +
      // phone: over cells are true squares - width drives height
      "@media(max-width:760px){" +
        "html body.ftpskin #page button.fo-og-c,html body #page button.fo-og-c{height:auto;min-height:0;padding:0;aspect-ratio:1/1;border-radius:6px;font-size:11px;line-height:1}" +
        ".fo-og-row{gap:3px}" +
      "}";
    document.head.appendChild(foOrdCss);
  } catch (e) {}
  try {
    if (typeof window.pgOrders === "function" && !window.pgOrders.__foNew) {
      var _foPgOrdOld = window.pgOrders;
      window.pgOrders = function () {
        try { foOrdersUI(); return; } catch (e) { console.warn("foOrdersUI", e); }
        return _foPgOrdOld.apply(this, arguments);
      };
      window.pgOrders.__foNew = 1;
    }
  } catch (e) {}

  // The engine repaints the whole Orders page on every control change (each
  // over-cell click in the bowling grid). Keep the manager's scroll position
  // when the page is merely re-rendering, so it stops jumping to the top.
  try {
    if (typeof window.pgOrders === "function" && !window.pgOrders.__foScroll) {
      var _foPgOrd = window.pgOrders;
      window.pgOrders = function () {
        var pgEl = document.getElementById("page");
        var wasOrders = !!(pgEl && /Batting order/.test(pgEl.textContent || ""));
        var y = window.scrollY || document.documentElement.scrollTop || 0;
        var out = _foPgOrd.apply(this, arguments);
        if (wasOrders) { try { window.scrollTo(0, y); } catch (e) {} }
        return out;
      };
      window.pgOrders.__foScroll = 1;
    }
  } catch (e) {}
  function foRefreshLineupButtons() {
    try {
      if (!(SYNC && SYNC.submitted)) return;
      document.querySelectorAll("button.fo-setr[data-r]").forEach(function (b) {
        var done = !!SYNC.submitted[+b.getAttribute("data-r")];
        b.classList.toggle("fo-setr-done", done);
        var want = done ? "\u2713 Orders ready" : (b.classList.contains("fo-setr-later") ? "Plan lineup" : "Set lineup");
        if (b.textContent !== want) b.textContent = want;
        b.title = done ? "Click to edit this round's lineup" : "";
      });
      // the club-home hero CTA answers to the same truth
      document.querySelectorAll("button.fo-next-cta[data-r]").forEach(function (b) {
        var r = +b.getAttribute("data-r");
        var done = !!SYNC.submitted[r] ||
          !!(App.orders && App.orders.saved && App.season && r === App.season.round);
        b.classList.toggle("fo-done", done);
        var want = done ? "Review lineup \u203a" : "Set lineup \u203a";
        if (b.textContent !== want) b.textContent = want;
      });
    } catch (e) {}
  }
  // any bare mention of a club or player becomes a link to their page.
  // Leaf elements only, exact-name match, with vs/at/@ prefixes tolerated.
  function foLinkifyNames() {
    try {
      var page = document.getElementById("page"); if (!page) return;
      var teams = {}, players = {};
      (GD.teams || []).forEach(function (t2, i2) {
        teams[t2.name] = i2;
        (t2.players || []).forEach(function (p2) { players[p2.name] = 1; });
      });
      page.querySelectorAll("td,b,span,em,h1,h2,h3,div").forEach(function (el) {
        if (el.__foLk || el.children.length) return;
        if (el.closest("a,button,select,label,.fo-search,#fo-onb,#fo-bell-panel,.fo-exp-card")) return;
        var txt = (el.textContent || "").trim();
        if (!txt || txt.length > 46) return;
        var m = txt.match(/^(?:vs |at |@ |from )?(.+?)(?:\s*\u2020)?$/);
        var core = m ? m[1] : txt;
        var kind = teams[core] !== undefined ? "t" : (players[core] ? "p" : null);
        if (!kind) return;
        el.__foLk = 1;
        el.classList.add("fo-lk");
        el.addEventListener("click", function (ev) {
          ev.stopPropagation();
          if (kind === "t") location.hash = "#/scout?t=" + teams[core];
          else location.hash = "#/player?n=" + encodeURIComponent(core);
          if (typeof window.route === "function") window.route();
        });
      });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foLinkifyNames, 350); setTimeout(foLinkifyNames, 1100); });
  // the live viewer's first seconds: show the welcome line the instant the
  // page opens instead of a blank feed while the slow ticker warms up
  function foMatchIntroTick() {
    try {
      if ((location.hash || "").split("?")[0] !== "#/match") return;
      if (typeof M === "undefined" || !M || M.done) return;
      var feed = document.querySelector("#page .commfeed") || document.querySelector("#page #ftpcomm");
      if (!feed || (feed.textContent || "").trim().length > 25) return;
      var line = null;
      (M.log || []).forEach(function (L) { if (L && L.intro && L.txt) line = L.txt; });
      if (!line) {
        var meta = (M.meta || App.pending || {});
        var home = meta.home || (M.user && M.user.name) || "", away = meta.away || (M.ai && M.ai.name) || "";
        line = "Welcome to " + (meta.ground || "the ground") + ": " + home + " v " + away + ", " + (meta.weather || "clear") + " conditions and a " + foPitchName(M.pitch || meta.pitch || "balanced") + " pitch." + (M.tossWinner ? " " + M.tossWinner + " won the toss." : "") + " The players are ready - let battle commence.";
      }
      var d = document.createElement("div"); d.className = "fo-intro-now"; d.textContent = line;
      feed.insertBefore(d, feed.firstChild);
    } catch (e) {}
  }
  setInterval(foMatchIntroTick, 600);
  // ---- ESPN-style pre-match preview: spoiler-safe, built from settled
  // rounds only (the round on air is excluded from every number here) ----
  function foMatchPreviewHTML(r, hideRd, facts) {
    var sn = App.seasonNo || 1;
    // settled-rounds table: points, wins, losses, position
    var pts = {}, w = {}, l = {}, pl = {};
    var rounds = foLeagueRounds();
    Object.keys(rounds).forEach(function (rd) {
      if (hideRd != null && +rd === hideRd) return;
      (rounds[rd] || []).forEach(function (r0) {
        if (!r0 || !r0.result) return;
        [r0.home, r0.away].forEach(function (nm) { pl[nm] = (pl[nm] || 0) + 1; });
        var wn = r0.result.winner;
        if (!wn) { pts[r0.home] = (pts[r0.home] || 0) + 1; pts[r0.away] = (pts[r0.away] || 0) + 1; }
        else { pts[wn] = (pts[wn] || 0) + 2; w[wn] = (w[wn] || 0) + 1; var ls = wn === r0.home ? r0.away : r0.home; l[ls] = (l[ls] || 0) + 1; }
      });
    });
    var order = (GD.teams || []).map(function (t) { return t.name; }).sort(function (a, b) { return (pts[b] || 0) - (pts[a] || 0) || (w[b] || 0) - (w[a] || 0); });
    var fm = foFormMap();
    var side = function (nm) {
      var t = null; (GD.teams || []).some(function (t0) { if (t0.name === nm) { t = t0; return true; } return false; });
      var pos = order.indexOf(nm) + 1;
      var pips = (fm[nm] || []).map(function (x) { return "<i class='fo-pip fo-" + x + "'></i>"; }).join("") || "<span class='small'>no matches yet</span>";
      // leaders from settled league innings only
      var bat = null, bowl = null;
      ((t && t.players) || []).forEach(function (p2) {
        var runs = 0, wk = 0;
        (((App.playerHist || {})[p2.name]) || []).forEach(function (e2) {
          if (e2.fr || e2.s !== sn) return;
          if (hideRd != null && (e2.r || 0) === hideRd + 1) return;
          runs += +e2.rr || 0; wk += +e2.w || 0;
        });
        if (runs > 0 && (!bat || runs > bat.v)) bat = { n: p2.name, v: runs };
        if (wk > 0 && (!bowl || wk > bowl.v)) bowl = { n: p2.name, v: wk };
      });
      return { bat: bat, bowl: bowl, html: "<div class='fo-pv-team'><b>" + E(nm) + "</b>" +
        "<div class='fo-pv-pos'>" + (pos > 0 && pl[nm] ? foOrdinal(pos) + " &middot; " + (pts[nm] || 0) + " pts &middot; " + (w[nm] || 0) + "&ndash;" + (l[nm] || 0) : "First match of the season") + "</div>" +
        "<div class='fo-pv-k'>Form</div><div class='fo-form'>" + pips + "</div>" +
        (bat ? "<div class='fo-pv-k'>Leading run-scorer</div><div class='fo-pv-p'>" + E(bat.n) + " <span>" + bat.v + " runs</span></div>" : "") +
        (bowl ? "<div class='fo-pv-k'>Leading wicket-taker</div><div class='fo-pv-p'>" + E(bowl.n) + " <span>" + bowl.v + " wkts</span></div>" : "") +
        "</div>" };
    };
    // head to head: settled meetings this season
    var meets = [];
    Object.keys(rounds).forEach(function (rd) {
      if (hideRd != null && +rd === hideRd) return;
      (rounds[rd] || []).forEach(function (r0) {
        if (!r0 || !r0.result) return;
        var pair = [r0.home, r0.away];
        if (pair.indexOf(r.home) >= 0 && pair.indexOf(r.away) >= 0) meets.push(r0);
      });
    });
    var h2hRows = meets.map(function (m2) { return "<div class='fo-pv-h2h'>" + E(m2.result.text) + " <span>R" + ((+m2.round || 0) + 1) + "</span></div>"; });
    // friendlies belong in the rivalry too
    try {
      (window.__foFrAll || []).forEach(function (cF) {
        if (!cF || cF.status !== "played" || !cF.result || !cF.result.result_text) return;
        var pairF = [cF.challenger_club, cF.opponent_club];
        if (!(pairF.indexOf(r.home) >= 0 && pairF.indexOf(r.away) >= 0)) return;
        if (typeof foFrBcastState === "function" && foFrBcastState(cF).phase !== "done") return;
        h2hRows.push("<div class='fo-pv-h2h'>" + E(cF.result.result_text) + " <span>FR</span></div>");
      });
    } catch (eFp) {}
    var h2h = h2hRows.length ? h2hRows.slice(-5).join("") : "<div class='small'>First meeting of the season.</div>";
    var hs = side(r.home), as2 = side(r.away);
    // the contests inside the contest: each side's big gun against the
    // other's most dangerous bowler
    var battles = [];
    if (hs.bat && as2.bowl) battles.push("<div class='fo-pv-h2h'><b>" + E(hs.bat.n) + "</b> (" + hs.bat.v + " runs) faces <b>" + E(as2.bowl.n) + "</b> (" + as2.bowl.v + " wkts)</div>");
    if (as2.bat && hs.bowl) battles.push("<div class='fo-pv-h2h'><b>" + E(as2.bat.n) + "</b> (" + as2.bat.v + " runs) faces <b>" + E(hs.bowl.n) + "</b> (" + hs.bowl.v + " wkts)</div>");
    var battleCard = battles.length ? "<div class='panel fo-keep'><h4>Key battles</h4><div class='pad'>" + battles.join("") + "</div></div>" : "";
    // what these conditions actually mean, in one breath
    var pr9 = FO_PITCH_READ[r.pitch], wr9 = FO_WX_READ[String(r.weather || "").trim().toLowerCase()];
    var condCard = (pr9 || wr9)
      ? "<div class='panel fo-keep'><h4>Reading the conditions</h4><div class='pad' style='font-size:13px;line-height:1.6;color:#3a4353'>" +
        [pr9, wr9 ? wr9.charAt(0).toUpperCase() + wr9.slice(1) + "." : null].filter(Boolean).join(" ") + "</div></div>"
      : "";
    return "<div class='fo-pv'>" +
      "<div class='panel fo-keep'><h4>Match preview</h4><div class='pad'><div class='fo-pv-grid'>" + hs.html + as2.html + "</div></div></div>" +
      "<div class='fo-pv-cols'><div class='panel fo-keep'><h4>Head to head</h4><div class='pad'>" + h2h + "</div></div>" +
      "<div class='panel fo-keep'><h4>Match facts</h4><div class='pad'>" +
      "<div class='fo-pv-fact'><span>Ground</span><b>" + E(r.ground || "&ndash;") + "</b></div>" +
      (r.pitch ? "<div class='fo-pv-fact'><span>Pitch</span><b>" + foPitchName(r.pitch) + "</b></div>" : "") +
      (r.weather ? "<div class='fo-pv-fact'><span>Weather</span><b>" + E(r.weather) + "</b></div>" : "") +
      "<div class='fo-pv-fact'><span>First ball</span><b>" + ((facts && facts.firstBall) || "9:00 AM ET") + "</b></div>" +
      "<div class='fo-pv-fact'><span>Lineups</span><b>" + ((facts && facts.lock) || "Locked at 8:00 AM ET") + "</b></div>" +
      ((facts && facts.extraFacts) || "") +
      "<div class='small' style='margin-top:8px'>Scores tick in ball by ball from " + ((facts && facts.firstBall) || "9:00") + "; the full card, charts and ratings arrive at stumps.</div>" +
      "</div></div>" + battleCard + condCard + "</div></div>";
  }
  // one-line cricket reads for every pitch and sky the league can serve up
  var FO_PITCH_READ = {
    balanced: "A fair surface: runs for batters who apply themselves, help for bowlers who hit their lengths.",
    flat: "A road. Par is high, bowlers need patience and changes of pace, and totals under 250 rarely survive.",
    green: "Grass on it: the new ball will move around, and the first ten overs could decide the whole match.",
    dry: "Dry and crumbling: spin grips harder as the innings wears on - runs on the board look twice as big.",
    slow: "The ball sits in this surface. Timing is hard, cutters and spinners hold it up, big totals are rare.",
    cracked: "A sticky, cracked top: uneven bounce rewards bowlers who attack the stumps and punishes lazy feet.",
    twoPaced: "Two-paced: some balls skid, some stop. Set batters cash in; fresh ones get strangled."
  };
  var FO_WX_READ = {
    sunny: "Fine batting weather - the ball goes soft and the outfield is quick",
    overcast: "cloud cover keeps the ball swinging all day - a gift for the seamers",
    humid: "heavy, humid air: swing early on, and every player's fatigue clock runs faster",
    hot: "energy-sapping heat - deep batting and short, sharp spells pay off",
    scorching: "brutal heat: fatigue is the hidden opponent, and a sixth bowling option is gold",
    drizzle: "drizzle about - just enough nibble to keep the seamers interested",
    windy: "gusty: hard work for flighted spin, and high catches become adventures",
    chilly: "cold hands and zip for the quicks early - watch the first spell",
    misty: "murky and slow to clear - the new ball will talk",
    "dew later": "dew arrives later: the ball gets slippery and chasing gets easier under it"
  };
  // stats-page tables list bare player names: stamp each with his club
  function foStatsClubTags() {
    try {
      if (!/^#\/stats/.test(location.hash || "")) return;
      var page = document.getElementById("page"); if (!page) return;
      var clubOf = {};
      (GD.teams || []).forEach(function (t) { (t.players || []).forEach(function (p2) { clubOf[p2.name] = t.name; }); });
      page.querySelectorAll("table td:first-child").forEach(function (td) {
        if (td.__foClubTag) return;
        var nm = (td.textContent || "").trim();
        if (!clubOf[nm]) return;
        td.__foClubTag = 1;
        var sp = document.createElement("span");
        sp.className = "fo-tclub";
        sp.textContent = clubOf[nm];
        td.appendChild(sp);
      });
    } catch (e) {}
  }
  function foRoundBands() {
    try {
      if (App.page !== "matches") return;
      document.querySelectorAll("#page tr>td:first-child").forEach(function (td) {
        if (/Round \d+ /.test(td.textContent || "") && td.colSpan > 1 && !td.parentNode.classList.contains("fo-rnd-head")) td.parentNode.classList.add("fo-rnd-head");
      });
    } catch (e) {}
  }
  function foPolishSquad() {
    try {
      var page = document.getElementById("page"); if (!page) return;
      // colour every engine skill bar by its value (green-only bars read as noise)
      page.querySelectorAll(".bar>i").forEach(function (i) {
        var v = parseFloat(i.style.width) || 0;
        i.style.background = v >= 75 ? "#16A34A" : v >= 50 ? "#4DA6A2" : v >= 30 ? "#F59E0B" : "#DC2626";
      });
      // the grid's Capt header is hard-coded unsortable · wire it up
      page.querySelectorAll("th").forEach(function (th) {
        if (th.textContent.replace(/[^A-Za-z]/g, "") !== "Capt" || th.__foWired) return;
        th.__foWired = 1; th.style.cursor = "pointer"; th.title = "Captaincy - click to sort";
        th.addEventListener("click", function () { try { window.gridSort("Capt"); } catch (e) {} });
      });
    } catch (e) {}
  }

  function foRenderTraining() {
    if (!/^#\/training/.test(location.hash || "")) return;
    // The Nets (league/18) owns training now; this renderer stands aside
    if (window.__foNets && typeof window.foRenderNetsPage === "function") { try { window.foRenderNetsPage(); } catch (e) {} return; }
    try { bumpBrand(); } catch (e) {}
    try { foTrainingPage(); } catch (e) { console.warn("foTrainingPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-training")); });
    } catch (e) {}
  }

  // Lift the boot veil (injected by build.sh) now that the brand CSS and the right
  // screen are in place · the engine's original UI never gets a frame to flash.
  try { var _bv = document.getElementById("fo-boot"); if (_bv) _bv.parentNode.removeChild(_bv); } catch (e) {}

  // Debug/test handle for the season planner's engine-facing helpers (no behaviour).
  try { window.__fol = { userFixtures: foUserFixtures, fixtureMeta: foFixtureMeta, plannerHTML: foPlannerHTML, smartBowling: foSmartBowling, countryPool: buildCountryPool, marketPool: foMarketPool, draftPrice: foDraftPrice }; } catch (e) {}

