/* ============================================================================
   THE TRANSFER MARKET (#/market) — the biggest thing in a manager's day.

   THE SEALED BID. You never see anybody else's offer and nobody ever sees
   yours, so there is no reason on earth to sit refreshing this page. A
   listing stands three world days; when the window shuts the umpire opens the
   envelopes and the highest offer at or above the seller's reserve takes him.
   The money moves, the man moves, and neither club had to be awake.

   THE SCOUT. Your own numbers are yours. A man you do not own is a first
   impression - his trade, his age, roughly his class - until you pay somebody
   to go and watch him, and then he is bands and words. Nobody ever gets a
   rival's skill values, on this page or anywhere else.

   Both screens, no compromise: one column of proper cards on a phone, three
   across on a desk, and every control a thumb can hit.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foMkt) return; window.__foMkt = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var EPOCH = Date.UTC(2026, 6, 28), DAY = 86400000;
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function today() { return Math.floor((Date.now() - EPOCH) / DAY); }
  function money(v) {
    var n = Number(v) || 0, neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 2).replace(/\.?0+$/, "") + "m"
      : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
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
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function snapshot(key) {
    return sel("world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body")
      .then(function (rows) { return rows && rows[0] && rows[0].body; });
  }

  var ST = { tab: "board", busy: 0 };

  function css() {
    try { if (window.__foRoomCss) window.__foRoomCss(); } catch (e) {}
    if (document.getElementById("fo-mk-css")) return;
    var s = document.createElement("style"); s.id = "fo-mk-css";
    s.textContent = [
      "@media(min-width:900px){html body #page .fo-ac.fo-mk-wide{max-width:1080px}}",
      "html body #page .fo-mk-seg{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 10px}",
      "html body #page .fo-mk-seg button{font:700 10px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:rgba(20,28,40,.6) !important;background:transparent !important;border:1px solid rgba(20,28,40,.2) !important;border-radius:999px !important;padding:0 15px !important;min-height:44px;display:inline-flex;align-items:center;cursor:pointer}",
      "html body #page .fo-mk-seg button.on{color:#FFFEFC !important;background:#141C28 !important;border-color:#141C28 !important}",
      "html body #page .fo-mk-grid{display:grid;grid-template-columns:1fr;gap:10px}",
      "@media(min-width:700px){html body #page .fo-mk-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
      "@media(min-width:1000px){html body #page .fo-mk-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}",
      "html body #page .fo-mk-card{display:flex;flex-direction:column;gap:8px;background:#FFFEFC;border:1px solid rgba(20,28,40,.12);border-radius:16px;padding:13px 14px;box-shadow:0 6px 18px rgba(20,28,40,.05)}",
      "html body #page .fo-mk-card.mine{border-color:rgba(176,74,44,.45);background:rgba(250,238,230,.7)}",
      "html body #page .fo-mk-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}",
      "html body #page .fo-mk-h b{font:600 16px/1.15 'Fraunces',Georgia,serif;color:#141C28}",
      "html body #page .fo-mk-h u{text-decoration:none;font:600 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#8A6A1F}",
      "html body #page .fo-mk-sub{font:500 11.5px/1.45 Inter,sans-serif;color:rgba(20,28,40,.6)}",
      "html body #page .fo-mk-sub b{color:rgba(20,28,40,.85)}",
      "html body #page .fo-mk-rep{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-top:2px}",
      "html body #page .fo-mk-rep div{background:rgba(20,28,40,.045);border-radius:9px;padding:7px 9px}",
      "html body #page .fo-mk-rep i{display:block;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:rgba(20,28,40,.45);font-style:normal}",
      "html body #page .fo-mk-rep b{display:block;font:600 13px/1.2 Inter,sans-serif;color:#141C28;margin-top:3px}",
      "html body #page .fo-mk-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin-top:2px}",
      "html body #page .fo-mk-row input{flex:1 1 110px;min-width:0;font:600 13px/1 Inter,sans-serif;border:1px solid rgba(20,28,40,.2);border-radius:11px;padding:0 12px;min-height:44px;background:#fff;color:#141C28}",
      "html body #page .fo-mk-btn{font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#FFFEFC !important;background:linear-gradient(180deg,#E8894A,#C8542F) !important;border:0 !important;border-radius:999px !important;padding:0 17px !important;min-height:44px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}",
      "html body #page .fo-mk-btn.ghost{background:transparent !important;border:1px solid rgba(20,28,40,.25) !important;color:rgba(20,28,40,.65) !important}",
      "html body #page .fo-mk-btn[disabled]{opacity:.45;cursor:default}",
      "html body #page .fo-mk-clock{font:600 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B04A2C;margin-left:auto}",
      "html body #page .fo-mk-clock.soon{color:#B23230}",
      "html body #page .fo-mk-deal{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 2px;border-top:1px solid rgba(20,28,40,.07);font:500 12.5px/1.4 Inter,sans-serif}",
      "html body #page .fo-mk-deal b{color:#141C28;font-weight:600}",
      "html body #page .fo-mk-deal em{font-style:normal;color:rgba(20,28,40,.45)}",
      "html body #page .fo-mk-deal u{text-decoration:none;margin-left:auto;font-variant-numeric:tabular-nums;color:#177A57;font-weight:700}",
      "html body #page .fo-mk-msg{font:500 12px/1.45 Inter,sans-serif;color:#B23230;margin-top:4px}",
      "html body #page .fo-mk-msg.ok{color:#177A57}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function shell(body) {
    // the board wants width on a desk - three men across rather than two in a
    // column half the screen wide - and exactly the same room on a phone
    return "<div class='fo-ac fo-mk-wide' data-fo-owntable><div class='fo-ac-in'>" +
      "<div class='fo-ac-hero'><div class='fo-ac-k'>The transfer market</div>" +
      "<h1>Buying &amp; Selling</h1>" +
      "<p>Offers are sealed and windows last three days &mdash; nobody can outbid you by being awake at the right minute. Pay a scout to see a man properly; when the window shuts the umpire opens the envelopes.</p></div>" +
      body +
      "<div class='fo-ac-foot'><a href='#/worldclub'>&lsaquo; Your world club</a><a href='#/finance'>The books &rsaquo;</a></div>" +
      "</div></div>";
  }

  window.foRenderMarketPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Walking down to the market&hellip;</div>");
    Promise.all([
      snapshot("market"),
      jwt() ? rpc("world_market_mine").catch(function () { return null; }) : Promise.resolve(null),
      jwt() ? rpc("world_my_status").catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (d) {
      render(page, d[0] || { listings: [], deals: [] }, d[1], d[2]);
    }).catch(function (e) {
      page.innerHTML = shell("<div class='fo-ac-note'>The market could not be reached (" +
        E(String(e && e.message).slice(0, 90)) + "). Try again in a minute.</div>");
    });
  };

  function closesIn(d) {
    var left = (d | 0) - today();
    return left <= 0 ? { txt: "shuts today", soon: true }
      : { txt: left + " day" + (left === 1 ? "" : "s") + " left", soon: left <= 1 };
  }

  function render(page, snap, mine, st) {
    var claim = (st && st.claim) || (mine && mine.claim) || null;
    var myKey = claim ? claim.country + ":" + claim.slot : null;
    var bank = st ? Number(st.bank || 0) : null;
    var bidBy = {}; ((mine && mine.bids) || []).forEach(function (b) { bidBy[b.id] = b; });
    var repBy = {}; ((mine && mine.reports) || []).forEach(function (r) { repBy[r.id] = r.player; });

    var listings = (snap.listings || []).filter(function (L) { return !myKey || (L.country + ":" + L.slot) !== myKey; });
    var seg = [["board", "The board"], ["bids", "Your offers"], ["sell", "Selling"], ["deals", "Done deals"]]
      .map(function (t) {
        return "<button type='button' data-mk-tab='" + t[0] + "' class='" + (ST.tab === t[0] ? "on" : "") + "'>" +
          E(t[1]) + (t[0] === "bids" && (mine && mine.bids || []).length ? " &middot; " + mine.bids.length : "") + "</button>";
      }).join("");

    var body;
    if (!claim) {
      body = "<div class='fo-ac-card'><h3>You need a club</h3>" +
        "<p class='fo-ac-p'>The market is between clubs in the served world. Claim one and you can buy, sell and send a scout out.</p>" +
        "<a class='fo-ac-btn' href='#/worldclub'>Claim a club &rsaquo;</a></div>" + howItWorks();
    } else if (ST.tab === "deals") {
      body = "<div class='fo-ac-card'><h3>Done deals<span>the last forty</span></h3>" +
        ((snap.deals || []).length ? snap.deals.map(function (d) {
          return "<div class='fo-mk-deal'><b>" + E(d.player) + "</b><em>" + E(d.from || "?") +
            " &rarr; " + E(d.to || "?") + "</em><u>" + money(d.fee) + "</u></div>";
        }).join("") : "<div class='fo-ac-note'>No cricketer has changed clubs yet. The first one will be remembered.</div>") +
        "</div>" + howItWorks();
    } else if (ST.tab === "sell") {
      body = sellCard(st, mine) + howItWorks();
    } else if (ST.tab === "bids") {
      var open = (mine && mine.bids) || [];
      body = "<div class='fo-ac-card'><h3>Your offers<span>sealed until the window shuts</span></h3>" +
        (open.length ? open.map(function (b) {
          var c = closesIn(b.closes);
          return "<div class='fo-mk-deal'><b>" + E(b.player) + "</b><em>your offer</em><u>" + money(b.amount) + "</u>" +
            "<span class='fo-mk-clock" + (c.soon ? " soon" : "") + "'>" + c.txt + "</span></div>";
        }).join("") : "<div class='fo-ac-note'>You have nothing on the table. Nobody can see that either.</div>") +
        "</div>" + howItWorks();
    } else {
      body = "<div class='fo-ac-card'><h3>On the board<span>" + listings.length + "</span></h3>" +
        (bank != null ? "<div class='fo-ac-note'>In the bank: <b>" + money(bank) + "</b>. Nothing is bought on credit &mdash; an offer you cannot cover is refused.</div>" : "") +
        (listings.length
          ? "<div class='fo-mk-grid'>" + listings.map(function (L) { return card(L, bidBy[L.id], repBy[L.id], bank); }).join("") + "</div>"
          : "<div class='fo-ac-note'>Nothing on the board this minute. Clubs put men up as their shape changes &mdash; look in tomorrow.</div>") +
        "</div>" + howItWorks();
    }

    page.innerHTML = shell("<div class='fo-mk-seg'>" + seg + "</div>" + body);
    wire(page, snap, mine, st);
  }

  function card(L, myBid, report, bank) {
    var s = L.scout || {}, c = closesIn(L.closes);
    var head = "<div class='fo-mk-h'><b>" + E(s.name || L.player || "A cricketer") + "</b>" +
      "<u>" + E(s.impression || "") + "</u>" +
      "<span class='fo-mk-clock" + (c.soon ? " soon" : "") + "'>" + c.txt + "</span></div>";
    var line = "<div class='fo-mk-sub'>" + E(s.role || "cricketer") + " &middot; age " + (s.age || "?") +
      " &middot; " + E(s.hand || "") + (s.bowl ? " &middot; " + E(s.bowl) : "") +
      "<br>From <b>" + E(L.club || "a club") + "</b> &middot; asking <b>" + money(L.asking) + "</b>" +
      " &middot; " + L.bids + " offer" + (L.bids === 1 ? "" : "s") + " in</div>";
    var rep = "";
    if (report) {
      var r = window.foMktReport ? window.foMktReport(report) : null;
      if (r) rep = "<div class='fo-mk-rep'>" +
        "<div><i>Batting</i><b>" + E(r.batting) + "</b></div>" +
        (r.bowling ? "<div><i>Bowling</i><b>" + E(r.bowling) + "</b></div>" : "") +
        "<div><i>Fielding</i><b>" + E(r.fielding) + "</b></div>" +
        "<div><i>Form</i><b>" + E(r.form) + "</b></div>" +
        "<div><i>Legs</i><b>" + E(r.legs) + "</b></div>" +
        "<div><i>Wage</i><b>" + money(r.wage) + "</b></div>" +
        (r.talentNames && r.talentNames.length ? "<div style='grid-column:1/-1'><i>Talents</i><b>" + E(r.talentNames.join(", ")) + "</b></div>" : "") +
        "</div>";
    }
    var floor = Math.ceil(L.asking * 0.55);
    var act = "<div class='fo-mk-row'>" +
      (report ? "" : "<button type='button' class='fo-mk-btn ghost' data-mk-scout='" + L.id + "'>Scout &middot; " + money(L.fee) + "</button>") +
      "<input type='number' inputmode='numeric' id='fo-mk-bid-" + L.id + "' placeholder='" + floor + "+' value='" + (myBid ? myBid.amount : "") + "' aria-label='Your sealed offer'>" +
      "<button type='button' class='fo-mk-btn' data-mk-bid='" + L.id + "'>" + (myBid ? "Change offer" : "Offer") + "</button>" +
      (myBid ? "<button type='button' class='fo-mk-btn ghost' data-mk-unbid='" + L.id + "'>Withdraw</button>" : "") +
      "</div>" +
      (myBid ? "<div class='fo-mk-sub'>Your sealed offer: <b>" + money(myBid.amount) + "</b>. Nobody else can see it.</div>" : "") +
      "<div class='fo-mk-msg' id='fo-mk-m-" + L.id + "'></div>";
    return "<div class='fo-mk-card" + (myBid ? " mine" : "") + "'>" + head + line + rep + act + "</div>";
  }

  function sellCard(st, mine) {
    var squad = (st && st.squad) || [];
    var sales = (mine && mine.sales) || [];
    var opts = squad.map(function (p) {
      return "<option value=\"" + E(p.name) + "\">" + E(p.name) + " &middot; " + (p.age || "?") +
        " &middot; " + money(p.fee || 0) + "</option>";
    }).join("");
    return "<div class='fo-ac-card'><h3>Put a man up</h3>" +
      "<p class='fo-ac-p'>Name a reserve and walk away. The window runs three days; if the best sealed offer reaches your reserve he goes, and if it does not he stays. You never have to be here for any of it.</p>" +
      (squad.length
        ? "<div class='fo-mk-row'><select id='fo-mk-who' class='fo-wj-sel' aria-label='Player'>" + opts + "</select></div>" +
          "<div class='fo-mk-row'><input type='number' inputmode='numeric' id='fo-mk-res' placeholder='Your reserve' aria-label='Reserve'>" +
          "<button type='button' class='fo-mk-btn' id='fo-mk-list'>Put him up</button></div>" +
          "<div class='fo-mk-msg' id='fo-mk-mlist'></div>"
        : "<div class='fo-ac-note'>Your squad has not come down from the world yet.</div>") +
      "<div class='fo-ac-note'>You may have three on the board at once, and you can never sell below a squad of fourteen.</div>" +
      "</div>" +
      "<div class='fo-ac-card'><h3>Your sales</h3>" +
      (sales.length ? sales.map(function (s2) {
        var c = closesIn(s2.closes);
        return "<div class='fo-mk-deal'><b>" + E(s2.player) + "</b>" +
          "<em>" + (s2.status === "sold" ? "sold" : s2.status === "unsold" ? "nobody met the reserve" :
            s2.bids + " offer" + (s2.bids === 1 ? "" : "s") + " &middot; " + c.txt) + "</em>" +
          "<u>" + money(s2.status === "sold" ? s2.fee : s2.reserve) + "</u>" +
          (s2.status === "open" && !s2.bids ? "<button type='button' class='fo-mk-btn ghost' data-mk-pull='" + s2.id + "'>Take him back</button>" : "") +
          "</div>";
      }).join("") : "<div class='fo-ac-note'>Nobody of yours is on the board.</div>") +
      "</div>";
  }

  function howItWorks() {
    return "<div class='fo-ac-card'><h3>How the market works</h3>" +
      "<p class='fo-ac-p'>Every offer is <b>sealed</b>. You cannot see anybody else's and nobody can see yours &mdash; not the seller, not the other bidders &mdash; until the umpire opens them all at once. There is nothing to be gained by watching this page, which is the entire point.</p>" +
      "<p class='fo-ac-p'>A listing stands <b>three world days</b>. When it shuts, the highest offer at or above the seller's reserve takes him: the fee leaves one bank and lands in the other, the man walks into his new dressing room with his record intact, and neither club had to be awake. Miss a day and you have missed nothing. Miss a fortnight and you will find the market has moved without you.</p>" +
      "<p class='fo-ac-p'>You read <b>your own</b> men exactly. Somebody else's is a first impression until you pay a scout, and then he is bands and words &mdash; his form, his legs, what he earns, what he is worth. Nobody, ever, gets a rival's numbers.</p>" +
      "<p class='fo-ac-p'>Nothing is bought on credit: an offer your bank cannot cover is refused before it is filed. A club is never stripped below fourteen men, and eighteen is a full staff &mdash; sell before you buy.</p>" +
      "</div>";
  }

  // the paid report, rendered from the man's own card - the same arithmetic
  // the service uses, kept here so a report a manager has already bought
  // renders without another round trip
  window.foMktReport = function (p) {
    if (!p) return null;
    var S = p.skills || {};
    var band = function (v, w) { var lo = Math.max(0, Math.round((v - w / 2) / 5) * 5); return lo + "-" + (lo + w); };
    var FORMW = ["abysmal", "poor", "shaky", "steady", "good", "strong", "excellent"];
    var bat = Math.round(0.25 * (S.vsPace || 0) + 0.25 * (S.vsSpin || 0) + 0.2 * (S.rotation || 0)
      + 0.15 * (S.temperament || 0) + 0.15 * (S.power || 0));
    var bowl = (p.bowlType && p.bowlType !== "none")
      ? Math.round(((S.wicket || 0) + (S.economy || 0) + (S.discipline || 0) + (S.moveTurn || 0)
        + (S.variation || 0) + (S.stamina || 0)) / 6) : 0;
    var fld = Math.round(((S.fielding || 0) + (S.catching || 0)) / 2);
    return { batting: band(bat, 10), bowling: bowl ? band(bowl, 10) : null, fielding: band(fld, 12),
      form: FORMW[p.formIx == null ? 3 : p.formIx], legs: p.fatWord || p.fatigue || "rested",
      wage: p.wage || 0, talentNames: (p.talents || []).slice(0, 3) };
  };

  function wire(page, snap, mine, st) {
    page.querySelectorAll("[data-mk-tab]").forEach(function (b) {
      b.addEventListener("click", function () { ST.tab = b.getAttribute("data-mk-tab"); render(page, snap, mine, st); });
    });
    var say = function (id, txt, ok) {
      var el = document.getElementById(id); if (!el) return;
      el.textContent = txt; el.className = "fo-mk-msg" + (ok ? " ok" : "");
    };
    var go = function (attr, fn, args, msgId) {
      page.querySelectorAll("[" + attr + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (ST.busy) return;
          var id = +b.getAttribute(attr);
          var a = args(id); if (a === null) return;
          ST.busy = 1; b.disabled = true;
          rpc(fn, a).then(function () { ST.busy = 0; window.foRenderMarketPage(); })
            .catch(function (e) {
              ST.busy = 0; b.disabled = false;
              say(msgId(id), String(e.message).slice(0, 140));
            });
        });
      });
    };
    go("data-mk-scout", "world_market_scout", function (id) { return { p_id: id }; },
      function (id) { return "fo-mk-m-" + id; });
    go("data-mk-unbid", "world_market_unbid", function (id) { return { p_id: id }; },
      function (id) { return "fo-mk-m-" + id; });
    go("data-mk-pull", "world_market_withdraw", function (id) { return { p_id: id }; },
      function () { return "fo-mk-mlist"; });
    go("data-mk-bid", "world_market_bid", function (id) {
      var el = document.getElementById("fo-mk-bid-" + id);
      var v = el ? Math.round(+el.value || 0) : 0;
      if (!v) { say("fo-mk-m-" + id, "Name a figure first."); return null; }
      return { p_id: id, p_amount: v };
    }, function (id) { return "fo-mk-m-" + id; });

    var list = page.querySelector("#fo-mk-list");
    if (list) list.addEventListener("click", function () {
      if (ST.busy) return;
      var who = document.getElementById("fo-mk-who"), res = document.getElementById("fo-mk-res");
      var v = res ? Math.round(+res.value || 0) : 0;
      if (!who || !who.value) { say("fo-mk-mlist", "Pick a man."); return; }
      if (!v) { say("fo-mk-mlist", "Name a reserve - the least you will let him go for."); return; }
      ST.busy = 1; list.disabled = true;
      rpc("world_market_list", { p_player: who.value, p_reserve: v })
        .then(function () { ST.busy = 0; window.foRenderMarketPage(); })
        .catch(function (e) { ST.busy = 0; list.disabled = false; say("fo-mk-mlist", String(e.message).slice(0, 140)); });
    });
  }
})();
