// ---- 53-fa-cup.js — THE FA CUP PAGE (#/facup) -------------------------------
// Every nation's own knockout: all sixteen clubs, four Sundays, the lower-
// division club hosting with its groundsman's pitch, the final at the boss's
// ground. This page draws the bracket AS BANKED - the umpire's cup_matches
// rows served via the facup/<nation>/s<season> snapshot - and, before a tie
// is played, names the drawn field so a manager can see who stands between
// his club and the trophy. Deterministic draw = knowable offline; results
// only ever come from the served record.
(function () {
  "use strict";
  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function P() { return window.__foPlanet || null; }
  function hashPath() { return (location.hash || "").split("?")[0]; }
  function onPage() { return hashPath() === "#/facup"; }
  function qparam(k) {
    var q = (location.hash.split("?")[1] || "").split("&");
    for (var i = 0; i < q.length; i++) { var kv = q[i].split("="); if (kv[0] === k) return decodeURIComponent(kv[1] || ""); }
    return "";
  }
  function myNation() {
    try {
      var c = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (c && c.country) return c.country;
    } catch (e) {}
    try { return (window.__foLgAPI && window.__foLgAPI.nation && window.__foLgAPI.nation()) || "eng"; } catch (e2) { return "eng"; }
  }

  // ---- the served bracket, cached per nation+season -------------------------
  var CUP = {};                    // rid -> { body, at } | { missing: true }
  function want(rid, seasonNo, cb) {
    var key = rid + "|s" + seasonNo;
    if (CUP[key] && Date.now() - CUP[key].at < 120000) return cb(CUP[key].body || null);
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("facup/" + rid + "/s" + seasonNo) + "&select=body",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        CUP[key] = { body: (j && j[0] && j[0].body) || null, at: Date.now() };
        cb(CUP[key].body);
      })
      .catch(function () { CUP[key] = { body: null, at: Date.now() }; cb(null); });
  }

  // one cache and one request for the whole client: the fixture list wants
  // the same bracket this page does
  window.__foFaCup = { want: want };

  var STAGE_NM = { r16: "Round of 16", qf: "Quarter-finals", sf: "Semi-finals", final: "THE FINAL" };
  var STAGE_ORDER = ["r16", "qf", "sf", "final"];
  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  function flagOf(rid) { try { return ART() + "flags/" + window.__foCxAPI.flagFile(rid) + ".svg"; } catch (e) { return ""; } }
  // EVERY NATION RUNS THIS CUP. The umpire plays a knockout in all nineteen
  // leagues, so both cup pages carry the same flag rail: tap a flag, read
  // that nation's bracket.
  var FO_NAT_CODE = { win: "WI", rsa: "SA", nzl: "NZ", slk: "SL", bgd: "BAN" };
  function natRail(rid, base) {
    try {
      var regs = (window.__foCxAPI.regions() || []).filter(function (r) { return !r.final; });
      if (!regs.length) return "";
      return "<div class='fo-kb-natsw'><i>Every nation&rsquo;s cup</i><div class='fo-kb-nats'>" +
        regs.map(function (r) {
          return "<a class='fo-kb-nat" + (r.id === rid ? " on" : "") + "' href='" + base + "?n=" + r.id + "'>" +
            "<img src='" + flagOf(r.id) + "' alt='' onerror=\"this.style.display='none'\" title='" + E(r.nm) + "'><span title='" + E(r.nm) + "'>" + E(FO_NAT_CODE[r.id] || String(r.id || "").toUpperCase()) + "</span></a>";
        }).join("") + "</div></div>";
    } catch (e) { return ""; }
  }
  try { window.__foKbNatRail = natRail; } catch (eNr) {}
  function stageDay(st) {
    var p = P(); if (!p) return "";
    var FA = { r16: 6, qf: 13, sf: 20, final: 27 };
    return "Sunday, day " + (FA[st] + 1) + " of the season";
  }

  function render() {
    try {
      if (!onPage()) return;
      var page = document.getElementById("page"); if (!page) return;
      var rid = qparam("n") || myNation();
      var seasonNo = 1;
      try {
        var cal = P() && P().phaseOf ? P().phaseOf(Date.now()) : null;
        if (cal && cal.season >= 1) seasonNo = cal.season;
      } catch (e) {}
      var body = null, key = rid + "|s" + seasonNo;
      if (CUP[key]) body = CUP[key].body || null;
      else want(rid, seasonNo, function () { if (onPage()) render(); });

      var natNm = rid.toUpperCase();
      try { natNm = (window.__foCxAPI.regions() || []).filter(function (r) { return r.id === rid; })[0].nm || natNm; } catch (e2) {}

      var mine = null;
      try {
        var c = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
        if (c && c.country === rid) mine = c.slot;
      } catch (e3) {}

      // THE KNOCKOUT BOARD. A real cup page reads left to right: the sixteen,
      // the eight, the four, the final - so this one does too, as columns a
      // phone sweeps through and a desktop takes in whole. The Round of 16 is
      // drawn the morning the season opens (one seeded pull, knowable
      // offline); every later round is a FRESH draw made the Sunday it is
      // earned, so those columns hold their breath rather than pretend a path.
      var stages = { r16: null, qf: null, sf: null, final: null };
      if (body && body.stages) STAGE_ORDER.forEach(function (st) {
        if (body.stages[st] && body.stages[st].length) stages[st] = body.stages[st];
      });
      var ties0 = [], bySlot0 = {};
      if (!stages.r16) {
        try {
          var lg0 = window.__foWorldLg ? window.__foWorldLg.get(rid) : null;
          if (!lg0 && window.__foWorldLg && window.__foWorldLg.want)
            window.__foWorldLg.want(rid, function () { if (onPage()) render(); });
          var divOf0 = {};
          if (lg0) {
            ((lg0.divisions || {})["1"] || []).forEach(function (x) { divOf0[x] = 1; });
            ((lg0.divisions || {})["2"] || []).forEach(function (x) { divOf0[x] = 2; });
            ((lg0.table || []).concat(lg0.table2 || [])).forEach(function (r) { bySlot0[r.slot] = r.name; });
          }
          try {
            var nmMap0 = window.__foWorldNames && window.__foWorldNames.get(rid);
            if (nmMap0) Object.keys(nmMap0).forEach(function (k) { bySlot0[k] = nmMap0[k]; });
          } catch (eNm0) {}
          if (!Object.keys(bySlot0).length && P() && P().sidesOf)
            (P().sidesOf(rid) || []).forEach(function (s0) { bySlot0[s0.slot] = s0.name; if (s0.div) divOf0[s0.slot] = s0.div; });
          for (var sD0 = 0; sD0 < 16; sD0++) if (!divOf0[sD0]) divOf0[sD0] = sD0 < 8 ? 1 : 2;
          if (P() && P().faDrawR16) ties0 = P().faDrawR16(rid, seasonNo, null, divOf0);
        } catch (eD0) {}
      }

      var html = "<div class='fo-fa-page'>" +
        "<div class='fo-kb-hero'><div><span class='eb'>The national knockout &middot; season&nbsp;" + (window.foSeasonN ? foSeasonN(seasonNo) : seasonNo) + "</span>" +
        "<h1>The " + E(natNm) + " Cup</h1>" +
        "<p>Sixteen clubs, four Sundays, one trophy. Every round a fresh draw.</p></div>" +
        "<svg class='tro' viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='#E8B96A' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M7 4h10v5a5 5 0 0 1-10 0V4Z'/><path d='M7 5H4.5a0 0 0 0 0 0 0c0 2.8 1.1 4.4 2.9 4.9M17 5h2.5c0 2.8-1.1 4.4-2.9 4.9'/><path d='M12 14v3M9.5 20h5M10 17h4'/></svg></div>" +
        natRail(rid, "#/facup");
      if (body && body.champion) {
        html += "<div class='fo-fa-champ'><span>&#127942;</span><div><i>Cup winners, season " + (window.foSeasonN ? foSeasonN(seasonNo) : seasonNo) + "</i><b>" +
          E(body.champion) + "</b></div></div>";
      }

      var TIE_N = { r16: 8, qf: 4, sf: 2, final: 1 };
      // every side of every tie is a door to that club's own page
      var row = function (nm, sc, win, me2, dim, href) {
        var tag = href ? "a" : "span";
        return "<" + tag + " class='t" + (win ? " w" : "") + (me2 ? " me" : "") + (dim ? " d" : "") + "'" +
          (href ? " href='" + href + "'" : "") + ">" +
          "<b>" + E(nm) + "</b>" + (sc ? "<u>" + E(sc) + "</u>" : "") + "</" + tag + ">";
      };
      var teamHref = function (c, s) {
        return s == null ? "" : "#/team?c=" + encodeURIComponent(c || rid) + "&s=" + (s | 0);
      };
      var colOf = function (st) {
        var inner = "", i;
        if (stages[st]) {
          inner = stages[st].map(function (t) {
            var aWin = t.winner === (t.a && t.a.name), bWin = t.winner === (t.b && t.b.name);
            var done = !!t.winner;
            var meA = mine != null && t.a && (t.a.slot | 0) === (mine | 0);
            var meB = mine != null && t.b && (t.b.slot | 0) === (mine | 0);
            return "<div class='fo-kb-tw'><div class='fo-kb-tie'>" +
              row(t.a && t.a.name, t.as_ || "", aWin, meA, done && !aWin, teamHref(t.a && t.a.country, t.a && t.a.slot)) +
              row(t.b && t.b.name, t.bs_ || "", bWin, meB, done && !bWin, teamHref(t.b && t.b.country, t.b && t.b.slot)) +
              (t.text ? "<i class='ln'>" + E(t.text) + "</i>" : "") + "</div></div>";
          }).join("");
        } else if (st === "r16" && ties0.length && Object.keys(bySlot0).length) {
          inner = ties0.map(function (t0) {
            var meA0 = mine != null && (t0[0] | 0) === (mine | 0);
            var meB0 = mine != null && (t0[1] | 0) === (mine | 0);
            return "<div class='fo-kb-tw'><div class='fo-kb-tie'>" +
              row(bySlot0[t0[0]] || "Club " + t0[0], "", false, meA0, false, teamHref(rid, t0[0])) +
              row(bySlot0[t0[1]] || "Club " + t0[1], "", false, meB0, false, teamHref(rid, t0[1])) + "</div></div>";
          }).join("");
        } else {
          for (i = 0; i < TIE_N[st]; i++)
            inner += "<div class='fo-kb-tw'><div class='fo-kb-tie tbd'><span>" +
              (st === "r16" ? "The draw awaits" : "To be drawn") + "</span></div></div>";
        }
        return "<div class='fo-kb-col kb-" + st + "'><h4>" + STAGE_NM[st] + "<span>" + stageDay(st) + "</span></h4>" +
          "<div class='fo-kb-ties'>" + inner + "</div></div>";
      };
      html += "<div class='fo-kb'><div class='fo-kb-in'>" + STAGE_ORDER.map(colOf).join("") + "</div></div>" +
        "<p class='fo-kb-note'>One hat, both divisions; the lower-division club hosts. Each later round is " +
        "drawn afresh from the survivors the Sunday it is earned.</p>";
      html += "</div>";
      page.innerHTML = html;
      css();
    } catch (e) { /* a cup page must never take the shell down */ }
  }

  function css() {
    var CSS = [
      "html body #page .fo-fa-page{max-width:980px;margin:0 auto;padding:12px 14px 40px}",
      // ---- the knockout board: shared by the FA Cup and the Colts Cup ------
      "html body #page .fo-kb-hero{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:space-between;gap:14px;background:linear-gradient(135deg,#14243A,#16324f 70%,#1d3c5c);border-radius:16px;border-bottom:3px solid #C9571F;padding:22px 20px;margin:6px 0 14px;color:#FFFEFC}",
      "html body #page .fo-kb-hero .eb{font:700 11px/1 Inter,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#E8B96A}",
      "html body #page .fo-kb-hero h1{font-family:Fraunces,serif;font-weight:600;font-size:clamp(26px,6vw,38px);margin:6px 0 4px;color:#FFFEFC}",
      "html body #page .fo-kb-hero p{margin:0;font:400 12.5px/1.5 Fraunces,serif;color:rgba(255,254,252,.7)}",
      "html body #page .fo-kb-hero .tro{width:52px;height:52px;opacity:.95;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}",
      "html body #page .fo-kb{overflow-x:auto;scrollbar-width:thin;margin:0 -14px;padding:2px 14px 8px;-webkit-overflow-scrolling:touch;mask-image:linear-gradient(90deg,#000 92%,transparent)}",
      "html body #page .fo-kb-in{display:flex;gap:28px;min-width:max-content}",
      "html body #page .fo-kb-col{flex:none;width:216px;display:flex;flex-direction:column}",
      "html body #page .fo-kb-col h4{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 0 8px;font:700 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#14202F;border-bottom:2px solid #14243A;padding-bottom:7px}",
      "html body #page .fo-kb-col h4 span{font:600 11px/1.3 Inter,sans-serif;letter-spacing:.06em;color:#8a6d3b;text-align:right}",
      "html body #page .fo-kb-ties{display:flex;flex-direction:column;height:596px}",
      "html body #page .fo-kb-tw{flex:1;display:flex;align-items:center;position:relative;padding:5px 0}",
      "html body #page .fo-kb-tie{width:100%;background:#fff;border:1px solid rgba(14,35,63,.16);border-radius:10px;overflow:hidden;box-shadow:0 2px 6px rgba(14,35,63,.06)}",
      "html body #page .fo-kb-tie .t{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 10px;font:500 13px/1.3 Inter,sans-serif;color:#14202F}",
      "html body #page .fo-kb-tie a.t,html body.ftpskin #page .fo-kb-tie a.t,html body #page .fo-kb-tie a.t:visited,html body #page .fo-kb-tie a.t:active{color:#14202F !important;text-decoration:none !important}",
      "html body #page .fo-kb-tie a.t:hover{text-decoration:none !important;background:rgba(14,35,63,.05)}",
      "html body #page .fo-kb-tie a.t:hover b{text-decoration:underline}",
      "html body #page .fo-kb-tie .t+.t{border-top:1px solid rgba(14,35,63,.09)}",
      "html body #page .fo-kb-tie .t b{font-weight:500;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-kb-tie .t u{text-decoration:none;font:700 13px/1 Inter,sans-serif;font-variant-numeric:tabular-nums;color:#9FB0C6;white-space:nowrap}",
      "html body #page .fo-kb-tie .t.w{background:rgba(23,122,87,.07)}",
      "html body #page .fo-kb-tie .t.w b{font-weight:700}",
      "html body #page .fo-kb-tie .t.w u{color:#177A57}",
      "html body #page .fo-kb-tie .t.d b{color:rgba(20,32,47,.45)}",
      "html body #page .fo-kb-tie .t.me{box-shadow:inset 3px 0 0 #C9571F}",
      "html body #page .fo-kb-tie .t .ff{font:700 11px/1 Inter,sans-serif;letter-spacing:.1em;color:#B23230;text-transform:uppercase}",
      "html body #page .fo-kb-tie .ln{display:block;padding:4px 10px 6px;font:400 12px/1.35 Fraunces,serif;color:rgba(20,32,47,.5);border-top:1px solid rgba(14,35,63,.07)}",
      "html body #page .fo-kb-tie.tbd{border-style:dashed;background:transparent;box-shadow:none}",
      "html body #page .fo-kb-tie.tbd span{display:block;padding:13px 10px;font:600 11px/1 Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,32,47,.35);text-align:center}",
      "html body #page .fo-kb-note{font:400 13px/1.55 Inter,sans-serif;color:rgba(20,32,47,.55);margin:10px 2px 0;max-width:70ch}",
      // the Champions Cup: four group cards above a three-column knockout
      "html body #page .fo-kb-groups{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:2px 0 16px}",
      "html body #page .fo-kb-gcard{background:#fff;border:1px solid rgba(14,35,63,.14);border-radius:12px;padding:10px 12px 12px;box-shadow:0 2px 6px rgba(14,35,63,.05)}",
      "html body #page .fo-kb-gcard h4{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:0 0 8px;font:700 11px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#14202F;border-bottom:2px solid #14243A;padding-bottom:7px}",
      "html body #page .fo-kb-gcard h4 span{font:600 11px/1.3 Inter,sans-serif;letter-spacing:.06em;color:#8a6d3b;text-align:right}",
      "html body #page .fo-kb-gcard .fo-kb-tie{margin-top:7px}",
      "html body #page .fo-kb-in.kb-short .fo-kb-ties{height:330px}",
      // the nineteen nations' rail: tap a flag, read that nation's cup
      "html body #page .fo-kb-natsw{margin:0 0 14px;background:#fff;border:1px solid rgba(14,35,63,.14);border-radius:13px;padding:9px 12px 6px}",
      "html body #page .fo-kb-natsw>i{display:block;font:700 11px/1 Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,32,47,.5);font-style:normal;margin-bottom:7px}",
      "html body #page .fo-kb-nats{display:flex;gap:12px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;mask-image:linear-gradient(90deg,#000 94%,transparent);-webkit-mask-image:linear-gradient(90deg,#000 94%,transparent)}",
      "html body #page .fo-kb-nats::-webkit-scrollbar{display:none}",
      "html body #page .fo-kb-nat{flex:none;display:flex;flex-direction:column;align-items:center;gap:4px;text-decoration:none !important;opacity:.75}",
      "html body #page .fo-kb-nat img{width:30px;height:21px;object-fit:cover;border-radius:4px;border:2px solid transparent;box-shadow:0 1px 3px rgba(14,35,63,.2)}",
      "html body #page .fo-kb-nat.on{opacity:1}",
      "html body #page .fo-kb-nat.on img{border-color:#C9571F;box-shadow:0 0 0 3px rgba(201,85,50,.16)}",
      "html body #page .fo-kb-nat span{font:700 11px/1 Inter,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:rgba(20,32,47,.55) !important;max-width:64px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "html body #page .fo-kb-nat.on span{color:#B44A22 !important}",
      // the connector plumbing (only boards that opt in wear it: the Colts
      // bracket is fixed; the FA Cup redraws each round and stays unlinked)
      "html body #page .fo-kb-in.linked .fo-kb-col:not(:last-child) .fo-kb-tw:after{content:'';position:absolute;right:-15px;width:14px;border-color:rgba(14,35,63,.28);border-style:solid;border-width:0}",
      "html body #page .fo-kb-in.linked .fo-kb-col:not(:last-child) .fo-kb-tw:nth-child(odd):after{top:50%;bottom:0;border-top-width:2px;border-right-width:2px;border-top-right-radius:8px}",
      "html body #page .fo-kb-in.linked .fo-kb-col:not(:last-child) .fo-kb-tw:nth-child(even):after{top:0;bottom:50%;border-bottom-width:2px;border-right-width:2px;border-bottom-right-radius:8px}",
      "html body #page .fo-kb-in.linked .fo-kb-col:not(:first-child) .fo-kb-tw:before{content:'';position:absolute;left:-15px;width:15px;top:50%;border-top:2px solid rgba(14,35,63,.28)}",
      "html body #page .fo-fa-hero{padding:18px 4px 10px}",
      "html body #page .fo-fa-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a6d3b}",
      "html body #page .fo-fa-hero h1{font-family:Fraunces,serif;font-size:34px;margin:4px 0 6px}",
      "html body #page .fo-fa-hero p{color:#5b5b56;max-width:56ch}",
      "html body #page .fo-fa-champ{display:flex;gap:12px;align-items:center;background:#fdf6e3;border:1px solid #e8d9ab;border-radius:12px;padding:12px 16px;margin:10px 0}",
      "html body #page .fo-fa-champ span{font-size:28px}",
      "html body #page .fo-fa-champ i{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a6d3b;font-style:normal}",
      "html body #page .fo-fa-champ b{font-family:Fraunces,serif;font-size:20px}",
      "html body #page .fo-fa-card{background:#fff;border:1px solid #e6e3da;border-radius:12px;padding:14px 16px;margin:12px 0}",
      "html body #page .fo-fa-card h3{display:flex;justify-content:space-between;align-items:baseline;font-family:Fraunces,serif;font-size:17px;margin:0 0 8px}",
      "html body #page .fo-fa-card h3 span{font-size:11px;color:#98938a;font-weight:400}",
      "html body #page .fo-fa-tie{display:flex;gap:10px;align-items:center;padding:7px 0;border-top:1px solid #f0ede4}",
      "html body #page .fo-fa-tie .side{flex:1;display:flex;justify-content:space-between;gap:8px;color:#6a675f}",
      "html body #page .fo-fa-tie .side u{text-decoration:none;font-variant-numeric:tabular-nums;color:#98938a}",
      "html body #page .fo-fa-tie .side.w{color:#1d1c19;font-weight:600}",
      "html body #page .fo-fa-tie .side.w u{color:#177A57}",
      "html body #page .fo-fa-tie .side.me{box-shadow:inset 3px 0 0 var(--nac,#C9571F);padding-left:6px}",
      "html body #page .fo-fa-tie .vs{font-size:11px;color:#b5b0a5}",
      "html body #page .fo-fa-line{font-size:12px;color:#8a867d;margin:2px 0 6px}",
      "html body #page .fo-fa-card .dim{color:#8a867d}"
    ].join("\n");
    var s = document.getElementById("fo-fa-css");
    if (!s) { s = document.createElement("style"); s.id = "fo-fa-css"; document.head.appendChild(s); }
    s.textContent = CSS;
  }

  // ---- THE CHAMPIONS CUP, AS BANKED ----------------------------------------
  // #/cup's own module still draws the old synthetic bracket. When the World
  // Service HAS banked the real thing - four groups of four, then quarters,
  // semis, the final - this paints over it with the served record. Absent a
  // snapshot (offline, old world), the synthetic page stands untouched.
  var CC = {};
  function wantCC(seasonNo, cb) {
    var key = "s" + seasonNo;
    if (CC[key] && Date.now() - CC[key].at < 120000) return cb(CC[key].body || null);
    fetch(SB_URL + "/rest/v1/world_snapshots?key=eq." + encodeURIComponent("cup/s" + seasonNo) + "&select=body",
      { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.json(); })
      .then(function (j) { CC[key] = { body: (j && j[0] && j[0].body) || null, at: Date.now() }; cb(CC[key].body); })
      .catch(function () { CC[key] = { body: null, at: Date.now() }; cb(null); });
  }
  function renderCC() {
    try {
      if (hashPath() !== "#/cup") return;
      var page = document.getElementById("page"); if (!page) return;
      var seasonNo = 1;
      try { var cal = P() && P().phaseOf ? P().phaseOf(Date.now()) : null; if (cal && cal.season >= 1) seasonNo = cal.season; } catch (e) {}
      var key = "s" + seasonNo, body = CC[key] ? CC[key].body : undefined;
      if (body === undefined) { wantCC(seasonNo, function () { renderCC(); }); body = null; }
      var banked = !!(body && body.stages && body.stages.g1);

      var html = "<div class='fo-fa-page'>" +
        "<div class='fo-kb-hero'><div><span class='eb'>The sixteen champions &middot; season&nbsp;" + (window.foSeasonN ? foSeasonN(seasonNo) : seasonNo) + "</span>" +
        "<h1>The Champions Cup</h1>" +
        "<p>The champions of the national leagues meet in the closing week: three group days, then a straight knockout.</p></div>" +
        "<svg class='tro' viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='#E8B96A' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'><path d='M7 4h10v5a5 5 0 0 1-10 0V4Z'/><path d='M7 5H4.5a0 0 0 0 0 0 0c0 2.8 1.1 4.4 2.9 4.9M17 5h2.5c0 2.8-1.1 4.4-2.9 4.9'/><path d='M12 14v3M9.5 20h5M10 17h4'/></svg></div>";
      if (banked && body.champion) {
        html += "<div class='fo-fa-champ'><span>&#127942;</span><div><i>Champions of the world, season " + (window.foSeasonN ? foSeasonN(seasonNo) : seasonNo) +
          "</i><b>" + E(body.champion) + "</b></div></div>";
      }

      // a side of a Champions Cup tie carries its passport (country + slot),
      // so every name on the board is a door to that club's page
      var ccRow = function (side, sc, win, dim) {
        var href = side && side.slot != null && side.country
          ? "#/team?c=" + encodeURIComponent(side.country) + "&s=" + (side.slot | 0) : "";
        var tag = href ? "a" : "span";
        return "<" + tag + " class='t" + (win ? " w" : dim ? " d" : "") + "'" + (href ? " href='" + href + "'" : "") + ">" +
          "<b>" + E(side && side.name) + "</b>" + (sc ? "<u>" + E(sc) + "</u>" : "") + "</" + tag + ">";
      };
      // ---- the groups: four cards, Mon-Wed of the closing week --------------
      var GN = ["Group A", "Group B", "Group C", "Group D"];
      var groups = [[], [], [], []];
      if (banked) ["g1", "g2", "g3"].forEach(function (st) {
        (body.stages[st] || []).forEach(function (t) { groups[Math.floor((t.gi | 0) / 2)].push(t); });
      });
      html += "<div class='fo-kb-groups'>" + GN.map(function (gn, gx) {
        var inner = "";
        if (banked && groups[gx].length) {
          inner = groups[gx].map(function (t) {
            var aWin = t.winner === (t.a && t.a.name), bWin = t.winner === (t.b && t.b.name);
            var done = !!t.winner;
            return "<div class='fo-kb-tie'>" +
              ccRow(t.a, t.as_ || "", aWin, done && !aWin) +
              ccRow(t.b, t.bs_ || "", bWin, done && !bWin) + "</div>";
          }).join("");
        } else {
          for (var i = 0; i < 4; i++) inner += "<div class='fo-kb-tie tbd'><span>League champion</span></div>";
        }
        return "<div class='fo-kb-gcard'><h4>" + gn + "<span>Mon&ndash;Wed, closing week</span></h4>" + inner + "</div>";
      }).join("") + "</div>";

      // ---- the knockout: quarters Friday, semis Saturday, the final Sunday --
      var KO = [["qf", "Quarter-finals", "Friday, closing week", 4], ["sf", "Semi-finals", "Saturday, closing week", 2], ["final", "THE FINAL", "Sunday, closing week", 1]];
      html += "<div class='fo-kb'><div class='fo-kb-in linked kb-short'>" + KO.map(function (sd) {
        var ties = banked ? body.stages[sd[0]] : null, inner = "", i;
        if (ties && ties.length) {
          inner = ties.map(function (t) {
            var aWin = t.winner === (t.a && t.a.name), bWin = t.winner === (t.b && t.b.name);
            var done = !!t.winner;
            return "<div class='fo-kb-tw'><div class='fo-kb-tie'>" +
              ccRow(t.a, t.as_ || "", aWin, done && !aWin) +
              ccRow(t.b, t.bs_ || "", bWin, done && !bWin) +
              (t.text ? "<i class='ln'>" + E(t.text) + "</i>" : "") + "</div></div>";
          }).join("");
        } else {
          for (i = 0; i < sd[3]; i++)
            inner += "<div class='fo-kb-tw'><div class='fo-kb-tie tbd'><span>&mdash;</span></div></div>";
        }
        return "<div class='fo-kb-col'><h4>" + sd[1] + "<span>" + sd[2] + "</span></h4><div class='fo-kb-ties'>" + inner + "</div></div>";
      }).join("") + "</div></div>" +
        "<p class='fo-kb-note'>Sixteen champions, four groups of four; the top two in each group go through. " +
        "Every match of it is banked by the umpire and replayable in the theatre.</p>";
      html += "</div>";

      // the old synthetic cup repaints on a timer; a cheap identity check
      // keeps this board from blinking every 1.2 seconds under it
      if (page.__foCupHtml === html && page.querySelector(".fo-fa-page")) return;
      page.__foCupHtml = html;
      page.innerHTML = html;
      css();
      try { document.body.classList.remove("fo-boss-on"); } catch (eBc) {}
    } catch (e) { /* never take the shell down */ }
  }

  function paint() { render(); renderCC(); }
  window.addEventListener("hashchange", function () { setTimeout(paint, 30); });
  document.addEventListener("DOMContentLoaded", function () { setTimeout(paint, 60); });
  setTimeout(paint, 120);
  // ONE export, assembled once: a second `window.__foFaCup = {...}` here used
  // to clobber the `want` handed out at the top, so the fixture list's guarded
  // `__foFaCup.want` silently never fired and its cup card read nothing.
  window.__foFaCup = { want: want, render: render, renderCC: renderCC, css: css };
  // AND A DOOR THE ROUTER KNOWS. Painting on hashchange is not enough: the
  // router's own table is what decides whether #/facup survives at all, and a
  // page missing from it is bounced to the front door before it can paint.
  window.foRenderFaCupPage = function () { render(); renderCC(); };
})();
